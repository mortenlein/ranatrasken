# Ranatrasken — Digital Stampcard & Route Guide

A web app for the **Ranatrasken** hiking initiative in Rana, Norway. It renders the Rana region as an interactive 3D "map in a box" diorama and guides hikers to local destinations — with difficulty ratings, child-suitability guidance, parking spots, driving directions, and a digital stampcard for checking in at summits.

> **Status: Work in progress.** The app is functional, but the dataset is incomplete: not all curated footpath geometries have been secured yet (`src/data/routes.json` is still being populated via the built-in admin curation tool), roughly 10 of 30 destinations remain to be entered, and the English translations are placeholders. See [ROADMAP.md](ROADMAP.md) and [TASK.md](TASK.md) for current state.

## Features

- **3D diorama map** — a fully custom MapLibre GL style clips all tile sources to a bounding box around Rana, masks the rest of the world, and renders the terrain as a raised "cake slice" with 1.5× elevation exaggeration. The camera moves freely around it.
- **Hiking destinations** — each destination has coordinates (converted from UTM 33N), elevation, a four-level difficulty rating (green/blue/red/black) with child-suitability guidance, a description, and driving directions to the trailhead parking.
- **Official trail overlay** — DNT (Norwegian Trekking Association) footpath vector tiles are drawn on top of the terrain when zoomed in.
- **Digital stampcard** — signed-in users can "stamp" a destination they've visited; stamps are stored per user and shown in an activity log.
- **Admin curation tool** (development only) — admins can click DNT trail segments on the map to assemble the real footpath for a destination and save it to `routes.json`, replacing the fallback straight line from parking to summit.
- **Bilingual UI** — Norwegian (bokmål) and English. English strings are currently rough placeholders.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [MapLibre GL JS](https://maplibre.org) with a hand-built style object (no external style JSON)
- [MapTiler](https://www.maptiler.com) raster basemap + `terrain-rgb-v2` elevation tiles (free tier)
- DNT / [ut.no](https://ut.no) vector tiles for official hiking trails
- [NextAuth v5](https://authjs.dev) + [Prisma](https://www.prisma.io) + SQLite for users, sessions, and stamps
- Vanilla CSS (no UI framework)

## Getting started

Prerequisites: Node.js 20+ and a free [MapTiler API key](https://cloud.maptiler.com/account/keys/) (no credit card required).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    - paste your MapTiler key into NEXT_PUBLIC_MAPTILER_KEY
#    - generate an auth secret: npx auth secret

# 3. Create the local SQLite database
npx prisma migrate dev

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Authentication (demo-grade)

Sign-in uses a NextAuth credentials provider that **auto-creates a user from any email** — it exists so the stampcard can be demoed locally without an OAuth setup. It is not production authentication; swap in a real provider before deploying anywhere public.

The admin curation panel appears for users whose email contains `admin`, and the route-saving API only works in development mode (it writes to a source file).

## Project layout

```
src/
  app/              Pages, server actions (stamps), API routes (auth, admin save-route)
  components/       MapComponent (the diorama), ActivityLog, UserMenu, AuthProvider
  data/             destinations.ts (the dataset), routes.json (curated footpaths)
  lib/              Prisma client, UTM→WGS84 conversion, i18n context
  auth.ts           NextAuth configuration
prisma/             Schema + migrations (SQLite)
scripts/            One-off data tooling: inspect DNT vector tiles, fetch GPX from ut.no,
                    convert GPX to route GeoJSON
```

Project planning lives in [MISSION.md](MISSION.md), [ROADMAP.md](ROADMAP.md), and [TASK.md](TASK.md).

## Data sources & attribution

- Basemap and terrain tiles © [MapTiler](https://www.maptiler.com/copyright/) © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Hiking trail data © [DNT](https://www.dnt.no) / [ut.no](https://ut.no)
- Destination data compiled from the Ranatrasken initiative's published trip list

## License

[MIT](LICENSE) — applies to the code in this repository. Map tiles and trail data remain subject to their providers' terms above.
