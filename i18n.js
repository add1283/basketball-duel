// Basketball Duel – tiny i18n helper (no dependencies).
// Usage: PotaI18n.t('key', { name: 'Ana' })  →  string with {name} filled in.
// Dictionaries are registered with PotaI18n.add({ en: {...}, tr: {...}, ... }).
// Default language is English; the choice is remembered per browser.
(function (root) {
  'use strict';
  const LANGS = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  ];
  const D = { en: {}, es: {}, fr: {}, de: {}, tr: {}, ar: {} };
  const KEY = 'pota:lang';
  let lang = 'en';
  try { const s = localStorage.getItem(KEY); if (s && D[s]) lang = s; } catch (e) { /* storage blocked */ }
  const listeners = [];

  function t(key, vars) {
    let s = (D[lang] && D[lang][key] != null) ? D[lang][key] : (D.en[key] != null ? D.en[key] : key);
    if (vars) s = String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  // Pick a list entry (e.g. slogans) deterministically
  function list(key, i) {
    const v = (D[lang] && D[lang][key]) || D.en[key];
    return Array.isArray(v) ? v[((i % v.length) + v.length) % v.length] : t(key);
  }
  function add(dicts) {
    for (const l in dicts) { if (!D[l]) D[l] = {}; Object.assign(D[l], dicts[l]); }
  }
  function isRTL(l = lang) { const x = LANGS.find(z => z.code === l); return !!(x && x.rtl); }
  function applyDom(rootEl) {
    const r = rootEl || document;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    r.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    r.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  }
  function setLang(l) {
    if (!D[l]) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l;
      document.documentElement.dir = isRTL(l) ? 'rtl' : 'ltr';
      applyDom();
    }
    listeners.forEach(fn => { try { fn(l); } catch (e) { /* ignore */ } });
  }
  root.PotaI18n = {
    LANGS, t, list, add, setLang, isRTL, applyDom,
    get lang() { return lang; },
    onChange(fn) { listeners.push(fn); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
