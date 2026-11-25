import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Clock, FastForward } from 'lucide-react';
import { INTERACTIONS, PHASES, SUSPECT_TAGS } from '../../shared/constants.js';
import PixelVillager from './PixelVillager.jsx';
import { formatCountdown, isWolfRole } from '../utils/helpers.js';
import { sfx } from '../audio/sfx.js';

function Campfire25D({ isNight }) {
  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {isNight && (
        <div
          className="absolute w-48 h-36 sm:w-64 sm:h-48 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(251,146,60,0.45) 0%, rgba(251,146,60,0) 72%)',
          }}
        />
      )}

      {!isNight && (
        <div className="absolute -top-6 flex gap-1.5">
          <span className="anim-smoke inline-block w-2.5 h-2.5 rounded-full bg-slate-200/70" />
          <span className="anim-smoke inline-block w-3 h-3 rounded-full bg-slate-100/60" style={{ animationDelay: '0.6s' }} />
        </div>
      )}

      <svg
        viewBox="0 0 80 68"
        width={84}
        height={72}
        className={`w-16 h-14 sm:w-22 sm:h-20 ${isNight ? 'anim-fire' : ''}`}
      >
        {/* Ground shadow */}
        <ellipse cx="40" cy="54" rx="28" ry="9" fill="#000" opacity="0.3" />
        {/* Stone ring */}
        <ellipse cx="20" cy="52" rx="6" ry="4" fill="#64748b" stroke="#111322" strokeWidth="2.5" />
        <ellipse cx="32" cy="56" rx="7" ry="4.5" fill="#475569" stroke="#111322" strokeWidth="2.5" />
        <ellipse cx="48" cy="56" rx="7" ry="4.5" fill="#64748b" stroke="#111322" strokeWidth="2.5" />
        <ellipse cx="60" cy="52" rx="6" ry="4" fill="#475569" stroke="#111322" strokeWidth="2.5" />
        {/* Crossed wooden logs */}
        <rect x="20" y="42" width="40" height="9" rx="4" transform="rotate(-12 40 46)" fill={isNight ? '#92400e' : '#3f3f46'} stroke="#111322" strokeWidth="2.5" />
        <rect x="20" y="42" width="40" height="9" rx="4" transform="rotate(12 40 46)" fill={isNight ? '#78350f' : '#27272a'} stroke="#111322" strokeWidth="2.5" />

        {isNight ? (
          <g>
            <path
              d="M40 8 C54 24 58 38 40 46 C22 38 26 24 40 8 Z"
              fill="#f97316"
              stroke="#111322"
              strokeWidth="2.5"
            />
            <path
              d="M40 16 C48 27 50 38 40 44 C30 38 32 27 40 16 Z"
              fill="#facc15"
            />
            <path d="M40 24 C44 31 45 38 40 42 C35 38 36 31 40 24 Z" fill="#fef08a" />
          </g>
        ) : (
          <ellipse cx="40" cy="45" rx="10" ry="3.5" fill="#52525b" stroke="#111322" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}

export default function VillageArena({
  room,
  me,
  nowMs,
  speakingPeers,
  activeReactions,
  projectiles,
  chatBubbles,
  suspectTags,
  selectedThrow,
  onClearThrow,
  onSetSuspectTag,
  onNightCupid,
  onNightGuard,
  onNightWolfVote,
  onNightSeer,
  onNightWitch,
  onHunterShot,
  onDayVote,
  onToggleSkip,
  onExtendDiscuss,
  onVerdictVote,
  onInteract,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tagPickerFor, setTagPickerFor] = useState(null);
  const [cupidPick, setCupidPick] = useState([]);
  const [curseToggle, setCurseToggle] = useState(false);
  const [witchMode, setWitchMode] = useState('idle');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const priv = room.selfPrivate;
  const myRole = priv?.role;
  const isNight = room.phase === PHASES.NIGHT;
  const secondsLeft = formatCountdown(room.phaseEndsAt, nowMs);
  const activePlayers = useMemo(() => room.players.filter((p) => !p.isSpectator), [room.players]);
  const alivePlayers = useMemo(() => activePlayers.filter((p) => p.alive), [activePlayers]);

  const skipVotes = room.skipVotes || [];
  const iSkipped = me ? skipVotes.includes(me.id) : false;
  const canSkipNow =
    me?.alive &&
    !me?.isSpectator &&
    [PHASES.DAY_DISCUSS, PHASES.DAY_DEFENSE, PHASES.NIGHT].includes(room.phase);

  const dayVoteTally = useMemo(() => {
    const map = {};
    for (const entry of Object.values(room.publicDayVotes || {})) {
      map[entry.targetId] = (map[entry.targetId] || 0) + (entry.weight || 1);
    }
    return map;
  }, [room.publicDayVotes]);

  const verdictTally = useMemo(() => {
    let hang = 0;
    let spare = 0;
    for (const entry of Object.values(room.publicVerdictVotes || {})) {
      if (entry.choice === 'HANG') hang += entry.weight || 1;
      else spare += entry.weight || 1;
    }
    return { hang, spare };
  }, [room.publicVerdictVotes]);

  const isMySoloNightTurn = useMemo(() => {
    if (!isNight || !me?.alive || me?.isSpectator || priv?.villagePowersLost || priv?.myNightDone) return false;
    if (room.nightStage === 'EARLY') {
      if (myRole === 'cupid' && room.dayCount === 1) return true;
      if (myRole === 'guard') return true;
    }
    if (room.nightStage === 'LATE') {
      if (myRole === 'seer') return true;
      if (myRole === 'witch' && (priv?.witchHealLeft || priv?.witchPoisonLeft)) return true;
    }
    return false;
  }, [isNight, me, priv, room.nightStage, room.dayCount, myRole]);

  const getEyeState = (p) => {
    if (!p.alive) return 'awake';
    if (!isNight) return 'awake';
    if (me?.alive && isWolfRole(myRole)) {
      if (p.role && isWolfRole(p.role)) return 'wolf';
      return 'sleep';
    }
    if (p.id === me?.id && isMySoloNightTurn) return 'awake';
    return 'sleep';
  };

  const getTargetAction = (p) => {
    if (selectedThrow) {
      return {
        label: '🎯',
        color: 'bg-sky-400 text-black',
        run: () => {
          onInteract(p.id, selectedThrow);
          onClearThrow();
        },
      };
    }
    if (!me?.alive || me?.isSpectator || !p.alive) return null;

    if (room.phase === PHASES.DAY_DISCUSS) {
      const voted = room.publicDayVotes?.[me.id]?.targetId === p.id;
      return {
        label: voted ? '✓' : '🗳️',
        color: voted ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white',
        run: () => {
          sfx.play('click');
          onDayVote(p.id);
        },
      };
    }

    if (room.phase === PHASES.HUNTER_SHOT && room.activeHunterId === me.id && p.id !== me.id) {
      return {
        label: '🏹',
        color: 'bg-orange-400 text-black',
        run: () => {
          sfx.play('gunshot');
          onHunterShot(p.id);
        },
      };
    }

    if (isNight && room.nightStage === 'EARLY') {
      if (myRole === 'cupid' && room.dayCount === 1 && !priv?.villagePowersLost && !priv?.myNightDone) {
        const picked = cupidPick.includes(p.id);
        return {
          label: picked ? '💘' : '🤍',
          color: picked ? 'bg-pink-500 text-white' : 'bg-pink-900 text-pink-200',
          run: () => {
            sfx.play('click');
            setCupidPick((prev) => {
              if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
              const next = [...prev, p.id];
              if (next.length === 2) {
                onNightCupid(next);
                return [];
              }
              return next;
            });
          },
        };
      }
      if (myRole === 'guard' && !priv?.villagePowersLost && !priv?.myNightDone && p.id !== priv?.lastGuardedId) {
        return {
          label: '🛡️',
          color: 'bg-sky-400 text-black',
          run: () => {
            sfx.play('click');
            onNightGuard(p.id);
          },
        };
      }
      if (isWolfRole(myRole) && !isWolfRole(p.role)) {
        const picked = priv?.wolfVotes?.[me.id] === p.id;
        return {
          label: '🐺',
          color: picked ? 'bg-red-500 text-white ring-2 ring-amber-300' : 'bg-red-900 text-red-100',
          run: () => {
            sfx.play('click');
            onNightWolfVote(p.id, curseToggle, true);
          },
        };
      }
    }

    if (isNight && room.nightStage === 'LATE') {
      if (myRole === 'seer' && !priv?.villagePowersLost && !priv?.myNightDone && p.id !== me.id) {
        return {
          label: '🔮',
          color: 'bg-indigo-500 text-white',
          run: () => {
            sfx.play('pop');
            onNightSeer(p.id);
          },
        };
      }
      if (myRole === 'witch' && witchMode === 'poison' && !priv?.villagePowersLost && !priv?.myNightDone) {
        return {
          label: '☠️',
          color: 'bg-purple-600 text-white',
          run: () => {
            sfx.play('click');
            onNightWitch({ heal: false, poisonTargetId: p.id });
            setWitchMode('idle');
          },
        };
      }
    }

    return null;
  };

  // 2.5D Oblique Ellipse Layout (squashed Y for 3/4 top-down perspective!)
  const count = activePlayers.length;
  const compact = size.w < 560 || size.h < 480;
  const baseSprite = compact ? 48 : size.w > 950 ? 64 : 54;
  const rx = Math.max(115, size.w * (size.w < 600 ? 0.37 : 0.36));
  const ry = Math.max(88, size.h * (size.h < 500 ? 0.28 : 0.26));
  const centerYOffset = size.h * 0.06; // shift ground slightly down to leave sky layer visible!

  const myDayVote = me ? room.publicDayVotes?.[me.id]?.targetId : null;
  const myVerdictVote = me ? room.publicVerdictVotes?.[me.id]?.choice : null;
  const accusedPlayer = room.accusedId ? room.players.find((p) => p.id === room.accusedId) : null;
  const witchVictim = priv?.witchVictimId ? room.players.find((p) => p.id === priv.witchVictimId) : null;

  return (
    <div
      ref={containerRef}
      onClick={() => setTagPickerFor(null)}
      className="relative w-full h-full overflow-hidden select-none"
    >
      {/* LAYER 1: SKY & CELESTIAL (Bright Blue Sky + Sun vs Deep Night + Moon) */}
      <div
        className="pointer-events-none absolute inset-0 transition-colors duration-1000"
        style={{
          background: isNight
            ? 'linear-gradient(180deg, #070b1e 0%, #151c42 38%, #18233a 100%)'
            : 'linear-gradient(180deg, #38bdf8 0%, #93c5fd 30%, #65a30d 34%, #4d7c0f 100%)',
        }}
      >
        {isNight ? (
          <>
            {/* Bright Full Moon */}
            <div className="absolute top-6 right-[12%] w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-amber-100 shadow-[0_0_40px_rgba(254,243,199,0.75)] border-4 border-amber-200/60" />
            {/* Twinkling Stars */}
            <div className="absolute top-5 left-[12%] w-1.5 h-1.5 rounded-full bg-white opacity-80" />
            <div className="absolute top-12 left-[28%] w-1 h-1 rounded-full bg-amber-100 opacity-75" />
            <div className="absolute top-7 left-[56%] w-1.5 h-1.5 rounded-full bg-sky-100 opacity-70" />
            <div className="absolute top-14 left-[75%] w-1 h-1 rounded-full bg-white opacity-60" />
          </>
        ) : (
          <>
            {/* Golden Sun + Clouds */}
            <div className="absolute top-4 right-[12%] w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-yellow-300 shadow-[0_0_50px_rgba(253,224,71,0.95)] border-4 border-amber-200" />
            <div className="absolute top-7 left-[14%] w-20 h-7 rounded-full bg-white/85 shadow-sm" />
            <div className="absolute top-11 left-[44%] w-24 h-8 rounded-full bg-white/80 shadow-sm" />
          </>
        )}

        {/* LAYER 2: Distant Cartoon Village Backdrop (Hills, Trees, Cottages) */}
        <svg
          viewBox="0 0 1200 260"
          preserveAspectRatio="none"
          className="absolute top-[16%] left-0 w-full h-[26%] transition-all duration-1000"
        >
          {/* Rolling Hills */}
          <path
            d="M0 180 Q300 90 600 165 T1200 150 L1200 260 L0 260 Z"
            fill={isNight ? '#1e293b' : '#4d7c0f'}
            stroke="#111322"
            strokeWidth="4"
          />
          {/* Left Cartoon Cottage */}
          <g transform="translate(110, 75)">
            <rect x="10" y="45" width="75" height="55" rx="4" fill={isNight ? '#334155' : '#fef3c7'} stroke="#111322" strokeWidth="4" />
            <path d="M0 50 L48 12 L96 50 Z" fill={isNight ? '#7f1d1d' : '#ef4444'} stroke="#111322" strokeWidth="4" />
            <rect x="35" y="65" width="22" height="35" rx="3" fill="#78350f" stroke="#111322" strokeWidth="3" />
            <rect x="62" y="60" width="14" height="14" rx="2" fill={isNight ? '#fde047' : '#38bdf8'} stroke="#111322" strokeWidth="3" />
          </g>
          {/* Right Cartoon Cottage */}
          <g transform="translate(960, 68)">
            <rect x="10" y="45" width="80" height="58" rx="4" fill={isNight ? '#334155' : '#fde68a'} stroke="#111322" strokeWidth="4" />
            <path d="M0 50 L50 10 L100 50 Z" fill={isNight ? '#1e3a8a' : '#3b82f6'} stroke="#111322" strokeWidth="4" />
            <rect x="42" y="68" width="22" height="35" rx="3" fill="#78350f" stroke="#111322" strokeWidth="3" />
            <rect x="20" y="58" width="14" height="14" rx="2" fill={isNight ? '#fde047' : '#7dd3fc'} stroke="#111322" strokeWidth="3" />
          </g>
          {/* Cartoon Trees */}
          {[260, 440, 760, 880].map((tx, i) => (
            <g key={i} transform={`translate(${tx}, ${88 + (i % 2) * 14})`}>
              <rect x="18" y="48" width="12" height="36" fill="#78350f" stroke="#111322" strokeWidth="3" />
              <circle cx="24" cy="36" r="24" fill={isNight ? '#14532d' : '#22c55e'} stroke="#111322" strokeWidth="3.5" />
            </g>
          ))}
        </svg>

        {/* LAYER 3: 2.5D Oblique Grass & Cobblestone Courtyard */}
        <div
          className="absolute inset-x-0 bottom-0 h-[68%] transition-colors duration-1000"
          style={{
            background: isNight
              ? 'radial-gradient(ellipse at 50% 45%, #1d2d2a 0%, #101926 70%, #090d16 100%)'
              : 'radial-gradient(ellipse at 50% 45%, #84cc16 0%, #4d7c0f 65%, #365314 100%)',
            borderTop: '4px solid #111322',
          }}
        />
        <div
          className="absolute left-1/2 rounded-full border-4 border-[#111322]/70 transition-colors duration-1000"
          style={{
            top: `calc(50% + ${centerYOffset}px)`,
            transform: 'translate(-50%, -50%)',
            width: rx * 2.15,
            height: ry * 2.1,
            background: isNight
              ? 'radial-gradient(ellipse, #334155 0%, #1e293b 78%)'
              : 'radial-gradient(ellipse, #e7e5e4 0%, #a8a29e 82%)',
            boxShadow: 'inset 0 8px 0 rgba(255,255,255,0.18), 0 8px 0 rgba(0,0,0,0.35)',
          }}
        />
      </div>

      {/* Top-Center Phase & Timer Pill */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 max-w-[92vw]">
        <div className="ggd-card px-3.5 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-base leading-none">{isNight ? '🌙' : '☀️'}</span>
          <span className="font-brand text-amber-300 text-xs sm:text-sm whitespace-nowrap">
            {room.phase === PHASES.ROLE_REVEAL && 'CHIA BÀI'}
            {room.phase === PHASES.NIGHT && `ĐÊM ${room.dayCount}`}
            {room.phase === PHASES.DAWN && `BÌNH MINH ${room.dayCount}`}
            {room.phase === PHASES.HUNTER_SHOT && 'THỢ SĂN'}
            {room.phase === PHASES.DAY_DISCUSS && `NGÀY ${room.dayCount}`}
            {room.phase === PHASES.DAY_DEFENSE && 'TRĂN TRỐI'}
            {room.phase === PHASES.DAY_VERDICT && 'PHÁN QUYẾT'}
          </span>
          {room.phaseEndsAt && (
            <span
              className={`flex items-center gap-1 font-extrabold text-sm leading-none px-2 py-0.5 rounded-lg ${
                secondsLeft <= 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-black/45 text-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {secondsLeft}s
            </span>
          )}
        </div>

        {selectedThrow && (
          <div className="rounded-full bg-sky-400 text-black border-2 border-[#111322] px-3 py-0.5 text-xs font-extrabold shadow flex items-center gap-2">
            <span>🎯 Bấm 🎯 dưới chân người muốn ném</span>
            <button type="button" onClick={onClearThrow} className="underline cursor-pointer">
              Hủy
            </button>
          </div>
        )}
      </div>

      {/* LAYER 4 (Center Campfire at Z = 50) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
        style={{ top: `calc(50% + ${centerYOffset}px)`, zIndex: 50 }}
      >
        <Campfire25D isNight={isNight} />
        {room.phase === PHASES.DAY_DEFENSE && accusedPlayer && (
          <div className="mt-1 px-2.5 py-0.5 rounded-full bg-red-600 border-2 border-[#111322] text-[11px] font-extrabold text-white whitespace-nowrap animate-pulse">
            🎙️ {accusedPlayer.name} trăn trối
          </div>
        )}
      </div>

      {/* Dawn Death Banner */}
      {room.phase === PHASES.DAWN && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 ggd-card px-4 py-2.5 text-center max-w-xs sm:max-w-md">
          <div className="text-xs sm:text-sm font-extrabold text-amber-200">
            {room.pendingDeaths.length === 0
              ? '🕊️ Đêm qua bình yên!'
              : `💀 ${room.pendingDeaths.map((d) => d.name).join(', ')} đã ngã xuống!`}
          </div>
          {room.pendingDeaths
            .filter((d) => d.will)
            .map((d) => (
              <div key={d.playerId} className="mt-1 text-xs text-slate-200 bg-black/40 rounded-lg px-2.5 py-1">
                📜 {d.name}: “{d.will}”
              </div>
            ))}
        </div>
      )}

      {/* Flying Throwables */}
      <div className="pointer-events-none absolute inset-0 z-[120] overflow-hidden">
        {projectiles.map((proj) => {
          const item = INTERACTIONS.find((i) => i.id === proj.itemId);
          if (!item) return null;
          return (
            <div
              key={proj.id}
              className="absolute text-3xl"
              style={{
                left: '50%',
                top: '50%',
                animation: 'flyProjectile 0.85s ease-out forwards',
                '--from-x': `${proj.fromOffsetX}px`,
                '--from-y': `${proj.fromOffsetY}px`,
                '--to-x': `${proj.toOffsetX}px`,
                '--to-y': `${proj.toOffsetY}px`,
              }}
            >
              {item.emoji}
            </div>
          );
        })}
      </div>

      {/* LAYER 4 (Y-Sorted Villagers around the Campfire) */}
      {activePlayers.map((p, idx) => {
        const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
        const isAccused =
          (room.phase === PHASES.DAY_DEFENSE || room.phase === PHASES.DAY_VERDICT) &&
          room.accusedId === p.id;

        const rScale = isAccused ? 0.56 : 1;
        const x = Math.cos(angle) * rx * rScale;
        const y = Math.sin(angle) * ry * rScale;

        // 2.5D Depth perspective: back row smaller (0.9x, z<50), front row larger (1.08x, z>50)
        const depthNorm = (y / ry + 1) / 2; // 0 (top/back) -> 1 (bottom/front)
        const depthScale = isAccused ? 1.12 : 0.9 + depthNorm * 0.18;
        const zOrder = isAccused ? 85 : 30 + Math.round(depthNorm * 40); // campfire is 50!

        const isMe = p.id === me?.id;
        const isSpeaking = Boolean(speakingPeers[p.id]);
        const voteCount = dayVoteTally[p.id] || 0;
        const tagId = suspectTags[p.id];
        const tagDef = tagId ? SUSPECT_TAGS.find((t) => t.id === tagId) : null;
        const wolfTargeting =
          isNight && isWolfRole(myRole) && Object.values(priv?.wolfVotes || {}).includes(p.id);
        const reactions = activeReactions.filter((r) => r.targetId === p.id);
        const bubble = chatBubbles[p.id];
        const targetAction = getTargetAction(p);

        return (
          <div
            key={p.id}
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${centerYOffset + y}px)`,
              transform: `translate(-50%, -50%) scale(${depthScale})`,
              zIndex: tagPickerFor === p.id ? 110 : zOrder,
            }}
            className="absolute flex flex-col items-center"
          >
            {bubble && (
              <div
                key={bubble.id}
                className="anim-chat-bubble pointer-events-none absolute -top-9 left-1/2 z-40 max-w-[150px] rounded-xl bg-white text-black px-2.5 py-0.5 text-[11px] font-extrabold shadow-lg border-2 border-[#111322] truncate"
              >
                {bubble.text}
              </div>
            )}

            {reactions.map((r) => {
              const item = INTERACTIONS.find((i) => i.id === r.itemId);
              return (
                <div
                  key={r.id}
                  className="anim-reaction pointer-events-none absolute -top-5 left-1/2 z-40 text-2xl drop-shadow"
                >
                  {item?.emoji}
                </div>
              );
            })}

            <div className={`relative ${isSpeaking ? 'speaking-ring' : ''}`}>
              <div className="pointer-events-none absolute -top-1 -left-2 flex gap-0.5 text-xs z-20">
                {p.mayorRevealed && <span>🎖️</span>}
                {p.isLover && <span>💘</span>}
                {p.role && isWolfRole(p.role) && !isMe && <span>🐺</span>}
                {wolfTargeting && <span className="animate-bounce">🐾</span>}
              </div>

              <PixelVillager
                avatarId={p.avatarId}
                alive={p.alive}
                size={baseSprite}
                isNight={isNight}
                eyeState={getEyeState(p)}
                isAccused={isAccused}
                enablePoke={true}
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTagPickerFor((cur) => (cur === p.id ? null : p.id));
                }}
                className="absolute -top-1 -right-2 w-5 h-5 rounded-full bg-[#16192b]/85 hover:bg-black border border-white/25 text-slate-200 flex items-center justify-center z-20 cursor-pointer"
                title="Gắn nhãn nghi ngờ"
              >
                <Tag className="w-2.5 h-2.5" />
              </button>

              {tagPickerFor === p.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-5 left-7 z-50 ggd-card p-1.5 w-32 flex flex-col gap-0.5"
                >
                  {SUSPECT_TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSetSuspectTag(p.id, t.id);
                        setTagPickerFor(null);
                      }}
                      className="text-left text-[11px] font-bold px-1.5 py-1 rounded-lg bg-[#121629] hover:bg-[#272f54] flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t.icon}</span>
                      <span style={{ color: t.color }}>{t.label}</span>
                    </button>
                  ))}
                  {tagDef && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetSuspectTag(p.id, null);
                        setTagPickerFor(null);
                      }}
                      className="text-center text-[10px] font-bold text-slate-400 hover:text-white py-0.5 cursor-pointer"
                    >
                      ✕ Xóa nhãn
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#111322]/85 border border-white/15 max-w-[88px] truncate ${
                  isMe ? 'text-amber-300 border-amber-400/60' : !p.alive ? 'text-slate-400 line-through' : 'text-white'
                }`}
              >
                {p.name}
              </span>
              {voteCount > 0 && (room.phase === PHASES.DAY_DISCUSS || room.phase === PHASES.DAY_DEFENSE) && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white border border-[#111322]">
                  {voteCount}
                </span>
              )}
            </div>

            {tagDef && (
              <span
                className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9.5px] font-extrabold bg-[#111322]/90 border border-black"
                style={{ color: tagDef.color }}
              >
                {tagDef.icon} {tagDef.label}
              </span>
            )}

            {targetAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  targetAction.run();
                }}
                className={`ggd-btn mt-0.5 px-2.5 py-0.5 text-xs ${targetAction.color}`}
              >
                {targetAction.label}
              </button>
            )}
          </div>
        );
      })}

      {/* LAYER 5: Soft Foreground Bushes */}
      <div className="pointer-events-none absolute -bottom-4 -left-6 w-36 h-20 rounded-full bg-emerald-950/75 border-4 border-[#111322] z-[90]" />
      <div className="pointer-events-none absolute -bottom-4 -right-6 w-36 h-20 rounded-full bg-emerald-950/75 border-4 border-[#111322] z-[90]" />

      {/* Bottom Floating Controls (Skip Day/Night + Verdict + Night Abilities) */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[100] flex flex-wrap items-center justify-center gap-1.5 max-w-[94vw]">
        {canSkipNow && (
          <button
            type="button"
            onClick={onToggleSkip}
            className={`ggd-btn px-3 py-1.5 text-xs ${
              iSkipped ? 'bg-emerald-400 text-black' : 'bg-[#252b47]/95 text-amber-200'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>
              {isNight ? 'Qua đêm' : 'Skip'} ({skipVotes.length}/{alivePlayers.length})
            </span>
          </button>
        )}

        {room.phase === PHASES.DAY_DISCUSS && me?.alive && (
          <>
            <button
              type="button"
              onClick={() => onDayVote('skip')}
              className={`ggd-btn px-3 py-1.5 text-xs ${
                myDayVote === 'skip' ? 'bg-amber-400 text-black' : 'bg-[#252b47]/95 text-slate-200'
              }`}
            >
              ⏭️ Không treo
            </button>
            {!room.extensionUsedToday && (
              <button
                type="button"
                onClick={onExtendDiscuss}
                className="ggd-btn bg-sky-400 text-black px-2.5 py-1.5 text-xs"
              >
                ⏳ +30s
              </button>
            )}
          </>
        )}

        {room.phase === PHASES.DAY_VERDICT && me?.alive && me?.id !== room.accusedId && (
          <div className="ggd-card p-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVerdictVote('HANG')}
              className={`ggd-btn px-3.5 py-1.5 text-xs ${
                myVerdictVote === 'HANG' ? 'bg-red-500 text-white ring-2 ring-amber-300' : 'bg-red-800 text-white'
              }`}
            >
              ⚔️ TREO ({verdictTally.hang})
            </button>
            <button
              type="button"
              onClick={() => onVerdictVote('SPARE')}
              className={`ggd-btn px-3.5 py-1.5 text-xs ${
                myVerdictVote === 'SPARE'
                  ? 'bg-emerald-400 text-black ring-2 ring-amber-300'
                  : 'bg-emerald-700 text-white'
              }`}
            >
              🛡️ THA ({verdictTally.spare})
            </button>
          </div>
        )}

        {isNight && room.nightStage === 'EARLY' && me?.alive && myRole === 'cursed_wolf' && !priv?.cursedUsed && (
          <button
            type="button"
            onClick={() => {
              const next = !curseToggle;
              setCurseToggle(next);
              const myVote = priv?.wolfVotes?.[me.id];
              if (myVote) onNightWolfVote(myVote, next, true);
            }}
            className={`ggd-btn px-3 py-1.5 text-xs ${
              curseToggle ? 'bg-red-600 text-white' : 'bg-[#2a2244]/95 text-red-300'
            }`}
          >
            🩸 {curseToggle ? 'Đang bật Nguyền Rủa' : 'Nguyền Rủa'}
          </button>
        )}

        {isNight && room.nightStage === 'LATE' && me?.alive && myRole === 'witch' && !priv?.myNightDone && !priv?.villagePowersLost && (
          <div className="ggd-card p-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {witchVictim && priv?.witchHealLeft && (
              <button
                type="button"
                onClick={() => onNightWitch({ heal: true, poisonTargetId: null })}
                className="ggd-btn bg-emerald-400 text-black px-2.5 py-1 text-xs"
              >
                💚 Cứu {witchVictim.name}
              </button>
            )}
            {priv?.witchPoisonLeft && (
              <button
                type="button"
                onClick={() => setWitchMode((m) => (m === 'poison' ? 'idle' : 'poison'))}
                className={`ggd-btn px-2.5 py-1 text-xs ${
                  witchMode === 'poison' ? 'bg-purple-500 text-white' : 'bg-[#2c2142] text-purple-200'
                }`}
              >
                ☠️ {witchMode === 'poison' ? 'Bấm ☠️ dưới chân nạn nhân' : 'Dùng Độc'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setWitchMode('idle');
                onNightWitch({ heal: false, poisonTargetId: null });
              }}
              className="ggd-btn bg-slate-700 text-white px-2.5 py-1 text-xs"
            >
              Bỏ qua
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
