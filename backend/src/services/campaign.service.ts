import type { Campaign, Prisma } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { campaignToday, checkCampaignPastDays, parseCampaignDays } from '../lib/campaign-validation.ts';
import { isRoleValid } from '../lib/role.ts';
import { serializable } from '../lib/transaction.ts';
import type { CampaignInput, CampaignPagination, CampaignUpdate } from '../types/campaign.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflict = 'This campaign changed during editing. Reload the latest campaign and try again.';

async function requireActor(tx: Prisma.TransactionClient, actor: SessionIdentity) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { sessionVersion: true, role: true } });
  if (!user || user.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
  if (user.role.name !== 'ADMIN' || !isRoleValid(user.role)) throw new AppError(403, 'Administrator access is required');
}

function publicCampaign(campaign: Campaign) {
  try {
    return { ...campaign, days: parseCampaignDays(campaign.days) };
  } catch {
    throw new Error('Invalid stored campaign schedule');
  }
}

function jsonDays(input: CampaignInput) {
  return input.days.map((day) => ({ date: day.date, intervals: day.intervals.map((interval) => ({ ...interval })) }));
}

export function createCampaignService() {
  return {
    async list(actor: SessionIdentity, pagination: CampaignPagination) {
      return serializable(async (tx) => {
        await requireActor(tx, actor);
        const campaigns = await tx.campaign.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pagination.limit, skip: pagination.offset,
        });
        return { campaigns: campaigns.map(publicCampaign), total: await tx.campaign.count() };
      }, conflict);
    },

    async get(actor: SessionIdentity, id: string) {
      return serializable(async (tx) => {
        await requireActor(tx, actor);
        const campaign = await tx.campaign.findUnique({ where: { id } });
        if (!campaign) throw new AppError(404, 'Campaign not found');
        return publicCampaign(campaign);
      }, conflict);
    },

    async create(actor: SessionIdentity, input: CampaignInput) {
      return serializable(async (tx) => {
        await requireActor(tx, actor);
        if (input.days.some((day) => day.date < campaignToday())) throw new AppError(400, 'New campaigns cannot contain past dates');
        return publicCampaign(await tx.campaign.create({ data: { name: input.name, days: jsonDays(input) } }));
      }, conflict);
    },

    async update(actor: SessionIdentity, id: string, input: CampaignUpdate) {
      return serializable(async (tx) => {
        await requireActor(tx, actor);
        const campaign = await tx.campaign.findUnique({ where: { id } });
        if (!campaign) throw new AppError(404, 'Campaign not found');
        if (campaign.version !== input.version) throw new AppError(409, conflict);
        checkCampaignPastDays(input.days, publicCampaign(campaign).days);
        const updated = await tx.campaign.updateMany({
          where: { id, version: input.version },
          data: { name: input.name, days: jsonDays(input), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError(409, conflict);
        return publicCampaign(await tx.campaign.findUniqueOrThrow({ where: { id } }));
      }, conflict);
    },
  };
}

export type CampaignService = ReturnType<typeof createCampaignService>;
