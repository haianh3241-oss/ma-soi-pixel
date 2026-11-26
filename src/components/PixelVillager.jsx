import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx.js';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { VILLAGER_MOTION, getVillagerMotion } from '../data/villagerMotion.js';

export const POKE_EFFECTS = VILLAGER_MOTION;

const PARTICLE_VECTORS = [
  { dx: '-28px', dy: '-34px', rot: '-35deg' },
  { dx: '30px', dy: '-30px', rot: '40deg' },
  { dx: '-24px', dy: '14px', rot: '-20deg' },
  { dx: '26px', dy: '18px', rot: '35deg' },
];

export default function PixelVillager({
  avatarId = 'youth',
  alive = true,
  size = 82,
  isNight = false,
  eyeState = 'awake', // 'awake' | 'sleep' | 'wolf'
  isSpeaking = false,
  animate = true,
  still = false,
  emoteKey = null,
  isAccused = false,
  enablePoke = false,
  staggerIndex = 0,
  onPokeExtra = null,
  onHeavyImpact = null,
}) {
  const motion = getVillagerMotion(avatarId);
  const [bursts, setBursts] = useState([]);
  const [reactingPlayId, setReactingPlayId] = useState(null);
  const [sleepFallback, setSleepFallback] = useState(false);

  const playCounterRef = useRef(0);
  const lastEmoteKeyRef = useRef(emoteKey);
  const timersRef = useRef([]);

  const clearMotionTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    setSleepFallback(false);
    setReactingPlayId(null);
  }, [avatarId]);

  useEffect(() => () => clearMotionTimers(), [clearMotionTimers]);

  const triggerEmoteSequence = useCallback(
    (immediateTapFeedback = false) => {
      if (!alive) {
        sfx.play('pop');
        const id = Date.now() + Math.random();
        setBursts((prev) => [...prev, { id, particles: ['👻', '💨', '🕯️', '✨'], caption: 'Hù!' }]);
        const t = setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 750);
        timersRef.current.push(t);
        return;
      }

      if (immediateTapFeedback) {
        sfx.play('tick');
      }

      const nextPlay = ++playCounterRef.current;
      setReactingPlayId(nextPlay);

      const impactDelay = Math.round((motion.impactMs || 600) * 0.7);
      const impactTimer = setTimeout(() => {
        sfx.play(motion.sfx);
        if (motion.heavyImpact && onHeavyImpact) onHeavyImpact();
        const bid = Date.now() + Math.random();
        setBursts((prev) => [
          ...prev,
          {
            id: bid,
            particles: motion.particles,
            caption: motion.caption,
            slash: motion.slash,
            animClass: motion.animClass,
          },
        ]);
        const cleanupBurst = setTimeout(() => {
          setBursts((prev) => prev.filter((b) => b.id !== bid));
        }, 760);
        timersRef.current.push(cleanupBurst);
      }, impactDelay);

      const endTimer = setTimeout(() => {
        setReactingPlayId((cur) => (cur === nextPlay ? null : cur));
      }, (motion.emoteMs || 1600) + 60);

      timersRef.current.push(impactTimer, endTimer);
    },
    [alive, motion, onHeavyImpact]
  );

  // External trigger (e.g., hit by throwable projectile or stepping up for Day Defense)
  useEffect(() => {
    if (emoteKey == null || still) return;
    if (lastEmoteKeyRef.current === emoteKey) return;
    lastEmoteKeyRef.current = emoteKey;
    triggerEmoteSequence(false);
  }, [emoteKey, still, triggerEmoteSequence]);

  const handlePoke = (e) => {
    if (!enablePoke) return;
    if (onPokeExtra) onPokeExtra(e);
    triggerEmoteSequence(true);
  };

  const activeBurst = bursts[bursts.length - 1];
  const isReacting = alive && !still && reactingPlayId !== null;
  const isSleeping = alive && eyeState === 'sleep' && !isReacting;
  const isWolfEyes = alive && eyeState === 'wolf';

  let spriteSrc;
  if (!alive) {
    spriteSrc = ASSET_PATHS.ghostTombstone;
  } else if (still) {
    spriteSrc = ASSET_PATHS.characterIcon(avatarId);
  } else if (isReacting) {
    spriteSrc = `${ASSET_PATHS.characterEmote(avatarId)}?play=${reactingPlayId}`;
  } else if (isSleeping && !sleepFallback) {
    spriteSrc = ASSET_PATHS.characterSleep(avatarId);
  } else {
    spriteSrc = ASSET_PATHS.characterIdle(avatarId);
  }

  // IMPORTANT: Never stack CSS anim-soul-idle over animated idle.webp / emote.webp (prevents double bounce!)
  const motionClass = !alive
    ? 'anim-ghost'
    : activeBurst
      ? activeBurst.animClass || motion.animClass || 'anim-poke-tickle'
      : isReacting
        ? ''
        : isSleeping
          ? 'anim-sleep-nod'
          : isSpeaking
            ? 'anim-talk-active'
            : '';

  const staggerSec = ((staggerIndex % 16) * 0.23).toFixed(2);
  const motionStyle = isSleeping
    ? { animationDelay: `-${staggerSec}s`, animationDuration: `${motion.sleepSec || 3.1}s` }
    : undefined;

  return (
    <div
      onClick={handlePoke}
      className={`relative flex items-end justify-center ${motionClass} ${enablePoke ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size, ...motionStyle }}
    >
      {/* Ground oval shadow anchored to terracotta brick floor */}
      <div
        className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full blur-[1px] transition-all ${
          isWolfEyes ? 'bg-red-700/65 shadow-[0_0_12px_rgba(239,68,68,0.85)]' : 'bg-black/45'
        }`}
        style={{ width: size * 0.66, height: Math.max(6, size * 0.14) }}
      />

      {/* Tombstone mini portrait badge so friends recognize who fell */}
      {!alive && (
        <img
          src={ASSET_PATHS.characterIcon(avatarId)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute bottom-0.5 -left-1 z-20 rounded-full border-2 border-[#191413] bg-[#e4cda8] object-contain grayscale opacity-90 shadow"
          style={{ width: Math.max(20, Math.round(size * 0.34)), height: Math.max(20, Math.round(size * 0.34)) }}
        />
      )}

      {/* Nighttime warm lantern glow for Anh Gác Đêm */}
      {alive && isNight && !isSleeping && motion.ambientLantern && (
        <div
          className="pointer-events-none absolute -inset-2 rounded-full opacity-55"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0) 70%)',
          }}
        />
      )}

      {/* Comic ink-bordered zZ bubble */}
      {isSleeping && (
        <div className="pointer-events-none absolute -top-2 -right-2 z-20 sc-zzz-bubble px-1.5 py-0.2 text-[10px] leading-tight anim-zzz select-none">
          zZ
        </div>
      )}

      {/* Glowing red wolf-eye flare visible strictly to fellow wolves at night */}
      {isWolfEyes && (
        <div className="pointer-events-none absolute top-[16%] left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
        </div>
      )}

      {/* Ambient smoke for Smoker & Waterpipe */}
      {alive && !isSleeping && motion.ambientSmoke && (
        <div className="pointer-events-none absolute -top-2 right-1 flex gap-1 z-20">
          <span className="anim-smoke inline-block w-2.5 h-2.5 rounded-full bg-slate-100/75" />
          {avatarId === 'waterpipe' && (
            <span className="anim-smoke inline-block w-3 h-3 rounded-full bg-white/80" style={{ animationDelay: '0.5s' }} />
          )}
        </div>
      )}

      {/* Poke / Emote Impact Particle Bursts & Slash VFX */}
      {bursts.map((b) => (
        <div key={b.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          {b.slash && (
            <div
              className="absolute w-14 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff]"
              style={{ animation: 'slashFlash 0.4s ease-out forwards' }}
            />
          )}
          <span
            className="absolute -top-5 font-extrabold text-xs text-amber-300 drop-shadow-[0_2px_0_#140f0e] whitespace-nowrap"
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
                '--dx': PARTICLE_VECTORS[idx % PARTICLE_VECTORS.length].dx,
                '--dy': PARTICLE_VECTORS[idx % PARTICLE_VECTORS.length].dy,
                '--rot': PARTICLE_VECTORS[idx % PARTICLE_VECTORS.length].rot,
              }}
            >
              {pt}
            </span>
          ))}
        </div>
      ))}

      {still ? (
        <picture className="relative z-10 w-full h-full flex items-end justify-center">
          <img
            src={spriteSrc}
            alt={motion.name}
            draggable={false}
            className="w-full h-full object-contain select-none"
          />
        </picture>
      ) : (
        <picture className="relative z-10 w-full h-full flex items-end justify-center">
          {alive && <source media="(prefers-reduced-motion: reduce)" srcSet={ASSET_PATHS.characterIcon(avatarId)} />}
          <img
            src={spriteSrc}
            alt={motion.name}
            draggable={false}
            onError={() => {
              if (isSleeping && !sleepFallback) setSleepFallback(true);
            }}
            className={`w-full h-full object-contain select-none ${isWolfEyes ? 'wolf-eye-glow' : ''}`}
            style={{
              filter: isAccused
                ? 'drop-shadow(0 0 10px rgba(239,68,68,0.95)) drop-shadow(0 3px 0 rgba(17,13,12,0.55))'
                : isNight && isSleeping
                  ? 'brightness(0.76) saturate(0.88) drop-shadow(0 3px 0 rgba(17,13,12,0.55))'
                  : 'drop-shadow(0 3px 0 rgba(17,13,12,0.5))',
            }}
          />
        </picture>
      )}
    </div>
  );
}
