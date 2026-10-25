// Fills the pages with the copy synced from london-itsupport.co.uk (written
// by `npm run sync`): first the components ({{> header}} and so on, see
// components.ts), then the page's own {{placeholders}}. The text lands in the
// real HTML at build time, so it's there for search engines and link previews.
//
// Besides the hand-written pages (index.html…), every synced inner page
// (content/pages/<slug>.json) is built at /<slug>/ from one template,
// src/pages/page.html — served on the fly in dev, emitted as
// <slug>/index.html in the build. No HTML file per page.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { expandComponents, siteLink, type ComponentContext } from './components';
import { escapeHtml } from './html';
import { ICONS } from './icons';
import { loaderLogo } from './logo';
import type { PageContent, SiteContent, Titled, Value } from './types';

const CONTENT_FILE = 'content/site.json';
const PAGES_DIR = 'content/pages';
const PAGE_TEMPLATE = 'src/pages/page.html';
const LOGO_FILE = 'src/assets/logo.svg';

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

/** The "how we work" pillars, all on one screen; CSS numbers them. */
function renderPillars(items: Titled[]): string {
  return items
    .map(
      (p) => `<li class="pillar">
            <h3 class="pillar__title">${escapeHtml(p.title)}</h3>
            <p class="pillar__text">${escapeHtml(p.text)}</p>
          </li>`,
    )
    .join('\n          ');
}

/** Slides for a sticky slider: `kind` is the BEM block ("service"). */
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

function render(template: string, c: SiteContent, pages: PageContent[], logoFile: string, page?: PageContent): string {
  const support = pick(c.values.items, /24\/7|support/i, 0);
  const security = pick(c.values.items, /cyber|secur/i, c.values.items.length - 1);
  const cloud = pick(c.services.items, /cloud/i, 3);
  const context: ComponentContext = { content: c, pages, page, siteRoot: new URL('/', c.source).href, logoFile };
  const html = expandComponents(template, context);

  const values: Record<string, string> = {
    loaderLogo: loaderLogo(logoFile),
    iconArrow: ICONS.arrow,
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
    servicesLink: escapeHtml(siteLink(c.services.link, context)),
    serviceItems: renderSlides(c.services.items, 'service'),
    pillarItems: renderPillars(c.about.pillars),
    serviceCount: String(c.services.items.length).padStart(2, '0'),
    casesTagline: escapeHtml(c.caseStudies.tagline),
    casesTitle: escapeHtml(c.caseStudies.title),
    casesIntro: escapeHtml(c.caseStudies.intro),
    caseItems: renderCases(c.caseStudies.items),
    valuesTagline: escapeHtml(c.values.tagline),
    valuesTitle: escapeHtml(c.values.title),
    // The two featured in the particle panels aren't repeated here.
    valueItems: renderValues(c.values.items.filter((v) => v !== support && v !== security)),
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
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (token, key: string) => {
    if (key in values) return values[key];
    throw new Error(`Page uses unknown placeholder ${token}`);
  });
}

const readJson = <T>(file: string): T => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (error) {
    throw new Error(`Couldn't read ${file} (${(error as Error).message}). Run \`npm run sync\` first.`);
  }
};

/** The synced inner pages, by file name. */
function readPages(dir: string): PageContent[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => readJson<PageContent>(resolve(dir, f)));
}

/** "/managed-it-support/", "/managed-it-support/index.html" → its slug. */
const slugOf = (path: string) => path.split('?')[0].replace(/^\/|\/?(index\.html)?$/g, '');

export function siteContent(): Plugin {
  let root = process.cwd();
  const at = (path: string) => resolve(root, path);
  const pages = () => readPages(at(PAGES_DIR));
  /** The page an HTML request or entry is for, if it's one of the synced pages. */
  const pageFor = (path: string) => {
    const slug = slugOf(path);
    return slug ? pages().find((p) => p.slug === slug) : undefined;
  };
  /** Build entries look like <root>/<slug>/index.html, though no such file exists. */
  const entryFor = (slug: string) => resolve(root, slug, 'index.html');
  const isEntry = (id: string) => pages().some((p) => entryFor(p.slug) === resolve(id));

  return {
    name: 'site-content',
    enforce: 'pre',

    config(config) {
      root = resolve(config.root ?? process.cwd());
      const input = Object.fromEntries(pages().map((p) => [`pages/${p.slug}`, entryFor(p.slug)]));
      return { build: { rollupOptions: { input } } };
    },

    configResolved(config: ResolvedConfig) {
      root = config.root;
    },

    resolveId(id) {
      return isEntry(id) ? resolve(id) : null;
    },

    load(id) {
      return isEntry(id) ? readFileSync(at(PAGE_TEMPLATE), 'utf8') : null;
    },

    configureServer(server) {
      // A fresh `npm run sync` (or a template edit) reloads the open page.
      server.watcher.add([at(CONTENT_FILE), at(PAGES_DIR), at(PAGE_TEMPLATE)]);
      server.watcher.on('change', (changed) => {
        const file = resolve(changed);
        if (file === at(CONTENT_FILE) || file === at(PAGE_TEMPLATE) || file.startsWith(at(PAGES_DIR))) {
          server.ws.send({ type: 'full-reload' });
        }
      });
      // Serve the synced pages at /<slug>/ from the template.
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!/^\/[a-z0-9-]+(\/(index\.html)?)?$/.test(url) || !pageFor(url)) return next();
        if (!url.endsWith('/') && !url.endsWith('.html')) {
          res.writeHead(301, { Location: `${url}/` }).end();
          return;
        }
        try {
          const html = await server.transformIndexHtml(url, readFileSync(at(PAGE_TEMPLATE), 'utf8'), req.originalUrl);
          res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
        } catch (error) {
          next(error);
        }
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => render(html, readJson<SiteContent>(at(CONTENT_FILE)), pages(), at(LOGO_FILE), pageFor(ctx.path)),
    },
  };
}
