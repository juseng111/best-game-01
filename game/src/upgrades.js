// Level-up choices: roll three upgrades the warden has not maxed out, and apply
// the one the player picks. Each upgrade stacks up to its max level.

import { UPGRADES } from './config.js';

/** Three distinct upgrades the player can still take, in random order. */
export function rollChoices(rng, owned) {
  const open = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max);
  const pool = open.length > 0 ? open : UPGRADES;
  const picks = [];
  const bag = [...pool];
  while (picks.length < 3 && bag.length > 0) {
    const index = rng.int(0, bag.length - 1);
    picks.push(bag.splice(index, 1)[0]);
  }
  return picks;
}

/** Apply one upgrade level to the player. */
export function applyUpgrade(player, upgrade) {
  const level = (player.upgrades[upgrade.id] ?? 0) + 1;
  player.upgrades[upgrade.id] = level;
  switch (upgrade.id) {
    case 'bright':
      player.bulletDamage *= 1.25;
      break;
    case 'rapid':
      player.fireInterval *= 0.85;
      break;
    case 'swift':
      player.speed *= 1.12;
      break;
    case 'heart':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'aegis':
      player.shieldMax += 1;
      player.shield += 1;
      break;
    case 'nova':
      player.novaLevel = level;
      player.novaTimer = Math.min(player.novaTimer, 2);
      break;
    default:
      break;
  }
  return level;
}

/** A short label for the card, e.g. "Lv 2". */
export function levelLabel(player, upgrade) {
  return `Lv ${(player.upgrades[upgrade.id] ?? 0) + 1}`;
}
