export class SceneRouter {
  constructor(onChange) {
    this.stack = [];
    this.onChange = onChange;
  }

  get current() {
    return this.stack.at(-1) ?? null;
  }

  push(name, params = {}) {
    this.stack.push({ name, params });
    return this.#notify("push");
  }

  replace(name, params = {}) {
    if (this.stack.length) this.stack.pop();
    this.stack.push({ name, params });
    return this.#notify("replace");
  }

  reset(name, params = {}) {
    this.stack = [{ name, params }];
    return this.#notify("reset");
  }

  back() {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    this.#notify("back");
    return true;
  }

  serialize() {
    return this.stack.map(({ name, params }) => ({ name, params }));
  }

  #notify(action) {
    this.onChange?.(this.current, action, this.serialize());
    return this.current;
  }
}
