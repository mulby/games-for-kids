/* The shopkeeper's wardrobe, shared by all three looks of The Toadstool Shop.
   Clothes are bought with her money above the 10 pennies kept for Bramble's cart (the evening
   "For me" shelf), or given by a visiting friend. Data plus small helpers on the game's save S,
   so any other clothes seller (a shop in town, say) can sell from the same list.

   S.closet  ids she owns (free things are always hers and are not listed)
   S.keeper.wear  { print, head, neck, face, back, apron } what she has on, by slot (null = nothing)

   keeperSpec(S, FURS, DRESSES) turns that into the spec every renderer draws:
   { species, keeper: true, fur, dress, apron, print, acc: [...], bowColor } */
(function (G) {
  'use strict';
  const SLOTS = [
    ['print', 'My dress'],
    ['head', 'On my head'],
    ['neck', 'Round my neck'],
    ['face', 'On my nose'],
    ['back', 'On my back'],
    ['apron', 'My apron'],
  ];
  // acc: the accessory name the renderers draw; print: the dress fabric; they: said as "some ..." / "them"; css: tints the emoji. The first cost-free item of a slot is
  // what a new shopkeeper wears. Slots that may be empty (none: true) can be taken off with a second tap.
  const CLOTHES = [
    { id: 'flowers', slot: 'print', name: 'Flowery dress', emoji: '🌼', cost: 0, print: 'flowers' },
    { id: 'plain', slot: 'print', name: 'Plain dress', emoji: '👗', cost: 0, print: 'plain' },
    { id: 'dots', slot: 'print', name: 'Spotty dress', emoji: '⚪', cost: 6, print: 'dots' },
    { id: 'stripes', slot: 'print', name: 'Stripy dress', emoji: '🦓', cost: 10, print: 'stripes' },
    { id: 'gingham', slot: 'print', name: 'Picnic check dress', emoji: '🧺', cost: 14, print: 'gingham' },
    { id: 'hearts', slot: 'print', name: 'Heart dress', emoji: '💗', cost: 17, print: 'hearts' },
    { id: 'stars', slot: 'print', name: 'Starry dress', emoji: '⭐', cost: 22, print: 'stars' },

    { id: 'bow', slot: 'head', name: 'White bow', emoji: '🎀', css: 'filter:grayscale(1) brightness(1.45)', cost: 0, acc: 'bow', bowColor: '#ffffff' },
    { id: 'bow-pink', slot: 'head', name: 'Pink bow', emoji: '🎀', cost: 4, acc: 'bow', bowColor: '#f58fb1' },
    { id: 'bow-blue', slot: 'head', name: 'Blue bow', emoji: '🎀', css: 'filter:hue-rotate(200deg)', cost: 4, acc: 'bow', bowColor: '#7bb4e8' },
    { id: 'sunhat', slot: 'head', name: 'Straw sun hat', emoji: '👒', cost: 9, acc: 'sunhat' },
    { id: 'flowercrown', slot: 'head', name: 'Flower crown', emoji: '🌸', cost: 12, acc: 'flowercrown' },
    { id: 'tiara', slot: 'head', name: 'Sparkly tiara', emoji: '👑', cost: 25, acc: 'tiara' },
    { id: 'tricorn', slot: 'head', name: 'Pirate hat', emoji: '🏴‍☠️', gift: 'captain', acc: 'tricorn' },
    { id: 'leaves', slot: 'head', name: 'Laurel wreath', emoji: '🌿', gift: 'athena', acc: 'leaves' },

    { id: 'scarf', slot: 'neck', name: 'Knitted scarf', emoji: '🧣', cost: 6, acc: 'scarf', none: true },
    { id: 'pearls', slot: 'neck', name: 'Pearl necklace', emoji: '📿', cost: 16, acc: 'pearls', none: true },
    { id: 'collar', slot: 'neck', name: 'Golden collar', emoji: '🔶', gift: 'miu', acc: 'collar', none: true },

    { id: 'glasses', slot: 'face', name: 'Round glasses', emoji: '👓', cost: 10, acc: 'glasses', none: true },

    { id: 'wings', slot: 'back', name: 'Fairy wings', emoji: '🧚', gift: 'queen', acc: 'wings', none: true, they: true },

    { id: 'apron', slot: 'apron', name: 'Shop apron', emoji: '🧑‍🍳', cost: 0, none: true },
  ];
  const byId = id => CLOTHES.find(c => c.id === id) || null;
  const free = c => !c.gift && !c.cost;
  const DEFAULT = { print: 'flowers', head: 'bow', neck: null, face: null, back: null, apron: 'apron' };

  function wear(S) {
    const k = S.keeper; if (!k) return Object.assign({}, DEFAULT);
    k.wear = Object.assign({}, DEFAULT, k.wear || {});
    for (const [slot] of SLOTS) { const c = byId(k.wear[slot]); if (k.wear[slot] && (!c || c.slot !== slot || !owns(S, c.id))) k.wear[slot] = DEFAULT[slot]; }
    return k.wear;
  }
  function owns(S, id) { const c = byId(id); return !!c && (free(c) || (S.closet || []).includes(id)); }
  // Puts a thing on, or takes it off again if it is already on and the slot may be empty.
  // Returns 'on', 'off' or null (she does not own it).
  function put(S, id) {
    const c = byId(id); if (!c || !owns(S, id)) return null;
    const w = wear(S);
    if (w[c.slot] === id) { if (!c.none) return 'on'; w[c.slot] = null; return 'off'; }
    w[c.slot] = id; return 'on';
  }
  // spare: what she may spend (her money above the 10 for Bramble). Returns the cost, or 0 if she can't buy it.
  function buy(S, id, spare) {
    const c = byId(id); if (!c || !c.cost || owns(S, id) || spare < c.cost) return 0;
    (S.closet = S.closet || []).push(id); S.till -= c.cost; put(S, id); return c.cost;
  }
  function give(S, id) {
    const c = byId(id); if (!c || owns(S, id)) return false;
    (S.closet = S.closet || []).push(id); return true;
  }
  const giftFrom = who => CLOTHES.find(c => c.gift === who) || null;
  const forSale = S => CLOTHES.filter(c => c.cost && !owns(S, c.id));
  const allOwned = S => CLOTHES.every(c => owns(S, c.id));
  function keeperSpec(S, FURS, DRESSES) {
    const k = S.keeper; if (!k) return null;
    const w = wear(S), acc = [], spec = { species: 'mouse', keeper: true, fur: FURS[k.fur], dress: DRESSES[k.dress], apron: !!w.apron };
    for (const slot of ['head', 'neck', 'face', 'back']) { const c = byId(w[slot]); if (c && c.acc) { acc.push(c.acc); if (c.bowColor) spec.bowColor = c.bowColor; } }
    spec.acc = acc;
    spec.print = (byId(w.print) || {}).print || 'flowers';
    return spec;
  }
  G.ShopWardrobe = { SLOTS, CLOTHES, DEFAULT, byId, owns, wear, put, buy, give, giftFrom, forSale, allOwned, keeperSpec };
})(window);
