// The Light Warden: movement, aiming, firing light bolts, the nova, and the
// shields. Upgrades live as levels on the player and shape these numbers.

import { FIELD, NOVA, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    bulletDamage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    invulnerableUntil: 0,
    fireCooldown: 0,
    novaTimer: NOVA.interval,
    novaLevel: 0,
    shieldMax: 0,
    shield: 0,
    shieldRecharge: 0,
    upgrades: {},
    moving: false,
  };
}

/**
 * Move, aim and fire. Returns a nova burst when one goes off, or null.
 * `bullets` is appended to; `onShoot` is called for the sound.
 */
export function updatePlayer(player, input, dt, time, bullets, onShoot) {
  player.moving = input.x !== 0 || input.y !== 0;
  player.x += input.x * player.speed * dt;
  player.y += input.y * player.speed * dt;
  player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y));

  const dx = input.aimX - player.x;
  const dy = input.aimY - player.y;
  if (dx !== 0 || dy !== 0) player.angle = Math.atan2(dy, dx);

  player.fireCooldown -= dt;
  if (input.firing && player.fireCooldown <= 0) {
    player.fireCooldown = player.fireInterval;
    const spread = 0.05;
    const angle = player.angle + (Math.random() - 0.5) * spread;
    bullets.push({
      x: player.x + Math.cos(angle) * (player.radius + 6),
      y: player.y + Math.sin(angle) * (player.radius + 6),
      vx: Math.cos(angle) * player.bulletSpeed,
      vy: Math.sin(angle) * player.bulletSpeed,
      radius: PLAYER.bulletRadius,
      damage: player.bulletDamage,
      life: 1.2,
    });
    onShoot();
  }

  if (player.novaLevel > 0) {
    player.novaTimer -= dt;
    if (player.novaTimer <= 0) {
      player.novaTimer = NOVA.interval;
      return {
        x: player.x,
        y: player.y,
        radius: NOVA.radius + NOVA.radiusPerLevel * (player.novaLevel - 1),
        damage: NOVA.damage + NOVA.damagePerLevel * (player.novaLevel - 1),
      };
    }
  }

  if (player.shield < player.shieldMax) {
    player.shieldRecharge += dt;
    if (player.shieldRecharge >= 25) {
      player.shieldRecharge = 0;
      player.shield += 1;
    }
  }
  return null;
}

/** A hit lands on the warden. Returns 'shield', 'hurt' or 'invulnerable'. */
export function hurtPlayer(player, damage, time) {
  if (time < player.invulnerableUntil) return 'invulnerable';
  if (player.shield > 0) {
    player.shield -= 1;
    player.invulnerableUntil = time + 0.6;
    return 'shield';
  }
  player.hp -= damage;
  player.invulnerableUntil = time + PLAYER.invulnerable;
  return 'hurt';
}

export function healPlayer(player, amount) {
  player.hp = Math.min(player.maxHp, player.hp + amount);
}
