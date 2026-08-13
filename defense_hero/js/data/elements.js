export const ELEMENT_ADVANTAGE_MULTIPLIER = 1.2;

export const ELEMENT_DEFINITIONS = Object.freeze([
  {
    id: "water",
    name: "물",
    iconId: "element/water",
    uiToken: "element-water",
    advantageAgainst: "fire",
    description: "불 속성 적에게 주는 최종 피해가 20% 증가합니다.",
  },
  {
    id: "fire",
    name: "불",
    iconId: "element/fire",
    uiToken: "element-fire",
    advantageAgainst: "nature",
    description: "자연 속성 적에게 주는 최종 피해가 20% 증가합니다.",
  },
  {
    id: "nature",
    name: "자연",
    iconId: "element/nature",
    uiToken: "element-nature",
    advantageAgainst: "water",
    description: "물 속성 적에게 주는 최종 피해가 20% 증가합니다.",
  },
  {
    id: "light",
    name: "빛",
    iconId: "element/light",
    uiToken: "element-light",
    advantageAgainst: "dark",
    description: "어둠 속성 적에게 주는 최종 피해가 20% 증가합니다.",
  },
  {
    id: "dark",
    name: "어둠",
    iconId: "element/dark",
    uiToken: "element-dark",
    advantageAgainst: "light",
    description: "빛 속성 적에게 주는 최종 피해가 20% 증가합니다.",
  },
]);

export const ELEMENT_IDS = Object.freeze(ELEMENT_DEFINITIONS.map(({ id }) => id));

export const ELEMENT_BY_ID = Object.freeze(
  Object.fromEntries(ELEMENT_DEFINITIONS.map((definition) => [definition.id, definition])),
);

export function getElementMultiplier(attackerElement, defenderElement) {
  const attacker = ELEMENT_BY_ID[attackerElement];
  if (!attacker || !ELEMENT_BY_ID[defenderElement]) return 1;
  return attacker.advantageAgainst === defenderElement ? ELEMENT_ADVANTAGE_MULTIPLIER : 1;
}
