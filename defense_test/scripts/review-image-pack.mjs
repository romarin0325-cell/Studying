import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gameRoot} from './local-inputs.mjs';

export async function writeImageReview(manifest){
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=p=>'../'+p.replace(/^\.\//,'');
  const cards=manifest.images.filter(i=>i.output).map(i=>`<article data-profile="${i.profile}" class="${i.profile==='unit'?'unit':''}"><h2>${escape(i.id)}</h2><div class="pair">${[[i.source,i.original,'압축 전 보관본'],[i.output.path,i.output,'배포 압축본']].map(([p,m,label])=>`<figure><figcaption>${label} · ${(m.bytes/1024).toFixed(1)} KiB · ${m.metadata.width}×${m.metadata.height}</figcaption><a class="image" href="${url(p)}" target="_blank"><img loading="lazy" decoding="async" src="${url(p)}" alt="${escape(i.id+' '+label)}"></a><a class="path" href="${url(p)}">${escape(p)}</a></figure>`).join('')}</div><p>${i.uses.map(escape).join('<br>')}</p></article>`).join('\n');
  const profiles=[...new Set(manifest.images.filter(i=>i.output).map(i=>i.profile))];
  const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>별빛 정원 이미지 압축 비교</title>
<style>body{font:15px/1.5 system-ui;margin:0;background:#101b30;color:#eaf1ff}header{position:sticky;top:0;background:#16243af2;padding:14px 20px;z-index:1}h1{font-size:20px;margin:0 0 8px}select,label{margin-right:16px}main{max-width:1000px;margin:auto;padding:16px}article{padding:18px 0;border-bottom:1px solid #58708b}h2{font-size:17px;margin:0 0 10px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{margin-bottom:8px}.image{height:280px;display:flex;align-items:center;justify-content:center;background:#314b63;border-radius:8px;overflow:hidden}img{max-width:100%;max-height:100%;object-fit:contain}.path{display:block;overflow-wrap:anywhere;color:#acd4ff;margin-top:8px}p{overflow-wrap:anywhere;color:#bdd0e4;font-size:12px}.light .image{background:#e5dfd1}.front .unit .image{width:128px;height:128px;display:block}.front .unit img{width:256px;height:256px;max-width:none;max-height:none}article[hidden]{display:none}@media(max-width:500px){main{padding:10px}.image{height:220px}header{padding:10px}}</style>
<header><h1>별빛 정원 · 압축 전 / 배포 이미지</h1><select aria-label="이미지 종류"><option value="">전체</option>${profiles.map(p=>`<option>${p}</option>`).join('')}</select><label><input id="light" type="checkbox">밝은 바닥</label><label><input id="front" type="checkbox">동료 정면 128px</label><div>그림을 누르면 저장된 파일을 엽니다. 화질은 사용자 검토 대상입니다. 제작 원본 PNG가 아닌 이번 압축 전 Git 보관본과 비교합니다.</div></header><main>${cards}</main>
<script>document.querySelector('select').onchange=e=>{for(const a of document.querySelectorAll('article'))a.hidden=!!e.target.value&&a.dataset.profile!==e.target.value};for(const id of ['light','front'])document.getElementById(id).onchange=e=>document.body.classList.toggle(id,e.target.checked);</script></html>`;
  await fs.writeFile(path.join(gameRoot,'docs/asset-optimization-review.html'),html);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await writeImageReview(JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8')));
}
