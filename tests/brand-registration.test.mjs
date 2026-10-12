import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandRegistrationRedirect, brandRegistrationError, brandRegistrationMessage } from '../src/brand/registration.ts';

const production = 'https://storyloop-six.vercel.app';
const preview = 'https://storyloop-preview-storyloop.vercel.app';
const callback = '/brand/auth/callback';

test('registration works without the optional site setting using deployment metadata', () => {
  assert.equal(brandRegistrationRedirect({ VERCEL_PROJECT_PRODUCTION_URL: 'storyloop-six.vercel.app' }, production), production + callback);
  assert.equal(brandRegistrationRedirect({ NEXT_PUBLIC_SITE_URL: ' ', VERCEL_URL: 'storyloop-preview-storyloop.vercel.app' }, preview), preview + callback);
  assert.equal(brandRegistrationRedirect({ VERCEL_BRANCH_URL: 'storyloop-git-main-storyloop.vercel.app' }, 'https://storyloop-git-main-storyloop.vercel.app'), 'https://storyloop-git-main-storyloop.vercel.app' + callback);
});

test('the callback stays on the trusted submitting site so its PKCE cookie is available', () => {
  const env = { NEXT_PUBLIC_SITE_URL: production, VERCEL_URL: preview, VERCEL_PROJECT_PRODUCTION_URL: 'storyloop-six.vercel.app' };
  assert.equal(brandRegistrationRedirect(env, preview), preview + callback);
  assert.equal(brandRegistrationRedirect(env, production), production + callback);
  assert.equal(brandRegistrationRedirect({ NEXT_PUBLIC_SITE_URL: ' http://127.0.0.1:3001/ ' }, 'http://127.0.0.1:3001'), 'http://127.0.0.1:3001' + callback);
});

test('missing configuration and untrusted or malformed origins cannot receive confirmation codes', () => {
  const env = { NEXT_PUBLIC_SITE_URL: production };
  assert.equal(brandRegistrationRedirect({}, production), null);
  for (const origin of [null, 'null', 'https://attacker.example', production + '.attacker.example', 'http://storyloop-six.vercel.app', 'https://user:pass@storyloop-six.vercel.app', production + '/path', production + '?next=evil', production + '#fragment']) {
    assert.equal(brandRegistrationRedirect(env, origin), null, String(origin));
  }
  for (const configured of ['not a url', 'javascript:alert(1)', 'ftp://storyloop-six.vercel.app', 'https://user:pass@storyloop-six.vercel.app']) {
    assert.equal(brandRegistrationRedirect({ NEXT_PUBLIC_SITE_URL: configured }, production), null);
  }
});

test('configuration and provider errors are distinct from password length errors', () => {
  assert.match(brandRegistrationMessage('details'), /at least 6 characters/);
  assert.doesNotMatch(brandRegistrationMessage('configuration'), /password|6 characters/);
  assert.equal(brandRegistrationError({ status: 429 }), 'rate_limit');
  assert.equal(brandRegistrationError({ code: 'weak_password' }), 'weak_password');
  assert.equal(brandRegistrationError({ code: 'signup_disabled' }), 'unavailable');
  assert.equal(brandRegistrationError({ code: 'email_address_not_authorized' }), 'email_unavailable');
  assert.equal(brandRegistrationError({ code: 'unexpected_failure', status: 500 }), 'registration');
  assert.doesNotMatch(brandRegistrationMessage('<script>provider error</script>'), /<script>/);
});
