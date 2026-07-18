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

      if(r.type === 'modified-from' || r.type === 'modified-to'){
        contentHtml = r.tokenSpans.map(sp => {
          const safe = sp.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          if(sp.type === 'removed') return '<span class="tok-removed">' + safe + '</span>';
          if(sp.type === 'added') return '<span class="tok-added">' + safe + '</span>';
          return safe;
        }).join('');
      } else {
        contentHtml = r.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ' ';
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
  function rowsForCsv(dataObj, rowPath){
    if(rowPath && rowPath.trim()){
      const got = F.getByPath(dataObj, rowPath.trim());
      if(got === undefined) throw new Error('Row field "' + rowPath.trim() + '" was not found in the input.');
      return Array.isArray(got) ? got : [got];
    }
    if(Array.isArray(dataObj)) return dataObj;
    const found = F.findArrayPaths(dataObj);
    if(found.length) return F.getByPath(dataObj, found[0]);
    return [dataObj];
  }

  document.getElementById('cv-run').addEventListener('click', () => {
    showError(cvError, null);
    const text = cvInput.value;
    if(!text.trim()){ showError(cvError, 'Paste some input first.'); return; }
    const from = cvFrom.value, to = cvTo.value, indent = cvIndent.value, delim = cvDelim(), rowPath = cvRowpath.value;
    try{
      let dataObj, out;

      if(from === 'json'){
        dataObj = JSON.parse(text);
        if(to === 'json') out = F.formatJSON(text, indent);
        else if(to === 'xml') out = F.jsonToXml(dataObj, indent);
        else if(to === 'yaml') out = window.ParsecYAML.stringify(dataObj);
        else out = F.jsonToCsv(rowsForCsv(dataObj, rowPath), delim);
      } else if(from === 'xml'){
        if(to === 'xml') out = F.formatXML(text, indent);
        else {
          const rootObj = F.xmlToJsonObj(text);
          const effective = cvStripRoot.checked ? F.stripRootWrapper(rootObj) : rootObj;
          if(to === 'json') out = JSON.stringify(effective, null, indentArg(indent));
          else if(to === 'yaml') out = window.ParsecYAML.stringify(effective);
          else out = F.jsonToCsv(rowsForCsv(effective, rowPath), delim);
        }
      } else if(from === 'yaml'){
        dataObj = window.ParsecYAML.parse(text);
        if(to === 'yaml') out = window.ParsecYAML.stringify(dataObj);
        else if(to === 'json') out = JSON.stringify(dataObj, null, indentArg(indent));
        else if(to === 'xml') out = F.jsonToXml(dataObj, indent);
        else out = F.jsonToCsv(rowsForCsv(dataObj, rowPath), delim);
      } else { // csv
        const rows = F.csvToJson(text, delim);
        if(to === 'csv') out = F.jsonToCsv(rows, delim);
        else if(to === 'json') out = JSON.stringify(rows, null, indentArg(indent));
        else if(to === 'yaml') out = window.ParsecYAML.stringify(rows);
        else out = F.jsonToXml({ root: { row: rows } }, indent);
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
