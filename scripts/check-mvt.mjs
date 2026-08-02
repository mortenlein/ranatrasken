// Quick look inside a DNT vector tile: lists layers and a sample feature.
// Usage: node scripts/check-mvt.mjs [z x y]   (defaults to a Mo i Rana tile)

import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';

const [z = 12, x = 2209, y = 1029] = process.argv.slice(2).map(Number);
const url = `https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5/${z}/${x}/${y}.pbf`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status} for ${url}`);
  process.exit(1);
}
const tile = new VectorTile(new Pbf(Buffer.from(await res.arrayBuffer())));
console.log(`Layers in ${z}/${x}/${y}:`, Object.keys(tile.layers));
for (const [name, layer] of Object.entries(tile.layers)) {
  const sample = layer.length ? JSON.stringify(layer.feature(0).properties) : '(empty)';
  console.log(`  ${name}: ${layer.length} features, e.g. ${sample}`);
}
