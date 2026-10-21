/* Hoot's challenge board for The Toadstool Shop: plain math problems that earn money for her house.

   Gabe (2026-10-17): she is in 3rd grade at a Waldorf school and behind. On the assessment she could not finish
   58, 68, 78, ? (she expected 50, 60, 70), and in class she cannot keep up with spoken chains like
   "10 take away 3, add 8, halve it", because she still counts every step on her fingers. She would happily do
   "mathy" games with direct rewards, even straight problems like 58 + 12, as long as they earn money to decorate
   her house, with a bonus for answering fast and no way to guess.

   So, on the notice board in Bramble Wood village, Old Hoot pins up challenge cards in three kinds:
   - Tens Trail (place value): tens and ones, 10 more and 10 less than any number, counting by 10s from 58,
     adding and taking away tens, getting to the next ten, then 2-digit adding and taking away.
   - Quick Facts (fluency): partners of 10, doubles, facts within 20, then the 2, 5 and 10 times tables
     (3rd grade in a Waldorf school), so the small steps become things she knows instead of counts.
   - Hoot's Riddles (spoken chains): Hoot says one step at a time. At first she types the new number after each
     step, which teaches the one trick that matters: keep only the number so far, never the whole sentence.
     Later the steps come one after another and she gives just the answer.
   She types every answer on a number pad, so there is nothing to guess from. Each answer right on the first try
   earns a penny, and a lightning penny more when it is quicker than her own usual time (her median for that
   kind and level), so she races herself. A miss earns nothing, rests the pad, and shows the way to work it out.
   Finishing a card pays 2 pennies more. A good card (4 of 5 first try) moves that kind up a level, a hard one
   (2 or fewer) moves it down. Reaching a new level earns a card for her binder.

   Like mental.js, this is a classic script loaded before the game's own script; it uses the game's globals
   (S, say, speak, talk, setPanel, ...) at call time. Progress is kept in S.ch. */
(function (G) {
  'use strict';
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // a..b
  const any = a => a[Math.floor(Math.random() * a.length)];
  const PER_CARD = 5, RIDDLES_PER_CARD = 3, CARD_BONUS = 2;
  const QUICK_MS = 1200; // a wrong answer this soon is a guess

  const TRACKS = {
    tens: { name: 'Tens Trail', emoji: '🔟', blurb: 'Tens and ones, 10 more, adding big numbers', max: 7, base: 12000 },
    facts: { name: 'Quick Facts', emoji: '⚡', blurb: 'Little facts to know by heart', max: 6, base: 6000 },
    riddles: { name: "Hoot's Riddles", emoji: '🦉', blurb: 'Listen, and keep the number in your head', max: 6, base: 7000 },
  };
  const LEVEL_NAMES = {
    tens: ['', 'Tens and ones', '10 more, 10 less', 'Counting by tens', 'Adding tens', 'To the next ten', 'Adding big numbers', 'Taking away big numbers'],
    facts: ['', 'Tens and doubles', 'Facts to 10', 'Facts to 20', 'Taking away to 20', 'Times 2, 5 and 10', 'Times 3 and 4, halves'],
    riddles: ['', 'Two steps', 'Three steps', 'In my head', 'Doubles and halves', 'Bigger numbers', 'Long riddles'],
  };

  function state() {
    S.ch = S.ch || {};
    const C = S.ch;
    C.lv = Object.assign({ tens: 1, facts: 1, riddles: 1 }, C.lv);
    C.cards = Object.assign({ tens: 0, facts: 0, riddles: 0 }, C.cards);
    C.times = C.times || {};   // "tens3": the last 12 first-try times in ms
    C.best = C.best || {};     // highest level reached per kind (for the binder cards)
    C.earned = C.earned || 0;  // all the money the board has paid
    C.log = C.log || [];       // a short history for grown-ups: {t, lv, ok, ms, day}
    // once a day Tens Trail and Quick Facts also ask the shared skills chart: mastered her level's skill in any game, a
    // harder card; struggling with it, an easier one (riddles are one skill at every level, so they go by her cards alone)
    for (const t of ['tens', 'facts']) {
      const lv = GFKSkills.place && GFKSkills.BOARD ? GFKSkills.place('board.' + t, GFKSkills.BOARD[t], C.lv[t], { max: TRACKS[t].max, game: GAME, name: "Hoot's board: " + TRACKS[t].name }) : null;
      if (typeof lv === 'number' && lv !== C.lv[t]) { C.lv[t] = lv; save(); }
    }
    return C;
  }

  /* ---------------- look ---------------- */
  const CSS = `
.ch-q{font-size:54px;font-weight:800;letter-spacing:1px;text-align:center;line-height:1.1}
.ch-q small{display:block;font-size:22px;font-weight:700;letter-spacing:0;color:#7a5a3c}
.ch-q .qm{color:#c23f55}
.ch-ans{display:inline-flex;align-items:center;justify-content:center;min-width:120px;height:72px;padding:0 18px;border-radius:18px;background:#fff;
  box-shadow:inset 0 0 0 4px #e0cdb3;font-size:48px;font-weight:800;color:#3b2a1a}
.ch-ans.empty{color:#c9b394}
.ch-ans.bad{animation:chshake .35s;box-shadow:inset 0 0 0 4px #e2566b}
.ch-ans.good{box-shadow:inset 0 0 0 4px #6aa76d;background:#effbe9}
@keyframes chshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.ch-pad{display:grid;grid-template-columns:repeat(6,minmax(64px,92px));gap:10px;justify-content:center}
.ch-pad button{min-height:68px;border-radius:18px;background:#fff;font-size:36px;font-weight:800;box-shadow:0 5px 0 #d8c4a8}
.ch-pad button.ok{background:var(--green);color:#fff;box-shadow:0 5px 0 #3f7342;font-size:30px}
.ch-pad button.del{background:#f3e6d2;font-size:28px}
.ch-pad.wait button{opacity:.45;filter:saturate(.5)}
.ch-top{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
.ch-dots{display:inline-flex;gap:6px}
.ch-dots i{width:22px;height:22px;border-radius:50%;background:#efe1c9;box-shadow:inset 0 0 0 2px #d9b48a;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:14px}
.ch-dots i.ok{background:#ffd86b;box-shadow:none}
.ch-dots i.zap{background:#ffd86b;box-shadow:0 0 8px #ffbf2a}
.ch-dots i.miss{background:#e9d9c4;box-shadow:none}
.ch-dots i.now{box-shadow:inset 0 0 0 3px #c23f55}
.ch-zap{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%) scale(.6);z-index:61;font-size:30px;font-weight:800;background:#fff6c8;border:3px solid #e9b949;
  border-radius:999px;padding:8px 22px;opacity:0;transition:opacity .2s,transform .25s;pointer-events:none;white-space:nowrap}
.ch-zap.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.ch-show{background:#e9f4ff;border-radius:999px;padding:8px 18px;font-size:20px;font-weight:700;box-shadow:0 4px 0 #a9c9ea;min-height:50px}
.ch-sticks{display:inline-flex;align-items:flex-end;gap:6px;flex-wrap:wrap;justify-content:center;padding:6px 10px;border-radius:14px;background:#fffdf2}
.ch-stick{display:inline-grid;grid-template-rows:repeat(10,9px);gap:2px;padding:3px;border-radius:5px;background:#3f86c6}
.ch-stick i,.ch-one{display:block;width:14px;height:9px;border-radius:2px;background:#9fd0f5}
.ch-stick.new{background:#c23f55}.ch-stick.new i{background:#ffb3c0}
.ch-stick.gone{opacity:.25}
.ch-ones{display:inline-grid;grid-template-columns:repeat(2,18px);gap:3px;align-content:end}
.ch-one{width:18px;height:18px;border-radius:4px;background:#ffd86b;box-shadow:inset 0 0 0 2px #e0a92a}
.ch-chart{display:inline-grid;gap:4px}
.ch-chart b{display:flex;align-items:center;justify-content:center;width:54px;height:44px;border-radius:8px;background:#fff8ec;box-shadow:inset 0 0 0 2px #d9b48a;font-size:22px}
.ch-chart b.hi{background:#ffd86b;box-shadow:none}
.ch-chart b.q{background:#ffe0e6;color:#c23f55}
.ch-chart b.dim{opacity:.45}
.ch-seq{font-size:40px;font-weight:800;letter-spacing:1px}
.ch-seq .t{color:#3f86c6}.ch-seq .o{color:#d48a12}
.ch-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;font-size:26px;font-weight:800}
.ch-line .n{background:#fff;border-radius:12px;padding:4px 12px;box-shadow:inset 0 0 0 3px #e0cdb3}
.ch-line .j{font-size:18px;color:#c23f55}
.ch-step{font-size:34px;font-weight:800;text-align:center}
.ch-step.old{font-size:22px;color:#9b8268;font-weight:700}
.ch-steps{display:flex;flex-direction:column;gap:4px;align-items:center}
.ch-hidden{font-size:44px}
.ch-menu{display:grid;gap:12px;grid-template-columns:1fr;max-width:620px;width:100%;margin:0 auto}
.ch-menu button{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:20px;background:#fff;box-shadow:0 5px 0 #e0cdb3;font-size:22px;font-weight:700;text-align:left;min-height:84px}
.ch-menu button .em{font-size:42px}
.ch-menu button small{font-weight:600;color:#7a5a3c}
.ch-stars{color:#e9a92a;letter-spacing:2px}
.ch-pay{display:flex;flex-direction:column;gap:6px;align-items:center;font-size:22px;font-weight:700}
@media (max-height:700px){.ch-q{font-size:42px}.ch-pad button{min-height:56px;font-size:30px}.ch-ans{height:60px;font-size:40px}.ch-stick{grid-template-rows:repeat(10,7px)}.ch-stick i{height:7px}}
`;
  function injectCSS() { if (document.getElementById('ch-css')) return; const s = document.createElement('style'); s.id = 'ch-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) injectCSS(); else document.addEventListener('DOMContentLoaded', injectCSS);

  /* ---------------- pictures ---------------- */
  // tens as sticks of ten, ones as little squares; extra: sticks added (red) or taken (faded)
  function sticks(t, o, extra = 0) {
    const stick = cls => `<span class="ch-stick ${cls}">${'<i></i>'.repeat(10)}</span>`;
    let h = '';
    for (let i = 0; i < t; i++) h += stick(extra < 0 && i >= t + extra ? 'gone' : '');
    for (let i = 0; i < extra; i++) h += stick('new');
    h += `<span class="ch-ones">${'<span class="ch-one"></span>'.repeat(o)}</span>`;
    return `<div class="ch-sticks">${h}</div>`;
  }
  // a column of the hundred chart: the numbers 10 apart above and below n, with one cell a ?
  function column(nums, q) {
    return `<div class="ch-chart" style="grid-template-columns:repeat(3,54px)">${nums.map(n => [n - 1, n, n + 1].map(m =>
      `<b class="${m === n ? (n === q ? 'q' : 'hi') : 'dim'}">${m === n && n === q ? '?' : m >= 0 && m <= 109 ? m : ''}</b>`).join('')).join('')}</div>`;
  }
  // a number with its tens digit blue and ones digit orange
  const split = n => n >= 10 ? `<span class="t">${Math.floor(n / 10)}</span><span class="o">${n % 10}</span>` : `<span class="o">${n}</span>`;
  // jumps along a number line: 58 → +10 → 68 → +2 → 70
  function jumps(start, list) {
    let h = `<span class="n">${start}</span>`, v = start;
    for (const d of list) { v += d; h += `<span class="j">${d > 0 ? '+' : '−'}${Math.abs(d)} ➜</span><span class="n">${v}</span>`; }
    return `<div class="ch-line">${h}</div>`;
  }
  const word = d => d > 0 ? 'plus' : 'take away';

  /* ---------------- Tens Trail ---------------- */
  // Each maker returns {q (big html), say, answer, show (picture, or null), pic (show the picture at first), help: {say, html}}
  const notRound = (lo, hi) => { let n; do n = ri(lo, hi); while (n % 10 === 0); return n; };
  const TENS = {
    1: () => {
      if (Math.random() < .6) {
        const t = ri(2, 8), o = ri(2, 9), n = t * 10 + o;
        return { std: GFKSkills.tens(n), q: `<span class="qm">?</span><small>${t} tens and ${o} ones</small>`, say: `${t} tens and ${o} ones. What number is that?`, answer: n, show: sticks(t, o), pic: true,
          help: { say: `${t} tens make ${t * 10}. ${o} more makes ${n}.`, html: `${sticks(t, o)}<div class="mm-tip">${t} tens = ${t * 10}, and ${o} more</div>` } };
      }
      const t = ri(2, 8), up = Math.random() < .6, n = t * 10, a = up ? n + 10 : n - 10;
      return { std: '1.NBT.C.5', q: `10 ${up ? 'more' : 'less'} than ${n}`, say: up ? `What is 10 more than ${n}?` : `What is 10 less than ${n}?`, answer: a, show: sticks(t, 0, up ? 1 : -1), pic: true,
        help: { say: up ? `One more ten. ${t} tens and 1 more ten makes ${t + 1} tens.` : `One ten less. ${t} tens take away 1 ten leaves ${t - 1} tens.`, html: sticks(t, 0, up ? 1 : -1) } };
    },
    2: () => {
      const n = notRound(11, 89), up = n < 20 || (n < 90 && Math.random() < .6), a = up ? n + 10 : n - 10, t = Math.floor(n / 10), o = n % 10;
      return { std: '1.NBT.C.5', q: `10 ${up ? 'more' : 'less'} than ${n}`, say: up ? `What is 10 more than ${n}?` : `What is 10 less than ${n}?`, answer: a, show: column(up ? [n, a] : [a, n], a), pic: true,
        help: { say: up ? `10 more. The tens go up by 1. The ones stay ${o}.` : `10 less. The tens go down by 1. The ones stay ${o}.`,
          html: `${sticks(t, o, up ? 1 : -1)}<div class="ch-seq">${split(n)} ➜ ${split(a)}</div>` } };
    },
    3: () => {
      const up = Math.random() < .65, s = up ? notRound(11, 59) : notRound(41, 99), d = up ? 10 : -10, seq = [s, s + d, s + 2 * d], a = s + 3 * d, o = s % 10;
      return { std: '1.NBT.C.5', q: `${seq.join(', ')}, <span class="qm">?</span>`, say: `${seq.join(', ')}. What comes next?`, answer: a, show: column(up ? [...seq, a] : [a, ...seq.slice().reverse()], a), pic: false,
        help: { say: `Look at the ones. They stay ${o}. Only the tens change.`, html: `<div class="ch-seq">${seq.map(split).join(', ')}, …</div><div class="mm-tip">The ones stay ${o}. The tens go ${up ? 'up' : 'down'} 1 each time.</div>` } };
    },
    4: () => {
      const up = Math.random() < .6, k = ri(2, 4) * 10;
      const n = up ? notRound(11, 99 - k) : notRound(k + 1, 99), a = up ? n + k : n - k, t = k / 10;
      const steps = Array.from({ length: t }, () => up ? 10 : -10);
      return { std: up ? GFKSkills.add([n, k]) : GFKSkills.sub(n, k), q: `${n} ${up ? '+' : '−'} ${k}`, say: `${n} ${word(up ? 1 : -1)} ${k}.`, answer: a, show: sticks(Math.floor(n / 10), n % 10, up ? t : -t), pic: false,
        help: { say: up ? `Count on by tens from ${n}.` : `Count back by tens from ${n}.`, html: `${jumps(n, steps)}<div class="mm-tip">${k} is ${t} tens</div>` } };
    },
    5: () => {
      const n = notRound(12, 88), next = Math.ceil(n / 10) * 10, need = next - n;
      if (Math.random() < .45) return { std: '1.NBT.C.4', q: `${n} + <span class="qm">?</span> = ${next}`, say: `${n} plus what makes ${next}?`, answer: need, show: sticks(Math.floor(n / 10), n % 10), pic: false,
        help: { say: `Look at the ones. ${n % 10} needs ${need} more to make 10.`, html: `${sticks(Math.floor(n / 10), n % 10)}<div class="mm-tip">${n % 10} and ${need} make 10</div>` } };
      const d = ri(need + 1, 9), a = n + d;
      return { std: GFKSkills.add([n, d]), q: `${n} + ${d}`, say: `${n} plus ${d}.`, answer: a, show: null, pic: false,
        help: { say: `${n} and ${need}. That makes ${next}. Then ${d - need} more.`, html: jumps(n, [need, d - need]) } };
    },
    6: () => {
      let a, b; do { a = ri(14, 78); b = ri(11, 45); } while (a + b > 99 || b % 10 === 0 || a % 10 === 0);
      const bt = Math.floor(b / 10) * 10, bo = b % 10, ans = a + b;
      return { std: GFKSkills.add([a, b]), q: `${a} + ${b}`, say: `${a} plus ${b}.`, answer: ans, show: null, pic: false,
        help: { say: `First add the tens. ${a} and ${bt}. That makes ${a + bt}. Then add the ones. ${a + bt} and ${bo}. That makes ${ans}.`, html: jumps(a, [...Array(bt / 10).fill(10), bo]) } };
    },
    7: () => {
      let a, b; do { a = ri(31, 99); b = ri(11, 49); } while (a - b < 3 || b % 10 === 0);
      const bt = Math.floor(b / 10) * 10, bo = b % 10, ans = a - b;
      return { std: GFKSkills.sub(a, b), q: `${a} − ${b}`, say: `${a} take away ${b}.`, answer: ans, show: null, pic: false,
        help: { say: `First take away the tens. ${a} take away ${bt}. That leaves ${a - bt}. Then take away ${bo}. That leaves ${ans}.`, html: jumps(a, [...Array(bt / 10).fill(-10), -bo]) } };
    },
  };

  /* ---------------- Quick Facts ---------------- */
  const addFact = (a, b, lv) => { const h = Mental.addHelp(a, b, lv); return { std: GFKSkills.add([a, b]), q: `${a} + ${b}`, say: `${a} plus ${b}.`, answer: a + b, help: { say: h.say, html: h.html } }; };
  const subFact = (w, p, lv) => { const h = Mental.subHelp(w, p, lv); return { std: GFKSkills.sub(w, p), q: `${w} − ${p}`, say: `${w} take away ${p}.`, answer: w - p, help: { say: h.say, html: h.html } }; };
  const BY = { 2: 'Count by twos.', 3: 'Count by threes.', 4: 'Count by fours.', 5: 'Count by fives.', 10: 'Count by tens.' };
  const timesFact = (a, b) => {
    const list = Array.from({ length: a }, (_, i) => (i + 1) * b);
    return { std: '3.OA.C.7', q: `${a} × ${b}`, say: `${a} times ${b}.`, answer: a * b,
      help: { say: `${a} groups of ${b}. ${BY[b]} ${list.join('. ')}.`, html: `<div class="ch-line">${list.map(v => `<span class="n">${v}</span>`).join('')}</div><div class="mm-tip">${a} jumps of ${b}</div>` } };
  };
  const FACTS = {
    1: () => {
      if (Math.random() < .55) { const a = ri(1, 9), h = Mental.subHelp(10, a, 1); return { std: 'K.OA.A.4', q: `${a} + <span class="qm">?</span> = 10`, say: `${a} plus what makes 10?`, answer: 10 - a, help: { say: h.say, html: h.html } }; }
      const a = ri(1, 5); return addFact(a, a, 1);
    },
    2: () => Math.random() < .55 ? (() => { const a = ri(1, 8), b = ri(1, 10 - a); return addFact(a, b, 2); })() : (() => { const w = ri(4, 10), p = ri(1, w - 1); return subFact(w, p, 2); })(),
    3: () => any([
      () => { const a = ri(3, 10); return addFact(a, a, 3); },
      () => { const a = ri(3, 8); return addFact(a, a + 1, 3); },
      () => { const a = ri(6, 9), b = ri(11 - a, 9); return addFact(a, b, 3); },
      () => { const a = ri(1, 9); return addFact(10, a, 3); },
    ])(),
    4: () => any([
      () => { const w = ri(11, 18), p = ri(w - 9, 9); return subFact(w, p, 4); },
      () => { const a = ri(2, 9); return subFact(a * 2, a, 4); },
      () => { const a = ri(1, 9); return subFact(10 + a, a, 4); },
      () => { const a = ri(6, 9), b = ri(11 - a, 9); return addFact(a, b, 4); },
    ])(),
    5: () => { const b = any([2, 5, 10]), a = ri(2, 10); return timesFact(a, b); },
    6: () => any([
      () => { const b = any([3, 4]), a = ri(2, 10); return timesFact(a, b); },
      () => { const b = any([2, 5, 10]), a = ri(2, 10); return timesFact(a, b); },
      () => { const h = ri(2, 10); return { std: '3.OA.A.2', q: `half of ${h * 2}`, say: `What is half of ${h * 2}?`, answer: h, help: { say: `Half means two equal parts. ${h} and ${h}. That makes ${h * 2}.`, html: `<div class="row">${Mental.dots(h)}${Mental.dots(h)}</div>` } }; },
    ])(),
  };

  /* ---------------- Hoot's Riddles ---------------- */
  // A riddle is a start number and a few steps, all whole numbers kept between 0 and top.
  const RID = {
    1: { n: 2, top: 10, ops: ['add', 'take'], small: 4, each: true, keep: true },
    2: { n: 3, top: 15, ops: ['add', 'take'], small: 5, each: true, keep: false },
    3: { n: 3, top: 20, ops: ['add', 'take', 'double'], small: 6, each: false },
    4: { n: 4, top: 20, ops: ['add', 'take', 'double', 'half'], small: 8, each: false },
    5: { n: 4, top: 50, ops: ['add', 'take', 'double', 'half', 'add10', 'take10'], small: 9, each: false, auto: 3200 },
    6: { n: 5, top: 100, ops: ['add', 'take', 'double', 'half', 'add10', 'take10'], small: 9, each: false, auto: 2600 },
  };
  function riddle(lv) {
    const R = RID[lv];
    for (;;) {
      let v = ri(2, Math.min(10, R.top - 2)); const start = v, steps = [];
      for (let i = 0; i < R.n; i++) {
        const ok = R.ops.filter(op => op === 'add' ? v < R.top - 1 : op === 'take' ? v > 1 : op === 'double' ? v >= 2 && v * 2 <= R.top && v <= 10 : op === 'half' ? v >= 4 && v % 2 === 0 : op === 'add10' ? v + 10 <= R.top : v >= 11);
        const op = any(ok.filter(o => !steps.length || o !== steps[steps.length - 1].op).length ? ok.filter(o => !steps.length || o !== steps[steps.length - 1].op) : ok);
        let d, nv, text, sym;
        if (op === 'add') { d = ri(1, Math.min(R.small, R.top - v)); nv = v + d; text = `Add ${d}.`; sym = `+ ${d}`; }
        else if (op === 'take') { d = ri(1, Math.min(R.small, v - 1)); nv = v - d; text = `Take away ${d}.`; sym = `− ${d}`; }
        else if (op === 'double') { nv = v * 2; text = 'Double it.'; sym = '× 2'; }
        else if (op === 'half') { nv = v / 2; text = 'Halve it.'; sym = '÷ 2'; }
        else if (op === 'add10') { nv = v + 10; text = 'Add 10.'; sym = '+ 10'; }
        else { nv = v - 10; text = 'Take away 10.'; sym = '− 10'; }
        steps.push({ op, from: v, to: nv, text, sym }); v = nv;
      }
      // something more interesting than undoing the step before (add 4, take away 4; double it, halve it)
      const undo = steps.some((st, i) => i && steps[i - 1].from === st.to);
      if (!undo && v !== start) return { start, steps, answer: v };
    }
  }
  const stepSay = st => st.op === 'double' ? `Double ${st.from}. That makes ${st.to}.` : st.op === 'half' ? `Half of ${st.from}. That makes ${st.to}.` : st.op.startsWith('add') ? `${st.from} plus ${st.to - st.from}. That makes ${st.to}.` : `${st.from} take away ${st.from - st.to}. That leaves ${st.to}.`;

  /* ---------------- the number pad ---------------- */
  // Asks one question with a number pad. Returns {first: right on the first try, ms: time to that answer, misses}.
  // o: {q, say, who, answer, show, pic, help: {say, html}, extra (html above the pad), dots (progress html)}
  function padAsk(o) {
    return new Promise(res => {
      let typed = '', misses = 0, helped = false, rest = false, done = false, showPic = !!o.pic;
      const t0 = Date.now(); let shownAt = t0;
      DBG.cur = { type: 'pad', answer: o.answer };
      if (o.say) say(o.who || 'hoot', o.say);
      const draw = () => {
        setPanel(`
          ${o.dots ? `<div class="ch-top">${o.dots}</div>` : ''}
          ${o.q != null ? `<div class="ch-q">${o.q}</div>` : ''}
          ${o.extra || ''}
          ${showPic && o.show ? `<div class="row">${o.show}</div>` : ''}
          <div class="helpbox">${helped ? o.help.html : ''}</div>
          <div class="ch-ans ${typed ? '' : 'empty'}" id="chAns">${typed || '?'}</div>
          <div class="ch-pad ${rest ? 'wait' : ''}">${[1, 2, 3, 4, 5].map(d => `<button data-d="${d}">${d}</button>`).join('')}<button class="del" data-d="del" aria-label="Rub out">⌫</button>${[6, 7, 8, 9, 0].map(d => `<button data-d="${d}">${d}</button>`).join('')}<button class="ok" data-d="ok">OK</button></div>
          ${o.show && !showPic && !helped ? `<button class="ch-show" id="chShow">🧩 Show me a picture</button>` : ''}
          ${o.replay ? `<button class="ch-show" id="chReplay">🔁 Say it again</button>` : ''}`, p => {
          $$('[data-d]', p).forEach(b => b.addEventListener('click', () => key(b.dataset.d)));
          const sh = $('#chShow', p); if (sh) sh.addEventListener('click', () => { SFX.tap(); showPic = true; draw(); });
          const rp = $('#chReplay', p); if (rp) rp.addEventListener('click', () => { SFX.tap(); o.replay(); });
        });
      };
      const paint = () => { const a = $('#chAns'); if (a) { a.textContent = typed || '?'; a.classList.toggle('empty', !typed); } };
      async function key(d) {
        if (done || rest) return;
        if (d === 'del') { typed = typed.slice(0, -1); SFX.tap(); paint(); return; }
        if (d !== 'ok') { if (typed.length < 3) { typed = (typed === '0' ? '' : typed) + d; SFX.tap(); speak(typed); paint(); } return; }
        if (!typed) return;
        const v = +typed;
        if (v === o.answer) {
          done = true; rerender = null; G.removeEventListener('keydown', onKey);
          DBG.cur = { type: 'pad-done' };
          const a = $('#chAns'); if (a) { a.classList.add('good', 'pop'); sparkle(a, 10); }
          SFX.ok();
          await wait(650);
          res({ first: misses === 0, ms: Date.now() - t0, misses });
          return;
        }
        misses++; SFX.soft();
        const quick = Date.now() - shownAt < QUICK_MS;
        const a = $('#chAns'); if (a) { a.classList.remove('bad'); void a.offsetWidth; a.classList.add('bad'); }
        typed = ''; rest = true;
        if (misses === 1) { helped = true; say(o.helpWho || 'keeper', (quick ? 'Whoa, quick paws! ' : '') + o.help.say); }
        else say(o.helpWho || 'keeper', `It's ${o.answer}. Type ${o.answer}.`);
        draw();
        await wait(quick ? 3000 : 1600);
        rest = false; shownAt = Date.now(); if (!done) draw();
      }
      // a keyboard works too (for grown-ups and testing on a computer)
      const onKey = e => { if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('del'); else if (e.key === 'Enter') key('ok'); };
      G.addEventListener('keydown', onKey);
      rerender = draw; draw();
    });
  }

  /* ---------------- speed: racing her own usual time ---------------- */
  function target(C, k, track) {
    const L = C.times[k] || [];
    if (L.length < 3) return TRACKS[track].base;
    const s = L.slice().sort((a, b) => a - b);
    return Math.max(1500, s[Math.floor(s.length / 2)]);
  }
  function addTime(C, k, ms) { const L = C.times[k] = C.times[k] || []; L.push(ms); if (L.length > 12) L.shift(); }
  function zap(text) {
    let z = document.querySelector('.ch-zap'); if (!z) { z = document.createElement('div'); z.className = 'ch-zap'; document.body.appendChild(z); }
    z.textContent = text; z.classList.add('on'); clearTimeout(zap.t); zap.t = setTimeout(() => z.classList.remove('on'), 1100);
  }
  const dotsHTML = (marks, n, i) => `<span class="ch-dots">${Array.from({ length: n }, (_, j) => `<i class="${marks[j] || ''} ${j === i ? 'now' : ''}">${marks[j] === 'zap' ? '⚡' : ''}</i>`).join('')}</span>`;
  function earn(n) { S.till += n; S.ch.earned += n; save(); syncView(); hud(); for (let i = 0; i < n; i++) setTimeout(() => SFX.coin(i), i * 120); sparkle($('#tillChip'), 6 + n * 2); }

  /* ---------------- one card ---------------- */
  async function playCard(track) {
    const C = state(), lv = C.lv[track], k = track + lv, riddles = track === 'riddles';
    const n = riddles ? RIDDLES_PER_CARD : PER_CARD, marks = [];
    let firsts = 0, zaps = 0, pennies = 0;
    for (let i = 0; i < n; i++) {
      let r, std = '3.OA.D.8';
      if (riddles) r = await playRiddle(lv, dotsHTML(marks, n, i), C, k);
      else {
        const p = (track === 'tens' ? TENS : FACTS)[lv]();
        std = p.std;
        r = await padAsk(Object.assign({ who: 'keeper', dots: dotsHTML(marks, n, i) }, p));
      }
      // the grown-ups' skill chart: plain typed facts, so their times say whether she knows them or counts them
      GFKSkills.log(std, { ok: r.first, ms: r.ms, game: 'board', bare: !riddles });
      const fast = r.first && r.ms <= target(C, k, track);
      if (r.first) { addTime(C, k, r.ms); firsts++; pennies++; }
      if (fast) { zaps++; pennies++; }
      marks.push(fast ? 'zap' : r.first ? 'ok' : 'miss');
      C.log.push({ t: track, lv, ok: r.first, ms: r.ms, day: S.day }); if (C.log.length > 300) C.log.splice(0, C.log.length - 300);
      if (r.first) earn(fast ? 2 : 1);
      if (fast) { zap('⚡ Lightning! +1 more'); speak('Lightning quick!'); }
      else if (r.first) speak(any(['Yes!', "That's right!", 'You got it!', 'Perfect!']));
      save();
      await wait(fast ? 900 : 500);
    }
    // the card is done
    C.cards[track]++; earn(CARD_BONUS); pennies += CARD_BONUS;
    const good = firsts >= n - 1, hard = firsts <= Math.floor(n / 2) - (riddles ? 1 : 0);
    let moved = 0;
    if (good && lv < TRACKS[track].max) { C.lv[track]++; moved = 1; }
    else if (hard && lv > 1) { C.lv[track]--; moved = -1; }
    let newCard = null;
    if (C.lv[track] > (C.best[track] || 1) || (C.cards[track] === 1 && !C.best[track])) {
      C.best[track] = Math.max(C.lv[track], C.best[track] || 1);
      const L = C.lv[track], T = TRACKS[track];
      newCard = { game: GAME, id: `board-${track}-${L}`, name: `${T.name}: ${LEVEL_NAMES[track][L]}`, emoji: T.emoji, rarity: L >= 6 ? 'sparkly' : L >= 4 ? 'rare' : 'common' };
    }
    save();
    mood('cust', 'happy', 2400); SFX.cheer();
    const summary = `<div class="ch-pay"><div>${dotsHTML(marks, n, -1)}</div>
      <div class="tray tipcoin"><span class="lbl">From Old Hoot</span>${Array.from({ length: pennies }, () => coinHTML(1)).join('')}</div>
      <div>${firsts} right first try · ${zaps} ⚡ · card bonus ${CARD_BONUS}¢</div></div>`;
    const line = moved > 0 ? `Hoo! ${pennies} pennies for you. You are ready for a harder card!` : moved < 0 ? `Here are ${pennies} pennies. Next time I'll pin up an easier card to practise.` : `Hoo! ${pennies} pennies for you. Well done!`;
    await talk('hoot', line, 'Thank you!', summary);
    if (newCard && window.GFKCards) { GFKCards.collect(newCard); await talk('hoot', 'And a card for your binder!', 'Lovely!', `<div class="row"><span class="tag">${newCard.emoji} ${newCard.name}</span></div>`); }
  }

  // One riddle: Hoot says the start number and the steps one at a time.
  async function playRiddle(lv, dots, C, k) {
    const R = RID[lv], rid = riddle(lv);
    let firstAll = true, msLast = 0, misses = 0;
    const startLine = `Start with ${rid.start}.`;
    if (R.each) {
      // she types the new number after every step, so she only ever holds one number
      const done = [];
      say('hoot', startLine); await wait(1400);
      for (const st of rid.steps) {
        const before = R.keep ? `<div class="ch-step old">${startLine}</div>${done.join('')}` : `<div class="ch-step old">The number so far: ${st.from}</div>`;
        const r = await padAsk({ who: 'hoot', q: null, say: st.text, dots, extra: `<div class="ch-steps">${before}<div class="ch-step">${st.text}</div></div>`,
          answer: st.to, help: { say: stepSay(st), html: jumps(st.from, [st.to - st.from]) }, replay: () => say('hoot', st.text) });
        if (!r.first) { firstAll = false; misses += r.misses; }
        msLast = r.ms;
        done.push(`<div class="ch-step old">${st.text} ➜ ${st.to}</div>`);
      }
      return { first: firstAll, ms: msLast, misses };
    }
    // in her head: the steps come one at a time (she taps for the next, or they come on their own), then she answers
    const tell = async () => {
      let resolveStep = null;
      const go = () => { SFX.tap(); if (resolveStep) { const r = resolveStep; resolveStep = null; r(); } };
      const stepWait = () => R.auto ? wait(R.auto) : new Promise(r => { resolveStep = r; });
      const show = (text, last) => setPanel(`<div class="ch-top">${dots}</div><div class="ch-steps"><div class="ch-step">${text}</div></div><div class="mm-tip">Keep the number in your head!</div>${R.auto ? '' : `<button class="btn" id="nx">${last ? 'I know it! ▶' : 'Next step ▶'}</button>`}`,
        p => { const b = $('#nx', p); if (b) b.addEventListener('click', go); });
      DBG.cur = { type: 'riddle-step' }; DBG.next = go;
      say('hoot', startLine); show(startLine, false);
      await stepWait();
      for (const st of rid.steps) {
        const last = st === rid.steps[rid.steps.length - 1];
        say('hoot', st.text); show(st.text, last);
        await (last && R.auto ? wait(1600) : stepWait());
      }
      DBG.next = null;
    };
    await tell();
    const r = await padAsk({ who: 'hoot', q: null, say: 'What is the number now?', dots,
      extra: `<div class="ch-hidden">🦉❓</div>`, answer: rid.answer,
      help: { say: 'Let\'s do it one step at a time.', html: `<div class="ch-steps"><div class="ch-step old">${startLine}</div>${rid.steps.map(st => `<div class="ch-step old">${st.text} ➜ <b>${st.to}</b></div>`).join('')}</div>` },
      replay: () => say('hoot', [startLine, ...rid.steps.map(s => s.text)].join(' ')) });
    return r;
  }

  /* ---------------- the board ---------------- */
  // The game's visit() calls this with Old Hoot standing by the notice board.
  async function run() {
    const C = state();
    if (coachOnce('board')) {
      mood('cust', 'wave', 1600);
      await talk('hoot', 'Hoo! This is my challenge board. I pin up math cards for clever shopkeepers.', 'Next');
      await talk('hoot', 'Each card has 5 problems. You get a penny for every one you get right the first time.', 'Next');
      await talk('hoot', 'Answer quickly and you get a lightning penny too! And 2 more pennies for finishing a card.', 'Next');
      await talk('keeper', 'Then I can buy lovely things for my house!', "Let's try!");
    } else say('hoot', any(['Hoo! Which card would you like today?', 'Good day! Pick a card.', 'Hoo, hoo! Ready for a challenge?']));
    for (;;) {
      const pickT = await new Promise(res => {
        DBG.cur = { type: 'board', options: Object.keys(TRACKS) };
        const draw = () => setPanel(`
          <div class="ch-menu">${Object.entries(TRACKS).map(([id, T]) => {
            const L = C.lv[id];
            return `<button data-t="${id}"><span class="em">${T.emoji}</span><span>${T.name}<br><small>${LEVEL_NAMES[id][L]} · level ${L} of ${T.max}</small></span></button>`;
          }).join('')}</div>
          <div class="row"><span class="tag">From the board so far: ${C.earned}¢</span></div>
          <button class="btn alt" id="bye">Back to the lane</button>`, p => {
          $$('[data-t]', p).forEach(b => b.addEventListener('click', () => { SFX.tap(); rerender = null; res(b.dataset.t); }));
          $('#bye', p).addEventListener('click', () => { SFX.tap(); rerender = null; res(null); });
        });
        rerender = draw; draw();
      });
      if (!pickT) break;
      DBG.cur = { type: 'card', track: pickT };
      const T = TRACKS[pickT];
      if (pickT === 'riddles' && coachOnce('riddles')) {
        await talk('hoot', 'I will say a riddle, one step at a time. Here is my secret.', 'Next');
        await talk('hoot', 'You never have to remember the whole riddle. Just keep the number so far!', 'OK!');
      }
      say('hoot', 'Here we go!'); await wait(900);
      await playCard(pickT);
      say('hoot', any(['Another card?', 'Would you like another card?', 'Hoo! One more?']));
    }
    await talk('hoot', any(['Come back soon for more challenges!', 'Hoo! See you soon, clever one.']), 'Bye-bye!');
  }

  // For grown-ups (the game's info panel): a line about where she is.
  function summary() {
    const C = state();
    return Object.entries(TRACKS).map(([id, T]) => `${T.name} level ${C.lv[id]} (${LEVEL_NAMES[id][C.lv[id]]}), ${C.cards[id]} cards`).join(' · ') + ` · ${C.earned}¢ earned`;
  }

  G.Challenges = { TRACKS, LEVEL_NAMES, TENS, FACTS, riddle, run, summary, padAsk };
})(window);
