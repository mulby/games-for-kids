// Mouse House models: Hazel the mouse and everything she can put in her room.
// Built from the shared felt-toy kit (shared/toy3d.js) so it matches the other games. 1 unit is about 1/2 a mouse.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';

const { mat, ball, bead, capsule, lathe, tube, mesh, geo, freeze } = K;

// soft rounded box, w x h x d, sitting with its center at p
export function rbox(m, [w, h, d], p = [0, 0, 0], r = [0, 0, 0], bev = .06) {
  bev = Math.min(bev, w / 3, h / 3, d / 3);
  const g = geo(`rb${w.toFixed(2)}/${h.toFixed(2)}/${d.toFixed(2)}/${bev.toFixed(3)}`, () => {
    const s = K.roundRectShape(w - bev * 2, h - bev * 2, bev * 1.5);
    const x = new THREE.ExtrudeGeometry(s, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 6 });
    x.translate(0, 0, -(d - bev * 2) / 2);
    return x;
  });
  return mesh(g, m, p, 1, r);
}
const cyl = (m, rt, rb, h, p, seg = 24, r = [0, 0, 0]) => mesh(geo(`cy${rt}/${rb}/${h}/${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), m, p, 1, r);

const WOOD = '#c48a55', WOOD2 = '#a8703f', CREAM = '#fff4e0';

/* ------------------------------------------------------------------ Hazel the mouse */
export function mouse({ fur = '#cdbcae', dress = '#f2a7b5', dot = '#ffffff', collar = '#fff4e0' } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const furM = mat(fur, { felt: true }), pink = mat('#f4b6c0', { felt: true }), dm = mat(dress, { felt: true });
  // legs and feet peek out under the dress
  for (const sx of [-1, 1]) {
    body.add(capsule(furM, [sx * .16, .12, 0], [sx * .16, .4, 0], .07));
    body.add(ball(furM, [sx * .17, .07, .1], [.11, .07, .18]));
  }
  body.add(lathe([[0, 1.2], [.24, 1.17], [.32, 1.02], [.44, .6], [.56, .32], [.58, .26], [0, .26]], dm, 30));
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = .4 + (i % 5) * .15, rr = .56 - (y - .3) * .4;
    body.add(bead(mat(dot, { felt: true }), [Math.sin(a) * rr, y, Math.cos(a) * rr], [.045, .045, .02]));
  }
  body.add(mesh(geo('mcollar', () => new THREE.TorusGeometry(.2, .05, 6, 20)), mat(collar, { felt: true }), [0, 1.18, 0], 1, [Math.PI / 2, 0, 0]));
  const armL = new THREE.Group(); armL.position.set(-.27, 1.08, 0); armL.userData.live = true; armL.name = 'armL';
  armL.add(capsule(furM, [0, 0, 0], [-.12, -.42, .08], .055)); armL.add(bead(pink, [-.13, -.47, .09], .06));
  const armR = new THREE.Group(); armR.position.set(.27, 1.08, 0); armR.userData.live = true; armR.name = 'armR';
  armR.add(capsule(furM, [0, 0, 0], [.12, -.42, .08], .055)); armR.add(bead(pink, [.13, -.47, .09], .06));
  body.add(armL, armR);
  // tail: long and thin, curling up behind
  body.add(tube([[0, .35, -.45], [0, .2, -.8], [.15, .18, -1.15], [.35, .35, -1.3], [.45, .6, -1.2], [.38, .75, -1.05]], .028, pink, 24, 5));
  const head = new THREE.Group(); head.position.set(0, 1.52, 0); head.userData.live = true; head.name = 'head'; body.add(head);
  head.add(ball(furM, [0, 0, 0], [.36, .34, .36]));
  head.add(ball(furM, [0, -.07, .3], [.2, .17, .3]));
  head.add(bead(mat('#e98a9c', { gloss: true }), [0, -.04, .6], .07));
  const ink = mat('#2b2230', { gloss: true }), shine = mat('#ffffff', { glow: .6 });
  for (const sx of [-1, 1]) {
    head.add(bead(ink, [sx * .15, .06, .3], [.045, .055, .03]));
    head.add(bead(shine, [sx * .15 + .015, .085, .325], .012));
    // big round ears
    head.add(ball(furM, [sx * .3, .33, -.04], [.25, .25, .05], [0, sx * -.3, sx * -.25]));
    head.add(ball(pink, [sx * .3, .33, .0], [.18, .18, .03], [0, sx * -.3, sx * -.25]));
    for (const dy of [-.03, .03]) head.add(tube([[sx * .1, -.08 + dy, .5], [sx * .3, -.06 + dy * 2, .52], [sx * .48, -.1 + dy * 3, .45]], .006, mat('#8a7a70'), 6, 3));
    head.add(bead(mat('#ff9fb3', { felt: true }), [sx * .2, -.1, .3], [.05, .03, .02]));
  }
  head.add(tube([[-.05, -.16, .48], [0, -.19, .5], [.05, -.16, .48]], .01, ink, 6, 3));
  // a bow on one ear
  const bowM = mat(dress, { felt: true });
  for (const sx of [-1, 1]) head.add(ball(bowM, [-.18 + sx * .09, .38, .12], [.09, .06, .04], [0, 0, sx * .5]));
  head.add(bead(bowM, [-.18, .38, .14], .04));
  Object.assign(root.userData, { kind: 'mouse', body, head, armL, armR, t0: Math.random() * 10, walk: 0, hop: 0 });
  freeze(root);
  return root;
}
export function animateMouse(m, t, dt) {
  const u = m.userData, k = t + u.t0;
  u.hop = Math.max(0, u.hop - dt * 1.8);
  const hopY = Math.sin(u.hop * Math.PI) * 1.2 * (u.hop > 0 ? 1 : 0);
  if (u.walk > 0) {
    u.body.position.y = Math.abs(Math.sin(k * 9)) * .12 + hopY;
    u.body.rotation.z = Math.sin(k * 9) * .08;
    u.armL.rotation.x = Math.sin(k * 9) * .5; u.armR.rotation.x = -Math.sin(k * 9) * .5;
  } else {
    u.body.position.y = Math.sin(k * 2) * .02 + hopY;
    u.body.rotation.z = Math.sin(k * 1.1) * .03;
    u.armL.rotation.x = 0; u.armR.rotation.x = u.hop > 0 ? -2.4 : Math.sin(k * 1.5) * .1;
  }
  u.armL.rotation.z = u.hop > 0 ? -.8 : 0; u.armR.rotation.z = u.hop > 0 ? .8 : 0;
  u.head.rotation.z = Math.sin(k * .8) * .1; u.head.rotation.y = Math.sin(k * .5) * .25;
}

/* ------------------------------------------------------------------ furniture */
// Each item: { id, name, make() } ; models sit on y=0 and face +z.
function bed() {
  const g = new THREE.Group(), w = mat(WOOD, { gloss: true }), w2 = mat(WOOD2, { gloss: true });
  g.add(rbox(w, [3.2, .45, 1.9], [0, .45, 0]));
  for (const [x, z] of [[-1.5, -.85], [1.5, -.85], [-1.5, .85], [1.5, .85]]) g.add(cyl(w2, .09, .07, .3, [x, .15, z], 10));
  g.add(rbox(w, [.2, 1.5, 1.9], [-1.6, .85, 0], [0, 0, 0], .08));
  g.add(ball(w, [-1.6, 1.65, 0], [.12, .22, .95]));
  g.add(rbox(w, [.2, .9, 1.9], [1.6, .6, 0]));
  g.add(rbox(mat('#ffffff', { felt: true }), [2.95, .3, 1.75], [0, .8, 0], [0, 0, 0], .12));
  // patchwork quilt
  const cols = ['#f2a7b5', '#b9a6e8', '#ffe08a', '#a9d4ff', '#b8f0c8', '#ffc4a8'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(rbox(mat(cols[(i + j * 2) % cols.length], { felt: true }), [.5, .12, .58], [.05 + i * .52 - .4, .98, -.58 + j * .58], [0, 0, 0], .04));
  g.add(ball(mat('#fff8ee', { felt: true }), [-1.15, 1.08, 0], [.32, .16, .6]));
  return g;
}
function armchair(color = '#e48aa0') {
  const g = new THREE.Group(), f = mat(color, { felt: true }), f2 = mat(K.lighten(color, .08), { felt: true }), w = mat(WOOD2, { gloss: true });
  for (const [x, z] of [[-.6, -.5], [.6, -.5], [-.6, .5], [.6, .5]]) g.add(cyl(w, .07, .05, .3, [x, .15, z], 8));
  g.add(rbox(f, [1.6, .5, 1.3], [0, .5, 0], [0, 0, 0], .15));
  g.add(rbox(f2, [1.15, .25, 1.0], [0, .85, .1], [0, 0, 0], .12));
  g.add(rbox(f, [1.6, 1.3, .35], [0, 1.15, -.55], [-.12, 0, 0], .17));
  for (const sx of [-1, 1]) g.add(capsule(f, [sx * .72, .95, -.5], [sx * .72, .95, .55], .2));
  for (let i = 0; i < 3; i++) g.add(bead(mat('#fff4e0', { felt: true }), [-.4 + i * .4, 1.3, -.37], .06));
  return g;
}
function table() {
  const g = new THREE.Group(), w = mat(WOOD, { gloss: true });
  g.add(cyl(w, 1, 1, .12, [0, 1.2, 0], 32));
  g.add(cyl(mat('#ffffff', { felt: true }), 1.08, 1.12, .3, [0, 1.08, 0], 32));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(bead(mat('#f2a7b5', { felt: true }), [Math.cos(a) * 1.12, .94, Math.sin(a) * 1.12], .06)); }
  g.add(cyl(w, .1, .14, 1.1, [0, .55, 0], 12));
  g.add(cyl(w, .5, .55, .1, [0, .05, 0], 20));
  g.add(lathe([[0, 1.28], [.12, 1.28], [.16, 1.36], [.1, 1.5], [.06, 1.6], [0, 1.6]], mat('#a9d4ff', { gloss: true }), 14));
  for (let i = 0; i < 3; i++) { const a = i * 2.1; g.add(bead(mat(['#f6a6bd', '#ffd86b', '#ffffff'][i], { felt: true }), [Math.cos(a) * .08, 1.68, Math.sin(a) * .08], .07)); }
  return g;
}
function chair() {
  const g = new THREE.Group(), w = mat('#e6c18f', { gloss: true }), c = mat('#b9a6e8', { felt: true });
  for (const [x, z] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) g.add(cyl(w, .05, .05, .8, [x, .4, z], 8));
  g.add(rbox(w, [1, .1, 1], [0, .82, 0]));
  g.add(rbox(c, [.85, .12, .85], [0, .92, .02], [0, 0, 0], .05));
  for (const x of [-.4, .4]) g.add(cyl(w, .05, .05, 1, [x, 1.35, -.45], 8));
  g.add(rbox(w, [.95, .35, .08], [0, 1.65, -.45]));
  const heart = K.slab(K.heartShape(), .06, mat('#f2a7b5', { felt: true })); heart.position.set(0, 1.65, -.4); heart.scale.setScalar(.12); g.add(heart);
  return g;
}
function lamp() {
  const g = new THREE.Group(), brass = mat('#d1a65a', { metal: true });
  g.add(cyl(brass, .35, .4, .08, [0, .04, 0], 20));
  g.add(cyl(brass, .04, .04, 2.4, [0, 1.25, 0], 8));
  const shadeM = new THREE.MeshStandardMaterial({ color: '#ffe6b3', emissive: '#ffcf7a', emissiveIntensity: .25, roughness: .8, side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(.33, .62, .65, 24, 1, true), shadeM, [0, 2.6, 0]));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(bead(mat('#f2a7b5', { felt: true }), [Math.cos(a) * .62, 2.27, Math.sin(a) * .62], .045)); }
  const halo = K.glow('#ffd88a', 3, 0); halo.position.y = 2.5; halo.name = 'halo'; g.add(halo);
  g.userData.lamp = { shadeM };
  return g;
}
function plant() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.32, 0], [.42, .65], [.48, .7], [.46, .78], [0, .78]], mat('#d9774f', { felt: true }), 20));
  g.add(cyl(mat('#5a3d2a'), .4, .4, .05, [0, .74, 0], 16));
  const lf = mat('#5fae63', { felt: true }), lf2 = mat('#7cc06e', { felt: true });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, h = 1.1 + (i % 3) * .35, r = .3 + (i % 2) * .15;
    g.add(tube([[0, .75, 0], [Math.cos(a) * r * .5, h * .8, Math.sin(a) * r * .5], [Math.cos(a) * r, h, Math.sin(a) * r]], .025, mat('#4c8a4f'), 6, 4));
    g.add(ball(i % 2 ? lf : lf2, [Math.cos(a) * r, h + .05, Math.sin(a) * r], [.2, .08, .32], [0, -a, .4]));
  }
  return g;
}
function rug() {
  const g = new THREE.Group();
  ['#b9a6e8', '#ffe08a', '#f2a7b5', '#a9d4ff', '#fff4e0'].forEach((c, i) => g.add(cyl(mat(c, { felt: true }), 2.1 - i * .4, 2.1 - i * .4, .04, [0, .02 + i * .006, 0], 40)));
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; g.add(bead(mat('#fff4e0', { felt: true }), [Math.cos(a) * 2.15, .03, Math.sin(a) * 2.15], [.07, .03, .07])); }
  g.userData.flat = true;
  return g;
}
function bookshelf() {
  const g = new THREE.Group(), w = mat('#9cc7b5', { gloss: true });
  g.add(rbox(w, [1.8, .12, .7], [0, .1, 0])); g.add(rbox(w, [1.8, .12, .7], [0, 2.6, 0]));
  for (const x of [-.85, .85]) g.add(rbox(w, [.12, 2.6, .7], [x, 1.35, 0]));
  g.add(rbox(mat('#7fb3a0', { gloss: true }), [1.7, 2.5, .06], [0, 1.35, -.33]));
  for (const y of [.95, 1.8]) g.add(rbox(w, [1.6, .08, .6], [0, y, 0]));
  const cols = ['#e2566b', '#ffd86b', '#5a77c9', '#f2a7b5', '#7cc06e', '#b9a6e8', '#ff9f5a'];
  [.17, 1.0, 1.85].forEach((y, row) => {
    let x = -.72;
    for (let i = 0; x < .6; i++) {
      const bw = .12 + ((i + row) % 3) * .04, bh = .5 + ((i * 7 + row) % 4) * .08;
      g.add(rbox(mat(cols[(i + row * 3) % cols.length], { felt: true }), [bw, bh, .45], [x + bw / 2, y + bh / 2, .02], [0, 0, i === 3 ? -.25 : 0], .02));
      x += bw + .02;
    }
  });
  return g;
}
function cake() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.35, 0], [.12, .1], [.08, .45], [.6, .5], [.6, .55], [0, .55]], mat('#ffffff', { gloss: true }), 24));
  g.add(cyl(mat('#ffe0b8', { felt: true }), .5, .5, .35, [0, .73, 0], 28));
  g.add(cyl(mat('#f6a6bd', { felt: true }), .52, .52, .1, [0, .93, 0], 28));
  g.add(cyl(mat('#ffe0b8', { felt: true }), .38, .38, .3, [0, 1.12, 0], 28));
  g.add(cyl(mat('#ffffff', { felt: true }), .4, .4, .08, [0, 1.3, 0], 28));
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.add(bead(mat('#ffffff', { felt: true }), [Math.cos(a) * .5, .98, Math.sin(a) * .5], .07)); }
  g.add(ball(mat('#e2566b', { gloss: true }), [0, 1.45, 0], [.13, .15, .13]));
  g.add(ball(mat('#5fae63', { felt: true }), [0, 1.6, 0], [.08, .03, .05]));
  for (let i = 0; i < 12; i++) { const a = i * 2.39; g.add(bead(mat(['#ffd86b', '#a9d4ff', '#b8f0c8'][i % 3], { gloss: true }), [Math.cos(a) * .25, 1.35, Math.sin(a) * .25], [.04, .02, .02], [0, a, 0])); }
  return g;
}
function dresser() {
  const g = new THREE.Group(), w = mat('#f2c6d0', { gloss: true }), k = mat('#d1a65a', { metal: true });
  g.add(rbox(w, [1.9, 1.7, 1], [0, .95, 0], [0, 0, 0], .08));
  g.add(rbox(mat('#fff4e0', { gloss: true }), [2.05, .12, 1.1], [0, 1.85, 0]));
  for (let i = 0; i < 3; i++) {
    g.add(rbox(mat('#f8dbe1', { gloss: true }), [1.6, .42, .08], [0, .45 + i * .5, .5]));
    for (const x of [-.4, .4]) g.add(bead(k, [x, .45 + i * .5, .57], .06));
  }
  for (const x of [-.8, .8]) for (const z of [-.4, .4]) g.add(ball(mat(WOOD2), [x, .06, z], .08));
  // a little mirror on top
  g.add(rbox(mat('#d1a65a', { metal: true }), [.8, 1, .08], [0, 2.4, -.3], [0, 0, 0], .04));
  g.add(rbox(new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', metalness: .9, roughness: .05 }), [.66, .86, .04], [0, 2.4, -.25], [0, 0, 0], .02));
  return g;
}
function teddy() {
  const g = new THREE.Group(), f = mat('#c48a55', { felt: true }), l = mat('#f0d2a8', { felt: true });
  g.add(ball(f, [0, .45, 0], [.4, .45, .35]));
  g.add(ball(l, [0, .42, .25], [.24, .28, .12]));
  for (const sx of [-1, 1]) { g.add(ball(f, [sx * .28, .12, .2], [.15, .13, .22])); g.add(ball(f, [sx * .4, .55, .05], [.12, .22, .12], [0, 0, sx * .5])); }
  g.add(ball(f, [0, 1.05, 0], [.33, .3, .3]));
  g.add(ball(l, [0, .98, .25], [.14, .1, .1]));
  g.add(bead(mat('#3a2a20', { gloss: true }), [0, 1.02, .34], .045));
  for (const sx of [-1, 1]) { g.add(ball(f, [sx * .25, 1.3, 0], [.11, .11, .06])); g.add(bead(mat('#2b2230', { gloss: true }), [sx * .11, 1.1, .27], .035)); }
  for (const sx of [-1, 1]) g.add(ball(mat('#e2566b', { felt: true }), [sx * .12, .78, .26], [.12, .08, .06], [0, 0, sx * .5]));
  return g;
}
function cheese() {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.6, 0); s.lineTo(0, 1.1); s.lineTo(0, 0);
  // a standing wedge: the triangle lies in the x-z plane, extruded up
  const wedge = new THREE.ExtrudeGeometry(s, { depth: .8, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2 });
  wedge.rotateX(-Math.PI / 2); wedge.translate(-.6, .05, .45);
  g.add(new THREE.Mesh(wedge, mat('#ffd35a', { felt: true })));
  const hole = mat('#e8b23a', { felt: true });
  [[-.2, .3, .5], [.3, .55, .5], [-.4, .6, .2], [.1, .2, .5]].forEach(([x, y, z]) => g.add(ball(hole, [x, y, z], [.12, .12, .03])));
  [[-.2, .86, -.1], [.1, .86, .1]].forEach(([x, y, z]) => g.add(ball(hole, [x, y, z], [.1, .02, .1])));
  return g;
}
function vase() {
  const g = new THREE.Group();
  g.add(cyl(mat(WOOD, { gloss: true }), .5, .5, .9, [0, .45, 0], 20));
  g.add(lathe([[0, .9], [.18, .9], [.28, 1.15], [.22, 1.5], [.13, 1.65], [.16, 1.75], [0, 1.75]], mat('#a9d4ff', { gloss: true }), 20));
  const cols = ['#f6a6bd', '#ffd86b', '#ffffff', '#b9a6e8', '#ff9f5a'];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, x = Math.cos(a) * .25, z = Math.sin(a) * .25, y = 2.2 + (i % 2) * .25;
    g.add(tube([[0, 1.6, 0], [x * .5, y - .3, z * .5], [x, y, z]], .02, mat('#4c8a4f'), 6, 4));
    for (let p = 0; p < 5; p++) { const b = p / 5 * Math.PI * 2; g.add(bead(mat(cols[i], { felt: true }), [x + Math.cos(b) * .09, y, z + Math.sin(b) * .09], [.07, .03, .07])); }
    g.add(bead(mat('#ffe08a', { felt: true }), [x, y + .02, z], .04));
  }
  return g;
}
function bathtub() {
  const g = new THREE.Group(), white = mat('#ffffff', { gloss: true }), gold = mat('#d1a65a', { metal: true });
  const tub = lathe([[0, .25], [.9, .25], [1.0, .5], [1.05, 1.1], [1.12, 1.15], [1.0, 1.15], [.92, .6], [0, .55]], white, 32); tub.scale.set(1.5, 1, .85); g.add(tub);
  for (const [x, z] of [[-1.1, -.5], [1.1, -.5], [-1.1, .5], [1.1, .5]]) g.add(ball(gold, [x, .15, z], [.12, .18, .12]));
  g.add(cyl(mat('#bfe6ff', { gloss: true }), 1.35, 1.35, .05, [0, .95, 0], 32, [0, 0, 0])); g.children[g.children.length - 1].scale.set(1, 1, .7);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = .3 + (i % 4) * .2; g.add(ball(mat('#ffffff', { felt: true }), [Math.cos(a) * r * 1.3, 1.05 + (i % 3) * .05, Math.sin(a) * r * .55], .12 + (i % 3) * .05)); }
  g.add(capsule(gold, [1.5, 1.1, 0], [1.5, 1.6, 0], .05)); g.add(capsule(gold, [1.5, 1.6, 0], [1.25, 1.65, 0], .05));
  // a rubber duck
  const duck = mat('#ffd35a', { gloss: true });
  g.add(ball(duck, [-.6, 1.12, .1], [.2, .14, .16])); g.add(ball(duck, [-.48, 1.3, .1], .1)); g.add(ball(mat('#ff9f5a', { gloss: true }), [-.37, 1.29, .1], [.06, .03, .05]));
  return g;
}
function teaset() {
  const g = new THREE.Group(), pot = mat('#ffffff', { gloss: true }), rose = mat('#f2a7b5', { gloss: true });
  g.add(rbox(mat('#d1a65a', { metal: true }), [1.6, .08, 1], [0, .04, 0], [0, 0, 0], .03));
  g.add(lathe([[0, .08], [.25, .08], [.38, .25], [.38, .45], [.25, .6], [.12, .62], [.12, .66], [0, .66]], pot, 24));
  g.add(ball(rose, [0, .7, 0], .06));
  g.add(tube([[.33, .3, 0], [.5, .4, 0], [.58, .55, 0]], .04, pot, 8, 6));
  g.add(mesh(new THREE.TorusGeometry(.14, .035, 6, 14), pot, [-.4, .4, 0]));
  g.add(mesh(new THREE.TorusGeometry(.38, .02, 6, 28), rose, [0, .42, 0], 1, [Math.PI / 2, 0, 0]));
  for (const x of [-.55, .55]) {
    g.add(lathe([[0, .08], [.1, .08], [.17, .14], [.2, .3], [0, .2]], pot, 16)); g.children[g.children.length - 1].position.set(x, 0, .25);
    g.add(cyl(rose, .26, .26, .02, [x, .09, .25], 18));
  }
  return g;
}
function piano() {
  const g = new THREE.Group(), w = mat('#5a77c9', { gloss: true }), white = mat('#ffffff', { gloss: true }), black = mat('#2b2230', { gloss: true });
  g.add(rbox(w, [2.2, 1.9, .8], [0, 1.15, -.1], [0, 0, 0], .08));
  g.add(rbox(w, [2.2, .2, .55], [0, 1.0, .5]));
  for (const x of [-1, 1]) g.add(rbox(w, [.15, .9, .2], [x, .45, .55]));
  for (let i = 0; i < 12; i++) g.add(rbox(white, [.15, .06, .4], [-.88 + i * .16, 1.13, .55], [0, 0, 0], .02));
  [0, 1, 3, 4, 5, 7, 8, 10].forEach(i => g.add(rbox(black, [.08, .06, .22], [-.8 + i * .16, 1.18, .45], [0, 0, 0], .02)));
  g.add(rbox(mat('#fff4e0', { felt: true }), [.7, .5, .05], [0, 1.65, .32], [-.2, 0, 0], .02));
  for (const x of [-.8, .8]) { g.add(cyl(mat('#d1a65a', { metal: true }), .07, .07, .12, [x, 2.15, 0], 10)); g.add(K.glow('#ffd88a', .6, .8)); g.children[g.children.length - 1].position.set(x, 2.3, 0); }
  return g;
}
function gift() {
  const g = new THREE.Group(), box = mat('#b9a6e8', { felt: true }), rib = mat('#ffd86b', { felt: true });
  const base = new THREE.Group(); base.name = 'base'; g.add(base);
  base.add(rbox(box, [1.2, 1, 1.2], [0, .5, 0], [0, 0, 0], .06));
  base.add(rbox(rib, [.22, 1.02, 1.22], [0, .5, 0], [0, 0, 0], .02)); base.add(rbox(rib, [1.22, 1.02, .22], [0, .5, 0], [0, 0, 0], .02));
  const lid = new THREE.Group(); lid.name = 'lid'; lid.position.y = 1.0; lid.userData.live = true; g.add(lid);
  lid.add(rbox(box, [1.35, .28, 1.35], [0, .1, 0], [0, 0, 0], .06));
  lid.add(rbox(rib, [.24, .3, 1.37], [0, .1, 0], [0, 0, 0], .02)); lid.add(rbox(rib, [1.37, .3, .24], [0, .1, 0], [0, 0, 0], .02));
  for (const sx of [-1, 1]) lid.add(ball(rib, [sx * .22, .36, 0], [.24, .14, .1], [0, 0, sx * .5]));
  lid.add(ball(rib, [0, .32, 0], .1));
  g.userData.lid = lid;
  freeze(g);
  return g;
}
export { gift };

export const ITEMS = [
  { id: 'bed', name: 'cozy bed', make: bed, r: 1.8 },
  { id: 'table', name: 'round table', make: table, r: 1.1 },
  { id: 'chair', name: 'little chair', make: chair, r: .6 },
  { id: 'rug', name: 'rainbow rug', make: rug, r: 0, flat: true },
  { id: 'plant', name: 'leafy plant', make: plant, r: .5 },
  { id: 'lamp', name: 'glowing lamp', make: lamp, r: .5 },
  { id: 'armchair', name: 'squishy armchair', make: () => armchair('#e48aa0'), r: 1 },
  { id: 'cake', name: 'strawberry cake', make: cake, r: .6 },
  { id: 'bookshelf', name: 'bookshelf', make: bookshelf, r: 1 },
  { id: 'teddy', name: 'teddy bear', make: teddy, r: .5 },
  { id: 'teaset', name: 'tea set', make: teaset, r: .8 },
  { id: 'cheese', name: 'big cheese', make: cheese, r: .7 },
  { id: 'dresser', name: 'pink dresser', make: dresser, r: 1.1 },
  { id: 'vase', name: 'flower stand', make: vase, r: .5 },
  { id: 'bathtub', name: 'bubble bath', make: bathtub, r: 1.6 },
  { id: 'piano', name: 'little piano', make: piano, r: 1.2 },
  { id: 'bluechair', name: 'blue armchair', make: () => armchair('#8fb8e8'), r: 1 }
];
export const STARTERS = ['bed', 'table', 'chair', 'rug', 'plant', 'lamp'];
export function build(id) {
  const it = ITEMS.find(x => x.id === id); if (!it) return null;
  const g = it.make(); freeze(g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
  g.userData.item = it;
  return g;
}

/* ------------------------------------------------------------------ the room */
function patternTex(kind, base, ink) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 128, 128); x.fillStyle = ink; x.strokeStyle = ink;
  if (kind === 'dots') { for (const [a, b] of [[32, 32], [96, 96], [96, 32], [32, 96]]) { x.beginPath(); x.arc(a, b, (a + b) % 64 ? 7 : 10, 0, 7); x.fill(); } }
  else if (kind === 'stripes') { for (let i = 0; i < 128; i += 32) x.fillRect(i, 0, 14, 128); }
  else if (kind === 'flowers') {
    for (const [a, b] of [[32, 36], [96, 100]]) { for (let k = 0; k < 5; k++) { const t = k / 5 * Math.PI * 2; x.beginPath(); x.arc(a + Math.cos(t) * 9, b + Math.sin(t) * 9, 7, 0, 7); x.fill(); } x.fillStyle = '#ffe08a'; x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); x.fillStyle = ink; }
  } else if (kind === 'hearts') {
    for (const [a, b] of [[32, 32], [96, 96]]) { x.beginPath(); x.moveTo(a, b + 10); x.bezierCurveTo(a - 16, b - 2, a - 8, b - 14, a, b - 5); x.bezierCurveTo(a + 8, b - 14, a + 16, b - 2, a, b + 10); x.fill(); }
  } else if (kind === 'stars') {
    for (const [a, b, s] of [[30, 34, 9], [94, 98, 9], [94, 30, 4], [30, 96, 4]]) { x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * .45 : s, t = k / 10 * Math.PI * 2 - Math.PI / 2; x.lineTo(a + Math.cos(t) * r, b + Math.sin(t) * r); } x.fill(); }
  } else if (kind === 'planks') {
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? ink : base; x.fillRect(0, i * 32, 128, 32); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, i * 32, 128, 2); x.fillRect((i * 53) % 128, i * 32, 2, 32); }
  } else if (kind === 'checks') { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export const WALLS = [
  ['flowers', '#fde3e8', '#f6b6c6'], ['stripes', '#e8f3ff', '#d4e6fb'], ['dots', '#fff4d6', '#ffd98a'],
  ['hearts', '#f1e8ff', '#d9c8fb'], ['stars', '#e2f5ea', '#b8e3c8'], ['dots', '#ffe8d6', '#ffffff']
];
export const FLOORS = [['planks', '#d9a46c', '#cc955c'], ['planks', '#f0d2a8', '#e6c290'], ['checks', '#fff4e0', '#f2c6d0'], ['planks', '#b07a4a', '#a06c3e']];
export const ROOM = { w: 13, d: 8.4, h: 7 };
export function room() {
  const g = new THREE.Group(), { w, d, h } = ROOM;
  const wallM = new THREE.MeshStandardMaterial({ roughness: .9 }), floorM = new THREE.MeshStandardMaterial({ roughness: .8 });
  const floor = mesh(new THREE.BoxGeometry(w, .4, d), floorM, [0, -.2, 0]); floor.receiveShadow = true; floor.name = 'floor'; g.add(floor);
  const back = mesh(new THREE.BoxGeometry(w, h, .3), wallM, [0, h / 2, -d / 2 - .15]); back.receiveShadow = true; g.add(back);
  const left = mesh(new THREE.BoxGeometry(.3, h, d + .3), wallM, [-w / 2 - .15, h / 2, -.15]); left.receiveShadow = true; g.add(left);
  // dollhouse edges: wooden trim on the cut walls and floor
  const trim = mat('#fff4e0', { gloss: true }), trim2 = mat('#e6c8a0', { gloss: true });
  g.add(rbox(trim, [w + .7, .5, .5], [.1, -.25, d / 2 + .05], [0, 0, 0], .08));
  g.add(rbox(trim, [.5, .5, d + .6], [w / 2 + .1, -.25, -.1], [0, 0, 0], .08));
  g.add(rbox(trim, [.5, h + .4, .5], [-w / 2 - .15, h / 2, d / 2 + .05], [0, 0, 0], .08));
  g.add(rbox(trim, [w + .7, .4, .6], [.1, h + .1, -d / 2 - .15], [0, 0, 0], .08));
  g.add(rbox(trim, [.6, .4, d + .6], [-w / 2 - .15, h + .1, -.1], [0, 0, 0], .08));
  g.add(rbox(trim2, [w, .35, .08], [0, .17, -d / 2 + .04], [0, 0, 0], .03));
  g.add(rbox(trim2, [.08, .35, d], [-w / 2 + .04, .17, 0], [0, 0, 0], .03));
  // a window with a view
  const win = new THREE.Group(); win.position.set(1.8, 3.9, -d / 2 + .02); g.add(win);
  const skyM = new THREE.MeshBasicMaterial({ color: '#bfe1ff' }); const sky = mesh(new THREE.PlaneGeometry(2.6, 2.4), skyM, [0, 0, .01]); win.add(sky);
  const hillM = new THREE.MeshBasicMaterial({ color: '#9fd08c' }); const hill = mesh(new THREE.CircleGeometry(1.6, 24, 0, Math.PI), hillM, [-.3, -1.2, .02], [1, .45, 1]); win.add(hill);
  const sunM = new THREE.MeshBasicMaterial({ color: '#fff1a8' }); const sun = mesh(new THREE.CircleGeometry(.3, 20), sunM, [.7, .55, .02]); win.add(sun);
  const fr = mat('#fff4e0', { gloss: true });
  win.add(rbox(fr, [3, .2, .25], [0, 1.3, .1])); win.add(rbox(fr, [3, .25, .45], [0, -1.3, .15]));
  for (const x of [-1.4, 1.4]) win.add(rbox(fr, [.2, 2.8, .25], [x, 0, .1]));
  win.add(rbox(fr, [.08, 2.5, .1], [0, 0, .08])); win.add(rbox(fr, [2.6, .08, .1], [0, 0, .08]));
  const curtain = mat('#f2a7b5', { felt: true });
  for (const sx of [-1, 1]) { win.add(ball(curtain, [sx * 1.65, -.1, .3], [.35, 1.55, .12])); win.add(rbox(mat('#ffd86b', { felt: true }), [.5, .1, .2], [sx * 1.6, -.2, .4])); }
  win.add(capsule(mat('#d1a65a', { metal: true }), [-2.1, 1.55, .3], [2.1, 1.55, .3], .05));
  // a framed picture of a cheese on the left wall
  const pic = new THREE.Group(); pic.position.set(-w / 2 + .05, 4.3, -1.2); pic.rotation.y = Math.PI / 2; g.add(pic);
  pic.add(rbox(mat('#d1a65a', { metal: true }), [1.8, 1.4, .12], [0, 0, 0], [0, 0, 0], .05));
  pic.add(mesh(new THREE.PlaneGeometry(1.45, 1.05), new THREE.MeshStandardMaterial({ color: '#cfe8f7' }), [0, 0, .08]));
  pic.add(ball(mat('#cdbcae', { felt: true }), [-.15, -.15, .1], [.3, .3, .05])); pic.add(ball(mat('#cdbcae', { felt: true }), [-.35, .15, .1], [.15, .15, .03])); pic.add(ball(mat('#cdbcae', { felt: true }), [.05, .15, .1], [.15, .15, .03]));
  pic.add(ball(mat('#ffd35a', { felt: true }), [.4, -.25, .1], [.22, .15, .04]));
  // bunting along the top of the back wall
  const flags = new THREE.Group(); g.add(flags);
  const fl = ['#f2a7b5', '#ffd86b', '#a9d4ff', '#b8f0c8', '#b9a6e8'];
  const tri = new THREE.Shape(); tri.moveTo(-.28, 0); tri.lineTo(.28, 0); tri.lineTo(0, -.55); tri.lineTo(-.28, 0);
  const tg = new THREE.ShapeGeometry(tri);
  for (let i = 0; i < 14; i++) { const t = i / 13, x = -w / 2 + .6 + t * (w - 1.2); flags.add(mesh(tg, mat(fl[i % 5], { felt: true, side: THREE.DoubleSide }), [x, h - .45 - Math.sin(t * Math.PI) * .4, -d / 2 + .05])); }
  flags.add(tube(Array.from({ length: 15 }, (_, i) => { const t = i / 14; return [-w / 2 + .5 + t * (w - 1), h - .45 - Math.sin(t * Math.PI) * .4, -d / 2 + .06]; }), .02, mat('#8a7a70'), 30, 4));
  g.userData = { wallM, floorM, skyM, hillM, sunM, floor };
  return g;
}
export function setWall(r, i) { const [k, a, b] = WALLS[i % WALLS.length]; const t = patternTex(k, a, b); t.repeat.set(6, 3.2); r.userData.wallM.map = t; r.userData.wallM.color.set('#ffffff'); r.userData.wallM.needsUpdate = true; }
export function setFloor(r, i) { const [k, a, b] = FLOORS[i % FLOORS.length]; const t = patternTex(k, a, b); t.repeat.set(k === 'checks' ? 6 : 3, k === 'checks' ? 4 : 6); r.userData.floorM.map = t; r.userData.floorM.color.set('#ffffff'); r.userData.floorM.needsUpdate = true; }
