import './helpers/env.ts';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { AppError } from '../src/lib/app-error.ts';
import {
  parseAdjustment,
  parseConfirmPurchase,
  parseCreatePurchase,
  parseCreditQuery,
  parsePurchaseId,
  parseUserFilter,
} from '../src/lib/credit-validation.ts';
import { parseFileId, parseFilePagination, sanitizeFilename } from '../src/lib/file-validation.ts';
import { isRoleName, isRoleValid } from '../src/lib/role.ts';
import {
  isUserId,
  parseBody,
  parseCreateUser,
  parseCredentials,
  parseEmail,
  parsePassword,
  parseUpdateUser,
  parseUserId,
} from '../src/lib/user-validation.ts';

function rejects(action: () => unknown, message: string | RegExp, status = 400) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, status);
    if (typeof message === 'string') assert.equal(error.message, message);
    else assert.match(error.message, message);
    return true;
  });
}

const id = randomUUID();
const password = 'x'.repeat(12);

describe('AppError', () => {
  it('carries an HTTP status and a public message', () => {
    const error = new AppError(418, 'Short and stout');
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'AppError');
    assert.equal(error.status, 418);
    assert.equal(error.message, 'Short and stout');
  });
});

describe('User validation', () => {
  it('normalizes emails and rejects invalid ones', () => {
    assert.equal(parseEmail('  Driver@Example.TEST '), 'driver@example.test');
    rejects(() => parseEmail(42), 'Email must be a string');
    const local = 'a'.repeat(64);
    assert.equal(parseEmail(`${local}@${'b'.repeat(184)}.test`).length, 254);
    for (const email of ['', 'plain', 'a@b', 'a b@example.test', 'a@@example.test', `${local}@${'b'.repeat(185)}.test`]) {
      rejects(() => parseEmail(email), 'A valid email address is required');
    }
  });

  it('counts password characters by code point and keeps whitespace', () => {
    assert.equal(parsePassword(`  ${'x'.repeat(10)}`), `  ${'x'.repeat(10)}`);
    assert.equal(parsePassword('😀'.repeat(128)), '😀'.repeat(128));
    rejects(() => parsePassword(null), 'Password must be a string');
    for (const value of ['x'.repeat(11), 'x'.repeat(129), '😀'.repeat(11), '😀'.repeat(129)]) {
      rejects(() => parsePassword(value), 'Password must contain between 12 and 128 characters');
    }
  });

  it('accepts only plain JSON objects as bodies', () => {
    assert.deepEqual(parseBody({ a: 1 }), { a: 1 });
    for (const body of [undefined, null, [], 'text', 1]) rejects(() => parseBody(body), 'A JSON object is required');
  });

  it('parses login credentials without restricting other keys', () => {
    assert.deepEqual(parseCredentials({ email: 'A@B.TEST', password, extra: true }), { email: 'a@b.test', password });
  });

  it('defaults new users to USER and validates roles and keys', () => {
    assert.deepEqual(parseCreateUser({ email: 'a@b.test', password }), { email: 'a@b.test', password, role: 'USER' });
    assert.deepEqual(parseCreateUser({ email: 'a@b.test', password, role: 'DRIVER' }).role, 'DRIVER');
    rejects(() => parseCreateUser({ email: 'a@b.test', password, role: 'admin' }), 'Role must be ADMIN, OPERATOR, DRIVER, or USER');
    rejects(() => parseCreateUser({ email: 'a@b.test', password, id }), 'Only email, password, and role can be changed');
  });

  it('parses partial updates', () => {
    assert.deepEqual(parseUpdateUser({ email: ' A@B.TEST ' }), { email: 'a@b.test' });
    assert.deepEqual(parseUpdateUser({ password }), { password });
    assert.deepEqual(parseUpdateUser({ role: 'OPERATOR' }), { role: 'OPERATOR' });
    rejects(() => parseUpdateUser({}), 'Provide at least one field to update');
    rejects(() => parseUpdateUser({ sessionVersion: 1 }), 'Only email, password, and role can be changed');
    rejects(() => parseUpdateUser({ role: null }), 'Role must be ADMIN, OPERATOR, DRIVER, or USER');
  });

  it('accepts UUIDs in any case and lowercases them', () => {
    assert.equal(isUserId(id), true);
    assert.equal(isUserId(id.toUpperCase()), true);
    for (const value of [undefined, 42, '', 'bad-id', `${id}0`, id.replaceAll('-', '')]) assert.equal(isUserId(value), false);
    assert.equal(parseUserId(id.toUpperCase()), id);
    rejects(() => parseUserId('bad-id'), 'A valid user ID is required');
  });
});

describe('Role validity', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2027-01-01T00:00:00Z');

  it('recognizes the four role names exactly', () => {
    for (const name of ['ADMIN', 'OPERATOR', 'DRIVER', 'USER']) assert.equal(isRoleName(name), true);
    for (const name of ['admin', 'OWNER', '', null]) assert.equal(isRoleName(name), false);
  });

  it('is valid from its start date until, but not at, its end date', () => {
    const role = { activ: true, startDate: start, endDate: end };
    assert.equal(isRoleValid(role, new Date(start.getTime() - 1)), false);
    assert.equal(isRoleValid(role, start), true);
    assert.equal(isRoleValid(role, new Date(end.getTime() - 1)), true);
    assert.equal(isRoleValid(role, end), false);
    assert.equal(isRoleValid({ ...role, endDate: null }, new Date('2100-01-01T00:00:00Z')), true);
    assert.equal(isRoleValid({ ...role, activ: false }, start), false);
    assert.equal(isRoleValid({ activ: true, startDate: new Date(Date.now() - 1000), endDate: null }), true);
  });
});

describe('Credit validation', () => {
  it('parses purchase IDs', () => {
    assert.equal(parsePurchaseId(id.toUpperCase()), id);
    for (const value of [undefined, 1, 'bad']) rejects(() => parsePurchaseId(value), 'A valid purchase ID is required');
  });

  it('parses purchase requests', () => {
    assert.deepEqual(parseCreatePurchase({ credits: 1 }), { credits: 1 });
    assert.deepEqual(parseCreatePurchase({ credits: 100000 }), { credits: 100000 });
    for (const credits of [0, 100001, 1.5, '10', null, Number.NaN]) {
      rejects(() => parseCreatePurchase({ credits }), 'Credits must be a whole number between 1 and 100000');
    }
    rejects(() => parseCreatePurchase({ credits: 1, price: 1 }), 'Only credits can be provided');
    rejects(() => parseCreatePurchase([]), 'A JSON object is required');
  });

  it('parses optional confirmation references', () => {
    assert.deepEqual(parseConfirmPurchase(undefined), {});
    assert.deepEqual(parseConfirmPurchase({}), {});
    assert.deepEqual(parseConfirmPurchase({ reference: '  INV-1  ' }), { reference: 'INV-1' });
    assert.deepEqual(parseConfirmPurchase({ reference: '😀'.repeat(128) }), { reference: '😀'.repeat(128) });
    rejects(() => parseConfirmPurchase(null), 'A JSON object is required');
    rejects(() => parseConfirmPurchase({ reference: 5 }), 'Reference must be a string');
    for (const reference of ['', '   ', 'x'.repeat(129)]) {
      rejects(() => parseConfirmPurchase({ reference }), 'Reference must contain between 1 and 128 characters');
    }
    rejects(() => parseConfirmPurchase({ reference: 'x', amount: 1 }), 'Only reference can be provided');
  });

  it('parses balance adjustments', () => {
    assert.deepEqual(parseAdjustment({ userId: id.toUpperCase(), amount: -5, note: ' refund ' }), { userId: id, amount: -5, note: 'refund' });
    assert.deepEqual(parseAdjustment({ userId: id, amount: 1000000, note: 'x'.repeat(500) }).amount, 1000000);
    rejects(() => parseAdjustment({ userId: id, amount: 0, note: 'x' }), 'Amount must not be zero');
    for (const amount of [1000001, -1000001, 0.5, '5']) {
      rejects(() => parseAdjustment({ userId: id, amount, note: 'x' }), 'Amount must be a whole number between -1000000 and 1000000');
    }
    rejects(() => parseAdjustment({ userId: 'bad', amount: 1, note: 'x' }), 'A valid user ID is required');
    rejects(() => parseAdjustment({ userId: id, amount: 1 }), 'Note must be a string');
    rejects(() => parseAdjustment({ userId: id, amount: 1, note: 'x'.repeat(501) }), 'Note must contain between 1 and 500 characters');
    rejects(() => parseAdjustment({ userId: id, amount: 1, note: 'x', type: 'REFUND' }), 'Only userId, amount, note can be provided');
  });

  it('parses the optional user filter', () => {
    assert.equal(parseUserFilter({}), undefined);
    assert.equal(parseUserFilter({ userId: id.toUpperCase() }), id);
    rejects(() => parseUserFilter({ userId: ['a', 'b'] }), 'A valid user ID is required');
    rejects(() => parseUserFilter({ limit: '1' }), 'Only userId can be provided');
  });

  it('parses ledger and purchase queries', () => {
    assert.deepEqual(parseCreditQuery({}, { status: false }), { limit: 50, offset: 0 });
    assert.deepEqual(parseCreditQuery({ limit: '100', offset: '2147483647', userId: id, status: 'PAID' }, { status: true }),
      { limit: 100, offset: 2147483647, userId: id, status: 'PAID' });
    for (const query of [{ limit: '0' }, { limit: '101' }, { limit: '-1' }, { limit: '1.5' }, { limit: ['1', '2'] },
      { offset: '2147483648' }, { offset: '9'.repeat(20) }]) {
      rejects(() => parseCreditQuery(query, { status: false }), 'Invalid pagination');
    }
    rejects(() => parseCreditQuery({ status: 'PAID' }, { status: false }), 'Only limit, offset, userId can be provided');
    rejects(() => parseCreditQuery({ status: 'paid' }, { status: true }), 'Status must be PENDING, PAID, FAILED, CANCELED');
  });
});

describe('File validation', () => {
  it('parses file IDs', () => {
    assert.equal(parseFileId(id.toUpperCase()), id);
    for (const value of [undefined, '', 'bad', `${id}x`]) rejects(() => parseFileId(value), 'A valid file ID is required');
  });

  it('parses list pagination', () => {
    assert.deepEqual(parseFilePagination({}), { limit: 50, offset: 0 });
    assert.deepEqual(parseFilePagination({ limit: '1', offset: '10' }), { limit: 1, offset: 10 });
    for (const query of [{ limit: '0' }, { limit: '101' }, { offset: '-1' }, { offset: 'x' }, { limit: ['1'] },
      { offset: '2147483648' }, { offset: '9'.repeat(20) }]) {
      rejects(() => parseFilePagination(query), 'Invalid pagination');
    }
    rejects(() => parseFilePagination({ page: '1' }), 'Only limit and offset query parameters are supported');
  });

  it('keeps only a safe base name', () => {
    assert.equal(sanitizeFilename('photo.jpg'), 'photo.jpg');
    assert.equal(sanitizeFilename('C:\\Users\\me\\clip.mp4'), 'clip.mp4');
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('bad\u0000na\u001fme\u007f.png'), 'bad_na_me_.png');
    assert.equal(sanitizeFilename('evil\u202egpj.exe'), 'evil_gpj.exe');
    assert.equal(sanitizeFilename('  ..hidden. . '), 'hidden');
    assert.equal(sanitizeFilename('😀'.repeat(300)), '😀'.repeat(255));
    for (const value of ['', '...', 'folder/', ' . ']) assert.equal(sanitizeFilename(value), 'file');
  });
});
