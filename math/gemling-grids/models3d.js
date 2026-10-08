// Gemling Grids: 3D models built from the shared felt-toy kit.
// Gemlings are faceted, glassy crystal creatures; Nib is a felt mole; plus gems, doors, the geode,
// crystal clusters, map caves and Nib's furniture.
//
// Conventions
//  - gemling(v, …): unit box matching gemSVG's 100x100 drawing (SVG x=50 -> x=0, SVG y=100 -> y=0, 100 SVG units = 1).
//    Bake it with GEM_VIEW so the belly lands under the crisp SVG dots/numbers drawn on top (see world3d.js).
//  - nib(…), gemStone(t), nookItem(id): the same 100x100 unit box, resting on y=0.
//  - door(type, n): x in [-1, 1] (200 wide drawing), y from 0 up to the drawing's height / 100.
//  - everything static is frozen (merged per material); live parts are marked userData.live.
import { THREE, mat, lighten, geo, SPH, mesh, ball, bead, capsule, lathe as klathe, tube, roundRectShape, starGeo, heartShape, glow, accessory, freeze } from '../../shared/toy3d.js';

export { THREE };
/* ---------------- helpers ---------------- */
// lathe profiles must run bottom-centre -> out -> up -> top-centre or the surface comes out inside-out
export function lathe(pts, m, seg) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return klathe(a < 0 ? pts.slice().reverse() : pts, m, seg);
}
export function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const UP = new THREE.Vector3(0, 1, 0);
const ICO = d => geo('gg-ico' + d, () => new THREE.IcosahedronGeometry(1, d));
export const gball = (m, p, s, r) => mesh(ICO(1), m, p, s, r);           // faceted ball
const F = c => mat(c, { felt: true });
const GLS = c => mat(c, { gloss: true });
const MT = (c, s = .2) => mat(c, { metal: true, shine: s });
const GW = (c, k = 1) => mat(c, { glow: k });
const INK = '#2a2140';
function pointAlong(o, dir) { o.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize()); return o; }
// SVG path commands -> THREE.Shape in unit coords (x: (sx-ox)/100*mirror, y: (oy-sy)/100)
export function svgShape(cmds, { ox = 50, oy = 100, mirror = 1, k = 100 } = {}) {
  const s = new THREE.Shape(); const X = x => (x - ox) / k * mirror, Y = y => (oy - y) / k;
  for (const c of cmds) {
    const [op, ...a] = c;
    if (op === 'M') s.moveTo(X(a[0]), Y(a[1]));
    else if (op === 'L') s.lineTo(X(a[0]), Y(a[1]));
    else if (op === 'Q') s.quadraticCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]));
    else if (op === 'C') s.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5]));
  }
  return s;
}
export function extrude(shape, depth, m, bevel = .01, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}

/* ---------------- a soft cave "environment" so crystals have something to reflect ---------------- */
let _env;
export function envTex() {
  if (_env) return _env;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#fff4ff'); g.addColorStop(.22, '#d6c4ff'); g.addColorStop(.48, '#7563b4'); g.addColorStop(.66, '#33295c'); g.addColorStop(1, '#151027');
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const blob = (cx, cy, r, col) => { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  blob(70, 20, 30, 'rgba(255,255,255,1)'); blob(196, 28, 22, 'rgba(255,240,214,.85)'); blob(28, 60, 20, 'rgba(255,150,205,.85)');
  blob(136, 62, 24, 'rgba(130,225,255,.8)'); blob(232, 58, 16, 'rgba(255,222,120,.75)'); blob(100, 74, 14, 'rgba(160,255,200,.6)');
  _env = new THREE.CanvasTexture(c); _env.mapping = THREE.EquirectangularReflectionMapping; _env.colorSpace = THREE.SRGBColorSpace;
  return _env;
}
/* faceted, glassy crystal material */
const crysCache = new Map();
export function crys(color, { glow: gl = .22, opacity = 1, irid = .4, rough = .14, env = .6 } = {}) {
  const k = [color, gl, opacity, irid, rough, env].join('|');
  if (!crysCache.has(k)) {
    crysCache.set(k, new THREE.MeshPhysicalMaterial({
      color, flatShading: true, roughness: rough, metalness: .04, clearcoat: 1, clearcoatRoughness: .06,
      envMap: envTex(), envMapIntensity: env, emissive: color, emissiveIntensity: gl,
      iridescence: irid, iridescenceIOR: 1.45, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide
    }));
  }
  return crysCache.get(k);
}
function smoothGem(color, o = {}) {
  const k = 'sm' + color + JSON.stringify(o);
  if (!crysCache.has(k)) crysCache.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: o.rough ?? .16, clearcoat: 1, clearcoatRoughness: .05, envMap: envTex(), envMapIntensity: o.env ?? 1.2, emissive: o.em || color, emissiveIntensity: o.gl ?? .12, iridescence: o.irid ?? .3, iridescenceIOR: 1.4, iridescenceThicknessRange: o.thick || [100, 400], sheen: o.sheen ? 1 : 0, sheenColor: new THREE.Color(o.sheen || '#ffffff'), sheenRoughness: .35 }));
  return crysCache.get(k);
}

/* ---------------- crystal shards and clusters ---------------- */
export function shard(m, { r = .1, h = .5, tip = .16, seg = 6, taper = .9 } = {}) {
  return lathe([[0, 0], [r, 0], [r * taper, h], [0, h + tip]], m, seg);
}
export function cluster(color, { n = 6, seed = 1, glow: gl = .45, base = '#4a4268', main = 1, spread = .14 } = {}) {
  const g = new THREE.Group(), m = crys(color, { glow: gl }), m2 = crys(lighten(color, .08), { glow: gl * .9 }), rnd = rng(seed);
  g.add(shard(m, { r: .15 * main, h: .62 * main, tip: .24 * main }));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd() * .6, t = .35 + rnd() * .45;
    const s = shard(i % 2 ? m2 : m, { r: .06 + rnd() * .05, h: .18 + rnd() * .32, tip: .08 + rnd() * .08 });
    s.position.set(Math.cos(a) * spread, 0, Math.sin(a) * spread);
    pointAlong(s, [Math.cos(a) * Math.sin(t), Math.cos(t), Math.sin(a) * Math.sin(t)]); g.add(s);
  }
  if (base) g.add(gball(mat(base, { felt: true, flat: true }), [0, 0, 0], [.3, .1, .3]));
  return freeze(g);
}

/* ---------------- faces ---------------- */
const cheekM = new THREE.MeshBasicMaterial({ color: '#ff8fbc', transparent: true, opacity: .5, depthWrite: false });
function eye(g, x, y, z, r, sleep) {
  if (sleep) { g.add(mesh(geo('gg-lid', () => new THREE.TorusGeometry(1, .2, 6, 16, Math.PI)), GLS(INK), [x, y - r * .2, z], r * 1.05, [0, 0, Math.PI])); return; }
  g.add(ball(GLS(INK), [x, y, z], [r, r * 1.2, r * .55]));
  g.add(bead(GW('#ffffff', .9), [x + r * .35, y + r * .42, z + r * .42], r * .36));
  g.add(bead(GW('#ffffff', .9), [x - r * .3, y - r * .45, z + r * .42], r * .16));
}
function cheek(g, x, y, z, r) {
  const c = mesh(geo('gg-cheek', () => new THREE.CircleGeometry(1, 18)), cheekM, [x, y, z], [r * 1.3, r * .8, 1], [0, Math.sign(x) * .45, 0]); g.add(c);
}
function smileArc(g, x, y, z, w, m = GLS(INK), t = .16) {
  g.add(mesh(geo('gg-smile' + t, () => new THREE.TorusGeometry(1, t, 6, 18, Math.PI * .9)), m, [x, y, z], w, [0, 0, Math.PI + Math.PI * .05]));
}

/* ---------------- Gemlings ---------------- */
// Bake framing: frontal, fixed frame for the -4 -4 108 108 viewBox. D is the camera distance that framing gives,
// used to place the belly so that, seen through the perspective camera, it sits exactly under the SVG tummy.
export const GEM_VIEW = { frame: [0, .5, 1.08 / (1 + Math.tan(THREE.MathUtils.degToRad(12)))], yaw: 0, pitch: 0 };
const D_G = GEM_VIEW.frame[2] / 2 / Math.tan(THREE.MathUtils.degToRad(12)) + GEM_VIEW.frame[2] / 2;
const atY = (Yt, z) => .5 + (Yt - .5) * (D_G - z) / D_G;   // model y that shows at unit y Yt for a point at depth z
const atX = (Xt, z) => Xt * (D_G - z) / D_G;
export const TUMMY = { 1: [50, 76], 2: [50, 74], 3: [50, 76], 4: [50, 72], 5: [50, 77] };
const PAT = { 1: [[24, 60], [76, 60], [70, 84]], 2: [[18, 40], [82, 40], [22, 78], [78, 78]], 3: [[30, 70], [70, 70], [50, 34]], 4: [[16, 62], [84, 62], [30, 84], [70, 84]], 5: [[24, 62], [76, 62], [72, 86]] };
const ACC_AT = { 1: [0, .69], 2: [0, .7], 3: [0, .86], 4: [0, .61], 5: [0, .69] };
const ell = (cx, cy, rx, ry, rz) => (x, y) => rz * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2));
const TOP_PROF = [[0, .07], [.3, .07], [.38, .1], [.4, .16], [.29, .4], [.14, .7], [.04, .84], [0, .86]];
function topR(y) { for (let i = 1; i < TOP_PROF.length; i++) { const [r0, y0] = TOP_PROF[i - 1], [r1, y1] = TOP_PROF[i]; if (y <= y1) return r0 + (r1 - r0) * (y - y0) / Math.max(1e-6, y1 - y0); } return 0; }
const SURF = {
  1: ell(0, .37, .32, .31, .27), 2: ell(0, .38, .2, .3, .19),
  3: (x, y) => { const r = topR(y); return .72 * Math.sqrt(Math.max(0, r * r - x * x)); },
  4: ell(0, .34, .43, .28, .32), 5: ell(0, .37, .32, .31, .27)
};
// pal: {color, dark, light} (same shape as the game's KINDS / hslPal)
export function gemling(v, { pal, sleep = false, belly = true, pattern = null, acc = null } = {}) {
  const g = new THREE.Group();
  const c = pal.color, d = pal.dark, l = pal.light;
  const B = crys(c, { glow: .16 }), Dk = crys(d, { glow: .1, irid: .3 }), Lt = crys(l, { glow: .3, irid: .2, env: .45 });
  const S = SURF[v];
  let eyeY = .46, eyeX = .11, er = .05, mouthY = .375, mouth = 'smile';
  if (v === 1) { // Rubbit: crystal bunny
    g.add(gball(B, [0, .37, 0], [.32, .31, .27]));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * .14, .73, -.03); ear.rotation.z = -sx * .21;
      ear.add(gball(B, [0, 0, 0], [.085, .22, .065])); ear.add(gball(Lt, [0, -.01, .04], [.042, .15, .03])); g.add(ear);
      g.add(gball(Dk, [sx * .14, .075, .12], [.08, .05, .08]));
    }
  } else if (v === 2) { // Sapphly: crystal butterfly
    g.add(gball(B, [0, .38, 0], [.2, .3, .19]));
    const wm = crys(c, { glow: .32, opacity: .86, irid: .9 });
    for (const sx of [-1, 1]) {
      const up = svgShape([['M', 46, 50], ['C', 26, 14, 2, 22, 6, 46], ['C', 9, 62, 28, 64, 46, 58]], { mirror: sx });
      const lo = svgShape([['M', 46, 64], ['C', 26, 66, 10, 82, 22, 92], ['C', 34, 98, 46, 84, 47, 72]], { mirror: sx });
      for (const sh of [up, lo]) {
        const w = new THREE.Group(); w.position.set(0, 0, -.07); w.rotation.y = -sx * .32;
        w.add(extrude(sh, .02, wm, .008, 12)); g.add(w);
      }
      g.add(gball(Lt, [sx * -.26, .52, -.13], [.05, .05, .02], [0, -sx * .32, 0]));
      g.add(tube([[sx * .06, .66, .02], [sx * .12, .8, .02], [sx * .22, .86, .0]], .013, Dk, 8, 5));
      g.add(gball(B, [sx * .22, .86, 0], .042));
    }
    eyeY = .52; eyeX = .07; er = .042; mouthY = .44;
  } else if (v === 3) { // Topip: crystal chick
    const b = lathe(TOP_PROF, B, 8); b.rotation.y = Math.PI / 8; b.scale.z = .75; g.add(b);
    const om = GLS('#ff9f43');
    [[-.05, .86, .04, -.4], [0, .9, .07, 0], [.05, .86, .05, .4]].forEach(([x, y, h, rz]) => { const s = shard(Dk, { r: .03, h, tip: .04, seg: 5 }); s.position.set(x, y - .04, 0); s.rotation.z = rz; g.add(s); });
    const beak = mesh(geo('gg-beak', () => new THREE.ConeGeometry(.05, .09, 4)), om, [0, .445, S(0, .445) + .03], 1, [Math.PI / 2, Math.PI / 4, 0]); g.add(beak);
    for (const sx of [-1, 1]) { g.add(ball(om, [sx * .17, .04, .12], [.07, .03, .06])); for (const k of [-1, 0, 1]) g.add(bead(om, [sx * .17 + k * .035, .025, .17], [.016, .014, .03])); }
    eyeY = .54; eyeX = .08; er = .044; mouth = 'none';
  } else if (v === 4) { // Mossling: crystal frog
    g.add(gball(B, [0, .34, 0], [.43, .28, .32]));
    for (const sx of [-1, 1]) { g.add(gball(B, [sx * .21, .63, .02], .15)); g.add(gball(Dk, [sx * .32, .08, .12], [.1, .04, .07])); }
    eyeY = .64; eyeX = .21; mouthY = .445; mouth = 'wide';
  } else { // Amethyx: crystal kitten
    g.add(gball(B, [0, .37, 0], [.32, .31, .27]));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * .2, .66, -.02); ear.rotation.z = -sx * .32;
      ear.add(mesh(geo('gg-ear', () => new THREE.ConeGeometry(.13, .3, 4)), B, [0, .1, 0], 1, [0, Math.PI / 4, 0]));
      ear.add(mesh(geo('gg-ear2', () => new THREE.ConeGeometry(.07, .18, 4)), Lt, [0, .07, .05], 1, [0, Math.PI / 4, 0])); g.add(ear);
      g.add(gball(Dk, [sx * .14, .075, .12], [.08, .05, .08]));
      for (const k of [-1, 1]) g.add(tube([[sx * .2, .37 + k * .02, .2], [sx * .3, .38 + k * .035, .17], [sx * .37, .385 + k * .05, .14]], .006, Dk, 6, 4));
    }
    g.add(tube([[.22, .14, -.12], [.4, .2, -.12], [.45, .4, -.1], [.38, .5, -.06]], .045, B, 16, 7));
    mouth = 'cat';
  }
  // face
  const ez = v === 4 ? .165 : S(eyeX, eyeY) - .005;
  for (const sx of [-1, 1]) eye(g, sx * eyeX, eyeY, ez, er, sleep);
  for (const sx of [-1, 1]) { const cx = sx * (eyeX + (v === 4 ? -.02 : .075)), cy = eyeY - (v === 4 ? .17 : .08); cheek(g, cx, cy, S(cx, cy) + .006, .045); }
  const mz = S(0, mouthY) + .004;
  if (mouth === 'smile') smileArc(g, 0, mouthY, mz, .035);
  else if (mouth === 'wide') smileArc(g, 0, mouthY + .02, mz, .1, GLS(INK), .1);
  else if (mouth === 'cat') { smileArc(g, -.02, mouthY, mz, .02); smileArc(g, .02, mouthY, mz, .02); }
  // tummy: a smooth light patch exactly under the SVG dots
  if (belly) {
    const [tx, ty] = TUMMY[v]; const Yt = (100 - ty) / 100;
    let y = Yt, z = 0; for (let i = 0; i < 4; i++) { z = S(0, y); y = atY(Yt, z); }
    const tilt = v === 3 ? -.32 : Math.atan2(S(0, y + .02) - S(0, y - .02), .04) * .9;
    g.add(mesh(SPH(20), Lt, [atX((tx - 50) / 100, z), y, z - .02], [.17 * (D_G - z) / D_G, .135 * (D_G - z) / D_G, .035], [tilt, 0, 0]));
  }
  // card patterns
  if (pattern && pattern !== 'none') {
    const pm = pattern === 'stripes' ? Dk : pattern === 'stars' || pattern === 'facets' ? GW('#ffffff', .6) : Lt;
    for (const [px, py] of PAT[v]) {
      const x = (px - 50) / 100, y = (100 - py) / 100, z = S(x, y);
      if (z <= .01) continue;
      if (pattern === 'spots') g.add(bead(pm, [x, y, z], [.045, .045, .015]));
      else if (pattern === 'stars') g.add(mesh(starGeo(), pm, [x, y, z], .045));
      else if (pattern === 'stripes') { smileArc(g, x, y + .03, z, .05, pm, .12); smileArc(g, x, y - .01, z, .05, pm, .12); }
      else if (pattern === 'facets') g.add(mesh(geo('gg-oct', () => new THREE.OctahedronGeometry(1, 0)), pm, [x, y, z], [.05, .06, .015]));
      else if (pattern === 'drops') g.add(lathe([[0, -.035], [.03, -.02], [.026, .015], [0, .055]], pm, 10).translateX(x).translateY(y).translateZ(z));
    }
  }
  if (acc && acc !== 'none') {
    const [ax, ay] = ACC_AT[v];
    let a;
    if (acc === 'glasses') {
      a = new THREE.Group(); const gm = MT('#c8963c');
      for (const sx of [-1, 1]) a.add(mesh(geo('gg-ring', () => new THREE.TorusGeometry(1, .12, 6, 22)), gm, [sx * eyeX, eyeY, ez + .03], .075));
      a.add(tube([[-eyeX + .075, eyeY, ez + .03], [0, eyeY + .02, ez + .04], [eyeX - .075, eyeY, ez + .03]], .008, gm, 6, 4));
      g.add(a);
    } else if (acc === 'scarf') {
      const y = eyeY - .18, rx = Math.max(.12, Math.sqrt(Math.max(0, 1 - ((y - .37) / .31) ** 2)) * (v === 4 ? .42 : v === 2 ? .2 : .3));
      const sm = F('#7fd8ff');
      g.add(mesh(geo('gg-scarf', () => new THREE.TorusGeometry(1, .14, 8, 28)), sm, [0, y, 0], [rx, rx * .9, rx], [Math.PI / 2, 0, 0]));
      g.add(capsule(sm, [rx * .5, y - .02, rx * .8], [rx * .62, y - .16, rx * .78], .03));
    } else {
      a = accessory(acc === 'mushroom' ? 'mushroom' : acc);
      const sc = { bow: .42, crown: .44, leaf: .55, flower: .5, mushroom: .5 }[acc] || .45;
      a.scale.setScalar(sc);
      if (acc === 'bow') a.position.set(ax + .14, ay - .08, .02);
      else if (acc === 'leaf') a.position.set(ax + .02, ay - .04, 0);
      else if (acc === 'flower') { a.position.set(ax - .16, ay - .06, .06); a.rotation.x = 1.1; }
      else a.position.set(ax, ay - .03, 0);
      g.add(a);
    }
  }
  return freeze(g);
}

/* ---------------- Nib the felt mole ---------------- */
export function nib({ hat = null, scarf = false, sleepy = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'nbody'; root.add(body);
  const fur = F('#7a6a8c'), fur2 = F('#a898bb'), pink = F('#ffb3c9'), gold = MT('#e8c26b', .3);
  body.add(ball(fur, [0, .35, 0], [.36, .33, .3]));
  body.add(ball(fur, [0, .2, -.01], [.34, .19, .28]));
  body.add(ball(fur2, [0, .2, .17], [.22, .15, .13]));
  for (const sx of [-1, 1]) { body.add(ball(fur, [sx * .29, .6, -.03], [.08, .08, .05])); body.add(ball(pink, [sx * .29, .6, -.0], [.045, .045, .03])); }
  body.add(ball(fur2, [0, .345, .24], [.14, .1, .1]));
  body.add(ball(fur2, [0, .355, .31], [.08, .065, .06]));
  body.add(ball(GLS('#ff8fb4'), [0, .37, .365], [.06, .045, .04]));
  body.add(bead(GW('#ffffff', .6), [-.018, .385, .4], .012));
  for (const [x, a] of [[-.05, .5], [0, 0], [.05, -.5]]) body.add(capsule(fur2, [x * .5, .64, .0], [x, .72, .02], .025));
  smileArc(body, 0, .26, .29, .04);
  for (const sx of [-1, 1]) cheek(body, sx * .22, .38, .24, .05);
  // eyes behind round spectacles (eyes are their own part so they can blink)
  const eyes = new THREE.Group(); eyes.userData.live = true; eyes.name = 'neyes'; eyes.position.set(0, .51, 0); body.add(eyes);
  for (const sx of [-1, 1]) eye(eyes, sx * .14, 0, .225, .045, sleepy);
  for (const sx of [-1, 1]) {
    body.add(mesh(geo('gg-spec', () => new THREE.TorusGeometry(1, .11, 8, 28)), gold, [sx * .14, .51, .245], .125));
    const lens = mesh(geo('gg-lens', () => new THREE.CircleGeometry(1, 24)), mat('#e8f4ff', { glass: .22 }), [sx * .14, .51, .25], .118); body.add(lens);
  }
  body.add(tube([[-.02, .515, .26], [0, .535, .27], [.02, .515, .26]], .012, gold, 6, 4));
  // paws
  const paws = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.userData.live = true; p.name = sx < 0 ? 'npawL' : 'npawR'; p.position.set(sx * .24, .1, .19);
    p.add(ball(pink, [0, 0, 0], [.1, .055, .075]));
    for (const k of [-1, 0, 1]) p.add(bead(F('#ffffff'), [k * .035, -.025, .07], [.012, .02, .012]));
    body.add(p); paws.push(p);
  }
  body.add(ball(pink, [0, .1, -.27], .04));
  if (scarf || hat === 'scarf') {
    const sm = F('#7fd8ff');
    body.add(mesh(geo('gg-nscarf', () => new THREE.TorusGeometry(1, .16, 8, 32)), sm, [0, .19, .0], [.33, .31, .3], [Math.PI / 2, 0, 0]));
    body.add(capsule(sm, [.17, .16, .26], [.21, .02, .26], .045));
    for (const x of [-.16, 0, .14]) body.add(bead(F('#ffffff'), [x, .19, .3 - Math.abs(x) * .35], .018));
  }
  if (hat === 'miner') {
    const y0 = .62, hm = GLS('#ffd23f');
    body.add(lathe([[0, 0], [.3, 0], [.29, .08], [.24, .17], [.13, .24], [0, .26]], hm, 28).translateY(y0));
    body.add(mesh(new THREE.CylinderGeometry(.35, .35, .035, 28), GLS('#f2b700'), [0, y0 + .015, .02]));
    body.add(mesh(new THREE.CylinderGeometry(.075, .085, .07, 18), MT('#c99a3a'), [0, y0 + .15, .27], 1, [Math.PI / 2 - .25, 0, 0]));
    body.add(mesh(new THREE.CircleGeometry(.062, 18), GW('#fff8d0', 1.8), [0, y0 + .158, .31], 1, [-.25, 0, 0]));
    const lg = glow('#fff2b0', .55, .75); lg.position.set(0, y0 + .16, .34); body.add(lg);
  } else if (hat === 'flower') {
    const ring = new THREE.Group(); ring.position.set(0, .66, 0); ring.rotation.x = -.35;
    ring.add(mesh(geo('gg-wreath', () => new THREE.TorusGeometry(.27, .025, 6, 30)), F('#6bc77a'), [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
    ['#ff9ec7', '#fff3a8', '#b9a6e8', '#ff9ec7', '#9be8ff'].forEach((cl, i) => { const a = Math.PI * (.15 + i * .175); const f = new THREE.Group(); f.position.set(Math.cos(a) * .27, .02, Math.sin(a) * .27);
      for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; f.add(bead(F(cl), [Math.cos(b) * .035, Math.sin(b) * .035, 0], [.03, .03, .015])); }
      f.add(bead(F('#ffd86b'), [0, 0, .012], .018)); f.lookAt(Math.cos(a) * 2, .6, Math.sin(a) * 2); ring.add(f); });
    body.add(ring);
  } else if (hat === 'nightcap') {
    const cm = F('#5c6bd6');
    body.add(lathe([[0, 0], [.31, 0], [.24, .12], [.13, .24], [0, .3]], cm, 24).translateY(.6));
    body.add(mesh(geo('gg-cuff', () => new THREE.TorusGeometry(.3, .045, 8, 28)), F('#c9d0ff'), [0, .61, 0], 1, [Math.PI / 2, 0, 0]));
    body.add(tube([[0, .86, 0], [.12, .95, 0], [.28, .9, .02], [.36, .76, .04]], .045, cm, 12, 8));
    body.add(ball(F('#ffffff'), [.37, .72, .04], .06));
    body.add(mesh(geo('gg-moonarc', () => new THREE.TorusGeometry(.045, .016, 6, 14, Math.PI * 1.3)), GW('#ffd86b', .9), [-.04, .74, .2], 1, [0, 0, -.6]));
  }
  Object.assign(root.userData, { kind: 'nib', body, eyes, paws, t0: Math.random() * 10, hop: 0 });
  return freeze(root);
}
export function animNib(o, t, dt) {
  const u = o.userData, k = t + u.t0;
  if (u.hop > 0) u.hop = Math.max(0, u.hop - dt);
  const hop = u.hop > 0 ? Math.sin((1 - u.hop / .7) * Math.PI) : 0;
  u.body.position.y = Math.sin(k * 2.1) * .012 + hop * .16;
  u.body.rotation.z = Math.sin(k * 1.2) * .045;
  u.body.scale.set(1 + Math.sin(k * 2.1) * .012, 1 - Math.sin(k * 2.1) * .012, 1);
  const bl = (k % 3.7) < .13 ? .12 : 1; u.eyes.scale.y = bl;
  const wave = Math.max(0, Math.sin(k * .7)) ** 6;
  u.paws[1].rotation.z = wave * .5 * Math.sin(k * 9); u.paws[1].position.y = .1 + wave * .05 + hop * .04;
  u.paws[0].position.y = .1 + hop * .04;
}

/* ---------------- gems for the shelf ---------------- */
export function gemStone(t) {
  const g = new THREE.Group();
  if (t === 'rose') g.add(mesh(geo('gg-egg', () => new THREE.SphereGeometry(1, 10, 7)), crys('#f7a2c6', { glow: .28 }), [0, .44, 0], [.3, .36, .24]));
  else if (t === 'moon') { g.add(mesh(SPH(32), smoothGem('#dfe8fb', { sheen: '#8fb4ff', em: '#8fa8e0', gl: .2, irid: .6, env: .8 }), [0, .43, 0], [.36, .36, .3])); g.add(mesh(SPH(20), mat('#ffffff', { basic: true, opacity: .35 }), [-.1, .55, .2], [.13, .08, .08])); }
  else if (t === 'ame') {
    const m = crys('#a66bff', { glow: .3 });
    const a = shard(m, { r: .2, h: .52, tip: .24, taper: .95 }); a.position.y = .06; g.add(a);
    const b = shard(crys('#c9a6ff', { glow: .3 }), { r: .09, h: .22, tip: .1 }); b.position.set(-.27, .04, .06); b.rotation.z = .45; g.add(b);
  } else if (t === 'sun') {
    const b = lathe([[0, .06], [.4, .54], [.4, .6], [.25, .8], [0, .8]], crys('#ffad4a', { glow: .35 }), 8); b.rotation.set(.18, Math.PI / 8, 0); g.add(b);
  } else if (t === 'star') {
    g.add(mesh(SPH(32), smoothGem('#3f6fe0', { gl: .18, sheen: '#a8c4ff' }), [0, .43, 0], [.36, .36, .28]));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(.5, .022, .01), GW('#ffffff', 1.2), [0, .43, .285], 1, [0, 0, i * Math.PI / 3 + Math.PI / 2]));
    g.add(bead(GW('#ffffff', 1.4), [0, .43, .29], .035));
  } else if (t === 'opal') {
    const og = new THREE.SphereGeometry(1, 40, 28), p = og.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const h = (Math.sin(x * 3.1 + y * 2.3) + Math.sin(y * 4.2 - z * 2.7 + 1) + Math.sin(z * 3.3 + x * 1.7 + 2)) / 6 + .5; c.setHSL(h, .75, .8); col.set([c.r, c.g, c.b], i * 3); }
    og.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const om = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .14, clearcoat: 1, clearcoatRoughness: .05, envMap: envTex(), envMapIntensity: .9, iridescence: .7, emissive: '#ffffff', emissiveIntensity: .08 });
    const o = mesh(og, om, [0, .42, 0], [.36, .32, .26]); o.userData.noMerge = true; g.add(o);
  }
  else { // heart
    const h = extrude(heartShape(), .35, crys('#ff7fb6', { glow: .3 }), .14, 14); h.scale.setScalar(.38); h.position.y = .44; g.add(h);
  }
  return freeze(g);
}

/* ---------------- the crystal on the title screen (200x200 drawing -> 2 units wide) ---------------- */
export function titleCrystal() {
  const g = new THREE.Group();
  const main = shard(crys('#b9a6e8', { glow: .45, irid: .8 }), { r: .36, h: 1.08, tip: .46, taper: .82 }); main.position.y = .28; main.rotation.y = .4; g.add(main);
  const l = shard(crys('#9be8ff', { glow: .5 }), { r: .15, h: .56, tip: .18 }); l.position.set(-.42, .25, .08); l.rotation.z = .28; g.add(l);
  const r = shard(crys('#ff9ec7', { glow: .5 }), { r: .16, h: .6, tip: .18 }); r.position.set(.42, .25, .06); r.rotation.z = -.28; g.add(r);
  for (const [x, z, c, s] of [[-.2, .3, '#ffd86b', .7], [.22, .32, '#8fe8c4', .6], [.05, -.3, '#ff9ec7', .8]]) { const sm = shard(crys(c, { glow: .5 }), { r: .07 * s, h: .2 * s, tip: .08 * s }); sm.position.set(x, .24, z); pointAlong(sm, [x, 1, z]); g.add(sm); }
  g.add(gball(mat('#4a4268', { felt: true, flat: true }), [0, .25, 0], [.62, .14, .45]));
  return freeze(g);
}

/* ---------------- doors (200-wide drawings; x in [-1,1], y up from the floor) ---------------- */
function miniGrid(g, n, cx, cy, size, m, z = 0) {
  const cs = size / n, sh = roundRectShape(cs * .82, cs * .82, cs * .28);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const t = extrude(sh, .025, m, .008, 6); t.position.set(cx - size / 2 + cs * (c + .5), cy + size / 2 - cs * (r + .5), z); g.add(t); }
}
export function door(type, n, face) {
  const g = new THREE.Group();
  if (type === 'little') {
    const oy = 240, arch = (x0, x1, top, sp) => svgShape([['M', x0, 236], ['L', x0, sp], ['Q', x0, top, 100, top], ['Q', x1, top, x1, sp], ['L', x1, 236]], { ox: 100, oy });
    const fr = extrude(arch(20, 180, 30, 110), .2, F('#5a4630'), .03, 16); g.add(fr);
    const dr = extrude(arch(36, 164, 48, 114), .1, mat('#8a6a42', { felt: true }), .015, 16); dr.position.z = .1; g.add(dr);
    for (const x of [-.32, 0, .32]) g.add(mesh(new THREE.BoxGeometry(.025, 1.7, .02), F('#6d5232'), [x, .9, .16]));
    g.add(mesh(new THREE.BoxGeometry(1.3, .06, .03), F('#6d5232'), [0, .5, .17]));
    g.add(ball(MT('#ffd86b', .3), [.5, .8, .2], .07));
    miniGrid(g, n, 0, .9, .6, crys('#e8e0ff', { glow: .35 }), .18);
    g.add(mesh(new THREE.BoxGeometry(.62, .62, .03), F('#4a3826'), [0, .9, .15]));
    const leaf = F('#6bc77a'), leaf2 = F('#58b46a');
    g.add(tube([[-.82, .9, .12], [-.7, 1.3, .14], [-.4, 1.75, .14], [0, 1.95, .14], [.45, 1.8, .14], [.78, 1.45, .12]], .02, F('#4f8a55'), 30, 5));
    [[-.75, 1.15, .4], [-.55, 1.55, -.3], [-.2, 1.88, .5], [.25, 1.9, -.4], [.6, 1.65, .2], [.8, 1.3, .6], [-.8, .7, -.2], [.8, .3, .4]].forEach(([x, y, a], i) => g.add(ball(i % 2 ? leaf : leaf2, [x, y, .17], [.11, .06, .03], [0, 0, a])));
    g.add(mesh(new THREE.BoxGeometry(1.8, .08, .4), F('#6e6a8c'), [0, .02, .12]));
  } else if (type === 'big') {
    const oy = 300;
    const outer = svgShape([['M', 14, 296], ['L', 14, 120], ['L', 40, 40], ['L', 100, 6], ['L', 160, 40], ['L', 186, 120], ['L', 186, 296]], { ox: 100, oy });
    g.add(extrude(outer, .26, crys('#9a88ee', { glow: .35, irid: .9 }), .025));
    const inner = svgShape([['M', 34, 296], ['L', 34, 126], ['L', 56, 60], ['L', 100, 32], ['L', 144, 60], ['L', 166, 126], ['L', 166, 296]], { ox: 100, oy });
    const im = extrude(inner, .1, F('#2c2458'), .01); im.position.z = .1; g.add(im);
    miniGrid(g, n, 0, 1.25, .9, crys('#cfe9ff', { glow: .7 }), .17);
    g.add(mesh(starGeo(), GW('#ffd86b', 1.3), [0, .35, .18], .1));
    for (const [x, rz, c] of [[-.92, .3, '#b9a6e8'], [.92, -.3, '#cfe9ff'], [-.8, .15, '#ff9ec7'], [.8, -.12, '#9be8ff']]) { const s = shard(crys(c, { glow: .45 }), { r: .07, h: .3, tip: .12 }); s.position.set(x, 0, .1); s.rotation.z = rz; g.add(s); }
    g.add(glow('#b9a6ff', 2.4, .35).translateY(1.4));
  } else { // picture door
    const oy = 280, arch = (x0, x1, top, sp) => svgShape([['M', x0, 276], ['L', x0, sp], ['Q', x0, top, 100, top], ['Q', x1, top, x1, sp], ['L', x1, 276]], { ox: 100, oy });
    g.add(extrude(arch(16, 184, 16, 100), .16, F('#e8b98a'), .03, 16));
    const inr = extrude(arch(30, 170, 32, 104), .08, F('#fff6e6'), .012, 16); inr.position.z = .08; g.add(inr);
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; let x, y; if (t < .25) { x = -.7; y = .04 + t / .25 * 1.72; } else if (t > .75) { x = .7; y = .04 + (1 - t) / .25 * 1.72; } else { const a = Math.PI * (1 - (t - .25) / .5); x = Math.cos(a) * .7; y = 1.76 + Math.sin(a) * .72; } pts.push([x * .92, y, .14]); }
    pts.forEach((p, i) => { if (i % 2 === 0) g.add(bead(F('#f0a8c8'), p, [.028, .028, .015])); });
    if (face) [[1, -.33, 1.97], [2, .33, 1.97], [3, -.33, 1.35], [4, .33, 1.35]].forEach(([v, x, y]) => { const m = face(v); m.scale.setScalar(.56); m.position.set(x, y - .28, .14); g.add(m); });
    miniGrid(g, n, 0, .58, .72, crys('#ffd0e4', { glow: .3 }), .14);
    g.add(ball(GLS('#ff9ec7'), [.56, .9, .16], .06));
  }
  return freeze(g);
}

/* ---------------- geode (200x200 drawing) ---------------- */
export function geode(open) {
  const g = new THREE.Group();
  const geom = new THREE.IcosahedronGeometry(1, 3); const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + .06 * Math.sin(v.x * 4 + 1) * Math.sin(v.y * 5 + 2) * Math.sin(v.z * 3) + .04 * Math.sin(v.x * 9 + v.y * 7); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
  geom.computeVertexNormals();
  g.add(mesh(geom, mat('#8a7f9c', { flat: true, rough: .92 }), [.05, 1.0, 0], [.7, .68, .55], [.2, .3, .1]));
  for (const [x, y, s] of [[.3, .7, .06], [-.3, .6, .045], [-.2, 1.3, .05], [.4, 1.25, .04]]) g.add(gball(mat('#6f6585', { flat: true }), [x, y, .5], [s, s, s * .4]));
  if (open) {
    for (const [x, y, c, rz, s] of [[-.04, .88, '#b9a6e8', .2, 1], [.1, .84, '#9be8ff', -.3, .8], [.02, .8, '#ff9ec7', -.05, .7]]) { const sh = shard(crys(c, { glow: .7 }), { r: .05 * s, h: .16 * s, tip: .07 * s }); sh.position.set(x, y, .5); sh.rotation.set(.6, 0, rz); g.add(sh); }
  }
  return freeze(g);
}

/* ---------------- map caves (140-unit box; x in [-.7,.7], y from 0) ---------------- */
export function mound(i, state, glowCol, c1, c2) {
  const g = new THREE.Group(), rnd = rng(i * 13 + 5);
  const dark = state === 'dark', tone = col => dark ? new THREE.Color(col).lerp(new THREE.Color('#2e2a50'), .65).getStyle() : col;
  const rock = F(dark ? '#3a3560' : state === 'cur' ? '#4e4780' : new THREE.Color(c1).lerp(new THREE.Color('#5a4f8a'), .45).getStyle());
  const rock2 = F(dark ? '#332f58' : state === 'cur' ? '#453f74' : new THREE.Color(c2).lerp(new THREE.Color('#5a4f8a'), .55).getStyle());
  g.add(ball(rock, [0, 0, 0], [.6, .5, .44]));
  for (let k = 0; k < 6; k++) { const a = Math.PI * (-.15 - k / 5 * .7) + (rnd() - .5) * .2; g.add(ball(k % 2 ? rock : rock2, [Math.cos(a) * .5, .05 + rnd() * .12, Math.sin(a) * .3], .17 + rnd() * .08)); }
  for (const sx of [-1, 1]) g.add(ball(rock2, [sx * .56, -.05, .12], [.16, .14, .16]));
  g.add(ball(F(dark ? '#2f4a3e' : '#5a9a64'), [-.1, .46, -.05], [.28, .08, .22]));
  const mouthS = svgShape([['M', -26, 26], ['Q', -26, -14, 0, -14], ['Q', 26, -14, 26, 26]], { ox: 0, oy: 26 });
  const mouth = extrude(mouthS, .06, F('#1d1a33'), .015, 14); mouth.position.set(0, -.02, .43); mouth.rotation.x = -.15; g.add(mouth);
  const lit = !dark;
  const cm = crys(lit ? glowCol : '#5d5789', { glow: lit ? .9 : .05 });
  [[-.07, .0, .9], [.06, .02, .7], [.15, -.02, .55], [-.16, 0, .5]].forEach(([x, z, s]) => { const sh = shard(cm, { r: .04 * s, h: .2 * s, tip: .08 * s }); sh.position.set(x, -.02, .45 + z); g.add(sh); });
  if (lit) g.add(glow(glowCol, .9, .55).translateY(.12).translateZ(.5));
  // a little something on top that tells the caves apart
  const top = new THREE.Group(); top.position.set(.12, .44, 0); g.add(top);
  if (i === 0) { const cl = cluster(tone('#ffd86b'), { n: 5, seed: 3, glow: lit ? .6 : .05, base: null }); cl.scale.setScalar(.45); top.add(cl); }
  if (i === 1) [[0, 0, .32, '#ff9ec7'], [-.2, -.02, .22, '#e2566b'], [.15, .05, .18, '#ff9ec7']].forEach(([x, z, s, c]) => { const m = new THREE.Group(); m.add(lathe([[0, 0], [.18, 0], [.2, .3], [.15, .7], [0, .72]], F('#fff1d6'), 10)); m.add(lathe([[0, 1.05], [.35, 1], [.6, .82], [.7, .66], [.5, .62], [0, .66]], lit ? GW(tone(c), .5) : F(tone(c)), 14)); m.scale.setScalar(s); m.position.set(x, -.02, z); top.add(m); });
  if (i === 2) { const w = mesh(new THREE.CircleGeometry(.3, 24), smoothGem(tone('#5ec8ff'), { gl: lit ? .4 : .05 }), [-.25, -.4, .5], [1, .55, 1], [-Math.PI / 2 + .3, 0, 0]); g.add(w); for (const x of [-.45, -.05]) top.add(tube([[x, -.45, .45], [x + .02, -.2, .45], [x + .04, 0, .45]], .015, F('#4f7f45'), 5, 4)); }
  if (i === 3) for (const [x, s] of [[-.2, .8], [0, 1.1], [.18, .7]]) { const sh = shard(crys(tone('#8fe8c4'), { glow: lit ? .6 : .05 }), { r: .05 * s, h: .2 * s, tip: .08 * s }); sh.position.x = x; top.add(sh); }
  if (i === 4) ['#ff8a8a', '#ffd86b', '#8fe8c4', '#7fd8ff', '#b9a6e8'].forEach((c, k) => { const sh = shard(crys(tone(c), { glow: lit ? .6 : .05 }), { r: .04, h: .14 + (2 - Math.abs(k - 2)) * .05, tip: .06 }); sh.position.x = -.24 + k * .12; sh.rotation.z = (k - 2) * -.15; top.add(sh); });
  if (i === 5) { top.add(tube([[-.2, 0, 0], [-.1, .1, .05], [.05, .08, 0], [.12, .22, .02]], .025, F(tone('#8a6a42')), 10, 5)); top.add(mesh(starGeo(), lit ? GW('#fff3b0', 1.2) : F(tone('#fff3b0')), [.12, .3, .02], .07)); }
  if (i === 6) { const h = extrude(heartShape(), .3, crys(tone('#ff7fb0'), { glow: lit ? .6 : .05 }), .1, 10); h.scale.setScalar(.13); h.position.y = .14; top.add(h); }
  if (i === 7) top.add(mesh(new THREE.TorusGeometry(.12, .045, 8, 20, Math.PI * 1.3), lit ? GW('#fff2c0', 1) : F(tone('#fff2c0')), [0, .16, 0], 1, [0, 0, -.7]));
  return freeze(g);
}
export function spotCrystal(col, on) {
  const g = new THREE.Group();
  const s = shard(crys(on ? col : '#3d3866', { glow: on ? 1 : .04 }), { r: .055, h: .12, tip: .08, seg: 5 }); g.add(s);
  const s2 = shard(crys(on ? lighten(col, .08) : '#4a4578', { glow: on ? .9 : .04 }), { r: .03, h: .06, tip: .05, seg: 5 }); s2.position.set(.06, 0, .02); s2.rotation.z = -.5; g.add(s2);
  g.add(gball(F('#3a3560'), [0, 0, 0], [.08, .025, .06]));
  return freeze(g);
}

/* ---------------- Nib's furniture (100x100 unit box) ---------------- */
export function nookItem(id) {
  const g = new THREE.Group();
  const wood = F('#c98a4a'), dwood = F('#8a5a2b');
  if (id === 'chair') {
    g.add(tube([[-.32, .06, .1], [-.1, .0, .1], [.1, .0, .1], [.32, .06, .1]], .025, dwood, 12, 6));
    g.add(tube([[-.32, .06, -.12], [-.1, .0, -.12], [.1, .0, -.12], [.32, .06, -.12]], .025, dwood, 12, 6));
    for (const [x, z] of [[-.2, .1], [.2, .1], [-.2, -.12], [.2, -.12]]) g.add(capsule(dwood, [x, .03, z], [x * .9, .3, z], .02));
    const seat = new THREE.Group(); seat.add(mesh(new THREE.BoxGeometry(.5, .06, .32), wood, [0, .32, 0]));
    seat.add(ball(F('#ff9ec7'), [0, .37, .0], [.24, .05, .15]));
    seat.add(mesh(new THREE.BoxGeometry(.48, .4, .05), wood, [0, .58, -.15], 1, [-.12, 0, 0]));
    seat.add(ball(F('#ffd0e4'), [0, .56, -.11], [.2, .14, .04]));
    g.add(seat);
  } else if (id === 'lamp') {
    g.add(lathe([[0, 0], [.08, 0], [.07, .3], [.06, .5], [0, .52]], F('#fffaf0'), 12));
    g.add(lathe([[0, .82], [.2, .79], [.34, .66], [.36, .56], [.24, .52], [0, .54]], GW('#ff8fb8', .9), 22));
    for (const [x, y, z] of [[-.12, .74, .14], [.1, .77, .12], [.0, .81, -.05], [.2, .66, .1]]) g.add(bead(F('#ffffff'), [x, y, z], [.04, .02, .04]));
    g.add(glow('#ffc8e0', 1.3, .55).translateY(.55));
  } else if (id === 'rug') {
    g.add(mesh(new THREE.CylinderGeometry(.46, .46, .03, 32), F('#6bc77a'), [0, .015, 0], [1, 1, .55]));
    g.add(mesh(new THREE.CylinderGeometry(.32, .32, .035, 28), F('#9be89b'), [0, .02, 0], [1, 1, .55]));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.add(bead(F('#4fae66'), [Math.cos(a) * .46, .03, Math.sin(a) * .25], .03)); }
  } else if (id === 'books') {
    g.add(mesh(new THREE.BoxGeometry(.68, .66, .2), dwood, [0, .33, -.02]));
    g.add(mesh(new THREE.BoxGeometry(.6, .27, .12), F('#3a2616'), [0, .49, .04]));
    g.add(mesh(new THREE.BoxGeometry(.6, .27, .12), F('#3a2616'), [0, .19, .04]));
    ['#ff6f8e', '#4ea8ff', '#ffcd3c', '#3fd394', '#b77cff'].forEach((c, k) => g.add(mesh(new THREE.BoxGeometry(.08, .2 - (k % 2) * .03, .1), F(c), [-.22 + k * .11, .45 - (k % 2) * .015, .05])));
    for (const [x, c] of [[-.15, '#b9a6e8'], [0, '#9be8ff'], [.15, '#ff9ec7']]) { const s = shard(crys(c, { glow: .6 }), { r: .035, h: .1, tip: .06 }); s.position.set(x, .08, .06); g.add(s); }
  } else if (id === 'bed') {
    g.add(mesh(new THREE.BoxGeometry(.8, .16, .4), F('#8a5a2b'), [0, .12, 0]));
    g.add(ball(F('#6bc77a'), [0, .24, 0], [.42, .08, .22]));
    g.add(ball(F('#fffaf0'), [-.28, .3, 0], [.13, .07, .15]));
    g.add(ball(F('#b9a6e8'), [.12, .29, .02], [.3, .07, .2]));
    for (const x of [-.38, .38]) g.add(mesh(new THREE.BoxGeometry(.05, .1, .05), F('#6b4a24'), [x, .03, .15]));
  } else if (id === 'telescope') {
    for (const a of [0, 2.1, 4.2]) g.add(capsule(dwood, [0, .45, 0], [Math.cos(a) * .2, 0, Math.sin(a) * .2], .018));
    const t = new THREE.Group(); t.position.set(0, .48, 0); t.rotation.z = .5;
    t.add(capsule(F('#5c6bd6'), [-.3, 0, 0], [.2, 0, 0], .07)); t.add(capsule(GLS('#d9b25a'), [.2, 0, 0], [.32, 0, 0], .05));
    t.add(mesh(new THREE.TorusGeometry(.07, .015, 6, 16), MT('#d9b25a'), [-.1, 0, 0], 1, [0, Math.PI / 2, 0])); g.add(t);
    g.add(mesh(starGeo(), GW('#ffd86b', 1.2), [.36, .82, 0], .05));
  }
  return freeze(g);
}
