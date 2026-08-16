'use strict';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let recordings = [];
let recording = false;
let startTs = 0;
let timerId = null;
let recorder = null;
let chunks = [];
let streamRefs = new Set();
const sessionBlobs = new Map();

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function syncLed() {
  const badge = $('recBadge');
  const btn = $('toggleBtn');
  const timer = $('timerEl');
  badge.classList.toggle('on', recording);
  badge.textContent = recording ? i18n.t('recOn') : i18n.t('recOff');
  btn.classList.toggle('rec', recording);
  btn.textContent = i18n.t('toggle');
  timer.classList.toggle('rec', recording);
  flushTimer(true);
}

function flushTimer(force) {
  const el = $('timerEl');
  if (recording) el.textContent = fmtDur(Date.now() - startTs);
  else if (force) el.textContent = '00:00';
}

function thumbFromCanvas(canvas) {
  try {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 60;
    c.getContext('2d').drawImage(canvas, 0, 0, 96, 60);
    return c.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}

function thumbFromVideoBlob(blob) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.muted = true;
      v.src = url;
      const done = (val) => {
        URL.revokeObjectURL(url);
        clearTimeout(failT);
        resolve(val);
      };
      const failT = setTimeout(() => done(''), 3500);
      v.onloadeddata = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 96;
          c.height = 60;
          c.getContext('2d').drawImage(v, 0, 0, 96, 60);
          done(c.toDataURL('image/png'));
        } catch (e) {
          done('');
        }
      };
      v.onerror = () => done('');
    } catch (e) {
      resolve('');
    }
  });
}

function purgeStream(stream) {
  for (const t of stream.getTracks()) t.stop();
  streamRefs.delete(stream);
}

async function finalizeRecording(blob, thumbSource) {
  if (!blob || !blob.size) return;
  const durMs = Math.max(0, Date.now() - startTs);
  const mimeType = blob.type || pickMime() || 'video/webm';
  let thumb = '';
  if (thumbSource && thumbSource.tagName === 'CANVAS') thumb = thumbFromCanvas(thumbSource);
  else thumb = await thumbFromVideoBlob(blob);
  const id = 'sl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const card = {
    id,
    name: 'clip ' + (recordings.length + 1),
    ts: Date.now(),
    durMs,
    mimeType,
    thumb,
  };
  recordings.unshift(card);
  sessionBlobs.set(id, blob);
  await new Promise((res) => chrome.storage.local.set({ 'sl:recordings': recordings }, res));
  await refresh();
  setStatus(i18n.t('exportOk'));
}

async function begin(stream, thumbSource) {
  const mime = pickMime();
  chunks = [];
  streamRefs.add(stream);
  recording = true;
  startTs = Date.now();
  syncLed();
  $('statusMsg').textContent = i18n.t('statusOn');
  if (mime) {
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } else {
    recorder = new MediaRecorder(stream);
  }
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder && recorder.mimeType ? recorder.mimeType : 'video/webm' });
    finalizeRecording(blob, thumbSource);
  };
  recorder.start(500);
  if (timerId) clearInterval(timerId);
  timerId = setInterval(flushTimer, 500);
}

function stop() {
  recording = false;
  syncLed();
  $('statusMsg').textContent = i18n.t('statusOff');
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (recorder && recorder.state !== 'inactive') {
    try {
      recorder.stop();
    } catch (e) {
      /* noop */
    }
  }
  for (const s of Array.from(streamRefs)) purgeStream(s);
}

async function startRealCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    chrome.storage.local.set({ 'sl:on': false });
    setStatus(i18n.t('captureFail'));
    return;
  }
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    await begin(stream, null);
  } catch (e) {
    if (stream) purgeStream(stream);
    await chrome.storage.local.set({ 'sl:on': false });
    await sleep(50);
    syncLed();
    $('statusMsg').textContent = i18n.t('captureFail');
  }
}

window.__slStartMock = () => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 100;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#262a30';
  ctx.fillRect(0, 0, 160, 100);
  ctx.fillStyle = '#ffb31a';
  ctx.fillRect(10, 10, 40, 40);
  ctx.fillStyle = '#ff4949';
  ctx.fillRect(60, 50, 30, 30);
  ctx.fillStyle = '#eceef1';
  ctx.fillRect(100, 20, 40, 20);
  const stream = c.captureStream(10);
  begin(stream, c);
  return true;
};
window.__slActiveStreams = () => streamRefs.size;
window.__slRecording = () => recording;
window.__slElapsed = () => (recording ? Date.now() - startTs : 0);

$('toggleBtn').addEventListener('click', async () => {
  if (!recording) {
    await chrome.storage.local.set({ 'sl:on': true });
    await syncLed();
    await startRealCapture();
  } else {
    await chrome.storage.local.set({ 'sl:on': false });
    stop();
  }
});

$('clearBtn').addEventListener('click', async () => {
  stop();
  sessionBlobs.clear();
  recordings = [];
  await new Promise((res) => chrome.storage.local.set({ 'sl:recordings': recordings }, res));
  await refresh();
  setStatus(i18n.t('clearOk'));
});

function setStatus(text) {
  $('statusMsg').textContent = text;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const list = $('clipList');
  $('clipCount').textContent = recordings.length;
  if (!recordings.length) {
    list.innerHTML = '<li class="empty"></li>';
    list.querySelector('.empty').textContent = i18n.t('emptyClips');
    return;
  }
  list.innerHTML = '';
  for (const card of recordings) {
    const li = document.createElement('li');
    li.className = 'clip';
    li.dataset.cid = card.id;
    li.innerHTML =
      (card.thumb
        ? '<img class="thumb" src="' + card.thumb + '" alt="">'
        : '<img class="thumb" src="" alt="" style="opacity:.15">') +
      '<div class="meta"><div class="cname">' + esc(card.name) + '</div>' +
      '<div class="csub">' + esc(card.mimeType) + ' Â· ' + new Date(card.ts).toLocaleTimeString() + '</div>' +
      '<div class="cdur">' + fmtDur(card.durMs) + '</div></div>' +
      '<button class="dltn" type="button">' + i18n.t('downloads').split(' ')[0] + 'webm</button>';
    li.querySelector('.dltn').addEventListener('click', () => {
      const blob = sessionBlobs.get(card.id);
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = card.name + '-' + card.id + '.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    });
    list.appendChild(li);
  }
}

async function refresh() {
  const s = await new Promise((res) => chrome.storage.local.get('sl:recordings', res));
  recordings = Array.isArray(s['sl:recordings']) ? s['sl:recordings'] : [];
  render();
}

async function init() {
  const lang = await i18n.getLang();
  i18n.current = lang;
  $('langSel').value = lang;
  i18n.apply(document);
  await refresh();
  const s = await new Promise((res) => chrome.storage.local.get('sl:on', res));
  if (s['sl:on']) startRealCapture();
  syncLed();
}

$('langSel').addEventListener('change', async (e) => {
  i18n.current = e.target.value;
  await new Promise((res) => chrome.storage.local.set({ 'sl:lang': e.target.value }, res));
  i18n.apply(document);
  syncLed();
  render();
});

init();