# Games for Kids

Story-driven learning games that run in a browser (built for an iPad).

Open `index.html` (The Wonder Shelf) to pick a game. Every collectible card a game awards is also saved to
`localStorage["gfk-collection"]`, and the shelf shows them all in one card binder (works when the games share one origin, e.g. GitHub Pages).

## Math
| Folder | Game | Skills |
| --- | --- | --- |
| `math/moonlit-map/` | **The Moonlit Map**: gentle adaptive skills check across six lands, with a grown-ups summary. Start here. | All, kindergarten to 3rd grade |
| `math/fairy-lantern-festival/` | **Fairy Lantern Festival**: fill lanterns with fireflies on ten-frames; decorate Teapot Cottage | Counting, making ten, teen numbers, tens and ones |
| `math/gemling-grids/` | **Gemling Grids**: kid sudoku/KenKen with crystal creatures and Nib the mole | Logic, addition, missing addends |
| `math/egypt-puzzles/` | **Miu's Magic Pyramids**: addition pyramids with Miu the temple cat | Addition, missing addends |
| `math/mouse-shop/` | **Acorn Bakery**: run a mouse bakery in Bramblewick Hollow | Counting, bonds to 10, add and subtract within 20 |
| `math/pirate-voyage/` | **The Shining Sea**: sail the islands of the Greek gods | Number partners, add/subtract within 20, tens and ones, equal sides |

Each game is one self-contained `index.html` that saves progress in localStorage and has a press-and-hold "Grown-ups" view.

## Voice
All games read aloud through one shared helper, `shared/voice.js` (copied into each game by `python3 tools/sync-voice.py`, so edit the shared file and re-run that).
It picks the most natural voice the device has (Premium or Enhanced iPad voices first), and a grown-up can pin a voice on The Wonder Shelf.
For recorded voices: `python3 tools/collect-voice-lines.py` lists the lines, then `ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs <voice_id>`
records them into `voice/`. The games play those clips when they exist and fall back to the device voice for anything not recorded.

## Reading
Coming later.
