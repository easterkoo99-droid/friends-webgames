'use strict';
/**
 * 주사위 카지노 (코드 이름: casino) - 2~5인 주사위 눈치 게임 (플러그인)
 *
 * 카지노 6곳(숫자 1~6)에 돈 카드가 놓여 있어요. 내 차례에 남은 주사위를 전부 굴리고, 한 숫자의 주사위를 전부 그 숫자의 카지노에 놓아요.
 *  - 정산: 카지노마다 주사위를 가장 많이 놓은 사람이 가장 큰 돈 카드를 가져가요. 같은 개수를 놓은 사람끼리는 서로 상쇄돼서 아무도 못 받아요!
 *  - 4라운드가 끝났을 때 돈이 가장 많은 사람이 우승이에요.
 *  - 2~4명일 때는 흰색(중립) 주사위가 더해져서, 가상의 한 사람(주사위 8개)이 더 있는 것처럼 정산해요.
 * 돈 카드 구성과 시간 제한은 아래 CFG 에서 고칠 수 있어요.
 */
const { shuffle } = require('./util');

const CFG = {
  MIN: 2,
  MAX: 5,
  ROUNDS: 4,
  OWN_DICE: 8,                 // 한 사람이 가진 주사위
  MIN_POT: 50000,              // 카지노마다 이 금액 이상이 될 때까지 돈 카드를 놓아요
  TURN_MS: 45 * 1000,          // 숫자를 고르는 제한 시간 (넘으면 가장 많은 쪽으로 자동 선택)
  NEXT_MS: 15 * 1000,          // 정산을 보고 다음 라운드로 넘어가기까지 (모두 누르면 바로)
  SCORE_WIN: 1,                // 우승하면 방 점수판에 더해지는 점수
  // 돈 카드 54장: 값 → 장수
  NOTES: { 10000: 6, 20000: 8, 30000: 8, 40000: 6, 50000: 6, 60000: 5, 70000: 5, 80000: 5, 90000: 5 },
  // 테스트용: {"notes":[맨 위부터 돈 카드…], "rolls":[[눈…],…], "start":시작자리}
  //   rolls 는 굴릴 때마다 차례로 쓰여요. 한 번 굴린 배열의 앞쪽은 내 주사위, 뒤쪽은 흰색 주사위예요.
  get FORCE() { try { return process.env.CASINO_FORCE ? JSON.parse(process.env.CASINO_FORCE) : null; } catch (e) { return null; } },
};

const money = (v) => `$${v.toLocaleString('en-US')}`;
const whitePer = (n) => (n === 2 ? 4 : n === 3 || n === 4 ? 2 : 0);   // 2~4명: 흰색 주사위를 나눠 가져요 (합쳐서 8개 = 가상의 한 사람)

const HELP = {
  summary: [
    '🎲 **주사위를 전부 굴린 뒤, 한 숫자의 주사위를 모두** 그 숫자의 카지노에 놓아요. (3이 4개 나왔다면 3번 카지노에 4개!)',
    '🏆 정산 때 **카지노마다 주사위를 가장 많이 놓은 사람**이 가장 큰 돈 카드를 가져가요.',
    '⚠️ **같은 개수를 놓은 사람끼리는 서로 상쇄**돼서 아무도 못 받아요! 4라운드 뒤 돈이 가장 많은 사람이 우승이에요.',
  ],
  sections: [
    { title: '진행 방법', lines: [
      '카지노 6곳(1~6번)이 있고, 라운드가 시작되면 카지노마다 **합계 5만 달러 이상**이 되도록 돈 카드가 놓여요.',
      '모두 자기 색 주사위 8개를 들고 시작해요. 내 차례가 되면 **남은 주사위를 전부** 굴려요.',
      '굴린 눈 중 **한 숫자를 골라**, 그 눈이 나온 주사위를 **전부** 같은 번호 카지노에 놓아요. 일부만 놓을 수는 없어요.',
      '남은 주사위는 다음 내 차례에 다시 굴려요. 주사위를 다 놓은 사람은 건너뛰고, **모두 다 놓을 때까지** 돌아요.',
      '내 차례는 45초예요. 시간이 지나면 가장 많이 나온 눈으로 자동으로 놓아요.',
    ] },
    { title: '정산 (라운드가 끝났을 때)', lines: [
      '카지노마다 먼저 **같은 개수의 주사위를 놓은 사람들**을 찾아요. 그 사람들의 주사위는 **모두 빠지고** 돈을 못 받아요.',
      '남은 사람 중 **주사위가 가장 많은 사람**이 가장 큰 돈 카드를, 그다음 많은 사람이 그다음 큰 돈 카드를 받아요. 한 카지노에서 돈 카드는 한 사람이 한 장만 받아요.',
      '받을 사람이 없는 돈 카드는 돈 카드 더미 맨 아래로 돌아가요. 받은 돈은 내 앞에 쌓여요.',
      '다음 라운드는 시작한 사람의 **왼쪽 사람**이 먼저 시작해요. 카지노마다 다시 5만 달러 이상이 되도록 돈 카드를 채워요.',
    ] },
    { title: '흰색(중립) 주사위', lines: [
      '**2~4명**일 때는 흰색 주사위가 더해져요. 2명이면 한 사람당 4개, 3~4명이면 한 사람당 2개예요.',
      '흰색 주사위는 내 주사위와 **같이 굴리고**, 같은 방식으로 놓아요. 흰색 주사위는 가상의 한 사람(주사위 8개)으로 계산해서 정산해요.',
      '흰색이 돈을 받게 되면 그 돈 카드는 아무도 못 갖고 더미 맨 아래로 돌아가요. 흰색도 다른 사람과 같은 개수면 서로 상쇄돼요.',
      '3명일 때는 시작하는 사람이 흰색 주사위를 2개 더 받아요. (합쳐서 흰색이 8개가 되도록)',
    ] },
    { title: '승리', lines: [
      '4라운드가 끝났을 때 **돈이 가장 많은 사람**이 우승해요. 같으면 돈 카드가 더 많은 사람이 이기고, 그래도 같으면 공동 우승이에요.',
      '우승하면 방 점수판에 1점을 받아요. (공동 우승이면 모두 1점)',
    ] },
  ],
  groups: [
    { title: '예시로 이해하기', items: [
      { emoji: '🎲', title: '굴리고 놓기', color: '#f59e0b', text: '내 주사위 5개를 굴려서 **2, 2, 5, 5, 5**가 나왔어요. 2를 고르면 2번 카지노에 2개, 5를 고르면 5번 카지노에 3개를 놓아요. 둘 다 놓을 수는 없어요.', example: '5를 골랐다면 5번 카지노에 3개를 놓고, 남은 주사위 2개(눈 2, 2는 아직 안 놓은 주사위)는 다음 차례에 다시 굴려요.', tip: '많이 놓을수록 유리하지만, 남는 주사위가 적어지면 다음 선택지가 줄어요.' },
      { emoji: '💥', title: '상쇄: 같은 개수는 모두 빠져요', color: '#f43f5e', text: '3번 카지노에 철수 5개, 영희 3개, 민수 3개, 지수 1개를 놓았어요. 영희와 민수는 **같은 개수(3개)라서 둘 다 빠져요.**', example: '남은 사람은 철수(5개)와 지수(1개)예요. 철수가 가장 큰 돈 카드를, 지수가 두 번째로 큰 돈 카드를 받아요.', tip: '남이 놓을 개수를 예상해서 일부러 같은 개수가 되게 만들어 상대를 끌어내릴 수도 있어요.' },
      { emoji: '💰', title: '돈 카드 나누기', color: '#34d399', text: '카지노에 $80,000, $30,000, $10,000 카드가 있고 철수 4개, 영희 2개를 놓았어요.', example: '철수가 $80,000, 영희가 $30,000을 받아요. 남은 $10,000은 더미 맨 아래로 돌아가요.', tip: '돈 카드가 많은 카지노는 한 곳에서 여러 명이 받을 수 있어요. 2등, 3등도 노려 볼 만해요.' },
      { emoji: '⚪', title: '흰색 주사위', color: '#94a3b8', text: '2~4명일 때는 흰색 주사위도 같이 굴려요. 예를 들어 내 주사위 1이 2개, 흰색 1이 1개가 나오면 1을 고를 때 **3개를 한꺼번에** 놓아요.', example: '정산 때 흰색은 가상의 한 사람이에요. 흰색이 가장 많이 놓은 카지노에서는 그 돈 카드를 아무도 못 가져가요.', tip: '흰색이 많이 놓인 카지노는 피하는 게 안전하고, 흰색과 같은 개수를 놓으면 서로 상쇄돼요.' },
    ] },
  ],
};

module.exports = {
  id: 'casino',
  name: '주사위 카지노',
  emoji: '🎰',
  accent: '#f59e0b',
  desc: '주사위를 굴려 카지노에 걸어요. 가장 많이 건 사람이 큰돈을 가져가지만, 같은 개수는 서로 상쇄!',
  rules: [
    '카지노 6곳(1~6번)에 돈 카드가 있어요. 내 차례에 주사위를 전부 굴리고, 한 숫자의 주사위를 전부 그 번호 카지노에 놓아요.',
    '모두 주사위를 다 놓으면 정산해요. 카지노마다 주사위를 가장 많이 놓은 사람이 가장 큰 돈 카드를 가져가요.',
    '같은 개수를 놓은 사람끼리는 서로 상쇄돼서 아무도 돈을 못 받아요.',
    '2~4명일 때는 흰색 주사위가 더해져 가상의 한 사람(주사위 8개)이 더 있는 것처럼 정산해요.',
    '4라운드가 끝났을 때 돈이 가장 많은 사람이 우승해요.',
  ],
  min: CFG.MIN,
  max: CFG.MAX,
  help: HELP,

  create(api) {
    const seatOf = (g, id) => g.seats.find((s) => s.id === id);
    const pub = (room, text) => { room.g.log.push({ t: Date.now(), text }); };
    const setEvent = (g, e) => { g.eventSeq += 1; g.lastEvent = { seq: g.eventSeq, t: Date.now(), ...e }; };
    const later = (g, ms, fn) => { const h = setTimeout(fn, ms); g.timers.add(h); return h; };
    const clearTimers = (g) => { g.timers.forEach((h) => clearTimeout(h)); g.timers.clear(); };
    const active = (g) => g.seats.filter((s) => !s.left);
    const diceLeft = (s) => s.own + s.white;

    function buildDeck() {
      const F = CFG.FORCE;
      if (F && Array.isArray(F.notes)) return F.notes.slice();
      const d = [];
      Object.entries(CFG.NOTES).forEach(([v, n]) => { for (let i = 0; i < n; i++) d.push(Number(v)); });
      return shuffle(d);
    }

    /* ───────── 시작 / 라운드 ───────── */
    function start(room, gamers) {
      const F = CFG.FORCE;
      const order = F ? gamers : shuffle(gamers);
      const g = (room.g = {
        phase: 'play', round: 0,
        seats: order.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, own: 0, white: 0, money: 0, notes: [], left: false })),
        deck: buildDeck(), casinos: [], startIdx: -1, turnIdx: -1, roll: null, turnEnds: 0, nextAt: 0,
        payout: null, result: null, nextReady: new Set(), rollCursor: 0,
        log: [], lastEvent: null, eventSeq: 0, timers: new Set(),
      });
      pub(room, '🎰 주사위 카지노를 시작해요! 4라운드 동안 가장 많은 돈을 모으면 우승이에요.');
      newRound(room);
    }

    function drawNote(g) { return g.deck.length ? g.deck.shift() : null; }
    function fillCasinos(g) {
      g.casinos.forEach((c) => {
        while (c.notes.reduce((a, b) => a + b, 0) < CFG.MIN_POT) { const n = drawNote(g); if (n === null) break; c.notes.push(n); }
        c.notes.sort((a, b) => b - a);
      });
    }

    function newRound(room) {
      const g = room.g;
      clearTimers(g);
      g.round += 1; g.phase = 'play'; g.payout = null; g.nextReady = new Set(); g.roll = null;
      const act = active(g);
      const wp = whitePer(act.length);
      g.seats.forEach((s) => { s.own = s.left ? 0 : CFG.OWN_DICE; s.white = s.left ? 0 : wp; });
      g.casinos = [1, 2, 3, 4, 5, 6].map((n) => ({ n, notes: [], dice: {}, neutral: 0 }));
      fillCasinos(g);
      // 시작하는 사람: 첫 라운드는 무작위(또는 FORCE), 다음부터는 왼쪽 사람
      const F = CFG.FORCE;
      let st;
      if (g.startIdx < 0) st = F && Number.isInteger(F.start) ? F.start : Math.floor(Math.random() * g.seats.length);
      else st = (g.startIdx + 1) % g.seats.length;
      while (g.seats[st].left) st = (st + 1) % g.seats.length;
      g.startIdx = st;
      if (act.length === 3) g.seats[st].white += 2;      // 3명일 때는 시작하는 사람이 흰색 2개를 더 받아요 (흰색이 모두 8개)
      pub(room, `📜 ${g.round}라운드 시작! 카지노마다 돈 카드가 놓였어요. ${g.seats[st].name}님이 먼저 시작해요.`);
      setEvent(g, { tone: 'info', icon: '🎰', headline: `${g.round}라운드 시작`, detail: `${g.seats[st].name}님부터 주사위를 굴려요. 카지노마다 ${money(CFG.MIN_POT)} 이상의 돈 카드가 놓였어요`, auto: false });
      startTurn(room, st);
    }

    /* ───────── 차례 ───────── */
    function nextWithDice(g, from) {
      const n = g.seats.length;
      for (let k = 0; k < n; k++) { const i = (from + k) % n; if (!g.seats[i].left && diceLeft(g.seats[i]) > 0) return i; }
      return -1;
    }
    function rollDice(g, s) {
      const F = CFG.FORCE;
      const need = diceLeft(s);
      let vals = null;
      if (F && Array.isArray(F.rolls) && g.rollCursor < F.rolls.length) vals = F.rolls[g.rollCursor++].slice(0, need);
      if (!vals || vals.length < need) vals = Array.from({ length: need }, () => 1 + Math.floor(Math.random() * 6));
      return vals.map((v, i) => ({ k: i < s.own ? 'o' : 'w', v }));
    }
    function startTurn(room, from) {
      const g = room.g;
      clearTimers(g);
      const idx = nextWithDice(g, from);
      if (idx < 0) return payout(room);
      const s = g.seats[idx];
      g.turnIdx = idx;
      g.roll = { idx, dice: rollDice(g, s), seq: (g.roll ? g.roll.seq : 0) + 1 };
      const values = [...new Set(g.roll.dice.map((d) => d.v))];
      if (values.length === 1) { place(room, s, values[0], 'only'); return; }       // 고를 게 하나뿐이면 자동으로 놓아요
      g.turnEnds = Date.now() + CFG.TURN_MS;
      later(g, CFG.TURN_MS, () => autoPlace(room));
      api.broadcast(room);
    }
    function choicesOf(g) {
      const m = {};
      g.roll.dice.forEach((d) => { m[d.v] = m[d.v] || { n: d.v, own: 0, white: 0, total: 0 }; if (d.k === 'o') m[d.v].own += 1; else m[d.v].white += 1; m[d.v].total += 1; });
      return Object.values(m).sort((a, b) => a.n - b.n);
    }
    function place(room, s, n, mode) {
      const g = room.g;
      const dice = g.roll.dice;
      const picked = dice.filter((d) => d.v === n);
      const own = picked.filter((d) => d.k === 'o').length, white = picked.length - own;
      const c = g.casinos[n - 1];
      c.dice[s.id] = (c.dice[s.id] || 0) + own;
      c.neutral += white;
      s.own -= own; s.white -= white;
      const rolled = dice.map((d) => d.v).sort((a, b) => a - b).join(', ');
      const left = diceLeft(s);
      const how = mode === 'auto' ? ' (시간이 지나 자동으로)' : mode === 'only' ? ' (고를 눈이 하나뿐이라 자동으로)' : '';
      pub(room, `🎲 ${s.name}님이 ${n}번 카지노에 주사위 ${picked.length}개를 놓았어요${white ? ` (흰색 ${white}개 포함)` : ''}.${how}`);
      setEvent(g, { tone: 'info', icon: '🎲', headline: `${s.name}님이 ${n}번 카지노에 ${picked.length}개를 놓았어요${how}`, detail: `굴린 눈: ${rolled} · ${left > 0 ? `남은 주사위 ${left}개` : '주사위를 모두 놓았어요'}`, pick: n, count: picked.length, auto: mode !== 'manual' });
      g.lastRoll = { idx: g.turnIdx, dice: dice.map((d) => ({ ...d })), pick: n };
      g.roll = null;
      startTurn(room, (g.turnIdx + 1) % g.seats.length);
    }
    function autoPlace(room) {
      const g = room.g;
      if (!g || g.phase !== 'play' || !g.roll) return;
      const s = g.seats[g.roll.idx];
      const ch = choicesOf(g);
      const best = Math.max(...ch.map((c) => c.total));
      const cand = ch.filter((c) => c.total === best);
      place(room, s, cand[Math.floor(Math.random() * cand.length)].n, 'auto');
    }

    /* ───────── 정산 ───────── */
    function payout(room) {
      const g = room.g;
      clearTimers(g);
      const result = [];
      g.casinos.forEach((c) => {
        const entries = [];
        g.seats.forEach((s) => { if (c.dice[s.id] > 0) entries.push({ who: s.id, count: c.dice[s.id], cancelled: false, won: null }); });
        if (c.neutral > 0) entries.push({ who: 'N', count: c.neutral, cancelled: false, won: null });
        const byCount = {};
        entries.forEach((e) => { byCount[e.count] = (byCount[e.count] || 0) + 1; });
        entries.forEach((e) => { if (byCount[e.count] > 1) e.cancelled = true; });
        const live = entries.filter((e) => !e.cancelled).sort((a, b) => b.count - a.count);
        const notes = c.notes.slice().sort((a, b) => b - a);
        live.forEach((e, i) => { if (i < notes.length) e.won = notes[i]; });
        const leftover = notes.slice(Math.min(live.length, notes.length));
        live.forEach((e) => {
          if (e.won === null) return;
          if (e.who === 'N') g.deck.push(e.won);                      // 흰색(가상의 사람)이 받은 돈은 더미 맨 아래로
          else { const s = seatOf(g, e.who); s.money += e.won; s.notes.push(e.won); }
        });
        leftover.forEach((v) => g.deck.push(v));                       // 받을 사람이 없는 돈 카드도 더미 맨 아래로
        result.push({ n: c.n, notes, rows: entries.sort((a, b) => b.count - a.count), leftover });
      });
      g.payout = result;
      const gained = g.seats.map((s) => `${s.name} ${money(result.reduce((a, c) => a + (c.rows.find((r) => r.who === s.id && r.won !== null) || { won: 0 }).won, 0))}`);
      pub(room, `💰 ${g.round}라운드 정산! ${gained.join(' · ')}`);
      const roundGain = (s) => result.reduce((a, c) => a + ((c.rows.find((r) => r.who === s.id && r.won !== null) || { won: 0 }).won), 0);
      const top = g.seats.slice().sort((a, b) => roundGain(b) - roundGain(a))[0];
      setEvent(g, { tone: 'good', icon: '💰', headline: `${g.round}라운드 정산`, detail: roundGain(top) > 0 ? `이번 라운드는 ${top.name}님이 ${money(roundGain(top))}로 가장 많이 벌었어요` : '이번 라운드는 아무도 돈을 못 벌었어요', auto: false });
      if (g.round >= CFG.ROUNDS) return finish(room);
      g.phase = 'roundEnd'; g.nextAt = Date.now() + CFG.NEXT_MS; g.turnIdx = -1;
      later(g, CFG.NEXT_MS, () => nextRound(room));
      api.broadcast(room);
    }
    function nextRound(room) {
      const g = room.g;
      if (!g || g.phase !== 'roundEnd') return;
      if (active(g).length < CFG.MIN) return finish(room, true);
      newRound(room);
    }
    function finish(room, abort) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'ended'; g.turnIdx = -1; g.roll = null; g.nextAt = 0;
      const ranked = g.seats.slice().sort((a, b) => b.money - a.money || b.notes.length - a.notes.length);
      const best = ranked[0];
      const winners = abort ? [] : ranked.filter((s) => s.money === best.money && s.notes.length === best.notes.length);
      winners.forEach((s) => { const p = room.players.find((x) => x.id === s.id); if (p) api.addScore(room, p, CFG.SCORE_WIN); });
      g.result = {
        abort: !!abort, winners: winners.map((s) => s.id),
        players: ranked.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, color: s.color, money: s.money, notes: s.notes.length, win: winners.includes(s), left: s.left, gain: winners.includes(s) ? CFG.SCORE_WIN : 0 })),
        reason: abort ? '인원이 부족해 게임이 중단되었어요. (점수 없음)' : `${winners.map((s) => s.name).join(', ')}님이 ${money(best.money)}으로 우승했어요! 🎉`,
      };
      pub(room, `🏆 ${abort ? '게임 중단' : '게임 종료'}! ${g.result.reason}`);
      api.broadcast(room);
    }

    /* ───────── 보기 ───────── */
    function view(room, pid) {
      const g = room.g;
      const me = seatOf(g, pid);
      const myTurn = !!(me && g.phase === 'play' && g.roll && g.seats[g.roll.idx] === me);
      return {
        phase: g.phase, round: g.round, rounds: CFG.ROUNDS,
        startId: g.startIdx >= 0 ? g.seats[g.startIdx].id : null,
        turnId: g.phase === 'play' && g.turnIdx >= 0 ? g.seats[g.turnIdx].id : null,
        endsAt: g.phase === 'play' && g.roll ? g.turnEnds : g.phase === 'roundEnd' ? g.nextAt : 0,
        minPot: CFG.MIN_POT, white: whitePer(active(g).length) > 0,
        casinos: g.casinos.map((c) => ({ n: c.n, notes: c.notes.slice(), total: c.notes.reduce((a, b) => a + b, 0), dice: Object.entries(c.dice).filter(([, v]) => v > 0).map(([id, count]) => ({ id, count })), neutral: c.neutral })),
        seats: g.seats.map((s, i) => ({ id: s.id, name: s.name, avatar: s.avatar, color: s.color, left: s.left, own: s.own, white: s.white, money: s.money, noteCount: s.notes.length, turn: g.phase === 'play' && i === g.turnIdx })),
        roll: g.roll ? { seatId: g.seats[g.roll.idx].id, seq: g.roll.seq, dice: g.roll.dice.map((d) => ({ k: d.k, v: d.v })) } : null,
        lastRoll: g.lastRoll ? { seatId: g.seats[g.lastRoll.idx].id, dice: g.lastRoll.dice, pick: g.lastRoll.pick } : null,
        deckCount: g.deck.length,
        payout: g.phase === 'roundEnd' || g.phase === 'ended' ? g.payout : null,
        nextReady: [...g.nextReady],
        result: g.phase === 'ended' ? g.result : null,
        log: g.log.slice(-60), last: g.lastEvent,
        me: me ? { myTurn, choices: myTurn ? choicesOf(g) : [], money: me.money } : null,
      };
    }

    /* ───────── 동작 ───────── */
    function action(room, player, msg) {
      const g = room.g;
      if (!g) return { ok: false, error: '진행 중인 게임이 아니에요.' };
      const s = seatOf(g, player.id);
      if (!s || s.left) return { ok: false, error: '이번 판 참가자가 아니에요.' };
      if (msg.type === 'place') {
        if (g.phase !== 'play' || !g.roll) return { ok: false, error: '지금은 주사위를 놓을 수 없어요.' };
        if (g.seats[g.roll.idx] !== s) return { ok: false, error: `지금은 ${g.seats[g.roll.idx].name}님의 차례예요.` };
        const n = Number(msg.n);
        if (!g.roll.dice.some((d) => d.v === n)) return { ok: false, error: '굴리지 않은 숫자예요. 나온 눈 중에서 골라 주세요.' };
        clearTimers(g);
        place(room, s, n, 'manual');
        return { ok: true };
      }
      if (msg.type === 'next') {
        if (g.phase !== 'roundEnd') return { ok: false, error: '지금은 다음 라운드로 넘어갈 수 없어요.' };
        g.nextReady.add(s.id);
        if (active(g).every((x) => g.nextReady.has(x.id))) nextRound(room);
        return { ok: true };
      }
      return { ok: false, error: '알 수 없는 동작이에요.' };
    }

    function onLeave(room, player) {
      const g = room.g;
      if (!g || g.phase === 'ended') return;
      const s = seatOf(g, player.id);
      if (!s || s.left) return;
      const wasTurn = g.phase === 'play' && g.roll && g.seats[g.roll.idx] === s;
      s.left = true; s.own = 0; s.white = 0;
      pub(room, `🚪 ${s.name}님이 떠났어요. 놓지 않은 주사위는 사라져요.`);
      if (active(g).length < CFG.MIN) return finish(room, true);
      if (g.phase === 'roundEnd') { g.nextReady.delete(s.id); if (active(g).every((x) => g.nextReady.has(x.id))) nextRound(room); return; }
      if (g.phase === 'play' && wasTurn) { clearTimers(g); g.roll = null; startTurn(room, (g.turnIdx + 1) % g.seats.length); }
      else if (g.phase === 'play' && nextWithDice(g, 0) < 0) payout(room);
    }

    function dispose(room) { if (room.g) clearTimers(room.g); room.g = null; }

    return { start, view, action, onLeave, dispose, isFinished: (room) => !!room.g && room.g.phase === 'ended' };
  },
};
