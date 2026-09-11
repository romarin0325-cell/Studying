# Dungeon expansion verification — 2026-09-12

Validated against origin/main e4d2a42 in an isolated worktree.

- Root `npm run verify`: PASS; selected only shooter. All 23 engine/progression tests passed, rebuilt the standalone HTML, then passed offline/mobile browser and progression-flow checks.
- Chromium viewports: 320×568, 390×844, 430×932, 844×390. Six heroes, twelve weapons, touch movement, bombs, pause, library, equipment, dungeon selection and denied storage were exercised. No page errors or external network requests in offline checks.
- Progression flow: off-day lecture and grammar unlock, vocabulary recovery, incorrect collocation continuation, sentinel gate, final grammar quiz, first-clear ticket, artifact draw, persisted claims/mistakes, and one grammar revival. The flow fixture exposes combat setup only in a test copy; the shipped bundle does not expose it.
- Seeded autopilot: 144 runs (12 weapons × 4 dungeons × 3 difficulties), 135 clears, no stalled runs. Easy 48/48, normal 47/48, hard 40/48. This checks completion and compares configurations; it does not establish human difficulty or enjoyment.
- Standalone renderer stress fixture: 390×844, 360 enemy bullets and 180 particles, new hero plus support fairy. Run after other browser checks completed: 60.00 FPS, p95 frame interval 16.8 ms, no page errors. A simultaneous run with browser verification measured 45.25 FPS; these are desktop measurements, not phone performance claims.
- Visually inspected actual sortie screens: Snow Rabbit has two rabbit ears and bare legs; Luna uses the reference-inspired halter top and gold ornamentation. Verified separate sprite cells, generated artifact icons, dungeon/quiz/reward screens.

The offline file is `dist/AstralBloom.html` (18.48 MiB). Screenshots and detailed local reports are in ignored `artifacts/`. Actual Android/iPhone hardware, browser-specific file opening, and sustained phone thermal performance remain unverified.
