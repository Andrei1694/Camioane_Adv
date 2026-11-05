import './helpers/env.ts';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCreditConfig, MAX_CREDITS_PER_PURCHASE } from '../src/config/credits.ts';
import { createFileStorage, loadFileConfig, validateUploadSize } from '../src/config/files.ts';
import { FilesystemStorage } from '../src/storage/filesystem.storage.ts';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));

describe('Credit configuration', () => {
  it('defaults to one euro per credit', () => {
    assert.deepEqual(loadCreditConfig({}), { currency: 'EUR', unitPriceMinor: 100 });
    assert.deepEqual(loadCreditConfig({ CREDIT_CURRENCY: 'RON', CREDIT_UNIT_PRICE_MINOR: '250' }),
      { currency: 'RON', unitPriceMinor: 250 });
  });

  it('requires a three-letter uppercase currency', () => {
    for (const currency of ['', 'eur', 'EURO', 'E1R', ' EUR']) {
      assert.throws(() => loadCreditConfig({ CREDIT_CURRENCY: currency }), /CREDIT_CURRENCY/);
    }
  });

  it('keeps the largest purchase total within INT4', () => {
    const max = Math.floor(2147483647 / MAX_CREDITS_PER_PURCHASE);
    assert.equal(max, 21474);
    assert.equal(loadCreditConfig({ CREDIT_UNIT_PRICE_MINOR: '1' }).unitPriceMinor, 1);
    assert.equal(loadCreditConfig({ CREDIT_UNIT_PRICE_MINOR: String(max) }).unitPriceMinor, max);
    for (const price of ['0', String(max + 1), '', '-1', '1.5', '1e3', ' 100']) {
      assert.throws(() => loadCreditConfig({ CREDIT_UNIT_PRICE_MINOR: price }), /CREDIT_UNIT_PRICE_MINOR must be an integer between 1 and 21474/);
    }
  });
});

describe('File configuration', () => {
  it('defaults to filesystem storage under backend/uploads with a 100 MiB limit', () => {
    assert.deepEqual(loadFileConfig({}), {
      driver: 'filesystem',
      root: resolve(backendRoot, 'uploads'),
      maxFileSize: 104857600,
      ffprobePath: 'ffprobe',
    });
  });

  it('resolves relative roots from backend/ and keeps absolute roots', () => {
    assert.equal(loadFileConfig({ FILE_STORAGE_ROOT: 'data/files' }).root, resolve(backendRoot, 'data/files'));
    const absolute = resolve('/srv/camioane/uploads');
    assert.equal(loadFileConfig({ FILE_STORAGE_ROOT: absolute }).root, absolute);
    assert.equal(loadFileConfig({ FFPROBE_PATH: '/opt/ffmpeg/ffprobe' }).ffprobePath, '/opt/ffmpeg/ffprobe');
  });

  it('rejects blank or unsafe values', () => {
    assert.throws(() => loadFileConfig({ FILE_STORAGE_DRIVER: ' ' }), /FILE_STORAGE_DRIVER must not be blank/);
    for (const root of ['', '  ', 'up\0loads']) {
      assert.throws(() => loadFileConfig({ FILE_STORAGE_ROOT: root }), /FILE_STORAGE_ROOT/);
    }
    for (const path of ['', ' ', 'ff\0probe']) {
      assert.throws(() => loadFileConfig({ FFPROBE_PATH: path }), /FFPROBE_PATH/);
    }
  });

  it('accepts upload limits from 1 byte to the INT4 maximum', () => {
    assert.equal(loadFileConfig({ UPLOAD_MAX_FILE_SIZE_BYTES: '1' }).maxFileSize, 1);
    assert.equal(loadFileConfig({ UPLOAD_MAX_FILE_SIZE_BYTES: '2147483647' }).maxFileSize, 2147483647);
    for (const size of ['', '-1', '1.5', '10MB']) {
      assert.throws(() => loadFileConfig({ UPLOAD_MAX_FILE_SIZE_BYTES: size }), /must be a positive integer/);
    }
    for (const size of ['0', '2147483648']) {
      assert.throws(() => loadFileConfig({ UPLOAD_MAX_FILE_SIZE_BYTES: size }), /between 1 and 2147483647/);
    }
    for (const size of [0, -1, 1.5, Number.NaN, 2147483648, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => validateUploadSize(size), /UPLOAD_MAX_FILE_SIZE_BYTES/);
    }
    assert.equal(validateUploadSize(1024), 1024);
  });

  it('creates the configured storage provider', () => {
    const config = loadFileConfig({ FILE_STORAGE_ROOT: '/srv/camioane/uploads' });
    const registry = createFileStorage(config);
    assert.ok(registry.uploadStorage instanceof FilesystemStorage);
    assert.equal(registry.get('filesystem'), registry.uploadStorage);
    assert.throws(() => createFileStorage({ ...config, driver: 's3' }), /File storage provider is not configured: s3/);
  });
});
