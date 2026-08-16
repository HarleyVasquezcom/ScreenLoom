'use strict';

const BANNER_ID = 'sl-rec-banner';

function showBanner() {
  if (document.getElementById(BANNER_ID)) return;
  const b = document.createElement('div');
  b.id = BANNER_ID;
  b.setAttribute('data-sl-banner', '');
  b.textContent = '\u25CF REC \u2014 ScreenLoom is recording';
  const s = b.style;
  s.position = 'fixed';
  s.right = '14px';
  s.bottom = '14px';
  s.zIndex = '2147483647';
  s.background = '#14161a';
  s.color = '#ff4949';
  s.font = '600 12px/1.4 Consolas, "Courier New", monospace';
  s.letterSpacing = '1px';
  s.padding = '7px 12px';
  s.borderRadius = '4px';
  s.boxShadow = '0 3px 10px rgba(0,0,0,.5)';
  s.pointerEvents = 'none';
  (document.body || document.documentElement).appendChild(b);
}

function hideBanner() {
  const b = document.getElementById(BANNER_ID);
  if (b) b.remove();
}

chrome.storage.local.get(['sl:on'], (s) => {
  if (s['sl:on']) showBanner();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes['sl:on']) return;
  if (changes['sl:on'].newValue) showBanner();
  else hideBanner();
});