import sharp from 'sharp';

export async function alphaBounds(bytes){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('Empty art frame');return {left,top,width:right-left+1,height:bottom-top+1};
}

// Keep the main illustrated object and nearby intentional fragments. Components
// cut by a neighboring cell are rejected; RGB/white are never transparency keys.
export async function cleanFrame(bytes,{minArea=8,maxGap=18,keepSecondary=true}={}){
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
  for(const part of keepSecondary?parts.slice(1):[]){
    const gap=Math.hypot(Math.max(0,main.left-part.right,part.left-main.right),Math.max(0,main.top-part.bottom,part.top-main.bottom));
    const cut=part.left<3||part.top<3||part.right>w-4||part.bottom>h-4;
    if(!cut&&part.area>=minArea&&gap<=maxGap)keep.add(part.label);
  }
  let removed=0;for(let i=0;i<labels.length;i++)if(!keep.has(labels[i])){if(data[i*4+3]>80)removed++;data[i*4+3]=0;}
  return {bytes:await sharp(data,{raw:info}).png().toBuffer(),removed};
}

// A coherent newly painted figure is one image. Packing may change its overall
// scale and position, but never its internal head/torso/leg proportions.
export async function wholeFrame(bytes,{scale,rootX,foot,cell,baseline,headHeight,chin}){
  if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(rootX)||!Number.isFinite(foot))throw new Error('Invalid whole-figure landmarks');
  const source=await sharp(bytes).metadata(),width=Math.max(1,Math.round(source.width*scale));
  // One dimension fixes the aspect ratio; no independent vertical transform.
  const input=await sharp(bytes).resize({width}).png().toBuffer(),meta=await sharp(input).metadata(),height=meta.height,bounds=await alphaBounds(input);
  scale=width/source.width;
  const left=Math.round(cell/2-rootX*scale),top=Math.round(baseline-foot*scale);
  if(left+bounds.left<3||left+bounds.left+bounds.width>cell-3||top+bounds.top<3||top+bounds.top+bounds.height>cell-3)throw new Error('Whole figure would clip; correct source art or landmarks instead of squeezing its body');
  const trim={left:Math.max(0,-left),top:Math.max(0,-top),width:Math.min(width,cell-left)-Math.max(0,-left),height:Math.min(height,cell-top)-Math.max(0,-top)};
  const placed=await sharp(input).extract(trim).png().toBuffer();
  return {bytes:await sharp({create:{width:cell,height:cell,channels:4,background:'#00000000'}}).composite([{input:placed,left:Math.max(0,left),top:Math.max(0,top)}]).png().toBuffer(),headScale:scale,bodyScale:scale,torsoScale:scale,legScale:scale,root:[cell/2,baseline],chin:baseline-(foot-chin)*scale,skullTop:baseline-(foot-chin+headHeight)*scale,method:'whole-figure uniform scale and translation'};
}
