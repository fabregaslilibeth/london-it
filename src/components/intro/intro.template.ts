// A page's opening statement: the heading on the left; the lead and its
// points (each a title and a line) on the right, between hairlines.
// Rendered from a page section of type "intro" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { buttons, sectionAttrs, sectionHead } from '../shared/shared.template';

export default function intro(context: ComponentContext, s: PageSection): string {
  return `<section class="page-intro page-section"${sectionAttrs(s)} data-component="intro">
        ${sectionHead({ tagline: s.tagline, title: s.title })}
        <div class="page-intro__body">
          ${(s.text ?? []).map((p) => `<p class="page-intro__lead">${escapeHtml(p)}</p>`).join('\n          ')}
          ${
            s.items?.length
              ? `<ul class="page-intro__points">${s.items
                  .map((i) => `<li><h3>${escapeHtml(i.title ?? '')}</h3>${i.text ? `<p>${escapeHtml(i.text)}</p>` : ''}</li>`)
                  .join('')}</ul>`
              : ''
          }
          ${buttons(context, s.buttons)}
        </div>
      </section>`;
}
