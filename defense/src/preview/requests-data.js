// Companion requests (content preview). Content only: titles, goals, dialogue and afterwords.
// The rules (arrival, progress, rewards) live in requests.js; this file is written and reviewed by hand.
// Goal types read by requests.js:
//   clear  {with?, rarities?, n}  win an expedition (any mode) with `with` in the deck / every deck member of these rarities
//   casts  {hero, n}              cumulative ultimate casts by `hero`
//   bosses {with, n}              cumulative boss kills in runs with `with` in the deck
//   flag   {flag, n}              a moment seen in battle: 'moonlit' (Night Rabbit casts while Silver and Snow Rabbit are on the
//                                 board), 'spared' (Ash casts Armageddon and nobody is consumed)
export const REQUEST_HEROES=Object.freeze(['night_rabbit','underdog','ash']);
export const REQUEST_REWARD=Object.freeze({gifts:2,bond:40});
export const REQUESTS=Object.freeze([
  {id:'night_rabbit-1',hero:'night_rabbit',order:1,title:'한밤의 산책',goal:{type:'clear',with:'night_rabbit',n:1},hint:'밤토끼를 편성해 원정 1번 클리어',
    arrive:['…자?','아, 아니구나. …있잖아. 오늘 밤에 나가자. 밖에.','별이 제일 잘 보이는 데까지. …너 혼자 가면 안 되니까, 나도 데려가.'],
    thanks:['…돌아왔다. 둘 다.','밤길은 원래 무서운 건데, 오늘은 하나도 안 무서웠어.','이거. …줍다 보니까 생겼어. 너 줄 거야.']},
  {id:'night_rabbit-2',hero:'night_rabbit',order:2,title:'달그림자 연습',goal:{type:'casts',hero:'night_rabbit',n:3},hint:'달그림자 도약 3번 사용',
    arrive:['나, 요즘 연습하는 게 있어. 달그림자 도약.','더 높이 뛰면… 네가 어디 있든 한 번에 보일 것 같아서.','세 번만 보여줄게. 보고 있어야 돼. 딴 데 보면 안 돼.'],
    thanks:['봤지? 세 번 다 봤지?','…응. 네가 보고 있으면 더 멀리 뛰어져.','상 줘. 아니, 이거 받아. 그리고 상도 줘.']},
  {id:'night_rabbit-3',hero:'night_rabbit',order:3,title:'토끼 셋의 달맞이',goal:{type:'flag',flag:'moonlit',n:1},hint:'눈토끼·은토끼가 전장에 있을 때 달그림자 도약 사용',
    arrive:['다른 토끼들이랑 있으면 나, 빨라지잖아.','그래서… 같이 달맞이 하고 싶어. 눈토끼랑 은토끼랑. 너도.','…싫은 거 아니야. 셋이 있으면 시끄럽긴 한데. 네가 있으니까 괜찮아.'],
    thanks:['달 진짜 컸지. 셋이 같이 보니까 더 컸어.','은토끼가 기도하고, 눈토끼가 차 엎고, 나는… 너만 봤어.','다음 달에도 해. 약속. 손가락 걸어.']},
  {id:'underdog-1',hero:'underdog',order:1,title:'뒷골목 실력 확인',goal:{type:'bosses',with:'underdog',n:1},hint:'언더독을 편성해 보스 1체 쓰러뜨리기',
    arrive:['보스, 요즘 판이 너무 얌전하지 않아?','덩치 큰 놈 하나 골라 줘. 몸이 근질근질해서 말이야.','내가 아직 녹슬지 않았다는 거, 네 눈으로 직접 확인해 둬.'],
    thanks:['봤냐? 덩치만 컸지 별거 없더라.','…뭐, 네가 뒤에서 판을 잘 깔아 준 덕도 있고.','이건 전리품. 꽃이 왜 나왔냐고? 묻지 마라.']},
  {id:'underdog-2',hero:'underdog',order:2,title:'노멀의 자존심',goal:{type:'clear',rarities:['C'],n:1},hint:'C 동료만으로 원정 1번 클리어',
    arrive:['귀족 놈들이 또 떠들더라. 노멀은 노멀끼리 모여 봐야 노멀이라고.','하. 그래서 말인데, 보스.','우리끼리만 나가서 한 판 깨고 오자. 별 하나짜리들의 진짜 실력을 보여 주자고.'],
    thanks:['어때. 노멀끼리도 끝까지 서 있었지?','다들 겉으론 투덜대도 꽤 신나 하더라. 나도 좀… 그랬고.','이건 그 녀석들 몫까지 챙긴 거야. 받아 둬.']},
  {id:'underdog-3',hero:'underdog',order:3,title:'빅쇼 리허설',goal:{type:'casts',hero:'underdog',n:2},hint:'빅쇼 2번 사용',
    arrive:['빅쇼 말인데. 그거, 아군까지 잠깐 기절시키잖아.','다들 날 원망할까 봐… 아니, 신경 쓰는 건 아니고.','너만 괜찮다고 하면 두 번만 크게 터뜨려 볼게. 판은 네가 짜 줘.'],
    thanks:['…아무도 화 안 내더라. 오히려 박수 치더라고.','네가 타이밍을 잘 잡아 줘서 그래. 그건 인정.','이건 공연 끝난 배우가 주는 꽃이다. 웃지 마.']},
  {id:'ash-1',hero:'ash',order:1,title:'계약 갱신',goal:{type:'clear',with:'ash',n:1},hint:'애쉬를 편성해 원정 1번 클리어',
    arrive:['계약자. 우리 계약서, 기간 갱신할 때가 됐어.','조건은 간단해. 날 데리고 나가서 이기고 와.','…뭘 그렇게 봐? 다른 녀석이랑 나가서 이기면 무효야. 알지?'],
    thanks:['좋아, 갱신 완료. 이번 기간도 넌 내 거야.','흥, 꽤 쓸 만했어. 내 불꽃이 아니었으면 어림없었겠지만.','이건 계약금. 거절은 허락 안 해.']},
  {id:'ash-2',hero:'ash',order:2,title:'불꽃 구경',goal:{type:'casts',hero:'ash',n:2},hint:'아마겟돈 2번 사용',
    arrive:['요즘 마력이 넘쳐서 손끝이 간지러워.','아마겟돈, 두 번만 크게 피워 보고 싶은데.','…구경 와. 네가 보고 있으면 더 예쁘게 타거든. 아니, 그냥 하는 소리야.'],
    thanks:['어땠어? 하늘까지 빨갛게 물들었지?','…근데 너, 불꽃 말고 내 얼굴 보고 있었지.','됐어. 이건 관람료 대신 주는 거야. 착각하지 마.']},
  {id:'ash-3',hero:'ash',order:3,title:'태우지 않는 불',goal:{type:'flag',flag:'spared',n:1},hint:'동료가 소멸하지 않게 막은 채로 아마겟돈 사용',
    arrive:['…아마겟돈 쓸 때마다 누군가 하나씩 재가 되잖아.','상관없어. 상급 악마한테 그런 게 무슨 상관이야. …진짜로.','그래도 한 번쯤은 아무도 안 태우고 피워 보고 싶어. 그 레몬 꼬맹이 보호막 같은 게 있으면… 될지도.'],
    thanks:['…아무도 안 탔어.','불꽃이 이렇게 컸는데, 다들 멀쩡하게 웃고 있더라. 처음 봐, 그런 거.','이거 받아. 그리고 지금 내 얼굴 보지 마. 뜨거워서 그런 거니까.']},
]);
// Opens after all three requests of a companion are thanked, and only once their memorial has been read.
export const AFTERWORDS=Object.freeze({
  night_rabbit:{title:'달을 돌려주는 시간',paragraphs:[
    '새벽 세 시. 이번에는 당신이 먼저 눈을 떴다. 침대 옆이 비어 있었다.',
    '창가에 밤토끼가 앉아 있었다. 무릎에는 정원에서 주워 모은 조약돌과 마른 꽃잎이 한 줌 놓여 있었다.',
    '“…깼어? 나 안 갔어. 여기 있어.” 그는 손바닥을 펴서 보여 주었다. “이거, 다 너랑 걸었던 밤에 주운 거야. 이제 혼자 있어도 안 추워. 이게 있으니까.”',
    '당신이 이불을 들춰 빈자리를 두드리자, 밤토끼는 잠깐 망설이다가 조약돌을 창틀에 가지런히 올려놓고 돌아왔다.',
    '“…그래도 너 옆이 제일 따뜻해. 그건 안 변해.”'
  ]},
  underdog:{title:'지붕 위의 박수',paragraphs:[
    '정원 지붕 위. 언더독이 빈 포도주병을 굴리며 별을 보고 있었다. 오늘은 땡땡이가 아니라 축하라고, 그는 굳이 고쳐 말했다.',
    '“보스. 노멀 녀석들이 나한테 고맙다더라. 덕분에 처음으로 끝까지 서 있어 봤다고.”',
    '그는 코끝을 문지르며 시선을 피했다. “웃기지. 맨날 바닥에서 버티기만 하던 놈이, 누굴 일으켜 세웠다는 게.”',
    '당신이 그의 어깨를 툭 치자, 언더독은 피식 웃으며 병을 높이 들어 올렸다.',
    '“다음 판도 네가 짜. 무대가 어디든, 끝까지 서 있는 건 내가 할 테니까.”'
  ]},
  ash:{title:'타지 않는 손',paragraphs:[
    '애쉬가 창틀에 걸터앉아 손끝에 작은 불꽃을 피웠다 껐다를 반복하고 있었다.',
    '“계약자. 손 줘 봐.” 당신이 손을 내밀자, 그녀는 불꽃을 당신의 손바닥 위로 옮겨 놓았다. 뜨겁지 않았다.',
    '“…태우지 않는 법, 연습했어. 네 영혼 관리하려고. 그것뿐이야.” 붉은 눈이 잠깐 당신의 얼굴을 살폈다.',
    '불꽃은 당신의 손 위에서 금빛으로 작게 흔들렸다. 그녀는 그걸 한참 바라보다가, 깍지를 끼듯 손을 겹쳤다.',
    '“흥. 다들 내가 무서운 줄만 알지. 이 온도는 너만 아는 거야. 계속 그렇게 둬.”'
  ]},
});
