/* Two teaching animations for "How Python works":
   [data-pipeline]     : source -> tokens -> AST -> bytecode -> (.pyc) -> virtual machine -> output
   [data-stackmachine] : the Python Virtual Machine executing bytecode on a value stack
   Both are driven by explicit data below, so you can change the example code in one place. */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hl = s => (window.highlightPython ? window.highlightPython(s) : esc(s));

  const SOURCE = "a = 2\nb = 3\ntotal = a + b\nprint(total)";
  const chips = arr => `<div class="chips">${arr.map(([t, k]) => `<span class="chip">${esc(t)}${k ? `<i>${k}</i>` : ""}</span>`).join("")}</div>`;
  const BYTECODE = [
    "RESUME 0", "LOAD_CONST 2", "STORE_NAME a", "LOAD_CONST 3", "STORE_NAME b", "LOAD_NAME a", "LOAD_NAME b",
    "BINARY_OP +", "STORE_NAME total", "PUSH_NULL", "LOAD_NAME print", "LOAD_NAME total", "CALL 1", "POP_TOP", "RETURN_CONST None"
  ];

  /* ---------------- pipeline ---------------- */
  const STAGES = [
    { dot: ".py", name: "Source", title: "1. Your source file",
      body: "Python starts with plain text. At this point it is only characters in a file. Nothing knows yet what any of it means.",
      inLabel: "Input", inHTML: `<pre><code>hello.py on disk</code></pre>`, outLabel: "Output", outHTML: `<pre><code class="py">${esc(SOURCE)}</code></pre>` },
    { dot: "tok", name: "Tokenizer", title: "2. The tokenizer: characters become tokens",
      body: "The tokenizer reads the text and groups characters into the smallest meaningful pieces: names, numbers, operators and line endings. Spaces between tokens are thrown away.",
      inLabel: "Input", inHTML: `<pre><code class="py">${esc(SOURCE)}</code></pre>`,
      outLabel: "Output (first two lines)", outHTML: chips([["a", "NAME"], ["=", "OP"], ["2", "NUMBER"], ["\\n", "NEWLINE"], ["b", "NAME"], ["=", "OP"], ["3", "NUMBER"], ["\\n", "NEWLINE"], ["... 14 more", ""]]) },
    { dot: "AST", name: "Parser", title: "3. The parser: tokens become a tree (AST)",
      body: "The parser checks the tokens against Python's grammar and builds an Abstract Syntax Tree. This is where a SyntaxError is raised, before a single line has run.",
      inLabel: "Input", inHTML: chips([["a", "NAME"], ["=", "OP"], ["2", "NUMBER"], ["...", ""]]),
      outLabel: "Output (simplified)", outHTML: `<pre><code>Module\n ├─ Assign  a     = Constant(2)\n ├─ Assign  b     = Constant(3)\n ├─ Assign  total = BinOp(a + b)\n └─ Expr    Call(print, [total])</code></pre>` },
    { dot: "bc", name: "Compiler", title: "4. The compiler: the tree becomes bytecode",
      body: "The compiler walks the tree and emits bytecode: small, simple instructions for Python's own virtual machine. They are not instructions for your CPU. It also does small optimisations, such as turning 2 + 3 into 5 ahead of time.",
      inLabel: "Input", inHTML: `<pre><code>Module\n ├─ Assign a = 2\n └─ ...</code></pre>`,
      outLabel: "Output (code object, first lines)", outHTML: `<pre><code>${BYTECODE.slice(0, 8).map(esc).join("\n")}\n...</code></pre>` },
    { dot: ".pyc", name: "Cache (optional)", opt: true, title: "5. The .pyc cache (only sometimes)",
      body: "When you import a module, Python saves its bytecode to __pycache__ so that next time it can skip steps 2 to 4, as long as the source file has not changed. The script you run directly is compiled in memory every time and is not cached this way.",
      inLabel: "Input", inHTML: `<pre><code>bytecode for utils.py</code></pre>`,
      outLabel: "Output (a file)", outHTML: `<pre><code>__pycache__/utils.cpython-312.pyc\n  header: magic number, flags, source time/hash, size\n  body:   the compiled code object</code></pre>` },
    { dot: "VM", name: "Virtual machine", title: "6. The Python Virtual Machine runs the bytecode",
      body: "The PVM is a loop written in C inside the python program (CPython). It fetches one instruction, does what it says using a value stack, then moves to the next. Your CPU runs this loop. It never runs your bytecode directly. Step through it in the next section.",
      inLabel: "Input", inHTML: `<pre><code>${BYTECODE.slice(0, 5).map(esc).join("\n")}\n...</code></pre>`,
      outLabel: "What happens", outHTML: `<pre><code>fetch instruction\ndo it (push, pop, add, call...)\nnext instruction</code></pre>` },
    { dot: "out", name: "Output", title: "7. Output",
      body: "print() writes text to sys.stdout. The operating system then shows it in your terminal.",
      inLabel: "Input", inHTML: `<pre><code>print(total)  # total is 5</code></pre>`, outLabel: "Output", outHTML: `<pre><code>5</code></pre>` }
  ];
  function initPipeline(box) {
    box.innerHTML = `<div class="viz-title">From a .py file to output</div><div class="viz-sub">Press Play, or click any stage. The sample program is four lines long.</div>
      <div class="pipe" data-pipe><span class="packet" data-packet></span>${STAGES.map((s, i) => `<button class="pnode ${s.opt ? "opt" : ""}" data-i="${i}" aria-label="${esc(s.name)}"><span class="dot">${esc(s.dot)}</span><span>${esc(s.name)}</span></button>`).join("")}</div>
      <div class="pstage" data-stage aria-live="polite"></div>
      <div class="ctrls"><button class="btn run" data-play>Play</button><button class="btn" data-prev>Back</button><button class="btn" data-next>Next</button><button class="btn" data-reset>Reset</button><span class="grow" data-count></span></div>`;
    let i = 0, timer = null;
    const nodes = $$(".pnode", box), pipe = $("[data-pipe]", box), packet = $("[data-packet]", box), stage = $("[data-stage]", box);
    const center = n => n.offsetLeft + n.offsetWidth / 2;
    function paint(from) {
      nodes.forEach((n, k) => { n.classList.toggle("now", k === i); n.classList.toggle("past", k < i); });
      const s = STAGES[i];
      stage.innerHTML = `<h4>${esc(s.title)}</h4><p>${esc(s.body)}</p><div class="io"><div><b>${esc(s.inLabel)}</b>${s.inHTML}</div><div><b>${esc(s.outLabel)}</b>${s.outHTML}</div></div>`;
      if (window.highlightPython) $$("code.py", stage).forEach(c => c.innerHTML = hl(c.textContent));
      $("[data-count]", box).textContent = `Stage ${i + 1} of ${STAGES.length}`;
      if (!reduce && from != null && from !== i) {
        packet.style.transition = "none"; packet.style.opacity = "1"; packet.style.left = center(nodes[from]) + "px";
        void packet.offsetWidth;
        packet.style.transition = "left .6s cubic-bezier(.5,.1,.2,1)"; packet.style.left = center(nodes[i]) + "px";
        setTimeout(() => { packet.style.opacity = "0"; }, 650);
      }
    }
    function go(n) { const from = i; i = Math.max(0, Math.min(STAGES.length - 1, n)); paint(from); if (i === STAGES.length - 1) stop(); }
    function stop() { clearInterval(timer); timer = null; $("[data-play]", box).textContent = "Play"; }
    function play() {
      if (timer) return stop();
      if (i >= STAGES.length - 1) go(0);
      $("[data-play]", box).textContent = "Pause";
      timer = setInterval(() => go(i + 1), 3400);
    }
    nodes.forEach(n => n.addEventListener("click", () => { stop(); go(+n.dataset.i); }));
    $("[data-play]", box).addEventListener("click", play);
    $("[data-next]", box).addEventListener("click", () => { stop(); go(i + 1); });
    $("[data-prev]", box).addEventListener("click", () => { stop(); go(i - 1); });
    $("[data-reset]", box).addEventListener("click", () => { stop(); go(0); });
    paint(null);
  }

  /* ---------------- stack machine ---------------- */
  const PROG = [
    { op: "RESUME", arg: "0", line: 0, note: "Start-up bookkeeping. Nothing visible happens." },
    { op: "LOAD_CONST", arg: "2", line: 1, note: "Push the constant 2 onto the stack." },
    { op: "STORE_NAME", arg: "a", line: 1, note: "Pop the top of the stack (2) and bind the name a to it." },
    { op: "LOAD_CONST", arg: "3", line: 2, note: "Push the constant 3." },
    { op: "STORE_NAME", arg: "b", line: 2, note: "Pop 3 and bind the name b to it." },
    { op: "LOAD_NAME", arg: "a", line: 3, note: "Look up the name a and push its value (2)." },
    { op: "LOAD_NAME", arg: "b", line: 3, note: "Look up the name b and push its value (3)." },
    { op: "BINARY_OP", arg: "+", line: 3, note: "Pop two values, add them, push the result (5)." },
    { op: "STORE_NAME", arg: "total", line: 3, note: "Pop 5 and bind the name total to it." },
    { op: "PUSH_NULL", arg: "", line: 4, note: "Push a placeholder that the upcoming call uses for bookkeeping." },
    { op: "LOAD_NAME", arg: "print", line: 4, note: "Look up print (a built-in function) and push it." },
    { op: "LOAD_NAME", arg: "total", line: 4, note: "Push the value of total (5): this will be print's argument." },
    { op: "CALL", arg: "1", line: 4, note: "Call print with 1 argument: pops the argument and the function, runs print (it writes 5), pushes the result None." },
    { op: "POP_TOP", arg: "", line: 4, note: "Throw away the value print returned (None)." },
    { op: "RETURN_CONST", arg: "None", line: 4, note: "The module is finished. The program ends." }
  ];
  const NULLV = { k: "null" }, NONEV = { k: "none" }, FNV = { k: "fn" };
  function simulate() {
    const states = [{ stack: [], vars: {}, out: [], fresh: false, newVar: null }];
    for (let n = 0; n < PROG.length; n++) {
      const p = states[n], s = { stack: p.stack.slice(), vars: Object.assign({}, p.vars), out: p.out.slice(), fresh: false, newVar: null }, ins = PROG[n];
      switch (ins.op) {
        case "LOAD_CONST": s.stack.push(+ins.arg); s.fresh = true; break;
        case "STORE_NAME": s.vars[ins.arg] = s.stack.pop(); s.newVar = ins.arg; break;
        case "LOAD_NAME": s.stack.push(ins.arg === "print" ? FNV : s.vars[ins.arg]); s.fresh = true; break;
        case "BINARY_OP": { const b = s.stack.pop(), a = s.stack.pop(); s.stack.push(a + b); s.fresh = true; break; }
        case "PUSH_NULL": s.stack.push(NULLV); s.fresh = true; break;
        case "CALL": { const arg = s.stack.pop(); s.stack.pop(); s.stack.pop(); s.out.push(String(arg)); s.stack.push(NONEV); s.fresh = true; break; }
        case "POP_TOP": s.stack.pop(); break;
      }
      states.push(s);
    }
    return states;
  }
  function initStack(box) {
    const states = simulate(), lines = SOURCE.split("\n");
    box.innerHTML = `<div class="viz-title">Inside the virtual machine</div><div class="viz-sub">Each Step runs one bytecode instruction. Watch the stack and the variables change.</div>
      <div class="sm"><div><h5>Source and bytecode</h5><div class="srcbox" data-src>${lines.map((l, k) => `<div data-l="${k + 1}">${hl(l)}</div>`).join("")}</div><ol data-ins>${PROG.map((p, k) => `<li data-k="${k}"><span>${k}</span><span>${p.op} ${esc(p.arg)}</span></li>`).join("")}</ol></div>
      <div><h5>Value stack (top is highest)</h5><div class="stack" data-stack></div></div>
      <div><h5>Variables (names)</h5><table class="vars" data-vars></table><h5 style="margin-top:12px">Output</h5><div class="smout" data-out></div></div></div>
      <div class="smnote" data-note aria-live="polite"></div>
      <div class="ctrls"><button class="btn run" data-next>Step</button><button class="btn" data-prev>Back</button><button class="btn" data-auto>Run all</button><button class="btn" data-reset>Reset</button><button class="btn" data-real>Show real bytecode</button><span class="grow" data-count></span></div>
      <pre class="real" data-realout hidden style="margin-top:12px"></pre>`;
    let n = 0, timer = null;
    const render = () => {
      const s = states[n]; // state n = the machine after n instructions have run
      $("[data-stack]", box).innerHTML = s.stack.map((v, k) => {
        const lab = v === NULLV ? "NULL" : v === NONEV ? "None" : v === FNV ? "print (function)" : String(v);
        return `<div class="cellv ${v === NULLV ? "null" : ""} ${s.fresh && !reduce && k === s.stack.length - 1 ? "fresh" : ""}">${esc(lab)}</div>`;
      }).join("") || `<span style="color:var(--muted);font-size:13px">(empty)</span>`;
      const names = Object.keys(s.vars);
      $("[data-vars]", box).innerHTML = names.length ? `<tr><th>name</th><th>value</th></tr>` + names.map(k => `<tr class="${s.newVar === k ? "new" : ""}"><td>${esc(k)}</td><td>${esc(s.vars[k])}</td></tr>`).join("") : `<tr><td style="color:var(--muted)">no variables yet</td></tr>`;
      $("[data-out]", box).textContent = s.out.join("\n");
      const prevIns = n > 0 ? PROG[n - 1] : null;
      $("[data-note]", box).innerHTML = n === 0 ? "Press <b>Step</b> to run the first instruction." : `<b>${prevIns.op} ${esc(prevIns.arg)}</b>: ${esc(prevIns.note)}` + (n >= PROG.length ? " <b>Done.</b>" : "");
      $("[data-count]", box).textContent = `${n} of ${PROG.length} instructions run`;
      // highlight the instruction that just ran (n-1), and the line it belongs to
      $$("[data-ins] li", box).forEach((li, k) => { li.classList.toggle("cur", k === n - 1); li.classList.toggle("did", k < n - 1); });
      const ranLine = n > 0 ? PROG[n - 1].line : 0;
      $$("[data-src] div", box).forEach(d => d.classList.toggle("cur", ranLine > 0 && +d.dataset.l === ranLine));
    };
    const stop = () => { clearInterval(timer); timer = null; $("[data-auto]", box).textContent = "Run all"; };
    $("[data-next]", box).addEventListener("click", () => { stop(); if (n < PROG.length) { n++; render(); } });
    $("[data-prev]", box).addEventListener("click", () => { stop(); if (n > 0) { n--; render(); } });
    $("[data-reset]", box).addEventListener("click", () => { stop(); n = 0; render(); });
    $("[data-auto]", box).addEventListener("click", () => {
      if (timer) return stop();
      if (n >= PROG.length) n = 0; render();
      $("[data-auto]", box).textContent = "Pause";
      timer = setInterval(() => { if (n >= PROG.length) return stop(); n++; render(); }, reduce ? 300 : 1000);
    });
    $("[data-real]", box).addEventListener("click", async () => {
      const out = $("[data-realout]", box), b = $("[data-real]", box);
      out.hidden = false; out.textContent = "Loading Python...";
      try { const r = await window.PyRunner.explore({ code: SOURCE }, m => out.textContent = m); out.textContent = r.dis || r.error; b.disabled = true; }
      catch (e) { out.textContent = e.message || String(e); }
    });
    render();
  }
  function boot() { $$("[data-pipeline]").forEach(initPipeline); $$("[data-stackmachine]").forEach(initStack); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
