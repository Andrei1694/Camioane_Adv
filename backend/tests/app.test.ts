import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { closeServer, listen, startServer } from './helpers/api.ts';
import type { TestServer } from './helpers/api.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';

let api: TestServer;

before(async () => {
  api = await startServer();
});

after(async () => {
  await api.close();
});

async function failingApp(handler: RequestHandler, test: (baseUrl: string) => Promise<void>) {
  const application = express();
  application.get('/failure', handler);
  application.use(errorHandler);
  const server = application.listen(0, '127.0.0.1');
  try {
    await test(await listen(server));
  } finally {
    await closeServer(server);
  }
}

async function expectError(handler: RequestHandler, status: number, error: string) {
  await failingApp(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error });
  });
}

describe('Application routes', () => {
  it('preserves the API root, health response, and JSON 404 behavior', async () => {
    for (const [path, status, expected] of [
      ['/', 200, { message: 'Camioane API' }],
      ['/health', 200, { status: 'ok' }],
      ['/missing', 404, { error: 'Route not found' }],
      ['/users', 401, { error: 'Unauthorized' }],
      ['/files', 401, { error: 'Unauthorized' }],
      ['/credits/balance', 401, { error: 'Unauthorized' }],
    ] as const) {
      const response = await api.request('GET', path);
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), expected);
      assert.equal(response.headers.get('x-powered-by'), null);
    }
  });

  it('allows the admin app and website origins and the required request headers', async () => {
    for (const origin of ['http://localhost:5173', 'http://localhost:5174']) {
      const response = await api.request('OPTIONS', '/users/login', {
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization',
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type,Authorization');
      assert.equal(response.headers.get('access-control-allow-methods'), 'GET,POST,PUT,PATCH,DELETE');
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
    }
    const otherOrigin = 'https://untrusted.example';
    const denied = await api.request('GET', '/health', { headers: { Origin: otherOrigin } });
    assert.notEqual(denied.headers.get('access-control-allow-origin'), otherOrigin);
    await denied.json();
  });

  it('rejects request bodies in unsupported charsets or encodings', async () => {
    const cases: Record<string, string>[] = [
      { 'Content-Type': 'application/json; charset=latin1' },
      { 'Content-Type': 'application/json', 'Content-Encoding': 'compress' },
    ];
    for (const headers of cases) {
      const response = await api.request('POST', '/users/login', { body: '{}', headers });
      assert.equal(response.status, 415);
      assert.deepEqual(await response.json(), { error: 'Unsupported request encoding' });
    }
  });
});

describe('Central error handler', () => {
  it('hides internal error details in JSON responses', async () => {
    await expectError(() => {
      throw new Error('private database or credential details');
    }, 500, 'Internal server error');
    await expectError(async () => {
      await Promise.reject(new TypeError('private'));
    }, 500, 'Internal server error');
    await expectError(() => {
      throw Object.assign(new Error('private'), { type: 'stream.not.readable' });
    }, 500, 'Internal server error');
  });

  it('maps upload limit errors', async () => {
    await expectError(() => {
      throw new multer.MulterError('LIMIT_FILE_SIZE');
    }, 413, 'File exceeds the upload size limit');
    for (const code of ['LIMIT_PART_COUNT', 'LIMIT_FIELD_COUNT', 'LIMIT_UNEXPECTED_FILE'] as const) {
      await expectError(() => {
        throw new multer.MulterError(code);
      }, 400, 'Upload exactly one file in the file field, without additional fields');
    }
  });

  it('maps body parser errors', async () => {
    for (const [type, status, error] of [
      ['entity.parse.failed', 400, 'Invalid JSON body'],
      ['entity.too.large', 413, 'Request body is too large'],
      ['charset.unsupported', 415, 'Unsupported request encoding'],
      ['encoding.unsupported', 415, 'Unsupported request encoding'],
    ] as const) {
      await expectError(() => {
        throw Object.assign(new Error('body parser'), { type });
      }, status, error);
    }
  });

  it('ends the connection when headers were already sent', async (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    await failingApp((req, res) => {
      res.status(200).write('partial');
      throw new Error('stream failed');
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/failure`);
      assert.equal(response.status, 200);
      await assert.rejects(response.text());
    });
    // Express logs the handler's replacement error, never the original one.
    assert.ok(logged.mock.calls.some((call) => String(call.arguments[0]).includes('Request failed after headers were sent.')));
    assert.ok(logged.mock.calls.every((call) => !String(call.arguments[0]).includes('stream failed')));
  });
});
