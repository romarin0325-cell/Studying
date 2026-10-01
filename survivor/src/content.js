export const VERSION = 1;
export const WORLD = 1600;
export const LIMITS = Object.freeze({ enemies: 260, shots: 240, drops: 300, fields: 50, hazards: 90, events: 180 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const length = (x, y) => Math.hypot(x, y);
export const clock = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// Identity is shared with Card and Defense. Abilities are adapted to real-time survival.
export const HEROES = [
  { id:'rumi',name:'루미',en:'RUMI',title:'별을 엮는 마법사',color:'#8be6ed',weapon:'star',mark:'✧',hp:100,speed:175,trait:'별빛을 모을수록, 꿈은 더 멀리.',passive:'경험치 +15% · 획득 범위 +25%',quote:'가장 어두운 밤에도, 별은 네 곁에.',skill:'밀키웨이 엑스터시',skillText:'유성우가 적을 추적하고 주변 적을 밀어냅니다.',identity:'금발 단발, 청록색 눈과 리본, 흰 모자와 긴 망토. 신발 없이 맨발에 청록 리본을 묶은 남성 마법사.' },
  { id:'luna',name:'루나',en:'LUNA',title:'달그림자의 암살자',color:'#c7a6f8',weapon:'blade',mark:'☾',hp:90,speed:190,trait:'달이 사라진 자리에도, 칼날은 남아.',passive:'치명타 +15% · 처형 피해 +35%',quote:'눈을 감아. 그림자는 내가 벨 테니까.',skill:'이클립스',skillText:'달빛 분신이 연속 참격을 날립니다. 2초 동안 무적.',identity:'은보라 단발과 보라색 눈, 검은 레이스 후드와 망토, 금빛 장식. 오른손에 옅은 보라색 단검을 든 여성 암살자.' },
  { id:'zeke',name:'지크',en:'ZEKE',title:'새벽을 여는 화염검사',color:'#ffab7e',weapon:'ember',mark:'✦',hp:125,speed:170,trait:'내가 먼저, 새벽으로 가는 길을 열겠어.',passive:'최대 생명 +25 · 화상 피해 +40%',quote:'길이 없다면, 내가 먼저 열겠어.',skill:'샤이닝 플레임',skillText:'불사조가 전장을 휩쓸고 5초 동안 공격력이 40% 증가합니다.',identity:'금빛 끝의 붉은 머리, 붉은 눈, 붉은 롱코트와 검은 갑옷. 오른손의 호박색 중심 검을 지닌 남성 검사.' },
  { id:'jasmine',name:'자스민',en:'JASMINE',title:'꽃과 원소의 성녀',color:'#f6df9d',weapon:'flower',mark:'❀',hp:110,speed:170,trait:'상처 난 하늘에도, 꽃은 다시 피어나요.',passive:'10초마다 생명 2 회복 · 성역 범위 +15%',quote:'우리의 작은 빛을, 끝까지 지켜요.',skill:'더 홀리',skillText:'생명 25% 회복. 5초 동안 적을 공격하는 성역을 만듭니다.',identity:'긴 연보라 머리와 파란 눈, 금빛 태양 왕관, 긴 흰 드레스와 늘어진 소매. 왼손에 금빛 태양 지팡이를 든 여성 성녀.' },
  { id:'snow_rabbit',name:'눈토끼',en:'SNOW RABBIT',title:'겨울의 작은 발자국',color:'#a6e5fa',weapon:'frost',mark:'❄',hp:95,speed:180,trait:'차가운 바람도, 우리 편으로 만들면 돼.',passive:'빙결 지속 +40% · 토끼 무기 공명',quote:'얼어붙은 밤에도, 발자국은 이어져.',skill:'프로즌 월드',skillText:'적을 5.6초 동안 얼립니다. 눈꽃 폭풍이 4초간 이어집니다.',identity:'하늘색 단발과 파란 눈, 흰 토끼 귀, 청록 나비넥타이와 바니 의상, 흰 레그웨어. 남성 토끼 정령, 지팡이 없음.' },
  { id:'night_rabbit',name:'밤토끼',en:'NIGHT RABBIT',title:'잠들지 못한 밤의 친구',color:'#d0b0f4',weapon:'dream',mark:'☽',hp:110,speed:180,trait:'잠이 오지 않으면, 나랑 조금만 더 있자.',passive:'꿈 장판 지속 +30% · 토끼 무기 공명',quote:'오늘 밤은, 혼자 버티지 않아도 돼.',skill:'굿나잇 허그',skillText:'큰 꿈의 장판이 적을 감속하고 지속 피해를 줍니다. 생명 15 회복.',identity:'흰 곱슬 단발과 보라색 눈, 토끼 귀, 검은 오버사이즈 후드, 흰 레그워머, 하트 버클 검은 신발. 남성 토끼 정령.' },
  { id:'cinderella',name:'신데렐라',en:'CINDERELLA',title:'자정을 거스르는 기적',color:'#f5b5d0',weapon:'glass',mark:'♢',hp:100,speed:180,trait:'열두 시가 지나도, 우리의 마법은 계속돼.',passive:'유리 관통 +1 · 결정 보상 +20%',quote:'이 밤의 끝에도, 나는 나로 남을 거야.',skill:'미드나잇 미라클',skillText:'여섯 갈래 유리창이 퍼지고 주변에서 유리 별이 연속 폭발합니다.',identity:'흰 긴 트윈테일과 붉은 눈, 분홍 머리 리본, 흰·분홍 드레스와 앞면 붉은 목 리본. 평평한 가슴을 가진 남성 유리 마법사.' },
  { id:'silver_rabbit',name:'은토끼',en:'SILVER RABBIT',title:'새벽을 잇는 발자국',color:'#eee2a7',weapon:'sun',mark:'☀',hp:105,speed:185,trait:'눈부시지 않아도, 빛은 길을 기억해.',passive:'필살기 충전 +25% · 토끼 무기 공명',quote:'아직, 우리의 새벽은 끝나지 않았어.',skill:'은빛 행진',skillText:'태양빛이 적을 관통합니다. 6초 동안 이동과 공격속도 +35%.',identity:'금빛 아래쪽 머리의 은백색 머리, 금빛 눈, 흰 토끼 귀, 태양 후광과 베일. 흰 하이넥 의상과 금빛 태양 메달의 남성 토끼 정령.' },
  { id:'time_ruler',name:'시간의지배자',en:'TIME RULER',title:'멈춘 시계의 여왕',color:'#bfc0f7',weapon:'clock',mark:'◷',hp:95,speed:175,trait:'아직 오지 않은 순간은, 바꿀 수 있어.',passive:'재사용 대기시간 -10% · 시간장 +20%',quote:'이 순간만큼은, 내 곁에 머물러.',skill:'타임 리와인드',skillText:'모든 적이 4초 동안 멈춥니다. 최근 받은 피해 일부를 회복합니다.',identity:'은빛 긴 머리와 붉은 눈, 검은 드레스와 시계 장식. Card·Defense의 시간의지배자이며 Shooter의 시간의마술사와 별도 인물.' }
];
export const HERO = Object.fromEntries(HEROES.map(h=>[h.id,h]));
export const OWNER_NAMES = {...Object.fromEntries(HEROES.map(h=>[h.id,h.name])),storm_sage:'폭풍의현자',lightning_sage:'번개의현자',queen:'여왕',galaxy_whale:'은하고래',great_detective:'명탐정'};
const weapon = (id,name,owner,color,icon,kind,damage,cooldown,text,relic,evolution) => ({id,name,owner,color,icon,kind,damage,cooldown,text,relic,evolution,max:6});
export const WEAPONS = [
  weapon('star','별의 편지','rumi','#8be6ed','✧','homing',18,.85,'가장 가까운 적을 따라가는 별빛.','prism','밀키웨이'),
  weapon('blade','루나틱 위치','luna','#c7a6f8','☾','blade',32,1.05,'적의 대열을 꿰뚫는 달빛 단검.','lens','이터널 이클립스'),
  weapon('ember','프로미넌스','zeke','#ffab7e','✦','slash',42,1.25,'넓은 불꽃 검격과 오래 남는 화상.','ember','불사조의 맹세'),
  weapon('flower','홀리 플라워','jasmine','#f6df9d','❀','chain',24,1.35,'꽃빛 번개가 적과 적 사이를 이어요.','seed','여신 강림'),
  weapon('frost','실버 스톰','snow_rabbit','#a6e5fa','❄','frost',23,1.1,'관통 얼음창. 적의 걸음을 늦춥니다.','frost','프로즌 월드'),
  weapon('dream','슬립리스 나이트','night_rabbit','#d0b0f4','☽','field',16,2.4,'꿈의 씨앗이 지속 피해 장판을 만듭니다.','roots','깨어나지 않는 밤'),
  weapon('glass','크리스탈 킥','cinderella','#f5b5d0','♢','glass',25,1.05,'엇갈리는 유리창과 파편 폭발.','mirror','미드나잇 미라클'),
  weapon('sun','헤븐리 루어','silver_rabbit','#eee2a7','☀','sun',28,1.6,'태양 광선이 적의 대열을 가릅니다.','lantern','새벽의 행진'),
  weapon('clock','시계의 정원','time_ruler','#bfc0f7','◷','clock',16,2.5,'멈춘 시계가 적을 늦추며 공격합니다.','hourglass','스톱 더 월드'),
  weapon('storm','태풍의 눈','storm_sage','#94d6c4','≋','orbit',18,.65,'몸을 도는 바람의 칼날이 길을 엽니다.','feather','끝없는 바람'),
  weapon('thunder','천둥의 연쇄','lightning_sage','#f3db89','ϟ','chain',33,1.9,'가장 강한 적부터 이어지는 번개.','prism','천 갈래 벼락'),
  weapon('rose','로열 블룸','queen','#eeadbc','❁','field',20,2.8,'장미의 영역이 적을 묶어둡니다.','roots','영원한 장미'),
  weapon('cosmos','별바다의 중심','galaxy_whale','#9fbbf3','✵','gravity',14,3.5,'중력장이 적을 끌어당깁니다.','hourglass','은하의 심장'),
  weapon('light','완벽한 추리','great_detective','#f7e5b5','◇','snipe',90,2.5,'강한 적을 노리는 빛의 저격.','lens','진실의 새벽')
];
const evolvedDescriptions={"star": "추적 유성이 터지며 주변 적에게 파편 피해.", "blade": "더 많은 달빛 칼날이 부채꼴로 대열을 관통합니다.", "ember": "전방 검격이 전방위 불사조 화염으로 펼쳐집니다.", "flower": "꽃빛이 세 명 더 이어지고 공격 간격이 짧아집니다.", "frost": "얼음창이 적을 얼려 돌진을 끊습니다.", "dream": "꿈의 영역이 35% 넓어지고 오래 남습니다.", "glass": "관통하는 유리창이 명중할 때 파편 폭발을 일으킵니다.", "sun": "한 줄기 태양빛이 세 갈래로 갈라져 전장을 가릅니다.", "clock": "시계의 영역 안에서 적이 주기적으로 멈춥니다.", "storm": "두 개의 바람 칼날이 추가되어 주위를 휘감습니다.", "thunder": "연쇄 번개가 세 명 더 전이됩니다.", "rose": "장미 영역이 35% 넓어져 적의 길을 막습니다.", "cosmos": "중력장이 35% 넓어져 적을 한곳으로 끌어당깁니다.", "light": "빛의 저격이 적을 관통하고 뒤의 적까지 공격합니다."};
for(const w of WEAPONS)w.evolvedText=evolvedDescriptions[w.id];
export const WEAPON = Object.fromEntries(WEAPONS.map(w=>[w.id,w]));
export const EVOLUTION = Object.freeze({weapon:5,relic:1});
export const BONDS = [
  {id:'aurora',name:'오로라 폭풍',weapons:['star','thunder'],color:'#a1edfa',text:'별빛이 맞힌 적에게 0.8초마다 추가 연쇄 번개. 최대 3명에게 전이됩니다.'},
  {id:'steam',name:'서리불꽃',weapons:['ember','frost'],color:'#ffc5b4',text:'얼어붙거나 느려진 적에게 화염이 닿으면 폭발. 주변 적에게 추가 피해를 줍니다.'},
  {id:'bloom',name:'생명의 화원',weapons:['flower','rose'],color:'#f1c6c4',text:'꽃빛 공격이 더 멀리 이어지고, 20회 처치마다 생명을 5 회복합니다.'},
  {id:'nightfall',name:'꿈꾸는 은하',weapons:['dream','cosmos'],color:'#c7b6ff',text:'꿈과 중력장의 범위 +25%. 끌려온 적을 주기적으로 잠재웁니다.'}
];
export const BOND = Object.fromEntries(BONDS.map(b=>[b.id,b]));
export const RELICS = [
  {id:'prism',name:'천 갈래 프리즘',icon:'✧',color:'#8be6ed',text:'발사체 +1 · 무기 진화',stat:'amount',value:1},
  {id:'lens',name:'예리한 달조각',icon:'☾',color:'#c7a6f8',text:'치명타 +8% · 보스 피해 +12%',stat:'crit',value:.08},
  {id:'ember',name:'불씨의 심장',icon:'✦',color:'#ffab7e',text:'공격력 +12% · 화상 강화',stat:'damage',value:.12},
  {id:'seed',name:'숨 쉬는 씨앗',icon:'❀',color:'#a9deac',text:'생명 +15 · 생명 회복 +0.2/초',stat:'health',value:15},
  {id:'frost',name:'녹지 않는 꽃',icon:'❄',color:'#a6e5fa',text:'범위 +12% · 감속 강화',stat:'area',value:.12},
  {id:'roots',name:'영원의 뿌리',icon:'❁',color:'#b5d1a1',text:'장판 지속 +20% · 경험치 +5%',stat:'duration',value:.2},
  {id:'mirror',name:'쌍성의 거울',icon:'♢',color:'#f5b5d0',text:'공격력 +10% · 파편 폭발 강화',stat:'damage',value:.10},
  {id:'lantern',name:'꺼지지 않는 등불',icon:'☀',color:'#eee2a7',text:'필살기 충전 +15%',stat:'charge',value:.15},
  {id:'hourglass',name:'별모래 시계',icon:'◷',color:'#bfc0f7',text:'공격 대기시간 -6%',stat:'cooldown',value:.06},
  {id:'feather',name:'첫새벽의 깃털',icon:'➶',color:'#94d6c4',text:'이동속도 +10% · 회피 대기 -5%',stat:'speed',value:.1}
].map(r=>({...r,max:3}));
export const RELIC = Object.fromEntries(RELICS.map(r=>[r.id,r]));
export const STAGES = [
  {id:'garden',name:'별빛 정원',en:'THE STARLIT GARDEN',tag:'첫 번째 밤',description:'달빛이 내려앉은 정원. 흩어진 별들을 모아 새벽까지 살아남으세요.',duration:240,bg:'garden',enemy:0,boss:1,bossName:'장미의 파수꾼',color:'#9bcbbb',floor:'#1d3030',danger:1,chapter:'01',landmarks:['달의 샘','별의 등불','새벽의 기둥']},
  {id:'cathedral',name:'빛을 잃은 성당',en:'THE HOLLOW CATHEDRAL',tag:'두 번째 밤',description:'부서진 약속이 빛을 삼켰습니다. 저주받은 회랑을 건너세요.',duration:360,bg:'world2',enemy:2,boss:2,bossName:'황혼의 심판관',color:'#baacf1',floor:'#292539',danger:1.15,chapter:'02',landmarks:['유리의 제단','그림자 성좌','멈춘 시계']},
  {id:'rift',name:'혼돈의 틈',en:'THE EDGE OF NIGHT',tag:'마지막 밤',description:'검은 태양 아래 마지막 군세가 모입니다. 밤의 군주를 쓰러뜨리세요.',duration:480,bg:'world3',enemy:3,boss:3,bossName:'밤의 군주',color:'#eca891',floor:'#302128',danger:1.3,chapter:'03',landmarks:['불씨의 봉인','심연의 균열','잊힌 별']}
];
export const STAGE = Object.fromEntries(STAGES.map(s=>[s.id,s]));
export const META = [
  {id:'power',name:'별의 의지',icon:'✦',text:'모든 공격력 +5%',max:5,cost:35},
  {id:'heart',name:'새벽의 숨결',icon:'♡',text:'최대 생명 +10',max:5,cost:30},
  {id:'haste',name:'시간의 실',icon:'◷',text:'공격 대기시간 -3%',max:5,cost:45},
  {id:'magnet',name:'별을 모으는 손',icon:'✧',text:'획득 범위 +15%',max:5,cost:25},
  {id:'speed',name:'가벼운 발자국',icon:'➶',text:'이동속도 +3%',max:5,cost:25},
  {id:'growth',name:'기억의 정원',icon:'❀',text:'경험치 +5%',max:5,cost:40}
];
export const DIFFICULTIES = [
  {id:'gentle',name:'산책',text:'조금 더 여유로운 밤',hp:.75,damage:.7,density:.85,reward:.8},
  {id:'normal',name:'원정',text:'별빛을 지키는 도전',hp:1,damage:1,density:1,reward:1},
  {id:'eclipse',name:'일식',text:'더 거센 군세, 더 많은 보상',hp:1.35,damage:1.3,density:1.25,reward:1.5}
];
export const DIFFICULTY = Object.fromEntries(DIFFICULTIES.map(d=>[d.id,d]));
export const ACHIEVEMENTS = [
  {id:'first',name:'첫 번째 발자국',text:'한 번의 원정 마치기',reward:20},
  {id:'hundred',name:'작은 별의 군세',text:'한 원정에서 적 100마리 처치',reward:30},
  {id:'evolved',name:'별이 되는 순간',text:'무기 한 개 진화',reward:50},
  {id:'six',name:'우리의 별자리',text:'무기 여섯 개로 함께하기',reward:40},
  {id:'dawn',name:'밤을 건넌 사람',text:'별빛 정원 승리',reward:80},
  {id:'chapel',name:'다시 밝아진 성당',text:'성당 승리',reward:100},
  {id:'rift',name:'마지막 밤의 끝',text:'혼돈의 틈 승리',reward:120},
  {id:'eclipse',name:'검은 태양을 넘어서',text:'일식 난이도 승리',reward:100},
  {id:'travelers',name:'아홉 개의 이야기',text:'수호자 아홉 명으로 원정 마치기',reward:100}
];
