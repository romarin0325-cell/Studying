import {HEROES,COMPANIONS,ARTIFACTS,INITIAL,VERSION,balance} from '../data/catalog.js';
import {hash} from './rng.js';
export const HOUR=3600000, DAY=24*HOUR, Q=360000000;
export const gameDay=ms=>Math.floor((ms+4*HOUR)/DAY);
export const heroHourlyXP=stage=>30*(1+stage/balance.growth.stageRateDivisor);
export function rates(state){const d=balance.growth.stageRateDivisor;return Object.fromEntries(HEROES.map(h=>[h.id,{xp:(3000/d)*(d+state.heroes[h.id].stage),gold:(9000/d)*(d+state.heroes[h.id].stage),forgeOre:500,training:100,bond:25}]));}
export function newState(now=Date.now(),seed=now){
 const s={schemaVersion:1,contentVersion:VERSION,profileId:'astral-'+hash(seed),revision:0,createdAt:now,epochDay:gameDay(now),clockOffsetMs:0,lastTrustedLogicalMs:now,
 wallets:{xp:1000,gold:6000,forgeOre:300,companionTickets:10,memoryTickets:0,bondTokens:0,memoryDust:0,companionSelectors:0,memorySelectors:0,researchPermits:0,gifts:0,adventureBadges:0,decorTokens:0},
 heroes:Object.fromEntries(HEROES.map((h,i)=>[h.id,{level:1,stage:0,training:0,bond:0,nodes:0,style:0,gear:{weapon:0,armor:0,accessory:0},gearChoices:{weapon:0,armor:0,accessory:0},companions:[INITIAL[i],null],artifact:null,tactics:{preset:'standard',hold:false,order:[]},presets:{}}])),
 companions:Object.fromEntries(COMPANIONS.map(c=>[c.id,{owned:INITIAL.includes(c.id),rank:0,gates:[]}])),artifacts:Object.fromEntries(ARTIFACTS.map(a=>[a.id,0])),bossTraces:{},bossRecords:{},
 memories:[],readScenes:[],skippedScenes:[],orphanIds:[],rng:Object.fromEntries(['companion','memory','reward','adventure','learning'].map(x=>[x,hash(seed+':'+x)])),
 accrual:{cursorMs:now,duration:0,pending:{xp:0,gold:0,forgeOre:0,heroes:Object.fromEntries(HEROES.map(h=>[h.id,{training:0,bond:0}]))},segments:[],boostQ:{xp:0,gold:0},comebackQ:{xp:0,gold:0}},
 calendar:{day:gameDay(now)-1,bits:[],qualified:{},weeks:{},seasonPoints:{},seasonRewards:{},interactionCharges:0,seasonStarted:false},
 gacha:{counts:{companion:0,memory:0},issued:{companion:0,memory:0},beginner:false,batches:[],pinned:'archive_lumi_01'},
 rewards:{chestDay:-1,butterfly:null,letter:null,letterScheduledDay:-1,sparkMisses:0,spotlightDay:-1,comebacks:{},comebackEnd:0,counters:{}},
 gates:{used:{},echoCharge:true,lastEchoRefreshDay:gameDay(now),claim:null,grace:null,challenge:null},
 learning:{total:0,correct:0,mistakes:[],readLectures:[]},adventure:null,adventureSlots:{},adventureRecords:[],decor:[],
 battleHistory:[],lastResult:null,commands:[],ui:{hero:'lumi',homeArt:null,reducedMotion:false,volume:0.25,muted:true,vibration:false,textScale:1,lastHomeLines:[],tutorialDone:false},diagnostics:{clockWarning:false}};
 s.accrual.rateSnapshot=rates(s);return s;
}
export const totalStage=s=>Object.values(s.heroes).reduce((sum,h)=>sum+h.stage,0);
export const relativeDay=s=>Math.max(0,s.calendar.day-s.epochDay);
export const occurrence=s=>Math.floor(relativeDay(s)/28);
export function baseHourly(s){const r=rates(s);return Object.fromEntries(['xp','gold','forgeOre'].map(k=>[k,Object.values(r).reduce((n,v)=>n+v[k],0)*HOUR/Q]));}
