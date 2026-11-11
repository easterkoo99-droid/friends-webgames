'use strict';
/**
 * 게임방 허브
 *  - 방 코드, 입장/재접속, 닉네임, 채팅, 준비, 관전자, 누적 점수(👑)를 맡아요.
 *  - 대기실에서 게임을 고르고(select) 시작하고(start), 끝나면 다른 게임으로 바로 바꿀 수 있어요(lobby).
 *  - 게임별 규칙은 games/ 폴더의 플러그인이 맡아요. (games/index.js 참고)
 *
 * 플러그인 형식 (서버)
 *  { id, name, emoji, desc, rules: [..], min, max, create(api) → {
 *      start(room, gamers), view(room, pid), action(room, player, msg), isFinished(room),
 *      onLeave?(room, player), onDrop?(room, player), dispose(room) } }
 *  api = { broadcast(room), chatSys(room, text), addScore(room, player, n) }
 *  게임 상태는 room.g 에 자유롭게 저장해요.
 */
const { makeCode, makeToken, makeId, cleanName, cleanText } = require('./games/util');
const PLUGINS = require('./games');

const CFG = {
  MAX_ROOM: 16,            // 관전자 포함 방 정원
  DROP_GRACE_MS: 25000,    // 연결이 끊긴 뒤 자리를 유지하는 시간
  ROOM_TTL_MS: 10 * 60 * 1000,
  CHAT_KEEP: 80,
  // 방장(방을 만든 사람, 나가면 다음 사람)만 게임을 고르고 바꿀 수 있어요. false 로 바꾸면 누구나 바꿀 수 있어요. (테스트용: 환경변수 HOST_ONLY_SWITCH=0)
  get HOST_ONLY_SWITCH() { return process.env.HOST_ONLY_SWITCH !== '0'; },
};

// 화면 파일(index.html)과 서버 파일(hub.js)이 같은 버전인지 확인하는 번호예요. 규칙이 바뀌면 둘 다 올리고 이 번호를 같이 올려요.
const PROTO = 5;

const AVATARS = ['🐯', '🐱', '🐻', '🐰', '🦊', '🐼', '🐸', '🐵', '🐧', '🦁', '🐮', '🐷', '🐨', '🐶', '🦄', '🐙'];
const COLORS = [
  '#e5484d', '#e07a1f', '#c99a00', '#5a9a1f', '#17915f', '#0f9aa0', '#2b7fd6', '#5b61e0',
  '#9b52d9', '#d6409f', '#c4571c', '#7f9a14', '#10a37f', '#1a90b8', '#6d5ad0', '#c2438f',
];

module.exports = function registerHub(io) {
  const rooms = new Map();
  const impls = new Map();

  const api = {
    broadcast: (room) => broadcast(room),
    chatSys: (room, text) => pushChatSys(room, text),
    addScore: (room, player, n) => { player.score += n; },
  };
  PLUGINS.forEach((P) => impls.set(P.id, P.create(api)));

  const defOf = (room) => PLUGINS.find((p) => p.id === room.gameId);
  const implOf = (room) => impls.get(room.gameId);
  const isFinished = (room) => room.phase === 'game' && !!implOf(room).isFinished(room);
  const gamersOf = (room) => room.players.filter((p) => p.inGame);

  function pushChatSys(room, text) {
    const msg = { sys: true, text, t: Date.now() };
    room.chat.push(msg);
    if (room.chat.length > CFG.CHAT_KEEP) room.chat.shift();
    io.to(`room:${room.code}`).emit('chat', msg);
  }

  /* ───────── 상태 ───────── */
  function viewFor(room, pid) {
    const me = room.players.find((p) => p.id === pid);
    const def = defOf(room);
    const finished = isFinished(room);
    const readyCount = room.players.filter((p) => p.ready && p.connected).length;
    return {
      now: Date.now(),
      code: room.code,
      you: pid,
      hostId: room.hostId,
      phase: room.phase,                 // 'lobby' | 'game'
      gameNo: room.gameNo,
      games: PLUGINS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, accent: p.accent || '#7c6cff', desc: p.desc, rules: p.rules || [], min: p.min, max: p.max, help: p.id === room.gameId ? (p.help || null) : null })),   // 설명은 지금 고른 게임 것만 보내요
      selected: room.gameId,
      proto: PROTO,
      hostOnly: CFG.HOST_ONLY_SWITCH,
      switchLocked: !!(CFG.HOST_ONLY_SWITCH && me && me.id !== room.hostId),
      players: room.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, connected: p.connected,
        ready: p.ready, inGame: p.inGame, score: p.score,
      })),
      readyCount,
      finished,
      canStart: (room.phase === 'lobby' || finished) && !!(me && me.ready) && readyCount >= def.min && readyCount <= def.max,
      spectator: room.phase === 'game' && !(me && me.inGame),
      game: room.phase === 'game' ? implOf(room).view(room, pid) : null,
    };
  }

  function broadcast(room) {
    room.lastActive = Date.now();
    for (const p of room.players) {
      if (p.connected && p.socketId) io.to(p.socketId).emit('state', viewFor(room, p.id));
    }
  }

  /* ───────── 방/플레이어 ───────── */
  function destroyRoom(room) {
    if (room.phase === 'game') implOf(room).dispose(room);
    room.players.forEach((p) => clearTimeout(p.dropTimer));
    rooms.delete(room.code);
  }

  function fixHost(room) {
    const next = room.players.find((p) => p.connected) || room.players[0];
    room.hostId = next ? next.id : null;
  }

  function removePlayer(room, player) {
    clearTimeout(player.dropTimer);
    const wasGamer = room.phase === 'game' && player.inGame && !isFinished(room);
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) return destroyRoom(room);
    if (room.hostId === player.id) fixHost(room);
    if (wasGamer) {
      const impl = implOf(room);
      if (impl.onLeave) impl.onLeave(room, player);   // 게임별 처리 (스파이가 나가면 종료 등)
    }
    broadcast(room);
  }

  function dropPlayer(room, player) {
    if (!rooms.has(room.code) || player.connected) return;
    if (room.phase === 'game' && player.inGame && !isFinished(room)) {
      // 진행 중인 참가자는 자리를 유지하고, 게임이 필요하면 후속 처리만 한다 (예: 차례 넘기기)
      const impl = implOf(room);
      if (impl.onDrop) impl.onDrop(room, player);
      broadcast(room);
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
      score: 0,
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
    socket.data.hub = { code: room.code, pid: player.id };
    socket.join(`room:${room.code}`);
    socket.emit('chatlog', room.chat);
    broadcast(room);
  }

  function ctxOf(socket) {
    const d = socket.data.hub;
    if (!d) return null;
    const room = rooms.get(d.code);
    if (!room) return null;
    const player = room.players.find((p) => p.id === d.pid);
    return player ? { room, player } : null;
  }

  /* ───────── 소켓 이벤트 ───────── */
  io.on('connection', (socket) => {
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});

    socket.on('create', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      const code = makeCode(rooms);
      const room = {
        code, phase: 'lobby', gameId: PLUGINS[0].id, gameNo: 0, hostId: null,
        players: [], chat: [], g: null, lastActive: Date.now(),
      };
      const player = newPlayer(room, name);
      room.players.push(player);
      room.hostId = player.id;
      rooms.set(code, room);
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    // 게임 도중에도 입장 가능 (관전자로 시작)
    socket.on('join', (data, cb) => {
      cb = reply(cb);
      const name = cleanName(data && data.name);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      if (!room) return cb({ ok: false, error: '존재하지 않는 방 코드예요.' });
      if (room.players.length >= CFG.MAX_ROOM) return cb({ ok: false, error: `방이 가득 찼어요. (최대 ${CFG.MAX_ROOM}명)` });
      if (room.players.some((p) => p.name === name)) return cb({ ok: false, error: '같은 방에 이미 있는 닉네임이에요. 다른 이름을 써 주세요.' });
      const player = newPlayer(room, name);
      room.players.push(player);
      attach(socket, room, player);
      pushChatSys(room, `${name}님이 입장했어요.`);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('rejoin', (data, cb) => {
      cb = reply(cb);
      const code = String((data && data.room) || '').toUpperCase().trim();
      const room = rooms.get(code);
      const player = room && room.players.find((p) => p.token === (data && data.token));
      if (!room || !player) return cb({ ok: false, error: '방을 찾을 수 없거나 세션이 만료되었어요.' });
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        if (old) {
          old.data.hub = null;
          old.emit('kicked');
        }
      }
      attach(socket, room, player);
      cb({ ok: true, room: code, token: player.token });
    });

    socket.on('rename', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const name = cleanName(data && data.name);
      if (!name) return cb({ ok: false, error: '닉네임을 입력해 주세요.' });
      if (c.room.players.some((p) => p.id !== c.player.id && p.name === name)) return cb({ ok: false, error: '이미 쓰고 있는 닉네임이에요.' });
      const old = c.player.name;
      c.player.name = name;
      if (old !== name) pushChatSys(c.room, `${old}님이 닉네임을 ${name}(으)로 바꿨어요.`);
      cb({ ok: true });
      broadcast(c.room);
    });

    // 준비 토글 (진행 중에는 '다음 판 참가' 의미)
    socket.on('ready', () => {
      const c = ctxOf(socket);
      if (!c) return;
      c.player.ready = !c.player.ready;
      broadcast(c.room);
    });

    // 대기실에서 게임 고르기
    socket.on('select', (data, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'lobby') return cb({ ok: false, error: '‘게임 바꾸기’로 대기실에 돌아온 뒤 고를 수 있어요.' });
      if (CFG.HOST_ONLY_SWITCH && player.id !== room.hostId) return cb({ ok: false, error: '방장만 게임을 바꿀 수 있어요.' });
      const def = PLUGINS.find((p) => p.id === (data && data.game));
      if (!def) return cb({ ok: false, error: '없는 게임이에요.' });
      if (def.id !== room.gameId) {
        room.gameId = def.id;
        room.players.forEach((p) => { p.ready = false; });   // 게임이 바뀌면 준비를 다시 받아요
        pushChatSys(room, `${player.name}님이 게임을 ‘${def.name}’(으)로 바꿨어요.`);
      }
      cb({ ok: true });
      broadcast(room);
    });

    // 시작 (대기실, 또는 게임이 끝난 뒤 같은 게임 다시 하기): 준비한 사람이 인원 조건을 채우면 준비한 누구든 시작
    socket.on('start', (_d, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase === 'game' && !isFinished(room)) return cb({ ok: false, error: '이미 게임이 진행 중이에요.' });
      if (!player.ready) return cb({ ok: false, error: '먼저 ‘준비’를 눌러 주세요.' });
      const def = defOf(room);
      const gamers = room.players.filter((p) => p.ready && p.connected);
      if (gamers.length < def.min) return cb({ ok: false, error: `최소 ${def.min}명이 준비해야 해요. (${def.name} · 현재 ${gamers.length}명)` });
      if (gamers.length > def.max) return cb({ ok: false, error: `최대 ${def.max}명까지예요. 준비한 인원이 ${gamers.length}명이라 일부가 준비를 취소해야 해요. (${def.name})` });
      if (room.phase === 'game') implOf(room).dispose(room);
      room.phase = 'game';
      room.gameNo += 1;
      room.players.forEach((p) => { p.inGame = gamers.includes(p); });
      implOf(room).start(room, gamers);
      cb({ ok: true });
      broadcast(room);
    });

    // 게임 바꾸기: 대기실로 돌아가요 (진행 중이어도 가능, 화면에서 한 번 확인해요)
    socket.on('lobby', (_d, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (CFG.HOST_ONLY_SWITCH && player.id !== room.hostId) return cb({ ok: false, error: '방장만 게임을 바꿀 수 있어요.' });
      if (room.phase === 'game') {
        implOf(room).dispose(room);
        room.phase = 'lobby';
        room.players.forEach((p) => { p.inGame = false; p.ready = false; });
        pushChatSys(room, `${player.name}님이 게임을 바꾸려고 대기실로 돌아왔어요.`);
      }
      cb({ ok: true });
      broadcast(room);
    });

    // 게임별 동작: { type, ...데이터 } → 플러그인이 처리
    socket.on('act', (msg, cb) => {
      cb = reply(cb);
      const c = ctxOf(socket);
      if (!c) return cb({ ok: false, error: '방에 연결되어 있지 않아요.' });
      const { room, player } = c;
      if (room.phase !== 'game') return cb({ ok: false, error: '진행 중인 게임이 없어요.' });
      const res = implOf(room).action(room, player, msg || {}) || { ok: true };
      cb(res);
      if (res.ok) broadcast(room);
    });

    // 전체 채팅 (참가자·관전자 모두)
    socket.on('chat', (data) => {
      const c = ctxOf(socket);
      if (!c) return;
      const now = Date.now();
      if (now - c.player.lastChatAt < 300) return; // 도배 방지
      const text = cleanText(data && data.text, 200);
      if (!text) return;
      c.player.lastChatAt = now;
      const msg = {
        pid: c.player.id, name: c.player.name, avatar: c.player.avatar, color: c.player.color, text,
        spectator: c.room.phase === 'game' && !c.player.inGame, t: now,
      };
      c.room.chat.push(msg);
      if (c.room.chat.length > CFG.CHAT_KEEP) c.room.chat.shift();
      c.room.lastActive = now;
      io.to(`room:${c.room.code}`).emit('chat', msg);
    });

    socket.on('leave', () => {
      const c = ctxOf(socket);
      socket.data.hub = null;
      if (!c) return;
      socket.leave(`room:${c.room.code}`);
      pushChatSys(c.room, `${c.player.name}님이 나갔어요.`);
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
