// Sky Courier — the game loop and the screens. Title, play, pause, win and
// game over, plus the deterministic ?shot= scenes the maker screenshots.

import { MISSIONS, VIEW_H, VIEW_W } from './config.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { EVENT_BARREL, EVENT_CRASH, EVENT_LAND, EVENT_OVER, EVENT_RING, EVENT_WIN, World } from './world.js';
import {
  SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  drawEnd, drawHud, drawPause, drawTitle, drawWorld,
} from './render.js';
import { missionForShot, stageShot } from './shots.js';

const BEST_KEY = 'sky-courier-best-v1';
const STEP = 1 / 60;

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveBest(bests, missionId, score) {
  const s = Math.floor(score);
  if (s > (bests[missionId] ?? 0)) {
    bests[missionId] = s;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bests));
    } catch {
      // Private mode: the score still shows for this session.
    }
  }
  return bests[missionId] ?? 0;
}

export function startGame() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') ?? 7) || 7;

  const input = new Input();
  const sounds = new SoundBank();
  input.bindTouchButtons(document);

  const bests = loadBests();
  let missionIndex = 0;
  let world = new World(MISSIONS[missionIndex], seed);
  let screen = SCREEN_TITLE;
  let shotScreen = SCREEN_TITLE;
  let shotBest = 0;
  let t = 0;
  let acc = 0;
  let last = performance.now();
  let shownBest = 0;

  // A ?shot= URL stages one deterministic scene and draws it once: the frame
  // the maker screenshots is the game itself, played forward by its autopilot.
  if (shot) {
    document.body.classList.add('shot');
    const mission = missionForShot(shot);
    world = new World(mission, seed);
    const staged = stageShot(shot, world);
    shotScreen = staged.screen;
    shotBest = staged.best;
    screen = shotScreen;
    drawFrame(0);
    document.title = `Sky Courier — shot ${shot}`;
    return;
  }

  function drawFrame(now) {
    if (screen === SCREEN_TITLE) {
      drawTitle(ctx, world, now / 1000, missionIndex, bests);
    } else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) {
      drawWorld(ctx, world, now / 1000);
      drawHud(ctx, world, screen);
      if (screen === SCREEN_PAUSE) drawPause(ctx);
    } else {
      drawEnd(ctx, world, screen === SCREEN_WIN, shownBest);
    }
  }

  function pickMission(i) {
    missionIndex = i;
    world = new World(MISSIONS[i], seed);
    sounds.ensure();
  }

  function fly() {
    world = new World(MISSIONS[missionIndex], seed);
    screen = SCREEN_PLAY;
    sounds.ensure();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    input.update(dt);

    // Global keys.
    if (input.consume('m') || input.consume('M')) sounds.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (input.consume('1')) pickMission(0);
      if (input.consume('2')) pickMission(1);
      if (input.consume('3')) pickMission(2);
      if (input.consume('Enter') || input.consume(' ')) fly();
    } else if (screen === SCREEN_PLAY) {
      if (input.consume('p') || input.consume('P') || input.consume('Escape')) {
        screen = SCREEN_PAUSE;
      }
    } else if (screen === SCREEN_PAUSE) {
      if (input.consume('p') || input.consume('P') || input.consume('Escape')) screen = SCREEN_PLAY;
      if (input.consume('q') || input.consume('Q')) {
        world = new World(MISSIONS[missionIndex], seed);
        screen = SCREEN_TITLE;
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.consume('Enter') || input.consume(' ')) fly();
      if (input.consume('q') || input.consume('Q')) {
        world = new World(MISSIONS[missionIndex], seed);
        screen = SCREEN_TITLE;
      }
    }

    // Title-screen mission cards are clickable.
    if (screen === SCREEN_TITLE) {
      canvas.onclick = (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) * (VIEW_W / r.width);
        const y = (e.clientY - r.top) * (VIEW_H / r.height);
        if (y >= 220 && y <= 460) {
          const i = Math.floor((x - 140) / 340);
          if (i >= 0 && i < 3) {
            if (i === missionIndex) fly();
            else pickMission(i);
          }
        }
      };
    }

    if (screen === SCREEN_PLAY) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = world.step(STEP, input.pitch, input.throttle);
        if (events & EVENT_RING) sounds.ring();
        if (events & EVENT_BARREL) sounds.fuel();
        if (events & EVENT_LAND) sounds.land();
        if (events & EVENT_CRASH) sounds.crash();
        if (events & EVENT_WIN) {
          sounds.win();
          shownBest = saveBest(bests, world.mission.id, world.score);
          screen = SCREEN_WIN;
        } else if (events & EVENT_OVER) {
          shownBest = saveBest(bests, world.mission.id, world.score);
          screen = SCREEN_OVER;
        }
        if (world.fuel < 25 && Math.floor(t * 2) !== Math.floor((t - STEP) * 2)) sounds.warn();
      }
      sounds.update(input.throttle, world.speed, true);
    } else {
      sounds.update(0, 0, false);
    }

    drawFrame(now);
  }

  requestAnimationFrame(frame);
}

startGame();
