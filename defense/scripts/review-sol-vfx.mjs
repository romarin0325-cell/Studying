// Rebuild the portable before/after viewer without touching a production build.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {ASSET_PATHS} from '../src/content.js';
import {COMPANION_VISUALS} from '../src/combat/companion-vfx.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
const dir=path.join(gameRoot,'docs/review/sol-vfx'),images={},records=[];
const descriptions={
  toffee_apple:{attack:'관통 판정에 맞춘 가는 사탕 코팅 광선. 붉은 시럽과 크림색 하이라이트로 의상·사과의 광택을 이어간다.',skill:'애플봄 · 95: 설치 대기와 실제 폭발을 분리한다. 사탕 껍질과 설탕 조각이 터지고, 적 전체의 명중점에 짧은 코팅 파편이 생긴다. 주변 원을 피해 범위로 표시하지 않는다.'},
  joker:{attack:'아이보리·금색 카드와 자홍빛 궤적. 빨강·파랑·초록·하양·검정의 현재 상태색은 밝기가 확보된 작은 보석빛으로 구별한다.',skill:'레인보우 룰렛 · 50: 카드 다섯 장이 펼쳐지고 새 상태색으로 정착한다. 저비용 전체 공격은 작은 명중점으로 마무리하며, 다른 필살기와 같은 거대 불꽃을 쓰지 않는다.'},
  sunflower:{attack:'꽃 장식과 올리브색 잎을 담은 작은 햇빛 탄. 햇빛이 쌓였을 때만 실제 반경 30·60·90을 가는 원으로 남긴다.',skill:'솔라플레어 · 90: 꽃 중심에서 한 번의 태양이 피어난다. 저장한 햇빛을 소비하는 표시는 유지하고, 반복 별 문양·화면 섬광을 없앤다.'},
  underdog:{attack:'반짝이는 마법탄 대신 부서진 돌과 짧은 먼지 꼬리. 거친 인간 싸움꾼의 투석으로 읽히게 한다.',skill:'빅쇼 · 80: 허공의 거대 주먹 대신 본체의 짧은 강타와 전장으로 번지는 흙먼지·균열. 적 전체 타격과 아군 2초 기절의 기존 결과를 함께 본다.'},
  cure_master:{attack:'간호사 모티프의 레모네이드 주사기. 공격 후 남는 장판의 기존 판정은 그대로이며, 아군 보호와 다른 형태로 읽힌다.',skill:'레모네이드 · 50: 레몬·분홍 하트·흰 날개의 보호 표식이 아군 옆과 발밑에 나타난다. 적 피격처럼 보이는 공용 불꽃을 제거한다. 기절·저주 해제와 무적의 실제 지속시간은 그대로.'},
  venom:{attack:'검은 백합 꽃잎을 품은 초록 독액. 검정 재질을 보존해 밝은 바닥에서도 병과 시든 꽃의 인상을 남긴다.',skill:'플래이그 · 80: 조용한 검은 백합이 적 발밑에서 피어난다. 3중첩 중독과 지속 피해 증폭을 거대한 화염 폭발 대신 국소적인 꽃과 포자로 표현한다.'},
  ash:{attack:'의상의 검은 깃털과 손바닥의 크림·주황 불꽃. 검은 심장을 가진 작은 불씨가 범위 명중으로 이어진다.',skill:'아마겟돈 · 70: 동료 환원과 적 밀집 지점의 폭발을 분리한다. 검은 깃털이 감싼 불의 핵을 실제 반경 180에 제한한다. 전장 전체 공격처럼 보이는 공용 섬광을 쓰지 않는다.'},
  antropy:{attack:'작은 흰 별과 얇은 교차 궤도. 보라색 면으로 가득 찬 첫 후보는 버리고, 원래 후광의 비어 있는 실루엣을 채택했다.',skill:'노바레퀴엠 · 50: 얇은 궤도가 한 번 열리고 지워지는 디버프가 작은 흰 파편으로 흩어진다. 적 디버프 제거와 전체 7배 피해를 단일 점진 장판처럼 표현하지 않는다.'},
};
const selected=[...Object.keys(COMPANION_VISUALS).map(id=>'unit-'+id),'unit-zeke','unit-queen','unit-siren','garden','realms-expansion','creatures','effects','effects-bigshow','effects-applebomb','ultimates','finishers','fx-emblems','effects-sol-sweet','effects-sol-twilight'];
async function add(id,file){const bytes=await fs.readFile(file);images[id]='data:image/webp;base64,'+bytes.toString('base64');records.push({id,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
for(const id of selected)await add(id,assetFile(ASSET_PATHS[id]));
await add('bright-garden',assetFile('./assets/bright/garden.webp'));
for(const id of Object.keys(COMPANION_VISUALS))await add('before-'+id,path.join(dir,'before-units',id+'.webp'));
const bundle=await build({entryPoints:[path.join(dir,'review.js')],bundle:true,write:false,format:'esm',target:['es2022'],minify:true,charset:'utf8'});
const html=(await fs.readFile(path.join(dir,'template.html'),'utf8')).replace('/*__DATA__*/',()=>`window.SOL_DATA=${JSON.stringify({heroes:descriptions,images})};`).replace('/*__SCRIPT__*/',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(path.join(dir,'index.html'),html.trimEnd()+'\n');
const sourceSnapshots=[];for(const name of ['render.js','effects.js']){const text=(await fs.readFile(path.join(dir,'before',name),'utf8')).replace(/\r\n/g,'\n');sourceSnapshots.push({file:'before/'+name,normalizedLfSha256:createHash('sha256').update(text).digest('hex')});}
await fs.writeFile(path.join(dir,'sources.json'),JSON.stringify({baseCommit:'e3999265dc38a9087b525c29cf77bba7c5551df7',baseline:'Original render.js/effects.js with import paths rebased only, plus original eight unit WebPs',sourceSnapshots,renderer:'actual production Renderer and CombatFX, fixed real-engine fixture; no separately invented preview effects',mineFixture:'At 1.35s one enemy is moved within 70px of the planted mine; detonation uses the real engine trigger.',textures:records},null,2)+'\n');
console.log(path.join(dir,'index.html')+' · '+Buffer.byteLength(html)+' bytes');
