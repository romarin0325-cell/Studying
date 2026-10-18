// Joker: contribution per fixed colour on random teams, then each colour on the team that wants it, plus cycle/random order.
//   node joker-study.mjs [--set '{"hero":{"joker":{"damage":12}}}']
import {contrib,fmt} from './lib.mjs';
const args=process.argv.slice(2),base=JSON.parse((args[args.indexOf('--set')+1])||'{}');
const merge=(a,b)=>JSON.parse(JSON.stringify({hero:{...a.hero,...b.hero},upcoming:{...a.upcoming,...b.upcoming}}));
const COLOURS=['red','blue','green','white','black'];
const TEAMS={
  burn:'flame_sage,red_dragon,zeke,cherry_prince',frost:'snow_rabbit,avalanche_maid,frost_witch,guardian',poison:'mushroom_king,phantom,time_ruler,galaxy_whale',
  marks:'silver_rabbit,jasmine,galaxy_whale,cherry_prince',expose:'great_detective,phantom,luna,zeke',plain:'star_boy,night_rabbit,storm_sage,lightning_sage',
};
console.log('## 조커 · 색 고정, 무작위 팀 10개 (1·3·5성 평균 지수 / 예산 1.0)\n\n| 색 | 1성 | 3성 | 5성 |\n|---|---:|---:|---:|');
const row=(label,set,extra=[])=>{const r=contrib({heroes:['joker'],set:merge(base,set),args:extra}).joker;console.log(`| ${label} | ${fmt(r[1].mean)} | ${fmt(r[3].mean)} | ${fmt(r[5].mean)} |`);return r;};
for(const c of COLOURS)row(c,{upcoming:{joker:{fixed:c}}});
row('cycle(전체 평균)',{upcoming:{joker:{order:'cycle',fixed:null}}});
row('random(전체 평균)',{upcoming:{joker:{order:'random',fixed:null}}});
console.log('\n## 색이 맞는 팀에서 (3성 지수 평균, 팀 참조 4명 고정)\n\n| 팀 | '+COLOURS.join(' | ')+' | cycle |\n|---|'+COLOURS.map(()=>'---:').join('|')+'|---:|');
for(const [name,team] of Object.entries(TEAMS)){
  const cells=[];
  for(const c of [...COLOURS,null]){const r=contrib({heroes:['joker'],set:merge(base,{upcoming:{joker:c?{fixed:c}:{order:'cycle',fixed:null}}}),ranks:'3',teams:1,args:['--team',team]}).joker;cells.push(fmt(r[3].mean));}
  console.log(`| ${name} | ${cells.join(' | ')} |`);
}
