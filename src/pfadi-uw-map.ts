import type { Layer, LeafletEvent, Map as LeafletMap } from 'leaflet';
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
  private selectedRegionId: string | null = null;
  private map: LeafletMap | null = null;

  private readonly shadowDom: ShadowRoot;
  private readonly apiStringBuilder: GeoApiStringBuilder;

  private readonly regionById: Map<string, Region> = new Map();
  private readonly layerByMunicipalityId: Map<string, L.GeoJSON> = new Map();
  private readonly regionIdsByMunicipalityId: Map<string, string[]> = new Map();

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

    if (this.map) {
      return;
    }

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
    console.debug('[pfadi-uw-map] map initialized');

    // Add layers that were created before the map was ready
    for (const layer of this.layerByMunicipalityId.values()) {
      layer.addTo(this.map);
    }
    this.selectRegion(this.selectedRegionId);
  }

  async attributeChangedCallback(name: string, oldValue: any, newValue: any): Promise<void> {
    console.debug('[pfadi-uw-map] attributeChangedCallback:', name, 'map ready:', !!this.map);
    if (newValue === oldValue) {
      return;
    }

    if (name === ATTRIBUTES.SELECTED_REGION_ID) {
      this.selectRegion(newValue);
    }

    if (name === ATTRIBUTES.REGIONS) {
      console.debug('[pfadi-uw-map] regions attribute value:', newValue);
      try {
        const regions: Region[] = JSON.parse(newValue ?? '[]');
        console.debug('[pfadi-uw-map] parsed regions:', regions.length);
        this.ensureRegionsAreValid(regions);

        await this.loadRegions(regions);
        console.debug('[pfadi-uw-map] regions loaded, layers:', this.layerByMunicipalityId.size);
      } catch (e) {
        console.error('[pfadi-uw-map] error processing regions:', e);
      }
    }
  }

  private ensureRegionsAreValid(regions: any): void {
    if (!Array.isArray(regions)) {
      throw new TypeError('regions must be an Array');
    }

    const seenIds = new Set<string>();

    for (const region of regions) {
      const idProperty = region['id'];
      if (!idProperty || typeof idProperty !== 'string' || idProperty.length === 0) {
        throw new TypeError('id must be a non-empty string');
      }

      if (seenIds.has(idProperty)) {
        throw new TypeError(`duplicate region id: ${idProperty}`);
      }
      seenIds.add(idProperty);

      const titleProperty = region['title'];
      if (!titleProperty || typeof titleProperty !== 'string' || titleProperty.length === 0) {
        throw new TypeError('title must be a non-empty string');
      }

      const municipalityIdsProperty = region['municipalityIds'];
      if (
        !Array.isArray(municipalityIdsProperty) ||
        municipalityIdsProperty.length === 0 ||
        municipalityIdsProperty.some((id: any) => typeof id !== 'string' || id.length === 0)
      ) {
        throw new TypeError('municipalityIds must be a non-empty Array of non-empty strings');
      }
    }
  }

  private async loadRegions(regions: Region[]): Promise<void> {
    this.regionById.clear();
    this.regionIdsByMunicipalityId.clear();

    // Clear existing layers
    for (const layer of this.layerByMunicipalityId.values()) {
      layer.remove();
    }
    this.layerByMunicipalityId.clear();

    // Build lookup maps
    for (const region of regions) {
      this.regionById.set(region.id, region);
      for (const municipalityId of region.municipalityIds) {
        const existing = this.regionIdsByMunicipalityId.get(municipalityId);
        if (existing) {
          existing.push(region.id);
        } else {
          this.regionIdsByMunicipalityId.set(municipalityId, [region.id]);
        }
      }
    }

    // Fetch unique municipalities and create layers
    const uniqueMunicipalityIds = [...new Set(regions.flatMap((r) => r.municipalityIds))];
    console.debug('[pfadi-uw-map] unique municipalities to fetch:', uniqueMunicipalityIds.length);

    const renderer = L.svg({ padding: 4 });

    const fetchTasks = uniqueMunicipalityIds.map(async (municipalityId) => {
      const url = this.apiStringBuilder.withMunicipalityId(municipalityId).build();
      console.debug('[pfadi-uw-map] fetching URL:', url);

      try {
        const response = await fetch(url);
        console.debug('[pfadi-uw-map] response status:', response.status, response.url);
        if (response.status !== 200) {
          return;
        }

        const json: any = await response.json();
        if (!json || !json.feature) {
          console.warn('[pfadi-uw-map] no feature in response:', json);
          return;
        }

        const layer = L.geoJSON(json.feature, {
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
        });

        layer.on('click', (_e: LeafletEvent) => {
          const regionId = this.resolveSmallestRegion(municipalityId);
          if (!regionId) {
            return;
          }

          this.selectRegion(regionId);
          this.dispatchEvent(
            new CustomEvent<RegionSelectedEventDetail>('region-selected', {
              detail: { regionId },
              bubbles: true,
              composed: true,
            }),
          );
        });

        this.layerByMunicipalityId.set(municipalityId, layer);
        if (this.map) {
          layer.addTo(this.map);
        }
      } catch (e) {
        console.error('[pfadi-uw-map] fetch/parse error for municipality', municipalityId, e);
      }
    });

    await Promise.all(fetchTasks);
  }

  private resolveSmallestRegion(municipalityId: string): string | null {
    const regionIds = this.regionIdsByMunicipalityId.get(municipalityId);
    if (!regionIds || regionIds.length === 0) {
      return null;
    }

    let smallestRegionId = regionIds[0];
    let smallestSize = this.regionById.get(smallestRegionId)?.municipalityIds.length ?? Infinity;

    for (let i = 1; i < regionIds.length; i++) {
      const region = this.regionById.get(regionIds[i]);
      if (region && region.municipalityIds.length < smallestSize) {
        smallestSize = region.municipalityIds.length;
        smallestRegionId = regionIds[i];
      }
    }

    return smallestRegionId;
  }

  private selectRegion(regionId: string | null): void {
    const previousRegionId = this.selectedRegionId;
    this.selectedRegionId = regionId;

    if (!this.map) {
      return;
    }

    // Reset previous region's layers to default style
    if (previousRegionId) {
      const previousRegion = this.regionById.get(previousRegionId);
      if (previousRegion) {
        for (const mId of previousRegion.municipalityIds) {
          const layer = this.layerByMunicipalityId.get(mId);
          if (layer) {
            this.setLayerStyle(layer, this.defaultStyle);
          }
        }
      }
    }
    const newRegion = regionId ? this.regionById.get(regionId) : undefined;
    if (!newRegion) {
      return;
    }

    // Apply selected style to all municipality layers of the new region
    const selectedStyle: LayerStyle = {
      ...this.defaultStyle,
      color: this.defaultSelectedColors.color,
      fillColor: this.defaultSelectedColors.fillColor,
    };

    const bounds = L.latLngBounds([]);

    for (const mId of newRegion.municipalityIds) {
      const layer = this.layerByMunicipalityId.get(mId);
      if (layer) {
        this.setLayerStyle(layer, selectedStyle);
        layer.bringToFront();
        bounds.extend(layer.getBounds());
      }
    }

    if (bounds.isValid()) {
      this.map.panTo(bounds.getCenter(), { animate: true });
    }
  }

  private setLayerStyle(layer: L.GeoJSON, style: LayerStyle): void {
    layer.eachLayer((child: Layer) => {
      if (typeof (child as any).setStyle === 'function') {
        (child as any).setStyle(style);
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
