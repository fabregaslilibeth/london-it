export type Theme = 'light' | 'dark';

/** Sent on document after every switch (detail: the new theme). */
export const THEME_EVENT = 'themechange';

const KEY = 'theme';

/** The theme showing now (the page's inline script sets it before first paint). */
export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/**
 * Wires the light/dark toggle. The inline script in the page has already
 * set data-theme before first paint; this keeps it in step with clicks
 * (saved for next time) and with the system setting while there's no saved
 * choice. Sends a THEME_EVENT on every switch.
 */
export function setupTheme(button: HTMLButtonElement | null): void {
  const root = document.documentElement;
  const onChange = (theme: Theme) => document.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
  const saved = (): Theme | null => {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };

  const apply = (theme: Theme) => {
    root.dataset.theme = theme;
    button?.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    // The browser chrome follows the page background.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    onChange(theme);
  };

  button?.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked (private window): still switch, just not remembered.
    }
    apply(next);
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!saved()) apply(e.matches ? 'light' : 'dark');
  });
  apply(currentTheme());
}
