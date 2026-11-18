// The painter: the reef floor, the warden, the shadow creatures, the bolts and
// gems, the particles, the banner and the damage flash. The menus and the HUD
// are DOM; this file only paints the canvas. The logical field is 1280x800 and
// the canvas letterboxes into whatever window it gets.

import { ENEMIES, FIELD, FONT, PALETTE } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = canvas.clientWidth || FIELD.width;
    const cssHeight = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    scale = Math.min(cssWidth / FIELD.width, cssHeight / FIELD.height);
    offsetX = (cssWidth - FIELD.width * scale) / 2;
    offsetY = (cssHeight - FIELD.height * scale) / 2;
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  function drawBlob(x, y, radius, body, dark, wobble) {
    ctx.fillStyle = body;
    ctx.beginPath();
    const points = 10;
    for (let i = 0; i <= points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius * (1 + Math.sin(angle * 3 + wobble) * 0.08);
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEyes(x, y, radius, angle, eyeColor, flash) {
    const ex = Math.cos(angle) * radius * 0.34;
    const ey = Math.sin(angle) * radius * 0.34;
    const px = -Math.sin(angle) * radius * 0.38;
    const py = Math.cos(angle) * radius * 0.38;
    ctx.fillStyle = flash > 0 ? '#ffffff' : eyeColor;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + ex + px * side, y + ey + py * side, Math.max(2, radius * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemy(enemy, player) {
    const def = ENEMIES[enemy.kind];
    // Eyes track the warden.
    const look = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + enemy.radius * 0.7, enemy.radius * 0.9, enemy.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (enemy.kind === 'splitter') {
      drawBlob(enemy.x - enemy.radius * 0.45, enemy.y, enemy.radius * 0.7, def.body, def.dark, enemy.wobble);
      drawBlob(enemy.x + enemy.radius * 0.45, enemy.y, enemy.radius * 0.7, def.body, def.dark, enemy.wobble + 1.5);
    } else {
      drawBlob(enemy.x, enemy.y, enemy.radius, def.body, def.dark, enemy.wobble);
    }
    if (enemy.kind === 'bulwark') {
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + enemy.wobble * 0.2;
        ctx.beginPath();
        ctx.moveTo(enemy.x + Math.cos(a) * enemy.radius * 0.9, enemy.y + Math.sin(a) * enemy.radius * 0.9);
        ctx.lineTo(enemy.x + Math.cos(a) * enemy.radius * 1.25, enemy.y + Math.sin(a) * enemy.radius * 1.25);
        ctx.stroke();
      }
    }
    const toPlayer = look;
    drawEyes(enemy.x, enemy.y, enemy.radius, toPlayer, def.eye, enemy.flash);
    if (enemy.kind === 'spitter') {
      ctx.fillStyle = '#1e0a3c';
      ctx.beginPath();
      ctx.arc(enemy.x + Math.cos(look) * enemy.radius * 0.45, enemy.y + Math.sin(look) * enemy.radius * 0.45, enemy.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.flash > 0) {
      ctx.globalAlpha = enemy.flash * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 1.8;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width, 4);
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#f87171';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width * ratio, 4);
    }
  }

  function drawPlayer(player, time, aim) {
    const blink = time < player.invulnerableUntil && Math.floor(time * 14) % 2 === 0;
    // Glow.
    const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 90);
    glow.addColorStop(0, 'rgba(126, 240, 212, 0.5)');
    glow.addColorStop(1, 'rgba(126, 240, 212, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 90, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    // Cloak: a teal hood pointing where the warden aims.
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -14);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    // The lantern, held ahead.
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(20, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(20, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shields as small cyan arcs.
    for (let i = 0; i < player.shield; i += 1) {
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 8, -Math.PI / 2 + i * 1.1, -Math.PI / 2 + i * 1.1 + 0.8);
      ctx.stroke();
    }

    // Aim reticle at the mouse.
    if (aim && aim.seen) {
      ctx.strokeStyle = 'rgba(244, 241, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(aim.x - 13, aim.y);
      ctx.lineTo(aim.x - 5, aim.y);
      ctx.moveTo(aim.x + 5, aim.y);
      ctx.lineTo(aim.x + 13, aim.y);
      ctx.moveTo(aim.x, aim.y - 13);
      ctx.lineTo(aim.x, aim.y - 5);
      ctx.moveTo(aim.x, aim.y + 5);
      ctx.lineTo(aim.x, aim.y + 13);
      ctx.stroke();
    }
    void time;
  }

  function draw(state, screen, aim) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.particles.shakeOffset;
    ctx.save();
    ctx.translate(offsetX * dpr + shake.x * scale * dpr, offsetY * dpr + shake.y * scale * dpr);
    ctx.scale(scale * dpr, scale * dpr);

    ctx.drawImage(state.reef, 0, 0);

    // Gems.
    for (const gem of state.gems) {
      const pulse = 1 + Math.sin(gem.age) * 0.15;
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.gem;
      ctx.fillRect(-5 * pulse, -5 * pulse, 10 * pulse, 10 * pulse);
      ctx.fillStyle = PALETTE.gemCore;
      ctx.fillRect(-2.5 * pulse, -2.5 * pulse, 5 * pulse, 5 * pulse);
      ctx.restore();
    }

    // Enemies, then bolts, then orbs, then the warden on top.
    for (const enemy of state.enemies) drawEnemy(enemy, state.player);
    for (const bullet of state.bullets) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bolt;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const orb of state.orbs) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.4)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.orb;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlayer(state.player, state.time, screen === 'play' ? aim : null);

    state.particles.draw(ctx);

    // Wave banner, fading out over its last half second.
    if (state.banner && state.time < state.banner.until) {
      ctx.globalAlpha = Math.min(1, (state.banner.until - state.time) * 2);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(45, 212, 191, 0.8)';
      ctx.shadowBlur = 18;
      ctx.fillText(state.banner.text, FIELD.width / 2, 120);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Vignette.
    const vignette = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vignette.addColorStop(0, 'rgba(5, 2, 14, 0)');
    vignette.addColorStop(1, 'rgba(5, 2, 14, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Damage flash and low-health heartbeat.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(244, 63, 94, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    const hpRatio = state.player.hp / state.player.maxHp;
    if (screen === 'play' && hpRatio < 0.3 && hpRatio > 0) {
      const pulse = 0.10 + 0.08 * Math.sin(state.time * 6);
      ctx.strokeStyle = `rgba(244, 63, 94, ${pulse + 0.12})`;
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, FIELD.width, FIELD.height);
    }

    // Dim the field behind the menus so their text reads.
    if (screen !== 'play') {
      ctx.fillStyle = 'rgba(8, 4, 20, 0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.restore();
  }

  return { draw, resize, toLogical };
}
