# Parsec: A Local-First Tool for Structured Data Formatting, Comparison, and Conversion

**Author:** Bharatheshwara Reddy K
**Date:** July 2026
**License:** MIT (see `LICENSE`)
**Status:** v1.0

---

## Abstract

Parsec is a browser-based utility for working with structured data formats — JSON, XML, YAML, and CSV. It provides three core capabilities: pretty-printing and validating a single document, comparing two documents with structural awareness, and converting between formats while preserving (or deliberately discarding) nesting, namespaces, and repeated-record structure. The entire application runs client-side with no server component, no build step, and no third-party runtime dependencies — every parser, diff algorithm, and export routine is hand-written. This paper documents the problem the tool addresses, the architecture, and the specific engineering decisions — particularly around diffing, structural CSV round-tripping, and dependency-free document export — that distinguish it from typical single-purpose format converters.

## 1. Motivation

Developers and integration engineers routinely need to inspect, compare, and reshape structured payloads — API responses, SAP/XML proxy messages, configuration files, exported spreadsheets. Existing tools tend to specialize narrowly: a JSON formatter doesn't diff; a diff tool doesn't convert; a CSV converter doesn't understand nested XML namespaces. Free web-based converters also frequently send pasted data to a remote server, which is unacceptable for anyone working with production payloads containing customer or business data.

Parsec was built to close that gap: one tool, entirely client-side, covering formatting, structural comparison, and lossless-where-possible conversion across the four formats used most often in integration and API work.

## 2. Design Principles

- **Local-first.** No network calls are made with user data at any point. All parsing, diffing, and conversion happens in the browser. This is a hard constraint, not a marketing claim — it's verifiable by reading the source, since there are no `fetch`/`XMLHttpRequest` calls operating on document content anywhere in the codebase.
- **No runtime dependencies.** No CDN-loaded libraries. The YAML parser, the diff engine, and the PDF/PNG export routines are all original code written for this project, rather than wrapping an existing library (e.g. `js-yaml`, `diff`, `html2canvas`). This keeps the tool fully functional offline and removes an entire class of supply-chain risk.
- **Multi-file, script-tag architecture — not ES modules.** Each concern (YAML, format conversion, diffing, tree rendering, theming, drag-and-drop) lives in its own file under `js/`, attached to a shared `window.Parsec*` namespace. ES module imports were deliberately avoided because they fail under the `file://` protocol in several browsers (blocked by CORS policy on local module fetches), which would break the "just double-click `index.html`" use case that local-first tools should support.
- **Progressive disclosure of complexity.** Structural controls (root-wrapper stripping, CSV delimiter, row-field selection, nesting reconstruction) only appear in the UI when the current From/To format combination makes them relevant, rather than presenting every option all the time.

## 3. Architecture Overview

```
index.html          Page shell; loads CSS and JS modules in dependency order
css/style.css        All styling, including CSS-variable-driven dark/light themes
js/yaml.js           Hand-written YAML parser/stringifier
js/formats.js        JSON/XML/CSV/YAML parsing, formatting, validation, structural conversion
js/diff.js           Line-level diff engine, move detection, modification detection
js/tree.js           Collapsible tree viewer for any parsed value
js/theme.js           Dark/light theme toggle (persisted in localStorage)
js/dragdrop.js        Drag-and-drop / click-to-upload file loading
js/app.js             UI wiring: tabs, event handlers, report generation
```

Scripts are loaded via plain `<script src>` tags in dependency order (yaml → formats → diff → tree → theme → dragdrop → app), each attaching its public API to a namespaced global (`window.ParsecYAML`, `window.ParsecFormats`, `window.ParsecDiff`, `window.ParsecTree`, `window.ParsecTheme`, `window.ParsecDragDrop`). `app.js` is the only file that touches the DOM directly for wiring; the other modules are pure functions operating on strings and plain JS values, which made them straightforward to unit-test in a plain Node.js REPL during development, independent of a browser environment.

## 4. The YAML Engine

Rather than depend on `js-yaml`, Parsec implements an indentation-based recursive-descent parser covering the common subset of YAML actually used in configuration files and API payloads: nested block mappings and sequences, flow collections (`{...}`, `[...]`), plain/single/double-quoted scalars, numbers, booleans, null, comments, and inline `- key: value` sequence items.

Deliberately unsupported: anchors/aliases (`&x`/`*x`), tags (`!!str`), multi-document streams (`---`), and block scalars (`|`/`>`). These are rare in the integration-payload use case Parsec targets, and supporting them correctly would roughly double the parser's complexity for a small minority of inputs. Unsupported constructs raise a clear, catchable error rather than silently mis-parsing — an explicit design trade-off favoring correctness-or-failure over silent data corruption.

## 5. The Diff Engine

### 5.1 Base algorithm

Line-level diffing uses the standard dynamic-programming longest-common-subsequence (LCS) approach: an `(n+1) × (m+1)` table is built comparing every line of document A against every line of document B, then traced back to classify each line as `same`, `removed`, or `added`. This is O(n·m) time and space; a pathological-size guard (`n·m > 6,000,000`) short-circuits with a clear "too large" message rather than freezing the tab on very large inputs.

### 5.2 Move detection

Plain LCS diffing has a well-known limitation: it cannot distinguish "this line moved" from "this line was deleted, and an unrelated line was inserted elsewhere." Parsec adds a post-processing pass: every `removed` line and every `added` line with identical trimmed text (above a minimum length, to avoid false-positives on trivial lines like bare closing tags) are paired and re-classified as `moved-from` / `moved-to`, each annotated with the line number of its counterpart. This turns "one field got reordered in a 200-line XML payload" from a confusing delete+insert pair into a single, clearly-labeled move.

### 5.3 Modified-line detection with a meaningful-token threshold

A further pass looks for **adjacent** `removed` → `added` pairs and asks whether they represent a partial edit of the same line rather than two unrelated changes. The first implementation used raw token-level LCS similarity (Dice coefficient over all tokens, including punctuation and whitespace separators). This over-triggered: two completely unrelated short lines like `completelyDifferentFieldOnlyInA: 42` and `unrelatedNewFieldInB: hello` share enough punctuation tokens (`:`, spaces) to cross a naive similarity threshold, incorrectly presenting them as one "modified" line.

The fix — validated with targeted test cases during development — restricts the similarity measure to alphanumeric tokens only, filtering out structural punctuation before computing the Dice coefficient, and raises the acceptance threshold accordingly. This was caught and corrected through iterative testing against adversarial examples, not assumed correct on first implementation.

When two lines *are* judged to be a genuine edit, a second, finer-grained token-level LCS is run between them specifically to highlight which words changed, rendered as `<span class="tok-removed">` / `<span class="tok-added">` within the line rather than coloring the whole line.

### 5.4 Symbol semantics

Diff rows are labeled `+` (only in B), `−` (only in A), `⇄` (moved), and `~` (modified) — baked directly into the rendered text content, not applied via CSS `::before` pseudo-elements. This was a deliberate correction: CSS-generated content is invisible to copy-paste, to screen readers, and to several PDF/email renderers, which silently dropped the symbols from any exported or copied version of the diff. The labels themselves were also revised from action-implying language ("Removed from A", "Added in B") to presence-describing language ("Only in A", "Only in B"), since Compare is a comparison between two arbitrary documents, not necessarily an edit history — "removed" implies an action that may not have occurred.

## 6. Structural Conversion

### 6.1 The flatten/unflatten problem

Converting nested JSON/XML/YAML to CSV requires flattening: a field at `Records.Items[0].ItemNumber` becomes a column named `Records.Items[0].ItemNumber` with a single scalar value. Converting *back* requires the inverse — reconstructing nesting and arrays from dot/bracket-notation column names. Parsec implements both directions (`flattenObj` / `unflattenObj`) and, critically, tests that they round-trip correctly rather than only implementing the forward direction, which was an initial gap identified during development (flattening was implemented before it was noticed that the reverse direction was needed for a faithful round trip).

### 6.2 Row-set selection

A nested document can contain multiple arrays at different depths. Rather than guessing, Parsec exposes `findArrayPaths()` to discover every array-valued path in a parsed document and lets the user pick which one should become the CSV row set (with an auto-suggested default of "first array found" for the common case). A companion `parentContextFor()` walks the **full ancestor chain** from the document root down to the chosen array's parent — not just the immediate parent — collecting sibling fields at every level. This means root-level attributes (e.g. XML namespace declarations) are correctly carried onto every CSV row if present, not just the immediate parent object's fields — a generalization made necessary by testing against a real-world namespaced XML payload with attributes several levels above the repeating element.

### 6.3 Reverse grouping

Going from CSV back to nested XML/JSON, rows that share identical "context" column values (columns containing a `.`, by convention) are grouped back into a single parent record with an array of the varying ("item") columns nested at a user-specified (or auto-guessed, via longest-common-dot-prefix) array field path. Without this, every CSV row would independently produce its own top-level wrapper element, duplicating shared parent data across every row of output instead of reconstructing the original one-to-many structure.

### 6.4 Root wrapper handling

XML documents typically have a single root element, often carrying namespace declarations as attributes. Parsec offers an explicit "strip root wrapper" option for XML→(JSON/YAML/CSV) conversion, and — the more interesting case — full automatic reconstruction on the reverse path: if the root wrapper and its attributes were *not* stripped during export (so they exist as flattened CSV columns), the ancestor-chain-aware context builder and the standard `unflattenObj` correctly rebuild the original root element name and its namespace attributes with no additional user input, because attribute keys prefixed with `@` are recognized as XML attributes by the same code path used everywhere else in the tool. Where that information genuinely isn't recoverable (because it was stripped before export), an explicit "root tag" override lets the user supply it manually rather than the tool guessing or silently losing it.

## 7. Dependency-Free Document Export

The Compare tab can export a comparison (source, target, and diff) as HTML, PDF, or PNG, without any external library:

- **HTML** is a plain self-contained string with inline CSS — trivially reliable.
- **PDF** uses the browser's own print engine: the report is loaded into a hidden `<iframe>`, and `iframe.contentWindow.print()` is invoked, letting the user select "Save as PDF" from the browser's native print destinations. This required no PDF-generation code at all — it reuses functionality every modern browser already ships.
- **PNG** is best-effort: the rendered report is serialized into a self-contained SVG using `<foreignObject>`, drawn onto a `<canvas>`, and exported via `canvas.toBlob()`. This works in most current browsers for content with no external image/font dependencies (which the report satisfies, by design). It is documented as best-effort because some browsers — Safari in particular — impose stricter security policies around canvas export of `foreignObject`-rendered SVG content and may refuse the operation. Rather than fail silently, the implementation catches this and directs the user to the HTML or PDF options, which have no such restriction.

## 8. Limitations

- The YAML engine does not support anchors, aliases, tags, multi-document streams, or block scalars (§4).
- Move and modification detection in Compare are heuristics; they handle the common structured-data case well but are not guaranteed to catch every possible rearrangement.
- Diffing is O(n·m); very large documents (roughly beyond a few thousand lines per side) are rejected with a clear message rather than attempted.
- PNG export reliability varies by browser (§7).
- Root-attribute reconstruction on CSV→XML depends on that data having been present in the CSV in the first place; data discarded at export time cannot be recovered on import.

## 9. Provenance

This tool was developed iteratively by Bharatheshwara Reddy K, with each feature reviewed and tested against concrete real-world payloads (including a namespaced SAP/XML integration message used as the primary test case throughout) before being accepted. Several specific defects were identified and corrected during development through this testing process — including the flatten/unflatten asymmetry (§6.1), the overly-loose modification-detection threshold (§5.3), and the CSS-only symbol rendering that silently dropped diff markers from exported reports (§5.4). The source history (commit log, if published via git) provides a dated record of this process.

## 10. License

Released under the MIT License. See `LICENSE` in the project root.

---

*This document describes Parsec as of July 2026. For the current feature set and setup instructions, see `README.md`.*
