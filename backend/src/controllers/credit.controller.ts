import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import {
  parseAdjustment,
  parseConfirmPurchase,
  parseCreatePurchase,
  parseCreditQuery,
  parsePurchaseId,
  parseUserFilter,
} from '../lib/credit-validation.ts';
import type { CreditService } from '../services/credit.service.ts';
import type { UserLocals } from '../types/user.ts';

type CreditResponse = Response<unknown, UserLocals>;

function actor(res: CreditResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createCreditController(service: CreditService) {
  return {
    async balance(req: Request, res: CreditResponse) {
      res.json(await service.getBalance(actor(res), parseUserFilter(req.query)));
    },

    async transactions(req: Request, res: CreditResponse) {
      res.json(await service.listTransactions(actor(res), parseCreditQuery(req.query, { status: false })));
    },

    async purchases(req: Request, res: CreditResponse) {
      res.json(await service.listPurchases(actor(res), parseCreditQuery(req.query, { status: true })));
    },

    async createPurchase(req: Request, res: CreditResponse) {
      res.status(201).json({ purchase: await service.createPurchase(actor(res), parseCreatePurchase(req.body)) });
    },

    async cancelPurchase(req: Request, res: CreditResponse) {
      res.json({ purchase: await service.cancelPurchase(actor(res), parsePurchaseId(req.params.id)) });
    },

    async confirmPurchase(req: Request, res: CreditResponse) {
      const id = parsePurchaseId(req.params.id);
      res.json(await service.confirmPurchase(actor(res), id, parseConfirmPurchase(req.body)));
    },

    async failPurchase(req: Request, res: CreditResponse) {
      res.json({ purchase: await service.failPurchase(actor(res), parsePurchaseId(req.params.id)) });
    },

    async adjust(req: Request, res: CreditResponse) {
      res.status(201).json({ transaction: await service.adjust(actor(res), parseAdjustment(req.body)) });
    },
  };
}
