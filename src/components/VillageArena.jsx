import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag } from 'lucide-react';
import { INTERACTIONS, PHASES, SUSPECT_TAGS } from '../../shared/constants.js';
import PixelVillager from './PixelVillager.jsx';
import { formatCountdown, isWolfRole } from '../utils/helpers.js';
import { sfx } from '../audio/sfx.js';

function formatClock(sec) {
  const s = Math.max(0, sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function CampfireCenter({ isNight }) {
  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {isNight && (
        <div
          className="absolute w-52 h-36 sm:w-72 sm:h-48 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(251,146,60,0.45) 0%, rgba(251,146,60,0) 72%)',
          }}
        />
      )}

      {!isNight && (
        <div className="absolute -top-6 flex gap-2 z-20">
          <span className="anim-smoke inline-block w-3 h-3 rounded-full bg-slate-200/75" />
          <span className="anim-smoke inline-block w-3.5 h-3.5 rounded-full bg-white/65" style={{ animationDelay: '0.6s' }} />
        </div>
      )}

      <img
        src="/assets/chars/campfire_lit.png"
        alt="Đống lửa trại"
        draggable={false}
        className={`w-16 h-16 sm:w-24 sm:h-24 object-contain ${isNight ? 'anim-fire' : ''}`}
        style={
          isNight
            ? undefined
            : {
                filter: 'brightness(0.42) saturate(0.15) contrast(1.15)',
                opacity: 0.85,
              }
        }
      />
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

  // Safe ellipse aligned to the painted cobblestone plaza with padding for HUD corners
  const count = activePlayers.length;
  const compact = size.w < 640 || size.h < 540;
  const baseSprite = compact ? 54 : size.w > 980 ? 84 : 68;
  const rx = Math.max(105, Math.min(size.w * 0.31, size.w / 2 - 82));
  const ry = Math.max(76, Math.min(size.h * 0.24, size.h / 2 - 108));
  const centerYOffset = size.h * 0.04;

  const myDayVote = me ? room.publicDayVotes?.[me.id]?.targetId : null;
  const myVerdictVote = me ? room.publicVerdictVotes?.[me.id]?.choice : null;
  const accusedPlayer = room.accusedId ? room.players.find((p) => p.id === room.accusedId) : null;
  const witchVictim = priv?.witchVictimId ? room.players.find((p) => p.id === priv.witchVictimId) : null;

  return (
    <div
      ref={containerRef}
      onClick={() => setTagPickerFor(null)}
      className="relative w-full h-full overflow-hidden select-none bg-[#0d1224]"
    >
      {/* LAYER 1: Full-Bleed Crossfading Painted 2.5D Day & Night Backgrounds */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: "url('/assets/bg_day.jpg')",
          opacity: isNight ? 0 : 1,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: "url('/assets/bg_night.jpg')",
          opacity: isNight ? 1 : 0,
        }}
      />

      {/* Top-Center Supercell Timer Capsule */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[92vw]">
        <div className="sc-timer-pill px-4 py-1.5 flex items-center gap-2.5">
          <span className="text-lg leading-none">{isNight ? '🌙' : '☀️'}</span>
          {room.phaseEndsAt && (
            <span
              className={`font-black text-base sm:text-xl tracking-wider leading-none ${
                secondsLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'
              }`}
            >
              {formatClock(secondsLeft)}
            </span>
          )}
          <span className="text-[11px] font-extrabold uppercase text-amber-300 border-l border-white/20 pl-2 whitespace-nowrap">
            {room.phase === PHASES.ROLE_REVEAL && 'CHIA BÀI'}
            {room.phase === PHASES.NIGHT && `ĐÊM ${room.dayCount}`}
            {room.phase === PHASES.DAWN && `BÌNH MINH ${room.dayCount}`}
            {room.phase === PHASES.HUNTER_SHOT && 'THỢ SĂN'}
            {room.phase === PHASES.DAY_DISCUSS && `NGÀY ${room.dayCount}`}
            {room.phase === PHASES.DAY_DEFENSE && 'TRĂN TRỐI'}
            {room.phase === PHASES.DAY_VERDICT && 'PHÁN QUYẾT'}
          </span>
        </div>

        {selectedThrow && (
          <div className="rounded-full bg-sky-400 text-black border-2 border-[#0b0d17] px-3 py-0.5 text-xs font-extrabold shadow flex items-center gap-2">
            <span>🎯 Bấm 🎯 dưới chân người muốn ném</span>
            <button type="button" onClick={onClearThrow} className="underline cursor-pointer">
              Hủy
            </button>
          </div>
        )}
      </div>

      {/* Center Campfire (Z = 50) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
        style={{ top: `calc(50% + ${centerYOffset}px)`, zIndex: 50 }}
      >
        <CampfireCenter isNight={isNight} />
        {room.phase === PHASES.DAY_DEFENSE && accusedPlayer && (
          <div className="mt-1 px-3 py-0.5 rounded-full bg-red-600 border-2 border-[#090b14] text-[11px] font-extrabold text-white whitespace-nowrap animate-pulse shadow">
            🎙️ {accusedPlayer.name} trăn trối
          </div>
        )}
      </div>

      {/* Dawn Death Banner */}
      {room.phase === PHASES.DAWN && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[110] ggd-card px-4 py-2.5 text-center max-w-xs sm:max-w-md">
          <div className="text-xs sm:text-sm font-extrabold text-amber-200">
            {room.pendingDeaths.length === 0
              ? '🕊️ Đêm qua bình yên!'
              : `💀 ${room.pendingDeaths.map((d) => d.name).join(', ')} đã ngã xuống!`}
          </div>
          {room.pendingDeaths
            .filter((d) => d.will)
            .map((d) => (
              <div key={d.playerId} className="mt-1 text-xs text-slate-200 bg-black/45 rounded-lg px-2.5 py-1">
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

      {/* Y-Sorted Illustrated Villagers around the Plaza */}
      {activePlayers.map((p, idx) => {
        const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
        const isAccused =
          (room.phase === PHASES.DAY_DEFENSE || room.phase === PHASES.DAY_VERDICT) &&
          room.accusedId === p.id;

        const rScale = isAccused ? 0.56 : 1;
        const x = Math.cos(angle) * rx * rScale;
        const y = Math.sin(angle) * ry * rScale;

        const depthNorm = (y / ry + 1) / 2;
        const depthScale = isAccused ? 1.12 : 0.9 + depthNorm * 0.16;
        const zOrder = isAccused ? 85 : 30 + Math.round(depthNorm * 40);

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
                className="anim-chat-bubble pointer-events-none absolute -top-9 left-1/2 z-40 max-w-[150px] rounded-xl bg-white text-black px-2.5 py-0.5 text-[11px] font-extrabold shadow-lg border-2 border-[#0b0d17] truncate"
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
                className="absolute -bottom-0.5 -right-1 w-5 h-5 rounded-full bg-[#111528]/90 hover:bg-black border border-white/30 text-slate-200 flex items-center justify-center z-20 cursor-pointer"
                title="Gắn nhãn nghi ngờ"
              >
                <Tag className="w-2.5 h-2.5" />
              </button>

              {tagPickerFor === p.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-4 left-7 z-50 ggd-card p-1.5 w-32 flex flex-col gap-0.5"
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
                className={`sc-nameplate px-2.5 py-0.5 text-[10.5px] font-extrabold max-w-[92px] truncate ${
                  isMe ? 'text-amber-300 border-amber-400/70' : !p.alive ? 'text-slate-400 line-through' : 'text-white'
                }`}
              >
                {p.name}
              </span>
              {voteCount > 0 && (room.phase === PHASES.DAY_DISCUSS || room.phase === PHASES.DAY_DEFENSE) && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white border-2 border-[#090b14]">
                  {voteCount}
                </span>
              )}
            </div>

            {tagDef && (
              <span
                className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9.5px] font-extrabold bg-[#0f1322]/95 border border-black"
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

      {/* Bottom-Right Glossy Orange SKIP Button (Supercell style!) */}
      {canSkipNow && (
        <button
          type="button"
          onClick={onToggleSkip}
          className={`sc-btn-orange absolute bottom-3 right-3 z-[100] px-4 py-2 text-xs sm:text-sm ${
            iSkipped ? 'ring-3 ring-emerald-300 brightness-110' : ''
          }`}
        >
          <span>{isNight ? 'QUA ĐÊM' : 'SKIP'}</span>
          <span className="rounded-full bg-black/35 px-1.5 py-0.2 text-[10px]">
            {skipVotes.length}/{alivePlayers.length}
          </span>
        </button>
      )}

      {/* Bottom-Center Context Action Bar (Safe between Chat left & SKIP right) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[100] flex flex-wrap items-center justify-center gap-1.5 max-w-[60vw]">
        {room.phase === PHASES.DAY_DISCUSS && me?.alive && (
          <>
            <button
              type="button"
              onClick={() => onDayVote('skip')}
              className={`ggd-btn px-2.5 py-1.5 text-xs ${
                myDayVote === 'skip' ? 'bg-amber-400 text-black' : 'bg-[#1d2542]/95 text-slate-100'
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
