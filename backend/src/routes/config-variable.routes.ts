import { json, Router } from 'express';
import { createConfigVariableController } from '../controllers/config-variable.controller.ts';
import { rejectConfigVariableQuery } from '../lib/config-variable-validation.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createConfigVariableService } from '../services/config-variable.service.ts';

export function createConfigVariableRouter() {
  const router = Router();
  const controller = createConfigVariableController(createConfigVariableService());
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate, requireAdmin);
  router.use((req, res, next) => { rejectConfigVariableQuery(req.query); next(); });
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', parseJson, controller.create);
  router.patch('/:id', parseJson, controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
