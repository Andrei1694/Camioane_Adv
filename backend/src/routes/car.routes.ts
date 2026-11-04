import { json, Router } from 'express';
import { create, get, list, remove, update } from '../controllers/car.controller.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';

export function createCarRouter() {
  const router = Router();
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // The service rechecks administrator access inside each transaction.
  router.use(authenticate, requireAdmin);

  router.get('/', list);
  router.post('/', parseJson, create);
  router.get('/:id', get);
  router.patch('/:id', parseJson, update);
  router.delete('/:id', remove);

  return router;
}
