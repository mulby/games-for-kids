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
    "wonder-charms": { name: "Wonder Charms", icon: "🍀", a: "#d9ccff", b: "#6a4fc4" },
    "wonder-crowns": { name: "Crown Cards", icon: "👑", a: "#fff0b3", b: "#c9931a" }
  };
  // Each game's very last reward is its Legendary card.
  const FINALES = { "egypt-puzzles": ["hidden-3"], "gemling-grids": ["card-r-moonFinale"], "fairy-lantern-festival": ["starwing"], "pirate-voyage": ["sea:5"], "mouse-shop": ["mouse-shop-moonbeam-the-unicorn-sparkly"] };
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
.gfk-view .stage{width:min(80vw,380px,calc((100dvh - 200px) * 5 / 7));transition:transform .25s ease-out,opacity .25s}
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
    const tl = tilt(stage, 22);
    stage.addEventListener("touchmove", e => tl.move(e), { passive: true });
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
      }
      function open() {
        if (state !== "closed") return;
        state = "opening"; sub.textContent = "";
        const t = tierOf(c), shakes = TIERS[t] + 1;
        rustle();
        back.classList.add("shake" + Math.min(3, shakes));
        setTimeout(() => {
          flip.classList.add("open"); chime(t); burst(stage, t);
          setTimeout(() => {
            halo.classList.add("t-" + t, "on");
            tierEl.textContent = (c.shiny ? "✨ " : "") + TIER_NAME[t].toUpperCase() + (t === "legendary" ? " 👑" : "");
            tierEl.classList.add("t-" + t, "on");
            msg.textContent = pick(HYPE[t]);
            sub.textContent = c.name;
            state = "open"; go.hidden = false;
            go.textContent = queue.length ? `Next pack (${queue.length}) ➜` : "Put it in my binder";
            go.focus({ preventScroll: true });
          }, reduced() ? 50 : 650);
        }, reduced() ? 0 : 450 * Math.min(3, shakes) * (shakes > 2 ? 0.6 : 1));
      }
      stage.addEventListener("click", open);
      go.addEventListener("click", e => {
        e.stopPropagation();
        if (queue.length) return next();
        ov.classList.remove("on");
        setTimeout(() => { ov.remove(); opening = false; showButton(); done(); }, 260);
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
    const tl = tilt(stage, 26);
    function when(s) { try { return new Date(s).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); } catch (e) { return ""; } }
    function draw(dir) {
      const c = cards[i], t = tierOf(c), set = SETS[c.game];
      stage.innerHTML = face(c, { big: true });
      if (dir && !reduced()) { stage.style.transition = "none"; stage.style.transform = `translateX(${dir * 60}px)`; stage.style.opacity = "0"; requestAnimationFrame(() => { stage.style.transition = ""; stage.style.transform = ""; stage.style.opacity = "1"; }); }
      info.innerHTML = `<b>${esc(c.name)}</b><span>${c.shiny ? "✨ Shiny" : TIER_NAME[t]} · ${esc(set ? set.name : "Treasures")}</span>${c.earnedAt ? `<span>Won on ${esc(when(c.earnedAt))}</span>` : ""}`;
      pos.textContent = `${i + 1} of ${cards.length}`;
      prevB.disabled = i === 0; nextB.disabled = i === cards.length - 1;
      if (opts.onShow) opts.onShow(c);
    }
    const go = d => { const j = i + d; if (j < 0 || j >= cards.length) return; i = j; draw(d); };
    function close() { v.remove(); document.removeEventListener("keydown", key); if (opts.onClose) opts.onClose(); }
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
