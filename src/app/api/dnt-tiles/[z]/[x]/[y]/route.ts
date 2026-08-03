// Same-origin proxy for the DNT trail tiles (TASK.md id 27). cdn.dnt.org only
// sends CORS headers to a whitelist of origins (ut.no, localhost), so any
// deployed origin loses the red trail overlay unless the browser can fetch the
// tiles from the app's own origin.
const DNT_CDN_BASE = 'https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5';

// The tile universe the map can request is small (the source is bounded to
// the Rana box and capped at z12), so a memory cache with a modest entry cap
// absorbs nearly all repeat traffic without unbounded growth if someone
// hand-crafts URLs outside that range. ~40KB/tile worst case => cap * 40KB.
const CACHE_MAX_ENTRIES = 512;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // matches the browser Cache-Control

type CachedTile = {
  status: 200 | 204;
  body: ArrayBuffer | null;
  contentType: string;
  expiresAt: number;
};

const tileCache = new Map<string, CachedTile>();

const respond = (tile: CachedTile, cacheState: 'hit' | 'miss') =>
  tile.status === 204
    ? new Response(null, { status: 204, headers: { 'X-Tile-Cache': cacheState } })
    : new Response(tile.body, {
        status: 200,
        headers: {
          'Content-Type': tile.contentType,
          // The v5 tileset is effectively immutable; let browsers cache for a day.
          'Cache-Control': 'public, max-age=86400',
          'X-Tile-Cache': cacheState,
        },
      });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params;

  if (![z, x, y].every((v) => /^\d{1,7}$/.test(v))) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  const key = `${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    // Re-insert to mark as recently used (Map preserves insertion order).
    tileCache.delete(key);
    tileCache.set(key, cached);
    return respond(cached, 'hit');
  }
  tileCache.delete(key);

  const upstream = await fetch(`${DNT_CDN_BASE}/${key}.pbf`, {
    cache: 'no-store',
  });

  // Missing tiles are normal (sparse coverage, z > 12); tell MapLibre "empty".
  const missing = upstream.status === 404 || upstream.status === 204;
  if (!missing && !upstream.ok) {
    return new Response(null, { status: 502 });
  }

  const tile: CachedTile = missing
    ? { status: 204, body: null, contentType: '', expiresAt: Date.now() + CACHE_TTL_MS }
    : {
        status: 200,
        body: await upstream.arrayBuffer(),
        contentType: upstream.headers.get('content-type') ?? 'application/x-protobuf',
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

  if (tileCache.size >= CACHE_MAX_ENTRIES) {
    // Evict the least recently used entry (first in insertion order).
    const oldest = tileCache.keys().next().value;
    if (oldest !== undefined) tileCache.delete(oldest);
  }
  tileCache.set(key, tile);

  return respond(tile, 'miss');
}
