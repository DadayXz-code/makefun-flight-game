// Procedural sound for Sky Courier: no audio files, everything is made with
// the Web Audio API. The engine is a sawtooth hum whose pitch follows the
// throttle, the wind is filtered noise, and the events are short blips.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.started = false;
  }

  // Browsers only let audio start after a gesture; call from a key or click.
  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.started = true;
      this._buildEngine();
    } catch {
      this.ctx = null;
    }
  }

  _buildEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 62;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();

    // Wind: a looped noise buffer through a band-pass filter.
    const len = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    noise.connect(band);
    band.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    noise.start();
  }

  // Called every frame while flying: throttle 0..1, speed in px/s.
  update(throttle, speed, flying) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const on = flying && !this.muted;
    this.engineOsc.frequency.setTargetAtTime(58 + throttle * 66, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.028 + throttle * 0.05 : 0.0, t, 0.1);
    this.windGain.gain.setTargetAtTime(on ? Math.min(0.06, speed / 9000) : 0.0, t, 0.15);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.04, t, 0.05);
      if (this.windGain) this.windGain.gain.setTargetAtTime(this.muted ? 0 : 0.02, t, 0.05);
    }
    return this.muted;
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this._tone(880, 0.14, 'sine', 0.16);
    this._tone(1318, 0.2, 'sine', 0.12, 0.07);
  }

  fuel() {
    this._tone(520, 0.1, 'triangle', 0.14);
    this._tone(780, 0.16, 'triangle', 0.12, 0.06);
  }

  land() {
    this._tone(392, 0.16, 'sine', 0.16);
    this._tone(523, 0.16, 'sine', 0.16, 0.12);
    this._tone(659, 0.3, 'sine', 0.16, 0.24);
  }

  warn() {
    this._tone(220, 0.12, 'square', 0.05);
    this._tone(220, 0.12, 'square', 0.05, 0.16);
  }

  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    this._tone(140, 0.5, 'sawtooth', 0.12, 0, 40);
  }

  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.15, i * 0.13));
  }
}
