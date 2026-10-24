/** Adds `is-in` to each element the first time enough of it scrolls into view. */
export function revealOnScroll(elements: Iterable<Element>, threshold = 0.35): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { threshold },
  );
  for (const el of elements) observer.observe(el);
}

/** Splits statements into words that rise in one after another on scroll. */
export function setupReveals(elements: Iterable<HTMLElement>): void {
  const list = Array.from(elements);
  for (const el of list) {
    const words = (el.textContent ?? '').trim().split(/\s+/);
    el.setAttribute('aria-label', words.join(' '));
    el.textContent = '';
    words.forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'word';
      outer.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.textContent = word;
      inner.style.setProperty('--i', String(i));
      outer.append(inner);
      el.append(outer, ' ');
    });
  }
  revealOnScroll(list);
}
