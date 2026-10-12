import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote'], headless: true });
const origin = process.env.BRAND_TEST_ORIGIN || 'http://127.0.0.1:3001';
const artifacts = new URL('./artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
// An unavailable/invalid logo must leave a visible wordmark and usable navigation.
await page.route('**/api/brand/logo?*', route => route.fulfill({ contentType: 'image/png', body: 'unavailable' }));
try {
  const response = await page.goto(origin + '/');
  assert.equal(response.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/');
  await page.locator('h1').waitFor();
  assert.match(await page.title(), /Storyloop.*creators and brands/);
  assert.equal(await page.locator('h1').count(), 1);
  await page.waitForFunction(() => !document.querySelector('header img'));
  assert.ok(await page.getByRole('link', { name: 'Storyloop home', exact: true }).first().isVisible());
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
  await page.getByRole('link', { name: 'How it works', exact: true }).click();
  assert.equal(new URL(page.url()).hash, '#how-it-works');

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 });
    await page.goto(origin + '/');
    await page.locator('h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at ${width}px`);
    for (const name of ['For creators', 'For brands', 'Admin']) {
      const link = page.getByRole('link', { name, exact: true });
      const box = await link.boundingBox();
      assert.ok(box && box.height >= 44, `${name} tap target at ${width}px`);
    }
    const creator = page.getByRole('link', { name: /I'm a creator/ });
    const brand = page.getByRole('link', { name: /I'm a brand/ });
    const a = await creator.boundingBox(), b = await brand.boundingBox();
    if (width <= 700) assert.ok(b.y >= a.y + a.height, 'Mobile entries stack');
    else assert.ok(Math.abs(a.y - b.y) < 1, 'Desktop entries sit side by side');
    if (width === 1440 || width === 390) {
      await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => node.blur()));
      await page.screenshot({ path: new URL(`homepage-${width === 1440 ? 'desktop' : 'mobile'}.png`, artifacts).pathname, fullPage: true });
    }
    console.log(`PASS homepage layout and tap targets at ${width}px`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [name, destination] of [[/I'm a creator/, '/creator/login'], [/I'm a brand/, '/brand'], [/^Admin$/, '/admin/login']]) {
    await page.goto(origin + '/');
    await page.getByRole('link', { name }).click();
    await page.waitForURL(url => url.pathname === destination);
    assert.ok(await page.locator('main').isVisible());
    console.log(`PASS homepage navigation to ${destination}`);
  }

  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 });
    await page.goto(origin + '/brand');
    await page.waitForFunction(() => !document.querySelector('header img'));
    await page.evaluate(() => document.fonts.ready);
    const logo = page.getByRole('link', { name: 'Storyloop home', exact: true });
    assert.ok(await logo.getByText('Storyloop.', { exact: true }).isVisible(), 'Brand logo fallback is visible');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Brand has no overflow at ${width}px`);
    for (const name of ['Home', 'Sign in', 'Create account']) {
      const link = page.locator('header').getByRole('link', { name, exact: true });
      assert.ok(await link.isVisible(), `${name} remains visible at ${width}px`);
      assert.ok((await link.boundingBox()).height >= 44, `${name} tap target at ${width}px`);
    }
    if (width === 1440 || width === 390) {
      await page.screenshot({ path: new URL(`brand-header-${width === 1440 ? 'desktop' : 'mobile'}.png`, artifacts).pathname, fullPage: true });
    }
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/');
    console.log(`PASS brand logo fallback and Home navigation at ${width}px`);
  }

  await page.route('**/api/brand/logo?*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="38"><text x="0" y="28">Test logo</text></svg>' }));
  await page.goto(origin + '/brand');
  await page.locator('header [data-logo-loaded="true"]').waitFor();
  const uploadedLogo = page.locator('header img');
  assert.equal(await uploadedLogo.evaluate(node => node.naturalWidth > 0 && getComputedStyle(node).opacity === '1'), true);
  assert.equal(await page.getByRole('link', { name: 'Storyloop home', exact: true }).getByText('Storyloop.', { exact: true }).isVisible(), false);
  await page.getByRole('link', { name: 'Storyloop home', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/');
  console.log('PASS uploaded brand logo replaces fallback and links home');

  // Password visibility must preserve the value and never submit the form.
  await page.route('**/api/brand/logo?*', route => route.fulfill({ contentType: 'image/png', body: 'unavailable' }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/brand', '/brand/register']) {
      await page.goto(origin + path);
      const password = page.getByLabel('Password', { exact: true });
      await password.fill('abc123');
      assert.equal(await password.getAttribute('type'), 'password');
      const show = page.getByRole('button', { name: 'Show password', exact: true });
      assert.equal(await show.getAttribute('type'), 'button');
      const box = await show.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, 'Eye button has a usable tap target');
      await show.click();
      assert.equal(await password.getAttribute('type'), 'text');
      assert.equal(await password.inputValue(), 'abc123');
      const hide = page.getByRole('button', { name: 'Hide password', exact: true });
      await hide.focus();
      await page.keyboard.press('Enter');
      assert.equal(await password.getAttribute('type'), 'password');
      assert.equal(await password.inputValue(), 'abc123');
      assert.equal(new URL(page.url()).pathname, path, 'Toggle does not navigate or submit');
      assert.equal(new URL(page.url()).search, '', 'Toggle does not submit the form');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await password.fill('');
      await page.screenshot({ path: new URL(`brand-password-${path.endsWith('register') ? 'register' : 'login'}-${width}.png`, artifacts).pathname, fullPage: true });
    }
    console.log(`PASS password eye button on sign-in and registration at ${width}px`);
  }

  await page.goto(origin + '/brand/register');
  await page.getByLabel('Work email').fill('brand@example.test');
  const registrationPassword = page.getByLabel('Password', { exact: true });
  await registrationPassword.pressSequentially('abc12');
  assert.equal(await registrationPassword.evaluate(node => node.validity.tooShort), true, 'Browser rejects fewer than six characters');
  // Bypass native validation to verify the server independently enforces the minimum.
  await page.locator('form').evaluate(form => { form.noValidate = true; });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('error') === 'details');
  assert.match(await page.locator('main').getByRole('alert').innerText(), /at least 6 characters/);
  for (const value of ['abc123', 'longer-password-123']) {
    await page.goto(origin + '/brand/register');
    await page.getByLabel('Work email').fill('brand@example.test');
    await registrationPassword.fill(value);
    assert.equal(await registrationPassword.evaluate(node => node.checkValidity()), true);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('sent') === '1');
    assert.match(await page.getByRole('status').innerText(), /confirmation link/);
  }
  for (const [email, code, message] of [
    ['limited@example.test', 'rate_limit', /Too many attempts/],
    ['weak@example.test', 'weak_password', /This password was not accepted/],
    ['blocked@example.test', 'email_unavailable', /confirmation email to this address/],
    ['unavailable@example.test', 'registration', /We couldn’t create your account/],
  ]) {
    await page.goto(origin + '/brand/register');
    await page.getByLabel('Work email').fill(email);
    await registrationPassword.fill('abc123');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('error') === code);
    assert.match(await page.locator('main').getByRole('alert').innerText(), message);
  }
  await page.goto(origin + '/brand/register?error=configuration');
  const configurationMessage = await page.locator('main').getByRole('alert').innerText();
  assert.match(configurationMessage, /registration is temporarily unavailable/);
  assert.doesNotMatch(configurationMessage, /password|6 characters/);
  console.log('PASS confirmation URL and distinct registration error messages');
  await page.goto(origin + '/brand');
  await page.getByLabel('Work email').fill('brand@example.test');
  await page.getByLabel('Password', { exact: true }).fill('abc123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => url.searchParams.get('error') === 'credentials');
  assert.equal(await page.locator('button[formnovalidate]').count(), 1, 'Email code still bypasses password validation');
  console.log('PASS six-character and longer registration, short-password rejection, and sign-in submission against local Auth fixtures');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/');
  const card = page.getByRole('link', { name: /I'm a creator/ });
  await card.hover();
  assert.equal(await card.evaluate(node => getComputedStyle(node).transform), 'none');
  assert.deepEqual(errors, [], 'No browser errors');
  console.log('PASS homepage keyboard access, missing-logo fallback, auth boundaries and reduced motion');
} catch (error) {
  console.error('Homepage browser errors:', errors);
  await page.screenshot({ path: new URL('homepage-failure.png', artifacts).pathname, fullPage: true });
  throw error;
} finally { await browser.close(); }
