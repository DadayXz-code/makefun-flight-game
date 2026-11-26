// Keyboard and touch input for Sky Courier. The game reads a single object:
// pitch (-1 climb .. 1 dive), throttle (0..1), and one-shot actions.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pitch = 0; // -1 = pull up, +1 = push down
    this.throttle = 0.55;
    this.pressed = new Set(); // one-shot keys, consumed by the game loop
    this.touch = { up: false, down: false, fast: false, slow: false };
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _key(e, down) {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'];
    if (gameKeys.includes(e.key)) e.preventDefault();
    if (down && !e.repeat) this.pressed.add(e.key);
    if (down) this.keys.add(e.key);
    else this.keys.delete(e.key);
  }

  consume(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  // Recompute the analog state from keys and touch buttons. Call each frame.
  update(dt) {
    let pitch = 0;
    if (this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W') || this.touch.up) pitch -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S') || this.touch.down) pitch += 1;
    // Smooth the stick so the aircraft answers without jerking.
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 10);

    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D') || this.touch.fast) {
      this.throttle = Math.min(1, this.throttle + dt * 0.7);
    }
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A') || this.touch.slow) {
      this.throttle = Math.max(0, this.throttle - dt * 0.7);
    }
  }

  // Wire the on-screen touch buttons (shown on coarse pointers).
  bindTouchButtons(root) {
    const map = { up: 'up', down: 'down', fast: 'fast', slow: 'slow' };
    for (const [id, name] of Object.entries(map)) {
      const el = root.querySelector(`[data-touch="${id}"]`);
      if (!el) continue;
      const on = (e) => {
        e.preventDefault();
        this.touch[name] = true;
      };
      const off = (e) => {
        e.preventDefault();
        this.touch[name] = false;
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    }
  }
}
