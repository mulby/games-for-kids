// The Moonlit Map in 3D.
// The game (questions, levels, saves, voice, cards, the grown-ups summary) is unchanged and still lives in index.html's DOM.
// This module draws a 3D world behind the page:
//  - the map is a floating felt island under a moonlit sky, with the six lands on it and a stepping-stone path;
//    the land buttons follow their 3D landmarks, and a land lights up (and shows its treasure) once it is explored
//  - every land has its own 3D place for its story, question and treasure screens, with its guide standing in it
//  - the travel friend beside the speech bubbles is a live 3D toy; the moon on the title is a live 3D moon
//  - still pictures (friends on the start card, land pictures, treasures, fireflies, cupcakes, fish, pies,
//    moonberries, crystal blocks, coins, the clock and the cut pies) are 3D models rendered once to images
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
import * as M from './models3d.js';

const G = window;
const $ = id => document.getElementById(id);
const LANDS = G.__LANDS || [];
const KEYS = ['N', 'P', 'A', 'S', 'M', 'F'];

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.autoClear = false;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
R.setClearColor('#141836', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(256);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ reading the game's state from its DOM */
const SCREENS = ['s-start', 's-map', 's-intro', 's-q', 's-done', 's-final', 's-grown'];
function screen() { for (const s of SCREENS) { const el = $(s); if (el && !el.hidden) return s; } return 's-start'; }
const landByName = n => LANDS.find(L => L.name === n);
function currentLand(scr) {
  let L = null;
  if (scr === 's-intro') L = landByName($('in-title').textContent);
  else if (scr === 's-q') L = landByName($('q-land').textContent);
  else if (scr === 's-done') { const t = $('d-title').textContent; L = LANDS.find(l => t.includes(l.gem)); }
  return L ? L.key : lastLand;
}
let lastLand = 'N';
function doneLands(scr) {
  if (scr === 's-final') return new Set(KEYS);
  return new Set([...document.querySelectorAll('#map .land.done')].map(b => b.dataset.k));
}
function palEmoji() {
  const t = ($('map-av') && $('map-av').textContent.trim()) || ($('q-av') && $('q-av').textContent.trim());
  if (t && M.PAL_BUILD[t]) return t;
  const sel = document.querySelector('.pal[aria-pressed=true] .e');
  const e = sel && (sel.dataset.src || sel.textContent.trim());
  return M.PAL_BUILD[e] ? e : '🐉';
}

/* ------------------------------------------------------------------ the background world (meters) */
const bg = new THREE.Scene();
bg.fog = new THREE.Fog('#3d4190', 40, 150);
const bgCam = new THREE.PerspectiveCamera(42, 1, .1, 400);
const planCam = new THREE.PerspectiveCamera(42, 1, .1, 400); // the camera's resting pose for a screen, used for placing things
const skyRoot = new THREE.Group(); bg.add(skyRoot); // follows the camera
(function sky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color('#0f1238') }, b: { value: new THREE.Color('#262c72') }, c: { value: new THREE.Color('#4d4f9c') }, warm: { value: 0 } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a,b,c; uniform float warm; varying vec3 v; void main(){ float h=v.y; vec3 col = h>0.1? mix(b,a,smoothstep(.1,.75,h)) : (h>-.15? mix(c,b,smoothstep(-.02,.1,h)) : mix(c*.85,b*.8,smoothstep(-.15,-.8,h))); col = h<=0.1 && h>-.15 ? mix(c*.85, col, smoothstep(-.15,-.02,h)) : col; col += vec3(.35,.18,.05)*warm*smoothstep(.35,-.05,h); gl_FragColor=vec4(col,1.); }'
  });
  m.renderOrder = -10;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), m); dome.renderOrder = -10; skyRoot.add(dome); bg.userData.skyMat = m;
  const n = 1400, pos = new Float32Array(n * 3), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.asin(Math.random() * 1.75 - .75); pos.set([Math.cos(th) * Math.cos(ph) * 160, Math.sin(ph) * 160, Math.sin(th) * Math.cos(ph) * 160], i * 3); sz[i] = Math.random(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('s', new THREE.BufferAttribute(sz, 1));
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 } },
    vertexShader: 'attribute float s; uniform float t,px; varying float a; void main(){ a = .45+.55*sin(t*(1.+s*3.)+s*40.); gl_PointSize = (1.5+s*s*4.5)*px; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying float a; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); float k=smoothstep(.5,0.,d); k += .6*max(0.,1.-abs(p.x)*14.)*max(0.,1.-abs(p.y)*2.5)+.6*max(0.,1.-abs(p.y)*14.)*max(0.,1.-abs(p.x)*2.5); gl_FragColor=vec4(vec3(1.,.96,.82)*k*a,k*a); }'
  });
  const stars = new THREE.Points(sg, sm); stars.renderOrder = -9; stars.frustumCulled = false; skyRoot.add(stars); bg.userData.stars = sm;
})();
const bgL = K.toyLights(bg, { sky: '#b8c4ff', ground: '#2c4a38', hemiI: 1.2, key: '#e4e8ff', keyI: 1.7, fill: '#ffd9b0', fillI: .7, dir: [-7, 12, 7] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(1024, 1024); bgL.key.shadow.bias = -.002; bgL.key.shadow.normalBias = .02;
Object.assign(bgL.key.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
bg.add(bgL.key.target);
const moonObj = K.moon(3); bg.add(moonObj);

/* drifting firefly motes (around the camera's focus) */
const motes = (function () {
  const n = 40, pos = new Float32Array(n * 3), home = [], ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { home.push([(Math.random() - .5) * 26, .4 + Math.random() * 5, (Math.random() - .5) * 18]); ph[i] = Math.random() * 20; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 }, map: { value: K.glowTexture() } },
    vertexShader: 'attribute float ph; uniform float t,px; varying float a; void main(){ a = max(0., sin(t*1.1+ph*3.)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 300.*px/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.,.9,.45)*c.a*a, c.a*a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; bg.add(pts);
  return { pos, home, ph, g, m, n, pts };
})();

/* ------------------------------------------------------------------ the floating map island */
const island = new THREE.Group(); bg.add(island);
const ISL = { rx: 11, rz: 8.4 };
const islR = a => 1 + .05 * Math.sin(3 * a + .5) + .04 * Math.sin(5 * a + 2) + .03 * Math.sin(7 * a);
const inIsland = (x, z, k = 1) => { const a = Math.atan2(-z / ISL.rz, x / ISL.rx); const q = Math.hypot(x / ISL.rx, z / ISL.rz); return q < islR(a) * k; };
const LAND_POS = { N: [-7, 4], P: [-.5, 4.9], A: [6.5, 2.8], S: [2, -.6], M: [-5.5, -2], F: [1.5, -5.6] };
const LM_SCALE = 1.2;
const landmarks = {}, gems = {};
(function buildIsland() {
  const shape = k => { const s = new THREE.Shape(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = islR(a) * k; const x = Math.cos(a) * ISL.rx * r, y = Math.sin(a) * ISL.rz * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } return s; };
  const top = new THREE.ExtrudeGeometry(shape(1), { depth: .35, bevelEnabled: true, bevelThickness: .22, bevelSize: .3, bevelSegments: 4, curveSegments: 4 });
  top.rotateX(-Math.PI / 2); top.translate(0, -.57, 0);
  const topM = new THREE.Mesh(top, K.mat('#4f8a55', { felt: true })); topM.receiveShadow = true; island.add(topM);
  const soil = new THREE.ExtrudeGeometry(shape(1.005), { depth: 1.3, bevelEnabled: false, curveSegments: 4 }); soil.rotateX(-Math.PI / 2); soil.translate(0, -1.75, 0);
  const soilM = new THREE.Mesh(soil, K.mat('#7a5236', { felt: true })); island.add(soilM);
  const under = K.lathe([[1, -1.6], [.97, -2.2], [.86, -2.9], [.66, -3.9], [.42, -5.0], [.2, -6.1], [.06, -6.9], [0, -7.2]], K.mat('#5e4030', { felt: true }), 40);
  under.scale.set(ISL.rx, 1, ISL.rz); island.add(under);
  const still = new THREE.Group();
  // rocks, roots and a soil stripe on the underside
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + Math.random() * .2, y = -2.2 - Math.random() * 3.5, k = 1 - (-y - 1.6) / 6.5; still.add(K.ball(K.mat(i % 3 ? '#6e4b36' : '#8a8fa8', { felt: true }), [Math.cos(a) * ISL.rx * k * .95, y, -Math.sin(a) * ISL.rz * k * .95], .5 + Math.random() * .5)); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .2, x = Math.cos(a) * ISL.rx * .9, z = -Math.sin(a) * ISL.rz * .9; still.add(K.tube([[x, -3, z], [x * 1.02, -4.2, z * 1.02], [x * .95 + .3, -5.4 - (i % 3) * .5, z * .95]], .06, K.mat('#4a3324', { felt: true }), 8, 5)); }
  // trees, bushes and mushrooms around the rim (never on a land)
  const near = (x, z, d) => Object.values(LAND_POS).some(([lx, lz]) => Math.hypot(x - lx, z - lz) < d);
  const treeItems = [];
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + Math.sin(i * 7) * .08, r = islR(a) * (.84 + (i % 3) * .04), x = Math.cos(a) * ISL.rx * r, z = -Math.sin(a) * ISL.rz * r; if (near(x, z, 2.4) || z > 5.8) continue; treeItems.push({ p: [x, 0, z], s: .55 + (i % 4) * .1, ry: i }); }
  island.add(K.scatter(K.tree(1, '#3f6f4a'), treeItems.filter((_, i) => i % 2)));
  island.add(K.scatter(K.tree(1, '#4a7d52'), treeItems.filter((_, i) => !(i % 2))));
  const bushItems = []; for (let i = 0; i < 26; i++) { const x = (Math.random() - .5) * 20, z = (Math.random() - .5) * 15; if (!inIsland(x, z, .9) || near(x, z, 2.2)) continue; bushItems.push({ p: [x, 0, z], s: .35 + Math.random() * .25, ry: Math.random() * 6 }); }
  island.add(K.scatter(K.freeze(M.bush('#467f50')), bushItems));
  ['#ffffff', '#fff2a8', '#f6a6bd', '#c9b6ff'].forEach(c => { const items = []; for (let i = 0; i < 34; i++) { const x = (Math.random() - .5) * 21, z = (Math.random() - .5) * 16; if (!inIsland(x, z, .95) || near(x, z, 1.7)) continue; items.push({ p: [x, 0, z], s: .55 + Math.random() * .4, ry: Math.random() * 6 }); } island.add(K.scatter(K.flower(c), items)); });
  [[-9.2, 1.2, .8, '#e2566b'], [8.6, -2.6, .7, '#f2a7b5'], [-2.6, -6.6, .6, '#b9a6e8'], [9.4, 1.4, .5, '#e2566b'], [-3.2, 6.6, .55, '#f2a7b5']].forEach(([x, z, k, c]) => { const m = K.mushroom(c, k); m.position.set(x, 0, z); still.add(m); });
  island.add(K.freeze(still));
  // grass blades only inside the island
  const n = 2600, gg = new THREE.ConeGeometry(.05, .45, 3, 1); gg.translate(0, .22, 0);
  const im = new THREE.InstancedMesh(gg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 }), n);
  const d = new THREE.Object3D(), c = new THREE.Color(); let k = 0;
  while (k < n) { const x = (Math.random() - .5) * 22, z = (Math.random() - .5) * 17; if (!inIsland(x, z, .97)) continue; d.position.set(x, 0, z); d.rotation.set((Math.random() - .5) * .5, Math.random() * 3, (Math.random() - .5) * .5); d.scale.set(.6 + Math.random() * .4, .5 + Math.random() * .6, .6 + Math.random() * .4); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k, c.set('#5c9a5e').offsetHSL((Math.random() - .5) * .04, 0, (Math.random() - .5) * .12)); k++; }
  im.receiveShadow = true; island.add(im);
  // a little stream from the river land to the edge, then a waterfall
  const water = new THREE.ShaderMaterial({ transparent: true, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} void main(){ float s = h(floor(vec2(vUv.x*8., vUv.y*14. - t*3.))); vec3 col = mix(vec3(.28,.45,.85), vec3(.75,.88,1.), step(.72, s)*.7); float e = smoothstep(0.,.18,vUv.x)*smoothstep(1.,.82,vUv.x); gl_FragColor = vec4(col, .9*e); }' });
  const pts = [[2.9, .04, -.9], [5.2, .04, -1.6], [7.6, .04, -1.3], [9.9, .04, -1.9], [12.1, .04, -2.2]];
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const sg = new THREE.BufferGeometry(), N = 40, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t), sd = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(.42); pos.push(p.x - sd.x, .05, p.z - sd.z, p.x + sd.x, .05, p.z + sd.z); uv.push(0, t * 3, 1, t * 3); if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
  const fallTop = curve.getPoint(1);
  for (let i = 1; i <= 12; i++) { const y = -i * .55; pos.push(fallTop.x - .42 + i * .015, y, fallTop.z - .05, fallTop.x + .42 - i * .015, y, fallTop.z + .05); uv.push(0, 3 + i * .5, 1, 3 + i * .5); const b = (N + i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
  const stream = new THREE.Mesh(sg, water); stream.material.side = THREE.DoubleSide; stream.renderOrder = 1; island.add(stream); island.userData.water = water;
  const mist = K.glow('#cfe0ff', 3, .35); mist.position.set(fallTop.x, -6.5, fallTop.z); island.add(mist);
  // the six lands
  for (const key of KEYS) {
    const lm = M.landmark(key); const [x, z] = LAND_POS[key];
    lm.position.set(x, 0, z); lm.scale.setScalar(LM_SCALE); lm.rotation.y = -x * .03;
    const halo = K.glow('#bcd0ff', 7, 0); halo.position.set(0, 1.2, 0); lm.add(halo); lm.userData.halo = halo;
    island.add(lm); landmarks[key] = lm;
    const LND = LANDS.find(l => l.key === key);
    const gm = M.gemModel(LND ? LND.gemE : '🌟'); gm.scale.setScalar(.55); gm.position.set(x, 3.9 * LM_SCALE, z); gm.visible = false; island.add(gm); gems[key] = gm;
  }
})();
/* the stepping-stone path between the lands (stones between two explored lands glow) */
const path = (function () {
  const ctl = KEYS.map(k => new THREE.Vector3(LAND_POS[k][0], .03, LAND_POS[k][1]));
  const curve = new THREE.CatmullRomCurve3(ctl, false, 'centripetal');
  const stones = []; const L = curve.getLength(), step = .55;
  for (let s = 0; s < L; s += step) {
    const t = curve.getUtoTmapping(s / L), p = curve.getPoint(t);
    if (KEYS.some(k => Math.hypot(p.x - LAND_POS[k][0], p.z - LAND_POS[k][1]) < 1.85)) continue;
    const a = Math.min(KEYS.length - 2, Math.floor(t * (KEYS.length - 1))); // the stone sits between land a and land a+1
    stones.push({ p, a, b: a + 1 });
  }
  const geom = K.SPH(10);
  const dark = new THREE.InstancedMesh(geom, K.mat('#e2d6bb', { felt: true }), stones.length);
  const lit = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffc94a', emissiveIntensity: 1.1, roughness: .5 }), stones.length);
  dark.receiveShadow = true; island.add(dark, lit);
  const d = new THREE.Object3D();
  function set(done) {
    let nd = 0, nl = 0;
    stones.forEach((s, i) => { d.position.copy(s.p); d.rotation.set(0, i * 1.7, 0); d.scale.set(.2 + (i % 3) * .03, .07, .16); d.updateMatrix(); const on = done.has(KEYS[s.a]) && done.has(KEYS[s.b]); (on ? lit : dark).setMatrixAt(on ? nl++ : nd++, d.matrix); });
    dark.count = nd; lit.count = nl; dark.instanceMatrix.needsUpdate = lit.instanceMatrix.needsUpdate = true;
  }
  set(new Set());
  return { set };
})();
/* clouds drifting round the island */
const clouds = new THREE.Group(); island.add(clouds);
(function () {
  const cm = K.mat('#d9dcff', { felt: true }), cm2 = K.mat('#c3c7f2', { felt: true });
  const parts = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, r = 15 + (i % 3) * 2.5, y = -3 - (i % 4) * 1.4, s = 1 + (i % 3) * .35;
    [[0, 0, 0, 1.3], [-1.3, -.2, .2, .95], [1.3, -.25, -.1, 1], [.5, .55, .1, .9], [-.6, .45, -.2, .8]].forEach(([x, yy, z, rr], j) => parts.add(K.ball(j % 2 ? cm2 : cm, [Math.cos(a) * r + x * s, y + yy * s, Math.sin(a) * r * .8 + z * s], [rr * s, rr * s * .7, rr * s * .8])));
  }
  K.freeze(parts); parts.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); clouds.add(parts);
})();
/* the travel friend stands on the map beside the land you just explored */
let mapPal = null, mapPalKey = '';
/* sky lanterns for the finale */
const skyLan = new THREE.Group(); bg.add(skyLan);
for (let i = 0; i < 26; i++) {
  const l = new THREE.Group();
  l.add(K.lathe([[0, -.3], [.24, -.28], [.3, 0], [.22, .3], [0, .32]], new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9f40', emissiveIntensity: 1.6, roughness: .6, fog: false }), 10));
  l.add(K.glow('#ffb860', 2.2, .7));
  const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 14;
  l.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r * .8 - 2, ph: Math.random(), sp: .02 + Math.random() * .02, sw: Math.random() * 9 };
  l.scale.setScalar(.8 + Math.random() * .6); skyLan.add(l);
}
skyLan.visible = false;

/* ------------------------------------------------------------------ the ground world for the land scenes */
const groundW = new THREE.Group(); bg.add(groundW);
const groundMat = new THREE.MeshStandardMaterial({ color: '#2f5a3a', roughness: .95 });
const grass = K.grassField(4200, [-16, 16, -12, 8]);
(function ground() {
  const g = new THREE.PlaneGeometry(160, 160, 64, 64); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z * 1.2);
    let y = Math.sin(x * .35) * .1 + Math.cos(z * .3) * .08;
    if (d > 13) y += Math.min(4, (d - 13) * (d - 13) * .0012) + Math.sin(x * .25 + 1) * .4 * Math.min(1, (d - 13) / 5);
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; groundW.add(m);
  groundW.add(grass);
  const still = new THREE.Group();
  [[-24, -52, 15, '#2c4d3a'], [6, -60, 19, '#294836'], [34, -50, 14, '#30553d'], [-48, -36, 12, '#2e503b'], [52, -30, 12, '#2c4d3a']].forEach(([x, z, r, c]) => still.add(K.ball(K.mat(c, { felt: true }), [x, -r * .72, z], [r * 1.8, r, r])));
  groundW.add(K.freeze(still));
})();
const cobbles = (function () {
  const items = []; for (let i = 0; i < 260; i++) items.push({ p: [(Math.random() - .5) * 30, -.05, -12 + Math.random() * 19], s: .9 + Math.random() * .5, ry: Math.random() * 6 });
  const tpl = K.mesh(K.SPH(10), K.mat('#a39888', { felt: true }), [0, 0, 0], [.42, .12, .32]);
  const g = new THREE.Group(); g.add(tpl); const sc = K.scatter(g, items); groundW.add(sc); return sc;
})();
const GROUND = { N: '#3d6e45', P: '#4e4e6c', A: '#46714a', S: '#3d6b48', M: '#355c3e', F: '#6e665e' };
const scenes = {}; // land key -> { group, tick, guide }
function sceneFor(key) {
  if (scenes[key]) return scenes[key];
  const s = M.landScene(key); groundW.add(s.group);
  if (s.grassMask) { // this land has its own grass that keeps off the water
    const src = grass, n = src.count, m4 = new THREE.Matrix4(), p = new THREE.Vector3(), c = new THREE.Color();
    const own = new THREE.InstancedMesh(src.geometry, src.material, n); let k = 0;
    for (let i = 0; i < n; i++) { src.getMatrixAt(i, m4); p.setFromMatrixPosition(m4); if (!s.grassMask(p.x, p.z)) continue; own.setMatrixAt(k, m4); src.getColorAt(i, c); own.setColorAt(k, c); k++; }
    own.count = k; own.receiveShadow = true; s.group.add(own); s.ownGrass = true;
  }
  const guide = M.GUIDE_BUILD[key](); guide.userData.isGuide = true; groundW.add(guide);
  return (scenes[key] = { ...s, guide });
}

/* ------------------------------------------------------------------ cameras */
const LAND_VIEWS = {
  's-intro': { pos: [0, 3.4, 13.5], at: [0, 1.7, 0] },
  's-q': { pos: [0, 3.1, 12], at: [0, 1.9, 0] },
  's-done': { pos: [0, 2.9, 11], at: [0, 2.1, 0] }
};
const camPos = new THREE.Vector3(0, 4, 28), camAt = new THREE.Vector3(0, 1, 0);
let parX = 0, tgtParX = 0;
addEventListener('pointermove', e => { tgtParX = (e.clientX / innerWidth - .5); }, { passive: true });
let W = 0, H = 0;
function setFov(cam) {
  cam.aspect = W / H;
  cam.fov = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(32)) / cam.aspect)));
  cam.updateProjectionMatrix();
}
// fit the island into a screen rectangle, looking down at a fixed tilt
const fitCache = new Map();
function fitIsland(rect, tilt = .86, key = "") {
  const ck = [W, H, Math.round(rect.l), Math.round(rect.t), Math.round(rect.r), Math.round(rect.b), tilt, key].join(',');
  if (fitCache.has(ck)) return fitCache.get(ck);
  const pts = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = islR(a) * 1.02; pts.push(new THREE.Vector3(Math.cos(a) * ISL.rx * r, .2, -Math.sin(a) * ISL.rz * r), new THREE.Vector3(Math.cos(a) * ISL.rx * r, -1.6, -Math.sin(a) * ISL.rz * r)); }
  for (const k of KEYS) pts.push(new THREE.Vector3(LAND_POS[k][0], 3.1 * LM_SCALE, LAND_POS[k][1]));
  const dir = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt));
  const at = new THREE.Vector3(0, 0, .5); let d = 30;
  const rw = rect.r - rect.l, rh = rect.b - rect.t, rcx = (rect.l + rect.r) / 2, rcy = (rect.t + rect.b) / 2;
  setFov(planCam);
  for (let it = 0; it < 6; it++) {
    planCam.position.copy(at).addScaledVector(dir, d); planCam.lookAt(at); planCam.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const v = p.clone().project(planCam); const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    const s = Math.max((x1 - x0) / rw, (y1 - y0) / rh);
    const upp = 2 * d * Math.tan(THREE.MathUtils.degToRad(planCam.fov / 2)) / H;
    const right = new THREE.Vector3().setFromMatrixColumn(planCam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(planCam.matrixWorld, 1);
    at.addScaledVector(right, ((x0 + x1) / 2 - rcx) * upp).addScaledVector(up, -((y0 + y1) / 2 - rcy) * upp);
    d *= s;
  }
  const v = { pos: at.clone().addScaledVector(dir, d).toArray(), at: at.toArray() };
  fitCache.set(ck, v);
  return v;
}
function mapRect() {
  const m = $('map'), r = m && m.getBoundingClientRect();
  if (!r || r.height < 10) return { l: 16, r: W - 16, t: H * .12, b: H * .88 };
  const row = m.nextElementSibling, rb = row ? row.getBoundingClientRect() : null;
  const say = m.previousElementSibling, sr = say ? say.getBoundingClientRect() : null;
  return { l: 16, r: W - 16, t: Math.max(r.top, sr ? sr.bottom + 18 : 0), b: rb && rb.height ? rb.top - 6 : r.bottom };
}
function viewFor(scr) {
  if (scr === 's-map') return fitIsland(mapRect());
  if (scr === 's-final') { const v = fitIsland({ l: 0, r: W, t: H * .2, b: H * .95 }, .5, 'final'); return v; }
  if (scr === 's-start') return W > H ? { pos: [0, 2.4, 19.5], at: [0, 4.4, 0] } : { pos: [0, 8, 30], at: [0, 8.5, 0] };
  return LAND_VIEWS[scr] || LAND_VIEWS['s-q'];
}

/* ------------------------------------------------------------------ foreground: live models pinned to page elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#d4dcff', ground: '#4a4560', hemiI: 1.35, key: '#fff3e0', keyI: 2.1, fill: '#ffd9b0', fillI: .7, dir: [-.45, .75, .8] });
const pcam = new THREE.PerspectiveCamera(20, 1, 10, 30000);
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false);
  setFov(bgCam);
  pcam.aspect = W / H; pcam.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); pcam.lookAt(0, 0, 0); pcam.updateProjectionMatrix();
}
let dpr = Math.min(devicePixelRatio || 1, 1.75);
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', () => { sizeAll(); shadowDirty = true; });

const palTpl = {};
function palFor(e) { if (!palTpl[e]) palTpl[e] = (M.PAL_BUILD[e] || M.dragon)(); return K.instance(palTpl[e]); }
const live = new Map(), seen = new Set();
const px = r => [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)];
const KINDS = [
  { sel: '.sky-title .moon', key: () => 'moon', make: () => { const m = K.moon(1, true); m.userData.kind = 'moon'; return m; },
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); o.scale.setScalar(r.width * .4); o.rotation.y = Math.sin(T * .3) * .25; o.rotation.x = Math.sin(T * .23) * .1; } },
  { sel: '.pal-say .av', key: el => el.textContent.trim(), make: (el, k) => palFor(k),
    place: (o, el, r) => { const s = r.height / 2.35; const [x] = px(r); o.position.set(x, H / 2 - r.bottom + s * .05, 0); o.scale.setScalar(s); o.rotation.y = .45; o.userData.mood = 'idle'; } }
];
function syncAnchors(scr) {
  seen.clear();
  const root = $(scr);
  if (root) for (const kind of KINDS) for (const el of root.querySelectorAll(kind.sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.bottom < -80 || r.top > H + 80) continue;
    let rec = live.get(el); const key = kind.key(el);
    if (!key) continue;
    if (!rec || rec.key !== key) { if (rec) fg.remove(rec.obj); rec = { obj: kind.make(el, key), key }; live.set(el, rec); }
    if (rec.obj.parent !== fg) fg.add(rec.obj);
    kind.place(rec.obj, el, r);
    seen.add(el);
  }
  for (const [el, rec] of live) { if (seen.has(el)) continue; if (rec.obj.parent) fg.remove(rec.obj); if (!el.isConnected) live.delete(el); }
}

/* ------------------------------------------------------------------ still 3D pictures swapped in for emoji and drawings */
const bake = (key, build, view, w, h) => baker.bake(key, build, { w, h, ...view });
const fr = (cy, hv, aspect) => [0, cy, hv / (1 + Math.tan(THREE.MathUtils.degToRad(12)) * aspect)];
const img = (url, cls = '') => `<img class="g3i ${cls}" src="${url}" alt="" draggable="false">`;
const palImg = e => M.PAL_BUILD[e] ? bake('pal' + e, () => M.PAL_BUILD[e](), { yaw: .32, pitch: .1, pad: 1.04 }, 220, 240) : null;
const EMBLEM = {
  '🌟': () => M.gemModel('🌟'),
  '💎': () => { const g = new THREE.Group(); const c = M.landmark('P'); g.add(c); return g; },
  '🧁': M.cupcake,
  '🦦': () => M.landmark('S'),
  '🍇': () => { const g = new THREE.Group(); const b = M.moonberries(); g.add(b); return g; },
  '🕰️': () => M.clockModel(305, 60)
};
const OBJ = { '🌟': () => K.firefly({}), '🧁': M.cupcake, '🐟': M.fish, '🥧': M.pieWhole };
function swap(el, url) { if (el && url) el.innerHTML = img(url); }
function emojiOf(el) { if (!el || el.querySelector('img.g3i')) return ''; return el.textContent.trim(); }
let kitCSS = null;
function ensureKitCSS() {
  if (kitCSS) return;
  const b = (k, f, w, h, v = {}) => bake('kit-' + k, f, { yaw: .3, pitch: .25, pad: 1.0, ...v }, w, h);
  const u = {
    flat: b('flat', () => M.tenBlock('flat'), 128, 128, { yaw: .28, pitch: .2 }), rod: b('rod', () => M.tenBlock('rod'), 30, 136, { yaw: .5, pitch: .15 }), cube: b('cube', () => M.tenBlock('cube'), 40, 40),
    q: b('q', () => M.coinModel('q'), 132, 132, { yaw: .15, pitch: .1 }), d: b('d', () => M.coinModel('d'), 100, 100, { yaw: .15, pitch: .1 }), n: b('n', () => M.coinModel('n'), 112, 112, { yaw: .15, pitch: .1 }), p: b('p', () => M.coinModel('p'), 100, 100, { yaw: .15, pitch: .1 })
  };
  kitCSS = document.createElement('style'); kitCSS.id = 'g3dkit';
  kitCSS.textContent = ['flat', 'rod', 'cube'].map(k => `body.g3d .${k}{background:url(${u[k]}) center/100% 100% no-repeat;background-origin:border-box;border-color:transparent}`).join('\n') + '\n' +
    ['q', 'd', 'n', 'p'].map(k => `body.g3d .coin.${k}{background:url(${u[k]}) center/100% 100% no-repeat;box-shadow:none}`).join('\n');
  document.head.appendChild(kitCSS);
}
function decorate() {
  const app = $('app'); if (!app) return;
  app.querySelectorAll('.pal .e').forEach(el => { const e = emojiOf(el); if (e) { el.dataset.src = e; swap(el, palImg(e)); } });
  let e = emojiOf($('in-hero')); if (e && EMBLEM[e]) swap($('in-hero'), bake('emblem' + e, EMBLEM[e], { yaw: .3, pitch: e === '🦦' || e === '💎' ? .5 : .15, pad: 1.06 }, 300, 280));
  e = emojiOf($('d-gem')); if (e) swap($('d-gem'), bake('gem' + e, () => M.gemModel(e), { yaw: .25, pitch: .15, pad: 1.15 }, 280, 280));
  e = emojiOf($('f-hero')); if (e) { const p = Object.keys(M.PAL_BUILD).find(k => e.includes(k)); if (p) swap($('f-hero'), palImg(p)); }
  app.querySelectorAll('#q-vis .objs span').forEach(el => { const e = emojiOf(el); if (e && OBJ[e]) swap(el, bake('obj' + e, OBJ[e], { yaw: e === '🐟' ? .05 : .3, pitch: e === '🥧' ? .5 : .15, pad: 1.08 }, 96, 96)); });
  app.querySelectorAll('#q-vis .basket').forEach(el => { const t = emojiOf(el); if (!t) return; const n = t.split('🍇').length - 1; if (!n) return; const u = bake('berry', M.moonberries, { yaw: .3, pitch: .15, pad: 1.05 }, 80, 80); el.innerHTML = img(u).repeat(n); });
  app.querySelectorAll('#q-vis svg[aria-label=clock]:not(.g3)').forEach(svg => {
    const ang = l => l ? (Math.atan2(+l.getAttribute('x2') - 50, 50 - +l.getAttribute('y2')) * 180 / Math.PI + 360) % 360 : 0;
    const hr = ang(svg.querySelector('line[stroke-width="5"]')), mn = ang(svg.querySelector('line[stroke="#d9577a"]'));
    const u = bake('clock' + Math.round(hr) + '/' + Math.round(mn), () => M.clockModel(hr, mn), { frame: fr(0, 2.3, 1), yaw: .1, pitch: .06 }, 380, 380);
    svg.outerHTML = `<svg class="g3" viewBox="0 0 100 100" width="${svg.getAttribute('width')}" height="${svg.getAttribute('height')}" role="img" aria-label="clock"><image href="${u}" width="100" height="100"/></svg>`;
  });
  app.querySelectorAll('#q-vis svg[aria-label=pie]:not(.g3)').forEach(svg => {
    const paths = [...svg.querySelectorAll('path')], n = paths.length, k = paths.filter(p => p.getAttribute('fill') === '#d9577a').length;
    const u = bake('pie' + n + '/' + k, () => M.piePieces(n, k), { yaw: 0, pitch: 1.12, pad: 1.04 }, 340, 340);
    svg.outerHTML = `<svg class="g3" viewBox="0 0 100 100" width="${svg.getAttribute('width')}" height="${svg.getAttribute('height')}" role="img" aria-label="pie"><image href="${u}" width="100" height="100"/></svg>`;
  });
  if (!kitCSS && app.querySelector('#q-vis .flat, #q-vis .rod, #q-vis .cube, #q-vis .coin')) ensureKitCSS();
  if (screen() === 's-map') placeLandButtons();
}
let decorating = false;
const mo = new MutationObserver(() => { if (decorating) return; decorating = true; try { decorate(); } catch (e) { console.warn('[3d] decorate', e); } finally { mo.takeRecords(); decorating = false; } });
mo.observe($('app'), { childList: true, subtree: true, characterData: true });
decorate();

/* the land buttons on the map follow their 3D landmarks */
const tmpV = new THREE.Vector3();
function placeLandButtons() {
  const m = $('map'); if (!m) return;
  const mr = m.getBoundingClientRect();
  m.querySelectorAll('.land').forEach(b => {
    const lm = landmarks[b.dataset.k]; if (!lm) return;
    // the name sits just in front of the land's mound, so the tap area covers the landmark itself
    tmpV.set(lm.position.x, 0, lm.position.z + 1.2 * LM_SCALE).project(bgCam);
    const sx = (tmpV.x + 1) / 2 * W, sy = (1 - tmpV.y) / 2 * H;
    const nm = b.querySelector('.nm'); const top = nm ? nm.offsetTop : b.offsetHeight / 2;
    const L = Math.round(sx - mr.left) + 'px', Tp = Math.round(sy - mr.top + b.offsetHeight / 2 - top) + 'px';
    if (b.style.left !== L) b.style.left = L; if (b.style.top !== Tp) b.style.top = Tp;
    const zi = String(Math.round(lm.position.z * 10) + 200); if (b.style.zIndex !== zi) b.style.zIndex = zi; // nearer lands sit on top, so each landmark taps its own land
  });
}

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, lastKey = '', shadowDirty = true, lastDone = '', fadeT = 0;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function groundUnder(sx, sy, cam) { ndc.set(sx / W * 2 - 1, -(sy / H * 2 - 1)); raycaster.setFromCamera(ndc, cam); return raycaster.ray.intersectPlane(groundPlane, hit) ? hit.clone() : null; }
// where the guide stands: in the free space under (or beside) the card, feet near the bottom of the screen
function guideSlot(sec) {
  const r = sec.getBoundingClientRect(), app = $('app').getBoundingClientRect();
  const free = H - r.bottom, side = W - app.right;
  if (free > 150) return { x: Math.min(W * .8, app.right - 90), y: H - 34, h: Math.min(free - 40, 280, H * .25) };
  if (side > 150) return { x: W - side / 2, y: H * .8, h: Math.min(H * .4, 280) };
  return { x: W - 110, y: H + 30, h: 200 };
}
const lastGuide = new THREE.Vector3();
let fails = 0;
function frame(now) {
  if (fails > 3) return;
  requestAnimationFrame(frame);
  try { step(now); } catch (e) {
    console.warn('[3d] frame', e);
    if (++fails > 3) { mo.disconnect(); document.body.classList.remove('g3d'); canvas.remove(); }
  }
}
function step(now) {
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rdt); last = now;
  T += dt * (REDUCED ? .3 : 1);
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < Math.min(devicePixelRatio || 1, 1.75) - .05) { dpr = Math.min(dpr + .15, Math.min(devicePixelRatio || 1, 1.75)); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();

  const scr = screen();
  if (scr === 's-grown') { canvas.style.visibility = 'hidden'; lastKey = ''; return; }
  canvas.style.visibility = 'visible';
  const landMode = scr === 's-intro' || scr === 's-q' || scr === 's-done';
  const key = landMode ? currentLand(scr) : '';
  if (landMode) lastLand = key;
  const modeKey = landMode ? 'land:' + key : 'sky';
  const view = viewFor(scr);
  // a short fade hides the jump between the sky island and a land
  if (modeKey !== lastKey.split('|')[0]) {
    if (lastKey) { canvas.style.transition = 'none'; canvas.style.opacity = '0'; fadeT = .05; }
    camPos.fromArray(view.pos); camAt.fromArray(view.at); shadowDirty = true;
  }
  if (lastKey !== modeKey + '|' + scr) shadowDirty = true;
  lastKey = modeKey + '|' + scr;
  if (fadeT > 0) { fadeT -= rdt; if (fadeT <= 0) { canvas.style.transition = 'opacity .45s ease-out'; canvas.style.opacity = '1'; } }

  island.visible = !landMode; groundW.visible = landMode;
  bg.fog.near = landMode ? 26 : 60; bg.fog.far = landMode ? 80 : 200;
  // camera
  const k = 1 - Math.exp(-rdt * 2.4);
  const par = scr === 's-map' ? 0 : 1;
  parX += (tgtParX - parX) * Math.min(1, dt * 1.5);
  camPos.lerp(tmpV.set(view.pos[0] + par * (parX * .8 + Math.sin(T * .07) * .3), view.pos[1], view.pos[2]), k);
  camAt.lerp(tmpV.fromArray(view.at), k);
  bgCam.position.copy(camPos); bgCam.lookAt(camAt); bgCam.updateMatrixWorld();
  planCam.position.fromArray(view.pos); planCam.lookAt(tmpV.fromArray(view.at)); setFov(planCam); planCam.updateMatrixWorld();
  skyRoot.position.copy(bgCam.position);

  // sky, moon and motes
  bg.userData.stars.uniforms.t.value = T; bg.userData.stars.uniforms.px.value = dpr;
  bg.userData.skyMat.uniforms.warm.value += ((scr === 's-done' ? .55 : scr === 's-final' ? .8 : 0) - bg.userData.skyMat.uniforms.warm.value) * Math.min(1, dt * 2);
  moonObj.visible = scr !== 's-start';
  { // the moon sits up and to the side of the resting view
    ndc.set(W > H ? .62 : .55, .78); raycaster.setFromCamera(ndc, planCam);
    moonObj.position.copy(planCam.position).addScaledVector(raycaster.ray.direction, landMode ? 70 : 95);
    moonObj.lookAt(planCam.position);
  }
  const fc = landMode ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(camAt.x, 0, camAt.z);
  for (let i = 0; i < motes.n; i++) { const h = motes.home[i], kk = T * .35 + motes.ph[i]; motes.pos[i * 3] = fc.x + h[0] + Math.sin(kk) * 1.4; motes.pos[i * 3 + 1] = h[1] + Math.sin(kk * 1.3) * .5; motes.pos[i * 3 + 2] = fc.z + h[2] + Math.cos(kk * .8); }
  motes.g.attributes.position.needsUpdate = true; motes.m.uniforms.t.value = T; motes.m.uniforms.px.value = dpr;

  if (!landMode) {
    // the island: lands light up once explored
    const done = doneLands(scr), dk = [...done].sort().join('');
    if (dk !== lastDone) { lastDone = dk; path.set(done); shadowDirty = true; }
    for (const kk of KEYS) {
      const lm = landmarks[kk], on = done.has(kk), u = lm.userData;
      const pulse = .5 + .5 * Math.sin(T * 2.2 + kk.charCodeAt(0));
      u.lights.forEach(m => { m.emissiveIntensity = m.userData.base * (on ? 1 : .22 + .18 * pulse); });
      u.halo.material.opacity = on ? .55 : .12 + .14 * pulse; u.halo.material.color.set(on ? '#ffd98a' : '#a9bcff');
      u.sparks.forEach((s, i) => { s.material.opacity = on ? .5 + .5 * Math.sin(T * 3 + i * 2) : 0; });
      const gm = gems[kk]; gm.visible = on; if (on) { gm.rotation.y = T * 1.2; gm.position.y = 3.9 * LM_SCALE + Math.sin(T * 1.5 + kk.charCodeAt(0)) * .15; }
    }
    island.userData.water.uniforms.t.value = T;
    clouds.rotation.y = T * .01;
    // the travel friend waits beside the last land explored (or at the start of the path)
    const pe = palEmoji();
    if (mapPalKey !== pe) { if (mapPal) island.remove(mapPal); mapPal = palFor(pe); mapPalKey = pe; mapPal.scale.setScalar(.75); island.add(mapPal); shadowDirty = true; }
    const lastDoneKey = [...KEYS].reverse().find(kk => done.has(kk));
    const [px0, pz0] = lastDoneKey ? LAND_POS[lastDoneKey] : [-9, 6.2];
    mapPal.position.set(px0 + (lastDoneKey ? 1.9 : 0), 0, pz0 + (lastDoneKey ? 1.2 : 0)); mapPal.rotation.y = .3;
    mapPal.userData.mood = scr === 's-final' ? 'happy' : 'idle';
    M.animateAny(mapPal, T);
    skyLan.visible = scr === 's-final';
    if (skyLan.visible) skyLan.children.forEach(l => { const u = l.userData, kk = (T * u.sp + u.ph) % 1; l.position.set(u.x + Math.sin(T * .3 + u.sw) * .6, -8 + kk * 30, u.z); });
    if (scr === 's-map') placeLandButtons();
  } else {
    skyLan.visible = false;
    const sc = sceneFor(key);
    for (const kk in scenes) scenes[kk].group.visible = scenes[kk].guide.visible = kk === key;
    groundMat.color.set(GROUND[key]); grass.visible = key !== 'P' && key !== 'F' && !sc.ownGrass; cobbles.visible = key === 'F';
    sc.tick(T);
    // the guide stands in the free space under the card
    const slot = guideSlot($(scr)), gp = groundUnder(slot.x, slot.y, planCam), gd = sc.guide;
    if (gp) {
      const dist = gp.clone().sub(planCam.position).dot(planCam.getWorldDirection(tmpV));
      const upp = 2 * dist * Math.tan(THREE.MathUtils.degToRad(planCam.fov / 2)) / H;
      const isFF = gd.userData.kind === 'firefly', mh = isFF ? 2.7 : 2.8;
      const s = THREE.MathUtils.clamp(slot.h * upp / mh, .45, 2.4);
      gd.scale.setScalar(s);
      gd.position.set(gp.x, isFF ? s * 1.1 : 0, gp.z);
      gd.lookAt(planCam.position.x, gd.position.y, planCam.position.z); gd.rotation.y -= .25;
      if (gp.distanceTo(lastGuide) > .05) { lastGuide.copy(gp); shadowDirty = true; }
    }
    gd.userData.mood = scr === 's-done' ? 'happy' : 'idle';
    M.animateAny(gd, T);
  }
  bgL.key.position.copy(bgL.key.target.position.set(landMode ? 0 : 0, 0, landMode ? -1 : 0)).add(tmpV.set(-7, 12, 7));

  syncAnchors(scr);
  for (const rec of live.values()) if (rec.obj.parent) M.animateAny(rec.obj, T);

  if (shadowDirty) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
  R.clear();
  R.render(bg, bgCam);
  stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles;
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
  stats.total = stats.bg + stats.fg; stats.screen = scr; stats.max = Math.max(stats.max || 0, stats.total);
}
const stats = {};
requestAnimationFrame(frame);
G.__mm3d = { R, bg, fg, live, baker, stats, island, landmarks, scenes, get dpr() { return dpr; } };
