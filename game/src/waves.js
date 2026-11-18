// The wave director: builds each wave's spawn queue from a cost budget, trickles
// enemies in from the edges, and calls the next wave after a short breather.

import { ENEMIES, WAVE, WAVE_UNLOCKS } from './config.js';
import { edgeSpawn, makeEnemy } from './enemies.js';

export function createWaves(rng) {
  return {
    wave: 0,
    phase: 'breather',
    timer: 1.2,
    queue: [],
    spawnTimer: 0,
  };
}

function kindsFor(wave) {
  let kinds = ['gloomlet'];
  for (const unlock of WAVE_UNLOCKS) {
    if (wave >= unlock.wave) kinds = unlock.kinds;
  }
  return kinds;
}

function buildQueue(wave, rng) {
  const kinds = kindsFor(wave);
  const budget = WAVE.budget(wave);
  const queue = [];
  let spent = 0;
  let guard = 0;
  while (spent < budget && guard < 200) {
    guard += 1;
    const kind = rng.pick(kinds);
    const cost = ENEMIES[kind].cost;
    if (spent + cost > budget + 2) continue;
    queue.push(kind);
    spent += cost;
  }
  // Shuffle the queue so the wave never arrives in one kind's clump.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

/**
 * Advance the director. Returns 'wave' when a new wave starts, 'clear' when the
 * arena is empty and the wave is beaten, or null.
 */
export function updateWaves(director, enemies, dt, rng) {
  if (director.phase === 'breather') {
    director.timer -= dt;
    if (director.timer <= 0) {
      director.wave += 1;
      director.queue = buildQueue(director.wave, rng);
      director.phase = 'spawning';
      director.spawnTimer = 0.4;
      return 'wave';
    }
    return null;
  }
  if (director.phase === 'spawning') {
    director.spawnTimer -= dt;
    if (director.spawnTimer <= 0 && director.queue.length > 0 && enemies.length < WAVE.maxAlive) {
      director.spawnTimer = WAVE.spawnInterval(director.wave);
      const kind = director.queue.shift();
      const at = edgeSpawn(rng);
      enemies.push(makeEnemy(kind, at.x, at.y, director.wave, rng));
    }
    if (director.queue.length === 0) director.phase = 'clearing';
    return null;
  }
  // Clearing: the wave is beaten once the last enemy falls.
  if (enemies.length === 0) {
    director.phase = 'breather';
    director.timer = WAVE.breather;
    return 'clear';
  }
  return null;
}
