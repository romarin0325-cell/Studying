// Toffee Apple bombs in real stage plays with a forced casting policy (the smart auto rarely presses this ultimate):
//   eager: cast whenever starlight and a free bomb slot allow it and an enemy is alive
//   early: cast only while the foremost enemy is still in the first quarter of the path (bombs get set ahead of the wave)
// For every blast: wave, enemies alive at that moment, bomb position on the path and the damage dealt to enemies' hp.
//   node --import ./preload.mjs bombs.mjs --deck toffee_apple,star_boy,snow_rabbit,night_rabbit,siren --stages 5,9,13 --seeds 6 --policy eager
import {playStage,engine,HERO,mean} from './play.mjs';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const deck=opt('deck','toffee_apple,star_boy,snow_rabbit,night_rabbit,siren').split(','),stages=opt('stages','5,9,13').split(',').map(Number),seeds=Number(opt('seeds',6)),policy=opt('policy','eager');
const L=engine.PATH_LENGTH;
console.log(`정책 ${policy} · 덱 ${deck.join(',')}`);
console.log('| 스테이지 | 승률 | 라운드 | 설치 | 폭발 | 폭발 때 생존 적 | 4기 이하 폭발 | 폭탄 위치(경로 %) | 폭탄 1개 총피해(적 합계) | 토피애플 피해 합 |');
console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const stage of stages){
  const rows=[];
  for(let seed=1;seed<=seeds;seed++){
    const blasts=[];let before=null;
    const r=playStage(deck,stage,seed,{tap:(s,track)=>{
      if(!s.enemies.some(e=>e.hp>0)||s.phase!=='combat')return;
      const front=s.enemies.reduce((m,e)=>e.hp>0?Math.max(m,e.progress):m,0);
      if(HERO.toffee_apple&&s.gauge>=HERO.toffee_apple.skill.cost&&(s.bombs||[]).length<3&&(policy==='eager'||front<L*.25))engine.cast(s,'toffee_apple');
    }});
    r.blasts=r.track.bombBlasts;rows.push(r);
  }
  const blasts=rows.flatMap(r=>r.blasts);
  console.log(`| ${stage} | ${(mean(rows,r=>+r.won)*100).toFixed(0)}% | ${mean(rows,r=>r.rounds).toFixed(2)} | ${mean(rows,r=>r.track.events.bombSet||0).toFixed(1)} | ${(blasts.length/seeds).toFixed(1)} | ${blasts.length?(blasts.reduce((n,b)=>n+b.alive,0)/blasts.length).toFixed(1):'—'} | ${blasts.length?(blasts.filter(b=>b.alive<=4).length/blasts.length*100).toFixed(0)+'%':'—'} | ${blasts.length?Math.round(blasts.reduce((n,x)=>n+x.pct,0)/blasts.length*100)+"%":"—"} | ${blasts.length?Math.round(blasts.reduce((n,x)=>n+x.potential,0)/blasts.length).toLocaleString("ko-KR"):"—"} | ${Math.round(mean(rows,r=>r.byHero.toffee_apple||0)).toLocaleString('ko-KR')} |`);
}
