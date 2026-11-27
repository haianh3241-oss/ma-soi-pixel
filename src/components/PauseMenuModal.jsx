import React from 'react';
import { X, SlidersHorizontal, Gamepad2, LogOut, RotateCcw, Smartphone } from 'lucide-react';
import { DEFAULT_MOVEMENT_CONFIG } from '../engine/movementConfig.js';

export default function PauseMenuModal({
  open,
  settings,
  onChangeSettings,
  onOpenTouchEditor,
  onOpenAudioMixer,
  onLeaveRoom,
  onClose,
}) {
  if (!open) return null;

  const actualWalkSpeed = Math.round(DEFAULT_MOVEMENT_CONFIG.walkSpeed * settings.speedMultiplier);
  const actualRunSpeed = Math.round(actualWalkSpeed * DEFAULT_MOVEMENT_CONFIG.runMultiplier);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[320] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ggd-card w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-amber-400" />
            <h2 className="font-brand text-base text-amber-300">TẠM DỪNG & CÀI ĐẶT ĐIỀU KHIỂN (ESC)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-rose-600 border-2 border-[#140f0e] text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Movement Speed Slider */}
        <div className="px-panel-dark p-3 flex flex-col gap-2 text-xs">
          <div className="flex justify-between font-bold">
            <span>🏃 Tốc độ Di chuyển</span>
            <span className="text-amber-300">
              {settings.speedMultiplier.toFixed(2)}x ({actualWalkSpeed} / {actualRunSpeed} u/s)
            </span>
          </div>
          <input
            type="range"
            min="0.6"
            max="2.0"
            step="0.05"
            value={settings.speedMultiplier}
            onChange={(e) => onChangeSettings({ ...settings, speedMultiplier: Number(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />

          <div className="flex justify-between font-bold mt-1">
            <span>💥 Lực Đấm / Đá văng</span>
            <span className="text-orange-300">{settings.knockbackMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.knockbackMultiplier}
            onChange={(e) => onChangeSettings({ ...settings, knockbackMultiplier: Number(e.target.value) })}
            className="w-full accent-orange-400 cursor-pointer"
          />
        </div>

        {/* Toggles */}
        <div className="px-panel-dark p-3 flex flex-col gap-2.5 text-xs">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>🖱️ Click chuột xuống sân để chạy tới (Among Us)</span>
            <input
              type="checkbox"
              checked={settings.clickToMove}
              onChange={(e) => onChangeSettings({ ...settings, clickToMove: e.target.checked })}
              className="w-4 h-4 accent-amber-400"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>🧱 Hiện khung Va Chạm Debug (Collision Boxes)</span>
            <input
              type="checkbox"
              checked={settings.showColliders}
              onChange={(e) => onChangeSettings({ ...settings, showColliders: e.target.checked })}
              className="w-4 h-4 accent-cyan-400"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <span>🕹️ Joystick ảo trên màn hình</span>
            <select
              value={settings.touchMode}
              onChange={(e) => onChangeSettings({ ...settings, touchMode: e.target.value })}
              className="px-input py-1 px-2 text-xs"
            >
              <option value="auto">Tự động (Mobile)</option>
              <option value="always">Luôn hiện (Test PC)</option>
              <option value="off">Ẩn</option>
            </select>
          </div>

          {onOpenTouchEditor && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTouchEditor();
              }}
              className="ggd-btn bg-sky-500/20 border-sky-400 text-sky-200 px-3 py-2 text-xs w-full mt-1"
            >
              <Smartphone className="w-4 h-4" />
              <span>Tùy Chỉnh Vị Trí, Cỡ & Độ Rõ Nút Cảm Ứng</span>
            </button>
          )}
        </div>

        {/* Controls Reference Table */}
        <div className="px-panel-dark p-2.5 text-[11px] flex flex-col gap-1">
          <div className="font-bold text-amber-300 mb-0.5">⌨️ Bảng Phím Điều Khiển Mặc Định:</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-200">
            <div><b className="text-amber-200">W A S D / Mũi tên</b>: Chạy 8 hướng</div>
            <div><b className="text-amber-200">Giữ Shift</b>: Chạy nhanh tung bụi</div>
            <div><b className="text-amber-200">Space</b>: Nhảy lên không</div>
            <div><b className="text-amber-200">J / F</b>: Đấm đẩy lùi</div>
            <div><b className="text-amber-200">K / E</b>: Đá hất văng choáng</div>
            <div><b className="text-amber-200">Chuột / ESC</b>: Ngắm / Tạm dừng</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 justify-between pt-1">
          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                speedMultiplier: 1.0,
                knockbackMultiplier: 1.0,
                clickToMove: false,
                showColliders: false,
                touchMode: 'auto',
              })
            }
            className="ggd-btn bg-[#2d2422] text-slate-200 px-3 py-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mặc định</span>
          </button>

          <div className="flex gap-2">
            {onOpenAudioMixer && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAudioMixer();
                }}
                className="ggd-btn bg-sky-500 text-black px-3 py-1.5 text-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Âm thanh</span>
              </button>
            )}
            {onLeaveRoom && (
              <button
                type="button"
                onClick={onLeaveRoom}
                className="ggd-btn bg-rose-600 text-white px-3 py-1.5 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Rời phòng</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
