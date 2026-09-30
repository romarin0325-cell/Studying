import { HEROES, DUNGEONS, STAGES } from './content.js';
import { ARTIFACTS, DIFFICULTIES, COSTUME_TIERS, COSTUMES, artifactText } from './meta.js';
import { LIBRARY } from './learning.js';
import { MANUAL_BALANCE } from './manual-data.js';

export const MANUAL_TABS=[['guide','진행'],['heroes','캐릭터'],['stages','스테이지'],['artifacts','유물'],['content','콘텐츠']];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value).toLocaleString('ko-KR',{maximumFractionDigits:1});
const table=(headers,rows)=>'<div class="manual-table-wrap"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const block=(title,body)=>'<section class="manual-section"><h3>'+escape(title)+'</h3>'+body+'</section>';
const weaponEffects={
  homing:'유도 별탄. P1/P3/P5에서 한 번에 2/3/4발. 회피 중에도 적을 추적한다.',
  laser:'정면 레이저로 선상 적을 동시 공격. 같은 적을 3.25초 조준하면 최대 +65%. 0.15초 넘게 조준이 끊기면 집중이 초기화된다.',
  dagger:'직선 관통 단검 2발. 빠른 탄속으로 앞뒤의 적을 함께 공격한다.',
  melee:'전방 참격과 원거리 보조 검기. 사거리 156+8×P, 적이 100 이내에 있으면 참격 피해 +50%. 사거리의 72% 안쪽 전방 적탄을 삭제한다.',
  spread:'화염 3웨이. P3부터 보조 화염 3발 추가. 적 크기와 거리에 따라 여러 발이 겹쳐 맞는다.',
  lance:'큰 관통 화염검. 관통 시 폭발 이펙트가 생기며 이펙트 자체의 별도 피해는 없다.',
  chain:'530 이내 첫 적을 찾고, 210 이내 다음 적으로 연쇄. P1/P3/P5에서 최대 3/4/5체. 같은 적을 한 번씩만 공격하며 적이 없으면 발사하지 않는다.',
  petal:'물결치는 꽃탄 3발. P5에는 유도 기능. 코어 28 이내 적탄을 주기적으로 지우는 방어 효과.',
  frost:'쌍얼음창 관통. 적을 1.6초 느리게 하며 P5에서는 2초. 보스 이동은 일반 적의 둔화와 별도로 처리된다.',
  snowflake:'유도 눈꽃. 다른 적이 300 이내에 있으면 최대 3회 도약, P5에서는 4회. 같은 적을 재타격하지 않는다.',
  glass:'엇갈리는 관통 유리창 2발. P5에서 탄 크기 +10%.',
  midnight:'유도 표식탄. 같은 적에게 3회 적중하면 주변에 해당 탄 피해의 2.5배 폭발. 폭발 반경 100, P5에서 120.',
  nightfall:'느린 대형 직선 달탄. P5에서 탄 반경이 10 증가한다.',
  dreamfield:'직선 별탄과 1.15초 간격의 유도 씨앗. 적중 또는 시간 경과 시 3초 장판, 0.15초 간격 피해. 같은 종류의 가까운 장판은 중첩 대신 갱신된다.',
  promise:'두 유도탄과 주변 적에게 30% 반향 피해. 반향 반경 80, P5에서 96. 첫 표적에는 반향이 재적용되지 않는다.',
  haven:'유도탄이 적 곁에 3초 안식처를 만든다. 0.15초 간격 피해, 반경 100/P5 110. 가까운 안식처는 갱신된다.',
  rewind:'엇갈리는 관통 시계침 2발.',
  orbit:'전방 두 톱니가 지속 회전. 톱니별·적별 0.12초 재피격 대기시간. 이동 경로까지 검사해 빠른 드래그에서도 타격한다. 변신 중에는 중단된다.'
};
const bombEffects=[
  '전체 직접 공격과 4초간 유성우 피해·탄 제거.',
  '전체 직접 공격과 2초간 분신 참격·탄 제거.',
  '전체 직접 공격과 불사조. 3초간 일반 공격 기본 피해 ×1.75. 아래 봄 피해 수치는 동시 일반 공격을 제외한다.',
  '전체 공격·3초 성역·생명 1 회복(상한 적용). 광기의가면으로 생명을 지불한 봄은 생명을 회복하지 않는다.',
  '3초 눈보라. 발동부터 8초 동안 적과 적탄 감속, 무적은 처음 3초. 적탄 이동은 원래의 35%가 된다.',
  '전체 공격과 3초 유리 결정 폭발.',
  '전체 공격 1,900. 3초간 탄 제거·무적. 파워 1단계와 누적 P를 소모하며 P1 아래로 내려가지 않는다.',
  '전체 공격과 3초간 전장 피해·탄 제거.',
  '전체 직접 공격 80 후 10초간 다크신데렐라. P3 정면 표적 변신탄 누적 피해도 따로 표기한다. 무적·탄 제거는 발동 직후를 중심으로 적용되며, 2초가 지나면 피격될 수 있다.'
];
const bossMechanics=[
  '조준 부채탄 → 회전 링 → 조준탄과 세로 레이저.',
  '양쪽 하트 부채탄·회전 궤도, 마지막에는 빠른 조준탄 추가.',
  '회전 링·이동하는 안전 통로·회전 저주탄.',
  '교차하는 꽃잎 회전탄, 마지막에는 조준탄 추가.',
  '반사 부채탄과 가로·세로 십자 레이저.',
  '양쪽 부채탄·레이저·저속 분열탄이 겹친다.',
  '1페이즈 조준 7웨이와 상하 탄벽, 2페이즈 1.5초 교대 십자레이저, 3페이즈 하단탄·조준 5웨이·십자레이저.',
  '양쪽 하트 부채탄·꽃잎 링. 2페이즈부터 세로 레이저 추가.',
  '양쪽 비늘 부채탄·마지막 회전 링. 2페이즈부터 예고 위치에 고정되는 원형 폭발.',
  '회전하는 꽃잎 링·조준탄. 2페이즈부터 세로 레이저 추가.',
  '1초 예고 후 안전 통로를 남기는 대지 탄벽·링. 2페이즈부터 고정 위치 원형 폭발.',
  '발사 0.55초 뒤 멈추고 1.65초 뒤 다시 움직이는 시계탄, 마지막 조준탄. 2페이즈부터 고정 위치 원형 폭발.'
];

function guide() {
  return block('출격에서 클리어까지','<ol><li>수호자와 공격 스타일을 고르고 유물을 최대 3개 장착한다. 기본 생명·봄은 아래 난이도 표에, 캐릭터 추가 수치는 캐릭터 탭에 있다.</li><li>던전과 난이도를 선택해 출격한다. 공격은 자동이다. 각 던전은 일반 구간 → 중간보스 관문 → 최종보스의 3스테이지다.</li><li>1·2스테이지 종료 후 단어·숙어 퀴즈를 선택적으로 풀고, 정답이면 생명 1 또는 봄 1을 회복한다. 거절·오답도 다음 구간으로 진행한다.</li><li>마지막 문법 퀴즈 정답은 퀴즈 당시 점수 +10%. 이후 타임어택·랭크 보너스를 더한다. 주간 첫 클리어 보상을 받아 유물과 의상을 수집한다.</li></ol>')+
    block('조작과 생존','<p>화면을 누른 뒤 상대 드래그로 이동한다. 그림 대신 중앙의 작은 코어에만 피격 판정이 있다. 방향키/WASD 이동, Shift 정밀 이동, Space 또는 BLOOM 봄, Esc 일시정지. 키보드 기본 속도는 390, 정밀 속도는 160 게임 좌표/초이며 유물 속도 배율이 적용된다. 드래그 추적 한계는 캐릭터 탭에 별도로 표시한다.</p><p>봄은 적탄·위험 구역을 지우고 잠시 무적을 부여한다. 지속 중 다른 봄은 쓸 수 없다. 일반 피격 후 무적은 2.5초, 기본 파워는 1 감소한다. 생명이 0이 되면 선택 문법 퀴즈로 한 번 부활할 수 있다. 정답 시 생명 2(상한 적용), 챌린지는 21스테이지 전체에서 한 번이다.</p>')+
    block('파워와 점수','<p>P1에서 시작해 P5까지 성장한다. 보통 P 3개마다 한 단계, 루미·루나&amp;자스민은 4개다. 일반 구간은 정해진 P 드랍 대상의 90%에서, 챌린지 일반 몬스터는 처치당 20%에서 P가 나온다. 화면 위쪽 32%에서는 자동 흡인한다(카오스카니발 제외). 기본 근접 흡인 반경은 125다.</p><p>일반 적 연속 처치 10회마다 배율 +1, 최대 5배. 보스·보스 경고 중에는 1배다. 콤보 기본 유지 시간 3.6초이며 퀴즈·정리·적이 없는 동안 감소하지 않는다. 가까운 적탄을 스치면 스침 점수를 얻는다.</p><p>보스 20/30/40초 이내 격파: 15,000/10,000/5,000점. 던전 S/A/B는 피격 0/1~3/4회 이상, 보너스 4,000/2,000/0점. 챌린지 S/A/B는 피격 5회 이하/6~15/16회 이상, 보너스 10,000/5,000/0점. 보호막으로 막은 피격은 이 피격 횟수에 포함되지 않는다.</p>')+
    block('유물 없는 기본 난이도',table(['난이도','생명/최대','봄/최대','적 HP','탄속'],DIFFICULTIES.map(d=>[d.name,`${d.lives}/${d.maxLife}`,'3/5',`×${d.hp}`,`×${d.speed}`]))+'<p>심연은 여기에 던전별 일반 적·중간보스·보스 체력 배율과 강화 패턴을 더한다. 캐릭터의 추가 생명·봄, 유물 보너스는 각각 적용된다.</p>');
}
function heroes() {
  return block('DPS 측정 기준','<p>유물 없음·60Hz·고정 시드 41. 코어 (225,400), 정지 표적 (225,200), 표적 반경 38, 준비 3초 후 15초간 실제 적중 피해/초. P1/P3/P5를 각각 측정했다. 근거리 열은 표적 (225,320)의 P3다. 레이저 집중과 표식·장판을 포함하고, 봄·추가 페어리·다수 적 연쇄는 제외한다. 표적 크기·거리·이동·적 수에 따라 실전 DPS가 달라진다.</p>')+
    HEROES.map((hero,i)=>{
      const measured=MANUAL_BALANCE.heroes[i],bomb=measured.bomb;
      return '<details class="manual-detail" data-manual-hero="'+hero.id+'"'+(i===0?' open':'')+'><summary>'+escape(hero.name)+(hero.hidden?' · 랜덤 전용':'')+'</summary>'+block(hero.title,
        table(['난이도','생명/최대','봄/최대'],measured.modes.map(m=>[DIFFICULTIES.find(d=>d.id===m.id).name,`${m.lives}/${m.maxLife}`,`${m.bombs}/${m.maxBombs}`]))+
        '<p>피격 반경 <b>'+measured.radius+'</b> · 드래그 최대 추적 <b>'+measured.speed+'</b>/초 · 파워업 P <b>'+measured.powerRequirement+'</b>개. 게임 좌표는 전장 폭 450을 기준으로 한다. 의상은 전투 수치를 바꾸지 않는다.</p>')+
        hero.weapons.map((weapon,j)=>{const w=measured.weapons[j];return block(weapon.name+' · '+weapon.tag,table(['DPS P1','P3','P5','근거리 P3'],[[w.dps[1],w.dps[3],w.dps[5],w.closeDps]])+'<p>'+escape(weaponEffects[weapon.id])+'</p>');}).join('')+
        block(hero.bomb,'<p>한 적이 전 시간 살아 있고 적중하는 경우의 직접 피해 <b>'+number(bomb.damage)+'</b>'+(bomb.transformedDamage?' + 변신탄 <b>'+number(bomb.transformedDamage)+'</b> (P3, 정면)':'')+' · 지속 <b>'+bomb.duration+'초</b> · 무적 <b>'+bomb.invincibility+'초</b>.</p><p>'+escape(bombEffects[i])+'</p>')+'</details>';
    }).join('')+block('코로나와 피해 합산','<p>황금의태양은 캐릭터 봄을 직접 피해 '+number(MANUAL_BALANCE.corona.damage)+'의 코로나로 교체한다. 지속·무적 1초이며 캐릭터 고유 회복·강화·감속·변신·파워 소모를 대체한다.</p><p>상시·조건부 공격력은 합산해 한 번 적용한다. 일반 공격 전용 보너스는 봄에서 제외한다. 봄 전용 배율은 별도로 곱한다. 캐릭터 고유 배율은 그 뒤가 아니라 각 공격 기본 피해에 포함된다. 유물 탭에서 개별 효과와 챌린지 변형을 확인할 수 있다.</p>');
}
function stages() {
  return block('1~100 상대 난이도','<p>일반 6던전, 챌린지 전용 천계, 주간 이벤트 5종의 36스테이지 × 4난이도에 점수를 부여했다. 점수가 클수록 설계상 압박이 크다. HP·일반탄 속도/간격·웨이브 시간·기믹 가중치를 사용한 개발 참고 지수이며 사람의 클리어율 측정은 아니다. 챌린지의 누적 자원 소모와 추가 유물은 이 기본값에 포함하지 않는다.</p>')+
    DUNGEONS.map(d=>{
      const rows=MANUAL_BALANCE.stages.filter(s=>s.dungeon===d.id);
      return '<details class="manual-detail" data-manual-dungeon="'+d.id+'"'+(d.id===0?' open':'')+'><summary>'+escape(d.name)+(d.challengeOnly?' · 챌린지 전용':d.event?' · 주간 이벤트':'')+'</summary>'+block('각 스테이지 점수',table(['구간','쉬움','보통','어려움','심연'],rows.map(s=>[`${s.room+1} ${s.name}`,...DIFFICULTIES.map(m=>s.modes[m.id].score)]))+table(['보통 기준','웨이브 초','일반 적 HP','관문 HP'],rows.map(s=>[`${s.room+1}스테이지`,s.modes.normal.waveSeconds,number(s.modes.normal.enemyHp),s.modes.normal.gateHp?number(s.modes.normal.gateHp):'없음'])))+
        block('주요 기믹','<p><b>1. '+escape(d.special)+'</b> · '+escape(d.mechanic)+'</p><p><b>2. '+escape(d.sentinel)+'</b> · 일반 기믹과 중간보스를 격파해야 종료된다.</p><p><b>3. '+escape(STAGES[d.id].boss)+'</b> · 일반 구간 뒤 최종보스. '+escape(bossMechanics[d.id])+'</p><p>보스 체력 67%/34%에서 페이즈 전환. 세로·십자 레이저 예고 1.4초. 이벤트의 원형 폭발 예고는 1초, 예고 시점의 위치에 고정된다. 기믹 가중치 '+rows[0].mechanicWeight+'.</p>')+'</details>';
    }).join('')+block('재현 가능한 계산식','<p>R = 12·log₂(1+일반 적 HP/40) + 9·log₂(1+관문 HP/1000) + 웨이브 초/4 + 일반탄 속도/12 + 10/일반탄 발사 간격 + 기믹 가중치.</p><p>점수 = 1 + round(99·(R−최솟값)/(최댓값−최솟값)). 현재 R 범위 '+number(MANUAL_BALANCE.scoreRange.min)+'~'+number(MANUAL_BALANCE.scoreRange.max)+'. 기믹 가중치는 개발자가 정한 비교용 값이고 나머지는 엔진에서 계산했다. 체력은 캐릭터·유물이 없는 적의 값이다. 밸런스 패치 후에는 같은 기준으로 다시 생성한다.</p>');
}
function artifacts() {
  return block('수집과 장착','<p>기본 지급은 마도서·프로즌하트·마나수정. 보유 유물은 중복 없이 3개 장착한다. 일반 '+ARTIFACTS.filter(a=>a.rarity==='normal').length+'종·레어 '+ARTIFACTS.filter(a=>a.rarity==='rare').length+'종·에픽 '+ARTIFACTS.filter(a=>a.rarity==='epic').length+'종. 챌린지에서는 퀴즈 보상으로 최대 9개까지 함께할 수 있다.</p><p>동일한 공격 계열 증가는 합산하며 생명 최소 1, 피격 반경 최소 1, 봄 상한 최소 0이다. 회복은 상한을 넘지 않는다. 페어리 두 종류는 함께 사용할 수 있다.</p>')+
    ['normal','rare','epic'].map(rarity=>block(({normal:'일반',rare:'레어',epic:'에픽'})[rarity],ARTIFACTS.filter(a=>a.rarity===rarity).map(a=>'<article class="manual-artifact" data-manual-artifact="'+a.id+'"><h4>'+escape(a.name)+'</h4><p>'+escape(a.text)+'</p>'+(artifactText(a,true)!==a.text?'<p class="manual-note">챌린지: '+escape(artifactText(a,true))+'</p>':'')+'</article>').join(''))).join('')+
    block('조건과 예외','<p>드림초콜릿은 최종보스와 중간보스에 적용한다. 마녀의계약서는 일반 적, 은탄은 엘리트·중간보스에 적용한다. 광기의가면은 봄 0·생명 2 이상일 때 런당 3회. 저주의검은 회복 아이템 드랍을 없애며 퀴즈·스테이지 회복은 유지한다. 버닝코어의 파워 초기화는 강철방패로 막을 수 있다.</p><p>챌린지의 기사회생·기적의증명은 시작 또는 획득 즉시 발동하고 부활 때 반복하지 않는다. 시작의보석도 획득 즉시 P+1. 레인보우링으로 줄어든 봄 상한은 즉시 적용된다. 유리구두·네잎클로버·여신의가호의 보호막은 중첩되지 않는다.</p>');
}
function content() {
  return block('요일·랜덤·도전','<p>월·화 루미/루나, 수·목 지크/자스민, 금·토 눈토끼/밤토끼, 일요일 일반 6명 전원. 다른 요일의 일반 수호자는 문법 정답으로 당일 해금한다. 신데렐라·루나&amp;자스민·시간의마술사는 랜덤 전용.</p><p>랜덤은 9명 각각 같은 확률, 하루 기본 3회. 결과 공개 시 차감하며 취소·재추첨도 횟수를 사용한다. 횟수 0에서 리셋권으로 3회 복구한다. 챌린지는 마도제국부터 천계까지 21스테이지를 연속 진행하며 생명·봄·파워와 획득 유물을 이어간다. 각 던전 보스 뒤 퀴즈 정답으로 새 유물 하나를 선택한다.</p><p>일반 6던전·챌린지·그 주의 이벤트가 출격 대상이다. 5개 이벤트는 매주 하나씩 순환한다. 각각 주간 첫 클리어에 쉬움/보통 1장, 어려움/심연 2장. 난이도를 바꿔도 같은 주에 중복 수령하지 않는다. 월요일 0시 갱신이며 요일과 날짜는 기기의 현지 시간 기준이다. 12개 던전별 심연 첫 클리어 업적은 각각 꿈의결정 3개를 한 번 지급한다.</p>')+
    block('도서관과 학습','<p>단어 '+LIBRARY.vocab.length+'개, 숙어 '+LIBRARY.collocation.length+'개·'+LIBRARY.collocation.reduce((n,e)=>n+(e.quizzes?.length||1),0)+'문항, 문법 '+LIBRARY.grammar.length+'강·'+LIBRARY.grammar.reduce((n,e)=>n+(e.quizzes?.length||0),0)+'문항. 검색·강의 읽기·연습·오답 재풀이를 제공한다. 숙어 사전은 숙어 단위, 퀴즈와 오답은 문항 단위다. 오답 최대 200개를 실제 문제 내용과 함께 저장하고 해당 문항을 맞히면 삭제한다.</p><p>문법 퀴즈 전에는 연결 강의 읽기를 제안한다. 유물 뽑기 전 단어 또는 숙어 퀴즈 정답은 해당 1회 뽑기에 보너스를 준다. 오답 전체 삭제는 정답 기록과 읽은 강의를 보존한다. 기록은 이 브라우저·기기에 저장된다.</p>')+
    block('상점·의상','<p>유물 뽑기권 꿈의결정 5개, 랜덤 리셋권 1개. 중복 유물은 일반/레어/에픽 각각 결정 1/3/5개로 환급한다. 뽑기권은 결과 생성 시 한 장 소모한다.</p>'+table(['코스튬 티켓','가격','획득 방식'],COSTUME_TIERS.map(t=>[t.name,t.cost,t.id==='miracle'?'12벌 중 직접 선택':'해당 4벌 중 랜덤']))+'<p>6명의 수호자에게 '+COSTUMES.length+'벌. 구매·사용 즉시 획득하고 해당 캐릭터에게 착용한다. 중복 의상은 꿈의결정 3개 환급. 과거 보유 티켓을 먼저 사용한다. 초상화로 의상실을 열어 기본 의상과 코스튬을 고를 수 있다. 외형만 바뀌며 피격 판정과 능력은 같다.</p>')+
    block('밸런스 확인','<p>이 매뉴얼의 기본 수치는 유물을 장착하지 않은 상태다. 실제 출격 값은 선택한 난이도·캐릭터·유물과 전투 상황에 따라 달라진다. 난이도 점수는 게임 설계 비교용, DPS는 명시한 정지 표적 조건의 실측값이다. 수치 데이터에는 전투 소스 해시를 함께 보관해 밸런스 패치 때 다시 생성·검증한다.</p>');
}
export function renderManual(tab='guide') {return ({guide,heroes,stages,artifacts,content}[tab]||guide)();}
