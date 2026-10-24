# Bright lobby background (2026-10-25, pass 17)

GPT image (Codex `image_gen`, `codex exec -i`), 1024x1536 PNG. **Adopted (pass 17 Postcard skin): `lobby-calm.png`** — a repaint of the lounge at ~25% detail, low contrast, soft far windows, so the partner and the UI lead (owner feedback on GPT over-detail). `lobby-calm-alt.png` is the ~40% detail variant. References for style only: `assets/bright/garden.webp`,
`assets/bright/summon-altar.webp`. The first version was `lobby-greenhouse-lounge.png` (kept for comparison); `assets/bright/lobby.webp` is now `lobby-calm.png` at
WebP q92 (the build input; `scripts/optimize-images.mjs` makes the deployed copy). `lobby-sky-terrace-alt.png` is the unused
alternative, kept for comparison.

Why the lounge: a relationship game's home screen is the room where you spend time with the partner. The star rug at the lower
centre is where the companion stands, the bookshelf and tea table echo the library and gifts, and the side framing keeps the
centre column calm for the partner and the UI.

Common prompt frame: "Use your image generation tool to create ONE image ... (portrait, 1024x1536). Images 1-2 are style
references only ... Subject: the HOME SCREEN background of a bright, modern anime subculture collection / relationship game
(Stella Sora, Blue Archive lobby quality)." Both end with: keep the central column (middle 55% of the width, from 20% to 90%
height) calm and free of objects, keep the top 12% calm for a status bar, high key, no dark vignette, no characters, text, UI,
logos or watermark.

- Lounge: a cozy sunlit glass-house lounge inside a dream garden; tall white-framed arched windows with sky and greenery; morning
  light from the upper right; plants, ivy and pastel flowers at the edges; a round white tea table with a teapot and a cushioned
  bench at the far right, a bookshelf corner with a lamp at the far left; open warm cream tiled floor with a soft round rug centred
  at about 74% height. Palette: cream white, warm honey, sky blue, mint, blush pink.
- Sky terrace (alternative): a floating sky garden terrace on a spring morning; white marble arches with wisteria, hydrangea and
  roses at the left and right edges; open pale cream terrace floor with a round star-and-circle inlay at about 74% height; floating
  islands in a soft blue sky. Palette: sky blue, cream white, peach, mint, lavender.
