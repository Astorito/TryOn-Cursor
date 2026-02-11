// Proxy loader: fetches the actual widget from /api/widget and injects it.
(function() {
  try {
    const current = document.currentScript;
    fetch('/api/widget', { cache: 'no-store' })
      .then(res => res.text())
      .then(code => {
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.text = code;
        if (current && current.parentNode) {
          current.parentNode.insertBefore(s, current.nextSibling);
        } else {
          document.head.appendChild(s);
        }
      })
      .catch(err => {
        console.error('TryOn: failed to load widget proxy', err);
      });
  } catch (e) {
    console.error('TryOn proxy error', e);
  }
})();

