// Same-origin proxy for the DNT trail tiles (TASK.md id 27). cdn.dnt.org only
// sends CORS headers to a whitelist of origins (ut.no, localhost), so any
// deployed origin loses the red trail overlay unless the browser can fetch the
// tiles from the app's own origin.
const DNT_CDN_BASE = 'https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params;

  if (![z, x, y].every((v) => /^\d{1,7}$/.test(v))) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  const upstream = await fetch(`${DNT_CDN_BASE}/${z}/${x}/${y}.pbf`, {
    cache: 'no-store',
  });

  // Missing tiles are normal (sparse coverage, z > 12); tell MapLibre "empty".
  if (upstream.status === 404 || upstream.status === 204) {
    return new Response(null, { status: 204 });
  }
  if (!upstream.ok) {
    return new Response(null, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/x-protobuf',
      // The v5 tileset is effectively immutable; let browsers cache for a day.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
