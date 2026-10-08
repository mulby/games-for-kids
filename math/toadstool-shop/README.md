# The Toadstool Shop

A gentle shop-keeping game. She is a little felt mouse who has been left a shop inside a big red toadstool
at the edge of Bramble Wood by Great-Aunt Clover. Every day she buys stock, serves the animals of the wood,
counts the till and saves up to make the shop her own. Every problem a shopkeeper meets is a math problem
pitched at her level.

## One day in the shop

| Part of the day | What she does | Math |
| --- | --- | --- |
| **Morning: Bramble's cart** | Bramble the hedgehog brings goods in bags of 2, boxes of 5 or crates of 10. She chooses how many to buy (the shelf only has so much room, and her notebook remembers what friends asked for), works out how many that is, and counts out the coins to pay. | Equal groups and skip counting, counting coins, planning |
| **Shop time** | Animals come to the counter one at a time with an order. She fills the basket, works out the price from the price tags, then takes their coins: counting them, or giving change. | Counting, adding, taking away, money |
| **Special visitors** (from day 2) | Friends from the other games drop in: Captain Whiskers needs biscuits for his sailors, Miu the temple cat, Athena's owl. Each brings one bigger problem. | Equal groups, comparing, missing numbers |
| **Evening** | Count what is left on the shelf, stack the till pennies into tens, keep 10 for tomorrow's shopping and put the rest in the savings jar. | Taking away, tens and ones, teen numbers |
| **Saving up** | The jar fills toward upgrades she can see in 3D: a shop sign, a striped awning, window boxes, lanterns, a bell, a bigger shelf (more goods), a cat bed. | How many more, taking away |

Every new customer becomes a friend card in the binder; special visitors are Rare, and the Fairy Queen, who comes
to the grand reopening, is the game's Legendary card.

## Kept gentle on purpose

- No timers, no lives, no score for speed.
- She can never go broke: Great-Aunt Clover's rainy-day tin always tops the till back up to 10 pennies for the morning.
- Running out is a story beat, not a loss: the friend says "I'll come back tomorrow!" and it goes in her notebook.
- Over-buying is too: leftover buns go to the duck family, who quack a thank-you, and Bramble suggests buying fewer.
- A wrong answer never ends anything. The customer says "Let's count together", the help opens (dots, coins,
  counting up), and after a second try the answer is shown so she can tap it.

## Levels

Each kind of problem follows one Moonlit Map strand and level (1 = kindergarten to early 1st grade, 2 = end of 1st,
3 = early 2nd, 4 = mid 2nd). The game starts each strand just above her secure level on The Moonlit Map when that is
on the device, otherwise at the defaults below, moves up after 3 first-try answers in a row and down after 2 misses.

| Strand | Levels | In the shop |
| --- | --- | --- |
| N Number sense | 1-2 (start 2) | Filling the basket: up to 5, then up to 10 |
| A Adding | 1-4 (start 2) | Order totals within 5, 10, 20, then dimes and pennies |
| S Taking away | 1-4 (start 2) | Change within 5, 10, 20, then 2-digit; leftovers; savings |
| M Equal groups | 1-4 (start 1) | Bags of 2 (doubles), count by 2s, boxes of 5, crates of 10 |
| F Money | 1-4 (start 1) | Pennies, then dimes and pennies, then nickels |
| P Tens and ones | 1-2 (start 1) | Stacking the till in tens; keep 10, the rest to the jar |

## Files

- `index.html`: the game (rules, touch, saves, voice, cards). Saves to `localStorage["toadstoolShop.v1"]`.
- `shop3d.js`: the 3D world in the shared felt-toy style (`shared/toy3d.js`): the toadstool shop inside and out,
  the shopkeeper mouse, the customers and the goods. Goods pictures in the panels are baked from the same models.
  Add `?g3d=0` to play with plain pictures.
- Debug: `window.__ts` (state and helpers), `window.__ts3d` (renderer stats).
