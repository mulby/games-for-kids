# The Toadstool Shop: Pixel Valley

The same shop-keeping math game as [The Toadstool Shop](../toadstool-shop/README.md), drawn as a cozy farm-sim
pixel game: 3/4 top-down scenes in chunky 16-pixel art, wooden menu boxes, a parchment dialogue box with a framed
portrait and a name plaque, a date, time and gold clock in the corner, and inventory slots for goods and coins.

The rules, the math, the levels, the voice lines and the cards are the original game's, unchanged. It shares the
original's save (`localStorage["toadstoolShop.v1"]`) and card set (`toadstool-shop`), so she can switch looks and
carry on the same shop, and no card is ever awarded twice.

## What is pixel here

- **Scenes.** The meadow with the red toadstool house, its path, pond, trees and fences; the shop inside with the
  mushroom-red wall, the 3x3 shelf (up to ten of each good shown on its bay), the counter with the blue till,
  basket and door; Bramble's striped cart in the morning; dusk with lamp-lit windows and fireflies for the evening
  and night. One whole-number pixel scale is used for every scene and every camera; the cameras (the shop, the
  close-up on the shopkeeper, Bramble's cart) pan and never zoom, so pixels stay square and crisp.
- **Everyone has a sprite and a portrait:** the shopkeeper in all 20 fur and dress choices (palette swaps), Bramble,
  Hazel, Mrs. Bunbury, Old Hoot, Mo, Dot, Tansy, Wilf, Captain Whiskers, Miu, Athena's owl, the Fairy Queen (who
  hovers with sparkles) and Great-Aunt Clover (portrait only). Sprites breathe, step when they walk, hop when happy
  and show a heart or question bubble.
- **Goods, coins and decorations** for the panels are drawn from the same art: real-sized coins (the nickel is the
  biggest, the dime the smallest), shelf-sized minis of every good, and all ten decorations. Everything bought with
  the savings jar appears in its scene (sign, vase, awning, rug, window boxes, bell, lanterns, bunting, cat bed,
  fairy lights).
- **Ideas from the farm-sim look that fit without changing the math:**
  - Friendship hearts. Each shopper has five hearts. Each visit fills half a heart, and a "+½ heart" note pops up.
    These are kept in `localStorage["toadstoolShop.sdv.hearts"]` and are only for show.
  - The night summary is a day's tally like a shipping box: each good sold × its price, took in, paid Bramble, earned.
    The numbers are the same as the original's summary tags.
  - A "Level up!" banner drops in when a skill strand goes up a level (it never shows going down).

## Files

- `index.html`: a copy of `../toadstool-shop/index.html` with small hooks marked `skin hook`:
  - it loads `skin.css` and imports `sdv-view.js` instead of `shop3d.js`;
  - it uses `icon()` and `emo()` to swap a few emoji for pixel icons;
  - it calls `skin()` events for the HUD, speech, serving and level ups;
  - it sets `TSV.custId` and `TSV.speaker`;
  - `tallyHTML()` draws the night tally.
  
  Nothing else changed: the rules, timings, speech text, `__ts` and `DBG` are the same.
- `sdv-art.js`: all the art as code. It is the mockup kit's sprite painter and tiles, plus the character builder,
  which puts together a species head, a body and accessories from a cast spec. It also has the portraits, goods,
  coins, icons, decorations and scene pieces. No image files.
- `sdv-view.js`: the view. It draws `window.TSV` every frame into a small buffer at 1 art pixel per pixel, then
  scales it up by a whole number onto `canvas#gl3d`. It installs `window.Shop3D` (`good`, `coin`, `portrait`,
  `decor`, `icon`) and answers the skin events.
  - It runs at about 30 frames a second, or 10 with reduced motion, and pauses while the tab is hidden.
  - Static ground and room layers are drawn once.
  - With `prefers-reduced-motion`, walks are instant and nothing bobs, drifts or twinkles.
- `skin.css`: the wooden or parchment look for the HUD, dialogue box, panel, buttons, slots, coins, tally, toast
  and banner. Its frames are 9-slice pixel SVGs drawn at whole-number scales. On screens up to 900px tall
  (an iPad held sideways), a tighter layout makes every task fit the panel without scrolling. That includes eight
  price tags in two columns, the ten decorations in two rows of five, and a two-column night tally.
- `fonts/`: self-hosted Pixelify Sans and Jersey 10 (latin subsets), SIL Open Font License, see `fonts/OFL.txt`.

Add `?g3d=0` to play without pictures (emoji), as in the original. Debug: `window.__ts` (game state and helpers),
`window.__ts3d` (scale, camera, actors, hearts).
