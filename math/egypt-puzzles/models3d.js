// Miu's Magic Pyramids: the 3D models (all built in code, felt-toy style, using the shared kit).
//  - miu(): Miu the temple cat, a felt Egyptian cat with green eyes and a gold-and-lapis collar
//  - stoneBlock(): a sandstone puzzle stone with carved hieroglyphs (pixels, built to the DOM stone's size)
//  - faienceTile(): a glazed blue number tile
//  - scenery: palm, papyrus, obelisk, great pyramid, temple pylon, lamp, sun of Ra, felucca boat
//  - houseModel(): Miu's room as a little diorama, built to the DOM room's size
//  - iconModel(): small map icons for the six places on the Nile
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';

const { mat, ball, bead, mesh, capsule, lathe, tube, slab, roundRectShape, geo, freeze, glow } = K;

/* ------------------------------------------------------------------ palette */
export const C = {
  sand: '#e8c07a', sand2: '#dcae62', sand3: '#f0cf8e', carve: '#a8712e', carveDeep: '#8a5a22',
  gold: '#f1b928', goldDeep: '#c98a0c', lapis: '#1d4f91', lapisHi: '#2f6cc0', turq: '#27a39c',
  fur: '#3a3036', fur2: '#55494e', pink: '#e9a3ad', eye: '#9fd86b', wood: '#9a6527', wood2: '#b8853d',
  plaster: '#f0d6a2', palm: '#4f8a4a', palm2: '#5f9c52', trunk: '#8a6038'
};

/* ------------------------------------------------------------------ Miu (feet at y=0, ear tips near y=2.95) */
export function miu() {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const fur = mat(C.fur, { felt: true }), fur2 = mat(C.fur2, { felt: true }), pink = mat(C.pink, { felt: true });
  const gold = mat(C.gold, { metal: true, shine: .28 }), lapis = mat(C.lapis, { gloss: true }), turq = mat(C.turq, { gloss: true });
  // sitting body, round like a felt toy
  body.add(lathe([[0, 0], [.42, .01], [.6, .14], [.66, .42], [.58, .78], [.44, 1.08], [.26, 1.3], [0, 1.36]], fur, 30));
  body.add(ball(fur2, [0, .6, .48], [.34, .42, .24]));                       // soft lighter tummy
  for (const sx of [-1, 1]) {
    body.add(ball(fur, [sx * .42, .3, -.02], [.27, .3, .4]));                // haunches
    body.add(capsule(fur, [sx * .2, .82, .45], [sx * .22, .14, .6], .12));   // front legs
    body.add(ball(fur2, [sx * .22, .08, .68], [.15, .09, .17]));             // paws
    for (const tx of [-1, 0, 1]) body.add(bead(fur, [sx * .22 + tx * .06, .07, .83], [.035, .03, .02]));
  }
  // usekh collar: gold, lapis and turquoise bands with a gold pendant
  const arc = (r, t) => geo('usekh' + r + t, () => new THREE.TorusGeometry(r, t, 8, 30, Math.PI * 1.25));
  // each band hugs the sloping chest, so the collar drapes like a real broad collar
  const chestR = y => y > 1.08 ? .44 - .18 * (y - 1.08) / .22 : .58 - .14 * (y - .78) / .3;
  [[1.21, .05, gold], [1.15, .042, lapis], [1.09, .04, gold], [1.03, .042, turq], [.97, .046, gold]].forEach(([y, t, m]) => {
    const r = chestR(y) + t * .6;
    const x = mesh(arc(+r.toFixed(3), t), m, [0, y, 0], 1, [Math.PI / 2, 0, 0]); x.rotation.z = Math.PI / 2 - Math.PI * .625; body.add(x);
  });
  for (let i = 0; i < 9; i++) { const a = Math.PI / 2 + (i / 8 - .5) * Math.PI * 1.1, r = chestR(.92) + .04; body.add(bead(lapis, [Math.cos(a) * r, .92, Math.sin(a) * r], .04)); }
  body.add(mesh(geo('pend', () => new THREE.CylinderGeometry(.1, .1, .04, 20)), gold, [0, .84, chestR(.84) + .05], 1, [Math.PI / 2 - .3, 0, 0]));
  body.add(bead(lapis, [0, .84, chestR(.84) + .08], [.05, .05, .03]));
  // tail: curls up the right side
  const tail = new THREE.Group(); tail.position.set(.42, .16, -.3); tail.userData.live = true; tail.name = 'tail';
  tail.add(tube([[0, 0, 0], [.32, .02, -.08], [.55, .3, -.06], [.6, .7, .02], [.5, 1.0, .1]], .085, fur, 16, 8));
  tail.add(ball(fur, [.5, 1.0, .1], .09));
  tail.add(mesh(geo('tailband', () => new THREE.TorusGeometry(.095, .025, 6, 16)), gold, [.6, .72, .02], 1, [Math.PI / 2 - .2, 0, .2]));
  body.add(tail);
  // head
  const head = new THREE.Group(); head.position.set(0, 1.86, .04); head.userData.live = true; head.name = 'head'; body.add(head);
  head.add(ball(fur, [0, 0, 0], [.68, .6, .58]));
  for (const sx of [-1, 1]) head.add(ball(fur, [sx * .42, -.2, .14], [.3, .25, .3]));     // fluffy cheeks
  for (const sx of [-1, 1]) head.add(ball(fur2, [sx * .1, -.22, .5], [.14, .11, .1]));    // muzzle
  head.add(ball(pink, [0, -.1, .58], [.075, .05, .04]));                                    // nose
  head.add(ball(mat('#d98b8b', { felt: true }), [0, -.31, .58], [.05, .03, .02]));           // little mouth
  for (const sx of [-1, 1]) {                                                               // ears
    head.add(mesh(geo('ear', () => new THREE.ConeGeometry(.24, .5, 18)), fur, [sx * .4, .52, -.02], [1, 1, .6], [0, 0, -sx * .38]));
    head.add(mesh(geo('earin', () => new THREE.ConeGeometry(.15, .34, 14)), pink, [sx * .39, .5, .07], [1, 1, .35], [0, 0, -sx * .38]));
  }
  head.add(mesh(geo('earring', () => new THREE.TorusGeometry(.09, .022, 8, 18)), gold, [.55, .42, .05], 1, [0, .3, 0]));
  // whiskers
  const wh = mat('#e6dccf', { felt: true });
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++)
    head.add(tube([[sx * .2, -.2 + k * .05 - .03, .5], [sx * .45, -.18 + k * .07 - .05, .5], [sx * .7, -.16 + k * .11 - .1, .4]], .012, wh, 6, 4));
  // eyes: green glass with a soft pupil and two shines (live, for blinking)
  const eyesG = new THREE.Group(); eyesG.userData.live = true; eyesG.name = 'eyes'; eyesG.position.set(0, .06, 0); head.add(eyesG);
  const iris = mat(C.eye, { gloss: true }), pupil = mat('#1b1620', { gloss: true }), shine = mat('#fff8e0', { glow: .8 });
  for (const sx of [-1, 1]) {
    eyesG.add(ball(iris, [sx * .25, 0, .51], [.135, .155, .08]));
    eyesG.add(ball(pupil, [sx * .25, -.005, .575], [.06, .115, .04]));
    eyesG.add(bead(shine, [sx * .25 + .045, .06, .615], .035));
    eyesG.add(bead(shine, [sx * .25 - .035, -.05, .615], .018));
  }
  // rosy cheeks
  const face = new THREE.Group(); face.position.set(0, 0, 0); head.add(face);
  K.cheeks(face, { y: -.14, x: .44, z: .47, scale: 1 });
  face.children.forEach(c => { c.scale.setScalar(.12); });
  Object.assign(root.userData, { kind: 'miu', body, head, swish: tail, eyes: eyesG, mood: 'idle', t0: Math.random() * 10, blink: 2 + Math.random() * 3 });
  freeze(root);
  return root;
}
export function animateMiu(o, t, dt) {
  const u = o.userData, k = t + u.t0, happy = u.mood === 'happy';
  u.body.position.y = happy ? Math.abs(Math.sin(k * 9)) * .25 : 0;
  u.body.scale.set(1 + Math.sin(k * 2.2) * .012, 1 - Math.sin(k * 2.2) * .012, 1);
  u.head.rotation.z = happy ? Math.sin(k * 8) * .12 : Math.sin(k * .8) * .07;
  u.head.rotation.x = Math.sin(k * .6) * .04;
  u.head.rotation.y = Math.sin(k * .45) * .12;
  u.swish.rotation.z = Math.sin(k * (happy ? 7 : 1.6)) * (happy ? .25 : .14);
  u.swish.rotation.y = Math.sin(k * 1.1) * .2;
  u.blink -= dt;
  if (u.blink < 0) { u.blink = 2.5 + Math.random() * 3.5; u.blinkT = .16; }
  if (u.blinkT > 0) { u.blinkT -= dt; u.eyes.scale.y = .12; } else u.eyes.scale.y = 1;
}

/* ------------------------------------------------------------------ hieroglyphs (flat shapes, unit size about 1) */
function glyphShapes(kind) {
  const out = [];
  const circle = (x, y, r, hole) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); if (hole) { const h = new THREE.Path(); h.absarc(x, y, hole, 0, Math.PI * 2, true); s.holes.push(h); } return s; };
  const rect = (x, y, w, h) => { const s = new THREE.Shape(); s.moveTo(x - w / 2, y - h / 2); s.lineTo(x + w / 2, y - h / 2); s.lineTo(x + w / 2, y + h / 2); s.lineTo(x - w / 2, y + h / 2); s.closePath(); return s; };
  if (kind === 'ankh') {
    const loop = new THREE.Shape(); loop.absellipse(0, .28, .2, .26, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absellipse(0, .3, .1, .15, 0, Math.PI * 2, true); loop.holes.push(h);
    out.push(loop, rect(0, -.05, .55, .12), rect(0, -.32, .14, .52));
  } else if (kind === 'eye') {
    const e = new THREE.Shape(); e.moveTo(-.45, .05); e.quadraticCurveTo(0, .38, .45, .05); e.quadraticCurveTo(0, -.22, -.45, .05);
    const h = new THREE.Path(); h.moveTo(-.33, .05); h.quadraticCurveTo(0, -.12, .33, .05); h.quadraticCurveTo(0, .26, -.33, .05); e.holes.push(h);
    out.push(e, circle(0, .06, .1), rect(-.05, -.25, .08, .3), rect(.42, .2, .26, .07));
    const tail = new THREE.Shape(); tail.moveTo(.05, -.12); tail.quadraticCurveTo(.3, -.2, .28, -.42); tail.lineTo(.2, -.42); tail.quadraticCurveTo(.2, -.24, .02, -.2); tail.closePath(); out.push(tail);
  } else if (kind === 'sun') {
    out.push(circle(0, .05, .3, .12), rect(0, -.38, .7, .08));
  } else if (kind === 'water') {
    for (const y of [.18, -.12]) { const s = new THREE.Shape(); s.moveTo(-.45, y); for (let i = 1; i <= 6; i++) s.lineTo(-.45 + i * .15, y + (i % 2 ? .12 : 0)); for (let i = 6; i >= 0; i--) s.lineTo(-.45 + i * .15, y + (i % 2 ? .12 : 0) - .07); s.closePath(); out.push(s); }
  } else if (kind === 'reed') {
    const s = new THREE.Shape(); s.moveTo(0, -.45); s.quadraticCurveTo(.22, -.05, .05, .45); s.quadraticCurveTo(-.15, .1, 0, -.45); out.push(s, rect(.05, -.42, .3, .06));
  } else if (kind === 'bird') {
    const s = new THREE.Shape(); s.moveTo(-.4, -.05); s.quadraticCurveTo(-.2, .25, .1, .2); s.lineTo(.3, .32); s.lineTo(.28, .18); s.quadraticCurveTo(.35, -.05, .1, -.15); s.lineTo(-.45, -.35); s.closePath(); out.push(s, rect(-.05, -.38, .06, .14), rect(.08, -.38, .06, .14));
  } else if (kind === 'scarab') {
    const s = new THREE.Shape(); s.absellipse(0, -.05, .22, .3, 0, Math.PI * 2, false); out.push(s, circle(0, .32, .12));
    for (const sx of [-1, 1]) out.push(rect(sx * .3, .05, .2, .05), rect(sx * .3, -.2, .2, .05));
  }
  return out;
}
const GLYPHS = ['ankh', 'eye', 'sun', 'water', 'reed', 'bird', 'scarab'];
function glyphGeo(kind) {
  return geo('glyph-' + kind, () => {
    const g = new THREE.ExtrudeGeometry(glyphShapes(kind), { depth: .06, bevelEnabled: false, curveSegments: 10 });
    return g;
  });
}
export function glyph(kind, m, size) { return mesh(glyphGeo(kind), m, [0, 0, 0], [size, size, size]); }

/* ------------------------------------------------------------------ puzzle stones (pixels: w x h is the DOM stone) */
const sandMats = [C.sand, '#e4b770', '#ecc583'];
export function stoneBlock(w, h, { cap = false, hole = false, seed = 0 } = {}) {
  const g = new THREE.Group();
  const d = h * .5, b = Math.min(h * .07, 7), r = Math.min(h * .14, 14);
  if (hole) {
    // an empty socket: a darker, sunken stone outline so the gap reads as a missing block
    const niche = slab(roundRectShape(w - b * 2, h - b * 2, r), d * .25, mat('#c99a5a', { felt: true }), b * .6);
    niche.position.z = -d * .45; g.add(niche);
    const rim = roundRectShape(w, h, r); rim.holes.push(roundRectShape(w - h * .14, h - h * .14, r * .7));
    const rm = slab(rim, d * .35, mat('#d6a964', { felt: true }), 0); rm.position.z = -d * .25; g.add(rm);
    return freeze(g);
  }
  const body = cap ? mat('#f6c64a', { metal: true, shine: .18 }) : mat(sandMats[seed % 3], { felt: true });
  const carve = cap ? mat('#b9800f', { metal: true, shine: .05 }) : mat(C.carve, { felt: true });
  const blk = slab(roundRectShape(w - b * 2, h - b * 2, r), d, body, b); g.add(blk);
  const fz = d / 2 + b + .5;
  // carved frame line just inside the edge
  const ring = roundRectShape(w * .9, h * .86, r * .7); ring.holes.push(roundRectShape(w * .9 - h * .05, h * .86 - h * .05, r * .6));
  const rr = slab(ring, 1.2, carve, 0); rr.position.z = fz; g.add(rr);
  // two small hieroglyphs in the upper corners, picked from the stone's place in the pyramid
  const gs = h * .17, gx = w / 2 - w * .05 - h * .05 - gs * .55, gy = h / 2 - h * .07 - h * .03 - gs * .55;
  [[-gx, gy, GLYPHS[seed % GLYPHS.length]], [gx, gy, GLYPHS[(seed * 3 + 2) % GLYPHS.length]]].forEach(([x, y, k]) => {
    const m = glyph(k, carve, gs); m.position.set(x, y, fz); g.add(m);
  });
  // a carved base line
  const base = slab(roundRectShape(w * .5, h * .028, h * .014), 1.2, carve, 0); base.position.set(0, -h * .36, fz); g.add(base);
  // sandstone layer lines on the sides
  for (const y of [-h * .18, h * .14]) {
    for (const sx of [-1, 1]) { const ln = mesh(geo('layer', () => new THREE.BoxGeometry(1, 1, 1)), carve, [sx * (w / 2 + .3), y, 0], [1.5, h * .025, d * .9]); g.add(ln); }
  }
  if (cap) { const sp = glow('#fff1b0', h * 1.6, .35); sp.position.z = -d; g.add(sp); }
  return freeze(g);
}

/* ------------------------------------------------------------------ faience number tile (pixels) */
export function faienceTile(w, h) {
  const g = new THREE.Group();
  const d = w * .34, b = Math.min(w * .08, 6), r = w * .2;
  g.add(slab(roundRectShape(w - b * 2, h - b * 2, r), d, mat(C.lapisHi, { gloss: true }), b));
  const ring = roundRectShape(w * .86, h * .86, r * .8); ring.holes.push(roundRectShape(w * .86 - w * .07, h * .86 - w * .07, r * .7));
  const rr = slab(ring, 1.5, mat(C.gold, { metal: true, shine: .3 }), .6); rr.position.z = d / 2 + b + .5; g.add(rr);
  // tiny gold lotus dots in the corners
  for (const [x, y] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) g.add(bead(mat(C.gold, { metal: true, shine: .3 }), [x * w * .3, y * h * .3, d / 2 + b + .5], [w * .028, w * .028, 1]));
  return freeze(g);
}

/* ------------------------------------------------------------------ scenery (meters) */
export function palm(bend = .35, s = 1) {
  const p = new THREE.Group();
  const trunkM = mat(C.trunk, { felt: true }), trunk2 = mat('#7a5230', { felt: true });
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * bend * 2.2, t * 5.2, 0)); }
  // trunk: stacked felt segments, each a little wider at the top like palm bark
  const seg = geo('palmseg', () => new THREE.CylinderGeometry(1, .78, 1, 9, 1));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 8; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b), r = .25 - i * .012;
    const m = mesh(seg, i % 2 ? trunkM : trunk2, [(a.x + b.x) / 2, (a.y + b.y) / 2, 0], [r, len * 1.06, r]);
    m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); p.add(m);
  }
  const top = pts[8];
  const leaf = mat(C.palm, { felt: true }), leaf2 = mat(C.palm2, { felt: true });
  const fr = geo('frond', () => new THREE.SphereGeometry(1, 8, 5));
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + .2, m = i % 2 ? leaf : leaf2;
    const f = new THREE.Group(); f.position.copy(top); f.rotation.y = a;
    f.add(mesh(fr, m, [0, .25, .9], [.26, .07, 1.0], [-.35, 0, 0]));
    f.add(mesh(fr, m, [0, -.25, 2.2], [.22, .06, .8], [.55, 0, 0]));
    p.add(f);
  }
  p.add(mesh(fr, leaf2, [top.x, top.y + .1, 0], .35));
  const date = mat('#b0642c', { felt: true });
  for (let i = 0; i < 4; i++) { const a = i * 2.1; p.add(bead(date, [top.x + Math.cos(a) * .3, top.y - .35 - (i % 3) * .08, Math.sin(a) * .3], .12)); }
  p.scale.setScalar(s);
  return freeze(p);
}
export function papyrus(s = 1) {
  const p = new THREE.Group();
  const stem = mat('#5f8f45', { felt: true }), fan = mat('#86b35a', { felt: true });
  [[0, 0, 1.6], [.18, .1, 1.25], [-.15, .12, 1.1]].forEach(([x, z, hgt], i) => {
    p.add(tube([[x, 0, z], [x + .03, hgt * .5, z], [x + .08 * (i - 1), hgt, z]], .03, stem, 5, 4));
    p.add(mesh(geo('pfan', () => new THREE.ConeGeometry(.22, .3, 10, 1, true)), fan, [x + .08 * (i - 1), hgt + .1, z], 1, [Math.PI, 0, 0]));
  });
  p.scale.setScalar(s);
  return freeze(p);
}
export function obelisk(h = 7) {
  const o = new THREE.Group();
  const stone = mat('#e3b56c', { felt: true }), carve = mat(C.carve, { felt: true }), gold = mat(C.gold, { metal: true, shine: .35 });
  o.add(mesh(new THREE.BoxGeometry(1.8, .5, 1.8), mat('#cf9f5a', { felt: true }), [0, .25, 0]));
  const shaft = new THREE.CylinderGeometry(.42, .62, h, 4, 1); shaft.rotateY(Math.PI / 4);
  o.add(mesh(shaft, stone, [0, .5 + h / 2, 0]));
  const tip = new THREE.ConeGeometry(.59, .9, 4); tip.rotateY(Math.PI / 4);
  o.add(mesh(tip, gold, [0, .5 + h + .45, 0]));
  for (let i = 0; i < 5; i++) {
    const y = .5 + h * .78 - i * h * .14, wHalf = .62 - (y - .5) / h * .2;
    const g = glyph(GLYPHS[i % GLYPHS.length], carve, .42); g.position.set(0, y, wHalf * .705 + .02); o.add(g);
  }
  return freeze(o);
}
export function greatPyramid(r = 10, hgt = 9) {
  const g = new THREE.Group();
  const geoP = new THREE.ConeGeometry(r, hgt, 4, 1); geoP.rotateY(Math.PI / 4);
  g.add(mesh(geoP, mat('#e2b26a', { rough: .95, flat: true }), [0, hgt / 2, 0]));
  // courses of stone: faint step lines
  const step = mat('#c99752', { rough: .95, flat: true });
  for (let i = 1; i < 6; i++) {
    const t = i / 6, rr = r * (1 - t) + .05;
    const ln = new THREE.CylinderGeometry(rr, rr, hgt * .012, 4, 1, true); ln.rotateY(Math.PI / 4);
    g.add(mesh(ln, step, [0, hgt * t, 0]));
  }
  const capG = new THREE.ConeGeometry(r * .12, hgt * .12, 4); capG.rotateY(Math.PI / 4);
  g.add(mesh(capG, mat(C.gold, { metal: true, shine: .5 }), [0, hgt * .94 + .02, 0]));
  return freeze(g);
}
export function column(h = 4.5) {
  const c = new THREE.Group();
  const stone = mat('#ecc98f', { felt: true });
  c.add(lathe([[0, 0], [.55, 0], [.55, .25], [.42, .3], [.38, h * .85], [.62, h * .93], [.66, h], [0, h]], stone, 18));
  [[C.lapis, h * .2], [C.turq, h * .24], [C.gold, h * .7]].forEach(([col, y]) => c.add(mesh(geo('colband', () => new THREE.CylinderGeometry(.41, .41, .14, 18, 1, true)), mat(col, { felt: true }), [0, y, 0])));
  c.add(mesh(new THREE.BoxGeometry(1.5, .3, 1.5), stone, [0, h + .15, 0]));
  return c;
}
export function temple() {
  const t = new THREE.Group();
  const stone = mat('#e6bd7c', { felt: true }), stone2 = mat('#d9ab66', { felt: true });
  // pylon towers (sloped)
  for (const sx of [-1, 1]) {
    const tw = new THREE.CylinderGeometry(2.3, 3.0, 8, 4, 1); tw.rotateY(Math.PI / 4); tw.scale(1.5, 1, .6);
    t.add(mesh(tw, stone, [sx * 5.2, 4, 0]));
    t.add(mesh(new THREE.BoxGeometry(5.4, .5, 2.2), stone2, [sx * 5.2, 8.2, 0]));
    // painted bands and a big carved eye on each tower
    t.add(mesh(new THREE.BoxGeometry(4.9, .28, .1), mat(C.lapis, { felt: true }), [sx * 5.2, 7.2, 1.03]));
    t.add(mesh(new THREE.BoxGeometry(4.95, .18, .1), mat(C.gold, { felt: true }), [sx * 5.2, 6.9, 1.06]));
    const e = glyph(sx < 0 ? 'eye' : 'ankh', mat(C.lapis, { felt: true }), 1.8); e.position.set(sx * 5.2, 5.0, 1.12); t.add(e);
  }
  // gateway
  t.add(mesh(new THREE.BoxGeometry(3.2, 6.4, 1.6), stone2, [0, 3.2, -.3]));
  t.add(mesh(new THREE.BoxGeometry(2.0, 4.6, .2), mat('#5a3a20', { felt: true }), [0, 2.3, .55]));
  t.add(mesh(new THREE.BoxGeometry(3.8, .7, 1.9), stone, [0, 6.6, -.2]));
  const sun = glyph('sun', mat(C.gold, { metal: true, shine: .4 }), 1.4); sun.position.set(0, 6.6, .78); t.add(sun);
  // columns in front
  for (const x of [-8.6, -2.6, 2.6, 8.6]) { const c = column(4.6); c.position.set(x, 0, 3.4); t.add(c); }
  return freeze(t);
}
// a standing brazier lamp; the flame is separate so it can flicker
export function lampStand() {
  const l = new THREE.Group();
  const gold = mat(C.gold, { metal: true, shine: .3 }), dark = mat('#6b4320', { felt: true });
  l.add(lathe([[0, 0], [.35, 0], [.3, .12], [.08, .2], [.06, 1.5], [.12, 1.6], [0, 1.6]], dark, 12));
  l.add(lathe([[0, 1.55], [.12, 1.55], [.42, 1.75], [.5, 1.95], [.44, 1.95], [.3, 1.8], [0, 1.78]], gold, 18));
  return freeze(l);
}
export const flameMat = new THREE.MeshStandardMaterial({ color: '#ff9a40', emissive: '#ff7a1a', emissiveIntensity: 1.6, roughness: .5 });
export function flame() {
  const f = new THREE.Group();
  f.add(lathe([[0, 0], [.16, .04], [.18, .14], [.1, .32], [0, .5]], flameMat, 10));
  const g = glow('#ff9a3a', 2, .5); g.position.y = .2; f.add(g);
  f.userData.halo = g;
  return f;
}
export function sunOfRa(r = 4) {
  const s = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ color: '#ffd77a', emissive: '#ffae3a', emissiveIntensity: 1.25, roughness: 1, fog: false });
  s.add(ball(face, [0, 0, 0], r));
  s.add(glow('#ffb860', r * 8, .6));
  const fg = new THREE.Group(); s.add(fg);
  K.eyes(fg, { y: .1, x: .3, z: 1, r: .07, closed: true, scale: r, ink: '#c46a1c' });
  K.smile(fg, { y: -.22, z: .98, w: .12, scale: r, color: '#c46a1c' });
  freeze(s);
  s.traverse(o => { if (o.material) o.material.fog = false; });
  return s;
}
export function felucca() {
  const b = new THREE.Group();
  const wood = mat('#8a5a32', { felt: true }), sail = mat('#fff4dc', { felt: true, side: THREE.DoubleSide });
  const hull = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  b.add(mesh(hull, wood, [0, .45, 0], [.8, .5, 2.1]));
  b.add(mesh(new THREE.CylinderGeometry(.79, .79, .08, 20), mat('#a8743f', { felt: true }), [0, .44, 0], [1, 1, 2.6]));
  b.add(capsule(wood, [0, .4, .3], [0, 4, .3], .06));
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, 3.6); sh.lineTo(-2.4, .3); sh.closePath();
  const sg = new THREE.ShapeGeometry(sh); const sm = mesh(sg, sail, [0, .6, .3], 1, [0, Math.PI / 2 + .3, 0]); b.add(sm);
  b.add(tube([[0, 4, .3], [-.2, 2.2, -1.6], [-.1, .7, -1.9]], .025, wood, 8, 4));
  return freeze(b);
}
export function dune(color, s) { return ball(mat(color, { felt: true }), [0, 0, 0], s); }

/* ------------------------------------------------------------------ Miu's house diorama (pixels, w x h is the DOM room) */
// Depth runs into the screen (negative z). cz is the camera distance, used to keep the back wall lined up
// with the DOM percentages despite the slight perspective.
export function houseModel(w, h, cz) {
  const g = new THREE.Group();
  const D = h * .2;
  const at = (xp, yp, z) => { const k = (cz - z) / cz; return [(-w / 2 + xp * w) * k, (h / 2 - yp * h) * k, z]; };
  const box = (m, xp, yp, wp, hp, z, depth) => { const k = (cz - z) / cz; const [x, y] = at(xp + wp / 2, yp + hp / 2, z); return mesh(geo('ubox', () => new THREE.BoxGeometry(1, 1, 1)), m, [x, y, z], [wp * w * k, hp * h * k, depth]); };
  const zw = -D - 6; const kw = (cz - zw) / cz;
  // back wall with rounded corners
  const wall = slab(roundRectShape(w * kw, h * kw, 22 * kw), 8, mat(C.plaster, { felt: true }), 0); wall.position.set(0, 0, zw - 4); g.add(wall);
  // frieze: lapis, gold and turquoise tiles
  const lap = mat(C.lapis, { felt: true }), gld = mat(C.gold, { felt: true }), tq = mat(C.turq, { felt: true }), edge = mat('#9a6527', { felt: true });
  for (let x = 0; x < 1; x += .16) {
    [[0, .06, lap], [.06, .02, gld], [.08, .06, tq], [.14, .02, gld]].forEach(([o, wd, m]) => { if (x + o < 1) g.add(box(m, x + o, .04, Math.min(wd, 1 - x - o), .06, zw + 3, 6)); });
  }
  g.add(box(edge, 0, .1, 1, .024, zw + 4, 8));
  // painted lotus band and glyphs on the wall
  const paint = mat('#3d6fae', { felt: true });
  [[.19, .55, 'ankh'], [.81, .55, 'eye'], [.12, .66, 'water'], [.88, .66, 'water'], [.25, .66, 'sun'], [.75, .66, 'bird']].forEach(([xp, yp, k]) => {
    const [x, y] = at(xp, yp, zw + 2); const m = glyph(k, paint, h * .07 * kw); m.position.set(x, y, zw + 2); g.add(m);
  });
  // window: arched wooden frame with the desert at sunset outside
  const [wx, wy] = at(.5, .29, zw + 2);
  const ww = w * .18 * kw, wh = h * .26 * kw;
  const sky = document.createElement('canvas'); sky.width = 8; sky.height = 64;
  const sx = sky.getContext('2d'); const gr = sx.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#6f8fd6'); gr.addColorStop(.45, '#f5b98a'); gr.addColorStop(.7, '#ffd59a'); gr.addColorStop(.72, '#e2b06a'); gr.addColorStop(1, '#d49a52');
  sx.fillStyle = gr; sx.fillRect(0, 0, 8, 64);
  const tex = new THREE.CanvasTexture(sky); tex.colorSpace = THREE.SRGBColorSpace;
  const archS = new THREE.Shape(); const rr = ww / 2;
  archS.moveTo(-ww / 2, -wh / 2); archS.lineTo(ww / 2, -wh / 2); archS.lineTo(ww / 2, wh / 2 - rr * .8); archS.absellipse(0, wh / 2 - rr * .8, ww / 2, rr * .8, 0, Math.PI, false); archS.lineTo(-ww / 2, -wh / 2);
  const view = new THREE.Mesh(new THREE.ShapeGeometry(archS, 20), new THREE.MeshBasicMaterial({ map: tex }));
  // map uv to the shape's bounds
  const pa = view.geometry.attributes.position, uv = view.geometry.attributes.uv;
  for (let i = 0; i < pa.count; i++) uv.setXY(i, .5, (pa.getY(i) + wh / 2) / wh);
  view.position.set(wx, wy, zw + 1); g.add(view);
  const sunM = new THREE.MeshBasicMaterial({ color: '#fff1b8' });
  g.add(mesh(geo('wsun', () => new THREE.CircleGeometry(1, 24)), sunM, [wx + ww * .16, wy - wh * .02, zw + 1.5], ww * .12));
  // little pyramids on the horizon
  const pyrM = new THREE.MeshBasicMaterial({ color: '#c98a4a' });
  [[-.2, .17], [.02, .12], [.24, .09]].forEach(([px, ps]) => { const tri = new THREE.Shape(); tri.moveTo(-1, 0); tri.lineTo(1, 0); tri.lineTo(0, .85); tri.closePath(); g.add(mesh(new THREE.ShapeGeometry(tri), pyrM, [wx + px * ww, wy - wh * .22, zw + 1.6], ww * ps)); });
  // frame: thick outline of the arch
  const outer = new THREE.Shape(); const fw = ww + 14 * kw, fh = wh + 14 * kw, fr = fw / 2;
  outer.moveTo(-fw / 2, -fh / 2); outer.lineTo(fw / 2, -fh / 2); outer.lineTo(fw / 2, fh / 2 - fr * .8); outer.absellipse(0, fh / 2 - fr * .8 - 0, fw / 2, fr * .8, 0, Math.PI, false); outer.lineTo(-fw / 2, -fh / 2);
  outer.holes.push(new THREE.Path(archS.getPoints(24).reverse().map(p => new THREE.Vector2(p.x, p.y + 0))));
  const fm = slab(outer, 10, mat(C.wood2, { felt: true }), 1.5); fm.position.set(wx, wy, zw + 6); g.add(fm);
  g.add(box(mat(C.wood2, { felt: true }), .4, .42 - .012, .2, .03, zw + 12, 22)); // sill
  // shelves with brackets
  const wood = mat(C.wood, { felt: true });
  for (const xp of [.06, .68]) {
    g.add(box(wood, xp, .4, .26, .03, zw + 22, 44));
    for (const bx of [.04, .2]) g.add(box(wood, xp + bx, .43, .015, .05, zw + 8, 16));
  }
  // papyrus columns at the sides
  for (const xp of [.025, .975]) {
    const [x] = at(xp, 0, zw + 20);
    const col = lathe([[0, 0], [1, 0], [.8, .05], [.72, .82], [1.25, .9], [1.3, 1], [0, 1]], mat('#ecc98f', { felt: true }), 16);
    const k = (cz - zw - 20) / cz;
    col.scale.set(w * .025 * k, h * .62 * k, w * .025 * k); col.position.set(x, (h / 2 - .72 * h) * k, zw + 20); g.add(col);
    const [, yb] = at(0, .25, zw + 20);
    g.add(mesh(geo('cband', () => new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)), mat(C.lapis, { felt: true }), [x, yb, zw + 20], [w * .019 * k, h * .02 * k, w * .019 * k]));
    const [, yc] = at(0, .6, zw + 20);
    g.add(mesh(geo('cband', () => new THREE.CylinderGeometry(1, 1, 1, 16, 1, true)), mat(C.gold, { felt: true }), [x, yc, zw + 20], [w * .019 * k, h * .02 * k, w * .019 * k]));
  }
  // floor: planks sloping toward us from the bottom of the wall
  const p1 = mat('#e9c27e', { felt: true }), p2 = mat('#dfb46c', { felt: true });
  const floor = new THREE.Group();
  const [, yTop] = at(0, .7, zw + 4), yBot = -h / 2, depth = -(zw + 4);
  const len = Math.hypot(yTop - yBot, depth), ang = Math.atan2(depth, yTop - yBot);
  const n = Math.round(1 / .037);
  for (let i = 0; i < n; i++) floor.add(mesh(geo('ubox', () => new THREE.BoxGeometry(1, 1, 1)), i % 2 ? p1 : p2, [-w / 2 + (i + .5) * w / n, len / 2, 0], [w / n + .5, len, 4]));
  floor.rotation.x = -ang; floor.position.set(0, yBot, 0);
  g.add(floor);
  g.add(box(mat('#c98f4e', { felt: true }), 0, .695, 1, .014, zw + 7, 10)); // skirting
  // table on the floor
  const tz = zw + D * .3, tm = mat('#a56a2c', { felt: true }), tl = mat('#8a5520', { felt: true });
  g.add(box(tm, .38, .58, .24, .032, tz, 60));
  for (const lx of [.42, .565]) g.add(box(tl, lx, .612, .014, .13, tz + 18, 10));
  for (const lx of [.42, .565]) g.add(box(tl, lx, .612, .014, .1, tz - 18, 10));
  // rug: rings of red, gold and blue lying on the sloping floor
  const phi = Math.atan2(yTop - yBot, depth);
  const floorZ = yp => (zw + 4) * (1 - (yp - .7) / .3);
  const rug = new THREE.Group();
  [['#c0392b', 1], ['#e9b21f', .84], ['#1d4f91', .7], ['#c0392b', .54], ['#e9b21f', .4], ['#1d4f91', .26]].forEach(([c, s], i) => {
    rug.add(mesh(geo('rugdisc', () => new THREE.CylinderGeometry(1, 1, 1, 40)), mat(c, { felt: true }), [0, i * .7, 0], [w * .3 * s, 1.4, h * .066 * s / Math.sin(phi)]));
  });
  const [rx, ry] = at(.5, .905, floorZ(.905)); rug.position.set(rx, ry + Math.sin(ang) * 7, floorZ(.905) + Math.cos(ang) * 7); rug.rotation.x = phi; g.add(rug);
  // hanging oil lamps
  for (const xp of [.33, .67]) {
    const [lx, ly] = at(xp, .2, zw + 30);
    g.add(tube([[lx, ly + h * .12, zw + 30], [lx, ly + h * .02, zw + 30]], 1.2, mat('#6b4320', { felt: true }), 2, 4));
    g.add(mesh(geo('lampbowl', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(C.gold, { metal: true, shine: .4 }), [lx, ly, zw + 30], [h * .03, h * .025, h * .03]));
    g.add(mesh(geo('lampflame', () => new THREE.ConeGeometry(1, 2.4, 10)), flameMat, [lx, ly + h * .025, zw + 30], h * .012));
    const gl = glow('#ffc060', h * .2, .55); gl.position.set(lx, ly + h * .02, zw + 32); g.add(gl);
  }
  freeze(g);
  return g;
}

/* ------------------------------------------------------------------ map icons (baked) */
export function iconModel(kind) {
  const g = new THREE.Group();
  const sand = mat('#e3a650', { rough: .9, flat: true }), gold = mat(C.gold, { metal: true, shine: .4 }), stone = mat('#f0c98a', { felt: true });
  const pyr = (x, z, r, h) => { const p = new THREE.ConeGeometry(r, h, 4); p.rotateY(Math.PI / 4); g.add(mesh(p, sand, [x, h / 2, z])); const c = new THREE.ConeGeometry(r * .18, h * .18, 4); c.rotateY(Math.PI / 4); g.add(mesh(c, gold, [x, h * .91, z])); };
  const baseDisc = col => g.add(mesh(new THREE.CylinderGeometry(1.25, 1.3, .14, 32), mat(col, { felt: true }), [0, -.07, 0]));
  switch (kind) {
    case 'giza': baseDisc('#a9c97a'); pyr(-.45, -.3, .75, 1.3); pyr(.55, -.1, .55, .95); pyr(.05, .55, .4, .7); break;
    case 'saqqara': baseDisc('#a9c97a'); for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(1.9 - i * .36, .3, 1.6 - i * .3), i % 2 ? stone : sand, [0, .15 + i * .3, 0])); break;
    case 'karnak': baseDisc('#a9c97a'); for (const x of [-.6, 0, .6]) { const c = column(1.5); c.scale.setScalar(.85); c.position.set(x, 0, 0); g.add(c); } g.add(mesh(new THREE.BoxGeometry(2.2, .25, .7), stone, [0, 1.45, 0])); break;
    case 'valley': baseDisc('#a9c97a');
      [[-.5, -.2, .9, 1.5, '#d49a5a'], [.5, -.35, .8, 1.2, '#c98a4a'], [.05, .3, .5, .7, '#e0ab69']].forEach(([x, z, r, h, c]) => g.add(mesh(new THREE.ConeGeometry(r, h, 7), mat(c, { felt: true }), [x, h / 2, z])));
      g.add(mesh(new THREE.BoxGeometry(.32, .5, .1), mat('#4a2e18', { felt: true }), [-.35, .25, .55])); break;
    case 'abu': baseDisc('#a9c97a');
      g.add(mesh(new THREE.BoxGeometry(2.4, 1.4, .5), stone, [0, .7, -.3]));
      for (const x of [-.65, .65]) { g.add(mesh(new THREE.BoxGeometry(.5, .5, .5), sand, [x, .25, .15])); g.add(ball(sand, [x, .75, .15], [.22, .28, .2])); g.add(mesh(new THREE.ConeGeometry(.24, .35, 4), mat(C.lapis, { felt: true }), [x, 1.05, .15])); }
      g.add(mesh(new THREE.BoxGeometry(.35, .6, .1), mat('#4a2e18', { felt: true }), [0, .3, 0])); break;
    case 'hidden': {
      g.add(mesh(geo('keyring', () => new THREE.TorusGeometry(.42, .13, 10, 28)), gold, [-.6, .2, 0]));
      g.add(capsule(gold, [-.2, .2, 0], [1.05, .2, 0], .1));
      g.add(mesh(new THREE.BoxGeometry(.12, .4, .14), gold, [.85, -.02, 0])); g.add(mesh(new THREE.BoxGeometry(.12, .3, .14), gold, [.6, .02, 0]));
      g.add(bead(mat(C.lapis, { gloss: true }), [-.6, .2, .12], [.14, .14, .08]));
      g.rotation.z = .5; g.position.y = .4; break;
    }
    case 'lock': {
      g.add(mesh(new THREE.BoxGeometry(1.2, .95, .45), mat('#b8a07a', { felt: true }), [0, .5, 0]));
      g.add(mesh(new THREE.TorusGeometry(.38, .1, 10, 24, Math.PI), mat('#9a8a70', { metal: true, shine: .1 }), [0, .98, 0]));
      g.add(bead(mat('#4a3a2a', { felt: true }), [0, .55, .23], [.1, .12, .05])); break;
    }
  }
  return g;
}
