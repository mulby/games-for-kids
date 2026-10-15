// Bramble Wood village in felt 3D: the lane behind the shop with the neighbours' homes and two little shops,
// plus the garden things (outside the shop) and treasures (on a shelf inside) she can buy there.
// shop3d.js adds these to its scene and moves the shopkeeper along the lane; index.html runs the jobs and shops.
import * as THREE from 'three';
import * as D from './felt3d.js';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// The lane runs along x. Every place sits behind it (z < 0) with its door facing the camera (+z).
// stand: where the shopkeeper waits; door: where the neighbour comes out; meet: where the neighbour stands.
export const LANE_Z = 1.3, LANE = [-20, 23];
export const PLACES = {
  gate: { x: -19, stand: [-18.4, LANE_Z], face: .3 },
  burrow: { x: -12.5, door: [-12.5, -1.0], stand: [-13.8, .9], meet: [-11.3, .5] },
  stall: { x: -6, door: [-6.6, -1.3], stand: [-7.2, 1.3], meet: [-5.2, .2] },
  oak: { x: 0.5, door: [.5, -1.2], stand: [-.8, 1.0], meet: [1.8, .4] },
  market: { x: 7, door: [7.6, -1.3], stand: [6.4, 1.3], meet: [8.2, .2] },
  ring: { x: 13.5, door: [13.5, -1.6], stand: [12.2, 1.0], meet: [14.6, .5] },
  pond: { x: 20, door: [21.2, -2.3], stand: [18.9, 1.0], meet: [21.1, .7] },
};

/* ------------------------------------------------------------------ small parts */
const dirt = () => D.felt('#d9c09a', { fibre: .25, mottle: .3, scale: .8 });
function sign(text, w = 2.2, h = .6, o = {}) {
  const g = new THREE.Group();
  g.add(D.rbox(w + .2, h + .2, .1, .04, D.wood('#9a6a45', { axis: 0 })));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: D.labelTexture(text, { w: 512, h: Math.round(512 * h / w), bg: o.bg || '#fff3dc', border: o.border || '#c98a5a', fs: o.fs || Math.round(512 * h / w * .5) }), roughness: .85 }));
  f.position.z = .06; g.add(f);
  return g;
}
function post(h = 1.6) { return D.lathe([[0, 0], [.09, 0], [.08, h], [0, h + .02]], D.wood('#6b4a33', { axis: 1 }), 12); }
function roundDoor(r = .8, color = '#7bb4d9') {
  const d = new THREE.Group();
  d.add(D.mesh(new THREE.CylinderGeometry(r, r, .12, 40), D.wood(color, { axis: 1, freq: 3 }), [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
  d.add(D.mesh(new THREE.TorusGeometry(r + .04, .1, 10, 40), D.wood(D.PAL.woodFrame, { axis: 2 }), [0, 0, .04]));
  for (let i = -1; i <= 1; i++) d.add(D.rbox(.03, r * 1.8 * Math.cos(Math.asin(i * .33)), .02, .01, D.wood(D.lighten(color, -.12))).translateX(i * r * .33).translateZ(.07));
  d.add(D.bead(D.metal(D.PAL.gold, { rough: .25 }), [r * .55, 0, .12], .07));
  return d;
}
function smallWindow(r = .38) {
  const w = new THREE.Group();
  w.add(D.mesh(new THREE.CircleGeometry(r, 24), D.glowMat('#ffd98a', .5, { color: '#ffe9b8' })));
  w.add(D.mesh(new THREE.TorusGeometry(r + .02, .07, 8, 28), D.wood(D.PAL.woodFrame, { axis: 2 }), [0, 0, .03]));
  w.add(D.rbox(.05, r * 2, .03, .01, D.wood(D.PAL.woodFrame)).translateZ(.05)); w.add(D.rbox(r * 2, .05, .03, .01, D.wood(D.PAL.woodFrame)).translateZ(.05));
  return w;
}
function carrot(s = 1) {
  const g = new THREE.Group();
  g.add(D.mesh(new THREE.ConeGeometry(.12, .2, 12), D.felt('#f08a3a'), [0, .02, 0], 1, [Math.PI, 0, 0]));
  for (let i = 0; i < 3; i++) g.add(D.mesh(D.SPH(8), D.felt('#5f9a62'), [Math.cos(i * 2.1) * .05, .2, Math.sin(i * 2.1) * .05], [.04, .16, .03], [Math.cos(i * 2.1) * .4, 0, Math.sin(i * 2.1) * .4]));
  g.scale.setScalar(s); return g;
}
function book(color, s = 1) { const b = D.rbox(.5 * s, .12 * s, .36 * s, .02, D.felt(color)); return b; }
function bookStack(n, seed = 1) {
  const g = new THREE.Group(), cols = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8', '#f6a6bd'];
  for (let i = 0; i < n; i++) { const b = book(cols[(i + seed) % cols.length]); b.position.y = .06 + i * .13; b.rotation.y = ((i * 7 + seed) % 5 - 2) * .08; g.add(b); }
  return g;
}
function bucketOf(colors, seed = 1) {
  const g = new THREE.Group();
  g.add(D.lathe([[0, 0], [.22, 0], [.27, .36], [.25, .38], [0, .36]], D.metal('#c9d3df', { rough: .4 }), 24));
  // a little bouquet: each flower's stem starts inside the bucket and leans out a touch
  colors.forEach((c, i) => { const f = D.feltFlower(c, .85, { stem: true }); const a = i / colors.length * TAU + seed, r = colors.length > 1 ? .09 : 0; f.position.set(Math.cos(a) * r, .7 + (i % 2) * .07, Math.sin(a) * r); f.rotation.set(.25 * Math.sin(a), 0, -.25 * Math.cos(a)); g.add(f); });
  return g;
}
function stall(o) {
  const g = new THREE.Group(), top = D.wood(o.wood || '#c08a58', { axis: 0 }), leg = D.wood(D.PAL.woodDark, { axis: 1 });
  g.add(D.rbox(3.0, .14, 1.3, .04, top).translateY(1.05));
  g.add(D.rbox(2.9, .7, .08, .03, D.felt(o.cloth, { print: { kind: 'stripes', color: '#fff7e6', n: 10, w: .4, scale: 2 } })).translateY(.68).translateZ(.62));
  for (const x of [-1.38, 1.38]) for (const z of [-.55, .55]) g.add(D.rbox(.12, 1.05, .12, .03, leg).translateX(x).translateY(.52).translateZ(z));
  for (const x of [-1.38, 1.38]) g.add(D.rbox(.12, 1.7, .12, .03, leg).translateX(x).translateY(1.95).translateZ(-.55));
  const aw = D.awning({ w: 3.1, color: o.awning }); aw.position.set(0, 3.15, -.5); aw.scale.set(1, .8, 1.1); g.add(aw);
  const s = sign(o.title, 2.0, .5); s.position.set(0, 3.45, -.55); g.add(s);
  return g;
}

/* ------------------------------------------------------------------ the homes and shops */
function burrow() {
  const g = new THREE.Group();
  g.add(D.mesh(D.lumpy(D.SPH(40), .05, 1.4, 4), D.felt('#86bd62', { scale: .8, mottle: .3 }), [0, -.4, -1.2], [3.0, 2.6, 2.2]));
  const dr = roundDoor(.8, '#e2566b'); dr.position.set(0, .82, .86); dr.rotation.x = -.18; g.add(dr);
  for (const sx of [-1, 1]) { const w = smallWindow(.36); w.position.set(sx * 1.55, 1.25, .45); w.rotation.y = sx * .45; w.rotation.x = -.2; g.add(w); }
  g.add(D.mesh(new THREE.CylinderGeometry(.22, .26, .9, 16), D.felt('#c98a5a', { print: { kind: 'gingham', color: '#a8672e', n: 4, scale: 2 } }), [1.0, 2.25, -1.2]));
  const st = D.stepStone(1.3, 3); st.position.set(0, 0, 1.25); g.add(st);
  // the carrot patch beside the burrow
  const bed = D.mesh(D.lumpy(D.SPH(24), .08, 2, 7), D.felt('#8a5f3c', { fibre: .3 }), [2.6, -.02, .6], [1.4, .14, .9]); g.add(bed);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const k = carrot(1.2); k.position.set(1.85 + c * .5, .1, .15 + r * .42); g.add(k); }
  return g;
}
function oak() {
  const g = new THREE.Group(), bark = D.wood('#6b4a33', { axis: 1, freq: 6, grain: .7 });
  g.add(D.lathe([[0, 0], [1.9, 0], [1.4, .4], [1.15, 1.6], [1.0, 3.6], [0, 3.8]], bark, 32, { smooth: 16 }).translateZ(-1.2));
  const leaf = D.felt('#4f8a52', { scale: 1.2, fibre: .25 }), leaf2 = D.felt('#5f9a5c', { scale: 1.2, fibre: .25 });
  [[0, 5.0, 0, 2.3], [-1.8, 4.3, .2, 1.5], [1.8, 4.4, -.1, 1.6], [.3, 6.4, -.2, 1.6], [-.9, 5.6, -.9, 1.4], [1.1, 5.4, .7, 1.2]].forEach(([x, y, z, r], i) => g.add(D.mesh(D.lumpy(D.SPH(24), .12, 1.6, 30 + i), i % 2 ? leaf2 : leaf, [x, y, z - 1.2], r)));
  // the trunk narrows as it rises (radius ~1.39 at y .45, ~1.08 at y 2.6, centre z -1.2): door and windows sit on its skin
  const dr = roundDoor(.62, '#8cc46c'); dr.position.set(0, 1.05, .2); dr.rotation.x = -.16; g.add(dr);
  const w = smallWindow(.3); w.position.set(.35, 2.6, -.13); w.rotation.set(-.16, .33, 0); g.add(w);
  const w2 = smallWindow(.24); w2.position.set(-.5, 3.3, -.26); w2.rotation.set(-.16, -.5, 0); g.add(w2);
  const books = bookStack(5, 2); books.position.set(-1.6, 0, .4); books.rotation.y = .4; g.add(books);
  const books2 = bookStack(3, 4); books2.position.set(1.5, 0, .5); books2.rotation.y = -.3; g.add(books2);
  const s = sign('Library', 1.3, .4); s.position.set(-1.2, 1.4, .64); s.rotation.y = .3; const p = post(1.2); p.position.set(-1.2, 0, .5); g.add(p, s);
  return g;
}
function flowerStall() {
  const g = stall({ title: "Dot's Flowers", cloth: '#f6a6bd', awning: '#8cc46c' });
  [['#f6a6bd', '#ffffff', '#ffd86b'], ['#b9a6e8', '#f6a6bd'], ['#ffd86b', '#ffffff', '#ffd86b'], ['#e2566b', '#f6a6bd']].forEach((cs, i) => { const b = bucketOf(cs, i); b.position.set(-1.05 + i * .7, 1.12, -.05 + (i % 2) * .2); g.add(b); });
  const b = bucketOf(['#ffd86b', '#e2566b', '#ffffff'], 5); b.position.set(-1.9, 0, .4); g.add(b);
  return g;
}
function treasureStall() {
  const g = stall({ title: "Miu's Treasures", cloth: '#7bb4d9', awning: '#e9b949', wood: '#b07a4a' });
  const gold = D.metal(D.PAL.gold, { rough: .25 });
  g.add(D.mesh(new THREE.ConeGeometry(.32, .45, 4), gold, [-.9, 1.34, 0], 1, [0, Math.PI / 4, 0]));
  g.add(D.ball(gold, [-.2, 1.22, .15], [.18, .12, .24]));
  g.add(D.ball(D.glossy('#f6c6d8', { rough: .2 }), [.45, 1.2, -.05], [.2, .12, .17]));
  const chest = treasureChest(.7); chest.position.set(1.0, 1.12, -.1); g.add(chest);
  return g;
}
function treasureChest(s = 1) {
  const g = new THREE.Group(), w = D.wood('#8a5a36', { axis: 0 }), gold = D.metal(D.PAL.gold, { rough: .3 });
  g.add(D.rbox(.9, .5, .55, .05, w).translateY(.25));
  g.add(D.mesh(new THREE.CylinderGeometry(.28, .28, .9, 20, 1, false, 0, Math.PI), w, [0, .5, 0], [1, 1, 1], [0, 0, Math.PI / 2]));
  for (const x of [-.32, .32]) g.add(D.rbox(.07, .55, .58, .02, gold).translateX(x).translateY(.27));
  g.add(D.rbox(.14, .16, .04, .02, gold).translateY(.5).translateZ(.29));
  for (let i = 0; i < 5; i++) { const c = D.coin(1); c.scale.setScalar(.14); c.position.set(-.25 + i * .12, .78 + (i % 2) * .04, .05); c.rotation.x = -1.2; g.add(c); }
  g.scale.setScalar(s); return g;
}
const RING_N = 8;
function fairyRing(lit) {
  const g = new THREE.Group();
  g.add(D.mesh(new THREE.CircleGeometry(2.4, 40).rotateX(-Math.PI / 2), D.felt('#a6d68a', { mottle: .4 }), [0, .02, 0]));
  for (let i = 0; i < RING_N; i++) {
    const a = i / RING_N * TAU, x = Math.cos(a) * 2.1, z = Math.sin(a) * 1.5;
    const m = D.toadstool(['#e2566b', '#b9a6e8', '#f6a6bd', '#ffd86b'][i % 4], .7 + (i % 3) * .12); m.position.set(x, 0, z); m.rotation.y = a; g.add(m);
    // a little lantern on a twig beside each toadstool
    const lx = Math.cos(a + .35) * 2.25, lz = Math.sin(a + .35) * 1.65;
    g.add(D.tube([[lx, 0, lz], [lx, .9, lz], [lx + .12, 1.05, lz]], .02, D.wood('#6b4a33'), 8, 4));
    g.add(D.mesh(new THREE.SphereGeometry(.12, 14, 10), lit, [lx + .14, .9, lz]));
  }
  return g;
}
function pond() {
  const g = new THREE.Group();
  g.add(D.mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), D.glossy('#7bb4d9', { rough: .12 }), [0, .04, -1.6], [3.4, 1, 2.0]));
  for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, st = D.stepStone(.6 + (i % 3) * .15, i + 20); st.position.set(Math.cos(a) * 3.5, 0, -1.6 + Math.sin(a) * 2.1); st.rotation.y = a; g.add(st); }
  for (let i = 0; i < 9; i++) { const a = 2.2 + i * .18, x = Math.cos(a) * 3.2, z = -1.6 + Math.sin(a) * 1.8; g.add(D.tube([[x, 0, z], [x + .05, .9 + (i % 3) * .2, z]], .025, D.felt('#5f9a62'), 4, 4)); if (i % 2) g.add(D.mesh(D.SPH(10), D.felt('#7a4f2e'), [x + .05, .85 + (i % 3) * .2, z], [.05, .16, .05])); }
  // Captain Whiskers' rowing boat with a little sail and a pirate flag
  const boat = new THREE.Group(); boat.position.set(-.6, 0, -2.0); boat.rotation.y = .25; g.add(boat);
  boat.add(D.ball(D.wood('#9a6a45', { axis: 0 }), [0, .22, 0], [1.4, .5, .6], [0, 0, 0], 32));
  boat.add(D.ball(D.wood('#c08a58', { axis: 0 }), [0, .55, 0], [1.25, .14, .5], [0, 0, 0], 24));
  boat.add(D.rbox(.12, 2.2, .12, .03, D.wood('#6b4a33', { axis: 1 })).translateY(1.5));
  const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(1.0, 0); sail.lineTo(0, 1.5); sail.lineTo(0, 0);
  boat.add(D.mesh(new THREE.ShapeGeometry(sail), D.felt('#fff7e6', { side: THREE.DoubleSide, print: { kind: 'stripes', color: '#e2566b', n: 4, w: .4, scale: 1 } }), [.08, .75, 0]));
  boat.add(D.rbox(.55, .36, .02, .01, D.felt('#2e2650')).translateX(.33).translateY(2.4));
  boat.add(D.ball(D.felt('#ffffff'), [.33, 2.42, .02], [.08, .08, .02], [0, 0, 0], 12));
  // a little jetty out to the boat, so the captain walks ashore on planks
  for (let i = 0; i < 9; i++) g.add(D.rbox(.95, .08, .2, .02, D.wood(i % 2 ? '#b07a4a' : '#c08a58', { axis: 0 })).translateX(.4).translateY(.1).translateZ(.5 - i * .25));
  for (const z of [.3, -1.4]) for (const x of [-.05, .85]) g.add(D.rbox(.1, .4, .1, .02, D.wood('#6b4a33', { axis: 1 })).translateX(x).translateY(.08).translateZ(z));
  const chest = treasureChest(.8); chest.position.set(1.6, 0, 1.4); chest.rotation.y = -.4; g.add(chest);
  return g;
}
function gate() {
  const g = new THREE.Group();
  const p = post(2.2); g.add(p);
  // the boards hang on the front of the post, one pointing each way
  const s = sign('To my shop', 1.6, .45); s.position.set(.92, 1.85, .14); g.add(s);
  const s2 = sign('Village', 1.3, .4); s2.position.set(-.76, 1.3, .14); g.add(s2);
  for (let i = 0; i < 4; i++) { const f = post(.8); f.position.set(-1.5 - i * .8, 0, -.6 - i * .3); g.add(f); }
  g.add(D.rbox(2.6, .1, .08, .02, D.wood('#9a6a45', { axis: 0 })).translateX(-2.7).translateY(.6).translateZ(-1.05).rotateY(.36));
  const shop = D.toadstool(D.PAL.toadRed, 2.2); shop.position.set(-4.5, 0, -4); g.add(shop);
  return g;
}

/* ------------------------------------------------------------------ the whole village */
// Returns { group, ringLit (material: brighten it when the fairy ring's lanterns are lit), places: { id: group } }.
export function buildVillage(opts = {}) {
  const touch = !!opts.touch;
  const group = new THREE.Group(), env = new THREE.Group(); env.userData.noCast = true;
  env.add(D.ground(70, D.PAL.grass));
  [[-30, -32, 18, '#79b25e'], [0, -40, 26, '#6fa756'], [28, -30, 20, '#82bb63'], [-45, -10, 14, '#74ad5a'], [45, -12, 16, '#74ad5a']]
    .forEach(([x, z, r, c], i) => env.add(D.mesh(D.lumpy(D.SPH(32), .04, .8, i + 10), D.felt(c, { scale: .5, mottle: .3 }), [x, -r * .55, z], [r, r * .8, r * .7])));
  // the lane: worn felt dirt patches all the way along
  const lane = dirt();
  for (let x = LANE[0] - 1, i = 0; x <= LANE[1] + 1; x += .9, i++) env.add(D.mesh(D.lumpy(D.SPH(16), .1, 2, i), lane, [x, -.03, LANE_Z + Math.sin(i * 1.7) * .15], [.85, .08, .75 + (i % 3) * .08]));
  // short paths up to each door
  for (const [id, P] of Object.entries(PLACES)) if (P.door) for (let k = 0; k < 3; k++) { const t = (k + 1) / 4; env.add(D.mesh(D.lumpy(D.SPH(14), .1, 2, k + id.length), lane, [P.door[0] + (P.stand[0] - P.door[0]) * t * .3, -.03, P.door[1] + (LANE_Z - P.door[1]) * t + .5], [.6, .07, .5])); }
  // trees behind and at the ends
  [[-22, -7, 1.5], [-16.5, -6.5, 1.3], [-9, -7.5, 1.6], [-3, -8, 1.4], [3.8, -7.5, 1.5], [10.5, -7, 1.3], [17, -8, 1.6], [25, -6, 1.5], [-26, -2, 1.3], [27, 0, 1.4], [-24, 4.5, 1.1], [26, 5, 1.2]]
    .forEach(([x, z, s], i) => { const t = D.tree(s, i % 2 ? '#4f8a52' : '#3f7a4a', i + 3); t.position.set(x, 0, z); env.add(t); });
  [[-15.6, -1.6], [-2.6, -1.8], [4.2, -2.2], [10.2, -1.8], [16.8, -1.2], [-9.5, -2.2]].forEach(([x, z], i) => { const m = D.toadstool(['#e2566b', '#f6a6bd', '#ffd86b'][i % 3], .55 + (i % 2) * .2); m.position.set(x, 0, z); m.rotation.y = i; env.add(m); });
  const places = {};
  const put = (id, obj, dx = 0, dz = 0) => { obj.position.set(PLACES[id].x + dx, 0, dz); env.add(obj); places[id] = obj; };
  put('gate', gate(), -2.6, -.6);
  put('burrow', burrow(), 0, -1.6);
  put('stall', flowerStall(), -.6, -1.4);
  put('oak', oak(), 0, -.8);
  put('market', treasureStall(), .6, -1.4);
  const ringLit = new THREE.MeshStandardMaterial({ color: '#fff3c8', emissive: '#ffd27a', emissiveIntensity: .15, roughness: .4 });
  ringLit.userData.noCast = true;
  put('ring', fairyRing(ringLit), 0, -1.6);
  put('pond', pond(), .8, -1.0);
  D.freeze(env); env.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  group.add(env);
  // flowers and grass (instanced), kept off the lane
  const r = D.rng(31), fl = [];
  for (let i = 0; i < 70; i++) { const x = -26 + r() * 54, z = r() < .5 ? -10 + r() * 6 : 3 + r() * 5; fl.push({ p: [x, .35, z], s: .7 + r() * .5, ry: r() * 6 }); }
  ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'].forEach((c, i) => { const f = D.feltFlower(c, 1, { stem: true, lite: true }); const sc = D.scatter(f, fl.filter((_, j) => j % 4 === i)); sc.traverse(o => { if (o.isMesh) o.castShadow = false; }); group.add(sc); });
  group.add(D.grassTufts(touch ? 1100 : 1700, [-27, 29, -10, 8], '#6aa858', 5));
  // the lantern glows, to switch on when the fairy ring is lit
  const glows = [];
  for (let i = 0; i < RING_N; i++) { const a = i / RING_N * TAU, s = D.glowSprite('#ffd27a', 1.1, .7); s.position.set(PLACES.ring.x + Math.cos(a + .35) * 2.25 + .14, .9, -1.6 + Math.sin(a + .35) * 1.65); s.visible = false; glows.push(s); group.add(s); }
  const butterflies = [D.butterfly('#f6a6bd', '#ffd86b'), D.butterfly('#b9a6e8', '#fff3cf'), D.butterfly('#ffd86b', '#ffffff')];
  butterflies.forEach(b => group.add(b));
  return { group, ringLit, ringGlows: glows, butterflies, places };
}

/* ------------------------------------------------------------------ garden things, outside the shop */
function bed(w, d, seed) { return D.mesh(D.lumpy(D.SPH(24), .08, 2, seed), D.felt('#8a5f3c', { fibre: .3 }), [0, -.02, 0], [w, .14, d]); }
function tulip(c) {
  const g = new THREE.Group();
  g.add(D.tube([[0, 0, 0], [.02, .35, 0], [0, .7, 0]], .018, D.felt('#5f9a62'), 6, 4));
  g.add(D.ball(D.felt('#7cc06e'), [.07, .25, 0], [.08, .025, .035], [0, 0, -.6], 10));
  g.add(D.lathe([[0, 0], [.1, .03], [.13, .14], [.1, .26], [.06, .22], [0, .2]], D.felt(c, { side: THREE.DoubleSide }), 16).translateY(.68));
  return g;
}
function sunflower(h) {
  const g = new THREE.Group();
  g.add(D.tube([[0, 0, 0], [.05, h * .5, 0], [0, h, .05]], .035, D.felt('#5f9a62'), 8, 5));
  for (const s of [-1, 1]) g.add(D.ball(D.felt('#7cc06e'), [s * .16, h * .45, 0], [.18, .03, .08], [0, 0, s * -.5], 12));
  const head = new THREE.Group(); head.position.set(0, h + .05, .1); head.rotation.x = .35; g.add(head);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; head.add(D.ball(D.felt('#ffd23a'), [Math.cos(a) * .24, Math.sin(a) * .24, 0], [.14, .055, .02], [0, 0, a], 10)); }
  head.add(D.ball(D.felt('#7a4f2e', { fibre: .4 }), [0, 0, .02], [.17, .17, .06], [0, 0, 0], 16));
  return g;
}
function bird(c = '#7bb4d9') {
  const g = new THREE.Group();
  g.add(D.ball(D.felt(c), [0, .12, 0], [.14, .12, .2]));
  g.add(D.ball(D.felt(c), [0, .25, .12], .09));
  g.add(D.mesh(new THREE.ConeGeometry(.03, .08, 8), D.felt('#f0a92a'), [0, .25, .23], 1, [Math.PI / 2, 0, 0]));
  for (const s of [-1, 1]) g.add(D.bead(D.felt('#2e2650'), [s * .05, .28, .19], .018));
  g.add(D.ball(D.felt(D.lighten(c, -.1)), [0, .16, -.2], [.06, .03, .12], [.4, 0, 0], 10));
  return g;
}
export const GARDEN_MODELS = {
  daisies() { const g = new THREE.Group(); g.add(bed(.75, .5, 2)); for (let i = 0; i < 9; i++) { const f = D.feltFlower(i % 3 ? '#ffffff' : '#ffd86b', 1.1, { stem: true }); f.position.set(-.48 + (i % 3) * .48 + (i > 2 && i < 6 ? .2 : 0), .55 + (i % 2) * .06, -.3 + Math.floor(i / 3) * .3); g.add(f); } return g; },
  tulips() { const g = new THREE.Group(); g.add(bed(.85, .5, 3)); ['#e2566b', '#ffd86b', '#f6a6bd', '#b9a6e8', '#e2566b', '#ffd86b', '#f6a6bd'].forEach((c, i) => { const t = tulip(c); t.position.set(-.6 + i * .2, 0, (i % 2 ? .15 : -.12)); g.add(t); }); return g; },
  sunflowers() { const g = new THREE.Group(); g.add(bed(.7, .4, 4)); [1.7, 2.1, 1.5].forEach((h, i) => { const s = sunflower(h); s.position.set(-.4 + i * .4, 0, (i % 2) * -.15); s.rotation.y = (i - 1) * .3; g.add(s); }); return g; },
  birdbath() { const g = new THREE.Group(), stone = D.felt('#cfc6b4', { fibre: .2 }); g.add(D.lathe([[0, 0], [.32, 0], [.3, .08], [.12, .2], [.1, .75], [.18, .85], [.5, .9], [.52, .98], [.46, 1.0], [0, .96]], stone, 32, { smooth: 20 })); g.add(D.mesh(new THREE.CircleGeometry(.44, 28).rotateX(-Math.PI / 2), D.glossy('#9fd0f0', { rough: .1 }), [0, .97, 0])); const b = bird(); b.position.set(.3, .98, 0); b.rotation.y = -1.2; g.add(b); return g; },
  bench() { const g = new THREE.Group(), w = D.wood('#b07a4a', { axis: 0 }), w2 = D.wood('#8a5a36', { axis: 1 }); for (let i = 0; i < 3; i++) g.add(D.rbox(1.6, .07, .16, .02, w).translateY(.55).translateZ(-.18 + i * .18)); for (let i = 0; i < 2; i++) g.add(D.rbox(1.6, .12, .05, .02, w).translateY(.85 + i * .22).translateZ(-.3)); for (const x of [-.7, .7]) { g.add(D.rbox(.08, .55, .45, .02, w2).translateX(x).translateY(.27)); g.add(D.rbox(.08, .6, .06, .02, w2).translateX(x).translateY(.85).translateZ(-.3)); } g.add(D.ball(D.felt('#f6a6bd', { print: { kind: 'dots', color: '#ffffff', n: 6, scale: 3 } }), [.35, .66, 0], [.28, .08, .22], [0, 0, 0], 20)); return g; },
  well() { const g = new THREE.Group(), stone = D.felt('#cfc6b4', { fibre: .2 }); g.add(D.lathe([[0, 0], [.75, 0], [.78, .75], [.62, .8], [0, .78]], stone, 32)); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(D.runningStitch([[Math.cos(a) * .77, .05, Math.sin(a) * .77], [Math.cos(a) * .77, .7, Math.sin(a) * .77]], { len: .05, gap: .04, r: .008, color: '#a89c88' })); } g.add(D.mesh(new THREE.CircleGeometry(.6, 24).rotateX(-Math.PI / 2), D.glossy('#5a8fc7', { rough: .1 }), [0, .7, 0])); for (const x of [-.68, .68]) g.add(D.rbox(.1, 1.3, .1, .02, D.wood('#6b4a33', { axis: 1 })).translateX(x).translateY(1.3)); g.add(D.mesh(new THREE.ConeGeometry(1.05, .7, 4), D.felt('#e2566b'), [0, 2.2, 0], [1, 1, .8], [0, Math.PI / 4, 0])); g.add(D.capsule(D.wood('#6b4a33'), [-.7, 1.6, 0], [.7, 1.6, 0], .05, 8)); g.add(D.lathe([[0, 0], [.14, 0], [.17, .22], [0, .22]], D.wood('#9a6a45', { axis: 1 }), 14).translateY(1.0)); g.add(D.yarn([[0, 1.6, 0], [0, 1.22, 0]], .01, D.thread('#c9a676'), { seg: 6 })); return g; },
  fairyhouse() { const g = new THREE.Group(); const s = D.treeStump(); s.scale.set(1.5, 2.2, 1.5); g.add(s); const d = roundDoor(.22, '#b9a6e8'); d.position.set(0, .3, .66); d.scale.set(1, 1.3, 1); g.add(d); const w = smallWindow(.12); w.position.set(.32, .75, .58); w.rotation.y = .5; g.add(w); g.add(D.mesh(new THREE.ConeGeometry(.9, .7, 20), D.felt('#f6a6bd', { print: { kind: 'dots', color: '#ffffff', n: 8, scale: 3 } }), [0, 1.45, 0])); const sp = D.glowSprite('#ffd27a', .9, .55); sp.position.set(.32, .75, .7); g.add(sp); return g; },
};
// where each garden thing goes around the toadstool shop (its foot is at 0,0,-3)
export const GARDEN_SPOTS = {
  daisies: [-3.2, 0, .9, .3], tulips: [3.0, 0, -.9, -.3], sunflowers: [-3.7, 0, -2.0, .5], birdbath: [-5.6, 0, -.6, .4],
  bench: [3.8, 0, -3.5, -.9], well: [-4.9, 0, -4.6, .7], fairyhouse: [5.7, 0, -3.0, -.6],
};

/* ------------------------------------------------------------------ treasures, on a ledge along the front of the counter */
const gold = () => D.metal(D.PAL.gold, { rough: .25 });
export const TREASURE_MODELS = {
  shell() { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const a = (i - 3) * .28; g.add(D.ball(D.glossy('#f6c6d8', { rough: .25 }), [Math.sin(a) * .16, .14 + Math.cos(a) * .1, 0], [.07, .2, .05], [0, 0, -a], 12)); } g.add(D.ball(D.glossy('#ffffff', { rough: .1 }), [0, .12, .08], .06, [0, 0, 0], 14)); return g; },
  scarab() { const g = new THREE.Group(), m = gold(); g.add(D.ball(m, [0, .12, 0], [.2, .12, .26])); g.add(D.ball(m, [0, .12, .26], [.12, .08, .08])); g.add(D.rbox(.015, .02, .4, .005, D.metal('#a87a1a')).translateY(.24)); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.add(D.capsule(m, [s * .15, .06, -.12 + k * .12], [s * .26, .02, -.16 + k * .14], .02, 6)); g.add(D.bead(D.glossy('#3fae9c', { rough: .15 }), [0, .25, .03], .05)); return g; },
  map() { const g = new THREE.Group(); g.add(D.mesh(new THREE.CylinderGeometry(.09, .09, .6, 16), D.paper('#e9d3a6'), [0, .09, 0], 1, [0, 0, Math.PI / 2])); g.add(D.rbox(.5, .01, .4, .005, D.paper('#efdcb2')).translateY(.01).translateZ(.22)); g.add(D.yarn([[-.15, .05, .2], [0, .02, .3], [.12, .04, .25]], .008, D.thread('#a33a3a'), { seg: 6 })); g.add(D.yarn([[.1, .02, .3], [.16, .02, .36]], .01, D.thread('#a33a3a'), { seg: 2 })); g.add(D.yarn([[.16, .02, .3], [.1, .02, .36]], .01, D.thread('#a33a3a'), { seg: 2 })); g.add(D.mesh(new THREE.TorusGeometry(.1, .015, 6, 16), D.felt('#e2566b'), [0, .09, 0], 1, [0, Math.PI / 2, 0])); return g; },
  pyramid() { const g = new THREE.Group(); g.add(D.mesh(new THREE.ConeGeometry(.32, .42, 4), D.felt('#e8c88a', { fibre: .3 }), [0, .21, 0], 1, [0, Math.PI / 4, 0])); g.add(D.mesh(new THREE.ConeGeometry(.08, .1, 4), gold(), [0, .4, 0], 1, [0, Math.PI / 4, 0])); for (let i = 1; i < 4; i++) { const h = i * .1, rr = .32 * (1 - h / .42); g.add(D.rbox(rr * 1.42, .008, .008, .002, D.metal('#c9a676')).translateY(h).translateZ(rr * .71)); } return g; },
  owl() { const g = new THREE.Group(), m = D.metal('#c9ccd6', { rough: .3 }); g.add(D.rbox(.36, .08, .3, .02, D.felt('#fff6e6')).translateY(.04)); g.add(D.ball(m, [0, .3, 0], [.17, .22, .15])); g.add(D.ball(m, [0, .52, .02], .13)); for (const s of [-1, 1]) { g.add(D.ball(D.metal('#e9b949', { rough: .2 }), [s * .05, .54, .13], .035)); g.add(D.mesh(new THREE.ConeGeometry(.03, .08, 6), m, [s * .08, .66, 0])); } g.add(D.mesh(new THREE.ConeGeometry(.02, .05, 6), D.metal('#e9b949'), [0, .5, .14], 1, [Math.PI / 2, 0, 0])); return g; },
  apple() { const g = new THREE.Group(), m = gold(); g.add(D.ball(m, [0, .2, 0], [.2, .19, .2])); g.add(D.capsule(D.wood('#6b4a33'), [0, .36, 0], [.02, .46, 0], .015, 6)); g.add(D.ball(D.felt('#7cc06e'), [.07, .43, 0], [.08, .02, .04], [0, 0, -.5], 10)); g.add(D.glowSprite('#fff3a0', .5, .35).translateY(.2)); return g; },
  lyre() { const g = new THREE.Group(), m = gold(); g.add(D.rbox(.4, .06, .14, .02, m).translateY(.03)); for (const s of [-1, 1]) g.add(D.tube([[s * .15, .05, 0], [s * .22, .25, 0], [s * .12, .45, 0], [s * .2, .6, 0]], .03, m, 16, 6)); g.add(D.capsule(m, [-.2, .55, 0], [.2, .55, 0], .025, 6)); for (let i = 0; i < 4; i++) g.add(D.capsule(D.thread('#fff6e6'), [-.09 + i * .06, .07, 0], [-.09 + i * .06, .54, 0], .005, 4)); return g; },
  crown() { const g = new THREE.Group(), m = gold(); g.add(D.lathe([[.2, 0], [.22, 0], [.22, .1], [.2, .1]], m, 24)); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.add(D.mesh(new THREE.ConeGeometry(.045, .16, 6), m, [Math.cos(a) * .21, .17, Math.sin(a) * .21])); g.add(D.bead(D.glossy(['#f6a6bd', '#7bb4d9', '#8cc46c'][i % 3], { rough: .1 }), [Math.cos(a) * .21, .26, Math.sin(a) * .21], .035)); } g.add(D.glowSprite('#ffe9a0', .7, .4).translateY(.2)); return g; },
};
export const TREASURE_ORDER = ['shell', 'scarab', 'map', 'pyramid', 'owl', 'apple', 'lyre', 'crown'];
// a little display ledge on brackets along the front of the shop counter, with a slot for each treasure (y 0 is its top)
const LEDGE_W = 5.0;
export function treasureShelf() {
  const g = new THREE.Group(), wd = D.wood('#8a5a36', { axis: 0 });
  g.add(D.rbox(LEDGE_W, .1, .42, .03, wd).translateY(-.05));
  for (const x of [-LEDGE_W / 2 + .3, 0, LEDGE_W / 2 - .3]) g.add(D.rbox(.08, .55, .08, .02, D.wood('#6b4a33', { axis: 1 })).translateX(x).translateY(-.35).translateZ(-.12));
  const n = Math.round(LEDGE_W / .3), sc = new THREE.Group();
  sc.add(D.mesh(new THREE.CircleGeometry(.14, 14, Math.PI, Math.PI), D.felt('#e9b949', { side: THREE.DoubleSide })));
  g.add(D.scatter(sc, Array.from({ length: n }, (_, i) => ({ p: [-LEDGE_W / 2 + (i + .5) * LEDGE_W / n, -.08, .215] }))));
  g.add(D.runningStitch([[-LEDGE_W / 2, -.12, .225], [LEDGE_W / 2, -.12, .225]], { len: .05, gap: .035, r: .007, color: '#ffffff' }));
  return D.freeze(g);
}
export const treasureSpot = id => { const i = TREASURE_ORDER.indexOf(id); return [-LEDGE_W / 2 + .35 + i * (LEDGE_W - .7) / 7, 0, 0]; };
