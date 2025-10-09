import type { GeometryFormat, SpatialReferenceId } from '../interfaces';

export class GeoApiStringBuilder {
  private baseUrl: string = '';
  private regionId: string = '';
  private geometryFormat: GeometryFormat | null = null;
  private spatialReference: SpatialReferenceId | null = null;

  withBaseUrl(baseUrl: string): GeoApiStringBuilder {
    this.baseUrl = baseUrl;
    return this;
  }

  withRegionId(regionId: string): GeoApiStringBuilder {
    this.regionId = regionId;
    return this;
  }

  withGeometryFormat(geometryFormat: GeometryFormat): GeoApiStringBuilder {
    this.geometryFormat = geometryFormat;
    return this;
  }

  withSpatialReference(spacialReferenceId: SpatialReferenceId): GeoApiStringBuilder {
    this.spatialReference = spacialReferenceId;
    return this;
  }

  build(): string {
    return `${this.baseUrl}/${this.regionId}?geometryFormat=${this.geometryFormat ?? ''}&sr=${this.spatialReference ?? ''}`;
  }
}

