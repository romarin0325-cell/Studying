(() => {
  const bases = [];
  const seen = new Set();
  const add = value => {
    const next = value == null ? '' : String(value);
    if (seen.has(next)) return;
    seen.add(next);
    bases.push(next);
  };
  add('');
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('portraits')) add(params.get('portraits').replace(/\/?$/, '/'));
  } catch (error) { /* file:// without URL API fallback */ }
  add('../../card/');
  add('../card/');
  add('./portraits/');
  add('../');

  const failed = new WeakMap();

  window.AzurePortraits = {
    bases,
    resolve(source, img) {
      if (!source) return '';
      if (/^(?:https?:|data:|blob:)/i.test(source)) return source;
      const skip = (img && failed.get(img)) || 0;
      const base = bases[Math.min(skip, bases.length - 1)] || '';
      return base + source;
    },
    noteFailure(img) {
      failed.set(img, ((failed.get(img) || 0) + 1));
      return (failed.get(img) || 0) < bases.length;
    }
  };
})();
