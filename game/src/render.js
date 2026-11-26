// All drawing for Sky Courier: sky, sun, clouds, parallax hills, terrain with
// trees and houses, runways and lakes, the aircraft, rings, balloons, birds,
// storm cells, fuel barrels, the HUD instruments and every screen.

import { MISSIONS, VIEW_H, VIEW_W } from './config.js';
import { clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const SKY_TOP = '#7ec8f7';
const SKY_MID = '#bfe6fb';
const SKY_LOW = '#ffe9b8';

function skyGradient(ctx, alt) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  const high = clamp(alt / 500, 0, 1);
  g.addColorStop(0, high > 0.5 ? '#3f7fd0' : SKY_TOP);
  g.addColorStop(0.55, SKY_MID);
  g.addColorStop(1, SKY_LOW);
  return g;
}

function drawSun(ctx, t) {
  const x = VIEW_W - 190;
  const y = 96 + Math.sin(t * 0.05) * 6;
  const g = ctx.createRadialGradient(x, y, 8, x, y, 90);
  g.addColorStop(0, 'rgba(255, 244, 180, 0.95)');
  g.addColorStop(0.35, 'rgba(255, 214, 90, 0.55)');
  g.addColorStop(1, 'rgba(255, 214, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 95, y - 95, 190, 190);
  ctx.fillStyle = '#ffdf6b';
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx, x, y, s, alpha) {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 52 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 34 * s, y + 6 * s, 34 * s, 15 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 36 * s, y + 7 * s, 36 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(ctx, camX, camY, colour, factor, baseY, amp) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-4, VIEW_H + 4);
  for (let sx = -4; sx <= VIEW_W + 16; sx += 16) {
    const wx = camX * factor + sx;
    const y = baseY + Math.sin(wx * 0.0011 + factor * 9) * amp
      + Math.sin(wx * 0.00031 + factor * 4) * amp * 1.6 - camY * factor;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIEW_W + 4, VIEW_H + 4);
  ctx.closePath();
  ctx.fill();
}

function drawTree(ctx, x, y, s) {
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s);
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.moveTo(x, y - 34 * s);
  ctx.lineTo(x - 12 * s, y - 8 * s);
  ctx.lineTo(x + 12 * s, y - 8 * s);
  ctx.closePath();
  ctx.fill();
}

function drawHouse(ctx, x, y, s) {
  ctx.fillStyle = '#f5e6c8';
  ctx.fillRect(x - 14 * s, y - 16 * s, 28 * s, 16 * s);
  ctx.fillStyle = '#b3402e';
  ctx.beginPath();
  ctx.moveTo(x - 17 * s, y - 16 * s);
  ctx.lineTo(x, y - 28 * s);
  ctx.lineTo(x + 17 * s, y - 16 * s);
  ctx.closePath();
  ctx.fill();
}

function drawRunway(ctx, x, y, len, label) {
  ctx.fillStyle = '#5a5f66';
  ctx.fillRect(x, y - 4, len, 10);
  ctx.fillStyle = '#f8f8f8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 14, y - 12);
  ctx.fillStyle = '#ffd94d';
  for (let i = 0; i < 8; i += 1) {
    ctx.fillRect(x + 40 + i * (len - 80) / 7, y - 1, 26, 4);
  }
}

// The aircraft, drawn side-on, nose to the right, pitched by climb and dive.
function drawPlane(ctx, x, y, pitch, t, throttle, invuln) {
  ctx.save();
  ctx.translate(x, y);
  if (invuln > 0 && Math.floor(t * 8) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.rotate(clamp(-pitch * 0.45, -0.5, 0.5));
  // Propeller blur.
  const prop = Math.sin(t * (20 + throttle * 40));
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(34, 0, 4, 22 + prop * 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Tail.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-30, -2);
  ctx.lineTo(-44, -20);
  ctx.lineTo(-36, -20);
  ctx.lineTo(-22, -4);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  const body = ctx.createLinearGradient(0, -12, 0, 10);
  body.addColorStop(0, '#fdfdfd');
  body.addColorStop(0.55, '#e8eef4');
  body.addColorStop(1, '#b9c6d2');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-34, 2);
  ctx.quadraticCurveTo(-10, -12, 22, -8);
  ctx.quadraticCurveTo(38, -4, 38, 0);
  ctx.quadraticCurveTo(36, 6, 20, 8);
  ctx.quadraticCurveTo(-12, 10, -34, 6);
  ctx.closePath();
  ctx.fill();
  // Cockpit windows.
  ctx.fillStyle = '#7fc4e8';
  ctx.beginPath();
  ctx.ellipse(16, -6, 9, 5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -7, 7, 4.5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Wing and red stripe.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(6, 2);
  ctx.lineTo(2, 16);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-30, -1, 62, 3);
  // Registration.
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SK-01', -16, 5);
  ctx.restore();
}

function drawRing(ctx, ring, t) {
  const pulse = 1 + Math.sin(t * 3 + ring.x * 0.01) * 0.04;
  ctx.save();
  ctx.translate(ring.x, ring.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#f5b301';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff3c4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r, -0.6, 1.1);
  ctx.stroke();
  ctx.restore();
}

function drawBalloon(ctx, b, t) {
  const bob = Math.sin(t * 0.8 + b.phase) * 6;
  ctx.save();
  ctx.translate(b.x, b.y + bob);
  ctx.fillStyle = '#e4572e';
  ctx.beginPath();
  ctx.ellipse(0, -18, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5b301';
  ctx.beginPath();
  ctx.ellipse(0, -18, 12, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b4636';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, 6);
  ctx.lineTo(-8, 22);
  ctx.moveTo(18, 6);
  ctx.lineTo(8, 22);
  ctx.stroke();
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(-9, 20, 18, 12);
  ctx.restore();
}

function drawBird(ctx, b, t) {
  const flap = Math.sin(t * 10 + b.phase) * 7;
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(b.x - 12, b.y - flap);
  ctx.quadraticCurveTo(b.x, b.y + 3, b.x + 12, b.y - flap);
  ctx.stroke();
}

function drawStorm(ctx, s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = 'rgba(52, 58, 74, 0.92)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 78, 34, 0, 0, Math.PI * 2);
  ctx.ellipse(-46, 10, 48, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(48, 12, 50, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(28, 32, 46, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 60, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (s.lit > 0) {
    ctx.strokeStyle = '#ffe95e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, 26);
    ctx.lineTo(-14, 58);
    ctx.lineTo(-2, 58);
    ctx.lineTo(-12, 92);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarrel(ctx, b, t) {
  const bob = Math.sin(t * 2 + b.x * 0.02) * 5;
  ctx.save();
  ctx.translate(b.x, b.y + bob);
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-20, -5, 40, 5);
  ctx.fillRect(-20, 5, 40, 5);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', 0, 5);
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function gauge(ctx, x, y, r, value, max, label, unit, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10, 18, 32, 0.72)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r - 7, a0, a1);
  ctx.stroke();
  const a = a0 + clamp(value / max, 0, 1) * (a1 - a0);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r - 7, a0, a);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), 0, 2);
  ctx.font = `11px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${label} ${unit}`, 0, r - 12);
  ctx.restore();
}

export function drawHud(ctx, world, screen) {
  const m = world.mission;
  // Top bar.
  ctx.fillStyle = 'rgba(10, 18, 32, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${m.name} — ${m.goal}`, 16, 33);
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const parts = [`SCORE ${Math.floor(world.score)}`];
  if (m.rings > 0) parts.push(`RINGS ${world.ringsGot}/${m.rings}`);
  if (m.runways.length > 0) parts.push(`RUNWAYS ${world.landings}/${m.runways.length}`);
  if (m.timeLimit > 0) parts.push(`TIME ${Math.ceil(world.timeLeft)}s`);
  ctx.fillText(parts.join('   ·   '), VIEW_W - 16, 32);
  // Lives as little aircraft, spaced so their wings do not overlap.
  for (let i = 0; i < world.lives; i += 1) {
    ctx.save();
    ctx.translate(540 + i * 92, 26);
    ctx.scale(0.55, 0.55);
    drawPlane(ctx, 0, 0, 0, 0, 0.5, 0);
    ctx.restore();
  }
  // Instruments, bottom left: altitude, speed, heading.
  gauge(ctx, 74, VIEW_H - 74, 52, world.altitudeM(), 560, 'ALT', 'ft', '#38bdf8');
  gauge(ctx, 196, VIEW_H - 74, 52, world.speedKts(), 240, 'SPD', 'kt', '#f5b301');
  // Heading compass tape.
  ctx.save();
  ctx.translate(318, VIEW_H - 74);
  ctx.fillStyle = 'rgba(10, 18, 32, 0.72)';
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(world.headingDeg()).padStart(3, '0'), 0, 0);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('HDG °', 0, 40);
  ctx.strokeStyle = '#f5b301';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(0, -34);
  ctx.stroke();
  ctx.restore();
  // Fuel bar, bottom right.
  const fw = 220;
  const fx = VIEW_W - fw - 20;
  const fy = VIEW_H - 66;
  ctx.fillStyle = 'rgba(10, 18, 32, 0.72)';
  ctx.fillRect(fx - 10, fy - 22, fw + 20, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', fx, fy - 4);
  const fuelW = fw * clamp(world.fuel / 100, 0, 1);
  ctx.fillStyle = world.fuel < 25 ? '#ef4444' : '#2fae5f';
  ctx.fillRect(fx, fy + 2, fuelW, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeRect(fx, fy + 2, fw, 14);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(world.fuel)}%`, fx + fw, fy - 4);
  // Throttle bar under the fuel.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', fx, fy + 32);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(fx + 34, fy + 22, (fw - 34) * world.throttle, 8);
  // Stall warning.
  if (world.speed < 175 && screen === SCREEN_PLAY) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — ADD THROTTLE', VIEW_W / 2, 96);
  }
  // Toast message.
  if (world.messageT > 0) {
    ctx.fillStyle = 'rgba(10, 18, 32, 0.8)';
    const tw = ctx.measureText(world.message).width + 36;
    ctx.fillRect(VIEW_W / 2 - tw / 2, 108, tw, 36);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW_W / 2, 132);
  }
}

// ---------------------------------------------------------------- the world view

export function drawWorld(ctx, world, t) {
  const camX = world.x - 380;
  const groundAtPlane = world.groundY(world.x);
  const camY = clamp(world.y - 360, -160, groundAtPlane - 480);
  ctx.fillStyle = skyGradient(ctx, world.altitudeM());
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawSun(ctx, t);
  // Drifting clouds, two parallax layers.
  for (let i = 0; i < 9; i += 1) {
    const cx = ((i * 397 + 120 - camX * 0.25) % (VIEW_W + 260) + VIEW_W + 260) % (VIEW_W + 260) - 130;
    drawCloud(ctx, cx, 70 + (i % 4) * 62, 0.8 + (i % 3) * 0.3, 0.85);
  }
  for (let i = 0; i < 7; i += 1) {
    const cx = ((i * 523 + 300 - camX * 0.5) % (VIEW_W + 300) + VIEW_W + 300) % (VIEW_W + 300) - 150;
    drawCloud(ctx, cx, 150 + (i % 3) * 90, 1.1 + (i % 2) * 0.3, 0.6);
  }
  drawHills(ctx, camX, camY, '#8fb8d8', 0.2, 470, 26);
  drawHills(ctx, camX, camY, '#6a9a6a', 0.45, 520, 34);
  // Terrain.
  ctx.beginPath();
  ctx.moveTo(-4, VIEW_H + 4);
  for (let sx = -4; sx <= VIEW_W + 16; sx += 8) {
    ctx.lineTo(sx, world.groundY(camX + sx) - camY);
  }
  ctx.lineTo(VIEW_W + 4, VIEW_H + 4);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 300, 0, VIEW_H);
  tg.addColorStop(0, '#7ec850');
  tg.addColorStop(1, '#3f7a2e');
  ctx.fillStyle = tg;
  ctx.fill();
  // The lake: water only where the valley floor dips below the waterline,
  // drawn column by column so it sits in the valley instead of floating.
  const lakeX = 3400 + world.mission.index * 1800;
  const waterY = 596;
  for (let sx = -8; sx <= VIEW_W + 8; sx += 8) {
    const wx = camX + sx;
    if (wx < lakeX || wx > lakeX + 900) continue;
    const gy = world.groundY(wx);
    if (gy <= waterY) continue;
    ctx.fillStyle = '#3b82c4';
    ctx.fillRect(sx, waterY - camY, 9, gy - waterY);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 5; i += 1) {
    const wx = lakeX + 60 + i * 160;
    const sx = wx - camX;
    if (sx > -80 && sx < VIEW_W) ctx.fillRect(sx, waterY + 8 - camY, 70, 3);
  }
  // Trees and houses along the ground.
  for (let sx = -40; sx < VIEW_W + 40; sx += 73) {
    const wx = camX + sx;
    const gy = world.groundY(wx) - camY;
    const h = Math.abs(Math.sin(wx * 0.137)) * 10;
    if (h < 3.2) drawTree(ctx, sx, gy, 0.9 + h * 0.12);
    else if (h > 8.6) drawHouse(ctx, sx, gy, 0.9);
  }
  // Runways: the home strip first, then the mission's strips.
  const homeX = -300 - camX;
  if (homeX > -900 && homeX < VIEW_W + 100) {
    drawRunway(ctx, homeX, 566 - camY, 800, 'HOME');
  }
  world.mission.runways.forEach((rx, i) => {
    const sx = rx - camX;
    if (sx > -700 && sx < VIEW_W + 100) {
      drawRunway(ctx, sx, 566 - camY, 620, `RWY ${i + 1}`);
    }
  });
  // Destination marker for the courier mission.
  if (world.mission.id === 'storm') {
    const dx = world.mission.distance - camX;
    if (dx > -100 && dx < VIEW_W + 200) {
      ctx.fillStyle = '#e4572e';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ SKYPORT', dx, 120);
    }
  }
  // Items.
  for (const item of world.items) {
    const sx = item.x - camX;
    if (sx < -160 || sx > VIEW_W + 160 || item.taken) continue;
    const sy = item.y - camY;
    if (item.kind === 'ring') drawRing(ctx, { ...item, x: sx, y: sy }, t);
    else if (item.kind === 'balloon') drawBalloon(ctx, { ...item, x: sx, y: sy }, t);
    else if (item.kind === 'bird') drawBird(ctx, { ...item, x: sx, y: sy }, t);
    else if (item.kind === 'storm') drawStorm(ctx, { ...item, x: sx, y: sy }, t);
    else if (item.kind === 'barrel') drawBarrel(ctx, { ...item, x: sx, y: sy }, t);
  }
  // The aircraft.
  drawPlane(ctx, 380, world.y - camY, world.pitch, t, world.throttle, world.invuln);
  // Storm rain over the whole screen when storm cells are near.
  const nearStorm = world.items.some((i) => i.kind === 'storm' && Math.abs(i.x - world.x) < 700);
  if (nearStorm) {
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i += 1) {
      const rx = (i * 173 + t * 900) % (VIEW_W + 40) - 20;
      const ry = (i * 97 + t * 1400) % (VIEW_H + 40) - 20;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- screens

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 16, 30, 0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export function drawTitle(ctx, world, t, selected, bests) {
  drawWorld(ctx, world, t);
  ctx.fillStyle = 'rgba(8, 16, 30, 0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SKY COURIER', VIEW_W / 2, 128);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('A little airmail pilot, three big jobs', VIEW_W / 2, 172);
  // Mission cards.
  const missions = MISSIONS;
  missions.forEach((m, i) => {
    const x = 140 + i * 340;
    const y = 220;
    const w = 320;
    const h = 240;
    const sel = i === selected;
    ctx.fillStyle = sel ? 'rgba(245, 179, 1, 0.92)' : 'rgba(8, 16, 30, 0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = sel ? '#1a1200' : '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`${i + 1}. ${m.name}`, x + w / 2, y + 52);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = sel ? '#3d2c00' : '#dbe7f3';
    ctx.fillText(m.tagline, x + w / 2, y + 92);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(m.goal, x + w / 2, y + 122);
    const best = bests[m.id] ?? 0;
    ctx.fillText(best > 0 ? `Best score: ${best}` : 'Not flown yet', x + w / 2, y + 152);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = sel ? '#1a1200' : '#ffe9a8';
    ctx.fillText(sel ? '▶ PRESS ENTER TO FLY' : 'Click or press ' + (i + 1), x + w / 2, y + 200);
  });
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Fly with ↑ ↓ to climb and dive, ← → for throttle · P pauses · M mutes', VIEW_W / 2, 520);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('An original game by DadayXz-code — built for the make.fun flight bounty', VIEW_W / 2, 548);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8, 16, 30, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 260, VIEW_H / 2 - 130, 520, 260);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 52);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('P or Esc to keep flying · Q to quit to the title screen', VIEW_W / 2, VIEW_H / 2 + 8);
  ctx.fillText('↑ ↓ climb and dive · ← → throttle · M mute', VIEW_W / 2, VIEW_H / 2 + 44);
}

export function drawEnd(ctx, world, won, best) {
  drawWorld(ctx, world, 0);
  ctx.fillStyle = 'rgba(8, 16, 30, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 300, VIEW_H / 2 - 170, 600, 340);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#7ee787' : '#ff9a8a';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText(won ? 'MISSION COMPLETE' : 'FLIGHT OVER', VIEW_W / 2, VIEW_H / 2 - 96);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(world.message || (won ? 'Well flown, courier.' : 'The courier will fly again.'), VIEW_W / 2, VIEW_H / 2 - 52);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`Score: ${Math.floor(world.score)}`, VIEW_W / 2, VIEW_H / 2 + 4);
  ctx.font = '18px system-ui, sans-serif';
  const detail = [];
  if (world.mission.rings > 0) detail.push(`Rings ${world.ringsGot}/${world.mission.rings}`);
  if (world.mission.runways.length > 0) detail.push(`Landings ${world.landings}`);
  detail.push(`Distance ${Math.round(world.x)} m`);
  ctx.fillText(detail.join('   ·   '), VIEW_W / 2, VIEW_H / 2 + 44);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(best > Math.floor(world.score)
    ? `Best for this mission: ${best}`
    : '★ New best score for this mission!', VIEW_W / 2, VIEW_H / 2 + 82);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Enter to fly again · Q for the title screen', VIEW_W / 2, VIEW_H / 2 + 128);
}
