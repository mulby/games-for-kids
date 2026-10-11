#!/usr/bin/env node
/* Bundle the recorded clips into a few "pack" files, so The Wonder Shelf artifact (at most 511 files)
   has room for every voice. Each clip is a whole mp3, so a pack is just the clips one after another;
   voice/manifest.json "packs" says where each clip starts and how long it is, and KidVoice
   (shared/voice.js) fetches a pack once and plays the clips out of it.

   node tools/pack-voice.mjs      # after tools/make-voice-clips.mjs; rewrites voice/packs/ */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'voice');
const manifestPath = path.join(dir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const MAX = 600 * 1024; // small enough to fetch quickly on an iPad the first time a clip from it is needed

const groups = [['main', Object.values(manifest.lines)]]
  .concat(Object.entries(manifest.voices || {}).map(([c, v]) => [c, Object.values(v.lines)]));
fs.rmSync(path.join(dir, 'packs'), { recursive: true, force: true });
fs.mkdirSync(path.join(dir, 'packs'));
const packs = {};
let count = 0;
for (const [name, files] of groups) {
  let n = 0, parts = [], size = 0;
  const flush = () => {
    if (!parts.length) return;
    const pack = `packs/${name}-${n++}.mp3`;
    let at = 0;
    for (const [f, buf] of parts) { packs[f] = [pack, at, buf.length]; at += buf.length; }
    fs.writeFileSync(path.join(dir, pack), Buffer.concat(parts.map(p => p[1])));
    count++; parts = []; size = 0;
  };
  for (const f of [...new Set(files)].sort()) {
    if (packs[f]) continue; // the same clip in two voices' tables
    const buf = fs.readFileSync(path.join(dir, f));
    if (size + buf.length > MAX) flush();
    parts.push([f, buf]); size += buf.length;
  }
  flush();
}
manifest.packs = packs;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(packs).length} clips in ${count} packs -> voice/packs/`);
