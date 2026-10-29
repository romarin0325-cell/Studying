# Studying

브라우저에서 단일 HTML로 실행하는 게임 모음입니다. 공통 개발 규칙은 [AGENTS.md](AGENTS.md), 검증 범위는 [docs/verification-policy.md](docs/verification-policy.md)를 따릅니다. 게임 하나를 고칠 때는 그 폴더의 README에서 시작합니다.

## 게임 목록

| 폴더 | 게임 | 문서 시작점 | 실행 파일 |
| --- | --- | --- | --- |
| `defense/` | 드림위버: 별빛 정원 · Star Garden (정식 Defense) | [README](defense/README.md) · [AGENTS](defense/AGENTS.md) · [docs](defense/docs/README.md) | `defense/dist/StarGardenDefense.html` (Bright: `StarGardenDefenseBright.html`) |
| `card/` | DREAMWEAVER · Card | [card/README](card/README.md) · [doc](card/doc/README.md) | `card/dist/DREAMWEAVER.html` |
| `card_astra/` | DREAMWEAVER · Astra (Card의 새 화면) | [README](card_astra/README.md) | `card_astra/dist/DREAMWEAVER-Astra.html` |
| `card_lumen/` | DREAMWEAVER · Lumen (Card의 밝은 Postcard 화면) | [README](card_lumen/README.md) · [설계](card_lumen/docs/DESIGN.md) | `card_lumen/dist/DREAMWEAVER-Lumen.html` |
| `card_claude/` | DREAMWEAVER · Claude UI 비교 빌드 | [README](card_claude/README.md) | `card_claude/dist/DREAMWEAVER-Claude.html` |
| `shooter/` | 별의 잔향 · ASTRAL BLOOM | [README](shooter/README.md) · [doc](shooter/doc/README.md) | `shooter/dist/AstralBloom.html` |
| `survivor/` | ASTRA: NOCTURNE | [README](survivor/README.md) · [doc](survivor/doc/README.md) | `survivor/dist/AstraNocturne.html` |
| `rpg/` | Turn RPG: Legend Edition v9.5 | [README](rpg/README.md) | `rpg/new.html` (빌드 없음) |

`card_astra/`, `card_lumen/`, `card_claude/`는 `card/`의 규칙(`card/game/`)과 에셋을 읽습니다. `card_manual/`은 Card의 플레이어용 매뉴얼입니다.

## 명령

```powershell
npm ci
npm run verify:plan        # 바뀐 파일에 필요한 검사만 고른다
npm run verify             # 고른 검사를 실행한다

npm run build:defense      # Star Garden 일반판 + Bright
npm run test:defense       # Star Garden 단위·계약 테스트
npm run build:card         # Card
npm run build:card-astra   # Astra
npm run build:card-lumen   # Lumen
npm run build:survivor     # Nocturne
```

각 게임의 전체 명령은 `package.json`과 그 폴더의 README를 봅니다.

## 문서 구조

- 게임별 작업 규칙: 루트 [AGENTS.md](AGENTS.md)(공통)와 `defense/AGENTS.md`(Star Garden), `card/AGENTS.override.md`(Card).
- 게임별 문서: 각 폴더의 `README.md`, `doc/` 또는 `docs/`. Star Garden의 문서 종류는 [defense/docs/README.md](defense/docs/README.md)에 정리했습니다(현재 값·규칙은 루트, 기획은 `plans/`, 날짜 기록은 `archive/`).
- [기존 문서 조사와 보완 범위](docs/game-documentation-audit.md): 문서 위치와 현재 코드와의 차이를 기록합니다.

## 정리 이력

2026-10에 `defense_test/`를 `defense/`로 승격하고, 옛 Hero Core Defense(`defense/`), `defense_legacy/`, `card_legacy/`, `idle/`(Astral Companions), `english_vocab_version/`을 삭제했습니다. 필요하면 Git 기록에서 복구합니다. 루트의 `new.html`과 `data.js`는 `rpg/`로 옮겼습니다.
