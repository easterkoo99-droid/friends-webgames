'use strict';
/**
 * 게임 목록 (자동으로 모아요)
 *  - games/ 폴더에 게임 파일(spyfall.js 처럼 id 와 create 가 있는 파일)을 넣으면 대기실에 게임 카드가 자동으로 나타나요.
 *  - public/games/ 폴더에 같은 이름의 화면 파일을 넣으면 서버가 알아서 화면에 연결해요. (index.html 을 고칠 필요가 없어요)
 *  - 목록 순서는 아래 ORDER 에 적힌 게임이 먼저고, 나머지는 파일 이름 순서예요.
 */
const fs = require('fs');
const path = require('path');

const ORDER = ['spyfall', 'village', 'letter', 'casino'];
const SKIP = new Set(['index.js', 'util.js']);

const plugins = [];
fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.js') && !SKIP.has(f))
  .sort()
  .forEach((f) => {
    try {
      const m = require(path.join(__dirname, f));
      if (m && m.id && typeof m.create === 'function') plugins.push(m);
      else console.warn(`[games] ${f}: 게임 파일이 아니라서 건너뛰었어요. (id 와 create 가 필요해요)`);
    } catch (e) {
      console.error(`[games] ${f}: 불러오지 못했어요 → ${e.message}`);
    }
  });

const rank = (p) => { const i = ORDER.indexOf(p.id); return i < 0 ? 999 : i; };
plugins.sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));

module.exports = plugins;
