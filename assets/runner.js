/*
  runner.js: runs REAL Python (CPython 3.12 compiled to WebAssembly by the Pyodide project) inside the page.
  Python is downloaded from a CDN the first time someone clicks Run (about 10 MB), then cached by the browser.
  Provides: <div class="cell" data-cell> editable/runnable code cells, challenges with hidden tests,
  <div data-explorer> (tokens / AST / bytecode viewer) and <div data-repl> (a one-line-at-a-time REPL).
*/
(function () {
  "use strict";
  const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---- Python side: kept as one block so it can also be tested with a normal Python install ---- */
  const PY_BOOT = String.raw`
import sys, io, builtins, traceback, contextlib, ast, dis, tokenize, json, linecache

_STORE = {}

def _builtins_for(buf, queue):
    b = dict(vars(builtins))
    def _input(prompt=""):
        buf.write(str(prompt))
        if queue is not None:
            if not queue:
                raise EOFError("EOF when reading a line")
            v = str(queue.pop(0))
        else:
            from js import window
            r = window.__pyPrompt(str(prompt) if str(prompt) else "Python is waiting for input()")
            if str(r) == "\u0000CANCEL":
                raise EOFError("input cancelled")
            v = str(r)
        buf.write(v + "\n")
        return v
    b["input"] = _input
    return b

def _fmt_exc(e):
    if isinstance(e, SyntaxError):
        return "".join(traceback.format_exception_only(type(e), e))
    tb = e.__traceback__
    if tb is not None:
        tb = tb.tb_next
    return "".join(traceback.format_exception(type(e), e, tb))

def _run(code, ns, buf, queue, test=None):
    linecache.cache["<your code>"] = (len(code), None, code.splitlines(True), "<your code>")
    ns["__builtins__"] = _builtins_for(buf, queue)
    status, msg = "ok", ""
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        try:
            exec(compile(code, "<your code>", "exec"), ns)
        except SystemExit:
            pass
        except BaseException as e:
            status = "error"
            buf.write(_fmt_exc(e))
    if status == "ok" and test:
        ns["_out"] = buf.getvalue()
        ns["_code"] = code
        try:
            exec(compile(test, "<check>", "exec"), ns)
            status = "pass"
        except AssertionError as e:
            status, msg = "fail", (str(e) or "That is not quite what the task asked for.")
        except BaseException as e:
            status, msg = "fail", "The check could not run: " + type(e).__name__ + ": " + str(e)
    return status, msg

def run_json(payload):
    p = json.loads(payload)
    key = p.get("key") or "cell"
    if p.get("fresh", True) or key not in _STORE:
        _STORE[key] = {"__name__": "__main__"}
    buf = io.StringIO()
    status, msg = _run(p["code"], _STORE[key], buf, p.get("inputs"), p.get("test"))
    return json.dumps({"status": status, "out": buf.getvalue(), "msg": msg})

def explore_json(payload):
    code = json.loads(payload)["code"]
    res = {"tokens": [], "ast": "", "dis": "", "error": ""}
    try:
        for t in tokenize.generate_tokens(io.StringIO(code).readline):
            if t.type == tokenize.ENDMARKER:
                continue
            res["tokens"].append([tokenize.tok_name[t.type], t.string, "%d:%d" % t.start])
    except Exception as e:
        res["error"] = "%s: %s" % (type(e).__name__, e)
    try:
        res["ast"] = ast.dump(ast.parse(code), indent=2)
        co = compile(code, "<your code>", "exec")
        s = io.StringIO()
        dis.dis(co, file=s)
        res["dis"] = s.getvalue()
        res["error"] = ""
    except SyntaxError as e:
        res["error"] = "".join(traceback.format_exception_only(type(e), e))
    return json.dumps(res)

def repl_json(payload):
    p = json.loads(payload)
    ns = _STORE.setdefault("repl", {"__name__": "__main__"})
    buf = io.StringIO()
    status = "ok"
    ns["__builtins__"] = _builtins_for(buf, None)
    def _hook(v):
        if v is not None:
            print(repr(v))
    old = sys.displayhook
    sys.displayhook = _hook
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            try:
                exec(compile(p["line"], "<stdin>", "single"), ns)
            except SystemExit:
                pass
            except BaseException as e:
                status = "error"
                buf.write(_fmt_exc(e))
    finally:
        sys.displayhook = old
    return json.dumps({"status": status, "out": buf.getvalue()})
`;

  /* ---- loader ---- */
  window.__pyPrompt = msg => { const v = window.prompt(msg); return v === null ? "\u0000CANCEL" : v; };
  let loading = null, ready = false;
  function getPy(onStatus) {
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        if (window.loadPyodide) return start();
        const s = document.createElement("script");
        s.src = PYODIDE_URL + "pyodide.js";
        s.onload = start;
        s.onerror = () => reject(new Error("Could not download the Python runtime. Check your internet connection and try again."));
        document.head.appendChild(s);
        async function start() {
          try {
            if (onStatus) onStatus("Starting Python...");
            const py = await window.loadPyodide({ indexURL: PYODIDE_URL });
            py.runPython(PY_BOOT);
            ready = true; resolve(py);
          } catch (e) { reject(e); }
        }
      });
      loading.catch(() => { loading = null; });
    }
    return loading;
  }
  async function call(fn, payload, onStatus) {
    if (!ready && onStatus) onStatus("Loading Python (first run downloads about 10 MB)...");
    const py = await getPy(onStatus);
    py.globals.set("_payload", JSON.stringify(payload));
    return JSON.parse(py.runPython(fn + "(_payload)"));
  }
  window.PyRunner = {
    run: (p, cb) => call("run_json", p, cb),
    explore: (p, cb) => call("explore_json", p, cb),
    repl: (p, cb) => call("repl_json", p, cb),
    _boot: PY_BOOT
  };

  /* ---- code cells ---- */
  function fit(ta) { ta.rows = Math.max(3, Math.min(18, ta.value.split("\n").length + 1)); }
  function enableTab(ta, onRun) {
    ta.addEventListener("keydown", e => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault(); const s = ta.selectionStart, t = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(t); ta.selectionStart = ta.selectionEnd = s + 4;
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun(); }
    });
    ta.addEventListener("input", () => fit(ta));
  }
  function initCell(cell) {
    const ta = $("textarea.src", cell); if (!ta) return;
    const initial = ta.value.replace(/^\n/, ""); ta.value = initial; fit(ta);
    const id = cell.dataset.challenge || "", testEl = $("script.test", cell), test = testEl ? testEl.textContent : null;
    const inputs = cell.dataset.inputs ? JSON.parse(cell.dataset.inputs) : null;
    const head = document.createElement("div"); head.className = "cell-h";
    head.innerHTML = `<span>${esc(cell.dataset.title || "Try it")}</span>${id ? '<span class="badge" data-badge>Not solved yet</span>' : ""}<span class="st" data-st></span>`;
    cell.prepend(head);
    const bar = document.createElement("div"); bar.className = "cell-bar";
    bar.innerHTML = `<button class="btn run" data-run>Run</button>${test ? '<button class="btn" data-check>Check answer</button>' : ""}<button class="btn" data-reset>Reset</button><span class="hint">Ctrl + Enter to run</span>`;
    const out = document.createElement("pre"); out.className = "out"; out.setAttribute("aria-live", "polite");
    const verdict = document.createElement("div"); verdict.className = "verdict"; verdict.setAttribute("aria-live", "polite");
    ta.after(bar, out, verdict);
    const st = $("[data-st]", cell), badge = $("[data-badge]", cell);
    const setSolved = () => { if (badge) { badge.textContent = "Solved"; badge.classList.add("done"); } };
    if (id && window.Progress && window.Progress.getExtra("ch:" + id)) setSolved();
    let busy = false;
    async function go(check) {
      if (busy) return; busy = true;
      $$("button", bar).forEach(b => b.disabled = true);
      out.className = "out"; out.textContent = ""; verdict.className = "verdict"; verdict.textContent = "";
      try {
        const r = await window.PyRunner.run({ code: ta.value, key: id || cell.dataset.key || "cell", fresh: true, inputs: check ? inputs : null, test: check ? test : null }, m => st.textContent = m);
        st.textContent = "Python 3.12 ready";
        out.textContent = r.out; if (r.status === "error") out.classList.add("err");
        if (check) {
          if (r.status === "pass") { verdict.className = "verdict pass"; verdict.textContent = "Correct. Nice work."; setSolved(); if (window.Progress) window.Progress.setExtra("ch:" + id, 1); }
          else if (r.status === "fail") { verdict.className = "verdict fail"; verdict.textContent = r.msg; }
          else { verdict.className = "verdict fail"; verdict.textContent = "Your code raised an error. Read the message above, fix it, then check again."; }
        }
      } catch (e) { st.textContent = ""; out.className = "out err"; out.textContent = e.message || String(e); }
      busy = false; $$("button", bar).forEach(b => b.disabled = false);
    }
    $("[data-run]", cell).addEventListener("click", () => go(false));
    const chk = $("[data-check]", cell); if (chk) chk.addEventListener("click", () => go(true));
    $("[data-reset]", cell).addEventListener("click", () => { ta.value = initial; fit(ta); out.textContent = ""; verdict.className = "verdict"; verdict.textContent = ""; });
    enableTab(ta, () => go(false));
  }

  /* ---- explorer: tokens / AST / bytecode ---- */
  function initExplorer(box) {
    const presets = JSON.parse(box.dataset.presets || "[]");
    const first = box.dataset.code || (presets[0] && presets[0][1]) || "x = 1";
    box.innerHTML = `<div class="presets">${presets.map((p, i) => `<button class="btn" data-p="${i}">${esc(p[0])}</button>`).join("")}</div>
      <div class="cell" style="margin-bottom:0;border-radius:10px 10px 0 0"><textarea class="src" spellcheck="false"></textarea>
      <div class="cell-bar"><button class="btn run" data-go>Show what Python sees</button><span class="hint" data-st>Ctrl + Enter</span></div></div>
      <div data-tabs class="tabs" style="margin:0"><div class="tablist" style="margin:0;background:var(--surface2);padding:0 8px"><button data-tab="dis">Bytecode</button><button data-tab="ast">AST</button><button data-tab="tok">Tokens</button></div>
      <div class="tabpanel" data-panel="dis"><div class="panel" data-o="dis"></div></div>
      <div class="tabpanel" data-panel="ast"><div class="panel" data-o="ast"></div></div>
      <div class="tabpanel" data-panel="tok"><div class="panel" data-o="tok"></div></div></div>`;
    const ta = $("textarea", box); ta.value = first; fit(ta);
    const btns = $$(".tablist button", box), panels = $$(".tabpanel", box);
    const show = id => { btns.forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === id))); panels.forEach(p => p.hidden = p.dataset.panel !== id); };
    btns.forEach(b => b.addEventListener("click", () => show(b.dataset.tab))); show("dis");
    const st = $("[data-st]", box);
    async function go() {
      $("[data-go]", box).disabled = true;
      try {
        const r = await window.PyRunner.explore({ code: ta.value }, m => st.textContent = m);
        st.textContent = "Ctrl + Enter";
        if (r.error && !r.dis) { for (const k of ["dis", "ast", "tok"]) $(`[data-o=${k}]`, box).textContent = r.error; }
        else {
          $("[data-o=dis]", box).textContent = r.dis; $("[data-o=ast]", box).textContent = r.ast;
          const vis = s => s.replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/ /g, "\u00b7");
          $("[data-o=tok]", box).innerHTML = `<table><tr><th>Type</th><th>Text</th><th>Line:col</th></tr>${r.tokens.map(t => `<tr><td>${esc(t[0])}</td><td>${esc(vis(t[1]))}</td><td>${esc(t[2])}</td></tr>`).join("")}</table>`;
        }
      } catch (e) { for (const k of ["dis", "ast", "tok"]) $(`[data-o=${k}]`, box).textContent = e.message || String(e); st.textContent = ""; }
      $("[data-go]", box).disabled = false;
    }
    $("[data-go]", box).addEventListener("click", go);
    enableTab(ta, go);
    $$("[data-p]", box).forEach(b => b.addEventListener("click", () => { ta.value = presets[+b.dataset.p][1]; fit(ta); go(); }));
  }

  /* ---- mini REPL: one line at a time ---- */
  function initRepl(box) {
    box.innerHTML = `<div class="repl-log" data-log aria-live="polite"><span class="pr">Python 3.12 REPL. Type one line at a time, press Enter.</span>\n</div>
      <form class="repl-in" onsubmit="return false"><span>&gt;&gt;&gt;</span><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Python prompt" placeholder="try: 2 + 3"></form>`;
    const log = $("[data-log]", box), inp = $("input", box), hist = []; let hi = 0, busy = false;
    const add = (cls, t) => { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = t; log.append(d); log.scrollTop = log.scrollHeight; };
    inp.addEventListener("keydown", async e => {
      if (e.key === "ArrowUp" && hist.length) { hi = Math.max(0, hi - 1); inp.value = hist[hi]; e.preventDefault(); }
      else if (e.key === "ArrowDown" && hist.length) { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ""; e.preventDefault(); }
      else if (e.key === "Enter" && !busy) {
        const line = inp.value; if (!line.trim()) return;
        hist.push(line); hi = hist.length; inp.value = ""; add("", ">>> " + line); busy = true;
        try {
          const r = await window.PyRunner.repl({ line }, m => add("pr", m));
          if (r.out) add(r.status === "error" ? "er" : "", r.out.replace(/\n$/, ""));
        } catch (err) { add("er", err.message || String(err)); }
        busy = false;
      }
    });
  }

  function boot() { $$(".cell[data-cell]").forEach(initCell); $$("[data-explorer]").forEach(initExplorer); $$("[data-repl]").forEach(initRepl); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
