# TASK.md: Ranatrasken Development Tasks

## Active Tasks
- [ ] Add remaining 10 of 30 destinations (data entry). <!-- id: 16 -->
- [ ] Replace mock English translations with real translations. <!-- id: 17 -->

## Pending
- [ ] Optimize image assets and route loading (Phase 3). <!-- id: 13 -->
- [ ] Offline caching for map tiles/route data (Phase 3). <!-- id: 12 -->
- [ ] Populate routes.json with curated routes via admin tool. <!-- id: 18 -->

## Completed
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