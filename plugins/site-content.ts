// Fills index.html with the copy synced from london-itsupport.co.uk
// (content/site.json, written by `npm run sync`). The text lands in the real
// HTML at build time, so it's there for search engines and link previews.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

interface Titled {
  title: string;
  text: string;
}

interface Value extends Titled {
  /** First line of the two-line title on the site — set as the accent. */
  lead: string;
}

export interface SiteContent {
  source: string;
  syncedAt: string;
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string };
  about: { tagline: string; title: string; paragraphs: string[]; pillars: Titled[] };
  values: { tagline: string; title: string; items: Value[] };
  services: { tagline: string; title: string; intro: string; link: string; items: Titled[] };
  caseStudies: { tagline: string; title: string; intro: string; items: { title: string; paragraphs: string[] }[] };
  assessment: { tagline: string; title: string; paragraphs: string[]; benefits: string[]; link: string };
  testimonials: { title: string; intro: string; items: { name: string; text: string; source: string }[] };
  faq: { tagline: string; title: string; items: { question: string; answer: string }[] };
  contact: { strapline: string; address: string; mapUrl: string; phone: string; phoneHref: string; email: string };
}

const CONTENT_FILE = 'content/site.json';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Escaped text with the first occurrence of `phrase` set in the accent colour. */
function accent(text: string, phrase: string): string {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (at < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, at))}<em>${escapeHtml(phrase)}</em>${escapeHtml(text.slice(at + phrase.length))}`;
}

const firstWord = (text: string) => text.split(/\s+/)[0] ?? '';
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

/** The about copy's mission line makes the big statement; falls back to the hero intro. */
function pickStatement(c: SiteContent): string {
  const all = c.about.paragraphs.flatMap(sentences);
  return all.find((s) => /mission/i.test(s)) ?? sentences(c.hero.intro)[0] ?? c.hero.intro;
}

/**
 * The value / service each particle panel features, matched by keyword so the
 * site can reorder its cards. Falls back to position.
 */
function pick<T extends Titled>(items: T[], pattern: RegExp, fallback: number): T {
  return items.find((item) => pattern.test(item.title)) ?? items[Math.min(fallback, items.length - 1)];
}

/**
 * "lon,lat" of the office pin in the site's Google Maps link (the place
 * marker "!3d<lat>!4d<lon>", else the map centre "@lat,lon"); empty if neither.
 */
function officeLonLat(mapUrl: string): string {
  const pin = mapUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? mapUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return pin ? `${pin[2]},${pin[1]}` : '';
}

/** Slides for a sticky slider: `kind` is the BEM block ("service", "pillar"). */
function renderSlides(items: Titled[], kind: string): string {
  return items
    .map(
      (s, i) => `<li class="${kind}${i === 0 ? ' is-active' : ''}">
              <h3 class="${kind}__title">${escapeHtml(s.title)}</h3>
              <p class="${kind}__text">${escapeHtml(s.text)}</p>
            </li>`,
    )
    .join('\n            ');
}

function renderCases(items: SiteContent['caseStudies']['items']): string {
  return items
    .map(
      (c, i) => `<li class="case">
            <span class="case__index">${String(i + 1).padStart(2, '0')}</span>
            <h3 class="case__title">${escapeHtml(c.title)}</h3>
            ${c.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n            ')}
          </li>`,
    )
    .join('\n          ');
}

function renderValues(items: Value[]): string {
  return items
    .map(
      (v) => `<li class="value">
            <h3 class="value__title">${accent(v.title, v.lead)}</h3>
            <p>${escapeHtml(v.text)}</p>
          </li>`,
    )
    .join('\n          ');
}

function renderVoices(items: SiteContent['testimonials']['items']): string {
  return items
    .map(
      (t) => `<li class="voice">
            <blockquote class="voice__quote"><p>${escapeHtml(t.text)}</p></blockquote>
            <p class="voice__who">${escapeHtml(t.name)} <span>· ${escapeHtml(t.source)}</span></p>
          </li>`,
    )
    .join('\n          ');
}

function renderFaq(items: SiteContent['faq']['items']): string {
  return items
    .map(
      (f) => `<details class="faq__item">
            <summary>${escapeHtml(f.question)}</summary>
            <p>${escapeHtml(f.answer)}</p>
          </details>`,
    )
    .join('\n          ');
}

function render(html: string, c: SiteContent): string {
  const support = pick(c.values.items, /24\/7|support/i, 0);
  const security = pick(c.values.items, /cyber|secur/i, c.values.items.length - 1);
  const cloud = pick(c.services.items, /cloud/i, 3);
  const synced = new Date(c.syncedAt);

  const values: Record<string, string> = {
    metaTitle: escapeHtml(c.meta.title),
    metaDescription: escapeHtml(c.meta.description),
    heroEyebrow: escapeHtml(c.hero.eyebrow),
    heroTitle: accent(c.hero.title, 'IT Support'),
    heroIntro: escapeHtml(c.hero.intro),
    aboutTagline: escapeHtml(c.about.tagline),
    statement: escapeHtml(pickStatement(c)),
    supportTitle: accent(support.title, support.lead),
    supportText: escapeHtml(support.text),
    securityTitle: accent(security.title, security.lead),
    securityText: escapeHtml(security.text),
    cloudTitle: accent(cloud.title, firstWord(cloud.title)),
    cloudText: escapeHtml(cloud.text),
    servicesTagline: escapeHtml(c.services.tagline),
    servicesTitle: escapeHtml(c.services.title),
    servicesIntro: escapeHtml(c.services.intro),
    servicesLink: escapeHtml(c.services.link),
    serviceItems: renderSlides(c.services.items, 'service'),
    pillarItems: renderSlides(c.about.pillars, 'pillar'),
    pillarCount: String(c.about.pillars.length).padStart(2, '0'),
    serviceCount: String(c.services.items.length).padStart(2, '0'),
    casesTagline: escapeHtml(c.caseStudies.tagline),
    casesTitle: escapeHtml(c.caseStudies.title),
    casesIntro: escapeHtml(c.caseStudies.intro),
    caseItems: renderCases(c.caseStudies.items),
    valuesTagline: escapeHtml(c.values.tagline),
    valuesTitle: escapeHtml(c.values.title),
    // The two featured in the particle panels aren't repeated here.
    valueItems: renderValues(c.values.items.filter((v) => v !== support && v !== security)),
    voicesTitle: escapeHtml(c.testimonials.title),
    voicesIntro: escapeHtml(c.testimonials.intro),
    voiceItems: renderVoices(c.testimonials.items),
    faqTagline: escapeHtml(c.faq.tagline),
    faqTitle: escapeHtml(c.faq.title),
    faqItems: renderFaq(c.faq.items),
    assessTagline: escapeHtml(c.assessment.tagline),
    assessTitle: accent(c.assessment.title, 'Free'),
    assessText: c.assessment.paragraphs.map((p) => `<p class="contact__text">${escapeHtml(p)}</p>`).join('\n        '),
    assessBenefits: c.assessment.benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join(''),
    assessLink: escapeHtml(c.assessment.link),
    phone: escapeHtml(c.contact.phone),
    phoneHref: escapeHtml(c.contact.phoneHref),
    email: escapeHtml(c.contact.email),
    address: escapeHtml(c.contact.address),
    // "4, 12 Regent St., St. James’S" — the street part, for the map pin.
    addressShort: escapeHtml(c.contact.address.replace(/,?\s*London\b.*$/i, '')),
    officeLonLat: escapeHtml(officeLonLat(c.contact.mapUrl)),
    mapUrl: escapeHtml(c.contact.mapUrl),
    strapline: escapeHtml(c.contact.strapline),
    source: escapeHtml(c.source),
    sourceHost: escapeHtml(new URL(c.source).hostname.replace(/^www\./, '')),
    syncedIso: escapeHtml(c.syncedAt),
    syncedDate: escapeHtml(synced.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })),
    year: String(new Date().getFullYear()),
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (token, key: string) => {
    if (key in values) return values[key];
    throw new Error(`index.html uses unknown placeholder ${token}`);
  });
}

export function siteContent(): Plugin {
  let file = '';
  const read = (): SiteContent => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as SiteContent;
    } catch (error) {
      throw new Error(`Couldn't read ${CONTENT_FILE} (${(error as Error).message}). Run \`npm run sync\` first.`);
    }
  };

  return {
    name: 'site-content',

    configResolved(config: ResolvedConfig) {
      file = resolve(config.root, CONTENT_FILE);
    },

    configureServer(server) {
      // A fresh `npm run sync` reloads the open page.
      server.watcher.add(file);
      server.watcher.on('change', (changed) => {
        if (resolve(changed) === file) server.ws.send({ type: 'full-reload' });
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler: (html) => render(html, read()),
    },
  };
}
