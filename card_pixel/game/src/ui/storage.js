export const storage = {
  getItem(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* This visit can continue in memory. */ }
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
};
