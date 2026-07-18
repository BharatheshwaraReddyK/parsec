/*
 * Parsec — format engine: JSON / XML / CSV / YAML
 * parsing, pretty-printing, minifying, validating, and cross-converting.
 * Depends on window.ParsecYAML (js/yaml.js) — load that file first.
 */
(function(global){
  "use strict";

  function escapeXml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeXmlAttr(s){ return escapeXml(s).replace(/"/g,'&quot;'); }
  function sanitizeTag(name){
    // Colons are kept because they're valid (and common) in XML QNames, e.g. namespace
    // prefixes like "n0:MT_DriverAssignment_Req". Everything else unsafe is replaced.
    let n = String(name).replace(/[^a-zA-Z0-9_\-.:]/g, '_');
    if(!/^[a-zA-Z_]/.test(n)) n = '_' + n;
    return n || '_';
  }
  function indentStr(indent){
    return indent === 'tab' ? '\t' : ' '.repeat(parseInt(indent, 10) || 2);
  }

  /* ---------------- JSON ---------------- */
  function formatJSON(text, indent){
    return JSON.stringify(JSON.parse(text), null, indent === 'tab' ? '\t' : parseInt(indent, 10));
  }
  function minifyJSON(text){ return JSON.stringify(JSON.parse(text)); }

  /* ---------------- XML ---------------- */
  function parseXMLDoc(text){
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const err = doc.querySelector('parsererror');
    if(err) throw new Error('Invalid XML: ' + err.textContent.split('\n')[0].trim());
    if(!doc.documentElement) throw new Error('Invalid XML: no root element found');
    return doc;
  }
  function xmlErrorDetail(text){
    // Returns a friendlier message with a best-effort line/column if the parser exposes one.
    try{
      parseXMLDoc(text);
      return null;
    }catch(e){
      const m = e.message.match(/line[:\s]+(\d+)[,\s]+column[:\s]+(\d+)/i) || e.message.match(/line (\d+)/i);
      if(m) return e.message;
      return e.message;
    }
  }
  function formatXML(text, indent){
    const doc = parseXMLDoc(text);
    const pad = indentStr(indent);
    function attrsStr(el){
      return Array.from(el.attributes).map(a => ' ' + a.name + '="' + escapeXmlAttr(a.value) + '"').join('');
    }
    function walk(node, depth){
      const p = pad.repeat(depth);
      if(node.nodeType === 3){ const t = node.nodeValue.trim(); return t ? [p + escapeXml(t)] : []; }
      if(node.nodeType === 8) return [p + '<!--' + node.nodeValue + '-->'];
      if(node.nodeType !== 1) return [];
      const kids = Array.from(node.childNodes).filter(n => n.nodeType === 1 || n.nodeType === 8 || (n.nodeType === 3 && n.nodeValue.trim()));
      const attrs = attrsStr(node);
      if(kids.length === 0) return [p + '<' + node.nodeName + attrs + '/>'];
      if(kids.length === 1 && kids[0].nodeType === 3) return [p + '<' + node.nodeName + attrs + '>' + escapeXml(kids[0].nodeValue.trim()) + '</' + node.nodeName + '>'];
      const lines = [p + '<' + node.nodeName + attrs + '>'];
      for(const k of kids) lines.push(...walk(k, depth + 1));
      lines.push(p + '</' + node.nodeName + '>');
      return lines;
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + walk(doc.documentElement, 0).join('\n');
  }
  function minifyXML(text){
    parseXMLDoc(text);
    return text.trim().replace(/>\s+</g, '><').replace(/\s+/g, ' ').replace(/> </g, '><');
  }

  function elementToObj(el){
    const obj = {};
    let hasAttrs = false;
    if(el.attributes && el.attributes.length){
      for(const attr of el.attributes){ obj['@' + attr.name] = attr.value; hasAttrs = true; }
    }
    const childEls = Array.from(el.childNodes).filter(n => n.nodeType === 1);
    if(childEls.length === 0){
      const text = el.textContent.trim();
      if(!hasAttrs) return text;
      if(text) obj['#text'] = text;
      return obj;
    }
    for(const child of childEls){
      const val = elementToObj(child);
      const name = child.nodeName;
      if(Object.prototype.hasOwnProperty.call(obj, name)){
        if(!Array.isArray(obj[name])) obj[name] = [obj[name]];
        obj[name].push(val);
      } else obj[name] = val;
    }
    return obj;
  }
  function xmlToJsonObj(text){
    const doc = parseXMLDoc(text);
    const root = doc.documentElement;
    return { [root.nodeName]: elementToObj(root) };
  }

  function buildXmlNode(name, value, depth, pad){
    const p = pad.repeat(depth);
    const tag = sanitizeTag(name);
    if(Array.isArray(value)) return value.map(v => buildXmlNode(tag, v, depth, pad)).join('\n');
    if(value !== null && typeof value === 'object'){
      let attrs = '', text = '';
      const children = [];
      for(const k of Object.keys(value)){
        const v = value[k];
        if(k.startsWith('@')) attrs += ' ' + sanitizeTag(k.slice(1)) + '="' + escapeXmlAttr(String(v)) + '"';
        else if(k === '#text') text = String(v);
        else children.push([k, v]);
      }
      if(children.length === 0 && !text) return p + '<' + tag + attrs + '/>';
      if(children.length === 0) return p + '<' + tag + attrs + '>' + escapeXml(text) + '</' + tag + '>';
      const inner = children.map(([k, v]) => buildXmlNode(k, v, depth + 1, pad)).join('\n');
      return p + '<' + tag + attrs + '>\n' + inner + '\n' + p + '</' + tag + '>';
    }
    if(value === undefined || value === null || value === '') return p + '<' + tag + '/>';
    return p + '<' + tag + '>' + escapeXml(String(value)) + '</' + tag + '>';
  }
  function jsonToXml(data, indent){
    const pad = indentStr(indent);
    const decl = '<?xml version="1.0" encoding="UTF-8"?>\n';
    if(Array.isArray(data)) return decl + buildXmlNode('root', { item: data }, 0, pad);
    if(data !== null && typeof data === 'object'){
      const keys = Object.keys(data);
      if(keys.length === 1 && !Array.isArray(data[keys[0]])) return decl + buildXmlNode(keys[0], data[keys[0]], 0, pad);
      return decl + buildXmlNode('root', data, 0, pad);
    }
    return decl + buildXmlNode('root', data, 0, pad);
  }

  /* ---------------- CSV ---------------- */
  function parseCSV(text, delimiter){
    delimiter = delimiter || ',';
    const rows = [];
    let row = [], field = '', inQuotes = false;
    const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for(let i = 0; i < s.length; i++){
      const c = s[i];
      if(inQuotes){
        if(c === '"'){ if(s[i+1] === '"'){ field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else {
        if(c === '"') inQuotes = true;
        else if(c === delimiter){ row.push(field); field = ''; }
        else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
        else field += c;
      }
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }
    return rows.filter(r => !(r.length === 1 && r[0] === ''));
  }
  function csvValidate(text, delimiter){
    const rows = parseCSV(text, delimiter);
    if(rows.length === 0) return { valid: false, message: 'No rows found.' };
    const width = rows[0].length;
    for(let i = 1; i < rows.length; i++){
      if(rows[i].length !== width){
        return { valid: false, message: 'Row ' + (i + 1) + ' has ' + rows[i].length + ' column(s), expected ' + width + ' (based on the header row).' };
      }
    }
    return { valid: true, message: rows.length + ' rows × ' + width + ' columns, all consistent.' };
  }
  function csvToJson(text, delimiter){
    const rows = parseCSV(text, delimiter);
    if(rows.length === 0) return [];
    const headers = rows[0];
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h || ('col' + i)] = r[i] !== undefined ? r[i] : ''; });
      return obj;
    });
  }
  function flattenObj(obj, prefix){
    let res = {};
    if(obj === null || typeof obj !== 'object'){ res[prefix || 'value'] = obj; return res; }
    for(const k of Object.keys(obj)){
      const key = prefix ? prefix + '.' + k : k;
      const v = obj[k];
      if(Array.isArray(v)){
        v.forEach((item, i) => {
          if(item !== null && typeof item === 'object') Object.assign(res, flattenObj(item, key + '[' + i + ']'));
          else res[key + '[' + i + ']'] = item;
        });
      } else if(v !== null && typeof v === 'object'){
        Object.assign(res, flattenObj(v, key));
      } else res[key] = v;
    }
    return res;
  }
  function csvEscape(v, delimiter){
    delimiter = delimiter || ',';
    if(v === undefined || v === null) v = '';
    else if(typeof v === 'object') v = JSON.stringify(v);
    else v = String(v);
    const specials = new RegExp('["' + delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n]');
    if(specials.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function jsonToCsv(data, delimiter){
    delimiter = delimiter || ',';
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.map(o => (o !== null && typeof o === 'object') ? flattenObj(o, '') : { value: o });
    const headers = [];
    for(const row of arr) for(const k of Object.keys(row)) if(!headers.includes(k)) headers.push(k);
    const lines = [headers.map(h => csvEscape(h, delimiter)).join(delimiter)];
    for(const row of arr) lines.push(headers.map(h => csvEscape(row[h], delimiter)).join(delimiter));
    return lines.join('\n');
  }
  function extractRowsFromXmlObj(rootObj){
    const val = Object.values(rootObj)[0];
    if(Array.isArray(val)) return val;
    if(val !== null && typeof val === 'object'){
      for(const v of Object.values(val)) if(Array.isArray(v)) return v;
      return [val];
    }
    return [{ value: val }];
  }

  /* ---------------- structural helpers ---------------- */
  // Drops a single-key XML-style wrapper (root element) and its own attributes,
  // keeping only its actual child content. E.g. {Root:{"@xmlns":"...", Records:{...}}} -> {Records:{...}}
  function stripRootWrapper(rootObj){
    if(rootObj === null || typeof rootObj !== 'object' || Array.isArray(rootObj)) return rootObj;
    const keys = Object.keys(rootObj);
    if(keys.length !== 1) return rootObj;
    const inner = rootObj[keys[0]];
    if(inner === null || typeof inner !== 'object' || Array.isArray(inner)) return inner;
    const cleaned = {};
    for(const k of Object.keys(inner)){
      if(k.startsWith('@') || k === '#text') continue;
      cleaned[k] = inner[k];
    }
    return cleaned;
  }

  function getByPath(obj, path){
    if(!path) return obj;
    return path.split('.').reduce((acc, k) => (acc === null || acc === undefined ? undefined : acc[k]), obj);
  }

  // Recursively finds every dot-path in obj whose value is a non-empty array —
  // candidates for "which field should become the CSV rows".
  function findArrayPaths(obj, prefix, out){
    out = out || [];
    if(obj !== null && typeof obj === 'object'){
      if(Array.isArray(obj)){
        if(prefix && obj.length) out.push(prefix);
        obj.forEach(item => findArrayPaths(item, prefix, out));
      } else {
        for(const k of Object.keys(obj)){
          if(k.startsWith('@') || k === '#text') continue;
          findArrayPaths(obj[k], prefix ? prefix + '.' + k : k, out);
        }
      }
    }
    return out;
  }

  /* ---------------- YAML (delegates to ParsecYAML) ---------------- */
  function formatYAML(text){
    if(!global.ParsecYAML) throw new Error('YAML engine not loaded');
    return global.ParsecYAML.stringify(global.ParsecYAML.parse(text));
  }

  /* ---------------- detection ---------------- */
  function detectFormat(text){
    const t = text.trim();
    if(!t) return null;
    if(t[0] === '{' || t[0] === '['){ try{ JSON.parse(t); return 'json'; }catch(e){} }
    if(t[0] === '<'){
      try{ const doc = new DOMParser().parseFromString(t, 'application/xml'); if(!doc.querySelector('parsererror') && doc.documentElement) return 'xml'; }catch(e){}
    }
    const lines = t.split('\n').filter(l => l.trim());
    if(lines.length >= 2 && /^[\w."'\- ]+:\s?/.test(lines[0]) && lines.slice(0, 5).some(l => /:\s/.test(l) || /^\s*-\s/.test(l))){
      try{ global.ParsecYAML.parse(t); return 'yaml'; }catch(e){}
    }
    if(lines.length >= 1 && lines[0].includes(',')) return 'csv';
    try{ global.ParsecYAML.parse(t); return 'yaml'; }catch(e){}
    return null;
  }

  /* ---------------- unified parse to JS value / validate ---------------- */
  function parseAny(text, type, delimiter){
    if(type === 'json') return JSON.parse(text);
    if(type === 'xml') return xmlToJsonObj(text);
    if(type === 'yaml') return global.ParsecYAML.parse(text);
    if(type === 'csv') return csvToJson(text, delimiter);
    throw new Error('Unknown format: ' + type);
  }

  function validate(text, type, delimiter){
    try{
      if(type === 'json'){ JSON.parse(text); return { valid: true, message: 'Well-formed JSON.' }; }
      if(type === 'xml'){ parseXMLDoc(text); return { valid: true, message: 'Well-formed XML — root element and nesting all close correctly.' }; }
      if(type === 'yaml'){ global.ParsecYAML.parse(text); return { valid: true, message: 'Parses as valid YAML.' }; }
      if(type === 'csv') return csvValidate(text, delimiter);
      return { valid: false, message: 'Unrecognized format.' };
    }catch(e){
      let detail = e.message;
      if(type === 'json'){
        const m = detail.match(/position (\d+)/);
        if(m){
          const pos = parseInt(m[1], 10);
          const before = text.slice(0, pos);
          const line = before.split('\n').length;
          const col = pos - before.lastIndexOf('\n');
          detail += ' (line ' + line + ', column ' + col + ')';
        }
      }
      return { valid: false, message: detail };
    }
  }


  global.ParsecFormats = {
    formatJSON, minifyJSON,
    formatXML, minifyXML, parseXMLDoc, xmlToJsonObj, jsonToXml, extractRowsFromXmlObj,
    parseCSV, csvToJson, jsonToCsv, csvValidate,
    formatYAML,
    stripRootWrapper, getByPath, findArrayPaths,
    detectFormat, parseAny, validate,
    indentStr
  };
})(typeof window !== 'undefined' ? window : globalThis);
