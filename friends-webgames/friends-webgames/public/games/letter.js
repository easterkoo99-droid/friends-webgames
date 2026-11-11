/**
 * 밀서 대작전 화면 (게임 플러그인, 코드 이름: letter)
 *  - 방/채팅/준비/게임 바꾸기는 index.html 허브가 맡아요. 여기서는 게임 화면만 그려요.
 *  - 낼 수 있는 카드, 대상, 추측 가능 여부는 서버가 G.me.moves 로 알려 줘요. 화면은 그대로 보여 주기만 해요.
 */
(() => {
  'use strict';
  window.GAME_UI = window.GAME_UI || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const CSS = `
  .lt { display: flex; flex-direction: column; gap: 12px; }
  .lt .card h3 { margin-bottom: 8px; }
  .lt-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .lt-head .lt-stats { display: flex; gap: 8px; flex-wrap: wrap; }
  .lt-stat { font-family: var(--mono); font-size: 11px; letter-spacing: .08em; padding: 3px 8px; border: 1px solid var(--line2); border-radius: var(--r); color: var(--dim); }
  .lt-stat b { color: var(--accent); font-weight: 600; }
  .lt-turn { font-weight: 800; }
  .lt-timer { font-family: var(--mono); font-size: 22px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
  .lt-seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .lt-seat { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 10px 11px 10px 14px; display: flex; flex-direction: column; gap: 5px; }
  .lt-seat::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 2px; border-radius: 2px; background: var(--pc, var(--line2)); }
  .lt-seat.turn { border-color: var(--accent); box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 16%, transparent); }
  .lt-seat.out { opacity: .5; }
  .lt-seat.me { background: color-mix(in srgb, var(--accent) 6%, var(--card)); }
  .lt-sn { font-weight: 800; font-size: 14px; }
  .lt-hearts { font-size: 13px; letter-spacing: 1px; color: #f472b6; }
  .lt-hearts small { font-family: var(--mono); color: var(--dim); font-size: 10.5px; letter-spacing: .08em; margin-left: 4px; }
  .lt-badges { font-size: 12px; color: var(--dim); min-height: 1.2em; }
  .lt-disc { display: flex; flex-wrap: wrap; gap: 3px; }
  .lt-mini { font-size: 12px; border: 1px solid var(--line2); border-radius: 4px; padding: 0 5px; background: var(--soft); white-space: nowrap; }
  .lt-mini.first { border-color: color-mix(in srgb, #f472b6 50%, transparent); }
  .lt-log { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; }
  .lt-log div { padding-left: 8px; border-left: 2px solid var(--line2); color: var(--dim); }
  .lt-log div:first-child { color: var(--ink); border-left-color: var(--accent); font-weight: 700; }
  /* 방금 일어난 일: 카드를 내면 모두에게 크게 보여요 */
  .lt-last { position: relative; display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: var(--r-lg); border: 1.5px solid var(--tc, var(--line2)); background: linear-gradient(120deg, color-mix(in srgb, var(--tc, #94a3b8) 16%, var(--card-solid)), var(--card-solid) 70%); animation: ltPop .45s ease-out; }
  .lt-last .badge { flex: 0 0 auto; width: 62px; height: 62px; border-radius: 14px; display: grid; place-items: center; font-size: 34px; background: color-mix(in srgb, var(--cc, #94a3b8) 22%, transparent); border: 1.5px solid var(--cc, var(--line2)); position: relative; }
  .lt-last .badge i { position: absolute; right: -6px; top: -8px; font-style: normal; font-family: var(--mono); font-weight: 700; font-size: 12px; background: var(--cc, #94a3b8); color: #0b0d11; border-radius: 5px; padding: 0 5px; }
  .lt-last .lh { font-size: 13.5px; color: var(--dim); }
  .lt-last .lh b { color: var(--ink); }
  .lt-last .ld { font-size: 18px; font-weight: 900; line-height: 1.35; margin-top: 2px; color: var(--tc, var(--ink)); }
  .lt-last .lm { margin-right: 6px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .1em; color: var(--dim); border: 1px solid var(--line2); border-radius: 3px; padding: 0 5px; }
  .lt-last.kill { --tc: #f43f5e; } .lt-last.safe { --tc: #34d399; } .lt-last.info { --tc: #38bdf8; } .lt-last.swap { --tc: #fbbf24; }
  .lt-last.idle { --tc: var(--line2); }
  .lt-last.idle .ld { font-size: 15px; font-weight: 700; color: var(--dim); }
  @keyframes ltPop { 0% { transform: scale(.96); opacity: .35; } 55% { transform: scale(1.015); } 100% { transform: none; opacity: 1; } }
}
  .lt-hand { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .lt-hand.one { grid-template-columns: minmax(0, 220px); }
  .lt-card { position: relative; text-align: left; border: 1.5px solid var(--line2); background: linear-gradient(160deg, color-mix(in srgb, var(--cc) 20%, var(--card-solid)), var(--card-solid) 75%); border-radius: var(--r-lg); padding: 12px 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; min-height: 170px; }
  .lt-card .num { position: absolute; right: 10px; top: 8px; font-family: var(--mono); font-weight: 600; font-size: 22px; color: var(--cc); }
  .lt-card .em { font-size: 40px; line-height: 1.1; }
  .lt-card b { font-size: 16px; }
  .lt-card small { color: var(--dim); font-size: 12.5px; line-height: 1.4; }
  .lt-card.on { border-color: var(--cc); box-shadow: 0 0 22px color-mix(in srgb, var(--cc) 30%, transparent); transform: translateY(-3px); }
  .lt-card:disabled { opacity: .42; cursor: default; }
  .lt-card.static { cursor: default; }
  .lt-act { margin-top: 12px; }
  .lt-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .lt-chip { border: 1px solid var(--line2); background: var(--soft); border-radius: var(--r); padding: 7px 11px; font-weight: 700; cursor: pointer; }
  .lt-chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
  .lt-notes { display: flex; flex-direction: column; gap: 5px; font-size: 14px; }
  .lt-note { background: var(--soft); border-radius: var(--r); padding: 6px 9px; }
  .lt-reveal { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; }
  .lt-rrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 15px; flex-wrap: wrap; }
  .lt-rrow .g { margin-left: auto; font-weight: 800; color: var(--ok); }
  .lt-res h2 { margin-bottom: 6px; }
  `;
  try {
    if (document.head && document.head.appendChild && document.createElement) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* 스타일을 못 넣어도 동작은 해요 */ }

  const HUE = { 1: '#94a3b8', 2: '#38bdf8', 3: '#fb923c', 4: '#34d399', 5: '#a78bfa', 6: '#fbbf24', 7: '#f472b6', 8: '#f43f5e' };

  const TEMPLATE = `<div class="lt">
    <div class="card lt-head" id="lt-head"></div>
    <div id="lt-last"></div>
    <div id="lt-result"></div>
    <div class="card" id="lt-me"></div>
    <div class="lt-seats" id="lt-seats"></div>
    <div class="card"><div class="eyebrow"><span>LOG</span><b>NEWEST FIRST</b></div><div class="lt-log" id="lt-log"></div></div>
    <div class="card"><div class="eyebrow"><span>MY NOTES</span><b>PRIVATE</b></div><div class="lt-notes" id="lt-notes"></div></div>
  </div>`;

  let ctx = null, cur = null, timer = null;
  let selCard, selTarget, selGuess, sigHead, sigSeats, sigLog, sigMe, sigNotes, sigResult, sigLast;

  const esc = (s) => ctx.esc(s);
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const cardOf = (t) => cur.G.cards[t];
  const chip = (t) => `${cardOf(t).emoji}${t}`;
  const seatById = (id) => cur.G.seats.find((s) => s.id === id);
  const col = (s) => `<span style="color:${esc(s.color)};font-weight:800">${esc(s.avatar)} ${esc(s.name)}</span>`;

  function renderHead() {
    const { G } = cur;
    const turn = G.turnId ? seatById(G.turnId) : null;
    const sig = [G.phase, G.round, G.goal, G.deckCount, G.turnId, G.faceUp.join(',')].join('|');
    if (sig === sigHead) return;
    sigHead = sig;
    let state = '';
    if (G.phase === 'play' && turn) state = `👉 ${col(turn)}님 차례`;
    else if (G.phase === 'roundEnd') state = '🏁 라운드 종료';
    else if (G.phase === 'ended') state = '🎉 게임 종료';
    $('#lt-head').innerHTML = `<div><div class="lt-stats"><span class="lt-stat">ROUND <b>${G.round}</b></span><span class="lt-stat">목표 <b>❤ ${G.goal}</b></span><span class="lt-stat">덱 <b>${G.deckCount}</b>장</span>${G.faceUp.length ? `<span class="lt-stat">공개 <b>${G.faceUp.map(chip).join(' ')}</b></span>` : ''}</div><div class="lt-turn" style="margin-top:8px">${state}</div></div><div class="lt-timer" id="lt-timer"></div>`;
  }

  function renderSeats() {
    const { S, G } = cur;
    const sig = JSON.stringify([G.seats.map((s) => [s.id, s.alive, s.protected, s.tokens, s.left, s.discards, s.handCount]), G.turnId, G.goal]);
    if (sig === sigSeats) return;
    sigSeats = sig;
    $('#lt-seats').innerHTML = G.seats.map((s) => {
      const badges = [];
      if (s.left) badges.push('🚪 떠남'); else if (!s.alive) badges.push('💀 탈락'); else if (s.protected) badges.push('🛡️ 보호 중');
      return `<div class="lt-seat${s.id === G.turnId ? ' turn' : ''}${s.alive ? '' : ' out'}${s.id === S.you ? ' me' : ''}" style="--pc:${esc(s.color)}">
        <div class="lt-sn">${col(s)}${s.id === S.you ? ' <span class="hint">(나)</span>' : ''}</div>
        <div class="lt-hearts">${'❤'.repeat(s.tokens)}${'♡'.repeat(Math.max(0, G.goal - s.tokens))}<small>${s.tokens}/${G.goal}</small></div>
        <div class="lt-badges">${badges.join(' · ') || (s.alive ? '손패 1장' : '')}</div>
        <div class="lt-disc">${s.discards.map((t, i) => `<span class="lt-mini" title="${esc(cardOf(t).name)}">${chip(t)}</span>`).join('')}</div>
      </div>`;
    }).join('');
  }

  function renderLog() {
    const { G } = cur;
    const sig = String(G.log.length) + (G.log.length ? G.log[G.log.length - 1].t : '');
    if (sig === sigLog) return;
    sigLog = sig;
    const el = $('#lt-log');
    el.innerHTML = G.log.slice(-30).reverse().map((l) => `<div>${esc(l.text)}</div>`).join('');   // 최신 내역이 맨 위
    el.scrollTop = 0;
  }

  // 방금 일어난 일: 누가 어떤 카드로 무엇을 했는지, 결과가 어땠는지를 크게 보여 줘요
  function renderLast() {
    const { G } = cur;
    const e = G.last;
    const sig = e ? e.seq : 'none';
    if (sig === sigLast) return;
    sigLast = sig;
    const el = $('#lt-last');
    if (!e) { el.innerHTML = '<div class="card lt-last idle"><div class="badge">💌</div><div><div class="lh">방금 일어난 일</div><div class="ld">아직 아무도 카드를 내지 않았어요</div></div></div>'; return; }
    const actor = seatById(e.actorId);
    const mark = { kill: '💀', safe: '🛡️', info: '👀', swap: '🔁', plain: '' }[e.tone] || '';
    el.innerHTML = `<div class="card lt-last ${esc(e.tone)}" style="--cc:${e.card ? HUE[e.card] : '#94a3b8'}">
      <div class="badge">${e.card ? esc(cardOf(e.card).emoji) : '🚪'}${e.card ? `<i>${e.card}</i>` : ''}</div>
      <div><div class="lh"><span class="lm">#${e.seq}${e.auto ? ' · AUTO' : ''}</span>방금 일어난 일 · ${actor ? col(actor) : ''}${e.targetId && e.targetId !== e.actorId ? ` → ${col(seatById(e.targetId))}` : ''}${e.auto ? ' <span class="hint">(시간 초과로 자동)</span>' : ''}</div>
      <div class="ld">${mark ? `${mark} ` : ''}${esc(e.detail || e.headline)}</div></div></div>`;
  }

  function cardBtn(t, idx, opts = {}) {
    const c = cardOf(t);
    return `<button class="lt-card${opts.on ? ' on' : ''}${opts.static ? ' static' : ''}" style="--cc:${HUE[t]}" ${opts.attr ? `${opts.attr}="${idx}"` : ''} ${opts.disabled ? 'disabled' : ''}><span class="num">${t}</span><span class="em">${esc(c.emoji)}</span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></button>`;
  }

  function renderMe() {
    const { S, G } = cur;
    const el = $('#lt-me');
    const me = G.me;
    if (!me) { el.innerHTML = '<div class="eyebrow"><span>SPECTATING</span></div><b>👀 관전 중</b><div class="hint">이번 판은 구경만 할 수 있어요. 아래 ‘다음 판 준비’를 눌러 두면 다음 판에 참가해요.</div>'; sigMe = 'spec'; return; }
    const myTurn = G.phase === 'play' && G.turnId === S.you && me.alive;
    const sig = JSON.stringify([G.phase, G.round, me.hand, me.alive, myTurn, me.moves, G.turnId]);
    if (sig === sigMe) return;
    sigMe = sig;
    selCard = null; selTarget = null; selGuess = null;
    if (!me.alive) { el.innerHTML = `<div class="eyebrow"><span>YOUR HAND</span><b>OUT</b></div><b>💀 이번 라운드는 탈락했어요</b><div class="hint">다음 라운드를 기다리며 구경하세요. 채팅으로 이야기해도 돼요.</div>`; return; }
    if (!myTurn) {
      el.innerHTML = `<div class="eyebrow"><span>YOUR HAND</span><b>WAITING</b></div><div class="lt-hand one">${me.hand.map((t) => cardBtn(t, 0, { static: true })).join('')}</div>`;
      return;
    }
    // 내 차례
    el.innerHTML = `<div class="eyebrow"><span>YOUR TURN</span><b>PICK ONE</b></div>
      <div class="lt-hand">${me.hand.map((t, i) => cardBtn(t, i, { attr: 'data-card', disabled: !me.moves[i].allowed })).join('')}</div>
      ${me.mustCountess ? '<p class="hint">👑 대비를 세자나 영의정과 함께 들고 있어서, 대비를 먼저 내야 해요.</p>' : ''}
      <div class="lt-act" id="lt-act"></div>`;
    $$('[data-card]').forEach((b) => { b.onclick = () => { selCard = Number(b.dataset.card); selTarget = null; selGuess = null; renderAct(); }; });
    const allowed = me.moves.filter((m) => m.allowed);
    if (allowed.length === 1) { selCard = allowed[0].index; }
    renderAct();
  }

  // 고른 카드에 맞춰 대상/추측 선택창을 그려요
  function renderAct() {
    const { G } = cur;
    const me = G.me;
    const act = $('#lt-act');
    if (!act) return;
    $$('[data-card]').forEach((b) => b.classList.toggle('on', Number(b.dataset.card) === selCard));
    if (selCard === null) { act.innerHTML = '<p class="hint">낼 카드를 눌러 고르세요.</p>'; return; }
    const mv = me.moves[selCard];
    const c = cardOf(mv.type);
    let html = `<p class="hint">${esc(c.emoji)} <b>${esc(c.name)}</b> — ${esc(c.desc)}</p>`;
    if (mv.needsTarget && !mv.selfOnly) {
      html += `<div class="hint">대상을 고르세요${mv.type === 5 ? ' (자신도 가능)' : ''}</div><div class="lt-chips">${mv.targets.map((id) => { const s = seatById(id); return `<button class="lt-chip${id === selTarget ? ' on' : ''}" data-target="${esc(id)}">${esc(s.avatar)} ${esc(s.name)}${id === cur.S.you ? ' (나)' : ''}</button>`; }).join('')}</div>`;
    } else if (mv.selfOnly) html += '<p class="hint">다른 사람이 모두 보호받고 있어서 세자는 나에게 써요.</p>';
    else if (mv.noTarget) html += '<p class="hint">쓸 수 있는 대상이 없어요. 효과 없이 카드만 내게 돼요.</p>';
    if (mv.type === 1 && mv.needsTarget) {
      html += `<div class="hint">그 사람이 들고 있을 카드를 추측하세요</div><div class="lt-chips">${[2, 3, 4, 5, 6, 7, 8].map((t) => `<button class="lt-chip${t === selGuess ? ' on' : ''}" data-guess="${t}">${esc(cardOf(t).emoji)} ${t} ${esc(cardOf(t).name)}</button>`).join('')}</div>`;
    }
    html += '<button class="btn primary big" id="lt-play" disabled>이 카드 내기</button><div class="err" id="lt-err"></div>';
    act.innerHTML = html;
    const ready = () => {
      if (mv.needsTarget && !mv.selfOnly && !selTarget) return false;
      if (mv.type === 1 && mv.needsTarget && !selGuess) return false;
      return mv.allowed;
    };
    const sync = () => { $('#lt-play').disabled = !ready(); };
    $$('[data-target]').forEach((b) => { b.onclick = () => { selTarget = b.dataset.target; $$('[data-target]').forEach((x) => x.classList.toggle('on', x.dataset.target === selTarget)); sync(); }; });
    $$('[data-guess]').forEach((b) => { b.onclick = () => { selGuess = Number(b.dataset.guess); $$('[data-guess]').forEach((x) => x.classList.toggle('on', Number(x.dataset.guess) === selGuess)); sync(); }; });
    sync();
    $('#lt-play').onclick = async () => {
      const r = await ctx.act('play', { card: selCard, target: selTarget || undefined, guess: selGuess || undefined });
      if (!r || !r.ok) $('#lt-err').textContent = (r && r.error) || '내지 못했어요.';
    };
  }

  function renderNotes() {
    const { G } = cur;
    const notes = G.me ? G.me.notes : [];
    const sig = JSON.stringify(notes);
    if (sig === sigNotes) return;
    sigNotes = sig;
    $('#lt-notes').innerHTML = notes.length ? notes.map((n) => `<div class="lt-note">${esc(n.text)}</div>`).join('') : '<div class="hint">나인, 무관, 영의정으로 알게 된 정보가 여기에 쌓여요. (라운드가 끝나면 지워져요)</div>';
  }

  function renderResult() {
    const { S, G } = cur;
    const el = $('#lt-result');
    if (G.phase === 'play') { el.innerHTML = ''; sigResult = ''; return; }
    const ready = G.nextReady.includes(S.you);
    const sig = JSON.stringify([G.phase, G.round, G.reveal, G.roundWinners, G.result, G.nextReady, G.seats.map((s) => s.tokens)]);
    if (sig === sigResult) return;
    sigResult = sig;
    const rows = G.seats.map((s) => {
      const rv = G.reveal && G.reveal.find((r) => r.id === s.id);
      const won = G.roundWinners.includes(s.id);
      return `<div class="lt-rrow">${col(s)}${rv && rv.alive ? `<span class="lt-mini">${chip(rv.hand[0])} ${esc(cardOf(rv.hand[0]).name)}</span>` : '<span class="lt-mini">💀 탈락</span>'}${won ? '<span class="tag">라운드 승리 ❤+1</span>' : ''}<span class="g">${'❤'.repeat(s.tokens)}</span></div>`;
    }).join('');
    if (G.phase === 'roundEnd') {
      const total = G.seats.filter((s) => !s.left).length;
      el.innerHTML = `<div class="card lt-res"><div class="eyebrow"><span>ROUND ${G.round} RESULT</span><b>NEXT <span id="lt-next"></span></b></div><h2>🏁 라운드 종료</h2><div class="lt-reveal">${rows}</div>
        <button class="btn primary big" id="lt-nextbtn" ${ready ? 'disabled' : ''}>${ready ? `기다리는 중… (${G.nextReady.length}/${total})` : `다음 라운드로 (${G.nextReady.length}/${total})`}</button></div>`;
      $('#lt-nextbtn').onclick = async () => { const r = await ctx.act('next'); if (r && !r.ok) ctx.toast(r.error); };
    } else {
      const r = G.result;
      const prow = r.players.map((p) => `<div class="lt-rrow">${col(p)}<span>${'❤'.repeat(p.tokens) || '–'} <span class="hint">${p.tokens}/${G.goal}</span></span>${p.win ? '<span class="tag">승리</span>' : ''}<span class="g">${p.gain ? `+${p.gain}` : ''}</span></div>`).join('');
      el.innerHTML = `<div class="card lt-res"><div class="eyebrow"><span>FINAL</span><b>${r.abort ? 'ABORTED' : 'WINNER'}</b></div><h2>${r.abort ? '⚪ 게임 중단' : '🎉 밀서가 전해졌어요!'}</h2><div>${esc(r.reason)}</div><div style="margin-top:8px">${prow}</div><p class="hint">아래 버튼으로 같은 게임을 다시 하거나, 게임을 바꿀 수 있어요.</p></div>`;
      ctx.toast(r.abort ? '게임이 중단됐어요' : '🎉 게임이 끝났어요!');
    }
  }

  function tick() {
    if (!cur) return;
    const t = $('#lt-timer');
    if (t) t.textContent = cur.G.endsAt ? fmt(cur.G.endsAt - ctx.now()) : '';
    const n = $('#lt-next');
    if (n) n.textContent = cur.G.endsAt ? fmt(cur.G.endsAt - ctx.now()) : '';
  }

  window.GAME_UI.letter = {
    mount(c) {
      ctx = c;
      cur = null;
      selCard = null; selTarget = null; selGuess = null;
      sigHead = sigSeats = sigLog = sigMe = sigNotes = sigResult = sigLast = '';
      ctx.host().innerHTML = TEMPLATE;
      clearInterval(timer);
      timer = setInterval(tick, 500);
    },
    update(S, G) {
      cur = { S, G };
      renderHead();
      renderLast();
      renderSeats();
      renderLog();
      renderMe();
      renderNotes();
      renderResult();
      tick();
    },
    unmount() {
      clearInterval(timer);
      timer = null;
      cur = null;
      if (ctx) ctx.bar().innerHTML = '';
    },
  };
})();
