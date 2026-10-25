// Pieces the section components share: a section's heading (tagline, title,
// lead paragraphs), its buttons and prose. Build time only.
import type { ComponentContext } from '../../../plugins/components';
import { actionLink } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import { ICONS } from '../../../plugins/icons';
import type { Block, Button, PageSection } from '../../../plugins/types';

/** Tagline, title and lead paragraphs, each only if given. */
export function sectionHead(s: { tagline?: string; title?: string; text?: string[] }, level = 'h2'): string {
  const parts = [
    s.tagline ? `<p class="eyebrow">${escapeHtml(s.tagline)}</p>` : '',
    s.title ? `<${level} class="section-title">${escapeHtml(s.title)}</${level}>` : '',
    ...(s.text ?? []).map((p) => `<p class="section-lead">${escapeHtml(p)}</p>`),
  ].filter(Boolean);
  return parts.length ? `<div class="section-head">${parts.join('\n')}</div>` : '';
}

/** Buttons: the first link is the primary one; the phone number is always the outlined one. */
export function buttons(context: ComponentContext, list: Button[] | undefined, className = ''): string {
  if (!list?.length) return '';
  const { phone, phoneHref } = context.content.contact;
  let primary = true;
  const html = list.map((b) => {
    if (b.phone) return `<a class="button button--ghost" href="${escapeHtml(phoneHref)}">${ICONS.phone.replace("<svg ", "<svg class=\"button__icon\" ")}${escapeHtml(phone)}</a>`;
    const kind = primary ? 'button--primary' : 'button--ghost';
    primary = false;
    return `<a class="button ${kind}" href="${escapeHtml(actionLink(b.href, context))}">${escapeHtml(b.label)} ${ICONS.arrow}</a>`;
  });
  return `<div class="button-row ${className}">${html.join('')}</div>`;
}

/** Prose blocks: headings, paragraphs and lists. */
export function blocks(list: Block[] | undefined): string {
  return (list ?? [])
    .map((b) => {
      if ('h' in b) return b.tagline ? `<p class="eyebrow">${escapeHtml(b.h)}</p>` : `<h3>${escapeHtml(b.h)}</h3>`;
      if ('p' in b) return `<p>${escapeHtml(b.p)}</p>`;
      return `<ul>${b.ul.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</ul>`;
    })
    .join('\n');
}

/** Two-digit numbering: 01, 02… */
export const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The reading sections, which sit on light sheets in the mix theme (FAQs
 * too: see the faq component). Cards, steps, figures, prices and calls to
 * action stay on the navy, with the dots.
 */
const LIGHT_IN_MIX = new Set<PageSection['type']>(['intro', 'benefits', 'prose', 'partners']);

/** A section's own attributes: its anchor, if it has one, and its tone in the mix theme. */
export const sectionAttrs = ({ type, id }: Pick<PageSection, 'type' | 'id'>) =>
  `${id ? ` id="${escapeHtml(id)}"` : ''}${LIGHT_IN_MIX.has(type) ? ' data-tone="light"' : ''}`;
