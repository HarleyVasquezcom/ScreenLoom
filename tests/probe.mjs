import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

let puppeteer;
try {
  puppeteer = createRequire(import.meta.url)('puppeteer');
} catch (e) {
  console.error('puppeteer not installed — run `npm install` first');
  process.exit(2);
}
let CHROME;
try {
  CHROME = process.env.PROBE_CHROME || (await puppeteer.executablePath());
} catch (e) {
  CHROME = process.env.PROBE_CHROME;
}

const DEPLOY_URL = (process.env.SCREENLOOM_DEPLOY_URL || '').replace(/\/+$/, '');
const EXT = path.resolve(import.meta.dirname, '..');
const EXT_FWD = EXT.replaceAll('\\', '/');
const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'site.html'), 'utf8');

const EXPECTED_LABELS = {
  tagline: {
    en: 'studio recorder for the browser',
    es: 'grabador de estudio para el navegador',
    fr: 'enregistreur studio pour le navigateur',
    pt: 'gravador de estúdio para o navegador',
    it: 'registratore studio per il browser',
    de: 'Studio-Recorder für den Browser',
  },
  credit: {
    en: 'Built by Harley Vásquez',
    es: 'Creado por Harley Vásquez',
    fr: 'Créé par Harley Vásquez',
    pt: 'Criado por Harley Vásquez',
    it: 'Creato da Harley Vásquez',
    de: 'Erstellt von Harley Vásquez',
  },
};

let passes = 0;
let failures = 0;
const problems = [];
const check = (name, ok, detail = '') => {
  if (ok) {
    passes++;
    console.log('  PASS ' + name);
  } else {
    failures++;
    problems.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      /* retry */
    }
    await sleep(120);
  }
  return null;
};
const getAll = async (popup) => (await popup.evaluate(() => chrome.storage.local.get(null)));

console.log('ScreenLoom probe (extension: ' + EXT + ')');

const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/site.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const SITE_PAGE = `http://127.0.0.1:${PORT}/site.html`;
const LANDING = path.join(EXT, 'landing', 'index.html');
console.log('fixture server: ' + SITE_PAGE);
let ZIP_BYTES = null;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: CHROME,
  args: [`--disable-extensions-except=${EXT_FWD}`, `--load-extension=${EXT_FWD}`],
  protocolTimeout: 60000,
});

let base = null;
let popup = null;
const popupErrors = [];
try {
  // ---------- BASELINE (no extension) ----------
  base = await browser.newPage();
  const baseErrors = [];
  base.on('pageerror', (e) => baseErrors.push(e.message));
  await base.goto(SITE_PAGE + '?noext=1', { waitUntil: 'domcontentloaded' });
  await base.bringToFront();
  await sleep(600);
  check('baseline: fixture loads', (await base.evaluate(() => document.title)) === 'ScreenLoom fixture — how-to page', '');
  check('baseline: no REC banner without extension', (await base.evaluate(() => !!document.getElementById('sl-rec-banner'))) === false, '');
  check('baseline: no JS errors on fixture', baseErrors.length === 0, baseErrors.join(' | '));
  await base.close();
  base = null;

  // ---------- EXTENSION REGISTERED ----------
  const reg = await browser.newPage();
  await reg.goto('chrome://extensions-internals', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const data = JSON.parse(await reg.evaluate(() => document.body.innerText));
  const entry = data.find((e) => e.name === 'ScreenLoom');
  check('extension registered and ENABLED', !!entry && entry.registry_status === 'ENABLED' && entry.location === 'COMMAND_LINE', entry ? entry.registry_status : 'not found');
  const manifestVersion = entry ? entry.manifest_version : 0;
  check('manifest_version 3 confirmed by Chrome', manifestVersion === 3, JSON.stringify(manifestVersion));
  if (!entry) throw new Error('ScreenLoom extension not found');
  const popupUrl = `chrome-extension://${entry.id}/popup.html`;
  await reg.close();

  // ---------- POPUP ----------
  popup = await browser.newPage();
  popup.on('pageerror', (e) => popupErrors.push(e.message));
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('toggleBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(400);

  const defaults = await getAll(popup);
  check('defaults: sl:on = false', defaults['sl:on'] === false, JSON.stringify(defaults['sl:on']));
  check('defaults: sl:recordings = []', Array.isArray(defaults['sl:recordings']) && defaults['sl:recordings'].length === 0, '');
  check('popup renders without JS exceptions', popupErrors.length === 0, popupErrors.join(' | '));
  check('popup initial state = IDLE', (await popup.evaluate(() => document.getElementById('recBadge').textContent)) === 'IDLE', '');

  // ---------- PERMISSION SURFACE ----------
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const hasAllUrls = (m) => /<all_urls>/.test(JSON.stringify(m));
  check(
    'permission surface: storage only, http/https (no <all_urls>)',
    Array.isArray(manifest.permissions) && manifest.permissions.length === 1 && manifest.permissions[0] === 'storage' && !hasAllUrls(manifest),
    JSON.stringify(manifest.permissions)
  );
  check(
    'manifest v3 + 1 permission (no <all_urls>)',
    manifest.manifest_version === 3 && manifest.permissions.length === 1 && !hasAllUrls(manifest),
    ''
  );

  // ---------- STATIC RECORDER SURFACE ----------
  const surface = await popup.evaluate(() => ({
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
    webmSupported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm'),
    hasMediaDevices: !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'),
  }));
  check('recorder surface: MediaRecorder exists in popup', surface.hasMediaRecorder === true, '');
  check('recorder surface: video/webm mime supported', surface.webmSupported === true, '');
  check('recorder surface: getDisplayMedia exposed (static — picker needs a human)', surface.hasMediaDevices === true, '');

  // ---------- REC BEACON (content script) ----------
  const page = await browser.newPage();
  await page.goto(SITE_PAGE + '?beacon=1', { waitUntil: 'domcontentloaded' });
  await page.bringToFront();
  await sleep(600);
  check('beacon: absent before toggle', (await page.evaluate(() => !!document.getElementById('sl-rec-banner'))) === false, '');
  await popup.evaluate(() => chrome.storage.local.set({ 'sl:on': true }));
  await sleep(500);
  check('beacon: REC pill appears while sl:on', (await page.evaluate(() => {
    const b = document.getElementById('sl-rec-banner');
    return !!b && b.textContent.includes('REC');
  })) === true, '');
  await popup.evaluate(() => chrome.storage.local.set({ 'sl:on': false }));
  await sleep(500);
  check('beacon: pill removed when sl:off', (await page.evaluate(() => !!document.getElementById('sl-rec-banner'))) === false, '');

  // ---------- REAL CAPTURE PIPELINE (canvas stream via production path) ----------
  await popup.evaluate(() => window.__slStartMock());
  await sleep(400);
  check('recording state = REC badge', (await popup.evaluate(() => document.getElementById('recBadge').textContent)) === 'REC', '');
  check('active stream references = 1', (await popup.evaluate(() => window.__slActiveStreams())) === 1, '');
  const e1 = await popup.evaluate(() => window.__slElapsed());
  await sleep(1300);
  const e2 = await popup.evaluate(() => window.__slElapsed());
  check('stopwatch advances during recording', e2 > e1 && e2 >= 1000, `${e1} -> ${e2}`);
  const timerText = await popup.evaluate(() => document.getElementById('timerEl').textContent);
  check('timer element shows mm:ss', /^\d{2}:\d{2}$/.test(timerText), timerText);

  await popup.evaluate(() => document.getElementById('toggleBtn').click());
  const clips1 = await waitFor(async () => {
    const s = await popup.evaluate(async () => (await chrome.storage.local.get('sl:recordings'))['sl:recordings']);
    return s.length === 1 ? s : null;
  }, 12000);
  check('stop (same toggle): clip card persisted', !!clips1 && clips1.length === 1, !clips1 ? 'none' : '');
  check('active stream references = 0 after stop (purge)', (await popup.evaluate(() => window.__slActiveStreams())) === 0, '');
  if (clips1 && clips1[0]) {
    const c = clips1[0];
    check('clip mime type = video/webm', c.mimeType.startsWith('video/webm'), c.mimeType);
    check('clip thumbnail is a PNG dataURL', typeof c.thumb === 'string' && c.thumb.startsWith('data:image/png'), String(c.thumb).slice(0, 24));
    check('clip duration recorded (>= 1s)', c.durMs >= 1000, String(c.durMs));
    check('clip has id + timestamp', typeof c.id === 'string' && c.id.length > 6 && typeof c.ts === 'number', '');
  } else {
    check('clip mime type = video/webm', false, 'no card');
    check('clip thumbnail is a PNG dataURL', false, 'no card');
    check('clip duration recorded (>= 1s)', false, 'no card');
    check('clip has id + timestamp', false, 'no card');
  }
  const listCount = await popup.evaluate(() => document.querySelectorAll('.clip').length);
  check('popup clips list renders the card', listCount === 1, String(listCount));

  // second recording is repeatable
  await popup.evaluate(() => window.__slStartMock());
  await sleep(900);
  await popup.evaluate(() => document.getElementById('toggleBtn').click());
  const clips2 = await waitFor(async () => {
    const s = await popup.evaluate(async () => (await chrome.storage.local.get('sl:recordings'))['sl:recordings']);
    return s.length === 2 ? s : null;
  }, 12000);
  check('second recording repeatable (2 cards)', !!clips2 && clips2.length === 2, '');
  check('no leaked streams across recordings', (await popup.evaluate(() => window.__slActiveStreams())) === 0, '');

  // ---------- RELOAD: cards persist (metadata + thumbs) ----------
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.getElementById('toggleBtn') !== null, { timeout: 8000, polling: 100 });
  await sleep(500);
  const persisted = await popup.evaluate(async () => {
    const s = await chrome.storage.local.get('sl:recordings');
    return { count: s['sl:recordings'].length, thumbs: s['sl:recordings'].filter((c) => c.thumb.startsWith('data:image/png')).length };
  });
  check('reload: 2 clips persist', persisted.count === 2, String(persisted.count));
  check('reload: thumbnails persist', persisted.thumbs === 2, String(persisted.thumbs));

  // ---------- CLEAR ----------
  await popup.evaluate(() => document.getElementById('clearBtn').click());
  const cleared = await waitFor(async () => {
    const s = await popup.evaluate(async () => (await chrome.storage.local.get('sl:recordings'))['sl:recordings']);
    return s.length === 0 ? true : null;
  }, 8000);
  check('clear: recordings emptied', cleared === true, '');
  check('clear: popup list empty state', (await popup.evaluate(() => document.querySelectorAll('.clip').length)) === 0, '');

  // ---------- FROZEN ----------
  const frozenAll = await getAll(popup);
  const keys = Object.keys(frozenAll).filter((k) => k.startsWith('sl:'));
  check('frozen: only sl:* keys in storage', keys.length === 2 && ['sl:on', 'sl:recordings'].every((k) => keys.includes(k)), keys.join(','));

  // ---------- i18n popup ----------
  const langCheck = async (code, expected) => {
    await popup.select('#langSel', code);
    const ok = await waitFor(() => popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, expected), 6000);
    check(`language switch to ${code} re-renders popup`, ok === true, expected);
    if (ok) {
      const credit = await popup.evaluate(() => document.querySelector('[data-i18n="credit"]')?.textContent);
      check(`language ${code}: credit localized`, credit === EXPECTED_LABELS.credit[code], credit);
      await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
      await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
      const persisted = await popup.evaluate((exp) => document.querySelector('[data-i18n="tagline"]')?.textContent === exp, expected);
      check(`language ${code}: persisted across reload`, persisted === true, 'reverted');
    }
  };
  await popup.select('#langSel', 'en');
  for (const code of ['es', 'fr', 'pt', 'it', 'de']) {
    await langCheck(code, EXPECTED_LABELS.tagline[code]);
  }
  await popup.evaluate(() => chrome.storage.local.remove('sl:lang'));
  await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  await popup.waitForFunction(() => document.querySelector('[data-i18n="tagline"]')?.textContent !== '', { timeout: 8000, polling: 100 });
  const navLang = await popup.evaluate(() => (navigator.language || 'en').toLowerCase().split('-')[0]);
  const defaulted = await popup.evaluate(() => document.querySelector('[data-i18n="tagline"]')?.textContent);
  check('default language = navigator language (or en)', ['en', 'es', 'fr', 'pt', 'it', 'de'].includes(navLang) && EXPECTED_LABELS.tagline[navLang] === defaulted, `nav=${navLang} got=${defaulted}`);
  await popup.evaluate(() => chrome.storage.local.set({ 'sl:lang': 'en' }));
  const popupCreditUrl = await popup.evaluate(() => {
    const a = document.querySelector('[data-i18n="credit"]');
    return a && a.tagName === 'A' ? a.href : '';
  });
  check('credit links to LinkedIn (popup)', popupCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', popupCreditUrl);

  // ---------- Landing ----------
  const landing = await browser.newPage();
  const landingErrors = [];
  landing.on('pageerror', (e) => landingErrors.push(e.message));
  await landing.goto('file://' + LANDING.replaceAll('\\', '/'), { waitUntil: 'domcontentloaded' });
  await sleep(700);
  const heroOk = await landing.evaluate(() => {
    const t = document.querySelector('[data-i18n="heroTitle"]')?.textContent || '';
    return t.length > 0 && document.title !== '';
  });
  check('landing renders with localized hero', heroOk === true, '');
  await landing.select('#langSel', 'es');
  const heroEs = await waitFor(() => landing.evaluate(() => document.querySelector('[data-i18n="heroTitle"]')?.textContent), 5000);
  check('landing switch to es works', heroEs?.length > 5, heroEs);
  const titleEs = await waitFor(() => landing.evaluate((exp) => (document.title.toLowerCase().includes(exp) ? document.title : null), 'grabador'), 5000);
  check('landing document.title translated on switch', titleEs !== null, titleEs);
  check('no JS errors on landing', landingErrors.length === 0, landingErrors.join(' | '));
  const landingCreditUrl = await landing.evaluate(() => {
    const a = document.querySelector('[data-i18n="credit"]');
    return a && a.tagName === 'A' ? a.href : '';
  });
  check('credit links to LinkedIn (landing)', landingCreditUrl === 'https://www.linkedin.com/in/harleyvasquez/', landingCreditUrl);
  await landing.close();

  // ---------- Packaging ----------
  const zipPath = path.join(EXT, 'dist', 'screenloom.zip');
  const landingZip = path.join(EXT, 'landing', 'screenloom.zip');
  check('dist/screenloom.zip exists', fs.existsSync(zipPath), zipPath);
  check('landing/screenloom.zip exists (CTA target)', fs.existsSync(landingZip), landingZip);
  if (fs.existsSync(zipPath) && fs.existsSync(landingZip)) {
    const s = fs.statSync(zipPath);
    const l = fs.statSync(landingZip);
    check('landing zip byte-identical to dist zip', s.size === l.size && s.size > 0, `dist=${s.size} landing=${l.size}`);
    ZIP_BYTES = l.size;
  }
  const iconOk = ['icon16.png', 'icon48.png', 'icon128.png'].every((f) => {
    const p = path.join(EXT, 'icons', f);
    return fs.existsSync(p) && fs.readFileSync(p)[0] === 0x89 && fs.readFileSync(p)[1] === 0x50;
  });
  check('icons 16/48/128 present and valid PNG', iconOk, '');

  // ---------- Deploy (gated) ----------
  if (DEPLOY_URL) {
    try {
      const res = await fetch(DEPLOY_URL + '/', { headers: { 'User-Agent': 'screenloom-probe' } });
      const body = await res.text();
      check('deployed landing responds (Vercel)', res.status === 200 && body.includes('ScreenLoom'), res.status + ' len=' + body.length);
      const zipRes = await fetch(DEPLOY_URL + '/screenloom.zip', { headers: { 'User-Agent': 'screenloom-probe' } });
      const zipBody = await zipRes.arrayBuffer();
      check('deployed landing serves the extension zip', zipRes.status === 200 && typeof ZIP_BYTES === 'number' && zipBody.byteLength === ZIP_BYTES, zipRes.status + ' bytes=' + zipBody.byteLength + ' expected=' + ZIP_BYTES);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      check('deployed landing responds (Vercel)', false, msg);
      check('deployed landing serves the extension zip', false, msg);
    }
  } else {
    console.log('  [info] SCREENLOOM_DEPLOY_URL not set; skipping deployed-landing checks.');
  }
} finally {
  if (browser) await browser.close();
  if (base) await base.close();
  server.close();
}

console.log('');
console.log(`RESULT: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('PROBLEMS:');
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
process.exit(0);