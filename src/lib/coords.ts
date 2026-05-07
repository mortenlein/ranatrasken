import proj4 from 'proj4';

// Define the UTM 33N projection (common for Northern Norway)
// WGS84 / UTM zone 33N: EPSG:32633
const utm33n = '+proj=utm +zone=33 +ellps=WGS84 +datum=WGS84 +units=m +no_defs';
const wgs84 = 'EPSG:4326';

export function utmToLatLong(easting: number, northing: number): [number, number] {
  const [lng, lat] = proj4(utm33n, wgs84, [easting, northing]);
  return [lat, lng];
}
