export const storage = {
  getItem(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
};
