// Every named support has an explicit executable effect. Descriptions live in roster.json.
export const SUPPORTS={
 guardian:c=>c.shield(.20,6,'guardian'),
 gold_dragon:c=>c.hit(1.8,.6,'gold_dragon',{mult:c.h.hp/c.h.maxHP>=.8?1.5:1}),
 snow_rabbit:c=>{c.hit(0,1.8,'snow_rabbit');c.status(c.e,'slow',6);},
 red_dragon:c=>{c.hit(1.6,.4,'red_dragon');c.status(c.e,'burn',8);},
 mushroom_king:c=>{c.hit(0,1.4,'mushroom_king');c.status(c.e,'poison',8,2);},
 great_detective:c=>c.status(c.e,'analysis',6),
 night_rabbit:c=>{c.hit(2,0,'night_rabbit');c.status(c.e,'blind',5);},
 lightning_sage:c=>{c.hit(0,2,'lightning_sage');c.status(c.e,'divine',15);},
 behemoth:c=>{c.hit(2.8,0,'behemoth');c.status(c.e,'weaken',5);},
 siren:c=>{c.heal(.18);c.cleanse();},
 time_magician:c=>{const i=c.h.cd.indexOf(Math.max(...c.h.cd));if(c.h.cd[i]>c.t)c.h.cd[i]=Math.max(c.t,c.h.cd[i]-60);},
 time_ruler:c=>c.delay(60,()=>c.hit(0,3,'time_ruler',{mult:c.has(c.e,'exposed')?1.3:1})),
 cinderella:c=>{c.shield(.15,6,'cinderella');c.hit(1.6,0,'cinderella');},
 avalanche_maid:c=>{c.hit(1.6,.4,'avalanche_maid');c.status(c.e,'corrosion',6);},
 ancient_dragon:c=>c.hit(1.4,1.4,'ancient_dragon'),
 ancient_soul:c=>{c.hit(0,2.2,'ancient_soul');c.status(c.e,'burn',8);c.status(c.e,'divine',15);},
 silver_rabbit:c=>{c.hit(1.8,0,'silver_rabbit');c.buff('silver_speed',6,{speed:.1});},
 galaxy_whale:c=>{c.h.mp=Math.min(100,c.h.mp+15);c.cleanse();},
 priest_of_end:c=>c.hit(0,2.6,'priest_of_end',{mult:c.e.hp/c.e.maxHP<=.35?1.3:1}),
 cherry_prince:c=>{c.heal(.12);c.h.mp=Math.min(100,c.h.mp+10);},
 phantom:c=>{c.hit(1.8,0,'phantom');c.cleanse();},
 storm_sage:c=>{c.hit(0,1.8,'storm_sage');c.status(c.e,'weaken',6);},
 harmonious:c=>{c.hit(0,1.6,'harmonious');c.buff('harmony',6,{mp:1});},
 flame_sage:c=>{c.hit(0,1.8,'flame_sage');c.status(c.e,'burn',8);c.buff('flame',6,{atk:.1});}
};
export const PASSIVES={guardian:{hp:.12},gold_dragon:{},snow_rabbit:{mp:.5},red_dragon:{atk:.1},mushroom_king:{hp:.08,dotReduction:.15},great_detective:{},night_rabbit:{},lightning_sage:{crit:.05},behemoth:{},siren:{healing:.15},time_magician:{cdr:.06},time_ruler:{},cinderella:{},avalanche_maid:{},ancient_dragon:{atk:.06,matk:.06},ancient_soul:{},silver_rabbit:{},galaxy_whale:{mp:.8},priest_of_end:{},cherry_prince:{},phantom:{dodge:.05},storm_sage:{},harmonious:{},flame_sage:{}};
export const RELICS={seal_fragment:{},verdant_seed:{hp:.1},thunder_seal:{},curse_mirror:{},rose_oath:{},bipolar_core:{},echo_thorn:{dotReduction:.3},origin_star:{hp:.08},war_crest:{},tide_gem:{}};
export const TEMP_RELICS={swift_training:{name:'빠른 훈련',effect:'기본 공격 주기 -20%',speed:.2},overflowing_mana:{name:'넘치는 마나',effect:'MP 회복 +2/초',mp:2},glass_star:{name:'유리별',effect:'직접 피해 +30% · 최대 HP -20%',direct:.3,hp:-.2},patient_guard:{name:'기다리는 방패',effect:'최대 HP +25% · 회복 +15%',hp:.25,healing:.15},burning_page:{name:'불타는 책장',effect:'기본 공격 3회마다 작열'},toxic_seed:{name:'독의 씨앗',effect:'중독 최대 5스택'},holy_echo:{name:'성스러운 메아리',effect:'디바인 3 대상 기본 공격 뒤 마법 0.3배'},moon_step:{name:'달의 걸음',effect:'회피 +10%p · 회피 뒤 다음 평타 +50%',dodge:.1},royal_seal:{name:'왕실 인장',effect:'궁극기 뒤 MP 15 회복 · 대기 10초'},little_companion:{name:'작은 동행',effect:'지원 재사용 대기 -20%'},exposed_heart:{name:'열린 마음',effect:'노출 대상 피해 +25%'},warm_return:{name:'따뜻한 귀환',effect:'전투 후 최대 HP 20% 회복'}};
export const SKILLS={
 guard:c=>c.shield(.25*(c.l.nodes>=2?(c.l.style===0?1.3:.8):1),6,'guard'),
 ignis_smash:c=>{c.hit(2.6,0,'ignis_smash',{mult:c.l.nodes>=2&&c.l.style===0?.9:1});c.status(c.e,'burn',8);},
 ragnarok:c=>c.hit(6,0,'ragnarok',{mult:(c.h.hp/c.h.maxHP<=(c.l.nodes>=12?.6:.5)?1.5:1)*(c.l.nodes>=2&&c.l.style===1?1.15:1)}),
 moonlight_serena:c=>{c.heal(.12);c.buff('serena',8,{mp:2});c.resource(c.l.nodes>=12?2:1);},
 milkyway_ecstasy:c=>{c.hit(.5,3,'milkyway_ecstasy');c.resource(1);},
 dream_form:c=>{c.hit(2,4,'dream_form',{mult:(1+.2*c.h.resource)*(c.l.nodes>=2?(c.l.style===0?.9:1.2):1)});c.h.resource=c.l.nodes>=20?1:0;},
 royal_bloom:c=>{c.resource(c.l.nodes>=12?2:1);c.heal(.08);},
 royal_lash:c=>{c.hit(1.4,1.4,'royal_lash');c.resource(1);},
 finale:c=>{const n=c.h.resource;c.hit(2+.8*n,2+.8*n,'finale',{mult:c.l.nodes>=2?(c.l.style===0?.9:1.2):1});c.h.resource=0;if(c.l.nodes>=20&&n===4)c.heal(.15);},
 barrier:c=>{c.shield(.2*(c.l.nodes>=2?(c.l.style===0?1.4:.8):1),6,'barrier');c.cleanse();},
 the_holy:c=>{c.hit(.25,3,'the_holy',{mult:c.l.nodes>=2&&c.l.style===0?.9:1});c.status(c.e,'divine',15,c.l.nodes>=6?2:1);},
 goddess_descent:c=>{c.buff('goddess',8+(c.l.nodes>=2&&c.l.style===1?2:0),{matk:.3,mp:2});c.status(c.e,'divine',15,3);},
 evasive_stance:c=>c.buff('evasion',6,{dodge:.2}),
 eclipse:c=>{c.hit(3,.5,'eclipse',{mult:c.l.nodes>=2&&c.l.style===1?1.2:1});c.status(c.e,'blind',4+(c.l.nodes>=6?2:0));},
 dark_meteor:c=>{c.hit(1,4.5,'dark_meteor',{mult:(c.l.nodes>=2&&c.l.style===0?.9:1)*(c.l.nodes>=20&&c.has(c.e,'blind')?1.15:1)});c.h.lock=c.t+(c.l.nodes>=12?10:20);}
};
export const BOSS_PATTERNS={
 pharaoh:c=>{if(c.every(12)){c.e.defenseEnd=c.t+80;c.e.defense=.6;c.delay(80,()=>c.status(c.e,'exposed',4));}if(c.every(8))c.enemyHit(2,0,'파라오의 일격');},
 flora:c=>{if(c.t%200===160)c.telegraph('생명의 개화',40);if(c.every(10)){c.e.hp=Math.min(c.e.maxHP,c.e.hp+c.e.maxHP*.08*(c.has(c.e,'burn')||c.has(c.e,'poison')?.5:1));c.emit('heal','enemy',0,'생명의 개화');c.status(c.e,'exposed',3);c.e.telegraph=null;}},
 thor:c=>{if(c.every(14)){c.telegraph('뇌신의 심판',60);c.e.interruptDamage=0;c.e.thorPending=true;c.delay(60,()=>{if(c.e.thorPending)c.enemyHit(0,3.6,'뇌신의 심판');c.e.thorPending=false;c.e.telegraph=null;});}},
 beelzebub:c=>{if(c.every(12)){const pool=['weaken','corrosion','blind'];const a=Math.floor(c.rng()*3);c.status(c.h,pool[a],6);c.status(c.h,pool[(a+1+Math.floor(c.rng()*2))%3],6);}if(c.every(18))c.enemyHit(0,2.8,'마신의 저주');},
 love_iris:c=>{if(c.every(12)){c.e.shield=Math.max(c.e.shield,c.e.maxHP*.12);c.e.shieldEnd=c.t+120;c.emit('shield','enemy',c.e.shield,'장미의 보호');}},
 artificial_demon:c=>{c.e.physicalReduction=Math.floor(c.t/160)%2===0?.4:0;c.e.magicReduction=Math.floor(c.t/160)%2===1?.4:0;},
 curse_iris:c=>{if(c.every(12))c.status(c.h,'curse',6);},
 astea:c=>{c.e.physicalReduction=c.t>=300&&c.t<380?.3:0;c.e.magicReduction=c.t>=600&&c.t<680?.3:0;},
 ares:c=>{if(c.every(10))c.e.attackBonus=Math.min(.5,c.e.attackBonus+.1);if(c.every(15))c.enemyHit(3,0,'투쟁의 일격');},
 poseidon:c=>{if(c.t%200<100){c.e.defense=.4;c.e.defenseEnd=c.t+1;}else if(c.t%200===100)c.status(c.e,'exposed',5);if(c.every(10))c.enemyHit(0,2.5,'해일');}
};
export const STATUS_IDS=['burn','poison','divine','blind','slow','corrosion','weaken','analysis','exposed','curse'];
