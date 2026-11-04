import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import type { StorageEngine } from 'multer';
import { validateUploadSize } from '../config/files.ts';
import { AppError } from '../lib/app-error.ts';
import { inspectUpload, sanitizeFilename } from '../lib/file-validation.ts';
import type { UploadTypes } from '../lib/file-validation.ts';
import type { FileStorage } from '../storage/file-storage.ts';
import type { StoredUpload } from '../types/file.ts';

export interface UploadOptions {
  accept: UploadTypes;
  /** Replaces the inspected body before storage, for example to re-encode an image. */
  transform?: (body: Readable, signal: AbortSignal) => Promise<{ body: Readable; mimeType: string }>;
}

function asError(error: unknown) {
  return error instanceof Error ? error : new Error('Upload failed');
}

async function storeUpload(req: Request, file: Express.Multer.File, storage: FileStorage, options: UploadOptions) {
  const abort = new AbortController();
  const cancel = () => abort.abort(new AppError(400, 'Upload interrupted'));
  const limit = () => abort.abort(new multer.MulterError('LIMIT_FILE_SIZE'));
  req.once('aborted', cancel);
  file.stream.once('error', cancel);
  file.stream.once('limit', limit);
  if (req.aborted) cancel();
  const key = randomUUID();
  let stored = false;
  let body: Readable | undefined;
  try {
    const inspected = await inspectUpload(file.stream, abort.signal, options.accept);
    body = inspected.body;
    const prepared = options.transform ? await options.transform(inspected.body, abort.signal) : inspected;
    body = prepared.body;
    const result = await storage.put({ key, body, contentType: prepared.mimeType, signal: abort.signal });
    stored = true;
    abort.signal.throwIfAborted();
    const storedFile: StoredUpload = {
      provider: storage.name,
      key,
      originalName: sanitizeFilename(file.originalname),
      mimeType: prepared.mimeType,
      size: result.size,
    };
    return { storedFile, size: result.size, mimetype: prepared.mimeType };
  } catch (error) {
    body?.destroy();
    file.stream.resume();
    if (stored) await storage.delete(key);
    throw error;
  } finally {
    req.off('aborted', cancel);
    file.stream.off('error', cancel);
    file.stream.off('limit', limit);
  }
}

export function createUploadMiddleware(storage: FileStorage, maxFileSize: number, options: UploadOptions): RequestHandler {
  const engine: StorageEngine = {
    _handleFile(req, file, callback) {
      void storeUpload(req, file, storage, options).then(
        (info) => callback(null, info),
        (error: unknown) => callback(asError(error)),
      );
    },
    _removeFile(req, file, callback) {
      if (!file.storedFile) return callback(null);
      void storage.delete(file.storedFile.key).then(() => callback(null), (error: unknown) => callback(asError(error)));
    },
  };
  const parse = multer({
    storage: engine,
    defParamCharset: 'utf8',
    limits: { fileSize: validateUploadSize(maxFileSize), files: 1, fields: 0, parts: 1, fieldNameSize: 100 },
  }).single('file');

  return (req, res, next) => {
    if (!req.is('multipart/form-data')) return next(new AppError(415, 'Expected multipart/form-data'));
    parse(req, res, (error: unknown) => {
      if (error) {
        // Multer attaches failures from _removeFile to the original parsing error.
        if (error instanceof Error && 'storageErrors' in error
          && Array.isArray(error.storageErrors) && error.storageErrors.length > 0) {
          return next(new Error('Upload cleanup failed', { cause: error }));
        }
        if (error instanceof Error && /^(Multipart: |Unexpected end of (form|file)|Malformed part header)/.test(error.message)) {
          return next(new AppError(400, 'Malformed multipart upload'));
        }
        return next(error);
      }
      if (req.aborted || res.destroyed) {
        const cleanup = req.file?.storedFile ? storage.delete(req.file.storedFile.key) : Promise.resolve();
        void cleanup.then(() => next(new AppError(400, 'Upload interrupted')), next);
        return;
      }
      if (!req.file?.storedFile) return next(new AppError(400, 'Provide one file in the file field'));
      next();
    });
  };
}
