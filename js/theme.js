/*
 * Parsec — dark/light theme toggle. Persists choice in localStorage;
 * falls back to the OS-level color-scheme preference on first visit.
 */
(function(global){
  "use strict";

  const STORAGE_KEY = 'parsec-theme';

  function getStored(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }
  function setStored(v){
    try{ localStorage.setItem(STORAGE_KEY, v); }catch(e){ /* ignore */ }
  }

  function systemPrefersLight(){
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function apply(theme){
    document.documentElement.setAttribute('data-theme', theme);
  }

  function init(){
    const stored = getStored();
    const theme = stored || (systemPrefersLight() ? 'light' : 'dark');
    apply(theme);
    return theme;
  }

  function toggle(){
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    apply(next);
    setStored(next);
    return next;
  }

  global.ParsecTheme = { init, toggle, apply };
})(typeof window !== 'undefined' ? window : globalThis);
