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

## Break Time (just for fun)
Short, no-math 3D games for a break between practice games. The shelf offers one after about four minutes of
practice (`WORK_FOR_BREAK` in `index.html`), and each one then gives a single bonus for that break.
| Folder | Game | Bonus after practice |
| --- | --- | --- |
| `fun/bubble-garden/` | **Bubble Garden**: pop Posy the fairy's bubbles to free firefly friends | extra golden bubbles |
| `fun/mouse-house/` | **Hazel's House**: decorate a Maileg-style mouse room, drag things around, day and night | a parcel with new furniture |
| `fun/treasure-dig/` | **Treasure Dig**: rub sand away with Miu the cat to find Egyptian treasures for her museum | a rare treasure |

They share `shared/funkit.js` (stage, touch, sparkles, sounds, cards) on top of the felt-toy kit `shared/toy3d.js`.
The break note lives in `localStorage["gfk-break"]` (`{work, earned, used}`).

## Voice
All games read aloud through one shared helper, `shared/voice.js` (copied into each game by `python3 tools/sync-voice.py`, so edit the shared file and re-run that).
It picks the most natural voice the device has (Premium or Enhanced iPad voices first), and a grown-up can pin a voice on The Wonder Shelf.
For recorded voices: `python3 tools/collect-voice-lines.py` lists the lines, then `ELEVENLABS_API_KEY=... node tools/make-voice-clips.mjs <voice_id>`
records them into `voice/`. The games play those clips when they exist and fall back to the device voice for anything not recorded.

## Cards and the binder
`shared/cards.js` (GFKCards) gives every game the same card look and pack-opening moment. Games call
`GFKCards.collect({game, id, name, emoji, rarity})`; new cards wait in a glowing pack button until she taps it.
Rarities: Common, Rare, Shiny (holo) and Legendary. Chance is kind: a card can come out Shiny (at least one in
every 7 packs), and some packs hold a bonus Wonder Charm (at least one in every 3 packs, never a duplicate).
The best are saved for last: each game's finale card is Legendary, and Crown Cards unlock at 8, 20, 35, 55
and 80 cards. The pack opening and the big binder viewer draw the card in WebGL (3D tilt, holo foil and gold shaders,
glitter, light rays and sparks), falling back to the CSS cards when WebGL is missing. Nothing is bought or lost. After editing `shared/cards.js`, run `python3 tools/sync-cards.py`
to copy it into every page.

## 3D art
Fairy Lantern Festival is drawn in real 3D with Three.js (vendored in `shared/vendor/`, no network needed).
Every model is built in code in one soft felt-toy style, so there are no image files or art licences to track:
`shared/toy3d.js` is the shared kit (felt, gloss, metal and glass materials, fairies, fireflies, trees, mushrooms,
a model baker and helpers that keep draw calls low for older iPads). The game's rules, touch, saves, voice and
cards are unchanged; `math/fairy-lantern-festival/world3d.js` puts a 3D scene behind the page, keeps 3D fireflies,
lanterns and fairies glued to their buttons, and bakes still things (jars, petals, cottage furniture from
`decor3d.js`) into images. Add `?g3d=0` to the address to see the old 2D look.

## Reading
Coming later.
