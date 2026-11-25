import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../shared/constants.js';
import {
  checkWinCondition,
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
