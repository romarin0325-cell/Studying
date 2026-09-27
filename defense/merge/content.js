import {PORTRAIT_FRAMES} from './art-frames.js';
export const VERSION = 1;
export const GRID = 5;
export const MAX_RANK = 6;
export const DEFAULT_DECK = ['zeke','snow_rabbit','rumi','siren','queen','cinderella'];
// Supplied by the author in 컨셉.txt, 2026-09-27. Height refers to anatomy;
// ears, hats, halos, weapons and trailing fabric are excluded.
export const HEIGHT_GROUPS = {
  tall:['zeke','lightning_sage','storm_sage','flame_sage','red_dragon','ancient_dragon'],
  medium:['rumi','luna','cinderella','avalanche_maid','mushroom_king','great_detective','siren','queen','galaxy_whale','time_ruler'],
  short:['guardian','snow_rabbit','night_rabbit','silver_rabbit','phantom'],
};

// Four authored directions share a 512px frame and a (256,480) foot anchor.
// Scale is calibrated from anatomical heads, never from weapon/hat bounds.
const h = (id,name,title,color,atlas,row,damage,interval,attack,trait,skill) => ({
  id,name,title,color,art:{atlas,row,columns:2,foot:0.94,scale:1},
  damage,interval,attack,trait,skill,
});
export const HEROES = [
  h('zeke','지크','불굴의 용기사','#ff995c','heroes',3,23,1.2,'slash',
    {type:'burn',text:'검격이 가까운 적들을 함께 베고 3초 동안 불태웁니다.'},
    {name:'용의 맹세',cost:70,type:'inferno',text:'전장의 적을 베고 큰 화염 피해를 줍니다.'}),
  h('rumi','루미','꿈을 짓는 마법사','#7dddf1','rumi',0,10,1.05,'star',
    {type:'wild',text:'같은 등급의 어떤 영웅과도 합성할 수 있습니다.'},
    {name:'꿈의 메아리',cost:60,type:'echo',text:'8초 동안 모든 영웅의 공격에 65% 위력의 추가 공격이 따라갑니다.'}),
  h('luna','루나','달그늘의 암살자','#c5a0ff','heroes',1,32,1.25,'blade',
    {type:'execute',text:'체력이 35% 이하인 적에게 두 배의 피해를 줍니다.'},
    {name:'제노사이드 스텝',cost:80,type:'execute',text:'가장 강한 적에게 연속 참격. 약해진 적을 처형합니다.'}),
  h('cinderella','신데렐라','한밤의 기적','#f7a5cc','heroes',2,12,1.15,'star',
    {type:'sacrifice',text:'합성 재료가 되면 등급당 18골드를 즉시 얻습니다.'},
    {name:'자정의 선물',cost:60,type:'fortune',text:'별비로 적을 타격하고 25골드를 얻습니다.'}),
  h('snow_rabbit','눈토끼','겨울의 작은 발자국','#9bdfef','companions',0,10,.95,'ice',
    {type:'slow',text:'눈송이가 적을 느리게 합니다. 토끼 동료와 함께하면 공격이 빨라집니다.'},
    {name:'하얀 숨결',cost:65,type:'freeze',text:'모든 적을 3초 동안 얼리고 얼음 피해를 줍니다.'}),
  h('avalanche_maid','아발란체메이드','잠든 눈사태','#9fc5f7','companions',1,24,1.65,'ice',
    {type:'shatter',text:'느려진 적에게 75% 추가 피해. 얼음이 주변에 파편을 뿌립니다.'},
    {name:'백야의 눈사태',cost:85,type:'avalanche',text:'넓은 범위에 거대한 얼음 폭발. 얼어 있는 적에게 두 배 피해.'}),
  h('night_rabbit','밤토끼','별 없는 밤의 도약','#bd91e3','companions',2,17,.7,'blade',
    {type:'rabbit',text:'다른 종류의 토끼마다 공격속도 20% 증가.'},
    {name:'달그림자 도약',cost:65,type:'flurry',text:'선두의 적들을 빠르게 연속 타격합니다.'}),
  h('guardian','가디언','대륙을 옮긴 손','#e2ba75','companions',3,32,1.8,'stone',
    {type:'stun',text:'세 번째 공격마다 적을 잠시 기절시킵니다.'},
    {name:'대륙의 맥동',cost:75,type:'quake',text:'지진으로 모든 적을 뒤로 밀고 기절시킵니다.'}),
  h('storm_sage','폭풍의현자','흐름을 읽는 자','#8dd2c4','companions',4,14,.85,'wind',
    {type:'gust',text:'바람이 가까운 두 적을 타격합니다.'},
    {name:'태풍의 눈',cost:75,type:'vortex',text:'적을 전방의 한곳으로 모아 타격하고 느리게 합니다.'}),
  h('lightning_sage','번개의현자','찰나의 섬광','#f2db84','companions',5,20,1.2,'lightning',
    {type:'chain',text:'번개가 가까운 적 3명에게 연쇄됩니다.'},
    {name:'천둥의 연쇄',cost:80,type:'thunder',text:'모든 적을 연쇄 타격하고 짧게 기절시킵니다.'}),
  h('red_dragon','레드드래곤','진홍의 포효','#ff805c','companions-ember',0,30,1.75,'fire',
    {type:'splash',text:'불덩이가 폭발합니다. 불타는 적에게 40% 추가 피해.'},
    {name:'용의 숨결',cost:90,type:'dragon',text:'넓은 화염으로 전장을 휩쓸고 강하게 불태웁니다.'}),
  h('flame_sage','화염의현자','꺼지지 않는 잔불','#edab55','companions-ember',1,17,1.1,'fire',
    {type:'burn',text:'불꽃이 주변의 적에게 번져 지속 피해를 줍니다.'},
    {name:'작열의 문장',cost:75,type:'combust',text:'적을 태웁니다. 이미 불타는 적에게 큰 폭발을 일으킵니다.'}),
  h('mushroom_king','머쉬룸킹','독의 왕관','#baaf66','companions-ember',2,11,.95,'spore',
    {type:'poison',text:'독 포자가 중첩됩니다. 합성할 때 모든 적에게 독을 퍼뜨립니다.'},
    {name:'왕의 마지막 포자',cost:70,type:'plague',text:'모든 적을 중독시킵니다. 독은 방어력을 무시합니다.'}),
  h('great_detective','명탐정','진실을 비추는 빛','#f2d8a0','companions-tide',0,30,1.6,'light',
    {type:'expose',text:'가장 강한 적을 노립니다. 명중한 적의 받는 피해가 증가합니다.'},
    {name:'완벽한 추리',cost:60,type:'expose',text:'보스를 포함한 모든 적을 노출시켜 10초간 받는 피해를 60% 늘립니다.'}),
  h('siren','세이렌','물결의 노래','#91d8f7','companions-tide',1,9,1.25,'water',
    {type:'hasteAura',text:'노랫소리로 상하좌우 동료의 공격속도를 22% 높입니다.'},
    {name:'공명의 아리아',cost:65,type:'haste',text:'8초 동안 모든 영웅의 공격속도를 65% 높입니다.'}),
  h('phantom','팬텀','곰인형 속 악몽','#c9a0cb','companions-tide',2,19,1.3,'shadow',
    {type:'fear',text:'세 번째 공격마다 적을 잠시 뒤로 물립니다.'},
    {name:'깨어나지 않는 밤',cost:75,type:'nightmare',text:'적을 뒤로 돌려보내고 받는 피해를 늘립니다.'}),
  h('queen','여왕','장미의 통치자','#e9a5bb','queen',0,10,1.35,'rose',
    {type:'dividend',text:'웨이브가 끝날 때 배당을 받습니다. 높은 등급일수록 배당 증가.'},
    {name:'장미의 세금',cost:60,type:'dividend',text:'장미가 적을 타격하고 30골드를 얻습니다.'}),
  h('galaxy_whale','은하고래','별바다의 주인','#90a9ec','galaxy-whale',0,35,2,'cosmos',
    {type:'gravity',text:'무거운 별이 주변 적을 감속시킵니다.'},
    {name:'별바다의 중심',cost:100,type:'singularity',text:'거대한 중력장이 적을 끌어당긴 뒤 폭발합니다.'}),
  h('silver_rabbit','은토끼','새벽을 잇는 발자국','#c4e5df','silver-rabbit',0,14,.9,'light',
    {type:'battery',text:'공격마다 별빛을 조금 더 채웁니다. 토끼 동료와 공명합니다.'},
    {name:'은빛 행진',cost:55,type:'march',text:'6초 동안 공격속도와 별빛 획득량이 증가합니다.'}),
  h('ancient_dragon','에인션트드래곤','오랜 별의 지혜','#e1c486','ancient-dragon',0,28,1.6,'light',
    {type:'powerAura',text:'상하좌우 동료의 공격력을 25% 높입니다.'},
    {name:'태고의 약속',cost:85,type:'awaken',text:'10초 동안 모든 영웅의 공격력을 70% 높입니다.'}),
  h('time_ruler','시간의지배자','멈춘 시계의 여왕','#c4bcf4','time-ruler',0,15,1.1,'time',
    {type:'chrono',text:'명중한 적의 이동을 짧게 늦춥니다.'},
    {name:'아직 오지 않은 순간',cost:90,type:'rewind',text:'모든 적을 기본 이동 거리 6초분만큼 뒤로 보내고 2초 동안 멈춥니다.'}),
];
export const HERO = Object.fromEntries(HEROES.map(x=>[x.id,x]));
for(const hero of HEROES){
  hero.heightGroup=Object.entries(HEIGHT_GROUPS).find(([,ids])=>ids.includes(hero.id))[0];
  hero.range=hero.attack==='slash'?390:hero.attack==='blade'?360:hero.id==='great_detective'?900:480;
  hero.art={atlas:`unit-${hero.id}`,row:0,columns:2,foot:480/512,scale:1,directional:true,portrait:PORTRAIT_FRAMES[hero.id]};
}
export const ARTIFACTS = [
  {id:'hourglass',name:'별모래 시계',icon:'hourglass',color:'#a7cad8',text:'합성할 때 별빛을 8 더 얻습니다.',price:48},
  {id:'treasury',name:'장미 금고',icon:'coin',color:'#e4bf73',text:'이자 상한이 8에서 16으로 늘어납니다.',price:45},
  {id:'ember',name:'불씨의 심장',icon:'flame',color:'#ec9372',text:'화상 피해가 60% 증가합니다.',price:50},
  {id:'frost',name:'녹지 않는 꽃',icon:'snow',color:'#9ed8ef',text:'느려진 적이 받는 피해가 25% 증가합니다.',price:50},
  {id:'banner',name:'홀로 선 깃발',icon:'banner',color:'#e3ca97',text:'상하좌우에 동료가 없는 영웅의 공격력 40% 증가.',price:48},
  {id:'chorus',name:'쌍둥이 음표',icon:'note',color:'#b9def0',text:'같은 영웅이 2명 이상이면 공격속도 15% 증가.',price:48},
  {id:'lantern',name:'꺼지지 않는 등불',icon:'lantern',color:'#f0d399',text:'스킬을 쓰면 별빛을 15 돌려받습니다.',price:62},
  {id:'lens',name:'예리한 달조각',icon:'moon',color:'#c6bdf0',text:'보스에게 주는 피해 30% 증가.',price:52},
  {id:'seed',name:'숨 쉬는 씨앗',icon:'leaf',color:'#b0c899',text:'일반 공격·합성·필살기로 독을 부여할 때 추가로 1중첩을 쌓습니다.',price:45},
  {id:'feather',name:'첫새벽의 깃털',icon:'feather',color:'#dae8df',text:'소환 비용이 4 감소합니다. 최소 8골드.',price:50},
  {id:'meteor',name:'떨어진 별',icon:'star',color:'#f1c286',text:'영웅의 12번째 공격마다 작은 운석이 떨어집니다.',price:65},
  {id:'crown',name:'작은 왕관',icon:'crown',color:'#e7c57b',text:'3등급 이상 영웅의 공격력 25% 증가.',price:55},
];
export const ARTIFACT = Object.fromEntries(ARTIFACTS.map(x=>[x.id,x]));
export const CHAPTERS = [
  {id:0,name:'달빛 정원',caption:'처음 피어나는 별',color:'#7dbac1',bosses:['artificial_demon','love_iris','curse_iris'],hp:1,world:0},
  {id:1,name:'잠든 숲의 노래',caption:'독과 생명의 경계',color:'#a9bd80',bosses:['flora','artificial_demon','flora'],hp:1.3,world:3},
  {id:2,name:'푸른 심연',caption:'폭풍 아래의 약속',color:'#82aec7',bosses:['poseidon','love_iris','poseidon'],hp:1.65,world:4},
  {id:3,name:'황혼의 왕좌',caption:'마지막 성좌',color:'#c799ba',bosses:['curse_iris','beelzebub','beelzebub'],hp:2.05,world:5},
];
export const BOSSES = {
  artificial_demon:{name:'인조마신',color:'#8ee8ee',pattern:'seal',warning:'마력 봉인 · 빛나는 칸의 영웅을 옮기세요',frame:0},
  love_iris:{name:'사랑의 여신 아이리스',color:'#f7b6d4',pattern:'heal',warning:'치유의 기도 · 빠르게 공격해 끊으세요',frame:1},
  curse_iris:{name:'저주의 여신 아이리스',color:'#bc8be0',pattern:'drain',warning:'별빛 침식 · 필살기를 사용할 때입니다',frame:2},
  flora:{name:'꽃의 여신 플로라',color:'#c9dd8d',pattern:'heal',warning:'생명의 개화 · 빠르게 공격해 끊으세요',frame:3},
  poseidon:{name:'해신 포세이돈',color:'#77c9e3',pattern:'rush',warning:'밀려오는 해일 · 감속과 기절로 막으세요',frame:4},
  beelzebub:{name:'마신 벨제뷔트',color:'#dfa590',pattern:'seal',warning:'붕괴의 문장 · 빛나는 칸의 영웅을 옮기세요',frame:5},
};
export const ASSET_PATHS = {
  ...Object.fromEntries(HEROES.map(h=>[`unit-${h.id}`,`./assets/merge/units/${h.id}.webp`])),
  garden:'./assets/merge/garden.webp',bosses:'./assets/moonlit/realm-bosses.webp',
  creatures:'./assets/moonlit/creatures.webp',
};
export const ASSET_MANIFEST = Object.entries(ASSET_PATHS).map(([id,path])=>({id,path,type:'image',releaseRequired:true,hasAlpha:id!=='garden'}));
