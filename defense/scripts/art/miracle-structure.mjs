// An actual shared 3D mesh scene, rendered from four cameras with a per-pixel depth buffer.
// This is a structural reference, not a finished/rigged character or generated final artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
const out=path.join(gameRoot,'docs/art/demon-miracle');
const unarmed=process.argv.includes('--unarmed');
const master=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/art/sol-cast-v2/structure-masters/feminine-medium.json'),'utf8'));
const meshes=[];
const add=(name,color,vertices,faces)=>meshes.push({name,color,vertices,faces});
function ellipsoid(name,c,r,color){
  const vertices=[],faces=[],rows=12,cols=20;
  for(let a=0;a<=rows;a++)for(let b=0;b<cols;b++){
    const t=Math.PI*a/rows,p=2*Math.PI*b/cols;
    vertices.push([c[0]+r[0]*Math.sin(t)*Math.cos(p),c[1]+r[1]*Math.cos(t),c[2]+r[2]*Math.sin(t)*Math.sin(p)]);
  }
  for(let a=0;a<rows;a++)for(let b=0;b<cols;b++){
    const i=a*cols+b,j=a*cols+(b+1)%cols,k=i+cols,l=j+cols;faces.push([i,k,j],[j,k,l]);
  }
  add(name,color,vertices,faces);
}
function cylinder(name,a,b,r,color){
  const v=b.map((n,i)=>n-a[i]),len=Math.hypot(...v),n=v.map(x=>x/len);
  let t=Math.abs(n[1])<.9?[0,1,0]:[1,0,0];
  let u=[n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]],ul=Math.hypot(...u);u=u.map(x=>x/ul);
  const w=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],vertices=[],faces=[],k=12;
  for(const p of [a,b])for(let i=0;i<k;i++){const theta=i/k*Math.PI*2;vertices.push(p.map((q,j)=>q+r*(u[j]*Math.cos(theta)+w[j]*Math.sin(theta))));}
  for(let i=0;i<k;i++){const j=(i+1)%k;faces.push([i,j,i+k],[j,j+k,i+k]);}
  add(name,color,vertices,faces);
}
// Front is +Z. Anatomical left is -X: the front camera shows that hand on screen right.
ellipsoid('cranium',master.headC,[80,75,72],[157,180,199]);
ellipsoid('nose',[0,242,70],[7,7,7],[195,205,215]);
for(const x of [-30,30])ellipsoid('eye',[x,246,67],[5,3,4],[50,75,98]);
ellipsoid('torso',[0,143,0],[34,49,23],[150,172,193]);
cylinder('neck',[0,182,0],[0,199,0],9,[150,172,193]);
for(const side of [-1,1]){
  const skeleton=master.skeleton[String(side)],color=side===-1?[239,127,177]:[83,198,210];
  const hand=side===-1?[-65,115,22]:[49,104,7],elbow=side===-1?[-55,142,10]:skeleton.elbow;
  cylinder('arm-'+side,skeleton.shoulder,elbow,9,color);cylinder('forearm-'+side,elbow,hand,8,color);
  ellipsoid('hand-'+side,hand,[10,10,8],color);
  cylinder('leg-'+side,skeleton.hip,skeleton.knee,12,[151,177,196]);cylinder('shin-'+side,skeleton.knee,skeleton.ankle,10,[151,177,196]);
  ellipsoid('foot-'+side,[skeleton.ankle[0],7,7],[13,7,20],[151,177,196]);
}
// Opaque skirt is continuous across the posterior. Only the FRONT has a slit.
{
  const vertices=[],faces=[],k=24;
  for(const [y,rx,rz] of [[108,31,25],[14,67,40]])for(let i=0;i<k;i++){const a=i/k*Math.PI*2;vertices.push([rx*Math.cos(a),y,rz*Math.sin(a)]);}
  for(let i=0;i<k;i++){
    const j=(i+1)%k,angle=(i+.5)/k*Math.PI*2;
    if(Math.sin(angle)>.92)continue; // front slit, never the back
    faces.push([i,j,i+k],[j,j+k,i+k]);
  }
  add('opaque-skirt',[232,231,227],vertices,faces);
}
// Each wing root is on the upper back, behind the torso/arms. The common 3D scene fixes all occlusions.
for(const side of [-1,1]){
  const root=[side*10,164,-26];
  const outline=[[10,164],[72,196],[154,183],[146,142],[113,111],[139,69],[108,30],[47,67],[10,150]];
  const vertices=[root,...outline.map(([x,y])=>[side*x,y,-26-(x-10)*.23])],faces=[];
  for(let i=1;i<vertices.length-1;i++)faces.push([0,i,i+1]);faces.push([0,vertices.length-1,1]);
  add('wing-'+side,side<0?[194,145,234]:[165,137,224],vertices,faces);
  ellipsoid('wing-root-'+side,root,[7,12,6],[228,175,75]);
}
// One rigid prop, corrected from the enlarged original: SQUARE prism, flowing gold
// scrolls, feather/leaf shoulders and green inset at the lower junction. No diamond redesign.
const gemCentre=[-109,269,47],gold=[225,174,62];
cylinder('staff',[-36,13,6],[-109,269,47],3.5,gold);
const theta=-.19,local=(x,y,z=0)=>[gemCentre[0]+x*Math.cos(theta)-y*Math.sin(theta),gemCentre[1]+x*Math.sin(theta)+y*Math.cos(theta),gemCentre[2]+z];
const crystal=[[-25,25,0],[-25,-25,0],[25,-25,0],[25,25,0],[0,0,10],[0,0,-7]].map(p=>local(...p));
const facets=[[0,1,4],[1,2,4],[2,3,4],[3,0,4],[0,5,1],[1,5,2],[2,5,3],[3,5,0]],colours=[[175,230,229],[225,193,239],[250,228,173],[193,202,247]];
facets.forEach((face,i)=>add('staff-gem-facet-'+i,colours[i%4],crystal,[face]));
function ribbon(name,points,width=5,rotation=0){
  const curve=[];
  for(let i=0;i<=24;i++){
    const t=i/24,q=1-t;curve.push([q*q*q*points[0][0]+3*q*q*t*points[1][0]+3*q*t*t*points[2][0]+t*t*t*points[3][0],q*q*q*points[0][1]+3*q*q*t*points[1][1]+3*q*t*t*points[2][1]+t*t*t*points[3][1]]);
  }
  const vertices=[],faces=[];
  curve.forEach((p,i)=>{const prev=curve[Math.max(0,i-1)],next=curve[Math.min(24,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1,w=width*(.2+.8*Math.sin(Math.PI*(i+2)/28));for(const side of [-1,1]){const x=p[0]+side*-dy/len*w,y=p[1]+side*dx/len*w;for(const z of [-2,2])vertices.push(local(x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation),z));}});
  for(let i=0;i<24;i++){const a=i*4,b=a+4;faces.push([a,b,a+2],[a+2,b,b+2],[a+1,a+3,b+1],[a+3,b+3,b+1],[a,a+1,b],[b,a+1,b+1],[a+2,b+2,a+3],[a+3,b+2,b+3]);}
  add(name,[238,187,88],vertices,faces);
}
for(let i=0;i<4;i++){
  const r=i*Math.PI/2;
  ribbon('staff-scroll-'+i,[[-29,-25],[-45,-5],[-22,15],[-30,30]],4,r);
  ribbon('staff-feather-'+i,[[-30,29],[-7,24],[14,28],[34,44]],5,r);
  ribbon('staff-feather-tip-'+i,[[-11,29],[7,28],[20,38],[22,46]],2.8,r);
}
ribbon('staff-lower-left',[[-5,-39],[-38,-39],[-40,-14],[-53,-19]],6);
ribbon('staff-lower-right',[[-3,-41],[18,-22],[32,-27],[45,-40]],6);
ribbon('staff-neck-scroll',[[0,-64],[-25,-52],[-19,-35],[-5,-35]],5);
add('staff-green-inset',[74,201,86],[local(-8,-42,5),local(5,-51,5),local(4,-36,5)],[[0,1,2]]);
const cameras=[{name:'front',right:[-1,0,0],toward:[0,0,1]},{name:'back',right:[1,0,0],toward:[0,0,-1]},{name:'left',right:[0,0,-1],toward:[-1,0,0]},{name:'right',right:[0,0,1],toward:[1,0,0]}];
const cos=Math.cos(Math.PI/15),sin=Math.sin(Math.PI/15),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),edge=(a,b,x,y)=>(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
function render(camera,only=null){
  const pixels=Buffer.alloc(512*512*4),depth=new Float64Array(512*512).fill(-Infinity),owner=new Int16Array(512*512).fill(-1);
  meshes.forEach((m,mi)=>{
    if(only&&!only(m.name))return;
    const pts=m.vertices.map(p=>{const d=dot(p,camera.toward);return [256+dot(p,camera.right),480-p[1]*cos+d*sin,d*cos+p[1]*sin];});
    for(const face of m.faces){
      const [a,b,c]=face.map(i=>pts[i]),area=edge(a,b,c[0],c[1]);if(Math.abs(area)<1e-8)continue;
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(511,Math.ceil(Math.max(a[0],b[0],c[0])));
      const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(511,Math.ceil(Math.max(a[1],b[1],c[1])));
      const A=m.vertices[face[0]],B=m.vertices[face[1]],C=m.vertices[face[2]],u=B.map((v,i)=>v-A[i]),v=C.map((z,i)=>z-A[i]);
      const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],nl=Math.hypot(...normal)||1;
      const shade=.72+.28*Math.abs(dot(normal,[.3,.75,.59])/nl);
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const wa=edge(b,c,x+.5,y+.5)/area,wb=edge(c,a,x+.5,y+.5)/area,wc=1-wa-wb;if(wa<0||wb<0||wc<0)continue;
        const d=wa*a[2]+wb*b[2]+wc*c[2],i=y*512+x;if(d<depth[i])continue;depth[i]=d;owner[i]=mi;
        for(let ch=0;ch<3;ch++)pixels[i*4+ch]=Math.round(m.color[ch]*shade);pixels[i*4+3]=255;
      }
    }
  });
  return {pixels,owner};
}
const layers=[],propLayers=[],checks=[];
for(const [i,camera] of cameras.entries()){
  const frame=render(camera,unarmed?n=>!n.startsWith('staff'):null),armStaff=render(camera,n=>(!unarmed&&n==='staff')||n==='hand--1'||n==='forearm--1');
  let wingOccludesArmStaff=0;
  for(let p=0;p<frame.owner.length;p++)if(armStaff.owner[p]>=0&&frame.owner[p]>=0&&meshes[frame.owner[p]].name.startsWith('wing-'))wingOccludesArmStaff++;
  checks.push({view:camera.name,wingOccludesArmStaffPixels:wingOccludesArmStaff});
  const input=await sharp(frame.pixels,{raw:{width:512,height:512,channels:4}}).png().toBuffer();
  layers.push({input,left:i%2*512,top:Math.floor(i/2)*512});
  const prop=render(camera,n=>n.startsWith('staff'));
  propLayers.push({input:await sharp(prop.pixels,{raw:{width:512,height:512,channels:4}}).png().toBuffer(),left:i%2*512,top:Math.floor(i/2)*512});
}
const png=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
await fs.writeFile(path.join(out,unarmed?'wing-unarmed-structure-guide.png':'wing-structure-guide.png'),png);
if(!unarmed)await fs.writeFile(path.join(out,'staff-structure-guide.png'),await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(propLayers).png().toBuffer());
await fs.writeFile(path.join(out,unarmed?'wing-unarmed-structure-scene.json':'wing-structure-scene.json'),JSON.stringify({kind:'Actual procedural 3D meshes and four orthographic depth-buffer renders; structural reference only.',renderFilter:unarmed?'Exclude staff meshes':'All meshes',sourceMaster:'feminine-medium.json',attachment:{wings:[[-10,164,-26],[10,164,-26]],staffHand:'anatomical left',staffGrip:[-65,115,22],frontDirection:'+Z'},cameras,checks,meshes},null,2)+'\n');
let obj='',offset=1;for(const m of meshes.filter(m=>!unarmed||!m.name.startsWith('staff'))){obj+='o '+m.name+'\n';for(const v of m.vertices)obj+='v '+v.join(' ')+'\n';for(const f of m.faces)obj+='f '+f.map(i=>i+offset).join(' ')+'\n';offset+=m.vertices.length;}
await fs.writeFile(path.join(out,unarmed?'wing-unarmed-structure.obj':'wing-structure.obj'),obj);
if(!(checks.find(c=>c.view==='back').wingOccludesArmStaffPixels>0))throw Error('Back camera must establish actual wing occlusion.');
console.log(JSON.stringify({meshes:meshes.length,checks}));
