import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import sharp from 'sharp';

const fixtures = new URL('../fixtures/', import.meta.url);

/** A 1 s, 64×48 MPEG-4 Part 2 video with its index at the start. */
export const videoMp4 = await readFile(new URL('video.mp4', fixtures));
/** An MP4 with one AAC audio track and no video stream. */
export const audioOnlyMp4 = await readFile(new URL('audio-only.mp4', fixtures));

/** A valid MP4 signature followed by filler that ffprobe cannot read. */
export function corruptMp4() {
  return Buffer.concat([videoMp4.subarray(0, videoMp4.readUInt32BE(0)), Buffer.alloc(256, 7)]);
}

export function image(format: 'png' | 'jpeg' | 'webp', width = 40, height = 30) {
  const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 30 } } });
  return (format === 'png' ? base.png() : format === 'jpeg' ? base.jpeg() : base.webp()).toBuffer();
}

/** A JPEG carrying a camera model and GPS position in its EXIF data. */
export function jpegWithLocation() {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 120, b: 60 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'Camioane Test Camera' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '44/1 25/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '26/1 6/1 0/1' },
    })
    .toBuffer();
}

export function fileForm(data: Uint8Array, filename = 'upload.bin', type = 'application/octet-stream') {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(data)], { type }), filename);
  return form;
}

export interface Part {
  name: string;
  filename?: string;
  data: string | Uint8Array;
}

export const boundary = 'camioane-test-boundary';

/** Builds a multipart body by hand, for shapes FormData cannot produce. */
export function multipart(parts: Part[], { close = true } = {}) {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = `form-data; name="${part.name}"${part.filename === undefined ? '' : `; filename="${part.filename}"`}`;
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}\r\n`
      + `Content-Type: application/octet-stream\r\n\r\n`), Buffer.from(part.data), Buffer.from('\r\n'));
  }
  if (close) chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

export const multipartType = `multipart/form-data; boundary=${boundary}`;

export interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

/** Sends a request with node:http, for bodies and disconnects fetch cannot control. */
export function rawRequest(url: string, options: { method?: string; headers?: Record<string, string | number>; body?: Uint8Array }) {
  return new Promise<RawResponse>((resolve, reject) => {
    const req = request(url, { method: options.method ?? 'GET', headers: options.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
