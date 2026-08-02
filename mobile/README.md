# Ranatrasken mobile (Expo)

The Android/iOS companion app. Read-only v1: the 3D diorama map with curated
footpaths, the destination list with difficulty/child-suitability filters, and
per-destination details with driving directions. The stampcard stays web-only
until the backend has a public deployment and real auth.

## How it works

- The map is the **same MapLibre GL JS diorama as the web app**, rendered in a
  WebView (Expo Go cannot run native MapLibre). `src/lib/map-html.ts` builds the
  page from the shared style module and `src/components/diorama-map.tsx` drives
  it (`flyTo` / route display) and receives marker taps.
- Style, destinations, and curated routes are imported directly from the web
  app's source tree (`../src/lib/mapStyle.ts`, `../src/data/*`) — one source of
  truth; `metro.config.js` widens Metro's watch scope to the repo root for this.
- The WebView uses `baseUrl: 'http://localhost'` because the DNT trail tile
  CDN only answers CORS for whitelisted origins, and that one is on the list.

## Run it

```bash
npm install
cp .env.example .env   # paste your MapTiler key into EXPO_PUBLIC_MAPTILER_KEY
npx expo start
```

Scan the QR code with the Expo Go app ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
[iOS](https://apps.apple.com/app/expo-go/id982107779)) on a phone on the same
network. Without a MapTiler key the basemap/terrain are missing (brown box) but
trails, routes, and markers still render.

Checks: `npx expo lint` and `npx tsc --noEmit`.
