/* One small animation: names, objects, reference counts and garbage collection.
   Usage: <div data-memory></div>  (include this script on the page).
   To change an example, edit the SCENARIOS data below. Each step is a full snapshot:
     names: { name: objectId }      objs: { id: { label, holds: [objectIds] } }      freed: [ids shown as "just freed"] */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const SCENARIOS = [
    { title: "Reference counting", code: ["a = [1, 2, 3]", "b = a", "del a", 'b = "hello"'], steps: [
      { note: "Press Step. Names on the left point to objects on the right. Each object counts how many references it has.", names: {}, objs: {} },
      { note: "Python creates a list object and attaches the name a. Reference count: 1.", names: { a: 1 }, objs: { 1: { label: "list [1, 2, 3]" } } },
      { note: "No new object. A second name points to the same list. Reference count: 2.", names: { a: 1, b: 1 }, objs: { 1: { label: "list [1, 2, 3]" } } },
      { note: "del removes the name a, not the object. The count drops to 1, so the list stays alive.", names: { b: 1 }, objs: { 1: { label: "list [1, 2, 3]" } } },
      { note: "b now points to a new string. Nothing refers to the list any more: its count reached 0, so Python freed it immediately.", names: { b: 2 }, objs: { 2: { label: 'str "hello"' } }, freed: { 1: "list [1, 2, 3]" } }
    ]},
    { title: "Containers hold references", code: ["x = 10", 'items = [x, "hi"]', "x = 20", "del items"], steps: [
      { note: "A list does not contain values. It contains references to objects. Step through to see what that means.", names: {}, objs: {} },
      { note: "The name x points to an int object 10. Reference count: 1.", names: { x: 1 }, objs: { 1: { label: "int 10" } } },
      { note: "The list stores references to its items, not copies. The int 10 now has 2 references: the name x and the list.", names: { x: 1, items: 2 }, objs: { 1: { label: "int 10" }, 2: { label: 'list [10, "hi"]', holds: [1, 3] }, 3: { label: 'str "hi"' } } },
      { note: "x moves to a new int 20. The old 10 is still alive because the list still refers to it.", names: { x: 4, items: 2 }, objs: { 1: { label: "int 10" }, 2: { label: 'list [10, "hi"]', holds: [1, 3] }, 3: { label: 'str "hi"' }, 4: { label: "int 20" } } },
      { note: "The list's count hits 0 and it is freed. Freeing it releases its references, so 10 and \"hi\" reach 0 and are freed too.", names: { x: 4 }, objs: { 4: { label: "int 20" } }, freed: { 2: 'list [10, "hi"]', 1: "int 10", 3: 'str "hi"' } }
    ]},
    { title: "A reference cycle", code: ["a = []", "b = [a]", "a.append(b)", "del a, b", "gc.collect()"], steps: [
      { note: "Reference counting has one weakness: cycles. Step through to see it.", names: {}, objs: {} },
      { note: "An empty list, named a. Count: 1.", names: { a: 1 }, objs: { 1: { label: "list A", holds: [] } } },
      { note: "List B holds a reference to list A, so A now has 2 references (the name a and B).", names: { a: 1, b: 2 }, objs: { 1: { label: "list A", holds: [] }, 2: { label: "list B", holds: [1] } } },
      { note: "Now A holds B and B holds A: a cycle.", names: { a: 1, b: 2 }, objs: { 1: { label: "list A", holds: [2] }, 2: { label: "list B", holds: [1] } } },
      { note: "Both names are gone, yet each list still has 1 reference, from the other list. Neither count reaches 0, so reference counting alone can never free them.", names: {}, objs: { 1: { label: "list A", holds: [2] }, 2: { label: "list B", holds: [1] } } },
      { note: "Python's cyclic garbage collector finds objects that can only be reached from each other and frees them. It also runs automatically from time to time.", names: {}, objs: {}, freed: { 1: "list A", 2: "list B" } }
    ]}
  ];

  function analyse(step) {
    const refs = {}, who = {};
    Object.keys(step.objs).forEach(id => { refs[id] = 0; who[id] = []; });
    for (const [n, id] of Object.entries(step.names)) { refs[id]++; who[id].push(n); }
    for (const [id, o] of Object.entries(step.objs)) (o.holds || []).forEach(h => { refs[h]++; who[h].push("#" + id); });
    const seen = new Set(), stack = Object.values(step.names).map(String);
    while (stack.length) { const id = stack.pop(); if (seen.has(id) || !step.objs[id]) continue; seen.add(id); (step.objs[id].holds || []).forEach(h => stack.push(String(h))); }
    return { refs, who, reachable: seen };
  }

  function init(box) {
    box.innerHTML = `<div class="viz-title">Names, objects and garbage collection</div>
      <div class="viz-sub">Pick an example, then press Step.</div>
      <div class="ctrls" data-tabs-row style="margin:0 0 10px"></div>
      <div class="mem"><div><h5>Code</h5><div class="memcode" data-code></div></div><div><h5>Names</h5><div data-names></div></div><div><h5>Objects in memory</h5><div data-objs class="memobjs"></div></div></div>
      <div class="smnote" data-note aria-live="polite"></div>
      <div class="ctrls"><button class="btn run" data-next>Step</button><button class="btn" data-prev>Back</button><button class="btn" data-reset>Reset</button><span class="grow" data-count></span></div>`;
    let sc = 0, i = 0;
    const row = $("[data-tabs-row]", box);
    SCENARIOS.forEach((s, k) => { const b = document.createElement("button"); b.className = "btn"; b.textContent = s.title; b.dataset.k = k; b.addEventListener("click", () => { sc = k; i = 0; render(); }); row.append(b); });
    function render() {
      const S = SCENARIOS[sc], st = S.steps[i], prev = i > 0 ? S.steps[i - 1] : { objs: {} }, A = analyse(st);
      $$("[data-k]", box).forEach(b => b.style.borderColor = +b.dataset.k === sc ? "var(--yellow)" : "");
      $("[data-code]", box).innerHTML = S.code.map((l, k) => `<div class="${k === i - 1 ? "cur" : k < i - 1 ? "did" : ""}">${esc(l)}</div>`).join("");
      const names = Object.entries(st.names);
      $("[data-names]", box).innerHTML = names.length ? names.map(([n, id]) => `<div class="mname"><b>${esc(n)}</b> <span>points to #${id}</span></div>`).join("") : `<div class="mempty">no names</div>`;
      let h = "";
      for (const [id, o] of Object.entries(st.objs)) {
        const r = A.refs[id], lost = !A.reachable.has(id) && r > 0, fresh = !prev.objs[id];
        h += `<div class="mobj ${fresh ? "fresh" : ""} ${lost ? "warn" : ""}"><div><b>#${id}</b> ${esc(o.label)}</div><div class="mrefs">refs: <b>${r}</b>${A.who[id].length ? " (from " + esc(A.who[id].join(", ")) + ")" : ""}</div>${lost ? '<div class="mtag">unreachable, but not freed yet</div>' : ""}</div>`;
      }
      for (const [id, label] of Object.entries(st.freed || {})) h += `<div class="mobj ghost"><div><b>#${id}</b> ${esc(label)}</div><div class="mtag">refs: 0, freed</div></div>`;
      $("[data-objs]", box).innerHTML = h || `<div class="mempty">no objects</div>`;
      $("[data-note]", box).textContent = st.note;
      $("[data-count]", box).textContent = `Step ${i} of ${S.steps.length - 1}`;
      $("[data-prev]", box).disabled = i === 0; $("[data-next]", box).disabled = i === S.steps.length - 1;
    }
    $("[data-next]", box).addEventListener("click", () => { if (i < SCENARIOS[sc].steps.length - 1) { i++; render(); } });
    $("[data-prev]", box).addEventListener("click", () => { if (i > 0) { i--; render(); } });
    $("[data-reset]", box).addEventListener("click", () => { i = 0; render(); });
    render();
  }
  function boot() { $$("[data-memory]").forEach(init); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
