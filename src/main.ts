// The home page: the shared site (styles, header, forms, footer) plus the
// particle field and its intro.
import 'lenis/dist/lenis.css';
import './site';
import Lenis from 'lenis';
import { config, type Look } from './config';
import { buildShapes } from './particles/shapes';
import { ParticleField } from './particles/ParticleField';
import { attachDissolve } from './effects/dissolve';
import { revealOnScroll, setupReveals } from './effects/reveal';
import { createPreloader } from './effects/preloader';
import { createZoneClock } from './effects/clock';
import { MENU_LOCK_EVENT, TESTIMONIAL_EVENT, THEME_EVENT, currentTheme, type Theme } from './components';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
/** `?skip-intro` jumps straight to the formed map — handy while designing. */
const skipIntro = reducedMotion || new URLSearchParams(location.search).has('skip-intro');

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
  // The header and forms already work (site.ts), WebGL or not; the dots pick
  // up the theme once they exist, and smooth scrolling pauses while the
  // phone menu is open.
  let look: Look = config.looks[currentTheme()];
  let field: ParticleField | null = null;
  let lenis: Lenis | null = null;
  document.addEventListener(THEME_EVENT, (e) => {
    look = config.looks[(e as CustomEvent<Theme>).detail];
    field?.setLook(look);
  });
  document.addEventListener(MENU_LOCK_EVENT, (e) => {
    if ((e as CustomEvent<boolean>).detail) lenis?.stop();
    else lenis?.start();
  });
  // Each new testimonial turns the galaxy on a third (its arms come round to
  // where they were): the core gets there fast, the rim follows.
  const galaxy = { target: 0, core: 0, rim: 0 };
  document.addEventListener(TESTIMONIAL_EVENT, (e) => {
    galaxy.target += (e as CustomEvent<number>).detail * ((Math.PI * 2) / 3);
    if (reducedMotion) galaxy.core = galaxy.rim = galaxy.target;
  });

  const preloader = createPreloader(el('[data-preloader]'), skipIntro ? 0 : config.intro.loaderSeconds);
  // Let the preloader paint before the shapes are drawn and sampled.
  await Promise.all([document.fonts.ready, new Promise(requestAnimationFrame)]);
  const count = Math.round(config.count * (coarsePointer ? config.mobileRatio : 1));
  const shapes = buildShapes(count, readOffice(el('#hero').dataset.office));

  field = new ParticleField(el('[data-field]'), shapes, {
    look,
    pointSize: config.pointSize,
    maxPixelRatio: coarsePointer ? 1.5 : 2,
  });
  const u = field.uniforms;
  if (shapes.office) u.uOffice.value.set(...shapes.office);
  // Fewer, denser silk rows when there are fewer dots, so they still read as lines.
  u.uSilk.value.x = Math.round(72 * Math.pow(count / config.count, 0.7));

  lenis = reducedMotion ? null : new Lenis({ lerp: 0.085, anchors: true });
  if (!coarsePointer && !reducedMotion) document.querySelectorAll<HTMLElement>('[data-dissolve]').forEach(attachDissolve);
  setupReveals(document.querySelectorAll<HTMLElement>('.statement'));
  revealOnScroll([el('#work')], 0.25);

  const sections = {
    hero: el('#hero'),
    support: el('#support'),
    security: el('#security'),
    cloud: el('#cloud'),
    work: el('#work'),
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
  const services = slider('[data-services]', '[data-service-index]', '[data-service-progress]');
  const updateSlider = (s: typeof services, progress: number) => {
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
  const workHead = el('.work__head');
  const workList = el('.work__list');

  // Layout: where each shape sits for the current viewport.
  type Placement = { scale: number; x: number; y: number };
  const layout = {
    narrow: false,
    map: { scale: 1, x: 0, y: 0 } as Placement,
    mapEnd: { scale: 1, x: 0, y: 0 } as Placement,
    signal: { scale: 1, x: 0, y: 0 } as Placement,
    crystal: { scale: 1, x: 0, y: 0 } as Placement,
    globe: { scale: 1, x: 0, y: 0 } as Placement,
    work: { scale: 1, x: 0, y: 0 } as Placement,
    services: { scale: 1, x: 0, y: 0 } as Placement,
  };
  const applyLayout = () => {
    field.resize();
    const { width: W, height: H } = field.view;
    const narrow = innerWidth < 820 || W / H < 0.9;
    layout.narrow = narrow;

    // Intro logo: exactly over the logo the preloader drew (it keeps its
    // layout while faded out, so this holds on resize too).
    const logoRect = preloader.logoRect();
    if (logoRect?.height) {
      const { width: sw, height: sh } = field.screen;
      u.uLogo.value.set(
        (logoRect.height / sh) * H * shapes.logoPad,
        ((logoRect.left + logoRect.width / 2) / sw - 0.5) * W,
        (0.5 - (logoRect.top + logoRect.height / 2) / sh) * H,
        0,
      );
    }

    // London: large, on the right of the hero copy on desktop; across the
    // lower half on phones.
    const mScale = narrow
      ? Math.min((W * 0.86) / shapes.mapAspect, H * 0.32)
      : Math.min(H * 0.8, (W * 0.56) / shapes.mapAspect);
    layout.map = narrow
      ? { scale: mScale, x: 0, y: -H / 2 + mScale / 2 + H * 0.015 }
      : { scale: mScale, x: W / 2 - (mScale * shapes.mapAspect) / 2 - W * 0.025, y: -H * 0.02 };

    // Crystal and globe sit beside the copy on desktop, above it on phones.
    const beside = (size: number, aspect: number): Placement =>
      narrow
        ? { scale: Math.min(H * 0.42 * size, (W * 0.84) / aspect), x: 0, y: H * 0.18 }
        : { scale: Math.min(H * 0.72 * size, (W * 0.42) / aspect), x: W * 0.22, y: 0 };
    // Both are scaled by radius; the globe's orbit reaches 1.42 radii out.
    const g = beside(1, 1);
    layout.crystal = { ...g, scale: g.scale / 2.1 };
    layout.globe = { ...g, scale: g.scale / 2.9 };

    // Backdrops (all procedural, in the shader): the sea spreads across the
    // lower half, the ring sits right of the copy, the galaxy and the ribbon
    // drift behind it.
    const [sea, ring, galaxy, ribbon] = u.uBackdrops.value;
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

    // The silks, scaled by half their width. Always on and the services run
    // wider than the screen along its bottom (the copy sits above them);
    // the "how we work" ribbon runs through the open band between the
    // eyebrow and the pillars, where that band is once the section fills
    // the screen.
    // Silk reads as silk when its rows are packed tight, so the always-on
    // sheet is a shallow band along the bottom (a little deeper on phones).
    const silkWidth = W * (narrow ? 1.1 : 0.62);
    u.uSilk.value.y = narrow ? 0.45 : 0.28;
    layout.signal = { scale: silkWidth, x: 0, y: -H * 0.3 };
    layout.services = { scale: silkWidth, x: 0, y: -H * (narrow ? 0.26 : 0.2) };
    const workTop = sections.work.getBoundingClientRect().top;
    const band = (workHead.getBoundingClientRect().bottom + workList.getBoundingClientRect().top) / 2 - workTop;
    layout.work = { scale: W * (narrow ? 0.75 : 0.6), x: 0, y: (0.5 - clamp01(band / field.screen.height)) * H };
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
      pointer.tx = (e.clientX / field.screen.width) * 2 - 1;
      pointer.ty = -((e.clientY / field.screen.height) * 2 - 1);
      pointer.inside = 1;
    });
    document.addEventListener('pointerleave', () => (pointer.inside = 0));
  }

  /** When the drawn logo started dissolving into dots; -1 until the preloader hands over. */
  let introStart = -1;
  let preloaderGone = false;
  let revealed = false;
  let time = 0;
  let turbulence = 0;
  let lastScroll = scrollY;
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
    const toSignal = enter(sections.support);
    const serviceProgress = through(sections.services);
    const toMapEnd = enter(sections.contact);

    // --- inputs ---
    const velocity = lenis ? Math.abs(lenis.velocity) : Math.abs(scrollY - lastScroll);
    lastScroll = scrollY;
    turbulence = damp(turbulence, reducedMotion ? 0 : clamp01(velocity / 70), 0.15, dt);
    pointer.x = damp(pointer.x, pointer.tx, 0.35, dt);
    pointer.y = damp(pointer.y, pointer.ty, 0.35, dt);
    pointer.active = damp(pointer.active, pointer.inside, pointer.inside ? 0.3 : 0.8, dt);

    // Intro: the drawn logo dissolves into its dots in place, they drift
    // apart a little, then flow into the map — and the page appears as they go.
    const { dissolveSeconds, scatterSeconds, morphSeconds } = config.intro;
    const sinceIntro = introStart < 0 ? 0 : time - introStart;
    const dissolve = skipIntro ? 1 : clamp01(sinceIntro / dissolveSeconds);
    const scattered = clamp01((sinceIntro - dissolveSeconds) / scatterSeconds);
    const toMap = skipIntro ? 1 : introStart < 0 ? 0 : smooth(clamp01((sinceIntro - dissolveSeconds - scatterSeconds * 0.75) / morphSeconds));
    u.uDissolve.value = dissolve;
    u.uScatter.value = 1 - (1 - scattered) ** 3;
    u.uIntro.value = 1 - toMap;
    if (!preloaderGone) preloaderGone = preloader.dissolve(dissolve);
    if (!revealed && toMap > 0) {
      revealed = true;
      document.documentElement.classList.add('is-ready');
    }
    const lookX = pointer.x * pointer.active;
    const lookY = pointer.y * pointer.active;

    // --- uniforms ---
    u.uTime.value = time;
    u.uMorphA.value.set(toSignal, enter(sections.security), enter(sections.cloud), enter(sections.work));
    u.uMorphS.value = enter(sections.services);
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
    // The silks and crystal move on their own (in the shader) and lean toward the cursor.
    u.uTilt.value.set(mapYaw, mapPitch, lookX * 0.25, lookX * 0.3);
    u.uSignal.value.set(layout.signal.scale, layout.signal.x, layout.signal.y, 0);
    u.uWork.value.set(layout.work.scale, layout.work.x, layout.work.y, 0);
    u.uServices.value.set(layout.services.scale, layout.services.x, layout.services.y, 0);
    u.uCrystal.value.set(layout.crystal.scale, layout.crystal.x, layout.crystal.y, 0);

    // The globe swings back and forth around London, tilted so London sits
    // near the top and the arcs fan out below it.
    const g = layout.globe;
    u.uGlobe.value.set(g.scale, g.x, g.y, 0);
    u.uGlobeRot.value.set(Math.sin(time * 0.12) * 0.9 + lookX * 0.3, 0.55 - lookY * 0.1);

    // London time, for the label beside the 24/7 copy.
    const secs = zoneClock.seconds();
    const second = secs % 60;

    // Services silk: each service has its own form; it holds while that
    // service is up and flows into the next around the change-over.
    const forms = config.serviceSilk;
    const at = Math.min(Math.max(serviceProgress * services.items.length - 0.5, 0), services.items.length - 1);
    const from = forms[Math.floor(at) % forms.length];
    const to = forms[Math.min(Math.floor(at) + 1, services.items.length - 1) % forms.length];
    const blend = smooth(clamp01((at - Math.floor(at) - 0.25) / 0.5));
    const lerp = (p: number, q: number) => p + (q - p) * blend;
    u.uSilkA.value.set(...(from.a.map((v, i) => lerp(v, to.a[i])) as [number, number, number, number]));
    u.uSilkB.value.set(...(from.b.map((v, i) => lerp(v, to.b[i])) as [number, number, number, number]));
    u.uSilkPose.value.set(lerp(from.tilt, to.tilt), lerp(from.yaw, to.yaw) + lookX * 0.1, lerp(from.depth, to.depth));

    // Dim the map behind the statement.
    u.uExposure.value = look.exposure * (1 - 0.45 * recede * (1 - toSignal));
    // The galaxy swirls round to the next testimonial, brightening as it turns.
    galaxy.core = damp(galaxy.core, galaxy.target, 0.35, dt);
    galaxy.rim = damp(galaxy.rim, galaxy.target, 1.1, dt);
    u.uGalaxySpin.value.set(galaxy.core, galaxy.rim);
    const turning = clamp01(Math.abs(galaxy.target - galaxy.rim) / ((Math.PI * 2) / 3));
    // Dots behind copy — the backdrops, and the closing map on phones —
    // stay dim, more so on phones and in light mode; less behind mix's
    // see-through sheets, which dim them already. (Which backdrop is showing:
    // each owns the dots from its section's arrival to the next's.)
    const owns = [b0 * (1 - b1), b1 * (1 - b2), b2 * (1 - b3), b3 * (1 - toMapEnd)];
    const owned = owns.reduce((a, b) => a + b, 0);
    const sheetBoost = (i: number) => (look.behindSheet && sections.backdrops[i].dataset.tone === 'light' ? look.behindSheet : 1);
    const behindSheet = owned ? owns.reduce((sum, o, i) => sum + o * sheetBoost(i), 0) / owned : 1;
    u.uBackdropDim.value = (layout.narrow ? 0.34 : 0.5) * look.behindText * behindSheet * (1 + 0.6 * turning);
    u.uEndDim.value = layout.narrow ? 0.55 * look.behindText : 1;

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
        : clamp01((toMap - 0.8) / 0.2) * clamp01(1 - recede * 4);
      mapPin.style.opacity = String(visible);
    }
    updateSlider(services, serviceProgress);
    if (Math.floor(secs) !== shownSecond) {
      shownSecond = Math.floor(secs);
      timeLabel.textContent = `${pad2(secs / 3600)}:${pad2((secs / 60) % 60)}:${pad2(second)}`;
    }
    // Solid bar once the hero copy has scrolled under it.
    topbar.classList.toggle('is-scrolled', recede > 0.25);

    field.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  await preloader.finish();
  // The drawn logo now dissolves into dots in its own place.
  preloader.handOff();
  introStart = time;
}

boot().catch((error) => {
  console.error(error);
  document.documentElement.classList.add('is-ready', 'no-webgl');
});
