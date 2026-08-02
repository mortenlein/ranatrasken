// The Rana diorama map style, shared verbatim by the web app (MapComponent)
// and the mobile app (mobile/, which runs it inside a WebView). Keep this
// module framework-free: no React, no maplibre-gl, no process.env.

// Relative imports (not the '@/' alias) so the mobile app's Metro bundler can
// consume this file too — mobile/ maps '@/' to its own source tree.
import type { Feature, Geometry } from 'geojson';
import { destinations, Destination } from '../data/destinations';
import routesData from '../data/routes.json';

// Cast the imported JSON to a Record<string, Feature>
export const curatedRoutes = routesData as Record<string, Feature>;

// A parking->summit straight line is only an acceptable stand-in for a short
// walk; beyond this it is more likely a data-entry error than a route.
const MAX_FALLBACK_LINE_KM = 5;

const fallbackDistanceKm = (dest: Destination) => {
  if (!dest.parking) return Infinity;
  const dLat = (dest.lat - dest.parking.lat) * Math.PI / 180;
  const dLng = (dest.lng - dest.parking.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(dest.parking.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Curated footpath if we have one, else a plausible straight fallback line.
export const routeGeometryFor = (dest: Destination): Geometry | null => {
  const curated = curatedRoutes[dest.id.toString()];
  if (curated) return curated.geometry;
  if (dest.parking && fallbackDistanceKm(dest) <= MAX_FALLBACK_LINE_KM) {
    return {
      type: 'LineString',
      coordinates: [
        [dest.parking.lng, dest.parking.lat],
        [dest.lng, dest.lat]
      ]
    };
  }
  return null;
};

// Define the bounding box for the "Rana Square" - This is the geographical extent of our active map content
export const RANA_BOX_GEOGRAPHIC = {
  minLng: 13.2, maxLng: 15.5, // Approx bounding box for Rana
  minLat: 66.0, maxLat: 66.7
};

// The camera the diorama opens with, shared so web and mobile match.
export const INITIAL_VIEW = {
  center: [14.4, 66.32] as [number, number],
  zoom: 8.8,
  pitch: 60,
  bearing: -25,
  maxPitch: 85,
};

// cdn.dnt.org only sends CORS headers to a whitelist (ut.no, localhost), so a
// deployed web origin must fetch these tiles through its own same-origin proxy
// (/api/dnt-tiles). The mobile WebView spoofs `baseUrl: 'http://localhost'` and
// can keep hitting the CDN directly, hence the parameter with this default.
export const DNT_TILES_URL = 'https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5/{z}/{x}/{y}.pbf';

// Helper to generate the custom MapLibre style with all sources and layers
export const generateCustomStyle = (
  baseMapStyleId: string,
  maptilerKey: string,
  dntTilesUrl: string = DNT_TILES_URL,
) => {
  const B = RANA_BOX_GEOGRAPHIC;

  // Define GeoJSON for the Rana polygon outline
  const ranaPolygonGeoJSON = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [B.minLng, B.minLat],
        [B.maxLng, B.minLat],
        [B.maxLng, B.maxLat],
        [B.minLng, B.maxLat],
        [B.minLng, B.minLat]
      ]]
    }
  };

  // World Mask — covers the whole earth EXCEPT the Rana box.
  // This acts as the dark void outside the map.
  const worldMaskGeoJSON = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        // Outer ring: World bounds
        [
          [-180, -90],
          [180, -90],
          [180, 90],
          [-180, 90],
          [-180, -90]
        ],
        // Inner ring (hole): Rana Box (opposite winding)
        [
          [B.minLng, B.minLat],
          [B.minLng, B.maxLat],
          [B.maxLng, B.maxLat],
          [B.maxLng, B.minLat],
          [B.minLng, B.minLat]
        ]
      ]
    }
  };

  // Get all routes for initial setup
  const allRoutesFeatures = destinations
    .map(d => {
      const geometry = routeGeometryFor(d);
      if (geometry) {
        return {
          type: 'Feature',
          properties: { id: d.id },
          geometry
        };
      }
      return null;
    })
    .filter(f => f !== null);

  return {
    version: 8,
    name: `Rana Custom Style (${baseMapStyleId})`,
    metadata: {
      'maputnik:renderer': 'mbgljs'
    },
    // Terrain lives in the style itself so style switches keep the 3D cake.
    terrain: {
      source: 'terrain-rgb',
      exaggeration: 1.5
    },
    // Define all sources, with explicit bounds where needed
    sources: {
      'maptiler-raster': {
        type: 'raster',
        tiles: [`https://api.maptiler.com/maps/${baseMapStyleId}/256/{z}/{x}/{y}.png?key=${maptilerKey}`],
        tileSize: 256,
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
        maxzoom: 18,
        minzoom: 0,
      },
      'terrain-rgb': {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${maptilerKey}`,
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
        maxzoom: 15,
        minzoom: 0,
      },
      'dnt-paths': {
        type: 'vector',
        tiles: [dntTilesUrl],
        minzoom: 4,
        maxzoom: 12, // DNT tiles only exist up to z=12
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
      },
      'rana-square-polygon': { type: 'geojson', data: ranaPolygonGeoJSON },
      'world-mask': { type: 'geojson', data: worldMaskGeoJSON },
      'all-routes': { type: 'geojson', data: { type: 'FeatureCollection', features: allRoutesFeatures } },
      'selected-route': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } },
      'admin-route': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [] } } },
    },
    layers: [
      // 1. Background — this colors the "cliff" or sides of the cake slice!
      // Since the terrain drops to 0 at the bounds, the vertical drop shows the background.
      {
        id: 'map-background-earth',
        type: 'background',
        paint: { 'background-color': '#3e2723' } // Deep earth brown
      },

      // 2. Void Mask — covers everything outside the map at sea level.
      {
        id: 'world-void-mask',
        type: 'fill',
        source: 'world-mask',
        paint: {
          'fill-color': '#1a2332', // Dark space/void
          'fill-opacity': 1
        }
      },

      // 3. Terrain boundary outline — crisp edge at the top of the slab
      {
        id: 'cake-outline',
        type: 'line',
        source: 'rana-square-polygon',
        paint: {
          'line-color': '#3e2723',
          'line-width': 3
        }
      },

      // 3. Main MapTiler Raster Layer - sits on top of the 3D cake
      {
        id: 'maptiler-raster-layer',
        type: 'raster',
        source: 'maptiler-raster',
        paint: { 'raster-fade-duration': 100 }
      },
      // 4. DNT Official Footpaths — visible from the same zoom they become
      // clickable in the admin curation tool.
      {
        id: 'dnt-paths-glow',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 11, // Only show when zoomed in
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff0000', 'line-width': 4, 'line-opacity': 0.2 }
      },
      {
        id: 'dnt-paths-line',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e31d1d', 'line-width': 2.5, 'line-dasharray': [1.5, 0.5] }
      },
      {
        id: 'dnt-paths-hit',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': 'transparent', 'line-width': 20, 'line-opacity': 0 }
      },
      // 5. Our GeoJSON layers for routes (all, selected, admin)
      {
        id: 'all-routes-line',
        type: 'line',
        source: 'all-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#888', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.5 }
      },
      {
        id: 'selected-route-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: { 'line-color': '#007bff', 'line-width': 5, 'line-opacity': 0.8 }
      },
      {
        id: 'admin-route-line',
        type: 'line',
        source: 'admin-route',
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: { 'line-color': '#ffeb3b', 'line-width': 6, 'line-opacity': 0.9 }
      },
    ]
  };
};
