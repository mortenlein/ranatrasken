# DEPLOYMENT.md: Running Ranatrasken on the ash server

Handoff notes for setting up on `ash` (Linux, Tailscale `100.76.162.28`). Written
2026-08-02 when development moved off the Windows dev machine. Goal: host both
the **web app** and the **Expo/Metro dev server** on ash, reachable over the
tailnet (the phone `pixel-9-pro-xl` is on the same tailnet).

## One-time setup

```bash
git clone https://github.com/mortenlein/ranatrasken.git && cd ranatrasken
npm install
cp .env.example .env        # fill in: NEXT_PUBLIC_MAPTILER_KEY, AUTH_SECRET (npx auth secret), DATABASE_URL
npx prisma migrate deploy
cd mobile && npm install && cp .env.example .env   # fill in EXPO_PUBLIC_MAPTILER_KEY
```

Node 20+ required (repo was last run on Node 24).

## Web app

Dev: `npm run dev` → http://ash:3000 over the tailnet.
Prod: `npm run build && npm run start` (NEXT_PUBLIC_* vars are inlined at
**build** time — the MapTiler key must be in `.env` before building).

Known constraints before exposing beyond the tailnet:

1. **Auth is demo-grade** — the credentials provider auto-creates a user from
   any email. Tailnet-only is fine; swap in a real provider before public use.
2. **DNT trail overlay + CORS** — `cdn.dnt.org` tiles only send CORS headers to
   a whitelist (`https://ut.no`, `https://www.ut.no`, `http://localhost`,
   `http://localhost:3000`). Any other origin (e.g. `http://ash:3000`) loses the
   red DNT overlay. Fix tracked in TASK.md id 27: proxy the tiles through a
   Next route handler and point the `dnt-paths` source in `src/lib/mapStyle.ts`
   at the proxy. Curated blue footpaths are unaffected (bundled GeoJSON).
3. **SQLite** — `DATABASE_URL` points at a file; keep it on persistent storage.
4. **Admin curation API** only works with `NODE_ENV=development` by design (it
   writes `src/data/routes.json` in the checkout).

## Mobile dev server (Expo Go over the tailnet)

```bash
cd mobile
REACT_NATIVE_PACKAGER_HOSTNAME=100.76.162.28 npx expo start --go
```

Then Expo Go on the phone connects to `exp://100.76.162.28:8081` from anywhere
on the tailnet (QR is printed in the terminal; `npx qrcode "exp://100.76.162.28:8081"`
prints one too). Port 8081 must be open to the tailscale interface.

The mobile map WebView already works around the DNT CORS whitelist by using
`baseUrl: 'http://localhost'` — no server-side proxy needed for mobile.

## Regenerating footpaths

`node scripts/build-routes.mjs` rebuilds `src/data/routes.json` from Kartverket
Turrutebasen + OSM (inputs auto-download and cache under `temp/`). It keeps
existing entries unless `--force`, and skips destinations with broken dataset
rows — the specific rows and what is wrong with them are listed in TASK.md id 24.

## Current state (2026-08-02)

- 8 of 19 destinations have real curated footpaths; the rest are blocked on
  dataset fixes (TASK.md id 24), not on tooling.
- Web app verified end-to-end (see `.claude/skills/running-the-app/SKILL.md`
  for the launch/drive recipe — note its browser-automation specifics are for
  the old Windows machine).
- Mobile v1 (read-only) verified: Android bundle exports, map page + RN bridge
  tested in a browser at phone size. Stampcard in mobile is phase 2 (TASK.md
  id 26) and needs this deployment plus real auth.
