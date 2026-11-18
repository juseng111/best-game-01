# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/juseng111/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/juseng111/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Gloomreef is a top-down arena survival game: a lone light warden defends the
last coral reef against waves of shadow creatures. It runs in a desktop
browser from static files, with no network request and no build step.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Or open `game/index.html`
directly from the files (module scripts need to be served over HTTP in some
browsers, so the server above is the reliable way).

## The game

- **Move** with WASD or the arrow keys; **aim** with the mouse; **hold click
  or Space** to fire light bolts. <kbd>P</kbd> pauses, <kbd>M</kbd> mutes.
- Four shadow creatures close in: **Gloomlets** chase, **Spitters** hold their
  distance and shoot shadow orbs, **Splitters** break into two Gloomlets when
  they die, and **Bulwarks** are slow walls of health. Waves grow harder, and
  clearing one heals the warden a little.
- Slain shadows drop **lumen gems**. Collect them to fill the level bar; each
  level up pauses the fight and offers a choice of one of three boons — bolt
  damage, fire rate, move speed, max health, a shield that blocks a hit, or a
  periodic nova blast.
- The HUD shows the score, the wave, health, shields and the level bar. The
  best score is kept in the browser. There is no final wave: the game ends
  when the warden falls, and the game-over screen shows the score, the wave
  reached and the shadows banished, with a restart button.

All art is drawn in code and all sounds are synthesised with WebAudio — no
audio or image files, no network, nothing borrowed.

## Layout

- `main.ts` — entrypoint: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's dossier library, byte for byte.
- `game/` — the playable game as static files: `index.html` plus ES modules
  under `game/src/`, one file per job (see below).
- `screenshots/` — the title screen, mid-play, a level-up choice and the
  game-over screen, taken from the game's own code in a browser.
- `serve.ts` — a tiny static server for local play-testing.
- `test-local.mjs` — runs `main.ts` twice and checks the outputs are
  byte-identical, checks the gate limits, and loads the game in a browser
  with zero console errors and zero network requests.

## Source map (`game/src/`)

- `config.js` — every tuning number, colour and enemy/upgrade definition.
- `random.js` — the seeded random source (screenshots are reproducible).
- `audio.js` — synthesised WebAudio sounds, no audio files.
- `input.js` — keyboard and mouse, read as one snapshot per frame.
- `player.js` — the warden: movement, aiming, firing, the nova, shields.
- `enemies.js` — the four shadow creatures: their movement and attacks.
- `bullets.js` — light bolts and shadow orbs: flight and circle hits.
- `gems.js` — lumen gems: drifting, magnet pull, collection.
- `waves.js` — the wave director: budgets, spawn queues, breathers.
- `upgrades.js` — the level-up boons: rolling three choices, applying one.
- `particles.js` — sparks, rings, floating text and screen shake.
- `world.js` — the simulation: one fixed step advances everything.
- `render.js` — the painter: reef, warden, shadows, bolts, banners, flash.
- `shots.js` — the deterministic screenshot scenes (`?shot=…`).
- `main.js` — boot, the fixed-step loop, the screens, the HUD, the menus.

---

<sub>Entered on [make.fun](https://make.fun/?ref=98pvvmtf&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
