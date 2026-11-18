# R4b sprite experiment

Three built-in image generations, one per character, with both anchors: zeke 27.23 s, flame_sage 78.16 s, cherry_prince 50.92 s. Calls ran concurrently; these are individual elapsed wall times. No retries.

## Comparison

The cut group B sprites plausibly belong in the same game as group A, but do not match exactly. The pixel scale is broadly similar by eye and the grid estimate is the same; B has busy, fine armor and hair detail, dark outlines of variable thickness, and bright highlights. Cherry Prince is paler and his cape and gold trim have finer detail than Luna; Zeke's head and sword read slightly busier than Red Dragon. The palette and edge noise remain visible. The group sample is too small to establish a production-wide improvement.

- **Zeke:** Faces right in all three; recognizable red and flame-colored hair, black armor, red coat and sword. Hurt pose loses the sword; the detached reaction marks and attack sparks are removed by cutting.
- **Flame Sage:** Faces right in all three; recognizable ponytail, dark coat, bandages, red trousers and flame. His idle face is closer to a three-quarter view; detached hurt marks and attack sparks are removed.
- **Cherry Prince:** Faces right in all three; recognizable white hair, pink jewel, white-and-gold uniform and pink-lined cape. The detached attack slash and sparks and hurt marks are removed by the main-component cutter.

The three-pose layout, magenta backdrop, character identity, right-facing direction and closed eyes in hurt poses are visibly followed. The requested strict 24-color limit, uniform one-pixel #2b2140 silhouette, and clean unblended edges are not met: raw idle colors exceed 1,700 five-bit buckets even at 95% coverage, and edge medians are far from the specified color. Hurt reaction marks occur outside the attack cell. Exact head-size equality, 15-degree lean, weapon extension, three-step shading, and lighting direction were not measured and cannot be claimed as verified. Idle flames and sword details also show why detached effects and thin details require review after cutting.

## Measurements

A: four earlier unanchored characters. B: three new characters with anchors and locked prompt. Values are mean (minimum–maximum). Raw dimensions, idle bounds, grid and colors are source pixels; cut sizes and fringe counts are output pixels. The head ratio uses the narrowest silhouette row between 25% and 60% of cut idle height and is only an estimate: hair, capes and weapons can produce false necks. Grid agreement is the fraction of sampled runs within one source pixel of a period multiple, following snap.mjs. The outline statistic is the median of all raw idle pixels touching keyed background, so edge blending and residual magenta contaminate it; it is not a measurement of only intentional outline pixels. Fringe counts are detected after downsampling and component selection, before replacement and palette quantization, and are not counts of raw source pixels. Full per-character data: [measurements.json](measurements.json).

| Metric | A mean (range) | B mean (range) |
|---|---:|---:|
| idleHeight | 544 (483–583) | 570.67 (555–584) |
| idleHeightFraction | 0.75 (0.67–0.81) | 0.79 (0.77–0.81) |
| gridPeriod | 3 (3–3) | 3 (3–3) |
| gridAgreement | 0.92 (0.91–0.92) | 0.91 (0.91–0.92) |
| colours95 | 1993.75 (1198–2858) | 2029.33 (1753–2429) |
| outlineDistance | 88.75 (69.93–130.75) | 88.07 (87.4–88.71) |
| headRatioEstimate | 0.33 (0.25–0.5) | 0.39 (0.25–0.51) |
| attackHeightDifference | -3.25 (-5–-2) | -1 (-2–0) |
| attackWidthRatio | 1.4 (1.17–1.65) | 1.52 (1.38–1.69) |
| idle_width | 78.5 (67–98) | 75.33 (64–88) |
| idle_height | 96 (96–96) | 96 (96–96) |
| idle_fringe | 19.75 (1–74) | 3.67 (1–6) |
| attack_width | 108.75 (91–126) | 113.33 (108–121) |
| attack_height | 92.75 (91–94) | 95 (94–96) |
| attack_fringe | 28.75 (1–102) | 8.67 (1–20) |
| hurt_width | 82.75 (69–105) | 77.67 (66–86) |
| hurt_height | 93 (92–94) | 96 (96–96) |
| hurt_fringe | 16.75 (1–50) | 6.33 (5–8) |
| raw_width | 2172 (2172–2172) | 2172 (2172–2172) |
| raw_height | 724 (724–724) | 724 (724–724) |
| outline_R | 110.13 (97–139) | 99.33 (97–102) |
| outline_G | 5.75 (2–11) | 6 (5–7) |
| outline_B | 113.88 (98.5–150) | 126 (123–129) |

The cutter generated 22 PNGs and sprites.json; all 22 files exist, match metadata dimensions and have binary alpha. The shared palette is quantized to at most 32 colors per character. Attack body centers for the three new characters use the dense middle columns of the idle silhouette mapped into the attack crop; this estimate has not been tested in the game. The contact sheet was inspected at 3× nearest-neighbor scale: [contact.png](contact.png). The cutter removes detached components other than Ash's separately saved effect, so the sheet does not display Cherry Prince's slash or detached sparks. No in-game playback or alignment test was performed.

## Exact prompts

**zeke**

Pixel-art battle sprite strip for a side-view turn-based RPG. One wide image on a flat pure magenta (#FF00FF) background. Three poses of the SAME character in three equal-width cells, left to right: (1) idle battle stance, (2) attack with the main weapon or spell mid-motion, (3) hurt, recoiling backwards with eyes shut. The character faces RIGHT in all three poses. Character: spiky bright red hair with a long flame-orange and yellow ponytail, black and red armor, a long red coat, and a large black sword with orange flame markings. Match the second and third reference images (the style anchors) exactly in: size of one art pixel, outline thickness, number of shading steps, head-to-body ratio and how much of the cell the idle pose fills. Super-deformed proportion: total height is 2.5 head heights; the head is about 40% of the total height. All three poses have the same head size and stand on the same feet baseline. The attack pose keeps the head at nearly the same height as idle and leans forward no more than 15 degrees; the weapon may extend at most half a cell. True pixel art: large uniform square pixels, hard edges, no anti-aliasing, no gradients, no glow, no soft shading, no drop shadow, no ground line. One-pixel outline in a single dark navy-purple colour (#2b2140) around the whole silhouette; the outline touches the pure magenta background directly, with no pink or magenta pixels on or inside the character. Three-step cel shading per colour area, light from the upper left. At most 24 colours in total. No text, no borders, no UI, no second character. Small sparks are allowed only inside the attack cell.

**flame_sage**

Pixel-art battle sprite strip for a side-view turn-based RPG. One wide image on a flat pure magenta (#FF00FF) background. Three poses of the SAME character in three equal-width cells, left to right: (1) idle battle stance, (2) attack with the main weapon or spell mid-motion, (3) hurt, recoiling backwards with eyes shut. The character faces RIGHT in all three poses. Character: red hair with a long red-orange ponytail, a dark navy gold-trimmed coat over a bandaged chest, red trousers, and a flame held in one hand as a casting focus. Match the second and third reference images (the style anchors) exactly in: size of one art pixel, outline thickness, number of shading steps, head-to-body ratio and how much of the cell the idle pose fills. Super-deformed proportion: total height is 2.5 head heights; the head is about 40% of the total height. All three poses have the same head size and stand on the same feet baseline. The attack pose keeps the head at nearly the same height as idle and leans forward no more than 15 degrees; the weapon may extend at most half a cell. True pixel art: large uniform square pixels, hard edges, no anti-aliasing, no gradients, no glow, no soft shading, no drop shadow, no ground line. One-pixel outline in a single dark navy-purple colour (#2b2140) around the whole silhouette; the outline touches the pure magenta background directly, with no pink or magenta pixels on or inside the character. Three-step cel shading per colour area, light from the upper left. At most 24 colours in total. No text, no borders, no UI, no second character. Small sparks are allowed only inside the attack cell.

**cherry_prince**

Pixel-art battle sprite strip for a side-view turn-based RPG. One wide image on a flat pure magenta (#FF00FF) background. Three poses of the SAME character in three equal-width cells, left to right: (1) idle battle stance, (2) attack with the main weapon or spell mid-motion, (3) hurt, recoiling backwards with eyes shut. The character faces RIGHT in all three poses. Character: short wavy white hair, a white and gold princely uniform with gold epaulettes and a pink-lined white cape, a pink jewel and a sheathed sword. Match the second and third reference images (the style anchors) exactly in: size of one art pixel, outline thickness, number of shading steps, head-to-body ratio and how much of the cell the idle pose fills. Super-deformed proportion: total height is 2.5 head heights; the head is about 40% of the total height. All three poses have the same head size and stand on the same feet baseline. The attack pose keeps the head at nearly the same height as idle and leans forward no more than 15 degrees; the weapon may extend at most half a cell. True pixel art: large uniform square pixels, hard edges, no anti-aliasing, no gradients, no glow, no soft shading, no drop shadow, no ground line. One-pixel outline in a single dark navy-purple colour (#2b2140) around the whole silhouette; the outline touches the pure magenta background directly, with no pink or magenta pixels on or inside the character. Three-step cel shading per colour area, light from the upper left. At most 24 colours in total. No text, no borders, no UI, no second character. Small sparks are allowed only inside the attack cell.

