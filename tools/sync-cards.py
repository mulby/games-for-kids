#!/usr/bin/env python3
"""Copy shared/cards.js into every game (and the launcher) so each index.html stays self-contained.

Run from the repo root after editing shared/cards.js:  python3 tools/sync-cards.py
"""
import glob, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
js = (root / "shared/cards.js").read_text().strip()
assert "</script" not in js.lower()
pages = sorted(glob.glob(str(root / "*/*/index.html"))) + [str(root / "index.html")]
block_re = re.compile(r'<script id="gfk-cards">.*?</script>\n?', re.S)
block = f'<script id="gfk-cards">\n{js}\n</script>\n'
for page in pages:
    html = open(page).read()
    if block_re.search(html):
        new = block_re.sub(lambda m: block, html, count=1)
    else:
        anchor = "</head>" if "</head>" in html else "<script"
        new = html.replace(anchor, block + anchor, 1)
    if new != html:
        open(page, "w").write(new)
        print("updated", pathlib.Path(page).relative_to(root))
