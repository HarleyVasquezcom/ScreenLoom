'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['sl:on', 'sl:recordings'], (s) => {
    const set = {};
    if (typeof s['sl:on'] !== 'boolean') set['sl:on'] = false;
    if (!Array.isArray(s['sl:recordings'])) set['sl:recordings'] = [];
    if (Object.keys(set).length) chrome.storage.local.set(set);
  });
});