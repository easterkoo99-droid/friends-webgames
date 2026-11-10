'use strict';
/**
 * 미니게임지옥 - 미니게임 10종을 랜덤 순서로 이어서 하는 점수제 대결 (서버)
 *
 * 진행
 *  - 입장 후 '게임 준비' → 준비한 사람이 2명 이상이면 준비한 누구든 시작
 *  - 한 판 = 10라운드. 매 판 시작할 때 미니게임 12종 중 10종이 '랜덤으로 뽑혀 랜덤 순서'로 배치돼요 (같은 게임이 두 번 나오지 않아요)
 *  - 문제마다 점수를 얻고, 전 라운드 점수를 합산해 순위를 정해요 (탈락 없음)
 *  - 게임 도중 들어온 사람은 관전자, 준비를 눌러 두면 다음 판부터 참가
 *
 * 미니게임(GAMES) 12종
 *  꽁꽁(주관식 골든벨) · 연상퀴즈 · OX 퀴즈 · 초성 퀴즈 · 인물 맞추기
 *  업다운 · 다른 그림 찾기 · 암산 대결 · 기억력 · 반응속도
 *  10초 맞추기 · 끝말잇기
 *
 * 문제 데이터는 games/quizdata.js 에서 추가/수정할 수 있어요. (업다운/다른 그림/암산/기억력/반응속도는 매번 새로 만들어져요)
 * 새 미니게임을 추가하려면 GAMES 에 항목 하나를 더하고 ORDER 에 이름을 넣으면 돼요.
 */
const { makeCode, makeToken, makeId, cleanName, cleanText, shuffle, randInt, pick } = require('./util');
const BANK = require('./quizdata');

const CFG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 12,   // 한 판 최대 인원
  MAX_ROOM: 16,      // 관전자 포함 방 정원
  INTRO_MS: 3500,
  BOARD_MS: 5500,
  DROP_GRACE_MS: 25000,
  ROOM_TTL_MS: 10 * 60 * 1000,
  CHAT_KEEP: 80,
  GUESS_COOLDOWN_MS: 600,
  ROUNDS: 10,                                        // 한 판의 라운드 수 (미니게임이 이보다 많으면 랜덤으로 뽑아요)
  SHUFFLE_PLAN: process.env.QP_NO_SHUFFLE !== '1', // 테스트용: QP_NO_SHUFFLE=1 이면 고정 순서
  FORCE_PLAN: (process.env.QP_PLAN || '').split(',').map((x) => x.trim()).filter(Boolean), // 테스트용: 라운드 구성을 직접 지정
  SHOW_UPCOMING: false,                              // true 면 다음 라운드 이름을 미리 보여줘요
  RANK_POINTS: [10, 7, 5],                           // 먼저 맞힌 순서대로 (초성/업다운/다른 그림/암산)
  RANK_REST: 3,
};

const AVATARS = ['🎤', '🎯', '🎲', '🎈', '🎩', '🧩', '🎸', '🎺', '🥁', '🎻', '🎹', '🪄', '🎬', '🎨', '🎪', '🎠'];
const COLORS = [
  '#ff8a80', '#ffb74d', '#ffe14d', '#c6e377', '#5fd38d', '#3fc7c0', '#5bc0f8', '#8e9bff',
  '#c58bff', '#ff7eb6', '#ff9e5e', '#a3e635', '#34d399', '#22d3ee', '#818cf8', '#f472b6',
];

/* ───────── 유틸 ───────── */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function choseongOf(str) {
  return [...str].map((ch) => {
    const c = ch.codePointAt(0);
    return c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
  }).join('');
}
// 정답 비교용 정규화: 대소문자/공백/기호 무시
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[\s.,!?'"“”‘’·\-_~()[\]{}]/g, '');
const acceptOf = (src) => new Set([norm(src.answer)].concat((src.aliases || []).map(norm)));

// 끝말잇기: 시작 단어와 두음법칙(ㄹ→ㄴ/ㅇ, ㄴ→ㅇ) 처리
const SEEDS = ['기차', '바나나', '나비', '하마', '고래', '나무', '사자', '호랑이', '우주', '지구', '학교', '가방', '의자', '수박', '비행기'];
const IOTIZED = new Set([2, 3, 6, 7, 12, 17, 20]); // ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ ㅣ
const decomp = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 }; };
const compose = (cho, jung, jong) => String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
function chainStarts(syl) {
  const out = new Set([syl]);
  const { cho, jung, jong } = decomp(syl);
  if (cho === 5) out.add(IOTIZED.has(jung) ? compose(11, jung, jong) : compose(2, jung, jong)); // 리→이, 라→나
  else if (cho === 2 && IOTIZED.has(jung)) out.add(compose(11, jung, jong));                      // 녀→여
  return [...out];
}

const ODD_PAIRS = [
  ['😀', '😃'], ['🍎', '🍅'], ['🌕', '🌝'], ['🐶', '🐕'], ['⭐', '🌟'], ['🟦', '🟪'],
  ['😠', '😡'], ['🐱', '🐈'], ['🍓', '🍒'], ['🔔', '🛎️'], ['🙂', '😊'], ['🍊', '🍑'],
];
const MEMORY_PALETTE = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍋', '🍑', '🥝'];

// 암산 문제 생성: 번호가 커질수록 어려워져요
function genMath(i) {
  if (i <= 1) { const a = randInt(10, 99), b = randInt(10, 99); return { expr: `${a} + ${b}`, ans: a + b }; }
  if (i === 2) { const a = randInt(60, 199), b = randInt(11, 59); return { expr: `${a} − ${b}`, ans: a - b }; }
  if (i === 3) { const a = randInt(11, 19), b = randInt(3, 9); return { expr: `${a} × ${b}`, ans: a * b }; }
  const a = randInt(10, 50), b = randInt(2, 9), c = randInt(2, 9);
  return i === 4 ? { expr: `${a} + ${b} × ${c}`, ans: a + b * c } : { expr: `(${a} + ${b}) × ${c}`, ans: (a + b) * c };
}

module.exports = function registerMiniGameHell(io) {
  const rooms = new Map();

  const gamersOf = (room) => room.players.filter((p) => p.inGame);
  const nameOf = (room, id) => (room.players.find((p) => p.id === id) || {}).name || '?';
  const connectedGamers = (room) => gamersOf(room).filter((p) => p.connected);
  const existsIn = (room) => (id) => room.players.some((p) => p.id === id);

  function clearTimers(room) {
    (room.timers || []).forEach(clearTimeout);
    room.timers = [];
  }
  function later(room, ms, fn) {
    const t = setTimeout(fn, ms);
    room.timers.push(t);
    return t;
  }

  function pushChatSys(room, text) {
    const msg = { sys: true, text, t: Date.now() };
    room.chat.push(msg);
    if (room.chat.length > CFG.CHAT_KEEP) room.chat.shift();
    io.to(`qp:${room.code}`).emit('qp_chat', msg);
  }

  /* ───────── 점수 도우미 ───────── */
  function award(q, p, gain) {
    q.gains[p.id] = (q.gains[p.id] || 0) + gain;
    p.score += gain;
    p.roundGain += gain;
  }
  function solve(q, p, gain) {
    q.solved.add(p.id);
    q.solvedOrder.push(p.id);
    award(q, p, gain);
  }
  function rankGain(q) {
    const n = q.solvedOrder.length;
    return n < CFG.RANK_POINTS.length ? CFG.RANK_POINTS[n] : CFG.RANK_REST;
  }
  function gate(p, now, ms) {
    if (now - p.lastGuessAt < ms) return { ok: false, error: '너무 빨라요. 잠시 후 다시 입력해 주세요.' };
    p.lastGuessAt = now;
    return null;
  }
  function pickQuestion(room, type) {
    const bank = BANK[type];
    let pool = bank.filter((q) => !room.used.has(q.id));
    if (pool.length === 0) {
      bank.forEach((q) => room.used.delete(q.id));
      pool = bank.slice();
    }
    const q = pick(pool);
    room.used.add(q.id);
    return q;
  }

  /* ═════════ 미니게임 정의 ═════════
   * kind: 'race'  = 맞히는 즉시 점수를 받는 방식 (맞힌 사람 표시)
   *       'blind' = 한 번 제출하고 시간이 끝나면 한꺼번에 채점/공개
   * init(room, q)         문제 만들기 + 필요한 타이머 예약 (q.limit 필수)
   * view(room, q, pid, reveal)  화면에 보낼 문제 정보 (정답은 reveal 일 때만!)
   * me(room, q, pid)      내 상태(다른 사람에게는 비공개)
   * answer(room, q, p, data, now)  답 제출 처리 → { ok, ... } (그대로 클라이언트에 응답)
   * finish(room, q)       시간이 끝났을 때 채점 (blind 계열)
   * done(room, q, gs)     연결된 참가자 모두 끝났는지 (조기 종료)
   * answerText(q)         공개 때 보여줄 정답 문구
   * reveal(room, q)       공개 화면 추가 정보
   */
  function clueGame(title, count, desc, bankKey, cfg) {
    return {
      title, count, desc, kind: 'race', revealMs: 5000,
      init(room, q) {
        q.src = pickQuestion(room, bankKey);
        q.accept = acceptOf(q.src);
        q.revealed = 1;
        const n = q.src.clues.length;
        q.limit = cfg.clueMs * n + cfg.tailMs;
        for (let i = 1; i < n; i++) {
          later(room, i * cfg.clueMs, () => {
            if (room.q === q && room.step === 'question') { q.revealed = i + 1; broadcast(room); }
          });
        }
      },
      view(room, q, pid, reveal) {
        return {
          clueTotal: q.src.clues.length, revealed: q.revealed,
          clues: reveal ? q.src.clues : q.src.clues.slice(0, q.revealed),
          points: cfg.points, firstBonus: cfg.firstBonus,
          pointsNow: cfg.points[Math.min(q.revealed, cfg.points.length) - 1],
        };
      },
      answer(room, q, p, data, now) {
        if (q.solved.has(p.id)) return { ok: false, error: '이미 맞혔어요!' };
        const g = gate(p, now, CFG.GUESS_COOLDOWN_MS);
        if (g) return g;
        const guess = norm(cleanText(data && data.value, 60));
        if (!guess) return { ok: false, error: '정답을 입력해 주세요.' };
        if (!q.accept.has(guess)) return { ok: true, correct: false, noBroadcast: true };
        let gain = cfg.points[Math.min(q.revealed, cfg.points.length) - 1];
        if (q.solvedOrder.length === 0) gain += cfg.firstBonus;
        solve(q, p, gain);
        return { ok: true, correct: true, gain };
      },
      done: (room, q, gs) => gs.every((p) => q.solved.has(p.id)),
      answerText: (q) => q.src.answer,
    };
  }

  const GAMES = {
    /* 꽁꽁: 주관식 골든벨. 한 번만 제출, 채점/공개는 시간이 끝난 뒤 */
    ggong: {
      title: '꽁꽁', count: 4, kind: 'blind', revealMs: 8000, limitMs: 20000, base: 10, speedBonus: 5,
      desc: '주관식 골든벨! 모두 같은 문제를 동시에 풀어요. 답은 한 번만 낼 수 있고, 시간이 끝나면 정답과 모두의 답이 한꺼번에 공개돼요. 맞히면 +10점, 빨리 낼수록 최대 +5점 보너스!',
      init(room, q) { q.src = pickQuestion(room, 'ggong'); q.accept = acceptOf(q.src); q.limit = this.limitMs; },
      view(room, q) { return { prompt: q.src.q, points: [this.base, this.base + this.speedBonus] }; },
      me(room, q, pid) { const a = q.answers[pid]; return { choice: a ? a.text : null }; },
      answer(room, q, p, data, now) {
        if (q.answers[p.id]) return { ok: false, error: '이미 제출했어요. 정답은 시간이 끝나면 공개돼요.' };
        const text = cleanText(data && data.value, 40);
        if (!text) return { ok: false, error: '정답을 입력해 주세요.' };
        q.answers[p.id] = { text, at: now };
        return { ok: true, locked: true };   // 맞았는지는 알려주지 않아요 (골든벨 방식)
      },
      finish(room, q) {
        for (const [pid, a] of Object.entries(q.answers)) {
          const p = room.players.find((x) => x.id === pid);
          if (!p || !p.inGame) continue;
          a.ok = q.accept.has(norm(a.text));
          if (!a.ok) continue;
          const remain = Math.max(0, q.endsAt - a.at) / q.limit;
          award(q, p, this.base + Math.round(this.speedBonus * remain));
        }
      },
      done: (room, q, gs) => gs.every((p) => q.answers[p.id]),
      answerText: (q) => q.src.answer,
      reveal(room, q) {
        const ex = existsIn(room);
        return { answers: Object.fromEntries(Object.entries(q.answers).filter(([id]) => ex(id)).map(([id, a]) => [id, { text: a.text, ok: !!a.ok }])) };
      },
    },

    assoc: clueGame('연상퀴즈', 3, '연상되는 힌트가 하나씩 공개돼요. 일찍 맞힐수록 높은 점수! (첫 정답자 보너스 +3)', 'assoc',
      { clueMs: 6000, tailMs: 4000, points: [10, 8, 6, 4, 2], firstBonus: 3 }),

    ox: {
      title: 'OX 퀴즈', count: 5, kind: 'blind', revealMs: 6500, limitMs: 12000, base: 8, speedBonus: 4,
      desc: 'O 또는 X를 골라요. 맞히면 +8점, 빨리 고를수록 최대 +4점 보너스!',
      init(room, q) { q.src = pickQuestion(room, 'ox'); q.limit = this.limitMs; },
      view(room, q) { return { statement: q.src.statement, points: [this.base, this.base + this.speedBonus] }; },
      me(room, q, pid) { const a = q.answers[pid]; return { choice: a ? a.v : null }; },
      answer(room, q, p, data, now) {
        const v = data && data.value === 'O' ? 'O' : data && data.value === 'X' ? 'X' : null;
        if (!v) return { ok: false, error: 'O 또는 X를 선택해 주세요.' };
        if (q.answers[p.id]) return { ok: false, error: '이미 선택했어요.' };
        q.answers[p.id] = { v, at: now };
        return { ok: true };
      },
      finish(room, q) {
        for (const [pid, a] of Object.entries(q.answers)) {
          const p = room.players.find((x) => x.id === pid);
          if (!p || !p.inGame || a.v !== q.src.answer) continue;
          const remain = Math.max(0, q.endsAt - a.at) / q.limit;
          award(q, p, this.base + Math.round(this.speedBonus * remain));
        }
      },
      done: (room, q, gs) => gs.every((p) => q.answers[p.id]),
      answerText: (q) => q.src.answer,
      reveal(room, q) {
        const ex = existsIn(room);
        return {
          explain: q.src.explain || null,
          choices: Object.fromEntries(Object.entries(q.answers).filter(([id]) => ex(id)).map(([id, a]) => [id, a.v])),
        };
      },
    },

    choseong: {
      title: '초성 퀴즈', count: 4, kind: 'race', revealMs: 5000, limitMs: 25000, hintMs: 12000,
      desc: '초성을 보고 정답을 입력해요. 먼저 맞힐수록 높은 점수! (10 · 7 · 5 · 3점)',
      init(room, q) {
        q.src = pickQuestion(room, 'choseong');
        q.accept = acceptOf(q.src);
        q.limit = this.limitMs;
        later(room, this.hintMs, () => {
          if (room.q === q && room.step === 'question') { q.hintShown = true; broadcast(room); }
        });
      },
      view(room, q, pid, reveal) {
        const chars = [...q.src.answer.replace(/\s/g, '')];
        return {
          choseong: choseongOf(q.src.answer), category: q.src.category, length: chars.length,
          hintChar: q.hintShown || reveal ? chars[0] : null,
          points: CFG.RANK_POINTS.concat([CFG.RANK_REST]),
        };
      },
      answer(room, q, p, data, now) {
        if (q.solved.has(p.id)) return { ok: false, error: '이미 맞혔어요!' };
        const g = gate(p, now, CFG.GUESS_COOLDOWN_MS);
        if (g) return g;
        const guess = norm(cleanText(data && data.value, 60));
        if (!guess) return { ok: false, error: '정답을 입력해 주세요.' };
        if (!q.accept.has(guess)) return { ok: true, correct: false, noBroadcast: true };
        const gain = rankGain(q);
        solve(q, p, gain);
        return { ok: true, correct: true, gain };
      },
      done: (room, q, gs) => gs.every((p) => q.solved.has(p.id)),
      answerText: (q) => q.src.answer,
    },

    person: clueGame('인물 맞추기', 3, '힌트를 보고 인물을 맞혀요. 힌트가 적을수록 높은 점수! (첫 정답자 보너스 +3)', 'person',
      { clueMs: 7000, tailMs: 5000, points: [10, 7, 5, 3], firstBonus: 3 }),

    /* 업다운: 비밀 숫자를 맞혀요. 내 추측마다 UP/DOWN 힌트가 나와요 (남의 추측은 안 보여요) */
    updown: {
      title: '업다운', count: 3, kind: 'race', revealMs: 5000, limitMs: 30000, ranges: [50, 100, 200],
      desc: '비밀 숫자를 맞혀요! 숫자를 입력하면 정답이 더 큰지(UP) 작은지(DOWN) 알려줘요. 먼저 맞힐수록 높은 점수! (10 · 7 · 5 · 3점)',
      init(room, q) {
        q.max = this.ranges[Math.min(room.qIdx, this.ranges.length) - 1];
        q.secret = randInt(1, q.max);
        q.hist = {};
        q.limit = this.limitMs;
      },
      view(room, q) { return { range: { min: 1, max: q.max }, points: CFG.RANK_POINTS.concat([CFG.RANK_REST]) }; },
      me(room, q, pid) { return { history: q.hist[pid] || [] }; },
      answer(room, q, p, data, now) {
        if (q.solved.has(p.id)) return { ok: false, error: '이미 맞혔어요!' };
        const g = Number(String(data && data.value).trim());
        if (!Number.isInteger(g) || g < 1 || g > q.max) return { ok: false, error: `1 ~ ${q.max} 사이의 숫자를 입력해 주세요.` };
        const gt = gate(p, now, 350);
        if (gt) return gt;
        const h = (q.hist[p.id] = q.hist[p.id] || []);
        if (g === q.secret) {
          h.push({ g, r: 'correct' });
          const gain = rankGain(q);
          solve(q, p, gain);
          return { ok: true, correct: true, result: 'correct', gain };
        }
        const r = q.secret > g ? 'up' : 'down';
        h.push({ g, r });
        if (h.length > 40) h.shift();
        return { ok: true, correct: false, result: r };
      },
      done: (room, q, gs) => gs.every((p) => q.solved.has(p.id)),
      answerText: (q) => String(q.secret),
      reveal(room, q) {
        const ex = existsIn(room);
        return { counts: Object.fromEntries(q.solvedOrder.filter(ex).map((id) => [id, (q.hist[id] || []).length])) };
      },
    },

    /* 다른 그림 찾기: 비슷한 그림 속 다른 하나를 눌러요. 틀리면 잠깐 잠겨요 */
    odd: {
      title: '다른 그림 찾기', count: 4, kind: 'race', revealMs: 5000, limitMs: 20000, cols: 6, rows: 5, lockMs: 1500,
      desc: '똑같아 보이는 그림 속에 다른 하나가 숨어 있어요! 찾아서 누르세요. 틀리면 잠깐 잠겨요. 먼저 찾을수록 높은 점수! (10 · 7 · 5 · 3점)',
      init(room, q) {
        const [a, b] = shuffle(pick(ODD_PAIRS).slice());
        const n = this.cols * this.rows;
        q.odd = randInt(0, n - 1);
        q.grid = Array.from({ length: n }, (_, i) => (i === q.odd ? b : a));
        q.cols = this.cols;
        q.lock = {};
        q.limit = this.limitMs;
      },
      view(room, q) { return { grid: q.grid, cols: q.cols, lockMs: this.lockMs, points: CFG.RANK_POINTS.concat([CFG.RANK_REST]) }; },
      me(room, q, pid) { return { lockedUntil: q.lock[pid] || 0 }; },
      answer(room, q, p, data, now) {
        if (q.solved.has(p.id)) return { ok: false, error: '이미 찾았어요!' };
        const idx = Number(data && data.value);
        if (!Number.isInteger(idx) || idx < 0 || idx >= q.grid.length) return { ok: false, error: '그림을 눌러 주세요.' };
        if (now < (q.lock[p.id] || 0)) return { ok: true, correct: false, locked: true, wait: q.lock[p.id] - now, noBroadcast: true };
        if (idx === q.odd) {
          const gain = rankGain(q);
          solve(q, p, gain);
          return { ok: true, correct: true, gain };
        }
        q.lock[p.id] = now + this.lockMs;
        return { ok: true, correct: false, lockMs: this.lockMs, noBroadcast: true };
      },
      done: (room, q, gs) => gs.every((p) => q.solved.has(p.id)),
      answerText: (q) => q.grid[q.odd],
      reveal(room, q) { return { oddIndex: q.odd }; },
    },

    /* 암산 대결: 계산식을 먼저 풀수록 높은 점수 */
    math: {
      title: '암산 대결', count: 4, kind: 'race', revealMs: 5000, limitMs: 25000,
      desc: '계산식을 암산으로 풀어요! 정답을 입력하세요. 먼저 맞힐수록 높은 점수! (10 · 7 · 5 · 3점)',
      init(room, q) {
        const m = genMath(room.qIdx);
        q.expr = m.expr;
        q.ans = m.ans;
        q.limit = this.limitMs;
      },
      view(room, q) { return { expr: q.expr, points: CFG.RANK_POINTS.concat([CFG.RANK_REST]) }; },
      answer(room, q, p, data, now) {
        if (q.solved.has(p.id)) return { ok: false, error: '이미 맞혔어요!' };
        const raw = String(data && data.value).replace(/[,\s]/g, '');
        if (!/^-?\d{1,7}$/.test(raw)) return { ok: false, error: '숫자만 입력해 주세요.' };
        const g = gate(p, now, CFG.GUESS_COOLDOWN_MS - 100);
        if (g) return g;
        if (Number(raw) !== q.ans) return { ok: true, correct: false, noBroadcast: true };
        const gain = rankGain(q);
        solve(q, p, gain);
        return { ok: true, correct: true, gain };
      },
      done: (room, q, gs) => gs.every((p) => q.solved.has(p.id)),
      answerText: (q) => String(q.ans),
      reveal(room, q) { return { explain: `${q.expr} = ${q.ans}` }; },
    },

    /* 기억력: 잠깐 보여주는 순서를 외워서 그대로 눌러요 */
    memory: {
      title: '기억력', count: 3, kind: 'blind', revealMs: 6500, inputMs: 20000, ks: [4, 5, 6],
      desc: '그림이 순서대로 나타나요. 잘 외웠다가 같은 순서로 눌러 보세요! 제자리에 맞힌 그림마다 +2점, 전부 맞히면 +4점 보너스!',
      init(room, q) {
        q.k = this.ks[Math.min(room.qIdx, this.ks.length) - 1];
        q.seq = Array.from({ length: q.k }, () => pick(MEMORY_PALETTE));
        q.stage = 'show';
        q.showMs = q.k * 900 + 1500;
        q.limit = q.showMs + this.inputMs;
        q.stageEndsAt = Date.now() + q.showMs;
        later(room, q.showMs, () => {
          if (room.q === q && room.step === 'question') { q.stage = 'input'; broadcast(room); }
        });
      },
      timer(q) { return q.stage === 'show' ? { endsAt: q.stageEndsAt, ms: q.showMs } : { endsAt: q.endsAt, ms: this.inputMs }; },
      view(room, q, pid, reveal) {
        return { stage: q.stage, k: q.k, palette: MEMORY_PALETTE, seq: q.stage === 'show' || reveal ? q.seq : null, points: [2 * q.k, 2 * q.k + 4] };
      },
      me(room, q, pid) { const a = q.answers[pid]; return { choice: a ? a.seq : null }; },
      answer(room, q, p, data, now) {
        if (q.stage !== 'input') return { ok: false, error: '아직 외우는 시간이에요!' };
        if (q.answers[p.id]) return { ok: false, error: '이미 제출했어요.' };
        const seq = data && data.value;
        if (!Array.isArray(seq) || seq.length < 1 || seq.length > q.k || !seq.every((e) => MEMORY_PALETTE.includes(e))) {
          return { ok: false, error: '순서대로 그림을 골라 주세요.' };
        }
        q.answers[p.id] = { seq: seq.slice(), at: now };
        return { ok: true, locked: true };
      },
      finish(room, q) {
        for (const [pid, a] of Object.entries(q.answers)) {
          const p = room.players.find((x) => x.id === pid);
          a.correct = a.seq.filter((e, i) => e === q.seq[i]).length;
          a.ok = a.seq.length === q.k && a.correct === q.k;
          if (!p || !p.inGame) continue;
          const gain = a.correct * 2 + (a.ok ? 4 : 0);
          if (gain > 0) award(q, p, gain);
        }
      },
      done: (room, q, gs) => q.stage === 'input' && gs.every((p) => q.answers[p.id]),
      answerText: (q) => q.seq.join(' '),
      reveal(room, q) {
        const ex = existsIn(room);
        return { seq: q.seq, answers: Object.fromEntries(Object.entries(q.answers).filter(([id]) => ex(id)).map(([id, a]) => [id, { seq: a.seq, correct: a.correct, ok: !!a.ok }])) };
      },
    },

    /* 반응속도: 초록불이 켜지는 순간 눌러요. 일찍 누르면 0점! */
    reflex: {
      title: '반응속도', count: 4, kind: 'blind', revealMs: 5500, windowMs: 3000, minDelay: 2000, maxDelay: 5500, points: [10, 8, 6, 4], rest: 3,
      desc: '화면이 초록색으로 바뀌는 순간 가장 빨리 누르세요! 너무 일찍 누르면 0점. 빠를수록 높은 점수! (10 · 8 · 6 · 4점)',
      autoEnd: false,
      init(room, q) {
        q.delay = randInt(this.minDelay, this.maxDelay);
        q.stage = 'wait';
        q.goAt = 0;
        q.limit = q.delay + this.windowMs;
        later(room, q.delay, () => {
          if (room.q !== q || room.step !== 'question') return;
          q.stage = 'go';
          q.goAt = Date.now();
          q.endsAt = q.goAt + this.windowMs;
          room.stepEndsAt = q.endsAt;
          room.stepMs = this.windowMs;
          later(room, this.windowMs, () => endQuestion(room));
          broadcast(room);
        });
      },
      hiddenTimer: true,
      timer(q) { return q.stage === 'go' ? { endsAt: q.endsAt, ms: this.windowMs } : { endsAt: 0, ms: 0 }; },
      view(room, q) { return { stage: q.stage, points: this.points.concat([this.rest]) }; },
      me(room, q, pid) { const a = q.answers[pid]; return { state: a ? a.state : null, ms: a && a.state === 'ok' ? a.ms : null }; },
      answer(room, q, p, data, now) {
        if (q.answers[p.id]) return { ok: false, error: '이미 눌렀어요.' };
        if (q.stage === 'wait') { q.answers[p.id] = { state: 'false', at: now }; return { ok: true, state: 'false' }; }
        const ms = Math.max(0, now - q.goAt);
        q.answers[p.id] = { state: 'ok', ms, at: now };
        return { ok: true, state: 'ok', ms };
      },
      finish(room, q) {
        const oks = Object.entries(q.answers).filter(([, a]) => a.state === 'ok').sort((x, y) => x[1].ms - y[1].ms || x[1].at - y[1].at);
        oks.forEach(([pid, a], i) => {
          a.rank = i + 1;
          const p = room.players.find((x) => x.id === pid);
          if (p && p.inGame) award(q, p, i < this.points.length ? this.points[i] : this.rest);
        });
      },
      done: (room, q, gs) => gs.every((p) => q.answers[p.id]),
      answerText: (q) => '반응속도',
      reveal(room, q) {
        const ex = existsIn(room);
        return { rows: Object.entries(q.answers).filter(([id]) => ex(id)).map(([id, a]) => ({ id, state: a.state, ms: a.state === 'ok' ? a.ms : null, rank: a.rank || null })) };
      },
    },
  };

  /* 10초 맞추기: 스톱워치가 올라가요. 목표 시간에 STOP! 중간부터는 숫자가 사라져요 */
  GAMES.stopwatch = {
    title: '10초 맞추기', count: 3, kind: 'blind', revealMs: 6500, targetMs: 10000, graceMs: 4000, hideAfter: [5000, 3000, 0],
    bands: [[100, 15], [250, 12], [500, 9], [1000, 6], [2000, 3], [3000, 1]],
    desc: '스톱워치가 올라가요! 정확히 10초가 되는 순간 STOP을 누르세요. 중간부터는 숫자가 사라져서 감으로 맞춰야 해요. 오차가 작을수록 높은 점수! (±0.1초 이내 15점)',
    hiddenTimer: true,
    init(room, q) {
      q.target = this.targetMs;
      q.hideAfter = this.hideAfter[Math.min(room.qIdx, this.hideAfter.length) - 1];
      q.startAt = Date.now();
      q.limit = this.targetMs + this.graceMs;
    },
    timer() { return { endsAt: 0, ms: 0 }; },   // 남은 시간이 시간 감각을 도와주지 않게 숨김
    view(room, q) { return { target: q.target, hideAfter: q.hideAfter, startAt: q.startAt, bands: this.bands }; },
    me(room, q, pid) { const a = q.answers[pid]; return { stopped: !!a, ms: a ? a.ms : null }; },
    answer(room, q, p, data, now) {
      if (q.answers[p.id]) return { ok: false, error: '이미 눌렀어요.' };
      const ms = Math.max(0, now - q.startAt);
      q.answers[p.id] = { ms, at: now };
      return { ok: true, locked: true, ms };
    },
    finish(room, q) {
      for (const [pid, a] of Object.entries(q.answers)) {
        a.err = Math.abs(a.ms - q.target);
        const band = this.bands.find(([lim]) => a.err <= lim);
        const p = room.players.find((x) => x.id === pid);
        if (band && p && p.inGame) award(q, p, band[1]);
      }
    },
    done: (room, q, gs) => gs.every((p) => q.answers[p.id]),
    answerText: (q) => `${(q.target / 1000).toFixed(2)}초`,
    reveal(room, q) {
      const ex = existsIn(room);
      return { rows: Object.entries(q.answers).filter(([id]) => ex(id)).map(([id, a]) => ({ id, ms: a.ms, err: a.err })) };
    },
  };

  /* 끝말잇기: 차례대로 단어를 이어요. 시간 초과면 탈락, 탈락 순서대로 순위 점수! (사전이 없으니 이상한 단어는 이의 제기로 무효 처리) */
  GAMES.chain = {
    title: '끝말잇기', count: 1, kind: 'blind', revealMs: 9000, capMs: 120000, turnMs: 10000, minTurnMs: 5000, windowMs: 3500, retryMs: 6000,
    tokens: 2, points: [15, 10, 7, 5], rest: 3,
    desc: '끝말잇기 서바이벌! 차례가 오면 제한시간 안에 이어지는 단어를 입력하세요. 시간이 지나면 탈락! 이상한 단어는 다른 사람이 이의 제기할 수 있어요. 끝까지 남을수록 높은 점수! (15 · 10 · 7 · 5 · 3점)',
    init(room, q) {
      const ids = shuffle(gamersOf(room).map((p) => p.id));
      q.alive = ids;
      q.out = [];
      q.turnIdx = 0;
      q.seed = pick(SEEDS);
      q.chain = [{ pid: null, word: q.seed }];
      q.used = new Set([q.seed]);
      q.struck = new Set();
      q.req = chainStarts(q.seed[q.seed.length - 1]);
      q.words = {};
      q.tokens = Object.fromEntries(ids.map((id) => [id, this.tokens]));
      q.phase = 'ready';
      q.turnPid = null;
      q.window = null;
      q.notice = '';
      q.tok = 0;
      q.turnMs = 2500;
      q.turnEndsAt = Date.now() + 2500;
      q.limit = this.capMs;
      later(room, 2500, () => { if (room.q === q && room.step === 'question') this.startTurn(room, q); });
    },
    turnTime(q) { return Math.max(this.minTurnMs, this.turnMs - Math.floor((q.chain.length - 1) / 6) * 1000); },
    armTurn(room, q, ms) {
      q.phase = 'turn';
      q.turnPid = q.alive[q.turnIdx];
      q.turnMs = ms;
      q.turnEndsAt = Date.now() + ms;
      const tok = (q.tok += 1);
      later(room, ms, () => { if (room.q === q && q.tok === tok && q.phase === 'turn') this.eliminate(room, q, q.turnPid, '시간 초과'); });
      broadcast(room);
    },
    startTurn(room, q) {
      if (q.alive.length <= 1) return endQuestion(room);
      q.turnIdx %= q.alive.length;
      this.armTurn(room, q, this.turnTime(q));
    },
    eliminate(room, q, pid, why, name) {
      const i = q.alive.indexOf(pid);
      if (i < 0) return;
      const wasCurrent = q.phase === 'turn' && q.turnPid === pid;
      const wasAuthor = q.phase === 'window' && q.window && q.window.pid === pid;
      q.alive.splice(i, 1);
      q.out.push(pid);
      if (q.turnIdx > i) q.turnIdx -= 1;
      q.notice = `${name || nameOf(room, pid)}님 탈락! (${why})`;
      if (q.alive.length <= 1) return endQuestion(room);
      if (wasCurrent || wasAuthor) {
        q.window = null;
        q.turnIdx = i % q.alive.length;      // 빠진 자리를 다음 사람이 이어받아요
        q.tok += 1;
        return this.startTurn(room, q);
      }
      broadcast(room);
    },
    answer(room, q, p, data, now) {
      const v = data && data.value;
      if (v && typeof v === 'object' && v.challenge) return this.challenge(room, q, p);
      if (!q.alive.includes(p.id)) return { ok: false, error: '탈락했어요. 남은 라운드는 구경하세요!' };
      if (q.phase !== 'turn' || q.turnPid !== p.id) return { ok: false, error: '내 차례가 아니에요.' };
      const word = String(v == null ? '' : v).replace(/\s/g, '');
      if (!/^[가-힣]{2,12}$/.test(word)) return { ok: false, error: '한글 2글자 이상의 단어를 입력해 주세요.' };
      if (!q.req.includes(word[0])) return { ok: false, error: `‘${q.req.join('’ 또는 ‘')}’(으)로 시작하는 단어를 입력해 주세요.` };
      if (q.used.has(word) || q.struck.has(word)) return { ok: false, error: '이미 나온 단어예요.' };
      const prevReq = q.req;
      q.chain.push({ pid: p.id, word });
      q.used.add(word);
      q.words[p.id] = (q.words[p.id] || 0) + 1;
      q.req = chainStarts(word[word.length - 1]);
      q.phase = 'window';
      q.notice = '';
      q.window = { pid: p.id, word, prevReq, until: now + this.windowMs, objectors: new Set() };
      const tok = (q.tok += 1);
      later(room, this.windowMs, () => { if (room.q === q && q.tok === tok && q.phase === 'window') this.closeWindow(room, q); });
      return { ok: true, accepted: true };
    },
    challenge(room, q, p) {
      const w = q.window;
      if (q.phase !== 'window' || !w) return { ok: false, error: '지금은 이의 제기를 할 수 없어요.' };
      if (!q.alive.includes(p.id)) return { ok: false, error: '탈락한 사람은 이의 제기를 할 수 없어요.' };
      if (w.pid === p.id) return { ok: false, error: '내 단어에는 이의 제기를 할 수 없어요.' };
      if (w.objectors.has(p.id)) return { ok: false, error: '이미 이의 제기했어요.' };
      if ((q.tokens[p.id] || 0) <= 0) return { ok: false, error: '이의 제기 기회를 모두 썼어요.' };
      q.tokens[p.id] -= 1;
      w.objectors.add(p.id);
      const need = Math.max(1, Math.ceil(q.alive.filter((id) => id !== w.pid).length / 2));
      if (w.objectors.size >= need) { q.tok += 1; this.closeWindow(room, q); }   // 기준을 넘으면 바로 판정
      return { ok: true, objected: true };
    },
    closeWindow(room, q) {
      const w = q.window;
      if (!w) return;
      const need = Math.max(1, Math.ceil(q.alive.filter((id) => id !== w.pid).length / 2));
      q.window = null;
      if (w.objectors.size >= need) {
        // 이의 제기 성공: 단어를 취소하고 같은 사람이 다시 입력 (탈락은 아님, 시간 압박만)
        q.chain.pop();
        q.used.delete(w.word);
        q.struck.add(w.word);
        q.words[w.pid] = Math.max(0, (q.words[w.pid] || 1) - 1);
        q.req = w.prevReq;
        q.notice = `‘${w.word}’은(는) 이의 제기로 무효! ${nameOf(room, w.pid)}님 다시 입력하세요`;
        return this.armTurn(room, q, this.retryMs);
      }
      q.turnIdx = (q.turnIdx + 1) % q.alive.length;
      this.startTurn(room, q);
    },
    timer(q) {
      if (q.phase === 'window' && q.window) return { endsAt: q.window.until, ms: this.windowMs };
      return { endsAt: q.turnEndsAt, ms: q.turnMs };
    },
    view(room, q) {
      const w = q.window;
      return {
        phase: q.phase, seed: q.seed, req: q.req, turnPid: q.turnPid, alive: q.alive.slice(), out: q.out.slice(),
        chain: q.chain.slice(-12).map((c) => ({ pid: c.pid, word: c.word })), chainLen: q.chain.length,
        words: q.words, notice: q.notice, capEndsAt: q.endsAt,
        window: w ? { pid: w.pid, word: w.word, objections: w.objectors.size, need: Math.max(1, Math.ceil(q.alive.filter((id) => id !== w.pid).length / 2)) } : null,
        points: this.points.concat([this.rest]),
      };
    },
    me(room, q, pid) {
      const w = q.window;
      return { alive: q.alive.includes(pid), tokens: q.tokens[pid] || 0, objected: !!(w && w.objectors.has(pid)), myTurn: q.phase === 'turn' && q.turnPid === pid };
    },
    finish(room, q) {
      // 남은 사람은 낸 단어가 많은 순, 탈락한 사람은 늦게 탈락할수록 높은 순위
      const alive = q.alive.slice().sort((a, b) => (q.words[b] || 0) - (q.words[a] || 0));
      q.rank = alive.concat(q.out.slice().reverse());
      q.rank.forEach((pid, i) => {
        const p = room.players.find((x) => x.id === pid);
        if (p && p.inGame) award(q, p, i < this.points.length ? this.points[i] : this.rest);
      });
    },
    done: () => false,   // 끝말잇기는 내부 규칙(생존자 1명 / 제한 시간)으로 끝나요
    answerText: () => '끝말잇기',
    reveal(room, q) {
      const ex = existsIn(room);
      return { rank: q.rank.filter(ex), words: q.words, chain: q.chain.map((c) => ({ pid: c.pid, word: c.word })) };
    },
    onLeave(room, q, pid, name) { this.eliminate(room, q, pid, '나감', name); },
  };

  // 기본 순서(표시/테스트용). 실제 게임에서는 12종 중 10종이 섞여서 뽑혀요.
  const ORDER = ['ggong', 'assoc', 'ox', 'choseong', 'person', 'updown', 'odd', 'math', 'memory', 'reflex', 'stopwatch', 'chain'];
  const planOf = (types) => types.map((t) => ({ type: t, title: GAMES[t].title, count: GAMES[t].count, desc: GAMES[t].desc }));

  /* ───────── 상태 직렬화 ───────── */
  function qView(room, pid) {
    const q = room.q;
    const game = GAMES[q.type];
    const reveal = room.step === 'reveal';
    const t = game.timer ? game.timer(q) : { endsAt: q.endsAt, ms: q.limit };
    const ex = existsIn(room);
    const gs = connectedGamers(room);
    const race = game.kind === 'race';
    const doneIds = race ? [...q.solved].filter(ex) : Object.keys(q.answers).filter(ex);
    const v = {
      type: q.type, limit: t.ms, endsAt: t.endsAt,
      progress: { done: doneIds.length, total: gs.length },
      doneIds,
      solvers: race ? q.solvedOrder.filter(ex).map((id) => ({ id, gain: q.gains[id] || 0 })) : [],
      me: Object.assign({ solved: q.solved.has(pid), gain: q.gains[pid] || 0, choice: null }, game.me ? game.me(room, q, pid) : {}),
    };
    Object.assign(v, game.view(room, q, pid, reveal));
    if (reveal) {
      v.reveal = Object.assign({ answer: game.answerText(q), gains: q.gains }, game.reveal ? game.reveal(room, q) : {});
    }
    return v;
  }

  function stateFor(room, pid) {
    const me = room.players.find((p) => p.id === pid);
    const lobbyLike = room.phase !== 'playing';
    const readyCount = room.players.filter((p) => p.ready && p.connected).length;
    const s = {
      now: Date.now(),
      code: room.code,
      phase: room.phase,
      gameNo: room.gameNo,
      you: pid,
      min: CFG.MIN_PLAYERS,
      maxGamers: CFG.MAX_PLAYERS,
      readyCount,
      canStart: lobbyLike && !!(me && me.ready) && readyCount >= CFG.MIN_PLAYERS && readyCount <= CFG.MAX_PLAYERS,
      spectator: room.phase === 'playing' && !(me && me.inGame),
      players: room.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected,
        ready: p.ready, inGame: p.inGame, score: p.score, wins: p.wins, roundGain: p.roundGain,
      })),
      roundCount: CFG.ROUNDS,
      step: null,
      result: room.phase === 'ended' ? room.result : null,
    };
    if (room.phase === 'playing') {
      // 아직 오지 않은 라운드는 이름을 숨겨요 (SHOW_UPCOMING 으로 변경 가능)
      s.plan = room.plan.map((r, i) => (CFG.SHOW_UPCOMING || i <= room.roundIdx
        ? { type: r.type, title: r.title, count: r.count, desc: r.desc }
        : { type: null, title: '???', count: 0, desc: '' }));
      const round = room.plan[room.roundIdx];
      s.roundIdx = room.roundIdx;
      s.roundTotal = room.plan.length;
      s.round = { type: round.type, title: round.title, count: round.count, desc: round.desc };
      s.qIdx = room.qIdx;
      s.step = room.step;
      s.stepEndsAt = room.stepEndsAt;
      s.stepMs = room.stepMs;
      s.q = room.step === 'question' || room.step === 'reveal' ? qView(room, pid) : null;
    } else {
      // 대기실/결과 화면: 마지막 판의 순서가 있으면 그것을, 없으면 전체 게임 목록을 보여줘요
      s.plan = room.phase === 'ended' && room.plan ? room.plan.map((r) => ({ type: r.type, title: r.title, count: r.count, desc: r.desc })) : planOf(ORDER);
      s.planRandom = room.phase !== 'ended';
    }
    return s;
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of room.players) {
      if (p.connected && p.socketId) io.to(p.socketId).emit('qp_state', stateFor(room, p.id));
    }
  }

  /* ───────── 진행 ───────── */
  function startGame(room, gamers) {
    clearTimers(room);
    room.players.forEach((p) => {
      p.inGame = gamers.includes(p);
      p.score = 0;
      p.roundGain = 0;
    });
    room.phase = 'playing';
    room.gameNo += 1;
    room.result = null;
    // 매 판 새로 섞은 순서로 10개 미니게임을 배치
    const picked = CFG.FORCE_PLAN.length ? CFG.FORCE_PLAN : (CFG.SHUFFLE_PLAN ? shuffle(ORDER) : ORDER.slice()).slice(0, CFG.ROUNDS);
    room.plan = planOf(picked);
    room.roundIdx = 0;
    room.qIdx = 0;
    const total = room.plan.reduce((a, r) => a + r.count, 0);
    pushChatSys(room, `🔥 미니게임지옥 시작! 미니게임 ${ORDER.length}종 중 ${room.plan.length}개가 랜덤으로 뽑혀 이어져요. (문제 ${total}개) 참가자 ${gamers.length}명 화이팅!`);
    runIntro(room);
  }

  function runIntro(room) {
    clearTimers(room);
    room.players.forEach((p) => { p.roundGain = 0; });
    room.step = 'intro';
    room.q = null;
    room.qIdx = 0;
    room.stepEndsAt = Date.now() + CFG.INTRO_MS;
    room.stepMs = CFG.INTRO_MS;
    later(room, CFG.INTRO_MS, () => {
      room.qIdx = 1;
      startQuestion(room);
    });
    broadcast(room);
  }

  function startQuestion(room) {
    clearTimers(room);
    const round = room.plan[room.roundIdx];
    const game = GAMES[round.type];
    const now = Date.now();
    const q = {
      type: round.type, src: null, startedAt: now, solved: new Set(), solvedOrder: [], gains: {}, answers: {},
      limit: 0, endsAt: 0,
    };
    room.q = q;
    room.step = 'question';
    game.init(room, q);
    q.endsAt = now + q.limit;
    room.stepEndsAt = game.hiddenTimer ? 0 : q.endsAt;   // 반응속도: 신호 시각이 새지 않게 숨김
    room.stepMs = game.hiddenTimer ? 0 : q.limit;
    if (game.autoEnd !== false) later(room, q.limit, () => endQuestion(room));
    broadcast(room);
  }

  function endQuestion(room) {
    if (room.phase !== 'playing' || room.step !== 'question') return;
    clearTimers(room);
    const q = room.q;
    const game = GAMES[q.type];
    if (game.finish) game.finish(room, q);
    room.step = 'reveal';
    room.stepEndsAt = Date.now() + game.revealMs;
    room.stepMs = game.revealMs;
    later(room, game.revealMs, () => afterReveal(room));
    broadcast(room);
  }

  function afterReveal(room) {
    if (room.phase !== 'playing' || room.step !== 'reveal') return;
    const round = room.plan[room.roundIdx];
    if (room.qIdx < round.count) {
      room.qIdx += 1;
      return startQuestion(room);
    }
    if (room.roundIdx + 1 >= room.plan.length) return finishGame(room, false);
    clearTimers(room);
    room.step = 'board';
    room.stepEndsAt = Date.now() + CFG.BOARD_MS;
    room.stepMs = CFG.BOARD_MS;
    later(room, CFG.BOARD_MS, () => {
      room.roundIdx += 1;
      runIntro(room);
    });
    broadcast(room);
  }

  function finishGame(room, aborted) {
    clearTimers(room);
    room.step = null;
    room.q = null;
    const gs = gamersOf(room).slice().sort((a, b) => b.score - a.score);
    const ranking = [];
    let rank = 0;
    let prev = null;
    gs.forEach((p, i) => {
      if (p.score !== prev) { rank = i + 1; prev = p.score; }
      ranking.push({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: p.score, rank });
    });
    const top = ranking.length ? ranking[0].score : 0;
    const winners = !aborted && top > 0 ? ranking.filter((r) => r.score === top).map((r) => r.id) : [];
    winners.forEach((id) => { const p = room.players.find((x) => x.id === id); if (p) p.wins += 1; });
    room.phase = 'ended';
    room.result = { ranking, winners, aborted: !!aborted };
    if (aborted) pushChatSys(room, '인원이 부족해 게임이 중단되었어요.');
    else if (winners.length) pushChatSys(room, `🏆 최종 우승: ${winners.map((id) => (room.players.find((p) => p.id === id) || {}).name).join(', ')} (${top}점)`);
    broadcast(room);
  }

  // 연결된 참가자 전원이 끝났으면 문제를 바로 마친다
  function checkAllDone(room) {
    if (room.phase !== 'playing' || room.step !== 'question') return;
    const gs = connectedGamers(room);
    if (gs.length === 0) return;
    if (GAMES[room.q.type].done(room, room.q, gs)) endQuestion(room);
  }

  /* ───────── 방/플레이어 관리 ───────── */
  function destroyRoom(room) {
    clearTimers(room);
    room.players.forEach((p) => clearTimeout(p.dropTimer));
    rooms.delete(room.code);
  }

  function removePlayer(room, player) {
    clearTimeout(player.dropTimer);
    const wasGamer = room.phase === 'playing' && player.inGame;
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) return destroyRoom(room);
    if (wasGamer) {
      const g = room.q && room.step === 'question' ? GAMES[room.q.type] : null;
      if (g && g.onLeave) g.onLeave(room, room.q, player.id, player.name);   // 끝말잇기: 나간 사람은 탈락 처리
      if (gamersOf(room).length < CFG.MIN_PLAYERS) return finishGame(room, true);
      checkAllDone(room);
    }
    broadcast(room);
  }

  function dropPlayer(room, player) {
    if (!rooms.has(room.code) || player.connected) return;
    if (room.phase === 'playing' && player.inGame) return; // 진행 중인 참가자는 자리를 유지
    removePlayer(room, player);
  }

  function newPlayer(room, name) {
    const usedA = new Set(room.players.map((p) => p.avatar));
    const usedC = new Set(room.players.map((p) => p.color));
    return {
      id: makeId(),
      token: makeToken(),
      name,
      avatar: AVATARS.find((a) => !usedA.has(a)) || AVATARS[room.players.length % AVATARS.length],
      color: COLORS.find((c) => !usedC.has(c)) || COLORS[room.players.length % COLORS.length],
      ready: false,
      inGame: false,
      score: 0,
      wins: 0,
      roundGain: 0,
      connected: false,
      socketId: null,
      dropTimer: null,
      lastChatAt: 0,
      lastGuessAt: 0,
    };
  }

  function attach(socket, room, player) {
    clearTimeout(player.dropTimer);
    player.connected = true;
    player.socketId = socket.id;
    socket.data.qp = { code: room.code, pid: player.id };
    socket.join(`qp:${room.code}`);
    socket.emit('qp_chatlog', room.chat);
    broadcast(room);
  }

  function ctxOf(socket) {
    const d = socket.data.qp;
    if (!d) return null;
    const room = rooms.get(d.code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === d.pid);
    return player ? { room, player } : null;
  }

  /* ───────── 소켓 이벤트 ───────── */
  io.on('connection', (socket) => {
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});

    socket.on('qp_create', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      const code = makeCode(rooms);
      const room = {
        code, phase: 'waiting', gameNo: 0, players: [], plan: null, roundIdx: 0, qIdx: 0, step: null, stepEndsAt: 0, stepMs: 0,
        q: null, used: new Set(), result: null, chat: [], timers: [], lastActive: Date.now(),
      };
      const player = newPlayer(room, name);
      room.players.push(player);
      rooms.set(code, room);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    // 게임 도중에도 입장 가능 (관전자로 시작)
    socket.on('qp_join', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      if (!room) return cb({ ok: false, error: '존재하지 않는 방 코드입니다.' });
      if (room.players.length >= CFG.MAX_ROOM) return cb({ ok: false, error: `방이 가득 찼습니다. (최대 ${CFG.MAX_ROOM}명)` });
      if (room.players.some((p) => p.name === name)) return cb({ ok: false, error: '같은 방에 이미 사용 중인 닉네임입니다.' });
      const player = newPlayer(room, name);
      room.players.push(player);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('qp_rejoin', (data, cb) => {
      cb = reply(cb);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      const player = room && room.players.find((p) => p.token === (data && data.token));
      if (!room || !player) return cb({ ok: false, error: '방을 찾을 수 없거나 세션이 만료되었습니다.' });
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) {
          old.data.qp = null;
          old.emit('qp_kicked');
        }
      }
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    // 게임 준비 토글 (진행 중에는 '다음 판 참가' 의미)
    socket.on('qp_ready', () => {
      const c = ctxOf(socket);
      if (!c) return;
      c.player.ready = !c.player.ready;
      broadcast(c.room);
    });

    // 준비한 사람이 2명 이상이면 준비한 누구든 시작 가능
    socket.on('qp_start', (_d, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase === 'playing') return cb({ ok: false, error: '이미 게임이 진행 중이에요.' });
      if (!player.ready) return cb({ ok: false, error: '먼저 ‘게임 준비’를 눌러 주세요.' });
      const gamers = room.players.filter((p) => p.ready && p.connected);
      if (gamers.length < CFG.MIN_PLAYERS) return cb({ ok: false, error: `최소 ${CFG.MIN_PLAYERS}명이 준비해야 해요. (현재 ${gamers.length}명)` });
      if (gamers.length > CFG.MAX_PLAYERS) return cb({ ok: false, error: `한 판은 최대 ${CFG.MAX_PLAYERS}명까지예요. 준비한 인원이 ${gamers.length}명이라 일부가 준비를 취소해야 해요.` });
      startGame(room, gamers);
      cb({ ok: true });
    });

    // 답 제출: 미니게임마다 value 의 형식이 달라요 (텍스트 / 'O','X' / 숫자 / 그림 번호 / 그림 목록 / 'tap')
    socket.on('qp_answer', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'playing' || room.step !== 'question') return cb({ ok: false, error: '지금은 답할 수 없어요.' });
      if (!player.inGame) return cb({ ok: false, error: '관전 중에는 답할 수 없어요.' });
      const q = room.q;
      const res = GAMES[q.type].answer(room, q, player, data, Date.now());
      cb(res);
      if (res.ok && !res.noBroadcast) {
        broadcast(room);
        checkAllDone(room);
      }
    });

    // 전체 채팅 (참가자·관전자 모두)
    socket.on('qp_chat', (data) => {
      const c = ctxOf(socket);
      if (!c) return;
      const now = Date.now();
      if (now - c.player.lastChatAt < 300) return; // 도배 방지
      const text = cleanText(data && data.text, 200);
      if (!text) return;
      c.player.lastChatAt = now;
      const msg = {
        pid: c.player.id,
        name: c.player.name,
        avatar: c.player.avatar,
        color: c.player.color,
        text,
        spectator: c.room.phase === 'playing' && !c.player.inGame,
        t: now,
      };
      c.room.chat.push(msg);
      if (c.room.chat.length > CFG.CHAT_KEEP) c.room.chat.shift();
      c.room.lastActive = now;
      io.to(`qp:${c.room.code}`).emit('qp_chat', msg);
    });

    socket.on('qp_leave', () => {
      const c = ctxOf(socket);
      socket.data.qp = null;
      if (!c) return;
      socket.leave(`qp:${c.room.code}`);
      removePlayer(c.room, c.player);
    });

    socket.on('disconnect', () => {
      const c = ctxOf(socket);
      if (!c || c.player.socketId !== socket.id) return;
      const { room, player } = c;
      player.connected = false;
      player.socketId = null;
      player.dropTimer = setTimeout(() => dropPlayer(room, player), CFG.DROP_GRACE_MS);
      broadcast(room);
      checkAllDone(room); // 연결이 끊긴 사람 때문에 문제가 늘어지지 않게
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const anyone = room.players.some((p) => p.connected);
      if (!anyone && now - room.lastActive > CFG.ROOM_TTL_MS) destroyRoom(room);
    }
  }, 60 * 1000).unref();
};
