// Grandpa Burdock, cut from the Canva cane painting (1088 x 1456). Arms and cane stay painted into the body;
// gestures are painted pose swaps (see poses), not rotated limbs.
Puppet.rigs.grandpa = {
  size: [1088, 1456],
  feet: [570, 1360],
  top: 81, centerX: 580,
  shadow: [40, .24],
  head: { pivot: [600, 470] },
  voicePitch: .8,
  face: { eye: [683, 310], eyeR: [21, 15], lidSrc: [-46, 0], mouth: [815, 432], mouthR: [14, 13] },
  walk: { speed: .38, accel: 2.5, cycle: 300, duty: .62, reach: 80, lift: 16, bob: 4, rock: .025, swish: 0, armSwing: 0 },
  feet2: [{ name: 'legB', phase: 0 }, { name: 'legF', phase: .5 }],
  parts: [
    { name: 'tail', img: 'grandpa_tail.png', x: 76, y: 978, w: 272, h: 401, bend: [336, 1000, 300] },
    { name: 'legB', img: 'grandpa_legB.png', x: 328, y: 958, w: 264, h: 422, role: 'leg', pivot: [450, 1045], len: 320 },
    { name: 'legF', img: 'grandpa_legF.png', x: 536, y: 958, w: 211, h: 338, role: 'leg', pivot: [650, 1045], len: 290 },
    { name: 'body', img: 'grandpa_body.png', x: 142, y: 334, w: 766, h: 1035 },
    { name: 'head', img: 'grandpa_head.png', x: 401, y: 77, w: 554, h: 404, role: 'head' },
    { name: 'collar', img: 'grandpa_collar.png', x: 390, y: 366, w: 518, h: 175 }
  ],
  poses: {
    pointUp: {
      head: { pivot: [520, 420] }, headMotion: .35,
      face: { eye: [527, 212], eyeR: [19, 16], lidSrc: [-44, 6], mouth: [686, 207], mouthR: [12, 11] },
      parts: {
        body: { img: 'grandpa_point_body.png', x: 66, y: 0, w: 874, h: 1369 },
        head: { img: 'grandpa_point_head.png', x: 248, y: 52, w: 522, h: 376 },
        collar: { img: 'grandpa_point_collar.png', x: 317, y: 235, w: 462, h: 253 }
      }
    }
  }
};
