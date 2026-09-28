// Logical-space paths, shared by selection and the actual hit snapshot.
// Decorative sweeps stay INSIDE these boundaries and never imply extra reach.
export function traceAttackShape(ctx,g){
  ctx.beginPath();
  if(g.kind==='cleave'){
    ctx.moveTo(g.from.x,g.from.y);
    ctx.arc(g.from.x,g.from.y,g.range,g.angle-Math.PI/4,g.angle+Math.PI/4);ctx.closePath();
  }else if(g.kind==='beam'){
    const c=Math.cos(g.angle),s=Math.sin(g.angle),w=g.radius/2;
    for(const [i,[x,y]] of [[0,-w],[g.range,-w],[g.range,w],[0,w]].entries()){
      const px=g.from.x+x*c-y*s,py=g.from.y+x*s+y*c;i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }ctx.closePath();
  }else if(g.kind==='cross'){
    const r=g.range,w=g.radius/2,end=Math.sqrt(r*r-w*w),a=Math.asin(w/r),{x,y}=g.from;
    ctx.moveTo(x+w,y-end);ctx.lineTo(x+w,y-w);ctx.lineTo(x+end,y-w);
    ctx.arc(x,y,r,-a,a);ctx.lineTo(x+w,y+w);ctx.lineTo(x+w,y+end);
    ctx.arc(x,y,r,Math.PI/2-a,Math.PI/2+a);ctx.lineTo(x-w,y+w);ctx.lineTo(x-end,y+w);
    ctx.arc(x,y,r,Math.PI-a,Math.PI+a);ctx.lineTo(x-w,y-w);ctx.lineTo(x-w,y-end);
    ctx.arc(x,y,r,Math.PI*1.5-a,Math.PI*1.5+a);ctx.closePath();
  }else{
    const p=g.kind==='pulse'?g.from:g.to,r=g.kind==='pulse'?g.range:g.radius;
    if(r>0)ctx.arc(p.x,p.y,r,0,Math.PI*2);
  }
}

export function shapeColor(hero){return hero.id==='mushroom_king'?'#b8dd83':hero.color;}

// A dark keyline survives pale tiles; the bright core survives the dark path.
// Alpha is applied to narrow strokes, never a screen-sized additive wash.
export function outline(ctx,g,color,alpha,width=2.8,fill=.025){
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';traceAttackShape(ctx,g);
  if(fill){ctx.globalAlpha=fill;ctx.fillStyle=color;ctx.fill();}
  ctx.globalAlpha=alpha*.8;ctx.lineWidth=width+3;ctx.strokeStyle='#102935';ctx.stroke();
  ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();ctx.restore();
}

export function drawHitShape(ctx,g,hero,progress,{reduced=false,load=1}={}){
  if(progress<0||progress>=1)return;
  const color=shapeColor(hero),fade=Math.min(1,(1-progress)*2.4),strength=fade*load;
  outline(ctx,g,color,.82*strength,2.8,.035*strength);
  // Keep the boundary readable for the whole tail; only the inner flourish moves.
  if(reduced)return;
  ctx.save();traceAttackShape(ctx,g);ctx.clip();ctx.globalAlpha=strength*.86;
  ctx.strokeStyle='#fff1d3';ctx.lineCap='round';ctx.lineWidth=2;
  if(g.kind==='cleave'){
    const start=g.angle-Math.PI/4,finish=start+Math.PI/2;
    const sweep=start+Math.PI/2*Math.min(1,progress*3.8);
    const outer=Math.min(g.range-6,Math.max(g.range*.58,Math.hypot(g.to.x-g.from.x,g.to.y-g.from.y)*.85)),inner=outer*.7;
    const gradient=ctx.createRadialGradient(g.from.x,g.from.y,inner,g.from.x,g.from.y,outer);
    gradient.addColorStop(0,'#ffb25700');gradient.addColorStop(.75,'#ffad5844');gradient.addColorStop(1,'#ffefd5');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(g.from.x,g.from.y,outer,Math.max(start,sweep-.55),sweep);
    ctx.arc(g.from.x,g.from.y,inner,sweep,Math.max(start,sweep-.55),true);ctx.closePath();ctx.fill();
    // Two fixed sides and the outer arc read as a fan, even in a still frame.
    ctx.globalAlpha=strength*.52;ctx.beginPath();ctx.arc(g.from.x,g.from.y,g.range-5,start,finish);ctx.stroke();
    ctx.globalAlpha=strength*.38;ctx.strokeStyle=color;ctx.lineWidth=2.2;
    ctx.beginPath();ctx.arc(g.from.x,g.from.y,g.range*.56,start,finish);ctx.stroke();
  }else if(g.kind==='beam'||g.kind==='cross'){
    const angles=g.kind==='cross'?[0,Math.PI/2,Math.PI,Math.PI*1.5]:[g.angle];
    for(const angle of angles){
      ctx.save();ctx.translate(g.from.x,g.from.y);ctx.rotate(angle);
      const r=g.range,w=g.radius*.25,tip=Math.min(r-4,r*(.18+progress*2.7));
      const gradient=ctx.createLinearGradient(Math.max(0,tip-100),0,tip,0);
      gradient.addColorStop(0,color+'00');gradient.addColorStop(.85,color);gradient.addColorStop(1,'#fff6db');
      ctx.strokeStyle=gradient;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(Math.max(0,tip-120),0);ctx.lineTo(tip,0);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.globalAlpha=strength*.65;
      for(let d=80;d<r;d+=100){ctx.beginPath();ctx.moveTo(d-9,-w);ctx.lineTo(d,0);ctx.lineTo(d-9,w);ctx.stroke();}
      ctx.restore();
    }
  }else{
    const p=g.kind==='pulse'?g.from:g.to,r=g.kind==='pulse'?g.range:g.radius;
    const wave=r*Math.min(.96,.25+progress*2.2);
    ctx.globalAlpha=strength*.7;ctx.lineWidth=3.5;ctx.strokeStyle=color;
    ctx.beginPath();ctx.arc(p.x,p.y,wave,0,Math.PI*2);ctx.stroke();
    // Small radial accents read as an impact; persistent fields use spores below.
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+g.angle,near=r*.72,far=r*.9;
      ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*near,p.y+Math.sin(a)*near);ctx.lineTo(p.x+Math.cos(a)*far,p.y+Math.sin(a)*far);ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawZoneShape(ctx,z,hero,clock,reduced,load){
  const g={kind:'zone',to:{x:z.x,y:z.y},radius:z.radius},color=shapeColor(hero);
  const fade=Math.min(1,z.life*3),tick=reduced?0:Math.max(0,1-(.5-z.tick)*5);
  outline(ctx,g,color,(.64+tick*.22)*fade*load,2.7,.025*fade*load);
  ctx.save();ctx.translate(z.x,z.y);ctx.globalAlpha=fade*load*.76;
  // Persistent fields are recognized by a complete rim and six inward markers.
  // Decorations orbit slowly; the collision boundary never pulses in size.
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+(reduced?0:clock*.18),r=z.radius-7;
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=2;
    if(hero.id==='mushroom_king'){
      ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,2.5+tick,0,Math.PI*2);ctx.fill();
    }else{
      ctx.beginPath();ctx.moveTo(Math.cos(a)*(r-5),Math.sin(a)*(r-5));ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.stroke();
    }
  }
  if(hero.id==='mushroom_king'&&!reduced){
    for(let i=0;i<3;i++){const p=(clock*.55+i/3)%1,a=i*2.4,r=z.radius*.45;ctx.globalAlpha=(1-p)*fade*load*.4;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r-p*12,2,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
