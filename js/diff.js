/*
 * Parsec — diff engine.
 * Line-level LCS diff, plus two heuristics on top of the raw result:
 *  - move detection: a removed line + an added line with identical text
 *    elsewhere become a paired "moved" line instead of a delete+insert.
 *  - modification detection: an adjacent removed+added pair with enough
 *    token overlap is treated as one "modified" line, rendered with
 *    word-level (token) highlighting instead of a solid-color whole line.
 */
(function(global){
  "use strict";

  function diffLines(a, b){
    const la = a.split('\n'), lb = b.split('\n');
    const n = la.length, m = lb.length;
    if(n * m > 6000000) return { tooLarge: true };
    const dp = new Array(n + 1);
    for(let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for(let i = n - 1; i >= 0; i--){
      for(let j = m - 1; j >= 0; j--){
        dp[i][j] = la[i] === lb[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
      }
    }
    let i = 0, j = 0;
    const result = [];
    while(i < n && j < m){
      if(la[i] === lb[j]){ result.push({ type: 'same', text: la[i], lineA: i+1, lineB: j+1 }); i++; j++; }
      else if(dp[i+1][j] >= dp[i][j+1]){ result.push({ type: 'removed', text: la[i], lineA: i+1 }); i++; }
      else { result.push({ type: 'added', text: lb[j], lineB: j+1 }); j++; }
    }
    while(i < n){ result.push({ type: 'removed', text: la[i], lineA: i+1 }); i++; }
    while(j < m){ result.push({ type: 'added', text: lb[j], lineB: j+1 }); j++; }
    return { rows: result };
  }

  function detectMoves(rows){
    const removedByText = {}, addedByText = {};
    rows.forEach((r, idx) => {
      const t = r.text.trim();
      if(t.length < 3) return;
      if(r.type === 'removed') (removedByText[t] = removedByText[t] || []).push(idx);
      if(r.type === 'added') (addedByText[t] = addedByText[t] || []).push(idx);
    });
    let moved = 0;
    for(const text of Object.keys(removedByText)){
      const removedIdxs = removedByText[text];
      const addedIdxs = addedByText[text] || [];
      const pairs = Math.min(removedIdxs.length, addedIdxs.length);
      for(let k = 0; k < pairs; k++){
        const rRow = rows[removedIdxs[k]], aRow = rows[addedIdxs[k]];
        rRow.type = 'moved-from'; rRow.pairLine = aRow.lineB;
        aRow.type = 'moved-to'; aRow.pairLine = rRow.lineA;
        moved++;
      }
    }
    return moved;
  }

  function tokenize(line){
    return line.split(/(\s+|[<>="'\/:,.\{\}\[\]])/).filter(t => t.length);
  }

  function tokenLCS(ta, tb){
    const n = ta.length, m = tb.length;
    const dp = new Array(n + 1);
    for(let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for(let i = n - 1; i >= 0; i--)
      for(let j = m - 1; j >= 0; j--)
        dp[i][j] = ta[i] === tb[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    return dp;
  }

  // Returns { oldSpans:[{type,text}], newSpans:[{type,text}] } with token-level same/removed/added
  function tokenDiff(oldText, newText){
    const ta = tokenize(oldText), tb = tokenize(newText);
    const dp = tokenLCS(ta, tb);
    let i = 0, j = 0;
    const oldSpans = [], newSpans = [];
    while(i < ta.length && j < tb.length){
      if(ta[i] === tb[j]){ oldSpans.push({ type: 'same', text: ta[i] }); newSpans.push({ type: 'same', text: tb[j] }); i++; j++; }
      else if(dp[i+1][j] >= dp[i][j+1]){ oldSpans.push({ type: 'removed', text: ta[i] }); i++; }
      else { newSpans.push({ type: 'added', text: tb[j] }); j++; }
    }
    while(i < ta.length){ oldSpans.push({ type: 'removed', text: ta[i] }); i++; }
    while(j < tb.length){ newSpans.push({ type: 'added', text: tb[j] }); j++; }
    return { oldSpans, newSpans };
  }

  function similarity(aText, bText){
    const ta = tokenize(aText), tb = tokenize(bText);
    if(ta.length === 0 || tb.length === 0) return 0;
    const dp = tokenLCS(ta, tb);
    const lcsLen = dp[0][0];
    return (2 * lcsLen) / (ta.length + tb.length);
  }

  // Adjacent removed->added (or added->removed) pairs with enough token
  // overlap become one "modified" line pair instead of separate rows.
  function detectModifications(rows, threshold){
    threshold = threshold || 0.4;
    let modified = 0;
    for(let idx = 0; idx < rows.length - 1; idx++){
      const cur = rows[idx], next = rows[idx + 1];
      if(cur.type === 'removed' && next.type === 'added'){
        const sim = similarity(cur.text, next.text);
        if(sim >= threshold){
          const td = tokenDiff(cur.text, next.text);
          cur.type = 'modified-from'; cur.tokenSpans = td.oldSpans;
          next.type = 'modified-to'; next.tokenSpans = td.newSpans;
          modified++;
        }
      }
    }
    return modified;
  }

  global.ParsecDiff = { diffLines, detectMoves, detectModifications, tokenDiff, similarity };
})(typeof window !== 'undefined' ? window : globalThis);
