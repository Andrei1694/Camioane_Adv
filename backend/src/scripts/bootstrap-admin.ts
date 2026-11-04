import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { AppError } from '../lib/app-error.ts';
import { prisma } from '../lib/prisma.ts';
import { parseEmail, parsePassword } from '../lib/user-validation.ts';
import { bootstrapAdministrator } from '../services/user.service.ts';

// readline handles Unicode, editing and paste; only its output is muted while
// entering passwords. Reject pipes so passwords never fall back to echoed input.
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const terminal = createInterface({ input: process.stdin, output, terminal: true });
const cancelled = new AbortController();
terminal.on('SIGINT', () => cancelled.abort());

async function ask(prompt: string, secret = false) {
  if (!secret) return terminal.question(prompt, { signal: cancelled.signal });
  process.stdout.write(prompt);
  hidden = true;
  try {
    return await terminal.question('', { signal: cancelled.signal });
  } finally {
    hidden = false;
    process.stdout.write('\n');
  }
}

try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AppError(400, 'Run admin:bootstrap in an interactive terminal.');
  }
  const email = parseEmail(await ask('Administrator email: '));
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing?.role === 'ADMIN') {
    console.log('This account is already an administrator. No changes made.');
  } else if (existing) {
    const confirmation = await ask('Promote this existing account to administrator? Type yes: ');
    if (confirmation.trim().toLowerCase() !== 'yes') {
      console.log('Cancelled. No changes made.');
    } else {
      await bootstrapAdministrator(email, undefined, true);
      console.log('Administrator access granted. Existing sessions must sign in again.');
    }
  } else {
    let password = parsePassword(await ask('Password (12–128 characters, hidden): ', true));
    let confirmation = await ask('Confirm password (hidden): ', true);
    if (password !== confirmation) throw new AppError(400, 'Passwords do not match');
    await bootstrapAdministrator(email, password);
    password = '';
    confirmation = '';
    console.log('Administrator created. You can now sign in.');
  }
} catch (error) {
  console.error(cancelled.signal.aborted ? 'Cancelled. No further changes made.'
    : error instanceof AppError ? error.message : 'Setup failed. Check database connectivity and migrations.');
  process.exitCode = 1;
} finally {
  terminal.close();
  output.end();
  await prisma.$disconnect();
}
