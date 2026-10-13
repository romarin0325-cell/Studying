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
  ...group('candy',['star_boy','siren','guardian','red_dragon','storm_sage','phantom','rumi','galaxy_whale','harmonious','time_ruler']),
  ...group('letter',['snow_rabbit','night_rabbit','great_detective','santa','flame_sage','lightning_sage','zeke','luna','jasmine','doom']),
  ...group('bouquet',['silver_rabbit','mushroom_king','avalanche_maid','aurora','time_magician','ancient_dragon','queen','cherry_prince','cinderella','frost_witch']),
]));
// What each companion says to the gift they love.
export const FAVORITE_LINES=Object.freeze({
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
  luna:'…여기서 읽으라고? 됐어, 나중에 혼자 읽을 거야. …버리진 않아.',
  jasmine:'꾸미지 않은 말이라 더 좋아요. 이 편지가 초상화보다 저를 닮았네요.',
  doom:'봉투를 빼앗지 않고 받는 건 처음이군. …답장은 계약서보다 짧게 쓰지.',
  silver_rabbit:'쉿… 이렇게 예쁜 꽃은 기도할 때 제단에 몰래 놓아 둘래요.',
  mushroom_king:'숲 냄새가 나는군. 인간치고 제법이다. 그루터기 옆에 두마.',
  avalanche_maid:'주인님이 주신 꽃다발… 절대 안 얼리고 가슴에 꼭 품을게요! 흐앙!',
  aurora:'꽃이다! 구름 위로 가져가서 맨발로 꽃밭 놀이 할래요.',
  time_magician:'언젠가 시드는 꽃이라 더 아름답지. 오늘의 초침에 걸어 둘게.',
  ancient_dragon:'작은 꽃다발에도 천 번의 봄이 담겨 있구나. 고맙다, 나그네여.',
  queen:'꽃을 짐에게 바치다니, 겁이 없구나. …마음에 든다.',
  cherry_prince:'연회의 어떤 보석보다 귀하게 간직하겠습니다.',
  cinderella:'무도회 날보다 설레요… 유리구두 옆에 꽂아 둘게요.',
  frost_witch:'…짐의 궁전에선 피지 않는 것이로군. 녹지 않게 소중히 두겠다.',
});
export const GIFT_LINES=Object.freeze(['고마워. 소중히 할게.','이걸 나한테? 기뻐!','마음이 따뜻해지는 선물이야.']);
export const giftPoints=(id,gift)=>FAVORITE[id]===gift?FAVORITE_POINTS:GIFT_POINTS;
export const bondNeed=level=>level>=BOND_MAX?0:BOND_STEPS[level];
// Adds points to a hero entry ({bond,bondXp}); returns how many hearts were gained.
export function addBond(entry,points){
  const before=entry.bond;entry.bondXp=(entry.bondXp||0)+points;
  while(entry.bond<BOND_MAX&&entry.bondXp>=bondNeed(entry.bond)){entry.bondXp-=bondNeed(entry.bond);entry.bond++;}
  if(entry.bond>=BOND_MAX){entry.bond=BOND_MAX;entry.bondXp=0;}
  return entry.bond-before;
}
