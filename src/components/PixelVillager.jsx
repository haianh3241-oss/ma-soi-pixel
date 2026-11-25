import React, { useState } from 'react';
import { sfx } from '../audio/sfx.js';
import { ASSET_PATHS, POKE_EFFECTS } from '../../graphics-pack/themeConfig.js';

export { POKE_EFFECTS };

const PARTICLE_VECTORS = [
  { dx: '-28px', dy: '-34px', rot: '-35deg' },
  { dx: '30px', dy: '-30px', rot: '40deg' },
  { dx: '-24px', dy: '14px', rot: '-20deg' },
  { dx: '26px', dy: '18px', rot: '35deg' },
];

export default function PixelVillager({
  avatarId = 'youth',
  alive = true,
  size = 76,
  isNight = false,
  eyeState = 'awake', // 'awake' | 'sleep' | 'wolf'
  animate = true,
  isAccused = false,
  enablePoke = false,
  onPokeExtra = null,
}) {
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

  const spriteSrc = alive ? ASSET_PATHS.character(avatarId) : ASSET_PATHS.ghostTombstone;

  const idleClass = !alive
    ? 'anim-ghost'
    : activeBurst
      ? activeBurst.anim
      : isSleeping
        ? 'anim-sleep-nod'
        : animate
          ? 'anim-soul-idle'
          : '';

  return (
    <div
      onClick={handlePoke}
      className={`relative flex items-end justify-center ${idleClass} ${enablePoke ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size }}
    >
      {/* Ground oval shadow */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/45 blur-[1px]"
        style={{ width: size * 0.68, height: Math.max(6, size * 0.14) }}
      />

      {/* Comic white zZ bubble (matching Supercell Night style) */}
      {isSleeping && !activeBurst && (
        <div className="pointer-events-none absolute -top-2 -right-2 z-20 sc-zzz-bubble px-1.5 py-0.2 text-[10px] leading-tight anim-zzz select-none">
          zZ
        </div>
      )}

      {/* Glowing red wolf-eye flare visible strictly to fellow wolves at night */}
      {isWolfEyes && (
        <div className="pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
        </div>
      )}

      {/* Ambient smoke for Smoker & Waterpipe */}
      {alive && !isSleeping && (avatarId === 'smoker' || avatarId === 'waterpipe') && (
        <div className="pointer-events-none absolute -top-2 right-1 flex gap-1 z-20">
          <span className="anim-smoke inline-block w-2.5 h-2.5 rounded-full bg-slate-200/75" />
          {avatarId === 'waterpipe' && (
            <span className="anim-smoke inline-block w-3 h-3 rounded-full bg-white/80" style={{ animationDelay: '0.5s' }} />
          )}
        </div>
      )}

      {/* Poke Particle Bursts & Slash VFX */}
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

      <img
        src={spriteSrc}
        alt={avatarId}
        draggable={false}
        className={`relative z-10 w-full h-full object-contain select-none ${isWolfEyes ? 'wolf-eye-glow' : ''}`}
        style={{
          filter: isAccused
            ? 'drop-shadow(0 0 10px rgba(239,68,68,0.95)) drop-shadow(0 3px 0 rgba(0,0,0,0.5))'
            : isNight && isSleeping
              ? 'brightness(0.78) drop-shadow(0 3px 0 rgba(0,0,0,0.45))'
              : 'drop-shadow(0 3px 0 rgba(0,0,0,0.45))',
        }}
      />
    </div>
  );
}
