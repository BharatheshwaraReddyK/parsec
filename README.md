# Parsec

A free, local-first tool to format, compare, and convert JSON, XML, YAML, and CSV — entirely in the browser. Nothing you paste or drop is ever sent anywhere.

## Features

- **Format** — auto-detects JSON / XML / YAML / CSV, pretty-prints or minifies, plus a **Validate** button with clear error detail (line/column where possible) and a collapsible **Tree** view of the parsed data.
- **Compare** — line-level diff between two documents, with:
  - **Normalize** option (re-formats JSON/XML/YAML before diffing so pure formatting changes don't show up as noise)
  - **Move detection** — a field that was only reordered/shuffled is shown as *moved*, not as a fake delete+add
  - **Word-level modified-line highlighting** — a line that was only partially edited shows exactly which words changed
  - **"Only in A" / "Only in B" labeling with +/− symbols** — fields present in just one side are labeled by presence, not by an implied edit action (avoids the misleading "removed from A" phrasing when nothing was actually deleted by anyone). Symbols (`+`, `−`, `⇄` for moved, `~` for modified) are baked into the actual text, not just CSS coloring, so they survive copy-paste, screen readers, and the downloaded report
  - **Download report** — saves the original (A) and changed (B) payloads exactly as pasted, the summary stats, a symbol legend, and the full color-coded + symbol-coded diff, as **HTML**, **PDF**, or **PNG**:
    - **HTML** — always works, opens in any browser
    - **PDF** — uses the browser's native print engine ("Save as PDF" in the print dialog); no library needed, reliable everywhere
    - **PNG** — best-effort, no external library; works in most modern browsers but some (notably some Safari versions) may block canvas image export as a security precaution — if it fails, use HTML or PDF instead
- **Convert** — any direction between JSON, XML, YAML, and CSV, with:
  - **Strip root wrapper** (XML source only) — drops the outer root element name and its own attributes (e.g. namespace declarations), so `{"n0:Root": {"@xmlns:n0": "...", "Records": {...}}}` becomes just `{"Records": {...}}`
  - **CSV delimiter** — comma, semicolon, tab, pipe, or a custom character
  - **Row field** — pick which nested field (e.g. `Records.Items`) should become the CSV rows, with auto-suggested paths from your actual input; leave blank to fall back to "first array found"
  - **Include parent fields on each row** (checked by default) — repeats sibling/order-level fields (e.g. `OrderId`, `DriverID`) onto every row, so a one-to-many structure like "one order, many line items" produces one CSV row per item with the order context carried along on each
  - **Rebuild nesting & group repeated rows** (CSV source only, checked by default) — the inverse of the above: rows sharing identical dot-notation "context" columns (e.g. `Records.OrderId`) are grouped back into one parent record with an **array** of the varying columns nested at the given **Array field** (e.g. `Records.Items`), instead of one flat `<row>` per CSV line. The array field is auto-guessed from the column names but can be typed in manually if the guess is off.
  - **Root tag** (CSV→XML only) — lets you set the output's root element name explicitly. This matters because a root element's own name and attributes (e.g. `xmlns` namespace declarations) are only recoverable if they were still present as columns in the CSV — if the original XML→CSV step had "Strip root wrapper" checked, that data was dropped before the CSV was ever created and can't be reconstructed automatically. To get a fully faithful round trip including the original root name and namespaces, leave "Strip root wrapper" **unchecked** when going XML→CSV in the first place; those show up as extra columns (like `n0:MyRoot.@xmlns:n0`) that get rebuilt correctly on the way back.
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

## License

Released under the MIT License — see `LICENSE`. For a full technical write-up of the design and architecture (useful if you want to publish or reference this work), see `WHITEPAPER.md`.

## Known limitations

- The bundled YAML engine covers the common subset of YAML (nested mappings/sequences, flow collections, quoted/plain scalars, comments). It does **not** support anchors/aliases (`&x`/`*x`), tags (`!!str`), multi-document streams (`---`), or block scalars (`|`/`>`). Unsupported syntax raises a clear error rather than silently producing wrong output.
- Move and modified-line detection in Compare are heuristics based on matching/similar line text — they work well for typical structured data (JSON/XML/YAML/CSV) but won't catch every possible rearrangement.
- Very large documents (roughly >2,000–3,000 lines on each side) may be slow to diff, since the diff algorithm is O(n×m); the tool will tell you if a comparison is too large rather than freezing the page.
