import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { INTERACTIONS, PHASES, ROAST_STICKERS, ROLES, getBalancedRoles } from '../shared/constants.js';
import {
  applyDeathsWithChains,
  arrangeTrialFormation,
  assignLobbyRingPositions,
  canObserverSeeMovement,
  canPlayerMoveNow,
  checkEarlyNightComplete,
  checkLateNightComplete,
  checkWinCondition,
  computeVoicePermissions,
  createPlayer,
  createRoom,
  enterLateNight,
  enterNight,
  generateRoomCode,
  getActivePlayers,
  getAlivePlayers,
  isWolfRole,
  resolveNightToDawn,
  sanitizeRoomForPlayer,
  startGame,
  tallyDayNomination,
  tallyVerdict,
} from './gameEngine.js';
import { createBotPlayer, scheduleBotActions, stepRoomBotsTick } from './botEngine.js';
import { DEFAULT_MOVEMENT_CONFIG } from '../src/engine/movementConfig.js';
import { findMeleeTargetsInCone, resolveWorldCollisions } from '../src/engine/physics2d.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.json());
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const rooms = new Map(); // code -> room
const timers = new Map(); // code -> timeoutId
const socketIndex = new Map(); // socketId -> { roomCode, playerId }

function clearRoomTimer(code) {
  const t = timers.get(code);
  if (t) {
    clearTimeout(t);
    timers.delete(code);
  }
}

function setPhaseTimer(room, ms, fn) {
  clearRoomTimer(room.code);
  room.phaseEndsAt = Date.now() + ms;
  const t = setTimeout(() => {
    timers.delete(room.code);
    fn();
  }, ms);
  timers.set(room.code, t);
}

function broadcastRoom(room) {
  for (const player of room.players) {
    if (player.isBot || !player.socketId) continue;
    const sock = io.sockets.sockets.get(player.socketId);
    if (!sock) continue;
    sock.emit('room:state', {
      room: sanitizeRoomForPlayer(room, player.id),
      voice: computeVoicePermissions(room, player),
    });
  }
}

function broadcastSfx(room, sound, targetPlayerIds = null) {
  const filterSet = targetPlayerIds ? new Set(targetPlayerIds) : null;
  for (const player of room.players) {
    if (player.isBot || !player.socketId) continue;
    if (filterSet && !filterSet.has(player.id)) continue;
    io.to(player.socketId).emit('room:sfx', { sound });
  }
}

function broadcastNightEffect(room, actor, targetIds, effectType) {
  if (!room || room.phase !== PHASES.NIGHT || !actor) return;
  const actorIsWolf = isWolfRole(actor.role);
  for (const viewer of room.players) {
    if (viewer.isBot || !viewer.connected || !viewer.socketId) continue;
    const viewerIsDead = !viewer.alive || viewer.isSpectator;
    const allowed =
      viewerIsDead ||
      viewer.id === actor.id ||
      (actorIsWolf && viewer.alive && isWolfRole(viewer.role));
    if (!allowed) continue;
    io.to(viewer.socketId).emit('night:effect', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorId: actor.id,
      targetIds,
      effectType,
    });
  }
}

function triggerNightEarly(room) {
  enterNight(room);
  const earlyMs = Math.max(18000, Math.round(room.settings.nightSeconds * 650));
  setPhaseTimer(room, earlyMs, () => triggerNightLate(room));
  broadcastRoom(room);
  broadcastSfx(room, 'wolf');
  scheduleBotActions(room, botHandlers);
}

function triggerNightLate(room) {
  if (room.phase !== PHASES.NIGHT || room.nightStage !== 'EARLY') return;
  enterLateNight(room);
  if (room.nightActions.cursedConvertedId) {
    const wolfTargets = room.players
      .filter((p) => !p.isBot && (isWolfRole(p.role) || p.id === room.nightActions.cursedConvertedId))
      .map((p) => p.id);
    broadcastSfx(room, 'curse', wolfTargets);
  }
  // If nobody needs to act in Late Night, jump straight to Dawn after a brief beat
  if (checkLateNightComplete(room)) {
    const quickMs = 2000;
    setPhaseTimer(room, quickMs, () => triggerDawn(room));
    broadcastRoom(room);
    return;
  }
  const lateMs = Math.max(15000, Math.round(room.settings.nightSeconds * 450));
  setPhaseTimer(room, lateMs, () => triggerDawn(room));
  broadcastRoom(room);
  scheduleBotActions(room, botHandlers);
}

function triggerDawn(room) {
  if (room.phase !== PHASES.NIGHT) return;
  const deaths = resolveNightToDawn(room);
  setPhaseTimer(room, 4500, () => afterDawn(room));
  broadcastRoom(room);
  broadcastSfx(room, 'rooster');
  if (deaths.length > 0) {
    if (deaths.some((d) => d.cause === 'wolf')) {
      setTimeout(() => broadcastSfx(room, 'bite'), 850);
    } else if (deaths.some((d) => d.cause === 'poison')) {
      setTimeout(() => broadcastSfx(room, 'potion'), 850);
    }
    setTimeout(() => broadcastSfx(room, 'death'), 1350);
  }
}

function afterDawn(room) {
  if (room.hunterQueue.length > 0) {
    room.hunterReturnPhase = PHASES.DAY_DISCUSS;
    enterHunterShot(room);
    return;
  }
  const win = checkWinCondition(room);
  if (win) {
    enterGameOver(room);
    return;
  }
  enterDayDiscuss(room);
}

function enterHunterShot(room) {
  room.phase = PHASES.HUNTER_SHOT;
  const hunterId = room.hunterQueue[0];
  const hunter = room.players.find((p) => p.id === hunterId);
  room.publicLogs.push({
    id: Date.now() + Math.random(),
    day: room.dayCount,
    type: 'info',
    text: `🏹 Trước lúc ngã xuống, ${hunter?.name} rút súng chuẩn bị bắn kéo theo 1 người!`,
  });
  setPhaseTimer(room, 15000, () => {
    // Hunter timed out without shooting
    room.hunterQueue.shift();
    afterHunterShot(room);
  });
  broadcastRoom(room);
  scheduleBotActions(room, botHandlers);
}

function afterHunterShot(room) {
  if (room.hunterQueue.length > 0) {
    enterHunterShot(room);
    return;
  }
  const win = checkWinCondition(room);
  if (win) {
    enterGameOver(room);
    return;
  }
  if (room.hunterReturnPhase === PHASES.NIGHT) {
    room.dayCount += 1;
    triggerNightEarly(room);
  } else {
    enterDayDiscuss(room);
  }
}

function enterDayDiscuss(room) {
  room.phase = PHASES.DAY_DISCUSS;
  room.dayVotes = {};
  room.skipVotes = [];
  room.accusedId = null;
  room.verdictVotes = {};
  room.extensionUsedToday = false;
  setPhaseTimer(room, room.settings.discussSeconds * 1000, () => finishDayDiscuss(room));
  broadcastRoom(room);
  scheduleBotActions(room, botHandlers);
}

function finishDayDiscuss(room) {
  if (room.phase !== PHASES.DAY_DISCUSS) return;
  const accusedId = tallyDayNomination(room);
  if (!accusedId) {
    room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: room.dayCount,
      type: 'info',
      text: `⚖️ Không ai bị đưa lên giàn treo hôm nay. Làng chuẩn bị đón màn đêm.`,
    });
    room.dayCount += 1;
    triggerNightEarly(room);
    return;
  }

  room.accusedId = accusedId;
  room.phase = PHASES.DAY_DEFENSE;
  room.skipVotes = [];
  arrangeTrialFormation(room);
  const accused = room.players.find((p) => p.id === accusedId);
  room.publicLogs.push({
    id: Date.now() + Math.random(),
    day: room.dayCount,
    type: 'info',
    text: `🎙️ ${accused?.name} bị đưa lên bục và có ${room.settings.defenseSeconds} giây trăn trối cuối cùng!`,
  });
  setPhaseTimer(room, room.settings.defenseSeconds * 1000, () => enterDayVerdict(room));
  scheduleBotActions(room, botHandlers);
  broadcastRoom(room);
  broadcastSfx(room, 'drum');
}

function enterDayVerdict(room) {
  if (room.phase !== PHASES.DAY_DEFENSE) return;
  room.phase = PHASES.DAY_VERDICT;
  room.verdictVotes = {};
  setPhaseTimer(room, room.settings.verdictSeconds * 1000, () => finishDayVerdict(room));
  broadcastRoom(room);
  scheduleBotActions(room, botHandlers);
}

function finishDayVerdict(room) {
  if (room.phase !== PHASES.DAY_VERDICT) return;
  const { executed, jesterWon } = tallyVerdict(room);
  if (executed) {
    broadcastSfx(room, 'execution');
  }
  if (jesterWon) {
    enterGameOver(room);
    return;
  }
  if (executed && room.hunterQueue.length > 0) {
    room.hunterReturnPhase = PHASES.NIGHT;
    enterHunterShot(room);
    return;
  }
  const win = checkWinCondition(room);
  if (win) {
    enterGameOver(room);
    return;
  }
  room.dayCount += 1;
  triggerNightEarly(room);
}

function enterGameOver(room) {
  clearRoomTimer(room.code);
  room.phase = PHASES.GAME_OVER;
  room.phaseEndsAt = null;
  room.nightStage = null;
  broadcastRoom(room);
}

const botHandlers = {
  submitCupid(room, playerId, targets) {
    if (room.phase !== PHASES.NIGHT || room.nightStage !== 'EARLY' || room.dayCount !== 1) return;
    const p = room.players.find((x) => x.id === playerId && x.alive && x.role === 'cupid');
    if (!p || targets.length !== 2 || targets[0] === targets[1]) return;
    room.nightActions.cupidTargets = targets;
    broadcastNightEffect(room, p, targets, 'cupid');
    if (checkEarlyNightComplete(room)) triggerNightLate(room);
    else broadcastRoom(room);
  },
  submitGuard(room, playerId, targetId) {
    if (room.phase !== PHASES.NIGHT || room.nightStage !== 'EARLY' || room.villagePowersLost) return;
    const p = room.players.find((x) => x.id === playerId && x.alive && x.role === 'guard');
    if (!p || targetId === room.lastGuardedId) return;
    room.nightActions.guardTarget = targetId;
    room.nightActions.guardSubmitted = true;
    broadcastNightEffect(room, p, [targetId], 'guard');
    if (checkEarlyNightComplete(room)) triggerNightLate(room);
    else broadcastRoom(room);
  },
  submitWolfVote(room, playerId, targetId, curseActive = false, lock = false) {
    if (room.phase !== PHASES.NIGHT || room.nightStage !== 'EARLY') return;
    const p = room.players.find((x) => x.id === playerId && x.alive && isWolfRole(x.role));
    if (!p) return;
    if (targetId) {
      const t = room.players.find((x) => x.id === targetId && x.alive && !isWolfRole(x.role));
      if (!t) return;
      room.nightActions.wolfVotes[playerId] = targetId;
      if (lock) {
        broadcastNightEffect(room, p, [targetId], curseActive ? 'wolf_curse' : 'wolf_bite');
      }
    }
    if (p.role === 'cursed_wolf' && !room.cursedUsed) {
      room.nightActions.curseActive = Boolean(curseActive);
    }
    const aliveCursed = getAlivePlayers(room).some((w) => w.role === 'cursed_wolf' && !room.cursedUsed);
    if (lock && (!aliveCursed || p.role === 'cursed_wolf')) {
      room.nightActions.wolfLocked = true;
    }
    if (checkEarlyNightComplete(room)) triggerNightLate(room);
    else broadcastRoom(room);
  },
  submitSeer(room, playerId, targetId) {
    if (room.phase !== PHASES.NIGHT || room.nightStage !== 'LATE' || room.villagePowersLost) return;
    const p = room.players.find((x) => x.id === playerId && x.alive && x.role === 'seer');
    const target = room.players.find((x) => x.id === targetId && x.alive);
    if (!p || !target || room.nightActions.seerSubmitted) return;
    room.nightActions.seerTarget = targetId;
    room.nightActions.seerSubmitted = true;
    p.seerHistory.push({
      night: room.dayCount,
      targetId: target.id,
      targetName: target.name,
      isWolf: isWolfRole(target.role),
    });
    broadcastNightEffect(room, p, [target.id], 'seer');
    if (checkLateNightComplete(room)) triggerDawn(room);
    else broadcastRoom(room);
  },
  submitWitch(room, playerId, { heal, poisonTargetId }) {
    if (room.phase !== PHASES.NIGHT || room.nightStage !== 'LATE' || room.villagePowersLost) return;
    const p = room.players.find((x) => x.id === playerId && x.alive && x.role === 'witch');
    if (!p || room.nightActions.witchSubmitted) return;
    if (heal && p.witchHealLeft && room.nightActions.effectiveWolfVictim) {
      room.nightActions.witchHeal = true;
      broadcastNightEffect(room, p, [room.nightActions.effectiveWolfVictim], 'witch_heal');
    }
    if (poisonTargetId && p.witchPoisonLeft) {
      const t = room.players.find((x) => x.id === poisonTargetId && x.alive);
      if (t) {
        room.nightActions.witchPoisonTarget = t.id;
        broadcastNightEffect(room, p, [t.id], 'witch_poison');
      }
    }
    room.nightActions.witchSubmitted = true;
    if (checkLateNightComplete(room)) triggerDawn(room);
    else broadcastRoom(room);
  },
  submitHunterShot(room, playerId, targetId) {
    if (room.phase !== PHASES.HUNTER_SHOT || room.hunterQueue[0] !== playerId) return;
    const hunter = room.players.find((p) => p.id === playerId);
    const target = room.players.find((p) => p.id === targetId && p.alive);
    if (!hunter || !target) return;
    room.hunterQueue.shift();
    if (ROLES[target.role]?.team === 'village') {
      room.stats.shotVillager = hunter.id;
    }
    applyDeathsWithChains(room, [{ playerId: target.id, cause: 'hunter' }], 'DAY');
    room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: room.dayCount,
      type: 'death',
      text: `💥 ĐOÀNG! ${hunter.name} nổ phát súng cuối cùng hạ gục ${target.name}! (Vai trò vẫn được giữ kín)`,
    });
    room.secretLogs.push(`🏹 Thợ Săn ${hunter.name} bắn kéo theo ${target.name}.`);
    broadcastSfx(room, 'gunshot');
    afterHunterShot(room);
  },
  submitDayVote(room, playerId, targetId) {
    if (room.phase !== PHASES.DAY_DISCUSS) return;
    const p = room.players.find((x) => x.id === playerId && x.alive);
    if (!p) return;
    if (targetId === 'skip' || room.players.some((x) => x.id === targetId && x.alive)) {
      room.dayVotes[playerId] = targetId;
      const alive = getAlivePlayers(room);
      if (
        alive.every((a) => Boolean(room.dayVotes[a.id])) ||
        (alive.length > 0 && alive.every((a) => room.skipVotes?.includes(a.id)))
      ) {
        finishDayDiscuss(room);
      } else {
        broadcastRoom(room);
      }
    }
  },
  submitVerdict(room, playerId, choice) {
    if (room.phase !== PHASES.DAY_VERDICT || playerId === room.accusedId) return;
    const p = room.players.find((x) => x.id === playerId && x.alive);
    if (!p || !['HANG', 'SPARE'].includes(choice)) return;
    room.verdictVotes[playerId] = choice;
    const eligible = getAlivePlayers(room).filter((a) => a.id !== room.accusedId);
    if (eligible.every((a) => Boolean(room.verdictVotes[a.id]))) {
      finishDayVerdict(room);
    } else {
      broadcastRoom(room);
    }
  },
  sendChat(room, playerId, channel, text) {
    const sender = room.players.find((p) => p.id === playerId);
    if (!sender || !text || !text.trim()) return;
    const clean = text.trim().slice(0, 240);
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: sender.id,
      senderName: sender.name,
      senderAvatar: sender.avatarId,
      channel,
      text: clean,
      timestamp: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > 200) room.chat.shift();
    broadcastRoom(room);
  },
  sendInteraction(room, fromId, targetId, itemId) {
    const from = room.players.find((p) => p.id === fromId);
    const item = INTERACTIONS.find((i) => i.id === itemId);
    if (!from || !item) return;

    // Record interaction stats for endgame roast badges
    if (!room.stats.interactionsSent[fromId]) {
      room.stats.interactionsSent[fromId] = { hostile: 0, friendly: 0, love: 0, targets: {} };
    }
    const st = room.stats.interactionsSent[fromId];
    if (item.roastType === 'love') st.love += 1;
    if (item.roastType === 'friendly') st.friendly += 1;
    if (item.roastType === 'hostile') st.hostile += 1;
    if (targetId) {
      if (!st.targets[targetId]) st.targets[targetId] = [];
      st.targets[targetId].push(itemId);
    }

    for (const p of room.players) {
      if (p.isBot || !p.socketId) continue;
      io.to(p.socketId).emit('room:interaction', {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromId,
        fromName: from.name,
        targetId: item.type === 'self' ? fromId : targetId,
        itemId,
      });
    }
  },
};

io.on('connection', (socket) => {
  const getCtx = () => {
    const info = socketIndex.get(socket.id);
    if (!info) return null;
    const room = rooms.get(info.roomCode);
    if (!room) return null;
    const player = room.players.find((p) => p.id === info.playerId);
    if (!player) return null;
    return { room, player };
  };

  socket.on('room:create', ({ clientId, name, avatarId, will }, cb) => {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();
    const playerId = clientId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const player = createPlayer({ id: playerId, socketId: socket.id, name, avatarId, will });
    const room = createRoom(player, code);
    assignLobbyRingPositions(room.players);
    rooms.set(code, room);
    socketIndex.set(socket.id, { roomCode: code, playerId });
    broadcastRoom(room);
    cb?.({ ok: true, code, playerId });
  });

  socket.on('room:join', ({ code, clientId, name, avatarId, will }, cb) => {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) return cb?.({ ok: false, expired: true, error: 'Không tìm thấy phòng với mã này!' });

    // Check reconnect by clientId
    let existing = room.players.find((p) => p.id === clientId);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      if (room.phase === PHASES.LOBBY) {
        if (name) existing.name = name.trim().slice(0, 18) || existing.name;
        if (avatarId) existing.avatarId = avatarId;
        if (typeof will === 'string') existing.will = will.trim().slice(0, 140);
      }
      socketIndex.set(socket.id, { roomCode: cleanCode, playerId: existing.id });
      broadcastRoom(room);
      return cb?.({ ok: true, code: cleanCode, playerId: existing.id });
    }

    const playerId = clientId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isSpectator = room.phase !== PHASES.LOBBY;
    const player = createPlayer({
      id: playerId,
      socketId: socket.id,
      name,
      avatarId,
      will,
      isSpectator,
    });
    room.players.push(player);
    if (room.phase === PHASES.LOBBY) {
      room.settings.roleCounts = getBalancedRoles(room.players.length);
      assignLobbyRingPositions(room.players);
    }
    socketIndex.set(socket.id, { roomCode: cleanCode, playerId });
    broadcastRoom(room);
    cb?.({ ok: true, code: cleanCode, playerId, isSpectator });
  });

  socket.on('room:updateProfile', ({ name, avatarId, will }) => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.LOBBY) return;
    if (typeof name === 'string' && name.trim()) ctx.player.name = name.trim().slice(0, 18);
    if (avatarId) ctx.player.avatarId = avatarId;
    if (typeof will === 'string') ctx.player.will = will.trim().slice(0, 140);
    broadcastRoom(ctx.room);
  });

  socket.on('room:updateSettings', (newSettings) => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.LOBBY || ctx.room.hostId !== ctx.player.id) return;
    ctx.room.settings = {
      ...ctx.room.settings,
      ...newSettings,
      roleCounts: newSettings.roleCounts ? { ...newSettings.roleCounts } : ctx.room.settings.roleCounts,
    };
    broadcastRoom(ctx.room);
  });

  socket.on('room:balanceRoles', () => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.LOBBY || ctx.room.hostId !== ctx.player.id) return;
    ctx.room.settings.roleCounts = getBalancedRoles(ctx.room.players.length);
    broadcastRoom(ctx.room);
  });

  socket.on('room:addBot', () => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.LOBBY || ctx.room.hostId !== ctx.player.id) return;
    if (ctx.room.players.length >= 16) return;
    const bot = createBotPlayer(ctx.room.players, `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`);
    ctx.room.players.push(bot);
    ctx.room.settings.roleCounts = getBalancedRoles(ctx.room.players.length);
    assignLobbyRingPositions(ctx.room.players);
    broadcastRoom(ctx.room);
  });

  socket.on('room:removePlayer', ({ targetId }) => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.LOBBY || ctx.room.hostId !== ctx.player.id) return;
    if (targetId === ctx.player.id) return;
    ctx.room.players = ctx.room.players.filter((p) => p.id !== targetId);
    ctx.room.settings.roleCounts = getBalancedRoles(ctx.room.players.length);
    assignLobbyRingPositions(ctx.room.players);
    broadcastRoom(ctx.room);
  });

  socket.on('room:startGame', (_payload, cb) => {
    const ctx = getCtx();
    if (!ctx || ctx.room.hostId !== ctx.player.id) return;
    const res = startGame(ctx.room);
    if (res.error) return cb?.({ ok: false, error: res.error });
    setPhaseTimer(ctx.room, 6000, () => triggerNightEarly(ctx.room));
    broadcastRoom(ctx.room);
    cb?.({ ok: true });
  });

  socket.on('room:returnLobby', () => {
    const ctx = getCtx();
    if (!ctx || ctx.room.hostId !== ctx.player.id) return;
    clearRoomTimer(ctx.room.code);
    ctx.room.phase = PHASES.LOBBY;
    ctx.room.phaseEndsAt = null;
    ctx.room.nightStage = null;
    ctx.room.winner = null;
    for (const p of ctx.room.players) {
      p.isSpectator = false;
      p.alive = true;
      p.role = null;
      p.originalRole = null;
      p.mayorRevealed = false;
      p.deathInfo = null;
      p.convertedOnDay = null;
    }
    assignLobbyRingPositions(ctx.room.players);
    ctx.room.settings.roleCounts = getBalancedRoles(ctx.room.players.length);
    broadcastRoom(ctx.room);
  });

  socket.on('game:nightCupid', ({ targets }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitCupid(ctx.room, ctx.player.id, targets || []);
  });

  socket.on('game:nightGuard', ({ targetId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitGuard(ctx.room, ctx.player.id, targetId);
  });

  socket.on('game:nightWolfVote', ({ targetId, curseActive, lock }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitWolfVote(ctx.room, ctx.player.id, targetId, curseActive, lock);
  });

  socket.on('game:nightSeer', ({ targetId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitSeer(ctx.room, ctx.player.id, targetId);
  });

  socket.on('game:nightWitch', ({ heal, poisonTargetId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitWitch(ctx.room, ctx.player.id, { heal, poisonTargetId });
  });

  socket.on('game:hunterShot', ({ targetId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitHunterShot(ctx.room, ctx.player.id, targetId);
  });

  socket.on('game:revealMayor', () => {
    const ctx = getCtx();
    if (!ctx || !ctx.player.alive || ctx.player.role !== 'mayor' || ctx.player.mayorRevealed) return;
    if (![PHASES.DAY_DISCUSS, PHASES.DAY_DEFENSE, PHASES.DAY_VERDICT].includes(ctx.room.phase)) return;
    ctx.player.mayorRevealed = true;
    ctx.room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: ctx.room.dayCount,
      type: 'info',
      text: `🎖️ ${ctx.player.name} giơ cao Ấn Tín lộ diện là THỊ TRƯỞNG! Lá phiếu của họ giờ có sức nặng x2!`,
    });
    broadcastRoom(ctx.room);
  });

  socket.on('game:dayVote', ({ targetId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitDayVote(ctx.room, ctx.player.id, targetId);
  });

  socket.on('game:extendDiscuss', () => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.DAY_DISCUSS || ctx.room.extensionUsedToday) return;
    if (!ctx.player.alive) return;
    ctx.room.extensionUsedToday = true;
    const remaining = Math.max(1000, (ctx.room.phaseEndsAt || Date.now()) - Date.now());
    setPhaseTimer(ctx.room, remaining + 30000, () => finishDayDiscuss(ctx.room));
    ctx.room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: ctx.room.dayCount,
      type: 'info',
      text: `⏳ ${ctx.player.name} đã xin gia hạn thêm 30 giây thảo luận!`,
    });
    broadcastRoom(ctx.room);
  });

  socket.on('game:verdictVote', ({ choice }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.submitVerdict(ctx.room, ctx.player.id, choice);
  });

  socket.on('game:toggleSkip', () => {
    const ctx = getCtx();
    if (!ctx) return;
    const { room, player } = ctx;
    if (!player.alive || player.isSpectator) return;
    if (![PHASES.DAY_DISCUSS, PHASES.DAY_DEFENSE, PHASES.NIGHT].includes(room.phase)) return;

    if (!room.skipVotes) room.skipVotes = [];
    const idx = room.skipVotes.indexOf(player.id);
    if (idx >= 0) room.skipVotes.splice(idx, 1);
    else room.skipVotes.push(player.id);

    const alive = getAlivePlayers(room);
    if (alive.length > 0 && alive.every((a) => room.skipVotes.includes(a.id))) {
      if (room.phase === PHASES.DAY_DISCUSS) return finishDayDiscuss(room);
      if (room.phase === PHASES.DAY_DEFENSE) return enterDayVerdict(room);
      if (room.phase === PHASES.NIGHT && room.nightStage === 'EARLY') return triggerNightLate(room);
      if (room.phase === PHASES.NIGHT && room.nightStage === 'LATE') return triggerDawn(room);
    }
    broadcastRoom(room);
  });

  socket.on('room:leave', (_payload, cb) => {
    const ctx = getCtx();
    socketIndex.delete(socket.id);
    if (!ctx) return cb?.({ ok: true });
    const { room, player } = ctx;

    if (room.phase === PHASES.LOBBY || room.phase === PHASES.GAME_OVER || player.isSpectator) {
      room.players = room.players.filter((p) => p.id !== player.id);
      if (room.phase === PHASES.LOBBY) {
        room.settings.roleCounts = getBalancedRoles(room.players.length);
      }
    } else {
      player.alive = false;
      player.connected = false;
      player.socketId = null;
      player.deathInfo = { day: room.dayCount, phase: room.phase, cause: 'leave' };
      room.publicLogs.push({
        id: Date.now() + Math.random(),
        day: room.dayCount,
        type: 'info',
        text: `🚪 ${player.name} đã rời khỏi ngôi làng.`,
      });
    }

    if (room.hostId === player.id) {
      const nextHost = room.players.find((p) => !p.isBot && p.connected);
      if (nextHost) room.hostId = nextHost.id;
    }

    const anyHuman = room.players.some((p) => !p.isBot);
    if (!anyHuman) {
      clearRoomTimer(room.code);
      rooms.delete(room.code);
      return cb?.({ ok: true });
    }

    if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAME_OVER) {
      const win = checkWinCondition(room);
      if (win) {
        enterGameOver(room);
        return cb?.({ ok: true });
      }
    }

    broadcastRoom(room);
    cb?.({ ok: true });
  });

  socket.on('chat:send', ({ channel, text }) => {
    const ctx = getCtx();
    if (!ctx || !text) return;
    const { room, player } = ctx;
    const isGameOverOrLobby = room.phase === PHASES.LOBBY || room.phase === PHASES.GAME_OVER;
    let allowedChannel = 'village';
    if (!isGameOverOrLobby) {
      if (!player.alive || player.isSpectator) {
        allowedChannel = 'dead';
      } else if (room.phase === PHASES.NIGHT) {
        if (isWolfRole(player.role)) allowedChannel = 'wolf';
        else return; // Living non-wolves cannot chat during Night
      } else {
        allowedChannel = 'village';
      }
    }
    botHandlers.sendChat(room, player.id, allowedChannel, text);
  });

  socket.on('room:interact', ({ targetId, itemId }) => {
    const ctx = getCtx();
    if (!ctx) return;
    botHandlers.sendInteraction(ctx.room, ctx.player.id, targetId, itemId);
  });

  socket.on('player:move', ({ x, y, z, vx, vy, facing, anim }) => {
    const ctx = getCtx();
    if (!ctx) return;
    const { room, player } = ctx;
    if (!canPlayerMoveNow(room, player)) return;

    const resolved = resolveWorldCollisions(Number(x), Number(y), DEFAULT_MOVEMENT_CONFIG.colliderRadius, {
      ignoreObstacles: !player.alive || player.isSpectator,
    });
    player.x = resolved.x;
    player.y = resolved.y;
    player.z = Math.max(0, Math.min(260, Number(z) || 0));
    player.facing = facing < 0 ? -1 : 1;
    player.anim = typeof anim === 'string' ? anim.slice(0, 16) : 'idle';

    const wolfTransformed = room.phase === PHASES.NIGHT && player.alive && isWolfRole(player.role);
    for (const viewer of room.players) {
      if (viewer.isBot || !viewer.connected || !viewer.socketId || viewer.id === player.id) continue;
      if (!canObserverSeeMovement(room, viewer, player)) continue;
      io.to(viewer.socketId).volatile.emit('player:moved', {
        id: player.id,
        x: player.x,
        y: player.y,
        z: player.z,
        vx: Number(vx) || 0,
        vy: Number(vy) || 0,
        facing: player.facing,
        anim: player.anim,
        wolfTransformed,
      });
    }
  });

  socket.on('player:melee', ({ type, dirX, dirY }) => {
    const ctx = getCtx();
    if (!ctx) return;
    const { room, player } = ctx;
    const isKick = type === 'kick';
    const allowedPhase =
      [PHASES.LOBBY, PHASES.ROLE_REVEAL, PHASES.DAY_DISCUSS, PHASES.GAME_OVER].includes(room.phase) ||
      !player.alive;
    if (!allowedPhase) return;

    const now = Date.now();
    const minCd = isKick
      ? DEFAULT_MOVEMENT_CONFIG.kickCooldownMs * 0.7
      : DEFAULT_MOVEMENT_CONFIG.punchCooldownMs * 0.7;
    if (now - (player.lastMeleeAt || 0) < minCd) return;
    player.lastMeleeAt = now;

    const attackerIsGhost = !player.alive || player.isSpectator;
    const sameRealmTargets = room.players.filter(
      (p) => p.id !== player.id && !p.isSpectator && (attackerIsGhost ? !p.alive : p.alive)
    );
    const range = isKick ? DEFAULT_MOVEMENT_CONFIG.kickRange : DEFAULT_MOVEMENT_CONFIG.punchRange;
    const force = isKick ? DEFAULT_MOVEMENT_CONFIG.kickForce : DEFAULT_MOVEMENT_CONFIG.punchForce;
    const vz = isKick ? DEFAULT_MOVEMENT_CONFIG.kickJumpVz : 0;

    const hitsRaw = findMeleeTargetsInCone({
      attacker: player,
      actors: sameRealmTargets,
      dirX: Number(dirX) || (player.facing >= 0 ? 1 : -1),
      dirY: Number(dirY) || 0,
      range,
    }).slice(0, isKick ? 3 : 2);

    const hits = hitsRaw.map((h) => {
      const kx = Math.round(h.nx * force);
      const ky = Math.round(h.ny * force);
      if (h.target.isBot) {
        const pushed = resolveWorldCollisions(h.target.x + kx * 0.14, h.target.y + ky * 0.14);
        h.target.x = pushed.x;
        h.target.y = pushed.y;
      }
      return { targetId: h.target.id, kx, ky, vz };
    });

    const payload = {
      id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
      attackerId: player.id,
      type: isKick ? 'kick' : 'punch',
      dirX: Number(dirX) || (player.facing >= 0 ? 1 : -1),
      dirY: Number(dirY) || 0,
      hits,
    };

    for (const viewer of room.players) {
      if (viewer.isBot || !viewer.connected || !viewer.socketId) continue;
      if (viewer.id === player.id || canObserverSeeMovement(room, viewer, player)) {
        io.to(viewer.socketId).emit('player:meleeHit', payload);
      }
    }
  });

  socket.on('game:addRoastSticker', ({ targetId, stickerId }) => {
    const ctx = getCtx();
    if (!ctx || ctx.room.phase !== PHASES.GAME_OVER) return;
    if (!ROAST_STICKERS.some((s) => s.id === stickerId)) return;
    if (!ctx.room.endgameStickers[targetId]) ctx.room.endgameStickers[targetId] = [];
    const list = ctx.room.endgameStickers[targetId];
    if (!list.some((s) => s.stickerId === stickerId && s.fromId === ctx.player.id)) {
      list.push({ stickerId, fromId: ctx.player.id, fromName: ctx.player.name });
      broadcastRoom(ctx.room);
    }
  });

  socket.on('voice:chunk', ({ audio, level }) => {
    const ctx = getCtx();
    if (!ctx || !audio) return;
    const byteLen = audio.byteLength || audio.length || 0;
    if (byteLen < 5 || byteLen > 16384) return;

    const perms = computeVoicePermissions(ctx.room, ctx.player);
    if (!perms.canSpeak || !perms.audibleToPeerIds?.length) return;

    const audibleSet = new Set(perms.audibleToPeerIds);
    for (const target of ctx.room.players) {
      if (target.isBot || !target.connected || !target.socketId || target.id === ctx.player.id) continue;
      if (!audibleSet.has(target.id)) continue;
      const targetPerms = computeVoicePermissions(ctx.room, target);
      if (!targetPerms.hearablePeerIds.includes(ctx.player.id)) continue;
      io.to(target.socketId).emit('voice:chunk', {
        fromId: ctx.player.id,
        audio,
        level: typeof level === 'number' ? level : 1,
      });
    }
  });

  socket.on('webrtc:signal', ({ toPlayerId, signal }) => {
    const ctx = getCtx();
    if (!ctx) return;
    const target = ctx.room.players.find((p) => p.id === toPlayerId && p.connected && p.socketId);
    if (!target) return;
    io.to(target.socketId).emit('webrtc:signal', {
      fromPlayerId: ctx.player.id,
      signal,
    });
  });

  socket.on('disconnect', () => {
    const ctx = getCtx();
    socketIndex.delete(socket.id);
    if (!ctx) return;
    ctx.player.connected = false;
    ctx.player.socketId = null;

    // Transfer host if needed
    if (ctx.room.hostId === ctx.player.id) {
      const nextHost = ctx.room.players.find((p) => !p.isBot && p.connected);
      if (nextHost) ctx.room.hostId = nextHost.id;
    }

    // Clean up empty rooms after 30 minutes
    const anyHuman = ctx.room.players.some((p) => !p.isBot && p.connected);
    if (!anyHuman) {
      setTimeout(() => {
        const r = rooms.get(ctx.room.code);
        if (r && !r.players.some((p) => !p.isBot && p.connected)) {
          clearRoomTimer(r.code);
          rooms.delete(r.code);
        }
      }, 30 * 60 * 1000);
    }

    broadcastRoom(ctx.room);
  });
});

const PORT = process.env.PORT || 3001;
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.isBot)) {
      stepRoomBotsTick(room, io, 0.14);
    }
  }
}, 140);

server.listen(PORT, () => {
  console.log(`Ma Cho server listening on http://localhost:${PORT}`);
});
