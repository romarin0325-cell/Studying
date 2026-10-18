const fs=require('fs');
const groups={'Thor(폭풍·천둥)':'5,14,23','인조마신(봉인)':'1,10,19','플로라·포세이돈(1칸 기절)':'2,6,11,15','벨제뷔트(도약+봉인)':'8,17','저주의 여신':'4,13','아스테아(천벌)':'9,18'};
const decks={cure:['zeke','luna','great_detective','flame_sage','cure_master'],filler:['zeke','luna','great_detective','flame_sage','siren']};
const out=[];
for(const [g,stages] of Object.entries(groups))for(const [dn,deck] of Object.entries(decks))for(const [an,env] of [['dodge',{}],['nodge',{UP_NODODGE:'1'}]])
  out.push({label:`${g} | ${dn} | ${an}`,deck,stages,seeds:20,env});
fs.writeFileSync('cure-study.json',JSON.stringify(out));console.log(out.length);
