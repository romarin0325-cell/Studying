# Battle sprite batch

62 subjects accepted at strip level, 0 failed, 0 not reached; abyss_wing and frost_witch remain explicitly excluded. The three formerly failed creatures (magma_beetle, gold_moth, treant) are accepted using their right-facing retries. Emerald Beetle was regenerated once, faces right and no longer crosses the attack cell boundary; the previous left-facing strip is retained as emerald_beetle-left-strip.png. Golem faces left; the other accepted strips face right (some are three-quarter/front views). Facing on excluded entries is a planned default, not an observation.

Built-in generation took approximately 2,066 seconds of elapsed generation time including the previous 242.59 seconds; concurrent request groups are counted by their longest elapsed call, not by adding overlapping call times. Existing seven strips have no recorded generation time. Three retries were made in the previous work; none were made in this continuation. The Emerald Beetle replacement was a requested regeneration, not a retry. Gold Dragon's missing PNG reference was resolved using a PNG conversion of the corresponding WebP; the failed file-read produced no generation. Exact continuation prompts and references are in prompts.md. The raw strips were compared with the reference crops; proportions, color count and precise pixel-grid constraints were not measured.

## Cut-output review

The manifest's ok status describes strip acceptance, not a guarantee that the cut output is ready without effects. The following cut attack poses need an effect restored or a separate game effect before use as depicted by the strip:

- cinderella, night_rabbit, snow_rabbit: the detached attack slash or projectile is removed.
- aurora, cure_master, time_ruler, trauma, iris_curse: the detached spell is removed, leaving an empty gesture.
- dark_knight: the detached attack arc is removed, leaving a punch without its intended effect.

Other detached sparks and reaction marks are routinely removed by the largest-component cutter. Ash's detached effect is exported separately. Zeke and several others lose a held item in the generated hurt pose; this is visible in the original strip. Emerald Beetle's hurt output retains small reaction fragments; exact cleanup should be reviewed at game scale. The cutter's estimates of attack body centers and baseline placement are not validated in the game.

## Verification

Re-ran cut-sprites.mjs and generated and visually inspected contact-allies.png, contact-wild.png and contact-bosses.png from the cut outputs. The asset directory contains 187 PNGs: 62 × 3 poses plus ash-fx.png. Every idle metadata entry carries the manifest's facing value. No browser playback, battle alignment, or build was verified.
