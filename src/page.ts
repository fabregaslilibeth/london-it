// An inner page (src/pages/page.html): the shared site, smooth scrolling,
// sections that rise in as they arrive, and the dot sea (the home page's
// case-studies backdrop) across the lower half of the screen behind it all,
// dimming as you scroll on into the copy.
import 'lenis/dist/lenis.css';
import './site';
import Lenis from 'lenis';
import { config } from './config';
import { ParticleField } from './particles/ParticleField';
import { emptyShapes } from './particles/shapes';
import { revealOnScroll } from './effects/reveal';
import { MENU_LOCK_EVENT, THEME_EVENT, currentTheme, type Theme } from './components';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const damp = (current: number, target: number, seconds: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt / seconds));

// No intro here: the header (which waits for is-ready) shows straight away.
document.documentElement.classList.add('is-ready');

const lenis = reducedMotion ? null : new Lenis({ lerp: 0.085, anchors: true });
document.addEventListener(MENU_LOCK_EVENT, (e) => {
  if ((e as CustomEvent<boolean>).detail) lenis?.stop();
  else lenis?.start();
});

if (!reducedMotion) {
  document.documentElement.classList.add('has-reveal');
  revealOnScroll(document.querySelectorAll('.page-section, main > .enquiry, main > .faq'), 0.12);
}

function startSea(container: HTMLElement | null): void {
  if (!container) return;
  let look = config.looks[currentTheme()];
  const count = Math.round(config.pageCount * (coarsePointer ? config.mobileRatio : 1));
  let field: ParticleField;
  try {
    field = new ParticleField(container, emptyShapes(count), {
      look,
      pointSize: config.pointSize,
      maxPixelRatio: coarsePointer ? 1.5 : 2,
    });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  const u = field.uniforms;
  // Only the sea shows: no intro, no other shapes.
  u.uIntro.value = 0;
  u.uDissolve.value = 1;
  u.uMorphB.value.set(1, 0, 0, 0);

  // As on the home page: wider than the screen, low on it.
  const layout = () => {
    field.resize();
    const { width: W, height: H } = field.view;
    const narrow = innerWidth < 820 || W / H < 0.9;
    u.uBackdrops.value[0].set(W * (narrow ? 0.75 : 0.62), 0, -H * (narrow ? 0.3 : 0.2), 0);
  };
  layout();
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 100);
  });
  document.addEventListener(THEME_EVENT, (e) => {
    look = config.looks[(e as CustomEvent<Theme>).detail];
    field.setLook(look);
  });

  // Pointer, in NDC, smoothed: the sea leans toward it and dots near it warm to amber.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: 0, inside: 0 };
  if (!coarsePointer && !reducedMotion) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / field.screen.width) * 2 - 1;
      pointer.ty = -((e.clientY / field.screen.height) * 2 - 1);
      pointer.inside = 1;
    });
    document.addEventListener('pointerleave', () => (pointer.inside = 0));
  }

  let time = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    lenis?.raf(now);
    time += dt * (reducedMotion ? 0.25 : 1);
    pointer.x = damp(pointer.x, pointer.tx, 0.35, dt);
    pointer.y = damp(pointer.y, pointer.ty, 0.35, dt);
    pointer.active = damp(pointer.active, pointer.inside, pointer.inside ? 0.3 : 0.8, dt);
    u.uTime.value = time;
    u.uPointer.value.set(pointer.x, pointer.y);
    u.uPointerActive.value = pointer.active;
    u.uBackdropYaw.value = Math.sin(time * 0.3) * 0.18 + pointer.x * pointer.active * 0.15;
    // Behind the banner copy and form, so a little dimmed (more on the light page).
    u.uBackdropDim.value = 0.75 * Math.min(look.behindText, 1);
    // Full strength behind the banner, quieter behind the sections.
    u.uExposure.value = look.exposure * (1 - 0.55 * clamp01(scrollY / innerHeight));
    field.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

startSea(document.querySelector<HTMLElement>('[data-field]'));
