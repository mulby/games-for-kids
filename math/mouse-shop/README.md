# Acorn Bakery (mouse shop)

A cozy math game for an 8-year-old. She is a baker mouse (she picks the fur, apron and name) running a bakery in Bramblewick Hollow, a hedgerow village. Animal neighbours come in with orders, and every order is a small math puzzle. Everything is read aloud, and wrong answers get gentle help instead of a penalty. Acorns earned in the bakery buy treasures for her mouse house.

Open `index.html` in Safari on the iPad (one file, no build). Progress is saved in the browser with localStorage.

## Kinds of orders

| Order | Math | Levels |
| --- | --- | --- |
| Pack a basket | Counting out 1 to 10, then two kinds at once | 6 |
| Fill a party box | Making 5 and 10 (number bonds) | 4 |
| Add up price tags | Addition within 6, 10, then 18 | 5 |
| Give change | Take-away within 5, 10, then 20 | 4 |

Every customer starts on the level stored for that skill. Two or three first-try answers in a row move a skill up; two orders in a row that needed help move it down. Filling boxes and prices unlock at counting level 3, and change unlocks at price level 3.

## Grown-ups page

The small "Grown-ups" link on the title screen shows each skill's current level in plain words (a rough assessment), first-try accuracy, toggles for sound and read-aloud, and buttons to nudge levels or start over.

## Why it is built this way

- The math is the action itself (packing, filling, paying), not a quiz in between fun parts.
- Ten-frames and dot price tags let her see amounts before she has to hold them in her head; the hints fade as levels rise.
- No lives, timers or fail states. A wrong answer gets "Let's count together", then a scaffold showing where each item goes.
- Short sessions: a bakery day is 6 customers, followed by the reward of decorating the house.
- Collecting, like trading cards: every animal she serves gives her a numbered friend card (common, uncommon or rare, with stars at 1, 3 and 6 visits). Six rare visitors such as a unicorn, a little dragon and a pirate octopus turn up now and then, and repeat visits can drop a holographic sparkly card. New cards flip in with a reveal. They are also added to the shared `gfk-collection` localStorage list that all the games use.
- Dollhouse decorating: treasures bought with acorns can be dragged anywhere in the mouse house, and their spots are saved.
