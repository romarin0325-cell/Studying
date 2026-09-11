export const HEROES = [
  { id: 'rumi', name: '루미', title: '별을 엮는 대현자', en: 'RUMI', color: '#84ebf4', shadow: '#247d9f', sigil: '✧', quote: '가장 어두운 밤에도, 별은 네 곁에.', description: '태양과 달, 그리고 길을 잃지 않는 작은 별들.', bomb: '천체의 교향곡', bombInfo: '별빛이 모든 탄을 지우고, 5초간 유성우가 쏟아져요.', weapons: [
    { id: 'homing', name: '별의 편지', tag: '유도 · 안정형', description: '작은 별들이 적을 따라가요. 회피에 집중할 수 있어요.', power: 3, reach: 5 },
    { id: 'laser', name: '한낮의 태양', tag: '레이저 · 집중형', description: '정면을 꿰뚫는 햇빛. 같은 적을 조준하면 피해가 커져요.', power: 5, reach: 3 }
  ] },
  { id: 'luna', name: '루나', title: '달그림자의 암살자', en: 'LUNA', color: '#c7a4ff', shadow: '#6340aa', sigil: '☾', quote: '눈을 감아. 그림자는 내가 벨 테니까.', description: '달빛을 삼킨 칼날, 소리 없이 펼쳐지는 어둠.', bomb: '월식 · 그림자 춤', bombInfo: '탄을 지우고 4초간 무적. 그림자 분신이 적을 연속으로 베어요.', weapons: [
    { id: 'dagger', name: '그믐의 칼날', tag: '관통 · 고속형', description: '빠른 그림자 칼날이 적의 대열을 관통해요.', power: 4, reach: 4 },
    { id: 'melee', name: '월하난무', tag: '근접 · 고위험', description: '넓은 전방 참격. 가까이 다가가면 강력해지고 적탄도 베어요.', power: 5, reach: 2 }
  ] },
  { id: 'zeke', name: '지크', title: '새벽을 여는 화염검사', en: 'ZEKE', color: '#ffb27e', shadow: '#a04430', sigil: '✦', quote: '길이 없다면, 내가 먼저 열겠어.', description: '꺾이지 않는 검과 세 갈래로 타오르는 불꽃.', bomb: '홍련 · 불사조', bombInfo: '불사조가 전장을 휩쓸어요. 5초간 화력이 60% 증가해요.', weapons: [
    { id: 'spread', name: '홍련의 날개', tag: '3웨이 · 광역형', description: '세 방향의 불꽃이 넓게 퍼져요. 파워업으로 화염이 늘어나요.', power: 3, reach: 5 },
    { id: 'lance', name: '여명을 가르는 검', tag: '관통 · 폭발형', description: '거대한 불의 검을 발사해요. 관통한 적에게 폭발을 남겨요.', power: 5, reach: 3 }
  ] },
  { id: 'jasmine', name: '자스민', title: '꽃과 원소의 성녀', en: 'JASMINE', color: '#f5dba2', shadow: '#9f793e', sigil: '❀', quote: '상처 난 하늘에도, 다시 꽃은 피어나요.', description: '신성한 꽃의 기도와 적을 잇는 원소의 선율.', bomb: '에덴의 기도', bombInfo: '탄을 지우고 생명 1개를 회복해요. 잠시 성역이 적을 공격해요.', weapons: [
    { id: 'chain', name: '원소의 노래', tag: '체인 · 연쇄형', description: '가까운 적에서 다음 적으로 번개가 이어져요.', power: 4, reach: 4 },
    { id: 'petal', name: '성화의 정원', tag: '꽃탄 · 방어형', description: '꽃잎이 넓게 회전하며 퍼지고, 작은 성역이 몸을 감싸요.', power: 3, reach: 4 }
  ] }
];

HEROES.push(
  { id: 'snow', name: '눈토끼', title: '겨울을 깨우는 설원 마법사', en: 'SNOW RABBIT', gender: 'male', color: '#a5eaff', shadow: '#467dad', sigil: '❄', quote: '차가운 바람도, 우리 편으로 만들면 돼.', description: '얼음 결정으로 적을 늦추고 눈꽃을 튕기는 남성 마법사.', bomb: '프로즌 월드', bombInfo: '5초간 적과 적탄을 느리게 하고 눈보라로 공격해요.', weapons: [
    { id: 'frost', name: '프로즌 샤드', tag: '빙결 · 제어형', description: '쌍얼음창이 적을 관통하고 잠시 느리게 해요.', power: 4, reach: 4 },
    { id: 'snowflake', name: '스노우 바운드', tag: '도약 · 추적형', description: '눈꽃이 명중한 적에서 다른 적에게 최대 세 번 튕겨요.', power: 3, reach: 5 }
  ] },
  { id: 'cinderella', name: '신데렐라', title: '자정을 거스르는 유리 마법사', en: 'CINDERELLA', gender: 'male', color: '#ffc4e3', shadow: '#a35196', sigil: '♢', quote: '열두 시가 지나도, 우리의 마법은 계속돼.', description: '크리스탈 킥과 미드나잇 스펠을 다루는 남성 마법사.', bomb: '미드나잇 · 미라클', bombInfo: '유리시계가 탄을 지우고, 5초간 유리 결정이 적에게 연속으로 폭발해요.', weapons: [
    { id: 'glass', name: '크리스탈 킥', tag: '유리창 · 관통형', description: '엇갈리는 유리구두 궤적이 적을 꿰뚫어요.', power: 5, reach: 3 },
    { id: 'midnight', name: '미드나잇 스펠', tag: '표식 · 폭발형', description: '유도 마법이 세 번 명중하면 표식이 주변까지 폭발해요.', power: 4, reach: 4 }
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
STAGES.forEach((stage, i) => { stage.name = DUNGEONS[i].name; stage.en = DUNGEONS[i].en; });
STAGES[0].pattern = ['아이스빔', '프리즘 세례', '파괴의 형태'];
STAGES[1].pattern = ['홀리 레이', '소울 드레인', '더 홀리'];
STAGES[2].boss = '저주의 여신 아이리스'; STAGES[2].pattern = ['프레임 샷', '금단의 회랑', '아포칼립스'];
STAGES[3].pattern = ['다크니스', '멸망의 왕관', '제노사이드'];

export const LIMITS = Object.freeze({ enemies: 40, bullets: 360, shots: 170, particles: 180, pickups: 55, effects: 40 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
