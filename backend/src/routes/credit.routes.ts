import { json, Router } from 'express';
import type { CreditConfig } from '../config/credits.ts';
import { createCreditController } from '../controllers/credit.controller.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createCreditService } from '../services/credit.service.ts';

export function createCreditRouter(config: CreditConfig) {
  const router = Router();
  const controller = createCreditController(createCreditService(config));
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate);

  router.get('/balance', controller.balance);
  router.get('/transactions', controller.transactions);
  router.get('/purchases', controller.purchases);
  router.post('/purchases', parseJson, controller.createPurchase);
  router.post('/purchases/:id/cancel', controller.cancelPurchase);
  // The service rechecks administrator access inside each transaction.
  router.post('/purchases/:id/confirm', requireAdmin, parseJson, controller.confirmPurchase);
  router.post('/purchases/:id/fail', requireAdmin, controller.failPurchase);
  router.post('/adjustments', requireAdmin, parseJson, controller.adjust);

  return router;
}
