import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TOUCH_HUD_CONFIG } from '../utils/touchHudConfig.js';

export default function VirtualJoystick({
  enabled = true,
  canMelee = true,
  cooldowns = { punchPct: 0, kickPct: 0 },
  hudConfig = DEFAULT_TOUCH_HUD_CONFIG,
  onMove,
  onJump,
  onMelee,
}) {
  const fixedStickRef = useRef(null);
  const activePointerRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0, moved: false });
  const [stickUi, setStickUi] = useState({
    active: false,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    intensity: 0,
  });

  const MAX_RADIUS = Math.round(44 * (hudConfig.buttonScale || 1));
  const isFloating = hudConfig.joystickMode !== 'fixed';
  const leftHanded = Boolean(hudConfig.leftHanded);
  const scale = hudConfig.buttonScale || 1;
  const opacity = hudConfig.opacity ?? 0.92;
  const positions = hudConfig.positions || DEFAULT_TOUCH_HUD_CONFIG.positions;

  const resetStick = useCallback(() => {
    activePointerRef.current = null;
    originRef.current = { x: 0, y: 0, moved: false };
    setStickUi({ active: false, originX: 0, originY: 0, knobX: 0, knobY: 0, intensity: 0 });
    onMove?.(0, 0, 0);
  }, [onMove]);

  useEffect(() => {
    if (!enabled) {
      resetStick();
      return;
    }
    const handleGlobalUp = (e) => {
      if (activePointerRef.current !== null && e.pointerId === activePointerRef.current) {
        resetStick();
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    window.addEventListener('blur', resetStick);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      window.removeEventListener('blur', resetStick);
    };
  }, [enabled, resetStick]);

  if (!enabled) return null;

  const updateVectorFromOrigin = (clientX, clientY, ox, oy) => {
    const dx = clientX - ox;
    const dy = clientY - oy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(MAX_RADIUS, dist);
    const nx = dist > 1 ? dx / dist : 0;
    const ny = dist > 1 ? dy / dist : 0;
    const kx = nx * clamped;
    const ky = ny * clamped;
    const intensity = Math.min(1, dist / Math.max(16, MAX_RADIUS));
    setStickUi({ active: true, originX: ox, originY: oy, knobX: kx, knobY: ky, intensity });
    onMove?.(nx, ny, intensity);
  };

  // Handle full left-half (or right-half if left-handed) floating joystick zone
  const handleZonePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    // Allow tapping seats/players underneath only if it stays a tap (< 8px)
    e.stopPropagation();
    activePointerRef.current = e.pointerId;
    originRef.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setStickUi({
      active: true,
      originX: e.clientX,
      originY: e.clientY,
      knobX: 0,
      knobY: 0,
      intensity: 0,
    });
  };

  const handleZonePointerMove = (e) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    const { x: ox, y: oy } = originRef.current;
    if (!originRef.current.moved && Math.hypot(e.clientX - ox, e.clientY - oy) > 6) {
      originRef.current.moved = true;
    }
    updateVectorFromOrigin(e.clientX, e.clientY, ox, oy);
  };

  const handleZonePointerUp = (e) => {
    if (activePointerRef.current !== e.pointerId) return;
    const wasTap = !originRef.current.moved && Math.hypot(e.clientX - originRef.current.x, e.clientY - originRef.current.y) <= 8;
    const tapX = e.clientX;
    const tapY = e.clientY;
    resetStick();

    // Forward short tap to any actor seat underneath the transparent touch zone!
    if (wasTap && typeof document !== 'undefined') {
      const zoneEl = e.currentTarget;
      const prevPe = zoneEl.style.pointerEvents;
      zoneEl.style.pointerEvents = 'none';
      const targetUnder = document.elementFromPoint(tapX, tapY);
      zoneEl.style.pointerEvents = prevPe;
      const seat = targetUnder?.closest?.('[data-seat-click="true"]');
      if (seat) {
        seat.click();
      }
    }
  };

  const isRunning = stickUi.intensity > 0.78;
  const joyStyleBase = {
    width: 112,
    height: 112,
  };

  const renderJoystickVisual = (centerStyle, ghostOpacity = 1) => (
    <div
      style={{ ...joyStyleBase, ...centerStyle, opacity: ghostOpacity }}
      className={`pointer-events-none relative rounded-full border-3 backdrop-blur-xs transition-colors flex items-center justify-center ${
        isRunning
          ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.48)]'
          : stickUi.active
            ? 'bg-slate-900/65 border-sky-400/85'
            : 'bg-black/30 border-white/25'
      }`}
    >
      <div className="pointer-events-none absolute w-[78%] h-[78%] rounded-full border border-dashed border-white/20" />
      <div
        style={{ transform: `translate3d(${stickUi.knobX / scale}px, ${stickUi.knobY / scale}px, 0)` }}
        className={`w-12 h-12 rounded-full border-2 border-[#140f0e] shadow-xl flex items-center justify-center font-black text-[10px] ${
          isRunning
            ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-black'
            : 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-900'
        }`}
      >
        {isRunning ? 'CHẠY' : stickUi.active ? 'ĐI' : '🕹️'}
      </div>
    </div>
  );

  return (
    <>
      {/* LEFT (or RIGHT if leftHanded) VIRTUAL ANALOG JOYSTICK — kept at z-[32] below HUD bars (z-40..105) */}
      <div className="pointer-events-none fixed inset-0 z-[32] select-none">
        {isFloating ? (
          <>
            <div
              onPointerDown={handleZonePointerDown}
              onPointerMove={handleZonePointerMove}
              onPointerUp={handleZonePointerUp}
              onPointerCancel={(e) => {
                if (activePointerRef.current === e.pointerId) resetStick();
              }}
              onLostPointerCapture={(e) => {
                if (activePointerRef.current === e.pointerId) resetStick();
              }}
              className={`pointer-events-auto absolute top-24 bottom-16 w-[48vw] touch-none ${
                leftHanded ? 'right-0' : 'left-0'
              }`}
            />
            {!stickUi.active ? (
              renderJoystickVisual(
                {
                  position: 'fixed',
                  left: `${positions.joystick.xPct}%`,
                  top: `${positions.joystick.yPct}%`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                },
                Math.min(0.42, opacity * 0.48)
              )
            ) : (
              renderJoystickVisual(
                {
                  position: 'fixed',
                  left: `${stickUi.originX}px`,
                  top: `${stickUi.originY}px`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                },
                opacity
              )
            )}
          </>
        ) : (
          <div
            ref={fixedStickRef}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const ox = rect.left + rect.width / 2;
              const oy = rect.top + rect.height / 2;
              activePointerRef.current = e.pointerId;
              originRef.current = { x: ox, y: oy, moved: true };
              e.currentTarget.setPointerCapture?.(e.pointerId);
              updateVectorFromOrigin(e.clientX, e.clientY, ox, oy);
            }}
            onPointerMove={(e) => {
              if (activePointerRef.current !== e.pointerId) return;
              e.preventDefault();
              updateVectorFromOrigin(e.clientX, e.clientY, originRef.current.x, originRef.current.y);
            }}
            onPointerUp={(e) => {
              if (activePointerRef.current === e.pointerId) resetStick();
            }}
            onPointerCancel={(e) => {
              if (activePointerRef.current === e.pointerId) resetStick();
            }}
            onLostPointerCapture={(e) => {
              if (activePointerRef.current === e.pointerId) resetStick();
            }}
            style={{
              left: `${positions.joystick.xPct}%`,
              top: `${positions.joystick.yPct}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity,
            }}
            className="pointer-events-auto fixed touch-none"
          >
            {renderJoystickVisual({ position: 'relative' }, 1)}
          </div>
        )}
      </div>

      {/* INDEPENDENTLY CUSTOMIZABLE ACTION BUTTONS (MULTI-TOUCH, z-[95] below modals & SKIP) */}
      <div className="pointer-events-none fixed inset-0 z-[95] select-none">
        {canMelee && (
          <>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMelee?.('kick');
              }}
              style={{
                left: `${positions.kick.xPct}%`,
                top: `${positions.kick.yPct}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity,
              }}
              className="pointer-events-auto fixed w-13 h-13 rounded-full bg-gradient-to-b from-orange-400 to-red-600 border-3 border-[#140f0e] shadow-lg flex flex-col items-center justify-center active:scale-90 transition-transform overflow-hidden touch-none"
              title="Đá văng (K)"
            >
              {cooldowns.kickPct > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/65 pointer-events-none"
                  style={{ height: `${Math.round(cooldowns.kickPct * 100)}%` }}
                />
              )}
              <span className="relative z-10 text-lg leading-none">🦵</span>
              <span className="relative z-10 text-[9px] font-black text-white leading-none">ĐÁ</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMelee?.('punch');
              }}
              style={{
                left: `${positions.punch.xPct}%`,
                top: `${positions.punch.yPct}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity,
              }}
              className="pointer-events-auto fixed w-13 h-13 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-3 border-[#140f0e] shadow-lg flex flex-col items-center justify-center active:scale-90 transition-transform overflow-hidden touch-none"
              title="Đấm móc (J)"
            >
              {cooldowns.punchPct > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-black/65 pointer-events-none"
                  style={{ height: `${Math.round(cooldowns.punchPct * 100)}%` }}
                />
              )}
              <span className="relative z-10 text-lg leading-none">👊</span>
              <span className="relative z-10 text-[9px] font-black text-black leading-none">ĐẤM</span>
            </button>
          </>
        )}

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onJump?.();
          }}
          style={{
            left: `${positions.jump.xPct}%`,
            top: `${positions.jump.yPct}%`,
            transform: `translate(-50%, -50%) scale(${scale})`,
            opacity,
          }}
          className="pointer-events-auto fixed w-16 h-16 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 border-3 border-[#140f0e] shadow-xl flex flex-col items-center justify-center active:scale-90 transition-transform touch-none"
          title="Nhảy (Space)"
        >
          <span className="text-xl leading-none">⬆️</span>
          <span className="text-[10px] font-black text-white leading-none mt-0.5">NHẢY</span>
        </button>
      </div>
    </>
  );
}
