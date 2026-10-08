/* KidVoice: one friendly voice for every game.
   Source of truth is shared/voice.js; tools/sync-voice.py copies it into each game
   so every index.html stays self-contained.

   1. Recorded clips first: if voice/manifest.json (made by tools/make-voice-clips.mjs)
      has a clip for a sentence, it plays that. Lines with numbers in them, like
      "7 plus 5" or "This lantern needs 7 fireflies", are stitched from shorter clips.
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
  // iPad Safari hides the Premium/Enhanced voices you download from web pages and often lists
  // only the robotic "Eloquence" voices. When nothing natural is listed, leave the voice unset so
  // iOS uses its own default English voice instead of us picking a robot.
  const NATURAL = 10;
  let chosen = null;
  function pick() {
    let pinned = null;
    try { pinned = localStorage.getItem('gfk-voice'); } catch (e) {}
    const list = ranked();
    if (pinned === 'default') return (chosen = null);
    chosen = (pinned && list.find(v => v.voiceURI === pinned || v.name === pinned)) || auto(list);
    return chosen;
  }
  function auto(list) { list = list || ranked(); return list[0] && score(list[0]) >= NATURAL ? list[0] : null; }
  const quality = v => /premium/i.test(v.voiceURI + v.name) ? 'Premium' : /enhanced/i.test(v.voiceURI + v.name) ? 'Enhanced' : '';
  if (synth) { pick(); try { synth.addEventListener('voiceschanged', pick); } catch (e) {} }

  /* ---- recorded clips ---- */
  let clips = null; // { base, lines: {key: file} }
  const base = (document.currentScript && document.currentScript.dataset.voiceBase) || '../../voice/';
  try {
    if (location.protocol !== 'file:') fetch(base + 'manifest.json').then(r => r.ok ? r.json() : null)
      .then(m => { if (m && m.lines) clips = { base, lines: m.lines }; }).catch(() => {});
  } catch (e) {}
  const key = t => String(t).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function clipPlan(text) {
    if (!clips) return null;
    const plan = [];
    for (const sentence of String(text).match(/[^.!?]+[.!?]*/g) || []) {
      const k = key(sentence); if (!k) continue;
      if (clips.lines[k]) { plan.push(clips.lines[k]); continue; }
      // Stitch lines built from a template, like "this lantern needs" + "7" + "fireflies".
      const parts = k.split(/\b(\d+)\b/).map(x => x.trim()).filter(Boolean);
      if (parts.length > 1 && parts.every(x => clips.lines[x])) { parts.forEach(x => plan.push(clips.lines[x])); continue; }
      return null; // one sentence without a recording: use speech for the whole line so it sounds even
    }
    return plan.length ? plan : null;
  }
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  let queue = [];
  function playNext() {
    if (!audio || !queue.length) return;
    audio.src = clips.base + queue.shift();
    audio.play().catch(() => { queue = []; });
  }
  if (audio) audio.addEventListener('ended', playNext);
  function stopClips() { queue = []; if (audio) try { audio.pause(); } catch (e) {} }
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
    const plan = clipPlan(text);
    if (plan) {
      if (!opts.queue) { try { synth && synth.cancel(); } catch (e) { stopClips(); } }
      const idle = !queue.length && (!audio || audio.paused || audio.ended);
      queue.push(...plan);
      if (idle) playNext();
      return;
    }
    if (!synth) return;
    try {
      if (!opts.queue) synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const v = chosen;
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      // A natural pitch: raised pitch is what made the old voice sound strained and creepy.
      u.rate = Math.min(1.05, Math.max(0.75, opts.rate || 0.92));
      u.pitch = Math.min(1.05, Math.max(0.95, opts.pitch || 1));
      synth.speak(u);
    } catch (e) {}
  }

  window.KidVoice = { speak, stop: () => { try { synth ? synth.cancel() : stopClips(); } catch (e) {} }, pick, auto, ranked, score, quality, current: () => chosen, key };
})();
