# 글꼴

모두 SIL Open Font License 1.1로 배포된다. 게임에 넣어 함께 배포할 수 있다.
`build.mjs`가 파일을 `@font-face` 데이터 URL로 페이지에 넣는다. 그래서 인터넷이 없어도 같은 글꼴로 보인다.

| 파일 | 글꼴 | 쓰는 곳 | 출처·라이선스 |
| --- | --- | --- | --- |
| `Jua.woff2` | 주아(Jua) | 제목, 버튼, 이름, 큰 숫자 | The Jua Project Authors. 저장소의 `defense/assets/Jua-Regular.woff2`를 복사(2026-11-21). 전문 `Jua-OFL.txt` |
| `NotoSansKR.woff2` | Noto Sans KR 400–900 가변 서브셋 | 본문, 설명, 표 | Adobe·Google. 저장소의 `card_astra/assets/dreamsans-subset.woff2`를 복사(2026-11-21). 전문 `NotoSansKR-OFL.txt` |
| `Galmuri9.woff2`, `Galmuri11.woff2`, `Galmuri14.woff2` | Galmuri 2.40.3 | 전투 피해 숫자, HP 숫자 같은 도트 강조 | quiple, https://github.com/quiple/galmuri . npm 패키지 `galmuri@2.40.3`의 `dist/`에서 받음(2026-11-21, 소유자 승인). 전문 https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/LICENSE.txt |

게임에 나오는 글자 1,428자(한글 1,193자)를 Chrome에서 그려 확인했다(2026-11-21). Noto Sans KR 서브셋에 없는 것은 `↔ ↩ ✓ 힣`과 원작 데이터의 한자 3자뿐이고, 브라우저 기본 글꼴이 대신 그린다. 주아에는 `· × ◆ ▲` 같은 기호가 없어서 글꼴 목록의 다음 순서인 Noto Sans KR이 그린다.
