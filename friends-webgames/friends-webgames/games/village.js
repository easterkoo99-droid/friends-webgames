'use strict';
/**
 * 오늘도 이 마을엔 피가 흐른다 (코드 이름: village) - 숨은 정체 추리 게임 (플러그인)
 *
 * 5~15명이 마을 편(마을 사람·외부인)과 악(악마 1명 + 하수인)으로 나뉘어요. 서버가 '이야기꾼'이 되어 밤/낮을 자동으로 진행해요.
 *  - 밤: 직업 능력을 쓰고(동시에), 악마는 둘째 밤부터 한 명을 습격해요. 결과는 아침에 알려 줘요.
 *  - 낮: 토론(귓속말 가능) → 지목 → 찬반 투표. 절반 이상 찬성을 얻은 가장 높은 득표자가 처형돼요.
 *  - 마을은 악마가 쓰러지면 승리, 악은 살아남은 사람이 2명이 되면 승리해요.
 *  - 독(독약상)이나 취함(술꾼) 때문에 정보가 거짓일 수 있고, 첩자·은둔자는 다른 사람으로 '보일' 수 있어요.
 * 직업 이름과 설명은 이 게임에서 새로 만든 것이에요. (아래 ROLES 에서 고칠 수 있어요)
 */
const { pick, shuffle, cleanText } = require('./util');

const CFG = {
  MIN: 5,
  MAX: 15,
  NIGHT_MIN_MS: 12 * 1000,   // 밤이 너무 빨리 끝나서 누가 능력자인지 티 나지 않게 하는 최소 시간
  NIGHT_MAX_MS: 75 * 1000,
  RAVEN_MS: 30 * 1000,       // 습격당한 까마귀지기가 선택할 시간
  TALK_MS: 120 * 1000,
  NOM_MS: 150 * 1000,
  VOTE_MS: 25 * 1000,
  SCORE: { win: 1 },          // 이긴 팀 전원
  // 테스트용 설정 (환경변수)
  get FORCE() { return process.env.VILLAGE_ROLES || ''; },        // 'demon,seer,drunk:mayor,...' 를 앉은 순서대로 배정
  get REG() { const v = process.env.VILLAGE_REG; return v === undefined || v === '' ? 0.5 : Number(v); },   // 첩자/은둔자가 '다른 사람으로 보일' 확률, 이장 대리 사망 확률
  get RH() { return process.env.VILLAGE_RH || ''; },               // 점쟁이의 오해 유발자 자리(번호)
};

// team: town(마을 사람) | out(외부인) | minion(하수인) | demon(악마).  town/out 은 마을 편, minion/demon 은 악
const ROLES = {
  washer:       { name: '방물장수', emoji: '🧺', team: 'town', desc: '첫 밤에, 두 사람 중 한 명이 어떤 마을 사람 직업이라는 걸 알아요. (누가 그 직업인지는 몰라요)' },
  librarian:    { name: '서당 훈장', emoji: '📚', team: 'town', desc: '첫 밤에, 두 사람 중 한 명이 어떤 외부인 직업이라는 걸 알아요. 외부인이 없으면 없다는 걸 알아요.' },
  investigator: { name: '포졸', emoji: '🔍', team: 'town', desc: '첫 밤에, 두 사람 중 한 명이 어떤 하수인 직업이라는 걸 알아요.' },
  chef:         { name: '주모', emoji: '🍲', team: 'town', desc: '첫 밤에, 악이 나란히 앉은 쌍이 몇 쌍인지 알아요.' },
  grandma:      { name: '이웃집 할머니', emoji: '👵', team: 'town', desc: '매일 밤, 살아 있는 양옆 이웃 중에 악이 몇 명인지 알아요.' },
  seer:         { name: '점쟁이', emoji: '🔮', team: 'town', desc: '매일 밤 두 사람을 골라요(죽은 사람, 자신도 가능). 둘 중에 악마가 있는지 알려 줘요. 마을 사람 한 명은 점쟁이에게 악마로 보이는 ‘오해 유발자’예요.' },
  undertaker:   { name: '장의사', emoji: '⚰️', team: 'town', desc: '매일 밤, 그날 낮에 처형된 사람의 직업을 알아요.' },
  healer:       { name: '약초꾼', emoji: '🌿', team: 'town', desc: '둘째 밤부터 매일 밤 (자신이 아닌) 한 사람을 지켜요. 그 사람은 악마의 습격에 죽지 않아요.' },
  raven:        { name: '까마귀지기', emoji: '🐦‍⬛', team: 'town', desc: '밤에 습격을 당해 죽으면, 눈을 떠서 한 사람을 골라 그 사람의 직업을 알아요.' },
  virgin:       { name: '성녀', emoji: '🙏', team: 'town', desc: '처음 지목당했을 때, 지목한 사람이 마을 사람이면 그 사람이 그 자리에서 처형돼요.' },
  slayer:       { name: '사냥꾼', emoji: '🏹', team: 'town', desc: '게임 중 단 한 번, 낮에 한 사람을 쏴요. 악마라면 그 자리에서 쓰러져요.' },
  soldier:      { name: '병사', emoji: '💂', team: 'town', desc: '악마의 습격으로는 죽지 않아요.' },
  mayor:        { name: '이장', emoji: '🎖️', team: 'town', desc: '살아 있는 사람이 셋이고 그날 처형이 없으면 마을이 승리해요. 밤에 습격당하면 다른 사람이 대신 죽을 수도 있어요.' },
  butler:       { name: '하인', emoji: '🎩', team: 'out', desc: '매일 밤 (자신이 아닌) 한 사람을 주인으로 정해요. 다음 낮에는 주인이 처형에 찬성했을 때만 찬성할 수 있어요.' },
  drunk:        { name: '술꾼', emoji: '🍺', team: 'out', desc: '자기가 마을 사람인 줄 알지만 사실은 취해 있어요. 능력이 듣지 않고, 정보는 거짓이에요.' },
  recluse:      { name: '은둔자', emoji: '🏚️', team: 'out', desc: '다른 사람의 능력에 악이나 악마(하수인·악마)로 보일 수 있어요. 습격이나 처형으로 오해받기 쉬워요.' },
  saint:        { name: '성자', emoji: '🪦', team: 'out', desc: '처형당하면 마을이 패배해요. 의심받지 않게 조심하세요.' },
  poisoner:     { name: '독약상', emoji: '🧪', team: 'minion', desc: '매일 밤 한 사람에게 독을 써요. 그 밤과 다음 낮 동안 그 사람의 능력이 듣지 않고 거짓 정보를 받아요.' },
  spy:          { name: '첩자', emoji: '🕶️', team: 'minion', desc: '매일 밤 모든 사람의 직업과 상태(장부)를 몰래 봐요. 마을 편(마을 사람·외부인)으로 보일 수 있어요.' },
  scarlet:      { name: '붉은 여인', emoji: '💃', team: 'minion', desc: '살아 있는 사람이 5명 이상일 때 악마가 쓰러지면, 당신이 새 악마가 돼요.' },
  baron:        { name: '음모가', emoji: '🕯️', team: 'minion', desc: '이 마을에는 외부인이 2명 더 들어와 있어요. (마을 사람 2명이 줄어요)' },
  demon:        { name: '피의 군주', emoji: '🩸', team: 'demon', desc: '둘째 밤부터 매일 밤 한 사람을 습격해요. 자신을 고르면 하수인 한 명이 새 악마가 돼요.' },
};
const IDS = Object.keys(ROLES);
const byTeam = (t) => IDS.filter((r) => ROLES[r].team === t);
const TOWN = byTeam('town');
const OUT = byTeam('out');
const MINION = byTeam('minion');
const GOOD = [...TOWN, ...OUT];
const isEvilRole = (r) => ROLES[r].team === 'minion' || ROLES[r].team === 'demon';

// 밤에 직접 고르는 직업: kind(한 명/두 명), pool(any=죽은 사람 포함 | alive), self(자신 선택 가능), from(몇째 밤부터)
const NIGHT = {
  seer: { kind: 'two', pool: 'any', self: true },
  healer: { kind: 'one', pool: 'alive', self: false, from: 2 },
  poisoner: { kind: 'one', pool: 'alive', self: true },
  demon: { kind: 'one', pool: 'alive', self: true, from: 2 },
  butler: { kind: 'one', pool: 'any', self: false },
};
const RAVEN_PROMPT = { kind: 'one', pool: 'any', self: true };

// 인원별 [마을 사람, 외부인, 하수인] (악마는 항상 1명)
const COMP = { 5: [3, 0, 1], 6: [3, 1, 1], 7: [5, 0, 1], 8: [5, 1, 1], 9: [5, 2, 1], 10: [7, 0, 2], 11: [7, 1, 2], 12: [7, 2, 2], 13: [9, 0, 3], 14: [9, 1, 3], 15: [9, 2, 3] };

function dealRoles(n) {
  let [t, o, m] = COMP[n];
  const mins = shuffle(MINION).slice(0, m);
  if (mins.includes('baron')) { t -= 2; o += 2; }          // 음모가: 외부인 +2, 마을 사람 -2
  const outs = shuffle(OUT).slice(0, o);
  const towns = shuffle(TOWN).slice(0, t);
  const roles = shuffle([...towns, ...outs, ...mins, 'demon']);
  const fake = outs.includes('drunk') ? pick(TOWN.filter((r) => !towns.includes(r))) : null;
  return { roles, fake };
}
function forcedDeal(n) {
  if (!CFG.FORCE) return null;
  const items = CFG.FORCE.split(',').map((x) => x.trim()).filter(Boolean);
  if (items.length !== n) return null;
  let fake = null;
  const roles = items.map((it) => { const [r, f] = it.split(':'); if (f) fake = f; return r; });
  if (!roles.every((r) => ROLES[r])) return null;
  if (roles.includes('drunk') && !fake) fake = pick(TOWN.filter((r) => !roles.includes(r)));
  return { roles, fake };
}

// 다른 사람의 능력에 어떻게 '보이는가' (첩자·은둔자는 확률적으로 다르게 보여요)
const roll = () => Math.random() < CFG.REG;
const regAlign = (s) => {                       // 'evil' | 'good'
  if (s.role === 'spy') return roll() ? 'good' : 'evil';
  if (s.role === 'recluse') return roll() ? 'evil' : 'good';
  return isEvilRole(s.role) ? 'evil' : 'good';
};
const regTeam = (s) => {                        // 'town' | 'out' | 'minion' | 'demon'
  if (s.role === 'spy') return roll() ? pick(['town', 'out']) : 'minion';
  if (s.role === 'recluse') return roll() ? pick(['minion', 'demon']) : 'out';
  return ROLES[s.role].team;
};
const regDemon = (s) => s.role === 'demon' || (s.role === 'recluse' && roll());
const regRoleId = (s) => {
  if (s.role === 'spy' && roll()) return pick(GOOD);
  if (s.role === 'recluse' && roll()) return pick([...MINION, 'demon']);
  return s.role;
};

module.exports = {
  id: 'village',
  name: '오늘도 이 마을엔 피가 흐른다',
  emoji: '🩸',
  accent: '#ff6b81',   // 대기실 카드 색
  desc: '악마는 숨고, 마을은 의심한다. 밤마다 누군가 사라지는 마을의 추리극.',
  rules: [
    '모두 비밀 직업을 받아요. 마을 편은 악마를 찾아 처형하고, 악마와 하수인은 정체를 숨겨요.',
    '밤에는 직업 능력을 쓰고, 악마는 둘째 밤부터 한 명을 습격해요. 결과는 아침에 알려 줘요.',
    '낮에는 토론하고 귓속말을 나눈 뒤, 의심스러운 사람을 지목해 찬반 투표를 해요. 절반 이상 찬성을 얻은 가장 높은 득표자가 처형돼요.',
    '독이나 취함 때문에 정보가 틀릴 수도 있고, 어떤 직업은 다른 사람으로 보일 수도 있어요. 말을 믿기 전에 따져 보세요.',
    '마을 편은 악마가 쓰러지면 승리, 악은 살아남은 사람이 2명이 되면 승리해요. (5~15명)',
  ],
  min: CFG.MIN,
  max: CFG.MAX,
  help: {
    summary: [
      '🌙 **밤에는 능력을 쓰고**, 악마가 한 명을 습격해요. 아침에 누가 죽었는지, 내 정보가 알려져요.',
      '☀️ **낮에는 토론하고**, 의심되는 사람을 지목해 **투표로 처형**해요. 귓속말도 보낼 수 있어요.',
      '🏆 마을 편은 **악마를 처형하면 승리**, 악 편은 **살아남은 사람이 둘만 남으면 승리**해요!',
    ],
    sections: [
      { title: '하루의 흐름', lines: [
        '밤: 모두 눈을 감고, 능력이 있는 사람만 화면에서 선택해요. (첫 밤에는 습격이 없어요)',
        '아침: 밤에 죽은 사람의 이름과 내가 받은 정보가 알려져요. 죽은 사람의 직업은 비밀이에요.',
        '낮 토론(2분): 채팅과 귓속말로 이야기해요. 살아 있는 사람 과반이 ‘토론 끝내기’를 누르면 일찍 넘어가요.',
        '지목과 투표: 살아 있는 사람은 하루에 한 번 다른 사람을 지목할 수 있어요. 지목되면 처형 찬반 투표를 하고, 절반 이상 찬성한 가장 높은 득표자가 처형 후보가 돼요.',
        '낮이 끝나면 후보가 처형돼요. 아무도 없으면 처형 없이 밤이 와요.',
      ] },
      { title: '꼭 알아둘 것', lines: [
        '독, 술꾼, 첩자, 은둔자 때문에 **정보가 틀리거나 다르게 보일 수 있어요.** 말을 그대로 믿지 마세요.',
        '악마와 하수인은 첫 밤에 서로를 알아요. 악마는 마을에 없는 마을 편 직업 3개를 받아서 허세를 부릴 수 있어요.',
        '죽어도 게임에 남아요. 채팅, 귓속말, 구경이 가능하고, 투표에 **찬성할 때 한 번만** 쓸 수 있는 유령표가 있어요.',
        '이기면 그 편 전원이 방 점수 1점을 얻어요.',
      ] },
    ],
    groups: [
      { title: '🟢 마을 사람 (13) — 악마를 찾는 편', items: Object.values(ROLES).filter((r) => r.team === 'town').map((r) => ({ emoji: r.emoji, title: r.name, color: '#34d399', text: r.desc })) },
      { title: '🟡 외부인 (4) — 마을 편이지만 골칫거리', items: Object.values(ROLES).filter((r) => r.team === 'out').map((r) => ({ emoji: r.emoji, title: r.name, color: '#fbbf24', text: r.desc })) },
      { title: '🔴 하수인 (4) — 악마를 돕는 편', items: Object.values(ROLES).filter((r) => r.team === 'minion').map((r) => ({ emoji: r.emoji, title: r.name, color: '#fb7185', text: r.desc })) },
      { title: '🩸 악마 (1)', items: Object.values(ROLES).filter((r) => r.team === 'demon').map((r) => ({ emoji: r.emoji, title: r.name, color: '#f43f5e', text: r.desc })) },
    ],
  },

  create(api) {
    const seatOf = (g, id) => g.seats.find((s) => s.id === id);
    const aliveSeats = (g) => g.seats.filter((s) => s.alive);
    const evilSeat = (s) => isEvilRole(s.role);
    const fresh = (g, s) => s.role !== 'drunk' && g.poisonId !== s.id;   // 능력이 정상으로 먹히는가
    const effRole = (s) => (s.role === 'drunk' ? s.fake : s.role);        // 본인이 알고 있는 직업
    const later = (g, ms, fn) => { const h = setTimeout(fn, ms); g.timers.add(h); return h; };
    const clearTimers = (g) => { g.timers.forEach((h) => clearTimeout(h)); g.timers.clear(); };
    const pub = (room, text, chat = true) => {
      room.g.log.push({ t: Date.now(), text });
      if (chat) api.chatSys(room, text);
    };
    const note = (g, s, text) => s.notes.push({ n: g.night, text });
    const randBool = () => Math.random() < 0.5;
    const randRoleName = () => ROLES[pick(IDS)].name;

    // 이 사람이 지금 해야 할 선택 (없으면 null)
    function promptOf(g, s) {
      if (s.left) return null;
      if (g.phase === 'night' && g.nightStage === 'raven') return g.raven && g.raven.id === s.id ? { role: 'raven', ...RAVEN_PROMPT } : null;
      if (!s.alive) return null;
      const r = effRole(s);
      const d = NIGHT[r];
      if (!d) return null;
      if (d.from && g.night < d.from) return null;
      return { role: r, ...d };
    }

    /* ───────── 시작 ───────── */
    function start(room, gamers) {
      const order = CFG.FORCE ? gamers : shuffle(gamers);
      const deal = forcedDeal(order.length) || dealRoles(order.length);
      const g = (room.g = {
        phase: 'night', nightStage: 'act', night: 0, day: 0, dayPhase: null, endsAt: 0, nightStart: 0,
        seats: order.map((p, i) => ({
          id: p.id, name: p.name, avatar: p.avatar, color: p.color,
          role: deal.roles[i], fake: deal.roles[i] === 'drunk' ? deal.fake : null, orig: null,
          alive: true, ghost: true, left: false, notes: [], used: false, master: null, lastWhisper: 0,
          act: null, nominatedToday: false, wasNominated: false, passed: false,
        })),
        log: [], poisonId: null, protectedId: null, redHerringId: null, todayExec: null, block: null, vote: null, skip: new Set(),
        raven: null, tonight: null, whispers: [], whisperPairs: new Set(),
        timers: new Set(), result: null, bluffs: [], counts: null,
      });
      // 점쟁이의 오해 유발자: 마을 편 중 한 명 (점쟁이 본인도 될 수 있어요)
      const goodSeats = g.seats.filter((s) => !evilSeat(s));
      const rhIdx = CFG.RH !== '' ? Number(CFG.RH) : -1;
      g.redHerringId = (rhIdx >= 0 && g.seats[rhIdx] ? g.seats[rhIdx] : pick(goodSeats)).id;
      const inPlay = new Set(deal.roles);
      g.bluffs = shuffle(GOOD.filter((r) => !inPlay.has(r) && r !== deal.fake)).slice(0, 3);
      const cnt = (t) => deal.roles.filter((r) => ROLES[r].team === t).length;
      g.counts = { town: cnt('town'), out: cnt('out'), minion: cnt('minion'), demon: 1 };
      pub(room, '🩸 마을에 어둠이 내렸어요. 모두 자신의 직업을 확인하세요. 이 마을 어딘가에 악마가 숨어 있어요.');
      enterNight(room);
    }

    /* ───────── 밤 ───────── */
    function enterNight(room) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'night';
      g.nightStage = 'act';
      g.night += 1;
      g.dayPhase = null;
      g.vote = null;
      g.block = null;
      g.raven = null;
      g.seats.forEach((s) => { s.act = null; });
      g.nightStart = Date.now();
      g.endsAt = g.nightStart + CFG.NIGHT_MAX_MS;
      pub(room, `🌙 ${g.night}번째 밤이에요. 능력이 있는 사람은 선택을 해 주세요.`);
      later(g, CFG.NIGHT_MIN_MS, () => maybeEndNight(room));
      later(g, CFG.NIGHT_MAX_MS, () => resolveNight(room));
      api.broadcast(room);
    }

    function maybeEndNight(room) {
      const g = room.g;
      if (!g || g.phase !== 'night' || g.nightStage !== 'act') return;
      if (Date.now() < g.nightStart + CFG.NIGHT_MIN_MS - 50) return;   // 최소 시간 전에는 기다려요
      const waiting = g.seats.some((s) => promptOf(g, s) && !s.act);
      if (!waiting) resolveNight(room);
    }

    // 1단계: 독 → 보호 → 악마의 습격 (까마귀지기가 죽으면 그 선택을 기다려요)
    function resolveNight(room) {
      const g = room.g;
      if (!g || g.phase !== 'night' || g.nightStage !== 'act') return;
      clearTimers(g);
      const seats = g.seats;
      const get = (id) => seatOf(g, id);
      const tgt = (s, i = 0) => (s.act && s.act.targets[i]) || null;

      const poisoner = seats.find((s) => s.role === 'poisoner' && s.alive);
      g.poisonId = poisoner && tgt(poisoner) ? tgt(poisoner) : null;
      seats.filter((s) => s.role === 'butler' && s.alive).forEach((b) => { b.master = tgt(b); });
      const healer = seats.find((s) => s.role === 'healer' && s.alive);
      g.protectedId = healer && tgt(healer) && fresh(g, healer) ? tgt(healer) : null;

      const t = { deaths: [], victimId: null, byDemon: false };
      g.tonight = t;
      const demon = seats.find((s) => s.role === 'demon' && s.alive);
      if (g.night >= 2 && demon && tgt(demon) && fresh(g, demon)) {
        let target = get(tgt(demon));
        if (target && target.alive) {
          if (target.id === demon.id) {
            // 자리 넘기기: 스스로 쓰러지고 하수인 한 명이 새 악마가 돼요
            const minions = seats.filter((s) => s.alive && ROLES[s.role].team === 'minion');
            demon.alive = false; demon.ghost = true; t.deaths.push(demon);
            if (minions.length) {
              const sw = minions.find((s) => s.role === 'scarlet');
              const heir = sw && aliveSeats(g).length + 1 >= 5 ? sw : pick(minions);
              heir.orig = heir.role; heir.role = 'demon';
              note(g, heir, '🩸 피의 군주가 스스로 쓰러지며 당신에게 자리를 넘겼어요. 이제 당신이 새 피의 군주예요!');
            }
          } else {
            if (target.role === 'mayor' && fresh(g, target) && target.id !== g.protectedId && roll()) {
              const alt = seats.filter((s) => s.alive && s.id !== target.id && s.role !== 'demon' && s.id !== g.protectedId && !(s.role === 'soldier' && fresh(g, s)));
              if (alt.length) target = pick(alt);
            }
            const safe = target.id === g.protectedId || (target.role === 'soldier' && fresh(g, target));
            if (!safe) { target.alive = false; target.ghost = true; t.deaths.push(target); t.victimId = target.id; t.byDemon = true; }
          }
        }
      }
      const victim = t.victimId ? get(t.victimId) : null;
      if (victim && effRole(victim) === 'raven') {
        g.nightStage = 'raven';
        g.raven = { id: victim.id, ok: fresh(g, victim) };
        g.endsAt = Date.now() + CFG.RAVEN_MS;
        later(g, CFG.RAVEN_MS, () => finishNight(room));
        return api.broadcast(room);
      }
      finishNight(room);
    }

    function firstNightInfo(g, s, ok) {
      const r = effRole(s);
      const others = g.seats.filter((x) => x.id !== s.id);
      const pairText = (x, role, label) => {
        const y = pick(others.filter((z) => z !== x));
        const [a, b] = shuffle([x, y]);
        return `${label} ${a.name}, ${b.name} 중 한 명이 ${ROLES[role].name}이에요.`;
      };
      const randomPair = (pool, label) => { const [a, b] = shuffle(others).slice(0, 2); return `${label} ${a.name}, ${b.name} 중 한 명이 ${ROLES[pick(pool)].name}이에요.`; };
      if (r === 'washer') {
        const cand = ok ? others.filter((x) => regTeam(x) === 'town') : [];
        if (!cand.length) return randomPair(TOWN, '🧺');
        const x = pick(cand);
        return pairText(x, ROLES[x.role].team === 'town' ? x.role : pick(TOWN), '🧺');
      }
      if (r === 'librarian') {
        if (!ok) return roll() ? '📚 이 마을에는 외부인이 없어요.' : randomPair(OUT, '📚');
        const cand = others.filter((x) => regTeam(x) === 'out');
        if (!cand.length) return '📚 이 마을에는 외부인이 없어요.';
        const x = pick(cand);
        return pairText(x, ROLES[x.role].team === 'out' ? x.role : pick(OUT), '📚');
      }
      if (r === 'investigator') {
        const cand = ok ? others.filter((x) => regTeam(x) === 'minion') : [];
        if (!cand.length) return randomPair(MINION, '🔍');
        const x = pick(cand);
        return pairText(x, ROLES[x.role].team === 'minion' ? x.role : pick(MINION), '🔍');
      }
      // chef
      const n = g.seats.length;
      let pairs = 0;
      for (let i = 0; i < n; i++) if (regAlign(g.seats[i]) === 'evil' && regAlign(g.seats[(i + 1) % n]) === 'evil') pairs += 1;
      return `🍲 악이 나란히 앉은 쌍은 ${ok ? pairs : Math.floor(Math.random() * 3)}쌍이에요.`;
    }

    // 2단계: 정보 → 아침
    function finishNight(room) {
      const g = room.g;
      if (!g || g.phase !== 'night') return;
      clearTimers(g);
      g.nightStage = 'act';
      const seats = g.seats;
      const get = (id) => seatOf(g, id);
      seats.filter((s) => s.alive).forEach((s) => {
        const r = effRole(s);
        const ok = fresh(g, s);
        if (g.night === 1 && ['washer', 'librarian', 'investigator', 'chef'].includes(r)) note(g, s, firstNightInfo(g, s, ok));
        if (r === 'grandma') {
          const i = seats.indexOf(s);
          const n = seats.length;
          const find = (dir) => { for (let k = 1; k < n; k++) { const c = seats[(i + dir * k + n * 2) % n]; if (c.alive && c !== s) return c; } return null; };
          const nb = [...new Set([find(-1), find(1)].filter(Boolean))];
          const truth = nb.filter((x) => regAlign(x) === 'evil').length;
          note(g, s, `👵 살아 있는 양옆 이웃 중 악이 ${ok ? truth : Math.floor(Math.random() * (nb.length + 1))}명이에요.`);
        } else if (r === 'seer' && s.act) {
          const [a, b] = s.act.targets.map(get);
          const hit = [a, b].some((x) => regDemon(x) || x.id === g.redHerringId);
          note(g, s, `🔮 ${a.name}, ${b.name} 중에 악마가 ${(ok ? hit : randBool()) ? '있어요' : '없어요'}.`);
        } else if (r === 'undertaker') {
          if (g.todayExec) {   // 그날 낮에 처형이 있었을 때만 깨어나요
            const ex = get(g.todayExec.id);
            note(g, s, `⚰️ 처형된 ${g.todayExec.name}님의 직업은 ${ok ? ROLES[regRoleId(ex)].name : randRoleName()}였어요.`);
          }
        } else if (s.role === 'spy') {
          const roles = seats.map((x) => x.role);
          const shown = ok ? roles : shuffle(roles);
          let text = `🕶️ 장부 — ${seats.map((x, i) => `${x.name}=${ROLES[shown[i]].name}${x.alive ? '' : '(죽음)'}`).join(', ')}`;
          if (ok) {
            const extra = [];
            seats.filter((x) => x.role === 'drunk').forEach((x) => extra.push(`취한 사람: ${x.name}(자신은 ${ROLES[x.fake].name}인 줄 앎)`));
            if (g.poisonId) extra.push(`독: ${get(g.poisonId).name}`);
            if (g.protectedId) extra.push(`보호: ${get(g.protectedId).name}`);
            if (seats.some((x) => x.role === 'seer')) extra.push(`오해 유발자: ${get(g.redHerringId).name}`);
            const butlers = seats.filter((x) => x.role === 'butler' && x.master).map((x) => `${x.name}→${get(x.master).name}`);
            if (butlers.length) extra.push(`하인의 주인: ${butlers.join(', ')}`);
            if (extra.length) text += ` / ${extra.join(' / ')}`;
          }
          note(g, s, text);
        }
      });

      const deaths = g.tonight ? g.tonight.deaths : [];
      if (g.night === 1) pub(room, '☀️ 아침이 밝았어요. 첫 번째 밤은 조용히 지나갔어요.');
      else if (deaths.length) pub(room, `☀️ 아침이 밝았어요. 지난밤 ${deaths.map((d) => `${d.name}님`).join(', ')}이 숨진 채 발견됐어요.`);
      else pub(room, '☀️ 아침이 밝았어요. 지난밤에는 아무도 숨지지 않았어요.');
      g.raven = null;
      if (checkWin(room)) return;
      enterDay(room);
    }

    /* ───────── 낮 ───────── */
    function enterDay(room) {
      const g = room.g;
      clearTimers(g);
      g.phase = 'day';
      g.day += 1;
      g.dayPhase = 'talk';
      g.todayExec = null;
      g.vote = null;
      g.block = null;
      g.skip = new Set();
      g.whisperPairs = new Set();
      g.seats.forEach((s) => { s.nominatedToday = false; s.wasNominated = false; s.passed = false; });
      g.endsAt = Date.now() + CFG.TALK_MS;
      pub(room, `💬 ${g.day}번째 낮이에요. 채팅과 귓속말로 이야기하세요. 과반이 동의하면 토론을 일찍 끝내고 지목 단계로 넘어가요.`, false);
      later(g, CFG.TALK_MS, () => startNominations(room));
      api.broadcast(room);
    }

    function startNominations(room) {
      const g = room.g;
      if (!g || g.phase !== 'day' || g.dayPhase !== 'talk') return;
      clearTimers(g);
      g.dayPhase = 'nominate';
      g.endsAt = Date.now() + CFG.NOM_MS;
      pub(room, '🗳 지목 단계예요. 의심스러운 사람을 지목해 처형 투표를 열 수 있어요. (한 사람당 한 번 지목, 한 사람은 하루 한 번만 지목당해요)');
      later(g, CFG.NOM_MS, () => endDay(room));
      api.broadcast(room);
    }

    const needVotes = (g) => Math.ceil(aliveSeats(g).length / 2);
    // 살아 있는 사람이 모두 투표했는지 (죽은 사람의 유령표는 선택 사항이라 기다리지 않아요)
    const allAliveVoted = (g) => g.vote.eligible.every((id) => { const x = seatOf(g, id); return !x.alive || g.vote.votes[id] !== undefined; });

    function nominate(room, player, targetId) {
      const g = room.g;
      const s = seatOf(g, player.id);
      const t = seatOf(g, targetId);
      if (g.phase !== 'day' || g.dayPhase !== 'nominate') return { ok: false, error: '지금은 지목할 수 없어요.' };
      if (!s || !s.alive) return { ok: false, error: '죽은 사람은 지목할 수 없어요.' };
      if (g.vote) return { ok: false, error: '투표가 진행 중이에요.' };
      if (s.nominatedToday) return { ok: false, error: '오늘은 이미 지목했어요.' };
      if (!t || !t.alive) return { ok: false, error: '살아 있는 사람만 지목할 수 있어요.' };
      if (t.id === s.id) return { ok: false, error: '자기 자신은 지목할 수 없어요.' };
      if (t.wasNominated) return { ok: false, error: '그 사람은 오늘 이미 지목당했어요.' };
      s.nominatedToday = true;
      t.wasNominated = true;
      pub(room, `👉 ${s.name}님이 ${t.name}님을 지목했어요!`);
      // 성녀: 처음 지목당했을 때, 지목한 사람이 마을 사람이면 그 자리에서 처형 (첩자는 마을 사람으로 보일 수 있어요)
      if (t.role === 'virgin' && !t.used && fresh(g, t)) {
        t.used = true;
        if (ROLES[s.role].team === 'town' || (s.role === 'spy' && roll())) {
          pub(room, `🙏 ${t.name}님은 성녀였어요! 성스러운 힘이 ${s.name}님을 심판했어요.`);
          if (executeSeat(room, s)) return { ok: true };
          endDay(room, true);
          return { ok: true };
        }
      }
      const eligible = g.seats.filter((x) => (x.alive || x.ghost) && !x.left).map((x) => x.id);
      g.vote = { nominatorId: s.id, nomineeId: t.id, votes: {}, eligible, endsAt: Date.now() + CFG.VOTE_MS, timer: null };
      g.vote.timer = later(g, CFG.VOTE_MS, () => closeVote(room));
      return { ok: true };
    }

    function closeVote(room) {
      const g = room.g;
      if (!g || !g.vote) return;
      const v = g.vote;
      clearTimeout(v.timer);
      g.timers.delete(v.timer);
      const yes = v.eligible.filter((id) => v.votes[id] === true);
      const need = needVotes(g);
      const nominee = seatOf(g, v.nomineeId);
      // 죽은 사람이 찬성하면 그 한 표를 써요
      yes.forEach((id) => { const x = seatOf(g, id); if (x && !x.alive) x.ghost = false; });
      g.vote = null;
      const names = yes.map((id) => seatOf(g, id).name).join(', ') || '없음';
      let msg = `🗳 ${nominee.name}님 처형 투표: 찬성 ${yes.length}표 (필요 ${need}표) — 찬성: ${names}`;
      if (yes.length >= need) {
        if (!g.block || yes.length > g.block.votes) { g.block = { id: nominee.id, votes: yes.length }; msg += ' → 처형 대상이 되었어요.'; }
        else if (yes.length === g.block.votes) { g.block = null; msg += ' → 동점이라 아무도 처형 대상이 아니에요.'; }
        else msg += ' → 더 많은 표를 받은 사람이 있어 처형 대상이 되지 못했어요.';
      } else msg += ' → 부결.';
      pub(room, msg);
      if (aliveSeats(g).every((s) => s.nominatedToday || s.passed)) return endDay(room);
      api.broadcast(room);
    }

    function endDay(room, immediate = false) {
      const g = room.g;
      if (!g || g.phase !== 'day') return;
      if (g.vote) closeVote(room);
      if (!room.g || room.g.phase !== 'day') return;
      clearTimers(g);
      if (!immediate && g.block) {
        const s = seatOf(g, g.block.id);
        pub(room, `⚖️ 마을은 ${s.name}님을 처형하기로 했어요.`);
        if (executeSeat(room, s)) return;
      } else if (!immediate) {
        pub(room, '⚖️ 오늘은 아무도 처형되지 않았어요.');
        const mayor = g.seats.find((s) => s.role === 'mayor' && s.alive);
        if (mayor && aliveSeats(g).length === 3 && fresh(g, mayor)) return finish(room, 'town', '처형 없이 세 명만 남은 낮이 끝났어요. 이장이 마을을 지켜냈어요!');
      }
      if (checkWin(room)) return;
      enterNight(room);
    }

    // 악마가 쓰러질 때 붉은 여인이 이어받을 수 있는가 (쓰러지기 직전에 5명 이상 생존)
    function scarletTakes(room, aliveBefore) {
      const g = room.g;
      const sw = g.seats.find((s) => s.role === 'scarlet' && s.alive);
      if (!sw || aliveBefore < 5) return false;
      sw.orig = sw.role;
      sw.role = 'demon';
      note(g, sw, '💃 피의 군주가 쓰러졌어요! 이제 당신이 새 피의 군주예요. 오늘 밤부터 습격할 수 있어요.');
      return true;
    }

    // 처형. 게임이 끝났으면 true
    function executeSeat(room, s) {
      const g = room.g;
      const aliveBefore = aliveSeats(g).length;
      s.alive = false;
      s.ghost = true;
      g.todayExec = { id: s.id, name: s.name };
      pub(room, `☠️ ${s.name}님이 처형되었어요.`);
      if (s.role === 'saint' && fresh(g, s)) { finish(room, 'evil', `성자 ${s.name}님이 처형되었어요. 마을은 무고한 성자를 죽였어요.`); return true; }
      if (s.role === 'demon') scarletTakes(room, aliveBefore);
      return checkWin(room);
    }

    function checkWin(room) {
      const g = room.g;
      if (!g.seats.some((s) => s.role === 'demon' && s.alive)) { finish(room, 'town', '악마가 쓰러졌어요! 마을에 평화가 돌아왔어요.'); return true; }
      if (aliveSeats(g).length <= 2) { finish(room, 'evil', '살아남은 사람이 둘뿐이에요. 마을은 악마의 손에 넘어갔어요.'); return true; }
      return false;
    }

    function finish(room, winner, reason, opts = {}) {
      const g = room.g;
      if (!g || g.phase === 'ended') return;
      clearTimers(g);
      g.phase = 'ended';
      g.dayPhase = null;
      g.vote = null;
      g.endsAt = 0;
      const winSide = (s) => (winner === 'town' ? ROLES[s.role].team === 'town' || ROLES[s.role].team === 'out' : evilSeat(s));
      const gains = {};
      if (!opts.noScore) {
        g.seats.filter(winSide).forEach((s) => {
          const p = room.players.find((x) => x.id === s.id);
          if (p) { api.addScore(room, p, CFG.SCORE.win); gains[s.id] = CFG.SCORE.win; }
        });
      }
      g.result = {
        winner, reason, noScore: !!opts.noScore,
        players: g.seats.map((s) => ({
          id: s.id, name: s.name, avatar: s.avatar, color: s.color, role: s.role, orig: s.orig, fake: s.fake,
          alive: s.alive, left: s.left, win: winSide(s), gain: gains[s.id] || 0,
          score: (room.players.find((x) => x.id === s.id) || {}).score || 0,
        })),
      };
      pub(room, `🏁 ${winner === 'town' ? '마을 승리!' : '악의 승리!'} ${reason}`);
      api.broadcast(room);
    }

    /* ───────── 보기 ───────── */
    function view(room, pid) {
      const g = room.g;
      const me = seatOf(g, pid);
      const ended = g.phase === 'ended';
      const out = {
        phase: g.phase, nightStage: g.nightStage, day: g.day, night: g.night, dayPhase: g.dayPhase, endsAt: g.endsAt,
        talkMs: CFG.TALK_MS, nomMs: CFG.NOM_MS, voteMs: CFG.VOTE_MS,
        counts: g.counts, need: needVotes(g),
        roles: Object.fromEntries(IDS.map((id) => [id, { name: ROLES[id].name, emoji: ROLES[id].emoji, team: ROLES[id].team, desc: ROLES[id].desc }])),
        seats: g.seats.map((s) => ({
          id: s.id, name: s.name, avatar: s.avatar, color: s.color, alive: s.alive, ghost: s.ghost, left: s.left,
          nominatedToday: s.nominatedToday, wasNominated: s.wasNominated,
        })),
        block: g.block ? { id: g.block.id, votes: g.block.votes } : null,
        vote: g.vote ? { nominatorId: g.vote.nominatorId, nomineeId: g.vote.nomineeId, votes: g.vote.votes, eligible: g.vote.eligible, endsAt: g.vote.endsAt } : null,
        skipCount: g.skip.size,
        log: g.log.slice(-80),
        result: ended ? g.result : null,
        whispers: me ? g.whispers.filter((w) => w.from === pid || w.to === pid).slice(-150) : [],
        me: null,
      };
      if (me) {
        const r = effRole(me);
        const def = ROLES[r];
        const pr = g.phase === 'night' ? promptOf(g, me) : null;
        const evil = evilSeat(me);
        out.me = {
          role: r, roleName: def.name, emoji: def.emoji, desc: def.desc,
          team: ROLES[me.role].team === 'town' || ROLES[me.role].team === 'out' ? 'good' : 'evil',
          alive: me.alive, ghost: me.ghost,
          notes: me.notes,
          prompt: pr ? { kind: pr.kind, role: pr.role, pool: pr.pool, self: pr.self, submitted: !!me.act || (pr.role === 'raven' && !g.raven), targets: me.act ? me.act.targets : [] } : null,
          master: r === 'butler' && me.master ? me.master : null,
          evil: evil ? {
            demon: (g.seats.some((s) => s.role === 'demon' && s.alive) ? g.seats.filter((s) => s.role === 'demon' && s.alive) : g.seats.filter((s) => s.role === 'demon')).map((s) => ({ id: s.id, name: s.name })),
            minions: g.seats.filter((s) => s.role !== 'demon' && evilSeat(s)).map((s) => ({ id: s.id, name: s.name })),
            bluffs: me.role === 'demon' ? g.bluffs.map((b) => ROLES[b].name) : [],
          } : null,
          canShoot: g.phase === 'day' && me.alive && r === 'slayer' && !me.used,
          skipped: g.skip.has(me.id),
          canNominate: g.phase === 'day' && g.dayPhase === 'nominate' && me.alive && !me.nominatedToday && !g.vote,
          passed: me.passed,
        };
      }
      return out;
    }

    /* ───────── 동작 ───────── */
    function action(room, player, msg) {
      const g = room.g;
      if (!g || g.phase === 'ended') return { ok: false, error: '진행 중인 게임이 아니에요.' };
      const me = seatOf(g, player.id);
      if (!me) return { ok: false, error: '이번 판 참가자가 아니에요.' };

      if (msg.type === 'night') {
        if (g.phase !== 'night') return { ok: false, error: '지금은 밤이 아니에요.' };
        const pr = promptOf(g, me);
        if (!pr) return { ok: false, error: '지금은 할 수 있는 일이 없어요.' };
        if (me.act) return { ok: false, error: '이미 선택했어요.' };
        const ids = Array.isArray(msg.targets) ? msg.targets.map(String) : [];
        const want = pr.kind === 'two' ? 2 : 1;
        if (ids.length !== want || new Set(ids).size !== want) return { ok: false, error: want === 2 ? '서로 다른 두 사람을 골라 주세요.' : '한 사람을 골라 주세요.' };
        for (const id of ids) {
          const t = seatOf(g, id);
          if (!t || t.left) return { ok: false, error: '고를 수 없는 사람이에요.' };
          if (pr.pool === 'alive' && !t.alive) return { ok: false, error: '살아 있는 사람만 고를 수 있어요.' };
          if (!pr.self && id === me.id) return { ok: false, error: '자신은 고를 수 없어요.' };
        }
        me.act = { targets: ids };
        if (pr.role === 'raven') {
          // 까마귀지기: 고른 사람의 직업을 알아요 (독/취함이면 거짓)
          const t = seatOf(g, ids[0]);
          note(g, me, `🐦‍⬛ ${t.name}님의 직업은 ${g.raven.ok ? ROLES[regRoleId(t)].name : randRoleName()}이에요.`);
          g.raven = null;
          finishNight(room);
          return { ok: true };
        }
        maybeEndNight(room);
        return { ok: true };
      }

      if (msg.type === 'whisper') {
        if (g.phase !== 'day') return { ok: false, error: '귓속말은 낮에만 할 수 있어요.' };
        const to = seatOf(g, String(msg.to || ''));
        const text = cleanText(msg.text, 160);
        if (!to || to.left || to.id === me.id) return { ok: false, error: '귓속말을 보낼 사람을 골라 주세요.' };
        if (!text) return { ok: false, error: '내용을 입력해 주세요.' };
        const now = Date.now();
        if (now - me.lastWhisper < 300) return { ok: false, error: '너무 빨라요. 잠시 후에 보내 주세요.' };
        me.lastWhisper = now;
        g.whispers.push({ from: me.id, to: to.id, text, t: now });
        if (g.whispers.length > 500) g.whispers.shift();
        const key = [me.id, to.id].sort().join('|');
        if (!g.whisperPairs.has(key)) { g.whisperPairs.add(key); pub(room, `🤫 ${me.name}님과 ${to.name}님이 귓속말을 나누기 시작했어요.`, false); }
        return { ok: true };
      }

      if (msg.type === 'skip_talk') {
        if (g.phase !== 'day' || g.dayPhase !== 'talk') return { ok: false, error: '지금은 토론 중이 아니에요.' };
        if (!me.alive) return { ok: false, error: '죽은 사람은 선택할 수 없어요.' };
        if (g.skip.has(me.id)) g.skip.delete(me.id); else g.skip.add(me.id);
        if (g.skip.size >= needVotes(g)) { pub(room, '💬 과반이 동의해 토론을 마치고 지목 단계로 넘어가요.', false); startNominations(room); }
        return { ok: true };
      }

      if (msg.type === 'nominate') return nominate(room, player, String(msg.target || ''));

      if (msg.type === 'pass_nom') {
        if (g.phase !== 'day' || g.dayPhase !== 'nominate') return { ok: false, error: '지금은 지목 단계가 아니에요.' };
        if (!me.alive) return { ok: false, error: '죽은 사람은 선택할 수 없어요.' };
        me.passed = true;
        if (!g.vote && aliveSeats(g).every((s) => s.nominatedToday || s.passed)) endDay(room);
        return { ok: true };
      }

      if (msg.type === 'vote') {
        const v = g.vote;
        if (!v) return { ok: false, error: '진행 중인 투표가 없어요.' };
        if (!v.eligible.includes(me.id)) return { ok: false, error: '투표할 수 없어요.' };
        if (v.votes[me.id] !== undefined) return { ok: false, error: '이미 투표했어요.' };
        if (!me.alive && !me.ghost) return { ok: false, error: '죽은 사람의 투표권은 이미 썼어요.' };
        // 하인: 주인이 찬성한 뒤에만 찬성할 수 있어요
        if (msg.agree && me.role === 'butler' && me.alive && fresh(g, me) && !(me.master && v.votes[me.master] === true)) {
          return { ok: false, error: '주인이 먼저 찬성해야 찬성할 수 있어요. (반대는 언제든 가능해요)' };
        }
        v.votes[me.id] = !!msg.agree;
        if (allAliveVoted(g)) closeVote(room);
        return { ok: true };
      }

      if (msg.type === 'shoot') {
        if (g.phase !== 'day') return { ok: false, error: '낮에만 쏠 수 있어요.' };
        if (g.vote) return { ok: false, error: '투표가 진행 중이에요.' };
        if (!me.alive || effRole(me) !== 'slayer') return { ok: false, error: '사냥꾼만 쏠 수 있어요.' };
        if (me.used) return { ok: false, error: '화살은 이미 썼어요.' };
        const t = seatOf(g, String(msg.target || ''));
        if (!t || !t.alive || t.id === me.id) return { ok: false, error: '쏠 사람을 골라 주세요.' };
        me.used = true;
        if (me.role === 'slayer' && fresh(g, me) && regDemon(t)) {
          const aliveBefore = aliveSeats(g).length;
          t.alive = false;
          pub(room, `🏹 ${me.name}님이 ${t.name}님을 쐈어요! ${t.name}님이 쓰러졌어요!`);
          if (t.role === 'demon' && scarletTakes(room, aliveBefore)) { checkWin(room); return { ok: true }; }
          if (t.role === 'demon') finish(room, 'town', `사냥꾼 ${me.name}님의 화살이 악마를 꿰뚫었어요!`);
          else checkWin(room);
        } else {
          pub(room, `🏹 ${me.name}님이 ${t.name}님을 쐈지만 아무 일도 일어나지 않았어요.`);
        }
        return { ok: true };
      }
      return { ok: false, error: '알 수 없는 동작이에요.' };
    }

    /* ───────── 허브 훅 ───────── */
    function onLeave(room, player) {
      const g = room.g;
      if (!g || g.phase === 'ended') return;
      const s = seatOf(g, player.id);
      if (!s || s.left) return;
      s.left = true;
      const wasAlive = s.alive;
      s.alive = false;
      s.ghost = false;
      pub(room, `🚪 ${s.name}님이 마을을 떠났어요.`);
      if (s.role === 'demon') return finish(room, 'town', '악마가 마을을 떠났어요. 마을 승리! (중단된 판이라 점수는 없어요)', { noScore: true });
      if (aliveSeats(g).length < 3) return finish(room, 'evil', '남은 사람이 너무 적어 마을이 무너졌어요. (중단된 판이라 점수는 없어요)', { noScore: true });
      if (g.vote) {
        const v = g.vote;
        if (v.nomineeId === s.id || v.nominatorId === s.id) { clearTimeout(v.timer); g.timers.delete(v.timer); g.vote = null; pub(room, '투표 당사자가 떠나 투표가 취소되었어요.', false); }
        else { v.eligible = v.eligible.filter((id) => id !== s.id); delete v.votes[s.id]; if (allAliveVoted(g)) closeVote(room); }
      }
      if (g.block && g.block.id === s.id) g.block = null;
      g.skip.delete(s.id);
      if (g.phase === 'night' && g.nightStage === 'raven' && g.raven && g.raven.id === s.id) { g.raven = null; return finishNight(room); }
      if (wasAlive && g.phase === 'night') maybeEndNight(room);
      if (g.phase === 'day' && g.dayPhase === 'talk' && g.skip.size >= needVotes(g)) startNominations(room);
      if (g.phase === 'day' && g.dayPhase === 'nominate' && !g.vote && aliveSeats(g).every((x) => x.nominatedToday || x.passed)) endDay(room);
    }

    function dispose(room) {
      if (room.g) clearTimers(room.g);
      room.g = null;
    }

    return { start, view, action, onLeave, dispose, isFinished: (room) => !!room.g && room.g.phase === 'ended' };
  },
};
