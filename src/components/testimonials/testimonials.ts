/** Sent on document when the testimonial changes (detail: steps moved, + forward / − back). */
export const TESTIMONIAL_EVENT = 'testimonialchange';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The testimonials showcase. The current person's timer (a CSS animation)
 * fills, then the next quote comes up. It holds while the pointer is over
 * the section, while it has keyboard focus, while it's off screen, and when
 * paused with the button. Reduced motion: no timer, change by hand only.
 * Prev/next, the people, swiping the stage and the arrow keys all move it.
 */
export function setupTestimonials(root: HTMLElement): void {
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide]'));
  const people = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-go]'));
  const part = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const stage = part('[data-stage]');
  const live = part('[data-slides]');
  const indexLabel = part('[data-index]');
  const play = part<HTMLButtonElement>('[data-play]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = { stopped: reducedMotion, hover: false, focus: false, away: true, hidden: document.hidden };
  let current = 0;

  const update = () => {
    root.classList.toggle('is-paused', Object.values(hold).some(Boolean));
    root.classList.toggle('is-stopped', hold.stopped);
    play.setAttribute('aria-label', hold.stopped ? 'Play testimonials' : 'Pause testimonials');
    // Announce changes only while it isn't turning by itself.
    live.setAttribute('aria-live', hold.stopped ? 'polite' : 'off');
  };

  const go = (index: number, step?: number) => {
    const next = (index + slides.length) % slides.length;
    if (next === current) return;
    slides.forEach((slide, i) => {
      const on = i === next;
      slide.classList.toggle('is-active', on);
      slide.toggleAttribute('inert', !on);
      if (on) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });
    people.forEach((person, i) => {
      person.classList.toggle('is-active', i === next);
      if (i === next) person.setAttribute('aria-current', 'true');
      else person.removeAttribute('aria-current');
    });
    // On phones the people are a row that scrolls: bring the new one to the middle.
    const list = people[next].closest('ol');
    if (list && list.scrollWidth > list.clientWidth) {
      const chip = people[next];
      list.scrollTo({ left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2, behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    indexLabel.textContent = pad(next + 1);
    // Replay the quote mark's turn.
    stage.classList.remove('is-turning');
    void stage.offsetWidth;
    stage.classList.add('is-turning');
    document.dispatchEvent(new CustomEvent<number>(TESTIMONIAL_EVENT, { detail: step ?? next - current }));
    current = next;
  };

  // The current person's timer has filled: on to the next.
  people.forEach((person) =>
    person.querySelector('.testimonials__timer')?.addEventListener('animationend', () => {
      if (person.classList.contains('is-active')) go(current + 1, 1);
    }),
  );
  people.forEach((person, i) => person.addEventListener('click', () => go(i)));
  part('[data-prev]').addEventListener('click', () => go(current - 1, -1));
  part('[data-next]').addEventListener('click', () => go(current + 1, 1));
  play.hidden = reducedMotion;
  play.addEventListener('click', () => {
    hold.stopped = !hold.stopped;
    update();
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(current + (e.key === 'ArrowRight' ? 1 : -1), e.key === 'ArrowRight' ? 1 : -1);
  });

  // Swipe the stage.
  let swipe: { x: number; y: number } | null = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) go(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => (swipe = null));

  // A soft glow on the stage follows the cursor.
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--gx', `${e.clientX - r.left}px`);
    stage.style.setProperty('--gy', `${e.clientY - r.top}px`);
  });

  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') {
      hold.hover = true;
      update();
    }
  });
  root.addEventListener('pointerleave', () => {
    hold.hover = false;
    update();
  });
  // Keyboard focus holds it; the focus a click leaves behind doesn't.
  root.addEventListener('focusin', (e) => {
    hold.focus = (e.target as Element).matches(':focus-visible');
    update();
  });
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) hold.focus = false;
    update();
  });
  new IntersectionObserver(([entry]) => {
    hold.away = !entry.isIntersecting;
    update();
  }, { threshold: 0.35 }).observe(root);
  document.addEventListener('visibilitychange', () => {
    hold.hidden = document.hidden;
    update();
  });
  update();
}
