// The components' styles and browser behaviour. Their HTML is rendered into
// the pages at build time (plugins/components.ts); this wires up whatever
// instances a page has.
import './header/header.css';
import './enquiry/enquiry.css';
import './footer/footer.css';
import './accreditations/accreditations.css';
import './partners/partners.css';
import './faq/faq.css';
import './page-hero/page-hero.css';
import './intro/intro.css';
import './benefits/benefits.css';
import './cards/cards.css';
import './process/process.css';
import './stats/stats.css';
import './plans/plans.css';
import './cta/cta.css';
import './prose/prose.css';
import './testimonials/testimonials.css';
import { initHeader } from './header/header';
import { setupEnquiry } from './enquiry/enquiry';
import { setupTestimonials } from './testimonials/testimonials';

export { MENU_LOCK_EVENT } from './header/menu';
export { THEME_EVENT, currentTheme, type Theme } from './header/theme';
export { TESTIMONIAL_EVENT } from './testimonials/testimonials';

export function initComponents(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-component="header"]').forEach(initHeader);
  root.querySelectorAll<HTMLElement>('[data-component="testimonials"]').forEach(setupTestimonials);
  // The enquiry section's form, and the same form on its own (inner page banners).
  root.querySelectorAll<HTMLFormElement>('form[data-enquiry]').forEach(setupEnquiry);
}
