import './helpers/env.ts';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { AppError } from '../src/lib/app-error.ts';
import { avatarSize, renderAvatar } from '../src/lib/avatar-image.ts';
import {
  checkFfprobe,
  InvalidVideoError,
  MediaToolExitError,
  parseProbeOutput,
  probeVideo,
  runMediaTool,
} from '../src/lib/ffmpeg.ts';
import { fileUploadTypes, imageUploadTypes, inspectUpload } from '../src/lib/file-validation.ts';
import { audioOnlyMp4, corruptMp4, image, jpegWithLocation, videoMp4 } from './helpers/media.ts';

const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
// FFmpeg always ships ffmpeg beside ffprobe; it answers -version differently.
const ffmpeg = ffprobe.replace(/ffprobe(\.exe)?$/i, 'ffmpeg$1');
const node = process.execPath;
let directory: string;

function chunks(data: Buffer, size: number) {
  const parts: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += size) parts.push(data.subarray(offset, offset + size));
  return parts;
}

function appError(status: number, message: string) {
  return (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, status);
    assert.equal(error.message, message);
    return true;
  };
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'camioane-media-test-'));
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('Media tool runner', () => {
  it('resolves with stdout when the tool succeeds', async () => {
    assert.equal(await runMediaTool(node, ['-e', 'process.stdout.write("probe output")'], 10_000), 'probe output');
  });

  it('reports the exit code and the end of stderr when the tool fails', async () => {
    const error = await runMediaTool(node, ['-e', 'process.stderr.write("x".repeat(6000) + " last words \\n"); process.exit(3)'], 10_000)
      .then(() => assert.fail('expected a failure'), (failure: unknown) => failure);
    assert.ok(error instanceof MediaToolExitError);
    assert.equal(error.name, 'MediaToolExitError');
    assert.equal(error.exitCode, 3);
    assert.equal(error.message, `${node} exited with code 3`);
    assert.ok(error.stderr.length < 4000);
    assert.match(error.stderr, /^x+ last words$/);
  });

  it('reports a tool that cannot start', async () => {
    const missing = join(directory, 'missing-ffprobe');
    await assert.rejects(runMediaTool(missing, ['-version'], 10_000), (error: unknown) => {
      assert.ok(error instanceof Error && !(error instanceof MediaToolExitError));
      assert.equal(error.message, `${missing} could not be started`);
      assert.ok(error.cause instanceof Error);
      return true;
    });
  });

  it('kills a tool that runs too long', async () => {
    await assert.rejects(runMediaTool(node, ['-e', 'setTimeout(() => {}, 30000)'], 200), {
      message: `${node} timed out after 200 ms`,
    });
  });

  it('kills a tool that writes too much output', async () => {
    await assert.rejects(runMediaTool(node, ['-e', 'process.stdout.write("x".repeat(3 * 1024 * 1024))'], 10_000), {
      message: `${node} produced too much output`,
    });
  });

  it('reports a tool stopped by a signal', { skip: process.platform === 'win32' && 'Windows has no termination signals' }, async () => {
    await assert.rejects(runMediaTool(node, ['-e', 'process.kill(process.pid, "SIGTERM")'], 10_000), {
      message: `${node} was stopped by SIGTERM`,
    });
  });
});

describe('ffprobe check', () => {
  it('accepts the configured ffprobe', async () => {
    await checkFfprobe(ffprobe);
  });

  it('rejects another program or a missing binary', async () => {
    await assert.rejects(checkFfprobe(ffmpeg), { message: `${ffmpeg} is not ffprobe` });
    await assert.rejects(checkFfprobe(join(directory, 'nothing')), /could not be started/);
  });
});

describe('Video probing', () => {
  async function sample(name: string, data: Buffer) {
    const path = join(directory, name);
    await writeFile(path, data);
    return path;
  }

  it('reads the first video stream of an MP4', async () => {
    assert.deepEqual(await probeVideo(ffprobe, await sample('video.mp4', videoMp4)),
      { codec: 'mpeg4', width: 64, height: 48, durationSeconds: 1 });
  });

  it('treats files ffprobe cannot read, or without video, as invalid videos', async () => {
    await assert.rejects(probeVideo(ffprobe, await sample('corrupt.mp4', corruptMp4())), (error: unknown) => {
      assert.ok(error instanceof InvalidVideoError);
      assert.equal(error.name, 'InvalidVideoError');
      assert.equal(error.message, 'The video could not be read. Upload a playable MP4 file.');
      assert.ok(error.cause instanceof MediaToolExitError);
      return true;
    });
    await assert.rejects(probeVideo(ffprobe, await sample('audio.mp4', audioOnlyMp4)), {
      name: 'InvalidVideoError', message: 'The MP4 file has no video stream.',
    });
  });

  it('passes on failures of ffprobe itself', async () => {
    await assert.rejects(probeVideo(join(directory, 'nothing'), join(directory, 'video.mp4')), (error: unknown) => {
      assert.ok(error instanceof Error && !(error instanceof InvalidVideoError));
      return true;
    });
    // Node prints its version for -v and ignores the rest: output that is not JSON.
    await assert.rejects(probeVideo(node, join(directory, 'video.mp4')), (error: unknown) => {
      assert.ok(error instanceof Error && !(error instanceof InvalidVideoError));
      assert.equal(error.message, 'ffprobe returned invalid JSON');
      return true;
    });
  });

  it('validates every field of the probe output', () => {
    const stream = { codec_name: 'h264', width: 1920, height: 1080 };
    const format = { duration: '12.5' };
    assert.deepEqual(parseProbeOutput(JSON.stringify({ streams: [stream], format })),
      { codec: 'h264', width: 1920, height: 1080, durationSeconds: 12.5 });
    assert.throws(() => parseProbeOutput('{'), (error: unknown) => {
      assert.ok(error instanceof Error && !(error instanceof InvalidVideoError));
      assert.equal(error.message, 'ffprobe returned invalid JSON');
      assert.ok(error.cause instanceof SyntaxError);
      return true;
    });
    for (const output of ['null', '[]', '1', '"text"']) {
      assert.throws(() => parseProbeOutput(output), (error: unknown) => {
        assert.ok(error instanceof Error && !(error instanceof InvalidVideoError));
        assert.equal(error.message, 'ffprobe returned unexpected JSON');
        return true;
      });
    }
    for (const data of [{}, { streams: [] }, { streams: [null] }, { streams: [[]] }, { streams: {} }]) {
      assert.throws(() => parseProbeOutput(JSON.stringify(data)), { name: 'InvalidVideoError', message: 'The MP4 file has no video stream.' });
    }
    for (const broken of [{ codec_name: 1 }, { width: 0 }, { height: -1 }, { width: 1.5 }, { height: '1080' }, { width: null }]) {
      assert.throws(() => parseProbeOutput(JSON.stringify({ streams: [{ ...stream, ...broken }], format })), {
        name: 'InvalidVideoError', message: 'The video stream has an unreadable codec or dimensions.',
      });
    }
    for (const badFormat of [undefined, null, {}, { duration: 12 }, { duration: 'N/A' }, { duration: '0' }, { duration: '-1' }, { duration: 'Infinity' }]) {
      assert.throws(() => parseProbeOutput(JSON.stringify({ streams: [stream], format: badFormat })), {
        name: 'InvalidVideoError', message: 'The video has no readable duration.',
      });
    }
  });
});

describe('Profile picture rendering', () => {
  it('re-encodes any accepted image as a 512×512 WebP', async () => {
    for (const data of [await image('png', 800, 300), await image('jpeg', 30, 90), await image('webp')]) {
      const rendered = await renderAvatar(Readable.from(chunks(data, 100)), new AbortController().signal);
      assert.equal(rendered.mimeType, 'image/webp');
      const metadata = await sharp(await buffer(rendered.body)).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, avatarSize);
      assert.equal(metadata.height, avatarSize);
    }
  });

  it('drops EXIF data such as the GPS position', async () => {
    const original = jpegWithLocation();
    assert.ok((await sharp(await original).metadata()).exif);
    const rendered = await renderAvatar(Readable.from([await original]), new AbortController().signal);
    const metadata = await sharp(await buffer(rendered.body)).metadata();
    assert.equal(metadata.exif, undefined);
  });

  it('rejects data that is not a decodable image', async () => {
    const png = await image('png');
    for (const data of [randomBytes(2000), png.subarray(0, 60)]) {
      await assert.rejects(renderAvatar(Readable.from([data]), new AbortController().signal),
        appError(422, 'The image could not be read'));
    }
  });

  it('reports why the upload stopped', async () => {
    const failing = Readable.from((async function* () {
      yield Buffer.from('partial');
      throw new Error('socket closed');
    })());
    await assert.rejects(renderAvatar(failing, new AbortController().signal), /socket closed/);

    const controller = new AbortController();
    const pending = new Readable({ read() {} });
    pending.push(await image('png'));
    const rendering = renderAvatar(pending, controller.signal);
    setImmediate(() => controller.abort(new AppError(413, 'Too large')));
    await assert.rejects(rendering, appError(413, 'Too large'));
  });
});

describe('Upload inspection', () => {
  it('detects the type and replays every byte unchanged', async () => {
    const data = Buffer.concat([await image('png'), randomBytes(20000)]);
    const inspected = await inspectUpload(Readable.from(chunks(data, 1000)), new AbortController().signal, imageUploadTypes);
    assert.equal(inspected.mimeType, 'image/png');
    assert.deepEqual(await buffer(inspected.body), data);
    const video = await inspectUpload(Readable.from([videoMp4]), new AbortController().signal, fileUploadTypes);
    assert.equal(video.mimeType, 'video/mp4');
    assert.deepEqual(await buffer(video.body), videoMp4);
  });

  it('rejects empty, unrecognized, and unaccepted files', async () => {
    const cases: [Buffer[], typeof fileUploadTypes, number, string][] = [
      [[], fileUploadTypes, 400, 'Empty files are not allowed'],
      [[Buffer.from('plain text is not an accepted type')], fileUploadTypes, 415, fileUploadTypes.message],
      [[videoMp4], imageUploadTypes, 415, imageUploadTypes.message],
      [[Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1')], fileUploadTypes, 415, fileUploadTypes.message],
    ];
    for (const [parts, accept, status, message] of cases) {
      await assert.rejects(inspectUpload(Readable.from(parts), new AbortController().signal, accept), appError(status, message));
    }
  });

  it('leaves the rest of a rejected upload readable, so the request can be drained', async () => {
    const source = Readable.from(chunks(Buffer.alloc(20000, 'a'), 1000));
    await assert.rejects(inspectUpload(source, new AbortController().signal, fileUploadTypes), appError(415, fileUploadTypes.message));
    assert.equal(source.destroyed, false);
    assert.ok((await buffer(source)).length > 0);
  });

  it('rejects streams that do not carry bytes', async () => {
    await assert.rejects(inspectUpload(Readable.from([{ not: 'bytes' }]), new AbortController().signal, fileUploadTypes),
      /Expected a binary upload stream/);
  });

  it('reports a detection failure that is not a cancellation', async () => {
    // file-type sees an aborted signal and throws, while this signal's own
    // check stays silent: the same as file-type failing on its own.
    const controller = new AbortController();
    controller.abort();
    const { signal } = controller;
    signal.throwIfAborted = () => {};
    await assert.rejects(inspectUpload(Readable.from([await image('png')]), signal, imageUploadTypes),
      appError(415, 'Unsupported or unrecognized file content'));
  });

  it('stops when the upload is cancelled', async () => {
    await assert.rejects(inspectUpload(Readable.from([Buffer.from('x')]), AbortSignal.abort(new AppError(400, 'Upload interrupted')), fileUploadTypes),
      appError(400, 'Upload interrupted'));
    const controller = new AbortController();
    const pending = new Readable({ read() {} });
    const inspecting = inspectUpload(pending, controller.signal, fileUploadTypes);
    setImmediate(() => {
      controller.abort(new AppError(413, 'Too large'));
      pending.push(Buffer.from('more data'));
    });
    await assert.rejects(inspecting, appError(413, 'Too large'));
  });
});
