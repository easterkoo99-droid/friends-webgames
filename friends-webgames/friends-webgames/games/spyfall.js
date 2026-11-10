'use strict';
/**
 * 우리가 있는 곳은? (코드 이름: spyfall) - 추리/심리전 게임 (플러그인)
 *
 * 규칙
 *  - 한 판에 3~8명 참가. 한 명이 스파이, 나머지 시민은 같은 장소를 받음
 *  - 차례인 사람이 앞선 질문에 답하고, 다음 질문 상대를 지목해 질문 (A→B→C→D…)
 *    직전에 나에게 질문한 사람에게는 바로 되물을 수 없음
 *  - 참가자는 (1인 1회) 스파이 지목 투표를 열 수 있음 - 지목 대상을 뺀 참가자 '전원'이 찬성해야 확정
 *    (한 명이라도 반대하면 즉시 부결, 시간 안에 전원 찬성이 안 되어도 부결). 누가 어떻게 투표했는지 모두에게 공개
 *  - 스파이는 언제든 장소를 맞춰볼 수 있음 (정답이면 스파이 승, 오답이면 시민 승)
 *  - 8분이 지나면 스파이 승
 *  - 승점제: 방이 유지되는 동안 판마다 점수가 누적됨 (CFG.SCORE 참고)
 *
 * 방/준비/채팅/관전/점수판은 허브(hub.js)가 맡고, 여기에는 이 게임의 규칙만 있어요.
 */
const { cleanText, pick } = require('./util');

const CFG = {
  GAME_SEC: 8 * 60,
  VOTE_SEC: 90,     // 채팅으로 토론할 시간
  // 승점표 (숫자만 바꿔서 조정)
  SCORE: {
    citizenWin: 1,     // 시민 승리 시 시민 전원
    accuserBonus: 1,   // 스파이 지목 투표를 열어 가결시킨 사람 추가 점수
    spyTimeout: 2,     // 스파이: 제한 시간 종료까지 버팀
    spyGuess: 3,       // 스파이: 장소를 정확히 맞힘
    spyFramed: 3,      // 스파이: 시민이 잘못 지목되어 가결
  },
};

const LOCATION_NAMES = [
  '카지노',
  '해수욕장',
  '우주정거장',
  '병원',
  '학교',
  '경찰서',
  '은행',
  '비행기',
  '영화관',
  '레스토랑',
  '놀이공원',
  '도서관',
  '군부대',
  '기차',
  '서커스',
  '해적선',
  '잠수함',
  '호텔',
  'PC방',
  '찜질방',
  '캠핑장',
  '지하철',
  '편의점',
  '공항',
  '동물원',
  '수족관',
  '박물관',
  '미술관',
  '헬스장',
  '노래방',
  '카페',
  '대형마트',
  '백화점',
  '빨래방',
  '주유소',
  '소방서',
  '법원',
  '결혼식장',
  '약국',
  '미용실',
  '스키장',
  '골프장',
  '야구장',
  '대학교',
  '학원',
  '방송국',
  '크루즈선',
  '전통시장',
  '고속도로 휴게소',
  '워터파크',
];

module.exports = {
  id: 'spyfall',
  name: '우리가 있는 곳은?',
  emoji: '📍',
  accent: '#2dd4bf',   // 대기실 카드 색
  desc: '한 명만 장소를 몰라요. 질문으로 스파이를 찾아라!',
  rules: [
    '시민은 같은 장소를 받고, 스파이만 장소를 몰라요.',
    '차례대로 질문하고 대답해요. 방금 나에게 질문한 사람에게는 바로 되물을 수 없어요.',
    '수상한 사람은 한 번씩 지목 투표를 열 수 있어요. 지목된 사람을 뺀 참가자 전원이 찬성해야 확정돼요.',
    '스파이는 언제든 장소를 맞혀 볼 수 있어요. 맞히면 승리, 틀리면 패배! 제한 시간은 8분이에요.',
  ],
  min: 3,
  max: 8,

  create(api) {
    const gamersOf = (room) => room.players.filter((p) => p.inGame);
    const nameOf = (room, id) => (room.players.find((p) => p.id === id) || {}).name || (room.g && room.g.names[id]) || '?';
    const pushSys = (room, text) => room.g.thread.push({ type: 'sys', text, t: Date.now() });

    function lastQa(room) {
      const th = room.g.thread;
      for (let i = th.length - 1; i >= 0; i--) if (th[i].type === 'qa') return th[i];
      return null;
    }
    // 아직 답변이 달리지 않은 마지막 질문
    function pendingQa(room) {
      const q = lastQa(room);
      return q && q.answer === null && !q.skipped ? q : null;
    }

    /* ───────── 상태(내가 볼 수 있는 부분만) ───────── */
    function view(room, pid) {
      const g = room.g;
      const me = room.players.find((p) => p.id === pid);
      const isGamer = !!(me && me.inGame);
      const playing = g.phase === 'playing';
      const isSpy = isGamer && g.spyId === pid;
      const v = g.vote;
      return {
        phase: g.phase,                       // 'playing' | 'ended'
        endsAt: playing ? g.endsAt : 0,
        gameSec: CFG.GAME_SEC,
        voteSec: CFG.VOTE_SEC,
        turnId: playing ? g.turnId : null,
        lastAskerId: playing ? g.lastAskerId : null,
        pending: playing ? pendingQa(room) : null,
        thread: g.thread.slice(-100),
        vote: v ? { accuserId: v.accuserId, accusedId: v.accusedId, votes: v.votes, eligible: v.eligible, endsAt: v.endsAt } : null,
        canAccuse: playing && isGamer && !v && !g.accusers.has(pid),
        me: isGamer ? { spectator: false, isSpy, location: isSpy ? null : g.location } : { spectator: true },
        locations: LOCATION_NAMES,
        result: g.phase === 'ended' ? g.result : null,
      };
    }

    /* ───────── 진행 ───────── */
    function start(room, gamers) {
      const spy = pick(gamers);
      const g = (room.g = {
        phase: 'playing',
        location: pick(LOCATION_NAMES),
        spyId: spy.id,
        turnId: pick(gamers).id,
        lastAskerId: null,
        vote: null,
        accusers: new Set(),
        result: null,
        thread: [],
        qaCount: 0,
        names: Object.fromEntries(gamers.map((p) => [p.id, p.name])),
        endsAt: Date.now() + CFG.GAME_SEC * 1000,
        timer: null,
      });
      pushSys(room, `게임 시작! ${nameOf(room, g.turnId)}님부터 질문을 시작하세요.`);
      g.timer = setTimeout(() => endGame(room, 'spy', '제한 시간이 끝났어요. 스파이를 찾지 못했습니다.', { kind: 'timeout' }), CFG.GAME_SEC * 1000);
    }

    // 종료 유형별 점수 계산: { 플레이어id: 획득 점수 }
    // kind: caught(지목 가결로 스파이 검거) | wrongGuess(스파이 오답) | timeout | guess(스파이 정답) | framed(시민 오지목) | abort(중단: 점수 없음)
    function computeGains(room, kind, extra) {
      const g = room.g;
      const gains = {};
      const SC = CFG.SCORE;
      const gs = gamersOf(room);
      const give = (id, n) => { if (gs.some((p) => p.id === id)) gains[id] = (gains[id] || 0) + n; };
      const citizens = gs.filter((p) => p.id !== g.spyId);
      if (kind === 'caught') {
        citizens.forEach((p) => give(p.id, SC.citizenWin));
        if (extra.accuserId && extra.accuserId !== g.spyId) give(extra.accuserId, SC.accuserBonus);
      } else if (kind === 'wrongGuess') {
        citizens.forEach((p) => give(p.id, SC.citizenWin));
      } else if (kind === 'timeout') {
        give(g.spyId, SC.spyTimeout);
      } else if (kind === 'guess') {
        give(g.spyId, SC.spyGuess);
      } else if (kind === 'framed') {
        give(g.spyId, SC.spyFramed);
      }
      return gains;
    }

    function endGame(room, winner, reason, extra = {}) {
      const g = room.g;
      if (!g || g.phase !== 'playing') return;
      clearTimeout(g.timer);
      if (g.vote) clearTimeout(g.vote.timer);
      g.vote = null;
      g.phase = 'ended';
      g.endsAt = 0;
      const gains = computeGains(room, extra.kind || 'abort', extra);
      gamersOf(room).forEach((p) => { if (gains[p.id]) api.addScore(room, p, gains[p.id]); });
      const list = gamersOf(room).concat(extra.also || []);   // 중간에 나간 스파이도 결과에 보여줘요
      g.result = {
        winner, // 'citizens' | 'spy' | 'none'
        reason,
        spyId: g.spyId,
        spyName: nameOf(room, g.spyId),
        location: g.location,
        players: list.map((p) => ({
          id: p.id, name: p.name, avatar: p.avatar, color: p.color, isSpy: p.id === g.spyId,
          gain: gains[p.id] || 0, score: p.score,
        })),
        noScore: !Object.keys(gains).length,
        accusedName: extra.accusedName || null,
        voteRows: extra.voteRows || null,
      };
      pushSys(room, '게임 종료');
      api.broadcast(room);
    }

    /* ───────── 투표 (전원 찬성) ───────── */
    function tally(g) {
      const v = g.vote;
      const agree = v.eligible.filter((id) => v.votes[id] === true).length;
      const disagree = v.eligible.filter((id) => v.votes[id] === false).length;
      return { agree, disagree, n: v.eligible.length };
    }

    function voteRowsOf(room, v) {
      return v.eligible.map((id) => {
        const p = room.players.find((x) => x.id === id) || {};
        return {
          id, name: p.name || '?', avatar: p.avatar || '', color: p.color || '#999',
          vote: v.votes[id] === undefined ? null : v.votes[id],
        };
      });
    }

    function settleVote(room, passed) {
      const g = room.g;
      const v = g.vote;
      if (!v) return;
      clearTimeout(v.timer);
      const rows = voteRowsOf(room, v);
      const accusedName = nameOf(room, v.accusedId);
      const names = (val) => rows.filter((r) => r.vote === val).map((r) => r.name).join(', ') || '없음';
      const summary = `투표 결과 — 찬성: ${names(true)} / 반대: ${names(false)}${rows.some((r) => r.vote === null) ? ` / 미투표: ${names(null)}` : ''} → ${passed ? '가결' : '부결'}`;
      g.vote = null;
      pushSys(room, summary);
      api.chatSys(room, `🗳 ${summary}`);
      if (!passed) {
        pushSys(room, `${accusedName}님 지목이 부결되었어요. 게임을 계속합니다.`);
        return api.broadcast(room);
      }
      const extra = { voteRows: rows, accusedName, accuserId: v.accuserId };
      if (v.accusedId === g.spyId) {
        endGame(room, 'citizens', `전원이 찬성해 지목한 ${accusedName}님이 진짜 스파이였어요!`, { ...extra, kind: 'caught' });
      } else {
        endGame(room, 'spy', `${accusedName}님은 시민이었어요. 무고한 사람을 지목해 스파이가 승리했습니다.`, { ...extra, kind: 'framed' });
      }
    }

    // 만장일치: 한 명이라도 반대하면 즉시 부결, 전원 찬성이면 가결, 시간이 끝나면 부결
    function checkVote(room, timedOut = false) {
      const g = room.g;
      if (!g || !g.vote) return;
      const { agree, disagree, n } = tally(g);
      if (disagree > 0) return settleVote(room, false);
      if (agree >= n) return settleVote(room, true);
      if (timedOut) return settleVote(room, false);
      api.broadcast(room);
    }

    // 차례인 사람이 사라졌을 때 다음 사람에게 차례를 넘김
    function advanceTurn(room) {
      const g = room.g;
      const gs = gamersOf(room);
      const cand = gs.filter((p) => p.connected && p.id !== g.turnId && p.id !== g.lastAskerId);
      const next = cand.length ? pick(cand) : gs.find((p) => p.id !== g.turnId);
      if (!next) return;
      const q = pendingQa(room);
      if (q) q.skipped = true;
      pushSys(room, `${nameOf(room, g.turnId)}님이 자리를 비워 ${next.name}님에게 차례가 넘어갔어요.`);
      g.turnId = next.id;
    }

    /* ───────── 플레이어 동작 ───────── */
    function action(room, player, msg) {
      const g = room.g;
      if (!g || g.phase !== 'playing') return { ok: false, error: '진행 중인 게임이 아니에요.' };

      // 질문 턴 넘기기: { target, question, answer } — 받은 질문에 답(필수)하고 다음 상대에게 질문한다
      if (msg.type === 'pass_turn') {
        if (!player.inGame) return { ok: false, error: '관전 중에는 질문할 수 없어요.' };
        if (g.vote) return { ok: false, error: '투표가 진행 중이에요.' };
        if (g.turnId !== player.id) return { ok: false, error: '지금은 내 차례가 아니에요.' };
        const target = room.players.find((p) => p.id === msg.target && p.inGame);
        if (!target || target.id === player.id) return { ok: false, error: '질문할 상대를 선택해 주세요.' };
        if (target.id === g.lastAskerId) return { ok: false, error: '방금 나에게 질문한 사람에게는 바로 되물을 수 없어요.' };
        const question = cleanText(msg.question, 120);
        if (!question) return { ok: false, error: '질문을 입력해 주세요.' };
        const pend = pendingQa(room);
        const answer = cleanText(msg.answer, 160);
        if (pend && !answer) return { ok: false, error: '받은 질문에 대한 답변을 먼저 적어 주세요.' };
        if (pend) { pend.answer = answer; pend.answeredAt = Date.now(); }
        g.thread.push({
          type: 'qa',
          n: ++g.qaCount,
          askerId: player.id, askerName: player.name, askerAvatar: player.avatar, askerColor: player.color,
          targetId: target.id, targetName: target.name, targetAvatar: target.avatar, targetColor: target.color,
          question,
          answer: null,
          skipped: false,
          t: Date.now(),
        });
        g.lastAskerId = player.id;
        g.turnId = target.id;
        return { ok: true };
      }

      // 스파이 지목 투표 시작: { target } (참가자만, 1인 1회)
      if (msg.type === 'accuse') {
        if (!player.inGame) return { ok: false, error: '관전 중에는 지목할 수 없어요.' };
        if (g.vote) return { ok: false, error: '이미 투표가 진행 중이에요.' };
        if (g.accusers.has(player.id)) return { ok: false, error: '지목은 한 사람당 한 번만 할 수 있어요.' };
        const target = room.players.find((p) => p.id === msg.target && p.inGame);
        if (!target || target.id === player.id) return { ok: false, error: '지목할 사람을 선택해 주세요.' };
        g.accusers.add(player.id);
        g.vote = {
          accuserId: player.id,
          accusedId: target.id,
          votes: { [player.id]: true },
          eligible: gamersOf(room).filter((p) => p.id !== target.id).map((p) => p.id),
          endsAt: Date.now() + CFG.VOTE_SEC * 1000,
          timer: null,
        };
        g.vote.timer = setTimeout(() => checkVote(room, true), CFG.VOTE_SEC * 1000);
        pushSys(room, `${player.name}님이 ${target.name}님을 스파이로 지목했어요.`);
        api.chatSys(room, `🗳 ${player.name}님이 ${target.name}님을 스파이로 지목했어요! 채팅으로 충분히 이야기해 보세요. 참가자 전원이 찬성해야 확정돼요. (${CFG.VOTE_SEC}초)`);
        checkVote(room);   // 소규모 방에서는 지목 즉시 판정될 수 있음
        return { ok: true };
      }

      // 투표: { agree: boolean }
      if (msg.type === 'vote') {
        const v = g.vote;
        if (!v) return { ok: false, error: '진행 중인 투표가 없어요.' };
        if (!v.eligible.includes(player.id)) return { ok: false, error: '투표할 수 없어요. (지목된 사람이거나 관전 중)' };
        if (v.votes[player.id] !== undefined) return { ok: false, error: '이미 투표했어요.' };
        v.votes[player.id] = !!msg.agree;
        checkVote(room);
        return { ok: true };
      }

      // 스파이의 장소 맞추기: { location }
      if (msg.type === 'guess') {
        if (g.spyId !== player.id) return { ok: false, error: '스파이만 장소를 맞출 수 있어요.' };
        const guess = String(msg.location || '');
        if (!LOCATION_NAMES.includes(guess)) return { ok: false, error: '목록에 없는 장소예요.' };
        if (guess === g.location) endGame(room, 'spy', `스파이가 장소(${guess})를 정확히 맞혔어요!`, { kind: 'guess' });
        else endGame(room, 'citizens', `스파이가 장소를 ${guess}(으)로 잘못 짚었어요. 시민 승리!`, { kind: 'wrongGuess' });
        return { ok: true };
      }
      return { ok: false, error: '알 수 없는 동작이에요.' };
    }

    /* ───────── 허브가 부르는 훅 ───────── */
    // 진행 중에 참가자가 나갔을 때 (허브가 이미 방에서 뺀 뒤에 불러요)
    function onLeave(room, player) {
      const g = room.g;
      if (!g || g.phase !== 'playing') return;
      pushSys(room, `${player.name}님이 게임을 떠났어요.`);
      // 스파이가 떠나면 시민 승리 (중단된 판이라 점수 없음)
      if (player.id === g.spyId) {
        return endGame(room, 'citizens', `스파이(${player.name})가 게임을 떠났어요. 시민 승리! (중단된 판이라 점수는 없어요)`, { kind: 'abort', also: [player] });
      }
      if (gamersOf(room).length < 3) {
        return endGame(room, 'none', '인원이 부족해 게임이 중단되었어요. (점수 없음)', { kind: 'abort' });
      }
      if (g.vote) {
        const v = g.vote;
        if (v.accusedId === player.id || v.accuserId === player.id) {
          clearTimeout(v.timer);
          g.vote = null;
          pushSys(room, '지목 투표 당사자가 떠나 투표가 취소되었어요.');
        } else {
          v.eligible = v.eligible.filter((id) => id !== player.id);
          delete v.votes[player.id];
        }
      }
      if (g.lastAskerId === player.id) g.lastAskerId = null;
      if (g.turnId === player.id) advanceTurn(room);
      if (g.vote) checkVote(room);
    }

    // 진행 중인 참가자의 연결이 오래 끊겼을 때: 차례만 넘겨요
    function onDrop(room, player) {
      const g = room.g;
      if (g && g.phase === 'playing' && g.turnId === player.id) advanceTurn(room);
    }

    function dispose(room) {
      const g = room.g;
      if (g) {
        clearTimeout(g.timer);
        if (g.vote) clearTimeout(g.vote.timer);
      }
      room.g = null;
    }

    return { start, view, action, onLeave, onDrop, dispose, isFinished: (room) => !!room.g && room.g.phase === 'ended' };
  },
};
