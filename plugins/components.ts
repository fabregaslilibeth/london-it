// Components: reusable sections rendered into any page at build time.
//
//   {{> enquiry id="contact-form" title="Talk to us"}}
//
// Each lives in src/components/<name>/: <name>.template.ts renders its HTML
// from the synced content (here, at build time), <name>.css styles it and
// <name>.ts, if it has one, wires it up in the browser (src/components/index.ts).
import accreditations from '../src/components/accreditations/accreditations.template';
import enquiry from '../src/components/enquiry/enquiry.template';
import faq from '../src/components/faq/faq.template';
import footer from '../src/components/footer/footer.template';
import head from '../src/components/head/head.template';
import header from '../src/components/header/header.template';
import pageHero from '../src/components/page-hero/page-hero.template';
import pageSections from '../src/components/page-sections/page-sections.template';
import partners from '../src/components/partners/partners.template';
import testimonials from '../src/components/testimonials/testimonials.template';
import type { PageContent, SiteContent } from './types';

export interface ComponentContext {
  content: SiteContent;
  /** Every inner page synced from the live site. */
  pages: PageContent[];
  /** The page being built, for the page components; absent on hand-written pages. */
  page?: PageContent;
  /** The live site's home page; links into the live site are made local. */
  siteRoot: string;
  logoFile: string;
}

/** The attributes on the tag, e.g. { id: 'contact-form' }. */
export type Props = Record<string, string | undefined>;

export type Template = (context: ComponentContext, props: Props) => string;

export const templates: Record<string, Template> = {
  accreditations,
  enquiry,
  faq,
  footer,
  head,
  header,
  'page-hero': pageHero,
  'page-sections': pageSections,
  partners,
  testimonials,
};

/** Replaces every {{> name key="value"}} tag with that component's HTML. */
export function expandComponents(html: string, context: ComponentContext): string {
  return html.replace(/\{\{>\s*([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*\}\}/g, (tag, name: string, attrs: string) => {
    const template = templates[name];
    if (!template) throw new Error(`Unknown component ${tag} (known: ${Object.keys(templates).join(', ')})`);
    const props = Object.fromEntries(Array.from(attrs.matchAll(/([\w-]+)="([^"]*)"/g), (m) => [m[1], m[2]]));
    return template(context, props);
  });
}

/**
 * A link into the live site made local: its home page → `home`, a page this
 * site has → /<slug>/ (keeping any #anchor); anything else is left alone.
 */
export function siteLink(href: string, { siteRoot, pages }: ComponentContext, home = '/'): string {
  if (!href.startsWith(siteRoot)) return href;
  const url = new URL(href);
  const slug = url.pathname.replace(/^\/|\/$/g, '');
  if (!slug) return url.hash || home;
  return pages.some((p) => p.slug === slug) ? `/${slug}/${url.hash}` : href;
}

/** The live site's contact pages; on this site every page ends with the enquiry form. */
const CONTACT = /^\/(contact|contact-us)\/?$/;

/** Where a call-to-action goes: contact links → the form on this page; others as siteLink. */
export function actionLink(href: string, context: ComponentContext): string {
  if (href.startsWith(context.siteRoot) && CONTACT.test(new URL(href).pathname)) return '#contact-form';
  return siteLink(href, context);
}

/** The menu group a page sits under ("IT Services", "Connectivity"…), if any. */
export function groupOf(slug: string, { content, siteRoot }: ComponentContext): string | undefined {
  const target = new URL(slug, siteRoot).href.replace(/\/$/, '');
  return content.nav.find((item) => 'links' in item && item.links.some((l) => l.href.replace(/\/$/, '') === target))?.label;
}
