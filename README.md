# Parsec

A free, local-first tool to format, compare, and convert JSON, XML, YAML, and CSV — entirely in the browser. Nothing you paste or drop is ever sent anywhere.

## Features

- **Format** — auto-detects JSON / XML / YAML / CSV, pretty-prints or minifies, plus a **Validate** button with clear error detail (line/column where possible) and a collapsible **Tree** view of the parsed data.
- **Compare** — line-level diff between two documents, with:
  - **Normalize** option (re-formats JSON/XML/YAML before diffing so pure formatting changes don't show up as noise)
  - **Move detection** — a field that was only reordered/shuffled is shown as *moved*, not as a fake delete+add
  - **Word-level modified-line highlighting** — a line that was only partially edited shows exactly which words changed
- **Convert** — any direction between JSON, XML, YAML, and CSV
- **Drag-and-drop** file loading (or click "Upload") on every input box
- **Dark / light theme** toggle, remembered between visits
- No build step, no external CDN dependencies, no analytics, no network calls of any kind — it's plain HTML/CSS/JS

## Running it

Just open `index.html` in a browser. That's it — no server, no install.

## Hosting it for free on GitHub Pages

1. Create a new **public** GitHub repository.
2. Upload this whole folder's contents (keep the `css/` and `js/` folders as-is, at the repo root, alongside `index.html`).
3. Go to **Settings → Pages** → under "Build and deployment", set **Source: Deploy from a branch**, branch **main**, folder **/ (root)** → Save.
4. Wait about a minute, refresh that page, and your live URL will appear as `https://<your-username>.github.io/<repo-name>/`.

Any time you edit and commit files in the repo, the live site updates automatically within a minute or so.

## Project structure

```
index.html          Page shell — links the CSS and loads the JS modules in order
css/
  style.css          All styling, including dark/light theme variables
js/
  yaml.js            Local YAML parser/stringifier (no external library)
  formats.js         JSON/XML/CSV/YAML parsing, formatting, validation, cross-conversion
  diff.js            Line-level diff engine + move detection + word-level modified-line diff
  tree.js            Collapsible tree viewer for any parsed value
  theme.js           Dark/light theme toggle (persisted in localStorage)
  dragdrop.js         Drag-and-drop / click-to-upload file loading for textareas
  app.js             Wires all of the above into the UI (tabs, buttons, event handlers)
```

Scripts are loaded as plain `<script src="...">` tags (not ES modules) on purpose — this keeps the site working if you just double-click `index.html` locally, since some browsers block `type="module"` imports over the `file://` protocol.

## Known limitations

- The bundled YAML engine covers the common subset of YAML (nested mappings/sequences, flow collections, quoted/plain scalars, comments). It does **not** support anchors/aliases (`&x`/`*x`), tags (`!!str`), multi-document streams (`---`), or block scalars (`|`/`>`). Unsupported syntax raises a clear error rather than silently producing wrong output.
- Move and modified-line detection in Compare are heuristics based on matching/similar line text — they work well for typical structured data (JSON/XML/YAML/CSV) but won't catch every possible rearrangement.
- Very large documents (roughly >2,000–3,000 lines on each side) may be slow to diff, since the diff algorithm is O(n×m); the tool will tell you if a comparison is too large rather than freezing the page.
