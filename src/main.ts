import 'lenis/dist/lenis.css';
import './style.css';
import Lenis from 'lenis';
import { config } from './config';
import { buildShapes } from './particles/shapes';
import { ParticleField } from './particles/ParticleField';
import { createCursor } from './effects/cursor';
import { attachDissolve } from './effects/dissolve';
import { setupReveals } from './effects/reveal';
import { createPreloader } from './effects/preloader';
import { createZoneClock } from './effects/clock';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
/** `?skip-intro` jumps straight to the formed map — handy while designing. */
const skipIntro = reducedMotion || new URLSearchParams(location.search).has('skip-intro');

const TAU = Math.PI * 2;
/** Depth of the services helix's centre; the camera sits at z = 3. */
const HELIX_Z = -4;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (v: number) => v * v * (3 - 2 * v);
const damp = (current: number, target: number, seconds: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt / seconds));
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}

/** "lon,lat" from the hero's data-office (parsed from the site's map link at build time). */
function readOffice(raw: string | undefined): [number, number] | null {
  const [lon, lat] = (raw ?? '').split(',').map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) && raw ? [lon, lat] : null;
}

async function boot(): Promise<void> {
  // Always start at the top so the map forms in view.
  if (!skipIntro) {
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
  }
  const preloader = createPreloader(el('[data-preloader]'), skipIntro ? 0 : 1.1);
  // Let the preloader paint before the shapes are drawn and sampled.
  await Promise.all([document.fonts.ready, new Promise(requestAnimationFrame)]);
  const count = Math.round(config.count * (coarsePointer ? config.mobileRatio : 1));
  const shapes = buildShapes(count, readOffice(el('#hero').dataset.office));

  const field = new ParticleField(el('[data-field]'), shapes, {
    color: config.color,
    accent: config.accent,
    exposure: config.exposure,
    pointSize: config.pointSize,
    maxPixelRatio: coarsePointer ? 1.5 : 2,
  });
  const u = field.uniforms;
  if (shapes.office) u.uOffice.value.set(...shapes.office);

  const lenis = reducedMotion ? null : new Lenis({ lerp: 0.085, anchors: true });
  const cursor = coarsePointer ? null : createCursor(el('[data-cursor]'));
  if (!coarsePointer && !reducedMotion) document.querySelectorAll<HTMLElement>('[data-dissolve]').forEach(attachDissolve);
  setupReveals(document.querySelectorAll<HTMLElement>('.statement'));

  const sections = {
    hero: el('#hero'),
    support: el('#support'),
    security: el('#security'),
    cloud: el('#cloud'),
    dna: el('#dna'),
    services: el('#services'),
    // Each of these gets a subtle backdrop, in this order.
    backdrops: [el('#results'), el('#values'), el('#voices'), el('#faq')],
    contact: el('#contact'),
  };
  const slider = (list: string, index: string, bar: string) => ({
    items: Array.from(document.querySelectorAll<HTMLElement>(`${list} > li`)),
    index: el(index),
    bar: el(bar),
    active: -1,
  });
  const pillars = slider('[data-pillars]', '[data-pillar-index]', '[data-pillar-progress]');
  const services = slider('[data-services]', '[data-service-index]', '[data-service-progress]');
  const updateSlider = (s: typeof pillars, progress: number) => {
    const index = Math.min(s.items.length - 1, Math.floor(progress * s.items.length));
    if (index !== s.active) {
      s.items.forEach((item, i) => item.classList.toggle('is-active', i === index));
      s.index.textContent = String(index + 1).padStart(2, '0');
      s.active = index;
    }
    s.bar.style.transform = `scaleX(${progress})`;
  };
  const timeLabel = el('[data-london-time]');
  const mapPin = el('[data-map-pin]');
  const zoneClock = createZoneClock(config.timeZone);
  const topbar = el('.topbar');

  // Layout: where each shape sits for the current viewport.
  type Placement = { scale: number; x: number; y: number };
  const layout = {
    narrow: false,
    map: { scale: 1, x: 0, y: 0 } as Placement,
    mapEnd: { scale: 1, x: 0, y: 0 } as Placement,
    clock: { scale: 1, x: 0, y: 0 } as Placement,
    shield: { scale: 1, x: 0, y: 0 } as Placement,
    globe: { scale: 1, x: 0, y: 0 } as Placement,
  };
  let helixLift = 0;
  const applyLayout = () => {
    field.resize();
    const { width: W, height: H } = field.view;
    const narrow = innerWidth < 820 || W / H < 0.9;
    layout.narrow = narrow;

    // London: large, on the right of the hero copy on desktop; across the
    // lower half on phones.
    const mScale = narrow
      ? Math.min((W * 0.96) / shapes.mapAspect, H * 0.36)
      : Math.min(H * 0.8, (W * 0.56) / shapes.mapAspect);
    layout.map = narrow
      ? { scale: mScale, x: 0, y: -H / 2 + mScale / 2 + H * 0.015 }
      : { scale: mScale, x: W / 2 - (mScale * shapes.mapAspect) / 2 - W * 0.025, y: -H * 0.02 };

    // Clock, shield and globe sit beside the copy on desktop, above it on phones.
    const beside = (size: number, aspect: number): Placement =>
      narrow
        ? { scale: Math.min(H * 0.42 * size, (W * 0.84) / aspect), x: 0, y: H * 0.18 }
        : { scale: Math.min(H * 0.72 * size, (W * 0.42) / aspect), x: W * 0.22, y: 0 };
    layout.clock = beside(1, 1);
    layout.shield = beside(0.92, shapes.shieldAspect);
    // The globe's orbit reaches 1.42 radii out.
    const g = beside(1, 1);
    layout.globe = { ...g, scale: g.scale / 2.9 };

    // Backdrops (all procedural, in the shader): the sea spreads across the
    // lower half, the ring sits right of the copy, the galaxy and the ribbon
    // drift behind it.
    const [sea, ring, galaxy, ribbon] = u.uBackdrops.value;
    // On phones the copy sits right on top of them, so they go dimmer.
    u.uBackdropDim.value = narrow ? 0.34 : 0.5;
    if (narrow) {
      sea.set(W * 0.75, 0, -H * 0.24, 0);
      ring.set(Math.min(W * 0.3, H * 0.18), 0, H * 0.06, -0.2);
      galaxy.set(W * 0.48, 0, H * 0.02, -0.2);
      ribbon.set(W * 0.42, 0, 0, -0.2);
    } else {
      sea.set(W * 0.62, 0, -H * 0.15, 0);
      ring.set(H * 0.26, W * 0.25, -H * 0.02, -0.2);
      galaxy.set(H * 0.44, W * 0.16, -H * 0.02, -0.2);
      ribbon.set(W * 0.34, 0, -H * 0.04, -0.2);
    }

    // The map again at the end: right of the contact details on desktop,
    // above them (and dimmer, as text scrolls over it) on phones.
    const eScale = narrow
      ? Math.min((W * 0.96) / shapes.mapAspect, H * 0.36)
      : Math.min(H * 0.74, (W * 0.44) / shapes.mapAspect);
    layout.mapEnd = narrow
      ? { scale: eScale, x: 0, y: H * 0.22 }
      : { scale: eScale, x: W / 2 - (eScale * shapes.mapAspect) / 2 - W * 0.035, y: 0 };
    u.uEndDim.value = narrow ? 0.55 : 1;

    // Helix: side-on it spans the screen at its depth; end-on its near rings
    // sweep in from beyond the screen edges.
    const distance = field.camera.position.z - HELIX_Z;
    const viewH = 2 * distance * Math.tan((field.camera.fov * Math.PI) / 360);
    const viewW = viewH * field.camera.aspect;
    u.uHelix.value.set(Math.max(viewW * 1.1, 10), viewH * (narrow ? 0.07 : 0.085), Math.max(W, H) * 0.2, 0);
    helixLift = viewH * (narrow ? 0.2 : 0.05);
  };
  applyLayout();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyLayout, 100);
  });

  // Pointer, in NDC, smoothed.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: 0, inside: 0 };
  if (!coarsePointer && !reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
      pointer.inside = 1;
    });
    document.addEventListener('pointerleave', () => (pointer.inside = 0));
  }

  let formation = skipIntro ? 1 : 0;
  let formationStarted = skipIntro;
  let time = 0;
  let turbulence = 0;
  let lastScroll = scrollY;
  let helixSpin = 0;
  let shownSecond = -1;
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    lenis?.raf(now);
    time += dt * (reducedMotion ? 0.25 : 1);

    // --- read layout ---
    const vh = innerHeight;
    const top = (s: HTMLElement) => s.getBoundingClientRect().top;
    // 0 → 1 as a section's top travels from the bottom of the screen to near the top.
    const enter = (s: HTMLElement) => smooth(clamp01((vh * 0.95 - top(s)) / (vh * 0.8)));
    // 0 → 1 across a tall section's scroll distance.
    const through = (s: HTMLElement) => {
      const r = s.getBoundingClientRect();
      return clamp01(-r.top / Math.max(r.height - vh, 1));
    };
    const recede = clamp01(-top(sections.hero) / vh);
    const toClock = enter(sections.support);
    const dnaProgress = through(sections.dna);
    const serviceProgress = through(sections.services);
    const toMapEnd = enter(sections.contact);

    // --- inputs ---
    const velocity = lenis ? Math.abs(lenis.velocity) : Math.abs(scrollY - lastScroll);
    lastScroll = scrollY;
    turbulence = damp(turbulence, reducedMotion ? 0 : clamp01(velocity / 70), 0.15, dt);
    pointer.x = damp(pointer.x, pointer.tx, 0.35, dt);
    pointer.y = damp(pointer.y, pointer.ty, 0.35, dt);
    pointer.active = damp(pointer.active, pointer.inside, pointer.inside ? 0.3 : 0.8, dt);
    if (formationStarted) formation = Math.min(formation + dt / config.formationSeconds, 1);
    const lookX = pointer.x * pointer.active;
    const lookY = pointer.y * pointer.active;

    // --- uniforms ---
    u.uTime.value = time;
    u.uFormation.value = formation;
    u.uMorphA.value.set(toClock, enter(sections.security), enter(sections.cloud), enter(sections.dna));
    const [b0, b1, b2, b3] = sections.backdrops.map(enter);
    u.uMorphB.value.set(b0, b1, b2, b3);
    u.uMorphC.value = toMapEnd;
    u.uTurbulence.value = turbulence;
    u.uPointer.value.set(pointer.x, pointer.y);
    u.uPointerActive.value = pointer.active;

    // The map sinks back as the hero scrolls away, and leans toward the cursor.
    const m = layout.map;
    const mapScale = m.scale * (1 - 0.1 * recede);
    const mapZ = -0.7 * recede;
    u.uMap.value.set(mapScale, m.x, m.y, mapZ);
    const e = layout.mapEnd;
    u.uMapEnd.value.set(e.scale, e.x, e.y, 0);
    u.uBackdropYaw.value = Math.sin(time * 0.3) * 0.18 + lookX * 0.15;
    const mapYaw = Math.sin(time * 0.25) * 0.05 + lookX * 0.12;
    const mapPitch = -lookY * 0.08;
    u.uTilt.value.set(
      mapYaw,
      mapPitch,
      Math.sin(time * 0.3) * 0.12 + lookX * 0.25,
      Math.sin(time * 0.45) * 0.32 + lookX * 0.3,
    );
    u.uClock.value.set(layout.clock.scale, layout.clock.x, layout.clock.y, 0);
    u.uShield.value.set(layout.shield.scale, layout.shield.x, layout.shield.y, 0);

    // The globe swings back and forth around London, tilted so London sits
    // near the top and the arcs fan out below it.
    const g = layout.globe;
    u.uGlobe.value.set(g.scale, g.x, g.y, 0);
    u.uGlobeRot.value.set(Math.sin(time * 0.12) * 0.9 + lookX * 0.3, 0.55 - lookY * 0.1);

    // Clock hands: London time. The second hand ticks rather than sweeps.
    const secs = zoneClock.seconds();
    const second = secs % 60;
    const tick = Math.floor(second) + smooth(clamp01((second % 1) / 0.18));
    u.uClockHands.value.set((((secs / 3600) % 12) / 12) * TAU, (((secs / 60) % 60) / 60) * TAU, (tick / 60) * TAU);

    // DNA: spins fast across the "how we work" section — faster still while
    // you scroll — and slides along as it goes. In the services it swings
    // end-on over the first stretch, slows, and each service is another turn
    // of the vortex. The spin is integrated so speed changes never jump.
    const turn = smooth(clamp01(serviceProgress / 0.16));
    helixSpin += dt * ((reducedMotion ? 0.3 : 1.7) * (1 - turn) + 0.4 * turn + turbulence * 5);
    u.uHelix.value.w = helixSpin + dnaProgress * TAU * 0.6 + serviceProgress * TAU * 1.25;
    // Side-on it sits above the pillar copy (well above on phones, where the
    // copy is taller); end-on it centres on the service text. The slide would
    // push the coil toward the camera end-on, so it eases out too.
    u.uHelixShift.value.set(dnaProgress * (1 - turn), helixLift * (1 - turn));
    u.uHelixPose.value.set(turn, lookX * 0.12 * turn, -lookY * 0.08 * turn, HELIX_Z);

    // Dim the map behind the statement.
    u.uExposure.value = config.exposure * (1 - 0.45 * recede * (1 - toClock));

    // --- DOM ---
    if (shapes.office) {
      // The pin follows whichever map is showing — hero or contact — with
      // the same yaw-then-pitch turn the shader gives it.
      const atEnd = toMapEnd > 0.5;
      const [ox, oy] = shapes.office;
      const x1 = ox * Math.cos(mapYaw);
      const z1 = -ox * Math.sin(mapYaw);
      const y2 = oy * Math.cos(mapPitch) - z1 * Math.sin(mapPitch);
      const z2 = oy * Math.sin(mapPitch) + z1 * Math.cos(mapPitch);
      const [s, x, y, z] = atEnd ? [e.scale, e.x, e.y, 0] : [mapScale, m.x, m.y, mapZ];
      const p = field.project(x1 * s + x, y2 * s + y, z2 * s + z);
      mapPin.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      const visible = atEnd
        ? clamp01((toMapEnd - 0.85) / 0.15) * (layout.narrow ? 0 : 1)
        : clamp01((formation - 0.8) / 0.2) * clamp01(1 - recede * 4);
      mapPin.style.opacity = String(visible);
    }
    updateSlider(pillars, dnaProgress);
    updateSlider(services, serviceProgress);
    if (Math.floor(secs) !== shownSecond) {
      shownSecond = Math.floor(secs);
      timeLabel.textContent = `${pad2(secs / 3600)}:${pad2((secs / 60) % 60)}:${pad2(second)}`;
    }
    // Solid bar once the hero copy has scrolled under it.
    topbar.classList.toggle('is-scrolled', recede > 0.25);
    cursor?.update(dt);

    field.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  await preloader.finish();
  document.documentElement.classList.add('is-ready');
  formationStarted = true;
}

boot().catch((error) => {
  console.error(error);
  document.documentElement.classList.add('is-ready', 'no-webgl');
});
