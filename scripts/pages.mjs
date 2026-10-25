// Extracts one inner page of london-itsupport.co.uk (a service page, About,
// Contact…) into typed sections that the page components render — see
// src/components/page-sections. Called by sync-content.mjs for every page in
// the site's sitemap.
//
// The live pages are built from a handful of Webflow sections; each is
// recognised by its inner classes (RULES below) and anything else becomes
// plain text ("prose"). The hero's form and the closing contact section aren't
// kept: every page here ends with the enquiry form component instead.
import { parse } from 'node-html-parser';

/** Decoded, whitespace-collapsed text; Webflow pads empty rich text with zero-width joiners. */
const clean = (s) => s.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const decode = (html) => clean(parse(html.replace(/<[^>]+>/g, ' ')).text);
/** Hidden template leftovers on the live pages. */
const PLACEHOLDER = /^(title goes here|description goes here)$/i;
const PHONE = /0\d{3}\s?\d{3}\s?\d{4}/;

// Card and list titles are often bold text rather than headings.
const isHeading = (el) =>
  /^H[1-6]$/.test(el.tagName) || /(^|\s)(heading-style|text-weight-semibold|scroll-heading|_4column-title)/.test(el.getAttribute('class') ?? '');
const isText = (el) => el.tagName === 'P' || /(^|\s)(text-size|text-block|text-weight|text-style-tagline)/.test(el.getAttribute('class') ?? '');
const hasBlocks = (el) => !!el.querySelector('h1,h2,h3,h4,h5,h6,p,ul,ol,[class*="heading-style"],[class*="text-size"]');

/** A text element's paragraphs (Webflow separates them with <br><br>); "• a • b" lines become lists. */
function textBlocks(el) {
  const out = [];
  for (const part of el.innerHTML.split(/(?:<br\s*\/?>\s*){2,}/i)) {
    const text = decode(part);
    if (!text || PLACEHOLDER.test(text)) continue;
    if (text.includes('•')) {
      const [lead, ...items] = text.split(/\s*•\s*/);
      if (lead) out.push({ p: lead });
      out.push({ ul: items.filter(Boolean) });
    } else {
      out.push({ p: text });
    }
  }
  return out;
}

/** Headings, paragraphs and lists in document order, skipping buttons and anything `skip` matches. */
function blocksOf(root, skip = () => false) {
  const out = [];
  const visit = (node) => {
    for (const el of node.childNodes) {
      if (!el.tagName || skip(el)) continue;
      const cls = el.getAttribute('class') ?? '';
      if (/(^|\s)(button-group|button-wrapper|w-button|w-form)/.test(cls) || el.tagName === 'A' || el.tagName === 'FORM') continue;
      if (el.classList.contains('w-richtext')) {
        for (const child of el.childNodes.filter((c) => c.tagName)) {
          if (/^H[1-6]$/.test(child.tagName)) out.push({ h: clean(child.text) });
          else if (child.tagName === 'UL' || child.tagName === 'OL') out.push({ ul: child.querySelectorAll('li').map((li) => clean(li.text)).filter(Boolean) });
          else out.push(...textBlocks(child));
        }
        continue;
      }
      if (isHeading(el) && !hasBlocks(el)) {
        const text = clean(el.text);
        if (text && !PLACEHOLDER.test(text)) out.push({ h: text, tagline: /text-style-tagline/.test(cls) || undefined });
      } else if (el.tagName === 'UL' || el.tagName === 'OL') {
        out.push({ ul: el.querySelectorAll('li').map((li) => clean(li.text)).filter(Boolean) });
      } else if (isText(el) && !hasBlocks(el)) {
        if (/text-style-tagline/.test(cls)) out.push({ h: clean(el.text), tagline: true });
        else out.push(...textBlocks(el));
      } else {
        visit(el);
      }
    }
  };
  visit(root);
  return out.filter((b) => (b.h ?? b.p ?? b.ul?.length));
}

/** Tagline, title and lead paragraphs from the front of a block list; the rest is returned as `blocks`. */
function heading(blocks) {
  const rest = [...blocks];
  const out = {};
  if (rest[0]?.tagline) out.tagline = rest.shift().h;
  if (rest[0]?.h) out.title = rest.shift().h;
  const text = [];
  while (rest[0]?.p) text.push(rest.shift().p);
  if (text.length) out.text = text;
  return { ...out, blocks: rest };
}

/** An item (card, step…): its first heading-ish line is the title, the rest its text. */
function item(el) {
  const blocks = blocksOf(el);
  const titleAt = blocks.findIndex((b) => b.h && !b.tagline);
  const title = titleAt >= 0 ? blocks[titleAt].h : undefined;
  const text = blocks.filter((_, i) => i !== titleAt && blocks[i].p).map((b) => b.p).join(' ');
  return { title, text: text || undefined };
}

function buttons(section, url) {
  const links = section
    .querySelectorAll('.button-group a, .button-group-3 a, .button-wrapper a')
    .filter((a) => !a.closest('form, .w-form'))
    .map((a) => ({ label: clean(a.text), href: new URL(a.getAttribute('href') ?? '#', url).href.replace(/^.*?(#.*)$/, (m, hash) => (m.startsWith(url) ? hash : m)) }))
    .filter((b) => b.label && !PHONE.test(b.label));
  // The phone number sits in an outlined button-like box beside them.
  if (PHONE.test(clean(section.querySelector('.button-group, .button-group-3, .button-wrapper')?.text ?? ''))) links.push({ phone: true });
  return links.length ? links : undefined;
}

const RULES = [
  ['faq', '.faq6_component'],
  ['process', '.timeline10_component'],
  ['stats', '.stats-card'],
  ['plans', '.pricing'],
  ['benefits', '.work_list'],
  ['assessment', '.contact6_component, .cta60_component'],
  ['slides', '.header102_component'],
  ['cards', '.grid-list2_list'],
  ['reasons', '._3-column-container'],
  ['intro', '.right-statement, ._2-column'],
];

function extractSection(el, url) {
  // Anchors the live page links to (#why-choose-us); Webflow's own grid ids (w-node-…) aren't kept.
  const id = [el, ...el.querySelectorAll('[id]')].map((n) => n.getAttribute('id')).find((v) => v && !/^w-node-/.test(v) && !/form/i.test(v));
  const kind = RULES.find(([, selector]) => el.querySelector(selector))?.[0];
  const all = blocksOf(el);
  const text = clean(el.text);
  if (!text) return null;
  const base = { id };

  switch (kind) {
    case 'faq':
      return {
        ...base,
        type: 'faq',
        ...heading(blocksOf(el, (n) => n.classList?.contains('faq6_list') || n.classList?.contains('faq6_accordion'))),
        blocks: undefined,
        items: el.querySelectorAll('.faq6_accordion').map((a) => ({
          title: clean(a.querySelector('.accordion-title, .faq6_question')?.text ?? ''),
          text: clean(a.querySelector('.faq6_answer')?.text ?? ''),
        })),
      };
    case 'process': {
      const items = el.querySelectorAll('.timeline10_item').map(item).filter((i) => i.title);
      return { ...base, type: 'process', ...heading(blocksOf(el, (n) => n.classList?.contains('timeline10_list'))), blocks: undefined, items };
    }
    case 'stats':
      return {
        ...base,
        type: 'stats',
        ...heading(blocksOf(el, (n) => n.classList?.contains('stats-card'))),
        blocks: undefined,
        items: el.querySelectorAll('.stats-card').map((c) => {
          const unit = clean(c.querySelector('.stats-unit-measurement')?.text ?? '');
          // The counter's wrapper holds the unit too ("30MIN"); keep just the figure.
          const value = clean(c.querySelector('.stats-counter')?.text ?? c.querySelector('.number-counter')?.text ?? '');
          return { value: unit && value.endsWith(unit) ? value.slice(0, -unit.length).trim() : value, unit, text: clean(c.querySelector('.stats-description')?.text ?? '') };
        }),
      };
    case 'plans': {
      const plans = el.querySelectorAll('.pricing').map((price) => {
        // The plan's box: the largest ancestor holding only this price.
        let card = price.parentNode;
        while (card.parentNode?.querySelectorAll('.pricing').length === 1 && card.parentNode !== el) card = card.parentNode;
        // Its name and audience are the last heading and tagline before the price.
        const blocks = blocksOf(card);
        const at = blocks.findIndex((b) => b.p === clean(price.text));
        const before = blocks.slice(0, at < 0 ? blocks.length : at);
        return {
          tagline: before.filter((b) => b.tagline).pop()?.h,
          title: before.filter((b) => b.h && !b.tagline).pop()?.h,
          price: clean(price.text),
          features: card.querySelectorAll('.pricing-desc').map((d) => clean(d.text).replace(/^•\s*/, '')),
          buttons: buttons(card, url),
        };
      });
      // The section's own heading: everything before the first plan's box.
      const first = blocksOf(el);
      const firstPlan = first.findIndex((b) => b.h === plans[0]?.tagline || b.h === plans[0]?.title);
      const intro = heading(first.slice(0, firstPlan < 0 ? 0 : firstPlan));
      // Tabbed plan sets repeat plans; keep each once.
      const unique = plans.filter((p, i) => plans.findIndex((o) => o.title === p.title && o.price === p.price) === i);
      return { ...base, type: 'plans', tagline: intro.tagline, title: intro.title, text: intro.text, items: unique };
    }
    case 'benefits':
      return {
        ...base,
        type: 'benefits',
        ...heading(blocksOf(el, (n) => n.classList?.contains('work_list'))),
        blocks: undefined,
        items: [...new Set(el.querySelectorAll('.scroll-heading').map((h) => clean(h.text)))].filter(Boolean).map((title) => ({ title })),
      };
    case 'assessment': {
      const h = heading(blocksOf(el, (n) => n.classList?.contains('contact6_form-block') || n.tagName === 'FORM' || n.tagName === 'UL'));
      return {
        ...base,
        type: 'cta',
        tagline: h.tagline,
        title: h.title,
        text: h.text,
        list: el.querySelectorAll('.assessment-list-item, li').map((li) => clean(li.text).replace(/^[✔✓]\s*/, '')).filter(Boolean),
        buttons: [{ label: 'Claim your free IT assessment', href: '#contact-form' }, { phone: true }],
      };
    }
    case 'slides': {
      const intro = heading(blocksOf(el, (n) => n.classList?.contains('header102_slider')));
      const items = el.querySelectorAll('.header102_slide').map((s) => ({
        title: clean(s.querySelector('.heading-style-h6, h3, h4')?.text ?? ''),
        text: clean(s.querySelector('.services-description, p')?.text ?? ''),
      }));
      return { ...base, type: 'cards', tagline: intro.tagline, title: intro.title, text: intro.text, items: dedupe(items) };
    }
    case 'cards': {
      const list = el.querySelector('.grid-list2_list');
      const cls = list.getAttribute('class') ?? '';
      const items = el.querySelectorAll('.grid-list2_item').map(item).filter((i) => i.title && !PLACEHOLDER.test(i.title));
      const intro = heading(blocksOf(el, (n) => n.classList?.contains('grid-list2_list-wrapper') || n.classList?.contains('grid-list2_list')));
      return { ...base, type: 'cards', tagline: intro.tagline, title: intro.title, text: intro.text, columns: /_4cols/.test(cls) ? 4 : /_2cards/.test(cls) ? 2 : 3, items, buttons: buttons(el, url) };
    }
    case 'reasons': {
      const container = el.querySelector('._3-column-container');
      const items = container.querySelectorAll('.column').map(item).filter((i) => i.title);
      const intro = heading(blocksOf(el, (n) => n.classList?.contains('_3-column-container')));
      return { ...base, type: 'cards', tagline: intro.tagline, title: intro.title, text: intro.text, columns: 3, items, buttons: buttons(el, url) };
    }
    case 'intro': {
      const points = el.querySelectorAll('h3, h4').map((h) => {
        const next = h.nextElementSibling;
        return { title: clean(h.text), text: next && !isHeading(next) ? clean(next.text) : undefined };
      });
      const h = heading(all.filter((b) => !points.some((p) => b.h === p.title || b.p === p.text)));
      return { ...base, type: 'intro', tagline: h.tagline, title: h.title, text: [...(h.text ?? []), ...h.blocks.filter((b) => b.p).map((b) => b.p)], items: points.filter((p) => p.title) };
    }
  }

  if (/^our partners$/i.test(text)) return { ...base, type: 'partners', title: text };
  const h = heading(all);
  const words = all.reduce((n, b) => n + (b.p ?? b.h ?? b.ul?.join(' ') ?? '').length, 0);
  const links = buttons(el, url);
  if (links && words < 260) return { ...base, type: 'cta', tagline: h.tagline, title: h.title, text: h.text, buttons: links };
  return { ...base, type: 'prose', tagline: h.tagline, title: h.title, text: h.text, blocks: h.blocks.length ? h.blocks : undefined, buttons: links };
}

const dedupe = (items) => items.filter((i, n) => i.title && items.findIndex((o) => o.title === i.title) === n);

/** The outermost sections of the page's main content (not the navbar or footer). */
function sectionsOf(root) {
  const isSection = (el) =>
    el.tagName === 'SECTION' || el.tagName === 'HEADER' || /(^|\s)(section[_-]|inner-page-welcome-statement)/.test(el.getAttribute('class') ?? '');
  return root
    .querySelectorAll('section, header, [class*="section_"], [class*="section-"], .inner-page-welcome-statement')
    .filter((el) => isSection(el) && !el.closest('.navbar2_component, .footer1_component'))
    .filter((el) => {
      for (let p = el.parentNode; p && p.tagName; p = p.parentNode) if (isSection(p)) return false;
      return true;
    });
}

export function extractPage(html, url) {
  const root = parse(html.replace(/<br\s*\/?>/gi, '$& '));
  // Webflow keeps conditionally hidden elements in the markup.
  root.querySelectorAll('.w-condition-invisible, script, style, noscript, svg').forEach((el) => el.remove());
  const slug = new URL(url).pathname.replace(/^\/|\/$/g, '');
  const sections = sectionsOf(root);
  const heroEl = sections.find((s) => s.querySelector('.header88_component'));
  const hero = heroEl
    ? {
        title: clean(heroEl.querySelector('h1')?.text ?? ''),
        subtitle: clean(heroEl.querySelector('.header88_card-content p, p.text-size-medium-3, p')?.text ?? '') || undefined,
        buttons: buttons(heroEl.querySelector('.header88_card-content') ?? heroEl, url),
      }
    : { title: clean(root.querySelector('h1, .heading-style-h1')?.text ?? slug) };
  return {
    slug,
    url,
    meta: {
      title: clean(root.querySelector('title')?.text ?? ''),
      description: clean(root.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''),
    },
    hero,
    sections: sections
      .filter((s) => s !== heroEl && !s.querySelector('.contact10_component'))
      .map((s) => extractSection(s, url))
      .filter(Boolean),
  };
}
