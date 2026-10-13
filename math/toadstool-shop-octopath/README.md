# The Toadstool Shop: Lantern Tale

This is the same game as [`../toadstool-shop`](../toadstool-shop/README.md) with an "HD-2D" look: pixel-art sprites placed in a
painted diorama with depth of field, bloom, light shafts and floating motes, plus a navy-and-gold storybook interface. The math,
the days, the onramp and the gentle rules are the original game's, line for line. Read that README for the design of the game itself.

It uses the **same save** (`localStorage` key `toadstoolShop.v1`) and the **same card set** (`toadstool-shop`). A child can switch
between the two versions and keep her shop, jar and binder.

## Files

| File | What it is |
| --- | --- |
| `index.html` | A copy of `../toadstool-shop/index.html` with small hooks, listed below. |
| `octo-view.js` | The renderer (replaces `shop3d.js`). It draws to a 2D canvas, with no WebGL and no three.js. It reads `window.TSV` every frame and provides `window.Shop3D` (the sprite and icon baker the DOM uses). |
| `octo-art.js` | All the pixel art as code: the character generator (species templates, then a palette from the keeper/friend spec, then accessories and moods), coins, goods, decorations, icons and a tiny pixel font. |
| `skin.css` | The interface skin: navy windows with gold double borders and jewel corners, a name plate on the speech bubble, gold buttons, chapter cards, Boost pips, the Wish Shield and BREAK, and the level-up list. |
| `fonts/` | Cinzel (titles) and Andika (body, a font designed for early readers). These are self-hosted latin subsets with their OFL licence files. |

No network is needed. Everything loads from this folder and `../../shared/`.

## The look

- **Diorama.** The outside (toadstool house, path, Bramble's cart) and inside (shelves, counter, round window) are painted once
  into pixel layers on a 2x grid when the scene, time of day, stock or decorations change. Each frame then only composites them.
  - The back layer is pre-blurred, and a blurred copy over the top and bottom bands gives the tilt-shift.
  - Glow stamps ('lighter') light the windows, lanterns and fairy lights.
  - The 'screen' layer adds light shafts.
  - The colour grade changes with the time of day: morning, evening (warm, `body.dusk` turns the HUD sun into a moon) and night.
  - A baked vignette goes on top.
- **Cameras** ease between `outside`, `inside`, `meet` and `cart`. Each camera keeps a "core" rect (the characters) inside the
  band left free between the speech bubble and the panel, so faces are not hidden on phone, iPad or desktop.
- **Characters** are generated pixel sprites for every keeper option (mouse or cat, fur, dress) and every friend (hedgehog, rabbit,
  owl, fairy, ...):
  - They have idle, happy, talking and blinking frames, plus a breathing bob.
  - Customers walk in and out and queue.
  - The speaker's mouth moves while their line is up (`TSV.speaker`).
- **Every decoration bought shows in the scene:** the sign (a hanging blade sign with the shop's name), awning, window boxes,
  lanterns, bunting, bell, fairy lights, rug, vase, cat bed and the bigger shelf.
- **Story beats** (hook H6, display only):
  - Each morning opens with a chapter card ("Day 3 / Change for a Nickel"), and so does the evening ("The Lanterns Are Lit").
  - Under each question, 3 acorn **Boost pips** show the streak toward the next skill level.
  - When she gives change, the customer's **Wish Shield** counts up from the price to the coin they paid
    (`7 to 10`, and each coin added raises the number). When it reaches the paid amount, the
    shield breaks: **BREAK! Thank you!**
  - At night, skills that grew today are listed like a level-up ("Lv 2 ➜ 3, Up!").

## Hooks into the original index.html

These are kept small so the original game can be diffed and merged later:

1. **H1:** `import('./octo-view.js')` in place of `./shop3d.js`. The three.js importmap was removed.
2. **H2:** `<link rel="stylesheet" href="skin.css">` at the end of `<head>`.
3. **H3:** `walkIn`/`walkOut` set `TSV.custId`, so the renderer knows who is walking.
4. **H4:** `say()` sets `TSV.speaker`.
5. **H5:** The sparkle burst and the jar HUD chip use `Shop3D.icon(...)` when it exists, and keep the emoji otherwise.
6. **H6:** One block of story-beat helpers (chapter cards, Boost pips, Wish Shield, BREAK, level-up list), plus the calls to it in
   `morning()`, `evening()`, `night()`, `ask()` and the change task. Every one is display only. Answers, scoring, `record()`
   and the save format are unchanged. The shield shows counting up as a scaffold: the change math the child does is the same.

## Gentle and touch-first

- Nothing here has a timer. A chapter card hides itself after a few seconds, and a tap closes it sooner.
- BREAK only plays on a correct answer, and there is no fail effect.
- Buttons and tiles stay at 64px or more.
- Body text is Andika at 20px or more.
- There are compact layouts for phones (600px and 430px wide) and short screens (640px tall).
- `prefers-reduced-motion` turns off the motes, blinking, bob, hop, lantern flicker, BREAK shards and glow pulses, and holds the light shafts still.

## Performance

- The frame loop is capped at 30 fps and pauses when the tab is hidden.
- Device pixel ratio is capped at 1.5.
- All blur is pre-baked by scaling the canvas down and up. There is no per-frame `ctx.filter`.
- Particles are capped.
- In headless Chromium a frame costs about 0.3 to 2 ms. A full re-bake on a scene change costs 40 to 190 ms.
- `?g3d=0` (or `?gl=0`) skips the renderer and plays the original flat emoji version with the skin.
  The same fallback happens if the module fails to load.

## Debugging

`window.__ts3d` exposes `{ stats, A, cam, scene }`, where `stats.ms` is the average frame cost.
`Shop3D.sprite(spec, mood)` returns any character sprite as a data URL.

## Not done yet

- The HUD buttons (binder, sound, settings) and some button labels are still emoji.
- The card pack and binder use the shared emoji cards.
- Sprites only face front and only bob (there are no walk-cycle frames).
- On iPad landscape the panel can still cover the customer during the tallest tasks.
- The evening chapter card briefly covers the first evening question (a tap dismisses it).
- Voice lines are unchanged. `tools/collect-voice-lines.py` only scans the original folder, which is fine because the text is identical.
