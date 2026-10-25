// Questions and answers as an accordion, beside their heading.
//
//   {{> faq}}    the home page's FAQs (synced), as section #faq
//
// Page FAQs come through page-sections, with the same markup. In the mix
// theme it's always a light sheet.
// Props: id (default "faq").
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { PageSection } from '../../../plugins/types';
import { sectionHead } from '../shared/shared.template';

export function renderFaq(section: PageSection, id = 'faq'): string {
  return `<section class="faq" id="${escapeHtml(id)}" data-component="faq" data-tone="light">
        <div class="faq__head">${sectionHead(section)}</div>
        <div class="faq__list">
          ${(section.items ?? [])
            .map(
              (q) => `<details class="faq__item">
            <summary>${escapeHtml(q.title ?? '')}</summary>
            <p>${escapeHtml(q.text ?? '')}</p>
          </details>`,
            )
            .join('\n          ')}
        </div>
      </section>`;
}

export default function faq({ content }: ComponentContext, props: Props): string {
  return renderFaq(
    {
      type: 'faq',
      title: content.faq.title,
      tagline: content.faq.tagline,
      items: content.faq.items.map((f) => ({ title: f.question, text: f.answer })),
    },
    props.id,
  );
}
