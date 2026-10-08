#!/usr/bin/env python3
"""List the fixed lines each game speaks, for recording with tools/make-voice-clips.mjs.

Writes voice/lines.txt (one line per sentence, keyed the same way KidVoice looks clips up)
and prints how many characters that is, since ElevenLabs bills per character.
The fun/ mini games' random lines and card texts are collected too.
Lines built on the fly (with ${...}) are split into the pieces around each ${...}, and the
numbers 0-100 and math words are added, so lines with numbers can be stitched together.
Usage: python3 tools/collect-voice-lines.py
"""
import glob, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
CALL = re.compile(r'\b(?:say|speak|bubble|pipSay|KidVoice\.speak)\(\s*(["\'`])((?:\\.|(?!\1).)*?)\1', re.S)
SENT = re.compile(r'[^.!?]+[.!?]*')

def key(t):
    t = t.lower().replace("’", "'")
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()

lines = {}
# The break-time mini games (fun/) speak lines picked at random and their card texts, so for them
# every quoted sentence on a line that calls say( or sets a card's text: (or a msg) is collected.
STR = re.compile(r"""(['"`])((?:\\.|(?!\1).)*?)\1""")
def fun_lines(src):
    for line in src.splitlines():
        if re.search(r"\bsay\(|\btext:|\bmsg =|\bline =", line):
            for q, text in STR.findall(line):
                if "${" not in text and re.search(r"[A-Za-z]{2}.*[.!?]$", text):
                    yield q, text
pages = sorted(glob.glob(str(root / "math/*/index.html"))) + sorted(glob.glob(str(root / "fun/*/index.html")))
for page in pages:
    src = open(page).read()
    for q, text in (fun_lines(src) if "/fun/" in page else CALL.findall(src)):
        if "<" in text:
            continue
        text = text.replace("\\'", "'").replace('\\"', '"')
        # Template pieces between ${...} become their own clips, so KidVoice can stitch
        # "this lantern needs" + "7" + "fireflies". Pieces next to a name (not a number) won't match, which is fine.
        pieces = re.split(r"\$\{[^}]*\}", text) if "${" in text else [text]
        for s in (x for piece in pieces for x in SENT.findall(piece)):
            k = key(s)
            if k and k not in lines:
                lines[k] = s.strip()
for w in [str(n) for n in range(0, 101)] + ["plus", "minus", "equals", "and", "makes", "is", "take away", "times"]:
    lines.setdefault(w, w)

out = root / "voice/lines.txt"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(f"{k}\t{v}" for k, v in lines.items()) + "\n")
print(f"{len(lines)} lines, {sum(len(v) for v in lines.values())} characters -> {out.relative_to(root)}")
