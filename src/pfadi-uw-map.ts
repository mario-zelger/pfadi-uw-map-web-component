import type { Feature } from 'geojson';
import type { FeatureGroup, Layer, LeafletEvent, Map as LeafletMap } from 'leaflet';
import type { LayerColor, LayerStyle, Region, RegionSelectedEventDetail } from './interfaces';
import { GeoApiStringBuilder } from './utilities/geo-api-string-builder.ts';

// Leaflet is loaded dynamically into the shadow DOM
// We declare it here to have type information available
declare const L: typeof import('leaflet');

const ATTRIBUTES = {
  REGIONS: 'regions',
  SELECTED_REGION_ID: 'selected-region-id',
} as const;

const CONFIG = {
  TILE_URL: 'https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
  LEAFLET_VERSION: '1.9.4',
} as const;

class PfadiUwMap extends HTMLElement {
  private isInitialized: boolean = false;
  private selectedMapFeature: FeatureGroup | null = null;
  private selectedRegionId: string | null = null;
  private map: LeafletMap | null = null;

  private readonly shadowDom: ShadowRoot;
  private readonly apiStringBuilder: GeoApiStringBuilder;
  private readonly mapFeatureByRegionId: Map<string | number, FeatureGroup> = new Map<string | number, FeatureGroup>();
  private readonly colorsByRegion: Map<string, LayerColor> = new Map<string, LayerColor>();
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

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const mapElement = await this.initLeaflet();
    this.map = new L.Map(mapElement, {
      crs: L.CRS.EPSG3857,
      worldCopyJump: false,
    });

    this.map.addLayer(L.tileLayer(CONFIG.TILE_URL));
    this.map.setView(L.latLng(46.9, 8.37), 11);
    this.addFeaturesToMap();

    this.isInitialized = true;
  }

  async attributeChangedCallback(name: string, oldValue: any, newValue: any): Promise<void> {
    if (name === ATTRIBUTES.SELECTED_REGION_ID) {
      if (newValue !== oldValue && typeof newValue === 'string' && newValue.length > 0) {
        this.selectedRegionId = newValue;
      }
    }

    if (name === ATTRIBUTES.REGIONS && newValue) {
      const regions: any = JSON.parse(newValue);
      this.ensureRegionsAreValid(regions);

      await this.updateRegions(regions as Region[]);
    }

    if (this.selectedRegionId) {
      this.selectRegion(this.selectedRegionId);
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

      const primaryColorProperty = region['primaryColor'];
      if (!primaryColorProperty || typeof primaryColorProperty !== 'string' || primaryColorProperty.length === 0) {
        throw new TypeError('primaryColor must be a non-empty string');
      }

      const secondaryColor = region['secondaryColor'];
      if (!secondaryColor || typeof secondaryColor !== 'string' || secondaryColor.length === 0) {
        throw new TypeError('secondaryColor must be a non-empty string');
      }
    }
  }

  private async updateRegions(regions: Region[]): Promise<void> {
    this.mapFeatureByRegionId.clear();
    this.colorsByRegion.clear();

    this.updateColorsByRegion(regions);

    const loadRegionInfos = regions
      .map((r) => r.regionIds)
      .map(async (regionIds) => {
        const regionApiUrls = regionIds.map((id) => this.apiStringBuilder.withRegionId(id).build());
        const regionResponses = await Promise.all(regionApiUrls.map((url) => fetch(url)));

        const features: Feature[] = [];
        for (const r of regionResponses) {
          if (r.status !== 200) {
            continue;
          }

          try {
            const json: any = await r.json();
            if (!json || !json.feature) {
              continue;
            }

            features.push(json.feature);
          } catch (e) {
            console.error(e);
          }
        }

        this.initRegionFeatures(features);
      });

    await Promise.all(loadRegionInfos);

    if (this.map) {
      this.addFeaturesToMap();
    }
  }

  // TODO: Check if color per region / organization is useful.
  private updateColorsByRegion(regions: Region[]) {
    for (const region of regions) {
      for (const regionId of region.regionIds) {
        this.colorsByRegion.set(regionId, {
          color: region.secondaryColor,
          fillColor: region.primaryColor,
        });
      }
    }
  }

  private initRegionFeatures(features: Feature[]): void {
    const geoJsonLayers = features.map((feature) =>
      L.geoJSON(feature, {
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

    for (const feature of features) {
      if (!feature.id) {
        continue;
      }

      this.mapFeatureByRegionId.set(feature.id, mapFeature);
    }
  }

  private addFeaturesToMap() {
    const uniqueFeatures = [...new Set(this.mapFeatureByRegionId.values())];
    for (const mapFeature of uniqueFeatures) {
      mapFeature.addTo(this.map!);
    }
  }

  private selectRegion(regionId: string | undefined, targetMapFeature?: FeatureGroup): void {
    if (!regionId || regionId.length === 0) {
      return;
    }

    const selectedFeature = targetMapFeature ?? this.mapFeatureByRegionId.get(regionId);
    if (!selectedFeature) {
      return;
    }

    if (!!this.selectedMapFeature && selectedFeature !== this.selectedMapFeature) {
      this.selectedMapFeature.eachLayer((layer: Layer) => {
        if (typeof (layer as any).setStyle === 'function') {
          (layer as any).setStyle(this.defaultStyle);
        }
      });
    }

    this.selectedMapFeature = selectedFeature;
    this.selectedMapFeature.bringToFront();
    this.selectedMapFeature.eachLayer((layer: Layer) => {
      if (typeof (layer as any).setStyle === 'function') {
        // TODO: Check if color per region / organization is useful.
        // const color = this.colorsByRegion.get(regionId) ?? this.defaultSelectedColors;
        const color = this.defaultSelectedColors;
        (layer as any).setStyle({
          ...this.defaultStyle,
          color: color.color,
          fillColor: color.fillColor,
        });
      }
    });

    const bounds = this.selectedMapFeature.getBounds();
    if (!this.map || !bounds.isValid()) {
      return;
    }

    const center = bounds.getCenter();
    this.map.panTo(center, { animate: true });
  }

  private initLeaflet(): Promise<HTMLDivElement> {
    const leafletCdnBaseUrl = `https://unpkg.com/leaflet@${CONFIG.LEAFLET_VERSION}/dist`;

    return new Promise((resolve, reject) => {
      const mapElement = document.createElement('div');
      mapElement.setAttribute('id', 'map');
      mapElement.style.width = '100%';
      mapElement.style.height = '100%';
      mapElement.style.zIndex = '0';

      const cssLinkElement = document.createElement('link');
      cssLinkElement.setAttribute('rel', 'stylesheet');
      cssLinkElement.setAttribute('href', `${leafletCdnBaseUrl}/leaflet.css`);
      cssLinkElement.setAttribute('integrity', 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=');
      cssLinkElement.setAttribute('crossorigin', '');
      const cssLoadedPromise = new Promise((res, rej) => {
        cssLinkElement.onload = () => res(mapElement);
        cssLinkElement.onerror = () => rej(new Error(`Could not load Leaflet CSS.`));
      });

      const scriptElement = document.createElement('script');
      scriptElement.setAttribute('defer', '');
      scriptElement.setAttribute('src', `${leafletCdnBaseUrl}/leaflet.js`);
      scriptElement.setAttribute('integrity', 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=');
      scriptElement.setAttribute('crossorigin', '');
      const scriptLoadedPromise = new Promise((res, rej) => {
        scriptElement.onload = () => {
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: `${leafletCdnBaseUrl}/images/marker-icon-2x.png`,
            iconUrl: `${leafletCdnBaseUrl}/images/marker-icon.png`,
            shadowUrl: `${leafletCdnBaseUrl}/images/marker-shadow.png`,
          });

          res(mapElement);
        };
        scriptElement.onerror = () => rej(new Error(`Could not load Leaflet script.`));
      });

      Promise.all([cssLoadedPromise, scriptLoadedPromise])
        .then(() => resolve(mapElement))
        .catch((e) => reject(e));

      this.shadowDom.appendChild(mapElement);
      this.shadowDom.appendChild(cssLinkElement);
      this.shadowDom.appendChild(scriptElement);
    });
  }
}

customElements.define('pfadi-uw-map', PfadiUwMap);
