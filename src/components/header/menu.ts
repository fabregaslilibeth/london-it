/** Sent on document while the phone menu opens or closes (detail: open). */
export const MENU_LOCK_EVENT = 'menulock';

/**
 * Navbar behaviour. On desktop the dropdowns open on hover (CSS) and on
 * click or Enter, for keyboard and touch; on phones the menu button opens a
 * full-screen menu whose dropdowns expand in place. While that menu is open
 * the page is locked (`is-locked` on <html>) and a MENU_LOCK_EVENT goes out,
 * so a page with smooth scrolling can pause it.
 */
export function setupMenu(topbar: HTMLElement): void {
  const onLock = (locked: boolean) => {
    document.documentElement.classList.toggle('is-locked', locked);
    document.dispatchEvent(new CustomEvent<boolean>(MENU_LOCK_EVENT, { detail: locked }));
  };
  const items = Array.from(topbar.querySelectorAll<HTMLElement>('[data-dropdown]'));
  const toggle = topbar.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const phoneLayout = matchMedia('(max-width: 1100px)');

  const setOpen = (item: HTMLElement, open: boolean) => {
    item.classList.toggle('is-open', open);
    item.querySelector('.menu__trigger')?.setAttribute('aria-expanded', String(open));
  };
  const closeAll = (except?: HTMLElement) => items.forEach((item) => item !== except && setOpen(item, false));

  for (const item of items) {
    item.querySelector('.menu__trigger')?.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      closeAll(item);
      setOpen(item, open);
    });
    // A dropdown opened by click closes when the mouse moves on, like hover.
    item.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !phoneLayout.matches) setOpen(item, false);
    });
    // Moving onto a dropdown closes any other — including one still holding
    // keyboard focus, which would otherwise stay open beside it.
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || phoneLayout.matches) return;
      closeAll(item);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && !item.contains(focused) && items.some((other) => other.contains(focused))) {
        focused.blur();
      }
    });
  }

  const setMenu = (open: boolean) => {
    topbar.classList.toggle('is-menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    onLock(open);
    if (!open) closeAll();
  };
  toggle?.addEventListener('click', () => setMenu(!topbar.classList.contains('is-menu-open')));
  phoneLayout.addEventListener('change', () => setMenu(false));

  // Following any link closes everything.
  topbar.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setMenu(false);
  });
  document.addEventListener('click', (e) => {
    if (!topbar.contains(e.target as Node)) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAll();
    if (topbar.classList.contains('is-menu-open')) {
      setMenu(false);
      toggle?.focus();
    }
  });
}
