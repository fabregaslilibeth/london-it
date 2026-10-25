// The top of an inner page: a breadcrumb (Home / its menu group / the page),
// the live page's title, subtitle and buttons, and the certification badges,
// with the enquiry form on the right (dark glass in the mix theme too). The
// dot sea spreads across the lower half of the screen behind it.
//
//   {{> page-hero}}    on a synced page (content/pages/<slug>.json)
import type { ComponentContext, Props } from '../../../plugins/components';
import { groupOf } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import accreditations from '../accreditations/accreditations.template';
import { renderEnquiryForm } from '../enquiry/enquiry.template';
import { buttons } from '../shared/shared.template';

/** What the menu calls a page, else its title on the live site up to the "|". */
export function pageName(slug: string, context: ComponentContext): string {
  const target = new URL(slug, context.siteRoot).href.replace(/\/$/, '');
  for (const item of context.content.nav) {
    const links = 'links' in item ? item.links : [item];
    const hit = links.find((l) => l.href.replace(/\/$/, '') === target);
    if (hit) return hit.label;
  }
  const page = context.pages.find((p) => p.slug === slug);
  return page?.meta.title.split('|')[0].trim() || page?.hero.title || slug;
}

export default function pageHero(context: ComponentContext, _props: Props): string {
  const { page } = context;
  if (!page) throw new Error('{{> page-hero}} is for the synced pages (content/pages)');
  const group = groupOf(page.slug, context);
  return `<section class="page-hero" id="hero" data-component="page-hero">
        <div class="page-hero__copy">
          <nav class="page-hero__crumbs" aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>${group ? `\n              <li>${escapeHtml(group)}</li>` : ''}
              <li aria-current="page">${escapeHtml(pageName(page.slug, context))}</li>
            </ol>
          </nav>
          <h1 class="page-hero__title">${escapeHtml(page.hero.title)}</h1>
          ${page.hero.subtitle ? `<p class="page-hero__subtitle">${escapeHtml(page.hero.subtitle)}</p>` : ''}
          ${buttons(context, page.hero.buttons, 'page-hero__actions')}
          ${accreditations(context, {})}
        </div>
        <div class="page-hero__form">
          ${renderEnquiryForm(context, 'hero-enquiry', context.content.enquiry.title)}
        </div>
      </section>`;
}
