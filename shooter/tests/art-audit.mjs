// Visual QA only: show unchanged source pixels at larger scale, never edit production art.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:700}});
  await page.goto(new URL('dist/AstralBloom.html',root).href);await page.waitForFunction(()=>astralDiagnostics?.ready);
  const png=await page.evaluate(async()=>{
    const im=new Image();im.src=ASTRAL_ASSETS.astea;await im.decode();
    const c=document.createElement('canvas');c.width=1600;c.height=700;const x=c.getContext('2d');x.fillStyle='#15243c';x.fillRect(0,0,1600,700);
    const boxes=[[.27,.455,.15,.13],[.61,.445,.16,.13],[.385,.165,.21,.2]];
    const labels=['옷자락을 잡은 손','펼친 손 — 엄지 1 + 손가락 4','얼굴과 머리 비율'];
    boxes.forEach(([sx,sy,sw,sh],i)=>{x.drawImage(im,sx*im.width,sy*im.height,sw*im.width,sh*im.height,i*530+25,70,480,480*sh*im.height/(sw*im.width));x.fillStyle='#edf3ff';x.font='24px sans-serif';x.fillText(labels[i],i*530+25,35);});
    return c.toDataURL('image/png').split(',')[1];
  });
  await fs.mkdir(new URL('artifacts/',root),{recursive:true});await fs.writeFile(new URL('artifacts/astea-hand-audit.png',root),Buffer.from(png,'base64'));
  console.log(fileURLToPath(new URL('artifacts/astea-hand-audit.png',root)));
}finally{await browser.close();}
