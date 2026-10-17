(function () {
'use strict';
if (typeof state === 'undefined' || typeof SCREENS === 'undefined' || typeof act !== 'function') {
  const showFatal = () => { try {
    const d = document.createElement('div'); d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#fff;color:#111;font:16px/1.6 system-ui,sans-serif;text-align:center';
    const ar = /^ar/i.test(document.documentElement.lang || navigator.language || '');
    d.textContent = ar ? 'تعذّر تشغيل التطبيق. أعد تحميل الصفحة، وإن استمرت المشكلة فحاول لاحقاً.' : 'The app could not start. Please reload the page; if the problem continues, try again later.';
    (document.body || document.documentElement).appendChild(d); } catch (e) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showFatal); else showFatal();
  return;
}

const T = (en, ar) => (state.lang === 'ar' ? ar : en);
const wait = ms => new Promise(r => setTimeout(r, ms));
const SK = 'moisnar.core';
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.getOwnPropertyNames(o).forEach(k => deepFreeze(o[k])); } return o; };
const fset = a => { const l = Object.freeze([...new Set(a)]); return Object.freeze({ has: k => l.includes(k), forEach: f => l.forEach(x => f(x, x)) }); };
const ID = Object.freeze(/^[\w-]{1,40}$/), CATIDS = Object.freeze(CATS.map(c => c.id)), isCat = v => v === 'all' || CATIDS.includes(v), MAXP = 3, MINP = 1;

const LOG = [], rateT = {}, seen = []; let cool = 0, sent = 0;
const SENS = /pass|token|secret|auth|mail|phone|name|desc|note|bio|\bq\b|url|photo|cookie|key|stack|trace|path|file|uid/i;
const RX_URL = /[a-z][a-z0-9+.\-]*:\/\/[^\s)'"]*/gi;
const RX_PATH = /(?:[A-Za-z]:\\|\/)?(?:[\w.\-]+[\\/])+[\w.\-]+\.(?:m?js|html?|map|ts)(?::\d+){0,2}|[\w.\-]+\.(?:m?js|html?|map|ts):\d+(?::\d+)?/gi;
const RX_FRAME = /^[ \t]*at[ \t]+[^\n]*(?:\(|:\d+)[^\n]*$/gm;
const RX_MAIL = /[^\s@]+@[^\s@]+/g;
const RX_TEL = /\+?\d[\d\s().\-]{5,}\d/g;
const scrub = v => String(v == null ? '' : v).replace(RX_URL, '[url]').replace(RX_PATH, '[path]').replace(RX_FRAME, '').replace(/[ \t]*\n[ \t]*/g, ' ').trim().replace(RX_MAIL, '[redacted]').replace(RX_TEL, m => (m.replace(/\D/g, '').length >= 7 ? '[redacted]' : m));
const redact = (v, d = 0) => (v == null || typeof v === 'number' || typeof v === 'boolean') ? v : typeof v === 'string' ? scrub(v).slice(0, 40) : typeof v !== 'object' ? '[x]' : d > 1 ? '[obj]' : Array.isArray(v) ? v.slice(0, 5).map(x => redact(x, d + 1)) : Object.keys(v).slice(0, 10).reduce((o, k) => (o[k] = SENS.test(k) ? '[redacted]' : redact(v[k], d + 1), o), {});
function log(type, data, level) {
  level = level || 'warn'; const now = Date.now();
  if (rateT[type] && now - rateT[type] < 1000) return; rateT[type] = now;
  LOG.push({ t: now, type: scrub(type).slice(0, 40), level, d: redact(data) });
  if (LOG.length > 100) { LOG.shift(); sent = Math.max(0, sent - 1); }
  try { sessionStorage.setItem('moisnar.log', JSON.stringify(LOG.slice(-50))); } catch (e) {}
  if (level === 'warn') { seen.push(now); while (seen.length && now - seen[0] > 6e4) seen.shift();
    if (seen.length >= 8) { cool = now + 20000; seen.length = 0; LOG.push({ t: now, type: 'repeated_rejects', level: 'error', d: {} }); try { RL.suspicious(); } catch (e) {} } }
}

const GENERIC = () => T('Something went wrong. Please try again.', 'حدث خطأ ما. حاول مرة أخرى.');
let lastErrToast = 0;
const fail = (e, ctx) => { log('error', { ctx, msg: scrub((e && e.message) || e).slice(0, 60) }, 'error'); const n = Date.now(); if (n - lastErrToast > 3000) { lastErrToast = n; try { toast(GENERIC()); } catch (x) {} } };
window.addEventListener('error', ev => fail(ev.error || ev.message, 'window'));
window.addEventListener('unhandledrejection', ev => { fail(ev.reason, 'promise'); ev.preventDefault(); });
['click', 'input', 'keydown', 'change'].forEach(t => window.addEventListener(t, ev => { if (ev.isTrusted === false) { ev.stopImmediatePropagation(); if (!(ev.target && ev.target.type === 'file')) log('untrusted_event', { t }); } }, true));

const CTL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const clean = (s, multi) => { s = String(s == null ? '' : s).normalize('NFC').replace(/\r\n?/g, '\n').replace(CTL, ''); return multi ? s.replace(/\n{3,}/g, '\n\n') : s.replace(/\n/g, ' '); };
const RULES = deepFreeze({ 'F.name': { max: 80 }, 'F.desc': { max: 2000, multi: 1 }, 'F.notes': { max: 1000, multi: 1 }, 'F.price': { max: 12, num: 1 }, 'F.qty': { max: 7, int: 1 },
  'P.name': { max: 60 }, 'P.bio': { max: 300, multi: 1 }, 'P.phone': { max: 24, phone: 1 }, 'P.email': { max: 100, email: 1 }, 'C.phone': { max: 24, phone: 1 }, 'C.email': { max: 100, email: 1 },
  'REP.details': { max: 500, multi: 1 }, 'TMP.q': { max: 40 }, 's.q': { max: 80 }, 'TF.min': { max: 12, num: 1 }, 'TF.max': { max: 12, num: 1 } });
function fix(v, r) {
  let s = clean(v, r.multi);
  if (r.num) { const m = s.replace(/[^0-9.]/g, '').match(/^\d*\.?\d*/); s = m ? m[0] : ''; }
  if (r.int) s = s.replace(/\D/g, '');
  if (r.phone) { s = s.replace(/[^0-9+()\- ]/g, '').replace(/(?!^)\+/g, ''); let n = 0; s = [...s].filter(ch => !/\d/.test(ch) || ++n <= 15).join(''); }
  if (r.email) s = s.replace(/[\s"'`]/g, '');
  return s.slice(0, r.max);
}
const digits = s => s.replace(/\D/g, '');
const EMAIL = Object.freeze(/^(?=.{6,100}$)(?=[^@]{1,64}@)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/);
const V = Object.freeze({
  name: s => !s || (s.trim().length >= 2 && s.length <= 80),
  desc: s => s.trim().length >= 5 && s.length <= 2000,
  price: s => s === '' || (/^\d{1,9}(\.\d{1,2})?$/.test(s) && +s <= 1e9),
  qty: s => /^\d{1,7}$/.test(s) && +s >= 1 && +s <= 1e6,
  phone: s => /^\+?[0-9 ()-]+$/.test(s) && digits(s).length >= 9 && digits(s).length <= 15 && !/^(\d)\1+$/.test(digits(s)),
  email: s => EMAIL.test(s) && !s.includes('..')
});

const IMG_HOSTS = Object.freeze(['googleusercontent.com', 'twimg.com', 'res.cloudinary.com']
const httpsOk = u => { try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password && !x.port && IMG_HOSTS.some(h => x.hostname === h || x.hostname.endsWith('.' + h)); } catch (e) { return false; } };
const DATA_IMG = Object.freeze(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i);
const MAX_DATA = 512 * 1024;
const OK_DATA = Object.freeze(['LOGO', 'MARK', 'SA', 'LB', 'EG', 'AD', 'AF', 'IR', 'AL', 'CA', 'ES', 'CY', 'PT'].map(k => { try { return ASSETS[k]; } catch (e) { return null; } })
  .filter(v => typeof v === 'string' && v.length <= MAX_DATA && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(v)));
const okUrl = u => {
  if (typeof u !== 'string' || !u || /[\u0000-\u0020\u007F-\u009F'"`<>\\]/.test(u)) return '';
  if (/^data:/i.test(u)) return (u.length <= MAX_DATA && DATA_IMG.test(u) && OK_DATA.includes(u)) ? u : '';
  if (u.length >= 2048) return '';
  let x; try { x = new URL(u); } catch (e) { return ''; }
  if (/[\s'"`<>\\]/.test(x.href)) return '';
  if (x.protocol === 'blob:') return (u.startsWith('blob:' + location.origin + '/') && x.href.startsWith('blob:' + location.origin + '/')) ? x.href : '';
  if (x.protocol === 'https:') return httpsOk(x.href) ? x.href : '';
  return '';
};
const BADTAG = Object.freeze(/^(SCRIPT|IFRAME|OBJECT|EMBED|BASE|META|LINK)$/);
function hardenOne(el) {
  if (el.nodeType !== 1) return;
  if (BADTAG.test(el.tagName)) { log('xss_tag', { t: el.tagName }); el.remove(); return; }
  for (const a of [...el.attributes]) {
    const n = a.name.toLowerCase(), v = a.value;
    if (n.startsWith('on') || n === 'srcdoc' || (n === 'src' && !okUrl(v)) || (/^(href|xlink:href|action|formaction)$/.test(n) && !/^(#|tel:|mailto:|https:\/\/)/i.test(v)) || (n === 'style' && /expression\(|javascript:|behavior:/i.test(v))) { log('xss_attr', { a: n }); el.removeAttribute(a.name); }
  }
}
const harden = root => { if (root && root.nodeType === 1) { hardenOne(root); root.querySelectorAll('*').forEach(hardenOne); } };

const LIMS = {};
const lim = (k, max, win) => { const a = (LIMS[k] = LIMS[k] || []), n = Date.now(); while (a.length && n - a[0] > win) a.shift(); if (a.length >= max) return false; a.push(n); return true; };
const toast0 = window.toast; let quietUntil = 0, lastNote = 0, lastMsg = '', lastMsgT = 0;
window.toast = function (m) {
  const n = Date.now(); if (n < quietUntil || (m === lastMsg && n - lastMsgT < 1500)) return;
  lastMsg = m; lastMsgT = n; const old = document.querySelectorAll('.toast'); if (old.length >= 2) old[0].remove();
  return toast0.apply(this, arguments);
};
const RLK = 'moisnar.rl';
const NETLIM = deepFreeze({ health: [6, 6e4], session: [6, 6e4], login: [6, 6e4], logout: [6, 6e4], notifications: [10, 6e4], uploadPhoto: [15, 6e4], uploadAvatar: [5, 6e4], saveProduct: [8, 6e4], saveProfile: [8, 6e4], support: [3, 6e4], report: [6, 6e4] });
const NET_ALL = Object.freeze([40, 6e4]), MAX_INFLIGHT = 6, MAX_BODY = 64 * 1024, BG = fset(['health', 'session', 'notifications', 'report']);
const RL = (() => {
  const hits = {}, all = [], fails = {}, brk = {}; let inflight = 0, strikes = [], lock = 0, lvl = 0, lvlT = 0;
  try { const d = JSON.parse(localStorage.getItem(RLK) || 'null'); if (d && typeof d === 'object') { const n = Date.now(); lock = Number.isFinite(d.lock) ? Math.min(Math.max(d.lock, 0), n + 6e5) : 0; lvl = Number.isInteger(d.lvl) ? Math.min(Math.max(d.lvl, 0), 5) : 0; lvlT = Number.isFinite(d.lvlT) ? d.lvlT : 0; } } catch (e) {}
  const save = () => { try { localStorage.setItem(RLK, JSON.stringify({ lock, lvl, lvlT })); } catch (e) {} };
  const prune = (a, w, n) => { while (a.length && n - a[0] > w) a.shift(); };
  const err = (code, ms) => Object.assign(new Error(code), { rl: code, wait: Math.max(1, Math.ceil(ms / 1000)) });
  function strike(name, now, k) {
    if (name === 'report' || BG.has(name)) return;
    for (let i = 0; i < (k || 1); i++) strikes.push(now); prune(strikes, 12e4, now);
    if (strikes.length >= 3) { strikes.length = 0; if (now - lvlT > 18e5) lvl = 0; lvl = Math.min(lvl + 1, 5); lvlT = now; lock = now + Math.min(30e3 * Math.pow(2, lvl - 1), 6e5); save(); log('net_lock', { lvl }, 'error'); }
  }
  return Object.freeze({
    enter(name, args) {
      const now = Date.now();
      if (now < lock) throw err('locked', lock - now);
      const L = (Object.prototype.hasOwnProperty.call(NETLIM, name) && NETLIM[name]) || [10, 6e4], h = (hits[name] = hits[name] || []); prune(h, L[1], now); prune(all, NET_ALL[1], now);
      if (h.length >= L[0] || all.length >= NET_ALL[0]) { strike(name, now); throw err('rate', h.length >= L[0] ? L[1] - (now - h[0]) : NET_ALL[1] - (now - all[0])); }
      const b = brk[name]; if (b && now < b.until) throw err('breaker', b.until - now);
      if (inflight >= MAX_INFLIGHT) throw err('busy', 1000);
      for (const a of args) {
        if (a && typeof a === 'object') { if ((typeof Blob !== 'undefined' && a instanceof Blob) || (typeof AbortSignal !== 'undefined' && a instanceof AbortSignal)) continue; let n; try { n = JSON.stringify(a).length; } catch (e) { n = Infinity; } if (n > MAX_BODY) throw err('size', 0); }
        else if (typeof a === 'string' && a.length > MAX_BODY) throw err('size', 0);
      }
      h.push(now); all.push(now); inflight++;
    },
    done(name, ok, e) {
      inflight = Math.max(0, inflight - 1); const now = Date.now();
      if (ok) { fails[name] = 0; delete brk[name]; return; }
      if (e && e.name === 'AbortError') return;
      const st = e ? +e.status : 0;
      if (st === 429 || st === 503) { const ra = Math.min(Math.max(+e.retryAfter || 0, 0), 300); brk[name] = { until: now + Math.max(ra, 5) * 1000, n: ((brk[name] || {}).n || 0) + 1 }; log('server_busy', { name, st }, 'info'); return; }
      if (st >= 400 && st < 500) return;
      fails[name] = (fails[name] || 0) + 1;
      if (fails[name] >= 5) { const n = ((brk[name] || {}).n || 0) + 1; brk[name] = { until: now + Math.min(15e3 * Math.pow(2, n - 1), 12e4), n }; fails[name] = 0; log('breaker_open', { name }, 'info'); }
    },
    note(m) { const n = Date.now(); quietUntil = n + 1500; if (n - lastNote < 2500) return; lastNote = n; const old = document.querySelectorAll('.toast'); if (old.length >= 2) old[0].remove(); toast0(m); },
    notify(e) { this.note(e.rl === 'size' ? T('That request is too large.', 'الطلب كبير جداً.') : e.rl === 'busy' ? T('Please wait a moment…', 'انتظر لحظة…') : T(`Too many requests. Please try again in ${e.wait}s.`, `طلبات كثيرة. حاول مرة أخرى بعد ${e.wait} ثانية.`)); },
    suspicious() { strike('suspicious', Date.now(), 2); },
    retryReset() { ['health', 'session', 'notifications'].forEach(k => { delete brk[k]; fails[k] = 0; hits[k] = []; }); }
  });
})();
const FLOOD = (() => { const t = []; let until = 0, lvl = 0, lastT = 0;
  return Object.freeze({ hit(n) { const now = Date.now(); if (now < until) return true; if (n === 'closeov' || n === 'idxGo') return false;
    t.push(now); while (t.length && now - t[0] > 2000) t.shift();
    if (t.length > 25) { t.length = 0; if (now - lastT > 6e4) lvl = 0; lastT = now; lvl = Math.min(lvl + 1, 4); until = now + 3000 * lvl; log('act_flood', { lvl }); RL.note(T('Too fast. Please slow down a little.', 'سرعة كبيرة. تمهّل قليلاً.')); return true; }
    return false; } }); })();
document.addEventListener('securitypolicyviolation', ev => log('csp_violation', { d: String(ev.violatedDirective).slice(0, 30) }));

const ctls = new Set(), busy = {};
function call(name, ...args) {
  try { RL.enter(name, args); } catch (e) { if (!BG.has(name)) RL.notify(e); log('rate_limited', { n: name, c: e.rl }, 'info'); return Promise.reject(e); }
  const ac = new AbortController(); ctls.add(ac); let tm;
  const to = new Promise((_, rej) => { tm = setTimeout(() => { ac.abort(); rej(new Error('timeout')); }, name === 'login' ? 12e4 : 15000); });
  return Promise.race([Promise.resolve().then(() => Core.adapter[name](...args, ac.signal)), to]).then(v => { RL.done(name, true); return v; }, e => { RL.done(name, false, e); throw e; }).finally(() => { clearTimeout(tm); ctls.delete(ac); });
}
const abortAll = () => { ctls.forEach(c => c.abort()); ctls.clear(); };
const once = async (k, fn) => { if (busy[k]) return; busy[k] = 1; try { return await fn(); } finally { busy[k] = 0; } };

let store = { hint: null, read: [], asked: false };
const UID_RE = /^[1-9][0-9]{9}$/;
function secureUid() {
  const c = window.crypto; if (!c || typeof c.getRandomValues !== 'function') throw new Error('no_secure_random');
  const out = [], buf = new Uint8Array(32);
  while (out.length < 10) { c.getRandomValues(buf); for (const v of buf) { if (out.length === 0) { if (v < 243) out.push(1 + v % 9); } else if (v < 250) out.push(v % 10); if (out.length === 10) break; } }
  return out.join('');
}
const cleanHint = (h, prev) => (h && typeof h === 'object' && typeof h.id === 'string' && /^[\w-]{1,64}$/.test(h.id) && ['google', 'x'].includes(h.provider) && Number.isFinite(h.exp)) ? { id: h.id, provider: h.provider, exp: h.exp, uid: UID_RE.test(h.uid) ? h.uid : (prev && prev.id === h.id && UID_RE.test(prev.uid) ? prev.uid : secureUid()) } : null;
try { const d = JSON.parse(localStorage.getItem(SK) || 'null'); if (d && typeof d === 'object') { store.hint = cleanHint(d.hint); store.read = Array.isArray(d.read) ? d.read.filter(x => typeof x === 'string' && ID.test(x)).slice(0, 100) : []; store.asked = d.asked === true; } } catch (e) { log('core_store_corrupt', {}, 'info'); }
const persist = () => { try { localStorage.setItem(SK, JSON.stringify({ hint: store.hint, read: store.read, asked: store.asked })); } catch (e) {} };
let session = null;
const sOK = s => !!s && Number.isFinite(s.exp) && s.exp > Date.now() && /^[\w-]{1,64}$/.test(s.id);
const authed = () => { if (session && !sOK(session)) endSession('expired'); return !!session; };
Object.defineProperty(state, 'user', { get: () => (authed() ? { id: session.id, provider: session.provider, uid: session.uid } : null), set() {}, enumerable: false, configurable: false });
function setSession(s) { const c = cleanHint(Object.assign({ exp: Date.now() + 8 * 36e5 }, s)); if (!c) throw new Error('bad_session'); session = c; store.hint = c; persist(); }
const FILES = new Map();
function wipeLocal() {
  state.favs = []; state.prof = { name: '', phone: '', email: '', bio: '', country: null, gov: null, photo: null }; state.contact = { phone: '', email: '' };
  state.products = state.products.filter(p => !p.mine); FILES.forEach((f, u) => URL.revokeObjectURL(u)); FILES.clear(); PH.clear(); UP.clear(); F = {};
  try { save(); } catch (e) {}
  try { const raw = JSON.parse(localStorage.getItem('moisnar.v1') || 'null'); if (raw && typeof raw === 'object') { ['favs', 'prof', 'contact', 'mine'].forEach(k => delete raw[k]); localStorage.setItem('moisnar.v1', JSON.stringify(raw)); } } catch (e) { try { localStorage.removeItem('moisnar.v1'); } catch (x) {} }
}
function endSession(reason) {
  session = null; store.hint = null; store.read = []; abortAll(); if (typeof Core !== 'undefined') Core.notifs = [];
  wipeLocal(); persist(); log('session_end', { reason }, 'info');
  if (reason !== 'logout') setTimeout(() => { stack = [{ n: 'home' }]; render(); if (reason === 'expired') toast(T('Your session expired. Please log in again.', 'انتهت جلستك. سجّل دخولك من جديد.')); }, 0);
}

function sanitizeLocal() {
  let bad = 0; const D = (c, f) => { if (!c) { bad++; f(); } };
  const cc = v => typeof v === 'string' && /^[A-Z]{2}$/.test(v), gg = v => Number.isInteger(v) && v >= 0 && v < 500;
  const txt = (v, n, multi) => (typeof v === 'string' ? clean(v, multi).slice(0, n) : '');
  D(['ar', 'en'].includes(state.lang), () => { state.lang = 'en'; });
  D(CURS.some(c => c[0] === state.cur), () => { state.cur = 'USD'; });
  D(state.country === null || cc(state.country), () => { state.country = null; state.gov = null; });
  D(state.gov === null || gg(state.gov), () => { state.gov = null; });
  D(['newest', 'oldest', 'cheap', 'exp'].includes(state.sort), () => { state.sort = 'newest'; });
  D(Array.isArray(state.favs), () => { state.favs = []; });
  state.favs = state.favs.filter((x, i, a) => typeof x === 'string' && ID.test(x) && a.indexOf(x) === i).slice(0, 500);
  D(Array.isArray(state.hist), () => { state.hist = []; });
  state.hist = state.hist.filter(x => typeof x === 'string').map(x => clean(x).trim().slice(0, 80)).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 8);
  const pr = (state.prof && typeof state.prof === 'object' && !Array.isArray(state.prof)) ? state.prof : (bad++, {}), ct = (state.contact && typeof state.contact === 'object' && !Array.isArray(state.contact)) ? state.contact : (bad++, {});
  state.prof = { name: fix(txt(pr.name, 400), RULES['P.name']), bio: fix(txt(pr.bio, 2000, 1), RULES['P.bio']), phone: fix(txt(pr.phone, 100), RULES['P.phone']), email: fix(txt(pr.email, 400), RULES['P.email']), country: cc(pr.country) ? pr.country : null, gov: gg(pr.gov) ? pr.gov : null, photo: null };
  state.contact = { phone: fix(txt(ct.phone, 100), RULES['C.phone']), email: fix(txt(ct.email, 400), RULES['C.email']) };
  const BUILT = new Set(typeof DEMO !== 'undefined' && Array.isArray(DEMO) ? DEMO : []);
  const norm = p => { const nm = txt(p.name || p.en, 80); return { id: p.id, name: nm, en: nm || txt(p.en, 80), ar: nm || txt(p.ar, 80), cat: CATIDS.includes(p.cat) ? p.cat : 'home', price: Math.min(Math.max(+p.price || 0, 0), 1e9), cond: p.cond === 'used' ? 'used' : 'new', qty: Math.min(Math.max(parseInt(p.qty, 10) || 1, 1), 1e6), country: cc(p.country) ? p.country : 'SY', gov: gg(p.gov) ? p.gov : 0, desc: p.desc == null ? null : txt(p.desc, 2000, 1), notes: p.notes == null ? null : txt(p.notes, 1000, 1), imgs: (Array.isArray(p.imgs) ? p.imgs : []).map(okUrl).filter(Boolean).slice(0, MAXP), status: p.status === 'sold' ? 'sold' : 'active', mine: true, cloud: p.cloud === true, t: Number.isFinite(+p.t) ? +p.t : Date.now(), n: Math.min(Math.max(parseInt(p.n, 10) || 1, 1), MAXP), seller: (typeof SELLER !== 'undefined' && SELLER && typeof SELLER === 'object') ? SELLER : {} }; };
  const keep = [], ids = new Set(); let own = 0;
  (Array.isArray(state.products) ? state.products : (bad++, [])).forEach(p => {
    if (!p || typeof p !== 'object') { bad++; return; }
    if (BUILT.has(p)) { keep.push(p); ids.add(p.id); return; }
    if (p.mine !== true || typeof p.id !== 'string' || !ID.test(p.id) || ids.has(p.id) || own >= 200) { bad++; return; }
    ids.add(p.id); own++; keep.push(norm(p));
  });
  state.products = keep;
  try { const raw = localStorage.getItem('moisnar.v1'); if (raw !== null) { let o = null; try { o = JSON.parse(raw); } catch (e) {} if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).some(k => !['lang', 'cur', 'country', 'gov', 'hist', 'sort', 'favs', 'prof', 'contact', 'mine'].includes(k))) bad++; } } catch (e) {}
  try { Object.keys(localStorage).forEach(k => { if (/^moisnar\./i.test(k) && ![SK, RLK, 'moisnar.v1'].includes(k)) { localStorage.removeItem(k); bad++; } }); } catch (e) {}
  try { Object.keys(sessionStorage).forEach(k => { if (/^moisnar\./i.test(k) && k !== 'moisnar.log') sessionStorage.removeItem(k); }); } catch (e) {}
  if (bad) { log('local_corrupt', { n: bad }); try { save(); } catch (e) {} }
}
sanitizeLocal();

let adapterSet = false, configSet = false;
const Core = {
  config: { maintenance: false, requireLogin: false },
  loading: true, errs: null, cerr: false, pending: null, notifs: [], offShown: false,
  adapter: {
    login: async provider => ({ id: 'u_' + Date.now(), provider, exp: Date.now() + 8 * 36e5 }),
    session: async hint => (hint && hint.exp > Date.now() ? hint : null),
    logout: async () => {},
    health: async () => ({ maintenance: Core.config.maintenance }),
    notifications: async () => [],
    uploadPhoto: null, uploadAvatar: null, saveProduct: null, saveProfile: null,
    report: async () => {},
    support: async () => {}
  }
};

const firebaseConfig = {
  apiKey: "AIzaSyCVWNe8339rtIHcrrziyeZTegGRFq8BIMA",
  authDomain: "moisnar.firebaseapp.com",
  projectId: "moisnar",
  storageBucket: "moisnar.firebasestorage.app",
  messagingSenderId: "1073610976415",
  appId: "1:1073610976415:web:d918995f592bc5190f86aa",
  measurementId: "G-FCFG2T95CN"
};
const FB_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
let signingOut = false;
const fbReady = (async () => {
  try {
    const [appM, authM] = await Promise.all([import(FB_BASE + 'firebase-app.js'), import(FB_BASE + 'firebase-auth.js')]);
   const app = appM.initializeApp(firebaseConfig); const auth = authM.getAuth(app);
    const fb = { auth, provider: new authM.GoogleAuthProvider(), twitterProvider: new authM.TwitterAuthProvider(), signInWithPopup: authM.signInWithPopup, signOut: authM.signOut };
    authM.onAuthStateChanged(auth, u => {
      if (u) { if (session && session.id === u.uid && applyUser(u)) render(true); return; }
      setTimeout(() => { if (session && ['google', 'x'].includes(session.provider) && !signingOut && !auth.currentUser) endSession('other_tab'); }, 300);
    });
    return fb;
  } catch (e) { log('firebase_load_fail', {}, 'info'); return null; }
})();
function applyUser(u) {
  let ch = false;
  const nm = fix(clean(u.displayName || ''), RULES['P.name']).trim(), ph = okUrl(u.photoURL || '');
  if (nm && !state.prof.name) { state.prof.name = nm; ch = true; }
  if (ph && !state.prof.photo) { state.prof.photo = ph; ch = true; }
  if (ch && nm) { try { save(); } catch (e) {} }
  return ch;
}
async function handleGoogleSignIn() {
  const fb = await fbReady; if (!fb) throw new Error('firebase_unavailable');
  let r;
  try { r = await fb.signInWithPopup(fb.auth, fb.provider); }
  catch (e) { if (e && ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) throw Object.assign(new Error('cancelled'), { status: 400 }); throw e; }
  applyUser(r.user);
  return { id: r.user.uid, provider: 'google', exp: Date.now() + 8 * 36e5 };
}
async function handleTwitterLogin() {
  const fb = await fbReady; if (!fb) throw new Error('firebase_unavailable');
  let r;
  try { r = await fb.signInWithPopup(fb.auth, fb.twitterProvider); }
  catch (e) { if (e && ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) throw Object.assign(new Error('cancelled'), { status: 400 }); throw e; }
  applyUser(r.user);
  return { id: r.user.uid, provider: 'x', exp: Date.now() + 8 * 36e5 };
}
async function handleSignOut() {
  const fb = await fbReady; if (!fb) return;
  signingOut = true;
  try { await fb.signOut(fb.auth); } finally { setTimeout(() => { signingOut = false; }, 1000); }
}
const mockLogin = Core.adapter.login, mockSession = Core.adapter.session;
Core.adapter.login = async provider => (provider === 'google' ? handleGoogleSignIn() : provider === 'x' ? handleTwitterLogin() : mockLogin(provider));
Core.adapter.session = async hint => {
  if (!hint || !['google', 'x'].includes(hint.provider)) return mockSession(hint);
  const fb = await fbReady; if (!fb) return null;
  await fb.auth.authStateReady();
  const u = fb.auth.currentUser;
  if (!u || u.uid !== hint.id || !(hint.exp > Date.now())) return null;
  applyUser(u);
  return hint;
};
Core.adapter.logout = handleSignOut;

const addIcon = (k, v) => { if (!P[k]) P[k] = v; };
addIcon('lock', '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
addIcon('wrench', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>');
addIcon('wifioff', '<path d="M2 8.8a15 15 0 0 1 4.2-2.5M22 8.8a15 15 0 0 0-9-3.7M5 12.9a10 10 0 0 1 5-2.7M19 12.9a10 10 0 0 0-2.4-1.8M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M2 2l20 20"/>');
addIcon('tag', '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>');
addIcon('alert', '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>');
addIcon('bellx', '<path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l1.5 2h-15M10 21h4M3 3l18 18"/>');

const css = `
.cban{display:flex;gap:12px;align-items:center;margin:12px 0;padding:14px;border-radius:20px;background:var(--redbg);border:1px solid #F3B7B7;color:#8E1B12;text-align:start;width:100%}
.cban .ci{flex:none;width:44px;height:44px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center}
.cban .cb{flex:1;min-width:0}.cban b{display:block;font-size:16px}.cban span{font-size:14px}
.fld.bad>label{color:var(--red)}.fld.bad .inp{border-color:var(--red);background:#FFF5F5}
.cbadbox .tile{border-color:#F3B7B7;background:#FFF5F5}.cbadbox .tile.add{border-color:var(--red);color:var(--red)}
.emsg{display:flex;gap:6px;align-items:center;color:var(--red);font-size:14px;margin-top:6px}
.cwarn{border:2px solid var(--red);background:#FFF5F5;border-radius:24px;padding:16px;margin:14px 0;color:#8E1B12;text-align:start}
.cwarn b{display:flex;gap:8px;align-items:center;font-size:16px}.cwarn p{font-size:14px;margin:6px 0 12px}
.cskel i{display:block;border-radius:24px;background:linear-gradient(90deg,#F2F8F5,#E1EFE8,#F2F8F5);background-size:200% 100%;animation:csh 1.2s linear infinite}
@keyframes csh{to{background-position:-200% 0}}
.cprog{height:10px;border-radius:5px;background:var(--light);overflow:hidden;margin-top:8px}
.cprog i{display:block;height:100%;width:0;background:var(--dark);border-radius:5px;transition:width .25s}
.cspin{display:inline-flex;animation:csp .9s linear infinite}@keyframes csp{to{transform:rotate(360deg)}}
.nitem{display:flex;gap:14px;align-items:center;padding:14px;border-radius:26px;margin-bottom:10px;text-align:start;width:100%}
.nitem.un{background:var(--light)}
.nitem .nic{flex:none;width:48px;height:48px;border-radius:50%;background:var(--light);color:var(--dark);display:flex;align-items:center;justify-content:center}
.nitem.un .nic{background:#fff}.nitem.red .nic{color:#B42318}
.nitem .nb{flex:1;min-width:0}.nitem b{display:block;font-size:16px}.nitem p{font-size:14px;color:var(--muted)}.nitem small{font-size:12px;color:var(--gray)}
.nitem i.dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--dark)}
.gbtn{height:54px;border-radius:27px;border:1px solid #D8E5DF;background:#fff;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;width:100%;margin-top:12px}
.mark{color:var(--dark);font-weight:600;font-size:15px}.tl{color:var(--dark);font-weight:700}
.ctop{position:fixed;top:0;left:0;height:3px;background:var(--dark);width:0;z-index:60;transition:width .4s}`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

const chevFwd = `<span style="display:inline-flex;transform:scaleX(-1)">${ic('back', 18, { w: 2.4 })}</span>`;
const banner = (title, sub, a) => `<${a ? 'button data-a="' + a + '"' : 'div'} class="cban"><span class="ci">${ic('alert', 22, { w: 2, c: '#fff' })}</span><span class="cb"><b>${title}</b><span>${sub}</span></span>${a ? chevFwd : ''}</${a ? 'button' : 'div'}>`;
const parse = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
function cut(r, extra) {
  const pg = parse(r.html), kids = [...pg.children];
  const i = kids.findIndex(k => k.matches('[data-a="homecat"]') || k.querySelector('[data-a="homecat"]'));
  kids.slice(i + 1).forEach(k => k.remove());
  pg.insertAdjacentHTML('beforeend', extra);
  return { ...r, html: pg.outerHTML };
}
const bar = w => { let b = document.querySelector('.ctop'); if (!b) { b = document.createElement('div'); b.className = 'ctop'; document.body.appendChild(b); } b.style.width = w + '%'; if (w >= 100) setTimeout(() => b.remove(), 450); };
const btn2 = (a, lab, light) => `<button class="btn ${light ? 'light ' : ''}sm" style="margin-top:${light ? 10 : 12}px" data-a="${a}">${lab}</button>`;

const G = {
  favs: ['heart', ['Log in to save your favorites', 'سجّل الدخول لحفظ مفضلتك'], ['Save the products you like and come back to them anytime.', 'احفظ المنتجات التي أعجبتك وارجع إليها في أي وقت.'], ['Log in to save the products you like and come back to them anytime.', 'سجّل دخولك لحفظ المنتجات التي أعجبتك والرجوع إليها في أي وقت.']],
  explore: ['compass', ['Log in to explore', 'سجّل الدخول للاستكشاف'], ['Discover products by cheapest, newest and nearest to you.', 'اكتشف المنتجات حسب الأرخص والأحدث والأقرب إليك.'], ['Log in to explore products and browse by direction.', 'سجّل دخولك لاستكشاف المنتجات وتصفحها حسب الاتجاه.']],
  add: ['plus', ['Log in to post your product', 'سجّل الدخول لنشر منتجك'], ['Post your product so buyers can see it and contact you directly.', 'انشر منتجك ليراه المشترون ويتواصلوا معك مباشرة.'], ['Log in to post your product and contact buyers.', 'سجّل دخولك لنشر منتجك والتواصل مع المشترين.']],
  acct: ['person', ['Log in to access your account', 'سجّل الدخول للوصول إلى حسابك'], ['Create your account to post and manage products and contact sellers.', 'أنشئ حسابك لنشر المنتجات وإدارتها والتواصل مع البائعين.'], ['Log in to access your account and manage your products.', 'سجّل دخولك للوصول إلى حسابك وإدارة منتجاتك.']],
  prod: [0, 0, 0, ['To view product details and contact the seller, please log in first.', 'لعرض تفاصيل المنتج والتواصل مع البائع، سجّل دخولك أولاً.']]
};
const TITLE = { favs: () => T('Favorites', 'المفضلة'), explore: () => T('Explore', 'استكشف'), add: () => T('Post a product', 'نشر منتج'), acct: () => T('My account', 'حسابي') };
const pick = a => T(a[0], a[1]);
const guest = (k, nav) => ({ nav, html: `<div class="pg nav"><div class="title">${TITLE[k]()}</div>${empty(G[k][0], pick(G[k][1]), pick(G[k][2]),
  `<button class="btn fit" style="margin-top:26px" data-a="login" data-v="${k}">${T('Log in', 'تسجيل الدخول')}</button><button style="margin-top:22px;font-weight:600;color:var(--dark)" data-a="tab" data-v="home">${T('Continue browsing', 'متابعة التصفح')}</button>`)}</div>` });
const GOOGLE = '<svg width="24" height="24" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.900 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>';
const XLOGO = '<svg width="22" height="22" viewBox="0 0 24 24"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const socials = () => `<button class="gbtn" data-a="loginDo" data-v="google">${GOOGLE}<span>${T('Continue with Google', 'المتابعة عبر Google')}</span></button><button class="gbtn" data-a="loginDo" data-v="x">${XLOGO}<span>${T('Continue with X', 'المتابعة عبر X')}</span></button>`;
const terms = () => `<p style="font-size:13px;color:var(--muted);text-align:center;margin-top:20px">${T('By continuing, you agree to the', 'بالمتابعة أنت توافق على')} <button class="tl" data-a="legal" data-v="legalt">${T('Terms of Use', 'شروط الاستخدام')}</button> ${T('and', 'و')} <button class="tl" data-a="legal" data-v="legalp">${T('Privacy Policy', 'سياسة الخصوصية')}</button></p>`;
function ask(k, after) {
  Core.pending = after || null;
  openSheet(`<div><button class="x36" data-a="closeov">${ic('x', 18, { w: 2.2 })}</button></div><div style="text-align:center"><div style="width:72px;height:72px;border-radius:50%;background:var(--light);color:var(--dark);display:inline-flex;align-items:center;justify-content:center">${ic('lock', 32, { w: 1.8 })}</div><h3 style="font-size:24px;margin:14px 0 8px">${T('Log in to continue', 'سجّل دخولك للمتابعة')}</h3><p style="color:var(--muted);margin-bottom:12px">${pick(G[k][3])}</p></div>${socials()}${terms()}`);
}
function loginDo(provider, el) {
  return once('login', async () => {
    el.classList.add('dis'); el.insertAdjacentHTML('afterbegin', `<span class="cspin">${ic('refresh', 20, { w: 2 })}</span>`);
    try {
      setSession(await call('login', provider)); await refreshNotifs(); closeOv();
      if (['gadd', 'welcome'].includes(cur().n)) stack = [{ n: 'home' }];
      const f = Core.pending; Core.pending = null; render(); if (f) f();
    } catch (e) { log('login_fail', { m: String(e && e.message).slice(0, 40) }); closeOv(); toast(String((e && (e.code || e.message)) || '').slice(0, 60) + ' | Login failed'); console.error('login_error', e); }
  });
}
function logout() {
  return once('logout', async () => {
    try { await call('logout'); } catch (e) { log('logout_fail', {}, 'info'); }
    endSession('logout'); closeOv(); stack = [{ n: 'welcome' }]; render();
  });
}
['favs', 'explore', 'acct'].forEach(k => { const o = SCREENS[k]; SCREENS[k] = p => (state.user ? o(p) : guest(k, k)); });
SCREENS.gadd = () => guest('add', 'add');
SCREENS.welcome = () => ({ nav: null, html: `<div class="pg"><div style="margin:0 -16px;padding:150px 24px 90px;background:var(--light);border-radius:0 0 48px 48px;text-align:center"><img src="${ASSETS.LOGO}" alt="MOISNAR" style="width:205px;height:auto;margin:0 auto"><p style="margin-top:16px;color:#3f574c">${T('Discover products and contact sellers directly', 'اكتشف المنتجات وتواصل مع البائع مباشرة')}</p></div><div style="text-align:center;padding:36px 0 8px"><h2 style="font-size:28px">${T('Get started', 'ابدأ الآن')}</h2><p style="color:var(--muted);margin:8px 0 20px">${T('Log in to browse and post', 'سجّل دخولك للتصفح والنشر')}</p>${socials()}</div>${terms()}</div>` });

const NTY = ['update', 'fav', 'price', 'live', 'report', 'gone'];
async function refreshNotifs() {
  try {
    const a = authed() ? await call('notifications') : [], tx = v => (Array.isArray(v) ? [clean(v[0]).slice(0, 120), clean(v[1]).slice(0, 120)] : ['', '']);
    Core.notifs = (Array.isArray(a) ? a : []).slice(0, 100).filter(x => x && typeof x.id === 'string' && ID.test(x.id) && NTY.includes(x.ty)).map(x => ({ id: x.id, ty: x.ty, ts: Number.isFinite(+x.ts) ? +x.ts : Date.now(), u: x.u ? 1 : 0, t: tx(x.t), b: tx(x.b) }));
  } catch (e) { Core.notifs = []; log('notifs_fail', {}, 'info'); }
}
const unread = x => x.u && !store.read.includes(x.id);
function ago(ts) {
  const ar = state.lang === 'ar', m = Math.floor((Date.now() - ts) / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return T('Just now', 'الآن');
  if (h < 1) return ar ? (m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`) : `${m} minute${m > 1 ? 's' : ''} ago`;
  if (d < 1) return ar ? (h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`) : `${h} hour${h > 1 ? 's' : ''} ago`;
  if (d === 1) return T('Yesterday', 'أمس');
  return ar ? (d === 2 ? 'قبل يومين' : d <= 10 ? `قبل ${d} أيام` : `قبل ${d} يومًا`) : `${d} days ago`;
}
const NI = { update: 'refresh', fav: 'heart', price: 'tag', live: 'box', report: 'alert', gone: 'info' };
const nitem = x => `<button class="nitem ${unread(x) ? 'un' : ''} ${x.ty === 'report' ? 'red' : ''}" data-a="nread" data-v="${x.id}"><span class="nic">${ic(NI[x.ty], 24, { w: 1.9 })}</span><span class="nb"><b>${esc(pick(x.t))}</b><p>${esc(pick(x.b))}</p><small>${ago(x.ts)}</small></span>${unread(x) ? '<i class="dot"></i>' : ''}</button>`;
SCREENS.notifs = () => ({ nav: 'home', html: `<div class="pg nav">${hdr(T('Notifications', 'الإشعارات'), { right: Core.notifs.some(unread) ? `<button class="mark" data-a="markAll">${T('Mark all read', 'قراءة الكل')}</button>` : '' })}${Core.notifs.length ? Core.notifs.map(nitem).join('') : empty('bell', T('No notifications', 'لا توجد إشعارات'), T('Notifications about your products and favorites will appear here.', 'ستظهر هنا إشعارات منتجاتك ومفضلتك عند وصولها.'))}</div>` });
const perm = () => (window.Notification ? Notification.permission : 'unsupported');
function offDlg() {
  Core.offShown = true;
  dlg('bellx', 'var(--redbg)', '#B42318', T('Notifications are turned off', 'الإشعارات متوقفة'), T('Enable the notification permission in your phone settings to receive alerts.', 'فعّل إذن الإشعارات من إعدادات هاتفك لتصلك التنبيهات.'), '', btn2('closeov', T('Got it', 'فهمت')));
}
function enableSheet() {
  const row = k => `<div style="display:flex;gap:12px;align-items:center;margin:8px 0"><span style="flex:none;width:34px;height:34px;border-radius:50%;background:#fff;color:var(--dark);display:flex;align-items:center;justify-content:center">${ic('check', 16, { w: 2.6 })}</span><span style="font-size:15px">${k}</span></div>`;
  openSheet(`<div style="text-align:center"><div style="width:72px;height:72px;border-radius:50%;background:var(--light);color:var(--dark);display:inline-flex;align-items:center;justify-content:center">${ic('bell', 30, { w: 1.8 })}</div><h3 style="font-size:24px;margin:12px 0 6px">${T('Turn on notifications', 'فعّل الإشعارات')}</h3><p style="color:var(--muted)">${T('Stay up to date with what matters to you, even when the app is closed.', 'لنبقيك على اطلاع بما يهمك، وتصلك الإشعارات حتى لو كان التطبيق مغلقًا.')}</p></div><div style="background:var(--light);border-radius:24px;padding:12px 16px;margin:16px 0;text-align:start">${row(T('A product in your favorites changed price', 'تغيّر سعر منتج في مفضلتك'))}${row(T('Your product is live', 'تم نشر منتجك'))}${row(T('Your report was reviewed', 'تمت مراجعة بلاغك'))}</div><button class="btn" data-a="notifOn">${T('Enable notifications', 'تفعيل الإشعارات')}</button>${btn2('notifLater', T('Not now', 'ليس الآن'), 1)}<p style="font-size:13px;color:var(--muted);text-align:center;margin-top:12px">${T('A prompt from your phone will ask you to confirm. Tap Allow.', 'ستظهر نافذة من هاتفك لتأكيد الإذن، اضغط سماح.')}</p>`);
}
function bell() {
  if (!state.user) return ask('acct', bell);
  const p = perm();
  if (p === 'default' && !store.asked) return enableSheet();
  if (p === 'denied' && !Core.offShown) return offDlg();
  go('notifs');
}

const homeO = SCREENS.home;
SCREENS.home = p => {
  const r = homeO(p);
  if (Core.loading) return cut(r, `<div class="cskel"><div style="display:flex;justify-content:space-between;margin:22px 0 16px"><i style="width:120px;height:32px;border-radius:16px"></i><i style="width:56px;height:24px;border-radius:12px"></i></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${'<div><i style="height:140px"></i><i style="height:14px;width:70%;margin-top:12px;border-radius:7px"></i><i style="height:14px;width:40%;margin-top:10px;border-radius:7px"></i></div>'.repeat(4)}</div></div>`);
  if (!navigator.onLine) return cut(r, empty('wifioff', T('No internet connection', 'لا يوجد اتصال بالإنترنت'), T('Check your network connection and try again.', 'تحقق من اتصالك بالشبكة ثم حاول مرة أخرى.'), `<button class="btn fit" data-a="retry">${ic('refresh', 20, { w: 2 })} ${T('Try again', 'إعادة المحاولة')}</button>`));
  if (!state.country) { const pg = parse(r.html), s = pg.querySelector('.sechd'); if (s) s.insertAdjacentHTML('beforebegin', banner(T("You haven't set your country", 'لم تحدد دولتك بعد'), T('Set your country to see products near you.', 'حدّد دولتك لتظهر لك المنتجات القريبة منك.'), 'setCountry')); return { ...r, html: pg.outerHTML }; }
  return r;
};
const dirO = SCREENS.dir;
SCREENS.dir = p => (p.k === 'near' && !state.country ? { nav: 'explore', html: `<div class="pg nav">${hdr(T('Near you', 'قريب منك'), { sub: T('Products and sellers in your city', 'منتجات وبائعون في مدينتك') })}${banner(T("You haven't set your country", 'لم تحدد دولتك بعد'), T('Set your country to see products near you.', 'حدّد دولتك لتظهر لك المنتجات القريبة منك.'), 'setCountry')}${empty('pin', T("We can't find products near you yet", 'لا يمكننا تحديد المنتجات القريبة'), T('Set your country so we can show you products and sellers in your city.', 'حدّد دولتك لنعرض لك منتجات وبائعين في مدينتك.'), `<button class="btn fit" data-a="setCountry">${T('Set country', 'تحديد الدولة')}</button>`)}</div>` } : dirO(p));
const prodO = SCREENS.prod;
SCREENS.prod = p => { const x = byId(p.id); if (x && (x.status === 'active' || x.mine)) return prodO(p);
  return { nav: null, html: `<div class="pg"><div class="hdr">${backBtn()}</div><div class="center" style="margin-top:150px"><div class="bigc" style="position:relative">${ic('box', 60, { w: 1.6 })}<span style="position:absolute;bottom:2px;inset-inline-end:2px;width:40px;height:40px;border-radius:14px;background:var(--red);color:#fff;border:3px solid #fff;display:flex;align-items:center;justify-content:center">${ic('x', 18, { c: '#fff', w: 2.6 })}</span></div><h2>${T('This product is unavailable', 'هذا المنتج غير متاح')}</h2><p>${T('It may have been sold or removed by the seller.', 'ربما تم بيعه أو حذفه من قبل البائع.')}</p><button class="btn fit" data-a="tab" data-v="explore">${T('Browse other products', 'تصفح منتجات أخرى')}</button><button style="margin-top:22px;font-weight:600;color:var(--dark)" data-a="tab" data-v="home">${T('Back to home', 'العودة للرئيسية')}</button></div></div>` }; };

const contactOK = () => [state.contact.phone, state.prof.phone].some(v => v && V.phone(v)) || [state.contact.email, state.prof.email].some(v => v && V.email(v));
function sanitizeForm() {
  F.name = fix(F.name, RULES['F.name']).trim(); F.desc = fix(F.desc, RULES['F.desc']).trim(); F.notes = fix(F.notes, RULES['F.notes']).trim();
  F.price = fix(F.price, RULES['F.price']); F.qty = fix(F.qty, RULES['F.qty']); F.photos = (F.photos || []).map(okUrl).filter(Boolean).slice(0, MAXP);
}
function validate(edit) {
  sanitizeForm(); const e = {};
  { const had = edit && ((byId(F.id) || {}).imgs || []).length > 0; if ((!edit || had) && F.photos.length < MINP) e.photos = 1; }
  if (!CATIDS.includes(F.cat)) e.cat = 1;
  if (!V.qty(String(F.qty))) e.qty = 1;
  if (!/^[A-Z]{2}$/.test(F.country || '')) e.country = 1;
  if (!(Number.isInteger(+F.gov) && F.gov !== null && F.gov !== '' && +F.gov >= 0)) e.gov = 1;
  if (!V.desc(String(F.desc || ''))) e.desc = 1;
  if (!V.price(String(F.price))) e.price = 1;
  if (!V.name(String(F.name || ''))) e.name = 1;
  if (!edit && !contactOK()) e.contact = 1;
  return e;
}
function photoTiles(pg) {
  const box = pg.querySelector('.ptiles'); if (!box) return;
  if ((F.photos || []).length >= MAXP) { const a = box.querySelector('.tile.add'); if (a) a.remove(); box.querySelectorAll('.tile.empty').forEach(x => x.remove()); }
  const h = pg.querySelector('.ptitle span'); if (h) h.textContent = T(`${(F.photos || []).length}/${MAXP} · at least 1 photo, the first is the main one`, `${(F.photos || []).length}/${MAXP} · صورة واحدة على الأقل، والأولى هي الرئيسية`);
}
const formO = SCREENS.form;
SCREENS.form = p => {
  const r = formO(p), e = Core.errs, pg = parse(r.html); photoTiles(pg);
  if (!e) return { ...r, html: pg.outerHTML };
  const msg = m => `<div class="emsg">${ic('alert', 16, { w: 2 })}${m}</div>`, req = T('This field is required', 'هذا الحقل مطلوب');
  const inv = T('Enter a valid value', 'أدخل قيمة صحيحة'), bad = (sel, m) => { const el = pg.querySelector(sel), f = el && el.closest('.fld'); if (f) { f.classList.add('bad'); f.insertAdjacentHTML('beforeend', msg(m || req)); } };
  if (e.cat) bad('[data-a="pickCat"]'); if (e.qty) bad('[data-in="F.qty"]'); if (e.country) bad('[data-a="pickCountry"]');
  if (e.gov) bad('[data-a="pickGov"]'); if (e.desc) bad('[data-in="F.desc"]', inv); if (e.price) bad('[data-in="F.price"]', inv); if (e.name) bad('[data-in="F.name"]', inv);
  const ph = pg.querySelector('.tile.add'); if (e.photos && ph) { ph.parentElement.classList.add('cbadbox'); ph.parentElement.insertAdjacentHTML('afterend', msg(T('Please add at least one photo', 'يرجى إضافة صورة واحدة على الأقل'))); }
  const fields = e.cat || e.qty || e.country || e.gov || e.desc || e.price || e.name;
  const bn = e.photos ? [T("Couldn't publish the product", 'تعذّر نشر المنتج'), T('Please add at least one photo', 'يرجى إضافة صورة واحدة على الأقل')]
    : fields ? [T('Complete the required fields', 'أكمل تعبئة الحقول المطلوبة'), T('Fields marked in red are still empty', 'الحقول المحددة بالأحمر لم تُملأ بعد')]
    : [T("Couldn't publish the product", 'تعذّر نشر المنتج'), T('Add at least one contact method in Settings', 'أضف وسيلة تواصل واحدة على الأقل من الإعدادات')];
  const h = pg.querySelector('.hdr'); if (h) h.insertAdjacentHTML('afterend', banner(bn[0], bn[1]));
  const pb = pg.querySelector('[data-a="publish"]');
  if (e.contact && pb) pb.insertAdjacentHTML('beforebegin', `<div class="cwarn"><b>${ic('alert', 20, { w: 2 })}${T("You haven't added contact methods yet", 'لم تضف وسائل تواصل بعد')}</b><p>${T('Go to Settings → Contact methods and add your phone number or email (at least one) so you can publish.', 'اذهب إلى الإعدادات ← وسائل التواصل، وأضف رقم هاتفك أو بريدك الإلكتروني (واحدة على الأقل) لتتمكن من نشر المنتج.')}</p><button class="btn sm red fit" data-a="go:contact">${ic('gear', 20, { w: 2 })} ${T('Go to Settings', 'الذهاب إلى الإعدادات')}</button></div>`);
  return { ...r, html: pg.outerHTML };
};
const contactO = SCREENS.contact;
SCREENS.contact = p => {
  const r = contactO(p); if (!Core.cerr) return r;
  const pg = parse(r.html), inval = Core.cerr === 'invalid', c = state.contact;
  const m0 = inval ? null : T('Add at least one of the two', 'أضف إحدى الوسيلتين على الأقل');
  [['C.phone', c.phone, V.phone], ['C.email', c.email, V.email]].forEach(([k, v, f]) => { if (inval && (!v || f(v))) return; const m = m0 || (k === 'C.phone' ? T('Phone number must be 9 to 15 digits', 'رقم الهاتف يجب أن يكون من 9 إلى 15 رقماً') : T('Enter a valid email like name@example.com', 'أدخل بريداً صحيحاً مثل name@example.com')); const i = pg.querySelector(`[data-in="${k}"]`), b = i && i.closest('.inp'); if (b) { b.style.cssText += ';border-color:var(--red);background:#FFF5F5'; b.insertAdjacentHTML('afterend', `<div class="emsg">${ic('alert', 16, { w: 2 })}${m}</div>`); } });
  const h = pg.querySelector('.hdr'); if (h) h.insertAdjacentHTML('afterend', inval ? banner(T('Check your contact details', 'تحقق من بيانات التواصل'), T('Phone: 9 to 15 digits. Email: a real address like name@example.com.', 'الهاتف: من 9 إلى 15 رقماً. البريد: عنوان حقيقي مثل name@example.com.')) : banner(T('Add at least one contact method', 'أضف وسيلة تواصل واحدة على الأقل'), T('Add your phone number or email so you can save changes.', 'أضف رقم هاتفك أو بريدك الإلكتروني لتتمكن من حفظ التغييرات.')));
  return { ...r, html: pg.outerHTML };
};
function progDlg(done, n) {
  const pct = Math.floor(done / n * 100), lab = T(`Uploading photos ${done} of ${n}`, `رفع الصور ${done} من ${n}`);
  const el = document.getElementById('cpl');
  if (el) { el.textContent = lab; document.getElementById('cpp').textContent = pct + '%'; document.getElementById('cpb').style.width = pct + '%'; return; }
  openDlg(`<div class="ib" style="background:var(--light);color:var(--dark)"><span class="cspin">${ic('refresh', 32, { w: 2 })}</span></div><h3>${T('Publishing your product', 'جارٍ نشر المنتج')}</h3><p>${T("Please don't close the app while photos upload.", 'لا تغلق التطبيق أثناء رفع الصور.')}</p><div style="width:100%;display:flex;justify-content:space-between;font-size:14px;margin-top:6px"><span id="cpl">${lab}</span><span id="cpp">${pct}%</span></div><div class="cprog" style="width:100%"><i id="cpb" style="width:${pct}%"></i></div>`);
}
const storageReady = () => typeof Core.adapter.uploadPhoto === 'function';
const optimizing = () => T('Optimizing photos… please wait a moment.', 'جارٍ تحسين الصور… انتظر لحظة.');
const productPayload = urls => ({ name: F.name, cat: F.cat, price: +F.price || 0, qty: +F.qty, country: F.country, gov: +F.gov, desc: F.desc, notes: F.notes, images: urls });
function failDlg(title) {
  dlg('alert', 'var(--redbg)', '#B42318', title || T('Photo upload failed', 'فشل رفع الصور'), T('Check your internet connection and try again. Your product details are saved.', 'تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى. بيانات المنتج محفوظة.'), '', btn2('upRetry', T('Try again', 'إعادة المحاولة')) + btn2('closeov', T('Cancel', 'إلغاء'), 1));
}
async function uploadSet(ph) {
  const n = ph.length; let done = ph.filter(u => u.startsWith('https://') || UP.has(u)).length; progDlg(done, n);
  try {
    const urls = [];
    for (const u of ph) {
      if (u.startsWith('https://')) { urls.push(u); continue; }
      if (!UP.has(u)) {
        const f = FILES.get(u); if (!f || PH.get(u) !== 'ready') throw new Error('not_compressed');
        const r = await call('uploadPhoto', f, ph.indexOf(u)), url = r && r.url;
        if (typeof url !== 'string' || !url.startsWith('https://') || !(url = okUrl(url))) throw new Error('bad_url');
        UP.set(u, url); done++; progDlg(done, n);
      }
      urls.push(UP.get(u));
    }
    return urls;
  } catch (e) { log('upload_fail', { m: String(e && e.message).slice(0, 30) }, 'info'); failDlg(); return null; }
}
function uploadAll() {
  return once('upload', async () => {
    if (!lim('publish', 8, 6e5)) return RL.note(T('You are publishing too fast. Please wait a few minutes.', 'تنشر بسرعة كبيرة. انتظر بضع دقائق.'));
    const ph = [...F.photos]; if (ph.some(isProc)) return toast(optimizing());
    let urls = null;
    if (storageReady()) {
      urls = await uploadSet(ph); if (!urls) return;
      if (typeof Core.adapter.saveProduct === 'function') { try { await call('saveProduct', productPayload(urls)); } catch (e) { log('save_fail', {}, 'info'); return failDlg(T("Couldn't save the product", 'تعذّر حفظ المنتج')); } }
      await wait(250); closeOv();
    } else log('storage_not_connected', {}, 'info');
    const p = createProduct(); p.cloud = !!urls;
    if (urls) { p.imgs = urls; ph.forEach(u => { if (u.startsWith('blob:')) release(u); }); }
    try { save(); } catch (e) {}
    Core.errs = null; stack.pop(); go('done', { id: p.id });
  });
}
function publish() {
  if (F.photos.some(isProc)) return toast(optimizing());
  const e = validate(false);
  if (Object.keys(e).length) { log('publish_invalid', { keys: Object.keys(e) }); Core.errs = e; render(true); const sc = document.querySelector('.scroll'); if (sc) sc.scrollTop = 0; return; }
  Core.errs = null; uploadAll();
}
['newForm', 'formFrom'].forEach(k => { const o = window[k]; window[k] = function () { Core.errs = null; try { (F && F.photos || []).forEach(releaseIfFree); } catch (e) {} return o.apply(this, arguments); }; });

function boot() {
  return once('boot', async () => {
    feedSeed = newSeed(); Core.loading = true; bar(35); render(true);
    try { const h = await call('health'); Core.config.maintenance = !!h && h.maintenance === true; } catch (e) { log('health_fail', {}, 'info'); }
    try { session = store.hint ? cleanHint(await call('session', store.hint), store.hint) : null; if (!sOK(session)) { session = null; store.hint = null; persist(); } else if (store.hint && store.hint.uid !== session.uid) { store.hint = session; persist(); } } catch (e) { session = null; log('session_fail', {}, 'info'); }
    await refreshNotifs(); await wait(450); Core.loading = false; bar(100);
    if (Core.config.requireLogin && !authed()) stack = [{ n: 'welcome' }];
    render(true);
  });
}
const maintO = Object.assign({}, SCREENS);
Object.keys(maintO).forEach(k => { const o = maintO[k]; SCREENS[k] = p => (Core.config.maintenance ? { nav: null, html: `<div class="pg">${empty('wrench', T('The app is under maintenance', 'التطبيق متوقف للصيانة'), T("We're improving the app right now. We'll be back soon, thank you for your patience.", 'نعمل حاليًا على تحسين التطبيق. سنعود قريبًا، شكرًا لصبرك.'))}</div>` } : o(p)); });
window.addEventListener('online', () => render(true)); window.addEventListener('offline', () => render(true));
document.addEventListener('input', ev => { const k = ev.target.dataset && ev.target.dataset.in; if (Core.cerr && k && k.startsWith('C.')) { Core.cerr = false; render(true); } });

const baseAct = window.act;
window.act = function (a, el) {
  const n = a.split(':')[0], d = el.dataset;
  switch (n) {
    case 'add': if (!state.user) { stack = [{ n: 'gadd' }]; render(); return; } break;
    case 'login': ask(d.v, d.v === 'add' ? () => { stack = [{ n: 'home' }]; baseAct('add', el); } : null); return;
    case 'loginDo': loginDo(d.v, el); return;
    case 'legal': closeOv(); go(d.v); return;
    case 'open': case 'contactSheet': if (!state.user) { ask('prod', () => window.act(a, el)); return; } break;
    case 'fav': if (!state.user) { ask('favs', () => window.act(a, el)); return; } break;
    case 'soon': if (el.classList.contains('bell')) { bell(); return; } break;
    case 'logoutConfirm': logout(); return;
    case 'supportOpen': openSupport(); return;
    case 'supCat': SUP.cat = d.v; showSupport(); return;
    case 'supportSend': supportSend(); return;
    case 'publish': publish(); return;
    case 'upRetry': if (F.id) { const b = document.querySelector('[data-a="saveEdit"]'); if (b) window.act('saveEdit', b); } else uploadAll(); return;
    case 'retry': if (!lim('retry', 4, 3e4)) { RL.note(T('Please wait a moment before trying again.', 'انتظر لحظة قبل إعادة المحاولة.')); return; } RL.retryReset(); boot(); return;
    case 'setCountry': TMP = { t: 'home', q: '', country: null }; go('pickCountry'); return;
    case 'saveContact': { const c = state.contact; c.phone = fix(c.phone, RULES['C.phone']).trim(); c.email = fix(c.email, RULES['C.email']).trim();
      const ph = c.phone && V.phone(c.phone), em = c.email && V.email(c.email);
      if ((c.phone && !ph) || (c.email && !em)) { Core.cerr = 'invalid'; log('contact_invalid'); render(true); return; }
      if (!ph && !em) { Core.cerr = 'empty'; render(true); return; }
      Core.cerr = false; break; }
    case 'markAll': store.read = Core.notifs.map(x => x.id); persist(); render(true); return;
    case 'nread': if (!store.read.includes(d.v)) { store.read.push(d.v); persist(); render(true); } return;
    case 'notifOn': store.asked = true; persist(); closeOv();
      (window.Notification ? Notification.requestPermission() : Promise.resolve('denied')).then(r => (r === 'granted' ? go('notifs') : offDlg())); return;
    case 'notifLater': store.asked = true; persist(); closeOv(); go('notifs'); return;
  }
  return baseAct(a, el);
};


const SCR_PROT = fset(['mine', 'contact', 'eprof', 'form', 'done', 'favs2', 'notifs']);
const PARAM = Object.freeze({ id: v => ID.test(v), k: v => ['cheap', 'newest', 'near', 'wholesale'].includes(v) });
const go0 = window.go, tab0 = window.tab;
window.go = function (n, p) {
  p = p || {};
  if (typeof n !== 'string' || !Object.prototype.hasOwnProperty.call(SCREENS, n)) return log('nav_unknown', { n });
  for (const k of Object.keys(p)) if (!PARAM[k] || !PARAM[k](String(p[k]))) return log('nav_param', { n, k });
  if ((SCR_PROT.has(n) || n === 'prod') && !authed()) return ask(n === 'prod' ? 'prod' : 'acct', () => window.go(n, p));
  if (stack.length > 30) stack = stack.slice(-10);
  return go0(n, p);
};
window.tab = function (n) { if (!['home', 'explore', 'favs', 'acct'].includes(n)) return log('nav_unknown', { n }); return tab0(n); };
SCR_PROT.forEach(k => { const o = SCREENS[k]; if (o) SCREENS[k] = p => (authed() ? o(p) : guest('acct', 'acct')); });
const owns = id => { const p = byId(id); return !!p && p.mine === true && authed(); };

const render0 = window.render; let recovering = false;
window.render = function () {
  try { if (!SCREENS[cur().n]) { log('bad_screen', { n: cur().n }); stack = [{ n: 'home' }]; } return render0.apply(this, arguments); }
  catch (e) {
    fail(e, 'render'); if (recovering) return; recovering = true;
    try { stack = [{ n: 'home' }]; render0(); }
    catch (e2) { const v = document.getElementById('view'); if (v) v.innerHTML = `<div class="pg">${empty('alert', T('Something went wrong', 'حدث خطأ ما'), T('Reload the app to continue.', 'أعد تحميل التطبيق للمتابعة.'), `<button class="btn fit" data-a="retry">${T('Try again', 'إعادة المحاولة')}</button>`)}</div>`; }
    finally { recovering = false; }
  }
};

const rs0 = window.runSearch;
window.runSearch = function (v) { if (!lim('search', 10, 1e4)) return RL.note(T('Too many searches. Please wait a moment.', 'عمليات بحث كثيرة. انتظر لحظة.')); const q = clean(v !== undefined ? v : ((document.getElementById('qin') || {}).value || '')).trim().slice(0, 80); if (!q) return log('search_empty', {}, 'info'); return rs0(q); };
document.addEventListener('input', ev => {
  const el = ev.target; if (!el || !el.dataset) return; const path = el.dataset.in;
  if (path !== undefined) { const r = RULES[path]; if (!r) { ev.stopImmediatePropagation(); return log('input_path', { path }); } const v = fix(el.value, r); if (v !== el.value) { el.value = v; log('input_clean', { path }, 'info'); } }
  else if (el.id === 'qin') { const v = clean(el.value).slice(0, 80); if (v !== el.value) el.value = v; }
}, true);

const FAM = { jpeg: ['image/jpeg', 'image/jpg', 'image/pjpeg'], png: ['image/png', 'image/x-png'], webp: ['image/webp'], heic: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'] };
const EXT = { jpeg: /\.jpe?g$/i, png: /\.png$/i, webp: /\.webp$/i, heic: /\.(heic|heif)$/i };
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
['fileIn', 'fileProf'].forEach(id => { const el = document.getElementById(id); if (el) el.setAttribute('accept', ACCEPT); });
const KIND = new WeakMap();
async function magic(f) {
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer()), c = i => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
  if (b[0] === 0x89 && c(1).slice(0, 3) === 'PNG') return 'png';
  if (c(0) === 'RIFF' && c(8) === 'WEBP') return 'webp';
  if (c(4) === 'ftyp' && HEIC_BRANDS.includes(c(8))) return 'heic';
  return null;
}
async function kindOf(f) {
  const k = await magic(f); if (!k) return null;
  const t = (f.type || '').toLowerCase();
  if (t && FAM[k].includes(t)) return k;
  if ((!t || t === 'application/octet-stream') && EXT[k].test(f.name || '')) return k;
  return null;
}
const PH = new Map(), UP = new Map();
let AVU = null;
const isProc = u => PH.get(u) === 'processing';
const MAXIN = 75e6, MAXDIM = 4000, MAXOUT = 3.5e6;
const dprX = () => Math.min(3, Math.max(2, window.devicePixelRatio || 1));
const photoBox = () => { const r = (document.getElementById('app') || document.body).getBoundingClientRect(); return { w: Math.round((r.width || 430) * dprX() * 1.5), h: Math.round((r.height || 900) * dprX() * 1.5) }; };
const avatarPx = () => { const b = document.querySelector('[data-a="pickProf"]'); return Math.round(((b && b.getBoundingClientRect().width) || 96) * dprX()); };
function release(u) { if (typeof u === 'string' && u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch (e) {} } PH.delete(u); FILES.delete(u); UP.delete(u); }
function releaseIfFree(u) { if (!state.products.some(p => (p.imgs || []).includes(u)) && state.prof.photo !== u) release(u); }
const queue = []; let running = 0;
const enqueue = job => new Promise((res, rej) => { if (queue.length >= 6) return rej(new Error('busy')); queue.push({ job, res, rej }); pump(); });
function pump() { while (running < 2 && queue.length) { const { job, res, rej } = queue.shift(); running++; job().then(res, rej).finally(() => { running--; pump(); }); } }
const BIGPX = 40e6, FULLPX = 120e6, UNKNOWN_MAX_BYTES = 12e6;
async function probe(f) {
  try {
    const dv = new DataView(await f.slice(0, 2097152).arrayBuffer()), n = dv.byteLength, b = i => dv.getUint8(i);
    if (n < 32) return null;
    if (b(0) === 0xFF && b(1) === 0xD8) {
      let i = 2, o = 1, W = 0, H = 0;
      while (i + 4 <= n) {
        if (b(i) !== 0xFF) return null;
        const m = b(i + 1); if (m === 0xFF) { i++; continue; }
        if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
        const L = dv.getUint16(i + 2); if (L < 2) return null;
        if (m === 0xE1 && L >= 16 && dv.getUint32(i + 4) === 0x45786966) {
          try { const t = i + 10, le = dv.getUint16(t) === 0x4949, p = t + dv.getUint32(t + 4, le), c = dv.getUint16(p, le); for (let k = 0; k < c && k < 64; k++) { const e = p + 2 + 12 * k; if (dv.getUint16(e, le) === 0x0112) { o = dv.getUint16(e + 8, le); break; } } } catch (e) {}
        }
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { H = dv.getUint16(i + 5); W = dv.getUint16(i + 7); break; }
        if (m === 0xDA) break;
        i += 2 + L;
      }
      return W && H ? (o >= 5 && o <= 8 ? { w: H, h: W } : { w: W, h: H }) : null;
    }
    if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return { w: dv.getUint32(16), h: dv.getUint32(20) };
    if (dv.getUint32(0) === 0x52494646 && dv.getUint32(8) === 0x57454250) {
      const k = dv.getUint32(12);
      if (k === 0x56503858) return { w: 1 + (b(24) | b(25) << 8 | b(26) << 16), h: 1 + (b(27) | b(28) << 8 | b(29) << 16) };
      if (k === 0x56503820) return { w: dv.getUint16(26, true) & 0x3FFF, h: dv.getUint16(28, true) & 0x3FFF };
      if (k === 0x5650384C) { const v = dv.getUint32(21, true); return { w: 1 + (v & 0x3FFF), h: 1 + ((v >>> 14) & 0x3FFF) }; }
    }
  } catch (e) {}
  return null;
}
async function decodeBig(file, p) {
  const k = Math.min(1, MAXDIM / p.w, MAXDIM / p.h), rw = Math.max(1, Math.round(p.w * k)), rh = Math.max(1, Math.round(p.h * k));
  try {
    const bm = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' });
    if (Math.abs(bm.width - rw) <= 1 && Math.abs(bm.height - rh) <= 1) return bm;
    if (bm.close) bm.close();
  } catch (e) {}
  return null;
}
async function decode(file, avatar) {
  if (!avatar && window.createImageBitmap) {
    let p = await probe(file);
    if (!p || !(p.w > 0 && p.h > 0)) {
      if (file.size > UNKNOWN_MAX_BYTES) throw new Error('too_large');
      p = null;
    }
    if (p && p.w > 0 && p.h > 0) {
      const px = p.w * p.h; if (px > 250e6) throw new Error('bad_dimensions');
      if (px > BIGPX) { const bm = await decodeBig(file, p); if (bm) return bm; if (px > FULLPX) throw new Error('too_large'); }
    }
  }
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
    try { return await createImageBitmap(file); } catch (e) {}
  }
  const url = URL.createObjectURL(file);
  try { const img = new Image(); img.src = url; await img.decode(); return img; } catch (e) { throw KIND.get(file) === 'heic' ? new Error('heic_unsupported') : e; } finally { URL.revokeObjectURL(url); }
}
function resample(src, sx, sy, sW, sH, dw, dh) {
  let w = sW, h = sH, from = src, fx = sx, fy = sy, tmp = null;
  while (w / 2 >= dw && h / 2 >= dh) {
    const c = document.createElement('canvas'); c.width = Math.ceil(w / 2); c.height = Math.ceil(h / 2);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(from, fx, fy, w, h, 0, 0, c.width, c.height);
    if (tmp) tmp.width = tmp.height = 0; tmp = c; from = c; fx = fy = 0; w = c.width; h = c.height;
  }
  const out = document.createElement('canvas'); out.width = dw; out.height = dh;
  const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, dw, dh); g.imageSmoothingQuality = 'high'; g.drawImage(from, fx, fy, w, h, 0, 0, dw, dh);
  if (tmp) tmp.width = tmp.height = 0;
  return out;
}
async function compress(file, avatar) {
  const src = await decode(file, avatar);
  try {
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    if (!sw || !sh || sw * sh > (avatar ? 120e6 : 250e6)) throw new Error('bad_dimensions');
    let sx = 0, sy = 0, sW = sw, sH = sh, dw, dh; const q = avatar ? 0.85 : 0.92;
    if (avatar) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sW = sH = m; dw = dh = Math.min(avatarPx(), m); }
    else { const k = Math.min(1, MAXDIM / sw, MAXDIM / sh); dw = Math.max(1, Math.round(sw * k)); dh = Math.max(1, Math.round(sh * k)); }
    const cap = avatar ? 5e6 : MAXOUT, qs = avatar ? [q] : [0.92, 0.86, 0.80, 0.74];
    for (let i = 0; i < (avatar ? 4 : 8); i++) {
      const c = resample(src, sx, sy, sW, sH, dw, dh);
      for (const qq of qs) {
        const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', qq));
        if (blob.size <= cap) { c.width = c.height = 0; return { blob, w: dw, h: dh }; }
      }
      c.width = c.height = 0;
      dw = Math.max(1, Math.round(dw * 0.85)); dh = Math.max(1, Math.round(dh * 0.85));
    }
    throw new Error('still_large');
  } finally { if (src.close) src.close(); }
}
const procFail = e => { log('compress_fail', { m: String(e && e.message).slice(0, 30) }); toast(e && (e.message === 'too_large' || e.message === 'bad_dimensions') ? T('This photo is too large to process on this device. Try a smaller one.', 'هذه الصورة كبيرة جداً لمعالجتها على هذا الجهاز. جرّب صورة أصغر.') : e && e.message === 'heic_unsupported' ? T("This device can't read HEIC photos. Use JPEG, PNG or WebP instead.", 'هذا الجهاز لا يستطيع قراءة صور HEIC. استخدم JPEG أو PNG أو WebP بدلاً منها.') : T("Couldn't process one of the photos.", 'تعذّرت معالجة إحدى الصور.')); };
function addPhoto(f) {
  if (F.photos.length >= MAXP) return;
  const pre = URL.createObjectURL(f); PH.set(pre, 'processing'); F.photos.push(pre); render(true);
  enqueue(() => compress(f, false)).then(r => {
    const i = F.photos.indexOf(pre); if (i < 0) { release(pre); return; }
    const cf = new File([r.blob], 'photo.jpg', { type: 'image/jpeg' }), u = URL.createObjectURL(cf);
    F.photos[i] = u; FILES.set(u, cf); PH.set(u, 'ready'); release(pre); render(true);
  }).catch(e => { const i = F.photos.indexOf(pre); if (i >= 0) F.photos.splice(i, 1); release(pre); procFail(e); render(true); });
}
function addAvatar(f) {
  const pre = URL.createObjectURL(f); release(state.prof.photo); state.prof.photo = pre; AVU = null; PH.set(pre, 'processing'); render(true);
  enqueue(() => compress(f, true)).then(r => {
    if (state.prof.photo !== pre) { release(pre); return; }
    const cf = new File([r.blob], 'avatar.jpg', { type: 'image/jpeg' }), u = URL.createObjectURL(cf);
    state.prof.photo = u; AVU = u; FILES.set(u, cf); PH.set(u, 'ready'); release(pre); render(true);
  }).catch(e => { if (state.prof.photo === pre) state.prof.photo = null; release(pre); procFail(e); render(true); });
}
document.addEventListener('change', async ev => {
  const el = ev.target; if (!el || (el.id !== 'fileIn' && el.id !== 'fileProf')) return;
  ev.stopImmediatePropagation();
  const prof = el.id === 'fileProf', max = prof ? 30e6 : MAXIN, list = [...el.files]; el.value = '';
  if (!authed()) return ask('acct');
  const room = prof ? 1 : MAXP - F.photos.length;
  if (room <= 0) return toast(T('Maximum 3 photos per product.', 'الحد الأقصى 3 صور للمنتج.'));
  const over = Math.max(0, list.length - room); let rej = 0; const ok = [];
  for (const f of list.slice(0, room)) { try { const k = f.size >= 100 && f.size <= max ? await kindOf(f) : null; if (k) { KIND.set(f, k); ok.push(f); } else rej++; } catch (e) { rej++; } }
  ok.forEach(f => (prof ? addAvatar(f) : addPhoto(f)));
  if (rej) { log('file_reject', { n: rej }); toast(prof ? T('Some files were rejected. Use JPEG, PNG, HEIC/HEIF or WebP up to 30 MB.', 'تم رفض بعض الملفات. استخدم JPEG أو PNG أو HEIC/HEIF أو WebP حتى 30 ميجابايت.') : T('Some files were rejected. Use JPEG, PNG, HEIC/HEIF or WebP up to 75 MB.', 'تم رفض بعض الملفات. استخدم JPEG أو PNG أو HEIC/HEIF أو WebP حتى 75 ميجابايت.')); }
  else if (over) toast(T('Maximum 3 photos per product.', 'الحد الأقصى 3 صور للمنتج.'));
}, true);

const act1 = window.act;
const AUTH = fset(['publish', 'saveEdit', 'editp', 'delq', 'delDo', 'soldq', 'soldDo', 'repost', 'saveProf', 'saveContact', 'pickProf', 'logoutq', 'delAccq', 'viewNew', 'repSubmit', 'markAll', 'nread', 'notifOn', 'supportOpen', 'supCat', 'supportSend']);
const OWN = fset(['editp', 'delq', 'delDo', 'soldq', 'soldDo', 'repost', 'viewNew']);
const MUT = fset(['publish', 'saveEdit', 'delDo', 'soldDo', 'repost', 'upRetry', 'loginDo', 'logoutConfirm', 'notifOn', 'saveProf', 'saveContact', 'fav', 'retry', 'repSubmit', 'supportSend']);
const ARG = Object.freeze({ tab: v => ['home', 'explore', 'favs', 'acct'].includes(v), go: v => Object.prototype.hasOwnProperty.call(SCREENS, v), homecat: isCat, expcat: isCat, fcat: isCat, selCat: v => CATIDS.includes(v), fcond: v => ['all', 'new', 'used'].includes(v),
  sortSel: v => ['newest', 'oldest', 'cheap', 'exp'].includes(v), langSel: v => ['ar', 'en'].includes(v), selCountry: v => /^[A-Z]{2}$/.test(v), selGov: v => /^\d{1,3}$/.test(v), selCur: v => /^[A-Z]{3}$/.test(v),
  dir: v => ['cheap', 'newest', 'near', 'wholesale'].includes(v), loginDo: v => ['google', 'x'].includes(v), login: v => ['favs', 'explore', 'add', 'acct', 'prod'].includes(v), rmPhoto: v => /^[0-2]$/.test(v), supCat: v => SUPCATS.some(c => c[0] === v) });
const lastAct = {};
window.act = function (a, el) {
  try {
    const ev0 = window.event; if (ev0 && ev0.isTrusted === false) return log('act_untrusted', {});
    if (typeof a !== 'string' || a.length > 40 || !el || !el.dataset) return log('act_bad');
    const n = a.split(':')[0], arg = a.includes(':') ? a.split(':')[1] : el.dataset.v, id = el.dataset.id;
    if (ARG[n] && !ARG[n](arg)) return log('act_arg', { n });
    if (id !== undefined && id !== '' && !ID.test(id)) return log('act_id', { n });
    if (FLOOD.hit(n)) return;
    if (MUT.has(n)) { const k = n + (id || arg || ''), t = Date.now(); if (lastAct[k] && t - lastAct[k] < 600) return; lastAct[k] = t; }
    if (AUTH.has(n) && !authed()) return ask('acct');
    if (OWN.has(n) && !owns(id)) { log('not_owner', { n }); return toast(T('Not allowed.', 'غير مسموح.')); }
    if (n === 'publish' && !(cur().n === 'form' && !F.id)) return log('bad_state', { n });
    if (n === 'saveEdit' && !(cur().n === 'form' && F.id && owns(F.id))) return log('bad_state', { n });
    if (n === 'confirmPick' && !/^pick/.test(cur().n)) return log('bad_state', { n });
    if ((n === 'publish' || n === 'saveEdit') && Date.now() < cool) return toast(T('Too many invalid attempts. Please wait a moment.', 'محاولات غير صحيحة كثيرة. انتظر قليلاً.'));
    if (n === 'saveEdit') { const e = validate(true); if (Object.keys(e).length) { log('edit_invalid', { keys: Object.keys(e) }); Core.errs = e; render(true); return; } Core.errs = null; }
    if (n === 'saveProf') { const pr = state.prof; pr.name = fix(pr.name, RULES['P.name']).trim(); pr.bio = fix(pr.bio, RULES['P.bio']).trim(); pr.phone = fix(pr.phone, RULES['P.phone']).trim(); pr.email = fix(pr.email, RULES['P.email']).trim();
      if ((pr.phone && !V.phone(pr.phone)) || (pr.email && !V.email(pr.email))) { log('prof_invalid'); return toast(T('Phone must be 9 to 15 digits and the email must be valid.', 'الهاتف من 9 إلى 15 رقماً ويجب أن يكون البريد صحيحاً.')); } }
    if (n === 'rmPhoto') { const u = F.photos[+arg]; if (typeof u === 'string') setTimeout(() => releaseIfFree(u), 0); }
    if (n === 'saveEdit') {
      if (F.photos.some(isProc)) return toast(optimizing());
      if (storageReady() && F.photos.some(u => u.startsWith('blob:'))) return once('upload', async () => {
        const urls = await uploadSet([...F.photos]); if (!urls) return;
        if (typeof Core.adapter.saveProduct === 'function') { try { await call('saveProduct', Object.assign(productPayload(urls), { id: F.id })); } catch (e) { log('save_fail', {}, 'info'); return failDlg(T("Couldn't save the product", 'تعذّر حفظ المنتج')); } }
        F.photos.forEach(u => { if (u.startsWith('blob:')) release(u); }); F.photos = urls; closeOv(); act1(a, el);
      });
    }
    if (n === 'saveProf') {
      if (isProc(state.prof.photo)) return toast(optimizing());
      const hook = typeof Core.adapter.uploadAvatar === 'function' || typeof Core.adapter.saveProfile === 'function';
      if (hook) return once('avatar', async () => {
        try {
          const u = AVU && PH.get(AVU) === 'ready' && !UP.has(AVU) ? AVU : null; let url = /^https:\/\//.test(state.prof.photo || '') ? state.prof.photo : null;
          if (u && typeof Core.adapter.uploadAvatar === 'function') { const r = await call('uploadAvatar', FILES.get(u)); url = r && r.url; if (typeof url !== 'string' || !url.startsWith('https://') || !(url = okUrl(url))) throw new Error('bad_url'); UP.set(u, url); }
          if (typeof Core.adapter.saveProfile === 'function') { const pr = state.prof; await call('saveProfile', { name: pr.name, bio: pr.bio, phone: pr.phone, email: pr.email, photo: url }); }
          if (u && UP.has(u)) { state.prof.photo = UP.get(u); release(u); AVU = null; }
          act1(a, el);
        } catch (e) { log('profile_save_fail', { m: String(e && e.message).slice(0, 30) }, 'info'); toast(T('Upload failed. Check your connection and try again.', 'فشل الرفع. تحقق من اتصالك وحاول مرة أخرى.')); }
      });
    }
    return act1(a, el);
  } catch (e) { fail(e, 'act'); }
};

const newSeed = () => (Math.random() * 4294967296) >>> 0;
let feedSeed = newSeed();
const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const REG = {};
[['levant', 'SY LB JO PS IQ CY TR'], ['gulf', 'SA AE KW QA BH OM YE'], ['nafrica', 'EG LY SD TN DZ MA MR'], ['eafrica', 'DJ SO ER ET KE KM'], ['safrica', 'ZA NG AO'],
  ['europe', 'GB IE FR BE NL DE AT CH ES PT IT AD GR AL PL CZ HU RO BG UA EE FI SE NO DK RU'], ['westasia', 'AM AZ IR KZ'], ['southasia', 'AF PK BD IN'],
  ['seasia', 'ID MY PH SG TH VN'], ['easia', 'CN JP KR'], ['namerica', 'US CA MX'], ['samerica', 'BR AR'], ['oceania', 'AU NZ'], ['caribbean', 'AG']]
  .forEach(([r, l]) => l.split(' ').forEach(c => { REG[c] = r; }));
const ADJ = { levant: ['gulf', 'nafrica', 'westasia', 'europe'], gulf: ['levant', 'nafrica', 'eafrica', 'southasia', 'westasia'], nafrica: ['levant', 'gulf', 'eafrica', 'europe', 'safrica'],
  eafrica: ['gulf', 'nafrica', 'safrica'], safrica: ['nafrica', 'eafrica'], europe: ['levant', 'nafrica', 'westasia'], westasia: ['levant', 'gulf', 'southasia', 'europe'],
  southasia: ['gulf', 'westasia', 'seasia'], seasia: ['southasia', 'easia', 'oceania'], easia: ['seasia'], namerica: ['samerica', 'caribbean'], samerica: ['namerica', 'caribbean'], oceania: ['seasia'], caribbean: ['namerica', 'samerica'] };
const shuf = a => a.map(p => [h32(feedSeed + ':' + p.id), p]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
function feed(a) {
  const c = state.country, out = [];
  if (!c) {
    const g = {}; a.forEach(p => { (g[p.country] = g[p.country] || []).push(p); });
    const q = Object.keys(g).sort((x, y) => h32(feedSeed + x) - h32(feedSeed + y)).map(k => shuf(g[k]));
    while (q.some(x => x.length)) q.forEach(x => { if (x.length) out.push(x.shift()); });
    return out;
  }
  const reg = REG[c], adj = (reg && ADJ[reg]) || [];
  const own = shuf(a.filter(p => p.country === c)), rest = a.filter(p => p.country !== c);
  const near = shuf(rest.filter(p => REG[p.country] && (REG[p.country] === reg || adj.includes(REG[p.country])))), far = shuf(rest.filter(p => !near.includes(p)));
  const Q = { o: own, n: near, x: far }, order = ['o', 'n', 'x'], pat = ['o', 'o', 'n', 'o', 'x', 'o', 'n', 'x'];
  for (let i = 0; own.length + near.length + far.length; i++) { const k = [pat[i % pat.length], ...order].find(t0 => Q[t0].length); out.push(Q[k].shift()); }
  return out;
}
window.nearFirst = a => { const r = feed(a); r.__feed = true; return r; };
const sortList0 = window.sortList;
window.sortList = (a, mode) => { mode = mode === undefined ? state.sort : mode; return a && a.__feed && mode === 'newest' ? a : sortList0(a, mode); };

const acctU = SCREENS.acct;
SCREENS.acct = p => { const r = acctU(p), u = state.user; if (!u) return r; const pg = parse(r.html), el = pg && pg.querySelector('.uid'); if (!el) return r; el.textContent = 'UID: ' + u.uid; return { ...r, html: pg.outerHTML }; };

const SUPCATS = [['general', 'General', 'عام'], ['account', 'Account', 'الحساب'], ['product', 'A product', 'منتج'], ['problem', 'Report a problem', 'مشكلة'], ['other', 'Other', 'أخرى']];
const SUPR = { subject: { max: 80 }, message: { max: 1000, multi: 1 }, email: { max: 100, email: 1 } };
const SUP = { cat: 'general', subject: '', message: '', email: '', err: null, sending: false, last: 0 };
const supOpen = () => !!document.querySelector('[data-sup]');
function showSupport() {
  const e = SUP.err || {}, msg = m => `<div class="emsg">${ic('alert', 16, { w: 2 })}${m}</div>`;
  const f = (k, label, inner, m) => `<div class="fld ${e[k] ? 'bad' : ''}"><label>${label}</label>${inner}${e[k] ? msg(m) : ''}</div>`;
  openSheet(`${sheetHead(T('Contact support', 'تواصل مع الدعم'), T('We reply to your email', 'نرد على بريدك الإلكتروني'))}<div class="frm" style="margin-top:0">
    <div class="fld"><label>${T('Topic', 'الموضوع')}</label><div style="display:flex;flex-wrap:wrap;gap:8px">${SUPCATS.map(c => `<button class="chip sm ${SUP.cat === c[0] ? 'on' : ''}" data-a="supCat" data-v="${c[0]}">${state.lang === 'ar' ? c[2] : c[1]}</button>`).join('')}</div></div>
    ${f('subject', T('Subject', 'العنوان'), `<div class="inp"><input data-sup="subject" maxlength="80" placeholder="${esc(T('What is it about?', 'ما موضوع استفسارك؟'))}" value="${esc(SUP.subject)}"></div>`, T('Write at least 3 characters', 'اكتب 3 أحرف على الأقل'))}
    ${f('message', T('Your message', 'رسالتك'), `<div class="inp ta" style="min-height:130px"><textarea data-sup="message" rows="5" maxlength="1000" placeholder="${esc(T('Describe your question or problem', 'اشرح استفسارك أو مشكلتك'))}">${esc(SUP.message)}</textarea></div>`, T('Write at least 10 characters', 'اكتب 10 أحرف على الأقل'))}
    ${f('email', T('Reply email', 'البريد للرد'), `<div class="inp"><input data-sup="email" type="email" inputmode="email" dir="ltr" maxlength="100" placeholder="name@example.com" value="${esc(SUP.email)}"></div>`, T('Enter a valid email like name@example.com', 'أدخل بريداً صحيحاً مثل name@example.com'))}
    <button class="btn ${SUP.sending ? 'dis' : ''}" data-a="supportSend">${SUP.sending ? `<span class="cspin">${ic('refresh', 20, { w: 2, c: '#fff' })}</span>` : ''}${T('Send message', 'إرسال الرسالة')}</button></div>`);
}
function openSupport() {
  SUP.err = null; SUP.sending = false;
  if (!SUP.email) { const m = [state.contact.email, state.prof.email].find(v => v && V.email(v)); if (m) SUP.email = m; }
  showSupport();
}
function supportSend() {
  return once('support', async () => {
    const d = { subject: fix(SUP.subject, SUPR.subject).trim(), message: fix(SUP.message, SUPR.message).trim(), email: fix(SUP.email, SUPR.email).trim() }, e = {};
    if (d.subject.length < 3) e.subject = 1; if (d.message.length < 10) e.message = 1; if (!V.email(d.email)) e.email = 1;
    Object.assign(SUP, d); SUP.err = Object.keys(e).length ? e : null;
    if (SUP.err) return showSupport();
    if (!navigator.onLine) return toast(T('No internet connection', 'لا يوجد اتصال بالإنترنت'));
    if (Date.now() - SUP.last < 30000) return toast(T('Please wait a moment before sending another message.', 'انتظر قليلاً قبل إرسال رسالة أخرى.'));
    SUP.sending = true; showSupport();
    try {
      await call('support', { category: SUP.cat, subject: d.subject, message: d.message, email: d.email, lang: state.lang });
      SUP.last = Date.now(); SUP.subject = SUP.message = ''; SUP.sending = false;
      if (supOpen()) { closeOv(); dlg('check', 'var(--light)', 'var(--dark)', T('Message sent', 'تم إرسال رسالتك'), T('Thank you! Our support team will reply to your email as soon as possible.', 'شكراً لك! سيرد عليك فريق الدعم عبر بريدك الإلكتروني بأسرع وقت.'), '', btn2('closeov', T('Done', 'تم'))); }
      else toast(T('Message sent', 'تم إرسال رسالتك'));
    } catch (x) {
      SUP.sending = false; log('support_fail', {}, 'info');
      if (supOpen()) showSupport(); toast(T("Couldn't send your message. Check your connection and try again.", 'تعذّر إرسال رسالتك. تحقق من اتصالك وحاول مرة أخرى.'));
    }
  });
}
document.addEventListener('input', ev => {
  const el = ev.target, k = el && el.dataset && el.dataset.sup; if (!k || !SUPR[k]) return;
  const v = fix(el.value, SUPR[k]); if (v !== el.value) el.value = v; SUP[k] = v;
  const f = el.closest('.fld'); if (f) { f.classList.remove('bad'); const m = f.querySelector('.emsg'); if (m) m.remove(); } if (SUP.err) delete SUP.err[k];
}, true);
const helpU = SCREENS.help;
SCREENS.help = p => { const r = helpU(p), pg = parse(r.html), b = pg && pg.querySelector('.supp .bt'); if (!b) return r; b.setAttribute('data-a', 'supportOpen'); return { ...r, html: pg.outerHTML }; };

const sk = (h, w, r, mt) => `<i style="height:${h}px;${w ? 'width:' + w + ';' : ''}border-radius:${r}px;${mt ? 'margin-top:' + mt + 'px;' : ''}"></i>`;
const skGrid = () => `<div class="cskel"><div class="grid">${('<div>' + sk(140, '', 20) + sk(14, '70%', 7, 12) + sk(14, '40%', 7, 10) + '</div>').repeat(4)}</div></div>`;
const skRows = (n, c) => `<div class="cskel" style="margin-top:18px">${Array.from({ length: n || 6 }, () => `<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px"><i style="flex:none;width:${c || 44}px;height:${c || 44}px;border-radius:50%"></i><div style="flex:1">${sk(14, '60%', 7)}${sk(12, '85%', 6, 10)}</div></div>`).join('')}</div>`;
const skFields = n => `<div class="cskel frm">${Array.from({ length: n }, () => `<div>${sk(12, '30%', 6)}${sk(48, '', 16, 8)}</div>`).join('')}${sk(54, '', 27, 6)}</div>`;
const skDirs = () => `<div class="dirs cskel">${Array.from({ length: 4 }, () => sk(240, '', 28)).join('')}</div>`;
const skMine = () => `<div class="cskel">${Array.from({ length: 3 }, () => sk(112, '', 22, 10)).join('')}</div>`;
const skAcct = () => `<div class="cskel">${sk(96, '', 24, 16)}</div>${skRows(5, 40)}`;
const LOADSK = { explore: skDirs, dir: skGrid, favs: skGrid, favs2: skGrid, results: skGrid, mine: skMine, acct: skAcct, notifs: () => skRows(6), search: () => skRows(5, 36), eprof: () => skFields(4), form: () => skFields(5), contact: () => skFields(2) };
const PICKT = { pickCat: ['Choose a category', 'اختر التصنيف'], pickCountry: ['Choose a country', 'اختر الدولة'], pickGov: ['Choose a governorate', 'اختر المحافظة'], pickCur: ['Choose a currency', 'اختر العملة'] };
const HEADY = '.hdr,.title,.xhead,.sbar,.srchrow,.chips,.homehd';
const offHtml = () => empty('wifioff', T('No internet connection', 'لا يوجد اتصال بالإنترنت'), T('Check your network connection and try again.', 'تحقق من اتصالك بالشبكة ثم حاول مرة أخرى.'), `<button class="btn fit" data-a="retry">${ic('refresh', 20, { w: 2 })} ${T('Try again', 'إعادة المحاولة')}</button>`);
function stateScreen(k, p, o, off) {
  if (k === 'prod') {
    return { nav: null, html: off ? `<div class="pg"><div class="hdr">${backBtn()}</div>${offHtml()}</div>`
      : `<div class="pg" style="padding:0"><div class="hero cskel">${sk(300, '100%', 0).replace('height:300px', 'height:100%')}</div><button class="hbtn" style="inset-inline-start:16px" data-a="back">${ic('back', 20, { w: 2.2 })}</button><div class="pinfo cskel" style="padding-inline:var(--pad)">${sk(28, '60%', 14)}${sk(36, '45%', 18)}${sk(90, '', 20)}${sk(72, '', 22)}</div></div>` };
  }
  let r; try { r = o(p); } catch (e) { r = { nav: null, html: '<div class="pg"></div>' }; }
  const pg = parse(r.html); if (!pg) return r;
  const kids = [...pg.children]; let last = -1; kids.forEach((x, i) => { if (i === last + 1 && x.matches(HEADY)) last = i; });
  kids.slice(last + 1).forEach(x => x.remove());
  const head = PICKT[k] ? hdr(T(PICKT[k][0], PICKT[k][1])) : '';
  pg.insertAdjacentHTML('beforeend', head + (off ? offHtml() : (LOADSK[k] || (() => skRows(6)))()));
  return { nav: r.nav, html: pg.outerHTML };
}
const stateO = Object.assign({}, SCREENS);
Object.keys(stateO).forEach(k => {
  if (k === 'home') return;
  const o = stateO[k];
  SCREENS[k] = p => { if (Core.config.maintenance) return o(p); const off = !navigator.onLine, ld = Core.loading && k !== 'welcome'; return off || ld ? stateScreen(k, p, o, off) : o(p); };
});

const appEl = document.getElementById('app');
if (appEl) { harden(appEl); new MutationObserver(ms => ms.forEach(m => { if (m.type === 'childList') m.addedNodes.forEach(harden); else hardenOne(m.target); })).observe(appEl, { childList: true, subtree: true, attributes: true }); }
setInterval(() => { if (session && !sOK(session)) endSession('expired'); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && session && !sOK(session)) endSession('expired'); });
window.addEventListener('storage', ev => { if (ev.key === SK && session) { try { const d = JSON.parse(ev.newValue || 'null'); if (!d || !d.hint || d.hint.id !== session.id) endSession('other_tab'); } catch (e) { endSession('other_tab'); } } });
setInterval(() => { if (LOG.length > sent) { const b = LOG.slice(sent, sent + 20); sent += b.length; call('report', b).catch(() => {}); } }, 30000);

Object.defineProperty(window, 'MoisnarCore', { value: Object.freeze({
  configure(o) {
    if (configSet || session) { log('config_locked', {}, 'error'); return false; }
    if (!o || typeof o !== 'object') return false;
    if (typeof o.maintenance === 'boolean') Core.config.maintenance = o.maintenance; if (typeof o.requireLogin === 'boolean') Core.config.requireLogin = o.requireLogin; configSet = true; return true;
  },
  setAdapter(a) {
    if (adapterSet || session) { log('adapter_locked', {}, 'error'); return false; }
    if (!a || typeof a !== 'object') return false;
    Object.keys(Core.adapter).forEach(k => { if (typeof a[k] === 'function') Core.adapter[k] = a[k]; }); adapterSet = true; return true;
  },
  isPhone(v) { return typeof v === 'string' && v.length <= 24 && V.phone(v.trim()); },
  isEmail(v) { return typeof v === 'string' && v.length <= 100 && V.email(v.trim()); },
  getLog() { return LOG.map(x => Object.assign({}, x)); }
}), writable: false, configurable: false });

[typeof P !== 'undefined' && P, typeof I !== 'undefined' && I].forEach(o => { try { if (o) deepFreeze(o); } catch (e) {} });
window.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
})();
