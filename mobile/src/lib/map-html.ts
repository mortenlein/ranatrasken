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
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #1a2332; }
  .parking-marker { font-size: 18px; }
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
    attributionControl: { compact: true }
  });

  MARKERS.forEach(function (m) {
    var marker = new maplibregl.Marker({ color: m.color })
      .setLngLat([m.lng, m.lat])
      .addTo(map);
    marker.getElement().addEventListener('click', function (e) {
      e.stopPropagation();
      post({ type: 'select', id: m.id });
    });
    if (m.parking) {
      var el = document.createElement('div');
      el.className = 'parking-marker';
      el.textContent = '🅿️';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        post({ type: 'select', id: m.id });
      });
      new maplibregl.Marker({ element: el }).setLngLat([m.parking.lng, m.parking.lat]).addTo(map);
    }
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

  map.on('load', function () { post({ type: 'ready' }); });
  map.on('error', function (e) {
    // Tile 403s (missing MapTiler key) are noisy but non-fatal; report once-ish.
    post({ type: 'maperror', message: e && e.error ? String(e.error.message || e.error) : 'unknown' });
  });
</script>
</body>
</html>`;
}
