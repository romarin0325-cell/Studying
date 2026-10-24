# Bright skin "별빛 정원 · Postcard" (2026-10-25, pass 17)

The first bright redesign (white frosted glass + sky blue) was rejected by the owner as the default UI any AI produces. This one
starts from real screens of a current commercial game and an approved concept.

1. Reference study: Stella Sora (Yostar, 2025) in-game captures from the Game8 review
   (https://game8.co/articles/reviews/stella-sora-review). Not stored here (third-party art). Observed language: cobalt navy
   structure bars with slanted ends, a white circular back button + location pin + screen title, aqua primary buttons, warm paper
   panels with grid-paper texture and binder edges, gold sparkle stickers, coral NEW/price, bold italic titles, a rainbow pastel
   acquisition screen with a diagonal navy name band.
2. Concept mockups (GPT image via `codex exec -i`, references: our current screens + the captures as style-only):
   `concept-home.webp`, `concept-collection.webp`, `concept-adventure.webp`. The owner approved the direction with one correction:
   painted backgrounds and per-stage thumbnails carried GPT's excess detail and gloss, so the eye did not go where it should.
   Result: no stage thumbnails, flat vector ornaments only, the lobby repainted as a quiet background
   (`docs/art/bright-lobby-20261025/lobby-calm.png`), menu backdrops blurred and washed.
3. Implementation: `src/theme-bright.css` (component colour coverage recoloured onto the palette, then the Postcard shape layer at
   the end) and `scripts/theme-bright.mjs` (night surfaces map to warm paper, neutral ink to navy). Night skin unchanged.
