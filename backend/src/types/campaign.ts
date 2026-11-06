export interface CampaignInterval {
  id: string;
  start: number;
  end: number;
}

export interface CampaignDay {
  date: string;
  intervals: CampaignInterval[];
}

export interface CampaignInput {
  name: string;
  days: CampaignDay[];
}

export interface CampaignUpdate extends CampaignInput {
  version: number;
}

export interface CampaignPagination {
  limit: number;
  offset: number;
}
