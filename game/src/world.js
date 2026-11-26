// The world of Sky Courier: rolling terrain with runways and lakes, rings to
// fly through, balloons, birds, storm cells and fuel barrels, plus the flight
// model itself. Everything is deterministic from the mission and the seed.

import {
  BARREL_POINTS, CEILING, DISTANCE_POINTS_PER_M, FUEL_BARREL, FUEL_DRAIN_FULL,
  FUEL_DRAIN_IDLE, GROUND_CLEAR, LANDING_BONUS_MAX, LANDING_POINTS, MAX_CLIMB,
  MAX_DIVE, MAX_SPEED, MIN_SPEED, PLANE_RADIUS, RING_POINTS, SINK_RATE,
  STALL_SPEED, VIEW_W,
} from './config.js';
import { clamp, dist, lerp, makeNoise, mulberry32 } from './random.js';

export const EVENT_RING = 1;
export const EVENT_BARREL = 2;
export const EVENT_LAND = 4;
export const EVENT_CRASH = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;

const SPAWN_EVERY = 420; // px between spawned set pieces
const RUNWAY_LEN = 620; // px of flat strip
const RUNWAY_Y = 566; // world y of every runway surface

// A ring the pilot must fly through, a barrel to refuel with, or an
// obstacle to dodge: balloon, bird flock or storm cell.
function makeRing(x, y) {
  return { kind: 'ring', x, y, r: 48, taken: false };
}
function makeBarrel(x, y) {
  return { kind: 'barrel', x, y, r: 26, taken: false };
}
function makeBalloon(x, y, rand) {
  return { kind: 'balloon', x, y, r: 34, vy: -6 - rand() * 8, phase: rand() * 6.28 };
}
function makeBird(x, y, rand) {
  return { kind: 'bird', x, y, r: 18, vx: -70 - rand() * 60, phase: rand() * 6.28 };
}
function makeStorm(x, y, rand) {
  return { kind: 'storm', x, y, r: 74, vx: -12 - rand() * 14, flash: rand() * 4, lit: 0 };
}

export class World {
  constructor(mission, seed = 7) {
    this.mission = mission;
    this.seed = seed;
    this.rand = mulberry32(seed * 7919 + mission.index * 131);
    this.noise = makeNoise(seed * 31 + mission.index * 7);
    this.reset();
  }

  reset() {
    this.rand = mulberry32(this.seed * 7919 + this.mission.index * 131);
    this.x = 0; // nose position, world px
    this.y = RUNWAY_Y - PLANE_RADIUS; // parked on the home strip
    this.speed = 0;
    this.throttle = 0.55;
    this.pitch = 0;
    this.vy = 0;
    this.fuel = this.mission.fuel;
    this.lives = this.mission.lives;
    this.score = 0;
    this.ringsGot = 0;
    this.landings = 0;
    this.timeLeft = this.mission.timeLimit;
    this.elapsed = 0;
    this.distanceBest = 0;
    this.invuln = 0; // seconds of grace after a crash respawn
    this.landed = true; // wheels down on the home strip right now
    this.message = '';
    this.messageT = 0;
    this.crashed = false;
    this.won = false;
    this.spawnedTo = 0;
    this.items = [];
    this.checkpoint = { x: 0, y: RUNWAY_Y - PLANE_RADIUS, fuel: this.mission.fuel };
    this._spawnAhead(2600);
  }

  // The ground's world y at world x: rolling hills, flattened at runways,
  // dipped into lakes between the hills. Every mission starts on the home
  // strip, a flat runway from x -300 to x 500.
  groundY(x) {
    const hills = 566
      + this.noise(x * 0.0016) * 46
      + this.noise(x * 0.0007 + 40) * 60;
    let y = hills;
    const flats = [[-300, 500]];
    for (const rx of this.mission.runways) flats.push([rx, rx + RUNWAY_LEN]);
    for (const [from, to] of flats) {
      const centre = (from + to) / 2;
      const half = (to - from) / 2;
      const d = Math.abs(x - centre);
      if (d < half + 220) {
        const t = clamp(1 - (d - half) / 220, 0, 1);
        const e = t * t * (3 - 2 * t);
        y = lerp(y, RUNWAY_Y, e);
      }
    }
    // A lake sits in the valley: flat blue water the aircraft must not touch.
    const lakeX = 3400 + this.mission.index * 1800;
    if (x > lakeX && x < lakeX + 900) y = Math.max(y, 596);
    return y;
  }

  runwayAt(x) {
    if (x >= -300 && x <= 500) return { x: -300, y: RUNWAY_Y, home: true };
    for (const rx of this.mission.runways) {
      if (x >= rx && x <= rx + RUNWAY_LEN) return { x: rx, y: RUNWAY_Y };
    }
    return null;
  }

  altitudeM() {
    return Math.max(0, (this.groundY(this.x) - this.y) * 0.9);
  }

  speedKts() {
    return Math.round(this.speed * 0.55);
  }

  headingDeg() {
    // Eastbound flight: 090, eased a few degrees by climb and dive.
    return Math.round(90 - this.pitch * 14);
  }

  // Spawn set pieces up to world x `to`, following the mission's table.
  _spawnAhead(to) {
    while (this.spawnedTo < to) {
      this.spawnedTo += SPAWN_EVERY;
      const x = this.spawnedTo;
      const r = this.rand;
      const gy = this.groundY(x);
      const m = this.mission;
      // Rings lead the pilot along a gentle up-and-down path.
      if (m.rings > 0 && this.items.filter((i) => i.kind === 'ring').length + this.ringsGot < m.rings) {
        if (r() < 0.75) {
          const y = gy - 150 - r() * 260;
          this.items.push(makeRing(x, clamp(y, 140, gy - 120)));
        }
      }
      if (m.barrels && r() < 0.3) {
        this.items.push(makeBarrel(x + 120, gy - 130 - r() * 240));
      }
      for (const kind of m.obstacles) {
        if (kind === 'balloon' && r() < 0.3) this.items.push(makeBalloon(x + 200, gy - 180 - r() * 260, r));
        if (kind === 'bird' && r() < 0.34) this.items.push(makeBird(x + 260, gy - 160 - r() * 300, r));
        if (kind === 'storm' && r() < 0.55) this.items.push(makeStorm(x + 240, 200 + r() * 260, r));
      }
    }
  }

  _say(text, seconds = 2.2) {
    this.message = text;
    this.messageT = seconds;
  }

  _respawn() {
    this.x = this.checkpoint.x;
    this.y = this.checkpoint.y;
    this.speed = 220; // back in the air at flying speed, not stalled on the ground
    this.vy = 0;
    this.fuel = Math.max(55, this.checkpoint.fuel);
    this.invuln = 3;
    this.landed = false;
  }

  // One fixed step. `pitch` is -1..1 (pull up .. push down), `throttle` 0..1.
  // Returns a bitmask of EVENT_* for the frame.
  step(dt, pitch, throttle) {
    if (this.crashed || this.won) return 0;
    let events = 0;
    this.elapsed += dt;
    this.throttle = throttle;
    this.pitch += (pitch - this.pitch) * Math.min(1, dt * 8);
    if (this.messageT > 0) this.messageT -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    // Throttle sets the target speed; the aircraft eases toward it.
    const target = MIN_SPEED + throttle * (MAX_SPEED - MIN_SPEED);
    this.speed += (target - this.speed) * Math.min(1, dt * 0.9);
    this.x += this.speed * dt;

    // Pitch sets the climb rate, scaled by how fast the wing is flying.
    // Pitch -1 pulls up (climb, vy negative), +1 pushes down (dive).
    const climbPower = clamp(this.speed / MAX_SPEED, 0, 1);
    const rate = this.pitch < 0 ? MAX_CLIMB - 40 : MAX_DIVE - 40;
    let vy = this.pitch * (40 + climbPower * rate);
    if (this.speed < STALL_SPEED && this.y > this.groundY(this.x) - 200) {
      vy += SINK_RATE; // stalled: the nose drops
    }
    this.vy += (vy - this.vy) * Math.min(1, dt * 6);
    this.y += this.vy * dt;
    this.y = Math.min(this.y, this.groundY(this.x) - 8);
    const alt = this.altitudeM();
    if (alt > CEILING) {
      this.y = this.groundY(this.x) - CEILING / 0.9;
      this.vy = Math.min(this.vy, 0);
    }

    // Fuel burns with the throttle; empty tanks mean a glide to the ground.
    this.fuel -= (FUEL_DRAIN_IDLE + throttle * (FUEL_DRAIN_FULL - FUEL_DRAIN_IDLE)) * dt;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.throttle = 0;
      if (this.speed > MIN_SPEED) this.speed -= 60 * dt;
    }

    // The clock only runs on the courier mission.
    if (this.mission.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.lives = 1; // out of time ends the sortie at once, not life by life
        return this._end(false, events, 'Out of time — the storm won.');
      }
    }

    // Distance points tick up as new ground is covered.
    if (this.x > this.distanceBest) {
      this.score += (this.x - this.distanceBest) * DISTANCE_POINTS_PER_M;
      this.distanceBest = this.x;
    }

    this._spawnAhead(this.x + VIEW_W * 2);
    events |= this._updateItems(dt);

    // Ground contact: a landing, a takeoff roll, or a crash.
    const gy = this.groundY(this.x);
    const runway = this.runwayAt(this.x);
    const onGround = this.y + PLANE_RADIUS >= gy - GROUND_CLEAR;
    if (onGround) {
      const gentle = Math.abs(this.vy) < 95 && this.speed >= 110 && this.speed <= 280;
      if (runway && gentle && this.invuln <= 0 && !runway.home) {
        if (!this.landed) {
          this.landed = true;
          events |= this._land(runway);
        }
        this.y = runway.y - PLANE_RADIUS;
        this.vy = 0;
        // Rolling: keep a little speed, brakes bite gently.
        this.speed = Math.max(0, this.speed - 26 * dt);
      } else if (runway && this.speed < 280 && Math.abs(this.vy) < 120 && this.pitch >= -0.2) {
        // Rolling along a strip: the takeoff roll, a taxi, or a touchdown
        // on the home strip, which scores nothing.
        this.landed = true;
        this.y = runway.y - PLANE_RADIUS;
        this.vy = Math.min(this.vy, 0);
      } else if (!this.landed) {
        return this._end(false, events | EVENT_CRASH, this._crashText(runway, gy));
      }
    } else {
      this.landed = false;
    }

    // Reaching the far airfield ends the courier mission. The island hop
    // is won only by landing on all three strips: flying past the last
    // island without landing ends the sortie.
    if (this.mission.id === 'storm' && this.x >= this.mission.distance) {
      return this._end(true, events, 'Destination reached!');
    }
    if (this.mission.id === 'islands') {
      const last = this.mission.runways[this.mission.runways.length - 1] + RUNWAY_LEN;
      if (this.x > last + 1200 && this.landings < this.mission.runways.length) {
        this.lives = 1;
        return this._end(false, events, 'Flew past the last island strip.');
      }
    }
    if (this.mission.id === 'rings' && this.ringsGot >= this.mission.rings) {
      return this._end(true, events, 'All rings threaded!');
    }
    return events;
  }

  _crashText(runway, gy) {
    if (this.fuel <= 0) return 'Out of fuel — ditched short of the strip.';
    if (this.y > gy - 40 && this.speed > 300) return 'Too fast for the ground — airframe lost.';
    return 'Crashed into the hillside.';
  }

  _land(runway) {
    const quality = clamp(1 - Math.abs(this.vy) / 95, 0, 1);
    const bonus = Math.round(LANDING_BONUS_MAX * quality);
    this.score += LANDING_POINTS + bonus;
    this.landings += 1;
    this.checkpoint = { x: this.x, y: runway.y - PLANE_RADIUS, fuel: this.fuel };
    this._say(`Touchdown! +${LANDING_POINTS + bonus} pts — runway ${this.landings} of ${this.mission.runways.length}`);
    if (this.landings >= this.mission.runways.length && this.mission.runways.length > 0) {
      this.won = true;
      return EVENT_LAND | EVENT_WIN;
    }
    return EVENT_LAND;
  }

  _updateItems(dt) {
    let events = 0;
    const px = this.x;
    const py = this.y;
    for (const item of this.items) {
      if (item.taken) continue;
      if (item.x < px - 500 || item.x > px + VIEW_W + 800) continue;
      if (item.kind === 'balloon') {
        item.y += item.vy * dt;
        item.x += Math.sin(this.elapsed * 0.5 + item.phase) * 6 * dt;
      }
      if (item.kind === 'bird') {
        item.x += item.vx * dt;
        item.y += Math.sin(this.elapsed * 6 + item.phase) * 22 * dt;
      }
      if (item.kind === 'storm') {
        item.x += item.vx * dt;
        item.flash -= dt;
        if (item.flash <= -3 - Math.random() * 2) item.flash = 0.4;
        item.lit = item.flash > 0 ? 1 : 0;
      }
      const d = dist(px, py, item.x, item.y);
      if (item.kind === 'ring' && d < item.r + PLANE_RADIUS * 0.7) {
        item.taken = true;
        this.ringsGot += 1;
        this.score += RING_POINTS;
        this.checkpoint = { x: this.x, y: this.y, fuel: this.fuel };
        this._say(`Ring ${this.ringsGot} of ${this.mission.rings}! +${RING_POINTS}`);
        events |= EVENT_RING;
      } else if (item.kind === 'barrel' && d < item.r + PLANE_RADIUS) {
        item.taken = true;
        this.fuel = Math.min(100, this.fuel + FUEL_BARREL);
        this.score += BARREL_POINTS;
        this._say(`Fuel +${FUEL_BARREL} — tank topped up`);
        events |= EVENT_BARREL;
      } else if ((item.kind === 'balloon' || item.kind === 'bird' || item.kind === 'storm')
        && d < item.r + PLANE_RADIUS - 4 && this.invuln <= 0) {
        return this._end(false, events | EVENT_CRASH, this._hitText(item.kind));
      }
    }
    // Drop what is far behind.
    this.items = this.items.filter((i) => i.x > px - 600);
    return events;
  }

  _hitText(kind) {
    if (kind === 'storm') return 'Flew into a storm cell — lightning struck the wing.';
    if (kind === 'balloon') return 'Clipped a hot-air balloon over the valley.';
    return 'A bird flock took out the engine intake.';
  }

  _end(won, events, text) {
    if (won) {
      this.won = true;
      if (this.mission.timeLimit > 0) this.score += Math.round(this.timeLeft) * 10;
      this._say(text);
      return events | EVENT_WIN;
    }
    this.lives -= 1;
    this._say(text);
    if (this.lives <= 0) {
      this.crashed = true;
      return events | EVENT_CRASH | EVENT_OVER;
    }
    this._respawn();
    return events | EVENT_CRASH;
  }
}
