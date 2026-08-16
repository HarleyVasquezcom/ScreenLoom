# ScreenLoom

**Studio recorder for the browser.** Record a tab, a window or the whole screen from the popup (`getDisplayMedia` + `MediaRecorder`), with a red **REC beacon** injected on every page while the tape rolls and a stopwatch in the popup. Each stop saves a **clip card** (real thumbnail, mime type, date, duration); the `.webm` downloads locally and the card metadata persists.

Landing page: `https://screenloom-xxxx.vercel.app` (placeholder, replaced at deploy time)
Extension ZIP: `screenloom.zip` (dist) — also downloadable from the landing.

---

## What it does

- **Record toggle** (`sl:on`): while ON, each page shows a small red `● REC — ScreenLoom is recording` pill (`content.js` listens to `storage.onChanged`), removed the moment recording stops.
- **Real capture pipeline**: the popup page requests a display stream via `navigator.mediaDevices.getDisplayMedia({ video: true })` and records it with `MediaRecorder` (preferred mime `video/webm;codecs=vp8`). The stopwatch and the red REC state are driven by a real `canvas.captureStream` in the hermetic probe so the *entire* pipeline (stream lifecycle → MediaRecorder → blob → thumbnail → card → purge of tracks) is exercised end to end; only the OS display-picker interaction itself cannot run headless — documented honestly in this README and in the generator state.
- **Clip cards** (`sl:recordings`): each clip stores `{id, name, ts, durMs, mimeType, thumb}` (thumb is a real 96×60 PNG frame from the recording — for canvas streams drawn directly, for real captures rasterized from the first decoded video frame). The `.webm` blob itself is kept in popup session memory for download; card metadata persists in `chrome.storage.local`.
- **Every stop purges the stream**: all tracks are `stop()`ped and the internal stream registry is emptied (probe asserts `activeStreams === 0` after stop).
- **Clear clips** (`sl:clear`): empties the list and the session blobs.
- One permission: `storage` (content scripts run on `http/https`; no `<all_urls>`).

## Honest limits

- Real display capture needs a human to click the OS share picker — that click is **not** verifiable headless; the probe covers everything after the picker (and uses a canvas stream as stand-in through the identical code path).
- The `.webm` bytes live in popup memory (session download); only metadata + thumbnail persist across popup restarts.
- Audio tracks are not recorded (video-only, honest default).

## Probe

```bash
npm install && npm run probe
```

Hermetic Puppeteer suite (local fixture page + local server): baseline without extension, REC beacon appears/vanishes with the toggle on the fixture, default keyspace (`sl:on` false, `sl:recordings` empty), popup renders with no JS errors, permission surface minimal (`storage` only, `http/https`, no `<all_urls>`), static recorder surface (`MediaRecorder` present, `video/webm` supported), a **real canvas-stream recording** through the exact production pipeline (stopwatch advances, stop produces a clip card with `data:image/png` thumbnail and `video/webm` mime, tracks purged, second recording repeatable), cards persist across popup reload, clear empties, frozen keyspace (`sl:*` only), i18n in 6 languages (including a per-language refusal/state string), credit localized, packaging byte-identity and — with `SCREENLOOM_DEPLOY_URL` set — the deployed landing + ZIP checks.

## Layout

```
manifest.json   MV3, one permission (storage), no <all_urls>
background.js   onInstalled: seed sl:on / sl:recordings defaults
content.js      REC beacon pill (sl:on listener)
i18n.js         popup dictionary, 6 languages
popup.html/css/js  studio popup: toggle, stopwatch, clip cards, download, clear, lang
landing/        landing page (6 languages, zip download CTA)
tests/probe.mjs hermetic end-to-end probe
tools/zip.mjs   reproducible ZIP (fixed timestamps) via archiver
tools/gen-icons.mjs  PNG icon generator (crc32 + zlib, no native deps)
```

Privacy: everything lives in `chrome.storage.local`; the recording bytes never leave your machine.

---

## ES — Resumen

**ScreenLoom: grabador de estudio en el navegador.** Graba pestaña, ventana o pantalla desde el popup (`getDisplayMedia` + `MediaRecorder`), con un **faro REC rojo** en cada página mientras la cinta corre y un cronómetro en el popup. Al detener se guarda una **ficha de clip** (miniatura real, tipo mime, fecha, duración); el `.webm` se descarga localmente y los metadatos persisten. Permiso único justificado: `storage` (content scripts en `http/https`, sin `<all_urls>`). Cada parada purga el stream (tracks detenidos — la sonda lo verifica). Límites honestos: el selector de pantalla del sistema requiere un humano y no es verificable headless (la sonda recorre un `canvas.captureStream` por la MISMA ruta de código); los bytes `.webm` viven en la memoria del popup esta sesión (descarga), solo metadatos + miniatura persisten; sin pista de audio (solo vídeo). La sonda hermética cubre: faro REC, gravación real de canvas por el pipeline de producción, cronómetro, fichas, purga, persistencia, clear, i18n en 6 idiomas, empaquetado byte-idéntico y — con `SCREENLOOM_DEPLOY_URL` — el landing desplegado. Instalación: ZIP → `chrome://extensions` → *Load unpacked*.

*Built by [Harley Vásquez](https://www.linkedin.com/in/harleyvasquez/).*