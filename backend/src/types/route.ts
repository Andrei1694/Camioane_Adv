export type Coordinate = [longitude: number, latitude: number];

export interface RouteInput {
  name: string;
  waypoints: Coordinate[];
}

export interface RouteUpdate extends RouteInput {
  version: number;
}

export interface RoutePagination {
  limit: number;
  offset: number;
}
