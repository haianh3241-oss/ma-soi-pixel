const STORAGE_KEY = 'ma_cho_touch_hud_v1';

export const DEFAULT_TOUCH_HUD_CONFIG = {
  joystickMode: 'floating', // 'floating' (nửa trái màn hình tự do) | 'fixed'
  leftHanded: false,
  buttonScale: 1.0,
  opacity: 0.92,
  positions: {
    joystick: { xPct: 16, yPct: 76 },
    jump: { xPct: 88, yPct: 80 },
    punch: { xPct: 75, yPct: 83 },
    kick: { xPct: 81, yPct: 66 },
  },
};

function clampPct(v, min = 8, max = 92) {
  const num = Number(v);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num * 10) / 10));
}

export function normalizeTouchHudConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const pos = src.positions && typeof src.positions === 'object' ? src.positions : {};
  const def = DEFAULT_TOUCH_HUD_CONFIG.positions;
  return {
    joystickMode: src.joystickMode === 'fixed' ? 'fixed' : 'floating',
    leftHanded: Boolean(src.leftHanded),
    buttonScale: Math.max(0.75, Math.min(1.35, Number(src.buttonScale) || 1.0)),
    opacity: Math.max(0.35, Math.min(1.0, Number(src.opacity) || 0.92)),
    positions: {
      joystick: {
        xPct: clampPct(pos.joystick?.xPct ?? def.joystick.xPct, 8, 92),
        yPct: clampPct(pos.joystick?.yPct ?? def.joystick.yPct, 18, 88),
      },
      jump: {
        xPct: clampPct(pos.jump?.xPct ?? def.jump.xPct, 7, 93),
        yPct: clampPct(pos.jump?.yPct ?? def.jump.yPct, 18, 90),
      },
      punch: {
        xPct: clampPct(pos.punch?.xPct ?? def.punch.xPct, 7, 93),
        yPct: clampPct(pos.punch?.yPct ?? def.punch.yPct, 18, 90),
      },
      kick: {
        xPct: clampPct(pos.kick?.xPct ?? def.kick.xPct, 7, 93),
        yPct: clampPct(pos.kick?.yPct ?? def.kick.yPct, 18, 90),
      },
    },
  };
}

export function loadTouchHudConfig() {
  if (typeof window === 'undefined') return DEFAULT_TOUCH_HUD_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOUCH_HUD_CONFIG;
    return normalizeTouchHudConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_TOUCH_HUD_CONFIG;
  }
}

export function saveTouchHudConfig(cfg) {
  const norm = normalizeTouchHudConfig(cfg);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
    } catch {
      // ignore quota errors
    }
  }
  return norm;
}

export function mirrorTouchHudPositions(cfg) {
  const next = normalizeTouchHudConfig(cfg);
  const flipped = !next.leftHanded;
  const mirrorX = (x) => Math.round((100 - x) * 10) / 10;
  return normalizeTouchHudConfig({
    ...next,
    leftHanded: flipped,
    positions: {
      joystick: { xPct: mirrorX(next.positions.joystick.xPct), yPct: next.positions.joystick.yPct },
      jump: { xPct: mirrorX(next.positions.jump.xPct), yPct: next.positions.jump.yPct },
      punch: { xPct: mirrorX(next.positions.punch.xPct), yPct: next.positions.punch.yPct },
      kick: { xPct: mirrorX(next.positions.kick.xPct), yPct: next.positions.kick.yPct },
    },
  });
}
