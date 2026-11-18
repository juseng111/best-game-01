// Light bolts (the warden's) and shadow orbs (the spitters'): straight lines,
// a short life, and circle hits against whatever they meet.

export function updateBullets(bullets, dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > 1300 || b.y < -20 || b.y > 820) {
      bullets.splice(i, 1);
    }
  }
}

/** First enemy a bolt touches, or null. */
export function boltHit(bullet, enemies) {
  for (const enemy of enemies) {
    const dx = enemy.x - bullet.x;
    const dy = enemy.y - bullet.y;
    const reach = enemy.radius + bullet.radius;
    if (dx * dx + dy * dy < reach * reach) return enemy;
  }
  return null;
}

/** True when an orb touches the warden. */
export function orbHitsPlayer(orb, player) {
  const dx = orb.x - player.x;
  const dy = orb.y - player.y;
  const reach = orb.radius + player.radius * 0.8;
  return dx * dx + dy * dy < reach * reach;
}

/** True when an enemy touches the warden. */
export function enemyTouchesPlayer(enemy, player) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const reach = enemy.radius + player.radius * 0.85;
  return dx * dx + dy * dy < reach * reach;
}
