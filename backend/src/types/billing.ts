import type { UserBilling } from '../generated/prisma/client.ts';

export type BillingData = Pick<UserBilling, 'companyName' | 'cui' | 'address' | 'email'>;
export type PublicBilling = BillingData & Pick<UserBilling, 'updatedAt'>;
