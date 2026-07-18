(function(){
  "use strict";

  const F = window.ParsecFormats;
  const D = window.ParsecDiff;
  const T = window.ParsecTree;

  /* ---------- Theme ---------- */
  const themeBtn = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  function reflectTheme(t){
    themeLabel.textContent = t === 'light' ? 'Light' : 'Dark';
    themeBtn.firstChild.textContent = t === 'light' ? '☀️ ' : '🌙 ';
  }
  reflectTheme(window.ParsecTheme.init());
  themeBtn.addEventListener('click', () => reflectTheme(window.ParsecTheme.toggle()));

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
    });
  });

  function showError(el, msg){
    if(!msg){ el.classList.remove('show'); el.textContent = ''; return; }
    el.textContent = '⚠ ' + msg;
    el.classList.add('show');
  }
  function showStatus(el, result){
    el.classList.remove('valid', 'invalid');
    if(!result){ el.classList.remove('show'); return; }
    el.classList.add('show', result.valid ? 'valid' : 'invalid');
    el.textContent = (result.valid ? '✓ ' : '✗ ') + result.message;
  }
  async function copyText(text, btn){
    try{
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(() => btn.textContent = orig, 1200);
    }catch(e){ /* clipboard unavailable */ }
  }
  function downloadText(text, filename){
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  const SAMPLES = {
    json: '{\n  "name": "Ada Lovelace",\n  "born": 1815,\n  "tags": ["mathematician", "writer"],\n  "notes": null\n}',
    xml: '<person>\n  <name>Ada Lovelace</name>\n  <born>1815</born>\n  <tags><tag>mathematician</tag><tag>writer</tag></tags>\n</person>',
    yaml: 'name: Ada Lovelace\nborn: 1815\ntags:\n  - mathematician\n  - writer\nnotes: null',
    csv: 'name,born,role\nAda Lovelace,1815,mathematician\nAlan Turing,1912,computer scientist'
  };

  function resolveDelimiter(selectEl, customEl){
    const v = selectEl.value;
    if(v === 'custom') return customEl.value || ',';
    if(v === 'tab') return '\t';
    return v;
  }

  /* ================= FORMAT TAB ================= */
  const fmtInput = document.getElementById('fmt-input');
  const fmtOutput = document.getElementById('fmt-output');
  const fmtTree = document.getElementById('fmt-tree');
  const fmtType = document.getElementById('fmt-type');
  const fmtIndent = document.getElementById('fmt-indent');
  const fmtDetected = document.getElementById('fmt-detected');
  const fmtError = document.getElementById('fmt-error');
  const fmtStatus = document.getElementById('fmt-status');
  const viewTextBtn = document.getElementById('fmt-view-text');
  const viewTreeBtn = document.getElementById('fmt-view-tree');
  const fmtCsvControls = document.getElementById('fmt-csv-controls');
  const fmtDelimiter = document.getElementById('fmt-delimiter');
  const fmtDelimiterCustom = document.getElementById('fmt-delimiter-custom');

  fmtDelimiter.addEventListener('change', () => {
    fmtDelimiterCustom.style.display = fmtDelimiter.value === 'custom' ? '' : 'none';
  });
  function currentFmtType(){ return fmtType.value === 'auto' ? F.detectFormat(fmtInput.value) : fmtType.value; }
  function syncFmtCsvControls(){ fmtCsvControls.style.display = currentFmtType() === 'csv' ? 'inline-flex' : 'none'; }
  function fmtDelim(){ return resolveDelimiter(fmtDelimiter, fmtDelimiterCustom); }

  let fmtViewMode = 'text';
  function setFmtViewMode(mode){
    fmtViewMode = mode;
    viewTextBtn.classList.toggle('active', mode === 'text');
    viewTreeBtn.classList.toggle('active', mode === 'tree');
    fmtOutput.style.display = mode === 'text' ? '' : 'none';
    fmtTree.style.display = mode === 'tree' ? '' : 'none';
  }
  viewTextBtn.addEventListener('click', () => setFmtViewMode('text'));
  viewTreeBtn.addEventListener('click', () => { setFmtViewMode('tree'); renderTreeFromCurrentInput(); });

  function renderTreeFromCurrentInput(){
    const text = fmtInput.value;
    if(!text.trim()){ fmtTree.innerHTML = '<div class="empty-state">Nothing to show yet — paste or format something first.</div>'; return; }
    const type = currentFmtType();
    if(!type){ fmtTree.innerHTML = '<div class="empty-state">Could not detect a valid structure to build a tree from.</div>'; return; }
    try{ T.render(fmtTree, F.parseAny(text, type, fmtDelim())); }
    catch(e){ fmtTree.innerHTML = '<div class="empty-state">Could not build a tree for this input.</div>'; }
  }

  function updateDetectedBadge(){
    const t = fmtInput.value;
    const type = currentFmtType();
    fmtDetected.textContent = type ? type.toUpperCase() : (t.trim() ? 'UNKNOWN' : '—');
    fmtDetected.className = 'badge' + (type ? ' ' + type : '');
    syncFmtCsvControls();
    return type;
  }
  fmtInput.addEventListener('input', () => { updateDetectedBadge(); showStatus(fmtStatus, null); });
  fmtType.addEventListener('change', () => { updateDetectedBadge(); showStatus(fmtStatus, null); });

  function runFormat(minify){
    showError(fmtError, null); showStatus(fmtStatus, null);
    const text = fmtInput.value;
    if(!text.trim()){ fmtOutput.value = ''; return; }
    const type = currentFmtType();
    if(!type){ showError(fmtError, 'Could not detect a valid JSON, XML, YAML, or CSV structure.'); return; }
    try{
      let out;
      if(type === 'json') out = minify ? F.minifyJSON(text) : F.formatJSON(text, fmtIndent.value);
      else if(type === 'xml') out = minify ? F.minifyXML(text) : F.formatXML(text, fmtIndent.value);
      else if(type === 'yaml') out = F.formatYAML(text); // yaml has one canonical block style; "minify" -> same result
      else out = F.jsonToCsv(F.csvToJson(text, fmtDelim()), fmtDelim());
      fmtOutput.value = out;
      fmtDetected.textContent = type.toUpperCase();
      fmtDetected.className = 'badge ' + type;
      if(fmtViewMode === 'tree') renderTreeFromCurrentInput();
    }catch(err){
      showError(fmtError, err.message);
      fmtOutput.value = '';
    }
  }
  document.getElementById('fmt-run').addEventListener('click', () => runFormat(false));
  document.getElementById('fmt-minify').addEventListener('click', () => runFormat(true));
  document.getElementById('fmt-validate').addEventListener('click', () => {
    showError(fmtError, null);
    const text = fmtInput.value;
    if(!text.trim()){ showStatus(fmtStatus, { valid: false, message: 'Nothing to validate yet.' }); return; }
    const type = currentFmtType();
    if(!type){ showStatus(fmtStatus, { valid: false, message: 'Could not detect a format to validate against.' }); return; }
    showStatus(fmtStatus, F.validate(text, type, fmtDelim()));
  });
  document.getElementById('fmt-clear').addEventListener('click', () => {
    fmtInput.value = ''; fmtOutput.value = ''; fmtTree.innerHTML = '';
    showError(fmtError, null); showStatus(fmtStatus, null); updateDetectedBadge();
  });
  document.getElementById('fmt-sample').addEventListener('click', () => {
    const type = fmtType.value === 'auto' ? 'json' : fmtType.value;
    fmtInput.value = SAMPLES[type];
    updateDetectedBadge();
  });
  document.getElementById('fmt-copy').addEventListener('click', (e) => copyText(fmtOutput.value, e.currentTarget));
  document.getElementById('fmt-download').addEventListener('click', () => {
    const type = fmtType.value === 'auto' ? (F.detectFormat(fmtInput.value) || 'txt') : fmtType.value;
    const ext = type === 'yaml' ? 'yaml' : type;
    downloadText(fmtOutput.value, 'formatted.' + ext);
  });
  const triggerFmtUpload = window.ParsecDragDrop.attach(fmtInput, () => { updateDetectedBadge(); });
  document.getElementById('fmt-upload').addEventListener('click', () => triggerFmtUpload());

  /* ================= COMPARE TAB ================= */
  const cmpA = document.getElementById('cmp-a');
  const cmpB = document.getElementById('cmp-b');
  const cmpError = document.getElementById('cmp-error');
  const cmpResults = document.getElementById('cmp-results');
  const cmpEmpty = document.getElementById('cmp-empty');
  const cmpDiff = document.getElementById('cmp-diff');

  function normalizeForCompare(text){
    const type = F.detectFormat(text);
    try{
      if(type === 'json') return F.formatJSON(text, '2');
      if(type === 'xml') return F.formatXML(text, '2');
      if(type === 'yaml') return F.formatYAML(text);
    }catch(e){ /* fall through to raw text */ }
    return text;
  }

  document.getElementById('cmp-swap').addEventListener('click', () => {
    const tmp = cmpA.value; cmpA.value = cmpB.value; cmpB.value = tmp;
  });

  document.getElementById('cmp-run').addEventListener('click', () => {
    showError(cmpError, null);
    let a = cmpA.value, b = cmpB.value;
    if(!a.trim() && !b.trim()){ showError(cmpError, 'Paste content into both boxes first.'); return; }
    if(document.getElementById('cmp-normalize').checked){ a = normalizeForCompare(a); b = normalizeForCompare(b); }
    if(document.getElementById('cmp-trim').checked){
      a = a.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
      b = b.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
    }
    const result = D.diffLines(a, b);
    if(result.tooLarge){ showError(cmpError, 'These documents are too large for a full line-by-line diff. Try comparing smaller sections.'); return; }

    const rows = result.rows;
    const moved = D.detectMoves(rows);
    const modified = document.getElementById('cmp-modified').checked ? D.detectModifications(rows) : 0;

    let match = 0, added = 0, removed = 0;
    let html = '';
    rows.forEach((r, idx) => {
      if(r.type === 'same') match++;
      else if(r.type === 'added') added++;
      else if(r.type === 'removed') removed++;
      const ln = r.lineA || r.lineB || (idx + 1);
      let contentHtml, note = '';
      const SYMBOL = { same: '&nbsp;&nbsp;', added: '+&nbsp;', removed: '−&nbsp;', 'moved-from': '⇄&nbsp;', 'moved-to': '⇄&nbsp;', 'modified-from': '~&nbsp;', 'modified-to': '~&nbsp;' };
      const symbol = '<span class="sym">' + (SYMBOL[r.type] || '&nbsp;&nbsp;') + '</span>';

      if(r.type === 'modified-from' || r.type === 'modified-to'){
        contentHtml = symbol + r.tokenSpans.map(sp => {
          const safe = sp.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          if(sp.type === 'removed') return '<span class="tok-removed">' + safe + '</span>';
          if(sp.type === 'added') return '<span class="tok-added">' + safe + '</span>';
          return safe;
        }).join('');
      } else {
        contentHtml = symbol + (r.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ' ');
        if(r.type === 'moved-from') note = '<span class="move-note">→ now at line ' + r.pairLine + '</span>';
        else if(r.type === 'moved-to') note = '<span class="move-note">← was at line ' + r.pairLine + '</span>';
      }
      html += '<div class="diff-line ' + r.type + '"><div class="ln">' + ln + '</div><div class="content">' + contentHtml + note + '</div></div>';
    });

    document.getElementById('cmp-match').textContent = match;
    document.getElementById('cmp-moved').textContent = moved;
    document.getElementById('cmp-modified-n').textContent = modified;
    document.getElementById('cmp-added').textContent = added;
    document.getElementById('cmp-removed').textContent = removed;
    cmpDiff.innerHTML = html;
    cmpResults.style.display = 'block';
    cmpEmpty.style.display = 'none';

    lastCompareState = {
      aRaw: cmpA.value, bRaw: cmpB.value,
      normalized: document.getElementById('cmp-normalize').checked,
      diffHtml: html,
      stats: { match, moved, modified, added, removed }
    };
  });

  let lastCompareState = null;

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function buildComparisonReportHtml(state){
    const now = new Date().toLocaleString();
    const s = state.stats;
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">' +
      '<title>Parsec comparison report</title><style>' +
      'body{font-family:-apple-system,Segoe UI,Inter,sans-serif;background:#fff;color:#10192B;max-width:1200px;margin:0 auto;padding:32px;}' +
      'h1{font-size:1.3rem;margin:0 0 4px;} .meta{color:#5B6478;font-size:0.82rem;margin-bottom:24px;font-family:ui-monospace,monospace;}' +
      '.stats{display:flex;gap:0;border:1px solid #DCE1EC;border-radius:8px;overflow:hidden;margin-bottom:24px;font-family:ui-monospace,monospace;}' +
      '.stat{flex:1;padding:12px 16px;border-right:1px solid #DCE1EC;} .stat:last-child{border-right:none;}' +
      '.stat .n{font-size:1.4rem;font-weight:700;font-family:-apple-system,sans-serif;} .stat .l{font-size:0.68rem;color:#8891A4;text-transform:uppercase;letter-spacing:0.05em;}' +
      '.match .n{color:#0F9D6E;} .moved .n{color:#6D28D9;} .modified .n{color:#B45309;} .added .n{color:#0891B2;} .removed .n{color:#BE123C;}' +
      '.payload-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;}' +
      '.payload{border:1px solid #DCE1EC;border-radius:8px;overflow:hidden;}' +
      '.payload h2{margin:0;padding:8px 12px;background:#F8F9FC;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;color:#5B6478;border-bottom:1px solid #DCE1EC;font-family:ui-monospace,monospace;}' +
      '.payload pre{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:0.78rem;max-height:520px;overflow:auto;font-family:ui-monospace,"JetBrains Mono",monospace;}' +
      'h3{font-size:0.95rem;margin:0 0 10px;}' +
      '.diff-view{border:1px solid #DCE1EC;border-radius:8px;font-family:ui-monospace,monospace;font-size:0.8rem;overflow:auto;}' +
      '.diff-line{display:flex;} .diff-line .ln{width:46px;flex-shrink:0;text-align:right;padding:2px 10px;color:#8891A4;border-right:1px solid #E7EAF3;}' +
      '.diff-line .content{padding:2px 12px;white-space:pre-wrap;word-break:break-all;flex:1;}' +
      '.diff-line .sym{display:inline-block;width:16px;opacity:0.75;font-weight:600;}' +
      '.diff-line.same .content{color:#5B6478;}' +
      '.diff-line.added{background:#E1F6FA;} .diff-line.added .content,.diff-line.added .ln{color:#0891B2;}' +
      '.diff-line.removed{background:#FDE4E9;} .diff-line.removed .content,.diff-line.removed .ln{color:#BE123C;}' +
      '.diff-line.moved-from,.diff-line.moved-to{background:#EFE9FE;} .diff-line.moved-from .content,.diff-line.moved-to .content,.diff-line.moved-from .ln,.diff-line.moved-to .ln{color:#6D28D9;}' +
      '.diff-line.modified-from,.diff-line.modified-to{background:#FDF1DC;} .diff-line.modified-from .ln,.diff-line.modified-to .ln{color:#B45309;}' +
      '.tok-removed{background:#FDE4E9;color:#BE123C;text-decoration:line-through;border-radius:3px;}' +
      '.tok-added{background:#E1F6FA;color:#0891B2;border-radius:3px;}' +
      '.move-note{color:#6D28D9;opacity:0.75;font-size:0.72rem;margin-left:10px;}' +
      '.note{color:#8891A4;font-size:0.78rem;margin:10px 0 24px;font-family:ui-monospace,monospace;}' +
      '@media print{ body{padding:0;} .payload pre{max-height:none;overflow:visible;} .diff-view{max-height:none;overflow:visible;} @page{margin:16mm;} }' +
      '</style></head><body>' +
      '<h1>Parsec comparison report</h1>' +
      '<div class="meta">Generated ' + escapeHtml(now) + '</div>' +
      '<div class="stats">' +
        '<div class="stat match"><div class="n">' + s.match + '</div><div class="l">Matching lines</div></div>' +
        '<div class="stat moved"><div class="n">' + s.moved + '</div><div class="l">Moved / shuffled</div></div>' +
        '<div class="stat modified"><div class="n">' + s.modified + '</div><div class="l">Modified</div></div>' +
        '<div class="stat added"><div class="n">' + s.added + '</div><div class="l">Only in B (+)</div></div>' +
        '<div class="stat removed"><div class="n">' + s.removed + '</div><div class="l">Only in A (−)</div></div>' +
      '</div>' +
      '<div class="payload-grid">' +
        '<div class="payload"><h2>Source (A) — as pasted</h2><pre>' + escapeHtml(state.aRaw) + '</pre></div>' +
        '<div class="payload"><h2>Target (B) — as pasted</h2><pre>' + escapeHtml(state.bRaw) + '</pre></div>' +
      '</div>' +
      (state.normalized ? '<div class="note">Note: the diff below was computed after normalizing JSON/XML/YAML formatting and trimming trailing whitespace — line numbers correspond to that normalized form, not necessarily the raw payloads above.</div>' : '') +
      '<h3>Diff</h3>' +
      '<div class="note" style="margin-top:-4px;">Legend: <b>+</b> only in B &nbsp; <b>−</b> only in A &nbsp; <b>⇄</b> moved / shuffled &nbsp; <b>~</b> modified (word-level changes highlighted)</div>' +
      '<div class="diff-view">' + state.diffHtml + '</div>' +
      '</body></html>';
  }

  function reportFilename(ext){
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return 'parsec-comparison-' + stamp + '.' + ext;
  }

  document.getElementById('cmp-download-html').addEventListener('click', () => {
    if(!lastCompareState){ showError(cmpError, 'Run a comparison first.'); return; }
    downloadText(buildComparisonReportHtml(lastCompareState), reportFilename('html'));
  });

  // PDF: the browser already knows how to turn HTML into a PDF via its print
  // engine, so this just loads the report into a hidden iframe and opens the
  // native print dialog — no library needed, and "Save as PDF" is a
  // print-destination option in every modern browser.
  document.getElementById('cmp-download-pdf').addEventListener('click', () => {
    if(!lastCompareState){ showError(cmpError, 'Run a comparison first.'); return; }
    const reportHtml = buildComparisonReportHtml(lastCompareState);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
    document.body.appendChild(iframe);
    const cleanup = () => { if(iframe.parentNode) document.body.removeChild(iframe); };
    iframe.onload = () => {
      try{
        iframe.contentWindow.onafterprint = cleanup;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }catch(e){
        showError(cmpError, 'Could not open the print dialog: ' + e.message);
        cleanup();
      }
    };
    setTimeout(cleanup, 20000);
    iframe.srcdoc = reportHtml;
  });

  // PNG: best-effort, no-library image export. Renders the report into a
  // hidden iframe (to get real, laid-out content and an accurate height),
  // serializes that into a self-contained SVG via <foreignObject>, then draws
  // the SVG onto a canvas and exports it as a PNG. This works in most modern
  // browsers for content like ours (no external images/fonts), but some
  // browsers — Safari in particular — can block canvas export for
  // foreignObject-based SVGs as a security precaution. If that happens we
  // show a clear error and point back to the HTML/PDF options instead of
  // failing silently.
  document.getElementById('cmp-download-png').addEventListener('click', () => {
    if(!lastCompareState){ showError(cmpError, 'Run a comparison first.'); return; }
    showError(cmpError, null);
    const reportHtml = buildComparisonReportHtml(lastCompareState);
    const width = 1200;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed; left:-99999px; top:0; width:' + width + 'px; height:600px; border:0;';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      let doc, height;
      try{
        doc = iframe.contentDocument;
        height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 600);
      }catch(e){
        document.body.removeChild(iframe);
        showError(cmpError, 'PNG export failed while measuring the report. Try HTML or PDF instead.');
        return;
      }

      const innerHtml = doc.documentElement.outerHTML;
      const svgString =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
        '<foreignObject width="100%" height="100%">' + innerHtml + '</foreignObject></svg>';

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        try{
          const scale = 2; // render at 2x for a sharper image
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if(!blob){ showError(cmpError, 'This browser blocked PNG export for security reasons. Try HTML or PDF instead.'); return; }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = reportFilename('png');
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          }, 'image/png');
        }catch(e){
          showError(cmpError, 'This browser blocked PNG export for security reasons (' + e.message + '). Try HTML or PDF instead.');
        }finally{
          URL.revokeObjectURL(svgUrl);
          document.body.removeChild(iframe);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        document.body.removeChild(iframe);
        showError(cmpError, 'PNG export isn\'t supported in this browser. Try HTML or PDF instead.');
      };
      img.src = svgUrl;
    };
    iframe.srcdoc = reportHtml;
  });

  const triggerCmpAUpload = window.ParsecDragDrop.attach(cmpA);
  const triggerCmpBUpload = window.ParsecDragDrop.attach(cmpB);
  document.getElementById('cmp-a-upload').addEventListener('click', () => triggerCmpAUpload());
  document.getElementById('cmp-b-upload').addEventListener('click', () => triggerCmpBUpload());

  /* ================= CONVERT TAB ================= */
  const cvFrom = document.getElementById('cv-from');
  const cvTo = document.getElementById('cv-to');
  const cvInput = document.getElementById('cv-input');
  const cvOutput = document.getElementById('cv-output');
  const cvIndent = document.getElementById('cv-indent');
  const cvError = document.getElementById('cv-error');
  const cvStripRootWrap = document.getElementById('cv-striproot-wrap');
  const cvStripRoot = document.getElementById('cv-striproot');
  const cvCsvControls = document.getElementById('cv-csv-controls');
  const cvDelimiter = document.getElementById('cv-delimiter');
  const cvDelimiterCustom = document.getElementById('cv-delimiter-custom');
  const cvRowpathWrap = document.getElementById('cv-rowpath-wrap');
  const cvRowpath = document.getElementById('cv-rowpath');
  const cvRowpathList = document.getElementById('cv-rowpath-list');

  cvDelimiter.addEventListener('change', () => {
    cvDelimiterCustom.style.display = cvDelimiter.value === 'custom' ? '' : 'none';
  });
  function cvDelim(){ return resolveDelimiter(cvDelimiter, cvDelimiterCustom); }

  function syncConvertControls(){
    cvStripRootWrap.style.display = cvFrom.value === 'xml' ? 'flex' : 'none';
    const csvInvolved = (cvFrom.value === 'csv' || cvTo.value === 'csv');
    cvCsvControls.style.display = csvInvolved ? 'contents' : 'none';
    const rowPathRelevant = (cvTo.value === 'csv' && cvFrom.value !== 'csv');
    cvRowpathWrap.style.display = rowPathRelevant ? 'inline-flex' : 'none';
    if(rowPathRelevant) refreshRowPathSuggestions();
    const unflattenRelevant = (cvFrom.value === 'csv' && cvTo.value !== 'csv');
    document.getElementById('cv-unflatten-wrap').style.display = unflattenRelevant ? 'inline-flex' : 'none';
    document.getElementById('cv-rootname-wrap').style.display = (unflattenRelevant && cvTo.value === 'xml') ? 'inline-flex' : 'none';
  }
  function refreshRowPathSuggestions(){
    cvRowpathList.innerHTML = '';
    const text = cvInput.value;
    if(!text.trim()) return;
    try{
      let dataObj;
      if(cvFrom.value === 'json') dataObj = JSON.parse(text);
      else if(cvFrom.value === 'xml'){
        const rootObj = F.xmlToJsonObj(text);
        dataObj = cvStripRoot.checked ? F.stripRootWrapper(rootObj) : rootObj;
      }
      else if(cvFrom.value === 'yaml') dataObj = window.ParsecYAML.parse(text);
      else return;
      const paths = F.findArrayPaths(dataObj);
      for(const p of paths){
        const opt = document.createElement('option');
        opt.value = p;
        cvRowpathList.appendChild(opt);
      }
    }catch(e){ /* leave suggestions empty on parse error */ }
  }
  cvFrom.addEventListener('change', syncConvertControls);
  cvTo.addEventListener('change', syncConvertControls);
  cvStripRoot.addEventListener('change', refreshRowPathSuggestions);
  cvInput.addEventListener('input', () => { if(cvRowpathWrap.style.display !== 'none') refreshRowPathSuggestions(); });
  syncConvertControls();

  document.getElementById('cv-swap').addEventListener('click', () => {
    const tmp = cvFrom.value; cvFrom.value = cvTo.value; cvTo.value = tmp;
    const tmpText = cvInput.value; cvInput.value = cvOutput.value; cvOutput.value = tmpText;
    syncConvertControls();
  });
  document.getElementById('cv-clear').addEventListener('click', () => { cvInput.value = ''; cvOutput.value = ''; showError(cvError, null); });
  document.getElementById('cv-sample').addEventListener('click', () => { cvInput.value = SAMPLES[cvFrom.value] || SAMPLES.json; syncConvertControls(); });
  document.getElementById('cv-copy').addEventListener('click', (e) => copyText(cvOutput.value, e.currentTarget));
  document.getElementById('cv-download').addEventListener('click', () => {
    const ext = cvTo.value === 'yaml' ? 'yaml' : cvTo.value;
    downloadText(cvOutput.value, 'converted.' + ext);
  });
  const triggerCvUpload = window.ParsecDragDrop.attach(cvInput, () => syncConvertControls());
  document.getElementById('cv-upload').addEventListener('click', () => triggerCvUpload());

  function indentArg(indent){ return indent === 'tab' ? '\t' : parseInt(indent, 10); }

  // Picks which part of a parsed structure becomes the CSV row set: an explicit
  // row-field path if given, otherwise falls back to the "first array found" heuristic.
  // When includeParent is true, sibling fields of the array's parent are merged
  // onto every row (e.g. order-level fields repeated alongside each line item).
  function rowsForCsv(dataObj, rowPath, includeParent){
    let resolvedPath = (rowPath && rowPath.trim()) ? rowPath.trim() : null;
    let items;
    if(resolvedPath){
      const got = F.getByPath(dataObj, resolvedPath);
      if(got === undefined) throw new Error('Row field "' + resolvedPath + '" was not found in the input.');
      items = Array.isArray(got) ? got : [got];
    } else if(Array.isArray(dataObj)){
      items = dataObj;
    } else {
      const found = F.findArrayPaths(dataObj);
      if(found.length){ resolvedPath = found[0]; items = F.getByPath(dataObj, resolvedPath); }
      else { return [dataObj]; }
    }
    if(includeParent && resolvedPath){
      const context = F.parentContextFor(dataObj, resolvedPath);
      if(Object.keys(context).length){
        return items.map(item => Object.assign({}, context, (item !== null && typeof item === 'object') ? item : { value: item }));
      }
    }
    return items;
  }

  document.getElementById('cv-run').addEventListener('click', () => {
    showError(cvError, null);
    const text = cvInput.value;
    if(!text.trim()){ showError(cvError, 'Paste some input first.'); return; }
    const from = cvFrom.value, to = cvTo.value, indent = cvIndent.value, delim = cvDelim(), rowPath = cvRowpath.value, includeParent = document.getElementById('cv-includeparent').checked;
    try{
      let dataObj, out;

      if(from === 'json'){
        dataObj = JSON.parse(text);
        if(to === 'json') out = F.formatJSON(text, indent);
        else if(to === 'xml') out = F.jsonToXml(dataObj, indent);
        else if(to === 'yaml') out = window.ParsecYAML.stringify(dataObj);
        else out = F.jsonToCsv(rowsForCsv(dataObj, rowPath, includeParent), delim);
      } else if(from === 'xml'){
        if(to === 'xml') out = F.formatXML(text, indent);
        else {
          const rootObj = F.xmlToJsonObj(text);
          const effective = cvStripRoot.checked ? F.stripRootWrapper(rootObj) : rootObj;
          if(to === 'json') out = JSON.stringify(effective, null, indentArg(indent));
          else if(to === 'yaml') out = window.ParsecYAML.stringify(effective);
          else out = F.jsonToCsv(rowsForCsv(effective, rowPath, includeParent), delim);
        }
      } else if(from === 'yaml'){
        dataObj = window.ParsecYAML.parse(text);
        if(to === 'yaml') out = window.ParsecYAML.stringify(dataObj);
        else if(to === 'json') out = JSON.stringify(dataObj, null, indentArg(indent));
        else if(to === 'xml') out = F.jsonToXml(dataObj, indent);
        else out = F.jsonToCsv(rowsForCsv(dataObj, rowPath, includeParent), delim);
      } else { // csv
        const rawRows = F.csvToJson(text, delim);
        const unflatten = document.getElementById('cv-unflatten').checked;
        let rows;
        if(to !== 'csv' && unflatten){
          let arrayFieldPath = document.getElementById('cv-arrayfield').value.trim();
          if(!arrayFieldPath){
            const contextCols = Object.keys(rawRows[0] || {}).filter(c => c.includes('.'));
            const guess = F.commonDotPrefix(contextCols);
            arrayFieldPath = guess ? guess + '.Items' : '';
          }
          rows = F.groupRowsIntoNested(rawRows, arrayFieldPath);
        } else {
          rows = rawRows;
        }
        if(to === 'csv') out = F.jsonToCsv(rows, delim);
        else if(to === 'json') out = JSON.stringify(rows, null, indentArg(indent));
        else if(to === 'yaml') out = window.ParsecYAML.stringify(rows);
        else {
          const rootNameOverride = document.getElementById('cv-rootname').value.trim();
          out = rootNameOverride ? F.jsonToXmlRooted(rows, rootNameOverride, indent) : F.jsonToXml(rows, indent);
        }
      }
      cvOutput.value = out;
    }catch(err){
      showError(cvError, err.message);
      cvOutput.value = '';
    }
  });

  // init
  updateDetectedBadge();
})();
