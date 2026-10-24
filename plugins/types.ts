// The shape of content/site.json, written by `npm run sync` from
// london-itsupport.co.uk and rendered into the pages at build time.

export interface Titled {
  title: string;
  text: string;
}

export interface Value extends Titled {
  /** First line of the two-line title on the site — set as the accent. */
  lead: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export type NavItem = NavLink | { label: string; links: NavLink[] };

export interface EnquiryField {
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkboxes';
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface Enquiry {
  title: string;
  steps: { intro: string; fields: EnquiryField[] }[];
}

export interface FooterGroup {
  label: string;
  href: string | null;
  links: NavLink[];
}

export interface Footer {
  columns: FooterGroup[][];
  copyright: string;
  legal: { label: string; href: string | null }[];
}

/** A logo image on the live site. */
export interface Logo {
  /** From the file name, e.g. "crest" — what components pick logos by. */
  key: string;
  name: string;
  src: string;
  /** Drawn in colour but shown white on dark backgrounds (the live site whitens it with a filter). */
  onDark?: boolean;
}

export interface SiteContent {
  source: string;
  syncedAt: string;
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string };
  /** The certification badges in the banner. */
  accreditations: Logo[];
  /** The logo strip after the banner. */
  partners: Logo[];
  about: { tagline: string; title: string; paragraphs: string[]; pillars: Titled[] };
  values: { tagline: string; title: string; items: Value[] };
  services: { tagline: string; title: string; intro: string; link: string; items: Titled[] };
  caseStudies: { tagline: string; title: string; intro: string; items: { title: string; paragraphs: string[] }[] };
  assessment: { tagline: string; title: string; paragraphs: string[]; benefits: string[]; link: string };
  testimonials: { title: string; intro: string; items: { name: string; text: string; source: string }[] };
  faq: { tagline: string; title: string; items: { question: string; answer: string }[] };
  contact: { strapline: string; address: string; mapUrl: string; phone: string; phoneHref: string; email: string };
  nav: NavItem[];
  enquiry: Enquiry;
  footer: Footer;
}
