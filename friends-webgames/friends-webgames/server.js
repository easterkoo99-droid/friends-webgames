'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 20000,
  pingTimeout: 30000,
});

// 화면 파일 자동 연결: public/games/ 안의 .js 파일을 index.html 에 알아서 넣어 줘요.
// (새 게임은 games/이름.js 와 public/games/이름.js 두 파일만 추가하면 돼요. index.html 은 고치지 않아도 돼요)
function pageWithPlugins() {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  let files = [];
  try { files = fs.readdirSync(path.join(__dirname, 'public', 'games')).filter((f) => f.endsWith('.js')).sort(); } catch (e) { /* 폴더가 없으면 그냥 넘어가요 */ }
  const missing = files.filter((f) => !html.includes(`/games/${f}`));
  if (missing.length) {
    const tags = missing.map((f) => `<script src="/games/${f}"></script>`).join('\n') + '\n';
    const at = html.indexOf('<script>');            // 맨 처음 나오는 안쪽 스크립트 바로 앞에 넣어요
    html = at >= 0 ? html.slice(0, at) + tags + html.slice(at) : html.replace('</body>', tags + '</body>');
  }
  return html;
}
app.get(['/', '/index.html'], (_req, res) => {
  try { res.set('Cache-Control', 'no-cache').type('html').send(pageWithPlugins()); }
  catch (e) { res.sendFile(path.join(__dirname, 'public', 'index.html')); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

// 방/채팅/게임 선택은 hub.js, 게임별 규칙은 games/ 폴더의 플러그인이 맡아요 (방 상태는 서버 메모리에 보관)
require('./hub')(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[gameroom] listening on :${PORT}`);
});
