// Loaded with --import: closes the database connection as usual, then reports
// a failure, to exercise the server's shutdown error handling.
import { prisma } from '../../src/lib/prisma.ts';

const disconnect = prisma.$disconnect.bind(prisma);
Object.assign(prisma, {
  async $disconnect() {
    await disconnect();
    throw new Error('Simulated disconnect failure');
  },
});
