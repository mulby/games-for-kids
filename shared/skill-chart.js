/* The grown-ups' skill chart on The Wonder Shelf: every Common Core K-3 math skill the games practise, coloured by
   how well she knows it (see shared/skills.js for the log and the mastery rule).
   Load after skills.js; it adds a "Grown-ups: math skills chart" panel to the page's .wrap, above the other
   grown-ups panels, and redraws whenever it is opened or a save changes. */
(function () {
  'use strict';
  const K = window.GFKSkills;
  if (!K) return;
  const STATES = {
    mastered: ['Mastered', '#3f8f5e', '#e3f3e8'],
    slow: ['Right, but slow', '#b07d12', '#fbf0d2'],
    practicing: ['Practicing', '#3c68b8', '#e4ecfa'],
    learning: ['Learning', '#c0603a', '#fbe7dd'],
    review: ['Check again', '#7f55b3', '#efe6fa'],
    new: ['Not seen yet', '#9a8a78', '#f4efe7'],
  };
  const GRADES = [['K', 'Kindergarten'], ['1', '1st grade'], ['2', '2nd grade'], ['3', '3rd grade']];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = `
#gfk-skills{font-size:15px;color:var(--ink,#3a2a1f)}
#gfk-skills>summary{cursor:pointer;font-weight:700;color:var(--ink-soft,#7a6450);text-align:center}
#gfk-skills .sk-in{margin-top:12px;background:var(--paper,#fffaf0);border-radius:16px;padding:16px;box-shadow:0 4px 0 #0001}
#gfk-skills .sk-head{margin:0 0 10px;font-size:17px}
#gfk-skills .sk-legend{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0 0 14px;font-size:13px}
#gfk-skills .sk-legend span{display:inline-flex;align-items:center;gap:5px}
#gfk-skills .sk-legend i{width:12px;height:12px;border-radius:4px;display:inline-block}
#gfk-skills .sk-grades{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
#gfk-skills .sk-grade h3{font-size:16px;margin:0 0 4px;color:var(--wood-dark,#6d3f1f)}
#gfk-skills .sk-grade .sk-sum{font-size:13px;color:var(--ink-soft,#7a6450);margin:0 0 8px}
#gfk-skills .sk-strand{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft,#7a6450);margin:10px 0 4px}
#gfk-skills .sk{border-left:5px solid var(--c);background:var(--b);border-radius:8px;padding:6px 8px;margin:0 0 6px;line-height:1.25}
#gfk-skills .sk b{display:block;font-size:13px}
#gfk-skills .sk code{font-size:11px;color:var(--ink-soft,#7a6450)}
#gfk-skills .sk small{display:block;font-size:12px;color:var(--ink-soft,#7a6450);margin-top:2px}
#gfk-skills .sk .dots{display:flex;gap:2px;margin-top:4px}
#gfk-skills .sk .dots i{width:8px;height:8px;border-radius:50%;background:#d9cbb7}
#gfk-skills .sk .dots i.y{background:var(--c)}
#gfk-skills .sk-notes{font-size:13px;color:var(--ink-soft,#7a6450);margin:12px 0 0}
#gfk-skills .sk-notes p{margin:6px 0 0}
#gfk-skills .sk-moves{margin:4px 0 0;padding-left:18px}
#gfk-skills .sk-moves li{margin:2px 0}
@media (max-width:760px){#gfk-skills .sk-grades{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){#gfk-skills .sk-grades{grid-template-columns:1fr}}`;

  function ago(ms) {
    const d = Math.floor((Date.now() - ms) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d} days ago` : `${Math.round(d / 7)} weeks ago`;
  }
  function tile(c, st, d) {
    const S = K.SKILLS[c], [label, col, bg] = STATES[st.state];
    let info = label;
    if (st.state !== 'new') {
      info += ` · ${st.ok} of last ${st.recent} right first try`;
      if (st.ms) info += ` · about ${Math.max(1, Math.round(st.ms / 1000))}s`;
      if (st.bareMs && S.fast) info += ` (plain facts ${Math.max(1, Math.round(st.bareMs / 1000))}s, knowing it is under ${S.fast / 1000}s)`;
      info += ` · ${ago(st.last)}`;
    }
    const recent = st.state === 'new' ? [] : (S.from ? [] : ((d.s[c] || {}).e || []).slice(-10));
    const dots = recent.length ? `<span class="dots" aria-hidden="true">${recent.map(r => `<i class="${r[1] ? 'y' : ''}"></i>`).join('')}</span>` : '';
    return `<div class="sk" style="--c:${col};--b:${bg}"><b>${esc(S.name)}</b><code>${c}</code><small>${esc(info)}</small>${dots}</div>`;
  }
  // the levels the games moved by the chart (shared/skills.js place/note), newest first
  const GAMES = { 'toadstool-shop': 'Toadstool Shop', 'pirate-voyage': 'The Shining Sea', 'fairy-lantern': 'Fairy Lantern Festival', 'gemling-grids': 'Gemling Grids', 'egypt-puzzles': "Miu's Magic Pyramids" };
  const WHY = { mastered: 'mastered the skills there', shaky: 'finding it hard', 'good day': 'a good day', 'hard day': 'a hard day' };
  function movesHTML() {
    const m = K.moves ? K.moves().slice(-12).reverse() : [];
    const rows = m.map(([t, g, what, from, to, why]) => {
      const up = typeof from === 'number' ? to > from : why === 'mastered';
      return `<li>${up ? '⬆️' : '⬇️'} <b>${esc(GAMES[g] || g)}</b>, ${esc(what)}: ${esc(typeof from === 'number' ? `level ${from} to ${to}` : `${from} to ${to}`)} (${esc(WHY[why] || why)}, ${ago(t)})</li>`;
    }).join('');
    return `<div class="sk-notes"><p><b>How the games are fitting to her.</b> Once a day each math game checks this chart: skills she has mastered (in any game) move that game up a level, and skills she is finding hard move it down one. ${rows ? 'Recent moves:' : 'No moves yet.'}</p>${rows ? `<ul class="sk-moves">${rows}</ul>` : ''}</div>`;
  }
  function render(box) {
    const d = K.read(), all = K.LIST.map(c => [c, K.status(c, d)]);
    const tried = all.filter(([, s]) => s.state !== 'new');
    let head;
    if (!tried.length) head = 'Nothing yet. As she plays the math games, every problem is filed under its skill here.';
    else {
      const parts = GRADES.map(([g, name]) => {
        const L = all.filter(([c]) => K.SKILLS[c].grade === g), m = L.filter(([, s]) => s.state === 'mastered' || s.state === 'review').length, t = L.filter(([, s]) => s.state !== 'new').length;
        return t ? `${name}: ${m} of ${L.length} mastered` : null;
      }).filter(Boolean);
      head = parts.join(' · ') + '.';
    }
    const legend = Object.values(STATES).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
    const grades = GRADES.map(([g, name]) => {
      const L = all.filter(([c]) => K.SKILLS[c].grade === g);
      const m = L.filter(([, s]) => s.state === 'mastered' || s.state === 'review').length;
      let h = `<div class="sk-grade"><h3>${name}</h3><p class="sk-sum">${m} of ${L.length} mastered</p>`;
      for (const strand of Object.keys(K.STRANDS)) {
        const S = L.filter(([c]) => K.SKILLS[c].strand === strand);
        if (!S.length) continue;
        h += `<div class="sk-strand">${esc(K.STRANDS[strand])}</div>` + S.map(([c, st]) => tile(c, st, d)).join('');
      }
      return h + '</div>';
    }).join('');
    box.innerHTML = `<p class="sk-head">${esc(head)}</p><div class="sk-legend">${legend}</div><div class="sk-grades">${grades}</div>${movesHTML()}
      <div class="sk-notes">
        <p><b>Mastered</b> means at least 8 of her last 10 tries were right the first time with no help, on 2 or more different days. <b>Right, but slow</b> means she gets plain facts right but they take longer than knowing them would, so she is probably still counting. <b>Check again</b> means mastered, but not seen for 3 weeks.</p>
        <p>The skills are the <a href="https://www.thecorestandards.org/Math/" target="_blank" rel="noopener">Common Core math standards</a> for kindergarten to 3rd grade that the games practise, so not every standard is here (shapes and measuring are missing, for example). Waldorf schools teach in a different order, so a skill she hasn't seen may just not have been taught yet.</p>
      </div>`;
  }
  function panel() {
    const wrap = document.querySelector('.wrap');
    if (!wrap || document.getElementById('gfk-skills')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('details');
    d.id = 'gfk-skills';
    d.innerHTML = '<summary>Grown-ups: math skills chart</summary><div class="sk-in"></div>';
    // above the other grown-ups' panels
    const before = document.getElementById('voicepick');
    if (before && before.parentNode === wrap) wrap.insertBefore(d, before); else wrap.appendChild(d);
    const box = d.querySelector('.sk-in');
    const draw = () => { if (d.open) render(box); };
    d.addEventListener('toggle', draw);
    window.addEventListener('gfk-saves-changed', draw);
    window.addEventListener('gfk-game-closed', () => setTimeout(draw, 300));
    window.addEventListener('storage', e => { if (e.key === K.KEY || e.key === K.ADAPT) draw(); });
    // bring in what the games saved before the chart existed, once the shelf has fetched her saves
    const ready = window.SaveSync && window.SaveSync.ready;
    Promise.resolve(ready).then(() => { if (K.importOld()) { if (window.SaveSync && SaveSync.sweep) SaveSync.sweep(); draw(); } }, () => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel); else panel();
})();
