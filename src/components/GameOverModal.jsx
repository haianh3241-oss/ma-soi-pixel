import React, { useState } from 'react';
import { Trophy, RotateCcw, LogOut } from 'lucide-react';
import { ROAST_STICKERS, ROLES } from '../../shared/constants.js';
import PixelVillager from './PixelVillager.jsx';
import RoleIcon from './RoleIcon.jsx';

export default function GameOverModal({
  room,
  me,
  onAddRoastSticker,
  onReturnLobby,
  onLeaveRoom,
}) {
  const [selectedSticker, setSelectedSticker] = useState(ROAST_STICKERS[0].id);
  const isHost = room.hostId === me?.id;
  const winner = room.winner;

  return (
    <div className="min-h-dvh w-full bg-[radial-gradient(circle_at_top,#35224e,#0e0b16_75%)] p-3 md:p-5">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 pb-8">
        {/* Winner Header */}
        <div className="px-panel p-4 text-center flex flex-col items-center gap-2">
          <Trophy className="w-10 h-10 text-amber-400" />
          <h2 className="font-pixel-title text-xl md:text-3xl text-amber-300">
            {winner?.title || 'KẾT THÚC VÁN ĐẤU!'}
          </h2>
          <p className="text-xs md:text-sm text-slate-200">{winner?.reason}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {isHost && (
              <button
                type="button"
                onClick={onReturnLobby}
                className="px-btn bg-emerald-400 text-black px-5 py-2.5 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi Lại Ván Mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-btn bg-rose-600 text-white px-4 py-2.5 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Thoát Phòng</span>
            </button>
          </div>
        </div>

        {/* Roast Sticker Slapper Toolbar */}
        <div className="px-panel p-3 flex flex-col gap-2">
          <div className="text-xs font-bold text-amber-300">
            🏷️ DÁN HUY HIỆU "CÀ KHỊA" LÊN ĐẦU BẠN BÈ (Chọn sticker rồi bấm vào thẻ người chơi bên dưới):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROAST_STICKERS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedSticker(st.id)}
                className={`px-btn px-2.5 py-1.5 text-xs ${
                  selectedSticker === st.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#251f36] text-slate-200'
                }`}
                title={st.desc}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Full Role Reveal + Awards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {room.players
            .filter((p) => !p.isSpectator)
            .map((p) => {
              const role = ROLES[p.role] || ROLES.villager;
              const isWinner = winner?.winners?.includes(p.id);
              const autoList = room.autoAwards?.[p.id] || [];
              const customList = room.endgameStickers?.[p.id] || [];

              return (
                <div
                  key={p.id}
                  onClick={() => onAddRoastSticker(p.id, selectedSticker)}
                  className={`px-panel p-3 flex flex-col gap-2 cursor-pointer transition hover:scale-[1.01] ${
                    isWinner ? 'border-amber-400 bg-[#2a233d]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PixelVillager avatarId={p.avatarId} alive={p.alive} size={52} still={true} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{p.name}</span>
                        {isWinner && <span className="text-xs">🏆</span>}
                        {p.isLover && <span className="text-xs">💘</span>}
                      </div>
                      <div className="text-xs font-bold flex items-center gap-1 flex-wrap" style={{ color: role.color }}>
                        <RoleIcon role={role} className="w-4 h-4 shrink-0" emojiClass="text-sm leading-none" />
                        <span>{role.name}</span>
                        {p.originalRole && p.originalRole !== p.role && (
                          <span className="text-[10px] text-red-300 ml-1">
                            (Bị nguyền từ {ROLES[p.originalRole]?.name})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.alive
                          ? '✅ Sống sót'
                          : `💀 Chết ${p.deathInfo?.phase === 'NIGHT' ? 'đêm' : 'ngày'} ${p.deathInfo?.day || '?'}`}
                      </div>
                    </div>
                  </div>

                  {p.will && (
                    <div className="text-[11px] text-amber-200/90 bg-black/30 rounded px-2 py-1">
                      📜 “{p.will}”
                    </div>
                  )}

                  {/* Badges (Auto + Friend-slapped) */}
                  {(autoList.length > 0 || customList.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {autoList.map((sid) => {
                        const st = ROAST_STICKERS.find((x) => x.id === sid);
                        if (!st) return null;
                        return (
                          <span
                            key={`auto-${sid}`}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-black"
                            style={{ background: `${st.color}33`, color: st.color }}
                            title={st.desc}
                          >
                            {st.icon} {st.label}
                          </span>
                        );
                      })}
                      {customList.map((c, idx) => {
                        const st = ROAST_STICKERS.find((x) => x.id === c.stickerId);
                        if (!st) return null;
                        return (
                          <span
                            key={`custom-${idx}`}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-amber-400/50 bg-black/50"
                            style={{ color: st.color }}
                            title={`${c.fromName} dán tặng!`}
                          >
                            {st.icon} {st.label} · {c.fromName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Secret Game Master Log */}
        {room.secretLogs?.length > 0 && (
          <div className="px-panel p-3">
            <div className="font-pixel-title text-xs text-amber-300 mb-2">
              📖 NHẬT KÝ BÍ MẬT CỦA QUẢN TRÒ
            </div>
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto text-xs text-slate-300">
              {room.secretLogs.map((line, i) => (
                <div key={i} className="bg-[#161221] px-2.5 py-1 rounded">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
