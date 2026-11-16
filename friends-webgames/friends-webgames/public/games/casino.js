/**
 * 주사위 카지노 화면 (게임 플러그인, 코드 이름: casino)
 *  - 방/채팅/준비/게임 바꾸기는 index.html 허브가 맡아요. 여기서는 게임 화면만 그려요.
 *  - 굴린 주사위, 고를 수 있는 숫자, 정산 결과는 서버가 알려 줘요. 화면은 그대로 보여 주기만 해요.
 */
(() => {
  'use strict';
  window.GAME_UI = window.GAME_UI || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const CSS = `
  .cz { display: flex; flex-direction: column; gap: 12px; word-break: keep-all; overflow-wrap: break-word; }
  .cz .card h3 { margin-bottom: 8px; }
  .cz-head { padding-top: 11px; padding-bottom: 11px; }
  .cz-hrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .cz-head .t { font-size: 19px; font-weight: 900; }
  .cz-head .t small { font-family: var(--mono); font-size: 12px; color: var(--accent); margin-right: 8px; letter-spacing: .1em; }
  .cz-timer { font-family: var(--mono); font-size: 20px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
  .cz-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .cz-tag { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: var(--r); border: 1px solid var(--line2); color: var(--dim); }
  .cz-tag.hot { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  /* 방금 일어난 일 */
  .cz-last { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: var(--r-lg); border: 1.5px solid var(--tc, var(--line2)); background: linear-gradient(120deg, color-mix(in srgb, var(--tc, #94a3b8) 15%, var(--card-solid)), var(--card-solid) 70%); animation: czPop .45s ease-out; }
  .cz-last .ic { flex: 0 0 auto; width: 54px; height: 54px; border-radius: 14px; display: grid; place-items: center; font-size: 30px; background: color-mix(in srgb, var(--tc, #94a3b8) 20%, transparent); border: 1.5px solid var(--tc, var(--line2)); }
  .cz-last .lh { font-size: 13px; color: var(--dim); }
  .cz-last .lh .m { margin-right: 6px; font-family: var(--mono); font-size: 10.5px; border: 1px solid var(--line2); border-radius: 3px; padding: 0 5px; }
  .cz-last .ld { font-size: 17px; font-weight: 900; line-height: 1.35; margin-top: 2px; color: var(--tc, var(--ink)); }
  .cz-last.good { --tc: #34d399; } .cz-last.bad { --tc: #f43f5e; } .cz-last.info { --tc: #38bdf8; }
  @keyframes czPop { 0% { transform: scale(.96); opacity: .35; } 55% { transform: scale(1.015); } 100% { transform: none; opacity: 1; } }
  /* 주사위 */
  .cz-die { --dc: #94a3b8; display: inline-grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); width: var(--ds, 30px); height: var(--ds, 30px); padding: calc(var(--ds, 30px) * .14); border-radius: calc(var(--ds, 30px) * .24); background: var(--dc); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .22), 0 1px 2px rgba(0, 0, 0, .3); vertical-align: middle; }
  .cz-die i { border-radius: 50%; margin: 12%; background: transparent; }
  .cz-die i.on { background: var(--pip, #fff); }
  .cz-die.white { --dc: #f1f5f9; --pip: #1e293b; }
  .cz-die.s { --ds: 20px; } .cz-die.l { --ds: 40px; }
  /* 내 차례에는 굴린 주사위와 선택 버튼이 화면 아래에 붙어 있어서, 카지노 판을 보면서 고를 수 있어요 */
  .cz-roll.mine { position: sticky; bottom: calc(var(--dock, 92px) + 8px); z-index: 20; padding-top: 10px; padding-bottom: 12px; border-color: var(--accent); box-shadow: 0 -10px 26px rgba(0, 0, 0, .22); }
  .cz-roll .dice { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
  .cz-roll .dice.shake .cz-die { animation: czShake .55s ease-out; }
  @keyframes czShake { 0% { transform: translateY(-14px) rotate(-30deg); opacity: .3; } 60% { transform: translateY(2px) rotate(8deg); } 100% { transform: none; opacity: 1; } }
  .cz-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
  .cz-choice { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1.5px solid var(--line2); border-radius: var(--r-lg); background: var(--soft); text-align: left; cursor: pointer; }
  .cz-choice:hover, .cz-choice.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .cz-choice b { font-size: 14px; display: block; line-height: 1.25; }
  .cz-choice span { font-size: 11.5px; color: var(--dim); }
  .cz-choice[disabled] { cursor: default; opacity: .7; }
  .cz-rollbtn { margin-top: 12px; font-size: 18px; padding: 16px; animation: czPulse 1.3s ease-in-out infinite; }
  @keyframes czPulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); } 50% { box-shadow: 0 0 0 9px color-mix(in srgb, var(--accent) 0%, transparent); } }
  /* 모두의 마블처럼: 누군가 주사위를 굴리면 모두에게 큰 주사위가 굴러가는 장면이 나와요 */
  .cz-stage { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; background: rgba(5, 8, 15, .66); backdrop-filter: blur(2px); pointer-events: none; animation: czFade .2s ease-out; }
  .cz-stage[hidden] { display: none; }
  .cz-stage .box { width: min(92vw, 420px); background: var(--card-solid); border: 1.5px solid var(--accent); border-radius: 22px; padding: 18px 14px 16px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, .55); }
  .cz-stage .who { font-size: 20px; font-weight: 900; }
  .cz-stage .sub { color: var(--dim); font-size: 13.5px; margin-top: 3px; min-height: 1.4em; }
  .cz-stage .tray { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 16px 0 6px; min-height: 58px; }
  .cz-die.xl { --ds: 50px; }
  .cz-stage .tumbling .cz-die { animation: czTumble .45s linear infinite; }
  .cz-stage .land .cz-die { animation: czLand .5s cubic-bezier(.2, 1.4, .4, 1); }
  .cz-stage .tumbling .cz-die:nth-child(2n) { animation-duration: .38s; animation-direction: reverse; }
  .cz-stage .tumbling .cz-die:nth-child(3n) { animation-duration: .52s; }
  .cz-stage .res { font-size: 15px; font-weight: 800; margin-top: 8px; }
  @keyframes czFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes czTumble { 0% { transform: translateY(-18px) rotate(0deg) scale(.92); } 25% { transform: translateY(6px) rotate(110deg) scale(1.04); } 50% { transform: translateY(-12px) rotate(220deg) scale(.96); } 75% { transform: translateY(4px) rotate(300deg) scale(1.03); } 100% { transform: translateY(-18px) rotate(360deg) scale(.92); } }
  @keyframes czLand { 0% { transform: translateY(-46px) rotate(-40deg) scale(.7); opacity: .4; } 100% { transform: none; opacity: 1; } }
  /* 내 정보: 남은 주사위와 지금까지 번 돈만 보여요 */
  .cz-mine { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 10px; padding-bottom: 10px; }
  .cz-mine .m span { display: block; font-size: 12.5px; color: var(--dim); font-weight: 700; }
  .cz-mine .m b { font-family: var(--mono); font-size: 24px; font-weight: 700; }
  .cz-mine .m.money b { color: #34d399; }
  .cz-mine .m small { color: var(--dim); font-size: 12px; margin-left: 5px; }
  /* 순위: 라운드가 끝날 때만 보여요 (폰은 아래 ‘순위’ 탭, PC는 게임 화면 안의 칸) */
  .cz-rk { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }
  .cz-rr { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--soft); }
  .cz-rr.me { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .cz-rr .rk { width: 30px; text-align: center; font-size: 22px; font-weight: 900; font-family: var(--mono); }
  .cz-rr .who { flex: 1; min-width: 0; }
  .cz-rr .nm { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cz-rr .who small { display: block; color: var(--dim); font-size: 12px; margin-top: 1px; }
  .cz-rr .mn { text-align: right; font-family: var(--mono); font-size: 17px; font-weight: 700; color: #34d399; white-space: nowrap; }
  #czRankCol { display: none; min-width: 0; }
  #room[data-view="rank"] #czRankCol { display: block; }
  #room[data-view="rank"] .main, #room[data-view="rank"] .chatcol, #room[data-view="rank"] .guidecol, #room[data-view="rank"] .hubbar { display: none; }
  #room[data-view="rank"] .layout { padding-bottom: calc(var(--dock, 56px) + 12px); }
  .tabbar.four { grid-template-columns: repeat(4, 1fr); }
  .cz-rankcard { display: none; }
  @media (min-width: 900px) { #czRankCol { display: none !important; } .cz-rankcard { display: block; } }
  /* 카지노 판 */
  .cz-board { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (min-width: 640px) { .cz-board { grid-template-columns: repeat(3, 1fr); } }
  .cz-cas { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 9px 10px 10px; display: flex; flex-direction: column; gap: 7px; min-height: 150px; }
  .cz-cas.pick { border-color: var(--accent); box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 22%, transparent); }
  .cz-cas .top { display: flex; align-items: center; justify-content: space-between; }
  .cz-cas .top .tot { font-family: var(--mono); font-size: 11.5px; color: var(--dim); }
  .cz-notes { display: flex; flex-wrap: wrap; gap: 4px; }
  .cz-note { font-family: var(--mono); font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 5px; background: color-mix(in srgb, #34d399 16%, var(--card-solid)); border: 1px solid color-mix(in srgb, #34d399 55%, transparent); color: #34d399; }
  .cz-note.big { color: #f59e0b; border-color: color-mix(in srgb, #f59e0b 60%, transparent); background: color-mix(in srgb, #f59e0b 14%, var(--card-solid)); }
  .cz-rows { display: flex; flex-direction: column; gap: 5px; }
  .cz-prow { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .cz-prow .nm { font-size: 11px; font-weight: 800; width: 100%; opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cz-prow .cnt { font-family: var(--mono); font-size: 11px; color: var(--dim); margin-left: 2px; }
  .cz-prow.lead .nm::after { content: ' 👑'; }
  .cz-prow.tie .nm { text-decoration: line-through; opacity: .55; }
  .cz-empty { font-size: 12px; color: var(--dim); }
  /* 정산 */
  .cz-pay { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .cz-pc { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 8px 10px; }
  .cz-pc .ph { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; }
  .cz-pr { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13.5px; flex-wrap: wrap; }
  .cz-pr .who { font-weight: 800; flex: 1 1 100px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cz-pr .res { margin-left: auto; font-weight: 800; }
  .cz-pr .win { color: #34d399; } .cz-pr .lose { color: #f43f5e; } .cz-pr .none { color: var(--dim); font-weight: 500; }
  .cz-pr.x .who { text-decoration: line-through; opacity: .6; }
  /* 자리 */
  .cz-seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .cz-seat { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 10px 11px 10px 14px; display: flex; flex-direction: column; gap: 4px; }
  .cz-seat::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 2px; border-radius: 2px; background: var(--pc, var(--line2)); }
  .cz-seat.turn { border-color: var(--accent); box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 16%, transparent); }
  .cz-seat.left { opacity: .45; }
  .cz-seat .sn { font-weight: 800; font-size: 14px; }
  .cz-seat .sm { font-family: var(--mono); font-size: 15px; font-weight: 700; color: #34d399; }
  .cz-seat .sd { font-size: 12.5px; color: var(--dim); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .cz-log { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; }
  .cz-log div { padding-left: 8px; border-left: 2px solid var(--line2); color: var(--dim); }
  .cz-log div:first-child { color: var(--ink); border-left-color: var(--accent); font-weight: 700; }
  .cz-res h2 { margin-bottom: 6px; }
  `;
  try {
    if (document.head && document.head.appendChild && document.createElement) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* 스타일을 못 넣어도 동작은 해요 */ }

  const TEMPLATE = `<div class="cz" id="cz-root">
    <div class="card cz-head" id="cz-head"></div>
    <div id="cz-last"></div>
    <div class="card cz-mine" id="cz-mine"></div>
    <div class="cz-board" id="cz-board"></div>
    <div class="card cz-roll" id="cz-roll"></div>
    <div class="card" id="cz-pay"></div>
    <div class="card cz-rankcard" id="cz-rankcard"></div>
    <div class="card"><div class="eyebrow"><span>LOG</span><b>NEWEST FIRST</b></div><div class="cz-log" id="cz-log"></div></div>
    <div class="cz-stage" id="cz-stage" hidden><div class="box" id="cz-stagebox"></div></div>
  </div>`;

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  let ctx = null, cur = null, timer = null;
  let sigHead, sigLast, sigRoll, sigBoard, sigPay, sigMine, sigRank, sigLog;
  let stageSeq = 0, stageTimers = [], stageTick = null;

  const esc = (s) => ctx.esc(s);
  const fmtMoney = (v) => `$${Number(v).toLocaleString('en-US')}`;
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const seatById = (id) => cur.G.seats.find((s) => s.id === id);
  const col = (s) => (s ? `<span style="color:${esc(s.color)};font-weight:800">${esc(s.avatar)} ${esc(s.name)}</span>` : '<b>⚪ 흰색(가상의 사람)</b>');
  const die = (v, color, cls = '') => `<span class="cz-die ${cls}${color ? '' : ' white'}" style="${color ? `--dc:${esc(color)}` : ''}">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i${(PIPS[v] || []).includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const dice = (v, color, k, cls) => Array.from({ length: k }, () => die(v, color, cls)).join('');

  function renderHead() {
    const { S, G } = cur;
    const sig = JSON.stringify([G.round, G.phase, G.startId, G.turnId, G.white, G.seats.length, G.awaitRoll]);
    if (sig === sigHead) return;
    sigHead = sig;
    const start = seatById(G.startId);
    const tags = [`<span class="cz-tag">${G.seats.length}명</span>`, `<span class="cz-tag">돈 카드 ${fmtMoney(G.minPot)} 이상씩</span>`];
    if (start) tags.unshift(`<span class="cz-tag">🚩 시작 ${esc(start.name)}</span>`);
    if (G.white) tags.push('<span class="cz-tag hot">⚪ 흰색 주사위 포함</span>');
    const turn = seatById(G.turnId);
    const state = G.phase === 'play' && turn ? `👉 ${col(turn)}님 차례${G.awaitRoll ? ' · 주사위를 굴려요' : ''}` : G.phase === 'roundEnd' ? '💰 정산 중' : G.phase === 'ended' ? '🏆 게임 끝' : '';
    $('#cz-head').innerHTML = `<div class="cz-hrow"><div class="t"><small>ROUND ${Math.min(G.round, G.rounds)} / ${G.rounds}</small>${state}</div><span class="cz-timer" id="cz-timer"></span></div><div class="cz-tags">${tags.join('')}</div>`;
  }

  // 방금 일어난 일: 누가 몇 번 카지노에 몇 개를 놓았는지, 정산 결과를 크게 보여 줘요
  function renderLast() {
    const { G } = cur;
    const e = G.last;
    const sig = e ? e.seq : 'none';
    if (sig === sigLast) return;
    sigLast = sig;
    const el = $('#cz-last');
    if (!e) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="card cz-last ${esc(e.tone)}"><div class="ic">${esc(e.icon || '🎲')}</div><div>
      <div class="lh"><span class="m">#${e.seq}</span>방금 일어난 일</div>
      <div class="ld">${esc(e.headline)}</div>
      <div class="lh" style="margin-top:3px;font-size:14px;color:var(--ink)">${esc(e.detail)}</div></div></div>`;
  }

  /* ───── 주사위 굴리기 장면 (모두에게 보여요) ───── */
  function hideStage() {
    stageTimers.forEach((h) => clearTimeout(h)); stageTimers = [];
    clearInterval(stageTick); stageTick = null;
    const el = $('#cz-stage');
    if (el) el.hidden = true;
  }
  function startStage(G, S) {
    hideStage();
    const r = G.roll;
    const roller = seatById(r.seatId);
    const now = ctx.now();
    const untilStop = r.openAt - now;                 // 주사위가 멈출 때까지
    const untilHide = r.openAt + 900 - now;           // 결과를 잠깐 보여 준 뒤 사라져요
    if (untilHide <= 0) return;                       // 이미 지난 장면이면 건너뛰어요
    const mine = r.seatId === S.you;
    const count = r.dice.length;
    const sorted = r.dice.slice().sort((a, b) => a.v - b.v);
    const colorOf = (d) => (d.k === 'o' ? (roller ? roller.color : '#94a3b8') : null);
    const randFaces = () => Array.from({ length: count }, (_, i) => die(1 + Math.floor(Math.random() * 6), colorOf(sorted[i]), 'xl')).join('');
    const box = $('#cz-stagebox');
    box.innerHTML = `<div class="who">${mine ? '🎲 내 차례예요!' : `🎲 ${col(roller)}님 차례`}</div><div class="sub">${mine ? '주사위를 굴려요…' : '주사위를 굴리는 중…'}</div><div class="tray tumbling" id="cz-tray">${randFaces()}</div><div class="res" id="cz-sres"></div>`;
    $('#cz-stage').hidden = false;
    stageTick = setInterval(() => { const t = $('#cz-tray'); if (t) t.innerHTML = randFaces(); }, 90);
    stageTimers.push(setTimeout(() => {
      clearInterval(stageTick); stageTick = null;
      const t = $('#cz-tray');
      if (t) { t.className = 'tray land'; t.innerHTML = sorted.map((d) => die(d.v, colorOf(d), 'xl')).join(''); }
      const groups = {};
      sorted.forEach((d) => { groups[d.v] = (groups[d.v] || 0) + 1; });
      const sres = $('#cz-sres');
      if (sres) sres.innerHTML = Object.keys(groups).map((v) => `${v}이 ${groups[v]}개`).join(' · ');
      const sub = box.querySelector ? box.querySelector('.sub') : null;
      if (sub) sub.textContent = mine ? '굴러서 나온 눈이에요' : '나온 눈이에요';
    }, Math.max(0, untilStop - 250)));
    stageTimers.push(setTimeout(hideStage, untilHide));
  }

  /* ───── 내 정보: 남은 주사위와 지금까지 번 돈 ───── */
  function renderMine() {
    const { G } = cur;
    const me = G.me;
    const el = $('#cz-mine');
    if (!me) { el.hidden = true; return; }
    el.hidden = false;
    const sig = JSON.stringify([me.own, me.white, me.money, me.notes]);
    if (sig === sigMine) return;
    sigMine = sig;
    el.innerHTML = `<div class="m"><span>🎲 내 남은 주사위</span><b>${me.own + me.white}</b>개${me.white ? `<small>흰색 ${me.white} 포함</small>` : ''}</div><div class="m money"><span>💰 지금까지 번 돈</span><b>${fmtMoney(me.money)}</b></div>`;
  }

  /* ───── 순위: 라운드가 끝날 때만 갱신돼요 ───── */
  const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
  function rankHTML() {
    const { S, G } = cur;
    const rows = G.standings;
    if (!rows) return '<div class="eyebrow"><span>RANKING</span><b>AFTER ROUND 1</b></div><h3>🏁 순위</h3><div class="hint">1라운드가 끝나면 순위가 공개돼요. 순위는 라운드가 끝날 때만 새로 바뀌어요.</div>';
    return `<div class="eyebrow"><span>RANKING</span><b>ROUND ${G.standingsRound} / ${G.rounds}</b></div><h3>${G.phase === 'ended' ? '🏆 최종 순위' : `🏁 ${G.standingsRound}라운드 종료 순위`}</h3>
      <div class="cz-rk">${rows.map((r) => `<div class="cz-rr${r.id === S.you ? ' me' : ''}"><span class="rk">${MEDAL[r.rank] || r.rank}</span><div class="who"><div class="nm" style="color:${esc(r.color)}">${esc(r.avatar)} ${esc(r.name)}${r.id === S.you ? ' (나)' : ''}</div><small>이번 라운드 +${fmtMoney(r.gain)} · 카드 ${r.notes}장</small></div><span class="mn">${fmtMoney(r.money)}</span></div>`).join('')}</div>
      <div class="hint">순위는 라운드가 끝날 때만 바뀌어요.</div>`;
  }
  function renderRank() {
    const { G } = cur;
    const sig = JSON.stringify([G.standings, G.standingsRound, G.phase, cur.S.you]);
    if (sig === sigRank) return;
    sigRank = sig;
    const html = rankHTML();
    const card = $('#cz-rankcard'); if (card) card.innerHTML = html;      // PC: 게임 화면 안의 칸
    const panel = $('#cz-rank'); if (panel) panel.innerHTML = html;        // 폰: 아래 ‘순위’ 탭
  }
  // 아래 탭 줄에 ‘순위’ 탭을 달아요 (이 게임이 켜져 있는 동안만)
  function mountRankTab() {
    const bar = document.querySelector('#tabbar'), layout = document.querySelector('.layout');
    if (!bar || !layout || document.querySelector('[data-rank-tab]')) return;
    const btn = document.createElement('button');
    btn.setAttribute('data-rank-tab', '1'); btn.setAttribute('data-tab', 'rank');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>순위';
    btn.onclick = () => {
      const room = document.querySelector('#room'); if (!room) return;
      room.dataset.view = 'rank';
      document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'rank'));
      if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
    };
    bar.appendChild(btn); bar.classList.add('four');
    const col = document.createElement('section');
    col.id = 'czRankCol'; col.innerHTML = '<div class="card" id="cz-rank"></div>';
    layout.appendChild(col);
  }
  function unmountRankTab() {
    const room = document.querySelector('#room');
    const wasOpen = room && room.dataset && room.dataset.view === 'rank';
    const btn = document.querySelector('[data-rank-tab]'); if (btn && btn.remove) btn.remove();
    const col = document.querySelector('#czRankCol'); if (col && col.remove) col.remove();
    const bar = document.querySelector('#tabbar'); if (bar && bar.classList) bar.classList.remove('four');
    if (wasOpen) { const g = document.querySelector('[data-tab="game"]'); if (g && g.click) g.click(); }
  }

  // 내가 굴린 주사위와 고를 수 있는 숫자 (내 차례에는 화면 아래에 붙어 있어요)
  function renderRoll() {
    const { S, G } = cur;
    const el = $('#cz-roll');
    const me = G.me;
    const mineRoll = !!(G.phase === 'play' && G.roll && G.roll.seatId === S.you);
    const sig = JSON.stringify([G.phase, G.roll, me && me.choices, mineRoll, G.awaitRoll, me && me.canRoll, me && me.own + me.white]);
    if (sig === sigRoll) return;
    sigRoll = sig;
    if (el.classList && el.classList.toggle) el.classList.toggle('mine', !!(me && (me.myTurn || me.canRoll)));
    // 차례가 되면 주사위는 저절로 굴러가지 않고, 차례인 사람이 ‘굴리기’ 버튼을 눌러야 해요
    if (G.phase === 'play' && G.awaitRoll) {
      if (!(me && me.canRoll)) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = `<div class="eyebrow"><span>YOUR TURN</span><b>PRESS ROLL</b></div><b>🎲 내 차례예요! 굴리기 버튼을 눌러요</b><button class="btn primary big cz-rollbtn" id="cz-rollbtn">🎲 굴리기 (남은 주사위 ${me.own + me.white}개)</button><div class="hint" style="margin:8px 0 0">30초 안에 누르지 않으면 자동으로 굴러가요.</div>`;
      $('#cz-rollbtn').onclick = async () => { const r = await ctx.act('roll'); if (r && !r.ok) ctx.toast(r.error); };
      return;
    }
    if (!mineRoll) { el.hidden = true; return; }
    el.hidden = false;
    const roller = seatById(G.roll.seatId);
    const sorted = G.roll.dice.slice().sort((a, b) => a.v - b.v);
    const dieList = `<div class="dice">${sorted.map((d) => die(d.v, d.k === 'o' ? (roller ? roller.color : '#94a3b8') : null)).join('')}</div>`;
    if (!G.roll.open) { el.innerHTML = `<div class="eyebrow"><span>ROLL</span><b>ROLLING…</b></div><b>🎲 주사위가 굴러가는 중이에요…</b><div class="hint" style="margin:6px 0 0">멈추면 한 숫자를 골라요.</div>`; return; }
    if (!me.myTurn) { el.innerHTML = `<div class="eyebrow"><span>ROLL</span><b>AUTO</b></div><b>🎲 고를 눈이 하나뿐이라 곧 자동으로 놓아요</b>${dieList}`; return; }
    el.innerHTML = `<div class="eyebrow"><span>ROLL</span><b>YOUR TURN</b></div><b>🎲 한 숫자를 골라 그 눈을 전부 놓아요</b>${dieList}
      <div class="cz-choices">${me.choices.map((c) => `<button class="cz-choice" data-pick="${c.n}"><span style="flex:0 0 auto">${die(c.n, roller ? roller.color : '#94a3b8')}</span><div><b>${c.n}번 카지노에 ${c.total}개</b><span>${c.white ? `내 ${c.own}개 + 흰색 ${c.white}개` : `내 주사위 ${c.own}개`}</span></div></button>`).join('')}</div>`;
    $$('[data-pick]').forEach((b) => { b.onclick = async () => { const r = await ctx.act('place', { n: Number(b.dataset.pick) }); if (r && !r.ok) ctx.toast(r.error); }; });
  }

  function renderBoard() {
    const { S, G } = cur;
    const me = G.me;
    const pickable = me && me.myTurn ? me.choices.map((c) => c.n) : [];
    const sig = JSON.stringify([G.casinos, G.phase, pickable, G.seats.map((s) => s.color)]);
    if (sig === sigBoard) return;
    sigBoard = sig;
    $('#cz-board').innerHTML = G.casinos.map((c) => {
      const rows = c.dice.map((d) => ({ seat: seatById(d.id), count: d.count }));
      if (c.neutral > 0) rows.push({ seat: null, count: c.neutral });
      rows.sort((a, b) => b.count - a.count);
      const top = rows.length ? rows[0].count : 0;
      const counts = {};
      rows.forEach((r) => { counts[r.count] = (counts[r.count] || 0) + 1; });
      const notes = c.notes.map((v, i) => `<span class="cz-note${i === 0 ? ' big' : ''}">${fmtMoney(v)}</span>`).join('');
      const rowsHtml = rows.length ? rows.map((r) => `<div class="cz-prow${r.count === top && counts[top] === 1 ? ' lead' : ''}${counts[r.count] > 1 ? ' tie' : ''}"><span class="nm" style="color:${r.seat ? esc(r.seat.color) : 'var(--dim)'}">${r.seat ? esc(r.seat.name) : '⚪ 흰색'}</span>${dice(c.n, r.seat ? r.seat.color : null, Math.min(r.count, 12), 's')}<span class="cnt">×${r.count}</span></div>`).join('') : '<div class="cz-empty">아직 주사위가 없어요</div>';
      return `<div class="cz-cas${pickable.includes(c.n) ? ' pick' : ''}"><div class="top">${die(c.n, '#64748b', 'l')}<span class="tot">${fmtMoney(c.total)}</span></div><div class="cz-notes">${notes}</div><div class="cz-rows">${rowsHtml}</div></div>`;
    }).join('');
  }

  function renderPay() {
    const { S, G } = cur;
    const el = $('#cz-pay');
    const sig = JSON.stringify([G.phase, G.payout, G.result, G.nextReady, G.round]);
    if (sig === sigPay) return;
    sigPay = sig;
    if (!G.payout) { el.hidden = true; return; }
    el.hidden = false;
    const total = G.seats.filter((s) => !s.left).length;
    const ready = G.nextReady.includes(S.you);
    const cards = G.payout.map((c) => `<div class="cz-pc"><div class="ph">${die(c.n, '#64748b', 's')} ${c.n}번 카지노 <span style="margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--dim)">${c.notes.map(fmtMoney).join(' · ')}</span></div>
      ${c.rows.length ? c.rows.map((r) => { const s = r.who === 'N' ? null : seatById(r.who); return `<div class="cz-pr${r.cancelled ? ' x' : ''}"><span class="who">${col(s)}</span><span>${dice(c.n, s ? s.color : null, Math.min(r.count, 8), 's')} ×${r.count}</span><span class="res ${r.cancelled ? 'lose' : r.won ? 'win' : 'none'}">${r.cancelled ? '💥 상쇄' : r.won ? `${r.who === 'N' ? '(더미로) ' : ''}${fmtMoney(r.won)}` : '못 받았어요'}</span></div>`; }).join('') : '<div class="cz-pr"><span class="none">아무도 놓지 않았어요</span></div>'}
      ${c.leftover.length ? `<div class="hint" style="margin:6px 0 0">남은 돈 카드 ${c.leftover.map(fmtMoney).join(', ')}는 더미로 돌아가요</div>` : ''}</div>`).join('');
    let head;
    let foot = '';
    if (G.phase === 'ended') {
      const r = G.result;
      head = `<div class="cz-res"><div class="eyebrow"><span>FINAL</span><b>${r.abort ? 'ABORTED' : 'WINNER'}</b></div><h2>${r.abort ? '⚪ 게임 중단' : '🏆 우승!'}</h2><div>${esc(r.reason)}</div>
        <div style="margin-top:8px">${r.players.map((p, i) => `<div class="cz-pr"><span class="who">${i + 1}. ${esc(p.avatar)} ${esc(p.name)}${p.win ? ' 🏆' : ''}</span><span style="font-family:var(--mono)">${fmtMoney(p.money)} · 카드 ${p.notes}장</span>${p.gain ? '<span class="res win">+1점</span>' : ''}</div>`).join('')}</div>
        <p class="hint">아래는 마지막 라운드 정산이에요. 같은 게임을 다시 하거나, 방장이 게임을 바꿀 수 있어요.</p></div>`;
    } else {
      head = `<div class="eyebrow"><span>PAYOUT</span><b>ROUND ${G.round} / ${G.rounds}</b></div><h3>💰 ${G.round}라운드 정산</h3><div class="hint" style="margin:0">같은 개수를 놓은 사람끼리는 상쇄(💥)돼서 못 받아요.</div>`;
      foot = `<button class="btn primary big" id="cz-next" ${ready ? 'disabled' : ''} style="margin-top:12px">${ready ? `기다리는 중… (${G.nextReady.length}/${total})` : `다음 라운드로 (${G.nextReady.length}/${total}) · <span id="cz-nt"></span>`}</button>`;
    }
    el.innerHTML = `${head}<div class="cz-pay">${cards}</div>${foot}`;
    const nb = $('#cz-next');
    if (nb) nb.onclick = async () => { const r = await ctx.act('next'); if (r && !r.ok) ctx.toast(r.error); };
  }

  function renderLog() {
    const { G } = cur;
    const sig = String(G.log.length) + (G.log.length ? G.log[G.log.length - 1].t : '');
    if (sig === sigLog) return;
    sigLog = sig;
    const el = $('#cz-log');
    el.innerHTML = G.log.slice(-40).reverse().map((l) => `<div>${esc(l.text)}</div>`).join('');   // 최신이 맨 위
    el.scrollTop = 0;
  }

  function tick() {
    if (!cur) return;
    const t = $('#cz-timer');
    if (t) t.textContent = cur.G.endsAt && cur.G.phase === 'play' ? fmt(cur.G.endsAt - ctx.now()) : '';
    const n = $('#cz-nt');
    if (n) n.textContent = cur.G.endsAt ? fmt(cur.G.endsAt - ctx.now()) : '';
  }

  window.GAME_UI.casino = {
    mount(c) {
      ctx = c;
      cur = null;
      sigHead = sigLast = sigRoll = sigBoard = sigPay = sigMine = sigRank = sigLog = '';
      stageSeq = 0;
      ctx.host().innerHTML = TEMPLATE;
      mountRankTab();
      clearInterval(timer);
      timer = setInterval(tick, 500);
    },
    update(S, G) {
      cur = { S, G };
      renderHead();
      renderLast();
      renderMine();
      renderBoard();
      renderRoll();
      renderPay();
      renderRank();
      renderLog();
      if (G.phase === 'play' && G.roll && G.roll.seq !== stageSeq) { stageSeq = G.roll.seq; startStage(G, S); }
      if (G.phase !== 'play') hideStage();
      tick();
    },
    unmount() {
      clearInterval(timer);
      timer = null;
      hideStage();
      unmountRankTab();
      cur = null;
      if (ctx) ctx.bar().innerHTML = '';
    },
  };
})();
