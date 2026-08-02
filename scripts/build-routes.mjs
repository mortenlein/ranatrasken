// Auto-curate footpaths for every destination from the official Norwegian
// trail network.
//
// Downloads Kartverket's Turrutebasen ("Tur- og friluftsruter", open data)
// extract for Rana kommune, welds the routes into a routable graph, then for
// each destination snaps the parking spot and the summit onto the network and
// walks the shortest trail between them. Results land in src/data/routes.json
// in the same format the admin curation tool writes, so hand-curated entries
// are kept unless --force.
//
// Trail data © Kartverket / Turrutebasen — keep the attribution in README.md
// if this data ships anywhere.
//
// Usage: node scripts/build-routes.mjs [--force] [--dest <id>]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.join(__dirname, '../src/data/routes.json');
const GPX_DIR = path.join(__dirname, '../temp/turruter');

// Turrutebasen in the Geonorge download API
const DATASET_UUID = 'd1422d17-6d95-4ef1-96ab-8af31744dd63';
const KOMMUNE = { code: '1833', name: 'Rana' };

// A trail is only used if both endpoints snap onto it within this distance;
// anything farther gets a "route the last stretch yourself" straight segment
// at most this long, which is where we draw the line for a curated path.
const SNAP_LIMIT_M = 1000;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY_DEST = args.includes('--dest') ? Number(args[args.indexOf('--dest') + 1]) : null;

// ---------------------------------------------------------------------------
// Small geo helpers
// ---------------------------------------------------------------------------

const R_EARTH = 6371000;

function haversine(a, b) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function lineLength(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += haversine(coords[i - 1], coords[i]);
  return m;
}

// Nearest point on segment ab to p, in a local meter frame (fine at city scale).
function projectOnSegment(p, a, b) {
  const kx = Math.cos((p[1] * Math.PI) / 180) * 111320; // meters per degree lng
  const ky = 110540; // meters per degree lat
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const px = ax + t * dx, py = ay + t * dy;
  return { t, distM: Math.hypot(px, py), point: [p[0] + px / kx, p[1] + py / ky] };
}

// ---------------------------------------------------------------------------
// 1. Get the Turrutebasen extract (cached under temp/turruter)
// ---------------------------------------------------------------------------

async function ensureGpx() {
  fs.mkdirSync(GPX_DIR, { recursive: true });
  const cached = fs.readdirSync(GPX_DIR).find((f) => f.endsWith('.gpx'));
  if (cached) return path.join(GPX_DIR, cached);

  console.log(`Ordering Turrutebasen extract for ${KOMMUNE.name} from nedlasting.geonorge.no...`);
  const orderRes = await fetch('https://nedlasting.geonorge.no/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: '',
      orderLines: [{
        metadataUuid: DATASET_UUID,
        areas: [{ ...KOMMUNE, type: 'kommune' }],
        formats: [{ name: 'GPX ' }], // trailing space is really in the codelist
        projections: [{ code: '4326' }],
      }],
    }),
  });
  if (!orderRes.ok) throw new Error(`Geonorge order failed: HTTP ${orderRes.status}`);
  const order = await orderRes.json();
  const file = order.files?.[0];
  if (!file?.downloadUrl) throw new Error('Geonorge order returned no downloadable file');

  const zipRes = await fetch(file.downloadUrl);
  if (!zipRes.ok) throw new Error(`download failed: HTTP ${zipRes.status}`);
  const gpx = unzipSingleFile(Buffer.from(await zipRes.arrayBuffer()));
  const out = path.join(GPX_DIR, file.name.replace(/\.zip$/i, '.gpx'));
  fs.writeFileSync(out, gpx);
  console.log(`Saved ${path.relative(process.cwd(), out)}`);
  return out;
}

// Minimal reader for the single-entry zip the Geonorge API delivers.
function unzipSingleFile(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip central directory not found');
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(dataStart, dataStart + compSize);
  return method === 0 ? data : zlib.inflateRawSync(data);
}

// ---------------------------------------------------------------------------
// 2. Parse the GPX <rte> elements into polylines
// ---------------------------------------------------------------------------

function parseGpxRoutes(gpxPath) {
  const xml = fs.readFileSync(gpxPath, 'utf-8');
  const routes = [];
  for (const [, body] of xml.matchAll(/<rte>([\s\S]*?)<\/rte>/g)) {
    const type = body.match(/<type>([^<]*)<\/type>/)?.[1] ?? '';
    const desc = body.match(/<desc>([^<]*)<\/desc>/)?.[1] ?? '';
    const coords = [];
    for (const m of body.matchAll(/<rtept\s+([^>]*?)\/?>/g)) {
      const lat = Number(m[1].match(/lat="([^"]+)"/)?.[1]);
      const lon = Number(m[1].match(/lon="([^"]+)"/)?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const prev = coords[coords.length - 1];
      // Collapse runs of vertices that quantize to the same grid cell, so a
      // densely digitized line can't fragment itself into zero-length edges.
      if (!prev || nodeKey(prev) !== nodeKey([lon, lat])) coords.push([lon, lat]);
    }
    if (coords.length >= 2) routes.push({ type, desc, coords });
  }
  return routes;
}

// ---------------------------------------------------------------------------
// 2b. Supplement with walkable ways from OpenStreetMap (© OpenStreetMap
//     contributors, ODbL) — Turrutebasen only carries registered turruter,
//     while many Ranatrasken destinations follow unregistered local paths,
//     forest roads and power-line tracks.
// ---------------------------------------------------------------------------

// Must match RANA_BOX_GEOGRAPHIC in src/components/MapComponent.tsx
const BOX = { minLng: 13.2, maxLng: 15.5, minLat: 66.0, maxLat: 66.7 };
const OSM_FILE = path.join(GPX_DIR, '..', 'osm-paths.json');

async function ensureOsm() {
  if (fs.existsSync(OSM_FILE)) return JSON.parse(fs.readFileSync(OSM_FILE, 'utf-8'));
  console.log('Fetching walkable ways from OpenStreetMap (Overpass)...');
  // Includes minor roads: rural trailhead walks legitimately follow gravel
  // access roads and power-line service tracks.
  const query =
    `[out:json][timeout:180];` +
    `way["highway"~"^(path|footway|track|bridleway|steps|cycleway|unclassified|service)$"]` +
    `(${BOX.minLat},${BOX.minLng},${BOX.maxLat},${BOX.maxLng});out geom;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let res = null;
  for (const endpoint of endpoints) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ranatrasken-build-routes/1.0 (one-off trail data build)',
      },
      body: 'data=' + encodeURIComponent(query),
    });
    if (res.ok) break;
    console.warn(`  ${endpoint} answered HTTP ${res.status}`);
  }
  if (!res?.ok) throw new Error(`Overpass request failed: HTTP ${res?.status}`);
  const json = await res.json();
  fs.writeFileSync(OSM_FILE, JSON.stringify(json));
  console.log(`Saved ${path.relative(process.cwd(), OSM_FILE)}`);
  return json;
}

function osmPolylines(json) {
  const lines = [];
  for (const el of json.elements ?? []) {
    if (el.type !== 'way' || !el.geometry) continue;
    const coords = [];
    for (const g of el.geometry) {
      const pt = [g.lon, g.lat];
      const prev = coords[coords.length - 1];
      if (!prev || nodeKey(prev) !== nodeKey(pt)) coords.push(pt);
    }
    if (coords.length >= 2) {
      lines.push({ type: `osm:${el.tags?.highway ?? 'way'}`, desc: el.tags?.name ?? '', coords });
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// 3. Weld the routes into a graph. Vertices are quantized to a ~1m grid;
//    any grid cell touched by more than one route vertex becomes a junction
//    node, and routes are split into edges at those junctions.
// ---------------------------------------------------------------------------

const nodeKey = (c) => `${Math.round(c[0] * 1e5)},${Math.round(c[1] * 1e5)}`;

function buildGraph(polylines) {
  // Count how many distinct lines touch each cell; cells shared by two or
  // more lines are junctions. (A line revisiting its own cell doesn't split —
  // same-trail arcs are handled by routeBetween directly.)
  const usage = new Map();
  for (const line of polylines) {
    const seen = new Set();
    for (const c of line.coords) {
      const k = nodeKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      usage.set(k, (usage.get(k) ?? 0) + 1);
    }
  }

  const graph = new Map(); // nodeKey -> [{ to, edge }]
  const edges = []; // { a, b, coords (a->b), lenM, bbox }
  const addEdge = (coords) => {
    const lenM = lineLength(coords);
    if (coords.length < 2) return;
    const a = nodeKey(coords[0]);
    const b = nodeKey(coords[coords.length - 1]);
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lng, lat] of coords) {
      bbox[0] = Math.min(bbox[0], lng); bbox[1] = Math.min(bbox[1], lat);
      bbox[2] = Math.max(bbox[2], lng); bbox[3] = Math.max(bbox[3], lat);
    }
    const edge = { a, b, coords, lenM, bbox };
    edges.push(edge);
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push({ to: b, edge });
    if (a !== b) graph.get(b).push({ to: a, edge });
  };

  for (const line of polylines) {
    let start = 0;
    for (let i = 1; i < line.coords.length; i++) {
      const atJunction = usage.get(nodeKey(line.coords[i])) > 1;
      if (i === line.coords.length - 1 || atJunction) {
        addEdge(line.coords.slice(start, i + 1));
        start = i;
      }
    }
  }
  return { graph, edges };
}

// The graph mixes independently digitized sources (Turrutebasen, OSM), which
// weld within themselves but rarely to each other. Label connected components
// so a route is only attempted where one component reaches both endpoints.
function labelComponents(graph, edges) {
  const comp = new Map();
  let id = 0;
  for (const start of graph.keys()) {
    if (comp.has(start)) continue;
    const stack = [start];
    comp.set(start, id);
    while (stack.length) {
      for (const { to } of graph.get(stack.pop()) ?? []) {
        if (!comp.has(to)) {
          comp.set(to, id);
          stack.push(to);
        }
      }
    }
    id++;
  }
  for (const edge of edges) edge.comp = comp.get(edge.a);
  return id;
}

// Snap a point to the nearest spot on any edge polyline, tracked per network
// component so the caller can pick a component that works for both ends.
// `best` is the overall nearest hit regardless of the limit, for reporting.
function snapToNetwork(point, edges, limitM) {
  const byComp = new Map();
  let best = null;
  const dLat = limitM / 110540;
  const dLng = limitM / (Math.cos((point[1] * Math.PI) / 180) * 111320);
  for (const edge of edges) {
    const inReach =
      point[0] >= edge.bbox[0] - dLng && point[0] <= edge.bbox[2] + dLng &&
      point[1] >= edge.bbox[1] - dLat && point[1] <= edge.bbox[3] + dLat;
    if (!inReach && best && best.distM <= limitM) continue;
    for (let i = 1; i < edge.coords.length; i++) {
      const proj = projectOnSegment(point, edge.coords[i - 1], edge.coords[i]);
      if (!best || proj.distM < best.distM) {
        best = { edge, segIdx: i - 1, t: proj.t, point: proj.point, distM: proj.distM };
      }
      if (proj.distM > limitM) continue;
      const cur = byComp.get(edge.comp);
      if (!cur || proj.distM < cur.distM) {
        byComp.set(edge.comp, { edge, segIdx: i - 1, t: proj.t, point: proj.point, distM: proj.distM });
      }
    }
  }
  return { byComp, best };
}

// Distance from edge start (coords[0]) to a snap location along the polyline,
// plus the partial coordinate list up to it.
function splitAtSnap(edge, snap) {
  const head = edge.coords.slice(0, snap.segIdx + 1);
  head.push(snap.point);
  const tail = [snap.point, ...edge.coords.slice(snap.segIdx + 1)];
  return { head, tail, headLen: lineLength(head), tailLen: lineLength(tail) };
}

// Shortest path over the trail graph between two snapped locations.
// Returns the full coordinate list from snapA to snapB, or null.
function routeBetween(graph, snapA, snapB) {
  // Same edge: the direct arc along that trail is a candidate; the graph may
  // still offer a shorter way around, so it competes with Dijkstra below.
  let sameEdgeDirect = null;
  if (snapA.edge === snapB.edge) {
    const [s1, s2] = snapA.segIdx < snapB.segIdx || (snapA.segIdx === snapB.segIdx && snapA.t <= snapB.t)
      ? [snapA, snapB] : [snapB, snapA];
    const coords = [s1.point, ...snapA.edge.coords.slice(s1.segIdx + 1, s2.segIdx + 1), s2.point];
    const ordered = s1 === snapA ? coords : [...coords].reverse();
    sameEdgeDirect = { coords: ordered, lenM: lineLength(coords) };
  }

  const splitA = splitAtSnap(snapA.edge, snapA);
  const splitB = splitAtSnap(snapB.edge, snapB);

  // Dijkstra seeded at the two endpoints of snapA's edge. entrySide remembers
  // which half of the split edge reached an endpoint (they can be the same
  // node when the trail is a loop).
  const dist = new Map();
  const prev = new Map(); // nodeKey -> { from, via } | null for a seed
  const entrySide = new Map();
  const heap = [];
  const heapPush = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p].d <= heap[i].d) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].d < heap[m].d) m = l;
        if (r < heap.length && heap[r].d < heap[m].d) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const push = (key, d, from, via) => {
    if (d >= (dist.get(key) ?? Infinity)) return false;
    dist.set(key, d);
    prev.set(key, from ? { from, via } : null);
    heapPush({ key, d });
    return true;
  };
  if (push(snapA.edge.a, splitA.headLen, null, null)) entrySide.set(snapA.edge.a, 'head');
  if (push(snapA.edge.b, splitA.tailLen, null, null)) entrySide.set(snapA.edge.b, 'tail');

  while (heap.length) {
    const { key, d } = heapPop();
    if (d > (dist.get(key) ?? Infinity)) continue;
    for (const { to, edge } of graph.get(key) ?? []) {
      push(to, d + edge.lenM, key, edge);
    }
  }

  const viaA = dist.get(snapB.edge.a) ?? Infinity;
  const viaB = dist.get(snapB.edge.b) ?? Infinity;
  const graphBest = Math.min(viaA + splitB.headLen, viaB + splitB.tailLen);
  const best = Math.min(graphBest, sameEdgeDirect?.lenM ?? Infinity);
  if (!Number.isFinite(best)) return null;
  if (sameEdgeDirect && sameEdgeDirect.lenM <= graphBest) return sameEdgeDirect;

  // Walk the node chain back from snapB's cheaper exit node.
  const exitViaHead = viaA + splitB.headLen <= viaB + splitB.tailLen;
  const endNode = exitViaHead ? snapB.edge.a : snapB.edge.b;
  const nodeChain = [];
  for (let k = endNode; ; k = prev.get(k).from) {
    nodeChain.push(k);
    if (!prev.get(k)) break;
  }
  nodeChain.reverse();

  // Assemble: snap -> first node along the split entry edge, whole middle
  // edges, then last node -> snap along the split exit edge.
  // splitA.head runs a->snap and splitA.tail runs snap->b.
  const coords = entrySide.get(nodeChain[0]) === 'head' ? [...splitA.head].reverse() : [...splitA.tail];
  for (let i = 1; i < nodeChain.length; i++) {
    const { via } = prev.get(nodeChain[i]);
    const seg = via.a === nodeChain[i - 1] ? via.coords : [...via.coords].reverse();
    coords.push(...seg.slice(1));
  }
  const closing = exitViaHead ? splitB.head.slice(1) : [...splitB.tail].reverse().slice(1);
  coords.push(...closing);
  return { coords, lenM: lineLength(coords) };
}

// ---------------------------------------------------------------------------
// 4. Route every destination and write routes.json
// ---------------------------------------------------------------------------

async function main() {
  // Load the destination list without a TS toolchain: the coordinates live in
  // the app's TypeScript dataset, so re-derive them from the source file.
  const { destinations } = await import('./lib/destinations-node.mjs');

  const gpxPath = await ensureGpx();
  const kartverket = parseGpxRoutes(gpxPath);
  const osm = osmPolylines(await ensureOsm());
  const polylines = [...kartverket, ...osm];
  const { graph, edges } = buildGraph(polylines);
  const nComponents = labelComponents(graph, edges);
  const totalKm = polylines.reduce((s, l) => s + lineLength(l.coords), 0) / 1000;
  console.log(
    `Trail network: ${kartverket.length} Turrutebasen routes + ${osm.length} OSM ways, ` +
    `${totalKm.toFixed(0)} km -> ${edges.length} graph edges, ${graph.size} nodes, ${nComponents} components\n`
  );

  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf-8') || '{}'); } catch { /* start fresh */ }

  const results = { ...existing };
  for (const dest of destinations) {
    if (ONLY_DEST !== null && dest.id !== ONLY_DEST) continue;
    const label = `#${dest.id} ${dest.name}`;
    // Two rows sharing summit coordinates means one borrowed them as a
    // placeholder; trust the row whose parking is nearest to the summit.
    const twin = destinations.find((d) => d.id !== dest.id && d.utmE === dest.utmE && d.utmN === dest.utmN);
    if (twin) {
      const bee = (d) => (d.parking ? haversine([d.parking.lng, d.parking.lat], [d.lng, d.lat]) : Infinity);
      const mine = bee(dest), theirs = bee(twin);
      if (mine > theirs || (mine === theirs && dest.id > twin.id)) {
        console.log(`${label}: same coordinates as #${twin.id} ${twin.name}, which fits them better — dataset needs fixing -> skipped`);
        continue;
      }
    }
    if (existing[dest.id] && !FORCE) {
      console.log(`${label}: kept existing curated route`);
      continue;
    }
    if (!dest.parking) {
      console.log(`${label}: no parking spot -> skipped`);
      continue;
    }
    const parking = [dest.parking.lng, dest.parking.lat];
    const summit = [dest.lng, dest.lat];
    const beeline = haversine(parking, summit);
    if (beeline < 100) {
      console.log(`${label}: parking and summit are the same point — dataset needs fixing -> skipped`);
      continue;
    }

    const snapsP = snapToNetwork(parking, edges, SNAP_LIMIT_M);
    const snapsS = snapToNetwork(summit, edges, SNAP_LIMIT_M);

    // Try every network component that reaches both endpoints. Off-trail
    // connector meters count 4x when comparing plans: a longer real trail
    // beats a shortcut that is mostly straight-line guesswork.
    let plan = null;
    for (const [comp, sp] of snapsP.byComp) {
      const ss = snapsS.byComp.get(comp);
      if (!ss) continue;
      const route = routeBetween(graph, sp, ss);
      if (!route) continue;
      const connectors = sp.distM + ss.distM;
      if (connectors > Math.max(200, route.lenM)) continue; // barely a trail route
      const total = route.lenM + connectors;
      const score = route.lenM + 4 * connectors;
      if (!plan || score < plan.score) plan = { route, sp, ss, total, score };
    }

    if (!plan) {
      const p = snapsP.best ? `${snapsP.best.distM.toFixed(0)}m` : 'n/a';
      const s = snapsS.best ? `${snapsS.best.distM.toFixed(0)}m` : 'n/a';
      console.log(`${label}: off-network (nearest trail: parking ${p}, summit ${s}, beeline ${(beeline / 1000).toFixed(1)}km) -> fallback line kept`);
      continue;
    }
    if (plan.total > beeline * 4 + 1000) {
      console.log(`${label}: trail route is a ${(plan.total / 1000).toFixed(1)}km detour for a ${(beeline / 1000).toFixed(1)}km beeline — not credible -> fallback line kept`);
      continue;
    }

    const coords = [];
    if (plan.sp.distM > 5) coords.push(parking);
    coords.push(...plan.route.coords);
    if (plan.ss.distM > 5) coords.push(summit);

    results[dest.id] = {
      type: 'Feature',
      properties: { id: dest.id, curatedBy: 'build-routes', lengthM: Math.round(plan.total) },
      geometry: { type: 'LineString', coordinates: coords.map(([lng, lat]) => [+lng.toFixed(6), +lat.toFixed(6)]) },
    };
    const snapInfo = `snap parking ${plan.sp.distM.toFixed(0)}m, summit ${plan.ss.distM.toFixed(0)}m`;
    console.log(`${label}: OK — ${(plan.total / 1000).toFixed(1)}km trail (${snapInfo}, beeline ${(beeline / 1000).toFixed(1)}km)`);
  }

  fs.writeFileSync(ROUTES_FILE, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${Object.keys(results).length} routes to ${path.relative(process.cwd(), ROUTES_FILE)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
