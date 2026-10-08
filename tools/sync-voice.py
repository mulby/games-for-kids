#!/usr/bin/env python3
"""Copy shared/voice.js into every game (and the launcher) so each index.html stays self-contained.

Run from the repo root after editing shared/voice.js:  python3 tools/sync-voice.py
"""
import glob, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
js = (root / "shared/voice.js").read_text().strip()
pages = {p: '../../voice/' for p in glob.glob(str(root / "*/*/index.html"))}
pages[str(root / "index.html")] = 'voice/'
block_re = re.compile(r'<script id="kid-voice"[^>]*>.*?</script>\n?', re.S)
for page, base in sorted(pages.items()):
    html = open(page).read()
    block = f'<script id="kid-voice" data-voice-base="{base}">\n{js}\n</script>\n'
    if block_re.search(html):
        new = block_re.sub(lambda m: block, html, count=1)
    else:
        anchor = "</head>" if "</head>" in html else "<script"
        new = html.replace(anchor, block + anchor, 1)
    if new != html:
        open(page, "w").write(new)
        print("updated", pathlib.Path(page).relative_to(root))
