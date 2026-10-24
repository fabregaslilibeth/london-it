// The site header: a floating bar laid out after intouchtech.co.uk, with
// London IT Support's own menu (synced from its site) as mega-menu dropdowns,
// the light/dark toggle and a contact button.
//
//   {{> header}}                                   on the home page
//   {{> header home="/" contact="#contact-form"}}  on another page
//
// Props: home — where the logo and "Home" link go (default "#top");
// contact — the contact button's target (default "#enquiry").
import type { ComponentContext, Props } from '../../../plugins/components';
import { localise } from '../../../plugins/components';
import { escapeHtml, slug } from '../../../plugins/html';
import { ICONS, svg } from '../../../plugins/icons';
import { logo } from '../../../plugins/logo';
import type { NavItem } from '../../../plugins/types';

/** An icon for each menu group, matched by name; a generic grid otherwise. */
function groupIcon(label: string): string {
  if (/it|service|cyber/i.test(label)) return svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>');
  if (/connect|broadband|wifi/i.test(label)) return svg('<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.6"/>');
  if (/mobile|sim/i.test(label)) return svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>');
  if (/tele|phone|voice/i.test(label)) return svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4" height="6" rx="1.5"/><rect x="17.5" y="14" width="4" height="6" rx="1.5"/>');
  return svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>');
}

function renderNav(items: NavItem[], siteRoot: string, home: string): string {
  return items
    .map((item) => {
      if (!('links' in item)) {
        return `<li class="menu__item"><a class="menu__link" href="${escapeHtml(localise(item.href, siteRoot, home))}">${escapeHtml(item.label)}</a></li>`;
      }
      const id = `menu-${slug(item.label)}`;
      return `<li class="menu__item menu__item--dropdown" data-dropdown>
            <button class="menu__trigger" type="button" aria-expanded="false" aria-controls="${id}">${escapeHtml(item.label)}${ICONS.chevron}</button>
            <div class="menu__panel" id="${id}">
              <p class="menu__heading"><span class="menu__icon">${groupIcon(item.label)}</span>${escapeHtml(item.label)}</p>
              <ul class="menu__links${item.links.length > 4 ? ' menu__links--two' : ''}">
                ${item.links.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}${ICONS.arrow}</a></li>`).join('\n                ')}
              </ul>
            </div>
          </li>`;
    })
    .join('\n          ');
}

export default function header({ content, siteRoot, logoFile }: ComponentContext, props: Props): string {
  const home = escapeHtml(props.home ?? '#top');
  const contact = escapeHtml(props.contact ?? '#enquiry');
  return `<header class="topbar" data-component="header" data-topbar>
      <div class="topbar__bar">
        <a class="brand" href="${home}" aria-label="London IT Support — home">${logo(logoFile)}</a>
        <nav class="menu" id="site-menu" aria-label="Main">
          <ul class="menu__list">
          ${renderNav(content.nav, siteRoot, props.home ?? '#top')}
          <li class="menu__item menu__item--cta"><a class="topbar__cta" href="${contact}">Contact us ${ICONS.arrow}</a></li>
          </ul>
        </nav>
        <div class="topbar__actions">
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to light mode">
            <svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
            <svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
              <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
            </svg>
          </button>
          <a class="topbar__cta" href="${contact}">Contact us ${ICONS.arrow}</a>
          <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu" data-menu-toggle>
            <span class="menu-button__open">${ICONS.menu}</span>
            <span class="menu-button__close">${ICONS.close}</span>
          </button>
        </div>
      </div>
    </header>`;
}
