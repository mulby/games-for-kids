// felt3d.js: the felt-toy kit for The Toadstool Shop (Three.js r170). shop3d.js builds the shop from it.
// A Maileg-style felt world with real fabric detail:
// triplanar felt fibre (colour, bump, roughness), procedural wood grain, wicker, knit, crust and glaze,
// blanket and running stitches, satin-stitch embroidered eyes, twisted-yarn whiskers, buttons,
// soft shadow maps, a warm key / cool fill / rim light rig and a small image-based environment.
// Every texture is drawn once at load (512 px or less) and shared. Plain felt, thread and wood parts are merged
// into one draw call per material kind with per-vertex colour (see freeze), which keeps an iPad smooth.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from '../../shared/vendor/BufferGeometryUtils.js';

export { THREE };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/* =====================================================================================
   random + noise
   ===================================================================================== */
export function rng(seed = 1) {
  let s = (Math.imul(seed | 0 || 1, 2654435761) >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const fract = x => x - Math.floor(x);
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
function h3(x, y, z) { return fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453); }
const sm = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  return lerp(lerp(lerp(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), lerp(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy),
    lerp(lerp(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), lerp(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
// periodic 2D value noise (period P lattice cells) so canvas textures tile
function pnoise(x, y, P, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
  const g = (i, j) => h3(((i % P) + P) % P, ((j % P) + P) % P, seed);
  return lerp(lerp(g(ix, iy), g(ix + 1, iy), fx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), fx), fy);
}

/* =====================================================================================
   procedural canvas textures (all cached; data textures pack R=colour, G=height, B=roughness)
   ===================================================================================== */
const texCache = new Map();
const cached = (k, make) => { if (!texCache.has(k)) texCache.set(k, make()); return texCache.get(k); };
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
function toTex(c, { srgb = false, repeat = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}
// draw a stroke plus its wrapped copies so the texture tiles
function wrapStroke(x, size, px, py, reach, draw) {
  const xs = [0], ys = [0];
  if (px < reach) xs.push(size); if (px > size - reach) xs.push(-size);
  if (py < reach) ys.push(size); if (py > size - reach) ys.push(-size);
  for (const dx of xs) for (const dy of ys) draw(dx, dy);
}
function packChannels(x, size, fn) {
  const img = x.getImageData(0, 0, size, size), d = img.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const o = (j * size + i) * 4, r = fn(d[o], i, j);
    d[o] = clamp255(r[0]); d[o + 1] = clamp255(r[1]); d[o + 2] = clamp255(r[2]); d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}

// Felt: thousands of short curly fibres over blotchy wool density.
export function feltTexture(size = 512) {
  return cached('felt' + size, () => {
    const [c, x] = canvas(size), r = rng(11), k = size / 512;
    x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, size, size); x.lineCap = 'round';
    for (let i = 0; i < 11000; i++) {
      const px = r() * size, py = r() * size, a = r() * TAU, len = (4 + r() * 16) * k, bend = (r() - .5) * len * .9;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len, cx = ex / 2 + Math.cos(a + 1.57) * bend, cy = ey / 2 + Math.sin(a + 1.57) * bend;
      const v = r() < .5 ? 255 : 0;
      x.strokeStyle = `rgba(${v},${v},${v},${(.05 + r() * .16).toFixed(3)})`; x.lineWidth = (.5 + r() * 1.1) * k;
      wrapStroke(x, size, px, py, len * 1.6, (dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.quadraticCurveTo(px + dx + cx, py + dy + cy, px + dx + ex, py + dy + ey); x.stroke(); });
    }
    // soft height: wrap-blurred fibres plus little pills of fluff
    const src = x.getImageData(0, 0, size, size).data, N = size * size, L = new Float32Array(N), Hb = new Float32Array(N), tmp = new Float32Array(N), R2 = 2;
    for (let i = 0; i < N; i++) L[i] = src[i * 4];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { let a = 0; for (let k = -R2; k <= R2; k++) a += L[j * size + ((i + k + size) % size)]; tmp[j * size + i] = a / (2 * R2 + 1); }
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { let a = 0; for (let k = -R2; k <= R2; k++) a += tmp[((j + k + size) % size) * size + i]; Hb[j * size + i] = a / (2 * R2 + 1); }
    packChannels(x, size, (s, i, j) => {
      const b = pnoise(i / size * 5, j / size * 5, 5, 1) - .5 + (pnoise(i / size * 13, j / size * 13, 13, 2) - .5) * .7;
      const pill = Math.max(0, pnoise(i / size * 40, j / size * 40, 40, 6) - .62) * 3;
      const h = Hb[j * size + i];
      return [128 + (s - 128) * 1.25 + b * 40 + pill * 30, 128 + (h - 128) * 2.2 + (s - 128) * .35 + pill * 90 + b * 25, 128 + (s - 128) * .7 + b * 40];
    });
    return toTex(c);
  });
}
// Bread crust: pores, blisters and flour-dusted patches.
export function crustTexture(size = 256) {
  return cached('crust' + size, () => {
    const [c, x] = canvas(size), r = rng(5);
    x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const px = r() * size, py = r() * size, rad = .6 + r() * 2.6, v = r() < .7 ? 30 : 230;
      wrapStroke(x, size, px, py, 4, (dx, dy) => { x.fillStyle = `rgba(${v},${v},${v},${.25 + r() * .5})`; x.beginPath(); x.arc(px + dx, py + dy, rad, 0, TAU); x.fill(); });
    }
    packChannels(x, size, (s, i, j) => {
      const b = pnoise(i / size * 6, j / size * 6, 6, 3) - .5, f = pnoise(i / size * 24, j / size * 24, 24, 4) - .5;
      return [128 + (s - 128) * .8 + b * 90 + f * 30, s + b * 60 + f * 40, 128 + b * 60];
    });
    return toTex(c);
  });
}
// Wicker: horizontal weavers going over and under upright stakes.
export function wickerTexture(size = 256) {
  return cached('wicker' + size, () => {
    const [c, x] = canvas(size), rows = 8, cols = 6;
    x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
    packChannels(x, size, (s, i, j) => {
      const u = i / size * cols, v = j / size * rows, row = Math.floor(v), fv = v - row;
      const over = Math.cos((u + row * .5) * TAU) * .5 + .5; // which way the weaver bends at each stake
      const strand = Math.sin(Math.PI * fv);
      const h = strand * (.55 + .45 * over);
      const fib = h3(Math.floor(i / 1.5), row, 7) * .25 + pnoise(i / size * 64, j / size * 4, 64, 8) * .3;
      return [40 + h * 200 + fib * 40, h * 230 + fib * 25, 140 - h * 60];
    });
    return toTex(c);
  });
}
// Knit: rows of V-shaped stitches (scarves, bobble hats, socks).
export function knitTexture(size = 256) {
  return cached('knit' + size, () => {
    const [c, x] = canvas(size), cols = 8, rows = 12;
    x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
    packChannels(x, size, (s, i, j) => {
      const u = i / size * cols, v = j / size * rows, cu = fract(u), side = cu < .5 ? cu * 2 : (1 - cu) * 2;
      const vv = fract(v + side * .55);
      const h = Math.sin(Math.PI * Math.min(1, side * 1.2)) * Math.sin(Math.PI * vv);
      const fib = pnoise(i / size * 48, j / size * 48, 48, 5);
      return [60 + h * 170 + fib * 30, h * 220 + fib * 30, 150 - h * 50];
    });
    return toTex(c);
  });
}
// Ceramic glaze: soft pooling mottles plus iron speckles.
export function glazeTexture(size = 256) {
  return cached('glaze' + size, () => {
    const [c, x] = canvas(size), r = rng(3);
    x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) { const px = r() * size, py = r() * size, rad = .5 + r() * 1.3; x.fillStyle = `rgba(20,20,20,${.4 + r() * .5})`; x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill(); }
    packChannels(x, size, (s, i, j) => {
      const b = pnoise(i / size * 4, j / size * 4, 4, 9) - .5, ripple = pnoise(i / size * 10, j / size * 10, 10, 10) - .5;
      return [128 + (s - 128) + b * 50, 128 + ripple * 60, 128 + b * 50];
    });
    return toTex(c);
  });
}
// Plaster / linen for the inside wall.
export function plasterTexture(size = 256) {
  return cached('plaster' + size, () => {
    const [c, x] = canvas(size);
    x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
    packChannels(x, size, (s, i, j) => {
      const a = pnoise(i / size * 8, j / size * 8, 8, 21) - .5, b = pnoise(i / size * 32, j / size * 32, 32, 22) - .5;
      const weave = (Math.sin(i / size * TAU * 64) * Math.sin(j / size * TAU * 64)) * .5;
      return [128 + a * 70 + b * 30 + weave * 14, 128 + a * 40 + b * 50 + weave * 40, 128 + a * 50];
    });
    return toTex(c);
  });
}

/* ---- printed fabric overlays (RGBA, sRGB): drawn on top of a felt base colour ---- */
export function printTexture(kind = 'dots', o = {}) {
  const key = 'print:' + kind + JSON.stringify(o);
  return cached(key, () => {
    const size = o.size || 256, [c, x] = canvas(size), r = rng(o.seed || 4);
    x.clearRect(0, 0, size, size);
    const col = o.color || '#ffffff', col2 = o.color2 || '#ffd86b', leaf = o.leaf || '#7cc06e';
    if (kind === 'dots') {
      const n = o.n || 6, rad = (o.r || .12) * size / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const px = (i + (j % 2) * .5 + .25) * size / n, py = (j + .5) * size / n;
        wrapStroke(x, size, px, py, rad * 2, (dx, dy) => { x.fillStyle = col; x.beginPath(); x.arc(px + dx, py + dy, rad, 0, TAU); x.fill(); });
      }
    } else if (kind === 'flowers') {
      const n = o.n || 4;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const px = (i + (j % 2) * .5 + .25 + (r() - .5) * .2) * size / n, py = (j + .5 + (r() - .5) * .2) * size / n, s = size / n * .2, rot = r() * TAU;
        wrapStroke(x, size, px, py, s * 3, (dx, dy) => {
          x.save(); x.translate(px + dx, py + dy); x.rotate(rot);
          x.fillStyle = leaf; for (const a of [.6, 3.4]) { x.beginPath(); x.ellipse(Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5, s * .7, s * .32, a, 0, TAU); x.fill(); }
          x.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; x.beginPath(); x.ellipse(Math.cos(a) * s * .62, Math.sin(a) * s * .62, s * .55, s * .4, a, 0, TAU); x.fill(); }
          x.fillStyle = col2; x.beginPath(); x.arc(0, 0, s * .33, 0, TAU); x.fill(); x.restore();
        });
      }
    } else if (kind === 'gingham') {
      const n = o.n || 8, w = size / n / 2;
      x.fillStyle = col; x.globalAlpha = .5;
      for (let i = 0; i < n; i++) { x.fillRect(i * size / n, 0, w, size); x.fillRect(0, i * size / n, size, w); }
      x.globalAlpha = 1;
    } else if (kind === 'stripes') {
      const n = o.n || 4, w = size / n * (o.w || .5);
      x.fillStyle = col; for (let i = 0; i < n; i++) x.fillRect(i * size / n, 0, w, size);
    } else if (kind === 'tweed') {
      for (let i = 0; i < 2600; i++) { const px = r() * size, py = r() * size; x.fillStyle = r() < .5 ? col : col2; x.globalAlpha = .35 + r() * .4; x.fillRect(px, py, 1 + r() * 3, 1); }
      x.globalAlpha = .35; x.fillStyle = col2; const n = o.n || 4;
      for (let i = 0; i < n; i++) { x.fillRect(i * size / n, 0, 2, size); x.fillRect(0, i * size / n, size, 2); }
      x.globalAlpha = 1;
    }
    return toTex(c, { srgb: true });
  });
}

/* ---- text / painted textures (UV mapped, not triplanar) ---- */
export function labelTexture(text, o = {}) {
  const key = 'label:' + text + JSON.stringify(o);
  return cached(key, () => {
    const w = o.w || 512, h = o.h || 256, [c, x] = canvas(w, h), r = rng(9);
    x.fillStyle = o.bg || '#fff3dc'; x.fillRect(0, 0, w, h);
    // paper fibres
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(120,90,60,${r() * .06})`; x.fillRect(r() * w, r() * h, 1 + r() * 6, 1); }
    if (o.border !== false) { x.strokeStyle = o.border || '#c98a5a'; x.lineWidth = h * .05; x.setLineDash(o.dash ? [h * .08, h * .06] : []); x.strokeRect(h * .08, h * .08, w - h * .16, h - h * .16); x.setLineDash([]); }
    x.fillStyle = o.ink || '#7a3d2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fs = o.fs || h * .42;
    x.font = `${o.italic ? 'italic ' : ''}bold ${fs}px ${o.font || '"Chalkboard SE","Comic Sans MS","Comic Neue",Georgia,serif'}`;
    const lines = String(text).split('\n');
    lines.forEach((ln, i) => x.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1));
    if (o.deco === 'bee') { const bx = w * .86, by = h * .3; x.fillStyle = '#f0b429'; x.beginPath(); x.ellipse(bx, by, 18, 13, 0, 0, TAU); x.fill(); x.fillStyle = '#4a3428'; x.fillRect(bx - 4, by - 13, 5, 26); x.fillRect(bx + 7, by - 11, 4, 22); x.fillStyle = 'rgba(200,230,255,.85)'; x.beginPath(); x.ellipse(bx - 2, by - 17, 9, 6, -.5, 0, TAU); x.fill(); }
    if (o.deco === 'heart') { const bx = w * .14, by = h * .5, s = h * .16; x.fillStyle = '#e2566b'; x.beginPath(); x.moveTo(bx, by + s); x.bezierCurveTo(bx - s * 2, by - s * .2, bx - s * .6, by - s * 1.6, bx, by - s * .5); x.bezierCurveTo(bx + s * .6, by - s * 1.6, bx + s * 2, by - s * .2, bx, by + s); x.fill(); }
    return toTex(c, { srgb: true, repeat: false });
  });
}
// Coin face: raised rim, a ring of beads, the value and tiny "BRAMBLE WOOD" lettering. Used as colour + bump.
export function coinFaceTexture(value = 1, back = false, plain = false) {
  return cached('coin' + value + back + (plain ? 'p' : ''), () => {
    const s = 256, [c, x] = canvas(s), m = s / 2;
    x.fillStyle = 'rgb(150,150,150)'; x.fillRect(0, 0, s, s);
    const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, 'rgb(150,150,150)'); g.addColorStop(.8, 'rgb(125,125,125)'); g.addColorStop(1, 'rgb(110,110,110)');
    x.fillStyle = g; x.beginPath(); x.arc(m, m, m, 0, TAU); x.fill();
    x.strokeStyle = 'rgb(240,240,240)'; x.lineWidth = s * .07; x.beginPath(); x.arc(m, m, m * .9, 0, TAU); x.stroke();
    x.strokeStyle = 'rgb(90,90,90)'; x.lineWidth = s * .012; x.beginPath(); x.arc(m, m, m * .82, 0, TAU); x.stroke();
    x.fillStyle = 'rgb(225,225,225)';
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; x.beginPath(); x.arc(m + Math.cos(a) * m * .76, m + Math.sin(a) * m * .76, s * .011, 0, TAU); x.fill(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const font = 'Georgia,"Times New Roman",serif';
    if (plain) { /* blank centre: the panel pictures print the value on top in flat 2D so it reads at chip size */ }
    else if (!back) {
      const txt = 'BRAMBLE WOOD', R = m * .63; x.font = `bold ${s * .07}px ${font}`;
      for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + (i - (txt.length - 1) / 2) * .17; x.save(); x.translate(m + Math.cos(a) * R, m + Math.sin(a) * R); x.rotate(a + Math.PI / 2); x.fillText(txt[i], 0, 0); x.restore(); }
      x.font = `bold ${s * (value >= 10 ? .3 : .38)}px ${font}`;
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowOffsetY = 3; x.shadowBlur = 3;
      // dark outline + bright fill so the value reads at chip size (colour map multiplies the metal colour)
      x.lineJoin = 'round'; x.lineWidth = s * .035; x.strokeStyle = 'rgb(55,55,55)'; x.strokeText(value + '¢', m, m + s * .06); x.shadowColor = 'transparent';
      x.fillStyle = 'rgb(255,255,255)'; x.fillText(value + '¢', m, m + s * .06);
    } else {
      // acorn emblem on the back
      x.fillStyle = 'rgb(235,235,235)'; x.beginPath(); x.ellipse(m, m + s * .06, s * .13, s * .16, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgb(200,200,200)'; x.beginPath(); x.ellipse(m, m - s * .07, s * .17, s * .08, 0, 0, TAU); x.fill();
      x.fillRect(m - 3, m - s * .2, 6, s * .07);
    }
    return toTex(c, { repeat: false });
  });
}
function reedTexture() {
  return cached('reed', () => { const [c, x] = canvas(256, 8); for (let i = 0; i < 256; i++) { const v = 128 + Math.sin(i / 256 * TAU * 64) * 110; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 8); } return toTex(c); });
}
export function radialTexture(inner = 'rgba(40,30,20,.55)', outer = 'rgba(40,30,20,0)') {
  return cached('rad' + inner + outer, () => {
    const [c, x] = canvas(128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner); g.addColorStop(.5, inner.replace(/[\d.]+\)$/, m => (parseFloat(m) * .45).toFixed(3) + ')')); g.addColorStop(1, outer);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return toTex(c, { srgb: true, repeat: false });
  });
}

/* =====================================================================================
   material enhancer: triplanar fibre texture / print / 3D wood grain injected into PBR materials
   ===================================================================================== */
const TP_COMMON = `
varying vec3 vTpPos; varying vec3 vTpNrm;
uniform float tpScale; uniform vec4 tpAmt; uniform float tpMottle;
#ifdef TP_TEX
uniform sampler2D tpTex;
#endif
#ifdef TP_PRINT
uniform sampler2D tpPrint; uniform float tpPrintScale;
#endif
#ifdef TP_WOOD
uniform vec3 tpWoodDark; uniform float tpWoodFreq;
#endif
#if defined(TP_VC) && !defined(USE_COLOR)
#undef TP_VC
#endif
float tpH3(vec3 p){ p = fract(p*0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float tpN3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(tpH3(i),tpH3(i+vec3(1,0,0)),f.x), mix(tpH3(i+vec3(0,1,0)),tpH3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(tpH3(i+vec3(0,0,1)),tpH3(i+vec3(1,0,1)),f.x), mix(tpH3(i+vec3(0,1,1)),tpH3(i+vec3(1,1,1)),f.x),f.y), f.z); }
vec3 tpBump(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`;
const TP_MAP = `
vec3 tpN = normalize(vTpNrm);
vec3 tpW = pow(abs(tpN), vec3(4.0)); tpW /= (tpW.x + tpW.y + tpW.z);
vec3 tpP = vTpPos; float tpH = 0.5; float tpR = 0.5; float tpL = 1.0;
#ifdef TP_TEX
  vec3 tq = tpP * tpScale;
  vec4 tpS = texture2D(tpTex, tq.yz) * tpW.x + texture2D(tpTex, tq.zx + vec2(.37,.11)) * tpW.y + texture2D(tpTex, tq.xy + vec2(.71,.53)) * tpW.z;
  tpL = 1.0 + (tpS.r - 0.5) * 2.0 * tpAmt.x; tpH = tpS.g; tpR = tpS.b;
#endif
tpL *= 1.0 + (tpN3(tpP * 1.7) - 0.5) * tpMottle;
#ifdef TP_PRINT
  vec3 tpW2 = pow(abs(tpN), vec3(10.0)); tpW2 /= (tpW2.x + tpW2.y + tpW2.z);
  vec3 tq2 = tpP * tpPrintScale;
  vec4 tpPr = texture2D(tpPrint, tq2.yz) * tpW2.x + texture2D(tpPrint, tq2.zx) * tpW2.y + texture2D(tpPrint, tq2.xy) * tpW2.z;
  diffuseColor.rgb = mix(diffuseColor.rgb, tpPr.rgb, tpPr.a);
  tpH = mix(tpH, tpH + 0.12, tpPr.a);
#endif
#ifdef TP_WOOD
  vec3 wp = tpP * tpScale;
  #if WOOD_AXIS == 0
    vec2 wc = wp.yz; float wa = wp.x;
  #elif WOOD_AXIS == 1
    vec2 wc = wp.xz; float wa = wp.y;
  #else
    vec2 wc = wp.xy; float wa = wp.z;
  #endif
  float wwarp = tpN3(vec3(wc * 0.9, wa * 0.07)) * 2.2 + tpN3(vec3(wc * 3.0, wa * 0.3)) * 0.4;
  float wr = fract(length(wc + vec2(7.3, 3.1)) * tpWoodFreq + wwarp);
  float wring = smoothstep(0.0, 0.12, wr) * (1.0 - smoothstep(0.5, 1.0, wr));
  float wstreak = tpN3(vec3(wc * 34.0, wa * 0.8));
  float wg = clamp(wring * 0.7 + wstreak * 0.4, 0.0, 1.0);
  #ifdef TP_VC
  vec3 tpWD = diffuseColor.rgb * 0.62;
  #else
  vec3 tpWD = tpWoodDark;
  #endif
  diffuseColor.rgb = mix(tpWD, diffuseColor.rgb, mix(1.0, wg, tpAmt.x));
  tpH = mix(tpH, wring * 0.4 + wstreak * 0.6, 0.85); tpR = mix(tpR, 0.3 + wstreak * 0.4, 0.8);
#endif
diffuseColor.rgb *= tpL;`;

let enhanceId = 0;
export function enhance(m, o = {}) {
  const u = {
    tpScale: { value: o.scale ?? 2 }, tpAmt: { value: new THREE.Vector4(...(o.amt || [.2, .003, .2, 0])) }, tpMottle: { value: o.mottle ?? .12 },
    tpTex: { value: o.tex || null }, tpPrint: { value: o.print ? o.print.tex : null }, tpPrintScale: { value: o.print ? o.print.scale ?? 3 : 1 },
    tpWoodDark: { value: new THREE.Color(o.wood ? o.wood.dark : '#000') }, tpWoodFreq: { value: o.wood ? o.wood.freq ?? 5 : 1 },
  };
  m.defines = Object.assign({}, m.defines, { TP: '' });
  if (o.tex) m.defines.TP_TEX = '';
  if (o.print) m.defines.TP_PRINT = '';
  if (o.wood) { m.defines.TP_WOOD = ''; m.defines.WOOD_AXIS = o.wood.axis ?? 0; }
  if (o.vc) m.defines.TP_VC = '';
  m.userData.tp = u; m.userData.enhanceId = ++enhanceId;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTpPos; varying vec3 vTpNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTpPos = transformed; vTpNrm = objectNormal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + TP_COMMON)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + TP_MAP)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#if defined(TP_VC) && defined(USE_SHEEN)\nmaterial.sheenColor *= mix(vColor.rgb, vec3(1.0), 0.25);\n#endif')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (tpR - 0.5) * tpAmt.z, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec2 tpD = vec2(dFdx(tpH), dFdy(tpH)) * tpAmt.y * 400.0; float tpNdv = abs(dot(normal, normalize(vViewPosition))); tpD *= smoothstep(0.1, 0.6, tpNdv); tpD = clamp(tpD, vec2(-0.35), vec2(0.35)); normal = tpBump(-vViewPosition, normal, tpD, faceDirection); }');
  };
  m.customProgramCacheKey = () => 'tp1';
  return m;
}

/* =====================================================================================
   materials (cached by key)
   ===================================================================================== */
const matCache = new Map();
const mc = (k, make) => { if (!matCache.has(k)) matCache.set(k, make()); return matCache.get(k); };
const WHITE = new THREE.Color('#ffffff');
export const lighten = (c, l) => '#' + new THREE.Color(c).offsetHSL(0, 0, l).getHexString();

// Felt: sheen-lit wool with fibres, fuzz and blotchy density. o: {print:{kind,...opts,scale}, scale, bump, fibre, side, vc}
export function felt(color, o = {}) {
  return mc('felt' + color + JSON.stringify(o), () => {
    const c = new THREE.Color(color), vcm = o.vcMerged;
    const m = new THREE.MeshPhysicalMaterial({ color: vcm ? WHITE : c, roughness: o.rough ?? .9, sheen: o.sheen ?? .8, sheenRoughness: .45, sheenColor: vcm ? WHITE : c.clone().lerp(WHITE, .25), envMapIntensity: .35 });
    if (o.side) m.side = o.side;
    if (o.vc || vcm) m.vertexColors = true;
    if (o.clearcoat) { m.clearcoat = o.clearcoat; m.clearcoatRoughness = .45; }
    const pr = o.print ? { tex: printTexture(o.print.kind, o.print), scale: o.print.scale ?? 3 } : null;
    if (!vcm && !o.vc) m.userData.merge = () => felt('#ffffff', { ...o, vcMerged: true });
    return enhance(m, { tex: feltTexture(), scale: o.scale ?? 1.4, amt: [o.fibre ?? .3, o.bump ?? .0025, .3, 0], mottle: o.mottle ?? .08, print: pr, vc: !!vcm });
  });
}
// Thread for stitches and embroidery: a little glossier than felt.
export function thread(color) {
  return mc('thread' + color, () => { const m = new THREE.MeshPhysicalMaterial({ color, roughness: .5, sheen: .6, sheenRoughness: .3, sheenColor: new THREE.Color(color).lerp(WHITE, .5), envMapIntensity: .6 }); m.userData.noCast = true; m.userData.merge = threadVC; return m; });
}
// all stitches of a model share one material: the thread colour rides on the vertices
function threadVC() { return mc('threadvc', () => { const m = new THREE.MeshPhysicalMaterial({ color: WHITE, vertexColors: true, roughness: .5, sheen: .6, sheenRoughness: .3, sheenColor: new THREE.Color('#ffffff').multiplyScalar(.75), envMapIntensity: .6 }); m.userData.noCast = true; return m; }); }
// Wood with 3D grain running along `axis` (0=x, 1=y, 2=z).
export function wood(color = '#b07a4a', o = {}) {
  return mc('wood' + color + JSON.stringify(o), () => {
    const vcm = o.vcMerged;
    const m = new THREE.MeshPhysicalMaterial({ color: vcm ? '#ffffff' : color, roughness: o.rough ?? .62, clearcoat: o.varnish ?? .15, clearcoatRoughness: .5, envMapIntensity: .6 });
    if (o.vc || vcm) m.vertexColors = true;
    if (o.side) m.side = o.side;
    if (!vcm && !o.vc && !o.dark) { const { dark, ...k } = o; m.userData.merge = () => wood('#ffffff', { ...k, vcMerged: true }); }
    return enhance(m, { tex: feltTexture(), scale: o.scale ?? 1.4, amt: [o.grain ?? .55, o.bump ?? .004, .25, 0], mottle: .1, wood: { axis: o.axis ?? 0, dark: o.dark || lighten(color, -.16), freq: o.freq ?? 4 }, vc: !!vcm });
  });
}
export function wicker(color = '#d9b070', o = {}) {
  return mc('wicker' + color + JSON.stringify(o), () => enhance(new THREE.MeshPhysicalMaterial({ color, roughness: .6, sheen: .4, sheenColor: new THREE.Color(color).lerp(WHITE, .5), side: o.side || THREE.FrontSide, envMapIntensity: .5 }), { tex: wickerTexture(), scale: o.scale ?? 3.2, amt: [.45, o.bump ?? .006, .3, 0], mottle: .1 }));
}
export function knit(color, o = {}) {
  return mc('knit' + color + JSON.stringify(o), () => {
    const vcm = o.vcMerged, c = new THREE.Color(vcm ? '#ffffff' : color);
    const pr = o.print ? { tex: printTexture(o.print.kind, o.print), scale: o.print.scale ?? 3 } : null;
    const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .85, sheen: 1, sheenRoughness: .5, sheenColor: vcm ? c.clone().multiplyScalar(.8) : c.clone().lerp(WHITE, .45), envMapIntensity: .4 });
    if (vcm) m.vertexColors = true; else m.userData.merge = () => knit('#ffffff', { ...o, vcMerged: true }); // knits of one model share a draw call
    return enhance(m, { tex: knitTexture(), scale: o.scale ?? 3, amt: [.35, o.bump ?? .006, .2, 0], print: pr, vc: !!vcm });
  });
}
// Bread: crust texture, a little glaze, optional vertex colours for a darker top.
export function crust(color = '#d99a55', o = {}) {
  return mc('crust' + color + JSON.stringify(o), () => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: .62, clearcoat: o.glaze ?? .55, clearcoatRoughness: .35, sheen: .5, sheenColor: new THREE.Color('#ffe2b0'), envMapIntensity: .6 });
    if (o.vc) m.vertexColors = true;
    return enhance(m, { tex: crustTexture(), scale: o.scale ?? 3, amt: [.35, o.bump ?? .006, .35, 0], mottle: .2 });
  });
}
export function glaze(color, o = {}) {
  return mc('glaze' + color + JSON.stringify(o), () => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: o.rough ?? .28, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1 });
    if (o.vc) m.vertexColors = true;
    return enhance(m, { tex: glazeTexture(), scale: o.scale ?? 2.5, amt: [o.speckle ?? .25, .0015, .2, 0], mottle: .1 });
  });
}
export function metal(color, o = {}) {
  return mc('metal' + color + JSON.stringify(o), () => enhance(new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: o.rough ?? .3, envMapIntensity: o.env ?? 1.4, clearcoat: o.clearcoat ?? 0 }), { tex: crustTexture(), scale: 6, amt: [.08, .0008, .15, 0], mottle: .05 }));
}
export function glossy(color, o = {}) {
  return mc('gloss' + color + JSON.stringify(o), () => {
    const m = new THREE.MeshPhysicalMaterial({ color: o.vcMerged ? '#ffffff' : color, roughness: o.rough ?? .3, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1, sheen: o.sheen ?? 0 });
    if (o.vc || o.vcMerged) m.vertexColors = true;
    else m.userData.merge = () => glossy('#ffffff', { ...o, vcMerged: true });
    return m;
  });
}
export function paper(color = '#d9b98a', o = {}) {
  return mc('paper' + color + JSON.stringify(o), () => enhance(new THREE.MeshPhysicalMaterial({ color, roughness: .95, side: o.side || THREE.DoubleSide, envMapIntensity: .3 }), { tex: feltTexture(), scale: 1.5, amt: [.08, .0012, .1, 0], mottle: .15 }));
}
export function plaster(color = '#fff1dc') {
  return mc('plaster' + color, () => enhance(new THREE.MeshPhysicalMaterial({ color, roughness: .95, side: THREE.BackSide, sheen: .5, sheenColor: new THREE.Color(color).lerp(WHITE, .5), envMapIntensity: .3 }), { tex: plasterTexture(), scale: .9, amt: [.18, .004, .1, 0], mottle: .18 }));
}
export function glass(tint = '#eaf6ff', o = {}) {
  return mc('glass' + tint + JSON.stringify(o), () => new THREE.MeshPhysicalMaterial({ color: tint, roughness: .05, metalness: 0, transparent: true, opacity: o.opacity ?? .22, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1 }));
}
// Self-lit materials register here so stage.setPreset can turn window/lantern glow up at night.
export const GLOWS = new Set();
export function glowMat(color, base = 1, o = {}) {
  return mc('glow' + color + base + JSON.stringify(o), () => {
    const m = new THREE.MeshStandardMaterial({ color: o.color || color, emissive: color, emissiveIntensity: base, roughness: .6, side: o.side || THREE.FrontSide });
    m.userData.glowBase = base; GLOWS.add(m); return m;
  });
}
export function basic(color, o = {}) { return mc('basic' + color + JSON.stringify(o), () => new THREE.MeshBasicMaterial({ color, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null, fog: o.fog ?? true, side: o.side || THREE.FrontSide })); }

/* =====================================================================================
   geometry helpers
   ===================================================================================== */
const geoCache = new Map(), sharedGeos = new WeakSet();
export function geo(key, make) { if (LODK !== 1) key += '@' + LODK; if (!geoCache.has(key)) { const g = make(); geoCache.set(key, g); sharedGeos.add(g); } return geoCache.get(key); }
// true for the kit's shared shapes, which must never be disposed with one model
export const isSharedGeo = g => sharedGeos.has(g);
// Level of detail: withLod(k, build) builds with about k times the segments (k*k the triangles on round things).
let LODK = 1;
export function withLod(k, fn) { const was = LODK; LODK = k; try { return fn(); } finally { LODK = was; } }
const sg = (n, min = 4) => Math.max(min, Math.round(n * LODK));
export const SPH = (seg = 40) => { seg = sg(seg, 6); return geo('s' + seg, () => new THREE.SphereGeometry(1, seg, Math.round(seg * .75))); };
export function mesh(g, m, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  const x = new THREE.Mesh(g, m);
  x.position.set(...p); x.scale.set(...(Array.isArray(s) ? s : [s, s, s])); x.rotation.set(...r);
  return x;
}
export const ball = (m, p, s, r, seg = 40) => mesh(SPH(seg), m, p, s, r);
export const bead = (m, p, s, r) => mesh(SPH(14), m, p, s, r);
export function capsule(m, a, b, rad, radial = 16) {
  const A = V3(...a), B = V3(...b), len = Math.max(.001, A.distanceTo(B));
  radial = sg(radial, 5); const x = new THREE.Mesh(geo('cap' + rad.toFixed(3) + '/' + len.toFixed(3) + '/' + radial, () => new THREE.CapsuleGeometry(rad, len, LODK < 1 ? 3 : 6, radial)), m);
  x.position.copy(A).add(B).multiplyScalar(.5);
  x.quaternion.setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize());
  return x;
}
// smooth a 2D profile [[r,y],...] with a Catmull-Rom spline
export function smoothProfile(pts, n = 40) {
  const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
  return c.getSpacedPoints(n).map(v => [Math.max(0, v.x), v.y]);
}
// Lathe from profile points [radius, y] (any order: drawn bottom to top so normals face out).
export function latheGeo(pts, seg = 64, phiStart = 0, phiLen = TAU, smooth = 0) {
  seg = sg(seg, 8); if (smooth) pts = smoothProfile(pts, sg(smooth, 6));
  if (pts[0][1] > pts[pts.length - 1][1]) pts = pts.slice().reverse();
  return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg, phiStart, phiLen);
}
export function lathe(pts, m, seg = 64, o = {}) { return mesh(latheGeo(pts, seg, o.phiStart ?? 0, o.phiLen ?? TAU, o.smooth || 0), m); }
export function tube(points, rad, m, seg = 24, radial = 10, closed = false) {
  const c = points.getPointAt ? points : new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V3(...p)), closed);
  return mesh(new THREE.TubeGeometry(c, sg(seg, 3), rad, sg(radial, 3), closed), m);
}
// a tube whose radius tapers from r0 to r1 (stems, tails, whiskers)
export function taperTube(points, r0, r1, m, seg = 24, radial = 10) {
  const c = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V3(...p)));
  const g = new THREE.TubeGeometry(c, seg, 1, radial, false), p = g.attributes.position, fr = c.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const ctr = c.getPointAt(i / seg), rr = lerp(r0, r1, i / seg);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; const v = V3(p.getX(k), p.getY(k), p.getZ(k)).sub(ctr).multiplyScalar(rr).add(ctr); p.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return mesh(g, m);
}
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape(); r = Math.min(r, w / 2, h / 2);
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
export function archShape(w, h) { // flat bottom, round top
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return s;
}
export function slab(shape, depth, m, bevel = .04, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}
// rounded box (bevelled), centred
export function rbox(w, h, d, r, m) { const k = 'rb' + [w, h, d, r].map(v => v.toFixed(3)).join(','); const g = geo(k, () => { const e = new THREE.ExtrudeGeometry(roundRectShape(w - 2 * r, h - 2 * r, Math.min(w, h) * .08), { depth: Math.max(.001, d - 2 * r), bevelEnabled: r > 0, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 4 }); e.translate(0, 0, -(d - 2 * r) / 2); return e; }); return mesh(g, m); }
// Displace a closed mesh around its centre with 3D noise (lumpy buns, stuffed bodies, tree clumps).
export function lumpy(g0, amp = .06, freq = 2.5, seed = 1) {
  let g = g0.clone(); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const l = v.length() || 1;
    const n = (noise3(v.x * freq + seed, v.y * freq, v.z * freq) - .5) * 2 + (noise3(v.x * freq * 2.3, v.y * freq * 2.3 + seed, v.z * freq * 2.3) - .5) * .5;
    v.multiplyScalar(1 + n * amp / l); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}
// A sewn-toy sphere: a soft groove where two felt panels meet (plane through the centre with normal `axis`).
export function seamSphere(seg = 48, axis = 'x', depth = .025, width = .06) {
  return geo('seam' + seg + axis + depth + width, () => {
    let g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
    const p = g.attributes.position, v = V3(), ax = { x: 0, y: 1, z: 2 }[axis];
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = v.getComponent(ax); v.multiplyScalar(1 - depth * Math.exp(-((d / width) ** 2))); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  });
}
// write a per-vertex colour from a function of position (for vc materials)
export function paintVerts(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), v = V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, c); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// point on an ellipsoid (centre c, radii R) along direction dir, lifted `lift` along the surface normal
export function ellPoint(c, R, dir, lift = 0) {
  const d = V3(...dir).normalize();
  const t = 1 / Math.sqrt((d.x / R[0]) ** 2 + (d.y / R[1]) ** 2 + (d.z / R[2]) ** 2);
  const p = d.multiplyScalar(t), n = V3(p.x / R[0] ** 2, p.y / R[1] ** 2, p.z / R[2] ** 2).normalize();
  return { p: p.add(V3(...c)).addScaledVector(n, lift), n };
}
// place obj on an ellipsoid with its +z facing out
export function onSurface(obj, c, R, dir, lift = 0, roll = 0) {
  const { p, n } = ellPoint(c, R, dir, lift);
  obj.position.copy(p); obj.quaternion.setFromUnitVectors(V3(0, 0, 1), n); if (roll) obj.rotateZ(roll);
  return obj;
}

/* =====================================================================================
   stitches, seams and embroidery
   ===================================================================================== */
const stitchGeo = () => geo('stitch', () => new THREE.SphereGeometry(1, 6, 4));
function toCurve(points, closed) { return points.getPointAt ? points : new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V3(...p)), closed, 'centripetal'); }
function dashMesh(segs, r, m) {
  const gs = [], q = new THREE.Quaternion(), M = new THREE.Matrix4(), up = V3(0, 1, 0);
  for (const [a, b] of segs) {
    const d = b.clone().sub(a), len = d.length(); if (len < 1e-5) continue;
    q.setFromUnitVectors(up, d.normalize());
    M.compose(a.clone().add(b).multiplyScalar(.5), q, V3(r, len / 2 + r * .4, r * .75));
    gs.push(stitchGeo().clone().applyMatrix4(M));
  }
  const x = new THREE.Mesh(mergeGeometries(gs, false), m); x.userData.stitch = true; return x;
}
// Running stitch: dashes along a curve. points: array/curve; o: {color, len, gap, r, closed}
export function runningStitch(points, o = {}) {
  const c = toCurve(points, o.closed), L = c.getLength(), len = o.len ?? .05, gap = o.gap ?? .035, step = len + gap;
  const n = Math.max(1, Math.floor(L / step)), segs = [];
  for (let i = 0; i < n; i++) { const t0 = (i * step + gap / 2) / L, t1 = Math.min(1, (i * step + gap / 2 + len) / L); segs.push([c.getPointAt(t0), c.getPointAt(t1)]); }
  return dashMesh(segs, o.r ?? .009, o.mat || thread(o.color || '#fff6e6'));
}
// Blanket stitch: a thread along the edge plus legs into the fabric. leg(p, tangent, t) -> Vector3 offset.
export function blanketStitch(points, leg, o = {}) {
  const c = toCurve(points, o.closed), L = c.getLength(), sp = o.spacing ?? .06, n = Math.max(2, Math.floor(L / sp)), segs = [];
  const m = o.mat || thread(o.color || '#fff6e6'), r = o.r ?? .009;
  const pts = []; for (let i = 0; i <= n; i++) pts.push(c.getPointAt(Math.min(1, i / n)));
  for (let i = 0; i < n; i++) { segs.push([pts[i], pts[i + 1]]); const t = i / n, tan = c.getTangentAt(t); segs.push([pts[i], pts[i].clone().add(leg(pts[i], tan, t))]); }
  return dashMesh(segs, r, m);
}
// Cross-stitch "X" pairs along a curve (used on Bramble's cap band and the cart sign)
export function crossStitch(points, o = {}) {
  const c = toCurve(points, o.closed), L = c.getLength(), sp = o.spacing ?? .07, n = Math.floor(L / sp), segs = [], h = o.h ?? .03, nrm = V3(...(o.normal || [0, 0, 1]));
  for (let i = 0; i < n; i++) {
    const p = c.getPointAt((i + .5) / n), t = c.getTangentAt((i + .5) / n), side = nrm.clone().cross(t).normalize().multiplyScalar(h / 2), along = t.clone().multiplyScalar(h / 2);
    segs.push([p.clone().sub(along).sub(side), p.clone().add(along).add(side)], [p.clone().sub(along).add(side), p.clone().add(along).sub(side)]);
  }
  return dashMesh(segs, o.r ?? .008, o.mat || thread(o.color || '#fff6e6'));
}
// points on a horizontal ring (optionally wavy), for hems and rims
export function ringPoints(r, y, n = 64, o = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (o.a0 ?? 0) + i / n * (o.arc ?? TAU), rr = r + (o.wave ? Math.sin(a * o.waves) * o.wave : 0); pts.push(V3(Math.sin(a) * rr, y + (o.wy ? Math.cos(a * o.waves) * o.wy : 0), Math.cos(a) * rr)); }
  return pts;
}
// points along an arc over an ellipsoid surface, between directions d0 and d1 (slerped)
export function ellArc(c, R, d0, d1, n = 24, lift = .004) {
  const a = V3(...d0).normalize(), b = V3(...d1).normalize(), out = [], q0 = new THREE.Quaternion(), q = new THREE.Quaternion().setFromUnitVectors(a, b);
  for (let i = 0; i <= n; i++) { q0.identity().slerp(q, i / n); out.push(ellPoint(c, R, a.clone().applyQuaternion(q0).toArray(), lift).p); }
  return out;
}
// Satin-stitch patch (embroidered eye / nose): parallel threads filling an ellipse, facing +z.
export function satin(w, h, m, o = {}) {
  const n = o.threads ?? 7, g = new THREE.Group(), segs = [], dome = o.dome ?? h * .12;
  for (let i = 0; i < n; i++) {
    const y = -h / 2 + (i + .5) / n * h, k = 1 - (2 * y / h) ** 2, hw = w / 2 * Math.sqrt(Math.max(0, k));
    const z = dome * k;
    segs.push([V3(-hw, y, z * .8), V3(hw, y, z * .8)]);
  }
  const x = dashMesh(segs, h / n * .62, m); if (o.angle) x.rotation.z = o.angle; g.add(x); return g;
}
// Twisted two-ply yarn along a curve (whiskers, string, hanging cords)
export function yarn(points, r = .006, m, o = {}) {
  const c = toCurve(points, false), n = o.seg ?? 40, fr = c.computeFrenetFrames(n, false), twists = o.twists ?? (c.getLength() / (r * 9)), g = new THREE.Group();
  for (const ph of [0, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, a = t * twists * TAU + ph, p = c.getPointAt(t); pts.push(p.addScaledVector(fr.normals[i], Math.cos(a) * r).addScaledVector(fr.binormals[i], Math.sin(a) * r)); }
    g.add(tube(pts, r * 1.05, m, n * 2, 5));
  }
  return g;
}
// A sewn button with four holes and a thread cross.
export function button(color = '#fff6e6', r = .05, o = {}) {
  const g = new THREE.Group(), m = o.mat || glossy(color, { rough: .35 });
  g.add(lathe([[0, -.25], [.92, -.25], [1, -.05], [.95, .22], [.78, .3], [.7, .16], [0, .14]], m, 24).rotateX(Math.PI / 2));
  const t = thread(o.thread || '#7a5236');
  g.add(dashMesh([[V3(-.3, -.3, .2), V3(.3, .3, .2)], [V3(-.3, .3, .2), V3(.3, -.3, .2)]], .09, t));
  for (const [x, y] of [[-.3, -.3], [.3, .3], [-.3, .3], [.3, -.3]]) g.add(mesh(SPH(8), basic('#3a2a20'), [x, y, .14], [.11, .11, .04]));
  g.scale.setScalar(r); return freeze(g);
}

/* =====================================================================================
   merge static parts (one draw call per material). Groups marked userData.live stay separate.
   ===================================================================================== */
function flipWinding(g) {
  for (const n of Object.keys(g.attributes)) {
    const a = g.attributes[n], s = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
  }
}
export function freeze(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(), victims = [], lives = [];
  (function walk(o) {
    for (const c of o.children) {
      if (c.userData.live) { lives.push(c); continue; }
      if (c.isMesh && !c.isInstancedMesh && !c.userData.noMerge) {
        const src = c.material, tm = src.userData.merge ? src.userData.merge() : src;
        const k = tm.uuid; if (!groups.has(k)) groups.set(k, { m: tm, g: [], ro: c.renderOrder });
        let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (tm !== src && !src.vertexColors) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([src.color.r, src.color.g, src.color.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
        if (tm.vertexColors && !g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
        if (!tm.vertexColors && g.attributes.color) g.deleteAttribute('color');
        g.morphAttributes = {};
        const M = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
        g.applyMatrix4(M); if (M.determinant() < 0) flipWinding(g);
        groups.get(k).g.push(g); victims.push(c);
      }
      walk(c);
    }
  })(root);
  for (const v of victims) { while (v.children.length) v.parent.attach(v.children[0]); v.parent.remove(v); }
  for (const { m, g, ro } of groups.values()) {
    const merged = g.length === 1 ? g[0] : mergeGeometries(g, false);
    const x = new THREE.Mesh(merged, m); x.castShadow = !m.transparent && !m.isMeshBasicMaterial && !m.userData.noCast && !root.userData.noCast; x.receiveShadow = !m.isMeshBasicMaterial;
    x.renderOrder = ro || (m.transparent ? 2 : 0); root.add(x);
  }
  lives.forEach(l => { if (l !== root) freeze(l); });
  root.traverse(o => { if (o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}
// many copies of one static model as instanced meshes
export function scatter(tpl, items) {
  const g = new THREE.Group(); tpl.updateMatrixWorld(true);
  const d = new THREE.Object3D(), m4 = new THREE.Matrix4(), col = new THREE.Color();
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
    items.forEach((it, i) => { d.position.set(...it.p); d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); d.scale.setScalar(it.s || 1); d.updateMatrix(); im.setMatrixAt(i, m4.multiplyMatrices(d.matrix, o.matrixWorld)); if (it.c) im.setColorAt(i, col.set(it.c)); });
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  });
  return g;
}
// soft round contact shadow under a character or prop
export function contactShadow(r = .75, opacity = 1) {
  const m = new THREE.Mesh(geo('blob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(50,32,20,.6)', 'rgba(50,32,20,0)'), transparent: true, opacity, depthWrite: false }));
  m.scale.set(r * 2, 1, r * 1.6); m.position.y = .015; m.renderOrder = 1; m.userData.noMerge = true; return m;
}
// additive glow sprite for lamps and windows
export function glowSprite(color = '#ffd27a', size = 1, opacity = .6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); s.renderOrder = 10; s.userData.glowBase = opacity; s.userData.glowSprite = true; return s;
}

/* =====================================================================================
   palette (matches the current game)
   ===================================================================================== */
export const PAL = {
  ink: '#2e2650', cream: '#fff1dc', paper: '#fffdf7',
  mouse: '#b9ada3', pinkSkin: '#f4a3b4', dressPink: '#f6a6bd', apron: '#fffaf0',
  rabbit: '#e9dcc8', dressBlue: '#9fc7e8', bonnet: '#fff3e6', ribbon: '#f6c6d8',
  hog: '#f0dcbc', spikes: '#6b4a33', scarf: '#e2566b',
  toadRed: '#e2566b', spot: '#fff7e6', gill: '#f7d8c4',
  wood: '#b07a4a', woodDark: '#8a5a36', woodFrame: '#7a5236',
  bun: '#d99a55', bunCap: '#a8672e', apple: '#e04a4a', honey: '#f0a92a', leaf: '#7cc06e',
  till: '#7bb4d9', gold: '#e9b949', grass: '#8cc46c',
};

/* =====================================================================================
   character parts
   ===================================================================================== */
function blush(head, x, y, z, s = .1) {
  const m = mc('blush', () => new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,120,150,.55)', 'rgba(255,120,150,0)'), transparent: true, depthWrite: false }));
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(geo('blushq', () => new THREE.PlaneGeometry(1, 1)), m); c.userData.noMerge = false;
    c.position.set(sx * x, y, z); c.scale.setScalar(s * 2.2); c.lookAt(sx * x * 4, y, z * 4); c.renderOrder = 3; head.add(c);
  }
}
// embroidered eyes: navy satin stitch, a white highlight stitch, optional lashes
function embroideredEyes(head, c, R, { x = .2, y = .06, z = .45, w = .15, h = .19, lashes = false, ink = PAL.ink } = {}) {
  const im = thread(ink), wm = thread('#fffaf0');
  for (const sx of [-1, 1]) {
    const dir = [sx * x, y, z];
    const e = satin(w, h, im, { threads: 8, dome: .02 }); onSurface(e, c, R, dir, -.004); head.add(e);
    const hl = satin(w * .32, h * .26, wm, { threads: 2, dome: .004 }); onSurface(hl, c, R, [sx * x + .035, y + .05, z], .012); head.add(hl);
    const hl2 = satin(w * .16, h * .12, wm, { threads: 1, dome: .002 }); onSurface(hl2, c, R, [sx * x - .03, y - .045, z], .01); head.add(hl2);
    if (lashes) for (let i = 0; i < 3; i++) {
      const a = .5 + i * .45, base = ellPoint(c, R, [sx * (x + Math.cos(a) * .07), y + Math.sin(a) * .09, z], .006).p;
      const tip = ellPoint(c, R, [sx * (x + Math.cos(a) * .12), y + Math.sin(a) * .135, z], .02).p;
      head.add(dashMesh([[base, tip]], .009, im));
    }
  }
}
function embroideredMouth(head, c, R, pts, color = '#7a4a52', r = .009) {
  head.add(tube(pts.map(d => ellPoint(c, R, d, .003).p), r, thread(color), 16, 6));
}
function whiskers(head, x0, y, z, len = .34, color = '#9a8e92') {
  const m = thread(color);
  for (const sx of [-1, 1]) for (const [dy, dz] of [[-.035, 0], [.035, -.01], [.0, -.005]]) {
    head.add(yarn([[sx * x0, y + dy, z + dz], [sx * (x0 + len * .5), y + dy * 1.8 + .012, z + dz - .05], [sx * (x0 + len), y + dy * 2.8 - .01, z + dz - .14]], .0055, m, { seg: 30 }));
  }
}
function feltBow(color, s = 1, thr) {
  const g = new THREE.Group(), m = felt(color), t = thr || lighten(color, -.25);
  for (const sx of [-1, 1]) {
    const lobe = ball(m, [sx * .12, 0, 0], [.13, .085, .055], [0, 0, sx * .45], 28); g.add(lobe);
    g.add(runningStitch(Array.from({ length: 24 }, (_, i) => { const a = i / 24 * TAU; return V3(sx * .12 + Math.cos(a) * .1 * Math.cos(sx * .45) - Math.sin(a) * .06 * Math.sin(sx * .45), Math.cos(a) * .1 * Math.sin(sx * .45) + Math.sin(a) * .06 * Math.cos(sx * .45), .05); }), { closed: true, len: .025, gap: .018, r: .005, color: t }));
    g.add(capsule(m, [sx * .02, -.03, 0], [sx * .09, -.17, -.01], .028, 10));
  }
  g.add(ball(felt(lighten(color, -.06)), [0, 0, .02], [.055, .065, .05], [0, 0, 0], 20));
  g.scale.setScalar(s); return g;
}
function arm(F, F2, side, neckY, o = {}) {
  const a = new THREE.Group(); a.position.set(side * .34, neckY - .02, .02); a.userData.live = true; a.name = side < 0 ? 'armL' : 'armR';
  const sleeve = o.sleeve;
  if (sleeve) {
    a.add(capsule(sleeve, [0, 0, 0], [side * .1, -.2, .06], .11, 18));
    a.add(mesh(geo('cuff', () => new THREE.TorusGeometry(.085, .028, 10, 24)), o.cuff || sleeve, [side * .115, -.23, .07], 1, [Math.PI / 2 - .4, 0, side * .45]));
  }
  a.add(capsule(F, [0, 0, 0], [side * .2, -.42, .12], .085, 16));
  a.add(ball(F2, [side * .22, -.5, .14], [.1, .1, .1], [0, 0, 0], 24));
  // stitched paw fingers
  const pc = [side * .22, -.5, .14], pr = [.1, .1, .1];
  for (const k of [-1, 0, 1]) a.add(runningStitch(ellArc(pc, pr, [side * .2 + k * .25, -.2, 1], [side * .2 + k * .3, -1, .5], 6, .002), { len: .03, gap: .02, r: .004, color: lighten(F2.color.getStyle(), -.22) }));
  const paw = new THREE.Group(); paw.name = a.name + 'Paw'; paw.position.set(side * .22, -.56, .16); a.add(paw);
  a.userData.paw = paw;
  return a;
}
function feet(body, m, sole, toe) {
  for (const sx of [-1, 1]) {
    body.add(ball(m, [sx * .22, .1, .12], [.17, .1, .24], [0, 0, 0], 28));
    body.add(runningStitch(ringPoints(1, 0, 30).map(p => V3(sx * .22 + p.x * .165, .07, .12 + p.z * .235)), { closed: true, len: .03, gap: .02, r: .005, color: toe || lighten(m.color.getStyle(), -.2) }));
  }
}
// The dress: smooth lathe body, printed fabric, frilled hem with blanket stitch, waist seam.
const DRESS_PROFILE = smoothProfile([[0, 1.34], [.3, 1.3], [.4, 1.05], [.58, .6], [.74, .28], [.76, .2], [.7, .18], [0, .18]], 48);
function dressR(y) { // radius of the dress surface at height y (outer side)
  let best = .3;
  for (let i = 0; i < DRESS_PROFILE.length - 1; i++) { const [r0, y0] = DRESS_PROFILE[i], [r1, y1] = DRESS_PROFILE[i + 1]; if ((y - y0) * (y - y1) <= 0 && Math.abs(y1 - y0) > 1e-4 && r0 > .2 && r1 > .2) best = Math.max(best, lerp(r0, r1, (y - y0) / (y1 - y0))); }
  return best;
}
function dress(body, { color, trim, print, hemThread }) {
  const dm = felt(color, { print }), tm = felt(trim);
  body.add(lathe(DRESS_PROFILE, dm, 72));
  // frilled hem: a wavy piping tube
  const hem = ringPoints(.755, .215, 160, { wave: .012, waves: 22, wy: .012 });
  body.add(tube(hem, .045, tm, 200, 10, true));
  body.add(blanketStitch(ringPoints(.745, .265, 80), (p) => V3(-p.x, 0, -p.z).normalize().multiplyScalar(.012).add(V3(0, .055, 0)), { closed: true, spacing: .07, r: .007, color: hemThread || '#fff6e6' }));
  // waist seam + collar
  body.add(runningStitch(ringPoints(dressR(1.08) + .006, 1.08, 60), { closed: true, len: .035, gap: .025, r: .006, color: lighten(color, -.22) }));
  return dm;
}

/* =====================================================================================
   CHARACTERS: chibi felt animals ~2.5 units tall, feet at y=0, facing +z.
   userData: { body, head, armL, armR, pawL, pawR, kind }
   ===================================================================================== */
function rig(root, body, head, armL, armR, name) {
  Object.assign(root.userData, { kind: 'critter', name, body, head, armL, armR, pawL: armL.userData.paw, pawR: armR.userData.paw, t0: Math.random() * 10 });
  root.add(contactShadow(.8));
  freeze(root);
  root.traverse(o => { if (o.name === 'armLPaw') root.userData.pawL = o; if (o.name === 'armRPaw') root.userData.pawR = o; });
  return root;
}
// knitted scarf with fringe (Bramble, Mo)
function knitScarf(body, color, neckY, o = {}) {
  const sc = knit(color);
  body.add(mesh(geo('scarfT', () => new THREE.TorusGeometry(.31, .1, 14, 40)), sc, [0, neckY, 0], 1, [Math.PI / 2, 0, 0]));
  const tail = [V3(.16, neckY - .04, .3), V3(.22, neckY - .3, .36), V3(.24, neckY - .55, .34)];
  body.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tail), 16, .075, 12).scale(1, 1, .6).translate(0, 0, .14), sc));
  for (let i = 0; i < 6; i++) body.add(capsule(knit(o.fringe || '#fff3e0'), [.18 + i * .022, neckY - .6, .34], [.17 + i * .026, neckY - .72, .35], .012, 6));
}
// a soft felt neck so the head sits on the body instead of floating above it
function feltNeck(F, neckY) {
  return lathe(smoothProfile([[0, neckY - .12], [.27, neckY - .1], [.25, neckY + .12], [.23, neckY + .3], [.2, neckY + .42], [0, neckY + .44]], 20), F, 40);
}
function newRoot() {
  const root = new THREE.Group(), body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const head = new THREE.Group(); head.userData.live = true; head.name = 'head';
  return { root, body, head };
}

// Poppy: the mouse shopkeeper. Grey felt, pink flowered dress, white apron with pocket and stitched hem, white bow.
export function poppy(o = {}) {
  const fur = o.fur || PAL.mouse, dressCol = o.dress || PAL.dressPink;
  const { root, body, head } = newRoot();
  const F = felt(fur), F2 = felt(lighten(fur, .14)), pink = felt(PAL.pinkSkin), neckY = 1.3;
  dress(body, { color: dressCol, trim: '#fff3e6', print: { kind: 'flowers', color: '#fff6ec', color2: '#ffd86b', leaf: '#8fc98a', scale: 2.6, n: 4 } });
  // apron: a curved panel in front of the dress, rolled edges, pink running-stitch hem, pocket, bib and straps
  const am = felt(o.apron || PAL.apron, { side: THREE.DoubleSide }), ast = thread(lighten(dressCol, -.18));
  const aOff = .03, A0 = -1.05, A1 = 1.05, y0 = .34, y1 = 1.02;
  const apronPts = []; for (let i = 0; i <= 14; i++) { const y = lerp(y0, y1, i / 14); apronPts.push([dressR(y) + aOff, y]); }
  body.add(lathe(apronPts, am, 40, { phiStart: A0, phiLen: A1 - A0 }));
  const onA = (phi, y, off = aOff) => { const r = dressR(y) + off; return V3(Math.sin(phi) * r, y, Math.cos(phi) * r); };
  const edge = [];
  for (let i = 0; i <= 10; i++) edge.push(onA(A0, lerp(y1, y0, i / 10), aOff + .004));
  for (let i = 1; i <= 30; i++) edge.push(onA(lerp(A0, A1, i / 30), y0, aOff + .004));
  for (let i = 1; i <= 10; i++) edge.push(onA(A1, lerp(y0, y1, i / 10), aOff + .004));
  body.add(tube(edge, .016, am, 160, 8));
  const inset = []; for (let i = 0; i <= 8; i++) inset.push(onA(A0 + .09, lerp(y1 - .04, y0 + .05, i / 8), aOff + .008));
  for (let i = 1; i <= 26; i++) inset.push(onA(lerp(A0 + .09, A1 - .09, i / 26), y0 + .05, aOff + .008));
  for (let i = 1; i <= 8; i++) inset.push(onA(A1 - .09, lerp(y0 + .05, y1 - .04, i / 8), aOff + .008));
  body.add(runningStitch(inset, { len: .04, gap: .028, r: .0065, mat: ast }));
  // waistband
  body.add(tube(ringPoints(dressR(1.02) + .035, 1.02, 60, { a0: -1.25, arc: 2.5 }), .03, am, 60, 8));
  // pocket with a little felt flower peeking out
  const P0 = .18, P1 = .62, py0 = .5, py1 = .74, pOff = aOff + .025;
  const ppts = []; for (let i = 0; i <= 6; i++) { const y = lerp(py0, py1, i / 6); ppts.push([dressR(y) + pOff, y]); }
  body.add(lathe(ppts, am, 12, { phiStart: P0, phiLen: P1 - P0 }));
  const pe = []; for (let i = 0; i <= 5; i++) pe.push(onA(P0 + .04, lerp(py1 - .01, py0 + .03, i / 5), pOff + .006));
  for (let i = 1; i <= 10; i++) pe.push(onA(lerp(P0 + .04, P1 - .04, i / 10), py0 + .03, pOff + .006));
  for (let i = 1; i <= 5; i++) pe.push(onA(P1 - .04, lerp(py0 + .03, py1 - .01, i / 5), pOff + .006));
  body.add(runningStitch(pe, { len: .03, gap: .02, r: .0055, mat: ast }));
  body.add(tube(Array.from({ length: 8 }, (_, i) => onA(lerp(P0, P1, i / 7), py1, pOff + .002)), .014, am, 20, 6));
  const fl = feltFlower('#ffd86b', .9); fl.position.copy(onA((P0 + P1) / 2 + .08, py1 + .04, pOff - .02)); fl.rotation.set(1.1, (P0 + P1) / 2, .2); body.add(fl);
  // bib + straps + back bow
  const bpts = []; for (let i = 0; i <= 6; i++) { const y = lerp(1.02, 1.24, i / 6); bpts.push([dressR(y) + .022, y]); }
  body.add(lathe(bpts, am, 16, { phiStart: -.55, phiLen: 1.1 }));
  const be = []; for (let i = 0; i <= 4; i++) be.push(onA(-.5, lerp(1.04, 1.22, i / 4), .028)); for (let i = 1; i <= 8; i++) be.push(onA(lerp(-.5, .5, i / 8), 1.22, .028)); for (let i = 1; i <= 4; i++) be.push(onA(.5, lerp(1.22, 1.04, i / 4), .028));
  body.add(runningStitch(be, { len: .03, gap: .022, r: .0055, mat: ast }));
  for (const sx of [-1, 1]) body.add(tube([onA(sx * .52, 1.23, .03), V3(sx * .26, 1.38, .05), V3(sx * .28, 1.36, -.2), onA(Math.PI + sx * -.6, 1.1, .03)], .028, am, 24, 8));
  const bow = feltBow(o.apron || PAL.apron, 1.1, '#e6c9b8'); bow.position.set(0, 1.02, -dressR(1.02) - .06); bow.rotation.y = Math.PI; body.add(bow);
  // collar: two rounded felt petals
  for (const sx of [-1, 1]) { body.add(ball(felt('#fff6ec'), [sx * .13, 1.3, .2], [.14, .035, .1], [.25, sx * .5, sx * -.25], 24)); }
  body.add(ball(felt('#fff3e6'), [0, 1.32, .03], [.32, .09, .27], [0, 0, 0], 32));
  feet(body, pink);
  body.add(taperTube([[0, .4, -.5], [.1, .25, -.9], [.45, .2, -1.15], [.7, .45, -1.1], [.78, .72, -.95], [.7, .82, -.9]], .04, .018, pink, 60, 10));
  const armL = arm(F, F2, -1, neckY, { sleeve: felt(dressCol, { print: { kind: 'flowers', color: '#fff6ec', color2: '#ffd86b', leaf: '#8fc98a', scale: 2.6, n: 4 } }), cuff: felt('#fff3e6') });
  const armR = arm(F, F2, 1, neckY, { sleeve: felt(dressCol, { print: { kind: 'flowers', color: '#fff6ec', color2: '#ffd86b', leaf: '#8fc98a', scale: 2.6, n: 4 } }), cuff: felt('#fff3e6') });
  body.add(armL, armR);
  // head
  head.position.set(0, 1.9, 0); body.add(head); body.add(feltNeck(F, neckY));
  const HR = [.55, .5, .52];
  head.add(mesh(seamSphere(56, 'x', .02, .05), F, [0, 0, 0], HR));
  head.add(runningStitch(ellArc([0, 0, 0], HR, [0, 1, .12], [0, .2, -1], 26, .006), { len: .035, gap: .025, r: .006, color: lighten(fur, -.18) }));
  const MC = [0, -.12, .36], MR = [.3, .22, .26];
  head.add(ball(F2, MC, MR, [0, 0, 0], 40));
  head.add(ball(felt('#e88aa0', { clearcoat: .3 }), [0, -.06, .615], [.085, .065, .065], [0, 0, 0], 24));
  embroideredMouth(head, MC, MR, [[0, .05, 1], [0, -.3, 1], [-.25, -.45, 1], [-.42, -.3, 1]]);
  embroideredMouth(head, MC, MR, [[0, -.3, 1], [.25, -.45, 1], [.42, -.3, 1]]);
  embroideredEyes(head, [0, 0, 0], HR, { x: .2, y: .07, z: .45, w: .14, h: .18 });
  blush(head, .33, -.08, .42, .075);
  whiskers(head, .17, -.1, .53);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * .46, .46, -.08); ear.rotation.y = sx * -.25; head.add(ear);
    ear.add(ball(F, [0, 0, 0], [.36, .36, .1], [0, 0, 0], 40));
    ear.add(ball(pink, [0, -.01, .055], [.25, .25, .05], [0, 0, 0], 32));
    ear.add(blanketStitch(ringPoints(1, 0, 48).map(p => V3(p.x * .245, -.01 + p.z * .245, .078)), (p) => V3(p.x, p.y + .01, 0).normalize().multiplyScalar(.03), { closed: true, spacing: .05, r: .0055, color: '#d97a90' }));
  }
  const hb = feltBow(o.bow || '#ffffff', 1, '#e8b4c0'); hb.position.set(.3, .42, .14); hb.rotation.set(-.2, .2, -.3); head.add(hb);
  return rig(root, body, head, armL, armR, 'poppy');
}

// Mrs. Bunbury: rabbit in a blue sprigged dress with lace collar and buttons, a cream bonnet with pink ribbon.
export function bunbury(o = {}) {
  const fur = o.fur || PAL.rabbit, dressCol = o.dress || PAL.dressBlue;
  const { root, body, head } = newRoot();
  const F = felt(fur), F2 = felt(lighten(fur, .07)), pink = felt('#f2a9b8'), neckY = 1.3;
  const pr = { kind: 'flowers', color: '#ffffff', color2: '#f6c6d8', leaf: '#7fb48a', scale: 3.2, n: 5 };
  dress(body, { color: dressCol, trim: '#fffaf2', print: pr, hemThread: '#ffffff' });
  // lace collar: scalloped petals around the neck
  const lace = felt('#fffaf2');
  for (let i = 0; i < 9; i++) { const a = (i - 4) * .32; body.add(ball(lace, [Math.sin(a) * .3, 1.29, Math.cos(a) * .27], [.09, .03, .08], [.35 * Math.cos(a), a, 0], 18)); }
  body.add(ball(felt(dressCol, { print: pr }), [0, 1.32, .03], [.32, .09, .27], [0, 0, 0], 32));
  // buttons down the front
  for (let i = 0; i < 3; i++) { const y = 1.18 - i * .17, b = button('#fff6e6', .042, { thread: '#5a8fc7' }); b.position.copy(V3(0, y, dressR(y) + .012)); b.lookAt(0, y + .4, 10); body.add(b); }
  // a front placket seam
  body.add(runningStitch(Array.from({ length: 10 }, (_, i) => { const y = lerp(1.24, .7, i / 9); return V3(.06, y, dressR(y) + .006); }), { len: .03, gap: .022, r: .005, color: '#ffffff' }));
  feet(body, F);
  body.add(mesh(lumpy(SPH(24), .12, 5, 3), felt('#fffaf4', { fibre: .35, bump: .006 }), [0, .45, -.58], .2));
  const sleeve = felt(dressCol, { print: pr });
  const armL = arm(F, F2, -1, neckY, { sleeve, cuff: lace }), armR = arm(F, F2, 1, neckY, { sleeve, cuff: lace });
  body.add(armL, armR);
  head.position.set(0, 1.9, 0); body.add(head); body.add(feltNeck(F, neckY));
  const HR = [.58, .52, .52];
  head.add(mesh(seamSphere(56, 'x', .015, .05), F, [0, 0, 0], HR));
  const MC = [0, -.15, .38], MR = [.3, .2, .22];
  head.add(ball(F2, MC, MR, [0, 0, 0], 40));
  head.add(ball(felt('#e88aa0', { clearcoat: .3 }), [0, -.085, .585], [.075, .055, .055], [0, 0, 0], 24));
  embroideredMouth(head, MC, MR, [[0, .1, 1], [0, -.3, 1], [-.25, -.45, 1], [-.42, -.3, 1]]);
  embroideredMouth(head, MC, MR, [[0, -.3, 1], [.25, -.45, 1], [.42, -.3, 1]]);
  embroideredEyes(head, [0, 0, 0], HR, { x: .21, y: .06, z: .45, w: .14, h: .18, lashes: true });
  blush(head, .35, -.1, .41, .075);
  whiskers(head, .17, -.13, .53, .3, '#a39890');
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * .22, .4, -.05); ear.rotation.set(-.12, 0, sx * -.18 + (o.flop && sx > 0 ? -.9 : 0)); head.add(ear);
    ear.add(ball(F, [0, .55, 0], [.17, .6, .11], [0, 0, 0], 36));
    ear.add(ball(pink, [0, .55, .065], [.1, .48, .05], [0, 0, 0], 28));
    ear.add(runningStitch(Array.from({ length: 40 }, (_, i) => { const a = i / 40 * TAU; return V3(Math.cos(a) * .102, .55 + Math.sin(a) * .49, .092 + 0 * a); }), { closed: true, len: .035, gap: .025, r: .005, color: '#d97a90' }));
  }
  // bonnet: a felt hood behind the face, ribbon band, lace frill, chin ties and a bow
  const bm = felt(o.bonnet || PAL.bonnet, { side: THREE.DoubleSide }), rib = felt(o.ribbon || PAL.ribbon);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, 0, TAU, 0, Math.PI * .56), bm);
  hood.scale.set(.63, .58, .58); hood.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(0, .5, -.86).normalize()); hood.position.set(0, .08, -.08); head.add(hood);
  // opening edge of the hood: torus-ish frill around the face
  hood.updateMatrix();
  const edgeL = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, th = Math.PI * .56; edgeL.push(V3(Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a)).applyMatrix4(hood.matrix)); }
  head.add(tube(edgeL, .05, rib, 96, 10, true));
  const frill = edgeL.map((p, i) => p.clone().multiplyScalar(1.0).add(V3(0, 0, .03)).add(p.clone().setZ(0).normalize().multiplyScalar(.035 + .012 * Math.sin(i * 1.6))));
  head.add(tube(frill, .022, felt('#fffdf7'), 200, 8, true));
  head.add(runningStitch(edgeL.map(p => p.clone().add(V3(0, 0, .045))), { closed: true, len: .03, gap: .022, r: .006, color: '#fff6ec' }));
  // back seam of the bonnet
  head.add(runningStitch(ellArc([0, .14, -.06], [.64, .6, .6], [0, .9, -.1], [0, -.2, -1], 24, .006), { len: .035, gap: .025, r: .006, color: '#e6c9b8' }));
  // chin ties and bow
  for (const sx of [-1, 1]) head.add(tube([V3(sx * .5, -.12, .12), V3(sx * .42, -.38, .24), V3(sx * .2, -.5, .32), V3(.1, -.5, .36)], .03, rib, 24, 8));
  const cb = feltBow(o.ribbon || PAL.ribbon, .9, '#d98aa0'); cb.position.set(.14, -.5, .38); cb.rotation.set(0, .3, -.1); head.add(cb);
  return rig(root, body, head, armL, armR, 'bunbury');
}

// Bramble: the hedgehog pedlar. Cream felt face and tummy, hundreds of layered felt spikes, red knitted scarf, tweed cap.
export function bramble(o = {}) {
  const fur = o.fur || PAL.hog, spikeC = o.spikes || PAL.spikes;
  const { root, body, head } = newRoot();
  const F = felt(fur), F2 = felt(lighten(fur, .06)), neckY = 1.3;
  const shades = [spikeC, lighten(spikeC, .07), lighten(spikeC, -.06)].map(c => felt(c, { fibre: .25 }));
  body.add(mesh(seamSphere(48, 'x', .015, .05), F, [0, .72, 0], [.62, .68, .55]));
  body.add(ball(F2, [0, .66, .28], [.42, .48, .32], [0, 0, 0], 40));
  body.add(blanketStitch(ringPoints(1, 0, 64).map(p => ellPoint([0, .72, 0], [.62, .68, .55], [p.x * .62, -.06 + p.z * .66, .78], .006).p), (p, t) => V3(0, .66, .45).sub(p).normalize().multiplyScalar(.03), { closed: true, spacing: .065, r: .0065, color: '#a87a52' }));
  // spikes: flattened felt cones in three shades over the back
  const cone = geo('spike', () => { const g = new THREE.ConeGeometry(.08, .27, 7, 1); g.translate(0, .12, 0); g.scale(1, 1, .5); return g; });
  const r = rng(21), place = (parent, c, R, n, filter, sweep) => {
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + .5) / n * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
      const d = V3(Math.cos(th) * rad, y, Math.sin(th) * rad); if (!filter(d)) continue;
      const { p, n: nn } = ellPoint(c, R, d.toArray(), -.02);
      const axis = nn.clone().add(V3(...sweep)).normalize();
      const m = new THREE.Mesh(cone, shades[(i * 7) % 3]); m.position.copy(p);
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), axis); m.rotateY(r() * TAU); m.scale.setScalar(.85 + r() * .4); parent.add(m);
    }
  };
  place(body, [0, .78, -.06], [.6, .66, .53], 560, d => d.z < -.12 + Math.max(0, d.y) * .1 && d.y > -.5, [0, .55, -1.4]);
  feet(body, F);
  // knitted scarf with cream stripes and fringe
  if (o.scarf !== null) knitScarf(body, o.scarf || PAL.scarf, neckY);
  const armL = arm(F, F2, -1, neckY), armR = arm(F, F2, 1, neckY);
  body.add(armL, armR);
  head.position.set(0, 1.9, 0); body.add(head); body.add(feltNeck(F, neckY));
  head.add(ball(shades[0], [0, .06, -.1], [.56, .52, .5], [0, 0, 0], 40));
  place(head, [0, .06, -.12], [.55, .51, .49], 300, d => d.z < .12 + Math.max(0, d.y) * .25 - Math.max(0, -d.y) * .4 && d.y > -.4, [0, .5, -1.3]);
  head.add(ball(F, [0, -.02, .08], [.5, .46, .46], [0, 0, 0], 48));
  const SC = [0, -.14, .42], SR = [.22, .18, .32];
  head.add(ball(F, SC, SR, [0, 0, 0], 36));
  head.add(ball(glossy('#3a2f3a', { rough: .35 }), [0, -.12, .74], [.075, .065, .065], [0, 0, 0], 24));
  embroideredMouth(head, SC, SR, [[-.55, -.55, .6], [-.2, -.75, .6], [.2, -.75, .6], [.55, -.55, .6]], '#6b4a33');
  embroideredEyes(head, [0, -.02, .08], [.5, .46, .46], { x: .2, y: .14, z: .45, w: .13, h: .17 });
  blush(head, .3, -.1, .44, .07);
  for (const sx of [-1, 1]) { head.add(ball(F, [sx * .34, .34, .1], [.12, .1, .06], [0, 0, sx * -.3], 24)); head.add(ball(felt('#e8b4a0'), [sx * .34, .335, .135], [.07, .06, .03], [0, 0, sx * -.3], 18)); }
  // tweed flat cap
  if (o.cap !== false) {
    const tw = felt('#7d8a5a', { print: { kind: 'tweed', color: '#c9b58a', color2: '#4a5232', scale: 4, n: 4 } });
    const cap = new THREE.Group(); cap.position.set(0, .4, .0); cap.rotation.set(-.18, 0, .08); head.add(cap);
    cap.add(lathe([[0, .2], [.3, .19], [.48, .12], [.53, .04], [.5, 0], [0, 0]], tw, 48, { smooth: 24 }));
    cap.add(mesh(geo('capbrim', () => { const s = new THREE.Shape(); s.absarc(0, 0, .5, Math.PI * .1, Math.PI * .9, true); s.quadraticCurveTo(0, .78, Math.cos(Math.PI * .1) * .5, Math.sin(Math.PI * .1) * .5); return new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2, curveSegments: 20 }); }), tw, [0, .02, 0], [1, 1, 1], [Math.PI / 2 + .12, 0, 0]));
    cap.add(button('#5a4a32', .045, { mat: felt('#5a6340'), thread: '#c9b58a' }).rotateX(-Math.PI / 2).translateZ(.2));
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; cap.add(runningStitch(Array.from({ length: 10 }, (_, k) => { const t = k / 9, rr = lerp(.04, .5, t); return V3(Math.sin(a) * rr, .205 - t * t * .17 + .004, Math.cos(a) * rr); }), { len: .03, gap: .02, r: .005, color: '#c9b58a' })); }
    cap.add(runningStitch(ringPoints(.515, .05, 60), { closed: true, len: .03, gap: .02, r: .005, color: '#c9b58a' }));
  }
  if (o.bow) { const hb = feltBow(o.bow, 1.05); hb.position.set(.28, .44, .2); hb.rotation.set(-.2, .2, -.3); head.add(hb); }
  if (o.apron) { // a little pinafore for small hedgehogs
    const am = felt(o.apron, { side: THREE.DoubleSide });
    body.add(lathe(smoothProfile([[.0, .98], [.36, .96], [.52, .7], [.6, .42], [.0, .4]], 16), am, 40, { phiStart: -1.0, phiLen: 2.0 }).translateZ(.12));
    body.add(runningStitch(Array.from({ length: 24 }, (_, i) => { const a = -.95 + i / 23 * 1.9; return V3(Math.sin(a) * .6, .45, Math.cos(a) * .6 + .12); }), { len: .035, gap: .025, r: .006, color: lighten(o.apron, -.25) }));
  }
  return rig(root, body, head, armL, armR, o.name || 'bramble');
}

/* =====================================================================================
   GOODS
   ===================================================================================== */
// felt flower (petals, french-knot centre, stem optional)
export function feltFlower(petal = '#f6a6bd', s = 1, o = {}) {
  const g = new THREE.Group(), pm = felt(petal), cm = felt('#ffd86b', { fibre: .35 });
  const lo = !!o.lite; // lite: far-away meadow flowers (about a tenth of the triangles)
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.add(ball(pm, [Math.cos(a) * .1, 0, Math.sin(a) * .1], [.085, .022, .055], [0, -a, 0], lo ? 8 : 16)); }
  g.add(ball(cm, [0, .015, 0], [.045, .03, .045], [0, 0, 0], lo ? 8 : 14));
  if (!lo) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(bead(felt('#e9a23b'), [Math.cos(a) * .028, .035, Math.sin(a) * .028], .012)); }
  if (o.stem) { g.add(tube([[0, 0, 0], [.03, -.3, .01], [0, -.6, 0]], .015, felt('#5f9a62'), lo ? 4 : 8, lo ? 3 : 5)); g.add(ball(felt(PAL.leaf), [.07, -.35, 0], [.07, .02, .035], [0, 0, -.5], lo ? 6 : 12)); }
  g.scale.setScalar(s); return freeze(g);
}
// Acorn bun: lumpy glazed crust bun with an acorn-cup cap (scaly), sugar nibs and a curly stem. ~0.6 wide.
export function acornBun(o = {}) {
  const g = new THREE.Group(), seed = o.seed ?? 1;
  const bg = paintVerts(lumpy(SPH(40), .07, 2.2, seed), (v, c) => c.set(PAL.bun).lerp(new THREE.Color('#9a5a26'), Math.max(0, v.y) * .55).lerp(new THREE.Color('#f2d29a'), Math.max(0, -v.y - .3) * .9));
  g.add(mesh(bg, crust('#ffffff', { vc: true }), [0, .17, 0], [.3, .2, .3]));
  // acorn cup: a domed cap of overlapping scales on top of the bun
  const CC = [0, .26, 0], CR = [.24, .12, .24];
  const capM = crust('#7a4a22', { glaze: .15, bump: .004, scale: 5 });
  g.add(mesh(lumpy(new THREE.SphereGeometry(1, sg(32, 10), sg(16, 6), 0, TAU, 0, Math.PI * .5), .02, 4, seed + 2), capM, CC, CR));
  g.add(mesh(geo('cuprim', () => new THREE.TorusGeometry(1, .09, sg(8, 4), sg(40, 12))), capM, [0, .262, 0], [.235, .235, .22], [Math.PI / 2, 0, 0]));
  const scG = geo('scale', () => { const q = new THREE.SphereGeometry(1, sg(10, 5), sg(6, 3), 0, TAU, 0, Math.PI * .5); q.rotateX(Math.PI / 2); return q; });
  const scM = [crust('#6a3e1c', { glaze: .2, bump: .003, scale: 6 }), crust('#8f5a2c', { glaze: .2, bump: .003, scale: 6 })];
  for (let ring = 0; ring < 4; ring++) {
    const n = 22 - ring * 5, th = 1.35 - ring * .3;
    for (let i = 0; i < n; i++) { const a = i / n * TAU + ring * .4, dir = [Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a)]; const m = mesh(scG, scM[(i + ring) % 2], [0, 0, 0], [.04 - ring * .004, .03 - ring * .003, .018]); onSurface(m, CC, CR, dir, -.004, 0); m.rotateX(-.35); g.add(m); }
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .3; g.add(bead(felt('#fff7e6', { fibre: .1 }), [Math.cos(a) * .26, .2, Math.sin(a) * .26], [.022, .016, .022])); }
  g.add(taperTube([[0, .37, 0], [.015, .43, 0], [.05, .47, .01], [.075, .45, .02]], .024, .013, wood('#6b4a24', { axis: 1 }), 12, 6));
  return freeze(g);
}
// Apple: streaky glossy skin, top and bottom dimples, curved stem, felt leaf with stitched vein. ~0.5 wide.
export function apple(o = {}) {
  const g = new THREE.Group(), red = new THREE.Color(o.color || PAL.apple), dark = new THREE.Color('#9e1f2a'), blushC = new THREE.Color('#e9c24a');
  const prof = [[0, .02], [.1, .015], [.2, .05], [.25, .14], [.255, .26], [.22, .38], [.14, .45], [.07, .44], [.02, .41], [0, .4]];
  const ag = latheGeo(prof, 48, 0, TAU, 40);
  paintVerts(ag, (v, c) => { const a = Math.atan2(v.x, v.z), streak = noise3(Math.cos(a) * 3, Math.sin(a) * 3 + (o.seed || 0), v.y * 6); c.copy(red).lerp(dark, Math.max(0, streak - .45) * 1.2).lerp(blushC, Math.max(0, Math.sin(a - 2) * .5 - v.y * .8 + .1) * .35); });
  g.add(mesh(ag, enhance(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .35, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.1 }), { tex: glazeTexture(), scale: 5, amt: [.06, .0008, .2, 0] })));
  g.add(taperTube([[0, .38, 0], [0, .46, 0], [.03, .53, .0], [.06, .56, 0]], .02, .013, wood('#5a3a1e', { axis: 1 }), 12, 6));
  // leaf
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.bezierCurveTo(.06, .05, .14, .07, .22, 0); ls.bezierCurveTo(.14, -.07, .06, -.05, 0, 0);
  const lg = new THREE.ShapeGeometry(ls, 12); const lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), y = lp.getY(i); lp.setZ(i, -x * x * 1.6 + Math.abs(y) * .25); }
  lg.computeVertexNormals();
  const leaf = new THREE.Group(); leaf.position.set(.035, .5, 0); leaf.rotation.set(-1.3, .3, .5); g.add(leaf);
  leaf.add(mesh(lg, felt(PAL.leaf, { side: THREE.DoubleSide })));
  leaf.add(runningStitch(Array.from({ length: 8 }, (_, i) => { const x = .02 + i / 7 * .18; return V3(x, 0, -x * x * 1.6 + .006); }), { len: .02, gap: .012, r: .004, color: '#4f8a52' }));
  return freeze(g);
}
// Honey jar: honey-glazed stoneware crock, gingham cloth lid with scalloped edge, twine bow, paper label. ~0.6 tall.
export function honeyJar(o = {}) {
  const g = new THREE.Group();
  const body = [[0, 0], [.2, 0], [.235, .02], [.26, .1], [.27, .24], [.25, .36], [.2, .41], [.19, .44], [.21, .46], [.2, .48], [0, .48]];
  g.add(lathe(body, glaze(o.color || '#e9a23b'), 64, { smooth: 48 }));
  g.add(lathe([[.2, .002], [.236, .025], [.25, .06], [.0, .06]], glaze('#e8d4b0', { rough: .7 }), 48)); // unglazed foot
  // cloth lid: drapes over the rim with a scalloped hem
  const N = sg(96, 24), M = sg(10, 5), pos = [], idx = [];
  for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) {
    const a = i / N * TAU, v = j / M, hemY = .38 - .035 * (1 + Math.cos(a * 9)), r = v < .55 ? v / .55 * .235 : .235 + (v - .55) * .02, y = v < .55 ? .505 - (v / .55) ** 2 * .02 : lerp(.485, hemY, (v - .55) / .45);
    pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
  }
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const cloth = new THREE.BufferGeometry(); cloth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cloth.setIndex(idx); cloth.computeVertexNormals();
  g.add(mesh(cloth, felt('#fffaf2', { side: THREE.DoubleSide, print: { kind: 'gingham', color: o.cloth || '#e2566b', n: 6, scale: 4 } })));
  // twine around the neck + bow
  const tw = thread('#d9c49a');
  g.add(yarn(ringPoints(.237, .455, 48).concat([ringPoints(.237, .455, 48)[0]]), .006, tw, { seg: 90, twists: 50 }));
  const k = V3(0, .455, .24);
  for (const sx of [-1, 1]) { g.add(yarn([k, V3(sx * .05, .48, .27), V3(sx * .08, .45, .26), V3(sx * .03, .44, .25), k], .005, tw, { seg: 24, twists: 10 })); g.add(yarn([k, V3(sx * .03, .4, .26), V3(sx * .05, .36, .25)], .005, tw, { seg: 16, twists: 6 })); }
  // label
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(.272, .272, .15, 32, 1, true, -.75, 1.5), new THREE.MeshStandardMaterial({ map: labelTexture('Honey', { deco: 'bee', w: 512, h: 220 }), roughness: .9, side: THREE.DoubleSide }));
  lab.position.y = .22; g.add(lab);
  return freeze(g);
}
// Coins: penny (copper), nickel, dime. Bevelled, raised rim, embossed value, reeded edge on the dime. Faces on ±z.
export const COINS = { 1: { color: '#d4793a', r: .8 }, 5: { color: '#c9ccd6', r: .95 }, 10: { color: '#d6d9e3', r: .72 }, 25: { color: '#d3d6e0', r: 1.05 } };
export function coin(value = 1, o = {}) {
  const spec = COINS[value] || COINS[1], R = spec.r, T = .16, g = new THREE.Group();
  const col = new THREE.Color(spec.color);
  const pl = !!o.plain && 'p';
  const faceMat = (back) => mc('coinface' + value + back + pl, () => new THREE.MeshPhysicalMaterial({ color: col.clone().lerp(WHITE, value === 1 ? .08 : .2), metalness: .8, roughness: .36, map: coinFaceTexture(value, back, !back && !!pl), bumpMap: coinFaceTexture(value, back, !back && !!pl), bumpScale: 6, envMapIntensity: 2.2, clearcoat: .3 }));
  const edgeM = mc('coinedge' + value, () => new THREE.MeshPhysicalMaterial({ color: col.clone().multiplyScalar(.9), metalness: .9, roughness: .34, envMapIntensity: 2, ...(value === 10 || value === 25 ? { bumpMap: reedTexture(), bumpScale: 3 } : {}) }));
  const edge = latheGeo([[R * .97, -T / 2], [R, -T / 2 + .03], [R, T / 2 - .03], [R * .97, T / 2]], 64);
  g.add(mesh(edge, edgeM, [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
  for (const s of [1, -1]) { const f = mesh(geo('coinface', () => new THREE.CircleGeometry(1, 64)), faceMat(s < 0), [0, 0, s * T / 2], [R * .975, R * .975, 1], [0, s < 0 ? Math.PI : 0, 0]); g.add(f); }
  g.userData.value = value;
  return freeze(g);
}
// stack of coins lying flat (faces up)
export function coinStack(n = 5, value = 1, o = {}) {
  const g = new THREE.Group(), r = rng(o.seed || 3), s = o.scale ?? .3;
  for (let i = 0; i < n; i++) { const c = coin(value); c.scale.setScalar(s); c.rotation.set(-Math.PI / 2, 0, r() * TAU); c.position.set((r() - .5) * .03, s * .08 + i * s * .165, (r() - .5) * .03); g.add(c); }
  return freeze(g);
}
// Savings jar: glass jar with coins inside, tin lid with a coin slot, string tag. ~1.1 tall.
export function savingsJar(o = {}) {
  const g = new THREE.Group(), fill = o.fill ?? .5, r = rng(7);
  const prof = [[0, 0], [.38, 0], [.42, .04], [.44, .2], [.44, .78], [.4, .9], [.3, .96], [.3, 1.02], [0, 1.02]];
  // coins inside, piled in loose layers
  const layers = Math.max(1, Math.round(fill * 22));
  for (let L = 0; L < layers; L++) for (let k = 0; k < 7; k++) {
    const v = [1, 1, 1, 5, 10, 1, 25][(L * 7 + k) % 7], c = coin(v === 25 ? 5 : v); c.scale.setScalar(.15);
    const a = r() * TAU, rr = Math.sqrt(r()) * (.36 - .15 * .8);
    c.position.set(Math.cos(a) * rr, .035 + L * .034 + r() * .015, Math.sin(a) * rr); c.rotation.set(-Math.PI / 2 + (r() - .5) * .5, 0, r() * TAU); g.add(c);
  }
  const jar = lathe(prof, glass('#eef8ff', { opacity: .2 }), 64, { smooth: 40 }); jar.renderOrder = 5; jar.userData.noMerge = true; g.add(jar);
  const rim = lathe(prof.map(p => [p[0] * .985, p[1]]), mc('jarback', () => new THREE.MeshPhysicalMaterial({ color: '#dff0ff', transparent: true, opacity: .08, roughness: .1, side: THREE.BackSide, depthWrite: false })), 64, { smooth: 40 }); rim.renderOrder = 4; rim.userData.noMerge = true; g.add(rim);
  // fake highlight streaks
  for (const [a, w] of [[-.7, .05], [-.5, .02]]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.445, .445, .62, 8, 1, true, a, w), mc('streak', () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide }))); s.position.y = .5; s.renderOrder = 6; s.userData.noMerge = true; g.add(s); }
  // tin lid with slot
  const tin = metal('#c9b27a', { rough: .35 });
  g.add(lathe([[.0, 1.12], [.3, 1.12], [.335, 1.1], [.335, 1.0], [.31, .99], [0, .99]], tin, 48));
  for (let i = 0; i < 3; i++) g.add(mesh(geo('lidRing', () => new THREE.TorusGeometry(.336, .008, 6, 48)), tin, [0, 1.02 + i * .03, 0], 1, [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.BoxGeometry(.26, .02, .05), basic('#2b2018'), [0, 1.122, 0]));
  g.add(rbox(.3, .03, .08, .012, tin).translateY(1.125).translateZ(-.06));
  // tag on a string
  g.add(yarn([[.2, 1.05, .25], [.32, .95, .38], [.36, .82, .42]], .005, thread('#d9c49a'), { seg: 16 }));
  const tag = new THREE.Mesh(geo('tag', () => { const s = new THREE.Shape(); s.moveTo(-.14, -.09); s.lineTo(.1, -.09); s.lineTo(.16, 0); s.lineTo(.1, .09); s.lineTo(-.14, .09); s.lineTo(-.14, -.09); const gg = new THREE.ShapeGeometry(s); gg.computeBoundingBox(); const uv = gg.attributes.uv, p = gg.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + .14) / .3, (p.getY(i) + .09) / .18); return gg; }), new THREE.MeshStandardMaterial({ map: labelTexture(o.label || 'Savings', { w: 300, h: 180, deco: 'heart', fs: 52 }), roughness: .9, side: THREE.DoubleSide }));
  tag.position.set(.37, .75, .45); tag.rotation.set(0, -.3, Math.PI / 2 - .2); g.add(tag);
  return freeze(g);
}

/* =====================================================================================
   CONTAINERS (stock screen)
   ===================================================================================== */
// woven basket with a braided rim and handle; o.liner adds a gingham cloth
export function wickerBasket(o = {}) {
  const g = new THREE.Group(), s = o.size ?? 1, wm = wicker(o.color || '#d9b070', { side: THREE.DoubleSide });
  g.add(lathe([[0, 0], [.42, 0], [.5, .05], [.58, .3], [.6, .38]], wm, 48));
  for (const ph of [0, Math.PI]) g.add(tube(ringPoints(.6, .39, 120).map((p, i) => p.add(V3(0, Math.cos(i / 120 * TAU * 24 + ph) * .022, 0)).multiplyScalar(1 + Math.sin(i / 120 * TAU * 24 + ph) * .03)), .03, wicker('#c9a060'), 240, 8, true));
  if (o.handle !== false) for (const ph of [0, Math.PI]) g.add(tube(Array.from({ length: 30 }, (_, i) => { const a = i / 29 * Math.PI; return V3(Math.cos(a) * .56 + Math.sin(i * 1.3 + ph) * .012, .38 + Math.sin(a) * .62, Math.cos(i * 1.3 + ph) * .022); }), .026, wicker('#c9a060'), 80, 8));
  if (o.liner) g.add(lathe([[.0, .1], [.5, .12], [.6, .4], [.66, .34], [.68, .28]], felt('#fffaf2', { side: THREE.DoubleSide, print: { kind: 'gingham', color: o.liner, n: 6, scale: 4 } }), 48, { smooth: 20 }));
  g.scale.setScalar(s); return freeze(g);
}
// paper bag holding n buns (the bun 'bag of 2'), with a tiny number tag
export function bunBag(n = 2, o = {}) {
  const g = new THREE.Group();
  let bg = new THREE.CylinderGeometry(1, 1, 1, 48, 10, true);
  const p = bg.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const a = Math.atan2(v.x, v.z), sq = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) ** .85;
    const top = v.y > .45 ? (Math.abs(((a / TAU * 48) % 2) - 1) - .5) * .06 : 0;
    const cr = (noise3(v.x * 4, v.y * 5, v.z * 4) - .5) * .08;
    p.setXYZ(i, v.x * sq * (.24 + cr * .3), v.y * .5 + .25 + top, v.z * sq * (.18 + cr * .3));
  }
  bg.computeVertexNormals();
  g.add(mesh(bg, paper('#d9b98a')));
  g.add(mesh(new THREE.BoxGeometry(.48, .01, .36), paper('#c9a674'), [0, .005, 0]));
  // folded cuff
  g.add(runningStitch([[-.24, .4, .185], [.24, .4, .185]], { len: .03, gap: .02, r: .005, color: '#a8865e' }));
  for (let i = 0; i < n; i++) { const b = acornBun({ seed: i + 2 }); b.scale.setScalar(.62); b.position.set((i - (n - 1) / 2) * .2, .36 + (i % 2) * .03, (i % 2 ? -.03 : .02)); b.rotation.y = i * 1.3; g.add(b); }
  const tag = new THREE.Mesh(new THREE.CircleGeometry(.08, 24), new THREE.MeshStandardMaterial({ map: labelTexture(String(n), { w: 128, h: 128, fs: 84, border: '#c98a5a' }), roughness: .9 }));
  tag.position.set(.12, .2, .2); g.add(tag); g.add(yarn([[.12, .27, .2], [.08, .38, .19], [0, .42, .19]], .004, thread('#e2566b'), { seg: 12 }));
  return freeze(g);
}
// wooden box with n slots and n apples (the apples 'box of 5')
export function appleBox(n = 5, o = {}) {
  const g = new THREE.Group(), w = n * .5 + .1, wd = wood('#c99a6a', { axis: 0 }), wd2 = wood('#a87a52', { axis: 1 });
  for (const z of [-.28, .28]) for (const y of [.08, .24]) g.add(rbox(w, .13, .04, .012, wd).translateY(y).translateZ(z));
  for (const x of [-w / 2, w / 2]) g.add(rbox(.05, .34, .6, .012, wd2).translateX(x).translateY(.16));
  g.add(rbox(w, .03, .6, .01, wd).translateY(.02));
  for (let i = 1; i < n; i++) g.add(mesh(new THREE.BoxGeometry(.015, .14, .54), wd2, [-w / 2 + .05 + i * .5, .1, 0]));
  for (let i = 0; i < n; i++) { const a = apple({ seed: i }); a.scale.setScalar(.85); a.position.set(-w / 2 + .3 + i * .5, .05, 0); a.rotation.y = i * 1.7; g.add(a); }
  // nail heads
  for (const x of [-w / 2, w / 2]) for (const y of [.08, .24]) for (const z of [-.28, .28]) g.add(bead(metal('#5a4a3a', { rough: .5 }), [x + Math.sign(x) * .025, y, z], .012));
  // stencilled number
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(.2, .1), new THREE.MeshStandardMaterial({ map: labelTexture(String(n), { w: 128, h: 64, bg: '#c99a6a', border: false, ink: '#6b3f22', fs: 54 }), roughness: .9, transparent: false }));
  lab.position.set(0, .16, .305); g.add(lab);
  return freeze(g);
}
// crate with 2 rows of n/2 small honey jars (the honey 'crate of 10'), rope handles
export function honeyCrate(n = 10, o = {}) {
  const g = new THREE.Group(), cols = Math.ceil(n / 2), w = cols * .34 + .14, d = .82, wd = wood('#b88a5a', { axis: 0 }), wd2 = wood('#8a5a36', { axis: 1 });
  for (const z of [-d / 2, d / 2]) for (const y of [.06, .2]) g.add(rbox(w, .11, .04, .012, wd).translateY(y).translateZ(z));
  for (const x of [-w / 2, w / 2]) { g.add(rbox(.05, .3, d + .04, .012, wd2).translateX(x).translateY(.14)); g.add(yarn([[x + Math.sign(x) * .03, .2, -.15], [x + Math.sign(x) * .09, .3, 0], [x + Math.sign(x) * .03, .2, .15]], .012, thread('#c9a676'), { seg: 20 })); }
  g.add(rbox(w, .03, d, .01, wd).translateY(.015));
  const jar = honeyJar(); freeze(jar);
  for (let i = 0; i < n; i++) { const c = jar.clone(); c.scale.setScalar(.55); c.position.set(-w / 2 + .24 + (i % cols) * .34, .03, (i < cols ? -.19 : .19)); c.rotation.y = (i * 1.9) % 1 - .5; g.add(c); }
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(.26, .12), new THREE.MeshStandardMaterial({ map: labelTexture(String(n), { w: 128, h: 64, bg: '#b88a5a', border: false, ink: '#5a3418', fs: 54 }), roughness: .9 }));
  lab.position.set(0, .13, d / 2 + .025); g.add(lab);
  return freeze(g);
}

/* =====================================================================================
   SET PIECES
   ===================================================================================== */
// The toadstool shop exterior. Stem ~5.4 wide, cap top at y≈7.7. Front door faces +z.
export function toadstoolShop(o = {}) {
  const house = new THREE.Group();
  const stemProf = [[0, 0], [2.6, 0], [2.72, .25], [2.5, 1.6], [2.25, 3.2], [1.95, 4.4], [0, 4.4]];
  const stemM = felt(PAL.cream, { scale: 1.2, bump: .006, fibre: .22 });
  house.add(lathe(stemProf, stemM, 96, { smooth: 40 }));
  const stemR = y => y < .25 ? 2.72 : y < 1.6 ? lerp(2.72, 2.5, (y - .25) / 1.35) : y < 3.2 ? lerp(2.5, 2.25, (y - 1.6) / 1.6) : lerp(2.25, 1.95, (y - 3.2) / 1.2);
  // vertical panel seams on the stem (skip the door side)
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; if (Math.cos(a) > .75) continue; house.add(runningStitch(Array.from({ length: 16 }, (_, k) => { const y = .3 + k / 15 * 3.95; const r = stemR(y) + .02; return V3(Math.sin(a) * r, y, Math.cos(a) * r); }), { len: .1, gap: .07, r: .014, color: '#e6c9a8' })); }
  // moss tufts around the foot
  const moss = felt('#7fb862', { fibre: .3 });
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + Math.sin(i * 5) * .05; if (Math.cos(a) > .93) continue; house.add(mesh(lumpy(SPH(14), .25, 3, i), moss, [Math.sin(a) * 2.72, .08, Math.cos(a) * 2.72], [.32 + (i % 3) * .07, .2, .3])); }
  // cap
  const capProf = [[0, 7.7], [1.6, 7.55], [3.2, 7.0], [4.3, 6.0], [4.85, 5.0], [4.8, 4.55], [4.55, 4.4], [0, 4.4]];
  const capM = felt(o.cap || PAL.toadRed, { clearcoat: .25, scale: 1.1, bump: .006 });
  house.add(lathe(capProf, capM, 128, { smooth: 60 }));
  const capCurve = new THREE.SplineCurve(capProf.slice(0, 6).map(p => new THREE.Vector2(p[0], p[1])));
  const capAt = (a, t, lift = 0) => { const p = capCurve.getPointAt(t), tg = capCurve.getTangentAt(t), nr = V3(Math.sin(a) * tg.y, -tg.x, Math.cos(a) * tg.y).multiplyScalar(-1).normalize(); return { p: V3(Math.sin(a) * p.x, p.y, Math.cos(a) * p.x).addScaledVector(nr, lift), n: nr }; };
  // panel seams on the cap
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; house.add(runningStitch(Array.from({ length: 26 }, (_, k) => capAt(a, .03 + k / 25 * .9, .02).p), { len: .1, gap: .07, r: .014, color: '#b8364b' })); }
  // rolled rim lip with blanket stitch
  house.add(tube(ringPoints(4.78, 4.5, 128), .13, capM, 160, 12, true));
  house.add(blanketStitch(ringPoints(4.66, 4.38, 140), (p) => V3(-p.x, 0, -p.z).normalize().multiplyScalar(.12), { closed: true, spacing: .2, r: .016, color: '#fff1dc' }));
  // underside + gills
  house.add(mesh(new THREE.RingGeometry(1.9, 4.6, 96, 1).rotateX(Math.PI / 2), felt('#f3cdb8', { side: THREE.DoubleSide }), [0, 4.39, 0]));
  const gillS = new THREE.Shape(); gillS.moveTo(1.95, 0); gillS.quadraticCurveTo(3.2, -.42, 4.55, 0); gillS.lineTo(1.95, 0);
  const gillG = new THREE.ExtrudeGeometry(gillS, { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 12 });
  const gillM = felt('#f7d8c4', { fibre: .25 });
  for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; const m = mesh(gillG, gillM, [0, 4.39, 0], [1, i % 2 ? .75 : 1, 1], [0, a + Math.PI / 2, 0]); house.add(m); }
  house.add(blanketStitch(ringPoints(1.98, 4.36, 60), (p) => V3(0, -.14, 0), { closed: true, spacing: .16, r: .016, color: '#d9a894' }));
  // raised felt spots with stitched edges
  const spotG = latheGeo([[0, 0], [.92, 0], [1, .04], [.96, .1], [.7, .13], [0, .14]], 40, 0, TAU, 20);
  const spotM = felt(PAL.spot, { fibre: .18 });
  const spots = o.spots || [[-.5, .5, .42], [.55, .45, .4], [-1.0, .28, .38], [1.05, .7, .34], [-.25, .78, .3], [.3, .2, .36], [.8, .9, .26], [.0, .12, .55], [.9, .3, .5], [1.9, .25, .45], [2.9, .32, .55], [3.7, .52, .4], [4.6, .3, .5], [5.4, .22, .55], [.45, .6, .42], [2.4, .62, .4], [3.3, .1, .32], [5.0, .62, .38], [1.4, .55, .36], [6.0, .55, .4], [.2, .85, .32], [1.2, .82, .3], [2.2, .9, .34], [3.2, .86, .3], [4.2, .82, .34], [5.2, .88, .3]];
  for (const [a, t, s] of spots) {
    const { p, n } = capAt(a, t, -.03);
    const sp = mesh(spotG, spotM, [0, 0, 0], [s, s * 1.1, s]); sp.position.copy(p); sp.quaternion.setFromUnitVectors(V3(0, 1, 0), n); house.add(sp);
    const ring = ringPoints(s * .9, 0, 40).map(q => q.applyQuaternion(sp.quaternion).add(p).addScaledVector(n, .1 * s + .015));
    house.add(runningStitch(ring, { closed: true, len: .06, gap: .045, r: .012, color: '#e9c9b0' }));
  }
  // seam where the cap meets the stem
  house.add(tube(ringPoints(1.97, 4.42, 64), .07, stemM, 64, 8, true));
  // door (round topped, planked, strap hinges)
  const door = new THREE.Group(); door.position.set(0, 0, 2.7); door.rotation.x = -.15; house.add(door);
  const dw = 1.5, dh = 2.6;
  const planks = 4, doorM = wood('#9a6a45', { axis: 1, freq: 3 }), doorM2 = wood('#8f6240', { axis: 1, freq: 3.5 });
  for (let i = 0; i < planks; i++) {
    const x0 = -dw / 2 + i * dw / planks, x1 = x0 + dw / planks - .025;
    const s = new THREE.Shape(); const top = x => { const r = dw / 2, cx = Math.max(-r, Math.min(r, x)); return dh - r + Math.sqrt(Math.max(0, r * r - cx * cx)); };
    s.moveTo(x0, 0); s.lineTo(x1, 0); for (let k = 0; k <= 8; k++) { const x = lerp(x1, x0, k / 8); s.lineTo(x, top(x)); } s.lineTo(x0, 0);
    const pl = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelThickness: .02, bevelSize: .015, bevelSegments: 2 }), i % 2 ? doorM : doorM2); door.add(pl);
  }
  const iron = metal('#4a4048', { rough: .55, env: .8 });
  for (const y of [.55, 2.0]) { door.add(rbox(1.1, .1, .03, .012, iron).translateX(-.25).translateY(y).translateZ(.14)); door.add(mesh(new THREE.CylinderGeometry(.08, .08, .03, 3), iron, [.32, y, .14], 1, [Math.PI / 2, 0, -Math.PI / 2])); for (let k = 0; k < 4; k++) door.add(bead(iron, [-.7 + k * .3, y, .16], .025)); }
  door.add(bead(metal(PAL.gold, { rough: .22 }), [.52, 1.25, .2], .085));
  door.add(rbox(.12, .28, .02, .008, metal(PAL.gold, { rough: .3 })).translateX(.52).translateY(1.15).translateZ(.13));
  door.add(mesh(new THREE.TorusGeometry(.8, .1, 10, 40, Math.PI), wood(PAL.woodFrame, { axis: 2 }), [0, dh - .75, .06]));
  for (const sx of [-1, 1]) door.add(rbox(.2, dh - .75, .2, .04, wood(PAL.woodFrame, { axis: 1 })).translateX(sx * .8).translateY((dh - .75) / 2).translateZ(.06));
  const step = stepStone(1.6, 9); step.position.set(0, 0, 3.15); house.add(step);
  // round windows with mullions, warm glass, curtains, sill and flower boxes
  const glassM = glowMat('#ffd98a', .5, { color: '#ffe9b8' });
  for (const [a, y, s, box] of [[-.78, 2.45, 1, true], [.78, 2.45, 1, true], [0, 3.6, .8, false]]) {
    const w = new THREE.Group(), r = stemR(y) - .02; w.position.set(Math.sin(a) * r, y, Math.cos(a) * r); w.rotation.y = a; w.scale.setScalar(s); house.add(w);
    w.add(mesh(new THREE.CircleGeometry(.46, 32), glassM, [0, 0, .04]));
    for (const sx of [-1, 1]) w.add(mesh(new THREE.CircleGeometry(.46, 16, sx < 0 ? Math.PI * .62 : -Math.PI * .38, Math.PI * .26), felt('#f6a6bd', { print: { kind: 'dots', color: '#ffffff', n: 8, r: .14, scale: 6 } }), [0, 0, .05], 1, [0, 0, sx < 0 ? .2 : -.2]));
    w.add(mesh(new THREE.TorusGeometry(.5, .085, 12, 40), wood(PAL.woodFrame, { axis: 2 }), [0, 0, .08]));
    const wg = glowSprite('#ffc860', 2.2, .45); wg.position.z = .3; w.add(wg);
    w.add(rbox(.07, .92, .05, .015, wood(PAL.woodFrame, { axis: 1 })).translateZ(.1)); w.add(rbox(.92, .07, .05, .015, wood(PAL.woodFrame)).translateZ(.1));
    w.add(mesh(new THREE.CircleGeometry(.46, 32), mc('winshine', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .12, roughness: .05, clearcoat: 1, envMapIntensity: 2, depthWrite: false })), [0, 0, .11]));
    if (box) {
      const bx = new THREE.Group(); bx.name = 'part:windowboxes'; bx.userData.live = true; w.add(bx);
      bx.add(rbox(.9, .2, .3, .04, wood('#7bb4d9')).translateY(-.62).translateZ(.12));
      bx.add(runningStitch([[-.42, -.6, .28], [.42, -.6, .28]], { len: .04, gap: .03, r: .007, color: '#fff6e6' }));
      ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff', '#f6a6bd'].forEach((c, i) => { const f = feltFlower(c, .9, { stem: false }); f.position.set(-.34 + i * .17, -.48 + (i % 2) * .05, .14); f.rotation.x = .9; bx.add(f); });
      for (let i = 0; i < 6; i++) bx.add(ball(felt('#6aa858'), [-.36 + i * .145, -.5, .2], [.08, .05, .06], [.3, 0, 0], 12));
      if (o.boxes === false) bx.visible = false;
    }
  }
  // sign board: "Poppy's Shop" painted on a framed board, hung from two cords
  if (o.sign !== false) {
    const sign = new THREE.Group(); sign.position.set(0, 3.25, stemR(3.25) + .2); sign.rotation.x = -.12; house.add(sign);
    sign.add(rbox(2.3, .72, .12, .04, wood('#9a6a45', { axis: 0 })));
    const sm2 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, .5), new THREE.MeshStandardMaterial({ map: labelTexture(o.sign || "Poppy's Shop", { w: 512, h: 128, bg: '#fff3dc', border: '#c98a5a', fs: 66 }), roughness: .85 }));
    sm2.position.z = .075; sign.add(sm2);
    for (const sx of [-1, 1]) sign.add(yarn([[sx * .9, .36, 0], [sx * .9, .7, -.12]], .012, thread('#c9a676'), { seg: 10 }));
  }
  // lantern by the door (glows at night)
  if (o.lantern !== false) { const lan = lantern(); lan.position.set(1.15, 1.9, stemR(1.9) + .3); house.add(lan); }
  house.userData.stemR = stemR;
  freeze(house);
  house.userData.glass = glassM;
  return house;
}
export function lantern() {
  const l = new THREE.Group(), iron = metal('#4a4048', { rough: .5, env: .8 });
  l.add(mesh(new THREE.CylinderGeometry(.13, .11, .3, 6), glowMat('#ffc85a', .5, { color: '#ffe6a0' }), [0, 0, 0]));
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; l.add(mesh(new THREE.BoxGeometry(.018, .32, .018), iron, [Math.sin(a) * .135, 0, Math.cos(a) * .135])); }
  l.add(mesh(new THREE.ConeGeometry(.2, .16, 6), iron, [0, .23, 0])); l.add(mesh(new THREE.CylinderGeometry(.14, .14, .03, 6), iron, [0, -.16, 0]));
  l.add(mesh(new THREE.TorusGeometry(.05, .012, 6, 16), iron, [0, .34, 0]));
  const gs = glowSprite('#ffcf7a', 1.4, .6); gs.name = 'lanternGlow'; l.add(gs);
  return freeze(l);
}

/* ---------------- inside the shop ---------------- */
// Plank floor disc (radius r) with gaps and nail heads.
export function plankFloor(r = 9, o = {}) {
  const g = new THREE.Group(), w = o.plank ?? .9, tones = ['#c99a6a', '#bf8f5f', '#d0a473'].map(c => wood(c, { axis: 2, freq: 2.6, scale: 1 }));
  g.add(mesh(new THREE.CylinderGeometry(r, r, .1, 64), basic('#4a3020'), [0, -.06, 0]));
  const nails = [], r2 = rng(5);
  for (let i = 0, x = -r + w / 2; x < r; x += w, i++) {
    const half = Math.sqrt(Math.max(0, r * r - (Math.abs(x) + w / 2) ** 2));
    let z = -half;
    while (z < half - .2) { const len = Math.min(half - z, 2.5 + r2() * 3.5); g.add(rbox(w - .03, .1, len - .03, .02, tones[(((i + Math.floor(z)) % 3) + 3) % 3]).translateX(x).translateY(-.05).translateZ(z + len / 2)); nails.push([x - w * .3, z + .15], [x + w * .3, z + .15]); z += len; }
  }
  const nm = metal('#5a4a3a', { rough: .5, env: .6 });
  const nt = new THREE.Group(); nt.add(mesh(SPH(8), nm, [0, 0, 0], [.03, .012, .03]));
  g.add(scatter(nt, nails.map(([x, z]) => ({ p: [x, .002, z] }))));
  return freeze(g);
}
// curved plaster wall (open cylinder seen from inside), wainscot boards, chair rail and timber posts
export function shopWall(r = 8.5, h = 7, o = {}) {
  const g = new THREE.Group(), arc = o.arc ?? TAU, a0 = o.a0 ?? 0; // a0/arc: theta from +z towards +x (pi = back wall)
  g.add(mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true, a0, arc), plaster(o.color || '#fff1dc'), [0, h / 2, 0]));
  const board = wood('#e3c49a', { axis: 1, freq: 3 });
  const n = Math.round(arc * r / .45);
  const bt = new THREE.Group(); bt.add(rbox(.42, 1.3, .08, .02, board));
  g.add(scatter(bt, Array.from({ length: n }, (_, i) => { const a = a0 + (i + .5) / n * arc; return { p: [Math.sin(a) * (r - .05), .65, Math.cos(a) * (r - .05)], ry: a + Math.PI }; })));
  g.add(mesh(new THREE.CylinderGeometry(r - .1, r - .1, .12, 96, 1, true, a0, arc), wood(PAL.woodDark, { side: THREE.DoubleSide }), [0, 1.35, 0]));
  const post = wood('#a87a52', { axis: 1 });
  for (let i = 0; i < (o.posts ?? 9); i++) { const a = a0 + (i + .5) / (o.posts ?? 9) * arc; g.add(rbox(.38, h, .3, .05, post).translateX(Math.sin(a) * (r - .2)).translateY(h / 2).translateZ(Math.cos(a) * (r - .2)).rotateY(a)); }
  return freeze(g);
}
// pink gill ceiling dome
export function gillCeiling(r = 8.5, y = 7) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 64, 16, 0, TAU, 0, Math.PI / 2), felt('#f7d8c4', { side: THREE.BackSide, scale: 1 }), [0, y, 0], [1, .45, 1]));
  const gm = felt('#efc3b0');
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; g.add(tube([[Math.sin(a) * (r - .05), y + .05, Math.cos(a) * (r - .05)], [Math.sin(a) * r * .7, y + r * .3, Math.cos(a) * r * .7], [Math.sin(a) * r * .25, y + r * .43, Math.cos(a) * r * .25]], .07, gm, 16, 6)); }
  return freeze(g);
}
// counter: raised-panel front, thick top, felt bunting
export function counter(o = {}) {
  const g = new THREE.Group(), w = o.w ?? 6.4, h = 1.05;
  const body = wood('#b07a4a', { axis: 0, freq: 3.5 }), dark = wood(PAL.woodDark, { axis: 0 }), panel = wood('#c08a58', { axis: 1, freq: 3 });
  g.add(rbox(w, h - .12, 1.3, .06, body).translateY((h - .12) / 2));
  g.add(rbox(w + .4, .14, 1.75, .05, dark).translateY(h));
  g.add(rbox(w + .1, .14, 1.4, .04, dark).translateY(.07));
  const np = o.panels ?? 5, pw = (w - .4) / np;
  for (let i = 0; i < np; i++) {
    const x = -w / 2 + .2 + pw * (i + .5);
    g.add(rbox(pw - .2, .56, .06, .03, panel).translateX(x).translateY(.52).translateZ(.66));
    for (const [dx, dy, ww, hh] of [[0, .32, pw - .1, .05], [0, -.32 + .52 - .52, pw - .1, .05]]) g.add(rbox(ww, hh, .05, .015, dark).translateX(x + dx).translateY(.52 + (dy === .32 ? .32 : -.32)).translateZ(.67));
    for (const sx of [-1, 1]) g.add(rbox(.05, .69, .05, .015, dark).translateX(x + sx * (pw - .1) / 2).translateY(.52).translateZ(.67));
  }
  // bunting
  const cols = ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#b9a6e8', '#f6a6bd'];
  const nb = Math.round(w / .5); const tri = new THREE.Shape(); tri.moveTo(-.18, 0); tri.lineTo(.18, 0); tri.lineTo(0, -.3); tri.lineTo(-.18, 0);
  const tg = new THREE.ExtrudeGeometry(tri, { depth: .02, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 1 });
  g.add(tube([[-w / 2, h - .1, .9], [0, h - .16, .92], [w / 2, h - .1, .9]], .012, thread('#fff6e6'), 20, 5));
  for (let i = 0; i < nb; i++) { const x = -w / 2 + (i + .5) * w / nb; g.add(mesh(tg, felt(cols[i % cols.length]), [x, h - .11 - Math.cos(x / w * Math.PI) * .05, .9])); g.add(runningStitch([[x - .12, h - .14, .935], [x, h - .34, .935], [x + .12, h - .14, .935]], { len: .03, gap: .02, r: .005, color: '#fff6e6' })); }
  return freeze(g);
}
// shelf unit: back board, 3 shelves with brackets and scalloped felt edging
export function shelves(o = {}) {
  const g = new THREE.Group(), w = o.w ?? 10.6, rows = o.rows ?? 3, rowH = o.rowH ?? 1.3, base = o.base ?? 1.45;
  const back = wood('#d9b48a', { axis: 1, freq: 2.5 }), plank = wood('#8a5a36', { axis: 0 });
  g.add(rbox(w, rows * rowH + .6, .1, .03, back).translateY(base + (rows - 1) * rowH / 2).translateZ(-.55));
  for (let r = 0; r < rows; r++) {
    const y = base + r * rowH;
    g.add(rbox(w, .14, 1.1, .03, plank).translateY(y));
    for (const x of [-w / 2 + .5, 0, w / 2 - .5]) g.add(mesh(geo('bracket', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.5, 0); s.quadraticCurveTo(.1, -.1, 0, -.5); s.lineTo(0, 0); const e = new THREE.ExtrudeGeometry(s, { depth: .08, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2 }); e.translate(0, 0, -.04); return e; }), plank, [x, y - .07, -.5], 1, [0, -Math.PI / 2, 0]));
    // scalloped edging
    const n = Math.round(w / .3), sc = new THREE.Group();
    sc.add(mesh(geo('scallop', () => new THREE.CircleGeometry(.16, 16, Math.PI, Math.PI)), felt(o.edge || '#f6a6bd', { side: THREE.DoubleSide })));
    g.add(scatter(sc, Array.from({ length: n }, (_, i) => ({ p: [-w / 2 + (i + .5) * w / n, y - .06, .565] }))));
    g.add(runningStitch([[-w / 2, y - .1, .575], [w / 2, y - .1, .575]], { len: .05, gap: .035, r: .007, color: '#ffffff' }));
  }
  for (const sx of [-1, 1]) { g.add(rbox(.3, rows * rowH + .9, 1.2, .05, plank).translateX(sx * (w / 2 + .1)).translateY(base + (rows - 1) * rowH / 2)); g.add(ball(wood('#8a5a36'), [sx * (w / 2 + .1), base + (rows - 1) * rowH / 2 + (rows * rowH + .9) / 2 + .1, 0], .18, [0, 0, 0], 20)); }
  return freeze(g);
}
// the till: painted blue box with brass trim, drawer, coin wells and a little bell
export function till(o = {}) {
  const g = new THREE.Group(), paint = felt(o.color || PAL.till, { clearcoat: .5, scale: 3, fibre: .08, bump: .0015 }), brass = metal(PAL.gold, { rough: .25 });
  g.add(rbox(1.1, .5, .85, .06, paint).translateY(.25));
  g.add(rbox(1.16, .06, .9, .025, brass).translateY(.03));
  g.add(rbox(.8, .22, .03, .02, felt(lighten(o.color || PAL.till, -.08), { clearcoat: .5, fibre: .08 })).translateY(.23).translateZ(.43));
  g.add(capsule(brass, [-.12, .23, .47], [.12, .23, .47], .025, 10));
  // slanted coin tray with wells
  const tray = new THREE.Group(); tray.position.set(0, .5, 0); tray.rotation.x = .25; g.add(tray);
  tray.add(rbox(1.0, .08, .7, .03, wood('#8a5a36', { axis: 0 })));
  const vals = o.vals || [1, 1, 5, 5, 10, 10];
  for (let i = 0; i < 6; i++) { const x = -.3 + (i % 3) * .3, z = -.15 + (i > 2 ? .3 : 0); tray.add(mesh(geo('well', () => new THREE.CylinderGeometry(.12, .1, .04, 24)), basic('#3a2a1f'), [x, .03, z])); const c = coinStack(3, vals[i], { seed: i, scale: .13 }); c.position.set(x, .035, z); tray.add(c); }
  g.add(rbox(.95, .34, .08, .03, felt('#fff7e6', { fibre: .1 })).translateY(.78).translateZ(-.33).rotateX(-.3));
  const bell = new THREE.Group(); bell.position.set(.42, .6, .28); g.add(bell);
  bell.add(lathe([[0, .14], [.05, .13], [.08, .06], [.11, 0], [0, 0]], brass, 32)); bell.add(bead(brass, [0, .17, 0], .025)); bell.add(mesh(new THREE.CylinderGeometry(.13, .13, .02, 24), wood('#6b4a33'), [0, -.01, 0]));
  return freeze(g);
}
// round window seen from inside, with curtains (patchwork) and tie-backs
export function roundWindow(o = {}) {
  const w = new THREE.Group(), r = o.r ?? 1.1;
  w.add(mesh(new THREE.CircleGeometry(r, 40), glowMat(o.sky || '#cfeaff', .7, { color: '#dff2ff' })));
  w.add(mesh(new THREE.TorusGeometry(r + .05, .14, 12, 48), wood(PAL.woodFrame, { axis: 2 }), [0, 0, .02]));
  w.add(rbox(.1, r * 2, .07, .02, wood(PAL.woodFrame, { axis: 1 })).translateZ(.05)); w.add(rbox(r * 2, .1, .07, .02, wood(PAL.woodFrame)).translateZ(.05));
  const pm = [felt('#f6a6bd', { print: { kind: 'dots', color: '#fff', n: 6, scale: 3 } }), felt('#ffd9a8', { print: { kind: 'gingham', color: '#e2566b', n: 6, scale: 3 } })];
  for (const sx of [-1, 1]) {
    const cur = new THREE.Group(); cur.position.set(sx * (r + .2), .1, .25); w.add(cur);
    cur.add(mesh(lumpy(SPH(24), .05, 3, sx + 3), pm[sx > 0 ? 1 : 0], [0, 0, 0], [.3, 1.15, .13]));
    cur.add(mesh(geo('tieback', () => new THREE.TorusGeometry(.32, .04, 8, 24)), felt('#fff3e6'), [0, -.25, 0], [1, .45, 1], [Math.PI / 2, 0, 0]));
    cur.add(runningStitch(Array.from({ length: 12 }, (_, i) => V3(sx * -.12, 1 - i / 11 * 1.9, .13)), { len: .05, gap: .035, r: .007, color: '#ffffff' }));
  }
  w.add(capsule(wood('#6b4a33'), [-r - .6, r + .2, .3], [r + .6, r + .2, .3], .04, 8));
  return freeze(w);
}
// braided rag rug (concentric braided rings)
export function braidRug(r = 2.4, o = {}) {
  const g = new THREE.Group(), cols = o.colors || ['#e2566b', '#ffd86b', '#7bb4d9', '#f6a6bd', '#8cc46c'];
  for (let i = 0, rr = .2; rr < r; i++, rr += .12) for (const ph of [0, Math.PI]) g.add(tube(ringPoints(rr, .04, 80).map((p, k) => p.add(V3(0, Math.sin(k / 80 * TAU * Math.round(rr * 18) + ph) * .02, 0)).multiplyScalar(1 + Math.cos(k / 80 * TAU * Math.round(rr * 18) + ph) * .012 / rr)), .045, knit(cols[i % cols.length], { scale: 12 }), 120, 6, true));
  g.scale.z = o.oval ?? .65; return freeze(g);
}
export function hangingLamp(o = {}) {
  const l = new THREE.Group(), iron = metal('#4a4048', { rough: .5, env: .8 });
  l.add(yarn([[0, 0, 0], [0, -(o.drop ?? 1.6), 0]], .01, thread('#5a4a3a'), { seg: 20 }));
  const y = -(o.drop ?? 1.6);
  l.add(lathe([[0, y], [.15, y - .02], [.38, y - .25], [.42, y - .35], [0, y - .3]], felt('#ffd86b', { side: THREE.DoubleSide, print: { kind: 'dots', color: '#ffffff', n: 6, scale: 4 } }), 48, { smooth: 16 }));
  l.add(ball(glowMat('#ffd27a', 1.6, { color: '#fff3d0' }), [0, y - .32, 0], .1, [0, 0, 0], 16));
  l.add(blanketStitch(ringPoints(.41, y - .33, 40), () => V3(0, .05, 0), { closed: true, spacing: .06, r: .006, color: '#e2566b' }));
  const gs = glowSprite('#ffcf7a', 2.4, .5); gs.position.y = y - .4; l.add(gs);
  return freeze(l);
}
export function sweetJar(color = '#f6a6bd') {
  const g = new THREE.Group(), r = rng(color.length);
  for (let i = 0; i < 14; i++) g.add(bead(glossy(['#f6a6bd', '#ffd86b', '#b9a6e8', '#8cc46c'][i % 4], { rough: .2 }), [(r() - .5) * .22, .06 + r() * .25, (r() - .5) * .22], .055));
  const j = lathe([[0, 0], [.17, 0], [.18, .35], [.12, .42], [.12, .46], [0, .46]], glass(), 32, { smooth: 16 }); j.renderOrder = 5; j.userData.noMerge = true; g.add(j);
  g.add(lathe([[0, .52], [.13, .51], [.14, .45], [0, .45]], felt(color), 24));
  return freeze(g);
}

// arched inside door: glowing doorway (daylight or dusk), wooden frame, stitched felt curtain swag
export function archDoor(o = {}) {
  const d = new THREE.Group();
  d.add(slab(archShape(2.2, 3.8), .1, glowMat(o.light || '#d8f0dc', .45, { color: '#cfeed4' }), 0).translateZ(-.02));
  d.add(mesh(new THREE.TorusGeometry(1.15, .14, 10, 40, Math.PI), wood(PAL.woodFrame, { axis: 2 }), [0, 2.7, .06]));
  for (const sx of [-1, 1]) d.add(rbox(.24, 2.75, .24, .04, wood(PAL.woodFrame, { axis: 1 })).translateX(sx * 1.15).translateY(1.37).translateZ(.06));
  d.add(rbox(2.6, .12, .5, .03, wood(PAL.woodDark)).translateY(.06).translateZ(.1));
  return freeze(d);
}
// The whole shop interior used by the shopfloor and serving screens. Origin at the room centre;
// counter front at z≈-1.95, Poppy's spot behind it at (0,0,-3.6), customers stand around (2.6,0,-.4).
export function shopInterior(o = {}) {
  const g = new THREE.Group();
  g.add(plankFloor(9)); g.add(shopWall(8.5, 7, { a0: Math.PI - (o.wallArc ?? 4.2) / 2, arc: o.wallArc ?? 4.2, posts: 7 })); g.add(gillCeiling(8.5, 7));
  const sh = shelves({ edge: o.edge }); sh.position.set(0, 0, -5.4); g.add(sh);
  // shelf stock as instances (one template each)
  const row = (tpl, y, xs) => { const t = tpl; t.updateMatrixWorld(true); const sc = scatter(t, xs.map((x, i) => ({ p: [x, y, -5.25 + (i % 2) * .08], ry: i * 1.3 }))); g.add(sc); };
  const n = o.stock || { bun: 6, apple: 5, honey: 3 };
  row(acornBun(), 1.53, Array.from({ length: n.bun }, (_, i) => -4.3 + i * .72));
  row(apple(), 2.83, Array.from({ length: n.apple }, (_, i) => .9 + i * .7));
  row(honeyJar(), 4.13, Array.from({ length: n.honey }, (_, i) => -1.2 + i * .75));
  for (let i = 0; i < 3; i++) { const j = sweetJar(['#f6a6bd', '#ffd86b', '#b9a6e8'][i]); j.position.set(1.2 + i * .62, 1.53, -5.2); g.add(j); }
  const ct = counter(); ct.position.set(0, 0, -2.6); g.add(ct);
  const tl = till(); tl.position.set(-2, 1.12, -2.55); tl.rotation.y = .12; g.add(tl); g.userData.till = tl;
  const vase = new THREE.Group(); vase.add(lathe([[0, 0], [.22, 0], [.3, .2], [.18, .5], [.22, .62], [0, .6]], glaze('#7bb4d9'), 32, { smooth: 20 }));
  ['#f6a6bd', '#ffd86b', '#ffffff'].forEach((c, i) => { const f = feltFlower(c, 1.2, { stem: true }); f.position.set(-.12 + i * .12, 1.1, 0); f.rotation.z = (i - 1) * .3; vase.add(f); });
  vase.position.set(.9, 1.12, -2.5); g.add(freeze(vase));
  const bk = wickerBasket({ liner: '#7bb4d9' }); bk.scale.multiplyScalar(.75); bk.position.set(2.2, 1.12, -2.6); g.add(bk);
  const w = roundWindow(); w.position.set(-6.9, 3.6, -4.6); w.rotation.y = .98; g.add(w);
  const dr = archDoor({ light: o.doorLight }); dr.position.set(6.6, 0, -5.2); dr.rotation.y = -.9; g.add(dr);
  const lamp = hangingLamp({ drop: 1.7 }); lamp.position.set(0, 7.6, -2.6); g.add(lamp);
  const rug = braidRug(2.2); rug.position.set(1.2, 0, .4); g.add(rug);
  return g;
}
// The meadow around the shop (title, stock and evening screens). Shop at (0,0,-3) facing +z.
export function meadow(o = {}) {
  const g = new THREE.Group();
  g.add(ground(60, o.grass || PAL.grass));
  const hills = [[-30, -40, 22, '#79b25e'], [10, -55, 30, '#6fa756'], [40, -35, 20, '#82bb63'], [-55, -20, 18, '#74ad5a']];
  hills.forEach(([x, z, r, c], i) => g.add(mesh(lumpy(SPH(40), .04, .8, i), felt(c, { scale: .5, mottle: .3 }), [x, -r * .55, z], [r, r * .8, r * .7])));
  const shop = toadstoolShop(o.shop || {}); shop.position.set(0, 0, -3); g.add(shop); g.userData.shop = shop;
  const trees = o.trees || [[-9, -8, 1.3], [-6.5, -12, 1.6], [8.5, -9, 1.4], [11, -14, 1.7], [-12, -3, 1.1], [13, -4, 1.2], [-4, -16, 1.5], [5, -17, 1.6]];
  trees.forEach(([x, z, s], i) => { const t = tree(s, i % 2 ? '#4f8a52' : '#3f7a4a', i + 1); t.position.set(x, 0, z); g.add(t); });
  const r = rng(12), fl = [];
  for (let i = 0; i < 48; i++) { const a = r() * TAU, rr = 5 + r() * 9; fl.push({ p: [Math.cos(a) * rr, .35, Math.sin(a) * rr * .7], s: .7 + r() * .5, ry: r() * 6 }); }
  ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'].forEach((c, i) => { const f = feltFlower(c, 1, { stem: true }); g.add(scatter(f, fl.filter((_, j) => j % 4 === i))); });
  [[-4.3, -.5], [4.6, -1.5], [-6, 2], [6.5, 1.5]].forEach(([x, z], i) => { const m = toadstool(PAL.toadRed, .7); m.position.set(x, 0, z); m.rotation.y = i; g.add(m); });
  [[0, 2.6], [.3, 3.6], [-.1, 4.7], [.25, 5.9]].forEach(([x, z], i) => { const st = stepStone(1, i + 3); st.position.set(x, 0, z); g.add(st); });
  g.add(grassTufts(o.grassN ?? 1400, [-18, 18, -12, 8], '#6aa858'));
  return g;
}

/* ---------------- Bramble's cart ---------------- */
export function cart(o = {}) {
  const c = new THREE.Group(), wd = wood('#b07a4a', { axis: 0 }), wd2 = wood(PAL.woodDark, { axis: 1 }), wd3 = wood('#c08a58', { axis: 0 });
  // bed made of boards
  for (let i = 0; i < 4; i++) c.add(rbox(2.3, .18, .32, .03, i % 2 ? wd : wd3).translateY(.66 + .0).translateZ(-.48 + i * .32).translateY(0));
  for (const z of [-.64, .64]) for (let i = 0; i < 2; i++) c.add(rbox(2.3, .2, .06, .02, i % 2 ? wd3 : wd).translateY(.86 + i * .22).translateZ(z));
  for (const x of [-1.12, 1.12]) for (let i = 0; i < 2; i++) c.add(rbox(.06, .2, 1.3, .02, wd).translateY(.86 + i * .22).translateX(x));
  c.add(rbox(2.42, .08, 1.42, .025, wd2).translateY(1.2));
  for (const x of [-1.12, 1.12]) for (const z of [-.64, .64]) c.add(rbox(.12, .7, .12, .03, wd2).translateX(x).translateY(.95).translateZ(z));
  const nm = metal('#4a4048', { rough: .5, env: .8 });
  for (const x of [-1.12, 1.12]) for (const z of [-.64, .64]) for (const y of [.86, 1.08]) c.add(bead(nm, [x + Math.sign(x) * .04, y, z + Math.sign(z) * .04], .02));
  // wheels with spokes
  for (const sx of [-1, 1]) for (const z of [-.78, .78]) {
    const w = new THREE.Group(); w.position.set(sx * .72, .52, z); c.add(w);
    w.add(mesh(geo('wrim', () => new THREE.TorusGeometry(.46, .06, 10, 40)), wood('#8a5a36', { axis: 2 })));
    w.add(mesh(geo('wtyre', () => new THREE.TorusGeometry(.5, .025, 8, 48)), nm));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; w.add(capsule(wood('#a87a52', { axis: 1 }), [Math.cos(a) * .08, Math.sin(a) * .08, 0], [Math.cos(a) * .42, Math.sin(a) * .42, 0], .028, 8)); }
    w.add(mesh(geo('whub', () => new THREE.CylinderGeometry(.11, .11, .16, 20)), wood('#6b4a33', { axis: 2 }), [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
    w.add(bead(nm, [0, 0, Math.sign(z) * .09], .045));
  }
  c.add(capsule(wd2, [-.72, .52, -.82], [-.72, .52, .82], .035, 8)); c.add(capsule(wd2, [.72, .52, -.82], [.72, .52, .82], .035, 8));
  // handles
  for (const z of [-.3, .3]) c.add(capsule(wd2, [-1.1, .8, z], [-2.2, .5, z * 1.1], .05, 10));
  c.add(capsule(wd2, [-2.15, .52, -.36], [-2.15, .52, .36], .045, 10));
  // canopy: striped scalloped awning on four poles
  for (const x of [-1.05, 1.05]) for (const z of [-.6, .6]) c.add(capsule(wd2, [x, 1.3, z], [x, 2.5, z * 1.3], .035, 8));
  const stripe = felt('#fff7e6', { side: THREE.DoubleSide, print: { kind: 'stripes', color: o.canopy || '#7bb4d9', n: 6, w: .5, scale: 1.2 } });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.6, 48, 1, true, .9, Math.PI - 1.8), stripe);
  roof.rotation.z = Math.PI / 2; roof.position.set(0, 1.48, 0); c.add(roof);
  c.add(capsule(wd2, [-1.3, 2.78, 0], [1.3, 2.78, 0], .035, 8));
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 8; i++) { const x = -1.25 + (i + .5) / 8 * 2.5; c.add(mesh(geo('valance', () => new THREE.CircleGeometry(.165, 16, Math.PI, Math.PI)), i % 2 ? felt('#fff7e6', { side: THREE.DoubleSide }) : felt(o.canopy || '#7bb4d9', { side: THREE.DoubleSide }), [x, 2.5, sz * .815], [1, .9, 1], [0, sz < 0 ? Math.PI : 0, 0])); c.add(bead(felt('#ffd86b'), [x, 2.33, sz * .82], .04)); }
    c.add(runningStitch([[-1.25, 2.47, sz * .825], [1.25, 2.47, sz * .825]], { len: .05, gap: .035, r: .007, color: '#ffffff' }));
  }
  // painted name board
  const nbm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshStandardMaterial({ map: labelTexture(o.name || "Bramble's", { w: 512, h: 128, bg: '#fff3dc', fs: 70, border: '#7bb4d9', dash: true }), roughness: .85 }));
  nbm.position.set(0, .97, .675); c.add(nbm);
  // goods
  if (o.goods !== false) {
    withLod(.45, () => {
    const b1 = wickerBasket({ size: .62, handle: false, liner: '#e2566b' }); b1.position.set(-.62, 1.24, .05); c.add(b1);
    for (let i = 0; i < 4; i++) { const b = bunBag(2); b.scale.setScalar(.5); b.position.set(-.85 + (i % 2) * .42, 1.3 + (i > 1 ? .02 : 0), -.1 + (i > 1 ? .18 : -.1)); if (i < 2) c.add(b); }
    for (let i = 0; i < 3; i++) { const b = acornBun({ seed: i + 7 }); b.scale.setScalar(.55); b.position.set(-.62 + (i - 1) * .17, 1.36 + (i % 2) * .04, .12 + (i - 1) * .05); c.add(b); }
    const bx = appleBox(5); bx.scale.setScalar(.5); bx.position.set(.4, 1.24, .32); c.add(bx);
    const hc = honeyCrate(10); hc.scale.setScalar(.5); hc.position.set(.42, 1.24, -.3); c.add(hc);
    });
  }
  return freeze(c);
}

/* ---------------- outdoors ---------------- */
export function ground(r = 60, color = PAL.grass) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CircleGeometry(r, 96).rotateX(-Math.PI / 2), felt(color, { scale: .9, bump: .006, fibre: .22, mottle: .35, sheen: .3 })));
  return freeze(g);
}
export function tree(s = 1, tint = '#3f7a4a', seed = 1) {
  const t = new THREE.Group();
  t.add(lathe([[0, 0], [.55, 0], [.4, .3], [.32, 1.4], [.3, 2.2], [0, 2.4]], wood('#6b4a33', { axis: 1, freq: 6, grain: .7 }), 20, { smooth: 16 }));
  const leaf = felt(tint, { scale: 1.2, fibre: .25, bump: .007 }), leaf2 = felt(lighten(tint, .06), { scale: 1.2, fibre: .25, bump: .007 });
  [[0, 2.8, 0, 1.4], [-.9, 2.4, .2, 1], [.9, 2.5, -.1, 1.05], [.2, 3.6, .1, 1.05], [-.4, 3.2, -.5, .9], [.5, 3.0, .6, .8]].forEach(([x, y, z, r], i) => t.add(mesh(lumpy(SPH(20), .12, 1.6, seed * 10 + i), i % 2 ? leaf2 : leaf, [x, y, z], r)));
  t.scale.setScalar(s); freeze(t); return t;
}
export function toadstool(cap = PAL.toadRed, s = 1) {
  const m = new THREE.Group();
  m.add(lathe([[0, 0], [.2, 0], [.21, .3], [.15, .68], [0, .7]], felt('#fff1dc'), 24, { smooth: 12 }));
  m.add(lathe([[0, 1.05], [.35, 1.0], [.6, .82], [.7, .68], [.62, .62], [0, .64]], felt(cap, { clearcoat: .25 }), 40, { smooth: 20 }));
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .3, rr = i % 2 ? .45 : .26; const sp = mesh(geo('mspot', () => latheGeo([[0, 0], [.9, 0], [1, .05], [.6, .14], [0, .15]], 20)), felt(PAL.spot), [Math.cos(a) * rr, 1.0 - rr * .45, Math.sin(a) * rr], [.08, .1, .08]); sp.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(Math.cos(a) * rr, .6, Math.sin(a) * rr).normalize()); m.add(sp); }
  m.scale.setScalar(s); freeze(m); return m;
}
export function grassTufts(n, area, color = '#6aa858', seed = 1) {
  const bl = new THREE.Shape(); bl.moveTo(-.045, 0); bl.quadraticCurveTo(-.035, .2, .02, .38); bl.quadraticCurveTo(.03, .2, .045, 0); bl.lineTo(-.05, 0);
  const g = new THREE.ShapeGeometry(bl, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getY(i) ** 2 * .4); g.computeVertexNormals();
  const im = new THREE.InstancedMesh(g, felt('#ffffff', { side: THREE.DoubleSide, scale: 3 }), n);
  const d = new THREE.Object3D(), c = new THREE.Color(), r = rng(seed);
  for (let i = 0; i < n; i++) {
    d.position.set(area[0] + r() * (area[1] - area[0]), 0, area[2] + r() * (area[3] - area[2]));
    d.rotation.set((r() - .5) * .4, r() * TAU, (r() - .5) * .4); d.scale.setScalar(.45 + r() * .6); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    im.setColorAt(i, c.set(color).offsetHSL((r() - .5) * .05, 0, (r() - .5) * .14));
  }
  im.castShadow = false; im.receiveShadow = true; return im;
}
export function stepStone(s = 1, seed = 1) { return mesh(lumpy(SPH(20), .1, 2, seed), felt('#cfc6b4', { fibre: .2 }), [0, .03, 0], [.6 * s, .08 * s, .45 * s]); }
export function fairyLights(points, o = {}) {
  const g = new THREE.Group(), c = new THREE.CatmullRomCurve3(points.map(p => V3(...p)));
  g.add(tube(c, .012, thread('#4a4048'), 60, 4));
  const cols = o.colors || ['#ffd86b', '#f6a6bd', '#a9d4ff', '#b8f0c8', '#ffb37a'], n = o.n || 14;
  const pts = [];
  for (let i = 0; i < n; i++) { const p = c.getPointAt((i + .5) / n), col = cols[i % cols.length]; g.add(mesh(SPH(12), glowMat(col, 1.6), [p.x, p.y - .08, p.z], [.06, .085, .06])); pts.push(V3(p.x, p.y - .08, p.z)); }
  freeze(g); g.add(glowPoints(pts, cols, o.glow ?? .9, .5));
  return g;
}
export function moon(r = 2) {
  const m = new THREE.Group();
  m.add(mesh(SPH(32), new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffe08a', emissiveIntensity: 1.1, roughness: 1, fog: false }), [0, 0, 0], r));
  m.add(glowSprite('#ffe7a0', r * 6, .5)); return m;
}

/* =====================================================================================
   SKY, ENVIRONMENT, LIGHTS, STAGE
   ===================================================================================== */
export const PRESETS = {
  morning: { sky: ['#7fc0f5', '#d9efff', '#fff0d2'], fog: '#e3f1ff', hemi: ['#d6e8ff', '#b8a882', .55], key: ['#ffe8c4', 2.3, [-4, 8, 6]], fill: ['#b8d0ff', .55, [6, 3, 4]], rim: ['#fff0cf', 1.6, [3, 5, -7]], env: .6, exposure: .9, glow: .35 },
  day: { sky: ['#6db3f2', '#c9e8ff', '#f4f9ff'], fog: '#dcefff', hemi: ['#d8ecff', '#6a8a4a', .8], key: ['#fff4e0', 3.0, [-3, 9, 5]], fill: ['#bcd4ff', .7, [6, 3, 4]], rim: ['#ffffff', 1.3, [3, 5, -7]], env: 1, exposure: 1.0, glow: .3 },
  evening: { sky: ['#3d3a8c', '#c77fb2', '#ffc08a'], fog: '#b98aa8', hemi: ['#b9a0e0', '#6a5070', .5], key: ['#ffb27a', 1.9, [-7, 3.5, 5]], fill: ['#8f9cff', .6, [6, 3, 4]], rim: ['#ffcf8a', 2.2, [4, 3, -7]], env: .6, exposure: 1.0, glow: 1.4 },
  night: { sky: ['#141a3d', '#2e3470', '#5a4a7a'], fog: '#262a55', hemi: ['#5a6ab0', '#1a1a2a', .55], key: ['#a8b8ff', .9, [-5, 8, 3]], fill: ['#ffb070', .5, [5, 2, 5]], rim: ['#c8d4ff', 1.4, [3, 5, -7]], env: .35, exposure: 1.05, glow: 2.2 },
  inside: { bg: '#3a2a20', hemi: ['#fff1e0', '#8a6a4a', .8], key: ['#ffe2b8', 2.6, [-6, 7, 6]], fill: ['#b8ccff', .55, [6, 3, 5]], rim: ['#ffd9a0', 1.5, [2, 6, -6]], env: .8, exposure: 1.0, glow: .8, indoor: true },
  insideEvening: { bg: '#2a1c18', hemi: ['#ffcf9a', '#4a3020', .55], key: ['#ffc080', 2.0, [-3, 8, 5]], fill: ['#8a8cff', .35, [6, 3, 5]], rim: ['#ffb060', 1.8, [2, 6, -6]], env: .5, exposure: 1.05, glow: 1.6, indoor: true },
};
export function skyDome(cols) {
  const m = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(cols[0]) }, mid: { value: new THREE.Color(cols[1]) }, bot: { value: new THREE.Color(cols[2]) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.0); \n#include <colorspace_fragment>\n }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), m); s.renderOrder = -10; s.name = 'sky'; return s;
}
export function envScene(p) {
  const s = new THREE.Scene();
  const cols = p.sky || [p.hemi[0], lighten(p.hemi[0], -.1), p.hemi[1]];
  const g = new THREE.SphereGeometry(10, 32, 16), pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const h = pos.getY(i) / 10; c.set(h > .1 ? cols[0] : h > -.1 ? cols[1] : (p.indoor ? '#8a6a4a' : '#9aa878')); if (h > .1) c.lerp(new THREE.Color(cols[1]), 1 - h); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (color, k, pos3, sc) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos3); m.scale.set(...sc); m.lookAt(0, 0, 0); s.add(m); };
  panel(p.key[0], 6, p.key[2].map(v => v * .9), [4, 3, 1]);
  panel(p.fill[0], 2, p.fill[2].map(v => v * 1.2), [5, 3, 1]);
  panel(p.rim[0], 3, p.rim[2].map(v => v * 1.1), [3, 2, 1]);
  return s;
}
export function lightRig(scene, p) {
  const hemi = new THREE.HemisphereLight(...p.hemi); scene.add(hemi);
  const key = new THREE.DirectionalLight(p.key[0], p.key[1]); key.castShadow = true; scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(p.fill[0], p.fill[1]); scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(p.rim[0], p.rim[1]); scene.add(rim, rim.target);
  return { hemi, key, fill, rim };
}

/**
 * createStage(canvas, opts) -> { scene, camera, renderer, lights, render(), setPreset(name), focus(center, radius), frame(eye, target), loop(fn), stats() }
 * opts: { width=1024, height=768, preset='morning', shadows=true, shadowSize=2048, fov=30, tone='aces'|'agx'|'neutral', exposure, dpr, maxDpr=2 }
 */
export function createStage(canvas, opts = {}) {
  const width = opts.width || 1024, height = opts.height || 768;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  const maxDpr = opts.maxDpr ?? 2; let dpr = opts.dpr ?? Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[opts.tone || 'neutral'];
  renderer.shadowMap.enabled = opts.shadows !== false; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(opts.fov || 30, width / height, .1, 400);
  const pmrem = new THREE.PMREMGenerator(renderer), envCache = {};
  let lights = null, sky = null, preset = null, center = V3(0, 1, 0), radius = 8;
  const stage = {
    scene, camera, renderer, THREE,
    get lights() { return lights; }, get preset() { return preset; },
    setPreset(name) {
      const p = typeof name === 'string' ? PRESETS[name] : name; preset = p;
      if (lights) for (const l of Object.values(lights)) { scene.remove(l); if (l.target) scene.remove(l.target); l.dispose?.(); }
      lights = lightRig(scene, p);
      const sz = opts.shadowSize || 2048; lights.key.shadow.mapSize.set(sz, sz); lights.key.shadow.bias = -.0008; lights.key.shadow.normalBias = .05; lights.key.shadow.radius = 4;
      if (sky) scene.remove(sky); sky = null;
      if (p.sky && opts.sky !== false) { sky = skyDome(p.sky); scene.add(sky); scene.background = null; } else scene.background = opts.transparent ? null : new THREE.Color(p.bg || '#3a2a20');
      scene.fog = p.fog && opts.fog !== false ? new THREE.Fog(p.fog, opts.fogNear ?? 35, opts.fogFar ?? 110) : null;
      const key = typeof name === 'string' ? name : JSON.stringify(name);
      if (!envCache[key]) envCache[key] = pmrem.fromScene(envScene(p), .02).texture;
      scene.environment = envCache[key]; scene.environmentIntensity = p.env ?? 1;
      renderer.toneMappingExposure = opts.exposure ?? p.exposure ?? 1;
      stage.setGlow(p.glow ?? 1);
      stage.focus(center, radius);
      return stage;
    },
    glowK: 1,
    setGlow(k) { stage.glowK = k; for (const m of GLOWS) m.emissiveIntensity = m.userData.glowBase * k; scene.traverse(o => { if (o.userData.glowSprite) o.material.opacity = Math.min(1, o.userData.glowBase * Math.max(0, k - .3)); }); return stage; },
    // aim the shadow-casting key light at a region (keeps shadow texels dense)
    focus(c = center, r = radius) {
      center = V3(...(c.isVector3 ? c.toArray() : c)); radius = r;
      for (const n of ['key', 'fill', 'rim']) { const l = lights[n], d = V3(...preset[n][2]).normalize(); l.position.copy(center).addScaledVector(d, 40); l.target.position.copy(center); l.target.updateMatrixWorld(); }
      const sc = lights.key.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix();
      return stage;
    },
    frame(eye, target) { camera.position.set(...eye); camera.lookAt(...target); camera.updateProjectionMatrix(); return stage; },
    // shift the picture by (dx, dy) CSS pixels without moving the camera (centre the scene in the free space between bubble and panel)
    shift(dx = 0, dy = 0) { if (!dx && !dy) camera.clearViewOffset(); else camera.setViewOffset(width, height, -dx, -dy, width, height); return stage; },
    render() { stage.setGlow(stage.glowK); renderer.render(scene, camera); return stage; },
    // animation loop with adaptive device pixel ratio (drops when frames are slow, recovers when fast)
    loop(fn) {
      let last = performance.now(), slow = 0, fast = 0;
      renderer.setAnimationLoop(t => {
        const now = performance.now(), dt = now - last; last = now;
        if (dt > 26) { slow++; fast = 0; } else if (dt < 14) { fast++; slow = 0; }
        if (slow > 20 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); slow = 0; }
        if (fast > 240 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + .25); renderer.setPixelRatio(dpr); fast = 0; }
        fn && fn(t / 1000, dt / 1000); renderer.render(scene, camera);
      });
      return stage;
    },
    stats() { const i = renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries, programs: i.programs.length, dpr }; },
  };
  renderer.info.autoReset = true;
  stage.setPreset(opts.preset || 'morning');
  return stage;
}

/* =====================================================================================
   BAKER: render a model to a transparent PNG (goods, coins, portraits for the DOM panel)
   ===================================================================================== */
export function createBaker(o = {}) {
  const size = o.size || 256, ss = o.supersample ?? 2;
  const canvasEl = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = o.exposure ?? .95; r.setClearColor(0, 0);
  const scene = new THREE.Scene(), p = PRESETS[o.preset || 'morning'], L = lightRig(scene, p);
  for (const n of ['key', 'fill', 'rim']) { L[n].position.set(...p[n][2]); L[n].castShadow = false; }
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(envScene(p), .02).texture; scene.environmentIntensity = o.env ?? 1.1;
  const cam = new THREE.PerspectiveCamera(22, 1, .05, 100);
  return {
    renderer: r,
    // view: { w, h, yaw, pitch, pad, focus:[x,y,z], height } ; returns a PNG data URL
    bake(obj, view = {}) {
      const w = view.w || size, h = view.h || size; r.setPixelRatio(ss); r.setSize(w, h, false);
      scene.add(obj); obj.updateMatrixWorld(true);
      const box = new THREE.Box3(); obj.traverse(m => { if (m.isMesh && !m.userData.noFit && !(m.material && m.material.map && m.geometry.type === 'PlaneGeometry' && m.material.transparent)) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); } });
      const c = view.focus ? V3(...view.focus) : box.getCenter(V3()), sz = box.getSize(V3());
      const yaw = view.yaw ?? .35, pitch = view.pitch ?? .18, pad = view.pad ?? 1.12;
      cam.aspect = w / h; const fitH = view.height ?? Math.max(sz.y, sz.x / cam.aspect) * pad;
      const dist = fitH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) + Math.max(sz.x, sz.z) / 2;
      cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.lookAt(c); cam.updateProjectionMatrix();
      r.render(scene, cam); const url = canvasEl.toDataURL('image/png'); scene.remove(obj); return url;
    },
    // head-and-shoulders portrait of a character for the speech bubble
    portrait(ch, o2 = {}) { const hy = (ch.userData.head?.getWorldPosition(V3()).y ?? 1.95); return this.bake(ch, { focus: [0, hy - .05 + (o2.dy || 0), 0], height: o2.height ?? 1.25, yaw: o2.yaw ?? .25, pitch: .05, w: o2.w || 256, h: o2.h || 256 }); },
  };
}

/* =====================================================================================
   tiny idle animation (optional; mockups are stills)
   ===================================================================================== */
export function idle(o, t) {
  const u = o.userData; if (!u.body) return; const k = t + (u.t0 || 0);
  u.body.position.y = Math.abs(Math.sin(k * 2)) * .02; u.head.rotation.z = Math.sin(k * .9) * .06; u.head.rotation.x = Math.sin(k * .7) * .04;
}

/* =====================================================================================
   THE REST OF THE CAST: one builder for every other visitor, in the same felt detail as Poppy,
   Mrs. Bunbury and Bramble. spec is the game's CAST spec; st holds extra styling (dress print, lashes...).
   ===================================================================================== */
const DOT_PRINT = { kind: 'dots', color: '#ffffff', n: 7, r: .13, scale: 3 };
export function critter(spec = {}, st = {}) {
  const sp = spec.species || 'mouse', acc = [].concat(spec.acc || []);
  if (sp === 'fairy') return fairy(spec, st);
  if (sp === 'hedgehog') return bramble({ fur: spec.fur, spikes: spec.spikes, scarf: acc.includes('scarf') ? spec.scarf : null, cap: !!st.cap, bow: acc.includes('bow') ? (spec.bowColor || '#f6a6bd') : null, apron: st.apron, name: st.name });
  const owl = sp === 'owl', cat = sp === 'cat', rab = sp === 'rabbit', fur = spec.fur || PAL.mouse;
  const { root, body, head } = newRoot();
  const F = felt(fur), F2 = felt(spec.belly || lighten(fur, owl ? .2 : .12)), pink = felt(PAL.pinkSkin), neckY = owl ? 1.22 : 1.3;
  let sleeve = null, cuff = null;
  if (spec.dress) {
    const print = st.print === false ? undefined : (st.print || DOT_PRINT);
    dress(body, { color: spec.dress, trim: spec.dress2 || '#fff3e6', print, hemThread: st.hemThread });
    sleeve = felt(spec.dress, print ? { print } : {}); cuff = felt(spec.dress2 || '#fff3e6');
    const lace = felt(st.collar || '#fffaf2');
    for (let i = 0; i < 9; i++) { const a = (i - 4) * .32; body.add(ball(lace, [Math.sin(a) * .3, 1.29, Math.cos(a) * .27], [.09, .03, .08], [.35 * Math.cos(a), a, 0], 18)); }
    body.add(ball(felt(spec.dress, print ? { print } : {}), [0, 1.32, .03], [.32, .09, .27], [0, 0, 0], 32));
    if (st.buttons !== false) for (let i = 0; i < 3; i++) { const y = 1.18 - i * .17, b = button(st.button || '#fff6e6', .04, { thread: lighten(spec.dress, -.3) }); b.position.copy(V3(0, y, dressR(y) + .012)); b.lookAt(0, y + .4, 10); body.add(b); }
  } else {
    // a stuffed felt tummy with a sewn-on belly patch
    const BC = owl ? [0, .8, 0] : [0, .72, 0], BR = owl ? [.78, .84, .7] : [.62, .68, .55];
    const PC = owl ? [0, .74, .33] : [0, .66, .28], PR = owl ? [.56, .62, .44] : [.42, .48, .32];
    body.add(mesh(seamSphere(48, 'x', .015, .05), F, BC, BR));
    body.add(ball(F2, PC, PR, [0, 0, 0], 40));
    body.add(blanketStitch(ringPoints(1, 0, 64).map(p => ellPoint(BC, BR, [p.x * PR[0], PC[1] - BC[1] + p.z * PR[1], BR[2] * 1.2], .006).p), p => V3(PC[0], PC[1], PC[2] + .2).sub(p).normalize().multiplyScalar(.03), { closed: true, spacing: .065, r: .0065, color: lighten(fur, -.25) }));
    if (owl) { // rows of scalloped feather stitches on the chest
      const fm = thread(lighten(spec.belly || fur, -.22));
      for (let r = 0; r < 4; r++) for (let k = -1; k <= 1; k++) {
        if (r === 3 && k) continue;
        const x = k * .22 + (r % 2) * .11 - .055 * (r % 2 ? 1 : 0), y = .35 - r * .2 + (PC[1] - .74);
        if (Math.abs(x) > .35) continue;
        body.add(tube([[x - .09, y, 1], [x - .05, y - .07, 1], [x, y - .09, 1], [x + .05, y - .07, 1], [x + .09, y, 1]].map(d => ellPoint(PC, PR, [d[0] * PR[0] * 1.6, d[1] * PR[1] * 1.6, d[2]], .004).p), .007, fm, 16, 5));
      }
    }
  }
  // feet
  if (owl) {
    const om = felt('#e8a24a');
    for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) body.add(capsule(om, [sx * .24, .06, .2], [sx * .24 + k * .09, .05, .4], .05, 10));
  } else feet(body, sp === 'mouse' ? pink : F);
  // tails
  if (sp === 'mouse') body.add(taperTube([[0, .4, -.5], [.1, .25, -.9], [.45, .2, -1.15], [.7, .45, -1.1], [.78, .72, -.95], [.7, .82, -.9]], .04, .018, pink, 60, 10));
  if (cat) { body.add(taperTube([[0, .35, -.45], [.2, .3, -.85], [.45, .62, -.92], [.52, 1.0, -.8], [.42, 1.22, -.66]], .09, .07, F, 40, 12)); body.add(ball(F2, [.42, 1.24, -.65], .085, [0, 0, 0], 20)); }
  if (rab) body.add(mesh(lumpy(SPH(24), .12, 5, 3), felt('#fffaf4', { fibre: .35, bump: .006 }), [0, .45, -.58], .2));
  if (owl) { const tm = felt(lighten(fur, -.1)); for (const k of [-1, 0, 1]) body.add(ball(tm, [k * .14, .32, -.66], [.11, .26, .06], [-.5, 0, k * .3], 20)); }
  // arms (an owl has felt wings)
  let armL, armR;
  if (owl) {
    const wm = felt(lighten(fur, -.07)), tm = lighten(fur, -.28);
    const wing = side => {
      const a = new THREE.Group(); a.position.set(side * .62, 1.3, 0); a.userData.live = true; a.name = side < 0 ? 'armL' : 'armR';
      const WC = [side * .1, -.42, .02], WR = [.17, .52, .32];
      a.add(mesh(seamSphere(32, 'z', .012, .05), wm, WC, WR, [0, 0, side * .18]));
      for (let r = 0; r < 3; r++) a.add(runningStitch(ellArc(WC, WR, [side * .6, .1 - r * .32, .8], [side * .2, -.25 - r * .32, 1], 8, .006).map(p => p.applyAxisAngle(V3(0, 0, 1), 0)), { len: .03, gap: .02, r: .005, color: tm }));
      const paw = new THREE.Group(); paw.name = a.name + 'Paw'; paw.position.set(side * .14, -.85, .16); a.add(paw); a.userData.paw = paw;
      return a;
    };
    armL = wing(-1); armR = wing(1);
  } else { armL = arm(F, F2, -1, neckY, { sleeve, cuff }); armR = arm(F, F2, 1, neckY, { sleeve, cuff }); }
  body.add(armL, armR);
  // head
  head.position.set(0, owl ? 1.82 : 1.9, 0); body.add(head); body.add(feltNeck(F, neckY));
  let HR;
  if (sp === 'mouse') {
    HR = [.55, .5, .52];
    head.add(mesh(seamSphere(56, 'x', .02, .05), F, [0, 0, 0], HR));
    head.add(runningStitch(ellArc([0, 0, 0], HR, [0, 1, .12], [0, .2, -1], 26, .006), { len: .035, gap: .025, r: .006, color: lighten(fur, -.18) }));
    const MC = [0, -.12, .36], MR = [.3, .22, .26];
    head.add(ball(F2, MC, MR, [0, 0, 0], 40));
    head.add(ball(felt('#e88aa0', { clearcoat: .3 }), [0, -.06, .615], [.085, .065, .065], [0, 0, 0], 24));
    embroideredMouth(head, MC, MR, [[0, .05, 1], [0, -.3, 1], [-.25, -.45, 1], [-.42, -.3, 1]]);
    embroideredMouth(head, MC, MR, [[0, -.3, 1], [.25, -.45, 1], [.42, -.3, 1]]);
    embroideredEyes(head, [0, 0, 0], HR, { x: .2, y: .07, z: .45, w: .14, h: .18, lashes: !!st.lashes });
    blush(head, .33, -.08, .42, .075);
    whiskers(head, .17, -.1, .53);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * .46, .46, -.08); ear.rotation.y = sx * -.25; head.add(ear);
      ear.add(ball(F, [0, 0, 0], [.36, .36, .1], [0, 0, 0], 40));
      ear.add(ball(pink, [0, -.01, .055], [.25, .25, .05], [0, 0, 0], 32));
      ear.add(blanketStitch(ringPoints(1, 0, 48).map(p => V3(p.x * .245, -.01 + p.z * .245, .078)), p => V3(p.x, p.y + .01, 0).normalize().multiplyScalar(.03), { closed: true, spacing: .05, r: .0055, color: '#d97a90' }));
    }
  } else if (rab) {
    HR = [.58, .52, .52];
    head.add(mesh(seamSphere(56, 'x', .015, .05), F, [0, 0, 0], HR));
    const MC = [0, -.15, .38], MR = [.3, .2, .22];
    head.add(ball(F2, MC, MR, [0, 0, 0], 40));
    head.add(ball(felt('#e88aa0', { clearcoat: .3 }), [0, -.085, .585], [.075, .055, .055], [0, 0, 0], 24));
    embroideredMouth(head, MC, MR, [[0, .1, 1], [0, -.3, 1], [-.25, -.45, 1], [-.42, -.3, 1]]);
    embroideredMouth(head, MC, MR, [[0, -.3, 1], [.25, -.45, 1], [.42, -.3, 1]]);
    embroideredEyes(head, [0, 0, 0], HR, { x: .21, y: .06, z: .45, w: .14, h: .18, lashes: st.lashes !== false });
    blush(head, .35, -.1, .41, .075);
    whiskers(head, .17, -.13, .53, .3, '#a39890');
    for (const sx of [-1, 1]) {
      const flop = spec.flop && sx > 0;
      const ear = new THREE.Group(); ear.position.set(sx * .22, .4, -.05); ear.rotation.set(flop ? .5 : -.12, 0, sx * -.18 + (flop ? -1.25 : 0)); head.add(ear);
      ear.add(ball(F, [0, .55, 0], [.17, .6, .11], [0, 0, 0], 36));
      ear.add(ball(pink, [0, .55, .065], [.1, .48, .05], [0, 0, 0], 28));
      ear.add(runningStitch(Array.from({ length: 40 }, (_, i) => { const a = i / 40 * TAU; return V3(Math.cos(a) * .102, .55 + Math.sin(a) * .49, .092); }), { closed: true, len: .035, gap: .025, r: .005, color: '#d97a90' }));
    }
  } else if (cat) {
    HR = [.6, .5, .5];
    head.add(mesh(seamSphere(56, 'x', .018, .05), F, [0, 0, 0], HR));
    head.add(runningStitch(ellArc([0, 0, 0], HR, [0, 1, .12], [0, .2, -1], 26, .006), { len: .035, gap: .025, r: .006, color: lighten(fur, -.18) }));
    const MC = [0, -.16, .34], MR = [.28, .18, .22];
    for (const sx of [-1, 1]) head.add(ball(F2, [sx * .1, -.16, .36], [.17, .14, .17], [0, 0, 0], 32));
    head.add(ball(F2, [0, -.25, .33], [.12, .08, .12], [0, 0, 0], 24));
    head.add(mesh(geo('catnose', () => { const g = new THREE.ConeGeometry(1, 1, 3); g.rotateX(Math.PI); g.rotateY(Math.PI / 6); return g; }), felt('#e88aa0', { clearcoat: .3 }), [0, -.08, .53], [.07, .06, .04], [-.3, 0, 0]));
    embroideredMouth(head, MC, MR, [[0, .05, 1], [0, -.3, 1], [-.25, -.45, 1], [-.42, -.3, 1]]);
    embroideredMouth(head, MC, MR, [[0, -.3, 1], [.25, -.45, 1], [.42, -.3, 1]]);
    embroideredEyes(head, [0, 0, 0], HR, { x: .22, y: .07, z: .45, w: .15, h: .2, lashes: !!st.lashes, ink: st.eye || PAL.ink });
    blush(head, .35, -.1, .4, .075);
    whiskers(head, .2, -.15, .5, .38, lighten(fur, -.25));
    const ec = geo('catear', () => new THREE.ConeGeometry(1, 1, 32));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * .34, .36, -.02); ear.rotation.set(-.1, sx * -.2, sx * -.38); head.add(ear);
      ear.add(mesh(ec, F, [0, .18, 0], [.21, .38, .1]));
      ear.add(mesh(ec, pink, [0, .15, .055], [.13, .27, .05]));
      ear.add(runningStitch([[-.12, .02, .085], [0, .3, .085], [.12, .02, .085]], { len: .03, gap: .02, r: .005, color: '#d97a90' }));
    }
    if (st.stripes) { const sm = felt(st.stripes); for (const k of [-1, 0, 1]) { const s = mesh(SPH(16), sm, [0, 0, 0], [.03, .11, .02]); onSurface(s, [0, 0, 0], HR, [k * .14, .85, .5], -.004); head.add(s); } }
  } else if (owl) {
    HR = [.66, .55, .55];
    head.add(mesh(seamSphere(56, 'x', .015, .05), F, [0, 0, 0], HR));
    const disc = felt(spec.belly || lighten(fur, .2)), ring = felt('#ffe9a8'), im = thread(PAL.ink), wm = thread('#fffaf0');
    for (const sx of [-1, 1]) {
      head.add(ball(disc, [sx * .25, .0, .42], [.26, .26, .09], [0, sx * .2, 0], 36));
      head.add(blanketStitch(ringPoints(1, 0, 48).map(p => V3(sx * .25 + p.x * .245, p.z * .245, .5 - Math.abs(p.x) * .05 * sx * sx)), p => V3(sx * .25, 0, .5).sub(p).setZ(0).normalize().multiplyScalar(.03), { closed: true, spacing: .05, r: .0055, color: lighten(fur, -.2) }));
      head.add(ball(ring, [sx * .25, .02, .5], [.15, .15, .035], [0, 0, 0], 28));
      const e = satin(.15, .17, im, { threads: 8, dome: .02 }); e.position.set(sx * .25, .02, .535); head.add(e);
      const hl = satin(.05, .045, wm, { threads: 2, dome: .004 }); hl.position.set(sx * .25 + .035, .07, .555); head.add(hl);
      head.add(mesh(geo('tuft', () => new THREE.ConeGeometry(1, 1, 16)), F, [sx * .44, .48, -.02], [.12, .3, .08], [0, 0, sx * -.45]));
      head.add(runningStitch(ellArc([0, 0, 0], HR, [sx * .08, .28, .9], [sx * .45, .32, .7], 10, .006), { len: .03, gap: .02, r: .005, color: lighten(fur, -.25) }));
    }
    head.add(mesh(geo('beak', () => new THREE.ConeGeometry(.08, .22, 18)), glossy('#e8a24a', { rough: .35 }), [0, -.15, .56], 1, [Math.PI * .62, 0, 0]));
    blush(head, .42, -.18, .38, .06);
  }
  accessories(head, body, spec, acc, { sp, neckY, HR, owl, cat, rab });
  return rig(root, body, head, armL, armR, st.name || sp);
}

function accessories(head, body, spec, acc, k) {
  const { sp, neckY, HR, owl } = k;
  for (const a of acc) {
    if (a === 'glasses') {
      const gm = metal('#c9a04e', { rough: .25 }), r = owl ? .17 : .11, ex = owl ? .25 : .2, ey = owl ? .02 : .08, ez = owl ? .58 : null;
      const ctr = sx => ez ? V3(sx * ex, ey, ez) : ellPoint([0, 0, 0], HR, [sx * ex, ey, .45], .05).p;
      for (const sx of [-1, 1]) {
        const c = ctr(sx); head.add(mesh(geo('lens' + r, () => new THREE.TorusGeometry(r, .016, 8, 32)), gm, c.toArray()));
        head.add(mesh(geo('lensg' + r, () => new THREE.CircleGeometry(r, 24)), glass('#ffffff', { opacity: .14 }), c.toArray()));
        const ear = ellPoint([0, 0, 0], HR, [sx, .1, .05], .02).p;
        head.add(tube([V3(c.x + sx * r, c.y, c.z), V3(c.x + sx * (r + .08), c.y + .02, c.z - .12), ear], .012, gm, 10, 5));
      }
      const l = ctr(-1), rr = ctr(1);
      head.add(tube([V3(l.x + r, l.y, l.z), V3(0, l.y + .05, l.z + .03), V3(rr.x - r, rr.y, rr.z)], .013, gm, 10, 5));
    } else if (a === 'scarf') {
      knitScarf(body, spec.scarf || '#7bb4d9', neckY);
    } else if (a === 'bow') {
      const b = feltBow(spec.bowColor || '#f2a7b5', 1); b.position.set(.3, .42, .16); b.rotation.set(-.2, .2, -.3); head.add(b);
    } else if (a === 'sailor') {
      const wm = felt('#ffffff'), bm = felt('#3a6ea5');
      const cap = new THREE.Group(); cap.position.set(0, .43, -.02); cap.rotation.set(-.12, 0, .1); head.add(cap);
      cap.add(lathe(smoothProfile([[0, .2], [.3, .19], [.4, .14], [.38, .06], [.33, 0], [0, 0]], 18), wm, 48));
      cap.add(mesh(geo('sband', () => new THREE.CylinderGeometry(.345, .335, .08, 48, 1, true)), bm, [0, .04, 0]));
      cap.add(runningStitch(ringPoints(.35, .08, 60), { closed: true, len: .03, gap: .02, r: .005, color: '#ffffff' }));
      cap.add(runningStitch(ringPoints(.39, .145, 60), { closed: true, len: .03, gap: .02, r: .005, color: '#c9d6e6' }));
      for (const sx of [-1, 1]) cap.add(tube([[sx * .06, .04, -.33], [sx * .1, -.12, -.38], [sx * .14, -.3, -.36]], .02, bm, 10, 6));
      // square sailor collar and a red neckerchief
      body.add(lathe(smoothProfile([[.24, 1.38], [.36, 1.3], [.48, 1.18], [.53, 1.1]], 12), felt('#3a6ea5', { side: THREE.DoubleSide }), 48, { phiStart: Math.PI * .55, phiLen: Math.PI * .9 }));
      body.add(runningStitch(Array.from({ length: 30 }, (_, i) => { const p = Math.PI * .58 + i / 29 * Math.PI * .84; return V3(Math.sin(p) * .5, 1.15, Math.cos(p) * .5); }), { len: .035, gap: .025, r: .006, color: '#ffffff' }));
      const nk = feltBow('#e2566b', .9); nk.position.set(0, 1.24, .32); body.add(nk);
    } else if (a === 'tricorn') {
      const hm = felt('#2e2a3a', { side: THREE.DoubleSide }), gold = metal('#e9b949', { rough: .3 });
      const hat = new THREE.Group(); hat.position.set(0, .4, -.02); hat.rotation.set(-.1, 0, -.06); head.add(hat);
      hat.add(lathe(smoothProfile([[0, .42], [.34, .38], [.42, .2], [.44, .06], [.0, .06]], 16), hm, 48));
      // three sides cocked up steeply so it reads as a pirate hat from the front
      const BR = .74, BY = .4;
      const brim = lathe([[.4, .06], [.56, .12], [.68, .26], [BR, BY]], hm, 3); hat.add(brim); // one corner points forward
      const corners = [0, 1, 2].map(i => { const t = i / 3 * TAU; return V3(Math.sin(t) * BR, BY, Math.cos(t) * BR); });
      for (let i = 0; i < 3; i++) { const p0 = corners[i], p1 = corners[(i + 1) % 3]; hat.add(tube([p0, p0.clone().lerp(p1, .5).setY(BY - .04), p1], .02, gold, 16, 6)); hat.add(bead(gold, p0.toArray(), .045)); }
      const ck = new THREE.Group(); ck.position.set(.3, .34, .36); ck.rotation.set(-.5, .7, 0); hat.add(ck);
      ck.add(ball(felt('#f2f0e6'), [0, 0, 0], [.1, .1, .03], [0, 0, 0], 20)); ck.add(button('#e9b949', .04, { mat: gold })); 
    } else if (a === 'eyepatch') {
      const pm = felt('#2e2a3a');
      const s = mesh(SPH(24), pm, [0, 0, 0], [.12, .12, .03]); onSurface(s, [0, 0, 0], HR, [.2, .08, .45], .005); head.add(s);
      head.add(runningStitch(ringPoints(1, 0, 30).map(p => ellPoint([0, 0, 0], HR, [.2 + p.x * .1, .08 + p.z * .1, .45], .028).p), { closed: true, len: .025, gap: .018, r: .004, color: '#8a8698' }));
      head.add(tube(ellArc([0, 0, 0], HR, [-.6, .55, .4], [.9, -.25, .3], 16, .012), .016, pm, 24, 6));
    } else if (a === 'collar') {
      const gold = metal('#e9b949', { rough: .28 }), blue = glossy('#3a7bd5', { rough: .25 });
      body.add(lathe(smoothProfile([[.26, 1.4], [.38, 1.33], [.5, 1.22], [.55, 1.14]], 12), gold, 48));
      for (let r = 0; r < 2; r++) { const n = 22 + r * 6, rad = .4 + r * .09, y = 1.3 - r * .08; for (let i = 0; i < n; i++) { const t = i / n * TAU; body.add(bead((i + r) % 2 ? blue : gold, [Math.sin(t) * rad, y, Math.cos(t) * rad], .035)); } }
      for (let i = 0; i < 9; i++) { const t = (i - 4) * .26; body.add(mesh(geo('drop', () => latheGeo([[0, -.06], [.03, -.04], [.035, 0], [0, .04]], 12)), i % 2 ? gold : blue, [Math.sin(t) * .56, 1.08, Math.cos(t) * .53])); }
      const ear = ellPoint([0, 0, 0], HR, [.75, .45, .1], .0).p; head.add(mesh(geo('ering', () => new THREE.TorusGeometry(.05, .012, 6, 20)), gold, [ear.x + .02, ear.y - .02, ear.z + .05]));
    } else if (a === 'leaves') {
      const lm = felt('#7cb36a'), lm2 = felt('#94c47e'), vein = '#5a8a4a';
      for (let i = 0; i < 13; i++) {
        const t = (i - 6) * .24, p = ellPoint([0, 0, 0], HR, [Math.sin(t) * .9, .55, Math.cos(t) * .55 - .25], .02);
        const l = mesh(SPH(16), i % 2 ? lm : lm2, [0, 0, 0], [.065, .13, .025]); l.position.copy(p.p); l.quaternion.setFromUnitVectors(V3(0, 0, 1), p.n); l.rotateZ(t * .8 + (i % 2 ? .5 : -.5)); head.add(l);
      }
      for (const t of [-1.1, -.4, .4, 1.1]) { const p = ellPoint([0, 0, 0], HR, [Math.sin(t) * .9, .6, Math.cos(t) * .55 - .25], .06).p; head.add(bead(glossy('#e9b949', { rough: .3 }), p.toArray(), .035)); }
      head.add(runningStitch(Array.from({ length: 20 }, (_, i) => { const t = (i / 19 - .5) * 2.9; return ellPoint([0, 0, 0], HR, [Math.sin(t) * .9, .55, Math.cos(t) * .55 - .25], .025).p; }), { len: .03, gap: .02, r: .005, color: vein }));
    }
  }
}

/* ---------- the Fairy Queen: felt doll with a flowered gown, organza wings, a tiara and a wand ---------- */
function starShape(r1 = 1, r0 = .45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r0 : r1, a = i / 10 * TAU + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return s;
}
export function starGeo() { return geo('star', () => { const g = new THREE.ExtrudeGeometry(starShape(), { depth: .3, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 2 }); g.center(); return g; }); }
export function fairy(spec = {}, o = {}) {
  const { root, body, head } = newRoot();
  const skin = felt('#ffdcc6'), dc = spec.dress || '#d4c4ff', d2 = spec.dress2 || '#fff3cf', hc = spec.hair || '#f2d27a', neckY = 1.3;
  const pr = { kind: 'flowers', color: '#ffffff', color2: '#ffe08a', leaf: '#b9d9a6', scale: 3, n: 5 };
  const gown = smoothProfile([[0, 1.3], [.3, 1.26], [.4, 1.02], [.62, .55], [.86, .18], [.9, .1], [.84, .08], [0, .08]], 48);
  body.add(lathe(gown, felt(dc, { print: pr }), 72));
  const pm = felt(d2);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; body.add(ball(pm, [Math.sin(a) * .82, .13, Math.cos(a) * .82], [.22, .09, .15], [0, a, 0], 20)); }
  body.add(blanketStitch(ringPoints(.86, .22, 90), p => V3(-p.x, 0, -p.z).normalize().multiplyScalar(.012).add(V3(0, .05, 0)), { closed: true, spacing: .07, r: .007, color: '#ffffff' }));
  body.add(mesh(geo('sash', () => new THREE.TorusGeometry(.41, .06, 10, 40)), pm, [0, 1.06, 0], 1, [Math.PI / 2, 0, 0]));
  const sb = feltBow(d2, 1.1, '#e0c890'); sb.position.set(0, 1.06, .42); body.add(sb);
  body.add(ball(felt(dc, { print: pr }), [0, 1.32, .03], [.32, .09, .27], [0, 0, 0], 32));
  for (let i = 0; i < 9; i++) { const a = (i - 4) * .32; body.add(ball(pm, [Math.sin(a) * .3, 1.29, Math.cos(a) * .27], [.09, .03, .08], [.35 * Math.cos(a), a, 0], 18)); }
  const shoe = glossy('#b9a6e8', { rough: .3 });
  for (const sx of [-1, 1]) { body.add(capsule(skin, [sx * .17, .15, 0], [sx * .19, -.25, .02], .085, 12)); body.add(ball(shoe, [sx * .19, -.33, .07], [.12, .09, .17], [0, 0, 0], 20)); }
  const puff = felt(d2);
  const armL = arm(skin, skin, -1, neckY, { sleeve: puff, cuff: puff }), armR = arm(skin, skin, 1, neckY, { sleeve: puff, cuff: puff });
  body.add(armL, armR);
  let wand = null;
  if (o.wand !== false) {
    wand = new THREE.Group(); wand.name = 'wand'; wand.position.set(0, .02, .02); armR.userData.paw.add(wand);
    wand.add(capsule(wood('#a87842', { axis: 1 }), [0, -.12, 0], [.04, .55, -.04], .022, 8));
    const star = mesh(starGeo(), glowMat('#ffe58a', 1.4, { color: '#fff3c0' }), [.05, .66, -.05], .12); star.name = 'star'; star.userData.live = true; wand.add(star);
    wand.add(yarn([[.04, .5, -.04], [.12, .44, 0], [.1, .32, .02]], .006, thread('#f6a6bd'), { seg: 12 }));
    const sg = glowSprite('#ffe9a0', 1.1, .8); sg.position.copy(star.position); wand.add(sg);
  }
  head.position.set(0, 1.98, 0); body.add(head); body.add(feltNeck(skin, neckY));
  const HR = [.6, .56, .55];
  head.add(ball(skin, [0, 0, 0], HR, [0, 0, 0], 56));
  head.add(ball(felt('#f7c4ad'), [0, -.05, .55], [.05, .04, .03], [0, 0, 0], 16));
  for (const sx of [-1, 1]) head.add(ball(skin, [sx * .58, -.02, 0], [.09, .14, .08], [0, 0, 0], 20));
  embroideredEyes(head, [0, 0, 0], HR, { x: .21, y: .02, z: .45, w: .14, h: .18, lashes: true });
  embroideredMouth(head, [0, 0, 0], HR, [[-.12, -.3, .9], [0, -.36, .9], [.12, -.3, .9]], '#c2566b', .011);
  blush(head, .36, -.16, .44, .09);
  const hm = felt(hc), hh = lighten(hc, -.2);
  head.add(ball(hm, [0, .12, -.06], [.64, .58, .6], [0, 0, 0], 48));
  head.add(ball(hm, [0, .3, .2], [.56, .3, .45], [0, 0, 0], 40));
  for (const sx of [-1, 1]) head.add(ball(hm, [sx * .32, .26, .4], [.26, .18, .14], [0, 0, sx * .5], 28));
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; head.add(runningStitch(ellArc([0, .12, -.06], [.64, .58, .6], [Math.sin(a) * .2, 1, Math.cos(a) * .2], [Math.sin(a), .1, Math.cos(a) - .2], 14, .006), { len: .04, gap: .03, r: .005, color: hh })); }
  head.add(mesh(lumpy(SPH(28), .06, 4, 3), hm, [0, .64, -.24], .27));
  head.add(blanketStitch(ringPoints(.27, 0, 40).map(p => p.add(V3(0, .5, -.24))), () => V3(0, .04, 0), { closed: true, spacing: .06, r: .005, color: hh }));
  // tiara: a gold band with five felt-and-gold stars and pink jewels
  if (spec.crown) {
    const gold = metal('#ffd86b', { rough: .25 }), jewel = glossy('#f2a7b5', { rough: .15 });
    head.add(tube(Array.from({ length: 13 }, (_, i) => { const t = (i / 12 - .5) * 2.2; return ellPoint([0, .12, -.06], [.64, .58, .6], [Math.sin(t), .62, Math.cos(t) * .9], .01).p; }), .025, gold, 30, 6));
    for (let i = 0; i < 5; i++) { const t = (i - 2) * .42, p = ellPoint([0, .12, -.06], [.64, .58, .6], [Math.sin(t), .72, Math.cos(t) * .9], .1).p; head.add(mesh(starGeo(), gold, p.toArray(), i === 2 ? .12 : .085)); head.add(bead(jewel, [p.x, p.y, p.z + .05], i === 2 ? .04 : .028)); }
  }
  // organza wings with a gold thread edge
  const wc = { gold: '#ffe08a', blue: '#a9d4ff', pink: '#ffc4d8', lilac: '#d4c4ff', green: '#b8f0c8' }[spec.wing] || (/^#/.test(spec.wing || '') ? spec.wing : '#ffe08a');
  const wmat = mc('organza' + wc, () => new THREE.MeshPhysicalMaterial({ color: wc, emissive: wc, emissiveIntensity: .25, transparent: true, opacity: .55, roughness: .2, iridescence: 1, iridescenceIOR: 1.5, sheen: 1, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide, depthWrite: false }));
  const wings = new THREE.Group(); wings.name = 'wings'; wings.userData.live = true; wings.position.set(0, 1.2, -.28); body.add(wings);
  const shapes = [[[0, 0], [.3, .9], [1.4, 1.5], [1.7, 1.0], [1.9, .6], [1.2, .1]], [[0, 0], [.5, -.1], [1.2, -.5], [1.0, -.95], [.7, -1.2], [.2, -.6]]];
  for (const sx of [-1, 1]) {
    const side = new THREE.Group(); side.name = sx < 0 ? 'wingL' : 'wingR'; side.userData.live = true; side.scale.x = sx; side.rotation.y = sx * .5; wings.add(side);
    shapes.forEach((sh, k) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(sh[1][0], sh[1][1], sh[2][0], sh[2][1], sh[3][0], sh[3][1]); s.bezierCurveTo(sh[4][0], sh[4][1], sh[5][0], sh[5][1], 0, 0);
      const g = new THREE.ShapeGeometry(s, 20), sc = k ? .66 : .78;
      const w = new THREE.Mesh(g, wmat); w.scale.setScalar(sc); w.renderOrder = 3; side.add(w);
      const pts = s.getSpacedPoints(48).map(p => V3(p.x * sc, p.y * sc, .005));
      side.add(tube(pts, .012, metal('#e9c46a', { rough: .3 }), 96, 5));
      side.add(runningStitch(pts.map(p => p.clone().multiplyScalar(.82).setZ(.006)), { len: .04, gap: .03, r: .006, color: '#fff3cf' }));
    });
  }
  const r = rig(root, body, head, armL, armR, 'queen');
  Object.assign(r.userData, { kind: 'fairy', wings: r.getObjectByName('wings'), wand: r.getObjectByName('wand') });
  return r;
}

/* ---------- cheap copies of a built character (shared geometry, own moving parts) ---------- */
export function instance(tpl) {
  const c = tpl.clone(true);
  const u = c.userData = { ...tpl.userData, t0: Math.random() * 10 };
  for (const k of Object.keys(u)) if (u[k] && u[k].isObject3D) u[k] = c.getObjectByName(u[k].name);
  return c;
}

/* =====================================================================================
   MORE GOODS: berry tart, biscuit, candle, seed packet, teacup (all about half a unit, base at y=0)
   ===================================================================================== */
export function berryTart(o = {}) {
  const g = new THREE.Group();
  let cg = latheGeo([[0, 0], [.27, 0], [.33, .03], [.36, .12], [.355, .17], [.33, .18], [.3, .15], [0, .13]], 96);
  const p = cg.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const rr = Math.hypot(v.x, v.z); if (rr > .25) { const a = Math.atan2(v.x, v.z), f = 1 + Math.cos(a * 18) * .03 * Math.min(1, (rr - .25) / .08); p.setXYZ(i, v.x * f, v.y, v.z * f); } }
  cg.computeVertexNormals();
  paintVerts(cg, (q, c) => c.set('#e8b878').lerp(new THREE.Color('#b9773a'), Math.max(0, q.y - .1) * 6 * Math.min(1, Math.hypot(q.x, q.z) * 3)));
  g.add(mesh(cg, crust('#ffffff', { vc: true, glaze: .45 })));
  g.add(mesh(lumpy(new THREE.CylinderGeometry(.3, .3, .04, 40, 1), .01, 6, 2), glossy('#7a2a5a', { rough: .18 }), [0, .145, 0]));
  const r = rng(o.seed || 3), blue = glossy('#3f3a7a', { rough: .25 }), rasp = crust('#d43d5f', { glaze: .6, bump: .006, scale: 9 });
  for (let i = 0; i < 13; i++) { const a = i * 2.4 + r() * .3, rr = i ? .08 + Math.sqrt(i / 13) * .19 : 0; g.add(bead(i % 3 ? blue : rasp, [Math.cos(a) * rr, .19 + r() * .015, Math.sin(a) * rr], i % 3 ? .055 : [.06, .06, .06])); }
  for (let i = 0; i < 18; i++) { const a = r() * TAU, rr = r() * .28; g.add(bead(felt('#ffffff', { fibre: .05 }), [Math.cos(a) * rr, .235, Math.sin(a) * rr], .008)); }
  g.add(feltLeafPair(.06, .24, .05));
  return freeze(g);
}
function feltLeafPair(x, y, z) { const l = new THREE.Group(); for (const s of [-1, 1]) l.add(ball(felt(PAL.leaf), [x + s * .05, y, z], [.06, .015, .03], [0, s * .6, 0], 12)); return l; }
export function biscuit(o = {}) {
  const g = new THREE.Group();
  const bg = paintVerts(lumpy(new THREE.CylinderGeometry(.26, .26, .08, 48, 2), .015, 7, o.seed || 2), (q, c) => c.set('#e2b06e').lerp(new THREE.Color('#b9773a'), Math.max(0, Math.hypot(q.x, q.z) - .2) * 10));
  g.add(mesh(bg, crust('#ffffff', { vc: true, glaze: .2 }), [0, .05, 0]));
  const r = rng(o.seed || 5), ch = glossy('#5a3420', { rough: .4 });
  for (let i = 0; i < 9; i++) { const a = i * 2.2 + r(), rr = .05 + r() * .17; g.add(mesh(lumpy(SPH(10), .2, 6, i), ch, [Math.cos(a) * rr, .095, Math.sin(a) * rr], [.035, .02, .035])); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(bead(crust('#c98a4a', { glaze: .2 }), [Math.cos(a) * .2, .092, Math.sin(a) * .2], [.012, .006, .012])); }
  return freeze(g);
}
export function candle(o = {}) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.2, 0], [.22, .02], [.21, .04], [.0, .04]], glaze('#b9a6e8'), 40));
  g.add(mesh(geo('chandle', () => new THREE.TorusGeometry(.06, .018, 8, 20)), glaze('#b9a6e8'), [.24, .03, 0], 1, [Math.PI / 2, 0, 0]));
  const wax = glossy('#fff3d6', { rough: .45, sheen: .4 });
  g.add(lathe([[0, .04], [.095, .04], [.1, .38], [.085, .41], [.04, .4], [0, .405]], wax, 40, { smooth: 20 }));
  for (const [a, l] of [[.4, .12], [2.1, .08], [3.9, .15], [5.2, .07]]) g.add(capsule(wax, [Math.sin(a) * .1, .4, Math.cos(a) * .1], [Math.sin(a) * .102, .4 - l, Math.cos(a) * .102], .018, 8));
  g.add(capsule(basic('#2b2018'), [0, .4, 0], [0, .46, 0], .008, 6));
  g.add(lathe([[0, .44], [.035, .47], [.04, .51], [.02, .57], [0, .6]], glowMat('#ffb340', 1.6, { color: '#fff1b8' }), 16, { smooth: 10 }));
  const s = glowSprite('#ffc860', .55, .55); s.position.y = .52; g.add(s);
  return freeze(g);
}
function seedLabel() {
  return cached('seedlabel', () => {
    const [c, x] = canvas(256, 320), r = rng(4);
    x.fillStyle = '#efe2c8'; x.fillRect(0, 0, 256, 320);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,90,60,${r() * .07})`; x.fillRect(r() * 256, r() * 320, 1 + r() * 6, 1); }
    x.fillStyle = '#8fc98a'; x.fillRect(16, 16, 224, 196); x.fillStyle = '#bfe3ff'; x.fillRect(16, 16, 224, 110);
    x.strokeStyle = '#5f9a62'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 200); x.quadraticCurveTo(120, 140, 128, 104); x.stroke();
    x.fillStyle = '#7cc06e'; x.beginPath(); x.ellipse(104, 160, 26, 10, -.5, 0, TAU); x.fill(); x.beginPath(); x.ellipse(152, 150, 26, 10, .5, 0, TAU); x.fill();
    x.fillStyle = '#f6a6bd'; for (let p = 0; p < 6; p++) { const a = p / 6 * TAU; x.beginPath(); x.ellipse(128 + Math.cos(a) * 26, 84 + Math.sin(a) * 26, 22, 14, a, 0, TAU); x.fill(); }
    x.fillStyle = '#ffd86b'; x.beginPath(); x.arc(128, 84, 16, 0, TAU); x.fill();
    x.fillStyle = '#7a3d2a'; x.font = 'bold 54px "Chalkboard SE","Comic Sans MS","Comic Neue",Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Seeds', 128, 262);
    x.strokeStyle = '#c98a5a'; x.setLineDash([10, 8]); x.lineWidth = 4; x.strokeRect(8, 8, 240, 304);
    return toTex(c, { srgb: true, repeat: false });
  });
}
export function seedPacket() {
  const g = new THREE.Group(), pm = paper('#efe2c8');
  g.add(rbox(.36, .46, .04, .012, pm).translateY(.25));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(.34, .425), new THREE.MeshStandardMaterial({ map: seedLabel(), roughness: .9 })); f.position.set(0, .245, .022); g.add(f);
  g.add(rbox(.37, .07, .05, .012, paper('#e2d2b2')).translateY(.49).rotateX(.25));
  g.add(runningStitch([[-.16, .455, .028], [.16, .455, .028]], { len: .025, gap: .018, r: .004, color: '#a8865e' }));
  const r = rng(2); for (let i = 0; i < 4; i++) g.add(bead(crust('#7a5236', { glaze: .3 }), [-.1 + i * .07 + r() * .02, .02, .1 + r() * .05], [.02, .012, .014]));
  g.rotation.x = -.15;
  const w = new THREE.Group(); w.add(g); return freeze(w);
}
export function teacup() {
  const g = new THREE.Group(), china = glaze('#ffffff', { rough: .18, speckle: .05 }), rose = glaze('#f2a7b5', { rough: .2 }), gold = metal('#e9c46a', { rough: .25 });
  g.add(lathe([[0, 0], [.32, 0], [.36, .025], [.34, .04], [.12, .05], [0, .045]], china, 48));
  g.add(mesh(geo('saucerrim', () => new THREE.TorusGeometry(.35, .008, 6, 48)), gold, [0, .032, 0], 1, [Math.PI / 2, 0, 0]));
  g.add(lathe([[0, .05], [.12, .05], [.14, .07], [.22, .14], [.27, .3], [.28, .36], [.265, .36], [.25, .3], [.2, .16], [0, .1]], china, 48, { smooth: 30 }));
  g.add(mesh(geo('teacuprim', () => new THREE.TorusGeometry(.275, .008, 6, 48)), gold, [0, .36, 0], 1, [Math.PI / 2, 0, 0]));
  g.add(mesh(geo('cupband', () => new THREE.CylinderGeometry(.262, .245, .05, 48, 1, true)), rose, [0, .26, 0]));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(bead(rose, [Math.sin(a) * .225, .17, Math.cos(a) * .225], [.022, .022, .01])); }
  g.add(mesh(geo('cuphandle', () => new THREE.TorusGeometry(.08, .022, 10, 24, Math.PI * 1.3)), rose, [.29, .22, 0], 1, [0, 0, -Math.PI * .65]));
  g.add(mesh(new THREE.CircleGeometry(.25, 32).rotateX(-Math.PI / 2), glossy('#a8642e', { rough: .1 }), [0, .32, 0]));
  return freeze(g);
}

/* =====================================================================================
   DECORATIONS from the savings jar
   ===================================================================================== */
// striped scalloped awning, centred, about 2 wide, hanging toward +z
export function awning(o = {}) {
  const g = new THREE.Group(), c = o.color || '#e2566b', w = o.w ?? 2.1;
  const stripe = felt('#fff7e6', { side: THREE.DoubleSide, print: { kind: 'stripes', color: c, n: 8, w: .5, scale: 1.6 } });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, w, 48, 1, true, 0, Math.PI * .5), stripe);
  roof.rotation.z = Math.PI / 2; roof.position.set(0, -.95, 0); g.add(roof);
  const n = 9;
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + .5) / n * w; g.add(mesh(geo('valance', () => new THREE.CircleGeometry(.165, 16, Math.PI, Math.PI)), felt(i % 2 ? '#fff7e6' : c, { side: THREE.DoubleSide }), [x, -.95, .955], [w / n / .33, .9, 1])); g.add(bead(felt('#ffd86b'), [x, -1.13, .96], .04)); }
  g.add(runningStitch([[-w / 2, -.97, .965], [w / 2, -.97, .965]], { len: .05, gap: .035, r: .007, color: '#ffffff' }));
  const iron = metal('#4a4048', { rough: .5, env: .8 });
  for (const sx of [-1, 1]) g.add(tube([[sx * (w / 2 - .1), .02, 0], [sx * (w / 2 - .1), -.5, .55], [sx * (w / 2 - .1), -.95, .9]], .02, iron, 12, 5));
  return freeze(g);
}
// a cord of felt flags following `points`
export function buntingCord(points, o = {}) {
  const g = new THREE.Group(), cols = o.colors || ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#b9a6e8'];
  const c = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V3(...p)));
  g.add(tube(c, .015, thread('#fff6e6'), 80, 5));
  const tri = geo('flagtri', () => { const s = new THREE.Shape(); s.moveTo(-.2, 0); s.lineTo(.2, 0); s.lineTo(0, -.42); s.lineTo(-.2, 0); return new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1 }); });
  const n = o.n || 16;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, p = c.getPointAt(t), tg = c.getTangentAt(t);
    const f = new THREE.Group(); f.position.copy(p); f.rotation.y = Math.atan2(-tg.z, tg.x); g.add(f);
    f.add(mesh(tri, felt(cols[i % cols.length])));
    f.add(runningStitch([[-.14, -.04, .03], [0, -.32, .03], [.14, -.04, .03]], { len: .025, gap: .018, r: .005, color: '#fff6e6' }));
  }
  return freeze(g);
}
// a brass shop bell on a bracket: the bracket's back sits on a wall in the x-y plane, the bell hangs toward +z
export function doorBell() {
  const g = new THREE.Group(), brass = metal(PAL.gold, { rough: .22 });
  g.add(rbox(.4, .5, .1, .03, wood('#8a5a36', { axis: 1 })).translateY(.85));
  g.add(capsule(metal('#4a4048', { rough: .5 }), [0, 1.0, .03], [0, 1.0, .45], .025, 8));
  g.add(yarn([[0, 1.0, .42], [0, .7, .42]], .01, thread('#e2566b'), { seg: 12 }));
  g.add(lathe([[0, .72], [.08, .7], [.13, .6], [.16, .48], [.22, .4], [.2, .38], [0, .42]], brass, 40, { smooth: 20 }).translateZ(.42));
  g.add(bead(brass, [0, .36, .42], .05));
  const b = feltBow('#e2566b', 1.2); b.position.set(0, .76, .47); g.add(b);
  return freeze(g);
}
export function lanternPost() {
  const g = new THREE.Group(), iron = metal('#4a4048', { rough: .5, env: .8 });
  g.add(lathe([[0, 0], [.14, 0], [.12, .1], [.07, .2], [.06, 2.0], [0, 2.05]], wood('#6b4a33', { axis: 1 }), 16));
  g.add(tube([[0, 1.95, 0], [.15, 2.1, 0], [.35, 2.08, 0]], .022, iron, 10, 5));
  const l = lantern(); l.position.set(.35, 1.82, 0); g.add(l);
  return g;
}
export function catBed() {
  const g = new THREE.Group();
  g.add(lathe(smoothProfile([[0, .02], [.85, .02], [.98, .12], [1.0, .3], [.9, .4], [.78, .3], [.72, .14], [0, .12]], 30), felt('#b9a6e8'), 64));
  g.add(tube(ringPoints(.9, .38, 60), .09, knit('#d4c4ff'), 90, 10, true));
  g.add(blanketStitch(ringPoints(.99, .26, 70), p => V3(0, -.07, 0), { closed: true, spacing: .08, r: .008, color: '#fff6e6' }));
  g.add(mesh(lumpy(new THREE.CylinderGeometry(.74, .74, .1, 40), .03, 3, 2), felt('#fffaf2', { print: { kind: 'gingham', color: '#f6a6bd', n: 6, scale: 3 } }), [0, .17, 0]));
  // a sleeping ginger cat curled up
  const ginger = felt('#f0b46a'), cream = felt('#fff1dc'), dark = '#c9823a';
  const cat = new THREE.Group(); cat.position.y = .2; g.add(cat);
  cat.add(mesh(lumpy(SPH(32), .04, 3, 5), ginger, [0, .28, 0], [.52, .3, .42]));
  for (let i = 0; i < 4; i++) cat.add(runningStitch(ellArc([0, .28, 0], [.52, .3, .42], [-.6 + i * .3, 1, -.2], [-.6 + i * .3, .3, -1], 10, .006), { len: .03, gap: .02, r: .007, color: dark }));
  const H = [.38, .4, .15], HR = [.27, .23, .24];
  cat.add(ball(ginger, H, HR, [0, 0, 0], 32));
  cat.add(ball(cream, [.4, .34, .33], [.13, .09, .08], [0, 0, 0], 20));
  cat.add(ball(felt('#e88aa0'), [.4, .37, .4], [.03, .022, .02], [0, 0, 0], 12));
  for (const sx of [-1, 1]) {
    cat.add(tube(ellArc(H, HR, [sx * .32 + .05, .2, .85], [sx * .55 + .05, .15, .75], 8, .004), .009, thread('#5a3a24'), 10, 5));
    cat.add(mesh(geo('catear', () => new THREE.ConeGeometry(1, 1, 32)), ginger, [.38 + sx * .15, .62, .12], [.1, .17, .05], [0, 0, sx * -.4]));
  }
  cat.add(taperTube([[-.45, .2, -.1], [-.4, .15, .3], [-.05, .12, .5], [.25, .13, .48]], .08, .06, ginger, 24, 10));
  for (const t of [.25, .5, .75]) { const c = new THREE.CatmullRomCurve3([V3(-.45, .2, -.1), V3(-.4, .15, .3), V3(-.05, .12, .5), V3(.25, .13, .48)]), p = c.getPointAt(t), tg = c.getTangentAt(t); const ring = new THREE.Mesh(geo('tailband', () => new THREE.TorusGeometry(.075, .012, 6, 20)), felt(dark)); ring.position.copy(p); ring.quaternion.setFromUnitVectors(V3(0, 0, 1), tg); cat.add(ring); }
  for (const sx of [-1, 1]) cat.add(ball(cream, [.2 + sx * .08, .1, .38], [.08, .06, .1], [0, 0, 0], 16));
  return freeze(g);
}
export function flowerVase() {
  const v = new THREE.Group(); v.add(lathe([[0, 0], [.22, 0], [.3, .2], [.18, .5], [.22, .62], [0, .6]], glaze('#7bb4d9'), 32, { smooth: 20 }));
  ['#f6a6bd', '#ffd86b', '#ffffff'].forEach((c, i) => { const f = feltFlower(c, 1.2, { stem: true }); f.position.set(-.12 + i * .12, 1.1, 0); f.rotation.z = (i - 1) * .3; v.add(f); });
  return freeze(v);
}
// soft glow points (one draw call for many lights)
export function glowPoints(pts, cols, size = .9, opacity = .7) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3), c = new THREE.Color();
  pts.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); c.set(cols[i % cols.length]); col.set([c.r, c.g, c.b], i * 3); });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
  const p = new THREE.Points(g, m); p.renderOrder = 10; p.userData.glowBase = opacity; p.userData.glowSprite = true; return p;
}
// a chalk board on an easel with lines of text: rows [[label, value, colour]]
export function chalkTexture(title, rows) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const x = c.getContext('2d'), r = rng(3);
  x.fillStyle = '#2f3b33'; x.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(255,255,255,${r() * .035})`; x.fillRect(r() * 512, r() * 384, 2 + r() * 10, 1.5); }
  x.fillStyle = '#fbf6e8'; x.textBaseline = 'middle'; x.textAlign = 'center';
  const font = '"Chalkboard SE","Comic Neue","Comic Sans MS",sans-serif';
  x.font = `bold 52px ${font}`; x.fillText(title, 256, 56);
  const lh = Math.min(70, 280 / Math.max(1, rows.length));
  x.font = `bold ${Math.round(lh * .72)}px ${font}`;
  rows.forEach(([l, v, col], i) => { const y = 120 + lh * (i + .5); x.textAlign = 'left'; x.fillStyle = '#fbf6e8'; x.fillText(l, 40, y); x.textAlign = 'right'; x.fillStyle = col || '#ffd86b'; x.fillText(v, 472, y); });
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 4; x.setLineDash([14, 10]); x.strokeRect(18, 18, 476, 348);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function chalkBoard(mat) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.92, .69), mat); face.position.z = .031; face.userData.noMerge = true; g.add(face);
  g.add(rbox(1.08, .85, .06, .02, wood('#9a6a42', { axis: 0 })));
  const lw = wood('#7a5234', { axis: 1 });
  g.add(capsule(lw, [-.4, -.4, -.02], [-.48, -.62, -.25], .025, 6)); g.add(capsule(lw, [.4, -.4, -.02], [.48, -.62, -.25], .025, 6));
  return freeze(g);
}
export function butterfly(col = '#f6a6bd', col2 = '#ffd86b') {
  const g = new THREE.Group();
  const m1 = felt(col, { side: THREE.DoubleSide, print: { kind: 'dots', color: '#ffffff', n: 5, r: .2, scale: 9 } }), m2 = felt(col2, { side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const side = new THREE.Group(); side.name = sx < 0 ? 'bwL' : 'bwR'; side.userData.live = true; g.add(side);
    side.add(mesh(geo('bwing', () => new THREE.CircleGeometry(1, 24)), m1, [sx * .17, .08, 0], [.17, .14, 1], [0, 0, sx * .3]));
    side.add(mesh(geo('bwing', () => new THREE.CircleGeometry(1, 24)), m2, [sx * .12, -.1, 0], [.1, .09, 1], [0, 0, sx * -.3]));
  }
  g.add(capsule(felt('#5a4038', { fibre: .4 }), [0, -.17, 0], [0, .17, 0], .035, 10));
  for (const sx of [-1, 1]) { g.add(yarn([[0, .16, .01], [sx * .06, .3, .03], [sx * .1, .36, .02]], .006, thread('#5a4038'))); g.add(bead(felt('#5a4038'), [sx * .1, .36, .02], .02)); }
  freeze(g); g.userData.wl = g.getObjectByName('bwL'); g.userData.wr = g.getObjectByName('bwR'); g.userData.noCast = true;
  return g;
}
export function treeStump() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.55, 0], [.48, .1], [.42, .5], [0, .5]], wood('#6b4a33', { axis: 1, freq: 6, grain: .7 }), 24, { smooth: 10 }));
  const top = new THREE.Mesh(new THREE.CircleGeometry(.42, 32).rotateX(-Math.PI / 2), wood('#d9b48a', { axis: 1, freq: 9, grain: .8 })); top.position.y = .5; g.add(top);
  return freeze(g);
}
