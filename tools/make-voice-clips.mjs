#!/usr/bin/env node
/* Record every line in voice/lines.txt with an ElevenLabs voice, so the games play real
   recordings instead of the iPad's built-in speech. The API key is only used here, on the
   computer that builds the games; the iPad just plays the mp3 files.

   python3 tools/collect-voice-lines.py                          # refresh voice/lines.txt
   ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs --voices   # list voices to choose from
   ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs <voice_id> # record (skips clips already made)

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

const voiceId = arg;
const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const lines = fs.readFileSync(path.join(dir, 'lines.txt'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const manifestPath = path.join(dir, 'manifest.json');
const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const manifest = { voice: voiceId, model, lines: old.voice === voiceId ? (old.lines || {}) : {} };
fs.mkdirSync(path.join(dir, 'clips'), { recursive: true });

let made = 0, chars = 0;
for (const [k, text] of lines) {
  const file = `clips/${crypto.createHash('sha1').update(voiceId + '|' + text).digest('hex').slice(0, 12)}.mp3`;
  if (manifest.lines[k] === file && fs.existsSync(path.join(dir, file))) continue;
  // Short number words sound clipped on their own; a trailing period gives them a natural ending.
  const say = /[.!?]$/.test(text) ? text : text + '.';
  const res = await api(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST',
    body: JSON.stringify({ text: say, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.2 } }),
  });
  if (!res.ok) { console.error(`Stopped at "${text}": ${res.status} ${await res.text()}`); break; }
  fs.writeFileSync(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
  manifest.lines[k] = file; made++; chars += say.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1)); // save as we go, so a stop keeps progress
  process.stdout.write(`\r${made} recorded`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`\nDone: ${made} new clips (${chars} characters), ${Object.keys(manifest.lines).length} total in voice/manifest.json`);
