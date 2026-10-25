// Long-form text — explanations, the privacy policy — in a readable column:
// its heading, then paragraphs, sub-headings and lists, then any buttons.
// Rendered from a page section of type "prose" (see page-sections).
import type { ComponentContext } from '../../../plugins/components';
import type { PageSection } from '../../../plugins/types';
import { blocks, buttons, sectionAttrs, sectionHead } from '../shared/shared.template';

export default function prose(context: ComponentContext, s: PageSection): string {
  return `<section class="prose page-section"${sectionAttrs(s)} data-component="prose">
        ${sectionHead(s)}
        ${s.blocks?.length ? `<div class="prose__body">${blocks(s.blocks)}</div>` : ''}
        ${buttons(context, s.buttons)}
      </section>`;
}
