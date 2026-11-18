// Take Gloomreef's four screenshots with Playwright's bundled Chromium.
// Usage: node shots.mjs [seed]   (default seed 7; writes screenshots/*.png)
// Serves game/ on a local port, opens each ?shot= scene at 1280x800, waits for
// window.__shotReady, and saves the frame. Prints console errors, page errors
// and failed requests, if any, and each PNG's size.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/.shot-tools/package.json');
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const seed = process.argv[2] ?? '7';
const port = 8901;
const shots = [
  ['title', '1-title.jpg'],
  ['play', '2-play.jpg'],
  ['upgrade', '3-upgrade.jpg'],
  ['gameover', '4-gameover.jpg'],
];

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

const problems = [];
try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`http://localhost:${port}`) && !url.startsWith('data:')) {
      problems.push(`network request: ${url}`);
    }
  });

  for (const [scene, file] of shots) {
    await page.goto(`http://localhost:${port}/?shot=${scene}&seed=${seed}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    await page.waitForTimeout(150);
    // JPEG: the gate allows PNG or JPEG, and a PNG of this detailed canvas
    // runs over the 256 KiB cap; the kit's own starter ships JPGs too.
    await page.screenshot({ path: join(here, 'screenshots', file), type: 'jpeg', quality: 85 });
    const size = statSync(join(here, 'screenshots', file)).size;
    console.log(`${file}: ${size} bytes (${scene}, seed ${seed})`);
  }
  await browser.close();
} finally {
  server.kill();
}

if (problems.length > 0) {
  console.error('PROBLEMS:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('shots ok, no console errors, no failed or external requests');
