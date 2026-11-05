import './helpers/env.ts';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authConfig, loadAuthConfig } from '../src/config/auth.ts';

const secret = process.env.JWT_SECRET ?? '';

describe('Authentication configuration', () => {
  it('requires a nonblank secret of at least 32 bytes', () => {
    for (const value of [undefined, '', ' '.repeat(32), 'x'.repeat(31), 'é'.repeat(15)]) {
      assert.throws(() => loadAuthConfig({ JWT_SECRET: value }), /JWT_SECRET/);
    }
    assert.deepEqual(loadAuthConfig({ JWT_SECRET: secret }).jwtSecret, new TextEncoder().encode(secret));
    // The limit counts UTF-8 bytes, not characters.
    assert.equal(loadAuthConfig({ JWT_SECRET: 'é'.repeat(16) }).jwtSecret.byteLength, 32);
  });

  it('defaults to the local admin app and website origins', () => {
    const config = loadAuthConfig({ JWT_SECRET: secret });
    assert.equal(config.frontendOrigin, 'http://localhost:5173');
    assert.equal(config.websiteOrigin, 'http://localhost:5174');
  });

  for (const [name, key] of [['FRONTEND_ORIGIN', 'frontendOrigin'], ['WEBSITE_ORIGIN', 'websiteOrigin']] as const) {
    it(`accepts HTTP(S) values for ${name} and rejects malformed origins and paths`, () => {
      for (const origin of ['https://camioane.example', 'http://localhost:8080']) {
        assert.equal(loadAuthConfig({ JWT_SECRET: secret, [name]: origin })[key], origin);
      }
      for (const origin of ['', '*', 'not a url']) {
        assert.throws(() => loadAuthConfig({ JWT_SECRET: secret, [name]: origin }), { message: `${name} must be an HTTP or HTTPS origin.` });
      }
      for (const origin of ['ftp://example.com', 'https://example.com/', 'https://example.com/path', 'HTTPS://EXAMPLE.COM']) {
        assert.throws(() => loadAuthConfig({ JWT_SECRET: secret, [name]: origin }), { message: `${name} must be an HTTP or HTTPS origin without a path.` });
      }
    });
  }

  it('loads the process configuration when the module is imported', () => {
    assert.deepEqual(authConfig, loadAuthConfig());
  });
});
