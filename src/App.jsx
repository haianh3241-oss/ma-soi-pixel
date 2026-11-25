import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  SlidersHorizontal,
  Copy,
  Check,
  MessageSquare,
  Mic,
  MicOff,
  Backpack,
  X,
  LogOut,
  ClipboardList,
} from 'lucide-react';
import { INTERACTIONS, PHASES, ROLES } from '../shared/constants.js';
import LobbyScreen, { HomeScreen } from './components/LobbyScreen.jsx';
import VillageArena from './components/VillageArena.jsx';
import RolePanel from './components/RolePanel.jsx';
import ChatVoicePanel from './components/ChatVoicePanel.jsx';
import GameOverModal from './components/GameOverModal.jsx';
import AudioMixerModal from './components/AudioMixerModal.jsx';
import RoleDeckModal from './components/RoleDeckModal.jsx';
import ArtStudioPreview from './components/ArtStudioPreview.jsx';
import RoleIcon from './components/RoleIcon.jsx';
import { useVoiceChat } from './hooks/useVoiceChat.js';
import { sfx } from './audio/sfx.js';

const SESSION_KEY = 'macho_active_session';

function getOrCreateClientId() {
  let id = localStorage.getItem('masoi_client_id');
  if (!id) {
    id = `cid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('masoi_client_id', id);
  }
  return id;
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [voicePerms, setVoicePerms] = useState(null);
  const [myId, setMyId] = useState(() => getOrCreateClientId());
  const [nowMs, setNowMs] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  // Overlays
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roleOpen, setRoleOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedThrow, setSelectedThrow] = useState(null);
  const [artStudioMode, setArtStudioMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === 'art';
  });

  const [suspectTags, setSuspectTags] = useState({});
  const [activeReactions, setActiveReactions] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [chatBubbles, setChatBubbles] = useState({});

  const prevPhaseRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const chatOpenRef = useRef(chatOpen);
  const socketRef = useRef(null);
  chatOpenRef.current = chatOpen;

  const initialRoomCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  }, []);

  // Unlock WebAudio on first tap/click
  useEffect(() => {
    const unlock = () => sfx.ensureCtx();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const attemptRejoin = useCallback((sock) => {
    const sess = readSession();
    if (!sess || !sess.code || !sock?.connected) return;
    sock.emit(
      'room:join',
      {
        code: sess.code,
        clientId: sess.clientId,
        name: sess.name,
        avatarId: sess.avatarId,
        will: sess.will || '',
      },
      (res) => {
        if (res?.ok && res.playerId) {
          setMyId(res.playerId);
          window.history.replaceState({}, '', `?room=${res.code}`);
        } else if (res?.expired) {
          saveSession(null);
          setRoom(null);
        }
      }
    );
  }, []);

  useEffect(() => {
    const s = io({ transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      attemptRejoin(s);
    });
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
  }, [attemptRejoin]);

  // Rejoin automatically when returning from another tab or mobile app (Zalo/Messenger)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const s = socketRef.current;
        if (s && !s.connected) {
          s.connect();
        } else if (s?.connected) {
          attemptRejoin(s);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [attemptRejoin]);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Chat bubbles & unread badge
  useEffect(() => {
    const list = room?.chat;
    if (!list || list.length === 0) return;
    const latest = list[list.length - 1];
    if (latest.id !== lastChatIdRef.current) {
      lastChatIdRef.current = latest.id;
      if (!chatOpenRef.current) setUnreadCount((c) => c + 1);
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

  // Phase SFX (Rooster crow on Dawn, Dog/Wolf howl on Night) & BGM mode switching
  useEffect(() => {
    if (!room) {
      sfx.setBgmMode('off');
      prevPhaseRef.current = null;
      return;
    }

    if (room.phase === PHASES.LOBBY || room.phase === PHASES.GAME_OVER) {
      sfx.setBgmMode('lobby');
    } else if (room.phase === PHASES.NIGHT) {
      sfx.setBgmMode('night');
    } else {
      sfx.setBgmMode('day');
    }

    if (prevPhaseRef.current !== room.phase) {
      if (room.phase === PHASES.ROLE_REVEAL) {
        setSuspectTags({});
        setRoleOpen(true);
        sfx.play('pop');
      } else if (room.phase === PHASES.NIGHT) {
        setRoleOpen(false);
        sfx.play('wolf');
      } else if (room.phase === PHASES.DAWN) {
        sfx.play('rooster');
        if (room.pendingDeaths?.length > 0) {
          setTimeout(() => sfx.play('death'), 950);
        }
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
        saveSession({ code: res.code, clientId: res.playerId, name, avatarId, will });
        window.history.replaceState({}, '', `?room=${res.code}`);
      }
      cb?.(res);
    });
  };

  const handleJoinRoom = ({ code, name, avatarId, will }, cb) => {
    socket?.emit('room:join', { code, clientId: myId, name, avatarId, will }, (res) => {
      if (res?.ok && res.playerId) {
        setMyId(res.playerId);
        saveSession({ code: res.code, clientId: res.playerId, name, avatarId, will });
        window.history.replaceState({}, '', `?room=${res.code}`);
      }
      cb?.(res);
    });
  };

  const executeLeaveRoom = () => {
    socket?.emit('room:leave', {}, () => {
      saveSession(null);
      setLeaveConfirm(false);
      setRoom(null);
      setVoicePerms(null);
      setChatOpen(false);
      setRoleOpen(false);
      setDeckOpen(false);
      window.history.replaceState({}, '', window.location.pathname);
    });
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

  if (artStudioMode) {
    return (
      <ArtStudioPreview
        onExit={() => {
          setArtStudioMode(false);
          const params = new URLSearchParams(window.location.search);
          if (params.get('preview') === 'art') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  if (!room) {
    return (
      <HomeScreen
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onOpenArtStudio={() => setArtStudioMode(true)}
        initialCode={initialRoomCode}
      />
    );
  }

  const myRoleDef = room.selfPrivate?.role ? ROLES[room.selfPrivate.role] : null;
  const inGame = room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAME_OVER;

  return (
    <div className={inGame ? 'relative w-full h-dvh overflow-hidden' : 'min-h-dvh w-full flex flex-col'}>
      {room.phase === PHASES.LOBBY ? (
        <div className="flex flex-col min-h-dvh">
          <header className="sticky top-0 z-30 px-3 h-12 bg-[#161a2d] border-b-2 border-[#0b0d17] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-brand text-sm sm:text-base text-amber-300">🐺 MA CHÓ</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setMixerOpen(true)}
              className="ggd-btn bg-[#272f52] px-3 py-1.5 text-xs text-slate-100"
              title="Điều chỉnh Nhạc nền, Hiệu ứng & Voice"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
              <span>Âm thanh</span>
            </button>
          </header>
          <div className="flex-1 min-h-0 flex flex-col">
            <LobbyScreen
              room={room}
              me={me}
              voiceChat={voiceChat}
              onSendChat={(channel, text) => socket?.emit('chat:send', { channel, text })}
              onLeaveRoom={executeLeaveRoom}
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
          onLeaveRoom={executeLeaveRoom}
        />
      ) : (
        /* 2.5D TOP-DOWN VILLAGE ARENA */
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
            onToggleSkip={() => socket?.emit('game:toggleSkip')}
            onExtendDiscuss={() => socket?.emit('game:extendDiscuss')}
            onVerdictVote={(choice) => socket?.emit('game:verdictVote', { choice })}
            onInteract={(targetId, itemId) => socket?.emit('room:interact', { targetId, itemId })}
          />

          {/* TOP-LEFT: Glossy Blue Role Card + Role Deck Overview */}
          <div className="absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoleOpen((o) => !o)}
              className="sc-btn-blue px-2.5 py-2 text-xs"
              title="Xem vai trò của bạn"
            >
              {myRoleDef ? (
                <RoleIcon role={myRoleDef} className="w-5 h-5 shrink-0" emojiClass="text-base leading-none" />
              ) : (
                <span className="text-base leading-none">👁️</span>
              )}
              <span className="hidden sm:inline">{myRoleDef?.name || 'Khán giả'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDeckOpen(true)}
              className="ggd-btn bg-[#1f274a]/95 px-2.5 py-2 text-xs text-sky-300"
              title="Xem ván này có những role gì"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Role ván này</span>
            </button>
          </div>

          {roleOpen && (
            <div className="absolute top-12 left-2 z-[260] w-72 sm:w-80">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleOpen(false)}
                  className="absolute -top-2 -right-2 z-[270] w-6 h-6 rounded-full bg-rose-600 border-2 border-[#111322] text-white flex items-center justify-center cursor-pointer"
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

          {/* TOP-RIGHT: Invite, Audio Mixer, Leave Room */}
          <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5">
            <button
              type="button"
              onClick={copyInvite}
              className="ggd-btn bg-[#1f2542]/95 px-2.5 py-1.5 text-xs text-sky-300"
              title={`Mã phòng #${room.code}`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">#{room.code}</span>
            </button>
            <button
              type="button"
              onClick={() => setMixerOpen(true)}
              className="ggd-btn bg-[#1f2542]/95 p-1.5 text-amber-300"
              title="Cài đặt âm thanh (Nhạc nền / SFX / Voice)"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLeaveConfirm(true)}
              className="ggd-btn bg-rose-600/95 p-1.5 text-white"
              title="Thoát phòng"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* RIGHT SIDE: Supercell Double-Ring Mic + Throw Bag */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-2.5">
            <button
              type="button"
              onClick={voiceChat.toggleMic}
              disabled={!voicePerms?.canSpeak && voiceChat.micPermission === 'granted'}
              className={`sc-btn-mic w-14 h-14 shadow-xl ${
                voiceChat.micEnabled
                  ? voicePerms?.channel === 'wolf'
                    ? 'bg-gradient-to-b from-red-500 to-red-700 text-white'
                    : voicePerms?.channel === 'dead'
                      ? 'bg-gradient-to-b from-purple-400 to-purple-700 text-white'
                      : 'bg-gradient-to-b from-emerald-400 to-green-600 text-white'
                  : !voicePerms?.canSpeak && voiceChat.userMicWanted
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-gradient-to-b from-[#2a3357] to-[#171c34] text-rose-300'
              }`}
              title={voicePerms?.label || 'Bật/Tắt Mic'}
            >
              {voiceChat.micEnabled ? <Mic className="w-6 h-6 drop-shadow" /> : <MicOff className="w-6 h-6" />}
            </button>

            <button
              type="button"
              onClick={() => setBagOpen((b) => !b)}
              className={`ggd-btn w-11 h-11 rounded-full shadow-lg ${
                bagOpen || selectedThrow ? 'bg-amber-400 text-black' : 'bg-[#1f274a] text-amber-300'
              }`}
              title="Túi đồ ném & biểu cảm"
            >
              <Backpack className="w-5 h-5" />
            </button>
          </div>

          {bagOpen && (
            <div className="absolute right-16 top-1/2 -translate-y-1/2 z-[250] ggd-card p-2 grid grid-cols-4 gap-1.5 max-w-[216px]">
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
                  className={`ggd-btn p-1.5 text-lg ${
                    selectedThrow === item.id ? 'bg-amber-400 text-black' : 'bg-[#15192e]'
                  }`}
                  title={item.label}
                >
                  {item.emoji}
                </button>
              ))}
            </div>
          )}

          {/* BOTTOM-LEFT: Glossy Blue Chat Button & Slide-Up Chat Drawer */}
          {!chatOpen && inGame && (
            <div className="absolute bottom-3 left-3 z-40">
              <button
                type="button"
                onClick={() => {
                  setChatOpen(true);
                  setUnreadCount(0);
                }}
                className="sc-btn-blue px-3.5 py-2.5 text-xs"
                title="Mở Khung Chat"
              >
                <MessageSquare className="w-5 h-5" />
                <span className="hidden sm:inline">Mở Chat</span>
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-rose-600 border border-black px-1.5 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {chatOpen && inGame && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[280] w-[95vw] max-w-xl h-[42vh] min-h-[220px] max-h-[340px]">
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

      {/* Modals */}
      {deckOpen && <RoleDeckModal room={room} onClose={() => setDeckOpen(false)} />}
      {mixerOpen && (
        <AudioMixerModal
          room={room}
          me={me}
          voiceChat={voiceChat}
          onClose={() => setMixerOpen(false)}
        />
      )}
      {leaveConfirm && (
        <div
          onClick={() => setLeaveConfirm(false)}
          className="fixed inset-0 z-[300] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div onClick={(e) => e.stopPropagation()} className="ggd-card w-full max-w-xs p-4 text-center flex flex-col gap-3">
            <div className="font-extrabold text-base text-rose-300">🚪 Thoát khỏi ván đấu?</div>
            <p className="text-xs text-slate-300">
              Bạn sẽ rời khỏi phòng #{room.code} và quay về trang chủ Ma Chó.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setLeaveConfirm(false)}
                className="ggd-btn bg-[#272f52] text-white px-4 py-2 text-xs"
              >
                Ở lại chơi
              </button>
              <button
                type="button"
                onClick={executeLeaveRoom}
                className="ggd-btn bg-rose-600 text-white px-4 py-2 text-xs"
              >
                Thoát ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
