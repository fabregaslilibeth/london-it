/** Dark, light, or mix: navy sections with the reading ones on light sheets (style.css: "Mix"). */
export type Theme = 'dark' | 'mix' | 'light';

/** Sent on document after every switch (detail: the new theme). */
export const THEME_EVENT = 'themechange';

const KEY = 'theme';
const THEMES: readonly Theme[] = ['dark', 'mix', 'light'];
const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

/** The theme showing now (the page's inline script sets it before first paint). */
export const currentTheme = (): Theme => {
  const theme = document.documentElement.dataset.theme;
  return isTheme(theme) ? theme : 'mix';
};

/**
 * Wires the theme switch: one button per theme (data-theme-option), the
 * current one pressed. The inline script in the page has already set
 * data-theme before first paint (a saved choice, else mix); a click switches
 * and saves it. Sends a THEME_EVENT on every switch.
 */
export function setupTheme(group: HTMLElement | null): void {
  const root = document.documentElement;
  const options = [...(group?.querySelectorAll<HTMLButtonElement>('[data-theme-option]') ?? [])];

  const apply = (theme: Theme) => {
    root.dataset.theme = theme;
    for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.themeOption === theme));
    // The browser chrome follows the page background.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    document.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
  };

  for (const option of options) {
    option.addEventListener('click', () => {
      const theme = option.dataset.themeOption;
      if (!isTheme(theme) || theme === currentTheme()) return;
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        // Storage blocked (private window): still switch, just not remembered.
      }
      apply(theme);
    });
  }
  apply(currentTheme());
}
