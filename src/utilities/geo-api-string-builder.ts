import type { GeometryFormat, SpatialReferenceId } from '../interfaces';

export class GeoApiStringBuilder {
  private baseUrl: string = '';
  private municipalityId: string = '';
  private geometryFormat: GeometryFormat | null = null;
  private spatialReference: SpatialReferenceId | null = null;

  withBaseUrl(baseUrl: string): GeoApiStringBuilder {
    this.baseUrl = baseUrl;
    return this;
  }

  withMunicipalityId(municipalityId: string): GeoApiStringBuilder {
    this.municipalityId = municipalityId;
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
    return `${this.baseUrl}/${this.municipalityId}?geometryFormat=${this.geometryFormat ?? ''}&sr=${this.spatialReference ?? ''}`;
  }
}

