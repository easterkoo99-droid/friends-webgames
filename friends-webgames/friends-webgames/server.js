'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 20000,
  pingTimeout: 30000,
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

// 게임별 소켓 이벤트 등록 (방 상태는 서버 메모리에 보관)
require('./games/spyfall')(io);
require('./games/quizparty')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[webgames] listening on :${PORT}`);
});
