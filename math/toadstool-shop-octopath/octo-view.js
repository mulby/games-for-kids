/* The Toadstool Shop, Lantern Tale look: an HD-2D diorama renderer (Octopath style) that reads window.TSV.
   Same contract as ../toadstool-shop/shop3d.js (see the README): it puts a canvas#gl3d behind the DOM, draws
   window.TSV every frame, and installs window.Shop3D, the baker that makes the panel pictures.

   How it stays light on an iPad:
   - every static picture (sky, toadstool, shelves, counter, decorations) is painted once into 640x480
     "world" canvases and only repainted when the scene, the time, the decorations or the shelf change;
   - blur (tilt-shift bands, the far background, the foreground leaves) is baked by shrinking and re-growing a
     canvas, never with CSS filters on moving layers;
   - per frame it only draws those baked layers, the two characters, a few glows, light shafts and at most
     36 motes, and it renders at 30 frames a second, pausing while the page is hidden. */
import { character, COINS, FONT, GOODS as GSPR, ICONS, DECOR as DSPR, GARDEN as GDSPR, TREASURE as TRSPR, DUCK, DUCKLING, spriteCanvasOf, mix, shade, rgba, rng, bayer, hex2rgb } from './octo-art.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WW = 640, WH = 480, CW = 320, CHH = 240; // the design area (fine px) and the chunky painting grid (2 world px each)
const MX = 120, L0 = -MX / 2, LW = CW + MX; // world canvases carry an extra 80 px of scenery on each side for wide screens

/* ---------------------------------------------------------------- canvas painter (pixel helpers) */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function painter(ctx) {
  const P = {
    rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); return P; },
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); return P; },
    ellipse(cx, cy, rx, ry, c) {
      ctx.fillStyle = c;
      for (let y = -ry; y <= ry; y++) { const t = 1 - (y * y) / ((ry + .5) * (ry + .5)); if (t < 0) continue; const hw = Math.round(rx * Math.sqrt(t)); ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1); }
      return P;
    },
    vgrad(x, y, w, h, cols, dither = true) {
      for (let yy = 0; yy < h; yy++) {
        const t = h <= 1 ? 0 : yy / (h - 1), seg = t * (cols.length - 1), i = Math.min(Math.floor(seg), cols.length - 2), f = seg - i;
        if (!dither) { P.rect(x, y + yy, w, 1, mix(cols[i], cols[i + 1], f)); continue; }
        const lo = Math.floor(f * 4) / 4, hi = Math.min(1, lo + .25), loc = (f - lo) * 4, cL = mix(cols[i], cols[i + 1], lo), cH = mix(cols[i], cols[i + 1], hi);
        ctx.fillStyle = cL; ctx.fillRect(x, y + yy, w, 1);
        const pt = ditherRow(ctx, cH, y + yy, loc); if (pt) { ctx.fillStyle = pt; ctx.fillRect(x, y + yy, w, 1); }
      }
      return P;
    },
    // ordered dither, one row at a time with a 4-pixel repeating pattern (the same pixels as testing each one, far fewer calls)
    dither(x, y, w, h, c, d) { for (let yy = 0; yy < h; yy++) { const pt = ditherRow(ctx, c, y + yy, d); if (pt) { ctx.fillStyle = pt; ctx.fillRect(x, y + yy, w, 1); } } return P; },
    noise(x, y, w, h, cols, d, seed) { const r = rng(seed || 7); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (r() < d) { ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.fillRect(x + xx, y + yy, 1, 1); } return P; },
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; ctx.fillStyle = c;
      for (;;) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return P;
    },
    poly(pts, c) {
      let a = Infinity, b = -Infinity; pts.forEach(p => { a = Math.min(a, p[1]); b = Math.max(b, p[1]); }); ctx.fillStyle = c;
      for (let y = Math.ceil(a); y <= Math.floor(b); y++) {
        const xs = []; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1])); }
        xs.sort((m, n) => m - n); for (let j = 0; j + 1 < xs.length; j += 2) ctx.fillRect(Math.round(xs[j]), y, Math.round(xs[j + 1]) - Math.round(xs[j]) + 1, 1);
      }
      return P;
    },
    spr(s, x, y, scale = 1, flip = false) { ctx.save(); ctx.imageSmoothingEnabled = false; const c = spriteCanvasOf(s); if (flip) { ctx.translate(Math.round(x) + s.w * scale, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0, s.w * scale, s.h * scale); } else ctx.drawImage(c, Math.round(x), Math.round(y), s.w * scale, s.h * scale); ctx.restore(); return P; },
    ctx,
  };
  return P;
}
// the 4x1 tile for one row of an ordered dither: pixel i is on where bayer(i, y) < d (patterns repeat from the
// canvas's own origin, so pixel x of the row gets tile pixel x & 3, as bayer() would)
const DROW = new Map();
function ditherRow(ctx, c, y, d) {
  let bits = 0; for (let i = 0; i < 4; i++) if (bayer(i, y) < d) bits |= 1 << i;
  if (!bits) return null;
  const k = c + bits; let t = DROW.get(k);
  if (!t) { t = document.createElement('canvas'); t.width = 4; t.height = 1; const x = t.getContext('2d'); x.fillStyle = c; for (let i = 0; i < 4; i++) if (bits & (1 << i)) x.fillRect(i, 0, 1, 1); DROW.set(k, t); }
  return ctx.createPattern(t, 'repeat');
}
// soft blur by shrinking and re-growing (works everywhere, unlike ctx.filter)
function blurred(src, k) {
  const w = Math.max(1, Math.round(src.width / k)), h = Math.max(1, Math.round(src.height / k));
  const [a, ax] = cnv(w, h); ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high'; ax.drawImage(src, 0, 0, w, h);
  const [b, bx] = cnv(Math.max(1, w >> 1), Math.max(1, h >> 1)); bx.imageSmoothingEnabled = true; bx.drawImage(a, 0, 0, b.width, b.height);
  const [o, ox] = cnv(src.width, src.height); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.globalAlpha = .55; ox.drawImage(a, 0, 0, src.width, src.height); ox.globalAlpha = .45; ox.drawImage(b, 0, 0, src.width, src.height); ox.globalAlpha = 1;
  return o;
}
// tilt-shift: blend a blurred copy over the top and bottom bands (world y), feathered
function tiltShift(src, top, bottom, k) {
  const bl = blurred(src, k), [o, ox] = cnv(src.width, src.height);
  ox.drawImage(src, 0, 0);
  const [m, mx] = cnv(src.width, src.height); mx.drawImage(bl, 0, 0); mx.globalCompositeOperation = 'destination-in';
  const g = mx.createLinearGradient(0, 0, 0, src.height), H = src.height;
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(Math.max(0, top - 60) / H, 'rgba(0,0,0,.95)'); g.addColorStop(top / H, 'rgba(0,0,0,0)');
  g.addColorStop(bottom / H, 'rgba(0,0,0,0)'); g.addColorStop(Math.min(H, bottom + 40) / H, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  mx.fillStyle = g; mx.fillRect(0, 0, src.width, src.height);
  ox.drawImage(m, 0, 0); return o;
}
// paint on the chunky 320x240 grid, return it doubled to the 640x480 world
function wcnv() { const [c, x] = cnv(WW + MX * 2, WH); x.translate(MX, 0); return [c, x]; }
function chunky(paint) { const [c, x] = cnv(LW, CHH); x.translate(-L0, 0); paint(painter(x), x); const [o, ox] = wcnv(); ox.drawImage(c, -MX, 0, WW + MX * 2, WH); return [o, ox]; }

/* ---------------------------------------------------------------- the places in the world (world px) */
const SPOT = {
  outside: { keeper: [206, 388], cust: [418, 394], enter: [720, 404] },
  inside: { keeper: [300, 334], cust: [468, 414], enter: [548, 346] },
};
// each camera: the view it would like (cx, cy, w, h) and the part that must stay in the free band (x0..y1)
const CAMS = {
  outside: { cx: 330, cy: 268, w: 560, h: 300, x0: 170, y0: 318, x1: 470, y1: 404 },
  inside: { cx: 320, cy: 288, w: 600, h: 296, x0: 250, y0: 268, x1: 520, y1: 416 },
  meet: { cx: 226, cy: 346, w: 260, h: 150, x0: 176, y0: 310, x1: 270, y1: 400 },
  cart: { cx: 452, cy: 318, w: 400, h: 224, x0: 380, y0: 330, x1: 560, y1: 402 },
};
const TALLX = { inside: [36, 566], outside: [140, 500] };
// garden things round the shop (chunky grid, bottom centre), in the order the stall sells them; treasures sit on a ledge on the counter
const GARDEN_ORDER = ['daisies', 'tulips', 'sunflowers', 'birdbath', 'bench', 'well', 'fairyhouse'];
const GARDEN_SPOT = { well: [278, 186], birdbath: [40, 191], sunflowers: [72, 180], daisies: [50, 205], fairyhouse: [158, 194], tulips: [182, 205], bench: [248, 192] };
const TREASURE_ORDER = ['shell', 'scarab', 'map', 'pyramid', 'owl', 'apple', 'lyre', 'crown'];
const CAMK = ['cx', 'cy', 'w', 'h', 'x0', 'y0', 'x1', 'y1'];
// shelf slots [row, col] (row 0 = bottom board), as in shop3d.js
const SLOT = { bun: [0, 0], apple: [0, 1], tart: [1, 0], honey: [1, 1], biscuit: [2, 0], candle: [2, 1], seeds: [1, 2], teacup: [2, 2] };
const SHELF = { x0: 52, bay: 82, board: [300, 246, 192] };

const SKY = {
  morning: ['#7fc0f5', '#d9efff', '#fff0d2'],
  evening: ['#3d3a8c', '#c77fb2', '#ffc08a'],
  night: ['#141a44', '#3d3a8c', '#7a5a9a'],
};

/* ---------------------------------------------------------------- OUTSIDE */
function paintOutside(time, decor, cart, signText, garden) {
  const ev = time !== 'morning', night = time === 'night';
  const lights = [], shafts = [];
  // far background: sky, sun or moon, hills and the wood (baked blurry)
  const [back] = chunky(P => {
    P.vgrad(L0, 0, LW, 150, SKY[time]);
    if (!ev) { P.ellipse(262, 34, 16, 16, '#fff6d8'); P.ellipse(262, 34, 11, 11, '#ffffff'); }
    else { P.ellipse(56, 30, 10, 10, '#fff4d8'); P.ellipse(60, 27, 9, 9, SKY[time][0]); const r = rng(5); for (let i = 0; i < (night ? 60 : 26); i++) P.px(L0 + r() * LW, r() * 80, r() < .3 ? '#ffffff' : '#ffe6b0'); }
    const hill = ev ? (night ? ['#2e2e5a', '#24244a'] : ['#6a5a8a', '#4e4470']) : ['#a9d3a0', '#86b98a'];
    P.poly([[L0, 108], [0, 118], [40, 100], [90, 112], [150, 96], [210, 110], [270, 94], [320, 106], [360, 98], [360, 160], [L0, 160]], hill[0]);
    P.dither(L0, 100, LW, 60, hill[1], .35);
    const wood = ev ? (night ? '#1c1c3a' : '#3a3058') : '#5f9a62', wood2 = ev ? (night ? '#14142e' : '#2c2446') : '#4a7f50';
    for (let i = 0; i < 22; i++) { const x = L0 + i * 22 - 6 + (i % 3) * 5, y = 118 + (i % 2) * 6; P.ellipse(x, y, 16, 14, i % 2 ? wood : wood2); }
    P.rect(L0, 124, LW, 40, wood2);
    // big trunks at both sides
    const tr = ev ? '#2a2036' : '#5a4434', tr2 = ev ? '#1c1626' : '#40301f';
    for (const x of [-50, 6, 300, 356]) { P.rect(x, 0, 18, 170, tr); P.dither(x, 0, 18, 170, tr2, .4); }
  });
  const backB = blurred(back, 3);
  // the toadstool, the ground and the props: sharp
  const [mid, mx] = chunky(P => {
    const g1 = ev ? (night ? '#2e4a44' : '#4e7258') : '#8cc46c', g2 = ev ? (night ? '#1e3230' : '#36533f') : '#5f9a4a';
    P.vgrad(L0, 150, LW, 90, [g1, g2]);
    P.noise(L0, 152, LW, 88, [shade(g1, .12), shade(g2, -.12), shade(g1, -.08)], .18, 3);
    // stepping-stone path from the door
    const st = ev ? '#9a8a7a' : '#e6d6b8', stS = ev ? '#6a5e56' : '#bca888';
    [[131, 197, 9, 3], [128, 206, 10, 3], [134, 216, 11, 4], [129, 228, 12, 4]].forEach(([x, y, rx, ry]) => { P.ellipse(x, y + 1, rx, ry, stS); P.ellipse(x, y, rx, ry, st); });
    // little red mushrooms and flowers
    const r = rng(11), fl = ['#f6a6bd', '#ffd86b', '#ffffff', '#9fc7e8', '#c9b6f0'];
    for (let i = 0; i < 100; i++) { const x = L0 + r() * LW, y = 158 + r() * 80; if (Math.abs(x - 131) < 26 && y > 188) continue; P.px(x, y, fl[i % fl.length]); P.px(x, y + 1, g2); }
    for (const [x, y, s] of [[34, 196, 5], [48, 206, 3], [228, 200, 4], [300, 214, 6], [14, 222, 4]]) { P.rect(x - 1, y, 2, s, '#fff1dc'); P.ellipse(x, y, s, Math.max(2, s * .6), '#e2566b'); P.px(x - 1, y - 1, '#fff1dc'); }
    // bushes at the base
    for (const [x, y, rx] of [[84, 186, 14], [178, 188, 12], [70, 192, 9]]) { P.ellipse(x, y, rx, rx * .7, ev ? '#355a40' : '#5f9a4a'); P.ellipse(x - 2, y - 2, rx * .7, rx * .45, ev ? '#4a7258' : '#7cb36a'); }
    // stem
    const cr = ev ? (night ? '#b8b0b8' : '#e8d0c0') : '#fff1dc', crS = ev ? (night ? '#8a8098' : '#c0a090') : '#e8d4b8';
    P.poly([[98, 192], [102, 150], [104, 112], [158, 112], [160, 150], [166, 192]], cr);
    P.poly([[146, 112], [158, 112], [160, 150], [166, 192], [150, 192]], crS);
    for (let y = 116; y < 190; y += 9) P.rect(104 + (y % 3), y, 2, 1, crS);
    P.rect(94, 190, 76, 3, crS);
    // gills under the cap
    P.ellipse(131, 108, 74, 9, ev ? '#b8708a' : '#f2b0b0');
    for (let x = 64; x <= 198; x += 5) P.line(131, 104, x, 112, ev ? '#9a5070' : '#e08a96');
    // cap (a dome)
    const red = ev ? (night ? '#8a3050' : '#c84a5e') : '#e2566b', redS = ev ? (night ? '#5a2040' : '#9a3448') : '#b83a50', redL = ev ? '#d86a80' : '#f27a8a';
    const dome = (cx, base, rx, ry, c, d = 0) => { for (let y = base - ry; y <= base; y++) { const t = (base - y) / ry, hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t))); if (d) P.dither(cx - hw, y, hw * 2 + 1, 1, c, d); else P.rect(cx - hw, y, hw * 2 + 1, 1, c); } };
    dome(131, 106, 94, 66, redS); dome(127, 104, 90, 63, mix(red, redS, .5)); dome(124, 102, 86, 60, red);
    dome(110, 76, 48, 32, redL, .5); dome(106, 70, 34, 22, redL); dome(100, 62, 14, 9, shade(redL, .25));
    P.rect(37, 104, 189, 3, redS);
    const spot = ev ? (night ? '#c8c0d0' : '#f6dcd0') : '#fff3e2';
    for (const [x, y, rx, ry] of [[94, 66, 10, 7], [132, 52, 9, 6], [170, 64, 11, 7], [66, 90, 7, 5], [118, 86, 8, 5], [158, 92, 7, 4], [200, 88, 7, 5], [146, 72, 5, 3], [108, 60, 4, 3]]) P.ellipse(x, y, rx, ry, spot);
    // chimney
    P.rect(176, 40, 9, 22, '#9a8a80'); P.rect(174, 38, 13, 4, '#7a6a64'); P.dither(176, 42, 9, 20, '#6a5a54', .25);
    // round windows
    const glass = ev ? '#ffd27a' : '#bfe3ff', glassL = ev ? '#fff0b0' : '#e8f6ff';
    for (const [x, y, rr] of [[107, 140, 8], [156, 140, 8], [131, 124, 6]]) {
      P.ellipse(x, y, rr + 2, rr + 2, '#7a5032'); P.ellipse(x, y, rr, rr, glass); P.ellipse(x - 2, y - 2, rr * .45, rr * .45, glassL);
      P.rect(x, y - rr, 1, rr * 2 + 1, '#7a5032'); P.rect(x - rr, y, rr * 2 + 1, 1, '#7a5032');
      lights.push({ x: x * 2, y: y * 2, r: ev ? 70 : 26, c: ev ? '#ffb84a' : '#ffffff', a: ev ? .75 : .18, fl: ev });
    }
    // door
    P.ellipse(131, 166, 13, 10, '#5a3a22'); P.rect(118, 166, 27, 27, '#5a3a22');
    P.ellipse(131, 166, 11, 8, '#9a6a45'); P.rect(120, 166, 23, 26, '#9a6a45');
    for (const x of [125, 131, 137]) P.rect(x, 160, 1, 32, '#7a5032');
    P.ellipse(139, 178, 1.4, 1.4, '#f2c75a');
    P.rect(116, 191, 31, 3, '#a89888');
    if (ev) lights.push({ x: 262, y: 350, r: 56, c: '#ffb060', a: .35, fl: true });
    // garden things bought in Bramble Wood village (bottom-centre spots on the chunky grid, clear of the two characters)
    for (const id of GARDEN_ORDER) {
      if (!garden.includes(id) || !GDSPR[id]) continue;
      const g = GDSPR[id], [gx, gy] = GARDEN_SPOT[id]; P.ellipse(gx, gy, Math.round(g.w * .45), 2, ev ? '#1e3230' : '#4e8a3e'); P.spr(g, gx - Math.floor(g.w / 2), gy - g.h + 1);
      if (id === 'fairyhouse') lights.push({ x: gx * 2 - 6, y: (gy - 7) * 2, r: ev ? 34 : 14, c: '#ffd86b', a: ev ? .8 : .25, fl: true });
    }
    // Bramble's cart
    if (cart) {
      const wd = '#a07048', wdS = '#6e4a2e';
      P.line(208, 186, 236, 176, wdS); P.line(208, 188, 236, 179, wdS);
      P.rect(234, 166, 62, 22, wd); P.rect(234, 166, 62, 3, shade(wd, .2)); for (const x of [250, 266, 282]) P.rect(x, 169, 1, 19, wdS);
      for (const x of [246, 284]) { P.ellipse(x, 196, 8, 8, '#4a3020'); P.ellipse(x, 196, 6, 6, '#8a5a3a'); P.ellipse(x, 196, 2, 2, '#4a3020'); }
      P.rect(236, 132, 2, 36, wdS); P.rect(292, 132, 2, 36, wdS);
      for (let i = 0; i < 8; i++) { P.rect(230 + i * 9, 126, 9, 8, i % 2 ? '#fff3e6' : '#5a8fc7'); P.ellipse(234 + i * 9, 134, 4, 2, i % 2 ? '#fff3e6' : '#5a8fc7'); }
      P.rect(230, 125, 72, 1, '#3a5a88');
      // three crates on the cart, filled below at world resolution
      for (const x of [238, 258, 278]) { P.rect(x, 156, 17, 10, '#c89868'); P.rect(x, 156, 17, 2, '#e0b888'); P.rect(x, 160, 17, 1, '#9a6a45'); }
    }
  });
  const M = painter(mx);
  if (cart) {
    const r = rng(9);
    for (let i = 0; i < 4; i++) M.spr(GSPR.apple, 478 + i * 6 + r() * 2, 300 - (i % 2) * 4);
    for (let i = 0; i < 3; i++) M.spr(GSPR.bun, 518 + i * 6, 298 - (i % 2) * 4);
    for (let i = 0; i < 3; i++) M.spr(GSPR.honey, 558 + i * 7, 298 - (i % 2) * 3);
  }
  // decorations (outside)
  const has = id => decor.includes(id);
  if (has('windowboxes')) for (const x of [198, 296]) { M.rect(x - 2, 302, 32, 8, '#7bb4d9'); M.rect(x - 2, 308, 32, 3, '#4a84a9'); const r = rng(x); for (let i = 0; i < 8; i++) { const fx = x + 1 + i * 3.6; M.rect(fx, 296, 1, 6, '#5f9a4a'); M.rect(fx - 1, 293 - (i % 2) * 2, 3, 3, ['#f6a6bd', '#ffd86b', '#ffffff', '#e2566b'][Math.floor(r() * 4)]); } }
  if (has('awning')) {
    for (let i = 0; i < 8; i++) { const x = 230 + i * 8; M.rect(x, 300, 8, 14, i % 2 ? '#fff3e6' : '#e2566b'); M.ellipse(x + 4, 314, 4, 3, i % 2 ? '#fff3e6' : '#e2566b'); }
    M.rect(230, 299, 64, 2, '#9a3448'); M.dither(230, 301, 64, 4, '#9a3448', .3);
  }
  if (has('sign')) {
    // a hanging blade sign on a bracket from the right side of the stem
    M.rect(318, 226, 74, 4, '#5a3a22'); M.rect(318, 224, 6, 10, '#5a3a22'); M.line(324, 234, 344, 226, '#5a3a22');
    for (const cx2 of [334, 382]) for (let y = 230; y < 240; y += 2) M.px(cx2, y, '#8a8a8a');
    M.rect(322, 240, 76, 26, '#c98a5a'); M.rect(324, 242, 72, 22, '#fff3dc'); M.rect(322, 240, 76, 2, '#e0aa7a'); M.rect(322, 264, 76, 2, '#8a5a3a');
    const x = mx; x.save(); x.fillStyle = '#7a3d2a'; let fs = 13; x.font = `700 ${fs}px Cinzel, Georgia, serif`;
    while (x.measureText(signText).width > 68 && fs > 7) { fs--; x.font = `700 ${fs}px Cinzel, Georgia, serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(signText, 360, 253.5); x.restore();
  }
  if (has('lanterns')) for (const x of [226, 300]) { M.rect(x, 330, 3, 54, '#4a3222'); M.rect(x - 4, 318, 11, 13, '#6b4a33'); M.rect(x - 2, 320, 7, 9, ev ? '#ffe6a0' : '#fff3d0'); M.rect(x - 5, 316, 13, 2, '#3a2a20'); lights.push({ x: x + 1.5, y: 324, r: ev ? 64 : 18, c: '#ffd070', a: ev ? .9 : .3, fl: true }); }
  if (has('bunting')) {
    const cols = ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#c9b6f0'];
    for (let i = 0; i < 22; i++) { const x = 92 + i * 16, sag = Math.sin(i / 21 * Math.PI) * 10, y = 214 + sag; M.poly([[x, y], [x + 11, y], [x + 5.5, y + 12]], cols[i % 5]); }
    for (let x = 88; x < 440; x += 2) M.px(x, 213 + Math.sin((x - 92) / 336 * Math.PI) * 10, '#8a6a4a');
  }
  // foreground (very blurry, in front of everything)
  const [fore, fx] = wcnv(), F = painter(fx);
  const leaf = ev ? '#16261e' : '#2f5a32', leaf2 = ev ? '#22382c' : '#4a7f40';
  F.poly([[0, 400], [40, 380], [96, 410], [120, 480], [0, 480]], leaf); F.poly([[0, 430], [70, 420], [60, 480], [0, 480]], leaf2);
  F.poly([[-10, 360], [30, 372], [70, 440], [20, 450]], leaf2);
  F.ellipse(600, 452, 52, 26, ev ? '#5a1e2e' : '#c23f55'); F.rect(590, 452, 18, 40, ev ? '#8a8090' : '#fff1dc'); F.ellipse(586, 444, 9, 5, ev ? '#8a7080' : '#fff3e2');
  F.poly([[640, 380], [600, 400], [560, 480], [640, 480]], leaf);
  const foreB = blurred(fore, 7);
  // atmosphere
  if (!ev) shafts.push({ x: 600, y: -40, ang: 0.5, n: 4, len: 560, w: 46, gap: 70, c: '#fff2c8', a: .16 });
  const midT = tiltShift(mid, 120, 440, 4);
  return { back: backB, mid: midT, fore: foreB, counter: null, lights, shafts, motes: ev ? { c: '#e8ff9a', n: 26, glow: true, area: [40, 160, 600, 280], rise: true } : { c: '#fff2c0', n: 20, glow: true, area: [60, 60, 560, 340], rise: false } };
}

/* ---------------------------------------------------------------- INSIDE */
function paintInside(decor, stock, treasures) {
  const lights = [], shafts = [];
  const [mid, mx] = chunky(P => {
    // ceiling: pink gill ribs
    P.rect(L0, 0, LW, 60, '#d88c96');
    for (let x = -200; x <= 520; x += 7) P.line(160, -60, x, 60, '#b86a7a');
    P.dither(L0, 0, LW, 60, '#a85a6a', .18);
    // wall (round, cream) with a curved ceiling edge
    for (let x = L0; x < L0 + LW; x++) { const d = (x - 160) / 200, y0 = Math.round(26 + d * d * 22); P.rect(x, y0, 1, 175 - y0, '#f6e8d0'); P.rect(x, y0, 1, 2, '#c87a84'); }
    P.dither(L0, 40, LW, 100, '#ead6b8', .14);
    // wainscot
    P.rect(L0, 140, LW, 36, '#d8b48a'); P.rect(L0, 140, LW, 2, '#b48a5e'); for (let x = L0; x < L0 + LW; x += 12) P.rect(x, 142, 1, 34, '#c09a70');
    // timber posts
    for (const x of [-52, 8, 304, 364]) { P.rect(x, 20, 10, 156, '#8a5a3a'); P.rect(x + 7, 20, 3, 156, '#6a4228'); }
    // floor planks in perspective
    P.rect(L0, 175, LW, 65, '#c99a6a');
    for (let i = 0; i < 9; i++) { const y = 175 + Math.round(Math.pow(i / 8, 1.6) * 65); P.rect(L0, y, LW, 1, '#a87a4e'); }
    for (let x = -360; x <= 680; x += 30) P.line(160 + (x - 160) * .25, 175, x, 240, '#b0845a');
    P.dither(L0, 176, LW, 64, '#d8aa78', .12);
    // shelves: 3 bays x 3 boards
    const s0 = SHELF.x0 / 2, bw = SHELF.bay / 2;
    P.rect(s0 - 6, 70, bw * 3 + 12, 92, '#8a5a3a'); P.rect(s0 - 3, 73, bw * 3 + 6, 86, '#6e4430');
    for (let i = 0; i <= 3; i++) P.rect(s0 - 3 + i * bw, 73, 3, 86, '#8a5a3a');
    for (const by of [150, 123, 96]) { P.rect(s0 - 6, by, bw * 3 + 12, 4, '#a87048'); P.rect(s0 - 6, by, bw * 3 + 12, 1, '#c89060'); }
    P.rect(s0 - 8, 66, bw * 3 + 16, 5, '#a87048');
    // round window with pink curtains
    const wx = 204, wy = 76;
    P.ellipse(wx, wy, 25, 25, '#8a5a3a'); P.vgrad(wx - 21, wy - 21, 42, 42, ['#6db3f2', '#c9e8ff', '#f4f9ff']);
    for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) if (x * x + y * y > 21 * 21 && x * x + y * y <= 25 * 25) P.px(wx + x, wy + y, '#8a5a3a');
    for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) if (x * x + y * y > 25 * 25 && Math.abs(x) <= 24 && Math.abs(y) <= 24) { /* corners stay wall */ }
    P.ellipse(wx - 6, wy + 8, 12, 5, '#a8d890'); P.ellipse(wx + 9, wy + 10, 10, 4, '#8cc46c');
    P.rect(wx - 1, wy - 21, 2, 42, '#8a5a3a'); P.rect(wx - 21, wy - 1, 42, 2, '#8a5a3a');
    P.poly([[wx - 30, wy - 28], [wx - 14, wy - 28], [wx - 20, wy + 6], [wx - 30, wy + 30]], '#f6a6bd'); P.poly([[wx + 30, wy - 28], [wx + 14, wy - 28], [wx + 20, wy + 6], [wx + 30, wy + 30]], '#f6a6bd');
    P.dither(wx - 30, wy - 28, 12, 58, '#e2808f', .3); P.dither(wx + 19, wy - 28, 12, 58, '#e2808f', .3);
    P.rect(wx - 32, wy - 30, 64, 3, '#8a5a3a'); P.rect(wx - 26, wy + 24, 52, 4, '#a87048');
    // door on the right wall, open to green light
    P.ellipse(273, 112, 19, 14, '#5a3a22'); P.rect(254, 112, 39, 64, '#5a3a22');
    P.ellipse(273, 112, 16, 12, '#bfe6a0'); P.rect(257, 112, 32, 62, '#bfe6a0'); P.vgrad(257, 104, 32, 70, ['#e8f8d0', '#a8d890', '#7cb36a']);
    P.poly([[289, 114], [302, 108], [302, 178], [289, 174]], '#9a6a45'); P.rect(296, 140, 2, 3, '#f2c75a');
    // hanging lantern over the counter
    P.rect(160, 26, 1, 22, '#5a3a28'); P.rect(155, 46, 11, 12, '#6b4a33'); P.rect(157, 48, 7, 8, '#ffe6a0'); P.rect(154, 44, 13, 2, '#3a2a20');
  });
  const M = painter(mx);
  // goods on the shelf (world resolution: 1 sprite px = 1 world px)
  for (const g of Object.keys(SLOT)) {
    const n = Math.max(0, Math.min(10, (stock && stock[g]) | 0)), [row, col] = SLOT[g], s = GSPR[g]; if (!n || !s) continue;
    const bx = SHELF.x0 + col * SHELF.bay + 6, by = SHELF.board[row];
    for (let i = n - 1; i >= 0; i--) { const back = i >= 5, k = i % 5; M.spr(s, bx + k * 14 + (back ? 6 : 0) - s.w / 2 + 7, by - s.h - (back ? 6 : 0)); }
  }
  // a price tag under each stocked slot, with its price in pixel digits (no tag where the slot is empty)
  for (const g of Object.keys(SLOT)) {
    if (!((stock && stock[g]) > 0)) continue;
    const [row, col] = SLOT[g], tx = SHELF.x0 + col * SHELF.bay + 28, ty = SHELF.board[row] + 4, p = priceFor(g);
    M.rect(tx, ty, 20, 9, '#fff3dc'); M.rect(tx, ty + 8, 20, 1, '#c9a27a'); M.rect(tx - 1, ty + 1, 1, 7, '#fff3dc'); M.rect(tx + 20, ty + 1, 1, 7, '#fff3dc');
    if (p) { const d = String(p).split(''), w = d.length * 4 + 3, x0 = tx + Math.round((20 - w) / 2);
      d.forEach((k, i) => FONT[k].forEach((r, y) => r.split('').forEach((b, x) => { if (b === '1') M.px(x0 + i * 4 + x, ty + 2 + y, '#7a3d2a'); })));
      const cx = x0 + d.length * 4; M.rect(cx, ty + 3, 2, 1, '#b07a4a'); M.rect(cx, ty + 4, 1, 2, '#b07a4a'); M.rect(cx, ty + 6, 2, 1, '#b07a4a'); }
  }
  const has = id => decor.includes(id);
  if (has('fairylights')) {
    const cols = ['#ffe680', '#ffb0d0', '#a0d8ff', '#b0ffd0'];
    for (let x = -116; x < WW + 116; x += 2) { const t = (((x + 160) % 160) / 160); M.px(x, 148 + Math.sin(t * Math.PI) * 18 - 4, '#5a6a4a'); }
    for (let i = 0; i < 54; i++) { const x = -112 + i * 16, t = (((x + 160) % 160) / 160), y = 146 + Math.sin(t * Math.PI) * 18; const c = cols[i % 4]; M.rect(x - 1, y - 1, 3, 4, c); M.px(x, y - 2, '#3a4a2a'); lights.push({ x, y: y + 1, r: 16, c, a: .9, fl: true, tw: i }); }
  }
  if (has('bell')) { M.rect(474, 188, 30, 4, '#5a3a28'); M.spr(DSPR.bell, 474, 190, 2); lights.push({ x: 488, y: 206, r: 30, c: '#ffe080', a: .4 }); }
  if (has('rug')) { const [x, y] = SPOT.inside.cust; [['#e2566b', 84, 22], ['#ffd86b', 72, 18], ['#7bb4d9', 60, 15], ['#f6a6bd', 46, 11], ['#fff3e6', 30, 7]].forEach(([c, rx, ry]) => M.ellipse(x, y + 2, rx, ry, c)); M.dither(x - 84, y - 20, 168, 44, 'rgba(0,0,0,0)', 0); }
  if (has('catbed')) { M.ellipse(112, 400, 40, 16, '#8a78c0'); M.ellipse(112, 396, 36, 12, '#b9a6e8'); M.ellipse(112, 394, 28, 8, '#d8ccf4'); M.spr(DSPR.catbed, 88, 370, 3); }
  // the counter (drawn in front of the shopkeeper)
  const [counter, cx] = wcnv(), C = painter(cx);
  C.rect(186, 318, 290, 14, '#c88a58'); C.rect(186, 318, 290, 3, '#e0a878'); C.rect(186, 330, 290, 3, '#8a5a3a');
  C.rect(192, 332, 278, 62, '#b07a4a'); C.dither(192, 332, 278, 62, '#9a6a3e', .2);
  for (let i = 0; i < 4; i++) { const x = 202 + i * 68; C.rect(x, 342, 58, 42, '#9a6a3e'); C.rect(x + 3, 345, 52, 36, '#b88452'); C.rect(x + 3, 345, 52, 2, '#c89462'); }
  C.rect(192, 392, 278, 4, '#6e4a2e');
  // till
  C.rect(392, 290, 52, 30, '#4a84a9'); C.rect(394, 292, 48, 24, '#7bb4d9'); C.rect(398, 284, 40, 8, '#5a94b9'); C.rect(400, 286, 36, 4, '#e8f4ff');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) C.rect(400 + i * 9, 298 + j * 8, 6, 5, '#f2c75a');
  lights.push({ x: 418, y: 288, r: 30, c: '#fff0b0', a: .35 });
  // wicker basket
  C.ellipse(228, 312, 20, 7, '#8a5a2a'); C.rect(208, 300, 41, 12, '#c8944a'); for (let x = 210; x < 248; x += 4) C.rect(x, 300, 2, 12, '#a87436'); C.rect(208, 299, 41, 2, '#e0b070');
  for (let x = 212; x < 245; x += 2) C.px(x, 294 - Math.sin((x - 212) / 33 * Math.PI) * 10, '#8a5a2a');
  if (has('vase')) C.spr(DSPR.vase, 250, 278, 2);
  // treasures from Miu's stall: a little ledge on brackets along the front of the counter, one slot each
  const tr = TREASURE_ORDER.filter(id => treasures.includes(id));
  if (tr.length) {
    C.rect(198, 374, 236, 5, '#8a5a36'); C.rect(198, 374, 236, 2, '#b07a4a'); C.rect(198, 379, 236, 2, '#5a3a24');
    for (const x of [206, 314, 422]) { C.rect(x, 381, 4, 8, '#6b4a33'); C.rect(x + 1, 381, 2, 8, '#8a5a3a'); }
    TREASURE_ORDER.forEach((id, i) => {
      if (!treasures.includes(id)) return;
      const sp = TRSPR[id], cx0 = 212 + i * 29.5; C.spr(sp, cx0 - sp.w, 374 - sp.h * 2, 2);
      if (id === 'crown' || id === 'apple' || id === 'scarab' || id === 'lyre') lights.push({ x: cx0, y: 374 - sp.h, r: 18, c: '#fff0a0', a: .35, fl: true, tw: i });
    });
  }
  // lights and shafts
  lights.push({ x: 408, y: 152, r: 110, c: '#e8f4ff', a: .45 }, { x: 321, y: 104, r: 64, c: '#ffc860', a: .8, fl: true }, { x: 546, y: 280, r: 90, c: '#d8ffb0', a: .35 });
  shafts.push({ x: 430, y: 110, ang: 0.62, n: 3, len: 420, w: 40, gap: 34, c: '#fff6d8', a: .2 });
  const midT = tiltShift(mid, 104, 452, 4);
  const [fore, fx] = wcnv(), F = painter(fx);
  F.poly([[0, 420], [60, 400], [110, 480], [0, 480]], '#5a3a2a'); F.ellipse(40, 470, 60, 30, '#6e4a30');
  F.ellipse(612, 466, 46, 34, '#7a5a3a'); F.ellipse(600, 444, 26, 14, '#c23f55'); F.ellipse(596, 440, 6, 3, '#fff3e2');
  return { back: null, mid: midT, fore: blurred(fore, 7), counter, lights, shafts, motes: { c: '#fff4d0', n: 22, glow: false, area: [300, 120, 260, 260], rise: false } };
}

/* ---------------------------------------------------------------- BRAMBLE WOOD VILLAGE
   A side-scrolling lane behind the shop: her own cottage, the gate home, Mrs. Bunbury's burrow, Dot's flower stall,
   Old Hoot's oak library, the little square with the notice board, Miu's treasure stall, the fairy ring, the duck pond
   and Tansy's home-things stall. Painted once (about 3900 x 480 world px) and scrolled by the camera, which follows the
   shopkeeper. Places sit behind the lane; she walks along it (world y ~ VLANE). What moves (chimney smoke, the windmill's
   sails, the ducks, the villagers out for a stroll) is drawn each frame on top of the baked layers. */
const VX0 = -290, VX1 = 1640, VCW = VX1 - VX0; // the village's chunky-grid width; world x runs from 2*VX0 to 2*VX1
const VLANE = 410;
const VPL = { house: -180, gate: 80, burrow: 230, stall: 420, oak: 600, market: 920, ring: 1100, pond: 1290, tansy: 1480 }; // chunky x of each place
const VSQUARE = 765; // the little square with the notice board (not a place to visit)
const VPLACES = {};
for (const [id, cx] of Object.entries(VPL)) {
  const x = cx * 2;
  VPLACES[id] = id === 'gate' ? { x, stand: [x + 16, VLANE], hit: null }
    : id === 'house' ? { x, stand: [x + 60, VLANE], hit: [x - 120, x + 130] } // her own door: nobody comes out, she goes in
    : { x, stand: [x - 56, VLANE], meet: [x + 56, VLANE - 6], hit: [x - 130, x + 130] };
}
// where each neighbour comes out from: their door, the side of their stall, the middle of the ring, the boat
Object.assign(VPLACES.burrow, { door: [460, 362] });
Object.assign(VPLACES.stall, { door: [928, 366] });
Object.assign(VPLACES.oak, { door: [1200, 362] });
Object.assign(VPLACES.market, { door: [1928, 366] });
Object.assign(VPLACES.ring, { door: [2200, 356] });
Object.assign(VPLACES.pond, { door: [2616, 354] });
Object.assign(VPLACES.tansy, { door: [3048, 366] });
const VRING = { cx: 1100, cy: 174, rx: 66, ry: 13 };
// how far each of the older places' paintings moved along when the lane grew (chunky px)
const VSHIFT = { burrow: 20, stall: 40, oak: 50, market: 190, pond: 210 };

function vchunky(paint) {
  const [c, x] = cnv(VCW, CHH); x.translate(-VX0, 0); paint(painter(x), x);
  const [o, ox] = cnv(VCW * 2, WH); ox.imageSmoothingEnabled = false; ox.drawImage(c, 0, 0, VCW * 2, WH); ox.translate(-VX0 * 2, 0); return [o, ox];
}
function vcnv(extra = 0) { const [c, x] = cnv(VCW * 2 + extra * 2, WH); x.translate(-VX0 * 2 + extra, 0); return [c, x]; }
// a board with words on it, written at world resolution (crisp text on the chunky painting)
function boardText(x, text, cx, cy, maxW, size, col) {
  x.save(); x.fillStyle = col || '#6a3a22'; let fs = size; x.font = `700 ${fs}px Andika, 'Trebuchet MS', sans-serif`;
  while (x.measureText(text).width > maxW && fs > 8) { fs--; x.font = `700 ${fs}px Andika, 'Trebuchet MS', sans-serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy); x.restore();
}
const dome = (P, cx, base, rx, ry, c, d = 0) => { for (let y = base - ry; y <= base; y++) { const t = (base - y) / ry, hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t))); if (d) P.dither(cx - hw, y, hw * 2 + 1, 1, c, d); else P.rect(cx - hw, y, hw * 2 + 1, 1, c); } };
// the windmill on the hill: its tower is baked once, its sails turn (drawn between the far background and the lane)
function millBody() {
  const [c, x] = cnv(30, 60), P = painter(x), hz = k => mix(k, '#c8dcea', .3);
  P.poly([[8, 58], [10, 20], [20, 20], [22, 58]], hz('#f4ead8')); P.poly([[17, 20], [20, 20], [22, 58], [18, 58]], hz('#d8c8b0'));
  for (let y = 26; y < 58; y += 7) P.rect(10, y, 11, 1, hz('#e0d2bc'));
  dome(P, 15, 21, 8, 8, hz('#c8606a')); P.rect(7, 20, 17, 2, hz('#9a4450')); P.px(15, 12, hz('#9a4450'));
  P.ellipse(15, 50, 3, 3, hz('#8a5a3a')); P.rect(12, 50, 7, 8, hz('#8a5a3a')); P.rect(14, 32, 3, 4, '#ffe6a0');
  const [o, ox] = cnv(60, 120); ox.drawImage(c, 0, 0, 60, 120); return o;
}
function paintVillage() {
  const lights = [], shafts = [], ringLamps = [], smokes = [];
  const near = (x, w) => Object.values(VPL).some(p => Math.abs(x - p) < w) || Math.abs(x - VSQUARE) < w * .8;
  // far background: sky, sun, clouds, hills and the wood (baked blurry)
  const [back] = vchunky(P => {
    P.vgrad(VX0, 0, VCW, 150, SKY.morning);
    P.ellipse(640, 30, 16, 16, '#fff6d8'); P.ellipse(640, 30, 11, 11, '#ffffff');
    for (const [x, y, k] of [[-200, 28, .9], [120, 34, 1], [360, 20, .8], [880, 26, 1.1], [1120, 40, .9], [1380, 22, 1], [1580, 36, .8]]) { P.ellipse(x, y, 22 * k, 7 * k, '#ffffff'); P.ellipse(x - 12 * k, y + 2, 14 * k, 6 * k, '#f4f9ff'); P.ellipse(x + 10 * k, y - 3, 13 * k, 7 * k, '#ffffff'); }
    const hp = []; for (let x = VX0; x <= VX1; x += 20) hp.push([x, 102 + Math.sin(x / 90) * 8 + Math.sin(x / 33) * 3]); hp.push([VX1, 160], [VX0, 160]);
    P.poly(hp, '#a9d3a0'); P.dither(VX0, 96, VCW, 64, '#86b98a', .35);
    for (let i = 0; i * 22 < VCW + 40; i++) { const x = VX0 + i * 22 - 6 + (i % 3) * 5, y = 118 + (i % 2) * 6; P.ellipse(x, y, 16, 14, i % 2 ? '#5f9a62' : '#4a7f50'); }
    P.rect(VX0, 124, VCW, 40, '#4a7f50');
    for (const x of [-270, -110, 140, 300, 470, 640, 812, 990, 1170, 1350, 1530, 1630]) { P.rect(x, 0, 16, 170, '#5a4434'); P.dither(x, 0, 16, 170, '#40301f', .4); }
  });
  const backB = blurred(back, 3);
  // the lane, the houses and the stalls: sharp
  const [mid, mx] = vchunky((P, X) => {
    // paint one of the older places where it now stands along the longer lane (its lights move with it)
    const at = (d, f) => { const n0 = lights.length; X.save(); X.translate(d, 0); f(); X.restore(); for (let i = n0; i < lights.length; i++) lights[i].x += d * 2; };
    const g1 = '#8cc46c', g2 = '#5f9a4a';
    P.vgrad(VX0, 140, VCW, 100, [g1, g2]);
    P.noise(VX0, 142, VCW, 98, [shade(g1, .12), shade(g2, -.12), shade(g1, -.08)], .18, 3);
    // the village goes on behind the lane: little cottages further back, a bit hazy
    const hz = c => mix(c, '#b8d4e0', .26);
    for (const [cx, wall, roof, sm] of [[-262, '#fff1dc', '#c86a5a', 1], [140, '#f4e2c8', '#6a8ac8', 1], [500, '#fde6ea', '#8a6ab0', 0], [1040, '#e8f0d8', '#c86a5a', 0], [1222, '#f4e2c8', '#5a9a8a', 1], [1570, '#fde6ea', '#c86a5a', 1]]) {
      const base = 150, w = 15, h = 18;
      P.rect(cx - w, base - h, w * 2, h, hz(wall)); P.rect(cx + w - 6, base - h, 6, h, hz(shade(wall, -.12)));
      P.poly([[cx - w - 4, base - h + 1], [cx, base - h - 15], [cx + w + 4, base - h + 1]], hz(roof)); P.rect(cx - w - 4, base - h, w * 2 + 8, 2, hz(shade(roof, -.3)));
      P.rect(cx + 6, base - h - 17, 5, 10, hz('#9a8a80')); P.rect(cx + 5, base - h - 18, 7, 2, hz('#7a6a64'));
      if (sm) smokes.push([(cx + 8.5) * 2, (base - h - 19) * 2, .8]);
      P.rect(cx - 3, base - 10, 7, 10, hz('#8a5a3a'));
      for (const sx of [-10, 7]) { P.rect(cx + sx, base - 14, 5, 5, '#ffe6a0'); P.rect(cx + sx + 2, base - 14, 1, 5, hz('#8a5a3a')); }
    }
    // middle-distance trees between the places (behind everything else)
    for (const x of [-270, -95, 330, 1015, 1195, 1395, 1612]) {
      P.rect(x - 7, 40, 14, 120, '#6a4a32'); P.rect(x + 3, 40, 4, 120, '#4e3424'); P.ellipse(x, 160, 12, 3, '#4e7a3e');
      P.ellipse(x, 34, 40, 26, '#4e8a44'); P.ellipse(x - 16, 46, 26, 16, '#5f9a4a'); P.ellipse(x + 14, 22, 24, 16, '#6aa860'); P.ellipse(x - 6, 16, 16, 10, '#8cc46c');
    }
    // bushes along the back of the grass
    const r = rng(23);
    for (let x = VX0; x < VX1; x += 26) { const bx = x + r() * 10; if (near(bx, 52)) continue; P.ellipse(bx, 156, 14, 9, '#5f9a4a'); P.ellipse(bx - 3, 153, 9, 6, '#7cb36a'); }
    // a little split-rail fence along the back of the lane, broken by each place
    for (let x = VX0; x < VX1; x += 2) if (!near(x, 70)) { P.px(x, 176, '#9a6a45'); P.px(x, 181, '#9a6a45'); }
    for (let x = VX0; x < VX1; x += 16) if (!near(x, 70)) { P.rect(x, 172, 3, 14, '#8a5a3a'); P.rect(x, 172, 1, 14, '#b07a4a'); }
    // flowers in the grass
    const fl = ['#f6a6bd', '#ffd86b', '#ffffff', '#9fc7e8', '#c9b6f0'];
    for (let i = 0; i < 640; i++) { const x = VX0 + r() * VCW, y = 160 + r() * 80; if (y > 184 && y < 218) continue; if (y < 184 && near(x, 60)) continue; P.px(x, y, fl[i % fl.length]); P.px(x, y + 1, g2); }
    // the lane (packed earth with pebbles)
    for (let x = VX0; x < VX1; x++) {
      const t = Math.round(186 + Math.sin(x / 37) * 1.5 + Math.sin(x / 13) * .8), b = Math.round(215 + Math.sin(x / 29) * 1.6);
      P.rect(x, t, 1, b - t, '#e6d0a4'); P.px(x, t, '#cbb184'); P.px(x, b - 1, '#c8ae80'); if ((x * 7) % 5 === 0) P.px(x, t - 1, '#7cb36a');
    }
    P.noise(VX0, 188, VCW, 25, ['#d4bc8e', '#f2e2bc', '#c4a878'], .07, 9);
    P.dither(VX0, 205, VCW, 9, '#d4bc8e', .25);

    /* --- her own little cottage at the far end, past the gate: a thatched roof, a round pink door and a heart sign --- */
    { const x = VPL.house;
      // a picket fence and flowers round the front
      for (const [a, b] of [[x - 74, x - 46], [x + 62, x + 76]]) { for (let px = a; px <= b; px += 4) { P.rect(px, 172, 3, 13, '#fff6e6'); P.px(px + 1, 171, '#fff6e6'); P.rect(px + 2, 173, 1, 12, '#d8ccb8'); } P.rect(a, 176, b - a + 3, 2, '#e8dcc8'); }
      const fr = rng(61); for (let i = 0; i < 26; i++) { const fx = x - 70 + fr() * 140, fy = 178 + fr() * 6; if (Math.abs(fx - x) < 16) continue; P.rect(fx, fy, 1, 3, '#5f9a4a'); P.rect(fx - 1, fy - 2, 3, 2, ['#f6a6bd', '#ffd86b', '#ffffff', '#e2566b', '#c9b6f0'][i % 5]); }
      // walls
      P.rect(x - 42, 126, 84, 59, '#fff1dc'); P.rect(x + 28, 126, 14, 59, '#eedcc0'); P.dither(x - 42, 150, 84, 35, '#f0dcc0', .18);
      P.rect(x - 44, 182, 88, 4, '#c8b49a'); for (const bx of [x - 42, x + 40]) P.rect(bx, 126, 3, 58, '#c08a58');
      // round thatched roof with a little curl on top
      dome(P, x, 132, 56, 44, '#b8862a'); dome(P, x - 1, 130, 53, 42, '#e9b949'); dome(P, x - 10, 112, 30, 20, '#f2cc6a', .5);
      for (let i = 0; i < 18; i++) { const a = Math.PI * (.08 + i * .047), lx = x - Math.cos(a) * 50, ly = 130 - Math.sin(a) * 38; P.line(lx, ly, lx + Math.cos(a) * 6, ly + Math.sin(a) * 6 + 4, '#c8962e'); }
      P.rect(x - 56, 129, 112, 4, '#c8962e'); for (let px = x - 56; px < x + 56; px += 3) P.px(px, 133, '#b8862a');
      P.ellipse(x - 1, 86, 4, 3, '#e9b949'); P.px(x + 2, 83, '#c8962e'); P.px(x + 3, 84, '#c8962e');
      // chimney (the smoke is drawn each frame)
      P.rect(x + 20, 88, 10, 22, '#b0a090'); P.rect(x + 26, 88, 4, 22, '#8a7a6c'); P.rect(x + 18, 85, 14, 4, '#7a6a64'); P.dither(x + 20, 92, 10, 14, '#968676', .3);
      smokes.push([(x + 25) * 2, 166]);
      // round pink door, a step and a lantern
      P.ellipse(x, 162, 14, 14, '#9a6a45'); P.rect(x - 14, 162, 29, 22, '#9a6a45');
      P.ellipse(x, 162, 11, 11, '#f6a6bd'); P.rect(x - 11, 162, 23, 22, '#f6a6bd'); P.ellipse(x - 3, 159, 6, 6, '#fbc4d4');
      for (const dx of [-5, 0, 5]) P.rect(x + dx, 152, 1, 32, '#e2889c');
      P.ellipse(x + 7, 171, 1.6, 1.6, '#f2c75a'); P.rect(x - 16, 184, 33, 3, '#cbb184'); P.rect(x - 16, 184, 33, 1, '#e6d0a4');
      P.ellipse(x - 2, 156, 4, 3.5, '#e2566b'); P.ellipse(x + 2, 156, 4, 3.5, '#e2566b'); P.poly([[x - 5.5, 157], [x + 5.5, 157], [x, 163]], '#e2566b'); // a heart on the door
      // windows with flower boxes
      for (const wx of [x - 27, x + 26]) {
        P.ellipse(wx, 150, 8, 8, '#9a6a45'); P.ellipse(wx, 150, 6, 6, '#ffe6a0'); P.ellipse(wx - 2, 148, 2, 2, '#fff8d8'); P.rect(wx, 144, 1, 13, '#9a6a45'); P.rect(wx - 6, 150, 13, 1, '#9a6a45');
        lights.push({ x: wx * 2, y: 300, r: 28, c: '#ffd890', a: .3, fl: true });
        P.rect(wx - 9, 159, 19, 5, '#7bb4d9'); P.rect(wx - 9, 163, 19, 1, '#4a84a9'); P.rect(wx - 9, 159, 19, 1, '#bfe3ff');
        for (let i = 0; i < 6; i++) { const fx = wx - 7 + i * 3; P.rect(fx, 156, 1, 3, '#5f9a4a'); P.rect(fx - 1, 154 - (i % 2), 3, 2, ['#f6a6bd', '#ffd86b', '#ffffff', '#e2566b'][i % 4]); }
      }
      // a heart sign on a post, so she knows it is hers
      P.rect(x + 52, 146, 3, 40, '#6b4a33'); P.rect(x + 52, 146, 1, 40, '#9a6a45');
      P.ellipse(x + 49, 141, 5, 5, '#a82e46'); P.ellipse(x + 58, 141, 5, 5, '#a82e46'); P.poly([[x + 43, 142], [x + 64, 142], [x + 53.5, 154]], '#a82e46');
      P.ellipse(x + 49, 141, 4, 4, '#e2566b'); P.ellipse(x + 58, 141, 4, 4, '#e2566b'); P.poly([[x + 45, 142], [x + 62, 142], [x + 53.5, 152]], '#e2566b'); P.px(x + 47, 139, '#ffd0d6'); P.px(x + 48, 138, '#ffd0d6');
      // stepping stones down to the lane
      for (const [sx, sy] of [[x + 2, 189], [x - 3, 194]]) { P.ellipse(sx, sy + 1, 6, 2, '#bca888'); P.ellipse(sx, sy, 6, 2, '#e6d6b8'); }
    }
    /* --- the gate (the way home) and a peek of her own toadstool --- */
    { const red = '#e2566b', redS = '#b83a50';
      P.poly([[-30, 182], [-26, 140], [-24, 118], [12, 118], [14, 140], [18, 182]], '#fff1dc'); P.poly([[4, 118], [12, 118], [14, 140], [18, 182], [8, 182]], '#e8d4b8');
      P.ellipse(-6, 116, 52, 7, '#f2b0b0');
      dome(P, -6, 114, 60, 44, redS); dome(P, -9, 112, 56, 41, red); dome(P, -20, 86, 26, 18, '#f27a8a');
      for (const [x, y, rx, ry] of [[-26, 84, 8, 5], [6, 74, 9, 6], [30, 96, 7, 5], [-10, 100, 6, 4]]) P.ellipse(x, y, rx, ry, '#fff3e2');
      P.ellipse(-4, 150, 7, 7, '#7a5032'); P.ellipse(-4, 150, 5, 5, '#ffd27a'); lights.push({ x: -8, y: 300, r: 30, c: '#ffd27a', a: .3 });
      // the garden arch
      for (const x of [62, 96]) { P.rect(x - 2, 128, 5, 56, '#8a5a3a'); P.rect(x - 2, 128, 2, 56, '#b07a4a'); }
      for (let a = 0; a <= 32; a++) { const t = Math.PI * a / 32, x = 79 - Math.cos(t) * 17, y = 128 - Math.sin(t) * 14; P.rect(x - 1, y - 1, 3, 3, '#8a5a3a'); }
      const lr = rng(41); for (let i = 0; i < 46; i++) { const t = lr() * Math.PI, side = lr(); const x = side < .7 ? 79 - Math.cos(t) * 17 : (lr() < .5 ? 62 : 96), y = side < .7 ? 128 - Math.sin(t) * 14 : 130 + lr() * 46; P.rect(x - 1 + lr() * 2, y - 1 + lr() * 2, 2, 2, lr() < .2 ? '#f6a6bd' : lr() < .5 ? '#7cb36a' : '#5f9a4a'); }
      P.rect(64, 182, 30, 3, '#cbb184');
      // the signpost, an arrow pointing home
      P.rect(122, 138, 3, 48, '#6b4a33'); P.rect(122, 138, 1, 48, '#9a6a45');
      P.poly([[94, 147], [101, 139], [150, 139], [150, 155], [101, 155]], '#6b4a33'); P.poly([[96, 147], [102, 141], [148, 141], [148, 153], [102, 153]], '#f3dcb0');
      P.rect(102, 141, 46, 1, '#fff3dc');
    }
    /* --- Mrs. Bunbury's burrow: a grassy mound with a round red door and a carrot patch --- */
    at(VSHIFT.burrow, () => { const x = 210;
      dome(P, x, 183, 66, 56, '#4e8a3e'); dome(P, x - 2, 182, 63, 54, '#6aa860'); dome(P, x - 14, 160, 40, 28, '#7cb36a', .5); dome(P, x - 18, 150, 22, 16, '#8cc46c', .5);
      const gr = rng(5); for (let i = 0; i < 60; i++) { const a = Math.PI * (.05 + gr() * .9), px = x - Math.cos(a) * 64, py = 182 - Math.sin(a) * 55; P.rect(px, py - 2, 1, 3, '#4e8a3e'); if (i % 4 === 0) P.px(px + 1, py - 3, ['#ffd86b', '#ffffff', '#f6a6bd'][i % 3]); }
      // chimney pipe (its smoke is drawn each frame)
      P.rect(236, 128, 6, 12, '#8a8078'); P.rect(235, 126, 8, 3, '#6a625c');
      // round red door, step and lamp
      P.ellipse(x, 166, 17, 17, '#7a5032'); P.ellipse(x, 166, 14, 14, '#d0443e'); P.ellipse(x - 3, 162, 8, 8, '#e05a50');
      for (const dx of [-7, 0, 7]) P.rect(x + dx, 153, 1, 26, '#a8302c');
      P.rect(x - 18, 181, 37, 4, '#cbb184'); P.rect(x - 18, 181, 37, 1, '#e6d0a4'); P.rect(x - 16, 176, 33, 6, '#6aa860');
      P.ellipse(x + 8, 168, 1.6, 1.6, '#f2c75a');
      for (const wx of [176, 244]) { P.ellipse(wx, 158, 7, 7, '#7a5032'); P.ellipse(wx, 158, 5, 5, '#ffe6a0'); P.ellipse(wx - 1, 156, 2, 2, '#fff8d8'); P.rect(wx, 153, 1, 11, '#7a5032'); P.rect(wx - 5, 158, 11, 1, '#7a5032'); lights.push({ x: wx * 2, y: 316, r: 26, c: '#ffd890', a: .25, fl: true }); }
      // a washing line behind the carrot patch
      for (const px of [282, 318]) { P.rect(px, 134, 2, 38, '#8a5a3a'); P.rect(px, 134, 1, 38, '#b07a4a'); }
      for (let px = 283; px <= 318; px++) P.px(px, 137 + Math.sin((px - 283) / 35 * Math.PI) * 4, '#fff6e6');
      [['#f6a6bd', 287, 9, 'dress'], ['#7bb4d9', 296, 7, 'shirt'], ['#ffd86b', 304, 5, 'sock'], ['#8cc46c', 311, 8, 'towel']].forEach(([c, px, h, k]) => {
        const py = Math.round(138 + Math.sin((px - 283) / 35 * Math.PI) * 4);
        if (k === 'dress') { P.poly([[px - 2, py], [px + 3, py], [px + 5, py + h], [px - 4, py + h]], c); P.rect(px - 1, py + 3, 3, 1, '#ffffff'); }
        else if (k === 'shirt') { P.rect(px - 3, py, 7, h, c); P.rect(px - 5, py, 2, 3, c); P.rect(px + 4, py, 2, 3, c); P.px(px, py + 2, '#ffffff'); P.px(px, py + 4, '#ffffff'); }
        else if (k === 'sock') { P.rect(px - 1, py, 3, h, c); P.rect(px - 1, py + h - 1, 5, 2, c); P.rect(px - 1, py, 3, 1, '#e2566b'); }
        else { P.rect(px - 3, py, 7, h, c); for (let i = 0; i < 3; i++) P.px(px - 2 + i * 2, py + 2 + i, '#ffffff'); }
        P.px(px - 1, py - 1, '#c08a58'); P.px(px + 2, py - 1, '#c08a58');
      });
      // the carrot patch
      for (let row = 0; row < 3; row++) {
        const yy = 176 + row * 5; P.rect(256, yy, 46, 3, '#7a5032'); P.rect(256, yy, 46, 1, '#9a6a45');
        for (let k = 0; k < 6; k++) { const cx = 259 + k * 7 + (row % 2) * 3; P.rect(cx - 1, yy - 1, 4, 2, '#f08a3a'); P.px(cx, yy + 1, '#d8702a'); P.rect(cx - 1, yy - 3, 1, 2, '#5f9a4a'); P.rect(cx, yy - 5, 2, 4, '#7cb36a'); P.rect(cx + 2, yy - 3, 1, 2, '#5f9a4a'); P.px(cx - 2, yy - 4, '#7cb36a'); P.px(cx + 3, yy - 4, '#7cb36a'); }
      }
      P.rect(254, 170, 2, 22, '#8a5a3a'); P.rect(250, 168, 10, 6, '#f3dcb0'); P.rect(252, 170, 2, 2, '#f08a3a'); P.rect(255, 170, 3, 1, '#5f9a4a');
    });
    smokes.push([(239 + VSHIFT.burrow) * 2, 250]);
    /* --- Dot's flower stall: a striped awning, buckets of flowers --- */
    at(VSHIFT.stall, () => { const wd = '#c98a5a', wdS = '#8a5a3a';
      for (const px of [346, 410]) { P.rect(px, 104, 4, 78, wdS); P.rect(px, 104, 2, 78, wd); }
      P.rect(344, 154, 72, 4, '#e0aa7a'); P.rect(346, 158, 68, 24, wd); P.rect(346, 158, 68, 2, wdS);
      for (const px of [362, 380, 398]) P.rect(px, 160, 1, 22, wdS);
      for (let i = 0; i < 10; i++) { const sx = 338 + i * 8.4; P.rect(sx, 96, 9, 14, i % 2 ? '#fff3e6' : '#e2566b'); P.ellipse(sx + 4, 110, 4, 3, i % 2 ? '#fff3e6' : '#e2566b'); }
      P.rect(336, 94, 88, 3, '#9a3448'); P.dither(338, 97, 84, 3, '#9a3448', .3);
      // a painted flower on a board on top
      P.rect(369, 80, 22, 14, wdS); P.rect(371, 82, 18, 10, '#fff3dc'); P.ellipse(380, 87, 3, 3, '#f6a6bd'); P.ellipse(380, 87, 1, 1, '#ffd23a'); P.rect(379, 90, 1, 2, '#5f9a4a');
      const cols = [['#f6a6bd', '#e2668b'], ['#ffd86b', '#f0a92a'], ['#ffffff', '#c9b6f0'], ['#e2566b', '#ffd86b'], ['#c9b6f0', '#9a86d0']];
      const fr = rng(13);
      const bucket = (bx, by, c, tall) => {
        for (let k = 0; k < 9; k++) { const fx = bx - 4 + fr() * 9, fy = by - tall - fr() * 8; P.line(bx, by - 2, fx, fy + 2, '#5f9a4a'); P.rect(fx - 1, fy, 3, 3, c[k % 2]); P.px(fx, fy + 1, '#ffd23a'); }
        P.rect(bx - 5, by - 6, 11, 7, '#7bb4d9'); P.rect(bx - 5, by - 6, 11, 1, '#bfe3ff'); P.rect(bx + 4, by - 5, 2, 6, '#4a84a9');
      };
      cols.forEach((c, i) => bucket(354 + i * 13, 155, c, 6));
      bucket(334, 186, cols[1], 12); bucket(426, 186, cols[0], 12); bucket(436, 188, cols[2], 9);
    });
    /* --- Old Hoot's library: a big oak with a door, little windows and a "Library" sign --- */
    at(VSHIFT.oak, () => { const x = 550;
      P.poly([[510, 186], [522, 172], [528, 120], [526, 50], [574, 50], [572, 120], [578, 172], [592, 186]], '#7a5434');
      P.poly([[556, 50], [574, 50], [572, 120], [578, 172], [592, 186], [566, 186]], '#5e3e26');
      for (let i = 0; i < 16; i++) { const bx = 528 + (i * 7) % 40, by = 60 + i * 7; P.rect(bx, by, 1, 6, '#5a3a24'); }
      P.line(528, 114, 494, 104, '#6a4a2e'); P.line(528, 115, 494, 105, '#6a4a2e'); P.line(528, 116, 496, 106, '#7a5434');
      P.line(572, 96, 604, 84, '#6a4a2e'); P.line(572, 97, 604, 85, '#7a5434');
      for (const [cx, cy, rx, ry, c] of [[550, 40, 84, 42, '#3e7238'], [492, 64, 40, 24, '#4e8a44'], [610, 60, 42, 24, '#4e8a44'], [546, 20, 62, 30, '#4e8a44'], [520, 30, 36, 20, '#5f9a4a'], [584, 34, 34, 20, '#5f9a4a'], [530, 14, 24, 12, '#7cb36a'], [500, 54, 18, 10, '#6aa860']]) P.ellipse(cx, cy, rx, ry, c);
      P.dither(470, 60, 160, 26, '#2e5a2c', .3);
      P.ellipse(x, 160, 14, 12, '#4a3020'); P.rect(x - 14, 160, 29, 24, '#4a3020');
      P.ellipse(x, 160, 11, 9, '#3a7a8a'); P.rect(x - 11, 160, 23, 23, '#3a7a8a'); for (const dx of [-5, 1, 7]) P.rect(x + dx, 152, 1, 31, '#2a5a68');
      P.ellipse(x + 7, 172, 1.4, 1.4, '#f2c75a'); P.rect(x - 16, 183, 33, 3, '#a89888');
      for (const [wx, wy, rr] of [[536, 126, 5], [563, 98, 4]]) { P.ellipse(wx, wy, rr + 2, rr + 2, '#4a3020'); P.ellipse(wx, wy, rr, rr, '#ffe6a0'); P.rect(wx, wy - rr, 1, rr * 2 + 1, '#4a3020'); lights.push({ x: wx * 2, y: wy * 2, r: 24, c: '#ffd890', a: .3, fl: true }); }
      P.rect(498, 106, 1, 9, '#5a5050'); P.rect(526, 110, 1, 5, '#5a5050');
      P.rect(486, 114, 50, 16, '#6b4a33'); P.rect(488, 116, 46, 12, '#f3dcb0');
      const bc = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8'];
      for (let i = 0; i < 6; i++) P.rect(574 + (i % 2), 182 - i * 3, 12, 3, bc[i % 5]);
      for (let i = 0; i < 4; i++) P.rect(590 + (i % 2), 182 - i * 3, 10, 3, bc[(i + 2) % 5]);
      P.rect(520, 150, 1, 34, '#4a3020'); P.rect(517, 144, 7, 7, '#6b4a33'); P.rect(518, 145, 5, 5, '#ffe6a0'); lights.push({ x: 1041, y: 295, r: 26, c: '#ffd070', a: .4, fl: true });
    });
    /* --- the little square: cobbles, a notice board with a roof, bunting and flower tubs --- */
    { const x = VSQUARE;
      P.ellipse(x, 184, 50, 9, '#c8b48e'); P.ellipse(x, 183, 48, 8, '#e0d0b0');
      const cr = rng(77); for (let i = 0; i < 90; i++) { const a = cr() * Math.PI * 2, d = Math.sqrt(cr()); P.rect(x + Math.cos(a) * 46 * d, 183 + Math.sin(a) * 7 * d, 2, 1, cr() < .5 ? '#cbb890' : '#efe2c4'); }
      for (const px of [x - 13, x + 11]) { P.rect(px, 148, 3, 36, '#6b4a33'); P.rect(px, 148, 1, 36, '#9a6a45'); }
      P.rect(x - 20, 146, 41, 22, '#8a5a3a'); P.rect(x - 18, 148, 37, 18, '#c08a58'); P.dither(x - 18, 148, 37, 18, '#a87048', .2);
      P.poly([[x - 24, 146], [x, 136], [x + 24, 146]], '#5f9a4a'); P.rect(x - 24, 145, 49, 2, '#3e7238');
      [['#fff6e6', x - 14, 150, 9, 10], ['#ffd86b', x - 3, 152, 8, 8], ['#f6a6bd', x + 7, 149, 9, 9], ['#cfeaff', x - 9, 158, 8, 6]].forEach(([c, px, py, w, h]) => { P.rect(px, py, w, h, c); P.rect(px, py + h, w, 1, shade(c, -.25)); P.px(px + (w >> 1), py, '#e2566b'); P.rect(px + 2, py + 3, w - 4, 1, '#a89a8a'); if (h > 7) P.rect(px + 2, py + 5, w - 5, 1, '#a89a8a'); });
      // bunting from two tall poles across the square
      for (const px of [x - 46, x + 44]) { P.rect(px, 108, 3, 78, '#8a5a3a'); P.rect(px, 108, 1, 78, '#b07a4a'); P.ellipse(px + 1, 107, 2, 2, '#f2c75a'); }
      const bcol = ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#c9b6f0', '#f6a6bd'];
      for (let px = x - 44; px <= x + 44; px++) P.px(px, 112 + Math.sin((px - x + 44) / 88 * Math.PI) * 9, '#8a6a4a');
      for (let i = 0; i < 11; i++) { const px = x - 42 + i * 8, py = 112 + Math.sin((px - x + 44) / 88 * Math.PI) * 9; P.poly([[px, py], [px + 6, py], [px + 3, py + 7]], bcol[i % 6]); }
      // flower tubs at the corners
      for (const px of [x - 34, x + 32]) { P.rect(px - 5, 178, 11, 7, '#a87048'); P.rect(px - 5, 178, 11, 1, '#c89060'); for (let i = 0; i < 5; i++) { P.rect(px - 4 + i * 2, 174 - (i % 2), 2, 4, '#5f9a4a'); P.rect(px - 4 + i * 2, 172 - (i % 2), 2, 2, bcol[(i + px) % 6]); } }
    }
    /* --- Miu's treasure stall: sandstone columns, a winged sun, a little pyramid behind --- */
    at(VSHIFT.market, () => { const sd = '#f0d8a0', sdS = '#c8a868', bl = '#3a6fb0', gd = '#e0b040';
      P.poly([[640, 156], [694, 84], [748, 156]], '#e8c88a'); P.poly([[694, 84], [748, 156], [706, 156]], '#c8a060');
      for (let y = 92; y < 156; y += 6) { const hw = (y - 84) * 54 / 72; P.rect(694 - hw, y, hw * 2, 1, '#c8a060'); }
      P.rect(692, 84, 4, 3, '#f2c75a');
      for (const px of [694, 762]) {
        P.rect(px - 4, 110, 9, 72, sd); P.rect(px + 2, 110, 3, 72, sdS);
        P.poly([[px - 7, 104], [px + 8, 104], [px + 5, 112], [px - 4, 112]], '#7cb36a'); P.rect(px - 6, 104, 14, 2, gd);
        P.rect(px - 4, 120, 9, 2, bl); P.rect(px - 4, 124, 9, 1, gd); P.rect(px - 6, 180, 13, 4, sdS);
      }
      P.rect(684, 96, 90, 10, sd); P.rect(684, 104, 90, 2, sdS);
      for (let i = 0; i < 12; i++) P.rect(686 + i * 7.4, 97, 3, 2, i % 2 ? bl : gd);
      P.ellipse(729, 100, 4, 4, '#e2566b'); P.ellipse(729, 100, 2, 2, '#f2a93b');
      for (let i = 1; i <= 14; i++) { P.px(729 - 4 - i, 99 + Math.floor(i / 5), i % 2 ? bl : gd); P.px(729 + 4 + i, 99 + Math.floor(i / 5), i % 2 ? bl : gd); }
      for (let i = 0; i < 9; i++) { const sx = 698 + i * 7; P.rect(sx, 106, 7, 8, i % 2 ? '#fff3dc' : bl); P.ellipse(sx + 3, 114, 3, 2, i % 2 ? '#fff3dc' : bl); }
      P.rect(700, 152, 60, 4, '#f8e6b8'); P.rect(702, 156, 56, 28, sd); P.rect(702, 156, 56, 2, sdS);
      for (const by of [165, 174]) P.rect(702, by, 56, 1, sdS); for (const bx of [716, 730, 744]) P.rect(bx, 157, 1, 27, sdS);
      const gl = '#6a4a2a';
      P.ellipse(709, 161, 3, 1.5, gl); P.px(709, 161, sd); P.px(709, 163, gl);
      P.ellipse(723, 160, 1.5, 1.5, bl); P.rect(722, 162, 3, 1, bl); P.rect(723, 162, 1, 3, bl);
      P.rect(736, 160, 3, 2, gl); P.px(739, 159, gl); P.px(735, 162, gl); P.px(737, 162, gl);
      for (let k = 0; k < 4; k++) { P.px(749 + k * 2, 161, bl); P.px(750 + k * 2, 160, bl); }
      P.rect(707, 168, 4, 4, gd); P.rect(721, 169, 6, 2, gl); P.px(737, 168, bl); P.px(738, 169, bl); P.px(739, 170, bl); P.rect(749, 169, 5, 3, gd);
      P.rect(708, 177, 3, 4, bl); P.rect(724, 176, 1, 5, gl); P.rect(738, 178, 4, 2, gd); P.rect(750, 176, 2, 5, gl);
      for (const [px, py] of [[680, 184], [784, 186]]) { P.ellipse(px, py - 6, 6, 7, '#c8703a'); P.rect(px - 3, py - 15, 7, 3, '#a85a2a'); P.rect(px - 6, py - 7, 13, 2, bl); P.ellipse(px - 2, py - 8, 2, 3, '#e08a50'); }
      P.rect(798, 140, 3, 46, '#8a6a3a'); for (let y = 144; y < 184; y += 4) P.rect(797, y, 5, 1, '#6a4a2a');
      for (const [dx, dy] of [[-16, 6], [16, 6], [-12, -4], [12, -4], [0, -8]]) P.line(799, 140, 799 + dx, 140 + dy, '#4e8a44');
      for (const [dx, dy] of [[-14, 7], [14, 7], [-10, -3], [10, -3]]) P.line(799, 141, 799 + dx, 141 + dy, '#6aa860');
    });
    /* --- the fairy ring: toadstools in a circle with lanterns on little posts --- */
    { const R = VRING;
      P.ellipse(R.cx, R.cy, R.rx + 8, R.ry + 4, '#9fd47e'); P.dither(R.cx - R.rx - 8, R.cy - R.ry - 4, (R.rx + 8) * 2, (R.ry + 4) * 2, '#b8e098', .25);
      P.ellipse(R.cx, R.cy, R.rx - 10, R.ry - 4, '#8cc46c');
      const caps = ['#e2566b', '#f6a6bd', '#c9b6f0', '#ffd86b', '#f08a3a'];
      const items = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .13; items.push({ a, x: R.cx + Math.cos(a) * R.rx, y: R.cy + Math.sin(a) * R.ry, lamp: i % 2 === 1 }); }
      items.sort((p, q) => p.y - q.y);
      items.forEach((it, i) => {
        const k = .75 + (it.y - (R.cy - R.ry)) / (R.ry * 2) * .5;
        if (it.lamp) {
          const h = Math.round(24 * k); P.rect(it.x - 1, it.y - h, 2, h, '#4a3a2a'); P.rect(it.x - 3, it.y - h - 7, 7, 8, '#3a2a20'); P.rect(it.x - 2, it.y - h - 6, 5, 6, '#5a6680'); P.rect(it.x - 4, it.y - h - 8, 9, 2, '#2a1e18');
          ringLamps.push({ x: (it.x - 2) * 2, y: (it.y - h - 6) * 2, w: 10, h: 12, gx: it.x * 2 + 1, gy: (it.y - h - 3) * 2 });
        } else {
          const s = Math.round(7 * k), c = caps[i % caps.length];
          P.rect(it.x - 1, it.y - s, 3, s + 1, '#fff1dc'); P.ellipse(it.x, it.y - s, s + 1, Math.max(2, Math.round(s * .6)), shade(c, -.2)); P.ellipse(it.x, it.y - s - 1, s, Math.max(2, Math.round(s * .55)), c); P.px(it.x - 1, it.y - s - 2, '#fff3e2'); P.px(it.x + 2, it.y - s - 1, '#fff3e2');
        }
      });
      for (let i = 0; i < 9; i++) P.px(R.cx - 24 + i * 6, R.cy - R.ry - 20 + Math.sin(i / 8 * Math.PI) * 3, ['#f6a6bd', '#ffd86b', '#b8f0c8'][i % 3]);
    }
    /* --- the duck pond, with a jetty and Captain Whiskers' little boat (the ducks are drawn each frame) --- */
    at(VSHIFT.pond, () => { const cx = 1094, cy = 170;
      P.ellipse(cx, cy + 1, 88, 17, '#5f8a4a'); P.ellipse(cx, cy, 85, 15, '#4a8ad0'); P.ellipse(cx, cy + 2, 80, 12, '#6db3f2');
      P.dither(cx - 80, cy - 13, 160, 8, '#4a8ad0', .4);
      for (const [x, y, w] of [[1030, 172, 14], [1066, 176, 20], [1120, 168, 18], [1150, 175, 12], [1090, 179, 10]]) P.rect(x, y, w, 1, '#bfe3ff');
      for (const [x, y] of [[1036, 166], [1132, 179], [1158, 167]]) { P.ellipse(x, y, 5, 2, '#5f9a4a'); P.px(x + 1, y - 1, '#f6a6bd'); P.px(x + 2, y - 1, '#ffffff'); }
      for (const [x0, n] of [[1010, 6], [1166, 5]]) for (let i = 0; i < n; i++) { const x = x0 + i * 3, h = 14 + (i * 5) % 9; P.rect(x, 176 - h, 1, h, '#4e8a3e'); if (i % 2 === 0) P.rect(x - 1, 176 - h, 3, 5, '#8a5a3a'); }
      for (const px of [1038, 1056]) P.rect(px, 158, 2, 24, '#5a3a24');
      for (let y = 160; y < 188; y += 3) { P.rect(1036, y, 23, 2, '#b88452'); P.rect(1036, y + 2, 23, 1, '#7a5032'); }
      P.poly([[1068, 170], [1122, 170], [1114, 182], [1076, 182]], '#8a5a3a'); P.rect(1068, 170, 54, 2, '#c98a5a'); P.rect(1072, 176, 46, 1, '#6e4430');
      P.rect(1094, 112, 2, 58, '#5a3a24');
      for (let y = 116; y < 166; y++) { const w = Math.round((y - 116) * 24 / 50); P.rect(1097, y, w, 1, ((y - 116) / 6 | 0) % 2 ? '#fff3e6' : '#e2566b'); }
      P.rect(1096, 104, 12, 8, '#2a2030'); P.ellipse(1101, 107, 1.6, 1.6, '#ffffff'); P.px(1100, 110, '#ffffff'); P.px(1102, 110, '#ffffff');
      P.rect(1060, 176, 8, 1, '#c8b890');
    });
    /* --- Tansy's Home Things: a stall with a dotted pink awning; a tiny chair, a lamp and a teapot on the counter --- */
    { const x = VPL.tansy, wd = '#c08a58', wdS = '#7a5032', lil = '#b9a6e8', lilS = '#8a78c0';
      for (const px of [x - 34, x + 30]) { P.rect(px, 104, 4, 78, wdS); P.rect(px, 104, 2, 78, wd); }
      P.rect(x - 36, 154, 72, 4, '#e0aa7a'); P.rect(x - 34, 158, 68, 24, lil); P.rect(x - 34, 158, 68, 2, lilS); P.rect(x - 34, 180, 68, 2, lilS);
      for (let i = 0; i < 5; i++) { const px = x - 26 + i * 13; P.ellipse(px, 168, 2, 2, '#fff3f8'); P.px(px - 2, 165, '#fff3f8'); P.px(px + 2, 165, '#fff3f8'); } // little paw prints
      for (let i = 0; i < 10; i++) { const sx = x - 42 + i * 8.4, c = i % 2 ? '#fff3e6' : '#f6a6bd'; P.rect(sx, 96, 9, 14, c); P.ellipse(sx + 4, 110, 4, 3, c); if (i % 2 === 0) { P.px(sx + 2, 99, '#ffffff'); P.px(sx + 6, 104, '#ffffff'); P.px(sx + 3, 108, '#ffffff'); } }
      P.rect(x - 44, 94, 88, 3, '#c86a8a'); P.dither(x - 42, 97, 84, 3, '#c86a8a', .3);
      // a board on top with a little house painted on it
      P.rect(x - 30, 78, 60, 16, wdS); P.rect(x - 28, 80, 56, 12, '#fff3dc');
      // the tiny chair
      { const cx = x - 20; P.rect(cx - 4, 146, 9, 2, '#8a5a36'); P.rect(cx - 4, 138, 2, 8, '#8a5a36'); P.rect(cx - 4, 139, 8, 1, '#a87048'); P.rect(cx - 4, 142, 8, 1, '#a87048'); P.rect(cx - 4, 148, 1, 6, '#6b4a33'); P.rect(cx + 4, 148, 1, 6, '#6b4a33'); P.rect(cx - 2, 145, 6, 1, '#e2566b'); }
      // the lamp
      { const cx = x; P.ellipse(cx, 153, 4, 1, '#6b4a33'); P.rect(cx, 136, 1, 17, '#6b4a33'); P.poly([[cx - 3, 128], [cx + 4, 128], [cx + 6, 136], [cx - 5, 136]], '#ffd86b'); P.rect(cx - 5, 136, 12, 1, '#f0a92a'); lights.push({ x: cx * 2 + 1, y: 268, r: 26, c: '#ffd070', a: .35, fl: true }); }
      // the teapot
      { const cx = x + 19; P.ellipse(cx, 149, 6, 5, '#4a84a9'); P.ellipse(cx, 148, 5, 4, '#7bb4d9'); P.ellipse(cx - 2, 146, 1.5, 1, '#d8ecff'); P.rect(cx - 2, 143, 5, 1, '#4a84a9'); P.px(cx, 142, '#4a84a9'); P.line(cx + 5, 148, cx + 8, 145, '#4a84a9'); P.rect(cx - 8, 146, 2, 4, '#4a84a9'); for (const [dx, dy] of [[-2, 150], [2, 151], [0, 148]]) P.px(cx + dx, dy, '#ffffff'); }
      // cushions and a rolled-up rug beside the stall
      for (const [cy, c] of [[184, '#f6a6bd'], [179, '#ffd86b'], [174, '#7bb4d9']]) { P.ellipse(x + 46, cy, 8, 3, shade(c, -.2)); P.ellipse(x + 46, cy - 1, 7, 2, c); }
      P.rect(x - 52, 150, 7, 36, '#e2566b'); for (let y = 152; y < 186; y += 4) P.rect(x - 52, y, 7, 1, '#ffd86b'); P.ellipse(x - 48.5, 150, 3.5, 2, '#fff3dc');
    }
    // lamp posts along the back of the lane (their glass glows a little; at dusk it would be brighter)
    for (const lx of [-95, 152, 512, 700, 842, 1018, 1196, 1392, 1585]) {
      P.rect(lx, 160, 2, 28, '#3a3040'); P.rect(lx - 1, 186, 4, 2, '#2a2030'); P.rect(lx - 3, 152, 8, 2, '#2a2030');
      P.rect(lx - 2, 154, 6, 6, '#3a3040'); P.rect(lx - 1, 155, 4, 4, '#ffe6a0'); P.px(lx + 1, 151, '#2a2030');
      lights.push({ x: lx * 2 + 2, y: 314, r: 22, c: '#ffd070', a: .35, fl: true });
    }
  });
  // crisp words on the signs (world resolution, like the shop's own sign)
  boardText(mx, 'To my shop', 250, 294, 88, 15, '#6a3a22');
  boardText(mx, 'Library', 1022 + VSHIFT.oak * 2, 244, 86, 17, '#3a2a5a');
  boardText(mx, 'Home Things', VPL.tansy * 2, 172, 104, 16, '#7a3a5a');
  // treasures on Miu's counter
  const M = painter(mx);
  for (const [id, x] of [['scarab', 1418], ['pyramid', 1458], ['owl', 1496]]) { const sp = TRSPR[id]; M.spr(sp, x + VSHIFT.market * 2 - sp.w, 304 - sp.h * 2, 2); }
  // foreground: blurred ferns and a toadstool or two, wider than the lane for parallax
  const FX = 300, [fore, fx] = vcnv(FX), F = painter(fx);
  for (let x = 2 * VX0 - FX + 40, i = 0; x < 2 * VX1 + FX; x += 230 + (i * 71) % 120, i++) {
    const leaf = i % 2 ? '#2f5a32' : '#3a6a3a', leaf2 = '#4a7f40';
    if (i % 3 === 2) { F.ellipse(x, 470, 46, 22, '#c23f55'); F.rect(x - 9, 470, 18, 20, '#fff1dc'); F.ellipse(x - 12, 462, 8, 4, '#fff3e2'); continue; }
    F.poly([[x - 70, 480], [x - 40, 452], [x, 446], [x + 30, 460], [x + 60, 480]], leaf); F.poly([[x - 30, 480], [x, 456], [x + 34, 480]], leaf2);
  }
  const foreB = blurred(fore, 7);
  shafts.push({ x: 700, y: -40, ang: .5, n: 3, len: 520, w: 46, gap: 80, c: '#fff2c8', a: .14 }, { x: 1900, y: -40, ang: .5, n: 3, len: 520, w: 40, gap: 90, c: '#fff2c8', a: .12 }, { x: 3000, y: -40, ang: .5, n: 3, len: 520, w: 40, gap: 90, c: '#fff2c8', a: .12 });
  const midT = tiltShift(mid, 150, 446, 4);
  // ducks paddle round the right-hand side of the pond: a mother and two ducklings following her
  const pondX = (1094 + VSHIFT.pond) * 2;
  const ducks = [{ cx: pondX + 108, cy: 356, rx: 46, ry: 7, s: DUCK, ph: 0 }, { cx: pondX + 108, cy: 356, rx: 46, ry: 7, s: DUCKLING, ph: -.42 }, { cx: pondX + 108, cy: 356, rx: 46, ry: 7, s: DUCKLING, ph: -.74 }];
  return { village: true, back: backB, mid: midT, fore: foreB, foreX0: 2 * VX0 - FX, counter: null, lights, shafts, ringLamps, ducks, smokes,
    mill: { x: 1400, base: 300, body: millBody(), hub: [1400, 222] }, x0: 2 * VX0, cw: VCW * 2,
    mk: () => vcnv(), motes: { c: '#fff2c0', n: 26, glow: true, area: [0, 120, 900, 300], rise: false, follow: true } };
}

/* ---------------------------------------------------------------- ROOMS inside the village houses
   TSV.scene 'room', TSV.room 'home' (her own house), 'burrow' (Mrs. Bunbury's kitchen) or 'oak' (Old Hoot's library).
   Painted like the shop floor: once, on the chunky grid, with the shopkeeper left of centre and the one who lives there
   right of centre (they are already home, so nobody walks in). The things she buys from Tansy for her house (TSV.home)
   are painted into it, each in its own spot clear of her. */
const ROOMS = { home: 1, burrow: 1, oak: 1 };
SPOT.room = { keeper: [252, 410], cust: [432, 410], enter: [432, 410] };
// the must-see part takes in the top of the clock, the painting and the canopy in her house
CAMS.room_home = { cx: 320, cy: 288, w: 620, h: 300, x0: 110, y0: 156, x1: 590, y1: 420 };
CAMS.room_burrow = { cx: 320, cy: 290, w: 620, h: 300, x0: 120, y0: 170, x1: 560, y1: 424 };
CAMS.room_oak = { cx: 320, cy: 290, w: 620, h: 300, x0: 120, y0: 170, x1: 560, y1: 424 };
TALLX.room = [50, 610];
const HOME_ORDER = ['plant', 'teaset', 'painting', 'armchair', 'lamp', 'clock', 'dollhouse', 'canopy'];
// the bed in her house (chunky): headboard against the wall, the quilt coming towards us
const BED = { x0: 234, x1: 302, wall: 154, front: 190 };
// Each home thing paints itself on the chunky grid with its bottom centre at (cx, b); box: its size, for the panel picture.
const HOME_ART = {
  plant: { box: [18, 26], paint(P, cx, b) {
    P.line(cx, b - 9, cx - 8, b - 20, '#4e8a44'); P.line(cx, b - 9, cx + 8, b - 22, '#4e8a44'); P.line(cx, b - 9, cx - 3, b - 24, '#4e8a44');
    P.ellipse(cx, b - 14, 6, 5, '#4e8a44'); P.ellipse(cx - 5, b - 17, 4, 3, '#6aa860'); P.ellipse(cx + 5, b - 18, 4, 3, '#6aa860'); P.ellipse(cx - 1, b - 21, 3, 3, '#8cc46c');
    P.ellipse(cx - 8, b - 21, 2, 2, '#7cb36a'); P.ellipse(cx + 8, b - 23, 2, 2, '#7cb36a'); P.rect(cx + 2, b - 25, 2, 2, '#f6a6bd'); P.rect(cx - 6, b - 13, 2, 2, '#f6a6bd');
    P.poly([[cx - 5, b - 8], [cx + 5, b - 8], [cx + 4, b], [cx - 4, b]], '#d0703a'); P.rect(cx + 1, b - 7, 3, 7, '#a85a2a'); P.rect(cx - 6, b - 10, 13, 3, '#e08a50'); P.rect(cx - 6, b - 8, 13, 1, '#a85a2a');
  } },
  teaset: { box: [28, 12], paint(P, cx, b) {
    P.rect(cx - 13, b - 1, 27, 1, '#c9973a'); P.rect(cx - 12, b - 2, 25, 1, '#f2c75a'); // a little tray
    P.ellipse(cx - 1, b - 6, 6, 4, '#4a84a9'); P.ellipse(cx - 1, b - 6, 5, 3, '#7bb4d9'); P.ellipse(cx - 3, b - 7, 2, 1, '#d8ecff');
    P.rect(cx - 3, b - 10, 5, 1, '#4a84a9'); P.px(cx - 1, b - 11, '#4a84a9'); P.line(cx + 4, b - 6, cx + 7, b - 9, '#4a84a9'); P.rect(cx - 8, b - 8, 2, 4, '#4a84a9');
    for (const [dx, dy] of [[-3, 5], [1, 6], [-1, 4]]) P.px(cx + dx, b - dy, '#ffffff');
    for (const ux of [cx - 11, cx + 9]) { P.rect(ux - 2, b - 5, 5, 3, '#ffffff'); P.rect(ux - 2, b - 4, 5, 1, '#f2a7b5'); P.px(ux + 3, b - 4, '#ffffff'); P.rect(ux - 3, b - 2, 7, 1, '#e8e8f0'); }
  } },
  painting: { box: [30, 22], paint(P, cx, b) {
    const x0 = cx - 14, y0 = b - 21;
    P.ctx.save(); P.ctx.beginPath(); P.ctx.rect(x0 + 2, y0 + 2, 24, 17); P.ctx.clip();
    P.vgrad(x0 + 2, y0 + 2, 24, 17, ['#8fcaf8', '#e8f6ff'], false);
    P.ellipse(cx + 7, y0 + 6, 2, 2, '#ffe066'); P.ellipse(cx - 6, y0 + 5, 4, 1, '#ffffff');
    P.ellipse(cx - 6, b - 4, 11, 6, '#8cc46c'); P.ellipse(cx + 7, b - 3, 10, 5, '#6aa860'); P.rect(x0 + 2, b - 4, 24, 2, '#6aa860');
    for (const [dx, dy, c] of [[-9, 4, '#f6a6bd'], [-4, 3, '#ffffff'], [2, 5, '#ffd86b'], [8, 3, '#f6a6bd'], [-7, 6, '#ffd86b'], [5, 4, '#ffffff']]) P.px(cx + dx, b - dy, c);
    P.ctx.restore();
    P.rect(x0, y0, 28, 2, '#e0b040'); P.rect(x0, b - 2, 28, 2, '#9a7020'); P.rect(x0, y0, 2, 21, '#c9973a'); P.rect(x0 + 26, y0, 2, 21, '#9a7020'); P.px(x0, y0, '#f2d27a');
    P.rect(cx - 1, y0 - 3, 2, 1, '#8a6a2a'); P.line(x0 + 6, y0, cx - 1, y0 - 3, '#8a6a2a'); P.line(x0 + 22, y0, cx + 1, y0 - 3, '#8a6a2a');
  } },
  armchair: { box: [34, 30], paint(P, cx, b) {
    P.ellipse(cx, b - 19, 13, 11, '#a83a5a'); P.ellipse(cx, b - 19, 12, 10, '#d0607e'); P.ellipse(cx - 3, b - 23, 6, 4, '#e27a96');
    for (const dx of [-6, 0, 6]) P.px(cx + dx, b - 20, '#a83a5a');
    P.rect(cx - 11, b - 12, 22, 6, '#e27a96'); P.rect(cx - 11, b - 12, 22, 1, '#f0a0b8');
    P.ellipse(cx + 3, b - 14, 5, 3, '#ffd86b'); P.px(cx + 3, b - 14, '#f0a92a'); // a little cushion
    for (const s of [-1, 1]) { P.ellipse(cx + s * 13, b - 11, 4, 7, '#a83a5a'); P.ellipse(cx + s * 13, b - 12, 3, 6, '#d0607e'); P.rect(cx + s * 13 - 3, b - 18, 6, 1, '#e27a96'); }
    P.rect(cx - 16, b - 6, 32, 4, '#a83a5a'); P.rect(cx - 16, b - 6, 32, 1, '#c0506e');
    for (const dx of [-14, 12]) P.rect(cx + dx, b - 2, 2, 2, '#5a3a28');
  } },
  lamp: { box: [16, 50], paint(P, cx, b) {
    P.ellipse(cx, b - 1, 5, 1.5, '#5a3a28'); P.ellipse(cx, b - 2, 4, 1, '#8a6a4a');
    P.rect(cx, b - 40, 1, 38, '#8a6a4a'); P.rect(cx + 1, b - 40, 1, 38, '#5a3a28');
    P.poly([[cx - 4, b - 48], [cx + 5, b - 48], [cx + 8, b - 39], [cx - 7, b - 39]], '#ffd86b'); P.poly([[cx + 2, b - 48], [cx + 5, b - 48], [cx + 8, b - 39], [cx + 4, b - 39]], '#f0b84a');
    P.rect(cx - 7, b - 39, 16, 1, '#e2566b'); for (let x = cx - 6; x <= cx + 7; x += 2) P.px(x, b - 38, '#e2566b');
    P.rect(cx - 3, b - 47, 7, 1, '#fff2b0');
  } },
  clock: { box: [18, 70], paint(P, cx, b) {
    P.rect(cx - 7, b - 6, 15, 6, '#6e4430'); P.rect(cx - 7, b - 6, 15, 1, '#8a5a3a');
    P.rect(cx - 6, b - 50, 13, 45, '#8a5a36'); P.rect(cx + 4, b - 50, 3, 45, '#6e4430'); P.rect(cx - 6, b - 50, 1, 45, '#a87048');
    P.rect(cx - 4, b - 46, 9, 30, '#e0b040'); P.rect(cx - 3, b - 45, 7, 28, '#2a1a14'); // the pendulum window (the pendulum swings, drawn each frame)
    P.rect(cx - 8, b - 64, 17, 15, '#8a5a36'); P.rect(cx + 5, b - 64, 4, 15, '#6e4430');
    P.poly([[cx - 9, b - 64], [cx, b - 69], [cx + 9, b - 64]], '#6e4430'); P.px(cx, b - 70, '#f2c75a'); P.rect(cx - 9, b - 64, 19, 1, '#a87048');
    P.ellipse(cx, b - 57, 5, 5, '#c9973a'); P.ellipse(cx, b - 57, 4, 4, '#fff6e0');
    for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) P.px(cx + dx, b - 57 + dy, '#5a3a28');
    P.rect(cx, b - 60, 1, 3, '#2a1a14'); P.rect(cx, b - 57, 3, 1, '#2a1a14');
  } },
  dollhouse: { box: [30, 30], paint(P, cx, b) {
    P.rect(cx - 13, b - 2, 27, 2, '#a87048');
    P.rect(cx - 11, b - 17, 22, 15, '#fff1dc'); P.rect(cx + 6, b - 17, 5, 15, '#eedcc0');
    P.poly([[cx - 14, b - 16], [cx, b - 28], [cx + 14, b - 16]], '#e2566b'); P.rect(cx - 14, b - 17, 29, 2, '#b83a50'); P.rect(cx + 5, b - 27, 3, 6, '#c9b6a0');
    for (let i = 0; i < 4; i++) P.rect(cx - 9 + i * 5, b - 21 + Math.abs(1.5 - i) * 2, 3, 1, '#f27a8a');
    P.ellipse(cx, b - 21, 1.5, 1.5, '#ffd86b');
    P.rect(cx - 2, b - 9, 5, 7, '#7bb4d9'); P.px(cx + 1, b - 6, '#f2c75a');
    for (const [wx, wy] of [[-8, 14], [5, 14], [-8, 8], [5, 8]]) { P.rect(cx + wx, b - wy, 4, 3, '#ffe6a0'); P.px(cx + wx + 1, b - wy + 1, '#c08a58'); }
    for (let i = 0; i < 5; i++) P.px(cx - 10 + i * 5, b - 3, ['#f6a6bd', '#ffd86b', '#ffffff', '#f6a6bd', '#c9b6f0'][i]);
  } },
  canopy: { box: [76, 112], paint(P, cx, b, bed) {
    // over the bed: four posts, a scalloped top and curtains tied back (bed: the bed's own box, or a little one for the picture)
    const B = bed || { x0: cx - 34, x1: cx + 34, wall: b - 36, front: b }, top = B.wall - 74;
    const pk = '#f6a6bd', pkS = '#e2889c', wh = '#fff6fa';
    for (const px of [B.x0 + 4, B.x1 - 5]) { P.rect(px, top + 4, 2, B.wall - top - 4, '#8a5a3a'); P.rect(px, top + 4, 1, B.wall - top - 4, '#b07a4a'); }
    for (const px of [B.x0 - 1, B.x1 - 1]) { P.rect(px, top + 10, 3, B.front - top - 8, '#8a5a3a'); P.rect(px, top + 10, 1, B.front - top - 8, '#b07a4a'); P.ellipse(px + 1, top + 9, 2, 2, '#f2c75a'); }
    // curtains gathered at each front post
    for (const [px, s] of [[B.x0 + 1, 1], [B.x1, -1]]) { P.poly([[px, top + 12], [px + s * 12, top + 12], [px + s * 3, top + 44], [px + s * 6, B.front - 16], [px, B.front - 14]], pk); P.poly([[px + s * 4, top + 12], [px + s * 8, top + 12], [px + s * 3, top + 40]], pkS); P.rect(px + (s < 0 ? -5 : 0), top + 43, 6, 2, '#f2c75a'); }
    P.rect(B.x0 - 3, top + 4, B.x1 - B.x0 + 7, 7, pk); P.rect(B.x0 - 3, top + 4, B.x1 - B.x0 + 7, 2, pkS);
    for (let x = B.x0 - 3; x < B.x1 + 4; x += 6) { P.ellipse(x + 3, top + 11, 3, 2, pk); P.px(x + 3, top + 12, wh); }
    P.rect(B.x0 - 4, top + 2, B.x1 - B.x0 + 9, 2, '#c86a8a'); for (let x = B.x0; x < B.x1; x += 8) P.px(x + 2, top + 7, wh);
  } },
};
// her bed (always there): headboard, pillow and a patchwork quilt
function paintBed(P, B, small) {
  const hb = small ? 22 : 34;
  P.rect(B.x0 + 4, B.wall - hb, B.x1 - B.x0 - 8, hb, '#8a5a3a'); P.ellipse((B.x0 + B.x1) / 2, B.wall - hb, (B.x1 - B.x0) / 2 - 4, 7, '#8a5a3a');
  P.rect(B.x0 + 7, B.wall - hb + 2, B.x1 - B.x0 - 14, hb - 4, '#a87048'); P.ellipse((B.x0 + B.x1) / 2, B.wall - hb + 1, (B.x1 - B.x0) / 2 - 8, 5, '#a87048');
  P.ellipse((B.x0 + B.x1) / 2, B.wall - hb - 2, 4, 3, '#e2566b');
  P.rect(B.x0 + 8, B.wall - 8, B.x1 - B.x0 - 16, 9, '#ffffff'); P.rect(B.x0 + 8, B.wall, B.x1 - B.x0 - 16, 1, '#d8d8e8');
  const q = [[B.x0 + 4, B.wall + 2], [B.x1 - 4, B.wall + 2], [B.x1, B.front], [B.x0, B.front]];
  P.poly(q, '#f6a6bd');
  const cols = ['#f6a6bd', '#ffd86b', '#bfe3ff', '#c9b6f0', '#fff3e6'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const t0 = r / 4, t1 = (r + 1) / 4, y0 = B.wall + 2 + (B.front - B.wall - 2) * t0, y1 = B.wall + 2 + (B.front - B.wall - 2) * t1;
    const xl = t => B.x0 + 4 - 4 * t, xr = t => B.x1 - 4 + 4 * t, w0 = (xr(t0) - xl(t0)) / 6, w1 = (xr(t1) - xl(t1)) / 6;
    P.poly([[xl(t0) + c * w0, y0], [xl(t0) + (c + 1) * w0, y0], [xl(t1) + (c + 1) * w1, y1], [xl(t1) + c * w1, y1]], cols[(r * 2 + c) % 5]);
  }
  P.rect(B.x0, B.front, B.x1 - B.x0, 6, '#8a5a3a'); P.rect(B.x0, B.front, B.x1 - B.x0, 1, '#b07a4a'); P.rect(B.x0 + 1, B.front + 6, 3, 3, '#6e4430'); P.rect(B.x1 - 4, B.front + 6, 3, 3, '#6e4430');
}
// a shelf of books, all different (used in the library and on her wardrobe)
function books(P, x0, x1, base, hMax, r, cols) {
  let x = x0;
  while (x < x1 - 2) {
    const w = 2 + Math.floor(r() * 3), h = hMax - Math.floor(r() * 7), c = cols[Math.floor(r() * cols.length)];
    if (x + w > x1) break;
    if (r() < .08 && x + h < x1) { P.rect(x, base - w, h, w, c); P.rect(x, base - w, h, 1, shade(c, .3)); x += h + 1; continue; } // one lying down
    P.rect(x, base - h, w, h, c); P.rect(x, base - h, 1, h, shade(c, .25)); P.rect(x + w - 1, base - h, 1, h, shade(c, -.25)); P.rect(x, base - h + 2, w, 1, shade(c, .45));
    x += w + (r() < .15 ? 1 : 0);
  }
}
// rooms are painted wider than the shop (more wall at each side), so a landscape screen with a big panel open can
// step back far enough to see the whole room, from the top of the clock down to her feet
const RL0 = -290, RLW = 900;
function chunkyRoom(paint) { const [c, x] = cnv(RLW, CHH); x.translate(-RL0, 0); paint(painter(x), x); const [o, ox] = cnv(RLW * 2, WH); ox.imageSmoothingEnabled = false; ox.drawImage(c, 0, 0, RLW * 2, WH); ox.translate(-RL0 * 2, 0); return [o, ox]; }
function paintRoom(id, home) {
  const L0 = RL0, LW = RLW;
  const lights = [], shafts = [], smokes = [], fires = [];
  let pend = null;
  const has = k => home.includes(k);
  const [mid, mx] = chunkyRoom(P => {
    if (id === 'home') {
      // ceiling beams and a warm plaster wall with a little flower paper
      P.rect(L0, 0, LW, 24, '#8a5a3a'); for (let x = L0 + 4; x < L0 + LW; x += 44) { P.rect(x, 0, 8, 24, '#6e4430'); P.rect(x, 0, 2, 24, '#a87048'); }
      P.rect(L0, 22, LW, 4, '#6e4430');
      P.rect(L0, 26, LW, 130, '#f8e2d6'); P.dither(L0, 26, LW, 130, '#f2d4c6', .18);
      for (let y = 34; y < 120; y += 12) for (let x = L0 + ((y / 12) % 2) * 8; x < L0 + LW; x += 16) { P.px(x, y, '#f0a8b8'); P.px(x - 1, y + 1, '#f6c0cc'); P.px(x + 1, y + 1, '#f6c0cc'); P.px(x, y + 2, '#a8d090'); }
      P.rect(L0, 122, LW, 34, '#e0b48a'); P.rect(L0, 122, LW, 2, '#b48a5e'); for (let x = L0; x < L0 + LW; x += 14) P.rect(x, 124, 1, 32, '#c89a70');
      // floor planks
      P.rect(L0, 156, LW, 84, '#c99a6a');
      for (let i = 0; i < 9; i++) { const y = 156 + Math.round(Math.pow(i / 8, 1.6) * 84); P.rect(L0, y, LW, 1, '#a87a4e'); }
      for (let x = -360; x <= 680; x += 30) P.line(160 + (x - 160) * .25, 156, x, 240, '#b0845a');
      P.dither(L0, 157, LW, 83, '#d8aa78', .12); P.rect(L0, 155, LW, 2, '#8a5a3a');
      // the window, with a view of the meadow and pink curtains
      { const wx = 160, wy0 = 46, wy1 = 98;
        P.rect(wx - 24, wy0 - 3, 48, wy1 - wy0 + 6, '#8a5a3a'); P.vgrad(wx - 21, wy0, 42, wy1 - wy0, ['#7fc0f5', '#d9efff'], false);
        P.ellipse(wx - 8, wy1 - 4, 18, 8, '#8cc46c'); P.ellipse(wx + 12, wy1 - 2, 16, 6, '#6aa860'); P.ellipse(wx + 10, wy0 + 8, 5, 2, '#ffffff');
        P.rect(wx - 1, wy0, 2, wy1 - wy0, '#8a5a3a'); P.rect(wx - 21, (wy0 + wy1) / 2, 42, 2, '#8a5a3a');
        P.rect(wx - 28, wy1, 56, 4, '#a87048'); P.rect(wx - 28, wy1, 56, 1, '#c89060');
        for (const s of [-1, 1]) { const cx = wx + s * 25; P.poly([[cx - 6, wy0 - 6], [cx + 6, wy0 - 6], [cx + 3 * s, wy1 - 18], [cx + 4 * s, wy1 + 2], [cx - 4 * s, wy1 + 2]], '#f6a6bd'); P.dither(cx - 6, wy0 - 6, 12, wy1 - wy0 + 8, '#e2808f', .25); P.rect(cx - 3, wy1 - 20, 6, 2, '#ffd86b'); }
        P.rect(wx - 34, wy0 - 8, 68, 3, '#8a5a3a');
        lights.push({ x: wx * 2, y: (wy0 + wy1), r: 90, c: '#e8f4ff', a: .4 });
      }
      // the wardrobe (her clothes live here)
      { const x0 = 8, x1 = 42;
        P.rect(x0 - 2, 70, x1 - x0 + 4, 4, '#6e4430'); P.rect(x0, 74, x1 - x0, 80, '#a87048'); P.rect(x1 - 4, 74, 4, 80, '#8a5a36');
        for (const dx of [2, 18]) { P.rect(x0 + dx, 78, 14, 66, '#b88452'); P.rect(x0 + dx, 78, 14, 1, '#d0a070'); P.rect(x0 + dx + 2, 82, 10, 26, '#c89462'); P.rect(x0 + dx + 2, 112, 10, 28, '#c89462'); }
        P.ellipse(x0 + 15, 112, 1, 1, '#f2c75a'); P.ellipse(x0 + 20, 112, 1, 1, '#f2c75a'); P.rect(x0, 146, x1 - x0, 8, '#8a5a36'); P.rect(x0 + 2, 154, 3, 2, '#5a3a28'); P.rect(x1 - 5, 154, 3, 2, '#5a3a28');
        P.ellipse(x0 + 17, 66, 6, 4, '#f6a6bd'); P.rect(x0 + 11, 66, 13, 4, '#f6a6bd'); P.rect(x0 + 13, 63, 2, 2, '#ffffff'); // a hatbox on top
      }
      // the fireplace
      { const fx = 80;
        P.rect(fx - 22, 26, 44, 130, '#d8cfc0'); P.dither(fx - 22, 26, 44, 130, '#c4b8a6', .22);
        for (let y = 30; y < 150; y += 8) for (let x = fx - 22 + ((y / 8) % 2) * 6; x < fx + 22; x += 12) P.rect(x, y, 10, 1, '#bcb09c');
        P.rect(fx - 26, 114, 52, 5, '#8a5a36'); P.rect(fx - 26, 114, 52, 1, '#b07a4a');
        P.ellipse(fx, 132, 13, 10, '#4a3a30'); P.rect(fx - 13, 132, 27, 24, '#4a3a30'); P.ellipse(fx, 133, 11, 8, '#2b1d16'); P.rect(fx - 11, 133, 23, 23, '#2b1d16');
        for (let i = 0; i < 3; i++) P.rect(fx - 8 + i * 5, 151, 6, 3, '#6b4a33');
        fires.push([fx, 150]);
        P.rect(fx - 18, 154, 36, 3, '#a89888');
        // a candle and a little jar on the mantel
        P.rect(fx + 14, 106, 3, 8, '#fff3d6'); P.px(fx + 15, 104, '#ffd56b'); P.px(fx + 15, 105, '#ff9a3a'); lights.push({ x: (fx + 15) * 2, y: 210, r: 18, c: '#ffd070', a: .6, fl: true });
        P.rect(fx - 18, 108, 5, 6, '#bfe3ff'); P.rect(fx - 18, 107, 5, 1, '#e0b040');
      }
      paintBed(P, BED);
      { // a shelf of books and a peg rail with her hat and bag (left), a chest of drawers with a round mirror (right)
        P.rect(-118, 80, 70, 4, '#a87048'); P.rect(-118, 84, 70, 1, '#6e4430'); books(P, -114, -52, 79, 14, rng(4), ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#c9b6f0']);
        P.rect(-118, 104, 70, 3, '#8a5a3a'); for (let i = 0; i < 4; i++) P.rect(-108 + i * 18, 107, 2, 4, '#5a3a28');
        P.ellipse(-107, 115, 6, 3, '#e2566b'); P.rect(-111, 111, 8, 4, '#e2566b'); P.rect(-91, 111, 1, 12, '#8a5a3a'); P.rect(-94, 120, 8, 8, '#7bb4d9'); P.rect(-94, 120, 8, 1, '#4a84a9');
        P.rect(326, 112, 50, 44, '#a87048'); P.rect(326, 112, 50, 3, '#c89060'); for (let i = 0; i < 3; i++) { P.rect(330, 118 + i * 12, 42, 10, '#c89462'); P.ellipse(351, 123 + i * 12, 1, 1, '#f2c75a'); }
        P.ellipse(351, 92, 14, 16, '#c9973a'); P.ellipse(351, 92, 12, 14, '#cfe6f4'); P.ellipse(347, 86, 4, 5, '#ffffff'); P.rect(340, 106, 22, 6, '#c9973a');
        P.rect(332, 104, 5, 8, '#f6a6bd'); P.ellipse(368, 108, 4, 4, '#ffd86b');
        // further out (wide screens): a little round window and a toy box on the left, a window seat on the right
        for (const wx of [-215, 480]) { P.ellipse(wx, 70, 17, 17, '#8a5a3a'); P.ellipse(wx, 70, 14, 14, '#bfe3ff'); P.ellipse(wx, 78, 14, 6, '#8cc46c'); P.rect(wx - 1, 56, 2, 28, '#8a5a3a'); P.rect(wx - 14, 69, 28, 2, '#8a5a3a'); }
        P.rect(-236, 136, 40, 20, '#7bb4d9'); P.rect(-236, 136, 40, 3, '#4a84a9'); P.ellipse(-216, 146, 5, 4, '#ffd86b'); P.ellipse(-228, 132, 5, 4, '#f6a6bd'); P.rect(-206, 128, 6, 8, '#e2566b');
        P.rect(452, 128, 56, 8, '#f6a6bd'); P.rect(452, 136, 56, 20, '#a87048'); P.rect(452, 136, 56, 2, '#c89060'); P.ellipse(466, 126, 7, 3, '#ffd86b'); P.ellipse(492, 126, 7, 3, '#bfe3ff');
      }
      // her round table with a lace cloth
      { const tx = 168;
        P.rect(tx - 1, 168, 3, 20, '#6e4430'); P.rect(tx - 9, 187, 19, 2, '#6e4430');
        P.ellipse(tx, 166, 21, 6, '#e8dcd0'); P.ellipse(tx, 165, 20, 5, '#ffffff'); for (let x = tx - 19; x < tx + 20; x += 3) P.px(x, 170 + Math.round(Math.sin((x - tx) / 21 * Math.PI / 2 + Math.PI / 2) * 0), '#e8dcd0');
        P.poly([[tx - 21, 166], [tx + 21, 166], [tx + 18, 174], [tx - 18, 174]], '#ffffff'); for (let x = tx - 18; x < tx + 18; x += 4) P.ellipse(x + 2, 174, 2, 1, '#ffffff');
        if (!has('teaset')) { P.rect(tx - 2, 158, 5, 5, '#c9e8ff'); P.rect(tx - 1, 152, 1, 6, '#5f9a4a'); P.rect(tx - 2, 150, 3, 3, '#ffd86b'); } // a little bud vase until she has a tea set
      }
      // the rug she stands on
      [['#e2566b', 52, 13], ['#ffd86b', 44, 11], ['#bfe3ff', 36, 8], ['#f6a6bd', 26, 6]].forEach(([c, rx, ry]) => P.ellipse(128, 204, rx, ry, c));
      // her home things
      const put = (k, cx, b) => { if (has(k)) HOME_ART[k].paint(P, cx, b); };
      put('painting', 80, 104);
      if (has('clock')) { HOME_ART.clock.paint(P, 116, 156); pend = { x: 233, y: 222, len: 44, clip: [226, 222, 14, 56] }; }
      put('plant', 214, 158);
      if (has('canopy')) HOME_ART.canopy.paint(P, 0, 0, BED);
      put('teaset', 168, 165);
      put('armchair', 54, 198);
      if (has('lamp')) { HOME_ART.lamp.paint(P, 88, 194); lights.push({ x: 177, y: 300, r: 46, c: '#ffd070', a: .4, fl: true }, { x: 177, y: 384, r: 50, c: '#ffe0a0', a: .22 }); }
      put('dollhouse', 208, 206);
    } else if (id === 'burrow') {
      // an earthy round room: a low curved ceiling, packed-earth walls with pebbles and roots, an earth floor
      P.rect(L0, 0, LW, 40, '#5a3e2a');
      for (let x = L0; x < L0 + LW; x++) { const d = (x - 160) / 200, y0 = Math.round(18 + d * d * 26); P.rect(x, y0, 1, 158 - y0, '#e4b886'); P.rect(x, y0, 1, 2, '#8a6a4a'); }
      P.noise(L0, 20, LW, 136, ['#d0a070', '#f0c898', '#c49464', '#f4d0a0'], .08, 31);
      const rr = rng(8); for (let i = 0; i < 40; i++) { const x = L0 + rr() * LW, y = 40 + rr() * 100; P.ellipse(x, y, 2 + rr() * 2, 1 + rr(), '#b0a090'); P.px(x - 1, y - 1, '#d0c4b0'); }
      for (let i = 0; i < 8; i++) { let x = L0 + 20 + i * 54, y = 24; for (let k = 0; k < 14; k++) { P.px(x, y, '#7a5434'); x += (rr() - .5) * 2; y += 1; } }
      P.rect(L0, 156, LW, 84, '#c4945e'); P.noise(L0, 156, LW, 84, ['#ae8050', '#d0a070', '#d8aa78'], .14, 33); P.rect(L0, 155, LW, 2, '#8a6440');
      // a round window with grass and flowers outside
      { const wx = 160, wy = 66; P.ellipse(wx, wy, 20, 18, '#7a5032'); P.ellipse(wx, wy, 16, 14, '#bfe6ff'); P.ellipse(wx, wy + 10, 16, 6, '#8cc46c'); P.ellipse(wx, wy - 4, 14, 2, '#e8f6ff');
        for (const [dx, c] of [[-8, '#ffd86b'], [-2, '#f6a6bd'], [5, '#ffffff'], [10, '#f6a6bd']]) { P.rect(wx + dx, wy + 3, 1, 4, '#5f9a4a'); P.rect(wx + dx - 1, wy + 2, 3, 2, c); }
        P.rect(wx - 1, wy - 14, 2, 28, '#7a5032'); P.rect(wx - 16, wy - 1, 32, 2, '#7a5032'); P.rect(wx - 22, wy + 16, 44, 3, '#a87048');
        lights.push({ x: wx * 2, y: wy * 2, r: 70, c: '#e8ffe0', a: .4 }); }
      // the fireplace with a kettle on the hook
      { const fx = 58;
        dome(P, fx, 156, 34, 52, '#b0a090'); dome(P, fx, 156, 31, 49, '#cfc6b4');
        for (let i = 0; i < 9; i++) { const a = Math.PI * i / 8; P.ellipse(fx - Math.cos(a) * 24, 152 - Math.sin(a) * 38, 4, 3, i % 2 ? '#bfb5a2' : '#e0d8c8'); }
        dome(P, fx, 156, 19, 32, '#2b1d16');
        P.rect(fx - 36, 104, 72, 5, '#8a5a36'); P.rect(fx - 36, 104, 72, 1, '#b07a4a');
        for (let i = 0; i < 3; i++) P.rect(fx - 9 + i * 6, 151, 7, 3, '#6b4a33');
        fires.push([fx, 150]);
        P.rect(fx, 120, 1, 14, '#3a3030'); // the hook
        P.ellipse(fx, 140, 8, 6, '#3a3a44'); P.ellipse(fx - 2, 138, 3, 2, '#6a6a7a'); P.rect(fx - 3, 133, 7, 2, '#2a2a30'); P.line(fx + 7, 139, fx + 12, 134, '#3a3a44'); P.line(fx - 6, 134, fx, 130, '#2a2a30'); P.line(fx + 6, 134, fx, 130, '#2a2a30');
        smokes.push([(fx + 12) * 2, 266, .5]);
        // jars and a plate on the mantel
        P.rect(fx - 30, 96, 6, 8, '#e8b84a'); P.rect(fx - 30, 95, 6, 2, '#e2566b'); P.rect(fx + 22, 97, 5, 7, '#8cc46c'); P.rect(fx + 22, 96, 5, 1, '#fff3dc'); P.ellipse(fx, 98, 6, 6, '#7bb4d9'); P.ellipse(fx, 98, 4, 4, '#fff6ee');
      }
      // the dresser with plates and cups
      { const x0 = 230, x1 = 296;
        P.rect(x0 - 2, 70, x1 - x0 + 4, 4, '#6e4430'); P.rect(x0, 74, x1 - x0, 82, '#a87048'); P.rect(x0 + 3, 76, x1 - x0 - 6, 40, '#7a5032');
        for (const sy of [94, 114]) { P.rect(x0 + 2, sy, x1 - x0 - 4, 2, '#c89060'); }
        const pc = ['#7bb4d9', '#f6a6bd', '#ffd86b', '#8cc46c'];
        for (let i = 0; i < 5; i++) { const px = x0 + 10 + i * 12; P.ellipse(px, 86, 5, 6, '#ffffff'); P.ellipse(px, 86, 3, 4, pc[i % 4]); P.ellipse(px, 86, 1, 2, '#ffffff'); }
        for (let i = 0; i < 6; i++) { const px = x0 + 8 + i * 10; P.rect(px, 108, 5, 5, i % 2 ? '#ffffff' : '#fff0d8'); P.rect(px, 109, 5, 1, pc[i % 4]); P.px(px + 5, 110, '#ffffff'); P.rect(px + 1, 103, 1, 5, '#8a6a4a'); }
        P.rect(x0, 118, x1 - x0, 38, '#b88452'); P.rect(x0, 118, x1 - x0, 2, '#d0a070');
        for (const dx of [4, 34]) { P.rect(x0 + dx, 124, 28, 28, '#a87048'); P.rect(x0 + dx + 2, 126, 24, 24, '#c89462'); P.ellipse(x0 + dx + (dx < 10 ? 24 : 4), 138, 1, 1, '#f2c75a'); }
        P.rect(x0 + 2, 156, 4, 2, '#5a3a28'); P.rect(x1 - 6, 156, 4, 2, '#5a3a28');
      }
      for (const [sx, c] of [[-70, '#f4ead8'], [-52, '#e8dcc0']]) { P.ellipse(sx, 150, 9, 8, shade(c, -.12)); P.ellipse(sx, 148, 8, 7, c); P.rect(sx - 3, 139, 6, 3, '#c8b890'); P.rect(sx - 4, 146, 8, 3, '#e2a24a'); }
      P.rect(320, 84, 60, 3, '#a87048'); P.rect(320, 114, 60, 3, '#a87048');
      // further out: a little round pantry door, and a woodpile with a broom
      P.ellipse(-200, 128, 17, 17, '#7a5032'); P.rect(-217, 128, 35, 28, '#7a5032'); P.ellipse(-200, 128, 14, 14, '#5f9a4a'); P.rect(-214, 128, 29, 28, '#5f9a4a'); P.ellipse(-192, 138, 1.5, 1.5, '#f2c75a'); for (const dx of [-7, 0, 7]) P.rect(-200 + dx, 116, 1, 40, '#4e8a3e');
      for (let i = 0; i < 4; i++) for (let k = 0; k < 5 - i; k++) { const lx = 470 + k * 9 + i * 4, ly = 150 - i * 7; P.ellipse(lx, ly, 4, 3, '#8a5a3a'); P.ellipse(lx, ly, 2, 2, '#d8b080'); }
      P.line(530, 100, 538, 154, '#a87048'); P.poly([[533, 140], [544, 140], [548, 156], [530, 156]], '#e0c070');
      for (let i = 0; i < 6; i++) { const jx = 324 + i * 9, c = ['#e2566b', '#f0a92a', '#8cc46c', '#c9b6f0'][i % 4]; P.rect(jx, 74, 7, 10, '#e8f4f8'); P.rect(jx + 1, 77, 5, 6, c); P.rect(jx, 73, 7, 2, '#c8a060'); P.rect(jx + 1, 104, 6, 10, '#e8f4f8'); P.rect(jx + 2, 107, 4, 6, ['#f0a92a', '#e2566b'][i % 2]); }
      // the rug, the table between them with a carrot cake and teacups
      [['#c86a3a', 70, 14], ['#f0a050', 60, 11], ['#fff0d8', 48, 8], ['#8cc46c', 36, 6]].forEach(([c, rx, ry]) => P.ellipse(170, 206, rx, ry, c));
      { const tx = 168;
        P.rect(tx - 22, 170, 3, 20, '#6e4430'); P.rect(tx + 20, 170, 3, 20, '#6e4430'); P.rect(tx - 14, 168, 2, 18, '#5a3a24'); P.rect(tx + 13, 168, 2, 18, '#5a3a24');
        P.rect(tx - 25, 162, 51, 6, '#a87048'); P.rect(tx - 25, 162, 51, 1, '#c89060');
        for (let x = tx - 24; x < tx + 26; x++) for (let y = 162; y < 176; y++) { if (y > 167 && (x + 1) % 4 === 0 && y > 172) continue; const g = ((x >> 1) + (y >> 1)) % 2; P.px(x, y, y < 167 ? (g ? '#ffffff' : '#f6a6bd') : (g ? '#f0f0f0' : '#e88aa0')); }
        // carrot cake on a stand
        P.rect(tx - 6, 160, 13, 1, '#d8d8e4'); P.rect(tx - 1, 158, 3, 2, '#d8d8e4');
        P.rect(tx - 7, 151, 15, 7, '#d8883a'); P.rect(tx - 7, 154, 15, 1, '#fff6e6'); P.rect(tx - 7, 150, 15, 2, '#fff6e6'); P.rect(tx - 7, 151, 1, 3, '#fff6e6'); P.rect(tx + 4, 152, 2, 1, '#fff6e6');
        P.rect(tx - 1, 147, 3, 3, '#f08a3a'); P.px(tx, 146, '#5f9a4a'); P.px(tx - 1, 145, '#7cb36a'); P.px(tx + 1, 145, '#7cb36a');
        for (const ux of [tx - 17, tx + 16]) { P.rect(ux - 2, 157, 6, 4, '#ffffff'); P.rect(ux - 2, 158, 6, 1, '#7bb4d9'); P.px(ux + 4, 158, '#ffffff'); P.rect(ux - 3, 161, 8, 1, '#e8e8f0'); P.px(ux, 156, '#c08a58'); }
      }
      // baskets of carrots
      for (const [bx, by] of [[24, 210], [300, 210], [100, 160]]) {
        for (let k = 0; k < 6; k++) { const cx = bx - 8 + k * 3; P.rect(cx, by - 14 - (k % 2) * 2, 2, 6, '#f08a3a'); P.px(cx, by - 15 - (k % 2) * 2, '#7cb36a'); P.px(cx + 1, by - 17 - (k % 2) * 2, '#5f9a4a'); P.px(cx - 1, by - 16 - (k % 2) * 2, '#7cb36a'); }
        P.poly([[bx - 11, by - 9], [bx + 11, by - 9], [bx + 9, by], [bx - 9, by]], '#c8944a'); for (let x = bx - 10; x < bx + 10; x += 3) P.rect(x, by - 9, 1, 9, '#a87436'); P.rect(bx - 11, by - 10, 23, 2, '#e0b070'); P.rect(bx - 9, by - 5, 19, 1, '#a87436');
      }
      // the beam across the ceiling with carrots and herbs hanging from it
      P.rect(L0, 30, LW, 7, '#7a5032'); P.rect(L0, 30, LW, 2, '#a87048'); P.rect(L0, 36, LW, 1, '#5a3a24');
      [[-260, 1], [-210, 0], [-150, 0], [-100, 1], [-40, 0], [22, 1], [96, 0], [124, 1], [210, 0], [240, 1], [270, 0], [306, 1], [350, 0], [410, 1], [460, 0], [520, 1], [575, 0]].forEach(([hx, herb]) => {
        P.rect(hx, 37, 1, 5, '#e0c890');
        if (herb) { for (let k = 0; k < 9; k++) { const ex = hx - 6 + k * 1.5, ey = 58 + (k % 3) * 2; P.line(hx, 44, ex, ey, k % 2 ? '#7cb36a' : '#4e8a44'); P.rect(ex - 1, ey - 1, 2, 2, k % 2 ? '#8cc46c' : '#5f9a4a'); } P.rect(hx - 2, 42, 5, 3, '#e0c890'); }
        else for (let k = 0; k < 4; k++) { const cx = hx - 6 + k * 4, len = 13 + (k % 2) * 3; P.rect(cx - 1, 42, 4, 3, '#6aa860'); P.px(cx, 41, '#8cc46c'); P.poly([[cx - 1, 45], [cx + 3, 45], [cx + 1, 45 + len]], '#d8702a'); P.poly([[cx - 1, 45], [cx + 2, 45], [cx + .5, 44 + len]], '#ff9a42'); P.px(cx, 48, '#ffc080'); }
      });
      lights.push({ x: 330, y: 300, r: 150, c: '#ffc070', a: .35, fl: true });
    } else {
      // Old Hoot's library inside the oak: bookcases all the way round, a ladder, a reading desk and his perch
      P.rect(L0, 0, LW, 30, '#4a3020');
      for (let x = L0; x < L0 + LW; x++) { const d = (x - 160) / 210, y0 = Math.round(14 + d * d * 20); P.rect(x, y0, 1, 156 - y0, '#8a5a34'); P.rect(x, y0, 1, 2, '#5a3a22'); }
      for (let i = 1; i < 6; i++) { const ry = 6 + i * 4; for (let a = 0; a < 64; a++) { const t = a / 63 * Math.PI; P.px(160 + Math.cos(t) * (i * 60), ry - Math.sin(t) * 6, '#5a3a22'); } }
      const cols = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8', '#f08a3a', '#5a8fc7', '#c84a6a', '#4e8a44', '#e8c46a'];
      const r = rng(19);
      const cases = [[-290, -178], [-174, -64], [-60, 66], [70, 136], [184, 250], [262, 380], [384, 496], [500, 610]];
      for (const [a, b] of cases) {
        P.rect(a, 28, b - a, 128, '#6e4430'); P.rect(a + 3, 31, b - a - 6, 122, '#3e2818');
        for (const sy of [54, 80, 106, 132, 154]) { books(P, a + 4, b - 4, sy - 1, 20, r, cols); P.rect(a + 2, sy - 1, b - a - 4, 3, '#a87048'); P.rect(a + 2, sy - 1, b - a - 4, 1, '#c89060'); }
        P.rect(a, 28, 3, 128, '#8a5a36'); P.rect(b - 3, 28, 3, 128, '#5a3a24'); P.rect(a - 2, 26, b - a + 4, 3, '#8a5a36');
      }
      // the round window up high between the cases, and his reading lamp
      { const wx = 160, wy = 52; P.rect(136, 28, 48, 128, '#7a4a2a'); P.dither(136, 28, 48, 128, '#6a4024', .25);
        P.ellipse(wx, wy, 16, 16, '#4a3020'); P.ellipse(wx, wy, 13, 13, '#9fd0f0'); P.ellipse(wx, wy + 8, 13, 5, '#5f9a4a'); P.ellipse(wx + 4, wy - 5, 4, 2, '#ffffff'); P.rect(wx - 1, wy - 13, 2, 26, '#4a3020'); P.rect(wx - 13, wy - 1, 26, 2, '#4a3020');
        lights.push({ x: wx * 2, y: wy * 2, r: 60, c: '#e8f4ff', a: .4 });
        // a little map and a picture of the moon on the trunk wall
        P.rect(144, 84, 32, 22, '#c9a86a'); P.rect(145, 85, 30, 20, '#f4e4bc'); P.line(148, 90, 160, 98, '#8a5a3a'); P.rect(164, 88, 6, 4, '#7cb36a'); P.px(168, 100, '#e2566b'); P.px(169, 101, '#e2566b'); P.px(170, 100, '#e2566b');
        P.ellipse(160, 126, 8, 8, '#2e2a5a'); P.ellipse(160, 126, 6, 6, '#fff4c8'); P.ellipse(162, 124, 5, 5, '#2e2a5a');
      }
      // the floor: wide boards and a deep red rug
      P.rect(L0, 156, LW, 84, '#9a6a3e');
      for (let i = 0; i < 9; i++) { const y = 156 + Math.round(Math.pow(i / 8, 1.6) * 84); P.rect(L0, y, LW, 1, '#7a5030'); }
      P.dither(L0, 157, LW, 83, '#ae7a48', .14); P.rect(L0, 155, LW, 2, '#5a3a24');
      [['#8a2a3a', 96, 16], ['#b83a4a', 88, 13], ['#e2a24a', 82, 11], ['#b83a4a', 76, 10]].forEach(([c, rx, ry]) => P.ellipse(172, 206, rx, ry, c));
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; P.px(172 + Math.cos(a) * 60, 206 + Math.sin(a) * 7, '#ffd86b'); }
      // the ladder leaning on a bookcase
      for (let y = 44; y < 160; y++) { const t = (y - 44) / 116, x = 92 + t * 10; P.px(x, y, '#c08a58'); P.px(x + 1, y, '#8a5a36'); P.px(x + 14, y, '#c08a58'); P.px(x + 15, y, '#8a5a36'); }
      for (let y = 50; y < 158; y += 10) { const x = 92 + (y - 44) / 116 * 10; P.rect(x + 1, y, 14, 2, '#a87048'); }
      // the reading desk: a candle, an open book and a globe
      { const dx = 46;
        P.rect(dx - 26, 170, 52, 5, '#8a5a36'); P.rect(dx - 26, 170, 52, 1, '#b07a4a'); P.rect(dx - 24, 175, 48, 10, '#6e4430'); P.rect(dx - 22, 177, 20, 6, '#8a5a36'); P.ellipse(dx - 12, 180, 1, 1, '#f2c75a');
        for (const lx of [dx - 24, dx + 21]) P.rect(lx, 185, 3, 14, '#5a3a24');
        P.rect(dx - 21, 160, 4, 10, '#fff3d6'); P.rect(dx - 23, 169, 8, 1, '#c9973a'); P.px(dx - 19, 158, '#ffd56b'); P.px(dx - 19, 159, '#ff9a3a'); P.px(dx - 20, 157, '#fff6c0');
        lights.push({ x: (dx - 19) * 2, y: 316, r: 56, c: '#ffc860', a: .8, fl: true });
        P.poly([[dx - 10, 166], [dx, 168], [dx + 10, 166], [dx + 10, 170], [dx - 10, 170]], '#fff6e6'); P.rect(dx, 166, 1, 4, '#c8b8a0'); for (const ly of [167, 168]) { P.rect(dx - 8, ly, 6, 1, '#a89a8a'); P.rect(dx + 2, ly, 6, 1, '#a89a8a'); } P.rect(dx - 10, 170, 21, 1, '#8a2a3a');
        P.rect(dx + 17, 168, 6, 2, '#c9973a'); P.rect(dx + 19, 162, 1, 6, '#c9973a'); P.ellipse(dx + 20, 158, 6, 6, '#c9973a'); P.ellipse(dx + 20, 158, 5, 5, '#5a8fc7'); P.ellipse(dx + 18, 156, 2, 2, '#8cc46c'); P.ellipse(dx + 22, 160, 2, 1, '#8cc46c'); P.px(dx + 18, 155, '#bfe3ff');
      }
      // his green armchair and his perch
      { const ax = 268; P.ellipse(ax, 160, 13, 11, '#2e6a4a'); P.ellipse(ax, 160, 12, 10, '#4e8a5a'); P.rect(ax - 11, 166, 22, 6, '#5e9a6a'); for (const s of [-1, 1]) { P.ellipse(ax + s * 13, 168, 4, 7, '#2e6a4a'); P.ellipse(ax + s * 13, 167, 3, 6, '#4e8a5a'); } P.rect(ax - 16, 172, 32, 5, '#2e6a4a'); P.rect(ax - 14, 177, 2, 3, '#5a3a28'); P.rect(ax + 12, 177, 2, 3, '#5a3a28'); P.rect(ax - 6, 162, 12, 4, '#e8c46a'); }
      { const px = 298; P.rect(px - 1, 136, 3, 66, '#6b4a33'); P.rect(px - 1, 136, 1, 66, '#9a6a45'); P.rect(px - 12, 134, 25, 3, '#8a5a36'); P.rect(px - 12, 134, 25, 1, '#b07a4a'); P.ellipse(px, 202, 9, 2, '#5a3a24'); P.rect(px - 7, 199, 15, 3, '#6b4a33');
        P.ellipse(px + 10, 131, 2, 1, '#8cc46c'); P.ellipse(px - 9, 131, 2, 1, '#7cb36a'); P.px(px + 4, 133, '#fff6e6'); P.px(px + 5, 132, '#fff6e6'); }
      // book stacks on the floor
      for (const [bx, by, n] of [[160, 196, 5], [22, 214, 6], [242, 200, 3]]) for (let i = 0; i < n; i++) { const c = cols[(i * 3 + bx) % cols.length], w = 14 - (i % 3) * 2; P.rect(bx - w / 2 + (i % 2), by - 3 - i * 3, w, 3, c); P.rect(bx - w / 2 + (i % 2), by - 3 - i * 3, w, 1, shade(c, .3)); P.rect(bx - w / 2 + (i % 2) + w - 2, by - 2 - i * 3, 2, 1, '#fff6e6'); }
      // a hanging lantern
      P.rect(160, 0, 1, 14, '#3a2a20'); P.rect(155, 14, 11, 12, '#4a3020'); P.rect(157, 16, 7, 8, '#ffe6a0'); P.rect(154, 12, 13, 2, '#2a1e18');
      lights.push({ x: 321, y: 40, r: 70, c: '#ffc860', a: .7, fl: true });
    }
  });
  // the fire: a little flame painted at world resolution, flickering glow on top
  const M = painter(mx);
  for (const [fx, fy] of fires) {
    const X = fx * 2, Y = fy * 2;
    M.ellipse(X, Y - 6, 12, 8, '#ff8a3a'); M.ellipse(X - 5, Y - 10, 6, 9, '#ff9a3a'); M.ellipse(X + 5, Y - 9, 5, 8, '#ffb04a'); M.ellipse(X, Y - 10, 5, 8, '#ffd06a'); M.ellipse(X, Y - 6, 3, 4, '#fff0b0');
    lights.push({ x: X, y: Y - 10, r: 56, c: '#ff9a40', a: .7, fl: true }, { x: X, y: Y + 30, r: 100, c: '#ffae5a', a: .25, fl: true });
  }
  const midT = tiltShift(mid, 70, 456, 4);
  const [fore, fx] = cnv(RLW * 2, WH), F = painter(fx); fx.translate(-RL0 * 2, 0);
  const dk = id === 'oak' ? '#3a2416' : id === 'burrow' ? '#4a3220' : '#6e4a30';
  // blurry things right in front, only at the far sides of the room (seen on wide screens)
  const fl = RL0 * 2, fr = (RL0 + RLW) * 2;
  F.poly([[fl, 420], [fl + 70, 404], [fl + 130, 480], [fl, 480]], dk); F.ellipse(fl + 40, 474, 70, 26, shade(dk, .15));
  F.poly([[fr, 420], [fr - 60, 406], [fr - 120, 480], [fr, 480]], dk);
  if (id === 'burrow') { F.ellipse(fr - 50, 470, 30, 18, '#c8944a'); for (let k = 0; k < 4; k++) F.rect(fr - 66 + k * 9, 440, 5, 22, '#f08a3a'); }
  if (id === 'home') { F.ellipse(fr - 40, 462, 26, 20, '#5f9a4a'); F.ellipse(fr - 50, 450, 14, 12, '#8cc46c'); }
  if (id === 'oak') { for (let i = 0; i < 5; i++) F.rect(fr - 80 + (i % 2) * 4, 466 - i * 10, 50, 10, cols5[i % 5]); }
  shafts.push({ x: 380, y: 60, ang: .62, n: 3, len: 420, w: 40, gap: 34, c: '#fff6d8', a: id === 'home' ? .2 : .12 });
  const edge = id === 'oak' ? ['#4a3020', '#7a5030'] : id === 'burrow' ? ['#5a3e2a', '#946a40'] : ['#8a5a3a', '#a87a4e'];
  return { back: null, mid: midT, fore: blurred(fore, 7), counter: null, lights, shafts, smokes, pend, edge, room: id, x0: RL0 * 2, cw: RLW * 2, foreX0: RL0 * 2, mk: () => { const [c, x] = cnv(RLW * 2, WH); x.translate(-RL0 * 2, 0); return [c, x]; },
    motes: { c: '#fff4d0', n: 18, glow: false, area: [120, 100, 400, 280], rise: false } };
}
const cols5 = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8'];
// the pendulum of her tall clock, and smoke and steam puffs (chimneys, the kettle)
function drawPendulum(p, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(p.clip[0], p.clip[1], p.clip[2], p.clip[3]); ctx.clip();
  const a = RM ? 0 : Math.sin(t / 1000 * 2.6) * .16, ex = p.x + Math.sin(a) * p.len, ey = p.y + Math.cos(a) * p.len;
  ctx.strokeStyle = '#c9973a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.fillStyle = '#9a7020'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c75a'; ctx.beginPath(); ctx.arc(ex - 1, ey - 1, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawSmoke(list, t) {
  ctx.save();
  for (let j = 0; j < list.length; j++) {
    const [sx, sy, k0] = list[j], sc = k0 || 1;
    for (let i = 0; i < 4; i++) {
      const k = RM ? .15 + i * .2 : ((t / 1000) * .2 + i / 4 + j * .37) % 1;
      const x = sx + Math.sin(k * 5 + j) * 8 * k * sc, y = sy - k * 74 * sc, r = (3 + k * 10) * sc;
      ctx.globalAlpha = Math.min(1, k * 8) * Math.min(1, (1 - k) * 1.6) * .6;
      ctx.fillStyle = '#f4f2ee'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - r * .25, y - r * .25, r * .6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
function drawMill(m, t) {
  ctx.drawImage(m.body, m.x - m.body.width / 2, m.base - m.body.height);
  ctx.save(); ctx.translate(m.hub[0], m.hub[1]); ctx.rotate(RM ? .4 : t / 1000 * .7);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#8a7a6c'; ctx.fillRect(-2, 0, 4, 54);
    ctx.fillStyle = '#efe8dc'; ctx.fillRect(3, 12, 13, 40);
    ctx.fillStyle = '#cdbfae'; for (let y = 18; y < 52; y += 8) ctx.fillRect(3, y, 13, 1); ctx.fillRect(9, 12, 1, 40);
  }
  ctx.fillStyle = '#6a5a4c'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// the price the shop charges (the game's own priceOf, read by its global name); null when the game is not there
function priceFor(g) { try { return typeof priceOf === 'function' ? priceOf(g) : null; } catch (e) { return null; } } // eslint-disable-line no-undef

/* ---------------------------------------------------------------- glow + shaft stamps */
const GLOW = new Map();
function glowStamp(c) {
  let s = GLOW.get(c); if (s) return s;
  const [k, x] = cnv(64, 64), [r, g, b] = hex2rgb(c), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.25, `rgba(${r},${g},${b},.55)`); gr.addColorStop(.6, `rgba(${r},${g},${b},.16)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); GLOW.set(c, k); return k;
}
function shaftStamp(s, mk) {
  const [k, x] = (mk || wcnv)(); x.imageSmoothingEnabled = true;
  for (let i = 0; i < s.n; i++) {
    const w = s.w * (.6 + .8 * ((i * 37) % 10) / 10), ox = s.x - i * s.gap, al = s.a * (.6 + .4 * ((i * 53) % 7) / 7);
    x.save(); x.translate(ox, s.y); x.rotate(s.ang);
    const g = x.createLinearGradient(0, 0, 0, s.len); const [r, gg, b] = hex2rgb(s.c);
    g.addColorStop(0, `rgba(${r},${gg},${b},${al})`); g.addColorStop(.5, `rgba(${r},${gg},${b},${al * .45})`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    x.fillStyle = g; x.beginPath(); x.moveTo(-w * .3, 0); x.lineTo(w * .3, 0); x.lineTo(w * .6, s.len); x.lineTo(-w * .6, s.len); x.closePath(); x.fill(); x.restore();
  }
  return blurred(k, 6);
}

/* ---------------------------------------------------------------- the stage */
const cv = document.createElement('canvas'); cv.id = 'gl3d'; cv.setAttribute('aria-hidden', 'true');
const ctx = cv.getContext('2d', { alpha: false });
if (!ctx) throw new Error('no 2d canvas');
let W = 0, H = 0, DPR = 1, vign = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px'; vign = null;
}
addEventListener('resize', resize);

let scene = null, sceneKey = '', fade = 0;
const kindOf = v => v.scene === 'inside' ? 'in' : v.scene === 'village' ? 'vil' : v.scene === 'room' ? 'room' : 'out';
function want() {
  const v = window.TSV, kind = kindOf(v), inside = kind === 'in';
  const ph = window.__ts && window.__ts.S ? window.__ts.S.phase : '';
  const time = inside ? 'day' : kind === 'vil' ? 'morning' : v.time === 'evening' ? (ph === 'night' ? 'night' : 'evening') : 'morning';
  if (kind === 'vil') return { inside, kind, time, key: 'vil|' + fontKey };
  if (kind === 'room') { const room = ROOMS[v.room] ? v.room : 'home'; return { inside, kind, time: 'day', room, key: ['room', room, room === 'home' ? HOME_ORDER.filter(k => (v.home || []).includes(k)).join('+') : '', fontKey].join('|') }; }
  const stock = inside ? Object.keys(SLOT).map(g => Math.min(10, (v.stock && v.stock[g]) | 0) + ':' + ((v.stock && v.stock[g]) > 0 ? priceFor(g) : '')).join(',') : '';
  const owned = (inside ? v.treasures : v.garden) || [];
  return { inside, kind, time, key: [kind, time, (v.decor || []).join('+'), inside ? stock : (v.cart ? 'cart' : ''), (v.decor || []).includes('sign') ? v.signText : '', owned.join('+'), fontKey].join('|') };
}
// the signs are written with the page's fonts: paint again once they have loaded
let fontKey = 0;
try { Promise.all(['700 16px Andika', '700 16px Cinzel'].map(f => document.fonts.load(f))).then(() => { fontKey = 1; }, () => {}); } catch (e) { fontKey = 1; }
function build(w) {
  const v = window.TSV, t0 = performance.now();
  const s = w.kind === 'vil' ? paintVillage() : w.kind === 'room' ? paintRoom(w.room, Array.isArray(v.home) ? v.home : []) : w.inside ? paintInside(v.decor || [], v.stock || {}, v.treasures || []) : paintOutside(w.time, v.decor || [], !!v.cart, v.signText || '', v.garden || []);
  if (s.x0 == null) { s.x0 = -MX; s.cw = WW + MX * 2; s.foreX0 = -MX; }
  s.inside = w.inside; s.kind = w.kind; s.time = w.time; s.shaftC = s.shafts.map(sh => shaftStamp(sh, s.mk));
  // the colour along the world's top edge (sky or ceiling), so the backdrop above it on tall screens has no seam
  try { const src = s.back || s.mid, d = src.getContext('2d').getImageData(src.width / 2 - 40, 1, 80, 1).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; s.topC = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`; } catch (e) { s.topC = null; }
  if (s.back) s.back = half(s.back); s.fore = half(s.fore); s.shaftC = s.shaftC.map(half);
  const m = s.motes, r = rng(17); s.parts = [];
  if (m && !RM) for (let i = 0; i < Math.min(36, m.n); i++) s.parts.push({ x: m.area[0] + r() * m.area[2], y: m.area[1] + r() * m.area[3], s: 1 + r() * 2, vx: (r() - .5) * 6, vy: m.rise ? -(4 + r() * 8) : 3 + r() * 6, ph: r() * 6.28, tw: .5 + r() });
  stats.bake = Math.round(performance.now() - t0);
  return s;
}

/* ---------------------------------------------------------------- actors */
const A = { keeper: null, cust: null, queue: null };
let keeperKey = '', lastScene = '', goKey = '', lastPlace = 'gate', fromRoom = false;
function spot(name) {
  const v = window.TSV, k = kindOf(v);
  if (k === 'vil') {
    // in the village the keeper starts at the gate, or on the step of the house she just came out of;
    // a neighbour comes out of their own door and stands beside her
    const P = VPLACES[v.place || lastPlace] || VPLACES.gate;
    return name === 'keeper' ? (fromRoom && v.go ? goTarget(v.go) : VPLACES.gate.stand) : name === 'cust' ? (P.meet || P.stand) : (P.door || P.stand);
  }
  return SPOT[k === 'in' ? 'inside' : k === 'room' ? 'room' : 'outside'][name];
}
// where "go" sends her: a place's standing spot, or "x:<world x>" along the lane
function goTarget(key) {
  if (key.startsWith('x:')) { const x = +key.slice(2); return [Math.max(2 * VX0 + 60, Math.min(2 * VX1 - 60, isFinite(x) ? x : 0)), VLANE]; }
  return (VPLACES[key] || VPLACES.gate).stand;
}
function newActor(spec, at, to, who) { return { spec, x: at[0], y: at[1], tx: to[0], ty: to[1], who, leaving: false, born: performance.now(), sp: Math.hypot(to[0] - at[0], to[1] - at[1]) / 1.55 }; }
function updateActors(dt, rawDt) {
  const v = window.TSV, sc = kindOf(v);
  if (sc !== lastScene) { fromRoom = lastScene === 'room'; A.cust = A.queue = null; keeperKey = ''; lastScene = sc; goKey = ''; }
  if (v.place) lastPlace = v.place;
  const kk = v.keeper ? JSON.stringify(v.keeper) : '';
  if (kk !== keeperKey) {
    // a new dress mid-walk keeps her where she is
    if (keeperKey && A.keeper && v.keeper) A.keeper.spec = v.keeper;
    else A.keeper = v.keeper ? newActor(v.keeper, spot('keeper'), spot('keeper'), 'keeper') : null;
    keeperKey = kk;
  }
  if (sc === 'vil' && A.keeper) {
    const key = v.go || 'gate';
    if (key !== goKey) { goKey = key; const [tx, ty] = goTarget(key), a = A.keeper; a.tx = tx; a.ty = ty; a.sp = Math.max(300, Math.hypot(tx - a.x, ty - a.y) / 3.6); }
  }
  const c = v.cust;
  if (A.cust && !A.cust.leaving && A.cust.spec !== c) { A.cust.leaving = true; const e = spot('enter'); A.cust.tx = e[0]; A.cust.ty = e[1]; A.cust.sp = Math.hypot(A.cust.x - e[0], A.cust.y - e[1]) / .85; }
  if (c && (!A.cust || A.cust.leaving) && (!A.queue || A.queue.spec !== c)) A.queue = newActor(c, spot('enter'), spot('cust'), 'cust');
  if (!c) A.queue = null;
  for (const k of ['keeper', 'cust']) {
    const a = A[k]; if (!a) continue;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    // a slow device still gets her there on time (the game waits at most 9 s for a walk down the lane)
    if (d > .5) { const st = Math.min(d, a.sp * (sc === 'vil' ? Math.min(1, rawDt || dt) : dt)); a.x += dx / d * st; a.y += dy / d * st; a.moving = true; } else { a.x = a.tx; a.y = a.ty; a.moving = false; }
    if (a.leaving && !a.moving) A[k] = null;
  }
  if (!A.cust && A.queue) { A.cust = A.queue; A.queue = null; }
  // the game waits for this: she has arrived where TSV.go sent her
  if (sc === 'vil' && A.keeper && !A.keeper.moving && goKey && v.at !== goKey) v.at = goKey;
  updateFolk(v, dt);
}

/* ---------------------------------------------------------------- villagers out for a stroll (TSV.folk: [{id, spec}])
   They stroll up and down near wherever the shopkeeper is, rest a while, stop in pairs to chat, keep clear of a
   neighbour she is visiting, and stop to face us and wave when tapped (TSV.folkMood[id] === 'wave'). */
const FOLK = { key: '', list: [] };
const FOLK_Y = [390, 399, 394, 402];
function updateFolk(v, dt) {
  const list = kindOf(v) === 'vil' && Array.isArray(v.folk) ? v.folk.filter(f => f && f.id && f.spec) : [];
  const key = list.map(f => f.id).join();
  const lo = 2 * VX0 + 70, hi = 2 * VX1 - 70, clamp = x => Math.max(lo, Math.min(hi, x));
  const kx = A.keeper ? A.keeper.x : VPLACES.gate.stand[0];
  const P = v.place && VPLACES[v.place], busy = P && P.meet && v.cust ? (P.stand[0] + P.meet[0]) / 2 : null;
  const halfV = Math.max(200, (W || 1000) / 2 / (view.s || 1.5));
  const away = x => busy != null && Math.abs(x - busy) < 190 ? busy + Math.sign(x - busy || 1) * 250 : x;
  if (key !== FOLK.key) {
    FOLK.key = key; const r = rng(31);
    FOLK.list = list.map((f, i) => { const x = clamp(away(kx + (i - 1.5) * 190 + r() * 60)); return { id: f.id, spec: f.spec, who: 'folk', x, y: FOLK_Y[i % 4], tx: x, wait: .6 + r() * 2.5, chat: null, born: i * 1300, moving: false, mood: 'idle', lean: 0 }; });
  }
  for (const f of FOLK.list) {
    const spec = list.find(g => g.id === f.id); if (spec) f.spec = spec.spec;
    if (v.folkMood && v.folkMood[f.id] === 'wave') { f.moving = false; f.mood = 'wave'; f.lean = 0; f.tx = f.x; if (f.chat) { f.chat.chat = null; f.chat = null; } continue; }
    // she walked off down the lane: come back towards her from just out of sight
    if (Math.abs(f.x - kx) > halfV + 520) { const side = f.x < kx ? -1 : 1; f.x = clamp(away(kx + side * (halfV + 60 + Math.random() * 120))); f.tx = clamp(away(kx + side * Math.random() * halfV * .6)); f.wait = 0; if (f.chat) { f.chat.chat = null; f.chat = null; } }
    // a neighbour came out to meet her: don't stand in the way
    if (busy != null && !f.moving && Math.abs(f.x - busy) < 170) { f.wait = 0; f.tx = clamp(away(f.x)); if (Math.abs(f.tx - f.x) < 2) f.tx = clamp(f.x + 260); if (f.chat) { f.chat.chat = null; f.chat = null; } }
    const dx = f.tx - f.x;
    if (Math.abs(dx) > 1 && f.wait <= 0) {
      f.x += Math.sign(dx) * Math.min(Math.abs(dx), 48 * dt); f.moving = true; f.mood = 'walk'; f.lean = 0;
      if (busy != null && Math.abs(f.x - busy) < 160 && Math.sign(dx) === Math.sign(busy - f.x)) f.tx = clamp(f.x + Math.sign(f.x - busy || 1) * 220); // turn round before the visit
    } else {
      if (f.moving || f.wait <= 0 && !f.chat) {
        // just got there: a rest, and a chat if a friend is close by
        f.moving = false; f.wait = 2.5 + Math.random() * 4; f.chat = null;
        const pal = FOLK.list.find(g => g !== f && !g.chat && Math.abs(g.x - f.x) < 140 && Math.abs(g.x - f.x) > 52 && !(v.folkMood && v.folkMood[g.id]));
        if (pal) { f.chat = pal; pal.chat = f; f.wait += 2; pal.wait = f.wait; pal.tx = pal.x; pal.moving = false; }
        // don't stop right behind her or on top of someone else: move on soon
        else if (Math.abs(f.x - kx) < 56 || FOLK.list.some(g => g !== f && !g.moving && Math.abs(g.x - f.x) < 50)) f.wait = .3;
      }
      f.wait -= dt; f.moving = false;
      f.mood = f.chat ? 'talk' : 'idle'; f.lean = f.chat ? Math.sign(f.chat.x - f.x) * .07 : 0;
      if (f.wait <= 0) {
        if (f.chat) { const g = f.chat; g.chat = null; g.wait = Math.min(g.wait, .8); f.chat = null; }
        const span = Math.min(560, halfV * 1.3);
        f.tx = clamp(away(kx + (Math.random() - .5) * 2 * span)); f.wait = 0;
        if (Math.abs(f.tx - f.x) < 60) f.tx = clamp(f.x + (f.x < kx ? 160 : -160));
      }
    }
  }
}
function folkAt(wx, wy) {
  let best = null, bd = Infinity;
  for (const f of FOLK.list) { const d = Math.abs(wx - f.x); if (d < 34 && wy > f.y - 84 && wy < f.y + 12 && d < bd) { bd = d; best = f; } }
  return best;
}
let talkUntil = 0, lastTxt = '';
function drawActor(a, t) {
  const v = window.TSV, isK = a.who === 'keeper';
  let mood = a.who === 'folk' ? a.mood || 'idle' : (v.mood && v.mood[isK ? 'keeper' : 'cust']) || 'idle';
  if (a.moving) mood = 'walk';
  const wave = mood === 'wave';
  if (isK && v.speaker === 'keeper' && t < talkUntil && mood === 'idle') mood = 'talk';
  const fly = a.spec.species === 'fairy';
  let frame = mood === 'talk' ? ((t / 170 | 0) % 2 ? 'talk' : 'idle') : mood === 'happy' || wave ? 'happy' : 'idle';
  if (frame === 'idle' && !RM && (t / 1000 + a.born / 777) % 4.2 < .14) frame = 'blink';
  const breath = RM ? 0 : ((t / 560 + (isK ? 0 : .3)) | 0) % 2;
  const ch = character(a.spec, frame, mood === 'walk' ? 0 : breath);
  let y = a.y, x = a.x;
  if (mood === 'walk' && !RM) y -= Math.abs(Math.sin(t / 110)) * 3;
  if (mood === 'happy' && !RM) y -= Math.abs(Math.sin(t / 160)) * 4;
  if (fly) y -= 22 + (RM ? 0 : Math.sin(t / 420) * 5);
  const S = 2, w = ch.w * S, h = ch.h * S;
  // soft contact shadow
  ctx.save(); ctx.globalAlpha = fly ? .25 : .45; ctx.fillStyle = '#1a0e08';
  ctx.beginPath(); ctx.ellipse(a.x, a.y - 2, w * .34, w * .09, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.imageSmoothingEnabled = false;
  const lean = (mood === 'walk' && !RM ? Math.sin(t / 110) * .04 : 0) + (a.lean || 0);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (lean) ctx.rotate(lean);
  ctx.drawImage(ch.canvas, -Math.round(w / 2), -h, w, h); ctx.restore();
  if (wave) drawWave(a.spec, x, y, w, h, t);
  if (fly && !RM && (t / 300 | 0) % 3 === 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(glowStamp('#fff0a0'), x - 40, y - h * .6 - 30, 80, 60); ctx.restore(); }
  // mood marks above the head
  const hy = y - h - 6;
  if (mood === 'think') { const s = spriteCanvasOf(ICONS.think); ctx.drawImage(s, x + w * .2, hy - s.height * 2 + (RM ? 0 : Math.sin(t / 300) * 2), s.width * 2, s.height * 2); }
  if ((mood === 'happy' || wave) && !RM) { const s = spriteCanvasOf(((t / 400) | 0) % 2 ? ICONS.heart : ICONS.sparkle); const k = 1.5 + Math.sin(t / 200) * .3; ctx.drawImage(s, x + w * .25, hy - 4 - Math.sin(t / 300) * 4, s.width * k, s.height * k); }
  // two villagers chatting: little speech dots over whoever is talking just now
  if (mood === 'talk' && a.who === 'folk' && a.chat && ((t / 1400 | 0) + (a.x < a.chat.x ? 0 : 1)) % 2 === 0) { const s = spriteCanvasOf(ICONS.think); ctx.drawImage(s, x - s.width, hy - s.height * 2 + (RM ? 0 : Math.sin(t / 300) * 2), s.width * 2, s.height * 2); }
}
// a paw (or a wing) raised and waving hello, on the side away from her
function drawWave(spec, x, y, w, h, t) {
  const fur = spec.species === 'fairy' ? '#F6D8C4' : spec.fur || '#b9ada3', sx = x + w * .3, sy = y - h * .42, a = -2.2 + (RM ? 0 : Math.sin(t / 150) * .45);
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(a);
  ctx.fillStyle = '#2a1a14'; ctx.fillRect(-4, -2, 8, 22); ctx.fillRect(-6, 12, 12, 12);
  ctx.fillStyle = fur; ctx.fillRect(-2, 0, 4, 18); ctx.fillRect(-4, 14, 8, 8);
  ctx.fillStyle = shade(fur, .3); ctx.fillRect(-2, 15, 3, 3);
  ctx.restore();
}

/* ---------------------------------------------------------------- camera */
const cam = Object.assign({ init: false }, CAMS.outside);
function camTarget() { const v = window.TSV; return v.scene === 'village' ? villageCam(v) : v.scene === 'room' ? CAMS['room_' + v.room] || CAMS.room_home : CAMS[v.cam] || CAMS[v.scene === 'inside' ? 'inside' : 'outside']; }
// in the village the camera follows her along the lane, and frames her and the neighbour during a visit
const VCAM = { cx: 0, cy: 290, w: 600, h: 250, x0: 0, y0: 200, x1: 0, y1: 432 }; // cy leans up: show the rooftops before the grass
function villageCam(v) {
  let fx = A.keeper ? A.keeper.x : VPLACES.gate.stand[0];
  const P = v.place && VPLACES[v.place];
  if (P && P.meet && v.cust) fx = (P.stand[0] + P.meet[0]) / 2;
  VCAM.cx = fx; VCAM.x0 = fx - 150; VCAM.x1 = fx + 150; return VCAM;
}

/* ---------------------------------------------------------------- frame */
const stats = { frames: 0, bake: 0, fps: 0 };
let last = 0, lastDraw = 0, keptVillage = null, snapCam = false;
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = t; return; }
  if (t - lastDraw < 31) return; // ~30 fps is plenty for pixel art and kind to the battery
  const rawDt = (t - (last || t)) / 1000, dt = Math.min(.1, rawDt); last = t; lastDraw = t;
  const v = window.TSV; if (!v) return;
  const t0f = performance.now();
  if (!W) resize();
  const w = want();
  // the actors first, so a camera that cuts to a new place (out of a house's door) finds her already there
  updateActors(dt, rawDt);
  if (w.key !== sceneKey) {
    const sceneChanged = !scene || scene.kind !== w.kind;
    document.body.classList.toggle('dusk', w.time === 'evening' || w.time === 'night');
    // the village is big: keep its painting while she pops into a house, so coming back out is instant
    if (scene && scene.kind === 'vil') keptVillage = scene;
    scene = w.kind === 'vil' && keptVillage && keptVillage.key === w.key ? keptVillage : build(w); scene.key = w.key; sceneKey = w.key;
    if (sceneChanged && cam.init) { fade = 1; const c = camTarget(); Object.assign(cam, c); }
  }
  // speech: the keeper's mouth moves for a moment after she speaks
  if ((stats.frames & 3) === 0) { const tx = document.querySelector('#bubble .txt'); const s = tx && !document.getElementById('bubble').hidden ? tx.textContent : ''; if (s !== lastTxt) { lastTxt = s; if (s) talkUntil = t + Math.min(2600, 600 + s.length * 40); } }
  const tg = camTarget(), vil = scene.kind === 'vil';
  if (!cam.init || snapCam) { Object.assign(cam, tg); cam.init = true; snapCam = false; }
  else { const k = Math.min(1, dt * (vil ? 3.2 : 2.5)); for (const p of CAMK) cam[p] += (tg[p] - cam[p]) * k; }
  const top = Math.max(0, v.top || 0), bot = Math.max(top + 120, Math.min(H, v.bottom || H)), bandH = bot - top, mid = (top + bot) / 2;
  let s = Math.min(W / cam.w, bandH / cam.h);
  // a tall band (iPad portrait): zoom in until the world fills the band's height, as long as the part that must stay
  // on screen (the shelves and the door inside; the house, keeper and customer outside) still fits the width
  const keepX = vil ? [0, 400] : scene.kind === 'room' ? TALLX.room : !v.cam || v.cam === 'inside' || v.cam === 'outside' ? TALLX[v.scene === 'inside' ? 'inside' : 'outside'] : null;
  if (keepX) s = Math.max(s, Math.min(bandH / WH, W / (keepX[1] - keepX[0])));
  const sc = scene;
  // a short band in the village (a big panel open) frames closer on the two of them instead of shrinking the whole lane
  if (vil) s = Math.max(s, Math.min(1, bandH / 150));
  s = Math.max(s, W / sc.cw * .999); // never show past the left/right edge of the world
  let cx = cam.cx, cy = cam.cy;
  // when the band is too small for the whole view, slide so the important part stays in it
  const hb = bandH / 2 / s, hw = W / 2 / s;
  if (cam.y1 - cam.y0 <= hb * 2) cy = Math.max(cam.y1 - hb + 6, Math.min(cam.y0 + hb - 6, cy)); else cy = vil ? cam.y1 - hb + 4 : (cam.y0 + cam.y1) / 2;
  if (cam.x1 - cam.x0 <= hw * 2) cx = Math.max(cam.x1 - hw + 10, Math.min(cam.x0 + hw - 10, cx));
  const halfW = W / 2 / s; cx = Math.max(sc.x0 + halfW, Math.min(sc.x0 + sc.cw - halfW, cx));
  if (vil && hb * 2 <= WH) cy = Math.max(hb, Math.min(WH - hb, cy)); // the lane never shows past the bottom of the painting
  // a tall band (iPad portrait) can be taller than the whole painted world: sit the world's floor on the panel and let
  // the sky / ceiling colour fill the space above, instead of ending the floor in a flat strip halfway down the screen
  if (WH * s < bandH) cy = WH - (bot - mid) / s;
  const ox = W / 2 - cx * s, oy = mid - cy * s;
  view.s = s; view.ox = ox; view.oy = oy; view.cx = cx;
  // backdrop for anything outside the world (tall portrait screens)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const edge = sc.edge || (sc.inside ? ['#c87a84', '#a87a4e'] : [SKY[sc.time][0], sc.time === 'morning' ? '#5f9a4a' : '#1e3230']);
  const eg = ctx.createLinearGradient(0, 0, 0, H); eg.addColorStop(0, edge[0]); eg.addColorStop(1, edge[1]); ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H);
  if (sc.topC && oy > 0) { ctx.fillStyle = sc.topC; ctx.fillRect(0, 0, W, Math.ceil(oy) + 1); }
  // world layers
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * ox, DPR * oy); ctx.imageSmoothingEnabled = false;
  if (sc.back) { ctx.imageSmoothingEnabled = true; blit(sc.back, sc.x0, 2); ctx.imageSmoothingEnabled = false; }
  if (sc.mill) drawMill(sc.mill, t);
  blit(sc.mid, sc.x0);
  if (vil) drawVillageLife(sc, v, t);
  if (sc.pend) drawPendulum(sc.pend, t);
  if (sc.smokes && sc.smokes.length) drawSmoke(sc.smokes, t);
  // characters, sorted by depth; the counter sits between the shopkeeper and the customer
  const list = [];
  if (A.keeper) list.push([A.keeper.y, () => drawActor(A.keeper, t)]);
  if (A.cust) list.push([A.cust.y, () => drawActor(A.cust, t)]);
  if (vil) for (const f of FOLK.list) list.push([f.y, () => drawActor(f, t)]);
  if (sc.counter) list.push([344, () => { ctx.imageSmoothingEnabled = false; blit(sc.counter, -MX); }]);
  list.sort((a, b) => a[0] - b[0]).forEach(d => d[1]());
  // light: bloom pools, shafts, motes
  ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
  for (const L of (vil && v.ringLit ? sc.lights.concat(sc.ringGlow || []) : sc.lights)) {
    let a = L.a; if (L.fl && !RM) a *= .86 + .14 * Math.sin(t / 380 + (L.tw || L.x) * 1.7) * Math.sin(t / 910 + L.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.drawImage(glowStamp(L.c), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.globalCompositeOperation = 'screen';
  sc.shaftC.forEach((k, i) => { ctx.globalAlpha = RM ? .9 : .75 + .25 * Math.sin(t / 2300 + i * 2); blit(k, sc.x0, 2); });
  if (sc.parts.length) {
    const [r, g, b] = hex2rgb(sc.motes.c), ar = sc.motes.area, gl = glowStamp(sc.motes.c);
    if (sc.motes.follow) ar[0] = cx - ar[2] / 2; // in the long village the motes drift round the camera
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sc.parts) {
      p.x += (p.vx + Math.sin(t / 900 + p.ph) * 4) * dt; p.y += p.vy * dt;
      if (p.y < ar[1] - 10) { p.y = ar[1] + ar[3]; } if (p.y > ar[1] + ar[3] + 10) { p.y = ar[1]; }
      if (p.x < ar[0] - 10) p.x = ar[0] + ar[2]; if (p.x > ar[0] + ar[2] + 10) p.x = ar[0];
      const a = .3 + .7 * Math.abs(Math.sin(p.ph + t / 1000 * p.tw));
      if (sc.motes.glow) { ctx.globalAlpha = .45 * a; ctx.drawImage(gl, p.x - p.s * 4, p.y - p.s * 4, p.s * 8, p.s * 8); }
      ctx.globalAlpha = a; ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.s)), Math.max(1, Math.round(p.s)));
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // foreground leaves (blurred, with a little parallax)
  const px = vil ? (cx - (VX0 + VX1)) * .15 : (cx - WW / 2) * .12;
  ctx.imageSmoothingEnabled = true; blit(sc.fore, sc.foreX0 - px, 2);
  // colour grade and vignette (screen space)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const gr = GRADE[sc.time];
  if (gr) { ctx.globalCompositeOperation = gr.op; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, gr.a); g.addColorStop(1, gr.b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  if (!vign) vign = makeVignette();
  ctx.drawImage(vign, 0, 0, W, H);
  if (fade > 0) { ctx.fillStyle = `rgba(7,11,24,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); fade -= dt * (RM ? 10 : 2.6); }
  stats.frames++; const ms = performance.now() - t0f; stats.ms = stats.ms ? stats.ms * .95 + ms * .05 : ms;
}
const view = { s: 1, ox: 0, oy: 0, cx: 0 };
// draw only the part of a world layer that is on screen (the village layers are about 2500 px wide)
// k: world px per image px (the blurry layers are kept at half size, they look the same and cost a quarter)
function blit(img, X, k = 1) {
  const s = view.s, sx = Math.max(0, Math.floor((-view.ox / s - X) / k) - 2), ex = Math.min(img.width, Math.ceil(((W - view.ox) / s - X) / k) + 2);
  const sy = Math.max(0, Math.floor(-view.oy / s / k) - 2), ey = Math.min(img.height, Math.ceil((H - view.oy) / s / k) + 2);
  if (ex > sx && ey > sy) ctx.drawImage(img, sx, sy, ex - sx, ey - sy, X + sx * k, sy * k, (ex - sx) * k, (ey - sy) * k);
}
function half(src) { const [o, ox] = cnv(Math.ceil(src.width / 2), Math.ceil(src.height / 2)); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high'; ox.drawImage(src, 0, 0, o.width, o.height); return o; }
// what moves in the village: the fairy-ring lanterns (lit once Fern's job is done) and the ducks on the pond
function drawVillageLife(sc, v, t) {
  if (!sc.ringGlow) sc.ringGlow = sc.ringLamps.map((L, i) => ({ x: L.gx, y: L.gy, r: 46, c: '#ffd86b', a: .95, fl: true, tw: i * 3 }));
  if (v.ringLit) for (const L of sc.ringLamps) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(L.x, L.y, L.w, L.h); ctx.fillStyle = '#ffffff'; ctx.fillRect(L.x + 2, L.y + 2, 4, 4); }
  // the ducks paddle round in a loop, the ducklings following their mother
  const ducks = sc.ducks.map(d => { const a = (RM ? 0 : t / 1000 * .32) + d.ph; return { d, a, x: d.cx + Math.cos(a) * d.rx, y: d.cy + Math.sin(a) * d.ry, flip: Math.sin(a) > 0 }; }).sort((p, q) => p.y - q.y);
  for (const { d, x, y, flip } of ducks) {
    const bob = RM ? 0 : Math.sin(t / 520 + d.ph * 3) * 1.2, w = d.s.w * 2, h = d.s.h * 2, X = Math.round(x - w / 2), Y = Math.round(y + bob - h);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(X - 3, Math.round(y) - 1, w + 6, 2);
    ctx.save(); if (flip) { ctx.translate(X + w, Y); ctx.scale(-1, 1); ctx.drawImage(spriteCanvasOf(d.s), 0, 0, w, h); } else ctx.drawImage(spriteCanvasOf(d.s), X, Y, w, h); ctx.restore();
  }
}
// tapping the village: a house or stall visits it, anywhere on the lane walks there (the game decides, via TSV.onTap)
let tapDown = null;
cv.addEventListener('pointerdown', e => { tapDown = [e.clientX, e.clientY, performance.now()]; });
cv.addEventListener('pointerup', e => {
  const v = window.TSV, d0 = tapDown; tapDown = null;
  if (!d0 || !v || v.scene !== 'village' || typeof v.onTap !== 'function') return;
  if (Math.hypot(e.clientX - d0[0], e.clientY - d0[1]) > 16 || performance.now() - d0[2] > 800) return;
  const wx = (e.clientX - view.ox) / view.s, wy = (e.clientY - view.oy) / view.s;
  // a villager out for a stroll says hello
  const f = folkAt(wx, wy); if (f) { v.onTap({ who: f.id }); return; }
  if (wy < VLANE - 34) {
    let best = null, bd = Infinity;
    for (const [id, P] of Object.entries(VPLACES)) if (P.hit && wx >= P.hit[0] && wx <= P.hit[1] && Math.abs(wx - P.x) < bd) { bd = Math.abs(wx - P.x); best = id; }
    if (best) { v.onTap({ place: best }); return; }
  }
  v.onTap({ x: wx });
});
const GRADE = {
  morning: { op: 'soft-light', a: 'rgba(255,214,140,.32)', b: 'rgba(60,40,20,.28)' },
  day: { op: 'soft-light', a: 'rgba(255,236,200,.24)', b: 'rgba(80,50,30,.30)' },
  evening: { op: 'soft-light', a: 'rgba(255,150,70,.5)', b: 'rgba(120,60,140,.55)' },
  night: { op: 'multiply', a: 'rgba(150,150,230,.55)', b: 'rgba(90,80,170,.7)' },
};
function makeVignette() {
  const [k, x] = cnv(256, 192); const g = x.createRadialGradient(128, 92, 40, 128, 96, 170);
  g.addColorStop(0, 'rgba(7,11,24,0)'); g.addColorStop(.55, 'rgba(7,11,24,0)'); g.addColorStop(.82, 'rgba(7,11,24,.32)'); g.addColorStop(1, 'rgba(7,11,24,.7)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 192); return k;
}

/* ---------------------------------------------------------------- the baker (panel pictures) */
const baked = new Map();
function bake(key, size, draw) {
  let u = baked.get(key); if (u) return u;
  const [k, x] = cnv(size, size); x.imageSmoothingEnabled = false; draw(x, size); u = k.toDataURL('image/png'); baked.set(key, u); return u;
}
function fit(x, size, spr, pad = 1) {
  const c = spriteCanvasOf(spr), sc = Math.max(1, Math.floor(size * pad / Math.max(spr.w, spr.h)));
  x.drawImage(c, Math.round((size - spr.w * sc) / 2), Math.round((size - spr.h * sc) / 2), spr.w * sc, spr.h * sc);
}
function portraitDraw(spec) {
  return (x, size) => {
    const ch = character(spec, 'idle', 0), crop = Math.min(ch.w, Math.round(ch.headH * 1.05)), sc = size / crop;
    x.imageSmoothingEnabled = false;
    // head and shoulders: a square crop from the top, centred
    const sx = Math.round((ch.w - crop) / 2), sy = spec.species === 'fairy' ? 1 : Math.max(0, Math.round(ch.headH - crop + 2));
    x.drawImage(ch.canvas, sx, sy, crop, crop, 0, 0, size, size); void sc;
  };
}
// a picture of one of the home things for the panel: painted on the chunky grid like in her house, then scaled up
function homeThumb(x, size, id) {
  const art = HOME_ART[id]; if (!art) return;
  const [bw, bh] = art.box, pad = 3, [c, cx] = cnv(bw + pad * 2, bh + pad * 2), P = painter(cx);
  if (id === 'canopy') { const B = { x0: pad + 6, x1: pad + bw - 6, wall: pad + bh - 32, front: pad + bh - 8 }; paintBed(P, B, true); art.paint(P, 0, 0, B); }
  else art.paint(P, pad + bw / 2, pad + bh);
  const k = Math.max(1, Math.floor(size * .92 / Math.max(c.width, c.height) * 2) / 2);
  x.imageSmoothingEnabled = false; x.drawImage(c, Math.round((size - c.width * k) / 2), Math.round((size - c.height * k) / 2), c.width * k, c.height * k);
}
window.Shop3D = {
  good: id => bake('g:' + id, 128, (x, s) => GSPR[id] && fit(x, s, GSPR[id], .9)),
  coin: v => bake('c:' + v, 128, (x, s) => { const sp = COINS[v] || COINS[1]; const k = 7; x.drawImage(spriteCanvasOf(sp), Math.round((s - sp.w * k) / 2), Math.round((s - sp.h * k) / 2), sp.w * k, sp.h * k); }),
  portrait: spec => bake('p:' + JSON.stringify(spec), 128, portraitDraw(spec)),
  decor: id => bake('d:' + id, 128, (x, s) => DSPR[id] && fit(x, s, DSPR[id], .92)),
  garden: id => bake('gd:' + id, 128, (x, s) => GDSPR[id] && fit(x, s, GDSPR[id], .92)),
  treasure: id => bake('tr:' + id, 128, (x, s) => TRSPR[id] && fit(x, s, TRSPR[id], .9)),
  icon: id => bake('i:' + id, 64, (x, s) => ICONS[id] && fit(x, s, ICONS[id], .95)),
  home: id => bake('h:' + id, 128, (x, s) => homeThumb(x, s, id)),
  sprite: (spec, mood) => bake('s:' + JSON.stringify(spec) + mood, 128, (x, s) => { const ch = character(spec, mood || 'idle', 0); const k = Math.floor(s / Math.max(ch.w, ch.h)); x.drawImage(ch.canvas, (s - ch.w * k) / 2, s - ch.h * k, ch.w * k, ch.h * k); }),
};
// run the walks and the strolls on for a few seconds at once and put the camera where it is heading (tests, screenshots)
function settle(sec = 2) { const v = window.TSV; if (!v) return; for (let i = 0; i < sec * 30; i++) updateActors(1 / 30, 1 / 30); snapCam = true; }
window.__ts3d = { stats, A, cam, view, FOLK, VPLACES, settle, get scene() { return sceneKey; } };

/* ---------------------------------------------------------------- pixel icons for the DOM
   The base game writes a few emoji into its buttons and notes (sound, gear, books, the coach's pointing hand, the
   notebook, the moon...). Swap each for its pixel icon so the windows match the diorama. Display only: the text the
   game reads aloud is built from its own strings, never from the DOM, and every button keeps its aria-label. */
const EMOJI_ICON = { '⭐': 'star', '📚': 'books', '🔊': 'soundOn', '🔈': 'soundOff', '⚙️': 'gear', '⚙': 'gear', '👆': 'hand', '🌙': 'moon', '🫙': 'jar', '📒': 'notebook', '⚓': 'anchor' };
const EMOJI_RE = new RegExp(Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length).join('|'), 'g');
function pixelIcons(root) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hits = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { EMOJI_RE.lastIndex = 0; if (EMOJI_RE.test(n.nodeValue)) hits.push(n); }
  for (const n of hits) {
    const frag = document.createDocumentFragment(), s = n.nodeValue; let i = 0; EMOJI_RE.lastIndex = 0;
    for (let m = EMOJI_RE.exec(s); m; m = EMOJI_RE.exec(s)) {
      if (m.index > i) frag.appendChild(document.createTextNode(s.slice(i, m.index)));
      const im = document.createElement('img'); im.className = 'oico oico-' + EMOJI_ICON[m[0]]; im.alt = ''; im.src = window.Shop3D.icon(EMOJI_ICON[m[0]]);
      frag.appendChild(im); i = m.index + m[0].length;
    }
    if (i < s.length) frag.appendChild(document.createTextNode(s.slice(i)));
    n.parentNode.replaceChild(frag, n);
  }
}

/* ---------------------------------------------------------------- the panel always fits
   The work panel is capped at about half the screen so the scene stays visible. When a task (eight price tags, the
   help box after a wrong answer, the jar shop) would need scrolling, step the panel down to a tighter layout so the
   answer buttons are never hidden below the fold. */
const panelEl = document.getElementById('panel');
let fitQ = 0;
function fitPanel() {
  fitQ = 0; const p = panelEl; if (!p) return;
  p.classList.remove('ot1', 'ot2');
  if (!p.firstChild) return;
  for (const c of ['ot1', 'ot2']) { if (p.scrollHeight <= p.clientHeight + 2) break; p.classList.add(c); }
}
function queueFit() { if (!fitQ) fitQ = requestAnimationFrame(fitPanel); }
const domRoots = ['hud', 'bubble', 'panel'].map(id => document.getElementById(id)).filter(Boolean);
const mo = new MutationObserver(recs => {
  for (const r of recs) { const t = r.target.nodeType === 3 ? r.target.parentNode : r.target; if (t && t.isConnected) pixelIcons(t); }
  if (recs.some(r => panelEl && panelEl.contains(r.target.nodeType === 3 ? r.target.parentNode : r.target))) queueFit();
});
domRoots.forEach(r => { pixelIcons(r); mo.observe(r, { childList: true, subtree: true, characterData: true }); });
addEventListener('resize', queueFit); queueFit();

// warm up a picture of everything before saying we are ready, so a broken canvas falls back to emoji
window.Shop3D.good('bun'); window.Shop3D.coin(1);
document.body.insertBefore(cv, document.body.firstChild);
document.body.classList.add('g3d');
resize();
requestAnimationFrame(frame);
if (window.__ts && window.__ts.on3d) window.__ts.on3d();
if (typeof window.hud === 'function') window.hud();
