import sharp from 'sharp';

export async function alphaBounds(bytes){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('Empty art frame');return {left,top,width:right-left+1,height:bottom-top+1};
}

// Keep the main illustrated object and nearby intentional fragments. Components
// cut by a neighboring cell are rejected; RGB/white are never transparency keys.
export async function cleanFrame(bytes){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info;
  const labels=new Int32Array(w*h),queue=new Int32Array(w*h),parts=[];let label=0;
  for(let start=0;start<w*h;start++){
    if(labels[start]||data[start*4+3]<24)continue;
    label++;let n=0,end=1,left=w,top=h,right=0,bottom=0;queue[0]=start;labels[start]=label;
    while(n<end){const at=queue[n++],x=at%w,y=Math.floor(at/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){const next=yy*w+xx;if(!labels[next]&&data[next*4+3]>=24){labels[next]=label;queue[end++]=next;}}
    }
    parts.push({label,area:end,left,top,right,bottom});
  }
  parts.sort((a,b)=>b.area-a.area);const main=parts[0];if(!main)throw new Error('Empty illustration');
  const keep=new Set([main.label]);
  for(const part of parts.slice(1)){
    const gap=Math.hypot(Math.max(0,main.left-part.right,part.left-main.right),Math.max(0,main.top-part.bottom,part.top-main.bottom));
    const cut=part.left<3||part.top<3||part.right>w-4||part.bottom>h-4;
    if(!cut&&part.area>=8&&gap<=18)keep.add(part.label);
  }
  let removed=0;for(let i=0;i<labels.length;i++)if(!keep.has(labels[i])){if(data[i*4+3]>80)removed++;data[i*4+3]=0;}
  return {bytes:await sharp(data,{raw:info}).png().toBuffer(),removed};
}

export async function anatomicalFrame(bytes,{chin,skullTop,rootX,foot,targetHead,targetBody,cell,baseline}){
  const m=await sharp(bytes).metadata(),headScale=targetHead/(chin-skullTop),bodyScale=targetBody/(foot-chin);
  if(headScale<=0||bodyScale<=0)throw new Error('Invalid anatomical landmarks');
  const neck=Math.round(chin),targetNeck=Math.round(baseline-targetBody),width=Math.round(m.width*headScale);
  const topHeight=Math.max(1,Math.round(neck*headScale)),bodyHeight=Math.max(1,Math.round((m.height-neck)*bodyScale));
  const left=Math.round(cell/2-rootX*headScale),top=targetNeck-topHeight;
  const upper=await sharp(bytes).extract({left:0,top:0,width:m.width,height:neck}).resize(width,topHeight).png().toBuffer();
  const lower=await sharp(bytes).extract({left:0,top:neck,width:m.width,height:m.height-neck}).resize(width,bodyHeight).png().toBuffer();
  // Crop transparent canvas outside the cell, then fail if any actual art would
  // be clipped. Extents are a safety check; they never determine the body scale.
  const layers=[];
  for(const [input,y] of [[upper,top],[lower,targetNeck]]){
    const meta=await sharp(input).metadata(),bounds=await alphaBounds(input);
    if(left+bounds.left<3||left+bounds.left+bounds.width>cell-3||y+bounds.top<3||y+bounds.top+bounds.height>cell-3)throw new Error(`Anatomical art overflow: x=${left+bounds.left} y=${y+bounds.top} width=${bounds.width} height=${bounds.height}`);
    const trim={left:Math.max(0,-left),top:Math.max(0,-y),width:Math.min(meta.width,cell-left)-Math.max(0,-left),height:Math.min(meta.height,cell-y)-Math.max(0,-y)};
    if(trim.width>0&&trim.height>0)layers.push({input:await sharp(input).extract(trim).png().toBuffer(),left:Math.max(0,left),top:Math.max(0,y)});
  }
  return {bytes:await sharp({create:{width:cell,height:cell,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer(),headScale,bodyScale,chin:targetNeck,skullTop:targetNeck-targetHead,root:[cell/2,baseline]};
}

export async function walkLandmarks(bytes,sample){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await alphaBounds(bytes);
  const nominalX=sample.rootX,chinHint=sample.chin;
  // The neck band isolates the torso from hair, weapons and outward arms. The
  // front sample is manually measured; this pixel-derived root is reviewable.
  const y=Math.max(0,Math.min(info.height-1,Math.round(chinHint+8))),runs=[];let start=-1;
  for(let x=0;x<=info.width;x++){const filled=x<info.width&&data[(y*info.width+x)*4+3]>100;if(filled&&start<0)start=x;if(!filled&&start>=0){runs.push({left:start,right:x-1});start=-1;}}
  runs.sort((a,c)=>Math.abs((a.left+a.right)/2-nominalX)-Math.abs((c.left+c.right)/2-nominalX));
  const rootX=runs[0]?(runs[0].left+runs[0].right)/2:nominalX;
  let foot=0;for(let yy=Math.round(b.top+b.height*.78);yy<info.height;yy++)for(let xx=Math.max(0,Math.floor(rootX-48));xx<Math.min(info.width,Math.ceil(rootX+48));xx++)if(data[(yy*info.width+xx)*4+3]>100)foot=yy;
  if(!foot)throw new Error('No sole pixels in the reviewed foot band');
  const shift=foot-sample.foot;return {...sample,rootX,foot,chin:sample.chin+shift,skullTop:sample.skullTop+shift};
}
