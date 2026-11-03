import { prisma } from '../lib/prisma.ts';

try {
  const result = await prisma.$queryRaw<{ database: string; user: string }[]>`
    SELECT current_database() AS database, current_user AS user
  `;
  console.log('PostgreSQL connection successful:', result[0]);
} catch {
  console.error('PostgreSQL connection failed. Check DATABASE_URL and confirm the database is running.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
