// Bond (호감도): ten hearts per companion, filled by points from greetings and gifts.
// Gifts come from one place, the gift basket in the garden: one every 8 hours (candy, letter, bouquet in turn).
// One companion fed every gift and greeting reaches ten hearts in about two to three weeks.
export const BOND_MAX=10;
export const BOND_STEPS=Object.freeze([40,50,60,70,75,80,85,90,95,105]);
export const GREETING_POINTS=10,GIFT_POINTS=10,FAVORITE_POINTS=20;
export const GIFT_IDS=Object.freeze(['candy','letter','bouquet']);
export const GIFTS=Object.freeze({
  candy:{name:'별사탕',color:'#ffd36a'},
  letter:{name:'손편지',color:'#ffb3c7'},
  bouquet:{name:'꽃다발',color:'#9fe0b0'},
});
const group=(gift,ids)=>ids.map(id=>[id,gift]);
export const FAVORITE=Object.freeze(Object.fromEntries([
  ...group('letter',['demon_king']),
  ...group('bouquet',['miracle_larva','gold_dragon']),
  ...group('candy',['star_boy','siren','guardian','red_dragon','storm_sage','phantom','rumi','galaxy_whale','harmonious','time_ruler','toffee_apple','sunflower','cure_master','venom']),
  ...group('letter',['snow_rabbit','night_rabbit','great_detective','santa','flame_sage','lightning_sage','zeke','luna','jasmine','doom','behemoth','joker']),
  ...group('bouquet',['silver_rabbit','mushroom_king','avalanche_maid','aurora','time_magician','ancient_dragon','queen','cherry_prince','cinderella','frost_witch','underdog','antropy','ash']),
]));
// What each companion says to the gift they love.
export const FAVORITE_LINES=Object.freeze({
  gold_dragon:'용의 둥지에도 없는 꽃이로구나. 그래, 그대가 골랐으니 더 귀한 것이겠지. 가까이서 함께 보자꾸나.',
  demon_king:'직접 쓴 편지야? 글씨체가 고우네. 책갈피 사이에 끼워 둘게.',
  miracle_larva:'내 머리핀하고 닮은 꽃이다! 시들기 전에 네 옆에 놓아도 돼?',
  star_boy:'우와, 별사탕이다! 배달만 하다가 받으니까 엄청 신기해… 헤헤, 고마워!',
  siren:'흐아앙… 달콤해서 눈물이 쏙 들어갔어요. 오늘 노래는 당신 거예요!',
  guardian:'우웅… 반짝반짝 맛있어. 여행자, 같이 먹자.',
  red_dragon:'흐, 흥! 단 건 별로… 아니, 하나만 더 있어? …꼭꼭 숨겨 둘 거야.',
  storm_sage:'오, 군것질이라. 바람 좋은 날 지붕 위에서 아껴 먹어야겠군.',
  phantom:'이 몸의 보물 창고에 들어갈 영광을 주마! …딸기맛 맞지?',
  rumi:'우와아, 형아가 준 별사탕! 마법구슬 옆에 두고 아껴아껴 먹을 거야!',
  galaxy_whale:'별을 닮은 사탕이군요. 받은 빛은 언젠가 꼭 돌려 드리겠습니다.',
  harmonious:'와아, 디저트 킹덤 품평회 1등감이에요! 반은 나눠 먹어요!',
  time_ruler:'…금방 녹아 버리는구나. 그래서 좋다. 또 가져오너라.',
  snow_rabbit:'손편지라니… 찻잔보다 소중히 다룰게요. 답장은 정갈하게 쓸게요.',
  night_rabbit:'…이거, 나한테 쓴 거 맞지? 버리지 않을 거지? 매일 밤 읽을 거야.',
  great_detective:'흥미롭군요. 이것만은 열어 보기 전까지 추리하지 않겠습니다.',
  santa:'제가 편지를 받는 쪽이 되다니… 선물 자루 맨 위에 넣어 둘게요!',
  flame_sage:'…읽을 수 있는 이름이 하나 늘었군. 이번엔 태우지 않으마.',
  lightning_sage:'필체가 3도 기울었군. 문장엔 군더더기가 없고. …자주 펼쳐 보겠다.',
  zeke:'편지다! 하하, 드디어 나한테도 오는구나! …고맙다, 진심으로.',
  luna:'…여기서 읽진 않을 거야. 불 끄고 혼자 있을 때 뜯어 볼게.',
  jasmine:'꾸미지 않은 말이라 더 좋아요. 이 편지가 초상화보다 저를 닮았네요.',
  doom:'봉투를 빼앗지 않고 받는 건 처음이군. …답장은 계약서보다 짧게 쓰지.',
  ash:"상급 악마에게 시들어버릴 꽃을 바치다니, 간도 크네. …뭐, 내 마법으로 영원히 지지 않는 불꽃으로 만들어 주지. 너한테 받은 건 재로 만들 순 없으니까.",
  venom:"독이 아닌 단맛을 입에 머금어 보는 건 정말 오랜만이에요.",
  antropy:"…내 손바닥 위의 빛 속에 가두어 두겠습니다. 영원히.",
  cure_master:"우와아, 반짝이는 별사탕이네요! …헤헤, 당신이 준 거니까 이건 아무한테도 안 주고 저 혼자 먹을게요♡",
  joker:"우와, 편지다! 글자마다 네 목소리가 묻어 있어서 간지러워… 히히",
  sunflower:"별사탕이네? …입에 넣어 주면 더 맛있을 것 같은데, 해 줄 거지?",
  toffee_apple:"별사탕?! 우와, 내 특제시럽이랑 섞으면 엄청 색이 되겠다!",
  underdog:"꽃다발이라… 크하하, 이거 제법 어색하군.",
  behemoth:"호오, 나한테 주는 글인가! 크하하, 내 보물 1호로 가슴팍에 새겨두마!",
  silver_rabbit:'쉿… 이렇게 예쁜 꽃은 기도할 때 제단에 몰래 놓아 둘래요.',
  mushroom_king:'숲 냄새가 나는군. 인간치고 제법이다. 그루터기 옆에 두마.',
  avalanche_maid:'주인님이 주신 꽃다발… 절대 안 얼리고 가슴에 꼭 품을게요! 흐앙!',
  aurora:'센스가 구십구 점이네요? 마지막 일 점은… 직접 꽂아 주세요.',
  time_magician:'언젠가 시드는 꽃이라 더 아름답지. 오늘의 초침에 걸어 둘게.',
  ancient_dragon:'숲지기한테 꽃선물이라니 귀엽네. 고마워, 향기 좋다.',
  queen:'꽃을 짐에게 바치다니, 겁이 없구나. …마음에 든다.',
  cherry_prince:'연회의 어떤 보석보다 귀하게 간직하겠습니다.',
  cinderella:'무도회 날보다 설레요… 유리구두 옆에 꽂아 둘게요.',
  frost_witch:'생화는 냉기에 약한데… 얼지 않게 침소 창가에 두겠다.',
});
// What each companion says to the other two gifts, in that companion's own voice.
export const GIFT_LINES=Object.freeze({
  gold_dragon:'나를 떠올리며 골랐단 말이지? 고맙구나. 보물의 주인이 되는 것도 제법 기쁜 일이야.',
  demon_king:'관람료 대신인가? 안목이 제법이네. 기분 좋게 받아 두지.',
  miracle_larva:'나한테 주는 거야? 고마워! 나뭇가지 위 보물함에 넣어 둘게.',
  star_boy:'헤헤, 선물 배달받았다! 형아한테 받으니까 날아갈 것 같아!',
  siren:'와아, 선물이다! 고마운 마음은 노래로 꼭 갚을게요, 라-♪',
  guardian:'우웅… 고마워, 여행자. 바위 틈에 잘 넣어 둘게.',
  red_dragon:'흥, 이런 걸로 기뻐할 줄 알았어? …둥지에 둘 거야. 둘 데가 없어서야!',
  storm_sage:'오, 나한테? …고맙다. 낮잠 잘 때 머리맡에 둬야겠어.',
  phantom:'크하하! 공물을 바치다니 기특하구나! …진짜 받아도 되는 거지?',
  rumi:'우와, 형아가 루미한테 준 거야? 에헤헤, 보물 상자에 넣어 둘래!',
  galaxy_whale:'고맙습니다. 별바다를 건너는 동안 소중히 품고 가겠습니다.',
  harmonious:'스위트-! 마음이 담긴 선물은 디저트처럼 달콤해요!',
  time_ruler:'필멸자의 선물이라… 영겁 속에서도 오늘만은 기억해 두마.',
  snow_rabbit:'어머, 저한테요? 감사합니다. 찻잔 옆에 소중히 놓아 둘게요.',
  night_rabbit:'…나 주는 거야? 이제 내 거야. 돌려 달라고 하면 안 돼.',
  great_detective:'뜻밖의 증거물이군요. 동기는… 호의라고 기록해 두겠습니다.',
  santa:'에헤헤, 선물을 받는 쪽도 이렇게 설레는 거였네요!',
  flame_sage:'…꼬맹이가 별걸 다 챙기는군. 불 옆엔 두지 않으마.',
  lightning_sage:'예정에 없던 입력이군. …긍정적인 변수로 분류해 두지.',
  zeke:'오, 나한테 주는 거야? 하하, 고맙다! 힘이 펄펄 나는걸!',
  luna:'내 몫까지 챙겼네. …품 안쪽에 넣어 둘게. 고마워.',
  jasmine:'성녀가 아니라 저에게 주는 선물이라니… 정말 기뻐요.',
  doom:'…함정은 아니군. 받아 두지. 빚으로 달아 두진 않겠다.',
  ash:"공물 치고는 꽤 귀여운걸? 내일은 더 근사한 걸로 가져와, 계약자.",
  venom:'…가까이 오지 않아도 돼요. 거기 두고 가요. 나중에, 천천히 받을게요.',
  antropy:"물질은 언젠가 부식되지만… 당신의 마음은 기록해 두겠습니다.",
  cure_master:"어머, 저한테 주는 선물인가요? … 감동이에요! 소중히 간직할게요♡",
  joker:"나 주는 거야? 고마워!",
  sunflower:"어머, 나한테 주는 거야? 고마워.",
  toffee_apple:"나한테 주는 거야? 헤헤, 달콤한 맛이 나니까 합격!",
  underdog:"공짜로 받는 성격은 아니니까, 다음 전투에서 적 모가지로 열 배는 갚아주마!",
  behemoth:"네가 주는 거라면 돌멩이 하나라도 기꺼이 받아주지!",
  silver_rabbit:'선물이요…? 오늘 기도에는 감사 한 줄을 더 적어야겠어요.',
  mushroom_king:'흥, 인간 주제에 기특하구나. …받아 두마.',
  avalanche_maid:'주인님이 주신 선물…! 얼리지 않게 조심조심 둘게요!',
  aurora:'제 생각 하며 고른 거죠? 후훗, 기특해서 받아 줄게요!',
  time_magician:'선물이라… 이 순간은 되감지 않고 그대로 둘게.',
  ancient_dragon:'고마워. 챙겨 오면서 내 생각 했을 테니 그걸로 충분해.',
  queen:'짐에게 바치는 것이로군. 갸륵하다. 곁에 두도록 하지.',
  cherry_prince:'나의 친우여, 이 마음 감사히 받겠습니다.',
  cinderella:'선물이라니, 작은 기적이 찾아왔네요! 고마워요!',
  frost_witch:'공물치곤 소박하군. …기각하진 않겠다. 고맙다.',
});
export const giftPoints=(id,gift)=>FAVORITE[id]===gift?FAVORITE_POINTS:GIFT_POINTS;
export const bondNeed=level=>level>=BOND_MAX?0:BOND_STEPS[level];
// Adds points to a hero entry ({bond,bondXp}); returns how many hearts were gained.
export function addBond(entry,points){
  const before=entry.bond;entry.bondXp=(entry.bondXp||0)+points;
  while(entry.bond<BOND_MAX&&entry.bondXp>=bondNeed(entry.bond)){entry.bondXp-=bondNeed(entry.bond);entry.bond++;}
  if(entry.bond>=BOND_MAX){entry.bond=BOND_MAX;entry.bondXp=0;}
  return entry.bond-before;
}
