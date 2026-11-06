import { json, Router } from 'express';
import { createCarController } from '../controllers/car.controller.ts';
import { rejectCarQuery } from '../lib/car-validation.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createCarService } from '../services/car.service.ts';

export function createCarRouter() {
  const router = Router();
  const controller = createCarController(createCarService());
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate, requireAdmin);
  router.use((req, res, next) => { rejectCarQuery(req.query); next(); });
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', parseJson, controller.create);
  router.patch('/:id', parseJson, controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
