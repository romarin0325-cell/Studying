# 보호막·유물·P5 패치

기준: PR #512가 병합된 `fb3d062`.

## 보호막

- 보호막은 불리언 상태로 1회만 방어하며 중첩/예비 충전되지 않는다.
- 네잎클로버는 던전 시작 때만 생성. 다음 스테이지에 남은 보호막은 유지하지만 깨진 보호막을 복원하지 않는다.
- 유리구두는 던전 전체의 유효 그레이즈 누적 20, 40, 60…회마다 생성. 이미 보호막이 있으면 해당 보상은 저장되지 않는다. 기존 규칙대로 무적 중이거나 같은 탄을 반복해서 스칠 때는 그레이즈가 증가하지 않는다.
- 보호막이 우선 방어하며 생명/봄/파워/콤보를 잃지 않는다. 수호방패의 봄 소모보다 먼저 적용된다. 가면의 생명 지불은 피격이 아니므로 보호막이 대신 지불하지 않는다.
- 깨지면 기본 2.5초, 투명망토 장착 시 4초 무적. 적탄과 레이저를 지우지 않는다. 적 접촉·레이저·폭발에도 동일하게 적용한다.
- 청록색 이중 고리와 6개의 빛나는 장식, HUD 보호막 표시, 파괴 시 갈라지는 고리/효과음. 고리 텍스처는 로딩 때 한 번 만든 뒤 재사용한다.

## 신규 유물

일반: 모래시계(콤보 +2초), 네잎클로버(시작 보호막), 마녀의계약서(일반 몬스터 피해 +20%), 은탄(엘리트/중간보스 피해 +30%), 마안(봄 0개 공격력 +30%), 스타트부스트(P1 공격력 +50%).

레어: 유리구두(그레이즈 20회 보호막), 신록의이슬(P 요구량 3→2), 빅뱅(일반 공격 −10%, 봄 +60%), 만화경(일반 공격 +30%, 봄 −20%).

- 카탈로그 32종(일반 20/레어 12). 기존 저장/소유/장착/등급별 추첨을 그대로 사용하며 장착은 3개까지.
- 일반 몬스터는 boss/miniboss/elite 태그가 없는 적. 은탄은 elite 또는 miniboss 조건으로 한 번만 +30%를 더한다.
- 기존 상시·조건부 공격력과 새 조건부 증가량은 한 번 합산한다. 마녀의계약서/은탄/마안/스타트부스트는 기존 공격력 유물처럼 일반 공격과 봄 모두에 적용된다.
- 빅뱅/만화경의 일반 공격 증감은 일반탄·레이저·근접·체인·장판·반향·페어리에 적용된다. 봄의 즉발/지속 피해와 시간의마술사 변신탄에는 적용하지 않는다. 봄 전용 증가량은 기존 봄 유물과 합산한 뒤 별도로 곱한다.
- 예: 빅뱅+만화경은 일반 공격 1.2배, 봄 1.4배. 마나수정까지 장착하면 일반 공격 1.25배, 봄 1.05×1.4배.
- 기본 레어 15%/일반 85%. 뽑기 전 선택 퀴즈(단어 또는 숙어)를 맞히면 해당 뽑기만 레어 30%/일반 70%. 거절/오답은 기본 확률. 미획득은 없고 중복 획득은 기존대로 안내한다. 게임 UI에는 확률 수치나 배수를 표시하지 않는다.

## 캐릭터와 전투

- 루나 루나틱위치 +10%, 지크 프로미넌스 +5%, 눈토끼 프로즌샤드 +10%, 신데렐라 크리스탈킥 +10%, 밤토끼 문드롭 +10%, 시간의마술사 리와인드 +10%. 발사 간격은 유지한다.
- P5 프로즌샤드 감속 1.6→2초, 스노우바운드 도약 3→4회.
- P5 크리스탈킥 발사 위치 간격 26→32, 탄 크기와 판정 +10%. 미드나잇 표식 폭발 반경 100→120.
- P5 문드롭 반경 28.8→38.8, 슬립리스 장판 반경 90→100.
- P5 이어 쓴 내일 반향 반경 80→96, 우리의 작은 집 장판 반경 100→110. 영역 시각 효과도 같은 반경을 사용한다.
- 발사 시점의 P5 효과를 투사체에 저장한다. 장판 갱신 시 최근 씨앗의 반경과 피해를 반영한다.
- 히든 3인은 시작/최대 생명 모두 +1. 밤토끼/루나&자스민은 시작/최대 봄 +1. 다음 스테이지에서 재지급하지 않는다.
- 코로나 기본 피해 1700, 밤토끼 봄 총 기본 피해 1900. 지속시간/무적시간은 유지한다.
- 해저신전 반향의 해령은 elite 태그로 분류하고, 직전 버전 대비 실제 체력을 10% 올린다. 반사탄 3→4개, 기존 2.9초 주기와 5초 반사 시간은 유지한다. 포세이돈 패턴은 변경하지 않는다.

## UI와 이미지

- 유물 아이콘 68→42px, 좁은 화면 32px. 짧은 카드의 아이콘 옆에 이름/등급, 아래에 효과 설명. 넓은 화면에서는 3열. 장착/뽑기 버튼은 고정한다.
- `assets/shield-relics.png`: 새 유물 10종과 황금자석을 기존 금속·보석 화풍으로 제작. 마지막 원형 칸은 컨셉 참고이며 실제 보호막은 투명 캐시 이펙트를 사용한다.
- 내장 image_gen 사용. 원본을 프로젝트로 복사해 오프라인 HTML에 포함. 런타임 외부 요청 없음.

생성 프롬프트(참조: 기존 `relics.png`, `tide-relics.png`, 화풍만 참조):

> Create one production sprite ATLAS for an anime fantasy mobile RPG inventory. References are STYLE ONLY: match their ornate polished gold filigree, richly faceted jewels, crisp illustrated outlines, miniature magical treasure item aesthetic. Exactly FOUR columns by THREE rows, twelve equal square cells, 1536x1152 landscape if possible. Every object fully contained and centered in its cell with 15% padding, consistent perceived size, no labels, no text, no borders, no tile frames, no numbers. Truly transparent background across atlas, not green and not checkerboard. Exact row-major items: row1: (1) ornate gold hourglass with blue crystal sand, (2) four-leaf emerald clover gold charm exactly four leaves, (3) rolled purple magical contract parchment sealed with red wax, (4) single silver bullet with engraved silver filigree and violet jewel. Row2: (5) purple magical eye gemstone in golden eyelid pendant, (6) cyan wing-shaped rocket booster talisman with a short magical blue flame, (7) elegant single translucent pale blue glass slipper with pink bow and delicate gold detail, (8) dewdrop crystal cradled in fresh emerald leaves. Row3: (9) explosive cosmic star in a golden armillary sphere purple and orange BIG BANG motif, (10) handheld jeweled kaleidoscope tube showing rainbow prisms, (11) horseshoe GOLD MAGNET, ornate gold filigree and blue gems, definitely recognizable U magnet, detailed rendered highlights matching reference treasure style not flat vector, (12) a thin cyan magical circular protection barrier ring, transparent center with six subtle diamond ornaments, useful as gameplay shield overlay. No characters or scenery. Harmonize all 11 item icons with reference 1. Protection ring must have a CLEAR TRANSPARENT center, subtle glow and readable bright outline.

체커보드가 그려진 첫 출력을 교정한 최종 편집 프롬프트:

> Edit this exact 4-column 3-row fantasy inventory atlas. Preserve all twelve icons, their identity, arrangement, gold and jewel rendering. Replace EVERY grey/white checkerboard background pixel with uniform solid very dark navy #142036, including inside the last circular ring. No checkerboards anywhere. Background must be a single flat navy color edge to edge, no gradient, no fog, no tiles or borders. Keep fully contained objects with a little more padding at outer canvas edges. Do not change row order or number of icons. This is an opaque dark-background inventory sheet, NOT a transparent image.
