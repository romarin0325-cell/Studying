const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'../defense');
const artifacts=fs.mkdtempSync(path.join(os.tmpdir(),'defense-resilience-'));
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.setHeader('content-type',({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
    res.end(data);
  });
});
const state=page=>page.evaluate(()=>__heroDefenseV2Debug.getState());
async function run(browser,label,url,mode){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  // Emulate older Safari ignoring dynamic viewport units in source styles.
  await context.route('**/*.css',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace(/[a-z-]+\s*:[^;{}]*dvh[^;{}]*;/g,'')});
  });
  await context.addInitScript(({mode})=>{
    CanvasRenderingContext2D.prototype.roundRect=undefined;
    Object.hasOwn=undefined;
    Array.prototype.at=undefined;
    const original=CanvasRenderingContext2D.prototype.fillText;
    globalThis.__drawnLabels=new Set();
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      __drawnLabels.add(text);return original.call(this,text,...args);
    };
    CanvasRenderingContext2D.prototype.getImageData=function(){throw new Error('Runtime pixel extraction forbidden');};
    const NativeImage=Image, descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    globalThis.__requestedImages=[];
    globalThis.Image=function(...args){
      const image=new NativeImage(...args);
      Object.defineProperty(image,'src',{
        get(){return descriptor.get.call(image);},
        set(value){
          __requestedImages.push(value);
          const block=mode==='failed'||mode==='hanging'||mode==='primary' && /moonlit\/(heroes|companions|creatures)/.test(value);
          if(block){
            if(mode!=='hanging')queueMicrotask(()=>image.onerror?.(new Event('error')));
          }else descriptor.set.call(image,value);
        }
      });
      return image;
    };
  },{mode});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(url);
    await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
    assert.equal(await page.evaluate(()=>__requestedImages.length),1,'menu should decode only terrain');
    await page.locator('[data-action="formation"]').click();
    await page.waitForTimeout(100);
    if(mode==='primary'){
      await page.waitForFunction(()=>__requestedImages.some(p=>p.includes('/portraits/rumi.webp')));
      // Loaded fallback must actually be drawn, not merely requested.
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-portrait]')].every(c=>c.dataset.portraitSource==='legacy'));
    }
    await page.locator('[data-action="ready"]').click();
    await page.locator('[data-action="auto-place"]').click();
    const placed=(await state(page)).battle.snapshot.heroes;
    assert.ok(placed.every(h=>h.placed));
    await page.locator('[data-action="start-wave"]').click();
    await page.waitForFunction(()=>__heroDefenseV2Debug.getState().battle.snapshot.enemies.length>1);
    const before=(await state(page)).battle.snapshot;
    await page.waitForTimeout(400);
    const after=(await state(page)).battle.snapshot;
    assert.ok(after.heroes.some((h,i)=>h.skillTimer!==before.heroes[i].skillTimer),'animation loop stopped');
    if(mode!=='healthy'){
      const labels=await page.evaluate(()=>[...__drawnLabels]);
      for(const text of ['✦','→','유'])assert.ok(labels.includes(text),'missing fallback body/prop '+text);
    }
    if(mode==='hanging')await page.waitForFunction(()=>__heroDefenseV2Debug.getState().mediaFailures.length>=4,{},{timeout:15000});
    if(mode==='failed'||mode==='primary')assert.ok((await state(page)).mediaFailures.length>0);
    await page.screenshot({path:path.join(artifacts,label+'-'+mode+'.png')});
    // A placed-hero checkpoint must survive reload with roundRect still absent.
    await page.reload();
    await page.locator('[data-action="continue"]').click();
    assert.ok((await state(page)).battle.snapshot.heroes.every(h=>h.placed));
    await page.waitForTimeout(200);
    assert.deepEqual(errors,[]);
    console.log(label+' '+mode+': missing APIs, placement/continue and fallback rendering passed');
  }finally{await context.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
      const browser=await type.launch({headless:true});
      try{
        const url='http://127.0.0.1:'+server.address().port+'/';
        for(const mode of ['healthy','primary','failed','hanging'])await run(browser,name,url,mode);
        await run(browser,name+'-offline',pathToFileURL(path.join(root,'dist-local/HeroCoreDefense.html')).href,'healthy');
      }finally{await browser.close();}
    }
    console.log('Resilience screenshots: '+artifacts);
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
