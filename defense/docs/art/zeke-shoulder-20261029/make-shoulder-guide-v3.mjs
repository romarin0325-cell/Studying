import fs from 'node:fs/promises';
import path from 'node:path';
import{createRequire}from'node:module';import{fileURLToPath}from'node:url';const sharp=createRequire(path.resolve(process.env.DEFENSE_ART_PACKAGE_JSON||'package.json'))('sharp');
const D=Math.PI/180,CAM=12*D;
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),unit:a=>{let l=Math.hypot(...a);return a.map(v=>v/(l||1))},cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]};
const types={feminine:{shoulder:82,waist:50,hip:64,limb:10,arm:8,stance:28},neutral:{shoulder:90,waist:62,hip:64,limb:12,arm:9,stance:34},masculine:{shoulder:104,waist:74,hip:70,limb:14,arm:11,stance:44}};
const heights={short:176,medium:188,tall:200};
const yaw=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
const roll=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
const project=p=>[256+p[0],480-p[1]*Math.cos(CAM)+p[2]*Math.sin(CAM),p[1]*Math.sin(CAM)+p[2]*Math.cos(CAM)];
function ik(a,b,l1,l2,bend){let delta=V.sub(b,a),dist=V.len(delta);if(dist>l1+l2+.001)throw Error('IK target exceeds fixed bone lengths');let u=V.unit(delta),d=(l1*l1-l2*l2+dist*dist)/(2*dist),off=Math.sqrt(Math.max(0,l1*l1-d*d)),q=V.unit(V.sub(bend,V.mul(u,V.dot(bend,u))));return V.add(V.add(a,V.mul(u,d)),V.mul(q,off));}
function sphere(mesh,c,r,color,xf=p=>p,tag='body'){
 const N=32,M=20,vertices=[];
 for(let j=0;j<=M;j++){let t=Math.PI*j/M;for(let i=0;i<=N;i++){let f=Math.PI*2*i/N;let n=[Math.sin(t)*Math.cos(f),Math.cos(t),Math.sin(t)*Math.sin(f)];vertices.push(xf(V.add(c,n.map((x,k)=>x*r[k]))));}}
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){let a=j*(N+1)+i,b=a+N+1;for(let idx of [[a,b,a+1],[a+1,b,b+1]])mesh.push({p:idx.map(k=>vertices[k]),color,tag});}
}
function bone(mesh,a,b,r,color){let u=V.unit(V.sub(b,a)),t=V.unit(V.cross(u,Math.abs(u[1])<.9?[0,1,0]:[0,0,1])),q=V.cross(u,t),N=16;for(let i=0;i<N;i++){let f=i/N*Math.PI*2,g=(i+1)/N*Math.PI*2;let x=V.mul(V.add(V.mul(t,Math.cos(f)),V.mul(q,Math.sin(f))),r),y=V.mul(V.add(V.mul(t,Math.cos(g)),V.mul(q,Math.sin(g))),r);mesh.push({p:[V.add(a,x),V.add(b,x),V.add(a,y)],color,tag:'body'},{p:[V.add(a,y),V.add(b,x),V.add(b,y)],color,tag:'body'});}sphere(mesh,a,[r,r,r],color);sphere(mesh,b,[r,r,r],color);}
function torso(mesh,levels,color){let rows=[],N=32;for(let [x,y,w,z]of levels){rows.push(Array.from({length:N},(_,i)=>[x+w/2*Math.cos(i/N*Math.PI*2),y,z*Math.sin(i/N*Math.PI*2)]));}for(let j=0;j<rows.length-1;j++)for(let i=0;i<N;i++){let k=(i+1)%N;mesh.push({p:[rows[j][i],rows[j+1][i],rows[j][k]],color,tag:'body'},{p:[rows[j][k],rows[j+1][i],rows[j+1][k]],color,tag:'body'});}}
function makeModel({type='neutral',height='medium',pose='balanced',headRoll=0,prop=null,colorArms=false}){
 let p=types[type],b=heights[height],Y=n=>n/Math.cos(CAM),mesh=[],shade=[137,163,193],light=[178,199,220],dark=[72,103,139],shift=pose==='weight'?4:0,hipY=Y(b*.45),shoulderY=Y(b-23),cx=shift;
 torso(mesh,[[cx,shoulderY+6,p.shoulder*.72,17],[cx,shoulderY,p.shoulder,22],[cx,hipY+(shoulderY-hipY)*.43,p.waist,18],[cx,hipY,p.hip,22],[cx,hipY-7,p.hip*.75,18]],shade);
 bone(mesh,[cx,Y(b-24),0],[cx,Y(b+5),0],10,shade);
 const headC=[cx,Y(b+75),0],ry=Math.sqrt(75*75-(72*Math.sin(CAM))**2)/Math.cos(CAM),pivot=[cx,Y(b+2),0],xf=v=>V.add(pivot,roll(V.sub(v,pivot),headRoll*D));
 sphere(mesh,headC,[80,ry,72],light,xf,'skull');
 for(let s of [-1,1]){let x=s*32,y=-31,z=72*Math.sqrt(1-(x/80)**2-(y/ry)**2);sphere(mesh,V.add(headC,[x,y,z+1]),[6,2,1.5],dark,xf,'face');}
 sphere(mesh,V.add(headC,[0,-42,65]),[3,3,6],shade,xf,'face');
 let skeleton={};
 for(let s of [-1,1]){
  let H=[cx+s*p.hip*.26,hipY,0],F=[s*p.stance/2,12,0];
  if(pose==='cross')F=[-s*2,12,s*6];if(pose==='weight'&&s===1)F=[s*p.stance/2+3,12,9];
  let len=(hipY-12)/2+2,K=ik(H,F,len,len,[0,0,1]);bone(mesh,H,K,p.limb,shade);bone(mesh,K,F,p.limb*.88,shade);sphere(mesh,[F[0],6,F[2]+7],[p.limb*.9,6,14],dark);
  const S=[cx+s*(p.shoulder/2-7),shoulderY,0];let hand=[cx+s*(p.shoulder/2+3),hipY+8,4];
  if(pose==='orb'&&s===-1)hand=[cx-32,Y(b*.66),25];
  if(pose==='hush'&&s===1)hand=[cx+7,Y(b+10),45];
  if(pose==='weapon')hand=[cx+s*9,Y(b*.68),28];
  if(pose==='book')hand=[cx+s*18,Y(b*.53),29];
  if(pose==='heart'&&s===1)hand=[cx-12,Y(b*.77),25];
  if(pose==='umbrella'&&s===-1)hand=[cx-38,Y(b*.68),24];
  if(prop&&typeof prop==='object'&&s===(prop.hand==='left'?1:-1))hand=[cx+s*(prop.kind==='staff'?62:42),Y(b*(prop.kind==='dagger'?.70:.65)),prop.kind==='staff'?35:42];
  if(pose==='shoulder'&&s===-1)hand=[-85,Y(b-9),18];
  const armColor=colorArms?(s===-1?[48,154,222]:[218,104,166]):shade,handColor=colorArms?armColor:light;
  let l1=Y(b*.215),l2=Y(b*.205),E=ik(S,hand,l1,l2,[s,0,.3]);bone(mesh,S,E,p.arm,armColor);bone(mesh,E,hand,p.arm*.84,armColor);sphere(mesh,hand,[p.arm*.94,p.arm*1.15,p.arm*.82],handColor);
  skeleton[s]={hip:H,knee:K,ankle:F,shoulder:S,elbow:E,hand,legBones:[len,len],armBones:[l1,l2]};
 }
 if(prop==='leafUmbrella'){
  const center=[cx-8,Y(b+100),-92],rim=(a,r)=>[center[0]+145*r*Math.cos(a),center[1]+110*r*Math.sin(a),center[2]-46*(1-r*r)];
  const N=48,M=9;
  for(let j=0;j<M;j++)for(let i=0;i<N;i++){
   let a=i/N*Math.PI*2,z=(i+1)/N*Math.PI*2,r=j/M,s=(j+1)/M,p=shade;
   for(let t of [[rim(a,r),rim(z,r),rim(a,s)],[rim(z,r),rim(z,s),rim(a,s)]])mesh.push({p:t,color:[118,173,46],tag:'prop'});
  }
  for(let i=0;i<12;i++){let a=i/12*Math.PI*2;for(let j=0;j<7;j++){let A=rim(a,j/7),B=rim(a,(j+1)/7);A[2]+=1.8;B[2]+=1.8;bone(mesh,A,B,1.2,[57,113,29]);}}
  bone(mesh,skeleton[-1].hand,center,3.1,[66,116,32]);
 }
 if(prop&&typeof prop==='object'){
  const s=prop.hand==='left'?1:-1,h=skeleton[s].hand,gold=[195,161,64],steel=[181,205,227];
  if(prop.kind==='greatsword'){
   const u=V.unit([.60,.18,-.78]),w=V.unit(V.cross(u,[0,0,1])),normal=V.unit(V.cross(u,w));
   const guard=V.add(h,V.mul(u,24)),base=V.add(h,V.mul(u,31)),tip=V.add(base,V.mul(u,300)),wide=V.add(base,V.mul(u,38));
   bone(mesh,V.add(h,V.mul(u,-28)),guard,4.5,[132,82,51]);sphere(mesh,V.add(h,V.mul(u,-31)),[6,6,6],[55,63,73]);
   bone(mesh,V.add(guard,V.mul(w,-30)),V.add(guard,V.mul(w,30)),5,[60,71,85]);
   const polygon=[V.add(base,V.mul(w,-16)),V.add(wide,V.mul(w,-27)),tip,V.add(wide,V.mul(w,27)),V.add(base,V.mul(w,16))];
   for(const sign of [-1,1]){const ps=polygon.map(p=>V.add(p,V.mul(normal,sign*3)));for(let i=1;i<ps.length-1;i++)mesh.push({p:[ps[0],ps[i],ps[i+1]],color:sign===1?[201,207,216]:[133,147,165],tag:'prop'});}
   for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],a0=V.add(a,V.mul(normal,-3)),a1=V.add(a,V.mul(normal,3)),b0=V.add(b,V.mul(normal,-3)),b1=V.add(b,V.mul(normal,3));mesh.push({p:[a0,b0,a1],color:[78,91,109],tag:'prop'},{p:[a1,b0,b1],color:[78,91,109],tag:'prop'});}
  }else if(prop.kind==='staff'){
   const point=y=>[h[0]+s*.16*(y-h[1]),y,h[2]+.28*(y-h[1])];bone(mesh,point(12),point(Y(b+137)),3,gold);sphere(mesh,point(Y(b+137)),[14,17,9],gold);
  }else{
   const u=V.unit(prop.kind==='dagger'?[s*.60,.90,.70]:[s*.32,.65,.69]),L=prop.kind==='dagger'?90:160,base=V.add(h,V.mul(u,12)),tip=V.add(base,V.mul(u,L)),wide=prop.kind==='dagger'?9:3;
   bone(mesh,V.add(h,V.mul(u,-15)),base,3.2,gold);sphere(mesh,V.add(h,V.mul(u,-15)),[5,5,5],gold);
   const cross=V.unit(V.cross(u,[0,0,1]));bone(mesh,V.add(base,V.mul(cross,-14)),V.add(base,V.mul(cross,14)),2,gold);
   const mid=V.add(base,V.mul(u,L*.25)),A=V.add(mid,V.mul(cross,wide)),B=V.add(mid,V.mul(cross,-wide)),C=V.add(mid,[0,0,2]),E=V.add(mid,[0,0,-2]);
   for(let p of [[base,A,C],[base,C,B],[tip,C,A],[tip,B,C],[base,E,A],[base,B,E],[tip,A,E],[tip,E,B]])mesh.push({p,color:steel,tag:'prop'});
  }
 }
 return{mesh,headC,pivot,skeleton,parameters:{type,height,pose,headRoll,prop,colorArms},anatomicalAxes:{right:'negativeX',left:'positiveX',front:'positiveZ',rightArmGuide:'cyan',leftArmGuide:'pink'},projectedHeadNeutral:[160,150],groundOrigin:[0,0,0],camera:{projection:'orthographic',elevationDegrees:12,scale:1},headGeometry:{radii:[80,ry,72],sharedAcrossEveryType:true}};
}
function render(model,angle){let tris=[],bounds=[Infinity,Infinity,-Infinity,-Infinity],skull=[];for(const item of model.mesh){let pts=item.p.map(p=>yaw(p,angle)),n=V.unit(V.cross(V.sub(pts[1],pts[0]),V.sub(pts[2],pts[0]))),center=V.mul(pts.reduce((p,q)=>V.add(p,q),[0,0,0]),1/3);if(item.tag==='skull')n=V.unit(V.sub(center,yaw(model.headC,angle)));let view=[0,Math.sin(CAM),Math.cos(CAM)];if(V.dot(n,view)<-.001&&item.tag==='skull')continue;let pp=pts.map(project),depth=pp.reduce((s,p)=>s+p[2],0)/3;let l=Math.abs(V.dot(n,V.unit([-.45,.7,.8]))),k=.70+.30*l,color=item.color.map(x=>Math.round(x*k));tris.push({pp,depth,color});if(item.tag==='skull')for(let p of pp){bounds[0]=Math.min(bounds[0],p[0]);bounds[1]=Math.min(bounds[1],p[1]);bounds[2]=Math.max(bounds[2],p[0]);bounds[3]=Math.max(bounds[3],p[1]);skull.push(p);}}
 tris.sort((a,b)=>a.depth-b.depth);
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">';for(let t of tris){let c='rgb('+t.color.join(',')+')';svg+='<path d="M'+t.pp.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join('L')+'Z" fill="'+c+'" stroke="'+c+'" stroke-width=".4"/>';}svg+='</svg>';return{svg,bounds};}
export async function writeGuide(spec,dest){let model=makeModel(spec),layers=[],frames=[];for(let[v,a]of[0,180,-90,90].entries()){let r=render(model,a*D),b=await sharp(Buffer.from(r.svg)).png().toBuffer();layers.push({input:b,left:v%2*512,top:(v>>1)*512});frames.push({direction:['down','up','left','right'][v],skull:r.bounds.map(n=>+n.toFixed(2)),groundAnchor:[256,480]});}await fs.mkdir(path.dirname(dest),{recursive:true});await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toFile(dest);await fs.writeFile(dest.replace(/\.png$/,'.json'),JSON.stringify({...model,mesh:undefined,frames},null,2));return frames;}

await writeGuide({type:'masculine',height:'tall',pose:'shoulder',headRoll:0,prop:{kind:'greatsword',hand:'right'},colorArms:true},fileURLToPath(new URL('references/shoulder-guide-v3.png',import.meta.url)));
