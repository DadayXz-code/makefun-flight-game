// Sky Courier — shared constants and the three mission definitions.
// All distances are in world pixels (1 px = 1 m for the HUD), speeds in px/s.
// The HUD converts them: knots = px/s * 0.55, feet = metres * 3.28.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The aircraft sits at this screen x; the world scrolls past it.
export const PLANE_SCREEN_X = 380;
export const PLANE_RADIUS = 16;

// Flight model.
export const MIN_SPEED = 120; // px/s, below this the wing stops flying
export const MAX_SPEED = 420; // px/s at full throttle
export const STALL_SPEED = 165; // px/s, below this the nose drops
export const SINK_RATE = 55; // px/s the aircraft sinks while stalled
export const MAX_CLIMB = 210; // px/s of climb at full speed and full pull
export const MAX_DIVE = 260; // px/s of dive at full push
export const CEILING = 560; // metres above the ground, the sky's roof
export const GROUND_CLEAR = 12; // px the wheels may sink before it counts as ground

// Fuel: units per second at idle and at full throttle.
export const FUEL_DRAIN_IDLE = 0.32;
export const FUEL_DRAIN_FULL = 0.95;
export const FUEL_BARREL = 35; // fuel a floating barrel restores

// Scoring.
export const RING_POINTS = 100;
export const BARREL_POINTS = 50;
export const LANDING_POINTS = 500;
export const LANDING_BONUS_MAX = 250; // extra for a gentle touchdown
export const DISTANCE_POINTS_PER_M = 0.05;

// The three missions. Each one is a different job for the same aircraft.
export const MISSIONS = [
  {
    id: 'rings',
    index: 0,
    name: 'Ring Run',
    tagline: 'Thread 12 golden rings over the valley',
    goal: 'Fly through 12 rings',
    rings: 12,
    runways: [],
    distance: 9000,
    timeLimit: 0,
    fuel: 100,
    lives: 3,
    obstacles: ['balloon', 'bird'],
    barrels: true,
    colour: '#f5b301',
  },
  {
    id: 'islands',
    index: 1,
    name: 'Island Hop',
    tagline: 'Land gently on three island strips',
    goal: 'Land on 3 runways',
    rings: 4,
    runways: [2400, 5600, 9200],
    distance: 10800,
    timeLimit: 0,
    fuel: 100,
    lives: 3,
    obstacles: ['bird'],
    barrels: true,
    colour: '#2fae5f',
  },
  {
    id: 'storm',
    index: 2,
    name: 'Storm Courier',
    tagline: 'Outrun the storm to Skyport airfield',
    goal: 'Reach Skyport in 100 seconds',
    rings: 6,
    runways: [12500],
    distance: 12500,
    timeLimit: 100,
    fuel: 100,
    lives: 3,
    obstacles: ['storm', 'balloon', 'bird'],
    barrels: true,
    colour: '#e4572e',
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

// Keyboard layout, shown on the title screen and the pause screen.
export const CONTROLS = [
  ['Up / W', 'Climb'],
  ['Down / S', 'Descend'],
  ['Right / D', 'More throttle'],
  ['Left / A', 'Less throttle'],
  ['P or Esc', 'Pause'],
  ['M', 'Mute sound'],
  ['1 / 2 / 3', 'Pick a mission'],
  ['Enter', 'Fly the selected mission'],
];
