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

  const state = new WeakMap();

  function entry(img, source) {
    const current = state.get(img);
    if (!current || current.source !== source) {
      const next = { source, skip: 0 };
      state.set(img, next);
      return next;
    }
    return current;
  }

  window.AzurePortraits = {
    bases,
    resolve(source, img) {
      if (!source) return '';
      if (/^(?:https?:|data:|blob:)/i.test(source)) return source;
      const skip = img ? entry(img, source).skip : 0;
      const base = bases[Math.min(skip, bases.length - 1)] || '';
      return base + source;
    },
    noteFailure(img, source) {
      if (!img) return false;
      const current = entry(img, source);
      current.skip += 1;
      return current.skip < bases.length;
    },
    reset(img) {
      if (img) state.delete(img);
    }
  };
})();
