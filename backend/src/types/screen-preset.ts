export type RegionId = 'left' | 'middle' | 'right';
export type Fit = 'cover' | 'contain';
export type ScreenCanvas = { width: number; height: number };
export type ScreenRegion = { x: number; y: number; width: number; height: number; fit: Fit };
export type ScreenRegions = Record<RegionId, ScreenRegion>;

export interface ScreenPresetInput {
  name: string;
  canvas: ScreenCanvas;
  regions: ScreenRegions;
}

export interface ScreenPresetUpdate extends ScreenPresetInput {
  version: number;
}
