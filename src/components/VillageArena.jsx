import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Clock } from 'lucide-react';
import { INTERACTIONS, PHASES, SUSPECT_TAGS } from '../../shared/constants.js';
import PixelVillager from './PixelVillager.jsx';
import { formatCountdown, isWolfRole } from '../utils/helpers.js';
import { sfx } from '../audio/sfx.js';

function PixelCampfire({ isNight }) {
  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {/* Warm light halo at Night */}
      {isNight && (
        <div
          className="absolute w-36 h-36 sm:w-48 sm:h-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(251,146,60,0.38) 0%, rgba(251,146,60,0) 70%)',
          }}
        />
      )}

      {/* Smoke wisps when fire is out in Daytime */}
      {!isNight && (
        <div className="absolute -top-6 flex gap-1.5">
          <span className="anim-smoke inline-block w-2 h-2 bg-slate-300/60" />
          <span className="anim-smoke inline-block w-2.5 h-2.5 bg-slate-200/50" style={{ animationDelay: '0.6s' }} />
        </div>
      )}

      <svg
        viewBox="0 0 24 24"
        width={68}
        height={68}
        className={`w-14 h-14 sm:w-20 sm:h-20 ${isNight ? 'anim-fire' : ''}`}
        shapeRendering="crispEdges"
      >
        {/* Stone ring */}
        <rect x="4" y="18" width="3" height="2" fill="#475569" />
        <rect x="8" y="19" width="3" height="2" fill="#64748b" />
        <rect x="13" y="19" width="3" height="2" fill="#475569" />
        <rect x="17" y="18" width="3" height="2" fill="#64748b" />

        {/* Wooden logs */}
        <rect x="6" y="16" width="12" height="2" fill={isNight ? '#78350f' : '#3f3f46'} />
        <rect x="8" y="15" width="8" height="2" fill={isNight ? '#92400e' : '#27272a'} />

        {isNight ? (
          <>
            {/* Roaring pixel flames */}
            <rect x="8" y="11" width="8" height="5" fill="#ea580c" />
            <rect x="9" y="8" width="6" height="4" fill="#f97316" />
            <rect x="10" y="5" width="4" height="4" fill="#facc15" />
            <rect x="11" y="3" width="2" height="2" fill="#fef08a" />
            <rect x="10" y="11" width="4" height="4" fill="#fde047" />
          </>
        ) : (
          <>
            {/* Extinguished ash & tiny ember */}
            <rect x="9" y="15" width="6" height="1" fill="#52525b" />
            <rect x="11" y="16" width="2" height="1" fill="#9a3412" />
          </>
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
  onExtendDiscuss,
  onVerdictVote,
  onInteract,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tagPickerFor, setTagPickerFor] = useState(null);
  const [cupidPick, setCupidPick] = useState([]);
  const [curseToggle, setCurseToggle] = useState(false);
  const [witchMode, setWitchMode] = useState('idle'); // 'idle' | 'poison'

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
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

  // Check if viewer has an active solo night turn right now
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

  // Strictly compute eye state per player from viewer's perspective
  const getEyeState = (p) => {
    if (!p.alive) return 'awake';
    if (!isNight) return 'awake';

    // Wolves see ONLY fellow wolves with glowing red eyes
    if (me?.alive && isWolfRole(myRole)) {
      if (p.role && isWolfRole(p.role)) return 'wolf';
      return 'sleep';
    }

    // Solo night roles ONLY see themselves open eyes on their own screen
    if (p.id === me?.id && isMySoloNightTurn) {
      return 'awake';
    }

    return 'sleep';
  };

  // Determine target button action for a given player
  const getTargetAction = (p) => {
    if (selectedThrow) {
      return {
        label: '🎯',
        color: 'bg-sky-500 text-black',
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
        color: voted ? 'bg-amber-400 text-black' : 'bg-rose-600 text-white',
        run: () => {
          sfx.play('click');
          onDayVote(p.id);
        },
      };
    }

    if (room.phase === PHASES.HUNTER_SHOT && room.activeHunterId === me.id && p.id !== me.id) {
      return {
        label: '🏹',
        color: 'bg-orange-500 text-black',
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
          color: picked ? 'bg-pink-500 text-white' : 'bg-pink-900/90 text-pink-200',
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
          color: 'bg-sky-500 text-black',
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
          color: picked ? 'bg-red-500 text-white ring-2 ring-amber-300' : 'bg-red-900/90 text-red-100',
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

  // Compute elliptical ring coordinates around campfire
  const count = activePlayers.length;
  const compact = size.w < 560 || size.h < 480;
  const spriteSize = compact ? 42 : size.w > 950 ? 58 : 48;
  const rx = Math.max(105, size.w * (size.w < 600 ? 0.36 : 0.35));
  const ry = Math.max(95, size.h * (size.h < 500 ? 0.33 : 0.32));

  const myDayVote = me ? room.publicDayVotes?.[me.id]?.targetId : null;
  const myVerdictVote = me ? room.publicVerdictVotes?.[me.id]?.choice : null;
  const accusedPlayer = room.accusedId ? room.players.find((p) => p.id === room.accusedId) : null;
  const witchVictim = priv?.witchVictimId ? room.players.find((p) => p.id === priv.witchVictimId) : null;

  return (
    <div
      ref={containerRef}
      onClick={() => setTagPickerFor(null)}
      className={`relative w-full h-full overflow-hidden transition-colors duration-1000 select-none ${
        isNight
          ? 'bg-[radial-gradient(ellipse_at_center,#221942_0%,#0c091a_60%,#05040b_100%)]'
          : 'bg-[radial-gradient(ellipse_at_center,#3b5845_0%,#243a35_58%,#162426_100%)]'
      }`}
    >
      {/* Ambient Pixel Village Scenery (Stars/Moon at Night vs Sun/Clouds at Day) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {isNight ? (
          <>
            <div className="absolute top-3 right-12 text-2xl opacity-90">🌕</div>
            <div className="absolute top-6 left-[18%] w-1 h-1 bg-amber-200 opacity-70" />
            <div className="absolute top-12 left-[72%] w-1 h-1 bg-white opacity-60" />
            <div className="absolute top-8 left-[45%] w-1.5 h-1.5 bg-amber-100 opacity-50" />
            <div className="absolute top-14 left-[85%] w-1 h-1 bg-sky-200 opacity-60" />
          </>
        ) : (
          <>
            <div className="absolute top-3 right-12 text-2xl opacity-90">☀️</div>
          </>
        )}

        {/* Stone Village Courtyard Circle */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dashed pointer-events-none"
          style={{
            width: rx * 1.9,
            height: ry * 1.85,
            borderColor: isNight ? 'rgba(251, 146, 60, 0.16)' : 'rgba(255, 255, 255, 0.12)',
            background: isNight
              ? 'radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 72%)'
              : 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 72%)',
          }}
        />
      </div>

      {/* Top-Center Minimal Phase & Timer Pill */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 max-w-[92vw]">
        <div className="px-panel px-3 py-1 flex items-center gap-2 text-xs">
          <span>{isNight ? '🌙' : '☀️'}</span>
          <span className="font-pixel-title text-amber-300 text-[11px] sm:text-xs whitespace-nowrap">
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
              className={`flex items-center gap-0.5 font-pixel-num text-base leading-none px-1.5 py-0.5 rounded ${
                secondsLeft <= 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-black/45 text-amber-300'
              }`}
            >
              <Clock className="w-3 h-3" />
              {secondsLeft}s
            </span>
          )}
        </div>

        {/* Short Visual Prompt Pill when needed */}
        {selectedThrow && (
          <div className="rounded bg-sky-500 text-black px-2.5 py-0.5 text-[11px] font-bold shadow flex items-center gap-2">
            <span>🎯 Bấm 🎯 dưới chân người muốn ném</span>
            <button type="button" onClick={onClearThrow} className="underline cursor-pointer">
              Hủy
            </button>
          </div>
        )}
      </div>

      {/* Center Campfire */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
        <PixelCampfire isNight={isNight} />
        {room.phase === PHASES.DAY_DEFENSE && accusedPlayer && (
          <div className="mt-1 px-2 py-0.5 rounded bg-red-600/90 border border-black text-[11px] font-bold text-white whitespace-nowrap animate-pulse">
            🎙️ {accusedPlayer.name} trăn trối
          </div>
        )}
      </div>

      {/* Dawn Death Banner (No role shown, only Will!) */}
      {room.phase === PHASES.DAWN && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-panel px-3 py-2 text-center max-w-xs sm:max-w-md">
          <div className="text-xs font-bold text-amber-200">
            {room.pendingDeaths.length === 0
              ? '🕊️ Đêm qua bình yên!'
              : `💀 ${room.pendingDeaths.map((d) => d.name).join(', ')} đã ngã xuống!`}
          </div>
          {room.pendingDeaths
            .filter((d) => d.will)
            .map((d) => (
              <div key={d.playerId} className="mt-1 text-[11px] text-slate-200 bg-black/40 rounded px-2 py-1">
                📜 {d.name}: “{d.will}”
              </div>
            ))}
        </div>
      )}

      {/* Flying Throwables */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
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

      {/* Villagers Positioned Around Campfire */}
      {activePlayers.map((p, idx) => {
        const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
        const isAccused =
          (room.phase === PHASES.DAY_DEFENSE || room.phase === PHASES.DAY_VERDICT) &&
          room.accusedId === p.id;

        const rScale = isAccused ? 0.55 : 1;
        const x = Math.cos(angle) * rx * rScale;
        const y = Math.sin(angle) * ry * rScale;

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
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-20 flex flex-col items-center ${isAccused ? 'z-30 scale-110' : ''}`}
          >
            {/* Live Chat Speech Bubble */}
            {bubble && (
              <div
                key={bubble.id}
                className="anim-chat-bubble pointer-events-none absolute -top-9 left-1/2 z-40 max-w-[140px] rounded bg-white text-black px-2 py-0.5 text-[10px] font-bold shadow-lg border-2 border-black truncate"
              >
                {bubble.text}
              </div>
            )}

            {/* Floating Reactions */}
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

            {/* Sprite (Always clickable for unique Poke Animation!) */}
            <div className={`relative ${isSpeaking ? 'speaking-ring' : ''}`}>
              {/* Wolf / Lover / Mayor mini icons */}
              <div className="pointer-events-none absolute -top-1 -left-2 flex gap-0.5 text-[11px] z-20">
                {p.mayorRevealed && <span>🎖️</span>}
                {p.isLover && <span>💘</span>}
                {p.role && isWolfRole(p.role) && !isMe && <span>🐺</span>}
                {wolfTargeting && <span className="animate-bounce">🐾</span>}
              </div>

              <PixelVillager
                avatarId={p.avatarId}
                alive={p.alive}
                size={spriteSize}
                isNight={isNight}
                eyeState={getEyeState(p)}
                isAccused={isAccused}
                enablePoke={true}
              />

              {/* Tag Picker Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTagPickerFor((cur) => (cur === p.id ? null : p.id));
                }}
                className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-black/65 hover:bg-black text-slate-300 flex items-center justify-center z-20 cursor-pointer"
                title="Gắn nhãn nghi ngờ"
              >
                <Tag className="w-2.5 h-2.5" />
              </button>

              {tagPickerFor === p.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-4 left-6 z-50 px-panel p-1 w-28 flex flex-col gap-0.5"
                >
                  {SUSPECT_TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSetSuspectTag(p.id, t.id);
                        setTagPickerFor(null);
                      }}
                      className="text-left text-[10px] px-1 py-0.5 rounded bg-[#161221] hover:bg-[#322949] flex items-center gap-1 cursor-pointer"
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
                      className="text-center text-[9.5px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      ✕ Xóa
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Compact Nameplate + Suspect Tag + Action Pill */}
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold bg-black/70 border border-white/10 max-w-[78px] truncate ${
                  isMe ? 'text-amber-300 border-amber-400/50' : !p.alive ? 'text-slate-400 line-through' : 'text-white'
                }`}
              >
                {p.name}
              </span>
              {voteCount > 0 && (room.phase === PHASES.DAY_DISCUSS || room.phase === PHASES.DAY_DEFENSE) && (
                <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white border border-black">
                  {voteCount}
                </span>
              )}
            </div>

            {tagDef && (
              <span
                className="mt-0.5 px-1 rounded text-[9px] font-bold bg-black/80"
                style={{ color: tagDef.color }}
              >
                {tagDef.icon} {tagDef.label}
              </span>
            )}

            {/* Dedicated Target Button (never interferes with poking character!) */}
            {targetAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  targetAction.run();
                }}
                className={`px-btn mt-0.5 px-2 py-0.5 text-[11px] ${targetAction.color}`}
              >
                {targetAction.label}
              </button>
            )}
          </div>
        );
      })}

      {/* Minimal Floating Action Controls (Above Bottom Chat Button) */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-1.5 max-w-[92vw]">
        {room.phase === PHASES.DAY_DISCUSS && me?.alive && (
          <>
            <button
              type="button"
              onClick={() => onDayVote('skip')}
              className={`px-btn px-2.5 py-1 text-xs ${
                myDayVote === 'skip' ? 'bg-amber-400 text-black' : 'bg-[#251f36]/95 text-slate-200'
              }`}
            >
              ⏭️ Bỏ qua
            </button>
            {!room.extensionUsedToday && (
              <button
                type="button"
                onClick={onExtendDiscuss}
                className="px-btn bg-sky-500 text-black px-2.5 py-1 text-xs"
              >
                ⏳ +30s
              </button>
            )}
          </>
        )}

        {room.phase === PHASES.DAY_VERDICT && me?.alive && me?.id !== room.accusedId && (
          <div className="px-panel p-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVerdictVote('HANG')}
              className={`px-btn px-3 py-1.5 text-xs ${
                myVerdictVote === 'HANG' ? 'bg-red-600 text-white ring-2 ring-amber-300' : 'bg-red-800 text-white'
              }`}
            >
              ⚔️ TREO ({verdictTally.hang})
            </button>
            <button
              type="button"
              onClick={() => onVerdictVote('SPARE')}
              className={`px-btn px-3 py-1.5 text-xs ${
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
            className={`px-btn px-2.5 py-1 text-xs ${
              curseToggle ? 'bg-red-600 text-white' : 'bg-[#281e38]/95 text-red-300'
            }`}
          >
            🩸 {curseToggle ? 'Đang bật Nguyền Rủa' : 'Nguyền Rủa'}
          </button>
        )}

        {isNight && room.nightStage === 'LATE' && me?.alive && myRole === 'witch' && !priv?.myNightDone && !priv?.villagePowersLost && (
          <div className="px-panel p-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            {witchVictim && priv?.witchHealLeft && (
              <button
                type="button"
                onClick={() => onNightWitch({ heal: true, poisonTargetId: null })}
                className="px-btn bg-emerald-500 text-black px-2.5 py-1 text-xs"
              >
                💚 Cứu {witchVictim.name}
              </button>
            )}
            {priv?.witchPoisonLeft && (
              <button
                type="button"
                onClick={() => setWitchMode((m) => (m === 'poison' ? 'idle' : 'poison'))}
                className={`px-btn px-2.5 py-1 text-xs ${
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
              className="px-btn bg-slate-700 text-white px-2.5 py-1 text-xs"
            >
              Bỏ qua
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
