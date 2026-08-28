import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { COUNTRY_DOCUMENT_RULES, FALLBACK_DOCUMENT_RULE } from '../lib/country-rules';

const locale = document.documentElement.lang || 'ar';
const names = new Intl.DisplayNames([locale, 'ar', 'en'], { type: 'region' });
const countries = getCountries().map((iso) => ({ iso, name: names.of(iso) || iso, dial: getCountryCallingCode(iso) })).sort((a, b) => a.name.localeCompare(b.name, locale));

const legacyNationalIdRules = {
  EG: { label: 'الرقم القومي المصري', pattern: /^\d{14}$/, hint: '14 رقمًا', example: '29801011234567' },
  SA: { label: 'رقم الهوية الوطنية أو الإقامة', pattern: /^[12]\d{9}$/, hint: '10 أرقام ويبدأ بـ 1 للمواطن أو 2 للمقيم' },
  AE: { label: 'رقم الهوية الإماراتية', pattern: /^784[- ]?\d{4}[- ]?\d{7}[- ]?\d$/, hint: '15 رقمًا يبدأ بـ 784، ويمكن كتابة الشرطات' },
  QA: { label: 'الرقم الشخصي القطري', pattern: /^\d{11}$/, hint: '11 رقمًا' },
  KW: { label: 'الرقم المدني الكويتي', pattern: /^[123]\d{11}$/, hint: '12 رقمًا' },
  BH: { label: 'الرقم الشخصي البحريني', pattern: /^\d{9}$/, hint: '9 أرقام' },
  OM: { label: 'الرقم المدني العُماني', pattern: /^\d{8,9}$/, hint: '8 أو 9 أرقام' },
  JO: { label: 'الرقم الوطني الأردني', pattern: /^\d{10}$/, hint: '10 أرقام' },
  DZ: { label: 'رقم التعريف الوطني الجزائري', pattern: /^\d{18}$/, hint: '18 رقمًا' },
  TN: { label: 'رقم بطاقة التعريف الوطنية', pattern: /^\d{8}$/, hint: '8 أرقام' },
  MA: { label: 'رقم البطاقة الوطنية المغربية', pattern: /^[A-Z]{1,2}\d{5,8}$/i, hint: 'حرف أو حرفان ثم 5 إلى 8 أرقام' },
  TR: { label: 'رقم الهوية التركي', pattern: /^[1-9]\d{10}$/, hint: '11 رقمًا ولا يبدأ بصفر' },
  IN: { label: 'رقم Aadhaar', pattern: /^[2-9]\d{11}$/, hint: '12 رقمًا ولا يبدأ بـ 0 أو 1' },
  PK: { label: 'رقم CNIC', pattern: /^\d{5}-?\d{7}-?\d$/, hint: '13 رقمًا، ويمكن كتابة الشرطات' },
  BD: { label: 'رقم بطاقة الهوية الوطنية', pattern: /^(?:\d{10}|\d{13}|\d{17})$/, hint: '10 أو 13 أو 17 رقمًا' },
  CN: { label: 'رقم بطاقة هوية المواطن', pattern: /^\d{17}[0-9X]$/i, hint: '18 خانة، وقد تنتهي بحرف X' },
  HK: { label: 'رقم HKID', pattern: /^[A-Z]{1,2}\d{6}\(?[0-9A]\)?$/i, hint: 'حرف أو حرفان، 6 أرقام، ثم رقم تحقق أو A' },
  SG: { label: 'رقم NRIC أو FIN', pattern: /^[STFGM]\d{7}[A-Z]$/i, hint: 'حرف، 7 أرقام، ثم حرف تحقق' },
  MY: { label: 'رقم MyKad', pattern: /^\d{6}-?\d{2}-?\d{4}$/, hint: '12 رقمًا، ويمكن كتابة الشرطات' },
  ID: { label: 'رقم NIK', pattern: /^\d{16}$/, hint: '16 رقمًا' },
  PH: { label: 'رقم PhilSys', pattern: /^\d{12}$/, hint: '12 رقمًا' },
  JP: { label: 'رقم My Number', pattern: /^\d{12}$/, hint: '12 رقمًا' },
  KR: { label: 'رقم تسجيل المقيم', pattern: /^\d{6}-?\d{7}$/, hint: '13 رقمًا، ويمكن كتابة الشرطة' },
  BR: { label: 'رقم CPF', pattern: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, hint: '11 رقمًا، ويمكن كتابة النقاط والشرطة' },
  AR: { label: 'رقم DNI', pattern: /^\d{7,8}$/, hint: '7 أو 8 أرقام' },
  CL: { label: 'رقم RUN/RUT', pattern: /^\d{7,8}-?[0-9K]$/i, hint: '7 أو 8 أرقام ثم رقم تحقق أو K' },
  CO: { label: 'رقم بطاقة المواطنة', pattern: /^\d{6,10}$/, hint: 'من 6 إلى 10 أرقام' },
  MX: { label: 'رقم CURP', pattern: /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i, hint: '18 حرفًا ورقمًا بصيغة CURP' },
  ZA: { label: 'رقم الهوية الجنوب أفريقي', pattern: /^\d{13}$/, hint: '13 رقمًا' },
  NG: { label: 'رقم NIN', pattern: /^\d{11}$/, hint: '11 رقمًا' },
  GH: { label: 'رقم Ghana Card', pattern: /^GHA-?\d{9}-?\d$/i, hint: 'GHA ثم 10 أرقام' },
  KE: { label: 'رقم الهوية الوطنية', pattern: /^\d{7,8}$/, hint: '7 أو 8 أرقام' },
  ES: { label: 'رقم DNI أو NIE', pattern: /^(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/i, hint: '8 أرقام وحرف، أو X/Y/Z ثم 7 أرقام وحرف' },
  IT: { label: 'الرمز الضريبي Codice Fiscale', pattern: /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i, hint: '16 حرفًا ورقمًا' },
  PL: { label: 'رقم PESEL', pattern: /^\d{11}$/, hint: '11 رقمًا' },
  SE: { label: 'الرقم الشخصي', pattern: /^\d{6,8}[-+]?\d{4}$/, hint: '10 أو 12 رقمًا، وقد يتضمن شرطة أو علامة +' },
  NO: { label: 'رقم الميلاد أو D-number', pattern: /^\d{11}$/, hint: '11 رقمًا' },
  DK: { label: 'رقم CPR', pattern: /^\d{6}-?\d{4}$/, hint: '10 أرقام، ويمكن كتابة الشرطة' },
  FI: { label: 'رمز الهوية الشخصية', pattern: /^\d{6}[A+-]\d{3}[0-9A-Z]$/i, hint: 'تاريخ من 6 أرقام، رمز قرن، ثم 4 خانات' },
  IL: { label: 'رقم الهوية الإسرائيلية', pattern: /^\d{9}$/, hint: '9 أرقام' }
};

const nationalIdRules = Object.fromEntries(Object.entries({ ...legacyNationalIdRules, ...COUNTRY_DOCUMENT_RULES }).map(([iso, rule]) => [iso, {
  ...rule,
  label: rule.labelAr,
  hint: rule.hintAr,
  pattern: rule.pattern,
  example: rule.example,
  fallback: rule.fallback,
}]));

const passportPreferredCountries = new Set(['US','GB','CA','AU','NZ','IE','DE','FR','NL','BE','CH','AT','PT','GR','IS','LU','LI','MC','VA','SM','AD']);

function documentRule(iso) {
  if (nationalIdRules[iso]) return nationalIdRules[iso];
  if (passportPreferredCountries.has(iso)) return { ...FALLBACK_DOCUMENT_RULE, label: FALLBACK_DOCUMENT_RULE.labelAr, hint: FALLBACK_DOCUMENT_RULE.hintAr };
  return { ...FALLBACK_DOCUMENT_RULE, label: FALLBACK_DOCUMENT_RULE.labelAr, hint: FALLBACK_DOCUMENT_RULE.hintAr };
}

function displayDocumentRule(iso) {
  const source = COUNTRY_DOCUMENT_RULES[iso];
  if (locale.startsWith('en') && source) return { ...documentRule(iso), label: source.labelEn, hint: source.hintEn };
  return documentRule(iso);
}

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

function addMessage(input, afterElement = input) {
  const message = document.createElement('small');
  message.className = 'country-field-message';
  message.id = `${input.id}-country-message`;
  message.setAttribute('aria-live', 'polite');
  afterElement.insertAdjacentElement('afterend', message);
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
  input.removeAttribute('minlength');
  input.removeAttribute('pattern');
  input.removeAttribute('oninput');
  input.oninput = null;
  input.setAttribute('autocomplete', kind === 'phone' ? 'tel-national' : 'off');
  input.setAttribute('inputmode', kind === 'phone' ? 'tel' : 'text');
  const existing = kind === 'phone'
    ? document.getElementById(`${input.id}Country`)
      || input.closest('.form-group')?.querySelector('select')
      || input.parentElement?.querySelector('select')
    : null;
  const select = existing || document.createElement('select');
  select.classList.add('country-field-select');
  if (!existing) {
    select.id = `${input.id}Country`;
    select.setAttribute('aria-label', `بلد ${kind === 'phone' ? 'رقم الهاتف' : 'وثيقة الهوية'}`);
    input.insertAdjacentElement('beforebegin', select);
  }
  select.dataset.countryFor = input.id;
  select.dataset.countryKind = kind;
  select.dataset.legacyDialValue = existing ? 'true' : 'false';
  select.innerHTML = options('', Boolean(existing));
  select.value = '';
  if (existing) {
    existing.parentElement.classList.add('country-phone-row');
    input.classList.add('country-phone-input');
  }
  const message = addMessage(input, existing ? existing.parentElement : input);
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
  if (input.dataset.countryKind === 'phone') {
    input.placeholder = `رقم محلي صالح في ${country.name}`;
    input.setAttribute('inputmode', 'tel');
    message.textContent = `أدخل الرقم المحلي لـ ${country.name} ��دون كود الدولة (+${country.dial})؛ الطول يتحدد تلقائيًا حسب شبكة البلد.`;
  } else {
    const rule = displayDocumentRule(country.iso);
    input.placeholder = rule.label;
    input.setAttribute('inputmode', /^\^?\\d|رقمًا/.test(String(rule.pattern || rule.hint)) && !/[A-Z]/.test(String(rule.pattern || '')) ? 'numeric' : 'text');
    const label = input.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = `${rule.label}${input.dataset.countryRequired === 'true' ? ' *' : ''}`;
    message.textContent = `${rule.label} في ${country.name}: ${rule.hint}.${rule.example ? ` مثال: ${rule.example}.` : ''}`;
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
    const select = document.getElementById(`${input.id}Country`) || document.querySelector(`select[data-country-for="${input.id}"]`);
    const message = document.getElementById(`${input.id}-country-message`);
    if (select && message && !validateField(input, select, message, true)) return false;
  }
  return true;
}

function init() {
  document.querySelectorAll('input').forEach((input) => { const kind = fieldKind(input); if (kind) enhance(input, kind); });
  const style = document.createElement('style');
  style.textContent = `.country-field-select{width:100%;margin-bottom:8px;direction:rtl}.country-phone-row{align-items:stretch!important;flex-wrap:nowrap}.country-phone-row>.country-field-select{flex:0 0 42%;width:42%;min-width:0;margin-bottom:0;max-width:none!important}.country-phone-row>.country-phone-input{flex:1 1 auto;width:auto!important;min-width:0}.country-field-message{display:block;margin-top:6px;color:var(--text-light);font-size:.82rem;line-height:1.5}.country-field-message.is-error{color:var(--danger,#dc3545);font-weight:700}input:invalid[data-country-enhanced=true]{border-color:var(--danger,#dc3545)!important}@media(max-width:420px){.country-phone-row{gap:6px!important}.country-phone-row>.country-field-select{flex-basis:44%;width:44%;font-size:.84rem;padding-inline:8px}.country-phone-row>.country-phone-input{padding-inline:8px}}`;
  document.head.appendChild(style);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[onclick]');
    if (!button || !button.closest('.page:not(.hidden)')) return;
    if (!validateVisiblePage()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.CountryFields = {
    validateVisiblePage,
    validate(id) {
      const input = document.getElementById(id);
      const select = document.getElementById(`${id}Country`) || document.querySelector(`select[data-country-for="${id}"]`);
      const message = document.getElementById(`${id}-country-message`);
      return Boolean(input && select && message && validateField(input, select, message, true));
    },
    getInternationalValue(id) {
      const input = document.getElementById(id);
      if (input && !input.dataset.internationalValue) this.validate(id);
      return input?.dataset.internationalValue || '';
    },
    getCountryCode(id) {
      const select = document.getElementById(`${id}Country`) || document.querySelector(`select[data-country-for="${id}"]`);
      return select ? selectedIso(select) : '';
    },
    getDocumentLabel(id) {
      const iso = this.getCountryCode(id);
      return iso ? documentRule(iso).label : 'وثيقة الهوية';
    },
    setCountry(id, iso) {
      const input = document.getElementById(id);
      const select = document.getElementById(`${id}Country`) || document.querySelector(`select[data-country-for="${id}"]`);
      if (!input || !select || !iso) return;
      const option = [...select.options].find((item) => item.dataset.iso === iso);
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
      }
    }
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
