#!/usr/bin/env python3
"""List the fixed lines each game speaks, for recording with tools/make-voice-clips.mjs.

Writes voice/lines.txt (one line per sentence, keyed the same way KidVoice looks clips up)
and prints how many characters that is, since ElevenLabs bills per character.
The fun/ mini games' random lines and card texts are collected too.
Lines built on the fly (with ${...}) are split into the pieces around each ${...}, and the
numbers 0-100 and math words are added, so lines with numbers can be stitched together.
Usage: python3 tools/collect-voice-lines.py
"""
import glob, json, re, pathlib

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
# The Toadstool Shop calls say(who, text) and talk(who, text, button), often with a ternary or
# pick([...]) for the text, and its customers' greetings sit in CAST as hi: '...'. So on lines that
# talk or set hi:/thanks, every quoted string is collected: sentences ending in . ! or ?, and the
# pieces of template lines (button labels and names like 'bramble' have no end mark, so they're skipped).
# Each animal has their own voice (voice/voices.json), so each string is filed under who says it:
# say('bramble', ...) is Bramble, say(who, ...) is any customer, the shopkeeper and speak() use the main voice.
VOICES = json.loads((root / "voice/voices.json").read_text())
CUSTOMERS = ["hazel", "bunbury", "hoot", "mo", "dot", "tansy", "wilf", "captain", "miu", "athena", "queen"]
def literals(code):
    """Every string literal in a line of JS, with template literals split into the fixed pieces
    around each ${...}, including the strings nested inside a ${...} (like ` and earned ${n}`)."""
    out, i, n = [], 0, len(code)
    def tmpl(i):  # code[i] is the opening backtick; returns (pieces, index after the closing one)
        pieces, cur, i = [], "", i + 1
        while i < n and code[i] != "`":
            if code[i] == "\\" and i + 1 < n: cur += code[i:i + 2]; i += 2; continue
            if code.startswith("${", i):
                pieces.append(cur); cur = ""; i, inner = expr(i + 2); out.extend(inner); continue
            cur += code[i]; i += 1
        pieces.append(cur)
        return pieces, i + 1
    def expr(i):  # inside ${ ... }: returns (index after the matching }, nested literal pieces)
        depth, found = 1, []
        while i < n and depth:
            c = code[i]
            if c == "`": ps, i = tmpl(i); found.extend(ps); continue
            if c in "'\"":
                j = i + 1
                while j < n and code[j] != c: j += 2 if code[j] == "\\" else 1
                found.append(code[i + 1:j]); i = j + 1; continue
            depth += c == "{"; depth -= c == "}"; i += 1
        return i, found
    while i < n:
        c = code[i]
        if code.startswith("//", i): break
        if c == "`": ps, i = tmpl(i); out.extend(ps); continue
        if c in "'\"":
            j = i + 1
            while j < n and code[j] != c: j += 2 if code[j] == "\\" else 1
            out.append(code[i + 1:j]); i = j + 1; continue
        i += 1
    return out

# A piece is worth recording if it has words in it (not a CSS class, id or a lone name like 'bramble').
def spoken(t):
    t = t.strip()
    return bool(re.search(r"[A-Za-z]{2}", t)) and (" " in t or re.search(r"[.!?]$", t)) and not re.search(r"[<>{}=;#]|\b(?:px|var|div|span|class)\b", t)

# characters who borrow another's voice (index.html VOICE_OF): Fern the fairy speaks with Hazel's
SHARES = {"fern": "hazel"}

def shop_lines(src):
    for line in src.splitlines():
        if not re.search(r"\b(?:say|talk|speak)\(|\bhi: |\bthanks =|\b(?:q|prompt|coach): ", line):
            continue
        who = set()
        for w in re.findall(r"\b(?:say|talk)\(\s*'(\w+)'|\bwho: '(\w+)'", line):
            w = w[0] or w[1]
            who.add(None if w == "keeper" else w)
        if re.search(r"\b(?:say|talk)\(\s*who\b|\bthanks =|\bwho[,}]|\bwho: who\b", line):
            who.update(CUSTOMERS)
        m = re.match(r"\s*(\w+): \{.*\bhi: ", line)
        if m and SHARES.get(m.group(1), m.group(1)) in VOICES["characters"]:  # a cast line (a place line names its who: instead)
            who.add(m.group(1))
        if re.search(r"(?<![.\w])speak\(|\bcoach: ", line) or not who:
            who.add(None)
        for text in literals(line):
            if spoken(text):
                for w in who:
                    yield w, text

# Words that fill the gaps in the shop's template lines, so whole lines can be stitched together:
# the goods, packs, coins and names. Every character who talks about goods and money gets them.
def shop_words(src):
    goods = re.findall(r"one: '([^']+)', many: '([^']+)'", src)
    names = re.findall(r"'(\w+)'", re.search(r"const NAMES = \[([^\]]*)\]", src).group(1))
    decor = re.findall(r"name: '([^']+)', cost:", src)
    cards = re.findall(r"\[\d+, 'earn-\d+', '([^']+)'", src)
    words = [w for pair in goods for w in pair] + ["a", "and", "is", "are", "penny", "pennies", "a dime", "dimes", "a nickel",
        "bag", "bags", "box", "boxes", "crate", "crates", "a honey pot", "one", "is 1 penny"]
    return words, names, [d.lower() for d in decor], cards

lines = {}                      # the main voice
char_lines = {c: {} for c in VOICES["characters"]}
def add(table, s):
    k = key(s)
    if k and k not in table:
        table[k] = s.strip()
pages = sorted(glob.glob(str(root / "math/*/index.html"))) + sorted(glob.glob(str(root / "fun/*/index.html")))
for page in pages:
    src = open(page).read()
    found = fun_lines(src) if "/fun/" in page else shop_lines(src) if re.search(r"/toadstool-shop[^/]*/", page) else ((None, t) for q, t in CALL.findall(src))
    if "/fun/" in page:
        found = ((None, t) for q, t in found)
    for who, text in found:
        if "<" in text:
            continue
        text = text.replace("\\'", "'").replace('\\"', '"')
        # Template pieces between ${...} become their own clips, so KidVoice can stitch
        # "this lantern needs" + "7" + "fireflies".
        pieces = re.split(r"\$\{[^}]*\}", text) if "${" in text else [text]
        for s in (x for piece in pieces for x in SENT.findall(piece)):
            if re.search(r"[${}:>]", s):  # bits of code caught between nested ${...}
                continue
            add(lines if who is None else char_lines[SHARES.get(who, who)], s)
    if re.search(r"/toadstool-shop[^/]*/", page):
        words, names, decor, cards = shop_words(src)
        for w in words + names + [n + "'s shop" for n in names] + decor + cards:
            add(lines, w)
        the = ["the " + w for w in words[:words.index("a")] + decor]  # "the apples are 2 pennies", "the lanterns costs 24"
        for w in the:
            add(lines, w)
        for c in char_lines:
            for w in words + (names + the if c in ("bramble", "clover") else []):
                add(char_lines[c], w)
# Pieces the scan above can't see (joined on the fly, like the 'the' in ${i ? 'the' : 'The'}), found by playing
# the shop with voice on and listing the sentences that had no recording. "voice<TAB>text"; voice is main or a character.
for row in (root / "voice/extra-lines.txt").read_text().splitlines():
    if "\t" in row and not row.startswith("#"):
        who, text = row.split("\t", 1)
        add(lines if who == "main" else char_lines[who], text)
numbers = [str(n) for n in range(0, 101)] + [str(n) for n in range(200, 1000, 100)]
for w in numbers + ["plus", "minus", "equals", "and", "makes", "is", "take away", "times", "penny", "pennies"]:
    lines.setdefault(w, w)
for c, table in char_lines.items():
    if table:
        for w in numbers:
            table.setdefault(w, w)

out = root / "voice/lines.txt"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(f"{k}\t{v}" for k, v in lines.items()) + "\n")
print(f"{len(lines)} lines, {sum(len(v) for v in lines.values())} characters -> {out.relative_to(root)}")
(root / "voice/lines").mkdir(exist_ok=True)
for c, table in char_lines.items():
    if table:
        f = root / f"voice/lines/{c}.txt"
        f.write_text("\n".join(f"{k}\t{v}" for k, v in table.items()) + "\n")
        print(f"{len(table)} lines, {sum(len(v) for v in table.values())} characters -> {f.relative_to(root)}")
