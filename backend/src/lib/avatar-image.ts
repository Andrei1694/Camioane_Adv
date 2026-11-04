import { addAbortSignal, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import sharp from 'sharp';
import { AppError } from './app-error.ts';

/** Largest accepted profile picture upload, before re-encoding. */
export const avatarMaxUploadBytes = 10 * 1024 * 1024;
/** Width and height of every stored profile picture, in pixels. */
export const avatarSize = 512;
// Bounds decoding work for small files that declare huge dimensions.
const maxInputPixels = 50_000_000;

// Decodes the upload and re-encodes it as a square WebP. sharp writes no input
// metadata unless asked, so EXIF data such as GPS location is dropped; the
// orientation is applied to the pixels first.
export async function renderAvatar(body: Readable, signal: AbortSignal) {
  let input: Buffer;
  try {
    input = await buffer(addAbortSignal(signal, body));
  } catch (error) {
    // Report the reason the upload stopped, such as the size limit.
    signal.throwIfAborted();
    throw error;
  }
  // Multer truncates a file at the size limit; never decode a partial upload.
  signal.throwIfAborted();
  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: maxInputPixels, failOn: 'error' })
      .autoOrient()
      .resize(avatarSize, avatarSize, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError(422, 'The image could not be read');
  }
  signal.throwIfAborted();
  return { body: Readable.from([output]), mimeType: 'image/webp' };
}
