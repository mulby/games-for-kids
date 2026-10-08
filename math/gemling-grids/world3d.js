// Gemling Grids in 3D.
// The game itself (puzzles, touch, saves, voice, cards, grown-ups view) is unchanged and still lives in index.html's DOM.
// This module draws an underground crystal cave behind every screen and swaps the drawings for 3D:
//  - live models follow their DOM element each frame: the carved stone puzzle board, the Gemling tray,
//    Nib (felt mole) beside the caption, the title crystal, the gem shelf, the pouch and Nib's nook
//  - still things (every Gemling piece, gems, doors, map caves, the geode, cards' creatures, Nib's other poses)
//    are rendered once to images and swapped in for the old SVG drawings, so layout, CSS animation and touch
//    keep working. Numbers, sparkle dots, nook outlines and badges stay crisp SVG/HTML on top.
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
import * as M from './models3d.js';

const G = window;
const qs = (s, el = document) => el.querySelector(s);

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
let R;
try {
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { console.warn('[3d] off:', e && e.message); throw e; }
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.08;
R.autoClear = false;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
R.setClearColor('#120e22', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(256);
let RM_ = false; try { RM_ = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
const RM = () => RM_;
const screen = () => { try { return ui.screen || 'title'; } catch (e) { return 'title'; } };
const game = () => { try { return { S, cur }; } catch (e) { return {}; } };

/* ------------------------------------------------------------------ the crystal cave (meters) */
const bg = new THREE.Scene();
bg.fog = new THREE.Fog('#1d1636', 16, 58);
const bgCam = new THREE.PerspectiveCamera(42, 1, .1, 200);
const bgL = K.toyLights(bg, { sky: '#b9a8ff', ground: '#2c2244', hemiI: 1.05, key: '#ffeedd', keyI: 1.5, fill: '#c9b6ff', fillI: .55, dir: [-5, 12, 7] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(1024, 1024); bgL.key.shadow.bias = -.002;
Object.assign(bgL.key.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 45 });
const plCrystal = new THREE.PointLight('#c7a2ff', 40, 20, 1.6); plCrystal.position.set(-4.5, 3.5, -11); bg.add(plCrystal);
const plPool = new THREE.PointLight('#7fe6ff', 16, 12, 1.8); plPool.position.set(-7, 1.6, -1); bg.add(plPool);

function floorY(x, z) {
  const d = Math.hypot(x, z * 1.1);
  let y = Math.sin(x * .45) * .12 + Math.cos(z * .38 + 1) * .1 + Math.sin(x * .9 + z * .7) * .05;
  if (d > 12) y += (d - 12) ** 2 * .07;
  y -= .45 * Math.exp(-((x + 7) ** 2 + (z + 1) ** 2) / 7);
  return y;
}
const rnd = M.rng(42);
(function cave() {
  // floor rising into walls
  const g = new THREE.PlaneGeometry(96, 96, 96, 96); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const cFloor = new THREE.Color('#3a3052'), cWall = new THREE.Color('#4d4274'), cMoss = new THREE.Color('#3c5a4e'), cDark = new THREE.Color('#2a2240');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = floorY(x, z); p.setY(i, y);
    const n = Math.sin(x * .7 + z * .3) * Math.sin(z * .9 - x * .2);
    c.copy(cFloor).lerp(cWall, Math.min(1, Math.max(0, y / 6)));
    if (y < 1 && n > .35) c.lerp(cMoss, (n - .35) * 1.4);
    if (n < -.5) c.lerp(cDark, .5);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const floor = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })); floor.receiveShadow = true; bg.add(floor);
  // ceiling dome
  const dg = new THREE.SphereGeometry(40, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2); const dp = dg.attributes.position, dc = new Float32Array(dp.count * 3);
  for (let i = 0; i < dp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(dp, i); const n = 1 + .05 * Math.sin(v.x * .3 + 1) * Math.sin(v.z * .27) + .03 * Math.sin(v.y * .5 + v.x * .2);
    v.multiplyScalar(n); dp.setXYZ(i, v.x, v.y, v.z);
    c.set('#271f3f').lerp(new THREE.Color('#3b3160'), .5 + .5 * Math.sin(v.x * .2 + v.y * .3)); dc.set([c.r, c.g, c.b], i * 3);
  }
  dg.setAttribute('color', new THREE.BufferAttribute(dc, 3)); dg.computeVertexNormals();
  const dome = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.BackSide })); dome.position.y = -8; bg.add(dome);
  const domeY = r => Math.sqrt(Math.max(0, 1600 - r * r)) - 8;
  // stalactites and stalagmites, boulders, moss: one draw call each
  const rock = K.mat('#3b3158', { felt: true, flat: true });
  const tite = new THREE.Group(); tite.add(K.mesh(new THREE.ConeGeometry(.5, 3, 7), rock, [0, -1.5, 0], 1, [Math.PI, 0, 0])); K.freeze(tite);
  const tites = []; for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, r = 4 + rnd() * 22; tites.push({ p: [Math.cos(a) * r, domeY(r) + .6, Math.sin(a) * r], s: .6 + rnd() * 1.3, ry: rnd() * 6 }); }
  bg.add(K.scatter(tite, tites));
  const mite = new THREE.Group(); mite.add(K.mesh(new THREE.ConeGeometry(.45, 2.2, 7), K.mat('#463b68', { felt: true, flat: true }), [0, 1.1, 0])); K.freeze(mite);
  const mites = []; for (let i = 0; i < 26; i++) { const a = Math.PI * (.9 + rnd() * 1.2), r = 11 + rnd() * 6, x = Math.cos(a) * r, z = Math.sin(a) * r * .9; mites.push({ p: [x, floorY(x, z) - .2, z], s: .5 + rnd() * 1.1, ry: rnd() * 6 }); }
  bg.add(K.scatter(mite, mites));
  const bould = new THREE.Group(); bould.add(M.gball(K.mat('#4a3f6c', { felt: true, flat: true }), [0, .3, 0], [1, .75, .9])); K.freeze(bould);
  const bs = []; for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, r = 9.5 + rnd() * 8, x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 6) continue; bs.push({ p: [x, floorY(x, z) - .2, z], s: .5 + rnd() * 1.4, ry: rnd() * 6 }); }
  bg.add(K.scatter(bould, bs));
  const moss = new THREE.Group(); moss.add(K.mesh(new THREE.CircleGeometry(1, 14), K.mat('#3a6650', { felt: true }), [0, .03, 0], [1, 1, 1], [-Math.PI / 2, 0, 0])); K.freeze(moss);
  const ms = []; for (let i = 0; i < 16; i++) { const x = (rnd() - .5) * 22, z = -12 + rnd() * 14; ms.push({ p: [x, floorY(x, z) + .02, z], s: .4 + rnd() * .9, ry: 0 }); }
  bg.add(K.scatter(moss, ms));
  // crystal clusters in five Gemling colours
  const COLS = ['#ff9ec7', '#7fd8ff', '#ffd86b', '#8fe8c4', '#b9a6e8'];
  COLS.forEach((cl, ci) => {
    const tpl = M.cluster(cl, { n: 6, seed: ci * 7 + 1, glow: .6 });
    const items = [];
    for (let i = 0; i < 8; i++) { const a = Math.PI * (.95 + rnd() * 1.1), r = 8 + rnd() * 9, x = Math.cos(a) * r, z = Math.sin(a) * r * .85; items.push({ p: [x, floorY(x, z) - .05, z], s: .9 + rnd() * 1.8, ry: rnd() * 6 }); }
    for (let i = 0; i < 2; i++) { const x = (rnd() - .5) * 14, z = -2 - rnd() * 6; items.push({ p: [x, floorY(x, z) - .05, z], s: .5 + rnd() * .5, ry: rnd() * 6 }); }
    bg.add(K.scatter(tpl, items));
  });
  // glowing mushrooms
  ['#ff8fc8', '#7fe8e0'].forEach((cl, k) => {
    const m = new THREE.Group();
    m.add(M.lathe([[0, 0], [.14, 0], [.15, .25], [.11, .55], [0, .57]], K.mat('#fff1d6', { felt: true }), 10));
    m.add(M.lathe([[0, .82], [.28, .78], [.48, .64], [.55, .52], [.38, .48], [0, .52]], K.mat(cl, { glow: 1.1 }), 16));
    K.freeze(m);
    const items = []; for (let i = 0; i < 14; i++) { const a = Math.PI * (1 + rnd()), r = 6 + rnd() * 8, x = Math.cos(a) * r + (k ? -3 : 3), z = Math.sin(a) * r * .7 + 1; items.push({ p: [x, floorY(x, z), z], s: .5 + rnd() * .7, ry: rnd() * 6 }); }
    bg.add(K.scatter(m, items));
  });
})();
/* the great crystal, the pool and Nib's mine tunnel */
const glows = [];
const still = new THREE.Group();
(function landmarks() {
  const big = M.titleCrystal(); big.scale.setScalar(4.2); big.position.set(-5.5, floorY(-5.5, -14) - .9, -14); bg.add(big);
  const bgw = K.glow('#c9a6ff', 16, .5); bgw.position.set(-5.5, 4.5, -13.5); bg.add(bgw); glows.push(bgw);
  for (const [x, z, cl, s] of [[-12, -7, '#7fd8ff', 6], [12, -6, '#ff9ec7', 6], [-9, -13, '#ffd86b', 5], [6, -15, '#8fe8c4', 5]]) { const gw = K.glow(cl, s, .32); gw.position.set(x, floorY(x, z) + 1.5, z); bg.add(gw); glows.push(gw); }
  // pool
  const water = new THREE.ShaderMaterial({
    transparent: true, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; varying vec3 vW; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ float r=length(vUv-.5)*2.; float w = n(vW.xz*1.6+vec2(t*.3,t*.2))*n(vW.xz*.8-vec2(t*.2,0.)); vec3 col = mix(vec3(.08,.22,.38), vec3(.25,.75,.9), w); col += vec3(.8,1.,1.)*pow(n(vW.xz*5.+t*.7),14.)*1.2; gl_FragColor=vec4(col*.85, .88*smoothstep(1.,.85,r)); }'
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), water); pool.rotation.x = -Math.PI / 2; pool.position.set(-7, -.16, -1); pool.renderOrder = 1; bg.add(pool); bg.userData.water = water;
  const pg = K.glow('#7fe6ff', 7, .28); pg.position.set(-7, .4, -1); bg.add(pg); glows.push(pg);
  const st = K.mat('#5a4f80', { felt: true, flat: true });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = -7 + Math.cos(a) * 3.3, z = -1 + Math.sin(a) * 3.3; still.add(M.gball(st, [x, floorY(x, z) + .05, z], [.45 + rnd() * .3, .25 + rnd() * .15, .4])); }
  // mine tunnel: a rock face with timbers, a hanging lantern, rails and a little cart of gems
  const tx = 9.5, tz = -12.5, ty = floorY(tx, tz);
  still.add(M.gball(K.mat('#463b68', { felt: true, flat: true }), [tx, ty + 1.6, tz - 2.2], [5.5, 4.4, 2.6]));
  still.add(K.mesh(new THREE.CircleGeometry(1.35, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#07050e' }), [tx, ty + 1.9, tz + .05]));
  still.add(K.mesh(new THREE.PlaneGeometry(2.7, 1.9), new THREE.MeshBasicMaterial({ color: '#07050e' }), [tx, ty + .95, tz + .05]));
  const wood = K.mat('#7a5a3a', { felt: true }), wood2 = K.mat('#5e4430', { felt: true });
  for (const sx of [-1, 1]) still.add(K.mesh(new THREE.BoxGeometry(.32, 3.6, .32), wood, [tx + sx * 1.55, ty + 1.7, tz + .3], 1, [0, 0, sx * .04]));
  still.add(K.mesh(new THREE.BoxGeometry(3.8, .36, .4), wood, [tx, ty + 3.45, tz + .3]));
  const lan = new THREE.Group(); lan.position.set(tx + 1.1, ty + 2.8, tz + .7);
  lan.add(K.mesh(new THREE.CylinderGeometry(.01, .01, .5, 4), wood2, [0, .4, 0]));
  lan.add(M.lathe([[0, -.22], [.15, -.2], [.2, 0], [.15, .2], [0, .22]], K.mat('#ffe2a0', { glow: 1.6 }), 12));
  lan.add(K.mesh(new THREE.CylinderGeometry(.1, .18, .08, 10), K.mat('#c99a3a', { metal: true }), [0, .24, 0]));
  still.add(lan); const lg = K.glow('#ffcf66', 3, .7); lg.position.copy(lan.position); bg.add(lg); glows.push(lg);
  const rail = K.mat('#9a93b8', { metal: true, shine: .05 });
  const railPts = s => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, x = tx - t * 7 + Math.sin(t * 2.4) * 1.3 + s * .45, z = tz + .4 + t * 10; pts.push([x, floorY(x, z) + .08, z]); } return pts; };
  for (const s of [-1, 1]) still.add(K.tube(railPts(s), .045, rail, 40, 5));
  const sp = railPts(0); for (let i = 0; i < sp.length; i++) still.add(K.mesh(new THREE.BoxGeometry(1.3, .08, .25), wood2, [sp[i][0], sp[i][1] - .04, sp[i][2]], 1, [0, -.3 + i * .03, 0]));
  const cart = new THREE.Group(); const [cx, , cz] = sp[9]; cart.position.set(cx, floorY(cx, cz) + .2, cz); cart.rotation.y = -.15;
  cart.add(K.mesh(new THREE.BoxGeometry(1.2, .6, .8), wood, [0, .45, 0]));
  cart.add(K.mesh(new THREE.BoxGeometry(1.26, .1, .86), K.mat('#c99a3a', { metal: true }), [0, .76, 0]));
  for (const [x, z] of [[-.4, .45], [.4, .45], [-.4, -.45], [.4, -.45]]) cart.add(K.mesh(new THREE.CylinderGeometry(.16, .16, .08, 14), K.mat('#3a3456', { felt: true }), [x, .14, z], 1, [Math.PI / 2, 0, 0]));
  ['#ff9ec7', '#7fd8ff', '#ffd86b', '#b9a6e8', '#8fe8c4', '#ff9ec7'].forEach((cl, i) => cart.add(M.gball(M.crys(cl, { glow: .6 }), [-.35 + (i % 3) * .35, .82 + (i > 2 ? .08 : 0), -.15 + (i > 2 ? .25 : 0)], .17)));
  still.add(cart);
  bg.add(K.freeze(still));
})();
/* a family of Gemlings by the great crystal (they bob and look around) */
const KINDS_ = () => { try { return KINDS; } catch (e) { return null; } };
const PAL = v => (KINDS_() || [])[v] || { color: '#b77cff', dark: '#6c34c4', light: '#ead9ff' };
const family = [];
[[1, -3.3, -6.2, .45], [2, -1.9, -7.2, .25], [3, 1.9, -7.2, -.25], [4, 3.3, -6.3, -.4], [5, 4.9, -8, -.6]].forEach(([v, x, z, ry]) => {
  const o = M.gemling(v, { pal: PAL(v) }); o.position.set(x, floorY(x, z), z); o.rotation.y = ry; o.scale.setScalar(1.15);
  o.userData = { v, base: o.position.y, ry, t0: v * 1.7 }; bg.add(o); family.push(o);
});
/* drifting crystal motes */
const motes = (function () {
  const n = 70, pos = new Float32Array(n * 3), home = [], ph = new Float32Array(n), colA = new Float32Array(n * 3), c = new THREE.Color();
  const cols = ['#ffb8e0', '#9fe4ff', '#ffe49a', '#b5f5d8', '#d8c8ff'];
  for (let i = 0; i < n; i++) { home.push([(rnd() - .5) * 30, .4 + rnd() * 7, -1 - rnd() * 15]); ph[i] = rnd() * 20; c.set(cols[i % 5]); colA.set([c.r, c.g, c.b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.setAttribute('col', new THREE.BufferAttribute(colA, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 }, map: { value: K.glowTexture() } },
    vertexShader: 'attribute float ph; attribute vec3 col; uniform float t,px; varying float a; varying vec3 vc; void main(){ vc=col; a = .25+.75*max(0., sin(t*1.3+ph*3.)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 240.*px/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float a; varying vec3 vc; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vc*c.a*a, c.a*a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; bg.add(pts);
  return { pos, home, ph, g, m, n };
})();

/* camera framing per screen (landscape iPad first; portrait widens the view) */
const VIEWS = {
  title: { pos: [0, 1.4, 4], at: [0, 2.7, -10] },
  map: { pos: [0, 19, 7], at: [0, 0, -4] },
  doors: { pos: [6.2, 2.1, 2.5], at: [9.6, 2.1, -12] },
  pz: { pos: [-2, 2.6, 6], at: [-7, 1.4, -6] },
  binder: { pos: [0, 2.2, 4], at: [-4, 3.4, -13] },
  shelfScr: { pos: [-3.5, 2.2, 4], at: [-9, 1.8, -9] },
  nook: { pos: [2, 1.6, 6], at: [5, 1.5, -8] }
};
const camPos = new THREE.Vector3(...VIEWS.title.pos), camAt = new THREE.Vector3(...VIEWS.title.at);
let parX = 0, tgtParX = 0;
addEventListener('pointermove', e => { tgtParX = (e.clientX / innerWidth - .5); }, { passive: true });

/* ------------------------------------------------------------------ foreground: 3D models pinned to DOM elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#ded6ff', ground: '#4a4068', hemiI: 1.3, key: '#fff3e0', keyI: 2.0, fill: '#d6c4ff', fillI: .7, dir: [-.45, .75, .8] });
const pcam = new THREE.PerspectiveCamera(20, 1, 10, 30000);
let W = 0, H = 0;
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false);
  bgCam.aspect = W / H;
  const fovH = 66; bgCam.fov = Math.min(80, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovH / 2)) / bgCam.aspect)));
  bgCam.updateProjectionMatrix();
  pcam.aspect = W / H; pcam.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); pcam.lookAt(0, 0, 0); pcam.updateProjectionMatrix();
}
const DPR_MAX = Math.min(devicePixelRatio || 1, 1.75);
let dpr = DPR_MAX;
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', sizeAll);

const live = new Map();            // element -> { obj, key }
const seen = new Set();
function px(r) { return [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)]; }
function disposeTree(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }

/* --- stone materials for the carved pieces --- */
const stoneTop = K.mat('#5e5694', { felt: true }), stoneSide = K.mat('#3a3466', { felt: true });
const holeBottom = K.mat('#141026', { felt: true }), plugM = K.mat('#6e68a0', { felt: true });
function inlayMat() { return new THREE.MeshStandardMaterial({ color: '#e8c26b', metalness: .6, roughness: .3, emissive: '#ffcf5a', emissiveIntensity: .12 }); }
function inlay(w, h, r, rad, m, z) {
  const pts = K.roundRectShape(w, h, r).getPoints(10).map(p => new THREE.Vector3(p.x, p.y, z));
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), Math.max(60, pts.length * 2), rad, 6, true), m);
}
function carvedSlab(w, h, r, D, holes, bevel = 5) {
  const s = K.roundRectShape(w, h, r);
  for (const [x, y, rr] of holes) { const hp = new THREE.Path(); hp.absarc(x, y, rr, 0, Math.PI * 2, true); s.holes.push(hp); }
  const g = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 22 });
  g.translate(0, 0, -D);
  const m = new THREE.Mesh(g, [stoneTop, stoneSide]); m.userData.noMerge = true;
  return m;
}
function rectIn(el, r0) { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2 - (r0.left + r0.width / 2), y: -(b.top + b.height / 2 - (r0.top + r0.height / 2)), w: b.width, h: b.height }; }

/* --- the puzzle board: a stone slab carved with one nook per cell --- */
function boardKey(el) { const cells = el.querySelectorAll('#grid .cell'); return [el.offsetWidth, el.offsetHeight, cells.length, [...cells].map(c => c.classList.contains('given') ? 1 : 0).join('')].join('|'); }
function buildBoard(el) {
  const w = el.offsetWidth, h = el.offsetHeight, r0 = el.getBoundingClientRect();
  const cells = [...el.querySelectorAll('#grid .cell')].map(c => ({ ...rectIn(c, r0), given: c.classList.contains('given') }));
  const cs = cells.length ? cells[0].w : 80, D = Math.max(16, cs * .28);
  const root = new THREE.Group();
  root.add(carvedSlab(w, h, 30, D, cells.map(c => [c.x, c.y, c.w * .41])));
  const back = K.slab(K.roundRectShape(w - 12, h - 12, 26), 6, holeBottom, 0); back.position.z = -D + 1; root.add(back);
  cells.forEach(c => { if (c.given) root.add(K.mesh(K.geo('gg-plug', () => new THREE.CylinderGeometry(1, 1.05, 1, 28)), plugM, [c.x, c.y, -D * .38], [c.w * .395, D * .62, c.w * .395], [Math.PI / 2, 0, 0])); });
  const im = inlayMat(); root.add(inlay(w - 13, h - 13, 24, 2.2, im, 5.5));
  const cl = [['#ff9ec7', -w / 2 + 8, -h / 2 + 10, .7, 3], ['#7fd8ff', w / 2 - 8, h / 2 - 10, -2.4, 5], ['#ffd86b', w / 2 - 12, -h / 2 + 8, -.7, 9]];
  for (const [c, x, y, rz, seed] of cl) { const k = M.cluster(c, { n: 5, seed, glow: .55, base: null }); k.scale.setScalar(cs * .42); k.position.set(x, y, -D * .4); k.rotation.set(.2, 0, rz); root.add(k); }
  K.freeze(root);
  root.userData = { kind: 'board', inlay: im, glow: 0 };
  return root;
}
/* --- the tray the Gemlings wait in --- */
function trayKey(el) { const r0 = el.getBoundingClientRect(); return [el.offsetWidth, el.offsetHeight, ...[...el.querySelectorAll('.tpiece')].map(t => { const r = rectIn(t, r0); return Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.w); })].join('|'); }
function buildTray(el) {
  const w = el.offsetWidth, h = el.offsetHeight, r0 = el.getBoundingClientRect();
  const root = new THREE.Group();
  root.add(carvedSlab(w, h, 28, 18, [], 4));
  root.add(inlay(w - 12, h - 12, 22, 1.8, inlayMat(), 4.5));
  for (const t of el.querySelectorAll('.tpiece')) { const r = rectIn(t, r0); root.add(K.mesh(K.geo('gg-dish', () => new THREE.CircleGeometry(1, 28)), K.mat('#2c2752', { felt: true }), [r.x, r.y - r.h * .08, 4.6], [r.w * .42, r.w * .3, 1])); }
  return K.freeze(root);
}
/* --- the gem shelf cabinet and the felt pouch --- */
function shelfKey(el) { return [el.offsetWidth, el.offsetHeight, el.scrollTop, el.querySelectorAll('.plank').length].join('|'); }
function buildShelf(el) {
  const w = el.offsetWidth, h = el.offsetHeight, r0 = el.getBoundingClientRect();
  const root = new THREE.Group();
  const wood = K.mat('#6b4423', { felt: true }), dark = K.mat('#3a2616', { felt: true }), plank = K.mat('#a8743e', { felt: true });
  const back = K.slab(K.roundRectShape(w - 10, h - 10, 20), 8, dark, 0); back.position.z = -34; root.add(back);
  const ring = K.roundRectShape(w, h, 24); ring.holes.push(K.roundRectShape(w - 26, h - 26, 14));
  const fr = K.slab(ring, 44, wood, 4); fr.position.z = -14; root.add(fr);
  for (const p of el.querySelectorAll('.plank')) {
    const b = p.getBoundingClientRect(); if (b.bottom < r0.top + 10 || b.bottom > r0.bottom - 4) continue;
    const y = -(b.bottom - 7 - (r0.top + r0.height / 2)), x = b.left + b.width / 2 - (r0.left + r0.width / 2);
    root.add(K.slab(K.roundRectShape(b.width + 6, 14, 4), 38, plank, 2).translateX(x).translateY(y).translateZ(-14));
    root.add(K.mesh(new THREE.BoxGeometry(b.width, 5, 30), dark, [x, y - 9, -18]));
  }
  for (const sx of [-1, 1]) root.add(K.ball(K.mat('#c99a3a', { metal: true }), [sx * (w / 2 - 14), h / 2 - 14, 10], 6));
  return K.freeze(root);
}
function buildPouch(el) {
  const w = el.offsetWidth, h = el.offsetHeight, root = new THREE.Group();
  root.add(K.slab(K.roundRectShape(w, h, 24), 14, K.mat('#3b3466', { felt: true }), 5));
  const pts = K.roundRectShape(w - 16, h - 16, 18).getSpacedPoints(Math.round((w + h) * 2 / 14));
  const st = K.mat('#d9ccff', { felt: true });
  pts.forEach(p => root.add(K.mesh(K.SPH(8), st, [p.x, p.y, 12.5], [3.2, 1.4, 1])));
  root.position.z = -10;
  return K.freeze(root);
}
/* --- Nib --- */
const nibTpl = new Map();
function nibLook() { const { S: s } = game(); if (!s) return {}; const hat = s.nib.wearing || null; return { hat, scarf: s.nib.items.indexOf('scarf') >= 0 && hat !== 'scarf' }; }
function nibFor(look) {
  const k = JSON.stringify(look);
  if (!nibTpl.has(k)) nibTpl.set(k, M.nib(look));
  const t = nibTpl.get(k), ud = t.userData; t.userData = {}; const c = t.clone(true); t.userData = ud;
  c.userData = { ...t.userData, t0: Math.random() * 10, hop: 0 };
  c.userData.body = c.getObjectByName('nbody'); c.userData.eyes = c.getObjectByName('neyes'); c.userData.paws = [c.getObjectByName('npawL'), c.getObjectByName('npawR')];
  return c;
}
/* --- Nib's nook: a little burrow room (built in the nook drawing's 600x420 coordinates) --- */
function nookState() { const { S: s } = game(); if (!s) return {}; return { items: s.nib.items.slice().sort(), gems: s.gems.owned.slice(-12).map(g => g.type), look: nibLook() }; }
function nookKey(el) { const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height) + JSON.stringify(nookState()); }
const FLOOR = 336;
function buildNook(el) {
  const r = el.getBoundingClientRect(), k = r.width / 600, st = nookState(), has = id => (st.items || []).indexOf(id) >= 0;
  const P = (x, y, z = 0) => [(x - 300) * k, -(y - 210) * k, z * k];
  const root = new THREE.Group(), inner = new THREE.Group(); inner.rotation.x = .13; root.add(inner);
  const arch = (s = 1) => { const ax = x => 300 + (x - 300) * s, ay = y => 410 + (y - 410) * s; const sh = new THREE.Shape(); const v = (x, y) => [(ax(x) - 300) * k, -(ay(y) - 210) * k];
    sh.moveTo(...v(20, 410)); sh.quadraticCurveTo(...v(10, 60), ...v(300, 30)); sh.quadraticCurveTo(...v(590, 60), ...v(580, 410)); sh.closePath(); return sh; };
  const wall = K.mat('#4c3c60', { felt: true }), earth = K.mat('#3a2c4a', { felt: true }), ground = K.mat('#5a4636', { felt: true });
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(arch(1), { depth: 10 * k, bevelEnabled: false, curveSegments: 24 }), wall); back.position.z = -175 * k; inner.add(back);
  const ring = arch(1.1); ring.holes.push(arch(1));
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 180 * k, bevelEnabled: true, bevelThickness: 6 * k, bevelSize: 6 * k, bevelSegments: 3, curveSegments: 24 }), earth); shell.position.z = -168 * k; inner.add(shell);
  // lumpy felt stones and moss around the burrow mouth
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const stoneM = [K.mat('#4e3e62', { felt: true }), K.mat('#5c4a6e', { felt: true }), K.mat('#443652', { felt: true })], mossM = K.mat('#4f8a62', { felt: true });
  const bez = (t, a, c, b) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  for (let i = 0; i <= 22; i++) {
    const u = i / 22, h = u < .5, t = h ? u * 2 : (u - .5) * 2, s = 1.06;
    const x0 = h ? bez(t, 20, 10, 300) : bez(t, 300, 590, 580), y0 = h ? bez(t, 410, 60, 30) : bez(t, 30, 60, 410);
    const x = 300 + (x0 - 300) * s, y = 410 + (y0 - 410) * s, rr = 15 + rnd() * 11;
    inner.add(K.ball(stoneM[i % 3], P(x + (rnd() - .5) * 8, y + (rnd() - .5) * 8, 14), [rr * k, rr * .85 * k, rr * .7 * k], [0, 0, rnd() * 3]));
    if (y < 260 && i % 3 === 1) inner.add(K.ball(mossM, P(x, y - rr * .6, 22), [rr * .8 * k, rr * .4 * k, rr * .5 * k]));
  }
  // a soft earthen floor that bulges out of the doorway
  const dome = { cx: 300, cz: -60, rx: 330, rz: 150, h: 70 };
  const floorAt = (x, z) => { const a = 1 - ((x - dome.cx) / dome.rx) ** 2 - ((z - dome.cz) / dome.rz) ** 2; return FLOOR + dome.h - dome.h * Math.sqrt(Math.max(0, a)); };
  inner.add(K.mesh(new THREE.SphereGeometry(1, 48, 10, 0, Math.PI * 2, 0, Math.PI / 2), ground, P(dome.cx, FLOOR + dome.h, dome.cz), [dome.rx * k, dome.h * k, dome.rz * k]));
  for (let i = 0; i < 15; i++) {
    const x = 40 + i * 37 + (rnd() - .5) * 10, a = Math.max(0, 1 - ((x - dome.cx) / dome.rx) ** 2), z = dome.cz + dome.rz * Math.sqrt(a) - 6, rr = 12 + rnd() * 8;
    inner.add(K.ball(i % 4 === 1 ? mossM : stoneM[i % 3], P(x, FLOOR + dome.h - 6, z), [rr * 1.3 * k, rr * .75 * k, rr * k]));
  }
  for (const [x, z, c] of [[215, 40, '#ff9ec7'], [395, 45, '#7fd8ff'], [470, 20, '#ffd86b']]) { const cl = M.cluster(c, { n: 3, seed: x, glow: .5, base: null }); cl.scale.setScalar(26 * k); cl.position.set(...P(x, floorAt(x, z), z)); inner.add(cl); }
  // roots, wall crystals and the gem ledge
  for (const [x, len] of [[170, 70], [250, 40], [360, 55], [440, 80]]) inner.add(K.tube([P(x, 40, -150), P(x + 8, 40 + len * .5, -146), P(x - 4, 40 + len, -140)], 3.5 * k, K.mat('#6b4a33', { felt: true }), 8, 5));
  for (const [x, y, c, s] of [[70, 250, '#7fd8ff', 1], [540, 220, '#ff9ec7', .9], [110, 90, '#b9a6e8', .7], [500, 80, '#ffd86b', .7]]) { const cl = M.cluster(c, { n: 5, seed: x, glow: .6, base: null }); cl.scale.setScalar(60 * k * s); cl.position.set(...P(x, y, -150)); cl.rotation.set(1.2, 0, (x < 300 ? -1 : 1) * .5); inner.add(cl); }
  const ly = x => { const t = (x - 80) / 440; return 140 - 60 * t + 60 * t * t; };
  const lp = []; for (let i = 0; i <= 16; i++) { const x = 80 + i * 27.5; lp.push(P(x, ly(x) + 4, -150)); }
  const ledge = K.tube(lp, 7 * k, K.mat('#8a5a2b', { felt: true }), 40, 8); ledge.scale.z = 1.8; ledge.position.z = 120 * k; inner.add(ledge);
  (st.gems || []).slice().reverse().forEach((t, i) => { const x = 118 + i * 34; const g = M.gemStone(t); g.scale.setScalar(36 * k); g.position.set(...P(x, ly(x) - 3, -146)); inner.add(g); });
  // furniture
  const item = (id, x, z, s, ry = 0) => { if (!has(id)) return; const o = M.nookItem(id); o.scale.setScalar(s * k); o.position.set(...P(x, floorAt(x, z) + 2, z)); o.rotation.y = ry; inner.add(o); };
  item('rug', 300, 30, 250); item('lamp', 82, -70, 150, .2); item('chair', 160, -20, 140, .35); item('bed', 470, -50, 160, -.35); item('books', 535, -135, 130, -.2); item('telescope', 405, -120, 130, -.4);
  if (has('lamp')) { const gw = K.glow('#ffb8d8', 260 * k, .35); gw.position.set(...P(82, FLOOR - 90, -60)); inner.add(gw); }
  K.freeze(root);
  // Nib (live) stands where the drawing's tap target is
  const n = nibFor(st.look || {}); n.userData.live = true; n.scale.setScalar(170 * k); n.position.set(...P(305, 340, 30)); n.rotation.y = -.15; inner.add(n);
  root.userData = { kind: 'nook', nib: n };
  return root;
}

/* anchor kinds: which DOM elements get a live 3D model, and how it sits on them */
const KINDS3 = [
  { sel: '#gridWrap', key: boardKey, make: el => buildBoard(el),
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); const u = o.userData, on = el.classList.contains('glowall') ? 1 : 0; u.glow += (on - u.glow) * .08; u.inlay.emissiveIntensity = .12 + u.glow * (1.4 + Math.sin(T * 4) * .3); } },
  { sel: '#tray', key: trayKey, make: el => buildTray(el), place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); } },
  { sel: '#shelf', key: shelfKey, make: el => buildShelf(el), place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); } },
  { sel: '#pouch', key: el => el.offsetWidth + 'x' + el.offsetHeight, make: el => buildPouch(el), place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); } },
  { sel: '#nookScene>svg', key: nookKey, make: el => buildNook(el), place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, -40); } },
  { sel: '#pz .nibbtn, #doors .nibbtn', key: () => JSON.stringify(nibLook()), make: (el, k) => nibFor(JSON.parse(k)),
    place: (o, el, r) => { const s = r.height * .98; const [x] = px(r); o.position.set(x, H / 2 - r.bottom + r.height * .02, 10); o.scale.setScalar(s); o.rotation.y = Math.sin(T * .5 + 1) * .2; } },
  { sel: '#crystalBtn', key: () => 'crystal', make: () => { const c = M.titleCrystal(); const gw = K.glow('#d7c2ff', 2.6, .55); gw.position.y = 1.05; c.add(gw); c.userData.kind = 'crystal'; return c; },
    place: (o, el, r) => { const s = r.width / 2; const [x, y] = px(r); o.position.set(x, y - s, 0); o.scale.setScalar(s); o.rotation.y = T * .35; o.rotation.x = .12; } }
];
function syncAnchors() {
  seen.clear();
  const root = qs('.screen.active');
  if (root) for (const kind of KINDS3) {
    for (const el of root.querySelectorAll(kind.sel)) {
      if (seen.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -50 || r.top > H + 50) continue;
      let rec = live.get(el); const key = kind.key(el);
      if (!rec || rec.key !== key) { if (rec) { fg.remove(rec.obj); disposeTree(rec.obj); } rec = { obj: kind.make(el, key), key }; live.set(el, rec); }
      if (rec.obj.parent !== fg) fg.add(rec.obj);
      kind.place(rec.obj, el, r);
      seen.add(el);
    }
  }
  for (const [el, rec] of live) {
    if (seen.has(el)) continue;
    if (rec.obj.parent) fg.remove(rec.obj);
    if (!el.isConnected) { disposeTree(rec.obj); live.delete(el); }
  }
}
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#nookNib')) return;
  for (const rec of live.values()) if (rec.obj.userData.kind === 'nook') rec.obj.userData.nib.userData.hop = .7;
}, true);

/* ------------------------------------------------------------------ still models swapped in for the SVG drawings */
const T12 = Math.tan(THREE.MathUtils.degToRad(12));
const fr = (cy, hv, aspect) => [0, cy, hv / (1 + T12 * aspect)]; // exact framing for Baker's fixed frame
const bakeAt = (key, build, w, h, view) => baker.bake(key, build, { w: Math.round(w), h: Math.round(h), ...view });
const img = (url, x, y, w, h, extra = '') => `<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${extra}/>`;
const ov = {}; // originals, for fallbacks
function override(name, fn) { if (typeof G[name] !== 'function') return; ov[name] = G[name]; G[name] = function (...a) { try { return fn(...a); } catch (e) { console.warn('[3d]', name, e); return ov[name](...a); } }; }
const DIE_ = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]] };
const FONT = 'Fredoka,ui-rounded,system-ui';

function gemlingURL(v, pal, sleep, belly, pattern, acc, hi) {
  const k = hi ? 3 : 2.4;
  return bakeAt(['gem', v, pal.color, pal.dark, pal.light, sleep, belly, pattern || '', acc || '', k].join('|'), () => M.gemling(v, { pal, sleep, belly, pattern, acc }), 108 * k, 108 * k, M.GEM_VIEW);
}
override('gemSVG', (v, o = {}) => {
  const pal = o.pal || PAL(v), mode = o.mode || 'dots', sl = !!o.sleep;
  const url = gemlingURL(v, pal, sl, mode !== 'plain', o.pattern, o.acc, !!o.pal);
  const d = pal.dark, [tx, ty] = M.TUMMY[v];
  let tum = '';
  if (mode !== 'plain' && mode !== 'face') {
    const dots = op => DIE_[v].map(([dx, dy]) => `<circle cx="${tx + dx * 7.5}" cy="${ty + dy * 6.2}" r="3.7" fill="${d}" opacity="${op}"/>`).join('');
    if (mode === 'dots' || mode === 'dotsNum') tum += dots(1);
    if (mode === 'num') tum += dots(.2) + `<text x="${tx}" y="${ty + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" fill="${d}">${v}</text>`;
    if (mode === 'dotsNum') tum += `<circle cx="84" cy="18" r="12" fill="#fff" stroke="${d}" stroke-width="2.5"/><text x="84" y="24" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="17" fill="${d}">${v}</text>`;
  }
  return `<svg viewBox="${o.vb || '-4 -4 108 108'}" xmlns="http://www.w3.org/2000/svg">${img(url, -4, -4, 108, 108)}${tum}</svg>`;
});
const NIB_VIEW = { frame: fr(.53, 1.08, 1), yaw: 0, pitch: .05 };
override('nibSVG', (o = {}) => {
  const look = { hat: o.hat && o.hat !== 'scarf' ? o.hat : null, scarf: !!(o.scarf || o.hat === 'scarf'), sleepy: !!o.sleepy };
  const url = bakeAt('nib' + JSON.stringify(look), () => M.nib(look), 280, 280, NIB_VIEW);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${img(url, -4, -7, 108, 108)}</svg>`;
});
override('gemStoneSVG', t => {
  t = M.gemStone && ['rose', 'moon', 'ame', 'sun', 'star', 'opal', 'heart'].indexOf(t) >= 0 ? t : 'rose';
  const url = bakeAt('stone-' + t, () => M.gemStone(t), 240, 240, { frame: fr(.5, 1, 1), yaw: 0, pitch: .12 });
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="95" rx="26" ry="4" fill="#0005"/>${img(url, 0, 0, 100, 100)}</svg>`;
});
let crysUID = 0;
override('crystalSVG', () => {
  const url = bakeAt('title-crystal', () => M.titleCrystal(), 420, 420, { frame: fr(1, 2, 1), yaw: 0, pitch: .06 }); const u = ++crysUID;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="c3g_${u}"><stop offset="0" stop-color="#ffd86b" stop-opacity=".55"/><stop offset="1" stop-color="#ffd86b" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="96" fill="url(#c3g_${u})"/>${img(url, 0, 0, 200, 200)}</svg>`;
});
const DOOR_H = { little: 240, big: 300, picture: 280 };
override('doorSVG', d => {
  const H0 = DOOR_H[d.type] || 280, n = d.n || 3;
  const url = bakeAt('door-' + d.type + n, () => M.door(d.type, n, v => M.gemling(v, { pal: PAL(v) })), 400, H0 * 2, { frame: fr(H0 / 200, H0 / 100 * 1.02, 200 / H0), yaw: 0, pitch: .05 });
  return `<svg viewBox="0 0 200 ${H0}" xmlns="http://www.w3.org/2000/svg">${img(url, 0, 0, 200, H0)}</svg>`;
});
override('geodeSVG', stage => {
  const url = bakeAt('geode' + (stage >= 2 ? 1 : 0), () => M.geode(stage >= 2), 420, 420, { frame: fr(1, 2, 1), yaw: 0, pitch: .05 });
  const cracks = ['', '<path d="M100 40 L92 70 L104 86" stroke="#2a2140" stroke-width="4" fill="none" stroke-linecap="round"/>', '<path d="M60 100 L84 108 L96 130 M140 90 L124 112" stroke="#2a2140" stroke-width="4" fill="none" stroke-linecap="round"/>', '<path d="M100 150 L110 128 L104 112" stroke="#2a2140" stroke-width="4" fill="none" stroke-linecap="round"/>'];
  let c = ''; for (let k = 1; k <= stage; k++) c += cracks[k];
  const gl = stage ? `<circle cx="100" cy="100" r="${60 + stage * 12}" fill="#ffd86b" opacity="${stage * .12}"/>` : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${gl}${img(url, 0, 0, 200, 200)}${c}</svg>`;
});
const FURN = ['chair', 'lamp', 'rug', 'books', 'bed', 'telescope'];
override('nookItemSVG', (id, solo) => {
  if (FURN.indexOf(id) < 0) return '';
  const url = bakeAt('furn-' + id, () => M.nookItem(id), 260, 260, { frame: fr(.48, 1.04, 1), yaw: .35, pitch: id === 'rug' ? .6 : .22 });
  return solo ? `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${img(url, 0, 0, 100, 100)}</svg>` : img(url, 0, 0, 100, 100);
});
/* the map: same layout as the 2D map, with 3D cave mounds and crystal lights */
function moundURL(i, state, glowCol, cv) { return bakeAt(['mound', i, state, glowCol].join('|'), () => M.mound(i, state, glowCol, cv.c, cv.c2), 312, 312, { frame: fr(.3, 1.3, 1), yaw: 0, pitch: .42 }); }
function spotURL(col, on) { return bakeAt('spot' + (on ? col : 'off'), () => M.spotCrystal(col, on), 96, 96, { frame: fr(.12, .3, 1), yaw: 0, pitch: .3 }); }
override('renderMap', () => {
  const W0 = 400, step = 190, top = 90, H0 = top + 7 * step + 150, cave = S.cave;
  let s = `<svg class="mapsvg" viewBox="0 0 ${W0} ${H0}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="m3glow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
  const pos = i => [i % 2 ? W0 * .68 : W0 * .32, top + i * step];
  let path = `M${pos(0)[0]} ${pos(0)[1]}`; for (let i = 1; i < 8; i++) { const [x0, y0] = pos(i - 1), [x1, y1] = pos(i); path += ` C${x0} ${y0 + step * .55} ${x1} ${y1 - step * .55} ${x1} ${y1}`; }
  s += `<path d="${path}" stroke="#120e22aa" stroke-width="30" fill="none" stroke-linecap="round"/><path d="${path}" stroke="#ffffff22" stroke-width="20" fill="none" stroke-linecap="round"/><path d="${path}" stroke="#ffe9a8bb" stroke-width="5" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>`;
  for (let i = 0; i < 8; i++) {
    const [x, y] = pos(i); const isCur = i === cave.cavern; const lit = isCur ? cave.wallsLit : (i < cave.cavern ? 6 : (cave.loop > 0 ? 6 : 0));
    const loopCol = (i < cave.cavern) ? cave.loop : cave.loop - 1; const glowCol = loopCol >= 1 ? SECOND_GLOW[i] : CAVERNS[i].c; const full = (i < cave.cavern) || (i > cave.cavern && cave.loop > 0);
    const state = full ? 'full' : isCur ? (lit > 0 ? 'cur' : 'dark') : 'dark';
    s += '<g>';
    if (full) s += `<circle cx="${x}" cy="${y}" r="80" fill="${glowCol}" opacity=".22"/>`;
    if (isCur) s += `<ellipse cx="${x}" cy="${y + 34}" rx="74" ry="24" fill="#ffd86b" opacity=".22"/><ellipse cx="${x}" cy="${y + 34}" rx="70" ry="21" fill="none" stroke="#ffd86b" stroke-width="4" opacity=".9"/>`;
    s += img(moundURL(i, state, glowCol, CAVERNS[i]), x - 66, y - 70, 132, 132);
    for (let k = 0; k < 6; k++) {
      const a = (-160 + k * 28) * Math.PI / 180; const sx = x + Math.cos(a) * 76, sy = y + Math.sin(a) * 76 + 6; const on = k < lit;
      const isNew = ui.justLit && ui.justLit.cavern === i && ui.justLit.spot === k && ui.justLit.loop === cave.loop - (i > cave.cavern && cave.loop > 0 ? 1 : 0) && isCur;
      s += `<g ${isNew ? 'class="spot-new" style="transform-box:fill-box;transform-origin:center"' : ''}>${on ? `<circle cx="${sx}" cy="${sy}" r="15" fill="${glowCol}" opacity=".35"/>` : ''}${img(spotURL(glowCol, on), sx - 15, sy - 21, 30, 30)}</g>`;
    }
    s += `<text class="cavname" x="${x}" y="${y + 86}" text-anchor="middle" font-size="19" font-weight="700" fill="${full || isCur ? '#fffaf0' : '#b8b0e0'}">${CAVERNS[i].name}</text>`;
    if (isCur) s += `<g transform="translate(${x + (i % 2 ? -150 : 84)} ${y - 18}) scale(.62)">${nibSVG({ hat: nibHat(), scarf: S.nib.items.indexOf('scarf') >= 0 && nibHat() !== 'scarf' }).replace('<svg', '<svg width="100" height="100"')}</g>`;
    s += '</g>';
  }
  if (cave.loop > 0) s += `<text x="${W0 / 2}" y="40" text-anchor="middle" font-family="Fredoka" font-size="20" fill="#ffd86b">✨ Second glow ✨</text>`;
  s += '</svg>'; qs('#mapInner').innerHTML = s;
  qs('#exploreBtn').innerHTML = ICON.lantern + (S.current ? ' Keep going' : ' Explore');
  setTimeout(() => { const sc = qs('#mapScroll'); const y = (top + cave.cavern * step) / H0 * qs('#mapInner svg').getBoundingClientRect().height; sc.scrollTop = Math.max(0, y - sc.clientHeight / 2 + 60); }, 30);
  setTimeout(() => { ui.justLit = null; }, 3500);
});
/* Nib's nook: the room itself is 3D (see buildNook); the drawing keeps only its words and Nib's tap target */
override('renderNook', () => {
  const it = S.nib.items, gemsN = S.gems.owned.length;
  let s = `<svg viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">`;
  if (!gemsN) s += `<text x="300" y="120" text-anchor="middle" font-family="Fredoka" font-size="18" fill="#d9ccff" style="paint-order:stroke;stroke:#1a1430;stroke-width:4px">(your gems will glow here)</text>`;
  s += `<g id="nookNib" style="cursor:pointer"><rect x="225" y="170" width="160" height="170" rx="60" fill="transparent"/></g>`;
  if (!it.length) s += `<text x="300" y="400" text-anchor="middle" font-family="Fredoka" font-size="18" fill="#e6defc" style="paint-order:stroke;stroke:#1a1430;stroke-width:4px">Nib's nook gets cozier as walls light up!</text>`;
  s += '</svg>'; qs('#nookScene').innerHTML = s;
  const hats = S.nib.hats.filter(h => h !== 'scarf');
  qs('#hats').innerHTML = hats.length ? ['none'].concat(hats).map(h => `<button class="btn soft ${((S.nib.wearing || 'none') === h) ? 'on' : ''}" data-hat="${h}" aria-label="${h}">${h === 'none' ? nibSVG({}) : nibSVG({ hat: h })}</button>`).join('') : '';
});

// redraw what is already on screen with the new models
try {
  const pk = qs('#peek'); if (pk) pk.innerHTML = [1, 2, 3, 4].map(v => G.gemSVG(v, { mode: 'face' })).join('');
  const cb = qs('#crystalBtn'); if (cb) cb.innerHTML = G.crystalSVG();
  const bn = qs('#bNook'); if (bn) bn.innerHTML = G.nibSVG({});
  document.querySelectorAll('.nibbtn').forEach(b => { b.innerHTML = G.nibSVG({ hat: G.nibHat ? G.nibHat() : null }); });
  const sc = screen(), g = game();
  if (sc === 'map') G.renderMap(); else if (sc === 'pz' && g.cur) G.renderPuzzle(); else if (sc === 'nook') G.renderNook(); else if (sc === 'shelfScr') G.renderShelf(); else if (sc === 'binder') G.renderBinder();
} catch (e) { console.warn('[3d] redraw', e); }
// bake the everyday Gemlings in the background so the first puzzle opens without a pause
(function prebake() {
  const jobs = [];
  for (let v = 1; v <= 5; v++) for (const sl of [true, false]) jobs.push(() => gemlingURL(v, PAL(v), sl, true, '', '', false));
  ['rose', 'moon', 'ame'].forEach(t => jobs.push(() => G.gemStoneSVG(t)));
  const next = () => { const j = jobs.shift(); if (!j) return; try { j(); } catch (e) {} setTimeout(next, 60); };
  setTimeout(next, 400);
})();

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, lastScreen = '', shadowDirty = 2;
const stats = {};
const tmpV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.max(0, Math.min(.25, (now - last) / 1000)), dt = Math.min(.05, rdt); last = Math.max(last, now);
  T += dt * (RM() ? .3 : 1);
  // adaptive resolution keeps it smooth on older iPads
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < DPR_MAX - .05) { dpr = Math.min(dpr + .15, DPR_MAX); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();

  const scr = screen();
  if (scr !== lastScreen) { lastScreen = scr; shadowDirty = 2; }
  const g = game(), solved = scr === 'pz' && g.cur && g.cur.solved;

  // living cave
  bg.userData.water.uniforms.t.value = T;
  for (const gw of glows) gw.material.opacity = gw.userData.glowBase * (.85 + .15 * Math.sin(T * 1.3 + gw.position.x)) * (solved ? 1.5 : 1);
  plCrystal.intensity = 40 * (.9 + .1 * Math.sin(T * 1.1)) * (solved ? 1.6 : 1);
  family.forEach(o => { const u = o.userData, k = T + u.t0; const hop = Math.max(0, Math.sin(k * .9)) ** 12; o.position.y = u.base + Math.abs(Math.sin(k * 2)) * .05 + hop * .45; o.rotation.y = u.ry + Math.sin(k * .6) * .25; o.rotation.z = Math.sin(k * 1.7) * .04; });
  for (let i = 0; i < motes.n; i++) { const h = motes.home[i], k = T * .3 + motes.ph[i]; motes.pos[i * 3] = h[0] + Math.sin(k) * 1.2; motes.pos[i * 3 + 1] = h[1] + Math.sin(k * 1.3) * .6; motes.pos[i * 3 + 2] = h[2] + Math.cos(k * .8); }
  motes.g.attributes.position.needsUpdate = true; motes.m.uniforms.t.value = T; motes.m.uniforms.px.value = dpr;

  // camera (the map view drifts with the map's scroll)
  const v = VIEWS[scr] || VIEWS.title; const k = 1 - Math.exp(-rdt * 2.2);
  parX += (tgtParX - parX) * Math.min(1, dt * 1.5);
  let sz = 0; if (scr === 'map') { const ms = qs('#mapScroll'); if (ms && ms.scrollHeight > ms.clientHeight) sz = (ms.scrollTop / (ms.scrollHeight - ms.clientHeight) - .5) * 8; }
  camPos.lerp(tmpV.set(v.pos[0] + parX * .8 + Math.sin(T * .07) * .3, v.pos[1], v.pos[2] - sz), k);
  camAt.lerp(tmpV.set(v.at[0], v.at[1], v.at[2] - sz), k);
  bgCam.position.copy(camPos); bgCam.lookAt(camAt);

  syncAnchors();
  for (const rec of live.values()) {
    if (!rec.obj.parent) continue; const u = rec.obj.userData;
    if (u.kind === 'nib') M.animNib(rec.obj, T, dt);
    else if (u.kind === 'nook') M.animNib(u.nib, T, dt);
  }

  if (shadowDirty > 0) { R.shadowMap.needsUpdate = true; shadowDirty--; }
  R.clear();
  R.render(bg, bgCam);
  stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles;
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
  stats.total = stats.bg + stats.fg; stats.dpr = dpr; stats.screen = scr;
}
requestAnimationFrame(frame);
G.__gg3d = { R, bg, fg, live, baker, stats, bgCam, camPos, camAt, get dpr() { return dpr; } };
