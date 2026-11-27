import React, { useState } from 'react';
import { Copy, Check, Plus, Trash2, Bot, Play, Sparkles, ScrollText, Mic, MicOff, Send, LogOut, X } from 'lucide-react';
import { ROLES, VILLAGERS } from '../../shared/constants.js';
import { ASSET_PATHS, BRAND } from '../../graphics-pack/themeConfig.js';
import { getVillagerMotion } from '../data/villagerMotion.js';
import PixelVillager from './PixelVillager.jsx';
import RoleIcon from './RoleIcon.jsx';

export function HomeScreen({ onCreateRoom, onJoinRoom, onOpenArtStudio, initialCode = '' }) {
  const [name, setName] = useState(() => localStorage.getItem('masoi_name') || '');
  const [avatarId, setAvatarId] = useState(() => localStorage.getItem('masoi_avatar') || VILLAGERS[0].id);
  const [will, setWill] = useState(() => localStorage.getItem('masoi_will') || '');
  const [joinCode, setJoinCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [previewEmoteKey, setPreviewEmoteKey] = useState(null);

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
  const selectedMotion = getVillagerMotion(selectedVillager.id);

  return (
    <div
      className="min-h-dvh w-full bg-cover bg-center bg-fixed p-3 md:p-6 flex items-center justify-center relative"
      style={{
        backgroundImage: `linear-gradient(rgba(20,15,13,0.72), rgba(16,12,10,0.86)), url('${ASSET_PATHS.lobbyBackground}')`,
      }}
    >
      <div className="w-full max-w-4xl flex flex-col gap-4 my-auto">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#d65539]/25 border border-[#f2b84b]/60 px-3.5 py-1 text-xs font-extrabold text-amber-200 backdrop-blur-xs">
            <span>🐺 {BRAND.badge}</span>
            <span>•</span>
            <span>VOICE CHAT SẢNH CHỜ & TRONG VÁN</span>
          </div>
          <h1 className="font-brand text-4xl md:text-5xl text-[#f2b84b] drop-shadow-[0_4px_0_#140f0e] mt-1">
            {BRAND.title}
          </h1>
          <p className="text-xs md:text-sm text-amber-100/80">
            11 Vai trò mở rộng • Ẩn role người chết • Ném đồ cà khịa • Chơi ngay không cần tài khoản
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Left: Character & Pre-game Will ("Sổ Nhân Vật") */}
          <div className="md:col-span-7 px-panel p-3.5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 folk-parchment rounded-xl p-2.5">
              <div
                className="rounded-xl border-2 border-[#262121] bg-[#e4cda8] p-1 shrink-0 self-center sm:self-auto flex items-center justify-center"
                title="Chạm thử hoặc bấm Diễn thử!"
              >
                <PixelVillager
                  avatarId={selectedVillager.id}
                  size={84}
                  emoteKey={previewEmoteKey}
                  enablePoke={true}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-[#262121] truncate">
                      {selectedVillager.name}
                    </div>
                    <div className="text-[11px] font-semibold text-[#67584a] truncate">
                      {selectedVillager.tag} • <span className="text-[#9f3822]">{selectedMotion.reaction}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewEmoteKey((k) => (k || 0) + 1)}
                    className="px-btn bg-[#d65539] text-white px-2.5 py-1.5 text-[11px] shrink-0"
                    title="Xem nhân vật diễn hoạt"
                  >
                    <Play className="w-3 h-3" />
                    <span>Diễn thử</span>
                  </button>
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

            {/* 22 Villagers Grid ("Sổ Nhân Vật Dân Làng") */}
            <div>
              <div className="text-[11px] font-bold uppercase text-amber-200/90 mb-1.5">
                Sổ Nhân Vật Dân Làng ({VILLAGERS.length} gương mặt):
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-52 overflow-y-auto p-1">
                {VILLAGERS.map((v) => {
                  const active = v.id === avatarId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setAvatarId(v.id);
                        setPreviewEmoteKey(null);
                      }}
                      className={`flex flex-col items-center p-1.5 rounded-xl border-2 transition cursor-pointer ${
                        active
                          ? 'border-[#d65539] bg-[#faf3e6] text-[#262121] scale-[1.04] shadow-md'
                          : 'border-[#3e322e] bg-[#efe5d2]/95 text-[#262121] hover:bg-[#faf3e6] hover:border-[#f2b84b]'
                      }`}
                      title={`${v.name} — ${v.tag}`}
                    >
                      <PixelVillager avatarId={v.id} size={40} still={true} />
                      <span className="mt-1 text-[9.5px] font-bold leading-tight text-center line-clamp-1 w-full">
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

            <div className="px-panel-dark p-2.5 text-[11px] text-slate-400 leading-relaxed flex flex-col gap-2">
              <div>
                💡 <b>Mẹo:</b> Có thể thêm <b>Bot AI</b> trong phòng chờ nếu muốn test nhanh các vai trò trước khi rủ đủ hội bạn!
              </div>
              {onOpenArtStudio && (
                <button
                  type="button"
                  onClick={onOpenArtStudio}
                  className="text-left text-[11px] font-bold text-amber-300/85 hover:text-amber-200 underline cursor-pointer"
                >
                  🎨 Mở Phòng Thử Đồ Họa (Art Studio Preview)
                </button>
              )}
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
  voiceChat,
  onSendChat,
  onLeaveRoom,
  onUpdateProfile,
  onUpdateSettings,
  onBalanceRoles,
  onAddBot,
  onRemovePlayer,
  onStartGame,
}) {
  const [copied, setCopied] = useState(false);
  const [willDraft, setWillDraft] = useState(me?.will || '');
  const [chatText, setChatText] = useState('');
  const [startError, setStartError] = useState('');
  const [audioHintDismissed, setAudioHintDismissed] = useState(false);

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
    <div
      className="flex-1 w-full bg-cover bg-center bg-fixed p-2.5 md:p-4"
      style={{
        backgroundImage: `linear-gradient(rgba(20,15,13,0.72), rgba(16,12,10,0.84)), url('${ASSET_PATHS.lobbyBackground}')`,
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-3 pb-6">
        {/* Compact Mobile Audio & Mic Permission Reminder Banner */}
        {!audioHintDismissed && (
          <div
            className={`rounded-lg border-2 px-3 py-2 flex items-center justify-between gap-2 text-xs shadow ${
              voiceChat?.micPermission === 'denied'
                ? 'bg-rose-950/90 border-rose-500 text-rose-100'
                : voiceChat?.micPermission === 'unsupported'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-100'
                  : voiceChat?.micPermission === 'granted'
                    ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-100'
                    : 'bg-[#1b2342]/95 border-amber-400/70 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-sm">
                {voiceChat?.micPermission === 'denied'
                  ? '🚫'
                  : voiceChat?.micPermission === 'granted'
                    ? '✅'
                    : '📱'}
              </span>
              <span className="font-semibold leading-snug">
                {voiceChat?.micPermission === 'denied'
                  ? 'Trình duyệt đang chặn Micro! Hãy chạm biểu tượng 🔒 trên thanh địa chỉ để cho phép Micro rồi tải lại.'
                  : voiceChat?.micPermission === 'unsupported'
                    ? 'Thiết bị hoặc kết nối hiện tại chưa hỗ trợ Micro (cần truy cập qua HTTPS).'
                    : voiceChat?.micPermission === 'granted'
                      ? 'Đã cấp quyền Mic! Bạn có thể bấm nút Mic tròn bên phải để thử giọng bất cứ lúc nào.'
                      : 'Chạm màn hình để bật nhạc nền & bấm nút Mic bên phải để thử giọng'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {voiceChat?.micPermission === 'granted' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/35 border border-white/10">
                  <span className="text-[10px] text-emerald-300 font-bold">Mic</span>
                  <div className="w-12 h-2 rounded-full bg-black/60 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75"
                      style={{ width: `${voiceChat?.micEnabled ? voiceChat?.localMicLevel || 0 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {voiceChat?.micPermission === 'idle' && (
                <button
                  type="button"
                  onClick={voiceChat?.toggleMic}
                  className="px-2.5 py-1 rounded bg-emerald-400 text-black font-bold text-[11px] hover:bg-emerald-300 cursor-pointer"
                >
                  Thử Mic
                </button>
              )}
              <button
                type="button"
                onClick={() => setAudioHintDismissed(true)}
                className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                title="Đóng nhắc nhở"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
            <button
              type="button"
              onClick={voiceChat?.toggleMic}
              className={`px-btn px-3 py-2 text-xs ${
                voiceChat?.micEnabled ? 'bg-emerald-400 text-black' : 'bg-[#2b3354] text-rose-200'
              }`}
            >
              {voiceChat?.micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              <span>{voiceChat?.micEnabled ? 'Mic Sảnh: BẬT' : 'Bật Mic Sảnh'}</span>
            </button>
            <button type="button" onClick={copyLink} className="px-btn bg-sky-400 text-black px-3 py-2 text-xs">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã Copy Link!' : 'Mời Bạn'}</span>
            </button>
            {isHost && (
              <button
                type="button"
                onClick={handleStart}
                className="px-btn bg-emerald-400 text-black px-4 py-2 text-xs md:text-sm"
              >
                <Play className="w-4 h-4" />
                <span>Bắt Đầu</span>
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-btn bg-rose-600 text-white px-3 py-2 text-xs"
              title="Thoát khỏi phòng"
            >
              <LogOut className="w-4 h-4" />
              <span>Thoát</span>
            </button>
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-0.5">
                {room.players.map((p) => {
                  const v = VILLAGERS.find((x) => x.id === p.avatarId) || VILLAGERS[0];
                  const speaking = Boolean(voiceChat?.speakingPeers?.[p.id]);
                  return (
                    <div
                      key={p.id}
                      className={`px-panel-dark p-2 flex flex-col items-center relative ${
                        p.id === me?.id ? 'border-amber-400' : ''
                      } ${speaking ? 'ring-2 ring-emerald-400' : ''}`}
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
                      <PixelVillager avatarId={p.avatarId} size={56} enablePoke={true} staggerIndex={0} />
                      <div className="mt-1 text-xs font-bold truncate max-w-full text-center">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-amber-200/70 truncate max-w-full">{v.name}</div>
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
                    className={`shrink-0 p-1 rounded-lg border-2 cursor-pointer ${
                      me?.avatarId === v.id
                        ? 'border-[#d65539] bg-[#faf3e6]'
                        : 'border-[#3e322e] bg-[#efe5d2]/90 hover:bg-[#faf3e6]'
                    }`}
                    title={v.name}
                  >
                    <PixelVillager avatarId={v.id} size={34} still={true} />
                  </button>
                ))}
              </div>
            </div>

            {/* Lobby Chat Box */}
            <div className="px-panel p-3 flex flex-col gap-2">
              <div className="font-brand text-xs text-sky-300">💬 CHAT SẢNH CHỜ</div>
              <div className="px-panel-dark p-2 h-28 overflow-y-auto flex flex-col gap-1 text-xs">
                {(room.chat || []).length === 0 ? (
                  <div className="text-slate-500 text-center mt-6">Nhắn tin hoặc bật Mic để chém gió chờ bạn bè!</div>
                ) : (
                  (room.chat || []).map((m) => (
                    <div key={m.id}>
                      <b className="text-amber-300">{m.senderName}: </b>
                      <span className="text-slate-100">{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatText.trim()) return;
                  onSendChat?.('village', chatText.trim());
                  setChatText('');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Nhắn tin ngoài sảnh chờ..."
                  className="px-input flex-1 text-xs py-1.5"
                />
                <button type="submit" disabled={!chatText.trim()} className="px-btn bg-sky-400 text-black px-3 py-1.5 text-xs">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
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
                      <RoleIcon role={role} className="w-6 h-6 shrink-0" emojiClass="text-base leading-none" />
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
