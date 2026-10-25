// A synced page's sections, in order, each through its component:
//
//   intro · benefits · cards · process · stats · plans · cta · prose · faq · partners
//
//   {{> page-sections}}    on a synced page (content/pages/<slug>.json)
//
// The types come from scripts/pages.mjs, which recognises the live page's
// Webflow sections; a new type needs a rule there and a component here.
import type { ComponentContext, Props } from '../../../plugins/components';
import type { PageSection } from '../../../plugins/types';
import benefits from '../benefits/benefits.template';
import cards from '../cards/cards.template';
import { renderCta } from '../cta/cta.template';
import { renderFaq } from '../faq/faq.template';
import intro from '../intro/intro.template';
import partners from '../partners/partners.template';
import plans from '../plans/plans.template';
import process from '../process/process.template';
import prose from '../prose/prose.template';
import { sectionAttrs, sectionHead } from '../shared/shared.template';
import stats from '../stats/stats.template';

const RENDER: Record<PageSection['type'], (context: ComponentContext, section: PageSection) => string> = {
  intro,
  benefits,
  cards,
  process,
  stats,
  plans,
  cta: renderCta,
  prose,
  faq: (_, s) => renderFaq(s, s.id ?? 'faq'),
  partners: (context, s) =>
    `<section class="partner-strip page-section"${sectionAttrs(s)}>
        ${sectionHead(s)}
        ${partners(context, { label: '' })}
      </section>`,
};

export default function pageSections(context: ComponentContext, _props: Props): string {
  const { page } = context;
  if (!page) throw new Error('{{> page-sections}} is for the synced pages (content/pages)');
  return page.sections.map((s) => RENDER[s.type](context, s)).join('\n\n      ');
}
