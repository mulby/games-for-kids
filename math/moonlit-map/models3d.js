// The Moonlit Map: 3D models, built in code in the shared felt-toy style (see shared/toy3d.js).
// Characters (the four travel friends and the six land guides), the treasures, the little things in the questions,
// the six landmarks on the floating map island, and the six land scenes.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
const { mat, ball, bead, capsule, lathe, tube, mesh, slab, glow, geo, lighten, freeze } = K;

const INK = '#2e2650';
const grp = (name, live = true) => { const g = new THREE.Group(); g.name = name; if (live) g.userData.live = true; return g; };
const felt = c => mat(c, { felt: true });
const gloss = c => mat(c, { gloss: true });
// a material of its own (not cached), for things that light up when a land is explored
export const ownGlow = (color, glowColor, i) => { const m = new THREE.MeshStandardMaterial({ color, emissive: glowColor || color, emissiveIntensity: i, roughness: .5 }); m.userData.base = i; return m; };

/* ---------------- faces on an ellipsoid head (radii R) ---------------- */
const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: .5, depthWrite: false });
const surfZ = (R, x, y) => R[2] * Math.sqrt(Math.max(0, 1 - x * x / (R[0] * R[0]) - y * y / (R[1] * R[1])));
function face(head, R, o = {}) {
  const ek = gloss(INK), wh = mat('#fff8e0', { glow: .8 });
  const ex = o.ex ?? R[0] * .36, ey = o.ey ?? R[1] * .06, er = o.er ?? R[0] * .11;
  for (const sx of [-1, 1]) {
    const x = sx * ex, z = surfZ(R, x, ey) - er * .22;
    head.add(ball(ek, [x, ey, z], [er, er * 1.25, er * .6]));
    head.add(bead(wh, [x + er * .38, ey + er * .5, z + er * .48], er * .32));
    head.add(bead(wh, [x - er * .3, ey - er * .5, z + er * .5], er * .16));
  }
  if (!o.noSmile) {
    const sy = o.sy ?? -R[1] * .3, sz = o.sz ?? surfZ(R, 0, sy);
    head.add(mesh(geo('smile', () => new THREE.TorusGeometry(1, .18, 6, 20, Math.PI * .8)), gloss(INK), [0, sy, sz + .005], o.sw ?? R[0] * .11, [0, 0, Math.PI + Math.PI * .1]));
  }
  for (const sx of [-1, 1]) {
    const cx = sx * R[0] * (o.cx ?? .6), cy = -R[1] * (o.cy ?? .2), cz = surfZ(R, cx, cy) + .012;
    const c = new THREE.Mesh(geo('cheekc', () => new THREE.CircleGeometry(1, 20)), cheekMat);
    c.position.set(cx, cy, cz); c.scale.setScalar(R[0] * (o.cs ?? .14));
    c.lookAt(cx + cx / (R[0] * R[0]), cy + cy / (R[1] * R[1]), cz + cz / (R[2] * R[2]));
    head.add(c);
  }
}
const cone = (m, p, r, h, rot = [0, 0, 0], seg = 14) => mesh(geo('cone' + r + '/' + h + '/' + seg, () => new THREE.ConeGeometry(r, h, seg)), m, p, 1, rot);
const cyl = (m, p, r1, r2, h, rot = [0, 0, 0], seg = 20) => mesh(geo('cyl' + [r1, r2, h, seg].join('/'), () => new THREE.CylinderGeometry(r1, r2, h, seg)), m, p, 1, rot);
const box = (m, p, s, rot = [0, 0, 0]) => mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m, p, s, rot);
const torus = (m, p, r, t, rot = [0, 0, 0], arc = Math.PI * 2) => mesh(geo('tor' + [r, t, arc.toFixed(2)].join('/'), () => new THREE.TorusGeometry(r, t, 8, 32, arc)), m, p, 1, rot);
// part of a lathe (for aprons, dresses with an open back, shells)
const dbl = new Map();
function latheArc(pts, m, a0, len, seg = 20) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg, a0, len);
  if (!dbl.has(m)) { const d = m.clone(); d.side = THREE.DoubleSide; dbl.set(m, d); }
  return new THREE.Mesh(g, dbl.get(m));
}

/* ---------------- plush critters: feet at y=0, about 2.4 tall ---------------- */
// o: fur, fur2, headR, ears(head,fm,f2), tail(), dress(body), extra(body, head), face options
export function critter(o) {
  const root = new THREE.Group();
  const body = grp('body'); root.add(body);
  const fm = felt(o.fur), f2 = felt(o.fur2 || lighten(o.fur, .15)), feet = o.feet ? felt(o.feet) : fm;
  const R = o.headR || [.62, .56, .56];
  for (const sx of [-1, 1]) body.add(ball(feet, [sx * .21, .1, .08], [.17, .12, .23]));
  if (!o.noTorso) body.add(lathe([[0, .06], [.38, .1], [.5, .36], [.47, .7], [.33, .97], [.15, 1.08], [0, 1.1]], fm, 28));
  if (o.belly !== false) body.add(ball(f2, [0, .5, .3], [.31, .37, .23]));
  if (o.dress) o.dress(body, fm, f2);
  const head = grp('head'); head.position.set(0, 1.1 + R[1] * .82, 0); body.add(head);
  head.add(ball(o.headMat ? felt(o.headMat) : fm, [0, 0, 0], R));
  const armM = o.arm ? felt(o.arm) : fm, pawM = o.paw ? felt(o.paw) : armM;
  const armL = grp('armL'), armR = grp('armR');
  armL.position.set(-.36, .9, .02); armR.position.set(.36, .9, .02);
  if (o.wingArms) {
    armL.add(ball(armM, [-.1, -.3, -.02], [.14, .36, .26], [0, 0, -.25])); armR.add(ball(armM, [.1, -.3, -.02], [.14, .36, .26], [0, 0, .25]));
  } else {
    armL.add(capsule(armM, [0, 0, 0], [-.15, -.36, .12], .095)); armL.add(ball(pawM, [-.16, -.43, .14], .1));
    armR.add(capsule(armM, [0, 0, 0], [.15, -.36, .12], .095)); armR.add(ball(pawM, [.16, -.43, .14], .1));
  }
  body.add(armL, armR);
  if (o.ears) o.ears(head, fm, f2, R);
  face(head, R, o.face);
  let tail = null;
  if (o.tail) { tail = grp('tail'); tail.position.set(0, .35, -.4); o.tail(tail, fm, f2); body.add(tail); }
  if (o.extra) o.extra(body, head, fm, f2, R, { armL, armR });
  Object.assign(root.userData, { kind: 'critter', body, head, armL, armR, tailG: tail, t0: Math.random() * 10, mood: 'idle', wave: !!o.wave });
  freeze(root);
  return root;
}
export function animateCritter(o, t) {
  const u = o.userData, k = t + u.t0, happy = u.mood === 'happy';
  u.body.position.y = Math.abs(Math.sin(k * 2.2)) * .035 + (happy ? Math.abs(Math.sin(k * 6.5)) * .28 : 0);
  u.body.rotation.z = Math.sin(k * 1.2) * .035;
  u.head.rotation.z = Math.sin(k * .9) * .09 + (u.mood === 'think' ? .2 : 0);
  u.head.rotation.x = Math.sin(k * .7) * .05; u.head.rotation.y = Math.sin(k * .45) * .18;
  const waving = !happy && u.wave && (k % 9) < 2.2;
  u.armR.rotation.z = happy ? 2.3 + Math.sin(k * 11) * .35 : waving ? 2.4 + Math.sin(k * 9) * .35 : Math.sin(k * 1.6) * .1;
  u.armL.rotation.z = happy ? -2.3 - Math.sin(k * 11 + 1) * .35 : -Math.sin(k * 1.4) * .08;
  if (u.tailG) u.tailG.rotation.y = Math.sin(k * 2.1) * .35;
}

/* ear and tail shapes */
const earsRound = (sz = .17, inner = '#e8b4a6') => (h, fm, f2, R) => { for (const sx of [-1, 1]) { h.add(ball(fm, [sx * R[0] * .68, R[1] * .74, -.05], [sz, sz, sz * .6])); h.add(ball(felt(inner), [sx * R[0] * .68, R[1] * .72, -.05 + sz * .45], [sz * .62, sz * .62, sz * .2])); } };
const earsPointy = (inner = '#f6c1c8', tip = null, hgt = .42) => (h, fm, f2, R) => {
  for (const sx of [-1, 1]) {
    const x = sx * R[0] * .58, y = R[1] * .78;
    h.add(cone(fm, [x, y, -.04], .19, hgt, [0, 0, -sx * .32], 4).rotateY(Math.PI / 4));
    h.add(cone(felt(inner), [x * 1.02, y - .02, .06], .1, hgt * .62, [0, 0, -sx * .32], 4).rotateY(Math.PI / 4));
    if (tip) h.add(cone(felt(tip), [x + sx * hgt * .3 * .33, y + hgt * .36, -.04], .08, hgt * .25, [0, 0, -sx * .32], 4).rotateY(Math.PI / 4));
  }
};

/* ---------------- the four travel friends ---------------- */
export function dragon() {
  return critter({
    fur: '#7fcca3', fur2: '#fff1c9', paw: '#7fcca3', headR: [.64, .58, .58],
    ears: (h, fm, f2, R) => {
      for (const sx of [-1, 1]) { h.add(cone(felt('#fff1c9'), [sx * .28, .6, -.08], .09, .32, [-.3, 0, -sx * .35])); h.add(ball(fm, [sx * .6, .22, -.08], [.07, .2, .14], [0, 0, sx * .7])); }
      h.add(ball(f2, [0, -.2, .45], [.3, .18, .16])); for (const sx of [-1, 1]) h.add(bead(felt('#5aa882'), [sx * .1, -.14, .61], .03));
    },
    face: { sy: -.3, sz: .6, sw: .08 },
    tail: (t, fm) => { t.add(tube([[0, 0, 0], [.1, -.15, -.35], [.35, -.25, -.65], [.6, -.2, -.85]], .14, fm, 14, 10)); t.add(cone(felt('#f59ab7'), [.66, -.18, -.9], .12, .28, [0, 0, -1.2], 4)); },
    extra: (body, head, fm) => {
      const spike = felt('#f59ab7');
      [[1.06, -.32], [.82, -.46], [.56, -.5]].forEach(([y, z]) => body.add(cone(spike, [0, y, z], .09, .2, [-.9, 0, 0], 6)));
      head.add(cone(spike, [0, .5, -.38], .08, .2, [-.7, 0, 0], 6));
      const wm = new THREE.MeshStandardMaterial({ color: '#c9b6ff', roughness: .9, side: THREE.DoubleSide });
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(.3, .5, .7, .6, .75, .35); s.bezierCurveTo(.6, .3, .55, .1, .45, .12); s.bezierCurveTo(.35, .0, .2, .02, 0, 0);
      const wg = geo('dwing', () => new THREE.ExtrudeGeometry(s, { depth: .04, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 }));
      for (const sx of [-1, 1]) { const w = mesh(wg, wm, [sx * .18, .9, -.35], [sx, 1, 1], [0, sx * -.6, .1]); body.add(w); }
    }
  });
}
export function unicorn() {
  return critter({
    fur: '#fbf6ff', fur2: '#ffe3ef', feet: '#c9b6ff', headR: [.62, .57, .57],
    ears: earsPointy('#ffd0e0', null, .34),
    face: { sy: -.34, sz: .66, sw: .07, cy: .16 },
    tail: (t) => { ['#ffb3d1', '#c9b6ff', '#a9d4ff', '#ffe08a'].forEach((c, i) => t.add(ball(felt(c), [0, -.05 - i * .14, -.05 - i * .12], .17 - i * .02))); },
    extra: (body, head, fm, f2) => {
      head.add(ball(f2, [0, -.2, .44], [.3, .2, .2]));
      for (const sx of [-1, 1]) head.add(bead(felt('#e8a6c0'), [sx * .1, -.16, .63], .028));
      const gold = mat('#ffd86b', { metal: true, shine: .25 });
      head.add(cone(gold, [0, .86, .22], .13, .6, [.3, 0, 0], 16));
      for (let i = 0; i < 3; i++) head.add(torus(gold, [0, .66 + i * .15, .18 + i * .045], .11 - i * .028, .022, [Math.PI / 2 + .3, 0, 0]));
      const cols = ['#ffb3d1', '#c9b6ff', '#a9d4ff', '#ffb3d1', '#ffe08a', '#c9b6ff'];
      cols.forEach((c, i) => { const a = .5 - i * .32; head.add(ball(felt(c), [-.42 - Math.sin(i * .5) * .1, .38 - i * .16, -.05 - i * .07], .17)); head.add(ball(felt(cols[(i + 2) % 6]), [.4 + Math.sin(i * .5) * .1, .4 - i * .17, -.12 - i * .06], .15)); });
      [['#ffb3d1', -.2, .5, .3], ['#c9b6ff', .05, .55, .32], ['#a9d4ff', .26, .48, .3]].forEach(([c, x, y, z]) => head.add(ball(felt(c), [x, y, z], [.17, .12, .12])));
    }
  });
}
export function fox() {
  return critter({
    fur: '#ec8a4b', fur2: '#fff3e6', paw: '#5b3a2e', feet: '#5b3a2e', headR: [.64, .56, .56],
    ears: earsPointy('#fff3e6', '#5b3a2e', .46),
    face: { sy: -.3, sz: .66, sw: .07, cy: .12, cx: .64 },
    tail: (t, fm, f2) => { t.add(ball(fm, [.2, .1, -.25], [.26, .26, .42], [.6, .4, 0])); t.add(ball(fm, [.38, .32, -.5], [.24, .24, .34], [.9, .4, 0])); t.add(ball(f2, [.48, .52, -.62], [.17, .19, .19])); },
    extra: (body, head, fm, f2) => {
      head.add(ball(f2, [0, -.22, .4], [.34, .22, .24]));
      head.add(ball(gloss('#3a2a2a'), [0, -.12, .64], [.08, .06, .05]));
      for (const sx of [-1, 1]) head.add(ball(f2, [sx * .38, -.22, .3], [.2, .16, .14]));
      body.add(torus(felt('#6fae66'), [0, 1.02, .02], .3, .06, [Math.PI / 2 - .15, 0, 0]));
      body.add(cone(felt('#6fae66'), [0, .92, .3], .12, .22, [Math.PI, 0, 0], 3));
    }
  });
}
export function owl() {
  return critter({
    fur: '#9b7653', fur2: '#f4e3c8', feet: '#f2a33a', headR: [.66, .58, .56], wingArms: true, arm: '#7d5c40',
    ears: (h, fm) => { for (const sx of [-1, 1]) h.add(cone(fm, [sx * .42, .56, -.02], .12, .3, [0, 0, -sx * .45], 5)); },
    face: { er: .12, ex: .25, ey: .06, noSmile: true, cy: .3, cx: .66 },
    extra: (body, head, fm, f2) => {
      for (const sx of [-1, 1]) head.add(ball(f2, [sx * .25, .05, .3], [.24, .24, .13]));
      head.add(cone(mat('#f2a33a', { gloss: true }), [0, -.12, .6], .07, .18, [Math.PI + .5, 0, 0], 8));
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - (r % 2); i++) body.add(ball(felt('#e9d2b0'), [(i - (2 - (r % 2)) / 2) * .16, .66 - r * .15, .47 - r * .02], [.07, .05, .03]));
    }
  });
}
export const PAL_BUILD = { '🐉': dragon, '🦄': unicorn, '🦊': fox, '🦉': owl };

/* ---------------- the six land guides ---------------- */
export function luma() {
  const f = K.firefly({ body: '#ffe7a0', wing: '#e8f2ff', glowColor: '#ffd65a', acc: 'crown' });
  f.userData.isLuma = true;
  return f;
}
export function gnome() { // Pebble
  return critter({
    fur: '#5c8fc4', fur2: '#5c8fc4', belly: false, headMat: '#ffdcc6', arm: '#5c8fc4', paw: '#ffdcc6', feet: '#7a4e2e', headR: [.58, .54, .54],
    face: { noSmile: true, ey: .1, cy: .05, cx: .62 },
    extra: (body, head, fm) => {
      head.add(ball(felt('#f7a8a0'), [0, -.06, .56], [.13, .12, .11]));
      const beard = felt('#fbf7f0');
      [[0, -.36, .38, .3], [-.24, -.3, .32, .2], [.24, -.3, .32, .2], [0, -.58, .3, .2], [-.14, -.5, .34, .17], [.14, -.5, .34, .17], [0, -.74, .22, .12]].forEach(([x, y, z, r]) => head.add(ball(beard, [x, y, z], r)));
      for (const sx of [-1, 1]) head.add(ball(beard, [sx * .14, -.14, .5], [.13, .06, .06], [0, 0, sx * .3]));
      const hat = felt('#d9475a');
      head.add(lathe([[0, 1.3], [.08, 1.1], [.22, .75], [.42, .38], [.58, .2], [.6, .14], [0, .14]], hat, 24).rotateX(-.12));
      head.add(torus(felt('#c23a4d'), [0, .17, 0], .58, .05, [Math.PI / 2, 0, 0]));
      body.add(torus(felt('#7a4e2e'), [0, .56, 0], .5, .07, [Math.PI / 2, 0, 0]));
      body.add(box(mat('#ffd86b', { metal: true }), [0, .56, .5], [.16, .12, .05]));
      const crystal = mat('#9df5e8', { glow: 1.1, glowColor: '#5ee0d0' });
      const stick = new THREE.Group(); for (let i = 0; i < 10; i++) stick.add(box(crystal, [0, i * .085, 0], [.075, .075, .075]));
      stick.position.set(.2, -.85, .2); stick.rotation.z = -.2; body.getObjectByName('armR').add(stick);
    }
  });
}
export function bear() { // Bramble
  return critter({
    fur: '#a8714a', fur2: '#e9c9a0', headR: [.64, .58, .56],
    ears: earsRound(.18, '#e9c9a0'),
    face: { sy: -.27, sz: .6, sw: .07, cy: .12 },
    extra: (body, head, fm, f2) => {
      head.add(ball(f2, [0, -.18, .42], [.25, .18, .17]));
      head.add(ball(gloss('#3a2a2a'), [0, -.1, .58], [.09, .065, .05]));
      const apron = felt('#fffaf0');
      body.add(latheArc([[0, .12], [.41, .16], [.53, .38], [.5, .72], [.38, .95]], apron, -1.1, 2.2));
      body.add(torus(felt('#f2a7b5'), [0, .16, 0], .44, .03, [Math.PI / 2, 0, 0], Math.PI * .7).rotateZ(Math.PI * .15));
      body.add(ball(felt('#f2a7b5'), [.18, .45, .5], [.12, .1, .04]));
      const hat = felt('#ffffff');
      head.add(cyl(hat, [0, .5, -.02], .36, .34, .26, [-.12, 0, 0]));
      [[0, .78, -.05, .3], [-.25, .7, 0, .22], [.25, .7, 0, .22], [0, .7, .2, .2], [0, .72, -.25, .22]].forEach(([x, y, z, r]) => head.add(ball(hat, [x, y, z], r)));
    }
  });
}
export function otter() { // Otto
  return critter({
    fur: '#8c6a54', fur2: '#ecdcc6', headR: [.64, .54, .54],
    ears: (h, fm, f2, R) => { for (const sx of [-1, 1]) h.add(ball(fm, [sx * R[0] * .78, R[1] * .45, -.08], [.1, .1, .07])); },
    face: { sy: -.27, sz: .58, sw: .07, ey: .1 },
    tail: (t, fm) => { t.add(tube([[0, 0, 0], [0, -.2, -.3], [0, -.3, -.7], [0, -.32, -1.05]], .15, fm, 12, 10)); t.add(ball(fm, [0, -.32, -1.08], [.12, .08, .15])); },
    extra: (body, head, fm, f2) => {
      head.add(ball(f2, [0, -.16, .38], [.36, .2, .2]));
      head.add(ball(gloss('#3a2a2a'), [0, -.08, .57], [.09, .06, .05]));
      const wh = mat('#5a4636');
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) head.add(tube([[sx * .2, -.14 - i * .05, .52], [sx * .42, -.12 - i * .1, .5], [sx * .55, -.1 - i * .16, .42]], .006, wh, 6, 3));
      const scarf = felt('#4b7bd1');
      body.add(torus(scarf, [0, 1.04, .02], .33, .08, [Math.PI / 2 - .1, 0, 0]));
      body.add(capsule(scarf, [.12, 1.0, .32], [.2, .62, .4], .07));
      body.add(capsule(felt('#ffffff'), [.17, .78, .4], [.18, .74, .41], .075));
      head.add(cyl(felt('#2f3f7a'), [.05, .5, -.02], .3, .34, .16, [-.15, 0, .12]));
      head.add(cyl(felt('#ffffff'), [.05, .43, -.02], .36, .36, .06, [-.15, 0, .12]));
    }
  });
}
export function bunny() { // Clover
  return critter({
    fur: '#f6efe4', fur2: '#ffffff', headR: [.6, .56, .55], belly: false,
    ears: (h, fm) => { const pink = felt('#f8bfd0'); for (const sx of [-1, 1]) { h.add(ball(fm, [sx * .2, .95, -.08], [.15, .45, .1], [0, 0, -sx * .18])); h.add(ball(pink, [sx * .2, .95, -.01], [.08, .34, .05], [0, 0, -sx * .18])); } },
    face: { sy: -.27, sz: .55, sw: .06, cy: .14 },
    tail: (t) => t.add(ball(felt('#ffffff'), [0, -.1, -.05], .18)),
    dress: (body) => {
      const d = felt('#c7b2f0');
      body.add(lathe([[0, .2], [.6, .18], [.62, .24], [.53, .55], [.45, .8], [.36, .98], [0, 1.0]], d, 28));
      body.add(torus(felt('#ffffff'), [0, .98, 0], .3, .07, [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; body.add(bead(felt('#ffffff'), [Math.cos(a) * .6, .22, Math.sin(a) * .6], [.08, .06, .08])); }
    },
    extra: (body, head) => { head.add(ball(felt('#f39bb5'), [0, -.13, .54], [.06, .045, .04])); head.add(ball(felt('#f39bb5'), [.36, .62, .1], [.12, .08, .08], [0, 0, -.4])); }
  });
}
export function cat() { // Madame Whiskers
  return critter({
    fur: '#b8b3c9', fur2: '#f6f1ea', headR: [.64, .56, .56], wave: true,
    ears: earsPointy('#f6c1c8', null, .4),
    face: { sy: -.26, sz: .56, sw: .065, cy: .14 },
    tail: (t, fm) => t.add(tube([[0, 0, 0], [.15, .15, -.3], [.3, .55, -.4], [.2, .85, -.3]], .08, fm, 14, 8)),
    extra: (body, head, fm, f2) => {
      head.add(ball(f2, [0, -.18, .4], [.28, .17, .17]));
      head.add(ball(felt('#f39bb5'), [0, -.1, .56], [.06, .045, .04]));
      const wh = mat('#6a6080');
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) head.add(tube([[sx * .18, -.16 - i * .04, .52], [sx * .45, -.12 - i * .08, .48], [sx * .6, -.08 - i * .14, .4]], .006, wh, 6, 3));
      const shawl = felt('#d9577a');
      body.add(latheArc([[.36, 1.0], [.5, .8], [.58, .62], [.5, .56]], shawl, Math.PI * .45, Math.PI * 1.1));
      body.add(torus(shawl, [0, 1.0, 0], .34, .07, [Math.PI / 2, 0, 0]));
      const pearl = mat('#fffaf2', { gloss: true });
      for (let i = 0; i < 9; i++) { const a = -1 + i / 8 * 2; body.add(bead(pearl, [Math.sin(a) * .36, .95 - Math.cos(a) * .08, Math.cos(a) * .36], .05)); }
      head.add(ball(felt('#f2a7b5'), [-.38, .55, .12], [.13, .09, .08], [0, 0, .5])); head.add(ball(felt('#f2a7b5'), [-.2, .62, .12], [.13, .09, .08], [0, 0, -.4]));
      head.add(bead(felt('#e48aa0'), [-.29, .58, .17], .06));
    }
  });
}
export const GUIDE_BUILD = { N: luma, P: gnome, A: bear, S: otter, M: bunny, F: cat };
export function animateAny(o, t) { if (o.userData.kind === 'critter') animateCritter(o, t); else K.animate(o, t); }

/* ---------------- the six treasures ---------------- */
export function gemModel(e) {
  const g = new THREE.Group();
  switch (e) {
    case '🌟': { g.add(mesh(K.starGeo(), new THREE.MeshPhysicalMaterial({ color: '#ffe27a', emissive: '#ffb83a', emissiveIntensity: .7, roughness: .15, clearcoat: 1 }), [0, 0, 0], .9)); g.add(glow('#ffe08a', 4.5, .55)); break; }
    case '💎': {
      const m = new THREE.MeshPhysicalMaterial({ color: '#8ff0ff', emissive: '#3fc6e0', emissiveIntensity: .45, roughness: .05, clearcoat: 1, flatShading: true });
      g.add(mesh(new THREE.LatheGeometry([[0, -.95], [.78, .1], [.62, .42], [0, .5]].map(p => new THREE.Vector2(p[0], p[1])), 8), m));
      g.add(glow('#9ff4ff', 4, .45)); break;
    }
    case '🍯': {
      g.add(lathe([[0, -.75], [.5, -.72], [.72, -.4], [.74, .05], [.55, .4], [.45, .48], [.47, .56], [0, .56]], new THREE.MeshPhysicalMaterial({ color: '#f5b52e', emissive: '#c77a10', emissiveIntensity: .35, roughness: .2, clearcoat: 1 }), 32));
      g.add(lathe([[0, .82], [.42, .78], [.62, .55], [.56, .48], [0, .52]], felt('#e2566b'), 24));
      g.add(torus(felt('#fff1d6'), [0, .54, 0], .5, .04, [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 4; i++) { const a = -.9 + i * .55; g.add(capsule(mat('#f5b52e', { gloss: true }), [Math.sin(a) * .5, .42, Math.cos(a) * .5], [Math.sin(a) * .62, .1 - (i % 2) * .15, Math.cos(a) * .62], .06)); }
      g.add(glow('#ffd36b', 3.6, .35)); break;
    }
    case '🫧': {
      const sh = new THREE.MeshPhysicalMaterial({ color: '#ffd6e4', roughness: .35, sheen: 1, sheenColor: new THREE.Color('#fff'), side: THREE.DoubleSide });
      const shell = (flip) => { const s = new THREE.Group(); for (let i = 0; i < 7; i++) { const a = (i - 3) * .32; s.add(ball(sh, [Math.sin(a) * .55, 0, Math.cos(a) * .55 - .45], [.22, .07, .6], [0, a, 0])); } s.rotation.x = flip; return s; };
      const lo = shell(0); lo.position.y = -.35; g.add(lo); const hi = shell(-1.0); hi.position.set(0, -.25, -.55); g.add(hi);
      g.add(ball(new THREE.MeshPhysicalMaterial({ color: '#fbf6ff', roughness: .1, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5, emissive: '#d8d0ff', emissiveIntensity: .3 }), [0, -.05, .05], .38));
      g.add(glow('#e0f0ff', 3.4, .4)); break;
    }
    case '🌱': {
      g.add(ball(new THREE.MeshPhysicalMaterial({ color: '#c9a6ff', emissive: '#8f6ae8', emissiveIntensity: .5, roughness: .2, clearcoat: 1 }), [0, -.4, 0], [.42, .52, .42]));
      g.add(capsule(felt('#6fae66'), [0, .02, 0], [.02, .45, 0], .05));
      const leaf = felt('#7cc06e');
      g.add(ball(leaf, [-.28, .55, 0], [.3, .1, .16], [0, 0, .5])); g.add(ball(leaf, [.28, .58, 0], [.3, .1, .16], [0, 0, -.5]));
      g.add(glow('#c9b6ff', 3.4, .4)); break;
    }
    case '🗝️': {
      const gm = mat('#ffd36b', { metal: true, shine: .3 });
      g.add(torus(gm, [0, .55, 0], .32, .09));
      g.add(mesh(new THREE.TorusGeometry(.16, .05, 8, 20, Math.PI * 1.3), gm, [0, .55, .02], 1, [0, 0, -.6]));
      g.add(capsule(gm, [0, .22, 0], [0, -.8, 0], .07));
      g.add(box(gm, [.14, -.62, 0], [.22, .1, .1])); g.add(box(gm, [.12, -.42, 0], [.16, .1, .1]));
      g.add(ball(mat('#5aa6ff', { gloss: true }), [0, .55, 0], .08));
      g.add(glow('#ffe08a', 3.4, .4)); break;
    }
    default: g.add(mesh(K.starGeo(), mat('#ffe27a', { glow: .8 }), [0, 0, 0], .8));
  }
  return freeze(g);
}

/* ---------------- the little things inside the questions ---------------- */
export function cupcake() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.36, 0], [.48, .5], [.5, .52], [0, .52]], mat('#f39bb5', { flat: true }), 14));
  g.add(lathe([[0, .5], [.56, .5], [.55, .6], [.42, .7], [.46, .8], [.3, .92], [.33, 1.0], [.16, 1.12], [0, 1.16]], felt('#fff2f6'), 28));
  g.add(ball(gloss('#d9364f'), [0, 1.22, 0], .13));
  for (let i = 0; i < 9; i++) { const a = i * 2.3; g.add(bead(felt(['#ffd86b', '#a9d4ff', '#c9b6ff'][i % 3]), [Math.cos(a) * (.25 + (i % 3) * .1), .82 + (i % 2) * .12, Math.sin(a) * (.25 + (i % 3) * .1) + .05], [.04, .02, .04])); }
  return g;
}
export function fish() {
  const g = new THREE.Group(), m = felt('#ff9d5c'), f2 = felt('#ffd7b0');
  g.add(ball(m, [0, 0, 0], [.6, .38, .26]));
  g.add(ball(f2, [.05, -.12, .1], [.42, .2, .18]));
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.lineTo(-.45, .32); tail.quadraticCurveTo(-.36, 0, -.45, -.32); tail.closePath();
  g.add(slab(tail, .06, m, .03).translateX(-.5));
  g.add(ball(m, [0, .34, 0], [.22, .12, .05], [0, 0, -.3]));
  for (const sz of [-1, 1]) {
    g.add(ball(gloss(INK), [.33, .08, sz * .2], [.07, .08, .04]));
    g.add(bead(mat('#fff8e0', { glow: .8 }), [.35, .11, sz * .23], .022));
  }
  g.add(torus(gloss(INK), [.5, -.06, .1], .05, .012, [0, -.6, Math.PI * 1.1], Math.PI * .8));
  return g;
}
export function pieWhole() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.7, 0], [.86, .28], [.9, .3], [0, .3]], mat('#c9cfe0', { metal: true, shine: .1 }), 32));
  g.add(lathe([[0, .3], [.8, .3], [.88, .38], [.8, .44], [.5, .48], [0, .5]], felt('#e8b06a'), 32));
  for (let i = -2; i <= 2; i++) { g.add(capsule(felt('#f2c88a'), [i * .28, .52, -.7 + Math.abs(i) * .1], [i * .28, .52, .7 - Math.abs(i) * .1], .05)); g.add(capsule(felt('#f2c88a'), [-.7 + Math.abs(i) * .1, .54, i * .28], [.7 - Math.abs(i) * .1, .54, i * .28], .05)); }
  for (let i = 0; i < 5; i++) { const a = i * 1.3; g.add(ball(gloss('#d9364f'), [Math.cos(a) * .4, .5, Math.sin(a) * .4], .09)); }
  return g;
}
export function moonberries() {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color: '#7d6ae8', emissive: '#5b48c8', emissiveIntensity: .35, roughness: .2, clearcoat: 1 });
  [[0, 0, 0], [-.3, .05, .1], [.3, .05, .1], [-.15, .3, .05], [.15, .3, .08], [0, .55, 0], [0, -.25, .1], [-.2, -.15, -.15], [.2, -.15, -.12]].forEach(p => { g.add(ball(m, p, .2)); g.add(bead(mat('#e8e0ff', { glow: .6 }), [p[0] + .06, p[1] + .08, p[2] + .17], .035)); });
  g.add(capsule(mat('#5f8a4a'), [0, .7, 0], [.05, .95, 0], .03));
  g.add(ball(felt('#7cc06e'), [.2, .9, 0], [.25, .07, .13], [0, 0, -.4]));
  return g;
}
// base-ten crystals: one cube, a stick of ten, a flat of a hundred (cubes are .1 apart)
function cubeGeo() { return geo('btc', () => { const g = new THREE.BoxGeometry(.092, .092, .092, 2, 2, 2); return g; }); }
export function tenBlock(kind) {
  const col = { flat: '#7fb6ea', rod: '#9ad3a8', cube: '#f5b3c4' }[kind];
  const m = new THREE.MeshPhysicalMaterial({ color: col, roughness: .35, clearcoat: .6, emissive: col, emissiveIntensity: .12 });
  const g = new THREE.Group(); const n = kind === 'flat' ? 10 : 1, k = kind === 'cube' ? 1 : 10;
  for (let x = 0; x < n; x++) for (let y = 0; y < k; y++) g.add(mesh(cubeGeo(), m, [(x - (n - 1) / 2) * .1, (y - (k - 1) / 2) * .1, 0]));
  return freeze(g);
}
export function coinModel(kind) {
  const spec = { q: ['#d8dde6', 1.0], d: ['#d8dde6', .73], n: ['#c9ced8', .85], p: ['#d98a52', .76] }[kind];
  const m = new THREE.MeshStandardMaterial({ color: spec[0], metalness: .6, roughness: .32, emissive: spec[0], emissiveIntensity: .18 });
  const r = spec[1];
  const g = new THREE.Group();
  const c = lathe([[0, -.06], [r * .96, -.06], [r, -.03], [r, .03], [r * .96, .06], [r * .88, .06], [r * .86, .04], [0, .04]], m, 48);
  c.rotation.x = Math.PI / 2; g.add(c);
  g.add(mesh(new THREE.TorusGeometry(r * .78, .012, 6, 48), m, [0, 0, .045]));
  return g;
}
// clock with real hands; angles in degrees, 0 = 12 o'clock
let faceTex = null;
function clockFaceTexture() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#fffdf6'; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill();
  x.strokeStyle = '#6a6080';
  for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30, r1 = i % 5 ? 228 : 216; x.lineWidth = i % 5 ? 3 : 7; x.beginPath(); x.moveTo(256 + r1 * Math.sin(a), 256 - r1 * Math.cos(a)); x.lineTo(256 + 240 * Math.sin(a), 256 - 240 * Math.cos(a)); x.stroke(); }
  x.fillStyle = '#2b2540'; x.font = '700 62px Andika, "Trebuchet MS", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; x.fillText(String(i), 256 + 180 * Math.sin(a), 256 - 180 * Math.cos(a) + 4); }
  faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  return faceTex;
}
export function clockModel(hourDeg, minDeg) {
  const g = new THREE.Group();
  g.add(lathe([[0, -.1], [1.0, -.1], [1.08, -.04], [1.1, .06], [1.04, .12], [.96, .1], [.95, .04], [0, .04]], mat('#c8901a', { metal: true, shine: .2 }), 64).rotateX(Math.PI / 2));
  const faceM = new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: .8 });
  g.add(mesh(new THREE.CircleGeometry(.96, 64), faceM, [0, 0, .045]));
  const hand = (deg, len, w, color, z) => { const h = new THREE.Group(); h.add(capsule(gloss(color), [0, -.08, 0], [0, len, 0], w)); h.add(cone(gloss(color), [0, len + w * 1.2, 0], w * 2.2, w * 3.2, [0, 0, 0], 3)); h.position.z = z; h.rotation.z = -deg * Math.PI / 180; return h; };
  g.add(hand(hourDeg, .44, .05, '#2b2540', .1));
  g.add(hand(minDeg, .66, .032, '#d9577a', .15));
  g.add(ball(mat('#ffd36b', { metal: true }), [0, 0, .18], .07));
  return g;
}
// pie cut into n equal pieces; the first k are cherry (pink)
export function piePieces(n, k) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.9, 0], [1.05, .22], [1.1, .24], [0, .24]], mat('#c9cfe0', { metal: true, shine: .1 }), 48));
  const cherry = new THREE.MeshPhysicalMaterial({ color: '#e0466a', roughness: .3, clearcoat: .8 }), crust = felt('#f0c27e');
  for (let i = 0; i < n; i++) {
    const gap = n > 1 ? .045 : 0, a0 = i / n * Math.PI * 2 + gap / 2, len = Math.PI * 2 / n - gap;
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(Math.cos(a0) * .95, Math.sin(a0) * .95); s.absarc(0, 0, .95, a0, a0 + len, false); s.closePath();
    const w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .22, bevelEnabled: true, bevelThickness: .04, bevelSize: .03, bevelSegments: 2, curveSegments: 24 }), i < k ? cherry : crust);
    w.rotation.x = -Math.PI / 2; w.rotation.z = Math.PI / 2; w.position.y = .22;
    // shift each piece a little outwards so the cuts are easy to count
    const mid = a0 + len / 2; w.position.x = Math.cos(mid + Math.PI / 2) * .03; w.position.z = -Math.sin(mid + Math.PI / 2) * .03;
    g.add(w);
  }
  return g;
}

/* ---------------- small scenery pieces ---------------- */
export function bush(c = '#3f7a4a', berry = null, berryMat = null) {
  const b = new THREE.Group();
  [[0, .55, 0, .7], [-.5, .4, .15, .48], [.5, .42, -.05, .52]].forEach(([x, y, z, r]) => b.add(ball(felt(c), [x, y, z], r)));
  if (berry) for (let i = 0; i < 10; i++) { const a = i * 2.39, h = .3 + (i % 4) * .17; b.add(ball(berryMat || gloss(berry), [Math.cos(a) * .62, h, Math.sin(a) * .42 + .22], .1)); }
  return b;
}
export function rock(s = 1, c = '#8a8fa8') { return ball(felt(c), [0, s * .3, 0], [s * .7, s * .45, s * .55]); }
export function lanternPost(h = 2.2, lightMat) {
  const g = new THREE.Group();
  g.add(capsule(felt('#6b4a33'), [0, 0, 0], [0, h, 0], .06));
  g.add(capsule(felt('#6b4a33'), [0, h, 0], [.35, h + .05, 0], .05));
  const L = new THREE.Group(); L.position.set(.38, h - .32, 0);
  L.add(lathe([[0, -.2], [.13, -.18], [.17, 0], [.13, .18], [0, .2]], lightMat || ownGlow('#ffe0a0', '#ffb84a', 1.4), 12));
  L.add(cyl(mat('#d6aa5c', { metal: true }), [0, .22, 0], .07, .12, .06));
  L.add(glow('#ffcf66', 1.6, .6));
  g.add(L);
  return g;
}
function stall(c1, c2, w = 2.2) {
  const g = new THREE.Group(), wood = felt('#8a5a3a');
  g.add(slab(K.roundRectShape(w, .9, .08), .9, felt('#b07a4e'), .04).translateY(.45));
  g.add(box(felt('#fff1d6'), [0, .93, 0], [w + .1, .06, 1]));
  for (const sx of [-1, 1]) g.add(capsule(wood, [sx * w / 2, 0, .45], [sx * w / 2, 2.0, .45], .05));
  for (let i = 0; i < 6; i++) { const x = -w / 2 + (i + .5) * w / 6; g.add(box(felt(i % 2 ? c1 : c2), [x, 2.05, .35], [w / 6, .07, 1.1], [.32, 0, 0])); g.add(ball(felt(i % 2 ? c1 : c2), [x, 1.84, .9], [w / 12, .1, .05])); }
  return g;
}
export function cottage(roof = '#a8714a', wall = '#fff1d6', winMat) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [1.05, 0], [1.05, 1.5], [0, 1.5]], felt(wall), 24));
  g.add(lathe([[0, 2.9], [.3, 2.65], [.9, 1.95], [1.35, 1.45], [1.25, 1.4], [0, 1.45]], felt(roof), 24));
  g.add(ball(felt(lighten(roof, .08)), [0, 2.85, 0], .22));
  g.add(cyl(felt('#c9cfe0'), [.55, 2.6, -.3], .16, .18, .7));
  g.add(slab(K.roundRectShape(.55, .95, .27), .1, felt('#7a4e2e'), .03).translateZ(1.03).translateY(.48));
  g.add(bead(mat('#ffd86b', { metal: true }), [.15, .5, 1.1], .04));
  const wm = winMat || ownGlow('#ffe0a0', '#ffb84a', 1.2);
  for (const a of [-.9, .9]) {
    const w = mesh(geo('win', () => new THREE.CircleGeometry(.2, 20)), wm, [Math.sin(a) * 1.06, 1.0, Math.cos(a) * 1.06]); w.lookAt(Math.sin(a) * 3, 1.0, Math.cos(a) * 3); g.add(w);
    const r = mesh(geo('winr', () => new THREE.TorusGeometry(.2, .035, 6, 20)), felt('#7a4e2e'), [Math.sin(a) * 1.07, 1.0, Math.cos(a) * 1.07]); r.lookAt(Math.sin(a) * 3, 1.0, Math.cos(a) * 3); g.add(r);
  }
  return g;
}
export function clocktower(faceMat) {
  const g = new THREE.Group(), stoneM = felt('#c9b8a0'), roofM = felt('#4b5aa8');
  g.add(slab(K.roundRectShape(1.3, 3.8, .1), 1.3, stoneM, .05).translateY(1.9));
  g.add(box(felt('#b5a389'), [0, 3.85, 0], [1.5, .16, 1.5]));
  g.add(cone(roofM, [0, 4.75, 0], 1.0, 1.7, [0, Math.PI / 4, 0], 4));
  g.add(ball(mat('#ffd86b', { metal: true }), [0, 5.65, 0], .1));
  const fm = faceMat || ownGlow('#fff6d8', '#ffd98a', .9);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, f = new THREE.Group(); f.position.set(Math.sin(a) * .7, 3.2, Math.cos(a) * .7); f.rotation.y = a;
    f.add(mesh(geo('cface', () => new THREE.CircleGeometry(.48, 28)), fm, [0, 0, .01]));
    f.add(mesh(geo('cring', () => new THREE.TorusGeometry(.48, .05, 6, 28)), mat('#c8901a', { metal: true }), [0, 0, .02]));
    f.add(capsule(gloss(INK), [0, 0, .05], [0, .3, .05], .03)); f.add(capsule(gloss('#d9577a'), [0, 0, .06], [.22, -.08, .06], .025));
    g.add(f);
  }
  g.add(slab(K.roundRectShape(.5, .8, .25), .1, felt('#7a4e2e'), .03).translateZ(.7).translateY(.4));
  return g;
}
function boat() {
  const g = new THREE.Group();
  const hull = latheArc([[0, -.25], [.4, -.2], [.55, .05], [.6, .2]], felt('#b0603c'), Math.PI / 2, Math.PI, 16);
  hull.scale.set(1, 1, 2.2); hull.rotation.y = Math.PI / 2; g.add(hull);
  g.add(box(felt('#d9a66a'), [0, .02, 0], [.9, .05, .2]));
  return g;
}
function crystalCluster(m, s = 1) {
  const g = new THREE.Group();
  [[0, 0, 0, .22, 1.1], [.25, 0, .1, .15, .7, .4], [-.22, 0, .05, .14, .6, -.45], [.05, 0, -.2, .12, .55, .2]].forEach(([x, y, z, r, h, tilt = 0]) => {
    const c = new THREE.Group(); c.add(mesh(geo('crys' + r + h, () => { const g = new THREE.CylinderGeometry(r * .6, r, h, 6); g.translate(0, h / 2, 0); return g; }), m)); c.add(mesh(geo('crysT' + r, () => { const g = new THREE.ConeGeometry(r * .6, r * 1.2, 6); g.translate(0, r * .6, 0); return g; }), m, [0, h, 0]));
    c.position.set(x, y, z); c.rotation.z = tilt; c.rotation.x = tilt * .3; g.add(c);
  });
  g.scale.setScalar(s); return g;
}
function carrotRow(n, len) {
  const g = new THREE.Group();
  g.add(slab(K.roundRectShape(len, .7, .3), .25, felt('#6b4a33'), .08).rotateX(-Math.PI / 2).translateZ(.05));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + .5) * len / n;
    g.add(cone(felt('#f08a3a'), [x, .22, 0], .09, .25, [Math.PI, 0, 0], 8));
    for (let j = 0; j < 3; j++) g.add(ball(felt('#6fae66'), [x + (j - 1) * .05, .45, 0], [.04, .18, .04], [0, 0, (j - 1) * .4]));
  }
  return g;
}
function basketModel(berry) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.32, 0], [.42, .3], [.45, .32], [0, .32]], felt('#c58a4e'), 18));
  g.add(torus(felt('#a8743c'), [0, .32, 0], .44, .04, [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.TorusGeometry(.4, .03, 6, 20, Math.PI), felt('#a8743c'), [0, .32, 0]));
  if (berry) for (let i = 0; i < 7; i++) { const a = i * 2.4; g.add(ball(berry, [Math.cos(a) * .2 * (i % 2 + .4), .34, Math.sin(a) * .2 * (i % 2 + .4)], .1)); }
  return g;
}

/* ---------------- landmarks on the floating map island (about 2.4 tall) ----------------
   Each returns a group with userData.lights = materials that glow brighter once the land is explored. */
function mound(c = '#5f9a62', r = 1.45) { return lathe([[0, .32], [r * .55, .3], [r * .9, .18], [r, .04], [r * .98, -.05], [0, -.05]], felt(c), 28); }
export function landmark(key) {
  const g = new THREE.Group(), lights = [];
  const L = (c, gc, i) => { const m = ownGlow(c, gc, i); lights.push(m); return m; };
  if (key === 'N') {
    g.add(mound('#6aa86a'));
    const items = []; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .5 + (i % 3) * .3; items.push([Math.cos(a) * r, Math.sin(a) * r]); }
    items.forEach(([x, z], i) => { const f = K.flower(['#ffffff', '#fff2a8', '#f6a6bd'][i % 3], .9); f.position.set(x, .25, z); g.add(f); });
    const sm = L('#ffe9a0', '#ffc94a', 1.6);
    g.add(capsule(felt('#6b4a33'), [0, .2, 0], [0, 1.6, 0], .05));
    g.add(mesh(K.starGeo(), sm, [0, 2.0, 0], .42));
    const ff = []; [[-.8, 1.2, .4], [.7, 1.5, .2], [.3, .8, .8], [-.4, 1.8, -.3]].forEach(p => { const s = glow('#ffe27a', .7, .9); s.position.set(...p); g.add(s); ff.push(s); });
    g.userData.sparks = ff;
  } else if (key === 'P') {
    g.add(mound('#7f86a3', 1.4));
    const rm = felt('#9a9ab8'), rm2 = felt('#8686a6');
    [[0, .7, -.3, .95, .85], [-.75, .45, .1, .6, .55], [.75, .45, 0, .55, .6], [.3, 1.25, -.4, .55, .45]].forEach(([x, y, z, sx, sy], i) => g.add(ball(i % 2 ? rm2 : rm, [x, y, z], [sx, sy, sx * .9])));
    g.add(mesh(new THREE.CircleGeometry(.42, 24, 0, Math.PI), felt('#1d1938'), [0, .3, .62], [1, 1.1, 1], [-.15, 0, 0]));
    const cm = L('#9df5e8', '#4fd8c8', 1.3), cm2 = L('#f2b8ff', '#c56ae8', 1.2);
    const c1 = crystalCluster(cm, .9); c1.position.set(-.7, .55, .45); g.add(c1);
    const c2 = crystalCluster(cm2, .8); c2.position.set(.75, .6, .4); c2.rotation.y = 1; g.add(c2);
    const c3 = crystalCluster(cm, .7); c3.position.set(.15, 1.6, -.3); g.add(c3);
  } else if (key === 'A') {
    g.add(mound('#6aa86a'));
    const c = cottage('#c46a4a', '#fff1d6', L('#ffe0a0', '#ffb84a', 1.4)); c.scale.setScalar(.72); c.position.z = -.15; g.add(c);
    const cc = cupcake(); cc.scale.setScalar(.45); cc.position.set(.95, .3, .55); g.add(cc);
    const cc2 = cupcake(); cc2.scale.setScalar(.35); cc2.position.set(-.95, .3, .5); g.add(cc2);
  } else if (key === 'S') {
    g.add(mound('#6aa86a'));
    const wm = L('#5f8fe0', '#3c6ad0', .6); wm.roughness = .15;
    const pond = lathe([[0, .33], [1.0, .33], [1.05, .3], [0, .3]], wm, 28); pond.scale.set(1, 1, .75); pond.position.z = .1; g.add(pond);
    const b = boat(); b.scale.setScalar(.75); b.position.set(.2, .45, .15); b.rotation.y = .4; g.add(b);
    const ot = fish(); ot.scale.setScalar(.22); ot.position.set(.2, .58, .15); g.add(ot);
    for (let i = 0; i < 7; i++) { const a = -2.4 + i * .5, r = 1.15; g.add(K.tube([[Math.cos(a) * r, .2, Math.sin(a) * r * .8], [Math.cos(a) * r + .03, .8, Math.sin(a) * r * .8], [Math.cos(a) * r + .08, 1.3 + (i % 2) * .2, Math.sin(a) * r * .8]], .03, mat('#4f7f45'), 5, 4)); g.add(K.capsule(felt('#7a5a3a'), [Math.cos(a) * r + .07, 1.1 + (i % 2) * .2, Math.sin(a) * r * .8], [Math.cos(a) * r + .08, 1.35 + (i % 2) * .2, Math.sin(a) * r * .8], .05)); }
    g.add(mesh(new THREE.CircleGeometry(.22, 16, .3, 5.6), felt('#5c9a5e'), [-.55, .345, .35], 1, [-Math.PI / 2, 0, 0]));
  } else if (key === 'M') {
    g.add(mound('#5f9a62'));
    const bm = L('#8f7cff', '#6a54e8', .9);
    [[-.55, -.25, .75], [.55, -.35, .7], [0, .25, .6]].forEach(([x, z, s]) => { const b = bush('#3f7a4a', true, bm); b.scale.setScalar(s); b.position.set(x, .2, z); g.add(b); });
    const bk = basketModel(bm); bk.scale.setScalar(.9); bk.position.set(.85, .3, .7); g.add(bk);
    const cr = carrotRow(4, 1.2); cr.scale.setScalar(.7); cr.position.set(-.5, .3, .9); g.add(cr);
  } else if (key === 'F') {
    g.add(mound('#a69a8a', 1.4));
    const t = clocktower(L('#fff6d8', '#ffd98a', 1.0)); t.scale.setScalar(.5); t.position.set(0, .25, -.2); g.add(t);
    const s = stall('#d9577a', '#fff1d6', 1.6); s.scale.setScalar(.45); s.position.set(-.8, .25, .5); s.rotation.y = .4; g.add(s);
    const s2 = stall('#4b7bd1', '#fff1d6', 1.6); s2.scale.setScalar(.45); s2.position.set(.85, .25, .45); s2.rotation.y = -.4; g.add(s2);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const sparks = g.userData.sparks;
  freeze(g);
  g.userData.lights = lights; g.userData.sparks = sparks || [];
  return g;
}

/* ---------------- the land scenes (camera looks from +z toward the origin, guide stands front-right) ---------------- */
// Each returns { group, tick(t) } ; group sits on the shared ground world.
export function landScene(key) {
  const g = new THREE.Group(), still = new THREE.Group(), live = [];
  const at = (o, x, z, s = 1, ry = 0, y = 0) => { o.position.set(x, y, z); o.scale.multiplyScalar(s); o.rotation.y = ry; still.add(o); return o; };
  const trees = (list, tint) => list.forEach(([x, z, s], i) => at(K.tree(s, tint || (i % 2 ? '#3f6f4a' : '#477a52')), x, z, 1, i));
  let tick = () => {}, grassMask = null;
  if (key === 'N') {
    trees([[-9, -6, 1.3], [-12, -1, 1.1], [9.5, -7, 1.4], [12.5, -2, 1.2], [-6, -13, 1.2], [6, -14, 1.4]]);
    ['#ffffff', '#fff2a8', '#f6a6bd', '#c9b6ff'].forEach((c, j) => { const items = []; for (let i = 0; i < 26; i++) items.push({ p: [(Math.random() - .5) * 26, 0, -10 + Math.random() * 16], s: .6 + Math.random() * .5, ry: Math.random() * 6 }); g.add(K.scatter(K.flower(c), items)); });
    [[-6, .5, 1.3, '#e2566b'], [6.5, 1.5, 1.0, '#b9a6e8'], [-4.6, 3.4, .6, '#f2a7b5'], [7.5, -2, .8, '#e2566b']].forEach(([x, z, k, c]) => at(K.mushroom(c, k), x, z, 1, x));
    // firefly jars on a little shelf of lantern posts
    for (let i = 0; i < 3; i++) at(lanternPost(2 + i * .3), -8 + i * 1.6, -3.5 - i * .8, 1, .3);
    const tpl = K.firefly({}); const spots = [[-5, 2.4, -2], [5.5, 3.1, -3], [-7.4, 3.8, 1], [3, 4.2, -6]];
    spots.forEach(p => { const f = K.instance(tpl); f.position.set(...p); f.scale.setScalar(.55); f.userData.home = p; g.add(f); live.push(f); });
    tick = t => live.forEach((f, i) => { const h = f.userData.home; f.position.set(h[0] + Math.sin(t * .5 + i) * .8, h[1] + Math.sin(t * .8 + i * 2) * .3, h[2] + Math.cos(t * .4 + i) * .5); f.rotation.y = Math.sin(t * .5 + i) * .6; K.animate(f, t); });
  } else if (key === 'P') {
    // faceted boulders, a cave mouth and glowing crystals
    const rocks = [mat('#8586a8', { flat: true, rough: .9 }), mat('#74759a', { flat: true, rough: .9 }), mat('#9898ba', { flat: true, rough: .9 })];
    const boulder = (x, z, s, h, i) => { const b = mesh(geo('boulder' + (i % 3), () => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const k = 1 + Math.sin(p.getX(j) * 5 + i) * .08 + Math.cos(p.getZ(j) * 4 + i) * .08; p.setXYZ(j, p.getX(j) * k, p.getY(j) * k, p.getZ(j) * k); } g.computeVertexNormals(); return g; }), rocks[i % 3], [x, h * .3, z], [s, h, s * .85], [0, i, 0]); still.add(b); };
    [[-10, -7, 3.2, 3.6], [-6.5, -10, 3, 4.4], [-1.2, -9.5, 3.6, 3.6], [4, -10.5, 3.2, 4.6], [8.5, -8, 3.4, 3.8], [12, -4, 2.6, 2.8], [-12.5, -2.5, 2.4, 2.6], [-9, 1.5, 1.2, 1.1], [10.5, 2, 1.3, 1.2], [-5, -4.5, .8, .7], [6, -3.5, .9, .8], [-2, 4.2, .5, .4], [3.5, 5, .45, .35]].forEach(([x, z, sz, h], i) => boulder(x, z, sz, h, i));
    still.add(mesh(new THREE.CircleGeometry(1.8, 32, 0, Math.PI), mat('#141129'), [-1.2, 0, -6.6], [1, 1.35, 1]));
    for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI; boulder(-1.2 + Math.cos(a) * 2.05, -6.5, .55, .55, i + 3); still.children[still.children.length - 1].position.y = Math.sin(a) * 2.45; }
    const cm = mat('#9df5e8', { glow: 1.2, glowColor: '#4fd8c8' }), cm2 = mat('#f2b8ff', { glow: 1.1, glowColor: '#c56ae8' }), cm3 = mat('#bfd0ff', { glow: 1.1, glowColor: '#7f9cff' });
    [[-8, -2.2, 2.4, cm], [-10.5, 2.5, 1.6, cm2], [-6.2, 3.8, .9, cm3], [7.5, -2.5, 2.6, cm3], [10, 1.5, 1.7, cm], [5.8, 4.2, .8, cm2], [-3.6, -6.2, 1.2, cm2], [1.6, -6.3, 1.1, cm], [-1.5, 5.6, .5, cm], [2.4, 6.4, .45, cm3]].forEach(([x, z, s, m], i) => at(crystalCluster(m, s), x, z, 1, i));
    [[-8, -2.2, '#9ff4ff'], [7.5, -2.5, '#bcd0ff'], [-10.5, 2.5, '#f2b8ff'], [10, 1.5, '#9ff4ff'], [-1.2, -6.3, '#b9f6ee']].forEach(([x, z, c]) => { const s = glow(c, 5, .4); s.position.set(x, 1.5, z); g.add(s); });
    // a neat pile of crystal sticks and flats beside the gnome's lantern
    const rod = tenBlock('rod'); for (let i = 0; i < 5; i++) { const r = rod.clone(); r.rotation.set(0, .2, Math.PI / 2); r.position.set(6.4 + (i % 3) * .24 - (i > 2 ? -.12 : 0), .12 + (i > 2 ? .22 : 0), 2.8 + (i % 3) * .1); r.scale.setScalar(1.6); still.add(r); }
    const fl = tenBlock('flat'); for (let i = 0; i < 3; i++) { const f = fl.clone(); f.rotation.set(-Math.PI / 2, 0, .3); f.position.set(-6.4, .1 + i * .17, 4.6); f.scale.setScalar(1.6); still.add(f); }
    at(lanternPost(2.5), 8.2, 3.6, 1, 2.8); at(lanternPost(2.2), -8.6, 5.2, 1, .3);
    for (let i = 0; i < 24; i++) at(rock(.15 + Math.random() * .3, i % 2 ? '#8a8aaa' : '#a0a0bc'), (Math.random() - .5) * 24, -5 + Math.random() * 12, 1, i);
  } else if (key === 'A') {
    trees([[-11, -6, 1.3], [11, -8, 1.4], [13, -2, 1.1], [-7, -13, 1.2]]);
    at(cottage('#c46a4a'), -6.8, -3.5, 1.7, .5);
    const tbl = new THREE.Group();
    tbl.add(cyl(felt('#b07a4e'), [0, .55, 0], .9, .9, .1)); tbl.add(cyl(felt('#8a5a3a'), [0, .27, 0], .1, .14, .55));
    tbl.add(cyl(felt('#fffaf0'), [0, .61, 0], .95, .95, .03));
    [[0, -.3], [-.4, .25], [.42, .2], [0, .5]].forEach(([x, z], i) => { const c = cupcake(); c.scale.setScalar(.32); c.position.set(x, .62, z); tbl.add(c); });
    at(tbl, 6.5, -1.5, 1.4, 0);
    const pie = pieWhole(); at(pie, 6.2, -1.2, .45, 0, 1.0);
    // bunting between two poles
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-3 + t * 13, 4.2 - Math.sin(t * Math.PI) * .8, -6]); }
    still.add(K.tube(pts, .02, mat('#5a4630'), 30, 4));
    for (let i = 1; i < 12; i++) { const t = i / 12; const f = cone(felt(['#f2a7b5', '#ffd86b', '#a9d4ff', '#b8f0c8'][i % 4]), [-3 + t * 13, 4.2 - Math.sin(t * Math.PI) * .8 - .25, -6], .18, .4, [Math.PI, 0, 0], 3); still.add(f); }
    for (const x of [-3, 10]) still.add(capsule(felt('#6b4a33'), [x, 0, -6], [x, 4.3, -6], .07));
    const hp = gemModel('🍯'); at(hp, -4.2, 4.9, .45, .3, .38);
    const crate = new THREE.Group(); crate.add(box(felt('#b07a4e'), [0, .25, 0], [1.4, .5, .9])); crate.add(box(felt('#8a5a3a'), [0, .5, 0], [1.46, .06, .96]));
    [[-.4, .2], [.1, -.15], [.42, .22]].forEach(([x, z]) => { const c = cupcake(); c.scale.setScalar(.3); c.position.set(x, .53, z); crate.add(c); });
    at(crate, -5.6, 4.4, 1, .25);
    const hp2 = gemModel('🍯'); at(hp2, -7.4, 4.0, .45, -.4, .38);
    for (let i = 0; i < 3; i++) at(cyl(felt('#d9a66a'), [0, 0, 0], .35, .4, .5), 3 + i * .9, 3 + (i % 2) * .5, 1, 0, .25);
    const smoke = []; for (let i = 0; i < 5; i++) { const s = ball(felt('#d8d4e8'), [0, 0, 0], .3); s.userData.ph = i / 5; g.add(s); smoke.push(s); }
    const chim = new THREE.Vector3(-6.8 + .55 * 1.7 * Math.cos(.5) - .3 * 1.7 * Math.sin(.5), 2.95 * 1.7, -3.5 - .55 * 1.7 * Math.sin(.5) - .3 * 1.7 * Math.cos(.5));
    tick = t => smoke.forEach(s => { const k = (t * .15 + s.userData.ph) % 1; s.position.set(chim.x + Math.sin(k * 6) * .3, chim.y + .2 + k * 2.6, chim.z); s.scale.setScalar(.12 + k * .38); s.visible = k > .04; });
  } else if (key === 'S') {
    trees([[-11, -7, 1.3], [-14, -2, 1.1], [11, -8, 1.4], [14, -3, 1.2], [-4, -14, 1.2], [5, -15, 1.4]]);
    const water = new THREE.ShaderMaterial({
      transparent: true, fog: false, uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float t; varying vec2 vUv; varying vec3 vW; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ float w = n(vec2(vW.x*1.5 - t*.6, vW.z*5.)) * n(vec2(vW.x*.7+t*.3, vW.z*2.)); vec3 col = mix(vec3(.12,.2,.42), vec3(.3,.45,.8), w); float sp = pow(n(vec2(vW.x*8.-t*2., vW.z*20.)), 9.)*3.; col += vec3(1.,.92,.7)*sp; float edge = smoothstep(0.,.12,vUv.y)*smoothstep(1.,.88,vUv.y); gl_FragColor=vec4(col, .94*edge); }'
    });
    const rz = x => Math.sin(x * .18) * 1.0 + 1.6;
    grassMask = (x, z) => Math.abs(z - rz(x)) > 2.5;
    // water height follows the shared ground (same formula as world3d ground) so the river never dips under it
    const wy = (x, z) => { const d = Math.hypot(x, z * 1.2); return .1 + Math.sin(x * .35) * .1 + Math.cos(z * .3) * .08 + (d > 13 ? Math.min(4, (d - 13) * (d - 13) * .0012) + Math.sin(x * .25 + 1) * .4 * Math.min(1, (d - 13) / 5) : 0); };
    const rg = new THREE.PlaneGeometry(70, 4.6, 90, 4); rg.rotateX(-Math.PI / 2);
    const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); const z = p.getZ(i) + rz(x), d = Math.hypot(x, z * 1.2); p.setZ(i, z); p.setY(i, wy(x, z)); }
    const river = new THREE.Mesh(rg, water); river.renderOrder = 1; g.add(river);
    for (let i = 0; i < 40; i++) { const x = -16 + Math.random() * 32, side = Math.random() < .5 ? -1 : 1, z = rz(x) + side * (2.5 + Math.random() * .5); const r = new THREE.Group(); r.add(K.tube([[0, 0, 0], [.05, .8, 0], [.12, 1.5, .05]], .035, mat('#4f7f45'), 6, 4)); r.add(K.capsule(felt('#7a5a3a'), [.11, 1.35, .05], [.13, 1.75, .05], .07)); at(r, x, z, .8 + Math.random() * .4, Math.random() * 3); }
    [[-3, 0], [2.5, -1], [6, 0], [-7, -.5]].forEach(([x, dz]) => { at(mesh(new THREE.CircleGeometry(.5, 20, .3, Math.PI * 1.85), felt('#5c9a5e'), [0, 0, 0], 1, [-Math.PI / 2, 0, 0]), x, rz(x) + dz, 1, 0, wy(x, rz(x) + dz) + .03); });
    const bt = boat(); bt.scale.setScalar(1.6); g.add(bt);
    const crate = new THREE.Group(); crate.add(box(felt('#b07a4e'), [0, .2, 0], [.6, .3, .4])); for (let i = 0; i < 3; i++) { const f = fish(); f.scale.setScalar(.25); f.position.set(-.15 + i * .15, .42, 0); f.rotation.z = .3; crate.add(f); }
    crate.position.set(.2, .1, 0); bt.add(crate); freeze(bt);
    // a little jetty
    for (let i = 0; i < 6; i++) at(box(felt(i % 2 ? '#b07a4e' : '#a06c44'), [0, 0, 0], [.5, .1, 2.2]), -9 + i * .52, rz(-8) + 1.4, 1, 0, .5);
    for (const [x, z] of [[-9.2, .5], [-6.3, .5], [-9.2, 2.3], [-6.3, 2.3]]) at(capsule(felt('#7a4e2e'), [0, -.2, 0], [0, .7, 0], .08), x, rz(-8) + z, 1);
    for (let i = 0; i < 10; i++) at(rock(.25 + Math.random() * .3), (Math.random() - .5) * 24, rz(0) + (Math.random() < .5 ? -3.4 : 3.2) + Math.random(), 1, i);
    tick = t => { water.uniforms.t.value = t; bt.position.set(6.5 + Math.sin(t * .3) * 1.2, wy(6.5, rz(6.5)) - .05 + Math.sin(t * 1.3) * .05, rz(6.5) + .2); bt.rotation.set(0, Math.PI / 2 + .25 + Math.sin(t * .4) * .1, Math.sin(t * 1.1) * .04); };
  } else if (key === 'M') {
    trees([[-12, -8, 1.3], [12, -9, 1.4], [14, -3, 1.1], [-14, -2, 1.2]], '#3d6b48');
    const bm = new THREE.MeshPhysicalMaterial({ color: '#8f7cff', emissive: '#6a54e8', emissiveIntensity: .7, roughness: .2, clearcoat: 1 });
    [[-8, -2, 1.3], [-6, -5, 1.1], [7.5, -1.5, 1.4], [9.5, -4.5, 1.1], [-3.5, -7, 1], [4.5, -7.5, 1.2], [-10, 2, 1.1], [10.5, 2.2, 1]].forEach(([x, z, s], i) => at(bush(i % 2 ? '#3f7a4a' : '#467f50', true, bm), x, z, s, i));
    for (let i = 0; i < 3; i++) at(carrotRow(7, 4), -3.5 + i * .1, -2 - i * 1.3, 1, 0);
    for (let i = 0; i < 2; i++) at(carrotRow(6, 3.4), 3.8, -2.6 - i * 1.3, 1, 0);
    [[-6.5, 2.8], [-4.8, 3.6], [6.2, 3.2]].forEach(([x, z], i) => at(basketModel(bm), x, z, 1.2, i));
    // little picket fence
    for (let i = 0; i < 14; i++) { const x = -7 + i; at(slab(K.roundRectShape(.3, 1, .14), .08, felt('#fff1d6'), .02), x, -9, 1, 0, .5); }
    still.add(box(felt('#fff1d6'), [0, .65, -9], [14, .1, .06]));
    [[-8, -2], [7.5, -1.5], [-3.5, -7]].forEach(([x, z]) => { const s = glow('#b6a6ff', 3.5, .3); s.position.set(x, 1, z); g.add(s); });
    const wc = new THREE.Group(); wc.add(cyl(mat('#7fb6ea', { metal: true, shine: .1 }), [0, .3, 0], .3, .35, .6)); wc.add(capsule(mat('#7fb6ea', { metal: true }), [.3, .3, 0], [.65, .6, 0], .05)); wc.add(mesh(new THREE.TorusGeometry(.25, .04, 6, 16, Math.PI), mat('#7fb6ea', { metal: true }), [0, .6, 0]));
    at(wc, 8.6, 4.4, 1.1, -.5);
  } else if (key === 'F') {
    at(clocktower(), -7.5, -6, 1.6, .35);
    at(stall('#d9577a', '#fff1d6', 2.6), 7, -2.5, 1.3, -.45);
    at(stall('#4b7bd1', '#fff1d6', 2.6), -7.5, 0, 1.25, .5);
    at(stall('#6fae66', '#fff1d6', 2.6), 3.5, -7.5, 1.2, -.15);
    for (let i = 0; i < 3; i++) { const pp = pieWhole(); at(pp, 7 + (i - 1) * 1.1 * Math.cos(-.45), -2.5 - (i - 1) * 1.1 * Math.sin(-.45), .5, 0, 1.25); }
    // moon-cheese wheels and ribbon spools
    for (let i = 0; i < 3; i++) at(cyl(felt('#ffe08a'), [0, 0, 0], .55, .55, .4), -7.5 + (i - 1) * 1.1 * Math.cos(.5), 0 - (i - 1) * 1.1 * Math.sin(-.5), .7, 0, 1.3);
    // string of lights across the square
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-7 + t * 14, 5 - Math.sin(t * Math.PI) * .9, -8 + t * 2]); }
    still.add(K.tube(pts, .02, mat('#5a4630'), 30, 4));
    const bulb = mat('#ffe8b0', { glow: 1.6, glowColor: '#ffc95a' });
    for (let i = 1; i < 12; i++) { const t = i / 12; still.add(ball(bulb, [-7 + t * 14, 5 - Math.sin(t * Math.PI) * .9 - .15, -8 + t * 2], .12)); if (i % 2) { const s = glow('#ffcf66', 1.4, .6); s.position.set(-7 + t * 14, 4.85 - Math.sin(t * Math.PI) * .9, -8 + t * 2); g.add(s); } }
    for (let i = 0; i < 4; i++) at(lanternPost(2.3), [-10, 10.5, -3, 11][i], [-3, -6, -10, 1.5][i], 1, i);
  }
  still.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(freeze(still));
  return { group: g, tick, grassMask };
}
