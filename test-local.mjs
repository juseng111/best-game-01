// Local checks for the Gloomreef entry. Usage: node test-local.mjs [outDir]
//  1. Runs main.ts twice (into out/ and out2/) and checks the outputs are
//     byte-identical.
//  2. Checks the gate limits: game/ entries and bytes, index.html size, no
//     symlinks, screenshot count/size/dimensions, dossier size, and the
//     /output totals. Rebuilds the dossier from the output and checks it is
//     byte-for-byte the one main.ts wrote.
//  3. Loads the game in a browser (served locally): zero console errors, zero
//     page errors, zero failed requests and zero network requests, then starts
//     a real game, moves and fires, and checks the world actually advances.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const require = createRequire('/home/hatch/workspace/.shot-tools/package.json');
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const outName = process.argv[2] ?? 'out';
const outDir = join(here, outName);
const out2Dir = join(here, `${outName}2`);
const port = 8902;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    out.push(path);
    if (entry.isDirectory()) out.push(...walk(path));
  }
  return out;
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

// ---- 1. main.ts twice, byte-identical ----
for (const dir of [outDir, out2Dir]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('node', ['main.ts'], { cwd: here, env: { ...process.env, MAKEFUN_OUTPUT_DIR: dir }, stdio: 'pipe' });
}
const filesA = walk(outDir).map((p) => relative(outDir, p)).sort();
const filesB = walk(out2Dir).map((p) => relative(out2Dir, p)).sort();
check('main.ts runs twice, same file list', JSON.stringify(filesA) === JSON.stringify(filesB));
let identical = filesA.length === filesB.length;
for (const rel of filesA) {
  const a = join(outDir, rel);
  const b = join(out2Dir, rel);
  if (statSync(a).isDirectory()) continue;
  if (!readFileSync(a).equals(readFileSync(b))) { identical = false; break; }
}
check('main.ts runs twice, byte-identical outputs', identical, `${filesA.length} entries`);

// ---- 2. Gate limits on the output ----
const gameDir = join(outDir, 'game');
const gameEntries = walk(gameDir);
const gameFiles = gameEntries.filter((p) => statSync(p).isFile());
const gameBytes = gameFiles.reduce((sum, p) => sum + statSync(p).size, 0);
check('game/ entries <= 993', gameEntries.length <= 993, `${gameEntries.length} entries`);
check('game/ bytes <= 48 MiB', gameBytes <= 48 * 1024 * 1024, `${gameBytes} bytes`);
check('game/ has no symlinks', gameEntries.every((p) => !lstatSync(p).isSymbolicLink()));
const longPath = gameEntries.find((p) => Buffer.byteLength(relative(gameDir, p), 'utf8') > 1000);
check('game/ paths <= 1000 bytes', longPath === undefined, longPath ?? '');
const indexHtml = join(gameDir, 'index.html');
check('game/index.html exists and <= 1 MiB', existsSync(indexHtml) && statSync(indexHtml).size <= 1024 * 1024, existsSync(indexHtml) ? `${statSync(indexHtml).size} bytes` : 'missing');

const shotsDir = join(outDir, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort() : [];
check('screenshots count 3-4', shots.length >= 3 && shots.length <= 4, `${shots.length} files`);
for (const name of shots) {
  const path = join(shotsDir, name);
  const buffer = readFileSync(path);
  const size = buffer.length;
  const dims = pngSize(buffer) ?? jpegSize(buffer);
  const nameOk = /^[A-Za-z0-9._-]{1,128}$/.test(name) && !name.startsWith('.') && !name.startsWith('-');
  check(`screenshot ${name} name/size/dimensions`, nameOk && size <= 262144 && dims !== null && Math.max(dims.width, dims.height) <= 1280 && Math.min(dims.width, dims.height) >= 480,
    `${size} bytes, ${dims ? `${dims.width}x${dims.height}` : 'unparsed'}`);
}

const dossierPath = join(outDir, 'dossier.json');
const dossier = readFileSync(dossierPath);
check('dossier.json <= 1.5 MiB', dossier.length <= 1572864, `${dossier.length} bytes`);
const rebuilt = Buffer.from(buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
}));
check('dossier.json is byte-for-byte buildDossier output', dossier.equals(rebuilt));

const outEntries = walk(outDir);
const outBytes = outEntries.filter((p) => statSync(p).isFile()).reduce((s, p) => s + statSync(p).size, 0);
check('/output entries <= 1000', outEntries.length <= 1000, `${outEntries.length} entries`);
check('/output bytes <= 64 MiB', outBytes <= 64 * 1024 * 1024, `${outBytes} bytes`);

// ---- 3. The game loads and plays, cleanly ----
const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: here, stdio: 'pipe' });
let serverOut = '';
server.stdout.on('data', (d) => { serverOut += d; });
server.stderr.on('data', (d) => { serverOut += d; });
async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not come up: ${serverOut}`);
}
try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`http://localhost:${port}`) && !url.startsWith('data:')) problems.push(`network request: ${url}`);
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  check('game loads with zero console/page/network problems', problems.length === 0, problems.join('; ') || 'clean');
  const titleVisible = await page.evaluate(() => !document.getElementById('overlay-title').classList.contains('hidden'));
  check('title screen shows on load', titleVisible);

  // Start a real game, move and fire.
  await page.mouse.move(640, 400);
  await page.click('#btn-start');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const g = window.__gloomreef;
    return { screen: g.screen, x: g.world.state.player.x, y: g.world.state.player.y, score: g.world.state.score };
  });
  await page.keyboard.down('KeyD');
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.waitForTimeout(2500);
  await page.mouse.up();
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => {
    const g = window.__gloomreef;
    const s = g.world.state;
    return {
      screen: g.screen,
      x: s.player.x,
      y: s.player.y,
      score: s.score,
      wave: s.waves.wave,
      enemies: s.enemies.length,
      bullets: s.bullets.length,
      hp: s.player.hp,
    };
  });
  check('player moves when keys are held', after.x > before.x + 20, `x ${before.x.toFixed(0)} -> ${after.x.toFixed(0)}`);
  check('game is playing with enemies on the field', after.screen === 'play' && after.wave >= 1 && after.enemies > 0,
    `screen=${after.screen} wave=${after.wave} enemies=${after.enemies}`);
  check('no problems during live play', problems.length === 0, problems.join('; ') || 'clean');
  await browser.close();
} finally {
  server.kill();
}

console.log(failures === 0 ? 'ALL LOCAL TESTS PASS' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
