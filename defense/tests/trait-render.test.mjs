import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,cellPoint,personalTrait,combatStats} from '../src/combat/engine.js';
import {CombatFX} from '../src/combat/effects.js';
import {Renderer} from '../src/combat/render.js';

const noop=()=>{};
const context=()=>new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:noop});
function fixture(count){
  const state=newRun({deck:['aurora','siren','guardian','snow_rabbit','star_boy'],seed:7});
  const template=state.board.find(Boolean);state.board.fill(null);
  for(let i=0;i<count;i++)state.board[i]={...template,uid:state.nextId++,hero:'aurora'};
  return state;
}
function renderer(state){
  const ctx=context(),badges=[],fx=new CombatFX(ctx,{images:{}});
  fx.atlasStamp=(atlas,frame,columns,rows,x,y,width,height)=>{
    if(atlas==='effects-trio'&&frame===5&&width===30&&height===38)badges.push({x,y});
  };
  const view={
    ctx,fx,clock:0,dpr:1,background:{},bgReady:true,bgChapter:state.chapter,
    art:{images:{},hero:noop},canvas:{dataset:{}},boardSignature:'',selected:-1,hover:-1,
    entities:[],skills:[],effects:[],particles:[],floats:[],drag:null,
    drawDecor:noop,drawHero:noop,drawEnemy:noop,drawShot:noop,
  };
  return {view,badges};
}

test('dragging Aurora keeps full formation parity, hides only the held badge and leaves combat power unchanged',()=>{
  for(const count of [1,2,3,4,5]){
    const state=fixture(count),before=state.board.map(u=>u&&combatStats(state,u).damage),held=state.board[0];
    // Rendering must work without mutating even one board slot.
    Object.freeze(state.board);
    const {view,badges}=renderer(state),active=count>=2&&count%2===0;
    Renderer.prototype.draw.call(view,state,0);
    assert.equal(badges.length,active?count:0,'before drag: '+count);
    badges.length=0;view.drag={uid:held.uid,hero:held.hero,x:200,y:200};
    Renderer.prototype.draw.call(view,state,0);
    assert.equal(badges.length,active?count-1:0,'during drag: '+count);
    const origin=cellPoint(0);
    assert.ok(badges.every(p=>p.x!==origin.x+28||p.y!==origin.y+21),'held badge is hidden');
    assert.equal(state.board.filter(Boolean).length,count);
    assert.deepEqual(state.board.map(u=>u&&combatStats(state,u).damage),before);
    for(const unit of state.board.filter(Boolean))assert.equal(personalTrait(state,unit).active,active);
    badges.length=0;view.drag=null;Renderer.prototype.draw.call(view,state,0);
    assert.equal(badges.length,active?count:0,'after release: '+count);
  }
});

test('hiding a badge leaves lightning connectivity intact for the remaining badges',()=>{
  const state=fixture(4),cells=[6,7,11,12],units=state.board.filter(Boolean);state.board.fill(null);
  units.forEach((u,i)=>{u.hero='lightning_sage';state.board[cells[i]]=u;});
  Object.freeze(state.board);
  const fx=new CombatFX(context(),{images:{}}),shown=[];fx.stamp=(hero,x,y)=>shown.push({hero,x,y});
  fx.drawPersonalTraits(state,true,units[0].uid);
  assert.equal(shown.length,3);
  for(const unit of units)assert.equal(personalTrait(state,unit).size,4);
});

test('held sunflower, Joker, Antropy and Gold Dragon badges are hidden without removing their units',()=>{
  const state=fixture(1),unit=state.board[0],fx=new CombatFX(context(),{images:{}});
  // These badges make their first canvas call only after selecting a visible unit.
  const blocked=new Proxy({}, {get(){throw new Error('held badge was painted');}});
  fx.ctx=blocked;
  for(const [hero,method] of [['sunflower','drawSunBlooms'],['joker','drawJokerWheels'],['antropy','drawAntropyBadges']]){
    unit.hero=hero;fx[method](state,unit.uid);assert.equal(state.board[0],unit);
  }
  unit.hero='gold_dragon';fx.drawPersonalTraits(state,true,unit.uid);assert.equal(state.board[0],unit);
});
