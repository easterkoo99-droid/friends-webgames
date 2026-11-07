'use strict';
/**
 * 스파이폴 - 추리/심리전 게임 (서버)
 *
 * 규칙
 *  - 한 판에 3~8명 참가. 한 명이 스파이, 나머지는 같은 장소 + 각자 역할을 받음
 *  - 입장한 사람은 '게임 준비'를 눌러야 참가자가 됨. 준비한 사람이 3명 이상이면 준비한 누구든 시작 가능
 *  - 게임 도중에 들어온 사람은 관전자. 준비를 눌러 두면 다음 판부터 참가
 *  - 차례인 사람이 앞선 질문에 답하고, 다음 질문 상대를 지목해 질문 (A→B→C→D…)
 *    직전에 나에게 질문한 사람에게는 바로 되물을 수 없음
 *  - 참가자는 (1인 1회) 스파이 지목 투표를 열 수 있음 - 지목 대상을 뺀 참가자의 과반 찬성 시 확정
 *  - 스파이는 언제든 장소를 맞춰볼 수 있음 (정답이면 스파이 승, 오답이면 시민 승)
 *  - 8분이 지나면 스파이 승
 */
const { makeCode, makeToken, makeId, cleanName, cleanText, shuffle, pick } = require('./util');

const CFG = {
  MIN_PLAYERS: 3,   // 한 판 최소 인원
  MAX_PLAYERS: 8,   // 한 판 최대 인원
  MAX_ROOM: 10,     // 관전자 포함 방 정원
  GAME_SEC: 8 * 60,
  VOTE_SEC: 30,
  DROP_GRACE_MS: 25000,
  ROOM_TTL_MS: 10 * 60 * 1000,
  CHAT_KEEP: 80,
};

const AVATARS = ['🕵️', '🎩', '🕶️', '🧥', '🗝️', '📻', '🔦', '🥃', '🧳', '🔎'];
// 어두운 배경에서 서로 구별되는 닉네임 색상
const COLORS = ['#ff8a80', '#ffb74d', '#ffe14d', '#c6e377', '#5fd38d', '#3fc7c0', '#5bc0f8', '#8e9bff', '#c58bff', '#ff7eb6'];

const LOCATIONS = [
  { name: '카지노', roles: ['딜러', '도박꾼', '경비원', '바텐더', '칵테일 웨이트리스', 'VIP 손님', '매니저', '관광객'] },
  { name: '해수욕장', roles: ['인명구조원', '서퍼', '아이스크림 장수', '관광객', '사진작가', '파라솔 대여업자', '어린이', '선탠하는 사람'] },
  { name: '우주정거장', roles: ['선장', '엔지니어', '과학자', '우주 관광객', '의사', '통신 담당', '요리사', '정비사'] },
  { name: '병원', roles: ['외과 의사', '간호사', '환자', '응급구조사', '약사', '인턴', '환자 보호자', '원무과 직원'] },
  { name: '학교', roles: ['선생님', '학생', '교장', '급식 조리사', '체육 교사', '수위', '사서', '전학생'] },
  { name: '경찰서', roles: ['형사', '순경', '용의자', '변호사', '피해자', '서장', '민원인', '감식 요원'] },
  { name: '은행', roles: ['은행원', '고객', '경비원', '지점장', '대출 상담원', '강도', '현금수송 기사', '청소 직원'] },
  { name: '비행기', roles: ['기장', '승무원', '승객', '정비사', '항공 보안관', '어린이 승객', '비즈니스석 승객', '기내식 담당'] },
  { name: '영화관', roles: ['매점 직원', '관객', '영사기사', '커플', '매표원', '영화 평론가', '청소 직원', '감독'] },
  { name: '레스토랑', roles: ['셰프', '웨이터', '손님', '설거지 담당', '소믈리에', '음식 평론가', '지배인', '배달 기사'] },
  { name: '놀이공원', roles: ['롤러코스터 운전원', '마스코트 인형탈', '가족 여행객', '매표원', '청소 직원', '소매치기', '놀이기구 정비사', '연인'] },
  { name: '도서관', roles: ['사서', '대학원생', '조용히 시키는 직원', '노트북 작업자', '어린이', '자원봉사자', '작가', '책 연체자'] },
  { name: '군부대', roles: ['사령관', '병사', '저격수', '군의관', '통신병', '취사병', '신병', '정찰병'] },
  { name: '기차', roles: ['차장', '승객', '매점 판매원', '검표원', '기관사', '배낭여행객', '식당칸 요리사', '무임승차자'] },
  { name: '서커스', roles: ['곡예사', '광대', '사자 조련사', '마술사', '관객', '단장', '매표원', '공중그네 곡예사'] },
  { name: '해적선', roles: ['선장', '항해사', '요리사', '포로', '갑판장', '대포 담당', '망보는 선원', '선상 의사'] },
  { name: '잠수함', roles: ['함장', '소나 담당', '어뢰병', '엔지니어', '요리사', '부함장', '통신병', '의무병'] },
  { name: '호텔', roles: ['벨보이', '프런트 직원', '투숙객', '청소 직원', '지배인', '컨시어지', '경비원', '신혼부부'] },
  { name: 'PC방', roles: ['알바생', '게이머', '사장님', '초등학생', '대회 준비 팀', '라면 먹는 손님', '야간 단골', '수리 기사'] },
  { name: '찜질방', roles: ['세신사', '아이', '아빠', '매점 직원', '수면실 손님', '관리인', '커플', '단체 손님'] },
  { name: '캠핑장', roles: ['사장님', '초보 캠퍼', '고수 캠퍼', '아이들', '불멍 담당', '야간 순찰', '바비큐 담당', '혼캠족'] },
];
const LOCATION_NAMES = LOCATIONS.map((l) => l.name);

module.exports = function registerSpyfall(io) {
  const rooms = new Map();

  const gamersOf = (room) => room.players.filter((p) => p.inGame);
  const nameOf = (room, id) => (room.players.find((p) => p.id === id) || {}).name || '?';
  const pushSys = (room, text) => room.thread.push({ type: 'sys', text, t: Date.now() });

  function lastQa(room) {
    for (let i = room.thread.length - 1; i >= 0; i--) if (room.thread[i].type === 'qa') return room.thread[i];
    return null;
  }
  // 아직 답변이 달리지 않은 마지막 질문
  function pendingQa(room) {
    const q = lastQa(room);
    return q && q.answer === null && !q.skipped ? q : null;
  }

  /* ───────── 상태 직렬화 ───────── */
  function voteView(room) {
    const v = room.vote;
    if (!v) return null;
    return { accuserId: v.accuserId, accusedId: v.accusedId, votes: v.votes, eligible: v.eligible, endsAt: v.endsAt };
  }

  function readyCountOf(room) {
    return room.players.filter((p) => p.ready && p.connected).length;
  }

  function stateFor(room, pid) {
    const me = room.players.find((p) => p.id === pid);
    const started = room.phase === 'playing' || room.phase === 'ended';
    const isGamer = !!(me && me.inGame);
    const isSpy = started && isGamer && room.spyId === pid;
    const readyCount = readyCountOf(room);
    const lobbyLike = room.phase === 'waiting' || room.phase === 'ended';
    return {
      now: Date.now(),
      code: room.code,
      phase: room.phase,
      gameNo: room.gameNo,
      you: pid,
      min: CFG.MIN_PLAYERS,
      maxGamers: CFG.MAX_PLAYERS,
      readyCount,
      canStart: lobbyLike && !!(me && me.ready) && readyCount >= CFG.MIN_PLAYERS && readyCount <= CFG.MAX_PLAYERS,
      players: room.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected, ready: p.ready, inGame: p.inGame,
      })),
      endsAt: room.phase === 'playing' ? room.endsAt : 0,
      gameSec: CFG.GAME_SEC,
      voteSec: CFG.VOTE_SEC,
      turnId: room.phase === 'playing' ? room.turnId : null,
      lastAskerId: room.phase === 'playing' ? room.lastAskerId : null,
      pending: room.phase === 'playing' ? pendingQa(room) : null,
      thread: room.thread.slice(-100),
      vote: voteView(room),
      canAccuse: room.phase === 'playing' && isGamer && !room.vote && !room.accusers.has(pid),
      me: started && me
        ? (isGamer
          ? { spectator: false, isSpy, location: isSpy ? null : room.location.name, role: isSpy ? null : me.role }
          : { spectator: true })
        : null,
      locations: LOCATION_NAMES,
      result: room.phase === 'ended' ? room.result : null,
    };
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of room.players) {
      if (p.connected && p.socketId) io.to(p.socketId).emit('spy_state', stateFor(room, p.id));
    }
  }

  /* ───────── 게임 진행 ───────── */
  function startGame(room, gamers) {
    const loc = pick(LOCATIONS);
    const spy = pick(gamers);
    const roles = shuffle(loc.roles);
    let ri = 0;
    room.players.forEach((p) => {
      p.inGame = gamers.includes(p);
      p.role = null;
    });
    gamers.forEach((p) => {
      if (p.id !== spy.id) p.role = roles[ri++ % roles.length];
    });
    room.phase = 'playing';
    room.gameNo += 1;
    room.location = loc;
    room.spyId = spy.id;
    room.turnId = pick(gamers).id;
    room.lastAskerId = null;
    room.vote = null;
    room.accusers = new Set();
    room.result = null;
    room.thread = [];
    room.qaCount = 0;
    pushSys(room, `게임 시작! ${nameOf(room, room.turnId)}님부터 질문을 시작하세요.`);
    room.endsAt = Date.now() + CFG.GAME_SEC * 1000;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => endGame(room, 'spy', '제한 시간이 끝났어요. 스파이를 찾지 못했습니다.'), CFG.GAME_SEC * 1000);
    broadcast(room);
  }

  function endGame(room, winner, reason) {
    if (room.phase !== 'playing') return;
    clearTimeout(room.timer);
    if (room.vote) clearTimeout(room.vote.timer);
    room.vote = null;
    room.phase = 'ended';
    room.endsAt = 0;
    room.result = {
      winner, // 'citizens' | 'spy' | 'none'
      reason,
      spyId: room.spyId,
      spyName: nameOf(room, room.spyId),
      location: room.location.name,
      roles: gamersOf(room).map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, role: p.id === room.spyId ? '스파이' : p.role,
      })),
    };
    pushSys(room, '게임 종료');
    broadcast(room);
  }

  /* ───────── 투표 ───────── */
  function tally(room) {
    const v = room.vote;
    const agree = v.eligible.filter((id) => v.votes[id] === true).length;
    const disagree = v.eligible.filter((id) => v.votes[id] === false).length;
    return { agree, disagree, n: v.eligible.length };
  }

  function settleVote(room, passed) {
    const v = room.vote;
    if (!v) return;
    clearTimeout(v.timer);
    const accusedName = nameOf(room, v.accusedId);
    room.vote = null;
    if (!passed) {
      pushSys(room, `${accusedName}님 지목 투표가 부결되었어요. 게임을 계속합니다.`);
      return broadcast(room);
    }
    if (v.accusedId === room.spyId) {
      endGame(room, 'citizens', `과반수가 지목한 ${accusedName}님이 진짜 스파이였어요!`);
    } else {
      endGame(room, 'spy', `${accusedName}님은 시민이었어요. 무고한 사람을 지목해 스파이가 승리했습니다.`);
    }
  }

  function checkVote(room, timedOut = false) {
    if (!room.vote) return;
    const { agree, disagree, n } = tally(room);
    if (agree * 2 > n) return settleVote(room, true);
    if (disagree * 2 >= n) return settleVote(room, false);
    if (timedOut || agree + disagree >= n) return settleVote(room, agree * 2 > n);
    broadcast(room);
  }

  /* ───────── 방/플레이어 관리 ───────── */
  function destroyRoom(room) {
    clearTimeout(room.timer);
    if (room.vote) clearTimeout(room.vote.timer);
    room.players.forEach((p) => clearTimeout(p.dropTimer));
    rooms.delete(room.code);
  }

  // 차례인 사람이 사라졌을 때 다음 사람에게 차례를 넘김
  function advanceTurn(room) {
    const gs = gamersOf(room);
    const cand = gs.filter((p) => p.connected && p.id !== room.turnId && p.id !== room.lastAskerId);
    const next = cand.length ? pick(cand) : gs.find((p) => p.id !== room.turnId);
    if (!next) return;
    const q = pendingQa(room);
    if (q) q.skipped = true;
    pushSys(room, `${nameOf(room, room.turnId)}님이 자리를 비워 ${next.name}님에게 차례가 넘어갔어요.`);
    room.turnId = next.id;
  }

  function removePlayer(room, player) {
    clearTimeout(player.dropTimer);
    const wasGamer = room.phase === 'playing' && player.inGame;

    // 스파이가 떠나면 시민 승리 (결과에 스파이 정보를 담기 위해 제거 전에 종료 처리)
    if (wasGamer && player.id === room.spyId) {
      pushSys(room, `${player.name}님(스파이)이 게임을 떠났어요.`);
      endGame(room, 'citizens', `스파이(${player.name})가 게임을 떠났어요. 시민 승리!`);
      room.players = room.players.filter((p) => p.id !== player.id);
      if (room.players.length === 0) return destroyRoom(room);
      return broadcast(room);
    }

    const wasTurn = room.turnId === player.id;
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) return destroyRoom(room);

    if (wasGamer) {
      pushSys(room, `${player.name}님이 게임을 떠났어요.`);
      if (gamersOf(room).length < CFG.MIN_PLAYERS) {
        return endGame(room, 'none', '인원이 부족해 게임이 중단되었어요.');
      }
      if (room.vote) {
        const v = room.vote;
        if (v.accusedId === player.id || v.accuserId === player.id) {
          clearTimeout(v.timer);
          room.vote = null;
          pushSys(room, '지목 투표 당사자가 떠나 투표가 취소되었어요.');
        } else {
          v.eligible = v.eligible.filter((id) => id !== player.id);
          delete v.votes[player.id];
        }
      }
      if (room.lastAskerId === player.id) room.lastAskerId = null;
      if (wasTurn) advanceTurn(room);
      if (room.vote) return checkVote(room);
    }
    broadcast(room);
  }

  function dropPlayer(room, player) {
    if (!rooms.has(room.code) || player.connected) return;
    if (room.phase === 'playing' && player.inGame) {
      // 진행 중인 참가자는 자리를 유지하되, 차례인 사람이 오래 비우면 차례만 넘긴다
      if (room.turnId === player.id) {
        advanceTurn(room);
        broadcast(room);
      }
    } else {
      removePlayer(room, player);
    }
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
      role: null,
      connected: false,
      socketId: null,
      dropTimer: null,
      lastChatAt: 0,
    };
  }

  function attach(socket, room, player) {
    clearTimeout(player.dropTimer);
    player.connected = true;
    player.socketId = socket.id;
    socket.data.spy = { code: room.code, pid: player.id };
    socket.join(`spy:${room.code}`);
    socket.emit('spy_chatlog', room.chat);
    broadcast(room);
  }

  function ctxOf(socket) {
    const d = socket.data.spy;
    if (!d) return null;
    const room = rooms.get(d.code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === d.pid);
    return player ? { room, player } : null;
  }

  /* ───────── 소켓 이벤트 ───────── */
  io.on('connection', (socket) => {
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});

    socket.on('spy_create', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      const code = makeCode(rooms);
      const room = {
        code,
        phase: 'waiting',
        gameNo: 0,
        players: [],
        location: null,
        spyId: null,
        turnId: null,
        lastAskerId: null,
        thread: [],
        qaCount: 0,
        vote: null,
        accusers: new Set(),
        chat: [],
        result: null,
        endsAt: 0,
        timer: null,
        lastActive: Date.now(),
      };
      const player = newPlayer(room, name);
      room.players.push(player);
      rooms.set(code, room);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    // 게임 도중에도 입장 가능 (관전자로 시작)
    socket.on('spy_join', (data, cb) => {
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

    socket.on('spy_rejoin', (data, cb) => {
      cb = reply(cb);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      const player = room && room.players.find((p) => p.token === (data && data.token));
      if (!room || !player) return cb({ ok: false, error: '방을 찾을 수 없거나 세션이 만료되었습니다.' });
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) {
          old.data.spy = null;
          old.emit('spy_kicked');
        }
      }
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    // 게임 준비 토글 (진행 중에는 '다음 판 참가' 의미)
    socket.on('spy_ready', () => {
      const c = ctxOf(socket);
      if (!c) return;
      c.player.ready = !c.player.ready;
      broadcast(c.room);
    });

    // 준비한 사람이 3명 이상이면 준비한 누구든 시작 가능
    socket.on('spy_start', (_d, cb) => {
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

    // 질문 턴 넘기기: { target, question, answer }
    // 질문을 받은 사람은 답변을 적고(필수), 다음 질문 상대를 지목해 질문한다.
    socket.on('spy_pass_turn', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'playing') return cb({ ok: false, error: '진행 중인 게임이 아니에요.' });
      if (!player.inGame) return cb({ ok: false, error: '관전 중에는 질문할 수 없어요.' });
      if (room.vote) return cb({ ok: false, error: '투표가 진행 중이에요.' });
      if (room.turnId !== player.id) return cb({ ok: false, error: '지금은 내 차례가 아니에요.' });
      const target = room.players.find((p) => p.id === (data && data.target) && p.inGame);
      if (!target || target.id === player.id) return cb({ ok: false, error: '질문할 상대를 선택해 주세요.' });
      if (target.id === room.lastAskerId) return cb({ ok: false, error: '방금 나에게 질문한 사람에게는 바로 되물을 수 없어요.' });
      const question = cleanText(data && data.question, 120);
      if (!question) return cb({ ok: false, error: '질문을 입력해 주세요.' });
      const pend = pendingQa(room);
      const answer = cleanText(data && data.answer, 160);
      if (pend && !answer) return cb({ ok: false, error: '받은 질문에 대한 답변을 먼저 적어 주세요.' });

      if (pend) {
        pend.answer = answer;
        pend.answeredAt = Date.now();
      }
      room.thread.push({
        type: 'qa',
        n: ++room.qaCount,
        askerId: player.id, askerName: player.name, askerAvatar: player.avatar, askerColor: player.color,
        targetId: target.id, targetName: target.name, targetAvatar: target.avatar, targetColor: target.color,
        question,
        answer: null,
        skipped: false,
        t: Date.now(),
      });
      room.lastAskerId = player.id;
      room.turnId = target.id;
      cb({ ok: true });
      broadcast(room);
    });

    // 스파이 지목 투표 시작: { target }  (참가자만)
    socket.on('spy_accuse', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'playing') return cb({ ok: false, error: '진행 중인 게임이 아니에요.' });
      if (!player.inGame) return cb({ ok: false, error: '관전 중에는 지목할 수 없어요.' });
      if (room.vote) return cb({ ok: false, error: '이미 투표가 진행 중이에요.' });
      if (room.accusers.has(player.id)) return cb({ ok: false, error: '지목은 한 사람당 한 번만 할 수 있어요.' });
      const target = room.players.find((p) => p.id === (data && data.target) && p.inGame);
      if (!target || target.id === player.id) return cb({ ok: false, error: '지목할 사람을 선택해 주세요.' });

      room.accusers.add(player.id);
      room.vote = {
        accuserId: player.id,
        accusedId: target.id,
        votes: { [player.id]: true },
        eligible: gamersOf(room).filter((p) => p.id !== target.id).map((p) => p.id),
        endsAt: Date.now() + CFG.VOTE_SEC * 1000,
        timer: null,
      };
      room.vote.timer = setTimeout(() => checkVote(room, true), CFG.VOTE_SEC * 1000);
      pushSys(room, `${player.name}님이 ${target.name}님을 스파이로 지목했어요.`);
      cb({ ok: true });
      checkVote(room);
    });

    // 투표: { agree: boolean }
    socket.on('spy_vote', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c || !c.room.vote) return cb({ ok: false, error: '진행 중인 투표가 없어요.' });
      const { room, player } = c;
      const v = room.vote;
      if (!v.eligible.includes(player.id)) return cb({ ok: false, error: '투표할 수 없어요. (지목된 사람이거나 관전 중)' });
      if (v.votes[player.id] !== undefined) return cb({ ok: false, error: '이미 투표했어요.' });
      v.votes[player.id] = !!(data && data.agree);
      cb({ ok: true });
      checkVote(room);
    });

    // 스파이의 장소 맞추기: { location }
    socket.on('spy_guess', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'playing') return cb({ ok: false, error: '진행 중인 게임이 아니에요.' });
      if (room.spyId !== player.id) return cb({ ok: false, error: '스파이만 장소를 맞출 수 있어요.' });
      const guess = String((data && data.location) || '');
      if (!LOCATION_NAMES.includes(guess)) return cb({ ok: false, error: '목록에 없는 장소예요.' });
      cb({ ok: true });
      if (guess === room.location.name) {
        endGame(room, 'spy', `스파이가 장소(${guess})를 정확히 맞혔어요!`);
      } else {
        endGame(room, 'citizens', `스파이가 장소를 ${guess}(으)로 잘못 짚었어요. 시민 승리!`);
      }
    });

    // 전체 채팅 (참가자·관전자 모두)
    socket.on('spy_chat', (data) => {
      const c = ctxOf(socket);
      if (!c) return;
      const now = Date.now();
      if (now - c.player.lastChatAt < 300) return; // 도배 방지
      const text = cleanText(data && data.text, 200);
      if (!text) return;
      c.player.lastChatAt = now;
      const msg = {
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
      io.to(`spy:${c.room.code}`).emit('spy_chat', msg);
    });

    socket.on('spy_leave', () => {
      const c = ctxOf(socket);
      socket.data.spy = null;
      if (!c) return;
      socket.leave(`spy:${c.room.code}`);
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
