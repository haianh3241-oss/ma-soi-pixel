import { INTERACTIONS, PHASES, VILLAGERS } from '../shared/constants.js';
import { canObserverSeeMovement, getAlivePlayers, isWolfRole } from './gameEngine.js';
import { getRingSpawnPosition } from '../src/engine/movementConfig.js';
import { resolveWorldCollisions } from '../src/engine/physics2d.js';

const BOT_NAMES = [
  'Bác Ba Phi',
  'Chí Phèo',
  'Thị Nở',
  'Cậu Vàng',
  'Lão Hạc',
  'Chú Cuội',
  'Cô Tấm',
  'Thằng Bờm',
  'Ông Giáo',
  'Bà Tám',
  'Sơn Tinh',
  'Thủy Tinh',
];

const BOT_WILLS = [
  'Nếu tôi chết, chắc chắn là thằng bên cạnh cắn!',
  'Vô tội nhé cả làng, đừng vote nhầm tui tội nghiệp!',
  'Ai hay cụng bia với tui nhất là đáng nghi nhất.',
  'Di chúc để lại: một chiếc điếu cày tre và 3 chỉ vàng.',
  'Chết thì thôi, kiếp sau vẫn làm dân làng lương thiện!',
  'Đừng tin lời bất kỳ ai cười nhiều quá trong ván này.',
];

export function createBotPlayer(existingPlayers, id) {
  const usedNames = new Set(existingPlayers.map((p) => p.name));
  const availableNames = BOT_NAMES.filter((n) => !usedNames.has(n));
  const name =
    availableNames.length > 0
      ? availableNames[Math.floor(Math.random() * availableNames.length)]
      : `Bot ${existingPlayers.length + 1}`;

  const usedAvatars = new Set(existingPlayers.map((p) => p.avatarId));
  const availableAvatars = VILLAGERS.filter((v) => !usedAvatars.has(v.id));
  const avatar =
    availableAvatars.length > 0
      ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
      : VILLAGERS[Math.floor(Math.random() * VILLAGERS.length)];

  const idx = existingPlayers.filter((p) => !p.isSpectator).length;
  const spawn = getRingSpawnPosition(idx, Math.max(6, idx + 1), 0.92);

  return {
    id,
    socketId: null,
    name: `${name} (Bot)`,
    avatarId: avatar.id,
    will: BOT_WILLS[Math.floor(Math.random() * BOT_WILLS.length)],
    isBot: true,
    isSpectator: false,
    connected: true,
    alive: true,
    role: null,
    originalRole: null,
    elderLives: 1,
    mayorRevealed: false,
    witchHealLeft: false,
    witchPoisonLeft: false,
    seerHistory: [],
    deathInfo: null,
    x: spawn.x,
    y: spawn.y,
    z: 0,
    facing: spawn.x <= 800 ? 1 : -1,
    anim: 'idle',
    sleepOrigin: { x: spawn.x, y: spawn.y },
    botTarget: null,
    botNextPickAt: 0,
  };
}

/**
 * Điều khiển Bot AI đi dạo quanh Sân Đình ban ngày / Sảnh chờ,
 * và hóa Sói / vai chức năng chạy tới mục tiêu vào ban đêm!
 */
export function stepRoomBotsTick(room, io, dt = 0.14) {
  if (!room) return;
  const now = Date.now();
  const isFreeRoam = [PHASES.LOBBY, PHASES.ROLE_REVEAL, PHASES.DAY_DISCUSS].includes(room.phase);
  const isNight = room.phase === PHASES.NIGHT;
  if (!isFreeRoam && !isNight) return;

  const bots = room.players.filter((p) => p.isBot && !p.isSpectator);
  for (const bot of bots) {
    let shouldWalk = false;
    let speed = 185;

    if (!bot.alive) {
      // Bot đã chết hóa Hồn Ma bay lơ lửng quanh sân
      shouldWalk = true;
      speed = 165;
    } else if (isFreeRoam) {
      shouldWalk = true;
      speed = room.phase === PHASES.LOBBY ? 210 : 175;
    } else if (isNight) {
      if (isWolfRole(bot.role)) {
        shouldWalk = true;
        speed = 265;
      } else if (!room.villagePowersLost) {
        if (
          room.nightStage === 'EARLY' &&
          ((bot.role === 'guard' && !room.nightActions.guardSubmitted) ||
            (bot.role === 'cupid' && room.dayCount === 1 && room.nightActions.cupidTargets.length < 2))
        ) {
          shouldWalk = true;
          speed = 230;
        } else if (
          room.nightStage === 'LATE' &&
          ((bot.role === 'seer' && !room.nightActions.seerSubmitted) ||
            (bot.role === 'witch' && !room.nightActions.witchSubmitted && (bot.witchHealLeft || bot.witchPoisonLeft)))
        ) {
          shouldWalk = true;
          speed = 230;
        }
      }
    }

    if (!shouldWalk) {
      if (bot.anim !== (isNight && bot.alive ? 'sleep' : 'idle')) {
        bot.anim = isNight && bot.alive ? 'sleep' : 'idle';
      }
      continue;
    }

    if (!bot.botTarget || now >= (bot.botNextPickAt || 0)) {
      if (now < (bot.botPauseUntil || 0)) {
        if (bot.anim !== 'idle') bot.anim = 'idle';
        continue;
      }
      if (!isNight && Math.random() < 0.35) {
        bot.botPauseUntil = now + 900 + Math.random() * 1400;
        bot.botNextPickAt = bot.botPauseUntil;
        bot.anim = 'idle';
        continue;
      }
      // Pick random point inside Sân Đình ring or near a victim during Night
      if (isNight && bot.alive && !bot.botTarget) {
        const candidates = room.players.filter((x) => x.id !== bot.id && x.alive && !x.isSpectator);
        const pick = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        if (pick) {
          bot.botTarget = {
            x: (pick.sleepOrigin?.x ?? pick.x) + (Math.random() - 0.5) * 60,
            y: (pick.sleepOrigin?.y ?? pick.y) + (Math.random() - 0.5) * 50,
          };
          bot.botNextPickAt = now + 2200;
        }
      } else {
        const ang = Math.random() * Math.PI * 2;
        const r = 120 + Math.random() * 340;
        bot.botTarget = {
          x: 800 + Math.cos(ang) * r,
          y: 552 + Math.sin(ang) * (r * 0.56),
        };
        bot.botNextPickAt = now + 1800 + Math.random() * 2400;
      }
    }

    if (!bot.botTarget) continue;
    const dx = bot.botTarget.x - (bot.x ?? 800);
    const dy = bot.botTarget.y - (bot.y ?? 650);
    const dist = Math.hypot(dx, dy);
    if (dist < 18) {
      bot.botTarget = null;
      bot.anim = bot.alive ? 'idle' : 'ghost';
      bot.botPauseUntil = now + 700 + Math.random() * 1300;
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      const nextPos = resolveWorldCollisions(bot.x + nx * speed * dt, bot.y + ny * speed * dt, 22, {
        ignoreObstacles: !bot.alive,
      });
      bot.x = nextPos.x;
      bot.y = nextPos.y;
      bot.facing = Math.abs(nx) > 0.1 ? (nx > 0 ? 1 : -1) : bot.facing || 1;
      bot.anim = !bot.alive ? 'ghost' : speed > 240 ? 'run' : 'walk';
    }

    const wolfTransformed = isNight && bot.alive && isWolfRole(bot.role);
    for (const viewer of room.players) {
      if (viewer.isBot || !viewer.connected || !viewer.socketId) continue;
      if (!canObserverSeeMovement(room, viewer, bot)) continue;
      io.to(viewer.socketId).volatile.emit('player:moved', {
        id: bot.id,
        x: Math.round(bot.x),
        y: Math.round(bot.y),
        z: bot.alive ? 0 : 16,
        vx: 0,
        vy: 0,
        facing: bot.facing,
        anim: bot.anim,
        wolfTransformed,
      });
    }
  }
}

export function scheduleBotActions(room, handlers) {
  const bots = getAlivePlayers(room).filter((p) => p.isBot);
  if (bots.length === 0) return;

  const markBotReady = (botId) => {
    if (!room.skipVotes) room.skipVotes = [];
    if (!room.skipVotes.includes(botId)) room.skipVotes.push(botId);
  };

  const alive = getAlivePlayers(room);
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (room.phase === PHASES.NIGHT) {
    for (const bot of bots) markBotReady(bot.id);
    if (room.nightStage === 'EARLY') {
      for (const bot of bots) {
        if (bot.role === 'cupid' && room.dayCount === 1 && room.nightActions.cupidTargets.length < 2) {
          const pool = [...alive].sort(() => Math.random() - 0.5);
          if (pool.length >= 2) {
            setTimeout(() => {
              if (room.phase === PHASES.NIGHT && room.nightStage === 'EARLY') {
                handlers.submitCupid(room, bot.id, [pool[0].id, pool[1].id]);
              }
            }, 900 + Math.random() * 1200);
          }
        }
        if (bot.role === 'guard' && !room.nightActions.guardSubmitted && !room.villagePowersLost) {
          const pool = alive.filter((p) => p.id !== room.lastGuardedId);
          if (pool.length > 0) {
            const target = pickRandom(pool);
            setTimeout(() => {
              if (room.phase === PHASES.NIGHT && room.nightStage === 'EARLY') {
                handlers.submitGuard(room, bot.id, target.id);
              }
            }, 1000 + Math.random() * 1400);
          }
        }
        if (isWolfRole(bot.role) && !room.nightActions.wolfVotes[bot.id]) {
          const targets = alive.filter((p) => !isWolfRole(p.role));
          if (targets.length > 0) {
            const target = pickRandom(targets);
            bot.botTarget = { x: target.sleepOrigin?.x ?? target.x, y: target.sleepOrigin?.y ?? target.y };
            bot.botNextPickAt = Date.now() + 2600;
            setTimeout(() => {
              if (room.phase === PHASES.NIGHT && room.nightStage === 'EARLY') {
                const useCurse = bot.role === 'cursed_wolf' && !room.cursedUsed && Math.random() < 0.25;
                handlers.submitWolfVote(room, bot.id, target.id, useCurse, true);
              }
            }, 1400 + Math.random() * 1400);
          }
        }
      }
    } else if (room.nightStage === 'LATE') {
      for (const bot of bots) {
        if (bot.role === 'seer' && !room.nightActions.seerSubmitted && !room.villagePowersLost) {
          const pool = alive.filter((p) => p.id !== bot.id && !bot.seerHistory.some((h) => h.targetId === p.id));
          const target = pickRandom(pool.length > 0 ? pool : alive.filter((p) => p.id !== bot.id));
          if (target) {
            setTimeout(() => {
              if (room.phase === PHASES.NIGHT && room.nightStage === 'LATE') {
                handlers.submitSeer(room, bot.id, target.id);
              }
            }, 900 + Math.random() * 1200);
          }
        }
        if (bot.role === 'witch' && !room.nightActions.witchSubmitted && !room.villagePowersLost) {
          setTimeout(() => {
            if (room.phase === PHASES.NIGHT && room.nightStage === 'LATE') {
              const victimId = room.nightActions.effectiveWolfVictim;
              const heal = Boolean(victimId && bot.witchHealLeft && Math.random() < 0.65);
              let poisonId = null;
              if (!heal && bot.witchPoisonLeft && room.dayCount >= 2 && Math.random() < 0.35) {
                const pool = alive.filter((p) => p.id !== bot.id && p.id !== victimId);
                if (pool.length > 0) poisonId = pickRandom(pool).id;
              }
              handlers.submitWitch(room, bot.id, { heal, poisonTargetId: poisonId });
            }
          }, 1100 + Math.random() * 1400);
        }
      }
    }
  } else if (room.phase === PHASES.HUNTER_SHOT) {
    const hunterId = room.hunterQueue[0];
    const hunter = room.players.find((p) => p.id === hunterId);
    if (hunter && hunter.isBot) {
      const pool = alive.filter((p) => p.id !== hunter.id);
      if (pool.length > 0) {
        setTimeout(() => {
          if (room.phase === PHASES.HUNTER_SHOT && room.hunterQueue[0] === hunter.id) {
            handlers.submitHunterShot(room, hunter.id, pickRandom(pool).id);
          }
        }, 1400);
      }
    }
  } else if (room.phase === PHASES.DAY_DISCUSS) {
    for (const bot of bots) {
      // Bots occasionally send a chat message or throw a funny emoji
      if (Math.random() < 0.45) {
        setTimeout(() => {
          if (room.phase === PHASES.DAY_DISCUSS && bot.alive) {
            const lines = isWolfRole(bot.role)
              ? ['Tôi là dân hiền lành nhé mọi người!', 'Đêm qua im ắng quá, nghi ai đây?', 'Đừng nhìn tôi, tui vô tội!']
              : ['Tối qua ai khả nghi nhất nhỉ?', 'Cứ bình tĩnh suy luận rồi vote!', 'Thị trưởng nhớ dùng 2 phiếu chuẩn nhé!'];
            handlers.sendChat(room, bot.id, 'village', pickRandom(lines));
          }
        }, 1500 + Math.random() * 4000);
      }

      if (Math.random() < 0.35 && alive.length > 1) {
        setTimeout(() => {
          if (room.phase === PHASES.DAY_DISCUSS && bot.alive) {
            const target = pickRandom(alive.filter((p) => p.id !== bot.id));
            const throwables = INTERACTIONS.filter((i) => i.type === 'throw');
            const item = pickRandom(throwables);
            handlers.sendInteraction(room, bot.id, target.id, item.id);
          }
        }, 2500 + Math.random() * 5000);
      }

      // Vote
      setTimeout(() => {
        if (room.phase === PHASES.DAY_DISCUSS && bot.alive && !room.dayVotes[bot.id]) {
          let targetChoice = 'skip';
          if (isWolfRole(bot.role)) {
            const nonWolves = alive.filter((p) => !isWolfRole(p.role));
            if (nonWolves.length > 0 && Math.random() < 0.78) {
              targetChoice = pickRandom(nonWolves).id;
            }
          } else {
            const knownWolf =
              bot.role === 'seer' && bot.seerHistory.find((h) => h.isWolf && alive.some((a) => a.id === h.targetId));
            if (knownWolf) {
              targetChoice = knownWolf.targetId;
            } else if (Math.random() < 0.72) {
              const others = alive.filter((p) => p.id !== bot.id);
              if (others.length > 0) targetChoice = pickRandom(others).id;
            }
          }
          markBotReady(bot.id);
          handlers.submitDayVote(room, bot.id, targetChoice);
        }
      }, 4500 + Math.random() * 5500);
    }
  } else if (room.phase === PHASES.DAY_DEFENSE) {
    for (const bot of bots) {
      if (bot.id !== room.accusedId) markBotReady(bot.id);
    }
  } else if (room.phase === PHASES.DAY_VERDICT) {
    for (const bot of bots) {
      if (bot.id === room.accusedId) continue;
      setTimeout(() => {
        if (room.phase === PHASES.DAY_VERDICT && bot.alive && !room.verdictVotes[bot.id]) {
          const accused = room.players.find((p) => p.id === room.accusedId);
          let choice = Math.random() < 0.55 ? 'HANG' : 'SPARE';
          if (isWolfRole(bot.role) && accused && isWolfRole(accused.role)) {
            choice = 'SPARE';
          }
          handlers.submitVerdict(room, bot.id, choice);
        }
      }, 1500 + Math.random() * 3500);
    }
  }
}
