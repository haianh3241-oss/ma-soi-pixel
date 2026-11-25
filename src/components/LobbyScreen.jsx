import React, { useState } from 'react';
import { Copy, Check, Plus, Trash2, Bot, Play, Sparkles, ScrollText } from 'lucide-react';
import { ROLES, VILLAGERS } from '../../shared/constants.js';
import PixelVillager from './PixelVillager.jsx';

export function HomeScreen({ onCreateRoom, onJoinRoom, initialCode = '' }) {
  const [name, setName] = useState(() => localStorage.getItem('masoi_name') || '');
  const [avatarId, setAvatarId] = useState(() => localStorage.getItem('masoi_avatar') || VILLAGERS[0].id);
  const [will, setWill] = useState(() => localStorage.getItem('masoi_will') || '');
  const [joinCode, setJoinCode] = useState(initialCode);
  const [error, setError] = useState('');

  const saveLocal = () => {
    localStorage.setItem('masoi_name', name.trim() || 'Dân Làng');
    localStorage.setItem('masoi_avatar', avatarId);
    localStorage.setItem('masoi_will', will);
  };

  const handleCreate = () => {
    if (!name.trim()) return setError('Hãy nhập tên nhân vật của bạn!');
    saveLocal();
    onCreateRoom({ name: name.trim(), avatarId, will }, (res) => {
      if (!res?.ok) setError(res?.error || 'Không thể tạo phòng!');
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Hãy nhập tên nhân vật của bạn!');
    if (!joinCode.trim()) return setError('Hãy nhập mã phòng!');
    saveLocal();
    onJoinRoom({ code: joinCode.trim().toUpperCase(), name: name.trim(), avatarId, will }, (res) => {
      if (!res?.ok) setError(res?.error || 'Không vào được phòng!');
    });
  };

  const selectedVillager = VILLAGERS.find((v) => v.id === avatarId) || VILLAGERS[0];

  return (
    <div className="min-h-dvh w-full bg-[radial-gradient(circle_at_top,#2a2142,#100d18_70%)] p-3 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-4 my-auto">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-2 rounded bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-[11px] font-bold text-amber-300">
            <span>🔥 SOUL KNIGHT PIXEL EDITION</span>
            <span>•</span>
            <span>VOICE CHAT NGÀY / ĐÊM</span>
          </div>
          <h1 className="font-pixel-title text-2xl md:text-4xl text-amber-300 drop-shadow-[0_3px_0_#000] mt-1">
            MA SÓI PIXEL VILLAGE
          </h1>
          <p className="text-xs md:text-sm text-slate-300">
            11 Vai trò mở rộng • Ẩn role người chết • Ném đồ cà khịa • Chơi ngay không cần tài khoản
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Left: Character & Pre-game Will */}
          <div className="md:col-span-7 px-panel p-3.5 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-panel-dark p-2.5">
              <div
                className="rounded border-2 border-black p-1.5 shrink-0"
                style={{ background: selectedVillager.bg }}
                title="Chạm thử vào nhân vật!"
              >
                <PixelVillager avatarId={selectedVillager.id} size={64} enablePoke={true} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-amber-300 truncate">
                  {selectedVillager.name} <span className="text-slate-400 font-normal">({selectedVillager.tag})</span>
                </div>
                <input
                  type="text"
                  maxLength={18}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="Nhập tên của bạn (VD: Tèo Thợ Rèn)..."
                  className="px-input w-full"
                />
              </div>
            </div>

            {/* 21 Villagers Grid */}
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                Chọn Dân Làng Pixel ({VILLAGERS.length} nhân vật):
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-52 overflow-y-auto p-1">
                {VILLAGERS.map((v) => {
                  const active = v.id === avatarId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setAvatarId(v.id)}
                      className={`flex flex-col items-center p-1.5 rounded border-2 transition cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 scale-[1.03]'
                          : 'border-[#2f2742] bg-[#161221] hover:border-slate-500'
                      }`}
                      title={`${v.name} — ${v.tag}`}
                    >
                      <PixelVillager avatarId={v.id} size={38} animate={active} />
                      <span className="mt-1 text-[9.5px] leading-tight text-center line-clamp-1 w-full text-slate-200">
                        {v.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pre-game Will */}
            <div>
              <label className="text-[11px] font-bold uppercase text-amber-300 flex items-center gap-1 mb-1">
                <ScrollText className="w-3.5 h-3.5" />
                <span>Di Chúc Túi Áo (Viết trước khi chia Role — Khóa khi vào trận):</span>
              </label>
              <input
                type="text"
                maxLength={140}
                value={will}
                onChange={(e) => setWill(e.target.value)}
                placeholder="VD: Ai cắn tui là đồ chó! Hoặc nhắn gửi lời trăn trối lầy lội..."
                className="px-input w-full text-xs"
              />
            </div>
          </div>

          {/* Right: Create or Join */}
          <div className="md:col-span-5 px-panel p-3.5 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-3">
              <div>
                <div className="font-pixel-title text-sm text-emerald-300 mb-1">TẠO PHÒNG MỚI</div>
                <p className="text-xs text-slate-300 mb-2.5">
                  Tạo bàn mới làm chủ phòng, lấy mã mời & link gửi cho bạn bè cùng vào chơi.
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-btn w-full bg-emerald-500 text-black py-2.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Phòng Làng Mới</span>
                </button>
              </div>

              <div className="border-t-2 border-[#342c47] pt-3">
                <div className="font-pixel-title text-sm text-sky-300 mb-1">VÀO PHÒNG BẠN BÈ</div>
                <form onSubmit={handleJoin} className="flex flex-col gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setError('');
                    }}
                    placeholder="Nhập mã 6 ký tự (VD: A7K9P2)"
                    className="px-input w-full text-center font-pixel-title tracking-widest uppercase text-base"
                  />
                  <button type="submit" className="px-btn w-full bg-sky-500 text-black py-2.5 text-sm">
                    Vào Làng Ngay
                  </button>
                </form>
              </div>
            </div>

            {error && (
              <div className="rounded bg-red-950/80 border border-red-500 px-3 py-2 text-xs text-red-200 font-bold">
                ⚠️ {error}
              </div>
            )}

            <div className="px-panel-dark p-2.5 text-[11px] text-slate-400 leading-relaxed">
              💡 <b>Mẹo:</b> Có thể thêm <b>Bot AI</b> trong phòng chờ nếu muốn test nhanh các vai trò trước khi rủ đủ hội bạn!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LobbyScreen({
  room,
  me,
  onUpdateProfile,
  onUpdateSettings,
  onBalanceRoles,
  onAddBot,
  onRemovePlayer,
  onStartGame,
}) {
  const [copied, setCopied] = useState(false);
  const [willDraft, setWillDraft] = useState(me?.will || '');
  const [startError, setStartError] = useState('');

  const isHost = room.hostId === me?.id;
  const roleCounts = room.settings.roleCounts || {};
  const totalRoles = Object.values(roleCounts).reduce((a, b) => a + (Number(b) || 0), 0);

  const inviteUrl = `${window.location.origin}?room=${room.code}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const adjustRole = (roleId, delta) => {
    if (!isHost) return;
    const next = Math.max(0, (roleCounts[roleId] || 0) + delta);
    onUpdateSettings({
      roleCounts: { ...roleCounts, [roleId]: next },
    });
  };

  const handleStart = () => {
    setStartError('');
    onStartGame((res) => {
      if (!res?.ok) setStartError(res?.error || 'Không thể bắt đầu');
    });
  };

  return (
    <div className="flex-1 w-full p-2.5 md:p-4 bg-[radial-gradient(circle_at_top,#241c38,#100d18_75%)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-3 pb-6">
        {/* Top Invite Banner */}
        <div className="px-panel p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase">Phòng Chờ Ngôi Làng</div>
            <div className="flex items-center gap-2">
              <span className="font-pixel-title text-xl md:text-2xl text-amber-300 tracking-widest">
                {room.code}
              </span>
              <span className="rounded bg-[#151120] border border-[#3e3556] px-2 py-0.5 text-xs text-slate-300">
                {room.players.length}/16 người
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyLink} className="px-btn bg-sky-500 text-black px-3 py-2 text-xs">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã Copy Link Mời!' : 'Copy Link Mời Bạn'}</span>
            </button>
            {isHost && (
              <button
                type="button"
                onClick={handleStart}
                className="px-btn bg-emerald-500 text-black px-4 py-2 text-xs md:text-sm"
              >
                <Play className="w-4 h-4" />
                <span>Bắt Đầu Ván Đấu</span>
              </button>
            )}
          </div>
        </div>

        {startError && (
          <div className="rounded bg-red-950/90 border-2 border-red-500 px-3 py-2 text-xs text-red-200 font-bold">
            ⚠️ {startError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Players + Pre-game Will */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="px-panel p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-pixel-title text-xs text-amber-300">
                  DÂN LÀNG TRONG PHÒNG ({room.players.length})
                </span>
                {isHost && (
                  <button
                    type="button"
                    onClick={onAddBot}
                    className="px-btn bg-indigo-500 text-white px-2.5 py-1 text-[11px]"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>+ Thêm Bot AI</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-0.5">
                {room.players.map((p) => {
                  const v = VILLAGERS.find((x) => x.id === p.avatarId) || VILLAGERS[0];
                  return (
                    <div
                      key={p.id}
                      className={`px-panel-dark p-2 flex flex-col items-center relative ${
                        p.id === me?.id ? 'border-amber-400' : ''
                      }`}
                    >
                      {p.id === room.hostId && (
                        <span className="absolute top-1 left-1 text-[10px]" title="Chủ phòng">
                          👑
                        </span>
                      )}
                      {isHost && p.id !== me?.id && (
                        <button
                          type="button"
                          onClick={() => onRemovePlayer(p.id)}
                          className="absolute top-1 right-1 text-slate-400 hover:text-red-400 cursor-pointer"
                          title="Mời ra khỏi phòng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <PixelVillager avatarId={p.avatarId} size={46} />
                      <div className="mt-1 text-xs font-bold truncate max-w-full text-center">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-full">{v.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Edit pre-game will & change villager before start */}
            <div className="px-panel p-3 flex flex-col gap-2">
              <div className="font-pixel-title text-xs text-amber-300 flex items-center gap-1.5">
                <ScrollText className="w-4 h-4" />
                <span>DI CHÚC CỦA BẠN (Khóa ngay khi bắt đầu!)</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={140}
                  value={willDraft}
                  onChange={(e) => setWillDraft(e.target.value)}
                  placeholder="Viết sẵn di chúc trước khi biết Role..."
                  className="px-input flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => onUpdateProfile({ will: willDraft })}
                  className="px-btn bg-amber-500 text-black px-3 py-1.5 text-xs"
                >
                  Lưu
                </button>
              </div>
              <div className="text-[11px] text-slate-400">
                Đổi nhanh ngoại hình dân làng:
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {VILLAGERS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onUpdateProfile({ avatarId: v.id })}
                    className={`shrink-0 p-1 rounded border cursor-pointer ${
                      me?.avatarId === v.id ? 'border-amber-400 bg-amber-500/20' : 'border-[#332b47] bg-[#161221]'
                    }`}
                    title={v.name}
                  >
                    <PixelVillager avatarId={v.id} size={32} animate={false} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Host Role Deck & Rules */}
          <div className="lg:col-span-6 px-panel p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-pixel-title text-xs text-amber-300">
                  BỘ VAI TRÒ ({totalRoles} / {room.players.length} người)
                </div>
                <div className="text-[11px] text-slate-400">
                  {totalRoles === room.players.length
                    ? '✅ Khớp sĩ số phòng'
                    : '⚠️ Bấm Tự cân bằng hoặc chỉnh cho khớp sĩ số'}
                </div>
              </div>
              {isHost && (
                <button
                  type="button"
                  onClick={onBalanceRoles}
                  className="px-btn bg-amber-500 text-black px-2.5 py-1.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tự Cân Bằng</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {Object.values(ROLES).map((role) => {
                const count = roleCounts[role.id] || 0;
                return (
                  <div
                    key={role.id}
                    className="px-panel-dark p-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{role.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold truncate" style={{ color: role.color }}>
                          {role.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{role.teamName}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => adjustRole(role.id, -1)}
                          className="px-btn bg-[#2e2742] w-6 h-6 text-xs"
                        >
                          -
                        </button>
                      )}
                      <span className="w-5 text-center font-bold text-amber-300">{count}</span>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => adjustRole(role.id, 1)}
                          className="px-btn bg-[#2e2742] w-6 h-6 text-xs"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Game Settings */}
            <div className="px-panel-dark p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Luật Thị Trưởng (x2 phiếu)
                </label>
                <select
                  disabled={!isHost}
                  value={room.settings.mayorMode}
                  onChange={(e) => onUpdateSettings({ mayorMode: e.target.value })}
                  className="px-input w-full text-xs py-1.5"
                >
                  <option value="hidden">Cộng ngầm x2 (Giấu mặt)</option>
                  <option value="reveal">Bấm Lộ Diện Ấn Tín để x2</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Thời gian thảo luận ngày
                </label>
                <select
                  disabled={!isHost}
                  value={room.settings.discussSeconds}
                  onChange={(e) => onUpdateSettings({ discussSeconds: Number(e.target.value) })}
                  className="px-input w-full text-xs py-1.5"
                >
                  <option value={45}>45 giây (Nhanh)</option>
                  <option value={60}>60 giây</option>
                  <option value={90}>90 giây (Chuẩn)</option>
                  <option value={120}>120 giây</option>
                  <option value={180}>180 giây (Kỹ)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Thời gian hành động đêm
                </label>
                <select
                  disabled={!isHost}
                  value={room.settings.nightSeconds}
                  onChange={(e) => onUpdateSettings({ nightSeconds: Number(e.target.value) })}
                  className="px-input w-full text-xs py-1.5"
                >
                  <option value={25}>25 giây</option>
                  <option value={35}>35 giây (Chuẩn)</option>
                  <option value={50}>50 giây</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer self-end pb-1">
                <input
                  type="checkbox"
                  disabled={!isHost}
                  checked={room.settings.enableWills}
                  onChange={(e) => onUpdateSettings({ enableWills: e.target.checked })}
                  className="accent-amber-400 w-4 h-4"
                />
                <span>Rơi Di chúc khi chết (Ẩn Role)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
