# NOCTURNE 리뉴얼 조사와 제작 기준

조사일: 2026-10-01. 기준 Git: `82da18a` (`main`, 저장·재시작 회귀 수정 포함). 아래 조사를 먼저 마친 뒤 리뉴얼 구현을 시작했다.

## 15개 게임 사례에서 확인한 것

Steam 12개 게임은 공식 소개, 공식 스크린샷 각 2개, 전체 언어·구매 유형의 사용자 평가 집계를 조회했다. 그중 첫 번째 화면 12개를 직접 시각 검토했다. 평가는 집계 시점의 반응이며, 특정 기능이 성공을 일으켰다는 실험적 증거는 아니다. 원본 URL과 평가 수·비율은 [RESEARCH-SOURCES.json](RESEARCH-SOURCES.json)에 보존했다. 다른 게임의 그림·음악·코드를 이 게임에 복사하지 않는다.

| 사례 | 직접 확인한 설계·화면 | 이번 작업에 적용할 판단 |
| --- | --- | --- |
| [Vampire Survivors](https://store.steampowered.com/app/1794680/) | 발사 방향이 다른 무기, 대량 경험치, 진화와 반복 원정, 군세 속 선명한 공격 궤적 | 성장 선택이 다음 조합으로 이어지고, 완성 순간 공격 범위·발사 형태가 달라져야 한다. |
| [Brotato](https://store.steampowered.com/app/1942280/) | 6개 무기, 짧은 웨이브와 상점, 어두운 바닥 위 명확한 실루엣 | 짧은 긴장과 보상을 교대하고, 보이는 무기로 빌드를 읽게 한다. 초반부터 약한 공격으로 오래 버티게 만들지 않는다. |
| [HoloCure](https://store.steampowered.com/app/2420510/) | 캐릭터별 얼굴·개성, 캐릭터 수집 화면, 무기 조합 중심 소개 | 같은 캐릭터를 쓴다는 의미를 얼굴뿐 아니라 시작 무기·필살기·조합에 반영한다. |
| [Halls of Torment](https://store.steampowered.com/app/2218750/) | 일관된 사전 렌더 아트, 장비 슬롯, 바닥과 공격의 명암 분리 | 캐릭터·적·아이템의 그림체와 크기를 맞추고, 효과 때문에 위험 예고가 가려지지 않게 한다. |
| [Death Must Die](https://store.steampowered.com/app/2334730/) | 회피, 월드 성소, 축복 조합, 넓은 참격과 명확한 타격 중심 | 이동할 이유와 공격 출발점을 명확히 하고, 발 좌표와 몸통 좌표를 구분한다. |
| [Soulstone Survivors](https://store.steampowered.com/app/2066020/) | 큰 범위 공격·위험 원, 보스 여러 개와 빌드 확장 | 화려함은 공격 형태에서 만들고 위험 표식의 색·레이어는 일관되게 유지한다. 반복 경험치 소리는 제한한다. |
| [Deep Rock Galactic: Survivor](https://store.steampowered.com/app/2321470/) | 채굴·임무·탈출이 이동 목적을 제공, 성장 무기 슬롯 | 단순 원형 도주 외에 가까운 보상과 짧은 목표를 제공한다. 강해지기 전의 긴 고생과 미세한 성장에 대한 불만도 고려한다. |
| [20 Minutes Till Dawn](https://store.steampowered.com/app/1966900/) | 제한된 색 팔레트, 선명한 탄환·소환·진화, 짧은 원정 | 무기마다 색만 다른 동일 삼각형을 쓰지 않는다. 화면을 가득 채워도 공격 역할은 구별돼야 한다. |
| [Boneraiser Minions](https://store.steampowered.com/app/1944570/) | 각기 다른 소환수 공격, 높은 대비, 회피와 수집 | 개체별 역할·움직임을 읽을 수 있게 한다. 군세에서 개체가 구별되지 않는다는 사용자 불만을 피한다. |
| [Rogue: Genesia](https://store.steampowered.com/app/2067920/) | 경로 선택, 대규모 군세, 많은 업그레이드와 유물 | 수치 증가와 별도로 빌드 방향을 선택하게 하고, 콘텐츠 수만 늘리면서 복원·전투 안정성을 잃지 않는다. |
| [Nordic Ashes](https://store.steampowered.com/app/2068280/) | 손으로 그린 듯한 일관된 아트, 성좌 성장, 성소, 승천 | 조합의 연결 관계를 화면에서 보여준다. 장기 해금 노가다보다 한 원정 안의 성장을 먼저 제공한다. |
| [SNKRX](https://store.steampowered.com/app/915310/) | 단순한 그래픽이라도 클래스 조합·현재 수·목표가 명료함 | 도감은 설명 목록에서 끝나지 않고, 현재 장비로 무엇이 부족한지 보여줘야 한다. |
| [Neon Siege](https://promptengineer48.github.io/claude-opus-5.5-games/neon-siege/) | 실제 Chromium에서 시작·배치·이동/발사 입력과 게임 화면 확인. 일관된 네온 공간·HUD·무기 슬롯·전체화면·품질 옵션 | AI 웹게임에도 통일된 시각 언어, 조작 안내, 첫 진입, 품질 조정이 기본 품질로 기대된다. |
| [Mortal Clash](https://promptengineer48.github.io/claude-opus-5.5-games/mortal-clash/) | 실제 Chromium에서 캐릭터 선택과 입력, 3D 캐릭터의 준비 동작 확인 | 움직이는 캐릭터와 선택 상태가 있는 완결된 UI가 기대된다. 외부 모델·폰트를 쓰는 데모임도 확인했다. |
| [Pelican Bicycle Adventure](https://claude-opus-5-5.riba2534.cn/) | 실제 Chromium에서 시작 화면·진입 후 해안 장면·설정/카메라 HUD 확인 | 간결한 주제라도 움직임, 주변 공간, 소리·전체화면·품질의 세부 완성도가 중요하다. |

AI 데모의 실행 관찰은 첫 진입과 일부 입력·화면까지이며 전체 게임 완주 검증은 아니다. ‘원샷’ 및 사용 모델의 귀속은 [제작자 저장소](https://github.com/PromptEngineer48/claude-opus-5.5-games), [riba2534의 원본](https://github.com/riba2534/claude-opus-5-5-demo), [출처가 연결된 커뮤니티 모음](https://github.com/magiccreator-ai/awesome-claude-opus-5-5-demos)의 제작자 설명이다. 프롬프트부터 결과까지 독립 재현했다고 주장하지 않는다.

[Anthropic의 Opus 5.5 공식 발표](https://www.anthropic.com/claude-opus-5-5)도 확인했다. 발표는 코딩 성능과 게임의 그래픽·마감 개선 사례를 설명하지만, 특정 모델로 만들었다는 사실만으로 완성도나 재미가 증명되지는 않는다. 이번 작업의 판단 기준은 실제로 조작되는 게임, 고유한 아트, 납득되는 움직임과 타격, 첫 1분의 성장, 상태 복원, 화면 크기별 사용성, 측정한 실행 비용이다.

## 뱀서의 재미를 해석한 방식

[Luca Galante 인터뷰(Pocket Tactics, 2024-10-25)](https://www.pockettactics.com/vampire-survivors/interview)는 완벽한 수치 균형보다 재미있는 힘과 혼돈, 캐릭터별 즐거움을 강조한다. [Game Developer의 개발 과정 보도](https://www.gamedeveloper.com/design/vampire-survivors-development-sounds-like-an-open-source-fueled-fever-dream)는 사용하기 쉬운 도구·스프라이트, 개별 공격 패턴, 플레이어의 자발적 도전을 설명한다. 개발자의 도박 업계 경력을 게임 전체의 설계 원인으로 단정하는 설명은 이 인터뷰 내용과 다르므로 그대로 반복하지 않는다.

적 처치 → 바닥에 남은 보상 → 위험을 감수한 수집 → 짧은 선택 → 이전에 못하던 공격 → 더 큰 군세라는 순환이 핵심이다. 단순 피해 +몇 %만 계속 주는 대신, 발사 수·관통·연쇄·범위·조합이 보이는 시점을 앞당긴다. 진화에 필요한 조각과 장비 한도는 즉흥 선택 속에서도 장기 목표를 만든다. 적을 계속 강화하는 것만으로 긴장을 만들지 않고, 군세·정예·보상·잠깐의 우세가 번갈아 오도록 한다.

제작 목표는 첫 유효 타격 수 초, 첫 성장 약 10초, 첫 보상 상자 30초대, 원정 전반부의 첫 진화다. 이는 조사에서 복사한 보편 법칙이 아닌 이 모바일 게임의 목표이며, 실제 자동 플레이와 조작 검증으로 결과를 기록한다. 연속 처치와 무기 간 공명은 위험을 무릅쓰고 싸울 동기를 더한다. 저성능 모드가 적·피해·보상을 바꾸어 난이도를 낮추어서는 안 된다.

## 아트와 움직임의 기준

- 기존 캐릭터의 성별·머리 형태·의상·손에 든 물건을 유지한다. 고정된 머리 대 몸 비율, 발의 기준점, 같은 방향 안에서 흔들리지 않는 카메라를 사용한다.
- 실제 보행 프레임은 발의 교대, 무릎과 팔의 반대 움직임, 옷자락의 작은 후행을 보여야 한다. 캐릭터 전체를 위아래로 흔드는 것을 걷기 에셋이라고 부르지 않는다.
- 무기·유물·일반 적·보스·보상 상자는 서로 다른 실루엣의 그림을 사용한다. 일부 기하학적 마법 문양은 의도적으로 제작한 벡터 문양을 한 번만 그려 캐시해서 쓴다.
- 투사체의 판정과 시각적 출발점을 함께 검토한다. 바닥 그림자, 몸통·손, 타격점은 목적이 다르다.
- 적 위험 예고와 플레이어의 위치는 아군 효과보다 잘 읽혀야 한다. 풍성한 효과가 입력 지연과 화면 가림의 핑계가 되어서는 안 된다.

## 조사한 최적화와 적용 원칙

| 근거 | 적용할 방법·주의점 |
| --- | --- |
| [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) | 반복 그림·광원·문양은 미리 렌더링. 크기가 정해진 스프라이트를 준비하고 프레임마다 픽셀 검사·복잡한 패스를 하지 않는다. 배경 캐시, 불투명 캔버스, 필요한 곳만 정수 좌표를 사용한다. |
| [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips) | 스프라이트 시트, 작은 텍스처, 보이는 개체만 그리기, 필터·마스크 최소화, 텍스트 갱신 제한. 본 게임은 Canvas2D이므로 시트 사용만으로 WebGL 배칭이 생긴다고 주장하지 않는다. |
| [web.dev Rendering performance](https://web.dev/articles/rendering-performance) | 60Hz의 16.7ms 중 브라우저에도 시간이 필요하다. 평균뿐 아니라 긴 프레임과 작업 시간 분포를 확인한다. UI는 매 프레임 레이아웃을 만들지 않고 필요한 값만 갱신한다. |
| [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) | 고정 전투 시간 간격과 제한된 누적 스텝 유지. 느린 프레임을 보상하려다 연산이 폭증하는 상황을 막고, 화면 보간은 전투 판정과 분리한다. |
| [Game Programming Patterns: Object Pool](https://gameprogrammingpatterns.com/object-pool.html) | 수명이 짧고 수가 많은 효과는 제한된 재사용 공간과 제자리 정리를 사용한다. 풀의 객체는 재사용 시 전부 초기화한다. 보상·보스는 장식 효과와 달리 용량 부족으로 조용히 버리지 않는다. |

그림의 압축 파일 크기와 디코딩 뒤 메모리는 별개로 계산한다. 카메라 밖의 그림·효과를 생략하고, 해상도·장식 효과는 측정한 부하에 따라 완만하게 조정한다. 품질을 자주 오르내리지 않도록 지연과 여유 구간을 둔다. 실제 휴대폰의 GPU·온도·배터리는 클라우드 브라우저의 CPU 작업 시간으로 대체할 수 없다.
