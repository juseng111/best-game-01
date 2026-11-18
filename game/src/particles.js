// Sparks, rings, floating score text and screen shake: the feedback on every
// action. Particles are plain objects in one list, updated and drawn each frame.

export function createParticles() {
  const list = [];
  let trauma = 0;

  function add(particle) {
    if (list.length < 400) list.push(particle);
  }

  return {
    get list() {
      return list;
    },
    /** A burst of coloured sparks at (x, y). */
    burst(x, y, color, count = 10, speed = 220) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = speed * (0.3 + Math.random() * 0.7);
        add({
          kind: 'spark',
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 0.45 + Math.random() * 0.25,
          age: 0,
          color,
          size: 2 + Math.random() * 2.5,
        });
      }
    },
    /** An expanding ring, for novas and kills. */
    ring(x, y, color, maxRadius = 90) {
      add({ kind: 'ring', x, y, life: 0.5, age: 0, color, size: maxRadius });
    },
    /** A short-lived label that rises and fades. */
    text(x, y, label, color = '#f4f1ff') {
      add({ kind: 'text', x, y, vx: 0, vy: -46, life: 0.9, age: 0, color, size: 15, label });
    },
    /** Drifting motes that keep the reef alive between fights. */
    mote(x, y, color) {
      add({
        kind: 'mote',
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 14,
        life: 2.5 + Math.random() * 2,
        age: 0,
        color,
        size: 1.5 + Math.random() * 2,
      });
    },
    /** Add shake; 1 is the most the screen ever shakes. */
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    get shakeOffset() {
      const strength = trauma * trauma * 14;
      return {
        x: (Math.random() * 2 - 1) * strength,
        y: (Math.random() * 2 - 1) * strength,
      };
    },
    update(dt) {
      trauma = Math.max(0, trauma - dt * 1.6);
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        if (p.vx !== undefined) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 1 - 2.4 * dt;
          p.vy *= 1 - 2.4 * dt;
        }
      }
    },
    draw(ctx) {
      for (const p of list) {
        const left = 1 - p.age / p.life;
        if (p.kind === 'spark' || p.kind === 'mote') {
          ctx.globalAlpha = left;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + left * 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'ring') {
          ctx.globalAlpha = left * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (p.age / p.life), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'text') {
          ctx.globalAlpha = left;
          ctx.fillStyle = p.color;
          ctx.font = `bold ${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.label, p.x, p.y);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
