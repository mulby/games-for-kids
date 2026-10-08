// Toy 3D: the shared storybook 3D kit for the games (Three.js).
// Everything is modeled in code with a soft felt-toy look, so every game shares one style and nothing needs licensing.
// Games load it as an ES module after an import map that points "three" at shared/vendor/three.module.min.js.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

export { THREE };

/* ---------------- materials (cached) ---------------- */
const matCache = new Map();
export function mat(color, o = {}) {
  const key = String(color) + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (o.glow) m = new THREE.MeshStandardMaterial({ color, emissive: o.glowColor || color, emissiveIntensity: o.glow, roughness: .5 });
  else if (o.glass) m = new THREE.MeshPhysicalMaterial({ color, roughness: .1, transparent: true, opacity: o.glass, clearcoat: 1, clearcoatRoughness: .1, depthWrite: false, side: THREE.DoubleSide });
  else if (o.metal) m = new THREE.MeshStandardMaterial({ color, metalness: .55, roughness: .35, emissive: color, emissiveIntensity: o.shine ?? .12 });
  else if (o.felt) m = new THREE.MeshPhysicalMaterial({ color, roughness: .95, sheen: 1, sheenRoughness: .6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .5) });
  else if (o.gloss) m = new THREE.MeshPhysicalMaterial({ color, roughness: .25, clearcoat: .8, clearcoatRoughness: .2 });
  else if (o.basic) m = new THREE.MeshBasicMaterial({ color, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null });
  else m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .78, metalness: 0, flatShading: !!o.flat });
  if (o.side) m.side = o.side;
  if (o.vc) m.vertexColors = true;
  matCache.set(key, m);
  return m;
}
export const lighten = (c, l) => new THREE.Color(c).offsetHSL(0, 0, l).getStyle();

/* ---------------- geometry helpers ---------------- */
const geoCache = new Map();
export function geo(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
export const SPH = (seg = 24) => geo('s' + seg, () => new THREE.SphereGeometry(1, seg, Math.round(seg * .7)));
export function mesh(g, m, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  const x = new THREE.Mesh(g, m);
  x.position.set(...p); x.scale.set(...(Array.isArray(s) ? s : [s, s, s])); x.rotation.set(...r);
  return x;
}
export const ball = (m, p, s, r) => mesh(SPH(), m, p, s, r);
// low-detail sphere for small bits (spots, petals, berries, highlights)
export const bead = (m, p, s, r) => mesh(SPH(10), m, p, s, r);
export function capsule(m, a, b, rad) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = Math.max(.001, A.distanceTo(B));
  const x = new THREE.Mesh(geo('cap' + rad.toFixed(3) + '/' + len.toFixed(3), () => new THREE.CapsuleGeometry(rad, len, 5, 12)), m);
  x.position.copy(A).add(B).multiplyScalar(.5);
  x.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return x;
}
// profile points [radius, y]; drawn bottom-to-top so normals face out (top-down profiles are flipped here)
export function lathe(pts, m, seg = 36) {
  if (pts[0][1] > pts[pts.length - 1][1]) pts = pts.slice().reverse();
  return mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), m);
}
export function tube(points, rad, m, seg = 20, radial = 8) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(c, seg, rad, radial, false), m);
}
export function roundRectShape(w, h, r) {
  const s = new THREE.Shape(); r = Math.min(r, w / 2, h / 2);
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
export function slab(shape, depth, m, bevel = .04) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 18 });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}
let _star;
export function starGeo() {
  if (_star) return _star;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? .45 : 1, a = i / 10 * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  _star = new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 2 });
  _star.center();
  return _star;
}
export function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -1); s.bezierCurveTo(-.2, -.7, -1, -.3, -1, .25); s.bezierCurveTo(-1, .8, -.3, 1, 0, .55);
  s.bezierCurveTo(.3, 1, 1, .8, 1, .25); s.bezierCurveTo(1, -.3, .2, -.7, 0, -1);
  return s;
}

/* ---------------- soft glow sprite (cheaper than real lights) ---------------- */
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.75)'); gr.addColorStop(.45, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); s.renderOrder = 10; s.userData.glowBase = opacity;
  return s;
}

/* ---------------- faces ---------------- */
export function eyes(group, { y = 0, x = .32, z = .9, r = .14, ink = '#2e2650', closed = false, scale = 1 } = {}) {
  const ek = mat(ink, { gloss: true }), wh = mat('#fff8e0', { glow: .8 });
  for (const sx of [-1, 1]) {
    if (closed) { group.add(mesh(geo('lid', () => new THREE.TorusGeometry(.12, .03, 6, 16, Math.PI)), ek, [sx * x * scale, y * scale, z * scale], scale, [0, 0, Math.PI])); continue; }
    group.add(ball(ek, [sx * x * scale, y * scale, z * scale], [r * scale, r * 1.25 * scale, r * .6 * scale]));
    group.add(bead(wh, [sx * x * scale + .05 * scale, (y + .07) * scale, (z + .07) * scale], .045 * scale));
    group.add(bead(wh, [sx * x * scale - .04 * scale, (y - .06) * scale, (z + .07) * scale], .022 * scale));
  }
}
export function smile(group, { y = -.2, z = .95, w = .14, scale = 1, color = '#2e2650', open = false } = {}) {
  if (open) { group.add(ball(mat('#a8455c', { gloss: true }), [0, y * scale, z * scale], [w * scale * .9, w * scale * .6, w * scale * .3])); return; }
  group.add(mesh(geo('smile', () => new THREE.TorusGeometry(1, .18, 6, 20, Math.PI * .8)), mat(color, { gloss: true }), [0, y * scale, z * scale], w * scale, [0, 0, Math.PI + Math.PI * .1]));
}
const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: .45, depthWrite: false });
export function cheeks(group, { y = -.12, x = .55, z = .8, scale = 1 } = {}) {
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(geo('cheek', () => new THREE.CircleGeometry(1, 20)), cheekMat);
    c.position.set(sx * x * scale, y * scale, z * scale); c.scale.setScalar(.13 * scale);
    c.lookAt(sx * x * 3 * scale, y * scale, z * 3 * scale);
    group.add(c);
  }
}

/* ---------------- wings ---------------- */
function wingGeo(kind) {
  return geo('wing' + kind, () => {
    const s = new THREE.Shape();
    if (kind === 'top') { s.moveTo(0, 0); s.bezierCurveTo(.3, .9, 1.4, 1.5, 1.7, 1.0); s.bezierCurveTo(1.9, .6, 1.2, .1, 0, 0); }
    else { s.moveTo(0, 0); s.bezierCurveTo(.5, -.1, 1.2, -.5, 1.0, -.95); s.bezierCurveTo(.7, -1.2, .2, -.6, 0, 0); }
    const g = new THREE.ShapeGeometry(s, 16);
    return g;
  });
}
export const WING_COLORS = { blue: '#a9d4ff', pink: '#ffc4d8', rose: '#ffc4d8', gold: '#ffe08a', lilac: '#d4c4ff', green: '#b8f0c8', mint: '#b8f0c8' };
const wingMats = new Map();
function wingMat(color) {
  if (!wingMats.has(color)) wingMats.set(color, new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: .55, transparent: true, opacity: .8, roughness: .15, iridescence: 1, iridescenceIOR: 1.6, side: THREE.DoubleSide, depthWrite: false }));
  return wingMats.get(color);
}
export function wings(color, size = 1) {
  const root = new THREE.Group(); const m = wingMat(color);
  const sides = [];
  for (const sx of [-1, 1]) {
    const side = new THREE.Group(); side.scale.x = sx; side.userData.live = true; side.name = sx < 0 ? 'wingL' : 'wingR';
    const top = new THREE.Mesh(wingGeo('top'), m); top.scale.setScalar(size);
    const bot = new THREE.Mesh(wingGeo('bot'), m); bot.scale.setScalar(size * .85);
    top.renderOrder = bot.renderOrder = 2;
    side.add(top, bot); root.add(side); sides.push(side);
  }
  root.userData.sides = sides; root.userData.live = true; root.name = 'wings';
  return root;
}

/* ---------------- fairy (chibi, about 2.3 heads tall, feet at y=-.42, head top near 2.8) ---------------- */
const SKIN = '#ffdcc6', SKIN2 = '#f7c4ad';
export function fairy({ wing = 'blue', hair = 'bun', hairColor = '#8a5634', dress = '#f6a6bd', dress2 = '#ffe1ea', crown = false, wand = true, sit = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const skin = mat(SKIN, { felt: true });
  const dm = mat(dress, { felt: true }), petal = mat(dress2, { felt: true });
  body.add(lathe([[0, 1.25], [.32, 1.2], [.42, 1.0], [.62, .55], [.86, .2], [.9, .12], [.0, .1]], dm, 40));
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; body.add(ball(dm, [Math.sin(a) * .82, .17, Math.cos(a) * .82], [.2, .1, .2])); }
  body.add(mesh(geo('trim', () => new THREE.TorusGeometry(.86, .045, 6, 40)), petal, [0, .2, 0], 1, [Math.PI / 2, 0, 0]));
  body.add(mesh(geo('sash', () => new THREE.TorusGeometry(.4, .06, 6, 28)), petal, [0, 1.08, 0], 1, [Math.PI / 2, 0, 0]));
  for (const sx of [-1, 1]) body.add(ball(petal, [sx * .13, 1.08, .4], [.13, .09, .06], [0, 0, sx * .5]));
  body.add(ball(petal, [0, 1.08, .42], .06));
  body.add(ball(dm, [0, 1.32, 0], [.36, .3, .3]));
  const shoe = mat('#b9a6e8', { gloss: true });
  for (const sx of [-1, 1]) {
    if (sit) { body.add(capsule(skin, [sx * .17, .2, .1], [sx * .2, .1, .55], .085)); body.add(ball(shoe, [sx * .2, .08, .65], [.12, .1, .16])); }
    else { body.add(capsule(skin, [sx * .17, .15, 0], [sx * .19, -.25, .02], .085)); body.add(ball(shoe, [sx * .19, -.33, .07], [.12, .09, .17])); }
  }
  const armL = new THREE.Group(); armL.position.set(-.33, 1.38, 0); armL.userData.live = true; armL.name = 'armL';
  armL.add(capsule(skin, [0, 0, 0], [-.18, -.45, .12], .075)); armL.add(ball(skin, [-.2, -.52, .14], .095));
  const armR = new THREE.Group(); armR.position.set(.33, 1.38, 0); armR.userData.live = true; armR.name = 'armR';
  armR.add(capsule(skin, [0, 0, 0], [.22, -.3, .25], .075)); armR.add(ball(skin, [.24, -.36, .3], .095));
  body.add(armL, armR);
  let wandG = null;
  if (wand) {
    wandG = new THREE.Group(); wandG.position.set(.24, -.36, .3); wandG.name = 'wand';
    wandG.add(capsule(mat('#a87842', { gloss: true }), [0, -.15, 0], [.05, .6, -.05], .025));
    const star = mesh(starGeo(), mat('#ffe58a', { glow: 1.6 }), [.06, .7, -.05], .13); star.userData.live = true; star.name = 'star';
    wandG.add(star); const sg = glow('#ffe9a0', 1.1, .9); sg.position.copy(star.position); wandG.add(sg);
    wandG.userData.star = star; armR.add(wandG);
  }
  body.add(capsule(skin, [0, 1.4, 0], [0, 1.58, 0], .09));
  const head = new THREE.Group(); head.position.set(0, 2.1, 0); head.userData.live = true; head.name = 'head'; body.add(head);
  head.add(ball(skin, [0, 0, 0], [.6, .56, .55]));
  head.add(ball(mat(SKIN2, { felt: true }), [0, -.04, .55], [.05, .04, .03]));
  for (const sx of [-1, 1]) head.add(ball(skin, [sx * .58, -.02, 0], [.09, .14, .08]));
  const face = new THREE.Group(); face.position.z = -.33; face.scale.setScalar(.6); head.add(face);
  eyes(face, { y: .02, x: .36, z: 1.4, r: .16 });
  smile(face, { y: -.3, z: 1.45, w: .14 });
  cheeks(face, { y: -.18, x: .62, z: 1.33 });
  const hm = mat(hairColor, { felt: true }), hh = mat(lighten(hairColor, .1), { felt: true });
  head.add(ball(hm, [0, .12, -.06], [.64, .58, .6]));
  head.add(ball(hm, [0, .3, .2], [.56, .3, .45]));
  for (const sx of [-1, 1]) head.add(ball(hm, [sx * .32, .26, .4], [.26, .18, .14], [0, 0, sx * .5]));
  if (hair === 'bun') {
    head.add(ball(hm, [0, .62, -.22], .26)); head.add(ball(hh, [-.07, .7, -.12], .08));
    head.add(ball(mat('#f2a7b5', { felt: true }), [.2, .58, -.1], [.11, .08, .08]));
  } else if (hair === 'curls') {
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; head.add(ball(i % 2 ? hm : hh, [Math.cos(a) * .6, .1 + Math.sin(a) * .45, -.1 - Math.abs(Math.sin(a)) * .1], .2)); }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) head.add(ball(hm, [sx * .62, -.25 - k * .22, -.05], .16 - k * .02));
  } else if (hair === 'braids') {
    for (const sx of [-1, 1]) { for (let k = 0; k < 5; k++) head.add(ball(k % 2 ? hh : hm, [sx * (.55 + k * .02), -.2 - k * .18, -.12], .13 - k * .01)); head.add(ball(mat('#a9d4ff', { felt: true }), [sx * .64, -1.12, -.12], [.08, .06, .06])); }
  } else {
    for (let i = 0; i < 7; i++) { const a = -1.2 + i * .4; head.add(capsule(hm, [Math.sin(a) * .45, .35, Math.cos(a) * .25], [Math.sin(a) * .7, .58, Math.cos(a) * .1 - .1], .1)); }
  }
  if (crown) {
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .32; head.add(mesh(starGeo(), mat('#fff3cf', { glow: .5 }), [Math.sin(a) * .4, .6 + Math.cos(a * 1.2) * .05, Math.cos(a) * .25 + .05], .11)); }
  }
  const w = wings(WING_COLORS[wing] || (/^#/.test(wing) ? wing : WING_COLORS.blue), .78);
  w.position.set(0, 1.2, -.25);
  w.userData.sides[0].rotation.y = -.5; w.userData.sides[1].rotation.y = .5;
  body.add(w);
  Object.assign(root.userData, { body, head, armL, armR, wings: w, wand: wandG, kind: 'fairy', mood: 'idle', t0: Math.random() * 10 });
  freeze(root);
  return root;
}

/* ---------------- firefly (card creatures are fireflies with hats) ---------------- */
const tailMats = new Map();
export function firefly({ body = '#ffe27a', wing = '#cfe6ff', glowColor = '#ffd65a', acc = null, sleepy = false, lit = true, stripes = false } = {}) {
  const root = new THREE.Group();
  const b = new THREE.Group(); b.userData.live = true; b.name = 'body'; root.add(b);
  const fur = mat(body, { felt: true });
  const tailM = new THREE.MeshStandardMaterial({ color: lighten(glowColor, .2), emissive: glowColor, emissiveIntensity: lit ? 2.2 : .15, roughness: .4 });
  const tail = ball(tailM, [0, -.15, -.62], [.46, .42, .5]); tail.userData.noMerge = true; tail.name = 'tail'; b.add(tail);
  const halo = glow(glowColor, 3.2, lit ? .95 : 0); halo.position.set(0, -.15, -.5); halo.name = 'halo'; b.add(halo);
  b.add(ball(fur, [0, 0, 0], [.72, .68, .66]));
  if (stripes) for (let i = 0; i < 2; i++) b.add(mesh(geo('stripe', () => new THREE.TorusGeometry(.66, .07, 6, 30)), mat('#3a2f5c', { felt: true }), [0, 0, -.22 - i * .2], [1 - i * .1, .95 - i * .1, 1], [0, 0, 0]));
  eyes(b, { y: .1, x: .26, z: .6, r: .12, closed: sleepy });
  smile(b, { y: -.12, z: .64, w: .09 });
  cheeks(b, { y: -.02, x: .44, z: .52 });
  const ink = mat('#2e2650', { gloss: true });
  for (const sx of [-1, 1]) {
    b.add(tube([[sx * .18, .55, .2], [sx * .3, .9, .25], [sx * .45, 1.05, .12]], .028, ink, 10, 5));
    b.add(bead(mat('#fff8e0', { glow: .8 }), [sx * .46, 1.06, .12], .075));
  }
  for (const sx of [-1, 1]) b.add(bead(fur, [sx * .3, -.62, .15], [.13, .1, .16]));
  const w = wings(wing, .55); w.position.set(0, .35, -.25);
  w.userData.sides.forEach((s, i) => { s.rotation.y = i ? .9 : -.9; s.rotation.x = -.2; });
  b.add(w);
  if (acc) { const a = accessory(acc); a.position.set(0, .62, .05); b.add(a); }
  Object.assign(root.userData, { kind: 'firefly', body: b, wings: w, tail, halo, tailM, t0: Math.random() * 10, lit, sleepy });
  freeze(root);
  return root;
}
export function setLit(ff, on) {
  const u = ff.userData; if (u.lit === on) return; u.lit = on;
  u.tailM.emissiveIntensity = on ? 2.2 : .15; u.halo.material.opacity = on ? .95 : 0;
}
export function accessory(kind) {
  const a = new THREE.Group();
  const add = x => (a.add(x), x);
  switch (kind) {
    case 'acorn': add(lathe([[0, .3], [.3, .25], [.42, .1], [.4, 0], [0, 0]], mat('#94692f', { felt: true }))); add(capsule(mat('#6b4a24'), [0, .28, 0], [.05, .45, 0], .04)); break;
    case 'mushroom': add(lathe([[0, .42], [.3, .36], [.48, .16], [.5, .05], [0, .05]], mat('#e2566b', { gloss: true }))); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; add(ball(mat('#ffffff'), [Math.cos(t) * .33, .26, Math.sin(t) * .33], .06)); } add(ball(mat('#ffffff'), [0, .43, 0], .06)); break;
    case 'teacup': add(lathe([[0, 0], [.18, 0], [.3, .08], [.36, .32], [.33, .33], [.27, .1], [0, .08]], mat('#ffffff', { gloss: true }))); add(mesh(new THREE.TorusGeometry(.09, .03, 6, 14), mat('#f2a7b5', { gloss: true }), [.38, .2, 0])); break;
    case 'thimble': add(lathe([[0, .38], [.2, .36], [.28, .3], [.3, 0], [0, 0]], mat('#d0d6e6', { metal: true, shine: .3 }))); break;
    case 'crown': for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; add(mesh(geo('crownspike', () => new THREE.ConeGeometry(.08, .28, 6)), mat('#ffd86b', { metal: true }), [Math.cos(t) * .28, .2, Math.sin(t) * .28])); add(ball(mat('#f2a7b5', { gloss: true }), [Math.cos(t) * .28, .36, Math.sin(t) * .28], .05)); } add(mesh(new THREE.CylinderGeometry(.32, .32, .12, 20, 1, true), mat('#ffd86b', { metal: true, side: THREE.DoubleSide }), [0, .07, 0])); break;
    case 'bow': case 'ribbon': for (const sx of [-1, 1]) add(ball(mat('#f2a7b5', { felt: true }), [sx * .2, .1, .1], [.2, .13, .08], [0, 0, sx * .4])); add(ball(mat('#e48aa0', { felt: true }), [0, .1, .12], .08)); break;
    case 'flower': for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; add(ball(mat('#ffffff', { felt: true }), [Math.cos(t) * .2, .12, Math.sin(t) * .2], [.13, .05, .13])); } add(ball(mat('#ffd86b', { felt: true }), [0, .15, 0], .1)); break;
    case 'leaf': add(ball(mat('#7cc06e', { felt: true }), [.1, .2, 0], [.12, .3, .05], [0, 0, -.6])); break;
    case 'star': add(mesh(starGeo(), mat('#fff6c8', { glow: .9 }), [0, .25, 0], .2)); break;
    case 'moon': add(mesh(new THREE.TorusGeometry(.2, .08, 8, 20, Math.PI * 1.2), mat('#ffe9a8', { glow: .8 }), [0, .28, 0], 1, [0, 0, -.6])); break;
    case 'drop': add(lathe([[0, .5], [.1, .3], [.2, .12], [.15, 0], [0, -.03]], mat('#a9d4ff', { gloss: true }))); break;
    case 'button': add(mesh(new THREE.CylinderGeometry(.25, .25, .08, 20), mat('#b9a6e8', { gloss: true }), [0, .1, 0], 1, [.4, 0, 0])); break;
  }
  return a;
}

/* ---------------- scenery ---------------- */
export function mushroom(cap = '#e2566b', s = 1) {
  const m = new THREE.Group();
  m.add(lathe([[0, 0], [.18, 0], [.2, .3], [.15, .7], [0, .72]], mat('#fff1d6', { felt: true }), 14));
  m.add(lathe([[0, 1.05], [.35, 1.0], [.6, .82], [.7, .66], [.5, .62], [0, .66]], mat(cap, { gloss: true }), 20));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3, rr = i % 2 ? .45 : .28; m.add(bead(mat('#fff7e6', { felt: true }), [Math.cos(a) * rr, .93 - rr * .3, Math.sin(a) * rr], [.07, .03, .07])); }
  m.scale.setScalar(s); freeze(m);
  return m;
}
export function flower(petal = '#f6a6bd', s = 1) {
  const f = new THREE.Group();
  f.add(tube([[0, 0, 0], [.05, .3, 0], [0, .6, .02]], .025, mat('#5f9a62'), 6, 4));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; f.add(bead(mat(petal, { felt: true }), [Math.cos(a) * .1, .62, Math.sin(a) * .1], [.09, .03, .09])); }
  f.add(bead(mat('#ffd86b', { felt: true }), [0, .64, 0], .05));
  f.scale.setScalar(s); freeze(f); return f;
}
export function tree(s = 1, tint = '#3f6f4a') {
  const t = new THREE.Group();
  t.add(lathe([[0, 0], [.5, 0], [.35, .3], [.3, 2.2], [0, 2.4]], mat('#6b4a33', { felt: true }), 10));
  const leaf = mat(tint, { felt: true }), leaf2 = mat(lighten(tint, .05), { felt: true });
  [[0, 2.8, 0, 1.4], [-.9, 2.4, .2, 1], [.9, 2.5, -.1, 1.05], [.2, 3.6, .1, 1.05], [-.4, 3.2, -.5, .9]].forEach(([x, y, z, r], i) => t.add(mesh(SPH(16), i % 2 ? leaf2 : leaf, [x, y, z], r)));
  t.scale.setScalar(s); freeze(t); return t;
}
export function stone(s = 1) { return ball(mat('#8a8fa8', { felt: true }), [0, s * .25, 0], [s * .6, s * .35, s * .45]); }
export function grassField(n, area, color = '#5c9a5e') {
  const g = new THREE.ConeGeometry(.05, .5, 3, 1); g.translate(0, .25, 0);
  const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 }), n);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    d.position.set(area[0] + Math.random() * (area[1] - area[0]), 0, area[2] + Math.random() * (area[3] - area[2]));
    d.rotation.set((Math.random() - .5) * .5, Math.random() * 3, (Math.random() - .5) * .5);
    d.scale.set(.5 + Math.random() * .4, .45 + Math.random() * .6, .5 + Math.random() * .4); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    im.setColorAt(i, c.set(color).offsetHSL((Math.random() - .5) * .04, 0, (Math.random() - .5) * .12));
  }
  im.receiveShadow = true;
  return im;
}
export function moon(r = 3, sleepy = true) {
  const m = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffe08a', emissiveIntensity: 1.1, roughness: 1, fog: false });
  m.add(ball(face, [0, 0, 0], r));
  const crater = new THREE.MeshStandardMaterial({ color: '#f2d68c', emissive: '#e8c470', emissiveIntensity: .8, fog: false });
  [[-.35, .35, .2], [.4, -.35, .25], [.45, .35, .12]].forEach(([x, y, s]) => m.add(ball(crater, [x * r, y * r, Math.sqrt(Math.max(0, 1 - x * x - y * y)) * r * .98], [s * r, s * r, s * r * .25])));
  m.add(glow('#ffe7a0', r * 7, .55));
  const fg = new THREE.Group(); fg.position.z = r * .02; m.add(fg);
  eyes(fg, { y: .05, x: .3, z: 1, r: .07, closed: sleepy, scale: r, ink: '#c9a04e' });
  smile(fg, { y: -.25, z: .98, w: .12, scale: r, color: '#c9a04e' });
  freeze(m);
  return m;
}

/* ---------------- many copies of one static model in a few draw calls ---------------- */
// tpl: a frozen model; items: [{p:[x,y,z], s, ry}]
export function scatter(tpl, items) {
  const g = new THREE.Group(); tpl.updateMatrixWorld(true);
  const d = new THREE.Object3D(), m4 = new THREE.Matrix4();
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
    items.forEach((it, i) => { d.position.set(...it.p); d.rotation.set(0, it.ry || 0, 0); d.scale.setScalar(it.s || 1); d.updateMatrix(); im.setMatrixAt(i, m4.multiplyMatrices(d.matrix, o.matrixWorld)); });
    im.castShadow = o.castShadow; im.receiveShadow = true; g.add(im);
  });
  return g;
}

/* ---------------- merge static parts: one draw call per material ---------------- */
// Meshes under `root` that are not inside an object marked userData.live are merged by material.
// Live sub-objects (heads, wings, arms) stay separate so they can animate, and are merged inside themselves.
export function freeze(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(), victims = [], lives = [];
  (function walk(o) {
    for (const c of o.children) {
      if (c.userData.live) { lives.push(c); continue; }
      if (c.isMesh && !c.isInstancedMesh && !c.userData.noMerge) {
        const k = c.material.uuid; if (!groups.has(k)) groups.set(k, { m: c.material, g: [] });
        let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        groups.get(k).g.push(g); victims.push(c);
      }
      walk(c);
    }
  })(root);
  for (const v of victims) {
    // keep children of a merged mesh by moving them to the mesh's parent
    while (v.children.length) v.parent.attach(v.children[0]);
    v.parent.remove(v);
  }
  for (const { m, g } of groups.values()) {
    const merged = g.length === 1 ? g[0] : mergeGeometries(g, false);
    const x = new THREE.Mesh(merged, m); x.castShadow = x.receiveShadow = !m.transparent; if (m.transparent) x.renderOrder = 2; root.add(x);
  }
  lives.forEach(l => { if (l !== root) freeze(l); });
  return root;
}

/* ---------------- cheap copies of a built model (shared geometry, own animated parts) ---------------- */
export function instance(tpl) {
  const c = tpl.clone(true);
  const u = c.userData = { ...tpl.userData, t0: Math.random() * 10 };
  for (const k of Object.keys(u)) if (u[k] && u[k].isObject3D) u[k] = c.getObjectByName(u[k].name);
  const w = u.wings; if (w) w.userData = { ...w.userData, sides: [w.getObjectByName('wingL'), w.getObjectByName('wingR')] };
  if (u.wand) u.wand.userData = { ...u.wand.userData, star: u.wand.getObjectByName('star') };
  if (u.tail) { u.tailM = u.tail.material = u.tail.material.clone(); }
  if (u.halo) u.halo.material = u.halo.material.clone();
  return c;
}

/* ---------------- animation ---------------- */
export function animate(o, t) {
  const u = o.userData;
  if (u.kind === 'fairy') {
    const k = t + u.t0, happy = u.mood === 'happy', think = u.mood === 'think';
    u.body.position.y = Math.sin(k * 2) * .08 + (happy ? Math.abs(Math.sin(k * 7)) * .35 : 0);
    u.body.rotation.z = Math.sin(k * 1.3) * .03;
    u.head.rotation.z = think ? .25 + Math.sin(k * 2) * .05 : Math.sin(k * .9) * .08; u.head.rotation.x = Math.sin(k * .7) * .05;
    const flap = Math.sin(k * (happy ? 26 : 14));
    u.wings.userData.sides[0].rotation.y = -.5 - flap * .35; u.wings.userData.sides[1].rotation.y = .5 + flap * .35;
    u.armR.rotation.z = Math.sin(k * 1.6) * .12 + (happy ? .9 + Math.sin(k * 10) * .3 : 0);
    u.armL.rotation.z = -Math.sin(k * 1.4) * .08 - (happy ? .9 : 0) + (think ? -.6 : 0);
    u.armL.rotation.x = think ? -1.2 : 0;
    if (u.wand) u.wand.userData.star.rotation.y = k * 2;
  } else if (u.kind === 'firefly') {
    const k = t + u.t0;
    u.body.position.y = Math.sin(k * 2.6) * .1;
    u.body.rotation.z = Math.sin(k * 1.7) * .08;
    const f = u.sleepy ? Math.sin(k * 3) * .2 : Math.sin(k * 40);
    u.wings.userData.sides[0].rotation.y = -.9 - f * .5; u.wings.userData.sides[1].rotation.y = .9 + f * .5;
    if (u.lit) { const p = .85 + Math.sin(k * 3.1) * .15; u.tailM.emissiveIntensity = 2.2 * p; u.halo.material.opacity = .95 * p; }
  }
}

/* ---------------- standard lights ---------------- */
export function toyLights(scene, { sky = '#c4ccff', ground = '#3a4a50', key = '#fff1dc', keyI = 2.2, fill = '#ffd9b0', fillI = .8, hemiI = 1.3, dir = [-.5, .8, .6] } = {}) {
  const h = new THREE.HemisphereLight(sky, ground, hemiI); scene.add(h);
  const k = new THREE.DirectionalLight(key, keyI); k.position.set(...dir); scene.add(k);
  const f = new THREE.DirectionalLight(fill, fillI); f.position.set(.7, .1, .8); scene.add(f);
  return { hemi: h, key: k, fill: f };
}

/* ---------------- baker: render a model to a still image (for lists, cards and pop-ups) ---------------- */
export class Baker {
  constructor(size = 256) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.outputColorSpace = THREE.SRGBColorSpace; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.05;
    this.r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene(); toyLights(this.scene);
    this.cam = new THREE.PerspectiveCamera(24, 1, .1, 100);
    this.cache = new Map();
  }
  // view: { yaw, pitch, pad, w, h } ; fits the model's bounding box into the frame
  bake(key, build, view = {}) {
    if (this.cache.has(key)) return this.cache.get(key);
    const w = view.w || this.size, h = view.h || this.size;
    this.r.setPixelRatio(1); this.r.setSize(w, h, false);
    const obj = build(); this.scene.add(obj);
    if (view.pose) view.pose(obj);
    obj.updateMatrixWorld(true);
    let c, sz;
    if (view.frame) { // fixed framing: [centerX, centerY, height] so related items keep their relative sizes
      c = new THREE.Vector3(view.frame[0], view.frame[1], 0); sz = new THREE.Vector3(view.frame[2] * w / h, view.frame[2], 0);
    } else {
      const box = new THREE.Box3();
      obj.traverse(o => { if (o.isMesh && !o.userData.noFit) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      c = box.getCenter(new THREE.Vector3()); sz = box.getSize(new THREE.Vector3());
    }
    const yaw = view.yaw ?? .35, pitch = view.pitch ?? .18, pad = view.pad ?? (view.frame ? 1 : 1.12);
    this.cam.aspect = w / h;
    const fitH = Math.max(sz.y, sz.x / this.cam.aspect) * pad;
    const dist = fitH / 2 / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) + Math.max(sz.x, sz.z) / 2;
    this.cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.cam.lookAt(c); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(obj);
    this.cache.set(key, url);
    return url;
  }
}
