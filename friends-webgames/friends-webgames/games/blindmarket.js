'use strict';
/**
 * 블라인드 마켓 - 눈치 쟁탈 경매 게임 (서버)
 *
 * 규칙
 *  - 시작 자금 50P, 총 10라운드 (5·10라운드는 하이라이트)
 *  - 모든 플레이어가 동시에 비밀 입찰, 가장 높은 금액이 낙찰 (동액이면 먼저 제출한 사람)
 *  - 낙찰자는 입찰가만큼 자금 차감, 작품 점수 획득 (블라인드 작품은 위조품이면 벌점)
 *  - 모두 0P를 적으면 유찰
 *  - 최종 점수 = 작품 점수 + 남은 자금 ÷ 5 (내림)
 */
const { makeCode, makeToken, makeId, cleanName, cleanText, shuffle, randInt } = require('./util');

const CFG = {
  START_FUNDS: 50,
  ROUNDS: 10,
  BID_SEC: 30,
  REVEAL_SEC: 8,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  FUND_DIV: 5,
  DROP_GRACE_MS: 20000,
  ROOM_TTL_MS: 10 * 60 * 1000,
};

const AVATARS = ['🎨', '🖼️', '🗿', '🏺', '🎭', '📜', '🪞', '🕰️'];

const NAMES = {
  public: ['석양의 항구', '푸른 정원', '도시의 밤', '고요한 호수', '붉은 들판', '안개 낀 산', '춤추는 가면', '황금 도서관'],
  blind: ['미지의 초상', '이름 없는 풍경', '잊힌 거장의 습작', '봉인된 캔버스', '창고에서 나온 그림'],
  highlight: ['왕관을 쓴 달', '천 년의 정원', '별을 삼킨 바다'],
};

const HINT = { good: '진품일 가능성이 높아 보입니다', bad: '어딘가 수상한 구석이 있습니다' };

module.exports = function registerBlindMarket(io) {
  const rooms = new Map();

  /* ───────── 작품/라운드 생성 ───────── */
  function makeItem(type, name) {
    if (type === 'public') return { type, name, emoji: '🖼️', value: randInt(3, 8) };
    if (type === 'highlight') return { type, name, emoji: '👑', value: randInt(10, 16) };
    const forged = Math.random() < 0.3;
    const value = forged ? -randInt(3, 6) : randInt(4, 12);
    const accurate = Math.random() < 0.7; // 감정사 소견이 맞을 확률
    const looksGood = forged ? !accurate : accurate;
    return { type, name, emoji: '❔', value, forged, hint: looksGood ? 'good' : 'bad' };
  }

  function buildRounds() {
    const mid = shuffle([...Array(4).fill('public'), ...Array(4).fill('blind')]);
    const types = [...mid.slice(0, 4), 'highlight', ...mid.slice(4), 'highlight'];
    const pools = {
      public: shuffle(NAMES.public),
      blind: shuffle(NAMES.blind),
      highlight: shuffle(NAMES.highlight),
    };
    return types.map((t) => makeItem(t, pools[t].pop()));
  }

  function itemView(item, revealed) {
    const v = { type: item.type, name: item.name, emoji: item.emoji };
    if (item.type === 'blind') {
      v.range = '-6 ~ +12';
      v.hintText = HINT[item.hint];
      v.hint = item.hint;
      if (revealed) {
        v.value = item.value;
        v.forged = item.forged;
        v.emoji = item.forged ? '🚫' : '✨';
      }
    } else {
      v.value = item.value;
    }
    return v;
  }

  /* ───────── 상태 직렬화 ───────── */
  function stateFor(room, pid) {
    const me = room.players.find((p) => p.id === pid);
    const inGame = room.phase === 'bidding' || room.phase === 'revealing';
    const cur = room.rounds[room.round - 1];
    return {
      now: Date.now(),
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      you: pid,
      round: room.round,
      totalRounds: CFG.ROUNDS,
      endsAt: room.endsAt,
      cfg: { startFunds: CFG.START_FUNDS, fundDiv: CFG.FUND_DIV, bidSec: CFG.BID_SEC, revealSec: CFG.REVEAL_SEC, min: CFG.MIN_PLAYERS },
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        funds: p.funds,
        score: p.score,
        ready: p.ready,
        connected: p.connected,
        submitted: p.bid !== null,
      })),
      roadmap: room.rounds.map((it, i) => ({
        type: it.type,
        state: i + 1 < room.round ? 'done' : i + 1 === room.round ? 'current' : 'upcoming',
        winner: room.history[i] ? room.history[i].winnerAvatar : null,
        unsold: room.history[i] ? room.history[i].unsold : false,
      })),
      item: inGame && cur ? itemView(cur, room.phase === 'revealing') : null,
      reveal: room.phase === 'revealing' ? room.history[room.round - 1] : null,
      myBid: me && me.bid !== null ? me.bid : null,
      final: room.phase === 'finished' ? room.final : null,
    };
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of room.players) {
      if (p.connected && p.socketId) io.to(p.socketId).emit('bm_state', stateFor(room, p.id));
    }
  }

  /* ───────── 게임 진행 ───────── */
  function startRound(room) {
    clearTimeout(room.timer);
    room.phase = 'bidding';
    room.seq = 0;
    room.players.forEach((p) => {
      p.bid = null;
      p.bidAt = 0;
    });
    room.endsAt = Date.now() + CFG.BID_SEC * 1000;
    room.timer = setTimeout(() => resolveRound(room), CFG.BID_SEC * 1000 + 300);
    broadcast(room);
  }

  function activePlayers(room) {
    return room.players.filter((p) => p.connected && !p.left);
  }

  function checkAllSubmitted(room) {
    if (room.phase !== 'bidding') return;
    const act = activePlayers(room);
    if (act.length > 0 && act.every((p) => p.bid !== null)) resolveRound(room);
  }

  function resolveRound(room) {
    if (room.phase !== 'bidding') return;
    clearTimeout(room.timer);
    const item = room.rounds[room.round - 1];
    const ranked = room.players
      .map((p) => ({ p, bid: p.bid ?? 0, at: p.bidAt || Infinity }))
      .sort((a, b) => b.bid - a.bid || a.at - b.at);
    const top = ranked[0];
    const unsold = !top || top.bid <= 0;

    if (!unsold) {
      top.p.funds -= top.bid;
      top.p.score += item.value;
      top.p.won.push({ round: room.round, name: item.name, value: item.value, paid: top.bid });
    }

    room.history[room.round - 1] = {
      round: room.round,
      item: itemView(item, true),
      unsold,
      winnerId: unsold ? null : top.p.id,
      winnerName: unsold ? null : top.p.name,
      winnerAvatar: unsold ? null : top.p.avatar,
      bid: unsold ? 0 : top.bid,
      delta: unsold ? 0 : item.value,
      bids: ranked.map((r) => ({
        id: r.p.id,
        name: r.p.name,
        avatar: r.p.avatar,
        bid: r.bid,
        submitted: r.p.bid !== null,
        won: !unsold && r.p.id === top.p.id,
      })),
    };

    room.phase = 'revealing';
    room.endsAt = Date.now() + CFG.REVEAL_SEC * 1000;
    room.timer = setTimeout(() => nextRound(room), CFG.REVEAL_SEC * 1000);
    broadcast(room);
  }

  function nextRound(room) {
    if (room.phase !== 'revealing') return;
    if (room.round >= CFG.ROUNDS) return finishGame(room);
    room.round += 1;
    startRound(room);
  }

  function finishGame(room) {
    clearTimeout(room.timer);
    room.final = room.players
      .map((p) => {
        const bonus = Math.floor(p.funds / CFG.FUND_DIV);
        return { id: p.id, name: p.name, avatar: p.avatar, score: p.score, funds: p.funds, bonus, total: p.score + bonus, won: p.won };
      })
      .sort((a, b) => b.total - a.total || b.funds - a.funds)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    room.phase = 'finished';
    room.endsAt = 0;
    broadcast(room);
  }

  function resetToWaiting(room) {
    clearTimeout(room.timer);
    room.phase = 'waiting';
    room.round = 0;
    room.rounds = [];
    room.history = [];
    room.final = null;
    room.endsAt = 0;
    room.players.forEach((p) => {
      p.funds = CFG.START_FUNDS;
      p.score = 0;
      p.ready = false;
      p.bid = null;
      p.won = [];
    });
    // 이탈한 플레이어 정리
    room.players = room.players.filter((p) => !p.left);
    if (!room.players.find((p) => p.id === room.hostId)) fixHost(room);
    broadcast(room);
  }

  /* ───────── 방/플레이어 관리 ───────── */
  function fixHost(room) {
    const next = room.players.find((p) => p.connected && !p.left) || room.players[0];
    room.hostId = next ? next.id : null;
    if (next) next.ready = true;
  }

  function destroyRoom(room) {
    clearTimeout(room.timer);
    room.players.forEach((p) => clearTimeout(p.dropTimer));
    rooms.delete(room.code);
  }

  function removePlayer(room, player) {
    clearTimeout(player.dropTimer);
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) return destroyRoom(room);
    if (room.hostId === player.id) fixHost(room);
    broadcast(room);
  }

  function dropPlayer(room, player) {
    if (!rooms.has(room.code) || player.connected) return;
    if (room.phase === 'waiting' || room.phase === 'finished') {
      removePlayer(room, player);
    } else {
      if (room.hostId === player.id) fixHost(room);
      broadcast(room);
      checkAllSubmitted(room);
    }
  }

  function newPlayer(room, name) {
    const used = new Set(room.players.map((p) => p.avatar));
    return {
      id: makeId(),
      token: makeToken(),
      name,
      avatar: AVATARS.find((a) => !used.has(a)) || AVATARS[0],
      funds: CFG.START_FUNDS,
      score: 0,
      ready: false,
      connected: false,
      left: false,
      socketId: null,
      bid: null,
      bidAt: 0,
      won: [],
      dropTimer: null,
    };
  }

  function attach(socket, room, player) {
    clearTimeout(player.dropTimer);
    player.connected = true;
    player.socketId = socket.id;
    socket.data.bm = { code: room.code, pid: player.id };
    socket.join(`bm:${room.code}`);
    socket.emit('bm_chatlog', room.chat);
    broadcast(room);
  }

  function ctxOf(socket) {
    const d = socket.data.bm;
    if (!d) return null;
    const room = rooms.get(d.code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === d.pid);
    if (!player) return null;
    return { room, player };
  }

  /* ───────── 소켓 이벤트 ───────── */
  io.on('connection', (socket) => {
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});

    socket.on('bm_create', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      const code = makeCode(rooms);
      const room = {
        code,
        hostId: null,
        phase: 'waiting',
        players: [],
        round: 0,
        rounds: [],
        history: [],
        final: null,
        endsAt: 0,
        seq: 0,
        timer: null,
        chat: [],
        lastActive: Date.now(),
      };
      const player = newPlayer(room, name);
      player.ready = true;
      room.players.push(player);
      room.hostId = player.id;
      rooms.set(code, room);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('bm_join', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      if (!room) return cb({ ok: false, error: '존재하지 않는 방 코드입니다.' });
      if (room.phase !== 'waiting') return cb({ ok: false, error: '이미 게임이 시작된 방입니다.' });
      if (room.players.length >= CFG.MAX_PLAYERS) return cb({ ok: false, error: `방이 가득 찼습니다. (최대 ${CFG.MAX_PLAYERS}명)` });
      if (room.players.some((p) => p.name === name)) return cb({ ok: false, error: '같은 방에 이미 사용 중인 닉네임입니다.' });
      const player = newPlayer(room, name);
      room.players.push(player);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('bm_rejoin', (data, cb) => {
      cb = reply(cb);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      const player = room && room.players.find((p) => p.token && p.token === (data && data.token) && !p.left);
      if (!room || !player) return cb({ ok: false, error: '방을 찾을 수 없거나 세션이 만료되었습니다.' });
      // 이전 소켓이 남아 있으면 정리 (다른 탭에서 열었을 때)
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) {
          old.data.bm = null;
          old.emit('bm_kicked');
        }
      }
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('bm_ready', () => {
      const c = ctxOf(socket);
      if (!c || c.room.phase !== 'waiting' || c.room.hostId === c.player.id) return;
      c.player.ready = !c.player.ready;
      broadcast(c.room);
    });

    socket.on('bm_start', (_d, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c || c.room.hostId !== c.player.id) return cb({ ok: false, error: '방장만 시작할 수 있어요.' });
      const { room } = c;
      if (room.phase !== 'waiting') return cb({ ok: false, error: '이미 진행 중입니다.' });
      if (room.players.length < CFG.MIN_PLAYERS) return cb({ ok: false, error: `최소 ${CFG.MIN_PLAYERS}명이 필요해요.` });
      if (!room.players.every((p) => p.ready || p.id === room.hostId)) return cb({ ok: false, error: '아직 준비하지 않은 참가자가 있어요.' });
      room.rounds = buildRounds();
      room.history = [];
      room.final = null;
      room.round = 1;
      room.players.forEach((p) => {
        p.funds = CFG.START_FUNDS;
        p.score = 0;
        p.won = [];
      });
      startRound(room);
      cb({ ok: true });
    });

    // 비밀 입찰 제출
    socket.on('submit_bid', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'bidding') return cb({ ok: false, error: '지금은 입찰할 수 없어요.' });
      if (player.bid !== null) return cb({ ok: false, error: '이미 입찰을 제출했어요.' });
      const amount = Number(data && data.amount);
      if (!Number.isInteger(amount) || amount < 0) return cb({ ok: false, error: '0 이상의 정수를 입력해 주세요.' });
      if (amount > player.funds) return cb({ ok: false, error: `보유 자금(${player.funds}P)을 넘을 수 없어요.` });
      player.bid = amount;
      player.bidAt = ++room.seq;
      cb({ ok: true });
      broadcast(room);
      checkAllSubmitted(room);
    });

    socket.on('bm_chat', (data) => {
      const c = ctxOf(socket);
      if (!c) return;
      const text = cleanText(data && data.text, 200);
      if (!text) return;
      const msg = { name: c.player.name, avatar: c.player.avatar, text, t: Date.now() };
      c.room.chat.push(msg);
      if (c.room.chat.length > 60) c.room.chat.shift();
      c.room.lastActive = Date.now();
      io.to(`bm:${c.room.code}`).emit('bm_chat', msg);
    });

    socket.on('bm_reset', (_d, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c || c.room.hostId !== c.player.id) return cb({ ok: false, error: '방장만 할 수 있어요.' });
      if (c.room.phase !== 'finished') return cb({ ok: false, error: '게임이 끝난 뒤에 사용할 수 있어요.' });
      resetToWaiting(c.room);
      cb({ ok: true });
    });

    socket.on('bm_leave', () => {
      const c = ctxOf(socket);
      socket.data.bm = null;
      if (!c) return;
      socket.leave(`bm:${c.room.code}`);
      const { room, player } = c;
      if (room.phase === 'waiting' || room.phase === 'finished') {
        removePlayer(room, player);
      } else {
        player.left = true;
        player.connected = false;
        player.socketId = null;
        player.token = null;
        if (room.hostId === player.id) fixHost(room);
        broadcast(room);
        checkAllSubmitted(room);
      }
    });

    socket.on('disconnect', () => {
      const c = ctxOf(socket);
      if (!c || c.player.socketId !== socket.id) return;
      const { room, player } = c;
      player.connected = false;
      player.socketId = null;
      player.dropTimer = setTimeout(() => dropPlayer(room, player), CFG.DROP_GRACE_MS);
      broadcast(room);
      checkAllSubmitted(room);
    });
  });

  // 비어 있는 방 정리
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const anyone = room.players.some((p) => p.connected);
      if (!anyone && now - room.lastActive > CFG.ROOM_TTL_MS) destroyRoom(room);
    }
  }, 60 * 1000).unref();
};
