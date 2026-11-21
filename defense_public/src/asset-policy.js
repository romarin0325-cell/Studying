import {ASSET_PATHS} from './content.js';

// Keep authored sources for crops/reproduction, but do not embed or preload them.
export const BUILD_ONLY_ATLASES=Object.freeze({
  blessings:'Unused painting; blessing rewards use text and UI icons.',
  relics:'GPT-default relic icons, replaced 2026-11-18 by relics-v2 (restyle to the cast art); kept as the approved source.',
  'relics-expansion':'GPT-default relic icons, replaced 2026-11-18 by relics-v2 (restyle to the cast art); kept as the approved source.',
  'relics-new':'GPT-default relic icons, replaced 2026-11-18 by relics-v2 (restyle to the cast art); kept as the approved source.',
  'relics-patch':'GPT-default relic icons, replaced 2026-11-18 by relics-v2 (restyle to the cast art); kept as the approved source.',
  'relics-v2':'Source for collection relic icon crops (restyle 2026-11-18, docs/art/relic-restyle-20261118).',
  'effects-sol-sweet':'Opaque Sol effect sprites, replaced in pass 15 by effects-companion-sweet; kept as the approved source.',
  'effects-sol-twilight':'Opaque Sol effect sprites, replaced in pass 15 by effects-companion-twilight; kept as the approved source.',
  'orbit-zone':'Star Orbit zone drawn as a tilted opaque ellipse, replaced in pass 18 by the round orbit-sea; kept as the approved source.',
  'zeke-slash':'Zeke cleave slash, replaced in pass 18 by zeke-spin when his attack became a circle; kept as the approved source.',
});
export const EMBEDDED_ASSET_PATHS=Object.freeze(Object.fromEntries(
  Object.entries(ASSET_PATHS).filter(([id])=>!Object.hasOwn(BUILD_ONLY_ATLASES,id)),
));
// Event paintings are embedded for the popup, but need not be decoded at battle startup.
export const RUNTIME_ASSET_PATHS=Object.freeze(Object.fromEntries(
  Object.entries(EMBEDDED_ASSET_PATHS).filter(([id])=>id!=='event-oath'&&id!=='event-twin'),
));
