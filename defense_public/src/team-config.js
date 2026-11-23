// The optional local solo and unlocked artifacts are compiled separately.
// Their save formats never depend on a query string or a mutable browser flag.
export const SOLO=typeof __GARDEN_SOLO__!=='undefined'&&__GARDEN_SOLO__===true;
export const UNLOCKED=typeof __GARDEN_UNLOCKED__!=='undefined'&&__GARDEN_UNLOCKED__===true;
// Content preview (starlight oath, twin-star expedition, companion requests): a bright unlocked test build only.
export const PREVIEW=typeof __GARDEN_PREVIEW__!=='undefined'&&__GARDEN_PREVIEW__===true;
export const TEAM_SIZE=SOLO?1:5;
export const SAVE_KEY=SOLO?'astra.star-garden.public-solo.v1':PREVIEW?'astra.star-garden.public-preview.v1':UNLOCKED?'astra.star-garden.public-unlocked.v1':'astra.star-garden.public.v1';
