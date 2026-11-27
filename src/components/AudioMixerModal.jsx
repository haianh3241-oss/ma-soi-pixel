import React, { useState } from 'react';
import { Music, Volume2, Mic, X } from 'lucide-react';
import { sfx } from '../audio/sfx.js';

export default function AudioMixerModal({ room, me, voiceChat, onClose }) {
  const [bgmVol, setBgmVol] = useState(sfx.bgmVolume);
  const [sfxVol, setSfxVol] = useState(sfx.sfxVolume);

  const humanPeers = (room?.players || []).filter((p) => !p.isBot && p.id !== me?.id && p.connected);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ggd-card w-full max-w-sm p-4 flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="font-extrabold text-base text-amber-300 flex items-center gap-2">
            <span>🎛️ Cài Đặt Âm Thanh</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BGM Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Music className="w-4 h-4 text-sky-400" /> Nhạc nền (Sảnh / Ngày / Đêm)
            </span>
            <span className="text-amber-300">{Math.round(bgmVol * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={bgmVol}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setBgmVol(v);
              sfx.setBgmVolume(v);
            }}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* SFX Volume + Sound Test */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" /> Hiệu ứng (Gà gáy, Sói hú...)
            </span>
            <span className="text-amber-300">{Math.round(sfxVol * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sfxVol}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setSfxVol(v);
              sfx.setSfxVolume(v);
            }}
            className="w-full accent-emerald-400 cursor-pointer"
          />
          <div className="flex gap-1.5 mt-1">
            <button
              type="button"
              onClick={() => sfx.play('rooster')}
              className="px-2 py-1 rounded bg-[#2d2320] border border-white/15 text-[10.5px] font-bold text-amber-200 hover:bg-[#3e302c] cursor-pointer"
            >
              🐓 Thử Gà gáy
            </button>
            <button
              type="button"
              onClick={() => sfx.play('wolf')}
              className="px-2 py-1 rounded bg-[#2d2320] border border-white/15 text-[10.5px] font-bold text-rose-200 hover:bg-[#3e302c] cursor-pointer"
            >
              🐺 Thử Sói hú
            </button>
            <button
              type="button"
              onClick={() => sfx.play('gunshot')}
              className="px-2 py-1 rounded bg-[#2d2320] border border-white/15 text-[10.5px] font-bold text-orange-200 hover:bg-[#3e302c] cursor-pointer"
            >
              🔫 Súng
            </button>
          </div>
        </div>

        {/* Master Voice Volume (0% - 200%) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-rose-400" /> Âm lượng Voice tổng (Khuếch đại)
            </span>
            <span className="text-amber-300">{Math.round(voiceChat.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={voiceChat.masterVolume}
            onChange={(e) => voiceChat.setMasterVolume(parseFloat(e.target.value))}
            className="w-full accent-rose-400 cursor-pointer"
          />
          {voiceChat.micPermission === 'granted' && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10.5px] text-slate-300 shrink-0">Mic của bạn:</span>
              <div className="flex-1 h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${voiceChat.micEnabled ? voiceChat.localMicLevel || 0 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Per-player Voice Volume (0% - 200%) */}
        {humanPeers.length > 0 && (
          <div className="border-t border-white/10 pt-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-bold uppercase text-slate-400">
              Chỉnh riêng giọng từng người (0% - 200%)
            </div>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {humanPeers.map((peer) => {
                const v = voiceChat.peerVolumes[peer.id] ?? 1;
                return (
                  <div key={peer.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate max-w-[125px] font-semibold">{peer.name}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={v}
                        onChange={(e) => voiceChat.setVolume(peer.id, parseFloat(e.target.value))}
                        className="w-24 accent-sky-400 cursor-pointer"
                      />
                      <span className="text-[10px] w-8 text-right text-amber-300">{Math.round(v * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
