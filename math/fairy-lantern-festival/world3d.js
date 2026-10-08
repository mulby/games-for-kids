// Fairy Lantern Festival in 3D.
// The game itself (rules, touch, saves, voice, cards) is unchanged and still lives in index.html's DOM.
// This module draws the world behind it in real 3D and replaces every drawn object with a 3D model:
//  - live models follow their DOM element each frame (fireflies, lanterns, mini lanterns, the fairy, the moon, the moss bed)
//  - still objects (jars, petal tiles, bell, cards, cottage furniture, the queen…) are rendered once to images
//    and swapped in for the old SVG drawings, so every layout rule and animation keeps working.
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';

const G = window;
const D = await import('./decor3d.js').catch(e => { console.warn('[3d] decor models missing', e); return {}; });

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
R.setClearColor('#141836', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(256);
const REDUCED = () => typeof G.REDUCED !== 'undefined' && G.REDUCED;
const screen = () => (typeof CUR_SCREEN !== 'undefined' ? CUR_SCREEN : 'title');
const WORLD_SCREENS = { title: 1, meet: 1, map: 1, night: 1, end: 1, cottage: 1 };

/* ------------------------------------------------------------------ background world (meters) */
const bg = new THREE.Scene();
bg.fog = new THREE.Fog('#2f3577', 24, 75);
const bgCam = new THREE.PerspectiveCamera(42, 1, .1, 220);
(function sky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color('#10133a') }, b: { value: new THREE.Color('#2b3178') }, c: { value: new THREE.Color('#4b4f9e') }, warm: { value: 0 } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a,b,c; uniform float warm; varying vec3 v; void main(){ float h=v.y; vec3 col = h>0.12? mix(b,a,smoothstep(.12,.75,h)) : mix(c,b,smoothstep(-.1,.12,h)); col += vec3(.35,.18,.05)*warm*smoothstep(.35,-.05,h); gl_FragColor=vec4(col,1.); }'
  });
  bg.add(new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), m)); bg.userData.skyMat = m;
  const n = 1100, pos = new Float32Array(n * 3), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.25 + .06; pos.set([Math.cos(th) * Math.cos(ph) * 130, Math.sin(ph) * 130, Math.sin(th) * Math.cos(ph) * 130], i * 3); sz[i] = Math.random(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('s', new THREE.BufferAttribute(sz, 1));
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 } },
    vertexShader: 'attribute float s; uniform float t,px; varying float a; void main(){ a = .45+.55*sin(t*(1.+s*3.)+s*40.); gl_PointSize = (1.5+s*s*4.5)*px; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying float a; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); float k=smoothstep(.5,0.,d); k += .6*max(0.,1.-abs(p.x)*14.)*max(0.,1.-abs(p.y)*2.5)+.6*max(0.,1.-abs(p.y)*14.)*max(0.,1.-abs(p.x)*2.5); gl_FragColor=vec4(vec3(1.,.96,.82)*k*a,k*a); }'
  });
  bg.add(new THREE.Points(sg, sm)); bg.userData.stars = sm;
})();
const bgL = K.toyLights(bg, { sky: '#b8c4ff', ground: '#2c4a38', hemiI: 1.15, key: '#dfe4ff', keyI: 1.6, fill: '#ffd9b0', fillI: .7, dir: [-6, 10, 6] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(1024, 1024); bgL.key.shadow.bias = -.002;
Object.assign(bgL.key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
const moonObj = K.moon(2.8); moonObj.position.set(-10, 15, -40); bg.add(moonObj);
(function ground() {
  const g = new THREE.PlaneGeometry(140, 140, 64, 64); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z * 1.2);
    let y = Math.sin(x * .35) * .12 + Math.cos(z * .3) * .1;
    if (d > 11) y += (d - 11) * (d - 11) * .0035 + Math.sin(x * .25 + 1) * .5 * Math.min(1, (d - 11) / 5);
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, K.mat('#2f5a3a', { rough: .95 })); m.receiveShadow = true; bg.add(m);
  bg.add(K.grassField(5200, [-16, 16, -12, 9]));
  // hills, trees, mushrooms and stones never move: merge them into a few draw calls
  const still = new THREE.Group();
  [[-22, -48, 14, '#2c4d3a'], [6, -55, 18, '#294836'], [32, -46, 13, '#30553d'], [-44, -34, 11, '#2e503b']].forEach(([x, z, r, c]) => still.add(K.ball(K.mat(c, { felt: true }), [x, -r * .72, z], [r * 1.8, r, r])));
  [[-10, -9, 1.3], [-13.5, -3, 1.1], [11, -8, 1.4], [14, -1.5, 1.05], [-6.5, -14, 1.2], [5.5, -15, 1.5], [0, -19, 1.3], [-17, -11, 1.4], [17, -12, 1.3]].forEach(([x, z, k], i) => { const t = K.tree(k, i % 2 ? '#3f6f4a' : '#477a52'); t.position.set(x, 0, z); t.rotation.y = i; still.add(t); });
  [[-5.8, 1.5, 1.1, '#e2566b'], [-6.8, .4, .7, '#f2a7b5'], [-4.9, 2.6, .55, '#e2566b'], [6.2, 1.8, 1.0, '#b9a6e8'], [7.2, .7, .6, '#e2566b'], [5.4, 3.2, .45, '#f2a7b5']].forEach(([x, z, k, c]) => { const m = K.mushroom(c, k); m.position.set(x, 0, z); m.rotation.y = x; still.add(m); });
  const cols = ['#f6a6bd', '#ffffff', '#b9a6e8', '#a9d4ff', '#ffd86b'];
  cols.forEach(c => { const items = []; for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 8; items.push({ p: [Math.cos(a) * r, 0, Math.sin(a) * r * .7 - 1], s: .7 + Math.random() * .6, ry: Math.random() * 6 }); } bg.add(K.scatter(K.flower(c), items)); });
  [[-2.5, 3.5, .6], [3, 4, .5], [-8, -2, .9], [8.5, -3, .7]].forEach(([x, z, k]) => { const st = K.stone(k); st.position.set(x, 0, z); still.add(st); });
  bg.add(K.freeze(still));
})();

/* festival string of lanterns between the back trees; lights up as the night goes on */
const festival = [];
(function garland() {
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([-11 + t * 22, 8.2 - Math.sin(t * Math.PI) * 1.2, -12 + Math.sin(t * Math.PI) * .5]); }
  const caps = new THREE.Group(); caps.add(K.tube(pts, .025, K.mat('#5a4630'), 48, 4));
  for (let i = 0; i < 8; i++) {
    const t = (i + .5) / 8, x = -11 + t * 22, y = 8.2 - Math.sin(t * Math.PI) * 1.2 - .45, z = -12 + Math.sin(t * Math.PI) * .5;
    const L = new THREE.Group(); L.position.set(x, y, z);
    const lightM = new THREE.MeshStandardMaterial({ color: '#c9a46a', emissive: '#ffc95a', emissiveIntensity: 0, roughness: .5 });
    const core = K.lathe([[0, -.26], [.17, -.24], [.23, -.08], [.23, .1], [.17, .24], [0, .26]], lightM, 14);
    caps.add(K.mesh(new THREE.CylinderGeometry(.12, .2, .1, 12), K.mat('#d6aa5c', { metal: true }), [x, y + .3, z]));
    caps.add(K.mesh(new THREE.CylinderGeometry(.2, .14, .08, 12), K.mat('#d6aa5c', { metal: true }), [x, y - .29, z]));
    const halo = K.glow('#ffcf66', 2.2, 0);
    L.add(core, halo); bg.add(L);
    festival.push({ L, lightM, halo, on: 0 });
  }
  bg.add(K.freeze(caps));
})();

/* glade variations */
const glades = {};
(function variants() {
  const mk = name => { const g = new THREE.Group(); g.visible = false; bg.add(g); glades[name] = g; return g; };
  // Moonberry Garden: berry bushes
  const mb = mk('Moonberry Garden');
  [[-8.5, -1, 1.2], [-6.5, -4, 1], [8, -2, 1.3], [9.5, -5, .9], [-3.5, -6, .8], [4, -6.5, .9]].forEach(([x, z, k]) => {
    const b = new THREE.Group();
    [[0, .7, 0, .9], [-.6, .5, .2, .6], [.6, .55, -.1, .65]].forEach(([a, c, d, r]) => b.add(K.ball(K.mat('#3f7a4a', { felt: true }), [a, c, d], r)));
    for (let i = 0; i < 9; i++) { const a = Math.random() * Math.PI * 2; b.add(K.ball(K.mat('#9b8cff', { gloss: true }), [Math.cos(a) * .75, .5 + Math.random() * .7, Math.sin(a) * .5 + .3], .12)); }
    K.freeze(b); b.position.set(x, 0, z); b.scale.setScalar(k); mb.add(b);
  });
  // Whispering River: a slow river with moonlight sparkle, reeds and lily pads
  const rv = mk('Whispering River');
  const water = new THREE.ShaderMaterial({
    transparent: true, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float t; varying vec2 vUv; varying vec3 vW; float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} void main(){ float w = n(vec2(vW.x*1.5 - t*.6, vW.z*5.)) * n(vec2(vW.x*.7+t*.3, vW.z*2.)); vec3 col = mix(vec3(.12,.2,.42), vec3(.3,.45,.8), w); float sp = pow(n(vec2(vW.x*8.-t*2., vW.z*20.)), 9.)*3.*smoothstep(8.,-6.,vW.x); col += vec3(1.,.92,.7)*sp; float edge = smoothstep(0.,.12,vUv.y)*smoothstep(1.,.88,vUv.y); gl_FragColor=vec4(col, .92*edge); }'
  });
  const rg = new THREE.PlaneGeometry(60, 3.4, 80, 4); rg.rotateX(-Math.PI / 2);
  const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + Math.sin(x * .18) * 1.6 - 4.2); p.setY(i, .06); }
  const river = new THREE.Mesh(rg, water); river.renderOrder = 1; rv.add(river); rv.userData.water = water;
  const reeds = new THREE.Group();
  for (let i = 0; i < 26; i++) { const x = -14 + Math.random() * 28, z = Math.sin(x * .18) * 1.6 - 4.2 + (Math.random() < .5 ? -1.9 : 1.9) + (Math.random() - .5) * .4; const r = new THREE.Group(); r.add(K.tube([[0, 0, 0], [.05, .8, 0], [.12, 1.5, .05]], .035, K.mat('#4f7f45'), 6, 4)); r.add(K.capsule(K.mat('#7a5a3a', { felt: true }), [.11, 1.35, .05], [.13, 1.75, .05], .07)); r.position.set(x, 0, z); r.rotation.y = Math.random() * 3; reeds.add(r); }
  rv.add(K.freeze(reeds));
  [[-3, -3.6], [2.5, -4.6], [6, -3]].forEach(([x, z]) => { const pad = K.mesh(new THREE.CircleGeometry(.5, 20, .3, Math.PI * 1.85), K.mat('#5c9a5e', { felt: true }), [x, .09, z], 1, [-Math.PI / 2, 0, 0]); rv.add(pad); rv.add(K.flower('#f6a6bd', .6).translateX(x + .1).translateZ(z).translateY(-.2)); });
  // Starlight Meadow: lots of little white flowers and a low shimmer of stars
  const sm = mk('Starlight Meadow');
  ['#ffffff', '#fff2a8'].forEach((c, j) => { const items = []; for (let i = 0; i < (j ? 25 : 45); i++) items.push({ p: [-12 + Math.random() * 24, 0, -8 + Math.random() * 12], s: .5 + Math.random() * .4, ry: Math.random() * 6 }); sm.add(K.scatter(K.flower(c), items)); });
  for (let i = 0; i < 30; i++) { const s = K.glow(i % 2 ? '#fff6c8' : '#ffe08a', .35 + Math.random() * .3, .9); s.position.set(-12 + Math.random() * 24, .3 + Math.random() * 1.6, -8 + Math.random() * 12); s.userData.tw = Math.random() * 9; sm.add(s); }
  // Mushroom Ring: a fairy ring of softly glowing mushrooms
  const mr = mk('Mushroom Ring');
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, glowCol = i % 2 ? '#ff9fc2' : '#7fe8d8';
    const m = new THREE.Group();
    m.add(K.lathe([[0, 0], [.14, 0], [.15, .25], [.11, .55], [0, .57]], K.mat('#fff1d6', { felt: true }), 10));
    m.add(K.lathe([[0, .82], [.28, .78], [.48, .64], [.55, .52], [.38, .48], [0, .52]], K.mat(glowCol, { glow: .9 }), 16));
    const gl = K.glow(glowCol, 2.2, .55); gl.position.y = .6; m.add(gl);
    m.position.set(Math.cos(a) * 7.5, 0, Math.sin(a) * 4 - 2); m.scale.setScalar(.8 + (i % 3) * .2); mr.add(m);
  }
})();

/* drifting fireflies and sky lanterns */
const motes = (function () {
  const n = 46, pos = new Float32Array(n * 3), home = [], ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { home.push([(Math.random() - .5) * 30, .4 + Math.random() * 5, -2 - Math.random() * 14]); ph[i] = Math.random() * 20; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 }, map: { value: K.glowTexture() } },
    vertexShader: 'attribute float ph; uniform float t,px; varying float a; void main(){ a = max(0., sin(t*1.1+ph*3.)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 300.*px/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.,.9,.45)*c.a*a, c.a*a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; bg.add(pts);
  return { pos, home, ph, g, m, n };
})();
const skyLan = new THREE.Group(); bg.add(skyLan);
for (let i = 0; i < 28; i++) {
  const l = new THREE.Group();
  l.add(K.lathe([[0, -.3], [.24, -.28], [.3, 0], [.22, .3], [0, .32]], new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9f40', emissiveIntensity: 1.6, roughness: .6, fog: false }), 10));
  l.add(K.glow('#ffb860', 2.2, .7));
  l.userData = { x: (Math.random() - .5) * 40, z: -6 - Math.random() * 30, ph: Math.random(), sp: .02 + Math.random() * .025, sw: Math.random() * 9 };
  l.scale.setScalar(.7 + Math.random() * .6); skyLan.add(l);
}
skyLan.visible = false;

/* camera framing per screen (landscape iPad first; portrait widens the view) */
const VIEWS = {
  title: { pos: [0, 1.6, 13], at: [0, 6.5, -10] },
  meet: { pos: [2.5, 3.2, 10], at: [0, 2.6, -2] },
  map: { pos: [0, 15, 19], at: [0, 0, -5] },
  night: { pos: [0, 2.3, 13], at: [0, 2.9, 0] },
  end: { pos: [0, 2, 12], at: [0, 6, -10] },
  cottage: { pos: [-4, 1.4, 11], at: [0, 2.6, 0] }
};
const camPos = new THREE.Vector3(...VIEWS.title.pos), camAt = new THREE.Vector3(...VIEWS.title.at);
let parX = 0, tgtParX = 0;
addEventListener('pointermove', e => { tgtParX = (e.clientX / innerWidth - .5); }, { passive: true });

/* ------------------------------------------------------------------ foreground: 3D models pinned to DOM elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#d4dcff', ground: '#4a4560', hemiI: 1.35, key: '#fff3e0', keyI: 2.1, fill: '#ffd9b0', fillI: .7, dir: [-.45, .75, .8] });
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
let dpr = Math.min(devicePixelRatio || 1, 1.75);
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', sizeAll);

const live = new Map();            // element -> { obj, key }
const seen = new Set();
function px(r) { return [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)]; }
function setFade(obj, a) {
  if (obj.userData.fade === a) return; obj.userData.fade = a;
  obj.traverse(o => {
    if (o.isSprite) { o.material.opacity = (o.userData.glowBase ?? 1) * a; return; }
    if (!o.isMesh) return;
    if (!o.userData.orig) o.userData.orig = o.material;
    if (a >= .999) { o.material = o.userData.orig; return; }
    if (!o.userData.faded) { o.userData.faded = o.userData.orig.clone(); o.userData.faded.transparent = true; o.userData.faded.depthWrite = false; }
    o.userData.faded.opacity = a * (o.userData.orig.opacity ?? 1); o.material = o.userData.faded;
  });
}

/* --- fireflies --- */
const FF_COL = { '': ['#ffe27a', '#cfe6ff', '#ffd65a'], gold: ['#ffe27a', '#cfe6ff', '#ffd65a'], rose: ['#ffc4d1', '#ffe1ea', '#ff9fb8'], lav: ['#e4dbff', '#f3eeff', '#c9b6ff'], mint: ['#c8f5d0', '#e2fff0', '#8fe0a8'] };
const ffTpl = {};
function fireflyFor(color, sleepy) {
  const k = color + (sleepy ? 'z' : '');
  if (!ffTpl[k]) { const c = FF_COL[color] || FF_COL['']; ffTpl[k] = K.firefly({ body: c[0], wing: c[1], glowColor: c[2], sleepy }); }
  return K.instance(ffTpl[k]);
}
function ffKey(el) {
  const m = /\bc-(\w+)/.exec(el.className); const use = el.querySelector('use');
  return (m ? m[1] : '') + '|' + (use && /ffz/.test(use.getAttribute('href') || '') ? 'z' : '');
}

/* --- lantern built to the DOM lantern's measurements --- */
const brass = () => K.mat('#f2c46e', { metal: true }), darkBrass = () => K.mat('#c08a3e', { metal: true });
function lanternKey(el) {
  const b = el.querySelector('.lbody'), c = el.querySelector('.cell');
  return b ? [b.offsetWidth, b.offsetHeight, c ? c.offsetWidth : 0, el.querySelectorAll('.cell').length].join('x') : '';
}
function buildLantern(el) {
  const body = el.querySelector('.lbody'); const br = body.getBoundingClientRect();
  const s = br.width / body.offsetWidth || 1;
  const bw = body.offsetWidth, bh = body.offsetHeight;
  const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
  const loc = r => [(r.left + r.width / 2 - cx) / s, -(r.top + r.height / 2 - cy) / s, r.width / s, r.height / s];
  const cells = [...el.querySelectorAll('.cell')].map(c => loc(c.getBoundingClientRect()));
  const c = cells.length ? cells[0][2] : 60;
  const root = new THREE.Group();
  const front = K.roundRectShape(bw, bh, c * .34);
  cells.forEach(([x, y, w]) => { const hp = new THREE.Path(); hp.absarc(x, y, w * .47, 0, Math.PI * 2, true); front.holes.push(hp); });
  const fp = K.slab(front, c * .1, brass(), c * .035); fp.position.z = c * .36; root.add(fp);
  const ring = K.roundRectShape(bw, bh, c * .34); ring.holes.push(K.roundRectShape(bw - c * .22, bh - c * .22, c * .26));
  const side = K.slab(ring, c * .8, darkBrass(), 0); side.position.z = -c * .05; root.add(side);
  const back = K.slab(K.roundRectShape(bw - c * .2, bh - c * .2, c * .26), c * .06, K.mat('#2c2552', { felt: true }), 0); back.position.z = -c * .42; back.name = 'back'; back.userData.noMerge = true; root.add(back);
  cells.forEach(([x, y, w]) => {
    root.add(K.mesh(K.geo('cellring', () => new THREE.TorusGeometry(1, .09, 8, 28)), darkBrass(), [x, y, c * .43], w * .47));
    root.add(K.mesh(K.geo('cellcup', () => new THREE.CircleGeometry(1, 24)), K.mat('#3a3170', { felt: true }), [x, y, -c * .38], w * .45));
  });
  const cap = el.querySelector('.lcap'), handle = el.querySelector('.lhandle'), base = el.querySelector('.lbase');
  if (cap) {
    const [x, y, w, h] = loc(cap.getBoundingClientRect());
    const sh = new THREE.Shape(); sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w * .3, h / 2); sh.lineTo(-w * .3, h / 2); sh.closePath();
    const cm = K.slab(sh, c * .95, brass(), c * .04); cm.position.set(x, y, -c * .05); root.add(cm);
    root.add(K.ball(K.mat('#ffe7a8', { metal: true, shine: .3 }), [x, y + h / 2 + c * .05, -c * .05], c * .12));
  }
  if (handle) {
    const [x, y, w, h] = loc(handle.getBoundingClientRect());
    root.add(K.mesh(new THREE.TorusGeometry(w * .34, Math.max(2, c * .055), 8, 24, Math.PI), darkBrass(), [x, y - h * .45, -c * .05]));
  }
  if (base) {
    const [x, y, w, h] = loc(base.getBoundingClientRect());
    const bm = K.slab(K.roundRectShape(w, h, h * .45), c * .75, darkBrass(), c * .03); bm.position.set(x, y, -c * .05); root.add(bm);
  }
  const halo = K.glow('#ffcf6a', Math.max(bw, bh) * 1.5, 0); halo.position.z = -c * .3; root.add(halo);
  K.freeze(root);
  root.userData = { kind: 'lantern', halo, back: root.getObjectByName('back'), lit: false };
  return root;
}
const warmBack = new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffb84a', emissiveIntensity: 1.1, roughness: .7 });
const softBack = new THREE.MeshStandardMaterial({ color: '#d9ccff', emissive: '#9f8ce8', emissiveIntensity: .6, roughness: .7 });

/* --- mini lantern --- */
let miniTpl = {};
function miniFor(lit) {
  const k = lit ? 'on' : 'off';
  if (!miniTpl[k]) miniTpl[k] = D.miniLanternModel ? D.miniLanternModel(lit) : simpleMini(lit);
  const o = miniTpl[k].clone(true); o.userData = { kind: 'mini' }; return o;
}
function simpleMini(lit) {
  const g = new THREE.Group();
  g.add(K.slab(K.roundRectShape(.7, 1.05, .16), .5, K.mat(lit ? '#ffe2a0' : '#3a3170', lit ? { glow: .9 } : { felt: true }), .03).translateY(.72));
  g.add(K.slab(K.roundRectShape(.82, .14, .06), .6, darkBrass(), .02).translateY(.15));
  const cap = new THREE.Shape(); cap.moveTo(-.45, 0); cap.lineTo(.45, 0); cap.lineTo(.2, .24); cap.lineTo(-.2, .24); cap.closePath();
  g.add(K.slab(cap, .6, brass(), .03).translateY(1.25));
  if (lit) g.add(K.glow('#ffcf66', 2.4, .7).translateY(.7));
  return K.freeze(g);
}

/* --- moss bed for waiting fireflies --- */
function buildMeadow(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  const g = new THREE.Group();
  const moss = K.slab(K.roundRectShape(w * .96, h * .3, h * .15), h * .34, K.mat('#4f8a55', { felt: true }), h * .12);
  moss.position.set(0, -h * .3, -h * .2); g.add(moss);
  for (let i = 0; i < 9; i++) g.add(K.ball(K.mat(i % 2 ? '#5f9a62' : '#6fae66', { felt: true }), [-w * .42 + i / 8 * w * .84, -h * .16, -h * .2], [w * .07, h * .1, h * .18]));
  const tuft = K.geo('tuft', () => { const t = new THREE.ConeGeometry(1, 4, 3, 1); t.translate(0, 2, 0); return t; });
  const tm = K.mat('#6fae66', { felt: true }), tm2 = K.mat('#5c9a5e', { felt: true });
  const n = Math.round(w / 9);
  for (let i = 0; i < n; i++) { const x = -w * .46 + (i + Math.random() * .6) / n * w * .92; g.add(K.mesh(tuft, i % 2 ? tm : tm2, [x, -h * .1, h * .04 + Math.random() * h * .06], [h * .05, h * (.05 + Math.random() * .05), h * .05], [0, Math.random() * 3, (Math.random() - .5) * .5])); }
  const pet = ['#f6a6bd', '#ffffff', '#b9a6e8', '#ffd86b'];
  for (let i = 0; i < 7; i++) { const f = new THREE.Group(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; f.add(K.ball(K.mat(pet[i % 4], { felt: true }), [Math.cos(a) * .9, Math.sin(a) * .9, 0], [.7, .7, .3])); } f.add(K.ball(K.mat('#ffd86b', { felt: true }), [0, 0, .2], .55)); f.scale.setScalar(h * .045); f.position.set(-w * .44 + i / 6 * w * .88, -h * .12 + (i % 2) * h * .04, h * .1); g.add(f); }
  return K.freeze(g);
}

/* --- fairy look from a baked fairy image's data --- */
const fairyTpl = new Map();
function fairyFor(look) {
  if (!fairyTpl.has(look)) { const f = JSON.parse(look); fairyTpl.set(look, K.fairy(fairyOpts(f))); }
  return K.instance(fairyTpl.get(look));
}
function fairyOpts(f) {
  f = f || {};
  const wc = (typeof WINGS !== 'undefined' && WINGS[f.wing]) ? WINGS[f.wing].c : '#a9c8ff';
  return { wing: wc, hair: f.hair || 'bun', sit: !!f.sit };
}

/* anchor kinds: which DOM elements get a live 3D model, and how it sits on them */
const KINDS = [
  { sel: '.ff', key: ffKey,
    make: (el, key) => { const [c, z] = key.split('|'); return fireflyFor(c, !!z); },
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); o.scale.setScalar(r.width * .47); o.rotation.y = Math.sin(o.userData.t0 + T * .4) * .25; } },
  { sel: '.lan', key: lanternKey, make: el => buildLantern(el),
    place: (o, el, r) => {
      const b = el.querySelector('.lbody'); const br = b.getBoundingClientRect(); const [x, y] = px(br);
      o.position.set(x, y, 0); o.scale.setScalar(br.width / b.offsetWidth || 1);
      const lit = el.classList.contains('lit'), soft = el.classList.contains('soft'), u = o.userData;
      const mode = lit ? 'lit' : soft ? 'soft' : '';
      if (u.mode !== mode) { u.mode = mode; if (u.back) u.back.material = lit ? warmBack : soft ? softBack : K.mat('#2c2552', { felt: true }); }
      u.halo.material.opacity += ((lit ? .55 : soft ? .25 : 0) - u.halo.material.opacity) * .15;
      u.halo.material.color.set(soft && !lit ? '#c9b6ff' : '#ffcf6a');
      o.rotation.y = Math.sin(T * .6 + x * .01) * .04; o.rotation.x = -.04;
    } },
  { sel: '.mini', key: el => el.classList.contains('lit') ? 'on' : 'off', make: (el, k) => miniFor(k === 'on'),
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y - r.height / 2, 0); o.scale.setScalar(r.width * .95); o.rotation.y = Math.sin(T * .8 + x * .02) * .2; } },
  { sel: '.meadow', key: el => el.offsetWidth + 'x' + el.offsetHeight, make: el => buildMeadow(el),
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, -20); } },
  { sel: '#nfairy, .meet-fairy', key: el => { const i = el.querySelector('img.t3d,[data-look]'); return i ? i.getAttribute('data-look') : '{}'; }, make: (el, k) => fairyFor(k),
    place: (o, el, r) => {
      const s = r.height / 3.5; const [x] = px(r); o.position.set(x, H / 2 - r.bottom + s * .55, 0); o.scale.setScalar(s);
      o.rotation.y = .35 * Math.sign(-x || 1) * .6;
      o.userData.mood = el.classList.contains('loop') ? 'happy' : el.classList.contains('think') ? 'think' : 'idle';
    } },
  { sel: '#moonbtn', key: () => 'moon', make: () => { const m = K.moon(1, true); m.userData.kind = 'moon'; return m; },
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); o.scale.setScalar(r.width * .33); o.rotation.y = Math.sin(T * .3) * .25; o.rotation.x = Math.sin(T * .23) * .1; } }
];
const SEL_ALL = KINDS.map(k => k.sel).join(',');
function syncAnchors() {
  seen.clear();
  const roots = [document.getElementById(screen()), document.getElementById('fx')];
  document.querySelectorAll('.dragclone,.flyer').forEach(e => roots.push(e));
  for (const root of roots) {
    if (!root) continue;
    for (const kind of KINDS) {
      const list = root.matches && root.matches(kind.sel) ? [root, ...root.querySelectorAll(kind.sel)] : root.querySelectorAll(kind.sel);
      for (const el of list) {
        if (seen.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.bottom < -50 || r.top > H + 50) continue;
        let rec = live.get(el); const key = kind.key(el);
        if (!rec || rec.key !== key) { if (rec) fg.remove(rec.obj); rec = { obj: kind.make(el, key), key }; live.set(el, rec); }
        if (rec.obj.parent !== fg) fg.add(rec.obj);
        kind.place(rec.obj, el, r);
        const dim = el.closest('.dim,.used'); setFade(rec.obj, dim ? .35 : 1);
        seen.add(el);
      }
    }
  }
  for (const [el, rec] of live) {
    if (seen.has(el)) continue;
    if (rec.obj.parent) fg.remove(rec.obj);
    if (!el.isConnected) live.delete(el);
  }
}

/* ------------------------------------------------------------------ still models swapped in for the SVG drawings */
function svgImg(url, vb, cls = '', extra = '') {
  const [, , w, h] = vb.split(' ').map(Number);
  return `<svg ${cls ? `class="${cls}" ` : ''}viewBox="${vb}" aria-hidden="true"${extra}><image href="${url}" x="${vb.split(' ')[0]}" y="${vb.split(' ')[1]}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
const BK = 2.4; // baked pixels per viewBox unit
const fr = (cy, hv, aspect) => [0, cy, hv / (1 + Math.tan(THREE.MathUtils.degToRad(12)) * aspect)]; // exact framing for Baker's fixed frame
function bakeVB(key, vb, build, view) {
  const [, , w, h] = vb.split(' ').map(Number);
  const url = baker.bake(key, build, { w: Math.round(w * BK), h: Math.round(h * BK), ...view });
  return url;
}
function jarModel(rose) {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0ff', roughness: .08, transparent: true, opacity: .38, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  g.add(K.lathe([[0, 0], [.34, 0], [.42, .06], [.44, .2], [.44, .72], [.38, .84], [.24, .9], [.24, .95], [0, .95]], glass, 32));
  g.add(K.lathe([[0, .92], [.26, .92], [.27, 1.08], [.24, 1.1], [0, 1.1]], K.mat('#b9885a', { felt: true }), 20));
  const col = rose ? '#ff9fb8' : '#ffd65a';
  for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = .12 + (i % 3) * .08; g.add(K.ball(K.mat(col, { glow: 1.6 }), [Math.cos(a) * rr, .12 + i * .07, Math.sin(a) * rr], .055)); }
  g.add(K.mesh(K.geo('jarrim', () => new THREE.TorusGeometry(.25, .025, 6, 24)), K.mat('#e48aa0', { felt: true }), [0, .92, 0], 1, [Math.PI / 2, 0, 0]));
  return g;
}
function petalTileModel() {
  const s = new THREE.Shape();
  s.moveTo(0, 1.04); s.bezierCurveTo(.34, .98, .5, .68, .42, .38); s.bezierCurveTo(.36, .12, .18, 0, 0, 0); s.bezierCurveTo(-.18, 0, -.36, .12, -.42, .38); s.bezierCurveTo(-.5, .68, -.34, .98, 0, 1.04);
  const g = new THREE.Group();
  const m = K.slab(s, .12, new THREE.MeshStandardMaterial({ color: '#ff94b4', roughness: .55, emissive: '#ff6f9a', emissiveIntensity: .28 }), .05); g.add(m);
  g.add(K.tube([[0, .12, .1], [-.02, .5, .12], [0, .9, .1]], .012, K.mat('#ffe8ee', { felt: true }), 10, 4));
  g.position.y = .04;
  return g;
}
function bellModel() {
  const g = new THREE.Group();
  g.add(K.capsule(K.mat('#c08a3e', { metal: true }), [0, 1.5, 0], [0, 1.28, 0], .022));
  const bell = K.lathe([[0, 1.3], [.12, 1.28], [.2, 1.18], [.24, .98], [.27, .86], [.34, .78], [.33, .76], [0, .78]], K.mat('#f2c46e', { metal: true, shine: .2 }), 32); g.add(bell);
  g.add(K.ball(K.mat('#94692f', { metal: true }), [0, .76, 0], .06));
  g.add(K.tube([[0, .74, 0], [.01, .5, .01], [0, .26, 0]], .018, K.mat('#f6c4d0', { felt: true }), 8, 5));
  g.add(K.ball(K.mat('#f2a7b5', { gloss: true }), [0, .2, 0], .085));
  return g;
}
function cardCreature(c) {
  const f = K.firefly({ body: c.body, wing: c.wing, acc: c.acc === 'bee' ? null : c.acc, stripes: c.acc === 'bee', glowColor: c.rare ? '#ffe08a' : '#ffd65a' });
  f.rotation.y = -.2;
  return f;
}
function queenModel() {
  const q = K.fairy({ wing: '#d9ccff', hair: 'curls', hairColor: '#f3f0ff', dress: '#fff7e6', dress2: '#ffffff', crown: true });
  return q;
}
const ov = {}; // originals, for fallbacks
function override(name, fn) { if (typeof G[name] !== 'function') return; ov[name] = G[name]; G[name] = function (...a) { try { return fn(...a); } catch (e) { console.warn('[3d]', name, e); return ov[name](...a); } }; }

override('jarSVG', rose => svgImg(bakeVB('jar' + !!rose, '0 0 100 112', () => jarModel(rose), { frame: fr(.56, 1.12, 100 / 112), yaw: .2, pitch: .2 }), '0 0 100 112', 'jg'));
override('petalTileSVG', () => svgImg(bakeVB('petal', '0 0 104 112', petalTileModel, { frame: fr(.58, 1.2, 104 / 112), yaw: 0, pitch: .12 }), '0 0 104 112'));
override('bellSVG', () => svgImg(bakeVB('bell', '0 0 96 150', bellModel, { frame: fr(.75, 1.5, 96 / 150), yaw: .2, pitch: .1 }), '0 0 96 150'));
override('spriteSVG', c => svgImg(bakeVB('card-' + c.id, '0 0 100 100', () => cardCreature(c), { pad: 1.15, yaw: .25, pitch: .12 }), '0 0 100 100'));
override('queenSVG', () => svgImg(bakeVB('queen', '0 0 130 170', queenModel, { pad: 1.05, yaw: .2, pitch: .08 }), '0 0 130 170'));
override('fairySVG', (f, opts = {}) => {
  const look = JSON.stringify({ wing: (f && f.wing) || 'blue', hair: (f && f.hair) || 'bun', sit: !!opts.sit, sleep: !!opts.sleep });
  const url = bakeVB('fairy' + look, '0 0 120 140', () => { const o = K.fairy({ ...fairyOpts(f), sit: !!opts.sit, wand: !opts.noStaff }); if (opts.sleep) { o.userData.head.rotation.z = .5; } return o; }, { pad: 1.05, yaw: .3, pitch: .08 });
  return svgImg(url, '0 0 120 140', 't3d', ` data-look='${look.replace(/'/g, '')}'`);
});
if (D.decorModel) override('decorSVG', d => svgImg(bakeVB('decor-' + d.shape + d.c1 + d.c2 + (d.name || ''), '0 0 100 100', () => D.decorModel(d), D.decorView ? D.decorView(d) : { frame: [0, .5, 1.04] }), '0 0 100 100'));
if (D.teapotModel) override('teapotSVG', () => svgImg(baker.bake('teapot', D.teapotModel, D.teapotView ? D.teapotView(1160, 800) : { w: 1160, h: 800, frame: [0, .5, .76], yaw: 0, pitch: 0 }), '0 0 1450 1000', '', ' preserveAspectRatio="none"'));
if (D.basketModel) override('basketSVG', () => svgImg(bakeVB('basket', '0 0 132 118', D.basketModel, { pad: 1.05, yaw: .2, pitch: .25 }), '0 0 132 118'));
if (D.moonDoorModel) override('moonDoorSVG', () => svgImg(bakeVB('moondoor', '0 0 92 92', D.moonDoorModel, { pad: 1.05, yaw: .15, pitch: .05 }), '0 0 92 92'));
if (D.greatMoonModel) override('gmoonSVG', () => svgImg(bakeVB('gmoon', '0 0 96 96', D.greatMoonModel, { pad: 1.02, yaw: .1, pitch: .05 }), '0 0 96 96'));
if (D.gladeModel) override('gladeIcon', g => svgImg(bakeVB('glade-' + g, '0 0 80 80', () => D.gladeModel(g), { pad: 1.08, yaw: .3, pitch: .55 }), '0 0 80 80'));
// hair choices on the meet screen show a 3D head with that hairstyle
if (typeof G.renderMeet === 'function') {
  const orig = G.renderMeet;
  G.renderMeet = function () {
    orig();
    document.querySelectorAll('#meet .hairbtn').forEach(b => {
      const h = b.dataset.h;
      const url = baker.bake('hair-' + h, () => { const f = K.fairy({ hair: h, wand: false }); return f.userData.head.clone(true); }, { w: 160, h: 160, pad: 1.1, yaw: .35, pitch: .1 });
      b.innerHTML = `<svg viewBox="0 0 80 80" aria-hidden="true"><image href="${url}" width="80" height="80"/></svg>`;
    });
  };
}
// redraw what is already on screen with the new models
try { if (screen() === 'title' && typeof G.showTitle === 'function') { /* moon is live; nothing to redraw */ } } catch (e) {}

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, lastScreen = '', shadowDirty = true;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rdt); last = now;
  T += dt * (REDUCED() ? .3 : 1);
  // adaptive resolution keeps it smooth on older iPads
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < Math.min(devicePixelRatio || 1, 1.75) - .05) { dpr = Math.min(dpr + .15, Math.min(devicePixelRatio || 1, 1.75)); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();

  const scr = screen(), world = !!WORLD_SCREENS[scr];
  canvas.style.visibility = world ? 'visible' : 'hidden';
  if (!world) return;
  if (scr !== lastScreen) { lastScreen = scr; shadowDirty = true; }

  // world state for this screen
  const N = typeof S !== 'undefined' && S && S.night;
  const gname = scr === 'night' && N ? N.glade : scr === 'map' ? null : null;
  for (const k in glades) glades[k].visible = k === gname;
  const litN = scr === 'end' ? 8 : scr === 'night' && N ? Math.min(8, N.index || 0) : scr === 'map' || scr === 'cottage' ? 8 : 0;
  festival.forEach((f, i) => { const on = i < litN ? 1 : 0; f.on += (on - f.on) * Math.min(1, dt * 3); f.lightM.emissiveIntensity = f.on * 1.6; f.lightM.color.set(f.on > .5 ? '#ffe9b0' : '#c9a46a'); f.halo.material.opacity = f.on * .85 * (.85 + .15 * Math.sin(T * 2 + i)); });
  bg.userData.skyMat.uniforms.warm.value += ((scr === 'end' ? 1 : scr === 'night' && N ? (N.index || 0) / 10 : 0) - bg.userData.skyMat.uniforms.warm.value) * Math.min(1, dt * 2);
  moonObj.visible = scr !== 'title';
  skyLan.visible = scr === 'end';
  if (skyLan.visible) skyLan.children.forEach(l => { const u = l.userData, k = (T * u.sp + u.ph) % 1; l.position.set(u.x + Math.sin(T * .3 + u.sw) * .6, -1 + k * 26, u.z); });
  bg.userData.stars.uniforms.t.value = T; bg.userData.stars.uniforms.px.value = dpr;
  if (glades['Whispering River'].visible) glades['Whispering River'].userData.water.uniforms.t.value = T;
  if (glades['Starlight Meadow'].visible) glades['Starlight Meadow'].children.forEach(c => { if (c.isSprite) c.material.opacity = .5 + .5 * Math.sin(T * 2 + c.userData.tw); });
  for (let i = 0; i < motes.n; i++) { const h = motes.home[i], k = T * .35 + motes.ph[i]; motes.pos[i * 3] = h[0] + Math.sin(k) * 1.4; motes.pos[i * 3 + 1] = h[1] + Math.sin(k * 1.3) * .5; motes.pos[i * 3 + 2] = h[2] + Math.cos(k * .8); }
  motes.g.attributes.position.needsUpdate = true; motes.m.uniforms.t.value = T; motes.m.uniforms.px.value = dpr;

  // camera
  const v = VIEWS[scr] || VIEWS.night; const k = 1 - Math.exp(-rdt * 2.2);
  parX += (tgtParX - parX) * Math.min(1, dt * 1.5);
  camPos.lerp(new THREE.Vector3(v.pos[0] + parX * .8 + Math.sin(T * .07) * .3, v.pos[1], v.pos[2]), k);
  camAt.lerp(new THREE.Vector3(...v.at), k);
  bgCam.position.copy(camPos); bgCam.lookAt(camAt);

  syncAnchors();
  for (const rec of live.values()) if (rec.obj.parent) K.animate(rec.obj, T);

  if (shadowDirty) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
  R.clear();
  R.render(bg, bgCam);
  stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles;
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
}
const stats = {};
requestAnimationFrame(frame);
G.__fl3d = { R, bg, fg, live, baker, stats, get dpr() { return dpr; } };
