// Testimonials (synced from the live site) as a showcase: one quote at a
// time, large on a glass stage, its words rising in; the people beside it,
// the current one's timer filling before the next comes up. Prev/next, pause,
// swipe and the arrow keys; the galaxy of dots behind turns as it changes
// (testimonials.ts).
//
//   {{> testimonials}}    as section #voices
import type { ComponentContext, Props } from '../../../plugins/components';
import { escapeHtml } from '../../../plugins/html';
import { ICONS } from '../../../plugins/icons';

/** Quotes longer than this get a smaller size, so the stage holds steady. */
const LONG = 220;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Each word in a clipping box, numbered, so it can rise in after the last. */
const words = (text: string) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => `<span class="testimonial__word"><span style="--i:${i}">${escapeHtml(w)}</span></span>`)
    .join(' ');

const pad = (n: number) => String(n).padStart(2, '0');

export default function testimonials({ content }: ComponentContext, _props: Props): string {
  const { title, intro, items } = content.testimonials;
  const total = pad(items.length);
  const slides = items
    .map(
      (t, i) => `<figure class="testimonial${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}" data-slide${i === 0 ? '' : ' aria-hidden="true" inert'}>
              <blockquote class="testimonial__quote${t.text.length > LONG ? ' testimonial__quote--long' : ''}"><p>${words(t.text)}</p></blockquote>
              <figcaption class="testimonial__who">
                <span class="testimonial__avatar" aria-hidden="true">${escapeHtml(initials(t.name))}</span>
                <span><span class="testimonial__name">${escapeHtml(t.name)}</span><span class="testimonial__source">${escapeHtml(t.source)}</span></span>
              </figcaption>
            </figure>`,
    )
    .join('\n            ');
  const people = items
    .map(
      (t, i) => `<li><button class="testimonials__person${i === 0 ? ' is-active' : ''}" type="button" data-go="${i}" aria-label="${escapeHtml(t.name)}"${i === 0 ? ' aria-current="true"' : ''}>
              <span class="testimonials__avatar" aria-hidden="true">${escapeHtml(initials(t.name))}</span>
              <span class="testimonials__person-text"><span class="testimonials__name">${escapeHtml(t.name)}</span><span class="testimonials__source">${escapeHtml(t.source)}</span></span>
              <span class="testimonials__timer" aria-hidden="true"></span>
            </button></li>`,
    )
    .join('\n          ');

  return `<section class="testimonials" id="voices" data-component="testimonials" aria-roledescription="carousel" aria-label="${escapeHtml(title)}">
      <div class="testimonials__intro">
        <p class="eyebrow">${escapeHtml(title)}</p>
        <h2 class="section-title">${escapeHtml(intro)}</h2>
        <ol class="testimonials__people" aria-label="Choose a testimonial">
          ${people}
        </ol>
      </div>
      <div class="testimonials__main">
        <div class="testimonials__stage" data-stage>
          <span class="testimonials__mark" aria-hidden="true">“</span>
          <div class="testimonials__slides" aria-live="off" data-slides>
            ${slides}
          </div>
        </div>
        <div class="testimonials__controls">
          <p class="testimonials__count" aria-hidden="true"><span data-index>01</span> / ${total}</p>
          <button class="testimonials__button testimonials__button--prev" type="button" data-prev aria-label="Previous testimonial">${ICONS.arrow}</button>
          <button class="testimonials__button" type="button" data-next aria-label="Next testimonial">${ICONS.arrow}</button>
          <button class="testimonials__button" type="button" data-play aria-label="Pause testimonials">
            <svg class="testimonials__pause" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1"/><rect x="9.4" y="3" width="2.6" height="10" rx="1"/></svg>
            <svg class="testimonials__play" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>
          </button>
        </div>
      </div>
    </section>`;
}
