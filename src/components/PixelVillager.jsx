import React, { useEffect, useState } from 'react';
import { sfx } from '../audio/sfx.js';
import { ASSET_PATHS, POKE_EFFECTS, SPRITE_SHEETS } from '../../graphics-pack/themeConfig.js';

export { POKE_EFFECTS };

// Cache missing optional state images (<id>_sleep.png, <id>_talk.png, <id>_poke.png)
// so we never re-probe missing files on every render
const missingStateSprites = new Set();

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
  isSpeaking = false,
  animate = true,
  isAccused = false,
  enablePoke = false,
  onPokeExtra = null,
}) {
  const [bursts, setBursts] = useState([]);
  const [failedUrls, setFailedUrls] = useState({});
  const [frameIdx, setFrameIdx] = useState(0);

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

  // Determine desired state image: poke -> sleep -> talk -> idle
  const desiredState = !alive
    ? 'dead'
    : activeBurst
      ? 'poke'
      : isSleeping
        ? 'sleep'
        : isSpeaking
          ? 'talk'
          : 'idle';

  const baseSrc = alive ? ASSET_PATHS.character(avatarId) : ASSET_PATHS.ghostTombstone;
  const stateUrl =
    alive && desiredState !== 'idle' ? ASSET_PATHS.characterState(avatarId, desiredState) : null;
  const useStateUrl = Boolean(stateUrl && !missingStateSprites.has(stateUrl) && !failedUrls[stateUrl]);
  const spriteSrc = useStateUrl ? stateUrl : baseSrc;

  // Optional horizontal sprite sheet animation if configured in themeConfig.js -> SPRITE_SHEETS
  const sheetCfg = SPRITE_SHEETS[avatarId];
  const frameCount = !alive || !sheetCfg
    ? 1
    : desiredState === 'sleep'
      ? sheetCfg.sleepFrames || 1
      : desiredState === 'talk'
        ? sheetCfg.talkFrames || 1
        : sheetCfg.idleFrames || 1;

  useEffect(() => {
    if (frameCount <= 1) {
      setFrameIdx(0);
      return;
    }
    const fps = sheetCfg?.fps || 6;
    const iv = setInterval(() => {
      setFrameIdx((f) => (f + 1) % frameCount);
    }, Math.round(1000 / fps));
    return () => clearInterval(iv);
  }, [frameCount, sheetCfg?.fps]);

  const idleClass = !alive
    ? 'anim-ghost'
    : activeBurst
      ? activeBurst.anim
      : isSleeping
        ? 'anim-sleep-nod'
        : isSpeaking
          ? 'anim-talk-active'
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

      {/* Comic white zZ bubble */}
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

      {frameCount > 1 ? (
        <div
          className={`relative z-10 w-full h-full select-none ${isWolfEyes ? 'wolf-eye-glow' : ''}`}
          style={{
            backgroundImage: `url('${spriteSrc}')`,
            backgroundSize: `${frameCount * 100}% 100%`,
            backgroundPosition: `${(frameIdx / Math.max(1, frameCount - 1)) * 100}% 0%`,
            backgroundRepeat: 'no-repeat',
            filter: isAccused
              ? 'drop-shadow(0 0 10px rgba(239,68,68,0.95)) drop-shadow(0 3px 0 rgba(0,0,0,0.5))'
              : isNight && isSleeping
                ? 'brightness(0.78) drop-shadow(0 3px 0 rgba(0,0,0,0.45))'
                : 'drop-shadow(0 3px 0 rgba(0,0,0,0.45))',
          }}
        />
      ) : (
        <img
          src={spriteSrc}
          alt={avatarId}
          draggable={false}
          onError={() => {
            if (useStateUrl && stateUrl) {
              missingStateSprites.add(stateUrl);
              setFailedUrls((prev) => ({ ...prev, [stateUrl]: true }));
            }
          }}
          className={`relative z-10 w-full h-full object-contain select-none ${isWolfEyes ? 'wolf-eye-glow' : ''}`}
          style={{
            filter: isAccused
              ? 'drop-shadow(0 0 10px rgba(239,68,68,0.95)) drop-shadow(0 3px 0 rgba(0,0,0,0.5))'
              : isNight && isSleeping
                ? 'brightness(0.78) drop-shadow(0 3px 0 rgba(0,0,0,0.45))'
                : 'drop-shadow(0 3px 0 rgba(0,0,0,0.45))',
          }}
        />
      )}
    </div>
  );
}
