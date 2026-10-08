// The Shining Sea in 3D.
// The game itself (rules, touch, saves, voice, cards) is unchanged and still lives in index.html's DOM.
// This module draws a sunny Aegean world behind it in real 3D and swaps the drawn pictures for 3D models:
//  - world anchors: the toy ship and the six islands sit in the 3D sea exactly under their DOM buttons
//    (each frame the button's screen position is cast onto the water), so taps and layout are untouched
//  - live models pinned to DOM elements: the god in the medallion, the god's bust next to each question, Pip the fairy
//  - still treasures, card art, crew, flags and cabin furniture are rendered once to images and put in place
//    of their emoji, and the gold bars, coins, pearls, pebbles and scale get baked 3D pictures as CSS backgrounds
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
import * as M from './models3d.js';

const G = window;
const VOY = () => G.__voyage || {};
const screen = () => VOY().screen || 'title';
const REDUCED = () => matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ISLE_IDS = ['poseidon', 'hermes', 'artemis', 'hephaestus', 'athena', 'zeus'];
const ISLE_XY = [[14, 70], [31, 33], [50, 70], [65, 30], [83, 66], [86, 22]];

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
R.setClearColor('#9fd3f0', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(160);

/* ------------------------------------------------------------------ background world (meters, sea at y=0) */
const bg = new THREE.Scene();
const HORIZON = new THREE.Color('#bfe2f4');
bg.fog = new THREE.Fog(HORIZON, 70, 185);
const bgCam = new THREE.PerspectiveCamera(45, 1, .1, 520);
const SUN = new THREE.Vector3(-.42, .26, -1).normalize();
const KEYDIR = new THREE.Vector3(-.45, .85, .5).normalize();

const sky = (function () {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2a78c8') }, mid: { value: new THREE.Color('#62b0e6') }, hor: { value: HORIZON.clone() }, sun: { value: SUN }, dusk: { value: 0 } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, hor, sun; uniform float dusk; varying vec3 v;
      void main(){ vec3 d = normalize(v); float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(0., .16, h)); col = mix(col, top, smoothstep(.16, .75, h));
        float s = max(dot(d, sun), 0.);
        col += vec3(1., .82, .5) * (pow(s, 6.) * .28 + pow(s, 60.) * .45) + vec3(1., .97, .85) * smoothstep(.9975, .999, s) * 2.5;
        vec3 dk = mix(mix(vec3(.98,.72,.62), vec3(.55,.5,.85), smoothstep(0., .25, h)), vec3(.2,.22,.5), smoothstep(.25, .8, h));
        col = mix(col, dk, dusk);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m); s.renderOrder = -10; bg.add(s);
  return s;
})();
const sunGlow = K.glow('#fff1c8', 44, .35); sunGlow.material.fog = false; bg.add(sunGlow);

/* the sea: one shader, waves in the vertex stage, lagoons, foam rings, sparkle and fog in the fragment stage */
const WAVES = [[1, .3, .55, 1.1, .16], [-.4, 1, .8, 1.4, .09], [.7, -.6, 1.4, 2.1, .045], [-.9, -.2, 2.3, 2.8, .02]].map(([x, z, k, s, a]) => { const l = Math.hypot(x, z); return [x / l, z / l, k, s, a]; });
function waveH(x, z, t) { let h = 0; for (const [dx, dz, k, s, a] of WAVES) h += a * Math.sin((x * dx + z * dz) * k + t * s); return h; }
const seaMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: {
    t: { value: 0 }, deep: { value: new THREE.Color('#1b6aa8') }, mid: { value: new THREE.Color('#2c8fcf') }, shallow: { value: new THREE.Color('#3fcfc6') },
    foamC: { value: new THREE.Color('#f6fcff') }, skyC: { value: new THREE.Color('#bfe5f8') }, sun: { value: SUN }, key: { value: KEYDIR },
    fogC: { value: HORIZON.clone() }, fogN: { value: 60 }, fogF: { value: 180 }, camP: { value: new THREE.Vector3() }, dusk: { value: 0 },
    isl: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, wake: { value: new THREE.Vector4() }
  },
  vertexShader: `uniform float t; varying vec3 vW; varying vec3 vN; varying float vH;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.); vec2 p = w.xz; float h = 0.; vec2 g = vec2(0.);
      ${WAVES.map(([x, z, k, s, a]) => `{ vec2 d = vec2(${x.toFixed(4)}, ${z.toFixed(4)}); float ph = dot(p, d) * ${k.toFixed(3)} + t * ${s.toFixed(3)}; h += ${a.toFixed(3)} * sin(ph); g += ${(a * k).toFixed(4)} * cos(ph) * d; }`).join('\n      ')}
      w.y += h; vW = w.xyz; vH = h; vN = normalize(vec3(-g.x, 1., -g.y));
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float t, fogN, fogF, dusk; uniform vec3 deep, mid, shallow, foamC, skyC, sun, key, fogC, camP; uniform vec4 isl[8]; uniform vec4 wake;
    varying vec3 vW; varying vec3 vN; varying float vH;
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float ns(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1., 0.)), f.x), mix(hs(i + vec2(0., 1.)), hs(i + vec2(1., 1.)), f.x), f.y); }
    void main(){
      vec2 p = vW.xz;
      float r1 = ns(p * 1.3 + vec2(t * .35, t * .2)), r2 = ns(p * 2.2 - vec2(t * .25, -t * .3));
      vec3 n = normalize(vN + vec3(r1 - .5, 0., r2 - .5) * .22);
      vec3 v = normalize(camP - vW);
      float fres = pow(1. - max(dot(n, v), 0.), 4.);
      float lag = 0., foam = 0.;
      for (int i = 0; i < 8; i++) {
        vec4 I = isl[i]; if (I.w < .5) continue;
        vec2 q = p - I.xy; float d = length(q) / I.z;
        lag = max(lag, smoothstep(2.1, 1.0, d));
        float wob = .05 * sin(atan(q.y, q.x) * 6. + t * 1.3) + .06 * (ns(q * 2.5 + t * .4) - .5);
        foam = max(foam, smoothstep(.09, .0, abs(d - 1.02 - wob)));
        foam = max(foam, smoothstep(.06, .0, abs(d - 1.25 - wob * 1.6 - .05 * sin(t * 1.4))) * .55);
      }
      if (wake.w > .5) { vec2 q = p - wake.xy; float d = length(q) / wake.z; foam = max(foam, smoothstep(.12, 0., abs(d - 1.)) * .7 * smoothstep(1.6, .6, d)); }
      vec3 col = mix(deep, mid, clamp(.45 + vH * 1.8 + (r1 - .5) * .35, 0., 1.));
      col = mix(col, shallow, lag * .8);
      float dif = max(dot(n, key), 0.);
      col *= .78 + .32 * dif;
      col = mix(col, skyC, fres * .4);
      vec3 rf = reflect(-v, n);
      float sp = pow(max(dot(rf, sun), 0.), 40.), sp2 = pow(max(dot(rf, key), 0.), 90.);
      col += vec3(1., .95, .82) * (smoothstep(.5, .75, sp) * .7 + sp * .2 + smoothstep(.6, .85, sp2) * .35);
      foam = max(foam, smoothstep(.235, .29, vH + (r1 - .5) * .1) * .45);
      col = mix(col, foamC, foam);
      col = mix(col, col * vec3(.75, .7, 1.05), dusk);
      float fd = length(vW - camP);
      col = mix(col, fogC, smoothstep(fogN, fogF, fd));
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const SEA_STEP = 2;
const sea = new THREE.Mesh((() => { const g = new THREE.PlaneGeometry(400, 400, 200, 200); g.rotateX(-Math.PI / 2); return g; })(), seaMat);
sea.frustumCulled = false; bg.add(sea);

/* lights (key light casts the island shadows; its shadow box follows what the camera looks at) */
const bgL = K.toyLights(bg, { sky: '#dff0ff', ground: '#3f7e95', hemiI: 1.45, key: '#fff3dc', keyI: 2.3, fill: '#ffe0bc', fillI: .55, dir: [KEYDIR.x * 30, KEYDIR.y * 30, KEYDIR.z * 30] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(2048, 2048); bgL.key.shadow.bias = -.0015; bgL.key.shadow.normalBias = .03;
bg.add(bgL.key.target);
function aimShadow(c, r) {
  bgL.key.position.copy(c).addScaledVector(KEYDIR, 40); bgL.key.target.position.copy(c);
  Object.assign(bgL.key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 90 });
  bgL.key.shadow.camera.updateProjectionMatrix(); bgL.key.target.updateMatrixWorld();
}

/* distant islands and clouds on the horizon */
(function scenery() {
  const still = new THREE.Group();
  const hill = (x, z, r, h, c) => { const m = K.ball(K.mat(c, { felt: true }), [x, -h * .2, z], [r, h, r * .7]); still.add(m); };
  [[-110, -130, 14, 6, '#6f9a7a'], [-75, -140, 9, 4, '#7fa58a'], [55, -135, 16, 7, '#6a9478'], [115, -115, 11, 5, '#7aa588'], [-140, -50, 12, 5, '#76a084'], [150, -30, 10, 4, '#7aa588'], [5, -150, 8, 3.5, '#82aa8e']].forEach(a => hill(...a));
  bg.add(K.freeze(still));
  const clouds = new THREE.Group();
  [[-120, 34, -170, 9], [-40, 44, -200, 12], [60, 38, -185, 10], [140, 30, -140, 8], [-170, 28, -100, 8], [180, 40, -80, 9], [10, 58, -230, 14], [-80, 24, -150, 6], [95, 24, -135, 6]].forEach(([x, y, z, s], i) => {
    const c = M.skyCloud(i + 1); c.position.set(x, y, z); c.scale.setScalar(s); c.lookAt(0, y, 0); clouds.add(c);
  });
  const fogless = new Map();
  clouds.traverse(o => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = false; if (!fogless.has(o.material)) { const m = o.material.clone(); m.fog = false; fogless.set(o.material, m); } o.material = fogless.get(o.material); });
  bg.add(clouds); bg.userData.clouds = clouds;
})();

/* the six islands (and the cloud banks that hide the ones still to find) */
const isles = ISLE_IDS.map((id, i) => {
  const g = new THREE.Group(), obj = M.island(id), cloud = M.cloudCover();
  g.add(obj, cloud); bg.add(g);
  const [x, y] = ISLE_XY[i];
  g.position.set((x - 50) * .57, 0, (y - 50) * .36 - 7); g.scale.setScalar(3);
  return { id, g, obj, cloud, r: 3, locked: false };
});
const nextRing = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.4, 64), new THREE.MeshBasicMaterial({ color: '#ffc93a', transparent: true, opacity: .6, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
nextRing.rotation.x = -Math.PI / 2; nextRing.renderOrder = 3; nextRing.visible = false; bg.add(nextRing);
function lockFromSave() {
  const done = (VOY().state && VOY().state.done) || [];
  isles.forEach((s, i) => { s.locked = i > done.length; });
}

/* the ship (rebuilt when the sail, flag or crew change) */
const wship = { obj: null, key: '', pos: new THREE.Vector3(0, 0, 18), yaw: -.65, tYaw: -.65, s: 1, last: new THREE.Vector3() };
const lookOf = () => (VOY().state && VOY().state.look) || { sail: 'white', flag: '🏴‍☠️', crew: [] };
function ensureShip() {
  const look = lookOf(), key = JSON.stringify(look);
  if (key === wship.key) return;
  if (wship.obj) bg.remove(wship.obj);
  wship.obj = M.ship(look); wship.key = key; bg.add(wship.obj);
  shadowDirty = true;
}

/* sea life: two gulls, a dolphin that jumps now and then, a turtle paddling about */
const gulls = [0, 1, 2].map(i => { const g = M.gull(); g.scale.setScalar(.7); g.userData.ph = i * 2.1; g.userData.rad = 9 + i * 3; bg.add(g); return g; });
const jumper = M.dolphin(false); jumper.scale.setScalar(.55); bg.add(jumper);
const turtle = M.tortuga(); turtle.scale.setScalar(.45); bg.add(turtle);

/* ------------------------------------------------------------------ cameras for each screen */
let W = 0, H = 0;
const camPos = new THREE.Vector3(0, 3, 40), camAt = new THREE.Vector3(0, 1, 0), camDir = new THREE.Vector3();
const focus = new THREE.Vector3(), tmp = new THREE.Vector3();
// the open-sea quests happen out on the water south of the islands
const OPEN_SEA = new THREE.Vector3(-3, 0, 17);
const openSea = () => { const run = VOY().run; return !!(run && run.isle && run.isle.id === 'sea'); };
function curIsle() {
  const run = VOY().run; if (!run || !run.isle) return null;
  const i = ISLE_IDS.indexOf(run.isle.id); return i >= 0 ? isles[i] : null;
}
function horizonAt(pos, frac) { // a look-at point that puts the horizon at `frac` of the screen height from the top
  const half = THREE.MathUtils.degToRad(bgCam.fov / 2), pitch = Math.atan(Math.tan(half) * (1 - 2 * frac));
  return pos.clone().add(new THREE.Vector3(0, -Math.tan(pitch), -1));
}
// Look at an island from the side with no other island in the way, and put it where the panels leave it visible.
const sideCache = new Map();
function segDist(q, a, b) { const ab = tmp.copy(b).sub(a); ab.y = 0; const l2 = ab.lengthSq() || 1; const t = Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.z - a.z) * ab.z) / l2)); return Math.hypot(q.x - (a.x + ab.x * t), q.z - (a.z + ab.z * t)); }
function islandView(scr, c, r, self) {
  const portrait = H > W;
  const cfg = { meet: { dist: 5.4, elev: .3, ndc: portrait ? [.3, .42] : [.5, .05] }, play: { dist: portrait ? 7.5 : 5, elev: .42, ndc: portrait ? [.45, -.84] : [.72, -.66] }, reward: { dist: 4.4, elev: .32, ndc: portrait ? [-.45, -.74] : [-.7, -.6] } }[scr];
  const d = cfg.dist * r, key = scr + self + c.x.toFixed(1) + c.z.toFixed(1);
  let yaw = sideCache.get(key);
  if (yaw === undefined) {
    let best = -1e9;
    for (const a of [0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.6, -2.6, Math.PI]) {
      const P = new THREE.Vector3(c.x + Math.sin(a) * d, 0, c.z + Math.cos(a) * d);
      let sc = 40;
      isles.forEach((o, j) => { if (j === self) return; const q = o.g.position; sc = Math.min(sc, segDist(q, P, c) - o.r * 1.6, q.distanceTo(P) - o.r * 2.6); });
      sc -= Math.abs(a) * .12 * r;
      if (sc > best) { best = sc; yaw = a; }
    }
    sideCache.set(key, yaw);
  }
  const P = new THREE.Vector3(c.x + Math.sin(yaw) * Math.cos(cfg.elev) * d, Math.sin(cfg.elev) * d, c.z + Math.cos(yaw) * Math.cos(cfg.elev) * d);
  const dir = c.clone().add(new THREE.Vector3(0, r * .3, 0)).sub(P).normalize();
  const tv = Math.tan(THREE.MathUtils.degToRad(bgCam.fov / 2)), th = tv * bgCam.aspect;
  const ly = Math.atan2(dir.x, dir.z) + Math.atan(cfg.ndc[0] * th), lp = Math.asin(dir.y) - Math.atan(cfg.ndc[1] * tv);
  return { pos: P, at: P.clone().add(new THREE.Vector3(Math.sin(ly) * Math.cos(lp), Math.sin(lp), Math.cos(ly) * Math.cos(lp))) };
}
function viewFor(scr) {
  const isle = curIsle(), portrait = H > W;
  if (scr === 'map') return { pos: new THREE.Vector3(0, portrait ? 66 : 48, portrait ? 20 : 15), at: new THREE.Vector3(0, 0, portrait ? -7.5 : -6.5), snap: true, sh: [new THREE.Vector3(0, 0, -7), 34] };
  if (scr === 'title' || scr === 'story' || scr === 'name') { const pos = new THREE.Vector3(4, 2.6, 36); return { pos, at: horizonAt(pos, portrait ? .3 : .2), snap: scr === 'title', sh: [new THREE.Vector3(2, 0, 20), 16] }; }
  if (scr === 'meet' || scr === 'play' || scr === 'reward') {
    const c = isle ? isle.g.position : openSea() ? OPEN_SEA : wship.pos, r = isle ? isle.r : 2.6;
    return { ...islandView(scr, c, r, isles.indexOf(isle)), sh: [c.clone(), r * 2.4] };
  }
  return { pos: new THREE.Vector3(-14, 6, 44), at: new THREE.Vector3(-2, 3, 0), sh: [new THREE.Vector3(0, 0, -6), 30] }; // binder, shop, cabin, grown-ups
}

/* ------------------------------------------------------------------ foreground: live models pinned to DOM elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#e2f0ff', ground: '#4a6070', hemiI: 1.35, key: '#fff3e0', keyI: 2.1, fill: '#ffd9b0', fillI: .7, dir: [-.45, .75, .8] });
const pcam = new THREE.PerspectiveCamera(20, 1, 10, 30000);
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false);
  bgCam.aspect = W / H;
  const fovH = 66; bgCam.fov = Math.min(64, Math.max(42, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovH / 2)) / bgCam.aspect))));
  bgCam.updateProjectionMatrix();
  pcam.aspect = W / H; pcam.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); pcam.lookAt(0, 0, 0); pcam.updateProjectionMatrix();
}
let dpr = Math.min(devicePixelRatio || 1, 1.75);
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', () => { sizeAll(); shadowDirty = true; });

/* screen point -> point on the water (or on a level plane at height y) */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function toSea(x, y, h = 0) {
  ndc.set(x / W * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, bgCam); plane.constant = -h;
  const out = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, out) || out.distanceTo(bgCam.position) > 140) { ray.ray.at(140, out); out.y = h; }
  return out;
}
const metersPerPx = p => 2 * Math.max(.1, tmp.copy(p).sub(bgCam.position).dot(camDir)) * Math.tan(THREE.MathUtils.degToRad(bgCam.fov / 2)) / H;

const live = new Map(); // element -> { obj, key }
const seen = new Set();
const pxc = r => [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)];
function fitInfo(o) { const b = new THREE.Box3().setFromObject(o); o.userData.fit = { h: b.max.y - b.min.y, y0: b.min.y, cy: (b.max.y + b.min.y) / 2 }; return o; }
function moodOf() {
  if (document.querySelector('.ans.yes, #stage .yes')) return 'happy';
  if (document.querySelector('.ans.nope')) return 'think';
  return 'idle';
}
const godGlow = K.glow('#fff4d0', 1, 0); fg.add(godGlow);
const KINDS = [
  { sel: '.medallion', key: () => { const r = VOY().run; return r && r.isle ? 'full:' + r.isle.god : ''; },
    make: () => fitInfo(M.character(VOY().run.isle)),
    place: (o, el, r) => {
      const f = o.userData.fit, s = r.height * 1.32 / f.h, [x] = pxc(r);
      o.position.set(x, H / 2 - r.bottom + r.height * .02 - f.y0 * s, 0); o.scale.setScalar(s);
      o.rotation.y = Math.sin(T * .5) * .12;
      godGlow.position.set(x, H / 2 - (r.top + r.height * .45), -40); godGlow.scale.setScalar(r.height * 1.9); godGlow.material.opacity = .45; godGlow.userData.used = true;
    } },
  { sel: '.asker .face', key: () => { const r = VOY().run; return r && r.isle ? 'bust:' + r.isle.god : ''; },
    make: () => { const isle = VOY().run.isle, o = M.character(isle, isle.id !== 'sea'); return fitInfo(o); },
    place: (o, el, r) => {
      const f = o.userData.fit, s = r.height * (VOY().run && VOY().run.isle.id === 'sea' ? 1.05 : 1.08) / f.h, [x, y] = pxc(r);
      o.position.set(x, y - f.cy * s, 0); o.scale.setScalar(s); o.rotation.y = .25;
    } },
  { sel: '.pip-face', key: () => 'pip', make: () => fitInfo(M.pip()),
    place: (o, el, r) => { const f = o.userData.fit, s = r.height * 1.5 / f.h, [x, y] = pxc(r); o.position.set(x, y - f.cy * s, 0); o.scale.setScalar(s); o.rotation.y = .35; } },
];
function syncAnchors() {
  seen.clear(); godGlow.userData.used = false;
  const root = document.getElementById('app');
  for (const kind of KINDS) {
    for (const el of root.querySelectorAll(kind.sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -50 || r.top > H + 50) continue;
      let rec = live.get(el); const key = kind.key(el);
      if (!key) continue;
      if (!rec || rec.key !== key) { if (rec) fg.remove(rec.obj); rec = { obj: kind.make(el, key), key }; live.set(el, rec); }
      if (rec.obj.parent !== fg) fg.add(rec.obj);
      kind.place(rec.obj, el, r);
      seen.add(el);
    }
  }
  if (!godGlow.userData.used) godGlow.material.opacity = 0;
  for (const [el, rec] of live) {
    if (seen.has(el)) continue;
    if (rec.obj.parent) fg.remove(rec.obj);
    if (!el.isConnected) live.delete(el);
  }
}

/* ------------------------------------------------------------------ animation of live models */
function animate(o, t, mood) {
  const u = o.userData;
  if (u.kind === 'fairy') { u.mood = mood; K.animate(o, t); return; }
  if (u.kind !== 'god') return;
  const k = t + u.t0, happy = mood === 'happy', think = mood === 'think';
  u.body.position.y = Math.sin(k * 2) * .05 + (happy ? Math.abs(Math.sin(k * 7)) * .3 : 0);
  u.body.rotation.z = Math.sin(k * 1.3) * .03;
  if (u.head && !u.noHead) { u.head.rotation.z = think ? .22 + Math.sin(k * 2) * .04 : Math.sin(k * .9) * .07; u.head.rotation.x = Math.sin(k * .7) * .05; }
  if (u.armR) u.armR.rotation.z = Math.sin(k * 1.6) * .08 + (happy ? .7 + Math.sin(k * 9) * .25 : 0);
  if (u.armL) { u.armL.rotation.z = -Math.sin(k * 1.4) * .06 - (happy ? .8 : 0); u.armL.rotation.x = think ? -1.0 : 0; }
}

/* ------------------------------------------------------------------ baked pictures for still things */
const ov = {}; // what we replaced, for debugging
const bakeQ = new Map(); // key -> { build, view }
function bakeLater(key, build, view) {
  if (baker.cache.has(key)) return baker.cache.get(key);
  if (!bakeQ.has(key)) bakeQ.set(key, { build, view });
  return null;
}
function pumpBakes(budget = 14) {
  if (!bakeQ.size) return false;
  const t0 = performance.now();
  for (const [key, b] of bakeQ) {
    try { M.fitBake(baker, key, b.build, b.view); } catch (e) { console.warn('[3d] bake', key, e); baker.cache.set(key, ''); }
    bakeQ.delete(key);
    if (performance.now() - t0 > budget) break;
  }
  return true;
}
const EMO = Object.keys(M.EMOJI).concat(['⛵']).sort((a, b) => b.length - a.length);
const EMO_RE = new RegExp('(' + EMO.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'gu');
const ANY_EMO = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:[\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]|\p{Extended_Pictographic}|\p{Regional_Indicator})*/gu;
function viewFor3d(e, ctx) { return { pad: 1.12, yaw: .35, pitch: .18, ...(M.VIEWS[e] || {}), ...(ctx.view || {}) }; }
function bakeEmoji(e, ctx) {
  const size = ctx.size || 160;
  if (e === '⛵') { const look = lookOf(), k = 'ship' + JSON.stringify(look) + size; return bakeLater(k, () => M.ship(look, { noFreeze: true }), { w: size, h: size, pad: 1.05, yaw: .8, pitch: .12 }); }
  if (ctx.flag) return bakeLater('flag' + e + size, () => M.flagModel(e), { w: size, h: size, pad: 1.1, yaw: .2, pitch: .08 });
  const make = M.EMOJI[e] || M.EMOJI[e.replace(/️/g, '')]; if (!make) return '';
  return bakeLater('e' + e + size, () => make(), { w: size, h: size, ...viewFor3d(e, ctx) });
}
const BAKE_SEL = [
  ['.card .art', { size: 192 }], ['.thing', { size: 224, decor: true }], ['.ware .pic', { size: 128 }], ['.who', { size: 192 }], ['.chest', { size: 224 }],
  ['.item', { size: 128 }], ['.cell', { size: 128 }], ['.caption', { size: 96 }], ['.scale .owl', { size: 128 }],
];
const LIVE_SEL = '.medallion, .asker .face, .pip-face, .isle .land';
function swapText(el, ctx, liveGap) {
  let pending = false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const s = n.nodeValue;
    if (liveGap) {
      // a live model stands here: every emoji in the slot gives way to it, known to the model maker or not
      if (!s || !ANY_EMO.test(s)) continue;
      ANY_EMO.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = ANY_EMO.exec(s))) { frag.append(s.slice(last, m.index)); const sp = document.createElement('span'); sp.className = 'e3d-gap'; sp.setAttribute('aria-hidden', 'true'); frag.append(sp); last = m.index + m[0].length; }
      frag.append(s.slice(last)); n.replaceWith(frag); continue;
    }
    if (!s || !EMO_RE.test(s)) continue; EMO_RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, m, changed = false;
    while ((m = EMO_RE.exec(s))) {
      const e = m[1];
      if (liveGap) { frag.append(s.slice(last, m.index)); const sp = document.createElement('span'); sp.className = 'e3d-gap'; sp.setAttribute('aria-hidden', 'true'); frag.append(sp); last = m.index + m[0].length; changed = true; continue; }
      const url = bakeEmoji(e, ctx);
      if (url === null) { pending = true; continue; }
      if (!url) continue;
      frag.append(s.slice(last, m.index));
      const img = document.createElement('img'); img.className = 'e3d'; img.src = url; img.alt = ''; img.draggable = false; img.dataset.e = e;
      frag.append(img); last = m.index + m[0].length; changed = true;
    }
    if (!changed) continue;
    frag.append(s.slice(last));
    n.replaceWith(frag);
  }
  return pending;
}
let domDirty = true;
function processDOM() {
  domDirty = false;
  const app = document.getElementById('app'); if (!app) return;
  let pending = false;
  // the ship picture in the shop (queued first: it is the biggest picture there)
  for (const sv of app.querySelectorAll('svg.ship')) {
    if (sv.classList.contains('title-ship') || sv.closest('#shipToken')) continue;
    const look = lookOf(), k = 'shop' + JSON.stringify(look);
    if (sv.dataset.e3d === k) continue;
    const url = bakeLater(k, () => M.ship(look, { noFreeze: true }), { w: 288, h: 240, pad: 1.04, yaw: .8, pitch: .12 });
    if (url === null) { pending = true; continue; }
    sv.innerHTML = `<image href="${url}" x="0" y="0" width="120" height="100" preserveAspectRatio="xMidYMid meet"/>`; sv.dataset.e3d = k;
  }
  for (const [sel, ctx0] of BAKE_SEL) {
    for (const el of app.querySelectorAll(sel)) {
      const ware = el.closest('.ware'), ctx = { ...ctx0 };
      if (ware && /^flag:/.test(ware.dataset.v || '')) ctx.flag = true;
      if (swapText(el, ctx, false)) pending = true;
    }
  }
  for (const el of app.querySelectorAll(LIVE_SEL)) swapText(el, {}, true);
  if (pending) domDirty = 'wait';
}
new MutationObserver(() => { if (domDirty !== true) domDirty = true; }).observe(document.getElementById('app'), { childList: true, subtree: true, characterData: true });

/* gold bars, coins, pearls, pebbles and Athena's scale: baked once, used as CSS backgrounds so every rule and animation still works */
function bakeBackgrounds() {
  const T = M.TREASURE, css = [];
  const b = (k, build, view) => M.fitBake(baker, 'bg-' + k, build, view);
  const pearl = b('pearl', T.pearl, { w: 96, h: 96, pad: 1.0, yaw: .2, pitch: .2 });
  const coin = b('coin', T.coin, { w: 112, h: 112, pad: 1.0, yaw: .25, pitch: .15 });
  const bar = b('bar', T.bar, { w: 56, h: 320, pad: 1.0, yaw: .3, pitch: .1 });
  const pebble = b('pebble', T.pebble, { w: 160, h: 140, pad: 1.0, yaw: .2, pitch: .3 });
  const dish = b('dish', T.dish, { w: 300, h: 120, pad: 1.0, yaw: 0, pitch: .38 });
  const beam = b('beam', T.beam, { w: 640, h: 44, pad: 1.0, yaw: 0, pitch: .05 });
  const col = b('column', T.column, { w: 64, h: 300, pad: 1.0, yaw: .2, pitch: .05 });
  const foot = b('foot', T.foot, { w: 300, h: 60, pad: 1.0, yaw: 0, pitch: .3 });
  css.push(`body.g3d .pearl-dot{background:url(${pearl}) center/contain no-repeat;box-shadow:none}`);
  css.push(`body.g3d .coin{background:url(${coin}) center/contain no-repeat;box-shadow:none;border-radius:50%}`);
  css.push(`body.g3d .bar{background:url(${bar}) center/100% 100% no-repeat;box-shadow:none;border-radius:4px}`);
  css.push(`body.g3d .stone:not(.mystery),body.g3d .ans.pebble{background:url(${pebble}) center/100% 100% no-repeat;box-shadow:none;border-radius:0;filter:drop-shadow(0 4px 3px rgba(0,0,0,.25))}`);
  css.push(`body.g3d .ans.pebble.yes{filter:drop-shadow(0 0 10px #4d9b60) drop-shadow(0 0 4px #8fd6a0)}`);
  css.push(`body.g3d .pan .dish{background:url(${dish}) center bottom/100% 100% no-repeat;border-radius:0}`);
  css.push(`body.g3d .beam{background:url(${beam}) center/100% 100% no-repeat;height:18px;margin-top:-3px;border-radius:0}`);
  css.push(`body.g3d .scale .post{background:url(${col}) center/100% 100% no-repeat;width:30px;border-radius:0}`);
  css.push(`body.g3d .scale .foot{background:url(${foot}) center/100% 100% no-repeat;width:150px;height:24px;border-radius:0}`);
  const st = document.createElement('style'); st.id = 'pv3d-bg'; st.textContent = css.join('\n'); document.head.appendChild(st);
}

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, lastScreen = '', shadowDirty = true, frameN = 0, bgDone = false, isleSig = '';
const stats = {};
const SHEETS = { cards: 1, shop: 1, cabin: 1, grown: 1 };
function placeWorldAnchors(scr, dt) {
  // islands under their map buttons
  if (scr === 'map') {
    for (const b of document.querySelectorAll('#app .isle')) {
      const i = +b.dataset.v, s = isles[i]; if (!s) continue;
      const land = b.querySelector('.land'); if (!land) continue;
      const r = land.getBoundingClientRect(); if (r.width < 2) continue;
      const p = toSea(r.left + r.width / 2, r.top + r.height * .62);
      const rad = r.width * .5 * metersPerPx(p) * 1.12;
      s.g.position.copy(p); s.g.position.y = 0; s.r = rad; s.g.scale.setScalar(rad);
      s.locked = b.classList.contains('locked'); s.next = b.classList.contains('next');
    }
  } else lockFromSave();
  // the ship
  let el = null, wl = .84;
  if (scr === 'title') el = document.querySelector('#app .title-ship');
  if (scr === 'map') el = document.getElementById('shipToken');
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 2) {
      const p = toSea(r.left + r.width / 2, r.top + r.height * wl);
      const svgH = el.id === 'shipToken' ? (el.querySelector('svg') || el).getBoundingClientRect().height : r.height;
      wship.s = svgH * .87 * metersPerPx(p) / M.SHIP_H;
      const d = tmp.copy(p).sub(wship.pos); d.y = 0;
      if (scr === 'map' && d.length() > .02 && d.length() < 2 * wship.s) wship.tYaw = Math.atan2(-d.z, d.x);
      if (scr === 'title') wship.tYaw = -.65;
      wship.pos.copy(p); wship.last.copy(p);
    }
  } else if ((scr === 'meet' || scr === 'play' || scr === 'reward') && openSea()) {
    // out on the open sea the ship is life-size and drifts beside the sea friend's patch of water
    wship.s += (1.1 - wship.s) * Math.min(1, dt * 3);
    wship.pos.set(OPEN_SEA.x - 2.5, 0, OPEN_SEA.z - 1.5); wship.tYaw = .5 + Math.sin(T * .1) * .2;
  }
}
function updateWorld(scr, dt) {
  const t = T;
  seaMat.uniforms.t.value = t; seaMat.uniforms.camP.value.copy(bgCam.position);
  sea.position.set(Math.round(bgCam.position.x / SEA_STEP) * SEA_STEP, 0, Math.round(bgCam.position.z / SEA_STEP) * SEA_STEP);
  sky.position.copy(bgCam.position);
  sunGlow.position.copy(bgCam.position).addScaledVector(SUN, 380);
  // islands
  const cur = curIsle(), ci = isles.indexOf(cur);
  isles.forEach((s, i) => {
    const show = !s.locked || (cur === s && scr !== 'map');
    s.obj.visible = show; s.cloud.visible = !show;
    if (s.cloud.visible) { const k = 1 + Math.sin(t * .8 + i) * .03; s.cloud.scale.set(k, 1 + Math.sin(t * .8 + i + 1) * .04, k); }
    const u = s.obj.userData;
    if (u.spin) u.spin.forEach((w, j) => { w.rotation.z = t * (1.2 + j * .3); });
    if (u.smoke) u.smoke.children.forEach(p => { const k = (t * .25 + p.userData.k) % 1; p.position.set(Math.sin(k * 6 + t) * .05, k * .7, 0); p.scale.setScalar(.06 + k * .16); });
    if (u.bolt) { const f = Math.sin(t * 2.3) > .97 || Math.sin(t * 3.7 + 1) > .985; u.bolt.scale.setScalar(f ? .36 : .3); u.boltGlow.material.opacity = f ? 1 : .45 + Math.sin(t * 2) * .1; }
    seaMat.uniforms.isl.value[i].set(s.g.position.x, s.g.position.z, s.r * 1.02, 1);
  });
  const nx = scr === 'map' ? isles.find(s => s.next) : null;
  nextRing.visible = !!nx;
  if (nx) { nextRing.position.set(nx.g.position.x, .25, nx.g.position.z); nextRing.scale.setScalar(nx.r * (1.05 + .06 * Math.sin(t * 3.4))); nextRing.material.opacity = .25 + .3 * (.5 + .5 * Math.sin(t * 3.4)); }
  // ship rides the waves
  ensureShip();
  const sp = wship.pos, sh = wship.obj;
  let dy = wship.tYaw - wship.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  wship.yaw += dy * Math.min(1, dt * 2.5);
  const h0 = waveH(sp.x, sp.z, t), hx = waveH(sp.x + 1, sp.z, t), hz = waveH(sp.x, sp.z + 1, t);
  sh.position.set(sp.x, h0 + .3 * wship.s, sp.z); sh.scale.setScalar(wship.s);
  sh.rotation.set(0, wship.yaw, 0); sh.rotateZ((hx - h0) * .6); sh.rotateX(-(hz - h0) * .6);
  if (sh.userData.flag) sh.userData.flag.rotation.y = Math.sin(t * 3) * .25 - .2;
  seaMat.uniforms.wake.value.set(sp.x, sp.z, wship.s * 1.7, scr === 'title' || scr === 'map' ? 1 : 0);
  // gulls circle over what we look at
  gulls.forEach((g, i) => {
    const u = g.userData, a = t * .25 + u.ph, c = scr === 'map' ? tmp.set(0, 0, -6) : focus;
    g.position.set(c.x + Math.cos(a) * u.rad, 7 + i * 1.5 + Math.sin(t * .7 + i) * .5, c.z + Math.sin(a) * u.rad * .6 - 4);
    g.rotation.set(0, Math.atan2(-Math.sin(a), .6 * Math.cos(a)), Math.sin(t * .5 + i) * .15);
    const f = Math.sin(t * 7 + i * 2) * .5; u.wL.rotation.z = f; u.wR.rotation.z = -f;
  });
  // dolphin jumps in an arc every few seconds; turtle paddles in a slow circle
  const jr = cur ? cur.r : 2.6, jc = scr !== 'map' && !SHEETS[scr] ? focus.clone().add(new THREE.Vector3(jr * 2.2, 0, jr * 1.2)) : new THREE.Vector3(-4, 0, 2);
  const jt = (t % 6) / 2.2;
  if (jt < 1) { jumper.visible = true; jumper.position.set(jc.x - 2 + jt * 4, -1 + Math.sin(jt * Math.PI) * 2.6, jc.z); jumper.rotation.set(0, 0, -Math.PI / 2 + (.5 - jt) * 2); }
  else jumper.visible = false;
  const ta = t * .12;
  turtle.position.set(-13 + Math.cos(ta) * 4, -.15 + waveH(-13, -13, t), -13 + Math.sin(ta) * 3); turtle.rotation.y = -ta;
  bg.userData.clouds.rotation.y = Math.sin(t * .01) * .05;
  // twilight on Artemis' moonlit isle
  const duskT = cur && cur.id === 'artemis' && scr !== 'map' && !SHEETS[scr] ? .55 : 0;
  sky.material.uniforms.dusk.value += (duskT - sky.material.uniforms.dusk.value) * Math.min(1, dt * 1.5);
  seaMat.uniforms.dusk.value = sky.material.uniforms.dusk.value;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rdt); last = now;
  T += dt * (REDUCED() ? .3 : 1); frameN++;
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < Math.min(devicePixelRatio || 1, 1.75) - .05) { dpr = Math.min(dpr + .15, Math.min(devicePixelRatio || 1, 1.75)); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();
  if (!bgDone) { bgDone = true; try { bakeBackgrounds(); } catch (e) { console.warn('[3d] backgrounds', e); } }

  // still pictures: swap emoji for baked models a few at a time
  if (domDirty === true) processDOM();
  if (pumpBakes()) processDOM();

  const scr = screen();
  const sheet = !!SHEETS[scr];
  if (scr !== lastScreen) { const v0 = viewFor(scr); if (v0.snap || !lastScreen) { camPos.copy(v0.pos); camAt.copy(v0.at); } lastScreen = scr; shadowDirty = true; }
  // on full-page panels the world barely shows: draw it at a quarter of the frame rate
  if (sheet && frameN % 4 && !shadowDirty) return;

  // camera
  const v = viewFor(scr), k = v.snap ? 1 : 1 - Math.exp(-rdt * 2.2);
  camPos.lerp(v.pos, k); camAt.lerp(v.at, k);
  bgCam.position.copy(camPos); bgCam.position.x += Math.sin(T * .07) * .15; bgCam.lookAt(camAt); bgCam.updateMatrixWorld();
  bgCam.getWorldDirection(camDir);
  focus.copy(v.sh[0]);
  if (shadowDirty) aimShadow(v.sh[0], v.sh[1]);

  placeWorldAnchors(scr, dt);
  updateWorld(scr, dt);
  syncAnchors();
  const mood = moodOf();
  for (const rec of live.values()) if (rec.obj.parent) animate(rec.obj, T, mood);

  // islands move under the map buttons when the layout changes: refresh shadows only then
  if (scr === 'map') { let sig = W + 'x' + H; for (const b of document.querySelectorAll('#app .isle')) { const r = b.getBoundingClientRect(); sig += ',' + Math.round(r.left / 8) + ':' + Math.round(r.top / 8) + ':' + Math.round(r.width / 8); } if (sig !== isleSig) { isleSig = sig; shadowDirty = true; } }
  const shadowFrame = shadowDirty;
  if (shadowDirty) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
  R.clear();
  R.render(bg, bgCam);
  stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles;
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
  stats.calls = stats.bg + stats.fg; stats.screen = scr; stats.dpr = dpr;
  // shadow-map passes are counted apart: they only happen on a screen change
  if (shadowFrame) stats.maxWithShadows = Math.max(stats.maxWithShadows || 0, stats.calls);
  else { stats.max = Math.max(stats.max || 0, stats.calls); stats.maxBy = stats.maxBy || {}; stats.maxBy[scr] = Math.max(stats.maxBy[scr] || 0, stats.calls); }
}
requestAnimationFrame(frame);
G.__pv3d = { R, bg, fg, live, baker, stats, isles, wship, M, cam: bgCam, viewFor, get frames() { return frameN; }, get dpr() { return dpr; }, processDOM };
