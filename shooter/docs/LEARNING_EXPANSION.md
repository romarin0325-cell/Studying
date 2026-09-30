# 숙어 4문항 연결과 오답 호환

2026-09-30. 사용자 첨부 `collocation_quiz_expansion.json`의 130개 항목을 활성 원본 `card/game/collocation_data.js`에 ID로 연결했다. 첨부 SHA-256: `0da9ba997ebef6a80fb6cbe87791759712597a028d1ea5abd7a0127d9c774ba9`.

각 숙어는 기존 대표 문항·기존 세 문항을 보존하며 새 도메인의 네 번째 문항을 추가한다. 총 130숙어·520문항이고 모든 항목이 동일하게 4개다. 기존 390문항과 대표 문항·뜻·ID가 바뀌지 않았음을 비교한다. 첨부 정답은 모두 유지했다.

## 문장 검토

첨부를 그대로 추가하면 답 후보가 둘이 되는 곳을 검토했다. 다음 16개 문항의 일부 보기 또는 문맥을 보완했다. 나머지 114문항의 문제·보기·정답·번역은 첨부 그대로다. ID 114만 보고 관계를 묻는다는 문맥을 추가하고 번역을 맞췄다. 그 외 수정은 오답 보기만 바꾼다.

| ID | 수정 | 이유 |
| ---: | --- | --- |
| 1 | compile → comply | compile a survey도 설문 작성/편집으로 읽힐 수 있음 |
| 8 | generate → translate | generate demand도 수요 창출이라는 의미로 성립 |
| 20 | casually → lately; briefly → nearly | casually/briefly inspect도 문법적으로 성립해 철저한 점검으로 답을 고정하기 어려움 |
| 24 | write → wear; make → mix | write/make out a declaration도 신고서 작성으로 성립 |
| 25 | put → pay | put off도 현장 점검 연기로 성립 |
| 26 | call → close | call off replacing도 교체 취소로 성립 |
| 28 | build → break | build up a booth도 부스 조립 문맥에서 해석 가능 |
| 38 | previous → previously | previous to도 ~이전이라는 표현 |
| 61 | hold → fold | hold a reservation도 예약을 보유한다는 뜻 |
| 62 | file → fold | file an order도 주문 접수/등록이라는 뜻 |
| 64 | require → revise | require a refund도 환불 요구라는 뜻 |
| 68 | raise → print | raise a budget도 예산을 늘린다는 뜻 |
| 86 | detail → early | notify in detail도 상세히 알린다는 뜻 |
| 87 | reserve → reverse | in reserve도 준비된 예비 재고라는 뜻 |
| 114 | 보고 체계 문맥 추가, 번역 반영 | reply/return to도 문법적으로 성립하므로 보고 체계라는 문맥을 명시 |
| 116 | waiting → weighing | waiting on a forecast도 예측 자료를 기다린다는 뜻 |

## Card

`buildCollocationQuiz()`는 `quizzes` 전체를 펼치므로 520개가 카오스·아티팩트카오스·드래프트 보상과 꿈의회랑 숙어 퀴즈에 들어간다. `parentId` 가중치와 개인과외, 숙어 단위 오답 구조를 유지한다. 같은 숙어의 여러 문항을 틀려도 상세는 마지막 한 문제를 보관하는 기존 설계다. 오답 초기화 때 목록과 상세, 두 Storage 키를 함께 지우도록 보완했다. 저장 형식 마이그레이션은 필요 없다.

## Shooter

`makeQuestion('collocation')`이 숙어를 선택하고 해당 `quizzes`의 문항을 선택한다. 문제·보기·정답·번역을 전부 선택 문항에서 가져온다. 예컨대 ID 103의 새 문항 정답 `breaks`를 대표 문항의 `break`로 잘못 판정하지 않는다.

첫 대표 문항은 기존 `collocation:103` ID를 유지한다. 나머지는 `collocation:103:1`~`:3`으로 구별해 저장된 오답이 서로 덮어쓰거나 다른 문항 정답 때문에 사라지지 않게 한다. 대표 문항만 있던 구형 데이터도 동작한다. 던전·챌린지·도서관 연습·뽑기 전 퀴즈는 이 공통 함수를 사용한다. 숙어 사전의 목록은 130개 대표 예문을 유지한다.

## 동기화와 검사

`card/game/`이 원본이다. `node shooter/sync-learning.mjs`로 `learning/data.js`와 `learning/provenance.json`을 함께 생성한다. 직접 스냅샷을 수정하지 않는다. provenance의 entries는 중첩 문항 수가 아니라 숙어 수 130이다.

- `scripts/verify_card_learning_data.js`: 130×4, 고유한 520문장, 각 보기·정답·빈칸·번역, 실제 Card 출제 풀과 세 모드 오답 초기화 검사.
- `shooter/tests/learning.test.mjs`: 모든 520문항의 도달 가능성·고유 ID·변형 정답/번역, 대표 ID 호환, 저장 후 오답 재풀이의 문항별 삭제 검사.
- `sync-learning.mjs --check`: 원본/스냅샷/SHA 일치 검사.
- 배포 입력이 바뀌므로 두 게임의 배포 HTML도 함께 갱신하고 오프라인 부팅을 검사한다.
