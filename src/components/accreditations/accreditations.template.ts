// The certification badges from the live site's banner, in a quiet row.
//
//   {{> accreditations}}
//   {{> accreditations only="cyber-essential,crest"}}
//
// Props: only — which badges, by key, in order (default Cyber Essentials,
// Cyber Essentials Plus, CREST, Pen Test, Vonahi); label — the caption
// (default "Certified & accredited"; label="" for none).
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';

const DEFAULT = 'cyber-essential,cyber-essential-plus,crest,pentest,vonahi';

export default function accreditations({ content }: ComponentContext, props: Props): string {
  const keys = (props.only ?? DEFAULT).split(',').map((k) => k.trim());
  const logos = keys.flatMap((key) => content.accreditations.filter((l) => l.key === key));
  if (!logos.length) return '';
  const label = props.label ?? 'Certified & accredited';
  return `<div class="accreditations" data-component="accreditations">
            ${label ? `<p class="accreditations__label">${escapeHtml(label)}</p>` : ''}
            <ul class="accreditations__list">
              ${logos
                .map(
                  (l) =>
                    `<li><img class="accreditations__logo${l.onDark ? ' accreditations__logo--on-dark' : ''}" src="${escapeHtml(l.src)}" alt="${escapeHtml(l.name)}" title="${escapeHtml(l.name)}" loading="lazy" decoding="async" /></li>`,
                )
                .join('\n              ')}
            </ul>
          </div>`;
}
