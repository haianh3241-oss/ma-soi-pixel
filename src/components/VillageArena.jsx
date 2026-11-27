import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, X } from 'lucide-react';
import { INTERACTIONS, PHASES, SUSPECT_TAGS } from '../../shared/constants.js';
import { ARENA_LAYOUT, ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import PixelVillager from './PixelVillager.jsx';
import { preloadRoomVillagers } from '../data/villagerMotion.js';
import { formatCountdown, isWolfRole } from '../utils/helpers.js';
import { sfx } from '../audio/sfx.js';

function formatClock(sec) {
  const s = Math.max(0, sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function CampfireCenter({ isNight }) {
  const [outMissing, setOutMissing] = useState(false);

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

      {isNight || outMissing ? (
        <img
          src={ASSET_PATHS.campfireLit}
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
      ) : (
        <img
          src={ASSET_PATHS.campfireOut}
          alt="Đống lửa tắt"
          draggable={false}
          onError={() => setOutMissing(true)}
          className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
        />
      )}
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
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [cupidPick, setCupidPick] = useState([]);
  const [witchMode, setWitchMode] = useState('idle');
  const [emoteTriggers, setEmoteTriggers] = useState({});
  const [arenaShake, setArenaShake] = useState(false);
  const [seerToast, setSeerToast] = useState(null);
  const [dismissedConvertDay, setDismissedConvertDay] = useState(null);

  const seenProjectilesRef = useRef(new Set());
  const prevDefenseKeyRef = useRef(null);
  const prevSeerCountRef = useRef(0);

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

  useEffect(() => {
    preloadRoomVillagers(activePlayers.map((p) => p.avatarId));
  }, [activePlayers]);

  // Reset per-phase transient target & witch state when transitioning phase/stage/day
  useEffect(() => {
    setSelectedTargetId(null);
    setTagMenuOpen(false);
    setWitchMode('idle');
    setCupidPick([]);
  }, [room.phase, room.nightStage, room.dayCount]);

  // Popup Seer crystal ball result immediately so player sees it even when RolePanel is closed
  useEffect(() => {
    const hist = priv?.seerHistory || [];
    if (hist.length > prevSeerCountRef.current) {
      prevSeerCountRef.current = hist.length;
      setSeerToast(hist[hist.length - 1]);
    } else if (hist.length < prevSeerCountRef.current) {
      prevSeerCountRef.current = hist.length;
      setSeerToast(null);
    }
  }, [priv?.seerHistory]);

  // Trigger hit-emote when throwable projectile lands
  useEffect(() => {
    const timers = [];
    for (const proj of projectiles || []) {
      if (!proj?.id || seenProjectilesRef.current.has(proj.id)) continue;
      seenProjectilesRef.current.add(proj.id);
      if (proj.toId) {
        const t = setTimeout(() => {
          setEmoteTriggers((prev) => ({ ...prev, [proj.toId]: (prev[proj.toId] || 0) + 1 }));
        }, 720);
        timers.push(t);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [projectiles]);

  // Trigger defense plea emote when an accused player steps forward
  useEffect(() => {
    const key = room.phase === PHASES.DAY_DEFENSE && room.accusedId ? `${room.dayCount}-${room.accusedId}` : null;
    if (key && prevDefenseKeyRef.current !== key) {
      prevDefenseKeyRef.current = key;
      setEmoteTriggers((prev) => ({ ...prev, [room.accusedId]: (prev[room.accusedId] || 0) + 1 }));
    } else if (!key) {
      prevDefenseKeyRef.current = null;
    }
  }, [room.phase, room.dayCount, room.accusedId]);

  const triggerHeavyShake = () => {
    setArenaShake(true);
    setTimeout(() => setArenaShake(false), 180);
  };

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

  const isHunterActive = room.phase === PHASES.HUNTER_SHOT && room.activeHunterId === me?.id;

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

  const isWolfTurn =
    isNight && room.nightStage === 'EARLY' && me?.alive && isWolfRole(myRole) && !priv?.wolfLocked;

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

  // Determines whether tapping player `p` picks a skill/vote target right now
  const isTargetableNow = (p) => {
    if (selectedThrow) return true;
    if (!p.alive) return false;
    if (isHunterActive) return p.id !== me?.id; // NOTE: Hunter is ALREADY dead here — no alive check on `me`!
    if (!me?.alive || me?.isSpectator) return false;

    if (room.phase === PHASES.DAY_DISCUSS) return true;
    if (isNight && room.nightStage === 'EARLY') {
      if (myRole === 'cupid' && room.dayCount === 1 && !priv?.villagePowersLost && !priv?.myNightDone) return true;
      if (myRole === 'guard' && !priv?.villagePowersLost && !priv?.myNightDone) return p.id !== priv?.lastGuardedId;
      if (isWolfTurn) return !isWolfRole(p.role);
    }
    if (isNight && room.nightStage === 'LATE') {
      if (myRole === 'seer' && !priv?.villagePowersLost && !priv?.myNightDone) return p.id !== me.id;
      if (myRole === 'witch' && witchMode === 'poison' && !priv?.villagePowersLost && !priv?.myNightDone) return true;
    }
    return false;
  };

  const handleSeatClick = (e, p) => {
    e.stopPropagation();
    if (selectedThrow) {
      onInteract(p.id, selectedThrow);
      onClearThrow();
      return;
    }

    if (isTargetableNow(p)) {
      sfx.play('click');
      setTagMenuOpen(false);
      if (
        isNight &&
        room.nightStage === 'EARLY' &&
        myRole === 'cupid' &&
        room.dayCount === 1 &&
        !priv?.villagePowersLost &&
        !priv?.myNightDone
      ) {
        setCupidPick((prev) => {
          if (prev.includes(p.id)) return prev.filter((x) => x !== p.id);
          if (prev.length >= 2) return [prev[1], p.id];
          return [...prev, p.id];
        });
        return;
      }

      setSelectedTargetId(p.id);
      if (isWolfTurn) {
        // Preview bite highlight for wolf pack WITHOUT prematurely locking night!
        onNightWolfVote(p.id, false, false);
      }
      return;
    }

    // Outside active target turns: clicking selects for suspect tagging if clicking another player
    setSelectedTargetId((cur) => (cur === p.id ? null : p.id));
    setTagMenuOpen(false);
  };

  const count = activePlayers.length;
  const compact = size.w < 640 || size.h < 540;
  const baseSprite = compact
    ? ARENA_LAYOUT.spriteSizeMobile
    : size.w > 980
      ? ARENA_LAYOUT.spriteSizeDesktop
      : ARENA_LAYOUT.spriteSizeTablet;
  const rx = Math.max(105, Math.min(size.w * ARENA_LAYOUT.ellipseRxRatio, size.w / 2 - 82));
  const ry = Math.max(74, Math.min(size.h * ARENA_LAYOUT.ellipseRyRatio, size.h / 2 - 114));
  const centerYOffset = size.h * ARENA_LAYOUT.centerYOffsetRatio;

  const myDayVote = me ? room.publicDayVotes?.[me.id]?.targetId : null;
  const myVerdictVote = me ? room.publicVerdictVotes?.[me.id]?.choice : null;
  const accusedPlayer = room.accusedId ? room.players.find((p) => p.id === room.accusedId) : null;
  const witchVictim = priv?.witchVictimId ? room.players.find((p) => p.id === priv.witchVictimId) : null;

  const myWolfTargetId = priv?.wolfVotes?.[me?.id] || selectedTargetId;
  const activeTargetId = isWolfTurn ? myWolfTargetId : selectedTargetId;
  const activeTarget = activeTargetId ? room.players.find((p) => p.id === activeTargetId) : null;

  const showConvertedBanner =
    priv?.convertedOnDay &&
    priv.convertedOnDay === room.dayCount &&
    dismissedConvertDay !== room.dayCount &&
    (room.phase === PHASES.DAWN || room.phase === PHASES.DAY_DISCUSS);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        setSelectedTargetId(null);
        setTagMenuOpen(false);
      }}
      className={`relative w-full h-full overflow-hidden select-none bg-[#171211] ${arenaShake ? 'anim-arena-shake' : ''}`}
    >
      {/* LAYER 1: Full-Bleed Crossfading Painted 2.5D Day & Night Backgrounds */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${ASSET_PATHS.dayBackground}')`,
          opacity: isNight ? 0 : 1,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${ASSET_PATHS.nightBackground}')`,
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
            <span>🎯 Chạm thẳng vào người muốn ném</span>
            <button type="button" onClick={onClearThrow} className="underline cursor-pointer">
              Hủy
            </button>
          </div>
        )}

        {isHunterActive && (
          <div className="rounded-xl bg-red-600/95 border-2 border-[#140f0e] px-3.5 py-1.5 text-xs font-black text-white shadow-lg animate-pulse text-center">
            🏹 BẠN ĐÃ HY SINH! Chạm vào 1 người còn sống rồi bấm BẮN KÉO THEO!
          </div>
        )}
      </div>

      {/* Prominent Floating Seer Result Toast */}
      {seerToast && (room.phase === PHASES.NIGHT || room.phase === PHASES.DAWN) && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[115] ggd-card px-4 py-2.5 flex items-center gap-3 shadow-2xl border-sky-400 max-w-[90vw]">
          <span className="text-2xl">🔮</span>
          <div className="text-xs sm:text-sm">
            <div className="text-[10px] font-bold uppercase text-sky-300">Kết quả soi Đêm {seerToast.night}</div>
            <div className="font-black">
              {seerToast.targetName} là{' '}
              <span className={seerToast.isWolf ? 'text-red-400' : 'text-emerald-400'}>
                {seerToast.isWolf ? '🐺 MA SÓI!' : '🏡 KHÔNG PHẢI SÓI!'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSeerToast(null)}
            className="p-1 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Prominent Cursed Wolf Assimilation Notice */}
      {showConvertedBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[116] ggd-card px-4 py-2.5 border-red-500 bg-red-950/95 flex items-center gap-3 shadow-2xl max-w-[92vw]">
          <span className="text-2xl">🩸</span>
          <div className="text-xs">
            <div className="font-black text-red-300">BẠN ĐÃ BỊ SÓI NGUYỀN ĐỒNG HÓA!</div>
            <div className="text-red-100">Từ giờ bạn thuộc <b>PHE MA SÓI</b> — hãy phối hợp giấu mặt!</div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedConvertDay(room.dayCount)}
            className="p-1 rounded-full hover:bg-white/10 text-red-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
      {room.phase === PHASES.DAWN && !showConvertedBanner && (
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

      {/* Y-Sorted Illustrated Villagers around the Sân Đình Plaza */}
      {activePlayers.map((p, idx) => {
        const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
        const isAccused =
          (room.phase === PHASES.DAY_DEFENSE || room.phase === PHASES.DAY_VERDICT) &&
          room.accusedId === p.id;

        const rScale = isAccused ? 0.54 : 1;
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
        const wolfCurseTarget = wolfTargeting && Boolean(priv?.curseActive);
        const cupidPicked = cupidPick.includes(p.id);
        const isSelected = activeTargetId === p.id || cupidPicked;
        const targetable = isTargetableNow(p);

        const reactions = activeReactions.filter((r) => r.targetId === p.id);
        const bubble = chatBubbles[p.id];

        return (
          <div
            key={p.id}
            onClick={(e) => handleSeatClick(e, p)}
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${centerYOffset + y}px)`,
              transform: `translate(-50%, -50%) scale(${depthScale})`,
              zIndex: isSelected ? 95 : zOrder,
              animationDelay: `${Math.min(idx * 45, 650)}ms`,
            }}
            className={`absolute flex flex-col items-center anim-seat-enter ${
              targetable || selectedThrow ? 'cursor-pointer' : ''
            }`}
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

            <div
              className={`relative rounded-full transition-all ${isSpeaking ? 'speaking-ring' : ''} ${
                isSelected
                  ? isHunterActive
                    ? 'ring-3 ring-red-500 shadow-[0_0_16px_rgba(239,68,68,0.9)]'
                    : wolfCurseTarget
                      ? 'ring-3 ring-purple-400 shadow-[0_0_16px_rgba(192,132,252,0.9)]'
                      : 'ring-3 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.85)]'
                  : ''
              }`}
            >
              <div className="pointer-events-none absolute -top-1 -left-2 flex gap-0.5 text-xs z-20">
                {p.mayorRevealed && <span>🎖️</span>}
                {p.isLover && <span>💘</span>}
                {p.role && isWolfRole(p.role) && !isMe && <span>🐺</span>}
                {wolfCurseTarget ? (
                  <span className="animate-bounce">🩸</span>
                ) : (
                  wolfTargeting && <span className="animate-bounce">🐾</span>
                )}
                {cupidPicked && <span>💘</span>}
                {isHunterActive && p.alive && p.id !== me?.id && isSelected && <span>🎯</span>}
              </div>

              <PixelVillager
                avatarId={p.avatarId}
                alive={p.alive}
                size={baseSprite}
                isNight={isNight}
                eyeState={getEyeState(p)}
                isSpeaking={isSpeaking}
                isAccused={isAccused}
                emoteKey={emoteTriggers[p.id] ?? null}
                staggerIndex={idx}
                enablePoke={!targetable || isSelected}
                onHeavyImpact={triggerHeavyShake}
              />
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
                className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9.5px] font-extrabold bg-[#191413]/95 border border-black"
                style={{ color: tagDef.color }}
              >
                {tagDef.icon} {tagDef.label}
              </span>
            )}
          </div>
        );
      })}

      {/* Bottom-Right Glossy Orange SKIP Button */}
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

      {/* SMART THUMB-FRIENDLY BOTTOM ACTION DOCK */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[105] flex flex-col items-center gap-1.5 max-w-[56vw] sm:max-w-[66vw]"
      >
        {/* Suspect Tag Picker anchored cleanly above dock when user opens Tag for selected player */}
        {tagMenuOpen && activeTarget && (
          <div className="ggd-card p-1.5 flex flex-wrap justify-center gap-1">
            {SUSPECT_TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSetSuspectTag(activeTarget.id, t.id);
                  setTagMenuOpen(false);
                }}
                className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[#181312] hover:bg-[#322724] flex items-center gap-1 cursor-pointer"
              >
                <span>{t.icon}</span>
                <span style={{ color: t.color }}>{t.label}</span>
              </button>
            ))}
            {suspectTags[activeTarget.id] && (
              <button
                type="button"
                onClick={() => {
                  onSetSuspectTag(activeTarget.id, null);
                  setTagMenuOpen(false);
                }}
                className="text-[11px] font-bold text-slate-300 px-2 py-1 rounded-lg bg-[#181312] cursor-pointer"
              >
                ✕ Xóa
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* HUNTER SHOT DOCK (Active even though Hunter is dead!) */}
          {isHunterActive && (
            <div className="ggd-card p-1.5 flex items-center gap-2 border-red-500">
              {activeTarget && activeTarget.alive && activeTarget.id !== me?.id ? (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('gunshot');
                    onHunterShot(activeTarget.id);
                  }}
                  className="ggd-btn bg-red-600 text-white px-4 py-2 text-xs sm:text-sm animate-pulse"
                >
                  💥 BẮN KÉO THEO {activeTarget.name}
                </button>
              ) : (
                <span className="px-3 py-1.5 text-xs font-extrabold text-amber-300">
                  🏹 Chạm 1 người trên sân để ngắm bắn!
                </span>
              )}
            </div>
          )}

          {/* DAY DISCUSS VOTE DOCK */}
          {room.phase === PHASES.DAY_DISCUSS && me?.alive && (
            <div className="ggd-card p-1.5 flex flex-wrap items-center justify-center gap-1.5">
              {activeTarget && activeTarget.alive ? (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('click');
                    onDayVote(activeTarget.id);
                  }}
                  className={`ggd-btn px-3 py-1.5 text-xs ${
                    room.publicDayVotes?.[me.id]?.targetId === activeTarget.id
                      ? 'bg-amber-400 text-black'
                      : 'bg-[#d65539] text-white'
                  }`}
                >
                  🗳️ {room.publicDayVotes?.[me.id]?.targetId === activeTarget.id ? 'Đang Vote' : 'Vote Treo'} {activeTarget.name}
                </button>
              ) : (
                <span className="px-2 text-[11px] text-amber-200/90 font-bold hidden sm:inline">
                  👆 Chạm người để Vote
                </span>
              )}

              {activeTarget && (
                <button
                  type="button"
                  onClick={() => setTagMenuOpen((o) => !o)}
                  className="ggd-btn bg-[#2c2320] text-amber-200 px-2.5 py-1.5 text-xs"
                  title="Gắn nhãn nghi ngờ"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nhãn</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sfx.play('click');
                  onDayVote('skip');
                }}
                className={`ggd-btn px-2.5 py-1.5 text-xs ${
                  myDayVote === 'skip' ? 'bg-amber-400 text-black' : 'bg-[#2c2320] text-slate-100'
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
            </div>
          )}

          {/* DAY VERDICT DOCK */}
          {room.phase === PHASES.DAY_VERDICT && me?.alive && me?.id !== room.accusedId && (
            <div className="ggd-card p-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sfx.play('click');
                  onVerdictVote('HANG');
                }}
                className={`ggd-btn px-3.5 py-1.5 text-xs ${
                  myVerdictVote === 'HANG' ? 'bg-red-500 text-white ring-2 ring-amber-300' : 'bg-red-800 text-white'
                }`}
              >
                ⚔️ TREO ({verdictTally.hang})
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.play('click');
                  onVerdictVote('SPARE');
                }}
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

          {/* NIGHT EARLY: CUPID */}
          {isNight && room.nightStage === 'EARLY' && me?.alive && myRole === 'cupid' && room.dayCount === 1 && !priv?.villagePowersLost && !priv?.myNightDone && (
            <div className="ggd-card p-1.5 flex items-center gap-2 text-xs">
              <span className="px-2 font-bold text-pink-200">
                💘 Ghép đôi ({cupidPick.length}/2)
              </span>
              {cupidPick.length === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('chime');
                    onNightCupid(cupidPick);
                    setCupidPick([]);
                  }}
                  className="ggd-btn bg-pink-500 text-white px-3 py-1.5 text-xs"
                >
                  💘 Chốt Cặp Đôi
                </button>
              )}
            </div>
          )}

          {/* NIGHT EARLY: GUARD */}
          {isNight && room.nightStage === 'EARLY' && me?.alive && myRole === 'guard' && !priv?.villagePowersLost && !priv?.myNightDone && (
            <div className="ggd-card p-1.5 flex items-center gap-2 text-xs">
              {activeTarget && activeTarget.alive && activeTarget.id !== priv?.lastGuardedId ? (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('pop');
                    onNightGuard(activeTarget.id);
                  }}
                  className="ggd-btn bg-sky-400 text-black px-3.5 py-1.5 text-xs"
                >
                  🛡️ Bảo Vệ {activeTarget.name}
                </button>
              ) : (
                <span className="px-2.5 py-1 font-bold text-sky-200">
                  🛡️ Chạm 1 người để Bảo Vệ đêm nay
                </span>
              )}
            </div>
          )}

          {/* NIGHT EARLY: WOLVES (CLEAR SEPARATION BETWEEN BITE vs CURSE) */}
          {isNight && room.nightStage === 'EARLY' && me?.alive && isWolfRole(myRole) && (
            <div className="ggd-card p-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              {priv?.wolfLocked ? (
                <span className="px-3 py-1 font-bold text-amber-200">
                  {priv?.curseActive ? '🩸 Đã chốt Nguyền Hóa Sói! Chờ trời sáng...' : '🐺 Đã chốt mục tiêu cắn đêm nay!'}
                </span>
              ) : activeTarget && activeTarget.alive && !isWolfRole(activeTarget.role) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.play('bite');
                      onNightWolfVote(activeTarget.id, false, true);
                    }}
                    className="ggd-btn bg-[#b91c1c] text-white px-3 py-1.5 text-xs"
                  >
                    🐺 Cắn Giết {activeTarget.name}
                  </button>
                  {myRole === 'cursed_wolf' && !priv?.cursedUsed && (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('curse');
                        onNightWolfVote(activeTarget.id, true, true);
                      }}
                      className="ggd-btn bg-purple-600 text-white px-3 py-1.5 text-xs ring-2 ring-red-400"
                    >
                      🩸 Nguyền {activeTarget.name} Thành Sói (1 lần)
                    </button>
                  )}
                </>
              ) : (
                <span className="px-2.5 py-1 font-bold text-red-200">
                  🐺 Chạm 1 dân làng để chọn {myRole === 'cursed_wolf' && !priv?.cursedUsed ? 'Cắn hoặc Nguyền' : 'Cắn Giết'}
                </span>
              )}
            </div>
          )}

          {/* NIGHT LATE: SEER */}
          {isNight && room.nightStage === 'LATE' && me?.alive && myRole === 'seer' && !priv?.villagePowersLost && !priv?.myNightDone && (
            <div className="ggd-card p-1.5 flex items-center gap-2 text-xs">
              {activeTarget && activeTarget.alive && activeTarget.id !== me.id ? (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('chime');
                    onNightSeer(activeTarget.id);
                  }}
                  className="ggd-btn bg-indigo-500 text-white px-3.5 py-1.5 text-xs"
                >
                  🔮 Soi Vai Trò {activeTarget.name}
                </button>
              ) : (
                <span className="px-2.5 py-1 font-bold text-indigo-200">
                  🔮 Chạm 1 người trên sân để Soi
                </span>
              )}
            </div>
          )}

          {/* NIGHT LATE: WITCH */}
          {isNight && room.nightStage === 'LATE' && me?.alive && myRole === 'witch' && !priv?.myNightDone && !priv?.villagePowersLost && (
            <div className="ggd-card p-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              {witchVictim && priv?.witchHealLeft && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('potion');
                    onNightWitch({ heal: true, poisonTargetId: null });
                  }}
                  className="ggd-btn bg-emerald-400 text-black px-2.5 py-1 text-xs"
                >
                  💚 Cứu {witchVictim.name}
                </button>
              )}
              {priv?.witchPoisonLeft && witchMode === 'poison' && activeTarget && activeTarget.alive ? (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('potion');
                    onNightWitch({ heal: false, poisonTargetId: activeTarget.id });
                    setWitchMode('idle');
                  }}
                  className="ggd-btn bg-purple-600 text-white px-3 py-1 text-xs"
                >
                  ☠️ Quăng Độc {activeTarget.name}
                </button>
              ) : (
                priv?.witchPoisonLeft && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetId(null);
                      setWitchMode((m) => (m === 'poison' ? 'idle' : 'poison'));
                    }}
                    className={`ggd-btn px-2.5 py-1 text-xs ${
                      witchMode === 'poison' ? 'bg-purple-500 text-white' : 'bg-[#2c2142] text-purple-200'
                    }`}
                  >
                    ☠️ {witchMode === 'poison' ? 'Chạm nạn nhân để đầu độc' : 'Dùng Độc'}
                  </button>
                )
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

          {/* Passive Night / Dead / Spectator Context Pill */}
          {isNight && !isMySoloNightTurn && (!isWolfRole(myRole) || !me?.alive) && (
            <div className="ggd-card px-3 py-1 text-[11px] font-bold text-amber-100/85">
              {!me?.alive || me?.isSpectator
                ? '👻 Cõi Âm — Bạn có thể Voice/Chat với hồn ma khác'
                : '🌙 Ban đêm — Chờ những vai trò thức đêm hành động...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
