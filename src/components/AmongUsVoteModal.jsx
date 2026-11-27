import React, { useMemo, useState } from 'react';
import { X, Eye, CheckCircle2, SkipForward, Mic } from 'lucide-react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { isWolfRole } from '../utils/helpers.js';
import { sfx } from '../audio/sfx.js';

export default function AmongUsVoteModal({
  open,
  room,
  me,
  secondsLeft = 0,
  speakingPeers = {},
  onVote,
  onClose,
}) {
  const [confirmTargetId, setConfirmTargetId] = useState(null);

  const activePlayers = useMemo(
    () => (room?.players || []).filter((p) => !p.isSpectator),
    [room?.players]
  );
  const alivePlayers = useMemo(() => activePlayers.filter((p) => p.alive), [activePlayers]);

  const votesByTarget = useMemo(() => {
    const map = {};
    for (const [voterId, info] of Object.entries(room?.publicDayVotes || {})) {
      if (!map[info.targetId]) map[info.targetId] = [];
      const voter = room.players.find((x) => x.id === voterId);
      map[info.targetId].push({ voter, weight: info.weight || 1 });
    }
    return map;
  }, [room?.publicDayVotes, room?.players]);

  const totalCastWeight = Object.keys(room?.publicDayVotes || {}).length;
  const myChoice = me ? room?.publicDayVotes?.[me.id]?.targetId : null;
  const canVote = Boolean(me?.alive && !me?.isSpectator && room?.phase === 'DAY_DISCUSS');

  if (!open) return null;

  const sortedPlayers = [...activePlayers].sort((a, b) => Number(b.alive) - Number(a.alive));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[290] bg-black/72 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-2xl border-4 border-[#191413] bg-gradient-to-b from-[#3b2f2a] via-[#271f1c] to-[#1a1412] shadow-2xl overflow-hidden"
      >
        {/* Top Emergency Board Header */}
        <div className="px-4 py-2.5 bg-[#1b1513] border-b-2 border-[#120d0c] flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-brand text-sm sm:text-lg text-amber-300 flex items-center gap-2">
              <span>🗳️ HỘI NGHỊ BỎ PHIẾU SÂN ĐÌNH — NGÀY {room?.dayCount}</span>
            </div>
            <div className="text-[11px] text-amber-100/75">
              Đã bỏ phiếu: <b>{totalCastWeight}/{alivePlayers.length}</b> • Cần nhiều phiếu hơn tổng (Bỏ qua + Phiếu trống) mới đưa lên Giá Treo Cổ!
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#332724] border-2 border-[#140f0e] px-2.5 py-1 text-xs font-black text-amber-200">
              ⏱️ {Math.max(0, secondsLeft)}s
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ggd-btn bg-sky-500 text-black px-2.5 py-1 text-xs"
              title="Thu nhỏ để ngó lại hiện trường trên Sân Đình"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ngó Sân Đình</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-rose-600 border-2 border-[#140f0e] text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Column Player Cards Grid (Among Us Tablet Style) */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sortedPlayers.map((p) => {
            const hasVoted = Boolean(room?.publicDayVotes?.[p.id]);
            const votersOnP = votesByTarget[p.id] || [];
            const voteWeightSum = votersOnP.reduce((s, v) => s + v.weight, 0);
            const isSpeaking = Boolean(speakingPeers[p.id]);
            const isPickedByMe = myChoice === p.id;
            const isConfirming = confirmTargetId === p.id;
            const isMeWolfTeammate = p.role && isWolfRole(p.role) && p.id !== me?.id;

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (!canVote || !p.alive) return;
                  sfx.play('click');
                  setConfirmTargetId((cur) => (cur === p.id ? null : p.id));
                }}
                className={`relative rounded-xl border-2 p-2.5 flex items-center justify-between gap-2 transition select-none ${
                  !p.alive
                    ? 'bg-[#191413]/75 border-[#2c221f] opacity-55 grayscale'
                    : isPickedByMe
                      ? 'bg-[#5c2c22] border-amber-400 ring-2 ring-amber-400/70 cursor-pointer'
                      : canVote
                        ? 'bg-[#faf3e6] text-[#262121] border-[#191413] hover:bg-[#f4e4c8] cursor-pointer shadow'
                        : 'bg-[#e8dac2] text-[#262121] border-[#191413]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={ASSET_PATHS.characterIcon(p.avatarId)}
                      alt={p.name}
                      className={`w-11 h-11 rounded-lg border-2 border-[#191413] bg-[#e4cda8] object-contain ${
                        isSpeaking ? 'ring-2 ring-emerald-400' : ''
                      }`}
                    />
                    {hasVoted && p.alive && (
                      <span
                        title="Đã bỏ phiếu"
                        className="absolute -top-1.5 -left-1.5 bg-emerald-500 text-black rounded-full border border-[#140f0e] p-0.5"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    )}
                    {!p.alive && (
                      <span className="absolute -top-1.5 -right-1.5 text-sm">☠️</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className={`font-black text-xs sm:text-sm truncate ${isPickedByMe ? 'text-amber-200' : ''}`}>
                      {p.name} {p.id === me?.id ? '(Bạn)' : ''} {isMeWolfTeammate ? '🐺' : ''}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {p.mayorRevealed && (
                        <span className="rounded bg-amber-400 text-black px-1 text-[9px] font-black">🎖️ x2</span>
                      )}
                      {isSpeaking && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 text-emerald-700 px-1 text-[9px] font-bold">
                          <Mic className="w-2.5 h-2.5" /> Đang nói
                        </span>
                      )}
                      {!p.alive && (
                        <span className="text-[10px] font-bold text-red-400">
                          {p.deathInfo?.cause === 'lynch' ? 'Đã bị Treo Cổ' : 'Đã ngã xuống'}
                        </span>
                      )}
                      {/* Mini voter badges */}
                      {votersOnP.map(({ voter, weight }, i) => (
                        <span
                          key={voter?.id || i}
                          title={`${voter?.name} (${weight} phiếu)`}
                          className="inline-flex items-center gap-0.5 rounded-full bg-[#191413] text-amber-200 px-1.5 py-0.2 text-[9px] font-bold"
                        >
                          {voter?.name?.slice(0, 8)}
                          {weight > 1 ? `×${weight}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Vote Tally Badge or Confirm Buttons */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {voteWeightSum > 0 && (
                    <span className="rounded-full bg-rose-600 text-white border-2 border-[#140f0e] px-2 py-0.5 text-xs font-black">
                      {voteWeightSum}
                    </span>
                  )}
                  {isConfirming && canVote && p.alive && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('click');
                          onVote(p.id);
                          setConfirmTargetId(null);
                        }}
                        className="rounded-lg bg-emerald-500 border-2 border-[#140f0e] text-black px-2.5 py-1 text-xs font-black cursor-pointer hover:brightness-110"
                      >
                        ✅ BẦU
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmTargetId(null)}
                        className="rounded-lg bg-rose-600 border-2 border-[#140f0e] text-white px-2 py-1 text-xs font-black cursor-pointer"
                      >
                        ✖
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Footer: Skip Vote (Among Us Style) */}
        <div className="px-4 py-2.5 bg-[#1b1513] border-t-2 border-[#120d0c] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {canVote ? (
              <button
                type="button"
                onClick={() => {
                  sfx.play('click');
                  onVote('skip');
                  setConfirmTargetId(null);
                }}
                className={`ggd-btn px-3.5 py-1.5 text-xs ${
                  myChoice === 'skip' ? 'bg-amber-400 text-black ring-2 ring-white' : 'bg-[#332724] text-amber-100'
                }`}
              >
                <SkipForward className="w-4 h-4" />
                <span>{myChoice === 'skip' ? 'Đã chọn BỎ QUA (Skip)' : 'BỎ QUA VOTE (Skip)'}</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-400">
                {me?.alive ? 'Chưa tới lượt bỏ phiếu' : '👻 Hồn ma chỉ có thể theo dõi bảng bỏ phiếu'}
              </span>
            )}

            {(votesByTarget.skip || []).length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-200/80">
                <span>Skip ({(votesByTarget.skip || []).reduce((s, v) => s + v.weight, 0)}):</span>
                {(votesByTarget.skip || []).map(({ voter }, i) => (
                  <span key={voter?.id || i} className="rounded bg-black/50 px-1.5 py-0.5">
                    {voter?.name?.slice(0, 8)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <span className="text-[11px] text-amber-200/75 font-bold">
            Đủ quá bán mới lên Giá Treo Cổ
          </span>
        </div>
      </div>
    </div>
  );
}
