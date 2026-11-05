import { spawn } from 'node:child_process';

const probeTimeoutMs = 30_000;
const versionTimeoutMs = 10_000;
const maxStdoutLength = 1024 * 1024;
const stderrTailLength = 4000;

/** The tool ran and exited with a failure code, usually because it rejected its input. */
export class MediaToolExitError extends Error {
  readonly exitCode: number;
  readonly stderr: string;

  constructor(command: string, exitCode: number, stderr: string) {
    super(`${command} exited with code ${exitCode}`);
    this.name = 'MediaToolExitError';
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/** The input is not a usable video. The message is safe to show to the uploader. */
export class InvalidVideoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidVideoError';
  }
}

export interface VideoInfo {
  codec: string;
  width: number;
  height: number;
  durationSeconds: number;
}

/**
 * Run an FFmpeg tool and resolve with its stdout. Arguments go straight to the
 * process as an array, never through a shell, so they are never reinterpreted.
 * The process is killed when it exceeds the timeout or the stdout limit.
 */
export function runMediaTool(command: string, args: readonly string[], timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: timeout,
      killSignal: 'SIGKILL',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let failure: Error | undefined;

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      if (failure) return;
      stdout += chunk;
      if (stdout.length > maxStdoutLength) {
        failure = new Error(`${command} produced too much output`);
        child.kill('SIGKILL');
      }
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-stderrTailLength);
    });
    child.once('error', (error) => {
      failure ??= timeout.aborted
        ? new Error(`${command} timed out after ${timeoutMs} ms`)
        : new Error(`${command} could not be started`, { cause: error });
    });
    // 'close' follows every outcome, including spawn failures, and arrives only after
    // the process has exited, so callers can safely delete files it was reading.
    child.once('close', (code, signal) => {
      if (failure) reject(failure);
      else if (code === 0) resolve(stdout);
      else if (code !== null) reject(new MediaToolExitError(command, code, stderr.trim()));
      else reject(new Error(`${command} was stopped by ${signal ?? 'a signal'}`));
    });
  });
}

/** Resolve when the configured binary runs and identifies itself as ffprobe. */
export async function checkFfprobe(ffprobePath: string) {
  const output = await runMediaTool(ffprobePath, ['-version'], versionTimeoutMs);
  if (!output.startsWith('ffprobe version')) throw new Error(`${ffprobePath} is not ffprobe`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function parseProbeOutput(output: string): VideoInfo {
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch (error) {
    throw new Error('ffprobe returned invalid JSON', { cause: error });
  }
  if (!isRecord(data)) throw new Error('ffprobe returned unexpected JSON');
  const stream: unknown = Array.isArray(data.streams) ? data.streams[0] : undefined;
  if (!isRecord(stream)) throw new InvalidVideoError('The MP4 file has no video stream.');
  const { codec_name: codec, width, height } = stream;
  if (typeof codec !== 'string' || !isPositiveInteger(width) || !isPositiveInteger(height)) {
    throw new InvalidVideoError('The video stream has an unreadable codec or dimensions.');
  }
  const duration = isRecord(data.format) && typeof data.format.duration === 'string'
    ? Number(data.format.duration)
    : Number.NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new InvalidVideoError('The video has no readable duration.');
  }
  return { codec, width, height, durationSeconds: duration };
}

/**
 * Read the first video stream of a local MP4 file. Throws InvalidVideoError when
 * ffprobe cannot read the file or it lacks a usable video stream; any other error
 * means ffprobe itself failed.
 */
export async function probeVideo(ffprobePath: string, inputPath: string) {
  let output: string;
  try {
    output = await runMediaTool(ffprobePath, [
      '-v', 'error',
      // Uploads are untrusted: allow only local file reads and only the MP4 demuxer,
      // so a crafted file cannot make ffprobe fetch URLs or parse playlists.
      '-protocol_whitelist', 'file',
      '-f', 'mp4',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height:format=duration',
      '-of', 'json',
      // The file: prefix keeps a path from ever being parsed as an option or protocol.
      `file:${inputPath}`,
    ], probeTimeoutMs);
  } catch (error) {
    if (error instanceof MediaToolExitError) {
      throw new InvalidVideoError('The video could not be read. Upload a playable MP4 file.', { cause: error });
    }
    throw error;
  }
  return parseProbeOutput(output);
}
