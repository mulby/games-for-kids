// Acorn Bakery: felt-toy 3D models, all built in code from the shared toy kit.
//  - mouse(): the baker mouse, Maileg style (big round ears, bead eyes, a little dress and apron).
//  - critter(emoji): every bakery customer (hedgehog, bunny, owl, unicorn...). Feet at y=0, facing +z, userData.h = height.
//  - goodModel(id), acornModel(), jarModel(): the treats and acorns the child counts.
//  - decorModel(id): the 20 mouse-house treasures.
//  - roomModel(): the mouse-house room, in the 1000x600 units of the old drawing (centre at 0,0, y up).
//  - bakeryInterior(), bakeryExterior(): the two background worlds (meters, floor at y=0).
import * as K from '../../shared/toy3d.js';
const { THREE, mat, tube: ktube, slab, roundRectShape, glow, mesh, SPH, geo, freeze, lighten, cheeks, smile } = K;
// LO: low-detail mode while building the background scenery (spheres, capsules, lathes and tubes use fewer segments)
let LO = false;
function lo(fn) { LO = true; try { return fn(); } finally { LO = false; } }
const ball = (m, p, s, r) => mesh(SPH(LO ? 12 : 24), m, p, s, r);
function capsule(m, a, b, rad) {
  if (!LO) return K.capsule(m, a, b, rad);
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = Math.max(.001, A.distanceTo(B));
  const x = new THREE.Mesh(geo('lcap' + rad.toFixed(3) + '/' + len.toFixed(3), () => new THREE.CapsuleGeometry(rad, len, 2, 6)), m);
  x.position.copy(A).add(B).multiplyScalar(.5); x.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return x;
}
const tube = (pts, r, m, seg = 20, radial = 8) => ktube(pts, r, m, LO ? Math.max(4, seg >> 1) : seg, LO ? Math.min(radial, 5) : radial);

/* ---------------- helpers ---------------- */
// lathe profiles are [radius, y]; this flips them when needed so the surface never comes out inside-out
function lathe(pts, m, seg = 28) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return K.lathe(a < 0 ? pts.slice().reverse() : pts, m, LO ? Math.max(8, seg >> 1) : seg);
}
const F = c => mat(c, { felt: true });
const G = c => mat(c, { gloss: true });
const P = c => mat(c, { rough: .55 });
const M = (c, s = .12) => mat(c, { metal: true, shine: s });
const GL = (c, k = 1) => mat(c, { glow: k });
const UP = new THREE.Vector3(0, 1, 0);
const sb = (m, p, s, r) => mesh(SPH(LO ? 6 : 12), m, p, s, r);
const TAU = Math.PI * 2;
function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function slabLo(shape, depth, m, bevel = .02, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}
function rbox(w, h, d, m, r = .03, p = [0, 0, 0], rot = [0, 0, 0]) {
  const b = Math.min(.016 * Math.max(1, w, h) , d / 4, w / 4, h / 4);
  const s = slabLo(roundRectShape(w - 2 * b, h - 2 * b, Math.max(.002, r - b)), Math.max(.002, d - 2 * b), m, b, r > .06 ? 8 : 5);
  s.position.set(...p); s.rotation.set(...rot); return s;
}
function box(w, h, d, m, p = [0, 0, 0], rot = [0, 0, 0]) { return mesh(geo('box1', () => new THREE.BoxGeometry(1, 1, 1)), m, p, [w, h, d], rot); }
function cone(m, base, dir, len, r, seg = 8) {
  const x = mesh(geo('cone' + seg, () => { const c = new THREE.ConeGeometry(1, 1, seg); c.translate(0, .5, 0); return c; }), m, base, [r, len, r]);
  x.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize()); return x;
}
function cyl(m, p, r, h, seg = 20, rot = [0, 0, 0]) { if (LO) seg = Math.max(8, seg >> 1); return mesh(geo('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg)), m, p, [r, h, r], rot); }
function torus(m, p, R, r, rot = [Math.PI / 2, 0, 0], arc = TAU, seg = 32) {
  if (LO) seg = Math.max(10, seg >> 1);
  const rs = LO ? 5 : 8;
  return mesh(geo('tor' + (r / R).toFixed(3) + arc.toFixed(2) + seg + '/' + rs, () => new THREE.TorusGeometry(1, r / R, rs, seg, arc)), m, p, R, rot);
}
function archShape(w, h) { // flat bottom, round top, centred
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, -h / 2); s.lineTo(r, -h / 2); s.lineTo(r, h / 2 - r); s.absarc(0, h / 2 - r, r, 0, Math.PI, false); s.lineTo(-r, -h / 2);
  return s;
}
function archPath(w, h, cx = 0, cy = 0) { const s = new THREE.Path(), r = w / 2; s.moveTo(cx - r, cy - h / 2); s.lineTo(cx + r, cy - h / 2); s.lineTo(cx + r, cy + h / 2 - r); s.absarc(cx, cy + h / 2 - r, r, 0, Math.PI, false); s.lineTo(cx - r, cy - h / 2); return s; }
function rectPath(x0, y0, x1, y1) { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.lineTo(x0, y0); return p; }
function circlePath(cx, cy, r) { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, TAU, false); return p; }
export function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const f = c => Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
  return '#' + [f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}

/* ---------------- faces ---------------- */
const INK = '#2b1d14';
// small glossy bead eyes (Maileg style), optional closed happy arcs
function beadEyes(g, { x = .2, y = 0, z = .45, r = .07, closed = false, ink = INK, name = '', turn = .3 } = {}) {
  const grp = new THREE.Group(); if (name) { grp.name = name; grp.userData.live = true; }
  const ek = G(ink), wh = mat('#ffffff', { glow: .7 });
  for (const sx of [-1, 1]) {
    if (closed) { grp.add(mesh(geo('lidarc', () => new THREE.TorusGeometry(1, .2, 6, 14, Math.PI)), ek, [sx * x, y - r * .3, z + r * .3], r * 1.05, [0, sx * turn, 0])); continue; }
    grp.add(sb(ek, [sx * x, y, z], [r, r * 1.15, r * .7], [0, sx * turn, 0]));
    grp.add(sb(wh, [sx * x + r * .3, y + r * .42, z + r * .58], r * .3));
  }
  g.add(grp); return grp;
}
// shadow disc under characters (soft dark radial gradient)
let shMat;
function shadowMat() {
  if (shMat) return shMat;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  shMat = new THREE.MeshBasicMaterial({ map: t, color: '#3a2414', transparent: true, depthWrite: false, opacity: .8 });
  return shMat;
}
export function shadowDisc(rx, rz = rx) {
  const m = new THREE.Mesh(geo('shdisc', () => new THREE.CircleGeometry(1, 24)), shadowMat());
  m.rotation.x = -Math.PI / 2; m.position.y = .01; m.scale.set(rx, rz, 1);
  m.userData.noMerge = true; m.userData.noFit = true; m.renderOrder = 1; m.name = 'shadow';
  return m;
}

/* ================================================================ the baker mouse */
// about 2.55 tall (ear tips), feet at y=0, facing +z
export function mouse({ fur = '#b08968', apron = '#d4677a', dress = null } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'mBody'; body.userData.live = true; root.add(body);
  const fm = F(fur), lm = F(shadeHex(fur, .4)), pk = F('#f2b8bd'), am = F(apron), wm = F('#fff6ea'), dm = F(dress || shadeHex(apron, .55));
  body.add(lathe([[0, .1], [.34, .12], [.47, .38], [.48, .68], [.41, 1.0], [.28, 1.24], [0, 1.32]], fm, 28));
  // dress (pale) with an apron over it
  body.add(lathe([[0, .17], [.6, .17], [.64, .23], [.56, .6], [.46, .96], [0, .98]], dm, 32));
  body.add(torus(wm, [0, .21, 0], .62, .035));
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; body.add(sb(wm, [Math.sin(a) * .63, .19, Math.cos(a) * .63], .045)); }
  // apron front: a curved panel following the skirt
  const ap = new THREE.CylinderGeometry(.6, .66, .62, 20, 1, true, -.9, 1.8); ap.translate(0, .52, 0);
  body.add(mesh(ap, mat(apron, { felt: true, side: THREE.DoubleSide }), [0, 0, .025], 1));
  body.add(rbox(.42, .34, .05, am, .07, [0, 1.04, .4], [-.28, 0, 0]));
  for (const sx of [-1, 1]) {
    body.add(capsule(am, [sx * .16, 1.18, .37], [sx * .22, 1.3, -.12], .032));
    body.add(sb(wm, [sx * .15, 1.17, .42], .035));
  }
  body.add(rbox(.2, .14, .04, wm, .05, [0, .52, .66], [-.15, 0, 0]));
  body.add(capsule(am, [-.62, .8, 0], [.62, .8, 0], .03).translateZ(-.05).translateY(.02)); // apron tie (hidden mostly)
  for (const sx of [-1, 1]) body.add(sb(pk, [sx * .2, .07, .32], [.14, .08, .2]));
  body.add(tube([[0, .35, -.42], [.18, .2, -.8], [.55, .25, -.95], [.8, .55, -.72], [.72, .85, -.5]], .033, F('#e7a3a8'), 24, 6));
  const armL = new THREE.Group(); armL.position.set(-.42, 1.08, .05); armL.name = 'mArmL'; armL.userData.live = true;
  armL.add(capsule(fm, [0, 0, 0], [-.1, -.4, .1], .085)); armL.add(sb(fm, [-.11, -.48, .12], .1));
  const armR = new THREE.Group(); armR.position.set(.42, 1.08, .05); armR.name = 'mArmR'; armR.userData.live = true;
  armR.add(capsule(fm, [0, 0, 0], [.1, -.4, .1], .085)); armR.add(sb(fm, [.11, -.48, .12], .1));
  body.add(armL, armR);
  const head = new THREE.Group(); head.position.set(0, 1.74, 0); head.name = 'mHead'; head.userData.live = true; body.add(head);
  head.add(ball(fm, [0, 0, 0], [.52, .47, .48]));
  head.add(ball(fm, [0, -.15, .3], [.3, .23, .34]));
  head.add(ball(lm, [0, -.17, .4], [.23, .17, .26]));
  head.add(sb(G('#e0707f'), [0, -.1, .66], [.075, .065, .06]));
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * .4, .36, -.08); e.rotation.set(-.1, -sx * .25, -sx * .45);
    e.add(ball(fm, [0, 0, 0], [.34, .34, .07])); e.add(ball(pk, [0, -.02, .045], [.24, .24, .045]));
    head.add(e);
  }
  beadEyes(head, { x: .19, y: .1, z: .41, r: .062, name: 'mEyeO' });
  beadEyes(head, { x: .19, y: .1, z: .41, r: .062, closed: true, name: 'mEyeH' });
  cheeks(head, { y: -.08, x: .33, z: .36 });
  smile(head, { y: -.27, z: .6, w: .055, color: '#6b3b2b' });
  const wk = F(shadeHex(fur, -.35));
  for (const sx of [-1, 1]) { head.add(capsule(wk, [sx * .14, -.12, .58], [sx * .5, -.06, .6], .007)); head.add(capsule(wk, [sx * .14, -.16, .58], [sx * .5, -.2, .58], .007)); }
  // little bow on the left ear
  for (const sx of [-1, 1]) head.add(sb(am, [-.28 + sx * .08, .5, .05], [.08, .055, .04], [0, 0, sx * .5]));
  head.add(sb(am, [-.28, .5, .07], .035));
  root.add(shadowDisc(.8, .7));
  freeze(root);
  const eyeO = root.getObjectByName('mEyeO'), eyeH = root.getObjectByName('mEyeH'); eyeH.visible = false;
  Object.assign(root.userData, { kind: 'mouse', body, head, armL, armR, eyeO, eyeH, h: 2.55, t0: Math.random() * 10 });
  return root;
}

/* ================================================================ customers */
// a small chibi body: egg lathe of radius r and height h
const egg = (m, r, h, y0 = 0) => lathe([[0, y0], [r * .7, y0 + h * .02], [r, y0 + h * .35], [r * .92, y0 + h * .7], [r * .55, y0 + h * .95], [0, y0 + h]], m, 28);
function feet(g, m, x = .22, z = .25, s = [.15, .09, .2]) { for (const sx of [-1, 1]) g.add(sb(m, [sx * x, .07, z], s)); }
function arms(g, m, y, x, len = .38, r = .08) { for (const sx of [-1, 1]) { g.add(capsule(m, [sx * x, y, .05], [sx * (x + .12), y - len, .14], r)); g.add(sb(m, [sx * (x + .13), y - len - .05, .15], r * 1.15)); } }
function face(head, o) { beadEyes(head, o); cheeks(head, { y: o.cy ?? o.y - .17, x: o.cx ?? o.x + .14, z: o.cz ?? o.z - .06 }); if (o.smile !== false) smile(head, { y: o.my ?? o.y - .24, z: o.mz ?? o.z + .02, w: o.mw ?? .07, color: '#5a2e22' }); }
function begin() {
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'cBody'; body.userData.live = true; root.add(body);
  const head = new THREE.Group(); head.name = 'cHead'; head.userData.live = true; body.add(head);
  return { root, body, head };
}
function finish(r, h, extra = {}) {
  r.root.add(shadowDisc(extra.sh || .85, (extra.sh || .85) * .8));
  freeze(r.root);
  Object.assign(r.root.userData, { kind: 'critter', body: r.body, head: r.head, h, t0: Math.random() * 10 }, extra);
  return r.root;
}
function wingPair(r, m, make, pos, axis = 'y') {
  const out = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.name = sx < 0 ? 'cWL' : 'cWR'; w.userData.live = true; w.position.set(sx * pos[0], pos[1], pos[2]);
    make(w, sx, m); r.body.add(w); out.push(w);
  }
  return { wl: out[0], wr: out[1], flapAxis: axis };
}

const CR = {};
// Mrs. Prickleback: a hedgehog in a white mob cap and apron
CR.hedgehog = () => {
  const r = begin(), fm = F('#d8b48a'), sp = F('#7a5638'), sp2 = F('#946a45');
  r.body.add(ball(fm, [0, .82, 0], [.8, .78, .74]));
  const rr = rnd(7);
  for (let i = 0; i < 120; i++) {
    const y = 1 - (i + .5) / 120 * 2, rad = Math.sqrt(1 - y * y), th = i * 2.39996;
    const d = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
    if (d.z > .25 || d.y < -.35) continue;
    if (d.z > -.05 && d.y < .55 && Math.abs(d.x) < .5) continue;
    r.body.add(cone(i % 3 ? sp : sp2, [d.x * .72, .82 + d.y * .7, d.z * .66], [d.x, d.y + .25, d.z - .2], .34 + rr() * .08, .085, 5));
  }
  r.body.add(rbox(.72, .62, .06, F('#fff8ee'), .12, [0, .5, .66], [-.25, 0, 0]));
  r.body.add(torus(F('#c9a0dc'), [0, 1.08, .05], .66, .06, [Math.PI / 2 - .25, 0, 0]));
  feet(r.body, F('#5e4030'), .3, .35, [.15, .08, .17]);
  arms(r.body, fm, .82, .62, .25, .085);
  r.head.position.set(0, .95, .45);
  r.head.add(ball(fm, [0, -.05, .25], [.32, .27, .42]));
  r.head.add(sb(G('#2b1d14'), [0, -.03, .68], [.08, .07, .07]));
  face(r.head, { x: .2, y: .14, z: .3, r: .06, my: -.18, mz: .58, cy: 0, cx: .34, cz: .2 });
  for (const sx of [-1, 1]) r.head.add(ball(fm, [sx * .34, .34, .1], [.11, .12, .06]));
  // mob cap
  const cap = F('#ffffff');
  r.head.add(lathe([[0, .65], [.3, .6], [.45, .45], [.47, .32], [0, .36]], cap, 24).translateZ(-.1));
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; r.head.add(sb(cap, [Math.sin(a) * .48, .32, Math.cos(a) * .48 - .1], [.09, .05, .09])); }
  r.head.add(sb(F('#c9a0dc'), [.3, .52, .2], [.09, .06, .05], [0, 0, .6]));
  return finish(r, 2.05, { sh: 1 });
};
// Bramble Bunny
CR.bunny = () => {
  const r = begin(), fm = F('#e9dccb'), pk = F('#f2b8bd'), sc = F('#7ea6c9');
  r.body.add(egg(fm, .5, 1.25, .05));
  r.body.add(ball(F('#fff8f0'), [0, .55, .32], [.3, .35, .2]));
  feet(r.body, fm, .22, .3, [.16, .09, .28]);
  arms(r.body, fm, 1.0, .38, .32, .075);
  r.body.add(sb(F('#ffffff'), [0, .4, -.5], .17));
  r.body.add(torus(sc, [0, 1.22, 0], .3, .07));
  r.body.add(sb(sc, [.12, 1.12, .3], [.12, .14, .06], [0, 0, -.4]));
  r.head.position.set(0, 1.66, 0);
  r.head.add(ball(fm, [0, 0, 0], [.48, .44, .44]));
  r.head.add(ball(F('#fff8f0'), [0, -.16, .3], [.22, .16, .18]));
  r.head.add(sb(G('#e0707f'), [0, -.06, .45], [.06, .05, .04]));
  face(r.head, { x: .2, y: .06, z: .38, r: .06, my: -.2, mz: .46, mw: .05 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * .2, .32, -.05); e.rotation.set(-.15, 0, -sx * .18);
    e.add(capsule(fm, [0, 0, 0], [0, .62, 0], .13)); e.add(ball(pk, [0, .33, .08], [.08, .3, .04])); r.head.add(e);
  }
  return finish(r, 2.75);
};
// Old Hazel: a red squirrel with spectacles and a big bushy tail
CR.squirrel = () => {
  const r = begin(), fm = F('#c8673a'), cr = F('#f3dcc0'), tm = F('#d47a48');
  r.body.add(egg(fm, .46, 1.2, .05));
  r.body.add(ball(cr, [0, .62, .27], [.3, .4, .2]));
  feet(r.body, fm, .2, .3, [.15, .09, .24]);
  arms(r.body, fm, .98, .36, .3, .075);
  r.body.add(lathe([[0, 0], [.1, .02], [.13, .12], [.11, .18], [0, .2]], G('#b07a3f'), 14).translateY(.55).translateZ(.42));
  r.body.add(lathe([[0, .16], [.13, .17], [.12, .24], [0, .27]], F('#6b4a24'), 14).translateY(.55).translateZ(.42));
  const pts = []; for (let i = 0; i < 16; i++) { const t = i / 15, a = -1.2 + t * 4.6, rad = .55 - t * .25; pts.push([Math.cos(a) * rad * .2, .35 + t * 1.4 + Math.sin(a) * .2, -.5 - Math.sin(t * 3) * .45]); }
  pts.forEach((p, i) => r.body.add(ball(i % 2 ? tm : fm, p, .36 - Math.abs(i - 9) * .015)));
  r.head.position.set(0, 1.58, .02);
  r.head.add(ball(fm, [0, 0, 0], [.46, .42, .42]));
  r.head.add(ball(cr, [0, -.14, .26], [.24, .17, .2]));
  r.head.add(sb(G('#3a2a20'), [0, -.06, .44], [.06, .05, .04]));
  face(r.head, { x: .18, y: .06, z: .37, r: .055, my: -.21, mz: .44, mw: .05 });
  const gold = M('#d1a65a', .3);
  for (const sx of [-1, 1]) r.head.add(torus(gold, [sx * .18, .06, .45], .1, .015, [0, 0, 0], TAU, 20));
  r.head.add(torus(gold, [0, .08, .46], .05, .012, [0, 0, 0], Math.PI, 10));
  for (const sx of [-1, 1]) { r.head.add(cone(fm, [sx * .26, .3, -.02], [sx * .25, 1, 0], .3, .12, 8)); r.head.add(cone(tm, [sx * .32, .55, -.02], [sx * .3, 1, 0], .14, .05, 6)); }
  return finish(r, 2.1, { sh: 1 });
};
// Wren: a tiny round brown bird
CR.wren = () => {
  const r = begin(), fm = F('#9a6b47'), cr = F('#ecd2a8'), dk = F('#6e4a30');
  r.body.add(ball(fm, [0, .66, 0], [.56, .55, .56]));
  r.body.add(ball(cr, [0, .56, .26], [.4, .38, .34]));
  const rr = rnd(3); for (let i = 0; i < 14; i++) { const a = rr() * 2.4 - 1.2 + Math.PI, y = .5 + rr() * .5; r.body.add(sb(dk, [Math.sin(a) * .55, y, Math.cos(a) * .52], [.05, .03, .03])); }
  r.body.add(rbox(.32, .62, .06, dk, .14, [0, 1.15, -.55], [.6, 0, 0]));
  for (const sx of [-1, 1]) { r.body.add(capsule(G('#e0a050'), [sx * .14, .2, .05], [sx * .16, 0, .1], .03)); r.body.add(sb(G('#e0a050'), [sx * .16, .02, .17], [.06, .02, .09])); }
  r.head.position.set(0, 1.18, .12);
  r.head.add(ball(fm, [0, 0, 0], [.36, .34, .34]));
  r.head.add(ball(cr, [0, -.1, .14], [.24, .18, .22]));
  r.head.add(cone(G('#4a3a2a'), [0, -.02, .3], [0, -.1, 1], .2, .06, 8));
  r.head.add(capsule(F('#f4e4c8'), [-.28, .1, .16], [-.1, .18, .3], .025)); r.head.add(capsule(F('#f4e4c8'), [.28, .1, .16], [.1, .18, .3], .025));
  face(r.head, { x: .15, y: .05, z: .28, r: .05, smile: false, cy: -.08, cx: .22, cz: .25 });
  const w = wingPair(r, fm, (g, sx, m) => g.add(ball(m, [sx * .1, -.15, -.05], [.12, .32, .3], [0, 0, sx * .3])), [.5, .8, -.05], 'z');
  return finish(r, 1.6, { ...w, sh: .7 });
};
// Toadflax: a frog in a red bow tie
CR.frog = () => {
  const r = begin(), gm = F('#7cb85a'), bm = F('#e3eebf'), dk = F('#5f9a45');
  r.body.add(ball(gm, [0, .62, 0], [.72, .58, .6]));
  r.body.add(ball(bm, [0, .55, .3], [.48, .4, .32]));
  for (const sx of [-1, 1]) { r.body.add(ball(gm, [sx * .55, .25, .2], [.25, .2, .38])); r.body.add(sb(dk, [sx * .62, .07, .55], [.18, .06, .14])); }
  arms(r.body, gm, .72, .55, .28, .08);
  for (const sx of [-1, 1]) r.body.add(ball(F('#d4677a'), [sx * .13, 1.05, .42], [.13, .09, .05], [0, 0, sx * .4]));
  r.body.add(sb(F('#b84a5c'), [0, 1.05, .45], .05));
  r.head.position.set(0, 1.12, .05);
  r.head.add(ball(gm, [0, 0, 0], [.6, .38, .48]));
  for (const sx of [-1, 1]) r.head.add(ball(gm, [sx * .3, .3, .1], [.2, .2, .2]));
  beadEyes(r.head, { x: .3, y: .34, z: .28, r: .075 });
  cheeks(r.head, { y: -.02, x: .42, z: .36 });
  r.head.add(mesh(geo('frogmouth', () => new THREE.TorusGeometry(1, .07, 6, 24, Math.PI * .7)), G('#3a5a2a'), [0, -.02, .47], .25, [0, 0, Math.PI + Math.PI * .15]));
  return finish(r, 1.55, { sh: .95 });
};
// Professor Hoot: an owl with spectacles and a mortarboard
CR.owl = () => {
  const r = begin(), fm = F('#a0703f'), cr = F('#ecd4a8'), dk = F('#7a5230');
  r.body.add(egg(fm, .62, 1.55, .05));
  r.body.add(ball(cr, [0, .7, .3], [.42, .5, .3]));
  for (let i = 0; i < 9; i++) { const row = Math.floor(i / 3), c = i % 3 - 1; r.body.add(sb(dk, [c * .18 + (row % 2) * .09 - .045, .95 - row * .2, .55 - Math.abs(c) * .05], [.06, .03, .03])); }
  for (const sx of [-1, 1]) r.body.add(ball(dk, [sx * .58, .85, -.05], [.16, .5, .35], [0, 0, sx * .2]));
  feet(r.body, G('#e0a050'), .2, .3, [.12, .06, .16]);
  r.head.position.set(0, 1.62, .05);
  r.head.add(ball(fm, [0, 0, 0], [.6, .5, .5]));
  for (const sx of [-1, 1]) { r.head.add(ball(cr, [sx * .22, .02, .33], [.22, .22, .12])); r.head.add(cone(fm, [sx * .4, .32, 0], [sx * .5, 1, .1], .3, .1, 6)); }
  beadEyes(r.head, { x: .22, y: .04, z: .44, r: .08, ink: '#2b1d14' });
  r.head.add(cone(G('#e0a050'), [0, -.08, .42], [0, -.6, 1], .16, .07, 6));
  const gold = M('#d1a65a', .3);
  for (const sx of [-1, 1]) r.head.add(torus(gold, [sx * .22, .04, .5], .13, .016, [0, 0, 0], TAU, 20));
  r.head.add(torus(gold, [0, .06, .51], .06, .014, [0, 0, 0], Math.PI, 10));
  const bk = F('#2e2650');
  r.head.add(cyl(bk, [0, .5, 0], .3, .16, 16));
  r.head.add(box(.85, .05, .85, bk, [0, .6, 0], [0, .5, 0]));
  r.head.add(sb(F('#e8b04b'), [0, .64, 0], .05));
  r.head.add(capsule(F('#e8b04b'), [0, .63, 0], [.35, .5, .3], .02));
  r.head.add(sb(F('#e8b04b'), [.36, .42, .3], [.05, .1, .05]));
  return finish(r, 2.35, { sh: 1 });
};
// Dot: a ladybird
CR.ladybird = () => {
  const r = begin(), red = G('#d83a3a'), bk = G('#2a2230');
  r.body.add(lathe([[0, .12], [.6, .12], [.68, .3], [.6, .62], [.35, .84], [0, .9]], red, 30));
  r.body.add(box(.03, .7, 1.2, bk, [0, .55, -.05], [-.4, 0, 0]));
  [[.3, .6, .35], [-.3, .6, .35], [.45, .45, -.15], [-.45, .45, -.15], [.2, .75, -.25], [-.2, .75, -.25], [0, .82, .1]].forEach(([x, y, z]) => { const v = new THREE.Vector3(x, y - .3, z).normalize(); const sp = sb(bk, [x, y, z], [.12, .12, .04]); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v); r.body.add(sp); });
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) r.body.add(capsule(bk, [sx * .45, .2, .3 - i * .3], [sx * .7, .03, .35 - i * .3], .04));
  r.head.position.set(0, .55, .55);
  r.head.add(ball(bk, [0, 0, 0], [.4, .36, .34]));
  for (const sx of [-1, 1]) r.head.add(sb(F('#ffffff'), [sx * .15, .06, .26], [.11, .12, .07]));
  beadEyes(r.head, { x: .15, y: .06, z: .32, r: .065 });
  cheeks(r.head, { y: -.08, x: .25, z: .27 });
  smile(r.head, { y: -.14, z: .33, w: .06, color: '#ffffff' });
  for (const sx of [-1, 1]) { r.head.add(tube([[sx * .12, .3, .1], [sx * .2, .6, .2], [sx * .32, .75, .1]], .02, bk, 8, 4)); r.head.add(sb(bk, [sx * .33, .76, .1], .06)); }
  return finish(r, 1.35, { sh: .9 });
};
// Shelly Snail
CR.snail = () => {
  const r = begin(), bm = F('#cfc79a'), sh = F('#e8a07a'), sh2 = F('#f4c9a0');
  r.body.add(capsule(bm, [0, .18, -.7], [0, .18, .55], .2));
  r.body.add(ball(bm, [0, .2, .6], [.24, .2, .25]));
  r.body.add(ball(sh, [0, .78, -.2], [.42, .62, .64]));
  for (const sx of [-1, 1]) { const sp = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * 3.6 * Math.PI, rad = .56 * (1 - t * .92); const yy = Math.sin(a) * rad, zz = Math.cos(a) * rad; const bulge = Math.sqrt(Math.max(0, 1 - (yy / .62) ** 2 - (zz / .64) ** 2)); sp.push([sx * (.4 * bulge + .03), .78 + yy, -.2 + zz]); } r.body.add(tube(sp, .045, sh2, 80, 6)); r.body.add(sb(sh2, [sx * .42, .78, -.2], .07)); }
  r.head.position.set(0, .55, .62);
  r.head.add(ball(bm, [0, 0, 0], [.26, .3, .24]));
  for (const sx of [-1, 1]) { r.head.add(capsule(bm, [sx * .1, .2, 0], [sx * .2, .6, .05], .04)); r.head.add(sb(G(INK), [sx * .2, .64, .09], .06)); r.head.add(sb(mat('#ffffff', { glow: .6 }), [sx * .2 + .02, .66, .14], .018)); }
  cheeks(r.head, { y: -.05, x: .17, z: .18 });
  smile(r.head, { y: -.12, z: .23, w: .05, color: '#5a2e22' });
  return finish(r, 1.45, { sh: .9 });
};
// Bumble: a round bumblebee
CR.bee = () => {
  const r = begin(), ym = F('#f2c94c'), bk = F('#3a2f2a');
  r.body.add(ball(ym, [0, .85, 0], [.62, .6, .62]));
  for (const [y, s] of [[.62, .94], [.98, .88]]) r.body.add(torus(bk, [0, y, 0], .6 * s, .09, [Math.PI / 2, 0, 0]));
  r.body.add(cone(bk, [0, .7, -.55], [0, -.2, -1], .2, .06, 6));
  for (const sx of [-1, 1]) r.body.add(capsule(bk, [sx * .25, .3, .2], [sx * .3, .1, .25], .05));
  r.head.position.set(0, .85, 0);
  face(r.head, { x: .2, y: .14, z: .56, r: .07, my: -.1, mz: .6 });
  for (const sx of [-1, 1]) { r.head.add(tube([[sx * .15, .5, .3], [sx * .25, .85, .35], [sx * .38, .95, .2]], .025, bk, 8, 4)); r.head.add(sb(bk, [sx * .39, .96, .2], .06)); }
  const wm = new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', transparent: true, opacity: .7, roughness: .2, depthWrite: false, side: THREE.DoubleSide });
  const w = wingPair(r, wm, (g, sx, m) => g.add(ball(m, [sx * .28, .2, 0], [.32, .2, .04], [0, 0, sx * .5])), [.25, 1.35, -.15], 'z');
  return finish(r, 1.75, { ...w, hover: true, fast: true, sh: .75 });
};
// Sir Russet: a fox in a green feathered hat and cape
CR.fox = () => {
  const r = begin(), fm = F('#d9773a'), wm = F('#fff4e6'), dk = F('#4a3226'), gr = F('#6f8a50');
  r.body.add(egg(fm, .48, 1.25, .05));
  r.body.add(ball(wm, [0, .75, .28], [.26, .4, .2]));
  feet(r.body, dk, .2, .3, [.14, .09, .22]);
  arms(r.body, fm, 1.0, .38, .32, .075);
  r.body.add(lathe([[0, 1.25], [.36, 1.2], [.55, .7], [.6, .3], [0, .4]], mat('#6f8a50', { felt: true, side: THREE.DoubleSide }), 20).translateZ(-.08));
  const tail = [[0, .3, -.5], [.15, .45, -.85], [.35, .75, -1.0], [.45, 1.05, -.95]]; tail.forEach((p, i) => r.body.add(ball(fm, p, .22 + i * .03)));
  r.body.add(ball(wm, [.5, 1.3, -.9], .22));
  r.head.position.set(0, 1.62, 0);
  r.head.add(ball(fm, [0, 0, 0], [.48, .42, .44]));
  r.head.add(ball(wm, [0, -.14, .28], [.26, .18, .26]));
  r.head.add(cone(wm, [0, -.14, .3], [0, 0, 1], .25, .12, 10));
  r.head.add(sb(G('#2b1d14'), [0, -.13, .56], [.06, .05, .05]));
  face(r.head, { x: .19, y: .06, z: .37, r: .058, my: -.25, mz: .44, mw: .05 });
  for (const sx of [-1, 1]) { r.head.add(cone(fm, [sx * .27, .28, -.05], [sx * .4, 1, 0], .42, .15, 4)); r.head.add(cone(dk, [sx * .38, .55, -.05], [sx * .4, 1, 0], .16, .07, 4)); }
  r.head.add(lathe([[0, .62], [.28, .4], [.33, .32], [0, .34]], gr, 16).rotateZ(-.25));
  r.head.add(torus(F('#5a7040'), [-.04, .34, 0], .32, .04));
  r.head.add(tube([[.18, .45, -.1], [.45, .7, -.25], [.7, .95, -.4]], .04, F('#d4677a'), 10, 5));
  return finish(r, 2.35);
};
// Grandpa Moss: a tortoise in a flat cap
CR.tortoise = () => {
  const r = begin(), sh = F('#7c8a4a'), sk = F('#b5b77a'), pl = F('#a3ad66');
  r.body.add(lathe([[0, .28], [.78, .3], [.82, .45], [.7, .8], [.4, 1.02], [0, 1.08]], sh, 30));
  r.body.add(torus(F('#c8b878'), [0, .32, 0], .8, .06));
  [[0, 1.05, 0, .25], [.4, .85, .3, .17], [-.4, .85, .3, .17], [.45, .85, -.3, .17], [-.45, .85, -.3, .17], [0, .82, .5, .17], [0, .82, -.5, .17]].forEach(([x, y, z, s]) => { const v = new THREE.Vector3(x, y - .2, z).normalize(); const pq = sb(pl, [x, y, z], [s, s, .05]); pq.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v); r.body.add(pq); });
  for (const [x, z] of [[.5, .4], [-.5, .4], [.5, -.4], [-.5, -.4]]) r.body.add(capsule(sk, [x, .3, z], [x * 1.05, .1, z * 1.05], .16));
  r.head.position.set(0, .78, 1.05);
  r.body.add(capsule(sk, [0, .45, .55], [0, .7, .95], .17));
  r.head.add(ball(sk, [0, 0, 0], [.32, .3, .32]));
  beadEyes(r.head, { x: .14, y: .05, z: .27, r: .045, closed: true });
  cheeks(r.head, { y: -.05, x: .22, z: .22 });
  smile(r.head, { y: -.12, z: .3, w: .05, color: '#5a2e22' });
  const cap = F('#8a7a6a');
  r.head.add(ball(cap, [0, .2, -.02], [.34, .14, .34]));
  r.head.add(ball(cap, [0, .17, .25], [.22, .04, .16]));
  return finish(r, 1.45, { sh: 1.1 });
};
// Flutter: a butterfly
CR.butterfly = () => {
  const r = begin(), bm = F('#5a4a7a');
  r.body.add(capsule(bm, [0, .4, 0], [0, 1.1, 0], .1));
  r.head.position.set(0, 1.3, .05);
  r.head.add(ball(F('#b9a6e8'), [0, 0, 0], .22));
  beadEyes(r.head, { x: .08, y: .03, z: .18, r: .04 });
  cheeks(r.head, { y: -.06, x: .14, z: .15 });
  for (const sx of [-1, 1]) { r.head.add(tube([[sx * .05, .15, 0], [sx * .15, .45, .05], [sx * .28, .55, 0]], .015, bm, 8, 4)); r.head.add(sb(bm, [sx * .29, .56, 0], .04)); }
  const wm = mat('#f2a65a', { felt: true, side: THREE.DoubleSide }), wm2 = mat('#f6c4d8', { felt: true, side: THREE.DoubleSide }), spot = F('#fff6e0');
  const w = wingPair(r, wm, (g, sx, m) => {
    g.add(ball(m, [sx * .42, .32, 0], [.45, .42, .03], [0, 0, sx * .5]));
    g.add(ball(wm2, [sx * .35, -.18, 0], [.3, .3, .03], [0, 0, -sx * .4]));
    g.add(sb(spot, [sx * .55, .4, .03], [.1, .1, .02])); g.add(sb(spot, [sx * .38, -.2, .03], [.07, .07, .02]));
  }, [.05, .85, -.05], 'y');
  return finish(r, 1.9, { ...w, hover: true, sh: .55 });
};
// Mother Hen in a blue apron
CR.hen = () => {
  const r = begin(), fm = F('#f4ead8'), rd = G('#d83a3a'), yb = G('#e8a83a');
  r.body.add(ball(fm, [0, .78, -.05], [.66, .66, .72]));
  for (let i = 0; i < 4; i++) r.body.add(ball(fm, [0, 1.05 + i * .08, -.6 - i * .05], [.08, .3 - i * .04, .2], [-.6 + i * .2, 0, 0]));
  for (const sx of [-1, 1]) r.body.add(ball(F('#e8dcc4'), [sx * .62, .8, -.08], [.12, .38, .5], [0, 0, sx * .15]));
  r.body.add(rbox(.66, .62, .05, F('#7ea6c9'), .12, [0, .58, .64], [-.3, 0, 0]));
  for (let i = 0; i < 6; i++) r.body.add(sb(F('#ffffff'), [-.2 + (i % 3) * .2, .45 + Math.floor(i / 3) * .25, .73], .035));
  for (const sx of [-1, 1]) { r.body.add(capsule(yb, [sx * .2, .2, .1], [sx * .22, 0, .15], .04)); r.body.add(sb(yb, [sx * .22, .02, .25], [.08, .03, .12])); }
  r.head.position.set(0, 1.35, .32);
  r.head.add(ball(fm, [0, 0, 0], [.36, .38, .34]));
  for (let i = 0; i < 3; i++) r.head.add(sb(rd, [0, .36 + Math.sin(i * 1.2) * .03, -.1 + i * .13], [.06, .12, .07]));
  r.head.add(cone(yb, [0, -.02, .3], [0, -.2, 1], .17, .08, 6));
  r.head.add(sb(rd, [0, -.17, .3], [.05, .09, .05]));
  beadEyes(r.head, { x: .16, y: .08, z: .28, r: .05 });
  cheeks(r.head, { y: -.04, x: .24, z: .24 });
  return finish(r, 1.95, { sh: 1 });
};
// Moonbeam the Unicorn
CR.unicorn = () => {
  const r = begin(), wm = F('#fbf6ff'), hv = F('#c9b6ff'), mane = ['#ffb3d1', '#ffd98a', '#a8e6c4', '#a9d4ff', '#d4b8ff'].map(F);
  r.body.add(capsule(wm, [0, .95, -.45], [0, .95, .35], .45));
  for (const [x, z] of [[.25, .25], [-.25, .25], [.25, -.4], [-.25, -.4]]) { r.body.add(capsule(wm, [x, .8, z], [x, .2, z], .13)); r.body.add(cyl(hv, [x, .1, z], .14, .2, 14)); }
  for (let i = 0; i < 6; i++) r.body.add(ball(mane[i % 5], [0, 1.0 - i * .07, -.9 - i * .1], .16 - i * .01));
  r.body.add(capsule(wm, [0, 1.1, .35], [0, 1.6, .55], .27));
  r.head.position.set(0, 1.85, .6);
  r.head.add(ball(wm, [0, 0, 0], [.42, .4, .42]));
  r.head.add(ball(F('#ffe9f2'), [0, -.15, .3], [.27, .2, .24]));
  for (const sx of [-1, 1]) r.head.add(sb(F('#e8a0b8'), [sx * .09, -.12, .53], [.03, .02, .02]));
  face(r.head, { x: .2, y: .07, z: .35, r: .065, my: -.24, mz: .48, mw: .05 });
  for (const sx of [-1, 1]) r.head.add(cone(wm, [sx * .22, .3, -.1], [sx * .3, 1, -.1], .25, .09, 6));
  const horn = lathe([[0, 0], [.08, 0], [.05, .3], [0, .5]], M('#ffd86b', .35), 12); horn.position.set(0, .33, .12); horn.rotation.x = .35; r.head.add(horn);
  for (let i = 0; i < 3; i++) r.head.add(torus(M('#ffe9a8', .35), [0, .38 + i * .1, .14 + i * .035], .065 - i * .015, .012, [Math.PI / 2 - .35, 0, 0]));
  for (let i = 0; i < 7; i++) r.head.add(ball(mane[i % 5], [-.04, .3 - i * .1, -.3 - i * .02], .15));
  return finish(r, 2.65, { sh: 1 });
};
// Ember the Little Dragon
CR.dragon = () => {
  const r = begin(), gm = F('#6fbf8a'), bl = F('#f6dfb0'), hn = F('#fff1d6'), wg = mat('#e08a6a', { felt: true, side: THREE.DoubleSide });
  r.body.add(egg(gm, .58, 1.3, .05));
  r.body.add(ball(bl, [0, .6, .3], [.38, .45, .25]));
  for (let i = 0; i < 4; i++) r.body.add(torus(F('#e8cc95'), [0, .35 + i * .16, .42 - Math.abs(i - 1.5) * .04], .28, .02, [Math.PI / 2 + .3, 0, 0], Math.PI, 12));
  feet(r.body, gm, .24, .3, [.17, .1, .24]);
  arms(r.body, gm, .95, .45, .28, .085);
  const tail = []; for (let i = 0; i < 6; i++) tail.push([Math.sin(i * .5) * .3, .3 + i * .05, -.45 - i * .2]);
  r.body.add(tube(tail, .12, gm, 16, 8));
  r.body.add(cone(F('#e08a6a'), tail[5], [.2, .3, -1], .3, .15, 4));
  for (let i = 0; i < 5; i++) r.body.add(cone(F('#e08a6a'), [0, 1.25 - i * .22, -.42 - i * .05], [0, .4, -1], .2, .08, 5));
  const w = wingPair(r, wg, (g, sx, m) => { g.add(ball(m, [sx * .35, .2, 0], [.4, .3, .03], [0, 0, sx * .4])); g.add(capsule(F('#c86a52'), [0, 0, 0], [sx * .6, .45, 0], .03)); }, [.3, 1.05, -.4], 'y');
  r.head.position.set(0, 1.6, .05);
  r.head.add(ball(gm, [0, 0, 0], [.5, .44, .46]));
  r.head.add(ball(gm, [0, -.12, .3], [.32, .22, .28]));
  for (const sx of [-1, 1]) r.head.add(sb(F('#3e7a55'), [sx * .1, -.08, .57], [.03, .02, .02]));
  face(r.head, { x: .21, y: .1, z: .39, r: .07, my: -.26, mz: .49, mw: .07 });
  for (const sx of [-1, 1]) r.head.add(cone(hn, [sx * .22, .32, -.1], [sx * .3, 1, -.4], .3, .08, 8));
  return finish(r, 2.15, { ...w, sh: 1 });
};
// Princess Swan
CR.swan = () => {
  const r = begin(), wm = F('#fffdf8'), or = G('#f08a3a');
  r.body.add(ball(wm, [0, .55, -.15], [.6, .48, .85]));
  for (const sx of [-1, 1]) r.body.add(ball(F('#f6f0e6'), [sx * .45, .7, -.25], [.25, .3, .65], [-.3, 0, 0]));
  r.body.add(cone(wm, [0, .75, -.85], [0, .8, -1], .35, .18, 8));
  r.body.add(tube([[0, .6, .4], [0, 1.0, .58], [0, 1.45, .45], [0, 1.8, .25], [0, 2.0, .3]], .14, wm, 20, 10));
  r.head.position.set(0, 2.05, .38);
  r.head.add(ball(wm, [0, 0, 0], [.26, .24, .28]));
  r.head.add(cone(or, [0, -.04, .2], [0, -.35, 1], .28, .085, 8));
  r.head.add(sb(G('#2a2230'), [0, .03, .24], [.07, .07, .05]));
  beadEyes(r.head, { x: .14, y: .05, z: .18, r: .045, turn: .6 });
  cheeks(r.head, { y: -.05, x: .2, z: .14 });
  const cr = K.accessory('crown'); cr.scale.setScalar(.45); cr.position.set(0, .2, -.02); r.head.add(cr);
  return finish(r, 2.4, { sh: 1 });
};
// Lady Peacock
CR.peacock = () => {
  const r = begin(), bm = F('#3f7fc0'), gm = F('#3f9a6a'), gm2 = F('#5fb88a'), gd = F('#e8c060'), bl = F('#2e4f9a');
  r.body.add(egg(bm, .45, 1.25, .1));
  r.body.add(ball(F('#5a9ad8'), [0, .7, .25], [.28, .35, .2]));
  for (let i = 0; i < 13; i++) {
    const a = (i / 12 - .5) * 2.6, x = Math.sin(a) * 1.15, y = .55 + Math.cos(a) * 1.05;
    const f = new THREE.Group(); f.position.set(x * .5, y * .5 + .3, -.45); f.rotation.z = -a;
    f.add(ball(i % 2 ? gm : gm2, [0, .55, 0], [.17, .62, .04]));
    f.add(sb(gd, [0, 1.0, .03], [.13, .15, .03])); f.add(sb(bl, [0, 1.0, .05], [.07, .08, .03]));
    r.body.add(f);
  }
  feet(r.body, G('#9a8a7a'), .17, .25, [.1, .05, .15]);
  r.head.position.set(0, 1.55, .08);
  r.head.add(ball(bm, [0, 0, 0], [.32, .32, .32]));
  r.head.add(cone(G('#d9c8a0'), [0, -.04, .26], [0, -.2, 1], .17, .06, 6));
  beadEyes(r.head, { x: .13, y: .07, z: .26, r: .05 });
  cheeks(r.head, { y: -.05, x: .2, z: .22 });
  for (let i = -1; i <= 1; i++) { r.head.add(capsule(bm, [0, .25, 0], [i * .12, .55, -.05], .015)); r.head.add(sb(gm2, [i * .12, .57, -.05], .05)); }
  return finish(r, 2.15, { sh: 1 });
};
// Captain Inkwell: an octopus pirate
CR.octopus = () => {
  const r = begin(), pm = F('#9a6ad0'), pl = F('#c6a6ec'), bk = F('#2a2230');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + .2, dx = Math.sin(a), dz = Math.cos(a);
    r.body.add(tube([[dx * .3, .45, dz * .3], [dx * .65, .2, dz * .65], [dx * .9, .12, dz * .9], [dx * 1.0, .3, dz * 1.0], [dx * .85, .4, dz * .85]], .12, pm, 16, 8));
    r.body.add(sb(pl, [dx * .68, .12, dz * .68], [.06, .03, .06]));
  }
  r.head.position.set(0, 1.0, 0);
  r.head.add(lathe([[0, -.5], [.5, -.42], [.62, 0], [.55, .45], [.3, .72], [0, .78]], pm, 28));
  beadEyes(r.head, { x: .22, y: .02, z: .52, r: .075 });
  r.head.add(sb(bk, [-.22, .02, .58], [.14, .14, .04]));
  r.head.add(torus(bk, [0, .13, 0], .6, .015, [Math.PI / 2 - .2, 0, -.15]));
  cheeks(r.head, { y: -.15, x: .38, z: .42 });
  smile(r.head, { y: -.22, z: .54, w: .08, color: '#3a2050' });
  const hat = F('#2a2230');
  r.head.add(ball(hat, [0, .72, -.02], [.62, .14, .4]));
  r.head.add(ball(hat, [0, .86, -.02], [.36, .2, .3]));
  r.head.add(sb(F('#ffffff'), [0, .88, .26], [.07, .07, .03]));
  r.head.add(torus(M('#d1a65a', .3), [0, .74, -.02], .45, .02, [Math.PI / 2, 0, 0]));
  return finish(r, 2.0, { sh: 1.15 });
};
// Thistle the Fairy (the kit's fairy)
CR.fairy = () => { const f = K.fairy({ wing: 'pink', hair: 'curls', hairColor: '#c58bd8', dress: '#b48ac9', dress2: '#f3e6ff' }); f.userData.h = 3.3; f.userData.y0 = .42; return f; };
CR.mouse = () => { const m = mouse({ fur: '#9a9a9a', apron: '#7ea6c9' }); return m; };

export const CRITTER_OF = { '🦔': 'hedgehog', '🐇': 'bunny', '🐿': 'squirrel', '🐦': 'wren', '🐸': 'frog', '🦉': 'owl', '🐞': 'ladybird', '🐌': 'snail', '🐝': 'bee', '🦊': 'fox', '🐢': 'tortoise', '🐁': 'mouse', '🦋': 'butterfly', '🐓': 'hen', '🦄': 'unicorn', '🐉': 'dragon', '🦢': 'swan', '🦚': 'peacock', '🐙': 'octopus', '🧚': 'fairy' };
export function critterKind(emoji) { return CRITTER_OF[String(emoji || '').replace(/️/g, '')] || null; }
export function critter(emoji) { const k = critterKind(emoji); const f = CR[k] || CR.mouse; const o = f(); o.userData.species = k; return o; }

/* ================================================================ baked goods and acorns (about 1 unit across) */
function pleated(rTop, rBot, h, n, amp) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, n * 4, 1, true); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.cos(a * n) * amp; p.setX(i, x * k); p.setZ(i, z * k); }
  g.computeVertexNormals(); return g;
}
const sprinkleCols = ['#ffffff', '#a9d4ff', '#ffd86b', '#b8f0c8', '#d4b8ff'];
function sprinkles(g, n, rIn, rOut, y, seed, tilt = 0) {
  const rr = rnd(seed);
  for (let i = 0; i < n; i++) { const a = rr() * TAU, rad = rIn + rr() * (rOut - rIn); const x = Math.cos(a) * rad, z = Math.sin(a) * rad; g.add(capsule(F(sprinkleCols[i % 5]), [x - .025, y + tilt * rad, z], [x + .025, y + tilt * rad, z + .02 * (rr() - .5)], .016)); }
}
const GOODS = {
  cupcake() {
    const g = new THREE.Group();
    g.add(mesh(pleated(.4, .3, .42, 14, .05), mat('#f6c8a0', { felt: true, side: THREE.DoubleSide }), [0, .21, 0]));
    g.add(cyl(F('#f6c8a0'), [0, .01, 0], .3, .02, 20));
    g.add(ball(F('#c98a50'), [0, .42, 0], [.4, .12, .4]));
    const fr = F('#f6a6bd');
    [[.45, .38, .15], [.6, .3, .13], [.73, .2, .1]].forEach(([y, R, r]) => g.add(torus(fr, [0, y, 0], R, r)));
    g.add(sb(fr, [0, .8, 0], [.12, .1, .12]));
    g.add(sb(G('#d83a4a'), [0, .9, 0], .1)); g.add(capsule(F('#5f9a62'), [0, .98, 0], [.04, 1.05, 0], .015));
    sprinkles(g, 14, .1, .36, .62, 5);
    return g;
  },
  roll() {
    const g = new THREE.Group(), m = G('#dc9a48'), m2 = G('#c78035');
    for (let i = 0; i < 7; i++) { const t = (i / 6 - .5), a = t * 2.3, R = .45, s = .28 - Math.abs(t) * .22; const p = [Math.sin(a) * R, .2, Math.cos(a) * R * .55 - .1]; const b = ball(i % 2 ? m : m2, p, [s * .9, s * .8, s * 1.2]); b.rotation.y = a; g.add(b); }
    return g;
  },
  cookie() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [.46, 0], [.52, .06], [.5, .12], [0, .14]], F('#d9a25a'), 32));
    const rr = rnd(11); for (let i = 0; i < 9; i++) { const a = rr() * TAU, rad = Math.sqrt(rr()) * .4; g.add(sb(G('#5a3420'), [Math.cos(a) * rad, .14, Math.sin(a) * rad], [.07, .045, .06])); }
    return g;
  },
  pie() {
    const g = new THREE.Group(), cr = F('#e0a85a');
    g.add(lathe([[0, 0], [.42, 0], [.56, .2], [.58, .24], [0, .24]], cr, 32));
    g.add(cyl(G('#e8a030'), [0, .24, 0], .5, .02, 32));
    for (let i = -2; i <= 2; i++) { g.add(capsule(cr, [i * .17, .27, -Math.sqrt(.25 - (i * .17) ** 2)], [i * .17, .27, Math.sqrt(.25 - (i * .17) ** 2)], .035)); g.add(capsule(cr, [-Math.sqrt(.25 - (i * .17) ** 2), .29, i * .17], [Math.sqrt(.25 - (i * .17) ** 2), .29, i * .17], .035)); }
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; g.add(sb(cr, [Math.cos(a) * .55, .25, Math.sin(a) * .55], [.07, .05, .07])); }
    return g;
  },
  bread() {
    const g = new THREE.Group(), m = G('#c98a45');
    g.add(rbox(.95, .32, .52, m, .14, [0, .16, 0]));
    g.add(ball(m, [0, .32, 0], [.5, .22, .27]));
    for (let i = -1; i <= 1; i++) g.add(capsule(F('#e8c08a'), [i * .25 - .06, .485, .09], [i * .25 + .06, .485, -.1], .035));
    return g;
  },
  ring() {
    const g = new THREE.Group();
    g.add(torus(G('#e3b06a'), [0, .18, 0], .34, .17));
    const ic = mesh(geo('icing', () => new THREE.TorusGeometry(1, .5, 10, 32)), G('#f2a7c0'), [0, .25, 0], [.35, .35, .22], [Math.PI / 2, 0, 0]); g.add(ic);
    sprinkles(g, 18, .25, .46, .36, 3);
    return g;
  },
  pretzel() {
    const pts = [[-.28, -.22, 0], [-.08, 0, .06], [.1, .18, .03], [.26, .36, 0], [.44, .3, 0], [.5, .08, 0], [.38, -.22, 0], [.15, -.38, 0], [0, -.4, 0], [-.15, -.38, 0], [-.38, -.22, 0], [-.5, .08, 0], [-.44, .3, 0], [-.26, .36, 0], [-.1, .18, -.03], [.08, 0, -.06], [.28, -.22, 0]];
    const g = new THREE.Group();
    g.add(tube(pts, .085, G('#a8662e'), 80, 10));
    const rr = rnd(9); for (let i = 0; i < 16; i++) { const p = pts[1 + Math.floor(rr() * 15)]; g.add(sb(F('#ffffff'), [p[0] + (rr() - .5) * .05, p[1] + (rr() - .5) * .05, p[2] + .08], .022)); }
    g.position.y = .45;
    return g;
  },
  berry() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [.12, .04], [.3, .22], [.36, .44], [.3, .6], [0, .64]], G('#e0303f'), 28));
    const rr = rnd(4); for (let i = 0; i < 26; i++) { const y = .08 + rr() * .48, a = rr() * TAU; const R = y < .44 ? .12 + (y - .04) / .4 * .23 : .36 - (y - .44) * .3; g.add(sb(F('#ffe08a'), [Math.cos(a) * R, y, Math.sin(a) * R], [.018, .028, .018])); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(ball(F('#5f9a62'), [Math.cos(a) * .14, .63, Math.sin(a) * .14], [.13, .03, .06], [0, -a, 0])); }
    g.add(capsule(F('#4a7a4a'), [0, .62, 0], [.03, .78, 0], .025));
    return g;
  }
};
export const GOOD_VIEW = { cupcake: { pitch: .3 }, roll: { pitch: .75 }, cookie: { pitch: .95 }, pie: { pitch: .8 }, bread: { pitch: .45 }, ring: { pitch: .85 }, pretzel: { pitch: .1 }, berry: { pitch: .25 } };
export function goodModel(id) { const g = (GOODS[id] || GOODS.cookie)(); freeze(g); return g; }

export function acornModel() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.08, .02], [.22, .1], [.32, .3], [.36, .5], [.34, .66], [0, .68]], G('#c98b4a'), 28));
  g.add(sb(mat('#f2c690', { gloss: true }), [-.14, .38, .2], [.05, .14, .04], [0, 0, .2]));
  g.add(lathe([[0, .6], [.36, .58], [.4, .7], [.33, .86], [0, .9]], F('#7a5230'), 28));
  for (let i = 0; i < 26; i++) { const a = i * 2.4, y = .64 + (i % 4) * .055, R = .38 - (i % 4) * .03; g.add(sb(F('#5e3d22'), [Math.cos(a) * R, y, Math.sin(a) * R], .045)); }
  g.add(capsule(F('#5a3a20'), [0, .86, 0], [.04, 1.02, 0], .045));
  freeze(g); return g;
}
export function jarModel() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f3f7', roughness: .08, transparent: true, opacity: .35, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  g.add(lathe([[0, 0], [.32, 0], [.42, .08], [.44, .25], [.42, .78], [.33, .86], [.3, .9], [0, .9]], glass, 32));
  g.add(lathe([[0, .88], [.33, .88], [.34, 1.02], [.3, 1.04], [0, 1.04]], P('#a8724a'), 24));
  g.add(torus(F('#d4677a'), [0, .87, 0], .32, .025));
  const a = acornModel();
  [[-.2, .02, .1], [.05, .02, .18], [.22, .02, -.02], [-.08, .02, -.15], [-.15, .26, .12], [.15, .26, .1], [0, .3, -.1], [.05, .52, .08], [-.18, .5, -.05]].forEach(([x, y, z], i) => { const c = a.clone(); c.position.set(x, y, z); c.scale.setScalar(.32); c.rotation.set((i % 3 - 1) * .4, i, (i % 2 - .5) * .5); g.add(c); });
  freeze(g); return g;
}

/* ================================================================ mouse-house treasures (floor at y=0, about 1 tall) */
function pot(g, y = 0, r = .3, h = .36, c = '#c9704a') { g.add(lathe([[0, y], [r * .72, y], [r, y + h], [r * 1.08, y + h], [r * 1.08, y + h + .08], [0, y + h + .06]], F(c), 20)); g.add(cyl(F('#5e4030'), [0, y + h + .06, 0], r * .95, .02, 18)); }
function daisy(g, p, s = 1, petal = '#ffffff') { const f = new THREE.Group(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; f.add(sb(F(petal), [Math.cos(a) * .12, 0, Math.sin(a) * .12], [.09, .025, .045], [0, -a, 0])); } f.add(sb(F('#ffd86b'), [0, .02, 0], .06)); f.position.set(...p); f.rotation.x = Math.PI / 2 - .5; f.scale.setScalar(s); g.add(f); }
const DECOR = {
  flowers() { const g = new THREE.Group(); pot(g); const st = F('#5f9a62'); [[0, .95, 0], [-.22, .8, .05], [.22, .85, -.05], [-.1, .7, .2], [.15, .68, .18]].forEach(([x, y, z], i) => { g.add(tube([[x * .3, .4, z * .3], [x * .7, (y + .4) / 2, z], [x, y, z]], .018, st, 6, 4)); daisy(g, [x, y, z], .9 + (i % 2) * .2, i % 3 ? '#ffffff' : '#ffe08a'); }); for (const sx of [-1, 1]) g.add(sb(F('#6fae66'), [sx * .15, .55, .12], [.12, .04, .06], [0, 0, sx * .6])); return g; },
  candle() { const g = new THREE.Group(); g.add(lathe([[0, 0], [.34, 0], [.38, .06], [.3, .08], [.12, .1], [0, .1]], M('#d1a65a', .25), 24)); g.add(torus(M('#d1a65a', .25), [.38, .12, 0], .1, .02, [0, 0, 0])); g.add(cyl(F('#fff3dc'), [0, .38, 0], .11, .56, 16)); g.add(sb(F('#fff8ec'), [.08, .6, .06], [.03, .06, .03])); g.add(capsule(F('#3a2a20'), [0, .66, 0], [0, .72, 0], .01)); g.add(lathe([[0, .7], [.05, .75], [.04, .84], [0, .92]], GL('#ffcf5a', 2.2), 12)); const gl = glow('#ffcf6a', .7, .9); gl.position.y = .8; g.add(gl); return g; },
  teapot() { const g = new THREE.Group(), m = G('#7ea6c9'), w = F('#ffffff'); g.add(lathe([[0, 0], [.22, 0], [.38, .12], [.42, .3], [.36, .5], [.2, .58], [0, .58]], m, 28)); g.add(lathe([[0, .56], [.22, .56], [.18, .64], [0, .66]], m, 20)); g.add(sb(m, [0, .7, 0], .06)); g.add(tube([[.35, .2, 0], [.55, .32, 0], [.62, .5, 0], [.7, .56, 0]], .05, m, 10, 8)); g.add(torus(m, [-.42, .32, 0], .14, .035, [0, 0, 0], TAU, 20)); [[0, .3, .41], [.25, .4, .3], [-.25, .25, .32], [.12, .15, .35]].forEach(p => daisy(g, p, .45)); return g; },
  yarn() { const g = new THREE.Group(), m = F('#e0607e'), m2 = F('#c94a68'); g.add(ball(m, [0, .38, 0], .38)); for (let i = 0; i < 6; i++) g.add(torus(m2, [0, .38, 0], .38, .018, [i * .5, i * .9, 0])); g.add(tube([[.3, .2, .2], [.5, .03, .4], [.75, .03, .25], [.9, .03, .45]], .02, m, 12, 4)); for (const s of [-1, 1]) { g.add(capsule(P('#d1a65a'), [-.2 * s, .9, -.1], [.25 * s, .3, .1], .025)); g.add(sb(G('#d4677a'), [-.2 * s, .92, -.1], .05)); } return g; },
  books() { const g = new THREE.Group(); [['#d4677a', .9, .2, 0], ['#7ea6c9', .8, .18, .1], ['#9bb07a', .85, .16, -.12]].forEach(([c, w, h, ry], i) => { const y = .1 + i * .19; g.add(rbox(w, h, .62, F(c), .03, [0, y, 0], [0, ry, 0])); g.add(box(w - .06, h - .06, .6, F('#fff8ec'), [.03, y, 0], [0, ry, 0])); g.add(box(.04, h * .5, .64, M('#e8c060', .2), [-w / 2 + .12, y, 0], [0, ry, 0])); }); g.add(rbox(.18, .7, .55, F('#b48ac9'), .03, [.62, .35, 0], [0, 0, -.2])); return g; },
  butterfly() { const b = CR.butterfly(); b.position.y = -.2; const g = new THREE.Group(); g.add(b); g.userData = {}; return g; },
  teddy() { const g = new THREE.Group(), m = F('#b07a48'), l = F('#e8c49a'); g.add(ball(m, [0, .38, 0], [.32, .36, .28])); g.add(ball(l, [0, .36, .2], [.18, .22, .1])); for (const sx of [-1, 1]) { g.add(ball(m, [sx * .2, .12, .18], [.13, .12, .2])); g.add(sb(l, [sx * .2, .12, .37], [.08, .08, .02])); g.add(capsule(m, [sx * .28, .55, .05], [sx * .38, .32, .16], .085)); } const h = new THREE.Group(); h.position.set(0, .88, .02); g.add(h); h.add(ball(m, [0, 0, 0], [.3, .27, .26])); h.add(ball(l, [0, -.08, .2], [.13, .1, .1])); h.add(sb(G('#2b1d14'), [0, -.03, .3], [.04, .03, .02])); for (const sx of [-1, 1]) { h.add(ball(m, [sx * .22, .2, -.02], [.1, .1, .05])); h.add(sb(l, [sx * .22, .2, .02], [.06, .06, .03])); } beadEyes(h, { x: .1, y: .06, z: .22, r: .04 }); cheeks(h, { y: -.04 / .7, x: .17 / .7, z: .2 / .7, scale: .7 }); for (const sx of [-1, 1]) g.add(sb(F('#e8b04b'), [sx * .1, .65, .22], [.09, .06, .04], [0, 0, sx * .5])); g.add(sb(F('#e8b04b'), [0, .65, .24], .035)); return g; },
  cake() { const g = new THREE.Group(), w = F('#fff3e6'), pk = F('#f6a6bd'); g.add(lathe([[0, 0], [.5, 0], [.52, .04], [0, .05]], G('#ffffff'), 32)); g.add(cyl(pk, [0, .22, 0], .42, .34, 32)); g.add(cyl(w, [0, .52, 0], .3, .26, 28)); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; g.add(sb(w, [Math.cos(a) * .42, .36 - (i % 2) * .05, Math.sin(a) * .42], [.05, .08, .05])); } for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.add(sb(pk, [Math.cos(a) * .3, .64, Math.sin(a) * .3], .045)); } for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .4, x = Math.cos(a) * .14, z = Math.sin(a) * .14; g.add(cyl(F(['#a9d4ff', '#ffd86b', '#b8f0c8'][i]), [x, .78, z], .025, .2, 8)); g.add(sb(GL('#ffcf5a', 2), [x, .92, z], [.025, .045, .025])); } g.add(sb(G('#d83a4a'), [0, .7, 0], .07)); const gl = glow('#ffd27a', .5, .6); gl.position.y = .92; g.add(gl); return g; },
  plant() { const g = new THREE.Group(); pot(g, 0, .28, .32, '#d08050'); const lm = F('#5f9a62'), lm2 = F('#6fae66'); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, out = .55 + (i % 3) * .1; const pts = [[0, .38, 0], [Math.cos(a) * out * .4, .8 + (i % 2) * .15, Math.sin(a) * out * .4], [Math.cos(a) * out, .6 + (i % 2) * .2, Math.sin(a) * out]]; g.add(tube(pts, .014, lm, 8, 3)); const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); for (let k = 1; k < 8; k++) { const p = c.getPoint(k / 8), tng = c.getTangent(k / 8), side = new THREE.Vector3().crossVectors(tng, UP).normalize(); for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * .06); const lf = sb(k % 2 ? lm : lm2, [q.x, q.y, q.z], [.06 * (1 - k / 10), .015, .03]); lf.lookAt(p.clone().addScaledVector(side, s)); g.add(lf); } } } return g; },
  painting() { const g = new THREE.Group(), fr = M('#d9a84a', .2); const ring = roundRectShape(1, .8, .06); ring.holes.push(rectPath(-.4, -.3, .4, .3)); const f = slabLo(ring, .08, fr, .02); f.position.y = .4; g.add(f); g.add(box(.82, .62, .02, F('#cfe6ef'), [0, .4, -.02])); g.add(ball(F('#8fb36a'), [-.15, .14, -.01], [.35, .18, .02])); g.add(ball(F('#6f9a4f'), [.22, .12, .0], [.3, .14, .02])); g.add(sb(GL('#ffe28a', .6), [.22, .55, 0], [.07, .07, .01])); g.add(ball(F('#ffffff'), [-.15, .58, 0], [.12, .05, .01])); return g; },
  clock() { const g = new THREE.Group(), wd = P('#8b5e3c'); const s = slabLo(archShape(.7, 1.0), .32, wd, .03); s.position.y = .52; g.add(s); g.add(cyl(F('#fff6e0'), [0, .72, .17], .24, .02, 28, [Math.PI / 2, 0, 0])); g.add(torus(M('#d9a84a', .25), [0, .72, .18], .25, .02, [0, 0, 0])); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(sb(F('#5a3e2b'), [Math.sin(a) * .19, .72 + Math.cos(a) * .19, .19], .015)); } g.add(capsule(F('#2b1d14'), [0, .72, .2], [.0, .86, .2], .012)); g.add(capsule(F('#2b1d14'), [0, .72, .2], [.1, .7, .2], .012)); g.add(box(.36, .26, .02, F('#3b2a20'), [0, .28, .17])); g.add(sb(M('#e8c060', .3), [.05, .22, .19], [.06, .06, .02])); for (const sx of [-1, 1]) g.add(sb(wd, [sx * .28, .03, 0], [.07, .04, .07])); return g; },
  mushroom() { const g = new THREE.Group(); g.add(lathe([[0, 0], [.22, 0], [.24, .1], [.18, .45], [0, .47]], F('#fff1d6'), 20)); g.add(lathe([[0, .9], [.35, .86], [.58, .66], [.66, .5], [.48, .44], [0, .48]], G('#e2566b'), 28)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? .48 : .3; g.add(sb(F('#fff7e6'), [Math.cos(a) * r, .82 - r * .35, Math.sin(a) * r], [.08, .03, .08])); } g.add(sb(F('#fff7e6'), [0, .9, 0], [.09, .02, .09])); return g; },
  chair() { const g = new THREE.Group(), wd = P('#b07a48'); g.add(rbox(.62, .07, .56, wd, .03, [0, .48, 0])); g.add(rbox(.56, .07, .5, F('#f6a6bd'), .05, [0, .54, 0])); for (const [x, z] of [[.26, .22], [-.26, .22], [.26, -.22], [-.26, -.22]]) g.add(cyl(wd, [x, .23, z], .035, .46, 10)); for (const x of [.26, -.26]) g.add(cyl(wd, [x, .82, -.24], .035, .66, 10)); g.add(rbox(.6, .14, .05, wd, .05, [0, 1.12, -.24])); g.add(rbox(.6, .07, .04, wd, .03, [0, .88, -.24])); return g; },
  jar() { const g = new THREE.Group(), tc = F('#c96a3a'), bk = F('#2b1d14'); g.add(lathe([[0, 0], [.14, 0], [.12, .05], [.3, .3], [.36, .55], [.26, .78], [.13, .88], [.14, 1.0], [0, 1.0]], tc, 28)); g.add(torus(bk, [0, .52, 0], .36, .025)); g.add(torus(bk, [0, .38, 0], .33, .025)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.add(sb(bk, [Math.cos(a) * .355, .45, Math.sin(a) * .355], [.03, .05, .03])); } for (const sx of [-1, 1]) g.add(torus(tc, [sx * .2, .8, 0], .1, .025, [0, 0, 0], Math.PI, 12)); return g; },
  violin() { const g = new THREE.Group(), wd = G('#b0602a'), dk = G('#3a2418'); g.add(ball(wd, [0, .28, 0], [.26, .22, .07])); g.add(ball(wd, [0, .6, 0], [.21, .2, .07])); g.add(ball(wd, [0, .44, 0], [.16, .1, .07])); g.add(box(.06, .5, .04, dk, [0, .9, .03])); g.add(torus(dk, [0, 1.18, .02], .05, .02, [0, Math.PI / 2, 0])); for (const sx of [-1, 1]) g.add(capsule(dk, [sx * .07, .4, .07], [sx * .07, .52, .07], .012)); for (let i = 0; i < 4; i++) g.add(capsule(F('#f0e6d0'), [-.03 + i * .02, .2, .075], [-.015 + i * .01, 1.1, .06], .004)); g.add(box(.14, .03, .03, dk, [0, .24, .08])); g.add(capsule(P('#8b5e3c'), [.4, .02, .1], [-.05, 1.2, .1], .012)); g.rotation.z = -.15; return g; },
  ship() { const g = new THREE.Group(), wd = P('#8b5e3c'); const hull = new THREE.Shape(); hull.moveTo(-.55, .35); hull.lineTo(.6, .35); hull.quadraticCurveTo(.45, 0, .2, 0); hull.lineTo(-.35, 0); hull.quadraticCurveTo(-.55, .1, -.55, .35); const h = slabLo(hull, .36, wd, .04); g.add(h); g.add(box(1.05, .05, .3, P('#c49a6c'), [0, .36, 0])); g.add(cyl(wd, [0, .85, 0], .025, 1.0, 8)); const sail = new THREE.CylinderGeometry(.6, .6, .5, 12, 1, true, -.5, 1); g.add(mesh(sail, mat('#fff8ec', { felt: true, side: THREE.DoubleSide }), [0, .8, -.5])); g.add(mesh(new THREE.CylinderGeometry(.45, .45, .3, 12, 1, true, -.5, 1), mat('#fff8ec', { felt: true, side: THREE.DoubleSide }), [0, 1.18, -.36])); g.add(box(.2, .12, .01, F('#2b1d14'), [.1, 1.38, 0])); g.add(sb(F('#ffffff'), [.08, 1.38, .01], .025)); for (let i = 0; i < 3; i++) g.add(sb(F('#3a2a20'), [-.3 + i * .25, .22, .19], [.04, .04, .01])); g.position.y = .02; return g; },
  bed() { const g = new THREE.Group(), wd = P('#a8724a'); const hb = slabLo(archShape(.9, 1.0), .08, wd, .03); hb.position.set(-.85, .5, 0); hb.rotation.y = Math.PI / 2; g.add(hb); g.add(rbox(.08, .5, .9, wd, .04, [.85, .25, 0])); g.add(rbox(1.7, .16, .86, wd, .04, [0, .22, 0])); g.add(rbox(1.62, .16, .8, F('#ffffff'), .06, [0, .36, 0])); const q = ['#d4677a', '#7ea6c9', '#e8b04b', '#9bb07a']; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(box(.3, .06, .27, F(q[(i + j) % 4]), [-.15 + i * .3, .46, -.27 + j * .27])); g.add(ball(F('#fff8ec'), [-.6, .5, 0], [.18, .1, .32])); for (const [x, z] of [[.8, .38], [.8, -.38], [-.8, .38], [-.8, -.38]]) g.add(cyl(wd, [x, .07, z], .04, .14, 8)); return g; },
  gem() { const g = new THREE.Group(); const m = new THREE.MeshPhysicalMaterial({ color: '#7fd0ff', emissive: '#3a8ad0', emissiveIntensity: .35, roughness: .05, metalness: .1, clearcoat: 1, flatShading: true }); g.add(mesh(new THREE.CylinderGeometry(.32, .5, .2, 8), m, [0, .62, 0])); g.add(mesh(new THREE.ConeGeometry(.5, .52, 8), m, [0, .26, 0], 1, [Math.PI, 0, 0])); g.add(sb(mat('#ffffff', { glow: 1.5 }), [-.12, .7, .2], .04)); return g; },
  crown() { const c = K.accessory('crown'); c.scale.setScalar(1.6); const g = new THREE.Group(); g.add(c); g.add(sb(G('#7fd0ff'), [0, .14, .5], .07)); return g; },
  fairy() { const f = K.fairy({ wing: 'gold', hair: 'braids', hairColor: '#e8b04b', dress: '#9bd3b0', dress2: '#e2fff0' }); f.position.y = .42; const g = new THREE.Group(); g.add(f); return g; },
};
export const DECOR_VIEW = { painting: { pitch: .02, yaw: .05 }, clock: { pitch: .1, yaw: .2 }, butterfly: { pitch: .1, yaw: .15 }, ship: { yaw: .55, pitch: .2 }, bed: { yaw: .55, pitch: .35 }, violin: { yaw: .1, pitch: .05 }, books: { yaw: .45, pitch: .3 } };
export function decorModel(id) { const g = (DECOR[id] || DECOR.flowers)(); if (!g.userData.kind) freeze(g); return g; }

/* ================================================================ the mouse-house room (old drawing units, x right, y up, z toward viewer) */
// The old drawing is 1000x600; here x = svgX-500, y = 300-svgY. The arch opening matches the drawing so the treasures stay where she put them.
export function roomModel() { return lo(buildRoom); }
function buildRoom() {
  const g = new THREE.Group();
  const X = x => x - 500, Y = y => 300 - y;
  const earth = F('#6e4f34'), beam = P('#8b5e3c'), plaster = F('#f2dfc0');
  // arch opening path (the drawing's M20 600 V170 Q500 -40 980 170 V600)
  const arch = new THREE.Path(); arch.moveTo(X(20), Y(600)); arch.lineTo(X(980), Y(600)); arch.lineTo(X(980), Y(170)); arch.quadraticCurveTo(X(500), Y(-40), X(20), Y(170)); arch.lineTo(X(20), Y(600));
  const outer = new THREE.Shape(); outer.moveTo(-2600, -1600); outer.lineTo(2600, -1600); outer.lineTo(2600, 1600); outer.lineTo(-2600, 1600); outer.lineTo(-2600, -1600);
  outer.holes.push(arch);
  const fr = slabLo(outer, 40, earth, 0, 24); fr.position.z = 20; g.add(fr);
  // pebbles and roots in the burrow wall around the room
  const rr = rnd(21), peb = F('#8a6a4a'), peb2 = F('#9c7a56');
  for (let i = 0; i < 90; i++) { const x = (rr() - .5) * 1500, y = (rr() - .5) * 1000; if (Math.abs(x) < 530 && y > -330 && y < 300 - Math.max(0, Math.abs(x) - 300) * .5) continue; g.add(ball(i % 3 ? peb : peb2, [x, y, 40], [10 + rr() * 16, 8 + rr() * 10, 12])); }
  const rootM = F('#5a3e28');
  for (let i = 0; i < 6; i++) { const x0 = -700 + i * 280 + rr() * 60, y1 = Math.abs(x0) < 480 ? 250 - Math.abs(x0) * .1 : 120 + rr() * 200; g.add(tube([[x0, 900, 42], [x0 + 14, 600, 46], [x0 - 12, 430, 46], [x0 + 6, y1 + 30, 44]], 5 + rr() * 3, rootM, 20, 6)); g.add(sb(rootM, [x0 + 6, y1 + 30, 44], 6)); }
  for (const [x, y, sc, c] of [[-590, -230, 1, '#e2566b'], [-560, -265, .7, '#f2a7b5'], [585, -240, .9, '#e2566b']]) { const m = DECOR.mushroom(); m.scale.setScalar(70 * sc); m.position.set(x, y - 40, 40); g.add(m); }
  // the wooden beam along the arch
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(X(20), Y(170), 0), new THREE.Vector3(X(500), Y(-40), 0), new THREE.Vector3(X(980), Y(170), 0));
  const bpts = [new THREE.Vector3(X(20), Y(600), 0), ...curve.getPoints(30), new THREE.Vector3(X(980), Y(600), 0)];
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bpts, false, 'catmullrom', .05), 80, 11, 8, false), beam, [0, 0, 26]));
  // back wall (plaster with faint lines), floor, rug
  const BZ = -110;
  g.add(box(1000, 600, 4, plaster, [0, 0, BZ - 2]));
  for (const y of [250, 340]) g.add(box(960, 3, 2, F('#e6cfa8'), [0, Y(y), BZ]));
  // floor: slopes from the back wall (y=470) toward the viewer (y=600) like a dollhouse stage
  const fl = new THREE.Group(); const fy0 = Y(470), fy1 = Y(600);
  const flAng = Math.atan2(BZ - 30, fy0 - fy1);
  const len = Math.hypot(fy0 - fy1, BZ - 30);
  const planks = ['#c49a6c', '#bb9062', '#cba274'];
  for (let i = 0; i < 6; i++) fl.add(box(1000, len / 6 - 2, 6, F(planks[i % 3]), [0, -len / 2 + (i + .5) * len / 6, -3]));
  fl.position.set(0, (fy0 + fy1) / 2, (BZ + 30) / 2); fl.rotation.x = flAng;
  g.add(fl);
  // rug on the floor (drawing: ellipse at 470,545 rx 270 ry 44)
  const rug = new THREE.Group(); rug.add(cyl(F('#d4677a'), [0, 0, 0], 1, .04, 48)); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; rug.add(sb(F('#f3c1c9'), [Math.cos(a) * .82, .03, Math.sin(a) * .82], [.06, .02, .03], [0, -a, 0])); }
  rug.scale.set(270, 120, 66); const rf = (545 - 470) / 130; rug.position.set(X(470), Y(545) + 2, BZ + rf * (30 - BZ) + 3); rug.rotation.x = flAng + Math.PI / 2; g.add(rug);
  // round window with a little garden view
  const win = new THREE.Group(); win.position.set(X(200), Y(230), BZ);
  const wr = new THREE.Shape(); wr.absarc(0, 0, 92, 0, TAU, false); wr.holes.push(circlePath(0, 0, 76));
  win.add(slabLo(wr, 24, beam, 3, 32).translateZ(12));
  win.add(cyl(F('#cfe6ef'), [0, 0, -30], 78, 2, 32, [Math.PI / 2, 0, 0]));
  win.add(ball(F('#8fb36a'), [-30, -55, -25], [90, 50, 10])); win.add(ball(F('#6f9a4f'), [50, -65, -20], [80, 45, 10]));
  win.add(sb(GL('#ffe28a', .6), [35, 35, -26], [14, 14, 3]));
  win.add(box(9, 156, 8, beam, [0, 0, 6])); win.add(box(156, 9, 8, beam, [0, 0, 6]));
  win.add(rbox(200, 16, 40, beam, 6, [0, -88, 18]));
  g.add(win);
  // shelf
  g.add(rbox(330, 14, 46, beam, 5, [X(545), Y(197), BZ + 23]));
  for (const x of [405, 685]) g.add(capsule(beam, [X(x), Y(204), BZ + 4], [X(x), Y(234), BZ + 4], 5).translateZ(0));
  // stone fireplace with a cosy fire
  const fp = new THREE.Group(); fp.position.set(X(800), Y(340), BZ);
  const fs = archShape(160, 260); fs.holes.push(archPath(100, 196, 0, -28));
  fp.add(slabLo(fs, 40, F('#a39283'), 8, 20).translateZ(20));
  fp.add(slabLo(archShape(100, 196), 10, F('#3b2a20'), 0, 16).translateY(-28).translateZ(4));
  [[-62, -110], [62, -80], [-60, -20], [64, 10], [0, 108], [-50, 70], [52, 80]].forEach(([x, y]) => fp.add(sb(F('#8d7c6d'), [x, y, 42], [12, 10, 5])));
  for (let i = 0; i < 3; i++) fp.add(capsule(P('#6b4a30'), [-30 + i * 10, -122 + i * 4, 20 - i * 5], [30 - i * 10, -126 + i * 6, 25 - i * 4], 7));
  const fire = new THREE.Group(); fire.name = 'fire'; fire.userData.live = true; fire.position.set(0, -125, 24);
  fire.add(lathe([[0, 0], [26, 8], [20, 40], [0, 75]], mat('#f07a2a', { glow: .9, glowColor: '#e85a10' }), 12));
  fire.add(lathe([[0, 0], [16, 6], [12, 28], [0, 52]], mat('#ffc24a', { glow: 1.0, glowColor: '#ff9a20' }), 12));
  const fg = glow('#ff9a40', 190, .55); fg.position.y = 30; fire.add(fg);
  fp.add(fire); g.add(fp);
  freeze(g);
  g.userData = { kind: 'room', fire: g.getObjectByName('fire') };
  return g;
}

/* ================================================================ background worlds */
function bush(g, p, s, seed, berries = '#b83a4a', flowers = '#ffffff') {
  const b = new THREE.Group(), rr = rnd(seed), lm = F('#4f8a4a'), lm2 = F('#5f9a55');
  for (let i = 0; i < 6; i++) { const a = rr() * TAU; b.add(ball(i % 2 ? lm : lm2, [Math.cos(a) * .7, .55 + rr() * .5, Math.sin(a) * .45], .55 + rr() * .3)); }
  b.add(ball(lm, [0, 1.0, 0], .75));
  for (let i = 0; i < 9; i++) { const a = rr() * TAU, y = .5 + rr() * .9; b.add(sb(G(berries), [Math.cos(a) * .95, y, Math.sin(a) * .7 + .25], .09)); }
  if (flowers) for (let i = 0; i < 6; i++) { const a = rr() * Math.PI, y = .7 + rr() * .7; b.add(sb(F(flowers), [Math.cos(a) * .9, y, Math.sin(a) * .7 + .3], [.1, .1, .04])); }
  b.position.set(...p); b.scale.setScalar(s); g.add(b); return b;
}
function miniFlower(petal) {
  const f = new THREE.Group();
  f.add(mesh(geo('mfstem', () => { const c = new THREE.CylinderGeometry(.02, .025, .62, 4, 1); c.translate(0, .31, 0); return c; }), mat('#5f9a62')));
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; f.add(mesh(SPH(6), F(petal), [Math.cos(a) * .1, .62, Math.sin(a) * .1], [.09, .03, .09])); }
  f.add(mesh(SPH(6), F('#ffd86b'), [0, .64, 0], .05));
  return freeze(f);
}
function cloud(g, p, s) { const c = new THREE.Group(), m = mat('#ffffff', { felt: true }); [[0, 0, 0, 1], [-1.1, -.2, 0, .75], [1.1, -.15, 0, .8], [.4, .45, 0, .7]].forEach(([x, y, z, r]) => c.add(ball(m, [x, y, z], [r, r * .8, r * .6]))); c.position.set(...p); c.scale.setScalar(s); g.add(c); }
function foxglove(g, p, s, c) { const f = new THREE.Group(); f.add(tube([[0, 0, 0], [.05, .8, 0], [0, 1.6, 0]], .03, F('#4f7f45'), 6, 4)); for (let i = 0; i < 9; i++) { const a = i * 2.2, y = .7 + i * .1; f.add(lathe([[0, 0], [.06, 0], [.1, .14], [0, .16]], F(c), 8).rotateX(Math.PI / 2 - .3).translateY(0).translateX(0)); f.children[f.children.length - 1].position.set(Math.cos(a) * .08, y, Math.sin(a) * .08); } f.position.set(...p); f.scale.setScalar(s); g.add(f); }

// The bakery inside (shop, setup, album): back wall at z=-5, counter top at y=1.1 with its far edge at z=-.9
export function bakeryInterior() { return lo(buildInterior); }
function buildInterior() {
  const g = new THREE.Group(), still = new THREE.Group(); g.add(still);
  const plaster = F('#f2dcb8'), wood = P('#a8724a'), dark = P('#7d5233'), beam = P('#8b5e3c');
  // back wall with a door and a window cut out
  const wall = new THREE.Shape(); wall.moveTo(-18, -1); wall.lineTo(18, -1); wall.lineTo(18, 10); wall.lineTo(-18, 10); wall.lineTo(-18, -1);
  wall.holes.push(archPath(3.2, 4.9, -9.6, 1.95));
  wall.holes.push(archPath(4.2, 3.4, 5.6, 3.9));
  still.add(slab(wall, .4, plaster, 0).translateZ(-5.2));
  for (const y of [2.3, 4.6]) { still.add(box(13.2, .04, .05, F('#e3c597'), [-1.6, y, -4.98])); still.add(box(8, .04, .05, F('#e3c597'), [12.5, y, -4.98])); }
  // wainscot
  still.add(box(6.4, 1.5, .12, wood, [-14.4, .75, -4.95])); still.add(box(10.0, 1.5, .12, wood, [-2.6, .75, -4.95])); still.add(box(10.5, 1.5, .12, wood, [12.9, .75, -4.95]));
  still.add(box(36, .12, .2, dark, [0, 1.52, -4.9]));
  // ceiling and beams
  still.add(box(40, .3, 16, F('#e6c99c'), [0, 8.1, 2]));
  for (const z of [-4.3, -1.5, 1.5]) still.add(box(40, .5, .5, beam, [0, 7.75, z]));
  // floor
  still.add(box(40, .1, 14, F('#c49a6c'), [0, -.05, 2]));
  // door frame and an open green door
  const dframe = new THREE.Shape(); dframe.copy(archShape(3.9, 5.3)); dframe.holes.push(archPath(3.2, 4.8, 0, -.15));
  still.add(slab(dframe, .5, beam, .05).translateX(-9.6).translateY(2.15).translateZ(-4.95));
  const door = slab(archShape(3.0, 4.3), .15, P('#6f9a5a'), .04); door.position.set(-11.15 + 1.45 * Math.cos(1.2), 2.17, -5 + 1.45 * Math.sin(1.2)); door.rotation.y = -1.2; still.add(door);
  still.add(sb(M('#e8c060', .3), [-11.15 + 2.6 * Math.cos(1.2), 2.3, -4.85 + 2.6 * Math.sin(1.2)], .12));
  // window frame, mullions, sill, curtains, flower pot
  const wf = archShape(4.8, 4.0); wf.holes.push(archPath(4.2, 3.4, 0, 0));
  still.add(slab(wf, .4, beam, .05).translateX(5.6).translateY(3.9).translateZ(-4.95));
  still.add(box(.18, 3.3, .14, beam, [5.6, 3.9, -5.05])); still.add(box(4.2, .18, .14, beam, [5.6, 3.6, -5.05]));
  still.add(rbox(5.2, .22, .8, beam, .08, [5.6, 2.1, -4.7]));
  for (const sx of [-1, 1]) { const cu = new THREE.Group(); for (let i = 0; i < 4; i++) cu.add(capsule(F(i % 2 ? '#e9a0a8' : '#f4c0c6'), [i * .16, 0, 0], [i * .16 + .05, -2.6, .1], .14)); cu.position.set(5.6 + sx * 2.7 - .25, 5.9, -4.6); still.add(cu); still.add(torus(F('#d4677a'), [5.6 + sx * 2.5, 4.2, -4.5], .3, .06, [Math.PI / 2, 0, 0])); }
  still.add(box(6.4, .1, .1, beam, [5.6, 6.0, -4.55]));
  { const p = new THREE.Group(); pot(p, 0, .3, .36); [[0, .9, 0], [-.2, .8, .05], [.22, .82, 0]].forEach(([x, y, z], i) => { p.add(tube([[0, .4, 0], [x, y, z]], .02, F('#5f9a62'), 4, 3)); daisy(p, [x, y, z], 1.1, i ? '#ffffff' : '#f6a6bd'); }); p.position.set(4.2, 2.2, -4.7); still.add(p); }
  // shelves with jars and bread
  const sh = [[-4.6, 3.0], [-4.6, 4.7]];
  for (const [x, y] of sh) { still.add(rbox(7.2, .16, .8, beam, .05, [x, y, -4.6])); for (const sx of [-1, 1]) still.add(box(.12, .5, .5, beam, [x + sx * 3.2, y - .3, -4.85])); }
  const jarCols = ['#d4677a', '#9bb07a', '#e8b04b', '#7ea6c9', '#b48ac9'];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#f6efe0', roughness: .2, transparent: false, clearcoat: .6 });
  for (let i = 0; i < 6; i++) { const x = -7.6 + i * 1.2, y = 3.08, h = .8 + (i % 3) * .2; still.add(lathe([[0, 0], [.32, 0], [.36, .1], [.36, h], [.28, h + .08], [0, h + .08]], glass, 20).translateX(x).translateY(y).translateZ(-4.6)); still.add(cyl(F(jarCols[i % 5]), [x, y + h + .12, -4.6], .3, .12, 18)); still.add(cyl(F(['#c98b4a', '#f2c94c', '#e0303f', '#d9a25a', '#8a5a3a'][i % 5]), [x, y + h * .35, -4.6], .3, h * .6, 18)); }
  for (let i = 0; i < 4; i++) { const b = GOODS.bread(); b.scale.setScalar(1.1); b.position.set(-7.4 + i * 1.6, 4.78, -4.6); b.rotation.y = .2 * (i % 2 ? 1 : -1); still.add(b); }
  // stone bread oven on the right
  const ov = new THREE.Group(); ov.position.set(11.6, 0, -3.6);
  ov.add(rbox(4.2, 2.2, 3.0, F('#b5674a'), .12, [0, 1.1, 0]));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) ov.add(box(.62, .02, .04, F('#e9c8b0'), [-1.7 + c * .68 + (r % 2) * .34, .5 + r * .55, 1.52]));
  ov.add(lathe([[0, 2.2], [1.9, 2.2], [1.85, 2.9], [1.4, 3.7], [.7, 4.1], [0, 4.2]], F('#cfc0aa'), 32));
  const mouth = slab(archShape(1.6, 1.3), .3, F('#2b1d14'), 0); mouth.position.set(0, 2.85, 1.8); ov.add(mouth);
  ov.add(slab((() => { const s = archShape(2.1, 1.65); s.holes.push(archPath(1.6, 1.3, 0, -.02)); return s; })(), .25, F('#a39283'), .04).translateY(2.85).translateZ(1.95));
  for (let i = 0; i < 7; i++) ov.add(sb(mat(i % 2 ? '#e8601a' : '#ff9a30', { glow: .8 }), [-.5 + i * .17, 2.32 + (i % 3) * .06, 1.98], [.12, .08, .06]));
  const og = glow('#ff9a40', 3.4, .55); og.position.set(0, 2.6, 2.3); ov.add(og);
  ov.add(cyl(F('#5a4a40'), [0, 6, 0], .35, 4, 16));
  for (let i = 0; i < 4; i++) ov.add(capsule(P('#6b4a30'), [-2.6, .25 + i * .4, -1 + (i % 2) * .4], [-2.6, .25 + i * .4, 1 - (i % 2) * .4], .2));
  ov.add(capsule(P('#c49a6c'), [-2.3, .1, 1.6], [-1.9, 3.5, 1.4], .07)); ov.add(rbox(.9, 1.0, .06, P('#c49a6c'), .3, [-1.85, 3.8, 1.4], [0, 0, -.1]));
  still.add(ov);
  // bunting
  const bcol = ['#d4677a', '#e8b04b', '#9bb07a', '#7ea6c9'];
  for (const [x0, x1] of [[-16, 0], [0, 16]]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([x0 + (x1 - x0) * t, 7.2 - Math.sin(t * Math.PI) * 1.1, -4.6]); }
    still.add(tube(pts, .03, beam, 32, 4));
    for (let i = 1; i < 8; i++) { const t = i / 8, x = x0 + (x1 - x0) * t, y = 7.2 - Math.sin(t * Math.PI) * 1.1; const tri = new THREE.Shape(); tri.moveTo(-.38, 0); tri.lineTo(.38, 0); tri.lineTo(0, -.75); tri.lineTo(-.38, 0); still.add(slab(tri, .04, F(bcol[(i + (x0 < 0 ? 0 : 2)) % 4]), .02).translateX(x).translateY(y - .02).translateZ(-4.55)); }
  }
  // pendant lamps
  const lamps = [];
  for (const x of [-1.8, 8.2]) { still.add(capsule(F('#3a2a20'), [x, 7.9, -2.5], [x, 6.4, -2.5], .02)); still.add(lathe([[0, 6.0], [.6, 6.0], [.5, 6.25], [.15, 6.5], [0, 6.5]], mat('#9bb07a', { felt: true, side: THREE.DoubleSide }), 20).translateX(x).translateZ(-2.5)); const b = sb(GL('#fff1c0', 2), [x, 5.95, -2.5], .2); still.add(b); const gl = glow('#ffd88a', 3.2, .55); gl.position.set(x, 5.9, -2.5); g.add(gl); lamps.push(gl); }
  // counter: the near worktop
  still.add(rbox(36, .3, 10, P('#b98654'), .12, [0, .95, 4.1]));
  still.add(box(36, .08, .22, P('#9c6a3c'), [0, 1.08, -.85]));
  // treats on the counter
  const stand = new THREE.Group(); stand.add(lathe([[0, 0], [.4, 0], [.1, .1], [.08, .55], [.9, .6], [.9, .66], [0, .66]], G('#ffffff'), 24)); const ck = DECOR.cake(); ck.position.y = .66; ck.scale.setScalar(1.3); stand.add(ck); stand.position.set(-4.4, 1.1, -.2); still.add(stand);
  const bsk = new THREE.Group(); bsk.add(lathe([[0, 0], [.6, 0], [.85, .45], [.8, .5], [0, .3]], F('#c99a5d'), 24)); for (let i = 0; i < 3; i++) { const r = GOODS.roll(); r.scale.setScalar(.8); r.position.set(-.3 + i * .3, .38, (i % 2) * .2 - .1); r.rotation.y = i; bsk.add(r); } bsk.position.set(4.6, 1.1, -.3); still.add(bsk);
  const tray = new THREE.Group(); tray.add(rbox(3.2, .08, 1.1, M('#d0d6e6', .15), .1, [0, .04, 0])); for (let i = 0; i < 5; i++) { const c = GOODS.cupcake(); c.scale.setScalar(.55); c.position.set(-1.2 + i * .6, .08, 0); tray.add(c); } tray.position.set(.2, 1.1, -.35); still.add(tray);
  // the garden outside the door and window
  const out = new THREE.Group();
  out.add(box(60, .1, 40, F('#8fb36a'), [0, -.06, -26]));
  [[-22, -40, 14, '#7fa35a'], [2, -46, 16, '#8bb064'], [24, -38, 12, '#76a055']].forEach(([x, z, r, c]) => out.add(ball(F(c), [x, -r * .7, z], [r * 1.6, r, r])));
  bush(out, [-12, 0, -9], 1.3, 3); bush(out, [-7.5, 0, -10], 1.1, 5); bush(out, [4, 0, -10], 1.2, 9); bush(out, [8, 0, -12], 1.4, 13);
  for (let i = 0; i < 12; i++) daisy(out, [-12 + i * 1.9, .1, -6.5 - (i % 3)], 1.4, i % 3 ? '#ffffff' : '#f6a6bd');
  const t1 = K.tree(1.6, '#6f9a4f'); t1.position.set(-5, 0, -18); out.add(t1); const t2 = K.tree(1.3, '#7fa35a'); t2.position.set(11, 0, -20); out.add(t2);
  still.add(out);
  freeze(still);
  g.userData = { lamps };
  return g;
}

// Bramblewick Hollow outside: the bakery in an old tree stump among hedgerows
export function bakeryExterior() { return lo(buildExterior); }
function buildExterior() {
  const g = new THREE.Group(), still = new THREE.Group(); g.add(still);
  const bark = F('#8a6242'), bark2 = F('#76533a');
  // stump with flared roots
  still.add(lathe([[0, 0], [4.2, 0], [3.5, .5], [3.2, 1.4], [3.1, 5.5], [3.2, 6.4], [0, 6.5]], bark, 40));
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.0) continue; still.add(capsule(i % 2 ? bark2 : bark, [Math.sin(a) * 3.15, .6, Math.cos(a) * 3.15], [Math.sin(a) * 3.12, 6.1, Math.cos(a) * 3.12], .14)); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + .3; still.add(tube([[Math.sin(a) * 3, 1.2, Math.cos(a) * 3], [Math.sin(a) * 4, .4, Math.cos(a) * 4], [Math.sin(a) * 4.9, .05, Math.cos(a) * 4.9]], .35, bark, 10, 8)); }
  // mossy roof with a chimney
  still.add(lathe([[0, 6.2], [3.7, 6.2], [3.9, 6.5], [3.4, 7.4], [2.2, 8.2], [0, 8.5]], F('#7fa35a'), 40));
  const rr = rnd(5); for (let i = 0; i < 26; i++) { const a = rr() * TAU, rad = 2 + rr() * 1.6; still.add(sb(F(i % 3 ? '#8fb36a' : '#6f9a4f'), [Math.sin(a) * rad, 8.2 - rad * .5, Math.cos(a) * rad], .3 + rr() * .2)); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; still.add(sb(F(i % 2 ? '#ffffff' : '#ffd86b'), [Math.sin(a) * 3.6, 6.7, Math.cos(a) * 3.6], .16)); }
  still.add(cyl(F('#b5674a'), [1.6, 8.6, -.6], .42, 2.0, 16)); still.add(cyl(F('#8a4a35'), [1.6, 9.6, -.6], .52, .25, 16));
  // round green door with a stone frame, step and knob
  const front = new THREE.Group(); front.position.set(0, 0, 3.1);
  const dr = new THREE.Shape(); dr.absarc(0, 0, 1.3, 0, TAU, false);
  front.add(slab(dr, .2, P('#6f9a5a'), .06).translateY(1.35).translateZ(.12));
  for (let i = 0; i < 5; i++) front.add(box(.06, 2.3, .05, P('#5f8a4c'), [-1 + i * .5, 1.35, .25]));
  for (let i = 0; i < 18; i++) { const a = i / 17 * Math.PI * 1.15 - .08; front.add(sb(F(i % 2 ? '#c9bba8' : '#b3a593'), [Math.cos(a) * 1.5, 1.35 + Math.sin(a) * 1.5, .2], [.28, .24, .2])); }
  front.add(sb(M('#e8c060', .35), [.75, 1.3, .38], .13));
  front.add(rbox(3.0, .25, 1.0, F('#b3a593'), .1, [0, .12, .6]));
  // lantern by the door
  front.add(capsule(M('#3a3a3a'), [1.75, 2.95, .2], [1.75, 2.95, .8], .04));
  front.add(rbox(.4, .55, .4, GL('#ffd27a', 1.4), .06, [1.75, 2.55, .8]));
  const lg = glow('#ffcf6a', 2.4, .7); lg.position.set(1.75, 2.55, 3.95); g.add(lg);
  still.add(front);
  // round windows with flower boxes
  const wins = [];
  for (const [a, y, s] of [[-.62, 3.7, 1], [.62, 3.7, 1], [.1, 5.3, .7]]) {
    const w = new THREE.Group(); w.position.set(Math.sin(a) * 3.2, y, Math.cos(a) * 3.2); w.rotation.y = a; w.scale.setScalar(s);
    const glassM = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc060', emissiveIntensity: .5, roughness: .5 });
    w.add(cyl(glassM, [0, 0, .02], .75, .1, 28, [Math.PI / 2, 0, 0]));
    w.add(torus(P('#8b5e3c'), [0, 0, .1], .8, .1, [0, 0, 0]));
    w.add(box(.08, 1.5, .08, P('#8b5e3c'), [0, 0, .12])); w.add(box(1.5, .08, .08, P('#8b5e3c'), [0, 0, .12]));
    if (s === 1) { w.add(rbox(1.7, .4, .5, P('#a8724a'), .06, [0, -.95, .3])); for (let i = 0; i < 5; i++) daisy(w, [-.6 + i * .3, -.6, .35], .9, ['#f6a6bd', '#ffffff', '#ffd86b', '#b48ac9', '#ffffff'][i]); }
    still.add(w); wins.push(glassM);
  }
  // hanging sign with an acorn
  still.add(capsule(P('#6b4a30'), [2.4, 5.0, 2.1], [3.9, 5.0, 2.6], .07));
  for (const d of [-.45, .45]) still.add(capsule(F('#c9b08a'), [3.4 + d * .8, 5.0, 2.45], [3.4 + d, 4.5, 2.45], .015));
  still.add(rbox(1.3, .8, .12, P('#c49a6c'), .12, [3.4, 4.1, 2.45]));
  const ac = acornModel(); ac.scale.setScalar(.55); ac.position.set(3.4, 3.85, 2.55); still.add(ac);
  // ground, path, hedgerows, flowers, trees
  const gr = new THREE.PlaneGeometry(140, 140, 50, 50); gr.rotateX(-Math.PI / 2);
  const p = gr.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z); let y = Math.sin(x * .3) * .08 + Math.cos(z * .25) * .08; if (d > 18) y += (d - 18) ** 2 * .0025; p.setY(i, y); }
  gr.computeVertexNormals();
  const ground = new THREE.Mesh(gr, F('#8fb36a')); ground.receiveShadow = true; g.add(ground);
  for (let i = 0; i < 9; i++) { const z = 4.6 + i * 1.2, x = Math.sin(i * .7) * .5; still.add(sb(F(i % 2 ? '#d9cbb3' : '#cbbda5'), [x, .02, z], [.55, .08, .4], [0, i, 0])); }
  [[-7, -1, 1.6, 2], [-10.5, -3, 1.8, 4], [-5.5, -4.5, 1.3, 6], [7, -1, 1.6, 8], [10.5, -3.5, 1.9, 10], [5.8, -5, 1.2, 12], [-15, -6, 2.2, 14], [15, -6.5, 2.1, 16]].forEach(([x, z, s, seed]) => bush(still, [x, 0, z], s, seed, seed % 4 ? '#b83a4a' : '#5a3a6a', seed % 3 ? '#ffffff' : '#f6c4d8'));
  for (let i = 0; i < 7; i++) foxglove(still, [-8.5 + (i % 2) * .6 + (i > 3 ? 16 : 0), 0, 1.5 - i * .3], 1 + (i % 3) * .2, i % 2 ? '#d48ac9' : '#f2a7c8');
  [[-4.5, 2.2, .8, '#e2566b'], [-5.3, 1.4, .55, '#f2a7b5'], [4.8, 2.6, .7, '#e2566b'], [5.6, 1.8, .45, '#c9876a']].forEach(([x, z, s, c]) => { const m = K.mushroom(c, s); m.position.set(x, 0, z); still.add(m); });
  [[-14, -14, 1.6], [-19, -9, 1.3], [13, -15, 1.8], [19, -10, 1.4], [-4, -20, 1.5], [6, -22, 1.7]].forEach(([x, z, s], i) => { const t = K.tree(s, i % 2 ? '#5f8a4c' : '#6f9a4f'); t.position.set(x, 0, z); t.rotation.y = i; still.add(t); });
  [[-30, -55, 14, '#8bb064'], [0, -62, 18, '#7fa35a'], [32, -52, 13, '#93b86c']].forEach(([x, z, r, c]) => still.add(ball(F(c), [x, -r * .55, z], [r * 1.9, r, r])));
  cloud(still, [-16, 17, -40], 2.4); cloud(still, [12, 20, -45], 2.0); cloud(still, [28, 15, -42], 1.6);
  freeze(still);
  const cols = ['#ffffff', '#ffd86b', '#f6a6bd', '#b9a6e8'];
  cols.forEach((c, j) => { const items = []; const r = rnd(30 + j); for (let i = 0; i < 18; i++) { const a = r() * TAU, d = 4.6 + r() * 11; const x = Math.cos(a) * d, z = Math.sin(a) * d * .8 + 2; if (Math.abs(x) < 1.4 && z > 3) continue; items.push({ p: [x, 0, z], s: .9 + r() * .7, ry: r() * 6 }); } g.add(K.scatter(miniFlower(c), items)); });
  g.add(K.grassField(2600, [-18, 18, -6, 14], '#7fa35a'));
  // chimney smoke puffs (animated by the world)
  const smoke = new THREE.Group(); for (let i = 0; i < 4; i++) smoke.add(ball(mat('#f4f1ec', { felt: true }), [0, 0, 0], .3)); smoke.position.set(1.6, 9.8, -.6); g.add(smoke);
  g.userData = { windows: wins, lantern: lg, smoke };
  return g;
}
