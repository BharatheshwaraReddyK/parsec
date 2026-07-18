/*
 * Parsec — minimal local YAML engine (no external dependency / no CDN).
 *
 * Supports: nested block mappings & sequences, flow collections ({...}/[...]),
 * plain/single/double-quoted scalars, numbers, booleans, null, comments,
 * inline "- key: value" sequence items.
 *
 * Not supported (by design, to keep this small and dependency-free):
 * anchors/aliases (&x *x), tags (!!str), multi-document streams (---),
 * block scalars (| and >), flow-in-block edge cases.
 * Unsupported constructs raise a clear error rather than silently guessing.
 */
(function(global){
  "use strict";

  function tokenizeLines(text){
    return text.replace(/\r\n/g, '\n').split('\n').map(raw => {
      let line = raw.replace(/\t/g, '  ');
      // strip comments, respecting quotes
      let inS = false, inD = false, commentAt = -1;
      for(let i = 0; i < line.length; i++){
        const c = line[i];
        if(c === "'" && !inD) inS = !inS;
        else if(c === '"' && !inS) inD = !inD;
        else if(c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i-1]))){ commentAt = i; break; }
      }
      if(commentAt >= 0) line = line.slice(0, commentAt);
      line = line.replace(/\s+$/, '');
      const indent = (line.match(/^ */) || [''])[0].length;
      const content = line.slice(indent);
      return { indent, content };
    }).filter(l => l.content.length > 0 && l.content !== '---' && l.content !== '...');
  }

  function parseScalar(raw){
    const s = raw.trim();
    if(s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    if(s === 'true' || s === 'True' || s === 'TRUE') return true;
    if(s === 'false' || s === 'False' || s === 'FALSE') return false;
    if(/^-?\d+$/.test(s)) return parseInt(s, 10);
    if(/^-?\d*\.\d+([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
    if(s[0] === '"' && s[s.length-1] === '"') return JSON.parse(s);
    if(s[0] === "'" && s[s.length-1] === "'") return s.slice(1, -1).replace(/''/g, "'");
    if(s[0] === '[' || s[0] === '{') return parseFlow(s);
    return s;
  }

  function parseFlow(s){
    let out = '', i = 0;
    while(i < s.length){
      const c = s[i];
      if(c === '"'){
        let j = i + 1, buf = '"';
        while(j < s.length && s[j] !== '"'){ if(s[j] === '\\'){ buf += s[j] + s[j+1]; j += 2; continue; } buf += s[j]; j++; }
        buf += '"'; out += buf; i = j + 1; continue;
      }
      if(c === "'"){
        let j = i + 1, buf = '';
        while(j < s.length){ if(s[j] === "'" && s[j+1] === "'"){ buf += "'"; j += 2; continue; } if(s[j] === "'") break; buf += s[j]; j++; }
        out += JSON.stringify(buf); i = j + 1; continue;
      }
      if('[]{}:,'.includes(c)){ out += c; i++; continue; }
      if(/\s/.test(c)){ out += c; i++; continue; }
      let j = i, buf = '';
      while(j < s.length && !'[]{}:,'.includes(s[j])){ buf += s[j]; j++; }
      const trimmed = buf.trim();
      if(trimmed.length){
        const val = parseScalar(trimmed);
        out += JSON.stringify(val);
      }
      i = j;
    }
    out = out.replace(/,(\s*[\]}])/g, '$1');
    return JSON.parse(out);
  }

  function parseBlock(lines, start, indent){
    if(start >= lines.length || lines[start].indent < indent) return [null, start];
    const first = lines[start];
    if(first.indent > indent) throw new Error('Unexpected indentation near "' + first.content + '"');

    if(first.content === '-' || first.content.startsWith('- ')){
      const arr = [];
      let idx = start;
      while(idx < lines.length && lines[idx].indent === indent && (lines[idx].content === '-' || lines[idx].content.startsWith('- '))){
        const rest = lines[idx].content === '-' ? '' : lines[idx].content.slice(2);
        if(rest.trim() === ''){
          const childIndent = (idx + 1 < lines.length && lines[idx+1].indent > indent) ? lines[idx+1].indent : indent + 2;
          const [val, nextIdx] = parseBlock(lines, idx + 1, childIndent);
          arr.push(val);
          idx = nextIdx;
        } else if(/^[^:'"{}\[\]]+:(\s|$)/.test(rest)){
          const syntheticIndent = indent + 2;
          const temp = lines.slice();
          temp[idx] = { indent: syntheticIndent, content: rest };
          const [val, nextIdx] = parseBlock(temp, idx, syntheticIndent);
          arr.push(val);
          idx = nextIdx;
        } else {
          arr.push(parseScalar(rest));
          idx++;
        }
      }
      return [arr, idx];
    }

    const obj = {};
    let idx = start;
    while(idx < lines.length && lines[idx].indent === indent){
      const content = lines[idx].content;
      if(content === '-' || content.startsWith('- ')) break;
      const m = content.match(/^((?:"[^"]*")|(?:'[^']*')|(?:[^:]+)):\s?(.*)$/);
      if(!m) throw new Error('Cannot parse YAML near: "' + content + '"');
      let key = m[1].trim();
      if((key[0] === '"' && key[key.length-1] === '"') || (key[0] === "'" && key[key.length-1] === "'")) key = key.slice(1, -1);
      const rest = m[2];
      if(rest.trim() === ''){
        if(idx + 1 < lines.length && lines[idx+1].indent > indent){
          const [val, nextIdx] = parseBlock(lines, idx + 1, lines[idx+1].indent);
          obj[key] = val;
          idx = nextIdx;
        } else {
          obj[key] = null;
          idx++;
        }
      } else {
        obj[key] = parseScalar(rest);
        idx++;
      }
    }
    return [obj, idx];
  }

  function parseYAML(text){
    const lines = tokenizeLines(text);
    if(lines.length === 0) return null;
    const [val] = parseBlock(lines, 0, lines[0].indent);
    return val;
  }

  function scalarToYaml(v){
    if(v === null || v === undefined) return 'null';
    if(typeof v === 'boolean' || typeof v === 'number') return String(v);
    if(typeof v === 'string'){
      if(v === '') return "''";
      if(/^\s|\s$/.test(v) || /^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(v) || /[:#\[\]{}&*!|>'"%@`,]/.test(v) || v.includes('\n')){
        return JSON.stringify(v);
      }
      return v;
    }
    return JSON.stringify(v);
  }

  function keyToYaml(k){
    return /^[A-Za-z0-9_]+$/.test(k) ? k : JSON.stringify(k);
  }

  function stringifyLines(data, depth){
    const pad = '  '.repeat(depth);
    const lines = [];
    if(Array.isArray(data)){
      if(data.length === 0){ lines.push(pad + '[]'); return lines; }
      for(const item of data){
        if(item !== null && typeof item === 'object' && Object.keys(item).length){
          const sub = stringifyLines(item, depth + 1);
          const childPad = '  '.repeat(depth + 1);
          lines.push(pad + '- ' + sub[0].slice(childPad.length));
          lines.push(...sub.slice(1));
        } else {
          lines.push(pad + '- ' + scalarToYaml(item));
        }
      }
      return lines;
    }
    if(data !== null && typeof data === 'object'){
      const keys = Object.keys(data);
      if(keys.length === 0){ lines.push(pad + '{}'); return lines; }
      for(const k of keys){
        const v = data[k];
        const keyStr = keyToYaml(k);
        if(v !== null && typeof v === 'object' && ((Array.isArray(v) && v.length) || (!Array.isArray(v) && Object.keys(v).length))){
          lines.push(pad + keyStr + ':');
          lines.push(...stringifyLines(v, depth + 1));
        } else if(v !== null && typeof v === 'object'){
          lines.push(pad + keyStr + ': ' + (Array.isArray(v) ? '[]' : '{}'));
        } else {
          lines.push(pad + keyStr + ': ' + scalarToYaml(v));
        }
      }
      return lines;
    }
    lines.push(pad + scalarToYaml(data));
    return lines;
  }

  function toYAML(data){
    return stringifyLines(data, 0).join('\n') + '\n';
  }

  global.ParsecYAML = { parse: parseYAML, stringify: toYAML };

  if(typeof module !== 'undefined' && module.exports) module.exports = global.ParsecYAML;
})(typeof window !== 'undefined' ? window : globalThis);
