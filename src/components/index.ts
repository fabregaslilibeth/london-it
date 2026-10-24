// The components' styles and browser behaviour. Their HTML is rendered into
// the pages at build time (plugins/components.ts); this wires up whatever
// instances a page has.
import './header/header.css';
import './enquiry/enquiry.css';
import './footer/footer.css';
import './accreditations/accreditations.css';
import './partners/partners.css';
import { initHeader } from './header/header';
import { setupEnquiry } from './enquiry/enquiry';

export { MENU_LOCK_EVENT } from './header/menu';
export { THEME_EVENT, currentTheme, type Theme } from './header/theme';

export function initComponents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-component="header"]').forEach(initHeader);
  root.querySelectorAll<HTMLFormElement>('[data-component="enquiry"] form[data-enquiry]').forEach(setupEnquiry);
}
