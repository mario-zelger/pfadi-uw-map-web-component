# Pfadi UW Map - Web Component

A web component for displaying an interactive map with GeoJSON data, built for the website of the **Kantonalverband Pfadi Unterwalden**.
This project uses [Leaflet](https://leafletjs.com/) as the main mapping library for rendering interactive maps and handling GeoJSON data.

## Setup

### Prerequisites

- Node.js (version 22 or higher)
- npm

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

### Build

To build the component for production:

```bash
# Build a human readable version:
npm run build:full

# Build a minified version:
npm run build:minified
```

The built files will be available in the `dist/` directory.

## Usage

Integrate the built [Web Component](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) in the website and use it as follows:

```html

<pfadi-uw-map id="my-map"></pfadi-uw-map>
```

Reference the component in your TypeScript / JavaScript code:

```typescript
const myMap = document.getElementById('my-map');
```

### Inputs

* `regions` (string, required): A JSON string representing an array of regions to be displayed on the map. Each region should follow
  the [Region](src/interfaces.d.ts) interface.

```typescript
const regions: Region[] = []
myMap.setAttribute('regions', JSON.stringify(regions));
```

### Events

The component emits the following events:

* `region-selected`

```typescript
myMap.on('region-selected', (e: CustomEvent<RegionSelectedEventDetail>) => {
    console.log(e.detail.regionId); // The region ID of the selected region
});
```

## swisstopo GeoJSON

A provider of Swiss GeoJSON data is [swisstopo](https://www.swisstopo.admin.ch/de).
They provide a [dataset](https://geo.ld.admin.ch/data/swissBOUNDARIES3D) with information about the municipalities of Switzerland.

The BFS-Municipality Number (Gemeindenummer) is used as the unique identifier (`regionId`) for each municipality. Based on that the GeoJSON
data is loaded via the [API](https://api3.geo.admin.ch/index.html).

The BFS-Municipality Numbers can be found
via [Amtliches Gemeindeverzeichnis der Schweiz](https://www.bfs.admin.ch/bfs/de/home/grundlagen/agvch.html)
or by using the [swisstopo map](https://map.geo.admin.ch/). When using the map the Gemeindegrenzen can be activated via
`Geokatalog -> Grundlagen und Planung -> Grenzen -> Gemeindegrenzen`. After that clicking on a municipality will show a popup with the
BFS-Municipality Number and other information.

### Geo Admin API Docs
- https://api3.geo.admin.ch/index.html
- https://api3.geo.admin.ch/api/examples.html
- https://api3.geo.admin.ch/services/sdiservices.html