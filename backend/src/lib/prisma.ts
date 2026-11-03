import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString?.trim()) {
  throw new Error('DATABASE_URL is required. Configure it in backend/.env.');
}

const adapter = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: 5000,
});

export const prisma = new PrismaClient({ adapter });
