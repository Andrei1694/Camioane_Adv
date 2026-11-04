import { Readable } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import type { FileTypeResult } from 'file-type';
import { AppError } from './app-error.ts';
import type { FilePagination } from '../types/file.ts';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);
const sampleSize = 4100;

export function parseFileId(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, 'A valid file ID is required');
  }
  return value.toLowerCase();
}

export function parseFilePagination(query: Record<string, unknown>): FilePagination {
  if (Object.keys(query).some((key) => key !== 'limit' && key !== 'offset')) {
    throw new AppError(400, 'Only limit and offset query parameters are supported');
  }
  function integer(value: unknown, fallback: number, min: number, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(400, 'Invalid pagination');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new AppError(400, 'Invalid pagination');
    return parsed;
  }
  return { limit: integer(query.limit, 50, 1, 100), offset: integer(query.offset, 0, 0, 2147483647) };
}

export function sanitizeFilename(value: string) {
  const basename = value.split(/[\\/]/).at(-1) ?? '';
  const clean = basename.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '_').trim();
  return Array.from(clean).slice(0, 255).join('').replace(/^[. ]+|[. ]+$/g, '') || 'file';
}

export async function inspectUpload(stream: Readable, signal: AbortSignal) {
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
    if (!detected || !allowedTypes.has(detected.mime)) {
      throw new AppError(415, 'Only JPEG, PNG, WebP, and MP4 files are allowed');
    }
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
