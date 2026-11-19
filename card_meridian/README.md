# DREAMWEAVER · 새벽 항로

[게임 열기](dist/DREAMWEAVER-Meridian.html) · [실제 플레이 화면](preview.webp)

HTML을 브라우저에서 열면 바로 플레이할 수 있다. 이 빌드에는 로컬 일러스트 157개의 WebP 사본, 화면 배경, 한국어 글꼴과 내장 문제가 들어 있다. 초상화는 선택한 폴더, 지정한 경로 또는 HTML 옆의 원본, 내장 그림 순으로 읽는다. 음원은 기존 파일명으로 HTML 옆에 둔다.

## 플레이

- 첫 방문의 **첫 여정 시작**은 오리진 엔드리스를 연다. 첫 소환에 쓸 티켓 수를 확인한 다음 카드를 뽑고, 결과 화면에서 출전 자리를 정한다. **모드 선택**에서는 전투·파티 빌딩·학습으로 나누어 둘러볼 수 있다.
- 항해일지는 현재 상대로 출전할 수 있는지 판단한다. 편성, 퍼즐 조각, 드래프트, 팩토리 카드풀 등 준비가 필요하면 그 행동을 주 버튼에 표시한다. 상대 원화를 누르면 이번 스테이지의 보정된 능력치와 스킬을 읽을 수 있다.
- 소환 결과에서 빈자리에 배치하거나 교체할 동료를 직접 고른다. 같은 카드는 실제 보유 매수 안에서 편성한다. 다시 소환하는 버튼에 티켓 비용을 표시한다.
- 전투의 **스킬 설명**에서 현재 캐릭터의 스킬과 MP 비용을 확인한다. 일반 승리 결과에서는 획득한 티켓을 확인하고 다음 전투, 보너스 퀴즈 또는 여정 복귀를 선택한다. 필수 퀴즈와 모드 클리어는 해당 모드의 후속 절차로 이어진다.
- 소환, 편성을 마치고 여정으로 돌아온 시점, 일반 승리 정산 시점에 진행을 저장한다. 이어가기는 저장된 스테이지의 항해일지에서 열린다. 다른 버전의 여정을 옮기려면 기존판에서 저장한 뒤 **설정 → 기록 내보내기**, 이 버전에서 **설정 → 기록 가져오기**를 사용한다.

## 구현과 확인

저장소 루트에서 실행한다.

```sh
npm run build:card-meridian
npm run test:card-meridian
```

빌더는 아스트라의 공통 화면 스타일 및 자산과 `card/game`의 로더 순서를 사용한다. 여정, 전투 결과, 메뉴, 소환과 편성 코드는 이 폴더의 `src`에서 관리한다. 게임 데이터와 전투 판정은 기존 엔진이 담당한다.

빌드 시 저장소 옆의 `일러스트` 폴더에서 PNG를 읽는다. 다른 폴더는 `node card_meridian/build.mjs "그림 폴더 경로"`로 지정한다. 해당 폴더가 없는 환경에서는 배포 HTML 옆의 원화를 읽는 빌드를 만든다. 미등록 초상화에는 해당 테마의 카드 뒷면이 표시된다.

브라우저 검증은 임시 프로필에서 단일 HTML을 직접 연다. Playwright Chromium 또는 `CHROMIUM_PATH`에 지정한 Chromium 계열 실행 파일을 사용한다. 실제 쿠키와 저장을 쓰는 온라인 학습 서비스는 별도의 사용자 환경에서 실행된다.

## 디자인 참고와 원화

『섀도우버스 월즈 비욘드』의 공식 가이드를 보며 카드 열람과 덱 편성, 전투 자원과 행동을 각각 어느 화면에서 읽게 할지 검토했다. 새벽 항로에서는 출전 버튼 옆에 상대 정보를 두고, 행동을 고르는 자리에서 실제 비용과 설명을 확인할 수 있게 했다. [전투 가이드](https://shadowverse-wb.com/en/system/cardbattle/battle/) · [덱 편성 가이드](https://shadowverse-wb.com/en/system/cardbattle/deck/)

타이틀은 캐릭터 한 명과 배경의 구도로 게임의 분위기를 전한다. 『리버스 1999』의 공식 캐릭터 소개와 갤러리를 시각 레퍼런스로 삼고, 이 게임의 루나 원화를 출발점으로 새 표지를 그렸다. [공식 사이트](https://re1999.bluepoch.com/en/home/)

내장 GPT Image로 [루나 타이틀](assets/luna-dawn.webp)과 [하늘길 배경](assets/skyway.webp)을 생성했다. [카드 뒷면](assets/passage-back.svg)은 항로의 나침반을 코드로 그렸다. [서재의 루미](assets/lumi-study.webp)는 기존 `card_lumen/assets/lumi-study.webp`에서 가져왔다. 한국어 글꼴은 아스트라에 포함된 Noto Sans KR 서브셋을 사용하며 OFL 라이선스를 HTML에 포함한다.

<details>
<summary>루나 타이틀에 사용한 프롬프트</summary>

참조 원화는 로컬 `일러스트/루나.png`이다.

```text
Use case: illustration-story. Create an original panoramic landscape title illustration (wide 16:9 or wider) for the Korean fantasy card RPG DREAMWEAVER. Image 1 is the canonical design reference for Luna. Preserve her short silvery lavender bob, violet eyes, small teardrop gold forehead ornament, dark lace hood and long sweeping ink-black and purple mantle with gold detailing. New scene and pose: Luna in three-quarter profile looking back toward the viewer, holding a small ivory star chart in her hand at an open observatory terrace overlooking an immense turquoise sea of clouds, terraced ivory coastal towers, one distant crimson sailing airship and soft coral and golden apricot morning light. Character framed waist-up on the RIGHT, face at about x=72%, y=38%, surrounded by sky so the right hand part can also be cropped for a portrait screen. Large calm sky opening and receding city to the LEFT for a game title, one elegant dark curving brass astronomical armillary arc entering from the upper right in the foreground. A confident 2D anime art director's key visual: beautiful delicate facial drawing, hand-painted gouache-like skies and thoughtful architectural perspective, atmospheric depth, broad masses of color under sharply drawn details, flowing wind in her veil, restrained fine print grain, luminous light, strong silhouette. High value contrast of dark hair veil against luminous sky. No text, numbers, watermark, logos, card frames, UI panels, border, collaged stock motifs, lens flare or glitter particles. This is a finished game background, not a UI mockup.
```

</details>

<details>
<summary>하늘길 배경에 사용한 프롬프트</summary>

```text
Use case: stylized-concept. An original premium 2D background painting for the mobile fantasy card RPG Dreamweaver: the route leaving an old astronomical sea observatory at daybreak. A magnificent semicircular ivory stone viaduct curves across a teal sea of clouds toward a distant tiny domed gate at right-center; a pair of striking vermilion cloth pennants on tall slim bronze poles bending in the wind near the right side, one glowing peach sun low on the distant horizon; a solid shadowed cypress and dark petrol-teal stone escarpment on the left foreground. The subtle curves of the golden brass instruments and stone bridges repeat, distant sky with towering pink-apricot cumulus and desaturated mint light. Wide panoramic 16:9 environmental illustration, compose action band across the middle third for a wide banner crop, foreground left remains dark and quiet for overlaid live text. Distinct graphic silhouette, small exquisite hand-drawn architectural details, painterly gouache planes, fine print texture, airy and uplifting; restrained illustrated anime fantasy art direction. No people or monsters, no characters, no text, numbers, logos, UI, frame, watermarks or card outlines. An actual game environment, not a mockup or photograph.
```

</details>
