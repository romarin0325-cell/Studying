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

export const STAGES = [
  { id: 0, name: '푸른 시간의 유적', en: 'THE AZURE RUINS', boss: '인조마신', subtitle: '별을 모방한 마음', color: '#7de4f5', dark: '#071d34', pattern: ['프리즘 세례', '청금석의 궤도', '불완전한 태양'], intro: '나는… 누구의 소원을 위해 태어났지?', outro: '따뜻해… 이게 진짜 별빛이구나.', duration: 42, hp: 3800 },
  { id: 1, name: '영원한 장미 정원', en: 'THE ETERNAL GARDEN', boss: '사랑의 여신 아이리스', subtitle: '놓아주지 못한 사랑', color: '#ffb4da', dark: '#321831', pattern: ['장미의 약속', '포옹의 나선', '영원이라는 새장'], intro: '여기 머물러요. 영원히 사랑받을 수 있도록.', outro: '사랑은… 붙잡는 것만은 아니었군요.', duration: 46, hp: 5000 },
  { id: 2, name: '빛을 잃은 성당', en: 'THE HOLLOW CATHEDRAL', boss: '저주의 여신 아일스', subtitle: '일곱 빛깔의 저주', color: '#cea1ff', dark: '#201330', pattern: ['깨진 무지개', '금단의 회랑', '일곱 번째 저주'], intro: '예쁜 빛일수록, 부서질 때 더 반짝이거든.', outro: '이런 결말도… 나쁘지는 않네.', duration: 50, hp: 6500 },
  { id: 3, name: '검은 태양의 왕좌', en: 'THRONE OF THE ECLIPSE', boss: '마신 벨제뷔트', subtitle: '마지막 밤의 군주', color: '#ed9bff', dark: '#1b102c', pattern: ['심연의 칙령', '멸망의 왕관', '검은 태양'], intro: '별은 꺼진다. 너희의 작은 소원도.', outro: '이 작은 빛들이… 밤을 끝내는가.', duration: 54, hp: 8500 }
];

export const UPGRADES = [
  { id: 'power', icon: '✦', name: '별의 심장', text: '공격력 +18%', detail: '더 밝고, 더 강하게.' },
  { id: 'life', icon: '♡', name: '새벽의 축복', text: '생명 2 회복', detail: '다음 하늘을 위한 작은 기도.' },
  { id: 'bomb', icon: '❖', name: '기적의 씨앗', text: '봄 1개 추가 · 최대 5', detail: '가장 필요한 순간에 피어나요.' }
];

export const LIMITS = Object.freeze({ enemies: 40, bullets: 360, shots: 170, particles: 180, pickups: 55, effects: 40 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
