import {ASSET_PATHS} from './content.js';

// Keep authored sources for crops/reproduction, but do not embed or preload them.
export const BUILD_ONLY_ATLASES=Object.freeze({
  blessings:'Unused painting; blessing rewards use text and UI icons.',
  relics:'Source for collection relic icon crops.',
  'relics-expansion':'Source for collection relic icon crops.',
  'relics-new':'Source for collection relic icon crops.',
  'effects-sol-sweet':'Opaque Sol effect sprites, replaced in pass 15 by effects-companion-sweet; kept as the approved source.',
  'effects-sol-twilight':'Opaque Sol effect sprites, replaced in pass 15 by effects-companion-twilight; kept as the approved source.',
});
export const RUNTIME_ASSET_PATHS=Object.freeze(Object.fromEntries(
  Object.entries(ASSET_PATHS).filter(([id])=>!Object.hasOwn(BUILD_ONLY_ATLASES,id)),
));
