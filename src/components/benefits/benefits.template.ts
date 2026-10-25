// What a service includes: a numbered list in two columns, between hairlines.
// Rendered from a page section of type "benefits" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { buttons, pad, sectionAttrs, sectionHead } from '../shared/shared.template';

export default function benefits(context: ComponentContext, s: PageSection): string {
  return `<section class="benefits page-section"${sectionAttrs(s)} data-component="benefits">
        ${sectionHead({ tagline: s.tagline ?? 'Included', title: s.title, text: s.text })}
        <ol class="benefits__list">
          ${(s.items ?? []).map((i, n) => `<li><span class="benefits__num">${pad(n + 1)}</span><span class="benefits__text">${escapeHtml(i.title ?? '')}</span></li>`).join('\n          ')}
        </ol>
        ${buttons(context, s.buttons)}
      </section>`;
}
