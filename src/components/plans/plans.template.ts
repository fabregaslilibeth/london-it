// Packages and prices: one glass card per plan — who it suits, its name, the
// price, what's included and its buttons. Rendered from a page section of
// type "plans" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { buttons, sectionAttrs, sectionHead } from '../shared/shared.template';

/** "£37 monthly" → the figure large, the rest small; anything else as it is. */
function price(text: string): string {
  const m = text.match(/^(£\s?[\d.,]+)\s*(.*)$/);
  return m ? `${escapeHtml(m[1])}<span>${escapeHtml(m[2])}</span>` : `<span class="plan__price-text">${escapeHtml(text)}</span>`;
}

export default function plans(context: ComponentContext, s: PageSection): string {
  const items = s.items ?? [];
  return `<section class="plans page-section"${sectionAttrs(s)} data-component="plans">
        ${sectionHead(s)}
        <ul class="plans__grid${items.length === 1 ? ' plans__grid--single' : ''}">
          ${items
            .map(
              (p) => `<li class="plan">
            ${p.tagline ? `<p class="plan__for">${escapeHtml(p.tagline)}</p>` : ''}
            <h3 class="plan__name">${escapeHtml(p.title ?? '')}</h3>
            ${p.price ? `<p class="plan__price">${price(p.price)}</p>` : ''}
            ${p.features?.length ? `<ul class="plan__features">${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
            ${buttons(context, p.buttons, 'plan__actions')}
          </li>`,
            )
            .join('\n          ')}
        </ul>
        ${buttons(context, s.buttons)}
      </section>`;
}
