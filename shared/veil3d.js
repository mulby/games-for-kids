/* A gentle loading screen that covers a game until its 3D world has drawn, so the old 2D look never flashes first.
   Load it as a plain (blocking) script in <head>, before any of the game's markup:
     <script src="../../shared/veil3d.js" data-bg="#141836" data-glow="#ffd86b" data-ink="#fff4d6" data-text="Lighting the lanterns…"></script>
   data-webgl="no" is for looks that draw with a 2D canvas and do not need WebGL.
   The game's 3D loader calls G3DVeil.ready() when its module has loaded (or failed); the veil then fades away.
   If 3D is turned off (?g3d=0 / ?gl=0) or WebGL is missing, no veil is shown and the 2D game appears at once.
   If 3D takes too long, the veil lifts by itself so the game is never stuck behind it. */
(function () {
  const me = document.currentScript, d = (me && me.dataset) || {}, H = document.documentElement;
  let state = 'off';
  window.G3DVeil = { ready() {}, get state() { return state; } };
  if (/[?&](g3d|gl)=0\b/.test(location.search)) return;
  if (d.webgl !== 'no') {
    let ok = false;
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      ok = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch (e) { ok = false; }
    if (!ok) return;
  }
  const bg = d.bg || '#141836', glow = d.glow || '#ffd86b', ink = d.ink || '#fff4d6';
  const text = JSON.stringify(d.text || 'Getting ready…');
  const st = document.createElement('style');
  st.id = 'g3dveil';
  st.textContent = `
html.g3d-wait body{opacity:0}
html.g3d-wait::before,html.g3d-fade::before{content:${text};position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;
  box-sizing:border-box;padding-bottom:calc(30vh - 3.4em);background:radial-gradient(60% 50% at 50% 46%,${glow}2e,transparent 70%),${bg};color:${ink};
  font:600 clamp(18px,3.2vmin,28px)/1.2 ui-rounded,'SF Pro Rounded','Andika',system-ui,-apple-system,sans-serif;letter-spacing:.02em;
  animation:g3dVeilText 2.4s ease-in-out infinite}
html.g3d-wait::after,html.g3d-fade::after{content:"";position:fixed;z-index:2147483647;left:50%;top:44%;width:min(16vmin,110px);aspect-ratio:1;margin:calc(min(16vmin,110px)/-2) 0 0 calc(min(16vmin,110px)/-2);
  border-radius:50%;background:radial-gradient(circle at 36% 32%,#fff 0 9%,${glow} 38%);
  box-shadow:inset -.12em -.16em .3em #0003,0 0 34px 8px ${glow}88,0 0 90px 24px ${glow}33;font-size:min(16vmin,110px);animation:g3dVeilBob 1.6s ease-in-out infinite alternate}
html.g3d-fade::before,html.g3d-fade::after{pointer-events:none;animation:g3dVeilOut .5s ease forwards}
html.g3d-fade body{animation:g3dVeilIn .5s ease}
@keyframes g3dVeilBob{from{transform:translateY(-8px) scale(.96)}to{transform:translateY(8px) scale(1.04)}}
@keyframes g3dVeilText{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes g3dVeilOut{from{opacity:1}to{opacity:0;visibility:hidden}}
@keyframes g3dVeilIn{from{opacity:.4}to{opacity:1}}
@media (prefers-reduced-motion:reduce){html.g3d-wait::after{animation:none}html.g3d-wait::before{animation:none}}`;
  (document.head || H).appendChild(st);
  H.classList.add('g3d-wait');
  state = 'wait';
  let timer = 0;
  function lift() {
    if (state !== 'wait') return;
    state = 'fade';
    clearTimeout(timer);
    H.classList.add('g3d-fade'); H.classList.remove('g3d-wait');
    setTimeout(() => { H.classList.remove('g3d-fade'); state = 'done'; }, 600);
  }
  // wait two frames so the 3D world has drawn at least once before the veil lifts
  window.G3DVeil.ready = () => requestAnimationFrame(() => requestAnimationFrame(lift));
  timer = setTimeout(lift, 15000);
})();
