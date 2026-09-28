import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { COSTUMES, COSTUME_TIERS, ACHIEVEMENTS, createProfile, purchaseShopItem, drawCostumeTicket, equipCostume, costumeForHero, achievementProgress, recordDungeonClear } from '../meta.js';

const generated=new URL('../generated-assets/',import.meta.url);
async function alphaBox(path) {
  const {data,info}=await sharp(fileURLToPath(new URL(path,generated))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let pixel=0;pixel<info.width*info.height;pixel++){
    if(data[pixel*4+3]<=30)continue;
    const x=pixel%info.width,y=Math.floor(pixel/info.width);
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  return {canvas:[info.width,info.height],box:[left,top,right-left+1,bottom-top+1]};
}

test('all twelve costume silhouettes match their original in-game bounds',async()=>{
  const base={0:'heroes/0.webp',1:'heroes/1.webp',2:'heroes/2.webp',3:'heroes/3.webp',4:'companions/0.webp',6:'companions/2.webp'};
  for(const [index,costume] of COSTUMES.entries()){
    const expected=await alphaBox(base[costume.hero]),actual=await alphaBox(`costumes/${index}.webp`);
    assert.deepEqual(actual,expected,costume.id);
  }
  assert.deepEqual(await alphaBox('companions/dark-fairy.webp'),{canvas:[512,512],box:[62,70,387,371]});
  assert.deepEqual(await alphaBox('astea/0.webp'),{canvas:[384,384],box:[46,3,291,363]});
});

test('the three random ticket lineups contain the specified four costumes',()=>{
  assert.deepEqual(COSTUME_TIERS.map(tier=>[tier.name,tier.cost,tier.lineup.length]),[
    ['일상',10,4],['판타지',10,4],['스페셜',10,4],['미라클',30,12]
  ]);
  assert.deepEqual(COSTUME_TIERS[0].lineup.map(costume=>costume.name),['파자마','롱패딩','교복','세일러복']);
  assert.deepEqual(COSTUME_TIERS[1].lineup.map(costume=>costume.name),['성기사','고딕로리타','섀도우캣','눈꽃메이드']);
  assert.deepEqual(COSTUME_TIERS[2].lineup.map(costume=>costume.name),['아이돌','웨딩','유카타','사쿠라바니']);
  assert.equal(new Set(COSTUMES.map(costume=>costume.id)).size,12);
});

test('tickets purchase at 10 or 30 crystals, draw one costume, refund duplicates, and survive reload',()=>{
  const profile=createProfile({dreamShards:50});
  assert.equal(purchaseShopItem(profile,'daily').ok,true);
  assert.equal(purchaseShopItem(profile,'miracle').ok,true);
  assert.equal(profile.dreamShards,10);
  assert.deepEqual([profile.costumeTickets.daily,profile.costumeTickets.miracle],[1,1]);
  const first=drawCostumeTicket(profile,'daily',()=>0);
  assert.equal(first.costume.id,'night-pajama');assert.equal(first.duplicate,false);
  assert.equal(profile.costumeTickets.daily,0);
  assert.equal(drawCostumeTicket(profile,'daily').ok,false);
  assert.equal(drawCostumeTicket(profile,'miracle',()=>0,'not-a-costume').ok,false);
  assert.equal(profile.costumeTickets.miracle,1);
  const duplicate=drawCostumeTicket(profile,'miracle',()=>.9,'night-pajama');
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.shardsAwarded,3);
  assert.equal(profile.dreamShards,13);assert.equal(profile.costumeTickets.miracle,0);
  const restored=createProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(restored.costumesOwned,['night-pajama']);
  assert.deepEqual(restored.costumeTickets,profile.costumeTickets);
  assert.equal(restored.dreamShards,13);
});

test('miracle selection and wardrobe equipment stay tied to the correct hero',()=>{
  const profile=createProfile({costumeTickets:{miracle:1}});
  const result=drawCostumeTicket(profile,'miracle',()=>0,'jasmine-wedding');
  assert.equal(result.costume.name,'웨딩');
  assert.equal(equipCostume(profile,3,'jasmine-wedding'),true);
  assert.equal(costumeForHero(profile,3)?.id,'jasmine-wedding');
  assert.equal(equipCostume(profile,0,'jasmine-wedding'),false);
  assert.equal(equipCostume(profile,3,'luna-gothic'),false);
  const restored=createProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(costumeForHero(restored,3)?.name,'웨딩');
  assert.equal(equipCostume(restored,3,null),true);
  assert.equal(costumeForHero(restored,3),null);
});

test('old abyss clears migrate to twelve dungeon achievements with one retroactive reward each',()=>{
  const old=createProfile({version:7,dreamShards:5,clears:{'0:0:abyss:0':true,'1:1:abyss:0':true,'2:0:hard:1':true,'4:0:abyss:5':true}});
  assert.equal(old.dreamShards,11);
  assert.deepEqual(old.achievementClaims,['abyss-0','abyss-5']);
  assert.equal(achievementProgress(old).filter(row=>row.complete).length,2);
  const reload=createProfile(JSON.parse(JSON.stringify(old)));
  assert.equal(reload.dreamShards,11);
  assert.equal(recordDungeonClear(reload,6,1,5,'abyss'),true);
  assert.equal(reload.dreamShards,11);
  assert.equal(recordDungeonClear(reload,6,1,6,'abyss'),true);
  assert.equal(reload.dreamShards,14);
  assert.equal(ACHIEVEMENTS.length,12);
});
