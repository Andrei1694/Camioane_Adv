import { json, Router } from 'express';
import { createScreenPresetController } from '../controllers/screen-preset.controller.ts';
import { rejectScreenPresetQuery } from '../lib/screen-preset-validation.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createScreenPresetService } from '../services/screen-preset.service.ts';

export function createScreenPresetRouter() {
  const router = Router();
  const controller = createScreenPresetController(createScreenPresetService());
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate, requireAdmin);
  router.use((req, res, next) => { rejectScreenPresetQuery(req.query); next(); });
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', parseJson, controller.create);
  router.patch('/:id', parseJson, controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
