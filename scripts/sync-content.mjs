// Pulls the homepage copy from london-itsupport.co.uk into content/site.json,
// which plugins/site-content.ts renders into index.html at build time.
//
//   npm run sync             fetch the live page and overwrite the snapshot
//   npm run sync -- --soft   on any failure, keep the existing snapshot
//   SITE_URL=… npm run sync  read another copy of the page (e.g. a staging URL)
//
// Selectors follow the Webflow class names on the live page. If the page is
// restructured and a section can't be found, the sync fails loudly rather than
// writing half-empty content.
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'node-html-parser';

const SOURCE = process.env.SITE_URL || 'https://www.london-itsupport.co.uk/';
const OUT = new URL('../content/site.json', import.meta.url);
const soft = process.argv.includes('--soft');

/** Decoded, whitespace-collapsed text; Webflow pads empty rich-text paragraphs with zero-width joiners. */
const clean = (s) => s.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();

/** One service description on the live page is pasted twice in a row. */
function dedupeRepeat(s) {
  const half = s.length / 2;
  return Number.isInteger(half) && s.slice(0, half) === s.slice(half) ? s.slice(0, half) : s;
}

const uniqueBy = (items, key) => items.filter((item, i) => items.findIndex((other) => key(other) === key(item)) === i);

function extract(html) {
  // <br> separates words in several headings ("24/7<br>Support Availability");
  // a space after each keeps them apart in .text.
  const root = parse(html.replace(/<br\s*\/?>/gi, '$& '));
  const one = (selector, scope = root) => {
    const el = scope.querySelector(selector);
    if (!el) throw new Error(`"${selector}" not found on ${SOURCE}`);
    return el;
  };
  const all = (selector, scope = root) => scope.querySelectorAll(selector);
  const text = (selector, scope) => clean(one(selector, scope).text);
  const texts = (selector, scope) => all(selector, scope).map((el) => clean(el.text)).filter(Boolean);
  const url = (href) => new URL(href, SOURCE).href;
  /** The `.slot` heading block several sections share: tagline, title, sub-line. */
  const sectionOf = (selector) => {
    const el = one(selector).closest('section');
    if (!el) throw new Error(`"${selector}" isn't inside a <section>`);
    return el;
  };

  const hero = one('.section_header111');
  const about = one('.section_header144');
  const valuesSection = sectionOf('.grid-list2_list');
  const services = one('.section_header102');
  const cases = sectionOf('.casestudytext');
  const assessment = one('#Assessment');
  const voices = sectionOf('.testimonial-card');
  const faq = one('.section_faq6');
  const footer = one('.footer1_component');
  const phone = one('a[href^="tel:"]', footer);
  const email = one('a[href^="mailto:"]', footer);

  // Value titles are two lines on the site ("Certified" / "Cybersecurity
  // Experts"); the first line is kept as the accent.
  const values = all('.grid-list2_item-content', valuesSection).map((card) => {
    const titleEl = one('.grid-list2_title-wrapper > :first-child', card);
    const lead = clean(titleEl.innerHTML.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, ''));
    return { title: clean(titleEl.text), lead, text: text('.text-size-small', card) };
  });

  const link = (a) => ({ label: clean(a.text), href: url(a.getAttribute('href')) });
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Logos are referenced where the live site hosts them. Each gets a key from
  // its file name ("…_crest.avif" → "crest") that components pick them by.
  const logoKey = (src) => slug(decodeURIComponent(src.split('/').pop().replace(/^[0-9a-f]+_/, '').replace(/\.\w+$/, '')));
  // The banner's certification badges have no alt text, so they're named here.
  const BADGE_NAMES = {
    'iso-logo': 'ISO 9001 and ISO 27001 certified',
    'cyber-essential': 'Cyber Essentials certified',
    'cyber-essential-plus': 'Cyber Essentials Plus certified',
    crest: 'CREST',
    pentest: 'Penetration testing',
    vonahi: 'Vonahi Security',
  };
  const accreditations = all('.logo-credit-wrapper img', hero).map((img) => {
    const src = url(img.getAttribute('src'));
    const key = logoKey(src);
    return { key, name: BADGE_NAMES[key] ?? key, src, onDark: img.classList.contains('white') };
  });
  // The strip after the banner repeats its logos for the marquee; the first set will do.
  const partners = all('.banner12_text-wrapper img', one('.banner12_marquee', one('.section_banner12'))).map((img) => {
    const src = url(img.getAttribute('src'));
    const name = clean(img.getAttribute('alt') ?? '').replace(/\s+(company\s+)?logo\b.*$/i, '');
    return { key: logoKey(src).replace(/-/g, ''), name, src };
  });

  // Navbar, in order: plain links and dropdowns of links.
  const nav = all('.navbar2_menu > *', one('.navbar2_component')).flatMap((item) => {
    if (item.tagName === 'A') return [link(item)];
    const toggle = item.querySelector('.w-dropdown-toggle');
    return toggle ? [{ label: clean(toggle.text), links: all('.w-dropdown-list a', item).map(link) }] : [];
  });

  // The banner's three-step enquiry form: each step's intro and its fields.
  // Labels aren't always tied to inputs by id, so the field's own wrapper is
  // the fallback; checkboxes become one group under their heading.
  const fieldsOf = (step) => {
    const fields = [];
    let checkboxes = null;
    for (const input of all('input, select, textarea', step)) {
      const type = input.tagName === 'SELECT' ? 'select' : input.tagName === 'TEXTAREA' ? 'textarea' : input.getAttribute('type') ?? 'text';
      if (type === 'submit' || type === 'hidden') continue;
      if (type === 'checkbox') {
        if (!checkboxes) {
          const heading = clean(step.querySelector('.form13_checkbox-group')?.parentNode.querySelector('div')?.text ?? 'Options');
          checkboxes = { type: 'checkboxes', name: slug(heading.replace(/\(.*\)/, '')), label: heading, options: [] };
          fields.push(checkboxes);
        }
        checkboxes.options.push(clean(input.closest('label')?.text ?? ''));
        continue;
      }
      const id = input.getAttribute('id');
      const labelEl = (id && step.querySelector(`label[for="${id}"]`)) || input.closest('.multi-form3_field-wrapper')?.querySelector('label');
      const label = clean(labelEl?.text ?? '').replace(/\*$/, '');
      fields.push({
        type,
        name: type === 'email' ? 'email' : slug(label),
        label,
        placeholder: input.getAttribute('placeholder') ?? '',
        required: input.hasAttribute('required'),
        ...(type === 'select' ? { options: all('option', input).map((o) => clean(o.text)).filter(Boolean) } : {}),
      });
    }
    return fields;
  };
  const formSteps = all('[data-form="step"]', one('form[data-form="multistep"]'));

  // Footer link columns: headings (some are links) each followed by a list.
  const footerColumns = all('.footer1_link-column', footer).map((column) => {
    const groups = [];
    for (const child of column.childNodes) {
      if (child.nodeType !== 1) continue;
      const heading = child.querySelector('.footer-links-heading');
      if (heading) {
        const a = child.tagName === 'A' ? child : child.querySelector('a');
        groups.push({ label: clean(heading.text), href: a ? url(a.getAttribute('href')) : null, links: [] });
      } else if (child.classList.contains('footer1_link-list') && groups.length) {
        groups[groups.length - 1].links = all('a', child).map(link);
      }
    }
    return groups;
  });

  return {
    source: SOURCE,
    syncedAt: new Date().toISOString(),
    meta: {
      title: clean(one('title').text),
      description: clean(one('meta[name="description"]').getAttribute('content') ?? ''),
    },
    hero: {
      eyebrow: text('.eyebrow', hero),
      title: text('h1', hero),
      intro: text('.header111_content-left p', hero),
    },
    accreditations,
    partners,
    about: {
      tagline: text('.text-style-tagline', about),
      title: text('h1', about),
      paragraphs: texts('.about-description-container p', about),
      pillars: all('.layout423_card').map((card) => ({ title: text('h2', card), text: text('p', card) })),
    },
    values: {
      tagline: text('.text-style-tagline', valuesSection),
      title: text('h6', valuesSection),
      items: values,
    },
    services: {
      tagline: text('.text-style-tagline', services),
      title: text('h1', services),
      intro: text('.header102_content > p', services),
      link: url(one('.header102_content a[href]', services).getAttribute('href')),
      items: uniqueBy(
        all('.header102_slide', services).map((slide) => ({
          title: text('.heading-style-h6', slide),
          text: dedupeRepeat(text('.services-description', slide)),
        })),
        (s) => s.title,
      ),
    },
    caseStudies: {
      tagline: text('.text-style-tagline', cases),
      title: text('h6', cases),
      intro: text('.text-size-regular', cases),
      items: uniqueBy(
        all('.casestudytext', cases).map((item) => ({
          title: text('.casestudytitle', item),
          paragraphs: texts('.rich-text-block p', item),
        })),
        (c) => c.title,
      ),
    },
    assessment: {
      tagline: text('.contact6_content-left .text-style-tagline', assessment),
      title: text('h2', assessment),
      paragraphs: texts('.contact6_content-left p', assessment),
      benefits: texts('.assessment-list-item', assessment).map((b) => b.replace(/^[✔✓]\s*/, '')),
      link: url('/#Assessment'),
    },
    testimonials: {
      title: text('h6', voices),
      intro: text('.text-size-regular', voices),
      items: uniqueBy(
        all('.testimonial-card', voices).map((card) => ({
          name: text('.testimonial-name', card),
          text: text('.testimonial-text', card),
          source: text('.testimonial-source', card),
        })),
        (t) => t.name.toLowerCase(),
      ),
    },
    faq: {
      tagline: text('.text-style-tagline', faq),
      title: text('h6', faq),
      items: all('.faq6_accordion', faq).map((item) => ({
        question: text('.accordion-title', item),
        answer: text('.faq6_answer', item),
      })),
    },
    contact: {
      strapline: text('.contact-subtitle', footer),
      address: text('a[href*="google.com/maps"] .footer-links-heading', footer),
      mapUrl: one('a[href*="google.com/maps"]', footer).getAttribute('href'),
      phone: clean(phone.text) || phone.getAttribute('href').slice(4),
      phoneHref: phone.getAttribute('href'),
      email: email.getAttribute('href').slice(7),
    },
    nav,
    enquiry: {
      title: text('.heading-style-h4', formSteps[0]),
      steps: formSteps.map((step) => ({
        intro: text('.margin-top.margin-xsmall', step),
        fields: fieldsOf(step),
      })),
    },
    footer: {
      columns: footerColumns,
      copyright: text('.footer1_credit-text', footer),
      // Some legal items on the site are plain text rather than links.
      legal: all('.footer1_legal-link', footer).map((el) => ({
        label: clean(el.text),
        href: el.tagName === 'A' ? url(el.getAttribute('href')) : null,
      })),
    },
  };
}

/** Throws if anything the page relies on came back empty. */
function validate(c) {
  const problems = [];
  const need = (ok, what) => ok || problems.push(what);
  need(c.hero.title, 'hero title');
  need(c.hero.intro, 'hero intro');
  need(c.accreditations.length, 'banner certification badges');
  need(c.partners.length && c.partners.every((p) => p.name), 'partner logos after the banner');
  need(c.about.paragraphs.length, 'about paragraphs');
  need(c.about.pillars.length, 'about pillars ("how we work")');
  need(c.nav.some((item) => item.links?.length), 'navbar dropdowns');
  need(c.enquiry.steps.length && c.enquiry.steps.every((s) => s.fields.length), 'enquiry form steps');
  need(c.footer.columns.length && c.footer.columns.every((col) => col.length), 'footer link columns');
  need(c.values.items.length >= 3, 'at least 3 values');
  need(c.services.items.length >= 3, 'at least 3 services');
  need(c.services.items.every((s) => s.title && s.text), 'service titles and descriptions');
  need(c.caseStudies.items.length, 'case studies');
  need(c.testimonials.items.length, 'testimonials');
  need(c.faq.items.length, 'FAQs');
  need(/^tel:/.test(c.contact.phoneHref), 'phone number');
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact.email), 'email address');
  if (problems.length) throw new Error(`Missing from ${SOURCE}: ${problems.join(', ')}`);
}

async function main() {
  const response = await fetch(SOURCE, { headers: { 'user-agent': 'london-itsupport-site content sync' } });
  if (!response.ok) throw new Error(`${SOURCE} answered ${response.status} ${response.statusText}`);
  const content = extract(await response.text());
  validate(content);

  // Keep the old timestamp when nothing changed, so the snapshot only shows
  // up in git when the site's copy did.
  const previous = await readFile(OUT, 'utf8').then(JSON.parse, () => null);
  const comparable = (c) => JSON.stringify({ ...c, syncedAt: undefined });
  if (previous && comparable(previous) === comparable(content)) {
    console.log(`[sync] content/site.json already matches ${SOURCE}`);
    return;
  }
  await writeFile(OUT, `${JSON.stringify(content, null, 2)}\n`);
  console.log(
    `[sync] wrote content/site.json from ${SOURCE}: ${content.services.items.length} services, ` +
      `${content.values.items.length} values, ${content.caseStudies.items.length} case studies, ` +
      `${content.testimonials.items.length} testimonials, ${content.faq.items.length} FAQs`,
  );
}

main().catch(async (error) => {
  const hasSnapshot = await readFile(OUT).then(() => true, () => false);
  if (soft && hasSnapshot) {
    console.warn(`[sync] ${error.message}\n[sync] keeping the existing content/site.json`);
    return;
  }
  console.error(`[sync] ${error.message}`);
  process.exitCode = 1;
});
