/* GFKCards: one card look, one pack-opening moment and one lucky-draw system for every game.
   Source of truth is this file; tools/sync-cards.py copies it into each game and the shelf
   as the "gfk-cards" script block so every index.html stays self-contained.

   Games call GFKCards.collect({game, id, name, emoji, rarity}) when she earns a card.
   It writes the card to the shared "gfk-collection" list (same shape as before), then:
   - Luck: a common or rare card can come out Shiny (holo). Never fewer than one Shiny in 7 packs.
   - Bonus: some packs also hold a Wonder Charm from a shared set, never a duplicate.
     Never more than 3 packs in a row without one.
   - Saved for last: each game's finale card is Legendary, and Crown Cards unlock at
     8, 20, 35, 55 and 80 cards collected across every game.
   Nothing is ever bought or lost. New cards wait in a glowing pack button; tapping it opens them.
   GFKCards.face(card) draws a card; GFKCards.view(cards, i) opens the big swipeable viewer. */
(function () {
  if (window.GFKCards) return;
  const KEY = "gfk-collection", LUCK = "gfk-cards-luck";
  const TIERS = { common: 0, rare: 1, sparkly: 2, legendary: 3 };
  const TIER_NAME = { common: "Common", rare: "Rare", sparkly: "Shiny", legendary: "Legendary" };
  const TIER_GEMS = { common: "●", rare: "◆◆", sparkly: "✦✦✦", legendary: "👑" };
  const SETS = {
    "moonlit-map": { name: "The Moonlit Map", icon: "🗺️", a: "#9fb4f0", b: "#3d5bb0" },
    "fairy-lantern-festival": { name: "Lantern Festival", icon: "🏮", a: "#f6c6ec", b: "#a24e93" },
    "gemling-grids": { name: "Crystal Caves", icon: "💎", a: "#a9eadf", b: "#2b7f75" },
    "egypt-puzzles": { name: "Miu's Pyramids", icon: "🔺", a: "#ffe3a1", b: "#c08523" },
    "mouse-shop": { name: "Acorn Bakery", icon: "🥐", a: "#f5d2b0", b: "#9a6038" },
    "pirate-voyage": { name: "The Shining Sea", icon: "⚓", a: "#a9dcf5", b: "#235f8c" },
    "toadstool-shop": { name: "The Toadstool Shop", icon: "🍄", a: "#ffc9c9", b: "#c23f55" },
    "wonder-charms": { name: "Wonder Charms", icon: "🍀", a: "#d9ccff", b: "#6a4fc4" },
    "wonder-crowns": { name: "Crown Cards", icon: "👑", a: "#fff0b3", b: "#c9931a" }
  };
  // Each game's very last reward is its Legendary card.
  const FINALES = { "egypt-puzzles": ["hidden-3"], "gemling-grids": ["card-r-moonFinale"], "fairy-lantern-festival": ["starwing"], "pirate-voyage": ["sea:5"], "mouse-shop": ["mouse-shop-moonbeam-the-unicorn-sparkly"], "toadstool-shop": ["friend-queen"] };
  const CROWNS = [
    { at: 8, id: "scarab", name: "The Golden Scarab", emoji: "🪲" },
    { at: 20, id: "fairy-queen", name: "The Fairy Queen", emoji: "🧚" },
    { at: 35, id: "crystal-dragon", name: "The Crystal Dragon", emoji: "🐉" },
    { at: 55, id: "moon-pegasus", name: "The Moon Pegasus", emoji: "🦄" },
    { at: 80, id: "wonder-crown", name: "The Crown of Wonders", emoji: "👑" }
  ];
  const CHARMS = [
    ["clover", "🍀", "Four-Leaf Clover", "common"], ["shell", "🐚", "Mermaid Shell", "common"], ["toadstool", "🍄", "Fairy Toadstool", "common"],
    ["moon", "🌙", "Moon Pebble", "common"], ["feather", "🪶", "Owl Feather", "common"], ["daisy", "🌼", "Daisy Chain", "common"],
    ["cupcake", "🧁", "Mouse-Size Cupcake", "common"], ["ribbon", "🎀", "Silk Ribbon", "common"], ["bell", "🔔", "Fairy Bell", "common"],
    ["teapot", "🫖", "Tiny Teapot", "common"], ["coin", "🪙", "Pirate Coin", "common"], ["compass", "🧭", "Lucky Compass", "common"],
    ["ladybird", "🐞", "Ladybird", "common"], ["acorn", "🌰", "Golden Acorn", "common"],
    ["butterfly", "🦋", "Rainbow Butterfly", "rare"], ["crystal", "🔮", "Crystal Ball", "rare"], ["amphora", "🏺", "Greek Amphora", "rare"],
    ["key", "🗝️", "Skeleton Key", "rare"], ["owl", "🦉", "Athena's Owl", "rare"], ["bastet", "🐈", "Bastet the Cat", "rare"],
    ["rainbow", "🌈", "Bottled Rainbow", "sparkly"], ["diamond", "💎", "Pirate Diamond", "sparkly"], ["star", "⭐", "Wishing Star", "sparkly"],
    ["wand", "🪄", "Fairy Wand", "sparkly"]
  ];
  const CHARM_WEIGHT = { common: 70, rare: 24, sparkly: 6 };
  const SHINY_CHANCE = { common: 0.12, rare: 0.2 }, SHINY_PITY = 7, BONUS_CHANCE = 0.3, BONUS_PITY = 3;

  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tierOf = c => (c && TIERS[c.rarity] != null ? c.rarity : "common");
  const keyOf = c => (c.game || "") + "/" + (c.id || c.name);
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  function list() {
    const v = ls.get(KEY, []);
    if (!Array.isArray(v)) return [];
    return v.filter(x => x && typeof x === "object").map(x => (FINALES[x.game] || []).includes(x.id) ? Object.assign({}, x, { rarity: "legendary" }) : x);
  }

  /* ---------- card face ---------- */
  function face(c, opts) {
    opts = opts || {};
    const set = SETS[c.game] || { name: "Treasures", icon: "⭐", a: "#eadcc4", b: "#8a6a45" };
    const t = tierOf(c);
    const cls = ["gfc", "t-" + t, c.shiny ? "shiny" : "", opts.big ? "big" : "", opts.isNew ? "is-new" : ""].join(" ");
    return `<div class="${cls}" style="--a:${set.a};--b:${set.b}" role="img" aria-label="${esc(c.name)}, ${TIER_NAME[t]} card from ${esc(set.name)}">
      <div class="gfc-in">
        <div class="gfc-top"><span class="gfc-name">${esc(c.name || "Card")}</span></div>
        <div class="gfc-art"><span class="gfc-rays"></span><span class="gfc-emo">${esc(c.emoji || "⭐")}</span></div>
        <div class="gfc-bot"><span class="gfc-set">${set.icon} ${esc(set.name)}</span><span class="gfc-gem">${TIER_GEMS[t]}</span></div>
      </div>
      <div class="gfc-foil"></div><div class="gfc-glare"></div>
      ${opts.isNew ? '<span class="gfc-new">NEW</span>' : ""}
    </div>`;
  }
  function locked(crown) {
    return `<div class="gfc t-locked" role="img" aria-label="Locked Crown Card"><div class="gfc-in">
      <div class="gfc-top"><span class="gfc-name">Crown Card</span></div>
      <div class="gfc-art"><span class="gfc-emo">🔒</span></div>
      <div class="gfc-bot"><span class="gfc-set">Unlocks at ${crown.at} cards</span></div></div></div>`;
  }

  /* ---------- sounds ---------- */
  let AC = null;
  function tone(freq, at, dur, type, vol) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + at;
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function soundsOn() { try { return localStorage.getItem("gfk-card-sound") !== "off"; } catch (e) { return true; } }
  function chime(t) {
    if (!soundsOn()) return;
    const notes = { common: [523, 659, 784], rare: [523, 659, 784, 1047], sparkly: [587, 740, 880, 1175, 1480], legendary: [392, 523, 659, 784, 1047, 1319, 1568] }[t];
    notes.forEach((f, i) => { tone(f, i * 0.09, 0.5, "triangle", 0.1); if (t !== "common") tone(f * 2, i * 0.09 + 0.03, 0.4, "sine", 0.04); });
    if (t === "legendary") [523, 659, 784].forEach(f => tone(f, notes.length * 0.09 + 0.1, 1.4, "sine", 0.07));
  }
  const rustle = () => { if (soundsOn()) [180, 140, 220].forEach((f, i) => tone(f, i * 0.07, 0.12, "sawtooth", 0.03)); };

  /* ---------- styles ---------- */
  const CSS = `
.gfc,.gfc *,.gfk-ov *,.gfk-view *,.gfk-packbtn{box-sizing:border-box}
.gfc{--a:#eee;--b:#888;--mx:50%;--my:50%;--rx:0deg;--ry:0deg;position:relative;container-type:inline-size;aspect-ratio:5/7;width:100%;border-radius:7%/5%;
  background:linear-gradient(160deg,#fffdf7,#efe6d6);padding:4.5%;box-shadow:0 2px 0 #0002,0 6px 14px #0002;overflow:hidden;isolation:isolate;
  font-family:"Grandstander","Andika","Trebuchet MS",system-ui,sans-serif;color:#2c2118;user-select:none;-webkit-user-select:none;transform:perspective(700px) rotateX(var(--rx)) rotateY(var(--ry));}
.gfc-in{position:relative;height:100%;display:flex;flex-direction:column;gap:3cqw;border-radius:4cqw;padding:3.5cqw;background:linear-gradient(170deg,var(--a),color-mix(in srgb,var(--a) 55%,var(--b)));box-shadow:inset 0 0 0 1.2cqw #fff8}
.gfc-top{display:flex;align-items:center;justify-content:center;min-height:15cqw;background:#fffc;border-radius:3cqw;padding:1cqw 3cqw}
.gfc-name{font-weight:800;font-size:9.5cqw;line-height:1;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.gfc-art{position:relative;flex:1;border-radius:4cqw;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(circle at 50% 45%,#fff 0,color-mix(in srgb,var(--a) 70%,#fff) 35%,var(--b) 110%);box-shadow:inset 0 0 0 1cqw #fff9,inset 0 -4cqw 8cqw #0002}
.gfc-art::before{content:"";position:absolute;inset:0;opacity:.25;background-image:radial-gradient(circle,#fff 0 1.2cqw,transparent 1.5cqw);background-size:14cqw 14cqw}
.gfc-emo{position:relative;font-size:40cqw;line-height:1;filter:drop-shadow(0 2.5cqw 2cqw #0004)}
.gfc-rays{position:absolute;inset:-50%;display:none;background:repeating-conic-gradient(from 0deg,#fff5 0 8deg,transparent 8deg 20deg)}
.gfc-bot{display:flex;align-items:center;justify-content:space-between;gap:2cqw;font-weight:800;font-size:6.5cqw;line-height:1.1}
.gfc-set{background:#fffc;border-radius:99px;padding:1.2cqw 3cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.gfc-gem{color:#fff;text-shadow:0 .5cqw 0 #0005;white-space:nowrap;font-size:7.5cqw}
.gfc-foil,.gfc-glare{position:absolute;inset:0;pointer-events:none;border-radius:inherit}
.gfc-new{position:absolute;top:5cqw;right:-9cqw;transform:rotate(35deg);background:#e83f6f;color:#fff;font-weight:800;font-size:7cqw;padding:1cqw 12cqw;box-shadow:0 1cqw 2cqw #0003}
.gfc.t-common{background:linear-gradient(160deg,#fffdf7,#e9dfcd)}
.gfc.t-rare{background:linear-gradient(150deg,#e8f0ff,#6f8fe6 50%,#dfe8ff)}
.gfc.t-rare .gfc-glare{background:linear-gradient(115deg,transparent 30%,#fff5 45%,transparent 60%);background-size:250% 250%;background-position:var(--mx) var(--my)}
.gfc.t-sparkly{background:linear-gradient(130deg,#ffd1f0,#c3f0ff,#fff3b0,#d6c8ff,#ffd1f0);background-size:300% 300%;animation:gfc-pan 6s linear infinite}
.gfc.t-sparkly .gfc-foil{mix-blend-mode:color-dodge;opacity:.42;
  background:repeating-linear-gradient(110deg,#ff6ec7 0,#ffe66e 8%,#6effa8 16%,#6ed8ff 24%,#c06eff 32%,#ff6ec7 40%),radial-gradient(circle,#fff 0 .6cqw,transparent .8cqw);
  background-size:300% 300%,7cqw 7cqw;background-position:var(--mx) var(--my),0 0;animation:gfc-foil 5s ease-in-out infinite}
.gfc.t-sparkly .gfc-glare,.gfc.t-legendary .gfc-glare{background:radial-gradient(circle at var(--mx) var(--my),#fff9,transparent 45%);mix-blend-mode:overlay}
.gfc.t-sparkly .gfc-gem{color:#fff}
.gfc.t-sparkly .gfc-in{background:linear-gradient(160deg,color-mix(in srgb,var(--a) 70%,#ffd1f0),color-mix(in srgb,var(--a) 50%,#c3e8ff) 50%,color-mix(in srgb,var(--a) 60%,#fff0a8))}
.gfc.t-legendary{background:conic-gradient(from var(--spin,0deg),#ffd75e,#fff6c2,#e7a91d,#ffcf3f,#fff6c2,#c98a12,#ffd75e);animation:gfc-spin 4s linear infinite;
  box-shadow:0 0 0 2px #fff8,0 0 16px #ffd54f,0 6px 18px #0003}
.gfc.t-legendary .gfc-in{background:linear-gradient(170deg,#fff4c9,#ffd36b 60%,#e9a52a);box-shadow:inset 0 0 0 1.2cqw #fffa}
.gfc.t-legendary .gfc-art{background:radial-gradient(circle at 50% 45%,#fff3c0 0,#ffc93f 35%,#d98a12 75%,#8a4f06 120%)}
.gfc.t-legendary .gfc-rays{display:block;animation:gfc-rot 14s linear infinite}
.gfc.t-legendary .gfc-foil{mix-blend-mode:color-dodge;opacity:.28;
  background:radial-gradient(circle,#fff 0 .7cqw,transparent 1cqw),repeating-linear-gradient(120deg,#ffef9a 0,#ff9de0 10%,#9ae7ff 20%,#ffef9a 30%);
  background-size:9cqw 9cqw,300% 300%;background-position:0 0,var(--mx) var(--my);animation:gfc-foil 5s ease-in-out infinite}
.gfc.shiny .gfc-top::after{content:"✨";margin-left:1.5cqw;font-size:8cqw}
.gfc.t-locked{background:linear-gradient(160deg,#d8cfbf,#b6aa96);box-shadow:none;opacity:.8}
.gfc.t-locked .gfc-in{background:repeating-linear-gradient(45deg,#cbbfa9 0 4cqw,#c1b49d 4cqw 8cqw)}
.gfc.t-locked .gfc-art{background:#0001}.gfc.t-locked .gfc-emo{font-size:26cqw;filter:none;opacity:.7}
.gfc.t-locked .gfc-set{font-size:6cqw;white-space:normal;text-align:center;width:100%}
@property --spin{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes gfc-spin{to{--spin:360deg}}
@keyframes gfc-rot{to{transform:rotate(360deg)}}
@keyframes gfc-pan{50%{background-position:100% 100%}}
@keyframes gfc-foil{0%,100%{background-position:0% 30%,0 0}50%{background-position:100% 70%,0 0}}

.gfk-packbtn{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:99990;width:78px;height:96px;border:0;padding:0;border-radius:14px;cursor:pointer;
  background:linear-gradient(150deg,#ffe27a,#ff9ec7 50%,#9ad8ff);box-shadow:0 0 0 4px #fff,0 8px 22px #0005;font:800 15px/1.1 "Grandstander",system-ui,sans-serif;color:#4a2a55;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;animation:gfk-bob 1.6s ease-in-out infinite;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.gfk-packbtn b{font-size:34px;line-height:1}
.gfk-packbtn i{position:absolute;top:-10px;right:-10px;min-width:30px;height:30px;border-radius:15px;background:#e83f6f;color:#fff;font-style:normal;display:grid;place-items:center;box-shadow:0 0 0 3px #fff;font-size:16px}
@keyframes gfk-bob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-8px) rotate(4deg)}}

.gfk-ov{position:fixed;inset:0;z-index:99995;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:16px;
  background:radial-gradient(circle at 50% 40%,#3a2a6a,#120c24 70%);color:#fff;font-family:"Grandstander","Andika",system-ui,sans-serif;text-align:center;
  touch-action:none;-webkit-tap-highlight-color:transparent;opacity:0;transition:opacity .25s;overflow:hidden}
.gfk-ov.on{opacity:1}
.gfk-ov::before{content:"";position:absolute;inset:0;opacity:.6;pointer-events:none;
  background-image:radial-gradient(1.5px 1.5px at 10% 20%,#fff,transparent),radial-gradient(2px 2px at 70% 15%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 70%,#fff,transparent),radial-gradient(2px 2px at 85% 60%,#fff,transparent),radial-gradient(1.5px 1.5px at 25% 85%,#fff,transparent),radial-gradient(1.5px 1.5px at 55% 35%,#fff,transparent)}
.gfk-ov .msg{position:relative;font-weight:800;font-size:clamp(22px,5vw,34px);min-height:1.3em;text-shadow:0 3px 0 #0006;max-width:20em}
.gfk-ov .sub{position:relative;font-size:18px;opacity:.85;min-height:1.4em}
.gfk-stage{position:relative;width:min(68vw,330px,calc((100dvh - 230px) * 5 / 7));aspect-ratio:5/7}
.gfk-flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.3,1.4,.5,1)}
.gfk-flip.open{transform:rotateY(180deg)}
.gfk-flip>*{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.gfk-flip>.front{transform:rotateY(180deg)}
.gfk-back{border-radius:5%;border:5px solid #fff;display:grid;place-items:center;font-size:clamp(60px,18vw,110px);box-shadow:0 10px 30px #0008;
  background:radial-gradient(circle at 50% 50%,#ffe9a0 0 18%,transparent 19%),repeating-conic-gradient(from 0deg,#6b4fd0 0 15deg,#8a6ff0 15deg 30deg)}
.gfk-back.shake1{animation:gfk-shake .45s 1}.gfk-back.shake2{animation:gfk-shake .45s 2}.gfk-back.shake3{animation:gfk-shake .4s 4}
.gfk-back.glow{box-shadow:0 0 40px 12px #ffd54f,0 10px 30px #0008}
@keyframes gfk-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg) scale(1.04)}75%{transform:rotate(7deg) scale(1.04)}}
.gfk-burst{position:absolute;left:50%;top:50%;pointer-events:none;font-size:26px;animation:gfk-fly 1.2s ease-out forwards}
@keyframes gfk-fly{from{transform:translate(-50%,-50%) scale(.3);opacity:1}to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.2) rotate(var(--r));opacity:0}}
.gfk-halo{position:absolute;inset:-40%;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .6s}
.gfk-halo.t-rare{background:radial-gradient(circle,#7fa6ff88,transparent 60%)}
.gfk-halo.t-sparkly{background:conic-gradient(#ff7ad966,#ffe86a66,#7affb866,#7ad8ff66,#c07aff66,#ff7ad966);filter:blur(20px);animation:gfc-rot 8s linear infinite}
.gfk-halo.t-legendary{background:repeating-conic-gradient(#ffd54fbb 0 10deg,transparent 10deg 22deg);animation:gfc-rot 12s linear infinite;-webkit-mask:radial-gradient(circle,#000 20%,transparent 65%);mask:radial-gradient(circle,#000 20%,transparent 65%)}
.gfk-halo.on{opacity:1}
.gfk-tier{position:relative;margin-top:6px;display:inline-block;font-weight:800;font-size:clamp(20px,4.5vw,28px);padding:4px 18px;border-radius:999px;background:#fff;color:#3a2a6a;transform:scale(0);transition:transform .4s cubic-bezier(.3,1.8,.5,1)}
.gfk-tier.on{transform:scale(1)}
.gfk-tier.t-rare{background:#6f8fe6;color:#fff}.gfk-tier.t-sparkly{background:linear-gradient(90deg,#ff7ad9,#ffd84a,#6fe8a6,#6fc8ff,#c07aff);color:#fff;text-shadow:0 2px 0 #0004}
.gfk-tier.t-legendary{background:linear-gradient(90deg,#c98a12,#ffe27a,#c98a12);color:#4a2c00}
.gfk-btn{position:relative;font:800 20px/1 "Grandstander",system-ui,sans-serif;border:0;border-radius:16px;padding:16px 26px;min-height:56px;background:#ffd84a;color:#3a2a1f;box-shadow:0 5px 0 #b8901a;cursor:pointer;touch-action:manipulation}
.gfk-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #b8901a}
.gfk-btn[hidden]{display:none}

.gfk-view{position:fixed;inset:0;z-index:99996;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;
  background:radial-gradient(circle at 50% 40%,#3a2a6a,#120c24 75%);color:#fff;font-family:"Grandstander","Andika",system-ui,sans-serif;touch-action:none;overflow:hidden}
.gfk-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
.gfk-ov.gl,.gfk-view.gl{background:#0d0820}.gfk-ov.gl::before{display:none}
.gfk-ov.gl .gfk-flip,.gfk-ov.gl .gfk-halo,.gfk-view.gl .stage>*{visibility:hidden}
.gfk-view .info,.gfk-view .nav,.gfk-view .x{position:relative}
.gfk-view .stage{position:relative;aspect-ratio:5/7;width:min(80vw,380px,calc((100dvh - 200px) * 5 / 7));transition:transform .25s ease-out,opacity .25s}
.gfk-view .info{text-align:center;display:flex;flex-direction:column;gap:2px;min-height:3.2em}
.gfk-view .info b{font-size:22px}.gfk-view .info span{opacity:.8;font-size:16px}
.gfk-view .nav{display:flex;gap:14px;align-items:center}
.gfk-view .rb{width:60px;height:60px;border-radius:50%;border:0;font-size:28px;background:#fff2;color:#fff;cursor:pointer;touch-action:manipulation}
.gfk-view .rb:disabled{opacity:.25}
.gfk-view .x{position:absolute;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right))}
.gfk-view .pos{font-weight:800;min-width:5em;text-align:center}
@media (prefers-reduced-motion:reduce){.gfc,.gfc *,.gfk-packbtn,.gfk-halo,.gfk-back{animation:none!important}.gfk-flip{transition:none}}
`;
  function injectCSS() {
    if (document.getElementById("gfk-cards-css")) return;
    const s = document.createElement("style"); s.id = "gfk-cards-css"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  injectCSS();

  /* ---------- tilt: cards follow her finger ---------- */
  function tilt(el, strength) {
    const card = () => el.querySelector(".gfc") || el;
    function move(e) {
      const r = el.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
      const x = Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (p.clientY - r.top) / r.height));
      const c = card(); c.style.setProperty("--mx", x * 100 + "%"); c.style.setProperty("--my", y * 100 + "%");
      if (!reduced()) { c.style.setProperty("--ry", (x - 0.5) * strength + "deg"); c.style.setProperty("--rx", (0.5 - y) * strength + "deg"); }
    }
    function reset() { const c = card(); ["--rx", "--ry"].forEach(v => c.style.setProperty(v, "0deg")); }
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", reset);
    return { move, reset };
  }

  /* ---------- luck ---------- */
  function luck() { return Object.assign({ sinceShiny: 0, sinceBonus: 0 }, ls.get(LUCK, {})); }
  function drawCharm(have) {
    const left = CHARMS.filter(c => !have.has("wonder-charms/" + c[0]));
    if (!left.length) return null;
    let total = 0; const w = left.map(c => (total += CHARM_WEIGHT[c[3]]));
    const x = Math.random() * total, i = w.findIndex(v => x < v);
    const c = left[i < 0 ? 0 : i];
    return { game: "wonder-charms", id: c[0], emoji: c[1], name: c[2], rarity: c[3] };
  }

  const queue = [];
  let btn = null;
  function collect(item, opts) {
    opts = opts || {};
    if (!item || !item.game || !(item.id || item.name)) return false;
    const all = list(), have = new Set(all.map(keyOf));
    if (have.has(keyOf(item))) return false;
    const c = Object.assign({}, item, { earnedAt: item.earnedAt || new Date().toISOString() });
    if (TIERS[c.rarity] == null) c.rarity = "common";
    const fresh = [c];
    if ((FINALES[c.game] || []).includes(c.id)) c.rarity = "legendary";
    if (!opts.quiet) {
      const L = luck();
      if (c.rarity === "common" || c.rarity === "rare") {
        L.sinceShiny++;
        if (Math.random() < SHINY_CHANCE[c.rarity] || L.sinceShiny >= SHINY_PITY) { c.rarity = "sparkly"; c.shiny = true; L.sinceShiny = 0; }
      }
      L.sinceBonus++;
      if (Math.random() < BONUS_CHANCE || L.sinceBonus >= BONUS_PITY) {
        const b = drawCharm(have);
        if (b) { b.earnedAt = c.earnedAt; b.bonus = true; fresh.push(b); L.sinceBonus = 0; }
      }
      ls.set(LUCK, L);
    }
    all.push(...fresh);
    const n = all.filter(x => x.game !== "wonder-crowns").length;
    CROWNS.forEach(cr => {
      if (n >= cr.at && !have.has("wonder-crowns/" + cr.id)) {
        const k = { game: "wonder-crowns", id: cr.id, name: cr.name, emoji: cr.emoji, rarity: "legendary", earnedAt: c.earnedAt, crown: cr.at };
        all.push(k); fresh.push(k);
      }
    });
    ls.set(KEY, all);
    if (!opts.quiet) { queue.push(...fresh); showButton(); }
    return true;
  }

  function showButton() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", showButton, { once: true }); return; }
    if (!queue.length) { if (btn) { btn.remove(); btn = null; } return; }
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "gfk-packbtn"; btn.type = "button";
      btn.addEventListener("click", e => { e.stopPropagation(); openPacks(); });
      document.body.appendChild(btn);
    }
    btn.setAttribute("aria-label", queue.length + " new card" + (queue.length === 1 ? "" : "s") + " to open");
    btn.innerHTML = `<b>🎁</b>Open!<i>${queue.length}</i>`;
  }

  /* ---------- WebGL: the card as a real 3D object ----------
     The pack opening and the big viewer draw the card with WebGL: it tilts in 3D under her finger,
     a foil shader makes Shiny cards shift through the rainbow and Legendary cards shine gold, glitter
     catches the light, and a night sky with light rays and sparks sits behind it. The card face is
     painted onto a 2D canvas first and used as a texture. With no WebGL the CSS cards are used. */
  const TW = 600, TH = 840;
  function rr(x, y, w, h, r, ctx) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const FONT = '"Grandstander","Andika","Trebuchet MS",system-ui,sans-serif';
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function canvas2d() { const c = document.createElement("canvas"); c.width = TW; c.height = TH; return c; }
  function fitText(ctx, text, max, size, weight) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${FONT}`; if (ctx.measureText(text).width <= max) break; s -= 2; } while (s > 20);
    return s;
  }
  function paintFace(c) {
    const set = SETS[c.game] || { name: "Treasures", icon: "⭐", a: "#eadcc4", b: "#8a6a45" }, t = tierOf(c);
    const cv = canvas2d(), x = cv.getContext("2d"), mk = canvas2d(), m = mk.getContext("2d");
    // outer frame
    let g = x.createLinearGradient(0, 0, TW, TH);
    const frames = { common: ["#fffdf7", "#f3ebdd", "#e4d8c3"], rare: ["#e8f0ff", "#7c98ea", "#dfe8ff"], sparkly: ["#ffd1f0", "#c3f0ff", "#fff3b0", "#d6c8ff"], legendary: ["#fff1a8", "#e7a91d", "#fff6c2", "#c98a12"] }[t];
    frames.forEach((col, i) => g.addColorStop(i / (frames.length - 1), col));
    rr(0, 0, TW, TH, 44, x); x.fillStyle = g; x.fill();
    // inner panel
    g = x.createLinearGradient(0, 30, 0, TH - 30);
    if (t === "legendary") { g.addColorStop(0, "#fff4c9"); g.addColorStop(0.6, "#ffd36b"); g.addColorStop(1, "#e9a52a"); }
    else { g.addColorStop(0, set.a); g.addColorStop(1, set.b); }
    rr(26, 26, TW - 52, TH - 52, 28, x); x.fillStyle = g; x.fill();
    x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.6)"; x.stroke();
    // art window
    const ax = 46, ay = 150, aw = TW - 92, ah = 548;
    x.save(); rr(ax, ay, aw, ah, 24, x); x.clip();
    g = x.createRadialGradient(TW / 2, ay + ah * 0.45, 10, TW / 2, ay + ah * 0.45, ah * 0.75);
    if (t === "legendary") { g.addColorStop(0, "#fff3c0"); g.addColorStop(0.4, "#ffc93f"); g.addColorStop(0.8, "#d98a12"); g.addColorStop(1, "#8a4f06"); }
    else { g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, set.a); g.addColorStop(1, set.b); }
    x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
    if (t === "legendary" || t === "sparkly") {
      x.save(); x.translate(TW / 2, ay + ah * 0.45); x.fillStyle = t === "legendary" ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.18)";
      for (let i = 0; i < 18; i++) { x.rotate(Math.PI * 2 / 18); x.beginPath(); x.moveTo(0, 0); x.lineTo(-40, -700); x.lineTo(40, -700); x.closePath(); x.fill(); }
      x.restore();
    }
    x.fillStyle = "rgba(255,255,255,.22)";
    for (let yy = ay + 20; yy < ay + ah; yy += 42) for (let xx = ax + 20; xx < ax + aw; xx += 42) { x.beginPath(); x.arc(xx, yy, 5, 0, 7); x.fill(); }
    x.restore();
    rr(ax, ay, aw, ah, 24, x); x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,.75)"; x.stroke();
    // emoji, with a soft shadow
    const emo = c.emoji || "⭐", ey = ay + ah * 0.5;
    x.font = `250px ${EMOJI_FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
    x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30; x.shadowOffsetY = 18; x.fillText(emo, TW / 2, ey); x.restore();
    // name plate
    rr(46, 46, TW - 92, 88, 20, x); x.fillStyle = "rgba(255,255,255,.88)"; x.fill();
    const name = (c.name || "Card") + (c.shiny ? " ✨" : "");
    const fs = fitText(x, name, TW - 130, 54, 800);
    x.fillStyle = "#2c2118"; x.font = `800 ${fs}px ${FONT}`; x.fillText(name, TW / 2, 92);
    // footer: set pill and rarity gems
    const label = `${set.icon} ${set.name}`, lfs = fitText(x, label, 330, 34, 800);
    x.font = `800 ${lfs}px ${FONT}`; const lw = Math.min(360, x.measureText(label).width + 44);
    rr(46, 718, lw, 66, 33, x); x.fillStyle = "rgba(255,255,255,.88)"; x.fill();
    x.fillStyle = "#2c2118"; x.textAlign = "left"; x.fillText(label, 68, 752);
    x.textAlign = "right"; x.font = `800 44px ${FONT}`; x.fillStyle = "#fff";
    x.save(); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowOffsetY = 3; x.fillText(TIER_GEMS[t], TW - 56, 752); x.restore();
    // holo mask: foil everywhere except the picture and the writing
    rr(0, 0, TW, TH, 44, m); m.fillStyle = "#fff"; m.fill();
    m.fillStyle = "#555"; rr(46, 46, TW - 92, 88, 20, m); m.fill(); rr(46, 718, lw, 66, 33, m); m.fill();
    const em = canvas2d(), e = em.getContext("2d");
    e.font = `250px ${EMOJI_FONT}`; e.textAlign = "center"; e.textBaseline = "middle"; e.fillText(emo, TW / 2, ey);
    e.globalCompositeOperation = "source-in"; e.fillStyle = "#000"; e.fillRect(0, 0, TW, TH);
    m.drawImage(em, 0, 0);
    return { face: cv, mask: mk };
  }
  let backCache = null;
  function paintBack() {
    if (backCache) return backCache;
    const cv = canvas2d(), x = cv.getContext("2d");
    rr(0, 0, TW, TH, 44, x); x.fillStyle = "#fff"; x.fill();
    x.save(); rr(18, 18, TW - 36, TH - 36, 32, x); x.clip();
    x.fillStyle = "#6b4fd0"; x.fillRect(0, 0, TW, TH);
    x.translate(TW / 2, TH / 2); x.fillStyle = "#8a6ff0";
    for (let i = 0; i < 24; i += 2) { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 900, i * Math.PI / 12, (i + 1) * Math.PI / 12); x.closePath(); x.fill(); }
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 170); g.addColorStop(0, "#fff6c8"); g.addColorStop(0.7, "#ffe27a"); g.addColorStop(1, "rgba(255,226,122,0)");
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 170, 0, 7); x.fill();
    x.font = `170px ${EMOJI_FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("🎁", 0, 6);
    x.fillStyle = "#fff"; x.font = `800 46px ${FONT}`; x.fillText("WONDER PACK", 0, -300); x.fillText("✦  ✦  ✦", 0, 300);
    x.restore();
    return (backCache = cv);
  }

  const VS_BG = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS_BG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes,uC;uniform float uT,uRays,uFlash,uRainbow;uniform vec3 uCol;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 fc=gl_FragCoord.xy;float m=min(uRes.x,uRes.y);vec2 p=(fc-uC)/m;float r=length(p),a=atan(p.y,p.x);
  vec3 col=mix(vec3(.05,.03,.12),vec3(.2,.11,.36),smoothstep(1.3,0.,r));
  float nb=fbm(p*2.4+vec2(uT*.03,-uT*.02));
  col+=mix(vec3(.45,.25,.8),uCol,.5)*pow(nb,2.2)*.75*smoothstep(1.5,.1,r);
  col+=vec3(.2,.35,.7)*pow(fbm(p*4.1-uT*.04),3.)*.5;
  vec2 cl=fc/(7.*m/900.);vec2 sp=floor(cl);float s=h(sp);vec2 sf=fract(cl)-.5+(vec2(h(sp+3.1),h(sp+7.7))-.5)*.5;col+=step(.985,s)*smoothstep(.22,0.,length(sf))*(.6+.4*sin(uT*2.5+s*90.));
  float ry=pow(.5+.5*sin(a*12.+uT*.5),7.)+.7*pow(.5+.5*sin(a*7.-uT*.35),9.);
  vec3 rc=mix(uCol,.6+.4*cos(6.2832*(a/6.2832+uT*.06+vec3(0.,.33,.67))),uRainbow);
  col+=rc*ry*uRays*smoothstep(1.2,.06,r)*.6;
  col+=rc*uRays*.45*smoothstep(.55,0.,r);
  col+=vec3(1.,.97,.9)*uFlash*smoothstep(1.1,0.,r);
  gl_FragColor=vec4(col,1.);
}`;
  const VS_CARD = `attribute vec2 p;uniform vec2 uRes,uC,uSize;uniform vec3 uRot;uniform float uScale;varying vec2 vUv;varying float vFace;
void main(){
  vec3 q=vec3(p*uSize*uScale,0.);vec3 nn=vec3(0.,0.,1.);
  float cz=cos(uRot.z),sz=sin(uRot.z);q.xy=vec2(cz*q.x-sz*q.y,sz*q.x+cz*q.y);
  float cy=cos(uRot.y),sy=sin(uRot.y);q=vec3(cy*q.x+sy*q.z,q.y,-sy*q.x+cy*q.z);nn=vec3(cy*nn.x+sy*nn.z,nn.y,-sy*nn.x+cy*nn.z);
  float cx=cos(uRot.x),sx=sin(uRot.x);q=vec3(q.x,cx*q.y-sx*q.z,sx*q.y+cx*q.z);nn=vec3(nn.x,cx*nn.y-sx*nn.z,sx*nn.y+cx*nn.z);
  float f=uSize.y*3.2;float w=f/(f-q.z);vec2 s=uC+q.xy*w;
  gl_Position=vec4(s.x/uRes.x*2.-1.,1.-s.y/uRes.y*2.,0.,1.);
  vUv=p+.5;vFace=nn.z;
}`;
  const FS_CARD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uFace,uMask,uBack;uniform float uTier,uT,uGlow;uniform vec2 uTilt;varying vec2 vUv;varying float vFace;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 pal(float t){return .5+.5*cos(6.2832*(t+vec3(0.,.33,.67)));}
void main(){
  vec2 uv=vUv;
  vec2 L=vec2(.5,.45)+uTilt*vec2(.9,-.9);
  float spec=pow(max(0.,1.-distance(uv,L)*1.5),3.);
  float sweep=smoothstep(.13,0.,abs(uv.x*.9+uv.y*.5-(.7+uTilt.x*1.3-uTilt.y*.7+sin(uT*.5)*.2)));
  if(vFace<0.){
    vec4 b=texture2D(uBack,vec2(1.-uv.x,uv.y));if(b.a<.01)discard;
    vec3 c=b.rgb+(spec*.25+sweep*.15)*b.a+vec3(1.,.85,.4)*uGlow*.35*b.a;
    gl_FragColor=vec4(c,b.a);return;
  }
  vec4 c=texture2D(uFace,uv);if(c.a<.01)discard;
  float mk=texture2D(uMask,uv).r;
  vec3 col=c.rgb;
  vec2 gc=uv*vec2(64.,90.);vec2 g=floor(gc);float r=h(g);vec2 gf=fract(gc)-.5;
  float tw=pow(max(0.,sin(r*50.+uTilt.x*18.+uTilt.y*13.+uT*1.5)),24.)*step(.72,r)*smoothstep(.42,.05,length(gf));
  if(uTier<.5){col+=(spec*.10+sweep*.07)*c.a;}
  else if(uTier<1.5){col+=(spec*.2+sweep*.25)*vec3(.85,.92,1.)*c.a+tw*mk*.35*c.a;}
  else if(uTier<2.5){
    float t=uv.x*1.3+uv.y*.9+uTilt.x*1.6+uTilt.y*1.1+uT*.04;
    vec3 rb=pal(t)*c.a;
    col=mix(col,col*.55+rb*.75,mk*(.45+.3*sweep));
    col+=tw*mk*1.1*c.a*mix(vec3(1.),pal(r),.5)+spec*.25*c.a;
  } else {
    float t=uv.x-uv.y*.6+uTilt.x*1.4+uTilt.y*.6+uT*.07;
    float sh=pow(.5+.5*sin(t*8.),5.);
    col+=vec3(1.,.82,.35)*sh*.38*mk*c.a+spec*.3*c.a;
    col=mix(col,col*.7+pal(t*.5)*.4*c.a,mk*.18*sweep);
    col+=tw*mk*1.3*c.a*vec3(1.,.92,.6);
  }
  float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
  col+=vec3(1.,.9,.6)*uGlow*smoothstep(.06,0.,edge)*c.a*.8;
  gl_FragColor=vec4(col,c.a);
}`;
  const VS_PT = `attribute vec2 p;attribute float sz;attribute vec4 col;uniform vec2 uRes;varying vec4 vC;
void main(){gl_Position=vec4(p.x/uRes.x*2.-1.,1.-p.y/uRes.y*2.,0.,1.);gl_PointSize=sz;vC=col;}`;
  const FS_PT = `precision mediump float;varying vec4 vC;
void main(){vec2 q=gl_PointCoord-.5;float d=length(q);
  float a=smoothstep(.5,0.,d)*.6+pow(max(0.,1.-abs(q.x)*14.),2.)*smoothstep(.5,0.,abs(q.y))*.8+pow(max(0.,1.-abs(q.y)*14.),2.)*smoothstep(.5,0.,abs(q.x))*.8;
  a=clamp(a,0.,1.)*vC.a;gl_FragColor=vec4(vC.rgb*a,a);}`;

  const TIER_LOOK = { // background tint, ray strength when open, rainbow rays, sparks
    common: { col: [0.95, 0.85, 1.0], rays: 0.18, rainbow: 0, sparks: [[1, 0.95, 0.8], [0.85, 0.8, 1]] },
    rare: { col: [0.45, 0.65, 1.0], rays: 0.4, rainbow: 0, sparks: [[0.6, 0.75, 1], [1, 1, 1]] },
    sparkly: { col: [0.9, 0.6, 1.0], rays: 0.65, rainbow: 1, sparks: [[1, 0.5, 0.85], [1, 0.9, 0.4], [0.5, 1, 0.7], [0.5, 0.8, 1], [0.8, 0.5, 1]] },
    legendary: { col: [1.0, 0.78, 0.3], rays: 1.0, rainbow: 0.15, sparks: [[1, 0.85, 0.35], [1, 0.95, 0.7], [1, 0.7, 0.2]] }
  };

  function glStage(host, stageEl) {
    let gl = null;
    const cv = document.createElement("canvas");
    cv.className = "gfk-gl"; cv.setAttribute("aria-hidden", "true");
    try { gl = cv.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: true }) || cv.getContext("experimental-webgl"); } catch (e) {}
    if (!gl) return null;
    function prog(vs, fs) {
      const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    }
    let P;
    try { P = { bg: prog(VS_BG, FS_BG), card: prog(VS_CARD, FS_CARD), pt: prog(VS_PT, FS_PT) }; } catch (e) { console.warn("card WebGL off:", e); return null; }
    host.insertBefore(cv, host.firstChild);
    host.classList.add("gl");
    const full = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, full); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const Q = [], N = 12; // a finely split quad so the perspective bend stays smooth
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x0 = i / N - 0.5, x1 = (i + 1) / N - 0.5, y0 = j / N - 0.5, y1 = (j + 1) / N - 0.5;
      Q.push(x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Q), gl.STATIC_DRAW);
    const ptBuf = gl.createBuffer();
    function tex(src) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    let T = { back: tex(paintBack()), face: null, mask: null };
    const S = {
      ry: Math.PI, rx: 0, rz: 0, scale: 1, ox: 0, oy: 0, tier: "common", rays: 0.15, raysTo: 0.15, flash: 0, glow: 0,
      tilt: [0, 0], tiltTo: [0, 0], touching: false, anims: [], parts: [], ambient: 0, t0: performance.now(), dpr: 1, rect: null
    };
    function setCard(c) {
      S.tier = tierOf(c);
      let p;
      try { p = paintFace(c); } catch (e) { console.warn("card paint failed:", e); return; }
      if (T.face) { gl.deleteTexture(T.face); gl.deleteTexture(T.mask); }
      T.face = tex(p.face); T.mask = tex(p.mask);
    }
    function anim(dur, fn, done) { S.anims.push({ start: performance.now(), dur, fn, done }); }
    function burst(n, spread) {
      const look = TIER_LOOK[S.tier], r = S.rect; if (!r) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (200 + Math.random() * spread) * S.dpr;
        const c = look.sparks[i % look.sparks.length];
        S.parts.push({ x: r.cx + Math.cos(a) * r.w * 0.2, y: r.cy + Math.sin(a) * r.h * 0.2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120 * S.dpr, life: 0, max: 1.1 + Math.random() * 1.1, size: (10 + Math.random() * 22) * S.dpr, c });
      }
    }
    function sparkle() {
      const r = S.rect, look = TIER_LOOK[S.tier]; if (!r) return;
      const side = Math.random();
      const x = r.cx + (Math.random() - 0.5) * r.w * 1.25, y = r.cy + (Math.random() - 0.5) * r.h * 1.15;
      S.parts.push({ x, y, vx: (Math.random() - 0.5) * 30 * S.dpr, vy: (-30 - Math.random() * 40) * S.dpr, life: 0, max: 1 + side, size: (8 + Math.random() * 16) * S.dpr, c: look.sparks[Math.floor(Math.random() * look.sparks.length)] });
    }
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = host.clientWidth, h = host.clientHeight;
      S.dpr = dpr;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const hb = host.getBoundingClientRect(), sb = stageEl.getBoundingClientRect();
      S.rect = { cx: (sb.left - hb.left + sb.width / 2) * dpr, cy: (sb.top - hb.top + sb.height / 2) * dpr, w: sb.width * dpr, h: sb.height * dpr };
    }
    function move(e) {
      const r = stageEl.getBoundingClientRect(), pnt = e.touches ? e.touches[0] : e;
      if (!pnt) return;
      S.touching = true;
      S.tiltTo = [Math.max(-1, Math.min(1, (pnt.clientX - r.left - r.width / 2) / (r.width * 0.6))), Math.max(-1, Math.min(1, (pnt.clientY - r.top - r.height / 2) / (r.height * 0.6)))];
    }
    const leave = () => { S.touching = false; };
    host.addEventListener("pointermove", move); host.addEventListener("pointerdown", move);
    host.addEventListener("pointerleave", leave); host.addEventListener("pointerup", leave); host.addEventListener("pointercancel", leave);
    host.addEventListener("touchmove", move, { passive: true });
    let raf = 0, last = performance.now(), alive = true;
    const ptData = new Float32Array(400 * 7);
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000), t = (now - S.t0) / 1000; last = now;
      resize();
      const running = S.anims; S.anims = [];
      const kept = running.filter(a => {
        const k = Math.min(1, (now - a.start) / a.dur);
        try { a.fn(k); if (k >= 1 && a.done) a.done(); } catch (e) { console.warn(e); return false; }
        return k < 1;
      });
      S.anims = kept.concat(S.anims);
      if (!S.touching) S.tiltTo = reduced() ? [0, 0] : [Math.sin(t * 0.7) * 0.35, Math.cos(t * 0.55) * 0.22];
      S.tilt[0] += (S.tiltTo[0] - S.tilt[0]) * Math.min(1, dt * 8); S.tilt[1] += (S.tiltTo[1] - S.tilt[1]) * Math.min(1, dt * 8);
      S.rays += (S.raysTo - S.rays) * Math.min(1, dt * 3); S.flash = Math.max(0, S.flash - dt * 1.8);
      if (S.ambient > 0 && !reduced()) { S.ambientAcc = (S.ambientAcc || 0) + dt * S.ambient; while (S.ambientAcc > 1) { S.ambientAcc--; sparkle(); } }
      const W = cv.width, H = cv.height, r = S.rect, look = TIER_LOOK[S.tier];
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(P.bg.p); gl.bindBuffer(gl.ARRAY_BUFFER, full);
      let loc = gl.getAttribLocation(P.bg.p, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(P.bg.u.uRes, W, H); gl.uniform2f(P.bg.u.uC, r.cx, H - r.cy); gl.uniform1f(P.bg.u.uT, t);
      gl.uniform1f(P.bg.u.uRays, S.rays); gl.uniform1f(P.bg.u.uFlash, S.flash); gl.uniform1f(P.bg.u.uRainbow, look.rainbow); gl.uniform3fv(P.bg.u.uCol, look.col);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(loc);
      // card
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.card.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      loc = gl.getAttribLocation(P.card.p, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = P.card.u;
      gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uC, r.cx + S.ox * r.w, r.cy + S.oy * r.h); gl.uniform2f(u.uSize, r.w, r.h);
      gl.uniform3f(u.uRot, S.rx - S.tilt[1] * 0.32, S.ry + S.tilt[0] * 0.42, S.rz); gl.uniform1f(u.uScale, S.scale);
      gl.uniform1f(u.uTier, TIERS[S.tier]); gl.uniform1f(u.uT, t); gl.uniform2f(u.uTilt, S.tilt[0], S.tilt[1]); gl.uniform1f(u.uGlow, S.glow);
      [["uFace", T.face || T.back], ["uMask", T.mask || T.back], ["uBack", T.back]].forEach(([n, tx], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(u[n], i); });
      gl.drawArrays(gl.TRIANGLES, 0, Q.length / 2);
      gl.disableVertexAttribArray(loc);
      // sparks
      S.parts = S.parts.filter(q => (q.life += dt) < q.max);
      if (S.parts.length > 400) S.parts.splice(0, S.parts.length - 400);
      if (S.parts.length) {
        let k = 0;
        for (const q of S.parts) {
          q.vx *= 1 - dt * 1.6; q.vy = q.vy * (1 - dt * 1.6) + 60 * S.dpr * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          const f = q.life / q.max, a = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85;
          ptData.set([q.x, q.y, q.size * (0.6 + 0.4 * Math.sin(q.life * 9 + q.size)), q.c[0], q.c[1], q.c[2], Math.max(0, a)], k); k += 7;
        }
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(P.pt.p); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, ptData.subarray(0, k), gl.DYNAMIC_DRAW);
        gl.uniform2f(P.pt.u.uRes, W, H);
        const lp = gl.getAttribLocation(P.pt.p, "p"), ls_ = gl.getAttribLocation(P.pt.p, "sz"), lc = gl.getAttribLocation(P.pt.p, "col");
        [lp, ls_, lc].forEach(l => gl.enableVertexAttribArray(l));
        gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(ls_, 1, gl.FLOAT, false, 28, 8); gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 28, 12);
        gl.drawArrays(gl.POINTS, 0, k / 7);
        [lp, ls_, lc].forEach(l => gl.disableVertexAttribArray(l));
      }
    }
    raf = requestAnimationFrame(frame);
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); alive = false; cancelAnimationFrame(raf); host.classList.remove("gl"); cv.remove(); });
    return {
      S, setCard, anim, burst,
      look: () => TIER_LOOK[S.tier],
      destroy() { alive = false; cancelAnimationFrame(raf); try { const x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); } catch (e) {} cv.remove(); }
    };
  }
  const ease = k => 1 - Math.pow(1 - k, 3);
  const easeBack = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  /* ---------- the reveal ---------- */
  let opening = false;
  function burst(stage, t) {
    if (reduced()) return;
    const n = { common: 10, rare: 16, sparkly: 26, legendary: 40 }[t];
    const bits = { common: ["⭐", "✨"], rare: ["💙", "⭐", "✨"], sparkly: ["✨", "🌈", "💖", "⭐", "🦋"], legendary: ["👑", "✨", "🌟", "💛", "⭐"] }[t];
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span"); s.className = "gfk-burst"; s.textContent = bits[i % bits.length];
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * (t === "legendary" ? 260 : 170);
      s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px"); s.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      s.style.animationDelay = Math.random() * 0.25 + "s";
      stage.appendChild(s); setTimeout(() => s.remove(), 1600);
    }
  }
  const HYPE = {
    common: ["A new card!", "Look what you found!", "Ooh, a new friend!"],
    rare: ["A RARE card!", "Wow, a rare one!"],
    sparkly: ["It's SHINY!", "A sparkly holo card!", "Shiny! How lucky!"],
    legendary: ["LEGENDARY!", "The most special card of all!"]
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function openPacks() {
    if (opening || !queue.length) return Promise.resolve();
    opening = true;
    if (btn) { btn.remove(); btn = null; }
    const ov = document.createElement("div");
    ov.className = "gfk-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Open your new cards");
    ov.innerHTML = `<div class="msg"></div><div class="gfk-stage"><div class="gfk-halo"></div><div class="gfk-flip"><div class="gfk-back">🎁</div><div class="front"></div></div></div>
      <div class="gfk-tier"></div><div class="sub"></div><button class="gfk-btn" type="button" hidden></button>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("on"));
    const $ = s => ov.querySelector(s);
    const stage = $(".gfk-stage"), flip = $(".gfk-flip"), back = $(".gfk-back"), halo = $(".gfk-halo"), tierEl = $(".gfk-tier"), msg = $(".msg"), sub = $(".sub"), go = $(".gfk-btn");
    const G = glStage(ov, stage);
    if (!G) { const tl = tilt(stage, 22); stage.addEventListener("touchmove", e => tl.move(e), { passive: true }); }
    return new Promise(done => {
      let c = null, state = "closed";
      function next() {
        c = queue.shift();
        const t = tierOf(c);
        state = "closed"; go.hidden = true; tierEl.className = "gfk-tier"; halo.className = "gfk-halo";
        flip.classList.remove("open"); back.className = "gfk-back";
        $(".front").innerHTML = face(c, { big: true });
        msg.textContent = c.crown ? `You have ${c.crown} cards! A Crown Card appears…` : c.bonus ? "And a lucky bonus charm!" : "You won a card pack!";
        sub.textContent = "Tap the pack to open it!";
        if (t === "legendary") back.classList.add("glow");
        if (G) {
          const S = G.S;
          G.setCard(c); S.ry = Math.PI; S.rz = 0; S.ambient = 0; S.raysTo = 0.15; S.glow = t === "legendary" ? 0.5 : 0;
          if (!reduced()) G.anim(550, k => { S.scale = 0.25 + 0.75 * easeBack(k); S.ry = Math.PI - (1 - ease(k)) * 1.2; });
          else S.scale = 1;
        }
      }
      function reveal(t) {
        halo.classList.add("t-" + t, "on");
        tierEl.textContent = (c.shiny ? "✨ " : "") + TIER_NAME[t].toUpperCase() + (t === "legendary" ? " 👑" : "");
        tierEl.classList.add("t-" + t, "on");
        msg.textContent = pick(HYPE[t]);
        sub.textContent = c.name;
        state = "open"; go.hidden = false;
        go.textContent = queue.length ? `Next pack (${queue.length}) ➜` : "Put it in my binder";
        go.focus({ preventScroll: true });
      }
      function openGL(t, shakes) {
        const S = G.S, look = G.look();
        const shakeMs = reduced() ? 0 : 420 * Math.min(3, shakes) * (shakes > 2 ? 0.7 : 1);
        if (t === "legendary") S.raysTo = 0.45;
        G.anim(shakeMs || 1, k => { S.rz = Math.sin(k * shakeMs / 1000 * 36) * 0.13 * (1 - k * 0.4); S.scale = 1 + 0.05 * Math.sin(k * shakeMs / 1000 * 50) * (shakes > 2 ? 1.5 : 1); }, () => {
          S.rz = 0;
          const turns = t === "legendary" ? 3 : t === "sparkly" ? 3 : 1, flipMs = reduced() ? 1 : t === "legendary" ? 1500 : t === "sparkly" ? 1200 : 850;
          const start = S.ry;
          let landed = false;
          G.anim(flipMs, k => {
            S.ry = start + turns * Math.PI * ease(k); S.scale = 1 + 0.18 * Math.sin(Math.PI * k);
            if (!landed && k > 0.55) { landed = true; chime(t); S.flash = t === "legendary" ? 1 : t === "sparkly" ? 0.8 : 0.5; G.burst({ common: 40, rare: 70, sparkly: 130, legendary: 200 }[t], t === "legendary" ? 520 : 380); S.raysTo = look.rays; }
          }, () => {
            S.ambient = { common: 0.5, rare: 2, sparkly: 6, legendary: 12 }[t];
            S.glow = t === "legendary" ? 0.35 : 0;
            setTimeout(() => reveal(t), 200);
          });
        });
      }
      function open() {
        if (state !== "closed") return;
        state = "opening"; sub.textContent = "";
        const t = tierOf(c), shakes = TIERS[t] + 1;
        rustle();
        if (G) return openGL(t, shakes);
        back.classList.add("shake" + Math.min(3, shakes));
        setTimeout(() => {
          flip.classList.add("open"); chime(t); burst(stage, t);
          setTimeout(() => reveal(t), reduced() ? 50 : 650);
        }, reduced() ? 0 : 450 * Math.min(3, shakes) * (shakes > 2 ? 0.6 : 1));
      }
      stage.addEventListener("click", open);
      go.addEventListener("click", e => {
        e.stopPropagation();
        if (queue.length) return next();
        ov.classList.remove("on");
        setTimeout(() => { if (G) G.destroy(); ov.remove(); opening = false; showButton(); done(); }, 260);
      });
      next();
    });
  }

  /* ---------- big viewer: swipe through cards ---------- */
  function view(cards, start, opts) {
    opts = opts || {};
    if (!cards || !cards.length) return;
    let i = Math.max(0, Math.min(cards.length - 1, start || 0));
    const v = document.createElement("div");
    v.className = "gfk-view"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Card viewer");
    v.innerHTML = `<button class="rb x" type="button" aria-label="Close">✕</button><div class="stage"></div><div class="info"></div>
      <div class="nav"><button class="rb prev" type="button" aria-label="Previous card">◀</button><span class="pos"></span><button class="rb nextb" type="button" aria-label="Next card">▶</button></div>`;
    document.body.appendChild(v);
    const stage = v.querySelector(".stage"), info = v.querySelector(".info"), pos = v.querySelector(".pos");
    const prevB = v.querySelector(".prev"), nextB = v.querySelector(".nextb");
    const G = glStage(v, stage);
    if (G) { G.S.ry = 0; G.S.scale = 1; }
    const tl = G ? { move() {}, reset() {} } : tilt(stage, 26);
    function when(s) { try { return new Date(s).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch (e) { return ""; } }
    function draw(dir) {
      const c = cards[i], t = tierOf(c), set = SETS[c.game];
      stage.innerHTML = face(c, { big: true });
      if (G) {
        const S = G.S;
        if (!dir || reduced()) { G.setCard(c); }
        else {
          const start = S.ry; let swapped = false;
          G.anim(560, k => { S.ry = start + dir * 2 * Math.PI * ease(k); S.scale = 1 - 0.12 * Math.sin(Math.PI * k); if (!swapped && k > 0.3) { swapped = true; G.setCard(c); S.raysTo = G.look().rays * 0.55; } });
        }
        S.raysTo = G.look().rays * 0.55; S.ambient = { common: 0, rare: 1, sparkly: 4, legendary: 8 }[t]; S.glow = t === "legendary" ? 0.3 : 0;
      } else if (dir && !reduced()) { stage.style.transition = "none"; stage.style.transform = `translateX(${dir * 60}px)`; stage.style.opacity = "0"; requestAnimationFrame(() => { stage.style.transition = ""; stage.style.transform = ""; stage.style.opacity = "1"; }); }
      info.innerHTML = `<b>${esc(c.name)}</b><span>${c.shiny ? "✨ Shiny" : TIER_NAME[t]} · ${esc(set ? set.name : "Treasures")}</span>${c.earnedAt ? `<span>Won on ${esc(when(c.earnedAt))}</span>` : ""}`;
      pos.textContent = `${i + 1} of ${cards.length}`;
      prevB.disabled = i === 0; nextB.disabled = i === cards.length - 1;
      if (opts.onShow) opts.onShow(c);
    }
    const go = d => { const j = i + d; if (j < 0 || j >= cards.length) return; i = j; draw(d); };
    function close() { if (G) G.destroy(); v.remove(); document.removeEventListener("keydown", key); if (opts.onClose) opts.onClose(); }
    function key(e) { if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); else if (e.key === "Escape") close(); }
    prevB.onclick = () => go(-1); nextB.onclick = () => go(1); v.querySelector(".x").onclick = close;
    document.addEventListener("keydown", key);
    let sx = null, sy = 0;
    v.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
    v.addEventListener("pointerup", e => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 120) close();
      tl.reset();
    });
    stage.addEventListener("touchmove", e => tl.move(e), { passive: true });
    draw(0);
    nextB.focus({ preventScroll: true });
  }

  window.GFKCards = { collect, face, locked, view, openPacks, list, SETS, CROWNS, CHARMS, TIERS, TIER_NAME, pending: () => queue.length };
})();
