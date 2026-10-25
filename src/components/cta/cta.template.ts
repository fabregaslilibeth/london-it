// A call to action: a glass band with its heading, a line or two, an optional
// ticked list and buttons (the phone number among them).
//
//   {{> cta title="Book your free IT review" text="…" button="Get in touch" href="#contact-form"}}
//
// Also rendered from a page section of type "cta" (see page-sections).
// Props: tagline, title, text, button (label), href (default "#contact-form"), phone ("false" to hide).
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import type { Button, PageSection } from '../../../plugins/types';
import { buttons, sectionAttrs, sectionHead } from '../shared/shared.template';

export function renderCta(context: ComponentContext, s: PageSection): string {
  // Just buttons (some live pages have a bare button row): no band to fill.
  if (!s.title && !s.text?.length && !s.list?.length) {
    return `<section class="cta-band cta-band--bare page-section"${sectionAttrs(s)} data-component="cta">
        ${buttons(context, s.buttons)}
      </section>`;
  }
  return `<section class="cta-band page-section"${sectionAttrs(s)} data-component="cta">
        <div class="cta-band__panel">
          ${sectionHead(s)}
          ${s.list?.length ? `<ul class="cta-band__list">${s.list.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</ul>` : ''}
          ${buttons(context, s.buttons)}
        </div>
      </section>`;
}

export default function cta(context: ComponentContext, props: Props): string {
  const list: Button[] = [];
  if (props.button) list.push({ label: props.button, href: props.href ?? '#contact-form' });
  if (props.phone !== 'false') list.push({ phone: true });
  return renderCta(context, { type: 'cta', tagline: props.tagline, title: props.title, text: props.text ? [props.text] : undefined, buttons: list });
}
