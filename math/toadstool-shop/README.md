# The Toadstool Shop

A gentle shop-keeping game. She is a little felt mouse who has been left a shop inside a big red toadstool
at the edge of Bramble Wood by Great-Aunt Clover. Every day she buys stock, serves the animals of the wood,
counts the till and saves up to make the shop her own. Every problem a shopkeeper meets is a math problem
pitched at her level.

## One day in the shop

| Part of the day | What she does | Math |
| --- | --- | --- |
| **Morning: Bramble's cart** | Bramble the hedgehog brings goods in bags of 2, boxes of 5 or crates of 10, at half the usual price. Everything on his cart is on one screen: she taps − and + for how many of each, and sees her till and how many pennies will be left (a row of pennies greys out as she spends). How much to buy is her decision: each good shows her notebook (what sold yesterday, how many more friends wanted after she ran out, how many thought the price too expensive). Then she works out how many that is and counts out the coins to pay. Her order is hers to change until she pays: the sum and the coins both have Change my order. | Equal groups and skip counting, counting coins, planning |
| **Price tags** | She sets the price of each thing. A higher price earns more on each one, but some animals buy fewer or none (a little above the usual price earns most; a lot above earns less). Cheaper means animals take extra. | Comparing, money |
| **Shop time** | Each animal arrives with a wish list. Her prices and her shelf decide what they actually buy: too expensive means fewer, sold out means a missed sale that goes in the notebook. She fills the basket, works out the price, then takes their coins: counting them, or (most of the time) giving change. | Counting, adding, taking away, money |
| **Special visitors** (from day 4) | Friends from the other games drop in: Captain Whiskers needs biscuits for his sailors, Miu the temple cat, Athena's owl. Each brings one bigger problem. | Equal groups, comparing, missing numbers |
| **Evening** | Count what is left on the shelf (fresh leftovers are pennies spent for nothing), then the profit: "I took in 18 and paid Bramble 8. How much did my shop earn?" Best day and total earned are kept, with cards at 20, 50, 100 and 200 pennies earned. Stack the till into tens. If she has fewer than 10, Aunt Clover's rainy-day tin tops it up to 10. | Taking away, tens and ones, teen numbers |
| **Saving up** | One purse ("My money", no separate jar since 2026-10-15). She always keeps 10 pennies for Bramble's cart, and anything above that can buy things she can see: on the "For my shop" shelf a shop sign, a striped awning, window boxes, lanterns, a bell, a cat bed; on the "For me" shelf clothes for her shopkeeper (she taps one to try it on, then buys it). | How many more, taking away |

Every new customer becomes a friend card in the binder; special visitors are Rare, and the Fairy Queen, who comes
to the grand reopening, is the game's Legendary card.

## The shopkeeper's wardrobe

She can change her shopkeeper's clothes any time with the 👗 button in the top bar: the dress colour (all five are free), and whatever she owns.
The list lives in `wardrobe.js` (shared by all three looks, and meant to be reused by any other clothes seller) and the save keeps `closet` (what she owns) and `keeper.wear` (what is on, by slot).

| Slot | Free | To buy (evening "For me" shelf) | Presents |
| --- | --- | --- | --- |
| Dress | flowery, plain | spotty 6¢, stripy 10¢, picnic check 14¢, hearts 17¢, starry 22¢ | |
| Head | white bow | pink or blue bow 4¢, straw sun hat 9¢, flower crown 12¢, sparkly tiara 25¢ | pirate hat (Captain Whiskers), laurel wreath (Athena's owl) |
| Neck | | knitted scarf 6¢, pearl necklace 16¢ | golden collar (Miu) |
| Nose | | round glasses 10¢ | |
| Back | | | fairy wings (the Fairy Queen) |
| Apron | shop apron (can come off) | | |

A special visitor leaves their present after their first visit and she puts it on at once; older saves get the presents of friends who already came.
Owning every piece of clothing earns the "Best Dressed in Bramble Wood" card.

## The village (from day 5)

After closing time on day 5 and later, she walks down the lane into Bramble Wood village. Tap a place on the map (or on the 3D lane) and her mouse walks there; "Back to my shop" walks her back to count the till. It is all optional: she can go straight home.

The village is busy: Mo, Wilf, Great-Aunt Clover and Bramble stroll up and down the lane and stop to chat (tap one and they wave and say hello), smoke curls from the chimneys, ducks paddle on the pond, a windmill turns behind the cottages further back. Mrs. Bunbury and Old Hoot ask her inside: their jobs happen in the burrow's kitchen and the library inside the oak. At the far end of the lane she has a little house of her own, with her bed, wardrobe (👗 change clothes) and fireplace, which fills up with the home things she buys from Tansy.

| Place | Who | What she does | Math |
| --- | --- | --- | --- |
| The burrow | Mrs. Bunbury | Count carrots planted in rows | Equal groups, skip counting |
| The oak library | Old Hoot | Count books in stacks of ten | Tens and ones |
| The fairy ring | Fern the fairy | How many more lanterns to light | How many more |
| The duck pond | Captain Whiskers | Count the coins in his chest | Counting coins |
| Dot's flower stall | Dot | Buy garden things that appear outside her shop (daisies 4¢ up to a fairy house 20¢) | Paying, change, taking away |
| Miu's treasure stall | Miu | Buy treasures from Egypt, the Greek gods, pirates and fairies for a ledge on her counter (3¢ to 16¢), each a binder card | Paying, change, taking away |
| Tansy's home things | Tansy | Buy things for her own house: a pot plant 3¢, tea set, meadow painting, cozy armchair, reading lamp, tall clock, tiny dollhouse, bed canopy 15¢ | Paying, change, taking away |
| My house | herself | See her home things ("3 things for my house, 5 more to find!"), change clothes | How many more |

Each job is two questions at her own level (the same strands as the shop), once per place per day, and pays 2 pennies plus the 1-penny first-try tip. The first job with a neighbour makes them a friend card. In the shops she can only spend what is above the 10 pennies she keeps for Bramble's cart, says "52 take away 4 leaves 48" after paying, and can always say "Not today". Every garden thing earns "Greenest Garden in the Wood"; every treasure earns "Treasure Hunter"; every home thing earns "Coziest House in the Wood". The save keeps `garden`, `treasures`, `home` and `village` (today's jobs). Lantern Tale and Pixel Valley have the same village, drawn in their own styles (octo-view.js, sdv-view.js).

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

## Guessing does not pay

Thinking is always the quickest way through, so tapping around stops being worth it. Nothing is taken away for a wrong answer.

- **Penny tips.** When every answer for a friend (filling the basket, the price, the coins, the change) is right on the first tap,
  the friend leaves a 1 penny tip, which goes into her money for decorations. Using the 💡 Help me button first is fine: counting
  the dots is real work, not guessing. The first time she misses a tip (from day 3) the shopkeeper says how tips work, and each
  evening she says how many tips came in. Tips are not part of "took in" in the profit question.
- **No free elimination.** A wrong number is swapped for a new wrong number, so there are still three choices and tapping each one
  in turn no longer finds the answer. (The two-choice riddle keeps greying out the wrong one.)
- **A short rest.** After a wrong tap the answers fade for about 2 seconds while the help opens. A wrong tap within 1.5 seconds of
  the answers appearing gets "Whoa, quick paws!" and a 3 second rest. The coins Done button rests for about 1 second after a miss.
- **Counting up for change.** After a wrong try at giving change, a strip counts up from the price to what was paid, lighting one
  number for each penny in the paw (Lantern Tale already shows this as the Wish Shield).
- After a second miss the answer still glows and the others fade, so she always finishes. Level-ups only count first tries, as before.

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
| P Tens and ones | 1-2 (start 1) | Stacking the till in tens |

## From counting to seeing (mental math)

She was counting everything one by one. The research path out of that (Clements and Sarama, Fuson, Baroody) is to see
numbers in chunks and lean on a few anchor facts: count on from the bigger number, doubles and near doubles, the partners
of 10, make 10, count back and count up. `mental.js` builds that into all three looks:

- **Ten-frames everywhere.** Every row of dots is drawn as ten-frames (rows of 5, frames of 10), with the empty cells
  showing, so 7 reads as "5 and 2" and "3 short of 10".
- **Help shows a trick, not "count them all".** Order totals, Bramble's bill, leftovers, the day's profit, the carrot rows,
  the fairy lanterns and Miu's halves each pick the strategy that fits the numbers: 8 + 5 shows 8 filling a ten-frame
  with 2 more, then 3 in the next frame; 9 + 2 shows a bag of 9 with two hops (10, ?); 12 - 9 counts up from 9.
  The shopkeeper thinks it out loud. From level 3 the pictures fade to a number sentence (8 + 2 = 10, 10 + 3 = ?).
- **Peek and cover.** Some pictures (carrot rows, Bramble's packs, the sailors, quick looks in the activities) show for
  about 3 seconds and then a cloth covers them. "Peek again" is free and unlimited, there is no timer on answering,
  and opening the help lifts the cloth for good.
- **Strategy charms.** A strategy-shaped question answered right the first time without help shows a small badge
  naming the trick ("You used a double!"). Three of a kind earn a charm card: Counting-On Boots, Count-Back Ladder,
  Count-Up Kite, Skip-Counting Stones, Doubles Mirror, Near-Double Twins, Ten Partners Locket, Bundle of Ten,
  Back-to-Ten Lantern, Make-Ten Wand, Quick-Look Spyglass, and Number Wizard for six of them. Counts are in `S.charms`.
- **Days off (from day 5).** Each morning she picks: open the shop, or a day off. A day off earns 2 pennies (3 when
  every answer was right the first time) and a card, and the shop stays shut, so stock keeps until tomorrow.
  - *Hide and Seek* with Mo's ten little brothers and sisters in Aunt Clover's ten-room dollhouse (a ten-frame).
    She closes her eyes, some hide under the blanket, and she works out how many are hiding from how many she can
    see: partners of 5, then 10, then 20 (two dollhouses). From level 3 the house is covered after a quick look.
    A new sibling card each time (ten in all). Levels: Taking away.
  - *Firefly Jars* with Fern at the fairy ring: fireflies glow in rows of five for a moment (a quick look), then
    two jars together (doubles, near doubles, make 10) and how many more fill a jar of ten. Five firefly cards.
  The choice screen lists `Mental.ACTIVITIES`, so another day-off activity can be added there.

## Files

- `index.html`: the game (rules, touch, saves, voice, cards). Saves to `localStorage["toadstoolShop.v1"]`.
- `wardrobe.js`: the shopkeeper's clothes list and helpers (also loaded by the Lantern Tale and Pixel Valley looks).
- `mental.js`: ten-frames, the strategy help, peek and cover, strategy charms and the day-off activities (also loaded by the other two looks). It uses the game's globals (`S`, `ask`, `talk`, `setPanel`, ...).
- `shop3d.js`: the 3D world: the toadstool shop inside and out, the shopkeeper mouse, every customer, the goods,
  coins and decorations. It reads the game's view (`window.TSV`) every frame and bakes the panel pictures
  (goods, coins, portraits, decorations) from the same models with the same lights (`window.Shop3D`).
  Add `?g3d=0` to play with plain pictures.
- `village3d.js`: the village lane and its places (her house, burrow, stall, oak library, treasure stall, fairy ring, pond, Tansy's stall), the cottages, windmill, ducks and chimney smoke, plus the garden and treasure models shown at the shop.
- `rooms3d.js`: the rooms inside the houses (Mrs. Bunbury's kitchen, Old Hoot's library, her own house) and the home things from Tansy's stall.
- `felt3d.js`: the richer felt kit the world is built from (three.js from `shared/vendor`). Felt fibre, normal and
  roughness textures made once at load (512px or less, shared); running stitches and seams; embroidered eyes and
  mouths; yarn whiskers; printed dresses with buttons; wood grain, wicker, glazed pots, crusty buns, embossed coins;
  the stitched toadstool, the shop room and the cart; a soft-shadow light rig with morning, evening and inside looks.
  Static parts are merged into a few vertex-coloured meshes so a scene stays under about 100 draw calls.
- `fonts/`: Comic Neue (SIL Open Font License, `fonts/OFL-ComicNeue.txt`), used where Chalkboard SE is missing.
- Debug: `window.__ts` (state and helpers), `window.__ts3d` (renderer stats; `__ts3d.settle(seconds)` runs walks and
  camera moves forward and draws once, for screenshots on slow software GL).
