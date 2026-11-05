import './env.ts';
import { Prisma } from '../../src/generated/prisma/client.ts';
import { prisma } from '../../src/lib/prisma.ts';

type Action = (tx: Prisma.TransactionClient) => Promise<unknown>;
type Handler = (action: Action, options: unknown, call: number) => Promise<unknown>;
type Overrides = Record<string, Record<string, (...args: never[]) => unknown>>;

const original = prisma.$transaction;

export function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Simulated ${code}`, { code, clientVersion: 'test' });
}

/** The shape adapter-pg uses for a commit-time serialization failure. */
export function driverConflict() {
  return Object.assign(new Error('Simulated write conflict'), {
    name: 'DriverAdapterError',
    cause: { kind: 'TransactionWriteConflict' },
  });
}

export function realTransaction(action: Action, options: unknown) {
  return Reflect.apply(original, prisma, [action, options]);
}

// Prisma's client proxy hides its methods from property descriptors, so
// mock.method cannot wrap $transaction; assignment through the proxy works.
export function replaceTransaction(handler: Handler) {
  let calls = 0;
  Object.assign(prisma, { $transaction: (action: Action, options: unknown) => handler(action, options, calls++) });
  return {
    get calls() {
      return calls;
    },
    restore() {
      Object.assign(prisma, { $transaction: original });
    },
  };
}

/** Throws each error in turn from the next transactions, then runs them for real. */
export function failTransactions(...errors: unknown[]) {
  return replaceTransaction((action, options, call) => {
    if (call < errors.length) return Promise.reject(errors[call]);
    return realTransaction(action, options);
  });
}

function bindAll<T extends object>(target: T, overrides: Record<string, unknown>) {
  return new Proxy(target, {
    get(object, property) {
      if (typeof property === 'string' && property in overrides) return overrides[property];
      const value: unknown = Reflect.get(object, property);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });
}

/**
 * Runs transactions for real, but answers chosen model methods from the
 * overrides, for states the shared database must not be put in (for example
 * a single remaining administrator, or an expired ADMIN role).
 */
export function overrideTransactions(overrides: Overrides) {
  return replaceTransaction((action, options) => realTransaction((tx) => action(bindAll(tx, Object.fromEntries(
    Object.entries(overrides).map(([model, methods]) => [model, bindAll(Reflect.get(tx, model), methods)]),
  ))), options));
}
