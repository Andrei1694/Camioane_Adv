import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
/** A fixture as a file URL, the form --import accepts on every platform. */
export const fixtureUrl = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).href;

export interface RunResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface SpawnOptions {
  /** Merged over process.env; undefined removes a variable. Keeping process.env
   * passes NODE_V8_COVERAGE on, so the child's coverage is reported. */
  env?: Record<string, string | undefined>;
  ipc?: boolean;
  timeoutMs?: number;
}

/** Runs a TypeScript entry point in a new Node process from backend/. */
export function spawnNode(args: readonly string[], { env = {}, ipc = false, timeoutMs = 20_000 }: SpawnOptions = {}) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[name];
    else childEnv[name] = value;
  }
  const child = spawn(process.execPath, args, {
    cwd: backendRoot,
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe', ipc ? 'ipc' : 'ignore'],
  });
  const { stdin, stdout: output, stderr: errors } = child;
  if (!stdin || !output || !errors) throw new Error('Child process streams are missing');
  let stdout = '';
  let stderr = '';
  let cursor = 0;
  let notify = () => {};
  output.setEncoding('utf8').on('data', (chunk: string) => {
    stdout += chunk;
    notify();
  });
  errors.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const exited = new Promise<RunResult>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status, signal) => {
      clearTimeout(timer);
      notify();
      resolve({ status, signal, stdout, stderr });
    });
  });

  return {
    child,
    exited,
    /** Resolves once stdout, after the previous match, contains the pattern. */
    waitForOutput(pattern: string) {
      return new Promise<void>((resolve, reject) => {
        notify = () => {
          const index = stdout.indexOf(pattern, cursor);
          if (index !== -1) {
            cursor = index + pattern.length;
            notify = () => {};
            resolve();
          } else if (child.exitCode !== null || child.signalCode !== null) {
            reject(new Error(`Process exited before printing ${JSON.stringify(pattern)}.\nstdout: ${stdout}\nstderr: ${stderr}`));
          }
        };
        notify();
      });
    },
    write(text: string) {
      stdin.write(text);
    },
    endInput() {
      stdin.end();
    },
  };
}

/** Runs to completion, typing each answer once its prompt appears. */
export async function runNode(args: readonly string[], options: SpawnOptions & { answers?: [string, string][] } = {}) {
  const run = spawnNode(args, options);
  for (const [prompt, answer] of options.answers ?? []) {
    await run.waitForOutput(prompt);
    run.write(answer);
  }
  run.endInput();
  return run.exited;
}

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!address || typeof address === 'string') throw new Error('No port assigned');
  return address.port;
}
