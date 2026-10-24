import { setupMenu } from './menu';
import { setupTheme } from './theme';

/** Wires one header: its menu and the light/dark toggle. */
export function initHeader(root: HTMLElement): void {
  setupMenu(root);
  setupTheme(root.querySelector<HTMLButtonElement>('[data-theme-toggle]'));
}
