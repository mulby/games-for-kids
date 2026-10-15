/* ==========================================================================
   The Toadstool Shop, pixel edition: sprite art. Exposes window.SDV.
   Started from the Stardew-style mockup kit (sdv.js); every sprite, tile and
   portrait is drawn from string pixel maps or small painting code. No images.
   One art pixel is one canvas pixel here; the view scales by whole numbers.
   ========================================================================== */
(function () {
  'use strict';
  if (window.SDV && window.SDV.__ready) return;
  var SDV = window.SDV = { __ready: true };
  var PX = SDV.PX = 4;
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  SDV.reducedMotion = !!mq.matches;

  /* ---------------- colour helpers ---------------- */
  function parse(c) {
    if (!c) return null;
    if (c[0] === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16), c.length > 7 ? parseInt(c.substr(7, 2), 16) : 255];
    }
    return [0, 0, 0, 255];
  }
  function toHex(r) { return '#' + r.slice(0, 3).map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var A = parse(a), B = parse(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  SDV.mix = mix;
  var OUTLINE_INK = '#2A1206';
  function outlineOf(c) { return mix(c, OUTLINE_INK, 0.72); }

  /* seeded rng */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function hash2(x, y, k) { var h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  SDV.rng = rng;

  /* ---------------- pixel grid (painter) ---------------- */
  function Grid(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  Grid.prototype = {
    get: function (x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.d[y * this.w + x]; },
    px: function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this; this.d[y * this.w + x] = c; return this; },
    rect: function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c); return this; },
    hline: function (x, y, w, c) { return this.rect(x, y, w, 1, c); },
    vline: function (x, y, h, c) { return this.rect(x, y, 1, h, c); },
    /* filled pixel ellipse centred on (cx,cy) in pixel-centre space */
    ellipse: function (cx, cy, rx, ry, c, test) {
      for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
        for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1.0 && (!test || test(x, y))) this.px(x, y, c);
        }
      return this;
    },
    /* only paint where something is already painted (for shading inside a shape) */
    ellipseIn: function (cx, cy, rx, ry, c) { var g = this; return this.ellipse(cx, cy, rx, ry, c, function (x, y) { return g.get(x, y) !== null; }); },
    rectIn: function (x0, y0, w, h, c) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) if (this.get(x, y) !== null) this.px(x, y, c); return this; },
    line: function (x0, y0, x1, y1, c) {
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
      for (; ;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
      return this;
    },
    /* stamp a string map; '.' and ' ' are transparent */
    map: function (x, y, rows, pal) {
      for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
        var ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
        var c = pal[ch]; if (c === undefined) continue; this.px(x + i, y + j, c);
      }
      return this;
    },
    replace: function (from, to) { for (var i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to; return this; },
    /* outline: colour string, or 'auto' = darkened neighbour colour (selective outline, Stardew style) */
    outline: function (col, diag) {
      var add = [], w = this.w, h = this.h;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        if (this.get(x, y) !== null) continue;
        var n = this.get(x, y + 1) || this.get(x, y - 1) || this.get(x - 1, y) || this.get(x + 1, y);
        if (!n && diag) n = this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1);
        if (n) add.push([x, y, col === 'auto' ? outlineOf(n) : col]);
      }
      for (var k = 0; k < add.length; k++) this.px(add[k][0], add[k][1], add[k][2]);
      return this;
    },
    /* darken the existing pixels' edge on bottom/right (cheap form shading) */
    clone: function () { var g = new Grid(this.w, this.h); g.d = this.d.slice(); return g; },
    flipX: function () { var g = new Grid(this.w, this.h); for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) g.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)]; return g; },
    shiftRows: function (y0, y1, dy) { /* move rows y0..y1 by dy (down positive) */
      var g = this.clone();
      for (var y = y0; y <= y1; y++) for (var x = 0; x < this.w; x++) g.px(x, y, null);
      for (y = y0; y <= y1; y++) for (x = 0; x < this.w; x++) { var c = this.get(x, y); if (c) g.px(x, y + dy, c); }
      return g;
    },
    draw: function (g2, ox, oy) { for (var y = 0; y < g2.h; y++) for (var x = 0; x < g2.w; x++) { var c = g2.d[y * g2.w + x]; if (c) this.px(ox + x, oy + y, c); } return this; },
    toCanvas: function () {
      var cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
      var ctx = cv.getContext('2d'), im = ctx.createImageData(this.w, this.h);
      for (var i = 0; i < this.d.length; i++) { var c = this.d[i]; if (!c) continue; var p = parse(c); im.data[i * 4] = p[0]; im.data[i * 4 + 1] = p[1]; im.data[i * 4 + 2] = p[2]; im.data[i * 4 + 3] = p[3]; }
      ctx.putImageData(im, 0, 0); return cv;
    }
  };
  SDV.Grid = Grid;

  /* ---------------- sprite registry ---------------- */
  var DEFS = SDV._defs = {};
  var CACHE = {};

  function rowsToGrid(rows, pal, mirror) {
    var full = rows.map(function (r) {
      if (mirror === true) return r + r.split('').reverse().join('');
      if (mirror === 'odd') return r + r.slice(0, -1).split('').reverse().join('');
      return r;
    });
    var w = Math.max.apply(null, full.map(function (r) { return r.length; }));
    var g = new Grid(w, full.length); g.map(0, 0, full, pal); return g;
  }

  /**
   * SDV.defineSprite(name, rows, palette, opts)
   *  rows: array of strings (one per pixel row), or array of frames (array of arrays).
   *  palette: { char: '#hex' }   ('.' and ' ' = transparent)
   *  opts.mirror: true -> each row is the LEFT half and is mirrored ('odd' shares the centre column)
   *  opts.outline: 'auto' (darkened neighbour, default) | '#hex' | false. Leave a 1px empty margin.
   *  opts.patch: [{x, y, rows}] drawn after mirroring (asymmetric details), same palette
   *  opts.breathe: row index; makes a 2nd idle frame by moving rows 0..breathe down 1px
   *  opts.ms: idle frame time (default 520)
   */
  SDV.defineSprite = function (name, rows, pal, opts) {
    opts = opts || {};
    var frameRows = Array.isArray(rows[0]) ? rows : [rows];
    var grids = frameRows.map(function (fr) {
      var g = rowsToGrid(fr, pal, opts.mirror);
      (opts.patch || []).forEach(function (p) { g.map(p.x, p.y, p.rows, pal); });
      return g;
    });
    if (opts.breathe != null && grids.length === 1) grids.push(grids[0].shiftRows(0, opts.breathe, 1));
    return register(name, grids, opts);
  };
  /**
   * SDV.paintSprite(name, w, h, fn(g, frame), opts) -- draw with the Grid painter.
   *  opts.frames (default 1), opts.outline ('auto' default), opts.ms
   */
  SDV.paintSprite = function (name, w, h, fn, opts) {
    opts = opts || {};
    var n = opts.frames || 1, grids = [];
    for (var f = 0; f < n; f++) { var g = new Grid(w, h); fn(g, f); grids.push(g); }
    return register(name, grids, opts);
  };
  function register(name, grids, opts) {
    var ol = opts.outline === undefined ? 'auto' : opts.outline;
    if (ol) grids.forEach(function (g) { g.outline(ol); });
    DEFS[name] = { w: grids[0].w, h: grids[0].h, grids: grids, frames: grids.map(function (g) { return g.toCanvas(); }), ms: opts.ms || 520, kind: opts.kind || 'sprite' };
    Object.keys(CACHE).forEach(function (k) { if (k.indexOf(name + '|') === 0) delete CACHE[k]; });
    return DEFS[name];
  }
  SDV.has = function (name) { return !!DEFS[name]; };
  SDV.list = function (kind) { return Object.keys(DEFS).filter(function (k) { return !kind || DEFS[k].kind === kind; }); };
  SDV.size = function (name) { var d = DEFS[name]; return d ? { w: d.w, h: d.h, frames: d.frames.length } : null; };

  /** SDV.sprite(name, {scale=4, frame=0, flip=false}) -> new <canvas> drawn at scale (real pixels) */
  SDV.sprite = function (name, o) {
    o = o || {};
    var d = DEFS[name]; if (!d) { console.warn('SDV: no sprite', name); d = DEFS.missing; }
    var s = o.scale || PX, f = (o.frame || 0) % d.frames.length;
    var cv = document.createElement('canvas'); cv.width = d.w * s; cv.height = d.h * s;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    var ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if (o.flip) { ctx.translate(cv.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(d.frames[f], 0, 0, cv.width, cv.height);
    cv.className = 'sdv-px'; cv.dataset.sprite = name;
    return cv;
  };
  SDV.icon = function (name, scale) { return SDV.sprite(name, { scale: scale || PX }); };
  /** draw a sprite into an existing 2d context at (x,y) in canvas pixels */
  SDV.drawSprite = function (ctx, name, x, y, o) {
    o = o || {}; var d = DEFS[name]; if (!d) return; var s = o.scale || PX;
    ctx.imageSmoothingEnabled = false;
    if (o.flip) { ctx.save(); ctx.translate(x + d.w * s, y); ctx.scale(-1, 1); ctx.drawImage(d.frames[(o.frame || 0) % d.frames.length], 0, 0, d.w * s, d.h * s); ctx.restore(); }
    else ctx.drawImage(d.frames[(o.frame || 0) % d.frames.length], x, y, d.w * s, d.h * s);
  };

  /* ================================================================
     SPRITE ART
     ================================================================ */
  var C = SDV.colors = {
    rim: '#5B2A0E', wood: '#C8691F', woodHi: '#F0A040', woodDk: '#9A4614', parch: '#FCE3A8', parchSh: '#E8B96A',
    ink: '#3E1F0A', red: '#D63A2B', cream: '#FFF4DC', grass: '#6CC33A', moss: '#2F6B2A', gold: '#F7C531', sky: '#86D2F0',
    pink: '#F58FB1', heart: '#E23B3B'
  };

  SDV.paintSprite('missing', 16, 16, function (g) { g.rect(1, 1, 14, 14, '#ff00ff'); g.rect(3, 3, 10, 10, '#000'); });

  /* ---------- characters: 16x32, front-facing, drawn as left halves and mirrored ---------- */
  var EYE = '#2B160A';

  // Poppy: mouse shopkeeper, rose dress, cream apron, little leaf-green kerchief knot
  SDV.defineSprite('poppy', [
    '........',
    '........',
    '..FFF...',
    '.FfhfF..',
    '.Fpppf..',
    '.Fpppf.f',
    '.Fppffff',
    '..Fffhhf',
    '..ffffhh',
    '.fffffff',
    '.fffffff',
    '.fffweff',
    '.Fffeeff',
    '.Fffeeff',
    '.Fccffmm',
    '..Fcfmmn',
    '..FFfmmm',
    '...FFfff',
    '....gGda',
    '...ddDaa',
    '..dddaaa',
    '..ddDaAa',
    '..ffDaaa',
    '..ffdaaa',
    '...dAaaa',
    '...daaaa',
    '..dDaaaa',
    '..DDAAAA',
    '...ddddd',
    '....kkk.',
    '...kkkk.',
    '........'
  ], { f: '#C99A6C', F: '#9E7149', h: '#E8C79A', p: '#F3A3B2', e: EYE, w: '#FFFFFF', c: '#F59A8A', m: '#F2DCC0', n: '#D8566E',
       d: '#D9504A', D: '#A63631', a: '#FFF6E2', A: '#E3CBA4', k: '#6E3A1C', g: '#6CC33A', G: '#3F8F2A', T: '#E89AA6' },
    { mirror: true, breathe: 18, patch: [{ x: 13, y: 22, rows: ['.T', '.T', 'T.', 'T.', '.T'] }] });

  // Mrs. Bunbury: rabbit, straw bonnet with pink ribbon, blue dress, white collar and apron
  SDV.defineSprite('bunbury', [
    '........',
    '...ff...',
    '..fpf...',
    '..fpf...',
    '..fpf...',
    '..fpf...',
    '..fpF...',
    '..yyyyyy',
    '.yhhyyyy',
    '.yrrrrrr',
    'yYRRRRRR',
    'yYffffff',
    'yYffweff',
    'yYffeeff',
    'yYfceeff',
    '.yYcfffn',
    '.yYfffff',
    '..YrrFff',
    '..rRraaa',
    '..ddaaad',
    '.dddddda',
    '.dDdddda',
    '.ffDdaaa',
    '.ffdaaaa',
    '..ddaaaa',
    '..dDaaaa',
    '.ddDaaaa',
    '.dDDAAAA',
    '..DDdddd',
    '....kk..',
    '...kkk..',
    '........'
  ], { f: '#F5EEE2', F: '#D8C8B0', p: '#F3A3B2', y: '#F4D27E', Y: '#C99A48', h: '#FFF0B8', r: '#F58FB1', R: '#D9637F', e: EYE, w: '#FFFFFF', c: '#F7A9A0', n: '#E06A80',
       d: '#7FB4E3', D: '#4F86BE', a: '#FFFFFF', A: '#D6E2EE', k: '#6E3A1C' }, { mirror: true, breathe: 18 });

  // Bramble: hedgehog trader, green flat cap, red scarf, brown waistcoat
  SDV.defineSprite('bramble', [
    '........',
    '........',
    '.....ggg',
    '...gghhg',
    '..tggggg',
    '.tsgggGg',
    '.ssGGGGG',
    'tssbbbbb',
    '.sssffff',
    'tssfffff',
    '.ssfweff',
    'tssfeeff',
    '.ssfeeff',
    'tsscffff',
    '.sssffmm',
    '..ssfmmn',
    '..sssfmm',
    '...rrrrr',
    '..rRrrrr',
    '.ssjjrRf',
    '.ssjjjff',
    '.sfjJjff',
    '..fjjjff',
    '..fjJjff',
    '...jjjff',
    '...JJJJf',
    '...pppPp',
    '...ppPpp',
    '...pp...',
    '..kkk...',
    '..kkk...',
    '........'
  ], { s: '#6B4A33', t: '#C9A27A', f: '#F0DCBC', F: '#D4B894', m: '#FBEBD3', n: '#2B160A', e: EYE, w: '#FFFFFF', c: '#F2A595',
       g: '#4F8A3A', G: '#36662A', h: '#7DB85C', b: '#2E5222', r: '#E2566B', R: '#B33A50', j: '#9A6236', J: '#74462A', p: '#5E6E8E', P: '#46526E', k: '#4A2A14' },
    { mirror: true, breathe: 17, patch: [{ x: 12, y: 19, rows: ['rR', 'rR', 'R.'] }] });

  // Hazel: small hedgehog with a pink bow and a green pinafore
  SDV.defineSprite('hazel', [
    '........',
    '........',
    '........',
    '........',
    '........',
    '....bb..',
    '...bBbb.',
    '..tsbbBk',
    '.tsssbbk',
    '.sssffff',
    'tssfffff',
    '.ssfweff',
    'tssfeeff',
    '.ssceeff',
    'tsscffff',
    '.sssffmm',
    '..ssfmmn',
    '..sssfmm',
    '...gggaa',
    '..sgggaa',
    '..fgGgaa',
    '..fggggg',
    '...ggGgg',
    '...gggGg',
    '..gGgggg',
    '..GGGGGG',
    '....ff..',
    '...kkk..',
    '...kkk..',
    '........',
    '........',
    '........'
  ], { s: '#7A5338', t: '#D2AC82', f: '#F2DFC2', m: '#FBEBD3', n: '#2B160A', e: EYE, w: '#FFFFFF', c: '#F7A0A0',
       b: '#F58FB1', B: '#D9637F', k: '#FFD0DC', g: '#7CC35A', G: '#4F9A3A', a: '#FFF6E2', A: '#E3CBA4' }, { mirror: true, breathe: 17 });
  // shift hazel down so her feet sit on the same baseline as the others
  (function () { var d = DEFS.hazel; d.grids = d.grids.map(function (g) { return g.shiftRows(0, 31, 2); }); d.frames = d.grids.map(function (g) { return g.toCanvas(); }); })();

  // Old Hoot: owl in round glasses
  SDV.defineSprite('hoot', [
    '........',
    '........',
    '........',
    '........',
    '.t......',
    '.tt.....',
    '.bttbbbb',
    '.bbbbBbb',
    'bbbwwwbb',
    'bbwGGGGw',
    'bbGwwwwG',
    'bbGweewG',
    'bbGwewwG',
    'bbGwwwwG',
    'bbwGGGGw',
    'bbbwwwwk',
    'bbbbwwkk',
    'BbbbbcLL',
    'BbbbcLcL',
    'BBbbLLLL',
    'BBbbcLcL',
    'BBbbLLLL',
    '.BbbcLcL',
    '.BbbLLLL',
    '.BBbbLLL',
    '..BBbbbb',
    '...BBBBB',
    '....oo.o',
    '...ooo..',
    '........',
    '........',
    '........'
  ], { b: '#9C6B3E', B: '#74492A', t: '#B8865A', w: '#F6E6C8', G: '#D9A43A', e: EYE, k: '#F2A63A', L: '#E9D2A8', c: '#B8936A', o: '#F2A63A' },
    { mirror: true, breathe: 16 });
  (function () { var d = DEFS.hoot; d.grids = d.grids.map(function (g) { return g.shiftRows(0, 31, 2); }); d.frames = d.grids.map(function (g) { return g.toCanvas(); }); })();

  // tiny glint fix for hoot's glasses (lens shine)
  /* ---------- portraits: 48x48 busts, 2 frames (open / blink) ---------- */
  function eyes(g, f, x1, x2, y, col, big) {
    [x1, x2].forEach(function (x) {
      if (f === 1) { g.rect(x - 2, y + 1, 5, 1, col); g.px(x - 3, y, col); g.px(x + 3, y, col); return; }
      g.ellipse(x + 0.5, y + 0.5, big ? 2.6 : 2.2, big ? 3.6 : 3, col);
      g.rect(x - 1, y - 2, 2, 2, '#FFFFFF'); g.px(x + 1, y + 2, '#FFFFFF');
    });
  }
  function bust(g, cx, top, w, col, shade) { // rounded shoulders
    g.ellipse(cx, top + 14, w, 14, col);
    g.ellipseIn(cx + 6, top + 18, w, 14, shade);
    g.ellipseIn(cx - 2, top + 14, w - 2, 14, col);
  }

  SDV.paintSprite('poppyPortrait', 48, 48, function (g, f) {
    var fur = '#C99A6C', furS = '#9E7149', furL = '#E8C79A', pink = '#F3A3B2';
    // body: rose dress + apron bib
    bust(g, 24, 36, 19, '#D9504A', '#A63631');
    g.rect(17, 38, 14, 10, '#FFF6E2'); g.rect(17, 38, 1, 10, '#E3CBA4'); g.rect(30, 38, 1, 10, '#E3CBA4');
    g.rect(21, 42, 6, 3, '#F5E6C8'); g.hline(21, 42, 6, '#E3CBA4');
    g.px(16, 37, '#E3CBA4'); g.px(31, 37, '#E3CBA4');
    // kerchief
    g.ellipse(24, 36.5, 7, 2.6, '#6CC33A'); g.ellipse(24, 37.5, 2, 2, '#3F8F2A');
    // ears
    [[10, 10], [38, 10]].forEach(function (p) { g.ellipse(p[0], p[1], 8, 8, furS); g.ellipse(p[0] - 0.5, p[1] - 0.5, 7, 7, fur); g.ellipse(p[0], p[1] + 0.5, 4.6, 4.6, pink); g.ellipse(p[0] + 0.5, p[1] + 1.5, 3, 3, '#E58A9C'); });
    // head
    g.ellipse(24, 23, 15, 13, furS);
    g.ellipse(23.5, 22.5, 14, 12, fur);
    g.ellipseIn(20, 15, 7, 4, furL);
    // muzzle
    g.ellipse(24, 30, 7.5, 5, '#F2DCC0'); g.ellipse(24, 31, 6.5, 4, '#F7E6CF');
    g.ellipse(24, 27.2, 2.6, 1.8, '#D8566E'); g.px(23, 26, '#F7B0BE');
    g.px(22, 31, '#7A3A22'); g.px(23, 32, '#7A3A22'); g.px(24, 31, '#7A3A22'); g.px(25, 32, '#7A3A22'); g.px(26, 31, '#7A3A22');
    // whiskers
    g.line(14, 28, 9, 27, furS); g.line(14, 30, 9, 31, furS); g.line(34, 28, 39, 27, furS); g.line(34, 30, 39, 31, furS);
    // cheeks and eyes
    g.ellipse(14.5, 26.5, 2.6, 1.6, '#F59A8A'); g.ellipse(33.5, 26.5, 2.6, 1.6, '#F59A8A');
    eyes(g, f, 17, 31, 21, '#2B160A', true);
    g.hline(15, 16, 4, furS); g.hline(30, 16, 4, furS); // brows
  }, { frames: 2, kind: 'portrait' });

  SDV.paintSprite('bunburyPortrait', 48, 48, function (g, f) {
    var fur = '#F5EEE2', furS = '#D8C8B0', straw = '#F4D27E', strawS = '#C99A48', strawL = '#FFF0B8';
    // dress + lace collar
    bust(g, 24, 36, 20, '#7FB4E3', '#4F86BE');
    for (var i = 0; i < 7; i++) g.ellipse(13.5 + i * 3.5, 38, 2.2, 2.2, '#FFFFFF');
    g.hline(12, 40, 24, '#D6E2EE');
    // ears (through the bonnet)
    g.ellipse(17, 6, 4, 9, furS); g.ellipse(16.5, 5.5, 3.4, 8.4, fur); g.ellipse(17, 6.5, 1.6, 6, '#F3A3B2');
    g.ellipse(31, 6, 4, 9, furS); g.ellipse(30.5, 5.5, 3.4, 8.4, fur); g.ellipse(31, 6.5, 1.6, 6, '#F3A3B2');
    // bonnet (hood framing the face)
    g.ellipse(24, 23, 19, 17, strawS); g.ellipse(23.5, 22, 18, 16, straw);
    for (var y = 9; y < 40; y += 3) for (var x = 6; x < 42; x += 4) if (g.get(x + (y % 2) * 2, y) === straw) g.px(x + (y % 2) * 2, y, '#E6BC62');
    g.ellipseIn(17, 11, 8, 3, strawL);
    g.ellipse(24, 14.5, 17, 2.4, '#F58FB1'); g.ellipse(24, 15.5, 17, 1.2, '#D9637F');
    // face
    g.ellipse(24, 26, 12.5, 11, furS); g.ellipse(23.6, 25.6, 12, 10.6, fur);
    g.ellipse(24, 31, 5.5, 3.6, '#FFFFFF');
    g.ellipse(24, 29, 2, 1.5, '#E06A80');
    g.px(23, 32, '#9C5A4A'); g.px(25, 32, '#9C5A4A'); g.px(24, 31, '#9C5A4A');
    g.ellipse(15.5, 29.5, 2.4, 1.5, '#F7A9A0'); g.ellipse(32.5, 29.5, 2.4, 1.5, '#F7A9A0');
    eyes(g, f, 18.5, 29.5, 24, '#2B160A', false);
    // little spectacles on a chain? no: kindly lashes
    g.px(15, 21, '#2B160A'); g.px(33, 21, '#2B160A');
    // ribbon bow under chin
    g.ellipse(19, 38, 3.4, 2.4, '#F58FB1'); g.ellipse(29, 38, 3.4, 2.4, '#F58FB1'); g.ellipse(24, 38, 2, 2, '#D9637F');
    g.line(22, 40, 20, 44, '#D9637F'); g.line(26, 40, 28, 44, '#D9637F');
  }, { frames: 2, kind: 'portrait' });

  SDV.paintSprite('bramblePortrait', 48, 48, function (g, f) {
    var sp = '#6B4A33', spL = '#8E6A4C', tip = '#C9A27A', face = '#F0DCBC', faceS = '#D4B894';
    // waistcoat + shirt
    bust(g, 24, 36, 20, '#9A6236', '#74462A');
    g.rect(19, 38, 10, 10, '#F4EAD2'); g.px(24, 42, '#C9A27A'); g.px(24, 45, '#C9A27A');
    // spines: jagged dome
    g.ellipse(24, 24, 20, 17, sp);
    for (var a = 0; a < 26; a++) {
      var ang = Math.PI * (0.92 + a * 0.046) , r = 20.5;
      var x = 24 + Math.cos(ang) * r * 1.02, y = 24 + Math.sin(ang) * r * 0.86;
      g.ellipse(x, y, 2, 2, a % 2 ? sp : spL); g.px(x + Math.cos(ang) * 2, y + Math.sin(ang) * 2, tip);
    }
    for (var k = 0; k < 40; k++) { var rx = 6 + (k * 37 % 36), ry = 8 + (k * 23 % 20); if (g.get(rx, ry) === sp) g.line(rx, ry, rx + 1, ry - 2, spL); }
    // face
    g.ellipse(24, 27, 12, 10.5, faceS); g.ellipse(23.5, 26.5, 11.5, 10, face);
    g.ellipse(24, 32, 6, 4.5, '#FBEBD3');
    g.ellipse(24, 30.6, 2.6, 2, '#2B160A'); g.px(23, 30, '#6A4A3A');
    g.px(22, 34, '#7A3A22'); g.px(23, 35, '#7A3A22'); g.px(24, 35, '#7A3A22'); g.px(25, 35, '#7A3A22'); g.px(26, 34, '#7A3A22');
    g.ellipse(15, 29, 2.4, 1.5, '#F2A595'); g.ellipse(33, 29, 2.4, 1.5, '#F2A595');
    eyes(g, f, 18.5, 29.5, 25, '#2B160A', false);
    g.hline(16, 20, 4, '#8E6A4C'); g.hline(28, 20, 4, '#8E6A4C');
    // flat cap
    g.ellipse(24, 11, 15, 7, '#36662A'); g.ellipse(23.5, 10, 14, 6, '#4F8A3A'); g.ellipseIn(19, 7, 6, 2, '#7DB85C');
    g.rect(10, 15, 28, 3, '#2E5222'); g.hline(10, 15, 28, '#36662A');
    g.ellipse(24, 3.5, 2, 1.5, '#36662A');
    // scarf
    g.ellipse(24, 38, 11, 3, '#E2566B'); g.hline(14, 39, 20, '#B33A50'); g.rect(28, 39, 4, 7, '#E2566B'); g.vline(31, 39, 7, '#B33A50');
  }, { frames: 2, kind: 'portrait' });

  /* ---------- items 16x16 ---------- */
  var DIG = {
    '0': ['.X.', 'X.X', 'X.X', 'X.X', 'X.X', 'X.X', '.X.'], '1': ['.X.', 'XX.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
    '2': ['XX.', '..X', '..X', '.X.', 'X..', 'X..', 'XXX'], '3': ['XX.', '..X', '..X', 'XX.', '..X', '..X', 'XX.'],
    '4': ['X.X', 'X.X', 'X.X', 'XXX', '..X', '..X', '..X'], '5': ['XXX', 'X..', 'XX.', '..X', '..X', '..X', 'XX.'],
    '6': ['.XX', 'X..', 'X..', 'XX.', 'X.X', 'X.X', '.X.'], '7': ['XXX', '..X', '..X', '.X.', '.X.', '.X.', '.X.'],
    '8': ['.X.', 'X.X', 'X.X', '.X.', 'X.X', 'X.X', '.X.'], '9': ['.X.', 'X.X', 'X.X', '.XX', '..X', '..X', 'XX.']
  };
  SDV.digits = DIG;
  function stamp(g, str, cx, y, col, hi) {
    var w = str.length * 4 - 1, x = Math.round(cx - w / 2);
    str.split('').forEach(function (ch, i) {
      var m = DIG[ch]; if (!m) return;
      if (hi) g.map(x + i * 4 + 1, y + 1, m.map(function (r) { return r.replace(/X/g, 'H'); }), { H: hi });
      g.map(x + i * 4, y, m, { X: col });
    });
  }
  function coin(name, base, light, dark, stampCol, label) {
    SDV.paintSprite(name, 16, 16, function (g) {
      g.ellipse(8, 8, 7, 7, dark);
      g.ellipse(7.6, 7.6, 6.6, 6.6, base);
      g.ellipse(8, 8, 5, 5, dark); g.ellipse(7.6, 7.6, 4.8, 4.8, base);   // raised rim ring
      g.px(3, 5, light); g.px(4, 4, light); g.px(5, 3, light); g.px(4, 3, light); g.px(3, 4, light);
      stamp(g, label, 8, 4.5 | 0, stampCol, light);
      g.px(12, 11, dark); g.px(11, 12, dark);
    }, { kind: 'item' });
  }
  coin('penny', '#DB8550', '#F7B98A', '#A3532B', '#7E3415', '1');
  coin('nickel', '#C9D2D8', '#FFFFFF', '#8995A0', '#4E5A66', '5');
  coin('dime', '#F7C531', '#FFF3A8', '#D0891C', '#8E5408', '10');
  SDV.paintSprite('goldCoin', 16, 16, function (g) {
    g.ellipse(8, 8, 6.5, 6.5, '#D0891C'); g.ellipse(7.6, 7.6, 6, 6, '#F7C531');
    g.ellipse(9, 9, 3.4, 3.4, '#E8A62A'); g.ellipse(8, 8, 3.2, 3.2, '#F7C531');
    g.rect(7, 5, 2, 6, '#B86E12'); g.px(7, 5, '#D0891C');
    g.px(4, 5, '#FFF6B8'); g.px(5, 4, '#FFF6B8'); g.px(4, 6, '#FFF6B8'); g.px(6, 3, '#FFF6B8');
  }, { kind: 'item' });

  SDV.paintSprite('acornBun', 16, 16, function (g) {
    // bun body
    g.ellipse(8, 10.5, 6.2, 4.6, '#C27A2C'); g.ellipse(7.6, 10, 5.8, 4.2, '#E8A24A'); g.ellipseIn(6, 8.6, 3.2, 1.8, '#F7C873');
    g.px(4, 9, '#FFF0C0');
    // acorn cap top
    g.ellipse(8, 6.5, 6.5, 3.6, '#6B4220'); g.ellipse(7.6, 6, 6.1, 3.2, '#8A5A2E');
    for (var y = 4; y < 9; y++) for (var x = 2; x < 15; x++) if ((x + y) % 3 === 0 && g.get(x, y) === '#8A5A2E') g.px(x, y, '#6B4220');
    g.px(5, 4, '#B5844E'); g.px(6, 4, '#B5844E'); g.px(4, 5, '#B5844E');
    g.rect(8, 1, 2, 3, '#5A3416'); g.px(10, 1, '#3F8F2A'); g.px(11, 1, '#6CC33A'); g.px(11, 2, '#3F8F2A');
  }, { kind: 'item' });

  SDV.paintSprite('apple', 16, 16, function (g) {
    g.ellipse(8, 9.5, 6, 5.6, '#A8261E'); g.ellipse(7.6, 9, 5.6, 5.2, '#E23B3B');
    g.ellipse(8.5, 6, 2.2, 1.3, '#A8261E');
    g.ellipseIn(5.5, 7.5, 1.8, 2.4, '#FF8A70'); g.px(5, 7, '#FFFFFF');
    g.rect(8, 2, 1, 4, '#6B4220'); g.ellipse(11, 3, 2.4, 1.4, '#6CC33A'); g.px(10, 3, '#3F8F2A');
  }, { kind: 'item' });

  function jar(name, fill, fillL, fillD, lid, lidD, label) {
    SDV.paintSprite(name, 16, 16, function (g) {
      g.rect(3, 5, 10, 10, fillD); g.rect(3, 5, 9, 9, fill); g.rect(4, 6, 2, 6, fillL); g.px(4, 13, fillL);
      g.rect(2, 6, 1, 8, fillD); g.rect(13, 6, 1, 8, fillD);
      g.px(2, 5, null); g.px(13, 5, null); g.px(2, 14, null); g.px(13, 14, null);
      g.rect(3, 4, 10, 1, '#F2E6C8');
      // cloth lid with string
      g.ellipse(8, 3.5, 6, 2.4, lidD); g.ellipse(7.6, 3, 5.6, 2, lid);
      for (var x = 3; x < 13; x += 2) g.px(x, 3, '#FFFFFF');
      g.hline(3, 5, 10, '#8A5A2E');
      if (label) { g.rect(5, 8, 6, 4, '#FFF4DC'); g.hline(5, 11, 6, '#E3CBA4'); g.rect(7, 9, 2, 1, label); }
    }, { kind: 'item' });
  }
  jar('honeyJar', '#F2A81D', '#FFD45A', '#C27412', '#E2566B', '#A8323F', '#C27412');
  jar('jam', '#7A2E6E', '#B0559E', '#4E1A48', '#E8D4A8', '#B8956A', '#7A2E6E');

  SDV.paintSprite('seedCake', 16, 16, function (g) {
    g.ellipse(8, 10, 6.5, 4.5, '#B5782E'); g.rect(2, 8, 13, 3, '#B5782E');
    g.ellipse(8, 8, 6.5, 3.2, '#E3B062'); g.ellipseIn(6, 7, 3, 1.4, '#F4D08A');
    [[5, 8], [8, 7], [10, 9], [7, 9], [11, 7], [4, 9]].forEach(function (p) { g.px(p[0], p[1], '#5A3416'); });
    g.rect(2, 10, 13, 1, '#9A6224');
  }, { kind: 'item' });

  SDV.paintSprite('savingsJar', 16, 16, function (g) {
    var glass = '#CFEAF2', glassD = '#8EC3D6';
    g.rect(3, 3, 10, 12, glassD); g.rect(4, 3, 8, 11, glass); g.px(3, 3, null); g.px(12, 3, null); g.px(3, 14, null); g.px(12, 14, null);
    g.rect(4, 9, 8, 5, '#F7C531'); g.hline(4, 9, 8, '#FFF3A8'); g.px(6, 11, '#D0891C'); g.px(9, 12, '#D0891C'); g.px(10, 10, '#D0891C');
    g.rect(5, 1, 6, 2, '#B07843'); g.hline(5, 1, 6, '#D9A066');
    g.vline(5, 4, 4, '#FFFFFF'); g.px(6, 4, '#FFFFFF');
    g.ellipse(8.5, 6.5, 1.6, 1.4, '#E23B3B');
  }, { kind: 'item' });

  SDV.paintSprite('card', 16, 16, function (g) {
    g.rect(3, 1, 10, 14, '#D63A2B'); g.rect(4, 2, 8, 12, '#FFF4DC');
    g.rect(5, 3, 6, 5, '#86D2F0'); g.ellipse(8, 7, 2, 2, '#C99A6C'); g.px(6, 4, '#C99A6C'); g.px(9, 4, '#C99A6C');
    g.hline(5, 10, 6, '#C99A6C'); g.hline(5, 12, 4, '#E8B96A');
    g.px(10, 12, '#E23B3B'); g.px(4, 2, '#FFFFFF');
  }, { kind: 'item' });

  SDV.defineSprite('heart', [
    '................',
    '................',
    '...ooo....ooo...',
    '..oHHRo..oRRRo..',
    '.oHWHRRooRRRRRo.',
    '.oHHRRRRRRRRRDo.',
    '.oRRRRRRRRRRRDo.',
    '.oRRRRRRRRRRDDo.',
    '..oRRRRRRRRRDo..',
    '...oRRRRRRRDo...',
    '....oRRRRRDo....',
    '.....oRRRDo.....',
    '......oRDo......',
    '.......oo.......',
    '................',
    '................'
  ], { o: '#5B1414', H: '#FF8F86', W: '#FFFFFF', R: '#E23B3B', D: '#A82020' }, { outline: false, kind: 'item' });

  SDV.paintSprite('heartSmall', 9, 8, function (g) {
    g.map(0, 0, ['.oo...oo.', 'oHRo.oRRo', 'oHRRoRRRo', 'oRRRRRRDo', '.oRRRRDo.', '..oRRDo..', '...oDo...', '....o....'], { o: '#5B1414', H: '#FF9C9C', R: '#E23B3B', D: '#A82020' });
  }, { outline: false, kind: 'item' });

  // goods packs for Bramble's cart
  SDV.paintSprite('bag', 16, 16, function (g) {
    g.ellipse(8, 10.5, 6.2, 5, '#A87A44'); g.ellipse(7.6, 10, 5.8, 4.6, '#D9B07A'); g.ellipseIn(6, 8.5, 2.6, 2, '#EBCB98');
    g.rect(6, 4, 4, 3, '#C99A62'); g.ellipse(8, 3, 3, 1.6, '#D9B07A'); g.hline(6, 6, 4, '#E2566B'); g.px(10, 7, '#E2566B'); g.px(11, 8, '#E2566B');
    stamp(g, '2', 8, 8, '#7A5228');
  }, { kind: 'item' });
  SDV.paintSprite('box', 16, 16, function (g) {
    g.rect(2, 6, 12, 9, '#B5763A'); g.rect(2, 6, 11, 8, '#D9A066'); g.rect(2, 4, 12, 3, '#E8B97E'); g.hline(2, 4, 12, '#F6D6A2');
    g.hline(2, 7, 12, '#9A5E2A'); g.vline(8, 4, 3, '#9A5E2A');
    stamp(g, '5', 8, 8, '#6E3A14');
  }, { kind: 'item' });
  SDV.paintSprite('crate', 16, 16, function (g) {
    g.rect(1, 4, 14, 11, '#7A4A22'); g.rect(1, 4, 13, 10, '#C88A4E');
    for (var y = 4; y < 14; y += 3) g.hline(1, y + 2, 13, '#9A6230');
    g.vline(1, 4, 10, '#E2A868'); g.vline(14, 4, 11, '#7A4A22'); g.hline(1, 4, 14, '#E2A868');
    g.rect(4, 6, 8, 7, '#F2D9A8'); g.rect(4, 6, 8, 1, '#FFF0CC');
    stamp(g, '10', 8, 6, '#6E3A14');
  }, { kind: 'item' });
  SDV.paintSprite('basket', 16, 16, function (g) {
    g.line(3, 7, 5, 2, '#9A6230'); g.line(5, 2, 11, 2, '#9A6230'); g.line(11, 2, 13, 7, '#9A6230');
    g.line(4, 7, 6, 3, '#C88A4E'); g.line(6, 3, 10, 3, '#C88A4E'); g.line(10, 3, 12, 7, '#C88A4E');
    g.rect(2, 7, 12, 7, '#B5763A'); g.rect(3, 8, 10, 6, '#D9A066');
    for (var y = 8; y < 14; y++) for (var x = 3; x < 13; x++) if ((x + y) % 2 === 0) g.px(x, y, '#C48A50');
    g.hline(2, 7, 12, '#E8B97E'); g.hline(3, 14, 10, '#9A6230');
  }, { kind: 'item' });

  // emote bubbles (over characters' heads)
  function bubble(g) {
    g.rect(2, 1, 12, 10, '#FFFFFF'); g.rect(1, 2, 14, 8, '#FFFFFF'); g.rect(5, 11, 3, 1, '#FFFFFF'); g.px(5, 12, '#FFFFFF'); g.px(6, 11, '#FFFFFF');
    g.hline(2, 10, 12, '#D8E2EA'); g.px(14, 9, '#D8E2EA');
  }
  SDV.paintSprite('emoteBang', 16, 14, function (g, f) {
    bubble(g); var o = f ? 0 : 0;
    g.rect(7, 2 + o, 2, 5, '#E23B3B'); g.rect(7, 8 + o, 2, 2, '#E23B3B'); g.px(7, 2, '#FF8F86');
  }, { outline: '#3E1F0A', kind: 'item' });
  SDV.paintSprite('emoteHeart', 16, 14, function (g) {
    bubble(g); g.map(4, 3, ['.RR.RR.', 'RHRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], { R: '#E23B3B', H: '#FF9C9C' });
  }, { outline: '#3E1F0A', kind: 'item' });
  SDV.paintSprite('emoteQuestion', 16, 14, function (g) {
    bubble(g); g.map(6, 2, ['.XX.', 'X..X', '...X', '..X.', '.X..', '....', '.X..'], { X: '#4F86BE' });
  }, { outline: '#3E1F0A', kind: 'item' });
  SDV.paintSprite('emoteNote', 16, 14, function (g) {
    bubble(g); g.map(5, 2, ['...XX', '..XX.', '..X..', '..X..', 'XXX..', 'XXX..'], { X: '#7A2E6E' });
  }, { outline: '#3E1F0A', kind: 'item' });

  SDV.paintSprite('sun', 10, 10, function (g) {
    g.ellipse(5, 5, 3, 3, '#F7C531'); g.px(4, 3, '#FFF3A8');
    [[5, 0], [5, 9], [0, 5], [9, 5], [1, 1], [8, 1], [1, 8], [8, 8]].forEach(function (p) { g.px(p[0], p[1], '#F7A531'); });
  }, { outline: false, kind: 'icon' });
  SDV.paintSprite('springLeaf', 10, 10, function (g) {
    g.ellipse(5, 4, 3, 4, '#6CC33A'); g.line(2, 9, 6, 3, '#2F6B2A'); g.px(4, 2, '#B8F07A');
    g.ellipse(7.5, 7.5, 1.6, 1.6, '#F58FB1'); g.px(7, 7, '#FFF4DC');
  }, { outline: false, kind: 'icon' });
  SDV.paintSprite('moon', 10, 10, function (g) {
    g.ellipse(5, 5, 4, 4, '#FFF0B8'); g.ellipse(7, 4, 3.4, 3.4, null); g.px(3, 5, '#E8D088');
  }, { outline: false, kind: 'icon' });
  SDV.paintSprite('sparkle', 9, 9, function (g, f) {
    var c = '#FFF6B8', d = '#F7C531';
    if (f === 0) { g.vline(4, 0, 9, d); g.hline(0, 4, 9, d); g.rect(3, 3, 3, 3, c); g.px(4, 4, '#FFFFFF'); }
    else { g.vline(4, 2, 5, d); g.hline(2, 4, 5, d); g.px(4, 4, '#FFFFFF'); g.px(2, 2, c); g.px(6, 6, c); g.px(6, 2, c); g.px(2, 6, c); }
  }, { frames: 2, outline: false, kind: 'icon', ms: 300 });
  SDV.paintSprite('flower', 8, 8, function (g) {
    g.vline(4, 4, 4, '#3F8F2A'); g.px(5, 6, '#6CC33A');
    g.px(3, 2, '#F58FB1'); g.px(5, 2, '#F58FB1'); g.px(4, 1, '#F58FB1'); g.px(4, 3, '#F58FB1'); g.px(4, 2, '#FFE15A');
  }, { kind: 'icon' });
  SDV.paintSprite('butterfly', 7, 6, function (g, f) {
    var w = '#F58FB1', w2 = '#FFE15A';
    if (f === 0) { g.map(0, 0, ['XX.YY', 'XXbYY', '.XbY.', 'XXbYY', 'X...Y'].map(function (r) { return r + '..'; }), { X: w, Y: w, b: '#3E1F0A' }); }
    else { g.map(0, 0, ['..X..', '.XbX.', '.XbX.', '.XbX.', '.....'], { X: w, b: '#3E1F0A' }); }
  }, { frames: 2, outline: false, kind: 'icon', ms: 160 });
  SDV.paintSprite('butterflyY', 7, 6, function (g, f) {
    var w = '#FFE15A';
    if (f === 0) g.map(0, 0, ['XX.XX', 'XXbXX', '.XbX.', 'XXbXX', 'X...X'], { X: w, b: '#3E1F0A' });
    else g.map(0, 0, ['..X..', '.XbX.', '.XbX.', '.XbX.', '.....'], { X: w, b: '#3E1F0A' });
  }, { frames: 2, outline: false, kind: 'icon', ms: 180 });
  SDV.paintSprite('lantern', 12, 16, function (g, f) {
    g.rect(5, 0, 2, 2, '#4A2A14'); g.rect(3, 2, 6, 2, '#5B2A0E');
    g.rect(2, 4, 8, 9, '#5B2A0E'); g.rect(3, 5, 6, 7, f ? '#FFE07A' : '#FFD050'); g.rect(4, 6, 2, 4, '#FFF6C8');
    g.vline(6, 5, 7, '#5B2A0E'); g.rect(3, 13, 6, 2, '#5B2A0E');
  }, { frames: 2, kind: 'item', ms: 700 });
  SDV.paintSprite('bell', 16, 16, function (g) {
    g.rect(7, 1, 2, 2, '#9A6230');
    g.ellipse(8, 7, 4.5, 4.5, '#D0891C'); g.ellipse(7.6, 6.6, 4, 4, '#F7C531'); g.rect(3, 8, 10, 4, '#D0891C'); g.rect(3, 8, 9, 3, '#F7C531');
    g.rect(2, 11, 12, 2, '#B86E12'); g.px(5, 5, '#FFF3A8'); g.px(5, 6, '#FFF3A8'); g.ellipse(8, 14, 1.5, 1.2, '#9A6230');
  }, { kind: 'item' });
  SDV.paintSprite('notebook', 16, 16, function (g) {
    g.rect(2, 1, 12, 14, '#3F8F2A'); g.rect(3, 1, 11, 13, '#6CC33A'); g.rect(5, 3, 8, 10, '#FFF4DC');
    for (var y = 5; y < 13; y += 2) g.hline(6, y, 6, '#86B4D8');
    g.vline(2, 1, 14, '#2F6B2A'); [3, 6, 9, 12].forEach(function (y) { g.px(3, y, '#E8E8E8'); });
  }, { kind: 'item' });

  // clock dial: frame 0 morning, 1 shop (midday), 2 evening
  SDV.paintSprite('clockDial', 15, 28, function (g, f) {
    var cx = 15, cy = 14, night = f === 2;
    g.ellipse(cx, cy, 14, 14, '#5B2A0E'); g.ellipse(cx, cy, 13, 13, '#F0A040'); g.ellipse(cx + 0.5, cy + 0.5, 12, 12, '#C8691F');
    g.ellipse(cx, cy, 10, 10, '#5B2A0E'); g.ellipse(cx, cy, 9, 9, night ? '#3A3F7A' : '#86D2F0');
    g.ellipseIn(cx, cy + 10, 11, 5, night ? '#2F6B2A' : '#6CC33A');
    if (!night) { g.ellipse(9, 9, 2.2, 2.2, '#F7C531'); g.px(8, 8, '#FFF3A8'); } else { g.ellipse(9, 9, 2.2, 2.2, '#FFF0B8'); g.px(10, 8, '#3A3F7A'); g.px(6, 13, '#FFFFFF'); g.px(11, 5, '#FFFFFF'); }
    var ang = [-2.6, -1.9, -1.2][f] + Math.PI; // hand sweeps through the left half
    ang = [Math.PI * 0.8, Math.PI, Math.PI * 1.2][f];
    g.line(14, cy, Math.round(14 + Math.cos(ang) * 8), Math.round(cy + Math.sin(ang) * 8), '#D63A2B');
    g.rect(13, cy - 1, 2, 3, '#5B2A0E');
  }, { frames: 3, outline: false, kind: 'icon' });

  /* ---------- objects (furniture, buildings, plants) ---------- */
  SDV.paintSprite('shelf', 32, 40, function (g) {
    var w = '#9A6230', wd = '#6E3A14', wl = '#C88A4E';
    g.rect(1, 2, 30, 37, wd); g.rect(2, 3, 28, 35, '#7A4A22');           // back panel
    g.rect(1, 0, 30, 3, wl); g.hline(1, 0, 30, '#E2A868');                // top
    [13, 25, 37].forEach(function (y) { g.rect(1, y, 30, 2, w); g.hline(1, y, 30, wl); g.hline(2, y + 2, 28, '#5A3010'); });
    g.rect(1, 2, 2, 37, w); g.rect(29, 2, 2, 37, w); g.vline(1, 2, 37, wl);
    for (var y = 4; y < 36; y += 4) g.hline(4, y, 24, '#6E4222');
  }, { kind: 'object' });
  SDV.paintSprite('counter', 64, 28, function (g) {
    g.rect(0, 6, 64, 22, '#7A4A22');
    g.rect(1, 7, 62, 20, '#B5763A');
    for (var x = 4; x < 62; x += 10) { g.rect(x, 10, 7, 14, '#9A6230'); g.hline(x, 10, 7, '#7A4A22'); g.vline(x, 10, 14, '#7A4A22'); g.hline(x, 23, 7, '#C88A4E'); }
    g.rect(0, 0, 64, 7, '#9A6230'); g.rect(0, 0, 64, 6, '#D9A066'); g.hline(0, 0, 64, '#F2C98E'); g.hline(0, 6, 64, '#6E3A14');
    for (var i = 4; i < 64; i += 11) g.hline(i, 3, 5, '#C88A4E');
    g.hline(1, 27, 62, '#5A3010');
  }, { kind: 'object' });
  SDV.paintSprite('till', 20, 18, function (g) {
    g.rect(1, 6, 18, 11, '#9A6236'); g.rect(2, 7, 16, 9, '#C88A4E'); g.hline(2, 7, 16, '#E2A868');
    g.rect(3, 1, 10, 6, '#7A4A22'); g.rect(4, 2, 8, 4, '#2F6B2A'); stamp(g, '0', 8, -1, '#B8F07A');
    g.px(4, 2, '#B8F07A');
    for (var x = 4; x < 16; x += 3) { g.rect(x, 9, 2, 2, '#FFF4DC'); g.rect(x, 12, 2, 2, '#FFF4DC'); }
    g.rect(14, 2, 3, 5, '#F7C531'); g.rect(1, 15, 18, 2, '#6E3A14');
  }, { kind: 'object' });
  SDV.paintSprite('door', 24, 32, function (g) {
    g.ellipse(12, 12, 12, 12, '#5B2A0E'); g.rect(0, 12, 24, 20, '#5B2A0E');
    g.ellipse(12, 12, 10.5, 10.5, '#9A6230'); g.rect(2, 12, 20, 20, '#9A6230');
    [6, 10, 14, 18].forEach(function (x) { g.vline(x, 3, 29, '#7A4A22'); });
    g.ellipseIn(9, 8, 3, 3, '#B5783E');
    g.ellipse(12, 10, 3.5, 3.5, '#5B2A0E'); g.ellipse(12, 10, 2.6, 2.6, '#86D2F0'); g.px(11, 9, '#FFFFFF');
    g.rect(17, 18, 2, 2, '#F7C531'); g.px(17, 18, '#FFF3A8');
    g.hline(2, 24, 20, '#6E3A14'); g.hline(2, 25, 20, '#B5783E');
  }, { kind: 'object' });
  SDV.paintSprite('window', 24, 24, function (g) {
    g.ellipse(12, 12, 12, 12, '#5B2A0E'); g.ellipse(12, 12, 11, 11, '#C88A4E'); g.ellipse(12, 12, 9, 9, '#5B2A0E');
    g.ellipse(12, 12, 8, 8, '#86D2F0'); g.ellipseIn(12, 18, 9, 5, '#6CC33A'); g.ellipseIn(8, 9, 3, 2, '#FFFFFF');
    g.rect(11, 3, 2, 18, '#C88A4E'); g.rect(3, 11, 18, 2, '#C88A4E');
    g.ellipseIn(8, 6, 3, 1.5, '#E8F7FF');
  }, { kind: 'object' });
  SDV.paintSprite('windowBox', 32, 14, function (g) {
    g.rect(1, 7, 30, 7, '#7A4A22'); g.rect(2, 8, 28, 5, '#B5763A'); g.hline(2, 8, 28, '#D9A066');
    for (var i = 0; i < 6; i++) {
      var x = 4 + i * 5, c = i % 2 ? '#FFE15A' : '#F58FB1';
      g.vline(x, 3, 5, '#3F8F2A'); g.px(x + 1, 5, '#6CC33A'); g.px(x - 1, 6, '#6CC33A');
      g.rect(x - 1, 1, 3, 3, c); g.px(x, 2, i % 2 ? '#D9637F' : '#FFF4DC');
    }
  }, { kind: 'object' });
  SDV.paintSprite('rug', 48, 32, function (g) {
    g.ellipse(24, 16, 23, 15, '#A8323F'); g.ellipse(24, 16, 21, 13, '#E2566B'); g.ellipse(24, 16, 17, 10, '#F7C531'); g.ellipse(24, 16, 15, 8.5, '#E2566B');
    g.ellipse(24, 16, 10, 5, '#FCE3A8'); g.ellipse(24, 16, 8, 3.6, '#F58FB1');
    for (var a = 0; a < 16; a++) { var t = a / 16 * Math.PI * 2; g.px(24 + Math.cos(t) * 19, 16 + Math.sin(t) * 11.6, '#FFF4DC'); }
  }, { kind: 'object', outline: false });
  SDV.paintSprite('tree', 48, 64, function (g) {
    // trunk
    g.rect(20, 40, 9, 22, '#6E4222'); g.rect(21, 40, 6, 22, '#9A6236'); g.vline(22, 42, 18, '#B5844E');
    g.rect(16, 60, 16, 3, '#6E4222'); g.px(17, 59, '#6E4222'); g.px(30, 59, '#6E4222');
    // canopy: clustered blobs, dark under light
    var blobs = [[24, 20, 18, 16], [12, 28, 10, 9], [36, 28, 10, 9], [16, 14, 10, 9], [32, 13, 10, 9], [24, 8, 11, 8], [24, 33, 14, 8]];
    blobs.forEach(function (b) { g.ellipse(b[0], b[1] + 1, b[2], b[3], '#2F6B2A'); });
    blobs.forEach(function (b) { g.ellipse(b[0] - 0.5, b[1], b[2] - 1, b[3] - 1, '#4F9A3A'); });
    blobs.forEach(function (b) { g.ellipseIn(b[0] - 3, b[1] - 3, b[2] * 0.55, b[3] * 0.5, '#6CC33A'); });
    blobs.forEach(function (b) { g.ellipseIn(b[0] - 5, b[1] - 5, b[2] * 0.22, b[3] * 0.2, '#9BE05A'); });
    // spring blossoms
    var r = rng(7); for (var i = 0; i < 26; i++) { var x = 8 + (r() * 32) | 0, y = 4 + (r() * 32) | 0; if (g.get(x, y) && g.get(x, y) !== '#2F6B2A') { g.px(x, y, '#F58FB1'); g.px(x + 1, y, '#FFD0DC'); } }
  }, { kind: 'object' });
  SDV.paintSprite('bush', 32, 24, function (g, f) {
    var bl = [[16, 14, 14, 9], [8, 15, 7, 7], [24, 15, 7, 7], [12, 9, 7, 6], [21, 9, 7, 6]];
    bl.forEach(function (b) { g.ellipse(b[0], b[1] + 1, b[2], b[3], '#2F6B2A'); });
    bl.forEach(function (b) { g.ellipse(b[0] - 0.5, b[1], b[2] - 1, b[3] - 1, '#4F9A3A'); });
    bl.forEach(function (b) { g.ellipseIn(b[0] - 2, b[1] - 2, b[2] * 0.5, b[3] * 0.45, '#6CC33A'); });
    [[8, 12], [15, 8], [22, 13], [12, 17], [26, 11], [18, 16]].forEach(function (p) { g.px(p[0], p[1] + (f && p[0] % 2 ? 1 : 0), '#E23B3B'); g.px(p[0] + 1, p[1], '#A8261E'); });
  }, { kind: 'object', frames: 1 });
  SDV.paintSprite('fence', 16, 20, function (g) {
    g.rect(1, 6, 15, 3, '#C88A4E'); g.rect(1, 12, 15, 3, '#C88A4E'); g.hline(1, 6, 15, '#E2A868'); g.hline(1, 12, 15, '#E2A868'); g.hline(1, 8, 15, '#9A6230'); g.hline(1, 14, 15, '#9A6230');
    g.rect(2, 2, 4, 17, '#9A6230'); g.rect(2, 2, 3, 16, '#D9A066'); g.px(2, 2, null); g.px(5, 2, null); g.hline(3, 1, 2, '#D9A066');
  }, { kind: 'object' });
  SDV.paintSprite('toadstool', 80, 96, function (g) {
    // stalk (house body)
    g.ellipse(40, 82, 26, 10, '#D6C2A0');
    g.rect(14, 44, 52, 40, '#D6C2A0'); g.rect(15, 44, 49, 39, '#FFF0D8'); g.rect(56, 44, 8, 39, '#E8D6B4'); g.ellipse(40, 82, 24.5, 8.5, '#FFF0D8'); g.ellipseIn(58, 80, 8, 8, '#E8D6B4');
    for (var y = 48; y < 86; y += 6) g.hline(18 + (y % 12 ? 0 : 6), y, 5, '#EAD8B6');
    // door
    g.ellipse(40, 66, 9, 9, '#5B2A0E'); g.rect(31, 66, 18, 20, '#5B2A0E'); g.ellipse(40, 66, 7.5, 7.5, '#9A6230'); g.rect(33, 66, 14, 19, '#9A6230');
    [36, 40, 44].forEach(function (x) { g.vline(x, 59, 26, '#7A4A22'); }); g.rect(44, 72, 2, 2, '#F7C531');
    // round window
    g.ellipse(23, 60, 6, 6, '#5B2A0E'); g.ellipse(23, 60, 5, 5, '#FFE07A'); g.rect(22, 55, 2, 10, '#C88A4E'); g.rect(18, 59, 10, 2, '#C88A4E');
    g.ellipse(58, 56, 4, 4, '#5B2A0E'); g.ellipse(58, 56, 3, 3, '#FFE07A');
    // cap
    g.ellipse(40, 32, 40, 22, '#8E1F16');
    g.ellipse(40, 30, 39, 21, '#D63A2B');
    g.ellipseIn(30, 20, 22, 10, '#E85A43'); g.ellipseIn(24, 14, 10, 4, '#F58A6A');
    g.rect(0, 44, 80, 12, null);
    g.ellipse(40, 44, 38, 5, '#8E1F16'); g.rect(0, 44, 80, 6, null);
    g.ellipse(40, 41, 38, 4, '#B02A20'); g.rect(0, 44, 80, 4, null);
    g.ellipse(40, 46, 30, 3, '#C9A882');
    // cap dots
    [[20, 22, 5, 3.4], [40, 14, 6, 3.6], [60, 22, 5, 3.4], [30, 33, 4, 2.6], [52, 34, 4.4, 2.8], [10, 34, 2.6, 2], [70, 34, 2.6, 2], [46, 24, 2.4, 1.8]].forEach(function (d) {
      g.ellipseIn(d[0], d[1] + 0.6, d[2], d[3], '#E8D6B4'); g.ellipseIn(d[0] - 0.3, d[1], d[2] - 0.3, d[3] - 0.3, '#FFF4DC');
    });
    // chimney
    g.rect(58, 2, 6, 10, '#9A6236'); g.rect(59, 2, 4, 9, '#C88A4E'); g.rect(57, 1, 8, 2, '#6E4222');
  }, { kind: 'object' });
  SDV.paintSprite('cart', 48, 36, function (g) {
    g.rect(2, 8, 44, 16, '#7A4A22'); g.rect(3, 9, 42, 14, '#B5763A'); for (var x = 3; x < 45; x += 6) g.vline(x, 9, 14, '#9A6230'); g.hline(3, 9, 42, '#D9A066');
    g.rect(0, 6, 48, 3, '#9A6230'); g.hline(0, 6, 48, '#D9A066');
    // goods peeking out
    g.ellipse(12, 6, 5, 3, '#D9B07A'); g.ellipse(24, 5, 5, 4, '#E23B3B'); g.ellipse(36, 6, 6, 3, '#E8A24A'); g.ellipse(30, 4, 3, 2, '#F2A81D');
    // wheels
    [[12, 28], [36, 28]].forEach(function (w) { g.ellipse(w[0], w[1], 7, 7, '#5B2A0E'); g.ellipse(w[0], w[1], 5.6, 5.6, '#C88A4E'); g.ellipse(w[0], w[1], 4, 4, '#5B2A0E'); g.ellipse(w[0], w[1], 3, 3, '#9A6230'); g.ellipse(w[0], w[1], 1.2, 1.2, '#F7C531'); });
    g.line(46, 12, 47, 2, '#7A4A22');
  }, { kind: 'object' });
  SDV.paintSprite('sign', 32, 24, function (g) {
    g.rect(14, 12, 4, 12, '#7A4A22'); g.rect(15, 12, 2, 12, '#9A6230');
    g.rect(1, 1, 30, 13, '#7A4A22'); g.rect(2, 2, 28, 11, '#D9A066'); g.hline(2, 2, 28, '#F2C98E'); g.hline(2, 7, 28, '#C88A4E');
  }, { kind: 'object' });

  /* ================================================================
     TILES (16x16, procedural, seeded per map position)
     ================================================================ */
  var TILES = SDV._tiles = {};
  /** SDV.defineTile(name, fn(g, r, tx, ty)) -- r is a seeded rng unique to the map cell */
  SDV.defineTile = function (name, fn) { TILES[name] = fn; };
  function grassBase(g, r) {
    g.rect(0, 0, 16, 16, '#6CC33A');
    for (var i = 0; i < 18; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; g.px(x, y, '#5AAE30'); g.px(x + 1, y, '#5AAE30'); }
    for (i = 0; i < 6; i++) { x = (r() * 15) | 0; y = (r() * 14 + 1) | 0; g.px(x, y, '#3F8F2A'); g.px(x + 1, y - 1, '#8EDB52'); g.px(x, y - 1, '#8EDB52'); }
    for (i = 0; i < 4; i++) { x = (r() * 16) | 0; y = (r() * 16) | 0; g.px(x, y, '#9BE05A'); }
  }
  SDV.defineTile('grass', grassBase);
  SDV.defineTile('grass2', function (g, r) {
    grassBase(g, r);
    for (var k = 0; k < 2; k++) { var x = 2 + (r() * 10) | 0, y = 5 + (r() * 8) | 0; g.map(x, y, ['.L.L', 'LdLd', 'dDdD'], { L: '#9BE05A', d: '#4F9A3A', D: '#2F6B2A' }); }
  });
  function flowerTile(cols) {
    return function (g, r) {
      grassBase(g, r);
      for (var k = 0; k < 3; k++) {
        var x = 2 + (r() * 11) | 0, y = 2 + (r() * 11) | 0, c = cols[(r() * cols.length) | 0];
        g.px(x, y + 2, '#2F6B2A'); g.px(x, y - 1, c); g.px(x - 1, y, c); g.px(x + 1, y, c); g.px(x, y + 1, c); g.px(x, y, '#FFE15A'); g.px(x + 1, y + 1, mix(c, '#000000', .25));
      }
    };
  }
  SDV.defineTile('flowers', flowerTile(['#F58FB1', '#FFFFFF', '#F58FB1', '#B9A4F2']));
  SDV.defineTile('flowersY', flowerTile(['#FFE15A', '#FFFFFF', '#FFB13B']));
  SDV.defineTile('dirt', function (g, r) {
    g.rect(0, 0, 16, 16, '#C98E55');
    for (var i = 0; i < 22; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; g.px(x, y, r() < .5 ? '#B47A45' : '#DBA56C'); }
    for (i = 0; i < 2; i++) { x = 1 + (r() * 13) | 0; y = 1 + (r() * 13) | 0; g.px(x, y, '#9A8C80'); g.px(x + 1, y, '#C9BDB0'); g.px(x, y + 1, '#7A6C60'); }
  });
  SDV.defineTile('stone', function (g, r) {
    g.rect(0, 0, 16, 16, '#8C8A84');
    [[1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 5, 4], [7, 6, 8, 5], [1, 12, 7, 3], [9, 12, 6, 3]].forEach(function (s) {
      g.rect(s[0], s[1], s[2], s[3], '#B8B4AA'); g.hline(s[0], s[1], s[2], '#D8D4CA'); g.hline(s[0], s[1] + s[3] - 1, s[2], '#9A968C');
    });
  });
  SDV.defineTile('planks', function (g, r, tx, ty) {
    var cols = ['#C9884C', '#BE7D42', '#C48448', '#B97A40'];
    for (var b = 0; b < 4; b++) {
      var y = b * 4, c = cols[(b + ty * 4) % 4];
      g.rect(0, y, 16, 4, c); g.hline(0, y, 16, mix(c, '#FFE0B0', .25)); g.hline(0, y + 3, 16, '#8A5228');
      var off = (hash2(tx, ty * 4 + b, 3) % 16);
      g.vline(off, y, 3, '#8A5228'); g.px(off + 1 & 15, y + 1, mix(c, '#FFE0B0', .3));
      if (r() < .4) { var gx = (r() * 14) | 0; g.hline(gx, y + 1 + ((r() * 2) | 0), 2, mix(c, '#6E3A14', .3)); }
    }
  });
  SDV.defineTile('wall', function (g, r, tx, ty) {
    g.rect(0, 0, 16, 16, '#C8402F');
    for (var y = 0; y < 16; y += 2) if ((y + ty * 16) % 8 === 0) g.hline(0, y, 16, '#B83628');
    var ox = (ty % 2) * 8;
    [[ox + 4, 5], [ox + 12 - 16, 12], [ox + 12, 12]].forEach(function (d) { var x = ((d[0] % 16) + 16) % 16; g.ellipse(x + 0.5, d[1] + 0.5, 3, 2.6, '#E9C9A8'); g.ellipse(x + 0.3, d[1] + 0.2, 2.7, 2.2, '#FCE3C0'); g.px(x - 1, d[1] - 1, '#FFF4DC'); });
  });
  SDV.defineTile('wallTop', function (g) {
    g.rect(0, 0, 16, 16, '#7A2018'); g.rect(0, 10, 16, 6, '#A82E22'); g.hline(0, 12, 16, '#C8402F'); g.hline(0, 9, 16, '#5A160F');
    for (var x = 0; x < 16; x += 4) g.px(x + 1, 4, '#8E2A20');
  });
  SDV.defineTile('wallBase', function (g, r, tx) {
    g.rect(0, 0, 16, 16, '#8A5228'); g.rect(0, 0, 16, 3, '#C88A4E'); g.hline(0, 0, 16, '#E2A868'); g.hline(0, 3, 16, '#5A3010');
    g.rect(2, 5, 12, 8, '#9A6230'); g.hline(2, 5, 12, '#6E3A14'); g.vline(2, 5, 8, '#6E3A14'); g.hline(2, 12, 12, '#B5783E');
    g.rect(0, 14, 16, 2, '#5A3010');
  });
  SDV.defineTile('water', function (g, r) {
    g.rect(0, 0, 16, 16, '#4FA8E0');
    for (var i = 0; i < 4; i++) { var x = (r() * 12) | 0, y = (r() * 15) | 0; g.hline(x, y, 3, '#86D2F0'); g.px(x + 3, y + 1, '#2F86C0'); }
  });
  SDV.defineTile('hedge', function (g, r) {
    g.rect(0, 0, 16, 16, '#2F6B2A');
    for (var i = 0; i < 9; i++) { var x = (r() * 16) | 0, y = (r() * 14) | 0; g.ellipse(x, y, 3, 2.5, '#4F9A3A'); g.px(x - 1, y - 1, '#6CC33A'); }
    if (r() < .5) { var bx = 3 + (r() * 10) | 0, by = 3 + (r() * 9) | 0; g.px(bx, by, '#F58FB1'); }
  });
  SDV.defineTile('rugTile', function (g, r, tx, ty) {
    g.rect(0, 0, 16, 16, '#E2566B');
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) if (((x + tx * 16) + (y + ty * 16)) % 8 === 0 || ((x + tx * 16) - (y + ty * 16) + 800) % 8 === 0) g.px(x, y, '#F27C8E');
  });

  /* default map legend */
  SDV.LEGEND = { '.': 'grass', ',': 'grass2', '*': 'flowers', '+': 'flowersY', ':': 'dirt', 'o': 'stone', '=': 'planks', '#': 'wall', '^': 'wallTop', '_': 'wallBase', '~': 'water', 'h': 'hedge', 'r': 'rugTile' };
  var GRASSY = { grass: 1, grass2: 1, flowers: 1, flowersY: 1 };

  /**
   * SDV.tilemap(canvas, {map, tiles, scale=4, seed=1, fringe=true})
   *  map: array of strings, one char per 16x16 tile; tiles: extra/override legend {char: tileName}; ' ' = leave empty.
   *  Sizes the canvas to cols*16*scale x rows*16*scale (real pixels) and draws. Returns the canvas.
   */
  SDV.tilemap = function (canvas, o) {
    o = o || {};
    var map = o.map || [], s = o.scale || PX, legend = Object.assign({}, SDV.LEGEND, o.tiles || {});
    var rows = map.length, cols = Math.max.apply(null, map.map(function (r) { return r.length; }).concat([0]));
    canvas = canvas || document.createElement('canvas');
    var big = new Grid(cols * 16, rows * 16);
    var name = function (tx, ty) { var ch = (map[ty] || '')[tx]; return ch == null ? null : legend[ch] || null; };
    for (var ty = 0; ty < rows; ty++) for (var tx = 0; tx < cols; tx++) {
      var t = name(tx, ty); if (!t || !TILES[t]) continue;
      var g = new Grid(16, 16); TILES[t](g, rng(hash2(tx, ty, o.seed || 1)), tx, ty); big.draw(g, tx * 16, ty * 16);
    }
    if (o.fringe !== false) {   // soft grass edges over dirt/stone paths
      for (ty = 0; ty < rows; ty++) for (tx = 0; tx < cols; tx++) {
        t = name(tx, ty); if (t !== 'dirt' && t !== 'stone') continue;
        var r = rng(hash2(tx, ty, 99));
        [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
          if (!GRASSY[name(tx + d[0], ty + d[1])]) return;
          for (var i = 0; i < 16; i++) {
            var depth = 1 + ((r() * 3) | 0), x, y;
            for (var k = 0; k < depth; k++) {
              if (d[1] === -1) { x = i; y = k; } else if (d[1] === 1) { x = i; y = 15 - k; } else if (d[0] === -1) { x = k; y = i; } else { x = 15 - k; y = i; }
              big.px(tx * 16 + x, ty * 16 + y, k === depth - 1 ? '#4F9A3A' : '#6CC33A');
            }
          }
        });
      }
    }
    canvas.width = cols * 16 * s; canvas.height = rows * 16 * s;
    canvas.style.width = canvas.width + 'px'; canvas.style.height = canvas.height + 'px';
    var ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(big.toCanvas(), 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  /** SDV.tile(name, {scale, tx, ty}) -> canvas of one tile (for sprite sheets / swatches) */
  SDV.tile = function (name, o) { o = o || {}; var cv = document.createElement('canvas'); var g = new Grid(16, 16); TILES[name](g, rng(hash2(o.tx || 0, o.ty || 0, 1)), o.tx || 0, o.ty || 0); var s = o.scale || PX; cv.width = cv.height = 16 * s; cv.style.width = cv.style.height = 16 * s + 'px'; var c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(g.toCanvas(), 0, 0, 16 * s, 16 * s); return cv; };
  SDV.tileNames = function () { return Object.keys(TILES); };
  /* ================================================================
     THE TOADSTOOL SHOP: game art for the playable pixel edition.
     Everything below is drawn from code, at 1 art pixel per canvas pixel.
     ================================================================ */
  function shade(c, t) { return mix(c, '#2A1206', t == null ? 0.28 : t); }
  function light(c, t) { return mix(c, '#FFFFFF', t == null ? 0.32 : t); }
  SDV.shade = shade; SDV.light = light;
  var GOLD = '#E9B949', GOLD_D = '#B8862A', INK = '#2B160A';
  function ring(g, cx, cy, r, col, w) { w = w || 1; for (var y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (var x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) { var d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r && d > r - w) g.px(x, y, col); } }
  function tri(g, ax, ay, by, hw, col, lean) { lean = lean || 0; for (var y = ay; y <= by; y++) { var t = (y - ay) / Math.max(1, by - ay), w = hw * t, cx = ax + lean * (1 - t); g.hline(Math.round(cx - w), y, Math.round(w * 2) + 1, col); } }
  SDV.ring = ring;

  /* ---------- coins: real sizes (nickel biggest, dime smallest), no stamps: the panel prints the value ---------- */
  function coin2(name, r, base, hi, dark, mark) {
    SDV.paintSprite(name, 14, 14, function (g) {
      var c = 7;
      g.ellipse(c, c, r, r, dark);
      g.ellipse(c - 0.4, c - 0.4, r - 0.5, r - 0.5, base);
      ring(g, c - 0.2, c - 0.2, r - 1.6, mix(base, dark, 0.45));
      g.ellipseIn(c - 2, c - 2.2, r * 0.42, r * 0.32, hi);
      if (mark) mark(g, c);
      g.px(Math.round(c + r * 0.55), Math.round(c + r * 0.45), dark);
    }, { kind: 'item' });
  }
  coin2('penny', 5.3, '#D9844E', '#F7B98A', '#9A5028', function (g, c) { g.px(7, 6, '#9A5028'); g.px(7, 7, '#9A5028'); g.px(6, 7, '#B8663A'); g.px(8, 5, '#B8663A'); });
  coin2('nickel', 6.2, '#C9D0D8', '#FFFFFF', '#7E8996', function (g, c) { g.hline(6, 7, 3, '#98A3AE'); g.px(7, 6, '#98A3AE'); });
  coin2('dime', 4.5, '#D6DBE3', '#FFFFFF', '#7E8996', function (g, c) { g.px(7, 7, '#98A3AE'); });
  SDV.paintSprite('coinEdge', 12, 5, function (g) {
    g.rect(1, 1, 10, 3, '#B8663A'); g.hline(1, 1, 10, '#F7B98A'); g.hline(1, 3, 10, '#8A4A22'); g.px(0, 2, '#9A5028'); g.px(11, 2, '#9A5028');
    for (var x = 2; x < 10; x += 2) g.px(x, 2, '#D9844E');
  }, { kind: 'item', outline: '#5B2A0E' });

  /* ---------- goods (16x16) ---------- */
  SDV.paintSprite('tart', 16, 16, function (g) {
    g.ellipse(8, 11, 7, 4, '#9A5E2A'); g.ellipse(8, 10.5, 6.8, 3.6, '#C98E4E');
    g.ellipse(8, 8.6, 6.8, 4, '#E8B878'); g.ellipse(7.8, 8.4, 5.2, 2.8, '#5A2E70');
    for (var a = 0; a < 14; a++) { var t = a / 14 * Math.PI * 2; if (a % 2) g.px(8 + Math.cos(t) * 6.2, 8.6 + Math.sin(t) * 3.5, '#F6D29E'); }
    [[5, 8, '#D43D5F'], [8, 7, '#7A4AA0'], [10, 9, '#D43D5F'], [7, 9, '#9A5ABC'], [11, 7, '#7A4AA0'], [6, 7, '#9A5ABC']].forEach(function (b) { g.px(b[0], b[1], b[2]); });
    g.px(5, 7, '#FFFFFF'); g.px(9, 8, '#FFB0C0');
  }, { kind: 'item' });
  SDV.paintSprite('biscuit', 16, 16, function (g) {
    g.ellipse(8, 9, 6.4, 5.6, '#A86E2E'); g.ellipse(7.6, 8.6, 6, 5.2, '#D9A866'); g.ellipseIn(6, 7, 3, 2, '#EBC488');
    [[5, 7], [9, 6], [10, 10], [6, 11], [8, 9], [11, 8]].forEach(function (p) { g.px(p[0], p[1], '#7A4A22'); g.px(p[0] + 1, p[1], '#8A5634'); });
    g.px(4, 6, '#FFF0C0');
  }, { kind: 'item' });
  SDV.paintSprite('candle', 16, 16, function (g) {
    g.ellipse(8, 13.5, 6.5, 1.8, '#8E76C8'); g.ellipse(8, 13, 6, 1.4, '#B9A6E8'); g.px(3, 13, '#D9CCF6');
    g.rect(6, 5, 4, 8, '#FFF3D6'); g.vline(9, 5, 8, '#E8D2A0'); g.vline(6, 6, 6, '#FFFFFF'); g.px(7, 5, '#F2E2BC');
    g.px(8, 4, '#5A3416');
    g.ellipse(8, 2.4, 1.3, 2.1, '#FFB23B'); g.px(8, 2, '#FFF6C8'); g.px(8, 3, '#FFE07A');
  }, { kind: 'item' });
  SDV.paintSprite('seeds', 16, 16, function (g) {
    g.rect(3, 2, 10, 13, '#C9B58C'); g.rect(3, 2, 9, 12, '#E9DCC4'); g.rect(3, 2, 10, 2, '#D6C29C'); g.hline(3, 4, 10, '#B8A276');
    g.vline(8, 9, 4, '#3F8F2A'); g.px(9, 11, '#6CC33A'); g.px(7, 12, '#6CC33A');
    g.ellipse(8, 8, 2.6, 2.4, '#F6A6BD'); g.px(8, 7, '#FFE15A'); g.px(7, 7, '#FFE15A'); g.px(6, 6, '#FFD0DC');
    g.px(4, 13, '#8A5634'); g.px(11, 12, '#8A5634');
  }, { kind: 'item' });
  SDV.paintSprite('teacup', 16, 16, function (g) {
    g.ellipse(8, 13.5, 7, 1.8, '#C8D0D8'); g.ellipse(8, 13, 6.4, 1.3, '#F4F6F8'); g.hline(3, 13, 10, '#F2A7B5');
    g.ellipse(12.5, 8.5, 2.2, 2.2, '#D97A8C'); g.ellipse(12.5, 8.5, 1, 1, null);
    g.rect(3, 6, 9, 5, '#FFFFFF'); g.ellipse(7.5, 10.5, 4.5, 2.4, '#FFFFFF'); g.rectIn(10, 6, 2, 7, '#DCE4EC');
    g.hline(3, 8, 9, '#F2A7B5'); g.px(5, 8, '#FFFFFF'); g.px(8, 8, '#FFFFFF');
    g.ellipse(7.5, 6, 4.6, 1.3, '#E8EDF2'); g.ellipse(7.5, 6.2, 3.6, 0.9, '#B8763A');
    g.px(4, 9, '#FFFFFF'); g.px(5, 3, '#FFFFFF'); g.px(7, 2, '#FFFFFF'); g.px(9, 3, '#FFFFFF');
  }, { kind: 'item', outline: '#5B4A58' });
  var GOOD_SPRITE = { bun: 'acornBun', apple: 'apple', honey: 'honeyJar', tart: 'tart', biscuit: 'biscuit', candle: 'candle', seeds: 'seeds', teacup: 'teacup' };
  SDV.GOOD_SPRITE = GOOD_SPRITE;

  /* shelf minis (7x7): up to ten of each sit on a shelf bay */
  function mini(name, fn) { SDV.paintSprite('mini_' + name, 7, 7, fn, { kind: 'mini' }); }
  mini('bun', function (g) { g.ellipse(3.5, 4.4, 2.5, 1.7, '#E8A24A'); g.ellipse(3.5, 3, 2.5, 1.3, '#8A5A2E'); g.px(3, 1, '#5A3416'); g.px(2, 4, '#F7C873'); });
  mini('apple', function (g) { g.ellipse(3.5, 4, 2.4, 2.1, '#E23B3B'); g.px(3, 1, '#6B4220'); g.px(4, 1, '#6CC33A'); g.px(2, 3, '#FF8A70'); });
  mini('honey', function (g) { g.rect(1, 2, 5, 4, '#F2A81D'); g.hline(1, 1, 5, '#E2566B'); g.px(2, 3, '#FFD45A'); g.hline(2, 4, 3, '#FFF4DC'); });
  mini('tart', function (g) { g.ellipse(3.5, 4, 2.6, 1.6, '#E8B878'); g.hline(2, 3, 3, '#6A3F8C'); g.px(3, 3, '#D43D5F'); g.hline(1, 5, 5, '#B5782E'); });
  mini('biscuit', function (g) { g.ellipse(3.5, 3.5, 2.5, 2.3, '#D9A866'); g.px(2, 3, '#7A4A22'); g.px(4, 2, '#7A4A22'); g.px(4, 4, '#7A4A22'); });
  mini('candle', function (g) { g.rect(2, 2, 3, 4, '#FFF3D6'); g.px(3, 1, '#FFB23B'); g.hline(1, 5, 5, '#B9A6E8'); });
  mini('seeds', function (g) { g.rect(1, 1, 5, 5, '#E9DCC4'); g.px(3, 2, '#F6A6BD'); g.px(2, 3, '#F6A6BD'); g.px(4, 3, '#F6A6BD'); g.px(3, 4, '#3F8F2A'); g.px(3, 3, '#FFE15A'); });
  mini('teacup', function (g) { g.rect(1, 2, 4, 3, '#FFFFFF'); g.hline(1, 2, 4, '#B8763A'); g.px(5, 3, '#F2A7B5'); g.hline(0, 5, 6, '#DCE4EC'); g.px(2, 3, '#F2A7B5'); });

  /* ---------- small icons (16x16) for the HUD and buttons ---------- */
  SDV.paintSprite('icoSound', 16, 16, function (g) {
    g.rect(2, 6, 3, 4, '#9A6230'); g.vline(2, 6, 4, '#C88A4E');
    for (var i = 0; i < 4; i++) g.vline(5 + i, 5 - i, 6 + 2 * i, i % 2 ? '#C88A4E' : '#D9A066');
    g.vline(11, 6, 4, '#5B2A0E'); g.px(10, 5, '#5B2A0E'); g.px(10, 10, '#5B2A0E');
    g.vline(13, 4, 8, '#5B2A0E'); g.px(12, 3, '#5B2A0E'); g.px(12, 12, '#5B2A0E');
  }, { kind: 'icon' });
  SDV.paintSprite('icoMute', 16, 16, function (g) {
    g.rect(2, 6, 3, 4, '#9A8C80'); for (var i = 0; i < 4; i++) g.vline(5 + i, 5 - i, 6 + 2 * i, '#B8ACA0');
    g.px(11, 6, '#7A6C60'); g.px(12, 7, '#7A6C60'); g.px(13, 8, '#7A6C60'); g.px(14, 9, '#7A6C60'); g.px(14, 6, '#7A6C60'); g.px(13, 7, '#7A6C60'); g.px(11, 9, '#7A6C60'); g.px(12, 8, '#7A6C60');
  }, { kind: 'icon' });
  SDV.paintSprite('icoShelf', 16, 16, function (g) {
    var books = [['#E2566B', 9], ['#5A8FC7', 10], ['#6CC33A', 8], ['#F7C531', 10], ['#B9A6E8', 9]];
    books.forEach(function (b, i) { var x = 2 + i * 2 + (i > 2 ? 1 : 0), h = b[1]; g.rect(x, 13 - h, 2, h, b[0]); g.px(x, 13 - h + 2, '#FFF4DC'); });
    g.rect(1, 13, 14, 2, '#9A6230'); g.hline(1, 13, 14, '#D9A066');
  }, { kind: 'icon' });
  SDV.paintSprite('icoGear', 16, 16, function (g) {
    for (var a = 0; a < 8; a++) { var t = a / 8 * Math.PI * 2; g.rect(Math.round(7 + Math.cos(t) * 5.5), Math.round(7 + Math.sin(t) * 5.5), 2, 2, '#8C8A84'); }
    g.ellipse(8, 8, 5, 5, '#8C8A84'); g.ellipse(7.6, 7.6, 4.4, 4.4, '#B8B4AA'); g.ellipse(8, 8, 1.8, 1.8, null); g.px(5, 5, '#E8E4DA');
  }, { kind: 'icon' });
  SDV.paintSprite('icoStar', 16, 16, function (g) {
    g.map(1, 1, ['......YY......', '.....YYYY.....', '.....YHYY.....', 'YYYYYHYYYYYYYY', '.YYHHYYYYYYYD.', '..YYYYYYYYYD..', '...YYYYYYYD...', '...YYYYYYYD...', '..YYYYDYYYYD..', '..YYYD..DYYD..', '.YYD......DYD.', '.YD........DD.'], { Y: '#F7C531', H: '#FFF3A8', D: '#D0891C' });
  }, { kind: 'icon' });
  SDV.paintSprite('icoPoint', 16, 16, function (g) {
    g.map(3, 0, ['..ss.....', '.sSSs....', '.sSSs....', '.sSSs....', '.sSSsss..', '.sSSsSSss', 'ssSSsSSsSs', 'sSSSSSSSSs', 'sSSSSSSSSs', 'sSSSSSSSSs', '.sSSSSSSs.', '.sSSSSSSs.', '..ssssss..', '..CCCCCC..', '..CccccC..'], { s: '#C99A6C', S: '#F2DCC0', C: '#3A6FB5', c: '#6A9FE0' });
  }, { kind: 'icon' });
  SDV.paintSprite('icoBulb', 16, 16, function (g) {
    g.ellipse(8, 6, 5, 5, '#F7C531'); g.ellipse(7.5, 5.5, 4.4, 4.4, '#FFE15A'); g.rect(6, 9, 4, 2, '#FFE15A'); g.px(5, 3, '#FFFFFF'); g.px(6, 3, '#FFF6C8'); g.px(5, 4, '#FFF6C8');
    g.rect(6, 11, 4, 3, '#9A968C'); g.hline(6, 12, 4, '#C9C5BA'); g.hline(7, 14, 2, '#5B2A0E');
  }, { kind: 'icon' });
  SDV.paintSprite('icoAnchor', 16, 16, function (g) {
    var c = '#3A6FB5'; g.ellipse(8, 2.5, 1.8, 1.8, c); g.px(8, 2, null); g.vline(7, 4, 9, c); g.vline(8, 4, 9, c); g.hline(4, 6, 8, c);
    g.line(2, 9, 4, 12, c); g.line(4, 12, 7, 13, c); g.line(13, 9, 11, 12, c); g.line(11, 12, 8, 13, c); g.px(2, 8, c); g.px(13, 8, c);
  }, { kind: 'icon' });

  /* ---------- characters: built from a species head + a body + accessories ---------- */
  var HEADS = {
    mouse: ['........', '........', '..FFF...', '.FfhfF..', '.Fpppf..', '.Fpppf.f', '.Fppffff', '..Fffhhf', '..ffffhh', '.fffffff', '.fffffff', '.fffweff', '.Fffeeff', '.Fffeeff', '.Fccffmm', '..Fcfmmn', '..FFfmmm', '...FFfff'],
    cat: ['........', '........', '........', '.F......', '.fF.....', '.fpF....', '.fppFfff', '.ffpffff', '.fhhffFf', '.fhfffff', '.fffffff', '.fffweff', '.Fffeeff', '.Fffeeff', '.Fccffmm', '..Fcfmmn', '..FFfmmm', '...FFfff'],
    rabbit: ['...ff...', '..fppf..', '..fppf..', '..fppf..', '..fppf..', '..fppf..', '..fppF..', '..ffFfff', '.fhhffff', '.fhfffff', '.fffffff', '.fffweff', '.Fffeeff', '.Fffeeff', '.Fccffmm', '..Fcfmmn', '..FFfmmm', '...FFfff'],
  };
  var BODIES = {
    dress: ['....gGda', '...ddDaa', '..dddaaa', '..ddDaAa', '..ffDaaa', '..ffdaaa', '...dAaaa', '...daaaa', '..dDaaaa', '..DDAAAA', '...ddddd', '....kkk.', '...kkkk.', '........'],
    fur: ['....gGff', '...fFfbb', '..fffbbb', '..fFfbbb', '..ffFbbb', '..fffbbb', '...fBbbb', '...fbbbb', '..fFfbbb', '..FFfBbb', '...FFfff', '....kkk.', '...kkkk.', '........'],
  };
  var TPL = {
    bunbury: ['........', '...ff...', '..fpf...', '..fpf...', '..fpf...', '..fpf...', '..fpF...', '..yyyyyy', '.yhhyyyy', '.yrrrrrr', 'yYRRRRRR', 'yYffffff', 'yYffweff', 'yYffeeff', 'yYfceeff', '.yYcfffn', '.yYfffff', '..YrrFff', '..rRraaa', '..ddaaad', '.dddddda', '.dDdddda', '.ffDdaaa', '.ffdaaaa', '..ddaaaa', '..dDaaaa', '.ddDaaaa', '.dDDAAAA', '..DDdddd', '....kk..', '...kkk..', '........'],
    bramble: ['........', '........', '.....ggg', '...gghhg', '..tggggg', '.tsgggGg', '.ssGGGGG', 'tssbbbbb', '.sssffff', 'tssfffff', '.ssfweff', 'tssfeeff', '.ssfeeff', 'tsscffff', '.sssffmm', '..ssfmmn', '..sssfmm', '...rrrrr', '..rRrrrr', '.ssjjrRf', '.ssjjjff', '.sfjJjff', '..fjjjff', '..fjJjff', '...jjjff', '...JJJJf', '...pppPp', '...ppPpp', '...pp...', '..kkk...', '..kkk...', '........'],
    hazel: ['........', '........', '........', '........', '........', '....bb..', '...bBbb.', '..tsbbBk', '.tsssbbk', '.sssffff', 'tssfffff', '.ssfweff', 'tssfeeff', '.ssceeff', 'tsscffff', '.sssffmm', '..ssfmmn', '..sssfmm', '...gggaa', '..sgggaa', '..fgGgaa', '..fggggg', '...ggGgg', '...gggGg', '..gGgggg', '..GGGGGG', '....ff..', '...kkk..', '...kkk..', '........', '........', '........'],
    owl: ['........', '........', '........', '........', '.t......', '.tt.....', '.bttbbbb', '.bbbbBbb', 'bbbwwwbb', 'bbwGGGGw', 'bbGwwwwG', 'bbGweewG', 'bbGwewwG', 'bbGwwwwG', 'bbwGGGGw', 'bbbwwwwk', 'bbbbwwkk', 'BbbbbcLL', 'BbbbcLcL', 'BBbbLLLL', 'BBbbcLcL', 'BBbbLLLL', '.BbbcLcL', '.BbbLLLL', '.BBbbLLL', '..BBbbbb', '...BBBBB', '....oo.o', '...ooo..', '........', '........', '........'],
    fairy: ['........', '.....c.c', '....cccc', '...hhhjj', '..hhhhhh', '..hHffff', '.hhfffff', '.hhfffff', '.hhfweff', '.hhfeeff', '.hhfeeff', '.hHcffff', '..hffffn', '..hhffff', 'W.hhFfff', 'WW.h.FFf', 'WWW.aaaa', 'WVWWdDdd', 'WVWddddd', '.WVfdDdd', '.WWfdddd', '..WfdDdd', '...ddddd', '...dDddd', '...ddddd', '..dDdddd', '..dddddd', '.dDddddd', '.aaaaaaa', '....kk..', '........', '........'],
  };
  // the owl and Hazel sit 2px lower so all feet share one baseline
  var DROP = { owl: 2, hazel: 2 };

  function specKey(spec) { return JSON.stringify(spec || {}); }
  function hasAcc(spec, a) { return (spec.acc || []).indexOf(a) >= 0; }

  function charLayers(spec) {
    var sp = spec.species, fur = spec.fur || '#C99A6C', belly = spec.belly || light(fur, 0.4);
    var dress = spec.dress, d2 = spec.dress2 || '#FFF3E6';
    var pal = { f: fur, F: shade(fur, 0.3), h: light(fur, 0.35), p: '#F3A3B2', e: INK, w: '#FFFFFF', c: '#F59A8A', m: belly, b: belly, B: shade(belly, 0.16), n: '#D8566E', T: '#E89AA6', k: '#6E3A1C' };
    var rows, mirror = true, tpl = null;
    if (sp === 'hedgehog') {
      tpl = hasAcc(spec, 'scarf') ? 'bramble' : 'hazel';
      var spk = spec.spikes || '#6B4A33';
      Object.assign(pal, { s: spk, t: light(spk, 0.45), f: fur, F: shade(fur, 0.15), m: light(fur, 0.45), n: INK });
      if (tpl === 'bramble') { var sc = spec.scarf || '#E2566B'; Object.assign(pal, { r: sc, R: shade(sc, 0.25), g: '#4F8A3A', G: '#36662A', h: '#7DB85C', b: '#2E5222', j: '#9A6236', J: '#74462A', p: '#5E6E8E', P: '#46526E', k: '#4A2A14', c: '#F2A595' }); }
      else { var bw = spec.bowColor || '#F58FB1'; Object.assign(pal, { b: bw, B: shade(bw, 0.2), k: light(bw, 0.5), g: '#7CC35A', G: '#4F9A3A', a: '#FFF6E2', A: '#E3CBA4', c: '#F7A0A0' }); }
      rows = TPL[tpl];
    } else if (sp === 'owl') {
      tpl = 'owl';
      Object.assign(pal, { b: fur, B: shade(fur, 0.28), t: light(fur, 0.25), w: light(belly, 0.25), G: hasAcc(spec, 'glasses') ? '#D9A43A' : '#F2C94C', k: '#F2A63A', L: belly, c: shade(belly, 0.2), o: '#F2A63A' });
      rows = TPL.owl;
    } else if (sp === 'fairy') {
      tpl = 'fairy';
      var hair = spec.hair || '#F2D27A', dr = spec.dress || '#D4C4FF';
      pal = { c: GOLD, j: '#F58FB1', h: hair, H: shade(hair, 0.2), f: '#FBE3D0', F: '#E8C4AE', e: INK, w: '#FFFFFF', n: '#E2566B', W: '#FFF1C4', V: '#E9B949', a: spec.dress2 || '#FFF3CF', d: dr, D: shade(dr, 0.22), k: GOLD };
      pal.c = '#F59A8A'; pal.C = GOLD;
      rows = TPL.fairy.map(function (r, i) { return i < 3 ? r.replace(/c/g, 'C') : r; });
    } else if (sp === 'rabbit' && hasAcc(spec, 'bonnet')) {
      tpl = 'bunbury';
      var bon = spec.bonnet || '#FFF3E6', dr2 = dress || '#9FC7E8';
      Object.assign(pal, { y: bon, Y: shade(bon, 0.18), h: '#FFFFFF', r: '#F58FB1', R: '#D9637F', d: dr2, D: shade(dr2, 0.25), a: '#FFFFFF', A: '#D6E2EE', c: '#F7A9A0', n: '#E06A80', F: shade(fur, 0.15) });
      rows = TPL.bunbury;
    } else {
      var head = HEADS[sp] || HEADS.mouse, body;
      if (dress) {
        body = BODIES.dress;
        Object.assign(pal, { d: dress, D: shade(dress, 0.25), g: d2, G: shade(d2, 0.15) });
        if (spec.apron) Object.assign(pal, { a: '#FFFAF0', A: '#E6D2B4', g: light(dress, 0.3), G: dress });
        else if (spec.keeper) Object.assign(pal, { a: dress, A: shade(dress, 0.25), g: light(dress, 0.3), G: dress });
        else Object.assign(pal, { a: light(dress, 0.12), A: shade(dress, 0.12) });
      } else {
        body = BODIES.fur;
        var scarf = hasAcc(spec, 'scarf') ? (spec.scarf || '#E2566B') : null;
        Object.assign(pal, { g: scarf || fur, G: scarf ? shade(scarf, 0.25) : shade(fur, 0.3), k: shade(fur, 0.35) });
      }
      if (sp === 'rabbit') pal.n = '#E06A80';
      if (sp === 'cat') { pal.n = '#E58A9C'; pal.p = '#F3A3B2'; }
      rows = head.concat(body);
    }
    return { rows: rows, pal: pal, mirror: mirror, tpl: tpl };
  }

  function accessorize(g, spec) {
    var sp = spec.species, fur = spec.fur || '#C99A6C';
    if (sp === 'mouse' && !spec.noTail) g.map(13, 22, ['.T', '.T', 'T.', 'T.', '.T'], { T: '#E89AA6' });
    if (sp === 'cat') g.map(0, 20, ['.ff', 'f..', 'f..', '.f.', '..f'], { f: shade(fur, 0.15) });
    if (sp === 'rabbit' && spec.flop) { for (var y = 0; y < 7; y++) for (var x = 9; x < 16; x++) g.px(x, y, null); g.map(10, 6, ['fff..', '.fppf', '..fpf', '...ff'], { f: fur, p: '#F3A3B2' }); g.px(10, 7, fur); }
    if (hasAcc(spec, 'glasses') && sp !== 'owl') { [3, 9].forEach(function (x) { g.hline(x, 10, 4, GOLD); g.hline(x, 14, 4, GOLD); g.vline(x, 11, 3, GOLD); g.vline(x + 3, 11, 3, GOLD); }); g.hline(7, 11, 2, GOLD); }
    if (hasAcc(spec, 'scarf') && sp !== 'hedgehog' && !spec.dress) { g.rect(11, 19, 2, 4, spec.scarf || '#E2566B'); g.vline(12, 19, 4, shade(spec.scarf || '#E2566B', 0.25)); }
    if (hasAcc(spec, 'bow') && sp !== 'hedgehog') { var bc = spec.bowColor || '#FFFFFF', bs = bc.toLowerCase() === '#ffffff' ? '#D8CCC4' : shade(bc, 0.25); g.map(10, 5, ['BB.BB', 'BBKBB', 'B...B'], { B: bc, K: bs }); }
    if (hasAcc(spec, 'sailor')) { g.rect(4, 4, 8, 3, '#FFFFFF'); g.hline(4, 4, 8, '#F4F6F8'); g.hline(3, 7, 10, '#3A6FB5'); g.hline(3, 8, 10, '#E8EDF2'); g.px(7, 3, '#E2566B'); g.px(8, 3, '#E2566B'); g.px(11, 5, '#DCE4EC'); }
    if (hasAcc(spec, 'tricorn')) { var hd = '#2E2A3A'; g.rect(3, 4, 10, 3, hd); g.hline(0, 7, 16, hd); g.rect(0, 5, 2, 2, hd); g.rect(14, 5, 2, 2, hd); g.hline(4, 3, 8, hd); [3, 7, 12].forEach(function (x) { g.px(x, 7, GOLD); }); g.px(1, 5, GOLD); g.px(14, 5, GOLD); g.rect(7, 4, 2, 2, '#FFFFFF'); }
    if (hasAcc(spec, 'eyepatch')) { var ep = '#1E1A24'; g.rect(9, 10, 4, 4, ep); g.line(9, 10, 3, 8, ep); g.px(13, 10, ep); g.px(14, 9, ep); }
    if (hasAcc(spec, 'collar')) { for (var cx = 3; cx < 13; cx++) g.px(cx, 18, cx % 2 ? GOLD : '#3A7BD5'); for (cx = 4; cx < 12; cx++) g.px(cx, 19, cx % 3 ? GOLD : '#3A7BD5'); g.px(7, 20, GOLD); g.px(8, 20, GOLD); }
    if (hasAcc(spec, 'leaves')) { for (var lx = 2; lx < 14; lx++) g.px(lx, 8, lx % 2 ? '#7CB36A' : '#4F8A3A'); [3, 6, 9, 12].forEach(function (x) { g.px(x, 7, '#9BD08A'); }); }
    if (sp === 'fairy') { g.rect(6, 1, 1, 1, null); }
    if (spec.keeper) keeperClothes(g, spec);
  }
  // The shopkeeper's wardrobe (wardrobe.js): the dress fabric over the dress pixels, and what she wears.
  function printAt(pr, x, y, base, light2) {
    if (pr === 'dots') return (x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 && y % 2 === 0 ? '#FFFFFF' : base;
    if (pr === 'stripes') return x % 3 === 0 ? light2 : base;
    if (pr === 'gingham') return x % 2 && y % 2 ? shade(base, 0.12) : (x % 2 || y % 2) ? light(base, 0.2) : light(base, 0.45);
    if (pr === 'hearts') return (x * 3 + y * 5) % 11 === 0 ? '#E2566B' : base;
    if (pr === 'stars') return (x * 5 + y * 3) % 11 === 0 ? '#FFF3A8' : base;
    return base;
  }
  function paintPrint(g, spec, y0, y1) {
    var pr = spec.print || 'flowers'; if (pr === 'flowers' || pr === 'plain' || !spec.dress) return;
    var d = spec.dress, D = shade(d, 0.25), lt = light(d, 0.5);
    for (var y = y0; y < y1; y++) for (var x = 0; x < g.w; x++) { var c = g.get(x, y); if (c === d || c === D) g.px(x, y, printAt(pr, x, y, c, c === D ? light(D, 0.4) : lt)); }
  }
  function keeperClothes(g, spec) {
    paintPrint(g, spec, 18, 30);
    var GOLDS = GOLD, straw = '#E6C27A', strawS = '#B8904A', rib = '#F58FB1';
    if (hasAcc(spec, 'scarf')) { var sc = '#E2566B'; g.hline(4, 18, 8, sc); g.hline(5, 19, 6, shade(sc, 0.25)); g.rect(10, 19, 2, 4, sc); g.vline(11, 19, 4, shade(sc, 0.25)); }
    if (hasAcc(spec, 'pearls')) { for (var px = 4; px < 12; px++) g.px(px, 18, px % 2 ? '#FBF3EA' : '#D8CCC0'); g.px(7, 19, '#FBF3EA'); g.px(8, 19, '#F58FB1'); }
    if (hasAcc(spec, 'sunhat')) { g.hline(0, 7, 16, straw); g.px(0, 7, strawS); g.px(15, 7, strawS); g.hline(1, 8, 14, strawS); g.rect(4, 4, 8, 3, straw); g.hline(5, 3, 6, straw); g.hline(4, 6, 8, rib); g.px(10, 5, '#FFFFFF'); g.px(11, 6, '#FFFFFF'); g.px(9, 6, '#FFFFFF'); g.px(10, 6, '#F7C531'); }
    if (hasAcc(spec, 'flowercrown')) { var cols = ['#F6A6BD', '#FFD86B', '#FFFFFF', '#C9B6F0']; for (var lx = 2; lx < 14; lx++) g.px(lx, 8, '#7CB36A'); [2, 5, 8, 11].forEach(function (x, i) { g.px(x, 7, cols[i]); g.px(x + 1, 7, cols[i]); g.px(x, 8, cols[i]); g.px(x + 1, 8, shade(cols[i], 0.15)); }); }
    if (hasAcc(spec, 'tiara')) { g.hline(4, 7, 8, GOLDS); [4, 11].forEach(function (x) { g.px(x, 6, GOLDS); }); g.px(7, 5, GOLDS); g.px(8, 5, GOLDS); g.px(7, 4, '#FFF6B8'); g.px(7, 6, '#F58FB1'); g.px(8, 6, '#F58FB1'); }
    if (hasAcc(spec, 'wings')) {
      var wl = '#DCEEFF', we = GOLDS;
      [[0, 17], [0, 18], [1, 18], [0, 19], [1, 19], [2, 19], [0, 20], [1, 20], [2, 20], [1, 21], [2, 21], [1, 23], [2, 23], [1, 24]].forEach(function (p) {
        [p[0], 15 - p[0]].forEach(function (x) { if (!g.get(x, p[1])) g.px(x, p[1], p[0] === 0 || p[1] === 24 ? we : wl); });
      });
    }
  }

  /** SDV.character(spec) -> sprite name, frames: 0 idle, 1 breathe, 2 step left, 3 step right */
  SDV.character = function (spec) {
    var key = 'ch:' + specKey(spec);
    if (DEFS[key]) return key;
    var L = charLayers(spec);
    var g = rowsToGrid(L.rows, L.pal, L.mirror);
    accessorize(g, spec);
    if (DROP[L.tpl]) g = g.shiftRows(0, 31, DROP[L.tpl]);
    var breathe = g.shiftRows(0, L.tpl === 'owl' ? 17 : 17, 1);
    function step(left) {
      var s = g.clone();
      for (var y = 27; y < 32; y++) for (var x = 0; x < 16; x++) { var on = left ? x < 8 : x >= 8; if (on) s.px(x, y, null); }
      for (y = 27; y < 32; y++) for (x = 0; x < 16; x++) { var on2 = left ? x < 8 : x >= 8; if (on2 && g.get(x, y)) s.px(x, y - 1, g.get(x, y)); }
      return s;
    }
    register(key, [g, breathe, step(true), step(false)], { kind: 'char' });
    return key;
  };
  SDV.charKey = function (spec) { return 'ch:' + specKey(spec); };

  /* ---------- portraits (48x48, frame 1 = blink) for every speaker ---------- */
  function eyesP(g, f, x1, x2, y, col, big) {
    [x1, x2].forEach(function (x) {
      if (f === 1) { g.rect(x - 2, y + 1, 5, 1, col); g.px(x - 3, y, col); g.px(x + 3, y, col); return; }
      g.ellipse(x + 0.5, y + 0.5, big ? 2.6 : 2.2, big ? 3.6 : 3, col);
      g.rect(x - 1, y - 2, 2, 2, '#FFFFFF'); g.px(x + 1, y + 2, '#FFFFFF');
    });
  }
  function bustP(g, col, sh) { g.ellipse(24, 50, 19, 14, col); g.ellipseIn(30, 54, 19, 14, sh); g.ellipseIn(22, 50, 17, 14, col); }
  function collarP(g, spec, dress) {
    if (hasAcc(spec, 'collar')) { for (var i = 0; i < 9; i++) { var t = (i / 8) * Math.PI; g.ellipse(24 - Math.cos(t) * 11, 37 + Math.sin(t) * 4, 1.8, 1.8, i % 2 ? '#3A7BD5' : GOLD); } g.ellipse(24, 42, 2, 2, GOLD); return; }
    if (hasAcc(spec, 'pearls')) { for (var k = 0; k < 11; k++) { var tk = (k / 10) * Math.PI; g.ellipse(24 - Math.cos(tk) * 10, 37 + Math.sin(tk) * 4, 1.5, 1.5, k % 2 ? '#FBF3EA' : '#E8DCCB'); } g.ellipse(24, 42, 1.8, 1.8, '#F58FB1'); return; }
    if (hasAcc(spec, 'scarf')) { var sc = spec.scarf || '#E2566B'; g.ellipse(24, 37, 10, 3, sc); g.hline(15, 38, 18, shade(sc, 0.25)); g.rect(28, 38, 4, 8, sc); g.vline(31, 38, 8, shade(sc, 0.25)); return; }
    if (dress) { var d2 = spec.dress2 || '#FFF3E6'; g.ellipse(19, 37.5, 4.4, 2.6, d2); g.ellipse(29, 37.5, 4.4, 2.6, d2); g.px(24, 38, shade(d2, 0.2)); }
  }
  function mouseLike(g, f, spec, cat) {
    var fur = spec.fur || '#C99A6C', furS = shade(fur, 0.3), furL = light(fur, 0.35), belly = spec.belly || light(fur, 0.4), pink = '#F3A3B2';
    var dress = spec.dress, body = dress || fur;
    bustP(g, body, shade(body, 0.25));
    if (!dress) g.ellipse(24, 46, 8, 6, belly);
    if (spec.keeper) keeperPortrait(g, spec, body);
    if (spec.apron) { g.rect(17, 39, 14, 9, '#FFFAF0'); g.vline(17, 39, 9, '#E6D2B4'); g.vline(30, 39, 9, '#E6D2B4'); g.rect(21, 42, 6, 3, '#F5E6C8'); g.hline(21, 42, 6, '#E6D2B4'); }
    collarP(g, spec, dress);
    if (cat) {
      [[11, 1, -1], [37, 1, 1]].forEach(function (e) { tri(g, e[0], e[1], 16, 7, furS, 0); tri(g, e[0], e[1] + 2, 16, 6, fur); tri(g, e[0], e[1] + 6, 15, 3.4, pink); });
    } else {
      [[10, 10], [38, 10]].forEach(function (p) { g.ellipse(p[0], p[1], 8, 8, furS); g.ellipse(p[0] - 0.5, p[1] - 0.5, 7, 7, fur); g.ellipse(p[0], p[1] + 0.5, 4.6, 4.6, pink); g.ellipse(p[0] + 0.5, p[1] + 1.5, 3, 3, '#E58A9C'); });
    }
    g.ellipse(24, 23, 15, 13, furS); g.ellipse(23.5, 22.5, 14, 12, fur); g.ellipseIn(20, 15, 7, 4, furL);
    if (cat && !spec.dress2) { g.vline(21, 11, 3, furS); g.vline(24, 10, 4, furS); g.vline(27, 11, 3, furS); }
    if (cat) {
      g.ellipse(24, 30, 6, 4, belly); g.ellipse(24, 30.6, 5, 3.2, light(belly, 0.3));
      g.map(22, 27, ['XXXXX', '.XXX.', '..X..'], { X: '#E58A9C' });
      g.px(22, 31, '#7A3A22'); g.px(23, 32, '#7A3A22'); g.px(24, 31, '#7A3A22'); g.px(25, 32, '#7A3A22'); g.px(26, 31, '#7A3A22');
    } else {
      g.ellipse(24, 30, 7.5, 5, belly); g.ellipse(24, 31, 6.5, 4, light(belly, 0.3));
      g.ellipse(24, 27.2, 2.6, 1.8, '#D8566E'); g.px(23, 26, '#F7B0BE');
      g.px(22, 31, '#7A3A22'); g.px(23, 32, '#7A3A22'); g.px(24, 31, '#7A3A22'); g.px(25, 32, '#7A3A22'); g.px(26, 31, '#7A3A22');
    }
    g.line(14, 28, 8, 27, furS); g.line(14, 30, 8, 31, furS); g.line(34, 28, 40, 27, furS); g.line(34, 30, 40, 31, furS);
    g.ellipse(14.5, 26.5, 2.6, 1.6, '#F59A8A'); g.ellipse(33.5, 26.5, 2.6, 1.6, '#F59A8A');
    eyesP(g, f, 17, 31, 21, INK, true);
    g.hline(15, 16, 4, furS); g.hline(30, 16, 4, furS);
    headAcc(g, f, spec);
  }
  function keeperPortrait(g, spec, body) {
    var pr = spec.print || 'flowers', D = shade(body, 0.25), lt = light(body, 0.5);
    if (pr !== 'flowers' && pr !== 'plain') for (var y = 34; y < 48; y++) for (var x = 0; x < 48; x++) {
      var c = g.get(x, y); if (c !== body && c !== D) continue;
      var big = pr === 'dots' ? ((x + (Math.floor(y / 4) % 2) * 3) % 6 < 2 && y % 4 < 2 ? '#FFFFFF' : c)
        : pr === 'stripes' ? (x % 6 < 2 ? (c === D ? light(D, 0.4) : lt) : c)
        : pr === 'gingham' ? ((x % 6 < 3) && (y % 6 < 3) ? shade(c, 0.1) : (x % 6 < 3) || (y % 6 < 3) ? light(c, 0.2) : light(c, 0.45))
        : pr === 'hearts' ? (((x + y * 2) % 13 === 0 || (x + 1 + y * 2) % 13 === 0) && y % 3 === 0 ? '#E2566B' : c)
        : pr === 'stars' ? ((x * 5 + y * 3) % 17 === 0 ? '#FFF3A8' : c) : c;
      g.px(x, y, big);
    }
    if (hasAcc(spec, 'wings')) { var wl = '#DCEEFF'; [[6, 33], [42, 33]].forEach(function (p) { g.ellipse(p[0], p[1], 5, 8, wl, function (x, y) { return g.get(x, y) === null; }); }); }
  }
  function headAcc(g, f, spec) {
    if (hasAcc(spec, 'sunhat')) { var st = '#E6C27A', ss = '#B8904A'; g.ellipse(24, 11, 22, 4.2, ss); g.ellipse(24, 10.5, 21, 3.6, st); g.ellipse(24, 6, 11, 6, st); g.ellipseIn(20, 3, 5, 2, '#F4DCA0'); g.rect(13, 8, 22, 3, '#F58FB1'); g.hline(13, 8, 22, '#F9AFC8'); g.ellipse(33, 8, 3, 3, '#FFFFFF'); g.ellipse(33, 8, 1.4, 1.4, '#F7C531'); }
    if (hasAcc(spec, 'flowercrown')) { var cols = ['#F6A6BD', '#FFD86B', '#FFFFFF', '#C9B6F0', '#F58FB1']; g.hline(10, 12, 28, '#7CB36A'); for (var i = 0; i < 6; i++) { var fx = 11 + i * 5.2, fy = 11 - Math.sin(i / 5 * Math.PI) * 2; g.ellipse(fx, fy, 2.6, 2.6, cols[i % cols.length]); g.ellipse(fx, fy, 1, 1, '#F7C531'); } }
    if (hasAcc(spec, 'tiara')) { g.hline(14, 11, 20, GOLD); g.hline(14, 12, 20, GOLD_D); [15, 20, 24, 28, 32].forEach(function (x, i) { tri(g, x + 0.5, i === 2 ? 4 : i % 2 ? 7 : 8, 11, 1.4, GOLD); }); g.ellipse(24, 11, 1.6, 1.6, '#F58FB1'); }
    if (hasAcc(spec, 'leaves')) { for (var j = 0; j < 9; j++) { var lx = 10 + j * 3.6, ly = 12 - Math.sin(j / 8 * Math.PI) * 3; g.ellipse(lx, ly, 2.2, 1.4, j % 2 ? '#7CB36A' : '#4F8A3A'); } }
    if (hasAcc(spec, 'glasses')) { ring(g, 17.5, 21.5, 5.4, GOLD); ring(g, 31.5, 21.5, 5.4, GOLD); g.hline(22, 20, 4, GOLD); g.px(12, 20, GOLD); g.px(36, 20, GOLD); }
    if (hasAcc(spec, 'eyepatch')) { var ep = '#1E1A24'; g.ellipse(31.5, 21.5, 4.6, 4.2, ep); g.px(30, 19, '#4A4458'); g.line(28, 18, 13, 12, ep); g.line(35, 19, 39, 22, ep); }
    if (hasAcc(spec, 'bow')) { var bc = spec.bowColor || '#FFFFFF', bs = bc.toLowerCase() === '#ffffff' ? '#D8CCC4' : shade(bc, 0.25); g.ellipse(32, 6, 4, 3, bs); g.ellipse(31.6, 5.6, 3.4, 2.4, bc); g.ellipse(42, 6, 4, 3, bs); g.ellipse(41.6, 5.6, 3.4, 2.4, bc); g.ellipse(37, 6.5, 2, 2, bs); g.px(36, 5, '#FFFFFF'); }
    if (hasAcc(spec, 'sailor')) { g.ellipse(24, 10, 11, 4, '#E8EDF2'); g.ellipse(24, 9, 10, 3.6, '#FFFFFF'); g.rect(13, 11, 22, 3, '#3A6FB5'); g.hline(13, 11, 22, '#5A8FD5'); g.ellipse(24, 4.5, 2.2, 2, '#E2566B'); }
    if (hasAcc(spec, 'tricorn')) { var hd = '#2E2A3A', hl = '#4A4458'; g.ellipse(24, 7, 11, 6, hd); g.ellipse(24, 11, 19, 3.6, hd); g.ellipse(7, 8, 3.4, 4, hd); g.ellipse(41, 8, 3.4, 4, hd); g.hline(8, 12, 32, GOLD); g.ellipseIn(20, 4, 5, 2, hl); g.ellipse(24, 9, 2.6, 2.6, '#FFFFFF'); g.ellipse(24, 9, 1.2, 1.2, '#E2566B'); }
  }
  function rabbitP(g, f, spec) {
    var fur = spec.fur || '#F5EEE2', furS = shade(fur, 0.16), pink = '#F3A3B2', dress = spec.dress || '#FFD86B';
    bustP(g, dress, shade(dress, 0.25)); collarP(g, spec, dress);
    g.ellipse(17, 6, 4, 9, furS); g.ellipse(16.5, 5.5, 3.4, 8.4, fur); g.ellipse(17, 6.5, 1.6, 6, pink);
    if (spec.flop) { g.ellipse(37, 13, 9, 3.6, furS); g.ellipse(36.5, 12.5, 8.4, 3, fur); g.ellipse(38, 13, 6, 1.4, pink); }
    else { g.ellipse(31, 6, 4, 9, furS); g.ellipse(30.5, 5.5, 3.4, 8.4, fur); g.ellipse(31, 6.5, 1.6, 6, pink); }
    g.ellipse(24, 25, 13.5, 12, furS); g.ellipse(23.6, 24.6, 13, 11.6, fur); g.ellipseIn(19, 17, 6, 3, '#FFFFFF');
    g.ellipse(24, 31, 5.5, 3.6, '#FFFFFF');
    g.ellipse(24, 29, 2, 1.5, '#E06A80'); g.px(23, 32, '#9C5A4A'); g.px(25, 32, '#9C5A4A'); g.px(24, 31, '#9C5A4A');
    g.ellipse(15.5, 29.5, 2.4, 1.5, '#F7A9A0'); g.ellipse(32.5, 29.5, 2.4, 1.5, '#F7A9A0');
    eyesP(g, f, 18.5, 29.5, 24, INK, false);
    headAcc(g, f, spec);
  }
  function bunburyP(g, f, spec) {
    var fur = spec.fur || '#F5EEE2', furS = shade(fur, 0.16), straw = spec.bonnet || '#FFF3E6', strawS = shade(straw, 0.2), dress = spec.dress || '#7FB4E3';
    bustP(g, dress, shade(dress, 0.25));
    for (var i = 0; i < 7; i++) g.ellipse(13.5 + i * 3.5, 38, 2.2, 2.2, '#FFFFFF');
    g.hline(12, 40, 24, '#D6E2EE');
    g.ellipse(17, 6, 4, 9, furS); g.ellipse(16.5, 5.5, 3.4, 8.4, fur); g.ellipse(17, 6.5, 1.6, 6, '#F3A3B2');
    g.ellipse(31, 6, 4, 9, furS); g.ellipse(30.5, 5.5, 3.4, 8.4, fur); g.ellipse(31, 6.5, 1.6, 6, '#F3A3B2');
    g.ellipse(24, 23, 19, 17, strawS); g.ellipse(23.5, 22, 18, 16, straw);
    for (var y = 9; y < 40; y += 3) for (var x = 6; x < 42; x += 4) if (g.get(x + (y % 2) * 2, y) === straw) g.px(x + (y % 2) * 2, y, mix(straw, strawS, 0.5));
    g.ellipseIn(17, 11, 8, 3, '#FFFFFF');
    g.ellipse(24, 14.5, 17, 2.4, '#F58FB1'); g.ellipse(24, 15.5, 17, 1.2, '#D9637F');
    g.ellipse(24, 26, 12.5, 11, furS); g.ellipse(23.6, 25.6, 12, 10.6, fur);
    g.ellipse(24, 31, 5.5, 3.6, '#FFFFFF'); g.ellipse(24, 29, 2, 1.5, '#E06A80');
    g.px(23, 32, '#9C5A4A'); g.px(25, 32, '#9C5A4A'); g.px(24, 31, '#9C5A4A');
    g.ellipse(15.5, 29.5, 2.4, 1.5, '#F7A9A0'); g.ellipse(32.5, 29.5, 2.4, 1.5, '#F7A9A0');
    eyesP(g, f, 18.5, 29.5, 24, INK, false);
    g.px(15, 21, INK); g.px(33, 21, INK);
    g.ellipse(19, 38, 3.4, 2.4, '#F58FB1'); g.ellipse(29, 38, 3.4, 2.4, '#F58FB1'); g.ellipse(24, 38, 2, 2, '#D9637F');
    g.line(22, 40, 20, 44, '#D9637F'); g.line(26, 40, 28, 44, '#D9637F');
  }
  function hedgehogP(g, f, spec) {
    var sp = spec.spikes || '#6B4A33', spL = light(sp, 0.18), tip = light(sp, 0.5), face = spec.fur || '#F0DCBC', faceS = shade(face, 0.15);
    var bramble = hasAcc(spec, 'scarf');
    if (bramble) { bustP(g, '#9A6236', '#74462A'); g.rect(19, 39, 10, 9, '#F4EAD2'); g.px(24, 42, '#C9A27A'); g.px(24, 45, '#C9A27A'); }
    else { bustP(g, '#7CC35A', '#4F9A3A'); g.rect(18, 40, 12, 8, '#FFF6E2'); g.hline(18, 40, 12, '#E3CBA4'); }
    g.ellipse(24, 24, 20, 17, sp);
    for (var a = 0; a < 26; a++) { var ang = Math.PI * (0.92 + a * 0.046), r = 20.5, x = 24 + Math.cos(ang) * r * 1.02, y = 24 + Math.sin(ang) * r * 0.86; g.ellipse(x, y, 2, 2, a % 2 ? sp : spL); g.px(x + Math.cos(ang) * 2, y + Math.sin(ang) * 2, tip); }
    for (var k = 0; k < 40; k++) { var rx = 6 + (k * 37 % 36), ry = 8 + (k * 23 % 20); if (g.get(rx, ry) === sp) g.line(rx, ry, rx + 1, ry - 2, spL); }
    g.ellipse(24, 27, 12, 10.5, faceS); g.ellipse(23.5, 26.5, 11.5, 10, face);
    g.ellipse(24, 32, 6, 4.5, light(face, 0.45));
    g.ellipse(24, 30.6, 2.6, 2, INK); g.px(23, 30, '#6A4A3A');
    g.px(22, 34, '#7A3A22'); g.px(23, 35, '#7A3A22'); g.px(24, 35, '#7A3A22'); g.px(25, 35, '#7A3A22'); g.px(26, 34, '#7A3A22');
    g.ellipse(15, 29, 2.4, 1.5, '#F2A595'); g.ellipse(33, 29, 2.4, 1.5, '#F2A595');
    eyesP(g, f, 18.5, 29.5, 25, INK, !bramble);
    if (bramble) {
      g.hline(16, 20, 4, spL); g.hline(28, 20, 4, spL);
      g.ellipse(24, 11, 15, 7, '#36662A'); g.ellipse(23.5, 10, 14, 6, '#4F8A3A'); g.ellipseIn(19, 7, 6, 2, '#7DB85C');
      g.rect(10, 15, 28, 3, '#2E5222'); g.hline(10, 15, 28, '#36662A'); g.ellipse(24, 3.5, 2, 1.5, '#36662A');
      var sc = spec.scarf || '#E2566B'; g.ellipse(24, 38, 11, 3, sc); g.hline(14, 39, 20, shade(sc, 0.25)); g.rect(28, 39, 4, 7, sc); g.vline(31, 39, 7, shade(sc, 0.25));
    } else {
      var bw = spec.bowColor || '#F58FB1'; g.ellipse(30, 7, 5, 3.6, shade(bw, 0.2)); g.ellipse(29.6, 6.6, 4.4, 3, bw); g.ellipse(40, 7, 5, 3.6, shade(bw, 0.2)); g.ellipse(39.6, 6.6, 4.4, 3, bw); g.ellipse(35, 7.5, 2.4, 2.4, shade(bw, 0.25)); g.px(29, 5, '#FFFFFF');
    }
  }
  function owlP(g, f, spec) {
    var fur = spec.fur || '#A8865E', furS = shade(fur, 0.28), furL = light(fur, 0.25), belly = spec.belly || '#F1DFC2';
    g.ellipse(24, 50, 20, 16, furS); g.ellipse(23.6, 49.6, 19, 15, fur); g.ellipse(24, 48, 10, 10, belly);
    for (var i = 0; i < 6; i++) { var x = 18 + (i % 3) * 5 + (i > 2 ? 2 : 0), y = 42 + (i > 2 ? 4 : 0); g.px(x, y, shade(belly, 0.25)); g.px(x + 1, y + 1, shade(belly, 0.25)); g.px(x + 2, y, shade(belly, 0.25)); }
    tri(g, 9, 2, 14, 4, furS, -1); tri(g, 39, 2, 14, 4, furS, 1);
    g.ellipse(24, 24, 18, 16, furS); g.ellipse(23.6, 23.6, 17.4, 15.4, fur); g.ellipseIn(18, 12, 9, 4, furL);
    var disc = light(belly, 0.2);
    g.ellipse(17, 24, 7.4, 7.4, shade(belly, 0.12)); g.ellipse(31, 24, 7.4, 7.4, shade(belly, 0.12));
    g.ellipse(17, 24, 6.6, 6.6, disc); g.ellipse(31, 24, 6.6, 6.6, disc);
    var rimC = hasAcc(spec, 'glasses') ? '#D9A43A' : '#F2C94C';
    g.ellipse(17, 24, 4.2, 4.2, '#F2C94C'); g.ellipse(31, 24, 4.2, 4.2, '#F2C94C');
    if (f === 1) { g.ellipse(17, 24, 4.2, 4.2, fur); g.ellipse(31, 24, 4.2, 4.2, fur); g.hline(14, 24, 6, INK); g.hline(28, 24, 6, INK); }
    else { g.ellipse(17, 24, 2.7, 2.7, INK); g.ellipse(31, 24, 2.7, 2.7, INK); g.rect(15, 22, 2, 2, '#FFFFFF'); g.rect(29, 22, 2, 2, '#FFFFFF'); }
    if (hasAcc(spec, 'glasses')) { ring(g, 17, 24, 6.6, rimC, 1.4); ring(g, 31, 24, 6.6, rimC, 1.4); g.hline(23, 22, 2, rimC); }
    tri(g, 24, 27, 33, 2.6, '#E08A2A'); tri(g, 24, 27, 31, 1.6, '#F2A63A');
    if (hasAcc(spec, 'leaves')) { for (var a = 0; a < 11; a++) { var t = Math.PI * (1.1 + a * 0.08), lx = 24 + Math.cos(t) * 17, ly = 20 + Math.sin(t) * 13; g.ellipse(lx, ly, 2.4, 1.6, a % 2 ? '#7CB36A' : '#5A9A4A'); g.px(lx - 1, ly - 1, '#B8E0A0'); } }
  }
  function fairyP(g, f, spec) {
    var hair = spec.hair || '#F2D27A', hairS = shade(hair, 0.2), skin = '#FBE3D0', skinS = '#E8C4AE', dress = spec.dress || '#D4C4FF';
    g.ellipse(7, 30, 7, 12, '#E9B949'); g.ellipse(7, 30, 6, 11, '#FFF1C4'); g.ellipse(41, 30, 7, 12, '#E9B949'); g.ellipse(41, 30, 6, 11, '#FFF1C4');
    g.px(5, 25, '#FFFFFF'); g.px(43, 25, '#FFFFFF'); g.px(6, 33, '#F7DE8A'); g.px(42, 33, '#F7DE8A');
    bustP(g, dress, shade(dress, 0.22));
    g.ellipse(24, 38, 9, 3, spec.dress2 || '#FFF3CF'); g.rect(22, 33, 4, 5, skinS);
    g.ellipse(24, 21, 15, 15, hairS); g.ellipse(23.6, 20.6, 14.4, 14.4, hair);
    g.ellipse(24, 6, 6, 5, hairS); g.ellipse(23.6, 5.6, 5.4, 4.4, hair);
    g.rect(10, 22, 4, 14, hair); g.rect(34, 22, 4, 14, hair);
    g.ellipse(24, 25, 11, 11, skinS); g.ellipse(23.7, 24.7, 10.5, 10.5, skin);
    g.ellipse(24, 15.5, 11, 3.5, hair); g.px(16, 18, hair); g.px(32, 18, hair);
    g.ellipse(16, 29, 2.4, 1.5, '#F59A8A'); g.ellipse(32, 29, 2.4, 1.5, '#F59A8A');
    eyesP(g, f, 19, 29, 24, '#4A2A5A', true);
    g.hline(22, 31, 4, '#D9637F'); g.px(21, 30, '#D9637F'); g.px(26, 30, '#D9637F');
    g.rect(15, 10, 18, 3, GOLD); g.hline(15, 12, 18, GOLD_D); [15, 20, 24, 28, 32].forEach(function (x, i) { tri(g, x + 0.5, i % 2 ? 6 : 4, 10, 1.4, GOLD); });
    g.ellipse(24, 11, 1.6, 1.6, '#F58FB1'); g.px(18, 11, '#86D2F0'); g.px(30, 11, '#86D2F0'); g.px(16, 10, '#FFF6B8');
  }
  SDV.portrait = function (spec) {
    var key = 'pt:' + specKey(spec);
    if (DEFS[key]) return key;
    var sp = spec.species;
    SDV.paintSprite(key, 48, 48, function (g, f) {
      if (sp === 'rabbit') (hasAcc(spec, 'bonnet') ? bunburyP : rabbitP)(g, f, spec);
      else if (sp === 'hedgehog') hedgehogP(g, f, spec);
      else if (sp === 'owl') owlP(g, f, spec);
      else if (sp === 'fairy') fairyP(g, f, spec);
      else mouseLike(g, f, spec, sp === 'cat');
    }, { frames: 2, kind: 'portrait' });
    return key;
  };

  /* ---------- decorations: thumbnails (24x24) and scene pieces ---------- */
  function signFace(g, x, y, w, h) { g.rect(x, y, w, h, '#7A4A22'); g.rect(x + 1, y + 1, w - 2, h - 2, '#C98A5A'); g.rect(x + 2, y + 2, w - 4, h - 4, '#FFF3DC'); }
  SDV.paintSprite('d_sign', 24, 24, function (g) { g.rect(11, 12, 3, 11, '#7A4A22'); g.vline(12, 12, 11, '#9A6230'); signFace(g, 1, 3, 22, 11); g.hline(5, 7, 14, '#7A3D2A'); g.hline(7, 9, 10, '#7A3D2A'); g.ellipse(12, 23, 6, 1.2, '#4F9A3A'); }, { kind: 'decor' });
  function vase(g, x, y) { g.rect(x + 2, y + 7, 6, 8, '#4F86BE'); g.rect(x + 1, y + 9, 8, 5, '#7BB4D9'); g.rect(x + 3, y + 6, 4, 2, '#7BB4D9'); g.vline(x + 2, y + 9, 4, '#A8D4F0'); g.hline(x + 2, y + 15, 6, '#3E6E9E');
    g.vline(x + 4, y + 2, 5, '#3F8F2A'); g.vline(x + 6, y + 3, 4, '#3F8F2A'); g.px(x + 2, y + 4, '#3F8F2A');
    [[x + 4, y + 1, '#F58FB1'], [x + 7, y + 2, '#FFE15A'], [x + 1, y + 3, '#FFFFFF'], [x + 5, y + 4, '#F58FB1']].forEach(function (p) { g.rect(p[0] - 1, p[1], 3, 1, p[2]); g.rect(p[0], p[1] - 1, 1, 3, p[2]); g.px(p[0], p[1], '#FFE15A'); }); }
  SDV.paintSprite('vase', 11, 17, function (g) { vase(g, 0, 1); }, { kind: 'object' });
  SDV.paintSprite('d_vase', 24, 24, function (g) { g.ellipse(12, 21, 8, 1.6, '#C9A06A'); vase(g, 7, 5); }, { kind: 'decor' });
  function awning(g, x, y, w) { for (var i = 0; i < w; i++) { var c = Math.floor(i / 3) % 2 ? '#FFF3DC' : '#E2566B'; g.vline(x + i, y, 5, c); g.px(x + i, y, Math.floor(i / 3) % 2 ? '#FFFFFF' : '#F27C8E'); }
    for (i = 0; i < w; i += 3) { var cc = Math.floor(i / 3) % 2 ? '#FFF3DC' : '#E2566B'; g.rect(x + i, y + 5, 3, 1, cc); g.px(x + i + 1, y + 6, cc); } g.hline(x, y - 1, w, '#A8323F'); }
  SDV.paintSprite('awningScene', 30, 9, function (g) { awning(g, 0, 1, 30); }, { kind: 'object' });
  SDV.paintSprite('d_awning', 24, 24, function (g) { g.rect(3, 6, 18, 16, '#FFF0D8'); g.rect(8, 12, 8, 10, '#9A6230'); g.ellipse(12, 12, 4, 3, '#9A6230'); awning(g, 1, 4, 22); }, { kind: 'decor' });
  function rug(g, cx, cy, rx, ry) { [['#E2566B', 1], ['#F7C531', 0.8], ['#5A9FD5', 0.6], ['#F58FB1', 0.4], ['#FFF4DC', 0.2]].forEach(function (r) { g.ellipse(cx, cy, rx * r[1], ry * r[1], r[0]); }); }
  SDV.paintSprite('rugScene', 52, 28, function (g) { rug(g, 26, 14, 25, 13); }, { kind: 'object', outline: '#A8323F' });
  SDV.paintSprite('d_rug', 24, 24, function (g) { rug(g, 12, 13, 11, 8); }, { kind: 'decor', outline: '#A8323F' });
  function wbox(g, x, y, w) { g.rect(x, y + 3, w, 4, '#3E6E9E'); g.rect(x, y + 3, w, 3, '#5A8FC7'); g.hline(x, y + 3, w, '#8CB8E6');
    for (var i = 1; i < w - 1; i += 2) { var c = ['#F58FB1', '#FFE15A', '#E2566B', '#FFFFFF'][(i >> 1) % 4]; g.px(x + i, y + 2, '#3F8F2A'); g.px(x + i, y + 1, c); g.px(x + i, y, (i >> 1) % 2 ? c : '#3F8F2A'); } }
  SDV.paintSprite('windowBoxS', 16, 8, function (g) { wbox(g, 0, 0, 16); }, { kind: 'object' });
  SDV.paintSprite('windowBoxXS', 12, 8, function (g) { wbox(g, 0, 0, 12); }, { kind: 'object' });
  SDV.paintSprite('d_windowboxes', 24, 24, function (g) { g.rect(2, 2, 20, 14, '#FFF0D8'); g.ellipse(12, 9, 6, 6, '#5B2A0E'); g.ellipse(12, 9, 5, 5, '#86D2F0'); g.rect(11, 4, 2, 10, '#C88A4E'); g.rect(7, 8, 10, 2, '#C88A4E'); wbox(g, 3, 14, 18); }, { kind: 'decor' });
  SDV.paintSprite('bellScene', 10, 12, function (g) { g.rect(4, 0, 2, 2, '#9A6230'); g.ellipse(5, 6, 3.6, 3.8, '#D0891C'); g.ellipse(4.6, 5.6, 3, 3.2, '#F7C531'); g.rect(1, 8, 8, 2, '#B86E12'); g.px(3, 4, '#FFF3A8'); g.ellipse(5, 11, 1.2, 1, '#9A6230'); }, { kind: 'object' });
  SDV.paintSprite('d_bell', 24, 24, function (g) { g.hline(4, 3, 16, '#7A4A22'); g.rect(11, 3, 2, 4, '#9A6230'); g.ellipse(12, 12, 6, 6, '#D0891C'); g.ellipse(11.5, 11.5, 5.4, 5.4, '#F7C531'); g.rect(5, 14, 14, 4, '#D0891C'); g.rect(5, 14, 13, 3, '#F7C531'); g.rect(4, 17, 16, 2, '#B86E12'); g.px(9, 9, '#FFF3A8'); g.px(9, 10, '#FFF3A8'); g.ellipse(12, 21, 1.8, 1.4, '#9A6230'); }, { kind: 'decor' });
  function lantern(g, x, y, lit) { g.rect(x + 2, y, 2, 1, '#4A2A14'); g.rect(x + 1, y + 1, 4, 1, '#5B2A0E'); g.rect(x, y + 2, 6, 6, '#5B2A0E'); g.rect(x + 1, y + 3, 4, 4, lit ? '#FFF0A8' : '#FFE6A0'); g.px(x + 2, y + 4, '#FFFFFF'); g.rect(x + 1, y + 8, 4, 1, '#5B2A0E'); }
  SDV.paintSprite('lanternPost', 8, 26, function (g, f) { g.rect(3, 9, 2, 17, '#6E4222'); g.vline(3, 9, 17, '#9A6236'); g.hline(1, 9, 6, '#6E4222'); lantern(g, 1, 0, f === 1); }, { kind: 'object', frames: 2 });
  SDV.paintSprite('d_lanterns', 24, 24, function (g) { g.rect(11, 9, 2, 14, '#6E4222'); g.hline(8, 9, 8, '#6E4222'); g.rect(7, 1, 10, 2, '#5B2A0E'); g.rect(6, 3, 12, 6, '#5B2A0E'); g.rect(7, 4, 10, 4, '#FFE6A0'); g.rect(9, 5, 2, 2, '#FFFFFF'); g.ellipse(12, 23, 6, 1.2, '#4F9A3A'); }, { kind: 'decor' });
  var FLAGS = ['#E2566B', '#F7C531', '#5A9FD5', '#6CC33A', '#B9A6E8'];
  SDV.paintSprite('d_bunting', 24, 24, function (g) { g.line(1, 5, 12, 9, '#7A4A22'); g.line(12, 9, 23, 5, '#7A4A22'); for (var i = 0; i < 5; i++) { var x = 2 + i * 4.4 | 0, y = 6 + (i < 3 ? i : 4 - i) | 0; tri(g, x + 1.5, y + 7, y + 1, 1.6, FLAGS[i]); g.hline(x, y + 1, 4, FLAGS[i]); } }, { kind: 'decor' });
  function cat(g, x, y, f) { var c = '#F0B46A', s = '#C9853A'; g.ellipse(x + 8, y + 5.5 + (f ? 0.3 : 0), 7, 3.6 + (f ? 0.4 : 0), c); g.ellipse(x + 3.5, y + 4, 3.4, 3, c); g.px(x + 1, y + 1, c); g.px(x + 5, y + 1, c); g.px(x + 2, y + 4, '#5B2A0E'); g.px(x + 4, y + 4, '#5B2A0E'); g.px(x + 3, y + 5, '#E58A9C'); for (var i = 0; i < 4; i++) g.vline(x + 8 + i * 2, y + 3, 2, s); g.hline(x + 11, y + 8, 4, s); }
  function bed(g, x, y) { g.ellipse(x + 13, y + 10, 13, 6, '#8E76C8'); g.ellipse(x + 13, y + 9, 12, 5, '#B9A6E8'); g.ellipse(x + 13, y + 9, 9, 3.4, '#D9CCF6'); }
  SDV.paintSprite('catBed', 28, 18, function (g, f) { bed(g, 1, 1); cat(g, 5, 2, f); }, { kind: 'object', frames: 2, ms: 1400 });
  SDV.paintSprite('d_catbed', 24, 24, function (g) { bed(g, -1, 8); cat(g, 3, 9, 0); }, { kind: 'decor' });
  var BEADS = ['#FFE15A', '#F58FB1', '#86D2F0', '#9BE5C0'];
  SDV.BEADS = BEADS;
  SDV.paintSprite('d_fairylights', 24, 24, function (g) { for (var x = 1; x < 23; x++) { var y = 6 + Math.round(Math.sin(x / 22 * Math.PI) * 6); g.px(x, y, '#5A4A3A'); } for (var i = 0; i < 7; i++) { var bx = 2 + i * 3, by = 7 + Math.round(Math.sin(bx / 22 * Math.PI) * 6); g.rect(bx, by, 2, 2, BEADS[i % 4]); g.px(bx, by, '#FFFFFF'); } for (x = 3; x < 22; x += 6) { g.px(x, 18, '#FFF3A8'); g.px(x + 2, 20, '#FFF3A8'); } }, { kind: 'decor' });
  SDV.DECOR_THUMB = { sign: 'd_sign', vase: 'd_vase', awning: 'd_awning', rug: 'd_rug', windowboxes: 'd_windowboxes', bell: 'd_bell', lanterns: 'd_lanterns', bunting: 'd_bunting', catbed: 'd_catbed', fairylights: 'd_fairylights' };

  /* ---------- scene pieces ---------- */
  // the toadstool house; frame 0 by day (sky in the windows), frame 1 at dusk (lamp-lit)
  SDV.paintSprite('house', 80, 96, function (g, f) {
    var win = f ? '#FFE07A' : '#9ED8F2', winL = f ? '#FFF6C8' : '#FFFFFF';
    g.ellipse(40, 82, 26, 10, '#D6C2A0');
    g.rect(14, 44, 52, 40, '#D6C2A0'); g.rect(15, 44, 49, 39, '#FFF0D8'); g.rect(56, 44, 8, 39, '#E8D6B4'); g.ellipse(40, 82, 24.5, 8.5, '#FFF0D8'); g.ellipseIn(58, 80, 8, 8, '#E8D6B4');
    for (var y = 48; y < 86; y += 6) g.hline(18 + (y % 12 ? 0 : 6), y, 5, '#EAD8B6');
    g.ellipse(40, 66, 9, 9, '#5B2A0E'); g.rect(31, 66, 18, 20, '#5B2A0E'); g.ellipse(40, 66, 7.5, 7.5, '#9A6230'); g.rect(33, 66, 14, 19, '#9A6230');
    [36, 40, 44].forEach(function (x) { g.vline(x, 59, 26, '#7A4A22'); }); g.rect(44, 72, 2, 2, '#F7C531'); g.px(44, 72, '#FFF3A8');
    g.ellipse(23, 60, 6, 6, '#5B2A0E'); g.ellipse(23, 60, 5, 5, win); g.px(21, 57, winL); g.px(20, 58, winL); g.rect(22, 55, 2, 10, '#C88A4E'); g.rect(18, 59, 10, 2, '#C88A4E');
    g.ellipse(58, 56, 4, 4, '#5B2A0E'); g.ellipse(58, 56, 3, 3, win); g.px(57, 54, winL);
    g.ellipse(40, 32, 40, 22, '#8E1F16'); g.ellipse(40, 30, 39, 21, '#D63A2B');
    g.ellipseIn(30, 20, 22, 10, '#E85A43'); g.ellipseIn(24, 14, 10, 4, '#F58A6A');
    g.rect(0, 44, 80, 12, null);
    g.ellipse(40, 44, 38, 5, '#8E1F16'); g.rect(0, 44, 80, 6, null);
    g.ellipse(40, 41, 38, 4, '#B02A20'); g.rect(0, 44, 80, 4, null);
    g.ellipse(40, 46, 30, 3, '#F2B8C0'); for (var gx = 14; gx < 68; gx += 3) g.px(gx, 45, '#D98C9A');
    [[20, 22, 5, 3.4], [40, 14, 6, 3.6], [60, 22, 5, 3.4], [30, 33, 4, 2.6], [52, 34, 4.4, 2.8], [10, 34, 2.6, 2], [70, 34, 2.6, 2], [46, 24, 2.4, 1.8]].forEach(function (d) {
      g.ellipseIn(d[0], d[1] + 0.6, d[2], d[3], '#E8D6B4'); g.ellipseIn(d[0] - 0.3, d[1], d[2] - 0.3, d[3] - 0.3, '#FFF4DC');
    });
    g.rect(58, 2, 6, 10, '#9A6236'); g.rect(59, 2, 4, 9, '#C88A4E'); g.rect(57, 1, 8, 2, '#6E4222');
  }, { kind: 'object', frames: 2 });
  SDV.HOUSE = { w: 80, h: 96, doorX: 40, doorY: 85, winL: [23, 60, 5], winR: [58, 56, 3] };
  // Bramble's cart with its blue and cream striped canopy and three crates
  SDV.paintSprite('cartFull', 52, 50, function (g) {
    g.rect(4, 22, 3, 14, '#7A4A22'); g.rect(45, 22, 3, 14, '#7A4A22');
    for (var i = 0; i < 48; i++) { var c = Math.floor(i / 4) % 2 ? '#FFF3DC' : '#5A8FC7'; g.vline(2 + i, 10, 6, c); g.px(2 + i, 10, Math.floor(i / 4) % 2 ? '#FFFFFF' : '#8CB8E6'); }
    for (i = 0; i < 48; i += 4) { var cc = Math.floor(i / 4) % 2 ? '#FFF3DC' : '#5A8FC7'; g.rect(2 + i, 16, 4, 1, cc); g.rect(3 + i, 17, 2, 1, cc); }
    g.ellipse(26, 10, 24, 4, '#3E6E9E'); g.ellipse(26, 9.5, 23, 3.4, '#5A8FC7'); g.hline(6, 8, 40, '#8CB8E6');
    g.rect(2, 26, 48, 14, '#7A4A22'); g.rect(3, 27, 46, 12, '#B5763A'); for (var x = 3; x < 49; x += 6) g.vline(x, 27, 12, '#9A6230'); g.hline(3, 27, 46, '#D9A066'); g.rect(0, 25, 52, 2, '#9A6230');
    [[6, '#E23B3B', '#A8261E'], [20, '#E8A24A', '#8A5A2E'], [34, '#F2A81D', '#E2566B']].forEach(function (cr) { var cx = cr[0]; g.rect(cx, 19, 12, 7, '#C88A4E'); g.hline(cx, 19, 12, '#E2A868'); g.vline(cx, 19, 7, '#9A6230'); for (var k = 0; k < 4; k++) { g.ellipse(cx + 2 + k * 2.6, 18.5, 1.6, 1.6, cr[1]); g.px(cx + 2 + k * 2.6, 17, cr[2]); } });
    [[12, 42], [40, 42]].forEach(function (w) { g.ellipse(w[0], w[1], 7, 7, '#5B2A0E'); g.ellipse(w[0], w[1], 5.6, 5.6, '#C88A4E'); g.ellipse(w[0], w[1], 4, 4, '#5B2A0E'); g.ellipse(w[0], w[1], 3, 3, '#9A6230'); g.ellipse(w[0], w[1], 1.2, 1.2, '#F7C531'); });
    g.line(50, 30, 51, 22, '#7A4A22');
  }, { kind: 'object' });
  SDV.paintSprite('shroom', 7, 7, function (g) { g.rect(3, 4, 1, 3, '#FFF0D8'); g.ellipse(3.5, 3, 3, 2, '#D63A2B'); g.px(2, 2, '#FFF4DC'); g.px(4, 3, '#FFF4DC'); }, { kind: 'object' });
  SDV.paintSprite('rock', 9, 6, function (g) { g.ellipse(4.5, 3.5, 4, 2.6, '#9A968C'); g.ellipseIn(3.6, 2.6, 2.4, 1.4, '#C9C5BA'); }, { kind: 'object' });
  SDV.paintSprite('lily', 10, 6, function (g) { g.ellipse(5, 3, 4.4, 2.4, '#4F9A3A'); g.px(5, 3, null); g.px(6, 2, null); g.px(4, 2, '#FFFFFF'); g.px(3, 2, '#F58FB1'); }, { kind: 'object', outline: false });
  SDV.paintSprite('stepStone', 12, 7, function (g) { g.ellipse(6, 3.5, 5.6, 3, '#9A968C'); g.ellipse(5.6, 3, 5, 2.4, '#C9C5BA'); g.px(3, 2, '#E8E4DA'); }, { kind: 'object', outline: '#6E6A62' });
  // inside the shop
  SDV.paintSprite('shelfUnit', 124, 72, function (g) {
    var wd = '#6E3A14', w = '#9A6230', wl = '#C88A4E';
    g.rect(0, 2, 124, 70, wd); g.rect(2, 4, 120, 66, '#7A4A22');
    for (var y = 6; y < 68; y += 4) g.hline(3, y, 118, '#6E4222');
    g.rect(0, 0, 124, 4, wl); g.hline(0, 0, 124, '#E2A868');
    [24, 46, 68].forEach(function (y) { g.rect(0, y - 3, 124, 3, w); g.hline(0, y - 3, 124, wl); g.hline(2, y, 120, '#5A3010'); });
    [0, 41, 82, 122].forEach(function (x) { g.rect(x, 2, 2, 70, w); g.vline(x, 2, 70, wl); });
  }, { kind: 'object' });
  SDV.SHELF = { w: 124, h: 72, bayX: [3, 44, 85], rowBase: [68 - 3, 46 - 3, 24 - 3] };
  SDV.paintSprite('counterLong', 124, 30, function (g) {
    g.rect(0, 6, 124, 24, '#7A4A22'); g.rect(1, 7, 122, 22, '#B5763A');
    for (var x = 5; x < 120; x += 12) { g.rect(x, 11, 8, 14, '#9A6230'); g.hline(x, 11, 8, '#7A4A22'); g.vline(x, 11, 14, '#7A4A22'); g.hline(x, 24, 8, '#C88A4E'); }
    g.rect(0, 0, 124, 7, '#9A6230'); g.rect(0, 0, 124, 6, '#D9A066'); g.hline(0, 0, 124, '#F2C98E'); g.hline(0, 6, 124, '#6E3A14');
    for (var i = 4; i < 124; i += 11) g.hline(i, 3, 5, '#C88A4E');
    g.hline(1, 29, 122, '#5A3010');
  }, { kind: 'object' });
  SDV.paintSprite('tillBlue', 20, 18, function (g) {
    g.rect(1, 6, 18, 11, '#4F86BE'); g.rect(2, 7, 16, 9, '#7BB4D9'); g.hline(2, 7, 16, '#A8D4F0');
    g.rect(3, 1, 10, 6, '#3E6E9E'); g.rect(4, 2, 8, 4, '#2F6B2A'); g.px(5, 3, '#B8F07A'); g.px(7, 3, '#B8F07A'); g.px(9, 3, '#B8F07A');
    for (var x = 4; x < 16; x += 3) { g.rect(x, 9, 2, 2, GOLD); g.rect(x, 12, 2, 2, GOLD); }
    g.rect(14, 2, 3, 5, GOLD); g.rect(1, 15, 18, 2, '#3E6E9E');
  }, { kind: 'object' });
  SDV.paintSprite('windowIn', 34, 30, function (g) {
    g.ellipse(17, 14, 12, 12, '#5B2A0E'); g.ellipse(17, 14, 11, 11, '#C88A4E'); g.ellipse(17, 14, 9, 9, '#5B2A0E');
    g.ellipse(17, 14, 8, 8, '#86D2F0'); g.ellipseIn(17, 20, 9, 5, '#6CC33A'); g.ellipseIn(13, 11, 3, 2, '#FFFFFF');
    g.rect(16, 5, 2, 18, '#C88A4E'); g.rect(8, 13, 18, 2, '#C88A4E');
    [[2, 1], [27, -1]].forEach(function (c) { var x = c[0]; g.rect(x, 2, 5, 22, '#F58FB1'); g.vline(x + (c[1] > 0 ? 4 : 0), 2, 22, '#D9637F'); g.vline(x + 2, 4, 18, '#F7A9C4'); g.rect(x, 24, 5, 4, '#F58FB1'); g.hline(x - 1, 28, 7, '#D9637F'); });
    g.rect(0, 0, 34, 2, '#7A4A22'); g.hline(0, 0, 34, '#C88A4E');
  }, { kind: 'object' });
  SDV.paintSprite('doorIn', 24, 34, function (g, f) {
    g.ellipse(12, 12, 12, 12, '#5B2A0E'); g.rect(0, 12, 24, 22, '#5B2A0E');
    g.ellipse(12, 12, 10.5, 10.5, '#5E8E4A'); g.rect(2, 12, 20, 22, '#5E8E4A');
    [6, 10, 14, 18].forEach(function (x) { g.vline(x, 3, 31, '#4A7A3A'); });
    g.ellipseIn(9, 8, 3, 3, '#7EAE62');
    g.ellipse(12, 10, 3.5, 3.5, '#5B2A0E'); g.ellipse(12, 10, 2.6, 2.6, '#BFE8A0'); g.px(11, 9, '#FFFFFF');
    g.rect(17, 19, 2, 2, GOLD); g.px(17, 19, '#FFF3A8'); g.hline(2, 26, 20, '#3E6A30'); g.hline(2, 27, 20, '#7EAE62');
  }, { kind: 'object' });
  SDV.paintSprite('stool', 12, 10, function (g) { g.ellipse(6, 3, 5.4, 2.4, '#B5763A'); g.ellipse(6, 2.6, 5, 2, '#D9A066'); g.vline(2, 4, 6, '#7A4A22'); g.vline(9, 4, 6, '#7A4A22'); }, { kind: 'object' });
  SDV.paintSprite('plant', 14, 20, function (g) { g.rect(3, 13, 8, 7, '#B5763A'); g.hline(2, 13, 10, '#D9A066'); g.hline(3, 19, 8, '#7A4A22'); g.ellipse(7, 8, 6, 6, '#3F8F2A'); g.ellipse(6, 7, 5, 5, '#6CC33A'); g.px(4, 5, '#9BE05A'); g.px(9, 4, '#F58FB1'); g.px(5, 9, '#F58FB1'); }, { kind: 'object' });
  SDV.paintSprite('barrel', 16, 18, function (g) { g.ellipse(8, 9, 7, 8.4, '#7A4A22'); g.ellipse(7.6, 9, 6.4, 8, '#B5763A'); g.hline(1, 4, 14, '#5B5048'); g.hline(1, 14, 14, '#5B5048'); g.ellipse(8, 2.4, 6, 2, '#D9A066'); g.vline(5, 3, 13, '#9A6230'); g.vline(10, 3, 13, '#9A6230'); }, { kind: 'object' });
  SDV.paintSprite('openSign', 22, 10, function (g) { g.rect(0, 2, 22, 8, '#7A4A22'); g.rect(1, 3, 20, 6, '#6CC33A'); g.line(6, 2, 11, 0, '#7A4A22'); g.line(16, 2, 11, 0, '#7A4A22'); g.hline(4, 5, 14, '#FFF4DC'); g.hline(6, 7, 10, '#FFF4DC'); }, { kind: 'object' });

  SDV.paintSprite('sacks', 26, 18, function (g) { [[7, 9, '#C9A87A'], [18, 10, '#B8956A']].forEach(function (k) { g.ellipse(k[0], k[1] + 2, 6.4, 6, k[2]); g.ellipseIn(k[0] - 2, k[1], 2.4, 3, light(k[2], 0.25)); g.rect(k[0] - 2, k[1] - 6, 4, 3, k[2]); g.hline(k[0] - 2, k[1] - 4, 4, '#7A4A22'); }); g.ellipse(7, 4, 2.4, 1, '#E8A24A'); g.px(18, 4, '#E23B3B'); g.px(19, 4, '#E23B3B'); }, { kind: 'object' });
  SDV.paintSprite('crates', 30, 22, function (g) { function cr(x, y) { g.rect(x, y, 14, 11, '#7A4A22'); g.rect(x + 1, y + 1, 12, 9, '#C88A4E'); g.hline(x + 1, y + 1, 12, '#E2A868'); g.line(x + 1, y + 9, x + 12, y + 2, '#9A6230'); } cr(1, 10); cr(15, 10); cr(8, 0); g.ellipse(15, 1, 4, 1.4, '#E23B3B'); }, { kind: 'object' });
  SDV.paintSprite('mat', 28, 6, function (g) { g.rect(0, 0, 28, 6, '#5E8E4A'); g.rect(1, 1, 26, 4, '#7EAE62'); for (var x = 2; x < 26; x += 3) g.px(x, 2, '#9BD08A'); }, { kind: 'object', outline: false });
  /* tiny 3x5 pixel font for the shop sign */
  var F35 = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', "'": '010010000000000', '.': '000000000000010', '-': '000000111000000', ' ': '000000000000000' };
  SDV.text35 = function (g, str, x, y, col) { str = String(str).toUpperCase(); var cx = x; for (var i = 0; i < str.length; i++) { var m = F35[str[i]] || F35[' ']; for (var k = 0; k < 15; k++) if (m[k] === '1') g.px(cx + k % 3, y + (k / 3 | 0), col); cx += str[i] === "'" || str[i] === '.' ? 2 : 4; } return cx - x; };
  SDV.text35w = function (str) { var w = 0; String(str).split('').forEach(function (c) { w += c === "'" || c === '.' ? 2 : 4; }); return w; };
  SDV.signBoard = function (text) {
    var key = 'sign:' + text; if (DEFS[key]) return key;
    var tw = Math.max(24, SDV.text35w(text) + 7);
    SDV.paintSprite(key, tw + 2, 22, function (g) {
      var mid = (tw + 2) / 2 | 0; g.rect(mid - 2, 10, 4, 12, '#7A4A22'); g.vline(mid - 1, 10, 12, '#9A6230');
      g.rect(0, 1, tw + 2, 11, '#7A4A22'); g.rect(1, 2, tw, 9, '#C98A5A'); g.rect(2, 3, tw - 2, 7, '#FFF3DC');
      SDV.text35(g, text, 4, 4, '#7A3D2A');
    }, { kind: 'object' });
    return key;
  };

})();
