// Acorn Bakery in 3D.
// The game itself (rules, touch, saves, voice, cards) is unchanged and still lives in index.html's DOM.
// This module draws a felt-toy world behind it and swaps the drawings for 3D models:
//  - live models follow their DOM element every frame: the baker mouse (title, setup, shop, day end, house),
//    each bakery customer, and the whole mouse-house room
//  - still things (treats, acorns, the acorn jar, house treasures, friend-card portraits) are rendered once to images
//    and dropped in where the emoji and SVG drawings were, so every layout rule and animation keeps working.
// If WebGL or this module fails, the game keeps its 2D look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
import * as MD from './models3d.js';

const G = window;

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.autoClear = false;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
R.setClearColor('#e9d6b5', 1);
document.body.insertBefore(canvas, document.body.firstChild);
document.body.classList.add('g3d');
const baker = new K.Baker(256);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const screen = () => { const s = document.querySelector('.screen.on'); return s ? s.id : ''; };
const save = () => (typeof S !== 'undefined' && S) || {};

/* ------------------------------------------------------------------ background worlds (meters) */
const bg = new THREE.Scene();
const bgCam = new THREE.PerspectiveCamera(42, 1, .1, 260);
const SKIES = {
  day: { a: '#86c2e6', b: '#cfe8f2', c: '#fbf0dc', sun: [26, 34, -90], sunC: '#fff2c0', sunS: 26 },
  dusk: { a: '#5b5c9c', b: '#f2a27a', c: '#ffd9a0', sun: [-34, 7, -95], sunC: '#ffb060', sunS: 40 }
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, c: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 a,b,c; varying vec3 v; void main(){ float h=v.y; vec3 col = h>0.1? mix(b,a,smoothstep(.1,.6,h)) : mix(c,b,smoothstep(-.05,.1,h)); gl_FragColor=vec4(col,1.); }'
});
bg.add(new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat));
const sun = new THREE.Group(); sun.add(K.ball(new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }), [0, 0, 0], 3)); const sunGlow = K.glow('#ffe7a0', 26, .8); sun.add(sunGlow); bg.add(sun);
const bgL = K.toyLights(bg, { sky: '#fff0dc', ground: '#8a6a4f', hemiI: 1.2, key: '#fff1dc', keyI: 1.8, fill: '#ffd9b0', fillI: .6, dir: [6, 14, 10] });
bgL.key.castShadow = true; bgL.key.shadow.mapSize.set(1024, 1024); bgL.key.shadow.bias = -.0015; bgL.key.shadow.normalBias = .02;
Object.assign(bgL.key.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
bg.add(bgL.key.target);
const LIGHTS = {
  int: { sky: '#fff0dc', ground: '#9a7656', hemiI: 1.25, key: '#ffe9cc', keyI: 1.7, dir: [5, 12, 12], fill: '#ffd9b0', fillI: .55, exp: 1.05 },
  day: { sky: '#d8ecff', ground: '#6f8a50', hemiI: 1.15, key: '#fff3d8', keyI: 2.4, dir: [-9, 15, 11], fill: '#ffe2c0', fillI: .5, exp: 1.05 },
  dusk: { sky: '#ffc4a8', ground: '#4e3e58', hemiI: 1.0, key: '#ffb47a', keyI: 1.9, dir: [-16, 7, 9], fill: '#b8a8ff', fillI: .45, exp: 1.1 }
};
let interior = null, exterior = null;
try { interior = MD.bakeryInterior(); interior.visible = false; bg.add(interior); } catch (e) { console.warn('[3d] interior', e); }
try { exterior = MD.bakeryExterior(); exterior.visible = false; bg.add(exterior); } catch (e) { console.warn('[3d] exterior', e); }

/* fireflies for the evening */
const motes = (function () {
  const n = 40, pos = new Float32Array(n * 3), home = [], ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { home.push([(Math.random() - .5) * 26, .5 + Math.random() * 4, -4 + Math.random() * 14]); ph[i] = Math.random() * 20; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, px: { value: 1 }, map: { value: K.glowTexture() } },
    vertexShader: 'attribute float ph; uniform float t,px; varying float a; void main(){ a = max(0., sin(t*1.1+ph*3.)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 260.*px/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float a; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(1.,.9,.45)*c.a*a, c.a*a); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; bg.add(pts);
  return { pos, home, ph, g, m, n, pts };
})();

/* camera framing per screen (landscape iPad first; portrait widens the view) */
const VIEWS = {
  title: { set: 'ext', sky: 'day', pos: [0, 3.6, 19], at: [0, 3.9, 0] },
  dayend: { set: 'ext', sky: 'dusk', pos: [-2.5, 3.2, 17], at: [0, 4.2, 0] },
  setup: { set: 'int', sky: 'day', pos: [4.5, 3.4, 6.5], at: [7.5, 3.2, -5] },
  album: { set: 'int', sky: 'day', pos: [-3, 3.6, 8.5], at: [-2.5, 3.8, -5] },
  shop: { set: 'int', sky: 'day', shop: true },
  home: { set: null },
};
const camPos = new THREE.Vector3(), camAt = new THREE.Vector3();
let parX = 0, tgtParX = 0;
addEventListener('pointermove', e => { tgtParX = (e.clientX / innerWidth - .5); }, { passive: true });

/* ------------------------------------------------------------------ foreground: 3D models pinned to DOM elements (CSS pixels) */
const fg = new THREE.Scene();
K.toyLights(fg, { sky: '#fff0dc', ground: '#8a6a4f', hemiI: 1.3, key: '#fff3e0', keyI: 2.0, fill: '#ffd9b0', fillI: .7, dir: [-.45, .75, .8] });
const pcam = new THREE.PerspectiveCamera(20, 1, 10, 30000);
let W = 0, H = 0;
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false);
  bgCam.aspect = W / H;
  pcam.aspect = W / H; pcam.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(pcam.fov / 2))); pcam.lookAt(0, 0, 0); pcam.updateProjectionMatrix();
  lastScreen = '';
}
let dpr = Math.min(devicePixelRatio || 1, 1.75);
let lastScreen = '';
R.setPixelRatio(dpr); sizeAll();
addEventListener('resize', sizeAll);

const live = new Map();            // element -> { obj, key }
const seen = new Set();
function px(r) { return [r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2)]; }
function setFade(obj, a) {
  a = Math.round(a * 20) / 20;
  if (obj.userData.fade === a) return; obj.userData.fade = a;
  obj.visible = a > .02;
  obj.traverse(o => {
    if (o.isSprite) { o.material.opacity = (o.userData.glowBase ?? 1) * a; return; }
    if (!o.isMesh) return;
    if (!o.userData.orig) o.userData.orig = o.material;
    if (a >= .999) { o.material = o.userData.orig; return; }
    if (!o.userData.faded) { o.userData.faded = o.userData.orig.clone(); o.userData.faded.transparent = true; o.userData.faded.depthWrite = false; }
    o.userData.faded.opacity = a * (o.userData.orig.opacity ?? 1); o.material = o.userData.faded;
  });
}

/* --- the baker mouse --- */
const mouseTpl = new Map();
function mouseFor(look) {
  if (!mouseTpl.has(look)) { const [fur, apron] = look.split('|'); mouseTpl.set(look, MD.mouse({ fur, apron })); }
  return K.instance(mouseTpl.get(look));
}
function mouseLook(el) {
  const s = el.querySelector('svg[data-look]');
  if (s) return s.getAttribute('data-look');
  const st = save(); return (st.fur || '#b08968') + '|' + (st.apron || '#d4677a') + '|1';
}
/* --- customers --- */
const critTpl = new Map();
function critterFor(emoji) {
  const k = MD.critterKind(emoji) || 'mouse';
  if (!critTpl.has(k)) critTpl.set(k, MD.critter(emoji));
  const c = K.instance(critTpl.get(k));
  c.userData.lastX = null; return c;
}

const KINDS = [
  { sel: '#titleMouse, #setupMouse, #pip, #deMouse, #roomPip', key: el => mouseLook(el).split('|').slice(0, 2).join('|'), make: (el, k) => mouseFor(k),
    place: (o, el, r) => {
      const s = r.height / 2.62, [x] = px(r), u = o.userData;
      o.position.set(x, H / 2 - r.bottom + s * .06, el.id === 'roomPip' ? 30 : 0); o.scale.setScalar(s);
      u.face = mouseLook(el).endsWith('|1');
      u.hop = el.classList.contains('happy');
      o.rotation.y = el.id === 'pip' ? -.4 : el.id === 'roomPip' ? .15 : Math.sin(T * .5) * .12;
    } },
  { sel: '#customer .who', key: el => el.textContent.trim(), make: (el, k) => critterFor(k),
    place: (o, el, r) => {
      const u = o.userData, c = el.parentElement;
      const s = r.height * 1.12 / u.h, [x] = px(r);
      o.position.set(x, H / 2 - r.bottom + (u.y0 || 0) * s + r.height * .02, 0); o.scale.setScalar(s);
      u.moving = u.lastX != null && Math.abs(x - u.lastX) > .8; u.lastX = x;
      o.rotation.y = .55;
      u.mood = c.classList.contains('happy') ? 'happy' : 'idle';
      setFade(o, parseFloat(getComputedStyle(c).opacity) || 0);
    } },
  { sel: '#room', key: () => 'room', make: () => MD.roomModel(),
    place: (o, el, r) => { const [x, y] = px(r); o.position.set(x, y, 0); o.scale.setScalar(r.width / 1000); } },
];
function syncAnchors(scr) {
  seen.clear();
  const root = document.getElementById(scr);
  if (root) for (const kind of KINDS) {
    for (const el of root.querySelectorAll(kind.sel)) {
      if (seen.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -50 || r.top > H + 50 || r.right < -200 || r.left > W + 200) continue;
      let rec = live.get(el); const key = kind.key(el);
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

/* --- animation for the live characters --- */
function animMouse(o, t) {
  const u = o.userData, k = t + u.t0;
  u.eyeO.visible = !u.face; u.eyeH.visible = !!u.face;
  if (!u.face) u.eyeO.scale.y = (k % 4.3) < .13 ? .12 : 1;
  u.body.position.y = Math.sin(k * 2) * .025 + (u.hop ? Math.abs(Math.sin(k * 8)) * .35 : 0);
  u.body.rotation.z = Math.sin(k * 1.3) * .035;
  u.head.rotation.z = Math.sin(k * .9) * .09; u.head.rotation.x = Math.sin(k * .7) * .04;
  const cheer = u.hop || (u.face && u.wave);
  u.armR.rotation.z = cheer ? 2.3 + Math.sin(k * 10) * .3 : Math.sin(k * 1.6) * .1 + .1;
  u.armL.rotation.z = cheer ? -2.3 - Math.sin(k * 10 + 1) * .3 : -Math.sin(k * 1.4) * .08 - .1;
}
function animCritter(o, t) {
  const u = o.userData, k = t + u.t0, happy = u.mood === 'happy';
  if (u.kind === 'fairy') { u.mood = happy ? 'happy' : 'idle'; K.animate(o, t); return; }
  if (u.kind === 'mouse') { u.hop = happy; u.face = happy; animMouse(o, t); return; }
  u.body.position.y = (u.hover ? .18 + Math.sin(k * 2.4) * .12 : Math.abs(Math.sin(k * 2)) * .03) + (happy ? Math.abs(Math.sin(k * 8)) * .3 : 0);
  u.body.rotation.z = u.moving ? Math.sin(k * 14) * .12 : Math.sin(k * 1.3) * .04;
  if (u.head) { u.head.rotation.z = Math.sin(k * .9) * .1; u.head.rotation.x = Math.sin(k * .7) * .05; }
  if (u.wl) {
    const f = Math.sin(k * (u.fast ? 38 : happy ? 18 : 7));
    if (u.flapAxis === 'z') { u.wl.rotation.z = .3 + f * .45; u.wr.rotation.z = -.3 - f * .45; }
    else { u.wl.rotation.y = -(.3 + f * .5); u.wr.rotation.y = .3 + f * .5; }
  }
}

/* ------------------------------------------------------------------ baked stills swapped in for the emoji and SVG drawings */
const urls = new Map();
function blobURL(dataURL) {
  try {
    const b = atob(dataURL.split(',')[1]), a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return URL.createObjectURL(new Blob([a], { type: 'image/png' }));
  } catch (e) { return dataURL; }
}
function bakeURL(key, build, view) {
  if (urls.has(key)) return urls.get(key);
  const u = blobURL(baker.bake(key, build, view)); urls.set(key, u); return u;
}
const imgTag = (url, cls = '') => `<img class="e3${cls ? ' ' + cls : ''}" src="${url}" alt="" draggable="false">`;
const goodURL = id => bakeURL('good-' + id, () => MD.goodModel(id), { w: 160, h: 160, pad: 1.06, yaw: .35, ...(MD.GOOD_VIEW[id] || {}) });
const decorURL = id => bakeURL('decor-' + id, () => MD.decorModel(id), { w: 200, h: 200, pad: 1.04, yaw: .35, pitch: .22, ...(MD.DECOR_VIEW[id] || {}) });
const critterURL = emoji => bakeURL('crit-' + (MD.critterKind(emoji) || 'mouse'), () => { const c = MD.critter(emoji); c.rotation.y = .35; if (c.userData.y0) c.position.y = c.userData.y0; return c; }, { w: 256, h: 256, pad: 1.08, yaw: 0, pitch: .12 });
const acornURL = () => bakeURL('acorn', MD.acornModel, { w: 120, h: 144, pad: 1.02, yaw: .25, pitch: .12 });
function svgImg(url, vb, extra = '') {
  const [x, y, w, h] = vb.split(' ').map(Number);
  return `<svg viewBox="${vb}" aria-hidden="true"${extra}><image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
const ov = {};
function override(name, fn) { if (typeof G[name] !== 'function') return; ov[name] = G[name]; G[name] = function (...a) { try { return fn(...a); } catch (e) { console.warn('[3d]', name, e); return ov[name](...a); } }; }

// the acorn coin: every <use href="#acornSym"> on the page now shows the 3D acorn
try { const sym = document.getElementById('acornSym'); if (sym) sym.innerHTML = `<image href="${acornURL()}" x="0" y="0" width="40" height="48" preserveAspectRatio="xMidYMid meet"/>`; } catch (e) { console.warn('[3d] acorn', e); }
// the mouse drawings carry their look so the live 3D mouse can match them
override('mouseSVG', (fur, apron, happy = false) => ov.mouseSVG(fur, apron, happy).replace('<svg ', `<svg data-look="${fur}|${apron}|${happy ? 1 : 0}" `));
override('jarSVG', () => svgImg(bakeURL('jar', MD.jarModel, { w: 240, h: 260, pad: 1.03, yaw: .2, pitch: .18 }), '0 0 120 130'));
override('cardHTML', (c, n, shiny) => ov.cardHTML(c, n, shiny).replace(/<span class="e">[^<]*<\/span>/, `<span class="e">${imgTag(critterURL(c.e), 'crit')}</span>`));
// the day-end list of new friends shows their 3D portraits
override('endDay', () => {
  ov.endDay();
  try { const t = document.getElementById('deText'), nf = (typeof day !== 'undefined' && day && day.newFriends) || []; const sp = t && t.querySelector('span[style]'); if (sp && nf.length) sp.innerHTML = nf.map(c => imgTag(critterURL(c.e), 'crit')).join(' '); } catch (e) {}
});
// treats and treasures: their picture is now a baked 3D image (made the first time it is needed)
function swapPictures(list, urlFor) {
  if (!Array.isArray(list)) return;
  for (const d of list) { if (!d || !d.id || d.e2d) continue; d.e2d = d.e; Object.defineProperty(d, 'e', { configurable: true, enumerable: true, get() { try { return imgTag(urlFor(d.id)); } catch (e) { return d.e2d; } } }); }
}
try { swapPictures(GOODS, goodURL); } catch (e) { console.warn('[3d] goods', e); }
try { swapPictures(DECOR, decorURL); } catch (e) { console.warn('[3d] decor', e); }
// redraw what is already on screen with the new pictures
try { if (screen() === 'title' && typeof G.goTitle === 'function') G.goTitle(); else if (screen() === 'setup' && typeof G.goSetup === 'function') G.goSetup(); } catch (e) {}
// bake the rest a little at a time so opening the album or house never stalls
(function warm() {
  const jobs = [];
  try { GOODS.forEach(g => jobs.push(() => goodURL(g.id))); } catch (e) {}
  jobs.push(() => bakeURL('jar', MD.jarModel, { w: 240, h: 260, pad: 1.03, yaw: .2, pitch: .18 }));
  try { ALL_FRIENDS.forEach(c => jobs.push(() => critterURL(c.e))); } catch (e) {}
  try { DECOR.forEach(d => jobs.push(() => decorURL(d.id))); } catch (e) {}
  const step = () => { const j = jobs.shift(); if (!j) return; try { j(); } catch (e) { console.warn('[3d] bake', e); } setTimeout(step, 60); };
  setTimeout(step, 700);
})();

/* ------------------------------------------------------------------ camera for each screen */
function applyLights(name) {
  const L = LIGHTS[name];
  bgL.hemi.color.set(L.sky); bgL.hemi.groundColor.set(L.ground); bgL.hemi.intensity = L.hemiI;
  bgL.key.color.set(L.key); bgL.key.intensity = L.keyI; bgL.key.position.set(...L.dir).normalize().multiplyScalar(40);
  bgL.fill.color.set(L.fill); bgL.fill.intensity = L.fillI;
  R.toneMappingExposure = L.exp;
}
function applySky(name) {
  const s = SKIES[name]; skyMat.uniforms.a.value.set(s.a); skyMat.uniforms.b.value.set(s.b); skyMat.uniforms.c.value.set(s.c);
  sun.position.set(...s.sun); sunGlow.material.color.set(s.sunC); sunGlow.scale.setScalar(s.sunS);
}
function enterView(scr, v) {
  if (interior) interior.visible = v.set === 'int';
  if (exterior) exterior.visible = v.set === 'ext';
  motes.pts.visible = scr === 'dayend';
  if (v.set) { applyLights(v.set === 'int' ? 'int' : v.sky); applySky(v.sky || 'day'); }
  bg.fog = v.set === 'ext' ? new THREE.Fog(v.sky === 'dusk' ? '#f0b892' : '#d6ebf2', 40, 120) : null;
  if (exterior) exterior.userData.windows.forEach(m => { m.emissiveIntensity = v.sky === 'dusk' ? 1.6 : .45; });
  if (exterior) exterior.userData.lantern.material.opacity = v.sky === 'dusk' ? .95 : .35;
  bgCam.clearViewOffset();
  if (!v.shop && v.pos) { camPos.set(...v.pos); camAt.set(...v.at); }
}
const shopCam = { pos: new THREE.Vector3(), at: new THREE.Vector3(), fov: 30, ok: false };
function frameShop() {
  const sc = document.getElementById('scene'); if (!sc) return false;
  const r = sc.getBoundingClientRect(); if (r.height < 20 || r.width < 20) return false;
  const Wt = 17.5, Ht = Wt * r.height / r.width, d = 10.5, planeZ = -.9;
  const y0 = 1.1 - (r.height * .16 + 6) / r.height * Ht, cy = y0 + Ht / 2;
  shopCam.pos.set(0, cy, planeZ + d); shopCam.at.set(0, cy, planeZ);
  shopCam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Ht / 2 / d * H / r.height));
  bgCam.setViewOffset(W, H, W / 2 - (r.left + r.width / 2), H / 2 - (r.top + r.height / 2), W, H);
  return true;
}

/* ------------------------------------------------------------------ loop */
let T = 0, last = performance.now(), slow = 0, fast = 0, shadowDirty = true;
const stats = {};
function frame(now) {
  requestAnimationFrame(frame);
  if (document.visibilityState === 'hidden') { last = now; return; }
  const rdt = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, rdt); last = now;
  T += dt * (REDUCED ? .3 : 1);
  // adaptive resolution keeps it smooth on older iPads
  if (rdt > .026) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
  const maxDpr = Math.min(devicePixelRatio || 1, 1.75);
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; }
  if (fast > 400 && dpr < maxDpr - .05) { dpr = Math.min(dpr + .15, maxDpr); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (W !== innerWidth || H !== innerHeight) sizeAll();

  const scr = screen(), v = VIEWS[scr];
  canvas.style.visibility = v ? 'visible' : 'hidden';
  if (!v) { stats.bg = stats.fg = 0; return; }
  if (scr !== lastScreen) { lastScreen = scr; enterView(scr, v); shadowDirty = true; }

  // background world
  let drawBg = !!v.set;
  if (v.shop) {
    drawBg = frameShop();
    if (drawBg) { bgCam.position.copy(shopCam.pos); bgCam.lookAt(shopCam.at); bgCam.fov = shopCam.fov; bgCam.updateProjectionMatrix(); }
  } else if (v.set) {
    parX += (tgtParX - parX) * Math.min(1, dt * 1.5);
    bgCam.position.set(camPos.x + parX * .8 + Math.sin(T * .07) * .25, camPos.y + Math.sin(T * .09) * .08, camPos.z);
    bgCam.lookAt(camAt);
    const fovH = 62; bgCam.fov = Math.min(72, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovH / 2)) / bgCam.aspect)));
    bgCam.updateProjectionMatrix();
  }
  if (exterior && exterior.visible) {
    exterior.userData.smoke.children.forEach((s, i) => { const k = (T * .1 + i / 4) % 1; s.position.set(Math.sin(T * .5 + i) * .2 + k * .7, k * 2.4, 0); s.scale.setScalar(.3 * (.4 + k * .9) * Math.min(1, (1 - k) * 4)); });
  }
  if (motes.pts.visible) {
    for (let i = 0; i < motes.n; i++) { const h = motes.home[i], k = T * .35 + motes.ph[i]; motes.pos[i * 3] = h[0] + Math.sin(k) * 1.2; motes.pos[i * 3 + 1] = h[1] + Math.sin(k * 1.3) * .5; motes.pos[i * 3 + 2] = h[2] + Math.cos(k * .8); }
    motes.g.attributes.position.needsUpdate = true; motes.m.uniforms.t.value = T; motes.m.uniforms.px.value = dpr;
  }
  if (interior && interior.visible) interior.userData.lamps.forEach((l, i) => { l.material.opacity = .5 + Math.sin(T * 1.7 + i * 2) * .04; });

  // foreground characters
  syncAnchors(scr);
  for (const rec of live.values()) {
    if (!rec.obj.parent) continue;
    const u = rec.obj.userData;
    if (u.kind === 'mouse' && rec.obj.userData.eyeO && !u.species) animMouse(rec.obj, T);
    else if (u.kind === 'room') { if (u.fire) { u.fire.scale.set(1 + Math.sin(T * 7) * .05, 1 + Math.sin(T * 9.3) * .1 + Math.sin(T * 5.1) * .05, 1); } }
    else animCritter(rec.obj, T);
  }

  if (shadowDirty) { R.shadowMap.needsUpdate = true; shadowDirty = false; }
  R.setClearColor(scr === 'home' ? '#5d4129' : '#e9d6b5', 1);
  R.clear();
  stats.bg = 0;
  if (drawBg) { R.render(bg, bgCam); stats.bg = R.info.render.calls; stats.bgTris = R.info.render.triangles; }
  R.clearDepth();
  R.render(fg, pcam);
  stats.fg = R.info.render.calls; stats.fgTris = R.info.render.triangles;
  stats.total = stats.bg + stats.fg; stats.screen = scr; stats.dpr = dpr;
}
requestAnimationFrame(frame);
G.__ms3d = { R, bg, fg, live, baker, stats, urls, get dpr() { return dpr; } };
