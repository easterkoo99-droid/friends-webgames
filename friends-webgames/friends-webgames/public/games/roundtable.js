/**
 * 원탁 회의 화면 (게임 플러그인, 코드 이름: roundtable)
 *  - 방/채팅/준비/게임 바꾸기는 index.html 허브가 맡아요. 여기서는 게임 화면만 그려요.
 *  - 한 화면에 ‘원탁(사람들) + 지금 할 일(아래 고정 바)’만 크게 보여 주고, 토론과 기록은 탭으로 나눴어요.
 *  - 역할·투표·임무 카드는 공개되기 전까지 서버가 알려 주지 않아요. 화면은 서버가 준 내용을 그대로 보여 주기만 해요.
 */
(() => {
  'use strict';
  window.GAME_UI = window.GAME_UI || {};
  const VER = 5;   // 서버 파일(games/roundtable.js)의 VERSION 과 같아야 해요. 다르면 화면에 안내가 떠요
  const $ = (s) => document.querySelector(s);

  const CSS = `
  .rt { display: flex; flex-direction: column; gap: 10px; word-break: keep-all; overflow-wrap: break-word; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  .rt [hidden] { display: none; }
  .rt input { user-select: text; -webkit-user-select: text; }
  .rt-vbanner { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 10%, var(--card-solid)); }
  /* 맨 위: 원정 트랙 */
  .rt-top { padding: 10px 12px; }
  .rt-trow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .rt-trow .ph { font-size: 16px; font-weight: 900; }
  .rt-rej { font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .rt-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--line2); display: inline-block; }
  .rt-dot.on { background: #f43f5e; border-color: #f43f5e; }
  .rt-track { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .rt-q { border: 2px solid var(--line2); border-radius: 12px; padding: 5px 0 4px; text-align: center; background: var(--soft); line-height: 1.15; }
  .rt-q b { display: block; font-family: var(--mono); font-size: 19px; }
  .rt-q span { font-size: 10.5px; color: var(--dim); }
  .rt-q.cur { border-color: var(--accent); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent); }
  .rt-q.success { border-color: #34d399; background: color-mix(in srgb, #34d399 18%, var(--card-solid)); }
  .rt-q.success b { color: #34d399; }
  .rt-q.fail { border-color: #f43f5e; background: color-mix(in srgb, #f43f5e 18%, var(--card-solid)); }
  .rt-q.fail b { color: #f43f5e; }
  .rt-skip { padding: 8px 11px; border-radius: 12px; border: 1.5px solid var(--accent); background: var(--soft); color: inherit; font-family: inherit; font-weight: 800; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .rt-skip.on { background: color-mix(in srgb, var(--accent) 22%, var(--card-solid)); }
  .rt-rej2 { margin-top: 8px; font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  /* 내 역할 (항상 보여요) */
  .rt-me { border: 2px solid var(--rc, var(--line2)); border-radius: var(--r-lg); background: color-mix(in srgb, var(--rc, #94a3b8) 9%, var(--card-solid)); padding: 0; overflow: hidden; }
  .rt-me .mh { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 12px 4px; font-size: 14px; font-weight: 800; text-align: left; }
  .rt-me .mh { flex-wrap: wrap; }
  .rt-me .mh small { flex-basis: 100%; min-width: 0; }
  .rt-me .mh small { color: var(--dim); font-weight: 600; font-size: 12px; }
  .rt-me .mb { padding: 0 12px 9px; font-size: 12.5px; line-height: 1.5; color: var(--dim); }
  .rt-me .mb b { color: var(--ink); }
  .rt-me .lg { margin-top: 6px; color: var(--dim); font-size: 12.5px; }
  /* 원탁 */
  .rt-table { position: relative; height: 330px; border-radius: 28px; background: radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 12%, var(--card-solid)) 0%, var(--card-solid) 70%); border: 1px solid var(--line); }
  .rt-table::before { content: ''; position: absolute; left: 50%; top: 50%; width: 62%; height: 58%; transform: translate(-50%, -50%); border-radius: 50%; border: 2px dashed var(--line2); opacity: .7; pointer-events: none; }
  .rt-c { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 52%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; }
  .rt-c .big { font-size: 20px; font-weight: 900; line-height: 1.25; }
  .rt-c .sub { font-size: 12.5px; color: var(--dim); line-height: 1.35; }
  .rt-c .big.good { color: #34d399; } .rt-c .big.bad { color: #f43f5e; }
  .rt-c .pop { animation: rtPop .5s ease-out both; }
  @keyframes rtPop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.12); } 100% { transform: none; opacity: 1; } }
  .rt-s { position: absolute; transform: translate(-50%, -50%); width: 76px; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: default; }
  .rt-s.tap { cursor: pointer; }
  .rt-s .av { position: relative; width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; background: var(--soft); border: 3px solid var(--c, var(--line2)); box-shadow: 0 2px 8px rgba(0, 0, 0, .35); transition: transform .15s; }
  .rt-s.team .av { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 70%, transparent), 0 2px 8px rgba(0, 0, 0, .35); }
  .rt-s.sel .av { transform: scale(1.12); box-shadow: 0 0 0 4px var(--accent), 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent); }
  .rt-s.tap:active .av { transform: scale(.95); }
  .rt-s.left { opacity: .4; }
  .rt-s .nm { font-size: 12.5px; font-weight: 800; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rt-s.me .nm::after { content: ' (나)'; color: var(--accent); font-weight: 700; }
  .rt-s .st { font-size: 11px; color: var(--dim); min-height: 14px; line-height: 14px; white-space: nowrap; }
  .rt-s .bd { z-index: 3; position: absolute; font-style: normal; font-size: 15px; line-height: 1; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--card-solid); border: 1.5px solid var(--line2); }
  .rt-s .bd.l { top: -9px; right: -7px; } .rt-s .bd.t { top: -9px; left: -7px; } .rt-s .bd.k { bottom: -6px; right: -9px; }
  .rt-s .vt { position: absolute; inset: -3px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; animation: rtFlip .7s ease-out both; animation-delay: var(--d, 0s); backface-visibility: hidden; }
  .rt-s .vt.y { background: color-mix(in srgb, #34d399 92%, #000); } .rt-s .vt.n { background: color-mix(in srgb, #f43f5e 92%, #000); }
  @keyframes rtFlip { 0% { transform: rotateY(90deg) scale(.6); opacity: 0; } 100% { transform: none; opacity: 1; } }
  .rt-s .role { font-size: 11.5px; font-weight: 800; white-space: nowrap; }
  /* 원정 카드 공개 */
  .rt-cards { display: flex; gap: 8px; justify-content: center; perspective: 600px; }
  .rt-card { width: 38px; height: 54px; position: relative; transform-style: preserve-3d; animation: rtCard .7s ease-in-out both; animation-delay: var(--d, 0s); }
  .rt-card .f, .rt-card .b { position: absolute; inset: 0; border-radius: 8px; display: grid; place-items: center; font-size: 22px; font-weight: 900; backface-visibility: hidden; border: 2px solid rgba(255, 255, 255, .25); }
  .rt-card .b { background: linear-gradient(135deg, #f59e0b, #b45309); color: #fff; }
  .rt-card .f { transform: rotateY(180deg); }
  .rt-card .f.s { background: #059669; color: #fff; } .rt-card .f.x { background: #dc2626; color: #fff; }
  @keyframes rtCard { 0% { transform: rotateY(0) translateY(0); } 40% { transform: rotateY(0) translateY(-10px); } 100% { transform: rotateY(180deg) translateY(0); } }
  .rt-late { opacity: 0; animation: rtLate .5s ease-out forwards; animation-delay: var(--d, 1s); }
  @keyframes rtLate { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }
  .rt-table.n7, .rt-table.n8 { height: 390px; } .rt-table.n9, .rt-table.n10 { height: 440px; }
  .rt-table.n8 .rt-s .av, .rt-table.n9 .rt-s .av, .rt-table.n10 .rt-s .av { width: 44px; height: 44px; font-size: 23px; }
  .rt-table.n9 .rt-s, .rt-table.n10 .rt-s, .rt-table.n8 .rt-s { width: 66px; }
  .rt-table.n9 .rt-s .nm, .rt-table.n10 .rt-s .nm, .rt-table.n8 .rt-s .nm { max-width: 66px; font-size: 11.5px; }
  .rt-table.n9 .rt-s .st, .rt-table.n10 .rt-s .st, .rt-table.n8 .rt-s .st { font-size: 10px; }
  .rt-cards.many .rt-card { width: 30px; height: 44px; } .rt-cards.many { gap: 5px; }
  .rt-qhint { font-size: 11.5px; color: var(--dim); margin-top: 6px; text-align: center; }
  .rt-cap { text-align: center; font-size: 13px; color: var(--dim); min-height: 18px; margin-top: -2px; line-height: 1.4; padding: 0 6px; }
  /* 탭: 토론 / 기록 */
  .rt-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .rt-tab { padding: 9px; border-radius: 10px; border: 1.5px solid var(--line2); background: var(--soft); color: var(--dim); font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
  .rt-tab.on { border-color: var(--accent); color: var(--ink); background: color-mix(in srgb, var(--accent) 12%, var(--card-solid)); }
  .rt-feed { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; font-size: 14.5px; }
  .rt-empty { color: var(--dim); font-size: 13.5px; }
  .rt-input { display: flex; gap: 6px; margin-top: 10px; }
  .rt-input input { flex: 1; min-width: 0; }
  .rt-hist { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
  .rt-h { border: 1px solid var(--line); border-left: 4px solid var(--hc, var(--line2)); border-radius: 12px; padding: 8px 10px; background: var(--soft); }
  .rt-h.ok { --hc: #34d399; } .rt-h.no { --hc: #f43f5e; }
  .rt-h .hh { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 800; }
  .rt-h .hr { font-size: 12.5px; white-space: nowrap; }
  .rt-h .hl { font-size: 12.5px; color: var(--dim); margin-top: 3px; }
  .rt-hv { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .rt-hv span { display: inline-flex; flex-direction: column; align-items: center; font-size: 11px; gap: 1px; min-width: 40px; }
  .rt-hv span i { font-style: normal; font-size: 18px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--card-solid); border: 2px solid var(--line2); }
  .rt-hv span.y i { border-color: #34d399; } .rt-hv span.n i { border-color: #f43f5e; }
  .rt-hv span.in i { box-shadow: 0 0 0 2px var(--accent); }
  /* 아래 고정 바: 지금 할 일 */
  .rt-bar { position: sticky; bottom: calc(var(--dock, 92px) + 8px); z-index: 20; padding: 10px 12px 12px; border-color: var(--accent); box-shadow: 0 -10px 26px rgba(0, 0, 0, .25); }
  .rt-bt { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14.5px; font-weight: 800; line-height: 1.35; }
  .rt-tm { font-family: var(--mono); font-size: 20px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rt-tm.warn { color: #f43f5e; animation: rtBlink 1s steps(2, start) infinite; }
  @keyframes rtBlink { 50% { opacity: .35; } }
  .rt-bb { display: grid; gap: 8px; margin-top: 8px; grid-template-columns: 1fr 1fr; }
  .rt-bb.one { grid-template-columns: 1fr; }
  .rt-big { padding: 15px 8px; border-radius: 14px; border: 2px solid var(--line2); background: var(--soft); color: inherit; font-family: inherit; font-size: 17px; font-weight: 900; cursor: pointer; }
  .rt-big.yes { --oc: #34d399; } .rt-big.no { --oc: #f43f5e; } .rt-big.go { --oc: var(--accent); }
  .rt-big.on, .rt-big.go { border-color: var(--oc, var(--accent)); background: color-mix(in srgb, var(--oc, var(--accent)) 20%, var(--card-solid)); }
  .rt-big[disabled] { opacity: .45; cursor: default; }
  .rt-small { padding: 10px; border-radius: 12px; border: 1.5px solid var(--line2); background: var(--soft); color: inherit; font-family: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
  .rt-small.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--card-solid)); }
  .rt-gsum { font-size: 15px; margin-bottom: 6px; }
  .rt-gcard .gt, .gt { font-size: 13px; font-weight: 900; margin: 12px 0 6px; }
  .rt-rules { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: var(--dim); }
  .rt-rules b { color: var(--ink); }
  .rt-gr { border: 1.5px solid var(--rc, var(--line2)); border-radius: 12px; padding: 8px 10px; margin-bottom: 6px; background: color-mix(in srgb, var(--rc, #94a3b8) 8%, var(--card-solid)); }
  .rt-gr.off { opacity: .5; border-style: dashed; background: var(--soft); }
  .rt-gr.mine { box-shadow: 0 0 0 2px var(--accent); }
  .rt-gr .gh { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .rt-gr .gn { font-weight: 900; font-size: 14.5px; } .rt-gr .gn i { font-style: normal; color: var(--accent); font-size: 12px; }
  .rt-gr .gb { font-size: 11.5px; font-weight: 800; white-space: nowrap; } .rt-gr .gb.on { color: #34d399; } .rt-gr .gb.off { color: var(--dim); }
  .rt-gr .gd { font-size: 12.5px; line-height: 1.5; margin-top: 4px; }
  .rt-gr .ga { font-size: 11.5px; color: var(--dim); margin-top: 3px; }
  .rt-end h2 { margin-bottom: 4px; }
  .rt-end .rs { font-size: 13.5px; color: var(--dim); line-height: 1.5; }
  `;
  try {
    if (document.head && document.head.appendChild && document.createElement) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* 스타일을 못 넣어도 동작은 해요 */ }

  const TEMPLATE = `<div class="rt" id="rt-root">
    <div class="card rt-vbanner" id="rt-ver" hidden></div>
    <div class="card rt-top" id="rt-top"></div>
    <div class="rt-me" id="rt-me"></div>
    <div class="rt-table" id="rt-table"></div>
    <div class="rt-cap" id="rt-cap"></div>
    <div class="card" id="rt-end" hidden></div>
    <div class="rt-tabs" id="rt-tabs"></div>
    <div class="card" id="rt-hcard"><div class="rt-hist" id="rt-hist"></div></div>
    <div class="card" id="rt-gcard" hidden></div>
    <div class="card rt-bar" id="rt-bar"></div>
  </div>`;

  let ctx = null, cur = null, timer = null;
  let pick = [], pickKey = '', target = null, tab = 'hist';
  let sig = {};

  const esc = (s) => ctx.esc(s);
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const seatById = (id) => (cur ? cur.G.seats.find((s) => s.id === id) : null);
  const col = (s) => (s ? `<span style="color:${esc(s.color)};font-weight:800">${esc(s.avatar)} ${esc(s.name)}</span>` : '<b>?</b>');
  const PHASE = { team: '👑 팀 구성', talk: '💬 토론', vote: '🗳️ 투표', voteReveal: '🗳️ 투표 공개', mission: '⚔️ 원정', missionReveal: '⚔️ 원정 결과', assassin: '🗡️ 암살', ended: '🏆 끝' };
  const TCOLOR = { good: '#38bdf8', evil: '#f43f5e' };
  const changed = (k, v) => { const s = JSON.stringify(v); if (sig[k] === s) return false; sig[k] = s; return true; };

  const isLeader = () => !!(cur.G.me && cur.S && cur.G.leaderId === cur.S.you);
  const selectable = () => {
    const { G, S } = cur;
    if (!G.me) return false;
    if (G.phase === 'team' && isLeader()) return true;
    if (G.phase === 'assassin' && G.me.role === 'assassin') return true;
    return false;
  };
  const lastHist = () => { const h = cur.G.history; return h.length ? h[h.length - 1] : null; };

  /* ───── 위쪽: 원정 트랙 + 스킵 ───── */
  function renderTop() {
    const { G } = cur;
    const me = G.me;
    const live = G.seats.filter((s) => !s.left);
    const skipN = live.filter((s) => s.skip).length;
    if (!changed('top', [G.round, G.phase, G.rejects, G.quests, me && me.skip, skipN, G.skipNeed])) return;
    const q = G.quests.map((x, i) => `<div class="rt-q${x.result ? ` ${x.result}` : ''}${i + 1 === G.round && G.phase !== 'ended' && !x.result ? ' cur' : ''}"><span>${i + 1}번 원정</span><b>${x.result === 'success' ? '✔' : x.result === 'fail' ? '✖' : x.size}</b><span>${x.result === 'fail' ? `실패 ${x.fails}장` : x.result === 'success' ? (x.fails ? `성공(실패${x.fails})` : '성공') : `${x.size}명${x.need > 1 ? ' ⚠️2' : ''}`}</span></div>`).join('');
    const hint = G.quests.some((x) => x.need > 1) ? ' · ⚠️2 = 이 원정은 실패 카드 2장이어야 실패' : '';
    const dots = Array.from({ length: G.maxReject }, (_, i) => `<span class="rt-dot${i < G.rejects ? ' on' : ''}"></span>`).join('');
    const skipBtn = me && (G.phase === 'team' || G.phase === 'talk') ? `<button class="rt-skip${me.skip ? ' on' : ''}" type="button" data-act="skip">⏭️ ${G.phase === 'team' ? '팀 자동 구성' : '투표로 넘어가기'} ${skipN}/${G.skipNeed}${me.skip ? ' ✓' : ''}</button>` : '';
    $('#rt-top').innerHTML = `<div class="rt-trow"><span class="ph">${PHASE[G.phase] || ''}${G.phase === 'vote' ? ' <span class="rt-tm rt-vtm" style="font-size:15px;margin-left:6px"></span>' : ''}</span>${skipBtn}</div><div class="rt-track">${q}</div><div class="rt-rej2">연속 부결 ${dots}<span>(${G.maxReject}번이면 악 승리)${hint}</span></div>`;
  }

  /* ───── 내 역할 (항상 보여요) ───── */
  function renderMe() {
    const { G } = cur;
    const me = G.me;
    if (!changed('me', [me && [me.role, me.peek], G.roles && me && G.roles[me.role]])) return;
    const el = $('#rt-me');
    if (!me) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const R = G.roles[me.role];
    el.style.setProperty('--rc', TCOLOR[me.team]);
    let legend = '';
    if (me.peek && me.peek.ids.length) legend = `<div class="lg">원탁의 ${me.role === 'percival' ? '❓' : '😈'} = <b>${esc(me.peek.label)}</b></div>`;
    el.innerHTML = `<div class="mh"><span>${R.emoji} 나는 <b>${esc(R.name)}</b> · ${me.team === 'good' ? '선(기사단)' : '악(밀정)'}</span><small>${esc(R.brief)}</small></div><div class="mb">${esc(R.desc)}${legend}</div>`;
  }

  /* ───── 원탁 ───── */
  function seatPos(i, meIdx, n) {
    const r = ((i - meIdx) % n + n) % n;
    const a = (Math.PI / 2) + r * (2 * Math.PI / n);
    return { x: 50 + 39 * Math.cos(a), y: 50 + 37 * Math.sin(a) };
  }

  function centerHtml() {
    const { G } = cur;
    const leader = seatById(G.leaderId);
    const live = G.seats.filter((s) => !s.left);
    const h = lastHist();
    if (G.phase === 'team') {
      return `<div class="big">👑 ${esc(leader ? leader.name : '?')}</div><div class="sub">${isLeader() ? `팀원 ${G.size}명을 탭해서 고르세요<br><b>${pick.length}/${G.size}</b> 선택됨` : `${G.size}명의 원정대를 고르는 중`}</div>`;
    }
    if (G.phase === 'talk') return `<div class="big">💬 토론</div><div class="sub">⚔️ 표시된 사람이 원정대예요<br>아래 <b>채팅</b> 탭에서 이야기해요<br>스킵 ${live.filter((s) => s.skip).length}/${G.skipNeed}</div>`;
    if (G.phase === 'vote') return `<div class="big">🗳️ 이 팀 OK?</div><div class="sub">투표 ${live.filter((s) => s.voted).length}/${live.length}<br>⏱ <b class="rt-vtm"></b></div>`;
    if (G.phase === 'voteReveal' && h) {
      const step = live.length > 6 ? 0.3 : 0.45;
      const d = live.length * step + 0.4;
      return `<div class="big rt-late ${h.approved ? 'good' : 'bad'}" style="--d:${d}s">${h.approved ? '✅ 승인!' : '❌ 부결!'}</div><div class="sub rt-late" style="--d:${d + 0.2}s">찬성 ${h.yes} : 반대 ${h.no}${h.approved ? '<br>원정 출발!' : `<br>연속 부결 ${G.rejects}/${G.maxReject}`}</div>`;
    }
    if (G.phase === 'mission') return `<div class="big">⚔️ 원정 중</div><div class="sub">원정대가 비밀 카드를 내는 중<br>제출 ${G.team.filter((id) => { const s = seatById(id); return s && s.carded; }).length}/${G.team.length}</div>`;
    if (G.phase === 'missionReveal' && G.reveal) {
      const n = G.reveal.cards.length;
      const stp = n > 3 ? 0.7 : 0.9;
      const cards = G.reveal.cards.map((c, i) => `<div class="rt-card" style="--d:${0.4 + i * stp}s"><div class="b">?</div><div class="f ${c === 'fail' ? 'x' : 's'}">${c === 'fail' ? '✖' : '✔'}</div></div>`).join('');
      const d = 0.4 + n * stp + 0.5;
      const R = G.reveal;
      const txt = !R.ok ? `💥 실패 ${R.fails}장` : R.fails ? `🌟 성공!` : '🌟 성공!';
      const sub = R.ok && R.fails ? `<div class="sub rt-late" style="--d:${d + 0.2}s">실패 카드 ${R.fails}장이 나왔지만<br>이 원정은 ${R.need}장이 필요해요</div>` : '';
      return `<div class="rt-cards${n > 3 ? ' many' : ''}">${cards}</div><div class="big rt-late ${R.ok ? 'good' : 'bad'}" style="--d:${d}s">${txt}</div>${sub}`;
    }
    if (G.phase === 'assassin') return `<div class="big">🗡️ 암살 단계</div><div class="sub">선이 3번 성공!<br>암살자가 예언자를 노려요</div>`;
    if (G.phase === 'ended' && G.result) {
      if (G.result.abort) return '<div class="big">🛑 중단</div>';
      return `<div class="big pop ${G.result.winTeam === 'good' ? 'good' : 'bad'}">🏆 ${G.result.winTeam === 'good' ? '선 승리!' : '악 승리!'}</div>`;
    }
    return '';
  }

  function renderTable() {
    const { S, G } = cur;
    const h = lastHist();
    const showVotes = G.phase === 'voteReveal' && h;
    const peekIds = G.me && G.me.peek ? G.me.peek.ids : [];
    const state = [G.phase, G.round, G.rejects, G.leaderId, G.team, G.seats.map((s) => [s.id, s.voted, s.carded, s.skip, s.left]), showVotes ? h.votes : null, G.reveal, G.result, G.me && G.me.role, peekIds, pick, target, selectable()];
    if (!changed('table', state)) return;
    const el = $('#rt-table');
    const n = G.seats.length;
    el.className = `rt-table n${n}`;
    const meIdx = Math.max(0, G.seats.findIndex((s) => S && s.id === S.you));
    const tapOk = selectable();
    const roleOf = {};
    if (G.result) G.result.players.forEach((p) => { roleOf[p.id] = p; });
    const seats = G.seats.map((s, i) => {
      const pos = seatPos(i, meIdx, n);
      const isTeam = G.team.includes(s.id) && G.phase !== 'team' && G.phase !== 'ended';
      const sel = (G.phase === 'team' && pick.includes(s.id)) || (G.phase === 'assassin' && target === s.id);
      const canTap = tapOk && !(G.phase === 'assassin' && S && s.id === S.you);
      let st = '';
      if (G.phase === 'vote') st = s.voted ? '✅ 투표함' : '⏳';
      else if (G.phase === 'mission' && isTeam) st = s.carded ? '✅ 제출' : '⏳';
      else if ((G.phase === 'team' || G.phase === 'talk') && s.skip) st = '⏭️ 스킵';
      if (s.left) st = '나감';
      let bd = '';
      if (s.id === G.leaderId && G.phase !== 'ended') bd += '<i class="bd l">👑</i>';
      if (isTeam) bd += '<i class="bd t">⚔️</i>';
      if (peekIds.includes(s.id)) bd += `<i class="bd k">${G.me.role === 'percival' ? '❓' : '😈'}</i>`;
      let vt = '';
      if (showVotes && h.votes[s.id]) { const k = Object.keys(h.votes).indexOf(s.id); vt = `<div class="vt ${h.votes[s.id] === 'yes' ? 'y' : 'n'}" style="--d:${k * (n > 6 ? 0.3 : 0.45)}s">${h.votes[s.id] === 'yes' ? '👍' : '👎'}</div>`; }
      let role = '';
      if (G.phase === 'ended' && roleOf[s.id]) { const R = G.roles[roleOf[s.id].role]; role = `<div class="role" style="color:${TCOLOR[roleOf[s.id].team]}">${R.emoji} ${esc(R.name)}${G.result.assassinTarget === s.id ? ' 🗡️' : ''}</div>`; }
      return `<div class="rt-s${S && s.id === S.you ? ' me' : ''}${s.left ? ' left' : ''}${isTeam || (G.phase === 'team' && sel) ? ' team' : ''}${sel ? ' sel' : ''}${canTap ? ' tap' : ''}" data-act="seat" data-id="${esc(s.id)}" style="left:${pos.x.toFixed(1)}%;top:${pos.y.toFixed(1)}%"><div class="av" style="--c:${esc(s.color)}">${esc(s.avatar)}${bd}${vt}</div><div class="nm" style="color:${esc(s.color)}">${esc(s.name)}</div>${role || `<div class="st">${st}</div>`}</div>`;
    }).join('');
    el.innerHTML = `<div class="rt-c">${centerHtml()}</div>${seats}`;
  }

  function renderCap() {
    const { G } = cur;
    if (!changed('cap', [G.last && G.last.seq, G.phase])) return;
    const hide = G.phase === 'voteReveal' || G.phase === 'missionReveal';
    $('#rt-cap').textContent = hide || !G.last ? '' : G.last.text;
  }

  /* ───── 아래 고정 바: 꼭 눌러야 할 때만 나와요 ───── */
  function barHtml() {
    const { S, G } = cur;
    const me = G.me;
    const leader = seatById(G.leaderId);
    if (!me) return '';
    if (G.phase === 'team' && isLeader()) return `<div class="rt-bt"><span>👑 내가 대장! 원탁에서 ${G.size}명을 탭하세요</span></div><div class="rt-bb one"><button class="rt-big go" type="button" data-act="go" ${pick.length === G.size ? '' : 'disabled'}>이 팀으로 확정 (${pick.length}/${G.size})</button></div>`;
    if (G.phase === 'vote') return `<div class="rt-bt"><span>👑 ${esc(leader ? leader.name : '?')}님의 팀, 승인할까요?</span><span class="rt-tm rt-vtm"></span></div><div class="rt-bb"><button class="rt-big yes${me.vote === 'yes' ? ' on' : ''}" type="button" data-act="vote" data-v="yes">👍 찬성</button><button class="rt-big no${me.vote === 'no' ? ' on' : ''}" type="button" data-act="vote" data-v="no">👎 반대</button></div>`;
    if (G.phase === 'mission' && me.onTeam) return `<div class="rt-bt"><span>⚔️ 비밀 카드를 내세요 ${me.card ? '(바꿀 수 있어요)' : ''}</span></div><div class="rt-bb"><button class="rt-big yes${me.card === 'success' ? ' on' : ''}" type="button" data-act="card" data-v="success">🌟 성공</button>${me.team === 'evil' ? `<button class="rt-big no${me.card === 'fail' ? ' on' : ''}" type="button" data-act="card" data-v="fail">💥 실패</button>` : '<button class="rt-big no" type="button" disabled>💥 실패<br><small>악만 가능</small></button>'}</div>`;
    if (G.phase === 'assassin' && me.role === 'assassin') {
      const t = target ? seatById(target) : null;
      return `<div class="rt-bt"><span>🗡️ 예언자를 찾아 탭하세요</span></div><div class="rt-bb one"><button class="rt-big go" type="button" data-act="kill" ${t ? '' : 'disabled'}>${t ? `🗡️ ${esc(t.name)}님을 지목 (확정)` : '원탁에서 한 명을 탭하세요'}</button></div>`;
    }
    return '';
  }

  function renderBar() {
    const { G } = cur;
    const me = G.me;
    const el = $('#rt-bar');
    if (!changed('bar', [G.phase, G.round, G.rejects, G.leaderId, G.size, G.team, me && [me.vote, me.card, me.onTeam, me.role], pick, target])) return;
    const html = G.phase === 'ended' ? '' : barHtml();
    el.hidden = !html;
    el.innerHTML = html;
  }

  /* ───── 끝났을 때 ───── */
  function renderEnd() {
    const { S, G } = cur;
    const R = G.result;
    if (!changed('end', [R, S && S.you])) return;
    const el = $('#rt-end');
    if (!R) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const mine = R.players.find((p) => S && p.id === S.you);
    const head = R.abort ? '게임 중단' : mine ? (mine.win ? '🎉 우리 편이 이겼어요!' : '😵 아쉽게 졌어요') : (R.winTeam === 'good' ? '선 승리' : '악 승리');
    el.innerHTML = `<div class="rt-end"><h2>${head}${mine && mine.gain ? ` <small style="color:#34d399">+${mine.gain}점</small>` : ''}</h2><div class="rs">${esc(R.why)}<br>위 원탁에서 모두의 역할을 확인하세요.</div></div>`;
  }

  /* ───── 기록 / 규칙·직업 탭 ───── */
  function renderTabs() {
    const { G } = cur;
    if (!changed('tabs', [tab, G.history.length])) return;
    $('#rt-tabs').innerHTML = `<button class="rt-tab${tab === 'hist' ? ' on' : ''}" type="button" data-act="tab" data-tab="hist">📜 기록 (${G.history.length})</button><button class="rt-tab${tab === 'guide' ? ' on' : ''}" type="button" data-act="tab" data-tab="guide">📖 규칙 · 직업</button>`;
    $('#rt-hcard').hidden = tab !== 'hist';
    $('#rt-gcard').hidden = tab !== 'guide';
  }

  const ROLE_ORDER = ['merlin', 'percival', 'servant', 'morgana', 'assassin', 'mordred', 'oberon', 'minion'];
  const APPEAR = { merlin: '항상', percival: '항상', servant: '항상 (인원이 늘면 장수가 늘어요)', morgana: '항상', assassin: '항상', mordred: '9명 · 10명일 때', oberon: '7명 · 10명일 때', minion: '8명일 때' };

  function renderGuide() {
    const { S, G } = cur;
    if (!changed('guide', [G.roleCounts, G.seats.length, G.me && G.me.role, tab])) return;
    const n = G.seats.length;
    const cnt = G.roleCounts || {};
    const good = ROLE_ORDER.filter((k) => G.roles[k].team === 'good').reduce((a, k) => a + (cnt[k] || 0), 0);
    const evil = n - good;
    const row = (k) => {
      const r = G.roles[k];
      const c = cnt[k] || 0;
      const on = c > 0;
      const mine = G.me && G.me.role === k;
      return `<div class="rt-gr${on ? '' : ' off'}${mine ? ' mine' : ''}" style="--rc:${TCOLOR[r.team]}"><div class="gh"><span class="gn">${r.emoji} ${esc(r.name)}${mine ? ' <i>(나)</i>' : ''}</span><span class="gb ${on ? 'on' : 'off'}">${on ? `✅ 이번 판 등장${c > 1 ? ` ×${c}` : ''}` : '⛔ 이번 판 없음'}</span></div><div class="gd">${esc(r.desc)}</div><div class="ga">등장: ${APPEAR[k]}</div></div>`;
    };
    const part = (team, title) => `<div class="gt" style="color:${TCOLOR[team]}">${title}</div>${ROLE_ORDER.filter((k) => G.roles[k].team === team).sort((a, b) => ((cnt[b] || 0) > 0) - ((cnt[a] || 0) > 0)).map(row).join('')}`;
    $('#rt-gcard').innerHTML = `<div class="rt-gsum">이번 판 <b>${n}명</b> · 선 <b style="color:${TCOLOR.good}">${good}</b> : 악 <b style="color:${TCOLOR.evil}">${evil}</b></div>
      <div class="gt">📜 규칙 요약</div>
      <ul class="rt-rules"><li>원정 5번 중 먼저 <b>3번 성공</b>하면 선, <b>3번 실패</b>하면 악이 이겨요.</li><li><b>대장</b>이 돌아가며 팀을 고르고, 전원이 <b>공개 투표</b>로 승인해요. 찬성이 반대보다 많아야 승인(동수는 부결). 연속 <b>5번 부결</b>이면 악 승리.</li><li>승인된 팀원만 비밀 카드를 내요. 선은 성공만, 악은 성공/실패. <b>실패 카드가 나오면 실패</b>예요. (7명 이상은 4번 원정만 2장)</li><li>선이 3번 성공해도 <b>암살자가 예언자를 맞히면</b> 악의 역전승!</li><li><b>투표는 5분 제한</b>, 안 고른 사람은 찬성 처리돼요. 이야기는 아래 <b>💬 채팅</b> 탭에서 해요.</li></ul>
      ${part('good', '🛡️ 선(기사단)')}${part('evil', '🗡️ 악(밀정)')}`;
  }

  function renderHist() {
    const { G } = cur;
    if (!changed('hist', [G.history, tab])) return;
    const el = $('#rt-hist');
    el.innerHTML = G.history.length ? G.history.slice().reverse().map((h) => {
      const votes = G.seats.map((s) => { const v = h.votes[s.id]; return `<span class="${v === 'yes' ? 'y' : 'n'}${h.team.includes(s.id) ? ' in' : ''}"><i>${v === 'yes' ? '👍' : '👎'}</i>${esc(s.name)}</span>`; }).join('');
      const res = h.approved ? (h.pending ? '⏳ 공개 대기' : h.fails === null ? '진행 중' : h.ok === 'fail' ? `💥 실패 ${h.fails}장` : h.fails ? `🌟 성공 (실패 ${h.fails}장)` : '🌟 성공') : '부결';
      return `<div class="rt-h ${h.approved ? 'ok' : 'no'}"><div class="hh"><span>${h.round}번 원정 · ${h.attempt}번째 제안</span><span class="hr">${h.approved ? '✅ 승인' : '❌ 부결'} ${h.yes}:${h.no}${h.approved ? ` → ${res}` : ''}</span></div><div class="hl">👑 ${col(seatById(h.leader))} · ⚔️ ${h.team.map((id) => col(seatById(id))).join(' ')}</div><div class="rt-hv">${votes}</div></div>`;
    }).join('') : '<div class="rt-empty">아직 기록이 없어요. 투표가 끝나면 누가 어디에 투표했는지 여기 남아요.</div>';
  }

  function renderVer() {
    const { G } = cur;
    const el = $('#rt-ver');
    if (!el) return;
    const bad = G.ver !== VER;
    if (!changed('ver', bad ? G.ver : 0)) return;
    el.hidden = !bad;
    if (!bad) { el.innerHTML = ''; return; }
    el.innerHTML = `<b>⚠️ 화면 파일과 서버 파일의 버전이 달라요</b><div style="font-size:13px;color:var(--dim);margin:6px 0 10px">${G.ver > VER ? '이 폰의 게임 화면이 예전 버전이에요. 아래 버튼으로 새로고침해 주세요.' : '서버 파일(games/roundtable.js)이 예전 버전이에요. 올렸는지 확인하고, 올렸다면 잠시 뒤 새로고침해 주세요.'}</div><button class="btn primary" id="rt-reload" type="button">🔄 새로고침</button>`;
    const b = $('#rt-reload');
    if (b) b.addEventListener('click', () => location.reload());
  }

  function renderAll() {
    renderVer(); renderTop(); renderMe(); renderTable(); renderCap(); renderBar(); renderEnd(); renderTabs(); renderHist(); renderGuide(); tick();
  }

  /* ───── 입력 처리 (눌림은 한곳에서 받아요) ───── */
  function onClick(e) {
    if (!cur) return;
    const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    const { G, S } = cur;
    const act = t.getAttribute('data-act');
    if (act === 'tab') { tab = t.getAttribute('data-tab'); renderAll(); }
    else if (act === 'seat') {
      if (!selectable()) return;
      const id = t.getAttribute('data-id');
      if (G.phase === 'team') pick = pick.includes(id) ? pick.filter((x) => x !== id) : (pick.length < G.size ? pick.concat(id) : pick);
      else if (G.phase === 'assassin') { if (S && id === S.you) return; target = target === id ? null : id; }
      renderAll();
    } else if (act === 'go') ctx.act('propose', { ids: pick });
    else if (act === 'skip') ctx.act('skip');
    else if (act === 'vote') ctx.act('vote', { v: t.getAttribute('data-v') });
    else if (act === 'card') ctx.act('card', { v: t.getAttribute('data-v') });
    else if (act === 'kill') { if (target) ctx.act('assassinate', { target }); }
  }

  function tick() {
    if (!cur) return;
    const { G } = cur;
    const left = G.endsAt && G.phase === 'vote' ? G.endsAt - ctx.now() : 0;
    document.querySelectorAll('.rt-vtm').forEach((t) => {
      t.textContent = G.phase === 'vote' && G.endsAt ? fmt(left) : '';
      if (t.classList && t.classList.toggle) t.classList.toggle('warn', left <= 30000);
    });
  }

  window.GAME_UI.roundtable = {
    mount(c) {
      ctx = c;
      cur = null;
      pick = []; pickKey = ''; target = null; tab = 'hist'; sig = {};
      ctx.host().innerHTML = TEMPLATE;
      const root = $('#rt-root');
      if (root) root.addEventListener('click', onClick);
      clearInterval(timer);
      timer = setInterval(tick, 500);
    },
    update(S, G) {
      cur = { S, G };
      const key = `${G.round}:${G.rejects}:${G.phase === 'team' ? 't' : ''}`;
      if (key !== pickKey) { pickKey = key; pick = []; target = null; }
      renderAll();
    },
    unmount() {
      clearInterval(timer);
      timer = null;
      cur = null;
    },
  };
})();
