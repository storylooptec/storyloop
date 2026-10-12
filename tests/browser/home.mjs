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
