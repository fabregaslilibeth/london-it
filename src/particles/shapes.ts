import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Geometry, Position } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import london from '../data/london.json';
import { blur, distanceField, reliefFromMask, sampleRaster, sortByHeight, type PointCloud, type Raster } from './sampler';

/**
 * The globe is the one baked shape whose dots travel: arc dots fly from
 * London to a data-centre city, so each carries both ends of its arc.
 */
export interface GlobeCloud {
  /** Point on the unit sphere — for arc dots, where the arc starts (London). */
  surface: Float32Array;
  /** Arc dots: the far end of the arc + loops per second (0 = a still trail dot). Zero for surface dots. */
  arcTo: Float32Array;
  /** Phase along the arc and the arc's height above the surface (0 = a surface dot). */
  arcMeta: Float32Array;
  luma: Float32Array;
}

export interface Shapes {
  count: number;
  /** Greater London: the 33 boroughs with the Thames cut through them. */
  map: PointCloud;
  mapAspect: number;
  /** The office, in the map's own coordinates (null if the site gave no location). */
  office: [number, number] | null;
  /** Clock dial, unit height; the hands are drawn in the shader. */
  clock: PointCloud;
  shield: PointCloud;
  shieldAspect: number;
  globe: GlobeCloud;
  /** Scattered start positions the particles swirl in from. */
  origin: Float32Array;
}

/** `office` is [lon, lat] from the site's map link. */
export function buildShapes(count: number, office: [number, number] | null): Shapes {
  const map = londonRaster(office);
  const shield = shieldRaster();
  return {
    count,
    map: sortByHeight(sampleRaster(map.raster, count, 0.05)),
    mapAspect: map.raster.width / map.raster.height,
    office: map.office,
    clock: sortByHeight(sampleRaster(clockRaster(), count, 0.03)),
    shield: sortByHeight(sampleRaster(shield, count, 0.18)),
    shieldAspect: shield.width / shield.height,
    globe: globeCloud(count),
    origin: scatter(count),
  };
}

function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/** Small seeded PRNG so baked layouts are the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RasterOptions {
  /** Share of dots a fully lit interior pixel gets, relative to an edge pixel. */
  fill: number;
  /** Extra weight on silhouette edges. */
  edge: number;
  /** How far in from the silhouette edge (px) the edge boost fades out. */
  edgeWidth: number;
  /** Blur for the bulge toward the camera; bigger = rounder. */
  relief: number;
}

/**
 * Turns a drawing into a raster for the sampler. Grey levels set how many
 * dots a pixel gets and how bright they are (white = lit detail, mid grey =
 * body, dark grey = sparse texture); silhouette edges get extra, brighter
 * dots so every shape reads as a crisp outline first.
 */
function drawingRaster(ctx: CanvasRenderingContext2D, o: RasterOptions): Raster {
  const { width: w, height: h } = ctx.canvas;
  const { data } = ctx.getImageData(0, 0, w, h);
  const n = w * h;
  const mask = new Uint8Array(n);
  const tone = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    alpha[i] = data[i * 4 + 3] / 255;
    mask[i] = alpha[i] > 0.5 ? 1 : 0;
    // Grey level (red stands in) weighted by coverage.
    tone[i] = (data[i * 4] / 255) * alpha[i];
  }
  const inside = blur(distanceField(mask, w, h), w, h, 1, 1);
  const depth = reliefFromMask(mask, w, h, false, o.relief);
  const weight = new Float32Array(n);
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (tone[i] < 0.01) continue;
    if (mask[i]) {
      const coast = 1 - Math.min(inside[i] / o.edgeWidth, 1);
      weight[i] = tone[i] * o.fill + o.edge * coast;
      luma[i] = Math.min(1, 0.28 + 0.72 * Math.max(tone[i] * 0.85, coast));
    } else {
      // Faint, half-covered pixels: anti-aliased stroke edges.
      weight[i] = tone[i] * (o.fill + o.edge) * alpha[i];
      luma[i] = 0.28 + 0.72 * tone[i];
    }
  }
  return { width: w, height: h, weight, luma, depth };
}

const LIT = '#ffffff';
const SOFT = '#bcbcbc';

/**
 * Greater London, like the reference site's map of Italy: the boroughs
 * filled with dots, the outer boundary and both banks of the Thames picked
 * out in brighter ones, faint seams between boroughs, and a bright spot on
 * the office.
 */
function londonRaster(office: [number, number] | null): { raster: Raster; office: [number, number] | null } {
  const size = 1000;
  const pad = 30;
  const W = Math.ceil(london.aspect * size) + pad * 2;
  const H = size + pad * 2;
  const ctx = canvas2d(W, H);
  const px = (x: number, y: number): [number, number] => [(x + london.aspect / 2) * size + pad, (0.5 - y) * size + pad];
  const boroughPath = (rings: number[][]) => {
    const p = new Path2D();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const [x, y] = px(ring[i], ring[i + 1]);
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.closePath();
    }
    return p;
  };

  const paths = london.boroughs.map((b) => boroughPath(b.rings));
  ctx.fillStyle = '#909090';
  for (const p of paths) ctx.fill(p, 'evenodd');
  // Borough boundaries on a canvas of their own, so they can be weighted
  // below the outer boundary and the Thames.
  const seams = canvas2d(W, H);
  seams.strokeStyle = '#fff';
  seams.lineWidth = 1.8;
  seams.lineJoin = 'round';
  for (const p of paths) seams.stroke(p);

  let officeLocal: [number, number] | null = null;
  if (office) {
    const { lon0, lat0, kx, scale } = london.projection;
    const [ox, oy] = px((office[0] - lon0) * kx * scale, (office[1] - lat0) * scale);
    ctx.fillStyle = LIT;
    ctx.beginPath();
    ctx.arc(ox, oy, 8, 0, Math.PI * 2);
    ctx.fill();
    // Same normalisation the sampler applies: centred, divided by height.
    officeLocal = [(ox - W / 2) / H, (H / 2 - oy) / H];
  }

  const raster = drawingRaster(ctx, { fill: 0.4, edge: 1.9, edgeWidth: 5, relief: 6 });
  const seamAlpha = seams.getImageData(0, 0, W, H).data;
  for (let i = 0; i < raster.weight.length; i++) {
    const seam = seamAlpha[i * 4 + 3] / 255;
    if (!seam || !raster.weight[i]) continue;
    raster.weight[i] += 0.75 * seam;
    raster.luma[i] = Math.max(raster.luma[i], 0.28 + 0.5 * seam);
  }
  return { raster, office: officeLocal };
}

const ROMAN = ['I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** A clock face in the Elizabeth Tower style: rings, ticks, Roman numerals and tracery. */
function clockRaster(): Raster {
  const S = 900;
  const C = S / 2;
  const ctx = canvas2d(S, S);
  const ring = (r: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(C, C, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(C, C, 424, 0, Math.PI * 2);
  ctx.fill();
  ring(418, LIT, 14);
  ring(392, '#b0b0b0', 3);
  ring(222, '#7a7a7a', 2.5);
  ring(122, '#5a5a5a', 1.6);

  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const hour = i % 5 === 0;
    const inner = hour ? 338 : 372;
    ctx.strokeStyle = hour ? LIT : SOFT;
    ctx.lineWidth = hour ? 11 : 3;
    ctx.beginPath();
    ctx.moveTo(C + Math.sin(a) * inner, C - Math.cos(a) * inner);
    ctx.lineTo(C + Math.sin(a) * 386, C - Math.cos(a) * 386);
    ctx.stroke();
  }
  // Gothic tracery behind the hands.
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(C + Math.sin(a) * 40, C - Math.cos(a) * 40);
    ctx.lineTo(C + Math.sin(a) * 222, C - Math.cos(a) * 222);
    ctx.stroke();
  }

  ctx.fillStyle = '#e6e6e6';
  ctx.font = '600 60px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ROMAN.forEach((numeral, i) => {
    const a = ((i + 1) / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(C + Math.sin(a) * 284, C - Math.cos(a) * 284);
    ctx.rotate(a);
    ctx.fillText(numeral, 0, 0);
    ctx.restore();
  });

  ctx.fillStyle = LIT;
  ctx.beginPath();
  ctx.arc(C, C, 16, 0, Math.PI * 2);
  ctx.fill();

  return drawingRaster(ctx, { fill: 0.4, edge: 1.3, edgeWidth: 5, relief: 8 });
}

/** A shield with a padlock at its heart. */
function shieldRaster(): Raster {
  const W = 760;
  const H = 900;
  const ctx = canvas2d(W, H);
  const outline = (scale: number) => {
    const p = new Path2D();
    const cx = 380;
    const cy = 450;
    const pt = (x: number, y: number): [number, number] => [cx + (x - cx) * scale, cy + (y - cy) * scale];
    p.moveTo(...pt(380, 48));
    p.lineTo(...pt(696, 160));
    p.lineTo(...pt(696, 420));
    p.bezierCurveTo(...pt(696, 640), ...pt(560, 796), ...pt(380, 856));
    p.bezierCurveTo(...pt(200, 796), ...pt(64, 640), ...pt(64, 420));
    p.lineTo(...pt(64, 160));
    p.closePath();
    return p;
  };

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shell = outline(1);
  ctx.fillStyle = '#1e1e1e';
  ctx.fill(shell);
  ctx.strokeStyle = LIT;
  ctx.lineWidth = 30;
  ctx.stroke(shell);
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 5;
  ctx.stroke(outline(0.86));

  // Padlock: shackle, body, keyhole.
  ctx.strokeStyle = LIT;
  ctx.lineWidth = 32;
  ctx.beginPath();
  ctx.moveTo(290, 470);
  ctx.lineTo(290, 398);
  ctx.arc(380, 398, 90, Math.PI, 0);
  ctx.lineTo(470, 470);
  ctx.stroke();
  ctx.fillStyle = '#d2d2d2';
  ctx.beginPath();
  ctx.roundRect(246, 452, 268, 236, 30);
  ctx.fill();
  ctx.strokeStyle = LIT;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#1e1e1e';
  ctx.beginPath();
  ctx.arc(380, 548, 30, 0, Math.PI * 2);
  ctx.moveTo(364, 566);
  ctx.lineTo(396, 566);
  ctx.lineTo(408, 634);
  ctx.lineTo(352, 634);
  ctx.closePath();
  ctx.fill();

  return drawingRaster(ctx, { fill: 0.36, edge: 1.5, edgeWidth: 7, relief: 14 });
}

/** Cloud regions the arcs fly to from London, as [lon, lat]. */
const DATA_CENTRES: [number, number][] = [
  [-74.0, 40.71], // New York
  [-122.42, 37.77], // San Francisco
  [-79.38, 43.65], // Toronto
  [-46.63, -23.55], // São Paulo
  [-6.26, 53.35], // Dublin
  [8.68, 50.11], // Frankfurt
  [18.07, 59.33], // Stockholm
  [28.05, -26.2], // Johannesburg
  [55.27, 25.2], // Dubai
  [72.88, 19.08], // Mumbai
  [103.82, 1.35], // Singapore
  [139.69, 35.69], // Tokyo
  [151.21, -33.87], // Sydney
];
const LONDON: [number, number] = [-0.13, 51.51];

const toUnit = ([lon, lat]: [number, number]): [number, number, number] => {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};

/** Rings of every polygon in a (Multi)Polygon / GeometryCollection. */
function ringsOf(geometry: Geometry): Position[][] {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates;
    case 'MultiPolygon':
      return geometry.coordinates.flat();
    case 'GeometryCollection':
      return geometry.geometries.flatMap(ringsOf);
    default:
      return [];
  }
}

/**
 * Adds a lon/lat ring to the current equirectangular path. Rings that cross
 * the antimeridian (Russia, Fiji) are unwrapped and drawn again one world
 * width over; rings that circle a pole (Antarctica) are closed via the pole.
 */
function traceLonLatRing(ctx: CanvasRenderingContext2D, ring: Position[], W: number, H: number): void {
  const pts: [number, number][] = [];
  let shift = 0;
  ring.forEach(([lon, lat], i) => {
    if (i > 0) {
      const prev = ring[i - 1][0];
      if (lon - prev > 180) shift -= 360;
      else if (prev - lon > 180) shift += 360;
    }
    pts.push([lon + shift, lat]);
  });
  const drift = pts[pts.length - 1][0] - pts[0][0];
  if (Math.abs(drift) > 180) {
    const pole = pts.reduce((s, p) => s + p[1], 0) < 0 ? -90 : 90;
    pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole]);
  }
  for (const offset of [-360, 0, 360]) {
    pts.forEach(([lon, lat], i) => {
      const x = ((lon + offset + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
}

/**
 * A dotted Earth for "cloud": land bright, oceans faint, the data-centre
 * cities lit, and arcs from London to each city — a dim trail plus packets
 * that fly along it (the shader moves them).
 */
function globeCloud(count: number): GlobeCloud {
  const W = 1024;
  const H = 512;
  const ctx = canvas2d(W, H);
  const topology = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topology, topology.objects.land);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const f of land.features) {
    for (const ring of ringsOf(f.geometry)) traceLonLatRing(ctx, ring, W, H);
  }
  ctx.fill('evenodd');
  const pixels = ctx.getImageData(0, 0, W, H).data;
  const isLand = (lon: number, lat: number) => {
    const x = Math.min(W - 1, Math.floor(((lon + Math.PI) / (Math.PI * 2)) * W));
    const y = Math.min(H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * H));
    return pixels[(y * W + x) * 4 + 3] > 127;
  };

  const rand = mulberry32(7);
  const surface = new Float32Array(count * 3);
  const arcTo = new Float32Array(count * 4);
  const arcMeta = new Float32Array(count * 2);
  const luma = new Float32Array(count);

  const from = toUnit(LONDON);
  const arcs = DATA_CENTRES.map((city) => {
    const to = toUnit(city);
    const angle = Math.acos(Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
    return { to, angle, height: 0.06 + 0.3 * (angle / Math.PI), speed: (0.1 + 0.05 * rand()) / Math.max(angle, 0.3) };
  });
  const totalAngle = arcs.reduce((s, a) => s + a.angle + 0.3, 0);
  const pickArc = () => {
    let target = rand() * totalAngle;
    for (const a of arcs) {
      target -= a.angle + 0.3;
      if (target <= 0) return a;
    }
    return arcs[arcs.length - 1];
  };

  const trailDots = Math.round(count * 0.08);
  const packetDots = Math.round(count * 0.06);
  const cityDots = Math.round(count * 0.03);
  const surfaceDots = count - trailDots - packetDots - cityDots;
  const landTarget = Math.round(surfaceDots * 0.74);
  let landN = 0;
  let oceanN = 0;
  let k = 0;
  while (k < surfaceDots) {
    const y = rand() * 2 - 1;
    const lon = rand() * Math.PI * 2 - Math.PI;
    const lat = Math.asin(y);
    const onLand = isLand(lon, lat);
    if (onLand ? landN >= landTarget : oceanN >= surfaceDots - landTarget) continue;
    if (onLand) landN++;
    else oceanN++;
    const r = Math.cos(lat);
    surface.set([r * Math.sin(lon), y, r * Math.cos(lon)], k * 3);
    luma[k] = onLand ? 0.62 + 0.3 * rand() : 0.08 + 0.1 * rand();
    k++;
  }
  // Cities (London included) as small bright clusters.
  const cities = [LONDON, ...DATA_CENTRES];
  for (let i = 0; i < cityDots; i++, k++) {
    const [lon, lat] = cities[i % cities.length];
    const spread = i % cities.length === 0 ? 1.6 : 1;
    const c = toUnit([lon + (rand() - 0.5) * 3 * spread, lat + (rand() - 0.5) * 2.2 * spread]);
    surface.set(c, k * 3);
    luma[k] = 0.9 + 0.1 * rand();
  }
  for (let i = 0; i < trailDots + packetDots; i++, k++) {
    const arc = pickArc();
    const packet = i >= trailDots;
    surface.set(from, k * 3);
    arcTo.set([...arc.to, packet ? arc.speed : 0], k * 4);
    // Packets travel in two short dashes per arc.
    const phase = packet ? (Math.floor(rand() * 2) + rand() * (0.04 / Math.max(arc.angle, 0.3))) / 2 : rand();
    arcMeta.set([phase, arc.height], k * 2);
    luma[k] = packet ? 0.62 : 0.3 + 0.15 * rand();
  }

  // Top-to-bottom order, like the other shapes, so morphs flow.
  const heightOf = (i: number) => {
    const h = arcMeta[i * 2 + 1];
    if (!h) return surface[i * 3 + 1];
    const t = arcMeta[i * 2];
    return (surface[i * 3 + 1] * (1 - t) + arcTo[i * 4 + 1] * t) * (1 + h);
  };
  const keys = Array.from({ length: count }, (_, i) => heightOf(i) + (rand() - 0.5) * 0.04);
  const order = Array.from({ length: count }, (_, i) => i).sort((p, q) => keys[q] - keys[p]);
  const sorted: GlobeCloud = {
    surface: new Float32Array(count * 3),
    arcTo: new Float32Array(count * 4),
    arcMeta: new Float32Array(count * 2),
    luma: new Float32Array(count),
  };
  order.forEach((src, dst) => {
    sorted.surface.set(surface.subarray(src * 3, src * 3 + 3), dst * 3);
    sorted.arcTo.set(arcTo.subarray(src * 4, src * 4 + 4), dst * 4);
    sorted.arcMeta.set(arcMeta.subarray(src * 2, src * 2 + 2), dst * 2);
    sorted.luma[dst] = luma[src];
  });
  return sorted;
}

/** A thick spherical shell around the scene, kept clear of the camera. */
function scatter(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0, l = 0;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      l = Math.hypot(x, y, z);
    } while (l === 0 || l > 1);
    const r = (2.2 + 4.3 * Math.random()) / l;
    x *= r;
    y *= r;
    z *= r;
    if (z > 1.6) z = -z;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
