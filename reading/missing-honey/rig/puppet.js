// Puppet: cut-out character animation for painted storybook characters.
// A character is a set of painted parts (body, head, feet, tail, ...) cut from one painting,
// each hung on a pivot. Motion comes from springs and a stepping walk cycle rather than
// from warping the painting, so the brushwork stays intact.
//
//   const p = await Puppet.create(gl, Puppet.rigs.wren, { base: 'rig/' });
//   p.place(x, y, h)            // feet at world x,y; h = painting height in world units
//   p.walkTo(x[, y]) -> Promise // turns, anticipates, walks, settles
//   p.say(text, opts) -> Promise // speaks with lip-sync; opts.onWord(i, word) for highlighting
//   p.emote(name) -> Promise    // happy, surprised, thinking, giggle, wake, nod, hop, sad, wave, cheer, pointUp;
//                                 // sleep holds until another emote replaces it (wake looks best)
//   p.draw({ ..., view: [cx, cy, zoom] }) // optional camera in world units
//   p.lookAt(x, y) / p.lookAt(null)
//   p.update(t)                 // t in seconds (absolute clock)
//   p.draw({ worldW, worldH, fire:[x,y], fireAmt, shadow:true })
//   p.hit(x, y) -> bool         // is a world point on the character?
(function () {
  const rigs = {};

  // ---------- 2D affine as [a,b,c,d,e,f]: x' = a x + c y + e, y' = b x + d y + f ----------
  const M = {
    I: () => [1, 0, 0, 1, 0, 0],
    mul: (A, B) => [
      A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
      A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
      A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
    T: (x, y) => [1, 0, 0, 1, x, y],
    R: a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; },
    S: (x, y) => [x, 0, 0, y, 0, 0],
    about: (p, A) => M.mul(M.T(p[0], p[1]), M.mul(A, M.T(-p[0], -p[1]))),
    apply: (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]],
    mat3: A => new Float32Array([A[0], A[1], 0, A[2], A[3], 0, A[4], A[5], 1])
  };

  // ---------- springs ----------
  class Spring {
    constructor(v = 0, k = 120, damp = 12) { this.x = v; this.v = 0; this.k = k; this.d = damp; this.target = v; }
    step(dt, target = this.target, force = 0) {
      this.target = target;
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = this.k * (this.target - this.x) - this.d * this.v + force;
        this.v += a * h; this.x += this.v * h;
      }
      return this.x;
    }
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const bump = (t, a, b) => (t <= a || t >= b) ? 0 : Math.sin(Math.PI * (t - a) / (b - a));
  const approach = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  // ---------- GL ----------
  const VS = `
    attribute vec2 aUv;
    uniform vec4 uRect;            // part rect in painting px: x, y, w, h
    uniform mat3 uM;               // painting px -> world
    uniform vec2 uWorld;           // world size
    uniform vec4 uSway;            // amount px, y0, y1, centre x
    uniform vec4 uBend;            // angle, root x, root y, length
    varying vec2 vUv; varying vec2 vImg; varying vec2 vWorld;
    void main(){
      vec2 p = uRect.xy + aUv * uRect.zw;
      vImg = p;
      if (uSway.x != 0.) {
        float t = clamp((p.y - uSway.y) / (uSway.z - uSway.y), 0., 1.);
        p.x += uSway.x * t * t;
      }
      if (uBend.x != 0.) {
        vec2 d = p - uBend.yz;
        float a = uBend.x * smoothstep(0., uBend.w, length(d));
        float c = cos(a), s = sin(a);
        p = uBend.yz + vec2(c*d.x - s*d.y, s*d.x + c*d.y);
      }
      vec3 w = uM * vec3(p, 1.);
      vWorld = w.xy; vUv = aUv;
      gl_Position = vec4(w.x / uWorld.x * 2. - 1., 1. - w.y / uWorld.y * 2., 0., 1.);
    }`;
  const FS = `
    precision highp float;
    uniform sampler2D uTex; uniform vec4 uRect;
    uniform float uFace;
    uniform vec2 uEyeC; uniform vec2 uEyeR; uniform vec2 uLidSrc;
    uniform float uLidT; uniform float uLidB; uniform float uEyeS;
    uniform vec2 uMouthC; uniform vec2 uMouthR; uniform float uMouth; uniform float uMouthW;
    uniform vec3 uInk; uniform vec2 uFire; uniform float uFireAmt; uniform float uAlpha;
    varying vec2 vUv; varying vec2 vImg; varying vec2 vWorld;
    vec4 tex(vec2 img){ return texture2D(uTex, (img - uRect.xy) / uRect.zw); }
    void main(){
      vec4 c = texture2D(uTex, vUv);
      if (uFace > .5) {
        vec2 p = vImg;
        // eyes widen for surprise: sample the painted eye scaled about its centre
        vec2 e0 = (p - uEyeC) / uEyeR;
        if (uEyeS != 1.) {
          vec2 q = uEyeC + (p - uEyeC) / uEyeS;
          vec2 eq = (q - uEyeC) / uEyeR;
          float inside = smoothstep(1.25, 1.05, length(eq));
          c = mix(c, tex(q), inside);
        }
        vec2 e = e0 / max(uEyeS, 1.);
        float r2 = dot(e, e);
        if (r2 < 1.9) {
          float fade = smoothstep(1.9, 1.3, r2);
          float px = 1. / uEyeR.y;          // one painting pixel in eye units
          // upper lid closes downward
          if (uLidT > .01) {
            float yT = -1.25 + 2.35 * uLidT + .18 * e.x * e.x;
            float cover = smoothstep(yT + px, yT - px, e.y) * fade;
            c = mix(c, tex(p + uLidSrc), cover);
            float line = smoothstep(2.2 * px, .6 * px, abs(e.y - yT)) * smoothstep(1.2, .95, abs(e.x)) * step(.08, uLidT);
            c.rgb = mix(c.rgb, uInk * c.a, line * .9);
          }
          // lower lid rises into a happy curve
          if (uLidB > .01) {
            float yB = 1.25 - 2.35 * uLidB - .32 * (1. - e.x * e.x);
            float cover = smoothstep(yB - px, yB + px, e.y) * fade;
            c = mix(c, tex(p + uLidSrc * vec2(1., -1.) + vec2(0., uEyeR.y * 1.6)), cover);
            float line = smoothstep(2.2 * px, .6 * px, abs(e.y - yB)) * smoothstep(1.2, .95, abs(e.x)) * step(.08, uLidB);
            c.rgb = mix(c.rgb, uInk * c.a, line * .85);
          }
        }
        // mouth: a small painted opening under the nose
        if (uMouth > .02) {
          vec2 m = p - uMouthC;
          float rx = uMouthR.x * (.55 + .45 * uMouth) * uMouthW;
          float ry = max(.8, uMouthR.y * uMouth);
          vec2 mc = vec2(0., ry * .55);
          vec2 d = (m - mc) / vec2(rx, ry);
          float r = length(d);
          float a = smoothstep(1.05, .9, r);
          vec3 mouth = mix(vec3(.24, .1, .08), vec3(.72, .36, .36), smoothstep(.1, .8, d.y) * .8);
          c.rgb = mix(c.rgb, mouth * c.a, a);
          float edge = smoothstep(.75, 1., r) * smoothstep(1.2, 1., r);
          c.rgb = mix(c.rgb, uInk * c.a, edge * .85);
        }
      }
      float fireSide = exp(-pow(distance(vWorld, uFire), 2.) * 3.) * uFireAmt;
      c.rgb *= vec3(1.0, .985, .955) + vec3(.06, .03, -.01) * fireSide;
      gl_FragColor = c * uAlpha;
    }`;
  const SVS = `attribute vec2 aUv; uniform vec2 uC; uniform vec2 uR; uniform vec2 uWorld; varying vec2 vP;
    void main(){ vP = aUv * 2. - 1.; vec2 w = uC + vP * uR; gl_Position = vec4(w.x / uWorld.x * 2. - 1., 1. - w.y / uWorld.y * 2., 0., 1.); }`;
  const SFS = `precision mediump float; varying vec2 vP; uniform float uA;
    void main(){ float a = smoothstep(1., .1, length(vP)) * uA; gl_FragColor = vec4(vec3(.16,.11,.06)*a, a); }`;

  function glKit(gl) {
    if (gl.__puppet) return gl.__puppet;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (v, f) => {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u, aUv: gl.getAttribLocation(p, 'aUv') };
    };
    const grid = (nx, ny) => {
      const v = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const u0 = i / nx, u1 = (i + 1) / nx, v0 = j / ny, v1 = (j + 1) / ny;
        v.push(u0, v0, u1, v0, u0, v1, u0, v1, u1, v0, u1, v1);
      }
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      return { b, n: v.length / 2 };
    };
    return gl.__puppet = { part: prog(VS, FS), shadow: prog(SVS, SFS), mesh: grid(20, 28), quad: grid(1, 1) };
  }
  function texture(gl, img) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const pot = n => (n & (n - 1)) === 0;
    if (gl2 || (pot(img.width) && pot(img.height))) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load ' + src)); i.src = src; });

  // ---------- speech ----------
  const syllables = w => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) || []).length);
  function voiceFor(opts) {
    try {
      const vs = speechSynthesis.getVoices();
      if (opts.voice) { const v = vs.find(v => v.name === opts.voice); if (v) return v; }
      return vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    } catch (e) { return null; }
  }

  async function create(gl, rig, opts = {}) {
    const base = opts.base || '';
    const K = glKit(gl);
    const imgs = await Promise.all(rig.parts.map(p => loadImg(base + p.img)));
    const parts = rig.parts.map((p, i) => ({ ...p, tex: texture(gl, imgs[i]) }));
    // painted alternate poses (limited-animation pose swaps): replace some parts while held
    const poses = {};
    for (const [name, pose] of Object.entries(rig.poses || {})) {
      const names = Object.keys(pose.parts);
      const pim = await Promise.all(names.map(n => loadImg(base + pose.parts[n].img)));
      poses[name] = { ...pose, parts: Object.fromEntries(names.map((n, i) => [n, { ...pose.parts[n], tex: texture(gl, pim[i]) }])) };
    }
    const byName = Object.fromEntries(parts.map(p => [p.name, p]));
    const IH = rig.size[1];

    // ---------- state ----------
    const S = {
      x: 0, y: 0, h: .38, facing: 1, flip: 1, flipFrom: 1, turnT: -1,
      vx: 0, vy: 0, goal: null, mode: 'idle', modeT: 0, antT: 0,
      phase: 0, walkMix: 0, lastAx: 0,
      lean: new Spring(0, 90, 9), skirt: new Spring(0, 70, 5), basket: new Spring(0, 55, 2.6),
      tail: new Spring(0, 40, 4), headRot: new Spring(0, 80, 10), headLagY: new Spring(0, 260, 14),
      squash: new Spring(1, 260, 11), armF: new Spring(0, 140, 9), armB: new Spring(0, 120, 8), air: new Spring(0, 200, 16), mouth: new Spring(0, 900, 45),
      lidT: new Spring(0, 900, 40), lidB: new Spring(0, 400, 28), eyeS: new Spring(1, 300, 14),
      blinkT: -1, nextBlink: 1.5, pose: null, look: null, lookRot: 0, idleLook: 0, nextIdle: 2,
      speech: null, emote: null, t: 0, lastT: null, shiftT: 0
    };
    const P = rig.walk;

    // ---------- behaviours ----------
    function place(x, y, h) { S.x = x; S.y = y; if (h) S.h = h; S.goal = null; S.vx = 0; S.mode = 'idle'; }
    function face(dir) { if (dir && Math.sign(dir) !== S.facing) { S.flipFrom = S.flip; S.facing = Math.sign(dir); S.turnT = 0; } }
    function walkTo(x, y) {
      return new Promise(resolve => {
        if (S.goal && S.goal.resolve) S.goal.resolve(false);
        const dir = Math.sign(x - S.x);
        if (Math.abs(x - S.x) < .002) { resolve(true); return; }
        S.goal = { x, y: y == null ? S.y : y, resolve };
        if (dir !== S.facing) face(dir);
        if (S.mode !== 'walk') { S.mode = 'anticipate'; S.antT = 0; }
      });
    }
    function lookAt(x, y) { S.look = x == null ? null : [x, y]; }

    const EMOTES = {
      // each returns pose offsets for time t (s) since start; duration in .dur
      sleep: { dur: Infinity, f: t => { const k = Math.min(1, t / .8); return { lidT: 1, head: .17 * k, squash: (-.025 + .018 * Math.sin(t * 1.4)) * k, lean: .02 * k, armF: .12 * k, armB: -.12 * k, tail: -.1 * k }; } },
      pointUp: { dur: 2.8, f: t => poses.pointUp ? { pose: t > .14 && t < 2.6 ? 'pointUp' : null, squash: t < .14 ? -.05 : 0, lookUp: 0, mouth: .2 * bump(t, .4, 1.2), eyeS: 1 + .06 * bump(t, .2, 2.4) } : (t => { const up = bump(t, 0, 2.8) ** .3; return { armF: -2.6 * up, head: -.14 * up, lookUp: up > .5 ? 1 : 0, eyeS: 1 + .08 * up, mouth: .2 * bump(t, .3, 1.2) }; })(t) },
      wave: { dur: 2.2, f: t => { const up = bump(t, 0, 2.2) ** .35; return { armF: -2.1 * up + .32 * Math.sin(t * 11) * up, head: -.05 * up, lidB: .35 * up, mouth: .15 * up }; } },
      cheer: { dur: 1.4, f: t => { const up = bump(t, .08, 1.3) ** .4; return { armF: -2.2 * up, armB: 2.2 * up, air: 30 * bump(t, .15, .5), squash: t < .1 ? -.05 : 0, lidB: .5 * up, lidT: .3 * up, mouth: .5 * up }; } },
      happy: { dur: 1.3, f: t => ({ armF: -.35 * bump(t, .05, .9), armB: .35 * bump(t, .05, .9), lidB: t < 1.1 ? .62 : 0, lidT: t < 1.1 ? .32 : 0, head: -.06 * bump(t, 0, 1.2), air: 26 * (bump(t, .05, .35) + .6 * bump(t, .4, .66)), mouth: .25 * bump(t, 0, 1.1), squash: t < .06 ? -.04 : 0 }) },
      surprised: { dur: 1.2, f: t => ({ armF: -.75 * bump(t, .1, 1.15) ** .5, armB: .75 * bump(t, .1, 1.15) ** .5, eyeS: t > .12 && t < 1 ? 1.28 : 1, mouth: t > .12 && t < .95 ? .75 : 0, mouthW: .7, head: t > .1 ? .09 * bump(t, .1, 1.1) : -.03, air: 30 * bump(t, .1, .38), squash: t < .1 ? -.06 : (t < .3 ? .05 : 0), lean: .05 * bump(t, .1, 1) }) },
      thinking: { dur: 2.2, f: t => ({ head: .12 * bump(t, 0, 2.2) ** .5, lidT: .3 * bump(t, .2, 2), lookUp: 1, tail: .25 * Math.sin(t * 9) * bump(t, .3, 2) }) },
      giggle: { dur: 1.5, f: t => ({ armF: -.25 + .08 * Math.sin(t * 22), armB: .2, lidB: .6, lidT: .35, mouth: .35 + .3 * Math.abs(Math.sin(t * 16)), head: -.05 + .035 * Math.sin(t * 22), shake: .022 * Math.sin(t * 24) * bump(t, 0, 1.5), air: 6 * Math.abs(Math.sin(t * 12)) }) },
      wake: { dur: 2.6, f: t => ({ lidT: t < 1.6 ? 1 : (t < 1.75 ? .2 : 0), head: t < .9 ? .1 : -.06 * bump(t, .9, 2.2), squash: .07 * bump(t, .5, 1.9), mouth: .95 * bump(t, .6, 1.7), mouthW: .7 }) },
      nod: { dur: .9, f: t => ({ head: .09 * Math.sin(t * 14) * bump(t, 0, .9) }) },
      hop: { dur: .7, f: t => ({ squash: t < .1 ? -.07 : (t < .28 ? .05 : (t > .48 && t < .58 ? -.05 : 0)), air: 40 * bump(t, .1, .52), lean: .03 * bump(t, .1, .5) }) },
      sad: { dur: 2.2, f: t => ({ lidT: .45 * bump(t, 0, 2.2) ** .3, head: .12 * bump(t, 0, 2.2) ** .3, squash: -.03 * bump(t, 0, 2.2) }) }
    };
    function emote(name) {
      const E = EMOTES[name];
      if (!E) return Promise.resolve(false);
      return new Promise(resolve => { if (S.emote) S.emote.resolve(false); S.emote = { E, t0: S.t, resolve }; });
    }

    // speech: mouth shapes driven by word timing (boundary events when the voice provides them)
    function say(text, o = {}) {
      return new Promise(resolve => {
        const words = text.split(/\s+/).filter(Boolean);
        const sp = S.speech = { words, beats: [], t0: S.t, done: false, resolve, onWord: o.onWord };
        const rate = o.rate || .92;
        const wps = 2.6 * rate;
        // provisional schedule (used if the voice gives no word boundaries)
        let tt = 0;
        words.forEach((w, i) => {
          const n = syllables(w), d = Math.max(.22, n * .19 / rate);
          sp.beats.push({ i, at: tt, n, d });
          tt += d + (/[,.!?;:]$/.test(w) ? .28 / rate : .05);
        });
        sp.end = tt;
        let real = false;
        const finish = () => { if (sp.done) return; sp.done = true; if (S.speech === sp) S.speech = null; resolve(true); };
        sp.finish = finish;
        if (o.speak !== false && typeof speechSynthesis !== 'undefined') {
          try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = rate; u.pitch = o.pitch || rig.voicePitch || 1.15;
            const v = voiceFor(o); if (v) u.voice = v;
            // map character offsets to word index
            const starts = []; { let k = 0; for (const w of words) { k = text.indexOf(w, k); starts.push(k); k += w.length; } }
            u.onstart = () => { sp.t0 = S.t; };
            u.onboundary = e => {
              if (e.name && e.name !== 'word') return;
              let wi = 0; while (wi + 1 < starts.length && starts[wi + 1] <= e.charIndex) wi++;
              if (!real) { real = true; sp.beats = []; }
              const n = syllables(words[wi]);
              sp.beats.push({ i: wi, at: S.t - sp.t0, n, d: Math.max(.2, n * .17 / rate) });
              sp.end = Infinity;
            };
            u.onend = finish; u.onerror = () => { real = false; sp.end = sp.beats.length ? sp.beats[sp.beats.length - 1].at + .6 : 0; };
            speechSynthesis.speak(u);
            // if the voice never starts (no audio, no voices), fall back to the provisional timing
            setTimeout(() => { if (!real && sp.end === Infinity) sp.end = tt; }, 1500);
          } catch (e) { /* timing-only */ }
        }
      });
    }

    // ---------- update ----------
    function update(t) {
      const dt = S.lastT == null ? 1 / 60 : clamp(t - S.lastT, 0, .05);
      S.lastT = t; S.t = t;
      const pxPerWorld = IH / S.h;               // painting px per world unit
      let ax = 0;

      // turning (a quick paper-puppet flip with a squash)
      let turnSquash = 0;
      if (S.turnT >= 0) {
        S.turnT += dt; const p = clamp(S.turnT / .24, 0, 1);
        S.flip = S.flipFrom + (S.facing - S.flipFrom) * ease(p);
        turnSquash = -.05 * Math.sin(Math.PI * p);
        if (p >= 1) { S.turnT = -1; S.flip = S.facing; }
      }

      // locomotion
      if (S.mode === 'anticipate') {
        S.antT += dt;
        if (S.antT > .16 && S.turnT < 0) { S.mode = 'walk'; }
      }
      if (S.mode === 'walk' && S.goal) {
        const dx = S.goal.x - S.x, dist = Math.abs(dx);
        const dir = Math.sign(dx);
        if (dir !== S.facing && dist > .004) face(dir);
        const vmax = P.speed * S.h, acc = P.accel * S.h;
        const want = dir * Math.min(vmax, Math.sqrt(2 * acc * .8 * dist));
        const prev = S.vx;
        S.vx += clamp(want - S.vx, -acc * dt, acc * dt);
        if (S.turnT >= 0) S.vx *= .9;
        ax = (S.vx - prev) / Math.max(dt, 1e-3);
        S.x += S.vx * dt;
        S.y = approach(S.y, S.goal.y, 3, dt);
        S.phase += Math.abs(S.vx) * dt * pxPerWorld / P.cycle;
        if (dist < .003 && Math.abs(S.vx) < .02 * S.h) {
          S.x = S.goal.x; S.vx = 0; S.mode = 'idle';
          const g = S.goal; S.goal = null; g.resolve(true);
        }
      }
      const moving = Math.abs(S.vx) / (P.speed * S.h);
      S.walkMix = approach(S.walkMix, S.mode === 'walk' ? Math.min(1, moving * 1.6) : 0, 10, dt);
      const ph = S.phase, wm = S.walkMix;

      // emote pose
      let E = {};
      if (S.emote) {
        const et = t - S.emote.t0;
        E = S.emote.E.f(et);
        if (et > S.emote.E.dur) { const r = S.emote.resolve; S.emote = null; r(true); E = {}; }
      }

      // speech: mouth from syllable beats
      let mouthT = 0, mouthW = E.mouthW || 1;
      if (S.speech) {
        const sp = S.speech, st = t - sp.t0;
        for (const b of sp.beats) {
          if (st >= b.at && st < b.at + b.d) {
            const k = (st - b.at) / b.d * b.n;
            const syl = k - Math.floor(k);
            const seed = Math.sin((b.i + 1) * 12.9898 + Math.floor(k) * 78.233) * .5 + .5;
            mouthT = Math.max(mouthT, Math.sin(Math.PI * syl) ** .7 * (.45 + .55 * seed));
            if (sp.onWord && sp.lastWord !== b.i) { sp.lastWord = b.i; try { sp.onWord(b.i, sp.words[b.i]); } catch (e) {} }
          }
        }
        if (st > sp.end + .1) sp.finish();
      }
      S.mouth.step(dt, Math.max(mouthT, E.mouth || 0));

      // blinking (sometimes a double blink); lids follow emotes
      if (t > S.nextBlink && !(E.lidT > .5)) { S.blinkT = 0; S.nextBlink = t + 2 + Math.random() * 3.5; if (Math.random() < .2) S.nextBlink = t + .32; }
      let blink = 0;
      if (S.blinkT >= 0) { S.blinkT += dt; const p = S.blinkT / .17; blink = p < 1 ? Math.sin(Math.PI * p) ** .6 : 0; if (p >= 1) S.blinkT = -1; }
      S.lidT.step(dt, Math.max(blink, E.lidT || 0) + (S.speech ? .05 : 0));
      S.lidB.step(dt, E.lidB || 0);
      S.eyeS.step(dt, E.eyeS || 1);

      // idle life: weight shifts and glances
      if (t > S.nextIdle) { S.nextIdle = t + 2.5 + Math.random() * 4; S.idleLook = (Math.random() - .5) * .12; S.shiftT = t; }
      let lookRot = S.idleLook;
      if (S.look) {
        const hx = S.x + (rig.head.pivot[0] - rig.feet[0]) / pxPerWorld * S.flip;
        const hy = S.y + (rig.head.pivot[1] - rig.feet[1]) / pxPerWorld;
        const dx = (S.look[0] - hx) * S.facing, dy = S.look[1] - hy;
        if (dx < -.05 && S.mode === 'idle' && S.turnT < 0) face(-S.facing);
        lookRot = clamp(Math.atan2(dy, Math.abs(dx) + .2) * .45, -.16, .16);
      }
      if (E.lookUp) lookRot = -.1;
      const shift = .012 * bump(t - S.shiftT, 0, 1.6) * (S.idleLook > 0 ? 1 : -1) * (1 - wm);

      // walk cycle
      const cyc = ph - Math.floor(ph);
      const bobPx = wm * P.bob * Math.cos(4 * Math.PI * (cyc - .06));
      const rock = wm * P.rock * Math.sin(2 * Math.PI * cyc);
      const leanT = -clamp(ax / (P.accel * S.h), -1, 1) * .05 + wm * .035 + (E.lean || 0) + (S.mode === 'anticipate' ? -.045 : 0);
      S.lean.step(dt, leanT);
      const sqT = 1 + (E.squash || 0) + turnSquash + (S.mode === 'anticipate' ? -.045 : 0) - wm * .015 * Math.max(0, Math.cos(4 * Math.PI * (cyc - .06)));
      const poseNow = E.pose && poses[E.pose] ? E.pose : null;
      if (poseNow !== S.pose) { S.pose = poseNow; S.squash.x = 1.06; S.squash.v = -2.5; S.headRot.x = 0; S.headRot.v = 0; }
      S.squash.step(dt, sqT);
      S.air.step(dt, E.air || 0);
      S.headRot.step(dt, lookRot + (E.head || 0) - S.lean.x * .55 + wm * .02 * Math.sin(2 * Math.PI * cyc + 1));
      S.headLagY.step(dt, bobPx);
      const vLoc = S.vx * S.facing, aLoc = ax * S.facing;
      S.skirt.step(dt, -vLoc * pxPerWorld * .05 + wm * P.swish * Math.sin(2 * Math.PI * cyc - .9) + (E.shake || 0) * 120, -aLoc * pxPerWorld * .12);
      S.basket.step(dt, 0, aLoc / S.h * 3 + wm * 7 * Math.sin(2 * Math.PI * cyc + .6) + (E.shake || 0) * 60 + (E.air ? -S.air.v * .004 : 0));
      S.tail.step(dt, -.25 * clamp(vLoc / (P.speed * S.h), -1, 1) + .1 * Math.sin(t * 1.3) + .05 * Math.sin(t * 3.1) + (E.tail || 0) + wm * .18 * Math.sin(2 * Math.PI * cyc + 2));
      const armSwing = wm * P.armSwing * Math.sin(2 * Math.PI * cyc);
      S.armF.step(dt, (E.armF || 0) - armSwing + .03 * Math.sin(t * 1.7), aLoc / S.h * 2);
      S.armB.step(dt, (E.armB || 0) + armSwing - .03 * Math.sin(t * 1.5), aLoc / S.h * 2);
      const breath = 1 + .01 * Math.sin(t * 2.4);

      // feet: planted during stance, arcing forward during swing
      const feetOff = {};
      for (const f of rig.feet2) {
        const c = (cyc + f.phase) % 1, beta = P.duty, reach = P.reach;
        let dx, lift = 0, rot = 0;
        if (c < beta) { dx = reach * (.5 - c / beta); }
        else { const s = (c - beta) / (1 - beta); dx = reach * (-.5 + ease(s)); lift = Math.sin(Math.PI * s) * P.lift; rot = -.18 * Math.sin(Math.PI * s); }
        feetOff[f.name] = { dx: dx * wm, dy: -lift * wm, rot: rot * wm };
      }

      // ---------- compose transforms (painting px -> world) ----------
      const F = rig.feet;
      const air = S.air.x;
      const toWorld = (yOff) => M.mul(M.T(S.x, S.y), M.mul(M.S(S.flip / pxPerWorld, 1 / pxPerWorld), M.T(-F[0], -F[1] + yOff)));
      const feetRoot = toWorld(-air);
      const sq = S.squash.x * breath;
      const bodyLocal = M.mul(M.T(0, bobPx - air), M.about(F, M.mul(M.R(S.lean.x + rock + shift + (E.shake || 0)), M.S(1 / Math.sqrt(sq), sq))));
      const bodyRoot = M.mul(toWorld(0), bodyLocal);
      const P0 = S.pose ? poses[S.pose] : null;
      const headPivot = (P0 && P0.head && P0.head.pivot) || rig.head.pivot;
      const headScale = P0 && P0.headMotion != null ? P0.headMotion : 1;
      const head = M.mul(bodyRoot, M.mul(M.T(0, (S.headLagY.x - bobPx) * .6), M.about(headPivot, M.R(S.headRot.x * headScale))));
      const xf = {};
      for (const p of parts) {
        let m = bodyRoot;
        if (p.role === 'head') m = head;
        else if (p.role === 'foot') { const o = feetOff[p.name] || { dx: 0, dy: 0, rot: 0 }; m = M.mul(feetRoot, M.mul(M.T(o.dx, o.dy), M.about(p.pivot, M.R(o.rot)))); }
        else if (p.role === 'swing') m = M.mul(bodyRoot, M.about(p.pivot, M.R(S.basket.x)));
        else if (p.role === 'leg') { const o = feetOff[p.name] || { dx: 0, dy: 0 }; m = M.mul(feetRoot, M.mul(M.T(0, o.dy), M.about(p.pivot, [1, 0, o.dx / p.len, 1, 0, 0]))); }
        else if (p.role === 'arm') m = M.mul(bodyRoot, M.about(p.pivot, M.R(p.rest + (p.side === 'back' ? S.armB.x : S.armF.x))));
        xf[p.name] = m;
      }
      S.xf = xf; S.bodyRoot = bodyRoot; S.lift = air;
      S.face = { lidT: clamp(S.lidT.x, 0, 1), lidB: clamp(S.lidB.x, 0, 1), eyeS: S.eyeS.x, mouth: clamp(S.mouth.x, 0, 1.1), mouthW };
    }

    // ---------- draw ----------
    function draw(o = {}) {
      if (!S.xf) update(S.t || 0);
      const worldW = o.worldW || 1.5, worldH = o.worldH || 1;
      // optional camera: view = [centre x, centre y, zoom] in world units
      const V = o.view ? M.mul(M.T(worldW / 2, worldH / 2), M.mul(M.S(o.view[2], o.view[2]), M.T(-o.view[0], -o.view[1]))) : null;
      const zoom = o.view ? o.view[2] : 1;
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (o.shadow !== false) {
        const sp = K.shadow; gl.useProgram(sp.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, K.quad.b); gl.enableVertexAttribArray(sp.aUv); gl.vertexAttribPointer(sp.aUv, 2, gl.FLOAT, false, 0, 0);
        const lift = clamp(S.lift / IH * 4, 0, .5);
        gl.uniform2f(sp.u.uWorld, worldW, worldH);
        const sc = [S.x + rig.shadow[0] / IH * S.h * S.flip, S.y + .004];
        const c = V ? M.apply(V, sc) : sc;
        gl.uniform2f(sp.u.uC, c[0], c[1]);
        gl.uniform2f(sp.u.uR, S.h * rig.shadow[1] * (1 - lift * .5) * zoom, S.h * .05 * (1 - lift * .3) * zoom);
        gl.uniform1f(sp.u.uA, .3 * (1 - lift));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      const pp = K.part; gl.useProgram(pp.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, K.mesh.b); gl.enableVertexAttribArray(pp.aUv); gl.vertexAttribPointer(pp.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(pp.u.uWorld, worldW, worldH);
      const fire = o.fire ? (V ? M.apply(V, o.fire) : o.fire) : [-9, -9];
      gl.uniform2f(pp.u.uFire, fire[0], fire[1]); gl.uniform1f(pp.u.uFireAmt, o.fireAmt == null ? 0 : o.fireAmt);
      gl.uniform3f(pp.u.uInk, .17, .11, .07);
      gl.uniform1f(pp.u.uAlpha, o.alpha == null ? 1 : o.alpha);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pp.u.uTex, 0);
      const PZ = S.pose ? poses[S.pose] : null;
      const fc = (PZ && PZ.face) || rig.face, f = S.face;
      for (const p of parts) {
        const q = (PZ && PZ.parts[p.name]) || p;
        gl.bindTexture(gl.TEXTURE_2D, q.tex);
        gl.uniform4f(pp.u.uRect, q.x, q.y, q.w, q.h);
        gl.uniformMatrix3fv(pp.u.uM, false, M.mat3(V ? M.mul(V, S.xf[p.name]) : S.xf[p.name]));
        if (p.sway) gl.uniform4f(pp.u.uSway, S.skirt.x, p.sway[0], p.sway[1], 0); else gl.uniform4f(pp.u.uSway, 0, 0, 1, 0);
        if (p.bend) gl.uniform4f(pp.u.uBend, S.tail.x, p.bend[0], p.bend[1], p.bend[2]); else gl.uniform4f(pp.u.uBend, 0, 0, 0, 1);
        const isFace = p.role === 'head' && fc;
        gl.uniform1f(pp.u.uFace, isFace ? 1 : 0);
        if (isFace) {
          gl.uniform2f(pp.u.uEyeC, fc.eye[0], fc.eye[1]); gl.uniform2f(pp.u.uEyeR, fc.eyeR[0], fc.eyeR[1]);
          gl.uniform2f(pp.u.uLidSrc, fc.lidSrc[0], fc.lidSrc[1]);
          gl.uniform1f(pp.u.uLidT, f.lidT); gl.uniform1f(pp.u.uLidB, f.lidB); gl.uniform1f(pp.u.uEyeS, f.eyeS);
          gl.uniform2f(pp.u.uMouthC, fc.mouth[0], fc.mouth[1]); gl.uniform2f(pp.u.uMouthR, fc.mouthR[0], fc.mouthR[1]);
          gl.uniform1f(pp.u.uMouth, f.mouth); gl.uniform1f(pp.u.uMouthW, f.mouthW);
        }
        gl.drawArrays(gl.TRIANGLES, 0, K.mesh.n);
      }
    }

    function hit(x, y) {
      const w = S.h * rig.size[0] / IH * .55;
      const top = S.y - S.h * (rig.feet[1] - rig.top) / IH;
      return Math.abs(x - (S.x + (rig.centerX - rig.feet[0]) / IH * S.h * S.flip)) < w * .6 && y > top && y < S.y + .02;
    }

    return {
      place, walkTo, say, emote, lookAt, update, draw, hit, face,
      get x() { return S.x; }, get y() { return S.y; }, get h() { return S.h; }, set h(v) { S.h = v; },
      get facing() { return S.facing; }, get walking() { return S.mode !== 'idle'; }, get speaking() { return !!S.speech; },
      headTop() { return [S.x + (rig.centerX - rig.feet[0]) / IH * S.h * S.flip, S.y - S.h * (rig.feet[1] - rig.top) / IH]; },
      emotes: Object.keys(EMOTES), poses: Object.keys(poses), state: S
    };
  }

  window.Puppet = { create, rigs, M, Spring };
})();
