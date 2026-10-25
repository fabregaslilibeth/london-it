// The enquiry form: the live site's banner form, step for step (synced), as a
// frosted-glass pane beside the contact details. Use it as often as you like:
//
//   {{> enquiry}}                                     id "enquiry"
//   {{> enquiry id="contact-form" title="Talk to us"}}
//   {{> enquiry id="enquiry" partners="true"}}        with the partner logos
//
// Props: id — the section's id, also prefixing the form's field ids, so it
// must be unique on the page (default "enquiry"); title (default the form's
// title on the live site); partners="true" adds the partner logo strip.
// In the mix theme it's always a light sheet.
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml, slug } from '../../../plugins/html';
import { ICONS } from '../../../plugins/icons';
import type { Enquiry, EnquiryField } from '../../../plugins/types';
import partners from '../partners/partners.template';

const AUTOCOMPLETE: Record<string, string> = {
  'full-name': 'name',
  email: 'email',
  'phone-number': 'tel',
  'company-name': 'organization',
  'company-postcode': 'postal-code',
  'your-job-title': 'organization-title',
};

function renderField(f: EnquiryField, step: number, prefix: string): string {
  const id = `${prefix}-${slug(f.name)}`;
  const label = `${escapeHtml(f.label)}${f.required ? ' <span aria-hidden="true">*</span>' : ''}`;
  const common = `id="${id}" name="${escapeHtml(f.name)}"${f.required ? ' required' : ''}`;
  const auto = AUTOCOMPLETE[f.name] ? ` autocomplete="${AUTOCOMPLETE[f.name]}"` : '';
  const placeholder = f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '';
  switch (f.type) {
    case 'checkboxes':
      return `<fieldset class="form-field form-field--wide">
                <legend class="form-field__label">${escapeHtml(f.label)}</legend>
                <div class="checks">
                  ${(f.options ?? []).map((o, i) => `<label class="check"><input type="checkbox" name="${escapeHtml(f.name)}" value="${escapeHtml(o)}" id="${id}-${step}-${i}" /><span>${escapeHtml(o)}</span></label>`).join('\n                  ')}
                </div>
              </fieldset>`;
    case 'select':
      return `<label class="form-field" for="${id}">
                <span class="form-field__label">${label}</span>
                <select ${common}>
                  <option value="">Select…</option>
                  ${(f.options ?? []).map((o) => `<option>${escapeHtml(o)}</option>`).join('')}
                </select>
              </label>`;
    case 'textarea':
      return `<label class="form-field form-field--wide" for="${id}">
                <span class="form-field__label">${label}</span>
                <textarea ${common} rows="4"${placeholder}></textarea>
              </label>`;
    default:
      return `<label class="form-field" for="${id}">
                <span class="form-field__label">${label}</span>
                <input type="${f.type}" ${common}${auto}${placeholder} />
              </label>`;
  }
}

function renderSteps(enquiry: Enquiry, prefix: string): string {
  return enquiry.steps
    .map(
      (s, i) => `<fieldset class="enquiry__step${i === 0 ? ' is-active' : ''}" data-step${i === 0 ? '' : ' hidden'}>
            <legend class="enquiry__intro">${escapeHtml(s.intro)}</legend>
            <div class="enquiry__fields">
              ${s.fields.map((f) => renderField(f, i, prefix)).join('\n              ')}
            </div>
          </fieldset>`,
    )
    .join('\n          ');
}

/** An (escaped) email that, if it must wrap, breaks after the @ — not at a hyphen in the domain. */
function emailLines(email: string): string {
  const at = email.indexOf('@');
  return at < 0 ? email : `${email.slice(0, at + 1)}<wbr><span class="enquiry__nowrap">${email.slice(at + 1)}</span>`;
}

/**
 * The form on its own: the frosted pane with its steps. `prefix` keeps its
 * field ids unique on the page; `title`, if given, heads the pane (the
 * enquiry section heads its aside instead). The inner page banner uses it too.
 */
export function renderEnquiryForm(context: ComponentContext, prefix: string, title?: string): string {
  const { enquiry: form, contact } = context.content;
  const steps = form.steps.length;
  const total = String(steps).padStart(2, '0');
  const phone = escapeHtml(contact.phone);
  const email = escapeHtml(contact.email);
  const titleId = `${prefix}-title`;
  return `<form class="enquiry__form" data-enquiry data-mailto="${email}" data-phone="${phone}" novalidate${title ? ` aria-labelledby="${titleId}"` : ''}>
          ${title ? `<h2 class="enquiry__form-title" id="${titleId}">${escapeHtml(title)}</h2>` : ''}
          <div class="enquiry__head" aria-hidden="true">
            <p class="enquiry__count"><span data-step-number>01</span> / ${total}</p>
            <ol class="enquiry__progress">${form.steps.map((_, i) => `<li${i === 0 ? ' class="is-current"' : ''}></li>`).join('')}</ol>
          </div>
          <p class="visually-hidden" aria-live="polite" data-step-status>Step 1 of ${steps}</p>
          ${renderSteps(form, prefix)}
          <p class="enquiry__error" data-error role="alert" hidden></p>
          <div class="enquiry__actions" data-actions>
            <button class="enquiry__back" type="button" data-back hidden>${ICONS.arrow}Back</button>
            <button class="button button--primary" type="button" data-next>Next ${ICONS.arrow}</button>
            <button class="button button--primary" type="submit" data-submit hidden>Send enquiry ${ICONS.arrow}</button>
          </div>
          <div class="enquiry__done" data-done hidden tabindex="-1">
            <p class="enquiry__done-title">Thank you</p>
            <p data-done-text></p>
          </div>
        </form>`;
}

export default function enquiry(context: ComponentContext, props: Props): string {
  const { enquiry: form, contact } = context.content;
  const id = slug(props.id ?? 'enquiry') || 'enquiry';
  const phone = escapeHtml(contact.phone);
  const email = escapeHtml(contact.email);
  return `<section class="enquiry" id="${id}" data-component="enquiry" data-tone="light">
        <div class="enquiry__aside">
          <h2 class="section-title">${escapeHtml(props.title ?? form.title)}</h2>
          <ul class="enquiry__contact">
            <li><a href="${escapeHtml(contact.phoneHref)}"><span class="enquiry__label">Call</span><span class="enquiry__value">${phone}</span>${ICONS.arrow}</a></li>
            <li><a href="mailto:${email}"><span class="enquiry__label">Email</span><span class="enquiry__value">${emailLines(email)}</span>${ICONS.arrow}</a></li>
            <li><a href="${escapeHtml(contact.mapUrl)}" target="_blank" rel="noopener"><span class="enquiry__label">Visit</span><span class="enquiry__value">${escapeHtml(contact.address)}</span>${ICONS.arrow}</a></li>
          </ul>
          ${props.partners === 'true' ? partners(context, {}) : ''}
        </div>
        ${renderEnquiryForm(context, id)}
      </section>`;
}
