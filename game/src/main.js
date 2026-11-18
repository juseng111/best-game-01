// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// level-up, paused and game over.
//
// ?seed=N fixes the random stream. ?shot=title|play|upgrade|gameover (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { applyUpgrade, levelLabel, rollChoices } from './upgrades.js';
import { autopilotInput, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const hud = document.getElementById('hud');
const hudScore = document.getElementById('hud-score');
const hudBest = document.getElementById('hud-best');
const hudWave = document.getElementById('hud-wave');
const hudHpFill = document.getElementById('hud-hp-fill');
const hudHpText = document.getElementById('hud-hp-text');
const hudXpFill = document.getElementById('hud-xp-fill');
const hudLevel = document.getElementById('hud-level');
const hudShields = document.getElementById('hud-shields');
const overlayTitle = document.getElementById('overlay-title');
const overlayLevelup = document.getElementById('overlay-levelup');
const overlayPause = document.getElementById('overlay-pause');
const overlayOver = document.getElementById('overlay-over');
const levelupCards = document.getElementById('levelup-cards');

const rng = createRandom(seed);
const world = createWorld(rng);
const { state } = world;
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(message) {
  statusEl.textContent = message;
}

/** Show exactly one overlay (or none) and the HUD only while playing. */
function showScreen(name) {
  overlayTitle.classList.toggle('hidden', name !== 'title');
  overlayLevelup.classList.toggle('hidden', name !== 'levelup');
  overlayPause.classList.toggle('hidden', name !== 'paused');
  overlayOver.classList.toggle('hidden', name !== 'over');
  hud.classList.toggle('hidden', name === 'title');
}

const hudCache = { score: -1, best: -1, wave: -1, hp: -1, maxHp: -1, xp: -1, xpNext: -1, level: -1, shields: -1 };

function updateHud() {
  const player = state.player;
  if (hudCache.score !== state.score) {
    hudCache.score = state.score;
    hudScore.textContent = String(state.score);
  }
  if (hudCache.best !== best) {
    hudCache.best = best;
    hudBest.textContent = `Best ${best}`;
  }
  if (hudCache.wave !== state.waves.wave) {
    hudCache.wave = state.waves.wave;
    hudWave.textContent = state.waves.wave === 0 ? '—' : String(state.waves.wave);
  }
  if (hudCache.hp !== Math.ceil(player.hp) || hudCache.maxHp !== player.maxHp) {
    hudCache.hp = Math.ceil(player.hp);
    hudCache.maxHp = player.maxHp;
    hudHpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    hudHpText.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
  }
  if (hudCache.xp !== state.xp || hudCache.xpNext !== state.xpNext) {
    hudCache.xp = state.xp;
    hudCache.xpNext = state.xpNext;
    hudXpFill.style.width = `${Math.min(100, (state.xp / state.xpNext) * 100)}%`;
  }
  if (hudCache.level !== state.level) {
    hudCache.level = state.level;
    hudLevel.textContent = `Lv ${state.level}`;
  }
  if (hudCache.shields !== player.shield) {
    hudCache.shields = player.shield;
    hudShields.textContent = player.shield > 0 ? '◆'.repeat(player.shield) : '';
  }
}

/** Where the warden aims: the mouse when it has moved, else the nearest enemy. */
function currentAim() {
  const mouse = input.mouse;
  if (mouse.seen) return { x: mouse.x, y: mouse.y };
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  if (nearest) return { x: nearest.x, y: nearest.y };
  return { x: state.player.x, y: state.player.y - 1 };
}

const fx = {
  shoot: () => audio.shoot(),
  hit: () => audio.hit(),
  kill: () => audio.kill(),
  gem: () => audio.gem(),
  hurt: () => audio.hurt(),
  shield: () => audio.click(),
  levelup: (level) => {
    audio.levelup();
    announce(`Level ${level}! Choose a boon.`);
  },
  wave: (wave) => {
    audio.wave();
    announce(`Wave ${wave}.`);
  },
  clear: () => audio.wave(),
  nova: () => audio.nova(),
};

let screen = 'title';
let best = readBest();
let choices = [];

function startGame() {
  audio.unlock();
  audio.click();
  world.reset();
  best = readBest();
  screen = 'play';
  showScreen(screen);
  announce('Playing. Hold the mouse or Space to fire.');
}

function endGame() {
  screen = 'over';
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
  document.getElementById('over-score').textContent = String(state.score);
  document.getElementById('over-wave').textContent = String(state.waves.wave);
  document.getElementById('over-kills').textContent = String(state.kills);
  document.getElementById('over-best').textContent = String(best);
  audio.over();
  showScreen(screen);
  announce(`The reef goes dark. Score ${state.score}. Best ${best}.`);
}

function openLevelup() {
  screen = 'levelup';
  choices = rollChoices(rng, state.player.upgrades);
  levelupCards.innerHTML = '';
  choices.forEach((upgrade, index) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.innerHTML =
      `<span class="card-key">${index + 1}</span>` +
      `<span class="card-name">${upgrade.name}</span>` +
      `<span class="card-level">${levelLabel(state.player, upgrade)}</span>` +
      `<span class="card-text">${upgrade.text}</span>`;
    card.addEventListener('click', () => pickUpgrade(index));
    levelupCards.appendChild(card);
  });
  showScreen(screen);
}

function pickUpgrade(index) {
  const upgrade = choices[index];
  if (!upgrade) return;
  audio.click();
  applyUpgrade(state.player, upgrade);
  state.pendingLevelUps -= 1;
  if (state.pendingLevelUps > 0) {
    openLevelup();
  } else {
    screen = 'play';
    showScreen(screen);
    announce('Playing.');
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  best = readBest();
  if (name === 'upgrade') {
    choices = scene.choices;
    levelupCards.innerHTML = '';
    choices.forEach((upgrade, index) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.type = 'button';
      card.innerHTML =
        `<span class="card-key">${index + 1}</span>` +
        `<span class="card-name">${upgrade.name}</span>` +
        `<span class="card-level">${levelLabel(state.player, upgrade)}</span>` +
        `<span class="card-text">${upgrade.text}</span>`;
      levelupCards.appendChild(card);
    });
  }
  if (name === 'gameover') {
    document.getElementById('over-score').textContent = String(world.state.score);
    document.getElementById('over-wave').textContent = String(world.state.waves.wave);
    document.getElementById('over-kills').textContent = String(world.state.kills);
    document.getElementById('over-best').textContent = String(Math.max(best, world.state.score));
  }
  if (name === 'title') {
    document.getElementById('title-best').textContent = best > 0 ? `Best score: ${best}` : 'No dives yet — the reef is waiting.';
  }
  screen = scene.screen;
  showScreen(screen);
  updateHud();
  renderer.resize();
  let painted = 0;
  function paint() {
    renderer.draw(state, screen, input.mouse);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const inputHandlers = input;
  let accumulator = 0;
  let last = performance.now();

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', () => {
    screen = 'play';
    showScreen(screen);
    announce('Playing.');
  });
  document.getElementById('btn-mute').addEventListener('click', () => {
    const muted = audio.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (screen === 'play') {
      screen = 'paused';
      showScreen(screen);
      announce('Paused.');
    }
  });
  document.getElementById('title-best').textContent = best > 0 ? `Best score: ${best}` : 'No dives yet — the reef is waiting.';
  window.addEventListener('pointerdown', () => audio.unlock());
  window.addEventListener('keydown', () => audio.unlock());
  window.addEventListener('resize', () => renderer.resize());
  renderer.resize();

  function handleActions() {
    const actions = inputHandlers.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
    }
    if (screen === 'title' || screen === 'over') {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === 'levelup') {
      const pick = inputHandlers.takePick();
      if (pick >= 1 && pick <= choices.length) pickUpgrade(pick - 1);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        showScreen(screen);
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        showScreen(screen);
        announce('Playing.');
      }
    }
  }

  function stepPlay() {
    const aim = currentAim();
    const move = inputHandlers.direction();
    world.step(STEP, { x: move.x, y: move.y, aimX: aim.x, aimY: aim.y, firing: inputHandlers.firing }, fx);
    if (state.player.hp <= 0) {
      endGame();
      return;
    }
    if (state.pendingLevelUps > 0) openLevelup();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'title') {
      // Attract mode: the reef plays itself behind the title, and never dies.
      while (accumulator >= STEP) {
        world.step(STEP, autopilotInput(state), {});
        state.player.hp = state.player.maxHp;
        accumulator -= STEP;
      }
    } else if (screen === 'play') {
      while (accumulator >= STEP && screen === 'play') {
        stepPlay();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateHud();
    renderer.draw(state, screen, input.mouse);
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      showScreen(screen);
      announce('Paused.');
    }
  });

  // A handle for the play-test: the world, the screen, and a way to start.
  window.__gloomreef = { world, get screen() { return screen; }, start: startGame };
  showScreen(screen);
  announce('Gloomreef. Press Space or click Dive In to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
