import { randomBytes } from 'node:crypto';

// Configuration is read when src/ modules load, so every helper that imports
// src/ imports this module first. Test files import helpers before src/.
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.WEBSITE_ORIGIN = 'http://localhost:5174';
// Non-default prices prove purchases snapshot the configuration.
process.env.CREDIT_CURRENCY = 'RON';
process.env.CREDIT_UNIT_PRICE_MINOR = '250';
