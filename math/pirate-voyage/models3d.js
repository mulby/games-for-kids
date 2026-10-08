// The Shining Sea: felt-toy 3D models, built in code from the shared toy kit.
//  - characters: the six gods, the four open-sea friends and Pip the sea fairy (live models)
//  - the toy pirate ship (sail colour, flag and crew follow the player's choices)
//  - the six islands with Greek temples, columns, olive trees, a windmill, a volcano forge and Thunder Peak
//  - treasures, card art, ship crew and cabin furniture (baked once to images by world3d.js)
// Conventions: characters stand on y=0 and face +z. Small treasures sit on y=0, about 1 unit tall.
// Islands are about 1 unit in radius with the beach at y=0. The ship's bow points to +x, deck at y=0.
import { THREE, mat, ball, capsule, lathe as klathe, tube, slab, roundRectShape, starGeo, heartShape, glow, eyes, smile, cheeks, mesh, SPH, geo, freeze, lighten, fairy, mushroom } from '../../shared/toy3d.js';

const PI = Math.PI, UP = new THREE.Vector3(0, 1, 0);

/* ================================================================ helpers */
// lathe profiles must turn counter-clockwise in (r,y) or the surface comes out inside-out; fix the order here
function lathe(pts, m, seg = 24) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const x = klathe(a < 0 ? pts.slice().reverse() : pts, m, seg);
  return x;
}
const F = c => mat(c, { felt: true });
const FD = c => mat(c, { felt: true, side: THREE.DoubleSide });
const GL = c => mat(c, { gloss: true });
const P = (c, r = .55) => mat(c, { rough: r });
const MT = (c, s = .12) => mat(c, { metal: true, shine: s });
const GW = (c, k = 1) => mat(c, { glow: k });
const sb = (m, p, s, r) => mesh(SPH(12), m, p, s, r);
const SKIN = '#ffdcc6', SKIN2 = '#f7c4ad', INK = '#2e2650';
const GOLD = '#f2c14e', MARBLE = '#f7f2e8', WOOD = '#9a6232', DWOOD = '#6b4423';

function box(w, h, d, m, p = [0, 0, 0], r = [0, 0, 0]) {
  return mesh(geo(`pvbox${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d)), m, p, 1, r);
}
function rbox(w, h, d, m, r = .03, p = [0, 0, 0], rot = [0, 0, 0]) {
  const b = Math.min(.02, d / 4, w / 4, h / 4);
  const g = new THREE.ExtrudeGeometry(roundRectShape(w - 2 * b, h - 2 * b, Math.max(.002, r - b)), { depth: Math.max(.002, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return mesh(g, m, p, 1, rot);
}
function cyl(rt, rb, h, m, p = [0, 0, 0], seg = 14, r = [0, 0, 0], open = false) {
  return mesh(geo(`pvcyl${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)), m, p, 1, r);
}
function cone(r, h, m, p = [0, 0, 0], rot = [0, 0, 0], seg = 10) {
  return mesh(geo(`pvcone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), m, p, 1, rot);
}
function torus(R, t, m, p = [0, 0, 0], rot = [PI / 2, 0, 0], s = 1, arc = PI * 2, tub = 28) {
  return mesh(geo(`pvtor${R},${t},${arc.toFixed(3)},${tub}`, () => new THREE.TorusGeometry(R, t, 8, tub, arc)), m, p, s, rot);
}
function rod(m, a, b, r, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg, 1), m);
  x.position.copy(A).add(B).multiplyScalar(.5); x.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize()); return x;
}
function taperTube(points, r0, r1, m, seg = 16, radial = 8) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(c, seg, 1, radial, false);
  const pos = g.attributes.position, v = new THREE.Vector3(), Pt = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    c.getPointAt(i / seg, Pt); const r = r0 + (r1 - r0) * i / seg;
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(pos, k).sub(Pt).multiplyScalar(r).add(Pt); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return mesh(g, m);
}
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function ext(shape, depth, m, bevel = .02, seg = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}
// organic wobble for lathe shapes (islands, hills)
function wobble(m, amt = .06, seed = 1) {
  const g = m.geometry, p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue;
    const a = Math.atan2(z, x), k = 1 + amt * (Math.sin(a * 3 + seed) * .6 + Math.sin(a * 5 + seed * 2.3) * .4);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return m;
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// little cones on the back half of an ellipsoid (hedgehog, puffer)
function spikesOn(g, c, rad, n, m, zMax, r = .05, h = .16, yMin = -1) {
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.setFromSphericalCoords(1, Math.acos(1 - 2 * (i + .5) / n), i * 2.39996);
    if (v.z > zMax || v.y < yMin) continue;
    const x = cone(r, h, m, [c[0] + v.x * rad[0], c[1] + v.y * rad[1], c[2] + v.z * rad[2]], [0, 0, 0], 5);
    x.quaternion.setFromUnitVectors(UP, v.clone().normalize()); g.add(x);
  }
}
function grp(...kids) { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; }
function at(o, p, s = 1, r = [0, 0, 0]) { o.position.set(...p); if (Array.isArray(s)) o.scale.set(...s); else o.scale.setScalar(s); o.rotation.set(...r); return o; }
function live(o, name) { o.userData.live = true; o.name = name; return o; }

// a cute face for a round head of radius ~1 (scale the group to the head)
function face(g, { y = .05, x = .34, z = .88, r = .15, sleepy = false, open = false, ink = INK, cheek = true, mouth = true } = {}) {
  eyes(g, { y, x, z, r, closed: sleepy, ink });
  if (mouth) smile(g, { y: y - .3, z: z + .05, w: .13, open });
  if (cheek) cheeks(g, { y: y - .2, x: x + .24, z: z - .1 });
}
function faceOn(parent, pos, scl, opts) { const f = new THREE.Group(); f.position.set(...pos); if (Array.isArray(scl)) f.scale.set(...scl); else f.scale.setScalar(scl); face(f, opts); parent.add(f); return f; }

/* ================================================================ symbols the gods hold */
function trident(len = 2) {
  const g = new THREE.Group(), m = MT(GOLD, .2);
  g.add(cyl(.03, .03, len, m, [0, 0, 0], 8));
  const top = len / 2;
  g.add(mesh(new THREE.TorusGeometry(.17, .03, 6, 16, PI), m, [0, top + .02, 0], 1, [PI, 0, 0]));
  for (const x of [-.17, 0, .17]) { g.add(cyl(.026, .026, x ? .26 : .34, m, [x, top + (x ? .14 : .18), 0], 8)); g.add(cone(.055, .14, m, [x, top + (x ? .33 : .41), 0], [0, 0, 0], 8)); }
  g.add(sb(GL('#fffaf0'), [0, top - .02, .03], .045));
  return g;
}
function caduceus(len = 1.6) {
  const g = new THREE.Group(), m = MT(GOLD, .2);
  g.add(cyl(.028, .028, len, m, [0, 0, 0], 8));
  g.add(sb(m, [0, len / 2 + .06, 0], .07));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) g.add(sb(F('#ffffff'), [sx * (.1 + k * .08), len / 2 - .02 + k * .05, 0], [.09, .035, .03], [0, 0, sx * (.4 + k * .2)]));
  for (const ph of [0, PI]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = ph + t * PI * 4; pts.push([Math.cos(a) * .07, -len / 2 + .15 + t * (len - .45), Math.sin(a) * .07]); }
    g.add(tube(pts, .022, F(ph ? '#7cc06e' : '#5f9a62'), 40, 5));
  }
  return g;
}
function bowItem(r = .62) {
  const g = new THREE.Group(), m = MT('#d8dde8', .25);
  g.add(mesh(new THREE.TorusGeometry(r, .035, 6, 24, PI * .9), m, [0, 0, 0], 1, [0, 0, PI / 2 + PI * .05]));
  const a = PI / 2 + PI * .05, b = a + PI * .9;
  g.add(rod(F('#fff6e0'), [Math.cos(a) * r, Math.sin(a) * r, 0], [Math.cos(b) * r, Math.sin(b) * r, 0], .008, 4));
  g.add(sb(GW('#e8ecff', .6), [Math.cos(a) * r, Math.sin(a) * r, 0], .05)); g.add(sb(GW('#e8ecff', .6), [Math.cos(b) * r, Math.sin(b) * r, 0], .05));
  return g;
}
function hammer() {
  const g = new THREE.Group();
  g.add(cyl(.035, .04, .9, P('#8a5a32', .7), [0, 0, 0], 8));
  g.add(rbox(.36, .18, .18, MT('#7d8796', .1), .05, [0, .45, 0]));
  g.add(cyl(.05, .05, .06, MT(GOLD), [0, -.45, 0], 8));
  return g;
}
export function bolt(glowK = 1.2) {
  const s = polyShape([[.05, .6], [-.22, .02], [-.02, .02], [-.12, -.6], [.24, .08], [.03, .08], [.16, .6]]);
  const g = new THREE.Group(); g.add(ext(s, .1, mat('#ffc21a', { glow: glowK * .35, glowColor: '#ffb000' }), .03));
  return g;
}
function oliveBranch() {
  const g = new THREE.Group();
  g.add(taperTube([[0, -.4, 0], [.03, -.05, .02], [-.02, .3, 0], [.05, .55, .02]], .025, .012, F('#7a6a4a'), 10, 5));
  const lm = F('#93a66a'), lm2 = F('#b4c48a');
  for (let i = 0; i < 7; i++) { const y = -.2 + i * .12, sx = i % 2 ? 1 : -1; g.add(sb(i % 3 ? lm : lm2, [sx * .09, y, 0], [.12, .04, .04], [0, 0, sx * .6])); }
  for (let i = 0; i < 3; i++) g.add(sb(GL('#4b3a5c'), [(i - 1) * .07, -.05 + i * .2, .05], .045));
  return g;
}

/* ================================================================ characters */
function hairOn(head, style, color) {
  const hm = F(color), hh = F(lighten(color, .08));
  if (style !== 'none') head.add(ball(hm, [0, .12, -.06], [.64, .58, .6]));
  if (style === 'curls') {
    head.add(ball(hm, [0, .32, .18], [.56, .28, .42]));
    for (let i = 0; i < 9; i++) { const a = -1.3 + i * .325; head.add(sb(i % 2 ? hh : hm, [Math.sin(a) * .5, .36 + Math.cos(a) * .12, Math.cos(a) * .3], .14)); }
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) head.add(sb(hm, [sx * .6, .05 - k * .18, -.05], .14));
  } else if (style === 'long') {
    head.add(ball(hm, [0, .3, .2], [.56, .3, .45]));
    for (const sx of [-1, 1]) head.add(ball(hm, [sx * .32, .26, .4], [.26, .18, .14], [0, 0, sx * .5]));
    head.add(ball(hm, [0, -.35, -.3], [.55, .7, .35]));
    for (const sx of [-1, 1]) head.add(ball(hm, [sx * .5, -.45, -.08], [.17, .45, .17]));
  } else if (style === 'pony') {
    head.add(ball(hm, [0, .3, .2], [.56, .3, .45]));
    for (const sx of [-1, 1]) head.add(ball(hm, [sx * .32, .26, .4], [.26, .18, .14], [0, 0, sx * .5]));
    head.add(sb(hm, [0, .55, -.5], .2)); head.add(capsule(hm, [0, .5, -.62], [0, -.35, -.75], .14)); head.add(sb(F('#d8dde8'), [0, .5, -.6], [.12, .08, .08]));
  } else if (style === 'mermaid') {
    head.add(ball(hm, [0, .3, .2], [.56, .3, .45]));
    for (const sx of [-1, 1]) head.add(ball(hm, [sx * .32, .26, .4], [.26, .18, .14], [0, 0, sx * .5]));
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) head.add(sb(k % 2 ? hh : hm, [sx * (.52 + Math.sin(k) * .06), -.15 - k * .22, -.1 - k * .03], .2 - k * .015));
    head.add(ball(hm, [0, -.3, -.35], [.5, .6, .3]));
  }
}
function beardOn(head, color, big = false) {
  const bm = F(color), bh = F(lighten(color, .06));
  const n = big ? 11 : 8;
  for (let i = 0; i < n; i++) { const a = -1.15 + i * 2.3 / (n - 1), c = 1 - Math.abs(a) / 1.15; head.add(sb(i % 2 ? bh : bm, [Math.sin(a) * .47, -.3 - c * (big ? .3 : .2), .28 + Math.cos(a) * .18], big ? .2 : .16)); }
  head.add(sb(bm, [0, big ? -.72 : -.6, .3], big ? .24 : .17));
  if (big) for (const sx of [-1, 1]) head.add(sb(bh, [sx * .2, -.78, .22], .17));
}
function hatOn(head, hat) {
  if (hat === 'crown') {
    const m = MT(GOLD, .2);
    head.add(cyl(.42, .44, .14, m, [0, .5, 0], 20, [0, 0, 0], true));
    head.add(torus(.43, .03, m, [0, .44, 0]));
    for (let i = 0; i < 5; i++) { const a = (i - 2) * .55; head.add(cone(.07, .26, m, [Math.sin(a) * .42, .66, Math.cos(a) * .42], [Math.cos(a) * .2, 0, -Math.sin(a) * .2], 6)); head.add(sb(GL('#fffaf0'), [Math.sin(a) * .44, .8, Math.cos(a) * .44], .05)); }
    head.add(sb(GL('#3cc6c9'), [0, .5, .45], .06));
  } else if (hat === 'winged') {
    const m = F('#e8b04a');
    head.add(ball(m, [0, .42, 0], [.62, .32, .6]));
    head.add(torus(.6, .06, m, [0, .36, 0]));
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) head.add(sb(F('#ffffff'), [sx * (.62 + k * .1), .5 + k * .1, -.1 - k * .04], [.22 - k * .03, .06, .07], [0, sx * .3, sx * (.5 + k * .25)]));
  } else if (hat === 'moon') {
    head.add(mesh(new THREE.TorusGeometry(.2, .06, 8, 20, PI * 1.25), GW('#eef0ff', .55), [0, .55, .32], 1, [-.25, 0, -PI * .62]));
    head.add(torus(.58, .025, MT('#d8dde8', .3), [0, .32, 0], [PI / 2 - .2, 0, 0]));
  } else if (hat === 'helmet') {
    const m = MT('#d8a54a', .15);
    head.add(mesh(geo('pvhelm', () => new THREE.SphereGeometry(1, 24, 10, 0, PI * 2, 0, PI * .45)), m, [0, .1, -.02], [.66, .62, .64]));
    head.add(box(.16, .26, .1, m, [0, .1, .6]));
    for (let i = 0; i < 9; i++) { const a = -1.3 + i * .32; head.add(sb(F(i % 2 ? '#d9483b' : '#e8604f'), [0, .5 + Math.cos(a) * .45, Math.sin(a) * .45 - .05], [.08, .14, .14])); }
  } else if (hat === 'laurel') {
    const lm = MT('#f2c14e', .25);
    for (let i = 0; i < 14; i++) { const a = -PI * .85 + i * (PI * 1.7 / 13); head.add(sb(lm, [Math.sin(a) * .6, .35, Math.cos(a) * .56], [.09, .04, .14], [0, a, (i % 2 ? .5 : -.5)])); }
  } else if (hat === 'pilos') {
    head.add(lathe([[0, .3], [.6, .3], [.55, .45], [.32, .8], [0, .92]], F('#6c7fa6'), 20));
    head.add(torus(.6, .05, F('#f2c14e'), [0, .32, 0]));
  } else if (hat === 'sailor') {
    head.add(cyl(.5, .55, .2, F('#ffffff'), [0, .56, 0], 18));
    head.add(cyl(.56, .56, .06, F('#3b82c4'), [0, .48, 0], 18));
  } else if (hat === 'starfish') {
    head.add(at(mesh(starGeo(), F('#ff9a6b')), [.36, .52, .2], .14, [-.3, .5, .3]));
  }
}
function itemFor(name) {
  switch (name) {
    case 'trident': return trident(2.1);
    case 'caduceus': return caduceus(1.5);
    case 'bow': return bowItem();
    case 'hammer': return hammer();
    case 'bolt': return bolt(1.4);
    case 'olive': return oliveBranch();
    case 'pearl': return grp(sb(GL('#fff8f0'), [0, 0, 0], .16));
    default: return null;
  }
}
// A Greek god as a soft felt doll: round head, bead eyes, rosy cheeks, long chiton.
export function god(o = {}) {
  const { robe = '#2f7fc0', trim = GOLD, hair = '#dfeaf5', hairStyle = 'curls', beard = null, bigBeard = false, hat = null, item = null, owl = false, apron = null, wingsFeet = false, tail = null, bust = false, skin = SKIN } = o;
  const root = new THREE.Group();
  const body = live(new THREE.Group(), 'body'); root.add(body);
  const rm = F(robe), tm = F(trim), sk = F(skin);
  if (bust) {
    body.add(lathe([[0, 1.0], [.6, 1.0], [.62, 1.12], [.5, 1.32], [.3, 1.42], [0, 1.44]], rm, 28));
    body.add(torus(.4, .045, tm, [0, 1.36, .02], [PI / 2 - .25, 0, 0]));
  } else if (tail) {
    // mermaid: skin torso on a scaled tail that sweeps forward into a fin
    body.add(lathe([[0, .55], [.36, .55], [.42, .85], [.38, 1.15], [.3, 1.3], [0, 1.33]], sk, 28));
    for (const sx of [-1, 1]) body.add(sb(GL('#ff9fb8'), [sx * .16, 1.02, .3], [.15, .13, .08], [0, sx * .3, 0]));
    body.add(taperTube([[0, .75, 0], [0, .4, .05], [.02, .12, .25], [.05, .08, .6]], .4, .1, F(tail), 18, 14));
    for (const sx of [-1, 1]) body.add(sb(F(lighten(tail, .1)), [.06 + sx * .2, .1, .75], [.26, .05, .14], [0, sx * .5, sx * .2]));
    for (let i = 0; i < 10; i++) { const a = i * 1.7; body.add(sb(F(lighten(tail, .12)), [Math.cos(a) * .3, .35 + (i % 4) * .1, .15 + Math.sin(a) * .2], .05)); }
    body.add(torus(.4, .04, F('#ffd86b'), [0, .74, 0]));
  } else {
    body.add(lathe([[0, 0], [.66, 0], [.7, .07], [.62, .45], [.48, .95], [.37, 1.22], [0, 1.3]], rm, 32));
    body.add(torus(.69, .045, tm, [0, .07, 0]));
    const sash = new THREE.Group(); sash.rotation.z = .5; sash.position.set(0, .95, 0); sash.add(torus(.5, .055, tm, [0, 0, 0])); body.add(sash);
    for (const sx of [-1, 1]) body.add(sb(F('#a8743f'), [sx * .2, .04, .6], [.12, .07, .16]));
    if (wingsFeet) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) body.add(sb(F('#ffffff'), [sx * (.32 + k * .06), .12 + k * .06, .48], [.12, .04, .05], [0, 0, sx * (.6 + k * .3)]));
    if (apron) { body.add(mesh(new THREE.LatheGeometry([[.73, .2], [.66, .5], [.53, .9]].map(([r, y]) => new THREE.Vector2(r, y)), 16, -PI * .4, PI * .8), mat(apron, { felt: true, side: THREE.DoubleSide }))); body.add(torus(.55, .03, F(apron), [0, .9, 0])); }
  }
  // arms
  const sleeve = tail ? sk : rm, armY = tail ? 1.18 : 1.18;
  const armL = live(new THREE.Group(), 'armL'); armL.position.set(-.36, armY, 0);
  armL.add(capsule(sleeve, [0, 0, 0], [-.2, -.42, .12], .085)); armL.add(ball(sk, [-.22, -.5, .14], .1));
  const armR = live(new THREE.Group(), 'armR'); armR.position.set(.36, armY, 0);
  armR.add(capsule(sleeve, [0, 0, 0], [.22, -.3, .25], .085)); armR.add(ball(sk, [.25, -.37, .3], .1));
  if (!bust) body.add(armL, armR);
  body.add(capsule(sk, [0, 1.28, 0], [0, 1.45, 0], .1));
  // head
  const head = live(new THREE.Group(), 'head'); head.position.set(0, 1.95, 0); body.add(head);
  head.add(ball(sk, [0, 0, 0], [.6, .56, .55]));
  head.add(ball(F(SKIN2), [0, -.04, .55], [.055, .045, .03]));
  for (const sx of [-1, 1]) head.add(ball(sk, [sx * .58, -.02, 0], [.09, .14, .08]));
  const fc = new THREE.Group(); fc.position.z = -.33; fc.scale.setScalar(.6); head.add(fc);
  eyes(fc, { y: .02, x: .36, z: 1.4, r: .16 });
  smile(fc, { y: beard ? -.22 : -.3, z: 1.45, w: .14 });
  cheeks(fc, { y: -.18, x: .62, z: 1.33 });
  hairOn(head, hairStyle, hair);
  if (beard) beardOn(head, beard, bigBeard);
  if (hat) hatOn(head, hat);
  // held symbol
  let it = itemFor(item);
  if (it) {
    if (bust) { it.scale.setScalar(.55); it.position.set(.78, 1.55, .2); it.rotation.z = -.15; body.add(it); }
    else { it.position.set(.25, -.37 + (item === 'bow' ? 0 : item === 'bolt' ? .2 : .35), .3); if (item === 'bolt') it.scale.setScalar(.7); armR.add(it); }
  }
  if (owl) { const w = critter('owl'); w.scale.setScalar(bust ? .42 : .5); w.position.set(bust ? -.7 : -.5, bust ? 1.4 : 1.32, -.02); w.rotation.y = .3; body.add(w); }
  Object.assign(root.userData, { kind: 'god', body, head, armL, armR, item: it, t0: Math.random() * 10, mood: 'idle' });
  freeze(root);
  return root;
}
export const GODS = {
  poseidon: { robe: '#2f7fc0', trim: '#7fd1e8', hair: '#e6f0fa', beard: '#e6f0fa', hat: 'crown', item: 'trident' },
  hermes: { robe: '#f2a43a', trim: '#fff1d6', hair: '#8a5634', hat: 'winged', item: 'caduceus', wingsFeet: true },
  artemis: { robe: '#8f84e0', trim: '#e8ecff', hair: '#4a3326', hairStyle: 'pony', hat: 'moon', item: 'bow' },
  hephaestus: { robe: '#c0553d', trim: '#f2c14e', hair: '#4a3326', beard: '#7a5236', hat: 'pilos', item: 'hammer', apron: '#8a6a4a' },
  athena: { robe: '#7f9f3c', trim: GOLD, hair: '#6b4a24', hairStyle: 'long', hat: 'helmet', item: 'olive', owl: true },
  zeus: { robe: '#f6f0ff', trim: '#8a6fe0', hair: '#ffffff', beard: '#ffffff', bigBeard: true, hat: 'laurel', item: 'bolt' },
};

/* the open-sea friends */
export function kraken() {
  const root = new THREE.Group(), body = live(new THREE.Group(), 'body'); root.add(body);
  const m = F('#e58ac0'), m2 = F('#f4b6d8');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2 + .2, c = Math.cos(a), s = Math.sin(a), curl = i % 2 ? 1 : -1;
    body.add(taperTube([[c * .35, .55, s * .35], [c * .7, .2, s * .7], [c * 1.0, .1, s * 1.0], [c * 1.15 - s * .12 * curl, .25, s * 1.15 + c * .12 * curl], [c * 1.0 - s * .2 * curl, .35, s * 1.0 + c * .2 * curl]], .17, .04, m, 16, 8));
    for (let k = 0; k < 3; k++) body.add(sb(m2, [c * (.62 + k * .17), .26 - k * .04, s * (.62 + k * .17)], .04));
  }
  const head = live(new THREE.Group(), 'head'); head.position.y = 1.15; body.add(head);
  head.add(ball(m, [0, 0, 0], [.82, .78, .76]));
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + .4; head.add(sb(m2, [Math.cos(a) * .55, .35 + Math.sin(i) * .15, Math.sin(a) * .5 - .1], [.1, .1, .05])); }
  faceOn(head, [0, -.05, 0], [.78, .74, .76], { y: 0, r: .14 });
  const hat = new THREE.Group(); hatOn(hat, 'sailor'); hat.position.y = .12; hat.scale.setScalar(1.1); head.add(hat);
  Object.assign(root.userData, { kind: 'god', body, head, t0: Math.random() * 10, mood: 'idle' });
  return freeze(root);
}
export function tortuga() {
  const root = new THREE.Group(), body = live(new THREE.Group(), 'body'); root.add(body);
  const skin = F('#9cc87a'), shell = F('#4f8a3c'), plate = F('#6fae55');
  body.add(lathe([[0, .25], [.85, .25], [.9, .4], [.78, .8], [.45, 1.08], [0, 1.15]], shell, 28));
  body.add(torus(.87, .07, F('#d9c48a'), [0, .3, 0]));
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; body.add(sb(plate, [Math.cos(a) * .58, .82, Math.sin(a) * .58], [.22, .1, .22], [Math.sin(a) * .5, 0, -Math.cos(a) * .5])); }
  body.add(sb(plate, [0, 1.12, 0], [.28, .06, .28]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.add(sb(skin, [sx * .75, .15, sz * .55], [.22, .12, .3], [0, sx * sz * .5, 0]));
  const head = live(new THREE.Group(), 'head'); head.position.set(0, .85, .9); head.scale.setScalar(1.25); body.add(head);
  head.add(ball(skin, [0, 0, 0], [.5, .46, .46]));
  faceOn(head, [0, 0, 0], [.5, .46, .46], { sleepy: false, r: .14 });
  for (const sx of [-1, 1]) head.add(torus(.11, .018, MT('#c9a35a', .2), [sx * .17, .02, .46], [0, 0, 0]));
  head.add(rod(MT('#c9a35a'), [-.06, .02, .47], [.06, .02, .47], .015, 4));
  head.add(sb(F('#e6e0d0'), [0, -.38, .2], [.16, .14, .12]));
  Object.assign(root.userData, { kind: 'god', body, head, t0: Math.random() * 10, mood: 'idle' });
  return freeze(root);
}
export function dolphin(char = true) {
  const root = new THREE.Group(), body = live(new THREE.Group(), 'body'); root.add(body);
  const m = F('#5aa7e0'), bel = F('#e8f4fb');
  body.add(taperTube([[0, .1, -.1], [0, .5, 0], [0, 1.0, .05], [0, 1.4, 0]], .2, .45, m, 16, 14));
  body.add(ball(m, [0, 1.55, 0], [.5, .5, .48]));
  body.add(ball(bel, [0, 1.0, .22], [.3, .55, .25]));
  body.add(capsule(m, [0, 1.45, .35], [0, 1.4, .62], .14)); body.add(sb(bel, [0, 1.36, .55], [.12, .06, .1]));
  body.add(sb(F('#3d84bf'), [0, 1.9, -.25], [.07, .26, .2], [-.6, 0, 0]));
  for (const sx of [-1, 1]) body.add(sb(F('#3d84bf'), [sx * .4, .95, .1], [.22, .07, .12], [0, 0, sx * -.5]));
  for (const sx of [-1, 1]) body.add(sb(F('#3d84bf'), [sx * .2, .05, -.1], [.25, .05, .12], [0, sx * .3, sx * .2]));
  faceOn(body, [0, 1.62, .0], [.5, .48, .48], { y: .02, r: .14, mouth: false });
  smile(body, { y: 1.36, z: .68, w: .07 });
  Object.assign(root.userData, { kind: 'god', body, head: body, t0: Math.random() * 10, mood: 'idle', noHead: true });
  return freeze(root);
}
export function mermaid() { return god({ tail: '#2a9d8f', hair: '#e2725b', hairStyle: 'mermaid', hat: 'starfish', item: 'pearl' }); }
export function seaFriend(name) {
  if (/Kraken/.test(name)) return kraken();
  if (/Mermaid/.test(name)) return mermaid();
  if (/Tortuga/.test(name)) return tortuga();
  if (/Dolphin/.test(name)) return dolphin();
  return kraken();
}
export function character(isle, bust = false) {
  if (isle.id === 'sea') return seaFriend(isle.god);
  const o = GODS[isle.id] || GODS.poseidon;
  return god({ ...o, bust });
}
// Pip the sea fairy
export function pip() { return fairy({ wing: '#a9e6f2', hair: 'curls', hairColor: '#e8875a', dress: '#7fd1c7', dress2: '#e2fbf6' }); }

/* ================================================================ little animals (crew, treasures, cards) */
function chibi({ fur, belly = null, ears = 'round', earIn = '#f4b6c2', tail = null, nose = '#e58fa2', muzzle = null, spots = false, horn = false, mane = null, antlers = false, spikes = false, earTip = null }) {
  const g = new THREE.Group(), f = F(fur);
  g.add(sb(f, [0, .3, 0], [.3, .3, .27]));
  if (belly) g.add(sb(F(belly), [0, .28, .14], [.2, .21, .15]));
  for (const sx of [-1, 1]) { g.add(sb(f, [sx * .13, .05, .12], [.08, .05, .1])); g.add(sb(f, [sx * .25, .34, .1], [.07, .11, .07], [0, 0, sx * .4])); }
  const hd = new THREE.Group(); hd.position.set(0, .76, 0); g.add(hd);
  hd.add(ball(f, [0, 0, 0], [.37, .33, .32]));
  if (muzzle) hd.add(sb(F(muzzle), [0, -.1, .25], [.15, .1, .09]));
  faceOn(hd, [0, 0, 0], [.37, .33, .32], { y: .1, x: .36, r: .14 });
  hd.add(sb(GL(nose), [0, -.04, .33], [.04, .03, .03]));
  const em = F(earIn);
  if (ears === 'round') for (const sx of [-1, 1]) { hd.add(sb(f, [sx * .27, .27, -.04], [.16, .16, .05])); hd.add(sb(em, [sx * .27, .27, .0], [.11, .11, .03])); }
  if (ears === 'pointy') for (const sx of [-1, 1]) { hd.add(cone(.11, .22, f, [sx * .2, .32, -.02], [0, 0, -sx * .35], 8)); hd.add(cone(.06, .13, F(earTip || earIn), [sx * .2, .31, .05], [0, 0, -sx * .35], 6)); }
  if (ears === 'long') for (const sx of [-1, 1]) { hd.add(capsule(f, [sx * .1, .25, -.02], [sx * .17, .66, -.06], .075)); hd.add(capsule(em, [sx * .105, .3, .04], [sx * .165, .6, 0], .04)); }
  if (ears === 'small') for (const sx of [-1, 1]) hd.add(sb(f, [sx * .3, .2, -.02], [.1, .07, .05], [0, 0, -sx * .5]));
  if (antlers) for (const sx of [-1, 1]) { const am = F('#8a6a44'); hd.add(tube([[sx * .12, .28, 0], [sx * .2, .48, 0], [sx * .3, .6, -.02]], .025, am, 8, 5)); hd.add(tube([[sx * .19, .45, 0], [sx * .1, .58, 0]], .02, am, 4, 4)); }
  if (horn) { hd.add(cone(.06, .3, MT(GOLD, .25), [0, .42, .12], [.3, 0, 0], 10)); }
  if (mane) mane.forEach((c, i) => hd.add(sb(F(c), [0, .28 - i * .13, -.22 - i * .04], [.08, .1, .1])));
  if (spots) for (let i = 0; i < 6; i++) { const a = i * 1.3; g.add(sb(F('#fff6e8'), [Math.cos(a) * .2, .38 + Math.sin(i) * .1, -.08 + Math.sin(a) * .15 - .1], .04)); }
  if (spikes) { spikesOn(g, [0, .3, 0], [.3, .3, .27], 40, F('#6b4a2a'), .25, .06, .2); spikesOn(hd, [0, 0, 0], [.37, .33, .32], 40, F('#6b4a2a'), .05, .06, .2, .1); }
  if (tail === 'thin') g.add(tube([[0, .15, -.25], [.15, .1, -.45], [.25, .3, -.55], [.15, .45, -.5]], .02, F(earIn), 12, 5));
  if (tail === 'puff') g.add(sb(F('#ffffff'), [0, .2, -.3], .11));
  if (tail === 'bushy') { g.add(sb(f, [.18, .3, -.32], [.14, .3, .14], [.6, 0, -.5])); g.add(sb(F('#ffffff'), [.32, .52, -.38], [.09, .1, .09])); }
  if (tail === 'curl') g.add(tube([[0, .15, -.25], [.1, .3, -.4], [.05, .55, -.38], [-.05, .6, -.3]], .045, f, 12, 6));
  return g;
}
function birdy({ body, belly, wing, beak = '#f2a43a', face: fcCol = null, tufts = false, spread = false, tailC = null }) {
  const g = new THREE.Group(), bm = F(body);
  g.add(sb(bm, [0, .45, 0], [.36, .44, .32]));
  g.add(sb(F(belly), [0, .38, .17], [.24, .3, .17]));
  if (fcCol) for (const sx of [-1, 1]) g.add(sb(F(fcCol), [sx * .13, .62, .25], [.13, .13, .05]));
  faceOn(g, [0, .58, .05], [.34, .32, .3], { y: .14, x: .36, r: .17, mouth: false, cheek: !fcCol });
  g.add(cone(.06, .13, F(beak), [0, .52, .33], [PI / 2 + .3, 0, 0], 8));
  if (tufts) for (const sx of [-1, 1]) g.add(cone(.07, .2, bm, [sx * .22, .9, -.02], [0, 0, -sx * .4], 6));
  const wm = F(wing);
  for (const sx of [-1, 1]) g.add(spread ? sb(wm, [sx * .55, .55, -.05], [.38, .1, .2], [0, 0, sx * .35]) : sb(wm, [sx * .32, .42, -.02], [.1, .27, .2], [0, 0, sx * .15]));
  if (tailC) g.add(sb(F(tailC), [0, .1, -.3], [.1, .3, .06], [.6, 0, 0]));
  for (const sx of [-1, 1]) g.add(sb(F('#f2a43a'), [sx * .12, .02, .1], [.07, .04, .09]));
  return g;
}
function fishy(col = '#ffcf3a', stripes = '#2e2650', fin = null) {
  const g = new THREE.Group(), m = F(col);
  g.add(sb(m, [0, .45, 0], [.45, .34, .17]));
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.lineTo(-.3, .22); tail.quadraticCurveTo(-.24, 0, -.3, -.22); tail.closePath();
  g.add(at(ext(tail, .05, F(fin || col), .02), [-.38, .45, 0]));
  const top = new THREE.Shape(); top.moveTo(-.2, 0); top.quadraticCurveTo(0, .28, .2, 0); top.closePath();
  g.add(at(ext(top, .04, F(fin || col), .015), [-.02, .7, 0]));
  if (stripes) for (const x of [-.18, .1]) g.add(sb(F(stripes), [x, .45, 0], [.06, .33, .175]));
  for (const sz of [1, -1]) { const fc = faceOn(g, [.22, .52, 0], .26, { y: 0, x: 0, z: .55, r: .2, mouth: false, cheek: false }); if (sz < 0) fc.rotation.y = PI; }
  g.add(sb(F('#ff8fa8'), [.43, .4, 0], [.03, .03, .05]));
  return g;
}

export function critter(kind) {
  switch (kind) {
    case 'mouse': return chibi({ fur: '#c9c2cf', belly: '#efe8f2', ears: 'round', tail: 'thin', muzzle: '#efe8f2' });
    case 'cat': return chibi({ fur: '#f2a65a', belly: '#fff1d6', ears: 'pointy', tail: 'curl', muzzle: '#fff1d6' });
    case 'bunny': return chibi({ fur: '#f4ede4', belly: '#ffffff', ears: 'long', tail: 'puff', nose: '#f29cb3' });
    case 'rabbit': return chibi({ fur: '#e6e8f2', belly: '#ffffff', ears: 'long', earIn: '#d4c4ff', tail: 'puff', nose: '#c9b6ff' });
    case 'deer': return chibi({ fur: '#c98f55', belly: '#fff1d6', ears: 'small', muzzle: '#fff1d6', spots: true, antlers: true, nose: '#5a3d2b', tail: 'puff' });
    case 'silverdeer': return chibi({ fur: '#d8dde8', belly: '#ffffff', ears: 'small', muzzle: '#ffffff', spots: true, antlers: true, nose: '#8a8fa8', tail: 'puff' });
    case 'fox': return chibi({ fur: '#e8834a', belly: '#fff6ea', ears: 'pointy', earTip: '#4a3326', muzzle: '#fff6ea', tail: 'bushy', nose: '#3a2f2a' });
    case 'hedgehog': return chibi({ fur: '#c49a6c', belly: '#fff1d6', muzzle: '#fff1d6', ears: 'small', spikes: true, nose: '#3a2f2a' });
    case 'unicorn': return chibi({ fur: '#ffffff', belly: '#fff6fb', ears: 'pointy', earIn: '#ffc4d8', horn: true, mane: ['#f6a6bd', '#ffd86b', '#a9d4ff', '#b9a6e8'], nose: '#f6a6bd', tail: 'curl' });
    case 'owl': return birdy({ body: '#a87a4a', belly: '#f2dcb8', wing: '#8a5f36', face: '#fff1d6', tufts: true });
    case 'parrot': return birdy({ body: '#e2443b', belly: '#f26a5b', wing: '#3b82c4', beak: '#fff1d6', face: '#ffffff', tailC: '#ffc53d' });
    case 'eagle': { const b = birdy({ body: '#7a5534', belly: '#9a7050', wing: '#6b4a2a', beak: '#ffc53d', spread: true }); b.add(sb(F('#ffffff'), [0, .7, .02], [.3, .26, .27])); return b; }
    case 'crab': {
      const g = new THREE.Group(), m = F('#e8604f');
      g.add(sb(m, [0, .35, 0], [.48, .3, .36]));
      for (const sx of [-1, 1]) {
        g.add(capsule(m, [sx * .12, .55, .15], [sx * .16, .82, .18], .035)); g.add(sb(F('#ffffff'), [sx * .16, .86, .18], .08)); g.add(sb(GL(INK), [sx * .16, .87, .25], .045));
        g.add(capsule(m, [sx * .4, .35, .2], [sx * .6, .5, .35], .06)); g.add(sb(m, [sx * .66, .58, .4], [.16, .13, .1])); g.add(sb(m, [sx * .58, .72, .44], [.06, .1, .05], [0, 0, sx * .3]));
        for (let k = 0; k < 3; k++) g.add(capsule(m, [sx * .38, .25, -.1 + k * .12], [sx * .62, .05, -.15 + k * .14], .035));
      }
      smile(g, { y: .38, z: .37, w: .06 }); cheeks(g, { y: .42, x: .22, z: .33, scale: .7 });
      return g;
    }
    case 'fish': return fishy('#5aa7e0', null, '#3d84bf');
    case 'tropical': return fishy('#ffcf3a', '#2e2650', '#3b82c4');
    case 'puffer': {
      const g = new THREE.Group(), m = F('#f2cf6b');
      g.add(sb(m, [0, .45, 0], .42)); g.add(sb(F('#fff6d9'), [0, .38, .18], [.3, .26, .26]));
      spikesOn(g, [0, .45, 0], [.42, .42, .42], 22, F('#c9a04e'), .25, .04, .12);
      faceOn(g, [0, .5, 0], .42, { y: .05, r: .15, mouth: false });
      g.add(torus(.04, .015, F('#e2566b'), [0, .38, .42], [0, 0, 0]));
      for (const sx of [-1, 1]) g.add(sb(F('#e8b04a'), [sx * .44, .45, 0], [.06, .12, .1]));
      return g;
    }
    case 'whale': {
      const g = new THREE.Group(), m = F('#5b86c9');
      g.add(sb(m, [0, .4, 0], [.62, .4, .38])); g.add(sb(F('#e8f0fb'), [.1, .25, .12], [.45, .2, .28]));
      g.add(taperTube([[-.5, .45, 0], [-.75, .55, 0], [-.9, .75, 0]], .2, .06, m, 8, 8));
      for (const sz of [-1, 1]) g.add(sb(m, [-.92, .8, sz * .12], [.08, .05, .16], [0, 0, .3]));
      faceOn(g, [.38, .45, .1], .3, { y: 0, x: .4, r: .15 });
      for (let i = 0; i < 5; i++) g.add(sb(GL('#a9e6f2'), [.1 + Math.sin(i * 2) * .1, .9 + i * .08, Math.cos(i * 2) * .06], .05 + i * .01));
      return g;
    }
    case 'turtle': { const t = tortuga(); t.scale.setScalar(.6); return grp(t); }
    case 'dolphin': { const d = dolphin(); d.scale.setScalar(.5); return grp(d); }
    case 'seadragon': {
      const g = new THREE.Group(), m = F('#3fb59a'), m2 = F('#b8f0c8');
      g.add(taperTube([[-.6, .1, -.2], [-.3, .25, .1], [0, .15, -.1], [.25, .3, .05], [.35, .65, 0]], .08, .2, m, 24, 10));
      const hd = new THREE.Group(); hd.position.set(.38, .88, .05); g.add(hd);
      hd.add(ball(m, [0, 0, 0], [.3, .27, .27])); hd.add(sb(m, [.04, -.08, .24], [.15, .1, .1]));
      faceOn(hd, [0, .03, 0], [.3, .27, .27], { y: .12, r: .15 });
      for (const sx of [-1, 1]) { hd.add(cone(.04, .2, F('#ffd86b'), [sx * .12, .3, -.05], [-.3, 0, -sx * .3], 6)); hd.add(sb(m2, [sx * .3, .05, -.05], [.12, .05, .08], [0, 0, sx * .5])); }
      for (let i = 0; i < 6; i++) g.add(cone(.05, .14, m2, [-.55 + i * .17, .3 + Math.sin(i) * .08, -.05], [0, 0, 0], 5));
      return g;
    }
    default: return chibi({ fur: '#c9c2cf' });
  }
}

/* ================================================================ treasures and card things */
const T = {};
const pearlMat = () => new THREE.MeshPhysicalMaterial({ color: '#fff4f2', roughness: .18, clearcoat: 1, iridescence: .9, iridescenceIOR: 1.4, sheen: .6, sheenColor: new THREE.Color('#ffd6e8'), emissive: '#3a3040', emissiveIntensity: .25 });
T.pearl = () => grp(mesh(SPH(28), pearlMat(), [0, .5, 0], .45));
T.shell = () => {
  const g = new THREE.Group(), body = new THREE.Group();
  const prof = [[0, 0], [.3, .05], [.42, .25], [.36, .5], [.24, .75], [.11, .95], [0, 1.05]];
  body.add(lathe(prof, F('#f6e0cc'), 24));
  const rAt = y => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };
  const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48, y = .2 + t * .82, a = t * PI * 7; pts.push([Math.cos(a) * (rAt(y) + .015), y, Math.sin(a) * (rAt(y) + .015)]); }
  body.add(tube(pts, .03, F('#f2a7b5'), 120, 5));
  body.add(sb(F('#f7b6c2'), [.12, .22, .3], [.2, .26, .1], [.2, .3, -.3]));
  body.add(sb(F('#fff4ec'), [.16, .2, .33], [.12, .18, .05], [.2, .3, -.3]));
  body.rotation.z = -.95; body.position.set(-.35, .32, 0); g.add(body);
  return g;
};
T.coral = () => {
  const g = new THREE.Group(), m = F('#ff7f8f');
  const br = (a, b, r) => g.add(taperTube([a, [(a[0] + b[0]) / 2 + .05, (a[1] + b[1]) / 2, a[2]], b], r, r * .7, m, 6, 6));
  br([0, 0, 0], [0, .5, 0], .08); br([0, .3, 0], [-.3, .7, 0], .06); br([0, .35, 0], [.28, .75, .05], .06); br([-.15, .5, 0], [-.18, .95, 0], .045); br([.15, .55, 0], [.1, .95, -.05], .045); br([0, .5, 0], [.02, .9, .1], .05);
  for (let i = 0; i < 9; i++) g.add(sb(F('#fff1e8'), [Math.sin(i * 2.1) * .25, .45 + (i % 3) * .15, .07], .035));
  g.add(sb(F('#e8d4b0'), [0, .02, 0], [.3, .06, .2]));
  return g;
};
T.oyster = () => {
  const g = new THREE.Group(), m = F('#c9b8d8');
  const half = new THREE.SphereGeometry(.5, 20, 8, 0, PI * 2, 0, PI / 2);
  const lo = mesh(half, mat('#c9b8d8', { felt: true, side: THREE.DoubleSide }), [0, .2, 0], [1, .35, .85], [PI, 0, 0]); g.add(lo);
  const up = mesh(half, mat('#b3a2c6', { felt: true, side: THREE.DoubleSide }), [0, .22, -.32], [1, .35, .85], [-1.0, 0, 0]); g.add(up);
  g.add(sb(F('#f4c4d4'), [0, .2, 0], [.42, .06, .36]));
  g.add(sb(GL('#fffaf6'), [0, .32, .05], .17));
  return g;
};
T.trident = () => { const t = trident(2); t.position.y = 1.2; return grp(t); };
T.letter = () => {
  const g = new THREE.Group();
  g.add(rbox(1, .66, .08, F('#fff6e0'), .05, [0, .4, 0]));
  const fl = polyShape([[-.48, .3], [.48, .3], [0, -.05]]); g.add(at(ext(fl, .02, F('#f4e6c0'), .01), [0, .4, .05]));
  g.add(at(cyl(.1, .1, .04, GL('#d9483b'), [0, 0, 0], 16), [0, .37, .08], 1, [PI / 2, 0, 0]));
  return g;
};
T.feather = () => {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(.28, .25, .25, .8, 0, 1.05); s.bezierCurveTo(-.25, .8, -.28, .25, 0, 0);
  const g = new THREE.Group(); g.add(at(ext(s, .04, MT('#f2c14e', .35), .02, 16), [0, .05, 0], 1, [0, 0, -.35]));
  g.add(at(tube([[0, -.1, .04], [0, .5, .05], [0, 1.0, .04]], .02, F('#fff1d6'), 8, 4), [0, .05, 0], 1, [0, 0, -.35]));
  return g;
};
T.parcel = () => {
  const g = new THREE.Group();
  g.add(rbox(.8, .6, .7, F('#c9955a'), .06, [0, .3, 0]));
  g.add(box(.82, .62, .08, F('#d9483b'), [0, .3, 0])); g.add(box(.08, .62, .72, F('#d9483b'), [0, .3, 0]));
  for (const sx of [-1, 1]) g.add(sb(F('#e8604f'), [sx * .12, .66, 0], [.14, .08, .06], [0, 0, sx * .4]));
  return g;
};
T.chime = () => {
  const g = new THREE.Group();
  g.add(lathe([[0, .85], [.25, .82], [.32, .55], [.3, .5], [0, .55]], mat('#bfe6f5', { glass: .55 }), 20));
  g.add(sb(GL('#e2566b'), [0, .5, 0], .06));
  g.add(rod(F('#f6f0e0'), [0, .5, 0], [0, .1, 0], .01));
  g.add(rbox(.18, .38, .02, F('#f6a6bd'), .03, [0, .1, 0]));
  return g;
};
T.scroll = () => {
  const g = new THREE.Group(), pm = F('#f6e6c0');
  g.add(at(cyl(.12, .12, .9, pm, [0, 0, 0], 16), [0, .55, -.05], 1, [0, 0, PI / 2]));
  g.add(at(rbox(.84, .5, .02, pm, .02, [0, 0, 0]), [0, .28, .05], 1, [-.2, 0, 0]));
  for (const x of [-.5, .5]) g.add(at(cyl(.07, .07, .1, P(DWOOD), [0, 0, 0], 10), [x, .55, -.05], 1, [0, 0, PI / 2]));
  g.add(torus(.13, .025, F('#d9483b'), [0, .55, -.05], [0, PI / 2, 0]));
  for (let i = 0; i < 3; i++) g.add(box(.5 - i * .1, .025, .01, F('#b49a62'), [0, .38 - i * .08, .07]));
  return g;
};
T.kite = () => {
  const g = new THREE.Group();
  const d = polyShape([[0, .55], [.35, .1], [0, -.45], [-.35, .1]]);
  g.add(at(ext(d, .03, F('#e2566b'), .02), [0, .55, 0]));
  const d2 = polyShape([[0, .55], [.35, .1], [0, .1]]); g.add(at(ext(d2, .035, F('#ffd86b'), .02), [0, .55, .01]));
  const d3 = polyShape([[0, -.45], [-.35, .1], [0, .1]]); g.add(at(ext(d3, .035, F('#3b82c4'), .02), [0, .55, .01]));
  g.add(tube([[0, .1, 0], [.15, -.1, 0], [-.05, -.3, 0], [.1, -.45, 0]], .01, F('#f6f0e0'), 12, 4));
  for (const [x, y, c] of [[.12, -.05, '#f6a6bd'], [-.02, -.25, '#7fd1c7'], [.08, -.4, '#ffd86b']]) for (const sx of [-1, 1]) g.add(sb(F(c), [x + sx * .05, y + .55 - .5, 0], [.06, .035, .03], [0, 0, sx * .5]));
  return g;
};
T.sandals = () => {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(rbox(.26, .06, .62, F('#c9955a'), .1, [sx * .2, .05, 0]));
    g.add(torus(.11, .025, F('#8a5a32'), [sx * .2, .14, .08], [0, 0, 0], 1, PI));
    for (let k = 0; k < 3; k++) g.add(sb(F('#ffffff'), [sx * (.33 + k * .06), .25 + k * .1, -.12], [.16 - k * .02, .05, .06], [0, 0, sx * (.5 + k * .3)]));
  }
  return g;
};
T.mushroom = () => mushroom('#e2566b', .9);
T.blossom = () => {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + PI / 2; g.add(sb(F('#f6a6bd'), [Math.cos(a) * .3, .5 + Math.sin(a) * .3, 0], [.25, .25, .07])); }
  g.add(sb(F('#ffd86b'), [0, .5, .06], .13));
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + PI / 2 + .6; g.add(sb(F('#e2566b'), [Math.cos(a) * .12, .5 + Math.sin(a) * .12, .1], .025)); }
  faceOn(g, [0, .5, .1], .13, { y: 0, x: .38, r: .2, cheek: false, mouth: false });
  return g;
};
T.bow = () => { const b = bowItem(.5); b.position.y = .5; const a = rod(MT('#d8dde8'), [-.1, .5, .05], [.55, .5, .05], .015); return grp(b, a, cone(.04, .12, MT('#d8dde8'), [.6, .5, .05], [0, 0, -PI / 2], 6)); };
T.gear = () => {
  const s = new THREE.Shape(); const n = 10;
  for (let i = 0; i < n * 4; i++) { const a = i / (n * 4) * PI * 2, r = (i % 4 < 2) ? .45 : .36; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); const h = new THREE.Path(); h.absarc(0, 0, .12, 0, PI * 2, true); s.holes.push(h);
  return grp(at(ext(s, .14, MT('#cd8a4a', .15), .03), [0, .5, 0]));
};
T.bell = () => {
  const g = new THREE.Group();
  g.add(lathe([[0, .95], [.12, .92], [.2, .82], [.25, .6], [.3, .42], [.4, .32], [.39, .3], [0, .32]], MT(GOLD, .2), 28));
  g.add(sb(MT('#c08a3e'), [0, .26, 0], .08)); g.add(torus(.08, .025, MT('#c08a3e'), [0, 1.0, 0], [0, 0, 0]));
  g.add(torus(.3, .02, F('#d9483b'), [0, .45, 0]));
  return g;
};
T.key = () => {
  const g = new THREE.Group(), m = MT('#8a8fa8', .15);
  g.add(torus(.2, .05, m, [0, .78, 0], [0, 0, 0]));
  g.add(cyl(.045, .045, .6, m, [0, .38, 0], 8));
  g.add(box(.18, .07, .06, m, [.09, .14, 0])); g.add(box(.12, .07, .06, m, [.06, .26, 0]));
  g.add(sb(GL('#3b82c4'), [0, .78, 0], .06));
  return g;
};
T.ring = () => grp(torus(.32, .07, MT(GOLD, .25), [0, .38, 0], [0, 0, 0], 1, PI * 2, 32), at(mesh(new THREE.OctahedronGeometry(.16), GL('#e2566b')), [0, .78, 0], 1, [0, .5, 0]), cone(.06, .1, MT(GOLD), [0, .7, 0]));
T.shield = () => {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.SphereGeometry(.52, 28, 8, 0, PI * 2, 0, PI * .3), GL('#3b82c4')), [0, .55, -.38], [1, 1, 1], [PI / 2, 0, 0]));
  g.add(torus(.4, .06, MT(GOLD, .4), [0, .55, .04], [0, 0, 0]));
  g.add(at(mesh(starGeo(), F('#ffffff')), [0, .55, .12], .17));
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; g.add(sb(MT(GOLD, .4), [Math.cos(a) * .3, .55 + Math.sin(a) * .3, .07], .03)); }
  return g;
};
T.anchor = () => {
  const g = new THREE.Group(), m = MT('#7d8796', .12);
  g.add(cyl(.05, .05, .8, m, [0, .55, 0], 8)); g.add(torus(.11, .04, m, [0, 1.02, 0], [0, 0, 0])); g.add(box(.42, .07, .07, m, [0, .8, 0]));
  g.add(mesh(new THREE.TorusGeometry(.36, .05, 6, 20, PI), m, [0, .5, 0], 1, [0, 0, PI]));
  for (const sx of [-1, 1]) g.add(cone(.08, .18, m, [sx * .36, .56, 0], [0, 0, sx * .5], 6));
  g.add(torus(.11, .02, MT(GOLD), [0, 1.02, 0], [0, 0, 0]));
  return g;
};
T.olive = () => { const o = oliveBranch(); o.position.y = .45; o.rotation.z = -.4; return grp(o); };
T.vase = () => {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.18, 0], [.2, .05], [.38, .35], [.36, .62], [.18, .78], [.15, .92], [.2, .98], [0, .98]], F('#d9734f'), 28));
  g.add(torus(.37, .04, F('#2e2650'), [0, .48, 0])); g.add(torus(.32, .03, F('#2e2650'), [0, .62, 0]));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(.12, .03, 6, 12, PI), F('#d9734f'), [sx * .25, .78, 0], 1, [0, 0, sx * PI / 2]));
  return g;
};
T.book = () => {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) { g.add(rbox(.5, .05, .64, F('#7f5fc9'), .03, [sx * .26, .18, 0], [0, 0, sx * .2])); g.add(rbox(.46, .06, .58, F('#fff6e0'), .02, [sx * .24, .24, 0], [0, 0, sx * .2])); }
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) g.add(box(.3, .01, .025, F('#b49a62'), [sx * .25, .285 + Math.abs(sx * .0), -.15 + i * .12], [0, 0, sx * .2]));
  g.add(sb(GW('#ffe58a', 1), [0, .5, 0], .06)); g.add(at(mesh(starGeo(), GW('#ffe58a', 1.2)), [0, .55, 0], .07));
  return g;
};
T.compass = () => {
  const g = new THREE.Group();
  g.add(at(cyl(.45, .45, .14, MT(GOLD, .2), [0, 0, 0], 28), [0, .5, 0], 1, [PI / 2, 0, 0]));
  g.add(at(cyl(.38, .38, .02, F('#fff6e0'), [0, 0, 0], 28), [0, .5, .07], 1, [PI / 2, 0, 0]));
  g.add(at(ext(polyShape([[0, .32], [.06, 0], [0, -.32], [-.06, 0]]), .02, F('#d9483b'), .005), [0, .5, .09], 1, [0, 0, .5]));
  g.add(sb(MT(GOLD), [0, .5, .1], .04)); g.add(torus(.08, .03, MT(GOLD), [0, .98, 0], [0, 0, 0]));
  return g;
};
T.candle = () => {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.32, 0], [.34, .05], [.3, .08], [0, .08]], MT(GOLD), 20));
  g.add(cyl(.13, .14, .55, F('#fff6e8'), [0, .35, 0], 16));
  g.add(sb(F('#fff6e8'), [.1, .55, .08], [.04, .09, .04]));
  g.add(lathe([[0, .64], [.06, .7], [.05, .8], [0, .9]], GW('#ffb84a', 2), 12));
  const h = glow('#ffcf6a', 1.1, .8); h.position.y = .76; g.add(h);
  return g;
};
T.cloud = (face = true) => {
  const g = new THREE.Group(), m = F('#ffffff'), m2 = F('#eef4ff');
  [[0, .45, 0, .32], [-.3, .35, 0, .24], [.3, .35, 0, .26], [-.15, .55, -.05, .22], [.18, .58, -.05, .22], [.48, .28, 0, .16], [-.48, .28, 0, .16]].forEach(([x, y, z, r], i) => g.add(sb(i % 2 ? m2 : m, [x, y, z], [r, r * .9, r * .85])));
  if (face) faceOn(g, [0, .42, .05], .3, { y: 0, r: .14 });
  return g;
};
T.rainbowjar = () => {
  const g = new THREE.Group();
  ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#3e63dd', '#8e4ec6'].forEach((c, i) => g.add(mesh(new THREE.TorusGeometry(.28 - i * .035, .018, 6, 20, PI), GW(c, .6), [0, .3, 0], 1)));
  g.add(lathe([[0, 0], [.34, 0], [.38, .06], [.38, .62], [.3, .7], [.24, .72], [0, .72]], mat('#e8f0ff', { glass: .32 }), 24));
  g.add(lathe([[0, .7], [.26, .7], [.27, .82], [0, .82]], F('#c9955a'), 16));
  return g;
};
T.eagle = () => critter('eagle');
T.gem = () => grp(at(mesh(new THREE.OctahedronGeometry(.42, 0), mat('#7fb8ff', { gloss: true })), [0, .5, 0], [1, 1.2, 1], [0, .4, 0]), sb(GW('#ffffff', .6), [-.1, .7, .25], .05));
T.crown = () => {
  const g = new THREE.Group(), m = MT(GOLD, .22);
  g.add(cyl(.42, .4, .3, mat(GOLD, { metal: true, shine: .22, side: THREE.DoubleSide }), [0, .25, 0], 24, [0, 0, 0], true));
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; g.add(cone(.1, .26, m, [Math.cos(a) * .41, .53, Math.sin(a) * .41], [0, 0, 0], 6)); g.add(sb(GL(['#e2566b', '#7fb8ff', '#7cc06e'][i % 3]), [Math.cos(a) * .41, .7, Math.sin(a) * .41], .05)); }
  g.add(torus(.42, .035, m, [0, .1, 0])); g.add(torus(.42, .035, m, [0, .4, 0]));
  g.add(sb(GL('#e2566b'), [0, .25, .42], .07));
  return g;
};
T.bolt = () => { const b = bolt(1.4); b.position.y = .6; return grp(b); };
T.starfish = () => { const g = new THREE.Group(), s = at(mesh(starGeo(), F('#ff9a6b')), [0, .5, 0], .45); g.add(s); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2 + PI / 2; g.add(sb(F('#ffd0b0'), [Math.cos(a) * .25, .5 + Math.sin(a) * .25, .12], .035)); } faceOn(g, [0, .52, .1], .16, { y: 0, x: .38, r: .17 }); return g; };
T.bubble = () => {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color: '#cfefff', roughness: .05, transparent: true, opacity: .45, iridescence: 1, iridescenceIOR: 1.5, clearcoat: 1, depthWrite: false });
  [[0, .5, 0, .34], [.32, .82, 0, .16], [-.28, .88, .05, .12], [.1, 1.05, 0, .08]].forEach(([x, y, z, r]) => { g.add(mesh(SPH(20), m, [x, y, z], r)); g.add(sb(GW('#ffffff', .8), [x - r * .35, y + r * .4, z + r * .8], r * .14)); });
  return g;
};
T.map = () => {
  const g = new THREE.Group(), pm = F('#f6e6c0');
  const sheet = new THREE.PlaneGeometry(1.1, .8, 10, 1); const p = sheet.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * .03); sheet.computeVertexNormals();
  g.add(mesh(sheet, mat('#f6e6c0', { felt: true, side: THREE.DoubleSide }), [0, .45, 0]));
  for (const x of [-.58, .58]) g.add(at(cyl(.06, .06, .82, pm, [0, 0, 0], 12), [x, .45, 0]));
  g.add(sb(F('#7cc06e'), [-.2, .55, .04], [.18, .12, .02])); g.add(sb(F('#7cc06e'), [.2, .33, .04], [.14, .1, .02]));
  for (let i = 0; i < 6; i++) g.add(sb(F('#b49a62'), [-.12 + i * .06, .5 - i * .025, .04], .015));
  for (const r of [.7, -.7]) g.add(box(.16, .035, .01, F('#d9483b'), [.22, .3, .05], [0, 0, r]));
  return g;
};
T.chest = () => {
  const g = new THREE.Group(), w = F('#a8743f'), gm = MT(GOLD, .2);
  g.add(rbox(1, .55, .65, w, .05, [0, .3, 0]));
  g.add(mesh(new THREE.CylinderGeometry(.33, .33, 1, 20, 1, false, 0, PI), w, [0, .58, 0], 1, [0, 0, PI / 2]));
  for (const x of [-.36, .36]) { g.add(box(.08, .58, .67, gm, [x, .3, 0])); g.add(mesh(new THREE.TorusGeometry(.335, .04, 6, 20, PI), gm, [x, .58, 0], 1, [0, PI / 2, 0])); }
  g.add(rbox(.18, .2, .05, gm, .03, [0, .5, .34])); g.add(sb(GL(INK), [0, .47, .37], .025));
  for (let i = 0; i < 5; i++) g.add(at(cyl(.07, .07, .02, MT('#ffd86b', .3), [0, 0, 0], 14), [-.3 + i * .15, .08 + (i % 2) * .02, .35], 1, [PI / 2 - .3, 0, 0]));
  g.add(at(mesh(new THREE.OctahedronGeometry(.07), GL('#e2566b')), [.38, .12, .4]));
  g.add(at(mesh(new THREE.OctahedronGeometry(.06), GL('#7fb8ff')), [-.4, .1, .4]));
  return g;
};
T.coin = () => {
  const g = new THREE.Group(), m = MT('#f6c94e', .5);
  g.add(at(cyl(.48, .48, .14, m, [0, 0, 0], 32), [0, .5, 0], 1, [PI / 2, 0, 0]));
  g.add(torus(.42, .025, MT('#d9a530', .2), [0, .5, .07], [0, 0, 0]));
  g.add(at(mesh(starGeo(), MT('#ffd86b', .3)), [0, .5, .08], .2));
  return g;
};
T.bar = () => { // a gold bar of ten: ten stacked coins in a gold sleeve
  const g = new THREE.Group(), m = MT('#f2c14e', .22), dm = MT('#d9a530', .18);
  for (let i = 0; i < 10; i++) { g.add(rbox(.5, .29, .3, m, .06, [0, .16 + i * .31, 0])); g.add(box(.52, .02, .32, dm, [0, .31 + i * .31, 0])); }
  return g;
};
T.pebble = () => { const g = grp(sb(F('#b8c0cc'), [0, .4, 0], [.55, .42, .45])); g.add(sb(F('#d4dae2'), [-.18, .58, .3], [.16, .1, .06])); return g; };
T.parcelBig = T.parcel;
T.dish = () => lathe([[0, 0], [.45, 0], [.85, .22], [1, .5], [.97, .52], [.8, .3], [0, .1]], MT('#e2bb6b', .15), 32);
T.column = () => {
  const g = new THREE.Group(), m = P(MARBLE, .7);
  g.add(cyl(.2, .22, 3, m, [0, 1.6, 0], 16));
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; g.add(cyl(.03, .03, 2.9, P('#e8e0d0', .7), [Math.cos(a) * .2, 1.6, Math.sin(a) * .2], 6)); }
  g.add(box(.6, .14, .4, m, [0, 3.15, 0])); for (const sx of [-1, 1]) g.add(at(cyl(.08, .08, .4, m, [0, 0, 0], 12), [sx * .28, 3.08, 0], 1, [PI / 2, 0, 0]));
  g.add(box(.54, .12, .4, m, [0, .06, 0]));
  return g;
};
T.beam = () => { const g = new THREE.Group(), m = MT('#e2bb6b', .15); g.add(cyl(.08, .08, 4, m, [0, 0, 0], 12, [0, 0, PI / 2])); for (const sx of [-1, 1]) g.add(sb(MT(GOLD, .2), [sx * 2, 0, 0], .13)); g.add(sb(MT(GOLD, .2), [0, 0, 0], .15)); return g; };
T.foot = () => grp(rbox(2, .3, .7, P(MARBLE, .7), .1, [0, .15, 0]), rbox(1.6, .2, .55, P('#ece4d4', .7), .08, [0, .38, 0]));

/* ================================================================ the toy pirate ship */
// unit-sphere point -> hull surface (bow to +x, rim at y ~ 0)
function hullXf(x, y, z) {
  const u = x;
  let X = x * 1.3, Y = y * .58, Z = z * .62;
  if (u > 0) Z *= 1 - .62 * u * u; else Z *= 1 - .15 * u * u;
  Y += .16 * u * u;
  if (u > 0) X += .08 * u * u * (1 + y);
  return [X, Y, Z];
}
function hullGeo() {
  return geo('pvhull', () => {
    const g = new THREE.SphereGeometry(1, 36, 10, 0, PI * 2, PI / 2, PI / 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = hullXf(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, ...v); }
    g.computeVertexNormals(); return g;
  });
}
const rimPts = (k = 1, dy = 0, n = 48) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * PI * 2; const [x, y, z] = hullXf(Math.cos(a), 0, Math.sin(a)); pts.push([x * k, y + dy, z * k]); } return pts; };
function sailGeo(w, h, belly, seg = 8) {
  const g = new THREE.PlaneGeometry(w, h, seg, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const b = belly * (1 - (2 * x / w) ** 2) * (1 - .4 * (2 * y / h) ** 2); p.setXYZ(i, b, y, -x); }
  g.computeVertexNormals(); return g;
}
const SAILS = { white: '#fffaf0', red: '#d9483b', blue: '#3b82c4', purple: '#8a55c9', pink: '#f29cc3', gold: '#f2c14e', stars: '#22357a', rainbow: '#ffffff' };
const RAINBOW = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#3e63dd', '#8e4ec6'];
function sailMesh(geom, look, h) {
  const color = SAILS[look.sail] || SAILS.white;
  if (look.sail === 'rainbow') {
    const g = geom.clone(), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const t = Math.min(5, Math.max(0, Math.floor((.5 - p.getY(i) / h) * 6))); c.set(RAINBOW[t]); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = mesh(g, mat('#ffffff', { felt: true, vc: true, side: THREE.DoubleSide })); m.userData.noMerge = true; m.castShadow = true; return m;
  }
  return mesh(geom, look.sail === 'gold' ? mat(color, { metal: true, shine: .3, side: THREE.DoubleSide }) : FD(color));
}
function flagEmblem(flag) {
  const g = new THREE.Group();
  if (/☠/.test(flag) || /🏴/.test(flag)) { g.add(sb(F('#ffffff'), [0, .02, 0], [.07, .065, .02])); for (const sx of [-1, 1]) g.add(sb(F(INK), [sx * .025, .025, .018], .014)); g.add(box(.12, .02, .01, F('#ffffff'), [0, -.06, 0], [0, 0, .7])); g.add(box(.12, .02, .01, F('#ffffff'), [0, -.06, 0], [0, 0, -.7])); return { bg: '#2e2650', g }; }
  if (/🌸/.test(flag)) { for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; g.add(sb(F('#ffffff'), [Math.cos(a) * .045, Math.sin(a) * .045, 0], [.04, .04, .015])); } g.add(sb(F('#ffd86b'), [0, 0, .01], .025)); return { bg: '#f29cc3', g }; }
  if (/⭐/.test(flag)) { g.add(at(mesh(starGeo(), F('#ffd86b')), [0, 0, 0], [.07, .07, .03])); return { bg: '#22357a', g }; }
  if (/🐚/.test(flag)) { g.add(sb(F('#fff1e8'), [0, 0, 0], [.07, .06, .02])); for (let i = 0; i < 4; i++) g.add(box(.008, .07, .01, F('#f2a7b5'), [(i - 1.5) * .025, 0, .01], [0, 0, (i - 1.5) * .3])); return { bg: '#3cc6c9', g }; }
  if (/🧚/.test(flag)) { for (const sx of [-1, 1]) g.add(sb(F('#ffffff'), [sx * .045, .015, 0], [.05, .035, .015], [0, 0, sx * .4])); g.add(sb(F('#ffc4d8'), [0, 0, .01], .025)); return { bg: '#b9a6e8', g }; }
  if (/👑/.test(flag)) { g.add(box(.12, .04, .015, F('#ffd86b'), [0, -.02, 0])); for (const x of [-.045, 0, .045]) g.add(cone(.02, .05, F('#ffd86b'), [x, .02, 0], [0, 0, 0], 4)); return { bg: '#d9483b', g }; }
  return { bg: '#2e2650', g };
}
const CREW = { '🐭': 'mouse', '🐱': 'cat', '🦜': 'parrot', '🐰': 'bunny', '🦄': 'unicorn', '🦀': 'crab', '🦌': 'deer', '🐇': 'rabbit', '🦉': 'owl', '🦅': 'eagle', '🐠': 'tropical' };
export function ship(look = {}, opts = {}) {
  look = { sail: 'white', flag: '🏴‍☠️', crew: [], ...look };
  const root = new THREE.Group();
  const hull = new THREE.Group(); root.add(hull);
  const wood = mat(WOOD, { felt: true, side: THREE.DoubleSide });
  hull.add(mesh(hullGeo(), wood));
  // deck
  const ds = new THREE.Shape(); rimPts(.93, 0, 40).forEach(([x, , z], i) => i ? ds.lineTo(x, -z) : ds.moveTo(x, -z));
  const dg = new THREE.ShapeGeometry(ds, 4); dg.rotateX(-PI / 2); hull.add(mesh(dg, F('#d8ab72'), [0, .02, 0]));
  for (let i = -3; i <= 3; i++) hull.add(box(2.1, .006, .012, F('#b98a52'), [-.1, .03, i * .1]));
  hull.add(tube(rimPts(1, .02), .05, F(DWOOD), 96, 6));
  hull.add(tube(rimPts(1.02, -.16), .03, MT(GOLD, .2), 96, 5));
  for (const sz of [-1, 1]) for (const x of [-.55, -.1, .35]) { const [X, Y, Z] = hullXf(x / 1.3, -.42, sz * Math.sqrt(1 - (x / 1.3) ** 2 - .17)); hull.add(at(cyl(.07, .07, .04, F('#3b2412'), [0, 0, 0], 12), [X, Y, Z * 1.02], 1, [PI / 2, 0, 0])); hull.add(at(torus(.075, .018, MT(GOLD), [0, 0, 0], [0, 0, 0]), [X, Y, Z * 1.03])); }
  // stern castle with windows
  hull.add(rbox(.5, .42, .74, F('#b67a44'), .06, [-.98, .22, 0]));
  hull.add(rbox(.56, .06, .8, F(DWOOD), .03, [-.98, .45, 0]));
  for (const sz of [-1, 1]) for (const x of [-1.1, -.88]) hull.add(rbox(.1, .12, .02, GW('#ffe9a0', .7), .03, [x, .25, sz * .37]));
  for (let i = 0; i < 5; i++) hull.add(sb(F(DWOOD), [-1.18 + i * .1, .52, .36], .03)), hull.add(sb(F(DWOOD), [-1.18 + i * .1, .52, -.36], .03));
  hull.add(capsule(F(DWOOD), [1.3, .25, 0], [1.85, .55, 0], .04));
  hull.add(at(mesh(starGeo(), MT(GOLD, .25)), [1.38, .1, 0], .09, [0, PI / 2, 0]));
  // mast, yards, sails
  const rig = new THREE.Group(); root.add(rig);
  rig.add(cyl(.05, .06, 2.45, F(DWOOD), [.1, 1.05, 0], 10));
  rig.add(cyl(.17, .14, .1, F(DWOOD), [.1, 2.0, 0], 14, [0, 0, 0], true));
  rig.add(cyl(.025, .025, 1.5, F(DWOOD), [.12, 1.55, 0], 6, [PI / 2, 0, 0]));
  rig.add(cyl(.02, .02, 1.1, F(DWOOD), [.12, 2.18, 0], 6, [PI / 2, 0, 0]));
  const s1 = sailMesh(sailGeo(1.4, .95, .22), look, .95); s1.position.set(.14, 1.06, 0); rig.add(s1);
  const s2 = sailMesh(sailGeo(1.0, .5, .14), look, .5); s2.position.set(.13, 1.92, 0); rig.add(s2);
  const jibS = polyShape([[.16, 1.85], [.16, .4], [1.7, .5]]); const jg = new THREE.ShapeGeometry(jibS); rig.add(sailMesh(jg, look.sail === 'stars' || look.sail === 'rainbow' ? { sail: 'white' } : look, 1));
  if (look.sail === 'stars') [[.38, 1.2, .3], [.38, .9, -.35], [.36, 1.25, -.25], [.36, .85, .3], [.3, 1.95, .2], [.3, 1.85, -.25]].forEach(([x, y, z]) => rig.add(at(mesh(starGeo(), GW('#ffe680', .6)), [x, y, z], .06, [0, PI / 2, 0])));
  rig.add(rod(F('#e6d6b0'), [.1, 2.25, 0], [1.85, .58, 0], .008, 4));
  rig.add(rod(F('#e6d6b0'), [.1, 2.25, 0], [-1.15, .5, 0], .008, 4));
  // flag
  const flag = live(new THREE.Group(), 'flag'); flag.position.set(.1, 2.33, 0); root.add(flag);
  const fe = flagEmblem(look.flag || '🏴‍☠️');
  const fgeo = new THREE.PlaneGeometry(.4, .26, 6, 1); { const p = fgeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + .2) * 9) * .025 * (p.getX(i) + .2) * 4); fgeo.translate(.2, 0, 0); fgeo.computeVertexNormals(); }
  flag.add(mesh(fgeo, FD(fe.bg), [0, 0, 0]));
  for (const sz of [-1, 1]) { const e = fe.g.clone(true); e.position.set(.2, 0, sz * .03); if (sz < 0) e.rotation.y = PI; flag.add(e); }
  flag.add(sb(MT(GOLD), [0, .14, 0], .05));
  // crew on deck, facing the viewer
  const spots = [-.62, -.3, .45, .75];
  (look.crew || []).slice(0, 4).forEach((e, i) => { const k = CREW[e]; if (!k) return; const c = critter(k); c.scale.setScalar(k === 'crab' ? .3 : .36); c.position.set(spots[i], .03, .08); c.rotation.y = .15; root.add(c); });
  root.userData = { kind: 'ship', flag, t0: Math.random() * 10 };
  if (opts.noFreeze) return root;
  freeze(root);
  return root;
}
export const SHIP_H = 3.0; // keel to flag

/* ================================================================ islands */
function isleBase(seed = 1, grass = '#8fb35a', sand = '#f2dca6') {
  const g = new THREE.Group();
  g.add(wobble(lathe([[0, -.6], [1.02, -.6], [1.0, -.1], [.95, .04], [.86, .1], [0, .1]], F(sand), 40), .07, seed));
  g.add(wobble(lathe([[0, .06], [.82, .06], [.82, .12], [.7, .24], [.4, .3], [0, .32]], F(grass), 40), .1, seed + 2));
  const r = rng(seed * 7 + 3);
  for (let i = 0; i < 6; i++) { const a = seed * 1.7 + i * 1.05 + r() * .5; g.add(sb(F(i % 2 ? '#a8a29a' : '#bdb6aa'), [Math.cos(a) * .94, .03, Math.sin(a) * .94], [.08 + r() * .06, .06 + r() * .03, .07 + r() * .05], [0, r() * 3, 0])); }
  return g;
}
const topY = (x, z) => { const d = Math.hypot(x, z); return d < .4 ? .3 : d < .7 ? .3 - (d - .4) * .2 : .24 - (d - .7) * .9; };
function on(g, o, x, z, s = 1, ry = 0) { o.position.set(x, topY(x, z) - .01, z); o.scale.setScalar(s); o.rotation.y = ry; g.add(o); return o; }
export function temple({ w = .7, d = .5, h = .34, cols = 5, roof = '#d9734f', band = '#3b82c4' } = {}) {
  const t = new THREE.Group(), mm = P(MARBLE, .7);
  t.add(box(w + .14, .05, d + .14, mm, [0, .025, 0])); t.add(box(w + .07, .05, d + .07, mm, [0, .075, 0]));
  const colG = geo(`pvcol${h}`, () => new THREE.CylinderGeometry(.03, .036, h, 10)), capG = geo('pvcap', () => new THREE.BoxGeometry(.085, .022, .085));
  const put = (x, z) => { t.add(mesh(colG, mm, [x, .1 + h / 2, z])); t.add(mesh(capG, mm, [x, .1 + h + .011, z])); };
  const sp = (w - .1) / (cols - 1);
  for (let i = 0; i < cols; i++) { const x = -w / 2 + .05 + i * sp; put(x, d / 2 - .05); put(x, -d / 2 + .05); }
  const sc = Math.max(1, Math.round((d - .1) / sp)); for (let j = 1; j < sc; j++) { const z = -d / 2 + .05 + j * (d - .1) / sc; put(-w / 2 + .05, z); put(w / 2 - .05, z); }
  t.add(box(w - .22, h, d - .22, P('#efe2c8', .8), [0, .1 + h / 2, 0]));
  const top = .1 + h + .022;
  t.add(box(w + .04, .045, d + .04, mm, [0, top + .022, 0]));
  t.add(box(w + .05, .03, d + .05, F(band), [0, top + .06, 0]));
  const tri = polyShape([[-(w + .1) / 2, 0], [(w + .1) / 2, 0], [0, .15]]);
  const pg = new THREE.ExtrudeGeometry(tri, { depth: d + .08, bevelEnabled: false }); pg.translate(0, 0, -(d + .08) / 2);
  t.add(mesh(pg, F(roof), [0, top + .075, 0]));
  for (const sz of [-1, 1]) { const ty = new THREE.ShapeGeometry(polyShape([[-(w - .06) / 2, .012], [(w - .06) / 2, .012], [0, .12]])); const m = mesh(ty, mm, [0, top + .075, sz * ((d + .08) / 2 + .003)]); if (sz < 0) m.rotation.y = PI; t.add(m); t.add(sb(MT(GOLD), [0, top + .12, sz * ((d + .08) / 2 + .01)], [.025, .025, .01])); }
  return t;
}
function tholos({ r = .26, h = .3, dome = '#3b82c4', n = 8 } = {}) {
  const t = new THREE.Group(), mm = P(MARBLE, .7);
  t.add(cyl(r + .08, r + .1, .05, mm, [0, .025, 0], 24)); t.add(cyl(r + .04, r + .05, .05, mm, [0, .075, 0], 24));
  const colG = geo(`pvcol${h}`, () => new THREE.CylinderGeometry(.03, .036, h, 10));
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2; t.add(mesh(colG, mm, [Math.cos(a) * r, .1 + h / 2, Math.sin(a) * r])); }
  t.add(cyl(r * .7, r * .7, h, P('#efe2c8', .8), [0, .1 + h / 2, 0], 16));
  t.add(cyl(r + .05, r + .05, .06, mm, [0, .13 + h, 0], 24)); t.add(cyl(r + .055, r + .055, .025, F('#f2c14e'), [0, .17 + h, 0], 24));
  t.add(mesh(new THREE.SphereGeometry(r + .03, 20, 8, 0, PI * 2, 0, PI / 2), GL(dome), [0, .16 + h, 0]));
  t.add(sb(MT(GOLD, .3), [0, .2 + h + r, 0], .04));
  return t;
}
export function oliveTree(seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  g.add(taperTube([[0, 0, 0], [.04, .1, .02], [-.03, .2, 0], [.02, .3, .02]], .04, .022, F('#8a7560'), 8, 6));
  const lm = F('#8fa86a'), lm2 = F('#a9b87e');
  [[0, .38, 0, .16], [-.12, .33, .05, .11], [.13, .34, -.03, .12], [.02, .46, -.04, .1], [-.05, .4, .1, .09]].forEach(([x, y, z, s], i) => g.add(sb(i % 2 ? lm2 : lm, [x, y, z], [s, s * .8, s])));
  for (let i = 0; i < 6; i++) { const a = r() * 6.28; g.add(sb(GL('#4b3a5c'), [Math.cos(a) * .14, .32 + r() * .14, Math.sin(a) * .12], .018)); }
  return g;
}
export function cypress(h = .7) {
  return grp(lathe([[0, 0], [.05, 0], [.06, .04], [.12, .15], [.11, .4], [.06, .62], [0, h]], F('#3f6f4a'), 12));
}
function windmill() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.17, 0], [.15, .42], [0, .42]], F('#fbf8f0'), 18));
  g.add(lathe([[0, .4], [.18, .4], [.1, .52], [0, .6]], F('#b98a4a'), 16));
  g.add(rbox(.08, .13, .02, F('#3b82c4'), .03, [0, .07, .16]));
  g.add(rbox(.05, .05, .02, F('#3b82c4'), .02, [0, .28, .155]));
  const sails = live(new THREE.Group(), 'sails'); sails.position.set(0, .45, .2);
  sails.add(sb(F(DWOOD), [0, 0, 0], .035));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * PI * 2, arm = new THREE.Group(); arm.rotation.z = a;
    arm.add(box(.014, .36, .014, F(DWOOD), [0, .18, 0]));
    const tri = new THREE.ShapeGeometry(polyShape([[0, .06], [.11, .2], [0, .36]])); arm.add(mesh(tri, FD('#fff6e8'), [0, 0, .005]));
    sails.add(arm);
  }
  g.add(sails); g.userData.spin = sails;
  return g;
}
function cubeHouse(door = '#3b82c4', dome = false) {
  const g = new THREE.Group();
  g.add(rbox(.24, .2, .22, F('#fbf8f0'), .03, [0, .1, 0]));
  g.add(rbox(.07, .11, .02, F(door), .02, [0, .06, .115]));
  g.add(rbox(.05, .05, .02, F(door), .02, [.07, .13, .115]));
  if (dome) g.add(mesh(new THREE.SphereGeometry(.09, 14, 6, 0, PI * 2, 0, PI / 2), GL(door), [0, .2, 0]));
  return g;
}
function volcano() {
  const g = new THREE.Group();
  g.add(wobble(lathe([[0, 0], [.72, 0], [.62, .12], [.36, .5], [.2, .62], [.15, .58], [0, .55]], F('#8a7568'), 28), .05, 4));
  g.add(cyl(.16, .14, .03, GW('#ff7a2a', 1.8), [0, .585, 0], 18));
  [[.1, .02, .55, .3], [-.12, .05, .3, .35]].forEach(([x, z, y0, len], i) => g.add(taperTube([[x * .9, .58, z], [x * 1.8, .45, z + .14], [x * 2.6, .25, z + .3 + i * .1]], .035, .02, GW('#ff9a3c', 1.4), 8, 5)));
  const smoke = live(new THREE.Group(), 'smoke'); smoke.position.y = .62;
  for (let i = 0; i < 4; i++) { const p = sb(F('#e6e2de'), [0, i * .16, 0], .08 + i * .03); p.userData.k = i / 4; p.userData.noMerge = true; smoke.add(p); }
  g.add(smoke); g.userData.smoke = smoke;
  const h = glow('#ff9a3c', .7, .7); h.position.y = .64; g.add(h);
  return g;
}
function anvil() { return grp(box(.12, .04, .07, MT('#5d6470', .08), [0, .02, 0]), box(.06, .05, .05, MT('#5d6470', .08), [0, .06, 0]), rbox(.2, .05, .08, MT('#6c7480', .1), .02, [.02, .105, 0]), cone(.03, .06, MT('#6c7480'), [.14, .105, 0], [0, 0, -PI / 2], 6)); }
function peak() {
  const g = new THREE.Group();
  g.add(wobble(lathe([[0, 0], [.78, 0], [.62, .25], [.4, .7], [.3, .95], [.32, 1.0], [0, 1.0]], F('#9aa7b8'), 28), .08, 6));
  g.add(wobble(lathe([[0, .82], [.38, .8], [.35, .87], [.31, .97], [.33, 1.01], [0, 1.02]], F('#ffffff'), 24), .08, 6));
  const t = temple({ w: .4, d: .3, h: .2, cols: 4, roof: '#e9b23a', band: '#3b82c4' }); t.position.y = 1.0; t.scale.setScalar(.85); g.add(t);
  const cl = new THREE.Group(); for (let i = 0; i < 11; i++) { const a = i / 11 * PI * 2; cl.add(sb(F(i % 2 ? '#ffffff' : '#f4f8ff'), [Math.cos(a) * .56, .6 + Math.sin(i * 1.3) * .05, Math.sin(a) * .56], [.2, .14, .18])); } g.add(cl);
  const b = live(new THREE.Group(), 'bolt'); b.add(bolt(1.8)); b.position.set(.42, 1.35, .1); b.scale.setScalar(.3); b.rotation.z = -.2; g.add(b);
  const bg = glow('#ffe680', 1.2, .6); bg.position.copy(b.position); g.add(bg);
  g.userData.bolt = b; g.userData.boltGlow = bg;
  return g;
}
function clam() {
  const g = new THREE.Group(), half = new THREE.SphereGeometry(.2, 16, 6, 0, PI * 2, 0, PI / 2);
  g.add(mesh(half, mat('#f6d2c4', { felt: true, side: THREE.DoubleSide }), [0, .02, 0], [1, .35, .9], [PI, 0, 0]));
  g.add(mesh(half, mat('#f2b8a8', { felt: true, side: THREE.DoubleSide }), [0, .04, -.1], [1, .35, .9], [-1.1, 0, 0]));
  g.add(sb(GL('#fffaf6'), [0, .07, .02], .07));
  const h = glow('#ffffff', .35, .6); h.position.set(0, .08, .03); g.add(h);
  return g;
}
function coralClump() { const c = T.coral(); c.scale.setScalar(.16); return c; }
function crescent() { const g = new THREE.Group(); g.add(mesh(new THREE.TorusGeometry(.24, .055, 8, 24, PI * 1.25), GW('#eef0ff', .7), [0, .35, 0], 1, [0, 0, -PI * .62])); g.add(cyl(.04, .05, .14, P(MARBLE, .7), [0, .05, 0], 10)); const h = glow('#dfe4ff', .6, .2); h.position.y = .35; g.add(h); return g; }
function statueOwl() { const g = new THREE.Group(); g.add(cyl(.06, .07, .3, P(MARBLE, .7), [0, .15, 0], 10)); g.add(box(.16, .03, .16, P(MARBLE, .7), [0, .31, 0])); const o = critter('owl'); o.scale.setScalar(.2); o.position.y = .32; g.add(o); return g; }
function flowers(g, n, seed, cols) { const r = rng(seed); for (let i = 0; i < n; i++) { const a = r() * 6.28, d = .35 + r() * .4, x = Math.cos(a) * d, z = Math.sin(a) * d; g.add(sb(F(cols[i % cols.length]), [x, topY(x, z) + .015, z], .025)); } }
// one island per god; props sit on the grassy top (radius ~.8)
export function island(id) {
  const seed = { poseidon: 1, hermes: 2, artemis: 3, hephaestus: 4, athena: 5, zeus: 6 }[id] || 1;
  const grass = { artemis: '#6f9a6a', hephaestus: '#9a9a5a', zeus: '#8fb070' }[id] || '#8fb35a';
  const g = isleBase(seed, grass), u = g.userData;
  if (id === 'poseidon') {
    on(g, tholos({ dome: '#2f7fc0' }), -.05, -.15, 1.05);
    on(g, clam(), .55, .55, 1);
    on(g, coralClump(), -.5, .55, .9); on(g, coralClump(), -.62, .3, .6, 1);
    const t = trident(1); t.scale.setScalar(.42); t.position.set(.55, .62, -.25); t.rotation.z = -.15; g.add(t);
    on(g, cypress(.5), .35, -.55, 1); on(g, oliveTree(3), -.55, -.4, .8);
    flowers(g, 10, 11, ['#ffffff', '#f6a6bd']);
  } else if (id === 'hermes') {
    const w1 = on(g, windmill(), -.25, -.2, 1.3, .3); const w2 = on(g, windmill(), .35, -.45, 1.0, -.4);
    u.spin = [w1.userData.spin, w2.userData.spin];
    on(g, cubeHouse('#3b82c4', true), .4, .25, 1.2, -.3); on(g, cubeHouse('#e2725b'), .05, .5, 1.0, .2);
    on(g, oliveTree(5), -.55, .35, .8);
    flowers(g, 10, 12, ['#ffd86b', '#ffffff']);
  } else if (id === 'artemis') {
    on(g, tholos({ dome: '#8f84e0', r: .2, h: .26, n: 6 }), .3, -.3, 1);
    on(g, crescent(), -.25, -.35, 1.2);
    [[-.55, .1, .8], [-.6, -.25, .95], [.05, -.6, .9], [.6, .2, .85], [-.2, .55, .7], [.55, -.6, .7]].forEach(([x, z, k]) => on(g, cypress(.7), x, z, k));
    const d = critter('silverdeer'); on(g, d, .1, .3, .2, .4);
    const mu = mushroom('#b9a6e8', .12); on(g, mu, .35, .5, .12); on(g, mushroom('#e2566b', .1), -.35, .3, .1);
    flowers(g, 12, 13, ['#e8ecff', '#b9a6e8']);
  } else if (id === 'hephaestus') {
    const v = on(g, volcano(), -.1, -.2, 1.05); u.smoke = v.userData.smoke;
    const hut = new THREE.Group(); hut.add(rbox(.26, .18, .2, F('#b5a598'), .03, [0, .09, 0])); hut.add(ext(polyShape([[-.16, 0], [.16, 0], [0, .1]]), .24, F('#c0553d'), .01).translateY(.18)); hut.add(cyl(.03, .03, .16, F('#8a7568'), [.08, .28, -.04], 8)); hut.add(rbox(.07, .1, .02, GW('#ff9a3c', 1.2), .02, [0, .05, .105]));
    on(g, hut, .45, .35, 1.1, -.4);
    on(g, anvil(), -.1, .5, 1.3, .3);
    on(g, oliveTree(7), -.6, .25, .7);
  } else if (id === 'athena') {
    on(g, temple({ w: .72, d: .48, h: .32, cols: 6, roof: '#e9e0cc', band: '#3b82c4' }), 0, -.15, 1.05);
    on(g, oliveTree(1), -.55, .3, 1); on(g, oliveTree(2), .6, .25, .9); on(g, oliveTree(4), .5, -.55, .8); on(g, oliveTree(6), -.55, -.45, .85);
    on(g, statueOwl(), .05, .5, 1);
    flowers(g, 8, 14, ['#ffffff', '#ffd86b']);
  } else if (id === 'zeus') {
    const p = on(g, peak(), 0, -.05, 1.05); u.bolt = p.userData.bolt; u.boltGlow = p.userData.boltGlow;
    on(g, oliveTree(8), .55, .4, .7); on(g, cypress(.55), -.6, .3, .9);
  }
  // spinning, puffing and flickering parts stay separate; everything else merges
  g.userData.id = id;
  freeze(g);
  return g;
}
// a fluffy cloud bank that hides an island still to be discovered
export function cloudCover() {
  const g = new THREE.Group(), m = F('#ffffff'), m2 = F('#eef3fb');
  [[0, .45, 0, .55], [-.5, .3, .1, .4], [.5, .32, -.05, .42], [-.2, .35, -.45, .4], [.25, .3, .45, .38], [-.55, .2, -.35, .3], [.6, .18, .35, .3], [0, .75, -.1, .32], [.1, .2, .65, .28], [-.4, .2, .55, .3]].forEach(([x, y, z, r], i) => g.add(sb(i % 3 ? m : m2, [x, y, z], [r, r * .75, r])));
  return freeze(g);
}
export function skyCloud(seed = 1) {
  const g = new THREE.Group(), r = rng(seed), m = F('#ffffff'), m2 = F('#f2f6fc');
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) { const x = (i - n / 2) * .55 + r() * .3, s = .5 + Math.sin(i / (n - 1) * PI) * .6 + r() * .2; g.add(sb(i % 2 ? m : m2, [x, s * .35, (r() - .5) * .4], [s, s * .8, s * .7])); }
  return freeze(g);
}
// a little seagull (wings flap)
export function gull() {
  const g = new THREE.Group(), w = F('#ffffff');
  g.add(sb(w, [0, 0, 0], [.18, .14, .4])); g.add(sb(w, [0, .08, .32], .12)); g.add(cone(.04, .12, F('#f2a43a'), [0, .07, .46], [PI / 2, 0, 0], 6));
  for (const sx of [-1, 1]) { const wg = live(new THREE.Group(), sx < 0 ? 'wL' : 'wR'); wg.position.set(sx * .12, .04, 0); wg.add(sb(F('#eef0f4'), [sx * .4, 0, 0], [.42, .04, .16])); wg.add(sb(F('#8a8fa8'), [sx * .78, 0, 0], [.1, .035, .1])); g.add(wg); }
  g.userData = { kind: 'gull', wL: g.getObjectByName('wL'), wR: g.getObjectByName('wR'), t0: Math.random() * 10 };
  return freeze(g);
}

/* ================================================================ cabin furniture */
const D = {};
D.bed = () => { const g = new THREE.Group(), w = P(WOOD, .6); g.add(rbox(.12, .7, .7, w, .05, [-.6, .35, 0])); g.add(rbox(.1, .45, .7, w, .05, [.6, .22, 0])); g.add(rbox(1.2, .1, .66, w, .03, [0, .15, 0])); g.add(rbox(1.1, .2, .6, F('#3b82c4'), .08, [.05, .3, 0])); g.add(rbox(.7, .22, .64, F('#7fb8e8'), .08, [.22, .32, 0])); g.add(sb(F('#ffffff'), [-.38, .45, 0], [.16, .09, .24])); return g; };
D.chair = () => { const g = new THREE.Group(), w = P('#b67a44', .6); g.add(rbox(.5, .07, .5, w, .03, [0, .45, 0])); for (const x of [-.2, .2]) for (const z of [-.2, .2]) g.add(cyl(.03, .03, .45, w, [x, .22, z], 8)); for (const x of [-.2, .2]) g.add(cyl(.03, .03, .5, w, [x, .72, -.2], 8)); g.add(rbox(.46, .2, .05, w, .05, [0, .85, -.2])); g.add(rbox(.42, .06, .42, F('#e2566b'), .03, [0, .5, 0])); return g; };
D.candle = T.candle;
D.teapot = () => { const g = new THREE.Group(), m = GL('#e8604f'); g.add(lathe([[0, 0], [.3, 0], [.42, .2], [.4, .42], [.26, .56], [0, .58]], m, 24)); g.add(lathe([[0, .55], [.14, .55], [.12, .62], [0, .66]], m, 14)); g.add(sb(GL('#ffd86b'), [0, .69, 0], .05)); g.add(taperTube([[.36, .25, 0], [.52, .38, 0], [.62, .55, 0]], .07, .035, m, 8, 8)); g.add(mesh(new THREE.TorusGeometry(.16, .035, 6, 14, PI * 1.2), m, [-.4, .32, 0], 1, [0, 0, PI * .4])); g.add(torus(.4, .02, GL('#ffd86b'), [0, .3, 0])); return g; };
D.cupcake = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.25, 0], [.32, .3], [0, .3]], F('#f6a6bd'), 18)); g.add(lathe([[0, .28], [.36, .28], [.3, .42], [.18, .55], [0, .6]], F('#fff6fb'), 18)); g.add(sb(GL('#e2566b'), [0, .65, 0], .07)); for (let i = 0; i < 8; i++) { const a = i * .8; g.add(box(.04, .012, .012, F(['#ffd86b', '#7fd1c7', '#b9a6e8'][i % 3]), [Math.cos(a) * .2, .44, Math.sin(a) * .2], [0, a, 0])); } return g; };
D.plant = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.22, 0], [.3, .35], [.32, .38], [0, .38]], F('#d9734f'), 18)); g.add(sb(F('#5a3d2b'), [0, .36, 0], [.28, .04, .28])); for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; g.add(taperTube([[0, .36, 0], [Math.cos(a) * .2, .7, Math.sin(a) * .2], [Math.cos(a) * .42, .78 - (i % 2) * .15, Math.sin(a) * .42]], .05, .015, F(i % 2 ? '#5f9a62' : '#7cc06e'), 8, 5)); } return g; };
D.flowers = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.15, 0], [.2, .3], [.13, .42], [.16, .48], [0, .48]], mat('#bfe6f5', { glass: .5 }), 18)); const cs = ['#f6a6bd', '#ffd86b', '#b9a6e8', '#e2566b', '#ffffff']; for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2, tip = [Math.cos(a) * .25, .85 + (i % 2) * .1, Math.sin(a) * .2]; g.add(tube([[0, .3, 0], [tip[0] * .5, .6, tip[2] * .5], tip], .015, F('#5f9a62'), 6, 4)); for (let k = 0; k < 5; k++) { const b = k / 5 * PI * 2; g.add(sb(F(cs[i]), [tip[0] + Math.cos(b) * .06, tip[1], tip[2] + Math.sin(b) * .06], .05)); } g.add(sb(F('#ffd86b'), [tip[0], tip[1] + .02, tip[2]], .035)); } return g; };
D.books = () => { const g = new THREE.Group(); [['#7f5fc9', .0, .2], ['#3b82c4', .14, -.1], ['#e2566b', .26, .15], ['#7cc06e', .38, -.05]].forEach(([c, y, r]) => { g.add(rbox(.7, .13, .5, F(c), .03, [0, y + .07, 0], [0, r, 0])); g.add(rbox(.66, .1, .46, F('#fff6e0'), .02, [.03, y + .07, 0], [0, r, 0])); }); return g; };
D.teddy = () => { const g = chibi({ fur: '#b67a44', belly: '#e8c9a0', ears: 'round', earIn: '#e8c9a0', muzzle: '#e8c9a0', nose: '#3a2f2a' }); g.add(sb(F('#ffd86b'), [0, .58, .2], [.14, .06, .06])); g.add(sb(F('#ffd86b'), [0, .55, .22], .05)); return g; };
D.lamp = () => { const g = new THREE.Group(), m = MT(GOLD, .2); g.add(lathe([[0, 0], [.4, .02], [.45, .14], [.3, .22], [0, .24]], m, 22)); g.add(taperTube([[.4, .14, 0], [.6, .2, 0], [.68, .3, 0]], .06, .04, m, 8, 6)); g.add(mesh(new THREE.TorusGeometry(.12, .03, 6, 14, PI), m, [-.45, .15, 0], 1, [0, 0, PI / 2])); g.add(lathe([[0, .3], [.04, .34], [.035, .44], [0, .52]], GW('#ffb84a', 2), 10).translateX(.68)); const h = glow('#ffcf6a', 1, .8); h.position.set(.68, .42, 0); g.add(h); return g; };
D.picture = () => { const g = new THREE.Group(); g.add(rbox(1, .8, .06, MT(GOLD, .2), .04, [0, .5, 0])); g.add(box(.84, .64, .02, F('#a9dcf5'), [0, .5, .03])); g.add(sb(F('#ffd86b'), [.25, .7, .04], [.08, .08, .01])); g.add(sb(F('#3b82c4'), [0, .3, .04], [.42, .1, .01])); const s = ship({ sail: 'white', flag: '🏴‍☠️', crew: [] }, {}); s.scale.setScalar(.12); s.position.set(-.1, .38, .06); g.add(s); return g; };
D.mirror = () => { const g = new THREE.Group(); g.add(at(cyl(.42, .42, .06, MT(GOLD, .2), [0, 0, 0], 28), [0, .55, 0], [1, 1, 1.3], [PI / 2, 0, 0])); g.add(at(cyl(.36, .36, .02, mat('#dfefff', { gloss: true }), [0, 0, 0], 28), [0, .55, .04], [1, 1, 1.3], [PI / 2, 0, 0])); g.add(sb(GW('#ffffff', .6), [-.12, .72, .06], [.06, .1, .01])); g.add(at(ext(heartShape(), .3, F('#f6a6bd'), .08), [0, 1.08, 0], .09)); return g; };
D.clock = () => { const g = new THREE.Group(); g.add(rbox(.4, .95, .3, P(WOOD, .6), .08, [0, .48, 0])); g.add(at(cyl(.17, .17, .03, F('#fff6e0'), [0, 0, 0], 24), [0, .75, .16], 1, [PI / 2, 0, 0])); g.add(torus(.17, .025, MT(GOLD), [0, .75, .16], [0, 0, 0])); g.add(box(.02, .12, .01, F(INK), [0, .79, .18])); g.add(box(.09, .02, .01, F(INK), [.03, .75, .18])); g.add(at(cyl(.06, .06, .02, MT(GOLD), [0, 0, 0], 16), [0, .32, .16], 1, [PI / 2, 0, 0])); return g; };
D.basket = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.32, 0], [.42, .35], [.4, .37], [0, .1]], mat('#c9955a', { felt: true, side: THREE.DoubleSide }), 22)); for (let i = 0; i < 4; i++) g.add(torus(.34 + i * .025, .02, F('#a8743f'), [0, .08 + i * .09, 0])); g.add(mesh(new THREE.TorusGeometry(.38, .03, 6, 20, PI), F('#a8743f'), [0, .36, 0])); for (let i = 0; i < 3; i++) g.add(sb(F(['#e2566b', '#ffd86b', '#7cc06e'][i]), [(i - 1) * .18, .38, 0], .12)); return g; };
D.sofa = () => { const g = new THREE.Group(), m = F('#8a55c9'), m2 = F('#a77ae0'); g.add(rbox(1.4, .3, .6, m, .08, [0, .25, 0])); g.add(rbox(1.4, .5, .18, m, .08, [0, .5, -.22])); for (const sx of [-1, 1]) g.add(rbox(.18, .42, .62, m, .08, [sx * .68, .38, 0])); for (const sx of [-1, 1]) g.add(rbox(.6, .12, .46, m2, .05, [sx * .3, .44, .04])); for (const sx of [-1, 1]) for (const z of [-.2, .2]) g.add(cyl(.04, .03, .1, P(DWOOD), [sx * .6, .05, z], 8)); g.add(sb(F('#ffd86b'), [-.4, .62, -.05], [.14, .14, .06])); return g; };
D.globe = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.25, 0], [.22, .06], [.05, .12], [.05, .2], [0, .2]], P(WOOD), 18)); g.add(sb(F('#5aa7e0'), [0, .55, 0], .34)); g.add(sb(F('#7cc06e'), [.12, .62, .22], [.14, .12, .08])); g.add(sb(F('#7cc06e'), [-.18, .45, .2], [.1, .14, .1])); g.add(mesh(new THREE.TorusGeometry(.4, .02, 6, 24, PI), MT(GOLD), [0, .55, 0], 1, [0, 0, -PI / 2 + .3])); return g; };
D.doll = () => { const g = new THREE.Group(); g.add(lathe([[0, 0], [.3, 0], [.34, .3], [.2, .55], [.22, .62], [.18, .78], [0, .82]], GL('#e2566b'), 24)); g.add(sb(F('#ffdcc6'), [0, .62, .14], [.13, .12, .08])); g.add(torus(.3, .02, GL('#ffd86b'), [0, .25, 0])); for (let i = 0; i < 3; i++) g.add(sb(GL(['#ffd86b', '#7cc06e', '#3b82c4'][i]), [(i - 1) * .12, .2, .3], .045)); faceOn(g, [0, .63, .1], .12, { y: 0, x: .35, r: .14, cheek: true }); return g; };
D.mouse = () => critter('mouse');
D.bow = () => { const g = new THREE.Group(), m = F('#f2a7b5'); for (const sx of [-1, 1]) { g.add(sb(m, [sx * .28, .5, 0], [.28, .18, .1], [0, 0, sx * .3])); g.add(sb(m, [sx * .14, .22, 0], [.07, .22, .05], [0, 0, sx * .4])); } g.add(sb(F('#e48aa0'), [0, .5, .03], .1)); return g; };
D.lantern = () => { const g = new THREE.Group(); g.add(lathe([[0, .05], [.25, .08], [.36, .35], [.25, .62], [0, .66]], mat('#e8604f', { glow: .5, glowColor: '#ff7a3a' }), 20)); for (const y of [.05, .66]) g.add(cyl(.14, .14, .06, MT(GOLD), [0, y, 0], 14)); for (let i = 0; i < 6; i++) g.add(box(.008, .55, .008, F('#c0553d'), [Math.cos(i) * .34, .35, Math.sin(i) * .34])); g.add(tube([[0, .66, 0], [0, .78, 0], [0, .86, 0]], .015, F(DWOOD), 4, 4)); g.add(tube([[0, .02, 0], [0, -.1, 0], [0, -.18, 0]], .02, F('#ffd86b'), 4, 4)); const h = glow('#ffb860', 1.3, .6); h.position.y = .36; g.add(h); return g; };
D.rug = () => { const g = new THREE.Group(); g.add(rbox(1.5, .04, .9, F('#d9483b'), .2, [0, .02, 0], [0, 0, 0])); g.add(rbox(1.3, .045, .7, F('#f2c14e'), .16, [0, .025, 0])); g.add(rbox(1.1, .05, .5, F('#d9483b'), .12, [0, .03, 0])); for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) g.add(box(.08, .01, .02, F('#f6e6c0'), [sx * .79, .01, -.35 + i * .14])); return g; };

/* ================================================================ emoji -> model table (for baked images) */
// v: optional Baker view; frame-fit by default
export const EMOJI = {
  '🐚': T.shell, '🐟': () => critter('fish'), '📦': T.parcel, '✉️': T.letter, '✉': T.letter, '🪶': T.feather,
  '🦌': () => critter('deer'), '🐇': () => critter('rabbit'), '🦊': () => critter('fox'), '🦔': () => critter('hedgehog'), '🦉': () => critter('owl'),
  '🦀': () => critter('crab'), '🪸': T.coral, '🦪': T.oyster, '🐠': () => critter('tropical'), '🔱': T.trident,
  '🎐': T.chime, '📜': T.scroll, '🪁': T.kite, '🪽': T.sandals, '🍄': T.mushroom, '🌸': T.blossom, '🏹': T.bow,
  '⚙️': T.gear, '⚙': T.gear, '🔔': T.bell, '🗝️': T.key, '🗝': T.key, '💍': T.ring, '🛡️': T.shield, '🛡': T.shield, '⚓': T.anchor,
  '🫒': T.olive, '🏺': T.vase, '📖': T.book, '🧭': T.compass, '🕯️': T.candle, '🕯': T.candle,
  '☁️': T.cloud, '☁': T.cloud, '🌈': T.rainbowjar, '🦅': () => critter('eagle'), '💎': T.gem, '👑': T.crown, '⚡': T.bolt,
  '⭐': T.starfish, '🫧': T.bubble, '🐡': () => critter('puffer'), '🗺️': T.map, '🗺': T.map, '🐋': () => critter('whale'), '🐉': () => critter('seadragon'),
  '🐭': () => critter('mouse'), '🐱': () => critter('cat'), '🦜': () => critter('parrot'), '🐰': () => critter('bunny'), '🦄': () => critter('unicorn'),
  '🧰': T.chest, '🧚': pip, '🐢': () => critter('turtle'), '🐬': () => critter('dolphin'), '🐙': kraken, '🧜‍♀️': mermaid,
  '🏴‍☠️': () => flagModel('🏴‍☠️'), '🛏️': D.bed, '🛏': D.bed, '🪑': D.chair, '🫖': D.teapot, '🧁': D.cupcake, '🪴': D.plant, '💐': D.flowers,
  '📚': D.books, '🧸': D.teddy, '🪔': D.lamp, '🖼️': D.picture, '🖼': D.picture, '🪞': D.mirror, '🕰️': D.clock, '🕰': D.clock, '🧺': D.basket,
  '🛋️': D.sofa, '🛋': D.sofa, '🌍': D.globe, '🪆': D.doll, '🎀': D.bow, '🏮': D.lantern, '🟥': D.rug,
};
// flags in the shop drawer: a little flag on a pole
export function flagModel(flag) {
  const g = new THREE.Group(); const fe = flagEmblem(flag);
  g.add(cyl(.03, .03, 1.1, F(DWOOD), [-.3, .55, 0], 8)); g.add(sb(MT(GOLD), [-.3, 1.12, 0], .05));
  const fgeo = new THREE.PlaneGeometry(.7, .46, 8, 1); { const p = fgeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + .35) * 6) * .04); fgeo.computeVertexNormals(); }
  g.add(mesh(fgeo, FD(fe.bg), [.05, .82, 0]));
  fe.g.scale.setScalar(1.8); fe.g.position.set(.05, .82, .04); g.add(fe.g);
  return g;
}
export const FLAG_EMOJI = ['🌸', '⭐', '🐚', '🧚', '👑'];
export const VIEWS = {
  '✉️': { pitch: .35 }, '✉': { pitch: .35 }, '🗺️': { pitch: .3, yaw: .15 }, '🗺': { pitch: .3, yaw: .15 }, '🟥': { pitch: .9, yaw: .2 }, '🖼️': { yaw: .15, pitch: .05 }, '🖼': { yaw: .15, pitch: .05 },
  '🪞': { yaw: .15, pitch: .05 }, '🐟': { yaw: .05 }, '🐠': { yaw: .05 }, '🐋': { yaw: .15 }, '📖': { pitch: .55 }, '🧭': { yaw: .1, pitch: .1 }, '🪙': { yaw: .1 },
  '⭐': { yaw: .1, pitch: .05 }, '🌸': { yaw: .1, pitch: .05 }, '🛡️': { yaw: .2 }, '🪁': { yaw: .1, pitch: .05 },
};
export { T as TREASURE, D as DECOR3D };

// Bake a model to a PNG with the kit's Baker, framing its bounding box tightly from the given yaw/pitch.
const _v = new THREE.Vector3(), _box = new THREE.Box3();
export function fitBake(baker, key, build, view = {}) {
  if (baker.cache.has(key)) return baker.cache.get(key);
  const w = view.w || baker.size, h = view.h || baker.size, pad = view.pad ?? 1.08, yaw = view.yaw ?? .35, pitch = view.pitch ?? .18;
  baker.r.setPixelRatio(1); baker.r.setSize(w, h, false);
  const obj = build(); baker.scene.add(obj); obj.updateMatrixWorld(true);
  _box.makeEmpty();
  obj.traverse(o => { if (o.isMesh && !o.userData.noFit) { o.geometry.computeBoundingBox(); _box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const c = _box.getCenter(new THREE.Vector3());
  const cam = baker.cam; cam.aspect = w / h; cam.updateProjectionMatrix();
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = new THREE.Vector3().crossVectors(UP, dir).normalize(), up = new THREE.Vector3().crossVectors(dir, right);
  const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / pad, th = tv * cam.aspect;
  let d = 0, cx = 0, cy = 0;
  // centre the projected box, then back off until every corner fits
  const corners = []; for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).sub(c));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of corners) { const x = p.dot(right), y = p.dot(up); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
  const cc = c.clone().addScaledVector(right, cx).addScaledVector(up, cy);
  for (const p0 of corners) { const p = p0.clone().addScaledVector(right, -cx).addScaledVector(up, -cy); const z = p.dot(dir); d = Math.max(d, z + Math.abs(p.dot(up)) / tv, z + Math.abs(p.dot(right)) / th); }
  cam.position.copy(cc).addScaledVector(dir, d); cam.up.set(0, 1, 0); cam.lookAt(cc);
  cam.near = Math.max(.01, d / 100); cam.far = d * 4; cam.updateProjectionMatrix();
  baker.r.render(baker.scene, cam);
  const url = baker.canvas.toDataURL('image/png');
  baker.scene.remove(obj);
  baker.cache.set(key, url);
  return url;
}
