import React, { useState } from 'react';
import { sfx } from '../audio/sfx.js';

const PALETTES = {
  drunkard: { hair: '#5b21b6', skin: '#fda4af', shirt: '#7e22ce', pants: '#3b0764', prop: 'bottle' },
  madman: { hair: '#312e81', skin: '#fed7aa', shirt: '#ef4444', pants: '#3f3f46', prop: 'pot' },
  glutton: { hair: '#92400e', skin: '#fed7aa', shirt: '#f59e0b', pants: '#78350f', prop: 'chicken' },
  beggar: { hair: '#57534e', skin: '#e7c3a8', shirt: '#78716c', pants: '#44403c', prop: 'bowl' },
  smoker: { hair: '#1e293b', skin: '#e2c5af', shirt: '#475569', pants: '#1e293b', prop: 'cigarette' },
  waterpipe: { hair: '#292524', skin: '#eab896', shirt: '#65a30d', pants: '#365314', prop: 'waterpipe' },
  blacksmith: { hair: '#1c1917', skin: '#e6b28a', shirt: '#b91c1c', pants: '#27272a', prop: 'hammer' },
  oldman: { hair: '#e2e8f0', skin: '#f5d0b5', shirt: '#64748b', pants: '#334155', prop: 'cane' },
  oldwoman: { hair: '#f1f5f9', skin: '#f7d5bd', shirt: '#a855f7', pants: '#6b21a8', prop: 'shawl' },
  kid: { hair: '#b45309', skin: '#ffe0c2', shirt: '#0ea5e9', pants: '#1d4ed8', prop: 'propeller' },
  youth: { hair: '#451a03', skin: '#fbd3b6', shirt: '#14b8a6', pants: '#1e293b', prop: 'scarf' },
  grocer: { hair: '#27272a', skin: '#f3c6a5', shirt: '#22c55e', pants: '#3f6212', prop: 'book' },
  florist: { hair: '#7c2d12', skin: '#ffe4cc', shirt: '#ec4899', pants: '#be185d', prop: 'flowers' },
  butcher: { hair: '#18181b', skin: '#f0bfa0', shirt: '#f8fafc', pants: '#b91c1c', prop: 'cleaver' },
  farmer: { hair: '#422006', skin: '#e0ae87', shirt: '#ca8a04', pants: '#713f12', prop: 'strawhat' },
  baker: { hair: '#9a3412', skin: '#fde0c8', shirt: '#fffbeb', pants: '#d97706', prop: 'chefhat' },
  fisher: { hair: '#1e3a8a', skin: '#ebb791', shirt: '#3b82f6', pants: '#1e40af', prop: 'rod' },
  tailor: { hair: '#701a75', skin: '#ffe2cc', shirt: '#d946ef', pants: '#86198f', prop: 'glasses' },
  lumberjack: { hair: '#7c2d12', skin: '#eec09d', shirt: '#dc2626', pants: '#1e293b', prop: 'axe' },
  herbalist: { hair: '#065f46', skin: '#fbd6ba', shirt: '#10b981', pants: '#047857', prop: 'herbs' },
  watchman: { hair: '#1e1b4b', skin: '#e5b899', shirt: '#4338ca', pants: '#1e1b4b', prop: 'lantern' },
  shepherd: { hair: '#854d0e', skin: '#ffe0c2', shirt: '#84cc16', pants: '#4d7c0f', prop: 'crook' },
};

export const POKE_EFFECTS = {
  drunkard: { anim: 'anim-poke-stagger', sfx: 'glass', particles: ['🍾', '💚', '✨', '🥴'], caption: 'CHOANG!' },
  florist: { anim: 'anim-poke-tickle', sfx: 'chime', particles: ['🌸', '🌺', '🌼', '💮'], caption: 'Hihi nhột!' },
  butcher: { anim: 'anim-poke-chop', sfx: 'chop', particles: ['🔪', '💥', '💢', '🥩'], slash: true, caption: 'PHẬP!' },
  waterpipe: { anim: 'anim-poke-stagger', sfx: 'waterpipe', particles: ['💨', '☁️', '💨', '🌫️'], caption: 'ROẸT~' },
  smoker: { anim: 'anim-poke-tickle', sfx: 'cough', particles: ['💨', '🚬', '💭', '💨'], caption: 'Khụ khụ!' },
  madman: { anim: 'anim-poke-spin', sfx: 'boing', particles: ['💫', '⭐', '🔩', '🤪'], caption: 'BOONG!' },
  glutton: { anim: 'anim-poke-tickle', sfx: 'pop', particles: ['🍗', '🦴', '😋', '🍖'], caption: 'Ngoạm!' },
  beggar: { anim: 'anim-poke-tickle', sfx: 'coin', particles: ['🪙', '🪰', '🥣', '✨'], caption: 'Keng keng!' },
  blacksmith: { anim: 'anim-poke-chop', sfx: 'anvil', particles: ['🔥', '✨', '⚡', '🔨'], slash: true, caption: 'KENG!' },
  oldman: { anim: 'anim-poke-stagger', sfx: 'woodblock', particles: ['🦯', '💢', '💨', '😤'], caption: 'Cốc cốc!' },
  oldwoman: { anim: 'anim-poke-tickle', sfx: 'pop', particles: ['👓', '😲', '🧶', '✨'], caption: 'Ối giời!' },
  kid: { anim: 'anim-poke-spin', sfx: 'boing', particles: ['🪨', '💨', '😜', '⭐'], caption: 'CHÍU!' },
  youth: { anim: 'anim-poke-tickle', sfx: 'chime', particles: ['✨', '⚡', '😎', '🌟'], caption: 'Ngầu!' },
  grocer: { anim: 'anim-poke-tickle', sfx: 'coin', particles: ['🪙', '📒', '💰', '✨'], caption: 'Tính sổ!' },
  farmer: { anim: 'anim-poke-chop', sfx: 'chop', particles: ['🌾', '🌱', '🌾', '💦'], slash: true, caption: 'Phập!' },
  baker: { anim: 'anim-poke-tickle', sfx: 'pop', particles: ['🥖', '🥐', '💨', '✨'], caption: 'Thơm lừng!' },
  fisher: { anim: 'anim-poke-chop', sfx: 'splash', particles: ['🐟', '💦', '💧', '🐠'], caption: 'Búng!' },
  tailor: { anim: 'anim-poke-tickle', sfx: 'scissor', particles: ['✂️', '🎀', '🧵', '✨'], caption: 'Xoẹt xoẹt!' },
  lumberjack: { anim: 'anim-poke-chop', sfx: 'chop', particles: ['🪵', '💥', '🪓', '🍂'], slash: true, caption: 'CỐP!' },
  herbalist: { anim: 'anim-poke-tickle', sfx: 'chime', particles: ['🌿', '✨', '🍃', '💚'], caption: 'Thơm mát!' },
  watchman: { anim: 'anim-poke-chop', sfx: 'woodblock', particles: ['🏮', '✨', '🔔', '💛'], caption: 'CỐC CỐC!' },
  shepherd: { anim: 'anim-poke-tickle', sfx: 'boing', particles: ['🐑', '💨', '🌿', '✨'], caption: 'Beee~' },
};

const PARTICLE_VECTORS = [
  { dx: '-28px', dy: '-34px', rot: '-35deg' },
  { dx: '30px', dy: '-30px', rot: '40deg' },
  { dx: '-24px', dy: '14px', rot: '-20deg' },
  { dx: '26px', dy: '18px', rot: '35deg' },
];

// Smooth 2D Cartoon Vector Avatar (Goose Goose Duck Cel-Shaded Style)
export default function PixelVillager({
  avatarId = 'youth',
  alive = true,
  size = 62,
  isNight = false,
  eyeState = 'awake', // 'awake' | 'sleep' | 'wolf'
  animate = true,
  isAccused = false,
  enablePoke = false,
  onPokeExtra = null,
}) {
  const pal = PALETTES[avatarId] || PALETTES.youth;
  const [bursts, setBursts] = useState([]);

  const handlePoke = (e) => {
    if (!enablePoke) return;
    if (onPokeExtra) onPokeExtra(e);
    if (!alive) {
      sfx.play('pop');
      const id = Date.now() + Math.random();
      setBursts((prev) => [...prev, { id, particles: ['👻', '💨', '🕯️', '✨'], caption: 'Hù!' }]);
      setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 750);
      return;
    }

    const eff = POKE_EFFECTS[avatarId] || POKE_EFFECTS.youth;
    sfx.play(eff.sfx);
    const id = Date.now() + Math.random();
    setBursts((prev) => [...prev, { id, ...eff }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 750);
  };

  const activeBurst = bursts[bursts.length - 1];
  const isSleeping = alive && eyeState === 'sleep';
  const isWolfEyes = alive && eyeState === 'wolf';

  if (!alive) {
    return (
      <div
        onClick={handlePoke}
        className={`relative flex items-center justify-center ${enablePoke ? 'cursor-pointer' : ''}`}
        style={{ width: size, height: size }}
      >
        {bursts.map((b) => (
          <div key={b.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            {b.particles.map((pt, idx) => (
              <span
                key={idx}
                className="absolute text-base"
                style={{
                  animation: 'particleBurst 0.72s ease-out forwards',
                  '--dx': PARTICLE_VECTORS[idx].dx,
                  '--dy': PARTICLE_VECTORS[idx].dy,
                  '--rot': PARTICLE_VECTORS[idx].rot,
                }}
              >
                {pt}
              </span>
            ))}
          </div>
        ))}
        <svg viewBox="0 0 64 64" width={size} height={size} className="anim-ghost">
          <ellipse cx="32" cy="56" rx="18" ry="5" fill="#000" opacity="0.3" />
          {/* Rounded tombstone */}
          <path d="M18 54 V36 C18 28 46 28 46 36 V54 Z" fill="#64748b" stroke="#111322" strokeWidth="3" />
          <path d="M32 34 V46 M26 39 H38" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
          {/* Cute cartoon ghost */}
          <path
            d="M20 28 C20 14 44 14 44 28 V38 L39 34 L34 38 L30 34 L25 38 L20 34 Z"
            fill="#f1f5f9"
            stroke="#111322"
            strokeWidth="2.5"
            opacity="0.92"
          />
          <circle cx="27" cy="24" r="2.2" fill="#111322" />
          <circle cx="37" cy="24" r="2.2" fill="#111322" />
        </svg>
      </div>
    );
  }

  const idleClass = activeBurst
    ? activeBurst.anim
    : isSleeping
      ? 'anim-sleep-nod'
      : animate
        ? 'anim-soul-idle'
        : '';

  return (
    <div
      onClick={handlePoke}
      className={`relative flex items-center justify-center ${idleClass} ${enablePoke ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size }}
    >
      {isSleeping && !activeBurst && (
        <div className="pointer-events-none absolute -top-2 right-0 text-xs font-black text-indigo-200 anim-zzz select-none">
          zZz
        </div>
      )}

      {!isSleeping && (pal.prop === 'cigarette' || pal.prop === 'waterpipe') && (
        <div className="pointer-events-none absolute -top-2 right-1 flex gap-1">
          <span className="anim-smoke inline-block w-2.5 h-2.5 rounded-full bg-slate-200/75" />
          {pal.prop === 'waterpipe' && (
            <span className="anim-smoke inline-block w-3 h-3 rounded-full bg-white/80" style={{ animationDelay: '0.5s' }} />
          )}
        </div>
      )}

      {bursts.map((b) => (
        <div key={b.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          {b.slash && (
            <div
              className="absolute w-14 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff]"
              style={{ animation: 'slashFlash 0.4s ease-out forwards' }}
            />
          )}
          <span
            className="absolute -top-4 font-extrabold text-xs text-amber-300 drop-shadow-[0_2px_0_#000] whitespace-nowrap"
            style={{ animation: 'particleBurst 0.72s ease-out forwards', '--dx': '0px', '--dy': '-18px', '--rot': '0deg' }}
          >
            {b.caption}
          </span>
          {b.particles.map((pt, idx) => (
            <span
              key={idx}
              className="absolute text-lg drop-shadow"
              style={{
                animation: 'particleBurst 0.72s ease-out forwards',
                '--dx': PARTICLE_VECTORS[idx].dx,
                '--dy': PARTICLE_VECTORS[idx].dy,
                '--rot': PARTICLE_VECTORS[idx].rot,
              }}
            >
              {pt}
            </span>
          ))}
        </div>
      ))}

      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={isWolfEyes ? 'wolf-eye-glow' : ''}
        style={{
          filter: isNight && isSleeping ? 'brightness(0.7) drop-shadow(0 3px 0 rgba(0,0,0,0.45))' : 'drop-shadow(0 3px 0 rgba(0,0,0,0.45))',
        }}
      >
        {/* Ground Shadow */}
        <ellipse cx="32" cy="57" rx="16" ry="4.5" fill="#000" opacity="0.35" />

        {/* Rounded Feet */}
        <rect x="21" y="48" width="8" height="8" rx="4" fill={pal.pants} stroke="#111322" strokeWidth="2.5" />
        <rect x="35" y="48" width="8" height="8" rx="4" fill={pal.pants} stroke="#111322" strokeWidth="2.5" />

        {/* Bean-shaped Goose Goose Duck Body */}
        <rect x="17" y="34" width="30" height="18" rx="9" fill={pal.shirt} stroke="#111322" strokeWidth="3" />
        {pal.prop === 'scarf' && (
          <path d="M18 35 Q32 41 46 35 L46 40 Q32 45 18 40 Z" fill="#ef4444" stroke="#111322" strokeWidth="2" />
        )}
        {pal.prop === 'shawl' && (
          <path d="M17 36 Q32 44 47 36 L44 44 Q32 48 20 44 Z" fill="#c084fc" stroke="#111322" strokeWidth="2" />
        )}
        {pal.prop === 'cleaver' && <circle cx="30" cy="43" r="3" fill="#ef4444" opacity="0.75" />}

        {/* Big Cartoon Head */}
        <circle cx="32" cy="24" r="15" fill={pal.skin} stroke="#111322" strokeWidth="3" />

        {/* Hair / Hats */}
        {pal.prop === 'pot' ? (
          <g>
            <path d="M16 20 C16 8 48 8 48 20 Z" fill="#94a3b8" stroke="#111322" strokeWidth="2.8" />
            <rect x="46" y="13" width="8" height="3.5" rx="1.5" fill="#64748b" stroke="#111322" strokeWidth="2" />
          </g>
        ) : pal.prop === 'strawhat' ? (
          <g>
            <ellipse cx="32" cy="14" rx="21" ry="5" fill="#eab308" stroke="#111322" strokeWidth="2.5" />
            <path d="M20 13 L32 3 L44 13 Z" fill="#facc15" stroke="#111322" strokeWidth="2.5" />
          </g>
        ) : pal.prop === 'chefhat' ? (
          <g>
            <path d="M20 15 C16 6 28 4 32 7 C36 4 48 6 44 15 Z" fill="#ffffff" stroke="#111322" strokeWidth="2.5" />
          </g>
        ) : pal.prop === 'propeller' ? (
          <g>
            <path d="M18 17 C18 8 46 8 46 17 Z" fill="#38bdf8" stroke="#111322" strokeWidth="2.5" />
            <line x1="24" y1="6" x2="40" y2="6" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="32" cy="6" r="2.5" fill="#facc15" stroke="#111322" strokeWidth="1.5" />
          </g>
        ) : pal.prop === 'flowers' ? (
          <g>
            <path d="M17 20 C18 9 46 9 47 20 C42 15 22 15 17 20 Z" fill={pal.hair} stroke="#111322" strokeWidth="2.5" />
            <circle cx="22" cy="13" r="3.5" fill="#f472b6" stroke="#111322" strokeWidth="1.5" />
            <circle cx="32" cy="11" r="3.5" fill="#facc15" stroke="#111322" strokeWidth="1.5" />
            <circle cx="42" cy="13" r="3.5" fill="#fb7185" stroke="#111322" strokeWidth="1.5" />
          </g>
        ) : (
          <path d="M17 20 C18 8 46 8 47 20 C42 14 22 14 17 20 Z" fill={pal.hair} stroke="#111322" strokeWidth="2.5" />
        )}

        {/* Eyes */}
        {isSleeping ? (
          <g stroke="#111322" strokeWidth="2.8" strokeLinecap="round" fill="none">
            <path d="M22 24 Q25 27 28 24" />
            <path d="M36 24 Q39 27 42 24" />
          </g>
        ) : isWolfEyes ? (
          <g>
            <circle cx="25" cy="24" r="4" fill="#ef4444" stroke="#111322" strokeWidth="2" />
            <circle cx="39" cy="24" r="4" fill="#ef4444" stroke="#111322" strokeWidth="2" />
            <circle cx="26" cy="23" r="1.5" fill="#fef08a" />
            <circle cx="40" cy="23" r="1.5" fill="#fef08a" />
          </g>
        ) : (
          <g>
            <circle cx="25" cy="24" r="3.5" fill="#ffffff" stroke="#111322" strokeWidth="2" />
            <circle cx="39" cy="24" r="3.5" fill="#ffffff" stroke="#111322" strokeWidth="2" />
            <circle cx="25.8" cy="24" r="1.8" fill="#111322" />
            <circle cx="39.8" cy="24" r="1.8" fill="#111322" />
            {pal.prop === 'glasses' && (
              <g stroke="#38bdf8" strokeWidth="2" fill="none">
                <circle cx="25" cy="24" r="5" />
                <circle cx="39" cy="24" r="5" />
                <line x1="30" y1="24" x2="34" y2="24" />
              </g>
            )}
          </g>
        )}

        {/* Cute Mouth / Beard / Rosy Cheeks */}
        {pal.prop === 'bottle' && (
          <g>
            <circle cx="21" cy="29" r="2.5" fill="#ef4444" opacity="0.65" />
            <circle cx="43" cy="29" r="2.5" fill="#ef4444" opacity="0.65" />
          </g>
        )}
        {pal.prop === 'cane' && (
          <path d="M23 30 Q32 42 41 30 Z" fill="#f1f5f9" stroke="#111322" strokeWidth="2" />
        )}
        {isAccused ? (
          <ellipse cx="32" cy="31" rx="3" ry="2.2" fill="#ef4444" stroke="#111322" strokeWidth="1.5" />
        ) : (
          <path d="M29 31 Q32 33.5 35 31" stroke="#111322" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Signature Hand Props */}
        {pal.prop === 'cigarette' && (
          <g>
            <rect x="35" y="29" width="12" height="3" rx="1" fill="#fff" stroke="#111322" strokeWidth="1.5" />
            <rect x="45" y="29" width="3" height="3" fill="#f97316" />
          </g>
        )}
        {pal.prop === 'bottle' && (
          <g>
            <rect x="46" y="34" width="9" height="16" rx="3" fill="#22c55e" stroke="#111322" strokeWidth="2" />
            <rect x="48.5" y="28" width="4" height="7" rx="1" fill="#16a34a" stroke="#111322" strokeWidth="2" />
            <rect x="47.5" y="39" width="6" height="5" fill="#fef08a" />
          </g>
        )}
        {pal.prop === 'hammer' && (
          <g>
            <line x1="49" y1="32" x2="49" y2="50" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="43" y="27" width="12" height="7" rx="2" fill="#94a3b8" stroke="#111322" strokeWidth="2" />
          </g>
        )}
        {pal.prop === 'chicken' && (
          <g>
            <ellipse cx="48" cy="41" rx="6" ry="4" fill="#d97706" stroke="#111322" strokeWidth="2" />
            <circle cx="53" cy="43" r="2.5" fill="#fef3c7" stroke="#111322" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'bowl' && (
          <path d="M42 40 H54 C54 47 42 47 42 40 Z" fill="#a8a29e" stroke="#111322" strokeWidth="2" />
        )}
        {pal.prop === 'waterpipe' && (
          <g>
            <rect x="47" y="24" width="6" height="27" rx="2" fill="#84cc16" stroke="#111322" strokeWidth="2" />
            <circle cx="46" cy="43" r="2.5" fill="#ef4444" stroke="#111322" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'cane' && (
          <path d="M13 33 C13 29 18 29 18 33 V53" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
        {pal.prop === 'book' && (
          <rect x="44" y="36" width="10" height="12" rx="2" fill="#fef08a" stroke="#111322" strokeWidth="2" />
        )}
        {pal.prop === 'flowers' && (
          <g>
            <path d="M8 40 H20 L18 48 H10 Z" fill="#a16207" stroke="#111322" strokeWidth="2" />
            <circle cx="11" cy="38" r="3" fill="#f472b6" stroke="#111322" strokeWidth="1.5" />
            <circle cx="16" cy="37" r="3" fill="#facc15" stroke="#111322" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'cleaver' && (
          <g>
            <rect x="46" y="28" width="10" height="13" rx="2" fill="#cbd5e1" stroke="#111322" strokeWidth="2" />
            <rect x="48" y="41" width="4" height="8" rx="1" fill="#78350f" stroke="#111322" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'rod' && (
          <g>
            <line x1="48" y1="50" x2="56" y2="18" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
            <line x1="56" y1="18" x2="56" y2="38" stroke="#93c5fd" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'axe' && (
          <g>
            <line x1="49" y1="30" x2="49" y2="50" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M49 30 L57 27 V36 L49 34 Z" fill="#cbd5e1" stroke="#111322" strokeWidth="2" />
          </g>
        )}
        {pal.prop === 'herbs' && (
          <g>
            <path d="M8 40 H20 L18 48 H10 Z" fill="#78350f" stroke="#111322" strokeWidth="2" />
            <circle cx="14" cy="38" r="4" fill="#22c55e" stroke="#111322" strokeWidth="1.5" />
          </g>
        )}
        {pal.prop === 'lantern' && (
          <g>
            <rect x="46" y="37" width="9" height="12" rx="3" fill="#fde047" stroke="#111322" strokeWidth="2" />
            <line x1="50.5" y1="33" x2="50.5" y2="37" stroke="#475569" strokeWidth="2.5" />
          </g>
        )}
        {pal.prop === 'crook' && (
          <path d="M12 26 C12 20 18 20 18 26 V52" stroke="#a16207" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </div>
  );
}
