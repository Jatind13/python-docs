# Python, from the inside out

An interactive Python reference: lessons you can run in the page, animations of how Python works, and challenges with hidden checks. No build step, no server: plain HTML, CSS and JavaScript.

## Open it on your computer

Double-click `index.html`. For the most reliable behaviour, serve the folder instead:

```bash
cd python-docs
python -m http.server 8000     # on macOS/Linux you may need: python3 -m http.server 8000
# then open http://localhost:8000
```

The first click on any **Run** button downloads the Python runtime (Pyodide, about 10 MB) from a CDN, so that first run needs internet. After that it is cached by the browser.

## Folder map

```
index.html                    landing page + course map
assets/
  site.css                    the whole design (light and dark)
  lessons.js                  THE LESSON LIST: edit this when adding a lesson
  site.js                     sidebar, "on this page", progress, theme, tabs, quizzes, terminal demo
  runner.js                   Run buttons, challenges, bytecode explorer, REPL (real Python via Pyodide)
  anim/python-pipeline.js     the pipeline and virtual-machine animations
lessons/                      one HTML file per lesson
templates/lesson-template.html   copy this to start a new lesson
```

## Add a new lesson (3 steps)

1. Copy `templates/lesson-template.html` to `lessons/<id>.html` (example: `lessons/08-comments.html`).
2. In the new file, set `data-lesson="<id>"` on `<body>` to the same id and write your content.
3. In `assets/lessons.js`, change that lesson's entry to `ready: true` (or add a new entry). The sidebar, course map, previous/next links and progress bar update by themselves.

## Building blocks you can use in any lesson

| You want | Use |
|---|---|
| Syntax-highlighted static code | `<pre><code class="py">...</code></pre>` |
| A runnable, editable code box | `<div class="cell" data-cell data-title="Try it"><textarea class="src">code</textarea></div>` |
| A challenge with a hidden check | a `cell` with `data-challenge="unique-id"` and a `<script type="text/plain" class="test">` containing `assert` lines. In the check, `_out` is everything printed and `_code` is the learner's source. Add `data-inputs='["Asha"]'` to feed `input()`. |
| Bytecode / AST / token viewer | `<div data-explorer data-presets='[["Label","code"]]'></div>` |
| A one-line-at-a-time REPL | `<div data-repl></div>` |
| OS tabs (auto-selects the visitor's OS) | `<div class="tabs" data-tabs data-os>` with `.tablist` buttons and `.tabpanel` sections |
| Terminal typing animation | `<div class="term" data-lines='[["cmd","python hello.py"],["out","Hello"]]'>` |
| Quiz question | `<div class="quiz" data-answer="1" data-explain="..."> ... <button class="opt">` |
| Flip cards | `<button class="flip" aria-pressed="false"><span class="q">..</span><span class="a">..</span></button>` |
| Callouts | `.note`, `.tip`, `.warn` |

## Deploy with GitHub Pages (free, no server)

This is a static site, so GitHub Pages can host it directly. Python runs in the visitor's browser, so there is no backend to pay for or maintain.

1. Create a new **public** repository on GitHub (for example `python-docs`).
2. Put the contents of this folder at the **root** of the repo (so `index.html` is at the top level, not inside another folder).
3. Push it:
   ```bash
   cd python-docs
   git init
   git add .
   git commit -m "Initial site: foundation + two lessons"
   git branch -M main
   git remote add origin https://github.com/<your-username>/python-docs.git
   git push -u origin main
   ```
4. On GitHub: **Settings, Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch **main** and folder **/ (root)**, then **Save**.
5. Wait a minute or two. Your site appears at `https://<your-username>.github.io/python-docs/`. The first deploy can take a few minutes, and the address is shown at the top of the Pages settings.

Every later `git push` to `main` updates the site automatically.

The `.nojekyll` file in this folder tells GitHub Pages to serve the files as they are. All links in the site are relative, so it works under the `/python-docs/` sub-path without changes.

## Known limits (and ideas for later)

- **Infinite loops freeze the tab.** Python runs on the page's main thread. If someone writes `while True:`, they must reload the page. A later upgrade is to run Python in a Web Worker with an interrupt button.
- **`input()` uses the browser's prompt dialog**, since there is no keyboard attached to a web page.
- **Needs internet the first time** to download Pyodide from the jsDelivr CDN. To make the site fully offline you can self-host the Pyodide files in the repo and change `PYODIDE_URL` in `assets/runner.js`.
- **Progress is stored in the visitor's browser** (`localStorage`). It does not sync between devices.
- Bytecode shown by the explorer comes from Python 3.12 (the version inside Pyodide). Other Python versions print slightly different instructions.
