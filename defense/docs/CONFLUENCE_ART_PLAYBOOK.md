# Confluence art and combat readability

## Current author-approved strategy

The author rejected the generated four-pose sheets: preparation, strike and recovery did not describe one continuous action. Those sheets are experiments, not release art. Do not resume that production method by adding more unrelated poses.

Use four authored views of one approximately two-head SD game piece per character: down/front, up/back, left and right. All four show the same neutral ready posture, costume, handedness, anatomical head size and foot baseline. These are directions, not animation frames. The face must be recognizable at 36–44 CSS pixels for the whole unit. The renderer selects the direction toward the target; idle motion and a small directional recoil show activity. The projectile/beam, impact and sound carry the action.

Full skeletal/3D pose references or frame animation may be explored in a later request. They are not prerequisites for this release. Never advertise mirrored art as newly authored directional art.

## Asset invariants

The previous roster comparison failed the author's head-size review. Follow
[the head consistency correction and research](art/HEAD_CONSISTENCY_RESEARCH.md)
and [the single profile](art/HEAD_PROFILE.json). Prior wording such as
“reviewed” or “accepted” does not imply author approval of those proportions.

1. Consult the author's original and concept memo. Preserve face, hair color/style, gender, costume layers and defining accessories. Do not invent replacement clothes.
2. Use a large, consistent anatomical head and very compact body. Eyes, hair silhouette and one defining accessory should survive a 40px proof. Avoid tiny decorative detail.
3. Keep the anatomical head almost equal across the roster. Hats, ears, halos, horns, trailing hair and weapons do not enter the measurement.
4. Four authored directional views of the same neutral ready pose, compact silhouette, no baked projectile or ambient aura. Do not claim mirrored front art as four directions. Put combat effects in the renderer so origin and timing match damage.
5. Use the same dark colored outer contour, simple cel shadows and neutral upper-left lighting. White cloth and white hair remain opaque.
6. Review the actual alpha channel. A painted checkerboard is a failed transparency result. Prefer native alpha; if unavailable, request a new flat reserved-magenta source and use the existing offline hue-key importer. Never erase white by luminance, and never do image cleanup during gameplay.
7. Pack from head and foot landmarks, not a tight silhouette box. If a weapon needs more margin, enlarge its frame/padding and preserve logical body scale.

## Reference updates, 2026-09-27

The author added 은토끼.png and height classes to 컨셉.txt. Silver Rabbit now has silver-white hair with gold underside locks, golden eyes, long white/pink ears, a gold crown/solar halo, an ivory gold-edged veil, a sleeveless white high-neck one-piece costume with a gold sun medallion, and white legwear. The old white knight coat/staff design is superseded.

Supplied height classes within this game's 21-character roster:

| Class | Characters |
| --- | --- |
| Tall | Zeke, Lightning Sage, Storm Sage, Flame Sage, Red Dragon, Ancient Dragon |
| Medium | Rumi, Luna, Cinderella, Avalanche Maid, Mushroom King, Great Detective, Siren, Queen, Galaxy Whale, Time Ruler |
| Short | Guardian, Snow Rabbit, Night Rabbit, Silver Rabbit, Phantom |

The author's later two-head direction explicitly deprioritizes height differences for this release. Keep the metadata for later art; do not impose height correction by global sprite scale.

## Motion contract

- Idle: very small breathing displacement; no constant hopping that competes with combat.
- Anticipation: 90–140ms subtle movement away from the target, plus a small charge mark.
- Release: unit recovers toward the target; the effect leaves the same stable hand/center anchor.
- Travel: visible direction and a narrow readable silhouette. Projectile position and damage timing share the combat event.
- Impact: a crisp bright core, a small elemental shape and a short low-density burst. Do not flash the whole battlefield for ordinary hits.
- Recovery: return smoothly to neutral, without swapping to an unrelated generated pose.
- Skill: one unmistakable effect family and short audio accent. Preserve visibility of the dangerous enemy and route.
- Reduced effects: preserve all warnings and timings; suppress shakes and optional particles.

## Review before release

Review all 21 side by side, at 40px and 64px, on light and dark backgrounds. Then review a full 25-unit battlefield with enemies and skills active. Check face recognition, head scale, same-hero merging, rank marks, clutter, attack ownership and hit timing. A file passing dimension/alpha checks is not visual approval.

## Production files and extension procedure

The selected release has 21 independent 1024×1024 WebP atlases, four 512×512
cells each. Cell order is down/front, up/back, left, right. The common foot
anchor is `(256,480)`. `assets/merge/units/manifest.json` records source and
output SHA-256, the derived uniform scale, four source foot landmarks, the
front face center and any noncentral source split. `merge/art-frames.js` is
generated portrait metadata. Portrait crops never change battlefield scale.

The exact final revised image prompts are archived in
[art/FOUR_DIRECTION_PROMPTS.json](art/FOUR_DIRECTION_PROMPTS.json). Generation
used the built-in image tool. A prompt that says “edit” is a targeted correction
to a preceding sheet; do not use it as an independent character description.

For a new hero, separate three reference roles: a fixed selected sheet
establishes drawing style; the anatomical geometry master establishes head and
body proportions; the author's original establishes face, gender, hair,
costume and accessories. Zeke's previous head proportions were rejected and
must not serve as the geometry master. Request one neutral
stance from four cardinal views, consistent handedness and opaque white
materials. Ask for actual alpha. Keep a source sheet with flat reserved magenta
only when the image service fails to supply real alpha. Never ship a painted
checkerboard or erase pale material. Leave projectiles and light effects out of
the sprite. Use the existing renderer for their timing.

Measure skull/face and feet, excluding ears, weapons and headgear. Apply one
uniform scale to all four views of that hero. The packer may trim empty source
padding but refuses to clip painted pixels. It does not fit silhouettes to the
cell. Check the result against the whole cast; a sheet that looks good alone
may still have a wrong head scale.

```sh
node scripts/pack_defense_directions.mjs --source-dir SOURCE_DIRECTORY --landmarks defense/docs/art/ANATOMICAL_LANDMARKS.json --proof-dir PROOF_DIRECTORY
node scripts/export_defense_directions.mjs OUTPUT_DIRECTORY
npm run prepare:defense-art -- --check --force
```

The landmark input is an array of
`{id,file,sourceSha256,anatomy:{skull,method,uncertainty,...},feet,face,splitY?}`.
Arbitrary scale is no longer accepted. The packer derives one uniform scale
from the recorded front skull width and height. These partly occluded bounds
are manual estimates, not precise automatic detections. The anatomy policy
and resulting width, height and body length are recorded in the manifest.
Keep the source directory outside the runtime and keep the selected atlases in
Git. No image processing, pixel readback or generation runs during play.

The export produces 84 independent transparent PNGs, 21 WebP atlases, a contact
sheet and an embedded-asset HTML gallery. The gallery has light/dark comparison,
four directions, a 25-piece board, and a target-controlled recoil preview. It
is an asset review tool, not evidence that the combat loop is fun.

Identity corrections include Cinderella's front bow removed from the back,
and Siren's single hip
pouch, and Silver Rabbit's plain white costume without invented gold armor.
Silver Rabbit's feet were not fully visible in the supplied reference; the
simple white footwear is an inferred completion. Keep that distinction in
future revisions.

Mushroom King's earlier head enlargement is not an approved proportional
reference. His hat and high collar obscure anatomical boundaries; record that
uncertainty and compare his head against the whole roster.

## Current experiment log

- Initial Zeke two-pose output retained adult proportions: rejected.
- Rumi source comparison exposed invented shoes/staff in the old art. A corrected source removed both, but its larger SD style is superseded by the new two-head direction.
- Zeke/Silver Rabbit/Flame Sage four-pose experiments: not accepted as animation; discontinue.
- The existing Flame Sage added a white shirt absent from the original; Storm Sage added trousers absent from the original. Correct these if used in new SD tokens.
- A Silver Rabbit original-reference request was rejected by the image service. A neutral text-led draft was generated, but it is not approved costume/animation art and is superseded by the current token direction.
- The arena garden background is a new generated painting. It intentionally leaves quiet central space for the game board and attack effects.
