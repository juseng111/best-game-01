// The four shadow creatures: what each one is, how it moves, and what it drops.
// A chaser hunts the warden, a spitter keeps its distance and shoots, a splitter
// breaks into two chasers when it dies, and a bulwark is a slow wall of health.

import { ENEMIES, FIELD, WAVE } from './config.js';

export function makeEnemy(kind, x, y, wave, rng) {
  const def = ENEMIES[kind];
  const hpMul = 1 + WAVE.hpPerWave * (wave - 1);
  const speedMul = Math.min(1 + WAVE.speedPerWave * (wave - 1), WAVE.speedCap);
  return {
    kind,
    x,
    y,
    radius: def.radius,
    hp: Math.round(def.hp * hpMul),
    maxHp: Math.round(def.hp * hpMul),
    speed: def.speed * speedMul * rng.range(0.9, 1.1),
    damage: def.damage,
    score: def.score,
    xp: def.xp,
    fireTimer: rng.range(1, def.fireInterval ?? 2),
    touchTimer: 0,
    wobble: rng.range(0, Math.PI * 2),
    flash: 0,
  };
}

/** A spawn point just outside the arena, on a random edge. */
export function edgeSpawn(rng) {
  const margin = 30;
  const side = rng.int(0, 3);
  if (side === 0) return { x: rng.range(0, FIELD.width), y: -margin };
  if (side === 1) return { x: rng.range(0, FIELD.width), y: FIELD.height + margin };
  if (side === 2) return { x: -margin, y: rng.range(0, FIELD.height) };
  return { x: FIELD.width + margin, y: rng.range(0, FIELD.height) };
}

/**
 * Steer one enemy for a step. Spitters hold their range and shoot orbs into
 * `orbs`; the rest close in. Returns orbs fired this step (usually none).
 */
export function updateEnemy(enemy, player, dt, time, orbs) {
  const def = ENEMIES[enemy.kind];
  enemy.flash = Math.max(0, enemy.flash - dt * 4);
  enemy.touchTimer = Math.max(0, enemy.touchTimer - dt);
  enemy.wobble += dt * 3;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const wobble = Math.sin(enemy.wobble) * 0.25;

  if (enemy.kind === 'spitter') {
    const hold = def.holdRange;
    let move = 0;
    if (dist > hold + 40) move = 1;
    else if (dist < hold - 60) move = -1;
    enemy.x += (nx * move + -ny * wobble * 0.6) * enemy.speed * dt;
    enemy.y += (ny * move + nx * wobble * 0.6) * enemy.speed * dt;
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && dist < hold + 160) {
      enemy.fireTimer = def.fireInterval;
      orbs.push({
        x: enemy.x,
        y: enemy.y,
        vx: nx * def.orbSpeed,
        vy: ny * def.orbSpeed,
        radius: def.orbRadius,
        damage: def.damage,
        life: 4,
      });
    }
  } else {
    enemy.x += (nx + -ny * wobble) * enemy.speed * dt;
    enemy.y += (ny + nx * wobble) * enemy.speed * dt;
  }
  enemy.x = Math.max(-60, Math.min(FIELD.width + 60, enemy.x));
  enemy.y = Math.max(-60, Math.min(FIELD.height + 60, enemy.y));
}

/** Push overlapping enemies apart so they never stack into one blob. */
export function separateEnemies(enemies) {
  for (let i = 0; i < enemies.length; i += 1) {
    for (let j = i + 1; j < enemies.length; j += 1) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
