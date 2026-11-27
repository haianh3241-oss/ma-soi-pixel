import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, Pause, Play, Settings, SlidersHorizontal, Smartphone, Tag, Vote, X } from 'lucide-react';
import { INTERACTIONS, PHASES, SUSPECT_TAGS } from '../../shared/constants.js';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import PixelVillager from './PixelVillager.jsx';
import VillagerPuppetRig from './VillagerPuppetRig.jsx';
import GallowsStage from './GallowsStage.jsx';
import VirtualJoystick from './VirtualJoystick.jsx';
import PauseMenuModal from './PauseMenuModal.jsx';
import TouchHudEditorModal from './TouchHudEditorModal.jsx';
import AmongUsVoteModal from './AmongUsVoteModal.jsx';
import { loadTouchHudConfig, saveTouchHudConfig } from '../utils/touchHudConfig.js';
import {
  ARENA_COLLIDERS,
  ARENA_WALKABLE_BOUNDS,
  CAMPFIRE_POS,
  DEFAULT_MOVEMENT_CONFIG,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../engine/movementConfig.js';
import { usePlayerController } from '../hooks/usePlayerController.js';
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
    <div
      style={{
        left: `${CAMPFIRE_POS.x}px`,
        top: `${CAMPFIRE_POS.y}px`,
        zIndex: CAMPFIRE_POS.y,
        transform: 'translate(-50%, -62%)',
      }}
      className="pointer-events-none absolute flex flex-col items-center justify-center select-none"
    >
      {isNight && (
        <div
          className="absolute w-72 h-48 rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(251,146,60,0.45) 0%, rgba(251,146,60,0) 72%)',
          }}
        />
      )}

      {!isNight && (
        <div className="absolute -top-6 flex gap-2 z-20">
          <span className="anim-smoke inline-block w-3.5 h-3.5 rounded-full bg-slate-200/75" />
          <span className="anim-smoke inline-block w-4 h-4 rounded-full bg-white/65" style={{ animationDelay: '0.6s' }} />
        </div>
      )}

      {isNight || outMissing ? (
        <img
          src={ASSET_PATHS.campfireLit}
          alt="Đống lửa trại"
          draggable={false}
          className={`w-28 h-28 object-contain ${isNight ? 'anim-fire' : ''}`}
          style={
            isNight
              ? undefined
              : {
                  filter: 'brightness(0.45) saturate(0.18) contrast(1.15)',
                  opacity: 0.88,
                }
          }
        />
      ) : (
        <img
          src={ASSET_PATHS.campfireOut}
          alt="Đống lửa tắt"
          draggable={false}
          onError={() => setOutMissing(true)}
          className="w-28 h-28 object-contain"
        />
      )}
    </div>
  );
}

export default function VillageArena({
  room,
  me,
  socket,
  nowMs,
  speakingPeers = {},
  activeReactions = [],
  projectiles = [],
  chatBubbles = {},
  suspectTags = {},
  selectedThrow = null,
  isLobbyCourtyard = false,
  isUiBlocked = false,
  copied = false,
  onCopyInvite,
  onOpenLobbySettings,
  onAddBot,
  onStartGame,
  onOpenAudioMixer,
  onLeaveRoom,
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
  const cameraRef = useRef(null);
  const stageTransformRef = useRef({
    scale: 0.75,
    camX: 0,
    camY: 0,
    viewportW: 1000,
    viewportH: 700,
    rectLeft: 0,
    rectTop: 0,
  });
  const actorNodeMapRef = useRef(new Map());

  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [cupidPick, setCupidPick] = useState([]);
  const [witchMode, setWitchMode] = useState('idle');
  const [emoteTriggers, setEmoteTriggers] = useState({});
  const [arenaShake, setArenaShake] = useState(false);
  const [seerToast, setSeerToast] = useState(null);
  const [dismissedConvertDay, setDismissedConvertDay] = useState(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [touchEditorOpen, setTouchEditorOpen] = useState(false);
  const [touchHudConfig, setTouchHudConfig] = useState(() => loadTouchHudConfig());
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [lobbyError, setLobbyError] = useState('');
  const [controlsHintOpen, setControlsHintOpen] = useState(true);

  const [actorAnims, setActorAnims] = useState({}); // id -> { anim, wolf }
  const [dustPuffs, setDustPuffs] = useState([]);
  const [slashVfx, setSlashVfx] = useState([]);

  const seenProjectilesRef = useRef(new Set());
  const prevDefenseKeyRef = useRef(null);
  const prevSeerCountRef = useRef(0);

  useEffect(() => {
    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsTouchDevice(Boolean(touch));
  }, []);

  useEffect(() => {
    if (!controlsHintOpen) return undefined;
    const t = setTimeout(() => setControlsHintOpen(false), 8500);
    return () => clearTimeout(t);
  }, [controlsHintOpen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
        const scale =
          rect.width < 768
            ? Math.max(0.64, (rect.height / WORLD_HEIGHT) * 0.85)
            : Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
        stageTransformRef.current.scale = scale;
        stageTransformRef.current.viewportW = rect.width;
        stageTransformRef.current.viewportH = rect.height;
        stageTransformRef.current.rectLeft = rect.left;
        stageTransformRef.current.rectTop = rect.top;
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const priv = room.selfPrivate;
  const myRole = priv?.role;
  const isNight = room.phase === PHASES.NIGHT;
  const secondsLeft = formatCountdown(room.phaseEndsAt, nowMs);
  const activePlayers = useMemo(() => room.players.filter((p) => !p.isSpectator), [room.players]);
  const alivePlayers = useMemo(() => activePlayers.filter((p) => p.alive), [activePlayers]);
  const isHost = room.hostId === me?.id;

  const canMoveNow = priv?.canMove !== undefined ? Boolean(priv.canMove) : isLobbyCourtyard || room.phase === PHASES.DAY_DISCUSS || !me?.alive;
  const canMeleeNow =
    !me?.alive ||
    isLobbyCourtyard ||
    [PHASES.LOBBY, PHASES.ROLE_REVEAL, PHASES.DAY_DISCUSS, PHASES.GAME_OVER].includes(room.phase);
  const isMyWolfForm = Boolean(isNight && me?.alive && isWolfRole(myRole));
  const isMyGhostForm = Boolean(me && !me.alive);

  const handleActorAnimChange = useCallback((id, anim, wolfTransformed) => {
    setActorAnims((prev) => {
      const cur = prev[id];
      if (cur && cur.anim === anim && cur.wolf === wolfTransformed) return prev;
      return { ...prev, [id]: { anim, wolf: wolfTransformed } };
    });
  }, []);

  const handleDustBurst = useCallback(({ x, y, count = 3 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDustPuffs((prev) => [...prev.slice(-18), { id, x, y, count }]);
    setTimeout(() => {
      setDustPuffs((prev) => prev.filter((d) => d.id !== id));
    }, 460);
  }, []);

  const handleSlashVfx = useCallback((fx) => {
    setSlashVfx((prev) => [...prev.slice(-12), fx]);
    setTimeout(() => {
      setSlashVfx((prev) => prev.filter((s) => s.id !== fx.id));
    }, 300);
  }, []);

  const controller = usePlayerController({
    socket,
    room,
    me,
    canMove: canMoveNow,
    canMelee: canMeleeNow,
    isWolfForm: isMyWolfForm,
    isGhostForm: isMyGhostForm,
    isUiBlocked: isUiBlocked || pauseOpen || voteModalOpen || tagMenuOpen || touchEditorOpen,
    actorNodeMapRef,
    cameraRef,
    stageTransformRef,
    onActorAnimChange: handleActorAnimChange,
    onDustBurst: handleDustBurst,
    onSlashVfx: handleSlashVfx,
    onTogglePause: useCallback(() => setPauseOpen((o) => !o), []),
  });

  useEffect(() => {
    preloadRoomVillagers(activePlayers.map((p) => p.avatarId));
  }, [activePlayers]);

  useEffect(() => {
    setSelectedTargetId(null);
    setTagMenuOpen(false);
    setWitchMode('idle');
    setCupidPick([]);
    if (room.phase !== PHASES.DAY_DISCUSS) {
      setVoteModalOpen(false);
    }
  }, [room.phase, room.nightStage, room.dayCount]);

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

  useEffect(() => {
    const key = room.phase === PHASES.DAY_DEFENSE && room.accusedId ? `${room.dayCount}-${room.accusedId}` : null;
    if (key && prevDefenseKeyRef.current !== key) {
      prevDefenseKeyRef.current = key;
      setEmoteTriggers((prev) => ({ ...prev, [room.accusedId]: (prev[room.accusedId] || 0) + 1 }));
    } else if (!key) {
      prevDefenseKeyRef.current = null;
    }
  }, [room.phase, room.dayCount, room.accusedId]);

  const bindActorDom = (id, part) => (el) => {
    if (!actorNodeMapRef.current.has(id)) {
      actorNodeMapRef.current.set(id, {});
    }
    const entry = actorNodeMapRef.current.get(id);
    if (el) entry[part] = el;
    else if (entry) delete entry[part];
  };

  const triggerHeavyShake = () => {
    setArenaShake(true);
    setTimeout(() => setArenaShake(false), 180);
  };

  // Helper: Sprint hero to target's courtyard spot if far during Night before firing skill!
  const performOrWalkNightAction = (targetPlayer, actionFn) => {
    if (!me || !targetPlayer || !canMoveNow) {
      actionFn();
      return;
    }
    const hero = controller.actorsRef.current.get(me.id);
    const tgt = controller.actorsRef.current.get(targetPlayer.id);
    const hx = hero?.x ?? me.x ?? 800;
    const hy = hero?.y ?? me.y ?? 650;
    const tx = tgt?.x ?? targetPlayer.sleepOrigin?.x ?? targetPlayer.x ?? 800;
    const ty = tgt?.y ?? targetPlayer.sleepOrigin?.y ?? targetPlayer.y ?? 650;
    const dist = Math.hypot(tx - hx, ty - hy);
    if (dist > DEFAULT_MOVEMENT_CONFIG.nightActionRange) {
      controller.setWaypoint(tx, ty, {
        arriveRadius: DEFAULT_MOVEMENT_CONFIG.nightActionRange * 0.85,
        fast: true,
        onArrive: actionFn,
      });
    } else {
      actionFn();
    }
  };

  const skipVotes = room.skipVotes || [];
  const iSkipped = me ? skipVotes.includes(me.id) : false;
  const canSkipNow =
    !isLobbyCourtyard &&
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
    if (isWolfRole(p.role) && p.wolfTransformed) return 'wolf';
    if (p.id === me?.id && isMySoloNightTurn) return 'awake';
    if (p.nightActorVisible && (!me?.alive || p.id === me?.id)) return 'awake';
    return 'sleep';
  };

  const isTargetableNow = (p) => {
    if (selectedThrow) return true;
    if (!p.alive) return false;
    if (isHunterActive) return p.id !== me?.id;
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
        onNightWolfVote(p.id, false, false);
      }
      return;
    }

    setSelectedTargetId((cur) => (cur === p.id ? null : p.id));
    setTagMenuOpen(false);
  };

  const handleStageClick = (e) => {
    setSelectedTargetId(null);
    setTagMenuOpen(false);
    if (controller.settings.clickToMove && canMoveNow) {
      const st = stageTransformRef.current;
      const wx = (e.clientX - st.rectLeft) / st.scale + st.camX;
      const wy = (e.clientY - st.rectTop) / st.scale + st.camY;
      controller.setWaypoint(wx, wy);
    }
  };

  const visibleActors = useMemo(
    () => activePlayers.filter((p) => p.alive || p.ghostVisible || room.phase === PHASES.GAME_OVER),
    [activePlayers, room.phase]
  );

  // Non-lynched corpses stay lying on the ground at their exact death site until GAME_OVER
  const groundCorpses = useMemo(
    () => activePlayers.filter((p) => !p.alive && p.deathInfo && p.deathInfo.cause !== 'lynch'),
    [activePlayers]
  );

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

  const showTouchJoystick =
    controller.settings.touchMode === 'always' || (controller.settings.touchMode === 'auto' && isTouchDevice);

  const castVoteCount = Object.keys(room.publicDayVotes || {}).length;

  return (
    <div
      ref={containerRef}
      onClick={handleStageClick}
      onContextMenu={(e) => {
        if (!canMoveNow) return;
        e.preventDefault();
        const st = stageTransformRef.current;
        const wx = (e.clientX - st.rectLeft) / st.scale + st.camX;
        const wy = (e.clientY - st.rectTop) / st.scale + st.camY;
        controller.setWaypoint(wx, wy);
      }}
      onPointerMove={controller.handleArenaPointerMove}
      className={`relative w-full h-full overflow-hidden select-none bg-[#171211] ${arenaShake ? 'anim-arena-shake' : ''}`}
    >
      {/* CAMERA-TRACKED 1600x900 2.5D COURTYARD WORLD */}
      <div
        ref={cameraRef}
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transformOrigin: 'top left',
          transform: `scale(${stageTransformRef.current.scale}) translate3d(${-stageTransformRef.current.camX}px, ${-stageTransformRef.current.camY}px, 0)`,
        }}
        className="absolute top-0 left-0 will-change-transform"
      >
        {/* LAYER 1: Day / Night Painted Sân Đình Backgrounds */}
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

        {/* Debug Collision Overlay (Toggle via ESC Menu) */}
        {controller.settings.showColliders && (
          <svg
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
            className="pointer-events-none absolute inset-0 w-full h-full z-[990]"
          >
            <ellipse
              cx={ARENA_WALKABLE_BOUNDS.cx}
              cy={ARENA_WALKABLE_BOUNDS.cy}
              rx={ARENA_WALKABLE_BOUNDS.rx}
              ry={ARENA_WALKABLE_BOUNDS.ry}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="3"
              strokeDasharray="10 6"
            />
            {ARENA_COLLIDERS.map((col) =>
              col.shape === 'circle' ? (
                <g key={col.id}>
                  <circle cx={col.x} cy={col.y} r={col.r} fill="rgba(239,68,68,0.22)" stroke="#f87171" strokeWidth="2.5" />
                  <text x={col.x} y={col.y} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold">
                    {col.label}
                  </text>
                </g>
              ) : (
                <g key={col.id}>
                  <rect
                    x={col.minX}
                    y={col.minY}
                    width={col.maxX - col.minX}
                    height={col.maxY - col.minY}
                    fill="rgba(239,68,68,0.22)"
                    stroke="#f87171"
                    strokeWidth="2.5"
                  />
                  <text
                    x={(col.minX + col.maxX) / 2}
                    y={(col.minY + col.maxY) / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="13"
                    fontWeight="bold"
                  >
                    {col.label}
                  </text>
                </g>
              )
            )}
          </svg>
        )}

        {/* LAYER 2: Gallows Stage (Trăn Trối & Persistent Hanged Corpses) */}
        <GallowsStage players={activePlayers} accusedId={room.accusedId} phase={room.phase} />

        {/* LAYER 3: Persistent Ground Crime Scene Corpses (neutral — never leaks Wolf/Witch/Hunter/Love cause!) */}
        {groundCorpses.map((p) => {
          const cx = p.deathInfo.x ?? 800;
          const cy = p.deathInfo.y ?? 650;
          return (
            <div
              key={`corpse-${p.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTargetId((cur) => (cur === p.id ? null : p.id));
              }}
              style={{
                left: `${cx}px`,
                top: `${cy}px`,
                zIndex: Math.max(12, Math.round(cy - 18)),
                transform: 'translate(-50%, -62%)',
              }}
              className="absolute w-28 h-28 flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="relative z-10 -rotate-[82deg] translate-y-2 saturate-75 brightness-90">
                <VillagerPuppetRig avatarId={p.avatarId} size={78} pose="corpse" emoteHead={true} />
              </div>
              <span className="relative z-20 -mt-1 rounded-full bg-red-950/95 border border-[#140f0e] px-2 py-0.5 text-[10px] font-black text-red-200 whitespace-nowrap shadow">
                ☠️ {p.name}
              </span>
            </div>
          );
        })}

        {/* LAYER 3.5: Fixed Bamboo Sleeping Mats ("Chiếu Cói + Gối") during Night */}
        {isNight &&
          alivePlayers.map((p) => {
            const sx = p.sleepOrigin?.x ?? p.x ?? 800;
            const sy = p.sleepOrigin?.y ?? p.y ?? 650;
            const isMyMat = p.id === me?.id;
            return (
              <div
                key={`mat-${p.id}`}
                style={{
                  left: `${sx}px`,
                  top: `${sy}px`,
                  zIndex: Math.max(8, Math.round(sy - 28)),
                  transform: 'translate(-50%, -62%)',
                }}
                className="pointer-events-none absolute w-[114px] h-[60px] flex items-center justify-center select-none"
              >
                <img
                  src={ASSET_PATHS.sleepingMat}
                  alt="Chiếu ngủ"
                  draggable={false}
                  decoding="async"
                  className="w-full h-full object-contain opacity-95 drop-shadow-[0_4px_6px_rgba(0,0,0,0.55)]"
                />
                {isMyMat && canMoveNow && (
                  <span className="absolute -bottom-3 rounded-full bg-amber-950/90 border border-amber-400/70 px-1.5 py-0.2 text-[9px] font-black text-amber-200 whitespace-nowrap shadow">
                    🛏️ Chiếu của bạn
                  </span>
                )}
              </div>
            );
          })}

        {/* LAYER 4: Campfire Center */}
        <CampfireCenter isNight={isNight} />

        {/* LAYER 5: Footstep Dust & Melee Slash Arcs */}
        {dustPuffs.map((d) => (
          <div
            key={d.id}
            style={{ left: d.x, top: d.y, zIndex: Math.round(d.y + 4) }}
            className="pointer-events-none absolute anim-dust-puff flex gap-1"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-100/75 blur-[1px]" />
            {d.count > 3 && <span className="w-2.5 h-2.5 rounded-full bg-amber-200/70 blur-[1px]" />}
          </div>
        ))}

        {slashVfx.map((fx) => {
          const isKick = fx.type === 'kick';
          const angle = Math.atan2(fx.dirY || 0, fx.dirX || 1) * (180 / Math.PI);
          return (
            <div
              key={fx.id}
              style={{
                left: fx.x + (fx.dirX || 1) * 42,
                top: fx.y - 34 + (fx.dirY || 0) * 32,
                zIndex: 880,
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              }}
              className="pointer-events-none absolute"
            >
              <div
                className={`anim-melee-arc rounded-full ${
                  isKick
                    ? 'w-20 h-20 border-r-[7px] border-t-[4px] border-orange-400 shadow-[0_0_16px_#f97316]'
                    : 'w-14 h-14 border-r-[5px] border-t-[3px] border-amber-300 shadow-[0_0_12px_#fde047]'
                }`}
              />
              <span className="absolute -top-5 left-0 font-black text-xs text-amber-300 drop-shadow-[0_2px_0_#140f0e] whitespace-nowrap">
                {isKick ? 'BÙM! 🦵' : 'BỐP! 👊'}
              </span>
            </div>
          );
        })}

        {/* LAYER 7: Flying Throwables */}
        <div className="pointer-events-none absolute inset-0 z-[900] overflow-hidden">
          {projectiles.map((proj) => {
            const item = INTERACTIONS.find((i) => i.id === proj.itemId);
            if (!item) return null;
            return (
              <div
                key={proj.id}
                className="absolute text-4xl"
                style={{
                  left: '50%',
                  top: '55%',
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

        {/* LAYER 8: 60 FPS Y-Sorted Actors (Living Players, Transformed Night Wolves & Ghosts) */}
        {visibleActors.map((p, idx) => {
          const isMe = p.id === me?.id;
          const isAccused =
            (room.phase === PHASES.DAY_DEFENSE || room.phase === PHASES.DAY_VERDICT) &&
            room.accusedId === p.id;
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

          const aState = actorAnims[p.id] || {
            anim: !p.alive ? 'ghost' : p.anim || 'idle',
            wolf: Boolean(p.wolfTransformed),
          };
          const wolfRoleSprite = aState.wolf ? (p.role === 'cursed_wolf' ? 'cursed_wolf' : 'werewolf') : null;
          const initX = p.x ?? 800;
          const initY = p.y ?? 650;

          return (
            <div
              key={p.id}
              data-seat-click="true"
              ref={bindActorDom(p.id, 'root')}
              onClick={(e) => handleSeatClick(e, p)}
              style={{
                left: 0,
                top: 0,
                width: 96,
                height: 102,
                transform: `translate3d(${initX}px, ${initY}px, 0) translate(-50%, -88%)`,
                zIndex: isSelected ? 910 : Math.round(initY),
              }}
              className={`absolute flex flex-col items-center justify-end ${
                targetable || selectedThrow ? 'cursor-pointer' : ''
              }`}
            >
              {/* Ground shadow stays anchored on bricks while body jumps/floats */}
              <div
                ref={bindActorDom(p.id, 'shadow')}
                className={`pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full blur-[1px] ${
                  wolfRoleSprite ? 'bg-red-800/65 shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-black/50'
                }`}
                style={{ width: 58, height: 15 }}
              />

              {bubble && (
                <div
                  key={bubble.id}
                  className="anim-chat-bubble pointer-events-none absolute -top-9 left-1/2 z-40 max-w-[160px] rounded-xl bg-white text-black px-2.5 py-0.5 text-[11px] font-extrabold shadow-lg border-2 border-[#0b0d17] truncate"
                >
                  {bubble.text}
                </div>
              )}

              {reactions.map((r) => {
                const item = INTERACTIONS.find((i) => i.id === r.itemId);
                return (
                  <div
                    key={r.id}
                    className="anim-reaction pointer-events-none absolute -top-6 left-1/2 z-40 text-2xl drop-shadow"
                  >
                    {item?.emoji}
                  </div>
                );
              })}

              {/* 60 FPS Body Rig (Z-jump, facing flip, run tilt) */}
              <div
                ref={bindActorDom(p.id, 'body')}
                style={{ transformOrigin: '50% 88%' }}
                className={`relative rounded-full ${isSpeaking ? 'speaking-ring' : ''} ${
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
                  {!p.alive && <span title="Hồn ma">👻</span>}
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
                  size={96}
                  hideShadow={true}
                  isNight={isNight}
                  eyeState={getEyeState(p)}
                  animState={aState.anim}
                  wolfFormRole={wolfRoleSprite}
                  isSpeaking={isSpeaking}
                  isAccused={isAccused}
                  emoteKey={emoteTriggers[p.id] ?? null}
                  staggerIndex={idx}
                  enablePoke={false}
                  onHeavyImpact={triggerHeavyShake}
                />
              </div>

              {/* Nameplate & Badges */}
              <div className="relative z-30 flex items-center gap-1 -mt-1">
                <span
                  className={`sc-nameplate px-2.5 py-0.5 text-[11px] font-extrabold max-w-[116px] truncate ${
                    isMe
                      ? 'text-amber-300 border-amber-400/80'
                      : !p.alive
                        ? 'text-sky-300 border-sky-400/60'
                        : wolfRoleSprite
                          ? 'text-red-300 border-red-500/70'
                          : 'text-white'
                  }`}
                >
                  {!p.alive ? `👻 ${p.name}` : wolfRoleSprite ? `🐺 ${p.name}` : p.name}
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
      </div>

      {/* =====================================================================
          SCREEN-SPACE HUD OVERLAYS
         ===================================================================== */}

      {/* LOBBY COURTYARD TOP BAR */}
      {isLobbyCourtyard ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 inset-x-2.5 z-40 flex flex-wrap items-center justify-between gap-2 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap">
            <div className="sc-timer-pill px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="font-brand text-amber-300">🏡 SÂN CHỜ TỰ DO</span>
              <span className="text-sky-300 font-black">#{room.code}</span>
              <span className="text-slate-300 text-[11px]">({room.players.length}/16)</span>
            </div>
            <button
              type="button"
              onClick={onCopyInvite}
              className="ggd-btn bg-sky-400 text-black px-2.5 py-1.5 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Đã Copy!' : 'Mời Bạn'}</span>
            </button>
            {isHost && (
              <button
                type="button"
                onClick={onAddBot}
                className="ggd-btn bg-indigo-500 text-white px-2.5 py-1.5 text-xs"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>+ Bot AI</span>
              </button>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onOpenLobbySettings}
              className="ggd-btn bg-[#faf3e6] text-[#262121] px-3 py-1.5 text-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cài Đặt Phòng & Vai Trò</span>
            </button>
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  setLobbyError('');
                  onStartGame?.((res) => {
                    if (!res?.ok) setLobbyError(res?.error || 'Không thể bắt đầu!');
                  });
                }}
                className="ggd-btn bg-emerald-400 text-black px-3.5 py-1.5 text-xs sm:text-sm"
              >
                <Play className="w-4 h-4" />
                <span>Bắt Đầu</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAudioMixer}
              className="ggd-btn bg-[#1f2542]/95 p-1.5 text-amber-300"
              title="Cài đặt âm thanh"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {showTouchJoystick && (
              <button
                type="button"
                onClick={() => setTouchEditorOpen(true)}
                className="ggd-btn bg-sky-500/90 px-2 py-1.5 text-xs text-black"
                title="Chỉnh vị trí & cỡ nút cảm ứng"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nút</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPauseOpen(true)}
              className="ggd-btn bg-[#1f2542]/95 px-2.5 py-1.5 text-xs text-white"
              title="Menu Tạm Dừng (ESC)"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ESC</span>
            </button>
          </div>

          {lobbyError && (
            <div className="pointer-events-auto w-full max-w-md mx-auto rounded-xl bg-red-950/95 border-2 border-red-500 px-3 py-1.5 text-xs font-bold text-red-200 text-center">
              ⚠️ {lobbyError}
            </div>
          )}
        </div>
      ) : (
        /* IN-GAME TOP-CENTER TIMER CAPSULE + VOTE MODAL TRIGGER (2nd row on mobile so corner buttons never collide) */
        <div className="absolute top-13 sm:top-2.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 max-w-[94vw]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="sc-timer-pill px-3 sm:px-4 py-1 sm:py-1.5 flex items-center gap-2">
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

            {room.phase === PHASES.DAY_DISCUSS && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sfx.play('click');
                  setVoteModalOpen(true);
                }}
                className="sc-btn-orange px-3 py-1.5 text-xs"
              >
                <Vote className="w-4 h-4" />
                <span>Bảng Vote ({castVoteCount}/{alivePlayers.length})</span>
              </button>
            )}

            {showTouchJoystick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTouchEditorOpen(true);
                }}
                className="ggd-btn bg-sky-500/95 p-2 text-black"
                title="Chỉnh vị trí & cỡ nút cảm ứng"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPauseOpen(true);
              }}
              className="ggd-btn bg-[#1f2542]/95 p-2 text-amber-200"
              title="Cài đặt điều khiển (ESC)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
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
      )}

      {/* Subtle PC Controls Pill (Dismissible) */}
      {isLobbyCourtyard && controlsHintOpen && !isTouchDevice && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-14 left-3 z-30 rounded-xl bg-[#191413]/88 border border-amber-400/40 px-2.5 py-1.5 text-[10.5px] text-amber-100 flex items-center gap-2 shadow-lg max-w-[92vw]"
        >
          <span>
            <b>WASD</b> Chạy • <b>Shift</b> Nhanh • <b>Space</b> Nhảy • <b>J</b> Đấm 👊 • <b>K</b> Đá 🦵 • <b>ESC</b> Cài đặt
          </span>
          <button
            type="button"
            onClick={() => setControlsHintOpen(false)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Seer Result Toast */}
      {seerToast && (room.phase === PHASES.NIGHT || room.phase === PHASES.DAWN) && (
        <div className="absolute top-24 sm:top-16 left-1/2 -translate-x-1/2 z-[115] ggd-card px-4 py-2.5 flex items-center gap-3 shadow-2xl border-sky-400 max-w-[90vw]">
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

      {/* Cursed Wolf Assimilation Notice */}
      {showConvertedBanner && (
        <div className="absolute top-24 sm:top-16 left-1/2 -translate-x-1/2 z-[116] ggd-card px-4 py-2.5 border-red-500 bg-red-950/95 flex items-center gap-3 shadow-2xl max-w-[92vw]">
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

      {/* Dawn Banner */}
      {room.phase === PHASES.DAWN && !showConvertedBanner && (
        <div className="absolute top-24 sm:top-16 left-1/2 -translate-x-1/2 z-[110] ggd-card px-4 py-2.5 text-center max-w-xs sm:max-w-md">
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

      {/* Defense Plea Banner */}
      {room.phase === PHASES.DAY_DEFENSE && accusedPlayer && (
        <div className="absolute top-24 sm:top-16 left-1/2 -translate-x-1/2 z-[110] rounded-full bg-red-600/95 border-2 border-[#140f0e] px-4 py-1 text-xs font-black text-white whitespace-nowrap animate-pulse shadow-lg">
          🎙️ {accusedPlayer.name} đang Trăn Trối trên Giá Treo Cổ!
        </div>
      )}

      {/* Bottom-Right SKIP Button */}
      {canSkipNow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSkip();
          }}
          className={`sc-btn-orange absolute bottom-3 right-3 z-[100] px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm ${
            iSkipped ? 'ring-3 ring-emerald-300 brightness-110' : ''
          }`}
        >
          <span>{isNight ? 'QUA ĐÊM' : 'SKIP'}</span>
          <span className="rounded-full bg-black/35 px-1.5 py-0.2 text-[10px]">
            {skipVotes.length}/{alivePlayers.length}
          </span>
        </button>
      )}

      {/* BOTTOM CENTER ACTION DOCK (lifted cleanly above corner Chat/Skip on narrow mobile screens) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-14 sm:bottom-3 left-1/2 -translate-x-1/2 z-[105] flex flex-col items-center gap-1.5 max-w-[88vw] sm:max-w-[66vw]"
      >
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
          {/* Quick Melee Buttons on Desktop when in Courtyard / Discuss */}
          {canMeleeNow && !showTouchJoystick && (
            <div className="ggd-card p-1 hidden sm:flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => controller.triggerMelee('punch')}
                className="ggd-btn bg-amber-400 text-black px-2.5 py-1 text-xs"
                title="Đấm (J)"
              >
                👊 Đấm
              </button>
              <button
                type="button"
                onClick={() => controller.triggerMelee('kick')}
                className="ggd-btn bg-orange-500 text-white px-2.5 py-1 text-xs"
                title="Đá văng (K)"
              >
                🦵 Đá
              </button>
            </div>
          )}

          {/* HUNTER SHOT */}
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
              <button
                type="button"
                onClick={() => {
                  sfx.play('click');
                  setVoteModalOpen(true);
                }}
                className="ggd-btn bg-[#d65539] text-white px-3 py-1.5 text-xs"
              >
                🗳️ Bảng Vote
              </button>

              {activeTarget && activeTarget.alive && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('click');
                    onDayVote(activeTarget.id);
                  }}
                  className={`ggd-btn px-3 py-1.5 text-xs ${
                    myDayVote === activeTarget.id ? 'bg-amber-400 text-black' : 'bg-rose-700 text-white'
                  }`}
                >
                  ✅ Vote {activeTarget.name}
                </button>
              )}

              {activeTarget && (
                <button
                  type="button"
                  onClick={() => setTagMenuOpen((o) => !o)}
                  className="ggd-btn bg-[#2c2320] text-amber-200 px-2.5 py-1.5 text-xs"
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
                ⏭️ Skip
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
                    const second = room.players.find((x) => x.id === cupidPick[1]);
                    const pair = [...cupidPick];
                    setCupidPick([]);
                    performOrWalkNightAction(second, () => {
                      sfx.play('chime');
                      onNightCupid(pair);
                    });
                  }}
                  className="ggd-btn bg-pink-500 text-white px-3 py-1.5 text-xs"
                >
                  💘 Chạy tới Bắn Tên
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
                  onClick={() =>
                    performOrWalkNightAction(activeTarget, () => {
                      sfx.play('pop');
                      onNightGuard(activeTarget.id);
                    })
                  }
                  className="ggd-btn bg-sky-400 text-black px-3.5 py-1.5 text-xs"
                >
                  🛡️ Chạy tới Bảo Vệ {activeTarget.name}
                </button>
              ) : (
                <span className="px-2.5 py-1 font-bold text-sky-200">
                  🛡️ Chạy lại gần hoặc chạm 1 người để Bảo Vệ
                </span>
              )}
            </div>
          )}

          {/* NIGHT EARLY: WOLVES */}
          {isNight && room.nightStage === 'EARLY' && me?.alive && isWolfRole(myRole) && (
            <div className="ggd-card p-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              {priv?.wolfLocked ? (
                <span className="px-3 py-1 font-bold text-amber-200">
                  {priv?.curseActive ? '🩸 Đã chốt Nguyền Hóa Sói!' : '🐺 Đã chốt mục tiêu cắn đêm nay!'}
                </span>
              ) : activeTarget && activeTarget.alive && !isWolfRole(activeTarget.role) ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      performOrWalkNightAction(activeTarget, () => {
                        sfx.play('bite');
                        onNightWolfVote(activeTarget.id, false, true);
                      })
                    }
                    className="ggd-btn bg-[#b91c1c] text-white px-3 py-1.5 text-xs"
                  >
                    🐺 Chạy tới Cắn {activeTarget.name}
                  </button>
                  {myRole === 'cursed_wolf' && !priv?.cursedUsed && (
                    <button
                      type="button"
                      onClick={() =>
                        performOrWalkNightAction(activeTarget, () => {
                          sfx.play('curse');
                          onNightWolfVote(activeTarget.id, true, true);
                        })
                      }
                      className="ggd-btn bg-purple-600 text-white px-3 py-1.5 text-xs ring-2 ring-red-400"
                    >
                      🩸 Chạy tới Nguyền {activeTarget.name}
                    </button>
                  )}
                </>
              ) : (
                <span className="px-2.5 py-1 font-bold text-red-200">
                  🐺 Bạn đã hóa Sói! Chạy tới chỗ nạn nhân ngủ để {myRole === 'cursed_wolf' && !priv?.cursedUsed ? 'Cắn hoặc Nguyền' : 'Cắn Giết'}
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
                  onClick={() =>
                    performOrWalkNightAction(activeTarget, () => {
                      sfx.play('chime');
                      onNightSeer(activeTarget.id);
                    })
                  }
                  className="ggd-btn bg-indigo-500 text-white px-3.5 py-1.5 text-xs"
                >
                  🔮 Chạy tới Soi {activeTarget.name}
                </button>
              ) : (
                <span className="px-2.5 py-1 font-bold text-indigo-200">
                  🔮 Chạy tới gần hoặc chạm 1 người để Soi
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
                  onClick={() =>
                    performOrWalkNightAction(witchVictim, () => {
                      sfx.play('potion');
                      onNightWitch({ heal: true, poisonTargetId: null });
                    })
                  }
                  className="ggd-btn bg-emerald-400 text-black px-2.5 py-1 text-xs"
                >
                  💚 Chạy tới Cứu {witchVictim.name}
                </button>
              )}
              {priv?.witchPoisonLeft && witchMode === 'poison' && activeTarget && activeTarget.alive ? (
                <button
                  type="button"
                  onClick={() =>
                    performOrWalkNightAction(activeTarget, () => {
                      sfx.play('potion');
                      onNightWitch({ heal: false, poisonTargetId: activeTarget.id });
                      setWitchMode('idle');
                    })
                  }
                  className="ggd-btn bg-purple-600 text-white px-3 py-1 text-xs"
                >
                  ☠️ Chạy tới Đầu Độc {activeTarget.name}
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

          {/* Dead Ghost / Sleeping Villager Night Pill */}
          {isNight && !isMySoloNightTurn && (!isWolfRole(myRole) || !me?.alive) && (
            <div className="ggd-card px-3 py-1 text-[11px] font-bold text-amber-100/90">
              {!me?.alive || me?.isSpectator
                ? '👻 Hồn Ma (Cõi Âm) — Bay tự do & xem trọn cảnh Sói đi săn ban đêm!'
                : '😴 Bạn đang ngủ say tại chỗ (khóa di chuyển tới sáng)...'}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE / MULTI-TOUCH VIRTUAL JOYSTICK + CUSTOMIZABLE JUMP / PUNCH / KICK */}
      {canMoveNow && showTouchJoystick && !touchEditorOpen && (
        <VirtualJoystick
          enabled={true}
          canMelee={canMeleeNow}
          cooldowns={controller.cooldowns}
          hudConfig={touchHudConfig}
          onMove={controller.setJoystick}
          onJump={controller.triggerJump}
          onMelee={controller.triggerMelee}
        />
      )}

      {/* AMONG US EMERGENCY VOTE MODAL */}
      <AmongUsVoteModal
        open={voteModalOpen}
        room={room}
        me={me}
        secondsLeft={secondsLeft}
        speakingPeers={speakingPeers}
        onVote={(targetId) => onDayVote(targetId)}
        onClose={() => setVoteModalOpen(false)}
      />

      {/* ESC PAUSE & CONTROLLER SETTINGS MODAL */}
      <PauseMenuModal
        open={pauseOpen}
        settings={controller.settings}
        onChangeSettings={controller.setSettings}
        onOpenTouchEditor={() => setTouchEditorOpen(true)}
        onOpenAudioMixer={onOpenAudioMixer}
        onLeaveRoom={onLeaveRoom}
        onClose={() => setPauseOpen(false)}
      />

      {/* TOUCH CONTROLS DRAG-AND-DROP CUSTOMIZER MODAL */}
      <TouchHudEditorModal
        open={touchEditorOpen}
        config={touchHudConfig}
        onSave={(cfg) => setTouchHudConfig(saveTouchHudConfig(cfg))}
        onClose={() => setTouchEditorOpen(false)}
      />
    </div>
  );
}
