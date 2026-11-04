import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

const secret = randomBytes(32).toString('hex');
process.env.JWT_SECRET = secret;
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
const { loadAuthConfig } = await import('../src/config/auth.ts');

describe('Authentication configuration', () => {
  it('requires a nonblank secret of at least 32 bytes', () => {
    for (const value of [undefined, '', ' '.repeat(32), 'x'.repeat(31)]) {
      assert.throws(() => loadAuthConfig({ JWT_SECRET: value }), /JWT_SECRET/);
    }
    assert.deepEqual(loadAuthConfig({ JWT_SECRET: secret }).jwtSecret, new TextEncoder().encode(secret));
    assert.equal(loadAuthConfig({ JWT_SECRET: secret }).frontendOrigin, 'http://localhost:5173');
  });

  it('accepts HTTP(S) origins and rejects malformed origins and paths', () => {
    for (const origin of ['https://camioane.example', 'http://localhost:5174']) {
      assert.equal(loadAuthConfig({ JWT_SECRET: secret, FRONTEND_ORIGIN: origin }).frontendOrigin, origin);
    }
    for (const origin of ['', '*', 'ftp://example.com', 'https://example.com/', 'https://example.com/path']) {
      assert.throws(() => loadAuthConfig({ JWT_SECRET: secret, FRONTEND_ORIGIN: origin }), /FRONTEND_ORIGIN/);
    }
  });

  it('fails during application startup when the secret is invalid', () => {
    const serverUrl = new URL('../src/server.ts', import.meta.url).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(serverUrl)})`], {
      env: { ...process.env, JWT_SECRET: '', DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused' },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT_SECRET/);
    assert.doesNotMatch(result.stdout, /listening|Connected to PostgreSQL/);
  });
});
