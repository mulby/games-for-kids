# The Toadstool Shop

A gentle shop-keeping game. She is a little felt mouse who has been left a shop inside a big red toadstool
at the edge of Bramble Wood by Great-Aunt Clover. Every day she buys stock, serves the animals of the wood,
counts the till and saves up to make the shop her own. Every problem a shopkeeper meets is a math problem
pitched at her level.

## One day in the shop

| Part of the day | What she does | Math |
| --- | --- | --- |
| **Morning: Bramble's cart** | Bramble the hedgehog brings goods in bags of 2, boxes of 5 or crates of 10, at half the usual price. How many to buy is her decision: her notebook shows what sold yesterday, how many more friends wanted after she ran out, and how many thought the price too expensive. She works out how many that is and counts out the coins to pay. | Equal groups and skip counting, counting coins, planning |
| **Price tags** | She sets the price of each thing. A higher price earns more on each one, but some animals buy fewer or none (a little above the usual price earns most; a lot above earns less). Cheaper means animals take extra. | Comparing, money |
| **Shop time** | Each animal arrives with a wish list. Her prices and her shelf decide what they actually buy: too expensive means fewer, sold out means a missed sale that goes in the notebook. She fills the basket, works out the price, then takes their coins: counting them, or (most of the time) giving change. | Counting, adding, taking away, money |
| **Special visitors** (from day 4) | Friends from the other games drop in: Captain Whiskers needs biscuits for his sailors, Miu the temple cat, Athena's owl. Each brings one bigger problem. | Equal groups, comparing, missing numbers |
| **Evening** | Count what is left on the shelf (fresh leftovers are pennies spent for nothing), then the profit: "I took in 18 and paid Bramble 8. How much did my shop earn?" Best day and total earned are kept, with cards at 20, 50, 100 and 200 pennies earned. Stack the till into tens, choose to keep 10 or 20 for tomorrow's shopping (more stock, or more savings), and put the rest in the jar. | Taking away, tens and ones, teen numbers |
| **Saving up** | The jar fills toward upgrades she can see in 3D: a shop sign, a striped awning, window boxes, lanterns, a bell, a bigger shelf (more goods), a cat bed. | How many more, taking away |

Every new customer becomes a friend card in the binder; special visitors are Rare, and the Fairy Queen, who comes
to the grand reopening, is the game's Legendary card.

## The first days (onramp)

The first trip through the shop is very easy on purpose. Every skill starts at level 1 (The Moonlit Map is not used to start higher), and the shop teaches one new thing a day:

- **Day 1:** Bramble hands over one bag of 2 acorn buns, and she pays 1 penny. Two friends each buy 1 bun and pay with exact pennies. No price tags, no change, no sums to work out: Bramble and the shopkeeper say the totals.
- **Day 2:** she chooses how many bags to buy, and apples join. Bramble still says the totals.
- **Day 3:** giving change starts.
- **Day 4:** price tags, the notebook and the special visitors arrive, then the full shop.

The first time she meets each control (answer buttons, the basket, paying, giving change) a yellow hint says what to tap, and the button glows.

## Kept gentle on purpose

- No timers, no lives, no score for speed.
- She can never go broke: Great-Aunt Clover's rainy-day tin always tops the till back up to 10 pennies for the morning.
- Running out is a story beat, not a loss: the friend says "I'll come back tomorrow!" and it goes in her notebook.
- Over-buying is too: leftover buns go to the duck family, who quack a thank-you. A day that earns nothing is "I'll try again", never a loss screen.
- A wrong answer never ends anything. The customer says "Let's count together", the help opens (dots, coins,
  counting up), and after a second try the answer is shown so she can tap it.

## Levels

Each kind of problem follows one Moonlit Map strand and level (1 = kindergarten to early 1st grade, 2 = end of 1st,
3 = early 2nd, 4 = mid 2nd). The game starts every strand at level 1, moves up after 3 first-try answers in a row and down after 2 misses.

After the onramp the shop also gets slowly harder as the days go by: from day 7 a fifth regular friend on days after she has been
getting at least 70% right, orders with up to 3 kinds of goods once her adding is past level 1, and every 3 days (up to
day 13) the smallest orders get a little bigger within her adding level. A strand that has not moved for 3 days moves up one level overnight when at least 70% of its
answers in those days were right first time; it still drops after 2 misses, so a hard patch never piles up.

| Strand | Levels | In the shop |
| --- | --- | --- |
| N Number sense | 1-2 (start 1) | Filling the basket: up to 5, then up to 10 |
| A Adding | 1-4 (start 1) | Order totals within 5, 10, 20, then dimes and pennies |
| S Taking away | 1-4 (start 1) | Change within 5, 10, 20, then 2-digit; leftovers; savings |
| M Equal groups | 1-4 (start 1) | Bags of 2 (doubles), count by 2s, boxes of 5, crates of 10 |
| F Money | 1-4 (start 1) | Pennies, then dimes and pennies, then nickels |
| P Tens and ones | 1-2 (start 1) | Stacking the till in tens; keep 10, the rest to the jar |

## Files

- `index.html`: the game (rules, touch, saves, voice, cards). Saves to `localStorage["toadstoolShop.v1"]`.
- `shop3d.js`: the 3D world: the toadstool shop inside and out, the shopkeeper mouse, every customer, the goods,
  coins and decorations. It reads the game's view (`window.TSV`) every frame and bakes the panel pictures
  (goods, coins, portraits, decorations) from the same models with the same lights (`window.Shop3D`).
  Add `?g3d=0` to play with plain pictures.
- `felt3d.js`: the richer felt kit the world is built from (three.js from `shared/vendor`). Felt fibre, normal and
  roughness textures made once at load (512px or less, shared); running stitches and seams; embroidered eyes and
  mouths; yarn whiskers; printed dresses with buttons; wood grain, wicker, glazed pots, crusty buns, embossed coins;
  the stitched toadstool, the shop room and the cart; a soft-shadow light rig with morning, evening and inside looks.
  Static parts are merged into a few vertex-coloured meshes so a scene stays under about 100 draw calls.
- `fonts/`: Comic Neue (SIL Open Font License, `fonts/OFL-ComicNeue.txt`), used where Chalkboard SE is missing.
- Debug: `window.__ts` (state and helpers), `window.__ts3d` (renderer stats; `__ts3d.settle(seconds)` runs walks and
  camera moves forward and draws once, for screenshots on slow software GL).
