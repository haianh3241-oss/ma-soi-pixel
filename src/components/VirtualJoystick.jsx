import React, { useCallback, useEffect, useRef, useState } from 'react';

export default function VirtualJoystick({
  enabled = true,
  canMelee = true,
  cooldowns = { punchPct: 0, kickPct: 0 },
  onMove,
  onJump,
  onMelee,
}) {
  const stickRef = useRef(null);
  const activePointerRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, intensity: 0, active: false });

  const MAX_RADIUS = 44;

  const resetStick = useCallback(() => {
    activePointerRef.current = null;
    setKnob({ x: 0, y: 0, intensity: 0, active: false });
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

  const updateStickFromEvent = (e) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(MAX_RADIUS, dist);
    const nx = dist > 1 ? dx / dist : 0;
    const ny = dist > 1 ? dy / dist : 0;
    const kx = nx * clamped;
    const ky = ny * clamped;
    const intensity = Math.min(1, dist / MAX_RADIUS);
    setKnob({ x: kx, y: ky, intensity, active: true });
    onMove?.(nx, ny, intensity);
  };

  const isRunning = knob.intensity > 0.78;

  return (
    <div className="pointer-events-none fixed inset-0 z-[135] select-none">
      {/* LEFT VIRTUAL 8-WAY ANALOG JOYSTICK */}
      <div className="pointer-events-auto absolute bottom-14 left-4 sm:bottom-16 sm:left-6 flex flex-col items-center gap-1 touch-none">
        <div
          ref={stickRef}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            activePointerRef.current = e.pointerId;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            updateStickFromEvent(e);
          }}
          onPointerMove={(e) => {
            if (activePointerRef.current !== e.pointerId) return;
            e.preventDefault();
            updateStickFromEvent(e);
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
          className={`relative w-28 h-28 rounded-full border-3 backdrop-blur-xs transition-colors flex items-center justify-center ${
            isRunning
              ? 'bg-amber-950/55 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
              : knob.active
                ? 'bg-slate-900/60 border-sky-400/80'
                : 'bg-black/40 border-white/25'
          }`}
        >
          {/* Run threshold guide ring */}
          <div className="pointer-events-none absolute w-[78%] h-[78%] rounded-full border border-dashed border-white/20" />
          {/* Movable thumbstick */}
          <div
            style={{ transform: `translate3d(${knob.x}px, ${knob.y}px, 0)` }}
            className={`w-12 h-12 rounded-full border-2 border-[#140f0e] shadow-xl flex items-center justify-center font-black text-[10px] ${
              isRunning
                ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-black'
                : 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-900'
            }`}
          >
            {isRunning ? 'CHẠY' : knob.active ? 'ĐI' : '🕹️'}
          </div>
        </div>
      </div>

      {/* RIGHT SOUL KNIGHT ACTION CLUSTER (MULTI-TOUCH) */}
      <div className="pointer-events-auto absolute bottom-14 right-4 sm:bottom-16 sm:right-6 w-36 h-36 touch-none">
        {canMelee && (
          <>
            {/* Kick Button (Top-Left of cluster) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMelee?.('kick');
              }}
              className="absolute top-0 left-2 w-13 h-13 rounded-full bg-gradient-to-b from-orange-400 to-red-600 border-3 border-[#140f0e] shadow-lg flex flex-col items-center justify-center active:scale-90 transition-transform overflow-hidden"
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

            {/* Punch Button (Bottom-Left of cluster) */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMelee?.('punch');
              }}
              className="absolute bottom-2 left-0 w-13 h-13 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-3 border-[#140f0e] shadow-lg flex flex-col items-center justify-center active:scale-90 transition-transform overflow-hidden"
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

        {/* Primary Big Jump Button (Bottom-Right) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onJump?.();
          }}
          className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-gradient-to-b from-sky-400 to-blue-600 border-3 border-[#140f0e] shadow-xl flex flex-col items-center justify-center active:scale-90 transition-transform"
          title="Nhảy (Space)"
        >
          <span className="text-xl leading-none">⬆️</span>
          <span className="text-[10px] font-black text-white leading-none mt-0.5">NHẢY</span>
        </button>
      </div>
    </div>
  );
}
