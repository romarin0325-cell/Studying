import { EPISODES } from './episodes.js';

// Lines quoted verbatim from the owner's episodes. Listed here when the first quotation is another speaker's,
// or (Claude's pick) when it is a lone interjection that says nothing about the companion out of context.
export const GREETING_LINE = {
  mushroom_king: '"소리를 접는 시간이다. 숨소리도 삼켜라."',
  cinderella: '"발이 좀 나아질 때까지만, 아주 조금만 이렇게 기대서 걸어도 될까요? ...넘어지면 영웅 체면에 폼이 안 나니까요."',
  red_dragon: '"누, 누가 고기 따윌 탐낸다고 그래?! 난 그저... 불의 세기가 적절한지 시찰을 나온 것뿐이야!"',
  siren: '"흐아앙-! 저 사람 안 잡아먹는다구요-!! 왜 다들 제 얼굴만 보면 식인 물고기 취급을 하시는 거예요오-!!"',
  time_magician: '"썩 나쁘지 않군."',
  time_ruler: '"후아암... 지루하구나. 필멸자여, 시간은 그대가 잃어버린 동전을 줍는 서랍이 아니거늘."',
  avalanche_maid: '"주인님! 오늘 일과 끝났어요! 이리 오세요, 제가 손잡고 태워드릴..."',
  queen: '"돌멩이가 차갑구나."',
  galaxy_whale: '"수억 년의 성운을 건너, 오직 당신을 만나기 위해 오늘 밤 지구에 닿은 빛입니다."',
  jasmine: '"참으로 아름다운 그림이에요. 수고 많으셨습니다."',
  storm_sage: '"후아암... 꼬맹이들아, 바람이 안 부는 날엔 그냥 흙장난이나 치며 노는 게 장땡이란다. 억지로 바람을 일으키면 먼지만 눈에 들어가지."',
  harmonius: '"싸움 금지! 디저트에 욕심이 들어가면 크림이 시큼하게 상해버린다구요!"'
};

export function episodeGreeting(id) {
  if (!Object.hasOwn(EPISODES, id)) return '';
  return GREETING_LINE[id] ?? EPISODES[id].body.join('\n\n').match(/"[^"]+"/)?.[0] ?? '';
}
