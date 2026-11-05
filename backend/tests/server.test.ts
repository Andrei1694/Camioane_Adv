import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';
import { fixtureUrl, freePort, runNode, spawnNode } from './helpers/process.ts';

const unreachableDatabase = 'postgresql://unused:unused@127.0.0.1:1/unused';
const signals = ['--import', fixtureUrl('preload-signals.ts')];

async function startServer(port: number, preloads: string[] = []) {
  const run = spawnNode([...signals, ...preloads, 'src/server.ts'], { env: { PORT: String(port) }, ipc: true });
  await run.waitForOutput(`Camioane API listening on http://localhost:${port}`);
  return run;
}

describe('Server startup and shutdown', () => {
  it('fails during application startup when the secret is invalid', async () => {
    const result = await runNode(['src/server.ts'], { env: { JWT_SECRET: '', DATABASE_URL: unreachableDatabase } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT_SECRET/);
    assert.doesNotMatch(result.stdout, /listening|Connected to PostgreSQL/);
  });

  it('rejects an invalid port', async () => {
    for (const port of ['abc', '0', '65536', '1.5', '-1']) {
      const result = await runNode(['src/server.ts'], { env: { PORT: port } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /PORT must be an integer between 1 and 65535\./);
      assert.equal(result.stdout, '');
    }
  });

  it('refuses to start without a working ffprobe', async () => {
    const result = await runNode(['src/server.ts'], { env: { PORT: String(await freePort()), FFPROBE_PATH: '/nonexistent/ffprobe' } });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'ffprobe could not run. Install FFmpeg, or set FFPROBE_PATH to the ffprobe binary.');
    assert.equal(result.stdout, '');
  });

  it('refuses to start without the database', async () => {
    const result = await runNode(['src/server.ts'], { env: { PORT: String(await freePort()), DATABASE_URL: unreachableDatabase } });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'PostgreSQL connection failed. Check DATABASE_URL and confirm the database is running.');
    assert.doesNotMatch(result.stdout, /listening/);
  });

  it('serves requests and shuts down cleanly once, whichever signals arrive', async () => {
    const port = await freePort();
    const run = await startServer(port);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await response.json(), { status: 'ok' });
    run.child.send('SIGTERM');
    run.child.send('SIGINT');
    const result = await run.exited;
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Connected to PostgreSQL\.\n/);
    assert.equal(result.stderr, '');
  });

  it('reports a port that is already in use', async () => {
    const blocker = createServer().listen(0);
    await once(blocker, 'listening');
    const address = blocker.address();
    assert.ok(address && typeof address !== 'string');
    try {
      const result = await runNode(['src/server.ts'], { env: { PORT: String(address.port) } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /^HTTP server failed: listen EADDRINUSE/);
    } finally {
      blocker.close();
    }
  });

  it('exits with an error when the database connection does not close', async () => {
    const run = await startServer(await freePort(), ['--import', fixtureUrl('preload-failing-disconnect.ts')]);
    run.child.send('SIGINT');
    const result = await run.exited;
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'Failed to close the PostgreSQL connection.');
  });
});
