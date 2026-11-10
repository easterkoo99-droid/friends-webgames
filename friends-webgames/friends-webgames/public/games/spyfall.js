/**
 * 우리가 있는 곳은? 화면 (게임 플러그인, 코드 이름: spyfall)
 *  - 방/채팅/준비/게임 바꾸기는 index.html 의 허브가 맡고, 여기서는 게임 화면만 그려요.
 *  - 새 게임을 추가할 때도 이 파일처럼 GAME_UI.게임id = { mount(ctx), update(S, G), unmount() } 를 등록하면 돼요.
 *    S: 방 전체 상태, G: 서버 플러그인(games/게임id.js)의 view() 가 돌려준 내 화면용 데이터
 *    ctx: { host(), bar(), act(type, data), toast, esc, nm(p), pById(id), crown(id), openChat(), view(), now() }
 */
(() => {
  'use strict';
  window.GAME_UI = window.GAME_UI || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const CSS = `
  .sp { display: flex; flex-direction: column; gap: 12px; }
  .sp .card h3 { margin-bottom: 8px; }
  .sp-clock { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sp-time { font-family: var(--mono); font-size: 26px; font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; min-width: 76px; }
  .sp-time.low { color: var(--bad); }
  .sp-track { flex: 1 1 80px; height: 4px; border-radius: var(--r); background: var(--soft); overflow: hidden; }
  .sp-track i { display: block; height: 100%; background: var(--accent); width: 100%; transition: width .4s linear; }
  .sp-btns { display: flex; gap: 8px; }
  .sp-cardbtn { width: 100%; border: 2px dashed var(--line); background: var(--card); border-radius: var(--r-lg); padding: 18px; text-align: center; font-weight: 800; font-size: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
  .sp-cardbtn.open { border-style: solid; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--card)); font-size: 22px; }
  .sp-cardbtn.open.spy { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, var(--card)); }
  .sp-cardbtn small { font-size: 13px; font-weight: 500; color: var(--dim); }
  .sp-rolein { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: var(--r-lg); background: var(--soft); text-align: center; }
  .sp-chain { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; font-size: 14px; }
  .sp-chain:empty { display: none; }
  .sp-chain .ar { color: var(--dim); }
  .sp-turn label { display: block; font-size: 13px; color: var(--dim); margin: 12px 0 6px; }
  .sp-pend { background: var(--soft); border-radius: var(--r); padding: 10px 12px; font-size: 14.5px; }
  .sp-targets { display: flex; flex-wrap: wrap; gap: 6px; }
  .sp-t { border: 2px solid var(--line); background: var(--card); border-radius: var(--r); padding: 7px 12px; font-weight: 700; cursor: pointer; }
  .sp-t.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--card)); }
  .sp-turn .btn.big { margin-top: 14px; }
  .sp-thread { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
  .sp-qa { display: flex; flex-direction: column; gap: 4px; }
  .sp-qh { font-size: 13px; color: var(--dim); }
  .sp-bub { background: var(--soft); border-radius: var(--r); padding: 8px 12px; font-size: 15px; align-self: flex-start; max-width: 92%; word-break: break-word; }
  .sp-bub.a { align-self: flex-end; background: color-mix(in srgb, var(--accent) 10%, var(--card)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); }
  .sp-bub.wait { color: var(--dim); font-style: italic; }
  .sp-sys { text-align: center; color: var(--dim); font-size: 13px; }
  .sp-locs { display: flex; flex-wrap: wrap; gap: 6px; }
  .sp-loc { border: 1.5px solid var(--line); background: var(--soft); border-radius: var(--r); padding: 6px 10px; font-size: 14px; cursor: pointer; }
  .sp-loc.x { text-decoration: line-through; opacity: .4; }
  .sp-res h2 { margin-bottom: 6px; }
  .sp-res .win-c { color: var(--ok); } .sp-res .win-s { color: var(--bad); }
  .sp-rrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 15px; }
  .sp-rrow .g { margin-left: auto; font-weight: 800; color: var(--ok); }
  .sp-vbar { padding: 10px 12px; background: color-mix(in srgb, var(--warn) 14%, var(--card)); border-bottom: 2px solid var(--warn); }
  .sp-vtop { display: flex; justify-content: space-between; gap: 8px; font-size: 14.5px; }
  .sp-vtime { font-weight: 800; color: var(--warn); white-space: nowrap; }
  .sp-vrows { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 6px 0; font-size: 13.5px; }
  .sp-vbtns { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
  .sp-mback { position: fixed; inset: 0; z-index: 85; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .sp-mbox { background: var(--card-solid, var(--card)); border-radius: var(--r-lg); padding: 20px; width: 100%; max-width: 440px; max-height: 85vh; overflow-y: auto; }
  .sp-mbox .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .sp .err { margin-top: 8px; }
  `;
  try {
    if (document.head && document.head.appendChild && document.createElement) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* 스타일을 못 넣어도 동작은 해요 */ }

  const TEMPLATE = `<div class="sp">
    <div class="card sp-clock" id="sp-clockrow">
      <div class="sp-time" id="sp-time">8:00</div>
      <div class="sp-track"><i id="sp-bar"></i></div>
      <div class="sp-btns">
        <button class="btn small danger" id="sp-accuse">🗳 스파이 지목</button>
        <button class="btn small" id="sp-guess" hidden>📍 장소 맞추기</button>
      </div>
    </div>
    <div id="sp-result"></div>
    <div id="sp-role"></div>
    <div class="sp-chain" id="sp-chain"></div>
    <div class="card sp-turn" id="sp-turn"></div>
    <div class="card"><h3>질문 · 대답</h3><div class="sp-thread" id="sp-thread"></div></div>
    <div class="card"><h3>장소 목록 <span class="hint">눌러서 지워 가며 추리하세요</span></h3><div class="sp-locs" id="sp-locs"></div></div>
    <div id="sp-modal"></div>
  </div>`;

  let ctx = null, cur = null, clockTimer = null;
  let cardOpen, struck, targetSel, modal, accuseSel, guessSel, locsBuilt, toldEnd;
  let sigRole, sigTurn, sigThread, sigVote, sigChain, sigResult;

  const esc = (s) => ctx.esc(s);
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const colored = (name, color, avatar) => `<span style="color:${esc(color)};font-weight:800">${esc(avatar || '')} ${esc(name)}</span>`;

  /* ───────── 부분별 그리기 ───────── */
  function renderClockButtons() {
    const { S, G } = cur;
    const playing = G.phase === 'playing';
    const acc = $('#sp-accuse'), guess = $('#sp-guess');
    acc.hidden = !playing || G.me.spectator;
    acc.disabled = !G.canAccuse;
    acc.textContent = G.vote ? '🗳 투표 진행 중' : (G.canAccuse ? '🗳 스파이 지목' : '🗳 지목 사용 완료');
    guess.hidden = !(playing && G.me.isSpy);
  }

  function renderRole() {
    const { G } = cur;
    const me = G.me;
    const sig = [G.phase, me.spectator, me.isSpy, me.location, cardOpen].join('|');
    if (sig === sigRole) return;
    sigRole = sig;
    const el = $('#sp-role');
    if (me.spectator) {
      el.innerHTML = '<div class="sp-rolein"><b>👀 관전 중</b><span class="hint">이번 판은 구경만 할 수 있어요. 아래 ‘다음 판 준비’를 눌러 두면 다음 판에 참가해요.</span></div>';
      return;
    }
    if (!cardOpen) {
      el.innerHTML = '<button class="sp-cardbtn" id="sp-cardtoggle">🔒 내 비밀 카드 보기<small>다른 사람이 보지 않을 때 눌러서 확인하세요</small></button>';
    } else if (me.isSpy) {
      el.innerHTML = '<button class="sp-cardbtn open spy" id="sp-cardtoggle"><span>🕵️ 당신은 스파이!</span><small>장소를 모르는 걸 들키지 말고 단서를 모으세요 (눌러서 숨기기)</small></button>';
    } else {
      el.innerHTML = `<button class="sp-cardbtn open" id="sp-cardtoggle"><span>📍 ${esc(me.location)}</span><small>스파이에게 들키지 않게 질문하세요 (눌러서 숨기기)</small></button>`;
    }
    $('#sp-cardtoggle').onclick = () => { cardOpen = !cardOpen; sigRole = ''; renderRole(); };
  }

  function buildLocs() {
    if (locsBuilt) return;
    locsBuilt = true;
    const { G } = cur;
    $('#sp-locs').innerHTML = G.locations.map((n, i) => `<button class="sp-loc" data-loc="${i}">${esc(n)}</button>`).join('');
    $$('[data-loc]').forEach((b) => {
      b.onclick = () => {
        const name = G.locations[Number(b.dataset.loc)];
        if (struck.has(name)) struck.delete(name); else struck.add(name);
        b.classList.toggle('x', struck.has(name));
      };
    });
  }

  function renderChain() {
    const { G } = cur;
    const qs = G.thread.filter((t) => t.type === 'qa').slice(-6);
    const sig = qs.map((t) => t.n).join(',');
    if (sig === sigChain) return;
    sigChain = sig;
    if (!qs.length) { $('#sp-chain').innerHTML = ''; return; }
    const parts = [colored(qs[0].askerName, qs[0].askerColor, qs[0].askerAvatar)];
    qs.forEach((t) => parts.push(colored(t.targetName, t.targetColor, t.targetAvatar)));
    $('#sp-chain').innerHTML = `<span class="hint">질문 흐름</span> ${parts.join('<span class="ar">→</span>')}`;
  }

  function renderTurn() {
    const { S, G } = cur;
    const el = $('#sp-turn');
    if (G.phase !== 'playing') { el.hidden = true; sigTurn = ''; return; }
    el.hidden = false;
    const gamer = !G.me.spectator;
    const gamers = S.players.filter((p) => p.inGame);
    const sig = [G.turnId, G.vote ? 1 : 0, G.pending ? G.pending.n : 0, G.lastAskerId, gamer, gamers.map((p) => p.id).join(',')].join('|');
    if (sig === sigTurn) return;
    sigTurn = sig;
    targetSel = null;
    if (G.vote) { el.innerHTML = '<h3>🗳 투표가 진행 중이에요</h3><p class="hint">투표가 끝나면 질문을 이어가요. 위의 투표 창에서 의견을 남겨 주세요.</p>'; return; }
    const turnP = ctx.pById(G.turnId);
    if (!(gamer && G.turnId === S.you)) {
      el.innerHTML = `<h3>👉 ${ctx.nm(turnP)}님 차례</h3><p class="hint">${gamer ? '기다리는 동안 채팅으로 분위기를 살펴보세요.' : '관전 중이에요.'}</p>`;
      return;
    }
    const cands = gamers.filter((p) => p.id !== S.you && p.id !== G.lastAskerId);
    const pend = G.pending;
    const asker = pend ? ctx.pById(pend.askerId) : null;
    el.innerHTML = `<h3>👉 내 차례예요</h3>
      ${pend ? `<div class="sp-pend">받은 질문 · ${asker ? ctx.nm(asker) : esc(pend.askerName)}: “${esc(pend.question)}”</div><label>내 대답 (필수)</label><input type="text" id="sp-ans" maxlength="160" placeholder="받은 질문에 대한 대답을 적어 주세요" autocomplete="off">` : '<p class="hint">첫 질문이에요. 대답할 질문이 아직 없어요.</p>'}
      <label>다음에 질문할 사람</label>
      <div class="sp-targets">${cands.map((p) => `<button class="sp-t" data-target="${esc(p.id)}">${esc(p.avatar)} ${esc(p.name)}</button>`).join('')}</div>
      ${G.lastAskerId && ctx.pById(G.lastAskerId) ? `<p class="hint">방금 질문한 ${esc(ctx.pById(G.lastAskerId).name)}님에게는 바로 되물을 수 없어요.</p>` : ''}
      <label>질문</label>
      <input type="text" id="sp-q" maxlength="120" placeholder="예: 그곳에서는 특별한 옷을 입나요?" autocomplete="off">
      <div class="err" id="sp-err"></div>
      <button class="btn primary big" id="sp-send">질문하고 넘기기</button>`;
    $$('[data-target]').forEach((b) => {
      b.onclick = () => {
        targetSel = b.dataset.target;
        $$('[data-target]').forEach((x) => x.classList.toggle('on', x.dataset.target === targetSel));
      };
    });
    const send = async () => {
      const err = $('#sp-err');
      err.textContent = '';
      const question = $('#sp-q').value.trim();
      const answer = $('#sp-ans') ? $('#sp-ans').value.trim() : '';
      if (pend && !answer) { err.textContent = '받은 질문에 대한 대답을 먼저 적어 주세요.'; return; }
      if (!targetSel) { err.textContent = '질문할 사람을 골라 주세요.'; return; }
      if (!question) { err.textContent = '질문을 입력해 주세요.'; return; }
      const r = await ctx.act('pass_turn', { target: targetSel, question, answer });
      if (!r || !r.ok) err.textContent = (r && r.error) || '보내지 못했어요.';
    };
    $('#sp-send').onclick = send;
    $('#sp-q').onkeydown = (e) => { if (e.key === 'Enter') send(); };
    if ($('#sp-ans')) $('#sp-ans').focus(); else $('#sp-q').focus();
  }

  function renderThread() {
    const { G } = cur;
    const sig = G.thread.map((t) => (t.type === 'qa' ? `${t.n}:${t.answer ? 1 : 0}${t.skipped ? 's' : ''}` : 's')).join(',');
    if (sig === sigThread) return;
    sigThread = sig;
    const el = $('#sp-thread');
    el.innerHTML = G.thread.map((t) => {
      if (t.type === 'sys') return `<div class="sp-sys">${esc(t.text)}</div>`;
      const ans = t.answer ? `<div class="sp-bub a">${colored(t.targetName, t.targetColor, t.targetAvatar)} · ${esc(t.answer)}</div>`
        : t.skipped ? '<div class="sp-bub wait">답변 없이 넘어갔어요</div>' : '<div class="sp-bub wait">답변을 기다리는 중…</div>';
      return `<div class="sp-qa"><div class="sp-qh">#${t.n} ${colored(t.askerName, t.askerColor, t.askerAvatar)} → ${colored(t.targetName, t.targetColor, t.targetAvatar)}</div><div class="sp-bub">❓ ${esc(t.question)}</div>${ans}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function renderVote() {
    const { S, G } = cur;
    const bar = ctx.bar();
    const v = G.vote;
    if (!v) { if (sigVote) { bar.innerHTML = ''; sigVote = ''; } return; }
    const compact = ctx.view() === 'chat';
    const mine = v.eligible.includes(S.you) && v.votes[S.you] === undefined && !G.me.spectator;
    const sig = JSON.stringify([v.accuserId, v.accusedId, v.votes, v.eligible, compact, mine]);
    if (sig === sigVote) return;
    sigVote = sig;
    const rows = v.eligible.map((id) => {
      const val = v.votes[id];
      return `<span>${ctx.nm(ctx.pById(id))} ${val === true ? '👍' : val === false ? '👎' : '…'}</span>`;
    }).join('');
    const status = G.me.spectator ? '관전 중' : (v.accusedId === S.you ? '지목된 사람은 투표할 수 없어요' : '투표 완료');
    bar.innerHTML = `<div class="sp-vbar">
      <div class="sp-vtop"><b>🗳 ${ctx.nm(ctx.pById(v.accuserId))}님이 ${ctx.nm(ctx.pById(v.accusedId))}님을 스파이로 지목!</b><span class="sp-vtime" id="sp-vt"></span></div>
      ${compact ? '' : `<div class="sp-vrows">${rows}</div>`}
      <div class="sp-vbtns">${mine ? '<button class="btn small primary" data-vote="1">👍 찬성</button><button class="btn small danger" data-vote="0">👎 반대</button>' : `<span class="hint">${status}</span>`}
        ${compact ? '' : '<button class="btn small" id="sp-vchat">💬 채팅으로 토론</button>'}</div></div>`;
    $$('[data-vote]').forEach((b) => {
      b.onclick = async () => { const r = await ctx.act('vote', { agree: b.dataset.vote === '1' }); if (r && !r.ok) ctx.toast(r.error); };
    });
    const vc = $('#sp-vchat');
    if (vc) vc.onclick = () => ctx.openChat();
    tick();
  }

  function renderResult() {
    const { S, G } = cur;
    const el = $('#sp-result');
    if (G.phase !== 'ended') { el.innerHTML = ''; sigResult = ''; return; }
    const r = G.result;
    const sig = `${S.gameNo}|${JSON.stringify(r)}`;
    if (sig === sigResult) return;
    sigResult = sig;
    const head = r.winner === 'citizens' ? '<h2 class="win-c">🎉 시민 승리!</h2>' : r.winner === 'spy' ? '<h2 class="win-s">🕵️ 스파이 승리!</h2>' : '<h2>⚪ 게임 중단</h2>';
    const votes = r.voteRows ? `<p class="hint">지목 투표: ${r.voteRows.map((x) => `${esc(x.name)} ${x.vote === true ? '👍' : x.vote === false ? '👎' : '…'}`).join(' · ')}</p>` : '';
    el.innerHTML = `<div class="card sp-res">${head}<div>${esc(r.reason)}</div>
      <p>스파이는 <b>${esc(r.spyName)}</b>, 장소는 <b>📍 ${esc(r.location)}</b>였어요.</p>${votes}
      <div>${r.players.map((p) => `<div class="sp-rrow">${colored(p.name, p.color, p.avatar)}${p.isSpy ? ' <span class="tag">스파이</span>' : ''}<span class="g">${p.gain ? `+${p.gain}` : ''}</span><span class="hint">${p.score}점</span></div>`).join('')}</div>
      ${r.noScore ? '<p class="hint">이번 판은 점수가 없어요.</p>' : ''}
      <p class="hint">아래 버튼으로 같은 게임을 다시 하거나, 게임을 바꿀 수 있어요.</p></div>`;
    if (!toldEnd) { toldEnd = true; ctx.toast('게임이 끝났어요!'); }
  }

  /* ───────── 팝업 (지목 / 장소 맞추기) ───────── */
  function renderModal() {
    const root = $('#sp-modal');
    if (!modal) { root.innerHTML = ''; return; }
    const { S, G } = cur;
    if (modal === 'accuse') {
      const cands = S.players.filter((p) => p.inGame && p.id !== S.you);
      root.innerHTML = `<div class="sp-mback"><div class="sp-mbox"><h3>누구를 지목할까요?</h3>
        <p class="hint">지목하면 투표가 시작돼요. 지목된 사람을 뺀 모든 참가자가 찬성해야 확정돼요. (한 사람당 한 번만 가능)</p>
        <div class="sp-targets" style="margin-top:12px">${cands.map((p) => `<button class="sp-t${p.id === accuseSel ? ' on' : ''}" data-acc="${esc(p.id)}">${esc(p.avatar)} ${esc(p.name)}</button>`).join('')}</div>
        <div class="err" id="sp-merr"></div>
        <div class="actions"><button class="btn" id="sp-mcancel">취소</button><button class="btn primary" id="sp-mgo">지목하기</button></div></div></div>`;
      $$('[data-acc]').forEach((b) => { b.onclick = () => { accuseSel = b.dataset.acc; renderModal(); }; });
      $('#sp-mgo').onclick = async () => {
        if (!accuseSel) { $('#sp-merr').textContent = '지목할 사람을 골라 주세요.'; return; }
        const r = await ctx.act('accuse', { target: accuseSel });
        if (!r || !r.ok) { $('#sp-merr').textContent = (r && r.error) || '지목하지 못했어요.'; return; }
        modal = null; renderModal();
      };
    } else {
      root.innerHTML = `<div class="sp-mback"><div class="sp-mbox"><h3>장소를 맞혀 보세요</h3>
        <p class="hint">정답이면 스파이 승리! 틀리면 시민이 승리해요.</p>
        <div class="sp-targets" style="margin-top:12px">${G.locations.map((n) => `<button class="sp-t${n === guessSel ? ' on' : ''}" data-g="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <div class="err" id="sp-merr"></div>
        <div class="actions"><button class="btn" id="sp-mcancel">취소</button><button class="btn primary" id="sp-mgo">${guessSel ? `‘${esc(guessSel)}’(으)로 확정` : '장소를 골라 주세요'}</button></div></div></div>`;
      $$('[data-g]').forEach((b) => { b.onclick = () => { guessSel = b.dataset.g; renderModal(); }; });
      $('#sp-mgo').onclick = async () => {
        if (!guessSel) { $('#sp-merr').textContent = '장소를 골라 주세요.'; return; }
        const r = await ctx.act('guess', { location: guessSel });
        if (!r || !r.ok) { $('#sp-merr').textContent = (r && r.error) || '보내지 못했어요.'; return; }
        modal = null; renderModal();
      };
    }
    $('#sp-mcancel').onclick = () => { modal = null; renderModal(); };
  }

  function tick() {
    if (!cur) return;
    const { G } = cur;
    const row = $('#sp-clockrow');
    if (!row) return;
    if (G.phase !== 'playing') { row.hidden = true; return; }
    row.hidden = false;
    const left = Math.max(0, G.endsAt - ctx.now());
    $('#sp-time').textContent = fmt(left);
    $('#sp-time').className = `sp-time${left < 60000 ? ' low' : ''}`;
    $('#sp-bar').style.width = `${Math.max(0, Math.min(100, (left / (G.gameSec * 1000)) * 100))}%`;
    if (G.vote) {
      const vt = $('#sp-vt');
      if (vt) vt.textContent = `${Math.max(0, Math.ceil((G.vote.endsAt - ctx.now()) / 1000))}초`;
    }
  }

  window.GAME_UI.spyfall = {
    mount(c) {
      ctx = c;
      cur = null;
      cardOpen = false; struck = new Set(); targetSel = null; modal = null; accuseSel = null; guessSel = null;
      locsBuilt = false; toldEnd = false;
      sigRole = sigTurn = sigThread = sigVote = sigChain = sigResult = '';
      ctx.host().innerHTML = TEMPLATE;
      $('#sp-accuse').onclick = () => { if (cur && cur.G.canAccuse) { modal = 'accuse'; accuseSel = null; renderModal(); } };
      $('#sp-guess').onclick = () => { modal = 'guess'; guessSel = null; renderModal(); };
      clearInterval(clockTimer);
      clockTimer = setInterval(tick, 500);
    },
    update(S, G) {
      cur = { S, G };
      if (modal && (G.phase !== 'playing' || (modal === 'accuse' && G.vote))) { modal = null; renderModal(); }
      renderClockButtons();
      renderRole();
      buildLocs();
      renderChain();
      renderTurn();
      renderThread();
      renderVote();
      renderResult();
      tick();
    },
    unmount() {
      clearInterval(clockTimer);
      clockTimer = null;
      cur = null;
      if (ctx) { ctx.bar().innerHTML = ''; }
    },
  };
})();
