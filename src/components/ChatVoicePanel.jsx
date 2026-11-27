import React, { useEffect, useRef, useState } from 'react';
import { Send, Volume2, ScrollText, MessageSquare, History, X } from 'lucide-react';
import { PHASES } from '../../shared/constants.js';
import { isWolfRole } from '../utils/helpers.js';

export default function ChatVoicePanel({
  room,
  me,
  voiceChat,
  onSendChat,
  onClose,
}) {
  const [tab, setTab] = useState('chat'); // 'chat' | 'logs' | 'votes'
  const [text, setText] = useState('');
  const [showVolumes, setShowVolumes] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room.chat?.length, tab]);

  const isGameOverOrLobby = room.phase === PHASES.LOBBY || room.phase === PHASES.GAME_OVER;
  const canChat =
    isGameOverOrLobby ||
    !me?.alive ||
    me?.isSpectator ||
    room.phase !== PHASES.NIGHT ||
    isWolfRole(room.selfPrivate?.role);

  const activeChannel = isGameOverOrLobby
    ? 'village'
    : !me?.alive || me?.isSpectator
      ? 'dead'
      : room.phase === PHASES.NIGHT
        ? 'wolf'
        : 'village';

  const channelLabel =
    activeChannel === 'wolf'
      ? '🐺 Nhắn kênh kín Ma Sói...'
      : activeChannel === 'dead'
        ? '👻 Nhắn Cõi Âm...'
        : '🏡 Nhắn cả làng...';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || !canChat) return;
    onSendChat(activeChannel, text.trim());
    setText('');
  };

  const humanPeers = room.players.filter((p) => !p.isBot && p.id !== me?.id && p.connected);

  return (
    <div className="px-panel flex flex-col h-full min-h-0 overflow-hidden shadow-2xl">
      {/* Drawer Header Tabs + Close */}
      <div className="flex items-center border-b-2 border-[#0b0912] bg-[#161220] text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 cursor-pointer ${
            tab === 'chat' ? 'bg-[#2a243b] text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('logs')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 cursor-pointer ${
            tab === 'logs' ? 'bg-[#2a243b] text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          <ScrollText className="w-3.5 h-3.5" />
          <span>Diễn biến</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('votes')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 cursor-pointer ${
            tab === 'votes' ? 'bg-[#2a243b] text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Biên bản</span>
        </button>
        {humanPeers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowVolumes((v) => !v)}
            className="px-2.5 py-2 text-slate-300 hover:text-amber-300 cursor-pointer"
            title="Âm lượng Mic bạn bè"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-slate-300 hover:text-white cursor-pointer"
          title="Đóng khung chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showVolumes && humanPeers.length > 0 && (
        <div className="px-3 py-2 border-b border-black bg-[#1b1628] flex flex-col gap-1 max-h-24 overflow-y-auto">
          {humanPeers.map((peer) => (
            <div key={peer.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate max-w-[140px]">{peer.name}</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={voiceChat.peerVolumes[peer.id] ?? 1}
                onChange={(e) => voiceChat.setVolume(peer.id, parseFloat(e.target.value))}
                className="w-28 accent-amber-400"
              />
            </div>
          ))}
        </div>
      )}

      {/* Tab Body */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-0">
            {room.chat.length === 0 && (
              <div className="text-center text-xs text-slate-500 mt-4">
                Chưa có tin nhắn. Khi nhắn, bong bóng thoại sẽ hiện ngay trên đầu nhân vật!
              </div>
            )}
            {room.chat.map((msg) => {
              const isWolf = msg.channel === 'wolf';
              const isDead = msg.channel === 'dead';
              return (
                <div
                  key={msg.id}
                  className={`rounded px-2 py-1 text-xs break-words ${
                    isWolf
                      ? 'bg-red-950/60 border border-red-800/60 text-red-100'
                      : isDead
                        ? 'bg-purple-950/50 border border-purple-800/50 text-purple-200'
                        : 'bg-[#171321] border border-[#2f2842]'
                  }`}
                >
                  <span
                    className={`font-bold mr-1.5 ${
                      isWolf ? 'text-red-400' : isDead ? 'text-purple-300' : 'text-amber-300'
                    }`}
                  >
                    {isWolf ? '🐺 ' : isDead ? '👻 ' : ''}
                    {msg.senderName}:
                  </span>
                  <span className="text-slate-100">{msg.text}</span>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-2 border-t-2 border-[#0b0912] bg-[#161220] flex gap-1.5">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!canChat}
              placeholder={canChat ? channelLabel : '🌙 Ban đêm tắt chat...'}
              className="px-input flex-1 min-w-0 text-xs py-1.5"
            />
            <button
              type="submit"
              disabled={!canChat || !text.trim()}
              className="px-btn bg-amber-500 text-black px-3 py-1.5 text-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}

      {tab === 'logs' && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-0">
          {room.publicLogs.map((log) => (
            <div
              key={log.id}
              className="px-2 py-1.5 rounded text-xs leading-snug bg-[#171321] border border-[#2e2740] text-slate-200"
            >
              {log.text}
            </div>
          ))}
        </div>
      )}

      {tab === 'votes' && (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-0">
          {room.voteHistory.length === 0 ? (
            <div className="text-center text-xs text-slate-500 mt-4">
              Chưa có biên bản bỏ phiếu.
            </div>
          ) : (
            room.voteHistory.map((vh, idx) => (
              <div key={idx} className="px-panel-dark p-2 text-xs flex flex-col gap-1">
                <div className="font-bold text-amber-300">
                  Ngày {vh.day} — {vh.type === 'NOMINATION' ? 'Đề cử' : 'Phán quyết'}
                </div>
                <div className="text-slate-200">{vh.result}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(vh.votes || {}).map(([voterId, choice]) => {
                    const voter = room.players.find((p) => p.id === voterId);
                    const targetName =
                      choice === 'HANG'
                        ? '⚔️ Treo'
                        : choice === 'SPARE'
                          ? '🛡️ Tha'
                          : choice === 'skip'
                            ? 'Bỏ qua'
                            : room.players.find((p) => p.id === choice)?.name || '?';
                    return (
                      <span key={voterId} className="rounded bg-[#262038] px-1.5 py-0.5 text-[10px] text-slate-300">
                        {voter?.name} → <b>{targetName}</b>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
