// Downloads the 33 London borough boundaries from the ONS Open Geography
// Portal and bakes them into src/data/london.json for the hero map.
//
//   node scripts/fetch-london.mjs
//
// The boundaries are "BGC" — generalised to 20 m and clipped to the
// coastline, which cuts the tidal Thames out, so the river shows as a gap.
// The output is projected (equirectangular, x scaled by cos(latitude)) and
// normalised to height 1, so the browser does no geo maths.
import { writeFile } from 'node:fs/promises';

const SERVICE =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer/0/query';
const OUT = new URL('../src/data/london.json', import.meta.url);

const query = new URLSearchParams({
  where: "LAD24CD LIKE 'E09%'", // E09 = London boroughs and the City
  outFields: 'LAD24CD,LAD24NM',
  outSR: '4326',
  f: 'geojson',
});
const response = await fetch(`${SERVICE}?${query}`);
if (!response.ok) throw new Error(`ONS answered ${response.status} ${response.statusText}`);
const { features } = await response.json();
if (features?.length !== 33) throw new Error(`Expected 33 boroughs, got ${features?.length}`);

const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
let [minLon, maxLon, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
for (const f of features) {
  for (const polygon of polygonsOf(f.geometry)) {
    for (const [lon, lat] of polygon[0]) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
}
const lon0 = (minLon + maxLon) / 2;
const lat0 = (minLat + maxLat) / 2;
const kx = Math.cos((lat0 * Math.PI) / 180);
const scale = 1 / (maxLat - minLat);
const round = (v) => Math.round(v * 1e4) / 1e4;

const boroughs = features
  .map((f) => ({
    name: f.properties.LAD24NM,
    // Flat [x, y, x, y, …] per ring; y up, centred on London.
    rings: polygonsOf(f.geometry).flatMap((polygon) =>
      polygon.map((ring) => ring.flatMap(([lon, lat]) => [round((lon - lon0) * kx * scale), round((lat - lat0) * scale)])),
    ),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(
  OUT,
  `${JSON.stringify({
    source: 'ONS Open Geography Portal — Local Authority Districts (May 2024) Boundaries UK BGC',
    licence: 'Contains National Statistics data © Crown copyright and database right 2024. Contains OS data © Crown copyright and database right 2024.',
    aspect: round((maxLon - minLon) * kx * scale),
    projection: { lon0, lat0, kx, scale },
    boroughs,
  })}\n`,
);
console.log(`[london] wrote src/data/london.json — ${boroughs.length} boroughs`);
