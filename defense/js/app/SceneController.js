export class SceneController {
  constructor(root, factories = {}) {
    this.root = root;
    this.factories = factories;
    this.current = null;
    this.currentName = null;
  }

  show(name, options = {}) {
    const Factory = this.factories[name];
    if (!Factory) throw new RangeError(`Unknown scene: ${name}`);
    this.current?.destroy?.();
    this.root.replaceChildren();
    this.current = new Factory(options);
    this.currentName = name;
    this.current.mount(this.root);
    return this.current;
  }

  destroy() {
    this.current?.destroy?.();
    this.current = null;
    this.currentName = null;
    this.root.replaceChildren();
  }
}

export default SceneController;
