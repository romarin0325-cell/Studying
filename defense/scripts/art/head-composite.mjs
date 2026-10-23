// Pastes the ORIGINAL head (face, skin, hair, horns) of every view back onto an edited body sheet, so an AI body edit
// can never change the character's face. Both sheets must be the same 2x2 layout and size.
//   node defense/scripts/art/head-composite.mjs <original.jpg> <edited.jpg> <out.png> [neckRatio per view, e.g. .56,.56,0,0] [feather px per view, e.g. 28,28,1,1]
// Per view: the edited sheet is aligned to the original by the head zone (search +-24 px), then original character pixels
// above the neck line replace the edit (feathered); below it, and wherever the original is background, the edit stays.
// neckRatio is the neck line as a share of the silhouette height. A ratio of 0 keeps the edited head for that view
// (use it for side views where the mane overlaps the shoulder and a cut across the hair would show a seam).
import sharp from 'sharp';
const [origF,editF,out,ratioArg='.56',featherArg='28']=process.argv.slice(2),RATIOS=ratioArg.split(',').map(Number),FEATHERS=featherArg.split(',').map(Number);
const load=async f=>{const {data,info}=await sharp(f).removeAlpha().raw().toBuffer({resolveWithObject:true});return {d:data,w:info.width,h:info.height};};
const O=await load(origF),E0=await load(editF);
if(O.w!==E0.w||O.h!==E0.h)throw new Error('size mismatch');
const W=O.w,H=O.h,C=W/2,isBg=(d,i)=>d[i]>180&&d[i+2]>180&&d[i+1]<90;
const out_=Buffer.from(E0.d);
for(let v=0;v<4;v++){
  const ox=(v%2)*C,oy=Math.floor(v/2)*C;
  // Original silhouette bounds in this cell.
  let top=C,bottom=0;for(let y=0;y<C;y++)for(let x=0;x<C;x++){const i=((oy+y)*W+ox+x)*3;if(!isBg(O.d,i)){if(y<top)top=y;if(y>bottom)bottom=y;}}
  const RATIO=RATIOS[v]??RATIOS[0],F=FEATHERS[v]??FEATHERS[0],neck=Math.round(top+(bottom-top)*RATIO);
  // Alignment search on the head zone, 2px grid, +-24 px.
  let best={dx:0,dy:0,s:Infinity};
  for(let dy=-24;dy<=24;dy+=2)for(let dx=-24;dx<=24;dx+=2){let s=0,n=0;
    for(let y=top;y<neck;y+=3)for(let x=0;x<C;x+=3){const xo=x,yo=y,xe=x+dx,ye=y+dy;if(xe<0||ye<0||xe>=C||ye>=C)continue;
      const io=((oy+yo)*W+ox+xo)*3,ie=((oy+ye)*W+ox+xe)*3;const bo=isBg(O.d,io),be=isBg(E0.d,ie);if(bo&&be)continue;
      s+=bo!==be?255:(Math.abs(O.d[io]-E0.d[ie])+Math.abs(O.d[io+1]-E0.d[ie+1])+Math.abs(O.d[io+2]-E0.d[ie+2]))/3;n++;}
    s/=Math.max(1,n);if(s<best.s)best={dx,dy,s};}
  // Write: shift the edit by (dx,dy) so its head sits where the original head is, then paste the original head.
  for(let y=0;y<C;y++)for(let x=0;x<C;x++){
    const xe=x+best.dx,ye=y+best.dy,io=((oy+y)*W+ox+x)*3,ie=((oy+ye)*W+ox+xe)*3;
    let r=255,g=0,b=255;if(xe>=0&&ye>=0&&xe<C&&ye<C){r=E0.d[ie];g=E0.d[ie+1];b=E0.d[ie+2];}
    const w=Math.max(0,Math.min(1,(neck-y)/F+.5));
    if(w>0&&!isBg(O.d,io)){r=Math.round(O.d[io]*w+r*(1-w));g=Math.round(O.d[io+1]*w+g*(1-w));b=Math.round(O.d[io+2]*w+b*(1-w));}
    out_[io]=r;out_[io+1]=g;out_[io+2]=b;}
  console.log('view',v,'top',top,'neck',neck,'bottom',bottom,'align',best.dx,best.dy,'sad',best.s.toFixed(1));
}
await sharp(out_,{raw:{width:W,height:H,channels:3}}).png().toFile(out);console.log(out);
