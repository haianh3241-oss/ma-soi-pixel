import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx.js';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import {
  VILLAGER_MOTION,
  getVillagerMotion,
  isVillagerRigReady,
  subscribeRigReady,
} from '../data/villagerMotion.js';
import VillagerPuppetRig from './VillagerPuppetRig.jsx';

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
  animState = 'idle', // 'idle' | 'walk' | 'run' | 'jump' | 'punch' | 'kick' | 'hit' | 'sleep' | 'ghost'
  wolfFormRole = null, // null | 'werewolf' | 'cursed_wolf'
  isSpeaking = false,
  still = false,
  emoteKey = null,
  isAccused = false,
  enablePoke = false,
  hideShadow = false,
  staggerIndex = 0,
  onPokeExtra = null,
  onHeavyImpact = null,
}) {
  const motion = getVillagerMotion(avatarId);
  const [bursts, setBursts] = useState([]);
  const [reactingPlayId, setReactingPlayId] = useState(null);
  const [sleepFallback, setSleepFallback] = useState(false);
  const [poseFallback, setPoseFallback] = useState(false);
  const [ghostFallback, setGhostFallback] = useState(false);
  const [rigReady, setRigReady] = useState(() => isVillagerRigReady(avatarId));

  const playCounterRef = useRef(0);
  const lastEmoteKeyRef = useRef(emoteKey);
  const timersRef = useRef([]);

  const clearMotionTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    setSleepFallback(false);
    setPoseFallback(false);
    setGhostFallback(false);
    setReactingPlayId(null);
    setRigReady(isVillagerRigReady(avatarId));
  }, [avatarId, animState, wolfFormRole]);

  useEffect(() => {
    if (rigReady) return undefined;
    const slug = motion.slug;
    return subscribeRigReady((loadedSlug) => {
      if (loadedSlug === slug) setRigReady(true);
    });
  }, [rigReady, motion.slug]);

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
  const isGhostRender = !alive && animState === 'ghost';
  const isSleeping = alive && (animState === 'sleep' || eyeState === 'sleep') && !isReacting;
  const isAttacking = alive && (animState === 'punch' || animState === 'kick');
  const isHitstun = alive && animState === 'hit';
  const isWolfEyes = alive && (eyeState === 'wolf' || Boolean(wolfFormRole));

  const puppetPose =
    !still && !isReacting && !wolfFormRole && !isGhostRender && !isSleeping && rigReady
      ? alive && ['walk', 'run', 'jump', 'punch', 'kick', 'hit'].includes(animState)
        ? animState
        : null
      : null;

  let spriteSrc;
  if (!alive && !isGhostRender) {
    spriteSrc = ASSET_PATHS.ghostTombstone;
  } else if (isGhostRender && !ghostFallback) {
    spriteSrc = ASSET_PATHS.characterGhost(avatarId);
  } else if (still) {
    spriteSrc = ASSET_PATHS.characterIcon(avatarId);
  } else if (wolfFormRole && alive) {
    const wolfPose =
      isAttacking || isReacting
        ? 'bite'
        : animState === 'walk' || animState === 'run' || animState === 'jump'
          ? 'walk'
          : 'idle';
    spriteSrc = ASSET_PATHS.wolfBeast(wolfFormRole, wolfPose);
  } else if (isReacting) {
    spriteSrc = `${ASSET_PATHS.characterEmote(avatarId)}?play=${reactingPlayId}`;
  } else if (isAttacking && !poseFallback) {
    spriteSrc = ASSET_PATHS.characterPunchline(avatarId);
  } else if (isHitstun && !poseFallback) {
    spriteSrc = ASSET_PATHS.characterWindup(avatarId);
  } else if (isSleeping && !sleepFallback) {
    spriteSrc = ASSET_PATHS.characterSleep(avatarId);
  } else {
    spriteSrc = ASSET_PATHS.characterIdle(avatarId);
  }

  const motionClass = isGhostRender || (!alive && !isGhostRender)
    ? 'anim-ghost'
    : activeBurst
      ? activeBurst.animClass || motion.animClass || 'anim-poke-tickle'
      : isReacting
        ? ''
        : !rigReady && alive && (animState === 'walk' || animState === 'run')
          ? 'anim-talk-active'
          : isSpeaking && !isSleeping
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
      {/* Ground oval shadow (skipped when VillageArena drives Z-separated shadow directly) */}
      {!hideShadow && (
        <div
          className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full blur-[1px] transition-all ${
            isWolfEyes ? 'bg-red-700/65 shadow-[0_0_12px_rgba(239,68,68,0.85)]' : 'bg-black/45'
          }`}
          style={{ width: size * 0.66, height: Math.max(6, size * 0.14) }}
        />
      )}

      {/* Fallback mist aura ONLY if custom character ghost.png failed */}
      {isGhostRender && ghostFallback && (
        <img
          src={ASSET_PATHS.ghostTailAura}
          alt=""
          draggable={false}
          className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 z-0 opacity-80 object-contain"
          style={{ width: Math.round(size * 0.92), height: Math.round(size * 0.92) }}
        />
      )}

      {/* Tombstone mini portrait badge (when showing static tombstone) */}
      {!alive && !isGhostRender && (
        <img
          src={ASSET_PATHS.characterIcon(avatarId)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute bottom-0.5 -left-1 z-20 rounded-full border-2 border-[#191413] bg-[#e4cda8] object-contain grayscale opacity-90 shadow"
          style={{ width: Math.max(20, Math.round(size * 0.34)), height: Math.max(20, Math.round(size * 0.34)) }}
        />
      )}

      {/* Nighttime warm lantern glow for Anh Gác Đêm */}
      {alive && isNight && !isSleeping && !wolfFormRole && motion.ambientLantern && (
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

      {/* Stun stars when knocked by Kick */}
      {isHitstun && (
        <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 z-30 flex gap-1 text-sm animate-bounce select-none">
          <span>💫</span>
          <span>⭐</span>
        </div>
      )}

      {/* Glowing red wolf-eye flare when fellow wolf in villager disguise */}
      {isWolfEyes && !wolfFormRole && (
        <div className="pointer-events-none absolute top-[16%] left-1/2 -translate-x-1/2 z-20 flex gap-2.5">
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
          <span className="w-2.5 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ff2d2d,0_0_16px_#ef4444]" />
        </div>
      )}

      {/* Ambient smoke for Smoker & Waterpipe */}
      {alive && !isSleeping && !wolfFormRole && motion.ambientSmoke && (
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
      ) : puppetPose ? (
        <div
          className="relative z-10 w-full h-full flex items-end justify-center"
          style={{
            opacity: isGhostRender ? 0.68 : 1,
            filter: isGhostRender
              ? 'drop-shadow(0 0 10px rgba(56,189,248,0.8))'
              : isHitstun
                ? 'brightness(1.7)'
                : undefined,
          }}
        >
          <VillagerPuppetRig
            avatarId={avatarId}
            size={size}
            pose={puppetPose}
            emoteHead={isGhostRender || isAttacking || isHitstun}
          />
        </div>
      ) : (
        <picture
          className={`relative z-10 w-full h-full flex items-end justify-center ${
            isSleeping ? 'anim-sleep-lie' : ''
          }`}
        >
          {alive && !wolfFormRole && !isAttacking && !isHitstun && !isSleeping && (
            <source media="(prefers-reduced-motion: reduce)" srcSet={ASSET_PATHS.characterIcon(avatarId)} />
          )}
          <img
            src={spriteSrc}
            alt={motion.name}
            draggable={false}
            decoding="async"
            onError={() => {
              if (isGhostRender && !ghostFallback) setGhostFallback(true);
              else if (isSleeping && !sleepFallback) setSleepFallback(true);
              else if ((isAttacking || isHitstun) && !poseFallback) setPoseFallback(true);
            }}
            className={`w-full h-full object-contain select-none ${isWolfEyes ? 'wolf-eye-glow' : ''}`}
            style={{
              opacity: isGhostRender ? 0.86 : 1,
              filter: isGhostRender
                ? 'drop-shadow(0 0 10px rgba(56,189,248,0.85)) brightness(1.06)'
                : isHitstun
                  ? 'brightness(1.7)'
                  : isAccused
                    ? 'drop-shadow(0 0 10px rgba(239,68,68,0.95))'
                    : isNight && isSleeping
                      ? 'brightness(0.84) saturate(0.92)'
                      : undefined,
            }}
          />
        </picture>
      )}
    </div>
  );
}
