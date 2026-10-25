// How the work runs: numbered steps along a hairline, left to right.
// Rendered from a page section of type "process" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { buttons, pad, sectionAttrs, sectionHead } from '../shared/shared.template';

export default function process(context: ComponentContext, s: PageSection): string {
  return `<section class="process page-section"${sectionAttrs(s)} data-component="process">
        ${sectionHead(s)}
        <ol class="process__steps">
          ${(s.items ?? [])
            .map(
              (i, n) => `<li class="process__step">
            <span class="process__num">${pad(n + 1)}</span>
            <h3 class="process__title">${escapeHtml(i.title ?? '')}</h3>
            ${i.text ? `<p class="process__text">${escapeHtml(i.text)}</p>` : ''}
          </li>`,
            )
            .join('\n          ')}
        </ol>
        ${buttons(context, s.buttons)}
      </section>`;
}
