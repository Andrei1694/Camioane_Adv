import { json, Router } from 'express';
import { createRouteController } from '../controllers/route.controller.ts';
import { rejectRouteQuery } from '../lib/route-validation.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createRouteService } from '../services/route.service.ts';

export function createRouteRouter() {
  const router = Router();
  const controller = createRouteController(createRouteService());
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate, requireAdmin);
  router.get('/', controller.list);
  router.use((req, res, next) => { rejectRouteQuery(req.query); next(); });
  router.get('/:id', controller.get);
  router.post('/', parseJson, controller.create);
  router.patch('/:id', parseJson, controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
