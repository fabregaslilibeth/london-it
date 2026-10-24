// Look-and-feel defaults. The copy lives in content/site.json, synced from
// london-itsupport.co.uk (`npm run sync`).
export const config = {
  /** Particles on desktop. Touch devices get `count * mobileRatio`. */
  count: 46000,
  mobileRatio: 0.5,

  color: '#e9eefb',
  /** Brand amber: second hand, scan line, uploads, packets, and dots near the cursor. */
  accent: '#ffaa00',

  formationSeconds: 2.6,
  exposure: 0.36,
  /** Base point size; the shader divides it by distance to the camera. */
  pointSize: 7,
  /** The clock shows the time here. */
  timeZone: 'Europe/London',
};
