// A grid of cards — features, reasons, services — two, three or four across.
// A card whose title names one of the site's pages ("Managed IT Support")
// links to it. Rendered from a page section of type "cards" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { siteLink } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import { ICONS } from '../../../plugins/icons';
import type { PageSection } from '../../../plugins/types';
import { buttons, pad, sectionAttrs, sectionHead } from '../shared/shared.template';

const key = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

/** The page a card title names, by the menu's labels; null if none. */
function linkFor(title: string, context: ComponentContext): string | null {
  const links = context.content.nav.flatMap((item) => ('links' in item ? item.links : [item]));
  const hit = links.find((l) => key(l.label) === key(title) || key(l.label) === key(title.replace(/\s+services?$/i, '')));
  const href = hit ? siteLink(hit.href, context) : null;
  return href && href.startsWith('/') && href !== '/' ? href : null;
}

export default function cards(context: ComponentContext, s: PageSection): string {
  const items = s.items ?? [];
  const columns = Math.min(s.columns ?? 3, Math.max(items.length, 2));
  return `<section class="cards page-section"${sectionAttrs(s)} data-component="cards">
        ${sectionHead(s)}
        <ul class="cards__grid cards__grid--${columns}">
          ${items
            .map((i, n) => {
              const href = i.title ? linkFor(i.title, context) : null;
              const inner = `<span class="card__index">${pad(n + 1)}</span>
            <h3 class="card__title">${escapeHtml(i.title ?? '')}</h3>
            ${i.text ? `<p class="card__text">${escapeHtml(i.text)}</p>` : ''}${href ? `\n            <span class="card__more">Find out more ${ICONS.arrow}</span>` : ''}`;
              return href
                ? `<li><a class="card card--link" href="${escapeHtml(href)}">${inner}</a></li>`
                : `<li><div class="card">${inner}</div></li>`;
            })
            .join('\n          ')}
        </ul>
        ${buttons(context, s.buttons)}
      </section>`;
}
