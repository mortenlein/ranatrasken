# TASK.md: Ranatrasken Development Tasks

## Active Tasks
- [ ] Add remaining 10 of 30 destinations (data entry). <!-- id: 16 -->
- [ ] Fix placeholder rows in destinations.ts, then re-run `node scripts/build-routes.mjs` to pick up their footpaths: <!-- id: 24 -->
      #5 Fingerlia, #28 Svarttjønna, #29 Vindskjermen, #30 Østerdalsknabben (parking == summit coords);
      #27 Storvarden (summit coords duplicated from #25 Storhaugen);
      #4 Bjørnhaugen, #8 Granneset, #16 Lapplia (parking coords point to the wrong place entirely);
      #11 Sauvasshytta, #13 Klokkerhagen (no parking coords).
- [ ] Replace mock English translations with real translations. <!-- id: 17 -->

## Pending
- [ ] Optimize image assets and route loading (Phase 3). <!-- id: 13 -->
- [ ] Offline caching for map tiles/route data (Phase 3). <!-- id: 12 -->
- [ ] Mobile phase 2: stampcard in the app (needs a deployed backend + real auth,
      replacing the demo credentials provider). <!-- id: 26 -->

## Completed
- [x] Mobile-friendly pass (web + Expo map): web sidebar became a true overlay drawer
      (before, the hidden sidebar kept its 400px flex slot — on phones the map got a
      ~60px sliver and the close button sat off-screen at left:412px); map is now
      full-bleed, drawer starts closed on <=768px viewports, selecting a trip closes
      it and shows a bottom info card over the map. Expo WebView map: DOM markers
      replaced with GL circle/icon layers (canvas-drawn P badge — style has no glyphs
      endpoint, so no text layers), pixelRatio capped at 2, preconnect hints.
      <!-- id: 29 -->
- [x] Map tile/terrain performance pass: base map switched from 256px png to 512px webp
      MapTiler tiles (4x fewer requests, ~60% fewer bytes), terrain-rgb source inlined
      (no blocking tiles.json fetch) and capped at its real z14 (was 15 — every deep
      zoom fired failing DEM requests instead of overzooming), DNT proxy got an
      in-memory LRU cache, preconnect hint for api.maptiler.com. Shared style, so
      mobile benefits too. <!-- id: 28 -->
- [x] Proxy DNT trail tiles through our own backend: /api/dnt-tiles/[z]/[x]/[y] route
      handler fetches cdn.dnt.org server-side (same-origin for the browser, so the CORS
      whitelist no longer matters); the web map passes the proxy URL to
      generateCustomStyle, whose new optional dntTilesUrl param defaults to the CDN so
      the mobile WebView (localhost baseUrl trick) is unchanged. <!-- id: 27 -->
- [x] Architectural Review of initial file structure. <!-- id: 0 -->
- [x] Initialize Next.js project. <!-- id: 1 -->
- [x] Configure MapLibre with Kartverket Topo and MapTiler Terrain. <!-- id: 2 -->
- [x] Implement destination data structure and UTM conversion utility. <!-- id: 3 -->
- [x] Create initial dataset with Ranatrasken destinations. <!-- id: 4 -->
- [x] Build landing page with map view and sidebar. <!-- id: 5 -->
- [x] Implement parking spot coordinates for destinations. <!-- id: 6 -->
- [x] Setup authentication (NextAuth.js). <!-- id: 7 -->
- [x] Implement route path rendering (lines between parking and destination). <!-- id: 8 -->
- [x] Add "Digital Stamp" logic once authenticated. <!-- id: 9 -->
- [x] Implement "Difficulty assessment" logic for children (Phase 2). <!-- id: 10 -->
- [x] Add "Activity Log" view to sidebar (Phase 3). <!-- id: 11 -->
- [x] Implement a perfect "Map in a Box" effect using a fully custom MapLibre GL style object with source bounds and 3D fill-extrusion for the "cake slice," ensuring no external tile loading and free camera movement. <!-- id: 15 -->
- [x] Refine parking coordinates from text clues and add driving directions. <!-- id: 14 -->
- [x] Fix map initialization (MapComponent was missing new maplibregl.Map()). <!-- id: 19 -->
- [x] Fix CSS popup class names (mapboxgl → maplibregl). <!-- id: 20 -->
- [x] Fix TypeScript build error (parkingLatLong tuple types). <!-- id: 21 -->
- [x] Add responsive sidebar toggle for mobile. <!-- id: 22 -->
- [x] Gate admin curation panel behind auth check. <!-- id: 23 -->
- [x] Populate routes.json with curated footpaths — automated via scripts/build-routes.mjs
      (Turrutebasen + OSM shortest-path routing); 8 destinations curated, the rest are
      blocked on dataset fixes (task 24). Admin tool remains for manual overrides. <!-- id: 18 -->
- [x] Fix footpath rendering issues: terrain and selected route lost on style switch,
      DNT overlay visible from z12 but clickable from z11, absurd straight fallback
      lines for destinations with placeholder parking data. <!-- id: 25 -->
- [x] Mobile v1 (mobile/): Expo Go app for Android/iOS — shared diorama style in a
      WebView, destination list/filters/details, curated footpath display. Map style
      extracted to src/lib/mapStyle.ts and shared verbatim between web and mobile. <!-- id: 28 -->