// The London IT Support logo (src/assets/logo.svg), inlined so it takes the
// text colour; its N is amber (see .logo__n).
import { readFileSync } from 'node:fs';

const inlineSvg = (file: string) =>
  readFileSync(file, 'utf8').trim().replace('<svg ', '<svg class="logo" aria-hidden="true" focusable="false" ');

/** The logo, minus the letter numbers only the preloader uses. */
export function logo(file: string): string {
  return inlineSvg(file).replace(/ data-letter="\d+"/g, '');
}

/**
 * The logo for the preloader: every path gets pathLength="1" so CSS can draw
 * it stroke by stroke, a --i (source order, which the N's pieces use) and a
 * --l (its letter, numbered left to right in the SVG's data-letter) to
 * stagger by; the two rules beside "IT SUPPORT" become the progress bars.
 */
export function loaderLogo(file: string): string {
  let i = 0;
  let rule = 0;
  return inlineSvg(file)
    .replace('class="logo"', 'class="logo loader-logo"')
    .replace(/<path data-letter="(\d+)"/g, (tag, l) => `${tag} pathLength="1" style="--i:${i++};--l:${l}"`)
    .replace(/<rect data-letter="(\d+)"/g, (tag, l) => `${tag} class="loader-logo__rule loader-logo__rule--${rule++ ? 'right' : 'left'}" style="--l:${l}"`);
}
