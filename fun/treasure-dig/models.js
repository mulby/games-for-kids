// Treasure Dig models: Miu the temple cat, the dig site, and the treasures hidden in the sand.
// Felt-toy style from shared/toy3d.js. Treasures sit on y=0 and are no taller than about .8 so they fit under the sand.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';

const { mat, ball, bead, capsule, lathe, tube, mesh, geo, freeze } = K;
const GOLD = () => mat('#f2c14e', { metal: true, shine: .25 });
const LAPIS = () => mat('#2f5fb3', { gloss: true });
const TURQ = () => mat('#3cc0b0', { gloss: true });
const CARNELIAN = () => mat('#d9573b', { gloss: true });

function box(m, [w, h, d], p, r = [0, 0, 0]) { return mesh(geo(`bx${w}/${h}/${d}`, () => new THREE.BoxGeometry(w, h, d)), m, p, 1, r); }

/* ------------------------------------------------------------------ Miu */
export function cat() {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const fur = mat('#e9b872', { felt: true }), fur2 = mat('#fff1d6', { felt: true }), stripe = mat('#c98a45', { felt: true });
  body.add(ball(fur, [0, .7, -.1], [.62, .72, .6]));
  body.add(ball(fur2, [0, .75, .35], [.36, .5, .25]));
  for (const sx of [-1, 1]) { body.add(ball(fur, [sx * .3, .12, .35], [.17, .12, .26])); body.add(ball(fur, [sx * .42, .25, -.2], [.3, .25, .4])); }
  for (let i = 0; i < 3; i++) body.add(ball(stripe, [0, 1.05 - i * .22, -.62], [.4 - i * .05, .06, .1]));
  const tail = new THREE.Group(); tail.userData.live = true; tail.name = 'tail'; tail.position.set(.3, .2, -.55); body.add(tail);
  tail.add(tube([[0, 0, 0], [.4, .05, -.2], [.75, .3, -.05], [.85, .65, .2]], .09, fur, 16, 8));
  tail.add(ball(stripe, [.85, .68, .22], .1));
  // gold collar with a blue scarab
  body.add(mesh(geo('catcollar', () => new THREE.TorusGeometry(.33, .06, 8, 28)), GOLD(), [0, 1.28, .02], 1, [Math.PI / 2 - .25, 0, 0]));
  body.add(ball(LAPIS(), [0, 1.2, .36], [.1, .08, .06]));
  const head = new THREE.Group(); head.position.set(0, 1.72, .05); head.userData.live = true; head.name = 'head'; body.add(head);
  head.add(ball(fur, [0, 0, 0], [.55, .48, .48]));
  head.add(ball(fur2, [0, -.14, .32], [.28, .2, .18]));
  head.add(bead(mat('#e98a9c', { gloss: true }), [0, -.06, .48], [.06, .045, .04]));
  for (const sx of [-1, 1]) {
    head.add(mesh(geo('catear', () => new THREE.ConeGeometry(.2, .42, 4)), fur, [sx * .3, .45, -.02], 1, [0, Math.PI / 4, sx * -.3]));
    head.add(mesh(geo('catear2', () => new THREE.ConeGeometry(.12, .28, 4)), mat('#f4b6c0', { felt: true }), [sx * .3, .43, .06], 1, [0, Math.PI / 4, sx * -.3]));
    // big Egyptian eyes with a gold line
    head.add(ball(mat('#7cc06e', { gloss: true }), [sx * .2, .06, .4], [.11, .1, .05]));
    head.add(ball(mat('#1d1a24', { gloss: true }), [sx * .2, .06, .43], [.04, .085, .03]));
    head.add(bead(mat('#ffffff', { glow: .6 }), [sx * .2 + .03, .1, .45], .018));
    head.add(tube([[sx * .08, .14, .44], [sx * .25, .15, .42], [sx * .38, .08, .35]], .015, mat('#1d1a24'), 6, 3));
    for (const dy of [-.03, .03]) head.add(tube([[sx * .12, -.12 + dy, .45], [sx * .35, -.1 + dy * 2, .45], [sx * .55, -.14 + dy * 3, .38]], .006, mat('#8a6a50'), 6, 3));
    head.add(bead(mat('#ffb0b8', { felt: true }), [sx * .3, -.12, .36], [.07, .04, .02]));
    head.add(bead(GOLD(), [sx * .5, -.05, 0], .06));
  }
  for (let i = 0; i < 3; i++) head.add(ball(stripe, [(i - 1) * .12, .38, .2], [.04, .1, .06]));
  Object.assign(root.userData, { body, head, tail, t0: Math.random() * 10, happy: 0 });
  freeze(root);
  return root;
}
export function animateCat(c, t, dt) {
  const u = c.userData, k = t + u.t0;
  u.happy = Math.max(0, u.happy - dt);
  u.body.position.y = u.happy > 0 ? Math.abs(Math.sin(k * 9)) * .3 : Math.sin(k * 1.6) * .02;
  u.head.rotation.z = u.happy > 0 ? Math.sin(k * 8) * .2 : Math.sin(k * .7) * .1;
  u.head.rotation.y = Math.sin(k * .4) * .3;
  u.tail.rotation.y = Math.sin(k * (u.happy > 0 ? 8 : 2)) * .4;
}

/* ------------------------------------------------------------------ scenery */
export function palm(s = 1) {
  const g = new THREE.Group();
  const bark = mat('#a6744a', { felt: true }), bark2 = mat('#8f6038', { felt: true });
  for (let i = 0; i < 9; i++) { const y = i * .55, x = Math.sin(i * .25) * .35 * i / 9; g.add(lathe([[0, 0], [.32 - i * .015, 0], [.36 - i * .015, .3], [.26 - i * .015, .55], [0, .55]], i % 2 ? bark : bark2, 12)); g.children[g.children.length - 1].position.set(x, y, 0); }
  const leaf = mat('#5fae63', { felt: true }), leaf2 = mat('#4c9a52', { felt: true });
  const top = [Math.sin(9 * .25) * .35, 5, 0];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, pts = [];
    for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push([top[0] + Math.cos(a) * t * 2.4, top[1] + Math.sin(t * Math.PI * .8) * .8 - t * t * 1.4, top[2] + Math.sin(a) * t * 2.4]); }
    g.add(tube(pts, .06, mat('#6b8a3a'), 12, 4));
    for (let j = 1; j <= 5; j++) { const p = pts[j]; g.add(ball(j % 2 ? leaf : leaf2, p, [.42 - j * .04, .06, .2], [0, -a, -.3 - j * .1])); }
  }
  for (let i = 0; i < 3; i++) g.add(ball(mat('#8a5a2e', { felt: true }), [top[0] + Math.cos(i * 2) * .25, top[1] - .2, Math.sin(i * 2) * .25], .17));
  g.scale.setScalar(s); freeze(g); return g;
}
export function pyramid(s = 1) {
  const g = new THREE.Group();
  const p = mesh(new THREE.ConeGeometry(1, 1, 4, 1), mat('#e7c27e', { rough: .9, flat: true }), [0, .5, 0], 1, [0, Math.PI / 4, 0]);
  g.add(p);
  g.add(mesh(new THREE.ConeGeometry(.17, .17, 4, 1), GOLD(), [0, .915, 0], 1, [0, Math.PI / 4, 0]));
  g.scale.setScalar(s); freeze(g); return g;
}
export function stoneBlock(w, h, d, tint = '#e3c48a') {
  return K.slab(K.roundRectShape(w, h, .12), d, mat(tint, { felt: true }), .05);
}

/* ------------------------------------------------------------------ treasures */
function scarab() {
  const g = new THREE.Group(), blue = LAPIS();
  g.add(ball(blue, [0, .18, -.1], [.42, .2, .52]));
  g.add(ball(blue, [0, .17, .45], [.24, .14, .18]));
  g.add(mesh(new THREE.BoxGeometry(.02, .05, .9), GOLD(), [0, .37, -.1]));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) g.add(capsule(GOLD(), [sx * .3, .1, -.3 + i * .3], [sx * .62, .06, -.4 + i * .4], .04));
    // golden wings spread out
    g.add(ball(GOLD(), [sx * .78, .1, -.05], [.55, .05, .3], [0, sx * .35, 0]));
    g.add(ball(TURQ(), [sx * .7, .14, -.05], [.32, .04, .18], [0, sx * .35, 0]));
  }
  g.add(ball(CARNELIAN(), [0, .34, .62], [.17, .17, .05], [-.3, 0, 0]));
  return g;
}
function ankh() {
  const g = new THREE.Group(), gold = GOLD();
  g.add(mesh(new THREE.TorusGeometry(.26, .09, 10, 28), gold, [0, .1, -.42], [1, 1.3, 1], [Math.PI / 2, 0, 0]));
  g.add(capsule(gold, [-.45, .1, -.02], [.45, .1, -.02], .09));
  g.add(capsule(gold, [0, .1, -.02], [0, .1, .75], .1));
  g.add(ball(TURQ(), [0, .18, -.02], .1));
  return g;
}
function catStatue() {
  const g = new THREE.Group(), black = mat('#2b2838', { gloss: true }), gold = GOLD();
  // lying on her side in the sand
  const s = new THREE.Group(); s.rotation.z = Math.PI / 2; s.position.set(.35, .28, 0); g.add(s);
  s.add(box(gold, [.55, .1, .6], [0, 0, 0]));
  s.add(ball(black, [0, .45, -.05], [.25, .38, .26]));
  s.add(ball(black, [0, .95, .02], [.2, .18, .18]));
  for (const sx of [-1, 1]) { s.add(mesh(new THREE.ConeGeometry(.08, .2, 4), black, [sx * .11, 1.13, 0], 1, [0, Math.PI / 4, sx * -.2])); s.add(bead(gold, [sx * .19, .93, .04], .04)); }
  s.add(mesh(new THREE.TorusGeometry(.2, .03, 6, 20), gold, [0, .74, .02], 1, [Math.PI / 2, 0, 0]));
  s.add(tube([[.15, .15, -.2], [.3, .1, 0], [.2, .08, .25]], .04, black, 8, 5));
  return g;
}
function eyeAmulet() {
  const g = new THREE.Group();
  g.add(K.slab(K.roundRectShape(1.2, .8, .3), .14, GOLD(), .04)); g.children[0].rotation.x = -Math.PI / 2; g.children[0].position.y = .1;
  g.add(ball(mat('#ffffff', { gloss: true }), [0, .2, 0], [.36, .04, .2]));
  g.add(ball(LAPIS(), [0, .23, 0], [.15, .04, .15]));
  g.add(tube([[-.45, .22, -.05], [0, .23, -.26], [.45, .22, -.05]], .035, LAPIS(), 12, 5));
  g.add(tube([[-.4, .22, .1], [0, .23, .24], [.42, .22, .08]], .03, LAPIS(), 12, 5));
  g.add(tube([[0, .22, .24], [-.05, .22, .36], [-.2, .22, .34]], .03, LAPIS(), 8, 5));
  g.add(tube([[-.4, .25, -.3], [0, .25, -.42], [.42, .25, -.3]], .035, LAPIS(), 12, 5));
  return g;
}
function goldenMask() {
  const g = new THREE.Group(), gold = GOLD(), blue = LAPIS();
  const m = new THREE.Group(); m.rotation.x = -Math.PI / 2; m.position.y = .2; g.add(m);
  m.add(ball(gold, [0, 0, 0], [.42, .52, .2]));
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) m.add(ball(i % 2 ? blue : gold, [sx * (.5 + i * .02), .15 - i * .18, -.05], [.2, .1, .14]));
  m.add(ball(gold, [0, .48, -.02], [.55, .2, .2]));
  for (const sx of [-1, 1]) { m.add(ball(mat('#ffffff', { gloss: true }), [sx * .15, .1, .17], [.09, .05, .03])); m.add(bead(mat('#1d1a24', { gloss: true }), [sx * .15, .1, .19], .035)); }
  m.add(ball(gold, [0, -.08, .2], [.06, .1, .06]));
  m.add(capsule(blue, [0, -.55, .05], [0, -.8, .02], .06));
  m.add(ball(TURQ(), [0, .62, .12], [.07, .1, .05]));
  return g;
}
function lotus() {
  const g = new THREE.Group(), pink = mat('#f6a6bd', { felt: true }), white = mat('#fff4f7', { felt: true });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(ball(i % 2 ? pink : white, [Math.cos(a) * .32, .25, Math.sin(a) * .32], [.15, .12, .3], [.6, -a + Math.PI / 2, 0])); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3; g.add(ball(pink, [Math.cos(a) * .15, .4, Math.sin(a) * .15], [.1, .2, .14], [.3, -a + Math.PI / 2, 0])); }
  g.add(ball(mat('#ffd86b', { felt: true }), [0, .45, 0], .1));
  g.add(ball(mat('#5fae63', { felt: true }), [0, .08, 0], [.55, .05, .55]));
  return g;
}
function jar() {
  const g = new THREE.Group();
  const j = new THREE.Group(); j.rotation.z = Math.PI / 2; j.position.set(.45, .32, 0); g.add(j);
  j.add(lathe([[0, 0], [.2, 0], [.3, .2], [.32, .5], [.22, .75], [.24, .8], [0, .8]], mat('#f3e6cf', { gloss: true }), 20));
  j.add(mesh(new THREE.TorusGeometry(.31, .03, 6, 20), LAPIS(), [0, .45, 0], 1, [Math.PI / 2, 0, 0]));
  j.add(ball(mat('#2b2838', { felt: true }), [0, .95, 0], [.2, .17, .2]));
  j.add(ball(mat('#2b2838', { felt: true }), [0, .95, .15], [.08, .07, .15]));
  for (const sx of [-1, 1]) j.add(mesh(new THREE.ConeGeometry(.06, .2, 4), mat('#2b2838', { felt: true }), [sx * .1, 1.12, -.02], 1, [0, 0, sx * -.2]));
  return g;
}
function necklace() {
  const g = new THREE.Group(), cols = [GOLD(), TURQ(), CARNELIAN(), LAPIS()];
  for (let row = 0; row < 3; row++) {
    const r = .45 + row * .17, n = 11 + row * 3;
    for (let i = 0; i <= n; i++) { const a = Math.PI * (i / n); g.add(ball(cols[(i + row) % 4], [Math.cos(a) * r, .1, Math.sin(a) * r - .25], [.08, .08, .1 + row * .02])); }
  }
  g.add(mesh(new THREE.TorusGeometry(.45, .03, 6, 30, Math.PI), GOLD(), [0, .1, -.25], 1, [-Math.PI / 2, 0, 0]));
  return g;
}
function ring() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(.35, .1, 10, 30), GOLD(), [0, .1, 0], 1, [Math.PI / 2, 0, 0]));
  g.add(ball(CARNELIAN(), [0, .22, .38], [.2, .14, .16]));
  g.add(bead(mat('#ffffff', { glow: .6 }), [-.06, .3, .44], .04));
  return g;
}
function scroll() {
  const g = new THREE.Group(), pap = mat('#f0dca8', { felt: true });
  g.add(mesh(new THREE.CylinderGeometry(.17, .17, 1.2, 16), pap, [0, .17, -.25], 1, [0, 0, Math.PI / 2]));
  g.add(box(pap, [1.15, .03, .6], [0, .03, .1]));
  for (let i = 0; i < 4; i++) g.add(box(mat(i % 2 ? '#2f5fb3' : '#b84a3a', { felt: true }), [.12, .02, .12], [-.35 + i * .23, .055, .15]));
  g.add(box(mat('#3a2f2a', { felt: true }), [.7, .02, .03], [0, .055, .3]));
  for (const x of [-.62, .62]) g.add(mesh(new THREE.CylinderGeometry(.08, .08, .1, 10), mat('#a6744a', { gloss: true }), [x, .17, -.25], 1, [0, 0, Math.PI / 2]));
  return g;
}
function sphinx() {
  const g = new THREE.Group(), stone = mat('#e7c27e', { felt: true }), blue = LAPIS();
  g.add(K.slab(K.roundRectShape(.6, 1.3, .1), .3, stone, .05)); g.children[0].rotation.x = -Math.PI / 2; g.children[0].position.y = .18;
  g.add(ball(stone, [0, .35, -.15], [.32, .25, .55]));
  for (const sx of [-1, 1]) g.add(ball(stone, [sx * .17, .2, .45], [.09, .08, .28]));
  g.add(ball(stone, [0, .68, .25], [.2, .22, .2]));
  g.add(ball(blue, [0, .72, .2], [.27, .2, .2]));
  for (const sx of [-1, 1]) g.add(ball(blue, [sx * .22, .55, .22], [.08, .2, .1]));
  g.add(ball(stone, [0, .66, .4], [.14, .15, .08]));
  return g;
}
function gem() {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color: '#3cc0b0', roughness: .05, metalness: 0, clearcoat: 1, emissive: '#1a8a7a', emissiveIntensity: .25, flatShading: true });
  g.add(mesh(new THREE.OctahedronGeometry(.42, 0), m, [0, .38, 0], [1, 1.1, 1]));
  g.add(mesh(new THREE.TorusGeometry(.3, .05, 6, 20), GOLD(), [0, .2, 0], 1, [Math.PI / 2, 0, 0]));
  return g;
}
function tinyPyramid() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(.55, .65, 4), mat('#f2c14e', { metal: true, shine: .2 }), [0, .32, 0], 1, [0, Math.PI / 4, 0]));
  g.add(mesh(new THREE.ConeGeometry(.15, .18, 4), mat('#3cc0b0', { gloss: true }), [0, .58, 0], 1, [0, Math.PI / 4, 0]));
  return g;
}

export const TREASURES = [
  { id: 'scarab', name: 'a golden scarab', make: scarab, r: .75 },
  { id: 'ankh', name: 'an ankh, the sign of life', make: ankh, r: .6 },
  { id: 'cat', name: 'a cat statue, just like me', make: catStatue, r: .7 },
  { id: 'eye', name: 'the magic Eye amulet', make: eyeAmulet, r: .65 },
  { id: 'lotus', name: 'a lotus flower', make: lotus, r: .55 },
  { id: 'jar', name: 'a jackal jar', make: jar, r: .7 },
  { id: 'necklace', name: 'a jewel necklace', make: necklace, r: .75 },
  { id: 'ring', name: "Pharaoh's ring", make: ring, r: .5 },
  { id: 'scroll', name: 'a papyrus scroll', make: scroll, r: .7 },
  { id: 'gem', name: 'a shining gem', make: gem, r: .45 },
  { id: 'pyramid', name: 'a little gold pyramid', make: tinyPyramid, r: .55 },
  { id: 'sphinx', name: 'a tiny sphinx', make: sphinx, r: .75, rare: true },
  { id: 'mask', name: "Pharaoh's golden mask", make: goldenMask, r: .7, rare: true }
];
export function treasure(id) {
  const t = TREASURES.find(x => x.id === id);
  const g = t.make(); freeze(g); g.userData.t = t;
  return g;
}
