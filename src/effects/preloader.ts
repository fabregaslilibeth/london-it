export interface Preloader {
  /** Resolves once the progress rules are full. */
  finish(): Promise<void>;
  /** Where the drawn logo sits, so the dots can form over it exactly. */
  logoRect(): DOMRect | null;
  /** Clears the backdrop, leaving the drawn logo over the dots. */
  handOff(): void;
  /**
   * 0 → 1 through the dissolve (the shader's uDissolve): the drawn logo fades
   * as its dots appear. True once it has gone.
   */
  dissolve(progress: number): boolean;
}

/**
 * The London IT Support logo draws itself (CSS) while the particle shapes are
 * built; the two rules beside "IT SUPPORT" fill outward as progress (the
 * `--progress` custom property). Progress eases toward 90% on its own and
 * completes once `finish()` is called.
 */
export function createPreloader(root: HTMLElement, minSeconds: number): Preloader {
  const logo = root.querySelector<HTMLElement>('[data-preloader-logo]');
  const start = performance.now();
  let last = start;
  let shown = 0;
  let ceiling = 0.9;
  let done: (() => void) | null = null;

  const tick = (now: number) => {
    // rAF timestamps can predate `start` by a frame — clamp so nothing goes negative.
    const elapsed = Math.max(0, (now - start) / 1000);
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.25);
    last = Math.max(now, last);
    const timeShare = minSeconds > 0 ? elapsed / minSeconds : 1;
    const allowed = Math.min(ceiling, timeShare);
    shown += (allowed - shown) * (1 - Math.exp(-dt / 0.15));
    if (ceiling === 1 && shown > 0.995) shown = 1;
    root.style.setProperty('--progress', shown.toFixed(4));

    if (shown >= 1 && done) {
      // A beat with the logo complete before the dots arrive.
      window.setTimeout(done, 250);
      done = null;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    finish() {
      ceiling = 1;
      return new Promise((resolve) => (done = resolve));
    },
    logoRect: () => logo?.getBoundingClientRect() ?? null,
    handOff() {
      root.classList.add('is-handoff');
    },
    dissolve(progress) {
      if (progress >= 1) {
        root.classList.add('is-done');
        return true;
      }
      root.style.setProperty('--dissolve', progress.toFixed(3));
      return false;
    },
  };
}
