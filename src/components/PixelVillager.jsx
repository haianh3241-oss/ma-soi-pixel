import React, { useState } from 'react';
import { sfx } from '../audio/sfx.js';

const PALETTES = {
  drunkard: { hair: '#451a03', skin: '#fca5a5', shirt: '#7e22ce', pants: '#3b0764', prop: 'bottle' },
  madman: { hair: '#1e1b4b', skin: '#fcd5b5', shirt: '#dc2626', pants: '#3f3f46', prop: 'pot' },
  glutton: { hair: '#78350f', skin: '#fed7aa', shirt: '#f59e0b', pants: '#713f12', prop: 'chicken' },
  beggar: { hair: '#57534e', skin: '#e7c3a8', shirt: '#78716c', pants: '#44403c', prop: 'bowl' },
  smoker: { hair: '#0f172a', skin: '#e2c5af', shirt: '#334155', pants: '#1e293b', prop: 'cigarette' },
  waterpipe: { hair: '#292524', skin: '#eab896', shirt: '#65a30d', pants: '#365314', prop: 'waterpipe' },
  blacksmith: { hair: '#1c1917', skin: '#e6b28a', shirt: '#7f1d1d', pants: '#27272a', prop: 'hammer' },
  oldman: { hair: '#e2e8f0', skin: '#f5d0b5', shirt: '#475569', pants: '#1e293b', prop: 'cane' },
  oldwoman: { hair: '#f1f5f9', skin: '#f7d5bd', shirt: '#9333ea', pants: '#581c87', prop: 'shawl' },
  kid: { hair: '#92400e', skin: '#ffe0c2', shirt: '#0ea5e9', pants: '#1d4ed8', prop: 'propeller' },
  youth: { hair: '#451a03', skin: '#fbd3b6', shirt: '#0d9488', pants: '#1e293b', prop: 'scarf' },
  grocer: { hair: '#27272a', skin: '#f3c6a5', shirt: '#16a34a', pants: '#3f6212', prop: 'book' },
  florist: { hair: '#7c2d12', skin: '#ffe4cc', shirt: '#ec4899', pants: '#be185d', prop: 'flowers' },
  butcher: { hair: '#18181b', skin: '#f0bfa0', shirt: '#f8fafc', pants: '#991b1b', prop: 'cleaver' },
  farmer: { hair: '#422006', skin: '#e0ae87', shirt: '#a16207', pants: '#713f12', prop: 'strawhat' },
  baker: { hair: '#9a3412', skin: '#fde0c8', shirt: '#fffbeb', pants: '#d97706', prop: 'chefhat' },
  fisher: { hair: '#1e3a8a', skin: '#ebb791', shirt: '#2563eb', pants: '#1e40af', prop: 'rod' },
  tailor: { hair: '#581c87', skin: '#ffe2cc', shirt: '#c026d3', pants: '#701a75', prop: 'glasses' },
  lumberjack: { hair: '#7c2d12', skin: '#eec09d', shirt: '#b91c1c', pants: '#1e293b', prop: 'axe' },
  herbalist: { hair: '#064e3b', skin: '#fbd6ba', shirt: '#10b981', pants: '#047857', prop: 'herbs' },
  watchman: { hair: '#172554', skin: '#e5b899', shirt: '#312e81', pants: '#0f172a', prop: 'lantern' },
  shepherd: { hair: '#854d0e', skin: '#ffe0c2', shirt: '#84cc16', pants: '#4d7c0f', prop: 'crook' },
};

// Unique poke reaction config for every single one of the 22 villagers!
export const POKE_EFFECTS = {
  drunkard: { anim: 'anim-poke-stagger', sfx: 'glass', particles: ['🍾', '💚', '✨', '🥴'], caption: 'CHOANG!' },
  florist: { anim: 'anim-poke-tickle', sfx: 'chime', particles: ['🌸', '🌺', '🌼', '💮'], caption: 'Hihi nhột!' },
  butcher: { anim: 'anim-poke-chop', sfx: 'chop', particles: ['🔪', '💥', '💢', '🩸'], slash: true, caption: 'PHẬP!' },
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
  { dx: '-26px', dy: '-34px', rot: '-35deg' },
  { dx: '28px', dy: '-30px', rot: '40deg' },
  { dx: '-22px', dy: '14px', rot: '-20deg' },
  { dx: '24px', dy: '18px', rot: '35deg' },
];

export default function PixelVillager({
  avatarId = 'youth',
  alive = true,
  size = 54,
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
                className="absolute text-sm"
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
        <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" className="anim-ghost">
          <rect x="4" y="9" width="8" height="6" fill="#475569" />
          <rect x="5" y="8" width="6" height="1" fill="#64748b" />
          <rect x="7" y="10" width="2" height="4" fill="#1e293b" />
          <rect x="6" y="11" width="4" height="1" fill="#1e293b" />
          <rect x="5" y="2" width="6" height="5" fill="#e2e8f0" opacity="0.88" />
          <rect x="6" y="1" width="4" height="1" fill="#f8fafc" opacity="0.9" />
          <rect x="4" y="3" width="1" height="4" fill="#cbd5e1" opacity="0.8" />
          <rect x="11" y="3" width="1" height="4" fill="#cbd5e1" opacity="0.8" />
          <rect x="6" y="4" width="1" height="1" fill="#0f172a" />
          <rect x="9" y="4" width="1" height="1" fill="#0f172a" />
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
      {/* Sleep zZz bubbles */}
      {isSleeping && !activeBurst && (
        <div className="pointer-events-none absolute -top-2 right-0 text-[11px] font-bold text-indigo-200 anim-zzz select-none">
          zZ
        </div>
      )}

      {/* Ambient pixel smoke for Smoker & Waterpipe */}
      {!isSleeping && (pal.prop === 'cigarette' || pal.prop === 'waterpipe') && (
        <div className="pointer-events-none absolute -top-2 right-1 flex gap-0.5">
          <span className="anim-smoke inline-block h-1.5 w-1.5 bg-slate-200/80" />
          {pal.prop === 'waterpipe' && (
            <span className="anim-smoke inline-block h-2 w-2 bg-white/85" style={{ animationDelay: '0.5s' }} />
          )}
        </div>
      )}

      {/* Poke Particle Bursts & Slash VFX */}
      {bursts.map((b) => (
        <div key={b.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          {b.slash && (
            <div
              className="absolute w-12 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]"
              style={{ animation: 'slashFlash 0.4s ease-out forwards' }}
            />
          )}
          <span
            className="absolute -top-4 font-pixel-title text-[10px] text-amber-300 drop-shadow-[0_2px_0_#000] whitespace-nowrap"
            style={{ animation: 'particleBurst 0.72s ease-out forwards', '--dx': '0px', '--dy': '-18px', '--rot': '0deg' }}
          >
            {b.caption}
          </span>
          {b.particles.map((pt, idx) => (
            <span
              key={idx}
              className="absolute text-base drop-shadow"
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
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        className={isWolfEyes ? 'wolf-eye-glow' : ''}
        style={{
          filter: isNight && isSleeping ? 'brightness(0.68) drop-shadow(0 2px 0 #090812)' : 'drop-shadow(0 2px 0 #090812)',
        }}
      >
        <rect x="4" y="14" width="8" height="1" fill="#000000" opacity="0.45" />
        <rect x="4" y="2" width="8" height="7" fill="#0b0912" />
        <rect x="3" y="3" width="10" height="5" fill="#0b0912" />
        <rect x="4" y="3" width="8" height="5" fill={pal.skin} />

        {/* Hair / Hats */}
        {pal.prop === 'pot' ? (
          <>
            <rect x="3" y="1" width="10" height="3" fill="#94a3b8" />
            <rect x="4" y="0" width="8" height="1" fill="#cbd5e1" />
            <rect x="13" y="2" width="2" height="1" fill="#64748b" />
          </>
        ) : pal.prop === 'strawhat' ? (
          <>
            <rect x="6" y="0" width="4" height="1" fill="#eab308" />
            <rect x="4" y="1" width="8" height="1" fill="#facc15" />
            <rect x="2" y="2" width="12" height="2" fill="#eab308" />
          </>
        ) : pal.prop === 'chefhat' ? (
          <>
            <rect x="5" y="0" width="6" height="2" fill="#ffffff" />
            <rect x="4" y="2" width="8" height="2" fill="#f1f5f9" />
          </>
        ) : pal.prop === 'propeller' ? (
          <>
            <rect x="7" y="0" width="2" height="1" fill="#facc15" />
            <rect x="5" y="1" width="6" height="1" fill="#ef4444" />
            <rect x="4" y="2" width="8" height="2" fill="#38bdf8" />
          </>
        ) : pal.prop === 'flowers' ? (
          <>
            <rect x="4" y="2" width="8" height="2" fill={pal.hair} />
            <rect x="4" y="2" width="2" height="1" fill="#f472b6" />
            <rect x="7" y="2" width="2" height="1" fill="#facc15" />
            <rect x="10" y="2" width="2" height="1" fill="#fb7185" />
          </>
        ) : (
          <>
            <rect x="4" y="2" width="8" height="2" fill={pal.hair} />
            <rect x="3" y="3" width="1" height="2" fill={pal.hair} />
            <rect x="12" y="3" width="1" height="2" fill={pal.hair} />
          </>
        )}

        {/* Eyes: Sleeping vs Wolf Red Eyes vs Awake */}
        {isSleeping ? (
          <>
            <rect x="5" y="6" width="2" height="1" fill="#0b0912" />
            <rect x="9" y="6" width="2" height="1" fill="#0b0912" />
          </>
        ) : isWolfEyes ? (
          <>
            <rect x="5" y="5" width="2" height="2" fill="#ef4444" />
            <rect x="9" y="5" width="2" height="2" fill="#ef4444" />
            <rect x="6" y="5" width="1" height="1" fill="#fef08a" />
            <rect x="10" y="5" width="1" height="1" fill="#fef08a" />
          </>
        ) : pal.prop === 'pot' ? (
          <>
            <rect x="5" y="5" width="2" height="1" fill="#0b0912" />
            <rect x="9" y="4" width="2" height="2" fill="#0b0912" />
          </>
        ) : pal.prop === 'glasses' ? (
          <>
            <rect x="5" y="5" width="2" height="2" fill="#38bdf8" />
            <rect x="7" y="5" width="2" height="1" fill="#0b0912" />
            <rect x="9" y="5" width="2" height="2" fill="#38bdf8" />
          </>
        ) : (
          <>
            <rect x="5" y="5" width="1" height="2" fill="#0b0912" />
            <rect x="10" y="5" width="1" height="2" fill="#0b0912" />
          </>
        )}

        {/* Drunkard rosy nose & cheeks */}
        {pal.prop === 'bottle' && (
          <>
            <rect x="4" y="6" width="1" height="1" fill="#ef4444" />
            <rect x="7" y="6" width="2" height="1" fill="#dc2626" />
            <rect x="11" y="6" width="1" height="1" fill="#ef4444" />
          </>
        )}

        {pal.prop === 'cane' && <rect x="6" y="7" width="4" height="2" fill="#f1f5f9" />}
        {pal.prop === 'cigarette' && (
          <>
            <rect x="9" y="7" width="4" height="1" fill="#ffffff" />
            <rect x="13" y="7" width="1" height="1" fill="#f97316" />
          </>
        )}
        {isAccused && <rect x="7" y="7" width="2" height="1" fill="#ef4444" />}

        {/* Torso */}
        <rect x="4" y="9" width="8" height="4" fill="#0b0912" />
        <rect x="5" y="9" width="6" height="3" fill={pal.shirt} />
        {pal.prop === 'scarf' && <rect x="4" y="8" width="8" height="2" fill="#ef4444" />}
        {pal.prop === 'shawl' && <rect x="4" y="9" width="8" height="2" fill="#c084fc" />}
        {pal.prop === 'cleaver' && <rect x="6" y="10" width="2" height="2" fill="#ef4444" />}

        {/* Feet */}
        <rect x="5" y="12" width="2" height="2" fill={pal.pants} />
        <rect x="9" y="12" width="2" height="2" fill={pal.pants} />

        {/* Props */}
        {pal.prop === 'bottle' && (
          <>
            {/* Green Wine Bottle */}
            <rect x="12" y="7" width="1" height="2" fill="#22c55e" />
            <rect x="11" y="9" width="3" height="4" fill="#16a34a" />
            <rect x="12" y="10" width="1" height="2" fill="#fef08a" />
          </>
        )}
        {pal.prop === 'hammer' && (
          <>
            <rect x="12" y="8" width="1" height="4" fill="#78350f" />
            <rect x="11" y="7" width="3" height="2" fill="#94a3b8" />
          </>
        )}
        {pal.prop === 'chicken' && (
          <>
            <rect x="11" y="10" width="3" height="2" fill="#d97706" />
            <rect x="14" y="11" width="1" height="1" fill="#fef3c7" />
          </>
        )}
        {pal.prop === 'bowl' && <rect x="11" y="10" width="3" height="2" fill="#a8a29e" />}
        {pal.prop === 'waterpipe' && (
          <>
            <rect x="12" y="6" width="2" height="7" fill="#84cc16" />
            <rect x="11" y="11" width="1" height="1" fill="#ef4444" />
          </>
        )}
        {pal.prop === 'cane' && <rect x="2" y="8" width="1" height="6" fill="#92400e" />}
        {pal.prop === 'book' && <rect x="11" y="9" width="3" height="3" fill="#fef08a" />}
        {pal.prop === 'flowers' && (
          <>
            <rect x="1" y="10" width="3" height="2" fill="#a16207" />
            <rect x="1" y="9" width="1" height="1" fill="#f472b6" />
            <rect x="3" y="9" width="1" height="1" fill="#facc15" />
          </>
        )}
        {pal.prop === 'cleaver' && (
          <>
            <rect x="12" y="7" width="2" height="3" fill="#cbd5e1" />
            <rect x="12" y="10" width="1" height="2" fill="#78350f" />
          </>
        )}
        {pal.prop === 'rod' && (
          <>
            <rect x="13" y="4" width="1" height="8" fill="#a16207" />
            <rect x="14" y="4" width="1" height="4" fill="#93c5fd" />
          </>
        )}
        {pal.prop === 'axe' && (
          <>
            <rect x="12" y="7" width="1" height="5" fill="#78350f" />
            <rect x="13" y="7" width="2" height="2" fill="#cbd5e1" />
          </>
        )}
        {pal.prop === 'herbs' && (
          <>
            <rect x="1" y="10" width="3" height="2" fill="#78350f" />
            <rect x="2" y="9" width="2" height="1" fill="#22c55e" />
          </>
        )}
        {pal.prop === 'lantern' && (
          <>
            <rect x="12" y="9" width="1" height="2" fill="#475569" />
            <rect x="12" y="11" width="2" height="2" fill="#fde047" />
          </>
        )}
        {pal.prop === 'crook' && (
          <>
            <rect x="2" y="6" width="1" height="8" fill="#a16207" />
            <rect x="2" y="6" width="2" height="1" fill="#a16207" />
          </>
        )}
      </svg>
    </div>
  );
}
