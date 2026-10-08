# Miu's Magic Pyramids

An Egypt-themed number puzzle game. Miu the temple cat needs help fixing pyramids that lost
stones in a sandstorm. In a magic pyramid, every stone equals the two stones under it added
together, so each puzzle is addition (and later, missing-addend subtraction) dressed up as a
sudoku-style logic puzzle.

Open `index.html` in Safari on the iPad (or add it to the Home Screen). Progress is saved in
`localStorage`.

## How it plays
- **Journey up the Nile:** six places, four pyramids each, each with a treasure for the Treasure Room.
  Giza (2 rows, to 5) → Saqqara (to 10, some bottom stones missing) → Karnak (3 rows) →
  Valley of the Kings (missing stones anywhere) → Abu Simbel (to 20) → The Hidden Tomb (4 rows).
- **Collecting:** 24 place treasures plus 12 lucky amulets from bonus pyramids at places she has
  finished (36 in all). The Treasure Room shows what's found and silhouettes of what's still hidden.
- **Placing stones:** tap or drag a blue number tile onto an empty stone.
- **No-fail feedback:** a wrong tile wiggles back and Miu gives a hint with a counting tablet
  (dots to count). After three tries on the same stone, the right tile wiggles.
- **Adaptive:** two or more slips on a pyramid makes the next ones at that place smaller and
  adds dots to every stone; two smooth pyramids in a row brings it back up.
- **Voice:** Miu reads every line aloud (speech synthesis), with a replay button. The speaker
  button turns sound and voice off.

## Design notes
Built around what research and good kids' games say makes learning games fun: the math *is* the
mechanic (no quiz-then-reward split), short sessions, choice of where to go, collectible rewards,
a character who talks to the child, and mistakes that cost nothing.

## Files
- `game.html` is the page body (also published as a claude.ai Artifact as-is).
- `build.sh` wraps it into the standalone `index.html`. Edit `game.html`, then run `./build.sh`.
