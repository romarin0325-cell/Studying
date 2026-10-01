import sharp from 'sharp';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HEROES,TRANSFORM_ART} from '../defense/merge/content.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.argv[2];
if(!out)throw new Error('Usage: node scripts/export_defense_directions.mjs OUTPUT_DIRECTORY');
await mkdir(out,{recursive:true});
const unitDir=path.join(root,'defense/assets/merge/units');
const manifest=JSON.parse(await readFile(path.join(unitDir,'manifest.json'),'utf8'));
const forms=[...HEROES,{id:'trauma',name:'트라우마',color:'#f092cc',art:TRANSFORM_ART.trauma}];
const data=[],labels=['하 · 정면','상 · 후면','좌측','우측'];
const proof=[];
for(let n=0;n<forms.length;n++){
  const h=forms[n],m=manifest.frames.find(x=>x.id===h.id),file=path.join(unitDir,m.file),bytes=await readFile(file),folder=path.join(out,'characters',h.id);
  await mkdir(folder,{recursive:true});await copyFile(file,path.join(folder,'atlas.webp'));
  const frames=[];
  for(let i=0;i<4;i++){
    const frame=await sharp(bytes).extract({left:i%2*512,top:Math.floor(i/2)*512,width:512,height:512}).png().toBuffer();
    await writeFile(path.join(folder,`${m.directions[i]}.png`),frame);frames.push(frame);
  }
  data.push({id:h.id,name:h.name,color:h.color,portrait:m.portrait,anatomy:m.anatomy,src:`data:image/webp;base64,${bytes.toString('base64')}`});
  const x=n%3*400,y=Math.floor(n/3)*180;
  proof.push({input:Buffer.from(`<svg width="400" height="28"><text x="12" y="21" font-family="Malgun Gothic,Arial" font-size="16" fill="#eee5ce">${h.name}</text></svg>`),left:x,top:y});
  for(let i=0;i<4;i++)proof.push({input:await sharp(frames[i]).resize(96,96).png().toBuffer(),left:x+i*96+8,top:y+32});
  proof.push({input:Buffer.from(`<svg width="400" height="25">${labels.map((l,i)=>`<text x="${i*96+56}" y="18" text-anchor="middle" font-family="Malgun Gothic,Arial" font-size="11" fill="#adc5c8">${l}</text>`).join('')}</svg>`),left:x,top:y+134});
}
await sharp({create:{width:1200,height:Math.ceil(forms.length/3)*180,channels:4,background:'#203944'}}).composite(proof).png().toFile(path.join(out,'all-characters-4-directions.png'));
await copyFile(path.join(unitDir,'manifest.json'),path.join(out,'manifest.json'));
const template=await readFile(path.join(root,'defense/merge/direction-gallery.template.html'),'utf8');
await writeFile(path.join(out,'direction-gallery.html'),template.replace('/*__DIRECTION_DATA__*/',JSON.stringify(data)));
await writeFile(path.join(out,'README.md'),'# ASTRA 네 방향 SD 에셋\n\n현재 원정 동료와 변신형 전체의 독립 PNG와 WebP 아틀라스입니다. 정확한 수는 manifest.json을 확인하세요.\n\n`direction-gallery.html`은 인터넷 없이 열립니다. 캐릭터 선택, 방향 비교, 밝은 배경, 25칸 배치, 공격 방향 미리보기를 지원합니다.\n\n각 PNG는 512×512이고 공통 발 기준점은 (256,480)입니다. 투명 여백을 포함한 규격이므로 몸을 자동 맞춤 확대하지 마세요. 아틀라스 순서는 좌상단 하/정면, 우상단 상/후면, 좌하단 좌측, 우하단 우측입니다. 각 방향은 같은 대기 자세이며 연속 공격 애니메이션 프레임이 아닙니다.\n\n정면 두개부의 수동 추정 좌표를 기준으로 배율을 교정했습니다. 귀·모자·뿔·헤어스타일의 부피를 제외하며, 가려진 정수리와 턱은 추정이므로 비교표에서 확인해야 합니다. 전투에서는 방향 선택에 작은 반동과 별도 투사체를 결합합니다. 이 갤러리는 에셋 검수용이며 완성 게임의 플레이 평가를 대신하지 않습니다.\n');
console.log(`Exported ${forms.length*4} PNGs, ${forms.length} atlases, contact sheet and offline gallery to ${out}`);
