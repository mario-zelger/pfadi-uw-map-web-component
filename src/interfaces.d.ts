export interface LayerColor {
  color: string;
  fillColor: string;
}

export interface LayerStyle extends LayerColor {
  weight: number;
  fillOpacity: number;
}

export interface Region {
  title: string;
  municipalityIds: string[];
  primaryColor: string;
  secondaryColor: string;
}

export interface RegionSelectedEventDetail {
  municipalityId: string;
}

export type GeometryFormat = 'geojson' | 'esrijson';

// LV03 = 21781, LV95 = 2056, WebMercator = 3857
export type SpatialReferenceId = 21781 | 2056 | 4326 | 3857;
