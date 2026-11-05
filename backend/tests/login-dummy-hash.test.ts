import './helpers/env.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, it, mock } from 'node:test';
import * as argon2 from 'argon2';

// Login verifies unknown emails against a dummy hash, computed once, so their
// timing matches real accounts. This file mocks argon2 before loading the
// service, so it runs in its own process.
const realHash = argon2.hash;
let hashCalls = 0;
mock.module('argon2', {
  exports: {
    ...argon2,
    async hash(...args: Parameters<typeof realHash>) {
      hashCalls++;
      if (hashCalls === 1) throw new Error('Simulated hashing failure');
      return realHash(...args);
    },
  },
});
const { loginUser } = await import('../src/services/user.service.ts');
const { prisma } = await import('../src/lib/prisma.ts');

after(async () => {
  await prisma.$disconnect();
});

it('recomputes the dummy hash after a failure and then reuses it', async () => {
  const credentials = { email: `missing-${randomUUID()}@example.test`, password: 'a long enough password' };
  await assert.rejects(loginUser(credentials), /Simulated hashing failure/);
  const results = await Promise.allSettled([loginUser(credentials), loginUser(credentials)]);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.deepEqual({ status: result.reason.status, message: result.reason.message }, { status: 401, message: 'Invalid email or password' });
  }
  await assert.rejects(loginUser(credentials), { status: 401 });
  assert.equal(hashCalls, 2);
});
