# 실제 확인한 게임/UI 자료

2026-10-02 UTC에 직접 가져온 자료입니다. 11개의 게임을 살폈으며, 아래에서 브라우저 실행과 공개 소개·반응 열람을 구분합니다. 원본 URL, HTTP 결과, 텍스트 SHA-256은 [sources.json](sources.json)에 있습니다. 소개·평점은 재미의 원인이나 이 패치의 품질을 증명하지 않습니다.

| 게임 | 확인 범위 | 이번 패치에 쓴 판단 |
| --- | --- | --- |
| [10 Minutes Till Dawn](https://flanne.itch.io/10-minutes-till-dawn) | 실제 WebGL 메인 로딩, 메뉴·공개 설명·댓글. 공개 평점 4.8/744 | 중앙의 명확한 시작 동작, 짧은 동작명, 제한된 장식. 후반 돌진이 피하기 어렵다는 댓글은 읽을 수 있는 예고·공간이 중요하다는 반례 |
| [PokéRogue](https://pokerogue.net/) | 실제 로그인 화면·공개 최신 menu-ui-handler 소스. 로그인/전투 안 함 | 상태별 메뉴 옵션과 save/quit의 명확한 의미, 배경·메뉴 프레임의 일관성 |
| [HoloCure](https://kay-yu.itch.io/holocure) | 공개 페이지·스크린샷/설명. 4.9/5,201. Windows 게임 실행 안 함 | 캐릭터 정체성과 빌드 조합의 반복 가치. 이번 아트는 초상/인게임/전신 역할 분리 |
| [Vampire Survivors](https://poncle.itch.io/vampire-survivors) | HTML5 공개 설명·반응. 4.8/1,655. 해당 플레이 세션 실행 안 함 | 급격한 성장, 지속적 선택, 강력한 후반 종료 압력. 반복 사신 관련 실제 댓글을 확인 |
| [Brotato](https://store.steampowered.com/app/1942280/Brotato/) | Steam 공개 설명·평가. 영어 평가96%/32,442, 최근89%/1,074 | 기본 자동 공격, 뚜렷한 빌드·짧은 플레이. 일시정지에서 실제 장비/성장/다음 시련을 읽기 쉽게 |
| [Boneraiser Minions](https://store.steampowered.com/app/1944570/Boneraiser_Minions/) | 공개 설명·반응. 영어96%/4,014, 최근90%/21 | 각 유물·동료가 개성을 가진 그림으로 읽혀야 함. 장식 기호만으로 도감/행동을 대신하지 않기 |
| [Death Must Die](https://store.steampowered.com/app/2334730/Death_Must_Die/) | 공개 설명·스크린샷·평가. 영어91%/14,036, 최근89%/66 | 보스/장비 조합과 직접 회피의 역할. 단순 높은HP에만 기대지 않고 형태가 다른 공격 채택 |
| [Halls of Torment](https://store.steampowered.com/app/2218750/Halls_of_Torment/) | 공개 설명·보스/성장 화면 자료 | 전장 위험과 캐릭터 silhouette 분리, 위험 뒤의 실제 안전 구역 |
| [Soulstone Survivors](https://store.steampowered.com/app/2066020/Soulstone_Survivors/) | 공개 설명·장판/빌드 화면 자료 | 선·고리·지속 영역을 서로 다른 위험으로 읽고, 아군 효과 위에 적 예고 유지 |
| [Magic Survival](https://play.google.com/store/apps/details?id=com.vkslrzm.Zombie) | 한국어 모바일 스토어 소개·반응/스크린샷 | 모바일 자동 공격과 빠른 성장 선택의 간결함, 바닥의 안정적인 캐릭터 접지 |
| [Survivor.io](https://play.google.com/store/apps/details?id=com.dxx.firenow) | 모바일 스토어 소개·반응/스크린샷. 공개4.5/1.12M | 그림 메뉴와 엄지 조작 구역 분리. 두 버튼을 왼쪽에 겹치는 현재 문제를 직접 해결 |

Card의 활성 `src/astra.css`와 Shooter의 활성 `style.css`·`app.js` 메뉴 프레임, 현재 Defense의 아트 계약도 읽었습니다. 그 게임의 실행 코드와 검증 규칙은 변경하지 않았습니다.

'Opus 5.5 원샷' 특정 게임의 모델/버전 귀속은 독립 확인할 자료를 확보하지 못했습니다. 사용자 지시의 실제 웹게임 UI 대안을 활용했습니다. 모델 이름의 홍보 주장보다 실제 완성 화면·동작·배포 검사·반복 제작 결과를 품질의 근거로 사용합니다. 공개 게임의 일러스트를 이 저장소에 가져오지 않았습니다.

실무 자료는 [48개 방법과 결정](methods.txt), 실제 생성/실패/수정 과정은 [시도 기록](trials.txt)에 있습니다. 잘못된 Clip Studio 글과 접근 실패/검색 리다이렉트는 성공 자료에서 제외했습니다.
