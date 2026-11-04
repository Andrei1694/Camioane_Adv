import type { AppConfig } from '../generated/prisma/client.ts';

export type PublicConfigEntry = Pick<AppConfig, 'key' | 'value' | 'updatedAt'>;
