import React, { useRef, useState } from 'react';
import { ArrowLeftRight, Check, Move, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_TOUCH_HUD_CONFIG,
  mirrorTouchHudPositions,
  normalizeTouchHudConfig,
} from '../utils/touchHudConfig.js';

const DRAG_ITEMS = [
  { id: 'joystick', label: 'Joystick', icon: '🕹️', sizePx: 96, color: 'border-sky-400 bg-sky-950/75 text-sky-100' },
  { id: 'jump', label: 'NHẢY', icon: '⬆️', sizePx: 62, color: 'border-blue-300 bg-blue-600/85 text-white' },
  { id: 'punch', label: 'ĐẤM', icon: '👊', sizePx: 54, color: 'border-amber-200 bg-amber-500/85 text-black' },
  { id: 'kick', label: 'ĐÁ', icon: '🦵', sizePx: 54, color: 'border-orange-200 bg-red-600/85 text-white' },
];

export default function TouchHudEditorModal({ open, config, onSave, onClose }) {
  const [draft, setDraft] = useState(() => normalizeTouchHudConfig(config));
  const [draggingId, setDraggingId] = useState(null);
  const dragStateRef = useRef(null);

  if (!open) return null;

  const updatePosFromPointer = (id, clientX, clientY) => {
    const w = window.innerWidth || 390;
    const h = window.innerHeight || 844;
    const xPct = Math.max(7, Math.min(93, (clientX / w) * 100));
    const yPct = Math.max(16, Math.min(90, (clientY / h) * 100));
    setDraft((prev) =>
      normalizeTouchHudConfig({
        ...prev,
        positions: {
          ...prev.positions,
          [id]: { xPct, yPct },
        },
      })
    );
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerMove={(e) => {
        const ds = dragStateRef.current;
        if (!ds || ds.pointerId !== e.pointerId) return;
        e.preventDefault();
        updatePosFromPointer(ds.id, e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (dragStateRef.current?.pointerId === e.pointerId) {
          dragStateRef.current = null;
          setDraggingId(null);
        }
      }}
      onPointerCancel={() => {
        dragStateRef.current = null;
        setDraggingId(null);
      }}
      className="fixed inset-0 z-[360] bg-black/68 backdrop-blur-[2px] select-none touch-none"
    >
      {/* Half-screen guide shading for Floating Joystick */}
      {draft.joystickMode === 'floating' && (
        <div
          className={`pointer-events-none absolute top-14 bottom-14 w-1/2 border-2 border-dashed border-sky-400/50 bg-sky-500/10 flex items-center justify-center ${
            draft.leftHanded ? 'right-0' : 'left-0'
          }`}
        >
          <span className="rounded-xl bg-black/75 border border-sky-400/60 px-3 py-1.5 text-[11px] font-bold text-sky-200 text-center max-w-[180px]">
            👆 Vùng Joystick nổi tự do (chạm bất cứ đâu bên {draft.leftHanded ? 'phải' : 'trái'})
          </span>
        </div>
      )}

      {/* Top Settings Drawer */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[94vw] max-w-md ggd-card p-3 flex flex-col gap-2.5 text-xs shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5 font-brand text-amber-300 text-sm">
            <Move className="w-4 h-4" />
            <span>KÉO-THẢ VỊ TRÍ NÚT CẢM ỨNG</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-rose-600 border border-black text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft((p) => ({
                ...p,
                joystickMode: p.joystickMode === 'floating' ? 'fixed' : 'floating',
              }))
            }
            className={`ggd-btn px-2 py-1.5 text-[11px] ${
              draft.joystickMode === 'floating' ? 'bg-sky-400 text-black' : 'bg-[#2a211f] text-slate-200'
            }`}
          >
            {draft.joystickMode === 'floating' ? '✨ Joystick Nổi Tự Do' : '📌 Joystick Cố Định'}
          </button>

          <button
            type="button"
            onClick={() => setDraft((p) => mirrorTouchHudPositions(p))}
            className="ggd-btn bg-[#2a211f] text-amber-200 px-2 py-1.5 text-[11px]"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>{draft.leftHanded ? 'Thuận tay Trái' : 'Thuận tay Phải'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-bold">
              <span>Cỡ nút</span>
              <span className="text-amber-300">{Math.round(draft.buttonScale * 100)}%</span>
            </span>
            <input
              type="range"
              min="0.75"
              max="1.35"
              step="0.05"
              value={draft.buttonScale}
              onChange={(e) => setDraft((p) => ({ ...p, buttonScale: Number(e.target.value) }))}
              className="w-full accent-amber-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-bold">
              <span>Độ rõ</span>
              <span className="text-sky-300">{Math.round(draft.opacity * 100)}%</span>
            </span>
            <input
              type="range"
              min="0.35"
              max="1.0"
              step="0.05"
              value={draft.opacity}
              onChange={(e) => setDraft((p) => ({ ...p, opacity: Number(e.target.value) }))}
              className="w-full accent-sky-400"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_TOUCH_HUD_CONFIG)}
            className="ggd-btn bg-[#2c2220] text-slate-200 px-2.5 py-1.5 text-[11px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>
          <span className="text-[10px] text-slate-300 text-center">Kéo thẳng các nút bên dưới 👇</span>
          <button
            type="button"
            onClick={() => {
              onSave?.(draft);
              onClose?.();
            }}
            className="ggd-btn bg-emerald-400 text-black px-3 py-1.5 text-xs font-black"
          >
            <Check className="w-4 h-4" />
            <span>Lưu Bố Cục</span>
          </button>
        </div>
      </div>

      {/* Draggable Live Control Handles */}
      {DRAG_ITEMS.map((item) => {
        const pos = draft.positions[item.id];
        const isDragging = draggingId === item.id;
        return (
          <div
            key={item.id}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragStateRef.current = { id: item.id, pointerId: e.pointerId };
              setDraggingId(item.id);
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            style={{
              left: `${pos.xPct}%`,
              top: `${pos.yPct}%`,
              width: item.sizePx,
              height: item.sizePx,
              opacity: draft.opacity,
              transform: `translate(-50%, -50%) scale(${draft.buttonScale})`,
            }}
            className={`absolute rounded-full border-3 shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow ${
              item.color
            } ${isDragging ? 'ring-4 ring-white z-30' : 'z-10'}`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[9.5px] font-black leading-none mt-0.5">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
