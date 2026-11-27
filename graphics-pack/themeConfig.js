// ============================================================================
// CẤU HÌNH ĐỒ HỌA TẬP TRUNG — GAME "MA CHÓ" (BỘ ĐÌNH LÀNG VIỆT & 22 DÂN LÀNG)
// ============================================================================
import { VILLAGER_MOTION, getVillagerMotion } from '../src/data/villagerMotion.js';

export const BRAND = {
  title: 'MA CHÓ',
  badge: 'LÀNG VIỆT CEL-SHADED EDITION',
};

export const ASSET_PATHS = {
  dayBackground: '/backgrounds/bg_day.jpg',
  nightBackground: '/backgrounds/bg_night.jpg',
  lobbyBackground: '/backgrounds/bg_night.jpg',
  character: (id) => `/ma-cho/${getVillagerMotion(id).slug}/idle.webp`,
  characterIcon: (id) => `/ma-cho/${getVillagerMotion(id).slug}/icon.png`,
  characterIdle: (id) => `/ma-cho/${getVillagerMotion(id).slug}/idle.webp`,
  characterEmote: (id) => `/ma-cho/${getVillagerMotion(id).slug}/emote.webp`,
  characterSleep: (id) => `/ma-cho/${getVillagerMotion(id).slug}/sleep.png`,
  characterWindup: (id) => `/ma-cho/${getVillagerMotion(id).slug}/windup.png`,
  characterPunchline: (id) => `/ma-cho/${getVillagerMotion(id).slug}/punchline.png`,
  characterGhost: (id) => `/ma-cho/${getVillagerMotion(id).slug}/ghost.png`,
  characterPart: (id, part) => `/ma-cho/${getVillagerMotion(id).slug}/parts/${part}.png`,
  characterWalkCustom: (id) => `/ma-cho/${getVillagerMotion(id).slug}/walk.webp`,
  characterJumpCustom: (id) => `/ma-cho/${getVillagerMotion(id).slug}/jump.png`,
  characterAttackCustom: (id) => `/ma-cho/${getVillagerMotion(id).slug}/attack.webp`,
  wolfBeast: (role, state = 'idle') => {
    const dir = role === 'cursed_wolf' ? 'cursed-wolf' : 'werewolf';
    return `/wolves/${dir}/${state}.png`;
  },
  gallowsBack: '/props/gallows/gallows_back.png',
  gallowsNoose: '/props/gallows/gallows_noose.png',
  deathDecal: (cause) => {
    if (cause === 'poison') return '/death/poison_puddle.png';
    if (cause === 'hunter') return '/death/hunter_bullet_smoke.png';
    return '/death/wolf_claw_marks.png';
  },
  ghostTailAura: '/death/ghost_tail_aura.png',
  sleepingMat: '/props/sleeping_mat.png',
  campfireLit: '/props/campfire_lit.png',
  campfireOut: '/props/campfire_out.png',
  ghostTombstone: '/props/ghost_tombstone.png',
  roleIcon: (roleId) => `/roles/${roleId}.png`,
  throwable: (itemId) => `/throwables/${itemId}.png`,
};

// Để trống {} vì mỗi nhân vật trong /ma-cho/<slug>/ sử dụng idle.webp & emote.webp 12-14 khung hình chuẩn
export const SPRITE_SHEETS = {};

// Căn chỉnh vị trí vòng tròn nhân vật trên Sân Đình Làng Việt 2.5D
export const ARENA_LAYOUT = {
  centerYOffsetRatio: 0.11, // Tâm vòng tròn khớp chính giữa sân gạch đỏ Bát Tràng
  ellipseRxRatio: 0.29,     // Bán kính ngang của vòng tròn
  ellipseRyRatio: 0.22,     // Bán kính dọc (giữ hàng trên đứng trọn trong sân gạch)
  spriteSizeDesktop: 98,    // Kích thước nhân vật trên máy tính (px)
  spriteSizeTablet: 82,     // Kích thước nhân vật trên tablet / màn vừa (px)
  spriteSizeMobile: 64,     // Kích thước nhân vật trên điện thoại (px)
};

// Hiệu ứng chạm đồng bộ từ bảng kịch bản 22 nhân vật
export const POKE_EFFECTS = VILLAGER_MOTION;
