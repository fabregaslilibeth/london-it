// Components: reusable sections rendered into any page at build time.
//
//   {{> enquiry id="contact-form" title="Talk to us"}}
//
// Each lives in src/components/<name>/: <name>.template.ts renders its HTML
// from the synced content (here, at build time), <name>.css styles it and
// <name>.ts, if it has one, wires it up in the browser (src/components/index.ts).
import accreditations from '../src/components/accreditations/accreditations.template';
import enquiry from '../src/components/enquiry/enquiry.template';
import footer from '../src/components/footer/footer.template';
import header from '../src/components/header/header.template';
import partners from '../src/components/partners/partners.template';
import type { SiteContent } from './types';

export interface ComponentContext {
  content: SiteContent;
  /** The live site's home page; links to it are made local. */
  siteRoot: string;
  logoFile: string;
}

/** The attributes on the tag, e.g. { id: 'contact-form' }. */
export type Props = Record<string, string | undefined>;

export type Template = (context: ComponentContext, props: Props) => string;

export const templates: Record<string, Template> = { accreditations, enquiry, footer, header, partners };

/** Replaces every {{> name key="value"}} tag with that component's HTML. */
export function expandComponents(html: string, context: ComponentContext): string {
  return html.replace(/\{\{>\s*([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*\}\}/g, (tag, name: string, attrs: string) => {
    const template = templates[name];
    if (!template) throw new Error(`Unknown component ${tag} (known: ${Object.keys(templates).join(', ')})`);
    const props = Object.fromEntries(Array.from(attrs.matchAll(/([\w-]+)="([^"]*)"/g), (m) => [m[1], m[2]]));
    return template(context, props);
  });
}

/** Links to the live site's home page point at this site's `home` instead. */
export const localise = (href: string, siteRoot: string, home: string) => (href === siteRoot ? home : href);
