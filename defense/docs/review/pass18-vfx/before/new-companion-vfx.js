// Small authored shapes follow the actual hit geometry. No full-screen flashes or borrowed character emblems.
const butterfly=(ctx,size,color)=>{
  ctx.fillStyle=color;ctx.strokeStyle='#372750';ctx.lineWidth=1.3;
  for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*size*.5,-size*.95,side*size,-size*.65,side*size*.67,-size*.12);ctx.bezierCurveTo(side*size*.95,size*.75,side*size*.22,size*.7,0,0);ctx.fill();ctx.stroke();}
  ctx.strokeStyle='#fff2c5';ctx.beginPath();ctx.moveTo(0,-size*.32);ctx.lineTo(0,size*.4);ctx.stroke();
};
export function drawNewShot(fx,shot,s,{x,y,angle,t}){
  if(!['demon_king','miracle_larva'].includes(shot.hero))return false;
  const ctx=fx.ctx;ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  if(shot.hero==='demon_king'){
    ctx.fillStyle='#40225b';ctx.strokeStyle='#d1a3fb';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-22,-5);ctx.lineTo(-17,0);ctx.lineTo(-22,5);ctx.closePath();ctx.fill();ctx.stroke();
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-12,i*5);ctx.quadraticCurveTo(-20,i*8,-28,i*7);ctx.stroke();}
  }else if(shot.form==='miracle_cocoon'){
    ctx.strokeStyle='#e9dcff';ctx.lineWidth=2;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,8+i*5,3+i*2,t*Math.PI,0,Math.PI*2);ctx.stroke();}
  }else if(shot.form==='miracle_wing'||shot.form==='abyss_wing')butterfly(ctx,10,shot.form==='abyss_wing'?'#b279e0':'#e7d690');
  else{
    ctx.fillStyle='#d8e897';ctx.strokeStyle='#527a53';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(12,0);ctx.quadraticCurveTo(-1,-12,-11,0);ctx.quadraticCurveTo(-1,12,12,0);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.stroke();
  }
  ctx.restore();return true;
}
export function drawNewImpact(fx,e,t){
  const ctx=fx.ctx;
  if(e.type==='deathhandBlast'){
    const fade=Math.sin(Math.PI*t),size=fx.reduced?75:95+Math.min(1,t*3)*30;
    ctx.save();ctx.translate(e.x,e.y-18-(fx.reduced?0:(1-Math.min(1,t*4))*60));ctx.globalAlpha=fade*.9;
    ctx.fillStyle='#2b193be8';ctx.strokeStyle='#bda0df';ctx.lineWidth=2;ctx.lineJoin='round';
    // Wrist, palm and five separate bent fingers read as the source concept's giant black hand.
    ctx.beginPath();ctx.moveTo(-size*.23,size*.54);ctx.lineTo(-size*.34,size*.12);
    for(let i=0;i<4;i++){const x=(-.33+i*.2)*size,h=(i===1?.7:i===2?.66:.54)*size;ctx.lineTo(x,-h*.6);ctx.quadraticCurveTo(x+size*.04,-h,x+size*.1,-h*.6);ctx.lineTo(x+size*.13,-size*.02);}
    ctx.lineTo(size*.48,-size*.06);ctx.quadraticCurveTo(size*.78,-size*.29,size*.71,-size*.04);ctx.lineTo(size*.35,size*.28);ctx.lineTo(size*.24,size*.54);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#cfb0f3';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo((-12+i*12),-3);ctx.lineTo((-15+i*12),24);ctx.stroke();}
    ctx.restore();return true;
  }
  if(e.type==='miracleEclose'){
    const color=e.form==='abyss_wing'?'#ce9aeb':'#fae3a1',open=fx.reduced?1:Math.min(1,t*3);
    ctx.save();ctx.translate(e.x,e.y-38);ctx.globalAlpha=Math.sin(Math.PI*t)*.85;ctx.scale(open,1);butterfly(ctx,38,color);
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,30,34+t*20,12+t*6,0,0,Math.PI*2);ctx.stroke();ctx.restore();return true;
  }
  if(e.type==='impact'&&['demon_king','miracle_larva'].includes(e.hero)){
    ctx.save();ctx.translate(e.x,e.y-18);ctx.globalAlpha=1-t;ctx.strokeStyle=e.hero==='demon_king'?'#c3a0e5':e.form==='abyss_wing'?'#c893e3':'#e4edc7';ctx.lineWidth=2;
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)*(12+t*10),Math.sin(a)*(12+t*10));ctx.stroke();}
    ctx.restore();return true;
  }
  return false;
}
