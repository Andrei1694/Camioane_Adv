export interface SavedCampaignInterval {
  id: string
  start: number
  end: number
}

export interface SavedCampaignDay {
  date: string
  intervals: SavedCampaignInterval[]
}

export interface CampaignInput {
  name: string
  days: SavedCampaignDay[]
}

export interface StoredCampaign extends CampaignInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface CampaignPageData {
  campaigns: StoredCampaign[]
  total: number
}

export const campaignsKey = (revision: number) => ['campaigns', revision] as const
export const maxCampaignNameLength = 200

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isCampaignSchedule(value: unknown): value is SavedCampaignDay[] {
  if (!Array.isArray(value) || !value.length) return false
  const ids = new Set<string>()
  let previousDate = ''
  for (const day of value) {
    if (!record(day) || typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)
      || day.date.startsWith('0000') || day.date <= previousDate || !Array.isArray(day.intervals)
      || !day.intervals.length || day.intervals.length > 96) return false
    const date = new Date(`${day.date}T12:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day.date) return false
    previousDate = day.date
    let previousEnd = 0
    for (const interval of day.intervals) {
      if (!record(interval) || typeof interval.id !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(interval.id)
        || ids.has(interval.id) || typeof interval.start !== 'number' || typeof interval.end !== 'number'
        || !Number.isInteger(interval.start) || !Number.isInteger(interval.end)
        || interval.start < previousEnd || interval.start >= interval.end || interval.end > 1440
        || interval.start % 15 !== 0 || interval.end % 15 !== 0) return false
      ids.add(interval.id)
      previousEnd = interval.end
    }
  }
  return true
}
