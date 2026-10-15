// The Toadstool Shop in felt 3D (felt3d.js: felt fibre, stitches, embroidery, wood grain, soft shadows).
// The game (rules, touch, saves, voice, cards) lives in index.html's DOM. It describes what should be on screen in
// window.TSV (scene, stock, who is standing where, decorations, where the free space above the panel is), and this
// module draws that every frame. It also bakes still pictures of the goods, coins and characters for the panels.
// If WebGL or this module fails, the game keeps its plain look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as D from './felt3d.js';

const G = window;
const V = () => G.TSV || {};
const TAU = Math.PI * 2;
const calm = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches);
const touch = (navigator.maxTouchPoints || 0) > 1;
// the game's own state, read only (top-level consts of the classic script are visible here by name)
const game = () => { try { return S; } catch (e) { return null; } }; // eslint-disable-line no-undef
const castOf = spec => { try { for (const [id, c] of Object.entries(CAST)) if (c.spec === spec || JSON.stringify(c.spec) === JSON.stringify(spec)) return id; } catch (e) {} return spec && spec.apron ? 'keeper' : null; }; // eslint-disable-line no-undef

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
R.setClearColor(0x000000, 0);
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.NeutralToneMapping;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.insertBefore(canvas, document.body.firstChild);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, .1, 300);
const outside = new THREE.Group(), inside = new THREE.Group();
scene.add(outside, inside);

/* ------------------------------------------------------------------ light rig, sky and image-based light, per time of day */
const P = { morning: D.PRESETS.morning, evening: D.PRESETS.evening, inside: D.PRESETS.inside };
const L = D.lightRig(scene, P.morning);
L.key.shadow.mapSize.set(1024, 1024); L.key.shadow.bias = -.0008; L.key.shadow.normalBias = .04; L.key.shadow.radius = 4;
const sky = D.skyDome(P.morning.sky); scene.add(sky);
const pmrem = new THREE.PMREMGenerator(R), envs = {};
const glows = []; // sprites and points that brighten at dusk
let preset = '', focusC = new THREE.Vector3(0, 1.4, 1), focusR = 8;
function setPreset(k) {
  if (k === preset) return; preset = k;
  const p = P[k];
  L.hemi.color.set(p.hemi[0]); L.hemi.groundColor.set(p.hemi[1]); L.hemi.intensity = p.hemi[2];
  for (const n of ['key', 'fill', 'rim']) { L[n].color.set(p[n][0]); L[n].intensity = p[n][1]; }
  if (p.sky) { sky.visible = true; const u = sky.material.uniforms; u.top.value.set(p.sky[0]); u.mid.value.set(p.sky[1]); u.bot.value.set(p.sky[2]); scene.background = null; }
  else { sky.visible = false; scene.background = new THREE.Color(p.bg); }
  // every scene keeps a fog (far away inside) so all looks share the same compiled shaders
  scene.fog = new THREE.Fog(p.fog || p.bg, p.fog ? 38 : 80, p.fog ? 120 : 300);
  if (!envs[k]) envs[k] = pmrem.fromScene(D.envScene(p), .02).texture;
  scene.environment = envs[k]; scene.environmentIntensity = p.env;
  R.toneMappingExposure = p.exposure;
  const g = p.glow;
  for (const m of D.GLOWS) m.emissiveIntensity = m.userData.glowBase * g;
  for (const s of glows) s.material.opacity = Math.min(1, s.userData.glowBase * Math.max(0, g - .3));
  aimLights();
}
function aimLights() {
  const p = P[preset];
  for (const n of ['key', 'fill', 'rim']) { const l = L[n], d = new THREE.Vector3(...p[n][2]).normalize(); l.position.copy(focusC).addScaledVector(d, 40); l.target.position.copy(focusC); l.target.updateMatrixWorld(); }
  const sc = L.key.shadow.camera; sc.left = sc.bottom = -focusR; sc.right = sc.top = focusR; sc.near = 20; sc.far = 62; sc.updateProjectionMatrix();
}
function collectGlows(root) { root.traverse(o => { if (o.userData.glowSprite && !glows.includes(o)) glows.push(o); }); }

/* ------------------------------------------------------------------ goods (about half a unit tall, base at y=0) */
const GOOD_MODELS = {
  bun: () => D.acornBun(), apple: () => D.apple(), honey: () => D.honeyJar(), tart: () => D.berryTart(),
  biscuit: () => D.biscuit(), candle: () => D.candle(), seeds: () => D.seedPacket(), teacup: () => D.teacup(),
};
const goodModel = id => D.withLod(.6, GOOD_MODELS[id] || GOOD_MODELS.bun);

/* ------------------------------------------------------------------ outside: the meadow and the toadstool shop */
const H0 = new THREE.Vector3(0, 0, -3); // the house's foot
const decor = {}; // decor id -> object(s) to show when owned
let signMat = null, signText = '';
const parts = { evening: [], morning: [] };
(function buildOutside() {
  const env = new THREE.Group(); env.userData.noCast = true;
  env.add(D.ground(60, D.PAL.grass));
  [[-30, -40, 22, '#79b25e'], [10, -55, 30, '#6fa756'], [40, -35, 20, '#82bb63'], [-55, -20, 18, '#74ad5a']]
    .forEach(([x, z, r, c], i) => env.add(D.mesh(D.lumpy(D.SPH(32), .04, .8, i), D.felt(c, { scale: .5, mottle: .3 }), [x, -r * .55, z], [r, r * .8, r * .7])));
  const trees = [[-9, -8, 1.3], [-6.5, -12, 1.6], [8.5, -9, 1.4], [11, -14, 1.7], [-12, -3, 1.1], [13, -4, 1.2], [-4, -16, 1.5], [5, -17, 1.6]];
  trees.forEach(([x, z, s], i) => { const t = D.tree(s, i % 2 ? '#4f8a52' : '#3f7a4a', i + 1); t.position.set(x, 0, z); env.add(t); });
  [[-4.3, -.5], [4.6, -1.5], [-6, 2], [6.5, 1.5]].forEach(([x, z], i) => { const m = D.toadstool(D.PAL.toadRed, .7); m.position.set(x, 0, z); m.rotation.y = i; env.add(m); });
  [[0, 2.6], [.3, 3.6], [-.1, 4.7], [.25, 5.9]].forEach(([x, z], i) => { const st = D.stepStone(1, i + 3); st.position.set(x, 0, z); env.add(st); });
  const house = D.toadstoolShop({ sign: false, lantern: false, boxes: false }); house.position.copy(H0); env.add(house);
  D.freeze(env); env.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); outside.add(env);
  decor.windowboxes = []; env.traverse(o => { if (o.name === 'part:windowboxes') decor.windowboxes.push(o); });
  // flowers and grass (instanced)
  const r = D.rng(12), fl = [];
  for (let i = 0; i < 40; i++) { const a = r() * TAU, rr = 5.5 + r() * 9; fl.push({ p: [Math.cos(a) * rr, .35, Math.sin(a) * rr * .7], s: .7 + r() * .5, ry: r() * 6 }); }
  ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'].forEach((c, i) => { const f = D.feltFlower(c, 1, { stem: true, lite: true }); const sc = D.scatter(f, fl.filter((_, j) => j % 4 === i)); sc.traverse(o => { if (o.isMesh) o.castShadow = false; }); outside.add(sc); });
  outside.add(D.grassTufts(touch ? 900 : 1300, [-18, 18, -12, 8], '#6aa858'));
  // Bramble's cart
  const cart = D.cart(); cart.position.set(4.6, 0, .4); cart.rotation.y = -.35; outside.add(cart); outside.userData.cart = cart;
  // a basket of apples by the door in the daytime; at dusk a stump with the savings jar
  const bk = new THREE.Group(); bk.position.set(-.55, 0, 2.5); bk.rotation.y = .4;
  bk.add(D.wickerBasket({ size: .62, liner: '#e2566b', handle: true }));
  // the basket scales itself by size, so its liner floor sits at about y .07 and its rim at about .24 here
  [[-.12, .07, -.06, 0], [.13, .07, -.05, 2.1], [.0, .07, .13, 4.2], [.01, .16, .01, 1]].forEach(([x, y, z, ry], i) => { const a = D.apple({ seed: i + 3 }); a.scale.setScalar(.5); a.position.set(x, y, z); a.rotation.set(i === 3 ? .25 : 0, ry, 0); bk.add(a); });
  D.freeze(bk); outside.add(bk); parts.morning.push(bk);
  const stump = D.treeStump(); stump.position.set(-.45, 0, 2.45); outside.add(stump); parts.evening.push(stump);
  outside.userData.stump = stump;
  // butterflies by day, fireflies at dusk
  outside.userData.flies = [D.butterfly('#f6a6bd', '#ffd86b'), D.butterfly('#b9a6e8', '#fff3cf')];
  outside.userData.flies.forEach(b => { outside.add(b); parts.morning.push(b); });
  // kept off the front of the stage (where the keeper and visitors stand) so none drifts across a face
  const ff = []; for (let k = 0; ff.length < 14 && k < 400; k++) { const a = r() * TAU, rr = 3 + r() * 6, p = new THREE.Vector3(Math.cos(a) * rr, .6 + r() * 2.2, Math.sin(a) * rr * .6 + 1); if (p.z > -1 && Math.abs(p.x) < 5.8) continue; ff.push(p); }
  const fireflies = D.glowPoints(ff, ['#d8ff8a', '#fff3a0'], .55, .9); outside.add(fireflies); parts.evening.push(fireflies); outside.userData.fireflies = fireflies;
  // decorations bought with the savings jar
  const stemR = y => y < .25 ? 2.72 : y < 1.6 ? 2.72 + (2.5 - 2.72) * (y - .25) / 1.35 : y < 3.2 ? 2.5 + (2.25 - 2.5) * (y - 1.6) / 1.6 : 2.25 + (1.95 - 2.25) * (y - 3.2) / 1.2;
  const sign = new THREE.Group(); sign.position.set(0, 3.42, H0.z + stemR(3.42) + .22); sign.rotation.x = -.12;
  sign.add(D.rbox(2.5, .74, .12, .04, D.wood('#9a6a45', { axis: 0 })));
  for (const sx of [-1, 1]) sign.add(D.yarn([[sx * 1.0, .37, 0], [sx * 1.0, .72, -.14]], .012, D.thread('#c9a676'), { seg: 10 }));
  D.freeze(sign);
  signMat = new THREE.MeshStandardMaterial({ roughness: .85 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .52), signMat); face.position.z = .075; sign.add(face);
  decor.sign = [sign];
  const aw = D.awning({ w: 2.1 }); aw.scale.set(1, .62, .62); aw.position.set(0, 2.98, H0.z + stemR(2.9) + .1); decor.awning = [aw];
  decor.lanterns = [-1, 1].map(sx => { const l = D.lanternPost(); l.position.set(sx * 1.45, 0, H0.z + 3.0); l.rotation.y = sx < 0 ? Math.PI : 0; return l; });
  const bpts = []; // flags hanging in swags under the cap rim, across the front
  for (let i = 0; i <= 24; i++) { const a = -1.15 + i / 24 * 2.3, k = (i % 6) / 6; bpts.push(new THREE.Vector3(Math.sin(a) * 4.7, 4.32 - Math.sin(k * Math.PI) * .42, Math.cos(a) * 4.7 + H0.z)); }
  decor.bunting = [D.buntingCord(bpts, { n: 20 })];
  for (const k of ['sign', 'awning', 'lanterns', 'bunting']) decor[k].forEach(o => outside.add(o));
  collectGlows(outside);
})();
function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 152; const x = c.getContext('2d');
  x.fillStyle = '#fff3dc'; x.fillRect(0, 0, 640, 152);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(120,90,60,${Math.random() * .06})`; x.fillRect(Math.random() * 640, Math.random() * 152, 1 + Math.random() * 6, 1); }
  x.strokeStyle = '#c98a5a'; x.lineWidth = 8; x.setLineDash([16, 10]); x.strokeRect(12, 12, 616, 128); x.setLineDash([]);
  x.fillStyle = '#7a3d2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const font = s => `bold ${s}px "Chalkboard SE","Comic Sans MS","Comic Neue",Georgia,serif`;
  let fs = 74; x.font = font(fs);
  while (x.measureText(text).width > 560 && fs > 26) { fs -= 4; x.font = font(fs); }
  x.fillText(text, 320, 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ------------------------------------------------------------------ inside: the shop floor */
const SHELF = {}; // good id -> group of instanced meshes
const SLOT = { bun: [0, 0], apple: [0, 1], tart: [1, 0], honey: [1, 1], biscuit: [2, 0], candle: [2, 1], seeds: [1, 2], teacup: [2, 2] };
const SHELF_Z = -5.4, SHELF_BASE = 1.45, ROW_H = 1.3;
let board = null, boardKey = '';
(function buildInside() {
  const room = new THREE.Group(); room.userData.noCast = true;
  room.add(D.plankFloor(9));
  room.add(D.shopWall(8.5, 7, { a0: Math.PI - 2.4, arc: 4.8, posts: 7 }));
  room.add(D.gillCeiling(8.5, 7));
  const sh = D.shelves({ edge: '#f6a6bd' }); sh.position.set(0, 0, SHELF_Z); room.add(sh);
  const w = D.roundWindow(); w.position.set(-6.9, 3.6, -4.6); w.rotation.y = .98; room.add(w);
  const dr = D.archDoor({ light: '#fff1c8' }); dr.position.set(6.6, 0, -5.2); dr.rotation.y = -.9; room.add(dr);
  const lamp = D.hangingLamp({ drop: 1.7 }); lamp.position.set(0, 7.6, -2.6); room.add(lamp);
  // three sweet jars in the empty bay (bottom right)
  for (let i = 0; i < 3; i++) { const j = D.sweetJar(['#f6a6bd', '#ffd86b', '#b9a6e8'][i]); j.position.set(2.75 + i * .75, SHELF_BASE + .07, SHELF_Z + .1); room.add(j); }
  D.freeze(room); room.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); inside.add(room);
  // the counter with the till, a basket and a chalk board of today's prices (these cast shadows)
  const ct = new THREE.Group();
  const counter = D.counter(); counter.position.set(0, 0, -2.6); ct.add(counter);
  const tl = D.till(); tl.position.set(-2, 1.12, -2.55); tl.rotation.y = .12; ct.add(tl);
  const bk = D.wickerBasket({ liner: '#7bb4d9' }); bk.scale.multiplyScalar(.75); bk.position.set(2.2, 1.12, -2.6); ct.add(bk);
  D.freeze(ct); inside.add(ct);
  board = { mat: new THREE.MeshStandardMaterial({ roughness: .95 }) };
  const cb = D.chalkBoard(board.mat); cb.scale.setScalar(1.15); cb.position.set(-3.45, 1.12 + .74, -2.35); cb.rotation.set(-.1, .3, 0); inside.add(cb);
  // shelf stock: up to 10 of each good, two rows of five
  for (const id of Object.keys(GOOD_MODELS)) {
    const [row, col] = SLOT[id] || [0, 0];
    const x0 = (col - 1) * 3.55 - 1.24, y = SHELF_BASE + .07 + row * ROW_H, items = [];
    for (let i = 0; i < 10; i++) items.push({ p: [x0 + (i % 5) * .62 + (i >= 5 ? .31 : 0), y, SHELF_Z + .25 - (i >= 5 ? .5 : 0)], s: 1.15, ry: ((i * 1.7) % 1 - .5) * .8 });
    const g = D.scatter(goodModel(id), items); g.traverse(o => { if (o.isMesh) o.castShadow = false; }); g.userData.n = -1; SHELF[id] = g; inside.add(g);
  }
  // decorations
  const vase = D.flowerVase(); vase.position.set(.9, 1.12, -2.5); decor.vase = [vase];
  const rug = D.braidRug(2.2, { colors: ['#e2566b', '#ffd86b', '#7bb4d9', '#f6a6bd'] }); rug.position.set(1.0, 0, .3); decor.rug = [rug];
  // the bell hangs from a little post at the end of the counter, where every framing (portrait too) can see it;
  // by the door it was hidden behind the shelves, and the door itself is off screen in portrait
  const bell = new THREE.Group(); bell.position.set(3.25, 1.12, -2.95); bell.rotation.y = -.25;
  bell.add(D.rbox(.4, .1, .4, .03, D.wood('#6b4a33')).translateY(.05));
  bell.add(D.rbox(.14, 1.1, .14, .03, D.wood('#8a5a36', { axis: 1 })).translateY(.6));
  const b = D.doorBell(); b.scale.setScalar(1.25); b.position.set(0, .05, .08); bell.add(b); decor.bell = [bell];
  // front left of the counter, inside even a portrait iPad's view (further left it was off screen)
  const cat = D.catBed(); cat.scale.setScalar(.85); cat.position.set(-2.45, 0, .7); cat.rotation.y = .5; decor.catbed = [cat];
  // swags under the middle shelf's front edge, one per bay (up by the ceiling they were out of the camera's view)
  const fp = []; for (let i = 0; i <= 36; i++) { const x = -5.3 + i / 36 * 10.6, k = (i % 12) / 12; fp.push([x, SHELF_BASE + ROW_H - .06 - Math.sin(k * Math.PI) * .42, SHELF_Z + .55]); }
  const lights = D.fairyLights(fp, { n: 36 }); decor.fairylights = [lights];
  for (const k of ['vase', 'rug', 'bell', 'catbed', 'fairylights']) decor[k].forEach(o => inside.add(o));
  collectGlows(inside);
})();
decor.shopcat = [];
function boardRows() {
  const st = V().stock || {}, rows = [];
  for (const id of Object.keys(SLOT)) if ((st[id] | 0) > 0) {
    let name = id, price = 0;
    try { name = GOODS[id].one; price = priceOf(id); } catch (e) { return null; } // eslint-disable-line no-undef
    rows.push([name[0].toUpperCase() + name.slice(1), price + '¢', ['#ffd86b', '#ff9aa8', '#a9e8ff', '#b8f0c8'][rows.length % 4]]);
  }
  return rows.slice(0, 5);
}

/* ------------------------------------------------------------------ characters */
// extra felt styling per cast member (the game's specs give species and colours)
const STYLE = {
  clover: { print: { kind: 'dots', color: '#ffffff', n: 8, r: .1, scale: 3 }, collar: '#fffaf2' },
  dot: { print: { kind: 'dots', color: '#ffffff', n: 7, r: .14, scale: 3 } },
  tansy: { print: { kind: 'flowers', color: '#ffffff', color2: '#ffd86b', leaf: '#8fc98a', scale: 2.8, n: 4 }, stripes: '#7a808a', lashes: true },
  miu: { eye: '#3a5a2a' },
  hazel: { apron: '#fff6ec' },
  bramble: { cap: true },
};
function makeModel(spec) {
  const id = castOf(spec);
  if (id === 'keeper') return D.poppy({ fur: spec.fur, dress: spec.dress, bow: spec.bowColor || '#ffffff' });
  if (id === 'bunbury') return D.bunbury({ fur: spec.fur, dress: spec.dress });
  if (id === 'bramble') return D.bramble({ fur: spec.fur, spikes: spec.spikes, scarf: spec.scarf });
  return D.critter(spec, { ...(STYLE[id] || {}), name: id || spec.species });
}
// Frees the GPU buffers (and the big vertex arrays) of a model that is no longer needed. Shapes shared by the kit,
// or still drawn somewhere in the scene, are kept.
function disposeModel(obj) {
  const live = new Set(); scene.traverse(m => { if (m.geometry) live.add(m.geometry); });
  obj.traverse(m => { if (m.geometry && !live.has(m.geometry) && !D.isSharedGeo(m.geometry)) m.geometry.dispose(); });
}
// One model per look. The cast is fixed, but the keeper can be tried in 20 fur/dress looks on the meet screen,
// so only the two most recent keeper looks stay cached (each model is several MB of vertices).
const modelCache = new Map(), castKeys = new Set(), keeperKeys = [];
try { for (const c of Object.values(CAST)) castKeys.add(JSON.stringify(c.spec)); } catch (e) {} // eslint-disable-line no-undef
function model(spec) {
  const key = JSON.stringify(spec);
  if (!modelCache.has(key)) {
    modelCache.set(key, makeModel(spec));
    if (!castKeys.has(key)) {
      keeperKeys.push(key);
      while (keeperKeys.length > 2) { const old = keeperKeys.shift(); const o = modelCache.get(old); modelCache.delete(old); if (o) disposeModel(o); }
    }
  }
  return modelCache.get(key);
}
function animCritter(o, t) {
  const u = o.userData, k = t + u.t0, m = u.mood, A = calm ? .3 : 1;
  const walk = m === 'walk', happy = m === 'happy';
  u.body.position.y = walk ? Math.abs(Math.sin(k * 9)) * .1 : happy ? Math.abs(Math.sin(k * 7)) * .25 * A : Math.sin(k * 2) * .02 * A;
  u.body.rotation.z = walk ? Math.sin(k * 9) * .05 : Math.sin(k * 1.3) * .02 * A;
  u.head.rotation.z = m === 'think' ? .22 + Math.sin(k * 2) * .04 * A : Math.sin(k * .9) * .06 * A;
  u.head.rotation.x = m === 'talk' ? Math.sin(k * 9) * .05 : Math.sin(k * .7) * .04 * A;
  let l = -.12 - Math.sin(k * 1.4) * .06 * A, r = .12 + Math.sin(k * 1.6) * .06 * A, rx = 0;
  if (walk) { l = Math.sin(k * 9) * .4; r = -l; }
  if (happy) { l = -1.9 + Math.sin(k * 10) * .3 * A; r = 1.9 - Math.sin(k * 10) * .3 * A; }
  if (m === 'wave') r = 2.2 + Math.sin(k * 8) * .4;
  if (m === 'give') { r = .9; rx = -1.0; }
  if (u.kind === 'fairy') {
    const flap = Math.sin(k * (happy ? 22 : 12)) * (calm ? .3 : 1);
    if (u.wl) { u.wl.rotation.y = -.5 - flap * .35; u.wr.rotation.y = .5 + flap * .35; }
    if (u.star) u.star.rotation.y = k * 2;
    if (!happy && !walk) { r = .35 + Math.sin(k * 1.6) * .08 * A; rx = -.5; }
  }
  u.armL.rotation.z = l; u.armR.rotation.z = r; u.armR.rotation.x = rx;
}

/* ------------------------------------------------------------------ the people in the scene */
// [x, y, z, yaw]. Inside, customers come in at the door and walk round the end of the counter.
const SPOTS = {
  inside: { keeper: [-.2, 0, -3.6, .12], cust: [2.6, 0, -1.15, -.6], enter: [5.7, 0, -4.3, -2.2], via: [[4.5, 0, -.9]] },
  outside: { keeper: [-1.7, 0, 1.6, .25], cust: [2.0, 0, 1.9, -.35], enter: [9, 0, 3, -1.4], via: [] },
};
const actors = {}; // slot -> {key, obj, scene, path, leaving}
function spawn(spec, sceneName, slot) {
  const obj = D.instance(model(spec)); scene.add(obj);
  const u = obj.userData;
  if (u.kind === 'fairy') { u.wl = obj.getObjectByName('wingL'); u.wr = obj.getObjectByName('wingR'); u.star = obj.getObjectByName('star'); collectGlows(obj); setGlowOne(obj); }
  const Sp = SPOTS[sceneName] || SPOTS.inside;
  const start = slot === 'keeper' ? Sp.keeper : Sp.enter;
  obj.position.set(start[0], start[1], start[2]); obj.rotation.y = start[3];
  const path = slot === 'keeper' ? [] : [...Sp.via.map(p => p.slice()), Sp.cust];
  return { key: JSON.stringify(spec), obj, scene: sceneName, path };
}
function setGlowOne(o) { const g = P[preset] ? P[preset].glow : 1; o.traverse(s => { if (s.userData.glowSprite) s.material.opacity = Math.min(1, s.userData.glowBase * Math.max(.6, g - .3)); }); }
function drop(slot) { const a = actors[slot]; if (a) { scene.remove(a.obj); delete actors[slot]; } }
function sync(slot, spec, sceneName) {
  const key = spec ? JSON.stringify(spec) : '';
  const cur = actors[slot], nw = actors[slot + '_new'];
  if (slot === 'keeper') { // the shopkeeper never walks off: changes (a new dress) show at once
    if (cur && (cur.key !== key || cur.scene !== sceneName)) drop(slot);
    if (spec && !actors[slot]) actors[slot] = spawn(spec, sceneName, slot);
    return;
  }
  if (cur && !cur.leaving && cur.key !== key) { cur.leaving = true; const Sp = SPOTS[cur.scene]; cur.path = [...Sp.via.slice().reverse().map(p => p.slice()), Sp.enter]; }
  if (nw && nw.key !== key) drop(slot + '_new');
  if (!spec) return;
  if (cur && !cur.leaving && cur.key === key) return;
  if (actors[slot + '_new']) return;
  actors[cur ? slot + '_new' : slot] = spawn(spec, sceneName, slot);
}
function updateActors(dt, t) {
  const v = V(), sc = v.scene === 'inside' ? 'inside' : 'outside';
  for (const [slot, a] of Object.entries(actors)) {
    const base = slot.startsWith('keeper') ? 'keeper' : 'cust';
    if (a.scene !== sc) { scene.remove(a.obj); delete actors[slot]; continue; }
    const u = a.obj.userData, p = a.obj.position;
    if (slot.endsWith('_new')) { a.obj.visible = false; continue; } // waits at the door until the last visitor has left
    a.obj.visible = true;
    const tgt = a.path[0] || (SPOTS[a.scene] || SPOTS.inside)[base];
    const dx = tgt[0] - p.x, dz = tgt[2] - p.z, d = Math.hypot(dx, dz);
    if (d > .05) {
      const sp = Math.min(d, dt * 4.2);
      p.x += dx / d * sp; p.z += dz / d * sp;
      let dy = Math.atan2(dx, dz) - a.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.obj.rotation.y += dy * Math.min(1, dt * 8);
      u.mood = u.kind === 'fairy' ? 'idle' : 'walk';
    } else if (a.path.length > 1) { a.path.shift(); continue; }
    else {
      if (a.leaving) { scene.remove(a.obj); delete actors[slot]; continue; }
      a.path.length = 0;
      let dy = tgt[3] - a.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.obj.rotation.y += dy * Math.min(1, dt * 5);
      u.mood = (v.mood || {})[base] || 'idle';
    }
    if (u.kind === 'fairy') p.y = .45 + Math.sin(t * 1.5) * .12 * (calm ? .3 : 1);
    animCritter(a.obj, t);
  }
  // promote "_new" actors once the old one has gone
  for (const slot of Object.keys(actors)) if (slot.endsWith('_new')) { const b = slot.slice(0, -4); if (!actors[b]) { actors[b] = actors[slot]; delete actors[slot]; } }
}

/* ------------------------------------------------------------------ camera framing */
// eye/look set the angle; span is the width (and at least ~.6 of it in height) that must fit in the free band.
const CAMS = {
  outside: { pos: [0, 3.9, 17], look: [0, 3.1, 0], span: 14.5, minSpan: 9.5, minH: 5.2, lowY: -1.0, focus: [0, 1.5, 0], r: 9 },
  inside: { pos: [.4, 5.0, 16], look: [.4, 2.0, -2.4], span: 11.5, minSpan: 7.5, minH: 3.6, lowY: -.45, focus: [.4, 1.3, -2.4], r: 7 },
  meet: { pos: [-.6, 2.9, 6.8], look: [-.4, 1.75, -2.6], span: 4.4, minH: 2.2, focus: [-.2, 1.3, -3.2], r: 4 },
  cart: { pos: [1.8, 3.2, 13], look: [1.3, 1.6, 1.0], span: 10.5, minSpan: 9, minH: 4.3, lowY: -.3, focus: [1.8, 1.3, 1.4], r: 7 },
};
const camPos = new THREE.Vector3(...CAMS.outside.pos), camLook = new THREE.Vector3(...CAMS.outside.look);
let W = 1, H = 1, camKey = '';
function sizeAll() { W = innerWidth; H = innerHeight; R.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
const maxDpr = Math.min(devicePixelRatio || 1, 2);
let dpr = Math.min(maxDpr, touch ? 1.5 : 1.75);
R.setPixelRatio(dpr); sizeAll(); addEventListener('resize', sizeAll);
const FOV = 30, tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3(), tmpL2 = new THREE.Vector3();
function frameCamera(dt, snap) {
  const v = V(), ck = v.cam && v.cam !== 'meet' ? v.cam : v.cam === 'meet' ? (v.scene === 'inside' ? 'meet' : 'meetOut') : (v.scene === 'inside' ? 'inside' : 'outside');
  const c = CAMS[ck] || CAMS[v.scene === 'inside' ? 'inside' : 'outside'];
  if (ck !== camKey) { camKey = ck; focusC.set(...c.focus); focusR = c.r; aimLights(); }
  const top = v.top || 0, bottom = v.bottom || H, free = Math.max(120, bottom - top);
  // a short, wide band (a big panel open) frames closer on the people instead of shrinking the whole room
  // a tall band (iPad in portrait) may crop the sides down to minSpan rather than show a big empty ceiling or sky
  const tall = THREE.MathUtils.clamp((free / W - .62) / .15, 0, 1), span = c.span + ((c.minSpan ?? c.span) - c.span) * tall;
  const wideH = span / (W / free), needH = Math.max(wideH, c.minH);
  const low = THREE.MathUtils.clamp((c.minH * 1.5 - wideH) / (c.minH * .5), 0, 1); // 1 when the band is short
  const look = tmpL2.set(...c.look); look.y += (c.lowY ?? 0) * low;
  const fov = THREE.MathUtils.degToRad(FOV);
  const dir = tmpV.set(...c.pos).sub(tmpL.set(...c.look)).normalize();
  const dist = needH / 2 / Math.tan(fov / 2);
  const want = tmpL.copy(look).addScaledVector(dir, dist);
  const k = snap ? 1 : Math.min(1, dt * 2.5);
  camPos.lerp(want, k); camLook.lerp(look, k);
  cam.aspect = W / H;
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(fov / 2) * H / free));
  cam.position.copy(camPos); cam.lookAt(camLook);
  cam.setViewOffset(W, H, 0, H / 2 - (top + free / 2), W, H);
  cam.updateProjectionMatrix();
}
// the intro close-up of the keeper also happens outside, by the door
CAMS.meetOut = { pos: [-1.4, 2.7, 9.4], look: [-1.5, 1.6, 1.4], span: 4.6, minH: 2.3, focus: [-1.6, 1.2, 1.6], r: 4 };

/* ------------------------------------------------------------------ frame loop */
let last = performance.now(), T = 0, slow = 0, fast = 0, first = true, jarKey = '';
const jars = new Map();
const stats = { calls: 0, tris: 0, ms: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden || G.__ts3d?.pause) { last = now; return; }
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (dt > 1 / 40) slow++; else fast++;
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; fast = 0; }
  if (fast > 600 && dpr < maxDpr - .05) { dpr = Math.min(dpr + .15, maxDpr); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (slow + fast > 900) { slow = 0; fast = 0; }
  update(dt);
  R.render(scene, cam);
  stats.calls = R.info.render.calls; stats.tris = R.info.render.triangles; stats.ms = dt * 1000;
}
function update(dt) {
  T += dt;
  const v = V(), sc = v.scene === 'inside' ? 'inside' : 'outside', eve = sc === 'outside' && v.time === 'evening';
  inside.visible = sc === 'inside'; outside.visible = !inside.visible;
  setPreset(sc === 'inside' ? 'inside' : eve ? 'evening' : 'morning');
  outside.userData.cart.visible = !!v.cart;
  for (const o of parts.morning) o.visible = !eve;
  for (const o of parts.evening) o.visible = eve;
  // stock and decorations
  const stock = v.stock || {};
  for (const [id, g] of Object.entries(SHELF)) { const n = Math.max(0, Math.min(10, stock[id] | 0)); if (g.userData.n !== n) { g.children.forEach(im => (im.count = n)); g.visible = n > 0; g.userData.n = n; } }
  const own = new Set(v.decor || []);
  for (const [id, list] of Object.entries(decor)) for (const o of list) o.visible = own.has(id);
  if (own.has('sign') && v.signText && v.signText !== signText) { signText = v.signText; if (signMat.map) signMat.map.dispose(); signMat.map = signTexture(signText); signMat.needsUpdate = true; }
  if (inside.visible && (T * 4 | 0) !== board.tick) {
    board.tick = T * 4 | 0; const rows = boardRows(), key = JSON.stringify(rows);
    if (rows && key !== boardKey) { boardKey = key; if (board.mat.map) board.mat.map.dispose(); board.mat.map = D.chalkTexture('Today', rows.length ? rows : [['Sold out!', '', '#ffd86b']]); board.mat.needsUpdate = true; }
  }
  if (eve) updateJar();
  animateProps(T);
  // actors
  sync('keeper', v.keeper || null, sc);
  sync('cust', v.cust || null, sc);
  updateActors(dt, T);
  frameCamera(dt, first); first = false;
}
// test helper: run the scene forward (walks, camera moves) without drawing, then draw once
function settle(sec = 3) { for (let i = 0; i < sec * 30; i++) update(1 / 30); R.render(scene, cam); }
function updateJar() {
  const st = game(), fill = st ? Math.min(1, Math.round(Math.min(1, (st.till || 0) / 45) * 8) / 8) : .4, key = String(fill);
  if (key === jarKey) return; jarKey = key;
  const stump = outside.userData.stump;
  if (stump.userData.jar) stump.remove(stump.userData.jar);
  if (!jars.has(key)) { const j = D.savingsJar({ fill: Math.max(.05, fill) }); j.scale.setScalar(.62); j.position.y = .5; jars.set(key, j); }
  stump.userData.jar = jars.get(key); stump.add(stump.userData.jar);
}
function animateProps(t) {
  if (outside.visible) {
    const fl = outside.userData.flies;
    fl.forEach((b, i) => {
      const k = t * .35 + i * 2.6, f = calm ? .3 : Math.sin(t * 16 + i);
      b.position.set(Math.sin(k) * (3.5 + i) - .5, 2.4 + i * .8 + Math.sin(k * 2.3) * .4, 1.5 + Math.cos(k * .8) * 2 - i * 2);
      b.rotation.y = -k + Math.PI / 2; b.rotation.x = .9;
      if (b.userData.wl) { b.userData.wl.rotation.y = f * .9; b.userData.wr.rotation.y = -f * .9; }
    });
    const pf = outside.userData.fireflies;
    if (pf.visible && !calm) { pf.position.y = Math.sin(t * .8) * .15; pf.rotation.y = Math.sin(t * .1) * .3; pf.material.opacity = pf.userData.glowBase * (.75 + Math.sin(t * 3.1) * .25); }
  }
}
requestAnimationFrame(frame);
document.body.classList.add('g3d');

/* ------------------------------------------------------------------ pictures for the panels */
// Pictures are rendered by the main renderer (so they reuse its compiled shaders) into a corner of the canvas,
// copied out to a PNG, and the frame is drawn again straight away.
const bakeScene = new THREE.Scene(), BL = D.lightRig(bakeScene, P.morning);
BL.key.shadow.mapSize.set(512, 512); BL.key.shadow.bias = -.0008; BL.key.shadow.normalBias = .02; BL.key.shadow.radius = 3;
bakeScene.fog = new THREE.Fog('#ffffff', 900, 1000);
let repaint = false;
const bcam = new THREE.PerspectiveCamera(22, 1, .05, 100), bcv = document.createElement('canvas'), bctx = bcv.getContext('2d');
function bakeObj(obj, view = {}) {
  if (!envs.morning) envs.morning = pmrem.fromScene(D.envScene(P.morning), .02).texture;
  bakeScene.environment = envs.morning; bakeScene.environmentIntensity = 1.1;
  const dpx = R.getPixelRatio(), cw = canvas.width, ch = canvas.height;
  const px = Math.max(64, Math.min(336, cw, ch));
  bakeScene.add(obj); obj.updateMatrixWorld(true);
  const box = new THREE.Box3(); obj.traverse(m => { if (m.isMesh && m.visible && !m.userData.noFit && !(m.material && m.material.map && m.geometry.type === 'PlaneGeometry' && m.material.transparent)) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); } });
  const c = view.focus ? new THREE.Vector3(...view.focus) : box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const yaw = view.yaw ?? .35, pitch = view.pitch ?? .18, pad = view.pad ?? 1.12;
  bcam.aspect = 1; const fitH = view.height ?? Math.max(sz.y, sz.x) * pad;
  const dist = fitH / 2 / Math.tan(THREE.MathUtils.degToRad(bcam.fov / 2)) + Math.max(sz.x, sz.z) / 2;
  bcam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  bcam.lookAt(c); bcam.updateProjectionMatrix();
  const p = P.morning, rad = Math.max(sz.x, sz.y, sz.z) * .8 + .2;
  for (const n of ['key', 'fill', 'rim']) { const l = BL[n], d = new THREE.Vector3(...p[n][2]).normalize(); l.position.copy(c).addScaledVector(d, 20); l.target.position.copy(c); l.target.updateMatrixWorld(); }
  const sc = BL.key.shadow.camera; sc.left = sc.bottom = -rad; sc.right = sc.top = rad; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
  const exp = R.toneMappingExposure; R.toneMappingExposure = .95;
  const v = px / dpx;
  R.setViewport(0, 0, v, v); R.setScissor(0, 0, v, v); R.setScissorTest(true);
  R.render(bakeScene, bcam);
  bcv.width = bcv.height = px; bctx.clearRect(0, 0, px, px); bctx.drawImage(canvas, 0, ch - px, px, px, 0, 0, px, px);
  if (view.post) view.post(bctx, px);
  R.setScissorTest(false); R.setViewport(0, 0, W, H); R.toneMappingExposure = exp;
  bakeScene.remove(obj);
  if (!first && !repaint) { repaint = true; queueMicrotask(() => { repaint = false; R.render(scene, cam); }); } // put the picture back before the browser shows the canvas
  return bcv.toDataURL('image/png');
}
const baker = { portrait(ch, o2 = {}) { const hy = (ch.userData.head ? ch.userData.head.getWorldPosition(new THREE.Vector3()).y : 1.95); return bakeObj(ch, { focus: [0, hy - .05 + (o2.dy || 0), 0], height: o2.height ?? 1.25, yaw: o2.yaw ?? .25, pitch: .05 }); } };
const COIN_FONT = '"Chalkboard SE","Comic Neue","Trebuchet MS",system-ui,sans-serif';
try { document.fonts.load('700 40px "Comic Neue"'); } catch (e) {}
function coinLabel(x, px, v) {
  const t = v + '¢', f = px * (v >= 10 ? .27 : .32);
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${f}px ${COIN_FONT}`; x.lineJoin = 'round';
  x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowOffsetY = px * .012; x.shadowBlur = px * .02;
  x.lineWidth = px * .045; x.strokeStyle = v === 1 ? '#5a2c12' : '#4b505e'; x.strokeText(t, px / 2, px / 2 + px * .01);
  x.shadowColor = 'transparent'; x.fillStyle = '#fff'; x.fillText(t, px / 2, px / 2 + px * .01); x.restore();
}
const pics = new Map();
const bakeLog = [];
// goods, coins and decorations are built just for their picture, so their shapes are freed once it is taken
const bake = (key, make, view) => { if (!pics.has(key)) { bakeLog.push(key); const o = make(); pics.set(key, bakeObj(o, view)); disposeModel(o); } return pics.get(key); };
const THUMB = {
  sign() { const g = new THREE.Group(); g.add(D.rbox(2.5, .74, .12, .04, D.wood('#9a6a45', { axis: 0 }))); const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .52), new THREE.MeshStandardMaterial({ map: signTexture(signText || V().signText || 'My Shop'), roughness: .85 })); f.position.z = .075; g.add(f); return g; },
  awning: () => D.awning({ w: 2.1 }),
  windowboxes() { const g = decor.windowboxes[0].clone(); g.visible = true; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1); return g; },
  lanterns: () => D.lanternPost(),
  bunting: () => D.buntingCord([[-.85, .32, 0], [-.42, -.04, .05], [0, -.16, .08], [.42, -.04, .05], [.85, .32, 0]], { n: 4 }),
  vase: () => D.flowerVase(),
  rug: () => D.braidRug(2.2, { colors: ['#e2566b', '#ffd86b', '#7bb4d9', '#f6a6bd'] }),
  bell: () => D.doorBell(),
  catbed: () => D.catBed(),
  fairylights: () => D.fairyLights([[-.9, .55, 0], [-.45, -.25, .1], [0, .45, 0], [.45, -.25, .1], [.9, .55, 0]], { n: 9 }),
};
const DECOR_VIEW = { bunting: { yaw: 0, pitch: .12, pad: 1.0 }, fairylights: { yaw: 0, pitch: .1, pad: 1.0 }, awning: { yaw: .5, pitch: .35 }, rug: { yaw: 0, pitch: .9 }, catbed: { yaw: .4, pitch: .55 }, bell: { yaw: 1.0, pitch: .15 }, sign: { yaw: 0, pitch: 0, pad: 1.02 } };
const portraitModel = spec => {
  const o = D.instance(model(spec)); // reuses the cached model's shapes: a portrait adds no new geometry
  o.traverse(m => { if (m.isMesh && m.material && m.material.map && m.geometry.type === 'PlaneGeometry' && m.material.transparent && !m.material.depthWrite) m.visible = false; });
  if (o.userData.kind === 'fairy') { const w = o.getObjectByName('wand'); if (w) w.visible = false; }
  return o;
};
G.Shop3D = {
  good: id => bake('good:' + id, () => goodModel(id), { yaw: .45, pitch: .4, pad: 1.08 }),
  // the value is printed flat on top (white with a dark outline) so 1, 5 and 10 read clearly at chip size
  coin: v => bake('coin:' + v, () => D.coin(+v || 1, { plain: true }), { yaw: 0, pitch: 0, focus: [0, 0, 0], height: 2.02, post: (x, px) => coinLabel(x, px, +v || 1) }),
  portrait: spec => {
    const key = 'p:' + JSON.stringify(spec), hat = (spec.acc || []).includes('tricorn');
    if (!pics.has(key)) bakeLog.push(key), pics.set(key, baker.portrait(portraitModel(spec), { height: spec.species === 'owl' ? 1.45 : spec.species === 'fairy' ? 1.55 : hat ? 1.5 : 1.3, dy: spec.species === 'fairy' ? .12 : spec.species === 'rabbit' ? .1 : hat ? .12 : 0 }));
    return pics.get(key);
  },
  decor: id => bake('d:' + id + (id === 'sign' ? signText : ''), THUMB[id] || (() => new THREE.Group()), { yaw: .35, pitch: .3, pad: 1.1, ...(DECOR_VIEW[id] || {}) }),
};
G.__ts3d = { R, scene, cam, bakeLog, stats, actors, settle, get dpr() { return dpr; }, CAMS, SPOTS, D, bakeObj, makeModel };
if (G.__ts && G.__ts.on3d) G.__ts.on3d();

// warm up: build and compile the whole cast while the player reads, so nobody stutters in later
(function warm() {
  let list = [];
  try { list = Object.entries(CAST).filter(([id]) => id !== 'clover').map(([, c]) => c.spec); } catch (e) {} // eslint-disable-line no-undef
  const step = () => {
    const spec = list.shift(); if (!spec) return;
    try { const o = D.instance(model(spec)); o.position.set(0, -50, 0); scene.add(o); R.compile(scene, cam); scene.remove(o); } catch (e) {}
    setTimeout(step, 120);
  };
  setTimeout(step, 1500);
})();
