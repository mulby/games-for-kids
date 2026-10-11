#!/usr/bin/env node
/* Record every line in voice/lines.txt with an ElevenLabs voice, so the games play real
   recordings instead of the iPad's built-in speech. The API key is only used here, on the
   computer that builds the games; the iPad just plays the mp3 files.

   python3 tools/collect-voice-lines.py                          # refresh voice/lines.txt
   ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs --voices   # list voices to choose from
   ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs <voice_id> # record the main voice (skips clips already made)
   ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs all        # main voice + every character in voice/voices.json
   node tools/pack-voice.mjs                                         # bundle the clips into a few files for the shelf

   Writes voice/clips/*.mp3 and voice/manifest.json, which KidVoice (shared/voice.js) reads. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'voice');
const key = process.env.ELEVENLABS_API_KEY;
const arg = process.argv[2];
if (!key || !arg) { console.error('Usage: ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs (--voices | <voice_id>)'); process.exit(1); }
const api = (p, init = {}) => fetch('https://api.elevenlabs.io' + p, { ...init, headers: { 'xi-api-key': key, 'content-type': 'application/json', ...init.headers } });

if (arg === '--voices') {
  const { voices } = await (await api('/v1/voices')).json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  ${Object.values(v.labels || {}).join(', ')}`);
  process.exit(0);
}

// "all" records the main voice and every character in voice/voices.json; a voice id records only the main voice.
const cast = JSON.parse(fs.readFileSync(path.join(dir, 'voices.json'), 'utf8'));
const voiceId = arg === 'all' ? cast.default : arg;
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const read = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const manifestPath = path.join(dir, 'manifest.json');
const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const manifest = { voice: voiceId, model, lines: old.voice === voiceId ? (old.lines || {}) : {}, voices: old.voices || {}, packs: old.packs || {} };
fs.mkdirSync(path.join(dir, 'clips'), { recursive: true });

let made = 0, chars = 0, stopped = false;
// Three requests at a time (the most the Starter plan allows at once).
async function record(id, lines, table) {
  const todo = lines.filter(([k, text]) => {
    const file = `clips/${crypto.createHash('sha1').update(id + '|' + text).digest('hex').slice(0, 12)}.mp3`;
    return !(table[k] === file && fs.existsSync(path.join(dir, file)));
  });
  async function one([k, text]) {
    if (stopped) return;
    const file = `clips/${crypto.createHash('sha1').update(id + '|' + text).digest('hex').slice(0, 12)}.mp3`;
    // Short number words sound clipped on their own; a trailing period gives them a natural ending.
    const say = /[.!?]$/.test(text) ? text : text + '.';
    const res = await api(`/v1/text-to-speech/${id}?output_format=mp3_44100_64`, {
      method: 'POST',
      body: JSON.stringify({ text: say, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.2 } }),
    });
    if (!res.ok) { console.error(`\nStopped at "${text}": ${res.status} ${await res.text()}`); stopped = true; return; }
    fs.writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
    table[k] = file; made++; chars += say.length;
    process.stdout.write(`\r${made} recorded`);
  }
  for (let i = 0; i < todo.length && !stopped; i += 3) {
    await Promise.all(todo.slice(i, i + 3).map(one));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1)); // save as we go, so a stop keeps progress
  }
}
await record(voiceId, read(path.join(dir, 'lines.txt')), manifest.lines);
if (arg === 'all') {
  for (const [c, info] of Object.entries(cast.characters)) {
    const f = path.join(dir, 'lines', c + '.txt');
    if (!fs.existsSync(f)) continue;
    const v = manifest.voices[c] = manifest.voices[c] && manifest.voices[c].voice === info.voice ? manifest.voices[c] : { voice: info.voice, lines: {} };
    await record(info.voice, read(f), v.lines);
  }
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`\nDone: ${made} new clips (${chars} characters), ${Object.keys(manifest.lines).length} in the main voice, ${Object.keys(manifest.voices).length} character voices`);
