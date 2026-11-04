import { json, Router } from 'express';
import { get, list, put, remove } from '../controllers/config.controller.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';

export function createConfigRouter() {
  const router = Router();
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // The service rechecks administrator access inside each transaction.
  router.use(authenticate, requireAdmin);

  router.get('/', list);
  router.get('/:key', get);
  router.put('/:key', parseJson, put);
  router.delete('/:key', remove);

  return router;
}
