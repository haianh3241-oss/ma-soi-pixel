import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_MOVEMENT_CONFIG, WORLD_HEIGHT, WORLD_WIDTH } from '../engine/movementConfig.js';
import {
  DOWN_CODES,
  LEFT_CODES,
  RIGHT_CODES,
  UP_CODES,
  normalizeInputVector,
  resolveDirectionalAxes,
  stepActorPhysics,
  stepJumpPhysics,
} from '../engine/physics2d.js';
import { sfx } from '../audio/sfx.js';

const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight']);

function isTypingInInput(target = document.activeElement) {
  const el = target;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

export function usePlayerController({
  socket,
  room,
  me,
  canMove = true,
  canMelee = true,
  isWolfForm = false,
  isGhostForm = false,
  isUiBlocked = false,
  actorNodeMapRef,
  cameraRef,
  stageTransformRef,
  onActorAnimChange,
  onDustBurst,
  onSlashVfx,
  onTogglePause,
}) {
  const [settings, setSettings] = useState({
    speedMultiplier: 1.0,
    knockbackMultiplier: 1.0,
    clickToMove: false,
    showColliders: false,
    touchMode: 'auto', // 'auto' | 'always' | 'off'
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [cooldowns, setCooldowns] = useState({ punchPct: 0, kickPct: 0 });

  // Imperative 60 FPS actor states
  const actorsRef = useRef(new Map());
  const horizStackRef = useRef([]);
  const vertStackRef = useRef([]);
  const shiftCodesRef = useRef(new Set());
  const joyRef = useRef({ x: 0, y: 0, intensity: 0 });
  const waypointRef = useRef(null);
  const lookVecRef = useRef({ dx: 1, dy: 0 });
  const meleeCdRef = useRef({ punchUntil: 0, kickUntil: 0 });
  const animCacheRef = useRef(new Map());
  const lastNetPacketRef = useRef({ x: -1, y: -1, z: -1, facing: 1, anim: '', at: 0 });

  const myId = me?.id || null;
  const phaseKey = `${room?.phase}-${room?.nightStage}-${room?.dayCount}`;

  const clearAllInputs = useCallback(() => {
    horizStackRef.current = [];
    vertStackRef.current = [];
    shiftCodesRef.current.clear();
    joyRef.current = { x: 0, y: 0, intensity: 0 };
    waypointRef.current = null;
  }, []);

  // Automatically clear stuck keys when UI blocks input or movement locks
  useEffect(() => {
    if (!canMove || isUiBlocked) {
      clearAllInputs();
    }
  }, [canMove, isUiBlocked, phaseKey, clearAllInputs]);

  // Sync authoritative snapshots from room.players into imperative actorsRef
  useEffect(() => {
    if (!room?.players) return;
    const now = performance.now();
    const activeIds = new Set();

    for (const p of room.players) {
      if (p.isSpectator) continue;
      activeIds.add(p.id);
      const existing = actorsRef.current.get(p.id);
      if (!existing) {
        actorsRef.current.set(p.id, {
          id: p.id,
          x: p.x ?? 800,
          y: p.y ?? 650,
          z: p.z ?? 0,
          vz: 0,
          kx: 0,
          ky: 0,
          facing: p.facing ?? 1,
          anim: p.anim || 'idle',
          targetX: p.x ?? 800,
          targetY: p.y ?? 650,
          targetZ: p.z ?? 0,
          hitUntil: 0,
          attackUntil: 0,
          attackType: 'punch',
          wolfTransformed: Boolean(p.wolfTransformed),
          alive: p.alive,
        });
      } else {
        existing.alive = p.alive;
        existing.wolfTransformed = Boolean(p.wolfTransformed);
        if (p.id !== myId || !canMove) {
          existing.targetX = p.x ?? existing.x;
          existing.targetY = p.y ?? existing.y;
          existing.targetZ = p.z ?? 0;
          // Teleport snap if large phase jump (e.g. Dawn return to sleepOrigin or Trial formation)
          if (Math.hypot(existing.targetX - existing.x, existing.targetY - existing.y) > 250 || (!canMove && p.id === myId)) {
            existing.x = existing.targetX;
            existing.y = existing.targetY;
            existing.z = existing.targetZ;
            existing.kx = 0;
            existing.ky = 0;
          }
          if (typeof p.facing === 'number') existing.facing = p.facing;
          if (p.anim && now >= existing.attackUntil && now >= existing.hitUntil) {
            existing.anim = p.anim;
          }
        }
      }
    }

    for (const id of actorsRef.current.keys()) {
      if (!activeIds.has(id)) actorsRef.current.delete(id);
    }
  }, [room?.players, myId, canMove]);

  useEffect(() => {
    if (!me || !actorsRef.current.has(me.id)) return;
    const local = actorsRef.current.get(me.id);
    local.x = me.x ?? local.x;
    local.y = me.y ?? local.y;
    local.z = me.z ?? 0;
    local.kx = 0;
    local.ky = 0;
    local.targetX = local.x;
    local.targetY = local.y;
  }, [room?.phase, room?.nightStage, me?.id]);

  // Remote movement & melee socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleMoved = (pkt) => {
      if (!pkt || pkt.id === myId) return;
      const actor = actorsRef.current.get(pkt.id);
      if (!actor) return;
      // Teleport snap if packet jump is large (prevents flying across map walls)
      if (Math.hypot((pkt.x ?? 0) - actor.x, (pkt.y ?? 0) - actor.y) > 280) {
        actor.x = pkt.x;
        actor.y = pkt.y;
      }
      actor.targetX = pkt.x;
      actor.targetY = pkt.y;
      actor.targetZ = pkt.z || 0;
      actor.facing = pkt.facing ?? actor.facing;
      actor.wolfTransformed = Boolean(pkt.wolfTransformed);
      const now = performance.now();
      if (now >= actor.attackUntil && now >= actor.hitUntil) {
        actor.anim = pkt.anim || 'idle';
      }
    };

    const handleMeleeHit = (pkt) => {
      if (!pkt) return;
      const now = performance.now();
      const attacker = actorsRef.current.get(pkt.attackerId);
      const isKick = pkt.type === 'kick';

      if (attacker) {
        attacker.attackUntil = now + (isKick ? DEFAULT_MOVEMENT_CONFIG.kickDurationMs : DEFAULT_MOVEMENT_CONFIG.punchDurationMs);
        attacker.attackType = pkt.type;
        attacker.facing = (pkt.dirX ?? attacker.facing) >= 0 ? 1 : -1;
        onSlashVfx?.({
          id: pkt.id,
          actorId: pkt.attackerId,
          x: attacker.x,
          y: attacker.y,
          dirX: pkt.dirX ?? attacker.facing,
          dirY: pkt.dirY ?? 0,
          type: pkt.type,
        });
      }

      if (pkt.attackerId !== myId) {
        sfx.play(isKick ? 'kick' : 'punch');
      }

      const kbMult = settingsRef.current.knockbackMultiplier;
      for (const hit of pkt.hits || []) {
        const victim = actorsRef.current.get(hit.targetId);
        if (!victim) continue;
        victim.kx = (hit.kx || 0) * kbMult;
        victim.ky = (hit.ky || 0) * kbMult;
        if (hit.vz && victim.z <= 2) {
          victim.vz = hit.vz;
        }
        victim.hitUntil = now + (isKick ? DEFAULT_MOVEMENT_CONFIG.kickHitstunMs : 220);
        if (hit.targetId === myId && !canMove) {
          victim.kx = 0;
          victim.ky = 0;
        }
      }
    };

    socket.on('player:moved', handleMoved);
    socket.on('player:meleeHit', handleMeleeHit);
    return () => {
      socket.off('player:moved', handleMoved);
      socket.off('player:meleeHit', handleMeleeHit);
    };
  }, [socket, myId, canMove, onSlashVfx]);

  const triggerJump = useCallback(() => {
    if (!myId || !canMove || isUiBlocked) return;
    const hero = actorsRef.current.get(myId);
    if (!hero || hero.z > 2) return;
    hero.vz = DEFAULT_MOVEMENT_CONFIG.jumpVelocity;
    sfx.play('jump');
    onDustBurst?.({ x: hero.x, y: hero.y, count: 4 });
  }, [myId, canMove, isUiBlocked, onDustBurst]);

  const triggerMelee = useCallback(
    (type = 'punch') => {
      if (!myId || !canMove || !canMelee || isUiBlocked) return;
      const hero = actorsRef.current.get(myId);
      if (!hero) return;

      const now = performance.now();
      const isKick = type === 'kick';
      if (isKick && now < meleeCdRef.current.kickUntil) return;
      if (!isKick && now < meleeCdRef.current.punchUntil) return;

      const cdMs = isKick ? DEFAULT_MOVEMENT_CONFIG.kickCooldownMs : DEFAULT_MOVEMENT_CONFIG.punchCooldownMs;
      if (isKick) meleeCdRef.current.kickUntil = now + cdMs;
      else meleeCdRef.current.punchUntil = now + cdMs;

      hero.attackUntil = now + (isKick ? DEFAULT_MOVEMENT_CONFIG.kickDurationMs : DEFAULT_MOVEMENT_CONFIG.punchDurationMs);
      hero.attackType = type;

      const axes = resolveDirectionalAxes(horizStackRef.current, vertStackRef.current);
      const inputDir = normalizeInputVector(axes.ix + joyRef.current.x, axes.iy + joyRef.current.y);

      let dirX = hero.facing;
      let dirY = 0;
      if (inputDir.magnitude > 0.1) {
        dirX = inputDir.x;
        dirY = inputDir.y;
      } else if (Math.hypot(lookVecRef.current.dx, lookVecRef.current.dy) > 12) {
        const ln = normalizeInputVector(lookVecRef.current.dx, lookVecRef.current.dy);
        dirX = ln.x;
        dirY = ln.y;
      }
      hero.facing = dirX >= 0 ? 1 : -1;

      sfx.play(isKick ? 'kick' : 'punch');
      if (socket?.connected) {
        socket.emit('player:melee', { type, dirX, dirY });
      }
    },
    [myId, canMove, canMelee, isUiBlocked, socket]
  );

  const setWaypoint = useCallback((wx, wy, opts = null) => {
    if (typeof opts === 'function') {
      waypointRef.current = { x: wx, y: wy, onArrive: opts };
    } else if (opts && typeof opts === 'object') {
      waypointRef.current = { x: wx, y: wy, ...opts };
    } else {
      waypointRef.current = { x: wx, y: wy, onArrive: null };
    }
  }, []);

  const setJoystick = useCallback((x, y, intensity) => {
    joyRef.current = { x, y, intensity };
    if (intensity > 0.1) {
      waypointRef.current = null;
    }
  }, []);

  const handleArenaPointerMove = useCallback((e) => {
    if (!myId || !stageTransformRef?.current) return;
    const hero = actorsRef.current.get(myId);
    if (!hero) return;
    const { scale, camX, camY, rectLeft, rectTop } = stageTransformRef.current;
    const wx = (e.clientX - rectLeft) / scale + camX;
    const wy = (e.clientY - rectTop) / scale + camY;
    lookVecRef.current = { dx: wx - hero.x, dy: wy - hero.y };
  }, [myId, stageTransformRef]);

  // Hardware e.code keyboard bindings (100% immune to Unikey/EVKey Telex stuck keys!)
  useEffect(() => {
    const pushUnique = (stack, code) => {
      const idx = stack.indexOf(code);
      if (idx !== -1) stack.splice(idx, 1);
      stack.push(code);
    };
    const removeCode = (stack, code) => {
      const idx = stack.indexOf(code);
      if (idx !== -1) stack.splice(idx, 1);
    };

    const onKeyDown = (e) => {
      const code = e.code;
      if (code === 'Escape') {
        e.preventDefault();
        clearAllInputs();
        onTogglePause?.();
        return;
      }
      if (isUiBlocked || isTypingInInput(e.target)) {
        clearAllInputs();
        return;
      }

      if (LEFT_CODES.has(code) || RIGHT_CODES.has(code)) {
        if (code.startsWith('Arrow')) e.preventDefault();
        pushUnique(horizStackRef.current, code);
        waypointRef.current = null;
      } else if (UP_CODES.has(code) || DOWN_CODES.has(code)) {
        if (code.startsWith('Arrow')) e.preventDefault();
        pushUnique(vertStackRef.current, code);
        waypointRef.current = null;
      } else if (SHIFT_CODES.has(code)) {
        shiftCodesRef.current.add(code);
      } else if (code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerJump();
      } else if ((code === 'KeyJ' || code === 'KeyF') && !e.repeat) {
        e.preventDefault();
        triggerMelee('punch');
      } else if ((code === 'KeyK' || code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        triggerMelee('kick');
      }
    };

    const onKeyUp = (e) => {
      const code = e.code;
      removeCode(horizStackRef.current, code);
      removeCode(vertStackRef.current, code);
      shiftCodesRef.current.delete(code);
      // Fallback cleanup in case keyup came from a weird IME state
      if (!e.shiftKey) shiftCodesRef.current.clear();
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') clearAllInputs();
    };
    const onFocusIn = (e) => {
      if (isTypingInInput(e.target)) clearAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllInputs);
    window.addEventListener('pagehide', clearAllInputs);
    window.addEventListener('contextmenu', clearAllInputs);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      window.removeEventListener('pagehide', clearAllInputs);
      window.removeEventListener('contextmenu', clearAllInputs);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [isUiBlocked, clearAllInputs, triggerJump, triggerMelee, onTogglePause]);

  // 60 FPS requestAnimationFrame Physics & Render Loop (Delta Network Sync!)
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let lastCdUpdate = 0;
    let lastDustAt = 0;
    const sendIntervalMs = 1000 / DEFAULT_MOVEMENT_CONFIG.networkSendHz;

    const frame = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const cfg = DEFAULT_MOVEMENT_CONFIG;
      const curSettings = settingsRef.current;

      if (myId && actorsRef.current.has(myId)) {
        const hero = actorsRef.current.get(myId);
        const allowMoveNow = canMove && !isUiBlocked;

        let { ix, iy } = allowMoveNow
          ? resolveDirectionalAxes(horizStackRef.current, vertStackRef.current)
          : { ix: 0, iy: 0 };
        let isRunning = allowMoveNow && shiftCodesRef.current.size > 0;

        if (allowMoveNow && joyRef.current.intensity > cfg.joystickDeadzone) {
          ix += joyRef.current.x;
          iy += joyRef.current.y;
          if (joyRef.current.intensity > cfg.joystickRunThreshold) isRunning = true;
        } else if (allowMoveNow && ix === 0 && iy === 0 && waypointRef.current) {
          const dx = waypointRef.current.x - hero.x;
          const dy = waypointRef.current.y - hero.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= (waypointRef.current.arriveRadius || 22)) {
            const cb = waypointRef.current.onArrive;
            waypointRef.current = null;
            cb?.();
          } else {
            ix = dx / dist;
            iy = dy / dist;
            isRunning = Boolean(waypointRef.current.fast);
          }
        }

        let speedMult = curSettings.speedMultiplier;
        if (isWolfForm) speedMult *= cfg.nightWolfSpeedMultiplier;
        else if (isGhostForm) speedMult *= cfg.ghostSpeedMultiplier;

        const isStunned = now < hero.hitUntil;
        const step = stepActorPhysics(
          hero,
          { ix, iy, isRunning, lookDx: lookVecRef.current.dx },
          dt,
          {
            canMove: allowMoveNow,
            isStunned,
            ignoreObstacles: isGhostForm,
            speedOverride: cfg.walkSpeed * speedMult,
          }
        );

        hero.x = step.x;
        hero.y = step.y;
        hero.z = step.z;
        hero.vz = step.vz;
        hero.kx = step.kx;
        hero.ky = step.ky;
        hero.facing = step.facing;

        if (step.justLanded) {
          onDustBurst?.({ x: hero.x, y: hero.y, count: 5 });
        } else if (step.isRunning && hero.z === 0 && !isGhostForm && now - lastDustAt > 140) {
          lastDustAt = now;
          onDustBurst?.({ x: hero.x - hero.facing * 12, y: hero.y, count: 2 });
        }

        let nextAnim = 'idle';
        if (isGhostForm) nextAnim = 'ghost';
        else if (!canMove && room?.phase === 'NIGHT' && me?.alive) nextAnim = 'sleep';
        else if (now < hero.attackUntil) nextAnim = hero.attackType;
        else if (now < hero.hitUntil) nextAnim = 'hit';
        else if (hero.z > 3) nextAnim = 'jump';
        else if (step.isRunning) nextAnim = 'run';
        else if (step.isMoving) nextAnim = 'walk';
        hero.anim = nextAnim;

        // Delta-compressed network sync: send ONLY if moved >0.5u or discrete state changed!
        const rx = Math.round(hero.x);
        const ry = Math.round(hero.y);
        const rz = Math.round(hero.z);
        const prevNet = lastNetPacketRef.current;
        const posChanged =
          Math.abs(rx - prevNet.x) >= 1 ||
          Math.abs(ry - prevNet.y) >= 1 ||
          Math.abs(rz - prevNet.z) >= 1;
        const stateChanged = prevNet.facing !== hero.facing || prevNet.anim !== hero.anim;

        if (
          socket?.connected &&
          canMove &&
          (stateChanged || (posChanged && now - prevNet.at >= sendIntervalMs))
        ) {
          lastNetPacketRef.current = { x: rx, y: ry, z: rz, facing: hero.facing, anim: hero.anim, at: now };
          socket.emit('player:move', {
            x: rx,
            y: ry,
            z: rz,
            vx: Math.round(step.vx),
            vy: Math.round(step.vy),
            facing: hero.facing,
            anim: hero.anim,
          });
        }
      }

      // Remote interpolation & 60 FPS GPU DOM writes
      for (const [id, actor] of actorsRef.current.entries()) {
        if (id !== myId) {
          const lerpAlpha = 1 - Math.exp(-15 * dt);
          actor.x += (actor.targetX - actor.x + actor.kx * dt) * lerpAlpha;
          actor.y += (actor.targetY - actor.y + actor.ky * dt) * lerpAlpha;
          actor.kx *= Math.exp(-cfg.knockbackDrag * dt);
          actor.ky *= Math.exp(-cfg.knockbackDrag * dt);
          if (Math.hypot(actor.kx, actor.ky) < 6) {
            actor.kx = 0;
            actor.ky = 0;
          }
          const jumpStep = stepJumpPhysics(actor, dt, cfg.gravity);
          actor.z = Math.max(jumpStep.z, actor.targetZ || 0);
          actor.vz = jumpStep.vz;

          if (now < actor.attackUntil) actor.anim = actor.attackType;
          else if (now < actor.hitUntil) actor.anim = 'hit';
          else if (!actor.alive) actor.anim = 'ghost';
        }

        const dom = actorNodeMapRef?.current?.get(id);
        if (dom?.root) {
          dom.root.style.transform = `translate3d(${actor.x.toFixed(1)}px, ${actor.y.toFixed(1)}px, 0) translate(-50%, -88%)`;
          dom.root.style.zIndex = String(Math.round(actor.y));

          if (dom.body) {
            const floatBob = !actor.alive ? 12 + Math.sin(now * 0.0045 + actor.x * 0.01) * 5 : 0;
            const liftY = -(actor.z + floatBob);
            dom.body.style.transform = `translate3d(0, ${liftY.toFixed(1)}px, 0) scaleX(${actor.facing})`;
          }

          if (dom.shadow) {
            const heightOffset = actor.z + (!actor.alive ? 16 : 0);
            const sScale = Math.max(0.45, 1 - heightOffset / 240);
            dom.shadow.style.transform = `translate3d(-50%, 0, 0) scale(${sScale.toFixed(2)})`;
            dom.shadow.style.opacity = !actor.alive ? '0.24' : '0.48';
          }
        }

        const cached = animCacheRef.current.get(id);
        const packed = `${actor.anim}:${actor.wolfTransformed ? 1 : 0}`;
        if (cached !== packed) {
          animCacheRef.current.set(id, packed);
          onActorAnimChange?.(id, actor.anim, actor.wolfTransformed);
        }
      }

      if (cameraRef?.current && stageTransformRef?.current) {
        const st = stageTransformRef.current;
        if (st.viewportW > 0 && st.viewportH > 0) {
          const visW = st.viewportW / st.scale;
          const visH = st.viewportH / st.scale;
          if (visW >= WORLD_WIDTH) {
            st.camX = -(visW - WORLD_WIDTH) / 2;
          } else if (myId && actorsRef.current.has(myId)) {
            const hero = actorsRef.current.get(myId);
            const maxCamX = WORLD_WIDTH - visW;
            const targetCamX = Math.max(0, Math.min(maxCamX, hero.x - visW / 2));
            st.camX += (targetCamX - st.camX) * (1 - Math.exp(-10 * dt));
          }
          if (visH >= WORLD_HEIGHT) {
            st.camY = -(visH - WORLD_HEIGHT) / 2;
          } else if (myId && actorsRef.current.has(myId)) {
            const hero = actorsRef.current.get(myId);
            const maxCamY = WORLD_HEIGHT - visH;
            const targetCamY = Math.max(0, Math.min(maxCamY, hero.y - visH / 2));
            st.camY += (targetCamY - st.camY) * (1 - Math.exp(-10 * dt));
          }
          cameraRef.current.style.transform = `scale(${st.scale}) translate3d(${-st.camX}px, ${-st.camY}px, 0)`;
        }
      }

      if (now - lastCdUpdate > 90) {
        lastCdUpdate = now;
        const pRem = Math.max(0, meleeCdRef.current.punchUntil - now);
        const kRem = Math.max(0, meleeCdRef.current.kickUntil - now);
        if (pRem > 0 || kRem > 0) {
          setCooldowns({
            punchPct: Math.min(1, pRem / cfg.punchCooldownMs),
            kickPct: Math.min(1, kRem / cfg.kickCooldownMs),
          });
        } else {
          setCooldowns((prev) => (prev.punchPct === 0 && prev.kickPct === 0 ? prev : { punchPct: 0, kickPct: 0 }));
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [myId, canMove, isUiBlocked, isWolfForm, isGhostForm, room?.phase, me?.alive, socket, actorNodeMapRef, cameraRef, stageTransformRef, onActorAnimChange, onDustBurst]);

  return {
    settings,
    setSettings,
    cooldowns,
    actorsRef,
    triggerJump,
    triggerMelee,
    setJoystick,
    setWaypoint,
    clearAllInputs,
    handleArenaPointerMove,
  };
}
