/*
 * Parsec — collapsible tree viewer for any parsed JSON/XML/YAML/CSV value.
 */
(function(global){
  "use strict";

  function typeLabel(v){
    if(v === null) return 'null';
    if(Array.isArray(v)) return 'array';
    return typeof v;
  }

  function valueSpan(v){
    const span = document.createElement('span');
    const t = typeLabel(v);
    span.className = 'tv-val tv-' + t;
    if(t === 'string') span.textContent = JSON.stringify(v);
    else span.textContent = String(v);
    return span;
  }

  function countLabel(v){
    if(Array.isArray(v)) return v.length + (v.length === 1 ? ' item' : ' items');
    return Object.keys(v).length + (Object.keys(v).length === 1 ? ' key' : ' keys');
  }

  function buildNode(key, value, depth, isRoot){
    const wrap = document.createElement('div');
    wrap.className = 'tv-node';

    const isContainer = value !== null && typeof value === 'object';

    const row = document.createElement('div');
    row.className = 'tv-row';

    if(isContainer){
      const toggle = document.createElement('button');
      toggle.className = 'tv-toggle';
      toggle.type = 'button';
      toggle.textContent = '▾';
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tv-spacer';
      row.appendChild(spacer);
    }

    if(key !== null){
      const keyEl = document.createElement('span');
      keyEl.className = 'tv-key';
      keyEl.textContent = key;
      row.appendChild(keyEl);
      const colon = document.createElement('span');
      colon.className = 'tv-colon';
      colon.textContent = Array.isArray(value) || (value !== null && typeof value === 'object') ? '' : ':';
      row.appendChild(colon);
    }

    let childContainer = null;

    if(isContainer){
      const bracket = document.createElement('span');
      bracket.className = 'tv-bracket';
      const open = Array.isArray(value) ? '[' : '{';
      const close = Array.isArray(value) ? ']' : '}';
      bracket.textContent = open;
      row.appendChild(bracket);

      const meta = document.createElement('span');
      meta.className = 'tv-meta';
      meta.textContent = ' ' + countLabel(value) + ' ';
      row.appendChild(meta);

      const closeBracket = document.createElement('span');
      closeBracket.className = 'tv-bracket tv-bracket-close-inline';
      closeBracket.textContent = close;
      row.appendChild(closeBracket);

      childContainer = document.createElement('div');
      childContainer.className = 'tv-children';

      const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
      for(const [k, v] of entries){
        childContainer.appendChild(buildNode(k, v, depth + 1, false));
      }

      row.querySelector('.tv-toggle').addEventListener('click', () => {
        const collapsed = wrap.classList.toggle('tv-collapsed');
        row.querySelector('.tv-toggle').textContent = collapsed ? '▸' : '▾';
      });

      if(depth >= 2){
        wrap.classList.add('tv-collapsed');
        row.querySelector('.tv-toggle').textContent = '▸';
      }
    } else {
      row.appendChild(valueSpan(value));
    }

    wrap.appendChild(row);
    if(childContainer) wrap.appendChild(childContainer);
    return wrap;
  }

  function render(container, data){
    container.innerHTML = '';
    container.appendChild(buildNode(null, data, 0, true));
  }

  function setAllCollapsed(container, collapsed){
    container.querySelectorAll('.tv-node').forEach(node => {
      const toggle = node.querySelector(':scope > .tv-row > .tv-toggle');
      if(!toggle) return;
      node.classList.toggle('tv-collapsed', collapsed);
      toggle.textContent = collapsed ? '▸' : '▾';
    });
  }

  global.ParsecTree = { render, setAllCollapsed };
})(typeof window !== 'undefined' ? window : globalThis);
