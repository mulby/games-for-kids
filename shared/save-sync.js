/* SaveSync: keeps every game's progress in The Wonder Shelf's artifact database.
   Inlined into the root index.html as the "gfk-save" script block; this file is the readable source.

   Games still save to localStorage exactly as before (each has its own key, plus the shared
   "gfk-collection" card list). The shelf opens each game in a full-screen frame on the same
   origin, so it hears every localStorage write as a "storage" event and copies that key to the
   db collection "saves" (one doc per key: {key, value, hash, updatedAt}). When the shelf loads
   it pulls "saves" back into localStorage before a game can open, so progress follows her
   between devices and survives cleared browser data. localStorage stays as the offline copy:
   with no db (signed out, or a plain web host) everything still works locally.

   First load with the db migrates whatever is already in localStorage up to it. */
(function () {
  const COL = "saves", META = "gfk-sync-meta", BIG = 240 * 1024, GONE = "reset";
  const skip = k => !k || k === META || k.startsWith("gfk-sync") || k.endsWith(".conflict-backup") || k.length > 150;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    keys() { try { return Object.keys(localStorage).filter(k => !skip(k)); } catch (e) { return []; } }
  };
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length; };
  // Doc ids allow letters, digits and _ - . : @ + ; anything else (and "~") becomes ~hex.
  const docId = k => "k-" + k.replace(/[^A-Za-z0-9_\-.:@+]/g, c => "~" + c.charCodeAt(0).toString(16) + "~");
  let meta = {};
  try { meta = JSON.parse(ls.get(META) || "{}") || {}; } catch (e) {}
  const saveMeta = () => ls.set(META, JSON.stringify(meta));
  const changed = () => { try { window.dispatchEvent(new Event("gfk-saves-changed")); } catch (e) {} };

  // Cards from two devices: keep every card either side has.
  function mergeCards(a, b) {
    let x = [], y = [];
    try { x = JSON.parse(a) || []; } catch (e) {}
    try { y = JSON.parse(b) || []; } catch (e) {}
    if (!Array.isArray(x) || !Array.isArray(y)) return b;
    const seen = new Set(), out = [];
    for (const c of y.concat(x)) { if (!c || typeof c !== "object") continue; const k = (c.game || "") + "/" + (c.id || c.name); if (!seen.has(k)) { seen.add(k); out.push(c); } }
    return JSON.stringify(out);
  }

  let db = null;
  const pending = new Set();
  let timer = 0, flushing = false;

  async function writeKey(k) {
    const ref = db.collection(COL).doc(docId(k));
    const v = ls.get(k);
    // A removed key leaves a tombstone, so another device's old copy can't bring it back.
    if (v == null) { if (meta[k] !== undefined && meta[k] !== GONE) { await ref.set({ key: k, value: null, deleted: true, hash: GONE, updatedAt: Date.now() }); meta[k] = GONE; } return; }
    const h = hash(v);
    if (h === meta[k] || v.length > BIG) return;
    await ref.set({ key: k, value: v, hash: h, updatedAt: Date.now() });
    meta[k] = h;
  }
  async function flush() {
    if (!db || flushing) return;
    flushing = true;
    try {
      while (pending.size) {
        const k = pending.values().next().value; pending.delete(k);
        try { await writeKey(k); }
        catch (e) {
          if (e && e.code === "unavailable") { await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); try { await writeKey(k); } catch (e2) {} }
          else if (e && e.code === "revoked") { db = null; break; }
        }
      }
      saveMeta();
    } finally { flushing = false; }
  }
  function queue(k, now) {
    if (!skip(k)) pending.add(k);
    clearTimeout(timer);
    timer = setTimeout(flush, now ? 0 : 1500);
  }
  // Catch anything a missed event left behind (called when a game closes).
  function sweep() { for (const k of ls.keys()) { const v = ls.get(k); if (v != null && hash(v) !== meta[k]) pending.add(k); } queue("", true); }

  async function hydrate() {
    const snap = await db.collection(COL).limit(1000).get();
    const remote = {};
    for (const d of snap.docs) { const v = d.data(); if (v && typeof v.key === "string" && (typeof v.value === "string" || v.deleted)) remote[v.key] = v; }
    let touched = false;
    for (const k of new Set(Object.keys(remote).concat(ls.keys()))) {
      if (skip(k)) continue;
      const r = remote[k], l = ls.get(k);
      if (r && r.deleted) {                                            // reset on some device
        if (meta[k] !== GONE) { if (l != null) { try { localStorage.removeItem(k); } catch (e) {} touched = true; } meta[k] = GONE; }
        else if (l != null) pending.add(k);                            // played again here since the reset
        continue;
      }
      const lh = l == null ? null : hash(l), rh = r ? hash(r.value) : null, m = meta[k];
      if (!r) { if (l != null) pending.add(k); continue; }           // only here: upload (migration)
      if (lh === rh) { meta[k] = rh; continue; }                       // already in step
      if (l == null || lh === m) { ls.set(k, r.value); meta[k] = rh; touched = true; continue; } // db is newer
      if (rh === m) { pending.add(k); continue; }                      // this device is newer
      // Both changed since the last sync (two devices).
      if (k === "gfk-collection") { ls.set(k, mergeCards(l, r.value)); meta[k] = rh; pending.add(k); touched = true; }
      else { ls.set(k + ".conflict-backup", l); ls.set(k, r.value); meta[k] = rh; touched = true; }
    }
    saveMeta();
    if (touched) changed();
    queue("", true);
  }

  const ready = (async () => {
    const c = window.claude;
    if (!c || typeof c.use !== "function") return false;
    try { db = await c.use("db"); } catch (e) { db = null; }
    if (!db) return false;
    try { await hydrate(); return true; }
    catch (e) { if (e && e.code === "revoked") db = null; return !!db; }
  })();

  window.addEventListener("storage", e => {
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.key === null) { sweep(); return; }
    if (!skip(e.key)) { queue(e.key); if (e.key === "gfk-collection") changed(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") queue("", true); });

  /* ---- Play each game in a full-screen frame so this page (and its db) stays alive ---- */
  const css = document.createElement("style");
  css.textContent = "#gfk-stage{position:fixed;inset:0;z-index:2147483600;background:#f3e6cf;display:flex;align-items:center;justify-content:center}" +
    "#gfk-stage[hidden]{display:none}#gfk-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}" +
    "#gfk-stage .wait{font:700 20px/1.4 Grandstander,'Trebuchet MS',system-ui,sans-serif;color:#6d3f1f}";
  document.head.appendChild(css);
  const stage = document.createElement("div");
  stage.id = "gfk-stage"; stage.hidden = true;
  stage.innerHTML = '<p class="wait">Fetching your saves…</p><iframe title="Game" allow="autoplay; fullscreen"></iframe>';
  const frame = stage.querySelector("iframe");
  let open = false, lastScroll = 0, openedAt = 0, openHref = "";

  function close() {
    if (!open) return;
    open = false;
    // tell the shelf which game closed and how long it was open (it offers a fun break after practice)
    try { window.dispatchEvent(new CustomEvent("gfk-game-closed", { detail: { href: openHref, ms: Date.now() - openedAt } })); } catch (e) {}
    stage.hidden = true;
    frame.removeAttribute("src");
    document.documentElement.style.overflow = "";
    window.scrollTo(0, lastScroll);
    sweep(); changed();
  }
  async function play(href) {
    if (open) return;
    open = true; lastScroll = window.scrollY;
    frame.style.visibility = "hidden";
    stage.hidden = false;
    document.documentElement.style.overflow = "hidden";
    await Promise.race([ready, new Promise(r => setTimeout(r, 12000))]);
    if (!open) return;
    openedAt = Date.now(); openHref = href;
    frame.src = href;
  }
  frame.addEventListener("load", () => {
    if (!open || !frame.getAttribute("src")) return;
    let w;
    try { w = frame.contentWindow; if (!/\/(math|fun)\/[^/]+\/(index\.html)?$/.test(w.location.pathname)) { close(); return; } }
    catch (e) { return; }
    frame.style.visibility = "";
    try { w.focus(); } catch (e) {}
    // The games' 📚 button links back to the shelf; inside the frame it should just close the game.
    try {
      w.document.addEventListener("click", ev => {
        const a = ev.target && ev.target.closest && ev.target.closest("a[href]");
        if (a && /^(\.\.\/)+index\.html$/.test(a.getAttribute("href"))) { ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
      }, true);
    } catch (e) {}
  });

  function wire() {
    document.body.appendChild(stage);
    document.addEventListener("click", ev => {
      if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      const a = ev.target && ev.target.closest && ev.target.closest("a.book[href]");
      if (!a) return;
      ev.preventDefault();
      play(a.getAttribute("href"));
    });
  }
  if (document.body) wire(); else document.addEventListener("DOMContentLoaded", wire);

  /* Grown-ups' reset: forget a game's save keys and its cards in the binder, here and in the db. */
  function reset(keys, game) {
    if (game === null) keys = Array.from(new Set(keys.concat(ls.keys(), Object.keys(meta).filter(k => meta[k] !== GONE)))).filter(k => !skip(k) && k !== "gfk-collection" && k !== "gfk-voice");
    for (const k of keys) { try { localStorage.removeItem(k); } catch (e) {} if (meta[k] === undefined) meta[k] = "local"; pending.add(k); }
    const cards = ls.get("gfk-collection");
    if (cards != null) {
      let list = []; try { list = JSON.parse(cards) || []; } catch (e) {}
      if (!Array.isArray(list)) list = [];
      const kept = game ? list.filter(c => !c || c.game !== game) : [];
      if (kept.length) ls.set("gfk-collection", JSON.stringify(kept)); else { try { localStorage.removeItem("gfk-collection"); } catch (e) {} if (meta["gfk-collection"] === undefined) meta["gfk-collection"] = "local"; }
      pending.add("gfk-collection");
    }
    saveMeta(); changed(); queue("", true);
  }

  const SAVES = {
    "moonlit-map": ["The Moonlit Map", ["moonlit-map-v2"]],
    "fairy-lantern-festival": ["Fairy Lantern Festival", ["fairyLanternFestival.v1"]],
    "gemling-grids": ["Gemling Grids", ["gemlingGrids.v1"]],
    "egypt-puzzles": ["Miu's Magic Pyramids", ["games-for-kids.egypt-puzzles.v1"]],
    "pirate-voyage": ["The Shining Sea", ["shiningSeaVoyage.v1"]],
    "toadstool-shop": ["The Toadstool Shop", ["toadstoolShop.v1"]],
    "bubble-garden": ["Bubble Garden", ["funBubbleGarden.v1"]],
    "mouse-house": ["Hazel's House", ["funMouseHouse.v1"]],
    "treasure-dig": ["Treasure Dig", ["funTreasureDig.v1"]]
  };
  // Tucked away under "Grown-ups", and each reset needs a two-second press so a stray tap can't wipe anything.
  function resetPanel() {
    const wrap = document.querySelector(".wrap");
    if (!wrap || document.getElementById("gfk-reset")) return;
    css.textContent += "#gfk-reset{font-size:15px;color:#7a6450;text-align:center}#gfk-reset summary{cursor:pointer;font-weight:700}" +
      "#gfk-reset .rows{display:flex;flex-direction:column;gap:8px;max-width:420px;margin:12px auto 0}" +
      "#gfk-reset .row{display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left}" +
      "#gfk-reset button{position:relative;overflow:hidden;font:inherit;font-weight:700;min-height:44px;min-width:150px;border-radius:10px;border:2px solid #d9577a;background:#fffaf0;color:#a33a58;padding:4px 12px;touch-action:none;-webkit-user-select:none;user-select:none}" +
      "#gfk-reset button i{position:absolute;inset:0;width:0;background:#d9577a33;transition:none}#gfk-reset button.hold i{width:100%;transition:width 2s linear}" +
      "#gfk-reset button span{position:relative}#gfk-reset .all{border-color:#a33a58;background:#fde8ee}";
    const d = document.createElement("details");
    d.id = "gfk-reset";
    const rows = Object.entries(SAVES).map(([slug, [title]]) => `<div class="row"><span>${title}</span><button type="button" data-game="${slug}"><i></i><span>Hold to reset</span></button></div>`).join("");
    d.innerHTML = `<summary>Grown-ups: start a game over</summary><div class="rows">${rows}<div class="row"><span>Every game and the whole binder</span><button type="button" class="all" data-game=""><i></i><span>Hold to reset all</span></button></div></div><p>Resetting removes that game's progress and its cards, on every device. The reading voice choice stays.</p>`;
    wrap.appendChild(d);
    d.querySelectorAll("button").forEach(btn => {
      let t = 0;
      const label = btn.querySelector("span"), text = label.textContent;
      const stop = () => { clearTimeout(t); btn.classList.remove("hold"); };
      btn.addEventListener("pointerdown", e => {
        e.preventDefault(); stop(); void btn.offsetWidth; btn.classList.add("hold");
        t = setTimeout(() => {
          btn.classList.remove("hold");
          const g = btn.dataset.game;
          reset(g ? SAVES[g][1] : [].concat(...Object.values(SAVES).map(x => x[1])), g || null);
          label.textContent = "Done ✓";
          setTimeout(() => { label.textContent = text; }, 2500);
        }, 2000);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(n => btn.addEventListener(n, stop));
      btn.addEventListener("contextmenu", e => e.preventDefault());
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", resetPanel); else resetPanel();

  /* Grown-ups' save code: every save on this device as one line of text, to carry her progress to
     another web address (each address keeps its own browser storage) and paste it in there. */
  const CODE = "GFK1:";
  function exportCode() {
    const saves = {};
    for (const k of ls.keys()) { const v = ls.get(k); if (v != null) saves[k] = v; }
    return CODE + btoa(unescape(encodeURIComponent(JSON.stringify({ at: Date.now(), saves }))));
  }
  function importCode(text) {
    // Forgiving about how the code travels: any case, stray text or quotes around it, URL-safe letters.
    let t = String(text || "").replace(/\s+/g, "");
    try { if (/%[0-9a-f]{2}/i.test(t)) t = decodeURIComponent(t); } catch (e) {}
    const m = t.match(/gfk1:([A-Za-z0-9+/_-]+=*)/i);
    if (!m) throw new Error("That doesn't look like a save code.");
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(decodeURIComponent(escape(atob(b64 + "==".slice(0, (4 - b64.length % 4) % 4)))));
    const saves = data && data.saves;
    if (!saves || typeof saves !== "object") throw new Error("That save code is empty.");
    let n = 0;
    for (const [k, v] of Object.entries(saves)) {
      if (skip(k) || typeof v !== "string") continue;
      ls.set(k, k === "gfk-collection" && ls.get(k) != null ? mergeCards(ls.get(k), v) : v);
      pending.add(k); n++;
    }
    changed(); queue("", true);
    return n;
  }
  function movePanel() {
    const wrap = document.querySelector(".wrap");
    if (!wrap || document.getElementById("gfk-move")) return;
    css.textContent += "#gfk-move{font-size:15px;color:#7a6450;text-align:center;margin-top:10px}#gfk-move summary{cursor:pointer;font-weight:700}" +
      "#gfk-move .box{display:flex;flex-direction:column;gap:8px;max-width:420px;margin:12px auto 0}" +
      "#gfk-move textarea{font:12px/1.3 ui-monospace,monospace;min-height:70px;border-radius:10px;border:2px solid #c9b18f;padding:6px;background:#fffaf0;color:#4a3426}" +
      "#gfk-move button{font:inherit;font-weight:700;min-height:44px;border-radius:10px;border:2px solid #6d3f1f;background:#fffaf0;color:#6d3f1f;padding:4px 12px}" +
      "#gfk-move .msg{min-height:1.3em;margin:0;font-weight:700}";
    const d = document.createElement("details");
    d.id = "gfk-move";
    d.innerHTML = `<summary>Grown-ups: move saves to another address</summary><div class="box">` +
      `<button type="button" data-do="copy">Copy save code</button>` +
      `<textarea aria-label="Save code" placeholder="Copy a save code here, or paste one in"></textarea>` +
      `<button type="button" data-do="load">Load pasted save code</button><p class="msg" role="status"></p></div>` +
      `<p>Each web address keeps its own saves. Copy the code on the old one, then paste it here on the new one. Loading adds her cards to the binder and replaces each game's progress with the code's.</p>`;
    wrap.appendChild(d);
    const area = d.querySelector("textarea"), msg = d.querySelector(".msg");
    d.querySelector('[data-do="copy"]').addEventListener("click", async () => {
      area.value = exportCode();
      area.focus(); area.select(); area.setSelectionRange(0, area.value.length);
      let ok = false;
      try { await navigator.clipboard.writeText(area.value); ok = true; } catch (e) { try { ok = document.execCommand("copy"); } catch (e2) {} }
      msg.textContent = ok ? "Copied ✓ Now paste it on the new address." : "Select the code above and copy it.";
    });
    d.querySelector('[data-do="load"]').addEventListener("click", () => {
      try { const n = importCode(area.value); area.value = ""; msg.textContent = `Loaded ${n} save${n === 1 ? "" : "s"} ✓`; }
      catch (e) { msg.textContent = e && /^That /.test(e.message) ? e.message : "That save code didn't work. Try copying it again."; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", movePanel); else movePanel();

  window.SaveSync = { ready, flush: () => queue("", true), close, play, reset, docId, exportCode, importCode };
})();
