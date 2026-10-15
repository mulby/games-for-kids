/* ==========================================================================
   The Toadstool Shop, pixel edition: the view.
   Same contract as ../toadstool-shop/shop3d.js (see README.md):
     - draws window.TSV every frame on canvas#gl3d behind the DOM,
     - installs window.Shop3D (good, coin, portrait, decor, plus icon) for the panels,
     - answers the skin hooks in index.html through window.SkinEvent.
   3/4 top-down pixel scenes at ONE whole-number pixel scale for every scene and camera:
   the world is drawn 1 art pixel = 1 canvas pixel into a small buffer, then blown up
   by an integer factor. Cameras pan; they never zoom.
   ========================================================================== */
import './sdv-art.js';

const SDV = window.SDV;
if (!SDV || !SDV.character || !SDV._defs) throw new Error('pixel art did not load');
const DEFS = SDV._defs;
const G = window; // the game's top-level consts (S, CAST, GOODS, DECOR...) are global lexical bindings
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mq.matches;
try { mq.addEventListener('change', e => { reduced = e.matches; }); } catch (e) { /* old Safari */ }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================= picture baker (synchronous data URLs) ================= */
const urls = new Map();
function bake(key, name, scale, box) {
  if (urls.has(key)) return urls.get(key);
  const d = DEFS[name] || DEFS.missing;
  const bw = (box || d.w), bh = (box || d.h);
  const c = document.createElement('canvas'); c.width = bw * scale; c.height = bh * scale;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(d.frames[0], Math.floor((bw - d.w) / 2) * scale, Math.floor((bh - d.h) / 2) * scale, d.w * scale, d.h * scale);
  const u = c.toDataURL('image/png'); urls.set(key, u); return u;
}
const COIN = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'nickel' };
const ICON = { jar: 'savingsJar', sound: 'icoSound', mute: 'icoMute', shelf: 'icoShelf', gear: 'icoGear', star: 'icoStar', point: 'icoPoint', bulb: 'icoBulb', anchor: 'icoAnchor', notebook: 'notebook', moon: 'moon', sun: 'sun', sparkle: 'sparkle', heart: 'heart', coin: 'goldCoin', leaf: 'springLeaf' };
const baker = {
  good: id => bake('g:' + id, SDV.GOOD_SPRITE[id] || 'missing', 4),
  coin: v => bake('c:' + v, COIN[v] || 'penny', 4),
  portrait: spec => { const n = SDV.portrait(spec || {}); return bake('p:' + n, n, 2); },
  decor: id => bake('d:' + id, SDV.DECOR_THUMB[id] || 'missing', 4),
  icon: name => bake('i:' + name, ICON[name] || name, 2, 16),
};
// self-test before going live: if any of this throws, the game keeps its emoji
['bun', 'apple', 'honey', 'tart', 'biscuit', 'candle', 'seeds', 'teacup'].forEach(baker.good);
[1, 5, 10].forEach(baker.coin);
if (!/^data:image\/png/.test(baker.coin(1))) throw new Error('canvas pictures unavailable');

/* hearts for the friendship row (9x8, full / half / empty) */
const HEART_ROWS = ['.oo...oo.', 'oHRo.oRRo', 'oHRRoRRRo', 'oRRRRRRDo', '.oRRRRDo.', '..oRRDo..', '...oDo...', '....o....'];
SDV.defineSprite('hFull', HEART_ROWS, { o: '#5B1414', H: '#FF9C9C', R: '#E23B3B', D: '#A82020' }, { outline: false });
SDV.defineSprite('hOff', HEART_ROWS, { o: '#5B2A0E', H: '#D9B98A', R: '#C9A472', D: '#A88458' }, { outline: false });
SDV.defineSprite('hHalf', HEART_ROWS.map(r => r.slice(0, 5) + r.slice(5).replace(/[HRD]/g, 'x')), { o: '#5B1414', H: '#FF9C9C', R: '#E23B3B', D: '#A82020', x: '#C9A472' }, { outline: false });
const heartURL = k => bake('h:' + k, k, 3);

/* the CSS pixel pieces the skin needs */
const root = document.documentElement.style;
root.setProperty('--sdv-coin-edge', `url(${bake('edge', 'coinEdge', 4)})`);
root.setProperty('--sdv-coin-gold', `url(${bake('gold', 'goldCoin', 2)})`);
root.setProperty('--sdv-sparkle', `url(${bake('spark', 'sparkle', 3)})`);
root.setProperty('--sdv-ico-sound', `url(${baker.icon('sound')})`);

/* ================= canvas + scale ================= */
const cv = document.createElement('canvas'); cv.id = 'gl3d'; cv.setAttribute('aria-hidden', 'true');
document.body.insertBefore(cv, document.body.firstChild);
const ctx = cv.getContext('2d');
const buf = document.createElement('canvas'); const b = buf.getContext('2d');
let DPR = 1, K = 4, BW = 256, BH = 192, dirtySize = true;
function resize() {
  DPR = clamp(window.devicePixelRatio || 1, 1, 3);
  const w = innerWidth, h = innerHeight;
  const px = clamp(Math.floor(Math.min(w / 240, h / 196)), 2, 5); // css px per art px, the same for every scene
  K = Math.max(1, Math.round(px * DPR));
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  BW = Math.ceil(cv.width / K) + 1; BH = Math.ceil(cv.height / K) + 1;
  buf.width = BW; buf.height = BH;
  ctx.imageSmoothingEnabled = false; b.imageSmoothingEnabled = false;
  dirtySize = true;
}
addEventListener('resize', resize); resize();

/* ================= the two places ================= */
const OUT = { w: 512, h: 352 }, IN = { w: 336, h: 224 };
const HX = 216, HY = 72; // the toadstool house's top-left
const SPOT = {
  outside: { keeper: [236, 174], cust: [284, 178], enter: [420, 182] },
  inside: { keeper: [112, 115], cust: [214, 128], enter: [274, 82] },
};
const CAMS = {
  // f: the point to centre; m: the rows that must stay in the free band (heads first, then feet)
  outside: { f: [256, 136], m: [138, 186] }, meet: { f: [238, 150], m: [140, 180] }, cart: { f: [298, 150], m: [128, 186] },
  inside: { f: [168, 98], m: [80, 132] },
};
const SHELF_AT = [40, 8];
const SLOT = { bun: [0, 0], apple: [0, 1], tart: [1, 0], honey: [1, 1], biscuit: [2, 0], candle: [2, 1], seeds: [1, 2], teacup: [2, 2] };

function tileCanvas(map, extra) { const c = document.createElement('canvas'); SDV.tilemap(c, { map, scale: 1, seed: 7, tiles: extra || {} }); return c; }
// outside ground: grass, a hedge along the top, the path from the door, a pond
const outGround = (() => {
  const rnd = SDV.rng(11), cols = 32, rows = 22, m = [];
  for (let y = 0; y < rows; y++) {
    let r = '';
    for (let x = 0; x < cols; x++) {
      let ch = rnd() < 0.08 ? '*' : rnd() < 0.06 ? '+' : rnd() < 0.3 ? ',' : '.';
      if (y < 2) ch = 'h';
      if ((x === 15 || x === 16) && y >= 10) ch = ':';
      if (y >= 10 && y <= 11 && x >= 13 && x <= 18) ch = ':';
      if (y === 11 && x >= 17 && x <= 23) ch = ':';
      if (x >= 3 && x <= 7 && y >= 14 && y <= 17 && !((x === 3 || x === 7) && (y === 14 || y === 17))) ch = '~';
      r += ch;
    }
    m.push(r);
  }
  const c = tileCanvas(m), x = c.getContext('2d');
  [[246, 160], [258, 166], [248, 176], [262, 190]].forEach(p => x.drawImage(DEFS.stepStone.frames[0], p[0], p[1]));
  [[60, 236], [88, 254], [76, 270]].forEach(p => x.drawImage(DEFS.lily.frames[0], p[0], p[1]));
  return c;
})();
// inside: mushroom-red walls, wainscot, plank floor, window, door, shelves
const inRoom = (() => {
  const m = ['^^^^^^^^^^^^^^^^^^^^^', '#####################', '#####################', '#####################', '_____________________'];
  for (let i = 0; i < 9; i++) m.push('=====================');
  const c = tileCanvas(m), x = c.getContext('2d');
  const put = (n, px, py, f = 0) => x.drawImage(DEFS[n].frames[f], px, py);
  put('windowIn', 176, 18); put('doorIn', 262, 46); put('openSign', 263, 50);
  put('shelfUnit', SHELF_AT[0], SHELF_AT[1]); put('mat', 260, 82);
  x.fillStyle = 'rgba(42,18,6,.18)'; x.fillRect(0, 80, IN.w, 3);
  return c;
})();
// static props, sorted with the characters by their bottom edge
const OUT_PROPS = [
  ['tree', 132, 106], ['tree', 360, 92], ['tree', 20, 84], ['tree', 448, 60], ['tree', 410, 190], ['tree', 6, 290], ['tree', 456, 286], ['tree', 150, 290],
  ['bush', 180, 140], ['bush', 330, 214], ['bush', 96, 196], ['bush', 380, 300], ['bush', 300, 290],
  ['fence', 218, 196], ['fence', 202, 196], ['fence', 288, 200], ['fence', 304, 200],
  ['shroom', 206, 166], ['shroom', 300, 168], ['shroom', 120, 176], ['shroom', 392, 172], ['shroom', 54, 222],
  ['rock', 112, 230], ['rock', 350, 250], ['barrel', 196, 150],
];
const IN_PROPS = [['plant', 300, 62], ['plant', 4, 62], ['stool', 40, 124], ['barrel', 300, 120], ['sacks', 286, 170], ['crates', 60, 176], ['plant', 160, 186]];
const sprH = n => DEFS[n].h;

/* ================= actors ================= */
let scene = null, keeper = null, cust = null, leaving = [], queued = null, lastKeeperKey = '';
function spot(sc, who) { return SPOT[sc === 'inside' ? 'inside' : 'outside'][who]; }
function makeActor(spec, at) { return { spec, key: SDV.character(spec), x: at[0], y: at[1], from: at, to: at, t: 1, dur: 0, born: perf() }; }
function walk(a, to, dur) { a.from = [a.x, a.y]; a.to = to; a.t = 0; a.dur = reduced ? 0 : dur; if (!a.dur) { a.x = to[0]; a.y = to[1]; a.t = 1; } }
function enterPoint(sc) {
  if (sc === 'inside') return SPOT.inside.enter;
  // just past the right edge of what is on screen
  return [Math.max(SPOT.outside.enter[0], Math.round(cam.x + cv.width / K + 14)), SPOT.outside.enter[1]];
}
const perf = () => performance.now();
function syncActors() {
  const T = window.TSV, sc = T.scene === 'inside' ? 'inside' : 'outside';
  if (sc !== scene) { scene = sc; keeper = null; cust = null; leaving = []; queued = null; lastKeeperKey = ''; snapCam = true; }
  const kk = T.keeper ? JSON.stringify(T.keeper) : '';
  if (kk !== lastKeeperKey) { lastKeeperKey = kk; keeper = T.keeper ? makeActor(T.keeper, spot(sc, 'keeper')) : null; }
  const want = T.cust || null;
  const curSpec = queued ? queued.spec : cust ? cust.spec : null;
  if (want !== curSpec) {
    if (cust) { walk(cust, enterPoint(sc), 0.85); cust.leaving = true; leaving.push(cust); cust = null; }
    queued = want ? makeActor(want, enterPoint(sc)) : null;
  }
  leaving = leaving.filter(a => a.t < 1);
  if (queued && !leaving.length) { cust = queued; queued = null; walk(cust, spot(sc, 'cust'), 1.45); }
}
function stepActor(a, dt) {
  if (a.t < 1) { a.t = Math.min(1, a.t + dt / a.dur); const e = a.t; a.x = a.from[0] + (a.to[0] - a.from[0]) * e; a.y = a.from[1] + (a.to[1] - a.from[1]) * e; }
}

/* ================= camera ================= */
const cam = { x: 256, y: 140 };
let snapCam = true;
function camTarget() {
  const T = window.TSV, sc = T.scene === 'inside' ? 'inside' : 'outside';
  const c = sc === 'inside' ? CAMS.inside : (CAMS[T.cam] || CAMS.outside);
  const k = K / DPR; // css px per art px
  const top = (T.top || 0) / k, bot = (T.bottom || innerHeight) / k, bh = Math.max(40, bot - top);
  let fy = c.f[1];
  if (fy + bh / 2 < c.m[1]) fy = c.m[1] - bh / 2; // keep the feet in the band...
  if (fy - bh / 2 > c.m[0] - 2) fy = c.m[0] - 2 + bh / 2; // ...but the faces matter most
  // the world point (fx, fy) sits at the middle of the free band
  const viewW = cv.width / K, viewH = cv.height / K, W = sc === 'inside' ? IN : OUT;
  let x = c.f[0] - viewW / 2, y = fy - (top + bh / 2);
  if (viewW < W.w) x = clamp(x, 0, W.w - viewW); else x = (W.w - viewW) / 2;
  const lo = -top - 8, hi = W.h - bot + 8; // keep the free band on the world
  y = lo <= hi ? clamp(y, lo, hi) : (lo + hi) / 2;
  return { x, y };
}

/* ================= ambient (capped) ================= */
const BUGS = Array.from({ length: 3 }, (_, i) => ({ x0: 150 + i * 110, y0: 120 + (i % 2) * 70, ax: 30 + i * 12, ay: 14 + i * 5, sp: 0.00035 + i * 0.00007, ph: i * 2.1, n: i % 2 ? 'butterflyY' : 'butterfly' }));
const PETALS = Array.from({ length: 7 }, (_, i) => ({ x0: 40 + i * 67, y0: 30 + (i * 53) % 260, sp: 0.012 + (i % 3) * 0.005, ph: i * 1.7 }));
const FLIES = Array.from({ length: 9 }, (_, i) => ({ x0: 60 + (i * 97) % 420, y0: 90 + (i * 61) % 200, ph: i * 1.3 }));
const glow = (() => { // stepped lamp glow, drawn over the dusk tint
  SDV.paintSprite('glowBig', 40, 28, g => { g.ellipse(20, 14, 20, 14, '#FFD06A26'); g.ellipse(20, 14, 14, 10, '#FFD06A30'); g.ellipse(20, 14, 8, 6, '#FFE08A40'); }, { outline: false });
  SDV.paintSprite('glowSm', 16, 12, g => { g.ellipse(8, 6, 8, 6, '#FFD06A30'); g.ellipse(8, 6, 4, 3, '#FFE08A50'); }, { outline: false });
  SDV.paintSprite('shadow', 14, 5, g => { g.ellipse(7, 2.5, 7, 2.5, '#2A120640'); }, { outline: false });
  return true;
})();

/* ================= drawing ================= */
let ox = 0, oy = 0;
function spr(n, x, y, f = 0) { const d = DEFS[n]; if (!d) return; b.drawImage(d.frames[f % d.frames.length], Math.round(x) - ox, Math.round(y) - oy); }
function moodOf(who) { const m = (window.TSV.mood || {})[who]; return m || 'idle'; }
function actorDraw(a, who, t) {
  const moving = a.t < 1;
  let f = 0, dy = 0;
  const m = who === 'keeper' ? (window.TSV.speaker === 'keeper' && !document.getElementById('bubble').hidden ? 'talk' : moodOf('keeper')) : moodOf('cust');
  if (moving) f = [2, 0, 3, 0][Math.floor(t / 110) % 4];
  else if (!reduced) {
    f = Math.floor((t + a.born) / 560) % 2;
    if (m === 'talk') dy = Math.floor(t / 150) % 2 ? -1 : 0;
    if (m === 'happy') dy = -Math.round(Math.abs(Math.sin(t / 140)) * 2);
  }
  const fairy = a.spec.species === 'fairy';
  if (fairy) dy -= 4 + (reduced ? 0 : Math.round(Math.sin(t / 380) * 2));
  return { x: a.x, y: a.y, z: a.y, draw() {
    spr('shadow', a.x - 7, a.y - 3);
    spr(a.key, a.x - 8, a.y - 32 + dy, f);
    if (!moving) {
      const em = m === 'happy' ? 'emoteHeart' : m === 'think' ? 'emoteQuestion' : null;
      if (em) spr(em, a.x - 8, a.y - 50 + dy + (reduced ? 0 : (Math.floor(t / 300) % 2)), 0);
    }
    if (fairy && !reduced) { const k = Math.floor(t / 200); for (let i = 0; i < 3; i++) { const s = (k + i * 7) % 11; spr('sparkle', a.x - 14 + ((s * 13) % 24), a.y - 30 + ((s * 7) % 24), (k + i) % 2); } }
  } };
}
function drawStock(T) {
  const st = T.stock || {};
  for (const g in SLOT) {
    const n = Math.min(10, st[g] | 0); if (!n) continue;
    const [r, c] = SLOT[g], bx = SHELF_AT[0] + SDV.SHELF.bayX[c] + 1, base = SHELF_AT[1] + SDV.SHELF.rowBase[r];
    for (let i = 0; i < n; i++) spr('mini_' + g, bx + (i % 5) * 7, base - 7 - Math.floor(i / 5) * 6);
  }
}
function drawOutside(T, t, list) {
  const ev = T.time === 'evening', has = id => (T.decor || []).indexOf(id) >= 0;
  b.fillStyle = '#6CC33A'; b.fillRect(0, 0, BW, BH);
  b.drawImage(outGround, -ox, -oy);
  OUT_PROPS.forEach(p => list.push({ z: p[2] + sprH(p[0]), draw: () => spr(p[0], p[1], p[2]) }));
  list.push({ z: HY + 92, draw() {
    spr('house', HX, HY, ev ? 1 : 0);
    if (has('windowboxes')) { spr('windowBoxS', HX + 15, HY + 64); spr('windowBoxXS', HX + 52, HY + 58); }
    if (has('awning')) spr('awningScene', HX + 25, HY + 51);
    if (has('bunting')) { const F = ['#E2566B', '#F7C531', '#5A9FD5', '#6CC33A', '#B9A6E8']; b.fillStyle = '#7A4A22'; for (let x = 6; x < 75; x++) { const y = 44 + Math.round(Math.sin((x - 6) / 69 * Math.PI) * 4); b.fillRect(HX + x - ox, HY + y - oy, 1, 1); if (x % 6 === 3) { b.fillStyle = F[(x / 6 | 0) % 5]; b.fillRect(HX + x - 1 - ox, HY + y + 1 - oy, 3, 2); b.fillRect(HX + x - ox, HY + y + 3 - oy, 1, 1); b.fillStyle = '#7A4A22'; } } }
  } });
  if (has('lanterns')) [[HX + 6, HY + 70], [HX + 66, HY + 70]].forEach(p => list.push({ z: p[1] + 26, draw: () => spr('lanternPost', p[0], p[1], ev ? 1 : 0) }));
  if (has('sign')) { const n = SDV.signBoard(T.signText || 'The Toadstool Shop'); const w = DEFS[n].w; list.push({ z: 196, draw: () => spr(n, 192 - w / 2, 174) }); }
  if (T.cart) list.push({ z: 182, draw: () => spr('cartFull', 312, 132) });
  if (!ev && !reduced) {
    BUGS.forEach(k => { const x = k.x0 + Math.sin(t * k.sp * 2 + k.ph) * k.ax, y = k.y0 + Math.sin(t * k.sp * 3.1 + k.ph) * k.ay; list.push({ z: 999, draw: () => spr(k.n, x, y, Math.floor(t / 160) % 2) }); });
    list.push({ z: 998, draw() { PETALS.forEach(p => { const y = (p.y0 + t * p.sp) % 360 - 10, x = p.x0 + Math.sin(t * 0.0012 + p.ph) * 14; b.fillStyle = '#F58FB1'; b.fillRect(Math.round(x) - ox, Math.round(y) - oy, 2, 1); b.fillStyle = '#D9637F'; b.fillRect(Math.round(x) + 1 - ox, Math.round(y) + 1 - oy, 1, 1); }); } });
  }
}
function drawInside(T, t, list) {
  const has = id => (T.decor || []).indexOf(id) >= 0;
  b.fillStyle = '#2A1A10'; b.fillRect(0, 0, BW, BH);
  b.drawImage(inRoom, -ox, -oy);
  if (has('rug')) spr('rugScene', 188, 112);
  if (has('bell')) spr('bellScene', 290, 42);
  if (has('fairylights')) {
    for (let x = 2; x < IN.w - 2; x++) { const y = 14 + Math.round(Math.abs(Math.sin(x / 42 * Math.PI)) * 6); b.fillStyle = '#5A4A3A'; b.fillRect(x - ox, y - oy, 1, 1); }
    for (let i = 0; i < 40; i++) { const x = 4 + i * 8.2 | 0, y = 15 + Math.round(Math.abs(Math.sin(x / 42 * Math.PI)) * 6); const on = reduced || (Math.floor(t / 400) + i) % 5; b.fillStyle = on ? SDV.BEADS[i % 4] : '#8C7A6A'; b.fillRect(x - ox, y - oy, 2, 2); if (on) { b.fillStyle = '#FFFFFF'; b.fillRect(x - ox, y - oy, 1, 1); } }
  }
  drawStock(T);
  IN_PROPS.forEach(p => list.push({ z: p[2] + sprH(p[0]), draw: () => spr(p[0], p[1], p[2]) }));
  list.push({ z: 134, draw() {
    spr('counterLong', 64, 104); spr('tillBlue', 76, 90); spr('basket', 150, 93);
    if (has('vase')) spr('vase', 120, 92);
  } });
  if (has('catbed')) list.push({ z: 156, draw: () => spr('catBed', 54, 138, reduced ? 0 : Math.floor(t / 1400) % 2) });
}
function dusk(T, t) {
  b.globalCompositeOperation = 'multiply'; b.fillStyle = '#8C82CC'; b.fillRect(0, 0, BW, BH);
  b.globalCompositeOperation = 'source-over';
  const has = id => (T.decor || []).indexOf(id) >= 0;
  spr('glowBig', HX + 23 - 20, HY + 60 - 14); spr('glowSm', HX + 58 - 8, HY + 56 - 6);
  b.fillStyle = '#FFE07A'; [[HX + 23, HY + 60, 3], [HX + 58, HY + 56, 2]].forEach(w => b.fillRect(w[0] - w[2] - ox, w[1] - w[2] - oy, w[2] * 2, w[2] * 2));
  if (has('lanterns')) [[HX + 10, HY + 74], [HX + 70, HY + 74]].forEach(p => { spr('glowBig', p[0] - 20, p[1] - 14); b.fillStyle = '#FFF0A8'; b.fillRect(p[0] - 2 - ox, p[1] - 1 - oy, 4, 4); });
  if (!reduced) FLIES.forEach((f, i) => { const on = (Math.floor(t / 500) + i) % 3; if (!on) return; const x = f.x0 + Math.sin(t / 1300 + f.ph) * 16, y = f.y0 + Math.cos(t / 1700 + f.ph) * 10; b.fillStyle = '#FFF6A0'; b.fillRect(Math.round(x) - ox, Math.round(y) - oy, 1, 1); });
}

let last = 0, lastDraw = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const T = window.TSV; if (!T) return;
  const minGap = reduced ? 100 : 33; // about 30 frames a second, 10 when motion is reduced
  if (now - lastDraw < minGap && !dirtySize) return;
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now; lastDraw = now; dirtySize = false;
  syncActors();
  [keeper, cust, ...leaving].forEach(a => a && stepActor(a, dt));
  const tg = camTarget();
  if (snapCam || reduced) { cam.x = tg.x; cam.y = tg.y; snapCam = false; }
  else { const e = Math.min(1, dt * 2.5); cam.x += (tg.x - cam.x) * e; cam.y += (tg.y - cam.y) * e; }
  ox = Math.round(cam.x); oy = Math.round(cam.y);
  const t = reduced ? 0 : now, list = [];
  if (scene === 'inside') drawInside(T, t, list); else drawOutside(T, t, list);
  if (keeper) list.push(actorDraw(keeper, 'keeper', t));
  if (cust) list.push(actorDraw(cust, 'cust', t));
  leaving.forEach(a => list.push(actorDraw(a, 'leave', t)));
  list.sort((p, q) => p.z - q.z).forEach(d => d.draw());
  if (scene !== 'inside' && T.time === 'evening') dusk(T, t);
  ctx.drawImage(buf, 0, 0, BW * K, BH * K);
}

/* ================= DOM skin: HUD, hearts, level-up banner ================= */
const HKEY = 'toadstoolShop.sdv.hearts';
let hearts = {};
try { hearts = JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (e) { hearts = {}; }
function saveHearts() { try { localStorage.setItem(HKEY, JSON.stringify(hearts)); } catch (e) { /* private mode */ } }
function heartPts(who) {
  if (hearts[who] == null) { let met = false; try { met = !!(G.__ts && G.__ts.S.friends[who]); } catch (e) { /* */ } if (met) hearts[who] = 1; }
  return hearts[who] | 0;
}
const isShopper = who => { try { return !!(CAST[who] && who !== 'bramble' && who !== 'clover'); } catch (e) { return false; } };
function heartsHTML(pts, pop) {
  let s = '';
  for (let i = 0; i < 5; i++) { const k = pts >= 2 * i + 2 ? 'hFull' : pts === 2 * i + 1 ? 'hHalf' : 'hOff'; s += `<img src="${heartURL(k)}" alt=""${pop && i === Math.ceil(pts / 2) - 1 ? ' class="pop"' : ''}>`; }
  return s;
}
function showHearts(who, pop) {
  const bub = document.getElementById('bubble'); if (!bub) return;
  let row = bub.querySelector('.sdv-hearts');
  if (!isShopper(who)) { if (row) row.remove(); return; }
  if (!row) { row = document.createElement('div'); row.className = 'sdv-hearts'; bub.appendChild(row); }
  const pts = heartPts(who);
  row.innerHTML = heartsHTML(pts, pop); row.setAttribute('aria-label', `Friendship ${pts / 2} of 5 hearts`);
}
function toast(html, ms = 2400) {
  const el = document.createElement('div'); el.className = 'sdv-toast'; el.innerHTML = html; el.setAttribute('role', 'status');
  el.style.top = Math.round(((window.TSV && window.TSV.top) || 70) + 8) + 'px'; // under the dialogue box, not over its sound button
  document.body.appendChild(el); setTimeout(() => el.classList.add('out'), ms); setTimeout(() => el.remove(), ms + 500);
}
const STRAND = { N: 'Counting', A: 'Adding', S: 'Taking away', M: 'Equal groups', F: 'Money', P: 'Tens and ones' };
function banner(k, lv) {
  document.querySelectorAll('.sdv-level').forEach(e => e.remove());
  const el = document.createElement('div'); el.className = 'sdv-level'; el.setAttribute('role', 'status');
  const star = `<img src="${baker.icon('star')}" alt="">`;
  el.innerHTML = `${star}<span><small>Level up!</small>${STRAND[k] || 'Skill'} level ${lv}</span>${star}`;
  el.style.top = Math.round(((window.TSV && window.TSV.top) || 70) + 10) + 'px';
  document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 2800); setTimeout(() => el.remove(), 3400);
}
const PHASE = { morning: 'Morning', shop: 'Shop open', evening: 'Evening', night: 'Night' };
function skinHUD(S) {
  const day = document.getElementById('dayChip'), till = document.getElementById('tillChip');
  if (day && !day.hidden) {
    const ev = S.phase === 'evening' || S.phase === 'night';
    day.innerHTML = `<b>Day ${S.day}</b><span class="ph"><img class="ico" src="${baker.icon(ev ? 'moon' : 'sun')}" alt="">${PHASE[S.phase] || ''}</span>`;
    day.setAttribute('aria-label', `Day ${S.day}, ${PHASE[S.phase] || ''}`);
  }
  if (till && !till.hidden) {
    const d = String(Math.max(0, S.till | 0)).padStart(3, ' ').split('').map(c => `<i>${c === ' ' ? '' : c}</i>`).join('');
    till.innerHTML = `<img class="ico" src="${baker.icon('coin')}" alt=""><small class="clab">My money</small><span class="dg">${d}</span>`;
    till.setAttribute('aria-label', `${S.till} pennies in the till`);
  }
}
window.SkinEvent = function (type, a, c) {
  if (type === 'hud') skinHUD(a);
  else if (type === 'say') showHearts(a, false);
  else if (type === 'served') {
    const before = hearts[a] != null ? hearts[a] : c ? 0 : heartPts(a); // a brand-new friend starts from no hearts
    hearts[a] = Math.min(10, before + 1); saveHearts();
    showHearts(a, true);
    let name = a; try { name = CAST[a].name; } catch (e) { /* */ }
    toast(`<img src="${heartURL('hFull')}" alt=""><span>${name}<small>${c ? 'New friend!' : 'Friendship +½ heart'}</small></span>`);
  } else if (type === 'levelup') banner(a, c);
};

/* ================= go live ================= */
window.Shop3D = baker;
document.body.classList.add('g3d', 'sdv');
window.__ts3d = { get K() { return K; }, get cam() { return cam; }, get actors() { return { keeper, cust, leaving, queued }; }, hearts: () => hearts };
requestAnimationFrame(frame);
try { if (G.__ts) { G.__ts.on3d(); } } catch (e) { console.warn('[pixel] redraw', e); }
try { if (typeof hud === 'function') hud(); } catch (e) { /* the HUD redraws on the next change anyway */ }
