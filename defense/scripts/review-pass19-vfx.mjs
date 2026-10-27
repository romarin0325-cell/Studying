// Build the portable pass 19 before/after effect viewer (docs/review/pass19-vfx/index.html).
// Textures are the optimized runtime files the release embeds, inlined as data URLs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {ASSET_PATHS} from '../src/content.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
const dir=path.join(gameRoot,'docs/review/pass19-vfx'),images={};
const manifest=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8'));
const runtimePath=source=>{
  const mirrored=source.replace('./assets/','./assets/optimized/');
  const hit=manifest.images.find(i=>i.source===source&&i.output?.path===mirrored);
  return hit?hit.output.path:source;
};
const ids=['unit-zeke','unit-toffee_apple','unit-joker','unit-sunflower','unit-demon_king','unit-doom','garden','creatures','zeke-spin','effects-companion-sweet','effects-joker-sun','effects-chaos-sun','effects-applebomb'];
const notes={
  'zeke-calm':'평타 판정(반경 250 원형)은 그대로다. 평소는 실제 반경까지 퍼지는 가는 불씨 고리와, 회전베기 시트의 불씨 칸을 최대 알파 0.24로 옅게 그린다. 가디언·베히모스 고리와 같은 수준이다. 기존 열은 광폭이 아니어도 18차의 화염검 한 바퀴를 그대로 보여 준다.',
  'zeke-fury':'적이 경로 마지막 4분의 1에 있으면 광폭이다(공격력 +40%). 엔진은 공격 이벤트에 fury만 싣고, 그림은 18차의 화염검 한 바퀴를 그대로 쓴다. 판정은 평소와 같다. 왼쪽 길의 적 한 명이 그 조건이다.',
  'toffee_apple':'큰 사과 껍질 여섯 조각과 적마다 붙던 사과 그림을 없앴다. 설탕 반짝이 고리가 반경 200까지 열리고, 그 안과 맞은 적 위에서 작은 별빛이 반짝인다. 가운데는 비어 있어 유닛과 체력바가 가려지지 않게 했다. 기존 열은 예전 엔진을 따로 돌리지 않고, 이번 엔진이 만든 같은 bombBlast를 재생한다. 기록은 적 전체 10배에서 반경 200·18배지만, 지금 엔진은 여전히 살아있는 적 전체에게 10배이고 이벤트에 반경이 없다. 그래서 200px 밖 적도 타격 목록에 남고, 적용 후 별빛이 그 적 위에도 찍힌다. 고리 그림만 반경 200이다.',
  'joker-chaos':'카오스가 된 뒤의 필살기다. 어릿광대 왕관을 쓴 다섯 색 룰렛 문장이 회전하며 들어오고, 뒤에서 다섯 색 소용돌이 고리가 돈다. 문장에서 카드가 맞은 적에게 날아가 다섯 색 파편으로 터진다. 위치와 무게는 다른 전체 필살기와 같다.',
  'joker-red':'카오스가 아니면 기존 문장을 쓴다. 필살기 그림은 종전과 같고, 배지의 현재 색이 위를 향한다. 이 장면은 빨강에서 시전해 같은 시드의 다음 색으로 바뀐다.',
  'sunflower-3':'햇빛 3개일 때만 쓰는 솔라플레어다. 만개한 햇살 해바라기 문장이 떠오르고, 꽃잎 고리가 바깥으로 열리며 햇살 꽃잎이 몇 장 흩날린다. 맞은 적 위에는 꽃가루가 반짝인다.',
  'sunflower-1':'햇빛이 0~2개일 때는 기존 문장을 그대로 쓴다. 이 장면은 햇빛 1개다.',
  'badges':'햇빛 배지는 넓고 둥근 꽃잎 10장과 씨앗 원판이다. 쌓인 수는 테두리 아래 점 3개로 세고, 햇빛이 없으면 흐리며 3개면 테두리가 따뜻해지고 은은하게 빛난다. 조커의 카오스 글자는 없앴다. 색 고리가 닫혀 다섯 조각 평면 룰렛이 되고 천천히 돈다. 햇빛은 해바라기가 한 스택을 나눠 쓰므로 넷을 세워 두고 1초마다 0에서 3까지 올린다. 조커 둘은 처음 빨강이다가 2초에 카오스가 된다.',
  'demon_king':'관통형은 사거리 원 안의 적을 골라 그 방향으로 끝까지 꿰뚫는다. 선택하면 사거리 안에 들어오는 길을 옅은 띠로 칠하고, 사거리 경계는 아주 옅은 점선 원이다. 지금 쏘는 줄은 판정 폭 그대로의 띠이고 끝으로 갈수록 옅어진다. 갈매기표가 끝까지 관통한다는 뜻이다(동작 줄이기에서는 멈춘다). 기존은 조준 방향의 좁은 띠만 그린다. 마왕은 사거리 520, 판정 폭 24.',
  'doom':'관통형은 사거리 원 안의 적을 골라 그 방향으로 끝까지 꿰뚫는다. 선택하면 사거리 안에 들어오는 길을 옅은 띠로 칠하고, 사거리 경계는 아주 옅은 점선 원이다. 지금 쏘는 줄은 판정 폭 그대로의 띠이고 끝으로 갈수록 옅어진다. 갈매기표가 끝까지 관통한다는 뜻이다(동작 줄이기에서는 멈춘다). 기존은 조준 방향의 좁은 띠만 그린다. 둠은 사거리 450, 판정 폭 22.',
};
for(const id of ids){const source=ASSET_PATHS[id];if(!source)throw Error('Unknown texture '+id);const file=assetFile(runtimePath(source));images[id]='data:image/webp;base64,'+(await fs.readFile(file)).toString('base64');}
images['bright-garden']='data:image/webp;base64,'+(await fs.readFile(assetFile(runtimePath('./assets/bright/garden.webp')))).toString('base64');
const bundle=await build({entryPoints:[path.join(dir,'review.js')],bundle:true,write:false,format:'esm',target:['es2022'],minify:true,charset:'utf8',define:{__GARDEN_SOLO__:'false',__GARDEN_UNLOCKED__:'false'}});
const html=(await fs.readFile(path.join(dir,'template.html'),'utf8')).replace('/*__DATA__*/',()=>`window.PASS19_DATA=${JSON.stringify({notes,images})};`).replace('/*__SCRIPT__*/',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(path.join(dir,'index.html'),html.trimEnd()+'\n');
console.log(path.join(dir,'index.html')+' · '+Buffer.byteLength(html)+' bytes');
