// A tiny seeded random generator (mulberry32) so the world, the screenshot
// scenes and the autopilot are exactly repeatable from one seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A deterministic 1-D value-noise field: smooth hills from a seed.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const grid = [];
  for (let i = 0; i < 256; i += 1) grid.push(rand() * 2 - 1);
  const smooth = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = grid[((i % 256) + 256) % 256];
    const b = grid[(((i + 1) % 256) + 256) % 256];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
  return (x) => smooth(x * 0.5) * 0.6 + smooth(x * 0.13) * 0.4;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Distance between two points, in world pixels.
export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
