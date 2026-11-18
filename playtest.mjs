// A live play-through of Gloomreef in a real browser: start, fight with the
// mouse and keys until the level-up overlay opens, pick a boon, pause and
// resume, then stop fighting until the game ends, and restart. Fails on any
// console error, page error, failed request or network request, or any step
// that does not reach the screen it should.
// Usage: node playtest.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/.shot-tools/package.json');
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const port = 8904;
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: here, stdio: 'pipe' });
async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not come up');
}

const problems = [];
try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`http://localhost:${port}`) && !url.startsWith('data:')) problems.push(`network request: ${url}`);
  });
  const state = () => page.evaluate(() => {
    const g = window.__gloomreef;
    const s = g.world.state;
    return {
      screen: g.screen,
      score: s.score,
      hp: s.player.hp,
      level: s.level,
      xp: s.xp,
      wave: s.waves.wave,
      enemies: s.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
      gems: s.gems.map((e) => ({ x: e.x, y: e.y })),
      px: s.player.x,
      py: s.player.y,
      pending: s.pendingLevelUps,
      upgrades: s.player.upgrades,
    };
  });

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#btn-start');
  await page.waitForTimeout(300);
  check('game starts on Dive In', (await state()).screen === 'play');

  // Fight: aim at the nearest enemy, hold fire, kite away from it.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  let leveledAt = null;
  const held = new Set();
  async function holdKey(code, on) {
    if (on && !held.has(code)) { await page.keyboard.down(code); held.add(code); }
    if (!on && held.has(code)) { await page.keyboard.up(code); held.delete(code); }
  }
  const fightUntil = Date.now() + 90000;
  while (Date.now() < fightUntil) {
    const s = await state();
    if (s.screen === 'levelup') { leveledAt = s; break; }
    if (s.screen !== 'play') break;
    const target = s.enemies.length > 0
      ? s.enemies.reduce((a, b) => ((a.x - s.px) ** 2 + (a.y - s.py) ** 2 < (b.x - s.px) ** 2 + (b.y - s.py) ** 2 ? a : b))
      : null;
    if (target) await page.mouse.move(Math.round(target.x), Math.round(target.y), { steps: 2 });
    // Kite: run from the nearest enemy, drift to the centre.
    let mx = 0;
    let my = 0;
    if (target) {
      const dx = s.px - target.x;
      const dy = s.py - target.y;
      const d = Math.hypot(dx, dy) || 1;
      mx += (dx / d) * 0.7;
      my += (dy / d) * 0.7;
    }
    const cx = 640 - s.px;
    const cy = 400 - s.py;
    const cd = Math.hypot(cx, cy);
    if (cd > 250) { mx += (cx / cd) * 0.4; my += (cy / cd) * 0.4; }
    await holdKey('KeyA', mx < -0.3);
    await holdKey('KeyD', mx > 0.3);
    await holdKey('KeyW', my < -0.3);
    await holdKey('KeyS', my > 0.3);
    await page.waitForTimeout(120);
  }
  await page.mouse.up();
  for (const code of [...held]) await page.keyboard.up(code);
  held.clear();
  check('level-up overlay opens in live play', leveledAt !== null, leveledAt ? `level ${leveledAt.level}, score ${leveledAt.score}` : 'never levelled up in 90s');
  if (leveledAt) {
    const cards = await page.$$eval('#levelup-cards .card', (els) => els.map((el) => el.textContent));
    check('level-up offers three boons', cards.length === 3, cards.join(' | ').slice(0, 120));
    await page.click('#levelup-cards .card:first-child');
    await page.waitForTimeout(300);
    const after = await state();
    check('picking a boon resumes play with the upgrade applied',
      after.screen === 'play' && Object.keys(after.upgrades).length === 1,
      `screen=${after.screen} upgrades=${JSON.stringify(after.upgrades)}`);
  }

  // Pause and resume.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  check('P pauses the game', (await state()).screen === 'paused');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  check('P resumes the game', (await state()).screen === 'play');

  // Stop fighting: stand still until the shadows take the warden.
  const overUntil = Date.now() + 120000;
  let overAt = null;
  while (Date.now() < overUntil) {
    const s = await state();
    if (s.screen === 'over') { overAt = s; break; }
    await page.waitForTimeout(500);
  }
  check('standing still ends the game', overAt !== null, overAt ? `score ${overAt.score}, wave ${overAt.wave}` : 'still alive after 120s');
  if (overAt) {
    const shown = await page.evaluate(() => ({
      score: document.getElementById('over-score').textContent,
      wave: document.getElementById('over-wave').textContent,
      kills: document.getElementById('over-kills').textContent,
    }));
    check('game-over screen shows the final score', Number(shown.score) === overAt.score && Number(shown.wave) === overAt.wave,
      `shown score=${shown.score} wave=${shown.wave} kills=${shown.kills}`);
    await page.click('#btn-restart');
    await page.waitForTimeout(300);
    const restarted = await state();
    check('Dive Again restarts a fresh game', restarted.screen === 'play' && restarted.score === 0 && restarted.hp === 100,
      `screen=${restarted.screen} score=${restarted.score} hp=${restarted.hp}`);
  }
  check('no console/page/network problems during the whole play-through', problems.length === 0, problems.join('; ') || 'clean');
  await browser.close();
} finally {
  server.kill();
}

console.log(failures === 0 ? 'PLAYTEST PASS' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
