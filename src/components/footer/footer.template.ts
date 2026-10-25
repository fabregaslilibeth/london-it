// The site footer, laid out as on london-itsupport.co.uk (always navy): logo,
// strapline, contact details, the synced link columns and legal links.
//
//   {{> footer}}             on the home page
//   {{> footer home="/"}}    on another page
//
// Props: home — where the logo and links to the home page go (default "#top").
import type { ComponentContext, Props } from '../../../plugins/components';
import { siteLink } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import { ICONS } from '../../../plugins/icons';
import { logo } from '../../../plugins/logo';
import type { Footer, FooterGroup } from '../../../plugins/types';

function renderColumns(footer: Footer, context: ComponentContext, home: string): string {
  const { siteRoot } = context;
  const heading = (g: FooterGroup) => {
    // Headings that only point at the home page are labels, except "Home" itself.
    const href = g.href && (g.href !== siteRoot || /^home$/i.test(g.label)) ? siteLink(g.href, context, home) : null;
    return href
      ? `<a class="footer__heading" href="${escapeHtml(href)}">${escapeHtml(g.label)}</a>`
      : `<span class="footer__heading">${escapeHtml(g.label)}</span>`;
  };
  return footer.columns
    .map(
      (groups) => `<div class="footer__column">
          ${groups
            .map(
              (g) => `<div class="footer__group">
            ${heading(g)}${
              g.links.length
                ? `\n            <ul>${g.links.map((l) => `<li><a href="${escapeHtml(siteLink(l.href, context, home))}">${escapeHtml(l.label)}</a></li>`).join('')}</ul>`
                : ''
            }
          </div>`,
            )
            .join('\n          ')}
        </div>`,
    )
    .join('\n        ');
}

export default function footer(context: ComponentContext, props: Props): string {
  const { content, logoFile } = context;
  const home = props.home ?? '#top';
  const { contact, footer: f } = content;
  const synced = new Date(content.syncedAt);
  const host = new URL(content.source).hostname.replace(/^www\./, '');
  const legal = f.legal
    .map((l) => (l.href ? `<li><a href="${escapeHtml(siteLink(l.href, context, home))}">${escapeHtml(l.label)}</a></li>` : `<li>${escapeHtml(l.label)}</li>`))
    .join('');
  return `<footer class="footer" data-component="footer">
      <div class="footer__top">
        <div class="footer__brand">
          <a class="footer__logo" href="${escapeHtml(home)}" aria-label="London IT Support — home">${logo(logoFile)}</a>
          <p class="footer__strapline">${escapeHtml(contact.strapline)}</p>
          <ul class="footer__contact">
            <li><a href="${escapeHtml(contact.mapUrl)}" target="_blank" rel="noopener">${ICONS.home}${escapeHtml(contact.address)}</a></li>
            <li><a href="${escapeHtml(contact.phoneHref)}">${ICONS.phone}${escapeHtml(contact.phone)}</a></li>
            <li><a href="mailto:${escapeHtml(contact.email)}">${ICONS.mail}${escapeHtml(contact.email)}</a></li>
          </ul>
        </div>
        <nav class="footer__columns" aria-label="Footer">
        ${renderColumns(f, context, home)}
        </nav>
      </div>
      <div class="footer__bottom">
        <p>${escapeHtml(f.copyright)}</p>
        <ul class="footer__legal">${legal}</ul>
      </div>
      <p class="footer__credits">
        Copy from <a href="${escapeHtml(content.source)}" target="_blank" rel="noopener">${escapeHtml(host)}</a>, synced
        <time datetime="${escapeHtml(content.syncedAt)}">${escapeHtml(synced.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}</time>
        · Map: contains National Statistics and OS data © Crown copyright and database right 2024
      </p>
    </footer>`;
}
