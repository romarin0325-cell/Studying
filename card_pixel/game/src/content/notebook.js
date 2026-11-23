export const NOTEBOOK = [
  { id: 1, title: '첫 생환', opens: ['hub', 'recruiting', 'lead'] },
  { id: 2, title: '시작 동료와 출발', opens: ['companion_slot_1'] },
  { id: 3, title: '문지기 격파', opens: ['relic_codex'] },
  { id: 4, title: '첫 본편 생환', opens: ['daily_rift', 'companion_slot_2', 'recruit_missions'] },
  { id: 5, title: '다른 시작 동료와 생환', opens: ['companion_slot_3'] },
  { id: 6, title: '세 지역 생환', opens: ['creation_tower'] },
  { id: 7, title: '창조의 탑 격파', opens: ['ending_record'] }
];

export const NOTEBOOK_GOALS = {
  1: { text: '새벽의 숲에서 생환', reward: '꿈의 관측소 열림' },
  2: { text: '시작 동료와 본편 출발', reward: '샘 초대 1칸 열림' },
  3: { text: '4층 문지기 격파', reward: '유물 도감 열림' },
  4: { text: '본편에서 처음 생환', reward: '오늘의 균열 · 영입 임무 · 샘 초대 2칸 열림' },
  5: { text: '다른 시작 동료로 문지기를 이기고 함께 생환', reward: '샘 초대 3칸 열림', startCompanionNot: 'firstLead' },
  6: { text: '미생환 테마 지역에서 생환', reward: '창조의 탑 열림' },
  7: { text: '창조의 탑 격파', reward: '엔딩 열림' }
};
