/* The Toadstool Shop, Lantern Tale look: the pixel art.
   Everything here is drawn in code (no image files): characters are built from a species template, a palette taken
   from the game's CAST spec, and small accessory patches, so every friend (and all 20 shopkeeper looks) gets a sprite.
   Exports plain helpers; octo-view.js does the scene and the frame loop. */

/* ---------------------------------------------------------------- colour helpers */
export function hex2rgb(h) {
  h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
export const shade = (c, k) => k < 0 ? mix(c, '#1e1020', -k) : mix(c, '#ffffff', k);
export function rgba(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
export function rng(seed) { let s = seed || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/* ---------------------------------------------------------------- sprites
   A sprite is {w, h, px: [colour|undefined]}; spriteCanvas() turns it into a 1:1 canvas that is drawn scaled
   with smoothing off. */
const OUTLINE = '#2a1a14';
export function makeSprite(rows, pal, opt = {}) {
  rows = typeof rows === 'string' ? rows.split('\n').map(r => r.trim()).filter(Boolean) : rows;
  const w0 = Math.max(...rows.map(r => r.length)), pad = opt.outline === false ? 0 : 1;
  const W = w0 + pad * 2, H = rows.length + pad * 2, px = new Array(W * H);
  rows.forEach((r, y) => { for (let x = 0; x < w0; x++) { const ch = r[x] || '.'; if (ch === '.' || ch === ' ') continue; const c = pal[ch]; if (c) px[(y + pad) * W + x + pad] = c; } });
  return { w: W, h: H, px: pad ? outline(px, W, H, opt.outline || OUTLINE) : px };
}
function outline(px, W, H, col) {
  const out = px.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[y * W + x]) continue;
    if ((x > 0 && px[y * W + x - 1]) || (x < W - 1 && px[y * W + x + 1]) || (y > 0 && px[(y - 1) * W + x]) || (y < H - 1 && px[(y + 1) * W + x])) out[y * W + x] = col;
  }
  return out;
}
export function spriteCanvas(s, flip) {
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  const x = c.getContext('2d'), img = x.createImageData(s.w, s.h), d = img.data;
  for (let i = 0; i < s.px.length; i++) {
    const col = s.px[i]; if (!col) continue;
    const X = flip ? s.w - 1 - (i % s.w) : i % s.w, o = ((i / s.w | 0) * s.w + X) * 4;
    if (col[0] === '#') { const [r, g, b] = hex2rgb(col); d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; }
    else { const m = col.match(/[\d.]+/g); d[o] = +m[0]; d[o + 1] = +m[1]; d[o + 2] = +m[2]; d[o + 3] = Math.round((m[3] == null ? 1 : +m[3]) * 255); }
  }
  x.putImageData(img, 0, 0); return c;
}

/* ---------------------------------------------------------------- 3x5 pixel font (coins, little signs) */
export const FONT = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};
function makeCoin(d, pal, label) {
  const rows = [], r = d / 2, c = (d - 1) / 2;
  for (let y = 0; y < d; y++) {
    let row = '';
    for (let x = 0; x < d; x++) {
      const dx = x - c, dy = y - c, dist = Math.hypot(dx, dy);
      if (dist > r - 0.25) { row += '.'; continue; }
      let ch;
      if (dist > r - 1.3) ch = dx + dy < -1 ? 'L' : dx + dy > 1.5 ? 'D' : 'M';
      else { ch = 'M'; if (dx + dy < -r * .55) ch = 'L'; if (dx + dy > r * .75) ch = 'S'; if (dist > r - 2.3 && dx + dy > 0) ch = 'S'; }
      row += ch;
    }
    rows.push(row.split(''));
  }
  const g = label.split('').map(k => FONT[k]), gw = g.length * 3 + g.length - 1, gx = Math.round((d - gw) / 2), gy = Math.round((d - 5) / 2);
  const on = (X, Y) => g.some((gl, i) => { const a = X - gx - i * 4, b = Y - gy; return a >= 0 && a < 3 && b >= 0 && b < 5 && gl[b][a] === '1'; });
  for (let Y = 0; Y < d; Y++) for (let X = 0; X < d; X++) { if (on(X, Y)) rows[Y][X] = 'D'; else if (rows[Y][X] !== '.' && on(X - 1, Y - 1)) rows[Y][X] = 'H'; }
  return makeSprite(rows.map(r => r.join('')), pal, { outline: pal.O });
}
export const COINS = {
  1: makeCoin(13, { L: '#F2B07A', M: '#CF7E46', S: '#A85C2E', D: '#6E3A1C', H: '#E39A62', O: '#3A1E10' }, '1'),
  5: makeCoin(15, { L: '#F2F2F0', M: '#C4C8CE', S: '#9AA0AA', D: '#555B66', H: '#DCDFE4', O: '#2A2E36' }, '5'),
  10: makeCoin(11, { L: '#FAFAF8', M: '#D2D6DC', S: '#A6ACB6', D: '#4E5460', H: '#E6E8EC', O: '#2A2E36' }, '10'),
  25: makeCoin(17, { L: '#FAFAF8', M: '#C9CCD6', S: '#9AA0AA', D: '#4E5460', H: '#E6E8EC', O: '#2A2E36' }, '25'),
};

/* ---------------------------------------------------------------- goods (1 sprite px = 1 world px on the shelf) */
export const GOODS = {
  bun: makeSprite([
    '.......s......', '......cCc.....', '.....cxcxC....', '......aaA.....', '.....iiiiii...', '...iiwwiiiii..', '..iwwiiiiiiiI.',
    '.iiiiiiiiiiiI.', '.bibbiiibbibB.', 'bbbbbbibbbbbbB', 'bbhbbbbbbbbbBB', 'bbbbbbbbbbbBBB', '.BbbbbbbbbBBB.', '..BBBBBBBBBB..'],
    { s: '#6b4a24', c: '#a8672e', C: '#7a4a20', x: '#c98a4a', a: '#c98a4a', A: '#9a6232', i: '#fff7e6', I: '#e0cfa8', w: '#ffffff', b: '#d99a55', B: '#a8672e', h: '#f0be7a' }),
  apple: makeSprite([
    '.....s......', '.....sll....', '..rrrslLr...', '.rwrrrrrrRR.', 'rwwrrrrrrrRR', 'rwrrrrrrrrRR', 'rrrrrrrrrrRR', 'rrrrrrrrrRRR', '.rrrrrrrRRR.', '.RrrrrrRRRR.', '..RRR.RRRR..'],
    { s: '#5A3A28', l: '#7cc06e', L: '#4E7A2C', r: '#e04a4a', R: '#a02a2e', w: '#ffc8b0' }),
  honey: makeSprite([
    '..rwrwrwrw..', '.rwrwrwrwrw.', '.wrwrwrwrwR.', '..ssssssss..', '...hhhhhh...', '.hhhhhhhhhH.', 'hwhhhhhhhhHH', 'hwlllllllhHH',
    'hwlLLLLLlhHH', 'hhlllllllhHH', 'hhhhhhhhhHHH', 'hhhhhhhhHHHH', '.hhhhhhhHHH.', '..HHHHHHHH..'],
    { r: '#e86a6a', R: '#a83a3a', w: '#fff3e0', s: '#8A6440', h: '#f0a92a', H: '#c47a1c', l: '#fff3e0', L: '#8A6440' }),
  tart: makeSprite([
    '....rb.br.....', '..brbrbrbrbr..', '.cbrbrbrbrbrc.', 'cCcCcCcCcCcCcC', 'ccccccccccccCC', '.cccccccccccC.', '..CCCCCCCCCC..'],
    { r: '#d43d5f', b: '#6a3f8c', c: '#e8b878', C: '#b8844a' }),
  biscuit: makeSprite([
    '...cccccc...', '..cccdccccC.', '.ccccccccdC.', '.cdcccccccC.', 'cccccdccccCC', 'ccccccccdcCC', 'cdccccccccCC', '.ccccdcccCC.', '.cccccccCCC.', '..CcccCCCC..', '...CCCCCC...'],
    { c: '#d9a866', C: '#a8763e', d: '#8a5634' }),
  candle: makeSprite([
    '....y.....', '...yYy....', '...yzy....', '....y.....', '....k.....', '..wwwwv...', '..wwwwv...', '..wwwwv...', '..wwwwv...', '..wwwwv...', '.ssssssss.', 'sssssssssS', '.SSSSSSSS.'],
    { y: '#ffd56b', Y: '#ff9a3a', z: '#ffffff', k: '#3a2a1e', w: '#fff3d6', v: '#dccaa0', s: '#b9a6e8', S: '#8a78c0' }),
  seeds: makeSprite([
    'kkkkkkkkkk', 'qqqqqqqqqQ', 'qqqqfqqqqQ', 'qqqfyfqqqQ', 'qqqqfqqqqQ', 'qqqqgqqqqQ', 'qqqggqqqqQ', 'qqqqgqqqqQ', 'qqqqqqqqqQ', 'qllllllllQ', 'qqqqqqqqqQ', 'QQQQQQQQQQ'],
    { k: '#c9b89a', q: '#e9dcc4', Q: '#bfae8e', f: '#f6a6bd', y: '#ffd86b', g: '#7cb36a', l: '#a08a6a' }),
  teacup: makeSprite([
    '.wwwwwwwww...', 'wtttttttttw..', 'wwwwwwwwwwWhh', 'wwwpwwwpwwW.h', 'wwwwwwwwwwWhh', '.wwwwwwwwWW..', '..WWWWWWWW...', 'sssssssssssss', '.SSSSSSSSSSS.'],
    { w: '#ffffff', W: '#d8d8e4', t: '#b8743a', h: '#f2a7b5', p: '#f2a7b5', s: '#f4f4fa', S: '#c8c8d8' }),
};

/* ---------------------------------------------------------------- little icons (HUD, sparkles, decorations) */
export const ICONS = {
  sparkle: makeSprite(['...w...', '...y...', '..yWy..', 'wyWWWyw', '..yWy..', '...y...', '...w...'], { w: '#D8B46A', y: '#F4E4B4', W: '#FFFFFF' }, { outline: false }),
  star: makeSprite(['....y....', '...yYy...', 'yyyyWyyyy', '.yyWWWyy.', '..yyyyy..', '.yyy.yyy.', '.yy...yy.'], { y: '#F2C75A', Y: '#FFF2C2', W: '#FFFFFF' }),
  heart: makeSprite(['.rrr.rrr.', 'rwwrrrrrR', 'rwrrrrrrR', 'rrrrrrrRR', '.rrrrrRR.', '..rrrRR..', '...rRR...', '....R....'], { r: '#E8566A', R: '#A82E46', w: '#FFD0D6' }),
  jar: makeSprite([
    '...llllllllll...', '...lLlLlLlLlL...', '...LLLLLLLLLL...', '..GggggggggggG..', '.GgwggggggggggG.', 'GgwggggggggggggG', 'GgwggggggggggggG', 'GgwggggggggggggG',
    'GgwgggggggggsggG', 'GggggggggggggggG', 'GggcCgsSggcCgggG', 'GgcCsScCgcCsSccG', 'GcCsScCcCsSscCsG', 'GsScCsScCcCsScCG', 'GcCcCsSsScCcCsSG', 'GsSsScCcCsScCcCG', '.GcCsSsScCcCsSG.', '..GGGGGGGGGGGG..'],
    { l: '#E8C46A', L: '#A07A30', G: '#7FA4AE', g: '#CDE6EA', w: '#FFFFFF', c: '#D9894E', C: '#9A5A2A', s: '#D6DAE0', S: '#9AA0AA' }),
  // HUD and button icons (they replace the base game's emoji: see octo-view.js, "pixel icons for the DOM")
  books: makeSprite([
    '.rr.bb.....', '.rR.bB..gg.', '.rR.bB.gGg.', '.yy.ww.gGg.', '.rR.bB.gGg.', '.rR.bB.gGg.', '.rR.bB.gGg.', '.yy.ww.gGg.', '.rR.bB.gGg.', 'kkkkkkkkkkk'],
    { r: '#e2566b', R: '#a82e46', b: '#5a8fc7', B: '#2e5a8a', g: '#8cc46c', G: '#4e7a34', y: '#f2c75a', w: '#fbf3df', k: '#8a5a3a' }),
  soundOn: makeSprite([
    '.....w.....', '....ww...y.', '...www.y..y', 'gwwwww..y.y', 'gwwwww.y.y.', 'gwwwww.y.y.', 'gwwwww..y.y', '...www.y..y', '....ww...y.', '.....w.....'],
    { w: '#f4e4b4', g: '#d8b46a', y: '#ffe08a' }),
  soundOff: makeSprite([
    '.....w.....', '....ww.....', '...www.....', 'gwwwww.r..r', 'gwwwww..rr.', 'gwwwww..rr.', 'gwwwww.r..r', '...www.....', '....ww.....', '.....w.....'],
    { w: '#a8a294', g: '#8a826e', r: '#e8566a' }),
  gear: makeSprite([
    '....gg....', '.g.gGGg.g.', '.gGGGGGGg.', '..GGkkGG..', 'gGGk..kGGg', 'gGGk..kGGg', '..GGkkGG..', '.gGGGGGGg.', '.g.gGGg.g.', '....gg....'],
    { g: '#d8b46a', G: '#a8a8bc', k: '#5a5a70' }),
  hand: makeSprite([
    '...ss.....', '..sSSs....', '..sSSs....', '..sSSsss..', '..sSSsSSs.', 'sssSSSSSSs', 'sSSSSSSSSs', 'sSSSSSSSSs', '.sSSSSSSs.', '..sSSSSs..', '..cccccc..'],
    { s: '#e0a87a', S: '#fbd8b8', c: '#5a8fc7' }),
  moon: makeSprite([
    '...yyyy..', '..yYYy...', '.yYYy....', 'yYYy.....', 'yYYy.....', 'yYYy.....', '.yYYy....', '..yYYyy..', '...yyyy..'],
    { y: '#d8b46a', Y: '#fff2c2' }),
  notebook: makeSprite([
    'kbbbbbbbb.', 'kbwwwwwwb.', 'kbwllllwb.', 'kbwwwwwwb.', 'kbwllllwb.', 'kbwwwwwwb.', 'kbwlllwwb.', 'kbwwwwwwb.', 'kbbbbbbbb.'],
    { k: '#8a5a3a', b: '#c98a5a', w: '#fbf3df', l: '#8aa0c0' }),
  anchor: makeSprite([
    '...ggg...', '...g.g...', '...ggg...', '.ggggggg.', '....g....', '....g....', 'g...g...g', 'gg..g..gg', '.gg.g.gg.', '..ggggg..'],
    { g: '#a8c4e0' }),
  think: makeSprite(['..wwwwwww..', '.wwwwwwwww.', 'wwdwwdwwdww', '.wwwwwwwww.', '..wwwwwww..', '...........', '.....ww....', '.......w...'], { w: '#FFFDF2', d: '#5a4a6a' }),
};

// Decorations bought with the savings jar: a 16 px icon each (the panel tiles), drawn bigger in the scene.
export const DECOR = {
  sign: makeSprite([
    '................', '.bbbbbbbbbbbbbb.', '.bccccccccccccb.', '.bcrrrcrrrrrccb.', '.bccccccccccccb.', '.bccrrrrcrrrccb.', '.bccccccccccccb.', '.bbbbbbbbbbbbbb.',
    '.......pP.......', '.......pP.......', '.......pP.......', '.......pP.......', '......gpPg......', '.....gggggg.....'],
    { b: '#c98a5a', c: '#fff3dc', r: '#7a3d2a', p: '#8a5a3a', P: '#5a3a28', g: '#7cb36a' }),
  vase: makeSprite([
    '..pp....yy......', '.pPPp..yYYy..ww.', '.pPPp..yYYy.wWWw', '..pp.g..yy..wWWw', '...g.g..g....ww.', '....ggg.g..gg...', '.....gggggg.....', '.....bbbbbb.....',
    '....bbwbbbbB....', '...bbwbbbbbbB...', '...bwbbbbbbbB...', '...bbbbbbbbbB...', '....bbbbbbBB....', '.....BBBBBB.....'],
    { p: '#f6a6bd', P: '#e2668b', y: '#ffd86b', Y: '#f0a92a', w: '#ffffff', W: '#e8e8f0', g: '#6aa860', b: '#7bb4d9', B: '#4a84a9' }),
  awning: makeSprite([
    'rrwwrrwwrrwwrrww', 'rrwwrrwwrrwwrrww', 'RrWwRrWwRrWwRrWw', 'rrwwrrwwrrwwrrww', 'rrwwrrwwrrwwrrww', '.rr..ww..rr..ww.', '..r...w...r...w.', '.p............p.',
    '.p............p.', '.p............p.', '.p............p.', '.p............p.'],
    { r: '#e2566b', R: '#b83a50', w: '#fff3e6', W: '#e0cfc0', p: '#8a5a3a' }),
  rug: makeSprite([
    '....rrrrrrrr....', '..rryyyyyyyyrr..', '.ryybbbbbbbbyyr.', 'rybbppppppppbbyr', 'rybpppppppppbyr.', 'rybbppppppppbbyr', '.ryybbbbbbbbyyr.', '..rryyyyyyyyrr..', '....rrrrrrrr....'],
    { r: '#e2566b', y: '#ffd86b', b: '#7bb4d9', p: '#f6a6bd' }),
  windowboxes: makeSprite([
    '.p..y..p..w..y..', 'pPp.yYypPpwWwyYy', '.p.g.y..pg.w..y.', '.g.g.g.g.g.g.gg.', 'bbbbbbbbbbbbbbbb', 'bwbbbbbbbbbbbbbB', 'bbbbbbbbbbbbbbBB', '.BBBBBBBBBBBBBB.'],
    { p: '#f6a6bd', P: '#e2668b', y: '#ffd86b', Y: '#f0a92a', w: '#ffffff', W: '#d8d8e8', g: '#6aa860', b: '#7bb4d9', B: '#4a84a9' }),
  bell: makeSprite([
    'kkkkkkkk........', '......k.........', '......k.........', '.....yyy........', '....yyyyY.......', '....ywyyY.......', '...yywyyyY......', '...yyyyyyY......', '..yyyyyyyYY.....', '.YYYYYYYYYYY....', '......c.........'],
    { k: '#5a3a28', y: '#f2c75a', Y: '#b8862a', w: '#fff3c0', c: '#8a6a2a' }),
  lanterns: makeSprite([
    '......kk........', '.....kkkk.......', '....rrrrrr......', '....ryyyyr......', '....ryWWyr......', '....ryWWyr......', '....ryyyyr......', '....rrrrrr......', '......pp........',
    '......pp........', '......pp........', '......pp........', '......pp........', '.....pPPp.......'],
    { k: '#3a2a20', r: '#8a5a3a', y: '#ffe6a0', W: '#ffffff', p: '#6b4a33', P: '#4a3222' }),
  bunting: makeSprite([
    'kkkkkkkkkkkkkkkk', 'rrr.yyy.bbb.ggg.', 'rrr.yyy.bbb.ggg.', '.r...y...b...g..', '................', '.kkkkkkkkkkkk...', '.lll.rrr.yyy....', '.lll.rrr.yyy....', '..l...r...y.....'],
    { k: '#8a6a4a', r: '#e2566b', y: '#ffd86b', b: '#7bb4d9', g: '#8cc46c', l: '#c9b6f0' }),
  catbed: makeSprite([
    '...o...o........', '...oo.oo........', '..oooooo........', '..oeoeoooooo....', '..ooonoooOoooo..', '...ooooOoooOooo.', '.ll.oooooooooo.l', 'lwlllllllllllllL', 'lLLLLLLLLLLLLLLL', '.LLLLLLLLLLLLLL.'],
    { o: '#f0b46a', O: '#c8843a', e: '#5a3a28', n: '#e07c8a', l: '#b9a6e8', L: '#8a78c0', w: '#e0d4ff' }),
  fairylights: makeSprite([
    'k..............k', '.k............k.', '.yk..........kb.', '.yyk........kbb.', '...kk..pp..kk...', '..mm.kkppkk.yy..', '..mm...kk...yy..', '......bb........', '......bb........'],
    { k: '#4a5a3a', y: '#ffe680', b: '#a0d8ff', p: '#ffb0d0', m: '#b0ffd0' }),
};

/* ---------------------------------------------------------------- characters
   Templates use these letters: f F D fur (light, shade, dark), p P inner ear, e eye, w eye shine, n nose, b blush,
   m mouth, r R body (the dress, or fur when there is none), o dress dots, a A apron, bib or tummy, s shoes, t tail,
   k feet, l L hedgehog/rabbit body, h hands, S/s/D spikes, c C owl tummy, g owl eye ring, y Y beak or crown, H hair. */
const T = {};
T.mouse = {
  rows: [
    '.FFFF..........FFFF.', 'fFppFF........FFppFd', 'FpPPpF........FpPPpd', 'FpPPpFffffffffFFpPPpd'.slice(0, 20), 'FFppFfffffffffffFppFd'.slice(0, 20), '.FFFfffffffffffffFFd.'.slice(0, 20),
    '...ffffffffffffffF..', '..ffffffffffffffFF..', '..ffffffffffffffFF..', '..ffffweffffweffFF..', '..ffffeeffffeeffFF..', '..ffbbfffnnfffbbFF..',
    '...ffffffmmffffFF...', '.....ffffffffFd.....', '......RrraarrR......', '....rrrraaaarrrR....', '...rrorraaaarrorR...', '...rrrraaaaaarrRR...',
    '...rRrraaaaaaArRR...', '...rRoraaaaaaArRR...', '...hhrraaaaaaArhd...', '....rraaaaaaaArR..t.', '...rorraaaaaaArrR..t', '...rrraaaaaaaArorR.t'.slice(0, 20),
    '..rrrrAaaaaaaArrRRt.', '..rrrorrrrrrrrorRR..', '...RRRRRRRRRRRRRR...', '......ff....FF......', '.....sss....sss.....'],
  eyes: [[6, 9], [12, 9]], top: 6, neck: 13, cx: 10, breath: 17, bow: [14, 4], earTop: 0,
};
T.cat = {
  rows: ['....................', '....................', '...F............F...', '..FpF..........FpF..', '..fpPF........FPpf..', '.ffpPfffffffffFPpff.'].concat(T.mouse.rows.slice(6)),
  eyes: [[6, 9], [12, 9]], top: 6, neck: 13, cx: 10, breath: 17, bow: [14, 4], earTop: 2,
};
T.hedgehog = {
  rows: [
    '............s..s......', '...s.sSsSs.sSs.sSs.s..', '...sSSSSSSSSSSSSSSSSs..'.slice(0, 22), '.s.sSSSSSSSSSSSSSSSDs.', 'ssSSSSSSffffffffSSDDDs', '.sSSSSSffffffffffSDDs.',
    'ssSSSSffffffffffffDDDs', '.sSSSSffweffffweffFDDs', 'ssSSSSffeeffffeeffFDDD', '.sSSSSfbbffnnffbbfFDDs', '..sSSSSffffmmffffFDDs.', '...sSSSSffffffffFDDs..',
    '......SSlllaalllDD....', '.....SllllllllllLLD...', '....hllllllllllllLLh..', '....hllllllllllllLLh..', '.....llllllllllllLL...', '....lllllllllllllLLL..',
    '....LLLLLLLLLLLLLLLL..', '......kkk......kkk....'],
  eyes: [[8, 7], [14, 7]], top: 3, neck: 11, cx: 11, breath: 15, bow: [15, 1], earTop: 0,
};
T.rabbit = {
  rows: [
    '.......fF.....fF.......', '.......fpF....fpF......', '.......fpF....fpF......', '.......fpF....fpF......', '.......fpF....fpF......', '.......fpF....fpF......',
    '......ffpFF..ffpFF.....', '.....ffffffffffffFF....', '....ffffffffffffffFF...', '...fffffffffffffffFFF..', '...ffffweffffffweffFF..', '...ffffeeffffffeeffFF..',
    '...ffbbfffnnfffbbfFFF..', '....ffffffmmffffFFF....', '......ffffffffFFF......', '........rrrrr..........', '......rraaaaaaRR.......', '.....rrrraaarrrrR......',
    '....frrrraaaarrrRF.....', '....rrrraaaaaarrRR.....', '....rRrraaaaaaarRRR....', '....frrraaaaaaarrRF....', '...rrrrraaaaaaarrRRR...', '...rrrrraaaaaaAArRRR...',
    '..rrrrrrrAAAAAArrRRRR..', '..RRRRRRRRRRRRRRRRRRRR.', '.......kk......kk......'],
  eyes: [[7, 10], [15, 10]], top: 7, neck: 15, cx: 11, breath: 19, bow: [16, 6], earTop: 0,
};
T.owl = {
  rows: [
    '..Bb............bB..', '..bbB..........Bbb..', '..bbbbbbbbbbbbbbbB..', '.bbbbbbbbbbbbbbbbbB.', '.bbggggbbbbbbggggbB.', '.bgccccgbbbbgccccgB.', '.bgcwecgbggbgcwecgB.',
    '.bgceecgbbbbgceecgB.', '.bbggggbbyybbggggbB.', '.bbbbbbbbYYbbbbbbbB.', 'bbbbbccccccccccbbbBB', 'bbbbcCcccCcccCccbbBB', 'Bbbbccccccccccccbbbb', 'BbbbcccCcccCcccCbbBB',
    '.BbbccccccccccccbbB.', '.BBbbccccccccccbbBB.', '..BBbbbccccccbbbBB..', '...BBBbbbbbbbbBBB...', '.....ttt....ttt.....'],
  eyes: [[4, 6], [14, 6]], top: 2, neck: 9, cx: 10, breath: 12, bow: [15, 1], earTop: 0, ring: 1,
};
T.fairy = {
  rows: [
    '.........y..y..y.........', '.........yYyyyYy.........', '........HhhhhhhhH........', '.......HhhhhhhhhhH.......', '......HhhffffffffhhH.....', '......hhffffffffffhH.....',
    '......hhfweffffwefhH.....', '......hhfeeffffeefhH.....', '......hhfbffnnffbfhH.....', '......Hhhfffmmfffhhh.....', '.......Hhhffffffhhh......', 'gg.......hhffffhh.....gg.',
    'gGg.......aaaaa.....gGgg.', 'gGGg.....raaaaar....gGGg.', '.gGGg...rrraaarrr..gGGg..', '.gGGGgfrrrrarrrrrfgGGGg..', '..gGGgf.rrrrrrrrr.fgGGg.y', '..gGGg..rrrrrrrrr..gGg.yYy',
    '...gg..rrrrrrrrrrR..gg..y.', '.......rrrrrrrrrrRR....k..', '......rrrrrrrrrrrRR...k...', '......rrrraaaarrrRRR.k....', '.....rrraaaaaaaarRRR......', '.....aaaaaaaaaaaaaaa......',
    '.......ff.......FF........', '......sss......sss........'],
  eyes: [[9, 6], [15, 6]], top: 2, neck: 11, cx: 12, breath: 21, bow: [16, 2], earTop: 0,
};

for (const k in T) { const w = Math.max(...T[k].rows.map(r => r.length)); T[k].rows = T[k].rows.map(r => r.padEnd(w, '.')); }
const PAD_T = 5, PAD_X = 3;
function palette(spec) {
  const sp = spec.species, fur = spec.fur || '#b9ada3', F = shade(fur, -.18), D = shade(fur, -.36);
  const belly = spec.belly || shade(fur, .32), dress = spec.dress;
  const body = dress || fur, bodyS = dress ? shade(dress, -.22) : F;
  const bib = spec.apron ? '#fffaf0' : dress ? (spec.dress2 || '#fff3e6') : belly;
  const p = {
    f: fur, F, D, p: '#F2A9A6', P: '#D9787C', e: '#1E1418', w: '#FFFFFF', n: sp === 'hedgehog' ? '#2a1a1a' : '#D9606E', b: '#F4A493', m: F,
    r: body, R: bodyS, o: dress ? shade(dress, .4) : body, a: bib, A: shade(bib, -.14), s: '#5A3A28', t: sp === 'cat' ? F : '#E59A98', k: '#3A2A1E',
    l: body, L: bodyS, h: shade(fur, -.08),
  };
  if (sp === 'hedgehog') { const sk = spec.spikes || '#6b4a33'; Object.assign(p, { s: shade(sk, .2), S: sk, D: shade(sk, -.3), l: dress || belly, L: dress ? shade(dress, -.22) : shade(belly, -.14), a: spec.dress2 || shade(belly, .3), h: shade(fur, -.1) }); }
  if (sp === 'rabbit') Object.assign(p, { a: dress ? (spec.dress2 || '#fff3e6') : belly, A: shade(dress ? (spec.dress2 || '#fff3e6') : belly, -.12), f: fur });
  if (sp === 'owl') Object.assign(p, { b: fur, B: shade(fur, -.32), c: belly, C: shade(belly, -.16), g: '#E8C46A', y: '#F2A93B', Y: '#B87418', t: '#E89A3A' });
  if (sp === 'cat') Object.assign(p, { n: '#E07C8A', p: '#F2A9A6' });
  if (sp === 'fairy') {
    const hair = spec.hair || '#f2d27a', dr = spec.dress || '#d4c4ff';
    Object.assign(p, { y: '#F2C75A', Y: '#B8862A', h: hair, H: shade(hair, -.25), f: '#F6D8C4', F: '#E2B8A0', r: dr, R: shade(dr, -.2), a: spec.dress2 || '#fff3cf', g: 'rgba(255,240,180,0.85)', G: spec.wing === 'gold' ? '#F2C75A' : '#cfe8ff', m: '#E2B8A0', k: '#B8862A', s: '#F2C75A', n: '#E2A090' });
  }
  return p;
}

// The shopkeeper's dress fabric (her wardrobe's "print") drawn over the dress pixels, and no apron when she takes it off.
function dressUp(spec, g, kind, pal, put, kindAt, tw, th) {
  const pr = spec.print || 'flowers', light = shade(pal.r, .45);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    let k = kindAt(x, y);
    if (spec.apron === false && (k === 'a' || k === 'A')) { put(x, y, k === 'A' ? pal.R : pal.r); k = 'r'; }
    if (k !== 'r' && k !== 'R' && k !== 'o') continue;
    const base = k === 'R' ? pal.R : pal.r;
    let c = base;
    if (pr === 'flowers') c = k === 'o' ? pal.o : base;
    else if (pr === 'dots') c = k === 'o' ? '#FFFFFF' : base;
    else if (pr === 'stripes') c = x % 3 === 0 ? (k === 'R' ? shade(light, -.12) : light) : base;
    else if (pr === 'gingham') c = x % 2 && y % 2 ? shade(base, -.08) : x % 2 || y % 2 ? shade(base, .22) : shade(base, .45);
    else if (pr === 'hearts') c = k === 'o' ? '#E2566B' : base;
    else if (pr === 'stars') c = k === 'o' ? '#FFF3A8' : base;
    put(x, y, c);
  }
}

// Builds a pixel grid (array of rows of colours) for a spec and mood.
function grid(spec, mood) {
  const t = T[spec.species] || T.mouse, pal = palette(spec);
  const W = t.rows[0].length + PAD_X * 2, H = t.rows.length + PAD_T;
  const g = Array.from({ length: H }, () => new Array(W).fill(null)), kind = Array.from({ length: H }, () => new Array(W).fill(''));
  t.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.' || !pal[ch]) continue; g[y + PAD_T][x + PAD_X] = pal[ch]; kind[y + PAD_T][x + PAD_X] = ch; } });
  const put = (x, y, c) => { x += PAD_X; y += PAD_T; if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c; };
  const has = (x, y) => { x += PAD_X; y += PAD_T; return y >= 0 && y < H && x >= 0 && x < W && !!g[y][x]; };
  const kindAt = (x, y) => kind[y + PAD_T] && kind[y + PAD_T][x + PAD_X];
  const tw = t.rows[0].length, [e1, e2] = t.eyes, cx = t.cx, top = t.top, neck = t.neck;
  const acc = spec.acc || [];
  // floppy ear: fold the right ear over
  if (spec.flop && spec.species === 'rabbit') {
    for (let y = 0; y < 7; y++) for (let x = 13; x < tw; x++) if ('fFp'.includes(kindAt(x, y) || '-')) { g[y + PAD_T][x + PAD_X] = null; }
    const ear = [[15, 6], [16, 6], [17, 6], [16, 7], [17, 7], [18, 7], [18, 8], [19, 8], [19, 9], [20, 9], [20, 10]];
    ear.forEach(([x, y], i) => put(x, y, i % 3 === 1 ? pal.p : pal.F));
  }
  // the shopkeeper's wardrobe: dress fabric, and the apron can come off
  if (spec.keeper) dressUp(spec, g, kind, pal, put, kindAt, tw, t.rows.length);
  // mood: eyes and mouth
  for (const [ex, ey] of t.eyes) {
    if (mood === 'happy') { put(ex, ey, pal.f); put(ex + 1, ey, pal.f); put(ex, ey + 1, '#1E1418'); put(ex + 1, ey + 1, '#1E1418'); if (spec.species === 'owl') { put(ex, ey, pal.c); put(ex + 1, ey, pal.c); } }
    if (mood === 'blink') { put(ex, ey, spec.species === 'owl' ? pal.c : pal.f); put(ex + 1, ey, spec.species === 'owl' ? pal.c : pal.f); put(ex, ey + 1, '#1E1418'); put(ex + 1, ey + 1, '#1E1418'); }
  }
  if (mood === 'talk') for (let y = 0; y < t.rows.length; y++) for (let x = 0; x < tw; x++) if (kindAt(x, y) === 'm') put(x, y, '#7a2a3a');
  if (mood === 'talk' && spec.species === 'owl') { put(cx - 1, 9, '#7a3a10'); put(cx, 9, '#7a3a10'); }
  // accessories
  const headRow = y => { let a = -1, b = -1; for (let x = 0; x < tw; x++) if (has(x, y) && !'pP'.includes(kindAt(x, y))) { if (a < 0) a = x; b = x; } return [a, b]; };
  if (acc.includes('scarf')) {
    const c = spec.scarf || '#e2566b', c2 = shade(c, -.2);
    for (const [dy, col] of [[0, c], [1, c2]]) { const [a, b] = headRow(neck + dy); if (a >= 0) for (let x = a + 1; x < b; x++) put(x, neck + dy, (x + dy) % 3 ? col : shade(col, .15)); }
    for (let y = neck + 2; y < neck + 6; y++) { put(cx + 3, y, c); put(cx + 4, y, c2); }
    put(cx + 3, neck + 6, shade(c, .2)); put(cx + 4, neck + 6, shade(c, .2));
  }
  if (acc.includes('collar')) {
    for (const dy of [0, 1]) { const [a, b] = headRow(neck + dy); if (a >= 0) for (let x = a; x <= b; x++) put(x, neck + dy, dy ? ((x % 2) ? '#3a7bd5' : '#F2C75A') : '#E8B84A'); }
    put(cx - 1, neck + 2, '#3a7bd5'); put(cx, neck + 2, '#F2C75A'); put(cx + 1, neck + 2, '#3a7bd5');
  }
  if (acc.includes('glasses')) {
    const gc = '#C9A23A', gl = 'rgba(200,230,255,0.35)';
    for (const [ex, ey] of t.eyes) {
      for (let x = ex - 1; x <= ex + 2; x++) { put(x, ey - 1, gc); put(x, ey + 2, gc); }
      put(ex - 1, ey, gc); put(ex - 1, ey + 1, gc); put(ex + 2, ey, gc); put(ex + 2, ey + 1, gc);
    }
    for (let x = e1[0] + 3; x <= e2[0] - 2; x++) put(x, e1[1], gc);
    void gl;
  }
  if (acc.includes('eyepatch')) {
    const [ex, ey] = e2;
    for (let x = ex - 1; x <= ex + 2; x++) for (let y = ey - 1; y <= ey + 2; y++) put(x, y, (x === ex - 1 || x === ex + 2) && (y === ey - 1 || y === ey + 2) ? null : '#1a1418');
    for (let i = 1; i < 7; i++) put(ex - 1 - i, ey - 1 - Math.round(i * .45), '#1a1418');
  }
  if (acc.includes('bonnet')) {
    const c = spec.bonnet || '#f1d48a', c2 = shade(c, -.2), rib = '#f08aa8';
    for (let y = top - 2; y <= e1[1] - 2; y++) { const [a, b] = headRow(y); if (a < 0) continue; for (let x = a - 1; x <= b + 1; x++) if (!'pP'.includes(kindAt(x, y) || '')) put(x, y, (y === top - 2) ? c2 : y === top ? rib : c); }
    for (let y = e1[1] - 1; y <= e1[1] + 3; y++) { const [a, b] = headRow(y); if (a < 0) continue; put(a - 1, y, c2); put(a, y, c); put(b, y, c); put(b + 1, y, c2); }
    const [, b] = headRow(top); put(b - 1, top, rib); put(b, top - 1, rib); put(b + 1, top, rib); put(b, top + 1, rib); put(b, top, '#fff6a0');
    put(cx - 1, neck, rib); put(cx, neck, shade(rib, -.2)); put(cx + 1, neck, rib); put(cx - 2, neck + 1, rib); put(cx + 2, neck + 1, rib);
  }
  if (acc.includes('bow')) {
    const c = spec.bowColor || '#f6a6bd', c2 = shade(c, -.25), [bx, by] = t.bow;
    [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1], [3, 1], [4, 0], [4, 1], [4, 2]].forEach(([x, y]) => put(bx + x, by + y, c));
    put(bx + 2, by + 1, c2); put(bx + 1, by + 2, c2); put(bx + 3, by + 2, c2);
  }
  if (acc.includes('sailor')) {
    for (let x = cx - 6; x <= cx + 5; x++) { put(x, top - 1, '#3a6fb0'); put(x, top - 2, '#ffffff'); }
    for (let x = cx - 5; x <= cx + 4; x++) put(x, top - 3, '#f4f4fa');
    for (let x = cx - 3; x <= cx + 2; x++) put(x, top - 4, '#e8e8f0');
    put(cx, top - 5, '#e2566b'); put(cx - 1, top - 5, '#e2566b');
  }
  if (acc.includes('tricorn')) {
    const k = '#2e2a3a', k2 = '#4a4560', gd = '#F2C75A';
    for (let x = cx - 8; x <= cx + 7; x++) put(x, top - 1, k);
    for (let x = cx - 7; x <= cx + 6; x++) put(x, top - 2, k2);
    for (let x = cx - 5; x <= cx + 4; x++) put(x, top - 3, k);
    for (let x = cx - 3; x <= cx + 2; x++) put(x, top - 4, k);
    put(cx - 8, top - 2, gd); put(cx + 7, top - 2, gd); put(cx - 1, top - 4, gd);
    put(cx, top - 3, '#ffffff'); put(cx + 1, top - 3, '#ffffff'); put(cx, top - 2, '#ffffff');
  }
  if (acc.includes('sunhat')) {
    const st = '#E6C27A', st2 = '#B8904A', st3 = '#F4DCA0', rib = '#F58FB1';
    for (let x = cx - 9; x <= cx + 8; x++) put(x, top - 1, x === cx - 9 || x === cx + 8 ? st2 : (x % 2 ? st : st3));
    for (let x = cx - 8; x <= cx + 7; x++) put(x, top, st2);
    for (let x = cx - 4; x <= cx + 3; x++) { put(x, top - 2, rib); put(x, top - 3, x % 2 ? st : st3); }
    for (let x = cx - 3; x <= cx + 2; x++) put(x, top - 4, st);
    put(cx - 4, top - 2, shade(rib, -.2)); put(cx + 3, top - 2, shade(rib, -.2));
    put(cx + 3, top - 3, '#ffffff'); put(cx + 4, top - 2, '#ffffff'); put(cx + 2, top - 2, '#ffffff'); put(cx + 3, top - 1, '#ffffff'); put(cx + 3, top - 2, '#F2C75A');
  }
  if (acc.includes('flowercrown')) {
    const cols = ['#F6A6BD', '#FFD86B', '#FFFFFF', '#C9B6F0'], gr = '#7CB36A', [a, b] = headRow(top + 1);
    for (let x = a; x <= b; x++) put(x, top, gr);
    for (let x = a, i = 0; x <= b; x += 3, i++) { const c = cols[i % cols.length]; put(x, top - 1, c); put(x + 1, top - 1, c); put(x, top, c); put(x + 1, top, shade(c, -.15)); put(x + 1, top - 2, c); }
  }
  if (acc.includes('tiara')) {
    const gd = '#F2C75A', gd2 = '#B8862A', jw = '#F2A7B5';
    for (let x = cx - 5; x <= cx + 4; x++) put(x, top - 1, x % 2 ? gd : gd2);
    for (const x of [cx - 5, cx - 3, cx + 2, cx + 4]) put(x, top - 2, gd);
    put(cx - 1, top - 2, gd); put(cx, top - 2, gd); put(cx - 1, top - 3, gd); put(cx, top - 3, gd); put(cx - 1, top - 4, '#FFF6A0');
    put(cx - 1, top - 1, jw); put(cx, top - 1, jw); put(cx - 4, top - 1, jw); put(cx + 3, top - 1, jw);
  }
  if (acc.includes('pearls')) {
    const pw = '#FBF3EA', ps = '#D8CCC0', [a, b] = headRow(neck);
    if (a >= 0) for (let x = a + 1; x < b; x++) put(x, neck, x % 2 ? pw : ps);
    put(cx - 2, neck + 1, pw); put(cx + 1, neck + 1, pw); put(cx - 1, neck + 2, pw); put(cx, neck + 2, '#F58FB1');
  }
  if (acc.includes('wings')) {
    const wl = 'rgba(214,236,255,0.9)', we = '#F2C75A', wi = 'rgba(255,255,255,0.95)';
    const UP = [[-3, 0], [-3, 1], [-2, 1], [-3, 2], [-2, 2], [-1, 2], [-3, 3], [-2, 3], [-1, 3], [0, 3], [-2, 4], [-1, 4], [0, 4], [1, 4]];
    const LO = [[-1, 6], [0, 6], [1, 6], [-2, 7], [-1, 7], [0, 7], [-2, 8], [-1, 8]];
    for (const [dx, dy] of UP.concat(LO)) for (const side of [-1, 1]) {
      const x = side < 0 ? 2 + dx : tw - 3 - dx, y = neck + 1 + dy;
      if (!has(x, y)) put(x, y, (dx === -3 || dy === 8 || (dy === 0)) ? we : (dx + dy) % 3 ? wl : wi);
    }
  }
  if (acc.includes('leaves')) {
    const gr = '#7cb36a', gd = '#4f8a44', [a, b] = headRow(top + 1);
    for (let x = a; x <= b; x++) put(x, top, (x % 2) ? gr : gd);
    for (let x = a; x <= b; x += 2) { put(x, top - 1, gr); }
    put(a - 1, top + 1, gr); put(b + 1, top + 1, gr);
  }
  return g;
}

function gridSprite(g) {
  const H = g.length, W = g[0].length, px = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.push(g[y][x] || undefined);
  return { w: W + 2, h: H + 2, px: outline(pad1(px, W, H), W + 2, H + 2, OUTLINE) };
}
function pad1(px, W, H) { const o = new Array((W + 2) * (H + 2)); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[(y + 1) * (W + 2) + x + 1] = px[y * W + x]; return o; }
function breathe(g, row) { const r = row + PAD_T, out = g.slice(); out.splice(r, 1); out.unshift(new Array(g[0].length).fill(null)); return out; }

const CH = new Map();
// character(spec, {mood, breath}) -> {canvas, w, h}  (1 canvas px = 1 sprite px; feet at the bottom centre)
export function character(spec, mood = 'idle', breath = 0) {
  const m = mood === 'happy' || mood === 'talk' || mood === 'blink' ? mood : 'idle';
  const key = JSON.stringify(spec) + '|' + m + '|' + breath;
  let c = CH.get(key);
  if (!c) {
    let g = grid(spec, m);
    if (breath) g = breathe(g, (T[spec.species] || T.mouse).breath);
    const s = gridSprite(g); c = { canvas: spriteCanvas(s), w: s.w, h: s.h, headH: (T[spec.species] || T.mouse).neck + PAD_T + 4 };
    if (CH.size > 400) CH.clear();
    CH.set(key, c);
  }
  return c;
}

const SP = new Map();
export function spriteCanvasOf(s) { let c = SP.get(s); if (!c) { c = spriteCanvas(s); SP.set(s, c); } return c; }
