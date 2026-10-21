/* Family life for The Toadstool Shop (index.html loads it), a little like The Sims.

   From day 5 the shopkeeper can make her family: a husband and one to four children, each with a name, fur and
   clothes she picks (S.family). They live in her house at the end of the village lane (shop3d.js draws them in
   the room, the children smaller), and every day each child needs something:
     hungry   breakfast for everyone (equal groups: 5 of us, 2 pancakes each)
     bath     filling the bath with cups of warm water (partners of 5, 10 and 20)
     play     block towers (adding, with the strategy help) or skittles (taking away from 10)
     story    a bedtime story (counting on a few pages, then the page 10 more: 34, 44, 54)
   Looking after a need is a short question with the same help as the shop (ten-frames, count on, make 10,
   never "count them all"), and earns a heart. Hearts bring the children's drawings for the binder, and a day when
   every child is looked after is a happy family day. Once a day she can bake with the family from a recipe card
   (doubling, then sharing out), and what is left goes on her shop shelf to sell.

   The save keeps S.family = { papa: {name, fur, color, glasses}, kids: [{name, fur, style, color}], hearts,
   drawings, today: {day, needs: [need per child], done: [bool per child], baked}, happyDays }.
   Like mental.js this is a classic script that uses the game's globals (S, ask, talk, say, setPanel, CAST, ...)
   at call time. */
(function (G) {
  'use strict';
  const DAY = 5; // with the village and her house

  /* ---------------- look ---------------- */
  const CSS = `
.fm-make{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%}
.fm-pt{width:116px;height:116px;flex:none;border-radius:50%;background:#f3e6d2;display:grid;place-items:center;font-size:64px;overflow:hidden;box-shadow:0 4px 0 #d8c4a8}
.fm-pt img{width:118%;height:118%;object-fit:cover;object-position:50% 8%}
.fm-pt.kid{width:96px;height:96px}
.fm-opts{display:flex;flex-direction:column;gap:8px;align-items:center;max-width:560px}
.fm-opts .row{gap:8px}
.fm-opts .name{min-height:48px;padding:6px 12px;font-size:19px}
.fm-opts .swatch{width:50px;height:50px}
.fm-style{background:#fff;border-radius:16px;padding:6px 12px;font-size:19px;font-weight:700;box-shadow:0 4px 0 #d8c4a8;min-height:50px}
.fm-style.sel{background:#fff6c8;outline:4px solid var(--gold)}
.fm-count{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.fm-count button{background:#fff;border-radius:20px;padding:8px 14px;box-shadow:0 5px 0 #d8c4a8;font-size:30px;font-weight:800;min-width:96px;min-height:86px;display:flex;flex-direction:column;align-items:center}
.fm-count button small{font-size:22px;letter-spacing:-4px}
.fm-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;width:100%}
.fm-kid{display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border-radius:18px;padding:6px 8px 8px;box-shadow:0 5px 0 #d8c4a8;min-width:96px;font-size:16px;font-weight:700;position:relative}
.fm-kid .fm-pt{width:62px;height:62px;box-shadow:none}
.fm-kid .need{position:absolute;top:-6px;right:-4px;background:#fffdf2;border-radius:50%;width:38px;height:38px;display:grid;place-items:center;font-size:24px;box-shadow:0 2px 0 #e5d48a,0 0 0 3px #e5d48a;animation:fmbob 1.6s ease-in-out infinite}
.fm-kid.done{background:#e3f2d8;box-shadow:0 5px 0 #8cc46c}
.fm-kid.done .need{animation:none;box-shadow:0 2px 0 #8cc46c,0 0 0 3px #8cc46c}
.fm-kid small{font-size:13px;font-weight:700;opacity:.75}
@keyframes fmbob{50%{transform:translateY(-4px)}}
.fm-hearts{font-size:18px;font-weight:700;text-align:center}
.fm-plate{display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:#fff;border-radius:50%;padding:10px 10px 12px;box-shadow:inset 0 0 0 4px #e8dccb,0 3px 0 #d8c4a8;min-width:92px}
.fm-plate .lab{font-size:15px;font-weight:700}
.fm-plate .fm-pt{width:40px;height:40px;box-shadow:none}
.fm-tub{display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:12px 14px 14px;border-radius:16px 16px 46px 46px;background:#f7f2ea;box-shadow:inset 0 0 0 4px #c9d6e2,0 4px 0 #b3c2cf}
.fm-tub .lab{font-size:15px;font-weight:700}
.fm-tower{display:inline-flex;flex-direction:column;align-items:center;gap:4px}
.fm-tower .lab{font-size:15px;font-weight:700}
.fm-book{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#fff;border-radius:10px 14px 14px 10px;padding:12px 18px;box-shadow:inset 6px 0 0 #c23f55,0 4px 0 #d8c4a8;font-size:26px;font-weight:800}
.fm-recipe{background:#fffdf2;border-radius:10px;padding:10px 16px;box-shadow:0 3px 12px rgba(74,52,40,.15);transform:rotate(-1deg);display:flex;flex-direction:column;gap:4px;align-items:center;font-size:20px}
.fm-recipe h4{margin:0;font-size:22px;color:#c23f55}
.fm-cup{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:8px 8px 18px 18px;background:#fff;box-shadow:inset 0 0 0 3px #d8c4a8;font-size:24px}
.fm-pins{font-size:30px;letter-spacing:2px}
.fm-rooms{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;width:100%}
.fm-rooms button{background:#fff;border-radius:999px;padding:6px 14px;font-size:18px;font-weight:700;box-shadow:0 4px 0 #d8c4a8;min-height:48px}
.fm-rooms button.on{background:#fff6c8;outline:3px solid var(--gold)}
.fm-rooms button.build{background:#e3f2d8;box-shadow:0 4px 0 #8cc46c}
.fm-tiles{display:inline-grid;gap:3px;padding:8px;background:#c9a27a;border-radius:10px}
.fm-tiles i{width:22px;height:22px;border-radius:3px;background:#f3e6d2;box-shadow:inset 0 0 0 2px #e0cdb3}
.fm-tiles i.r{background:#f6c3cf}
.fm-tiles .lab{grid-column:1/-1;font-size:14px;font-weight:700;color:#fff;text-align:right}
.fm-planks{display:inline-flex;gap:8px;align-items:flex-end;flex-wrap:wrap;justify-content:center}
.fm-bundle{display:inline-flex;flex-direction:column;align-items:center;gap:2px;font-size:14px;font-weight:700}
.fm-bundle span{display:inline-flex;gap:2px;padding:4px;border-radius:6px;box-shadow:inset 0 0 0 3px #e2566b}
.fm-ruler{position:relative;display:inline-block;padding:34px 10px 6px;background:#ffe9a8;border-radius:8px;box-shadow:inset 0 0 0 3px #e5c56a}
.fm-ruler .bar{position:absolute;top:8px;height:22px;border-radius:4px;background:repeating-linear-gradient(90deg,#d9a46a 0 18px,#c98f55 18px 20px);box-shadow:inset 0 -3px 0 #b77b4c}
.fm-ruler .bar.cut{background:repeating-linear-gradient(90deg,#f2c9a0 0 18px,#e6b88a 18px 20px);opacity:.75;box-shadow:none;border:2px dashed #b77b4c}
.fm-ruler .ticks{display:flex}
.fm-ruler .ticks b{width:24px;text-align:left;font-size:13px;border-left:2px solid #6b4a33;padding-left:2px;height:20px;line-height:24px}
.fm-bundle span i,.fm-plank{display:inline-block;width:7px;height:46px;border-radius:2px;background:#d9a46a;box-shadow:inset -2px 0 0 #b77b4c}
`;
  function injectCSS() { if (document.getElementById('fm-css')) return; const s = document.createElement('style'); s.id = 'fm-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) injectCSS(); else document.addEventListener('DOMContentLoaded', injectCSS);

  /* ---------------- who is in the family ---------------- */
  const PAPA_NAMES = ['Rowan', 'Jasper', 'Barnaby', 'Alder', 'Hugo', 'Oliver', 'Fennel', 'Bramwell'];
  const KID_NAMES = ['Pip', 'Rosie', 'Teddy', 'Lulu', 'Bertie', 'Tilly', 'Basil', 'Willow', 'Acorn', 'Sorrel', 'Juniper', 'Maple'];
  const COLORS = { red: '#e2566b', blue: '#7bb4e8', green: '#8cc46c', yellow: '#ffd86b', purple: '#b9a6e8', pink: '#f6a6bd' };
  // a child wears a dress with a bow, a sailor collar, or a scarf
  const STYLES = { dress: { emoji: '👗', name: 'Dress' }, sailor: { emoji: '⚓', name: 'Sailor' }, scarf: { emoji: '🧣', name: 'Scarf' } };
  const has = () => !!(S.family && S.family.papa);
  const kids = () => (S.family && S.family.kids) || [];
  const kidId = i => 'kid' + i;
  const isFam = id => id === 'papa' || /^kid\d$/.test(id);
  function papaSpec(p) {
    return { species: 'mouse', fur: FURS[p.fur] || FURS.brown, acc: ['scarf'].concat(p.glasses ? ['glasses'] : []), scarf: COLORS[p.color] || COLORS.blue, fam: 'papa' };
  }
  function kidSpec(k, i) {
    const c = COLORS[k.color] || COLORS.pink, base = { species: 'mouse', fur: FURS[k.fur] || FURS.grey, fam: kidId(i), kid: true };
    if (k.style === 'sailor') return Object.assign(base, { acc: ['sailor'] });
    if (k.style === 'scarf') return Object.assign(base, { acc: ['scarf'], scarf: c });
    return Object.assign(base, { dress: c, acc: ['bow'], bowColor: '#ffffff' });
  }
  // The family speak through the game's say()/talk()/ask(), which look people up in CAST, so they are added there.
  // Papa has a voice of his own; the children share one.
  function register() {
    for (const id of Object.keys(CAST)) if (isFam(id)) delete CAST[id];
    papaActivity();
    if (!has()) { TSV.family = []; return; }
    const F = S.family;
    CAST.papa = { name: F.papa.name, emoji: '🐭', spec: papaSpec(F.papa) };
    kids().forEach((k, i) => { CAST[kidId(i)] = { name: k.name, emoji: '🐭', spec: kidSpec(k, i) }; VOICE_OF[kidId(i)] = 'kid'; });
    sync();
  }
  // what shop3d.js draws in her house: Papa and the children in a row at the front of the room
  function sync() {
    // on Papa's day she is Papa, so the shopkeeper (Mama) stands with the children instead
    TSV.family = has() ? [playingPapa() ? { id: 'mama', spec: keeperSpec() } : { id: 'papa', spec: CAST.papa.spec }].concat(kids().map((_, i) => ({ id: kidId(i), spec: CAST[kidId(i)].spec, kid: true }))) : [];
    TSV.famMood = TSV.famMood || {};
  }
  const famT = {};
  function famMood(id, m, ms) { TSV.famMood = TSV.famMood || {}; TSV.famMood[id] = m; clearTimeout(famT[id]); if (ms) famT[id] = setTimeout(() => { delete TSV.famMood[id]; }, ms); }
  const pt = (id, cls = '') => `<span class="fm-pt ${cls}">${portrait(id)}</span>`;
  const names = list => list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];

  /* ---------------- making the family ---------------- */
  // From day 5, once a morning until she says yes: the house is quiet, shall she make her family?
  async function offer() {
    if (has() || S.day < DAY || !S.keeper || S.famAsked === S.day) return false;
    S.famAsked = S.day; save();
    mood('keeper', 'think', 2000);
    say('keeper', 'My little house is lovely, but it is very quiet. I wish I had a family to live there with me!');
    const yes = await new Promise(res => {
      const draw = () => setPanel(`<div class="row"><button class="btn" id="fy">Make my family 👪</button><button class="btn alt" id="fn">Maybe later</button></div>`, p => {
        $('#fy', p).addEventListener('click', () => { SFX.tap(); rerender = null; res(true); });
        $('#fn', p).addEventListener('click', () => { SFX.tap(); rerender = null; res(false); });
      });
      rerender = draw; draw();
    });
    if (!yes) return false;
    await make();
    return true;
  }
  // The make-my-family screens: Papa, how many children, then each child. With a family already, she changes it.
  async function make() {
    const was = TSV.scene === 'room' ? null : { scene: TSV.scene, time: TSV.time };
    SFX.door(); setScene('room', { room: 'home', time: 'day', cam: 'decorate' }); TSV.place = 'house'; TSV.cust = null;
    await wait(has3d() ? 700 : 100);
    const old = S.family ? JSON.parse(JSON.stringify(S.family)) : null;
    const F = S.family = S.family || { papa: null, kids: [], hearts: 0, drawings: [], today: null, happyDays: 0 };
    const used = () => [S.keeper.name, F.papa && F.papa.name].concat(F.kids.map(k => k.name));
    if (!F.papa) F.papa = { name: '', fur: 'brown', color: 'blue', glasses: false };
    register();
    // Papa
    say('keeper', old ? 'Here is my husband. Shall he look different?' : 'First, my husband! Pick his fur, his scarf and his name.');
    await new Promise(res => {
      const p = F.papa;
      const draw = () => setPanel(`<div class="fm-make">${pt('papa')}<div class="fm-opts">
        <div class="row">${Object.entries(FURS).map(([n, c]) => `<button class="swatch ${p.fur === n ? 'sel' : ''}" data-f="${n}" style="background:${c}" aria-label="${n} fur"></button>`).join('')}</div>
        <div class="row">${Object.entries(COLORS).map(([n, c]) => `<button class="swatch ${p.color === n ? 'sel' : ''}" data-c="${n}" style="background:${c}" aria-label="${n} scarf"></button>`).join('')}<button class="fm-style ${p.glasses ? 'sel' : ''}" id="fg">👓 Glasses</button></div>
        <div class="row">${PAPA_NAMES.map(n => `<button class="name ${p.name === n ? 'sel' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
      </div></div><button class="btn" id="nx" ${p.name ? '' : 'disabled'}>That's him!</button>`, q => {
        $$('[data-f]', q).forEach(b => b.addEventListener('click', () => { p.fur = b.dataset.f; register(); SFX.tap(); speak(p.fur + ' fur'); draw(); }));
        $$('[data-c]', q).forEach(b => b.addEventListener('click', () => { p.color = b.dataset.c; register(); SFX.tap(); speak('A ' + p.color + ' scarf'); draw(); }));
        $('#fg', q).addEventListener('click', () => { p.glasses = !p.glasses; register(); SFX.tap(); draw(); });
        $$('[data-n]', q).forEach(b => b.addEventListener('click', () => { p.name = b.dataset.n; register(); SFX.tap(); speak(p.name); famMood('papa', 'wave', 1500); draw(); }));
        $('#nx', q).addEventListener('click', () => { if (!p.name) return; SFX.ok(); rerender = null; res(); });
      });
      rerender = draw; draw();
    });
    famMood('papa', 'happy', 1800);
    // how many children
    say('keeper', `How many children do ${F.papa.name} and I have?`);
    const n = await new Promise(res => {
      const draw = () => setPanel(`<div class="fm-count">${[1, 2, 3, 4].map(k => `<button data-k="${k}" class="${F.kids.length === k ? 'own' : ''}">${k}<small>${'🐭'.repeat(k)}</small></button>`).join('')}</div>`, q => {
        $$('[data-k]', q).forEach(b => b.addEventListener('click', () => { SFX.tap(); speak(b.dataset.k); rerender = null; res(+b.dataset.k); }));
      });
      rerender = draw; draw();
    });
    F.kids = F.kids.slice(0, n);
    while (F.kids.length < n) {
      const i = F.kids.length;
      F.kids.push({ name: '', fur: pick(Object.keys(FURS)), style: i % 2 ? 'sailor' : 'dress', color: Object.keys(COLORS)[(i * 2 + 5) % 6] });
    }
    // each child
    for (let i = 0; i < n; i++) {
      const k = F.kids[i];
      register(); TSV.family = TSV.family.slice(0, i + 2); // the children appear one at a time
      say('keeper', n === 1 ? 'Now my little one! Pick their fur, clothes and name.' : `Now child number ${i + 1}! Pick their fur, clothes and name.`);
      await new Promise(res => {
        const draw = () => { const taken = used().filter(x => x !== k.name); setPanel(`<div class="fm-make">${pt(kidId(i), 'kid')}<div class="fm-opts">
          <div class="row">${Object.entries(FURS).map(([f, c]) => `<button class="swatch ${k.fur === f ? 'sel' : ''}" data-f="${f}" style="background:${c}" aria-label="${f} fur"></button>`).join('')}</div>
          <div class="row">${Object.entries(STYLES).map(([s, St]) => `<button class="fm-style ${k.style === s ? 'sel' : ''}" data-s="${s}">${St.emoji} ${St.name}</button>`).join('')}</div>
          ${k.style === 'sailor' ? '' : `<div class="row">${Object.entries(COLORS).map(([c, v]) => `<button class="swatch ${k.color === c ? 'sel' : ''}" data-c="${c}" style="background:${v}" aria-label="${c}"></button>`).join('')}</div>`}
          <div class="row">${KID_NAMES.filter(x => !taken.includes(x)).map(x => `<button class="name ${k.name === x ? 'sel' : ''}" data-n="${x}">${x}</button>`).join('')}</div>
        </div></div><button class="btn" id="nx" ${k.name ? '' : 'disabled'}>${i === n - 1 ? 'This is my family!' : 'Next child'}</button>`, q => {
          const redo = () => { register(); TSV.family = TSV.family.slice(0, i + 2); SFX.tap(); draw(); };
          $$('[data-f]', q).forEach(b => b.addEventListener('click', () => { k.fur = b.dataset.f; redo(); speak(k.fur + ' fur'); }));
          $$('[data-s]', q).forEach(b => b.addEventListener('click', () => { k.style = b.dataset.s; redo(); speak(STYLES[k.style].name); }));
          $$('[data-c]', q).forEach(b => b.addEventListener('click', () => { k.color = b.dataset.c; redo(); speak(k.color); }));
          $$('[data-n]', q).forEach(b => b.addEventListener('click', () => { k.name = b.dataset.n; redo(); speak(k.name); famMood(kidId(i), 'wave', 1500); }));
          $('#nx', q).addEventListener('click', () => { if (!k.name) return; SFX.ok(); rerender = null; res(); });
        }); };
        rerender = draw; draw();
      });
      famMood(kidId(i), 'happy', 1800);
    }
    // a child added or taken away changes today's needs
    if (F.today && F.today.needs.length !== n) {
      const was = F.today, order = shuffle(Object.keys(NEEDS));
      F.today = { day: was.day, needs: F.kids.map((_, j) => was.needs[j] || order[j % order.length]), done: F.kids.map((_, j) => !!was.done[j]), baked: was.baked, happy: was.happy };
    }
    register(); save(); syncView();
    mood('keeper', 'happy', 2200); famMood('papa', 'happy', 2200); kids().forEach((_, i) => famMood(kidId(i), 'happy', 2200)); SFX.cheer();
    const all = `<div class="fm-row">${pt('keeper')}${pt('papa')}${kids().map((_, i) => pt(kidId(i), 'kid')).join('')}</div>`;
    if (!old) {
      if (window.GFKCards) GFKCards.collect({ game: GAME, id: 'my-family', name: 'My Family', emoji: '👪', rarity: 'rare' });
      await talk('keeper', `This is my family! ${F.papa.name}, ${names(kids().map(k => k.name))}, and me.`, 'Hello, family!', all);
      await talk('papa', `Hello, my love! The children will need lots of looking after. And sometimes we can bake together!`, 'OK!');
      await talk('keeper', 'When a child needs something, a little bubble shows over their picture. Tap them to help!', 'Next');
    } else await talk('keeper', 'My lovely family!', 'Next', all);
    if (was) { setScene(was.scene, { time: was.time }); TSV.place = null; await wait(has3d() ? 400 : 50); }
  }

  /* ---------------- what the children need today ---------------- */
  /* ---------------- doing it, like The Sims ---------------- */
  // Everyone in a job walks over and its things are set out while she works out the sum (phase 'ready'),
  // then they do it on screen (phase 'do'): see acts3d.js. Everyone walks back when it is cleared.
  let actN = 0;
  function act(kind, o) { TSV.act = Object.assign({ id: ++actN, kind, phase: 'ready' }, o); return wait(has3d() ? 1500 : 0); }
  async function doing(ms, caption) {
    if (!TSV.act) return;
    TSV.act.phase = 'do'; hush();
    setPanel(`<div class="mm-tip" style="font-size:26px">${caption}</div>`); speak(caption.replace(/[^\w\s,.!?'…]/gu, '').trim());
    await wait(has3d() ? ms : 150);
  }
  async function actEnd() { if (!TSV.act) return; TSV.act = null; await wait(has3d() ? 900 : 0); }

  const NEEDS = {
    hungry: { emoji: '🥞', say: "I'm hungry!", job: breakfast, what: 'had breakfast' },
    bath: { emoji: '🛁', say: 'I need a bath!', job: bathTime, what: 'had a bath' },
    play: { emoji: '🧸', say: 'Will you play with me?', job: playTime, what: 'played' },
    story: { emoji: '📖', say: 'Can we read a story?', job: storyTime, what: 'read a story' },
  };
  function today() {
    if (!has()) return null;
    const F = S.family;
    if (!F.today || F.today.day !== S.day) {
      const order = shuffle(Object.keys(NEEDS));
      F.today = { day: S.day, needs: kids().map((_, i) => order[i % order.length]), done: kids().map(() => false), baked: false };
      save();
    }
    return F.today;
  }
  const waiting = () => { const T = today(); return T ? T.needs.map((n, i) => (T.done[i] ? null : i)).filter(i => i !== null) : []; };
  // for the morning menu: "Pip is hungry! Rosie wants to play"
  function blurb() {
    if (!has()) return '';
    const w = waiting(), T = today();
    if (!w.length) return 'Everyone is happy!';
    const k = w[0], more = w.length - 1;
    return `${kids()[k].name}: ${NEEDS[T.needs[k]].emoji} ${NEEDS[T.needs[k]].say}${more ? ` (and ${more} more)` : ''}`;
  }
  // the family row in her house: a picture of each child with what they need over it
  function row() {
    if (!has()) return '';
    const T = today();
    return `<div class="fm-row">${kids().map((k, i) => `<button class="fm-kid ${T.done[i] ? 'done' : ''}" data-kid="${i}">${pt(kidId(i))}<span>${k.name}</span><small>${T.done[i] ? 'Happy!' : NEEDS[T.needs[i]].say}</small><span class="need">${T.done[i] ? '💖' : NEEDS[T.needs[i]].emoji}</span></button>`).join('')}</div>`;
  }
  // she taps a child: they say what they need, and she helps (or, if they are already happy, gets a hug)
  async function care(i) {
    const T = today(), k = kids()[i], id = kidId(i); if (!k) return;
    if (T.done[i]) { famMood(id, 'happy', 1500); SFX.ok(); await talk(id, pick(['I love you!', 'Thank you for looking after me!', 'Hug!', 'You are the best!']), 'Hug 💖'); return; }
    const need = T.needs[i], back = TSV.room || 'home', there = roomFor(need);
    if (there !== back) { goRoom(there); await wait(has3d() ? 700 : 50); }
    famMood(id, 'wave', 1500);
    await talk(id, NEEDS[need].say, pick(['OK!', "Let's do it!"]));
    TIP = null;
    let helped;
    try { helped = await NEEDS[need].job(i); } finally { await actEnd(); }
    if (there !== back) { goRoom(back); await wait(has3d() ? 500 : 50); }
    // breakfast feeds every hungry child at once
    T.needs.forEach((n, j) => { if (j === i || (need === 'hungry' && n === 'hungry')) T.done[j] = true; });
    const fed = helped || [i];
    for (const j of fed) famMood(kidId(j), 'happy', 2200);
    heart(fed.length);
    if (T.done.every(Boolean) && !T.happy) { T.happy = true; await happyDay(); }
    await drawingDue();
  }
  /* ---------------- hearts, drawings and happy days ---------------- */
  const DRAWINGS = [
    ['shop', 'drawing of our shop', '🍄', 'common'], ['family', 'drawing of our family', '👪', 'common'], ['bramble', 'drawing of Bramble', '🦔', 'common'],
    ['rainbow', 'rainbow drawing', '🌈', 'common'], ['ship', "drawing of Captain Whiskers' ship", '⛵', 'rare'], ['house', 'drawing of our house', '🏠', 'common'],
    ['fairy', 'drawing of the Fairy Queen', '🧚', 'rare'], ['mama', 'drawing of Mama', '💖', 'sparkly'],
  ];
  const AT = [2, 6, 11, 17, 24, 32, 41, 51]; // hearts for each drawing
  function heart(n = 1) {
    const F = S.family; F.hearts = (F.hearts || 0) + n; F.drawings = F.drawings || [];
    Mental.toast(`💖 ${n > 1 ? `+${n} hearts` : '+1 heart'}`); SFX.cheer();
    save();
  }
  // a drawing for the binder each time the hearts reach the next mark, from whichever child is happiest
  async function drawingDue() {
    const F = S.family, next = F.drawings.length;
    if (next >= DRAWINGS.length || F.hearts < AT[next]) return;
    const [id, what, emoji, rarity] = DRAWINGS[next], i = rnd(kids().length), k = kids()[i];
    F.drawings.push(id); save();
    if (window.GFKCards) GFKCards.collect({ game: GAME, id: 'drawing-' + id, name: `${k.name}'s ${what}`, emoji, rarity });
    famMood(kidId(i), 'happy', 2000);
    await talk(kidId(i), `I made you a picture! It's a ${what}.`, 'I love it!', `<div class="row"><span class="fm-book" style="font-size:54px;box-shadow:0 4px 0 #d8c4a8">${emoji}</span></div>`);
  }
  async function happyDay() {
    const F = S.family; F.happyDays = (F.happyDays || 0) + 1; save();
    mood('keeper', 'happy', 2200); famMood('papa', 'happy', 2200);
    if (F.happyDays === 1 && window.GFKCards) GFKCards.collect({ game: GAME, id: 'happy-family', name: 'Happy Family', emoji: '🏡', rarity: 'rare' });
    await talk('papa', pick(['Everyone is happy today. What a lovely family!', 'The children are all happy. Thank you, my love!']), 'Hooray!', `<div class="fm-row">${kids().map((_, i) => pt(kidId(i), 'kid')).join('')}</div>`);
  }

  /* ---------------- the jobs ---------------- */
  // Breakfast: everyone at the table gets the same, so it is equal groups (skip counting, like Bramble's bags).
  async function breakfast(i) {
    const people = kids().length + 2, M = S.lv.M;
    const [each, food] = M <= 2 ? [2, 'pancakes'] : M === 3 ? [5, 'strawberries'] : [10, 'blueberries'];
    const total = people * each, who = ['keeper', 'papa'].concat(kids().map((_, j) => kidId(j)));
    const label = j => (who[j] === 'keeper' ? 'Me' : CAST[who[j]].name);
    await act('eat', { who, each, food });
    await ask({
      k: 'M', who: 'keeper', strat: 'skip', answer: total, peek: 0, q: `There are ${people} of us at breakfast. Everyone wants ${each} ${food}. How many ${food} do I make?`,
      show: () => who.map((w, j) => `<span class="fm-plate">${pt(w)}${dots(each)}<span class="lab">${label(j)}</span></span>`).join(''),
      help: () => `<div class="row">${who.map((w, j) => `<span class="grp"><span class="lab">${j === people - 1 ? '?' : (j + 1) * each}</span>${dots(each)}</span>`).join('')}</div><div class="small">Count by ${each}s: ${Array.from({ length: people - 1 }, (_, j) => (j + 1) * each).join(', ')} …</div>`,
      helpSay: `Count by ${each === 2 ? 'twos' : each === 5 ? 'fives' : 'tens'}: ${Array.from({ length: Math.min(3, people - 1) }, (_, j) => (j + 1) * each).join(', ')}.`,
    });
    const hungry = today().needs.map((n, j) => (n === 'hungry' && !today().done[j] ? j : null)).filter(j => j !== null);
    await doing(5200, `🥞 Breakfast! ${each} ${food} each…`);
    await talk('papa', `${total} ${food}! Yum! Thank you for breakfast!`, 'Eat up!');
    return hungry.includes(i) ? hungry : [i].concat(hungry);
  }
  // Bath time: the bath holds 5, 10 or 20 cups of warm water. How many more cups to fill it?
  async function bathTime(i) {
    const L = S.lv.S, whole = L <= 1 ? 5 : L <= 3 ? 10 : 20, have = whole === 5 ? 1 + rnd(4) : whole === 10 ? 2 + rnd(7) : 6 + rnd(13), need = whole - have;
    const help = Mental.subHelp(whole, have, L);
    await act('bath', { who: [kidId(i)] });
    await ask({
      k: 'S', who: 'keeper', strat: whole <= 10 ? 'ten' : help.kind, answer: need, q: `The bath holds ${whole} cups of warm water. I poured in ${have}. How many more cups will fill it?`,
      show: () => `<span class="fm-tub"><span class="lab">${have} cups in</span>${dots(have, whole, 'b2')}</span>`,
      help: () => help.html, helpSay: help.say,
    });
    await doing(3400, '🛁 Splish, splash!');
    await talk(kidId(i), pick(['Splash! Bubbles!', 'Bubbles! I love bath time!', 'Splish, splash!']), 'All clean!');
  }
  // Play: two block towers (adding, at her adding level), or ten skittles knocked down (taking away from 10).
  async function playTime(i) {
    const A = S.lv.A, id = kidId(i), name = kids()[i].name;
    if (A >= 2 && Math.random() < .4) {
      const down = 2 + rnd(7), help = Mental.subHelp(10, down, S.lv.S);
      await act('skittles', { who: [id], down });
      await ask({
        k: 'S', who: id, helpWho: 'keeper', strat: 'ten', answer: 10 - down, q: `Skittles! There are 10 skittles. My ball knocked down ${down}. How many are still standing?`,
        show: () => `<span class="fm-pins">🎳</span>${Mental.frames(Array.from({ length: 10 }, (_, j) => (j < 10 - down ? '' : 'x')))}`,
        help: () => help.html, helpSay: help.say,
      });
      await doing(2800, '🎳 Roll the ball!');
      await talk(id, 'Strike! Again, again!', 'Fun!');
      return;
    }
    const [a, b] = A <= 1 ? (() => { const x = 1 + rnd(4); return pick([[x, x], [x, 1 + rnd(4)]]); })()
      : A === 2 ? pick([() => { const x = 2 + rnd(4); return [x, x]; }, () => { const x = 2 + rnd(4); return [x, x + 1]; }, () => { const x = 3 + rnd(5); return [x, 10 - x]; }])()
      : A === 3 ? pick([() => { const x = 6 + rnd(3); return [x, 3 + rnd(5)]; }, () => { const x = 4 + rnd(5); return [x, x + 1]; }])()
      : pick([() => [10 * (1 + rnd(3)), 1 + rnd(9)], () => { const x = 7 + rnd(3); return [x, 4 + rnd(6)]; }])();
    const help = Mental.addHelp(a, b, A);
    await act('towers', { who: [id], a, b });
    await ask({
      k: 'A', who: id, helpWho: 'keeper', strat: help.kind, answer: a + b, q: `Let's build towers! My tower has ${a} blocks and yours has ${b}. How many blocks is that altogether?`,
      show: () => `<span class="fm-tower">${dots(a)}<span class="lab">${name}</span></span><b style="font-size:30px">+</b><span class="fm-tower">${dots(b)}<span class="lab">Mama</span></span>`,
      help: () => help.html, helpSay: help.say,
    });
    await doing((Math.min(a, 12) + Math.min(b, 12)) * 220 + 1500, '🧱 Building our towers…');
    await talk(id, pick(['Our towers are so tall!', 'Crash! Let\'s build them again!']), 'Fun!');
  }
  // A bedtime story. A few pages more (counting on), or, once she adds well, 10 pages a night from any page:
  // 34 then 44 then 54 (the tens go up by one and the ones stay the same).
  async function storyTime(i) {
    const id = kidId(i), tens = S.lv.P >= 2 || S.lv.A >= 3;
    await act('story', { who: [id] });
    if (tens) {
      const at = 11 + rnd(78), next = at + 10, t = Math.floor(at / 10), o = at % 10;
      await ask({
        k: 'P', who: id, helpWho: 'keeper', strat: 'tens', answer: next, q: `We read 10 pages every night. Last night we stopped on page ${at}. What page will we stop on tonight?`,
        show: () => `<span class="fm-book">📖 ${at} <b style="opacity:.5">+ 10</b></span>`,
        help: () => `<div class="row"><span class="grp"><span class="lab">${t} tens</span>${Mental.bag(t * 10)}</span><span class="grp"><span class="lab">${o} ones</span>${dots(o)}</span><b style="font-size:30px">→</b><span class="grp"><span class="lab">${t + 1} tens</span>${Mental.bag((t + 1) * 10)}</span><span class="grp"><span class="lab">${o} ones</span>${dots(o)}</span></div><div class="mm-tip">10 more: the tens go up by one. The ones stay ${o}.</div>`,
        helpSay: `10 more means one more ten. ${t} tens becomes ${t + 1} tens. The ones stay the same.`,
      });
    } else {
      const at = 2 + rnd(S.lv.A <= 1 ? 6 : 12), more = 1 + rnd(3), help = Mental.addHelp(at, more, S.lv.A);
      await ask({
        k: 'A', who: id, helpWho: 'keeper', strat: help.kind, answer: at + more, q: `We are on page ${at}. We read ${more} more ${plural(more, 'page', 'pages')}. What page are we on now?`,
        show: () => `<span class="fm-book">📖 ${at}</span>${Mental.hops(at, more)}`,
        help: () => help.html, helpSay: help.say,
      });
    }
    await doing(4600, '📖 Once upon a time…');
    await talk(id, pick(['The end! Night night.', 'I love that story!', 'Yawn. One more tomorrow?']), 'Night night 🌙');
  }

  /* ---------------- baking together ---------------- */
  // A recipe card makes one batch; they bake a double batch (a double), then everyone eats one (taking away),
  // and the rest go on her shop shelf to sell. After the shop has closed only biscuits keep until morning.
  const RECIPES = [
    { good: 'biscuit', name: 'Honey biscuits', flour: 2, makes: 5, emoji: '🍪' },
    { good: 'bun', name: 'Acorn buns', flour: 3, makes: 4, emoji: '🥐', fresh: true },
    { good: 'tart', name: 'Berry tarts', flour: 2, makes: 3, emoji: '🥧', fresh: true },
  ];
  const bakedToday = () => !!(today() && today().baked);
  async function bake() {
    const T = today(); if (!T || T.baked) return;
    const back = TSV.room || 'home', there = roomFor('bake');
    if (there !== back) { goRoom(there); await wait(has3d() ? 700 : 50); }
    try { await bakeHere(T); } finally { await actEnd(); }
    if (there !== back) { goRoom(back); await wait(has3d() ? 500 : 50); }
  }
  async function bakeHere(T) {
    const morning = S.villageBack === 'morning';
    const list = RECIPES.filter(r => (morning || !r.fresh) && unlocked(S.day).includes(r.good) && (S.stock[r.good] || 0) < 10);
    const R = list.length ? pick(list) : RECIPES[0];
    const A = S.lv.A, flour = A <= 1 ? R.flour : A === 2 ? R.flour + 1 + rnd(2) : 3 + rnd(6);
    const helper = rnd(kids().length), people = kids().length + 2;
    await act('bake', { who: ['keeper', 'papa', kidId(helper)], good: R.good, made: R.makes * 2, people });
    famMood('papa', 'happy', 1500); famMood(kidId(helper), 'happy', 1500);
    if (coachOnce('bake')) await talk('papa', "Let's bake together! The recipe card says what we need for one batch.", 'Next');
    const card = n => `<div class="fm-recipe"><h4>${R.emoji} ${R.name}</h4><div>${n} cups of flour</div><div class="row">${Array.from({ length: n }, () => '<span class="fm-cup">🥣</span>').join('')}</div><div>Makes ${R.makes}</div></div>`;
    // 1. a double batch: twice the flour
    const h1 = Mental.addHelp(flour, flour, A);
    await ask({
      k: 'A', who: kidId(helper), helpWho: 'keeper', strat: 'double', answer: flour * 2, q: `Let's make a double batch! One batch needs ${flour} cups of flour. How many cups for two batches?`,
      show: () => card(flour), help: () => h1.html, helpSay: h1.say,
    });
    SFX.tap(); await doing(3600, '🥣 Stir, stir… into the oven! 🔥');
    // 2. two batches came out; everyone eats one, the rest are for the shop
    const made = R.makes * 2, left = made - people;
    SFX.cheer(); mood('keeper', 'happy', 1500);
    let toShop = 0;
    if (left > 0) {
      const h2 = Mental.subHelp(made, people, S.lv.S);
      await ask({
        k: 'S', who: 'papa', helpWho: 'keeper', strat: h2.kind, answer: left, q: `We made ${made} ${GOODS[R.good].many}! There are ${people} of us, and we each eat one. How many are left for my shop?`,
        show: () => `${dots(made)}`, help: () => h2.html, helpSay: h2.say,
      });
      if (TSV.act) { TSV.act.phase = 'eat'; setPanel(`<div class="mm-tip" style="font-size:26px">😋 One each…</div>`); await wait(has3d() ? 900 + people * 350 : 100); }
      toShop = Math.max(0, Math.min(left, 10 - (S.stock[R.good] || 0)));
      S.stock[R.good] = (S.stock[R.good] || 0) + toShop;
    }
    T.baked = true; save(); syncView();
    if (window.GFKCards && !S.family.bakes) GFKCards.collect({ game: GAME, id: 'family-recipes', name: 'Family Recipe Book', emoji: '📒', rarity: 'common' });
    S.family.bakes = (S.family.bakes || 0) + 1; save();
    heart(1);
    const room = left > 0 && toShop < left ? (toShop ? ` My shelf only has room for ${toShop}, so we'll share the rest with the neighbours.` : " My shelf is full, so we'll share them with the neighbours.") : '';
    await talk('keeper', !toShop && left > 0 ? `Mmm!${room}` : toShop ? `Mmm! ${toShop} home-baked ${plural(toShop, GOODS[R.good].one, GOODS[R.good].many)} for my shop shelf. I can sell ${toShop === 1 ? 'it' : 'them'}!${room}` : 'Mmm! We ate them all up!', 'Yum!',
      `<div class="row">${Array.from({ length: Math.max(1, toShop) }, () => goodImg(R.good, 'sm')).join('')}</div>`);
    await drawingDue();
  }

  /* ---------------- building onto the house ---------------- */
  // New rooms are paid for (money above the 10 kept for Bramble's cart, like the stalls), then built with two
  // building sums: the floor tiles in rows (equal groups) and the planks in bundles of ten (tens and ones).
  // Each room shows from the lane too (village3d.js). In a room that fits a need, that job happens there.
  const ROOMS = {
    bath: { name: 'Bathroom', emoji: '🛁', cost: 15, for: ['bath'], blurb: 'Bath time happens here' },
    kitchen: { name: 'Kitchen', emoji: '🍳', cost: 20, for: ['hungry', 'bake'], blurb: 'Breakfast and baking' },
    kids: { name: "Children's bedroom", emoji: '🛏️', cost: 25, for: ['story'], blurb: 'Beds and bedtime stories' },
    attic: { name: 'Attic playroom', emoji: '🪀', cost: 30, for: ['play'], blurb: 'A swing and toys up top' },
  };
  const built = () => S.rooms || [];
  const roomName = id => (id === 'home' ? 'Living room' : ROOMS[id].name);
  // where a job happens: its own room if she has built it, otherwise the living room
  const roomFor = need => Object.keys(ROOMS).find(id => built().includes(id) && ROOMS[id].for.includes(need)) || 'home';
  // the whole room shows, like a dollhouse
  function goRoom(id) { setScene('room', { room: id, time: 'day', cam: 'decorate' }); TSV.place = 'house'; TSV.cust = null; }
  // the bar of rooms in her house: tap one to go there, or build a new one
  function roomBar(here) {
    const list = ['home'].concat(Object.keys(ROOMS).filter(id => built().includes(id)));
    const more = Object.keys(ROOMS).some(id => !built().includes(id));
    return `<div class="fm-rooms">${list.length > 1 ? list.map(id => `<button data-room="${id}" class="${id === here ? 'on' : ''}">${id === 'home' ? '🛋️' : ROOMS[id].emoji} ${roomName(id)}</button>`).join('') : ''}${more ? '<button class="build" id="build">🔨 Build a room</button>' : ''}</div>`;
  }
  const tiles = (rows, per, upTo = rows) => `<span class="fm-tiles" style="grid-template-columns:repeat(${per},22px)">${Array.from({ length: rows }, (_, r) => Array.from({ length: per }, () => `<i class="${r < upTo ? '' : 'r'}"></i>`).join('')).join('')}</span>`;
  const planks = (b, o) => `<span class="fm-planks">${Array.from({ length: b }, () => `<span class="fm-bundle"><span>${'<i></i>'.repeat(10)}</span>10</span>`).join('')}${'<i class="fm-plank"></i>'.repeat(o)}</span>`;
  function pickRoom() {
    return new Promise(res => {
      const spare = Math.max(0, S.till - 10);
      say('keeper', `Which room shall I build? I keep 10 pennies for Bramble's cart, so I have ${spare} ${plural(spare, 'penny', 'pennies')} to spend.`);
      DBG.cur = { type: 'build' };
      const draw = () => setPanel(`<div class="decor">${Object.entries(ROOMS).map(([id, R]) => `<button data-b="${id}" class="${built().includes(id) ? 'own' : spare < R.cost ? 'cant' : ''}"><span class="em">${R.emoji}</span><span>${R.name}</span><span class="tag">${built().includes(id) ? '✓ built' : R.cost + '¢'}</span><small>${R.blurb}</small></button>`).join('')}</div>
        <button class="btn alt" id="nb">Not now</button>`, p => {
        $$('[data-b]', p).forEach(b => b.addEventListener('click', () => {
          const id = b.dataset.b, R = ROOMS[id];
          if (built().includes(id)) { say('keeper', `I already have a ${R.name.toLowerCase()}!`); return; }
          if (spare < R.cost) { SFX.soft(); say('keeper', `The ${R.name.toLowerCase()} costs ${R.cost}. I have ${spare} to spend. I need ${R.cost - spare} more.`); return; }
          SFX.tap(); rerender = null; res(id);
        }));
        $('#nb', p).addEventListener('click', () => { SFX.tap(); rerender = null; res(null); });
      });
      rerender = draw; draw();
    });
  }
  async function build() {
    const id = await pickRoom(); if (!id) return null;
    const R = ROOMS[id], spare = S.till - 10;
    const given = await coinsTask({ who: 'bramble', amount: R.cost, source: coinsFor(spare), title: 'My money to spend', prompt: `Wood, nails and paint for a ${R.name.toLowerCase()}. That's ${R.cost} pennies, please.`, mode: S.day >= SUMS_DAY ? 'pay' : 'exact', back: 'Not today' });
    if (given === null) return null;
    if (given > R.cost) await talk('bramble', `You gave me ${given}. Here ${given - R.cost === 1 ? 'is 1 penny' : 'are ' + (given - R.cost)} back!`);
    // the room is hers as soon as it is paid for, so a reload in the middle never loses the pennies
    const had = S.till; S.till -= R.cost; S.rooms = built().concat(id); save(); hud();
    const who = has() ? 'papa' : 'keeper';
    await talk('keeper', `${had} take away ${R.cost} leaves ${S.till}. Now let's build!`, 'Let\'s build! 🔨');
    // 1. the floor: rows of tiles
    const M = S.lv.M, per = M <= 2 ? 2 : M === 3 ? 5 : 10, rows = M <= 2 ? 3 + rnd(3) : 2 + rnd(4);
    await ask({
      k: 'M', who, helpWho: 'keeper', strat: 'skip', answer: rows * per, q: `The floor has ${rows} rows of tiles, with ${per} tiles in each row. How many tiles do we need?`,
      show: () => tiles(rows, per),
      help: () => `<div class="row">${Array.from({ length: rows }, (_, r) => `<span class="grp"><span class="lab">${r === rows - 1 ? '?' : (r + 1) * per}</span>${dots(per)}</span>`).join('')}</div><div class="small">Count by ${per}s</div>`,
      helpSay: `Count by ${per === 2 ? 'twos' : per === 5 ? 'fives' : 'tens'}, one row at a time.`,
    });
    // 2. the walls: planks in bundles of ten and some loose ones
    const P = S.lv.P, b = P <= 1 ? 1 + rnd(2) : 2 + rnd(7), o = 1 + rnd(9);
    await ask({
      k: 'P', who, helpWho: 'keeper', strat: 'tens', answer: b * 10 + o, q: `Here are the planks for the walls: ${b} ${plural(b, 'bundle', 'bundles')} of 10, and ${o} more. How many planks is that?`,
      show: () => planks(b, o),
      help: () => `<div class="row"><span class="grp"><span class="lab">${b} tens</span>${Mental.bag(b * 10)}</span><b style="font-size:30px">+</b><span class="grp"><span class="lab">${o} ones</span>${dots(o)}</span></div><div class="mm-tip">${b} tens is ${b * 10}. And ${o} more.</div>`,
      helpSay: `${b} tens is ${b * 10}. Then ${o} more.`,
    });
    setPanel(`<div class="mm-eyes">🔨</div><div class="mm-tip">Tap, tap, tap…</div>`);
    for (let i = 0; i < 6; i++) { SFX.tap(); await wait(320); }
    syncView();
    goRoom(id); await wait(has3d() ? 900 : 100);
    SFX.cheer(); mood('keeper', 'happy', 2200); if (has()) { famMood('papa', 'happy', 2200); kids().forEach((_, i) => famMood(kidId(i), 'happy', 2200)); }
    if (window.GFKCards) {
      if (built().length === 1) GFKCards.collect({ game: GAME, id: 'builder', name: 'Little Builder', emoji: '🔨', rarity: 'common' });
      GFKCards.collect({ game: GAME, id: 'room-' + id, name: `My ${R.name}`, emoji: R.emoji, rarity: R.cost >= 25 ? 'rare' : 'common' });
      if (built().length === Object.keys(ROOMS).length) GFKCards.collect({ game: GAME, id: 'biggest-house', name: 'Biggest House in the Wood', emoji: '🏰', rarity: 'sparkly' });
    }
    await talk(has() ? kidId(rnd(kids().length)) : 'keeper', has() ? pick(['Wow! A new room!', 'It is so lovely!', 'Can we play in here?']) : `My new ${R.name.toLowerCase()}! My house is getting bigger.`, 'Ta-da! 🎉');
    if (has()) heart(1);
    return id;
  }

  /* ---------------- Papa's day: she plays her husband, the carpenter ---------------- */
  // From the morning menu (it is one of Mental.ACTIVITIES once she has a family): the shop stays shut, she is Papa for
  // the day, and he walks down the lane doing carpentry jobs for three neighbours. Every job is two building sums:
  // reading a ruler, sawing a plank down to size, nails in equal groups, boards end to end, planks in bundles of ten.
  // Each job pays 3 pennies (and 1 more if every answer was right the first time), into the family's one purse.
  let asPapa = false;
  const playingPapa = () => asPapa && has();
  const U = 24; // px per unit on the ruler
  function ruler(len, opts = {}) {
    const n = Math.max(len, opts.need || 0, 10) + 1;
    return `<span class="fm-ruler"><span class="bar" style="left:10px;width:${len * U}px"></span>${opts.need ? `<span class="bar cut" style="left:${10 + opts.need * U}px;width:${(len - opts.need) * U}px"></span>` : ''}<span class="ticks">${Array.from({ length: n }, (_, i) => `<b>${i}</b>`).join('')}</span></span>`;
  }
  const JOBS = {
    burrow: { who: 'bunbury', what: 'a new shelf for my jam jars', steps: ['measure', 'nails'] },
    oak: { who: 'hoot', what: 'a taller bookcase', steps: ['boards', 'planks'] },
    stall: { who: 'dot', what: 'a bench for my flower stall', steps: ['saw', 'nails'] },
    pond: { who: 'captain', what: 'a new plank for my little boat', steps: ['measure', 'saw'] },
  };
  async function carpentry(kind, who) {
    const A = S.lv.A, Sv = S.lv.S, M = S.lv.M;
    if (kind === 'measure') {
      const len = (Sv <= 1 ? 4 : 6) + rnd(Sv <= 1 ? 6 : 9);
      await ask({ k: 'N', who: 'papa', strat: 'none', answer: len, q: 'First I measure the plank. It starts at 0 on my ruler. How long is it?',
        show: () => ruler(len), help: () => `<div class="mm-tip">Look where the plank ends. ${len > 10 ? `It goes past 10 by ${len - 10}.` : len > 5 ? `5 and ${len - 5} more.` : ''}</div>`,
        helpSay: len > 10 ? `It goes past 10, and ${len - 10} more.` : 'Look at the number where the plank ends.' });
    } else if (kind === 'saw') {
      const len = (Sv <= 1 ? 6 : 10) + rnd(Sv <= 1 ? 5 : 9), need = 2 + rnd(len - 3), h = Mental.subHelp(len, need, Sv);
      await ask({ k: 'S', who, helpWho: 'papa', strat: h.kind, answer: len - need, q: `This plank is ${len} long, and I need it ${need} long. How much does Papa saw off?`,
        show: () => ruler(len, { need }), help: () => h.html, helpSay: h.say });
    } else if (kind === 'nails') {
      const per = M <= 2 ? 2 : M === 3 ? 5 : 10, n = 2 + rnd(M <= 2 ? 4 : 3);
      await ask({ k: 'M', who: 'papa', strat: 'skip', answer: n * per, q: `There are ${n} boards, and each board needs ${per} nails. How many nails do I need?`,
        show: () => Array.from({ length: n }, (_, i) => `<span class="grp"><span class="lab">board ${i + 1}</span>${dots(per)}</span>`).join(''),
        help: () => `<div class="row">${Array.from({ length: n }, (_, i) => `<span class="grp"><span class="lab">${i === n - 1 ? '?' : (i + 1) * per}</span>${dots(per)}</span>`).join('')}</div>`,
        helpSay: `Count by ${per === 2 ? 'twos' : per === 5 ? 'fives' : 'tens'}.` });
    } else if (kind === 'boards') {
      const [a, b] = A <= 1 ? [2 + rnd(4), 1 + rnd(4)] : A === 2 ? [3 + rnd(5), 2 + rnd(5)] : [6 + rnd(4), 4 + rnd(6)], h = Mental.addHelp(a, b, A);
      await ask({ k: 'A', who, helpWho: 'papa', strat: h.kind, answer: a + b, q: `One board is ${a} long and the other is ${b} long. End to end, how long is that?`,
        show: () => `<span class="fm-ruler" style="padding-top:8px"><span class="ticks"><b style="width:${a * U}px;background:#d9a46a;color:#fff">${a}</b><b style="width:${b * U}px;background:#c98f55;color:#fff">${b}</b></span></span>`,
        help: () => h.html, helpSay: h.say });
    } else {
      const P = S.lv.P, bn = P <= 1 ? 1 + rnd(2) : 2 + rnd(7), o = 1 + rnd(9);
      await ask({ k: 'P', who: 'papa', strat: 'tens', answer: bn * 10 + o, q: `I have ${bn} ${plural(bn, 'bundle', 'bundles')} of 10 planks and ${o} more. How many planks is that?`,
        show: () => planks(bn, o), help: () => `<div class="mm-tip">${bn} tens is ${bn * 10}. And ${o} more.</div>`, helpSay: `${bn} tens is ${bn * 10}. Then ${o} more.` });
    }
  }
  async function papaDay() {
    const F = S.family, name = F.papa.name;
    asPapa = true; const O = S.offDay; O.papa = name;
    // which three neighbours, and the jobs done so far, are saved: a reload carries on instead of paying again
    if (!O.jobs) O.jobs = shuffle(Object.keys(JOBS)).slice(0, 3), O.done = [];
    save(); sync(); syncView();
    try {
      setScene('room', { room: 'home', time: 'day', cam: 'decorate' }); TSV.place = 'house'; TSV.cust = null;
      await wait(has3d() ? 700 : 50);
      famMood('mama', 'happy', 1500);
      if (coachOnce('papaday')) {
        await talk('papa', `Today you are ${name}! Papa is a carpenter. He makes and mends things for the neighbours.`, 'Next');
        await talk('papa', 'Measure, saw, nail! Every job needs some careful counting. And the pennies go in our family purse.', "Let's go! 🔨");
      } else await talk('papa', pick(['Off to work! Who needs a carpenter today?', 'My toolbox is ready. Let\'s go!']), "Let's go! 🔨");
      setScene('village', { time: 'day' });
      Object.assign(TSV, { cust: null, place: null, go: 'gate', at: null, folk: [], folkMood: {} });
      await wait(has3d() ? 900 : 0);
      for (const id of O.jobs.filter(j => !O.done.includes(j))) {
        const J = JOBS[id], who = J.who;
        hush(); setPanel('');
        await walkTo(id);
        TSV.place = id; TSV.cust = CAST[who].spec; mood('cust', 'wave', 1500);
        await wait(has3d() ? 1300 : 100);
        await talk(who, `Hello, ${name}! Could you make ${J.what}?`, 'I can do that!');
        TIP = { ok: true };
        for (const step of J.steps) await carpentry(step, who);
        setPanel(`<div class="mm-eyes">🔨</div><div class="mm-tip">Tap, tap, tap…</div>`);
        for (let i = 0; i < 4; i++) { SFX.tap(); await wait(280); }
        const tip = !!(TIP && TIP.ok), pay = 3 + (tip ? 1 : 0); TIP = null;
        S.till += pay; O.earned += pay; O.done.push(id); save(); hud(); SFX.coin(1); SFX.cheer(); mood('cust', 'happy', 2000);
        await talk(who, tip ? `Wonderful work! Here are 3 pennies, and 1 more for getting every sum right the first time!` : 'Wonderful work! Here are 3 pennies.', 'Thank you!',
          `<div class="tray tipcoin">${Array.from({ length: pay }, () => coinHTML(1)).join('')}</div>`);
        TSV.cust = null; await wait(has3d() ? 900 : 100); TSV.place = null;
      }
      hush(); setPanel('');
      await walkTo('house');
      F.papaDays = (F.papaDays || 0) + 1; save();
      if (F.papaDays === 1 && window.GFKCards) GFKCards.collect({ game: GAME, id: 'papa-carpenter', name: `${name} the Carpenter`, emoji: '🔨', rarity: 'rare' });
      setScene('room', { room: 'home', time: 'day', cam: 'decorate' }); TSV.place = 'house'; TSV.cust = null;
      await wait(has3d() ? 700 : 50);
      kids().forEach((_, i) => famMood(kidId(i), 'happy', 2500)); famMood('mama', 'happy', 2500);
      await talk(kidId(rnd(kids().length)), pick(['Papa is home!', 'Papa! Papa! You\'re home!']), 'Hugs! 💖');
      await talk('papa', `I earned ${S.offDay.earned} pennies for our family today.`, 'Hooray!');
    } finally { asPapa = false; sync(); syncView(); }
  }
  function papaActivity() {
    if (!Mental.ACTIVITIES) return;
    if (has()) Mental.ACTIVITIES.papa = { name: `${S.family.papa.name}'s day`, who: 'papa', emoji: '🔨', blurb: 'Be Papa the carpenter, and earn pennies mending things', run: papaDay };
    else delete Mental.ACTIVITIES.papa;
  }

  /* ---------------- in her house ---------------- */
  // the bedtime line: who she tucked in tonight
  function nightLine() {
    if (!has()) return '';
    const T = S.family.today, ok = T && T.day === S.day ? T.done.filter(Boolean).length : 0;
    return ok === kids().length ? ` I kissed ${names(kids().map(k => k.name))} goodnight.` : ` ${S.family.papa.name} tucked the children into bed.`;
  }

  G.Family = { DAY, playingPapa, ROOMS, built, roomBar, goRoom, build, has, kids, isFam, register, sync, famMood, offer, make, today, waiting, blurb, row, care, bake, bakedToday, nightLine, NEEDS, DRAWINGS, PAPA_NAMES, KID_NAMES };
})(window);
