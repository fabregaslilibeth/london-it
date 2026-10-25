// Look-and-feel defaults. The copy lives in content/site.json, synced from
// london-itsupport.co.uk (`npm run sync`).
import type { Theme } from './components/header/theme';

/** How the dots are drawn in one theme. */
export interface Look {
  color: string;
  /** Brand amber: office ping, the silks' glints and specks, scan line, globe packets, and dots near the cursor. */
  accent: string;
  /** Overall dot opacity. */
  exposure: number;
  /** Dots add light (dark page) or are laid on like ink (light page — adding light to white shows nothing). */
  additive: boolean;
  /** Extra dimming for dots that sit behind copy (backdrops, the closing map on phones); ink reads heavier than light. */
  behindText: number;
  /** Mix only: a backdrop behind a see-through light sheet is dimmed less, as the sheet dims it already. */
  behindSheet?: number;
}

export const config = {
  /** Particles on desktop. Touch devices get `count * mobileRatio`. */
  count: 46000,
  mobileRatio: 0.5,

  looks: {
    dark: { color: '#e9eefb', accent: '#ffaa00', exposure: 0.36, additive: true, behindText: 1 },
    light: { color: '#0e2a5e', accent: '#f29a00', exposure: 0.5, additive: false, behindText: 0.65 },
    // As dark, a little brighter for the navy.
    mix: { color: '#e9eefb', accent: '#ffaa00', exposure: 0.42, additive: true, behindText: 1, behindSheet: 1.4 },
  } satisfies Record<Theme, Look>,

  /**
   * The intro, in seconds: the logo draws itself (at least `loaderSeconds`),
   * dissolves into dots in place, they drift apart a little, then flow into
   * the map (starting as the scatter settles).
   */
  intro: { loaderSeconds: 2.2, dissolveSeconds: 0.6, scatterSeconds: 1.1, morphSeconds: 1.6 },
  /**
   * The services silk's form for each service in turn (repeating if there
   * are more services). `a` and `b` are the silk() parameters in shaders.ts —
   * a: swell height, swell frequency, ripples from the centre, twist;
   * b: pleats, saddle, rising crest, narrowing — then the view: `tilt`
   * (radians; higher looks down on it), `yaw` and `depth`.
   */
  serviceSilk: [
    { name: 'calm swells', a: [0.11, 1, 0, 0], b: [0, 0, 0, 0], tilt: 0.38, yaw: -0.1, depth: 0.28 },
    { name: 'ripples from the centre', a: [0.04, 1.2, 1, 0], b: [0, 0, 0, 0], tilt: 0.6, yaw: 0, depth: 0.4 },
    { name: 'a rising crest', a: [0.05, 1.3, 0, 0], b: [0, 0, 1, 0], tilt: 0.3, yaw: 0.12, depth: 0.32 },
    { name: 'a twisting sheet', a: [0.07, 0.9, 0, 1.1], b: [0, 0, 0, 0.45], tilt: 0.4, yaw: -0.15, depth: 0.4 },
    { name: 'pleated folds', a: [0.05, 1, 0, 0], b: [1, 0, 0, 0], tilt: 0.42, yaw: 0.08, depth: 0.28 },
    { name: 'a saddle', a: [0.06, 1.1, 0, 0], b: [0, 1, 0, 0], tilt: 0.45, yaw: -0.05, depth: 0.32 },
  ],
  /** Particles behind an inner page (it's only the dot sea, so fewer will do). */
  pageCount: 30000,
  /** Base point size; the shader divides it by distance to the camera. */
  pointSize: 7,
  /** The clock shows the time here. */
  timeZone: 'Europe/London',
};
