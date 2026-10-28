// Build the portable pass 20 before/after effect viewer (docs/review/pass20-vfx/index.html).
// Textures are the optimized runtime files the release embeds, inlined as data URLs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {ASSET_PATHS} from '../src/content.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
const dir=path.join(gameRoot,'docs/review/pass20-vfx'),images={};
const manifest=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8'));
const runtimePath=source=>{
  const mirrored=source.replace('./assets/','./assets/optimized/');
  const hit=manifest.images.find(i=>i.source===source&&i.output?.path===mirrored);
  return hit?hit.output.path:source;
};
const ids=['unit-zeke','unit-guardian','unit-luna','unit-ash','unit-siren','unit-joker','unit-miracle_cocoon','unit-miracle_larva','garden','creatures','zeke-spin','effects','effects-companion-twilight','effects-companion-sweet','effects-joker-sun','effects-chaos-sun','effects-demon-miracle','ultimates','ultimates-extra-a','fx-emblems'];
for(const id of ['zeke-ragnarok','ash-armageddon','luna-blade'])if(ASSET_PATHS[id])ids.push(id);
const notes={
  'zeke-calm':'판정(반경 250)은 그대로다. 불씨 고리는 반경의 0.95에서 멈추고 회전베기 시트의 불씨는 0.96 안쪽에 머문다. 존재감은 가디언·기존 지크보다 조금만 올렸다(불씨 알파 0.24→0.32, 고리 0.5→0.6, 선 조금 굵게). 광폭의 화염검 한 바퀴보다 훨씬 조용하다.',
  'zeke-fury':'광폭 화염검은 그림을 그대로 두고 크기만 줄였다. 바깥 불꽃이 반경의 약 1.09배까지 나가던 것을 1.03배 안으로 들였다.',
  'guardian':'사용자 의견(원래가 보기 편하다)에 따라 main과 같은 그림으로 되돌렸다. 두 열이 같아야 한다.',
  'cocoon':'실 고리 그림의 가장 밝은 띠가 반경의 1.05배, 바깥 솜털은 1.2배까지 나가 있었다. 밝은 띠를 0.9배, 솜털 끝을 1.03배로 줄였다.',
  'luna':'다른 동료의 그림 평타와 같은 완성도로 맞췄다(GPT 그림 시트 luna-blade). 초승달 날밑의 달빛 단검이 곧게 날아가고, 꽂힌 자리에 교차 베기 또는 초승달 베기가 번갈아 번뜩인 뒤 0.34초 안에 사라진다. 기존에는 휘어진 세 줄 베기 그림이 직선으로 미끄러졌다.',
  'zeke-skill':'라그나로크. UR 컷인 띠(화면 위 5~31%, 1.6초)가 하늘을 가려 검이 가운데에 그냥 나타나는 것처럼 보였다(위 컷인 띠 토글로 재현). 이제 띠 바로 아래에 불꽃 문이 열리고, 거대한 검이 문을 지나 0.22초부터 내려와 0.62초에 중앙에 꽂힌다. 문이 터지며 섬광·흔들림·충격파, 파동이 닿는 순서로 적마다 불꽃. 띠가 걷힌 뒤 꽂힌 검 전체가 보이고 2.2초에 불씨로 사라진다. 엔진 피해는 그대로다.',
  'ash-skill':'환원: 희생된 동료가 발끝부터 0.8초에 걸쳐 탄다. 잘린 선은 그 동료의 실루엣을 따라 고르지 않게 빛나고, 위쪽은 살짝 그을리며, 불씨 몇 점만 오른다. 아마겟돈: 검은 태양(GPT 그림)이 보드 쪽 하늘에서 0.3초에 떨어져 무리에 닿으면 흔들림과 함께 지옥불 왕관이 실제 반경 둘레로 솟고, 기존 문장이 그 위로 떠오른다.',
  'joker-badge':'사용자 의견에 따라 main의 회전 원판으로 되돌렸다. 두 열이 같아야 한다.',
};
for(const id of ids){const source=ASSET_PATHS[id];if(!source)throw Error('Unknown texture '+id);const file=assetFile(runtimePath(source));images[id]='data:image/webp;base64,'+(await fs.readFile(file)).toString('base64');}
images['bright-garden']='data:image/webp;base64,'+(await fs.readFile(assetFile(runtimePath('./assets/bright/garden.webp')))).toString('base64');
// Resolve source files through Node so esbuild need not enumerate protected ancestor directories.
const virtualFiles={name:'review-files',setup(b){
  b.onResolve({filter:/.*/},args=>({path:args.kind==='entry-point'?path.join(dir,'review.js'):path.resolve(path.dirname(args.importer),args.path),namespace:'review'}));
  b.onLoad({filter:/.*/,namespace:'review'},async args=>({contents:await fs.readFile(args.path,'utf8'),loader:'js'}));
}};
const bundle=await build({entryPoints:['review-entry'],plugins:[virtualFiles],bundle:true,write:false,format:'esm',target:['es2022'],minify:true,charset:'utf8',define:{__GARDEN_SOLO__:'false',__GARDEN_UNLOCKED__:'false'}});
const html=(await fs.readFile(path.join(dir,'template.html'),'utf8')).replace('/*__DATA__*/',()=>`window.PASS20_DATA=${JSON.stringify({notes,images})};`).replace('/*__SCRIPT__*/',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(path.join(dir,'index.html'),html.trimEnd()+'\n');
console.log(path.join(dir,'index.html')+' · '+Buffer.byteLength(html)+' bytes');
