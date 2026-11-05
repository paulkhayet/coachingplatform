const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
  nav.classList.remove('open');
}
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
matchMedia('(min-width: 601px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const flowTabs = [...document.querySelectorAll('[data-flow]')];
function selectFlow(tab, focus = false) {
  flowTabs.forEach(item => {
    const selected = item === tab;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  if (focus) tab.focus();
}
flowTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectFlow(tab));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % flowTabs.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index + flowTabs.length - 1) % flowTabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = flowTabs.length - 1;
    if (target !== undefined) { event.preventDefault(); selectFlow(flowTabs[target], true); }
  });
});

const prices = { monthly: { solo: 39, studio: 99, practice: 199 }, yearly: { solo: 31, studio: 79, practice: 159 } };
let billing = 'monthly';
document.querySelectorAll('[data-billing]').forEach(button => {
  button.addEventListener('click', () => {
    billing = button.dataset.billing;
    document.querySelectorAll('[data-billing]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-price]').forEach(item => { item.textContent = prices[billing][item.dataset.price]; });
    document.querySelectorAll('[data-billing-note]').forEach(item => {
      const annual = prices.yearly[item.dataset.billingNote] * 12;
      item.textContent = billing === 'yearly' ? `$${annual.toLocaleString('en-US')} billed yearly at launch` : 'Billed monthly at launch';
    });
  });
});

const dialog = document.getElementById('waitlist-dialog');
const form = document.getElementById('waitlist-form');
const success = document.getElementById('form-success');
const message = document.getElementById('form-message');
const submitButton = form.querySelector('[type="submit"]');
const initialSubmitMarkup = submitButton.innerHTML;
let submitting = false;
document.querySelectorAll('[data-waitlist]').forEach(button => {
  button.addEventListener('click', () => {
    closeMenu();
    if (!submitting) {
      form.hidden = false;
      success.hidden = true;
      message.textContent = '';
      form.elements.plan.value = button.dataset.plan || 'undecided';
    }
    dialog.showModal();
  });
});
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  if (location.protocol === 'file:') {
    message.textContent = 'The signup service is unavailable in a file preview. Please open this page through the local server.';
    return;
  }
  submitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Saving your interest…';
  message.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ email: form.elements.email.value.trim(), plan: form.elements.plan.value, billing, website: form.elements.website.value })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'We couldn’t save your interest just now. Please try again.');
    form.hidden = true;
    success.hidden = false;
    form.reset();
    success.querySelector('button').focus();
  } catch (error) {
    message.textContent = error.name === 'AbortError' ? 'That took a little too long. Please try again.' : error.message;
  } finally {
    clearTimeout(timeout);
    submitting = false;
    submitButton.disabled = false;
    submitButton.innerHTML = initialSubmitMarkup;
  }
});
