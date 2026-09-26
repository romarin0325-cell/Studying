import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { HERO_IDS } from '../../js/content/assets.js';
import { illustration } from '../../js/render/Illustrations.js';

test('every paired pose has real alpha, isolated square frames and a shared foot baseline', async () => {
  const images={};
  for(const name of ['heroes','queen','galaxy-whale','silver-rabbit','ancient-dragon','time-ruler','companions','companions-ember','companions-tide']) {
    const file=new URL('../../assets/moonlit/'+name+'.webp',import.meta.url);
    const image=await sharp(fileURLToPath(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    images['illustration/'+name]={width:image.info.width,height:image.info.height,...image};
  }
  for(const id of HERO_IDS) {
    const bounds=[];
    for(const attacking of [false,true]) {
      const art=illustration({getImage:key=>images[key]},id,attacking), {image,frame}=art;
      const sx=Math.round(frame.x*image.width),sy=Math.round(frame.y*image.height);
      assert.equal(Math.round(frame.width*image.width),512,id);
      assert.equal(Math.round(frame.height*image.height),512,id);
      let left=512,right=0,top=512,bottom=0,count=0;
      for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
        if(image.data[((sy+y)*image.width+sx+x)*4+3]<32) continue;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;
      }
      assert.ok(count>10000,id+' empty frame');
      assert.ok(left>=8&&right<=503&&top>8&&bottom<500,id+' neighboring sprite or clipped silhouette');
      bounds.push({top,bottom,height:bottom-top});
    }
    assert.ok(Math.abs(bounds[0].bottom-bounds[1].bottom)<=2,id+' feet jump between poses');
    if(id==='zeke') assert.ok(Math.abs(bounds[0].height/bounds[1].height-1)<.05,'Zeke attack body height changes by more than 5%');
  }
});
