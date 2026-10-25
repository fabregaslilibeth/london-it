import { setupMenu } from './menu';
import { setupTheme } from './theme';

/** Wires one header: its menu and the theme switch. */
export function initHeader(root: HTMLElement): void {
  setupMenu(root);
  setupTheme(root.querySelector<HTMLElement>('[data-theme-switch]'));
}
