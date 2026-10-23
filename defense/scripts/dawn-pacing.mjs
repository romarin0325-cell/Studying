// Pacing model of the dawn garden. A player who clears stages at a steady pace after stage 45 puts every grain of dust
// into whichever of the rose and the dawn beds gives the most damage per dust (stardust counts as a flat 0.4% damage
// per level). The table shows how fast the crit beds fill and where the rose keeps going afterwards.
//   node defense/scripts/dawn-pacing.mjs [--pace 0.5] [--rose 42] [--power 3000]
// pace = stages cleared per day, rose = rose level when stage 45 is cleared, power = combat power of a dispatched hero.
import {TUNING as T} from '../src/content.js';
import {bedCost,critChance,critDamage,stardustRate} from '../src/economy.js';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:Number(args[i+1]);};
const PACE=opt('pace',.5),POWER=opt('power',3000);
let rose=opt('rose',42),crit=0,cd=0,sd=0,dust=0;
const expected=(c,d)=>1+critChance(c)*(critDamage(d)-1);
const income=stage=>{
  const idle=20*(T.idleDustPerHour+2*stage);   // one collection a day, 20 hours of accumulation
  const dispatch=4*Math.floor((32+20*Math.log2(1+POWER/500))*(1+stage*T.dispatchStageStep)*T.dispatchDust);
  return idle+dispatch;
};
const done={},marks=[1,3,7,14,30,60,90,120,180],log=[];
for(let day=1;day<=400;day++){
  const stage=Math.min(90,45+PACE*day);
  dust+=income(stage)+PACE*(40+8*stage);        // idle + dispatch + dust for the stages cleared today
  for(let guard=0;guard<500;guard++){
    const E=expected(crit,cd),options=[['rose',bedCost('rose',rose),.01/(1+.01*rose)]];
    options.push(['crit',bedCost('crit',crit),expected(crit+1,cd)/E-1]);
    options.push(['cd',bedCost('critDamage',cd),expected(crit,cd+1)/E-1]);
    if(stage>=T.beds.stardust.unlock)options.push(['sd',bedCost('stardust',sd),.004]);
    const pick=options.filter(o=>o[1]<=dust).sort((a,b)=>b[2]/b[1]-a[2]/a[1])[0];
    if(!pick)break;dust-=pick[1];
    if(pick[0]==='rose')rose++;else if(pick[0]==='crit')crit++;else if(pick[0]==='cd')cd++;else sd++;
  }
  if(crit>=T.beds.crit.knee2&&!done.crit)done.crit=day;if(cd>=T.beds.critDamage.knee2&&!done.cd)done.cd=day;if(sd>=T.beds.stardust.knee2&&!done.sd)done.sd=day;
  if(marks.includes(day))log.push(`| ${day} | ${stage.toFixed(0)} | ${Math.round(income(stage))} | ${rose} | ${crit} (${(critChance(crit)*100).toFixed(1)}%) | ${cd} (${Math.round(critDamage(cd)*100)}%) | ${sd} (+${Math.round(stardustRate(sd)*100)}%) | ×${expected(crit,cd).toFixed(3)} |`);
}
const total=id=>Array.from({length:T.beds[id].knee2},(_,l)=>bedCost(id,l)).reduce((a,b)=>a+b,0);
console.log(`하루 ${PACE}스테이지 · 장미 ${opt('rose',42)}에서 시작 · 파견 전투력 ${POWER}\n`);
console.log(`소프트캡까지 합계: 확률 ${total('crit')} · 대미지 ${total('critDamage')} · 별똥별 ${total('stardust')} 별가루`);
console.log(`soft cap reached: ${JSON.stringify({확률:done.crit,대미지:done.cd,별똥별:done.sd})}\n`);
console.log('| 일 | 스테이지 | 하루 수입 | 장미 | 치명 확률 | 치명 대미지 | 별똥별 | 평균 화력 |','\n|---:|---:|---:|---:|---|---|---|---:|');
console.log(log.join('\n'));
