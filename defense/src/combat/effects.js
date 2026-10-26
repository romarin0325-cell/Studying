import {HERO,HEROES} from '../content.js';
import {cellPoint,pathPoint,attackGeometry,activeSkill,ACTIVE_SKILLS,neighbors,personalTrait,PATH,topCinderella} from './engine.js';
import {COMPANION_VISUALS,drawCompanionShot,drawCompanionSkill,drawCompanionImpact,drawCompanionBomb,companionSkillEvents} from './companion-vfx.js';
import {drawLightningShot,drawLightningImpact,LIGHTNING_IMPACT_LIFE} from './lightning-vfx.js';
import {drawNewShot,drawNewImpact,drawNewAttackShape,drawNewGround} from './new-companion-vfx.js';
// Effects drawn under the units (attack circles and ultimate ground marks); draw() only ages them.
const GROUND_TYPES=new Set(['attackShape','deathhandGround','ecloseGround']);
export const ULTIMATE_FRAMES=Object.freeze({cinderella:0,galaxy_whale:1,time_ruler:2,doom:3,santa:4,jasmine:5,frost_witch:6,harmonious:7,zeke:8,rumi:9,luna:10,cherry_prince:11,siren:12,silver_rabbit:13,ancient_dragon:14,time_magician:15});
// Emblems added in pass 15 for companions whose ultimate only had the shared cast flash, and for the Queen, who borrowed
// Cherry Prince's finisher ring (GPT image, docs/art/companion-fx-20261024): [atlas, frame, columns, rows].
export const EXTRA_EMBLEMS=Object.freeze(Object.fromEntries([
  ...['star_boy','snow_rabbit','night_rabbit','mushroom_king','great_detective','guardian','avalanche_maid','red_dragon'].map((id,i)=>[id,['ultimates-extra-a',i,4,2]]),
  ...['aurora','storm_sage','flame_sage','lightning_sage','queen'].map((id,i)=>[id,['ultimates-extra-b',i,3,2]]),
]));
const dedicated=hero=>ULTIMATE_FRAMES[hero]!==undefined||!!EXTRA_EMBLEMS[hero];
// Emblem scale per rarity for the dedicated support and field templates (UR keeps its original sizes).
const RARITY_SCALE=Object.freeze({C:.82,R:.9,SR:1,UR:1});
export const ultimateLayout=kind=>['royal','starfall','mirror','flurry','thunder','execute'].includes(kind)?'target':['vortex','singularity'].includes(kind)?'pull':['echo','haste','awaken','march','gift','harmony','trauma'].includes(kind)?'support':'field'; // crush is a field ultimate
export function impactSize(hero,rank=1){const h=HERO[hero],area=['cleave','pulse','beam','cross','splash','zone'].includes(h.shape);return (area?82:62)+Math.min(5,rank)*4+(hero==='red_dragon'?22:hero==='santa'?10:0);}

// Frame order is the authored 7 x 3 SD atlas. Every companion owns a silhouette.
export const FX_PROFILES=Object.fromEntries([
  ['zeke','crescent',0,0],['rumi','star',1,0],['luna','daggers',2,-Math.PI/4],
  ['cinderella','glass',3,0],['snow_rabbit','snow',4,0],['avalanche_maid','icicles',5,0],
  ['night_rabbit','leap',6,-Math.PI*3/4],['guardian','quake',7,0],['storm_sage','ribbon',8,0],
  ['lightning_sage','bolt',9,0],['red_dragon','dragon',10,0],['flame_sage','embers',11,0],
  ['mushroom_king','spores',12,0],['great_detective','needle',13,0],['siren','song',14,0],
  ['phantom','claws',15,Math.PI/4],['queen','petals',16,0],['galaxy_whale','planet',17,0],
  ['silver_rabbit','comets',18,.18],['ancient_dragon','cross',19,0],['time_ruler','clock',20,0],
].map(([id,motion,frame,offset])=>[id,{motion,frame,offset}]));
for(const [frame,[id,motion]] of [['doom','contract'],['santa','present'],['jasmine','halo'],['star_boy','falling_star'],['time_magician','time_needle'],['cherry_prince','royal_blade']].entries())FX_PROFILES[id]={motion,frame,offset:0,atlas:'effects-expansion',columns:4,rows:3};
for(const [frame,[id,motion]] of [['frost_witch','ice_lance'],['harmonious','harmony_bell'],['aurora','mirror_shard']].entries())FX_PROFILES[id]={motion,frame,offset:0,atlas:'effects-trio',columns:3,rows:2};
FX_PROFILES.behemoth={motion:'quake',frame:0,offset:0,atlas:'effects-behemoth',columns:3,rows:1};
// Toffee Apple's beam is a glossy glaze streak drawn in code; Underdog throws a jagged stone. Both borrow a plain spark frame for hit marks.
FX_PROFILES.toffee_apple={motion:'candy',frame:11,offset:0};
FX_PROFILES.underdog={motion:'stone',frame:1,offset:0};
// Joker throws a spinning card tinted by its current colour; Sunflower throws a small blooming sun. Both are drawn in code.
FX_PROFILES.joker={motion:'cards',frame:11,offset:0};
FX_PROFILES.sunflower={motion:'sunbeam',frame:11,offset:0};
// Antropy throws a thin cracked ring with a star; Cure Master throws a cartoon syringe. Both are drawn in code.
FX_PROFILES.antropy={motion:'ringshot',frame:11,offset:0};
FX_PROFILES.cure_master={motion:'syringe',frame:11,offset:0};
// Ash throws a small black-red fireball with a feather; Venom throws a green venom drop with a black spider-lily petal.
const APPLE_TRIGGER=80;
FX_PROFILES.ash={motion:'blackfire',frame:11,offset:0};
FX_PROFILES.venom={motion:'venomdrop',frame:11,offset:0};
FX_PROFILES.demon_king={motion:'deathbolt',frame:15,offset:0};
FX_PROFILES.miracle_larva={motion:'metamorphosis',frame:1,offset:0};
export const JOKER_HEX=Object.freeze({red:'#ff5a5a',blue:'#4aa8ff',green:'#5fd36a',white:'#f6f4ff',black:'#241a36',chaos:'#d9b8ff'});

function stroke(ctx,points,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function disk(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function heart(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+r*.9);ctx.bezierCurveTo(x-r*1.5,y-r*.1,x-r*.8,y-r*1.2,x,y-r*.45);ctx.bezierCurveTo(x+r*.8,y-r*1.2,x+r*1.5,y-r*.1,x,y+r*.9);ctx.fill();}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.4);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.4);ctx.closePath();ctx.fill();}
function star(ctx,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rad=i%2?r*.27:r;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fill();}
const directional=new Set(['crescent','daggers','leap','ribbon','dragon','claws','comets']);
const easeOut=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
const easeBack=t=>{t=Math.min(1,Math.max(0,t));const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
const window01=(age,start,end)=>Math.min(1,Math.max(0,(age-start)/(end-start)));
// Stable pseudo-random numbers per effect, so a replayed frame draws the same shards.
const hash=(seed,i)=>{const x=Math.sin(seed*12.9898+i*78.233)*43758.5453;return x-Math.floor(x);};
export const isUR=hero=>!!HERO[hero]&&(HERO[hero].hidden||HERO[hero].rarity==='UR');
// Large signature emblems painted for this patch (fx-emblems atlas, black background, screen blend).
const EMBLEM={phantom:0,cinderella:1,zeke:2};
// Field-wide ultimates whose aura is global get a board-edge glow; partial ones mark their units.
export const GLOBAL_AURAS=Object.freeze(['echo','haste','awaken','march','festive','radiance','harmony','winter']);
export const PARTIAL_AURAS=Object.freeze(['trauma','midnight','venom']);

// Same logical shape and dimensions as hit testing; no role labels on empty tiles.
export function drawAttackRange(ctx,hero,from,aim){
  if(hero.id==='flame_sage'){
    ctx.save();ctx.globalAlpha=.7;ctx.strokeStyle=hero.color;ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.beginPath();
    PATH.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();return;
  }
  const g=attackGeometry(hero,from,{x:from.x+Math.cos(aim)*hero.range,y:from.y+Math.sin(aim)*hero.range});
  ctx.save();ctx.translate(from.x,from.y);ctx.strokeStyle='#d5f1e8aa';ctx.fillStyle='#a5ddeb12';ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();
  if(g.kind==='cross'){
    ctx.rect(-g.range,-g.radius/2,g.range*2,g.radius);ctx.rect(-g.radius/2,-g.range,g.radius,g.range*2);
    ctx.save();ctx.beginPath();ctx.arc(0,0,g.range,0,Math.PI*2);ctx.clip();ctx.beginPath();ctx.rect(-g.range,-g.radius/2,g.range*2,g.radius);ctx.rect(-g.radius/2,-g.range,g.radius,g.range*2);ctx.fill();ctx.stroke();ctx.restore();
  }else if(g.kind==='beam'){ctx.rotate(g.angle);ctx.rect(0,-g.radius/2,g.range,g.radius);ctx.fill();ctx.stroke();}
  else if(g.kind==='cleave'){ctx.moveTo(0,0);ctx.arc(0,0,g.range,g.angle-Math.PI/4,g.angle+Math.PI/4);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.arc(0,0,g.range,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}

export class CombatFX{
  constructor(ctx,art){this.ctx=ctx;this.art=art;this.impacts=[];this.clock=0;this.reduced=false;this.budget=64;this.enemies=new Map();this.sprites=new Map();}
  // Cached soft glow and ray-burst sprites per colour: one offscreen draw, then cheap stamps.
  sprite(kind,color){
    const key=kind+color;let c=this.sprites.get(key);if(c)return c;
    c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    if(kind==='glow'){const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,color+'ee');r.addColorStop(.32,color+'77');r.addColorStop(1,color+'00');g.fillStyle=r;g.fillRect(0,0,256,256);}
    else if(kind==='crescent'){const r=g.createLinearGradient(24,24,232,232);r.addColorStop(0,'#ffffff');r.addColorStop(1,color);g.fillStyle=r;g.beginPath();g.arc(128,128,108,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.beginPath();g.arc(172,104,96,0,Math.PI*2);g.fill();g.globalCompositeOperation='source-over';}
    else{g.translate(128,128);for(let i=0;i<18;i++){g.rotate(Math.PI*2/18);const len=i%2?92:126,w=i%2?4:7,grad=g.createLinearGradient(0,0,0,-len);grad.addColorStop(0,color+'dd');grad.addColorStop(.6,color+'55');grad.addColorStop(1,color+'00');g.fillStyle=grad;g.beginPath();g.moveTo(-w,0);g.lineTo(0,-len);g.lineTo(w,0);g.closePath();g.fill();}}
    this.sprites.set(key,c);return c;
  }
  glow(kind,color,x,y,size,alpha=1,angle=0){
    if(alpha<=0||size<=0)return;const ctx=this.ctx,c=this.sprite(kind,color);
    ctx.save();ctx.globalAlpha*=alpha;ctx.globalCompositeOperation='lighter';ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.drawImage(c,-size/2,-size/2,size,size);ctx.restore();
  }
  emblem(hero,x,y,size,angle=0,alpha=1){const frame=EMBLEM[hero];if(frame===undefined)return false;this.atlasStamp('fx-emblems',frame,3,1,x,y,size,size,angle,alpha);return true;}
  // Big signature art for a field ultimate: dedicated emblem when one exists, else the ultimate frame.
  centerArt(hero,x,y,size,angle,alpha){if(!this.emblem(hero,x,y,size,angle,alpha))this.ultimate(hero,x,y,size,size,angle,alpha);}
  point(uid,fallback){return this.enemies.get(uid)?.point||fallback;}
  ultimate(hero,x,y,width,height=width,angle=0,alpha=1){const own=COMPANION_VISUALS[hero];if(own&&this.art.images[own.atlas]){this.atlasStamp(own.atlas,own.frame+4,4,2,x,y,width,height,angle,alpha,'source-over');return;}const extra=EXTRA_EMBLEMS[hero];if(extra&&this.art.images[extra[0]]){this.atlasStamp(extra[0],extra[1],extra[2],extra[3],x,y,width,height,angle,alpha,'source-over');return;}const frame=ULTIMATE_FRAMES[hero];if(hero==='queen')this.atlasStamp('finishers',0,4,3,x,y,width,height,angle,alpha);else if(frame!==undefined)this.atlasStamp('ultimates',frame,4,4,x,y,width,height,angle,alpha,'source-over');else this.stamp(hero,x,y,width,angle,alpha);}
  atlasStamp(atlas,frame,columns,rows,x,y,width,height=width,angle=0,alpha=1,blend='screen'){
    const ctx=this.ctx,img=this.art.images[atlas];if(!img||alpha<=0)return;
    const w=img.naturalWidth/columns,h=img.naturalHeight/rows;
    ctx.save();ctx.globalAlpha*=alpha;ctx.globalCompositeOperation=blend;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(img,frame%columns*w,Math.floor(frame/columns)*h,w,h,-width/2,-height/2,width,height);ctx.restore();
  }
  stamp(hero,x,y,size,angle=0,alpha=1,form=null){
    const own=COMPANION_VISUALS[hero];if(own&&this.art.images[own.atlas]){this.atlasStamp(own.atlas,own.frame,4,2,x,y,size,size,angle,alpha,'source-over');return;}
    const ctx=this.ctx,fx=FX_PROFILES[hero];if(!fx||alpha<=0)return;
    if(fx.atlas&&this.art.images[fx.atlas]){this.atlasStamp(fx.atlas,form==='trauma'?6:fx.frame,fx.columns,fx.rows,x,y,size,size,fx.motion==='halo'?0:angle,alpha);return;}
    const img=this.art.images.effects;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);if(directional.has(fx.motion))ctx.rotate(angle+fx.offset);
    if(img&&!fx.atlas){const w=img.naturalWidth/7,h=img.naturalHeight/3,inset=.055;ctx.globalCompositeOperation='screen';ctx.drawImage(img,(fx.frame%7+inset)*w,(Math.floor(fx.frame/7)+inset)*h,w*(1-inset*2),h*(1-inset*2),-size/2,-size/2,size,size);}
    else{ctx.rotate(fx.frame*Math.PI/11);star(ctx,size*.24,HERO[hero].color);ctx.lineWidth=2;ctx.strokeStyle=HERO[hero].color;for(let i=0;i<fx.frame%4;i++){ctx.beginPath();ctx.arc(0,0,size*(.25+i*.05),0,Math.PI*1.4);ctx.stroke();}}
    ctx.restore();
  }
  add(effect){
    // Spend the decoration budget on ordinary hit stamps first. Boss magic and
    // finisher receipts keep their target marks even during a dense burst.
    if(this.impacts.length>=this.budget){const index=this.impacts.findIndex(e=>e.type==='impact');if(index>=0)this.impacts.splice(index,1);else if(effect.type==='impact')return;}
    this.impacts.push(effect);if(this.impacts.length>128)this.impacts.shift();
  }
  event(e){
    if(e.type==='deathhandBlast'){
      // Positions of the counted targets as they stood when the hand closed (the dead ones are already gone).
      const points=(e.targets||[]).map(r=>{const at=this.enemies.get(r.uid);return {...r,...(at?.point||{x:e.x,y:e.y}),boss:!!at?.enemy?.boss};});
      this.add({...e,points,life:1.4,total:1.4});this.add({type:'deathhandGround',x:e.x,y:e.y,radius:e.radius,life:1.4,total:1.4});
    }
    if(e.type==='eclose')for(const [i,p] of e.points.entries()){const delay=Math.min(.48,i*.12),life=1.25+delay;this.add({...p,type:'miracleEclose',delay,life,total:life});this.add({...p,type:'ecloseGround',delay,life,total:life});}
    const cocoon=e.hero==='miracle_larva'&&e.form==='miracle_cocoon';
    if(e.type==='attack'&&(cocoon||['zeke','guardian','ancient_dragon','behemoth'].includes(e.hero))){const life=cocoon?.44:e.hero==='guardian'||e.hero==='behemoth'?.44:e.hero==='ancient_dragon'?.3:.34;this.add({...e,...e.origin,type:'attackShape',angle:Math.atan2(e.to.y-e.origin.y,e.to.x-e.origin.x),life,total:life,...(e.hero==='zeke'?{swing:this.swing=!this.swing}:{})});}
    if(e.type==='frostBreak')this.add({...e,life:.42,total:.42});
    if(e.type==='meteor')this.add({...e,seed:this.clock*7+e.x,life:.7,total:.7});
    if(e.type==='judgement')this.add({...e,life:.9,total:.9});
    if(e.type==='bell')this.add({...e,life:.85,total:.85});
    if(e.type==='bossCast'&&e.pattern==='thunder')for(const i of e.cells||[])this.add({type:'thunderStrike',...cellPoint(i),seed:i,life:.6,total:.6});
    if(e.type==='instantKill')this.add({...e,life:.48,total:.48});
    if(e.type==='finisherImpact'||e.type==='finisherFizzle')this.add({...e,life:e.type==='finisherImpact'?.55:.25,total:e.type==='finisherImpact'?.55:.25});
    if(e.type==='bossCast')for(const p of e.cells?.map(cellPoint)||[e])this.add({...e,...p,type:'bossMagic',life:.65,total:.65});
    if(e.type==='supportPulse')for(const p of e.targets||[])this.add({...p,hero:e.hero,type:'support',pulse:true,life:.45,total:.45});
    if(e.type==='impact'){const life=e.hero==='lightning_sage'?LIGHTNING_IMPACT_LIFE:['red_dragon','santa','snow_rabbit'].includes(e.hero)?.38:['demon_king','miracle_larva'].includes(e.hero)?.45:.3;this.add({...e,life,total:life});}
    if(e.type==='chain'){const lightning=e.hero==='lightning_sage',life=lightning?LIGHTNING_IMPACT_LIFE:.24;this.add({type:'impact',hero:e.hero,x:e.to.x,y:e.to.y,angle:Math.atan2(e.to.y-e.from.y,e.to.x-e.from.x),life,total:life,rank:1,...(lightning?{hop:true}:{})});}
    if(e.type==='dreamPhase')for(const p of (e.targets||[]).slice(0,18))this.add({type:'dreamHit',phase:e.phase,x:p.x,y:p.y,life:.5,total:.5});
    if(e.type==='crushPhase')this.add({...e,life:.9,total:.9});
    if(e.type==='sunCharge'){this.bloomAt=this.clock;for(const p of e.points||[])this.add({type:'sunCharge',x:p.x+28,y:p.y+21,sunlight:e.sunlight,life:.9,total:.9});}
    if(e.type==='sunSpend'&&e.sunlight>0)this.add({type:'sunSpend',points:(e.points||[]).map(p=>({x:p.x+28,y:p.y+21})),sunlight:e.sunlight,life:1.2,total:1.2});
    if(e.type==='jokerColor'){this.companionJoker=e.color;this.wheelAt=this.clock;for(const p of e.points||[])this.add({type:'jokerFlip',x:p.x+28,y:p.y+21,color:e.color,life:.7,total:.7});}
    if(e.type==='reduce')this.add({...e,life:1.1,total:1.1});
    if(e.type==='armageddonBlast')this.add({type:'armageddon',x:e.x,y:e.y,radius:e.radius||180,life:1.3,total:1.3});
    if(e.type==='skill'&&e.kind==='venomplague')for(const p of e.targets||[])this.add({type:'plagueBloom',x:p.x,y:p.y,life:1.1,total:1.1});
    if(e.type==='ward')this.add({type:'ward',x:e.x,y:e.y,hero:e.hero,life:.7,total:.7});
    if(e.type==='requiem')for(const p of e.points||[])this.add({type:'wipe',x:p.x,y:p.y,cleared:p.cleared||0,life:.8,total:.8});
    if(e.type==='skill'&&e.kind==='requiem')this.add({type:'novaRing',x:e.origin.x,y:e.origin.y-10,life:1.25,total:1.25});
    if(e.type==='skill'&&e.kind==='lemonade')for(const p of e.targets||[])this.add({type:'lemonPop',x:p.x,y:p.y,life:1,total:1});
    if(e.type==='bombSet')this.add({...e,life:.6,total:.6});
    if(e.type==='bombBlast')this.add({...e,life:.9,total:.9});
    if(companionSkillEvents(this,e))return;
    if(e.type==='skill'){
      if(e.kind==='deathhand'||e.kind==='miracle_eclose')return;
      if(e.locked||e.kind==='dream')return;
      const targets=e.targets||[],h=HERO[e.hero];
      if(e.kind==='trauma'){for(const p of targets)this.add({...p,type:'transform',hero:e.hero,life:.8,total:.8});return;}
      for(const [i,p] of targets.entries())this.add({type:e.support?'support':ultimateLayout(e.kind)==='pull'?'pullImpact':'ultimate',hero:e.hero,...p,origin:e.origin,angle:Math.atan2(p.y-e.origin.y,p.x-e.origin.x),life:.65+(e.support?i*.04:0),total:.65+(e.support?i*.04:0),rank:e.rank,skill:h.skill.type});
      if(!targets.length)this.add({type:'ultimate',hero:e.hero,...e.origin,origin:e.origin,angle:0,life:.65,total:.65,rank:e.rank});
    }
  }
  // Every cast: light pillar, two shock rings and a ray burst at the caster. UR casts are larger
  // and add a gold flash; this is the "the ultimate fired" beat, independent of the field art.
  drawCast(skill){
    const age=skill.total-skill.life;if(age<0||age>1.1||!skill.origin)return;
    const ctx=this.ctx,h=HERO[skill.hero],o=skill.origin,ur=isUR(skill.hero),k=ur?1.3:1,fade=1-window01(age,.55,1.1),reduced=this.reduced?.55:1;
    // Screen-edge flash in the hero colour (UR: brighter and gold-tinted).
    // The Death Hand darkens the field instead of flashing it.
    if(age<.4&&skill.kind!=='deathhand'){ctx.save();ctx.globalAlpha=(1-age/.4)*(ur?.38:.22)*reduced;ctx.globalCompositeOperation='lighter';ctx.fillStyle=(ur?'#ffd36a':h.color)+'55';ctx.fillRect(0,0,720,780);ctx.restore();}
    ctx.save();ctx.globalCompositeOperation='lighter';
    // Pillar of light from the caster.
    const pillar=(1-window01(age,.05,.75))*reduced;
    if(pillar>0){const w=(56+age*70)*k,key=h.color+o.y;if(!this.pillars)this.pillars=new Map();let g=this.pillars.get(key);if(!g){g=ctx.createLinearGradient(0,o.y-320,0,o.y+30);g.addColorStop(0,h.color+'00');g.addColorStop(.6,h.color+'66');g.addColorStop(1,'#ffffffaa');this.pillars.set(key,g);}ctx.globalAlpha=pillar;ctx.fillStyle=g;ctx.fillRect(o.x-w/2,o.y-320,w,350);}
    // Two shock rings on the floor.
    for(const [delay,max,width] of [[0,250,10],[.14,340,5]]){const a=age-delay;if(a<0||a>.6)continue;const r=easeOut(a/.6)*max*k;ctx.globalAlpha=(1-a/.6)*reduced;ctx.strokeStyle=h.color;ctx.lineWidth=width*(1-a/.6)+1.5;ctx.beginPath();ctx.ellipse(o.x,o.y+18,r,r*.42,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    const pop=easeBack(window01(age,0,.32));
    this.glow('rays',ur?'#ffe08a':h.color,o.x,o.y-24,(250*k)*pop,fade*.7*reduced,age*.9);
    this.glow('glow',h.color,o.x,o.y+8,(170*k)*pop,fade*.55);
    if(ur)this.glow('rays',h.color,o.x,o.y-24,(330*k)*pop,fade*.5*reduced,-age*.6);
  }
  // Rising gold sparkles over the board for a UR ultimate.
  drawStarRain(skill,age){
    const ctx=this.ctx;if(this.reduced)return;ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<22;i++){const t=window01(age,hash(skill.uid||1,i)*.5,hash(skill.uid||1,i)*.5+.9);if(t<=0||t>=1)continue;
      const x=40+hash(skill.uid||3,i+40)*640,y=760-t*(420+hash(skill.uid||5,i+80)*260);ctx.globalAlpha=Math.sin(t*Math.PI);ctx.save();ctx.translate(x,y);ctx.rotate(t*3);star(ctx,5+hash(skill.uid||7,i)*7,i%3?'#ffe9a8':'#fffaf0');ctx.restore();}
    ctx.restore();
  }
  // Underdog's Big Show: a giant tattooed fist in a studded sleeve drops onto the middle of the board, the ground cracks outward in
  // a shockwave that reaches every enemy, stones fly, and the whole screen flashes and shakes. The cracks and ring reach the board edge
  // because the hit does (it strikes every enemy).
  drawFist(x,y,s){
    const ctx=this.ctx;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';ctx.lineCap='round';
    const outline='#1a1240',skinLight='#d9a07a',skin='#c98d68',skinDark='#9c6446';
    // sleeve with studs (comes from above the screen)
    ctx.fillStyle='#14111c';ctx.strokeStyle=outline;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-62,-260);ctx.lineTo(62,-260);ctx.lineTo(70,-70);ctx.lineTo(-70,-70);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#8a8aa0';for(const [sx,sy] of [[-40,-200],[0,-215],[40,-200],[-45,-150],[0,-160],[45,-150],[-30,-105],[30,-105]]){ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#8a8aa0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-70,-80);ctx.lineTo(70,-80);ctx.stroke();
    // wrist and back of the hand
    ctx.fillStyle=skin;ctx.strokeStyle=outline;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-58,-72);ctx.lineTo(58,-72);ctx.quadraticCurveTo(84,-20,80,34);ctx.lineTo(-80,34);ctx.quadraticCurveTo(-84,-20,-58,-72);ctx.closePath();ctx.fill();ctx.stroke();
    // four curled fingers, knuckles forward (down)
    for(let i=0;i<4;i++){const fx=-60+i*40;ctx.fillStyle=i%2?skinLight:skin;ctx.strokeStyle=outline;ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(fx-19,14,38,72,17);ctx.fill();ctx.stroke();
      ctx.strokeStyle=skinDark;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(fx-10,52);ctx.lineTo(fx+10,52);ctx.stroke();ctx.fillStyle='#ffe4cc99';ctx.beginPath();ctx.ellipse(fx-6,34,5,9,0,0,Math.PI*2);ctx.fill();}
    // thumb folded across
    ctx.fillStyle=skinLight;ctx.strokeStyle=outline;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-92,-30);ctx.quadraticCurveTo(-120,20,-80,56);ctx.quadraticCurveTo(-52,64,-44,40);ctx.quadraticCurveTo(-76,10,-62,-26);ctx.closePath();ctx.fill();ctx.stroke();
    // tribal tattoo on the back of the hand
    ctx.strokeStyle='#2c2146';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-30,-50);ctx.bezierCurveTo(10,-60,40,-30,6,-10);ctx.bezierCurveTo(-26,6,-8,22,22,14);ctx.stroke();
    ctx.beginPath();ctx.moveTo(34,-48);ctx.lineTo(52,-20);ctx.moveTo(-44,-12);ctx.lineTo(-26,6);ctx.stroke();
    ctx.restore();
  }
  drawBigShow(skill,age){
    // Timeline (2.4 s): the fist falls (0.05-0.36), lands with a flash and a crater, holds, lifts away (0.7-1.15); the crater and rings
    // linger to the end. Painted art (effects-bigshow: 0 fist, 1 crater) when loaded, the code-drawn fist otherwise.
    const ctx=this.ctx,hit=.36,cx=360,cy=440,reduced=this.reduced,art=this.art.images['effects-bigshow'];
    const drop=window01(age,.05,hit),land=age>=hit,since=Math.max(0,age-hit),lift=window01(age,.7,1.15),fade=1-window01(age,.95,1.2);
    ctx.save();ctx.globalAlpha=Math.min(.4,age*2)*(1-window01(age,1.2,2));ctx.fillStyle='#08060f';ctx.fillRect(0,0,720,780);ctx.restore();
    const S=440,top=land?cy-S*.52+10*Math.min(1,since*14)-lift*620:-S*.62+(cy-S*.52+S*.62)*drop*drop;
    if(land){
      // crater decal on the ground under everything else: it widens fast, then fades slowly
      const grow=easeOut(window01(since,0,.5)),a=1-window01(age,1.55,2.35);
      if(art&&a>0){this.atlasStamp('effects-bigshow',1,2,1,cx,cy+34,(190+560*grow),(190+560*grow)*.62,0,Math.min(1,a*1.1)*.64,'screen');}
    }
    if(fade>0&&age>.03){
      ctx.save();ctx.globalAlpha=fade;
      if(art){
        // screen blend: the dark sleeve and outline vanish, so the fist is a glowing shape with no cut edge (like the other ultimates)
        if(!land&&!reduced){ctx.globalAlpha=fade*.3;this.atlasStamp('effects-bigshow',0,2,1,cx,top+S/2-80*(1-drop),S*1.04,S*1.04,0,1,'screen');ctx.globalAlpha=fade;}
        const grow=1+(land?.05*Math.max(0,1-since*7):0);
        this.atlasStamp('effects-bigshow',0,2,1,cx,top+S/2,S*grow,S*grow,0,.86,'screen');
      }else{
        if(!land&&!reduced){ctx.globalAlpha=fade*.35;this.drawFist(cx,top+S*.55-110*(1-drop),1.25);ctx.globalAlpha=fade;}
        this.drawFist(cx,top+S*.55,1.25+(land?.06*Math.max(0,1-since*8):0));
      }
      ctx.restore();
    }
    if(!land)return;
    const flash=1-window01(since,0,.22),ring=easeOut(window01(since,0,.55)),dust=window01(since,0,1);
    ctx.save();ctx.globalAlpha=flash*.3;ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fff4dc';ctx.fillRect(0,0,720,780);ctx.restore();
    this.glow('rays','#ffd9a0',cx,cy+30,560*Math.min(1,since*4),(1-dust)*.7,since*1.2);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const [scale,w,col] of [[1,12,'#ffe6c0'],[.72,6,'#ff9a5a']]){ctx.globalAlpha=(1-ring)*.95;ctx.strokeStyle=col;ctx.lineWidth=w*(1-ring)+2;ctx.beginPath();ctx.ellipse(cx,cy+30,Math.max(8,430*ring*scale),Math.max(4,250*ring*scale),0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    if(!art){ctx.save();ctx.globalAlpha=(1-window01(since,.4,1.2))*.9;ctx.strokeStyle='#120d1a';ctx.lineWidth=5;ctx.lineCap='round';
      for(let i=0;i<9;i++){const a=i/9*Math.PI*2+.3,len=(120+hash(i,4)*190)*Math.min(1,since*5);ctx.beginPath();ctx.moveTo(cx,cy+34);let px=cx,py=cy+34;for(let k=1;k<=4;k++){px+=Math.cos(a+(hash(i,k)-.5)*.7)*len/4;py+=Math.sin(a+(hash(i,k)-.5)*.7)*len/4*.62;ctx.lineTo(px,py);}ctx.stroke();}
      ctx.restore();}
    if(!reduced)for(let i=0;i<22;i++){const a=hash(i,2)*Math.PI*2,v=120+hash(i,6)*330,k=easeOut(window01(since,0,.9)),gx=cx+Math.cos(a)*v*k,gy=cy+Math.sin(a)*v*k*.6-Math.sin(Math.min(1,since*1.4)*Math.PI)*(60+hash(i,9)*80);
      ctx.save();ctx.globalAlpha=1-window01(since,.55,1.2);ctx.translate(gx,gy);ctx.rotate(a+k*7);ctx.fillStyle='#4b4260';ctx.strokeStyle='#d9d2ea';ctx.lineWidth=1.6;const r=5+hash(i,11)*7;ctx.beginPath();for(let j=0;j<6;j++){const b=j*Math.PI/3,rr=r*(j%2?.72:1.1);j?ctx.lineTo(Math.cos(b)*rr,Math.sin(b)*rr):ctx.moveTo(Math.cos(b)*rr,Math.sin(b)*rr);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
    for(const p of (skill.targets||[]).slice(0,24)){const k=easeOut(window01(since,.04,.5)),a=1-window01(since,.3,.9);if(a<=0)continue;
      this.glow('glow','#ffcf8a',p.x,p.y-18,80*(.5+k*.6),a*.8);
      ctx.save();ctx.globalAlpha=a;ctx.strokeStyle='#fff0d8';ctx.lineWidth=3*a+1;ctx.beginPath();ctx.ellipse(p.x,p.y+4,10+k*30,4+k*12,0,0,Math.PI*2);ctx.stroke();
      if(!reduced)for(let i=0;i<5;i++){const b=hash(p.x+i,3)*Math.PI*2;ctx.fillStyle=i%2?'#4b4260':'#d9d2ea';ctx.beginPath();ctx.arc(p.x+Math.cos(b)*k*34,p.y-18+Math.sin(b)*k*22,2.6,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
  }
  drawSkillField(skill){
    if(!skill||skill.life<=0)return;
    // Their signatures are drawn from their own events (hand over the pack, each cocoon hatching); the cast beat stays.
    if(skill.kind==='deathhand'||skill.kind==='miracle_eclose'){this.drawCast(skill);return;}
    if(drawCompanionSkill(this,skill))return;
    this.drawCast(skill);
    const ctx=this.ctx,h=HERO[skill.hero],fx=FX_PROFILES[skill.hero],age=skill.total-skill.life;
    const t=Math.max(0,Math.min(1,1-skill.life/skill.total)),fade=Math.min(1,t*12)*(1-t),motion=this.reduced?.28:t;
    const layout=ultimateLayout(skill.kind),ur=isUR(skill.hero);
    const k=ur?1:RARITY_SCALE[h.rarity]||1;
    // Directed ultimates show the caster's emblem before the strike; non-UR casts get a smaller one by rarity.
    if(dedicated(skill.hero)&&(skill.locked||layout==='target'||layout==='pull')){const pop=easeBack(window01(age,.04,.38)),a=1-window01(age,.7,1.3),e=ur?300:260*k;this.glow('rays',h.color,skill.origin.x,skill.origin.y-40,e*1.27*pop,a*.6,age*.6);this.ultimate(skill.hero,skill.origin.x,skill.origin.y-44,e*pop,e*pop,0,a*.95);}
    if(skill.locked||skill.kind==='trauma')return;
    if(skill.kind==='bigshow'){this.drawBigShow(skill,age);return;}
    if(ur&&layout!=='support')this.drawStarRain(skill,age);
    if(layout==='target'||layout==='pull'){this.drawDirectedSkill(skill,t,fade,layout);return;}
    if(this.signature(skill,age,fade))return;
    if(dedicated(skill.hero)){
      if(layout==='support'){
        // Support: the emblem bursts out of the caster, then a soft wave rolls over the allies.
        const pop=easeBack(window01(age,.05,.4)),a=1-window01(age,.75,1.5),size=(ur?380:320*k)*pop;
        this.ultimate(skill.hero,skill.origin.x,skill.origin.y-40,size,size,0,a);
        for(const p of (skill.targets||[]).slice(0,10))this.ultimate(skill.hero,p.x,p.y+18,70,32,0,a*.4);
      }else{
        const pop=easeBack(window01(age,.08,.45)),a=1-window01(age,.85,1.5),size=(skill.hero==='frost_witch'?500:470)*(ur?1.08:k)*pop;
        this.glow('rays',h.color,360,405,size*1.25,a*.55,age*.4);
        this.ultimate(skill.hero,360,405,size,size,skill.hero==='time_ruler'?motion*.3:(1-pop)*-.25,a*.75);
        for(const [x,y] of [[42,345],[678,485]])this.ultimate(skill.hero,x,y,112*k,112*k,0,a*.72);
      }
      return;
    }
    if(fx.atlas==='effects-trio'){
      // Authored seals sit outside the board; never cover faces or enemy HP.
      for(const [x,y] of [[38,345],[682,485]])this.atlasStamp('effects-trio',fx.frame+3,3,2,x,y,80,80,0,fade*(this.reduced?.45:.75));
      return;
    }
    // Field-scale identity is independent of target count. Everything here is
    // UNDER units, HP bars and danger cells; the centre never flashes white.
    ctx.save();ctx.globalAlpha=fade*(this.reduced?.48:1);
    // The same gradient every frame for a hero colour: build it once and reuse it.
    if(!this.washes)this.washes=new Map();let wash=this.washes.get(h.color);
    if(!wash){wash=ctx.createRadialGradient(360,415,155,360,415,520);wash.addColorStop(0,h.color+'00');wash.addColorStop(.58,h.color+'12');wash.addColorStop(1,h.color+'66');this.washes.set(h.color,wash);}
    ctx.fillStyle=wash;ctx.fillRect(0,0,720,780);
    ctx.save();ctx.translate(360,415);ctx.globalAlpha*=.5;ctx.strokeStyle=h.color;ctx.lineWidth=3;
    const arc=(r,start,end,width=3)=>{ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.stroke();};
    if(['crescent','daggers','leap','claws'].includes(fx.motion)){
      const sweeps=fx.motion==='daggers'?3:fx.motion==='claws'?3:2;
      for(let i=0;i<sweeps;i++){
        ctx.save();ctx.rotate((fx.motion==='leap'?-.75:-.4)+i*.8);
        ctx.strokeStyle=i%2?'#f8e5ff':h.color;
        ctx.lineWidth=8-i*2;ctx.beginPath();ctx.ellipse(0,0,300+motion*80,130+i*55,-motion*.25,Math.PI*.1,Math.PI*.9);ctx.stroke();ctx.restore();
      }
    }else if(['snow','icicles','glass'].includes(fx.motion)){
      const count=fx.motion==='snow'?6:fx.motion==='icicles'?8:4;
      ctx.rotate(fx.motion==='glass'?Math.PI/4:0);
      for(let i=0;i<count;i++){ctx.rotate(Math.PI*2/count);const r=240+motion*70;stroke(ctx,[[r-35,-12],[r,0],[r-35,12]],h.color,3);if(fx.motion==='snow')stroke(ctx,[[r-20,-25],[r,0],[r-20,25]],h.color,2);else diamond(ctx,r,0,18,'#d8efff');}
    }else if(['dragon','embers'].includes(fx.motion)){
      for(let i=0;i<5;i++){const x=-300+i*150,y=160-motion*200+(i%2)*40;ctx.save();ctx.translate(x,y);ctx.rotate(-.4);star(ctx,22+(i%3)*8,i%2?'#ffd8a0':h.color);ctx.restore();}
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*330,220);ctx.bezierCurveTo(side*250,-50,side*380,-140,side*170,-230);ctx.lineWidth=fx.motion==='dragon'?14:5;ctx.stroke();}
    }else if(fx.motion==='bolt'||fx.motion==='needle'){
      for(const side of [-1,1]){
        if(fx.motion==='bolt')stroke(ctx,[[side*300,-285],[side*260,-100],[side*320,-125],[side*265,165],[side*300,280]],h.color,5);
        else {stroke(ctx,[[side*240,-210],[side*285,-210],[side*285,-155]],h.color,4);stroke(ctx,[[side*240,210],[side*285,210],[side*285,155]],h.color,4);}
      }
      if(fx.motion==='needle'){arc(230,0,Math.PI*2,2);stroke(ctx,[[-255,0],[-205,0]],h.color,3);stroke(ctx,[[205,0],[255,0]],h.color,3);}
    }else if(['ribbon','song','planet','clock'].includes(fx.motion)){
      ctx.rotate(fx.motion==='clock'?0:motion*.55);
      for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,270+i*35,fx.motion==='song'?145+i*30:200+i*22,i*.45,0,Math.PI*1.7);ctx.lineWidth=i?2:4;ctx.stroke();}
      if(fx.motion==='clock'){for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*Math.PI/6);stroke(ctx,[[0,-278],[0,-300]],h.color,i%3?2:4);ctx.restore();}stroke(ctx,[[0,-180],[0,0],[100,60]],h.color,4);}
    }else if(fx.motion==='quake'||fx.motion==='cross'){
      for(const side of [-1,1]){
        const d=180+motion*80;
        if(fx.motion==='quake')stroke(ctx,[[side*330,-240],[side*270,-110],[side*300,0],[side*260,170],[side*330,250]],h.color,5);
        else {stroke(ctx,[[side*d,-300],[side*d,300]],h.color,4);stroke(ctx,[[-320,side*d],[320,side*d]],h.color,4);}
      }
    }else{
      // Stars, rose petals, spores and silver comets keep their authored motif
      // in the corners instead of filling the board with particle noise.
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4+motion*.22,r=280+(i%2)*35,x=Math.cos(a)*r,y=Math.sin(a)*r;
        if(fx.motion==='spores')disk(ctx,x,y,7+i%3*3,h.color);
        else if(fx.motion==='petals'){ctx.save();ctx.translate(x,y);ctx.rotate(a+motion);ctx.fillStyle=h.color;ctx.beginPath();ctx.ellipse(0,0,15,6,0,0,Math.PI*2);ctx.fill();ctx.restore();}
        else {ctx.save();ctx.translate(x,y);ctx.rotate(a);star(ctx,i%2?8:14,h.color);if(fx.motion==='comets')stroke(ctx,[[-35,0],[-10,0]],h.color,3);ctx.restore();}
      }
    }
    ctx.restore();
    // One large SD emblem that pops in, plus two clear side seals: unlike a hit
    // stamp this reads even with one boss on the outer lane, or reduced motion.
    const pop=easeBack(window01(age,.05,.4));
    this.glow('rays',h.color,360,410,360*pop,fade*.5,age*.4);
    this.stamp(h.id,360,410,(330+motion*30)*pop,-.3,.42);
    this.stamp(h.id,39,350,104,Math.PI/2,.8);
    this.stamp(h.id,681,485,104,-Math.PI/2,.8);
    ctx.restore();
  }
  // Signature sequences for ultimates that need more than an emblem. Returns true when drawn.
  // Rumi's dream form (5★): sun, moon and star rise in turn over the board (below the cut-in band) and strike at 0.45 / 1 / 1.55 s,
  // then the three fold into one and imagination becomes real at 2.3 s. Hits come from the dreamPhase events.
  drawDream(skill,age){
    const ctx=this.ctx,r=this.reduced?.55:1,seed=skill.uid||1,X=360,Y=330;
    const show=(start,peak,end)=>Math.min(window01(age,start,peak),1-window01(age,end,end+.3));
    const flash=(at,color,strength)=>{const a=1-window01(age,at,at+.35);if(age<at||a<=0)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a*strength*r;ctx.fillStyle=color;ctx.fillRect(0,0,720,780);ctx.restore();};
    // Sun: a golden disc with turning rays.
    const sun=show(0,.25,.55);
    if(sun>0){const pop=easeBack(window01(age,0,.3));this.glow('rays','#ffd36a',X,Y,320*pop,sun*.85*r,age*.9);this.glow('glow','#ffb347',X,Y,210*pop,sun*.9);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=sun;disk(ctx,X,Y,44*pop,'#fff2bf');ctx.restore();}
    flash(.45,'#ffcf6a',.22);
    // Moon: a pale crescent glides up into the same sky.
    const moon=show(.4,.65,1.1);
    if(moon>0){const rise=easeOut(window01(age,.4,.7));this.glow('glow','#9fc4ff',X,Y,220,moon*.8);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=moon;ctx.translate(X-40*(1-rise),Y+30*(1-rise));ctx.rotate(-.35+rise*.2);ctx.drawImage(this.sprite('crescent','#bcd6ff'),-96,-96,192,192);ctx.restore();}
    if(age>=1&&age<1.4){const s=window01(age,1,1.4);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-s)*.8*r;ctx.strokeStyle='#dbe8ff';ctx.lineWidth=14*(1-s)+2;ctx.beginPath();ctx.ellipse(X,430,120+s*420,60+s*220,0,Math.PI*1.05,Math.PI*1.95);ctx.stroke();ctx.restore();}
    flash(1,'#a9c8ff',.16);
    // Star: a great star turns overhead while small stars fall onto the field.
    const big=show(.95,1.2,1.65);
    if(big>0){const pop=easeBack(window01(age,.95,1.25));this.glow('glow','#fff1c4',X,Y,200*pop,big*.8);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=big;ctx.translate(X,Y);ctx.rotate(age*1.6);star(ctx,70*pop,'#fff8e0');ctx.restore();}
    if(age>1.05&&age<1.75&&!this.reduced){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<12;i++){const t=window01(age,1.05+hash(seed,i)*.25,1.4+hash(seed,i)*.25);if(t<=0||t>=1)continue;const x=80+hash(seed,i+20)*560,y=Y+t*(260+hash(seed,i+40)*300);ctx.globalAlpha=1-t*.6;stroke(ctx,[[x-26*t,y-60],[x,y]],'#fff4c8',3);ctx.save();ctx.translate(x,y);ctx.rotate(t*4);star(ctx,9,'#ffffff');ctx.restore();}ctx.restore();}
    flash(1.55,'#fff1c4',.18);
    // Dream: the three symbols circle in and fold into one, then a pastel bloom makes the imagined real.
    const fold=window01(age,1.55,2.3);
    if(fold>0&&fold<1){const radius=230*(1-easeOut(fold)),a=Math.min(1,fold*4);[['#ffd36a',0],['#bcd6ff',2.09],['#fff4c8',4.19]].forEach(([c,o],i)=>{const ang=o+fold*5,x=X+Math.cos(ang)*radius,y=400+Math.sin(ang)*radius*.6;this.glow('glow',c,x,y,110,a*.9);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;ctx.translate(x,y);if(i===1)ctx.drawImage(this.sprite('crescent',c),-28,-28,56,56);else if(i===2)star(ctx,22,'#ffffff');else disk(ctx,0,0,16,'#fff2bf');ctx.restore();});}
    const bloom=window01(age,2.3,2.9);
    if(bloom>0&&bloom<1){const pop=easeBack(window01(age,2.3,2.55)),fade=1-bloom;this.glow('rays','#ffc4ec',X,400,560*pop,fade*.6*r,age*.4);this.ultimate('rumi',X,400,420*pop,420*pop,0,fade*.85);
      ctx.save();ctx.globalCompositeOperation='lighter';['#ffb8e6','#c9b8ff','#b8f0e6','#ffe9a8'].forEach((c,i)=>{const s=Math.max(0,bloom-i*.08);if(s<=0)return;ctx.globalAlpha=(1-s)*.75*r;ctx.strokeStyle=c;ctx.lineWidth=10*(1-s)+2;ctx.beginPath();ctx.ellipse(X,410,40+s*520,20+s*300,0,0,Math.PI*2);ctx.stroke();});
      if(!this.reduced)for(let i=0;i<18;i++){const x=60+hash(seed,i+60)*600,y=700-bloom*(260+hash(seed,i+80)*240);ctx.globalAlpha=Math.sin(bloom*Math.PI)*.9;disk(ctx,x,y,3+hash(seed,i)*4,i%2?'#ffe6f6':'#e6f4ff');}ctx.restore();}
    flash(2.3,'#ffd6f0',.24);
  }
  signature(skill,age,fade){
    const ctx=this.ctx,h=HERO[skill.hero],targets=skill.targets||[],seed=skill.uid||skill.rank||1;
    if(skill.kind==='dream'){this.drawDream(skill,age);return true;}
    if(skill.hero==='cinderella'){
      // Midnight: a huge glass clock swings in, chimes twelve, then shatters into falling glass.
      const pop=easeBack(window01(age,0,.38)),chime=window01(age,.5,.75),shatter=window01(age,.72,1.45);
      const size=600*pop,whole=1-shatter;
      this.glow('rays','#ff9ad8',360,400,size*1.3,(1-shatter)*.6,age*.5);
      this.centerArt('cinderella',360,400,size*(1+chime*.06),(1-pop)*-.5,whole*.85);
      if(chime>0&&chime<1){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-chime;ctx.strokeStyle='#ffe3f5';ctx.lineWidth=8*(1-chime)+2;ctx.beginPath();ctx.arc(360,400,200+chime*240,0,Math.PI*2);ctx.stroke();
        for(let i=0;i<12;i++){const a=i*Math.PI/6-Math.PI/2;diamond(ctx,360+Math.cos(a)*(250+chime*60),400+Math.sin(a)*(250+chime*60),12*(1-chime)+4,'#fff2fb');}ctx.restore();}
      if(shatter>0){ctx.save();ctx.globalCompositeOperation='lighter';
        for(let i=0;i<30;i++){const a=hash(seed,i)*Math.PI*2,v=160+hash(seed,i+31)*280,x=360+Math.cos(a)*v*shatter,y=400+Math.sin(a)*v*shatter+shatter*shatter*260;
          ctx.globalAlpha=(1-shatter)*.95;ctx.save();ctx.translate(x,y);ctx.rotate(a+shatter*4);diamond(ctx,0,0,10+hash(seed,i+62)*14,i%3?'#ffc8ec':'#ffffff');ctx.restore();}
        ctx.restore();}
      return true;
    }
    if(skill.hero==='zeke'){
      // Dragon oath: the crest rises, one giant flame slash crosses the board, then pillars erupt under enemies.
      const rise=easeBack(window01(age,0,.35)),out=1-window01(age,.95,1.5),slash=window01(age,.18,.62);
      ctx.save();ctx.globalAlpha=out*.5*(this.reduced?.5:1);const tint=this.zekeWash||(this.zekeWash=(()=>{const g=ctx.createRadialGradient(360,400,120,360,400,560);g.addColorStop(0,'#ff6a2000');g.addColorStop(1,'#ff3a1a88');return g;})());ctx.fillStyle=tint;ctx.fillRect(0,0,720,780);ctx.restore();
      this.glow('rays','#ff8a3a',360,380,640*rise,out*.6,age*.5);
      this.centerArt('zeke',360,380-30*rise,560*rise,0,out*.88);
      if(slash>0&&slash<1){const x=-120+slash*960,y=120+slash*560;this.ultimate('zeke',x,y,620,330,.62,Math.sin(slash*Math.PI)*.95);this.glow('glow','#ff7a2a',x,y,420,Math.sin(slash*Math.PI)*.7);}
      for(const [i,p] of targets.slice(0,14).entries()){const b=window01(age,.42+i*.035,.95+i*.035);if(b<=0||b>=1)continue;const tall=Math.sin(b*Math.PI);
        ctx.save();ctx.translate(p.x,p.y+6);ctx.rotate(-Math.PI/2);this.atlasStamp('zeke-cone',0,1,1,70*tall,0,170*tall,120,0,tall*.9,'lighter');ctx.restore();this.glow('glow','#ffb24a',p.x,p.y-10,120*tall,tall*.8);}
      return true;
    }
    if(skill.hero==='phantom'){
      // Endless night: the mask looms at the centre, the board darkens and claws rake across.
      const pop=easeBack(window01(age,0,.4)),out=1-window01(age,.9,1.5);
      ctx.save();ctx.globalAlpha=out*.55;const dark=this.phantomWash||(this.phantomWash=(()=>{const g=ctx.createRadialGradient(360,400,90,360,400,540);g.addColorStop(0,'#2a0a4a00');g.addColorStop(1,'#1a0630ee');return g;})());ctx.fillStyle=dark;ctx.fillRect(0,0,720,780);ctx.restore();
      this.glow('rays','#b77bff',360,400,620*pop,out*.5,-age*.5);
      this.centerArt('phantom',360,400,560*pop,(1-pop)*.4,out*.88);
      // Three claw rakes sweep across the board, each a short trail of the phantom's own claw stamp.
      for(let i=0;i<3;i++){const c=window01(age,.22+i*.12,.62+i*.12);if(c<=0||c>=1)continue;const y0=170+i*200,dir=i%2?-1:1;
        for(let j=0;j<5;j++){const k=Math.max(0,c-j*.06),x=dir>0?40+k*640:680-k*640,y=y0+Math.sin(k*Math.PI)*70*dir;this.stamp('phantom',x,y,150-j*18,dir>0?0:Math.PI,Math.sin(c*Math.PI)*(1-j*.18));}
        this.glow('glow',i%2?'#7df0d8':'#b77bff',dir>0?40+c*640:680-c*640,y0+Math.sin(c*Math.PI)*70*dir,200,Math.sin(c*Math.PI)*.6);}
      for(const [i,p] of targets.slice(0,14).entries()){const b=window01(age,.45+i*.03,1+i*.03);if(b<=0||b>=1)continue;this.stamp('phantom',p.x,p.y-20,90+b*30,0,Math.sin(b*Math.PI)*.85);}
      return true;
    }
    if(skill.hero==='santa'){
      // A present falls onto the cell where the new companion appears and bursts into ribbons.
      const pop=easeBack(window01(age,0,.35)),out=1-window01(age,.95,1.6);
      this.ultimate('santa',skill.origin.x,skill.origin.y-50,320*pop,320*pop,0,out*.95);
      const cell=skill.gift>=0?cellPoint(skill.gift):null;
      if(cell){const fall=window01(age,.08,.42),land=window01(age,.42,1.2);
        if(fall<1){const y=-80+(cell.y-10+80)*fall*fall;this.ultimate('santa',cell.x,y,140,140,Math.sin(age*14)*.12,1);this.glow('glow','#ffd36a',cell.x,y,180,.6);}
        else{this.glow('rays','#ffd36a',cell.x,cell.y-20,420*easeOut(land),(1-land)*.9,land);this.glow('glow','#fff1c2',cell.x,cell.y-20,260*(1-land*.5),(1-land)*.9);this.ultimate('santa',cell.x,cell.y-26-land*40,150*(1+land*.4),150*(1+land*.4),0,(1-land)*.9);ctx.save();
          for(let i=0;i<26;i++){const a=hash(seed,i)*Math.PI*2,v=90+hash(seed,i+30)*170,x=cell.x+Math.cos(a)*v*land,y=cell.y-20+Math.sin(a)*v*land+land*land*140;ctx.globalAlpha=1-land;ctx.fillStyle=['#ff4a5a','#3fbf6a','#ffd36a','#ffffff'][i%4];ctx.save();ctx.translate(x,y);ctx.rotate(a+land*8);ctx.fillRect(-9,-4,18,8);ctx.restore();}
          ctx.restore();ctx.save();ctx.globalAlpha=1-land;ctx.strokeStyle='#ffe7a6';ctx.lineWidth=5*(1-land)+1;ctx.beginPath();ctx.ellipse(cell.x,cell.y+22,40+land*70,14+land*24,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      }
      return true;
    }
    if(skill.hero==='silver_rabbit'){
      // Silver march: the emblem bursts from the caster and six comets streak across the board.
      const o=skill.origin,pop=easeBack(window01(age,0,.35)),out=1-window01(age,.9,1.5);
      this.ultimate('silver_rabbit',o.x,o.y-40,330*pop,330*pop,0,out);
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
      for(let i=0;i<6;i++){const c=window01(age,.12+i*.05,.75+i*.05);if(c<=0||c>=1)continue;const a=-Math.PI/2+(i-2.5)*.42,len=560*easeOut(c),x=o.x+Math.cos(a)*len,y=o.y-30+Math.sin(a)*len*.9;
        const g=ctx.createLinearGradient(o.x,o.y-30,x,y);g.addColorStop(0,'#bfe8ff00');g.addColorStop(1,'#f2fbffcc');ctx.globalAlpha=1-c;ctx.strokeStyle=g;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(o.x+Math.cos(a)*len*.45,o.y-30+Math.sin(a)*len*.4);ctx.lineTo(x,y);ctx.stroke();ctx.save();ctx.translate(x,y);star(ctx,12,'#ffffff');ctx.restore();}
      ctx.restore();
      for(const p of targets.slice(0,10))this.ultimate('silver_rabbit',p.x,p.y+18,70,32,0,out*.45);
      return true;
    }
    return false;
  }
  // Board edge glow for global auras (one ring per active aura, newest outside) and a
  // strong mark on units that hold a partial aura. Durations are on the HUD chips.
  drawAuraFrame(s){
    const ctx=this.ctx,auras=Object.entries(ACTIVE_SKILLS).filter(([id,key])=>GLOBAL_AURAS.includes(key)&&s.buffs[key]>0).slice(0,3);if(!auras.length)return;
    ctx.save();ctx.globalCompositeOperation='lighter';
    auras.forEach(([id,key],i)=>{const h=HERO[id],active=activeSkill(s,id),ending=active&&active.remaining<2?.5+Math.sin(this.clock*14)*.5:1,pulse=(.55+Math.sin(this.clock*3+i)*.15)*ending,inset=4+i*9;
      ctx.globalAlpha=pulse*.35;ctx.strokeStyle=h.color;ctx.lineWidth=14;ctx.strokeRect(inset,inset,720-inset*2,780-inset*2);
      ctx.globalAlpha=pulse*.9;ctx.lineWidth=2.5;ctx.strokeRect(inset,inset,720-inset*2,780-inset*2);});
    ctx.restore();
  }
  drawDirectedSkill(skill,t,fade,layout){
    const ctx=this.ctx,points=skill.targets||[],h=HERO[skill.hero];
    if(layout==='pull'){
      if(!points.length)return;const centre=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});
      const big=isUR(skill.hero)?1.7:1;if(big>1)this.glow('rays',h.color,centre.x,centre.y-18,420,fade*.55,t);
      this.ultimate(skill.hero,centre.x,centre.y-18,230*big,210*big,t*.45,fade*.8);
      for(const p of points){const from=p.from||p,to=this.point(p.uid,p),travel=Math.min(1,t*3),x=from.x+(to.x-from.x)*travel,y=from.y+(to.y-from.y)*travel;
        ctx.save();ctx.globalAlpha=fade*.6;ctx.strokeStyle=h.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(from.x,from.y-20);ctx.quadraticCurveTo((from.x+to.x)/2+25,(from.y+to.y)/2-45,to.x,to.y-20);ctx.stroke();ctx.restore();
        this.stamp(skill.hero,x,y-20,42,Math.atan2(to.y-from.y,to.x-from.x),fade*.8);
      }return;
    }
    let from=skill.origin;
    for(let i=0;i<points.length;i++){
      const p=this.point(points[i].uid,points[i]),angle=Math.atan2(p.y-from.y,p.x-from.x);
      if(skill.kind==='thunder'){
        ctx.save();ctx.globalAlpha=fade*.9;const mid={x:(from.x+p.x)/2+12,y:(from.y+p.y)/2-24};stroke(ctx,[[from.x,from.y-20],[mid.x,mid.y],[p.x,p.y-20]],h.color,5);stroke(ctx,[[from.x,from.y-20],[mid.x,mid.y],[p.x,p.y-20]],'#fff8cf',1.6);ctx.restore();
        this.stamp(skill.hero,p.x,p.y-20,96,Math.PI/2,fade);from=p;
      }else if(skill.kind==='flurry'){
        const phase=Math.min(1,Math.max(0,t*2.4-i*.055)),x=from.x+(p.x-from.x)*phase,y=from.y+(p.y-from.y)*phase-Math.sin(phase*Math.PI)*50;
        ctx.save();ctx.globalAlpha=fade*.48;ctx.strokeStyle=h.color;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(from.x,from.y-18);ctx.quadraticCurveTo((from.x+p.x)/2,(from.y+p.y)/2-70,p.x,p.y-18);ctx.stroke();ctx.restore();
        this.stamp('night_rabbit',x,y-18,100,angle,fade);from=p;
      }else this.ultimate(skill.hero,p.x,p.y-28,skill.hero==='aurora'?420:165,skill.hero==='aurora'?420:165,angle,fade*.8);
      ctx.save();ctx.globalAlpha=fade*.65;ctx.strokeStyle=h.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y+8,27,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
  drawPersistent(s){
    // Toffee Apple bombs wait on the path as glossy red apples with a lit fuse.
    for(const b of s.bombs||[]){
      if(drawCompanionBomb(this,b))continue;
      const p=pathPoint(b.progress),ctx=this.ctx,pulse=.5+Math.sin(this.clock*4+b.uid)*.5,x=p.x,y=p.y-12,r=12+pulse*1.5;
      if(this.art.images['effects-applebomb']){
        // Painted toffee-apple bomb: it breathes, its fuse spits sparks, and a ground ring marks where it will go off.
        const bob=this.reduced?0:Math.sin(this.clock*3+b.uid)*2,size=82+pulse*5;
        ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#0b1220';ctx.beginPath();ctx.ellipse(x,p.y+6,24,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
        this.glow('glow','#ff5a46',x,y-14,110+pulse*26,.4);
        this.atlasStamp('effects-applebomb',0,2,1,x,y-24+bob,size,size,0,.86,'source-over');
        this.atlasStamp('effects-applebomb',0,2,1,x,y-24+bob,size,size,0,.3+pulse*.18,'screen');
        ctx.save();ctx.strokeStyle='#ffb06a';ctx.globalAlpha=.55+pulse*.25;ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.lineDashOffset=-this.clock*12;ctx.beginPath();ctx.ellipse(x,p.y+6,APPLE_TRIGGER*.45,APPLE_TRIGGER*.16,0,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(!this.reduced)for(let i=0;i<3;i++){const k=(this.clock*1.6+i/3+b.uid*.21)%1;ctx.save();ctx.globalAlpha=(1-k)*.95;ctx.globalCompositeOperation='lighter';disk(ctx,x-1+Math.sin(k*9+i)*7,y-70-k*30,2.4*(1-k)+.6,i%2?'#ffd27a':'#fff1b8');ctx.restore();}
        continue;
      }
      this.glow('glow','#ff5a46',x,y,64+pulse*26,.45);
      ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#1a0f3c';
      const g=ctx.createRadialGradient(x-r*.35,y-r*.4,1,x,y,r*1.15);g.addColorStop(0,'#ff8f78');g.addColorStop(.55,'#d8362b');g.addColorStop(1,'#8f1d1d');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffffb0';ctx.beginPath();ctx.ellipse(x-r*.38,y-r*.42,r*.24,r*.14,-.6,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#5a3418';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+3,y-r-8);ctx.stroke();
      ctx.fillStyle='#7fcf6a';ctx.beginPath();ctx.ellipse(x+8,y-r-5,5,2.6,-.5,0,Math.PI*2);ctx.fill();
      ctx.restore();
      this.glow('glow','#ffe39a',x+3,y-r-9,16+pulse*10,.8);
    }
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;const own=activeSkill(s,u.hero),p=cellPoint(i),ctx=this.ctx;
      const partial=own&&PARTIAL_AURAS.includes(own.key)&&(own.key!=='midnight'||topCinderella(s)?.uid===u.uid);
      if(partial){
        const h=HERO[u.hero],pulse=.75+Math.sin(this.clock*5+u.uid)*.2;
        this.glow('glow',h.color,p.x,p.y-6,150*pulse,.55);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=h.color;ctx.lineWidth=4;ctx.globalAlpha=.9;ctx.beginPath();ctx.ellipse(p.x,p.y+24,36,12,0,-Math.PI/2,-Math.PI/2+Math.PI*2*own.remaining/own.total);ctx.stroke();ctx.restore();
        if(!this.reduced)for(let j=0;j<3;j++){const k=(this.clock*.8+j/3+u.uid*.13)%1;ctx.save();ctx.globalAlpha=(1-k)*.8;ctx.translate(p.x+Math.sin(j*2.1+u.uid)*22,p.y+20-k*70);star(ctx,4,h.color);ctx.restore();}
        continue;
      }
      let owner=own?u.hero:null,active=own;
      if(!active){owner=Object.keys(ACTIVE_SKILLS).find(id=>!PARTIAL_AURAS.includes(ACTIVE_SKILLS[id])&&s.buffs[ACTIVE_SKILLS[id]]>0&&(id!=='harmonious'||neighbors(i).some(n=>s.board[n]?.hero==='harmonious')));active=owner?activeSkill(s,owner):null;}
      if(!active||PARTIAL_AURAS.includes(active.key))continue;
      this.ultimate(owner,p.x,p.y+22,70,26,0,.16+Math.sin(this.clock*4+u.uid)*.05);
    }
  }
  drawZones(s){
    const ctx=this.ctx;for(const z of s.zones){ctx.save();const fade=Math.min(1,z.life*2),pulse=.65+Math.sin(this.clock*4+z.uid)*.1;ctx.globalAlpha=fade;
      // Star Orbit relic: its own small star-ring decal (the ring is the real radius), nothing else.
      // Star Orbit relic (pass 18): a small round patch of the star sea, seen from above, its slow golden orbit riding the
      // rim. Both painted rims sit on the real radius (orbit-sea: 0 pool, 1 ring); the pool turns slowly like a galaxy.
      if(z.orbit){const size=2*z.radius/.78,open=Math.min(1,(z.total-z.life)*6);
        this.atlasStamp('orbit-sea',0,2,1,z.x,z.y,size*(.8+.2*open),size*(.8+.2*open),this.reduced?0:this.clock*.35+z.uid,fade*.62,'source-over');
        this.atlasStamp('orbit-sea',1,2,1,z.x,z.y,size,size,this.reduced?0:-this.clock*1.1-z.uid,fade*(.7+pulse*.2),'source-over');ctx.restore();continue;}
      if(z.hero==='cure_master'){
        // Lemonade fizz: a pale lemon pool with rising bubbles, three lemon slices and two hearts circling. The edge is the real radius.
        const R=z.radius,t=this.clock;
        const g=ctx.createRadialGradient(z.x,z.y,R*.1,z.x,z.y,R);g.addColorStop(0,'#fff6c255');g.addColorStop(1,'#ffe06a26');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(z.x,z.y,R,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ff9fcbaa';ctx.lineWidth=1.8;ctx.setLineDash([5,6]);ctx.lineDashOffset=-t*10;ctx.stroke();ctx.setLineDash([]);
        if(!this.reduced){
          for(let i=0;i<8;i++){const ph=(t*.45+i*.29+z.uid*.17)%1,x=z.x+Math.cos(i*2.4+z.uid)*R*.62,y=z.y+R*.35-ph*R*.8,r=2+(i%3)*1.1;ctx.globalAlpha=fade*(1-ph)*.9;ctx.strokeStyle='#ffffffdd';ctx.fillStyle='#fffbd088';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();}
          ctx.globalAlpha=fade;
          for(let i=0;i<3;i++){const a=t*.8+i*Math.PI*2/3,x=z.x+Math.cos(a)*R*.74,y=z.y+Math.sin(a)*R*.74;ctx.fillStyle='#ffe55a';ctx.strokeStyle='#fff7b0';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(x,y,5.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#e8b81c';ctx.lineWidth=.8;for(let j=0;j<3;j++){const b=j*Math.PI/3+a;ctx.beginPath();ctx.moveTo(x-Math.cos(b)*4.6,y-Math.sin(b)*4.6);ctx.lineTo(x+Math.cos(b)*4.6,y+Math.sin(b)*4.6);ctx.stroke();}}
          for(let i=0;i<2;i++){const a=-t*.6+i*Math.PI,x=z.x+Math.cos(a)*R*.42,y=z.y+Math.sin(a)*R*.42;heart(ctx,x,y,3.8,i?'#ff8fc1':'#ffd3ec');}
        }
        ctx.restore();continue;
      }
      // Edge is the real collision radius. The painted centre is deliberately quieter.
      ctx.fillStyle=HERO[z.hero].color+'12';ctx.strokeStyle=HERO[z.hero].color+'77';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(z.x,z.y,z.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      this.stamp(z.hero,z.x,z.y,z.radius*1.45,0,pulse*.35);
      if(!this.reduced){ctx.translate(z.x,z.y);ctx.rotate(this.clock*.7);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;diamond(ctx,Math.cos(a)*z.radius*.8,Math.sin(a)*z.radius*.8,3,HERO[z.hero].color);}}
      ctx.restore();
    }
  }
  drawPersonalTraits(s,foreground=false){
    // Reuse each companion's painted combat emblem. The foot seal conveys a
    // live condition without painting over faces, ranks, enemies or HP bars.
    const ctx=this.ctx;
    if(foreground){this.drawPlague(s);this.drawSunBlooms(s);this.drawJokerWheels(s);this.drawAntropyBadges(s);}else{this.drawSunHalo(s);this.drawWards(s);}
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;
      if(!['lightning_sage','star_boy','aurora','zeke','time_ruler'].includes(u.hero))continue;
      const state=personalTrait(s,u,i),aged=state.key==='wave-age';
      if(!state.active&&!aged)continue;
      const strong=state.active&&state.damageMultiplier>=1,p=cellPoint(i),alpha=strong?.48:.17,pulse=this.reduced?1:1+Math.sin(this.clock*2+u.uid)*.06;
      if(foreground){
        // A small, dark status backing separates the painted emblem from
        // tile trim and rank stars. It sits beside the feet, above shadows.
        ctx.save();ctx.globalAlpha=strong?.8:.5;disk(ctx,p.x+28,p.y+21,16,'#0b1e2b');
        ctx.strokeStyle=HERO[u.hero].color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x+28,p.y+21,16,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(u.hero==='aurora')this.atlasStamp('effects-trio',5,3,2,p.x+28,p.y+21,30,38,0,.85);
        else this.stamp(u.hero,p.x+28,p.y+21,strong?30:24,0,strong?.85:.4);
        continue;
      }
      ctx.save();ctx.globalAlpha=alpha*pulse;ctx.strokeStyle=HERO[u.hero].color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.ellipse(p.x,p.y+31,28,9,0,Math.PI*.13,Math.PI*1.87);ctx.stroke();ctx.restore();
      this.stamp(u.hero,p.x,p.y+31,56,0,alpha);
      if(aged){
        const phase=Math.min(2,state.age||0);ctx.save();
        for(let j=0;j<3;j++)disk(ctx,p.x-7+j*7,p.y+39,3,j===phase?HERO[u.hero].color:'#d4dfdf44');
        ctx.restore();
      }
    }
  }
  // Sunflower: one shared stack shown as a flower that blooms ring by ring. Ring radii keep the 1:2:3 ratio of the
  // real 30/60/90 burst, so a full bloom reads as "the burst is at its widest".
  drawSunBlooms(s){
    const ctx=this.ctx,n=Math.min(3,s.sunlight||0),since=this.clock-(this.bloomAt??-9),pop=since<.6?easeBack(since/.6):1;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u||u.hero!=='sunflower')continue;
      const p=cellPoint(i),cx=p.x+28,cy=p.y+21,ready=n>=3,pulse=ready&&!this.reduced?.5+Math.sin(this.clock*3+u.uid)*.5:0;
      if(ready)this.glow('glow','#ffd45a',cx,cy,58+pulse*14,.5+pulse*.15);
      ctx.save();ctx.globalAlpha=.85;disk(ctx,cx,cy,17,'#0b1e2b');ctx.globalAlpha=ready?1:.75;ctx.strokeStyle=ready?'#ffe27a':'#c99a3a';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(cx,cy,17,0,Math.PI*2);ctx.stroke();ctx.restore();
      for(let k=3;k>=1;k--){
        const R=k*4.8+.8,count=k===1?6:k===2?9:12,len=2.5+k*.7,lit=k<=n,grow=k===n?pop:1,r=R*(lit?grow:1);
        if(!lit){ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle='#e8cf8a';ctx.lineWidth=1;ctx.setLineDash([1.6,2.8]);ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();ctx.restore();continue;}
        ctx.save();ctx.translate(cx,cy);ctx.rotate(k*.35);
        for(let j=0;j<count;j++){ctx.save();ctx.rotate(j/count*Math.PI*2);ctx.translate(r,0);ctx.fillStyle=k===3?'#ffd23c':k===2?'#ffc92e':'#ffe27a';ctx.strokeStyle='#a86b10';ctx.lineWidth=.6;ctx.beginPath();ctx.ellipse(0,0,len*grow,1.45,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
        ctx.restore();
      }
      disk(ctx,cx,cy,3.4,'#7a4a14');disk(ctx,cx,cy,1.5,n>0?'#b9c93a':'#6f7a2e');
    }
  }
  // Cure Master's aura: a faint heart bubble around every protected ally; while Lemonade runs the bubble turns lemon
  // gold and a ring counts the invincibility down. Antropy (always immune) shows a cracked-halo badge instead.
  drawWards(s){
    const ctx=this.ctx;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;
      const carer=u.hero==='cure_master'||neighbors(i).some(n=>{const a=s.board[n];return a&&a.hero==='cure_master'&&!a.cursed&&!(a.disabled>0);});
      const inv=u.invincible||0;if(!carer&&inv<=0)continue;
      const p=cellPoint(i),gold=inv>0,pulse=this.reduced?0:Math.sin(this.clock*2.2+u.uid)*.06;
      const g=ctx.createRadialGradient(p.x,p.y+4,10,p.x,p.y+4,40);g.addColorStop(0,gold?'#fff3a800':'#ffd3ec00');g.addColorStop(1,gold?'#ffe27a'+(inv>0?'55':'33'):'#ffb6da38');
      ctx.save();ctx.globalAlpha=.9+pulse;ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y+4,40,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=gold?'#ffe27acc':'#ffffff99';ctx.lineWidth=gold?2.4:1.6;ctx.stroke();
      ctx.strokeStyle='#ffffffcc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y+4,33,Math.PI*1.12,Math.PI*1.42);ctx.stroke();
      heart(ctx,p.x+27,p.y-22,3.6,gold?'#fff3a8':'#ffd3ec');
      if(gold){ctx.strokeStyle='#ffe27a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y+4,45,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,inv/3));ctx.stroke();}
      ctx.restore();
    }
  }
  drawAntropyBadges(s){
    const ctx=this.ctx;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u||u.hero!=='antropy')continue;
      const p=cellPoint(i),cx=p.x+28,cy=p.y+21;
      ctx.save();ctx.globalAlpha=.85;disk(ctx,cx,cy,17,'#0b1e2b');ctx.globalAlpha=.9;ctx.strokeStyle='#c9b4f0';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(cx,cy,17,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#efe6ff';ctx.lineWidth=2.2;for(const [a0,a1] of [[.3,2.0],[2.5,4.1],[4.6,5.9]]){ctx.beginPath();ctx.arc(cx,cy,10.5,a0,a1);ctx.stroke();}
      ctx.translate(cx,cy);star(ctx,5.2,'#ffffff');ctx.restore();
    }
  }
  // At full stack the ground under the sunflower holds a soft warm halo (nothing else on the board changes).
  drawSunHalo(s){
    if((s.sunlight||0)<3)return;
    for(let i=0;i<s.board.length;i++){const u=s.board[i];if(!u||u.hero!=='sunflower')continue;const p=cellPoint(i);
      this.glow('glow','#ffd45a',p.x,p.y+28,96,.26+(this.reduced?0:Math.sin(this.clock*3+u.uid)*.06));}
  }
  // Joker: a small roulette. Five colours sit on a ring in cast order; the current one is always at the top and lit,
  // the others are dimmed. A cast spins the wheel and settles on the colour the roulette picked.
  drawJokerWheels(s){
    const ctx=this.ctx,names=['red','blue','green','white','black'],chaos=s.jokerColor==='chaos',idx=Math.max(0,names.indexOf(s.jokerColor||'red')),since=this.clock-(this.wheelAt??-9),offset=since<.7?(1-easeOut(since/.7))*Math.PI*2/5:0;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u||u.hero!=='joker')continue;
      const p=cellPoint(i),cx=p.x+28,cy=p.y+21,tint=chaos?JOKER_HEX.chaos:JOKER_HEX[names[idx]];
      ctx.save();ctx.globalAlpha=.85;disk(ctx,cx,cy,17,'#0b1e2b');ctx.globalAlpha=.8;ctx.strokeStyle='#e5b84a';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(cx,cy,17,0,Math.PI*2);ctx.stroke();ctx.restore();
      for(let j=0;j<5;j++){
        const a=-Math.PI/2+(j-idx)*Math.PI*2/5+offset,x=cx+Math.cos(a)*10.2,y=cy+Math.sin(a)*10.2,cur=chaos||j===idx;
        ctx.save();ctx.globalAlpha=cur?1:.42;ctx.translate(x,y);ctx.rotate(Math.PI/4);
        ctx.fillStyle=JOKER_HEX[names[j]];ctx.strokeStyle=names[j]==='black'?'#d9c8ff':'#1a1240';ctx.lineWidth=cur?1.5:1;const r=cur?4.6:3.2;ctx.fillRect(-r,-r,r*2,r*2);ctx.strokeRect(-r,-r,r*2,r*2);ctx.restore();
      }
      // pointer at the top
      if(!chaos){ctx.save();ctx.fillStyle='#ffe27a';ctx.beginPath();ctx.moveTo(cx,cy-15.5);ctx.lineTo(cx-2.6,cy-19.5);ctx.lineTo(cx+2.6,cy-19.5);ctx.closePath();ctx.fill();ctx.restore();}
      star(ctx,2.6,'#ffe9a0');
      ctx.save();ctx.translate(cx,cy);star(ctx,3.2,tint==='#241a36'?'#d9c8ff':tint);ctx.restore();
      if(chaos){ctx.save();ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#0b1e2b';ctx.fillStyle='#f1dcff';ctx.strokeText('카오스',cx,cy+29);ctx.fillText('카오스',cx,cy+29);ctx.restore();}
    }
  }
  drawPlague(s){
    if(!(s.buffs?.venom>0))return;
    const ctx=this.ctx,t=this.clock;
    for(const e of s.enemies){if(e.hp<=0)continue;const p=pathPoint(e.progress),sway=this.reduced?0:Math.sin(t*3+e.uid)*2;
      ctx.save();ctx.globalAlpha=.55+Math.min(.25,s.buffs.venom/20);ctx.strokeStyle='#7be04a';ctx.lineWidth=1.8;ctx.setLineDash([3,4]);ctx.lineDashOffset=-t*14;ctx.beginPath();ctx.ellipse(p.x,p.y+6,17+sway,6.5,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(!this.reduced)for(let i=0;i<2;i++){const k=(t*.7+i*.5+e.uid*.13)%1;ctx.globalAlpha=(1-k)*.8;disk(ctx,p.x+Math.sin(t*2+e.uid+i*3)*9,p.y+2-k*22,2,'#9be86a');}
      ctx.restore();}
  }
  drawStatus(e,p,size){
    const ctx=this.ctx,t=this.clock;
    if(e.frostTime>0)for(let i=0;i<e.frostStacks;i++)diamond(ctx,p.x-size*.3+i*7,p.y+10,3,'#b0f1ff');
    if(e.divine>0)for(let i=0;i<e.divine;i++)diamond(ctx,p.x+(i-1)*7,p.y-size*.78-17,3,'#ffeac0');
    if(e.rage>0)this.atlasStamp('effects-expansion',8,4,3,p.x,p.y-20,size*.85,size*.85,0,.38);
    if(e.shield>0)this.atlasStamp('effects-expansion',11,4,3,p.x,p.y-25,size,size,0,.4);
    if(e.burnTime>0){this.stamp('flame_sage',p.x-9,p.y-13,35+Math.sin(t*10+e.uid)*3,-Math.PI/2,.62);if(!this.reduced){disk(ctx,p.x+Math.sin(t*7+e.uid)*11,p.y-26-(t*19+e.uid*3)%17,1.7,'#ffd590');}}
    if(e.poisonTime>0){this.stamp('mushroom_king',p.x+size*.22,p.y-15,28,0,.55);}
    if(e.freeze>0){this.stamp('snow_rabbit',p.x,p.y-22,size*.63,t*.3,.75);}
    if(e.stun>0){ctx.save();ctx.globalAlpha=.85;for(let i=0;i<3;i++){const a=t*2+i*Math.PI*2/3;ctx.save();ctx.translate(p.x+Math.cos(a)*size*.28,p.y-size*.7+Math.sin(a)*3);star(ctx,3.5,'#ffe09a');ctx.restore();}ctx.restore();}
    if(e.stun<=0&&!(e.freeze>0)&&e.slowTime>0){ctx.save();ctx.strokeStyle='#a7e7f2aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+4,size*.36,size*.12,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(e.exposeTime>0){ctx.save();ctx.strokeStyle='#fff0b2';ctx.lineWidth=1.5;for(const side of [-1,1])stroke(ctx,[[p.x+side*size*.36,p.y-24],[p.x+side*size*.36,p.y-34],[p.x+side*size*.24,p.y-34]],'#fff0b2',1.5);ctx.restore();}
  }
  drawShot(shot,s){
    const ctx=this.ctx,h=HERO[shot.hero],f=FX_PROFILES[h.id],target=this.enemies.get(shot.target)?.enemy,p=this.point(shot.target,shot.to);
    if(shot.reflected&&shot.delay>0){if(target)this.atlasStamp('effects-trio',5,3,2,shot.from.x,shot.from.y-18,36,44,0,.35+.35*(1-shot.delay/.42));return;}
    const t=Math.max(0,Math.min(1,1-shot.life/shot.total)),to={x:p.x,y:p.y-18},angle=Math.atan2(to.y-shot.from.y,to.x-shot.from.x),size=4+Math.min(5,shot.rank)*.65;
    const arc=['icicles','dragon','planet'].includes(f.motion)?34:f.motion==='leap'?20:7;
    const x=shot.from.x+(to.x-shot.from.x)*t,y=shot.from.y+(to.y-shot.from.y)*t-Math.sin(t*Math.PI)*arc;
    if(drawNewShot(this,shot,s,{x,y,angle,t}))return;
    if(drawCompanionShot(this,shot,s,{x,y,angle,t,target:p}))return;
    if(h.id==='lightning_sage'){drawLightningShot(this,shot,s,p);return;}
    if(['zeke','guardian','ancient_dragon','behemoth'].includes(h.id))return;
    if(h.shape==='beam'&&f.motion==='candy'){
      const len=64+shot.rank*4;ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      const g=ctx.createLinearGradient(-len,0,12,0);g.addColorStop(0,'#e5604a00');g.addColorStop(.65,'#e5604acc');g.addColorStop(1,'#ffe3d6');
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-len,0);ctx.quadraticCurveTo(-len*.4,-7,8,-4.5);ctx.lineTo(15,0);ctx.lineTo(8,4.5);ctx.quadraticCurveTo(-len*.4,7,-len,0);ctx.fill();
      disk(ctx,11,0,4.5,'#fff7f0');disk(ctx,-len*.5,5+Math.sin(t*9)*2,2.2,'#e5604a');disk(ctx,-len*.25,-5-Math.sin(t*7)*2,1.8,'#ffb09a');ctx.restore();return;
    }
    if(h.shape==='beam'){
      const atlas=f.atlas||'effects',frame=shot.form==='trauma'?15:f.frame;
      if(shot.form==='trauma'){this.glow('glow','#ff5c8a',x,y,70,.55);this.atlasStamp('ultimates',15,4,4,x,y,88,88,angle+Math.PI/4,.95,'source-over');}
      else this.atlasStamp(atlas,frame,f.columns||7,f.rows||3,x,y,116+shot.rank*3,48,angle+(f.offset||0),.86);
      return;
    }
    if(f.atlas){this.stamp(h.id,x,y,48+Math.min(5,shot.rank)*3,angle,.95,shot.form);return;}
    if(f.motion==='quake'){ctx.save();ctx.strokeStyle=h.color+'b0';ctx.lineWidth=4*(1-t);ctx.beginPath();ctx.arc(shot.origin.x,shot.origin.y,h.range*t,0,Math.PI*2);ctx.stroke();ctx.restore();return;}
    if(f.motion==='cross'){ctx.save();ctx.globalAlpha=(1-t)*.55;stroke(ctx,[[shot.origin.x-h.range,shot.origin.y],[shot.origin.x+h.range,shot.origin.y]],h.color,7);stroke(ctx,[[shot.origin.x,shot.origin.y-h.range],[shot.origin.x,shot.origin.y+h.range]],h.color,7);ctx.restore();return;}
    if(['crescent','daggers','claws'].includes(f.motion)){this.stamp(h.id,shot.origin.x+(p.x-shot.origin.x)*(.45+t*.55),shot.origin.y+(p.y-shot.origin.y)*(.45+t*.55)-18,50+shot.rank*6,angle,.7);return;}
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=.96;
    // Deliberately short trails: a crowded board must retain faces and enemy tells.
    if(!['bolt','ribbon','song','clock','cards','sunbeam','ringshot','syringe','blackfire','venomdrop'].includes(f.motion))stroke(ctx,[[-13-size,0],[0,0]],h.color+'70',size*.65);
    if(f.motion==='cards'){
      const tint=JOKER_HEX[s.jokerColor||'red'],lit=tint==='#241a36'?'#b69cff':tint,spin=Math.cos(t*17+shot.uid);
      stroke(ctx,[[-24,0],[-3,0]],lit+'88',3);stroke(ctx,[[-17,-4],[-4,-2]],'#ffffff66',1.4);
      ctx.rotate(-angle+t*5);ctx.scale(Math.max(.18,Math.abs(spin)),1);
      ctx.fillStyle='#fffdf3';ctx.strokeStyle='#1a1240';ctx.lineWidth=1.6;ctx.beginPath();ctx.roundRect(-5.5,-7.5,11,15,2.4);ctx.fill();ctx.stroke();
      diamond(ctx,0,0,4.6,tint);ctx.strokeStyle=tint==='#f6f4ff'?'#8a86b8':'#1a1240';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,-4.5*.9);ctx.lineTo(4.6,0);ctx.lineTo(0,4.5*.9);ctx.lineTo(-4.6,0);ctx.closePath();ctx.stroke();
    }
    if(f.motion==='blackfire'){
      // A small black-cored fireball in blood red and orange with a short ember tail and a black feather riding along.
      for(let i=0;i<4;i++)disk(ctx,-8-i*6,Math.sin(t*14+i*1.7)*2.6,3.6-i*.7,i%2?'#ff6a2acc':'#ffb060cc');
      disk(ctx,0,0,size*1.35,'#c4261c');disk(ctx,0,0,size*.95,'#ff7a30');disk(ctx,.4,0,size*.5,'#160408');
      ctx.save();ctx.rotate(t*5);ctx.fillStyle='#14090f';ctx.beginPath();ctx.ellipse(-size*1.2,-size*1.2,size*.45,size*1.2,-.6,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(f.motion==='venomdrop'){
      // A teardrop of venom: green with a dark core, trailing droplets, a black lily petal turning behind it.
      for(let i=0;i<3;i++)disk(ctx,-9-i*6,Math.sin(t*12+i*2)*2.2,2.8-i*.7,i?'#7be04acc':'#c4f08a');
      ctx.fillStyle='#4fbf3a';ctx.strokeStyle='#1c3a18';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(size*1.9,0);ctx.quadraticCurveTo(size*.6,-size*1.25,-size*.9,0);ctx.quadraticCurveTo(size*.6,size*1.25,size*1.9,0);ctx.fill();ctx.stroke();
      disk(ctx,0,0,size*.45,'#173016');
      ctx.save();ctx.rotate(t*6);ctx.fillStyle='#17101f';ctx.beginPath();ctx.ellipse(-size*1.4,size*1.1,size*1.1,size*.32,.5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(f.motion==='ringshot'){
      // A thin cracked ring around a white four-point star; fine violet shards trail behind it.
      ctx.rotate(t*7);ctx.strokeStyle='#d8c9ff';ctx.lineWidth=2.2;for(const [a0,a1] of [[.2,2.1],[2.5,4.3],[4.7,6.0]]){ctx.beginPath();ctx.arc(0,0,size*1.7,a0,a1);ctx.stroke();}
      ctx.rotate(-t*7);star(ctx,size*.95,'#ffffff');disk(ctx,-size*2.6,0,1.7,'#efe6ff');disk(ctx,-size*3.8,2.4,1.3,'#c9b4f0');disk(ctx,-size*5,-2,1,'#b9a2f2');
    }
    if(f.motion==='syringe'){
      // A cartoon syringe: pink fins and plunger, yellow lemonade, a silver needle; yellow bubbles pop behind it.
      for(let i=0;i<3;i++)disk(ctx,-16-i*7,Math.sin(t*12+i*2)*3.2,2.6-i*.6,i?'#ffe27acc':'#fff3b8');
      ctx.strokeStyle='#dfe7ee';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(18,0);ctx.stroke();
      ctx.fillStyle='#fff7c9';ctx.strokeStyle='#c0558a';ctx.lineWidth=1.4;ctx.beginPath();ctx.roundRect(-10,-3.7,20,7.4,2.2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffd93b';ctx.fillRect(-8,-2.4,13,4.8);
      ctx.fillStyle='#ff8fc1';ctx.fillRect(-9,-6,2.2,12);ctx.strokeStyle='#ff8fc1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-15,0);ctx.stroke();ctx.fillRect(-17,-4.6,2.4,9.2);
    }
    if(f.motion==='sunbeam'){
      for(let i=0;i<3;i++)disk(ctx,-7-i*7,Math.sin(t*10+i*2)*2.5,2.6-i*.6,i?'#ffd45a99':'#fff3c0');
      ctx.rotate(t*6);for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.fillStyle=i%2?'#ffcf3d':'#ffe27a';ctx.beginPath();ctx.ellipse(size*1.15,0,size*.8,size*.38,0,0,Math.PI*2);ctx.fill();}
      disk(ctx,0,0,size*.95,'#8a5a14');disk(ctx,0,0,size*.5,'#fff3c0');
    }
    if(f.motion==='star'){ctx.rotate(t*4);star(ctx,size*1.5,h.color);star(ctx,size*.6,'#ffffff');disk(ctx,-size*2,0,1.8,'#cfffff');}
    if(f.motion==='glass'){diamond(ctx,0,0,size*1.9,'#ffdae9');stroke(ctx,[[-size,0],[0,-size],[size,0]],'#fff7ff',1);disk(ctx,-size*2,size,1.5,h.color);}
    if(f.motion==='snow'){for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);stroke(ctx,[[0,0],[size*1.3,0]],'#c8f7ff',2);}disk(ctx,0,0,2,'#fff');}
    if(f.motion==='icicles'){for(let i=-1;i<=1;i++)diamond(ctx,-Math.abs(i)*7,i*size,10,'#99d6ff');}
    if(f.motion==='leap'){for(const side of [-1,1]){ctx.strokeStyle=side===1?'#edd3ff':'#b68ae6';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-5,side*5,9,-1.2,1.2);ctx.stroke();}}
    if(f.motion==='ribbon'){for(const side of [-1,1])stroke(ctx,Array.from({length:7},(_,i)=>[-28+i*6,Math.sin(i*.8+t*9)*4+side*3]),side===1?'#c0ffe9':h.color,2);}
    if(f.motion==='bolt'){stroke(ctx,[[-22,0],[-14,-6],[-8,5],[0,-4],[8,0]],'#ffe682',3);stroke(ctx,[[-12,0],[7,0]],'#fff',1);}
    if(f.motion==='dragon'){ctx.scale(1.6,1);disk(ctx,0,0,size,'#ff7d42');diamond(ctx,size,0,size,'#ffe6a0');disk(ctx,-size*1.5,2,size*.5,'#ff623a');}
    if(f.motion==='embers'){for(let i=0;i<3;i++){const a=t*7+i*Math.PI*2/3;diamond(ctx,Math.cos(a)*size,Math.sin(a)*size,size*.85,i?'#ffb044':'#ffefb8');}}
    if(f.motion==='spores'){for(let i=0;i<3;i++)disk(ctx,-i*6,Math.sin(t*8+i)*5,size*(1-i*.22),i?'#93cf7b':'#daf58f');}
    if(f.motion==='needle'){stroke(ctx,[[-28,0],[10,0]],'#ffebc0',2);diamond(ctx,5,0,6,'#fff');}
    if(f.motion==='song'){for(let i=0;i<2;i++){ctx.strokeStyle=i?'#c4f3ff':h.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(-i*10,0,6+i*2,-1.2,1.2);ctx.stroke();}disk(ctx,4,0,3,'#fff');}
    if(f.motion==='petals'){ctx.rotate(t*7);for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.fillStyle=i%2?'#ffcfdf':'#ea9ab9';ctx.beginPath();ctx.ellipse(5,0,5,2.5,0,0,Math.PI*2);ctx.fill();}disk(ctx,0,0,2,'#fff3cb');}
    if(f.motion==='planet'){disk(ctx,0,0,size,'#b1b9ff');ctx.rotate(-.7);ctx.strokeStyle='#c8a9ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,size*1.7,size*.6,0,0,Math.PI*2);ctx.stroke();}
    if(f.motion==='comets'){for(let i=-1;i<=1;i++)stroke(ctx,[[-14-Math.abs(i)*7,i*5],[6-Math.abs(i)*7,i*5]],i?'#a9d5de':'#f2ffff',i?1.5:3);}
    if(f.motion==='stone'){ctx.rotate(t*12);ctx.fillStyle='#4b4260';ctx.strokeStyle='#d9d2ea';ctx.lineWidth=1.6;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3,r=size*1.15*(i%2?.72:1.05);i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();disk(ctx,-size*.3,-size*.3,size*.26,'#ffffff');}
    if(f.motion==='clock'){ctx.rotate(t*7);ctx.strokeStyle='#cfc5ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size*1.25,.3,5.5);ctx.stroke();stroke(ctx,[[0,-size],[0,0],[size*.7,0]],'#ffffff',1.5);}
    ctx.restore();
  }
  drawFinisherLocks(s){
    for(const f of s.finishers){const target=s.enemies.find(e=>e.uid===f.target&&e.hp>0);if(!target)continue;const p=pathPoint(target.progress),row=f.kind==='royal'?0:4;
      if(f.kind==='mirror'){this.atlasStamp('effects-trio',5,3,2,p.x-(target.boss?38:15),p.y-(target.boss?27:18),target.boss?88:56,target.boss?104:68,0,.78);continue;}
      this.atlasStamp('finishers',row,4,3,p.x,p.y-(target.boss?35:16),target.boss?148:84,undefined,0,.88);
    }
  }
  drawFinishers(s){
    for(const f of s.finishers){const target=s.enemies.find(e=>e.uid===f.target&&e.hp>0);if(!target)continue;
      const to=pathPoint(target.progress),p=1-f.life/f.total,row=f.kind==='royal'?0:4;
      if(f.kind==='mirror'){
        // The lock follows its original enemy. Small shards fill from damage,
        // while the timer line conveys a fixed three-second detonation.
        const y=to.y+14,ctx=this.ctx,fill=f.cap?Math.min(1,f.stored*.45/f.cap):0;
        stroke(ctx,[[to.x-18,y],[to.x+18,y]],'#b4a0ce66',2);
        stroke(ctx,[[to.x-18,y],[to.x-18+36*p,y]],'#e5d6ff',2);
        for(let i=0;i<Math.ceil(fill*3);i++)diamond(ctx,to.x-8+i*8,y+7,2.5,'#ceb2ff');
        continue;
      }
      const from=f.kind==='royal'?{x:f.origin.x,y:f.origin.y-18}:{x:Math.max(30,to.x-100),y:Math.max(30,to.y-190)},end={x:to.x,y:to.y-(target.boss?35:18)},angle=Math.atan2(end.y-from.y,end.x-from.x);
      if(p<.58){this.atlasStamp('finishers',row+1,4,3,from.x,from.y,38+p*28,undefined,angle,.35+p*.65);continue;}
      const t=Math.pow(Math.min(1,(p-.58)/.42),.8),x=from.x+(end.x-from.x)*t,y=from.y+(end.y-from.y)*t;
      if(f.kind==='royal')this.ultimate('cherry_prince',x,y,170,142,angle,.95);
      else this.atlasStamp('finishers',row+1,4,3,x,y,175,undefined,angle,.95);
    }
  }
  // Large attack silhouettes belong below units and HP, with hit stamps above.
  // Age them once in draw(), regardless of how many layers use the same event.
  drawAttackShapes(){
    const ctx=this.ctx;
    // Twenty simultaneous basic attacks must not paint the entire grid red.
    // Keep a two-attack brightness budget; every real strike still has a shape.
    const flames=this.impacts.filter(e=>e.type==='attackShape'&&e.life>0&&['zeke','ancient_dragon'].includes(e.hero)).length;
    const fireClarity=Math.min(1,2/Math.max(1,flames));
    for(const e of this.impacts){
      if(!GROUND_TYPES.has(e.type)||e.life<=0)continue;
      const t=Math.max(0,1-e.life/e.total);
      if(e.type!=='attackShape'){drawNewGround(this,e,t);continue;}
        const h=HERO[e.hero],fade=Math.sin(Math.PI*t);
        if(drawNewAttackShape(this,e,t,e.hero==='zeke'?fireClarity:1))continue;
        if(['guardian','behemoth','zeke','miracle_larva'].includes(e.hero)){
          const R=e.hero==='miracle_larva'?230:h.range;
          ctx.save();ctx.globalAlpha=fade*.62;ctx.strokeStyle=h.color;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(e.origin.x,e.origin.y,R*(.32+t*.68),R*(.32+t*.68),0,0,Math.PI*2);ctx.stroke();ctx.restore();if(e.hero!=='miracle_larva')this.stamp(e.hero,e.origin.x,e.origin.y,90+t*30,0,fade*.46);
        }else{
          // Basic attack, not an ultimate: a small cross at the dragon and four thin flame arms.
          const reach=h.range*Math.min(1,t*2.4),a=fade*fireClarity;
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const g=ctx.createLinearGradient(e.origin.x,e.origin.y,e.origin.x+dx*reach,e.origin.y+dy*reach);g.addColorStop(0,'#ffb35acc');g.addColorStop(1,'#ff6a3000');ctx.strokeStyle=g;ctx.globalAlpha=a*.55;ctx.lineWidth=10*(1-t)+2;ctx.beginPath();ctx.moveTo(e.origin.x,e.origin.y);ctx.lineTo(e.origin.x+dx*reach,e.origin.y+dy*reach);ctx.stroke();}
          ctx.restore();this.atlasStamp('ancient-cross',0,1,1,e.origin.x,e.origin.y-8,150,150,0,a*.5,'source-over');
        }
    }
  }
  draw(dt){
    this.clock+=dt;const ctx=this.ctx;
    // Several ordinary strikes on one enemy share a local glow budget. Skills,
    // boss tells and execution receipts keep their own independent emphasis.
    const hitKey=e=>`${Math.round(e.x/24)}:${Math.round(e.y/24)}`,hitCounts=new Map();
    for(const e of this.impacts)if(e.type==='impact'&&e.life>dt){const key=hitKey(e);hitCounts.set(key,(hitCounts.get(key)||0)+1);}
    for(const e of this.impacts){e.life-=dt;const t=1-e.life/e.total;if(t>=1||GROUND_TYPES.has(e.type))continue;
      if(drawNewImpact(this,e,t))continue;
      if(drawCompanionImpact(this,e,t,e.type==='impact'?1/(hitCounts.get(hitKey(e))||1):1))continue;
      if(drawLightningImpact(this,e,t,e.type==='impact'?1/(hitCounts.get(hitKey(e))||1):1))continue;
      if(e.type==='reduce'){
        // The reduced ally dissolves into starlight embers that rise toward the gauge at the top.
        const k=easeOut(window01(t,0,.9)),fade=1-window01(t,.6,1),tint=HERO[e.hero]?.color||'#ffd0a0';
        this.glow('glow',tint,e.x,e.y-14,100*(1-k*.5),fade*.8);
        ctx.save();ctx.globalCompositeOperation='lighter';
        for(let i=0;i<14;i++){const a=hash(e.x+i,2)*Math.PI*2,sx=e.x+Math.cos(a)*10*hash(i,e.y),px=sx+(160-sx)*k*.5*hash(i,5),py=e.y-14+(60-e.y)*k*(.55+hash(i,9)*.45);ctx.globalAlpha=fade;diamond(ctx,px,py,3+hash(i,7)*3,i%3?'#ffe3a8':tint);}
        ctx.restore();continue;
      }
      if(e.type==='armageddon'){
        // A black sun opens over the densest pack: dark core, blood-red corona, a ring at the true radius, falling embers.
        const grow=easeOut(window01(t,0,.4)),fade=1-window01(t,.55,1),R=e.radius;
        ctx.save();ctx.globalAlpha=fade*.55;ctx.fillStyle='#1a0610';ctx.beginPath();ctx.arc(e.x,e.y,R*grow,0,Math.PI*2);ctx.fill();ctx.restore();
        this.glow('rays','#ff6a3c',e.x,e.y-8,R*2.4*grow,fade*.9,t*1.4);this.glow('glow','#ff3a2a',e.x,e.y-8,R*1.6,fade*.8);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.strokeStyle='#ff7a4a';ctx.lineWidth=7*fade+2;ctx.beginPath();ctx.arc(e.x,e.y,R*grow,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#ffd2a0';ctx.lineWidth=2.5*fade+1;ctx.beginPath();ctx.arc(e.x,e.y,R*grow*.92,0,Math.PI*2);ctx.stroke();
        if(!this.reduced)for(let i=0;i<16;i++){const a=hash(e.x,i)*Math.PI*2,r=R*(.2+hash(e.y,i+3)*.8)*grow,fall=window01(t,.2,1);ctx.globalAlpha=fade;diamond(ctx,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r*.7+fall*26,3.4+hash(i,8)*3,i%2?'#ffb070':'#fff0d0');}
        ctx.restore();continue;
      }
      if(e.type==='plagueBloom'){
        // Plague on one enemy: a black spider lily opens at its feet with green spores.
        const k=easeOut(window01(t,0,.5)),fade=1-window01(t,.55,1);
        ctx.save();ctx.translate(e.x,e.y+4);ctx.globalAlpha=fade;
        for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,len=(10+k*20)*(i%2?.8:1);ctx.strokeStyle='#17101f';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(Math.cos(a)*len*.6,Math.sin(a)*len*.35-6*k,Math.cos(a)*len,Math.sin(a)*len*.55);ctx.stroke();
          ctx.fillStyle='#86e05a';ctx.beginPath();ctx.arc(Math.cos(a)*len,Math.sin(a)*len*.55,1.6+k,0,Math.PI*2);ctx.fill();}
        ctx.restore();this.glow('glow','#7be04a',e.x,e.y-8,70*(.6+k*.5),fade*.6);continue;
      }
      if(e.type==='ward'){
        // Immunity just blocked something: a soft ring and sparkles on the cell (pink for Cure Master, violet for Antropy).
        const tint=e.hero==='antropy'?'#d8c9ff':'#ffb6da',k=easeOut(window01(t,0,.6)),fade=1-window01(t,.4,1);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.9;ctx.strokeStyle=tint;ctx.lineWidth=3*fade+1;ctx.beginPath();ctx.arc(e.x,e.y-6,16+k*30,0,Math.PI*2);ctx.stroke();
        if(!this.reduced)for(let i=0;i<5;i++){const a=i/5*Math.PI*2+k*1.4,r=20+k*26;ctx.globalAlpha=fade;diamond(ctx,e.x+Math.cos(a)*r,e.y-6+Math.sin(a)*r,3.2,i%2?'#ffffff':tint);}
        ctx.restore();this.glow('glow',tint,e.x,e.y-6,70*(1-k*.3),fade*.7);continue;
      }
      if(e.type==='wipe'){
        // Nova Requiem on one enemy: its debuffs shatter outward.
        const k=easeOut(window01(t,0,.55)),fade=1-window01(t,.4,1);
        ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.9;ctx.strokeStyle='#efe6ff';ctx.lineWidth=2.4*fade+.8;ctx.beginPath();ctx.arc(e.x,e.y-16,10+k*28,0,Math.PI*2);ctx.stroke();
        if(!this.reduced)for(let i=0;i<4+Math.min(4,e.cleared);i++){const a=hash(e.x,i)*Math.PI*2,v=18+hash(e.y,i+4)*34;ctx.globalAlpha=fade;diamond(ctx,e.x+Math.cos(a)*v*k,e.y-16+Math.sin(a)*v*k,3+hash(e.x,i+8)*3,i%2?'#ffffff':'#c9b4f0');}
        ctx.restore();this.glow('glow','#e9defc',e.x,e.y-16,66*(1-k*.4),fade*.6);continue;
      }
      if(e.type==='novaRing'){
        // The cracked halo opens across the whole field: two broken rings and a four-point star at the caster.
        const k=easeOut(window01(t,0,.7)),fade=1-window01(t,.5,1),flash=1-window01(t,0,.25);
        ctx.save();ctx.globalCompositeOperation='lighter';
        for(const [scale,w,col,dash] of [[1,10,'#f3ecff',[130,26,70,22]],[.7,5,'#b9a2f2',[60,18,110,16]]]){ctx.globalAlpha=fade*.9;ctx.strokeStyle=col;ctx.lineWidth=w*fade+2;ctx.setLineDash(dash);ctx.lineDashOffset=-t*120;ctx.beginPath();ctx.arc(e.x,e.y,780*scale*k,0,Math.PI*2);ctx.stroke();}
        ctx.setLineDash([]);
        if(flash>0){ctx.globalAlpha=flash;ctx.translate(e.x,e.y);ctx.rotate(t*1.4);star(ctx,110*(.4+k),'#ffffff');}
        ctx.restore();this.glow('glow','#efe6ff',e.x,e.y,240*(1-k*.5),fade*.7);continue;
      }
      if(e.type==='lemonPop'){
        // Lemonade ultimate on one ally: a lemon-yellow bubble opens and hearts rise out of it.
        const k=easeOut(window01(t,0,.45)),fade=1-window01(t,.5,1);
        ctx.save();ctx.globalAlpha=fade*.85;ctx.fillStyle='#fff3a833';ctx.strokeStyle='#ffe27a';ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(e.x,e.y-4,10+k*34,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(!this.reduced)for(let i=0;i<5;i++){const x=e.x+(hash(e.x+i,3)-.5)*46,y=e.y-8-k*(30+hash(e.y,i)*34);ctx.globalAlpha=fade;heart(ctx,x,y,3.6+hash(i,e.x)*2,i%2?'#ff8fc1':'#ffd3ec');}
        ctx.restore();this.glow('glow','#ffe27a',e.x,e.y-6,72*(1-k*.3),fade*.6);continue;
      }
      if(e.type==='impact'&&e.sunR){
        // The ring is the real burst radius (30, 60 or 90): what is drawn is what was hit.
        const fade=1-window01(t,.25,1),grow=easeOut(window01(t,0,.45));
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=fade*.18;ctx.fillStyle='#ffe9a0';ctx.beginPath();ctx.arc(e.x,e.y,e.sunR*grow,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=fade*.85;ctx.strokeStyle='#ffd45a';ctx.lineWidth=2.6*fade+1;ctx.stroke();
        if(!this.reduced)for(let i=0;i<Math.round(e.sunR/15);i++){const a=i/Math.round(e.sunR/15)*Math.PI*2+t*1.2;diamond(ctx,e.x+Math.cos(a)*e.sunR*grow,e.y+Math.sin(a)*e.sunR*grow,3.4*fade+1,'#fff3c0');}
        ctx.restore();
      }
      if(e.type==='sunCharge'){
        // A shaft of warm light drops into the bloom badge and the next ring opens.
        const fall=easeOut(window01(t,0,.55)),open=window01(t,.45,1),fade=1-window01(t,.55,1);
        ctx.save();ctx.globalCompositeOperation='lighter';
        const g=ctx.createLinearGradient(0,e.y-92,0,e.y);g.addColorStop(0,'#fff2b000');g.addColorStop(1,'#ffe27acc');
        ctx.globalAlpha=Math.min(1,fade+.2)*(1-open*.6);ctx.fillStyle=g;ctx.fillRect(e.x-5-4*fall,e.y-92*fall,10+8*fall,92*fall);
        if(!this.reduced)for(let i=0;i<5;i++){const k=Math.min(1,fall*1.1+i*.04),x=e.x+Math.sin(i*2.3+e.x)*9,y=e.y-92*(1-k)-i*5;ctx.globalAlpha=(1-open)*.9;diamond(ctx,x,y,3,i%2?'#fff3c0':'#ffd45a');}
        ctx.restore();
        if(open>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-open)*.9;ctx.strokeStyle='#ffe27a';ctx.lineWidth=2.5*(1-open)+.8;ctx.beginPath();ctx.arc(e.x,e.y,17+open*20,0,Math.PI*2);ctx.stroke();ctx.restore();this.glow('glow','#ffd45a',e.x,e.y,70*(1-open*.4),(1-open)*.8);}
        continue;
      }
      if(e.type==='sunSpend'){
        // The bloom lets go: sparks rise to the sky and the sun flares over the field.
        const rise=easeOut(window01(t,0,.5)),flare=window01(t,.35,1),fade=1-window01(t,.55,1);
        ctx.save();ctx.globalCompositeOperation='lighter';
        if(!this.reduced)for(const [pi,p] of e.points.entries())for(let i=0;i<e.sunlight*3;i++){const sx=p.x+(hash(pi+e.sunlight,i)-.5)*30,k=Math.min(1,rise+hash(i,pi)*.05),x=sx+(360-sx)*k*.7,y=p.y+(150-p.y)*k;ctx.globalAlpha=(1-window01(t,.4,.6))*.9;diamond(ctx,x,y,3.4,i%2?'#fff3c0':'#ffd45a');}
        ctx.restore();
        if(flare>0){
          const r=(120+e.sunlight*150)*easeOut(flare);
          this.glow('rays','#ffe9a0',360,200,(260+e.sunlight*120)*Math.min(1,flare*2.5),fade*.9,t*1.4);this.glow('glow','#fff6d8',360,200,150+e.sunlight*70,fade);
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.8;ctx.strokeStyle='#ffd45a';ctx.lineWidth=7*fade+2;ctx.beginPath();ctx.arc(360,200,r,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        continue;
      }
      if(e.type==='jokerFlip'){
        const k=easeOut(window01(t,0,.8)),fade=1-window01(t,.5,1);
        this.glow('glow',JOKER_HEX[e.color]==='#241a36'?'#b69cff':JOKER_HEX[e.color],e.x,e.y,64*(.6+k*.5),fade*.85);
        if(!this.reduced){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=i/6*Math.PI*2+k*2,r=14+k*22;ctx.globalAlpha=fade*.9;diamond(ctx,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,3,i%2?'#ffffff':(JOKER_HEX[e.color]==='#241a36'?'#b69cff':JOKER_HEX[e.color]));}ctx.restore();}
        continue;
      }
      if(e.type==='bell'){
        // Midnight bell: a glass star drops on the target, a clock face rings out to the splash radius, glass flies.
        const drop=Math.min(1,t/.18),ring=window01(t,.14,.8),fade=1-window01(t,.45,1),r=(e.radius||150)*easeOut(ring);
        ctx.save();ctx.globalCompositeOperation='lighter';
        if(drop<1){ctx.globalAlpha=.9;ctx.translate(e.x,e.y-20-(1-drop)*220);ctx.rotate(drop*3);star(ctx,22,'#fff2fb');ctx.restore();ctx.save();ctx.globalCompositeOperation='lighter';}
        if(t>.14){
          ctx.globalAlpha=fade*.9;ctx.strokeStyle='#ff9ad8';ctx.lineWidth=9*fade+2;ctx.beginPath();ctx.ellipse(e.x,e.y+6,r,r*.42,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff2fb';ctx.lineWidth=3*fade+1;ctx.stroke();
          for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI/6;diamond(ctx,e.x+Math.cos(a)*r,e.y+6+Math.sin(a)*r*.42,(i===0?11:6)*fade+2,i===0?'#fff2b0':'#ffe3f5');}
          for(let i=0;i<14;i++){const a=hash(e.x+e.y,i)*Math.PI*2,v=60+hash(e.x,i+20)*120,k=easeOut(ring);ctx.globalAlpha=fade*.85;ctx.save();ctx.translate(e.x+Math.cos(a)*v*k,e.y-14+Math.sin(a)*v*k*.6+k*k*30);ctx.rotate(a+k*5);diamond(ctx,0,0,5+hash(e.y,i)*6,i%3?'#ffc8ec':'#ffffff');ctx.restore();}
        }
        ctx.restore();
        this.glow('rays','#ffd6ef',e.x,e.y-16,(e.boss?260:200)*Math.min(1,t*4),fade*.8,t*.8);this.glow('glow','#fff2fb',e.x,e.y-10,170,fade*.7);
        if(t>.1)this.emblem('cinderella',e.x,e.y-14,(e.boss?190:150)*easeBack(window01(t,.1,.4)),t*.6,fade*.75);
        continue;
      }
      if(e.type==='judgement'){
        // Divine punishment: a column of light falls on the cell, then a ring and rays.
        const fall=Math.min(1,t*4),fade=1-t;ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createLinearGradient(0,0,0,e.y);g.addColorStop(0,'#fff2c000');g.addColorStop(1,'#fff6d8ee');ctx.globalAlpha=fade;ctx.fillStyle=g;const w=36+t*50;ctx.fillRect(e.x-w/2,0,w,e.y*fall);ctx.restore();
        this.glow('rays','#ffe9a8',e.x,e.y-10,260*Math.min(1,t*3),fade*.9,t);this.glow('glow','#fff6d8',e.x,e.y-10,200,fade);
        ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#fff2c0';ctx.lineWidth=6*fade+1;ctx.beginPath();ctx.ellipse(e.x,e.y+20,30+t*90,12+t*30,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      if(e.type==='bombSet'){
        const fade=1-t,ring=easeOut(t);this.glow('glow','#ff7a62',e.x,e.y-10,90+ring*50,fade*.7);
        ctx.save();ctx.globalAlpha=fade*.9;ctx.strokeStyle='#ffd9c8';ctx.lineWidth=3*fade+1;ctx.beginPath();ctx.ellipse(e.x,e.y+4,10+ring*38,5+ring*16,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      if(e.type==='bombBlast'&&this.art.images['effects-applebomb']){
        // Painted burst: it slams out to the real radius (about a field wide), spins a little, then falls away in sugar sparks.
        const rad=170,pop=easeOut(window01(t,0,.28)),fade=1-window01(t,.42,1),size=rad*2.15*(.4+.6*pop);
        ctx.save();ctx.globalAlpha=Math.min(1,fade*1.25)*.16*(1-window01(t,.2,.6));ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fff2d0';ctx.fillRect(0,0,720,780);ctx.restore();
        this.glow('glow','#ff7a3a',e.x,e.y-10,rad*2.6*(.6+.4*pop),fade*.8);
        this.atlasStamp('effects-applebomb',1,2,1,e.x,e.y-8,size,size,t*.4,Math.max(0,fade)*.82,'screen');
        const ring=easeOut(window01(t,0,.6));ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-ring)*.9;ctx.strokeStyle='#ffd7a8';ctx.lineWidth=8*(1-ring)+2;ctx.beginPath();ctx.ellipse(e.x,e.y+6,Math.max(10,rad*ring*1.05),Math.max(5,rad*ring*.46),0,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(!this.reduced)for(let i=0;i<18;i++){const a=hash(e.x,i)*Math.PI*2,v=70+hash(e.y,i+3)*150,k=easeOut(t);ctx.save();ctx.globalAlpha=fade;ctx.translate(e.x+Math.cos(a)*v*k,e.y+Math.sin(a)*v*k*.62+k*k*30);ctx.rotate(a+k*6);diamond(ctx,0,0,4+hash(e.x,i+7)*5,['#ff5a46','#ffd27a','#fff1d6','#c44a2a'][i%4]);ctx.restore();}
        continue;
      }
      if(e.type==='bombBlast'){
        const fade=1-window01(t,.25,.9),ring=easeOut(window01(t,0,.65)),rad=170;
        this.glow('rays','#ffd2b0',e.x,e.y-10,300*Math.min(1,t*3),fade*.85,t);this.glow('glow','#ff6a50',e.x,e.y-10,240,fade*.9);
        ctx.save();ctx.globalAlpha=(1-ring)*.9;ctx.strokeStyle='#ff7a62';ctx.lineWidth=7*(1-ring)+2;ctx.beginPath();ctx.ellipse(e.x,e.y+6,Math.max(10,rad*ring),Math.max(5,rad*ring*.45),0,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(!this.reduced)for(let i=0;i<10;i++){const a=hash(e.x,i)*Math.PI*2,v=50+hash(e.y,i+3)*90,k=easeOut(t);ctx.save();ctx.globalAlpha=fade;ctx.translate(e.x+Math.cos(a)*v*k,e.y+Math.sin(a)*v*k*.55);diamond(ctx,0,0,4+hash(e.x,i+7)*4,i%2?'#ff6a50':'#fff0d8');ctx.restore();}
        continue;
      }
      if(e.type==='crushPhase'){
        const fade=1-window01(t,.35,.9),radius=e.radius||150,color=HERO.behemoth.color,pop=t<.4?.6+easeBack(t/.4)*.55:1.15,emblem=1-window01(t,.45,.9),ring=easeOut(window01(t,0,.7));
        this.atlasStamp('effects-behemoth',2,3,1,e.x,e.y,2*radius*1.1,2*radius*1.1,0,fade,'source-over');
        this.atlasStamp('effects-behemoth',1,3,1,e.x,e.y-8,210*pop,210*pop,0,emblem,'screen');
        ctx.save();ctx.globalAlpha=(1-ring)*.85*(this.reduced?.55:1);ctx.strokeStyle=color;ctx.lineWidth=6*(1-ring)+2;ctx.beginPath();ctx.ellipse(e.x,e.y+6,Math.max(8,radius*ring),Math.max(4,radius*ring*.42),0,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(!this.reduced)for(let i=0;i<6;i++){const a=hash(e.x+e.phase,i)*Math.PI*2,v=40+hash(e.y,i+3)*70,k=easeOut(t);ctx.save();ctx.globalAlpha=fade;ctx.translate(e.x+Math.cos(a)*v*k,e.y+Math.sin(a)*v*k*.5);diamond(ctx,0,0,4+hash(e.phase,i)*4,i%2?color:'#fff6d0');ctx.restore();}
        continue;
      }
      if(e.type==='dreamHit'){const c=['#ffd36a','#cfe3ff','#fff4c8','#ffc4ec'][e.phase]||'#ffffff',fade=1-t,size=(e.phase===3?100:74)*(1+t*.4);this.glow('glow',c,e.x,e.y-18,size,fade*.85);
        if(e.phase===1){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.85;ctx.drawImage(this.sprite('crescent','#e6f0ff'),e.x-size*.3,e.y-18-size*.3,size*.6,size*.6);ctx.restore();}
        else if(e.phase===2){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.translate(e.x,e.y-18);ctx.rotate(t*2);star(ctx,18*(1-t*.3),'#fffaf0');ctx.restore();}
        else this.glow('rays',c,e.x,e.y-18,size*1.3,fade*.6,t*2);continue;}
      if(e.type==='meteor'){
        // Fallen Star relic: a gold star streaks down onto the hit point, then floor rings open to
        // the real 100 hit radius and star shards scatter. Same glow, ray and ring language as casts.
        const fall=Math.min(1,t/.26),land=window01(t,.26,1),fade=1-land;
        if(fall<1){
          const k=fall*fall,x=e.x+70*(1-k),y=e.y-20-230*(1-k);
          ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createLinearGradient(x+42,y-138,x,y);g.addColorStop(0,'#ffd59600');g.addColorStop(1,'#fff3c8ee');
          ctx.strokeStyle=g;ctx.lineCap='round';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+42,y-138);ctx.lineTo(x,y);ctx.stroke();
          ctx.translate(x,y);ctx.rotate(t*8);star(ctx,13,'#fffbe8');ctx.restore();this.glow('glow','#ffd596',x,y,74,.9);continue;
        }
        ctx.save();ctx.globalCompositeOperation='lighter';
        for(const [delay,scale,width,color] of [[0,1,8,'#ffd596'],[.08,.68,3,'#fff3c8']]){const k=easeOut(window01(t,.26+delay,1)),r=100*scale*k;ctx.globalAlpha=fade;ctx.strokeStyle=color;ctx.lineWidth=width*fade+1.5;ctx.beginPath();ctx.ellipse(e.x,e.y+6,r,r*.42,0,0,Math.PI*2);ctx.stroke();}
        if(!this.reduced)for(let i=0;i<8;i++){const a=i*Math.PI/4+hash(e.seed,i)*.6,v=38+hash(e.seed,i+9)*52,k=easeOut(land);ctx.globalAlpha=fade*.9;diamond(ctx,e.x+Math.cos(a)*v*k,e.y-12+Math.sin(a)*v*k*.55-Math.sin(k*Math.PI)*18,5*fade+1.5,i%2?'#ffe9b0':'#ffffff');}
        ctx.restore();
        this.glow('rays','#ffe9b0',e.x,e.y-14,190*easeBack(window01(t,.26,.5)),fade*.85,t*1.5);this.glow('glow','#fff3c8',e.x,e.y-12,150*(1-land*.3),fade*.8);
        continue;
      }
      if(e.type==='thunderStrike'){const fade=1-t;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.strokeStyle='#fff6b0';ctx.lineWidth=4;ctx.beginPath();let x=e.x+((e.seed*37)%30-15),y=0;ctx.moveTo(x,y);while(y<e.y-10){y+=40;x+=((e.seed*13+y)%40)-20;ctx.lineTo(x,y);}ctx.stroke();ctx.restore();this.glow('glow','#ffe27a',e.x,e.y-10,140,fade*.8);continue;}
      if(e.type==='pullImpact'){this.stamp(e.hero,e.x,e.y-18,72+t*22,0,(1-t)*.58);continue;}
      if(e.type==='instantKill'){
        // A brief, inward wind seal on the actual executed enemy. No screen
        // wash or additional burst competes with the boss danger indicators.
        this.stamp('storm_sage',e.x,e.y-18,84-t*48,-t*1.2,(1-t)*.88);
        ctx.save();ctx.globalAlpha=(1-t)*.6;ctx.strokeStyle='#c0ffe9';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(e.x,e.y+5,23*(1-t),8*(1-t),0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      if(e.type==='finisherImpact'||e.type==='finisherFizzle'){
        if(e.kind==='mirror'){this.atlasStamp('effects-trio',5,3,2,e.x,e.y-(e.targetBoss?29:18),280+t*70,320+t*50,0,(1-t)*(e.type==='finisherImpact'?.95:.3));if(e.type==='finisherImpact')for(const side of [-1,1])this.stamp('aurora',e.x+side*t*90,e.y-18,88,side<0?Math.PI:0,(1-t)*.85);continue;}
        const row=e.kind==='royal'?0:4,hit=e.type==='finisherImpact',angle=Math.atan2(e.y-(e.origin?.y||e.y),e.x-(e.origin?.x||e.x));
        if(hit&&e.kind==='royal')this.ultimate('cherry_prince',e.x,e.y-(e.targetBoss?35:18),210+t*44,180+t*35,angle,(1-t)*.94);
        else if(hit&&t<.75)this.atlasStamp('finishers',row+2,4,3,e.x,e.y-(e.targetBoss?35:18),220+t*35,undefined,angle,(1-t)*(this.reduced?.65:.95));
        this.atlasStamp('finishers',row+3,4,3,e.x,e.y-(e.targetBoss?35:18),190+t*65,undefined,0,(1-t)*.55);continue;
      }
      if(e.type==='transform'){this.atlasStamp('finishers',8+Math.min(3,Math.floor(t*4)),4,3,e.x,e.y-8,100,undefined,0,(1-t)*.85);continue;}
      if(e.type==='bossMagic'){this.atlasStamp('effects-expansion',{storm:7,duel:8,creation:9}[e.pattern],4,3,e.x,e.y-20,112+t*18,undefined,0,(1-t)*.85);continue;}
      if(e.type==='support'){
        // Support magic rises beside the recipient, never as a false enemy hit.
        const burst=e.pulse?58:96;
        this.ultimate(e.hero,e.x+24,e.y-22-t*28,burst+16*t,burst+16*t,0,(1-t)*(e.pulse?.7:.85));
        ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+25,23+t*10,8+t*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      const large=e.type==='ultimate',size=large?118+Math.min(5,e.rank||1)*8:impactSize(e.hero,e.rank||1),hitClarity=e.type==='impact'?1/(hitCounts.get(hitKey(e))||1):1,alpha=Math.max(0,(1-t)*(large?.83:.9)*hitClarity);
      if(e.type==='impact'&&e.hero==='ancient_dragon'){this.atlasStamp('ancient-cross',0,1,1,e.x,e.y-18,size*.46,size*.46,0,alpha*.6,'source-over');continue;}
      if(large&&dedicated(e.hero)){this.ultimate(e.hero,e.x,e.y-22,size*(1+t*.35),size*(1+t*.35),0,alpha);continue;}
      if(FX_PROFILES[e.hero]?.atlas==='effects-trio'){
        const frame=FX_PROFILES[e.hero].frame+3,burst=e.type==='frostBreak';
        this.atlasStamp('effects-trio',frame,3,2,e.x,e.y-18,(large?118:burst?88:size)*(1+t*.35),undefined,0,alpha*(this.reduced?.7:1));
        continue;
      }
      this.stamp(e.hero,e.x,e.y-18,size*(.75+Math.sin(t*Math.PI/2)*.5),e.angle,alpha,e.form);
      if(large&&!this.reduced){ctx.save();ctx.globalAlpha=(1-t)*.32;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,size*(.3+t*.25),size*(.12+t*.1),0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    this.impacts=this.impacts.filter(e=>e.life>0);
  }
}

// A static contract is useful to keep new companions from silently sharing VFX.
export const distinctAttackCount=()=>new Set(HEROES.map(h=>FX_PROFILES[h.id]?.motion)).size;
