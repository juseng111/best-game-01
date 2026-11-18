// The simulation: the warden, the waves, the bolts, the gems and the reef itself.
// One fixed step advances everything and calls the fx hooks (sounds, particles,
// banners) the main loop supplies; the main loop reads the state to run the
// screens, the HUD and the level-up choices.

import { FIELD, PALETTE, xpNeeded } from './config.js';
import { createParticles } from './particles.js';
import { createPlayer, healPlayer, hurtPlayer, updatePlayer } from './player.js';
import { boltHit, enemyTouchesPlayer, orbHitsPlayer, updateBullets } from './bullets.js';
import { dropGems, updateGems } from './gems.js';
import { makeEnemy, separateEnemies, updateEnemy } from './enemies.js';
import { createWaves, updateWaves } from './waves.js';

const NO_FX = {};

/** A branching coral, drawn once into the reef layer. */
function drawCoral(ctx, x, y, length, angle, depth, color, width) {
  if (depth === 0 || length < 8) return;
  const x2 = x + Math.cos(angle) * length;
  const y2 = y + Math.sin(angle) * length;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const branches = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < branches; i += 1) {
    drawCoral(ctx, x2, y2, length * 0.68, angle + (Math.random() - 0.5) * 1.5, depth - 1, color, width * 0.7);
  }
}

/** The reef floor, painted once to an offscreen canvas and blitted every frame. */
function buildReef(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.backdropTop);
  gradient.addColorStop(1, PALETTE.backdropBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Sand speckles.
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(120, 90, 180, 0.16)' : 'rgba(60, 200, 180, 0.10)';
    ctx.beginPath();
    ctx.arc(rng.range(0, FIELD.width), rng.range(0, FIELD.height), rng.range(0.6, 2), 0, Math.PI * 2);
    ctx.fill();
  }
  // Rocks.
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath();
    ctx.ellipse(rng.range(0, FIELD.width), rng.range(0, FIELD.height), rng.range(18, 60), rng.range(10, 30), rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
  // Corals in teal, coral pink and anemone magenta.
  const colors = [PALETTE.teal, PALETTE.coral, PALETTE.anemone, PALETTE.tealDark, PALETTE.coralDark];
  for (let i = 0; i < 16; i += 1) {
    const x = rng.range(40, FIELD.width - 40);
    const y = rng.range(60, FIELD.height - 30);
    drawCoral(ctx, x, y, rng.range(26, 52), -Math.PI / 2 + rng.range(-0.5, 0.5), 3, rng.pick(colors), rng.range(4, 7));
  }
  // Anemone dots.
  for (let i = 0; i < 10; i += 1) {
    const x = rng.range(30, FIELD.width - 30);
    const y = rng.range(30, FIELD.height - 30);
    for (let j = 0; j < 9; j += 1) {
      ctx.fillStyle = PALETTE.anemone;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x + rng.range(-12, 12), y + rng.range(-12, 12), rng.range(1.5, 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // A few glowing motes frozen into the floor.
  for (let i = 0; i < 24; i += 1) {
    ctx.fillStyle = 'rgba(103, 232, 249, 0.5)';
    ctx.beginPath();
    ctx.arc(rng.range(0, FIELD.width), rng.range(0, FIELD.height), rng.range(1, 2.4), 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function createWorld(rng) {
  const state = {
    rng,
    time: 0,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    orbs: [],
    gems: [],
    particles: createParticles(),
    waves: createWaves(rng),
    score: 0,
    level: 1,
    xp: 0,
    xpNext: xpNeeded(1),
    kills: 0,
    pendingLevelUps: 0,
    flash: 0,
    banner: null,
    moteTimer: 0,
    reef: buildReef(rng),
  };

  function killEnemy(enemy, fx) {
    state.score += enemy.score;
    state.kills += 1;
    state.particles.burst(enemy.x, enemy.y, '#a78bfa', 14, 260);
    state.particles.ring(enemy.x, enemy.y, '#c4b5fd', enemy.radius * 2.4);
    state.particles.text(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#e9d5ff');
    dropGems(state.gems, enemy.x, enemy.y, enemy.xp, rng);
    if (fx.kill) fx.kill(enemy.x, enemy.y);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = makeEnemy('gloomlet', enemy.x + (i === 0 ? -14 : 14), enemy.y, state.waves.wave, rng);
        child.x = Math.max(20, Math.min(FIELD.width - 20, child.x));
        child.y = Math.max(20, Math.min(FIELD.height - 20, child.y));
        state.enemies.push(child);
      }
    }
  }

  function damageEnemy(enemy, damage, fx) {
    enemy.hp -= damage;
    enemy.flash = 1;
    if (enemy.hp <= 0) killEnemy(enemy, fx);
  }

  function applyHit(damage, fx) {
    const result = hurtPlayer(state.player, damage, state.time);
    if (result === 'hurt') {
      state.flash = 0.55;
      state.particles.shake(0.55);
      if (fx.hurt) fx.hurt();
    } else if (result === 'shield') {
      state.particles.ring(state.player.x, state.player.y, '#67e8f9', 60);
      if (fx.shield) fx.shield();
    }
  }

  function step(dt, input, fx = NO_FX) {
    state.time += dt;
    const player = state.player;

    // Ambient motes keep the reef breathing.
    state.moteTimer -= dt;
    if (state.moteTimer <= 0) {
      state.moteTimer = 0.5;
      state.particles.mote(rng.range(0, FIELD.width), rng.range(0, FIELD.height), 'rgba(103, 232, 249, 0.7)');
    }

    const waveEvent = updateWaves(state.waves, state.enemies, dt, rng);
    if (waveEvent === 'wave') {
      state.banner = { text: `Wave ${state.waves.wave}`, until: state.time + 2 };
      if (fx.wave) fx.wave(state.waves.wave);
    } else if (waveEvent === 'clear') {
      const bonus = 25 * state.waves.wave;
      state.score += bonus;
      state.banner = { text: `Wave ${state.waves.wave} cleared  +${bonus}`, until: state.time + 2 };
      healPlayer(player, 10);
      if (fx.clear) fx.clear(state.waves.wave, bonus);
    }

    const nova = updatePlayer(player, input, dt, state.time, state.bullets, () => {
      if (fx.shoot) fx.shoot();
    });
    if (nova) {
      state.particles.ring(nova.x, nova.y, PALETTE.player, nova.radius);
      state.particles.shake(0.35);
      for (const enemy of [...state.enemies]) {
        const dx = enemy.x - nova.x;
        const dy = enemy.y - nova.y;
        if (dx * dx + dy * dy < nova.radius * nova.radius) damageEnemy(enemy, nova.damage, fx);
      }
      state.enemies = state.enemies.filter((e) => e.hp > 0);
      if (fx.nova) fx.nova(nova.x, nova.y, nova.radius);
    }

    for (const enemy of state.enemies) updateEnemy(enemy, player, dt, state.time, state.orbs);
    separateEnemies(state.enemies);

    updateBullets(state.bullets, dt);
    updateBullets(state.orbs, dt);
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      const hit = boltHit(bullet, state.enemies);
      if (hit) {
        state.bullets.splice(i, 1);
        state.particles.burst(bullet.x, bullet.y, PALETTE.bolt, 4, 140);
        damageEnemy(hit, bullet.damage, fx);
        state.enemies = state.enemies.filter((e) => e.hp > 0);
        if (fx.hit) fx.hit();
      }
    }

    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      if (orbHitsPlayer(orb, player)) {
        state.orbs.splice(i, 1);
        applyHit(orb.damage, fx);
      }
    }
    for (const enemy of state.enemies) {
      if (enemy.touchTimer <= 0 && enemyTouchesPlayer(enemy, player)) {
        enemy.touchTimer = 0.6;
        applyHit(enemy.damage, fx);
      }
    }

    const gained = updateGems(state.gems, player, dt);
    if (gained > 0) {
      state.xp += gained;
      if (fx.gem) fx.gem();
      while (state.xp >= state.xpNext) {
        state.xp -= state.xpNext;
        state.level += 1;
        state.xpNext = xpNeeded(state.level);
        state.pendingLevelUps += 1;
        if (fx.levelup) fx.levelup(state.level);
      }
    }

    state.particles.update(dt);
    state.flash = Math.max(0, state.flash - dt * 2.2);
  }

  /** Back to a fresh reef and a fresh warden, same random stream. */
  function reset() {
    state.time = 0;
    state.player = createPlayer();
    state.enemies = [];
    state.bullets = [];
    state.orbs = [];
    state.gems = [];
    state.particles = createParticles();
    state.waves = createWaves(rng);
    state.score = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = xpNeeded(1);
    state.kills = 0;
    state.pendingLevelUps = 0;
    state.flash = 0;
    state.banner = null;
    state.moteTimer = 0;
    state.reef = buildReef(rng);
  }

  return { state, step, reset };
}
