# DEPLOYMENT.md: Running Ranatrasken on the ash server

Ranatrasken runs on `ash` (Linux, Tailscale `100.76.162.28`) via
`docker-compose.prod.yml` — the same per-app compose pattern as the other apps
under `~/apps`. Nothing binds 0.0.0.0.

- **Web app (tailnet)** → http://100.76.162.28:3000 (container `ranatrasken-web`)
- **Web app (public)** → https://ranatrasken.mortenlab.xyz — Cloudflare Access
  (Google SSO, house standard) at the edge → `homeassistant` tunnel →
  127.0.0.1:8096. `src/proxy.ts` re-verifies the Access JWT at the origin for
  that hostname only; tailnet/loopback requests are untouched. Dedicated
  Access app id `013fdd44-4a5b-43c2-8c4d-83195544722e`; `CF_ACCESS_*` env in
  `.env`. See `~/claude-sessions/cloudflare-access-onboarding.md`.
- **Metro/Expo dev server (tailnet only)** → exp://100.76.162.28:8082
  (container `ranatrasken-metro`; port **8082**, not 8081 — another project's
  Metro owns 8081 on ash)

Deploy / redeploy (also rebuilds after `git pull` or an .env change — the
MapTiler key is inlined at image build time):

```bash
cd ~/apps/ranatrasken
docker compose -f docker-compose.prod.yml up -d --build
```

The web container runs `prisma migrate deploy` on start; the SQLite file lives
in `./data/prod.db` on the host (bind-mounted, gitignored). Secrets live in
`.env` / `mobile/.env` (chmod 600, gitignored).

---

Original handoff notes from the Windows dev machine (2026-08-02), updated
where the ash setup diverges:

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
   (`AUTH_TRUST_HOST=true` is set in compose — required for next-auth v5 on
   plain HTTP at a non-localhost host.)
2. **DNT trail overlay + CORS** — ~~fix tracked in TASK.md id 27~~ **done**:
   the web map now loads DNT tiles from the same-origin proxy
   `/api/dnt-tiles/{z}/{x}/{y}` (a Next route handler that fetches
   `cdn.dnt.org` server-side), so the CDN's CORS whitelist (`ut.no`,
   `localhost`) no longer matters for any deployed origin. The mobile WebView
   keeps hitting the CDN directly via its `baseUrl: 'http://localhost'` trick
   (`generateCustomStyle`'s `dntTilesUrl` param defaults to the CDN).
3. **SQLite** — `DATABASE_URL` points at a file; keep it on persistent storage.
4. **Admin curation API** only works with `NODE_ENV=development` by design (it
   writes `src/data/routes.json` in the checkout).

## Mobile dev server (Expo Go over the tailnet)

Runs as the `metro` service in `docker-compose.prod.yml` (the repo is
bind-mounted, so edits on the host hot-reload as usual):

```bash
docker compose -f docker-compose.prod.yml up -d metro
docker logs -f ranatrasken-metro   # QR code + status
```

Then Expo Go on the phone connects to `exp://100.76.162.28:8082` from anywhere
on the tailnet (`npx qrcode "exp://100.76.162.28:8082"` prints a QR too).
Port is 8082 because another project's Metro holds 8081 on ash.

The mobile map WebView already works around the DNT CORS whitelist by using
`baseUrl: 'http://localhost'` — no server-side proxy needed for mobile.

## Regenerating footpaths

`node scripts/build-routes.mjs` rebuilds `src/data/routes.json` from Kartverket
Turrutebasen + OSM (inputs auto-download and cache under `temp/`). It keeps
existing entries unless `--force`, and skips destinations with broken dataset
rows — the specific rows and what is wrong with them are listed in TASK.md id 24.

## Current state (2026-08-02, deployed on ash)

- Web + Metro run under docker compose on ash, tailnet-only (see top of file).
- DNT tile proxy (TASK.md id 27) implemented and live.
- 8 of 19 destinations have real curated footpaths; the rest are blocked on
  dataset fixes (TASK.md id 24), not on tooling.
- Web app verified end-to-end (see `.claude/skills/running-the-app/SKILL.md`
  for the launch/drive recipe — note its browser-automation specifics are for
  the old Windows machine).
- Mobile v1 (read-only) verified: Android bundle exports, map page + RN bridge
  tested in a browser at phone size. Stampcard in mobile is phase 2 (TASK.md
  id 26) and needs this deployment plus real auth.
