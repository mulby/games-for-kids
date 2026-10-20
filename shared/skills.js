/* GFKSkills: one shared record of how she does on each math skill, so a grown-up can see what she has mastered.

   Gabe (2026-10-20) wanted to see how far she has come against a standard elementary sequence. The skills here are
   the Common Core math standards for kindergarten to 3rd grade that the games practise, by their usual codes
   (2.NBT.B.5 = grade 2, Number and Operations in Base Ten, cluster B, standard 5). Waldorf schools teach in another
   order (times tables early, written place value later), so a gap can mean "not taught yet" as well as "behind".

   Every math problem in every game calls GFKSkills.log(code(s), {ok, ms, game, bare}):
     ok   right on the first try with no help (a miss, a hint or "I haven't learned this" all count as not ok)
     ms   time from the question appearing to her answer
     bare a plain number fact with no story to listen to, so its time says whether she knows it or counts it
   Games can pick a code by hand, or let the helpers below choose one from the numbers (GFKSkills.add([8, 5])).

   Saved in localStorage["gfk-skills"] as {v:1, s:{code:{n, e:[[t, ok, ds, game, bare], ...]}}}: the last 30
   tries per skill (t in seconds, ds = tenths of a second) plus a running count. The Wonder Shelf copies the key
   to its database like any save, and merges two devices' copies try by try (see mergeSkills in save-sync.js).

   GFKSkills.status(code) turns the tries into a state:
     new        never tried
     learning   fewer than 3 tries, or under 60% right first time
     practicing at least 60% right first time
     slow       right, but a fluency skill's plain facts still take her longer than knowing them would (probably counting)
     mastered   at least 8 of the last 10 tries (or 85%), right first time, on 2 or more different days
     review     mastered, but not seen for 3 weeks: worth checking again
   Loaded as a plain script by each game and by the shelf; it does nothing until something calls it. */
(function (G) {
  'use strict';
  const KEY = 'gfk-skills', IMP = 'gfk-skills-imported', KEEP = 30, RECENT = 10, REVIEW_DAYS = 21;

  // [code, grade, strand, short name, fast ms (a bare fact slower than this is probably counted), made from (bare facts in these)]
  const LIST = [
    ['K.CC.A.2', 'K', 'count', 'Count on from any number'],
    ['K.CC.B.5', 'K', 'count', 'Count how many, up to 20'],
    ['K.CC.C.6', 'K', 'count', 'Which group has more'],
    ['K.CC.C.7', 'K', 'count', 'Compare numbers to 10'],
    ['K.OA.A.2', 'K', 'add', 'Add and take away within 10'],
    ['K.OA.A.3', 'K', 'add', 'Split numbers to 10 into two parts'],
    ['K.OA.A.4', 'K', 'add', 'Find the partner that makes 10'],
    ['K.OA.A.5', 'K', 'add', 'Add and take away within 5, quickly', 3000],
    ['K.NBT.A.1', 'K', 'place', 'Teen numbers are ten and some ones'],

    ['1.OA.A.2', '1', 'add', 'Add three numbers'],
    ['1.OA.B.4', '1', 'add', 'Take away as a missing part (10 − 7 as 7 + ? = 10)'],
    ['1.OA.C.6', '1', 'add', 'Add and take away within 20'],
    ['1.OA.D.8', '1', 'add', 'Find the missing number (8 + ? = 11)'],
    ['1.NBT.A.1', '1', 'count', 'Count and read numbers to 120'],
    ['1.NBT.B.2', '1', 'place', 'Tens and ones'],
    ['1.NBT.B.3', '1', 'place', 'Compare two-digit numbers'],
    ['1.NBT.C.4', '1', 'place', 'Add within 100 (a 2-digit number and ones or tens)'],
    ['1.NBT.C.5', '1', 'place', '10 more and 10 less in her head'],
    ['1.NBT.C.6', '1', 'place', 'Take away tens (70 − 30)'],
    ['1.MD.B.3', '1', 'measure', 'Time to the hour and half hour'],
    ['1.G.A.3', '1', 'fraction', 'Halves and fourths of a shape'],

    ['2.OA.A.1', '2', 'add', 'One- and two-step story problems within 100'],
    ['2.OA.B.2', '2', 'add', 'Know facts within 20 by heart', 3000, ['K.OA.A.2', 'K.OA.A.4', 'K.OA.A.5', '1.OA.C.6', '1.OA.D.8']],
    ['2.OA.C.4', '2', 'times', 'Rows and columns (arrays)'],
    ['2.NBT.A.1', '2', 'place', 'Hundreds, tens and ones'],
    ['2.NBT.A.2', '2', 'count', 'Skip-count by 5s, 10s and 100s'],
    ['2.NBT.A.3', '2', 'place', 'Numbers to 1000 in parts (300 + 40 + 2)'],
    ['2.NBT.A.4', '2', 'place', 'Compare three-digit numbers'],
    ['2.NBT.B.5', '2', 'place', 'Add and take away within 100'],
    ['2.NBT.B.6', '2', 'place', 'Add three or four two-digit numbers'],
    ['2.NBT.B.7', '2', 'place', 'Add and take away within 1000'],
    ['2.NBT.B.8', '2', 'place', '10 or 100 more or less, to 900'],
    ['2.MD.C.7', '2', 'measure', 'Time to 5 minutes'],
    ['2.MD.C.8', '2', 'measure', 'Money: count coins, pay and give change'],
    ['2.G.A.3', '2', 'fraction', 'Halves, thirds and fourths'],

    ['3.OA.A.1', '3', 'times', 'Equal groups (multiplying)'],
    ['3.OA.A.2', '3', 'times', 'Share equally (dividing)'],
    ['3.OA.C.7', '3', 'times', 'Times tables by heart', 4000],
    ['3.OA.D.8', '3', 'add', 'Two-step problems in her head'],
    ['3.NBT.A.1', '3', 'place', 'Round to the nearest 10 or 100'],
    ['3.NF.A.1', '3', 'fraction', 'Fractions as equal parts (3/4)'],
    ['3.MD.A.1', '3', 'measure', 'Time to the minute and time passing'],
  ];
  const STRANDS = { count: 'Counting and comparing', add: 'Adding and taking away', place: 'Place value and bigger numbers', times: 'Multiplying and dividing', measure: 'Time and money', fraction: 'Fractions' };
  const SKILLS = {};
  for (const [c, grade, strand, name, fast, from] of LIST) SKILLS[c] = { c, grade, strand, name, fast: fast || 0, from: from || null };

  /* ---------------- storage ---------------- */
  const blank = () => ({ v: 1, s: {} });
  function read() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.s && typeof d.s === 'object') return d; } catch (e) {}
    return blank();
  }
  function write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  // codes: one code or a list (a change problem is both money and taking away)
  function log(codes, o) {
    o = o || {};
    const list = (Array.isArray(codes) ? codes : [codes]).filter(c => SKILLS[c]);
    if (!list.length) return;
    const d = read(), t = Math.round((o.t || Date.now()) / 1000), ds = Math.max(0, Math.min(9999, Math.round((+o.ms || 0) / 100)));
    for (const c of new Set(list)) {
      const k = d.s[c] || (d.s[c] = { n: 0, e: [] });
      k.n++; k.e.push([t, o.ok ? 1 : 0, ds, String(o.game || '').slice(0, 12), o.bare ? 1 : 0]);
      if (k.e.length > KEEP) k.e.splice(0, k.e.length - KEEP);
    }
    write(d);
  }

  // Two devices' copies: keep every try either side has (by time and game), and the larger count.
  function merge(a, b) {
    const out = blank();
    for (const c of new Set(Object.keys(a.s || {}).concat(Object.keys(b.s || {})))) {
      const x = (a.s || {})[c] || { n: 0, e: [] }, y = (b.s || {})[c] || { n: 0, e: [] }, seen = new Set(), e = [];
      for (const r of (x.e || []).concat(y.e || [])) { const id = r[0] + '/' + r[3] + '/' + r[1]; if (!seen.has(id)) { seen.add(id); e.push(r); } }
      e.sort((p, q) => p[0] - q[0]);
      out.s[c] = { n: Math.max(x.n || 0, y.n || 0, e.length), e: e.slice(-KEEP) };
    }
    return out;
  }

  /* ---------------- mastery ---------------- */
  const day = t => { const d = new Date(t * 1000); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  // A fluency skill made from others (2.OA.B.2) pools the bare-fact tries of its sources.
  function tries(d, c) {
    const K = SKILLS[c];
    if (!K || !K.from) return ((d.s[c] || {}).e || []).slice();
    const out = [];
    for (const s of K.from) for (const r of ((d.s[s] || {}).e || [])) if (r[4]) out.push(r);
    return out.sort((p, q) => p[0] - q[0]);
  }
  function status(c, d) {
    d = d || read();
    const K = SKILLS[c] || {}, all = tries(d, c), recent = all.slice(-RECENT);
    const n = K.from ? all.length : ((d.s[c] || {}).n || all.length);
    if (!recent.length) return { code: c, state: 'new', n: 0 };
    const ok = recent.filter(r => r[1]).length, acc = ok / recent.length, days = new Set(recent.map(r => day(r[0]))).size;
    const last = recent[recent.length - 1][0], ms = median(recent.filter(r => r[1]).map(r => r[2] * 100));
    const bare = recent.filter(r => r[1] && r[4]).map(r => r[2] * 100), bareMs = median(bare);
    let state = recent.length < 3 || acc < 0.6 ? 'learning' : 'practicing';
    if (recent.length >= 8 && acc >= 0.85 && days >= 2) state = 'mastered';
    // right, but a plain fact still takes her longer than knowing it would: probably counting
    if (K.fast && bare.length >= 3 && bareMs > K.fast && (state === 'mastered' || (K.from && acc >= 0.85))) state = 'slow';
    if (state === 'mastered' && Date.now() / 1000 - last > REVIEW_DAYS * 86400) state = 'review';
    return { code: c, state, n, recent: recent.length, ok, acc, days, last: last * 1000, ms, bareMs };
  }
  // every skill's status, by grade
  function summary(d) {
    d = d || read();
    const by = {};
    for (const c in SKILLS) { const st = status(c, d), g = SKILLS[c].grade; (by[g] = by[g] || []).push(st); }
    return by;
  }

  /* ---------------- choosing a code from the numbers ---------------- */
  // add([a, b, ...]): which adding standard a sum belongs to
  function add(nums) {
    nums = nums.filter(x => x > 0); const s = nums.reduce((p, q) => p + q, 0);
    if (nums.length > 2) return s <= 20 ? '1.OA.A.2' : nums.every(x => x < 100) && s < 400 ? '2.NBT.B.6' : '2.NBT.B.7';
    const [a = 0, b = 0] = nums;
    if (s <= 5) return 'K.OA.A.5';
    if (s <= 10) return 'K.OA.A.2';
    if (s <= 20) return '1.OA.C.6';
    if (s <= 100) return (Math.min(a, b) === 10 ? '1.NBT.C.5' : Math.min(a, b) < 10 || a % 10 === 0 || b % 10 === 0 ? '1.NBT.C.4' : '2.NBT.B.5');
    if (Math.min(a, b) === 10 || Math.min(a, b) === 100) return '2.NBT.B.8';
    return '2.NBT.B.7';
  }
  // sub(whole, part, {missing}): taking away, or "how many more" (missing: true) which is a missing part
  function sub(w, p, o) {
    o = o || {};
    if (o.missing && w === 10) return 'K.OA.A.4';
    if (o.missing && w <= 10) return 'K.OA.A.3';
    if (o.missing && w <= 20) return '1.OA.B.4';
    if (w <= 5) return 'K.OA.A.5';
    if (w <= 10) return 'K.OA.A.2';
    if (w <= 20) return '1.OA.C.6';
    if (w <= 100) return p === 10 ? '1.NBT.C.5' : p % 10 === 0 ? '1.NBT.C.6' : '2.NBT.B.5';
    return p === 10 || p === 100 ? '2.NBT.B.8' : '2.NBT.B.7';
  }
  // times(groups, each, {rows, fact}): equal groups with pictures, rows, or a bare times-table fact
  function times(g, each, o) {
    o = o || {};
    if (o.fact) return '3.OA.C.7';
    if (o.rows) return '2.OA.C.4';
    return '3.OA.A.1';
  }
  // count(n): how many (small sets), or counting bigger numbers
  const count = n => n <= 20 ? 'K.CC.B.5' : '1.NBT.A.1';
  // compare(a, b): which is more
  const compare = (a, b, o) => { const m = Math.max(a, b); return (o && o.groups && m <= 10) ? 'K.CC.C.6' : m <= 10 ? 'K.CC.C.7' : m < 100 ? '1.NBT.B.3' : '2.NBT.A.4'; };
  // tens(n): reading a number made of tens and ones
  const tens = n => n < 20 ? 'K.NBT.A.1' : n < 100 ? '1.NBT.B.2' : '2.NBT.A.1';

  /* ---------------- tries from before this log existed ---------------- */
  // The Moonlit Map tags each question with a kind; the same kinds name its questions' standards.
  const KINDS = {
    'count to 10': 'K.CC.B.5', 'count objects': 'K.CC.B.5', 'count on': 'K.CC.A.2', 'compare within 10': 'K.CC.C.6',
    'next number across a ten': '1.NBT.A.1', 'compare 2-digit': '1.NBT.B.3', 'skip count 5s': '2.NBT.A.2', 'skip count 10s': '1.NBT.C.5',
    'compare 3-digit': '2.NBT.A.4', 'round to 10': '3.NBT.A.1', 'round to 100': '3.NBT.A.1',
    'teen numbers': 'K.NBT.A.1', 'tens & ones from blocks': '1.NBT.B.2', 'value of a digit': '1.NBT.B.2', '3-digit from blocks': '2.NBT.A.1',
    '3-digit with a zero': '2.NBT.A.1', '10 more': '2.NBT.B.8', '100 less': '2.NBT.B.8', 'expanded form, mixed order': '2.NBT.A.3', 'expanded form with a zero': '2.NBT.A.3',
    'add within 5': 'K.OA.A.5', 'add within 10': 'K.OA.A.2', 'add within 20': '1.OA.C.6', '2-digit add, no regrouping': '2.NBT.B.5',
    '2-digit add with regrouping': '2.NBT.B.5', '3-digit add with regrouping': '2.NBT.B.7',
    'take away within 5': 'K.OA.A.5', 'subtract within 10': 'K.OA.A.2', 'subtract within 20': '1.OA.C.6', '2-digit subtract, no regrouping': '2.NBT.B.5',
    '2-digit subtract with regrouping': '2.NBT.B.5', '3-digit subtract across zero': '2.NBT.B.7',
    'doubles with pictures': 'K.OA.A.2', 'count by 2s': '2.NBT.A.2', 'equal groups (picture)': '3.OA.A.1', 'sharing (division)': '3.OA.A.2',
    '×2 facts': '3.OA.C.7', '×5 facts': '3.OA.C.7', '×10 facts': '3.OA.C.7', '×3 facts': '3.OA.C.7', '×4 facts': '3.OA.C.7', '×6–×9 facts': '3.OA.C.7',
    'count pennies': 'K.CC.B.5', 'halves': '1.G.A.3', "o'clock": '1.MD.B.3', 'half past': '1.MD.B.3', 'dimes & pennies': '2.MD.C.8', 'mixed coins': '2.MD.C.8',
    'thirds & fourths': '3.NF.A.1', 'time to 5 minutes': '2.MD.C.7', 'time passing': '3.MD.A.1', 'fraction of a group': '3.NF.A.1', 'making change': '2.MD.C.8',
  };
  // Hoot's challenge board in the Toadstool Shop: kind and level (its log has no numbers, so this is the level's main skill)
  const BOARD = {
    tens: [, '1.NBT.B.2', '1.NBT.C.5', '1.NBT.C.5', '1.NBT.C.4', '1.NBT.C.4', '2.NBT.B.5', '2.NBT.B.5'],
    facts: [, 'K.OA.A.4', 'K.OA.A.2', '1.OA.C.6', '1.OA.C.6', '3.OA.C.7', '3.OA.C.7'],
    riddles: [, '3.OA.D.8', '3.OA.D.8', '3.OA.D.8', '3.OA.D.8', '3.OA.D.8', '3.OA.D.8'],
  };
  // Fairy Lantern Festival's own skill ids
  const FAIRY = {
    c5: 'K.CC.B.5', c10: 'K.CC.B.5', b5: 'K.OA.A.3', b10: 'K.OA.A.4', on12: 'K.OA.A.2', d5: 'K.OA.A.2', a10: 'K.OA.A.2', teen: 'K.NBT.A.1',
    m9: '1.OA.C.6', m8: '1.OA.C.6', m76: '1.OA.C.6', d10: '1.OA.C.6', s10: 'K.OA.A.2', s10x: '1.OA.C.6', sX: '1.OA.C.6', miss20: '1.OA.D.8',
    g10: '2.NBT.A.2', g50: '1.NBT.B.2', g99: '1.NBT.B.2', 'g+10': '1.NBT.C.5', g120: '1.NBT.A.1', gadd: '2.NBT.B.5', gaddR: '2.NBT.B.5',
  };
  // Gemling Grids sum walls by level: missing partners, three-number nooks, and differences (gap nooks)
  const GEMLING = [, '1.OA.D.8', '1.OA.D.8', '1.OA.D.8', '1.OA.D.8', '1.OA.D.8', '1.OA.A.2', '1.OA.A.2', '1.OA.B.4', '1.OA.A.2', '1.OA.A.2'];
  // Once per device: copy the tries the Moonlit Map, Fairy Lantern Festival, Gemling Grids and Hoot's board saved before this log, so her history shows.
  function importOld() {
    const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    // its own key, so resetting just the chart does not bring the old tries back
    if (get(IMP)) return 0;
    const was = [];
    const map = get('moonlit-map-v2');
    if (map && map.lands) for (const k in map.lands) {
      const L = map.lands[k], t = Date.parse(L.at) || Date.now();
      for (const it of L.items || []) if (KINDS[it.kind]) was.push([KINDS[it.kind], { ok: it.correct && !it.unsure, ms: (it.secs || 0) * 1000, game: 'moonlit-map', t }]);
    }
    const fairy = get('fairyLanternFestival.v1');
    if (fairy && Array.isArray(fairy.history)) for (const h of fairy.history) if (FAIRY[h.skill]) was.push([FAIRY[h.skill], { ok: h.firstTry, ms: h.ms, game: 'fairy-lantern', t: h.t }]);
    const gem = get('gemlingGrids.v1');
    if (gem && Array.isArray(gem.history)) for (const h of gem.history) if (h.track === 'sum' && !h.tut && GEMLING[h.level]) was.push([GEMLING[h.level], { ok: h.clean, ms: h.ms, game: 'gemling-grids', t: h.t }]);
    const shop = get('toadstoolShop.v1');
    if (shop && shop.ch && Array.isArray(shop.ch.log)) {
      // its entries keep the shop day but not the clock time, so they land a minute apart ending now
      // (they count for accuracy and speed; "on 2 different days" waits for new play)
      const end = shop.ch.log.length;
      shop.ch.log.forEach((x, i) => { const c = (BOARD[x.t] || [])[x.lv]; if (c) was.push([c, { ok: x.ok, ms: x.ms, game: 'board', bare: x.t !== 'riddles', t: Date.now() - (end - i) * 60000 }]); });
    }
    was.sort((a, b) => a[1].t - b[1].t);
    for (const [c, o] of was) log(c, o);
    try { localStorage.setItem(IMP, JSON.stringify({ v: 1, at: Date.now(), n: was.length })); } catch (e) {}
    return was.length;
  }

  G.GFKSkills = { KEY, SKILLS, LIST: LIST.map(r => r[0]), STRANDS, log, read, merge, status, summary, importOld, KINDS, BOARD, FAIRY, GEMLING, add, sub, times, count, compare, tens };
})(window);
