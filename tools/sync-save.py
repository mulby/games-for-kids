#!/usr/bin/env python3
"""Copy shared/save-sync.js into the launcher (index.html) as <script id="gfk-save">.

Run from the repo root after editing shared/save-sync.js:  python3 tools/sync-save.py
Games need no changes: they keep writing localStorage, and the launcher copies it to the db.
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
page = root / "index.html"
js = (root / "shared/save-sync.js").read_text().rstrip() + "\n"
html = page.read_text()
block = '<script id="gfk-save">\n' + js + '</script>\n'
block_re = re.compile(r'<script id="gfk-save">.*?</script>\n?', re.S)
new = block_re.sub(lambda m: block, html, count=1) if block_re.search(html) else html.replace("</body>", block + "</body>", 1)
if new != html:
    page.write_text(new)
    print("updated index.html")
