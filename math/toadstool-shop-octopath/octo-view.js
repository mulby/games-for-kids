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
import { character, COINS, FONT, GOODS as GSPR, ICONS, DECOR as DSPR, spriteCanvasOf, mix, shade, rgba, rng, bayer, hex2rgb } from './octo-art.js';

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
        ctx.fillStyle = cL; ctx.fillRect(x, y + yy, w, 1); ctx.fillStyle = cH;
        for (let xx = 0; xx < w; xx++) if (bayer(xx + x, yy + y) < loc) ctx.fillRect(x + xx, y + yy, 1, 1);
      }
      return P;
    },
    dither(x, y, w, h, c, d) { ctx.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (bayer(x + xx, y + yy) < d) ctx.fillRect(x + xx, y + yy, 1, 1); return P; },
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
function paintOutside(time, decor, cart, signText) {
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
function paintInside(decor, stock) {
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
    for (let x = -116; x < WW + 116; x += 2) { const t = (((x + 160) % 160) / 160); M.px(x, 78 + Math.sin(t * Math.PI) * 18 - 4, '#5a6a4a'); }
    for (let i = 0; i < 54; i++) { const x = -112 + i * 16, t = (((x + 160) % 160) / 160), y = 76 + Math.sin(t * Math.PI) * 18; const c = cols[i % 4]; M.rect(x - 1, y - 1, 3, 4, c); M.px(x, y - 2, '#3a4a2a'); lights.push({ x, y: y + 1, r: 16, c, a: .9, fl: true, tw: i }); }
  }
  if (has('bell')) { M.rect(492, 196, 20, 3, '#5a3a28'); M.rect(500, 198, 2, 8, '#5a3a28'); M.spr(DSPR.bell, 492, 200); lights.push({ x: 500, y: 214, r: 22, c: '#ffe080', a: .35 }); }
  if (has('rug')) { const [x, y] = SPOT.inside.cust; [['#e2566b', 84, 22], ['#ffd86b', 72, 18], ['#7bb4d9', 60, 15], ['#f6a6bd', 46, 11], ['#fff3e6', 30, 7]].forEach(([c, rx, ry]) => M.ellipse(x, y + 2, rx, ry, c)); M.dither(x - 84, y - 20, 168, 44, 'rgba(0,0,0,0)', 0); }
  if (has('catbed')) { M.ellipse(112, 440, 40, 16, '#8a78c0'); M.ellipse(112, 436, 36, 12, '#b9a6e8'); M.ellipse(112, 434, 28, 8, '#d8ccf4'); M.spr(DSPR.catbed, 88, 410, 3); }
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
  // lights and shafts
  lights.push({ x: 408, y: 152, r: 110, c: '#e8f4ff', a: .45 }, { x: 321, y: 104, r: 64, c: '#ffc860', a: .8, fl: true }, { x: 546, y: 280, r: 90, c: '#d8ffb0', a: .35 });
  shafts.push({ x: 430, y: 110, ang: 0.62, n: 3, len: 420, w: 40, gap: 34, c: '#fff6d8', a: .2 });
  const midT = tiltShift(mid, 104, 452, 4);
  const [fore, fx] = wcnv(), F = painter(fx);
  F.poly([[0, 420], [60, 400], [110, 480], [0, 480]], '#5a3a2a'); F.ellipse(40, 470, 60, 30, '#6e4a30');
  F.ellipse(612, 466, 46, 34, '#7a5a3a'); F.ellipse(600, 444, 26, 14, '#c23f55'); F.ellipse(596, 440, 6, 3, '#fff3e2');
  return { back: null, mid: midT, fore: blurred(fore, 7), counter, lights, shafts, motes: { c: '#fff4d0', n: 22, glow: false, area: [300, 120, 260, 260], rise: false } };
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
function shaftStamp(s) {
  const [k, x] = wcnv(); x.imageSmoothingEnabled = true;
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
function want() {
  const v = window.TSV, inside = v.scene === 'inside';
  const ph = window.__ts && window.__ts.S ? window.__ts.S.phase : '';
  const time = inside ? 'day' : v.time === 'evening' ? (ph === 'night' ? 'night' : 'evening') : 'morning';
  const stock = inside ? Object.keys(SLOT).map(g => Math.min(10, (v.stock && v.stock[g]) | 0) + ':' + ((v.stock && v.stock[g]) > 0 ? priceFor(g) : '')).join(',') : '';
  return { inside, time, key: [inside ? 'in' : 'out', time, (v.decor || []).join('+'), inside ? stock : (v.cart ? 'cart' : ''), (v.decor || []).includes('sign') ? v.signText : ''].join('|') };
}
function build(w) {
  const v = window.TSV, t0 = performance.now();
  const s = w.inside ? paintInside(v.decor || [], v.stock || {}) : paintOutside(w.time, v.decor || [], !!v.cart, v.signText || '');
  s.inside = w.inside; s.time = w.time; s.shaftC = s.shafts.map(shaftStamp);
  // the colour along the world's top edge (sky or ceiling), so the backdrop above it on tall screens has no seam
  try { const src = s.back || s.mid, d = src.getContext('2d').getImageData(MX + WW / 2 - 40, 1, 80, 1).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; s.topC = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`; } catch (e) { s.topC = null; }
  const m = s.motes, r = rng(17); s.parts = [];
  if (m && !RM) for (let i = 0; i < Math.min(36, m.n); i++) s.parts.push({ x: m.area[0] + r() * m.area[2], y: m.area[1] + r() * m.area[3], s: 1 + r() * 2, vx: (r() - .5) * 6, vy: m.rise ? -(4 + r() * 8) : 3 + r() * 6, ph: r() * 6.28, tw: .5 + r() });
  stats.bake = Math.round(performance.now() - t0);
  return s;
}

/* ---------------------------------------------------------------- actors */
const A = { keeper: null, cust: null, queue: null };
let keeperKey = '', lastScene = '';
function spot(name) { return SPOT[window.TSV.scene === 'inside' ? 'inside' : 'outside'][name]; }
function newActor(spec, at, to, who) { return { spec, x: at[0], y: at[1], tx: to[0], ty: to[1], who, leaving: false, born: performance.now(), sp: Math.hypot(to[0] - at[0], to[1] - at[1]) / 1.55 }; }
function updateActors(dt) {
  const v = window.TSV, sc = v.scene === 'inside' ? 'in' : 'out';
  if (sc !== lastScene) { A.cust = A.queue = null; keeperKey = ''; lastScene = sc; }
  const kk = v.keeper ? JSON.stringify(v.keeper) : '';
  if (kk !== keeperKey) { keeperKey = kk; A.keeper = v.keeper ? newActor(v.keeper, spot('keeper'), spot('keeper'), 'keeper') : null; }
  const c = v.cust;
  if (A.cust && !A.cust.leaving && A.cust.spec !== c) { A.cust.leaving = true; const e = spot('enter'); A.cust.tx = e[0]; A.cust.ty = e[1]; A.cust.sp = Math.hypot(A.cust.x - e[0], A.cust.y - e[1]) / .85; }
  if (c && (!A.cust || A.cust.leaving) && (!A.queue || A.queue.spec !== c)) A.queue = newActor(c, spot('enter'), spot('cust'), 'cust');
  if (!c) A.queue = null;
  for (const k of ['keeper', 'cust']) {
    const a = A[k]; if (!a) continue;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    if (d > .5) { const st = Math.min(d, a.sp * dt); a.x += dx / d * st; a.y += dy / d * st; a.moving = true; } else { a.x = a.tx; a.y = a.ty; a.moving = false; }
    if (a.leaving && !a.moving) A[k] = null;
  }
  if (!A.cust && A.queue) { A.cust = A.queue; A.queue = null; }
}
let talkUntil = 0, lastTxt = '';
function drawActor(a, t) {
  const v = window.TSV, isK = a.who === 'keeper';
  let mood = (v.mood && v.mood[isK ? 'keeper' : 'cust']) || 'idle';
  if (a.moving) mood = 'walk';
  if (isK && v.speaker === 'keeper' && t < talkUntil && mood === 'idle') mood = 'talk';
  const fly = a.spec.species === 'fairy';
  let frame = mood === 'talk' ? ((t / 170 | 0) % 2 ? 'talk' : 'idle') : mood === 'happy' ? 'happy' : 'idle';
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
  const lean = mood === 'walk' && !RM ? Math.sin(t / 110) * .04 : 0;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (lean) ctx.rotate(lean);
  ctx.drawImage(ch.canvas, -Math.round(w / 2), -h, w, h); ctx.restore();
  if (fly && !RM && (t / 300 | 0) % 3 === 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5; ctx.drawImage(glowStamp('#fff0a0'), x - 40, y - h * .6 - 30, 80, 60); ctx.restore(); }
  // mood marks above the head
  const hy = y - h - 6;
  if (mood === 'think') { const s = spriteCanvasOf(ICONS.think); ctx.drawImage(s, x + w * .2, hy - s.height * 2 + (RM ? 0 : Math.sin(t / 300) * 2), s.width * 2, s.height * 2); }
  if (mood === 'happy' && !RM) { const s = spriteCanvasOf(((t / 400) | 0) % 2 ? ICONS.heart : ICONS.sparkle); const k = 1.5 + Math.sin(t / 200) * .3; ctx.drawImage(s, x + w * .25, hy - 4 - Math.sin(t / 300) * 4, s.width * k, s.height * k); }
}

/* ---------------------------------------------------------------- camera */
const cam = Object.assign({ init: false }, CAMS.outside);
function camTarget() { const v = window.TSV; return CAMS[v.cam] || CAMS[v.scene === 'inside' ? 'inside' : 'outside']; }

/* ---------------------------------------------------------------- frame */
const stats = { frames: 0, bake: 0, fps: 0 };
let last = 0, lastDraw = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = t; return; }
  if (t - lastDraw < 31) return; // ~30 fps is plenty for pixel art and kind to the battery
  const dt = Math.min(.1, (t - (last || t)) / 1000); last = t; lastDraw = t;
  const v = window.TSV; if (!v) return;
  const t0f = performance.now();
  if (!W) resize();
  const w = want();
  if (w.key !== sceneKey) {
    const sceneChanged = !scene || scene.inside !== w.inside;
    document.body.classList.toggle('dusk', w.time === 'evening' || w.time === 'night');
    scene = build(w); sceneKey = w.key; if (sceneChanged && cam.init) { fade = 1; const c = camTarget(); Object.assign(cam, c); }
  }
  // speech: the keeper's mouth moves for a moment after she speaks
  if ((stats.frames & 3) === 0) { const tx = document.querySelector('#bubble .txt'); const s = tx && !document.getElementById('bubble').hidden ? tx.textContent : ''; if (s !== lastTxt) { lastTxt = s; if (s) talkUntil = t + Math.min(2600, 600 + s.length * 40); } }
  updateActors(dt);
  const tg = camTarget();
  if (!cam.init) { Object.assign(cam, tg); cam.init = true; }
  else { const k = Math.min(1, dt * 2.5); for (const p of CAMK) cam[p] += (tg[p] - cam[p]) * k; }
  const top = Math.max(0, v.top || 0), bot = Math.max(top + 120, Math.min(H, v.bottom || H)), bandH = bot - top, mid = (top + bot) / 2;
  let s = Math.min(W / cam.w, bandH / cam.h);
  // a tall band (iPad portrait): zoom in until the world fills the band's height, as long as the part that must stay
  // on screen (the shelves and the door inside; the house, keeper and customer outside) still fits the width
  const keepX = !v.cam || v.cam === 'inside' || v.cam === 'outside' ? TALLX[v.scene === 'inside' ? 'inside' : 'outside'] : null;
  if (keepX) s = Math.max(s, Math.min(bandH / WH, W / (keepX[1] - keepX[0])));
  s = Math.max(s, W / (WW + MX * 2) * .999); // never show past the left/right edge of the world
  let cx = cam.cx, cy = cam.cy;
  // when the band is too small for the whole view, slide so the important part stays in it
  const hb = bandH / 2 / s, hw = W / 2 / s;
  if (cam.y1 - cam.y0 <= hb * 2) cy = Math.max(cam.y1 - hb + 6, Math.min(cam.y0 + hb - 6, cy)); else cy = (cam.y0 + cam.y1) / 2;
  if (cam.x1 - cam.x0 <= hw * 2) cx = Math.max(cam.x1 - hw + 10, Math.min(cam.x0 + hw - 10, cx));
  const halfW = W / 2 / s; cx = Math.max(halfW - MX, Math.min(WW + MX - halfW, cx));
  // a tall band (iPad portrait) can be taller than the whole painted world: sit the world's floor on the panel and let
  // the sky / ceiling colour fill the space above, instead of ending the floor in a flat strip halfway down the screen
  if (WH * s < bandH) cy = WH - (bot - mid) / s;
  const ox = W / 2 - cx * s, oy = mid - cy * s;
  const sc = scene;
  // backdrop for anything outside the world (tall portrait screens)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const edge = sc.inside ? ['#c87a84', '#a87a4e'] : [SKY[sc.time][0], sc.time === 'morning' ? '#5f9a4a' : '#1e3230'];
  const eg = ctx.createLinearGradient(0, 0, 0, H); eg.addColorStop(0, edge[0]); eg.addColorStop(1, edge[1]); ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H);
  if (sc.topC && oy > 0) { ctx.fillStyle = sc.topC; ctx.fillRect(0, 0, W, Math.ceil(oy) + 1); }
  // world layers
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * ox, DPR * oy); ctx.imageSmoothingEnabled = false;
  if (sc.back) { ctx.imageSmoothingEnabled = true; ctx.drawImage(sc.back, -MX, 0); ctx.imageSmoothingEnabled = false; }
  ctx.drawImage(sc.mid, -MX, 0);
  // characters, sorted by depth; the counter sits between the shopkeeper and the customer
  const list = [];
  if (A.keeper) list.push([A.keeper.y, () => drawActor(A.keeper, t)]);
  if (A.cust) list.push([A.cust.y, () => drawActor(A.cust, t)]);
  if (sc.counter) list.push([344, () => { ctx.imageSmoothingEnabled = false; ctx.drawImage(sc.counter, -MX, 0); }]);
  list.sort((a, b) => a[0] - b[0]).forEach(d => d[1]());
  // light: bloom pools, shafts, motes
  ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
  for (const L of sc.lights) {
    let a = L.a; if (L.fl && !RM) a *= .86 + .14 * Math.sin(t / 380 + (L.tw || L.x) * 1.7) * Math.sin(t / 910 + L.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.drawImage(glowStamp(L.c), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.globalCompositeOperation = 'screen';
  sc.shaftC.forEach((k, i) => { ctx.globalAlpha = RM ? .9 : .75 + .25 * Math.sin(t / 2300 + i * 2); ctx.drawImage(k, -MX, 0); });
  if (sc.parts.length) {
    const m = (sc.inside ? null : null) || sc.motes || {}, [r, g, b] = hex2rgb(sc.motes.c), ar = sc.motes.area, gl = glowStamp(sc.motes.c);
    ctx.globalCompositeOperation = 'lighter'; void m;
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
  const px = (cx - WW / 2) * .12;
  ctx.drawImage(sc.fore, -MX - px, 0);
  // colour grade and vignette (screen space)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const gr = GRADE[sc.time];
  if (gr) { ctx.globalCompositeOperation = gr.op; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, gr.a); g.addColorStop(1, gr.b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  if (!vign) vign = makeVignette();
  ctx.drawImage(vign, 0, 0, W, H);
  if (fade > 0) { ctx.fillStyle = `rgba(7,11,24,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); fade -= dt * (RM ? 10 : 2.6); }
  stats.frames++; const ms = performance.now() - t0f; stats.ms = stats.ms ? stats.ms * .95 + ms * .05 : ms;
}
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
window.Shop3D = {
  good: id => bake('g:' + id, 128, (x, s) => GSPR[id] && fit(x, s, GSPR[id], .9)),
  coin: v => bake('c:' + v, 128, (x, s) => { const sp = COINS[v] || COINS[1]; const k = 7; x.drawImage(spriteCanvasOf(sp), Math.round((s - sp.w * k) / 2), Math.round((s - sp.h * k) / 2), sp.w * k, sp.h * k); }),
  portrait: spec => bake('p:' + JSON.stringify(spec), 128, portraitDraw(spec)),
  decor: id => bake('d:' + id, 128, (x, s) => DSPR[id] && fit(x, s, DSPR[id], .92)),
  icon: id => bake('i:' + id, 64, (x, s) => ICONS[id] && fit(x, s, ICONS[id], .95)),
  sprite: (spec, mood) => bake('s:' + JSON.stringify(spec) + mood, 128, (x, s) => { const ch = character(spec, mood || 'idle', 0); const k = Math.floor(s / Math.max(ch.w, ch.h)); x.drawImage(ch.canvas, (s - ch.w * k) / 2, s - ch.h * k, ch.w * k, ch.h * k); }),
};
window.__ts3d = { stats, A, cam, get scene() { return sceneKey; } };

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
