// Applies UP_SET overrides to the dummy worktree's live modules before a bench script runs:
//   UP_SET='{"hero":{"joker":{"damage":12,"skill.cost":50}},"upcoming":{"joker":{"fixed":"red"}}}' node --import ./preload.mjs <script>
const WT=process.env.UP_WT||new URL('../../src/',import.meta.url).href;
const {HERO}=await import(WT+'content.js');
const E=await import(WT+'combat/engine.js');
const set=JSON.parse(process.env.UP_SET||'{}');
for(const [id,fields] of Object.entries(set.hero||{}))for(const [path,v] of Object.entries(fields)){let o=HERO[id];if(!o)throw new Error('unknown hero '+id);const keys=path.split('.');for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=v;}
for(const [id,fields] of Object.entries(set.upcoming||{})){if(!E.UPCOMING?.[id])throw new Error('unknown UPCOMING.'+id);Object.assign(E.UPCOMING[id],fields);}
