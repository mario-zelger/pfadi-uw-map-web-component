import type { Feature } from 'geojson';
import type { FeatureGroup, Layer, LeafletEvent, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import type { LayerColor, LayerStyle, Region, RegionSelectedEventDetail } from './interfaces';
import { GeoApiStringBuilder } from './utilities/geo-api-string-builder.ts';
import leafletCss from 'leaflet/dist/leaflet.css?inline';

const ATTRIBUTES = {
  REGIONS: 'regions',
  SELECTED_REGION_ID: 'selected-region-id',
} as const;

const CONFIG = {
  TILE_URL: 'https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
} as const;

class PfadiUwMap extends HTMLElement {
  private selectedMapFeature: FeatureGroup | null = null;
  private selectedRegionId: string | null = null;
  private map: LeafletMap | null = null;
  private geoJsonFeaturesPerRegion: Feature[][] = [];

  private readonly shadowDom: ShadowRoot;
  private readonly apiStringBuilder: GeoApiStringBuilder;
  private readonly mapFeatureByRegionId: Map<string, FeatureGroup> = new Map<string, FeatureGroup>();
  private readonly defaultColors: LayerColor = { color: '#BB7D5A', fillColor: 'lightgray' };
  private readonly defaultSelectedColors: LayerColor = { color: 'lightgray', fillColor: '#BB7D5A' };
  private readonly defaultStyle: LayerStyle = {
    color: this.defaultColors.color,
    fillColor: this.defaultColors.fillColor,
    weight: 2,
    fillOpacity: 0.7,
  };

  constructor() {
    super();
    this.shadowDom = this.attachShadow({ mode: 'closed' });
    this.apiStringBuilder = new GeoApiStringBuilder()
      .withBaseUrl('https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill/')
      .withGeometryFormat('geojson')
      .withSpatialReference(4326);
  }

  static get observedAttributes(): string[] {
    return [ATTRIBUTES.SELECTED_REGION_ID, ATTRIBUTES.REGIONS];
  }

  connectedCallback(): void {
    console.debug('[pfadi-uw-map] connectedCallback start');
    const mapElement = this.initLeaflet();
    this.map = new L.Map(mapElement, {
      crs: L.CRS.EPSG3857,
      worldCopyJump: false,
    });

    this.map.addLayer(
      L.tileLayer(CONFIG.TILE_URL, {
        keepBuffer: 20,
        minZoom: 11,
        maxZoom: 13,
      }),
    );
    this.map.setView(L.latLng(46.9, 8.37), 11);
    console.debug(
      '[pfadi-uw-map] map initialized, features pending:',
      this.geoJsonFeaturesPerRegion.map((f) => f.length),
    );

    this.addRegionFeaturesToMap();
    this.selectRegion(this.selectedRegionId);
  }

  async attributeChangedCallback(name: string, oldValue: any, newValue: any): Promise<void> {
    console.debug('[pfadi-uw-map] attributeChangedCallback:', name, 'map ready:', !!this.map);
    if (newValue === oldValue) {
      return;
    }

    if (name === ATTRIBUTES.SELECTED_REGION_ID) {
      this.selectedRegionId = newValue;
      this.selectRegion(this.selectedRegionId);
    }

    if (name === ATTRIBUTES.REGIONS) {
      console.debug('[pfadi-uw-map] regions attribute value:', newValue);
      try {
        const regions: Region[] = JSON.parse(newValue ?? '[]');
        console.debug('[pfadi-uw-map] parsed regions:', regions.length);
        this.ensureRegionsAreValid(regions);

        await this.loadFeaturesPerRegion(regions);
        console.debug(
          '[pfadi-uw-map] features loaded:',
          this.geoJsonFeaturesPerRegion.map((f) => f.length),
        );
        this.addRegionFeaturesToMap();
      } catch (e) {
        console.error('[pfadi-uw-map] error processing regions:', e);
      }
    }
  }

  private ensureRegionsAreValid(regions: any): void {
    if (!Array.isArray(regions)) {
      throw new TypeError('regions must be an Array');
    }

    for (const region of regions) {
      const titleProperty = region['title'];
      if (!titleProperty || typeof titleProperty !== 'string' || titleProperty.length === 0) {
        throw new TypeError('title must be a non-empty string');
      }

      const regionIdsProperty = region['regionIds'];
      if (
        !Array.isArray(regionIdsProperty) ||
        regionIdsProperty.length === 0 ||
        regionIdsProperty.some((id: any) => typeof id !== 'string' || id.length === 0)
      ) {
        throw new TypeError('regionIds must be a non-empty Array of non-empty strings');
      }
    }
  }

  private async loadFeaturesPerRegion(regions: Region[]): Promise<void> {
    const regionFeatureLoadTasks = regions
      .map((r) => r.regionIds)
      .map(async (regionIds) => {
        const regionApiUrls = regionIds.map((id) => this.apiStringBuilder.withRegionId(id).build());
        console.debug('[pfadi-uw-map] fetching URLs:', regionApiUrls);

        let regionResponses: Response[];
        try {
          regionResponses = await Promise.all(regionApiUrls.map((url) => fetch(url)));
        } catch (e) {
          console.error('[pfadi-uw-map] fetch failed:', e);
          return [];
        }

        const features: Feature[] = [];
        for (const r of regionResponses) {
          console.debug('[pfadi-uw-map] response status:', r.status, r.url);
          if (r.status !== 200) {
            continue;
          }

          try {
            const json: any = await r.json();
            if (!json || !json.feature) {
              console.warn('[pfadi-uw-map] no feature in response:', json);
              continue;
            }

            features.push(json.feature);
          } catch (e) {
            console.error('[pfadi-uw-map] JSON parse error:', e);
          }
        }

        return features;
      });

    this.geoJsonFeaturesPerRegion = await Promise.all(regionFeatureLoadTasks);
  }

  private addRegionFeaturesToMap(): void {
    console.debug('[pfadi-uw-map] addRegionFeaturesToMap, map ready:', !!this.map, 'regions:', this.geoJsonFeaturesPerRegion.length);
    if (!this.map) {
      console.warn('[pfadi-uw-map] map not ready, skipping addRegionFeaturesToMap');
      return;
    }

    this.mapFeatureByRegionId.clear();
    const renderer = L.svg({ padding: 4 });

    for (const regionFeatures of this.geoJsonFeaturesPerRegion) {
      const geoJsonLayers = regionFeatures.map((feature) =>
        L.geoJSON(feature, {
          // @ts-ignore
          renderer,
          style: (_) => this.defaultStyle,
          onEachFeature: (feature: any, layer: any) => {
            const nm = feature.properties.label;
            layer.bindTooltip(nm, {
              permanent: true,
              direction: 'center',
            });
          },
        }),
      );

      const mapFeature = geoJsonLayers.length === 1 ? geoJsonLayers[0] : L.featureGroup(geoJsonLayers);
      mapFeature.on('click', (e: LeafletEvent) => {
        const feature = (e as any).propagatedFrom?.feature;
        if (!feature) {
          return;
        }

        this.selectRegion(feature.id, e.target);
        this.dispatchEvent(
          new CustomEvent<RegionSelectedEventDetail>('region-selected', {
            detail: { regionId: feature.id },
            bubbles: true,
            composed: true,
          }),
        );
      });

      for (const feature of regionFeatures) {
        if (!feature.id) {
          continue;
        }

        this.mapFeatureByRegionId.set(feature.id as string, mapFeature);
      }

      mapFeature.addTo(this.map);
    }
  }

  private selectRegion(regionId: string | null, targetMapFeature?: FeatureGroup): void {
    if (!this.map) {
      return;
    }

    const newSelectedFeature = targetMapFeature ?? this.mapFeatureByRegionId.get(regionId ?? '');
    if (!newSelectedFeature) {
      if (this.selectedMapFeature) {
        // Reset style of previously selected feature as no new feature is selected
        this.setFeatureStyle(this.selectedMapFeature, this.defaultStyle);
      }

      return;
    }

    if (this.selectedMapFeature === newSelectedFeature) {
      // Feature is already selected, nothing to do
      return;
    }

    if (this.selectedMapFeature) {
      // Reset style of previously selected feature
      this.setFeatureStyle(this.selectedMapFeature, this.defaultStyle);
    }

    this.selectedMapFeature = newSelectedFeature;
    const selectedColors = this.defaultSelectedColors;
    this.setFeatureStyle(this.selectedMapFeature, {
      ...this.defaultStyle,
      color: selectedColors.color,
      fillColor: selectedColors.fillColor,
    });

    this.selectedMapFeature.bringToFront();
    const bounds = this.selectedMapFeature.getBounds();
    if (!bounds.isValid()) {
      return;
    }

    const center = bounds.getCenter();
    this.map.panTo(center, { animate: true });
  }

  private setFeatureStyle(feature: FeatureGroup, style: LayerStyle): void {
    feature.eachLayer((layer: Layer) => {
      if (typeof (layer as any).setStyle === 'function') {
        (layer as any).setStyle(style);
      }
    });
  }

  private initLeaflet(): HTMLDivElement {
    const mapElement = document.createElement('div');
    mapElement.setAttribute('id', 'map');
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';
    mapElement.style.zIndex = '0';

    const styleElement = document.createElement('style');
    styleElement.textContent = leafletCss;

    this.shadowDom.appendChild(styleElement);
    this.shadowDom.appendChild(mapElement);

    return mapElement;
  }
}

customElements.define('pfadi-uw-map', PfadiUwMap);
