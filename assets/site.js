/* Shared behaviour: layout, sidebar, on-this-page list, progress, theme, tabs, quizzes, checklists, syntax highlight. */
(function () {
  "use strict";
  const COURSE = window.COURSE;
  const ROOT = document.body.dataset.root || "./";
  const CURRENT = document.body.dataset.lesson || "";
  const KEY = "pydocs-progress-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- progress (localStorage, falls back to memory) ---------- */
  let mem = { done: {}, extra: {} };
  const Progress = {
    load() { try { const v = localStorage.getItem(KEY); if (v) mem = Object.assign(mem, JSON.parse(v)); } catch (e) {} return mem; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} },
    isDone(id) { return !!mem.done[id]; },
    setDone(id, v) { if (v) mem.done[id] = 1; else delete mem.done[id]; this.save(); },
    getExtra(k) { return mem.extra[k]; },
    setExtra(k, v) { mem.extra[k] = v; this.save(); }
  };
  Progress.load();
  window.Progress = Progress;

  const flat = COURSE.parts.flatMap(p => p.lessons.map(l => Object.assign({ part: p.title }, l)));
  const hrefOf = l => ROOT + "lessons/" + l.id + ".html";

  /* ---------- theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  try { applyTheme(localStorage.getItem("pydocs-theme")); } catch (e) {}
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next); try { localStorage.setItem("pydocs-theme", next); } catch (e) {}
  }

  /* ---------- python syntax highlight (light, regex based) ---------- */
  const KW = "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" ");
  const BI = "print input len range int str float bool list dict set tuple type id abs sum min max sorted enumerate zip open round isinstance help dir repr".split(" ");
  function highlight(src) {
    const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) out += `<span class="tk-com">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="tk-str">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="tk-num">${esc(m[3])}</span>`;
      else if (KW.includes(m[4])) out += `<span class="tk-kw">${esc(m[4])}</span>`;
      else if (BI.includes(m[4])) out += `<span class="tk-bi">${esc(m[4])}</span>`;
      else out += esc(m[4]);
    }
    return out + esc(src.slice(last));
  }
  window.highlightPython = highlight;
  function highlightAll(root = document) { $$("code.py", root).forEach(c => { if (!c.dataset.hl) { c.innerHTML = highlight(c.textContent); c.dataset.hl = 1; } }); }

  /* ---------- page chrome ---------- */
  function build() {
    const article = $("article.doc");
    if (!article) return;
    const hdr = document.createElement("header");
    hdr.className = "hdr";
    hdr.innerHTML = `<div class="hdr-in"><button class="ibtn menu-btn" aria-label="Open page list" id="menu">Pages</button>
      <a class="logo" href="${ROOT}index.html"><i></i><span>${esc(COURSE.title)}</span></a><span class="sp"></span>
      <button class="ibtn" id="theme" aria-label="Switch light or dark theme">Theme</button></div><div class="course-bar" aria-hidden="true"><i id="cbar"></i></div>`;
    const layout = document.createElement("div");
    layout.className = "layout";
    const side = document.createElement("nav");
    side.className = "side"; side.setAttribute("aria-label", "Pages");
    const toc = document.createElement("aside");
    toc.className = "toc"; toc.setAttribute("aria-label", "On this page");
    document.body.prepend(layout); document.body.prepend(hdr);
    layout.append(side, article, toc);
    renderSide(side);
    renderToc(toc, article);
    addPager(article);
    $("#theme").addEventListener("click", toggleTheme);
    $("#menu").addEventListener("click", () => document.body.classList.toggle("nav-open"));
    side.addEventListener("click", e => { if (e.target.closest("a")) document.body.classList.remove("nav-open"); });
    refreshProgress();
  }
  function renderSide(side) {
    let n = 0, h = `<input type="search" id="q" placeholder="Search pages" aria-label="Search pages">`;
    for (const p of COURSE.parts) {
      h += `<section data-part><h3>${esc(p.title)}</h3><ul>`;
      for (const l of p.lessons) {
        n++; const num = String(n).padStart(2, "0");
        const inner = `<span class="tick" data-tick="${l.id}"></span><span class="num">${num}</span><span>${esc(l.title)}</span>`;
        h += l.ready
          ? `<li data-t="${esc(l.title.toLowerCase())}"><a href="${hrefOf(l)}" ${l.id === CURRENT ? 'aria-current="page"' : ""}>${inner}<span class="tag">${l.min} min</span></a></li>`
          : `<li data-t="${esc(l.title.toLowerCase())}"><span class="soon" title="Not written yet">${inner}<span class="tag">Soon</span></span></li>`;
      }
      h += `</ul></section>`;
    }
    side.innerHTML = h;
    $("#q", side).addEventListener("input", e => {
      const v = e.target.value.trim().toLowerCase();
      $$("li[data-t]", side).forEach(li => li.hidden = v && !li.dataset.t.includes(v));
      $$("[data-part]", side).forEach(s => s.hidden = !$$("li", s).some(li => !li.hidden));
    });
  }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
  function renderToc(toc, article) {
    const hs = $$("h2", article);
    if (!hs.length) { toc.hidden = true; return; }
    hs.forEach(h => { if (!h.id) h.id = slug(h.textContent); });
    toc.innerHTML = `<b>On this page</b>` + hs.map(h => `<a href="#${h.id}">${esc(h.textContent)}</a>`).join("");
    if ("IntersectionObserver" in window) {
      const links = $$("a", toc);
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) { links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); } });
      }, { rootMargin: "-80px 0px -70% 0px" });
      hs.forEach(h => io.observe(h));
    }
  }
  function addPager(article) {
    if (!CURRENT) return;
    const ready = flat.filter(l => l.ready), i = ready.findIndex(l => l.id === CURRENT);
    if (i < 0) return;
    const done = document.createElement("div");
    done.className = "done-row";
    done.innerHTML = `<button class="btn run" id="markdone"></button><p id="donetxt"></p>`;
    article.append(done);
    const pager = document.createElement("div");
    pager.className = "pager";
    const prev = ready[i - 1], next = ready[i + 1];
    pager.innerHTML = (prev ? `<a href="${hrefOf(prev)}"><small>Previous</small>${esc(prev.title)}</a>` : `<span></span>`) +
      (next ? `<a href="${hrefOf(next)}"><small>Next</small>${esc(next.title)}</a>` : `<span></span>`);
    article.append(pager);
    $("#markdone").addEventListener("click", () => { Progress.setDone(CURRENT, !Progress.isDone(CURRENT)); refreshProgress(); });
    const foot = document.createElement("p");
    foot.className = "foot";
    foot.textContent = "Interactive Python runs in your browser (Pyodide, CPython 3.12). Your progress is saved on this device only.";
    article.append(foot);
  }
  function refreshProgress() {
    const total = flat.filter(l => l.ready).length, done = flat.filter(l => l.ready && Progress.isDone(l.id)).length;
    const bar = $("#cbar"); if (bar) bar.style.width = (total ? done / total * 100 : 0) + "%";
    $$("[data-tick]").forEach(t => t.textContent = Progress.isDone(t.dataset.tick) ? "\u2713" : "");
    const b = $("#markdone"), t = $("#donetxt");
    if (b) { const d = Progress.isDone(CURRENT); b.textContent = d ? "Marked complete" : "Mark page complete"; t.textContent = d ? "Nice work. Click again to undo." : "Do the challenges first, then mark this page complete to track progress."; }
    const cnt = $("#course-count"); if (cnt) cnt.textContent = `${done} of ${total} pages complete`;
  }
  window.refreshProgress = refreshProgress;

  /* ---------- tabs ---------- */
  function initTabs(root = document) {
    $$("[data-tabs]", root).forEach(box => {
      const btns = $$(".tablist button", box), panels = $$(".tabpanel", box);
      const show = id => { btns.forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === id))); panels.forEach(p => p.hidden = p.dataset.panel !== id); box.dispatchEvent(new CustomEvent("tabchange", { detail: id })); };
      btns.forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
      let start = btns[0].dataset.tab;
      if (box.hasAttribute("data-os")) {
        const ua = navigator.userAgent; const os = /Win/.test(ua) ? "win" : /Mac/.test(ua) ? "mac" : /Linux|X11/.test(ua) ? "linux" : start;
        if (btns.some(b => b.dataset.tab === os)) start = os;
      }
      show(start);
    });
  }

  /* ---------- quiz ---------- */
  function initQuiz() {
    $$(".quiz").forEach(q => {
      const ans = +q.dataset.answer, opts = $$(".opt", q), fb = $(".fb", q);
      opts.forEach((o, i) => o.addEventListener("click", () => {
        opts.forEach(x => x.classList.remove("right", "wrong"));
        o.classList.add(i === ans ? "right" : "wrong");
        fb.textContent = i === ans ? (q.dataset.explain || "Correct.") : "Not quite. Try another option.";
        if (i === ans) opts[ans].classList.add("right");
      }));
    });
  }

  /* ---------- checklist (saved per item) ---------- */
  function initTodo() {
    $$("input[data-todo]").forEach(cb => {
      const k = "todo:" + cb.dataset.todo, row = cb.closest("label");
      cb.checked = !!Progress.getExtra(k); row && row.classList.toggle("done", cb.checked);
      cb.addEventListener("change", () => { Progress.setExtra(k, cb.checked ? 1 : 0); row && row.classList.toggle("done", cb.checked); });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    build(); highlightAll(); initTabs(); initQuiz(); initTodo();
    const lp = $("#course-parts"); if (lp) renderLanding(lp);
    refreshProgress();
    document.dispatchEvent(new CustomEvent("site-ready"));
  });

  /* landing page course map */
  function renderLanding(el) {
    let n = 0, h = "";
    for (const p of COURSE.parts) {
      h += `<section class="part"><h3>${esc(p.title)}</h3><ul>`;
      for (const l of p.lessons) {
        n++; const num = String(n).padStart(2, "0");
        const inner = `<span class="tick" data-tick="${l.id}"></span><span>${num}</span><span>${esc(l.title)}</span>`;
        h += l.ready ? `<li><a href="${hrefOf(l)}">${inner}<span class="tag">${l.min} min</span></a></li>` : `<li><span class="soon">${inner}<span class="tag">Soon</span></span></li>`;
      }
      h += `</ul></section>`;
    }
    el.innerHTML = h;
  }
})();
