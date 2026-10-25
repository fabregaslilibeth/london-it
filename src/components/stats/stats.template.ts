// Figures: large numbers with an amber unit and a line saying what they are.
// Rendered from a page section of type "stats" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { buttons, sectionAttrs, sectionHead } from '../shared/shared.template';

export default function stats(context: ComponentContext, s: PageSection): string {
  return `<section class="stats page-section"${sectionAttrs(s)} data-component="stats">
        ${sectionHead(s)}
        <ul class="stats__grid">
          ${(s.items ?? [])
            .map(
              (i) => `<li class="stat">
            <p class="stat__value">${escapeHtml(i.value ?? '')}<span>${escapeHtml(i.unit ?? '')}</span></p>
            <p class="stat__label">${escapeHtml(i.text ?? '')}</p>
          </li>`,
            )
            .join('\n          ')}
        </ul>
        ${buttons(context, s.buttons)}
      </section>`;
}
