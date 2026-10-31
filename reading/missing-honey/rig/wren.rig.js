// Wren Hollyhock, cut from the Canva painting (816 x 1092). Coordinates are painting pixels.
Puppet.rigs.wren = {
  size: [816, 1092],
  feet: [452, 1000],          // ground point between the feet
  top: 44, centerX: 430,      // for hit testing and speech bubbles
  shadow: [0, .2],
  head: { pivot: [452, 366] },
  voicePitch: 1.25,
  face: { eye: [495.5, 260.5], eyeR: [21, 19], lidSrc: [-46, 0], mouth: [557, 330], mouthR: [14, 13] },
  walk: { speed: .75, accel: 4, cycle: 300, duty: .58, reach: 118, lift: 18, bob: 5, rock: .03, swish: 9, armSwing: 0 },
  feet2: [{ name: 'footB', phase: 0 }, { name: 'footF', phase: .5 }],
  parts: [
    { name: 'tail', img: 'wren_tail.png', x: 65, y: 877, w: 224, h: 124, bend: [208, 896, 190] },
    { name: 'footB', img: 'wren_footB.png', x: 299, y: 880, w: 125, h: 144, role: 'foot', pivot: [335, 960] },
    { name: 'footF', img: 'wren_footF.png', x: 460, y: 874, w: 140, h: 122, role: 'foot', pivot: [492, 950] },
    { name: 'body', img: 'wren_body.png', x: 138, y: 305, w: 572, h: 713, sway: [600, 945] },
    { name: 'basket', img: 'wren_basket.png', x: 400, y: 577, w: 200, h: 208, role: 'swing', pivot: [482, 566] },
    { name: 'head', img: 'wren_head.png', x: 229, y: 44, w: 436, h: 325, role: 'head' },
    { name: 'collar', img: 'wren_collar.png', x: 269, y: 331, w: 372, h: 98 }
  ]
};
