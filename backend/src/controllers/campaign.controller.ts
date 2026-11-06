import type { Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';
import { parseCampaignCreate, parseCampaignId, parseCampaignPagination, parseCampaignUpdate } from '../lib/campaign-validation.ts';
import type { CampaignService } from '../services/campaign.service.ts';
import type { UserLocals } from '../types/user.ts';

type CampaignResponse = Response<unknown, UserLocals>;

function actor(res: CampaignResponse) {
  if (!res.locals.session) throw new AppError(401, 'Unauthorized');
  return res.locals.session;
}

export function createCampaignController(service: CampaignService) {
  return {
    async list(req: Request, res: CampaignResponse) {
      res.json(await service.list(actor(res), parseCampaignPagination(req.query)));
    },
    async get(req: Request, res: CampaignResponse) {
      res.json({ campaign: await service.get(actor(res), parseCampaignId(req.params.id)) });
    },
    async create(req: Request, res: CampaignResponse) {
      res.status(201).json({ campaign: await service.create(actor(res), parseCampaignCreate(req.body)) });
    },
    async update(req: Request, res: CampaignResponse) {
      res.json({ campaign: await service.update(actor(res), parseCampaignId(req.params.id), parseCampaignUpdate(req.body)) });
    },
  };
}
