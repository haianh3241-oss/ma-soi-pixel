import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROLES, VILLAGERS } from '../shared/constants.js';
import { VILLAGER_MOTION } from '../src/data/villagerMotion.js';

const ASSETS_ROOT = path.resolve('graphics-pack/assets');

test('All 22 villagers have complete motion specs and asset files (icon, idle, emote, sleep)', () => {
  assert.equal(VILLAGERS.length, 22);
  for (const v of VILLAGERS) {
    const m = VILLAGER_MOTION[v.id];
    assert.ok(m, `Missing VILLAGER_MOTION for ${v.id}`);
    assert.ok(m.emoteMs > 0, `Invalid emoteMs for ${v.id}`);
    assert.ok(m.impactMs > 0 && m.impactMs < m.emoteMs, `Invalid impactMs for ${v.id}`);
    for (const file of ['icon.png', 'idle.webp', 'emote.webp', 'sleep.png']) {
      const fullPath = path.join(ASSETS_ROOT, 'ma-cho', m.slug, file);
      assert.equal(fs.existsSync(fullPath), true, `Missing ${m.slug}/${file}`);
    }
  }
});

test('All 11 role icons, backgrounds, and village props exist in graphics-pack/assets', () => {
  for (const role of Object.values(ROLES)) {
    const iconPath = path.join(ASSETS_ROOT, 'roles', `${role.id}.png`);
    assert.equal(fs.existsSync(iconPath), true, `Missing role icon ${role.id}.png`);
  }
  for (const rel of [
    'backgrounds/bg_day.jpg',
    'backgrounds/bg_night.jpg',
    'props/campfire_lit.png',
    'props/campfire_out.png',
    'props/ghost_tombstone.png',
    'sfx/rooster.wav',
    'sfx/wolf_howl.wav',
    'sfx/wolf_bite.wav',
    'sfx/gunshot.wav',
    'sfx/execution.wav',
    'sfx/war_drum.wav',
    'sfx/curse_spell.wav',
    'sfx/witch_potion.wav',
    'sfx/death.wav',
  ]) {
    assert.equal(fs.existsSync(path.join(ASSETS_ROOT, rel)), true, `Missing ${rel}`);
  }
});
