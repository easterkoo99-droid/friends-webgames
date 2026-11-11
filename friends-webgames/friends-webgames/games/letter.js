'use strict';
/**
 * 밀서 대작전 (코드 이름: letter) - 2~4인 카드 추리 게임 (플러그인)
 *
 * 궁궐에서 공주님께 밀서를 올리려는 신하들의 암투예요. 이 장르의 기본 구조를 따르되 카드 이름과 설정은 새로 만든 것이에요.
 *  - 16장짜리 덱에서 한 장씩 손패로 받아요. 내 차례에 한 장을 뽑아 손패 2장 중 하나를 내고 효과를 써요.
 *  - 라운드는 마지막 한 명이 남거나 덱이 바닥나면 끝나요. 덱이 바닥나면 가장 높은 카드를 든 사람이 이겨요.
 *  - 라운드를 이기면 밀서 토큰(❤) 1개. 정해진 개수를 먼저 모으면 승리! (2명 7개, 3명 5개, 4명 4개)
 * 카드 이름/효과는 아래 CARDS 에서 고칠 수 있어요.
 */
const { pick, shuffle } = require('./util');

const HUE = { 1: '#94a3b8', 2: '#38bdf8', 3: '#fb923c', 4: '#34d399', 5: '#a78bfa', 6: '#fbbf24', 7: '#f472b6', 8: '#f43f5e' };   // 카드 숫자별 색 (설명 화면용)

const CFG = {
  MIN: 2,
  MAX: 4,
  TURN_MS: 90 * 1000,                    // 내 차례 제한 시간 (넘으면 자동으로 한 수를 둬요)
  NEXT_MS: 15 * 1000,                    // 라운드가 끝난 뒤 다음 라운드까지 기다리는 시간
  GOAL: { 2: 7, 3: 5, 4: 4 },            // 이기려면 필요한 밀서 토큰
  SCORE: { win: 1 },                     // 방 점수판에 더해지는 점수
  // 테스트용: 'top→bottom 순서의 카드 숫자들' (첫 장은 버려지는 카드, 이어서 2인이면 공개 3장, 그다음 손패, 그다음 뽑는 순서)
  get FORCE_DECK() { return process.env.LETTER_DECK || ''; },
};

// 카드: 숫자(1~8)가 곧 힘이에요. target: other(다른 사람) | any(자신도 가능) | null(대상 없음)
const CARDS = {
  1: { name: '별감', emoji: '🔔', count: 5, target: 'other', brief: '상대 카드를 맞히면 탈락', desc: '한 명을 골라 그 사람의 카드를 추측해요(별감은 제외). 맞히면 그 사람이 탈락해요.', detail: '다른 사람 한 명을 골라, 그 사람이 지금 손에 들고 있는 카드가 뭔지 맞혀 보세요. 별감(1)은 말할 수 없어요. 맞히면 그 사람은 바로 탈락, 틀리면 아무 일도 없어요.', example: '상대가 ‘무관(3)’을 들고 있을 것 같다 → 추측에서 ‘무관’을 골라요. 맞으면 탈락, 틀려도 내가 손해 보는 건 없어요.', tip: '누가 어떤 카드를 냈는지 기억하세요. 이미 많이 나온 카드는 상대가 들고 있을 가능성이 낮아요.' },
  2: { name: '나인', emoji: '👀', count: 2, target: 'other', brief: '상대 손패를 몰래 보기', desc: '한 명의 손패를 몰래 봐요.', detail: '한 명을 골라 그 사람의 손패를 나만 몰래 봐요. 다른 사람은 ‘누가 누구를 봤다’는 것만 알고 카드는 몰라요. 본 내용은 ‘내 정보 기록’에 남아요.', example: '상대가 공주(8)를 들고 있는 걸 봤다 → 다음 차례에 별감으로 ‘공주’를 추측하면 탈락시킬 수 있어요.', tip: '상대가 카드를 바꾸거나 새로 뽑으면 내가 본 정보는 달라질 수 있어요.' },
  3: { name: '무관', emoji: '⚔️', count: 2, target: 'other', brief: '비교해서 작은 쪽 탈락', desc: '한 명과 손패를 몰래 비교해요. 숫자가 작은 쪽이 탈락하고, 같으면 아무 일도 없어요.', detail: '한 명을 골라 서로의 손패를 몰래 비교해요. 숫자가 더 작은 쪽이 탈락해요. 같으면 둘 다 안전해요. 비교한 두 사람만 서로의 카드를 알게 돼요.', example: '내 손에 남는 카드 5 vs 상대 3 → 상대 탈락. 내 카드 2 vs 상대 6 → 내가 탈락!', tip: '무관을 내고 손에 남는 카드가 높을 때 쓰면 이길 가능성이 커요. 낮은 카드가 남으면 위험해요.' },
  4: { name: '상궁', emoji: '🛡️', count: 2, target: null, brief: '다음 내 차례까지 보호', desc: '다음 내 차례까지 아무도 나를 대상으로 삼을 수 없어요.', detail: '이 카드를 낸 순간부터 내 다음 차례가 올 때까지, 아무도 나를 카드의 대상으로 고를 수 없어요.', example: '공주(8)를 들고 있을 때 상궁을 내면, 내 다음 차례까지 별감이나 무관에 걸릴 걱정이 없어요.', tip: '다른 사람이 모두 보호받고 있으면 쓸 대상이 없어서, 그 카드는 효과 없이 그냥 나가요.' },
  5: { name: '세자', emoji: '🤴', count: 2, target: 'any', brief: '손패를 버리고 새로 뽑게 (공주면 탈락)', desc: '한 명(자신도 가능)이 손패를 버리고 새 카드를 뽑아요. 공주를 버리게 되면 탈락해요.', detail: '한 명을 골라요. 나 자신도 고를 수 있어요. 고른 사람은 손패를 공개하며 버리고, 덱에서 새 카드를 한 장 뽑아요. 버린 카드가 공주(8)면 그 사람은 탈락!', example: '상대가 공주를 들고 있다는 걸 나인으로 알았다 → 세자로 그 사람을 골라 공주를 버리게 만들면 탈락시킬 수 있어요.', tip: '대상이 나뿐이면 나에게 써야 해요. 이때는 내 남은 손패를 버려요. 그게 공주면 내가 탈락하니 조심하세요!' },
  6: { name: '영의정', emoji: '📜', count: 1, target: 'other', brief: '손패 서로 바꾸기', desc: '한 명과 손패를 서로 바꿔요.', detail: '한 명을 골라 서로 손패를 맞바꿔요. 바꾼 두 사람만 새로 받은 카드를 알게 돼요.', example: '내 손에 낮은 별감(1)만 남았는데 상대가 높은 카드를 들고 있을 것 같다 → 영의정으로 바꿔 와요.', tip: '공주를 들고 있는 사람과 바꾸면 내가 공주를 갖게 돼요. 공주를 지키는 데 유리해요.' },
  7: { name: '대비', emoji: '🪭', count: 1, target: null, brief: '세자·영의정과 함께면 반드시 냄', desc: '세자나 영의정과 함께 들고 있으면, 반드시 이 카드를 내야 해요.', detail: '아무 효과가 없어요. 하지만 세자(5)나 영의정(6)과 함께 들고 있으면, 반드시 대비를 먼저 내야 해요.', example: '손패가 [대비, 세자]면 세자는 못 내고 대비를 내야 해요. 손패가 [대비, 별감]이면 마음대로 골라도 돼요.', tip: '세자나 영의정이 없는데 일부러 대비를 내서 ‘나는 높은 카드를 들고 있다’고 속일 수도 있어요.' },
  8: { name: '공주', emoji: '👸', count: 1, target: null, brief: '내거나 버리면 탈락!', desc: '이 카드를 내거나 버리게 되면 그 자리에서 탈락해요. 가장 힘이 세지만 지키기 어려워요.', detail: '가장 힘이 센 카드(8)예요. 하지만 이 카드를 내거나 세자 때문에 버리게 되면 그 자리에서 탈락해요. 들고만 있으면 돼요.', example: '손에 공주와 다른 카드가 있으면 다른 카드를 내면 돼요. 덱이 끝났을 때 공주를 들고 살아 있으면 대부분 라운드를 이겨요.', tip: '상궁으로 지키고, 별감·무관·세자를 맞지 않게 조심하세요. 상대가 나인으로 내 카드를 봤다면 바로 노려질 수 있어요.' },
};


// 게임 설명 탭에 나오는 내용 (3줄 요약 + 진행 방법 + 카드별 자세한 설명)
const HELP = {
  summary: [
    '🃏 **한 장 뽑고, 한 장 내요.** 손에 든 2장 중 1장을 내서 효과로 상대를 탈락시켜요.',
    '🔢 **숫자가 클수록 강해요.** 단, 공주(8)는 내거나 버리게 되면 바로 탈락!',
    '🏆 **마지막까지 살아남거나**, 덱이 끝났을 때 **가장 높은 카드**를 든 사람이 라운드 승리! ❤를 먼저 모으면 우승이에요.',
  ],
  sections: [
    { title: '진행 방법', lines: [
      '시작할 때 모두 카드 한 장을 손에 들어요. (덱 맨 위 한 장은 뒷면으로 치워 둬요. 2명이면 공개 카드 3장도 치워 둬요)',
      '내 차례가 되면 덱에서 카드 한 장을 뽑아요. 이제 손에 카드가 2장이에요.',
      '두 장 중 하나를 골라 내고, 그 카드의 효과를 써요. (카드를 누르면 대상과 추측할 카드를 고르는 창이 나와요)',
      '낸 카드는 내 앞에 쌓이고 모두에게 보여요. 다음 사람 차례! 탈락한 사람은 건너뛰어요.',
    ] },
    { title: '라운드는 언제 끝나요?', lines: [
      '한 명만 남으면 그 사람이 라운드 승리!',
      '덱이 바닥나면 살아남은 사람들이 손패를 공개해요. 가장 높은 숫자를 든 사람이 승리, 같으면 지금까지 낸 카드의 숫자 합이 큰 사람이 승리해요. 그것도 같으면 모두 승리!',
      '라운드를 이기면 밀서 토큰 ❤ 1개를 얻어요. 2명은 7개, 3명은 5개, 4명은 4개를 먼저 모으면 최종 우승!',
    ] },
    { title: '알아둘 규칙', lines: [
      '상궁으로 보호받는 사람과 이미 탈락한 사람은 카드의 대상이 될 수 없어요.',
      '대상이 아무도 없으면 카드는 효과 없이 그냥 나가요. (세자만 나 자신에게 써요)',
      '낸 카드와 탈락한 사람의 카드는 모두에게 공개돼요. 기억하면 상대 카드를 추리하기 쉬워요.',
      '내 차례는 90초예요. 시간이 지나면 낼 수 있는 카드 중 하나가 자동으로 나가요.',
    ] },
  ],
};

module.exports = {
  id: 'letter',
  name: '밀서 대작전',
  emoji: '💌',
  accent: '#f472b6',
  desc: '손에 든 두 장 중 하나를 내며 상대를 탈락시켜요. 끝까지 공주님께 밀서를 전하는 사람이 승리!',
  rules: [
    '모두 카드 한 장을 들고 시작해요. 내 차례가 되면 한 장을 뽑고, 손에 든 두 장 중 하나를 내서 효과를 써요.',
    '카드는 숫자가 클수록 힘이 세요. 효과로 상대의 카드를 추측하거나, 몰래 보거나, 비교하거나, 바꿔요.',
    '라운드는 한 명만 남거나 덱이 바닥나면 끝나요. 덱이 바닥나면 가장 높은 숫자의 카드를 든 사람이 이겨요.',
    '라운드를 이기면 밀서 토큰(❤) 1개! 먼저 목표 개수를 모으면 승리해요. (2명 7개, 3명 5개, 4명 4개)',
    '내 차례에는 90초 안에 카드를 내야 해요. 시간이 지나면 자동으로 한 장이 나가요.',
  ],
  min: CFG.MIN,
  max: CFG.MAX,
  help: {
    summary: HELP.summary,
    sections: HELP.sections,
    groups: [{
      title: '카드 8장 (숫자가 클수록 힘이 세요)',
      items: Object.entries(CARDS).map(([n, c]) => ({ badge: n, emoji: c.emoji, title: c.name, sub: `× ${c.count}장`, color: HUE[n], text: c.detail, example: c.example, tip: c.tip })),
    }],
  },

  create(api) {
    const later = (g, ms, fn) => { const h = setTimeout(fn, ms); g.timers.add(h); return h; };
    const clearTimers = (g) => { g.timers.forEach((h) => clearTimeout(h)); g.timers.clear(); };
    const cardName = (t) => `${CARDS[t].emoji} ${CARDS[t].name}(${t})`;
    const seatOf = (g, id) => g.seats.find((s) => s.id === id);
    const alive = (g) => g.seats.filter((s) => s.alive);
    const pub = (room, text) => { room.g.log.push({ t: Date.now(), text }); };
    const note = (g, s, text) => s.notes.push({ round: g.round, text });
    // 방금 일어난 일을 한눈에 보이게 구조화해서 모두에게 보여 줘요. tone: kill(탈락) | safe(보호) | info(몰래 확인) | swap(교환) | plain
    const setEvent = (g, e) => { g.eventSeq += 1; g.lastEvent = { seq: g.eventSeq, t: Date.now(), ...e }; };

    function buildDeck() {
      if (CFG.FORCE_DECK) return CFG.FORCE_DECK.split(',').map((x) => Number(x.trim())).filter((n) => CARDS[n]).reverse();   // pop() 이 맨 위
      const d = [];
      Object.keys(CARDS).forEach((t) => { for (let i = 0; i < CARDS[t].count; i++) d.push(Number(t)); });
      return shuffle(d);
    }
    const draw = (g) => {
      if (g.deck.length) return g.deck.pop();
      const c = g.setAside;               // 덱이 비면 처음에 치워 둔 카드를 (한 번만) 뽑아요
      g.setAside = null;
      return c;
    };

    /* ───────── 시작 / 라운드 ───────── */
    function start(room, gamers) {
      const order = CFG.FORCE_DECK ? gamers : shuffle(gamers);
      const g = (room.g = {
        phase: 'play', round: 0, goal: CFG.GOAL[order.length],
        seats: order.map((p) => ({
          id: p.id, name: p.name, avatar: p.avatar, color: p.color,
          hand: [], discards: [], alive: true, protected: false, tokens: 0, left: false, notes: [],
        })),
        deck: [], setAside: null, faceUp: [], turnIdx: 0, turnEnds: 0, nextAt: 0, nextReady: new Set(),
        log: [], reveal: null, result: null, lastWinnerIdx: -1, timers: new Set(), lastEvent: null, eventSeq: 0,
      });
      pub(room, `💌 밀서 대작전을 시작해요! 밀서 토큰(❤) ${g.goal}개를 먼저 모으면 승리해요.`);
      newRound(room);
    }

    function newRound(room) {
      const g = room.g;
      clearTimers(g);
      g.round += 1;
      g.phase = 'play';
      g.reveal = null;
      g.nextReady = new Set();
      g.deck = buildDeck();
      g.setAside = g.deck.pop();          // 뒷면으로 치워 두는 카드
      g.faceUp = [];
      if (g.seats.filter((s) => !s.left).length === 2) for (let i = 0; i < 3; i++) g.faceUp.push(g.deck.pop());   // 2명일 때는 공개 3장도 치워요
      g.seats.forEach((s) => { s.hand = []; s.discards = []; s.alive = !s.left; s.protected = false; s.notes = []; });
      g.seats.forEach((s) => { if (s.alive) s.hand.push(draw(g)); });
      const start = g.lastWinnerIdx >= 0 && g.seats[g.lastWinnerIdx] && g.seats[g.lastWinnerIdx].alive ? g.lastWinnerIdx : (CFG.FORCE_DECK ? 0 : g.seats.indexOf(pick(alive(g))));
      pub(room, `📜 ${g.round}번째 라운드를 시작해요. (덱 ${g.deck.length}장)`);
      startTurn(room, start);
    }

    function startTurn(room, idx) {
      const g = room.g;
      clearTimers(g);
      const s = g.seats[idx];
      g.turnIdx = idx;
      s.protected = false;                // 상궁의 보호는 내 다음 차례가 올 때까지예요
      s.hand.push(draw(g));
      g.turnEnds = Date.now() + CFG.TURN_MS;
      later(g, CFG.TURN_MS, () => autoPlay(room));
      api.broadcast(room);
    }

    /* ───────── 낼 수 있는 수 ───────── */
    function targetsFor(g, seat, type) {
      const kind = CARDS[type].target;
      if (!kind) return [];
      return g.seats.filter((t) => t.alive && !t.protected && (t.id !== seat.id || kind === 'any'));
    }
    function mustCountess(hand) { return hand.includes(7) && (hand.includes(5) || hand.includes(6)); }
    function movesOf(g, seat) {
      return seat.hand.map((type, index) => {
        const allowed = !(mustCountess(seat.hand) && type !== 7);
        const kind = CARDS[type].target;
        const targets = kind ? targetsFor(g, seat, type).map((t) => t.id) : [];
        return { index, type, allowed, needsTarget: !!kind && targets.length > 0, targets, selfOnly: type === 5 && targets.length === 1 && targets[0] === seat.id, noTarget: !!kind && targets.length === 0 };
      });
    }

    /* ───────── 카드 내기 ───────── */
    function play(room, seat, msg) {
      const g = room.g;
      if (g.phase !== 'play') return { ok: false, error: '지금은 카드를 낼 수 없어요.' };
      if (g.seats[g.turnIdx] !== seat) return { ok: false, error: '지금은 내 차례가 아니에요.' };
      const idx = Number(msg.card);
      if (!Number.isInteger(idx) || !seat.hand[idx]) return { ok: false, error: '낼 카드를 골라 주세요.' };
      const mv = movesOf(g, seat)[idx];
      if (!mv.allowed) return { ok: false, error: '대비를 세자나 영의정과 함께 들고 있으면 대비를 먼저 내야 해요.' };
      let target = null;
      if (mv.needsTarget) {
        if (mv.selfOnly) target = seat;
        else {
          target = seatOf(g, String(msg.target || ''));
          if (!target || !mv.targets.includes(target.id)) return { ok: false, error: '카드를 쓸 대상을 골라 주세요. (보호받는 사람이나 탈락한 사람은 고를 수 없어요)' };
        }
      } else if (mv.noTarget && mv.type === 5) {
        target = seat;                    // 대상이 하나도 없으면 세자는 자신에게 써요
      }
      const type = mv.type;
      let guess = 0;
      if (type === 1 && target) {
        guess = Number(msg.guess);
        if (!(guess >= 2 && guess <= 8)) return { ok: false, error: '추측할 카드를 골라 주세요. (별감은 고를 수 없어요)' };
      }

      // 확정
      clearTimers(g);
      seat.hand.splice(idx, 1);
      seat.discards.push(type);
      const head = `${seat.name}님이 ${cardName(type)}을(를) 냈어요.`;
      const ev = { card: type, actorId: seat.id, targetId: target ? target.id : null, guess: guess || null, killedIds: [], tone: 'plain', headline: `${CARDS[type].emoji} ${seat.name}님의 ${CARDS[type].name}`, detail: '', auto: !!msg.auto };
      if (type === 1) {
        if (!target) { pub(room, `${head} 하지만 대상이 없어 아무 일도 없었어요.`); ev.detail = '대상이 없어 아무 일도 없었어요'; }
        else if (target.hand[0] === guess) { pub(room, `${head} ${target.name}님의 카드를 ${cardName(guess)}(이)라고 맞혀서 탈락시켰어요!`); ev.tone = 'kill'; ev.killedIds = [target.id]; ev.detail = `${target.name}님의 카드는 ${cardName(guess)}! 맞혀서 탈락시켰어요`; eliminate(room, target, '별감에게 들켰어요'); }
        else { pub(room, `${head} ${target.name}님의 카드를 ${cardName(guess)}(이)라고 추측했지만 틀렸어요.`); ev.detail = `${target.name}님은 ${cardName(guess)}이(가) 아니었어요 (빗나감)`; }
      } else if (type === 2) {
        if (!target) { pub(room, `${head} 하지만 대상이 없어 아무 일도 없었어요.`); ev.detail = '대상이 없어 아무 일도 없었어요'; }
        else { pub(room, `${head} ${target.name}님의 손패를 몰래 봤어요.`); note(g, seat, `👀 ${target.name}님의 손패는 ${cardName(target.hand[0])}였어요.`); ev.tone = 'info'; ev.detail = `${target.name}님의 손패를 몰래 봤어요 (본 사람만 알아요)`; }
      } else if (type === 3) {
        if (!target) { pub(room, `${head} 하지만 대상이 없어 아무 일도 없었어요.`); ev.detail = '대상이 없어 아무 일도 없었어요'; }
        else {
          const a = seat.hand[0], b = target.hand[0];
          note(g, seat, `⚔️ ${target.name}님과 비교: 내 ${cardName(a)} vs ${cardName(b)}`);
          note(g, target, `⚔️ ${seat.name}님과 비교: 내 ${cardName(b)} vs ${cardName(a)}`);
          if (a === b) { pub(room, `${head} ${target.name}님과 손패를 비교했지만 같아서 아무 일도 없었어요.`); ev.tone = 'info'; ev.detail = `${target.name}님과 비교했지만 숫자가 같아 무승부!`; }
          else if (a > b) { pub(room, `${head} ${target.name}님과 비교해서 이겼어요! ${target.name}님이 탈락해요.`); ev.tone = 'kill'; ev.killedIds = [target.id]; ev.detail = `${target.name}님(${cardName(b)})보다 높아서 승리! ${target.name}님 탈락`; eliminate(room, target, '무관과의 대결에서 졌어요'); }
          else { pub(room, `${head} ${target.name}님과 비교했는데 졌어요… ${seat.name}님이 탈락해요.`); ev.tone = 'kill'; ev.killedIds = [seat.id]; ev.detail = `${target.name}님(${cardName(b)})보다 낮아서 패배… ${seat.name}님 탈락`; eliminate(room, seat, '무관과의 대결에서 졌어요'); }
        }
      } else if (type === 4) {
        seat.protected = true;
        pub(room, `${head} 다음 차례까지 보호받아요.`);
        ev.tone = 'safe'; ev.detail = `${seat.name}님은 다음 차례까지 아무도 건드릴 수 없어요`;
      } else if (type === 5) {
        const t = target || seat;
        const dropped = t.hand.pop();
        t.discards.push(dropped);
        ev.targetId = t.id;
        if (dropped === 8) { pub(room, `${head} ${t.name}님이 ${cardName(8)}을(를) 버리게 되어 탈락해요!`); t.hand = [dropped]; t.discards.pop(); ev.tone = 'kill'; ev.killedIds = [t.id]; ev.detail = `${t.name}님이 공주를 버리게 되어 탈락!`; eliminate(room, t, '공주를 버렸어요'); }
        else { pub(room, `${head} ${t.name}님이 ${cardName(dropped)}을(를) 버리고 새 카드를 뽑았어요.`); t.hand.push(draw(g)); ev.detail = `${t.name}님이 ${cardName(dropped)}을(를) 버리고 새 카드를 뽑았어요`; }
      } else if (type === 6) {
        if (!target) { pub(room, `${head} 하지만 대상이 없어 아무 일도 없었어요.`); ev.detail = '대상이 없어 아무 일도 없었어요'; }
        else { [seat.hand[0], target.hand[0]] = [target.hand[0], seat.hand[0]]; pub(room, `${head} ${target.name}님과 손패를 바꿨어요.`); note(g, seat, `📜 ${target.name}님과 바꿔서 이제 내 손패는 ${cardName(seat.hand[0])}예요.`); note(g, target, `📜 ${seat.name}님이 손패를 바꿔 갔어요. 이제 내 손패는 ${cardName(target.hand[0])}예요.`); ev.tone = 'swap'; ev.detail = `${seat.name}님과 ${target.name}님이 손패를 서로 바꿨어요`; }
      } else if (type === 7) {
        pub(room, head);
        ev.detail = '효과는 없어요 (손패를 숨기는 카드일 수도!)';
      } else if (type === 8) {
        pub(room, `${head} 공주님이 밀서를 가로채 ${seat.name}님이 탈락해요!`);
        seat.hand.push(8); seat.discards.pop();   // 공주는 손에서 탈락과 함께 공개돼요
        ev.tone = 'kill'; ev.killedIds = [seat.id]; ev.detail = `${seat.name}님이 공주를 내서 탈락!`;
        eliminate(room, seat, '공주를 냈어요');
      }
      setEvent(g, ev);
      afterPlay(room);
      return { ok: true };
    }

    function eliminate(room, s, why) {
      s.alive = false;
      s.protected = false;
      s.hand.forEach((c) => s.discards.push(c));   // 손패를 공개하며 버려요
      s.hand = [];
      pub(room, `💀 ${s.name}님 탈락! (${why})`);
    }

    function afterPlay(room) {
      const g = room.g;
      if (alive(g).length <= 1) return endRound(room, 'last');
      if (g.deck.length === 0) return endRound(room, 'deck');
      // 다음으로 살아 있는 사람
      let i = g.turnIdx;
      do { i = (i + 1) % g.seats.length; } while (!g.seats[i].alive);
      startTurn(room, i);
    }

    function endRound(room, how) {
      const g = room.g;
      clearTimers(g);
      const live = alive(g);
      let winners;
      if (how === 'last' || live.length === 1) winners = live;
      else {
        const best = Math.max(...live.map((s) => s.hand[0]));
        let top = live.filter((s) => s.hand[0] === best);
        if (top.length > 1) {
          const sum = (s) => s.discards.reduce((a, b) => a + b, 0);
          const bestSum = Math.max(...top.map(sum));
          top = top.filter((s) => sum(s) === bestSum);
        }
        winners = top;
      }
      g.reveal = g.seats.map((s) => ({ id: s.id, alive: s.alive, hand: s.alive ? s.hand.slice() : [] }));
      winners.forEach((s) => { s.tokens += 1; });
      g.lastWinnerIdx = g.seats.indexOf(winners[0]);
      const names = winners.map((s) => s.name).join(', ');
      pub(room, how === 'last' ? `🏁 라운드 종료! 마지막까지 남은 ${names}님이 밀서 토큰 ❤ 을 얻어요.` : `🏁 덱이 바닥났어요! 가장 높은 카드를 든 ${names}님이 밀서 토큰 ❤ 을 얻어요.`);
      g.roundWinners = winners.map((s) => s.id);
      const goal = g.goal;
      const maxTok = Math.max(...g.seats.map((s) => s.tokens));
      if (maxTok >= goal) {
        const champs = g.seats.filter((s) => s.tokens === maxTok);
        return finish(room, champs);
      }
      g.phase = 'roundEnd';
      g.nextAt = Date.now() + CFG.NEXT_MS;
      later(g, CFG.NEXT_MS, () => nextRound(room));
      api.broadcast(room);
    }

    function nextRound(room) {
      const g = room.g;
      if (!g || g.phase !== 'roundEnd') return;
      if (g.seats.filter((s) => !s.left).length < 2) return finish(room, [], true);
      newRound(room);
    }

    function finish(room, champs, abort = false) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'ended';
      g.turnEnds = 0;
      const gains = {};
      if (!abort) champs.forEach((s) => { const p = room.players.find((x) => x.id === s.id); if (p) { api.addScore(room, p, CFG.SCORE.win); gains[s.id] = CFG.SCORE.win; } });
      g.result = {
        abort,
        winners: champs.map((s) => s.id),
        players: g.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, color: s.color, tokens: s.tokens, left: s.left, win: champs.includes(s), gain: gains[s.id] || 0, score: (room.players.find((x) => x.id === s.id) || {}).score || 0 })),
        reason: abort ? '인원이 부족해 게임이 중단되었어요. (점수 없음)' : `${champs.map((s) => s.name).join(', ')}님이 밀서를 공주님께 전했어요! 🎉`,
      };
      pub(room, `🎉 ${abort ? '게임 중단' : '게임 종료'}! ${g.result.reason}`);
      api.broadcast(room);
    }

    // 시간 초과: 가능한 수 중에서 무난하게 하나를 대신 내 줘요 (공주는 되도록 지켜요)
    function autoPlay(room) {
      const g = room.g;
      if (!g || g.phase !== 'play') return;
      const seat = g.seats[g.turnIdx];
      const moves = movesOf(g, seat).filter((m) => m.allowed);
      const safe = moves.filter((m) => m.type !== 8);
      const m = pick(safe.length ? safe : moves);
      pub(room, `⏰ ${seat.name}님이 시간 안에 내지 못해 자동으로 카드가 나가요.`);
      const msg = { card: m.index, auto: true };
      if (m.needsTarget && !m.selfOnly) msg.target = pick(m.targets);
      if (m.type === 1) msg.guess = pick([2, 3, 4, 5, 6, 7, 8]);
      play(room, seat, msg);
    }

    /* ───────── 보기 ───────── */
    function view(room, pid) {
      const g = room.g;
      const me = seatOf(g, pid);
      const myTurn = !!(me && g.phase === 'play' && g.seats[g.turnIdx] === me);
      const reveal = g.phase === 'roundEnd' || g.phase === 'ended' ? g.reveal : null;
      return {
        phase: g.phase, round: g.round, goal: g.goal, deckCount: g.deck.length,
        faceUp: g.faceUp.slice(),
        turnId: g.phase === 'play' ? g.seats[g.turnIdx].id : null,
        endsAt: g.phase === 'play' ? g.turnEnds : g.phase === 'roundEnd' ? g.nextAt : 0,
        cards: Object.fromEntries(Object.entries(CARDS).map(([t, c]) => [t, { name: c.name, emoji: c.emoji, count: c.count, brief: c.brief, desc: c.desc, target: c.target }])),
        last: g.lastEvent,
        seats: g.seats.map((s) => ({
          id: s.id, name: s.name, avatar: s.avatar, color: s.color, alive: s.alive, protected: s.protected, tokens: s.tokens, left: s.left,
          discards: s.discards.slice(), handCount: s.hand.length,
        })),
        log: g.log.slice(-60),
        reveal, roundWinners: reveal ? g.roundWinners : [],
        nextReady: [...g.nextReady],
        result: g.phase === 'ended' ? g.result : null,
        me: me ? {
          hand: me.hand.slice(), alive: me.alive, notes: me.notes.slice(-12),
          moves: myTurn ? movesOf(g, me) : [],
          mustCountess: myTurn && mustCountess(me.hand),
        } : null,
      };
    }

    /* ───────── 동작 ───────── */
    function action(room, player, msg) {
      const g = room.g;
      if (!g) return { ok: false, error: '진행 중인 게임이 아니에요.' };
      const me = seatOf(g, player.id);
      if (!me) return { ok: false, error: '이번 판 참가자가 아니에요.' };
      if (msg.type === 'play') {
        if (!me.alive) return { ok: false, error: '탈락해서 카드를 낼 수 없어요.' };
        return play(room, me, { ...msg, auto: false });   // 자동 진행 표시는 서버만 붙여요
      }
      if (msg.type === 'next') {
        if (g.phase !== 'roundEnd') return { ok: false, error: '지금은 다음 라운드로 넘어갈 수 없어요.' };
        g.nextReady.add(me.id);
        if (g.seats.filter((s) => !s.left).every((s) => g.nextReady.has(s.id))) nextRound(room);
        return { ok: true };
      }
      return { ok: false, error: '알 수 없는 동작이에요.' };
    }

    /* ───────── 허브 훅 ───────── */
    function onLeave(room, player) {
      const g = room.g;
      if (!g || g.phase === 'ended') return;
      const s = seatOf(g, player.id);
      if (!s || s.left) return;
      const wasTurn = g.phase === 'play' && g.seats[g.turnIdx] === s;
      s.left = true;
      pub(room, `🚪 ${s.name}님이 게임을 떠났어요.`);
      setEvent(g, { card: null, actorId: s.id, targetId: null, guess: null, killedIds: s.alive ? [s.id] : [], tone: s.alive ? 'kill' : 'plain', headline: `🚪 ${s.name}님이 떠났어요`, detail: s.alive ? `${s.name}님이 탈락 처리돼요` : '', auto: false });
      if (g.seats.filter((x) => !x.left).length < 2) return finish(room, [], true);
      if (s.alive) { eliminate(room, s, '자리를 떠났어요'); if (g.phase === 'play') { if (alive(g).length <= 1) return endRound(room, 'last'); if (wasTurn) afterPlay(room); } }
      if (g.phase === 'roundEnd') { g.nextReady.delete(s.id); if (g.seats.filter((x) => !x.left).every((x) => g.nextReady.has(x.id))) nextRound(room); }
    }

    function dispose(room) {
      if (room.g) clearTimers(room.g);
      room.g = null;
    }

    return { start, view, action, onLeave, dispose, isFinished: (room) => !!room.g && room.g.phase === 'ended' };
  },
};
