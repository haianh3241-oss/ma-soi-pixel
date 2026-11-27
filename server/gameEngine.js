import { PHASES, ROLES, VILLAGERS, getBalancedRoles } from '../shared/constants.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(hostPlayer, code) {
  return {
    code,
    hostId: hostPlayer.id,
    phase: PHASES.LOBBY,
    nightStage: null, // 'EARLY' | 'LATE'
    dayCount: 0,
    phaseEndsAt: null,
    extensionUsedToday: false,
    players: [hostPlayer],
    settings: {
      roleCounts: getBalancedRoles(6),
      mayorMode: 'hidden', // 'hidden' | 'reveal'
      discussSeconds: 90,
      nightSeconds: 35,
      defenseSeconds: 15,
      verdictSeconds: 15,
      enableWills: true,
    },
    // Secret game state (never leaked to clients prematurely)
    lovers: [], // [id1, id2]
    lastGuardedId: null,
    cursedUsed: false,
    villagePowersLost: false,
    nightActions: createEmptyNightActions(),
    pendingDeaths: [], // [{ playerId, cause }]
    hunterQueue: [], // playerIds of hunters needing to shoot
    hunterReturnPhase: null, // 'DAY_DISCUSS' | 'NIGHT'
    dayVotes: {}, // voterId -> targetId | 'skip'
    skipVotes: [], // playerIds ready to skip current phase
    accusedId: null,
    verdictVotes: {}, // voterId -> 'HANG' | 'SPARE'
    voteHistory: [], // [{ day, type, accusedId, votes, result }]
    publicLogs: [], // [{ id, day, text, type }]
    secretLogs: [], // revealed only at GAME_OVER
    stats: {
      interactionsSent: {}, // playerId -> { hostile: n, friendly: n, love: n, targets: { targetId: [type] } }
      accurateWolfVotes: {}, // playerId -> count
      badVillageVotes: {}, // playerId -> count
      votedJester: [], // playerIds
      poisonedSeer: null,
      shotVillager: null,
      lynchedElder: false,
      wolfBetrayedFriend: [],
    },
    winner: null, // { team, title, reason, winners: [id] }
    endgameStickers: {}, // targetId -> [{ stickerId, fromName }]
    chat: [], // filtered per recipient on emit
  };
}

export function createEmptyNightActions() {
  return {
    cupidTargets: [], // [id1, id2]
    guardTarget: null,
    guardSubmitted: false,
    wolfVotes: {}, // wolfId -> targetId
    wolfLocked: false,
    curseActive: false,
    cursedResolvedVictim: null,
    witchHeal: false,
    witchPoisonTarget: null,
    witchSubmitted: false,
    seerTarget: null,
    seerSubmitted: false,
  };
}

export function createPlayer({ id, socketId, name, avatarId, will = '', isBot = false, isSpectator = false }) {
  return {
    id,
    socketId,
    name: name.trim().slice(0, 18) || 'Dân Làng',
    avatarId: VILLAGERS.some((v) => v.id === avatarId) ? avatarId : VILLAGERS[0].id,
    will: (will || '').trim().slice(0, 140),
    isBot,
    isSpectator,
    connected: true,
    alive: !isSpectator,
    role: null,
    originalRole: null,
    elderLives: 1,
    mayorRevealed: false,
    witchHealLeft: false,
    witchPoisonLeft: false,
    seerHistory: [], // [{ night, targetId, targetName, isWolf }]
    deathInfo: null, // { day, phase, cause }
  };
}

export function getAlivePlayers(room) {
  return room.players.filter((p) => !p.isSpectator && p.alive);
}

export function getActivePlayers(room) {
  return room.players.filter((p) => !p.isSpectator);
}

export function isWolfRole(role) {
  return role === 'werewolf' || role === 'cursed_wolf';
}

export function getVoteWeight(room, player) {
  if (!player || !player.alive) return 0;
  if (player.role === 'mayor' && !room.villagePowersLost) {
    if (room.settings.mayorMode === 'hidden' || player.mayorRevealed) {
      return 2;
    }
  }
  return 1;
}

export function startGame(room) {
  const active = room.players.map((p) => {
    p.isSpectator = false;
    p.alive = true;
    p.role = null;
    p.originalRole = null;
    p.elderLives = 1;
    p.mayorRevealed = false;
    p.witchHealLeft = false;
    p.witchPoisonLeft = false;
    p.seerHistory = [];
    p.deathInfo = null;
    p.convertedOnDay = null;
    return p;
  });

  if (active.length < 4) {
    return { error: 'Cần ít nhất 4 người chơi (hoặc thêm Bot) để bắt đầu ván đấu!' };
  }

  // Build role deck matching exact player count
  const counts = { ...room.settings.roleCounts };
  let deck = [];
  for (const [roleId, count] of Object.entries(counts)) {
    const n = Math.max(0, Number(count) || 0);
    for (let i = 0; i < n; i++) deck.push(roleId);
  }

  if (deck.length !== active.length) {
    const balanced = getBalancedRoles(active.length);
    deck = [];
    for (const [roleId, count] of Object.entries(balanced)) {
      for (let i = 0; i < count; i++) deck.push(roleId);
    }
    room.settings.roleCounts = balanced;
  }

  const hasWolf = deck.some((r) => isWolfRole(r));
  if (!hasWolf) {
    return { error: 'Bộ vai trò phải có ít nhất 1 Ma Sói hoặc Sói Nguyền!' };
  }

  deck = shuffle(deck);
  active.forEach((p, idx) => {
    const r = deck[idx];
    p.role = r;
    p.originalRole = r;
    if (r === 'elder') p.elderLives = 2;
    if (r === 'witch') {
      p.witchHealLeft = true;
      p.witchPoisonLeft = true;
    }
  });

  room.phase = PHASES.ROLE_REVEAL;
  room.nightStage = null;
  room.dayCount = 1;
  room.extensionUsedToday = false;
  room.lovers = [];
  room.lastGuardedId = null;
  room.cursedUsed = false;
  room.villagePowersLost = false;
  room.nightActions = createEmptyNightActions();
  room.pendingDeaths = [];
  room.hunterQueue = [];
  room.hunterReturnPhase = null;
  room.dayVotes = {};
  room.skipVotes = [];
  room.accusedId = null;
  room.verdictVotes = {};
  room.voteHistory = [];
  room.publicLogs = [
    {
      id: Date.now(),
      day: 0,
      type: 'system',
      text: `Ván đấu bắt đầu với ${active.length} dân làng! Hãy kiểm tra kỹ vai trò bí mật của bạn.`,
    },
  ];
  room.secretLogs = [];
  room.stats = {
    interactionsSent: {},
    accurateWolfVotes: {},
    badVillageVotes: {},
    votedJester: [],
    poisonedSeer: null,
    shotVillager: null,
    lynchedElder: false,
    wolfBetrayedFriend: [],
  };
  room.winner = null;
  room.endgameStickers = {};
  room.chat = [];
  return { ok: true };
}

export function enterNight(room) {
  room.phase = PHASES.NIGHT;
  room.nightStage = 'EARLY';
  room.nightActions = createEmptyNightActions();
  room.dayVotes = {};
  room.skipVotes = [];
  room.skipVotes = [];
  room.accusedId = null;
  room.verdictVotes = {};
  room.extensionUsedToday = false;
  room.publicLogs.push({
    id: Date.now() + Math.random(),
    day: room.dayCount,
    type: 'night',
    text: `🌙 Đêm thứ ${room.dayCount} buông xuống. Cả làng chìm vào giấc ngủ...`,
  });
}

export function checkEarlyNightComplete(room) {
  const alive = getAlivePlayers(room);
  const cupidNeeded =
    room.dayCount === 1 &&
    !room.villagePowersLost &&
    alive.some((p) => p.role === 'cupid') &&
    room.nightActions.cupidTargets.length < 2;

  const guardNeeded =
    !room.villagePowersLost &&
    alive.some((p) => p.role === 'guard') &&
    !room.nightActions.guardSubmitted;

  const aliveWolves = alive.filter((p) => isWolfRole(p.role));
  const wolvesDone =
    aliveWolves.length === 0 ||
    (aliveWolves.every((w) => room.nightActions.wolfVotes[w.id]) &&
      (!aliveWolves.some((w) => w.role === 'cursed_wolf') || room.cursedUsed || room.nightActions.wolfLocked));

  return !cupidNeeded && !guardNeeded && wolvesDone;
}

export function computeWolfTarget(room) {
  const votes = Object.values(room.nightActions.wolfVotes).filter(Boolean);
  if (votes.length === 0) return null;
  const counts = {};
  for (const v of votes) counts[v] = (counts[v] || 0) + 1;
  let max = 0;
  let top = [];
  for (const [id, c] of Object.entries(counts)) {
    if (c > max) {
      max = c;
      top = [id];
    } else if (c === max) {
      top.push(id);
    }
  }
  const chosen = top[Math.floor(Math.random() * top.length)];
  const p = room.players.find((pl) => pl.id === chosen);
  return p && p.alive ? chosen : null;
}

export function enterLateNight(room) {
  // Lock wolf target & Cupid lovers before Witch/Seer act
  const na = room.nightActions;
  if (room.dayCount === 1 && na.cupidTargets.length === 2 && room.lovers.length === 0) {
    room.lovers = [...na.cupidTargets];
    const [a, b] = room.lovers.map((id) => room.players.find((p) => p.id === id)?.name);
    room.secretLogs.push(`💘 Đêm 1: Thần Tình Yêu ghép đôi ${a} & ${b}.`);
  }

  const victimId = computeWolfTarget(room);
  na.lockedWolfVictim = victimId;

  // Check if Guard blocked the wolf bite or Cursed Wolf turns them
  const guarded = victimId && victimId === na.guardTarget;
  const victim = room.players.find((p) => p.id === victimId);

  if (guarded) {
    na.effectiveWolfVictim = null; // saved by Guard!
    room.secretLogs.push(`🛡️ Đêm ${room.dayCount}: Bảo Vệ đã che chở thành công cho ${victim?.name}.`);
  } else if (victim && na.curseActive && !room.cursedUsed && victim.role !== 'elder') {
    na.effectiveWolfVictim = null;
    na.cursedConvertedId = victim.id;
    room.cursedUsed = true;
    victim.role = 'werewolf';
    victim.convertedOnDay = room.dayCount;
    room.secretLogs.push(`🩸 Đêm ${room.dayCount}: Sói Nguyền đã nguyền rủa biến ${victim.name} thành Ma Sói!`);
  } else if (victim && victim.role === 'elder' && victim.elderLives > 1) {
    na.effectiveWolfVictim = null;
    victim.elderLives -= 1;
    room.secretLogs.push(`👴 Đêm ${room.dayCount}: Ma Sói cắn Già Làng ${victim.name} nhưng ông còn 1 mạng dự phòng!`);
  } else {
    na.effectiveWolfVictim = victimId;
  }

  room.nightStage = 'LATE';
  room.skipVotes = [];
}

export function checkLateNightComplete(room) {
  const alive = getAlivePlayers(room);
  const seerNeeded =
    !room.villagePowersLost &&
    alive.some((p) => p.role === 'seer') &&
    !room.nightActions.seerSubmitted;

  const witchNeeded =
    !room.villagePowersLost &&
    alive.some((p) => p.role === 'witch' && (p.witchHealLeft || p.witchPoisonLeft)) &&
    !room.nightActions.witchSubmitted;

  return !seerNeeded && !witchNeeded;
}

export function resolveNightToDawn(room) {
  const na = room.nightActions;
  if (na.guardTarget) {
    room.lastGuardedId = na.guardTarget;
  } else {
    room.lastGuardedId = null;
  }

  const deaths = [];
  const addDeath = (playerId, cause) => {
    if (!playerId || deaths.some((d) => d.playerId === playerId)) return;
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || !p.alive) return;
    deaths.push({ playerId, cause });
  };

  // Wolf bite
  if (na.effectiveWolfVictim) {
    const witch = room.players.find((p) => p.alive && p.role === 'witch');
    if (na.witchHeal && witch && witch.witchHealLeft && !room.villagePowersLost) {
      witch.witchHealLeft = false;
      const saved = room.players.find((p) => p.id === na.effectiveWolfVictim);
      room.secretLogs.push(`🧪 Đêm ${room.dayCount}: Phù Thủy đã dùng bình Cứu cho ${saved?.name}.`);
    } else {
      addDeath(na.effectiveWolfVictim, 'wolf');
      const v = room.players.find((p) => p.id === na.effectiveWolfVictim);
      room.secretLogs.push(`🐺 Đêm ${room.dayCount}: Ma Sói đã hạ sát ${v?.name}.`);

      // Check betrayal stat (bit someone who sent them beer/flower/heart)
      for (const [wolfId, targetId] of Object.entries(na.wolfVotes)) {
        if (targetId === na.effectiveWolfVictim) {
          const sentToTarget = room.stats.interactionsSent[na.effectiveWolfVictim]?.targets?.[wolfId] || [];
          const wolfSentToVictim = room.stats.interactionsSent[wolfId]?.targets?.[na.effectiveWolfVictim] || [];
          if (
            sentToTarget.some((t) => ['beer', 'flower', 'heart'].includes(t)) ||
            wolfSentToVictim.some((t) => ['beer', 'flower', 'heart'].includes(t))
          ) {
            room.stats.wolfBetrayedFriend.push(wolfId);
          }
        }
      }
    }
  }

  // Witch poison
  if (na.witchPoisonTarget && !room.villagePowersLost) {
    const witch = room.players.find((p) => p.alive && p.role === 'witch');
    if (witch && witch.witchPoisonLeft) {
      witch.witchPoisonLeft = false;
      addDeath(na.witchPoisonTarget, 'poison');
      const poisoned = room.players.find((p) => p.id === na.witchPoisonTarget);
      room.secretLogs.push(`☠️ Đêm ${room.dayCount}: Phù Thủy hạ độc ${poisoned?.name}.`);
      if (poisoned?.role === 'seer') {
        room.stats.poisonedSeer = witch.id;
      }
    }
  }

  // Apply deaths + lover chain + elder penalty
  const finalDeaths = applyDeathsWithChains(room, deaths, 'NIGHT');

  room.phase = PHASES.DAWN;
  room.nightStage = null;
  room.pendingDeaths = finalDeaths;

  if (finalDeaths.length === 0) {
    room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: room.dayCount,
      type: 'dawn',
      text: `☀️ Bình minh ngày ${room.dayCount}: Một đêm bình yên! Không có ai thiệt mạng.`,
    });
  } else {
    const names = finalDeaths.map((d) => room.players.find((p) => p.id === d.playerId)?.name).join(', ');
    room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: room.dayCount,
      type: 'death',
      text: `☀️ Bình minh ngày ${room.dayCount}: Làng bàng hoàng phát hiện ${names} đã thiệt mạng! (Vai trò được giữ kín)`,
    });
  }

  return finalDeaths;
}

export function applyDeathsWithChains(room, initialDeaths, phaseLabel) {
  const applied = [];
  const queue = [...initialDeaths];

  while (queue.length > 0) {
    const { playerId, cause } = queue.shift();
    const p = room.players.find((pl) => pl.id === playerId);
    if (!p || !p.alive) continue;

    p.alive = false;
    p.deathInfo = { day: room.dayCount, phase: phaseLabel, cause };
    applied.push({ playerId: p.id, name: p.name, cause, will: room.settings.enableWills ? p.will : '' });

    // Elder penalty if killed by village (lynch, poison, hunter)
    if (p.role === 'elder' && ['lynch', 'poison', 'hunter'].includes(cause)) {
      room.villagePowersLost = true;
      if (cause === 'lynch') room.stats.lynchedElder = true;
      room.secretLogs.push(`⚡ Bi kịch! Già Làng ${p.name} chết bởi phe Dân -> Mất toàn bộ chức năng phe Dân!`);
    }

    // Hunter shot queue (if powers not lost)
    if (p.role === 'hunter' && !room.villagePowersLost) {
      if (!room.hunterQueue.includes(p.id)) {
        room.hunterQueue.push(p.id);
      }
    }

    // Lover chain
    if (room.lovers.length === 2 && room.lovers.includes(p.id)) {
      const partnerId = room.lovers.find((id) => id !== p.id);
      const partner = room.players.find((pl) => pl.id === partnerId);
      if (partner && partner.alive) {
        room.secretLogs.push(`💔 ${partner.name} chết theo người thương ${p.name}!`);
        queue.push({ playerId: partner.id, cause: 'love' });
      }
    }
  }

  return applied;
}

export function checkWinCondition(room) {
  if (room.winner) return room.winner;

  const alive = getAlivePlayers(room);
  const aliveWolves = alive.filter((p) => isWolfRole(p.role));
  const aliveOthers = alive.filter((p) => !isWolfRole(p.role));

  // Check Lovers (if 2 alive and both are lovers, or 2 lovers where 1 is wolf and 1 is village and only they remain)
  if (
    room.lovers.length === 2 &&
    alive.length === 2 &&
    alive.every((p) => room.lovers.includes(p.id))
  ) {
    const roles = alive.map((p) => p.role);
    const mixed = roles.some((r) => isWolfRole(r)) && roles.some((r) => !isWolfRole(r));
    if (mixed) {
      room.winner = {
        team: 'lovers',
        title: '💘 CẶP ĐÔI CHIẾN THẮNG!',
        reason: 'Cặp đôi Dân - Sói đã vượt qua mọi sóng gió để sống sót cuối cùng!',
        winners: [...room.lovers],
      };
      return room.winner;
    }
  }

  if (aliveWolves.length === 0) {
    room.winner = {
      team: 'village',
      title: '🏡 PHE DÂN LÀNG CHIẾN THẮNG!',
      reason: 'Toàn bộ Ma Sói trong làng đã bị tiêu diệt!',
      winners: getActivePlayers(room)
        .filter((p) => ROLES[p.role]?.team === 'village')
        .map((p) => p.id),
    };
    return room.winner;
  }

  if (aliveWolves.length >= aliveOthers.length) {
    room.winner = {
      team: 'wolf',
      title: '🐺 PHE MA SÓI CHIẾN THẮNG!',
      reason: 'Số lượng Ma Sói đã áp đảo phần còn lại của ngôi làng!',
      winners: getActivePlayers(room)
        .filter((p) => isWolfRole(p.role))
        .map((p) => p.id),
    };
    return room.winner;
  }

  return null;
}

export function tallyDayNomination(room) {
  const alive = getAlivePlayers(room);
  const tally = {}; // targetId | 'skip' -> weight

  for (const p of alive) {
    const choice = room.dayVotes[p.id];
    if (!choice) continue;
    const w = getVoteWeight(room, p);
    tally[choice] = (tally[choice] || 0) + w;
  }

  let maxWeight = 0;
  let topChoices = [];
  for (const [target, w] of Object.entries(tally)) {
    if (w > maxWeight) {
      maxWeight = w;
      topChoices = [target];
    } else if (w === maxWeight) {
      topChoices.push(target);
    }
  }

  // Track vote history (public record)
  const recordVotes = {};
  for (const p of alive) {
    if (room.dayVotes[p.id]) {
      recordVotes[p.id] = room.dayVotes[p.id];
    }
  }

  if (topChoices.length !== 1 || topChoices[0] === 'skip' || maxWeight === 0) {
    room.voteHistory.push({
      day: room.dayCount,
      type: 'NOMINATION',
      votes: recordVotes,
      result: 'Không có ai bị đưa lên giàn treo (Hòa phiếu hoặc Bỏ qua).',
    });
    return null;
  }

  const accusedId = topChoices[0];
  const accused = room.players.find((p) => p.id === accusedId);
  room.voteHistory.push({
    day: room.dayCount,
    type: 'NOMINATION',
    accusedId,
    votes: recordVotes,
    result: `${accused?.name} bị đề cử lên bục trăn trối (${maxWeight} phiếu).`,
  });

  // Track voting stats
  for (const [voterId, targetId] of Object.entries(recordVotes)) {
    const target = room.players.find((p) => p.id === targetId);
    if (target && isWolfRole(target.role)) {
      room.stats.accurateWolfVotes[voterId] = (room.stats.accurateWolfVotes[voterId] || 0) + 1;
    } else if (target && ROLES[target.role]?.team === 'village') {
      room.stats.badVillageVotes[voterId] = (room.stats.badVillageVotes[voterId] || 0) + 1;
    }
  }

  return accusedId;
}

export function tallyVerdict(room) {
  const alive = getAlivePlayers(room);
  let hangWeight = 0;
  let spareWeight = 0;
  const record = {};

  for (const p of alive) {
    if (p.id === room.accusedId) continue;
    const choice = room.verdictVotes[p.id] || 'SPARE';
    const w = getVoteWeight(room, p);
    record[p.id] = choice;
    if (choice === 'HANG') hangWeight += w;
    else spareWeight += w;
  }

  const accused = room.players.find((p) => p.id === room.accusedId);
  const executed = hangWeight > spareWeight;

  room.voteHistory.push({
    day: room.dayCount,
    type: 'VERDICT',
    accusedId: room.accusedId,
    votes: record,
    hangWeight,
    spareWeight,
    result: executed
      ? `⚔️ TREO CỔ ${accused?.name} (${hangWeight} Treo vs ${spareWeight} Tha)!`
      : `🛡️ THA BỔNG ${accused?.name} (${hangWeight} Treo vs ${spareWeight} Tha)!`,
  });

  if (executed && accused) {
    if (accused.role === 'jester') {
      for (const [vid, choice] of Object.entries(record)) {
        if (choice === 'HANG') room.stats.votedJester.push(vid);
      }
      const applied = applyDeathsWithChains(room, [{ playerId: accused.id, cause: 'lynch' }], 'DAY');
      room.publicLogs.push({
        id: Date.now() + Math.random(),
        day: room.dayCount,
        type: 'death',
        text: `🤡 BẤT NGỜ CHẤN ĐỘNG! ${accused.name} chính là KẺ CHÁN ĐỜI và đã lừa thành công cả làng treo cổ mình!`,
      });
      room.winner = {
        team: 'jester',
        title: '🤡 KẺ CHÁN ĐỜI CHIẾN THẮNG!',
        reason: `${accused.name} đã diễn quá sâu và lừa cả làng treo cổ mình thành công!`,
        winners: [accused.id],
      };
      return { executed: true, applied, jesterWon: true };
    }

    const applied = applyDeathsWithChains(room, [{ playerId: accused.id, cause: 'lynch' }], 'DAY');
    room.publicLogs.push({
      id: Date.now() + Math.random(),
      day: room.dayCount,
      type: 'death',
      text: `⚖️ Cả làng chốt án TREO CỔ ${accused.name} (${hangWeight} - ${spareWeight}). Vai trò vẫn được giữ kín!`,
    });
    return { executed: true, applied, jesterWon: false };
  }

  room.publicLogs.push({
    id: Date.now() + Math.random(),
    day: room.dayCount,
    type: 'info',
    text: `🛡️ Sau 15s trăn trối, ${accused?.name} được THA BỔNG (${hangWeight} Treo vs ${spareWeight} Tha). Màn đêm buông xuống...`,
  });
  return { executed: false, applied: [], jesterWon: false };
}

export function computeEndgameAwards(room) {
  const awards = {}; // playerId -> [stickerId]
  const addAward = (pid, stickerId) => {
    if (!pid) return;
    if (!awards[pid]) awards[pid] = [];
    if (!awards[pid].includes(stickerId)) awards[pid].push(stickerId);
  };

  const active = getActivePlayers(room);

  // NGU: poisoned seer, shot villager, or highest badVillageVotes among villagers
  if (room.stats.poisonedSeer) addAward(room.stats.poisonedSeer, 'ngu');
  if (room.stats.shotVillager) {
    addAward(room.stats.shotVillager, 'blind');
    addAward(room.stats.shotVillager, 'ngu');
  }
  let worstVillager = null;
  let worstScore = 0;
  for (const p of active) {
    if (ROLES[p.role]?.team === 'village') {
      const score = room.stats.badVillageVotes[p.id] || 0;
      if (score > worstScore) {
        worstScore = score;
        worstVillager = p.id;
      }
    }
  }
  if (worstVillager && worstScore >= 1) addAward(worstVillager, 'ngu');

  // DO_CHO: wolf betrayed friend, or winning wolf with most kills
  for (const wid of room.stats.wolfBetrayedFriend) {
    addAward(wid, 'do_cho');
  }
  if (room.winner?.team === 'wolf') {
    const aliveWolf = active.find((p) => isWolfRole(p.role) && p.alive);
    if (aliveWolf) addAward(aliveWolf.id, 'do_cho');
  }

  // NGOC_NGHECH: voted Jester or died with unused witch potions
  for (const vid of room.stats.votedJester) addAward(vid, 'ngoc_nghech');
  const unusedWitch = active.find((p) => p.role === 'witch' && !p.alive && p.witchHealLeft && p.witchPoisonLeft);
  if (unusedWitch) addAward(unusedWitch.id, 'ngoc_nghech');

  // BONG: most love interactions sent, or lovers
  let topLover = null;
  let topLoveCount = 0;
  for (const [pid, st] of Object.entries(room.stats.interactionsSent)) {
    if ((st.love || 0) > topLoveCount) {
      topLoveCount = st.love;
      topLover = pid;
    }
  }
  if (topLover && topLoveCount >= 1) addAward(topLover, 'bong');
  for (const lid of room.lovers) {
    addAward(lid, 'bong');
    const p = active.find((x) => x.id === lid);
    if (p?.deathInfo?.cause === 'love') addAward(lid, 'heartbroken');
  }

  // OSCAR: Jester who won, or surviving Wolf
  if (room.winner?.team === 'jester') {
    for (const w of room.winner.winners) addAward(w, 'oscar');
  } else {
    const starWolf = active.find((p) => isWolfRole(p.role) && p.alive);
    if (starWolf) addAward(starWolf.id, 'oscar');
  }

  // DETECTIVE: Seer or villager with most accurate wolf votes
  let topDet = null;
  let topDetScore = 0;
  for (const p of active) {
    if (ROLES[p.role]?.team === 'village') {
      const s = (room.stats.accurateWolfVotes[p.id] || 0) + (p.role === 'seer' ? p.seerHistory.filter((h) => h.isWolf).length : 0);
      if (s > topDetScore) {
        topDetScore = s;
        topDet = p.id;
      }
    }
  }
  if (topDet) addAward(topDet, 'detective');

  return awards;
}

export function sanitizeRoomForPlayer(room, viewerId) {
  const viewer = room.players.find((p) => p.id === viewerId);
  const isGameOver = room.phase === PHASES.GAME_OVER;
  const viewerIsWolf = viewer && !viewer.isSpectator && isWolfRole(viewer.role);

  const players = room.players.map((p) => {
    const showRole = isGameOver || p.id === viewerId || (viewerIsWolf && isWolfRole(p.role));
    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      isBot: p.isBot,
      isSpectator: p.isSpectator,
      connected: p.connected,
      alive: p.alive,
      will: isGameOver || !p.alive ? (room.settings.enableWills ? p.will : '') : p.id === viewerId ? p.will : '',
      mayorRevealed: p.mayorRevealed,
      deathInfo: p.deathInfo,
      role: showRole ? p.role : null,
      originalRole: isGameOver ? p.originalRole : null,
      isLover: isGameOver || (viewer && room.lovers.includes(viewerId) && room.lovers.includes(p.id))
        ? room.lovers.includes(p.id)
        : false,
    };
  });

  // Public day votes display
  let publicDayVotes = {};
  if (room.phase === PHASES.DAY_DISCUSS || room.phase === PHASES.DAY_DEFENSE) {
    for (const [voterId, targetId] of Object.entries(room.dayVotes)) {
      const voter = room.players.find((p) => p.id === voterId);
      const weight =
        room.settings.mayorMode === 'reveal' && voter?.mayorRevealed && !room.villagePowersLost ? 2 : 1;
      publicDayVotes[voterId] = { targetId, weight };
    }
  }

  let publicVerdictVotes = {};
  if (room.phase === PHASES.DAY_VERDICT) {
    for (const [voterId, choice] of Object.entries(room.verdictVotes)) {
      const voter = room.players.find((p) => p.id === voterId);
      const weight =
        room.settings.mayorMode === 'reveal' && voter?.mayorRevealed && !room.villagePowersLost ? 2 : 1;
      publicVerdictVotes[voterId] = { choice, weight };
    }
  }

  // Private state ONLY for viewer
  const selfPrivate = viewer
    ? {
        role: viewer.role,
        elderLives: viewer.elderLives,
        witchHealLeft: viewer.witchHealLeft,
        witchPoisonLeft: viewer.witchPoisonLeft,
        seerHistory: viewer.seerHistory,
        villagePowersLost: room.villagePowersLost,
        lovers: room.lovers.includes(viewerId) ? room.lovers : [],
        lastGuardedId: viewer.role === 'guard' ? room.lastGuardedId : null,
        cursedUsed: viewer.role === 'cursed_wolf' ? room.cursedUsed : false,
        convertedOnDay: viewer.convertedOnDay || null,
        wolfVotes: viewerIsWolf && room.phase === PHASES.NIGHT ? room.nightActions.wolfVotes : {},
        curseActive: viewerIsWolf && room.phase === PHASES.NIGHT ? Boolean(room.nightActions.curseActive) : false,
        wolfLocked: viewerIsWolf && room.phase === PHASES.NIGHT ? Boolean(room.nightActions.wolfLocked) : false,
        witchVictimId:
          viewer.role === 'witch' &&
          viewer.alive &&
          room.phase === PHASES.NIGHT &&
          room.nightStage === 'LATE' &&
          !room.villagePowersLost
            ? room.nightActions.effectiveWolfVictim
            : null,
        myNightDone:
          room.phase === PHASES.NIGHT && viewer.alive
            ? (viewer.role === 'guard' && room.nightActions.guardSubmitted) ||
              (viewer.role === 'cupid' && room.nightActions.cupidTargets.length === 2) ||
              (viewer.role === 'seer' && room.nightActions.seerSubmitted) ||
              (viewer.role === 'witch' && room.nightActions.witchSubmitted) ||
              (isWolfRole(viewer.role) && Boolean(room.nightActions.wolfVotes[viewerId]))
            : false,
      }
    : null;

  // Filter chat channels strictly on server!
  const visibleChat = room.chat.filter((msg) => {
    if (isGameOver) return true;
    if (msg.channel === 'village') return true;
    if (msg.channel === 'wolf') return viewerIsWolf;
    if (msg.channel === 'dead') return viewer && (!viewer.alive || viewer.isSpectator);
    return false;
  });

  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    nightStage: room.nightStage,
    dayCount: room.dayCount,
    phaseEndsAt: room.phaseEndsAt,
    extensionUsedToday: room.extensionUsedToday,
    settings: room.settings,
    players,
    accusedId: room.accusedId,
    activeHunterId: room.phase === PHASES.HUNTER_SHOT ? room.hunterQueue[0] || null : null,
    pendingDeaths: room.pendingDeaths,
    publicDayVotes,
    publicVerdictVotes,
    skipVotes: room.skipVotes || [],
    voteHistory: room.voteHistory,
    publicLogs: room.publicLogs,
    secretLogs: isGameOver ? room.secretLogs : [],
    winner: room.winner,
    autoAwards: isGameOver ? computeEndgameAwards(room) : {},
    endgameStickers: isGameOver ? room.endgameStickers : {},
    selfPrivate,
    chat: visibleChat.slice(-100),
  };
}

export function computeVoicePermissions(room, viewer) {
  if (!room || !viewer) {
    return {
      canSpeak: false,
      channel: 'muted',
      label: 'Chưa kết nối',
      hearablePeerIds: [],
      audibleToPeerIds: [],
    };
  }

  const others = room.players.filter((p) => !p.isBot && p.connected && p.id !== viewer.id);
  if (room.phase === PHASES.LOBBY || room.phase === PHASES.GAME_OVER) {
    const ids = others.map((p) => p.id);
    return {
      canSpeak: true,
      channel: 'free',
      label: 'Trò chuyện tự do',
      hearablePeerIds: ids,
      audibleToPeerIds: ids,
    };
  }

  const viewerIsDead = !viewer.alive || viewer.isSpectator;
  const viewerIsWolf = !viewerIsDead && isWolfRole(viewer.role);

  if (room.phase === PHASES.NIGHT) {
    if (viewerIsDead) {
      const deadIds = others.filter((p) => !p.alive || p.isSpectator).map((p) => p.id);
      return {
        canSpeak: true,
        channel: 'dead',
        label: 'Cõi Âm (Linh Hồn)',
        hearablePeerIds: deadIds,
        audibleToPeerIds: deadIds,
      };
    }
    if (viewerIsWolf) {
      const wolfIds = others.filter((p) => p.alive && !p.isSpectator && isWolfRole(p.role)).map((p) => p.id);
      return {
        canSpeak: true,
        channel: 'wolf',
        label: 'Kênh Kín Ma Sói',
        hearablePeerIds: wolfIds,
        audibleToPeerIds: wolfIds,
      };
    }
    return {
      canSpeak: false,
      channel: 'muted',
      label: 'Ban đêm (Khóa Mic)',
      hearablePeerIds: [],
      audibleToPeerIds: [],
    };
  }

  // Daytime / Dawn / Hunter / Defense / Verdict
  if (viewerIsDead) {
    return {
      canSpeak: true,
      channel: 'dead',
      label: 'Cõi Âm (Nghe Làng, Nói Với Hồn Ma)',
      hearablePeerIds: others.map((p) => p.id),
      audibleToPeerIds: others.filter((p) => !p.alive || p.isSpectator).map((p) => p.id),
    };
  }

  return {
    canSpeak: true,
    channel: 'village',
    label:
      room.phase === PHASES.DAY_DEFENSE && room.accusedId === viewer.id
        ? 'Bục Trăn Trối (Đang Biện Hộ)'
        : 'Cả Làng Thảo Luận',
    hearablePeerIds: others.filter((p) => p.alive && !p.isSpectator).map((p) => p.id),
    audibleToPeerIds: others.map((p) => p.id),
  };
}
