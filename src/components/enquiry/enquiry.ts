/**
 * The three-step enquiry form. Each step's own fields are checked before
 * moving on. With VITE_FORM_ENDPOINT set (a form service such as Formspree,
 * Web3Forms or Basin), the answers are POSTed there; without one, the
 * visitor's email app opens with them filled in, addressed to the site's own
 * email address.
 */
export function setupEnquiry(form: HTMLFormElement): void {
  const steps = Array.from(form.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  const progress = Array.from(form.querySelectorAll<HTMLLIElement>('.enquiry__progress li'));
  const part = <T extends HTMLElement>(selector: string) => form.querySelector<T>(selector)!;
  const back = part<HTMLButtonElement>('[data-back]');
  const next = part<HTMLButtonElement>('[data-next]');
  const submit = part<HTMLButtonElement>('[data-submit]');
  const status = part('[data-step-status]');
  const stepNumber = part('[data-step-number]');
  const error = part('[data-error]');
  const done = part('[data-done]');
  const doneText = part('[data-done-text]');
  const actions = part('[data-actions]');
  const endpoint = import.meta.env.VITE_FORM_ENDPOINT?.trim();
  const email = form.dataset.mailto ?? '';
  const phone = form.dataset.phone ?? '';
  let current = 0;

  const show = (index: number) => {
    current = index;
    // From now on each step's fields rise in as it appears (not on page load).
    form.classList.add('has-moved');
    steps.forEach((step, i) => {
      step.hidden = i !== index;
      step.classList.toggle('is-active', i === index);
    });
    progress.forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.classList.toggle('is-done', i < index);
    });
    back.hidden = index === 0;
    next.hidden = index === steps.length - 1;
    submit.hidden = !next.hidden;
    error.hidden = true;
    status.textContent = `Step ${index + 1} of ${steps.length}`;
    stepNumber.textContent = String(index + 1).padStart(2, '0');
    steps[index].querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
  };

  // Only the current step's fields; the browser's own messages say what's missing.
  const stepIsValid = () => {
    const invalid = Array.from(steps[current].querySelectorAll<HTMLInputElement>('input, select, textarea')).find(
      (field) => !field.checkValidity(),
    );
    invalid?.reportValidity();
    return !invalid;
  };

  next.addEventListener('click', () => stepIsValid() && show(current + 1));
  back.addEventListener('click', () => show(current - 1));
  // Enter in a text field moves on rather than submitting early.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && current < steps.length - 1) {
      e.preventDefault();
      next.click();
    }
  });

  /** "Label: answer" lines, in form order, for the email fallback. */
  const summary = () => {
    const lines: string[] = [];
    for (const field of form.querySelectorAll<HTMLElement>('.form-field')) {
      const label = field.querySelector('.form-field__label')?.textContent?.replace('*', '').trim();
      const answers = Array.from(field.querySelectorAll<HTMLInputElement>('input, select, textarea'))
        .filter((input) => input.type !== 'checkbox' || input.checked)
        .map((input) => input.value.trim())
        .filter(Boolean);
      if (label && answers.length) lines.push(`${label}: ${answers.join(', ')}`);
    }
    return lines.join('\n');
  };

  const finish = (message: string) => {
    steps.forEach((step) => (step.hidden = true));
    actions.hidden = true;
    form.querySelector('.enquiry__progress')?.classList.add('is-complete');
    doneText.textContent = message;
    done.hidden = false;
    done.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!stepIsValid()) return;
    submit.disabled = true;
    error.hidden = true;
    const data = new FormData(form);
    try {
      if (endpoint) {
        const response = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`${response.status}`);
        finish("We've got your details and we'll get back to you by the end of the day.");
      } else {
        const name = String(data.get('full-name') ?? '').trim();
        const subject = `Website enquiry${name ? ` from ${name}` : ''}`;
        location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary())}`;
        finish(`Your email app should open with your enquiry filled in — just press send. Or call us on ${phone}.`);
      }
    } catch {
      submit.disabled = false;
      error.textContent = `Sorry, that didn't go through. Please call us on ${phone} or email ${email}.`;
      error.hidden = false;
    }
  });
}
