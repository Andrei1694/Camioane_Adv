import { json, Router } from 'express';
import { createCampaignController } from '../controllers/campaign.controller.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';
import { createCampaignService } from '../services/campaign.service.ts';

export function createCampaignRouter() {
  const router = Router();
  const controller = createCampaignController(createCampaignService());
  const parseJson = json({ limit: '1mb' });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate, requireAdmin);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', parseJson, controller.create);
  router.patch('/:id', parseJson, controller.update);
  return router;
}
