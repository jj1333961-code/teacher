import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

const locale = document.documentElement.lang || 'ar';
const names = new Intl.DisplayNames([locale, 'ar', 'en'], { type: 'region' });
const countries = getCountries().map((iso) => ({ iso, name: names.of(iso) || iso, dial: getCountryCallingCode(iso) })).sort((a, b) => a.name.localeCompare(b.name, locale));

const nationalIdRules = {
  EG: { label: 'الرقم القومي المصري', pattern: /^\d{14}$/, hint: '14 رقمًا' },
  SA: { label: 'رقم الهوية/الإقامة السعودي', pattern: /^[12]\d{9}$/, hint: '10 أرقام ويبدأ بـ 1 أو 2' },
  AE: { label: 'رقم الهوية الإماراتية', pattern: /^784\d{12}$/, hint: '15 رقمًا ويبدأ بـ 784' },
  QA: { label: 'رقم البطاقة القطرية', pattern: /^\d{11}$/, hint: '11 رقمًا' },
  KW: { label: 'الرقم المدني الكويتي', pattern: /^[123]\d{11}$/, hint: '12 رقمًا' },
  JO: { label: 'الرقم الوطني الأردني', pattern: /^\d{10}$/, hint: '10 أرقام' },
  DZ: { label: 'رقم التعريف الوطني الجزائري', pattern: /^\d{18}$/, hint: '18 رقمًا' },
  TN: { label: 'رقم بطاقة التعريف التونسية', pattern: /^\d{8}$/, hint: '8 أرقام' },
  TR: { label: 'رقم الهوية التركي', pattern: /^[1-9]\d{10}$/, hint: '11 رقمًا' },
  DE: { label: 'رقم الهوية الألماني', pattern: /^[A-Z0-9]{9,10}$/i, hint: '9 إلى 10 أحرف أو أرقام' },
  GB: { label: 'رقم الهوية/التأمين الوطني', pattern: /^[A-Z0-9]{6,12}$/i, hint: '6 إلى 12 حرفًا أو رقمًا' },
  US: { label: 'رقم الهوية الوطني/الضريبي', pattern: /^\d{9}$/, hint: '9 أرقام' },
  CA: { label: 'رقم الهوية/التأمين الكندي', pattern: /^\d{9}$/, hint: '9 أرقام' },
  MA: { label: 'رقم البطاقة الوطنية المغربية', pattern: /^[A-Z]{1,2}\d{5,8}$/i, hint: 'حرف أو حرفان ثم 5 إلى 8 أرقام' }
};

function options(selected = '', useDialValue = false) {
  return '<option value="">اختر البلد أولًا</option>' + countries.map((country) => `<option value="${useDialValue ? country.dial : country.iso}" data-iso="${country.iso}" data-dial="${country.dial}" ${country.iso === selected ? 'selected' : ''}>${country.name} (+${country.dial})</option>`).join('');
}

function selectedIso(select) {
  return select.selectedOptions[0]?.dataset.iso || select.value;
}

function fieldKind(input) {
  const id = input.id || '';
  const label = input.closest('.form-group')?.querySelector('label')?.textContent || '';
  const text = `${id} ${input.name || ''} ${label}`;
  if (/national|nid|identity|قومي|هوية|مدني|تعريف/i.test(text)) return 'national-id';
  if (/phone|mobile|whats|tel|هاتف|موبايل|جوال|واتساب/i.test(text)) return 'phone';
  return '';
}

function addMessage(input) {
  const message = document.createElement('small');
  message.className = 'country-field-message';
  message.id = `${input.id}-country-message`;
  message.setAttribute('aria-live', 'polite');
  input.insertAdjacentElement('afterend', message);
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
  return message;
}

function enhance(input, kind) {
  if (!input.id || input.dataset.countryEnhanced) return;
  input.dataset.countryEnhanced = 'true';
  input.dataset.countryKind = kind;
  const labelText = input.closest('.form-group')?.querySelector('label')?.textContent || '';
  input.dataset.countryRequired = String(input.required || labelText.includes('*') || /^(adminMobile|confirmMobile|newAdminMobile)$/.test(input.id));
  input.removeAttribute('maxlength');
  input.setAttribute('autocomplete', kind === 'phone' ? 'tel-national' : 'off');
  input.setAttribute('inputmode', kind === 'phone' ? 'tel' : 'text');
  const existing = kind === 'phone' ? document.getElementById(`${input.id}Country`) : null;
  const select = existing || document.createElement('select');
  if (!existing) {
    select.id = `${input.id}Country`;
    select.className = 'country-field-select';
    select.setAttribute('aria-label', `بلد ${kind === 'phone' ? 'رقم الهاتف' : 'وثيقة الهوية'}`);
    input.insertAdjacentElement('beforebegin', select);
  }
  select.dataset.countryFor = input.id;
  select.dataset.countryKind = kind;
  select.dataset.legacyDialValue = existing ? 'true' : 'false';
  select.innerHTML = options('', Boolean(existing));
  select.value = '';
  const message = addMessage(input);
  const validate = () => validateField(input, select, message, false);
  select.addEventListener('change', () => { updateFieldGuide(input, select, message); validate(); });
  input.addEventListener('blur', validate);
  input.addEventListener('input', () => { input.setCustomValidity(''); message.classList.remove('is-error'); });
  updateFieldGuide(input, select, message);
}

function updateFieldGuide(input, select, message) {
  const iso = selectedIso(select);
  const country = countries.find((item) => item.iso === iso);
  if (!country) { message.textContent = 'اختيار البلد مطلوب قبل إدخال الرقم.'; return; }
  if (input.dataset.countryKind === 'phone') message.textContent = `أدخل الرقم المحلي لـ ${country.name} بدون كود الدولة (+${country.dial}).`;
  else {
    const rule = nationalIdRules[country.iso];
    message.textContent = rule ? `${rule.label}: ${rule.hint}.` : `أدخل رقم وثيقة الهوية الرسمي في ${country.name} (قد يتكون من أحرف وأرقام).`;
  }
}

function validateField(input, select, message, focus) {
  const value = input.value.trim().replace(/[\s()-]/g, '');
  let error = '';
  const iso = selectedIso(select);
  const required = input.dataset.countryRequired === 'true';
  if (!value && !required) {
    input.setCustomValidity('');
    message.classList.remove('is-error');
    updateFieldGuide(input, select, message);
    return true;
  }
  if (!iso) error = 'اختر البلد أولًا.';
  else if (!value) error = 'هذا الرقم مطلوب.';
  else if (input.dataset.countryKind === 'phone') {
    const parsed = parsePhoneNumberFromString(value, iso);
    if (!parsed || !parsed.isValid() || parsed.country !== iso) error = `رقم الهاتف لا يطابق صيغة ${names.of(iso)}.`;
    else { input.dataset.internationalValue = parsed.number; input.dataset.countryCode = iso; }
  } else {
    const rule = nationalIdRules[iso];
    if (rule && !rule.pattern.test(value)) error = `${rule.label} يجب أن يكون ${rule.hint}.`;
    else if (!rule && !/^[A-Z0-9][A-Z0-9./-]{3,29}$/i.test(value)) error = 'أدخل رقم هوية رسميًا من 4 إلى 30 حرفًا أو رقمًا.';
    else input.dataset.countryCode = iso;
  }
  input.setCustomValidity(error);
  message.classList.toggle('is-error', Boolean(error));
  if (error) message.textContent = error; else updateFieldGuide(input, select, message);
  if (error && focus) { select.scrollIntoView({ behavior: 'smooth', block: 'center' }); (select.value ? input : select).focus(); }
  return !error;
}

function validateVisiblePage() {
  const page = [...document.querySelectorAll('.page:not(.hidden)')].pop() || document;
  const fields = [...page.querySelectorAll('input[data-country-enhanced="true"]')];
  for (const input of fields) {
    const select = document.getElementById(`${input.id}Country`);
    const message = document.getElementById(`${input.id}-country-message`);
    if (select && message && !validateField(input, select, message, true)) return false;
  }
  return true;
}

function init() {
  document.querySelectorAll('input').forEach((input) => { const kind = fieldKind(input); if (kind) enhance(input, kind); });
  const style = document.createElement('style');
  style.textContent = `.country-field-select{width:100%;margin-bottom:8px;direction:rtl}.country-field-message{display:block;margin-top:6px;color:var(--text-light);font-size:.82rem;line-height:1.5}.country-field-message.is-error{color:var(--danger,#dc3545);font-weight:700}input:invalid[data-country-enhanced=true]{border-color:var(--danger,#dc3545)!important}`;
  document.head.appendChild(style);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[onclick]');
    if (!button || !button.closest('.page:not(.hidden)')) return;
    if (!validateVisiblePage()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.CountryFields = { validateVisiblePage, getInternationalValue(id) { return document.getElementById(id)?.dataset.internationalValue || ''; } };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
