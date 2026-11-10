/**
 * 오늘도 이 마을엔 피가 흐른다 화면 (게임 플러그인, 코드 이름: village)
 *  - 방/채팅/준비/게임 바꾸기는 index.html 허브가 맡아요. 여기서는 게임 화면만 그려요.
 *  - 직업 목록은 서버(games/village.js)가 보내 주는 G.roles 를 써요. 직업을 바꾸면 서버 파일만 고치면 돼요.
 */
(() => {
  'use strict';
  window.GAME_UI = window.GAME_UI || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const CSS = `
  .vg { display: flex; flex-direction: column; gap: 12px; }
  .vg .card h3 { margin-bottom: 8px; }
  .vg-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .vg-head.night { background: #1d2340; color: #eef0ff; border-color: #2e3766; }
  .vg-head.night .hint { color: #aeb6e6; }
  .vg-phase { font-size: 20px; font-weight: 800; }
  .vg-timer { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .vg-rolebtn { width: 100%; border: 2px dashed var(--line); background: var(--card); border-radius: 16px; padding: 16px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
  .vg-rolebtn.open { border-style: solid; }
  .vg-rolebtn.good.open { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 8%, var(--card)); }
  .vg-rolebtn.evil.open { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, var(--card)); }
  .vg-rolebtn b { font-size: 20px; }
  .vg-rolebtn small { font-size: 13.5px; color: var(--dim); line-height: 1.45; }
  .vg-evil { margin-top: 6px; font-size: 14px; }
  .vg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .vg-chip { border: 2px solid var(--line); background: var(--card); border-radius: 999px; padding: 7px 12px; font-weight: 700; cursor: pointer; }
  .vg-chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--card)); }
  .vg-chip:disabled { opacity: .4; cursor: default; }
  .vg-act .btn { margin-top: 6px; }
  .vg-seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .vg-seat { border: 1.5px solid var(--line); border-radius: 12px; padding: 8px 10px; font-size: 14px; background: var(--soft); display: flex; flex-direction: column; gap: 2px; }
  .vg-seat.dead { opacity: .55; }
  .vg-seat.block { border-color: var(--bad); box-shadow: 0 0 0 1.5px var(--bad) inset; }
  .vg-seat.me { border-color: var(--accent); }
  .vg-seat small { color: var(--dim); }
  .vg-notes { display: flex; flex-direction: column; gap: 6px; font-size: 14.5px; }
  .vg-note { background: var(--soft); border-radius: 10px; padding: 8px 10px; }
  .vg-note i { font-style: normal; font-weight: 800; color: var(--dim); margin-right: 6px; font-size: 12px; }
  .vg-log { max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .vg-log div { padding: 2px 0; border-bottom: 1px dashed var(--line); }
  .vg-res h2 { margin-bottom: 6px; }
  .vg-res .win-t { color: var(--ok); } .vg-res .win-e { color: var(--bad); }
  .vg-rrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 15px; flex-wrap: wrap; }
  .vg-rrow .g { margin-left: auto; font-weight: 800; color: var(--ok); }
  .vg-vbar { padding: 10px 12px; background: color-mix(in srgb, var(--bad) 10%, var(--card)); border-bottom: 2px solid var(--bad); }
  .vg-vtop { display: flex; justify-content: space-between; gap: 8px; font-size: 14.5px; }
  .vg-vt { font-weight: 800; color: var(--bad); white-space: nowrap; }
  .vg-vrows { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 6px 0; font-size: 13.5px; }
  .vg-vbtns { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
  .vg-mback { position: fixed; inset: 0; z-index: 85; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .vg-mbox { background: var(--card); border-radius: 18px; padding: 20px; width: 100%; max-width: 460px; max-height: 85vh; overflow-y: auto; }
  .vg-mbox .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .vg-wchips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .vg-chip i { font-style: normal; background: var(--accent); color: #fff; border-radius: 10px; padding: 0 6px; font-size: 11px; margin-left: 4px; }
  .vg-wthread { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin: 6px 0; font-size: 14.5px; }
  .vg-wm { background: var(--soft); border-radius: 10px; padding: 6px 10px; align-self: flex-start; max-width: 90%; word-break: break-word; }
  .vg-wm.me { align-self: flex-end; background: color-mix(in srgb, var(--accent) 10%, var(--card)); }
  .vg-wform { display: flex; gap: 8px; margin-top: 6px; }
  .vg-wform input { flex: 1; }
  .vg-guide h4 { margin: 12px 0 4px; font-size: 14px; color: var(--dim); }
  .vg-guide p { margin: 2px 0 8px; font-size: 14.5px; }
  `;
  try {
    if (document.head && document.head.appendChild && document.createElement) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  } catch (e) { /* 스타일을 못 넣어도 동작은 해요 */ }

  const TEMPLATE = `<div class="vg">
    <div class="card vg-head" id="vg-head"></div>
    <div id="vg-result"></div>
    <div id="vg-role"></div>
    <div class="card vg-act" id="vg-action"></div>
    <div class="card" id="vg-whisper">
      <h3>🤫 귓속말 <span class="hint">낮에만 보낼 수 있어요. 누가 누구와 이야기하는지는 모두에게 보여요</span></h3>
      <div class="vg-wchips" id="vg-wchips"></div>
      <div class="vg-wthread" id="vg-wthread"></div>
      <div class="vg-wform"><input type="text" id="vg-winput" maxlength="160" placeholder="귓속말 내용" autocomplete="off"><button class="btn primary" id="vg-wsend">보내기</button></div>
      <div class="hint" id="vg-wnote"></div>
    </div>
    <div class="card"><h3>마을 사람들 <span class="hint">앉은 순서대로 둥글게 이어져 있어요</span></h3><div class="vg-seats" id="vg-seats"></div></div>
    <div class="card"><h3>🗒 내 정보 기록</h3><div class="vg-notes" id="vg-notes"></div></div>
    <div class="card"><h3>📜 마을 일지</h3><div class="vg-log" id="vg-log"></div></div>
    <div class="card"><button class="btn small" id="vg-guide">📖 직업 도감 보기</button></div>
    <div id="vg-modal"></div>
  </div>`;

  let ctx = null, cur = null, timer = null;
  let roleOpen, pick, nomSel, modal, shootSel, sigHead, sigRole, sigAction, sigSeats, sigNotes, sigLog, sigVote, sigResult, noteCount;
  let wTarget, wSeen, sigWhisper, wIncoming;

  const esc = (s) => ctx.esc(s);
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const col = (s) => `<span style="color:${esc(s.color)};font-weight:800">${esc(s.avatar)} ${esc(s.name)}</span>`;
  const seatById = (id) => cur.G.seats.find((s) => s.id === id);
  const aliveSeats = () => cur.G.seats.filter((s) => s.alive);

  /* ───────── 머리말 (밤/낮 + 남은 시간) ───────── */
  function renderHead() {
    const { G } = cur;
    const el = $('#vg-head');
    if (G.phase === 'ended') { el.hidden = true; return; }
    el.hidden = false;
    const me = G.me;
    const sig = [G.phase, G.nightStage, G.day, G.night, G.dayPhase, G.skipCount, G.need, me && me.skipped, me && me.alive].join('|');
    if (sig === sigHead) return;
    sigHead = sig;
    el.className = `card vg-head ${G.phase}`;
    let title, sub = '';
    if (G.phase === 'night' && G.nightStage === 'raven') { title = `🌙 ${G.night}번째 밤`; sub = '누군가의 마지막 선택을 기다리는 중이에요. 모두 눈을 감고 기다려요.'; }
    else if (G.phase === 'night') { title = `🌙 ${G.night}번째 밤`; sub = '능력이 있는 사람은 선택을 해 주세요. 모두 눈을 감고 기다려요.'; }
    else if (G.dayPhase === 'talk') { title = `☀️ ${G.day}번째 낮 · 토론`; sub = '채팅으로 이야기하세요. 과반이 동의하면 일찍 끝낼 수 있어요.'; }
    else { title = `🗳 ${G.day}번째 낮 · 지목`; sub = '의심스러운 사람을 지목해 처형 투표를 열 수 있어요.'; }
    el.innerHTML = `<div><div class="vg-phase">${title}</div><div class="hint">${esc(sub)}</div></div><div class="vg-timer" id="vg-timer"></div>`;
  }

  /* ───────── 내 직업 ───────── */
  function renderRole() {
    const { G } = cur;
    const el = $('#vg-role');
    const me = G.me;
    if (!me) { el.innerHTML = '<div class="card"><b>👀 관전 중</b><div class="hint">이번 판은 구경만 할 수 있어요. 아래 ‘다음 판 준비’를 눌러 두면 다음 판에 참가해요.</div></div>'; sigRole = 'spec'; return; }
    const sig = [roleOpen, me.role, me.alive, me.ghost, G.phase].join('|');
    if (sig === sigRole) return;
    sigRole = sig;
    if (!roleOpen) {
      el.innerHTML = '<button class="vg-rolebtn" id="vg-roletoggle"><b>🔒 내 직업 보기</b><small>다른 사람이 보지 않을 때 눌러서 확인하세요. (다시 누르면 숨겨져요)</small></button>';
    } else {
      const ev = me.evil;
      let evilHtml = '';
      if (ev) {
        const names = (l) => (l.length ? l.map((x) => esc(x.name)).join(', ') : '없음');
        evilHtml = `<div class="vg-evil">😈 악의 무리 — 악마: <b>${names(ev.demon)}</b> · 하수인: <b>${names(ev.minions)}</b>${ev.bluffs.length ? `<br>🎭 마을에 없는 직업(허세용): <b>${ev.bluffs.map(esc).join(', ')}</b>` : ''}</div>`;
      }
      el.innerHTML = `<button class="vg-rolebtn open ${me.team}" id="vg-roletoggle"><b>${esc(me.emoji)} ${esc(me.roleName)}</b><small>${esc(me.desc)}</small>${evilHtml}<small>${me.alive ? '살아 있어요' : `💀 죽었어요 · 유령표 ${me.ghost ? '1회 남음' : '사용 완료'}`}</small></button>`;
    }
    $('#vg-roletoggle').onclick = () => { roleOpen = !roleOpen; sigRole = ''; renderRole(); };
  }

  /* ───────── 행동 패널 (밤 선택 / 낮 행동) ───────── */
  const NIGHT_TITLE = {
    seer: ['🔮 점을 칠 두 사람을 고르세요', '둘 중에 악마가 있는지 알려 줘요. 죽은 사람이나 자신도 고를 수 있어요.'],
    healer: ['🌿 오늘 밤 지킬 사람을 고르세요', '자신은 고를 수 없어요. 고른 사람은 악마의 습격에 죽지 않아요.'],
    poisoner: ['🧪 독을 쓸 사람을 고르세요', '그 사람은 오늘 밤과 내일 낮 동안 능력이 듣지 않고 거짓 정보를 받아요.'],
    demon: ['🩸 습격할 사람을 고르세요', '자신을 고르면 스스로 쓰러지고, 하수인 한 명이 새 피의 군주가 돼요.'],
    butler: ['🎩 주인으로 모실 사람을 고르세요', '내일 낮 투표에서는 주인이 먼저 찬성했을 때만 찬성할 수 있어요.'],
    raven: ['🐦‍⬛ 당신은 습격을 당했어요. 마지막으로 한 사람을 고르세요', '고른 사람의 직업을 알 수 있어요. (시간 안에 고르지 않으면 정보는 없어요)'],
  };

  function chips(list, selected, attr, disabledIds = []) {
    return `<div class="vg-chips">${list.map((s) => `<button class="vg-chip${selected.includes(s.id) ? ' on' : ''}" ${attr}="${esc(s.id)}" ${disabledIds.includes(s.id) ? 'disabled' : ''}>${s.alive ? '' : '💀 '}${esc(s.avatar)} ${esc(s.name)}</button>`).join('')}</div>`;
  }

  function renderAction() {
    const { S, G } = cur;
    const el = $('#vg-action');
    const me = G.me;
    if (G.phase === 'ended') { el.hidden = true; sigAction = ''; return; }
    el.hidden = false;
    const sig = [G.phase, G.nightStage, G.day, G.night, G.dayPhase, me && me.alive, me && me.prompt && `${me.prompt.role}${me.prompt.kind}${me.prompt.submitted}`, me && me.master, me && me.canNominate, me && me.passed, me && me.skipped, G.skipCount, G.need, G.vote ? 1 : 0, me && me.canShoot, aliveSeats().map((s) => s.id).join(',')].join('|');
    if (sig === sigAction) return;
    sigAction = sig;
    pick = []; nomSel = null;
    if (!me) { el.innerHTML = '<p class="hint">관전 중이에요. 채팅으로 함께 구경하세요.</p>'; return; }
    let html = '';
    const prompt = G.phase === 'night' ? me.prompt : null;
    if (prompt && !prompt.submitted) {
      const [t, h] = NIGHT_TITLE[prompt.role];
      const list = G.seats.filter((s) => !s.left && (prompt.pool === 'any' || s.alive) && (prompt.self || s.id !== S.you));
      html = `<h3>${esc(t)}</h3><p class="hint">${esc(h)}</p>${chips(list, [], 'data-pick')}<button class="btn primary big" id="vg-confirm" disabled>선택 완료</button><div class="err" id="vg-err"></div>`;
    } else if (!me.alive) {
      html = `<h3>💀 죽은 사람이에요</h3><p class="hint">낮의 투표에는 단 한 번(찬성할 때만 소모) 참여할 수 있어요. 채팅으로 조용히 힌트를 주거나, 구경하세요. ${me.ghost ? '유령표가 남아 있어요.' : '유령표는 이미 썼어요.'}</p>`;
    } else if (G.phase === 'night') {
      const pr = me.prompt;
      if (pr && pr.submitted) {
        html = `<h3>✅ 선택 완료</h3><p class="hint">${pr.targets.map((id) => (seatById(id) ? esc(seatById(id).name) : '?')).join(', ')} — 아침을 기다려요. 결과는 ‘내 정보 기록’에 남아요.</p>`;
      } else {
        html = '<h3>🌙 밤이 깊었어요</h3><p class="hint">눈을 감고 기다리세요. 능력이 있든 없든 모두 같은 화면이에요. 정보는 아침에 ‘내 정보 기록’에 도착해요.</p>';
      }
    } else if (G.dayPhase === 'talk') {
      html = `<h3>💬 토론 중</h3><p class="hint">채팅으로 정보를 나누고 서로를 의심해 보세요. 토론을 끝내자는 사람이 과반이면 바로 지목 단계로 넘어가요.</p><button class="btn ${me.skipped ? '' : 'primary'}" id="vg-skip">${me.skipped ? '✋ 토론 끝내기 취소' : '✋ 토론 끝내기'} (${G.skipCount}/${G.need})</button>`;
    } else if (G.vote) {
      html = '<h3>🗳 투표가 진행 중이에요</h3><p class="hint">위쪽 투표 창에서 찬성/반대를 눌러 주세요.</p>';
    } else if (me.canNominate) {
      const list = aliveSeats().filter((s) => s.id !== S.you && !s.wasNominated);
      html = `<h3>👉 지목하기</h3><p class="hint">한 사람당 하루에 한 번만 지목할 수 있어요. 지목당한 사람은 하루에 한 번만 투표 대상이 돼요.</p>${chips(list, [], 'data-nom')}<button class="btn primary big" id="vg-nominate" disabled>지목하고 투표 열기</button><div class="err" id="vg-err"></div>`;
    } else {
      html = `<h3>🗳 지목 단계</h3><p class="hint">${me.passed ? '오늘은 더 지목하지 않기로 했어요. 다른 사람들을 기다려요.' : '오늘은 이미 지목했어요. 다른 사람들을 기다려요.'}</p>`;
    }
    if (me.alive && G.phase === 'day' && me.canNominate) html += `<button class="btn" id="vg-pass">오늘은 더 지목하지 않을게요</button>`;
    if (G.phase === 'day' && me.master && seatById(me.master)) html += `<p class="hint">🎩 오늘의 내 주인: ${esc(seatById(me.master).name)} — 주인이 먼저 찬성한 뒤에만 찬성할 수 있어요. (반대는 언제든 가능해요)</p>`;
    if (me.canShoot && !G.vote) html += '<button class="btn danger" id="vg-shoot">🏹 사냥꾼의 화살 쏘기 (한 번뿐)</button>';
    el.innerHTML = html;

    const confirm = $('#vg-confirm');
    if (confirm) {
      const need = prompt.kind === 'two' ? 2 : 1;
      $$('[data-pick]').forEach((b) => {
        b.onclick = () => {
          const id = b.dataset.pick;
          pick = pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id].slice(-need);
          $$('[data-pick]').forEach((x) => x.classList.toggle('on', pick.includes(x.dataset.pick)));
          confirm.disabled = pick.length !== need;
        };
      });
      confirm.onclick = async () => {
        const r = await ctx.act('night', { targets: pick });
        if (!r || !r.ok) $('#vg-err').textContent = (r && r.error) || '보내지 못했어요.';
      };
    }
    const nom = $('#vg-nominate');
    if (nom) {
      $$('[data-nom]').forEach((b) => {
        b.onclick = () => {
          nomSel = b.dataset.nom;
          $$('[data-nom]').forEach((x) => x.classList.toggle('on', x.dataset.nom === nomSel));
          nom.disabled = false;
        };
      });
      nom.onclick = async () => {
        const r = await ctx.act('nominate', { target: nomSel });
        if (!r || !r.ok) $('#vg-err').textContent = (r && r.error) || '지목하지 못했어요.';
      };
    }
    if ($('#vg-pass')) $('#vg-pass').onclick = async () => { const r = await ctx.act('pass_nom'); if (r && !r.ok) ctx.toast(r.error); };
    if ($('#vg-skip')) $('#vg-skip').onclick = async () => { const r = await ctx.act('skip_talk'); if (r && !r.ok) ctx.toast(r.error); };
    if ($('#vg-shoot')) $('#vg-shoot').onclick = () => { modal = 'shoot'; shootSel = null; renderModal(); };
  }

  /* ───────── 마을 사람들 / 기록 / 일지 ───────── */
  function renderSeats() {
    const { S, G } = cur;
    const sig = JSON.stringify([G.seats.map((s) => [s.id, s.name, s.alive, s.ghost, s.left, s.wasNominated, s.nominatedToday]), G.block, G.phase]);
    if (sig === sigSeats) return;
    sigSeats = sig;
    $('#vg-seats').innerHTML = G.seats.map((s, i) => {
      const tags = [];
      if (s.left) tags.push('🚪 떠남');
      else if (!s.alive) tags.push(`💀 죽음${s.ghost ? ' · 🗳 유령표' : ''}`);
      if (G.block && G.block.id === s.id) tags.push(`⚖️ 처형 대상(${G.block.votes}표)`);
      if (G.phase === 'day' && s.alive && s.wasNominated) tags.push('지목당함');
      if (G.phase === 'day' && s.alive && s.nominatedToday) tags.push('지목함');
      return `<div class="vg-seat${s.alive ? '' : ' dead'}${G.block && G.block.id === s.id ? ' block' : ''}${s.id === S.you ? ' me' : ''}"><span>${i + 1}. ${col(s)}${s.id === S.you ? ' (나)' : ''}</span><small>${tags.join(' · ') || (s.alive ? '살아 있음' : '')}</small></div>`;
    }).join('');
  }

  function renderNotes() {
    const { G } = cur;
    const me = G.me;
    const notes = me ? me.notes : [];
    const sig = JSON.stringify(notes);
    if (sig === sigNotes) return;
    sigNotes = sig;
    if (notes.length > noteCount && noteCount >= 0) ctx.toast('🔔 새 정보가 도착했어요. (내 정보 기록)');
    noteCount = notes.length;
    $('#vg-notes').innerHTML = notes.length ? notes.map((n) => `<div class="vg-note"><i>${n.n}번째 밤</i>${esc(n.text)}</div>`).join('') : '<div class="hint">아직 받은 정보가 없어요. 정보는 밤이 지난 아침에 이곳에 쌓여요. 꼭 기억해 두세요!</div>';
  }

  function renderLog() {
    const { G } = cur;
    const sig = String(G.log.length) + (G.log.length ? G.log[G.log.length - 1].t : '');
    if (sig === sigLog) return;
    sigLog = sig;
    const el = $('#vg-log');
    el.innerHTML = G.log.map((l) => `<div>${esc(l.text)}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  /* ───────── 귓속말 ───────── */
  function renderWhisper() {
    const { S, G } = cur;
    const card = $('#vg-whisper');
    const me = G.me;
    if (!me) { card.hidden = true; return; }
    card.hidden = G.phase === 'ended';
    if (G.phase === 'ended') return;
    const day = G.phase === 'day';
    const partners = G.seats.filter((s) => !s.left && s.id !== S.you);
    if (wTarget && !partners.some((p) => p.id === wTarget)) wTarget = null;
    const incoming = (pid) => G.whispers.filter((w) => w.from === pid).length;
    const total = G.whispers.filter((w) => w.to === S.you).length;
    if (total > wIncoming && wIncoming >= 0) {
      const last = [...G.whispers].reverse().find((w) => w.to === S.you);
      if (last && last.from !== wTarget) { const who = seatById(last.from); ctx.toast(`🤫 ${who ? who.name : '누군가'}님의 귓속말이 도착했어요`); }
    }
    wIncoming = total;
    if (wTarget) wSeen[wTarget] = incoming(wTarget);
    const sig = JSON.stringify([day, wTarget, partners.map((p) => [p.id, p.name, p.alive]), G.whispers.length, G.whispers.length ? G.whispers[G.whispers.length - 1].t : 0, partners.map((p) => incoming(p.id) - (wSeen[p.id] || 0))]);
    if (sig !== sigWhisper) {
      sigWhisper = sig;
      $('#vg-wchips').innerHTML = partners.map((p) => {
        const unread = incoming(p.id) - (wSeen[p.id] || 0);
        return `<button class="vg-chip${p.id === wTarget ? ' on' : ''}" data-w="${esc(p.id)}">${p.alive ? '' : '💀 '}${esc(p.avatar)} ${esc(p.name)}${unread > 0 ? `<i>${unread}</i>` : ''}</button>`;
      }).join('');
      const msgs = wTarget ? G.whispers.filter((w) => w.from === wTarget || w.to === wTarget) : [];
      $('#vg-wthread').innerHTML = wTarget
        ? (msgs.length ? msgs.map((w) => `<div class="vg-wm${w.from === S.you ? ' me' : ''}">${esc(w.text)}</div>`).join('') : '<div class="hint">아직 주고받은 이야기가 없어요.</div>')
        : '<div class="hint">귓속말을 나눌 사람을 골라 보세요.</div>';
      $('#vg-wthread').scrollTop = $('#vg-wthread').scrollHeight;
      $$('[data-w]').forEach((b) => { b.onclick = () => { wTarget = b.dataset.w; sigWhisper = ''; renderWhisper(); if ($('#vg-winput') && day) $('#vg-winput').focus(); }; });
    }
    $('#vg-winput').disabled = !day;
    $('#vg-wsend').disabled = !day;
    $('#vg-winput').placeholder = day ? (wTarget ? '귓속말 내용' : '먼저 보낼 사람을 골라 주세요') : '귓속말은 낮에만 보낼 수 있어요';
  }

  /* ───────── 투표 창 (위쪽 고정) ───────── */
  function renderVote() {
    const { S, G } = cur;
    const bar = ctx.bar();
    const v = G.vote;
    if (!v) { if (sigVote) { bar.innerHTML = ''; sigVote = ''; } return; }
    const compact = ctx.view() === 'chat';
    const me = G.me;
    const eligible = me && v.eligible.includes(S.you) && v.votes[S.you] === undefined;
    const sig = JSON.stringify([v, compact, eligible, me && me.alive]);
    if (sig === sigVote) return;
    sigVote = sig;
    const nominator = seatById(v.nominatorId), nominee = seatById(v.nomineeId);
    const yes = v.eligible.filter((id) => v.votes[id] === true).length;
    const rows = v.eligible.map((id) => {
      const s = seatById(id);
      const val = v.votes[id];
      return `<span>${s ? col(s) : '?'}${s && !s.alive ? '👻' : ''} ${val === true ? '👍' : val === false ? '👎' : '…'}</span>`;
    }).join('');
    const ghostNote = me && !me.alive ? '👻 유령표: 찬성하면 소모돼요' : (me && me.master ? '🎩 하인: 주인이 찬성한 뒤에만 찬성할 수 있어요' : '');
    bar.innerHTML = `<div class="vg-vbar">
      <div class="vg-vtop"><b>🗳 ${nominator ? col(nominator) : '?'}님이 ${nominee ? col(nominee) : '?'}님을 지목! 처형할까요? <span class="hint">(찬성 ${yes}표 · 필요 ${G.need}표)</span></b><span class="vg-vt" id="vg-vt"></span></div>
      ${compact ? '' : `<div class="vg-vrows">${rows}</div>`}
      <div class="vg-vbtns">${eligible ? '<button class="btn small primary" data-vote="1">👍 처형 찬성</button><button class="btn small danger" data-vote="0">👎 반대</button>' : `<span class="hint">${me ? '투표했어요' : '관전 중'}</span>`}
        ${ghostNote ? `<span class="hint">${ghostNote}</span>` : ''}${compact ? '' : '<button class="btn small" id="vg-vchat">💬 채팅으로 토론</button>'}</div></div>`;
    $$('[data-vote]').forEach((b) => {
      b.onclick = async () => { const r = await ctx.act('vote', { agree: b.dataset.vote === '1' }); if (r && !r.ok) ctx.toast(r.error); };
    });
    if ($('#vg-vchat')) $('#vg-vchat').onclick = () => ctx.openChat();
    tick();
  }

  /* ───────── 결과 ───────── */
  function renderResult() {
    const { S, G } = cur;
    const el = $('#vg-result');
    if (G.phase !== 'ended') { el.innerHTML = ''; sigResult = ''; return; }
    const r = G.result;
    const sig = `${S.gameNo}|${JSON.stringify(r)}`;
    if (sig === sigResult) return;
    sigResult = sig;
    const head = r.winner === 'town' ? '<h2 class="win-t">🌅 마을 승리!</h2>' : '<h2 class="win-e">🩸 악의 승리!</h2>';
    const rows = r.players.map((p) => {
      const role = G.roles[p.role];
      const fake = (p.fake ? ` <span class="hint">(자신은 ${esc(G.roles[p.fake].name)}인 줄 알았어요)</span>` : '') + (p.orig ? ` <span class="hint">(처음엔 ${esc(G.roles[p.orig].emoji)} ${esc(G.roles[p.orig].name)})</span>` : '');
      return `<div class="vg-rrow">${col(p)}<span>${esc(role.emoji)} ${esc(role.name)}</span>${fake}${p.alive ? '' : '<span class="tag">죽음</span>'}${p.left ? '<span class="tag">이탈</span>' : ''}<span class="g">${p.gain ? `+${p.gain}` : ''}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="card vg-res">${head}<div>${esc(r.reason)}</div><p class="hint">이긴 팀: ${r.players.filter((p) => p.win).map((p) => esc(p.name)).join(', ')}${r.noScore ? ' · 중단된 판이라 점수는 없어요' : ''}</p><div>${rows}</div><p class="hint">아래 버튼으로 같은 게임을 다시 하거나, 게임을 바꿀 수 있어요.</p></div>`;
    ctx.toast(r.winner === 'town' ? '🌅 마을이 승리했어요!' : '🩸 악이 승리했어요!');
  }

  /* ───────── 팝업 (사냥꾼 / 직업 도감) ───────── */
  function renderModal() {
    const root = $('#vg-modal');
    if (!modal) { root.innerHTML = ''; return; }
    const { S, G } = cur;
    if (modal === 'shoot') {
      const list = aliveSeats().filter((s) => s.id !== S.you);
      root.innerHTML = `<div class="vg-mback"><div class="vg-mbox"><h3>🏹 누구를 쏠까요?</h3><p class="hint">악마라면 그 자리에서 쓰러져요. 아니라면 화살만 잃어요. 단 한 번뿐이에요.</p>${chips(list, shootSel ? [shootSel] : [], 'data-shoot')}<div class="err" id="vg-merr"></div><div class="actions"><button class="btn" id="vg-mcancel">취소</button><button class="btn danger" id="vg-mgo">쏘기</button></div></div></div>`;
      $$('[data-shoot]').forEach((b) => { b.onclick = () => { shootSel = b.dataset.shoot; renderModal(); }; });
      $('#vg-mgo').onclick = async () => {
        if (!shootSel) { $('#vg-merr').textContent = '쏠 사람을 골라 주세요.'; return; }
        const r = await ctx.act('shoot', { target: shootSel });
        if (!r || !r.ok) { $('#vg-merr').textContent = (r && r.error) || '쏘지 못했어요.'; return; }
        modal = null; renderModal();
      };
    } else {
      const groups = [['town', '🟢 마을 사람'], ['out', '🟡 외부인 (마을 편이지만 골칫거리)'], ['minion', '🔴 하수인 (악)'], ['demon', '🩸 악마 (악)']];
      const c = G.counts;
      root.innerHTML = `<div class="vg-mback"><div class="vg-mbox vg-guide"><h3>📖 직업 도감</h3>
        <p class="hint">이번 판 구성: 마을 사람 ${c.town}명 · 외부인 ${c.out}명 · 하수인 ${c.minion}명 · 악마 1명 (누가 무슨 직업인지는 비밀이에요)</p>
        ${groups.map(([t, label]) => `<h4>${label}</h4>${Object.values(G.roles).filter((r) => r.team === t).map((r) => `<p><b>${esc(r.emoji)} ${esc(r.name)}</b> — ${esc(r.desc)}</p>`).join('')}`).join('')}
        <div class="actions"><button class="btn primary" id="vg-mcancel">닫기</button></div></div></div>`;
    }
    $('#vg-mcancel').onclick = () => { modal = null; renderModal(); };
  }

  function tick() {
    if (!cur) return;
    const { G } = cur;
    const t = $('#vg-timer');
    if (t && G.endsAt) t.textContent = fmt(G.endsAt - ctx.now());
    if (G.vote) { const vt = $('#vg-vt'); if (vt) vt.textContent = `${fmt(G.vote.endsAt - ctx.now())}`; }
  }

  window.GAME_UI.village = {
    mount(c) {
      ctx = c;
      cur = null;
      roleOpen = false; pick = []; nomSel = null; modal = null; shootSel = null; noteCount = -1;
      wTarget = null; wSeen = {}; sigWhisper = ''; wIncoming = -1;
      sigHead = sigRole = sigAction = sigSeats = sigNotes = sigLog = sigVote = sigResult = '';
      ctx.host().innerHTML = TEMPLATE;
      $('#vg-guide').onclick = () => { modal = 'guide'; renderModal(); };
      $('#vg-wsend').onclick = async () => {
        const text = $('#vg-winput').value.trim();
        if (!wTarget) { $('#vg-wnote').textContent = '귓속말을 보낼 사람을 먼저 골라 주세요.'; return; }
        if (!text) return;
        const r = await ctx.act('whisper', { to: wTarget, text });
        if (!r || !r.ok) { $('#vg-wnote').textContent = (r && r.error) || '보내지 못했어요.'; return; }
        $('#vg-winput').value = ''; $('#vg-wnote').textContent = '';
      };
      $('#vg-winput').onkeydown = (e) => { if (e.key === 'Enter') $('#vg-wsend').onclick(); };
      clearInterval(timer);
      timer = setInterval(tick, 500);
    },
    update(S, G) {
      cur = { S, G };
      renderHead();
      renderRole();
      renderAction();
      renderWhisper();
      renderSeats();
      renderNotes();
      renderLog();
      renderVote();
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
