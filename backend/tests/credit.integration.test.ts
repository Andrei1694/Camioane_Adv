import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { startServer } from './helpers/api.ts';
import type { RequestOptions, TestServer } from './helpers/api.ts';
import { Fixtures, requireDatabase } from './helpers/fixtures.ts';
import type { FixtureUser } from './helpers/fixtures.ts';
import { driverConflict, failTransactions, knownError } from './helpers/prisma.ts';
import { loadCreditConfig } from '../src/config/credits.ts';
import { prisma } from '../src/lib/prisma.ts';
import { createCreditService } from '../src/services/credit.service.ts';

interface Purchase {
  id: string;
  userId: string | null;
  credits: number;
  unitPriceMinor: number;
  amountMinor: number;
  currency: string;
  status: string;
  reference: string | null;
  createdAt: string;
  settledAt: string | null;
}

interface Transaction {
  id: string;
  userId: string | null;
  amount: number;
  balanceAfter: number;
  type: string;
  purchaseId: string | null;
  note: string | null;
  createdAt: string;
}

const fixtures = new Fixtures();
const maxBalance = 2147483647;
let api: TestServer;
let user: FixtureUser;
let admin: FixtureUser;

function call(method: string, path: string, token?: string, body?: unknown) {
  const options: RequestOptions = {};
  if (token !== undefined) options.token = token;
  if (body !== undefined) options.body = body;
  return api.request(method, path, options);
}

async function result(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function expectError(response: Promise<Response>, status: number, error: string) {
  assert.deepEqual(await result(await response), { status, body: { error } });
}

async function buy(buyer: FixtureUser, credits: number): Promise<Purchase> {
  const response = await call('POST', '/credits/purchases', buyer.token, { credits });
  assert.equal(response.status, 201);
  const { purchase } = await response.json();
  fixtures.purchaseIds.add(purchase.id);
  return purchase;
}

async function confirm(purchase: Purchase, body?: unknown) {
  return call('POST', `/credits/purchases/${purchase.id}/confirm`, admin.token, body);
}

async function balanceOf(account: FixtureUser) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).creditBalance;
}

describe('Credits API', { concurrency: false }, () => {
  before(async () => {
    await requireDatabase();
    api = await startServer();
  });

  beforeEach(async () => {
    user = await fixtures.user('USER');
    admin = await fixtures.user('ADMIN');
  });

  afterEach(async () => {
    await fixtures.cleanup();
  });

  after(async () => {
    await api.close();
    await prisma.$disconnect();
  });

  it('reports balances with the configured price, scoped to the caller', async () => {
    const response = await call('GET', '/credits/balance', user.token);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { balance: 0, currency: 'RON', unitPriceMinor: 250 });
    await prisma.user.update({ where: { id: user.id }, data: { creditBalance: 42 } });
    assert.deepEqual((await result(await call('GET', `/credits/balance?userId=${user.id.toUpperCase()}`, user.token))).body.balance, 42);
    assert.deepEqual((await result(await call('GET', `/credits/balance?userId=${user.id}`, admin.token))).body.balance, 42);
    assert.deepEqual((await result(await call('GET', '/credits/balance', admin.token))).body.balance, 0);
    await expectError(call('GET', `/credits/balance?userId=${admin.id}`, user.token), 403, 'Administrator access is required');
    await expectError(call('GET', `/credits/balance?userId=${randomUUID()}`, admin.token), 404, 'User not found');
    await expectError(call('GET', '/credits/balance?userId=nope', admin.token), 400, 'A valid user ID is required');
    await expectError(call('GET', '/credits/balance?limit=1', user.token), 400, 'Only userId can be provided');
    await expectError(call('GET', '/credits/balance'), 401, 'Unauthorized');
  });

  it('creates pending purchases priced from configuration', async () => {
    const purchase = await buy(user, 4);
    assert.deepEqual(purchase, {
      id: purchase.id, userId: user.id, credits: 4, unitPriceMinor: 250, amountMinor: 1000, currency: 'RON',
      status: 'PENDING', reference: null, createdAt: purchase.createdAt, settledAt: null,
    });
    assert.equal((await buy(user, 100000)).amountMinor, 25000000);
    await expectError(call('POST', '/credits/purchases', user.token, { credits: 0 }), 400, 'Credits must be a whole number between 1 and 100000');
    await expectError(call('POST', '/credits/purchases', user.token, { credits: 1, unitPriceMinor: 1 }), 400, 'Only credits can be provided');
    await expectError(call('POST', '/credits/purchases', user.token, [1]), 400, 'A JSON object is required');
    await expectError(call('POST', '/credits/purchases', user.token), 400, 'A JSON object is required');
    assert.equal(await prisma.creditPurchase.count({ where: { userId: user.id } }), 2);
  });

  it('lists purchases newest first, filtered by owner and status', async () => {
    const other = await fixtures.user('DRIVER');
    const first = await buy(user, 1);
    const second = await buy(user, 2);
    const theirs = await buy(other, 3);
    await call('POST', `/credits/purchases/${first.id}/cancel`, user.token);

    const own = await result(await call('GET', '/credits/purchases', user.token));
    assert.equal(own.status, 200);
    assert.equal(own.body.total, 2);
    assert.deepEqual(own.body.purchases.map((purchase: Purchase) => [purchase.id, purchase.status]), [[second.id, 'PENDING'], [first.id, 'CANCELED']]);
    const page = await result(await call('GET', '/credits/purchases?limit=1&offset=1', user.token));
    assert.deepEqual(page.body.purchases.map((purchase: Purchase) => purchase.id), [first.id]);
    const pending = await result(await call('GET', '/credits/purchases?status=PENDING', user.token));
    assert.deepEqual(pending.body, { purchases: [second], total: 1 });

    const filtered = await result(await call('GET', `/credits/purchases?userId=${other.id}`, admin.token));
    assert.deepEqual(filtered.body, { purchases: [theirs], total: 1 });
    const everyone = await result(await call('GET', '/credits/purchases?limit=100', admin.token));
    const ids = everyone.body.purchases.map((purchase: Purchase) => purchase.id);
    for (const purchase of [first, second, theirs]) assert.ok(ids.includes(purchase.id));

    await expectError(call('GET', `/credits/purchases?userId=${other.id}`, user.token), 403, 'Administrator access is required');
    await expectError(call('GET', '/credits/purchases?status=paid', user.token), 400, 'Status must be PENDING, PAID, FAILED, CANCELED');
    await expectError(call('GET', '/credits/purchases?limit=500', user.token), 400, 'Invalid pagination');
    await expectError(call('GET', '/credits/purchases?sort=asc', user.token), 400, 'Only limit, offset, userId, status can be provided');
  });

  it('lets owners and administrators cancel pending purchases once', async () => {
    const purchase = await buy(user, 5);
    const canceled = await result(await call('POST', `/credits/purchases/${purchase.id}/cancel`, user.token));
    assert.equal(canceled.status, 200);
    assert.equal(canceled.body.purchase.status, 'CANCELED');
    assert.ok(canceled.body.purchase.settledAt);
    assert.deepEqual((await result(await call('POST', `/credits/purchases/${purchase.id}/cancel`, user.token))).body, canceled.body);
    const stored = await prisma.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(stored.settledById, user.id);

    const other = await fixtures.user('OPERATOR');
    const theirs = await buy(other, 1);
    await expectError(call('POST', `/credits/purchases/${theirs.id}/cancel`, user.token), 404, 'Purchase not found');
    assert.equal((await result(await call('POST', `/credits/purchases/${theirs.id}/cancel`, admin.token))).body.purchase.status, 'CANCELED');

    const paid = await buy(user, 1);
    assert.equal((await confirm(paid)).status, 200);
    await expectError(call('POST', `/credits/purchases/${paid.id}/cancel`, user.token), 409, 'Only pending purchases can be canceled');
    await expectError(call('POST', '/credits/purchases/nope/cancel', user.token), 400, 'A valid purchase ID is required');
    await expectError(call('POST', `/credits/purchases/${randomUUID()}/cancel`, admin.token), 404, 'Purchase not found');
  });

  it('confirms a purchase and credits its owner exactly once', async () => {
    const purchase = await buy(user, 7);
    await expectError(call('POST', `/credits/purchases/${purchase.id}/confirm`, user.token), 403, 'Administrator access is required');
    const reference = `INV-${randomUUID()}`;
    const confirmed = await result(await confirm(purchase, { reference: `  ${reference}  ` }));
    assert.equal(confirmed.status, 200);
    const { purchase: paid, transaction }: { purchase: Purchase; transaction: Transaction } = confirmed.body;
    assert.deepEqual({ ...paid, settledAt: null }, { ...purchase, status: 'PAID', reference });
    assert.ok(paid.settledAt);
    assert.deepEqual(transaction, {
      id: transaction.id, userId: user.id, amount: 7, balanceAfter: 7, type: 'PURCHASE', purchaseId: purchase.id,
      note: null, createdAt: transaction.createdAt,
    });
    assert.equal(await balanceOf(user), 7);

    // Repeating returns the original result without crediting again.
    assert.deepEqual(await result(await confirm(purchase, { reference: 'something else' })), confirmed);
    assert.equal(await balanceOf(user), 7);
    assert.equal(await prisma.creditTransaction.count({ where: { purchaseId: purchase.id } }), 1);

    const reused = await buy(user, 1);
    await expectError(confirm(reused, { reference }), 409, 'This payment reference is already used');
    const withoutBody = await result(await confirm(reused));
    assert.equal(withoutBody.body.purchase.reference, null);
    assert.equal(withoutBody.body.transaction.balanceAfter, 8);
    await expectError(confirm(reused, { reference: 5 }), 400, 'Reference must be a string');
    await expectError(call('POST', `/credits/purchases/${randomUUID()}/confirm`, admin.token), 404, 'Purchase not found');
  });

  it('confirms only pending purchases whose owner still exists', async () => {
    const canceled = await buy(user, 1);
    await call('POST', `/credits/purchases/${canceled.id}/cancel`, user.token);
    await expectError(confirm(canceled), 409, 'Only pending purchases can be confirmed');
    const failed = await buy(user, 1);
    await call('POST', `/credits/purchases/${failed.id}/fail`, admin.token);
    await expectError(confirm(failed), 409, 'Only pending purchases can be confirmed');

    const leaving = await fixtures.user('USER');
    const orphan = await buy(leaving, 3);
    await prisma.user.delete({ where: { id: leaving.id } });
    await expectError(confirm(orphan), 409, 'The purchase owner no longer exists');
  });

  it('lets administrators mark pending purchases as failed once', async () => {
    const purchase = await buy(user, 2);
    await expectError(call('POST', `/credits/purchases/${purchase.id}/fail`, user.token), 403, 'Administrator access is required');
    const failed = await result(await call('POST', `/credits/purchases/${purchase.id}/fail`, admin.token));
    assert.equal(failed.status, 200);
    assert.equal(failed.body.purchase.status, 'FAILED');
    assert.deepEqual((await result(await call('POST', `/credits/purchases/${purchase.id}/fail`, admin.token))).body, failed.body);
    const paid = await buy(user, 1);
    await confirm(paid);
    await expectError(call('POST', `/credits/purchases/${paid.id}/fail`, admin.token), 409, 'Only pending purchases can be marked as failed');
    assert.equal(await balanceOf(user), 1);
  });

  it('adjusts balances within zero and the INT4 maximum', async () => {
    const added = await result(await call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: 500, note: '  launch bonus ' }));
    assert.equal(added.status, 201);
    assert.deepEqual(added.body.transaction, {
      id: added.body.transaction.id, userId: user.id, amount: 500, balanceAfter: 500, type: 'ADJUSTMENT', purchaseId: null,
      note: 'launch bonus', createdAt: added.body.transaction.createdAt,
    });
    const stored = await prisma.creditTransaction.findUniqueOrThrow({ where: { id: added.body.transaction.id } });
    assert.equal(stored.createdById, admin.id);
    assert.equal((await result(await call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: -500, note: 'correction' }))).body.transaction.balanceAfter, 0);
    await expectError(call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: -1, note: 'overdraw' }), 409, 'Insufficient credits');

    await prisma.user.update({ where: { id: user.id }, data: { creditBalance: maxBalance - 10 } });
    await expectError(call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: 11, note: 'too much' }), 409, 'The credit balance would exceed its maximum');
    assert.equal((await result(await call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: 10, note: 'top up' }))).body.transaction.balanceAfter, maxBalance);

    await expectError(call('POST', '/credits/adjustments', admin.token, { userId: randomUUID(), amount: 1, note: 'nobody' }), 404, 'User not found');
    await expectError(call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount: 0, note: 'nothing' }), 400, 'Amount must not be zero');
    await expectError(call('POST', '/credits/adjustments', user.token, { userId: user.id, amount: 1, note: 'self' }), 403, 'Administrator access is required');
  });

  it('lists the ledger newest first, scoped to the caller', async () => {
    const other = await fixtures.user('DRIVER');
    for (const amount of [10, 20, -5]) {
      await call('POST', '/credits/adjustments', admin.token, { userId: user.id, amount, note: `move ${amount}` });
    }
    await call('POST', '/credits/adjustments', admin.token, { userId: other.id, amount: 3, note: 'other' });

    const own = await result(await call('GET', '/credits/transactions', user.token));
    assert.equal(own.status, 200);
    assert.equal(own.body.total, 3);
    assert.deepEqual(own.body.transactions.map((transaction: Transaction) => [transaction.amount, transaction.balanceAfter]), [[-5, 25], [20, 30], [10, 10]]);
    const page = await result(await call('GET', '/credits/transactions?limit=1&offset=2', user.token));
    assert.deepEqual(page.body.transactions.map((transaction: Transaction) => transaction.amount), [10]);
    const theirs = await result(await call('GET', `/credits/transactions?userId=${other.id}`, admin.token));
    assert.deepEqual(theirs.body.transactions.map((transaction: Transaction) => transaction.note), ['other']);
    await expectError(call('GET', `/credits/transactions?userId=${other.id}`, user.token), 403, 'Administrator access is required');
    await expectError(call('GET', '/credits/transactions?status=PAID', user.token), 400, 'Only limit, offset, userId can be provided');
  });

  it('retries serialization conflicts and maps unique-constraint races', async () => {
    const retried = failTransactions(knownError('P2034'), driverConflict());
    try {
      assert.equal((await call('GET', '/credits/balance', user.token)).status, 200);
      assert.equal(retried.calls, 3);
    } finally {
      retried.restore();
    }
    const exhausted = failTransactions(knownError('P2034'), knownError('P2034'), knownError('P2034'));
    try {
      await expectError(call('GET', '/credits/balance', user.token), 409, 'Credits changed during this request. Refresh and try again.');
    } finally {
      exhausted.restore();
    }
    const purchase = await buy(user, 1);
    const raced = failTransactions(knownError('P2002'));
    try {
      await expectError(confirm(purchase), 409, 'This payment reference is already used, or the purchase was already confirmed');
    } finally {
      raced.restore();
    }
    const broken = failTransactions(new Error('connection lost'));
    try {
      await expectError(confirm(purchase), 500, 'Internal server error');
    } finally {
      broken.restore();
    }
    assert.equal(await balanceOf(user), 0);
  });

  it('rechecks the actor inside every service transaction', async () => {
    const credits = createCreditService(loadCreditConfig());
    const purchase = await buy(user, 1);
    const self = { id: user.id, sessionVersion: user.sessionVersion };
    for (const action of [
      () => credits.confirmPurchase(self, purchase.id, {}),
      () => credits.failPurchase(self, purchase.id),
      () => credits.adjust(self, { userId: user.id, amount: 1, note: 'self' }),
    ]) {
      await assert.rejects(action(), { status: 403, message: 'Administrator access is required' });
    }
    const stale = { id: user.id, sessionVersion: user.sessionVersion + 1 };
    await assert.rejects(credits.getBalance(stale), { status: 401, message: 'Unauthorized' });
    await assert.rejects(credits.createPurchase(stale, { credits: 1 }), { status: 401 });
    await assert.rejects(credits.getBalance({ id: randomUUID(), sessionVersion: 0 }), { status: 401 });
  });
});
