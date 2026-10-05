// The optional local solo artifact is compiled separately. Its save format and
// roster constraints never depend on a query string or a mutable browser flag.
export const SOLO=typeof __GARDEN_SOLO__!=='undefined'&&__GARDEN_SOLO__===true;
export const TEAM_SIZE=SOLO?1:5;
export const SAVE_KEY=SOLO?'astra.star-garden.solo.v1':'astra.star-garden.test.v1';
