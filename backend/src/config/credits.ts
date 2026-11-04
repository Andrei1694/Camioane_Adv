export const MAX_CREDITS_PER_PURCHASE = 100000;

// Purchase totals are stored as INT4, so the largest purchase must fit.
const maxUnitPriceMinor = Math.floor(2147483647 / MAX_CREDITS_PER_PURCHASE);

export function loadCreditConfig(env: NodeJS.ProcessEnv = process.env) {
  const currency = env.CREDIT_CURRENCY ?? 'EUR';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('CREDIT_CURRENCY must be a three-letter uppercase currency code.');
  const rawPrice = env.CREDIT_UNIT_PRICE_MINOR ?? '100';
  const unitPriceMinor = Number(rawPrice);
  if (!/^\d+$/.test(rawPrice) || unitPriceMinor < 1 || unitPriceMinor > maxUnitPriceMinor) {
    throw new Error(`CREDIT_UNIT_PRICE_MINOR must be an integer between 1 and ${maxUnitPriceMinor}.`);
  }
  return { currency, unitPriceMinor };
}

export type CreditConfig = ReturnType<typeof loadCreditConfig>;
