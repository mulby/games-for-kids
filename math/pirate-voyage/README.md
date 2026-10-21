# The Shining Sea

A touch-first math voyage for iPad Safari. The player captains a ship around six islands of the Greek gods. Each god asks five short number puzzles; finishing an island earns a pack of collectible treasure cards (with a legendary card from the god the first time) and gold coins to spend on the ship and a decoratable captain's cabin.

| Island | Skill | Levels |
| --- | --- | --- |
| Poseidon's Pearl Harbor | Number partners | make 5 · make 10 with a ten-frame · make 10 without · make 20 |
| Hermes' Windy Isle | Adding | within 5 · within 10 · across 10 (8 + 5) · within 20 |
| Artemis' Moonlit Isle | Taking away | within 5 · within 10 · teens without regrouping · teens across 10 |
| Hephaestus' Forge Island | Tens and ones | build/count with gold bars of 10 and coins: teens · to 59 · to 99 |
| Athena's Owl Isle | Equal sides (meaning of =) | 7 = 4 + ? · 3 + 5 = 6 + ? · within 20, on a balance scale |
| Zeus' Thunder Peak, then the Open Sea | Mixed review | uses each skill's current level |

**No-fail feedback:** a wrong answer fades that choice, shows a visual clue (ten-frames, crossed-out animals, labelled gold bars, the scale tipping), and Pip the sea fairy explains it aloud. After two misses the right answer gently pulses.

**Adaptive:** per skill, two right-first-time answers in a row move up a level; two shaky questions in a row move down. Once a day each skill also checks the shared skills chart (`shared/skills.js`, every game together): skills at her level mastered anywhere move it up a level, struggling with them moves it down one. Grown-ups can see levels and accuracy behind the ⚙️ button.

**Read-aloud:** every prompt is spoken with the browser's speech voice (tap 🔊 to repeat), so reading ability doesn't gate the math.

**Collecting:** 42 cards in 7 sets (common, rare, legendary), a binder with silhouettes for missing cards, duplicate counts, friend cards that join the ship's crew. Each earned card is also appended to the shared `gfk-collection` localStorage list.

**Saving:** progress lives in `localStorage` under `shiningSeaVoyage.v1`.

**3D:** `world3d.js` draws the voyage in 3D with the shared felt-toy kit (`shared/toy3d.js`): a stylized animated sea shader, the six islands with Greek temples, columns, olive trees, a forge volcano and Thunder Peak, the player's toy ship (sails, flag and crew follow the shop choices), and felt gods with their symbols (Poseidon's trident, Athena's owl, Hermes' winged hat, Artemis' bow and moon, Hephaestus' hammer, Zeus' thunderbolt). `models3d.js` builds every model in code; emoji pictures of treasures, cards, cabin furniture and counting objects are swapped for baked 3D pictures. Game rules, touch, saves, voice and cards are untouched. `?g3d=0` (or `?gl=0`, or no WebGL) keeps the 2D look.

Files: `index.html` is the playable single-file game. `game.html` is the same game without the document wrapper (used for publishing as a Claude artifact).
