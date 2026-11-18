// Lumen gems: the XP enemies drop. They drift, glow, and get pulled toward the
// warden when close; collecting them fills the level bar.

import { PLAYER } from './config.js';

export function dropGems(gems, x, y, value, rng) {
  for (let i = 0; i < value; i += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const distance = rng.range(6, 26);
    gems.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      vx: Math.cos(angle) * 40,
      vy: Math.sin(angle) * 40,
      value: 1,
      age: rng.range(0, Math.PI * 2),
    });
  }
}

/** Drift, magnet toward the warden, and collect. Returns XP gained this step. */
export function updateGems(gems, player, dt) {
  let gained = 0;
  for (let i = gems.length - 1; i >= 0; i -= 1) {
    const gem = gems[i];
    gem.age += dt * 4;
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < PLAYER.magnetRadius) {
      const pull = 520 * (1 - dist / PLAYER.magnetRadius) + 120;
      gem.vx += (dx / dist) * pull * dt;
      gem.vy += (dy / dist) * pull * dt;
    }
    gem.vx *= 1 - 3 * dt;
    gem.vy *= 1 - 3 * dt;
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    if (dist < player.radius + 14) {
      gained += gem.value;
      gems.splice(i, 1);
    }
  }
  return gained;
}
