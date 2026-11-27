import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../shared/constants.js';
import { decodeAdpcm, downsampleTo16k, encodeAdpcm } from '../src/audio/adpcm.js';
import {
  checkWinCondition,
  computeVoicePermissions,
  createPlayer,
  createRoom,
  enterLateNight,
  enterNight,
  resolveNightToDawn,
  sanitizeRoomForPlayer,
  startGame,
  tallyDayNomination,
  tallyVerdict,
} from '../server/gameEngine.js';

function setup5PlayerRoom() {
  const host = createPlayer({ id: 'p1', name: 'Thợ Rèn', avatarId: 'blacksmith', will: 'Tôi vô tội' });
  const room = createRoom(host, 'TEST01');
  room.players.push(
    createPlayer({ id: 'p2', name: 'Ông Già', avatarId: 'oldman', will: 'Sống thọ' }),
    createPlayer({ id: 'p3', name: 'Bà Cụ', avatarId: 'oldwoman', will: 'Áo tím' }),
    createPlayer({ id: 'p4', name: 'Thằng Điên', avatarId: 'madman', will: 'Nồi úp đầu' }),
    createPlayer({ id: 'p5', name: 'Thuốc Lào', avatarId: 'waterpipe', will: 'Làm bi' })
  );
  const res = startGame(room);
  assert.equal(res.ok, true);
  // Assign deterministic roles for testing
  room.players[0].role = 'mayor';
  room.players[0].originalRole = 'mayor';
  room.players[1].role = 'villager';
  room.players[1].originalRole = 'villager';
  room.players[2].role = 'jester';
  room.players[2].originalRole = 'jester';
  room.players[3].role = 'cursed_wolf';
  room.players[3].originalRole = 'cursed_wolf';
  room.players[4].role = 'elder';
  room.players[4].originalRole = 'elder';
  room.players[4].elderLives = 2;
  return room;
}

test('Mayor x2 vote weight works in both Nomination and Verdict (SPARE vs HANG)', () => {
  const room = setup5PlayerRoom();
  room.phase = PHASES.DAY_DISCUSS;
  room.dayCount = 1;

  // p1 (Mayor, weight 2) votes p3; p2 (1) and p4 (1) vote p5 -> tie (2 vs 2) -> no accused
  room.dayVotes = { p1: 'p3', p2: 'p5', p4: 'p5' };
  assert.equal(tallyDayNomination(room), null);

  // Now p1 (Mayor, weight 2) + p3 (1) = 3 vs p2 (1) + p4 (1) = 2 -> p5 accused!
  room.dayVotes = { p1: 'p5', p3: 'p5', p2: 'p4', p4: 'p2' };
  const accused = tallyDayNomination(room);
  assert.equal(accused, 'p5');

  // Verdict: p5 is accused; p1 (Mayor, weight 2) votes SPARE, p2 (1) & p3 (1) vote HANG -> 2 vs 2 -> SPARED!
  room.accusedId = accused;
  room.phase = PHASES.DAY_VERDICT;
  room.verdictVotes = { p1: 'SPARE', p2: 'HANG', p3: 'HANG', p4: 'SPARE' };
  // p1(2)+p4(1)=3 SPARE vs p2(1)+p3(1)=2 HANG -> spared
  const verdict = tallyVerdict(room);
  assert.equal(verdict.executed, false);
  assert.equal(room.players[4].alive, true);
});

test('Hidden role on death: dead player role stays hidden until GAME_OVER', () => {
  const room = setup5PlayerRoom();
  room.phase = PHASES.DAY_VERDICT;
  room.accusedId = 'p2'; // villager
  room.verdictVotes = { p1: 'HANG', p3: 'HANG', p4: 'HANG' };
  const verdict = tallyVerdict(room);
  assert.equal(verdict.executed, true);
  assert.equal(room.players[1].alive, false);

  // Sanitize for p1 (Mayor) - must NOT see p2's role!
  const viewForP1 = sanitizeRoomForPlayer(room, 'p1');
  const p2Public = viewForP1.players.find((p) => p.id === 'p2');
  assert.equal(p2Public.alive, false);
  assert.equal(p2Public.role, null);
  assert.equal(p2Public.will, 'Sống thọ');

  // At GAME_OVER, role is revealed
  room.phase = PHASES.GAME_OVER;
  const viewGameOver = sanitizeRoomForPlayer(room, 'p1');
  const p2Revealed = viewGameOver.players.find((p) => p.id === 'p2');
  assert.equal(p2Revealed.role, 'villager');
});

test('Jester wins immediately if lynched in Verdict phase', () => {
  const room = setup5PlayerRoom();
  room.phase = PHASES.DAY_VERDICT;
  room.accusedId = 'p3'; // jester
  room.verdictVotes = { p1: 'HANG', p2: 'HANG' };
  const verdict = tallyVerdict(room);
  assert.equal(verdict.executed, true);
  assert.equal(verdict.jesterWon, true);
  assert.equal(room.winner.team, 'jester');
});

test('Cursed Wolf turns victim into werewolf, and Elder survives first wolf bite', () => {
  const room = setup5PlayerRoom();
  enterNight(room);
  room.dayCount = 1;
  // Wolf bites Elder (p5) with 2 lives -> survives!
  room.nightActions.wolfVotes = { p4: 'p5' };
  enterLateNight(room);
  resolveNightToDawn(room);
  assert.equal(room.players[4].alive, true);
  assert.equal(room.players[4].elderLives, 1);

  // Night 2: Cursed Wolf bites & curses p2 (villager) -> becomes werewolf!
  room.dayCount = 2;
  enterNight(room);
  room.nightActions.wolfVotes = { p4: 'p2' };
  room.nightActions.curseActive = true;
  enterLateNight(room);
  const deaths = resolveNightToDawn(room);
  assert.equal(deaths.length, 0);
  assert.equal(room.players[1].alive, true);
  assert.equal(room.players[1].role, 'werewolf');
  assert.equal(room.cursedUsed, true);
  assert.equal(checkWinCondition(room), null); // 2 wolves vs 3 non-wolves
});

test('Voice permissions strictly enforce Lobby, Day, Night, Wolf, Village, and Dead channels', () => {
  const host = createPlayer({ id: 'h1', name: 'ChuPhong', avatarId: 'blacksmith' });
  const room = createRoom(host, 'VOIC01');
  room.players.push(
    createPlayer({ id: 'h2', name: 'DanLang', avatarId: 'farmer' }),
    createPlayer({ id: 'h3', name: 'SoiMot', avatarId: 'butcher' }),
    createPlayer({ id: 'h4', name: 'SoiHai', avatarId: 'drunk' }),
    createPlayer({ id: 'h5', name: 'HonMa', avatarId: 'oldwoman' }),
    createPlayer({ id: 'h6', name: 'MaThuHai', avatarId: 'oldman' })
  );
  room.players[5].isSpectator = true;
  room.players.push({ ...createPlayer({ id: 'b1', name: 'BotAI', avatarId: 'waterpipe' }), isBot: true });

  // 1. LOBBY: all connected humans talk freely (bots excluded)
  const lobbyPerms = computeVoicePermissions(room, room.players[0]);
  assert.equal(lobbyPerms.canSpeak, true);
  assert.equal(lobbyPerms.channel, 'free');
  assert.deepEqual(lobbyPerms.hearablePeerIds.sort(), ['h2', 'h3', 'h4', 'h5', 'h6']);
  assert.deepEqual(lobbyPerms.audibleToPeerIds.sort(), ['h2', 'h3', 'h4', 'h5', 'h6']);

  // Assign roles and kill h5 for active game tests
  room.players[0].role = 'seer';
  room.players[1].role = 'villager';
  room.players[2].role = 'cursed_wolf';
  room.players[3].role = 'werewolf';
  room.players[4].role = 'villager';
  room.players[4].alive = false;
  room.players[5].alive = false;

  // 2. NIGHT - Living Village (seer/villager): completely locked, cannot hear anyone
  room.phase = PHASES.NIGHT;
  const nightVillager = computeVoicePermissions(room, room.players[1]);
  assert.equal(nightVillager.canSpeak, false);
  assert.equal(nightVillager.channel, 'muted');
  assert.deepEqual(nightVillager.hearablePeerIds, []);
  assert.deepEqual(nightVillager.audibleToPeerIds, []);

  // 3. NIGHT - Living Wolf: talks & hears ONLY living wolves (h4), never dead or villagers
  const nightWolf = computeVoicePermissions(room, room.players[2]);
  assert.equal(nightWolf.canSpeak, true);
  assert.equal(nightWolf.channel, 'wolf');
  assert.deepEqual(nightWolf.hearablePeerIds, ['h4']);
  assert.deepEqual(nightWolf.audibleToPeerIds, ['h4']);

  // 4. NIGHT - Dead/Spectator: talks & hears ONLY dead/spectators (h6), never wolves or living villagers
  const nightDead = computeVoicePermissions(room, room.players[4]);
  assert.equal(nightDead.canSpeak, true);
  assert.equal(nightDead.channel, 'dead');
  assert.deepEqual(nightDead.hearablePeerIds, ['h6']);
  assert.deepEqual(nightDead.audibleToPeerIds, ['h6']);

  // 5. DAY_DISCUSS - Living player (including wolves): talks on village channel, only hears living, audible to everyone
  room.phase = PHASES.DAY_DISCUSS;
  const dayWolf = computeVoicePermissions(room, room.players[2]);
  assert.equal(dayWolf.canSpeak, true);
  assert.equal(dayWolf.channel, 'village');
  assert.deepEqual(dayWolf.hearablePeerIds.sort(), ['h1', 'h2', 'h4']);
  assert.deepEqual(dayWolf.audibleToPeerIds.sort(), ['h1', 'h2', 'h4', 'h5', 'h6']);

  // 6. DAY_DISCUSS - Dead player: hears ALL (living + dead), audible ONLY to other dead/spectators
  const dayDead = computeVoicePermissions(room, room.players[4]);
  assert.equal(dayDead.canSpeak, true);
  assert.equal(dayDead.channel, 'dead');
  assert.deepEqual(dayDead.hearablePeerIds.sort(), ['h1', 'h2', 'h3', 'h4', 'h6']);
  assert.deepEqual(dayDead.audibleToPeerIds, ['h6']);
});

test('Dead Hunter enters hunterQueue and exposes activeHunterId for shooting', () => {
  const room = setup5PlayerRoom();
  room.players[1].role = 'hunter';
  room.players[1].originalRole = 'hunter';
  room.dayCount = 1;
  enterNight(room);
  room.nightActions.wolfVotes = { p4: 'p2' };
  enterLateNight(room);
  const deaths = resolveNightToDawn(room);
  assert.equal(deaths.length, 1);
  assert.equal(room.players[1].alive, false);
  assert.deepEqual(room.hunterQueue, ['p2']);

  room.phase = PHASES.HUNTER_SHOT;
  const hunterView = sanitizeRoomForPlayer(room, 'p2');
  assert.equal(hunterView.activeHunterId, 'p2');
});

test('Cursed Wolf keeps cursedUsed intact when biting without curse and sets convertedOnDay when cursing', () => {
  const room = setup5PlayerRoom();
  room.dayCount = 1;
  enterNight(room);
  room.nightActions.wolfVotes = { p4: 'p2' };
  room.nightActions.curseActive = false;
  enterLateNight(room);
  const deaths = resolveNightToDawn(room);
  assert.equal(deaths.length, 1);
  assert.equal(room.players[1].alive, false);
  assert.equal(room.cursedUsed, false);

  // Night 2: curse p1 (mayor)
  room.dayCount = 2;
  enterNight(room);
  room.nightActions.wolfVotes = { p4: 'p1' };
  room.nightActions.curseActive = true;
  enterLateNight(room);
  resolveNightToDawn(room);
  assert.equal(room.players[0].role, 'werewolf');
  assert.equal(room.players[0].convertedOnDay, 2);
  const p1View = sanitizeRoomForPlayer(room, 'p1');
  assert.equal(p1View.selfPrivate.convertedOnDay, 2);
});

test('IMA-ADPCM codec preserves 16kHz voice signal cleanly across encode/decode', () => {
  const input = new Float32Array(960);
  for (let i = 0; i < input.length; i++) {
    input[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000);
  }
  const down = downsampleTo16k(input, 48000);
  assert.equal(down.length, 320);
  const encoded = encodeAdpcm(down);
  assert.equal(encoded.length, 4 + 160);
  const decoded = decodeAdpcm(encoded);
  assert.equal(decoded.length, 320);
  let maxErr = 0;
  for (let i = 0; i < 320; i++) {
    maxErr = Math.max(maxErr, Math.abs(decoded[i] - down[i]));
  }
  assert.ok(maxErr < 0.08, `Expected ADPCM error < 0.08, got ${maxErr}`);
});
