#!/usr/bin/env node
/**
 * Renders each harness page in headless Chrome and prints its layout audit + a screenshot.
 *
 *   npx vite --config vite.harness.config.ts &     # must be running on :5183
 *   node scripts/harness-audit.mjs                 # all pages, light, en
 *   node scripts/harness-audit.mjs --theme=dark --lng=no --pages=profile,tasks
 *
 * Talks to Chrome over the DevTools Protocol directly. That is deliberate: this repo has no browser
 * driver and shouldn't grow one for a lint, Chrome 151 hangs on `--dump-dom`, and Node 22 ships a
 * global WebSocket — so CDP over a raw socket is the dependency-free option that actually works.
 *
 * The audit itself lives in src/harness/audit.ts and runs in the page; this only drives it.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  }),
);

const THEME = args.theme ?? 'light';
const LNG = args.lng ?? 'en';
const WIDTH = Number(args.width ?? 390);
const PAGES = (args.pages ?? 'dashboard,tasks,calendar,chat,thread,economy,pant,social,profile,game,login,create').split(',');
// Overlay surfaces are mounted over a page via ?overlay=. Keep this list in sync with
// src/harness/overlays.tsx — anything missing here is a surface nobody is measuring.
const OVERLAYS = (args.overlays === '1'
  ? 'sheet-bottom,sheet-center,sheet-lg-center,paywall,vibe,emoji,tour,meeting-menu,game-screen,game-prompt,game-liars-dice,game-spin,game-player-setup,game-dice,game-deck'
  : (args.overlays ?? '')).split(',').filter(Boolean);
const PORT = 9200 + Math.floor(Math.random() * 700);
const OUT = '.harness-shots';

const CHROME = [
  '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => existsSync(p));

if (!CHROME) { console.error('No Chrome found.'); process.exit(1); }

if (!Number.isFinite(WIDTH) || WIDTH < 200 || WIDTH > 2000) {
  console.error(`Bad --width=${args.width}. Expected a number between 200 and 2000.`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const userDir = join(tmpdir(), `kollekt-harness-${Date.now()}`);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  `--window-size=${WIDTH},1400`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('Chrome did not expose a debugging endpoint');
}

/**
 * The tab Chrome opened at launch, which is the only one sized by --window-size.
 *
 * Targets created later via Target.createTarget get Chrome's default ~980px window regardless of
 * the width/height params or the spawn flag, and Emulation.setDeviceMetricsOverride does not
 * correct the layout viewport either. Reusing the initial tab is what actually gives us a phone-
 * width viewport — and therefore correct `position: fixed` layout and correct `sm:` media queries.
 */
async function initialTarget() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('Chrome exposed no initial page target');
  return page.id;
}

/** Minimal CDP client: send(method, params) -> result, over one socket. */
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result);
  };
  return {
    ready,
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params, sessionId }));
      }),
    close: () => ws.close(),
  };
}

function report(page, d) {
  const lines = [];
  if (d.smallTargets?.length) {
    lines.push(`  ${d.smallTargets.length} sub-44px targets:`);
    for (const t of d.smallTargets.slice(0, 10)) lines.push(`    ${t.w}x${t.h}  ${t.label}`);
  }
  if (d.overlappingTight?.length) {
    lines.push(`  ${d.overlappingTight.length} overlapping tight targets:`);
    for (const t of d.overlappingTight.slice(0, 6)) lines.push(`    gap ${t.gap}px  ${t.a} | ${t.b}`);
  }
  if (d.tinyText?.length) {
    lines.push(`  ${d.tinyText.length} interactive labels under 10.5px:`);
    for (const t of d.tinyText.slice(0, 8)) lines.push(`    ${t.px}px  ${t.text}`);
  }
  if (d.overflowing?.length) {
    lines.push(`  ${d.overflowing.length} elements overflowing their container:`);
    for (const t of d.overflowing.slice(0, 8)) lines.push(`    by ${t.by}px  "${t.label}" inside ${t.within}`);
  }
  if (d.gutters?.length > 1) lines.push(`  mixed left gutters: ${d.gutters.join(', ')}`);
  console.log(`### ${page}`);
  console.log(lines.length ? lines.join('\n') : '  clean');
  return lines.length === 0;
}

let allClean = true;
let fatal = 0;
try {
  const client = connect(await endpoint());
  await client.ready;

  // One long-lived session on the launch tab, reused for every page.
  const targetId = await initialTarget();
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  await client.send('Page.enable', {}, sessionId);
  // Needs harness.html's viewport meta to be honoured; without it Chrome ignores this width and
  // lays out at its legacy 980px fallback. The assertion below is what proves it took.
  await client.send('Emulation.setDeviceMetricsOverride',
    { width: WIDTH, height: 1400, deviceScaleFactor: 2, mobile: true }, sessionId);

  const RUNS = OVERLAYS.length
    ? OVERLAYS.map((o) => ({ label: `overlay:${o}`, query: `page=dashboard&overlay=${o}` }))
    : PAGES.map((p) => ({ label: p, query: `page=${p}` }));

  for (const { label: page, query } of RUNS) {
    const url = `http://localhost:5183/harness.html?${query}&theme=${THEME}&lng=${LNG}&width=${WIDTH}`;
    await client.send('Page.navigate', { url }, sessionId);

    // Poll for the audit block rather than sleeping a fixed interval. A fixed wait is a race: under
    // load it returns before the page has mounted and the run reports "blank" or NO_AUDIT for a
    // screen that is perfectly fine — noise that trains you to re-run until green, which is exactly
    // how a real failure gets waved through.
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const { result: probe } = await client.send('Runtime.evaluate', {
        expression: `!!document.getElementById('harness-audit') || /^HARNESS_(ERROR|REJECTION)/.test(document.title)`,
        returnByValue: true,
      }, sessionId);
      if (probe.value) { ready = true; break; }
    }
    if (!ready) { console.log(`### ${page}\n  TIMED OUT waiting for the audit to mount`); allClean = false; continue; }

    // Assert the viewport actually took, every page, every run.
    //
    // This is the check whose absence let a bottom-nav regression reach a device: the harness was
    // laying out at 980px while reporting on a "390px" phone, so `position: fixed` chrome had 576px
    // of room it does not have in reality and every `sm:` variant (min-width 640px) evaluated as
    // active. A verification tool that can be silently wrong about its own viewport is worse than
    // no tool, because it manufactures confidence. Fail loudly instead.
    const { result: vp } = await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify({ w: window.innerWidth, sm: matchMedia("(min-width: 640px)").matches })',
      returnByValue: true,
    }, sessionId);
    const viewport = JSON.parse(vp.value);
    if (Math.abs(viewport.w - WIDTH) > 1) {
      console.error(`### ${page}\n  VIEWPORT MISMATCH: innerWidth=${viewport.w}, expected ${WIDTH}.` +
        `\n  Every measurement below would be taken at the wrong width. Aborting.`);
      fatal = 2; break;
    }
    if (WIDTH < 640 && viewport.sm) {
      console.error(`### ${page}\n  MEDIA QUERY MISMATCH: sm: variants active at ${WIDTH}px. Aborting.`);
      fatal = 2; break;
    }

    // Crash check comes FIRST and is independent of the audit block. A page that throws during
    // render still runs mountAudit, which then finds no elements and reports an empty — "clean" —
    // result. That made a blank, crashed screen pass the gate, which is worse than no gate at all.
    const { result } = await client.send('Runtime.evaluate', {
      expression: `(function () {
        if (/^HARNESS_(ERROR|REJECTION)/.test(document.title)) return JSON.stringify({ crash: document.title });
        var body = (document.body.innerText || '').trim();
        if (body.length < 20) return JSON.stringify({ crash: 'rendered blank (innerText ' + body.length + ' chars)' });
        var el = document.getElementById('harness-audit');
        return el ? el.textContent : 'NO_AUDIT';
      })()`,
      returnByValue: true,
    }, sessionId);

    let data;
    try { data = JSON.parse(result.value); }
    catch { console.log(`### ${page}\n  ${result.value}`); allClean = false; continue; }

    if (data.crash) { console.log(`### ${page}\n  ${data.crash.slice(0, 300)}`); allClean = false; }
    else if (!report(page, data)) allClean = false;

    // Clip to the emulated device width and the page's real height, so the image is the phone
    // screen rather than the phone screen plus a field of empty canvas.
    const { result: h } = await client.send('Runtime.evaluate', {
      expression: 'Math.min(document.documentElement.scrollHeight, 12000)',
      returnByValue: true,
    }, sessionId);
    const shot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: WIDTH, height: h.value || 1400, scale: 1 },
    }, sessionId);
    writeFileSync(join(OUT, `${page.replace(/:/g, '-')}-${THEME}-${LNG}.png`), Buffer.from(shot.data, 'base64'));
  }
  client.close();
} finally {
  chrome.kill();
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}
}

if (fatal) process.exit(fatal);
console.log(`\nscreenshots: ${OUT}/`);
process.exit(allClean ? 0 : 1);
