import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, Heart } from 'lucide-react';
import { ROLES, PHASES } from '../../shared/constants.js';
import RoleIcon from './RoleIcon.jsx';

export default function RolePanel({ room, me, onRevealMayor }) {
  const [hidden, setHidden] = useState(false);

  if (!me || me.isSpectator) {
    return (
      <div className="px-panel p-2.5 text-xs">
        <div className="font-pixel-title text-amber-300 text-xs">👁️ KHÁN GIẢ</div>
        <p className="mt-1 text-slate-300 leading-relaxed">
          Bạn đang xem ván đấu. Vai trò các người chơi được bảo mật cho đến hết ván. Bạn sẽ tự tham gia vào ván tiếp theo!
        </p>
      </div>
    );
  }

  const priv = room.selfPrivate;
  const roleDef = priv?.role ? ROLES[priv.role] : null;
  if (!roleDef) return null;

  const lovers = (priv.lovers || [])
    .filter((id) => id !== me.id)
    .map((id) => room.players.find((p) => p.id === id))
    .filter(Boolean);

  const canRevealMayor =
    priv.role === 'mayor' &&
    me.alive &&
    !me.mayorRevealed &&
    room.settings.mayorMode === 'reveal' &&
    !priv.villagePowersLost &&
    [PHASES.DAY_DISCUSS, PHASES.DAY_DEFENSE, PHASES.DAY_VERDICT].includes(room.phase);

  return (
    <div className="px-panel p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-pixel-title text-[11px] uppercase tracking-wider text-amber-300">
          📜 Vai Trò Của Tôi
        </span>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="px-btn bg-[#322b45] px-2 py-1 text-[11px] text-slate-200"
          title="Che nhanh tránh người ngồi cạnh nhìn trộm"
        >
          {hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{hidden ? 'Hiện' : 'Che'}</span>
        </button>
      </div>

      {hidden ? (
        <div className="px-panel-dark p-3 text-center text-xs text-slate-400">
          🔒 Đang che bài — Bấm <b>Hiện</b> để đọc lại vai trò
        </div>
      ) : (
        <div className="px-panel-dark p-2.5 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RoleIcon role={roleDef} className="w-7 h-7 shrink-0" emojiClass="text-xl leading-none" />
              <div>
                <div className="font-pixel-title text-sm" style={{ color: roleDef.color }}>
                  {roleDef.name}
                </div>
                <div className="text-[10px] text-slate-400">{roleDef.teamName}</div>
              </div>
            </div>
            {!me.alive && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                👻 ĐÃ CHẾT
              </span>
            )}
          </div>

          <p className="text-[11.5px] leading-snug text-slate-200">{roleDef.summary}</p>
          <div className="text-[11px] text-amber-300/90">
            <b>Thắng khi:</b> {roleDef.winCondition}
          </div>

          {priv.villagePowersLost && roleDef.team === 'village' && (
            <div className="flex items-center gap-1.5 rounded bg-red-950/70 border border-red-600/50 px-2 py-1 text-[11px] text-red-200">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span>Quyền năng phe Dân đã bị phong ấn!</span>
            </div>
          )}

          {/* Role-specific status */}
          {priv.role === 'elder' && (
            <div className="text-[11px] text-yellow-300">
              ❤️ Số mạng chống Sói còn lại: <b>{priv.elderLives}</b>
            </div>
          )}

          {priv.role === 'witch' && (
            <div className="flex gap-2 text-[11px]">
              <span className={priv.witchHealLeft ? 'text-emerald-300' : 'text-slate-500 line-through'}>
                💚 Bình Cứu: {priv.witchHealLeft ? 'Còn 1' : 'Đã dùng'}
              </span>
              <span className={priv.witchPoisonLeft ? 'text-purple-300' : 'text-slate-500 line-through'}>
                ☠️ Bình Độc: {priv.witchPoisonLeft ? 'Còn 1' : 'Đã dùng'}
              </span>
            </div>
          )}

          {priv.role === 'cursed_wolf' && (
            <div className="text-[11px] text-red-300">
              🩸 Nguyền rủa biến người thành Sói: <b>{priv.cursedUsed ? 'Đã dùng' : 'Còn 1 lần'}</b>
            </div>
          )}

          {priv.role === 'mayor' && (
            <div className="text-[11px] text-amber-300">
              ⚖️ Chế độ phiếu: <b>{room.settings.mayorMode === 'hidden' ? 'Tự động x2 ngầm' : me.mayorRevealed ? 'Đã lộ diện (x2)' : 'Chưa lộ diện'}</b>
            </div>
          )}

          {canRevealMayor && (
            <button
              type="button"
              onClick={onRevealMayor}
              className="px-btn mt-1 bg-amber-500 text-black py-1.5 text-xs"
            >
              🎖️ Lộ Diện Ấn Tín (x2 Phiếu)
            </button>
          )}

          {lovers.length > 0 && (
            <div className="flex items-center gap-1.5 rounded bg-pink-950/60 border border-pink-500/50 px-2 py-1 text-[11px] text-pink-200">
              <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span>
                Cặp đôi với: <b>{lovers.map((l) => l.name).join(', ')}</b>
              </span>
            </div>
          )}

          {priv.seerHistory?.length > 0 && (
            <div className="mt-1 border-t border-slate-700/70 pt-1.5">
              <div className="text-[10px] font-bold uppercase text-sky-300">Nhật ký Tiên Tri:</div>
              <div className="mt-0.5 flex flex-col gap-0.5 max-h-20 overflow-y-auto">
                {priv.seerHistory.map((h, i) => (
                  <div key={i} className="text-[11px] flex justify-between">
                    <span>Đêm {h.night}: {h.targetName}</span>
                    <span className={h.isWolf ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {h.isWolf ? '🐺 MA SÓI' : '🏡 KHÔNG PHẢI SÓI'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
