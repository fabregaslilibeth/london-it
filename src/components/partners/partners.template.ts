// The partner logos from the strip after the live site's banner, as clean
// one-colour marks.
//
//   {{> partners}}
//   {{> partners label="Our partners"}}
//
// Props: label — the caption (default "Partners & accreditations";
// label="" for none).
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';

export default function partners({ content }: ComponentContext, props: Props): string {
  if (!content.partners.length) return '';
  const label = props.label ?? 'Partners & accreditations';
  return `<div class="partners" data-component="partners">
            ${label ? `<p class="partners__label">${escapeHtml(label)}</p>` : ''}
            <ul class="partners__list">
              ${content.partners
                .map(
                  (l) =>
                    `<li><img class="partners__logo partners__logo--${escapeHtml(l.key)}" src="${escapeHtml(l.src)}" alt="${escapeHtml(l.name)}" title="${escapeHtml(l.name)}" loading="lazy" decoding="async" /></li>`,
                )
                .join('\n              ')}
            </ul>
          </div>`;
}
