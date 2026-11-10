import { Readable } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import type { FileTypeResult } from 'file-type';
import { AppError } from './app-error.ts';
import { allowedKeysSchema, parse, queryIntegerSchema, uuidSchema } from './validation.ts';
import type { FilePagination } from '../types/file.ts';

/** Detected MIME types an upload route accepts, and the 415 message for anything else. */
export interface UploadTypes {
  types: ReadonlySet<string>;
  message: string;
}

export const fileUploadTypes: UploadTypes = {
  types: new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  message: 'Only JPEG, PNG, WebP, and MP4 files are allowed',
};

export const imageUploadTypes: UploadTypes = {
  types: new Set(['image/jpeg', 'image/png', 'image/webp']),
  message: 'Only JPEG, PNG, and WebP images are allowed',
};

const sampleSize = 4100;
const fileIdSchema = uuidSchema('A valid file ID is required');
const paginationFields = allowedKeysSchema(['limit', 'offset'], 'Only limit and offset query parameters are supported');
const limitSchema = queryIntegerSchema(50, 1, 100, 'Invalid pagination');
const offsetSchema = queryIntegerSchema(0, 0, 2147483647, 'Invalid pagination');

export function parseFileId(value: unknown) {
  return parse(fileIdSchema, value);
}

export function parseFilePagination(query: Record<string, unknown>): FilePagination {
  parse(paginationFields, query);
  return { limit: parse(limitSchema, query.limit), offset: parse(offsetSchema, query.offset) };
}

export function sanitizeFilename(value: string) {
  const basename = value.split(/[\\/]/).at(-1) ?? '';
  const clean = basename.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '_').trim();
  return Array.from(clean).slice(0, 255).join('').replace(/^[. ]+|[. ]+$/g, '') || 'file';
}

export async function inspectUpload(stream: Readable, signal: AbortSignal, accept: UploadTypes) {
  // Keep at most a sample plus one input chunk, then replay every byte unchanged.
  // Returning this iterator must not destroy the multipart part: Multer still
  // needs to consume the request when a file is rejected or storage fails.
  const iterator = stream.iterator({ destroyOnReturn: false });
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (size < sampleSize) {
      signal.throwIfAborted();
      const next = await iterator.next();
      if (next.done) break;
      const chunk: unknown = next.value;
      if (!Buffer.isBuffer(chunk)) throw new Error('Expected a binary upload stream');
      chunks.push(chunk);
      size += chunk.length;
    }
    signal.throwIfAborted();
    if (size === 0) throw new AppError(400, 'Empty files are not allowed');
    let detected: FileTypeResult | undefined;
    try {
      detected = await fileTypeFromBuffer(Buffer.concat(chunks, size).subarray(0, sampleSize), {
        maxBufferSize: sampleSize,
        signal,
      });
    } catch {
      signal.throwIfAborted();
      throw new AppError(415, 'Unsupported or unrecognized file content');
    }
    if (!detected || !accept.types.has(detected.mime)) throw new AppError(415, accept.message);
    const body = Readable.from((async function* () {
      try {
        yield* chunks;
        for await (const chunk of iterator) yield chunk;
      } finally {
        await iterator.return?.();
      }
    })(), { objectMode: false });
    return { body, mimeType: detected.mime };
  } catch (error) {
    await iterator.return?.();
    throw error;
  }
}
