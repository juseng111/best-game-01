// Keyboard and mouse, read as one input snapshot each frame. WASD or the arrow
// keys move; the mouse aims and holding it (or Space) fires. P or Escape pauses,
// Enter or Space confirms, 1/2/3 pick a level-up card, M mutes.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {(clientX: number, clientY: number) => {x: number, y: number}} toLogical
 *   Maps a mouse position in client pixels to the game's logical field; when
 *   omitted the mouse is read in canvas pixels.
 */
export function createInput(canvas, toLogical) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;
  let mouseDown = false;
  let queued = 0;
  let pick = 0;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
    if (event.code === 'Digit1') pick = 1;
    if (event.code === 'Digit2') pick = 2;
    if (event.code === 'Digit3') pick = 3;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function mouseMove(event) {
    if (toLogical) {
      const at = toLogical(event.clientX, event.clientY);
      mouseX = at.x;
      mouseY = at.y;
    } else {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
      mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    }
    mouseSeen = true;
  }

  function mouseDownHandler(event) {
    mouseMove(event);
    mouseDown = true;
  }

  function mouseUpHandler() {
    mouseDown = false;
  }

  function blur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownHandler);
  window.addEventListener('mouseup', mouseUpHandler);

  return {
    /** -1, 0 or 1 on each axis, normalised when read. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const scale = 1 / Math.SQRT2;
        x *= scale;
        y *= scale;
      }
      return { x, y };
    },
    get firing() {
      return mouseDown || keys.has('Space');
    },
    get mouse() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** One-shot actions since the last call (confirm, pause, mute). */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** One-shot level-up pick (1, 2 or 3) since the last call. */
    takePick() {
      const value = pick;
      pick = 0;
      return value;
    },
  };
}
