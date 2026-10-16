/* Mental math for The Toadstool Shop, shared by all three looks (felt, Lantern Tale, Pixel Valley).

   The goal is to move her from counting everything one by one to seeing numbers in chunks and using a few
   anchor facts (the research path: count all, then count on, then make 10, doubles, partners of 10):
   - dots(): every group of dots is drawn as ten-frames (rows of 5, frames of 10), so 7 reads as "5 and 2"
     and "3 short of 10" at a glance.
   - addHelp / sumHelp / subHelp: the Help button shows a strategy for these numbers (count on from the
     bigger number, doubles, near doubles, ten partners, make 10, count back, count up) instead of
     "count all the dots". The shopkeeper thinks it out loud. From level 3 the pictures fade to a number
     sentence, so the help gets less concrete as she gets stronger.
   - peek: some pictures show for a moment and then hide under a cloth, with a free "Peek again" button
     and no timer on the answer, so she has to see the amount rather than touch and count it.
   - charms: answering a strategy-shaped question right the first time without help earns charm points;
     3 of a kind earns a charm card (Doubles Mirror, Make-Ten Wand, ...). A small badge names the trick.
   - two day-off activities she can pick in the morning instead of opening the shop (from day 5):
     Hide and Seek with Mo's little brothers and sisters (partners of 5, 10 and 20 in a ten-room dollhouse),
     and Firefly Jars with Fern (quick looks, doubles, make 10).

   This is a classic script loaded before the game's own script; it uses the game's globals (S, ask, talk,
   say, speak, setPanel, ...) at call time, so every look must keep those names. */
(function (G) {
  'use strict';
  const DAY = 5; // day-off activities show up with the village

  /* ---------------- look ---------------- */
  const CSS = `
.tfs{display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center}
.dots i.e{background:transparent!important;box-shadow:inset 0 0 0 2px rgba(120,95,70,.35)!important}
.dots i.b2{background:#5aa9e6!important;box-shadow:none}
.dots i.x{opacity:.28;position:relative}
.dots i.x::after{content:"";position:absolute;left:-2px;right:-2px;top:50%;height:3px;margin-top:-1.5px;background:#6b4a33;transform:rotate(-40deg);border-radius:2px}
.dots i.ff{background:radial-gradient(circle at 40% 35%,#fffbe0,#ffe066 45%,#e8a92a)!important;box-shadow:0 0 8px #ffd94a!important}
.mm-bag{display:inline-flex;align-items:center;justify-content:center;min-width:52px;height:52px;padding:0 8px;border-radius:18px 18px 22px 22px;background:#c9935e;color:#fff;font-size:28px;font-weight:800;box-shadow:inset 0 -5px 0 rgba(0,0,0,.18)}
.mm-hops{display:inline-flex;align-items:flex-end;gap:4px;flex-wrap:wrap;justify-content:center}
.mm-hop{display:inline-flex;flex-direction:column;align-items:center;gap:2px;font-weight:800;font-size:18px}
.mm-hop i{display:block;width:18px;height:18px;border-radius:50%;background:#e2566b}
.mm-hop.b2 i{background:#5aa9e6}
.mm-hop b{min-width:22px;text-align:center}
.mm-hop.q b{color:#c23f55}
.mm-sent{font-size:30px;font-weight:800;letter-spacing:.5px;text-align:center}
.mm-sent .q{color:#c23f55}
.mm-tip{font-size:19px;font-weight:700;text-align:center}
.mm-peekable{position:relative}
.mm-peekable>.mm-cover{position:absolute;inset:-6px -20px;border-radius:16px;display:none;align-items:center;justify-content:center;gap:10px;
  background:repeating-linear-gradient(45deg,#d9a7b8 0 12px,#e8bccb 12px 24px);box-shadow:inset 0 0 0 3px #b98197;font-size:30px;z-index:2}
.mm-peekable.covered>.mm-cover{display:flex}
.mm-peekbtn{background:#e9f4ff;border-radius:999px;padding:8px 18px;font-size:20px;font-weight:700;box-shadow:0 4px 0 #a9c9ea;min-height:50px}
.mm-toast{position:fixed;left:50%;top:84px;transform:translate(-50%,-10px);z-index:60;background:#fff6c8;border:3px solid #e9b949;border-radius:999px;
  padding:6px 18px;font-size:22px;font-weight:800;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;white-space:nowrap}
.mm-toast.on{opacity:1;transform:translate(-50%,0)}
.mm-house{display:inline-grid;grid-template-columns:repeat(5,58px);gap:6px;padding:12px 10px 10px;background:#f3d9b1;border-radius:10px;
  box-shadow:inset 0 0 0 4px #b77b4c;position:relative;margin-top:30px}
.mm-house::before{content:"";position:absolute;left:-14px;right:-14px;top:-30px;height:32px;background:#c23f55;clip-path:polygon(0 100%,50% 0,100% 100%);border-radius:4px}
.mm-room{width:58px;height:58px;border-radius:6px;background:#fff8ec;box-shadow:inset 0 0 0 2px #d9b48a;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:30px}
.mm-room img{width:100%;height:100%;object-fit:cover}
.mm-room.empty{background:#efe1c9}
.mm-room.pop{animation:mmpop .5s ease-out}
@keyframes mmpop{0%{transform:scale(.4)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
.mm-houses{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
.mm-blanket{display:inline-flex;align-items:center;justify-content:center;width:120px;height:70px;border-radius:50% 50% 14px 14px;background:repeating-linear-gradient(90deg,#9fc7e8 0 14px,#bcd9f0 14px 28px);box-shadow:inset 0 -6px 0 rgba(0,0,0,.12);font-size:26px}
.mm-jar{display:inline-flex;flex-direction:column;align-items:center;gap:2px}
.mm-jar .lid{width:70%;height:12px;border-radius:6px 6px 2px 2px;background:#b77b4c}
.mm-jar .glass{padding:10px 8px;border-radius:12px 12px 22px 22px;background:rgba(40,60,90,.85);box-shadow:inset 0 0 0 3px rgba(255,255,255,.35)}
.mm-jar .glass .dots{background:transparent!important;box-shadow:none!important}
.mm-jar .glass .dots i.e{box-shadow:inset 0 0 0 2px rgba(255,255,255,.18)!important}
.mm-eyes{font-size:64px;text-align:center}
.mm-choose{display:grid;gap:12px;grid-template-columns:1fr;max-width:560px;margin:0 auto}
.mm-choose button{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:20px;background:#fff;box-shadow:0 5px 0 #e0cdb3;font-size:21px;font-weight:700;text-align:left;min-height:76px}
.mm-choose button .em{font-size:40px}
.mm-choose button.main{background:#fff6c8;box-shadow:0 5px 0 #e5d48a}
`;
  function injectCSS() { if (document.getElementById('mm-css')) return; const s = document.createElement('style'); s.id = 'mm-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) injectCSS(); else document.addEventListener('DOMContentLoaded', injectCSS);

  /* ---------------- ten-frames ---------------- */
  // cells: a class per dot, in order. Up to 5 dots sit in one row of 5; more fill frames of 10 (two rows of 5).
  // pad: fill the last row/frame with empty cells, so "7" shows as 7 dots and 3 gaps.
  function frames(cells, pad = true) {
    const n = cells.length; if (!n) return '<span class="dots"></span>';
    const size = n <= 5 ? 5 : 10, out = [];
    for (let i = 0; i < n; i += size) {
      const part = cells.slice(i, i + size);
      if (pad && n > 2) while (part.length < size) part.push('e');
      out.push(`<span class="dots">${part.map(c => `<i class="${c}"></i>`).join('')}</span>`);
    }
    return out.length > 1 ? `<span class="tfs">${out.join('')}</span>` : out[0];
  }
  // Same signature as the game's old dots(): n filled, shown out of `of` (the rest pale), extra class on each.
  function dots(n, of = 0, cls = '') {
    const cells = []; const total = Math.max(n, of);
    for (let i = 0; i < total; i++) cells.push(i >= n ? 'off ' + cls : cls);
    return frames(cells.map(c => c.trim()));
  }
  const fill = (n, c = '') => Array.from({ length: Math.max(0, n) }, () => c);
  // a: dots in the first colour, b: in the second (for showing two parts in one frame)
  const two = (a, b) => frames(fill(a).concat(fill(b, 'b2')));
  const bag = n => `<span class="mm-bag">${n}</span>`;
  // a hop along the numbers: from `from`, n hops up (or down), each labelled; the last one is left for her
  function hops(from, n, dir = 1, cls = '') {
    let s = '';
    for (let i = 1; i <= n; i++) s += `<span class="mm-hop ${cls} ${i === n ? 'q' : ''}"><i></i><b>${i === n ? '?' : from + dir * i}</b></span>`;
    return `<span class="mm-hops">${s}</span>`;
  }
  const sent = s => `<div class="mm-sent">${s.replace(/\?/g, '<span class="q">?</span>')}</div>`;

  /* ---------------- strategies ---------------- */
  // What kind of sum is a + b, so the help can show the trick that fits it?
  function addKind(a, b) {
    const big = Math.max(a, b), small = Math.min(a, b), s = a + b;
    if (!small) return 'none';
    if (a === b) return 'double';
    if (big - small === 1 && small >= 2) return 'neardouble';
    if (s === 10) return 'ten';
    if (big % 10 === 0) return 'tens';
    if (small <= 2) return 'counton';
    if (s > 10 && big >= 6 && big < 10) return 'make10';
    return 'counton';
  }
  // The help for a + b at level lv: {kind, html, say}. Level 3 and up: the number sentence only.
  function addHelp(a, b, lv = 1) {
    const big = Math.max(a, b), small = Math.min(a, b), kind = addKind(a, b), words = lv >= 3 || small > 10 || big > 20;
    switch (kind) {
      case 'double': return { kind, say: `${a} and ${a}. That's a double!`,
        html: words ? sent(`${a} + ${a} = ?`) + `<div class="mm-tip">A double!</div>` : `<div class="row">${dots(a)}${dots(a)}</div><div class="mm-tip">A double: ${a} and ${a}</div>` };
      case 'neardouble': return { kind, say: `${small} and ${small}. That makes ${small * 2}. Then 1 more.`,
        html: words ? sent(`${small} + ${small} + 1 = ?`) : `<div class="row">${dots(small)}${frames(fill(small).concat(['b2']))}</div><div class="mm-tip">${small} and ${small} is ${small * 2}. Then 1 more.</div>` };
      case 'ten': return { kind, say: `${a} and ${b} are ten partners. They fill the ten frame!`,
        html: words ? sent(`${a} + ${b} = ?`) + `<div class="mm-tip">Ten partners!</div>` : `${two(a, b)}<div class="mm-tip">${a} and ${b} fill the ten frame.</div>` };
      case 'tens': return { kind, say: `Start at ${big}. Then ${small} more.`,
        html: words ? sent(`${big} + ${small} = ?`) : `<div class="row">${dots(big)}${bag('+' + small)}</div><div class="mm-tip">Full tens and ${small} more.</div>` };
      case 'make10': { const need = 10 - big, rest = small - need; return { kind, say: `${big} needs ${need} more to make 10. Then ${rest} more.`,
        html: words ? sent(`${big} + ${need} = 10`) + sent(`10 + ${rest} = ?`) : `<div class="row">${frames(fill(big).concat(fill(need, 'b2')))}${frames(fill(rest, 'b2'))}</div><div class="mm-tip">${big} needs ${need} more to make 10. Then ${rest} more.</div>` }; }
      default: return { kind: 'counton', say: `I'll start at ${big} and count on ${small}.`,
        html: words ? sent(`${big} + ${small} = ?`) + `<div class="mm-tip">Start at ${big}, count on ${small}.</div>` : `<div class="row">${bag(big)}${hops(big, small)}</div><div class="mm-tip">Start at ${big}. Count on ${small}.</div>` };
    }
  }
  // A total of several prices (one per thing): two of them use addHelp; equal ones skip count;
  // otherwise start at the biggest and count on each of the others.
  function sumHelp(parts, lv = 1) {
    parts = parts.filter(p => p > 0).sort((x, y) => y - x);
    if (parts.length === 1) return { kind: 'none', say: `That's ${parts[0]}.`, html: dots(parts[0]) };
    if (parts.length === 2) return addHelp(parts[0], parts[1], lv);
    const p = parts[0];
    if (parts.every(x => x === p) && [1, 2, 5, 10].includes(p)) {
      const steps = parts.map((_, i) => (i + 1) * p);
      return { kind: 'skip', say: p === 1 ? `${parts.length} pennies.` : `Count by ${{ 2: 'twos', 5: 'fives', 10: 'tens' }[p]}.`,
        html: lv >= 3 ? sent(steps.slice(0, -1).join(', ') + ', ?') : `<div class="row">${parts.map((_, i) => `<span class="grp"><span class="lab">${i === parts.length - 1 ? '?' : steps[i]}</span>${dots(p)}</span>`).join('')}</div><div class="mm-tip">Count by ${p}s</div>` };
    }
    let run = p; const rest = parts.slice(1);
    const chips = rest.map((x, i) => { run += x; return `<span class="grp"><span class="lab">+${x} → ${i === rest.length - 1 ? '?' : run}</span>${dots(x)}</span>`; }).join('');
    return { kind: 'counton', say: `I'll start at ${p} and count on the rest.`,
      html: lv >= 3 ? sent(parts.join(' + ') + ' = ?') + `<div class="mm-tip">Start at ${p}, count on the rest.</div>` : `<div class="row">${bag(p)}${chips}</div><div class="mm-tip">Start at ${p}. Count on the rest.</div>` };
  }
  // whole take away part. Answer whole - part.
  function subKind(whole, part) {
    const left = whole - part;
    if (!part) return 'none';
    if (whole === 10 || whole === 5) return 'ten';
    if (part <= 3) return 'countback';
    if (left <= 3 || part * 2 >= whole) return 'countup';
    if (whole > 10 && whole < 20 && part > whole - 10) return 'back10';
    return 'countback';
  }
  function subHelp(whole, part, lv = 1) {
    const left = whole - part, kind = subKind(whole, part), words = lv >= 3 || whole > 20;
    const picture = frames(fill(left).concat(fill(part, 'x')));
    switch (kind) {
      case 'ten': return { kind, say: `What goes with ${part} to make ${whole}?`,
        html: words ? sent(`${part} + ? = ${whole}`) : `${frames(fill(part).concat(fill(left, 'e')), false)}<div class="mm-tip">${part} and what make ${whole}?</div>` };
      case 'countup': return { kind, say: `I'll start at ${part} and count up to ${whole}.`,
        html: words ? sent(`${part} + ? = ${whole}`) : `<div class="row">${bag(part)}${hops(part, left, 1, 'b2').replace(/<b>\?<\/b>/, `<b>${whole}</b>`)}</div><div class="mm-tip">Start at ${part}. Count up to ${whole}. How many hops?</div>` };
      case 'back10': { const ones = whole - 10, more = part - ones; return { kind, say: `Take away ${ones} to get to 10. Then ${more} more.`,
        html: words ? sent(`${whole} - ${ones} = 10`) + sent(`10 - ${more} = ?`) : `${picture}<div class="mm-tip">Take away ${ones} to get to 10. Then ${more} more.</div>` }; }
      default: return { kind: 'countback', say: `I'll start at ${whole} and count back ${part}.`,
        html: words ? sent(`${whole} - ${part} = ?`) + `<div class="mm-tip">Start at ${whole}, count back ${part}.</div>` : `<div class="row">${bag(whole)}${hops(whole, part, -1, 'b2')}</div><div class="mm-tip">Start at ${whole}. Count back ${part}.</div>` };
    }
  }

  /* ---------------- charms ---------------- */
  const CHARMS = {
    counton: { name: 'Counting-On Boots', emoji: '👢', rarity: 'common', praise: 'You counted on!' },
    countback: { name: 'Count-Back Ladder', emoji: '🪜', rarity: 'common', praise: 'You counted back!' },
    countup: { name: 'Count-Up Kite', emoji: '🪁', rarity: 'common', praise: 'You counted up!' },
    skip: { name: 'Skip-Counting Stones', emoji: '🪨', rarity: 'common', praise: 'You skip counted!' },
    double: { name: 'Doubles Mirror', emoji: '🪞', rarity: 'rare', praise: 'You used a double!' },
    neardouble: { name: 'Near-Double Twins', emoji: '👯', rarity: 'rare', praise: 'A near double!' },
    ten: { name: 'Ten Partners Locket', emoji: '💞', rarity: 'rare', praise: 'Ten partners!' },
    tens: { name: 'Bundle of Ten', emoji: '🎋', rarity: 'common', praise: 'A full ten!' },
    back10: { name: 'Back-to-Ten Lantern', emoji: '🏮', rarity: 'rare', praise: 'Back to ten!' },
    make10: { name: 'Make-Ten Wand', emoji: '🪄', rarity: 'sparkly', praise: 'You made a ten!' },
    peek: { name: 'Quick-Look Spyglass', emoji: '🔭', rarity: 'rare', praise: 'Quick look!' },
  };
  const NEED = 3;
  let toastT = null;
  function toast(text) {
    let t = document.querySelector('.mm-toast');
    if (!t) { t = document.createElement('div'); t.className = 'mm-toast'; document.body.appendChild(t); }
    t.textContent = text; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1700);
  }
  // A strategy-shaped answer right the first time with no help: name the trick, and every 3 earn its charm card.
  function credit(kind) {
    const c = CHARMS[kind]; if (!c) return;
    S.charms = S.charms || {};
    const n = S.charms[kind] = (S.charms[kind] || 0) + 1;
    toast(`${c.emoji} ${c.praise}`);
    if (n === NEED) {
      if (window.GFKCards) GFKCards.collect({ game: GAME, id: 'charm-' + kind, name: c.name, emoji: c.emoji, rarity: c.rarity });
      const got = Object.keys(CHARMS).filter(k => (S.charms[k] || 0) >= NEED).length;
      if (got >= 6 && window.GFKCards) GFKCards.collect({ game: GAME, id: 'charm-wizard', name: 'Number Wizard', emoji: '🧙', rarity: 'sparkly' });
    }
    save();
  }
  // Called by ask() when she gets it right. clean = first tap, no help.
  function solved(o, clean) {
    if (!clean) return;
    if (o.strat && o.strat !== 'none') credit(o.strat);
    if (o.peek && o._peek && o._peek.covered && !o._peek.peeks) credit('peek');
  }

  /* ---------------- peek and cover ---------------- */
  // ask() marks the picture row .mm-peekable when o.peek (ms) is set and calls armPeek after each draw.
  // The picture shows for o.peek ms, then a cloth covers it. "Peek again" lifts it for a moment, free and
  // as often as she likes. Opening the help lifts it for good.
  function armPeek(panel, o, helped) {
    const row = panel.querySelector('.mm-peekable'); if (!row) return;
    const P = o._peek || (o._peek = { covered: false, peeks: 0, timer: null, started: false });
    if (helped) { P.covered = false; clearTimeout(P.timer); return; }
    if (!row.querySelector('.mm-cover')) row.insertAdjacentHTML('beforeend', `<div class="mm-cover">🙈</div>`);
    let btn = panel.querySelector('.mm-peekbtn');
    if (!btn) { btn = document.createElement('button'); btn.className = 'mm-peekbtn'; btn.textContent = '👀 Peek again'; (panel.querySelector('.opts') || panel).insertAdjacentElement('afterend', btn); }
    const paint = () => { row.classList.toggle('covered', P.covered); btn.hidden = !P.covered; };
    btn.onclick = () => { P.peeks++; P.covered = false; paint(); if (window.SFX) SFX.tap(); clearTimeout(P.timer); P.timer = setTimeout(() => { P.covered = true; if (row.isConnected) paint(); }, 1500); };
    if (!P.started) { P.started = true; P.timer = setTimeout(() => { P.covered = true; if (row.isConnected) paint(); }, o.peek); }
    paint();
  }

  /* ---------------- the morning choice ---------------- */
  const ACTIVITIES = {
    hide: { name: 'Hide and seek', who: 'mo', emoji: '🐭', blurb: "with Mo's little brothers and sisters", run: hideSeek },
    fireflies: { name: 'Firefly jars', who: 'fern', emoji: '✨', blurb: 'with Fern at the fairy ring', run: fireflies },
  };
  // From day 5, before Bramble's cart: open the shop, or take a day off for an activity. Returns the activity id or null.
  function chooseDay() {
    if (S.day < DAY) return Promise.resolve(null);
    return new Promise(res => {
      say('keeper', 'Good morning! What shall I do today?');
      DBG.cur = { type: 'choose', options: ['shop'].concat(Object.keys(ACTIVITIES)) };
      const draw = () => setPanel(`<div class="mm-choose">
        <button class="main" data-a="shop"><span class="em">🍄</span><span>Open the shop<br><small>Earn pennies selling to friends</small></span></button>
        ${Object.entries(ACTIVITIES).map(([id, A]) => `<button data-a="${id}"><span class="em">${A.emoji}</span><span>${A.name}<br><small>${A.blurb}</small></span></button>`).join('')}
      </div>`, p => $$('[data-a]', p).forEach(b => b.addEventListener('click', () => { SFX.tap(); rerender = null; res(b.dataset.a === 'shop' ? null : b.dataset.a); })));
      rerender = draw; draw();
    });
  }
  // The day off itself; the game's night() puts her to bed afterwards.
  async function playDay() {
    const A = ACTIVITIES[S.play] || ACTIVITIES.hide;
    S.shop = null; S.spent = 0; S.profit = 0;
    S.offDay = { day: S.day, earned: 0, what: A.name.toLowerCase() };
    save();
    await A.run();
    TSV.cust = null; hush(); setPanel('');
    S.play = null; S.phase = 'night'; save();
  }
  function pay(who, n, tip, why) {
    const total = n + (tip ? 1 : 0);
    S.till += total; S.offDay.earned += total; save(); syncView(); hud();
    SFX.coin(1); sparkle($('#tillChip'), 10); mood('cust', 'happy', 2200); SFX.cheer();
    const coins = `<div class="tray tipcoin"><span class="lbl">${why}</span>${Array.from({ length: total }, () => coinHTML(1)).join('')}</div>`;
    return { total, coins };
  }

  /* ---------------- Hide and Seek with Mo's little brothers and sisters ---------------- */
  // Ten little mice, one per room of Aunt Clover's old dollhouse (two floors of five: a ten-frame).
  // She closes her eyes, some hide under the blanket, and she works out how many are hiding from how many
  // she can still see: partners of 5, then 10, then 20 (two dollhouses). The help counts up to the whole.
  const SIBS = [
    ['Button', '#b9ada3', '#f6a6bd'], ['Thimble', '#a07c5e', '#9fc7e8'], ['Bluebell', '#efe2cc', '#c9b6f0'], ['Nutmeg', '#c9a27a', '#ffd86b'],
    ['Clementine', '#f7f4ef', '#f6a6bd'], ['Pepper', '#8a7a6c', '#a8d8a0'], ['Sprout', '#b9ada3', '#a8d8a0'], ['Biscuit', '#d9b48a', '#9fc7e8'],
    ['Tinsel', '#efe2cc', '#ffd86b'], ['Little Bean', '#a89a8c', '#c9b6f0'],
  ];
  const sibSpec = i => ({ species: 'mouse', fur: SIBS[i % 10][1], dress: SIBS[i % 10][2], acc: [] });
  const sibImg = i => has3d() && Shop3D.portrait ? `<img src="${Shop3D.portrait(sibSpec(i))}" alt="">` : '🐭';
  // seen: how many mice are still in their rooms (they fill the rooms in order, like a ten-frame)
  function houses(whole, seen, popFrom = -1) {
    const per = whole <= 5 ? 5 : 10, out = [];
    for (let h = 0; h < whole; h += per) {
      let rooms = '';
      for (let i = h; i < h + per; i++) rooms += i < seen ? `<span class="mm-room ${i >= popFrom && popFrom >= 0 ? 'pop' : ''}">${sibImg(i)}</span>` : '<span class="mm-room empty"></span>';
      out.push(`<span class="mm-house" style="${per === 5 ? 'grid-template-rows:58px' : ''}">${rooms}</span>`);
    }
    return `<div class="mm-houses">${out.join('')}</div>`;
  }
  // the felt look bakes each little mouse's portrait the first time it is drawn; do it a few at a time while she reads
  async function warmSibs() { if (!has3d() || !Shop3D.portrait) return; for (let i = 0; i < SIBS.length; i++) { await wait(120); sibImg(i); } }
  async function hideSeek() {
    const who = 'mo';
    warmSibs();
    setScene('inside'); TSV.cust = CAST[who].spec; mood('cust', 'happy', 1500);
    await wait(has3d() ? 1300 : 150);
    if (coachOnce('hideseek')) {
      await talk('mo', 'Hi! My little brothers and sisters are visiting. Will you play hide and seek with us?', 'Yes please!');
      await talk('keeper', 'We can play in Aunt Clover\'s old dollhouse. It has ten little rooms.', 'Next', houses(10, 10));
    } else await talk('mo', pick(['Hello again! The little ones want to play hide and seek!', 'Hi! Can we play hide and seek again?']), 'Let\'s play!');
    TIP = { ok: true };
    const L = S.lv.S, rounds = 4;
    for (let r = 0; r < rounds; r++) {
      const whole = L <= 1 ? 5 : L <= 3 ? 10 : (r % 2 ? 20 : 10);
      const hide = whole === 5 ? 1 + rnd(4) : whole === 10 ? 1 + rnd(9) : 3 + rnd(15), seen = whole - hide;
      await talk('keeper', r ? `Again! ${whole} little mice in the ${whole > 10 ? 'dollhouses' : 'dollhouse'}.` : `${whole} little mice, one in each room. Ready?`, 'Close my eyes 🙈', houses(whole, whole));
      setPanel(`<div class="mm-eyes">🙈</div><div class="mm-tip">1, 2, 3 …</div>`); speak('1, 2, 3, 4, 5. Ready or not, here I come!');
      SFX.tap(); await wait(2600);
      const help = subHelp(whole, seen, L);
      await ask({
        k: 'S', who: 'mo', helpWho: 'keeper', strat: whole === 10 || whole === 5 ? 'ten' : help.kind,
        q: `Some of us are hiding under the blanket! How many are hiding?`, answer: hide,
        show: () => `${houses(whole, seen)}<span class="mm-blanket">🫣</span>`,
        peek: L >= 3 ? 3200 : 0,
        help: () => help.html, helpSay: help.say,
      });
      setPanel(`${houses(whole, whole, seen)}`); SFX.ok();
      mood('cust', 'happy', 1500);
      await talk('keeper', `Found you! ${seen} and ${hide}. That makes ${whole}!`, r === rounds - 1 ? 'All found!' : 'Play again!', houses(whole, whole));
    }
    const tip = !!(TIP && TIP.ok); TIP = null;
    const { coins } = pay(who, 2, tip, 'From Mo\'s mum');
    // a new little sibling card each time she plays, until she has all ten
    S.sibs = S.sibs || [];
    const nextSib = SIBS.findIndex((_, i) => !S.sibs.includes(i));
    if (nextSib >= 0) {
      S.sibs.push(nextSib); save();
      if (window.GFKCards) GFKCards.collect({ game: GAME, id: 'sib-' + SIBS[nextSib][0].toLowerCase().replace(/\s+/g, '-'), name: SIBS[nextSib][0], emoji: '🐭', rarity: nextSib === 9 ? 'rare' : 'common' });
    }
    await talk('mo', tip ? 'Thank you for playing! Mum says here are 2 pennies, and 1 more for getting every one right the first time!' : 'Thank you for playing! Mum says here are 2 pennies for looking after us.', 'Thank you!', coins);
    if (nextSib >= 0) await talk('keeper', `${SIBS[nextSib][0]} gave me a little card to keep!`, 'Lovely!', `<div class="row"><span class="mm-room">${sibImg(nextSib)}</span></div>`);
  }

  /* ---------------- Firefly Jars with Fern ---------------- */
  // Fireflies glow in a jar in rows of five, the lid closes, and she says how many she saw (a quick look).
  // Then two jars together (doubles, near doubles, make 10), and how many more to fill a jar of ten.
  const jar = (n, of = 0, label = '') => `<span class="mm-jar">${label ? `<span class="lab">${label}</span>` : ''}<span class="lid"></span><span class="glass">${frames(fill(n, 'ff').concat(fill(Math.max(0, of - n), 'e')), n > 2 || of > 0)}</span></span>`;
  async function fireflies() {
    const who = 'fern';
    setScene('outside', { time: 'evening' }); TSV.cust = CAST[who].spec; mood('cust', 'happy', 1500);
    await wait(has3d() ? 900 : 100);
    if (coachOnce('fireflies')) {
      await talk('fern', 'Hello! Tonight the fireflies come to the fairy ring. Will you help me count them for the fairy dance?', 'Yes please!');
      await talk('fern', 'They only glow for a moment, so look quickly! Fireflies sit in rows of five, like this.', 'Next', jar(7));
    } else await talk('fern', pick(['Hello again! The fireflies are out!', 'The fireflies are glowing tonight. Let\'s count them!']), 'Let\'s count!');
    TIP = { ok: true };
    const A = S.lv.A, plan = A <= 1 ? ['look', 'look', 'look', 'two'] : A === 2 ? ['look', 'two', 'two', 'fill'] : ['look', 'two', 'two', 'fill', 'two'];
    const look = A <= 1 ? 2600 : A === 2 ? 2000 : 1600;
    for (const kind of plan) {
      if (kind === 'look') {
        const n = A <= 1 ? 2 + rnd(4) : A === 2 ? 4 + rnd(7) : 6 + rnd(9);
        await ask({ k: 'N', who: 'fern', q: 'How many fireflies are in my jar?', answer: n, show: () => jar(n), peek: look, strat: 'none',
          help: () => `<div class="mm-tip">${n > 10 ? `A full ten and ${n - 10} more.` : n > 5 ? `A row of 5 and ${n - 5} more.` : 'Look at the row of 5.'}</div>`,
          helpWho: 'keeper', helpSay: n > 10 ? `A full ten and ${n - 10} more.` : n > 5 ? `A row of 5 and ${n - 5} more.` : 'Look at the row of 5.' });
      } else if (kind === 'two') {
        // small doubles first, then near doubles and make 10
        const [a, b] = A <= 1 ? (() => { const x = 1 + rnd(4); return [x, x]; })() : A === 2 ? pick([() => { const x = 2 + rnd(4); return [x, x]; }, () => { const x = 2 + rnd(4); return [x, x + 1]; }, () => [5, 1 + rnd(5)]])() :
          pick([() => { const x = 3 + rnd(5); return [x, x + 1]; }, () => { const x = 6 + rnd(4), need = 10 - x; return [x, need + 1 + rnd(9 - need)]; }, () => { const x = 4 + rnd(6); return [x, x]; }])();
        const help = addHelp(a, b, A);
        await ask({ k: 'A', who: 'fern', helpWho: 'keeper', strat: help.kind, q: `${a} fireflies in this jar, and ${b} in that one. How many fireflies altogether?`, answer: a + b,
          show: () => `<div class="row">${jar(a)}${jar(b)}</div>`, peek: A >= 3 ? 2400 : 0, help: () => help.html, helpSay: help.say });
      } else {
        const have = A <= 2 ? 5 + rnd(5) : 3 + rnd(7);
        const help = subHelp(10, have, A);
        await ask({ k: 'S', who: 'fern', helpWho: 'keeper', strat: 'ten', q: `This jar holds 10 fireflies. It has ${have}. How many more will fill it?`, answer: 10 - have,
          show: () => jar(have, 10), help: () => help.html, helpSay: help.say });
      }
      SFX.ok(); mood('cust', 'happy', 1200);
    }
    const tip = !!(TIP && TIP.ok); TIP = null;
    const { coins } = pay(who, 2, tip, 'From Fern');
    S.fireflyNights = (S.fireflyNights || 0) + 1; save();
    const LANTERNS = [['firefly-moonbeam', 'Moonbeam Firefly', 'common'], ['firefly-rosy', 'Rosy Firefly', 'common'], ['firefly-mint', 'Mint Firefly', 'common'], ['firefly-golden', 'Golden Firefly', 'rare'], ['firefly-starlight', 'Starlight Firefly', 'sparkly']];
    const card = LANTERNS[S.fireflyNights - 1];
    if (card && window.GFKCards) GFKCards.collect({ game: GAME, id: card[0], name: card[1], emoji: '✨', rarity: card[2] });
    await talk('fern', tip ? 'The fairies can dance all night! Here are 2 pennies, and 1 more for counting every jar right the first time!' : 'The fairies can dance all night! Here are 2 pennies for helping.', 'Thank you!', coins);
    if (card) await talk('fern', `And a ${card[1].toLowerCase()} to keep!`, 'Lovely!', jar(1));
  }

  // The bedtime line after a day off, for the game's night().
  function nightLine() {
    const O = S.offDay; if (!O || O.day !== S.day) return null;
    return `Day ${S.day} is done! I had a lovely day off playing ${O.what}, and I earned ${O.earned} ${O.earned === 1 ? 'penny' : 'pennies'}. Time for bed.`;
  }

  G.Mental = { DAY, frames, dots, two, bag, hops, addKind, addHelp, sumHelp, subKind, subHelp, CHARMS, credit, solved, armPeek, ACTIVITIES, chooseDay, playDay, nightLine, SIBS };
})(window);
