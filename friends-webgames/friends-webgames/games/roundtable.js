'use strict';
/**
 * 원탁 회의 (코드 이름: roundtable) - 5~10인 정체 추리 게임 (플러그인)
 *
 * 아발론 계열 게임의 뼈대(원정 팀 구성 → 공개 투표 → 비밀 임무 카드 → 암살)를 따르되 이름과 설정은 새로 만들었어요.
 *  - 선 3명(예언자·수호자·충신) vs 악 2명(위장자·암살자). 원정(임무)은 5번, 팀 인원은 2·3·2·3·3명이에요.
 *  - 임무 3번 성공 → 선이 이기지만, 암살자가 예언자를 맞히면 악이 역전승해요.
 *  - 임무 3번 실패, 또는 팀 투표가 연달아 5번 부결되면 악이 바로 이겨요.
 * 투표에만 5분 제한이 있고(안 고른 사람은 찬성), 나머지는 제한 시간이 없어요. 모두가 끝내면 바로 넘어가요.
 */
const { shuffle } = require('./util');

const VERSION = 5;   // 서버 파일과 화면 파일의 짝을 맞추는 번호예요

const CFG = {
  MIN: 5,
  MAX: 10,
  // 인원별 구성 (원작 아발론 표): sizes = 원정 1~5번 팀 인원, roles = 역할 목록
  TABLE: {
    5:  { sizes: [2, 3, 2, 3, 3], roles: ['merlin', 'percival', 'servant', 'morgana', 'assassin'] },
    6:  { sizes: [2, 3, 4, 3, 4], roles: ['merlin', 'percival', 'servant', 'servant', 'morgana', 'assassin'] },
    7:  { sizes: [2, 3, 3, 4, 4], roles: ['merlin', 'percival', 'servant', 'servant', 'morgana', 'assassin', 'oberon'] },
    8:  { sizes: [3, 4, 4, 5, 5], roles: ['merlin', 'percival', 'servant', 'servant', 'servant', 'morgana', 'assassin', 'minion'] },
    9:  { sizes: [3, 4, 4, 5, 5], roles: ['merlin', 'percival', 'servant', 'servant', 'servant', 'servant', 'mordred', 'morgana', 'assassin'] },
    10: { sizes: [3, 4, 4, 5, 5], roles: ['merlin', 'percival', 'servant', 'servant', 'servant', 'servant', 'mordred', 'morgana', 'assassin', 'oberon'] },
  },
  twoFailRound: 4,                // 7명 이상에서 이 원정은 실패 카드 2장이 있어야 실패
  twoFailFrom: 7,
  WIN: 3,                         // 먼저 이 수만큼 성공/실패하면 끝
  MAX_REJECT: 5,                  // 연속 부결 한도
  get VOTE_MS() { const n = Number(process.env.ROUNDTABLE_VOTE_MS); return n > 0 ? n : 5 * 60 * 1000; },   // 투표 제한 시간 (기본 5분, 안 고른 사람은 찬성)
  get REVEAL_MS() { const n = Number(process.env.ROUNDTABLE_REVEAL_MS); return n >= 0 && process.env.ROUNDTABLE_REVEAL_MS !== undefined && process.env.ROUNDTABLE_REVEAL_MS !== '' ? n : 5000; },   // 투표 공개 연출 시간
  get CARD_REVEAL_MS() { const n = Number(process.env.ROUNDTABLE_REVEAL_MS); return n >= 0 && process.env.ROUNDTABLE_REVEAL_MS !== undefined && process.env.ROUNDTABLE_REVEAL_MS !== '' ? n : 6500; },   // 원정 카드 공개 연출 시간
  skipNeed(n) { return Math.floor(n / 2) + 1; },   // 과반이 스킵을 누르면 토론/팀 구성이 바로 넘어가요
  SCORE_WIN: 1,
  TALK_MAX: 100,
  TALK_KEEP: 80,
  get TALK_GAP_MS() { const n = process.env.ROUNDTABLE_TALK_GAP_MS; return n !== undefined && n !== '' && Number.isFinite(Number(n)) ? Number(n) : 400; },
  // 테스트용: 역할 순서 (좌석 순서대로) 예: "merlin,percival,servant,morgana,assassin" 와 시작 대장 번호
  get FORCE() { try { return process.env.ROUNDTABLE_FORCE ? JSON.parse(process.env.ROUNDTABLE_FORCE) : null; } catch (e) { return null; } },
};

const ROLES = {
  merlin:   { name: '예언자', emoji: '🔮', team: 'good', brief: '악당들을 알아요', desc: '악한 편이 누군지 알아요. 하지만 들키면 암살당하니 티 내지 말고 선을 이끌어야 해요.' },
  percival: { name: '수호자', emoji: '🛡️', team: 'good', brief: '예언자 후보 두 명을 봐요', desc: '예언자 후보 두 명을 봐요. 한 명은 진짜 예언자, 한 명은 위장자예요. 누가 진짜인지는 몰라요.' },
  servant:  { name: '충신', emoji: '🧑‍🌾', team: 'good', brief: '능력 없음, 추리만!', desc: '아무 정보가 없어요. 토론과 투표 기록으로 악당을 가려내요.' },
  morgana:  { name: '위장자', emoji: '🎭', team: 'evil', brief: '수호자에게 예언자처럼 보여요', desc: '수호자에게 예언자인 척 보여요. 동료 악당이 누군지 알아요.' },
  mordred:  { name: '그림자', emoji: '🕶️', team: 'evil', brief: '예언자에게 안 보이는 악당', desc: '예언자 눈에 보이지 않는 악당이에요. 동료 악당이 누군지 알아요. 예언자가 당신을 선이라고 믿게 만드세요.' },
  oberon:   { name: '외톨이 밀정', emoji: '🐺', team: 'evil', brief: '동료를 모르는 악당', desc: '혼자 움직이는 악당이에요. 동료가 누군지 모르고, 동료도 당신을 몰라요. 예언자에게는 보여요. 원정에서 실패 카드를 낼 수 있어요.' },
  minion:   { name: '밀정', emoji: '🕵️', team: 'evil', brief: '평범한 악당', desc: '평범한 악당이에요. 동료 악당이 누군지 알아요.' },
  assassin: { name: '암살자', emoji: '🗡️', team: 'evil', brief: '선이 이기면 예언자를 암살!', desc: '동료 악당이 누군지 알아요. 선이 임무 3번을 성공시켜도 예언자를 맞히면 역전승해요.' },
};
const TEAMNAME = { good: '선(원탁의 기사단)', evil: '악(밀정)' };

const HELP = {
  summary: [
    '🏰 **5~10명**이 **선과 악**으로 나뉘어요. (5명 3:2 · 6명 4:2 · 7명 4:3 · 8명 5:3 · 9명 6:3 · 10명 6:4) 역할은 비밀이에요. 5번의 원정(임무) 중 먼저 **3번 성공**하면 선, **3번 실패**하면 악이 이겨요.',
    '🗳️ 원정 팀은 **대장이 고르고, 전원이 공개 투표**로 승인해요. 승인된 팀원만 비밀 카드를 내요. **실패 카드가 나오면 원정 실패!** (7명 이상은 4번 원정만 2장)',
    '🗡️ 선이 3번 성공해도 **암살자가 예언자를 맞히면 악의 역전승**이에요. 팀 투표가 **연달아 5번 부결**되면 악이 바로 이겨요.',
  ],
  sections: [
    { title: '진행 방법 (원정 한 번)', lines: [
      '**대장**이 돌아가며 맡아요. 대장이 원정 인원수만큼 팀원을 골라요. (자기 자신도 가능)',
      '**토론**: 자유롭게 말해요. **과반**이 `스킵`을 누르면 바로 투표로 넘어가요.',
      '**공개 투표**: 전원이 동시에 찬성/반대를 골라요. 다 고르면 **누가 뭘 눌렀는지 모두 공개**돼요. **찬성이 반대보다 많으면** 승인! (동수는 부결)',
      '**부결**되면 다음 사람이 대장이 되어 다시 팀을 골라요. 연달아 5번 부결되면 악이 이겨요.',
      '**승인**되면 팀원만 비밀 카드를 내요. 선은 `성공`만 낼 수 있고, 악은 `성공` 또는 `실패`를 골라요. 카드는 섞여서 **실패 카드 수만** 공개돼요.',
    ] },
    { title: '원정 인원과 승리 조건', lines: [
      '원정 1~5번의 팀 인원: **5명 2·3·2·3·3 / 6명 2·3·4·3·4 / 7명 2·3·3·4·4 / 8~10명 3·4·4·5·5**',
      '실패 카드가 **1장만 있어도** 그 원정은 실패예요. 단, **7명 이상일 때 4번 원정은 실패 카드가 2장** 있어야 실패예요.',
      '먼저 3번 성공 → 선이 우세, 이어서 **암살 단계**. 먼저 3번 실패 → 악 승리.',
      '**암살 단계**: 암살자가 한 명을 지목해요. 예언자를 맞히면 악의 역전승, 빗나가면 선의 승리예요.',
    ] },
    { title: '인원별 역할', lines: [
      '5명: 예언자·수호자·충신 / 위장자·암살자',
      '6명: 충신 +1',
      '7명: 악에 **외톨이 밀정** 추가 (동료를 서로 몰라요)',
      '8명: 충신 +1, 악에 평범한 **밀정** 추가',
      '9명: 충신 +1, 밀정 대신 **그림자** (예언자에게 안 보여요)',
      '10명: 외톨이 밀정 추가',
    ] },
    { title: '진행과 스킵', lines: [
      '**투표에는 5분 제한**이 있어요. 시간 안에 안 고른 사람은 **찬성**으로 처리돼요. 다른 단계는 제한 시간이 없고, 모두가 끝내면 바로 넘어가요. (투표 공개와 원정 카드 공개 연출은 5~6초)',
      '대장이 팀을 안 골라 주면 **과반이 화면 위의 `스킵`**을 눌러 팀을 자동으로 구성할 수 있어요. 토론도 과반이 `스킵`하면 바로 투표로 넘어가요.',
      '임무 카드는 **원정대원 전원이 낼 때까지** 기다려요.',
      '게임 중에 한 명이라도 나가면 게임이 중단돼요. (점수 없음)',
    ] },
  ],
  groups: [{
    title: '역할',
    items: Object.entries(ROLES).map(([id, r], i) => ({ badge: String(i + 1), emoji: r.emoji, title: r.name, sub: r.team === 'good' ? '선' : '악', color: r.team === 'good' ? '#38bdf8' : '#f43f5e', text: r.desc, example: '', tip: '' })),
  }],
};

module.exports = {
  id: 'roundtable',
  name: '원탁 회의',
  emoji: '🏰',
  accent: '#f59e0b',
  desc: '5~10명이 원정을 떠나요. 이 중 일부는 몰래 방해하는 밀정! 토론하고 투표하며 정체를 가려내요.',
  rules: [
    '5~10명이 선과 악으로 나뉘고, 역할은 비밀이에요. 원정 5번 중 먼저 3번 성공하면 선, 3번 실패하면 악이 이겨요.',
    '대장이 팀을 고르고 전원이 공개 투표로 승인해요. 연달아 5번 부결되면 악이 이겨요.',
    '승인된 팀원만 비밀 카드를 내요. 실패 카드가 나오면 원정 실패예요. (7명 이상은 4번 원정만 2장)',
    '선이 3번 성공해도 암살자가 예언자를 맞히면 악이 역전승해요.',
    '투표에만 5분 제한이 있고(안 고르면 찬성), 나머지는 다들 끝내면 바로 넘어가요. 늦는 사람이 있으면 과반 스킵으로 토론/팀 구성을 넘길 수 있어요.',
  ],
  min: CFG.MIN,
  max: CFG.MAX,
  help: HELP,

  create(api) {
    const later = (g, ms, fn) => { const h = setTimeout(fn, ms); g.timers.add(h); return h; };
    const clearTimers = (g) => { g.timers.forEach((h) => clearTimeout(h)); g.timers.clear(); };
    const seatOf = (g, id) => g.seats.find((s) => s.id === id);
    const active = (g) => g.seats.filter((s) => !s.left);
    const pub = (g, text) => { g.log.push({ t: Date.now(), text }); if (g.log.length > 80) g.log.shift(); };
    const setLast = (g, text) => { g.last = { seq: ++g.eventSeq, text }; };
    const isEvil = (s) => ROLES[s.role].team === 'evil';

    function start(room, gamers) {
      const f = CFG.FORCE;
      const n = gamers.length;
      const setup = CFG.TABLE[n];
      const roles = f && Array.isArray(f.roles) ? f.roles.slice(0, n) : shuffle(setup.roles.slice());
      const g = (room.g = {
        phase: 'team', round: 1, rejects: 0, quests: setup.sizes.map((size, i) => ({ size, need: (i + 1 === CFG.twoFailRound && n >= CFG.twoFailFrom) ? 2 : 1, result: null, fails: 0 })),
        seats: gamers.map((p, i) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, left: false, role: roles[i], vote: null, card: null, skip: false })),
        leader: f && Number.isInteger(f.leader) ? f.leader : Math.floor(Math.random() * gamers.length),
        team: [], endsAt: 0, talk: [], lastTalk: {}, history: [], log: [], last: null, result: null, timers: new Set(), eventSeq: 0, seq: 0,
        peek: null,
      });
      // 비밀 정보 (역할마다 볼 수 있는 사람)
      const merlin = g.seats.find((s) => s.role === 'merlin');
      const morgana = g.seats.find((s) => s.role === 'morgana');
      g.peek = {};
      g.seats.forEach((s) => {
        if (s.role === 'merlin') g.peek[s.id] = { label: '악당', ids: g.seats.filter((x) => isEvil(x) && x.role !== 'mordred').map((x) => x.id) };
        else if (s.role === 'percival') g.peek[s.id] = { label: '예언자 후보 (한 명은 가짜!)', ids: shuffle([merlin.id, morgana.id]) };
        else if (s.role === 'oberon') g.peek[s.id] = { label: '', ids: [] };
        else if (isEvil(s)) g.peek[s.id] = { label: '동료 악당', ids: g.seats.filter((x) => isEvil(x) && x.role !== 'oberon' && x.id !== s.id).map((x) => x.id) };
        else g.peek[s.id] = { label: '', ids: [] };
      });
      pub(g, '🏰 원탁 회의를 시작해요! 내 정보를 확인하세요.');
      beginTeam(room);
    }

    function leaderSeat(g) { return g.seats[g.leader]; }

    function beginTeam(room) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'team';
      g.team = [];
      g.seats.forEach((s) => { s.vote = null; s.card = null; s.skip = false; });
      g.endsAt = 0;   // 제한 시간 없음
      setLast(g, `👑 ${leaderSeat(g).name}님이 ${g.quests[g.round - 1].size}명의 원정대를 골라요.`);
      api.broadcast(room);
    }

    function autoTeam(room) {
      const g = room.g;
      if (!g || g.phase !== 'team') return;
      const size = g.quests[g.round - 1].size;
      const ids = [leaderSeat(g).id].concat(shuffle(g.seats.filter((s) => s !== leaderSeat(g)).map((s) => s.id))).slice(0, size);
      pub(g, '⏭️ 스킵 과반으로 팀이 자동 구성됐어요.');
      setTeam(room, ids);
    }

    function setTeam(room, ids) {
      const g = room.g;
      clearTimers(g);
      g.team = ids.slice();
      g.phase = 'talk';
      g.seats.forEach((s) => { s.skip = false; });
      g.endsAt = 0;   // 제한 시간 없음
      setLast(g, `📋 원정대: ${ids.map((id) => seatOf(g, id).name).join(', ')} — 토론해 보세요.`);
      pub(g, `📋 ${g.round}번 원정 (제안 ${g.rejects + 1}회) 대장 ${leaderSeat(g).name}: ${ids.map((id) => seatOf(g, id).name).join(', ')}`);
      api.broadcast(room);
    }

    function beginVote(room) {
      const g = room.g;
      if (!g || g.phase !== 'talk') return;
      clearTimers(g);
      g.phase = 'vote';
      g.seats.forEach((s) => { s.vote = null; });
      g.endsAt = Date.now() + CFG.VOTE_MS;
      later(g, CFG.VOTE_MS, () => resolveVote(room));
      setLast(g, '🗳️ 이 팀을 승인할까요? 전원이 고르면 한꺼번에 공개돼요.');
      api.broadcast(room);
    }

    function resolveVote(room) {
      const g = room.g;
      if (!g || g.phase !== 'vote') return;
      clearTimers(g);
      const votes = {};
      g.seats.forEach((s) => { if (!s.left) votes[s.id] = s.vote || 'yes'; });
      const yes = Object.values(votes).filter((v) => v === 'yes').length;
      const no = Object.values(votes).length - yes;
      const approved = yes > no;
      g.history.push({ round: g.round, attempt: g.rejects + 1, leader: leaderSeat(g).id, team: g.team.slice(), votes, approved, yes, no, fails: null });
      g.phase = 'voteReveal';
      g.endsAt = Date.now() + CFG.REVEAL_MS;
      if (approved) {
        setLast(g, `✅ 승인! (찬성 ${yes} : 반대 ${no}) — 원정대가 출발해요.`);
        pub(g, `✅ 팀 승인 (찬성 ${yes} : 반대 ${no})`);
        later(g, CFG.REVEAL_MS, () => {
          g.phase = 'mission';
          g.seats.forEach((s) => { s.card = null; });
          g.endsAt = 0;   // 제한 시간 없음
          api.broadcast(room);
        });
        return api.broadcast(room);
      }
      g.rejects += 1;
      setLast(g, `❌ 부결! (찬성 ${yes} : 반대 ${no}) — 연속 부결 ${g.rejects}/${CFG.MAX_REJECT}`);
      pub(g, `❌ 팀 부결 (찬성 ${yes} : 반대 ${no}) 연속 ${g.rejects}회`);
      later(g, CFG.REVEAL_MS, () => {
        if (g.rejects >= CFG.MAX_REJECT) return finish(room, 'evil', `연속 ${CFG.MAX_REJECT}번 부결되어 원정이 무산됐어요.`);
        g.leader = (g.leader + 1) % g.seats.length;
        beginTeam(room);
      });
      api.broadcast(room);
    }

    function resolveMission(room) {
      const g = room.g;
      if (!g || g.phase !== 'mission') return;
      clearTimers(g);
      const cards = g.team.map((id) => seatOf(g, id).card || 'success');
      const fails = cards.filter((c) => c === 'fail').length;
      const q = g.quests[g.round - 1];
      q.fails = fails;
      q.result = fails >= q.need ? 'fail' : 'success';
      const h = g.history[g.history.length - 1];
      h.fails = fails;
      h.ok = q.result;
      g.phase = 'missionReveal';
      g.revealCards = shuffle(cards);           // 누가 냈는지 알 수 없게 섞어서 보여 줘요
      g.endsAt = Date.now() + CFG.CARD_REVEAL_MS;
      later(g, CFG.CARD_REVEAL_MS, () => {
        g.revealCards = null;
        setLast(g, q.result === 'fail' ? `💥 ${g.round}번 원정 실패! (실패 카드 ${fails}장)` : fails ? `🌟 ${g.round}번 원정 성공! (실패 카드 ${fails}장이지만 ${q.need}장이 필요해요)` : `🌟 ${g.round}번 원정 성공!`);
        pub(g, q.result === 'fail' ? `💥 ${g.round}번 원정 실패 (실패 카드 ${fails}장)` : fails ? `🌟 ${g.round}번 원정 성공 (실패 카드 ${fails}장)` : `🌟 ${g.round}번 원정 성공`);
        const ok = g.quests.filter((x) => x.result === 'success').length;
        const ng = g.quests.filter((x) => x.result === 'fail').length;
        if (ng >= CFG.WIN) return finish(room, 'evil', '원정이 3번 실패했어요.');
        if (ok >= CFG.WIN) return beginAssassin(room);
        g.round += 1;
        g.rejects = 0;
        g.leader = (g.leader + 1) % g.seats.length;
        beginTeam(room);
      });
      api.broadcast(room);
    }

    function beginAssassin(room) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'assassin';
      g.endsAt = 0;   // 제한 시간 없음
      setLast(g, '🗡️ 선이 3번 성공했어요! 하지만 암살자가 예언자를 맞히면 악의 역전승!');
      pub(g, '🗡️ 암살 단계: 암살자가 예언자를 지목해요.');
      api.broadcast(room);
    }

    function resolveAssassin(room, targetId) {
      const g = room.g;
      if (!g || g.phase !== 'assassin') return;
      const t = targetId ? seatOf(g, targetId) : null;
      g.assassination = { target: targetId || null };
      if (t && t.role === 'merlin') return finish(room, 'evil', `암살자가 ${t.name}님을 지목했고, 그분이 예언자였어요!`);
      return finish(room, 'good', t ? `암살자가 ${t.name}님을 지목했지만 예언자가 아니었어요.` : '암살자가 시간 안에 지목하지 못했어요.');
    }

    function finish(room, winTeam, why, abort = false) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'ended';
      g.endsAt = 0;
      const gains = {};
      if (!abort) g.seats.forEach((s) => {
        if (ROLES[s.role].team === winTeam) {
          const p = room.players.find((x) => x.id === s.id);
          if (p) { api.addScore(room, p, CFG.SCORE_WIN); gains[s.id] = CFG.SCORE_WIN; }
        }
      });
      g.result = {
        abort, winTeam: abort ? null : winTeam, why,
        players: g.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, color: s.color, left: s.left, role: s.role, team: ROLES[s.role].team, win: !abort && ROLES[s.role].team === winTeam, gain: gains[s.id] || 0 })),
        assassinTarget: g.assassination ? g.assassination.target : null,
      };
      setLast(g, abort ? '🛑 게임이 중단됐어요.' : `🏆 ${TEAMNAME[winTeam]} 승리!`);
      pub(g, abort ? `🛑 게임 중단: ${why}` : `🏆 ${TEAMNAME[winTeam]} 승리! ${why}`);
      api.broadcast(room);
    }

    // 이번 판에 나온 역할에 맞춰 설명을 조금 바꿔요
    function roleDesc(g, id, r) {
      const has = (x) => g.seats.some((s) => s.role === x);
      let d = r.desc;
      if (id === 'merlin' && has('mordred')) d += ' 단, 그림자는 보이지 않아요.';
      if ((id === 'morgana' || id === 'assassin') && has('oberon')) d += ' (외톨이 밀정은 서로 몰라요.)';
      if (id === 'merlin' && has('oberon')) d += ' 외톨이 밀정도 보여요.';
      return d;
    }

    function view(room, pid) {
      const g = room.g;
      const me = seatOf(g, pid);
      const ended = g.phase === 'ended';
      const myPeek = me && g.peek ? g.peek[me.id] : null;
      const size = g.quests[Math.min(g.round, g.quests.length) - 1].size;
      return {
        ver: VERSION,
        roleCounts: g.seats.reduce((m, x) => { m[x.role] = (m[x.role] || 0) + 1; return m; }, {}),
        phase: g.phase, round: g.round, rejects: g.rejects, maxReject: CFG.MAX_REJECT, skipNeed: CFG.skipNeed(g.seats.length),
        quests: g.quests.map((q, i) => (g.phase === 'missionReveal' && i === g.round - 1 ? { size: q.size, need: q.need, result: null, fails: 0 } : { size: q.size, need: q.need, result: q.result, fails: q.fails })),
        reveal: g.phase === 'missionReveal' ? { cards: g.revealCards.slice(), fails: g.quests[g.round - 1].fails, need: g.quests[g.round - 1].need, ok: g.quests[g.round - 1].result === 'success' } : null,
        leaderId: leaderSeat(g).id, size, team: g.team.slice(), endsAt: g.endsAt,
        seats: g.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar, color: s.color, left: s.left, voted: s.vote !== null, carded: s.card !== null, skip: s.skip })),
        talk: g.talk.slice(-CFG.TALK_KEEP),
        history: g.history.map((h, i) => ({ ...h, votes: { ...h.votes }, fails: (g.phase === 'missionReveal' && i === g.history.length - 1) ? null : h.fails, ok: (g.phase === 'missionReveal' && i === g.history.length - 1) ? null : (h.ok || null), pending: g.phase === 'missionReveal' && i === g.history.length - 1 })),
        log: g.log.slice(-40),
        last: g.last,
        roles: Object.fromEntries(Object.entries(ROLES).map(([k, r]) => [k, { name: r.name, emoji: r.emoji, team: r.team, brief: r.brief, desc: roleDesc(g, k, r) }])),
        result: ended ? g.result : null,
        me: me ? {
          role: me.role, team: ROLES[me.role].team,
          peek: myPeek ? { label: myPeek.label, ids: myPeek.ids.slice() } : null,
          vote: g.phase === 'vote' ? me.vote : null,
          card: g.phase === 'mission' ? me.card : null,
          onTeam: g.team.includes(me.id),
          skip: me.skip, talkMax: CFG.TALK_MAX,
        } : null,
      };
    }

    function action(room, player, msg) {
      const g = room.g;
      if (!g) return { ok: false, error: '진행 중인 게임이 아니에요.' };
      const me = seatOf(g, player.id);
      if (!me || me.left) return { ok: false, error: '이번 판 참가자가 아니에요.' };
      if (g.phase === 'ended') return { ok: false, error: '게임이 끝났어요.' };
      switch (msg.type) {
        case 'say': {
          const text = String(msg.text == null ? '' : msg.text).replace(/\s+/g, ' ').trim().slice(0, CFG.TALK_MAX);
          if (!text) return { ok: false, error: '내용을 입력해 주세요.' };
          const now = Date.now();
          if (g.lastTalk[me.id] && now - g.lastTalk[me.id] < CFG.TALK_GAP_MS) return { ok: false, error: '너무 빨라요. 잠깐만요!' };
          g.lastTalk[me.id] = now;
          g.talk.push({ id: me.id, text, t: now, r: g.round, n: ++g.seq });
          if (g.talk.length > 200) g.talk.splice(0, g.talk.length - 200);
          api.broadcast(room);
          return { ok: true };
        }
        case 'propose': {
          if (g.phase !== 'team') return { ok: false, error: '지금은 팀을 고를 때가 아니에요.' };
          if (leaderSeat(g) !== me) return { ok: false, error: '대장만 팀을 고를 수 있어요.' };
          const ids = Array.isArray(msg.ids) ? [...new Set(msg.ids.map(String))] : [];
          const size = g.quests[g.round - 1].size;
          if (ids.length !== size) return { ok: false, error: `${size}명을 골라 주세요.` };
          if (ids.some((id) => !seatOf(g, id))) return { ok: false, error: '없는 사람이에요.' };
          setTeam(room, ids);
          return { ok: true };
        }
        case 'skip': {
          if (g.phase !== 'team' && g.phase !== 'talk') return { ok: false, error: '지금은 스킵할 수 없어요.' };
          me.skip = !me.skip;
          if (active(g).filter((s) => s.skip).length >= CFG.skipNeed(g.seats.length)) {
            if (g.phase === 'team') { pub(g, '⏭️ 스킵 과반! 팀이 자동으로 정해져요.'); autoTeam(room); } else { pub(g, '⏭️ 스킵 과반! 투표로 넘어가요.'); beginVote(room); }
          } else api.broadcast(room);
          return { ok: true };
        }
        case 'vote': {
          if (g.phase !== 'vote') return { ok: false, error: '지금은 투표 시간이 아니에요.' };
          if (msg.v !== 'yes' && msg.v !== 'no') return { ok: false, error: '찬성/반대를 골라 주세요.' };
          me.vote = msg.v;
          if (active(g).every((s) => s.vote)) resolveVote(room); else api.broadcast(room);
          return { ok: true };
        }
        case 'card': {
          if (g.phase !== 'mission') return { ok: false, error: '지금은 카드를 낼 때가 아니에요.' };
          if (!g.team.includes(me.id)) return { ok: false, error: '원정대원만 카드를 낼 수 있어요.' };
          if (msg.v !== 'success' && msg.v !== 'fail') return { ok: false, error: '카드를 골라 주세요.' };
          if (msg.v === 'fail' && !isEvil(me)) return { ok: false, error: '선한 편은 성공 카드만 낼 수 있어요.' };
          me.card = msg.v;
          if (g.team.every((id) => seatOf(g, id).card)) resolveMission(room); else api.broadcast(room);
          return { ok: true };
        }
        case 'assassinate': {
          if (g.phase !== 'assassin') return { ok: false, error: '지금은 암살 단계가 아니에요.' };
          if (me.role !== 'assassin') return { ok: false, error: '암살자만 지목할 수 있어요.' };
          const t = seatOf(g, String(msg.target));
          if (!t || t === me) return { ok: false, error: '지목할 수 없는 사람이에요.' };
          resolveAssassin(room, t.id);
          return { ok: true };
        }
        default: return { ok: false, error: '알 수 없는 동작이에요.' };
      }
    }

    function onLeave(room, player) {
      const g = room.g;
      if (!g || g.phase === 'ended') return;
      const s = seatOf(g, player.id);
      if (!s || s.left) return;
      s.left = true;
      pub(g, `🚪 ${s.name}님이 게임을 떠났어요.`);
      finish(room, null, '인원이 부족해 게임이 중단되었어요. (점수 없음)', true);
    }

    function dispose(room) {
      if (room.g) clearTimers(room.g);
      room.g = null;
    }

    return { start, view, action, onLeave, dispose, isFinished: (room) => !!room.g && room.g.phase === 'ended' };
  },
};
