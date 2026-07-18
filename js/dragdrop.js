/*
 * Parsec — drag-and-drop (and click-to-browse) file loading for textareas.
 */
(function(global){
  "use strict";

  function readFile(file, onText){
    const reader = new FileReader();
    reader.onload = () => onText(reader.result);
    reader.onerror = () => onText(null, reader.error);
    reader.readAsText(file);
  }

  // Attaches drag-and-drop + an optional hidden file input to a textarea.
  // onLoaded(text, filename) is called once a file has been read.
  function attach(textarea, onLoaded){
    const panel = textarea.closest('.panel') || textarea.parentElement;

    ['dragenter', 'dragover'].forEach(evt => {
      textarea.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        panel.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      textarea.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        if(evt === 'dragleave' && e.target !== textarea) return;
        panel.classList.remove('drag-over');
      });
    });
    textarea.addEventListener('drop', e => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if(!file) return;
      readFile(file, (text, err) => {
        if(err){ return; }
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if(onLoaded) onLoaded(text, file.name);
      });
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.xml,.csv,.yaml,.yml,.txt';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if(!file) return;
      readFile(file, (text, err) => {
        if(err) return;
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if(onLoaded) onLoaded(text, file.name);
      });
      fileInput.value = '';
    });
    document.body.appendChild(fileInput);
    return () => fileInput.click();
  }

  global.ParsecDragDrop = { attach };
})(typeof window !== 'undefined' ? window : globalThis);
