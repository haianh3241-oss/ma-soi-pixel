import { INTERACTIONS, PHASES, VILLAGERS } from '../shared/constants.js';
import { getAlivePlayers, isWolfRole } from './gameEngine.js';

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
  };
}

export function scheduleBotActions(room, handlers) {
  const bots = getAlivePlayers(room).filter((p) => p.isBot);
  if (bots.length === 0) return;

  const alive = getAlivePlayers(room);
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (room.phase === PHASES.NIGHT) {
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
            setTimeout(() => {
              if (room.phase === PHASES.NIGHT && room.nightStage === 'EARLY') {
                const useCurse = bot.role === 'cursed_wolf' && !room.cursedUsed && Math.random() < 0.25;
                handlers.submitWolfVote(room, bot.id, target.id, useCurse, true);
              }
            }, 1200 + Math.random() * 1500);
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
          handlers.submitDayVote(room, bot.id, targetChoice);
        }
      }, 4500 + Math.random() * 5500);
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
