// Fun kit: the shared frame for the break-time mini games in fun/.
// A full-screen 3D stage that keeps itself smooth, touch picking, sparkle bursts, little synthesized sounds,
// spoken lines, and the title and end cards. Models come from shared/toy3d.js so everything shares one felt-toy look.
import * as THREE from 'three';
import * as K from './toy3d.js';

export { THREE, K };

/* ------------------------------------------------------------------ stage */
// One renderer, one scene, one camera. Lowers its resolution if frames get slow (older iPads) and raises it again when they recover.
export function stage({ bg = '#20264f', fov = 40, pos = [0, 0, 16], look = [0, 0, 0], shadows = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.id = 'stage';
  document.body.prepend(canvas);
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.setClearColor(bg, 1);
  if (shadows) { R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; }
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(fov, 1, .1, 400);
  cam.position.set(...pos); cam.lookAt(...look);
  const S = { R, scene, cam, canvas, look: new THREE.Vector3(...look), t: 0, tick: null, onResize: null, w: 1, h: 1 };
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  let dpr = maxDpr;
  function size() {
    S.w = window.innerWidth; S.h = window.innerHeight;
    R.setPixelRatio(dpr); R.setSize(S.w, S.h, false);
    cam.aspect = S.w / S.h; cam.updateProjectionMatrix();
    if (S.onResize) S.onResize(S.w, S.h);
  }
  window.addEventListener('resize', size);
  let last = performance.now(), acc = 0, n = 0, calm = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; S.t += dt;
    acc += dt; n++;
    if (n >= 50) {
      const avg = acc / n; acc = 0; n = 0;
      if (avg > .024 && dpr > 1) { dpr = Math.max(1, dpr - .25); calm = 0; size(); }
      else if (avg < .018 && dpr < maxDpr && ++calm > 4) { calm = 0; dpr = Math.min(maxDpr, dpr + .25); size(); }
    }
    if (S.tick) S.tick(dt, S.t);
    R.render(scene, cam);
  }
  S.start = () => { size(); requestAnimationFrame(frame); };
  // half the visible width and height at a given distance from the camera
  S.viewAt = dist => { const h = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist; return { h, w: h * cam.aspect }; };
  window.__fun = S;
  return S;
}

/* ------------------------------------------------------------------ touch */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function rayFrom(S, ev) {
  ndc.set(ev.clientX / S.w * 2 - 1, -(ev.clientY / S.h) * 2 + 1);
  ray.setFromCamera(ndc, S.cam);
  return ray.ray;
}
export function pick(S, ev, objects) {
  S.scene.updateMatrixWorld();
  ndc.set(ev.clientX / S.w * 2 - 1, -(ev.clientY / S.h) * 2 + 1);
  ray.setFromCamera(ndc, S.cam);
  return ray.intersectObjects(objects, true);
}
const _p = new THREE.Vector3();
export function planeHit(S, ev, plane) { return rayFrom(S, ev).intersectPlane(plane, _p) ? _p.clone() : null; }
// screen position (CSS px) of a world point
export function toScreen(S, v) { const p = v.clone().project(S.cam); return { x: (p.x + 1) / 2 * S.w, y: (1 - p.y) / 2 * S.h }; }

/* ------------------------------------------------------------------ sparkle bursts */
// Glowing dots and little 3D stars that fly out, fall a bit and fade. One pool, a couple of draw calls.
export function sparkles(scene, max = 160) {
  const pts = [], stars = [];
  const im = new THREE.InstancedMesh(K.starGeo(), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .35, roughness: .4 }), max);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; scene.add(im);
  const d = new THREE.Object3D(), col = new THREE.Color();
  const glowPool = [];
  function glowDot() {
    let g = glowPool.find(x => !x.visible);
    if (!g) { g = K.glow('#ffffff', 1, 1); scene.add(g); glowPool.push(g); }
    g.visible = true; return g;
  }
  return {
    burst(at, { n = 14, colors = ['#ffe58a', '#f6a6bd', '#a9d4ff', '#b8f0c8'], speed = 5, size = .22, up = 2, gravity = 7, dots = 6, dotColor = '#fff3b0', life = 1.1 } = {}) {
      for (let i = 0; i < n && stars.length < max; i++) {
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (.5 + Math.random() * .7);
        stars.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s * .6 + up, Math.sin(a) * Math.cos(b) * s), r: Math.random() * 6, vr: (Math.random() - .5) * 12, s: size * (.6 + Math.random() * .7), age: 0, life: life * (.7 + Math.random() * .6), c: colors[i % colors.length], g: gravity });
      }
      for (let i = 0; i < dots; i++) {
        const g = glowDot(), a = Math.random() * Math.PI * 2, s = speed * .5 * Math.random();
        g.material.color.set(dotColor); g.position.copy(at);
        g.userData.fx = { v: new THREE.Vector3(Math.cos(a) * s, Math.random() * s + up * .5, Math.sin(a) * s * .5), age: 0, life: life * .8, size: 1.2 + Math.random() * 1.4 };
      }
    },
    update(dt) {
      let k = 0;
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.age += dt;
        if (s.age >= s.life) { stars.splice(i, 1); continue; }
      }
      for (const s of stars) {
        s.v.y -= s.g * dt; s.p.addScaledVector(s.v, dt); s.r += s.vr * dt;
        const f = 1 - Math.pow(s.age / s.life, 3);
        d.position.copy(s.p); d.rotation.set(0, s.r * .3, s.r); d.scale.setScalar(s.s * f); d.updateMatrix();
        im.setMatrixAt(k, d.matrix); im.setColorAt(k, col.set(s.c)); k++;
      }
      im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      for (const g of glowPool) {
        if (!g.visible) continue;
        const fx = g.userData.fx; fx.age += dt;
        if (fx.age >= fx.life) { g.visible = false; continue; }
        g.position.addScaledVector(fx.v, dt); fx.v.multiplyScalar(1 - dt * 2);
        const f = 1 - fx.age / fx.life; g.material.opacity = f; g.scale.setScalar(fx.size * (.6 + f * .4));
      }
    }
  };
}

/* ------------------------------------------------------------------ sounds (made on the fly, no files) */
let AC = null, master = null, muted = false;
try { muted = localStorage.getItem('gfk-fun-muted') === '1'; } catch (e) {}
function ac() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.gain.value = .5; master.connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, { type = 'sine', vol = .3, delay = 0, attack = .005 } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
let noiseBuf = null;
function noise(dur, { vol = .2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
  const c = ac(); if (!c || muted) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
}
const NOTES = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5];
export const sfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  setMuted(m) { muted = m; try { localStorage.setItem('gfk-fun-muted', m ? '1' : '0'); } catch (e) {} },
  pop(p = 1) { tone(700 * p, 1400 * p, .09, { vol: .35 }); noise(.05, { vol: .12, freq: 3000 * p, q: .8 }); },
  chime(i = 0) { const f = NOTES[((i % NOTES.length) + NOTES.length) % NOTES.length]; tone(f, f, .5, { vol: .18, type: 'triangle' }); tone(f * 2, f * 2, .35, { vol: .06, delay: .02 }); },
  sparkle() { [0, 2, 4, 7].forEach((n, i) => tone(NOTES[n] * 2, NOTES[n] * 2, .25, { vol: .08, type: 'triangle', delay: i * .06 })); },
  fanfare() { [0, 2, 4, 5, 7].forEach((n, i) => tone(NOTES[n], NOTES[n], i === 4 ? .9 : .22, { vol: .16, type: 'triangle', delay: i * .13 })); },
  squeak() { tone(1500, 2300, .08, { vol: .12, type: 'triangle' }); tone(2100, 1600, .09, { vol: .1, type: 'triangle', delay: .09 }); },
  boing() { tone(220, 520, .18, { vol: .2 }); },
  plop() { tone(260, 120, .12, { vol: .25 }); noise(.06, { vol: .08, freq: 600 }); },
  dig() { noise(.12, { vol: .07, freq: 900 + Math.random() * 500, q: .6 }); },
  whoosh() { noise(.35, { vol: .1, freq: 700, q: .4 }); },
  meow() { tone(600, 900, .16, { vol: .14, type: 'triangle' }); tone(900, 520, .3, { vol: .14, type: 'triangle', delay: .15 }); }
};

/* ------------------------------------------------------------------ talking */
// Says a line in the shared reading voice when it's there, and shows it in a speech bubble either way.
let bubbleTimer = 0;
export function say(text, { who = '', silent = false } = {}) {
  const b = document.getElementById('fun-say');
  if (b) {
    b.innerHTML = (who ? `<span class="who">${who}</span>` : '') + text;
    b.classList.add('on'); clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove('on'), 2600 + text.length * 45);
  }
  if (!silent && window.KidVoice) { try { window.KidVoice.speak(text); } catch (e) {} }
}

/* ------------------------------------------------------------------ cards and buttons */
const CSS = `
#stage{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
.fun-ui{position:fixed;z-index:5;font-family:var(--font)}
.fun-top{top:calc(env(safe-area-inset-top,0px) + 12px);left:calc(env(safe-area-inset-left,0px) + 12px);right:calc(env(safe-area-inset-right,0px) + 12px);display:flex;gap:10px;align-items:center;pointer-events:none}
.fun-top > *{pointer-events:auto}
.fun-round{display:inline-flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:50%;font-size:30px;text-decoration:none;
  background:rgba(255,248,230,.92);box-shadow:0 4px 0 rgba(0,0,0,.18),0 6px 18px rgba(0,0,0,.18);border:0;color:#3a2f5c;cursor:pointer}
.fun-round:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.18)}
.fun-pill{display:inline-flex;align-items:center;gap:8px;min-height:56px;padding:6px 18px;border-radius:30px;background:rgba(255,248,230,.92);color:#3a2f5c;
  font-weight:800;font-size:26px;box-shadow:0 4px 0 rgba(0,0,0,.15)}
.fun-spacer{flex:1}
#fun-say{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);transform:translate(-50%,30px);opacity:0;max-width:min(88vw,640px);
  background:#fff8e6;color:#3a2f5c;border-radius:26px;padding:14px 24px;font-size:clamp(20px,2.2vw + 8px,28px);font-weight:700;text-align:center;
  box-shadow:0 8px 30px rgba(0,0,0,.25);transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .25s;pointer-events:none;z-index:6}
#fun-say.on{transform:translate(-50%,0);opacity:1}
#fun-say .who{display:block;font-size:.65em;opacity:.65;letter-spacing:.5px}
.fun-card{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(20,18,50,.35)}
.fun-card[hidden]{display:none}
.fun-card .box{background:#fff8e6;color:#3a2f5c;border-radius:34px;padding:28px 34px 30px;max-width:560px;width:100%;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.35);
  animation:funIn .5s cubic-bezier(.3,1.5,.5,1)}
@keyframes funIn{from{transform:scale(.7);opacity:0}to{transform:none;opacity:1}}
.fun-card .art{font-size:64px;line-height:1.1}
.fun-card img.art{width:180px;height:180px;object-fit:contain;display:block;margin:-10px auto -6px}
.fun-card h1{font-size:clamp(30px,3vw + 14px,44px);margin:6px 0 6px;line-height:1.05}
.fun-card p{font-size:clamp(19px,1.4vw + 10px,24px);margin:0 0 20px;line-height:1.35}
.fun-card .row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.fun-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:72px;padding:10px 32px;border-radius:40px;border:0;cursor:pointer;
  font:800 clamp(22px,2vw + 10px,30px)/1 var(--font);color:#3a2f5c;background:linear-gradient(#ffe9a3,#ffd86b 55%,#f4b94f);box-shadow:0 6px 0 #b9802d;text-decoration:none}
.fun-btn.soft{background:#efe4ff;box-shadow:0 6px 0 #b9a6e8}
.fun-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #b9802d}
.fun-btn.soft:active{box-shadow:0 2px 0 #b9a6e8}
.fun-card .extra{margin-top:16px;font-size:18px;opacity:.85}
`;
export function ui({ title = '', backLabel = 'Back to the shelf' } = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const top = document.createElement('div'); top.className = 'fun-ui fun-top';
  top.innerHTML = `<a class="fun-round" href="../../index.html" aria-label="${backLabel}">📚</a><span class="fun-spacer"></span><span id="fun-hud"></span>
    <button class="fun-round" id="fun-mute" type="button" aria-label="Sound on or off">${sfx.muted ? '🔇' : '🔊'}</button>`;
  document.body.appendChild(top);
  top.querySelector('#fun-mute').addEventListener('click', e => { sfx.setMuted(!sfx.muted); e.currentTarget.textContent = sfx.muted ? '🔇' : '🔊'; if (!sfx.muted) sfx.chime(4); });
  const sayB = document.createElement('div'); sayB.id = 'fun-say'; document.body.appendChild(sayB);
  const card = document.createElement('div'); card.className = 'fun-card'; card.hidden = true; card.innerHTML = '<div class="box"></div>'; document.body.appendChild(card);
  document.title = title || document.title;
  return {
    hud: document.getElementById('fun-hud'),
    top,
    // Shows a card. buttons: [{label, soft, value}] ; resolves with the value of the button pressed.
    card({ art = '', img = '', heading = '', text = '', buttons = [{ label: 'Play!', value: 'play' }], extra = '', speak = true } = {}) {
      const box = card.querySelector('.box');
      box.innerHTML = (img ? `<img class="art" src="${img}" alt="">` : art ? `<div class="art" aria-hidden="true">${art}</div>` : '') +
        `<h1>${heading}</h1>` + (text ? `<p>${text}</p>` : '') +
        `<div class="row">${buttons.map((b, i) => b.href ? `<a class="fun-btn ${b.soft ? 'soft' : ''}" href="${b.href}">${b.label}</a>` : `<button class="fun-btn ${b.soft ? 'soft' : ''}" data-i="${i}" type="button">${b.label}</button>`).join('')}</div>` +
        (extra ? `<div class="extra">${extra}</div>` : '');
      card.hidden = false;
      if (speak && text && window.KidVoice) { try { window.KidVoice.speak(text.replace(/<[^>]+>/g, '')); } catch (e) {} }
      return new Promise(res => {
        box.querySelectorAll('button[data-i]').forEach(btn => btn.addEventListener('click', () => {
          sfx.unlock(); sfx.pop(1.2); card.hidden = true;
          if (window.KidVoice) { try { window.KidVoice.stop(); } catch (e) {} }
          res(buttons[+btn.dataset.i].value);
        }, { once: true }));
      });
    },
    hideCard() { card.hidden = true; }
  };
}

/* ------------------------------------------------------------------ saves and break rewards */
export function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); if (v && typeof v === 'object') return Object.assign(fallback, v); } catch (e) {}
  return fallback;
}
export function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
// The Wonder Shelf leaves a "break earned" note when she finishes a stretch of a practice game.
// A mini game can take it (once) to give a little bonus.
export function takeBreakReward(game) {
  let v = null;
  try { v = JSON.parse(localStorage.getItem('gfk-break')); } catch (e) {}
  if (!v || !v.earned || (v.used || []).includes(game)) return false;
  v.used = (v.used || []).concat(game);
  try { localStorage.setItem('gfk-break', JSON.stringify(v)); } catch (e) {}
  return true;
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pickOne = a => a[Math.floor(Math.random() * a.length)];
export const ease = { out: t => 1 - Math.pow(1 - t, 3), back: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 };
