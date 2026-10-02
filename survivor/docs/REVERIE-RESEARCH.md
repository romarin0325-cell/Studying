# 달빛 온실 리뉴얼: 조사와 구현 판단

검토일: 2026-10-02 (Asia/Tokyo). `ee22302a54b1e9fc72eebb176b1d00f9000fc40d`에서 시작했고 최종 단계에서 최신 `main`의 `861ba483c8033a0070884621f1193decbe6f2bca`를 확인했다. 그 사이 Card·Shooter 변경을 최종 브랜치에 반영하며 Survivor 그림 원본은 그대로였다. 이전 PR의 [게임·AI 데모 15개 조사](RENEWAL-RESEARCH.md)를 기준으로 유지하고, 이번에는 짧은 원정, 시스템을 바꾸는 유물, 이동 동기화, 캐릭터 계측을 추가 조사했다. [접근 결과와 본문 해시](REVERIE-SOURCES.json)에 성공·실패를 함께 기록했다. 제작자의 모델·원샷 주장은 제작자 귀속이며 독립 재현한 성능 비교가 아니다.

## 빠른 성장과 다른 밤

| 확인한 자료 | 읽은 내용 | 이번 구현 |
| --- | --- | --- |
| [Vampire Survivors Wiki: Hurry Mode / stage modifiers](https://vampire.survivors.wiki/w/Hurry_Mode) | Hurry는 시계 속도를 두 배로 하고 경험치 +25%. 시간만 줄이는 것과 성장을 함께 당기는 것은 다르다. | 2·3·4분의 보스 일정, 2단계 시작 무기·준비된 필살기, 빠른 성장 비용, 경험치 배율. 원정 시간은 선택 화면을 제외한 전투 시간이다. |
| [Endless unlock / cycle guide](https://rogueranker.com/how-to-unlock-endless-mode-vampire-survivors/) 및 위키의 Endless 설명 | 마지막 웨이브 뒤 순환하며 적 체력·밀도·피해가 증가한다. 시간만 무한대로 만드는 것으로 끝나지 않는다. | 같은 지역에서 보스 세 종류가 반복되며 보스 체력과 군세 압력이 증가. 시간 승리 없음. 장비 완성 뒤 한계 돌파 선택과 99레벨 이후 성장. 원하는 때 정지 메뉴에서 정산. |
| [Vampire Survivors Wiki: Evolution](https://vampire.survivors.wiki/w/Evolution) | 촉매 유물·무기 조건이 장기 목표를 만들고, union/gift/morph 등 서로 다른 변환이 존재한다. | 14진화·4공명 지도 유지. 최대 유물과 진화 무기가 함께 있을 때 벽 반사, 필살기 시간 정지, 회피 공격을 여는 별도 각성. |
| [Vampire Survivors Wiki: Darkanas / Arcanas](https://vampire.survivors.wiki/w/Darkanas) | Gemini의 별도 무기, Sapphire Mist의 추가 발사, 이동·회복·정지 등의 행동을 공격으로 바꾸는 사례. 보상 보스도 규칙에 포함된다. | 0.3초 지연 재공격, 회피로 적 탄환을 아군 추적탄으로 전환, 정지 시 주변 적 시간 정지, 회피 출발점으로 귀환하는 문. 네 유물은 일반 장비 칸을 소비하지 않는다. |

매판 네 가지 별자리 중 하나가 정해진다. 경험치와 별비, 정예 사냥, 충전과 회피 경험치, 이동 회복과 제단 추가 회복이 각각 다른 행동을 유도한다. 18초부터 별비·도망치는 보물·등불·거래 제단이 순서와 위치를 달리하며 등장한다. 등불 근처에 머무르는 행동은 거래를 열고, 누적 회피·필살기·제단 이용·정지 조건도 비밀을 연다. 무작위 선택과 행동으로 발견하는 선택을 함께 둬서 운만 기다리지 않게 했다.

거래에는 이번 원정의 최대 생명을 내는 비용과, 회복·재화만 받는 대안이 있다. 무조건 받아야 하는 새 슬롯을 늘리지 않는다. 원정 난이도는 이전 일식의 체력·피해·밀도를 기준으로 하고, 새 일식은 더 많은 군세와 피할 수 있는 유성우를 추가한다. 최고 난이도의 승률을 맞추기 위한 반복 조정은 하지 않았다.

성장 그래프는 공격력 수치의 장식 그래프가 아니다. 실제로 적에게 준 피해를 10초 창으로 집계하고 레벨·처치·진화 기록과 함께 저장한다. 정지와 결과 화면에서 첫 진화 시점과 실제 피해/초의 변화를 볼 수 있다. [자동 조작 측정](REVERIE-GROWTH.json)은 진행 검증용이며 사람의 재미나 첫 선택 시간을 보증하지 않는다.

## 움직임의 시간축

[Gaffer: Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/)의 누적 시간·이전/현재 상태 보간을 적용했다. 판정은 계속 60Hz이며 `alpha = accumulator / fixedDt`를 화면에 전달한다. 플레이어·적·탄환·이동 보상·카메라가 같은 보간 상태를 사용한다. 걷기 여부는 시뮬레이션과 입력에서, 걷기 거리는 시뮬레이션의 실제 이동량에서 얻는다. 화면 프레임 사이의 좌표 차이로 걷기/정지를 추측하지 않는다.

카메라에는 선형으로 움직이는 보간 목표를 감쇠식 안에서 적분했다. 정지 목표용 지수 감쇠만 쓰면 가변 프레임 간격에 따라 추적 지연이 변할 수 있기 때문이다. 큰 지연에는 최대 6개 전투 스텝으로 복구 작업을 제한한다. 순간이동은 이전 좌표도 귀환 위치로 맞춰 화면 전체를 가로지르는 가짜 이동을 만들지 않는다.

[Godot Sprite2D](https://docs.godotengine.org/en/stable/classes/class_sprite2d.html)의 centered/offset 설명과 [FrameSprite의 pivot jitter 안내](https://www.framesprite.com/guides/fix-sprite-animation-jitter)도 확인했다. 앵커 불일치와 화면 시간축 불일치는 서로 다른 문제다. 렌더 보간을 고친 뒤에도 원본 실루엣 중심을 프레임마다 가운데 맞추는 방식은 보행 루트를 흔들 수 있어서, 별도의 목·발 기준을 기록했다.

## 생성 일관성과 계측의 경계

- [OpenAI의 공개 imagegen 지침](https://github.com/openai/skills/blob/main/skills/.system/imagegen/SKILL.md)은 입력·참조·구조·제약을 분리하고 정체성 보존을 명시한다. 이번에는 기존 인물을 다시 생성하기보다 공유 원본을 보존하고 온실 배경과 비밀 유물/이벤트 소품을 생성했다.
- [Runware의 Canny 게임 에셋 가이드](https://runware.ai/docs/models/flux-1-dev/guides/game-assets-canny)와 [Diffusers IP-Adapter 문서](https://huggingface.co/docs/diffusers/using-diffusers/ip_adapter)는 구조 참조와 이미지 정체성 참조를 조합할 수 있음을 보여준다. 이 저장소에서 해당 모델을 설치하거나 실행했다고 주장하지 않는다. 얼굴 참조만으로 머리·몸 비율이 정확히 고정된다는 근거로도 쓰지 않는다.
- [커뮤니티 art-director 지침](https://github.com/roohe/agentic-super-skills/blob/master/skills_library/game-art-director/SKILL.md)은 작은 화면의 실루엣, 참조 목적, 일관된 아이콘 언어와 기술 예산을 강조한다. 서술형 역할 지침이고 두개골 자동 검출기나 정량 허용오차 표준은 아니다.
- GameMaker 포럼과 Reddit 두 글은 403, Fandom 세 페이지는 402였다. 내용을 읽었다고 처리하지 않았고 접근 가능한 위키·문서로 보완했다. 오래된 공개 imagegen 경로의 404도 실제 `.system` 경로로 정정했다.

체형 정책은 현재 [Defense 아트 기준](../../defense/ART_DIRECTION.md)을 따르는 **머리 크기 고정 + 몸·다리의 작은 키 차이**다. 붙여넣은 자료의 오래된 2.7등신 템플릿을 현재 공유 그림에 덮어쓰지 않는다. `body-profile.json`의 정수리·턱·발·루트와 원본 해시는 수동 추정의 출발점을 명시한다. 귀·왕관·머리카락·무기를 머리 높이에 포함하지 않는다. 얼굴 도감은 얼굴 중심, 전신은 발 기준으로 표시한다.

목 기준 위쪽은 일정한 머리 높이로, 아래쪽은 캐릭터별 몸 높이로 정규화한다. 기본 전신과 보행에 같은 목표를 사용하고, 이미지 외곽 bbox는 실제 그림 잘림을 검사하는 용도다. 보행 셀은 여백을 208px로 넓히면서 화면 크기 배율을 별도로 보정해, 큰 무기 때문에 인물을 축소하지 않는다. 원본 피부/의상의 흰색을 투명 키로 사용하지 않는다. 정수리 추정·움직이는 발 접촉은 자동으로 확정할 수 없으며, 소스 해시·계측값·정면/측면 비교본·인터랙티브 검토기를 함께 제공한다.

[TexturePacker의 Texture Settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings)는 이웃 이미지 샘플링을 막는 shape padding과 경계 픽셀 반복 extrude를 구분한다. 이번 문제에는 원본 셀 안에 이미 다른 그림 조각이 들어 있었으므로 패딩만 늘려 해결할 수 없었다. 연결 성분을 분석해 경계에서 잘린 이웃 조각을 제거하고, 의도된 가까운 구성 요소는 보존했다. 출력 셀의 투명 여백과 실제 렌더링을 별도로 확인한다.

## 품질과 실행 비용

이전 조사의 MDN Canvas·Pixi·web.dev·Object Pool 자료에 따라 반복 마법 문양·광원·텍스트를 캐시하고, 화면 밖 개체를 생략하며, 한도 있는 효과와 전투 개체 수를 유지한다. Canvas2D 아틀라스를 WebGL 배칭이라고 부르지 않는다. 보스·경험치·상자를 장식 품질 조절 때문에 버리지 않는다.

이번 추가 최적화는 선택한 보행 시트를 지연 디코딩하고 최근 두 장만 유지하는 것이다. 전체 이미지의 계산상 RGBA 합계는 80.19MiB이지만, 보행 두 장까지의 같은 계산은 61.71MiB이다. 이는 JS 문자열·CSS·캐시·GPU·브라우저 자체를 포함한 총 메모리 측정이 아니다. 선명/자동/가벼움 설정은 해상도와 장식만 바꾸며 전투 snapshot을 바꾸지 않는 검사를 유지한다. 최종 측정과 실제 기기 검증의 범위는 [VALIDATION.md](VALIDATION.md)에 기록한다.
