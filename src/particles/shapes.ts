import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Geometry, Position } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import london from '../data/london.json';
import logoSvg from '../assets/logo.svg?raw';
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

/** Luma above this marks an amber dot (the logo's N and rules); the shader subtracts it back off. */
export const AMBER_FLAG = 2;

export interface Shapes {
  count: number;
  /** The London IT Support logo the drawn one dissolves into. Amber dots carry AMBER_FLAG in luma. */
  logo: PointCloud;
  /** Raster height ÷ the logo's own height (the raster is padded). */
  logoPad: number;
  /** Greater London: the 33 boroughs with the Thames cut through them. */
  map: PointCloud;
  mapAspect: number;
  /** The office, in the map's own coordinates (null if the site gave no location). */
  office: [number, number] | null;
  /**
   * "Protected": a dotted crystal, xyz + brightness per dot (unit radius).
   * Dots of the inner crystal and core carry INNER_FLAG in w so the shader
   * can turn them the other way. ("Always on" is built in the shader.)
   */
  crystal: Float32Array;
  globe: GlobeCloud;
}

/** `office` is [lon, lat] from the site's map link. */
export function buildShapes(count: number, office: [number, number] | null): Shapes {
  const map = londonRaster(office);
  const logo = logoCloud(count);
  return {
    count,
    logo: logo.cloud,
    logoPad: logo.pad,
    map: sortByHeight(sampleRaster(map.raster, count, 0.05)),
    mapAspect: map.raster.width / map.raster.height,
    office: map.office,
    crystal: crystalCloud(count),
    globe: globeCloud(count),
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

/**
 * The logo in dots, drawn from the same SVG as the preloader so the two line
 * up exactly. Letters are body grey with bright edges; dots on the N and
 * the rules (amber in the drawn logo) are flagged amber.
 */
function logoCloud(count: number): { cloud: PointCloud; pad: number } {
  const svg = new DOMParser().parseFromString(logoSvg, 'image/svg+xml').documentElement;
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 1321 403').split(/[\s,]+/).map(Number);
  const pad = 24;
  const W = Math.ceil(vw) + pad * 2;
  const H = Math.ceil(vh) + pad * 2;
  const ctx = canvas2d(W, H);
  const amber = canvas2d(W, H);
  for (const c of [ctx, amber]) c.translate(pad, pad);
  // A touch fattened, so dots on the thin rules' edges count too.
  amber.fillStyle = amber.strokeStyle = '#fff';
  amber.lineWidth = 2;
  for (const el of Array.from(svg.querySelectorAll('path, rect'))) {
    const shape = new Path2D();
    if (el.tagName === 'rect') {
      const n = (attr: string) => Number(el.getAttribute(attr) ?? 0);
      shape.rect(n('x'), n('y'), n('width'), n('height'));
    } else {
      shape.addPath(new Path2D(el.getAttribute('d') ?? ''));
    }
    const isN = el.classList.contains('logo__n');
    ctx.fillStyle = isN ? '#d8d8d8' : '#a0a0a0';
    ctx.fill(shape);
    if (isN || el.tagName === 'rect') {
      amber.fill(shape);
      amber.stroke(shape);
    }
  }

  const raster = drawingRaster(ctx, { fill: 0.5, edge: 1.5, edgeWidth: 3, relief: 4 });
  const cloud = sortByHeight(sampleRaster(raster, count, 0.04));
  // Flag the amber dots (back from normalised to pixel coords).
  const mask = amber.getImageData(0, 0, W, H).data;
  for (let i = 0; i < count; i++) {
    const px = Math.min(W - 1, Math.max(0, Math.floor(cloud.positions[i * 3] * H + W / 2)));
    const py = Math.min(H - 1, Math.max(0, Math.floor(H / 2 - cloud.positions[i * 3 + 1] * H)));
    if (mask[(py * W + px) * 4 + 3] > 127) cloud.luma[i] = Math.max(cloud.luma[i], 0.9) + AMBER_FLAG;
  }
  return { cloud, pad: H / vh };
}

/** Marks the crystal's inner layer (inner crystal and core) in its w. */
export const INNER_FLAG = 2;

/**
 * "Protected", without a padlock: a crystal of dots. An icosahedron's edges
 * and vertices in bright dots, its faces faintly filled, around a smaller
 * one and a soft core that turn the other way.
 */
function crystalCloud(count: number): Float32Array {
  const rand = mulberry32(11);
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map((v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return v.map((c) => c / l);
  });
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Neighbours sit ~1.05 apart on the unit sphere; the next nearest ~1.7.
  const near = (i: number, j: number) => dist(verts[i], verts[j]) < 1.2;
  const edges: [number, number][] = [];
  const faces: [number, number, number][] = [];
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      if (!near(i, j)) continue;
      edges.push([i, j]);
      for (let k = j + 1; k < 12; k++) if (near(i, k) && near(j, k)) faces.push([i, j, k]);
    }
  }
  const lerp = (a: number[], b: number[], t: number) => a.map((c, i) => c + (b[i] - c) * t);
  const jitter = (p: number[], r: number) => p.map((c) => c + (rand() - 0.5) * r);

  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const k = i / count;
    let p: number[];
    let luma: number;
    let inner = 0;
    if (k < 0.4) {
      const [a, b] = edges[Math.floor(rand() * edges.length)];
      p = jitter(lerp(verts[a], verts[b], rand()), 0.012);
      luma = 0.75 + 0.25 * rand();
    } else if (k < 0.48) {
      const v = verts[Math.floor(rand() * 12)];
      p = jitter(v, 0.05);
      luma = 1;
    } else if (k < 0.66) {
      const [a, b, c] = faces[Math.floor(rand() * faces.length)];
      // Uniform over the triangle.
      const r1 = Math.sqrt(rand());
      const r2 = rand();
      p = verts[a].map((x, d) => x * (1 - r1) + verts[b][d] * r1 * (1 - r2) + verts[c][d] * r1 * r2);
      luma = 0.1 + 0.08 * rand();
    } else if (k < 0.88) {
      const [a, b] = edges[Math.floor(rand() * edges.length)];
      p = jitter(lerp(verts[a], verts[b], rand()), 0.01).map((c) => c * 0.46);
      luma = 0.5 + 0.2 * rand();
      inner = 1;
    } else {
      // Soft core: dense at the centre, thinning out.
      const r = Math.pow(rand(), 2.2) * 0.22;
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      p = [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r];
      luma = 0.45 + 0.4 * (1 - r / 0.22);
      inner = 1;
    }
    out.set([p[0], p[1], p[2], luma + inner * INNER_FLAG], i * 4);
  }

  // Top-to-bottom order, like the other shapes, so morphs flow.
  const keys = Array.from({ length: count }, (_, i) => out[i * 4 + 1] + (rand() - 0.5) * 0.04);
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => keys[b] - keys[a]);
  const sorted = new Float32Array(count * 4);
  order.forEach((src, dst) => sorted.set(out.subarray(src * 4, src * 4 + 4), dst * 4));
  return sorted;
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

/**
 * Shapes for a page that shows only the silk (inner pages): every baked
 * target sits at the origin, unused — the silk is built in the shader.
 */
export function emptyShapes(count: number): Shapes {
  const cloud = (): PointCloud => ({ count, positions: new Float32Array(count * 3), luma: new Float32Array(count) });
  return {
    count,
    logo: cloud(),
    logoPad: 1,
    map: cloud(),
    mapAspect: 1,
    office: null,
    crystal: new Float32Array(count * 4),
    globe: {
      surface: new Float32Array(count * 3),
      arcTo: new Float32Array(count * 4),
      arcMeta: new Float32Array(count * 2),
      luma: new Float32Array(count),
    },
  };
}
