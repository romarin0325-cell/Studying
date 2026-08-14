export const ELEMENTS = Object.freeze(['water', 'fire', 'nature', 'light', 'dark']);

export const DEFAULT_ELEMENT_ADVANTAGES = Object.freeze({
  water: 'fire',
  fire: 'nature',
  nature: 'water',
  light: 'dark',
  dark: 'light',
});

export const DEFAULT_ADVANTAGE_MULTIPLIER = 1.2;

/** Stateless element matchup rules. */
export class ElementRules {
  constructor(options = {}) {
    const normalized = typeof options === 'number'
      ? { advantageMultiplier: options }
      : options;
    const {
      advantageMultiplier = DEFAULT_ADVANTAGE_MULTIPLIER,
      advantages = DEFAULT_ELEMENT_ADVANTAGES,
    } = normalized;

    if (!Number.isFinite(advantageMultiplier) || advantageMultiplier < 1) {
      throw new RangeError('advantageMultiplier must be a finite number greater than or equal to 1');
    }

    this.advantageMultiplier = advantageMultiplier;
    this._advantages = new Map();
    for (const element of ELEMENTS) {
      const target = advantages instanceof Map ? advantages.get(element) : advantages[element];
      if (!ELEMENTS.includes(target)) {
        throw new TypeError(`Missing or invalid advantage target for element: ${element}`);
      }
      this._advantages.set(element, target);
    }
    Object.freeze(this);
  }

  validateElement(element) {
    return ELEMENTS.includes(element);
  }

  assertElement(element) {
    if (!this.validateElement(element)) {
      throw new RangeError(`Unknown element: ${String(element)}`);
    }
    return element;
  }

  getAdvantageAgainst(element) {
    this.assertElement(element);
    return this._advantages.get(element);
  }

  hasAdvantage(attackerElement, defenderElement) {
    this.assertElement(attackerElement);
    this.assertElement(defenderElement);
    return this._advantages.get(attackerElement) === defenderElement;
  }

  getMultiplier(attackerElement, defenderElement) {
    return this.hasAdvantage(attackerElement, defenderElement)
      ? this.advantageMultiplier
      : 1;
  }
}

export const elementRules = new ElementRules();

export const validateElement = (element) => elementRules.validateElement(element);
export const getAdvantageAgainst = (element) => elementRules.getAdvantageAgainst(element);
export const getMultiplier = (attackerElement, defenderElement) => (
  elementRules.getMultiplier(attackerElement, defenderElement)
);

export default ElementRules;
