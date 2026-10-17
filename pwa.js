/* MOISNAR PWA layer — loaded with `defer` from <head>, so it runs after index.html's inline script and App.js.
   1) registers sw.js
   2) Android / Chrome: captures `beforeinstallprompt` and installs directly from our own buttons
   3) iOS: shows a manual "Add to Home Screen" guide (Share menu) in a bottom sheet
   Buttons: an install card on Home (dismissible for 7 days) and an "Install app" row in Settings.
   NOTE: App.js deletes every localStorage key that starts with "moisnar." (except its own), so this file uses a different prefix. */
(function () {
'use strict';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_MS = 7 * 24 * 3600 * 1000;
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standaloneMQ = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
const isStandalone = () => (standaloneMQ && standaloneMQ.matches) || window.navigator.standalone === true;
let deferred = null;

/* ---------- text ---------- */
const TX = {
  en: {
    group: 'App', row: 'Install app', title: 'Install MOISNAR', sub: 'Add it to your home screen for faster access', btn: 'Install',
    close: 'Close', ioTitle: 'Add to Home Screen', ioSub: 'Follow these steps in Safari',
    s1: 'Tap the Share button in the Safari toolbar', s2: 'Scroll down and tap “Add to Home Screen”', s3: 'Tap “Add” at the top of the screen',
    note: "Can't see the option? Open this page in Safari first.", ok: 'Got it'
  },
  ar: {
    group: 'التطبيق', row: 'تثبيت التطبيق', title: 'ثبّت تطبيق MOISNAR', sub: 'أضفه إلى شاشتك الرئيسية للوصول الأسرع', btn: 'تثبيت',
    close: 'إغلاق', ioTitle: 'إضافة إلى الشاشة الرئيسية', ioSub: 'اتبع هذه الخطوات في متصفح Safari',
    s1: 'اضغط على زر المشاركة في شريط Safari', s2: 'مرّر للأسفل ثم اختر «إضافة إلى الشاشة الرئيسية»', s3: 'اضغط «إضافة» أعلى الشاشة',
    note: 'إن لم يظهر الخيار، افتح هذه الصفحة في متصفح Safari أولاً.', ok: 'فهمت'
  }
};
const lang = () => (typeof state !== 'undefined' && state && state.lang === 'ar') ? 'ar' : 'en';
const tx = k => TX[lang()][k];
const icon = (n, s, o) => (typeof ic === 'function') ? ic(n, s, o) : '';

/* ---------- state helpers ---------- */
const canInstall = () => !isStandalone() && (isIOS || !!deferred);
const dismissedRecently = () => { try { const t = +localStorage.getItem(DISMISS_KEY); return t > 0 && Date.now() - t < DISMISS_MS; } catch (e) { return false; } };
const showCard = () => canInstall() && !dismissedRecently();

function refresh() {
  try {
    if (typeof cur === 'function' && typeof render === 'function' && ['home', 'settings'].includes(cur().n)) render(true);
  } catch (e) {}
}

/* ---------- styles (inline <style> is allowed by the CSP: style-src 'unsafe-inline') ---------- */
const css = document.createElement('style');
css.textContent = [
  '.pwa-card{display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px 12px;border-radius:22px;background:var(--light);color:var(--ink)}',
  '.pwa-card .ib{flex:none;width:44px;height:44px;border-radius:50%;background:#fff;color:var(--dark);display:flex;align-items:center;justify-content:center}',
  '.pwa-card .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.pwa-card .tx b{font-size:15px;font-weight:800}',
  'html[lang=ar] .pwa-card .tx b{font-weight:700}',
  '.pwa-card .tx span{font-size:12.5px;line-height:1.5;color:#2f4a3d}',
  '.pwa-card .go{flex:none;height:38px;padding:0 18px;border-radius:19px;background:var(--dark);color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center}',
  '.pwa-card .x{flex:none;width:30px;height:30px;border-radius:50%;color:var(--dark);display:flex;align-items:center;justify-content:center}',
  '.pwa-steps{list-style:none;display:flex;flex-direction:column;gap:10px}',
  '.pwa-steps li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:var(--soft);border:1px solid var(--light);font-size:15px;line-height:1.6}',
  '.pwa-steps li>i{flex:none;width:28px;height:28px;border-radius:50%;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;font-style:normal}',
  '.pwa-steps li>span{flex:1}',
  '.pwa-steps li>.pi{flex:none;width:36px;height:36px;border-radius:10px;background:#fff;color:var(--dark);display:flex;align-items:center;justify-content:center}',
  '.pwa-note{margin-top:14px;font-size:13px;line-height:1.7;color:var(--muted);text-align:center}'
].join('');
document.head.appendChild(css);

/* ---------- markup ---------- */
const card = () =>
  `<div class="pwa-card" role="region" aria-label="${tx('title')}"><span class="ib">${icon('down', 22, { w: 2 })}</span>` +
  `<div class="tx"><b>${tx('title')}</b><span>${tx('sub')}</span></div>` +
  `<button class="go" data-pwa="install">${tx('btn')}</button>` +
  `<button class="x" data-pwa="dismiss" aria-label="${tx('close')}">${icon('x', 16, { w: 2.4 })}</button></div>`;

const settingsRow = () =>
  `<div class="sgrp">${tx('group')}</div><button class="srow" data-pwa="install"><span class="lb">${tx('row')}</span>${icon('chev', 18, { c: '#8a9892', w: 2 })}</button>`;

const SHARE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

function showIOSGuide() {
  if (typeof openSheet !== 'function' || typeof sheetHead !== 'function') return;
  openSheet(
    sheetHead(tx('ioTitle'), tx('ioSub')) +
    '<ol class="pwa-steps">' +
    `<li><i>1</i><span>${tx('s1')}</span><span class="pi">${SHARE_SVG}</span></li>` +
    `<li><i>2</i><span>${tx('s2')}</span><span class="pi">${icon('addbox', 22, { w: 1.9 })}</span></li>` +
    `<li><i>3</i><span>${tx('s3')}</span><span class="pi">${icon('check', 22, { w: 2.2 })}</span></li>` +
    '</ol>' +
    `<p class="pwa-note">${tx('note')}</p>` +
    `<button class="btn" style="margin-top:18px" data-a="closeov">${tx('ok')}</button>`
  );
}

async function install() {
  if (isStandalone()) return;
  if (deferred) {
    const d = deferred; deferred = null; /* prompt() can only be used once per event */
    try {
      d.prompt();
      await d.userChoice;
    } catch (e) {}
    refresh();
    return;
  }
  if (isIOS) showIOSGuide();
}

/* ---------- wiring ---------- */
document.addEventListener('click', e => {
  if (e.isTrusted === false) return;
  const el = e.target && e.target.closest ? e.target.closest('[data-pwa]') : null;
  if (!el) return;
  const a = el.getAttribute('data-pwa');
  if (a === 'install') install();
  else if (a === 'dismiss') { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (err) {} refresh(); }
});

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
window.addEventListener('appinstalled', () => { deferred = null; refresh(); });
if (standaloneMQ && standaloneMQ.addEventListener) standaloneMQ.addEventListener('change', refresh);

/* Wrap the screens (same pattern App.js uses). Only touches the markup if the expected anchors exist. */
function wrap(name, fn) {
  if (typeof SCREENS === 'undefined' || typeof SCREENS[name] !== 'function') return;
  const orig = SCREENS[name];
  SCREENS[name] = function () {
    const r = orig.apply(this, arguments);
    try {
      if (r && typeof r.html === 'string') {
        const h = fn(r.html);
        if (h !== r.html) return Object.assign({}, r, { html: h });
      }
    } catch (e) {}
    return r;
  };
}
wrap('home', h => {
  if (!showCard()) return h;
  const i = h.indexOf('<div class="sechd">');
  return i < 0 ? h : h.slice(0, i) + card() + h.slice(i);
});
wrap('settings', h => {
  if (!canInstall()) return h;
  const first = h.indexOf('<div class="sgrp">');
  const second = first < 0 ? -1 : h.indexOf('<div class="sgrp">', first + 1);
  return second < 0 ? h : h.slice(0, second) + settingsRow() + h.slice(second);
});

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(reg => { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }); })
      .catch(err => { try { console.warn('MOISNAR: service worker not registered', err); } catch (e) {} });
  });
}

/* iOS has no install event: re-render once so the buttons appear (Android re-renders when beforeinstallprompt fires). */
if (isIOS && !isStandalone()) window.addEventListener('load', () => setTimeout(refresh, 1300));
})();
