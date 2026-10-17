// Rooms inside Bramble Wood's houses, in felt 3D: Mrs. Bunbury's burrow kitchen, Old Hoot's library in the oak,
// and the shopkeeper's own house, with the home things she can buy from Tansy. shop3d.js shows one room at a time
// (TSV.scene 'room', TSV.room id); index.html runs what happens there.
// Every room has its origin at the middle of the floor, a curved back wall (radius 7) and the camera looking in from +z.
import * as THREE from 'three';
import * as D from './felt3d.js';

const TAU = Math.PI * 2, PI = Math.PI, PI2 = Math.PI / 2;
const WALL_R = 7, WALL_H = 5.6;
// where the shopkeeper and the one who lives there stand, [x, y, z, yaw]
export const ROOM_SPOTS = {
  burrow: { keeper: [-2.3, 0, .9, .55], cust: [1.9, 0, .5, -.6] },
  oak: { keeper: [-2.3, 0, .9, .55], cust: [1.9, 0, .4, -.6] },
  home: { keeper: [-.6, 0, .9, .15], cust: [2.4, 0, .5, -.6] },
};
export const ROOM_CAM = { pos: [0, 4.3, 15], look: [0, 1.9, -2.2], span: 11, minSpan: 7.6, minH: 4.4, lowY: -.4, focus: [0, 1.3, -2], r: 7 };

/* ------------------------------------------------------------------ helpers */
// stand something against the round wall: a is the angle from +z towards +x (PI = straight back), d its distance in from the wall
function atWall(o, a, d = .4, y = 0) { o.position.set(Math.sin(a) * (WALL_R - d), y, Math.cos(a) * (WALL_R - d)); o.rotation.y = a + PI; return o; }
function shell(o) {
  const g = new THREE.Group();
  if (o.earth) g.add(D.mesh(new THREE.CircleGeometry(WALL_R + .4, 64).rotateX(-PI / 2), D.felt(o.earth, { fibre: .3, mottle: .35, scale: .8 })));
  else g.add(D.plankFloor(WALL_R + .4));
  g.add(D.shopWall(WALL_R, WALL_H, { a0: PI - 2.3, arc: 4.6, posts: o.posts ?? 6, color: o.wall }));
  g.add(D.mesh(new THREE.SphereGeometry(WALL_R, 48, 12, 0, TAU, 0, PI / 2), o.ceil, [0, WALL_H, 0], [1, .42, 1]));
  return g;
}
function fireplace(o = {}) {
  const g = new THREE.Group(), stone = D.felt(o.stone || '#cfc6b4', { fibre: .2, mottle: .3 });
  g.add(D.slab(D.archShape(2.6, 2.4), .5, stone, .06));
  g.add(D.slab(D.archShape(1.6, 1.6), .2, D.basic('#2b1d16'), 0).translateZ(.18));
  g.add(D.rbox(3.2, .18, .7, .05, D.wood('#8a5a36', { axis: 0 })).translateY(2.45).translateZ(.1));
  // stones stitched round the arch
  for (let i = 0; i < 9; i++) { const a = PI * i / 8; g.add(D.ball(D.felt(i % 2 ? '#bfb5a2' : '#d9d1c0', { fibre: .2 }), [Math.cos(a) * 1.05, .95 + Math.sin(a) * 1.05, .27], [.22, .17, .06], [0, 0, a], 12)); }
  // the fire: felt flames and a warm glow
  const fire = new THREE.Group(); fire.position.set(0, 0, .25); g.add(fire);
  for (let i = 0; i < 3; i++) fire.add(D.capsule(D.wood('#6b4a33', { axis: 1 }), [-.45 + i * .3, .1, -.1 + (i % 2) * .15], [-.2 + i * .3, .14, .1], .07, 8));
  [['#ff8a3a', .17, -.12, .62], ['#ff9a3a', .15, .16, .5], ['#ffc04a', .12, .02, .42], ['#ffe08a', .07, -.02, .26]].forEach(([c, r, dx, h], i) => fire.add(D.ball(D.glowMat(c, 1.3, { color: c }), [dx, .14 + h / 2, .05 + i * .03], [r, h / 2, r * .7], [0, 0, dx * -.6], 16)));
  const gl = D.glowSprite('#ffae5a', 1.8, .55); gl.position.set(0, .45, .3); fire.add(gl);
  return g;
}
function table(w = 2.2, d = 1.3, top = '#c08a58') {
  const g = new THREE.Group(), leg = D.wood('#8a5a36', { axis: 1 });
  g.add(D.rbox(w, .14, d, .05, D.wood(top, { axis: 0 })).translateY(1.0));
  for (const x of [-w / 2 + .18, w / 2 - .18]) for (const z of [-d / 2 + .18, d / 2 - .18]) g.add(D.lathe([[0, 0], [.09, 0], [.06, .3], [.08, .6], [.06, .93], [0, .93]], leg, 12).translateX(x).translateZ(z));
  return g;
}
function cloth(w, d, color, print) { return D.rbox(w, .03, d, .01, D.felt(color, { print })).translateY(1.085); }
function chair(color = '#8a5a36', seat = '#e2566b') {
  const g = new THREE.Group(), w = D.wood(color, { axis: 1 });
  g.add(D.rbox(.8, .1, .75, .03, D.wood(color, { axis: 0 })).translateY(.6));
  g.add(D.ball(D.felt(seat, { print: { kind: 'gingham', color: '#fff6e6', n: 4, scale: 2 } }), [0, .7, 0], [.36, .07, .33], [0, 0, 0], 16));
  for (const x of [-.33, .33]) for (const z of [-.3, .3]) g.add(D.rbox(.07, .6, .07, .02, w).translateX(x).translateY(.3).translateZ(z));
  for (const x of [-.33, .33]) g.add(D.rbox(.07, .8, .07, .02, w).translateX(x).translateY(1.0).translateZ(-.33));
  g.add(D.rbox(.72, .26, .05, .02, D.wood(color, { axis: 0 })).translateY(1.25).translateZ(-.33));
  return g;
}
function shelfBooks(w, rows, rowH, seed = 1) {
  // a bookcase as deep as a shelf: instanced books, so a whole wall of them costs a few draw calls
  const g = new THREE.Group(), r = D.rng(seed), wd = D.wood('#8a5a36', { axis: 0 });
  g.add(D.rbox(w, rows * rowH + .3, .1, .03, D.wood('#6b4a33', { axis: 1 })).translateY((rows * rowH + .3) / 2).translateZ(-.4));
  for (const sx of [-1, 1]) g.add(D.rbox(.16, rows * rowH + .3, .9, .04, wd).translateX(sx * w / 2).translateY((rows * rowH + .3) / 2));
  for (let k = 0; k <= rows; k++) g.add(D.rbox(w, .1, .9, .03, wd).translateY(.05 + k * rowH));
  const cols = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8', '#f6a6bd', '#c98a5a', '#5a8fc7'];
  const byCol = cols.map(() => []);
  for (let k = 0; k < rows; k++) {
    let x = -w / 2 + .14;
    while (x < w / 2 - .25) {
      const h = .55 + r() * .28, t = .1 + r() * .08, lean = r() < .08 ? .25 : 0;
      byCol[Math.floor(r() * cols.length)].push([x + t / 2, .1 + k * rowH + h / 2 * Math.cos(lean), -.05, t / .14, h, lean]);
      x += t + .015 + lean * .3;
    }
  }
  // one instanced mesh per colour; each book is the same spine stretched to its own thickness and height
  const bg = D.rbox(.14, 1, .6, .015, D.basic('#fff')).geometry, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  byCol.forEach((items, i) => {
    if (!items.length) return;
    const im = new THREE.InstancedMesh(bg, D.felt(cols[i], { fibre: .1 }), items.length);
    items.forEach(([x, y, z, sx, h, lean], j) => im.setMatrixAt(j, m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, 0, lean)), new THREE.Vector3(sx, h, 1))));
    g.add(im);
  });
  return g;
}
function dresser() {
  const g = new THREE.Group(), w = D.wood('#a8c4d9', { axis: 1 }), dark = D.wood('#7f9fb8', { axis: 0 });
  g.add(D.rbox(2.6, 1.2, .9, .05, w).translateY(.6));
  for (let i = 0; i < 2; i++) { g.add(D.rbox(1.15, .5, .05, .02, dark).translateX(-.62 + i * 1.24).translateY(.62).translateZ(.46)); g.add(D.bead(D.metal(D.PAL.gold), [-.62 + i * 1.24, .62, .5], .05)); }
  g.add(D.rbox(2.6, 2.0, .12, .03, w).translateY(2.2).translateZ(-.38));
  for (let k = 0; k < 2; k++) g.add(D.rbox(2.5, .08, .4, .02, dark).translateY(1.75 + k * .8).translateZ(-.18));
  // plates standing on the rails, and mugs
  const plate = D.lathe([[0, 0], [.3, 0], [.34, .04], [0, .02]], D.glaze('#ffffff', { rough: .2, speckle: .05 }), 32);
  for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) { const p = plate.clone(); p.rotation.x = PI / 2 - .25; p.position.set(-.9 + i * .6, 2.08 + k * .8, -.26); g.add(p); g.add(D.mesh(new THREE.TorusGeometry(.2, .02, 6, 24), D.glaze(['#7bb4d9', '#e2566b', '#8cc46c', '#ffd86b'][i]), [-.9 + i * .6, 2.08 + k * .8, -.235], 1, [-.25, 0, 0])); }
  return g;
}
function basketOf(make, n, s = 1) {
  const g = new THREE.Group(), b = D.wickerBasket({ liner: '#f6a6bd' }); b.scale.multiplyScalar(.8 * s); g.add(b);
  for (let i = 0; i < n; i++) { const c = make(); c.position.set(Math.cos(i * 2.4) * .25 * s, .45 * s + (i % 2) * .08, Math.sin(i * 2.4) * .2 * s); c.rotation.z = 1.2 + i * .3; g.add(c); }
  return g;
}
function carrot(s = 1) {
  const g = new THREE.Group();
  g.add(D.mesh(new THREE.ConeGeometry(.1, .42, 12), D.felt('#f08a3a'), [0, -.15, 0], 1, [PI, 0, 0]));
  for (let i = 0; i < 3; i++) g.add(D.mesh(D.SPH(8), D.felt('#5f9a62'), [Math.cos(i * 2.1) * .04, .14, Math.sin(i * 2.1) * .04], [.035, .14, .025], [Math.cos(i * 2.1) * .4, 0, Math.sin(i * 2.1) * .4]));
  g.scale.setScalar(s); return g;
}
function hangingBunch(make, n, drop = .8) {
  const g = new THREE.Group();
  g.add(D.yarn([[0, 0, 0], [0, -drop, 0]], .012, D.thread('#c9a676'), { seg: 6 }));
  for (let i = 0; i < n; i++) { const c = make(); c.position.set(Math.cos(i * 2.1) * .08, -drop - .2, Math.sin(i * 2.1) * .08); c.rotation.set(PI + Math.cos(i * 2.1) * .3, 0, Math.sin(i * 2.1) * .3); g.add(c); }
  return g;
}
function herb() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(D.ball(D.felt(i % 2 ? '#7cc06e' : '#5f9a62'), [Math.cos(i) * .06, -.1 - i * .07, Math.sin(i) * .06], [.06, .12, .03], [0, i, 0], 10)); return g; }
function frame(art, w = 1, h = .8) {
  const g = new THREE.Group();
  g.add(D.rbox(w + .18, h + .18, .08, .03, D.wood('#c99a4a', { axis: 0 })));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: art, roughness: .9 })); m.position.z = .05; g.add(m);
  return g;
}
// little felt-style pictures painted on a canvas (no text)
function picture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 200; const x = c.getContext('2d');
  if (kind === 'meadow') { x.fillStyle = '#bfe3ff'; x.fillRect(0, 0, 256, 200); x.fillStyle = '#8cc46c'; x.beginPath(); x.ellipse(80, 210, 180, 90, 0, 0, TAU); x.fill(); x.fillStyle = '#6aa858'; x.beginPath(); x.ellipse(220, 220, 150, 80, 0, 0, TAU); x.fill(); x.fillStyle = '#e2566b'; x.beginPath(); x.ellipse(150, 110, 40, 24, 0, PI, 0); x.fill(); x.fillStyle = '#fff1dc'; x.fillRect(140, 108, 20, 30); x.fillStyle = '#ffd86b'; x.beginPath(); x.arc(40, 40, 22, 0, TAU); x.fill(); }
  else if (kind === 'sea') { x.fillStyle = '#ffe0b0'; x.fillRect(0, 0, 256, 200); x.fillStyle = '#5a8fc7'; x.fillRect(0, 120, 256, 80); x.fillStyle = '#9a6a45'; x.beginPath(); x.moveTo(70, 130); x.lineTo(190, 130); x.lineTo(170, 155); x.lineTo(90, 155); x.fill(); x.fillStyle = '#fff7e6'; x.beginPath(); x.moveTo(130, 40); x.lineTo(130, 125); x.lineTo(185, 125); x.fill(); x.fillStyle = '#e2566b'; x.fillRect(128, 30, 4, 100); }
  else if (kind === 'flowers') { x.fillStyle = '#fff3dc'; x.fillRect(0, 0, 256, 200); x.fillStyle = '#7bb4d9'; x.beginPath(); x.moveTo(100, 190); x.lineTo(156, 190); x.lineTo(170, 120); x.lineTo(86, 120); x.fill(); ['#f6a6bd', '#ffd86b', '#e2566b', '#b9a6e8', '#ffffff'].forEach((col, i) => { const cx = 70 + i * 30, cy = 60 + (i % 2) * 25; x.fillStyle = col; for (let p = 0; p < 6; p++) { const a = p / 6 * TAU; x.beginPath(); x.arc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 9, 0, TAU); x.fill(); } x.fillStyle = '#e9a020'; x.beginPath(); x.arc(cx, cy, 7, 0, TAU); x.fill(); }); }
  else { x.fillStyle = '#2e3a5a'; x.fillRect(0, 0, 256, 200); x.fillStyle = '#fff6c0'; x.beginPath(); x.arc(180, 60, 30, 0, TAU); x.fill(); x.fillStyle = '#2e3a5a'; x.beginPath(); x.arc(195, 50, 28, 0, TAU); x.fill(); for (let i = 0; i < 18; i++) { x.fillStyle = '#fff6c0'; x.fillRect((i * 53) % 256, (i * 37) % 120, 3, 3); } x.fillStyle = '#4f8a52'; x.beginPath(); x.ellipse(128, 220, 200, 70, 0, 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ------------------------------------------------------------------ Mrs. Bunbury's burrow: a warm earthy kitchen */
function burrowRoom() {
  const g = shell({ earth: '#b88a5e', wall: '#efd3ac', ceil: D.felt('#c9a07a', { side: THREE.BackSide, mottle: .4, scale: .8 }), posts: 0 });
  // roots poking through the ceiling
  for (let i = 0; i < 9; i++) { const a = PI - 1.6 + i * .4, rr = 3 + (i % 3); g.add(D.taperTube([[Math.sin(a) * rr, WALL_H + 2.6, Math.cos(a) * rr], [Math.sin(a) * rr + .2, WALL_H + 1.2, Math.cos(a) * rr], [Math.sin(a) * rr - .1, WALL_H + .1 - (i % 2) * .5, Math.cos(a) * rr]], .12, .02, D.wood('#8a5f3c', { axis: 1 }), 12, 6)); }
  const fp = fireplace({ stone: '#d9cbb4' }); atWall(fp, PI + .1, .35); g.add(fp);
  const kettle = new THREE.Group(); kettle.add(D.lathe([[0, 0], [.3, 0], [.36, .2], [.28, .42], [.1, .48], [0, .5]], D.metal('#4a4048', { rough: .45 }), 24, { smooth: 12 })); kettle.add(D.mesh(new THREE.TorusGeometry(.22, .03, 6, 20, PI), D.metal('#4a4048'), [0, .48, 0])); kettle.add(D.capsule(D.metal('#4a4048'), [.28, .25, 0], [.5, .42, 0], .04, 8));
  kettle.position.set(-.8, 2.55, .2); fp.add(kettle);
  for (let i = 0; i < 3; i++) { const j = D.honeyJar(); j.scale.setScalar(.7); j.position.set(.5 + i * .45, 2.55, .2); fp.add(j); }
  const dr = dresser(); atWall(dr, PI - .62, .55); g.add(dr);
  const w = D.roundWindow({ r: .85, sky: '#cfeaff' }); atWall(w, PI + .78, .2, 3.0); g.add(w);
  const t = table(2.4, 1.4); t.position.set(-.4, 0, -2.6); g.add(t);
  g.add(cloth(2.5, 1.5, '#fff6e6', { kind: 'gingham', color: '#e2566b', n: 8, scale: 2 }).translateX(-.4).translateZ(-2.6));
  // a carrot cake and tea on the table
  const cake = new THREE.Group(); cake.add(D.lathe([[0, 0], [.45, 0], [.46, .32], [0, .32]], D.felt('#e0a35a', { mottle: .3 }), 32)); cake.add(D.lathe([[0, .3], [.47, .3], [.45, .42], [0, .44]], D.felt('#fff6e6'), 32, { smooth: 10 }));
  for (let i = 0; i < 6; i++) { const c = carrot(.4); c.position.set(Math.cos(i) * .3, .5, Math.sin(i) * .3); c.rotation.z = PI / 2; c.rotation.y = i; cake.add(c); }
  cake.position.set(-.6, 1.1, -2.6); g.add(cake);
  for (const [x, z] of [[-1.4, -2.3], [.6, -2.3]]) { const c = D.teacup(); c.scale.setScalar(.75); c.position.set(x, 1.1, z); g.add(c); }
  const c1 = chair('#8a5a36', '#7bb4d9'); c1.position.set(-2.1, 0, -2.8); c1.rotation.y = 1.3; g.add(c1);
  const bk = basketOf(() => carrot(1.1), 8); bk.position.set(3.4, 0, -3.6); g.add(bk);
  const bk2 = basketOf(() => carrot(1.1), 6, .85); bk2.position.set(4.2, 0, -2.6); g.add(bk2);
  // carrots and herbs drying on a beam
  g.add(D.capsule(D.wood('#6b4a33', { axis: 0 }), [-4.4, 4.6, -3.6], [4.4, 4.6, -3.6], .1, 10));
  for (let i = 0; i < 7; i++) { const b = hangingBunch(i % 2 ? herb : () => carrot(.9), 4, .5 + (i % 3) * .2); b.position.set(-3.6 + i * 1.2, 4.55, -3.6); g.add(b); }
  const rug = D.braidRug(2.2, { colors: ['#f6a6bd', '#ffd86b', '#8cc46c', '#fff6e6'] }); rug.position.set(0, .01, .2); g.add(rug);
  return g;
}

/* ------------------------------------------------------------------ Old Hoot's library inside the oak */
function oakRoom() {
  const g = shell({ wall: '#d9b48a', ceil: D.wood('#a8784e', { side: THREE.BackSide, axis: 1, freq: 5, grain: .8 }), posts: 0 });
  // tree rings on the floor under the planks' rug
  const rug = D.braidRug(2.4, { colors: ['#5a8fc7', '#ffd86b', '#e2566b', '#8cc46c'] }); rug.position.set(0, .01, .2); g.add(rug);
  // bookcases all round the back of the room
  [[PI - 1.25, 2.6], [PI - .42, 2.6], [PI + .42, 2.6], [PI + 1.25, 2.6]].forEach(([a, w], i) => { const b = shelfBooks(w, 4, 1.05, i + 3); atWall(b, a, .65); g.add(b); });
  // a ladder leaning on the shelves
  const lad = new THREE.Group(), lw = D.wood('#c08a58', { axis: 1 });
  for (const x of [-.35, .35]) lad.add(D.rbox(.09, 4.4, .09, .02, lw).translateX(x).translateY(2.2));
  for (let i = 0; i < 9; i++) lad.add(D.rbox(.7, .07, .07, .02, D.wood('#c08a58', { axis: 0 })).translateY(.35 + i * .46));
  lad.rotation.x = -.2; atWall(lad, PI - .85, 1.3); lad.rotation.x = -.18; g.add(lad);
  // reading desk with a candle, an open book and a globe
  const t = table(2.0, 1.1, '#9a6a45'); t.position.set(-.3, 0, -2.6); g.add(t);
  const open = new THREE.Group(); for (const s of [-1, 1]) open.add(D.rbox(.42, .03, .55, .01, D.paper('#fff6e6')).translateX(s * .22).rotateZ(s * -.08)); open.add(D.rbox(.9, .04, .6, .01, D.felt('#a33a3a')).translateY(-.03));
  open.position.set(-.4, 1.12, -2.5); g.add(open);
  const cd = D.candle(); cd.position.set(.4, 1.08, -2.8); g.add(cd);
  const globe = new THREE.Group(); globe.add(D.ball(D.felt('#7bb4d9', { print: { kind: 'dots', color: '#8cc46c', n: 5, scale: 2 } }), [0, .55, 0], .32, [0, 0, .4], 24)); globe.add(D.mesh(new THREE.TorusGeometry(.38, .025, 6, 32, PI), D.metal(D.PAL.gold), [0, .55, 0], 1, [0, 0, .4 + PI / 2])); globe.add(D.lathe([[0, 0], [.22, 0], [.05, .2], [0, .22]], D.wood('#6b4a33'), 16));
  globe.position.set(-1.5, 1.08, -2.8); g.add(globe);
  // Hoot's perch and an armchair
  const perch = new THREE.Group(); perch.add(D.lathe([[0, 0], [.4, 0], [.08, .15], [.06, 2.0], [0, 2.0]], D.wood('#6b4a33', { axis: 1 }), 16)); perch.add(D.capsule(D.wood('#8a5a36'), [-.6, 2.0, 0], [.6, 2.0, 0], .07, 10));
  perch.position.set(4.6, 0, -2.4); g.add(perch);
  const arm = armchair('#5a8fc7'); arm.position.set(-4.4, 0, -2.0); arm.rotation.y = .9; g.add(arm);
  [[3.2, -4.0, 5, 1], [-3.1, -4.3, 4, 3], [2.4, -1.6, 3, 5]].forEach(([x, z, n, s]) => { const st = new THREE.Group(), cols = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8']; for (let i = 0; i < n; i++) st.add(D.rbox(.62, .14, .46, .02, D.felt(cols[(i + s) % 5])).translateY(.07 + i * .15).rotateY((i * 7 % 5 - 2) * .08)); st.position.set(x, 0, z); g.add(st); });
  const w = D.roundWindow({ r: .7, sky: '#cfeaff' }); atWall(w, PI, .2, 4.6); g.add(w);
  const lamp = D.hangingLamp({ drop: 1.4 }); lamp.position.set(0, 7.4, -1.8); g.add(lamp);
  return g;
}

/* ------------------------------------------------------------------ her own house */
function bed() {
  const g = new THREE.Group(), w = D.wood('#c08a58', { axis: 1 });
  g.add(D.rbox(2.0, .5, 3.0, .06, D.wood('#c08a58', { axis: 2 })).translateY(.45));
  g.add(D.rbox(2.1, 1.7, .16, .05, w).translateY(.85).translateZ(-1.5));
  g.add(D.ball(w, [0, 1.75, -1.5], [1.05, .3, .08], [0, 0, 0], 24));
  g.add(D.rbox(2.1, .9, .14, .05, w).translateY(.6).translateZ(1.5));
  g.add(D.ball(D.felt('#fff6e6'), [0, .85, -1.0], [.75, .2, .35], [0, 0, 0], 24));
  // a patchwork quilt in squares
  const cols = ['#f6a6bd', '#ffd86b', '#7bb4d9', '#8cc46c', '#b9a6e8', '#ffffff'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { const sq = D.rbox(.52, .08, .4, .02, D.felt(cols[(i + j * 2) % 6], (i + j) % 3 ? {} : { print: { kind: 'dots', color: '#ffffff', n: 4, scale: 2 } })); sq.position.set(-.78 + i * .52, .75, -.4 + j * .38); g.add(sq); }
  g.add(D.rbox(2.15, .5, .06, .02, D.felt('#f6a6bd')).translateX(0).translateY(.55).translateZ(1.43));
  return g;
}
function wardrobe() {
  const g = new THREE.Group(), w = D.wood('#e9b6c4', { axis: 1 }), dark = D.wood('#d48aa2', { axis: 1 });
  g.add(D.rbox(2.0, 3.4, 1.0, .06, w).translateY(1.8));
  g.add(D.ball(w, [0, 3.55, 0], [1.05, .3, .5], [0, 0, 0], 24));
  for (const s of [-1, 1]) { g.add(D.rbox(.86, 2.6, .06, .03, dark).translateX(s * .46).translateY(1.9).translateZ(.52)); g.add(D.bead(D.metal(D.PAL.gold), [s * .12, 1.9, .58], .07)); g.add(D.mesh(new THREE.CircleGeometry(.22, 20), D.felt('#fff6e6', { print: { kind: 'dots', color: '#f6a6bd', n: 4, scale: 2 } }), [s * .46, 2.6, .56])); }
  for (const x of [-.8, .8]) g.add(D.rbox(.14, .3, .14, .03, D.wood('#8a5a36')).translateX(x).translateY(.15));
  return g;
}
function homeRoom() {
  const g = shell({ wall: '#fde6e0', ceil: D.felt('#fff1dc', { side: THREE.BackSide, scale: .8 }), posts: 0 });
  // wallpaper sprigs
  for (let i = 0; i < 40; i++) { const a = PI - 2.1 + (i % 20) / 19 * 4.2, y = 2.2 + Math.floor(i / 20) * 1.5 + (i % 2) * .5; const f = D.mesh(new THREE.CircleGeometry(.07, 8), D.felt(i % 3 ? '#f6a6bd' : '#8cc46c'), [Math.sin(a) * (WALL_R - .02), y, Math.cos(a) * (WALL_R - .02)], 1, [0, a + PI, 0]); g.add(f); }
  const fp = fireplace({ stone: '#e9ddc8' }); atWall(fp, PI - .32, .35); g.add(fp);
  const clock = D.candle(); clock.position.set(-.9, 2.55, .2); fp.add(clock);
  const v = D.flowerVase(); v.scale.setScalar(.9); v.position.set(.9, 2.55, .2); fp.add(v);
  const b = bed(); b.position.set(-3.7, 0, -3.5); b.rotation.y = .7; g.add(b);
  const wr = wardrobe(); atWall(wr, PI + .38, .7); g.add(wr);
  const w = D.roundWindow({ r: .72, sky: '#cfeaff' }); atWall(w, PI + .78, .3, 3.5); g.add(w);
  const t = table(1.8, 1.2, '#d0a473'); t.position.set(2.6, 0, -2.4); g.add(t);
  g.add(cloth(1.9, 1.3, '#fff6e6', { kind: 'gingham', color: '#7bb4d9', n: 7, scale: 2 }).translateX(2.6).translateZ(-2.4));
  const c1 = chair('#d0a473', '#f6a6bd'); c1.position.set(3.9, 0, -2.2); c1.rotation.y = -1.4; g.add(c1);
  const rug = D.braidRug(2.0, { colors: ['#f6a6bd', '#ffd86b', '#b9a6e8', '#8cc46c'] }); rug.position.set(-.2, .01, -.6); g.add(rug);
  const lamp = D.hangingLamp({ drop: 1.4 }); lamp.position.set(.4, 7.4, -1.6); g.add(lamp);
  return g;
}

export function buildRoom(id) {
  const g = id === 'burrow' ? burrowRoom() : id === 'oak' ? oakRoom() : homeRoom();
  D.freeze(g); g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

/* ------------------------------------------------------------------ home things from Tansy, and where they go in her house */
function armchair(color = '#e2566b') {
  const g = new THREE.Group(), f = D.felt(color, { print: { kind: 'dots', color: '#ffffff', n: 6, scale: 3 } });
  g.add(D.rbox(1.5, .5, 1.3, .2, f).translateY(.45));
  g.add(D.rbox(1.5, 1.3, .35, .18, f).translateY(1.0).translateZ(-.5));
  for (const s of [-1, 1]) g.add(D.ball(f, [s * .72, .85, .05], [.2, .25, .62], [0, 0, 0], 20));
  g.add(D.ball(D.felt('#fff6e6'), [0, .78, .1], [.55, .1, .45], [0, 0, 0], 20));
  for (const x of [-.6, .6]) for (const z of [-.5, .5]) g.add(D.lathe([[0, 0], [.07, 0], [.06, .22], [0, .22]], D.wood('#6b4a33'), 10).translateX(x).translateZ(z));
  return g;
}
export const HOME_MODELS = {
  plant() { const g = new THREE.Group(); g.add(D.lathe([[0, 0], [.32, 0], [.42, .6], [.46, .65], [0, .62]], D.glaze('#e2836a'), 24)); g.add(D.mesh(new THREE.CircleGeometry(.4, 20).rotateX(-PI / 2), D.felt('#6b4a33'), [0, .6, 0])); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, h = .9 + (i % 3) * .35; g.add(D.tube([[0, .6, 0], [Math.cos(a) * .2, .6 + h * .6, Math.sin(a) * .2], [Math.cos(a) * .5, .6 + h, Math.sin(a) * .5]], .025, D.felt('#5f9a62'), 8, 4)); g.add(D.ball(D.felt(i % 2 ? '#7cc06e' : '#5f9a62'), [Math.cos(a) * .52, .6 + h, Math.sin(a) * .52], [.26, .05, .14], [0, -a, .4], 12)); } return g; },
  teaset() { const g = new THREE.Group(), china = D.glaze('#ffffff', { rough: .18, speckle: .05 }), rose = D.glaze('#f2a7b5'); g.add(D.lathe([[0, 0], [.22, 0], [.34, .18], [.3, .4], [.14, .48], [0, .5]], china, 32, { smooth: 14 })); g.add(D.mesh(new THREE.CylinderGeometry(.28, .3, .06, 32), rose, [0, .2, 0])); g.add(D.ball(rose, [0, .56, 0], .07)); g.add(D.taperTube([[.3, .2, 0], [.48, .32, 0], [.56, .48, 0]], .06, .03, china, 10, 8)); g.add(D.mesh(new THREE.TorusGeometry(.14, .03, 8, 20, PI * 1.2), rose, [-.32, .3, 0], 1, [0, 0, PI * .4])); for (const [x, z] of [[.6, .35], [-.5, .45]]) { const c = D.teacup(); c.scale.setScalar(.7); c.position.set(x, 0, z); g.add(c); } return g; },
  painting() { return frame(picture('meadow'), 1.5, 1.15); },
  armchair() { return armchair('#e2566b'); },
  lamp() { const g = new THREE.Group(); g.add(D.lathe([[0, 0], [.35, 0], [.3, .08], [.06, .14], [.05, 2.0], [0, 2.0]], D.wood('#8a5a36', { axis: 1 }), 16)); g.add(D.lathe([[.22, 2.55], [.55, 1.95], [.6, 1.9], [.25, 2.5]], D.felt('#ffd86b', { side: THREE.DoubleSide, print: { kind: 'stripes', color: '#fff6e6', n: 10, w: .4, scale: 2 } }), 32)); g.add(D.ball(D.glowMat('#ffd27a', 1.5, { color: '#fff3d0' }), [0, 2.05, 0], .14, [0, 0, 0], 14)); const s = D.glowSprite('#ffcf7a', 2.4, .6); s.position.y = 2.1; g.add(s); return g; },
  clock() { const g = new THREE.Group(), w = D.wood('#8a5a36', { axis: 1 }); g.add(D.rbox(.9, 3.0, .6, .05, w).translateY(1.5)); g.add(D.ball(w, [0, 3.1, 0], [.5, .35, .3], [0, 0, 0], 24)); g.add(D.mesh(new THREE.CircleGeometry(.34, 32), D.felt('#fff6e6'), [0, 2.55, .31])); g.add(D.mesh(new THREE.TorusGeometry(.35, .04, 8, 32), D.metal(D.PAL.gold), [0, 2.55, .32])); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(D.bead(D.felt('#4a3428'), [Math.sin(a) * .27, 2.55 + Math.cos(a) * .27, .33], .025)); } const hand = new THREE.Group(); hand.name = 'clockHand'; hand.userData.live = true; hand.position.set(0, 2.55, .34); hand.add(D.rbox(.03, .22, .02, .005, D.felt('#2e2650')).translateY(.1)); g.add(hand); g.add(D.rbox(.03, .15, .02, .005, D.felt('#2e2650')).translateX(.06).translateY(2.6).translateZ(.34).rotateZ(-1)); g.add(D.rbox(.5, 1.2, .04, .02, D.glossy('#3a2a20', { rough: .2 })).translateY(1.25).translateZ(.31)); const pend = new THREE.Group(); pend.name = 'clockPend'; pend.userData.live = true; pend.position.set(0, 1.85, .34); pend.add(D.capsule(D.metal(D.PAL.gold), [0, 0, 0], [0, -.7, 0], .015, 6)); pend.add(D.mesh(new THREE.CylinderGeometry(.14, .14, .03, 20), D.metal(D.PAL.gold), [0, -.75, 0], 1, [PI / 2, 0, 0])); g.add(pend); return g; },
  dollhouse() { const g = new THREE.Group(); g.scale.setScalar(.82); g.add(D.rbox(1.6, .1, 1.0, .03, D.wood('#c08a58')).translateY(.05)); g.add(D.rbox(1.4, 1.1, .8, .04, D.felt('#fff3dc')).translateY(.65)); const roof = D.mesh(new THREE.ConeGeometry(1.1, .7, 4), D.felt('#e2566b', { print: { kind: 'stripes', color: '#f6a6bd', n: 6, w: .4, scale: 2 } }), [0, 1.55, 0], [1, 1, .7], [0, PI / 4, 0]); g.add(roof); g.add(D.rbox(.3, .5, .04, .02, D.wood('#7bb4d9')).translateY(.35).translateZ(.42)); for (const x of [-.45, .45]) { g.add(D.mesh(new THREE.PlaneGeometry(.3, .3), D.glowMat('#ffd98a', .5, { color: '#ffe9b8' }), [x, .85, .41])); g.add(D.rbox(.36, .04, .04, .01, D.wood(D.PAL.woodFrame)).translateX(x).translateY(.85).translateZ(.43)); } const m = D.ball(D.felt('#d9d2c8'), [.45, .35, .45], [.1, .12, .1], [0, 0, 0], 12); g.add(m); for (const s of [-1, 1]) g.add(D.ball(D.felt('#f6a6bd'), [.45 + s * .07, .48, .45], .045, [0, 0, 0], 10)); return g; },
  canopy() { const g = new THREE.Group(), w = D.wood('#c08a58', { axis: 1 }); for (const x of [-1, 1]) for (const z of [-1.45, 1.45]) g.add(D.rbox(.1, 3.2, .1, .02, w).translateX(x).translateY(1.6).translateZ(z)); const cl = D.felt('#fff6e6', { side: THREE.DoubleSide, print: { kind: 'dots', color: '#f6a6bd', n: 8, scale: 3 } }); g.add(D.rbox(2.2, .12, 3.1, .04, D.felt('#f6a6bd')).translateY(3.2)); for (const s of [-1, 1]) for (const z of [-1.45, 1.45]) { g.add(D.mesh(D.lumpy(D.SPH(20), .04, 3, s + z + 5), cl, [s * 1.0, 2.45, z], [.13, .8, .07])); g.add(D.mesh(new THREE.TorusGeometry(.13, .03, 6, 16), D.felt('#f6a6bd'), [s * 1.0, 2.0, z], [1, 1, .6], [PI2, 0, 0])); } const bc = D.buntingCord([[-1.05, 3.05, 1.5], [0, 2.75, 1.52], [1.05, 3.05, 1.5]], { n: 6 }); g.add(bc); return g; },
};
// where each one goes in her house: [x, y, z, yaw] (painting hangs on the wall; canopy goes over the bed)
export const HOME_SPOTS = {
  plant: [-1.75, 0, -5.2, .3], teaset: [2.6, 1.1, -2.45, -.3], painting: [0, 0, 0, 0], armchair: [.15, 0, -3.7, -.35],
  lamp: [-.95, 0, -4.7, 0], clock: [4.55, 0, -4.4, -1.0], dollhouse: [4.1, 0, -1.6, -.9], canopy: [0, 0, 0, 0],
};
export function placeHome(id, o) {
  if (id === 'painting') { atWall(o, PI + .02, .08, 3.95); return o; }
  if (id === 'canopy') { o.position.set(-3.7, 0, -3.5); o.rotation.y = .7; return o; }
  const [x, y, z, ry] = HOME_SPOTS[id]; o.position.set(x, y, z); o.rotation.y = ry; return o;
}
// the picture on Tansy's stall: the canopy is shown over a little bed, so it reads as a bed canopy
export const HOME_THUMB = id => id === 'canopy' ? (() => { const g = new THREE.Group(); g.add(bed()); g.add(HOME_MODELS.canopy()); return g; })() : HOME_MODELS[id] ? HOME_MODELS[id]() : new THREE.Group();
export const HOME_ORDER = ['plant', 'teaset', 'painting', 'armchair', 'lamp', 'clock', 'dollhouse', 'canopy'];
