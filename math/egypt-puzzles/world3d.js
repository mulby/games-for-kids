// Miu's Magic Pyramids in 3D.
// The game itself (rules, touch, saves, voice, cards) is unchanged and still lives in index.html's DOM.
// This module draws a warm desert-at-dusk world behind it (the Nile, palms, obelisks, a temple with lamps,
// the great pyramids and a sleepy sun) and puts real 3D models under the things she touches and looks at:
//  - live models follow their DOM element every frame: Miu, the sandstone puzzle stones (the numbers stay
//    as DOM text on top), the blue number tiles, the title's little pyramid and Miu's house
//  - small still things (the map's place icons) are rendered once to images
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
import * as M from './models3d.js';

const G = window;

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
let R;
try {
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (e) { console.warn('[3d] off:', e && e.message); throw e; }
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.autoClear = false;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
R.setClearColor('#e9b77a', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(128);
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const screenEl = () => document.querySelector('#app > .screen:not([hidden])');
const screen = () => { const s = screenEl(); return s ? s.id : 'title'; };

/* ------------------------------------------------------------------ background world (meters) */
const bg = new THREE.Scene();
bg.fog = new THREE.Fog('#f0b48a', 70, 320);
const bgCam = new THREE.PerspectiveCamera(42, 1, .1, 400);
const riverX = z => 11 + Math.sin(z * .04) * 5;
const RIVER_W = 9;
function groundY(x, z) {
  let y = Math.sin(x * .13) * .25 + Math.cos(z * .11 + x * .05) * .2;
  const d = Math.hypot(x + 4, z + 10);
  if (d > 45) y += (d - 45) * .05 + Math.sin(x * .07 + 1) * Math.cos(z * .05) * 2.2 * Math.min(1, (d - 45) / 20);
  const dx = Math.abs(x - riverX(z));
  if (dx < 8) y = THREE.MathUtils.lerp(-.7, y, THREE.MathUtils.smoothstep(dx, RIVER_W / 2 - .5, 8));
  return y;
}
const SUN_DIR = new THREE.Vector3(.3, .16, -1).normalize();
(function sky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4a5aa8') }, mid: { value: new THREE.Color('#d98aa0') }, hor: { value: new THREE.Color('#ffc685') }, low: { value: new THREE.Color('#e6a868') }, sun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,mid,hor,low,sun; varying vec3 v; void main(){ float h=v.y; vec3 col = mix(hor, mid, smoothstep(.02,.28,h)); col = mix(col, top, smoothstep(.22,.75,h)); col = h<0.? mix(hor, low, smoothstep(0.,-.15,h)) : col; float s = max(0., dot(normalize(v), sun)); col += vec3(1.,.62,.3)*pow(s,6.)*.45 + vec3(1.,.85,.55)*pow(s,40.)*.5; gl_FragColor=vec4(col,1.); }'
  });
  bg.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), m));
  // the first stars come out high in the sky
  const n = 380, pos = new Float32Array(n * 3), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = .45 + Math.random() * 1.0; pos.set([Math.cos(th) * Math.cos(ph) * 260, Math.sin(ph) * 260, Math.sin(th) * Math.cos(ph) * 260], i * 3); sz[i] = Math.random(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('s', new THREE.BufferAttribute(sz, 1));
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 } },
    vertexShader: 'attribute float s; uniform float t,px; varying float a; void main(){ a = (.35+.45*sin(t*(1.+s*3.)+s*40.))*smoothstep(80.,200.,position.y); gl_PointSize = (1.5+s*s*3.5)*px; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying float a; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); float k=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.95,.85)*k*a,k*a); }'
  });
  bg.add(new THREE.Points(sg, sm)); bg.userData.stars = sm;
})();
const bgL = K.toyLights(bg, { sky: '#ffe0bf', ground: '#b5793c', hemiI: 1.25, key: '#ffd2a0', keyI: 2.1, fill: '#a9b8ff', fillI: .55, dir: [-9, 11, 9] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(1024, 1024); bgL.key.shadow.bias = -.002;
Object.assign(bgL.key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
bgL.key.target.position.set(-2, 0, -14); bg.add(bgL.key.target);
const sunObj = M.sunOfRa(9); sunObj.position.copy(SUN_DIR).multiplyScalar(230); sunObj.lookAt(0, 4, 20); bg.add(sunObj);

(function ground() {
  const g = new THREE.PlaneGeometry(420, 420, 150, 150); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const sand = new THREE.Color('#e9c07c'), sand2 = new THREE.Color('#dfb06a'), green = new THREE.Color('#8fae5a'), wet = new THREE.Color('#b99460'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundY(x, z); p.setY(i, y);
    const dx = Math.abs(x - riverX(z));
    c.copy(sand).lerp(sand2, .5 + .5 * Math.sin(x * .3 + z * .21));
    c.lerp(green, 1 - THREE.MathUtils.smoothstep(dx, 6, 12));
    c.lerp(wet, 1 - THREE.MathUtils.smoothstep(dx, RIVER_W / 2 - .2, 6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })); m.receiveShadow = true; bg.add(m);
})();

/* the Nile */
const water = new THREE.ShaderMaterial({
  transparent: true, fog: false, uniforms: { t: { value: 0 } },
  vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform float t; varying vec2 vUv; varying vec3 vW; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ float w = n(vec2(vW.x*2., vW.z*.8 + t*.5)) * n(vec2(vW.x*.9-t*.2, vW.z*.4+t*.3)); vec3 col = mix(vec3(.17,.43,.6), vec3(.38,.68,.78), w); float far = smoothstep(-10.,-120.,vW.z); col = mix(col, vec3(.95,.66,.55), far*.55); float sp = pow(n(vec2(vW.x*3., vW.z*1.5+t*1.2)), 10.)*1.6*smoothstep(14.,-6.,vW.z); col += vec3(1.,.82,.5)*sp; float edge = smoothstep(0.,.14,vUv.x)*smoothstep(1.,.86,vUv.x); gl_FragColor=vec4(col, .95*edge); }'
});
(function river() {
  const rg = new THREE.PlaneGeometry(RIVER_W, 300, 6, 200); rg.rotateX(-Math.PI / 2);
  const p = rg.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i) - 110; p.setZ(i, z); p.setX(i, p.getX(i) + riverX(z)); p.setY(i, -.18); }
  const river = new THREE.Mesh(rg, water); river.renderOrder = 1; bg.add(river);
})();

/* everything that never moves: merged into a few draw calls */
const flames = [];
// seeded, so the scenery is laid out the same way every visit
const rand = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(20250);
(function scenery() {
  const still = new THREE.Group();
  const put = (o, x, z, ry = 0, s = 1) => { o.position.set(x, groundY(x, z), z); o.rotation.y = ry; if (s !== 1) o.scale.setScalar(s); still.add(o); return o; };
  // great pyramids on the horizon
  put(M.greatPyramid(17, 15), -34, -96, .2);
  put(M.greatPyramid(24, 21), -4, -122, -.1);
  put(M.greatPyramid(12, 10.5), 28, -100, .35);
  // the little queens' pyramids, so the pyramids show beside the title too
  put(M.greatPyramid(4.2, 4.2), -27, -33, .5); put(M.greatPyramid(3.2, 3.1), -33.5, -27, .1); put(M.greatPyramid(2.6, 2.5), -21, -38, .3);
  // temple of Karnak-ish with columns, and an avenue of obelisks and lamps
  put(M.temple(), -8, -28);
  for (const [x, z] of [[-14.5, -17], [-1.5, -17]]) put(M.obelisk(7.5), x, z, Math.PI / 4 + .78);
  for (const [x, z] of [[-12.5, -9], [-3.5, -9], [-15, -21], [-1, -21]]) {
    const y = groundY(x, z); put(M.lampStand(), x, z);
    const f = M.flame(); f.position.set(x, y + 1.82, z); bg.add(f); flames.push(f);
  }
  // dunes far away
  [[-80, -60, 26, '#e3b46c'], [-55, -140, 30, '#e8bd78'], [60, -140, 34, '#dfaa62'], [90, -50, 24, '#e8bd78'], [-120, 10, 30, '#e3b46c'], [120, 20, 30, '#dfaa62']].forEach(([x, z, r, c]) => {
    const d = M.dune(c, [r * 1.8, r * .35, r]); d.position.set(x, 0, z); still.add(d);
  });
  // a few rocks and a stone sphinx-style block by the avenue
  [[-18, -4, .8], [3.5, -5, .6], [-20, -26, 1.1], [5, -30, .9]].forEach(([x, z, k]) => { const st = K.ball(K.mat('#c79a5c', { felt: true }), [0, k * .25, 0], [k * .7, k * .4, k * .55]); put(st, x, z, x); });
  bg.add(K.freeze(still));
  // palms: along both banks of the Nile and an oasis by the temple
  const palmsA = [], palmsB = [];
  for (let i = 0; i < 26; i++) {
    const z = 4 - i * 6 - rand() * 3, side = i % 2 ? 1 : -1, x = riverX(z) + side * (RIVER_W / 2 + 1.5 + rand() * 3);
    (i % 3 ? palmsA : palmsB).push({ p: [x, groundY(x, z) - .1, z], s: .8 + rand() * .45, ry: rand() * 6 });
  }
  [[-21, -12], [-19, -30], [-24, -20], [3, -16], [5.5, -24], [-26, 2], [-19, 4], [-30, -8], [6, -6]].forEach(([x, z], i) => (i % 2 ? palmsA : palmsB).push({ p: [x, groundY(x, z) - .1, z], s: .85 + rand() * .4, ry: rand() * 6 }));
  bg.add(K.scatter(M.palm(.35), palmsA));
  bg.add(K.scatter(M.palm(-.25), palmsB));
  // papyrus reeds at the water's edge
  const reeds = [];
  for (let i = 0; i < 150; i++) {
    const z = 26 - rand() * 160, side = rand() < .5 ? -1 : 1, x = riverX(z) + side * (RIVER_W / 2 - .3 + rand() * 1.6);
    reeds.push({ p: [x, groundY(x, z) + .05, z], s: .7 + rand() * .7, ry: rand() * 6 });
  }
  bg.add(K.scatter(M.papyrus(), reeds));
})();

/* a felucca sailing up the Nile */
const boat = M.felucca(); bg.add(boat);

/* warm dust motes drifting in the evening air */
const motes = (function () {
  const n = 60, pos = new Float32Array(n * 3), home = [], ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { home.push([-24 + Math.random() * 40, .4 + Math.random() * 6, 14 - Math.random() * 40]); ph[i] = Math.random() * 20; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 }, map: { value: K.glowTexture() } },
    vertexShader: 'attribute float ph; uniform float t,px; varying float a; void main(){ a = .35+.4*max(0., sin(t*.9+ph*3.)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 160.*px/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.,.82,.5)*c.a*a, c.a*a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; bg.add(pts);
  return { pos, home, ph, g, m, n };
})();

/* camera framing per screen (landscape iPad first; portrait widens the view) */
const VIEWS = {
  title: { pos: [-2, 2.4, 18], at: [-3, 6, -40] },
  map: { pos: [riverX(34) - 2, 19, 34], at: [riverX(-24), 0, -24] },
  puzzle: { pos: [-8, 2.6, 7], at: [-8, 4.6, -30] },
  room: { pos: [-12, 2.2, -12], at: [-6, 4.6, -32] }
};
const camPos = new THREE.Vector3(...VIEWS.title.pos), camAt = new THREE.Vector3(...VIEWS.title.at);
let parX = 0, tgtParX = 0;
addEventListener('pointermove', e => { tgtParX = (e.clientX / innerWidth - .5); }, { passive: true });

/* ------------------------------------------------------------------ foreground: 3D models pinned to DOM elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#fff0dc', ground: '#8a6040', hemiI: 1.35, key: '#fff1dc', keyI: 2.1, fill: '#ffd9b0', fillI: .7, dir: [-.45, .75, .8] });
const pcam = new THREE.PerspectiveCamera(20, 1, 10, 30000);
let W = 0, H = 0;
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false);
  bgCam.aspect = W / H;
  const fovH = 64; bgCam.fov = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovH / 2)) / bgCam.aspect)));
  bgCam.updateProjectionMatrix();
  pcam.aspect = W / H; pcam.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); pcam.lookAt(0, 0, 0); pcam.updateProjectionMatrix();
}
const DPR_MAX = () => Math.min(devicePixelRatio || 1, 1.75);
let dpr = DPR_MAX();
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', sizeAll);

const live = new Map();            // element -> { obj, key }
const seen = new Set();
function px(r) { return [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)]; }

/* --- Miu --- */
const miuTpl = M.miu();
const MIU_H = 2.72; // model height, feet to ear tips

/* --- stones and tiles, built to the DOM element's own size --- */
function stoneKey(el) {
  const cap = el.classList.contains('capstone') || el.classList.contains('cap');
  const hole = el.classList.contains('hole');
  const seed = el.dataset.r != null ? (+el.dataset.r * 5 + +el.dataset.i * 2 + 1) : (el.textContent.charCodeAt(0) || 0);
  return [el.offsetWidth, el.offsetHeight, cap ? 'c' : '', hole ? 'h' : '', seed].join('|');
}
const stoneCache = new Map();
function stoneFor(key) {
  if (!stoneCache.has(key)) {
    const [w, h, cap, hole, seed] = key.split('|');
    stoneCache.set(key, M.stoneBlock(+w, +h, { cap: !!cap, hole: !!hole, seed: +seed }));
    if (stoneCache.size > 80) stoneCache.delete(stoneCache.keys().next().value);
  }
  const o = stoneCache.get(key).clone(true); o.userData = { kind: 'stone' }; return o;
}
const tileCache = new Map();
function tileFor(key) {
  if (!tileCache.has(key)) { const [w, h] = key.split('x').map(Number); tileCache.set(key, M.faienceTile(w, h)); }
  const o = tileCache.get(key).clone(true); o.userData = { kind: 'tile' }; return o;
}

/* anchor kinds: which DOM elements get a live 3D model, and how it sits on them */
const KINDS = [
  { sel: 'svg[data-miu]', key: () => 'miu', make: () => K.instance(miuTpl),
    place: (o, el, r) => {
      const s = r.height / MIU_H * 1.04; const [x] = px(r);
      o.position.set(x, H / 2 - r.bottom + s * .04, el.closest('#scene') ? 30 : 0); o.scale.setScalar(s);
      o.rotation.y = THREE.MathUtils.clamp(-x / W, -.5, .5) * .9 + Math.sin(T * .3 + o.userData.t0) * .06;
      o.userData.mood = el.classList.contains('happy') ? 'happy' : 'idle';
    } },
  { sel: '.blk, .mini-pyr span', key: stoneKey, make: (el, key) => stoneFor(key),
    place: (o, el, r) => {
      const [x, y] = px(r); const s = r.width / (el.offsetWidth || r.width);
      o.position.set(x, y, 0); o.scale.setScalar(s); o.rotation.set(.08, Math.sin(T * .4 + x * .01) * .015, 0);
    } },
  // (a tile being dragged switches to its 2D look so it can float above the stones)
  { sel: '.tile', key: el => el.classList.contains('gone') || el.classList.contains('drag') ? '' : el.offsetWidth + 'x' + el.offsetHeight, make: (el, key) => tileFor(key),
    place: (o, el, r) => {
      const [x, y] = px(r); const s = r.width / (el.offsetWidth || r.width);
      o.position.set(x, y, 20); o.scale.setScalar(s);
      o.rotation.set(.1, Math.sin(T * .7 + x * .02) * .04, 0);
    } },
  { sel: '#scene', key: el => el.offsetWidth + 'x' + el.offsetHeight + 'x' + Math.round(pcam.position.z), make: el => M.houseModel(el.offsetWidth, el.offsetHeight, pcam.position.z),
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); o.scale.setScalar(r.width / el.offsetWidth); } }
];
function syncAnchors() {
  seen.clear();
  const root = screenEl();
  if (root) for (const kind of KINDS) {
    for (const el of root.querySelectorAll(kind.sel)) {
      if (seen.has(el)) continue;
      const key = kind.key(el); if (!key) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -50 || r.top > H + 50) continue;
      let rec = live.get(el);
      if (!rec || rec.key !== key) { if (rec) fg.remove(rec.obj); rec = { obj: kind.make(el, key), key }; live.set(el, rec); }
      if (rec.obj.parent !== fg) fg.add(rec.obj);
      kind.place(rec.obj, el, r);
      seen.add(el);
    }
  }
  for (const [el, rec] of live) {
    if (seen.has(el)) continue;
    if (rec.obj.parent) fg.remove(rec.obj);
    if (!el.isConnected) live.delete(el);
  }
}

/* ------------------------------------------------------------------ baked map icons for the six places */
const ICONS = { '🔺': 'giza', '🪜': 'saqqara', '🏛️': 'karnak', '⛰️': 'valley', '🌅': 'abu', '🗝️': 'hidden', '🔒': 'lock' };
function iconURL(kind) { return baker.bake('icon-' + kind, () => M.iconModel(kind), { w: 128, h: 128, pad: 1.0, yaw: .45, pitch: .42 }); }
function dressStops() {
  document.querySelectorAll('#stops .stop .ico').forEach(ico => {
    if (ico.querySelector('img')) return;
    const kind = ICONS[ico.textContent.trim()]; if (!kind) return;
    try { ico.innerHTML = `<img src="${iconURL(kind)}" alt="" draggable="false">`; } catch (e) { console.warn('[3d] icon', e); }
  });
}
const stopsEl = document.getElementById('stops');
if (stopsEl) { new MutationObserver(dressStops).observe(stopsEl, { childList: true }); dressStops(); }

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, lastScreen = '', shadowDirty = true;
const stats = { bg: 0, fg: 0, total: 0, bgTris: 0, fgTris: 0 };
const tmpV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rdt); last = now;
  T += dt * (REDUCED ? .3 : 1);
  // adaptive resolution keeps it smooth on older iPads
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < DPR_MAX() - .05) { dpr = Math.min(dpr + .15, DPR_MAX()); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();

  // the card pack and card viewer cover everything with their own WebGL: skip drawing underneath
  const covered = !!document.querySelector('.gfk-ov, .gfk-view');
  const scr = screen(), world = !!VIEWS[scr] && !covered;
  canvas.style.visibility = world ? 'visible' : 'hidden';
  if (!world) return;
  if (scr !== lastScreen) { lastScreen = scr; shadowDirty = true; }

  // world life: lamps flicker, the boat sails, dust drifts, stars twinkle
  M.flameMat.emissiveIntensity = 1.5 + Math.sin(T * 9) * .25 + Math.sin(T * 23) * .15;
  flames.forEach((f, i) => { const k = 1 + Math.sin(T * 11 + i * 1.7) * .08; f.scale.set(1, k, 1); f.userData.halo.material.opacity = .7 + Math.sin(T * 7 + i) * .12; });
  const bz = 24 - ((T * 1.1) % 150);
  boat.position.set(riverX(bz) - 1.2, -.15 + Math.sin(T * 1.6) * .05, bz);
  boat.rotation.y = Math.PI + Math.atan(Math.cos(bz * .04) * .2) ; boat.rotation.z = Math.sin(T * 1.3) * .03;
  bg.userData.stars.uniforms.t.value = T; bg.userData.stars.uniforms.px.value = dpr;
  water.uniforms.t.value = T;
  for (let i = 0; i < motes.n; i++) { const h = motes.home[i], k = T * .25 + motes.ph[i]; motes.pos[i * 3] = h[0] + Math.sin(k) * 1.6; motes.pos[i * 3 + 1] = h[1] + Math.sin(k * 1.3) * .6; motes.pos[i * 3 + 2] = h[2] + Math.cos(k * .8); }
  motes.g.attributes.position.needsUpdate = true; motes.m.uniforms.t.value = T; motes.m.uniforms.px.value = dpr;

  // camera
  const v = VIEWS[scr]; const k = 1 - Math.exp(-rdt * 2.2);
  parX += (tgtParX - parX) * Math.min(1, dt * 1.5);
  camPos.lerp(tmpV.set(v.pos[0] + parX * .8 + Math.sin(T * .07) * .3, v.pos[1], v.pos[2]), k);
  camAt.lerp(tmpV.set(...v.at), k);
  bgCam.position.copy(camPos); bgCam.lookAt(camAt);

  syncAnchors();
  for (const rec of live.values()) if (rec.obj.parent && rec.obj.userData.kind === 'miu') M.animateMiu(rec.obj, T, dt);

  if (shadowDirty) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
  R.clear();
  R.render(bg, bgCam);
  stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles;
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
  stats.total = stats.bg + stats.fg;
}
requestAnimationFrame(frame);
G.__miu3d = { R, bg, fg, live, baker, stats, get dpr() { return dpr; } };
