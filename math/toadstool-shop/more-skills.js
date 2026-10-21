/* More skills for The Toadstool Shop: telling the time, fair shares (fractions) and hundreds.

   Gabe (2026-10-21) looked at the grown-ups' math skills chart and saw that many of the 3rd grade skills had no
   practice in any game: all of telling the time, all of fractions, and the bigger-number skills (hundreds, numbers
   to 1000 in parts, 10 or 100 more, comparing three-digit numbers, rounding). So the shop gets three more strands,
   each a question maker the game's ask() can use anywhere in the story:
     T Time         1 o'clock, 2 half past, 3 to 5 minutes, 4 time passing and to the minute
     Q Fair shares  1 halves, 2 fourths, 3 thirds, 4 fractions (3/4 of the pie is left)
     H Hundreds     1 hundreds, tens and ones, 2 300 + 40 + 2, 3 10 or 100 more or less, 4 comparing, 5 rounding
   They show up where they fit the story: the shop clock when she opens, the oven clock and pies when the family
   bakes, Papa mending Old Hoot's clock and counting his nail boxes, Mrs. Bunbury's pies, Hoot's library.
   Every question names its Common Core code (std) for shared/skills.js, and the strands adapt like the others.

   Like mental.js this is a classic script that uses the game's globals (S, rnd, pick, shuffle, plural, Mental)
   at call time. */
(function (G) {
  'use strict';

  /* ---------------- look ---------------- */
  const CSS = `
.ms-clock{display:inline-block;width:190px;height:190px;filter:drop-shadow(0 4px 0 #d8c4a8)}
.ms-clock.sm{width:104px;height:104px;filter:none}
.ms-opt-time{font-size:24px;font-weight:800;white-space:nowrap}
.ms-pie{display:inline-block;width:150px;height:150px}
.opt .ms-pie{width:112px;height:112px}
.opt .ms-tray{width:132px;height:84px}
.ms-tray{display:inline-block;width:180px;height:110px}
.ms-frac{display:inline-flex;flex-direction:column;align-items:center;font-size:28px;font-weight:800;line-height:1}
.ms-frac i{display:block;width:30px;height:4px;border-radius:2px;background:currentColor;margin:3px 0}
.ms-word{font-size:22px;font-weight:800}
.ms-hun{display:inline-flex;align-items:flex-end;gap:6px;flex-wrap:wrap;justify-content:center;padding:6px 10px;border-radius:14px;background:#fffdf2}
.ms-box{display:inline-flex;flex-direction:column;align-items:center;font-size:13px;font-weight:700}
.ms-box span{display:block;width:58px;height:58px;border-radius:6px;background-color:#ffd27a;
  background-image:linear-gradient(#e0a92a 1px,transparent 1px),linear-gradient(90deg,#e0a92a 1px,transparent 1px);background-size:5.8px 5.8px;box-shadow:inset 0 0 0 2px #c98f55}
.ms-ten{display:inline-flex;flex-direction:column;align-items:center;font-size:13px;font-weight:700}
.ms-ten span{display:block;width:9px;height:58px;border-radius:3px;background-color:#9fd0f5;background-image:linear-gradient(#3f86c6 1px,transparent 1px);background-size:9px 5.8px;box-shadow:inset 0 0 0 2px #3f86c6}
.ms-ones{display:inline-grid;grid-template-columns:repeat(3,11px);gap:2px;align-content:end}
.ms-ones i{display:block;width:11px;height:11px;border-radius:2px;background:#f6a6bd;box-shadow:inset 0 0 0 2px #e2566b}
.ms-line{display:flex;align-items:flex-end;justify-content:center;gap:0;font-size:16px;font-weight:700}
.ms-line b{display:flex;flex-direction:column;align-items:center;width:30px;border-top:3px solid #6b4a33}
.ms-line b::before{content:'';display:block;width:2px;height:10px;background:#6b4a33}
.ms-line b.end{font-size:20px;color:#3f86c6}
.ms-line b.at{color:#c23f55;font-size:22px}
.ms-line b.at::before{width:6px;height:18px;background:#c23f55;border-radius:3px}
.ms-shelf{display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border-radius:14px;padding:8px 14px;box-shadow:0 4px 0 #d8c4a8;font-size:30px;font-weight:800}
.ms-shelf small{font-size:14px;font-weight:700}
`;
  function injectCSS() { if (document.getElementById('ms-css')) return; const s = document.createElement('style'); s.id = 'ms-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) injectCSS(); else document.addEventListener('DOMContentLoaded', injectCSS);

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // a..b
  const any = a => a[Math.floor(Math.random() * a.length)];
  const mix = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  // the answer and up to three different wrong choices (in the order given, skipping repeats and bad values)
  function choices(ans, wrong, ok = () => true) {
    const c = [ans];
    for (const w of wrong) { if (c.length >= 4) break; if (w !== ans && !c.includes(w) && ok(w)) c.push(w); }
    return c;
  }

  /* ================= T: telling the time ================= */
  const pad2 = m => (m < 10 ? '0' : '') + m;
  const hr = h => ((h - 1 + 120) % 12) + 1; // 1..12
  const key = (h, m) => `${hr(h)}:${pad2(m)}`;
  // how a time is said: 3 o'clock, half past 3, 25 past 3
  function words(h, m) { h = hr(h); return m === 0 ? `${h} o'clock` : m === 30 ? `half past ${h}` : `${m} past ${h}`; }
  // A felt clock face. fives: the minutes written round the edge (for the help); ticks: every minute marked.
  function clock(h, m, o = {}) {
    const c = 100, R = 80, pt = (deg, r) => [c + r * Math.sin(deg * Math.PI / 180), c - r * Math.cos(deg * Math.PI / 180)].map(v => v.toFixed(1));
    let s = `<svg class="ms-clock ${o.sm ? 'sm' : ''}" viewBox="0 0 200 200" role="img" aria-label="a clock">`;
    s += `<circle cx="${c}" cy="${c}" r="${R + 12}" fill="#c98f55"/><circle cx="${c}" cy="${c}" r="${R + 4}" fill="#fff8ec"/>`;
    s += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#e0cdb3" stroke-width="2" stroke-dasharray="5 4"/>`;
    for (let i = 0; i < 60; i++) {
      if (!o.ticks && i % 5) continue;
      const [x1, y1] = pt(i * 6, R - (i % 5 ? 4 : 8)), [x2, y2] = pt(i * 6, R - 1);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9b8268" stroke-width="${i % 5 ? 1.5 : 3}" stroke-linecap="round"/>`;
    }
    for (let n = 1; n <= 12; n++) { const [x, y] = pt(n * 30, R - 22); s += `<text x="${x}" y="${(+y + 7).toFixed(1)}" text-anchor="middle" font-size="21" font-weight="800" fill="#3b2a1a" font-family="inherit">${n}</text>`; }
    if (o.fives) for (let n = 1; n <= 12; n++) { const [x, y] = pt(n * 30, R + 7); s += `<text x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="inherit">${n * 5 === 60 ? '0' : n * 5}</text>`; }
    const [hx, hy] = pt((hr(h) % 12 + m / 60) * 30, 42), [mx, my] = pt(m * 6, 66);
    s += `<line x1="${c}" y1="${c}" x2="${hx}" y2="${hy}" stroke="#3b2a1a" stroke-width="10" stroke-linecap="round"/>`;
    s += `<line x1="${c}" y1="${c}" x2="${mx}" y2="${my}" stroke="#c23f55" stroke-width="6" stroke-linecap="round"/>`;
    s += `<circle cx="${c}" cy="${c}" r="7" fill="#ffd86b" stroke="#c98f55" stroke-width="2"/></svg>`;
    return s;
  }
  // The story bits for each place a clock turns up: read it (q), or time passing (later: d minutes from the clock).
  const TIME_STORY = {
    shop: { read: 'Friends come as soon as the shop opens. What time does my shop clock say?', later: d => `It is this time now. The shop opens in ${d} minutes. What time will it open?` },
    oven: { read: 'Into the oven they go! What time does the kitchen clock say?', later: d => `They go in the oven now. They bake for ${d} minutes. What time will they be ready?` },
    mend: { read: "I mended Old Hoot's clock, and it ticks again! What time does it say?", later: d => `Hoot's clock stopped ${d} minutes ago, at this time. What time is it now?` },
  };
  // T level 1-4 → an ask() question: {k, std, q, show, answer, opts, labels, help, helpSay, lastSay}
  function timeQ(T, story = 'shop') {
    const St = TIME_STORY[story] || TIME_STORY.shop, h = ri(1, 12);
    const timeLabel = (k, digital) => { const [a, b] = k.split(':').map(Number); return `<span class="ms-opt-time">${digital ? k : words(a, b)}</span>`; };
    const make = (std, hh, m, wrong, digital, extra) => {
      const ans = key(hh, m), opts = mix(choices(ans, wrong.map(([a, b]) => key(a, b))));
      return Object.assign({
        k: 'T', std, strat: 'none', show: () => clock(hh, m, { ticks: T >= 4 }), answer: ans, opts,
        labels: Object.fromEntries(opts.map(v => [v, timeLabel(v, digital)])),
        lastSay: `It's ${words(hh, m)}. Tap ${digital ? ans : words(hh, m)}.`,
      }, extra);
    };
    if (T <= 1 || (T === 2 && Math.random() < .35)) {
      // o'clock: the long hand points straight up. Mixing up the hands reads 12 o'clock as "h o'clock" backwards.
      return make('1.MD.B.3', h, 0, [[h + 1, 0], [h - 1, 0], [12, 0], [h, 30]], false, {
        q: St.read,
        help: () => `${clock(h, 0)}<div class="mm-tip">The long red hand points up to 12: that means <b>o'clock</b>. The short hand points to <b>${h}</b>.</div>`,
        helpSay: `The long hand points up to 12. That means o'clock. The short hand points to ${h}.`,
      });
    }
    if (T === 2) {
      // half past: the long hand points down to 6, and the short hand has gone halfway past the hour
      return make('1.MD.B.3', h, 30, [[h + 1, 30], [h, 0], [h + 1, 0], [h - 1, 30]], false, {
        q: St.read,
        help: () => `${clock(h, 30)}<div class="mm-tip">The long hand points down to 6: that is <b>half past</b>. The short hand is halfway between <b>${h}</b> and ${hr(h + 1)}: it has gone past ${h}.</div>`,
        helpSay: `The long hand points down to 6. That means half past. The short hand is halfway between ${h} and ${hr(h + 1)}.`,
      });
    }
    if (T === 3 || Math.random() < .25) {
      // to 5 minutes: count the long hand by fives. A common slip reads the number it points at (5) as the minutes.
      const n = any([1, 2, 3, 4, 5, 7, 8, 9, 10, 11]), m = n * 5, hh = h;
      const wrong = [[hh, n], [hh, m + 5 > 55 ? m - 10 : m + 5], [hh, m - 5 < 5 ? m + 10 : m - 5], [hh + 1, m]].filter(([, b]) => b >= 0 && b < 60);
      const fives = Array.from({ length: n }, (_, i) => (i + 1) * 5);
      return make('2.MD.C.7', hh, m, wrong, true, {
        q: St.read,
        help: () => `${clock(hh, m, { fives: true })}<div class="mm-tip">The short hand is past <b>${hh}</b>. Count the long hand by fives: ${fives.slice(0, Math.min(3, n - 1)).join(', ')}${n > 1 ? ', …' : '…'} keep going to the long hand.</div>`,
        helpSay: `The short hand is past ${hh}. Count the long hand by fives, from the 12. ${fives.slice(0, Math.min(3, n - 1)).join(', ')}${n > 1 ? ', and on' : ''}.`,
      });
    }
    if (Math.random() < .35) {
      // to the minute: count by fives to the last number, then on by ones
      let m; do m = ri(1, 59); while (m % 5 === 0);
      const five = m - m % 5;
      return make('3.MD.A.1', h, m, [[h, m + 1], [h, m - 1], [h, m + 5 <= 59 ? m + 5 : m - 5], [h + 1, m]].filter(([, b]) => b >= 0 && b < 60), true, {
        q: St.read,
        help: () => `${clock(h, m, { fives: true, ticks: true })}<div class="mm-tip">The short hand is past <b>${h}</b>. ${five ? `Count the long hand by fives to ${five}, then on by ones.` : 'Start at the 12 and count the little marks by ones.'}</div>`,
        helpSay: five ? `The short hand is past ${h}. Count the long hand by fives to ${five}. Then on by ones, one little mark at a time.` : `The short hand is past ${h}. Start at the 12 and count the little marks by ones.`,
      });
    }
    // time passing: the clock shows the start and she counts on d minutes (it stays inside the hour)
    const d = any([10, 15, 20, 25, 30]), s = 5 * ri(0, (55 - d) / 5), e = s + d;
    const steps = Array.from({ length: d / 5 }, (_, i) => key(h, s + (i + 1) * 5)).slice(0, -1).concat('?');
    return make('3.MD.A.1', h, e, [[h, e + 5 <= 55 ? e + 5 : e - 10], [h, s], [h, e - 5 >= 0 && e - 5 !== s ? e - 5 : e + 10], [h + 1, s]].filter(([, b]) => b >= 0 && b < 60), true, {
      q: St.later(d), show: () => clock(h, s, { ticks: true }),
      help: () => `${clock(h, s, { fives: true })}<div class="mm-tip">It is ${key(h, s)}. Count on ${d} minutes by fives: ${steps.join(', ')}.</div>`,
      helpSay: `It is ${key(h, s)}. Count on ${d} minutes by fives, one jump for each 5.`,
      lastSay: `It will be ${key(h, e)}. Tap ${key(h, e)}.`,
    });
  }

  /* ================= Q: fair shares ================= */
  const NAMES = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'] };
  // a cut is the list of where each piece starts, as a share of the whole (0 to 1)
  const fair = n => Array.from({ length: n }, (_, i) => i / n);
  const UNFAIR = { 2: [[0, .36], [0, .62]], 3: [[0, .22, .55], [0, .4, .58]], 4: [[0, .16, .45, .7], [0, .3, .4, .75]] };
  // A berry pie (round) or a tray bake (a rectangle), cut at `cut`; the first `gone` pieces are eaten.
  function pie(cut, o = {}) {
    const n = cut.length, gone = o.gone || 0;
    if (o.tray) {
      const W = 180, H = 110, x0 = 8, w = W - 16;
      let s = `<svg class="ms-tray" viewBox="0 0 ${W} ${H}" role="img" aria-label="a tray bake cut in ${n}"><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="12" fill="#c98f55"/>`;
      cut.forEach((a, i) => { const b = i + 1 < n ? cut[i + 1] : 1; s += `<rect x="${(x0 + a * w).toFixed(1)}" y="10" width="${((b - a) * w).toFixed(1)}" height="${H - 20}" fill="${i < gone ? '#f3e6d2' : '#e8b25f'}" stroke="#fff8ec" stroke-width="3" ${i < gone ? 'stroke-dasharray="5 4"' : ''}/>`; });
      return s + '</svg>';
    }
    const c = 75, R = 64, pt = (f, r) => [c + r * Math.sin(f * 2 * Math.PI), c - r * Math.cos(f * 2 * Math.PI)].map(v => v.toFixed(1));
    let s = `<svg class="ms-pie" viewBox="0 0 150 150" role="img" aria-label="a pie cut in ${n}"><circle cx="${c}" cy="${c}" r="${R + 8}" fill="#d9944e"/>`;
    cut.forEach((a, i) => {
      const b = i + 1 < n ? cut[i + 1] : 1, [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), big = b - a > .5 ? 1 : 0;
      const d = n === 1 ? `M${c - R} ${c}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0` : `M${c} ${c}L${x1} ${y1}A${R} ${R} 0 ${big} 1 ${x2} ${y2}Z`;
      s += `<path d="${d}" fill="${i < gone ? '#f3e6d2' : '#b8405a'}" stroke="#fff8ec" stroke-width="3" stroke-linejoin="round" ${i < gone ? 'stroke-dasharray="5 4"' : ''}/>`;
      if (i >= gone) { const [bx, by] = pt((a + b) / 2, R * .55); s += `<circle cx="${bx}" cy="${by}" r="5" fill="#7b2440" opacity=".55"/>`; }
    });
    return s + '</svg>';
  }
  const frac = (a, b) => `<span class="ms-frac">${a}<i></i>${b}</span>`;
  const word = w => `<span class="ms-word">${w}</span>`;
  // Q level 1-4 → an ask() question. who: how many are sharing comes from the story (people), when it fits.
  function shareQ(Q, ctx = {}) {
    const what = ctx.what || 'pie', tray = what !== 'pie';
    const draw = (cut, o) => pie(cut, Object.assign({ tray }, o));
    const n = Q <= 1 ? 2 : Q === 2 ? any([4, 4, 2]) : Q === 3 ? any([3, 3, 4, 2]) : any([3, 4, 4, 6, 8]);
    const kind = Q >= 4 ? (ctx.noLeft ? 'each' : any(['left', 'left', 'each'])) : Q === 1 ? any(['fair', 'fair', 'name']) : any(['fair', 'name', 'name']);
    const std = Q <= 2 ? '1.G.A.3' : Q === 3 ? '2.G.A.3' : '3.NF.A.1';
    const who = n === 2 ? (ctx.two || 'Papa and I') : `${n} of us`;
    if (kind === 'fair') {
      // which one is cut fairly for n? (wrong: the same number of pieces but not the same size, or the wrong number)
      const wrongN = n === 2 ? 3 : n === 3 ? any([2, 4]) : 3;
      // one wrong pie has n pieces of different sizes, the other is either cut unfairly too or fairly for another number
      const cuts = mix([['p0', fair(n)], ['p1', UNFAIR[n][0]], ['p2', Math.random() < .5 ? fair(wrongN) : UNFAIR[n][1]]]);
      const opts = cuts.map(([k]) => k), labels = Object.fromEntries(cuts.map(([k, c]) => [k, draw(c)]));
      return {
        k: 'Q', std, strat: 'none', answer: 'p0', opts, labels,
        q: `${who} will share a ${what}. Which ${what} is cut into ${n} equal pieces, one for each of us?`,
        help: () => `<div class="mm-tip">Count the pieces: we need ${n}. Then look: fair pieces are all the same size.</div>`,
        helpSay: `Fair means ${n} pieces, and every piece the same size.`,
        lastSay: `This one is cut into ${n} pieces the same size. Tap it.`,
      };
    }
    if (kind === 'name') {
      // what is each piece called?
      const list = Q <= 1 ? [2, 4] : Q === 2 ? [2, 4, 3] : [2, 3, 4];
      const opts = mix(choices(NAMES[n][0], list.map(x => NAMES[x][0]).concat(['whole']))).slice(0, 3);
      if (!opts.includes(NAMES[n][0])) opts[0] = NAMES[n][0];
      return {
        k: 'Q', std, strat: 'none', answer: NAMES[n][0], opts: mix(opts), labels: Object.fromEntries(opts.map(v => [v, word('one ' + v)])),
        q: `I cut the ${what} into ${n} equal pieces, one for each of ${n === 2 ? 'us two' : `the ${n} of us`}. What is each piece called?`,
        show: () => draw(fair(n)),
        help: () => `<div class="row">${draw(fair(n))}</div><div class="mm-tip">Count the pieces. 2 equal pieces are <b>halves</b>, 3 are <b>thirds</b>, 4 are <b>fourths</b>.</div>`,
        helpSay: 'Count the pieces. 2 equal pieces are halves. 3 are thirds. 4 are fourths.',
        lastSay: `Each piece is one ${NAMES[n][0]}. Tap one ${NAMES[n][0]}.`,
      };
    }
    if (kind === 'each') {
      // the fraction each one gets: 1/n
      const ans = `1/${n}`, opts = mix(choices(ans, [`1/${n === 3 ? 4 : 3}`, `${n}/1`, `1/${n === 2 ? 4 : 2}`]).slice(0, 3));
      return {
        k: 'Q', std, strat: 'none', answer: ans, opts, labels: Object.fromEntries(opts.map(v => [v, frac(...v.split('/'))])),
        q: `${n} of us share the ${what} fairly. What part of the ${what} does each of us get?`, show: () => draw(fair(n)),
        help: () => `<div class="row">${draw(fair(n))}</div><div class="mm-tip">The bottom number is how many pieces in the whole ${what}. The top number is how many each of us gets.</div>`,
        helpSay: `Each of us gets one piece. How many pieces are there in the whole ${what}? That number goes on the bottom.`,
        lastSay: `One out of ${n}. Tap one ${NAMES[n][0]}.`,
      };
    }
    // what part is left after some are eaten (3/4 means 3 of the 4 equal pieces)
    const eaten = ri(1, n - 1), left = n - eaten, ans = `${left}/${n}`;
    const opts = mix(choices(ans, [`${eaten}/${n}`, `${left}/${eaten}`, `1/${n}`, `${left}/${n + 1}`], v => { const [a, b] = v.split('/').map(Number); return a > 0 && b > 0; }).slice(0, 3));
    return {
      k: 'Q', std, strat: 'none', answer: ans, opts, labels: Object.fromEntries(opts.map(v => [v, frac(...v.split('/'))])),
      q: `The ${what} had ${n} equal pieces, and we ate ${eaten}. What part of the ${what} is left?`, show: () => draw(fair(n), { gone: eaten }),
      help: () => `<div class="row">${draw(fair(n), { gone: eaten })}</div><div class="mm-tip">Top number: the pieces still there. Bottom number: all the pieces the ${what} was cut into.</div>`,
      helpSay: `Count the pieces still there. That goes on top. All the pieces the ${what} was cut into go on the bottom.`,
      lastSay: `${left} out of ${n} is left. Tap ${left} over ${n}.`,
    };
  }

  /* ================= H: hundreds ================= */
  // boxes of 100, bundles of 10 and loose ones, with the thing's own words
  const UNITS = {
    books: { box: 'big box', boxes: 'big boxes', ten: 'stack', tens: 'stacks', one: 'book', many: 'books' },
    nails: { box: 'box', boxes: 'boxes', ten: 'bag', tens: 'bags', one: 'nail', many: 'nails' },
  };
  function hundreds(h, t, o) {
    return `<div class="ms-hun">${'<span class="ms-box"><span></span>100</span>'.repeat(h)}${'<span class="ms-ten"><span></span>10</span>'.repeat(t)}${o ? `<span class="ms-ones">${'<i></i>'.repeat(o)}</span>` : ''}</div>`;
  }
  const parts = n => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
  const ok3 = v => v >= 0 && v <= 999;
  const numOpts = (ans, wrong) => choices(ans, wrong, ok3).sort((a, b) => a - b);
  // a number line from lo to hi in ten steps, with n marked where it falls
  function roundLine(lo, hi, n) {
    const step = (hi - lo) / 10, at = Math.round((n - lo) / step);
    return `<div class="ms-line">${Array.from({ length: 11 }, (_, i) => `<b class="${i === at ? 'at' : i === 0 || i === 10 ? 'end' : ''}">${i === at ? n : i === 0 ? lo : i === 10 ? hi : i === 5 ? lo + 5 * step : ''}</b>`).join('')}</div>`;
  }
  // H level 1-5 → an ask() question about a pile of things (books, nails)
  function bigQ(H, thing = 'books', ctx = {}) {
    const U = UNITS[thing] || UNITS.books, who = ctx.who || 'I';
    if (H <= 1) {
      const h = ri(1, 4), t = ri(0, 6), o = ri(0, 9), n = h * 100 + t * 10 + o;
      return {
        k: 'H', std: '2.NBT.A.1', strat: 'tens', answer: n, opts: numOpts(n, [h * 100 + o * 10 + t, n + 100, n - 10, n + 10, h + t + o]),
        q: `${h} ${plural(h, U.box, U.boxes)} of 100 ${U.many}, ${t} ${plural(t, U.ten, U.tens)} of 10${o ? ` and ${o} more` : ''}. How many ${U.many} is that?`,
        show: () => hundreds(h, t, o),
        help: () => `${hundreds(h, t, o)}<div class="mm-tip">${h} hundreds is ${h * 100}. ${t} tens is ${t * 10}. ${o} ones. Together: <b>${h}</b> hundreds, <b>${t}</b> tens, <b>${o}</b> ones.</div>`,
        helpSay: `Count the hundreds first: ${Array.from({ length: h }, (_, i) => (i + 1) * 100).join(', ')}. Then the tens, then the ones.`,
      };
    }
    if (H === 2) {
      // 300 + 40 + 2, sometimes with a zero (300 + 5)
      const zero = Math.random() < .35, h = ri(1, 9), t = zero ? 0 : ri(1, 9), o = ri(1, 9), n = h * 100 + t * 10 + o;
      const sum = [h * 100, t * 10, o].filter(Boolean).join(' + ');
      return {
        k: 'H', std: '2.NBT.A.3', strat: 'tens', answer: n, opts: numOpts(n, zero ? [h * 10 + o, h * 100 + o * 10, h * 1000 + o, h + o] : [h * 100 + o * 10 + t, t * 100 + h * 10 + o, n + 10, n + 100, n - 10, n - 100]),
        q: `${who === 'I' ? 'I need' : who + ' needs'} ${sum} ${U.many}. Which number is that?`,
        show: () => `<div class="ms-shelf">${sum}<small>${U.many}</small></div>`,
        help: () => `${hundreds(h, t, o)}<div class="mm-tip">${h} hundreds, ${t} tens and ${o} ones${zero ? ': no tens, so a 0 in the middle' : ''}.</div>`,
        helpSay: zero ? `${h} hundreds, no tens, and ${o} ones. The zero keeps the tens place.` : `${h} hundreds, ${t} tens and ${o} ones.`,
      };
    }
    if (H === 3) {
      // 10 or 100 more or less: only one digit changes
      const big = Math.random() < .5, up = Math.random() < .55, d = big ? 100 : 10;
      // only one digit changes (no carrying into the hundreds), and it stays within 900 (2.NBT.B.8)
      let n; do n = ri(111, up && big ? 799 : 889); while (n % 10 === 0 || (!big && (up ? Math.floor(n / 10) % 10 === 9 : Math.floor(n / 10) % 10 === 0)));
      const a = up ? n + d : n - d, [h, t, o] = parts(n);
      return {
        k: 'H', std: '2.NBT.B.8', strat: 'tens', answer: a, opts: numOpts(a, [up ? n + (big ? 10 : 100) : n - (big ? 10 : 100), up ? n + 1 : n - 1, up ? n - d : n + d, n]),
        q: up ? `${who === 'I' ? 'I have' : who + ' has'} ${n} ${U.many}. Then ${d} more come. How many now?` : `${who === 'I' ? 'I have' : who + ' has'} ${n} ${U.many}, and ${d} go to a neighbour. How many are left?`,
        show: () => `<div class="ms-shelf">${n}<small>${up ? '+' : '−'} ${d}</small></div>`,
        help: () => `${hundreds(h, t, o)}<div class="mm-tip">${d} ${up ? 'more' : 'less'}: only the ${big ? 'hundreds' : 'tens'} change. ${big ? h : t} becomes ${big ? h + (up ? 1 : -1) : t + (up ? 1 : -1)}.</div>`,
        helpSay: `${d} ${up ? 'more' : 'less'}. Only the ${big ? 'hundreds' : 'tens'} change. The other numbers stay the same.`,
      };
    }
    if (H === 4) {
      // which is most (or fewest) of three: the same digits in another order, so she has to look at the hundreds first
      const [a, b, c] = mix([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3), nums = [a * 100 + b * 10 + c, b * 100 + a * 10 + c, a * 100 + c * 10 + b];
      const most = Math.random() < .65, ans = most ? Math.max(...nums) : Math.min(...nums);
      return {
        k: 'H', std: '2.NBT.A.4', strat: 'none', answer: ans, opts: nums.slice().sort((x, y) => x - y),
        q: `Three shelves of ${U.many}. Which shelf has the ${most ? 'most' : 'fewest'}?`,
        show: () => nums.map(v => `<span class="ms-shelf">${v}<small>${U.many}</small></span>`).join(''),
        help: () => `<div class="mm-tip">Look at the hundreds first: ${nums.map(v => Math.floor(v / 100)).join(', ')}. If they are the same, look at the tens.</div>`,
        helpSay: 'Look at the hundreds first. If they are the same, look at the tens.',
        lastSay: `It's ${ans}. Tap ${ans}.`,
      };
    }
    // about how many: round to the nearest ten (and from 3-digit numbers, the nearest hundred)
    const hundred = Math.random() < .4;
    // (not on the halfway mark, and for hundreds not so near a tick that the number line puts it on one)
    let n; do n = hundred ? ri(110, 890) : ri(12, 98); while (hundred ? (n % 100 < 6 || n % 100 > 94 || (n % 100 > 44 && n % 100 < 56)) : (n % 10 === 0 || n % 10 === 5));
    const step = hundred ? 100 : 10, lo = Math.floor(n / step) * step, hi = lo + step, ans = n - lo < hi - n ? lo : hi;
    return {
      k: 'H', std: '3.NBT.A.1', strat: 'none', answer: ans, opts: choices(ans, [ans === lo ? hi : lo, ans === lo ? lo - step : hi + step, n], ok3).slice(0, 3).sort((a, b) => a - b),
      q: `${who === 'I' ? 'I have' : who + ' has'} ${n} ${U.many}. About how many is that, to the nearest ${hundred ? 'hundred' : 'ten'}?`,
      show: () => roundLine(lo, hi, n),
      help: () => `${roundLine(lo, hi, n)}<div class="mm-tip">${n} is between ${lo} and ${hi}. Halfway is ${lo + step / 2}: is ${n} before it or after it?</div>`,
      helpSay: `${n} is between ${lo} and ${hi}. Which one is it nearer to?`,
    };
  }

  G.MoreSkills = { clock, words, timeQ, pie, fair, shareQ, hundreds, bigQ };
})(window);
