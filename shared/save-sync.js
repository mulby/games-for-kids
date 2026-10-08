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
  const COL = "saves", META = "gfk-sync-meta", BIG = 240 * 1024;
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
    if (v == null) { if (meta[k] !== undefined) { await ref.delete(); delete meta[k]; } return; }
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
    for (const d of snap.docs) { const v = d.data(); if (v && typeof v.key === "string" && typeof v.value === "string") remote[v.key] = v; }
    let touched = false;
    for (const k of new Set(Object.keys(remote).concat(ls.keys()))) {
      if (skip(k)) continue;
      const r = remote[k], l = ls.get(k);
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
  let open = false, lastScroll = 0;

  function close() {
    if (!open) return;
    open = false;
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
    frame.src = href;
  }
  frame.addEventListener("load", () => {
    if (!open || !frame.getAttribute("src")) return;
    let w;
    try { w = frame.contentWindow; if (!/\/math\/[^/]+\/(index\.html)?$/.test(w.location.pathname)) { close(); return; } }
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

  window.SaveSync = { ready, flush: () => queue("", true), close, play, docId };
})();
