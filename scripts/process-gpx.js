const fs = require('fs');
const path = require('path');

const gpxDir = path.join(__dirname, '../temp/gpx');
const outputFile = path.join(__dirname, '../src/data/routes.json');

// Ensure the routes.json file starts with an empty object if it doesn't exist
if (!fs.existsSync(gpxDir)) {
  console.error(`Directory not found: ${gpxDir}`);
  process.exit(1);
}

const files = fs.readdirSync(gpxDir).filter(f => f.endsWith('.gpx') || f.endsWith('.xml'));
const routes = {};

console.log(`Looking for GPX files in ${gpxDir}...`);

files.forEach(file => {
  // Look for a number at the start of the filename (e.g. "1-andfjellet.gpx" or "1.gpx")
  const idMatch = file.match(/^(\d+)/);
  if (!idMatch) {
    console.warn(`[SKIP] ${file}: Filename must start with the destination ID (e.g., "1.gpx")`);
    return;
  }
  const destId = parseInt(idMatch[1], 10);
  
  const content = fs.readFileSync(path.join(gpxDir, file), 'utf-8');
  
  // Regex to extract coordinates: <trkpt lat="66.123" lon="14.123">
  const regex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/g;
  let match;
  const coordinates = [];
  
  while ((match = regex.exec(content)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    // GeoJSON uses [longitude, latitude]
    coordinates.push([lon, lat]);
  }
  
  if (coordinates.length > 0) {
    routes[destId] = {
      type: 'Feature',
      properties: { id: destId },
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };
    console.log(`[OK]   ${file} -> Destination ID: ${destId} (${coordinates.length} points)`);
  } else {
    console.warn(`[WARN] ${file}: No valid <trkpt> coordinates found.`);
  }
});

fs.writeFileSync(outputFile, JSON.stringify(routes));
console.log(`\nSuccess! Extracted ${Object.keys(routes).length} routes and saved to ${outputFile}`);
