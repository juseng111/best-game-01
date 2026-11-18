// The screenshot scenes behind ?shot=title|play|upgrade|gameover. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot (flee the nearest shadows, chase lumen gems, fire at the
// nearest enemy), so the frame is what real play looks like and the same seed
// always gives the same frame.

import { FIELD, STEP } from './config.js';
import { rollChoices } from './upgrades.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 31;
const LIMIT_SECONDS = 300;

/** The warden's autopilot: kite the nearest shadow (orbit it at a distance),
 * drift back toward the middle, chase lumen gems, and fire at the nearest enemy. */
export function autopilotInput(state) {
  const player = state.player;
  let fx = 0;
  let fy = 0;
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of state.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
    const weight = 1 / Math.max(dist, 40);
    fx += (dx / Math.max(dist, 1)) * weight;
    fy += (dy / Math.max(dist, 1)) * weight;
  }
  if (nearest) {
    // Orbit the nearest shadow instead of fleeing to a corner.
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const dist = Math.max(nearestDist, 1);
    const toward = nearestDist > 300 ? 0.7 : nearestDist < 180 ? -0.7 : 0;
    fx += (dx / dist) * toward + (-dy / dist) * 0.6;
    fy += (dy / dist) * toward + (dx / dist) * 0.6;
  }
  // Drift back toward the middle of the reef when far from it.
  const cx = FIELD.width / 2 - player.x;
  const cy = FIELD.height / 2 - player.y;
  const centreDist = Math.hypot(cx, cy);
  if (centreDist > 260) {
    fx += (cx / centreDist) * 0.5;
    fy += (cy / centreDist) * 0.5;
  }
  let gem = null;
  let gemDist = Infinity;
  for (const g of state.gems) {
    const dist = Math.hypot(g.x - player.x, g.y - player.y);
    if (dist < gemDist) {
      gemDist = dist;
      gem = g;
    }
  }
  if (gem && gemDist < 260) {
    fx += ((gem.x - player.x) / gemDist) * 0.5;
    fy += ((gem.y - player.y) / gemDist) * 0.5;
  }
  // Keep off the walls.
  if (player.x < 120) fx += 0.8;
  if (player.x > FIELD.width - 120) fx -= 0.8;
  if (player.y < 120) fy += 0.8;
  if (player.y > FIELD.height - 120) fy -= 0.8;
  const length = Math.hypot(fx, fy);
  if (length > 0.01) {
    fx /= length;
    fy /= length;
  }
  const firing = nearest !== null && nearestDist < 620;
  return {
    x: fx,
    y: fy,
    aimX: nearest ? nearest.x : player.x,
    aimY: nearest ? nearest.y : player.y - 1,
    firing,
  };
}

/** The careless pilot: stands still and never fires, so the reef takes it. */
export function carelessInput(state) {
  return { x: 0, y: 0, aimX: state.player.x, aimY: state.player.y - 1, firing: false };
}

function simulate(world, seconds, pilot) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state.player.hp <= 0) break;
    world.step(STEP, pilot(world.state), {});
  }
}

/**
 * Set `world` to the named scene and return what the main loop should show:
 * the screen, the level-up choices for the upgrade scene, and the score.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    simulate(world, PLAY_SECONDS, autopilotInput);
    return { screen: 'play', score: world.state.score };
  }
  if (name === 'upgrade') {
    const limit = Math.floor(120 / STEP);
    for (let i = 0; i < limit; i += 1) {
      if (world.state.pendingLevelUps > 0) break;
      if (world.state.player.hp <= 0) break;
      world.step(STEP, autopilotInput(world.state), {});
    }
    const choices = rollChoices(world.state.rng, world.state.player.upgrades);
    return { screen: 'levelup', choices, score: world.state.score };
  }
  if (name === 'gameover') {
    // Play well first, so the final score is a real one, then stand still.
    simulate(world, 18, autopilotInput);
    simulate(world, LIMIT_SECONDS, carelessInput);
    return { screen: 'over', score: world.state.score };
  }
  simulate(world, TITLE_SECONDS, autopilotInput);
  return { screen: 'title', score: 0 };
}
