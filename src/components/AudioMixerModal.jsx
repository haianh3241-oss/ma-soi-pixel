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

        {/* SFX Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" /> Hiệu ứng (Gà gáy, Chó hú...)
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
        </div>

        {/* Master Voice Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-rose-400" /> Âm lượng Voice tổng
            </span>
            <span className="text-amber-300">{Math.round(voiceChat.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={voiceChat.masterVolume}
            onChange={(e) => voiceChat.setMasterVolume(parseFloat(e.target.value))}
            className="w-full accent-rose-400 cursor-pointer"
          />
        </div>

        {/* Per-player Voice Volume */}
        {humanPeers.length > 0 && (
          <div className="border-t border-white/10 pt-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-bold uppercase text-slate-400">
              Chỉnh riêng giọng từng người
            </div>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {humanPeers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate max-w-[140px] font-semibold">{peer.name}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceChat.peerVolumes[peer.id] ?? 1}
                    onChange={(e) => voiceChat.setVolume(peer.id, parseFloat(e.target.value))}
                    className="w-28 accent-sky-400 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
