// Builds the self-contained HTML page the DioramaMap WebView renders: the
// same MapLibre GL JS diorama the web app uses, driven from React Native via
// window.__cmd(...) and reporting marker taps back through postMessage.

// Relative imports reach into the web app's source tree; see metro.config.js.
import { generateCustomStyle, INITIAL_VIEW } from '../../../src/lib/mapStyle';
import { destinations, difficultyMeta } from '../../../src/data/destinations';

const MAPLIBRE_VERSION = '5.24.0'; // keep in step with the web app's maplibre-gl

export function buildMapHtml(maptilerKey: string): string {
  const style = generateCustomStyle('outdoor-v2', maptilerKey);
  const markers = destinations.map((d) => ({
    id: d.id,
    name: d.name,
    lng: d.lng,
    lat: d.lat,
    color: difficultyMeta[d.difficulty].color,
    parking: d.parking ? { lng: d.parking.lng, lat: d.parking.lat } : null,
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="preconnect" href="https://api.maptiler.com" crossorigin="anonymous" />
<link rel="preconnect" href="https://cdn.dnt.org" crossorigin="anonymous" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #1a2332; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var STYLE = ${JSON.stringify(style)};
  var MARKERS = ${JSON.stringify(markers)};
  var VIEW = ${JSON.stringify(INITIAL_VIEW)};

  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };

  var map = new maplibregl.Map({
    container: 'map',
    style: STYLE,
    center: VIEW.center,
    zoom: VIEW.zoom,
    pitch: VIEW.pitch,
    bearing: VIEW.bearing,
    maxPitch: VIEW.maxPitch,
    attributionControl: { compact: true },
    // 3x-DPI phones would render 9x the pixels of a laptop for the same view;
    // capping at 2 halves the GPU load with no visible quality loss on a map.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
  });

  // Markers as GL layers instead of DOM elements — DOM markers get
  // re-positioned with the CPU every frame, which is what makes 3D panning
  // jerky inside a WebView. Circles/icons render on the GPU with the map.
  map.on('load', function () {
    var destFeatures = MARKERS.map(function (m) {
      return { type: 'Feature', properties: { id: m.id, color: m.color },
               geometry: { type: 'Point', coordinates: [m.lng, m.lat] } };
    });
    var parkingFeatures = MARKERS.filter(function (m) { return m.parking; }).map(function (m) {
      return { type: 'Feature', properties: { id: m.id },
               geometry: { type: 'Point', coordinates: [m.parking.lng, m.parking.lat] } };
    });
    map.addSource('dest-points', { type: 'geojson', data: { type: 'FeatureCollection', features: destFeatures } });
    map.addSource('parking-points', { type: 'geojson', data: { type: 'FeatureCollection', features: parkingFeatures } });

    // Invisible fat circles first = comfortable tap targets under the dots.
    map.addLayer({ id: 'dest-hit', type: 'circle', source: 'dest-points',
      paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0 } });
    map.addLayer({ id: 'dest-dots', type: 'circle', source: 'dest-points',
      paint: {
        'circle-radius': 8,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-pitch-alignment': 'viewport'
      } });

    // The style has no glyphs endpoint, so text-field can't render text —
    // draw a parking badge with canvas primitives (emoji would depend on the
    // device's emoji font) and use it as an icon.
    var pCanvas = document.createElement('canvas');
    pCanvas.width = 48; pCanvas.height = 48;
    var ctx = pCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(0, 0, 48, 48, 12); ctx.fill(); }
    else ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = '#1b6ac9';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(3, 3, 42, 42, 10); ctx.fill(); }
    else ctx.fillRect(3, 3, 42, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 24, 25);
    map.addImage('parking-icon', ctx.getImageData(0, 0, 48, 48), { pixelRatio: 2 });
    map.addLayer({ id: 'parking-icons', type: 'symbol', source: 'parking-points',
      layout: { 'icon-image': 'parking-icon', 'icon-allow-overlap': true } });

    map.on('click', function (e) {
      var hits = map.queryRenderedFeatures(e.point, { layers: ['dest-hit', 'parking-icons'] });
      if (hits.length && hits[0].properties && typeof hits[0].properties.id === 'number') {
        post({ type: 'select', id: hits[0].properties.id });
      }
    });

    post({ type: 'ready' });
  });

  // Commands from React Native (sent via injectJavaScript)
  window.__cmd = function (cmd) {
    try {
      if (cmd.type === 'flyTo') {
        map.flyTo({ center: cmd.center, zoom: 14, pitch: 60, bearing: -20, essential: true, speed: 1.2 });
      } else if (cmd.type === 'route') {
        var src = map.getSource('selected-route');
        if (!src) return;
        if (cmd.geometry) {
          src.setData({ type: 'Feature', properties: {}, geometry: cmd.geometry });
          map.setLayoutProperty('selected-route-line', 'visibility', 'visible');
        } else {
          map.setLayoutProperty('selected-route-line', 'visibility', 'none');
        }
      }
    } catch (err) {
      post({ type: 'error', message: String(err) });
    }
  };

  map.on('error', function (e) {
    // Tile 403s (missing MapTiler key) are noisy but non-fatal; report once-ish.
    post({ type: 'maperror', message: e && e.error ? String(e.error.message || e.error) : 'unknown' });
  });
</script>
</body>
</html>`;
}
