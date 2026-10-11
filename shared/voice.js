/* KidVoice: one friendly voice for every game.
   Source of truth is shared/voice.js; tools/sync-voice.py copies it into each game
   so every index.html stays self-contained.

   1. Recorded clips first: if voice/manifest.json (made by tools/make-voice-clips.mjs)
      has a clip for a sentence, it plays that. Lines with numbers or names in them, like
      "7 plus 5" or "This lantern needs 7 fireflies", are stitched from shorter clips.
      A character can have their own recorded voice: KidVoice.speak(text, { voice: 'bramble' }).
   2. Otherwise the device's own speech, using the most natural voice it has
      (Premium / Enhanced iPad voices first, never the novelty or robot voices).
   A grown-up can pin a voice from The Wonder Shelf; it is saved in localStorage["gfk-voice"]. */
(function () {
  if (window.KidVoice) return;
  const synth = window.speechSynthesis || null;
  const NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Kathy)\b/i;
  const ROBOTIC = /\b(Eddy|Flo|Reed|Rocko|Sandy|Shelley|Grandma|Grandpa)\b/i; // iOS "Eloquence" voices
  const FAVORITES = ['Ava', 'Zoe', 'Samantha', 'Allison', 'Susan', 'Nicky', 'Serena', 'Karen', 'Moira', 'Kate', 'Tessa', 'Evan', 'Nathan', 'Tom', 'Daniel'];

  function score(v) {
    const id = (v.name || '') + ' ' + (v.voiceURI || '');
    let s = 0;
    if (NOVELTY.test(v.name)) s -= 100;
    if (ROBOTIC.test(v.name)) s -= 60;
    if (/premium/i.test(id)) s += 60;
    else if (/enhanced/i.test(id)) s += 40;
    if (/siri/i.test(id)) s += 35;
    if (/Online \(Natural\)/i.test(id)) s += 45; // Edge
    if (/^Google/i.test(v.name)) s += 20;      // Chrome
    const fav = FAVORITES.findIndex(n => new RegExp('\\b' + n + '\\b', 'i').test(v.name));
    if (fav >= 0) s += 15 - fav * 0.5;
    if (/en[-_]US/i.test(v.lang)) s += 5; else if (/en[-_]GB/i.test(v.lang)) s += 4; else if (/en[-_](AU|IE|NZ|CA)/i.test(v.lang)) s += 3;
    if (v.default) s += 1;
    return s;
  }
  function voices() {
    try { return (synth && synth.getVoices() || []).filter(v => /^en/i.test(v.lang)); } catch (e) { return []; }
  }
  function ranked() { return voices().map(v => ({ v, s: score(v) })).sort((a, b) => b.s - a.s).map(x => x.v); }
  let chosen = null;
  function pick() {
    let pinned = null;
    try { pinned = localStorage.getItem('gfk-voice'); } catch (e) {}
    const list = ranked();
    chosen = (pinned && list.find(v => v.voiceURI === pinned || v.name === pinned)) || list[0] || null;
    return chosen;
  }
  if (synth) { pick(); try { synth.addEventListener('voiceschanged', pick); } catch (e) {} }

  /* ---- recorded clips ---- */
  // manifest: { lines: {key: file}, voices: {character: {lines}}, packs: {file: [pack, start, length]} }
  // Clips can be bundled into a few "pack" files (tools/pack-voice.mjs) so the shelf stays under its file limit.
  let clips = null;
  const base = (document.currentScript && document.currentScript.dataset.voiceBase) || '../../voice/';
  try {
    if (location.protocol !== 'file:') fetch(base + 'manifest.json').then(r => r.ok ? r.json() : null)
      .then(m => { if (m && m.lines) clips = { base, lines: m.lines, voices: m.voices || {}, packs: m.packs || {} }; }).catch(() => {});
  } catch (e) {}
  const key = t => String(t).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Cover a sentence with as few recorded pieces as possible, like "here is a bag of" + "5" + "acorn buns" + "for your shop".
  // Too many tiny pieces would sound choppy, so then it gives up and the device voice reads the line.
  function stitch(k, lines) {
    if (lines[k]) return [lines[k]];
    // Numbers past 100 are said in two pieces: 150 is "100" + "50".
    const w = k.split(' ').flatMap(t => /^[1-9]\d\d$/.test(t) && !lines[t] ? [String(t[0] * 100)].concat(+t.slice(1) ? [String(+t.slice(1))] : []) : [t]);
    const n = w.length, best = [[]];
    for (let i = 1; i <= n; i++) {
      for (let j = Math.max(0, i - 40); j < i; j++) {
        const f = best[j] && lines[w.slice(j, i).join(' ')];
        if (f && (!best[i] || best[j].length + 1 < best[i].length)) best[i] = best[j].concat(f);
      }
    }
    const p = best[n];
    return p && p.length <= Math.max(3, Math.ceil(n * 0.75)) ? p : null;
  }
  function planWith(text, lines) {
    const plan = [];
    for (const sentence of String(text).match(/[^.!?]+[.!?]*/g) || []) {
      const k = key(sentence); if (!k) continue;
      const p = stitch(k, lines);
      if (!p) return null; // one sentence without a recording: use one voice for the whole line so it sounds even
      plan.push(...p);
    }
    return plan.length ? plan : null;
  }
  // A character's own voice first (opts.voice, like "bramble"), then the main voice.
  function clipPlan(text, who) {
    if (!clips) return null;
    const own = who && clips.voices[who];
    return (own && planWith(text, own.lines)) || planWith(text, clips.lines);
  }
  const packs = {}, urls = {};
  function clipUrl(f) {
    const p = clips.packs[f];
    if (!p) return Promise.resolve(clips.base + f);
    if (!urls[f]) {
      packs[p[0]] = packs[p[0]] || fetch(clips.base + p[0]).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      urls[f] = packs[p[0]].then(b => URL.createObjectURL(new Blob([b.slice(p[1], p[1] + p[2])], { type: 'audio/mpeg' })));
      urls[f].catch(() => { delete urls[f]; delete packs[p[0]]; });
    }
    return urls[f];
  }
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  let queue = [], turn = 0, playing = false;
  function playNext() {
    if (!audio || !queue.length) { playing = false; return; }
    playing = true;
    const t = turn;
    clipUrl(queue.shift()).then(u => {
      if (t !== turn) return;
      audio.src = u;
      return audio.play();
    }).catch(() => { if (t === turn) { queue = []; playing = false; } });
  }
  if (audio) audio.addEventListener('ended', playNext);
  function stopClips() { queue = []; turn++; playing = false; if (audio) try { audio.pause(); } catch (e) {} }
  // Games call speechSynthesis.cancel() when they change screens; make that stop clips too.
  if (synth) try { const cancel = synth.cancel.bind(synth); synth.cancel = function () { stopClips(); cancel(); }; } catch (e) {}
  // iPad Safari only plays audio after a tap: unlock the player on the first touch.
  if (audio) document.addEventListener('pointerdown', function unlock() {
    document.removeEventListener('pointerdown', unlock, true);
    if (!audio.src) { audio.src = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='; audio.play().catch(() => {}); }
  }, true);

  function speak(text, opts) {
    opts = opts || {};
    if (!text) return;
    const plan = clipPlan(text, opts.voice);
    if (plan) {
      if (!opts.queue) { try { synth && synth.cancel(); } catch (e) { stopClips(); } }
      plan.forEach(f => clipUrl(f).catch(() => {})); // start unpacking every piece now, so they play without gaps
      queue.push(...plan);
      if (!playing) playNext();
      return;
    }
    if (!synth) return;
    try {
      if (!opts.queue) synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const v = chosen || pick();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      // A natural pitch: raised pitch is what made the old voice sound strained and creepy.
      u.rate = Math.min(1.05, Math.max(0.75, opts.rate || 0.92));
      u.pitch = Math.min(1.05, Math.max(0.95, opts.pitch || 1));
      synth.speak(u);
    } catch (e) {}
  }

  window.KidVoice = { speak, stop: () => { try { synth ? synth.cancel() : stopClips(); } catch (e) {} }, pick, ranked, score, current: () => chosen, key, plan: clipPlan };
})();
