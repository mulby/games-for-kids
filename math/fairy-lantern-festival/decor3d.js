// Fairy Lantern Festival: 3D models for the cottage furniture, the teapot cottage, the lantern basket,
// the moon door, the great moon and the four glade icons. Built from the shared toy kit so they share its felt-toy look.
//
// Conventions
//  - decorModel(d): the item sits in a unit box x in [-.5,.5], y in [0,1], matching its 2D drawing's 100x100 viewBox
//    (SVG x=50 -> x=0, SVG y=100 -> y=0, 100 SVG units = 1). Floor items rest on y=0 and are centred on z=0;
//    wall and ceiling items are shallow and face +z. Bake with decorView(d).
//  - teapotModel(): x in [-.725,.725], y in [0,1] (the 1450x1000 teapot drawing), belly front at z ~ +.3.
//  - miniLanternModel(): width 1, height 1.58 (the 48x76 symbol), base at y=0.
//  - every model is frozen (static meshes merged per material); glows are additive sprites.
import { THREE, mat, ball, capsule, lathe as klathe, tube, slab, roundRectShape, starGeo, heartShape, glow, eyes, smile, mesh, SPH, freeze, lighten } from '../../shared/toy3d.js';

/* ---------------- small helpers ---------------- */
// lathe profiles must run bottom-centre -> out -> up -> top-centre (counter-clockwise in r,y) or the surface comes out inside-out
function lathe(pts, m, seg) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return klathe(a < 0 ? pts.slice().reverse() : pts, m, seg);
}
const F = c => mat(c, { felt: true });
const G = c => mat(c, { gloss: true });
const P = c => mat(c, { rough: .55 });            // painted / polished wood
const M = (c, s = .12) => mat(c, { metal: true, shine: s });
const GL = (c, k = 1) => mat(c, { glow: k });
const DS = (c, o = {}) => mat(c, { ...o, side: THREE.DoubleSide });
const WOOD = '#94692f', BIRCH = '#c9a67a', DARK = '#6b4a24', GOLD = '#d1a65a', INK = '#3a2f5c', CREAM = '#fff1d6';
const UP = new THREE.Vector3(0, 1, 0);
const sb = (m, p, s, r) => mesh(SPH(12), m, p, s, r);             // cheap little ball
const X = sx => (sx - 50) / 100, Y = sy => (100 - sy) / 100;      // 100x100 drawing -> unit box

// like the kit's slab() but with fewer curve and bevel segments (these parts are small on screen)
function slabLo(shape, depth, m, bevel = .02, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return mesh(g, m);
}
function rbox(w, h, d, m, r = .03, p = [0, 0, 0], rot = [0, 0, 0]) {
  const b = Math.min(.016, d / 4, w / 4, h / 4);
  const s = slabLo(roundRectShape(w - 2 * b, h - 2 * b, Math.max(.002, r - b)), Math.max(.002, d - 2 * b), m, b, r > .06 ? 8 : 5);
  s.position.set(...p); s.rotation.set(...rot); return s;
}
// light versions of the kit's mushroom() and flower() for the glade dioramas
function shroom(cap, s) {
  const m = new THREE.Group();
  m.add(lathe([[0, 0], [.18, 0], [.2, .3], [.15, .7], [0, .72]], F('#fff1d6'), 10));
  m.add(lathe([[0, 1.05], [.35, 1.0], [.6, .82], [.7, .66], [.5, .62], [0, .66]], G(cap), 16));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3, rr = i % 2 ? .45 : .28; m.add(sb(F('#fff7e6'), [Math.cos(a) * rr, .93 - rr * .3, Math.sin(a) * rr], [.08, .03, .08])); }
  m.add(sb(F('#fff7e6'), [0, 1.05, 0], [.09, .02, .09]));
  m.scale.setScalar(s); return m;
}
function bloom(petal, s) {
  const f = new THREE.Group();
  f.add(tube([[0, 0, 0], [.05, .3, 0], [0, .6, .02]], .025, mat('#5f9a62'), 5, 4));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; f.add(sb(F(petal), [Math.cos(a) * .1, .62, Math.sin(a) * .1], [.09, .03, .09])); }
  f.add(sb(F('#ffd86b'), [0, .64, 0], .05));
  f.scale.setScalar(s); return f;
}
function stud(g, m, p, n, s, seg = 12) {
  const x = mesh(SPH(seg), m, p, s);
  x.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...n).normalize()); g.add(x); return x;
}
function archShape(w, h) { // flat bottom, round top, centred
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, -h / 2); s.lineTo(r, -h / 2); s.lineTo(r, h / 2 - r); s.absarc(0, h / 2 - r, r, 0, Math.PI, false); s.lineTo(-r, -h / 2);
  return s;
}
function ringShape(outer, inner) { outer.holes.push(inner); return outer; }
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s; }
function crescentShape(R, cx, cy, r, n = 40) { // circle radius R at origin with a bite (circle cx,cy,r) taken out
  const s = new THREE.Shape(), d = Math.hypot(cx, cy), a0 = Math.atan2(cy, cx);
  const a1 = Math.acos(Math.min(1, (R * R + d * d - r * r) / (2 * R * d)));
  for (let i = 0; i <= n; i++) { const a = a0 + a1 + (Math.PI * 2 - 2 * a1) * i / n; const x = R * Math.cos(a), y = R * Math.sin(a); i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const p1 = [R * Math.cos(a0 + a1), R * Math.sin(a0 + a1)], p2 = [R * Math.cos(a0 - a1), R * Math.sin(a0 - a1)];
  const b2 = Math.atan2(p2[1] - cy, p2[0] - cx), b1 = Math.atan2(p1[1] - cy, p1[0] - cx);
  let dl = b2 - b1; while (dl < 0) dl += Math.PI * 2; while (dl > Math.PI * 2) dl -= Math.PI * 2;
  for (let i = 1; i < n; i++) { const b = b2 - dl * i / n; s.lineTo(cx + r * Math.cos(b), cy + r * Math.sin(b)); }
  return s;
}
function taperTube(points, r0, r1, m, seg = 16, radial = 10) {
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
function torus(R, t, m, p, rot = [Math.PI / 2, 0, 0], s = 1, arc = Math.PI * 2, tub = 32) {
  return mesh(new THREE.TorusGeometry(R, t, 6, tub, arc), m, p, s, rot);
}
function rod(m, a, b, r, seg = 5) { // thin low-poly stick between two points
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg, 1, true), m);
  x.position.copy(A).add(B).multiplyScalar(.5); x.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize()); return x;
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- gingham (pink, like the game's pGing pattern) ---------------- */
let gingCanvas;
const gingMats = new Map();
export function gingMat(rx = 10, ry = rx) {
  const key = rx + ',' + ry;
  if (gingMats.has(key)) return gingMats.get(key);
  if (!gingCanvas) {
    gingCanvas = document.createElement('canvas'); gingCanvas.width = gingCanvas.height = 32;
    const x = gingCanvas.getContext('2d');
    x.fillStyle = '#fff4ea'; x.fillRect(0, 0, 32, 32);
    x.globalAlpha = .6; x.fillStyle = '#f2b3c2'; x.fillRect(0, 0, 16, 32); x.fillRect(0, 0, 32, 16);
  }
  const t = new THREE.CanvasTexture(gingCanvas);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.magFilter = THREE.NearestFilter; t.anisotropy = 4;
  const m = new THREE.MeshPhysicalMaterial({ map: t, roughness: .95, sheen: 1, sheenRoughness: .6, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
  gingMats.set(key, m);
  return m;
}

/* ================================================================ decor ================================================================ */
const B = {};

B.bed = (a) => {
  const g = new THREE.Group(), w = P(WOOD);
  const hb = slab(roundRectShape(.46, .6, .16), .06, w, .02); hb.rotation.y = Math.PI / 2; hb.position.set(-.38, .3, 0); g.add(hb);
  const ft = slab(roundRectShape(.46, .42, .12), .06, w, .02); ft.rotation.y = Math.PI / 2; ft.position.set(.38, .21, 0); g.add(ft);
  for (const z of [-.22, .22]) { g.add(sb(w, [-.38, .6, z], .045)); g.add(sb(w, [.38, .42, z], .04)); }
  const heart = slab(heartShape(), .3, F(a), .1); heart.scale.setScalar(.075); heart.rotation.y = Math.PI / 2; heart.position.set(-.34, .47, 0); g.add(heart);
  g.add(rbox(.72, .06, .42, w, .02, [0, .13, 0]));
  g.add(rbox(.7, .17, .42, F(a), .06, [0, .245, 0]));
  g.add(rbox(.5, .13, .46, gingMat(10), .05, [.09, .29, 0]));
  g.add(ball(F('#ffffff'), [-.22, .37, 0], [.1, .06, .16]));
  return g;
};

function walnutGeo() {
  const gm = new THREE.SphereGeometry(1, 30, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const p = gm.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(z, x);
    const k = 1 + .045 * Math.sin(th * 11 + y * 5) * Math.min(1, -y * 3);
    p.setXYZ(i, x * k, y, z * k);
  }
  gm.computeVertexNormals(); return gm;
}
let _walnut;
B.cradle = (a) => {
  const g = new THREE.Group();
  _walnut = _walnut || walnutGeo();
  g.add(mesh(_walnut, DS('#a0703a', { rough: .7 }), [0, .42, 0], [.37, .23, .24]));
  g.add(torus(1, .045, P('#7c5a2c'), [0, .42, 0], [Math.PI / 2, 0, 0], [.37, .24, .37], Math.PI * 2, 40));
  g.add(ball(F(a), [.07, .41, 0], [.29, .07, .2]));
  g.add(ball(F(lighten(a, .06)), [.07, .45, 0], [.2, .035, .14]));
  g.add(ball(gingMat(8, 4), [-.22, .44, 0], [.09, .05, .14]));
  const r = P(DARK);
  for (const z of [-.13, .13]) {
    g.add(tube([[-.34, .1, z], [0, .02, z], [.34, .1, z]], .022, r, 16, 6));
    for (const sx of [-1, 1]) g.add(capsule(r, [sx * .19, .05, z], [sx * .15, .25, z * .8], .018));
  }
  return g;
};

B.stool = (a) => {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.08, 0], [.085, .02], [.07, .12], [.06, .3], [.065, .42], [0, .42]], F('#f6e6c8'), 18));
  const cap = [], N = 10;
  for (let i = 0; i <= N; i++) { const t = i / N * Math.PI / 2; cap.push([.31 * Math.sin(t), .4 + .2 * Math.cos(t)]); }
  cap.push([.28, .38], [.15, .4], [0, .41]);
  g.add(lathe(cap, G(a), 28));
  const wh = F('#ffffff');
  [[0, .13, .1], [1.1, .21, .07], [2.3, .2, .08], [3.5, .14, .06], [4.6, .22, .075], [5.6, .17, .065], [0, 0, .065], [.7, .27, .05], [2.9, .27, .05]].forEach(([th, rr, s]) => {
    const t = Math.asin(Math.min(1, rr / .31)), y = .4 + .2 * Math.cos(t);
    const n = [Math.sin(th) * Math.sin(t) / .31, Math.cos(t) / .2, Math.cos(th) * Math.sin(t) / .31];
    stud(g, wh, [Math.sin(th) * rr, y + .004, Math.cos(th) * rr], n, [s * .5, .012, s * .5]);
  });
  return g;
};

B.chair = (a) => {
  const g = new THREE.Group(), wd = P(BIRCH), dk = P(WOOD);
  for (const z of [-.2, .2]) {
    g.add(capsule(wd, [-.22, .07, z], [-.27, .8, z], .032));
    g.add(capsule(wd, [.22, .07, z], [.22, .5, z], .03));
    g.add(capsule(wd, [-.25, .52, z], [.24, .5, z], .024));
    g.add(sb(wd, [.24, .5, z], .035));
    g.add(tube([[-.4, .1, z], [-.15, .015, z], [.15, .015, z], [.4, .1, z]], .026, dk, 20, 6));
    g.add(sb(dk, [-.4, .1, z], .03)); g.add(sb(dk, [.4, .1, z], .03));
  }
  g.add(capsule(wd, [-.27, .78, -.22], [-.27, .78, .22], .03));
  g.add(capsule(wd, [-.26, .64, -.2], [-.26, .64, .2], .022));
  for (const z of [-.09, 0, .09]) g.add(capsule(wd, [-.255, .64, z], [-.27, .78, z], .014));
  g.add(rbox(.54, .05, .44, wd, .02, [0, .3, 0]));
  g.add(rbox(.52, .08, .42, F(a), .05, [.01, .36, 0]));
  g.add(rbox(.07, .26, .36, F(a), .035, [-.22, .5, 0], [0, 0, .08]));
  return g;
};

B.sofa = (a, b) => {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(X(10), Y(54)); s.quadraticCurveTo(X(10), Y(30), X(30), Y(30)); s.quadraticCurveTo(X(50), Y(16), X(70), Y(30));
  s.quadraticCurveTo(X(90), Y(30), X(90), Y(54)); s.lineTo(X(90), Y(80)); s.lineTo(X(10), Y(80)); s.lineTo(X(10), Y(54));
  const back = slab(s, .1, F(a), .035); back.position.z = -.15; g.add(back);
  g.add(rbox(.8, .17, .42, F(a), .06, [0, .195, 0]));
  g.add(rbox(.6, .1, .34, F(b), .05, [0, .32, .03]));
  for (const sx of [-1, 1]) {
    g.add(rbox(.12, .2, .42, F(a), .05, [sx * .35, .33, 0]));
    g.add(capsule(F(a), [sx * .35, .43, -.17], [sx * .35, .43, .19], .065));
  }
  const bt = F(b);
  [[-.2, .52], [0, .6], [.2, .52], [-.1, .44], [.1, .44]].forEach(([x, y]) => g.add(sb(bt, [x, y, -.075], [.022, .022, .012])));
  const w = P(WOOD);
  for (const sx of [-1, 1]) for (const z of [-.15, .15]) { g.add(capsule(w, [sx * .32, .02, z], [sx * .33, .11, z], .025)); }
  return g;
};

let _pillow;
function pillowGeo() { // puffy square cushion: a sphere pushed out toward a rounded square
  const gm = new THREE.SphereGeometry(1, 32, 18), p = gm.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setX(i, Math.sign(x) * Math.pow(Math.abs(x), .5)); p.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), .5)); }
  gm.computeVertexNormals(); return gm;
}
B.cushion = (a) => {
  const g = new THREE.Group(), W = .33, D = .29, H = .14, cy = .15;
  _pillow = _pillow || pillowGeo();
  g.add(mesh(_pillow, F(a), [0, cy, 0], [W, H, D]));
  const pts = [];
  for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t); pts.push([Math.sign(c) * Math.pow(Math.abs(c), .5) * W * .985, cy, Math.sign(sn) * Math.pow(Math.abs(sn), .5) * D * .985]); }
  const pc = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), true);
  g.add(mesh(new THREE.TubeGeometry(pc, 64, .018, 6, true), gingMat(40, 1)));
  const top = cy + H;
  g.add(sb(F('#ffffff'), [0, top + .005, 0], [.055, .022, .055]));
  for (const [x, z] of [[-.016, -.016], [.016, -.016], [-.016, .016], [.016, .016]]) g.add(sb(F(lighten(a, -.15)), [x, top + .024, z], .007));
  const dk = F(lighten(a, -.08));
  for (let i = 0; i < 4; i++) { const t = i / 4 * Math.PI * 2 + Math.PI / 4; g.add(tube([[Math.cos(t) * .05, top, Math.sin(t) * .05], [Math.cos(t) * .13, top - .03, Math.sin(t) * .12], [Math.cos(t) * .22, top - .08, Math.sin(t) * .2]], .006, dk, 6, 4)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * W * .97, z = sz * D * .97; g.add(sb(dk, [x, cy + .01, z], .022)); g.add(capsule(dk, [x + sx * .01, cy - .005, z + sz * .01], [x + sx * .012, cy - .05, z + sz * .012], .012)); }
  return g;
};

B.table = (a) => {
  const g = new THREE.Group(), w = P(WOOD);
  const isG = a === 'ging';
  const cloth = isG ? gingMat(18, 2) : DS(a, { felt: true });
  g.add(mesh(new THREE.CylinderGeometry(.36, .36, .04, 32), P(BIRCH), [0, .46, 0]));
  g.add(lathe([[0, .49], [.36, .49], [.385, .48], [.4, .45], [.415, .38], [.435, .31], [.445, .285]], cloth, 32));
  const hem = isG ? F('#f2a7b5') : F('#ffffff');
  for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; g.add(sb(hem, [Math.cos(t) * .445, .285, Math.sin(t) * .445], [.035, .022, .035])); }
  for (const [x, z] of [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]]) { g.add(capsule(w, [x, .03, z], [x * .9, .45, z * .9], .028)); g.add(sb(w, [x, .02, z], .035)); }
  g.add(ball(G('#ffffff'), [0, .555, 0], [.065, .06, .065]));
  g.add(lathe([[0, .6], [.03, .6], [.035, .62], [0, .62]], G('#ffffff'), 14));
  const lf = F('#7cc06e');
  g.add(capsule(mat('#5f9a62'), [0, .6, 0], [0, .68, 0], .008));
  g.add(sb(lf, [-.035, .67, 0], [.04, .016, .02], [0, 0, .5]));
  g.add(sb(lf, [.035, .69, 0], [.04, .016, .02], [0, 0, -.5]));
  return g;
};

B.bath = (a) => {
  const g = new THREE.Group(), wh = G('#ffffff');
  const pr = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI / 2; pr.push([.385 * Math.sin(t) + (i === 0 ? 0 : 0), .5 - .4 * Math.cos(t)]); }
  pr[0] = [0, .1];
  pr.push([.385, .5], [.37, .505], [.36, .44]);
  g.add(lathe(pr, DS('#ffffff', { gloss: true }), 36));
  g.add(mesh(new THREE.CircleGeometry(.362, 32), G('#cfe8ff'), [0, .45, 0], 1, [-Math.PI / 2, 0, 0]));
  g.add(torus(.38, .018, G(a), [0, .5, 0]));
  g.add(torus(.33, .014, G(a), [0, .245, 0], [Math.PI / 2, 0, 0], 1));
  g.add(lathe([[0, 0], [.15, 0], [.165, .02], [.13, .06], [.11, .11], [0, .11]], G(a), 24));
  g.add(torus(.085, .024, G(a), [.43, .33, 0], [0, 0, -Math.PI * .62], 1, Math.PI * 1.25, 16));
  for (let i = 0; i < 5; i++) { const t = -1.1 + i * .55, y = .37; const r = .5 - .4 * Math.cos(Math.asin(Math.min(1, (y - .1) / .4))) ; void r; stud(g, G(a), [Math.sin(t) * .368, y, Math.cos(t) * .368], [Math.sin(t), .3, Math.cos(t)], [.03, .01, .03]); }
  const bub = G('#e6f3ff');
  [[-.16, .5, .05, .075], [-.02, .53, 0, .085], [.12, .5, .07, .07], [.04, .49, .2, .05], [-.12, .48, -.15, .06], [.16, .48, -.12, .055], [-.24, .47, .12, .045], [.02, .6, .06, .035]].forEach(([x, y, z, r]) => g.add(sb(bub, [x, y, z], r)));
  const duck = F('#ffd86b');
  g.add(sb(duck, [.2, .5, .12], [.06, .045, .05])); g.add(sb(duck, [.235, .56, .12], .035));
  g.add(sb(F('#f29a4a'), [.27, .555, .12], [.022, .01, .015])); g.add(sb(mat(INK), [.25, .57, .145], .007));
  return g;
};

B.shelf = (a) => {
  const g = new THREE.Group(), wd = P('#a7774a'), dk = F('#6e4f27'), D = .26;
  g.add(rbox(.66, .84, .02, dk, .02, [0, .44, -D / 2 + .02]));
  for (const sx of [-1, 1]) g.add(rbox(.06, .84, D, wd, .02, [sx * .31, .44, 0]));
  for (const y of [.035, .31, .57, .835]) g.add(rbox(.7, .055, D + .02, wd, .02, [0, y, 0]));
  const book = (x, y, w, h, c, z = 0) => g.add(rbox(w / 100 - .005, h / 100, .17, F(c), .012, [X(x + w / 2), Y(y + h / 2), z]));
  book(25, 23, 7, 17, a); book(33, 25, 6, 15, '#9fdc8f'); book(40, 22, 8, 18, '#b9a6e8');
  book(55, 49, 7, 17, '#ffd86b'); book(63, 51, 6, 15, a);
  book(28, 75, 9, 17, '#a9c8ff'); book(60, 76, 7, 16, '#f2a7b5');
  g.add(rbox(.07, .15, .17, F('#ffe1ea'), .012, [X(48), .165, 0], [0, 0, .35]));
  g.add(ball(G('#e2566b'), [X(34), .41, .02], .06));
  g.add(capsule(mat(DARK), [X(34), .46, .02], [X(35), .49, .02], .008));
  g.add(sb(F('#7cc06e'), [X(37), .48, .02], [.022, .01, .012], [0, 0, -.4]));
  g.add(ball(G('#fff6c8'), [.18, .66, .02], [.05, .045, .05]));
  return g;
};

function capRadius(y) { // acorn-cap lamp shade profile
  const t = (y - .575) / (.79 - .575); return Math.max(0, .255 * Math.sqrt(Math.max(0, 1 - t * t * t)));
}
B.lamp = (a) => {
  const g = new THREE.Group(), w = P(WOOD);
  g.add(lathe([[0, 0], [.18, 0], [.19, .018], [.16, .05], [.06, .065], [0, .07]], w, 28));
  g.add(capsule(w, [0, .06, 0], [0, .6, 0], .025));
  g.add(sb(GL('#fff3b0', 1.6), [0, .53, 0], .065));
  const halo = glow('#ffd86b', .75, .9); halo.position.set(0, .52, .02); g.add(halo);
  const pr = [];
  for (let i = 0; i <= 12; i++) { const y = .79 - (.79 - .575) * i / 12; pr.push([capRadius(y), y]); }
  pr[0] = [0, .79];
  pr.push([.22, .57], [.18, .6], [0, .62]);
  g.add(lathe(pr, DS(a, { felt: true }), 32));
  const bump = F(lighten(a, -.07));
  [[.6, 16], [.645, 15], [.69, 13], [.73, 10], [.765, 6]].forEach(([y, n], row) => {
    const r = capRadius(y);
    for (let i = 0; i < n; i++) { const t = (i + row * .5) / n * Math.PI * 2; stud(g, bump, [Math.cos(t) * r, y, Math.sin(t) * r], [Math.cos(t), .7, Math.sin(t)], [.026, .012, .026], 8); }
  });
  g.add(capsule(P(DARK), [0, .78, 0], [.025, .84, 0], .016));
  return g;
};

B.rug = (a, b) => {
  const g = new THREE.Group();
  const RZ = .62; g.position.z = -.04;
  const r = lathe([[0, .022], [.43, .022], [.455, .016], [.465, .006], [.455, 0], [0, 0]], F(a), 48); r.scale.z = RZ; g.add(r);
  const st = F(b);
  for (let i = 0; i < 26; i++) {
    const t0 = i / 26 * Math.PI * 2, t1 = t0 + Math.PI * 2 / 26 * .55;
    const tm = (t0 + t1) / 2; g.add(sb(st, [Math.cos(tm) * .36, .024, Math.sin(tm) * .36 * RZ], [.045, .008, .011], [0, -Math.atan2(Math.cos(tm) * RZ, -Math.sin(tm)), 0]));
  }
  for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; g.add(sb(st, [Math.cos(t) * .16, .022, Math.sin(t) * .16 * RZ], [.045, .008, .03 * RZ], [0, -t, 0])); }
  g.add(sb(st, [0, .022, 0], [.05, .01, .05]));
  return g;
};

B.teapot = (a, b) => {
  const g = new THREE.Group(), body = G(a), lid = G(b);
  const pr = [[0, .06]];
  for (let i = 0; i <= 14; i++) { const t = -Math.PI / 2 + i / 14 * Math.PI; const y = Math.max(.07, .3 + .24 * Math.sin(t)); pr.push([.26 * Math.cos(t) * (y === .07 ? .8 : 1), y]); }
  pr[pr.length - 1] = [0, .54];
  g.add(lathe(pr, body, 32));
  g.add(lathe([[0, .04], [.14, .04], [.15, .06], [.13, .08], [0, .08]], body, 24));
  g.add(lathe([[0, .585], [.06, .58], [.11, .56], [.13, .535], [.12, .525], [0, .525]], lid, 28));
  g.add(sb(lid, [0, .615, 0], .04));
  g.add(taperTube([[.22, .27, 0], [.32, .33, 0], [.37, .45, 0], [.42, .57, 0]], .055, .028, body, 14, 10));
  g.add(torus(.028, .012, body, [.42, .575, 0], [Math.PI / 2 - .4, 0, 0], 1, Math.PI * 2, 14));
  g.add(tube([[-.22, .44, 0], [-.35, .42, 0], [-.37, .28, 0], [-.23, .18, 0]], .025, body, 16, 8));
  const dot = F(b === '#fff' || b === '#ffffff' ? '#ffffff' : lighten(a, .2));
  [[0, .3, .028], [-.7, .38, .02], [.7, .38, .02], [-.5, .18, .02], [.5, .18, .02], [-1.1, .27, .022], [1.1, .27, .022], [0, .14, .018], [0, .45, .018], [-.35, .46, .015], [.35, .46, .015]].forEach(([th, y, s]) => {
    const v = (y - .3) / .24, r = .26 * Math.sqrt(Math.max(0, 1 - v * v));
    stud(g, dot, [Math.sin(th) * r, y, Math.cos(th) * r], [Math.sin(th) * Math.sqrt(1 - v * v) / .26, v / .24, Math.cos(th) * Math.sqrt(1 - v * v) / .26], [s, .008, s]);
  });
  return g;
};

B.plant = (a) => {
  const g = new THREE.Group(), pot = F('#c4744a');
  g.add(lathe([[0, 0], [.12, 0], [.13, .015], [.155, .22], [.17, .225], [.175, .27], [.165, .285], [.14, .28], [0, .27]], pot, 28));
  g.add(torus(.165, .02, F(lighten('#c4744a', .06)), [0, .262, 0]));
  g.add(mesh(new THREE.CircleGeometry(.15, 20), F('#6b4a33'), [0, .272, 0], 1, [-Math.PI / 2, 0, 0]));
  const lm = F(a), lm2 = F(lighten(a, .07)), stem = mat(lighten(a, -.08));
  const fronds = [[-.22, .66, .02], [.2, .68, -.02], [-.02, .76, -.06], [-.14, .56, .17], [.15, .58, .16], [.27, .5, -.06], [-.27, .48, -.08]];
  fronds.forEach(([tx, ty, tz], k) => {
    const p0 = new THREE.Vector3(0, .27, 0), p2 = new THREE.Vector3(tx, ty, tz), p1 = new THREE.Vector3(tx * .45, ty + .02, tz * .45);
    const c = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    g.add(mesh(new THREE.TubeGeometry(c, 8, .008, 4), stem));
    const N = 7;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + .6), p = c.getPoint(t), tan = c.getTangent(t), side = new THREE.Vector3().crossVectors(tan, UP).normalize();
      if (side.lengthSq() < .1) side.set(1, 0, 0);
      const s = .045 * (1 - t * .55);
      for (const sd of [-1, 1]) {
        const leaf = mesh(SPH(8), (i + k) % 2 ? lm : lm2, p.clone().addScaledVector(side, sd * s * .9).add(new THREE.Vector3(0, .004, 0)), [s, .012, s * .45]);
        leaf.lookAt(leaf.position.clone().addScaledVector(side, sd)); leaf.rotateY(Math.PI / 2); leaf.rotateZ(sd * .3);
        g.add(leaf);
      }
    }
    g.add(sb((k % 2) ? lm : lm2, p2, [.025, .012, .025]));
  });
  const pk = F('#f2a7b5');
  for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2; g.add(sb(pk, [X(40) + Math.cos(t) * .025, .64 + Math.sin(t) * .025, .1], [.02, .02, .01])); }
  g.add(sb(F('#ffd86b'), [X(40), .64, .11], .012));
  return g;
};

B.dresser = (a, b) => {
  const g = new THREE.Group(), body = P(a), dr = P(b), kn = G('#ffd86b');
  g.add(rbox(.66, .58, .3, body, .05, [0, .37, 0]));
  g.add(rbox(.72, .035, .34, body, .02, [0, .675, 0]));
  [[.535, .14], [.355, .14], [.185, .12]].forEach(([y, h]) => {
    g.add(rbox(.56, h, .03, dr, .025, [0, y, .155]));
    g.add(sb(kn, [0, y, .18], [.022, .022, .018]));
  });
  const w = P(WOOD);
  for (const sx of [-1, 1]) for (const z of [-.1, .1]) g.add(sb(w, [sx * .28, .04, z], [.04, .045, .04]));
  const heart = slab(heartShape(), .3, F('#f2a7b5'), .1); heart.scale.setScalar(.035); heart.position.set(0, .64, .155); g.add(heart);
  return g;
};

B.stove = (a) => {
  const g = new THREE.Group(), iron = M(a, .05);
  g.add(lathe([[0, .07], [.2, .07], [.24, .1], [.27, .22], [.27, .38], [.24, .52], [.2, .57], [.22, .58], [.22, .6], [0, .61]], iron, 32));
  g.add(torus(.27, .02, M(lighten(a, .08), .08), [0, .3, 0]));
  for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2 + Math.PI / 6; g.add(capsule(iron, [Math.cos(t) * .17, .0, Math.sin(t) * .17], [Math.cos(t) * .15, .08, Math.sin(t) * .15], .025)); }
  g.add(mesh(new THREE.CylinderGeometry(.045, .045, .3, 16), iron, [X(45), .73, -.02]));
  g.add(torus(.05, .015, iron, [X(45), .875, -.02]));
  g.add(torus(.05, .012, iron, [X(45), .7, -.02]));
  g.add(rbox(.32, .23, .06, F('#2b2350'), .08, [0, .3, .245]));
  const tr = M('#d1a65a', .2);
  const fs = ringShape(roundRectShape(.36, .27, .1), roundRectShape(.3, .21, .08));
  const fr = slab(fs, .02, tr, .01); fr.position.set(0, .3, .28); g.add(fr);
  g.add(sb(GL('#ffb54a', 1.6), [0, .24, .275], [.07, .07, .02]));
  g.add(sb(GL('#ffd86b', 1.8), [0, .24, .285], [.04, .045, .02]));
  g.add(sb(GL('#ffb54a', 1.4), [-.06, .22, .275], [.04, .045, .02]));
  g.add(sb(GL('#ffb54a', 1.4), [.065, .22, .275], [.035, .04, .02]));
  g.add(rbox(.24, .025, .03, F('#6b4a33'), .01, [0, .2, .28]));
  const h = glow('#ffb54a', .6, .85); h.position.set(0, .26, .32); g.add(h);
  g.add(sb(tr, [.17, .3, .29], .018));
  return g;
};

B.basket = (a) => {
  const g = new THREE.Group();
  g.add(lathe([[0, .02], [.22, .02], [.25, .04], [.27, .2], [.3, .36], [.285, .36], [.255, .2], [0, .2]], DS('#c4935a', { felt: true }), 28));
  const b1 = F('#b07f48'), b2 = F('#d9a86c');
  [.09, .15, .21, .27, .33].forEach((y, i) => g.add(torus(.25 + (y - .04) * .16, .016, i % 2 ? b1 : b2, [0, y, 0], [Math.PI / 2, 0, 0], 1, Math.PI * 2, 36)));
  g.add(torus(.3, .024, F('#7c5a2c'), [0, .36, 0]));
  const hd = new THREE.Mesh(new THREE.TorusGeometry(.26, .018, 6, 28, Math.PI), F('#7c5a2c')); hd.position.set(0, .34, 0); hd.rotation.y = -.25; g.add(hd);
  const be = G(a), hi = G(lighten(a, .12));
  [[-.13, .4, .05, .07], [.02, .42, .02, .08], [.14, .4, .06, .06], [-.05, .4, .15, .06], [.08, .39, .16, .055], [-.17, .39, -.08, .055], [.02, .42, -.13, .065], [.16, .39, -.09, .055], [-.02, .47, .05, .055]].forEach(([x, y, z, r], i) => g.add(mesh(SPH(16), i % 3 ? be : hi, [x, y, z], r)));
  const lf = F('#7cc06e');
  g.add(sb(lf, [.05, .48, .1], [.04, .012, .02], [0, .6, .3]));
  g.add(sb(lf, [-.1, .46, .1], [.035, .012, .018], [0, -.5, -.3]));
  return g;
};

B.pot = (a, b) => {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [.14, 0], [.15, .02], [.18, .22], [.205, .23], [.205, .29], [.185, .3], [0, .29]], F(a), 28));
  g.add(mesh(new THREE.CircleGeometry(.18, 20), F('#6b4a33'), [0, .29, 0], 1, [-Math.PI / 2, 0, 0]));
  const st = mat('#5f8f5a'), pet = F(b), ctr = F('#ffd86b');
  [[0, .66, 0, .07], [-.15, .58, .03, .06], [.15, .56, .02, .06], [.05, .5, .12, .045]].forEach(([x, y, z, r]) => {
    g.add(tube([[x * .2, .29, z * .2], [x * .7, (y + .29) / 2, z * .6], [x, y - .01, z]], .01, st, 8, 4));
    const fl = new THREE.Group(); fl.position.set(x, y, z); fl.rotation.x = .9; fl.rotation.z = -x * 1.5;
    for (let i = 0; i < 7; i++) { const t = i / 7 * Math.PI * 2; fl.add(sb(pet, [Math.cos(t) * r * .62, 0, Math.sin(t) * r * .62], [r * .45, r * .14, r * .26], [0, -t, 0])); }
    fl.add(sb(ctr, [0, .01, 0], [r * .32, r * .2, r * .32]));
    g.add(fl);
  });
  const cl = F('#7cc06e');
  for (const [x, z, ry] of [[-.09, .07, .3], [.1, .06, -.4], [0, -.08, 0]]) for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2 + ry; g.add(sb(cl, [x + Math.cos(t) * .025, .33, z + Math.sin(t) * .025], [.025, .01, .025])); }
  return g;
};

B.dollhouse = (a, b) => {
  const g = new THREE.Group();
  g.add(rbox(.48, .45, .32, F(b), .025, [0, .285, 0]));
  const roof = new THREE.Shape(); roof.moveTo(-.32, .48); roof.lineTo(.32, .48); roof.quadraticCurveTo(.06, .74, 0, .8); roof.quadraticCurveTo(-.06, .74, -.32, .48);
  const rs = slab(roof, .36, G(a), .03); g.add(rs);
  const wh = F('#ffffff');
  [[-.15, .55, .05], [.12, .6, .04], [0, .7, .03], [.2, .52, .03], [-.04, .56, .025]].forEach(([x, y, s]) => g.add(sb(wh, [x, y, .21], [s, s * .8, .01])));
  const door = slab(archShape(.12, .22), .02, P(WOOD), .008); door.position.set(0, .17, .165); g.add(door);
  g.add(sb(G('#ffd86b'), [.035, .16, .185], .012));
  for (const sx of [-1, 1]) {
    g.add(rbox(.11, .11, .02, GL('#cfe3ff', .25), .02, [sx * .14, .39, .16]));
    g.add(rbox(.13, .025, .03, P(BIRCH), .01, [sx * .14, .325, .17]));
    g.add(rbox(.012, .1, .025, P(BIRCH), .004, [sx * .14, .39, .172]));
  }
  g.add(rbox(.5, .04, .34, P(BIRCH), .015, [0, .045, 0]));
  g.add(rbox(.06, .1, .06, F(lighten(a, -.05)), .01, [.17, .7, -.05]));
  return g;
};

/* ---- wall and ceiling items (face +z, shallow) ---- */
function quadPts(p0, c, p2, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]]); } return out; }

B.bunting = (a, b, d) => {
  const g = new THREE.Group();
  const pts = quadPts([2, 18], [50, 40], [98, 18], 12).map(([x, y]) => [X(x), Y(y), 0]);
  g.add(tube(pts, .007, P(WOOD), 24, 5));
  const bm = /ging/i.test(d.name || '') ? gingMat(14) : F(b);
  [[[8, 21], [16, 43], [24, 25]], [[28, 27], [35, 49], [44, 29]], [[48, 29], [54, 51], [62, 29]], [[66, 27], [72, 49], [81, 25]], [[84, 21], [88, 43], [96, 17]]].forEach((tri, i) => {
    const sh = polyShape(tri.map(([x, y]) => [X(x), Y(y)]));
    const f = slab(sh, .012, i % 2 ? bm : F(a), .008); f.position.z = .005; g.add(f);
    const cx = (tri[0][0] + tri[2][0]) / 2, cy = (tri[0][1] + tri[2][1]) / 2;
    g.add(sb(F('#ffffff'), [X(cx * .75 + tri[1][0] * .25), Y(cy * .6 + tri[1][1] * .4), .02], [.014, .014, .006]));
  });
  return g;
};

B.clock = (a) => {
  const g = new THREE.Group();
  const btn = lathe([[0, .03], [.27, .03], [.31, .06], [.35, .055], [.38, .02], [.37, -.03], [0, -.03]], G(a), 40);
  btn.rotation.x = Math.PI / 2; btn.position.y = .5; g.add(btn);
  g.add(torus(.375, .012, P(WOOD), [0, .5, 0], [0, 0, 0], 1, Math.PI * 2, 48));
  for (const [x, y] of [[-.1, .1], [.1, .1], [-.1, -.1], [.1, -.1]]) g.add(sb(P(WOOD), [x, .5 + y, .03], [.04, .04, .012]));
  for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; g.add(sb(F(lighten(a, -.15)), [Math.sin(t) * .24, .5 + Math.cos(t) * .24, .035], i % 3 ? .011 : .018)); }
  const ink = mat(INK);
  g.add(capsule(ink, [0, .5, .055], [0, .73, .055], .016));
  g.add(capsule(ink, [0, .5, .06], [.16, .5, .06], .018));
  g.add(sb(G('#ffd86b'), [0, .5, .07], .028));
  return g;
};

B.window = (a) => {
  const g = new THREE.Group(), wd = P(BIRCH);
  const fr = slab(ringShape(roundRectShape(.62, .66, .31), roundRectShape(.52, .56, .26)), .05, wd, .015); fr.position.set(0, .54, .01); g.add(fr);
  g.add(mesh(new THREE.ShapeGeometry(roundRectShape(.54, .58, .27), 24), mat('#2a2f66', { glow: .25, glowColor: '#2a2f66' }), [0, .54, -.015]));
  g.add(rbox(.03, .58, .03, wd, .01, [0, .54, .01]));
  g.add(rbox(.54, .03, .03, wd, .01, [0, .5, .01]));
  g.add(sb(GL('#ffe9a8', 1.1), [.14, .68, -.005], [.06, .06, .015]));
  const mh = glow('#ffe9a8', .3, .6); mh.position.set(.14, .68, 0); g.add(mh);
  for (const [x, y] of [[-.15, .74], [-.08, .64], [.12, .36], [-.14, .38], [.18, .5], [-.05, .78]]) g.add(sb(GL('#fff6c8', 1.2), [x, y, -.008], .009));
  g.add(capsule(P(WOOD), [-.45, .93, .05], [.45, .93, .05], .016));
  g.add(sb(P(WOOD), [-.45, .93, .05], .025)); g.add(sb(P(WOOD), [.45, .93, .05], .025));
  const cm = F(a), cm2 = F(lighten(a, -.05));
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * .045;
      const pts = [[0.31 + off, .92], [.29 + off * .9, .7], [.32 + off * .35, .5], [.31 + off * .9, .28], [.3 + off * 1.15, .09]].map(([x, y]) => [sx * x, y, .07 + (i % 2) * .012]);
      g.add(tube(pts, .036, i % 2 ? cm : cm2, 16, 7));
    }
    g.add(torus(.06, .014, F('#fff1d6'), [sx * .32, .5, .085], [0, 0, 0], [1, .45, 1], Math.PI * 2, 18));
    g.add(sb(F('#ffffff'), [sx * .26, .5, .1], [.028, .018, .015]));
  }
  return g;
};

B.frame = (a, b, d) => {
  const g = new THREE.Group(), gold = G(GOLD);
  const fr = slab(ringShape(roundRectShape(.62, .68, .08), roundRectShape(.48, .54, .04)), .04, gold, .018); fr.position.set(0, .49, 0); g.add(fr);
  g.add(rbox(.5, .56, .01, F(b), .04, [0, .49, -.015]));
  for (const [x, y] of [[-.3, .82], [.3, .82], [-.3, .16], [.3, .16]]) g.add(sb(G('#f0cf86'), [x, y, .03], .025));
  if (/sunflower/i.test(d.name || '')) {
    g.add(tube([[0, .2, 0], [.01, .35, 0], [0, .48, 0]], .012, mat('#5f8f5a'), 8, 5));
    g.add(sb(F('#7cc06e'), [.06, .32, .005], [.05, .02, .015], [0, 0, .5]));
    for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; g.add(sb(F(a), [Math.cos(t) * .1, .56 + Math.sin(t) * .1, 0], [.06, .025, .012], [0, 0, t])); }
    g.add(sb(F('#94692f'), [0, .56, .01], [.07, .07, .025]));
    g.add(sb(F(a), [-.13, .24, 0], [.06, .04, .012])); g.add(sb(F(a), [.14, .24, 0], [.06, .04, .012]));
  } else {
    const fur = F(a), inner = F('#f7c1cd'), ink = mat(INK);
    const mouse = (x, y, s) => {
      g.add(sb(fur, [x, y - .16 * s, 0], [.15 * s, .11 * s, .03]));
      g.add(sb(fur, [x, y, .005], [.1 * s, .09 * s, .035]));
      for (const sx of [-1, 1]) { g.add(sb(fur, [x + sx * .08 * s, y + .08 * s, 0], [.05 * s, .05 * s, .015])); g.add(sb(inner, [x + sx * .08 * s, y + .08 * s, .012], [.032 * s, .032 * s, .008])); }
      for (const sx of [-1, 1]) g.add(sb(ink, [x + sx * .035 * s, y + .01 * s, .038], .012 * s));
      g.add(sb(inner, [x, y - .03 * s, .04], .014 * s));
    };
    mouse(-.07, .52, 1); mouse(.13, .38, .62);
    g.add(sb(F('#7cc06e'), [-.14, .24, 0], [.05, .02, .01])); g.add(sb(F('#f2a7b5'), [.16, .64, 0], .02));
  }
  return g;
};

B.mirror = (a) => {
  const g = new THREE.Group();
  const o = new THREE.Shape(); o.absellipse(0, 0, .28, .37, 0, Math.PI * 2, false);
  const h = new THREE.Path(); h.absellipse(0, 0, .215, .305, 0, Math.PI * 2, true); o.holes.push(h);
  const fr = slab(o, .04, G(GOLD), .018); fr.position.set(0, .49, 0); g.add(fr);
  const gl = new THREE.Shape(); gl.absellipse(0, 0, .225, .315, 0, Math.PI * 2, false);
  g.add(mesh(new THREE.ShapeGeometry(gl, 32), mat('#dceaff', { metal: true, shine: .35 }), [0, .49, -.005]));
  g.add(tube([[-.13, .56, .01], [-.11, .66, .01], [-.04, .72, .01]], .012, F('#ffffff'), 10, 5));
  g.add(sb(F('#ffffff'), [.1, .32, .01], .014));
  const sh = F(a), sh2 = F(lighten(a, .06));
  for (let i = 0; i < 7; i++) { const t = Math.PI * (.12 + .76 * i / 6); g.add(sb(i % 2 ? sh : sh2, [Math.cos(t) * .045, .84 + Math.sin(t) * .045, .03], [.026, .055, .02], [0, 0, t - Math.PI / 2])); }
  g.add(sb(sh, [0, .83, .035], [.03, .02, .02]));
  const pearl = G('#fffaf2');
  for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + (i - 4.5) * .32; g.add(sb(pearl, [Math.cos(t) * .248, .49 + Math.sin(t) * .338, .035], .016)); }
  return g;
};

B.wreath = (a, b) => {
  const g = new THREE.Group();
  g.add(torus(.32, .05, F('#4f7f4f'), [0, .5, 0], [0, 0, 0], 1, Math.PI * 2, 40));
  const l1 = F('#5f8f5a'), l2 = F('#7cb06a'), r = rng(7);
  for (let i = 0; i < 26; i++) {
    const t = i / 26 * Math.PI * 2, rr = .32 + (r() - .5) * .07;
    const lf = mesh(SPH(10), i % 2 ? l1 : l2, [Math.cos(t) * rr, .5 + Math.sin(t) * rr, .02 + r() * .02], [.06, .028, .012]);
    lf.rotation.z = t + Math.PI / 2 + (r() - .5) * 1.2; lf.rotation.y = (r() - .5) * .5; g.add(lf);
  }
  const be = G(a);
  [[50, 18], [78, 56], [24, 62], [62, 80], [28, 32], [74, 30]].forEach(([x, y], k) => {
    const cx = X(x), cy = Y(y);
    for (let j = 0; j < 3; j++) { const t = j / 3 * Math.PI * 2 + k; g.add(sb(be, [cx + Math.cos(t) * .026, cy + Math.sin(t) * .026, .06], .028)); }
  });
  const bw = F(b);
  for (const sx of [-1, 1]) {
    g.add(sb(bw, [sx * .06, .16, .07], [.065, .04, .02], [0, 0, sx * .35]));
    g.add(capsule(bw, [sx * .015, .15, .065], [sx * .05, .06, .06], .016));
  }
  g.add(sb(F(lighten(b, -.06)), [0, .16, .08], .025));
  return g;
};

B.nightlight = (a) => {
  const g = new THREE.Group();
  const h = glow(a, 1.0, .55); h.position.set(0, .5, -.05); g.add(h);
  const st = mesh(starGeo(), mat(a, { glow: .65 }), [0, .5, 0], [.33, .33, .22]); g.add(st);
  const face = new THREE.Group(); face.position.set(0, .475, .07); face.scale.setScalar(.16); g.add(face);
  eyes(face, { y: .15, x: .38, z: .2, closed: true, ink: '#8a5a3c' });
  smile(face, { y: -.2, z: .2, w: .16, color: '#8a5a3c' });
  return g;
};

B.shelfwall = (a, b) => {
  const g = new THREE.Group(), wd = P('#a7774a');
  g.add(rbox(.8, .07, .2, wd, .02, [0, .32, 0]));
  for (const sx of [-1, 1]) g.add(capsule(P('#7c5a2c'), [sx * .32, .29, -.04], [sx * .24, .16, -.06], .018));
  g.add(lathe([[0, .355], [.07, .355], [.075, .37], [.075, .55], [.06, .565], [0, .565]], G(a), 20)); g.children.at(-1).position.x = -.25;
  const lidm = gingMat(16); const lid = lathe([[0, .6], [.06, .595], [.085, .565], [.08, .555], [0, .555]], lidm, 20); lid.position.x = -.25; g.add(lid);
  const cup = lathe([[0, .355], [.05, .355], [.07, .37], [.095, .43], [.1, .5], [.09, .5], [.085, .44], [0, .4]], DS('#ffffff', { gloss: true }), 24); g.add(cup);
  g.add(torus(.04, .012, G('#ffffff'), [.105, .44, 0], [0, 0, 0], 1, Math.PI * 2, 14));
  g.add(torus(.096, .008, G('#f2a7b5'), [0, .495, 0]));
  g.add(mesh(new THREE.CircleGeometry(.088, 18), F('#c4935a'), [0, .48, 0], 1, [-Math.PI / 2, 0, 0]));
  g.add(rbox(.12, .16, .12, P(b), .03, [.24, .435, 0]));
  g.add(rbox(.135, .035, .135, P(lighten(b, -.06)), .02, [.24, .52, 0]));
  return g;
};

B.chandelier = (a) => {
  const g = new THREE.Group();
  g.add(capsule(P(WOOD), [0, 1.0, 0], [0, .72, 0], .012));
  g.add(sb(P(WOOD), [0, .71, 0], [.04, .025, .04]));
  const c = new THREE.Vector3(0, .56, 0), stalk = mat('#d9c39a'), tip = mat(a, { glow: .55 }), N = 30;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + .5) / N * 2, rr = Math.sqrt(1 - y * y), t = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(t) * rr, y, Math.sin(t) * rr);
    if (dir.z < -.6) continue;
    const e = c.clone().addScaledVector(dir, .27);
    g.add(rod(stalk, c.toArray(), e.toArray(), .006, 4));
    g.add(sb(tip, e.toArray(), .04));
  }
  g.add(sb(GL('#fff6c8', 1.8), c.toArray(), .07));
  const h = glow('#ffe9a0', .85, .8); h.position.copy(c); h.position.z = .05; g.add(h);
  return g;
};

B.mobile = (a, b) => {
  const g = new THREE.Group(), wd = P(WOOD), str = mat('#e9dcc8');
  g.add(capsule(wd, [0, 1, 0], [0, .8, 0], .008));
  g.add(capsule(wd, [-.31, .8, 0], [.31, .8, 0], .014));
  g.add(sb(wd, [-.31, .8, 0], .02)); g.add(sb(wd, [.31, .8, 0], .02)); g.add(sb(wd, [0, .8, 0], .022));
  g.add(capsule(str, [-.3, .8, 0], [-.3, .58, 0], .004));
  g.add(capsule(str, [0, .8, 0], [0, .5, 0], .004));
  g.add(capsule(str, [.3, .8, 0], [.3, .65, 0], .004));
  g.add(mesh(starGeo(), mat(a, { glow: .4 }), [-.3, .45, 0], [.14, .14, .1]));
  const cr = slab(crescentShape(.12, .07, .045, .1), .03, mat('#ffe9a8', { glow: .35 }), .015); cr.position.set(.0, .38, 0); cr.rotation.z = -.35; g.add(cr);
  g.add(ball(F(b), [.3, .58, 0], .07));
  g.add(sb(F('#ffffff'), [.27, .61, .06], .012));
  const h = glow(a, .45, .4); h.position.set(-.3, .45, .05); g.add(h);
  return g;
};

B.lights = (a) => {
  const g = new THREE.Group();
  const pts = quadPts([2, 14], [50, 40], [98, 14], 12).map(([x, y]) => [X(x), Y(y), 0]);
  g.add(tube(pts, .006, mat('#5f8f5a'), 24, 5));
  const bulb = mat(a, { glow: 1.5 }), cap = mat('#5f8f5a');
  [[12, 20], [30, 26], [50, 28], [70, 26], [88, 20]].forEach(([x, y]) => {
    const cx = X(x), cy = Y(y) + .015;
    g.add(capsule(cap, [cx, cy + .03, .01], [cx, cy - .005, .01], .018));
    g.add(lathe([[0, 0], [.04, .02], [.056, .055], [.042, .095], [0, .1]], bulb, 14)); g.children.at(-1).position.set(cx, cy - .1, .01);
    const h = glow(a, .34, .9); h.position.set(cx, cy - .05, .05); g.add(h);
  });
  return g;
};

const WALL = { bunting: 1, clock: 1, window: 1, frame: 1, mirror: 1, wreath: 1, nightlight: 1, shelfwall: 1, lights: 1, chandelier: 1, mobile: 1 };
export const DECOR_SHAPES = Object.keys(B);

export function decorModel(d) {
  const make = B[d.shape];
  const root = new THREE.Group();
  if (make) root.add(make(d.c1, d.c2 || CREAM, d));
  freeze(root);
  return root;
}
// Baker's fixed framing puts the camera at height/2/tan(12deg) + width/2, so frame f shows f*(1+tan(12deg)*aspect) units at z=0.
// These values make the z=0 plane line up with the SVG box: wall items exactly; floor items so the nearest floor corner
// lands just above the bottom edge (a 3/4 view shows some floor, so the centre of the footprint sits a little higher).
export const WALL_VIEW = { frame: [0, .5, .83], yaw: 0, pitch: .05 };
export const FLOOR_VIEW = { frame: [0, .42, .88], yaw: .35, pitch: .2 };
export function decorView(d) { return { ...(WALL[d.shape] ? WALL_VIEW : FLOOR_VIEW) }; }

/* ================================================================ teapot cottage ================================================================ */
// unit box x in [-.725,.725], y in [0,1]; the body is a pillowy dome so the front is fairly flat behind the room window
const TP = { cx: 0, cy: .44, rx: .52, ry: .43, rz: .3, k: .5 };
function pillowZ(x, y) { const u = x / TP.rx, v = (y - TP.cy) / TP.ry; const w = Math.max(0, 1 - u * u - v * v); return TP.rz * Math.pow(Math.sqrt(w), TP.k); }
// exact front view for a 1.45:1 image (e.g. w 1160, h 800): the body silhouette lines up with the 1450x1000 drawing
export function teapotView(w = 1160, h = 800) { return { w, h, frame: [0, .5, 1 / (1 + Math.tan(Math.PI / 15) * w / h)], yaw: 0, pitch: 0 }; }
export function teapotModel() {
  const root = new THREE.Group();
  const pink = G('#f8ccd7'), rose = G('#eab7c4'), deep = G('#d99aac'), white = F('#ffffff');
  const bg = new THREE.SphereGeometry(1, 56, 36), p = bg.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), TP.k)); }
  bg.computeVertexNormals();
  root.add(mesh(bg, pink, [0, TP.cy, 0], [TP.rx, TP.ry, TP.rz]));
  const foot = lathe([[0, 0], [.27, 0], [.29, .015], [.27, .05], [.2, .07], [0, .07]], rose, 40); foot.scale.z = .62; root.add(foot);
  const lid = lathe([[0, .905], [.1, .9], [.2, .885], [.27, .86], [.305, .83], [.31, .81], [.29, .795], [0, .795]], rose, 40); lid.scale.z = .66; root.add(lid);
  root.add(lathe([[0, .88], [.04, .88], [.03, .905], [0, .91]], rose, 16));
  root.add(ball(pink, [0, .93, 0], .042));
  for (let i = 0; i < 22; i++) { const t = i / 22 * Math.PI * 2; root.add(sb(white, [Math.cos(t) * .305, .82, Math.sin(t) * .305 * .66], [.022, .018, .022])); }
  root.add(taperTube([[.42, .5, 0], [.55, .58, 0], [.62, .68, 0], [.665, .8, 0]], .085, .042, rose, 18, 14));
  root.add(torus(.044, .014, rose, [.665, .8, 0], [Math.PI / 2 - .3, 0, -.35], 1, Math.PI * 2, 18));
  const hp = quadPts([250, 380], [50, 370], [50, 600], 6).concat(quadPts([50, 600], [50, 760], [260, 770], 6).slice(1)).map(([x, y]) => [(x - 725) / 1000, (1000 - y) / 1000, 0]);
  hp[0][0] += .05; hp[hp.length - 1][0] += .05;
  root.add(tube(hp, .032, rose, 32, 10));
  // white polka dots on the bands of the body the room window does not cover, plus shine marks
  const dot = (x, y, r) => { const z = pillowZ(x, y); stud(root, white, [x, y, z], [x / TP.rx / TP.rx, (y - TP.cy) / TP.ry / TP.ry, Math.max(.2, z / TP.rz / TP.rz)], [r, .01, r]); };
  [[-.2725, .2, .018], [.27, .2, .018], [0, .055, .016], [-.4, .3, .014], [.4, .3, .014], [-.14, .085, .013], [.14, .085, .013], [-.2, .79, .012], [.2, .79, .012], [0, .845, .012], [-.36, .7, .013], [.36, .7, .013]].forEach(a => dot(...a));
  root.add(torus(TP.rx * .99, .014, deep, [0, TP.cy, 0], [0, 0, 0], [1, TP.ry / TP.rx * .99, 1], Math.PI * 2, 64));
  freeze(root);
  return root;
}

/* views that line each model up with its old drawing's viewBox (w,h are the image size; keep their ratio) */
const T12 = Math.tan(Math.PI / 15);
const fit = (height, aspect) => height / (1 + T12 * aspect);
export function miniLanternView(w = 96, h = 152) { return { w, h, frame: [0, .79, fit(1.58, w / h)], yaw: .3, pitch: .1 }; }
export function basketView(w = 264, h = 236) { return { w, h, frame: [0, .447, fit(118 / 132, w / h)], yaw: .2, pitch: .12 }; }
export function moonDoorView(w = 184, h = 184) { return { w, h, frame: [0, .5, fit(1, w / h)], yaw: .15, pitch: .05 }; }
export function greatMoonView(w = 192, h = 192) { return { w, h, frame: [0, .5, fit(1, w / h)], yaw: .1, pitch: .05 }; }
export function gladeView(w = 160, h = 160) { return { w, h, pad: 1.08, yaw: .3, pitch: .55 }; }

/* ================================================================ mini lantern + basket ================================================================ */
// mini lantern: the 48x76 <symbol id="sym-mini">, width 1, height 1.58, base at y=0
const mX = sx => (sx - 24) / 48, mY = sy => (76 - sy) / 48;
export function miniLanternModel(lit = true) {
  const root = new THREE.Group();
  const brass = M('#e0b866', .18), brass2 = M('#c99a4e', .12);
  root.add(tube([[mX(16), mY(10.5), 0], [mX(24), mY(1), 0], [mX(32), mY(10.5), 0]], .035, brass, 14, 6));
  root.add(lathe([[0, mY(17.5)], [.3, mY(17.5)], [.29, mY(16.5)], [.2, mY(10)], [0, mY(9.5)]], brass, 20));
  root.add(sb(brass, [0, mY(9.6), 0], .045));
  const W = .71, H = 1.02, D = .5, cy = mY(42);
  const frame = ringShape(roundRectShape(W, H, .17), roundRectShape(W - .1, H - .1, .13));
  for (const z of [-D / 2, D / 2]) { const f = slabLo(frame, .03, brass, .012, 6); f.position.set(0, cy, z); root.add(f); }
  for (const sx of [-1, 1]) root.add(rbox(.05, H - .3, D, brass2, .02, [sx * (W / 2 - .025), cy, 0]));
  const glass = rbox(W - .04, H - .04, D - .02, mat(lit ? '#ffe9a0' : '#e6ecff', { glass: lit ? .32 : .22 }), .15, [0, cy, 0]);
  glass.userData.noMerge = true; root.add(glass);
  const dm = lit ? mat('#ffd86b', { glow: 1.7 }) : F('#d9cfae');
  for (let r = 0; r < 5; r++) for (const sx of [17, 31]) root.add(sb(dm, [mX(sx), mY(25 + r * 9), .06], [.085, .085, .06]));
  root.add(rbox(.6, .14, .44, brass, .06, [0, mY(69), 0]));
  if (lit) { const h = glow('#ffd86b', 1.9, .6); h.position.set(0, cy, .1); root.add(h); }
  freeze(root);
  return root;
}
// basket: the 132x118 drawing, width 1 (x in [-.5,.5]), height .894, base at y=0
const kX = sx => (sx - 66) / 132, kY = sy => (118 - sy) / 132;
export function basketModel() {
  const root = new THREE.Group();
  [[39, 54, .03, .1], [67, 48, -.06, -.04], [95, 56, .04, -.12]].forEach(([x, bot, z, rz]) => {
    const m = miniLanternModel(true); m.scale.setScalar(.258); m.position.set(kX(x), kY(bot) - .025, z); m.rotation.z = rz; root.add(m);
  });
  const sz = .55, body = DS('#c4935a', { felt: true });
  const bk = lathe([[0, .02], [.3, .02], [.335, .045], [.37, .2], [.41, .44], [.42, .5], [.4, .5], [.39, .44], [.35, .2], [0, .19]], body, 36); bk.scale.z = sz; root.add(bk);
  const b1 = F('#b07f48'), b2 = F('#d9a86c');
  for (let i = 0; i < 6; i++) { const y = .08 + i * .07, r = .34 + (y - .045) * .17; root.add(torus(r, .016, i % 2 ? b1 : b2, [0, y, 0], [Math.PI / 2, 0, 0], [1, sz, 1], Math.PI * 2, 40)); }
  for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; root.add(capsule(F('#9a6c3a'), [Math.cos(t) * .335, .05, Math.sin(t) * .335 * sz], [Math.cos(t) * .418, .49, Math.sin(t) * .418 * sz], .01)); }
  root.add(torus(.43, .035, F('#d9a86c'), [0, .52, 0], [Math.PI / 2, 0, 0], [1, sz, 1], Math.PI * 2, 48));
  const cl = gingMat(4, 4);
  const c = new THREE.Mesh(new THREE.CircleGeometry(.41, 32), cl); c.rotation.x = -Math.PI / 2; c.scale.y = sz; c.position.y = .47; root.add(c);
  const flap = new THREE.CircleGeometry(.042, 12, Math.PI, Math.PI);
  for (let i = 0; i < 8; i++) { const x = -.245 + i * .07, z = sz * Math.sqrt(.45 * .45 - x * x) + .01; const f = mesh(flap, cl, [x, .5, z], 1, [.25, Math.atan2(x * sz, z) * .8, 0]); root.add(f); }
  freeze(root);
  return root;
}

/* ================================================================ moons ================================================================ */
export function moonDoorModel() {
  const root = new THREE.Group();
  const dX = sx => (sx - 46) / 92, dY = sy => (92 - sy) / 92;
  const cx = dX(51.1), cy = dY(45.3);
  const cr = slab(crescentShape(38 / 92, dX(69) - cx, dY(39) - cy, 32.9 / 92, 48), .1, mat('#ffe9a8', { glow: .35, glowColor: '#ffd86b' }), .04);
  cr.position.set(cx, cy, 0); root.add(cr);
  const h = glow('#ffd86b', 1.25, .4); h.position.set(0, .5, -.12); root.add(h);
  const door = slab(archShape(24 / 92, 36 / 92), .05, F('#5a4a9a'), .015); door.position.set(dX(42), dY(58), .1); root.add(door);
  const arch = []; const w = 12 / 92, top = dY(52);
  arch.push([dX(30), dY(76), .13]);
  for (let i = 0; i <= 10; i++) { const t = Math.PI - i / 10 * Math.PI; arch.push([dX(42) + Math.cos(t) * w, top + Math.sin(t) * w, .13]); }
  arch.push([dX(54), dY(76), .13]);
  root.add(tube(arch, .016, M(GOLD, .2), 40, 6));
  root.add(rbox(.32, .03, .1, M(GOLD, .15), .01, [dX(42), dY(77), .1]));
  root.add(sb(M('#ffd86b', .3), [dX(49), dY(62), .14], .022));
  root.add(sb(GL('#fff6c8', 1.2), [dX(42), dY(50), .13], [.025, .025, .01]));
  freeze(root);
  return root;
}
export function greatMoonModel() {
  const root = new THREE.Group();
  const gX = sx => (sx - 48) / 96, gY = sy => (96 - sy) / 96;
  const brass = M('#e0b866', .18);
  root.add(tube([[gX(30), gY(13), 0], [gX(48), gY(2), 0], [gX(66), gY(13), 0]], .02, M(GOLD, .2), 14, 6));
  root.add(lathe([[0, gY(20.5)], [.27, gY(20.5)], [.255, gY(19)], [.2, gY(12)], [0, gY(11.5)]], brass, 28));
  const c = [0, gY(54), 0], R = 34 / 96;
  root.add(ball(mat('#ffe9a8', { glow: .45, glowColor: '#ffd86b' }), c, [R, R, R * .75]));
  const cm = mat('#f2d68c', { glow: .3, glowColor: '#e8c470' });
  [[-.13, .1, .07], [.12, -.12, .09], [.15, .12, .045]].forEach(([x, y, s]) => { const z = Math.sqrt(Math.max(0, R * R - x * x - y * y)) * .75; stud(root, cm, [x, c[1] + y, z], [x, y, z / .75 / .75], [s, .012, s]); });
  root.add(torus(R, .022, M(GOLD, .2), c, [0, 0, 0], 1, Math.PI * 2, 56));
  const face = new THREE.Group(); face.position.set(0, c[1] - .03, R * .75); face.scale.setScalar(.2); root.add(face);
  eyes(face, { y: .15, x: .45, z: -.02, closed: true, ink: '#c9a04e' });
  smile(face, { y: -.2, z: -.02, w: .16, color: '#c9a04e' });
  const h = glow('#ffd86b', 1.35, .5); h.position.set(0, c[1], -.1); root.add(h);
  freeze(root);
  return root;
}

/* ================================================================ glade icons ================================================================ */
// a small round diorama: grassy disc radius .5 sitting on y=0, grass top at y=.06
function gladeBase(seed, grass = '#6ea064') {
  const g = new THREE.Group();
  g.add(lathe([[0, .06], [.44, .06], [.485, .05], [.5, .035]], F(grass), 40));
  g.add(lathe([[.5, .035], [.49, .012], [.46, 0], [0, 0]], F('#8a6a45'), 40));
  const r = rng(seed), bl = [F(lighten(grass, -.06)), F(lighten(grass, .05))];
  const cone = new THREE.ConeGeometry(.012, .07, 4); cone.translate(0, .035, 0);
  for (let i = 0; i < 26; i++) {
    const t = r() * Math.PI * 2, rr = .15 + r() * .3;
    for (let j = 0; j < 3; j++) g.add(mesh(cone, bl[j % 2], [Math.cos(t) * rr + (j - 1) * .012, .055, Math.sin(t) * rr], [1, .7 + r() * .6, 1], [(r() - .5) * .5, 0, (j - 1) * .35]));
  }
  return g;
}
function bush(g, x, z, s, seed) {
  const r = rng(seed), l1 = F('#4f8a55'), l2 = F('#5f9a62'), be = mat('#9b8cff', { glow: .35 }), hi = F('#ffffff');
  const parts = [[0, .1, 0, .12], [-.08, .08, .02, .09], [.08, .08, .01, .09], [0, .17, -.02, .08], [-.04, .07, .07, .07], [.05, .07, .07, .07]];
  parts.forEach(([px, py, pz, pr], i) => g.add(mesh(SPH(14), i % 2 ? l1 : l2, [x + px * s, py * s + .04, z + pz * s], pr * s)));
  for (let i = 0; i < 9; i++) {
    const p = parts[i % parts.length], t = r() * Math.PI * 2, u = .2 + r() * .8;
    const d = new THREE.Vector3(Math.cos(t) * Math.sqrt(1 - u * u), u, Math.sin(t) * Math.sqrt(1 - u * u)); if (d.z < 0) d.z = -d.z * .6 + .3; d.normalize();
    const pos = [x + (p[0] + d.x * p[3]) * s, p[1] * s + .04 + d.y * p[3] * s, z + (p[2] + d.z * p[3]) * s];
    g.add(sb(be, pos, .028 * s * 1.6));
    g.add(sb(hi, [pos[0] - .008, pos[1] + .01, pos[2] + .018], .007));
  }
}
const GLADES = {
  'Moonberry Garden'() {
    const g = gladeBase(3);
    bush(g, -.2, -.05, 1.25, 1); bush(g, .2, -.1, 1.1, 2); bush(g, .02, .2, .95, 3);
    const m = slab(crescentShape(.08, .05, .03, .07), .03, mat('#ffe9a8', { glow: .7 }), .015); m.position.set(.24, .58, 0); m.rotation.z = .3; g.add(m);
    const h = glow('#ffe9a8', .4, .55); h.position.set(.24, .58, .03); g.add(h);
    for (const [x, z] of [[-.38, .15], [.36, .2]]) g.add(bloom('#b9a6e8', .2).translateX(x).translateZ(z).translateY(.05));
    return g;
  },
  'Whispering River'() {
    const g = gladeBase(5, '#74a868');
    const s = new THREE.Shape(), N = 16, top = [], bot = [];
    for (let i = 0; i <= N; i++) { const x = -.47 + .94 * i / N, z = .06 + Math.sin(x * 7) * .06; top.push([x, -(z - .085)]); bot.push([x, -(z + .085)]); }
    s.moveTo(...top[0]); top.slice(1).forEach(p => s.lineTo(...p)); bot.reverse().forEach(p => s.lineTo(...p));
    const water = mesh(new THREE.ShapeGeometry(s), G('#6aa7d8'), [0, .064, 0], 1, [-Math.PI / 2, 0, 0]); g.add(water);
    const rip = F('#d6ecff');
    for (const [x0, len] of [[-.33, .14], [.02, .12], [.24, .12]]) {
      const pts = []; for (let i = 0; i <= 5; i++) { const x = x0 + len * i / 5; pts.push([x, .068, .06 + Math.sin(x * 7) * .06 + Math.sin(i / 5 * Math.PI) * -.012]); }
      g.add(tube(pts, .007, rip, 10, 4));
    }
    const st = F('#9aa3ba'), st2 = F('#b8bfd0');
    [[-.4, .2], [-.1, .2], [.34, -.01], [.15, -.1], [-.3, -.08]].forEach(([x, z], i) => g.add(sb(i % 2 ? st : st2, [x, .065, z], [.04, .022, .03])));
    const stem = mat('#5f8f5a'), head = F('#94692f');
    [[-.22, -.2, .32], [-.15, -.24, .27], [-.28, -.16, .24], [.3, -.22, .22]].forEach(([x, z, hgt]) => {
      g.add(tube([[x, .06, z], [x + .01, .06 + hgt * .5, z], [x - .01, .06 + hgt, z]], .007, stem, 6, 4));
      g.add(capsule(head, [x - .01, .06 + hgt - .07, z], [x - .01, .06 + hgt - .02, z], .018));
      g.add(sb(F('#7cb06a'), [x + .02, .06 + hgt * .35, z], [.012, .08, .006], [0, 0, -.3]));
    });
    const pad = mesh(new THREE.CylinderGeometry(.075, .075, .008, 24, 1, false, .3, Math.PI * 1.8), F('#5f9a62'), [.16, .07, .12]); g.add(pad);
    const pk = F('#f2a7b5');
    for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; g.add(sb(pk, [.16 + Math.cos(t) * .022, .095, .12 + Math.sin(t) * .022], [.022, .028, .012], [0, -t, .4])); }
    g.add(sb(F('#ffd86b'), [.16, .1, .12], .014));
    return g;
  },
  'Starlight Meadow'() {
    const g = gladeBase(9, '#6ea064');
    g.add(ball(F('#79ab6c'), [0, .02, 0], [.3, .08, .26]));
    const star = mesh(starGeo(), mat('#ffd86b', { glow: 1.1 }), [0, .42, 0], [.13, .13, .1]); star.rotation.z = .12; g.add(star);
    const h = glow('#ffe9a0', .9, .8); h.position.set(0, .42, .05); g.add(h);
    for (const [x, y] of [[-.3, .55], [.3, .5], [.22, .7], [-.2, .72]]) g.add(sb(GL('#fff6c8', 1.4), [x, y, 0], .016));
    [['#f2a7b5', -.25, .12], ['#ffffff', -.1, .26], ['#f2a7b5', .14, .24], ['#ffffff', .28, .08], ['#b9a6e8', .3, -.15], ['#ffffff', -.3, -.12], ['#f2a7b5', .02, -.25], ['#ffd86b', -.12, .02], ['#ffffff', .1, .06]].forEach(([c, x, z], i) => {
      const f = bloom(c, .3 + (i % 3) * .05); f.position.set(x, .05, z); g.add(f);
    });
    return g;
  },
  'Mushroom Ring'() {
    const g = gladeBase(11, '#5f9a62');
    for (let i = 0; i < 8; i++) {
      const t = i / 8 * Math.PI * 2 + .2, s = i % 2 ? .13 : .17;
      const m = shroom(i % 3 === 2 ? '#f2a7b5' : '#e2566b', s); m.position.set(Math.cos(t) * .33, .05, Math.sin(t) * .3); m.rotation.y = t; g.add(m);
    }
    const big = shroom('#e2566b', .28); big.position.set(0, .05, -.02); g.add(big);
    for (const [x, y, z] of [[-.14, .3, .12], [.16, .36, .1], [.03, .44, .2]]) { g.add(sb(GL('#fff3a0', 1.6), [x, y, z], .014)); const h = glow('#ffe27a', .14, .8); h.position.set(x, y, z); g.add(h); }
    return g;
  }
};
export function gladeModel(name) {
  const root = new THREE.Group();
  root.add((GLADES[name] || GLADES['Moonberry Garden'])());
  freeze(root);
  return root;
}
