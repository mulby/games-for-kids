// The Toadstool Shop in 3D, in the shared felt-toy style (shared/toy3d.js).
// The game (rules, touch, saves, voice, cards) lives in index.html's DOM. It describes what should be on screen in
// window.TSV (scene, stock, who is standing where, decorations, where the free space above the panel is), and this
// module draws that every frame. It also bakes still pictures of the goods, coins and characters for the panels.
// If WebGL or this module fails, the game keeps its plain look. Add ?g3d=0 to the URL to turn it off.
import * as THREE from 'three';
import * as K from '../../shared/toy3d.js';
const { mat, mesh, ball, bead, capsule, lathe, tube, slab, roundRectShape, glow, freeze, lighten } = K;

const G = window;
const V = () => G.TSV || {};

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas'); canvas.id = 'gl3d';
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.setClearColor('#bfe3ff', 1);
document.body.insertBefore(canvas, document.body.firstChild);
const baker = new K.Baker(256);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(36, 1, .1, 260);

/* ------------------------------------------------------------------ sky (colour follows the time of day) */
const SKIES = {
  morning: ['#7fc0f5', '#d9efff', '#fff0d2'],
  day: ['#6db3f2', '#c9e8ff', '#f4f9ff'],
  evening: ['#3d3a8c', '#c77fb2', '#ffc08a'],
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, c: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 a,b,c; varying vec3 v; void main(){ float h=v.y; vec3 col = h>0.1? mix(b,a,smoothstep(.1,.7,h)) : mix(c,b,smoothstep(-.05,.1,h)); gl_FragColor=vec4(col,1.); }'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat);
scene.add(sky);
let skyKey = '';
function setSky(k) {
  if (k === skyKey) return; skyKey = k;
  const s = SKIES[k] || SKIES.day;
  skyMat.uniforms.a.value.set(s[0]); skyMat.uniforms.b.value.set(s[1]); skyMat.uniforms.c.value.set(s[2]);
  scene.fog.color.set(s[1]);
  const eve = k === 'evening';
  L.key.color.set(eve ? '#ffc79a' : '#fff1dc'); L.key.intensity = eve ? 1.6 : 2.2;
  L.hemi.color.set(eve ? '#c9a6e8' : '#cfe4ff'); L.hemi.intensity = eve ? 1.05 : 1.3;
  lanternGlow.forEach(g => (g.material.opacity = eve ? .95 : .35));
  windowGlowMat.emissiveIntensity = eve ? 1.4 : .35;
}
scene.fog = new THREE.Fog('#d9efff', 30, 90);
const L = K.toyLights(scene, { sky: '#cfe4ff', ground: '#4d6b3c', key: '#fff1dc', keyI: 2.2, dir: [-4, 8, 6] });

/* ------------------------------------------------------------------ blob shadows (cheaper than shadow maps on an iPad) */
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(40,30,20,.55)'); g.addColorStop(1, 'rgba(40,30,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function blob(r) {
  const m = new THREE.Mesh(K.geo('blob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.scale.set(r * 2, 1, r * 1.6); m.position.y = .02; m.renderOrder = 1; return m;
}

/* ------------------------------------------------------------------ characters */
const INK = '#2e2650';
function face(head, { y = .02, x = .36, z = 1.4, scale = .6, zoff = -.33 } = {}) {
  const f = new THREE.Group(); f.position.z = zoff; f.scale.setScalar(scale); head.add(f);
  K.eyes(f, { y, x, z, r: .15 });
  K.cheeks(f, { y: y - .22, x: x + .26, z: z - .08 });
  return f;
}
function whiskers(head, z, y) {
  const w = mat('#cbbfc4', { felt: true });
  for (const sx of [-1, 1]) for (const dy of [-.03, .04]) head.add(tube([[sx * .14, y + dy, z], [sx * .32, y + dy * 1.6 + .01, z - .04], [sx * .46, y + dy * 2.2, z - .1]], .007, w, 5, 3));
}
// A chibi felt animal about the fairy's size: feet at y=0, head near y=2.
export function critter(spec = {}) {
  const { species = 'mouse', fur = '#b9ada3', dress = null, dress2 = '#fff3e6', acc = [], apron = false } = spec;
  const accs = Array.isArray(acc) ? acc : [acc];
  const root = new THREE.Group();
  const body = new THREE.Group(); body.userData.live = true; body.name = 'body'; root.add(body);
  const F = mat(fur, { felt: true }), F2 = mat(spec.belly || lighten(fur, .14), { felt: true }), pink = mat('#f4a3b4', { felt: true });
  const owl = species === 'owl', hog = species === 'hedgehog';
  const neckY = owl ? 1.15 : 1.3, headY = owl ? 1.75 : 1.95;
  // body: a felt dress, or a round furry tummy
  if (dress) {
    const dm = mat(dress, { felt: true }), d2 = mat(dress2, { felt: true });
    body.add(lathe([[0, 1.32], [.3, 1.28], [.4, 1.05], [.58, .6], [.74, .28], [.76, .2], [0, .18]], dm, 36));
    body.add(mesh(K.geo('ts-hem', () => new THREE.TorusGeometry(.74, .05, 6, 36)), d2, [0, .24, 0], 1, [Math.PI / 2, 0, 0]));
    body.add(ball(d2, [0, 1.3, .05], [.33, .1, .28]));
    if (apron) { body.add(lathe([[0, 1.0], [.42, .98], [.6, .5], [.66, .3], [0, .3]], mat('#fffaf0', { felt: true }), 24).translateZ(.12)); }
  } else {
    body.add(ball(F, [0, owl ? .78 : .72, 0], owl ? [.78, .85, .7] : [.62, .68, .55]));
    body.add(ball(F2, [0, owl ? .72 : .66, owl ? .3 : .28], owl ? [.55, .62, .45] : [.42, .48, .32]));
    if (apron) body.add(lathe([[0, 1.0], [.4, .98], [.55, .5], [.6, .3], [0, .3]], mat('#fffaf0', { felt: true }), 24).translateZ(.18));
  }
  // feet
  const foot = owl ? mat('#e8a24a', { felt: true }) : species === 'mouse' ? pink : F;
  for (const sx of [-1, 1]) body.add(ball(foot, [sx * .22, .1, .12], [.17, .1, .24]));
  // tail
  if (species === 'mouse') body.add(tube([[0, .4, -.45], [.1, .25, -.9], [.45, .2, -1.15], [.7, .45, -1.1], [.75, .7, -.95]], .035, pink, 24, 6));
  if (species === 'cat') body.add(tube([[0, .35, -.45], [.2, .3, -.85], [.45, .7, -.9], [.5, 1.1, -.75]], .08, F, 20, 8));
  if (species === 'rabbit') body.add(ball(mat('#fffaf4', { felt: true }), [0, .45, -.55], .2));
  if (hog) {
    const sp = mat(spec.spikes || '#6b4a33', { felt: true });
    const cone = K.geo('ts-spike', () => new THREE.ConeGeometry(.09, .32, 5));
    for (let i = 0; i < 70; i++) {
      const u = i / 70, a = (i * 2.4) % (Math.PI * 2), y = .35 + u * 1.9;
      const ang = Math.PI * (.55 + Math.sin(a) * .42), rr = y > 1.5 ? .55 - (y - 1.5) * .35 : .62;
      const p = new THREE.Vector3(Math.cos(ang) * rr, y, -Math.abs(Math.sin(ang)) * rr - .05);
      if (p.z > -.1) continue;
      const m = new THREE.Mesh(cone, sp); m.position.copy(p);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.x * .8, .5, p.z - .3).normalize());
      body.add(m);
    }
  }
  // arms
  const armM = owl ? mat(lighten(fur, -.06), { felt: true }) : F;
  const armL = new THREE.Group(); armL.position.set(-.34, neckY - .02, .02); armL.userData.live = true; armL.name = 'armL';
  const armR = new THREE.Group(); armR.position.set(.34, neckY - .02, .02); armR.userData.live = true; armR.name = 'armR';
  if (owl) { armL.add(ball(armM, [-.42, -.35, 0], [.18, .5, .32], [0, 0, -.2])); armR.add(ball(armM, [.42, -.35, 0], [.18, .5, .32], [0, 0, .2])); armL.position.y = armR.position.y = 1.2; }
  else {
    armL.add(capsule(F, [0, 0, 0], [-.2, -.42, .12], .085)); armL.add(ball(F2, [-.22, -.5, .14], .1));
    armR.add(capsule(F, [0, 0, 0], [.2, -.42, .12], .085)); armR.add(ball(F2, [.22, -.5, .14], .1));
  }
  body.add(armL, armR);
  // head
  const head = new THREE.Group(); head.position.set(0, headY, 0); head.userData.live = true; head.name = 'head'; body.add(head);
  if (species === 'mouse') {
    head.add(ball(F, [0, 0, 0], [.55, .5, .52]));
    head.add(ball(F2, [0, -.12, .36], [.3, .22, .26]));
    head.add(bead(pink, [0, -.06, .62], [.09, .07, .07]));
    for (const sx of [-1, 1]) {
      head.add(ball(F, [sx * .46, .46, -.08], [.36, .36, .09], [0, sx * -.25, 0]));
      head.add(ball(pink, [sx * .46, .45, -.02], [.25, .25, .05], [0, sx * -.25, 0]));
    }
    face(head, { y: .1, x: .34, z: 1.3 });
    whiskers(head, .5, -.12);
  } else if (species === 'rabbit') {
    head.add(ball(F, [0, 0, 0], [.58, .52, .52]));
    head.add(ball(F2, [0, -.15, .38], [.3, .2, .22]));
    head.add(bead(pink, [0, -.08, .58], [.08, .06, .06]));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(sx * .22, .4, -.05); ear.rotation.z = sx * -.18 + (spec.flop && sx > 0 ? -.9 : 0);
      ear.add(ball(F, [0, .55, 0], [.17, .6, .1])); ear.add(ball(pink, [0, .55, .06], [.1, .48, .05])); head.add(ear);
    }
    face(head, { y: .08, x: .35, z: 1.3 });
    whiskers(head, .48, -.15);
  } else if (hog) {
    head.add(ball(mat(spec.spikes || '#6b4a33', { felt: true }), [0, .06, -.1], [.56, .52, .5]));
    head.add(ball(F, [0, -.02, .08], [.5, .46, .46]));
    head.add(ball(F, [0, -.14, .42], [.22, .18, .32]));
    head.add(bead(mat(INK, { gloss: true }), [0, -.12, .74], .07));
    for (const sx of [-1, 1]) head.add(ball(F, [sx * .34, .34, .1], [.12, .1, .06]));
    face(head, { y: .12, x: .32, z: 1.3 });
  } else if (species === 'cat') {
    head.add(ball(F, [0, 0, 0], [.58, .5, .5]));
    head.add(ball(F2, [0, -.15, .36], [.26, .18, .2]));
    head.add(bead(pink, [0, -.06, .52], [.07, .05, .05]));
    const ec = K.geo('ts-catear', () => new THREE.ConeGeometry(.2, .36, 4));
    for (const sx of [-1, 1]) { head.add(mesh(ec, F, [sx * .32, .46, 0], [1, 1, .55], [0, 0, sx * -.3])); head.add(mesh(ec, pink, [sx * .31, .44, .07], [.6, .7, .3], [0, 0, sx * -.3])); }
    face(head, { y: .08, x: .36, z: 1.3 });
    whiskers(head, .45, -.12);
  } else if (owl) {
    head.add(ball(F, [0, 0, 0], [.66, .55, .55]));
    const disc = mat(F2.color.getStyle(), { felt: true });
    for (const sx of [-1, 1]) {
      head.add(ball(disc, [sx * .25, .02, .4], [.24, .24, .1]));
      head.add(ball(mat('#ffe9a8', { felt: true }), [sx * .25, .02, .46], [.15, .15, .05]));
      head.add(ball(mat(INK, { gloss: true }), [sx * .25, .02, .5], [.08, .1, .04]));
      head.add(bead(mat('#fff8e0', { glow: .8 }), [sx * .25 + .03, .06, .54], .025));
      head.add(mesh(K.geo('ts-tuft', () => new THREE.ConeGeometry(.12, .3, 5)), F, [sx * .42, .5, 0], 1, [0, 0, sx * -.4]));
    }
    head.add(mesh(K.geo('ts-beak', () => new THREE.ConeGeometry(.08, .2, 6)), mat('#e8a24a', { gloss: true }), [0, -.14, .52], 1, [Math.PI * .6, 0, 0]));
  }
  // accessories
  for (const a of accs) {
    if (a === 'tricorn') {
      const h = mat('#2e2a3a', { felt: true });
      const hat = lathe([[0, .42], [.42, .3], [.72, .1], [.78, .02], [0, 0]], h, 3); hat.position.y = .38; hat.rotation.y = Math.PI / 6; head.add(hat);
      for (let i = 0; i < 3; i++) { const t = i / 3 * Math.PI * 2 + Math.PI / 6 + Math.PI / 3; head.add(bead(mat('#e9b949', { metal: true }), [Math.sin(t) * .36, .47, Math.cos(t) * .36], .05)); }
      head.add(ball(mat('#f2f0e6', { felt: true }), [0, .58, .3], .06));
    } else if (a === 'eyepatch') {
      head.add(ball(mat('#2e2a3a', { felt: true }), [.2, .1, .46], [.13, .13, .05]));
      head.add(mesh(new THREE.TorusGeometry(.53, .015, 4, 30), mat('#2e2a3a'), [0, .1, 0], 1, [.15, 0, -.35]));
    } else if (a === 'collar') {
      body.add(mesh(new THREE.TorusGeometry(.32, .07, 8, 28), mat('#e9b949', { metal: true }), [0, neckY - .02, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 7; i++) { const t = (i - 3) * .32; body.add(bead(mat(i % 2 ? '#3a7bd5' : '#e9b949', { gloss: true }), [Math.sin(t) * .38, neckY - .12, Math.cos(t) * .36], .06)); }
    } else if (a === 'bow') {
      for (const sx of [-1, 1]) head.add(ball(mat(spec.bowColor || '#f2a7b5', { felt: true }), [.3 + sx * .12, .42, .12], [.13, .09, .06], [0, 0, sx * .5]));
      head.add(bead(mat(lighten(spec.bowColor || '#f2a7b5', -.08), { felt: true }), [.3, .42, .15], .06));
    } else if (a === 'scarf') {
      body.add(mesh(new THREE.TorusGeometry(.3, .09, 8, 24), mat(spec.scarf || '#7bb4d9', { felt: true }), [0, neckY, 0], 1, [Math.PI / 2, 0, 0]));
      body.add(capsule(mat(spec.scarf || '#7bb4d9', { felt: true }), [.15, neckY - .05, .26], [.22, neckY - .45, .3], .07));
    } else if (a === 'glasses') {
      const gm = mat('#c9a04e', { metal: true });
      for (const sx of [-1, 1]) head.add(mesh(K.geo('ts-lens', () => new THREE.TorusGeometry(.12, .02, 6, 18)), gm, [sx * .2, .08, .52]));
    } else if (a === 'leaves') {
      for (let i = 0; i < 9; i++) { const t = (i - 4) * .3; head.add(ball(mat('#7cb36a', { felt: true }), [Math.sin(t) * .5, .42 + Math.cos(t) * .05, Math.cos(t) * .2 - .05], [.12, .05, .07], [0, t, .4])); }
    } else if (a === 'bonnet') {
      head.add(ball(mat(spec.bonnet || '#fff3e6', { felt: true }), [0, .2, -.12], [.62, .55, .55]));
      head.add(mesh(new THREE.TorusGeometry(.55, .06, 6, 30, Math.PI), mat('#f6c6d8', { felt: true }), [0, .1, .12], 1, [0, 0, 0]));
    } else if (a === 'sailor') {
      head.add(lathe([[0, .14], [.3, .14], [.34, 0], [0, 0]], mat('#ffffff', { felt: true }), 20).translateY(.45));
      head.add(mesh(new THREE.TorusGeometry(.32, .03, 6, 24), mat('#3a6ea5', { felt: true }), [0, .5, 0], 1, [Math.PI / 2, 0, 0]));
    } else if (a) {
      const x = K.accessory(a); x.position.set(0, .45, .05); x.scale.setScalar(.9); head.add(x);
    }
  }
  root.add(blob(.75));
  Object.assign(root.userData, { kind: 'critter', body, head, armL, armR, mood: 'idle', t0: Math.random() * 10 });
  freeze(root);
  return root;
}
function animCritter(o, t) {
  const u = o.userData, k = t + u.t0, m = u.mood;
  if (u.kind === 'fairy') { K.animate(o, t); return; }
  const walk = m === 'walk', happy = m === 'happy';
  u.body.position.y = walk ? Math.abs(Math.sin(k * 9)) * .12 : happy ? Math.abs(Math.sin(k * 7)) * .3 : Math.sin(k * 2) * .03;
  u.body.rotation.z = walk ? Math.sin(k * 9) * .06 : Math.sin(k * 1.3) * .025;
  u.head.rotation.z = m === 'think' ? .22 + Math.sin(k * 2) * .04 : Math.sin(k * .9) * .07;
  u.head.rotation.x = m === 'talk' ? Math.sin(k * 9) * .05 : Math.sin(k * .7) * .04;
  let l = -Math.sin(k * 1.4) * .08, r = Math.sin(k * 1.6) * .08;
  if (walk) { l = Math.sin(k * 9) * .4; r = -l; }
  if (happy) { l = -1.9 + Math.sin(k * 10) * .3; r = 1.9 - Math.sin(k * 10) * .3; }
  if (m === 'wave') r = 2.2 + Math.sin(k * 8) * .4;
  if (m === 'give') { r = .9; u.armR.rotation.x = -1.0; } else u.armR.rotation.x = 0;
  u.armL.rotation.z = l; u.armR.rotation.z = r;
}

/* ------------------------------------------------------------------ goods (about half a unit tall, base at y=0) */
const GOODS = {
  bun() {
    const g = new THREE.Group();
    g.add(ball(mat('#d99a55', { felt: true }), [0, .17, 0], [.3, .2, .3]));
    g.add(ball(mat('#a8672e', { felt: true }), [0, .3, 0], [.2, .08, .2]));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(bead(mat('#fff7e6', { felt: true }), [Math.cos(a) * .17, .3, Math.sin(a) * .17], .03)); }
    g.add(capsule(mat('#6b4a24'), [0, .36, 0], [.03, .44, 0], .025));
    return g;
  },
  apple() {
    const g = new THREE.Group();
    g.add(ball(mat('#e04a4a', { gloss: true }), [0, .24, 0], [.25, .24, .25]));
    g.add(capsule(mat('#6b4a24'), [0, .44, 0], [.03, .55, 0], .025));
    g.add(ball(mat('#7cc06e', { felt: true }), [.1, .52, 0], [.1, .04, .06], [0, 0, -.4]));
    return g;
  },
  tart() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [.28, 0], [.34, .05], [.36, .16], [.3, .17], [0, .12]], mat('#e8b878', { felt: true }), 18));
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = i ? .18 : 0; g.add(bead(mat(i % 3 ? '#6a3f8c' : '#d43d5f', { gloss: true }), [Math.cos(a) * r, .2, Math.sin(a) * r], .07)); }
    return g;
  },
  honey() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [.2, 0], [.25, .1], [.26, .32], [.2, .4], [.18, .44], [0, .44]], mat('#f0a92a', { gloss: true }), 18));
    g.add(lathe([[0, .5], [.27, .48], [.29, .42], [.18, .42], [0, .44]], mat('#e86a6a', { felt: true }), 14));
    g.add(mesh(K.geo('ts-string', () => new THREE.TorusGeometry(.19, .015, 4, 18)), mat('#fff3e0'), [0, .44, 0], 1, [Math.PI / 2, 0, 0]));
    return g;
  },
  biscuit() {
    const g = new THREE.Group();
    g.add(mesh(K.geo('ts-bisc', () => new THREE.CylinderGeometry(.24, .24, .07, 20)), mat('#d9a866', { felt: true }), [0, .1, 0], 1, [.25, 0, 0]));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(bead(mat('#8a5634', { felt: true }), [Math.cos(a) * .13, .14 + Math.sin(a) * .03, Math.sin(a) * .13 * .8 + .03], .025)); }
    return g;
  },
  candle() {
    const g = new THREE.Group();
    g.add(mesh(K.geo('ts-cnd', () => new THREE.CylinderGeometry(.09, .1, .42, 14)), mat('#fff3d6', { felt: true }), [0, .21, 0]));
    g.add(capsule(mat('#ffd56b', { glow: 1.6 }), [0, .46, 0], [0, .54, 0], .035));
    g.add(mesh(K.geo('ts-saucer', () => new THREE.CylinderGeometry(.18, .15, .04, 16)), mat('#b9a6e8', { gloss: true }), [0, .02, 0]));
    return g;
  },
  seeds() {
    const g = new THREE.Group();
    g.add(slab(roundRectShape(.34, .42, .04), .05, mat('#e9dcc4', { felt: true })).translateY(.24));
    g.children[0].rotation.x = -.2;
    const f = K.flower('#f6a6bd', .45); f.position.set(0, .2, .06); f.rotation.x = Math.PI / 2 - .2; g.add(f);
    return g;
  },
  teacup() { const g = K.accessory('teacup'); g.scale.setScalar(1.1); return g; },
};
const goodModel = id => { const g = (GOODS[id] || GOODS.bun)(); freeze(g); return g; };

/* ------------------------------------------------------------------ coins */
const COIN = { 1: ['#c87a45', .8], 5: ['#c9ccd6', .95], 10: ['#d6d9e3', .72], 25: ['#d3d6e0', 1.05] };
function coinModel(v) {
  const [c, r] = COIN[v] || COIN[1];
  const g = new THREE.Group();
  const m = mat(c, { metal: true, shine: .25 });
  g.add(mesh(new THREE.CylinderGeometry(r, r, .16, 40), m, [0, 0, 0], 1, [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.TorusGeometry(r * .92, .045, 8, 40), mat(lighten(c, .08), { metal: true, shine: .35 }), [0, 0, .08]));
  freeze(g); return g;
}

/* ------------------------------------------------------------------ the toadstool shop, outside */
const outside = new THREE.Group(); scene.add(outside);
const inside = new THREE.Group(); scene.add(inside);
const windowGlowMat = new THREE.MeshStandardMaterial({ color: '#ffe7a8', emissive: '#ffcf6b', emissiveIntensity: .35, roughness: .6 });
const lanternGlow = [];
(function buildOutside() {
  const grass = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), mat('#8cc46c', { felt: true }));
  outside.add(grass);
  const hills = new THREE.Group();
  [[-30, -40, 22, '#79b25e'], [10, -55, 30, '#6fa756'], [40, -35, 20, '#82bb63'], [-55, -20, 18, '#74ad5a']].forEach(([x, z, r, c]) => hills.add(ball(mat(c, { felt: true }), [x, -r * .55, z], [r, r * .8, r * .7])));
  freeze(hills); outside.add(hills);
  const path = [];
  for (let i = 0; i < 7; i++) path.push({ p: [Math.sin(i * .7) * .5, .02, 2.6 + i * 1.3], s: .7 + (i % 2) * .15, ry: i });
  outside.add(K.scatter(freeze(ball(mat('#d9cdb8', { felt: true }), [0, 0, 0], [.6, .08, .45])), path));
  // stem (the shop) and cap
  const house = new THREE.Group();
  house.add(lathe([[0, 0], [2.6, 0], [2.7, .3], [2.45, 1.8], [2.2, 3.4], [1.9, 4.4], [0, 4.4]], mat('#fff1dc', { felt: true }), 48));
  house.add(lathe([[0, 7.6], [1.6, 7.45], [3.2, 6.9], [4.3, 5.9], [4.85, 4.9], [4.6, 4.38], [0, 4.38]], mat('#e2566b', { gloss: true }), 48));
  const gills = new THREE.Mesh(new THREE.CircleGeometry(4.55, 48).rotateX(Math.PI / 2), mat('#f7d8c4', { glow: .35, glowColor: '#f2c4b0' })); gills.position.y = 4.35; house.add(gills);
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; house.add(mesh(K.geo('ts-gill', () => new THREE.BoxGeometry(2.4, .03, .05)), mat('#e9b9a6', { glow: .25, glowColor: '#e0a894' }), [Math.cos(a) * 3.3, 4.33, Math.sin(a) * 3.3], 1, [0, -a, 0])); }
  const spot = mat('#fff7e6', { felt: true });
  [[.0, 1.0, .5], [.9, .7, .45], [1.9, .75, .4], [2.9, .62, .5], [3.7, .4, .35], [4.6, .62, .45], [5.4, .78, .5], [.45, .3, .38], [2.4, .25, .32], [3.3, .9, .3], [5.0, .3, .32], [1.4, .45, .3]].forEach(([a, h, s]) => {
    const y = 4.6 + h * 2.6, rr = 4.7 - h * 3.0;
    const p = new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr);
    const b = bead(spot, [p.x, p.y, p.z], [s, s * .4, s]);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.x, rr * .55 + 1, p.z).normalize());
    house.add(b);
  });
  // door
  const door = slab(roundRectShape(1.5, 2.6, .7), .12, mat('#9a6a45', { felt: true }));
  door.position.set(0, 1.3, 2.62); door.rotation.x = -.04; house.add(door);
  house.add(bead(mat('#e9b949', { metal: true }), [.48, 1.25, 2.72], .09));
  house.add(mesh(new THREE.TorusGeometry(.78, .09, 8, 30, Math.PI), mat('#7a5236', { felt: true }), [0, 1.95, 2.62]));
  // round windows
  for (const [x, y, z, ry] of [[-1.75, 2.5, 1.75, -.78], [1.75, 2.5, 1.75, .78], [0, 3.55, 2.15, 0]]) {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = ry;
    w.add(mesh(new THREE.CircleGeometry(.45, 24), windowGlowMat, [0, 0, .05]));
    w.add(mesh(new THREE.TorusGeometry(.48, .08, 8, 28), mat('#7a5236', { felt: true }), [0, 0, .07]));
    w.add(mesh(new THREE.BoxGeometry(.06, .9, .04), mat('#7a5236', { felt: true }), [0, 0, .09]));
    w.add(mesh(new THREE.BoxGeometry(.9, .06, .04), mat('#7a5236', { felt: true }), [0, 0, .09]));
    house.add(w);
  }
  freeze(house); house.position.set(0, 0, -3); outside.add(house);
  outside.userData.house = house;
  // trees, flowers, little mushrooms
  const trees = [[-9, -8, 1.3], [-6.5, -12, 1.6], [8.5, -9, 1.4], [11, -14, 1.7], [-12, -3, 1.1], [13, -4, 1.2], [-4, -16, 1.5], [5, -17, 1.6]];
  trees.forEach(([x, z, s], i) => { const t = K.tree(s, i % 2 ? '#4f8a52' : '#3f7a4a'); t.position.set(x, 0, z); outside.add(t); });
  const fl = [];
  for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 9; fl.push({ p: [Math.cos(a) * r, 0, Math.sin(a) * r * .7], s: .8 + Math.random() * .6, ry: Math.random() * 6 }); }
  const cols = ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'];
  cols.forEach((c, i) => outside.add(K.scatter(K.flower(c, 1), fl.filter((_, j) => j % 4 === i))));
  const mush = K.mushroom('#e2566b', .7); [[-4.3, -.5], [4.6, -1.5], [-6, 2], [6.5, 1.5]].forEach(([x, z]) => { const m = mush.clone(); m.position.set(x, 0, z); outside.add(m); });
  outside.add(K.grassField(900, [-18, 18, -12, 8], '#6aa858'));
  // Bramble's cart
  const cart = new THREE.Group();
  const wood = mat('#b07a4a', { felt: true }), wood2 = mat('#8a5a36', { felt: true });
  cart.add(mesh(new THREE.BoxGeometry(2.2, .8, 1.3), wood, [0, 1.0, 0]));
  cart.add(mesh(new THREE.BoxGeometry(2.3, .12, 1.4), wood2, [0, 1.45, 0]));
  for (const sx of [-1, 1]) {
    const wheel = mesh(new THREE.TorusGeometry(.48, .09, 8, 24), wood2, [sx * .75, .5, .72]); cart.add(wheel);
    cart.add(mesh(new THREE.CylinderGeometry(.12, .12, .2, 10), wood2, [sx * .75, .5, .72], 1, [Math.PI / 2, 0, 0]));
  }
  cart.add(capsule(wood2, [-1.1, .9, .3], [-2.1, .55, .3], .05)); cart.add(capsule(wood2, [-1.1, .9, -.3], [-2.1, .55, -.3], .05));
  [[-.6, 0, '#e04a4a'], [0, .1, '#d99a55'], [.6, -.05, '#f0a92a']].forEach(([x, z, c]) => {
    cart.add(mesh(new THREE.BoxGeometry(.55, .4, .55), mat('#d9b98a', { felt: true }), [x, 1.7, z]));
    for (let i = 0; i < 4; i++) cart.add(bead(mat(c, { felt: true }), [x - .12 + (i % 2) * .24, 1.95, z - .12 + (i >> 1) * .24], .12));
  });
  // striped canopy
  for (let i = 0; i < 6; i++) cart.add(mesh(new THREE.BoxGeometry(.4, .08, 1.5), mat(i % 2 ? '#fff7e6' : '#7bb4d9', { felt: true }), [-1.0 + i * .4, 2.62 + Math.sin((i + .5) / 6 * Math.PI) * .22, 0]));
  for (let i = 0; i < 6; i++) cart.add(bead(mat(i % 2 ? '#fff7e6' : '#7bb4d9', { felt: true }), [-1.0 + i * .4, 2.55 + Math.sin((i + .5) / 6 * Math.PI) * .22, .76], [.2, .12, .05]));
  for (const sx of [-1, 1]) cart.add(capsule(wood2, [sx * 1.05, 1.5, .55], [sx * 1.05, 2.6, .55], .04));
  freeze(cart); cart.position.set(4.6, 0, .4); cart.rotation.y = -.35; outside.add(cart); outside.userData.cart = cart;
})();

/* ------------------------------------------------------------------ the shop, inside */
const SHELF = {}; // good id -> group of instanced meshes
const SLOT = { bun: [0, 0], apple: [0, 1], tart: [1, 0], honey: [1, 1], biscuit: [2, 0], candle: [2, 1], seeds: [1, 2], teacup: [2, 2] };
(function buildInside() {
  const room = new THREE.Group();
  room.add(mesh(new THREE.CylinderGeometry(9, 9, .3, 48), mat('#c99a6a', { felt: true }), [0, -.15, 0]));
  for (let i = -8; i <= 8; i += 1.1) room.add(mesh(new THREE.BoxGeometry(.03, .02, 18), mat('#a87a52'), [i, .01, 0]));
  // the stem's inside: a round cream wall, wainscot, beams, and the cap's pink gills for a ceiling
  room.add(mesh(new THREE.CylinderGeometry(8.5, 8.5, 7, 48, 1, true), mat('#fff1dc', { felt: true, side: THREE.BackSide }), [0, 3.5, 0]));
  room.add(mesh(new THREE.CylinderGeometry(8.45, 8.45, 1.2, 48, 1, true), mat('#e8c9a0', { felt: true, side: THREE.BackSide }), [0, .6, 0]));
  for (let i = 0; i < 9; i++) { const a = Math.PI * .5 + i * Math.PI / 8; room.add(mesh(new THREE.BoxGeometry(.35, 7, .3), mat('#a87a52', { felt: true }), [Math.sin(a) * 8.3, 3.5, Math.cos(a) * 8.3], 1, [0, a, 0])); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.5, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f7d8c4', { felt: true, side: THREE.BackSide }));
  dome.position.y = 7; dome.scale.y = .45; room.add(dome);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; room.add(tube([[Math.sin(a) * 8.4, 7.05, Math.cos(a) * 8.4], [Math.sin(a) * 6, 8.6, Math.cos(a) * 6], [Math.sin(a) * 2, 10.2, Math.cos(a) * 2]], .05, mat('#efc3b0', { felt: true }), 8, 4)); }
  // shelves: three boards, three goods per board
  const wood = mat('#a87a52', { felt: true });
  for (let r = 0; r < 3; r++) {
    room.add(mesh(new THREE.BoxGeometry(10.6, .16, 1.4), wood, [0, 1.55 + r * 1.3, -5.6]));
    room.add(mesh(new THREE.BoxGeometry(10.6, .26, .1), mat('#8a5a36', { felt: true }), [0, 1.45 + r * 1.3, -4.92]));
  }
  room.add(mesh(new THREE.BoxGeometry(10.6, 4.4, .12), mat('#e9d2b0', { felt: true }), [0, 2.6, -6.3]));
  for (const x of [-5.3, -1.75, 1.75, 5.3]) room.add(mesh(new THREE.BoxGeometry(.18, 4.4, 1.4), wood, [x, 2.6, -5.6]));
  room.add(mesh(new THREE.BoxGeometry(11, .25, 1.6), mat('#8a5a36', { felt: true }), [0, 4.85, -5.6]));
  // round window with curtains, and the door with the wood outside
  const w = new THREE.Group(); w.position.set(-6.9, 3.6, -3.4); w.rotation.y = 1.1;
  w.add(mesh(new THREE.CircleGeometry(1.1, 28), mat('#bfe3ff', { glow: .45, glowColor: '#dff2ff' })));
  w.add(mesh(new THREE.TorusGeometry(1.15, .14, 8, 30), mat('#7a5236', { felt: true }), [0, 0, .02]));
  w.add(mesh(new THREE.BoxGeometry(.1, 2.2, .06), mat('#7a5236'), [0, 0, .04])); w.add(mesh(new THREE.BoxGeometry(2.2, .1, .06), mat('#7a5236'), [0, 0, .04]));
  for (const sx of [-1, 1]) w.add(ball(mat('#f6a6bd', { felt: true }), [sx * 1.25, .1, .25], [.3, 1.1, .12]));
  room.add(w);
  const door = new THREE.Group(); door.position.set(7.3, 0, -1.6); door.rotation.y = -1.25;
  door.add(slab(roundRectShape(2.2, 3.8, 1.05), .1, mat('#bfe6c4', { glow: .35, glowColor: '#d8f4dc' })).translateY(1.9));
  door.add(mesh(new THREE.TorusGeometry(1.15, .14, 8, 30, Math.PI), mat('#7a5236', { felt: true }), [0, 2.85, .06]));
  for (const sx of [-1, 1]) door.add(mesh(new THREE.BoxGeometry(.2, 2.9, .2), mat('#7a5236', { felt: true }), [sx * 1.15, 1.45, .06]));
  room.add(door);
  // a low counter so the mouse shows above it, with the till and a basket
  const counter = new THREE.Group();
  counter.add(slab(roundRectShape(6.4, 1.0, .18), 1.4, mat('#b07a4a', { felt: true })).translateY(.5));
  counter.add(mesh(new THREE.BoxGeometry(6.8, .14, 1.8), mat('#8a5a36', { felt: true }), [0, 1.05, 0]));
  for (let i = 0; i < 6; i++) counter.add(mesh(new THREE.BoxGeometry(.07, .7, .05), mat('#8a5a36'), [-2.75 + i * 1.1, .5, .72]));
  const till = new THREE.Group(); till.position.set(-2.55, 1.12, -.1);
  till.add(mesh(new THREE.BoxGeometry(1.1, .6, .85), mat('#7bb4d9', { felt: true }), [0, .3, 0]));
  till.add(mesh(new THREE.BoxGeometry(.95, .34, .1), mat('#fff7e6', { felt: true }), [0, .78, -.28], 1, [-.3, 0, 0]));
  for (let i = 0; i < 6; i++) till.add(bead(mat('#e9b949', { metal: true }), [-.3 + (i % 3) * .3, .64, .2 - (i > 2 ? .22 : 0)], .07));
  counter.add(till);
  const basket = new THREE.Group(); basket.position.set(2.5, 1.12, .1);
  basket.add(lathe([[0, 0], [.5, 0], [.62, .35], [.58, .38], [.45, .05], [0, .05]], mat('#d9b070', { felt: true }), 20));
  basket.add(mesh(new THREE.TorusGeometry(.55, .04, 6, 20, Math.PI), mat('#b08850', { felt: true }), [0, .38, 0], 1, [0, Math.PI / 2, 0]));
  counter.add(basket);
  freeze(counter); counter.position.set(-.4, 0, -1.0); room.add(counter);
  freeze(room); inside.add(room);
  // stock on the shelves: up to 10 of each, in two rows of five
  for (const id of Object.keys(GOODS)) {
    const [row, col] = SLOT[id] || [0, 0];
    const xs = col === 0 ? -4.85 : col === 1 ? -1.3 : 2.2, y = 1.63 + row * 1.3;
    const items = [];
    for (let i = 0; i < 10; i++) items.push({ p: [xs + (i % 5) * .68 + (i >= 5 ? .34 : 0), y, -5.25 - (i >= 5 ? .6 : 0)], s: 1.35, ry: (i * 1.7) % 1 - .5 });
    const g = K.scatter(goodModel(id), items); g.userData.n = 10; SHELF[id] = g; inside.add(g);
  }
})();

/* ------------------------------------------------------------------ decorations (bought with the savings jar) */
const DECOR = {};
function addDecor(id, where, build) { const g = build(); g.visible = false; (where === 'in' ? inside : outside).add(g); DECOR[id] = g; }
function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#fff3dc'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#c98a5a'; x.lineWidth = 10; x.strokeRect(10, 10, 492, 140);
  x.fillStyle = '#7a3d2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 64; x.font = `bold ${fs}px "Comic Sans MS", "Chalkboard SE", Georgia, serif`;
  while (x.measureText(text).width > 450 && fs > 24) { fs -= 4; x.font = `bold ${fs}px "Comic Sans MS", "Chalkboard SE", Georgia, serif`; }
  x.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const signMat = new THREE.MeshStandardMaterial({ roughness: .9 });
let signText = '';
addDecor('sign', 'out', () => {
  const g = new THREE.Group(); g.position.set(0, 3.5, -.2);
  g.add(mesh(new THREE.BoxGeometry(3.0, .95, .12), mat('#9a6a45', { felt: true })));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .85), signMat); face.position.z = .07; face.userData.noMerge = true; g.add(face);
  return g;
});
addDecor('awning', 'out', () => {
  const g = new THREE.Group(); g.position.set(0, 2.85, -.35);
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.CylinderGeometry(.9, .9, .26, 10, 1, true, Math.PI * .5, Math.PI * .5), mat(i % 2 ? '#fff7e6' : '#e2566b', { felt: true, side: THREE.DoubleSide }), [-.91 + i * .26, 0, 0], 1, [0, 0, Math.PI / 2]));
  for (let i = 0; i < 8; i++) g.add(bead(mat(i % 2 ? '#fff7e6' : '#e2566b', { felt: true }), [-.91 + i * .26, -.05, .9], [.13, .12, .06]));
  freeze(g); return g;
});
addDecor('windowboxes', 'out', () => {
  const g = new THREE.Group();
  for (const [x, z, ry] of [[-1.85, -.95, -.78], [1.85, -.95, .78]]) {
    const b = new THREE.Group(); b.position.set(x, 1.9, z); b.rotation.y = ry;
    b.add(mesh(new THREE.BoxGeometry(1.2, .35, .4), mat('#7bb4d9', { felt: true }), [0, 0, .25]));
    ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'].forEach((c, i) => { const f = K.flower(c, .7); f.position.set(-.42 + i * .28, .1, .25); b.add(f); });
    g.add(b);
  }
  freeze(g); return g;
});
addDecor('lanterns', 'out', () => {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(sx * 1.25, 0, -.05);
    l.add(capsule(mat('#5a4a3a', { metal: true }), [0, 0, 0], [0, 2.1, 0], .05));
    l.add(mesh(new THREE.CylinderGeometry(.2, .16, .38, 8), mat('#ffe6a0', { glow: 1.5, glowColor: '#ffc85a' }), [0, 2.3, 0]));
    l.add(mesh(new THREE.ConeGeometry(.26, .2, 8), mat('#5a4a3a', { metal: true }), [0, 2.58, 0]));
    const gl = glow('#ffd27a', 1.6, .35); gl.position.set(0, 2.3, .05); l.add(gl); lanternGlow.push(gl);
    g.add(l);
  }
  return g;
});
addDecor('bunting', 'out', () => {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 12; i++) { const a = -1.0 + i / 12 * 2.0; pts.push([Math.sin(a) * 4.62, 4.2 - Math.cos(i / 12 * Math.PI * 2) * .0 - Math.sin(i / 12 * Math.PI) * .35, Math.cos(a) * 4.62 - 3]); }
  g.add(tube(pts, .02, mat('#fff7e6'), 40, 4));
  const cols = ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#b9a6e8'];
  const tri = K.geo('ts-flag', () => { const s = new THREE.Shape(); s.moveTo(-.18, 0); s.lineTo(.18, 0); s.lineTo(0, -.4); s.closePath(); return new THREE.ShapeGeometry(s); });
  pts.slice(1, -1).forEach((p, i) => { const f = new THREE.Mesh(tri, mat(cols[i % 5], { felt: true, side: THREE.DoubleSide })); f.position.set(...p); f.lookAt(p[0] * 2, p[1], (p[2] + 3) * 2 - 3); g.add(f); });
  freeze(g); return g;
});
addDecor('vase', 'in', () => {
  const g = new THREE.Group(); g.position.set(.9, 1.12, -1.25);
  g.add(lathe([[0, 0], [.22, 0], [.3, .2], [.18, .5], [.22, .62], [0, .6]], mat('#7bb4d9', { gloss: true }), 18));
  ['#f6a6bd', '#ffd86b', '#ffffff'].forEach((c, i) => { const f = K.flower(c, 1.3); f.position.set(-.12 + i * .12, .4, 0); f.rotation.z = (i - 1) * .3; g.add(f); });
  freeze(g); return g;
});
addDecor('rug', 'in', () => {
  const g = new THREE.Group(); g.position.set(1.4, .02, 2.2);
  ['#e2566b', '#ffd86b', '#7bb4d9', '#f6a6bd'].forEach((c, i) => g.add(mesh(new THREE.CylinderGeometry(2.4 - i * .55, 2.4 - i * .55, .03, 40), mat(c, { felt: true }), [0, i * .01, 0], [1, 1, .62])));
  freeze(g); return g;
});
addDecor('catbed', 'in', () => {
  const g = new THREE.Group(); g.position.set(-5.2, 0, 1.4);
  g.add(lathe([[0, 0], [.9, 0], [1.0, .3], [.85, .38], [.7, .1], [0, .1]], mat('#b9a6e8', { felt: true }), 24));
  const cat = new THREE.Group();
  cat.add(ball(mat('#f0b46a', { felt: true }), [0, .35, 0], [.5, .3, .42]));
  cat.add(ball(mat('#f0b46a', { felt: true }), [.38, .45, .15], [.28, .25, .25]));
  const ec = K.geo('ts-catear', () => new THREE.ConeGeometry(.2, .36, 4));
  for (const sx of [-1, 1]) cat.add(mesh(ec, mat('#f0b46a', { felt: true }), [.38 + sx * .14, .7, .15], [.6, .6, .4], [0, 0, sx * -.3]));
  const f = new THREE.Group(); f.position.set(.38, .45, .38); f.scale.setScalar(.25); K.eyes(f, { y: .1, x: .35, z: 0, closed: true }); cat.add(f);
  cat.add(tube([[-.4, .3, 0], [-.4, .3, .4], [0, .25, .55]], .07, mat('#f0b46a', { felt: true }), 10, 6));
  g.add(cat);
  freeze(g); return g;
});
addDecor('fairylights', 'in', () => {
  const g = new THREE.Group();
  const cols = ['#ffd86b', '#f6a6bd', '#a9d4ff', '#b8f0c8'];
  for (let i = 0; i < 40; i++) { const a = Math.PI * .5 + i / 39 * Math.PI, y = 6.7 - Math.abs(Math.sin(i / 39 * Math.PI * 5)) * .6; g.add(bead(mat(cols[i % 4], { glow: 1.6 }), [Math.sin(a) * 8.1, y, Math.cos(a) * 8.1], .13)); }
  return g;
});
addDecor('bell', 'in', () => {
  const g = new THREE.Group(); g.position.set(6.3, 3.6, -.9);
  g.add(lathe([[0, .55], [.18, .5], [.26, .2], [.36, 0], [.3, -.02], [0, .05]], mat('#e9b949', { metal: true }), 20));
  g.add(capsule(mat('#5a4a3a'), [0, .55, 0], [0, 1.0, 0], .03));
  freeze(g); return g;
});
addDecor('shopcat', 'in', () => new THREE.Group());

/* ------------------------------------------------------------------ the people in the scene */
const SPOTS = {
  inside: { keeper: [-1.0, 0, -2.15, .15], cust: [2.8, 0, .6, -.95], enter: [7.6, 0, -1.2, -1.4] },
  outside: { keeper: [-1.7, 0, 1.6, .25], cust: [2.0, 0, 1.9, -.35], enter: [9, 0, 3, -1.4] },
};
const actors = {}; // slot -> {key, obj, pos, target, leaving}
const modelCache = new Map();
function build(spec) {
  const key = JSON.stringify(spec);
  if (!modelCache.has(key)) modelCache.set(key, spec.species === 'fairy' ? K.fairy({ wing: spec.wing || 'gold', dress: spec.dress || '#d4c4ff', dress2: '#fff3cf', hairColor: spec.hair || '#f2d27a', crown: !!spec.crown, wand: true }) : critter(spec));
  return K.instance(modelCache.get(key));
}
function spawn(spec, sceneName, slot, t) {
  const obj = build(spec); scene.add(obj);
  const S = SPOTS[sceneName] || SPOTS.inside;
  const start = slot === 'keeper' ? S.keeper : S.enter;
  obj.position.set(start[0], start[1], start[2]); obj.rotation.y = start[3];
  if (spec.species === 'fairy') obj.scale.setScalar(.95);
  return { key: JSON.stringify(spec), obj, scene: sceneName, born: t };
}
function drop(slot) { const a = actors[slot]; if (a) { scene.remove(a.obj); delete actors[slot]; } }
function sync(slot, spec, sceneName, t) {
  const key = spec ? JSON.stringify(spec) : '';
  const cur = actors[slot], nw = actors[slot + '_new'];
  if (slot === 'keeper') { // the shopkeeper never walks off: changes (a new dress) show at once
    if (cur && (cur.key !== key || cur.scene !== sceneName)) drop(slot);
    if (spec && !actors[slot]) actors[slot] = spawn(spec, sceneName, slot, t);
    return;
  }
  if (cur && !cur.leaving && cur.key !== key) cur.leaving = true;
  if (nw && nw.key !== key) drop(slot + '_new');
  if (!spec) return;
  if (cur && !cur.leaving && cur.key === key) return;
  if (actors[slot + '_new']) return;
  actors[cur ? slot + '_new' : slot] = spawn(spec, sceneName, slot, t);
}
function updateActors(dt, t) {
  const v = V(), sc = v.scene === 'inside' ? 'inside' : 'outside';
  for (const [slot, a] of Object.entries(actors)) {
    const S = SPOTS[a.scene] || SPOTS.inside;
    const base = slot.startsWith('keeper') ? 'keeper' : 'cust';
    const wrong = a.scene !== sc;
    if (wrong) { scene.remove(a.obj); delete actors[slot]; continue; }
    const tgt = a.leaving ? S.enter : S[base];
    const p = a.obj.position, dx = tgt[0] - p.x, dz = tgt[2] - p.z, d = Math.hypot(dx, dz);
    const u = a.obj.userData;
    if (d > .05) {
      const sp = Math.min(d, dt * 4.2);
      p.x += dx / d * sp; p.z += dz / d * sp;
      a.obj.rotation.y += (Math.atan2(dx, dz) - a.obj.rotation.y) * Math.min(1, dt * 8);
      if (u.kind === 'critter') u.mood = 'walk'; else u.mood = 'idle';
    } else {
      if (a.leaving) { scene.remove(a.obj); delete actors[slot]; continue; }
      a.obj.rotation.y += (tgt[3] - a.obj.rotation.y) * Math.min(1, dt * 5);
      const want = (v.mood || {})[base] || 'idle';
      u.mood = want;
    }
    if (u.kind === 'fairy') a.obj.position.y = .4 + Math.sin(t * 1.5) * .15;
    animCritter(a.obj, t);
  }
  // promote "_new" actors once the old one has gone
  for (const slot of Object.keys(actors)) if (slot.endsWith('_new')) { const b = slot.slice(0, -4); if (!actors[b]) { actors[b] = actors[slot]; delete actors[slot]; } }
}

/* ------------------------------------------------------------------ camera framing */
const CAMS = {
  outside: { pos: [0, 3.6, 14.5], look: [0, 2.7, 0], span: 13 },
  inside: { pos: [0, 3.4, 9.5], look: [0, 2.3, -1.8], span: 10.5 },
  meet: { pos: [-1.2, 2.4, 7.2], look: [-1.5, 1.4, 1.6], span: 4.6 },
  cart: { pos: [2.4, 3.0, 10.5], look: [1.6, 1.6, 1.2], span: 9.5 },
};
const camPos = new THREE.Vector3(...CAMS.outside.pos), camLook = new THREE.Vector3(...CAMS.outside.look);
let W = 1, H = 1;
function sizeAll() {
  W = innerWidth; H = innerHeight;
  R.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
let dpr = Math.min(devicePixelRatio || 1, 1.75);
R.setPixelRatio(dpr); sizeAll(); addEventListener('resize', sizeAll);

function frameCamera(dt, snap) {
  const v = V(), c = CAMS[v.cam || (v.scene === 'inside' ? 'inside' : 'outside')] || CAMS.outside;
  // the panel covers the bottom of the screen: put the scene's centre in the free space above it
  const top = v.top || 0, bottom = v.bottom || H, free = Math.max(120, bottom - top);
  const aspect = W / free;
  cam.aspect = W / H;
  const fovFree = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(36) / 2)); // base fov for the free area
  const needH = Math.max(c.span / aspect, c.span * .62); // keep the whole span in view, wide or tall
  const dir = new THREE.Vector3(...c.pos).sub(new THREE.Vector3(...c.look)).normalize();
  const dist = needH / 2 / Math.tan(fovFree / 2);
  const want = new THREE.Vector3(...c.look).addScaledVector(dir, dist);
  const k = snap ? 1 : Math.min(1, dt * 2.5);
  camPos.lerp(want, k); camLook.lerp(new THREE.Vector3(...c.look), k);
  // full-screen fov so the free area gets the 36 degree view
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(fovFree / 2) * H / free));
  cam.position.copy(camPos); cam.lookAt(camLook);
  const cy = top + free / 2;
  cam.setViewOffset(W, H, 0, H / 2 - cy, W, H);
  cam.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ frame loop */
let last = performance.now(), T = 0, slow = 0, fast = 0, first = true;
const stats = { calls: 0, ms: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(.1, (now - last) / 1000); last = now; T += dt;
  if (dt > 1 / 40) slow++; else fast++;
  if (slow > 30 && dpr > .9) { dpr = Math.max(.9, dpr - .2); R.setPixelRatio(dpr); sizeAll(); slow = 0; fast = 0; }
  if (fast > 600 && dpr < Math.min(devicePixelRatio || 1, 1.75) - .05) { dpr = Math.min(dpr + .15, Math.min(devicePixelRatio || 1, 1.75)); R.setPixelRatio(dpr); sizeAll(); fast = 0; }
  if (slow + fast > 900) { slow = 0; fast = 0; }
  const v = V(), sc = v.scene === 'inside' ? 'inside' : 'outside';
  inside.visible = sc === 'inside'; outside.visible = !inside.visible;
  setSky(sc === 'inside' ? 'day' : v.time || 'day');
  outside.userData.cart.visible = !!v.cart;
  // stock and decorations
  const stock = v.stock || {};
  for (const [id, g] of Object.entries(SHELF)) { const n = Math.max(0, Math.min(10, stock[id] | 0)); if (g.userData.n !== n) { g.children.forEach(im => (im.count = n)); g.userData.n = n; } }
  const own = new Set(v.decor || []);
  for (const [id, g] of Object.entries(DECOR)) g.visible = own.has(id);
  if (own.has('sign') && v.signText && v.signText !== signText) { signText = v.signText; if (signMat.map) signMat.map.dispose(); signMat.map = signTexture(signText); signMat.needsUpdate = true; }
  // actors
  sync('keeper', v.keeper || null, sc, T);
  sync('cust', v.cust || null, sc, T);
  updateActors(dt, T);
  frameCamera(dt, first); first = false;
  R.render(scene, cam);
  stats.calls = R.info.render.calls; stats.ms = dt * 1000;
}
requestAnimationFrame(frame);
document.body.classList.add('g3d');

/* ------------------------------------------------------------------ pictures for the panels */
// Decorations spread around the shop get a small stand-in picture.
const THUMB = {
  windowboxes() { const b = new THREE.Group(); b.add(mesh(new THREE.BoxGeometry(1.2, .35, .4), mat('#7bb4d9', { felt: true }))); ['#f6a6bd', '#ffd86b', '#b9a6e8', '#ffffff'].forEach((c, i) => { const f = K.flower(c, .7); f.position.set(-.42 + i * .28, .1, 0); b.add(f); }); return b; },
  lanterns() { const l = DECOR.lanterns.children[0].clone(); l.position.set(0, 0, 0); return l; },
  bunting() {
    const g = new THREE.Group(); const cols = ['#e2566b', '#ffd86b', '#7bb4d9', '#8cc46c', '#b9a6e8'];
    g.add(tube([[-1.2, .3, 0], [0, 0, 0], [1.2, .3, 0]], .02, mat('#c9b49a'), 20, 4));
    const tri = K.geo('ts-flag', () => null);
    for (let i = 0; i < 5; i++) { const x = -1 + i * .5; const f = new THREE.Mesh(tri, mat(cols[i], { felt: true, side: THREE.DoubleSide })); f.position.set(x, .3 * (x * x) / 1.44, 0); g.add(f); }
    return g;
  },
  fairylights() {
    const g = new THREE.Group(); const cols = ['#ffd86b', '#f6a6bd', '#a9d4ff', '#b8f0c8'];
    g.add(tube([[-1.2, .2, 0], [-.6, -.1, 0], [0, .2, 0], [.6, -.1, 0], [1.2, .2, 0]], .015, mat('#5f9a62'), 30, 4));
    for (let i = 0; i < 9; i++) { const x = -1.2 + i * .3; g.add(bead(mat(cols[i % 4], { glow: 1.6 }), [x, .2 - Math.abs(Math.sin((x + 1.2) / 1.2 * Math.PI)) * .3 + .0, 0], .09)); }
    return g;
  },
  rug() { const c = DECOR.rug.clone(); c.visible = true; c.position.set(0, 0, 0); c.scale.set(.5, 4, .5); return c; },
};
const portraitView = { yaw: .25, pitch: .1, pad: 1.05 };
G.Shop3D = {
  good: id => baker.bake('good:' + id, () => goodModel(id), { yaw: .5, pitch: .45, pad: 1.1 }),
  coin: v => baker.bake('coin:' + v, () => coinModel(v), { frame: [0, 0, 2.2], yaw: 0, pitch: 0 }),
  portrait: spec => baker.bake('p:' + JSON.stringify(spec), () => {
    const o = spec.species === 'fairy' ? K.fairy({ wing: spec.wing || 'gold', dress: spec.dress || '#d4c4ff', dress2: '#fff3cf', hairColor: spec.hair || '#f2d27a', crown: !!spec.crown, wand: false }) : critter(spec);
    o.traverse(m => { if (m.material && m.material.map === blobTex) m.visible = false; });
    return o;
  }, { ...portraitView, pose: o => { o.traverse(m => { if (m.isMesh && m.material && m.material.map === blobTex) { m.userData.noFit = true; m.visible = false; } }); } }),
  decor: id => baker.bake('d:' + id, () => {
    if (THUMB[id]) return THUMB[id]();
    const c = DECOR[id].clone(); c.visible = true; c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); return c;
  }, { yaw: .3, pitch: .3, pad: 1.15 }),
};
G.__ts3d = { R, scene, stats, actors, get dpr() { return dpr; } };
if (G.__ts && G.__ts.on3d) G.__ts.on3d();
