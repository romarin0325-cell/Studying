// Build the portable pass 18 before/after effect viewer (docs/review/pass18-vfx/index.html). Uses the optimized runtime
// textures the release embeds, plus the retired zeke-slash for the "before" column.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {ASSET_PATHS} from '../src/content.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
const dir=path.join(gameRoot,'docs/review/pass18-vfx'),images={};
const manifest=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8'));
const optimized=new Map(manifest.images.filter(i=>i.output).map(i=>[i.source,i.output.path]));
const ids=['unit-zeke','unit-demon_king','unit-miracle_larva','unit-miracle_cocoon','unit-miracle_wing','unit-abyss_wing','unit-siren','unit-queen',
  'garden','realms-expansion','creatures','bosses','bosses-expansion','effects','effects-expansion','effects-trio','ultimates','ultimates-extra-a','ultimates-extra-b','finishers','fx-emblems',
  'zeke-cone','zeke-slash','zeke-spin','effects-demon-miracle','effects-deathhand','effects-eclose','ancient-cross'];
const notes={
  zeke:{attack:'괴력형(가디언·베히모스)과 같은 자기 중심 원형으로 바꿨다. 화염검 한 바퀴: 흰 불꽃의 칼끝이 대상 뒤에서 돌아 명중 순간 대상을 지나고, 휩쓴 자리만 불꽃 고리가 드러난 뒤 부서져 불씨로 남는다. 불꽃 바깥 가장자리가 실제 판정 반경 250이다. 기존 부채꼴 베기와 같은 그림체(흰 심지, 주황-적색 가장자리).',skill:''},
  demon_king:{attack:'흑염 관통: 어두운 보랏빛 몸통을 가진 검은 불꽃 창이 관통선 전체를 달리고, 실제 관통 폭만큼의 검은 불꽃 자국이 남는다. 검은 몸통을 미리 구워 넣어 밤·Bright 어느 바닥에서도 어둠으로 읽힌다. 명중 시 검은 불꽃이 솟는다.',skill:'데스핸드: 전장이 어두워지고 땅에 다섯 손톱 인장이 열린다. 하늘에서 거대한 암흑의 손이 떨어지며 대상마다 디버프 종류 수만큼 보랏빛 룬이 켜지고, 0.28초에 손이 움켜쥐며 화면이 흔들린다. 대상마다 검은 불꽃이 솟고, 디버프가 많을수록 크다. 실제 반경 180에 고리가 울린다.'},
  miracle_larva:{attack:'수정 잎 다트(흔들리며 비행) → 실제 반경 64의 초록 고리와 흩어지는 작은 잎.',skill:'기적의우화: 라바·코쿤마다 고치가 감싸 떨다가 0.32초에 갈라지고, 나온 형태의 빛(금빛/보랏빛)이 터진 뒤 그 형태의 대형 나비 문장이 떠오른다. 형태 이름이 함께 뜬다.'},
  miracle_cocoon:{attack:'원형 공격이 원형으로 보이게: 비단실 고리가 코쿤에서 실제 반경 230까지 퍼지고 진주빛이 고리를 따라 돈다. 날아가는 투사체는 없앴다.',skill:'코쿤에서의 우화. 라바와 같은 연출.'},
  miracle_wing:{attack:'최종 형태(UR 예산)답게: 금빛 프리즘 나비가 날갯짓하며 날아가고, 명중 시 무지개 굴절 섬광과 실제 반경 72의 세 겹 파스텔 고리.',skill:''},
  abyss_wing:{attack:'보랏빛 독나비(붉은 눈무늬)가 날갯짓하며 날아가고, 명중 시 실제 반경 72에 검보랏빛 독안개가 피어난다. 어두운 몸통을 구워 넣었다.',skill:''},
};
for(const id of ids){const source=ASSET_PATHS[id];if(!source)throw Error('Unknown texture '+id);const file=assetFile(optimized.get(source)||source);images[id]='data:image/webp;base64,'+(await fs.readFile(file)).toString('base64');}
images['bright-garden']='data:image/webp;base64,'+(await fs.readFile(assetFile(optimized.get('./assets/bright/garden.webp')||'./assets/bright/garden.webp'))).toString('base64');
const bundle=await build({entryPoints:[path.join(dir,'review.js')],bundle:true,write:false,format:'esm',target:['es2022'],minify:true,charset:'utf8',define:{__GARDEN_SOLO__:'false',__GARDEN_UNLOCKED__:'false'}});
const html=(await fs.readFile(path.join(dir,'template.html'),'utf8')).replace('/*__DATA__*/',()=>`window.PASS18_DATA=${JSON.stringify({notes,images})};`).replace('/*__SCRIPT__*/',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(path.join(dir,'index.html'),html.trimEnd()+'\n');
console.log(path.join(dir,'index.html')+' · '+Buffer.byteLength(html)+' bytes');
