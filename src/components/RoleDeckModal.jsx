import React from 'react';
import { X } from 'lucide-react';
import { ROLES } from '../../shared/constants.js';

export default function RoleDeckModal({ room, onClose }) {
  const counts = room?.settings?.roleCounts || {};
  const activeRoles = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .map(([roleId, count]) => ({ role: ROLES[roleId], count: Number(count) }))
    .filter((entry) => Boolean(entry.role));

  const total = activeRoles.reduce((acc, item) => acc + item.count, 0);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ggd-card w-full max-w-md p-4 flex flex-col gap-3 max-h-[82dvh]"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <div className="font-extrabold text-base text-amber-300">📋 Cơ Cấu Vai Trò Trong Ván</div>
            <div className="text-[11px] text-slate-400">
              Tổng cộng {total} người chơi • Không lộ ai giữ vai nào
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          {activeRoles.map(({ role, count }) => (
            <div key={role.id} className="ggd-card-dark p-2.5 flex items-start gap-2.5">
              <span className="text-2xl leading-none shrink-0 mt-0.5">{role.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-sm" style={{ color: role.color }}>
                    {role.name}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black text-amber-300">
                    x{count}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-bold mb-0.5">{role.teamName}</div>
                <p className="text-xs text-slate-200 leading-snug">{role.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
