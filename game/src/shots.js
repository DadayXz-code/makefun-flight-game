// The deterministic screenshot scenes behind ?shot=title|rings|storm|landing.
// Each one plays the real rules forward from a fresh world with a fixed seed,
// steered by a small autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { MISSIONS } from './config.js';
import { World } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;
const SAMPLE = 1 / 30;

/**
 * How far ahead, in seconds, the autopilot checks each way it could move: the
 * ring and landing scenes look well ahead and fly cleanly; the storm scene
 * looks only a moment ahead, so it is caught low among the storm cells.
 */
const HORIZON_CLEAN = 0.8;
const HORIZON_STORM = 0.3;

/** Seconds until the aircraft, pitched `pitch`, hits the ground or an obstacle. */
function timeToHit(world, pitch, horizon) {
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const speed = world.speed;
    const vy = pitch * (40 + (speed / 420) * 170);
    const y = world.y + vy * t;
    const x = world.x + speed * t;
    if (y + 16 >= world.groundY(x) - 12) return t;
    for (const item of world.items) {
      if (item.taken || item.kind === 'ring' || item.kind === 'barrel') continue;
      // Birds and storm cells drift: meet them where they will be, not
      // where they are.
      const ix = item.x + (item.vx ?? 0) * t;
      const iy = item.y + (item.vy ?? 0) * t;
      const dx = ix - x;
      const dy = iy - y;
      if (dx * dx + dy * dy < (item.r + 14) * (item.r + 14)) return t;
    }
  }
  return Infinity;
}

/** Steer toward the next ring (or a safe cruise height), dodging what is near. */
export function autopilot(world, horizon, cruiseAlt) {
  let target = world.groundY(world.x + 500) - cruiseAlt;
  let ring = null;
  for (const item of world.items) {
    if (item.kind === 'ring' && !item.taken && item.x > world.x) { ring = item; break; }
  }
  if (ring) target = ring.y;
  // Never aim below a safe height over the ground rising ahead: a ring low
  // over a valley is not worth a hillside.
  target = Math.min(target, world.groundY(world.x + 400) - 120);
  const dy = target - world.y;
  let wanted = dy < -24 ? -1 : dy > 24 ? 1 : 0;
  let best = wanted;
  let bestTime = timeToHit(world, wanted, horizon);
  for (const dir of [0, -1, 1]) {
    if (bestTime === Infinity) break;
    const time = timeToHit(world, dir, horizon);
    if (time > bestTime) {
      bestTime = time;
      best = dir;
    }
  }
  return best;
}

/**
 * Build the world for a shot name and return the screen to draw over it.
 * Unknown names fall back to the title scene.
 */
export function stageShot(name, world) {
  const mission = world.mission;
  world.reset();
  if (name === 'title') {
    // Parked on the home strip at dawn, engine idling.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, 0, 0.25);
    world.y = world.groundY(world.x) - 16;
    world.speed = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'landing') {
    // On final approach to runway one, riding a gentle glide slope down to
    // the threshold: proportional pitch, so the descent is smooth and the
    // aircraft is level over the numbers, not porpoising.
    world.x = mission.runways[0] - 700;
    world.y = 566 - 190;
    world.speed = 230;
    world.throttle = 0.42;
    const threshold = mission.runways[0];
    for (let i = 0; i < 5 / STEP; i += 1) {
      const ahead = threshold - world.x;
      const wantY = 566 - 16 - Math.max(0, ahead) * 0.18;
      const dy = wantY - world.y;
      let pitch = Math.max(-0.7, Math.min(0.7, dy / 80));
      if (timeToHit(world, pitch, 0.6) < 0.4) pitch = -0.7;
      world.step(STEP, pitch, 0.42);
      if (world.landed || world.crashed || world.won) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'storm') {
    // Low among the storm cells, rain on the windscreen, fuel low — but
    // flown with a proper look-ahead, so the frame shows a pilot threading
    // the weather, not a wreck.
    world.x = 5200;
    world.y = 566 - 320;
    world.speed = 330;
    world.throttle = 0.8;
    world.fuel = 34;
    for (let i = 0; i < 6 / STEP; i += 1) {
      world.step(STEP, autopilot(world, HORIZON_CLEAN, 300), 0.8);
      if (world.crashed || world.won) break;
    }
    return { screen: SCREEN_PLAY, best: world.score };
  }
  // 'rings' and anything else: mid-flight through the ring course, framed
  // while the next ring is still ahead of the aircraft.
  for (let i = 0; i < 12 / STEP; i += 1) {
    world.step(STEP, autopilot(world, HORIZON_CLEAN, 260), 0.72);
    if (world.crashed || world.won) break;
  }
  const over = world.crashed;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
}

// The four shots the maker takes, in the order they ship.
export const SHOT_LIST = [
  { name: '1-title.jpg', query: '?shot=title&seed=7' },
  { name: '2-rings.jpg', query: '?shot=rings&seed=7' },
  { name: '3-storm.jpg', query: '?shot=storm&seed=7' },
  { name: '4-landing.jpg', query: '?shot=landing&seed=7' },
];

export function missionForShot(name) {
  if (name === 'landing') return MISSIONS[1];
  if (name === 'storm') return MISSIONS[2];
  return MISSIONS[0];
}
