import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Volume2, VolumeX, Copy, Check, MessageSquare, Mic, MicOff, Backpack, X } from 'lucide-react';
import { INTERACTIONS, PHASES, ROLES } from '../shared/constants.js';
import LobbyScreen, { HomeScreen } from './components/LobbyScreen.jsx';
import VillageArena from './components/VillageArena.jsx';
import RolePanel from './components/RolePanel.jsx';
import ChatVoicePanel from './components/ChatVoicePanel.jsx';
import GameOverModal from './components/GameOverModal.jsx';
import { useVoiceChat } from './hooks/useVoiceChat.js';
import { sfx } from './audio/sfx.js';

function getOrCreateClientId() {
  let id = localStorage.getItem('masoi_client_id');
  if (!id) {
    id = `cid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('masoi_client_id', id);
  }
  return id;
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [voicePerms, setVoicePerms] = useState(null);
  const [myId, setMyId] = useState(() => getOrCreateClientId());
  const [nowMs, setNowMs] = useState(Date.now());
  const [sfxMuted, setSfxMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Minimal HUD overlays
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roleOpen, setRoleOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedThrow, setSelectedThrow] = useState(null);

  const [suspectTags, setSuspectTags] = useState({});
  const [activeReactions, setActiveReactions] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [chatBubbles, setChatBubbles] = useState({}); // senderId -> { id, text }

  const prevPhaseRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  const initialRoomCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  }, []);

  useEffect(() => {
    const s = io({ transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('room:state', ({ room: nextRoom, voice }) => {
      setRoom(nextRoom);
      setVoicePerms(voice);
    });
    s.on('room:interaction', ({ id, fromId, targetId, itemId }) => {
      const item = INTERACTIONS.find((i) => i.id === itemId);
      if (item?.sfx) sfx.play(item.sfx);

      const rx = { id, targetId, itemId };
      setActiveReactions((prev) => [...prev, rx]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((x) => x.id !== id));
      }, 2100);

      if (item?.type === 'throw' && fromId !== targetId) {
        const proj = {
          id,
          itemId,
          fromOffsetX: (Math.random() - 0.5) * 260,
          fromOffsetY: 120,
          toOffsetX: (Math.random() - 0.5) * 180,
          toOffsetY: (Math.random() - 0.5) * 100 - 30,
        };
        setProjectiles((prev) => [...prev, proj]);
        setTimeout(() => {
          setProjectiles((prev) => prev.filter((x) => x.id !== id));
        }, 900);
      }
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Show speech bubbles over player heads when new chat arrives & track unread
  useEffect(() => {
    const list = room?.chat;
    if (!list || list.length === 0) return;
    const latest = list[list.length - 1];
    if (latest.id !== lastChatIdRef.current) {
      lastChatIdRef.current = latest.id;
      if (!chatOpenRef.current) {
        setUnreadCount((c) => c + 1);
      }
      setChatBubbles((prev) => ({
        ...prev,
        [latest.senderId]: { id: latest.id, text: latest.text },
      }));
      setTimeout(() => {
        setChatBubbles((prev) => {
          if (prev[latest.senderId]?.id !== latest.id) return prev;
          const copy = { ...prev };
          delete copy[latest.senderId];
          return copy;
        });
      }, 4200);
    }
  }, [room?.chat]);

  // Phase SFX & reset tags on new game
  useEffect(() => {
    if (!room) return;
    if (prevPhaseRef.current !== room.phase) {
      if (room.phase === PHASES.ROLE_REVEAL) {
        setSuspectTags({});
        setRoleOpen(true); // Briefly open role card on deal!
        sfx.play('pop');
      } else if (room.phase === PHASES.NIGHT) {
        setRoleOpen(false);
        sfx.play('wolf');
      } else if (room.phase === PHASES.DAWN) {
        sfx.play(room.pendingDeaths?.length > 0 ? 'death' : 'dawn');
      } else if (room.phase === PHASES.GAME_OVER) {
        sfx.play('dawn');
      }
      prevPhaseRef.current = room.phase;
    }
  }, [room?.phase, room?.pendingDeaths?.length]);

  const voiceChat = useVoiceChat({ socket, room, myId, voicePerms });
  const me = useMemo(() => room?.players?.find((p) => p.id === myId) || null, [room, myId]);

  const handleCreateRoom = ({ name, avatarId, will }, cb) => {
    socket?.emit('room:create', { clientId: myId, name, avatarId, will }, (res) => {
      if (res?.ok && res.playerId) {
        setMyId(res.playerId);
        window.history.replaceState({}, '', `?room=${res.code}`);
      }
      cb?.(res);
    });
  };

  const handleJoinRoom = ({ code, name, avatarId, will }, cb) => {
    socket?.emit('room:join', { code, clientId: myId, name, avatarId, will }, (res) => {
      if (res?.ok && res.playerId) {
        setMyId(res.playerId);
        window.history.replaceState({}, '', `?room=${res.code}`);
      }
      cb?.(res);
    });
  };

  const toggleMuteSfx = () => {
    sfx.muted = !sfxMuted;
    setSfxMuted(!sfxMuted);
  };

  const copyInvite = () => {
    if (!room) return;
    navigator.clipboard?.writeText(`${window.location.origin}?room=${room.code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSetSuspectTag = (playerId, tagId) => {
    setSuspectTags((prev) => {
      const next = { ...prev };
      if (!tagId) delete next[playerId];
      else next[playerId] = tagId;
      return next;
    });
  };

  if (!room) {
    return (
      <HomeScreen
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        initialCode={initialRoomCode}
      />
    );
  }

  const myRoleDef = room.selfPrivate?.role ? ROLES[room.selfPrivate.role] : null;
  const inGame = room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAME_OVER;

  return (
    <div className={inGame ? 'relative w-full h-dvh overflow-hidden' : 'min-h-dvh w-full flex flex-col'}>
      {/* Main Screen Switch */}
      {room.phase === PHASES.LOBBY ? (
        <div className="flex flex-col min-h-dvh">
          <header className="sticky top-0 z-30 px-3 h-11 bg-[#171324] border-b-2 border-[#0b0912] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-pixel-title text-xs sm:text-sm text-amber-300">🐺 MA SÓI PIXEL</span>
              <span
                className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}
              />
            </div>
            <button
              type="button"
              onClick={toggleMuteSfx}
              className="px-btn bg-[#272038] px-2 py-1 text-slate-200"
            >
              {sfxMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </header>
          <div className="flex-1 min-h-0">
            <LobbyScreen
              room={room}
              me={me}
              onUpdateProfile={(payload) => socket?.emit('room:updateProfile', payload)}
              onUpdateSettings={(payload) => socket?.emit('room:updateSettings', payload)}
              onBalanceRoles={() => socket?.emit('room:balanceRoles')}
              onAddBot={() => socket?.emit('room:addBot')}
              onRemovePlayer={(targetId) => socket?.emit('room:removePlayer', { targetId })}
              onStartGame={(cb) => socket?.emit('room:startGame', {}, cb)}
            />
          </div>
        </div>
      ) : room.phase === PHASES.GAME_OVER ? (
        <GameOverModal
          room={room}
          me={me}
          onAddRoastSticker={(targetId, stickerId) =>
            socket?.emit('game:addRoastSticker', { targetId, stickerId })
          }
          onReturnLobby={() => socket?.emit('room:returnLobby')}
        />
      ) : (
        /* FULLSCREEN CAMPFIRE VILLAGE ARENA */
        <div className="relative w-full h-full overflow-hidden">
          <VillageArena
            room={room}
            me={me}
            nowMs={nowMs}
            speakingPeers={voiceChat.speakingPeers}
            activeReactions={activeReactions}
            projectiles={projectiles}
            chatBubbles={chatBubbles}
            suspectTags={suspectTags}
            selectedThrow={selectedThrow}
            onClearThrow={() => setSelectedThrow(null)}
            onSetSuspectTag={handleSetSuspectTag}
            onNightCupid={(targets) => socket?.emit('game:nightCupid', { targets })}
            onNightGuard={(targetId) => socket?.emit('game:nightGuard', { targetId })}
            onNightWolfVote={(targetId, curseActive, lock) =>
              socket?.emit('game:nightWolfVote', { targetId, curseActive, lock })
            }
            onNightSeer={(targetId) => socket?.emit('game:nightSeer', { targetId })}
            onNightWitch={(payload) => socket?.emit('game:nightWitch', payload)}
            onHunterShot={(targetId) => socket?.emit('game:hunterShot', { targetId })}
            onDayVote={(targetId) => socket?.emit('game:dayVote', { targetId })}
            onExtendDiscuss={() => socket?.emit('game:extendDiscuss')}
            onVerdictVote={(choice) => socket?.emit('game:verdictVote', { choice })}
            onInteract={(targetId, itemId) => socket?.emit('room:interact', { targetId, itemId })}
          />

          {/* TOP-LEFT: Compact Role Card Icon */}
          <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoleOpen((o) => !o)}
              className="px-btn bg-[#231e30]/95 px-2.5 py-1.5 text-xs text-amber-300"
              title="Xem lại vai trò của bạn"
            >
              <span className="text-base leading-none">{myRoleDef?.icon || '👁️'}</span>
              <span className="hidden sm:inline">{myRoleDef?.name || 'Khán giả'}</span>
            </button>
          </div>

          {/* Floating Role Popover Card */}
          {roleOpen && (
            <div className="absolute top-12 left-2 z-40 w-72 sm:w-80">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleOpen(false)}
                  className="absolute -top-2 -right-2 z-50 w-6 h-6 rounded-full bg-rose-600 border-2 border-black text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <RolePanel
                  room={room}
                  me={me}
                  onRevealMayor={() => socket?.emit('game:revealMayor')}
                />
              </div>
            </div>
          )}

          {/* TOP-RIGHT: Invite & Sound Icons */}
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyInvite}
              className="px-btn bg-[#231e30]/95 px-2 py-1.5 text-[11px] text-sky-300"
              title={`Mã phòng #${room.code} — Copy link mời`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">#{room.code}</span>
            </button>
            <button
              type="button"
              onClick={toggleMuteSfx}
              className="px-btn bg-[#231e30]/95 p-1.5 text-slate-200"
              title={sfxMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* RIGHT SIDE: Floating Mic Button + Throwables Bag */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2.5">
            <button
              type="button"
              onClick={voiceChat.toggleMic}
              disabled={!voicePerms?.canSpeak && voiceChat.micPermission === 'granted'}
              className={`px-btn w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-xl ${
                voiceChat.micEnabled
                  ? voicePerms?.channel === 'wolf'
                    ? 'bg-red-600 text-white'
                    : voicePerms?.channel === 'dead'
                      ? 'bg-purple-500 text-white'
                      : 'bg-emerald-500 text-black'
                  : !voicePerms?.canSpeak && voiceChat.userMicWanted
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-[#251f36] text-rose-300'
              }`}
              title={voicePerms?.label || 'Bật/Tắt Mic'}
            >
              {voiceChat.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setBagOpen((b) => !b)}
              className={`px-btn w-11 h-11 rounded-full shadow-lg ${
                bagOpen || selectedThrow ? 'bg-amber-400 text-black' : 'bg-[#251f36] text-amber-300'
              }`}
              title="Túi đồ ném & biểu cảm"
            >
              <Backpack className="w-5 h-5" />
            </button>
          </div>

          {/* Floating Throwables & Emotes Palette */}
          {bagOpen && (
            <div className="absolute right-16 top-1/2 -translate-y-1/2 z-30 px-panel p-2 grid grid-cols-4 gap-1.5 max-w-[210px]">
              {INTERACTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.type === 'self') {
                      socket?.emit('room:interact', { targetId: me?.id, itemId: item.id });
                      setBagOpen(false);
                    } else {
                      setSelectedThrow((cur) => (cur === item.id ? null : item.id));
                      setBagOpen(false);
                    }
                  }}
                  className={`px-btn p-1.5 text-lg ${
                    selectedThrow === item.id ? 'bg-amber-400 text-black' : 'bg-[#1a1626]'
                  }`}
                  title={item.label}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}

          {/* BOTTOM: Toggle Chat Button & Slide-Up Chat Drawer */}
          {!chatOpen && inGame && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30">
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  setUnreadCount(0);
                }}
                className="px-btn bg-[#231e30]/95 px-4 py-2 text-xs text-amber-300 relative"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Mở Chat</span>
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {chatOpen && inGame && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 w-[95vw] max-w-xl h-[42vh] min-h-[220px] max-h-[340px]">
              <ChatVoicePanel
                room={room}
                me={me}
                voiceChat={voiceChat}
                onSendChat={(channel, text) => socket?.emit('chat:send', { channel, text })}
                onClose={() => setChatOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
