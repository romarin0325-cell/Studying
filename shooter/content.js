export const HEROES = [
  { id: 'rumi', name: '루미', title: '별을 엮는 대현자', en: 'RUMI', color: '#84ebf4', shadow: '#247d9f', sigil: '✧', quote: '가장 어두운 밤에도, 별은 네 곁에.', description: '태양과 달, 그리고 길을 잃지 않는 작은 별들.', bomb: '꿈의형태', bombInfo: '별빛이 모든 탄을 지우고, 4초간 유성우가 쏟아져요.', weapons: [
    { id: 'homing', name: '별의 편지', tag: '유도 · 안정형', description: '작은 별들이 적을 따라가요. 회피에 집중할 수 있어요.', power: 3, reach: 5 },
    { id: 'laser', name: '한낮의 태양', tag: '레이저 · 집중형', description: '정면을 꿰뚫는 햇빛. 같은 적을 조준하면 피해가 커져요.', power: 5, reach: 3 }
  ] },
  { id: 'luna', name: '루나', title: '달그림자의 암살자', en: 'LUNA', color: '#c7a4ff', shadow: '#6340aa', sigil: '☾', quote: '눈을 감아. 그림자는 내가 벨 테니까.', description: '달빛을 삼킨 칼날, 소리 없이 펼쳐지는 어둠.', bomb: '이클립스', bombInfo: '탄을 지우고 2초간 무적. 그림자 분신이 적을 연속으로 베어요.', weapons: [
    { id: 'dagger', name: '루나틱위치', tag: '관통 · 고속형', description: '빠른 그림자 칼날이 적의 대열을 관통해요.', power: 4, reach: 4 },
    { id: 'melee', name: '어쌔신', tag: '근접 · 고위험', description: '넓은 전방 참격. 가까이 다가가면 강력해지고 적탄도 베어요.', power: 5, reach: 2 }
  ] },
  { id: 'zeke', radius: 6, speed: 1100, name: '지크', title: '새벽을 여는 화염검사', en: 'ZEKE', color: '#ffb27e', shadow: '#a04430', sigil: '✦', quote: '길이 없다면, 내가 먼저 열겠어.', description: '꺾이지 않는 검과 세 갈래로 타오르는 불꽃.', bomb: '샤이닝플레임', bombInfo: '불사조가 전장을 휩쓸어요. 3초간 화력이 75% 증가해요.', weapons: [
    { id: 'spread', name: '프레임윙', tag: '3웨이 · 광역형', description: '세 방향의 불꽃이 넓게 퍼져요. 파워업으로 화염이 늘어나요.', power: 3, reach: 5 },
    { id: 'lance', name: '프로미넌스', tag: '관통 · 폭발형', description: '거대한 불의 검을 발사해요. 관통한 적에게 폭발을 남겨요.', power: 5, reach: 3 }
  ] },
  { id: 'jasmine', name: '자스민', title: '꽃과 원소의 성녀', en: 'JASMINE', color: '#f5dba2', shadow: '#9f793e', sigil: '❀', quote: '상처 난 하늘에도, 다시 꽃은 피어나요.', description: '신성한 꽃의 기도와 적을 잇는 원소의 선율.', bomb: '더홀리', bombInfo: '탄을 지우고 생명 1개를 회복해요. 3초간 성역이 적을 공격해요.', weapons: [
    { id: 'chain', name: '라이트닝체인', tag: '체인 · 연쇄형', description: '가까운 적에서 다음 적으로 번개가 이어져요.', power: 4, reach: 4 },
    { id: 'petal', name: '홀리플라워', tag: '꽃탄 · 방어형', description: '꽃잎이 넓게 회전하며 퍼지고, 작은 성역이 몸을 감싸요.', power: 3, reach: 4 }
  ] }
];

HEROES.push(
  { id: 'snow', radius: 4, name: '눈토끼', title: '겨울을 깨우는 설원 마법사', en: 'SNOW RABBIT', gender: 'male', color: '#a5eaff', shadow: '#467dad', sigil: '❄', quote: '차가운 바람도, 우리 편으로 만들면 돼.', description: '얼음 결정으로 적을 늦추고 눈꽃을 튕기는 남성 마법사.', bomb: '프로즌 월드', bombInfo: '3초간 눈보라로 공격해요. 무적이 끝난 뒤에도 5초간 적과 적탄의 감속이 남아요.', weapons: [
    { id: 'frost', name: '프로즌 샤드', tag: '빙결 · 제어형', description: '쌍얼음창이 적을 관통하고 느리게 해요.', power: 4, reach: 4 },
    { id: 'snowflake', name: '스노우 바운드', tag: '도약 · 추적형', description: '눈꽃이 다른 적에게 연속으로 튕겨요.', power: 3, reach: 5 }
  ] },
  { id: 'cinderella', hidden: true, lifeBonus: 1, name: '신데렐라', title: '자정을 거스르는 유리 마법사', en: 'CINDERELLA', gender: 'male', color: '#ffc4e3', shadow: '#a35196', sigil: '♢', quote: '열두 시가 지나도, 우리의 마법은 계속돼.', description: '크리스탈 킥과 미드나잇 스펠을 다루는 남성 마법사.', bomb: '미드나잇 · 미라클', bombInfo: '유리시계가 탄을 지우고, 3초간 유리 결정이 적에게 연속으로 폭발해요.', weapons: [
    { id: 'glass', name: '크리스탈 킥', tag: '유리창 · 관통형', description: '두 유리창이 적을 관통해요.', power: 5, reach: 3 },
    { id: 'midnight', name: '미드나잇 스펠', tag: '표식 · 폭발형', description: '세 번 명중하면 표식이 폭발해요.', power: 4, reach: 4 }
  ] }
);
HEROES.push(
  { id: 'night', bombBonus: 1, name: '밤토끼', title: '잠들지 못한 밤의 친구', en: 'NIGHT RABBIT', gender: 'male', radius: 4, color: '#dcadff', shadow: '#785494', sigil: '☽', quote: '잠이 오지 않으면, 나랑 조금만 더 있자.', description: '흰 곱슬머리와 검은 후드. 조용히 오래 머무는 밤의 마법.', bomb: '굿나잇 허그', bombInfo: '3초간 총 1900의 피해를 줘요. 사용하면 파워가 1단계 내려가요.', weapons: [
    { id: 'nightfall', name: '문드롭', tag: '대형탄 · 일격형', description: '묵직한 달이 전방으로 곧게 날아가요.', power: 4, reach: 4 },
    { id: 'dreamfield', name: '슬립리스 나이트', tag: '장판 · 지속형', description: '꿈의 씨앗이 3초간 장판을 남겨요.', power: 3, reach: 5 }
  ] },
  { id: 'sisters', bombBonus: 1, name: '루나&자스민', hidden: true, lifeBonus: 1, radius: 6, title: '이야기 속에서만 만난 내일', en: 'AN UNWRITTEN TOMORROW', color: '#e3c4fa', shadow: '#866599', sigil: '∞', quote: '이 이야기에서만큼은, 끝까지 손을 놓지 말자.', description: '이야기꾼 루나의 소망 속 모습. 서로의 진심을 이해하고 함께한 미래는 현실에 오지 않았어요.', bomb: '끝나지 않는 이야기', bombInfo: '함께 바란 내일이 펼쳐져 3초간 탄을 지우고 전장을 감싸요.', weapons: [
    { id: 'promise', name: '이어 쓴 내일', tag: '약속 · 추적형', description: '두 빛이 적을 따라가며 반향을 남겨요.', power: 5, reach: 5 },
    { id: 'haven', name: '우리의 작은 집', tag: '영역 · 집중형', description: '적 곁에 지속 피해를 주는 안식처를 만들어요.', power: 5, reach: 4 }
  ] },
  { id: 'time', name: '시간의마술사', hidden: true, lifeBonus: 1, title: '열두 시에 남겨진 소망', en: 'THE TIME MAGICIAN', color: '#efa5ed', shadow: '#875397', sigil: '◷', quote: '이번에는… 다른 결말일 수 있을까.', description: '바뀌지 않는 결말을 수없이 돌려본 소년. 누군가 그 절망이 틀렸다고 말해주기를 기다려요.', bomb: '다크신데렐라', bombInfo: '약한 전체 공격 후 10초간 강력한 유리탄을 쏴요. 무적은 처음 2초예요.', weapons: [
    { id: 'rewind', name: '리와인드', tag: '시계침 · 관통형', description: '엇갈린 두 시간의 바늘이 적을 관통하며 하늘을 다시 써요.', power: 4, reach: 4 },
    { id: 'orbit', name: '멈춰 버린 내일', tag: '회전 · 근접형', description: '전방을 넓게 도는 두 시계가 큰 피해를 줘요. 코어를 들이대지 않아도 닿는 거리예요.', power: 5, reach: 3 }
  ] }
);
export const STAGES = [
  { id: 0, name: '푸른 시간의 유적', en: 'THE AZURE RUINS', boss: '인조마신', subtitle: '별을 모방한 마음', color: '#7de4f5', dark: '#071d34', pattern: ['프리즘 세례', '청금석의 궤도', '불완전한 태양'], intro: '나는… 누구의 소원을 위해 태어났지?', outro: '따뜻해… 이게 진짜 별빛이구나.', duration: 42, hp: 3800 },
  { id: 1, name: '영원한 장미 정원', en: 'THE ETERNAL GARDEN', boss: '사랑의 여신 아이리스', subtitle: '놓아주지 못한 사랑', color: '#ffb4da', dark: '#321831', pattern: ['장미의 약속', '포옹의 나선', '영원이라는 새장'], intro: '여기 머물러요. 영원히 사랑받을 수 있도록.', outro: '사랑은… 붙잡는 것만은 아니었군요.', duration: 46, hp: 5000 },
  { id: 2, name: '빛을 잃은 성당', en: 'THE HOLLOW CATHEDRAL', boss: '저주의 여신 아일스', subtitle: '일곱 빛깔의 저주', color: '#cea1ff', dark: '#201330', pattern: ['깨진 무지개', '금단의 회랑', '일곱 번째 저주'], intro: '예쁜 빛일수록, 부서질 때 더 반짝이거든.', outro: '이런 결말도… 나쁘지는 않네.', duration: 50, hp: 6500 },
  { id: 3, name: '검은 태양의 왕좌', en: 'THRONE OF THE ECLIPSE', boss: '마신 벨제뷔트', subtitle: '마지막 밤의 군주', color: '#ed9bff', dark: '#1b102c', pattern: ['심연의 칙령', '멸망의 왕관', '검은 태양'], intro: '별은 꺼진다. 너희의 작은 소원도.', outro: '이 작은 빛들이… 밤을 끝내는가.', duration: 54, hp: 8500 }
];

export const DUNGEONS = [
  { id: 0, name: '마도제국', en: 'ARCANE EMPIRE', sentinel: '프리즘 집행관', special: '폭주 마력핵', mechanic: '격파 후 경고 원이 터져요. 자폭 범위를 벗어나세요.', rooms: ['제국의 외곽', '프리즘 관문', '인조 신의 실험실'] },
  { id: 1, name: '빛의 신전', en: 'TEMPLE OF LIGHT', sentinel: '장미의 성전기사', special: '분열의 세라핌', mechanic: '격파하면 작은 고속 적 세 마리로 분열해요.', rooms: ['장미의 회랑', '서약의 관문', '영원한 사랑의 제단'] },
  { id: 2, name: '어둠의 신전', en: 'TEMPLE OF SHADOW', sentinel: '황혼의 심판관', special: '저주 시계', mechanic: '시계가 차기 전에 격파하세요. 늦으면 탄막이 터져요.', rooms: ['그림자 회랑', '저주의 관문', '일곱 빛의 파멸'] },
  { id: 3, name: '혼돈의 틈', en: 'RIFT OF CHAOS', sentinel: '심연의 문지기', special: '혼돈의 배아', mechanic: '느린 대형탄이 다가오면 여러 탄으로 갈라져요.', rooms: ['균열의 가장자리', '심연의 관문', '검은 태양의 왕좌'] }
];
// Keep ordering and save migration explicit: the former fourth dungeon is now last.
STAGES.splice(3,0,
  { id:3,name:'요정의 숲',en:'FOREST OF FAIRIES',boss:'꽃의 여신 플로라',subtitle:'다시 피어나는 소원',color:'#ffb4de',dark:'#112a29',pattern:['꽃잎의 윤무','봄의 미로','만개'],intro:'작은 꽃도 자신의 계절을 기다려요.',outro:'당신의 소원도… 피어나기를.',duration:54,hp:8500 },
  { id:4,name:'해저신전',en:'THE SUNKEN TEMPLE',boss:'해신 포세이돈',subtitle:'깊은 바다의 심판',color:'#77e6ff',dark:'#082636',pattern:['해류의 창','해신의 십자','대해일'],intro:'심연을 건넌 자여, 파도를 견뎌라.',outro:'너희의 의지… 바다에도 새겨 두마.',duration:58,hp:11000 }
);
DUNGEONS.splice(3,0,
  {id:3,name:'요정의 숲',en:'FOREST OF FAIRIES',sentinel:'꽃숲의 파수꾼',special:'공간의 요정',mechanic:'강인한 요정이 꽃무늬 예고 지점으로 순간이동해요.',rooms:['꽃빛의 오솔길','수호목의 관문','만개하는 성소']},
  {id:4,name:'해저신전',en:'THE SUNKEN TEMPLE',sentinel:'해저의 성기사',special:'반향의 해령',mechanic:'해령의 탄은 5초 동안 화면 가장자리에서 반사돼요.',rooms:['가라앉은 회랑','해류의 관문','해신의 왕좌']}
);
// Bring the lower skies closer to Chaos while preserving a clear step at every dungeon.
[4200,5600,7400,9600,12500,17000].forEach((hp,i)=>{STAGES[i].hp=hp;});
STAGES[5].id=5;DUNGEONS[5].id=5;
DUNGEONS[5].mechanic='최종 도전 · 높은 체력과 빠른 탄막, 분열탄과 심연의 레이저가 겹쳐요. 유물을 준비하세요.';
STAGES.forEach((stage, i) => { stage.name = DUNGEONS[i].name; stage.en = DUNGEONS[i].en; });
STAGES[0].pattern = ['아이스빔', '프리즘 세례', '파괴의 형태'];
STAGES[1].pattern = ['홀리 레이', '소울 드레인', '더 홀리'];
STAGES[2].boss = '저주의 여신 아이리스'; STAGES[2].pattern = ['프레임 샷', '금단의 회랑', '아포칼립스'];
STAGES[5].pattern = ['다크니스', '멸망의 왕관', '제노사이드'];

// The seventh sky belongs only to the continuous challenge.
DUNGEONS.push({id:6,challengeOnly:true,name:'천계의 계단',en:'STAIRWAY TO ETERNITY',sentinel:'빛의 문지기',special:'천계의 수호자',mechanic:'공간을 넘는 수호자와 분열하는 빛 너머, 창조신이 기다려요.',rooms:['여명의 계단','갈라지는 빛의 관문','창조의 옥좌']});
STAGES.push({id:6,name:'천계의 계단',en:'STAIRWAY TO ETERNITY',boss:'창조신 아스테아',subtitle:'모든 하늘의 시작',color:'#ffe1a3',dark:'#211d37',pattern:['앱솔루트 라이트','디바인 블레이드','저지먼트'],intro:'이곳까지 닿은 너희의 소망을 보여 주렴.',outro:'너희가 걸어갈 하늘은, 이제 너희의 것이란다.',duration:62,hp:22000});
const weaponNames={dagger:'루나틱 위치',spread:'프레임 윙',chain:'라이트닝 체인',petal:'홀리 플라워',nightfall:'문 드롭'};
HEROES.forEach(hero=>hero.weapons.forEach(weapon=>{if(weaponNames[weapon.id])weapon.name=weaponNames[weapon.id];}));

export const LIMITS = Object.freeze({ enemies: 40, bullets: 360, shots: 170, particles: 180, pickups: 55, effects: 40 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
