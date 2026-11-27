import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARENA_COLLIDERS,
  CAMPFIRE_POS,
  DEFAULT_MOVEMENT_CONFIG,
} from '../src/engine/movementConfig.js';
import {
  findMeleeTargetsInCone,
  normalizeInputVector,
  resolveDirectionalAxes,
  resolveWorldCollisions,
  stepActorPhysics,
  stepJumpPhysics,
} from '../src/engine/physics2d.js';
import { VILLAGER_MOTION } from '../src/data/villagerMotion.js';
import { VILLAGER_PARTS_META } from '../src/data/villagerRigConfig.js';
import {
  DEFAULT_TOUCH_HUD_CONFIG,
  mirrorTouchHudPositions,
  normalizeTouchHudConfig,
} from '../src/utils/touchHudConfig.js';

test('Vector2 normalization prevents faster diagonal movement and stops instantly on zero input', () => {
  const straight = normalizeInputVector(1, 0);
  const diag = normalizeInputVector(1, 1);
  assert.ok(Math.abs(Math.hypot(straight.x, straight.y) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-6);

  const actor = { x: 800, y: 700, z: 0, vz: 0, kx: 0, ky: 0, facing: 1 };
  const s1 = stepActorPhysics(actor, { ix: 1, iy: 1, isRunning: false }, 0.016);
  const s2 = stepActorPhysics(actor, { ix: 1, iy: 0, isRunning: false }, 0.016);
  const distDiag = Math.hypot(s1.x - actor.x, s1.y - actor.y);
  const distStraight = Math.hypot(s2.x - actor.x, s2.y - actor.y);
  assert.ok(Math.abs(distDiag - distStraight) < 0.05, 'Diagonal distance must equal cardinal distance');

  // Releasing keys yields exact 0 velocity immediately (no inertia slide)
  const stopped = stepActorPhysics({ ...actor, x: s1.x, y: s1.y }, { ix: 0, iy: 0, isRunning: false }, 0.016);
  assert.equal(stopped.vx, 0);
  assert.equal(stopped.vy, 0);
  assert.equal(stopped.x, s1.x);
  assert.equal(stopped.y, s1.y);
});

test('Z-axis jump physics rises above ground shadow and lands cleanly at z=0', () => {
  let actor = { z: 0, vz: DEFAULT_MOVEMENT_CONFIG.jumpVelocity };
  let maxZ = 0;
  let landed = false;
  for (let i = 0; i < 80; i++) {
    const res = stepJumpPhysics(actor, 0.016);
    actor = { z: res.z, vz: res.vz };
    if (actor.z > maxZ) maxZ = actor.z;
    if (res.justLanded) {
      landed = true;
      break;
    }
  }
  assert.ok(maxZ > 60, 'Character should jump noticeably above ground');
  assert.equal(landed, true);
  assert.equal(actor.z, 0);
});

test('Collision system blocks walking or high-knockback sliding through Campfire & courtyard walls', () => {
  const campfire = ARENA_COLLIDERS.find((c) => c.id === 'campfire');
  const blocked = resolveWorldCollisions(CAMPFIRE_POS.x + 5, CAMPFIRE_POS.y + 5, DEFAULT_MOVEMENT_CONFIG.colliderRadius);
  const distToFire = Math.hypot(blocked.x - campfire.x, blocked.y - campfire.y);
  assert.ok(distToFire >= campfire.r + DEFAULT_MOVEMENT_CONFIG.colliderRadius - 0.1);

  const wallClamped = resolveWorldCollisions(5000, -500, DEFAULT_MOVEMENT_CONFIG.colliderRadius);
  assert.ok(wallClamped.x < 1600 && wallClamped.y > 0);
});

test('Melee cone targets front victims for Punch & Kick knockback', () => {
  const attacker = { id: 'a1', x: 500, y: 500, facing: 1 };
  const inFront = { id: 't1', x: 580, y: 510 };
  const behind = { id: 't2', x: 410, y: 500 };
  const hits = findMeleeTargetsInCone({
    attacker,
    actors: [inFront, behind],
    dirX: 1,
    dirY: 0,
    range: DEFAULT_MOVEMENT_CONFIG.kickRange,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].target.id, 't1');
});

test('All 22 villagers have complete optimized puppet body-part PNGs for skeletal rigging', () => {
  const required = ['head-neutral', 'head-emote', 'torso', 'arm-a', 'arm-b', 'leg-a', 'leg-b'];
  for (const m of Object.values(VILLAGER_MOTION)) {
    const meta = VILLAGER_PARTS_META[m.slug];
    assert.ok(meta, `Missing rig metadata for ${m.slug}`);
    for (const part of required) {
      assert.ok(meta[part], `Missing meta.${part} for ${m.slug}`);
      const fp = path.resolve('graphics-pack/assets/ma-cho', m.slug, 'parts', `${part}.png`);
      assert.ok(fs.existsSync(fp), `Missing PNG file ${fp}`);
    }
  }
});

test('SOCD Last-Key Priority resolves opposite directional keys cleanly without getting stuck', () => {
  // Press A then press D while holding A -> should go Right (+1); release D -> returns Left (-1)
  assert.deepEqual(resolveDirectionalAxes(['KeyA', 'KeyD'], []), { ix: 1, iy: 0 });
  assert.deepEqual(resolveDirectionalAxes(['KeyA'], ['KeyW', 'KeyS']), { ix: -1, iy: 1 });
  assert.deepEqual(resolveDirectionalAxes([], []), { ix: 0, iy: 0 });
});

test('All 22 villagers have bespoke ghost.png sprites and sleeping_mat.png prop exists', () => {
  const matPath = path.resolve('graphics-pack/assets/props/sleeping_mat.png');
  assert.ok(fs.existsSync(matPath), `Missing sleeping mat prop at ${matPath}`);
  const entries = Object.values(VILLAGER_MOTION);
  assert.equal(entries.length, 22);
  for (const m of entries) {
    const gp = path.resolve('graphics-pack/assets/ma-cho', m.slug, 'ghost.png');
    assert.ok(fs.existsSync(gp), `Missing character ghost sprite at ${gp}`);
  }
});

test('Touch HUD config normalizes bounds cleanly and mirrors left/right-handed layouts', () => {
  const norm = normalizeTouchHudConfig({
    joystickMode: 'floating',
    buttonScale: 99,
    opacity: 0.01,
    positions: { jump: { xPct: 200, yPct: -10 } },
  });
  assert.equal(norm.buttonScale, 1.35);
  assert.equal(norm.opacity, 0.35);
  assert.equal(norm.positions.jump.xPct, 93);
  assert.equal(norm.positions.jump.yPct, 18);

  const mirrored = mirrorTouchHudPositions(DEFAULT_TOUCH_HUD_CONFIG);
  assert.equal(mirrored.leftHanded, true);
  assert.ok(mirrored.positions.joystick.xPct > 50);
  assert.ok(mirrored.positions.jump.xPct < 50);
});
