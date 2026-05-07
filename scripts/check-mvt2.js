const fs = require('fs');
const https = require('https');
const VectorTile = require('@mapbox/vector-tile').VectorTile;
const Protobuf = require('pbf');

https.get('https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5/12/2209/1029.pbf', (res) => {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    const tile = new VectorTile(new Protobuf(buf));
    console.log("Layers in tile:", Object.keys(tile.layers));
  });
});
