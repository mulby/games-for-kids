// Her family doing things at home, like The Sims (family.js sets TSV.act, shop3d.js draws it in her rooms).
// An activity has two phases: 'ready' (everyone walks over and the things are set out, while she works out the sum)
// and 'do' (they eat, splash, build, bowl, read or bake). Baking has a third, 'eat': everyone takes one.
//   TSV.act = { id, kind: 'eat' | 'bath' | 'towers' | 'skittles' | 'story' | 'bake', phase, who: [ids], ... }
// places(act, room) says where each person stands, [x, z, yaw, y]; build(act, room) makes the props, and their
// update(phase, s) (s: seconds since the phase began) moves them and returns how each person should look.
import * as THREE from 'three';
import * as D from './felt3d.js';
import { table, HOME_KIND, HOME_SPOTS } from './rooms3d.js';

const TAU = Math.PI * 2;
const STAGE = [.3, .9]; // the open floor at the front of every room
// the kitchen and bathroom have their own table and tub at the back
const TABLE = { kitchen: { x: 0, z: -1.6, top: 1.1, own: true } };
const TUB = { bath: { x: -.8, z: -3.4, water: 1.12, own: true } };
const tableAt = room => TABLE[room] || { x: STAGE[0], z: STAGE[1] - .3, top: 1.1, own: false };
const tubAt = room => TUB[room] || { x: STAGE[0], z: STAGE[1] - .2, water: .5, own: false };
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const ease = s => s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s);
const clamp01 = s => Math.max(0, Math.min(1, s));

// places round the back and ends of a table, all facing it (and so the camera); k < 1 is further in (their plates)
function round(T, ids, k = 1, y = 0) {
  const out = {}, n = ids.length, a0 = -Math.PI - .2, a1 = .2, rx = 1.85 * k, rz = 1.25 * k;
  ids.forEach((id, i) => {
    const a = n === 1 ? -Math.PI / 2 : a0 + (a1 - a0) * i / (n - 1), x = T.x + Math.cos(a) * rx, z = T.z + Math.sin(a) * rz;
    out[id] = [x, z, face(x, z, T.x, T.z), y];
  });
  return out;
}
const STOOL_H = .52;
function stool() {
  const g = new THREE.Group(), w = D.wood('#a8734a', { axis: 1 });
  g.add(D.mesh(new THREE.CylinderGeometry(.3, .3, .08, 20), D.wood('#c08a58', { axis: 0 }), [0, STOOL_H - .04, 0]));
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; g.add(D.capsule(w, [Math.cos(a) * .2, 0, Math.sin(a) * .2], [Math.cos(a) * .15, STOOL_H - .06, Math.sin(a) * .15], .035, 8)); }
  return g;
}
export function places(act, room) {
  const [cx, cz] = STAGE, who = act.who || [];
  switch (act.kind) {
    // at breakfast they sit up at the table on stools; baking is done standing
    case 'eat': return round(tableAt(room), who, 1, STOOL_H);
    case 'bake': return round(tableAt(room), who);
    case 'bath': {
      const B = tubAt(room), kid = who[0], p = {};
      // she walks the child to the tub; in the bath they sit down in the water
      p[kid] = act.phase === 'ready' ? [B.x + 1.3, B.z + 1.1, face(B.x + 1.3, B.z + 1.1, B.x, B.z), 0] : [B.x, B.z, .3, B.own ? .2 : -.38];
      p.keeper = [B.x - 1.7, B.z + .9, face(B.x - 1.7, B.z + .9, B.x, B.z), 0];
      return p;
    }
    case 'towers': return { [who[0]]: [cx - 1.6, cz + .5, .9, 0], keeper: [cx + 2.1, cz + .4, -.9, 0] };
    case 'skittles': return { [who[0]]: [cx - 2.3, cz + .3, Math.PI / 2, 0], keeper: [cx - 1.2, cz + 1.7, .4, 0] };
    case 'story': return { [who[0]]: [cx - .5, cz, .7, .3], keeper: [cx + .9, cz - .4, -1.1, 0] };
  }
  return {};
}

// what the camera looks at while they do it: the middle of the activity and how wide it is
export function view(act, room) {
  const k = act.kind, T = tableAt(room), B = tubAt(room);
  const [x, z, w] = k === 'eat' || k === 'bake' ? [T.x, T.z - .3, 5.2] : k === 'bath' ? [B.x, B.z + .4, 5] : k === 'skittles' ? [STAGE[0] - .2, STAGE[1] + .4, 6] : k === 'story' ? [STAGE[0], STAGE[1], 4.4] : [STAGE[0], STAGE[1] + .5, 5.4];
  return { pos: [x, 4.6, z + 10], look: [x, 1.2, z], span: w, minSpan: w * .8, minH: 3.4, lowY: -.2, focus: [x, 1.1, z], r: 5 };
}

// where everyone else waits, off to the sides so the camera can see: they turn to watch
export function aside(act, room, j) {
  const V = view(act, room), x0 = V.look[0], z0 = V.look[2], side = j % 2 ? 1 : -1, x = x0 + side * (V.span / 2 + .3 + Math.floor(j / 2) * .9), z = z0 + .5 + Math.floor(j / 2) * .35;
  const r = Math.hypot(x, z), k = r > 5.6 ? 5.6 / r : 1;
  return [x * k, z * k, face(x * k, z * k, x0, z0), 0];
}

/* ---------------- props ---------------- */
const mats = {
  pancake: () => D.felt('#e9b66d', { mottle: .3 }), syrup: () => D.glaze('#b8661f', { rough: .2 }),
  plate: () => D.glaze('#ffffff', { rough: .18 }), straw: () => D.glossy('#e2384f', { rough: .3 }), blue: () => D.glossy('#4a5fb0', { rough: .25 }),
  water: () => D.glaze('#a9dcf5', { rough: .05 }), bubble: () => D.glaze('#ffffff', { rough: .05 }), tub: () => D.wood('#c9925a', { axis: 1 }),
  pin: () => D.glaze('#fffaf0', { rough: .2 }), stripe: () => D.glaze('#e2384f', { rough: .2 }), ball: () => D.glossy('#6a4fc4', { rough: .2 }),
};
const BLOCK_COLS = ['#e2566b', '#7bb4d9', '#8cc46c', '#ffd86b', '#b9a6e8'];
function food(kind) {
  const g = new THREE.Group();
  if (kind === 'pancakes') { g.add(D.mesh(new THREE.CylinderGeometry(.2, .2, .05, 20), mats.pancake())); g.userData.h = .055; }
  else { g.add(D.ball(kind === 'strawberries' ? mats.straw() : mats.blue(), [0, .04, 0], kind === 'strawberries' ? [.07, .08, .07] : .045, [0, 0, 0], 12)); g.userData.h = 0; }
  return g;
}
function zzz() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#6a7fd0'; x.fillText('z', 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.setScalar(.45); return s;
}
function puff() { return D.ball(D.felt('#ffffff', { mottle: .2 }), [0, 0, 0], .16, [0, 0, 0], 12); }

export function build(act, room) {
  const g = new THREE.Group(), [cx, cz] = STAGE, who = act.who || [];
  let update = () => ({});
  if (act.kind === 'eat') {
    // a plate for everyone; the food appears as she says how much to make, then it gets eaten up
    const T = tableAt(room), P = round(T, who, .62), n = Math.min(act.each || 2, 10), items = [];
    if (!T.own) { const t = table(2.4, 1.4); t.position.set(T.x, 0, T.z); g.add(t); }
    for (const [x, z] of Object.values(round(T, who))) { const st = stool(); st.position.set(x, 0, z); g.add(st); }
    for (const id of who) {
      const [px, pz] = P[id], plate = new THREE.Group(); plate.position.set(THREE.MathUtils.clamp(px, T.x - 1.05, T.x + 1.05), T.top, THREE.MathUtils.clamp(pz, T.z - .5, T.z + .5)); g.add(plate);
      plate.add(D.mesh(new THREE.CylinderGeometry(.3, .22, .04, 24), mats.plate()));
      for (let i = 0; i < n; i++) {
        const f = food(act.food || 'pancakes');
        if (f.userData.h) f.position.set(0, .04 + i * f.userData.h, 0); else f.position.set(Math.cos(i * 2.4) * .13 * Math.sqrt(i / n + .1), .03, Math.sin(i * 2.4) * .13 * Math.sqrt(i / n + .1));
        f.visible = false; plate.add(f); items.push({ f, i, n, id });
      }
    }
    update = (phase, s) => {
      const moods = {};
      for (const it of items) {
        // in 'do' each plate fills (one a beat), then empties again from the top while they munch
        const shown = phase === 'do' ? Math.min(it.n, Math.floor(s * 6)) - Math.max(0, Math.floor((s - 2.2) * it.n / 2.5)) : 0;
        it.f.visible = it.i < shown;
      }
      if (phase === 'do') for (const id of who) moods[id] = s > 2.2 && s < 4.7 ? 'talk' : s >= 4.7 ? 'happy' : 'idle';
      return moods;
    };
  } else if (act.kind === 'bath') {
    const B = tubAt(room), kid = who[0], full = B.water;
    if (!B.own) {
      g.add(D.lathe([[0, 0], [.75, 0], [.92, .6], [.86, .62], [.7, .08], [0, .08]], mats.tub(), 32).translateX(B.x).translateZ(B.z));
      for (const y of [.15, .45]) g.add(D.mesh(new THREE.TorusGeometry(.78 + y * .25, .03, 6, 32), D.metal(D.PAL.gold), [B.x, y, B.z], 1, [Math.PI / 2, 0, 0]));
    }
    const water = D.mesh(new THREE.CircleGeometry(B.own ? 1.25 : .82, 32).rotateX(-Math.PI / 2), mats.water(), [B.x, 0, B.z], B.own ? [1.15, 1, .7] : 1); g.add(water);
    const bubbles = [];
    for (let i = 0; i < 14; i++) { const b = D.ball(mats.bubble(), [0, 0, 0], .1 + (i % 3) * .05, [0, 0, 0], 12); b.visible = false; g.add(b); bubbles.push(b); }
    const duck = new THREE.Group(), yel = D.glossy('#ffd84a', { rough: .25 });
    duck.add(D.ball(yel, [0, 0, 0], [.16, .11, .12], [0, 0, 0], 14)); duck.add(D.ball(yel, [.1, .12, 0], .08, [0, 0, 0], 12)); duck.add(D.ball(D.glossy('#f08a3a'), [.18, .11, 0], [.05, .02, .035], [0, 0, 0], 8));
    duck.visible = false; g.add(duck);
    update = (phase, s, t) => {
      // the water rises as the last cups go in, then the bubbles come
      const lvl = phase === 'do' ? .45 + .55 * ease(s / 1.2) : .45;
      water.position.y = (B.own ? .4 : .1) + (full - (B.own ? .4 : .1)) * lvl;
      const on = phase === 'do' && s > 1.0;
      bubbles.forEach((b, i) => {
        b.visible = on;
        if (!on) return;
        const k = (s * .5 + i / 14) % 1, a = i * 2.4 + s * .4, r = (B.own ? .9 : .55) * Math.sqrt((i % 5 + 1) / 5);
        b.position.set(B.x + Math.cos(a) * r * (B.own ? 1.1 : 1), water.position.y + .05 + k * 1.4, B.z + Math.sin(a) * r * .6);
        b.scale.setScalar((1 - k) * (.1 + (i % 3) * .05) / .1);
      });
      duck.visible = on; duck.position.set(B.x + .45, water.position.y + .08 + Math.sin(t * 3) * .03, B.z + .2); duck.rotation.y = Math.sin(t * .7) * .6;
      return phase === 'do' ? { [kid]: s > 1.1 ? 'happy' : 'idle', keeper: s > 1.1 ? 'talk' : 'idle' } : {};
    };
  } else if (act.kind === 'towers') {
    // a pile of blocks; in 'do' they hop up one at a time onto her tower and the child's
    const a = Math.min(act.a || 3, 12), b = Math.min(act.b || 3, 12), blocks = [], S = .32;
    const towers = [[cx - .55, cz + .5], [cx + .75, cz + .4]];
    // turn about: the child's block, then hers, until one tower is done
    const left = [a, b];
    for (let i = 0; i < a + b; i++) {
      const m = D.rbox(S, S, S, .04, D.felt(BLOCK_COLS[i % 5])); g.add(m);
      const t = left[i % 2] ? i % 2 : 1 - i % 2; left[t]--;
      blocks.push({ m, t, pile: [cx + (Math.random() - .5) * 1.4, S / 2, cz + 1.4 + (Math.random() - .5) * .5], spin: Math.random() * TAU });
    }
    const h = [0, 0]; blocks.forEach(B => { B.level = h[B.t]++; });
    update = (phase, s) => {
      blocks.forEach((B, i) => {
        const k = phase === 'do' ? clamp01((s - i * .22) / .3) : 0, [tx, tz] = towers[B.t], e = ease(k);
        B.m.position.set(B.pile[0] + (tx - B.pile[0]) * e, B.pile[1] + (S / 2 + B.level * S - B.pile[1]) * e + Math.sin(k * Math.PI) * .6, B.pile[2] + (tz - B.pile[2]) * e);
        B.m.rotation.y = B.spin * (1 - e);
      });
      const end = (a + b) * .22 + .3;
      return phase === 'do' ? { [who[0]]: s > end ? 'happy' : 'give', keeper: s > end ? 'happy' : 'give' } : {};
    };
  } else if (act.kind === 'skittles') {
    // ten skittles in a triangle; the ball rolls and knocks some down
    const pins = [], down = Math.min(act.down || 3, 10), x0 = cx + .9, z0 = cz + .3;
    for (let row = 0, i = 0; row < 4; row++) for (let j = 0; j <= row; j++, i++) {
      const p = new THREE.Group();
      p.add(D.lathe([[0, 0], [.09, 0], [.12, .12], [.1, .3], [.05, .42], [.07, .5], [0, .56]], mats.pin(), 16));
      p.add(D.mesh(new THREE.TorusGeometry(.055, .018, 6, 16), mats.stripe(), [0, .4, 0], 1, [Math.PI / 2, 0, 0]));
      p.position.set(x0 + row * .3, 0, z0 + (j - row / 2) * .32); g.add(p);
      pins.push({ p, dir: Math.random() * TAU });
    }
    const order = pins.map((_, i) => i).sort((i, j) => pins[i].p.position.x - pins[j].p.position.x || Math.random() - .5);
    order.slice(0, down).forEach(i => { pins[i].falls = true; });
    const ball = D.ball(mats.ball(), [0, .2, 0], .2, [0, 0, 0], 20); g.add(ball);
    const from = [cx - 1.8, cz + .3];
    update = (phase, s) => {
      const k = phase === 'do' ? clamp01(s / 1.1) : 0;
      ball.position.set(from[0] + (x0 + 1.3 - from[0]) * k, .2, from[1] + (z0 - from[1]) * k); ball.rotation.z = -k * 10;
      ball.visible = k < 1;
      pins.forEach(P => { const f = P.falls ? ease(clamp01((s - .9 - (P.p.position.x - x0) * .4) / .35)) : 0; P.p.rotation.set(Math.cos(P.dir) * f * 1.5, 0, Math.sin(P.dir) * f * 1.5); });
      return phase === 'do' ? { [who[0]]: s < .4 ? 'give' : s > 1.6 ? 'happy' : 'idle', keeper: s > 1.6 ? 'happy' : 'idle' } : {};
    };
  } else if (act.kind === 'story') {
    // a cushion to sit on, the book in her hands, and sleepy z's at the end
    g.add(D.ball(D.felt('#b9a6e8', { print: { kind: 'dots', color: '#ffffff', n: 6, scale: 2 } }), [cx - .5, .18, cz], [.55, .2, .55], [0, 0, 0], 20));
    const book = new THREE.Group(), cover = D.felt('#c23f55'), page = D.paper('#fff8e6');
    const L = new THREE.Group(), R = new THREE.Group(), F = new THREE.Group();
    L.add(D.rbox(.42, .56, .03, .01, cover).translateX(-.21)); L.add(D.rbox(.38, .52, .01, .005, page).translateX(-.2).translateZ(.02));
    R.add(D.rbox(.42, .56, .03, .01, cover).translateX(.21)); R.add(D.rbox(.38, .52, .01, .005, page).translateX(.2).translateZ(.02));
    F.add(D.rbox(.38, .52, .01, .005, page).translateX(.2).translateZ(.03));
    book.add(L, R, F); book.position.set(cx + .55, 1.2, cz - .05); book.rotation.y = -1.1 + Math.PI; g.add(book);
    const zs = [0, 1, 2].map(() => { const z = zzz(); z.visible = false; g.add(z); return z; });
    update = (phase, s) => {
      const open = phase === 'do' ? ease(clamp01(s / .6)) : 0;
      L.rotation.y = -(1 - open) * 1.5; R.rotation.y = (1 - open) * 1.5;
      F.visible = open > .9; F.rotation.y = open > .9 ? -((s * .8) % 1) * Math.PI : 0;
      zs.forEach((z, i) => { const k = ((s - 2.6) * .45 + i / 3) % 1; z.visible = phase === 'do' && s > 2.6 + i * .5; z.position.set(cx - .5 + Math.sin(k * 5) * .2 + k * .3, 1.4 + k * 1.2, cz); z.material.opacity = 1 - k; });
      return phase === 'do' ? { [who[0]]: s > 2.6 ? 'think' : 'idle', keeper: 'talk' } : {};
    };
  } else if (act.kind === 'bake') {
    // a mixing bowl (stirred), then a tray of buns rising in the oven's warmth; then everyone takes one
    const T = tableAt(room), n = Math.min(act.made || 8, 12), people = act.people || 3;
    if (!T.own) { const t = table(2.4, 1.4); t.position.set(T.x, 0, T.z); g.add(t); }
    const bowl = new THREE.Group(); bowl.position.set(T.x - .6, T.top, T.z);
    bowl.add(D.lathe([[0, 0], [.18, 0], [.42, .3], [.44, .34], [0, .1]], D.glaze('#7bb4d9', { rough: .3 }), 28));
    bowl.add(D.ball(D.felt('#f6ecd8', { mottle: .3 }), [0, .26, 0], [.32, .08, .32], [0, 0, 0], 16));
    const spoon = D.capsule(D.wood('#e0b07a', { axis: 1 }), [0, .1, 0], [0, .8, 0], .035, 8); spoon.rotation.z = .3; bowl.add(spoon); g.add(bowl);
    const tray = new THREE.Group(); tray.position.set(T.x + .45, T.top, T.z); g.add(tray);
    tray.add(D.rbox(1.3, .05, .9, .02, D.metal('#c9ccd2')));
    const make = { bun: D.acornBun, tart: D.berryTart, biscuit: D.biscuit }[act.good] || D.acornBun, goods = [];
    for (let i = 0; i < n; i++) { const b = make(); b.scale.setScalar(.36); b.position.set(-.45 + (i % 4) * .3, .05, -.27 + Math.floor(i / 4) * .27); tray.add(b); goods.push(b); }
    const steam = [0, 1, 2, 3].map(() => { const p = puff(); g.add(p); return p; });
    update = (phase, s) => {
      const stir = phase === 'do' && s < 1.8;
      spoon.position.set(Math.cos(s * 8) * .12 * (stir ? 1 : 0), 0, Math.sin(s * 8) * .12 * (stir ? 1 : 0));
      const baked = phase === 'eat' || (phase === 'do' && s > 1.8), rise = phase === 'eat' ? 1 : ease(clamp01((s - 1.8) / 1.2));
      tray.visible = baked;
      goods.forEach((b, i) => { b.scale.setScalar(.36 * (.55 + .45 * rise)); b.visible = !(phase === 'eat' && i >= n - people && s > .4 + (n - 1 - i) * .35); });
      steam.forEach((p, i) => { const k = (s * .4 + i / 4) % 1; p.visible = baked && phase === 'do'; p.position.set(tray.position.x - .3 + i * .2, T.top + .3 + k * 1.2, T.z + Math.sin(i + k * 4) * .1); p.scale.setScalar((.6 + k) * .9); });
      const moods = {};
      if (phase === 'do') for (const id of who) moods[id] = s < 1.8 ? 'give' : 'happy';
      if (phase === 'eat') for (const id of who) moods[id] = 'talk';
      return moods;
    };
  }
  g.userData.update = update;
  return g;
}

/* ---------------- walking round things ---------------- */
// Furniture in each room as circles on the floor [x, z, r], so people walk round it instead of through it.
const FURNITURE = {
  // the first circles of rooms3d.js FIXED (the bed, the table and so on; the rest there are where the family stands)
  home: [[2.1, -6.3, 1.5], [-2.3, -5.85, 1.2], [-3.7, -3.5, 1.9], [2.6, -2.4, 1.2], [3.9, -2.2, .6]],
  kitchen: [[-.7, -1.6, .8], [.7, -1.6, .8], [-1.9, -1.5, .5], [1.9, -1.5, .5], [1.55, -6.05, 1.2], [-3.82, -5.33, 1.0], [-4.2, -2.4, .6], [-3.5, -3.2, .5], [4.0, -1.2, .5]],
  kids: [[4.81, -2.76, 1.1], [1.9, -5.21, 1.1], [-1.9, -5.21, 1.1], [-4.81, -2.76, 1.1], [-4.3, -.6, .7], [-3.6, .4, .4], [4.6, -1.0, .8]],
  bath: [[-1.6, -3.4, .9], [0, -3.4, .9], [3.6, -3.0, .5]],
  attic: [[-3.4, -3.0, 1.0], [-.6, -3.8, .4], [1.2, .4, .4], [4.3, -.4, .7], [-4.0, .2, .95], [2.2, -2.6, .8]],
};
// v: TSV (her own things in her house), act: the activity (its table, tub or skittles are in the way too)
export function blocks(room, v, act) {
  const out = (FURNITURE[room] || []).slice();
  if (v) { // her own things stand in any room of her house (a spot's room; none means the living room)
    const tray = v.homeTray || [], at = v.homeAt || {};
    for (const id of v.home || []) {
      const k = HOME_KIND[id], s = at[id] || HOME_SPOTS[id];
      if (k && s && k.at === 'floor' && !tray.includes(id) && s.x != null && (s.room || 'home') === room) out.push([s.x, s.z, k.r || .5]);
    }
  }
  if (act) {
    const T = tableAt(room), B = tubAt(room), [cx, cz] = STAGE;
    if ((act.kind === 'eat' || act.kind === 'bake') && !T.own) out.push([T.x - .6, T.z, .75], [T.x + .6, T.z, .75]);
    if (act.kind === 'bath' && !B.own) out.push([B.x, B.z, .95]);
    if (act.kind === 'skittles') out.push([cx + 1.35, cz + .3, .75]);
    if (act.kind === 'towers') out.push([cx - .55, cz + .5, .3], [cx + .75, cz + .4, .3]);
  }
  return out;
}
// One step for someone walking from p (a Vector3) towards tgt [x, z]: straight there, but sliding round furniture and
// other people (bodies: [{p, r}]) that are in the way, and never through them. Returns false once there.
export function step(p, tgt, r, dt, speed, bodies, blockList) {
  const dx = tgt[0] - p.x, dz = tgt[1] - p.z, d = Math.hypot(dx, dz);
  if (d < .05) return false;
  let vx = dx / d, vz = dz / d;
  const push = (bx, bz, R, k) => {
    const ox = p.x - bx, oz = p.z - bz, od = Math.hypot(ox, oz) || .001;
    if (od > R + .9) return;
    const w = (R + .9 - od) / .9, nx = ox / od, nz = oz / od;
    // slide round on whichever side is nearer the way she is going
    const [tx, tz] = -nz * vx + nx * vz >= 0 ? [-nz, nx] : [nz, -nx];
    vx += (nx * .6 + tx * 1.4) * w * k; vz += (nz * .6 + tz * 1.4) * w * k;
  };
  const inside = (bx, bz, br) => Math.hypot(tgt[0] - bx, tgt[1] - bz) < br + r; // going to a place in it (into the tub)
  for (const [bx, bz, br] of blockList) if (!inside(bx, bz, br)) push(bx, bz, br + r, 1);
  for (const b of bodies) if (Math.hypot(tgt[0] - b.p.x, tgt[1] - b.p.z) > b.r + r) push(b.p.x, b.p.z, b.r + r, .7);
  const vl = Math.hypot(vx, vz) || 1, sp = Math.min(d, dt * speed);
  p.x += vx / vl * sp; p.z += vz / vl * sp;
  // and never inside a thing or a person
  for (const [bx, bz, br] of blockList) {
    if (inside(bx, bz, br)) continue;
    const ox = p.x - bx, oz = p.z - bz, od = Math.hypot(ox, oz) || .001, R = br + r;
    if (od < R) { p.x = bx + ox / od * R; p.z = bz + oz / od * R; }
  }
  for (const b of bodies) {
    const ox = p.x - b.p.x, oz = p.z - b.p.z, od = Math.hypot(ox, oz) || .001, R = (b.r + r) * .9;
    if (od < R && Math.hypot(tgt[0] - b.p.x, tgt[1] - b.p.z) > R) { p.x = b.p.x + ox / od * R; p.z = b.p.z + oz / od * R; }
  }
  const rr = Math.hypot(p.x, p.z), max = 6.2; if (rr > max) { p.x *= max / rr; p.z *= max / rr; }
  return true;
}
