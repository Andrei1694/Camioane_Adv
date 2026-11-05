import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { verify } from 'argon2';
import { Fixtures, password, requireDatabase } from './helpers/fixtures.ts';
import { fixtureUrl, runNode } from './helpers/process.ts';
import { prisma } from '../src/lib/prisma.ts';

const unreachableDatabase = 'postgresql://unused:unused@127.0.0.1:1/unused';
const bootstrap = ['--import', fixtureUrl('preload-tty.ts'), 'src/scripts/bootstrap-admin.ts'];
const emailPrompt = 'Administrator email: ';
const passwordPrompt = 'Password (12–128 characters, hidden): ';
const confirmPrompt = 'Confirm password (hidden): ';
const promotePrompt = 'Promote this existing account to administrator? Type yes: ';
const fixtures = new Fixtures();

before(async () => {
  await requireDatabase();
});

afterEach(async () => {
  await fixtures.cleanup();
});

after(async () => {
  await prisma.$disconnect();
});

describe('Database check', () => {
  it('reports the connected database and user', async () => {
    const result = await runNode(['src/scripts/check-db.ts']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^PostgreSQL connection successful: \{ database: '[^']+', user: '[^']+' \}\n$/);
  });

  it('reports an unreachable database without details', async () => {
    const result = await runNode(['src/scripts/check-db.ts'], { env: { DATABASE_URL: unreachableDatabase } });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'PostgreSQL connection failed. Check DATABASE_URL and confirm the database is running.');
  });

  it('requires DATABASE_URL before connecting', async () => {
    for (const value of [undefined, '  ']) {
      const result = await runNode(['src/scripts/check-db.ts'], { env: { DATABASE_URL: value } });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /DATABASE_URL is required\. Configure it in backend\/\.env\./);
    }
  });
});

describe('Administrator bootstrap', () => {
  it('runs only in an interactive terminal', async () => {
    const result = await runNode(['src/scripts/bootstrap-admin.ts']);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'Run admin:bootstrap in an interactive terminal.');
  });

  it('creates an administrator with a hidden, confirmed password', async () => {
    const email = fixtures.email('bootstrap');
    const result = await runNode(bootstrap, {
      answers: [[emailPrompt, ` ${email.toUpperCase()}\n`], [passwordPrompt, `${password}\n`], [confirmPrompt, `${password}\n`]],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Administrator created\. You can now sign in\.\n$/);
    // The email echoes as typed; the password never does.
    assert.ok(result.stdout.includes(email.toUpperCase()));
    assert.ok(!result.stdout.includes(password.trim()));
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
    assert.equal(user.role.name, 'ADMIN');
    assert.equal(await verify(user.password, password), true);
  });

  it('rejects invalid input and mismatched passwords without creating an account', async () => {
    const email = fixtures.email('bootstrap');
    for (const [answers, error] of [
      [[[emailPrompt, 'not-an-email\n']], 'A valid email address is required'],
      [[[emailPrompt, `${email}\n`], [passwordPrompt, 'too short\n']], 'Password must contain between 12 and 128 characters'],
      [[[emailPrompt, `${email}\n`], [passwordPrompt, `${password}\n`], [confirmPrompt, 'a different password\n']], 'Passwords do not match'],
    ] as const) {
      const result = await runNode(bootstrap, { answers: answers.map(([prompt, answer]) => [prompt, answer]) });
      assert.equal(result.status, 1);
      assert.equal(result.stderr.trim(), error);
    }
    assert.equal(await prisma.user.count({ where: { email } }), 0);
  });

  it('leaves an existing administrator unchanged', async () => {
    const admin = await fixtures.user('ADMIN');
    const result = await runNode(bootstrap, { answers: [[emailPrompt, `${admin.email}\n`]] });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /This account is already an administrator\. No changes made\.\n$/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).sessionVersion, admin.sessionVersion);
  });

  it('promotes an existing account only after explicit confirmation', async () => {
    const account = await fixtures.user('DRIVER');
    const declined = await runNode(bootstrap, { answers: [[emailPrompt, `${account.email}\n`], [promotePrompt, 'y\n']] });
    assert.equal(declined.status, 0, declined.stderr);
    assert.match(declined.stdout, /Cancelled\. No changes made\.\n$/);
    let stored = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, include: { role: true } });
    assert.equal(stored.role.name, 'DRIVER');

    const accepted = await runNode(bootstrap, { answers: [[emailPrompt, `${account.email}\n`], [promotePrompt, ' YES \n']] });
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /Administrator access granted\. Existing sessions must sign in again\.\n$/);
    stored = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, include: { role: true } });
    assert.equal(stored.role.name, 'ADMIN');
    assert.equal(stored.sessionVersion, account.sessionVersion + 1);
  });

  it('stops on Ctrl+C', async () => {
    const result = await runNode(bootstrap, { answers: [[emailPrompt, '\u0003']] });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'Cancelled. No further changes made.');
  });

  it('hides database errors', async () => {
    const result = await runNode(bootstrap, {
      env: { DATABASE_URL: unreachableDatabase },
      answers: [[emailPrompt, `${fixtures.email('bootstrap')}\n`]],
    });
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), 'Setup failed. Check database connectivity and migrations.');
  });
});
