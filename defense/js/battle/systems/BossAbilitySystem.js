import { isStunned } from './StatusSystem.js';
import { damageCore } from './MovementSystem.js';
import { spawnEnemy } from './WaveSystem.js';

const live = enemy => !enemy.dead && !enemy.reachedCore;

function recover(enemy, ability, interrupted) {
  Object.assign(enemy.bossState, {phase:'recovery',remaining:ability.recovery,
    duration:ability.recovery,damageTaken:interrupted?1.25:1,speedMultiplier:1,
    interrupted,chargeDamage:0});
}

function resolveAbility(state, enemy, ability) {
  const runtime=enemy.bossState;
  if (ability.kind==='guard' || ability.kind==='tide') {
    Object.assign(runtime,{phase:'active',remaining:ability.duration,duration:ability.duration,
      damageTaken:ability.damageTaken??1,speedMultiplier:ability.speedMultiplier??1});
  } else {
    if(ability.kind==='heal') enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*ability.healRatio);
    if(ability.kind==='doom') damageCore(state,ability.coreDamage);
    if(ability.kind==='bloom') {
      for(let i=0;i<ability.count && state.registry.activeEnemyCount()<45;i++)
        spawnEnemy(state,ability.enemyId,{progress:Math.max(0,enemy.progress-1-i),hpScale:ability.hpScale});
    }
    if(ability.kind==='seal') {
      const closest=state.heroes.filter(hero=>hero.placed).sort((a,b)=>
        Math.hypot(a.x+.5-enemy.x,a.y+.5-enemy.y)-Math.hypot(b.x+.5-enemy.x,b.y+.5-enemy.y) || a.slot-b.slot);
      for(const hero of closest.slice(0,ability.count)) {
        hero.skillTimer+=ability.delay;
        state.events.push({type:'skill_delayed',sourceId:enemy.id,targetId:hero.id,seconds:ability.delay});
      }
    }
    recover(enemy,ability,false);
  }
  state.events.push({type:'boss_ability_resolved',effectPreset:'skill_area_hit',visualOnly:true,radius:2,enemyId:enemy.id,kind:ability.kind,
    name:ability.name,element:enemy.element,x:enemy.x,y:enemy.y});
}

// Boss attacks share the fixed simulation clock. Stun or enough damage during
// the visible windup breaks the cast; nothing uses a wall-clock timeout.
export function updateBossAbilities(state, deltaSeconds) {
  for(const enemy of [...state.enemies.values()]) {
    const ability=enemy.definition?.ability;
    if(!enemy.isBoss || !ability || !live(enemy)) continue;
    const runtime=enemy.bossState ??= {phase:'waiting',remaining:8,duration:8,
      name:ability.name,kind:ability.kind,damageTaken:1,speedMultiplier:1,
      chargeDamage:0,breakDamage:enemy.maxHp*ability.breakHpRatio,interrupted:false};
    if(runtime.phase==='windup') {
      runtime.chargeDamage=Math.max(0,runtime.hpAtCharge-enemy.hp);
      if(isStunned(enemy) || runtime.chargeDamage+1e-9>=runtime.breakDamage) {
        recover(enemy,ability,true);
        state.events.push({type:'boss_ability_interrupted',effectPreset:'critical_hit',visualOnly:true,enemyId:enemy.id,name:ability.name,
          x:enemy.x,y:enemy.y,element:enemy.element});
        continue;
      }
    } else if(isStunned(enemy)) continue;
    runtime.remaining=Math.max(0,runtime.remaining-deltaSeconds);
    if(runtime.remaining>1e-9) continue;
    if(runtime.phase==='waiting') {
      Object.assign(runtime,{phase:'windup',remaining:ability.windup,duration:ability.windup,
        hpAtCharge:enemy.hp,chargeDamage:0,interrupted:false});
      state.events.push({type:'boss_ability_started',enemyId:enemy.id,name:ability.name,
        kind:ability.kind,duration:ability.windup,x:enemy.x,y:enemy.y,element:enemy.element});
    } else if(runtime.phase==='windup') resolveAbility(state,enemy,ability);
    else if(runtime.phase==='active') recover(enemy,ability,false);
    else Object.assign(runtime,{phase:'waiting',remaining:ability.interval,duration:ability.interval,
      damageTaken:1,speedMultiplier:1,interrupted:false});
  }
}
