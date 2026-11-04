import { Prisma } from '../generated/prisma/client.ts';
import { AppError } from './app-error.ts';
import { prisma } from './prisma.ts';

export function isWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  // adapter-pg can surface a commit-time serialization failure directly rather
  // than wrapping it in Prisma's P2034 error.
  return error instanceof Error && error.name === 'DriverAdapterError'
    && typeof error.cause === 'object' && error.cause !== null
    && 'kind' in error.cause && error.cause.kind === 'TransactionWriteConflict';
}

// Runs the action in a serializable transaction and retries serialization
// conflicts twice before answering 409 with conflictMessage.
export async function serializable<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  conflictMessage: string,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(action, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
    }
  }
  throw new AppError(409, conflictMessage);
}
