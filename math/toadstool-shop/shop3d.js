// The Toadstool Shop in felt 3D (felt3d.js: felt fibre, stitches, embroidery, glossy toy eyes, wood grain, soft shadows).
// The game (rules, touch, saves, voice, cards) lives in index.html's DOM. It describes what should be on screen in
// window.TSV (scene, stock, who is standing where, decorations, where the free space above the panel is), and this
// module draws that every frame. It also bakes still pictures of the goods, coins and characters for the panels.
// If WebGL or this module fails, the game keeps its plain look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as D from './felt3d.js';
import * as VL from './village3d.js';
import * as RM from './rooms3d.js';
import * as AC from './acts3d.js';

const G = window;
const V = () => G.TSV || {};
let act = null; // the family activity being drawn in her house (syncAct, acts3d.js)
let roomBlocks = []; // furniture in the room she is in, as floor circles: people walk round it (acts3d.js)
const TAU = Math.PI * 2, PI2 = Math.PI / 2;
const calm = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches);
const touch = (navigator.maxTouchPoints || 0) > 1;
// the game's own state, read only (top-level consts of the classic script are visible here by name)
const game = () => { try { return S; } catch (e) { return null; } }; // eslint-disable-line no-undef
const castOf = spec => { try { for (const [id, c] of Object.entries(CAST)) if (c.spec === spec || JSON.stringify(c.spec) === JSON.stringify(spec)) return id; } catch (e) {} return spec && (spec.keeper || spec.apron) ? 'keeper' : null; }; // eslint-disable-line no-undef

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
const outside = new THREE.Group(), inside = new THREE.Group(), village = new THREE.Group(), rooms = new THREE.Group();
scene.add(outside, inside, village, rooms);
// which place the game is showing: the shop floor, outside it, the village lane, or a room inside a village house
const sceneOf = v => v.scene === 'inside' ? 'inside' : v.scene === 'village' ? 'village' : v.scene === 'room' ? 'room' : 'outside';

/* ------------------------------------------------------------------ light rig, sky and image-based light, per time of day */
const P = { morning: D.PRESETS.morning, evening: D.PRESETS.evening, inside: D.PRESETS.inside, day: D.PRESETS.day };
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
  if (id === 'keeper') return D.poppy({ fur: spec.fur, dress: spec.dress, bow: spec.bowColor || '#ffffff', print: spec.print, apron: spec.apron !== false, acc: spec.acc });
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
    if (!castKeys.has(key) && !spec.fam) { // her family (family.js) stay cached like the cast
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
  D.faceLife(o, t); // blinks, glances, happy eyes
}

/* ------------------------------------------------------------------ the people in the scene */
// [x, y, z, yaw]. Inside, customers come in at the door and walk round the end of the counter.
const SPOTS = {
  inside: { keeper: [-.2, 0, -3.6, .12], cust: [2.6, 0, -1.15, -.6], enter: [5.7, 0, -4.3, -2.2], via: [[4.5, 0, -.9]] },
  outside: { keeper: [-1.7, 0, 1.6, .25], cust: [2.0, 0, 1.9, -.35], enter: [9, 0, 3, -1.4], via: [] },
  // in the village these move: the keeper's spot is wherever she is walking to, a neighbour comes out of their own door
  village: { keeper: [VL.PLACES.gate.stand[0], 0, VL.PLACES.gate.stand[1], .3], cust: [0, 0, 0, 0], enter: [0, 0, -1, 0], via: [] },
  // inside a village house the one who lives there is already home: they appear in their spot (set per room)
  room: { keeper: [0, 0, 0, 0], cust: [0, 0, 0, 0], enter: [0, 0, 0, 0], via: [] },
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
  const v = V(), sc = sceneOf(v);
  for (const [slot, a] of Object.entries(actors)) {
    const base = slot.startsWith('keeper') ? 'keeper' : 'cust';
    if (a.scene !== sc) { scene.remove(a.obj); delete actors[slot]; continue; }
    const u = a.obj.userData, p = a.obj.position;
    if (slot.endsWith('_new')) { a.obj.visible = false; continue; } // waits at the door until the last visitor has left
    a.obj.visible = true;
    const tgt = a.path[0] || (SPOTS[a.scene] || SPOTS.inside)[base];
    const dx = tgt[0] - p.x, dz = tgt[2] - p.z, d = Math.hypot(dx, dz);
    if (d > .05) {
      const sp = Math.min(d, dt * (a.scene === 'village' ? (a.speed || 5.5) : 4.2));
      if (a.scene === 'room' && slot === 'keeper') AC.step(p, [tgt[0], tgt[2]], .5, dt, 4.2, fam.map(f => ({ p: f.obj.position, r: f.r })), roomBlocks);
      else { p.x += dx / d * sp; p.z += dz / d * sp; }
      let dy = Math.atan2(dx, dz) - a.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.obj.rotation.y += dy * Math.min(1, dt * 8);
      u.mood = u.kind === 'fairy' ? 'idle' : 'walk';
    } else if (a.path.length > 1) { a.path.shift(); continue; }
    else {
      if (a.leaving) { scene.remove(a.obj); delete actors[slot]; continue; }
      a.path.length = 0;
      let dy = tgt[3] - a.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      a.obj.rotation.y += dy * Math.min(1, dt * 5);
      // what the shopkeeper is doing in a family activity (acts3d.js), unless she is talking
      const vm = (v.mood || {})[base];
      u.mood = vm && vm !== 'idle' ? vm : (base === 'keeper' && act && act.moods.keeper) || vm || 'idle';
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
  room: RM.ROOM_CAM, decorate: RM.DECO_CAM,
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
  const v = V(), sc = sceneOf(v), acting = sc === 'room' && act;
  const ck = acting ? 'act' + act.key : v.cam && v.cam !== 'meet' ? v.cam : v.cam === 'meet' ? (v.scene === 'inside' ? 'meet' : 'meetOut') : sc;
  // a family activity: the camera comes in close on it
  const c = acting ? act.cam : ck === 'village' ? villageCam(v) : CAMS[ck] || CAMS[v.scene === 'inside' ? 'inside' : 'outside'];
  if (ck !== camKey) { camKey = ck; focusC.set(...c.focus); focusR = c.r; aimLights(); }
  else if (ck === 'village' && Math.abs(focusC.x - c.focus[0]) > 2.5) { focusC.set(...c.focus); aimLights(); }
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
// In the village the camera follows the shopkeeper along the lane, and frames her and a neighbour when she visits.
function villageCam(v) {
  const a = actors.keeper, P = v.place && VL.PLACES[v.place];
  let x = a && a.scene === 'village' ? a.obj.position.x : VL.PLACES.gate.stand[0];
  if (P && P.meet && v.cust) x = (P.stand[0] + P.meet[0]) / 2;
  x = THREE.MathUtils.clamp(x, VL.LANE[0] + 2.5, VL.LANE[1] - 1.5);
  return { pos: [x, 4.4, 16], look: [x, 1.9, -1.2], span: 12.5, minSpan: 8, minH: 5.6, lowY: -.7, focus: [x, 1.3, -1], r: 9 };
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
  const v = V(), sc = sceneOf(v), eve = sc === 'outside' && v.time === 'evening';
  if (sc === 'village') ensureVillage();
  if (sc === 'room') showRoom(v.room);
  inside.visible = sc === 'inside'; outside.visible = sc === 'outside'; village.visible = sc === 'village'; rooms.visible = sc === 'room';
  setPreset(sc === 'inside' || sc === 'room' ? 'inside' : sc === 'village' ? 'morning' : eve ? 'evening' : 'morning');
  syncOwned(v.garden, 'garden'); syncOwned(v.treasures, 'treasures'); if (roomGroups.home) syncHome(v);
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
  if (sc === 'village') villageBefore(v);
  sync('keeper', v.keeper || null, sc);
  sync('cust', v.cust || null, sc);
  updateActors(dt, T);
  if (sc === 'village') villageAfter(v, T);
  if (sc === 'room') roomAfter(T);
  // stepping through a door cuts straight to the other side (no sweep across the lane)
  const cut = (sc === 'room') !== (lastSc === 'room') && lastSc !== '';
  lastSc = sc;
  frameCamera(dt, first || cut); first = false;
}
/* ------------------------------------------------------------------ the village, the garden and the treasures (village3d.js) */
let VG = null, lastSc = '', goKey = '', placeKey = '';
function ensureVillage() {
  if (VG) return;
  VG = VL.buildVillage({ touch }); village.add(VG.group); collectGlows(VG.group);
  VG.ringGlows.forEach(s => { s.userData.glowBase = 0; }); // switched on by hand, not by the time of day
}
// Things she bought in the village appear the moment they are hers: garden things round the shop, treasures on the counter ledge.
const owned = { garden: {}, treasures: {}, home: {} }; // home: her house's things (syncHome)
let ledge = null;
function syncOwned(list, kind) {
  for (const id of list || []) {
    if (owned[kind][id]) continue;
    const make = (kind === 'garden' ? VL.GARDEN_MODELS : VL.TREASURE_MODELS)[id]; if (!make) continue;
    const o = make(); D.freeze(o);
    if (kind === 'garden') { const [x, y, z, ry] = VL.GARDEN_SPOTS[id]; o.position.set(x, y, z); o.rotation.y = ry; outside.add(o); }
    else {
      if (!ledge) { ledge = VL.treasureShelf(); ledge.position.set(-.8, .62, -1.74); inside.add(ledge); }
      const [x, y, z] = VL.treasureSpot(id); o.position.set(x, y, z); o.scale.setScalar(1.25); ledge.add(o);
    }
    collectGlows(o); setGlowOne(o); owned[kind][id] = o;
  }
}
// Before the actors move: where the shopkeeper is heading (TSV.go: a place id, or "x:<lane x>") and which door a neighbour uses.
function villageBefore(v) {
  const Sp = SPOTS.village;
  if (lastSc !== 'village') {
    // back out of a house's door she stands on its step; otherwise she comes in by the gate
    const back = lastSc === 'room' && VL.PLACES[v.go], g = back || VL.PLACES.gate;
    Sp.keeper = [g.stand[0], 0, g.stand[1], back ? 0 : g.face]; goKey = back ? v.go : ''; placeKey = '';
    if (back) v.at = v.go;
  }
  const P = v.place && VL.PLACES[v.place];
  if (P && P.door && v.place !== placeKey) {
    placeKey = v.place;
    Sp.enter = [P.door[0], 0, P.door[1], 0];
    Sp.cust = [P.meet[0], 0, P.meet[1], Math.atan2(P.stand[0] - P.meet[0], P.stand[1] - P.meet[1])];
  }
  const a = actors.keeper, key = v.go || 'gate';
  if (!a || a.scene !== 'village' || key === goKey) return;
  goKey = key;
  let tx, tz, yaw;
  if (key.startsWith('x:')) { tx = THREE.MathUtils.clamp(+key.slice(2) || 0, VL.LANE[0], VL.LANE[1]); tz = VL.LANE_Z; yaw = 0; }
  else { const Q = VL.PLACES[key] || VL.PLACES.gate; [tx, tz] = Q.stand; yaw = Q.meet ? Math.atan2(Q.meet[0] - tx, Q.meet[1] - tz) : Q.face; }
  const p = a.obj.position, path = [];
  if (Math.abs(p.x - tx) > .6) { if (Math.abs(p.z - VL.LANE_Z) > .3) path.push([p.x, 0, VL.LANE_Z]); path.push([tx, 0, VL.LANE_Z]); }
  path.push([tx, 0, tz, yaw]);
  // long walks (her house to Tansy's stall) go a little quicker so every walk takes under 8 seconds
  let len = 0, q = [p.x, 0, p.z]; for (const w of path) { len += Math.hypot(w[0] - q[0], w[2] - q[2]); q = w; }
  a.speed = Math.max(5.5, len / 7.5);
  Sp.keeper = [tx, 0, tz, yaw]; a.path = path; v.at = null;
}
// After they move: say when she has arrived (TSV.at), light the fairy ring, fly the butterflies.
function villageAfter(v, t) {
  const a = actors.keeper, k = SPOTS.village.keeper;
  if (a && a.scene === 'village' && !a.path.length && goKey && v.at !== goKey && Math.hypot(a.obj.position.x - k[0], a.obj.position.z - k[2]) < .1) v.at = goKey;
  const lit = !!v.ringLit;
  VG.ringLit.emissiveIntensity = lit ? 2.2 + Math.sin(t * 3) * .3 : .15;
  VG.ringGlows.forEach((s, i) => { s.visible = lit; s.material.opacity = .55 + Math.sin(t * 2.4 + i) * .15; });
  // chimney smoke drifts up and fades, the windmill turns, ducks paddle round the pond
  VG.smoke.forEach(m => { const u = m.userData, k = (t * .16 + u.k) % 1; m.position.set(u.x + k * 1.4 + Math.sin(k * 5 + u.x) * .2, u.y + k * 2.4, u.z); m.scale.setScalar((.16 + k * .55) * Math.min(1, (1 - k) * 3, k * 8 + .2)); });
  if (!calm) VG.sails.rotation.z = -t * .5;
  VG.ducks.forEach((d, i) => { const a = t * (.22 - i * .03) + i * 2.1, P = VL.PLACES.pond; d.position.set(P.x + .8 + Math.cos(a) * (2.0 - i * .3), Math.sin(t * 3 + i) * .02, -2.6 + Math.sin(a) * (1.1 - i * .15)); d.rotation.y = -a; });
  for (const [id, o] of Object.entries(VG.annexes || {})) o.visible = (v.rooms || []).includes(id); // the rooms she has built
  updateFolk(v, t);
  VG.butterflies.forEach((b, i) => {
    const kx = t * .3 + i * 2.1, f = calm ? .3 : Math.sin(t * 16 + i);
    b.position.set(-14 + i * 13 + Math.sin(kx) * 3, 2.2 + i * .5 + Math.sin(kx * 2.3) * .4, -2.5 + Math.cos(kx * .8) * 1.5);
    b.rotation.y = -kx + Math.PI / 2; b.rotation.x = .9;
    if (b.userData.wl) { b.userData.wl.rotation.y = f * .9; b.userData.wr.rotation.y = -f * .9; }
  });
}
// Tapping the village: a house or stall visits it, the lane walks there. The game decides what a tap does (TSV.onTap).
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
let down = null;
canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, performance.now()]; });
canvas.addEventListener('pointerup', e => {
  const v = V(), d0 = down; down = null;
  if (!d0 || sceneOf(v) !== 'village' || typeof v.onTap !== 'function') return;
  if (Math.hypot(e.clientX - d0[0], e.clientY - d0[1]) > 16 || performance.now() - d0[2] > 800) return;
  ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1); ray.setFromCamera(ndc, cam);
  const fh = ray.intersectObjects(folk.map(f => f.obj), true)[0];
  if (fh) { let o = fh.object; while (o && !o.userData.folk) o = o.parent; if (o) { v.onTap({ who: o.userData.folk }); return; } }
  const ground = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit.clone() : null;
  if (ground && ground.z > -.4) { v.onTap({ x: ground.x }); return; }
  if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 1.5), hit) && hit.y > -.2 && hit.y < 7.5) {
    let best = null, bd = 2.8;
    for (const [id, P] of Object.entries(VL.PLACES)) { const dd = Math.abs(P.x - hit.x); if (P.door && dd < bd) { bd = dd; best = id; } }
    v.onTap(best ? { place: best } : { x: hit.x });
  }
});
/* ------------------------------------------------------------------ village folk out and about (TSV.folk: [{id, spec}]) */
// They stroll up and down near wherever the shopkeeper is, stop to chat when they meet, and wave when tapped
// (TSV.folkMood[id]). They keep clear of a neighbour she is visiting.
const folk = [];
function updateFolk(v, t) {
  const list = v.folk || [], key = list.map(f => f.id).join();
  if (key !== folk.key) {
    for (const f of folk.splice(0)) village.remove(f.obj);
    folk.key = key; const r = D.rng(7);
    list.forEach((f, i) => {
      const obj = D.instance(model(f.spec)); obj.userData.folk = f.id; village.add(obj);
      const x = VL.LANE[0] + 4 + r() * (VL.LANE[1] - VL.LANE[0] - 8), z = [.45, .2, .55, .3][i % 4];
      obj.position.set(x, 0, z); folk.push({ id: f.id, obj, z, tx: x, wait: 1 + r() * 3, last: t });
    });
  }
  const a = actors.keeper, kx = a && a.scene === 'village' ? a.obj.position.x : VL.PLACES.gate.stand[0];
  const P = v.place && VL.PLACES[v.place], busyX = P && v.cust ? (P.stand[0] + P.meet[0]) / 2 : null;
  for (const f of folk) {
    const o = f.obj, u = o.userData, p = o.position, dt = Math.min(.1, t - f.last); f.last = t;
    const fm = (v.folkMood || {})[f.id];
    if (fm) { u.mood = fm; let dy = 0 - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 6); animCritter(o, t); continue; }
    const dx = f.tx - p.x;
    if (Math.abs(dx) > .05 && f.wait <= 0) {
      const sp = Math.min(Math.abs(dx), dt * 1.4); p.x += Math.sign(dx) * sp;
      if (busyX != null && Math.abs(p.x - busyX) < 2.6) f.tx = p.x + Math.sign(p.x - busyX || 1) * 4; // walk away from the visit
      let dy = (dx > 0 ? PI2 : -PI2) - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 6);
      u.mood = 'walk';
    } else {
      if (f.wait <= 0) { // just arrived: a little rest, and a chat if a friend is close by
        f.wait = 2.5 + Math.random() * 4; f.chat = null;
        const pal = folk.find(g => g !== f && Math.abs(g.obj.position.x - p.x) < 2.2 && !g.chat);
        if (pal) { f.chat = pal; pal.chat = f; pal.wait = Math.max(pal.wait, f.wait); pal.tx = pal.obj.position.x; }
      }
      f.wait -= dt;
      const look = f.chat ? Math.atan2(f.chat.obj.position.x - p.x, f.chat.obj.position.z - p.z) : .15;
      let dy = look - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 4);
      u.mood = f.chat ? 'talk' : 'idle';
      if (f.wait <= 0) { if (f.chat) f.chat.chat = null; f.chat = null; f.tx = THREE.MathUtils.clamp(kx + (Math.random() - .5) * 18, VL.LANE[0] + 1, VL.LANE[1] - 1); if (busyX != null && Math.abs(f.tx - busyX) < 3) f.tx += 6 * Math.sign(f.tx - busyX || 1); }
    }
    // two people on the lane never walk through each other: whoever is walking (or standing in her way) steps aside
    let zt = f.z;
    const near = folk.filter(g => g !== f).map(g => g.obj.position).concat(a && a.scene === 'village' ? [a.obj.position] : []);
    for (const q of near) {
      if (Math.abs(q.x - p.x) < 1.3 && Math.abs(q.z - zt) < .8) zt = q.z + (p.z >= q.z ? .85 : -.85);
    }
    zt = THREE.MathUtils.clamp(zt, -.5, 1.4);
    p.z += (zt - p.z) * Math.min(1, dt * 3);
    animCritter(o, t);
  }
}

/* ------------------------------------------------------------------ rooms inside the houses (rooms3d.js) */
const roomGroups = {};
let roomKey = '', clock = null;
function showRoom(id) {
  id = id || 'home';
  if (!roomGroups[id]) { const g = RM.buildRoom(id); roomGroups[id] = g; rooms.add(g); collectGlows(g); setGlowOne(g); }
  if (id !== roomKey) {
    roomKey = id; for (const [k, g] of Object.entries(roomGroups)) g.visible = k === id;
    const S = RM.ROOM_SPOTS[id] || RM.ROOM_SPOTS.home, Sp = SPOTS.room;
    Sp.keeper = S.keeper.slice(); Sp.cust = S.cust.slice(); Sp.enter = S.cust.slice();
  }
}
function roomAfter(t) {
  roomBlocks = AC.blocks(roomKey, V(), act && act.a);
  if (clock && roomKey === 'home') { const pd = clock.getObjectByName('clockPend'), hd = clock.getObjectByName('clockHand'); if (pd) pd.rotation.z = Math.sin(t * 2.4) * (calm ? .05 : .22); if (hd) hd.rotation.z = -t * .2; }
  if (roomKey === 'home') animateHome(t);
  syncAct(V(), t);
  syncFamily(V(), t);
}
// A family activity (TSV.act, acts3d.js), like The Sims: everyone in it walks over, the things for it are set out,
// and then they do it. The shopkeeper walks there too (her room spot moves), and everyone walks back after.
function syncAct(v, t) {
  const a = RM.FAMILY_ROOMS.includes(roomKey) ? v.act : null, key = a ? a.id + '|' + roomKey : '';
  if (key !== (act ? act.key : '')) {
    if (act) { rooms.remove(act.g); const home = (RM.ROOM_SPOTS[roomKey] || RM.ROOM_SPOTS.home).keeper; SPOTS.room.keeper = home.slice(); }
    act = null;
    if (a) { const g = AC.build(a, roomKey); rooms.add(g); act = { key, g, a, phase: null, t0: t, moods: {}, at: {}, cam: AC.view(a, roomKey) }; }
  }
  if (!act) return;
  if (a.phase !== act.phase) { act.phase = a.phase; act.t0 = t; act.at = AC.places(a, roomKey); }
  act.moods = act.g.userData.update(a.phase, t - act.t0, t) || {};
  const k = act.at.keeper; if (k) SPOTS.room.keeper = [k[0], 0, k[1], k[2]];
}
// Her husband and children (TSV.family: [{id, spec, kid}], family.js) are at home in a row at the front of her room;
// the children are smaller. TSV.famMood[id] says who is talking, waving or happy.
const fam = [];
function syncFamily(v, t) {
  const list = RM.FAMILY_ROOMS.includes(roomKey) ? v.family || [] : [], key = list.map(f => f.id + JSON.stringify(f.spec)).join('|');
  if (key !== fam.key) {
    for (const f of fam.splice(0)) rooms.remove(f.obj);
    fam.key = key;
    list.forEach((f, i) => {
      const obj = D.instance(model(f.spec)), s = RM.FAMILY_SPOTS[i] || RM.FAMILY_SPOTS[0];
      if (f.kid) obj.scale.setScalar(.68);
      obj.position.set(s[0], 0, s[1]); obj.rotation.y = s[2]; rooms.add(obj); fam.push({ id: f.id, obj, home: [s[0], s[1], s[2], 0], r: f.kid ? .32 : .48 });
    });
  }
  const m = v.famMood || {}, dt = Math.min(.1, Math.max(0, t - (fam.t || t))); fam.t = t;
  for (const f of fam) {
    const o = f.obj, p = o.position, u = o.userData;
    // in an activity: their place in it, or else off to one side to watch
    const tgt = act ? act.at[f.id] || (f.aside = f.aside && f.aside.key === act.key + act.phase ? f.aside : Object.assign(AC.aside(act.a, roomKey, fam.filter(g => !act.at[g.id]).indexOf(f)), { key: act.key + act.phase })) : f.home;
    const px = p.x, pz = p.z, k = actors.keeper;
    // everyone else in the room, so they step round each other
    const bodies = fam.filter(g => g !== f).map(g => ({ p: g.obj.position, r: g.r })).concat(k && k.scene === 'room' ? [{ p: k.obj.position, r: .5 }] : []);
    // someone standing in the way for a while: stop there rather than walk on the spot
    const tk = tgt.join(); if (f.tk !== tk) { f.tk = tk; f.stuck = 0; }
    if (f.stuck < 1.2 && Math.hypot(tgt[0] - p.x, tgt[1] - p.z) > .05 && AC.step(p, tgt, f.r, dt, 3.4, bodies, roomBlocks)) {
      p.y += (0 - p.y) * Math.min(1, dt * 8);
      const mx = p.x - px, mz = p.z - pz;
      f.stuck = Math.hypot(mx, mz) < dt * .6 ? f.stuck + dt : 0;
      if (Math.hypot(mx, mz) > 1e-4) { let dy = Math.atan2(mx, mz) - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 8); }
      u.mood = 'walk';
    } else {
      let dy = tgt[2] - o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.rotation.y += dy * Math.min(1, dt * 5);
      p.y += ((tgt[3] || 0) - p.y) * Math.min(1, dt * 4);
      u.mood = m[f.id] || (act && act.moods[f.id]) || 'idle';
    }
    animCritter(o, t);
  }
}

/* ------------------------------------------------------------------ decorating her house */
// The game keeps what she owns (TSV.home), what waits in the tray (TSV.homeTray), where each thing stands
// (TSV.homeAt: {id: spot}, see rooms3d.js) and the wallpaper (TSV.paper). While TSV.decorate is on she can drag
// things about, tap one to turn it, or drag it down onto the tray (below TSV.bottom) to put it away;
// each of those is reported to TSV.onHome({type, id, at}), and the game saves it.
let paperKey = '', hdrag = null;
function syncHome(v) {
  const g = roomGroups.home, tray = v.homeTray || [], at = v.homeAt || {};
  if ((v.paper || 'rose') !== paperKey) {
    paperKey = v.paper || 'rose';
    if (g.userData.paper) { g.remove(g.userData.paper); g.userData.paper.geometry.dispose(); }
    g.userData.paper = RM.wallpaper(paperKey); g.add(g.userData.paper);
  }
  for (const id of v.home || []) {
    const make = RM.HOME_MODELS[id]; if (!make) continue; // wallpapers are in the list too
    let o = owned.home[id];
    if (!o) { o = make(); D.freeze(o); o.userData.homeId = id; o.visible = false; g.add(o); collectGlows(o); setGlowOne(o); owned.home[id] = o; if (id === 'clock') clock = o; }
    const show = !tray.includes(id);
    if (hdrag && hdrag.o === o) continue;
    const key = JSON.stringify(at[id] || null);
    if (show && (!o.visible || o.userData.spot !== key)) {
      const fresh = !o.visible && o.userData.spot !== undefined; // it was in the tray: drop it in
      RM.placeHome(id, o, at[id]); o.userData.spot = key; o.userData.baseY = o.position.y; o.visible = true;
      if (fresh && !calm) o.userData.drop = T;
    } else if (!show && o.visible) { o.visible = false; o.userData.spot = key; }
    else if (o.userData.spot === undefined) o.userData.spot = key;
  }
}
function animateHome(t) {
  for (const o of Object.values(owned.home)) {
    const u = o.userData;
    if (u.drop != null) { const k = Math.min(1, (t - u.drop) / .5); o.position.y = u.baseY + 2.5 * (1 - k) * (1 - k) + Math.sin(k * Math.PI) * .15 * (k > .6 ? 1 : 0); if (k >= 1) { o.position.y = u.baseY; u.drop = null; } }
    if (u.spin) { const k = Math.min(1, (t - u.spin.t0) / .35), e = 1 - (1 - k) ** 3; o.rotation.y = u.spin.from + (u.spin.to - u.spin.from) * e; if (k >= 1) u.spin = null; }
    if (u.wiggle != null) { const k = Math.min(1, (t - u.wiggle) / .5); o.rotation.z = Math.sin(k * Math.PI * 4) * .08 * (1 - k); if (k >= 1) { o.rotation.z = 0; u.wiggle = null; } }
  }
}
const floorPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3();
function rayAt(e) { ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.ray; }
// where the ray leaves the round wall (the camera is outside the circle, so the far crossing is the back wall)
function wallHit(r) {
  const R0 = 6.92, ox = r.origin.x, oz = r.origin.z, dx = r.direction.x, dz = r.direction.z;
  const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - R0 * R0, disc = b * b - 4 * a * c;
  if (disc < 0 || a < 1e-6) return null;
  const tt = (-b + Math.sqrt(disc)) / (2 * a), p = r.at(tt, new THREE.Vector3());
  let ang = Math.atan2(p.x, p.z); if (ang < 0) ang += TAU;
  return RM.clampWall(ang, p.y);
}
function homeHit(e, list = Object.values(owned.home).filter(o => o.visible)) {
  rayAt(e); const h = ray.intersectObjects(list, true)[0]; if (!h) return null;
  let o = h.object; while (o && !o.userData.homeId) o = o.parent; return o || null;
}
function homeEv(ev) { const f = V().onHome; if (typeof f === 'function') try { f(ev); } catch (e) { console.warn(e); } }
canvas.addEventListener('pointerdown', e => {
  const v = V(); if (hdrag || !v.decorate || sceneOf(v) !== 'room' || roomKey !== 'home') return;
  const list = Object.values(owned.home).filter(o => o.visible);
  const o = homeHit(e, list); if (!o) return;
  const id = o.userData.homeId, kind = (RM.HOME_KIND[id] || {}).at || 'floor';
  const fh = ray.ray.intersectPlane(floorPl, hp) ? hp.clone() : o.position.clone();
  hdrag = { o, id, kind, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, over: false, off: [o.position.x - fh.x, o.position.z - fh.z], at: JSON.parse(o.userData.spot || 'null') || { ...(RM.HOME_SPOTS[id] || {}) } };
  if (o.userData.drop != null) { o.userData.drop = null; o.position.y = o.userData.baseY; } // still falling in: land it now
  if (o.userData.spin) { o.rotation.y = o.userData.spin.to; o.userData.spin = null; }
  hdrag.up = kind === 'small' && o.position.y > .5; // on the table or bed: the floor offset is worked out when it steps off
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
  const d = hdrag; if (!d || e.pointerId !== d.pid) return;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 10) { d.moved = true; homeEv({ type: 'lift', id: d.id }); }
  if (!d.moved) return;
  const v = V(), over = e.clientY > (v.bottom || H) - 6;
  if (over !== d.over) { d.over = over; homeEv({ type: 'over', id: d.id, on: over }); }
  const r = rayAt(e), o = d.o, k = RM.HOME_KIND[d.id] || { r: .5 };
  if (d.kind === 'wall') { const w = wallHit(r); if (w) { d.at = { a: +w[0].toFixed(3), y: +w[1].toFixed(2) }; RM.placeHome(d.id, o, d.at); o.translateZ(.15); } return; }
  if (d.kind === 'bed') return;
  let x, z, y = 0;
  if (d.kind === 'small') { // over the table or the bed it hops up on top
    for (const s of [1.1, .8]) { const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -s); if (r.intersectPlane(pl, hp) && RM.surfaceAt(hp.x, hp.z, k.r) === s) { x = hp.x; z = hp.z; y = s; d.up = true; break; } }
  }
  if (x === undefined) { if (!r.intersectPlane(floorPl, hp)) return; if (d.up) { d.up = false; d.off = [o.position.x - hp.x, o.position.z - hp.z]; } x = hp.x + d.off[0]; z = hp.z + d.off[1]; [x, z] = RM.clampFloor(x, z, k.r); }
  d.at = { x: +x.toFixed(2), z: +z.toFixed(2), r: +o.rotation.y.toFixed(3) };
  o.position.set(x, (d.kind === 'flat' ? .012 : y) + (over ? 0 : .3), z);
});
function endHomeDrag(e) {
  const d = hdrag; if (!d || (e && e.pointerId !== d.pid)) return; hdrag = null;
  const o = d.o;
  if (!d.moved) {
    if (d.kind === 'wall' || d.kind === 'bed') { o.userData.wiggle = T; homeEv({ type: 'tap', id: d.id }); return; }
    const from = o.rotation.y, to = from + Math.PI / 4; o.userData.spin = { from, to, t0: T };
    d.at = { ...d.at, r: +(((to % TAU) + TAU) % TAU).toFixed(3) }; o.userData.spot = JSON.stringify(d.at);
    homeEv({ type: 'turn', id: d.id, at: d.at }); return;
  }
  if (d.over) { o.visible = false; homeEv({ type: 'away', id: d.id }); return; }
  RM.placeHome(d.id, o, d.at); o.userData.spot = JSON.stringify(d.at); o.userData.baseY = o.position.y;
  homeEv({ type: 'move', id: d.id, at: d.at });
}
canvas.addEventListener('pointerup', endHomeDrag);
canvas.addEventListener('pointercancel', endHomeDrag);

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
// flat or wide home things are seen from higher up, or closer, so they fill their picture
const HOME_VIEW = { rug: { yaw: .2, pitch: .95, pad: 1.0 }, bunting: { yaw: 0, pitch: .1, pad: .8 } };
G.Shop3D = {
  good: id => bake('good:' + id, () => goodModel(id), { yaw: .45, pitch: .4, pad: 1.08 }),
  // the value is printed flat on top (white with a dark outline) so 1, 5 and 10 read clearly at chip size
  coin: v => bake('coin:' + v, () => D.coin(+v || 1, { plain: true }), { yaw: 0, pitch: 0, focus: [0, 0, 0], height: 2.02, post: (x, px) => coinLabel(x, px, +v || 1) }),
  portrait: spec => {
    const key = 'p:' + JSON.stringify(spec), hat = (spec.acc || []).some(a => ['tricorn', 'sunhat', 'tiara', 'flowercrown'].includes(a));
    if (!pics.has(key)) bakeLog.push(key), pics.set(key, baker.portrait(portraitModel(spec), { height: spec.species === 'owl' ? 1.45 : spec.species === 'fairy' ? 1.55 : hat ? 1.5 : 1.3, dy: spec.species === 'fairy' ? .12 : spec.species === 'rabbit' ? .1 : hat ? .12 : 0 }));
    return pics.get(key);
  },
  decor: id => bake('d:' + id + (id === 'sign' ? signText : ''), THUMB[id] || (() => new THREE.Group()), { yaw: .35, pitch: .3, pad: 1.1, ...(DECOR_VIEW[id] || {}) }),
  garden: id => bake('g:' + id, VL.GARDEN_MODELS[id] || (() => new THREE.Group()), { yaw: .35, pitch: .35, pad: 1.1 }),
  treasure: id => bake('t:' + id, VL.TREASURE_MODELS[id] || (() => new THREE.Group()), { yaw: .3, pitch: .3, pad: 1.15 }),
  home: id => bake('h:' + id, () => RM.HOME_THUMB(id), { yaw: .35, pitch: .3, pad: 1.12, ...(HOME_VIEW[id] || (id.startsWith('wp-') ? { yaw: 0, pitch: .05 } : {})) }),
  // a free spot in her house for something taken out of the tray (taken: {id: spot} of what is already in the room)
  homeSpot: (id, taken) => RM.freeSpot(id, taken),
};
G.__ts3d = { homeHit: (x, y) => (homeHit({ clientX: x, clientY: y }) || {}).userData?.homeId, get hdrag() { return hdrag && hdrag.id; }, R, scene, cam, bakeLog, stats, actors, settle, get dpr() { return dpr; }, CAMS, SPOTS, D, bakeObj, makeModel };
if (G.__ts && G.__ts.on3d) G.__ts.on3d();

// warm up: build and compile the whole cast while the player reads, so nobody stutters in later
(function warm() {
  let list = [];
  try { list = Object.entries(CAST).filter(([id]) => id !== 'clover').map(([, c]) => c.spec); } catch (e) {} // eslint-disable-line no-undef
  const step = () => {
    const spec = list.shift();
    if (!spec) { const st = game(); if (st && st.day >= 4 && !VG) { ensureVillage(); const was = village.visible; village.visible = true; try { R.compile(scene, cam); } catch (e) {} village.visible = was; } return; }
    try { const o = D.instance(model(spec)); o.position.set(0, -50, 0); scene.add(o); R.compile(scene, cam); scene.remove(o); } catch (e) {}
    setTimeout(step, 120);
  };
  setTimeout(step, 1500);
})();
