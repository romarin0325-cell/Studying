# Starward character and effects direction

## Active Confluence release override (2026-09-27)

The author's latest instruction replaces the historical 2.5–3-head idle/attack
system below with approximately two-head SD pieces and four authored directions.
Read [the current art playbook](docs/CONFLUENCE_ART_PLAYBOOK.md) for the active
contract. Directional atlases in `assets/merge/units/` are 1024×1024: four 512px
cells ordered down/front, up/back, left, right. Keep one neutral pose; attacks use
procedural recoil and separately rendered effects. This is a direction sheet,
not frame animation. The historical atlas section below describes legacy art
only and must not override the author's current instruction.

The current head-size definition and packing procedure are in
[HEAD_CONSISTENCY_RESEARCH.md](docs/art/HEAD_CONSISTENCY_RESEARCH.md).
Use the anatomical cranium and face, excluding ears, headgear and hair volume.
Current verification follows root `AGENTS.md`: `npm run verify` and the scoped
Defense plan, `npm run verify -- --only defense`. Full-game suites require an
explicit full-Defense request. The old artwork notes below do not override
these production or verification rules.

## Historical V2 artwork notes

The remaining sections describe the preserved, inactive V2 artwork.

Read this before producing or replacing Defense artwork. The reference is the
approved in-game cast, not an isolated attractive illustration.

## Hard visual constraints

- Use the existing painted SD cast: about 2.5–3 heads tall, large expressive eyes,
  fine dark outlines, soft cel shading, cool daylight and restrained warm highlights.
  Keep the same head/body ratio, face, age presentation, costume, accessories and
  lighting between idle and attack. A wider stance is not a larger body.
- Rumi, Zeke, Flame Sage, Mushroom King, Great Detective and Phantom are male.
  Red Dragon and Siren are female. The six supplied portrait references establish
  identity; translate them into the approved SD style without changing gender.
- Preserve pale blue/white hair, white cuffs and small highlights as painted opaque
  material. Never use white/luminance deletion or a checkerboard as transparency.
- Every idle/attack pair uses one uniform scale and one foot baseline. Do not
  independently auto-fit poses: broad weapons must not shrink the attack body.
- Calibrate the anatomical head against Rumi before packing. Judge the face/skull,
  not a halo, rabbit ears, helmet or long hair. Keep that head scale across the
  entire cast. A slightly shorter character has a modestly shorter torso/legs;
  never enlarge the head to make up its height. Compare 64px and 96px proofs.
- Snow Rabbit retains the original icy-blue hair, white/pink ears, teal bunny
  costume, white opaque legwear and blue shoes. Do not substitute a winter coat.
- Queen, Ancient Dragon and Time Ruler are female; Galaxy Whale and Silver Rabbit
  are male. Preserve their supplied or CARD identity references conservatively.
- Inspect each pair on dark and pale backgrounds, then at the actual game size.
  Inspect Zeke's head-to-torso/leg proportions and the Maid/Storm Sage hair explicitly.
  Transparent pixels, dimensions and filenames alone do not prove visual quality.

## Atlas contract

Character atlases have two columns (idle, attack), square 512px cells. Rows:

| File | Row order |
| --- | --- |
| heroes.webp | rumi, luna, cinderella, zeke |
| queen.webp | queen |
| galaxy-whale.webp | galaxy_whale |
| silver-rabbit.webp | silver_rabbit |
| ancient-dragon.webp | ancient_dragon |
| time-ruler.webp | time_ruler |
| companions.webp | snow_rabbit, avalanche_maid, night_rabbit, guardian, storm_sage, lightning_sage |
| companions-ember.webp | red_dragon, flame_sage, mushroom_king |
| companions-tide.webp | great_detective, siren, phantom |

Keep at least 8px transparent padding, with feet near cell y=481. The runtime
mirrors the paired art for leftward action; fallback direction IDs share the
reviewed idle pose. Do not describe these fallbacks as four newly authored views.
The stable hero IDs, portrait IDs and checkpoint identities must not change.

Request real alpha from built-in image generation. Reject painted transparency.
If an accepted generation uses a reserved magenta background, key that hue
offline with scripts/import_defense_sprite.mjs; inspect purple and pink details
afterward. scripts/pack_defense_poses.mjs groups connected silhouettes, scales
each pair together and exports fallback files. Supply its JSON configuration
with ids, approximate input boundaries (x,y,w,h for every pose), and optional
fallbackRoot. Keep the authoring input until visual approval. The release build
validates alpha and fails on opaque sprites; it does not silently modify art.

Worlds and bosses use separate 3×2 atlases of square cells, in the requested
chapter order: artificial demon / Love Iris / Curse Iris; Flora / Poseidon /
Beelzebub. Keep one source-cell scale across the six boss silhouettes, excluding
horns/crowns/wings when comparing anatomical heads. The core design is unchanged.

The 4×4 combat FX sheet uses screen compositing over black. Keep every frame
isolated. Fire, water, nature and light/dark families share a crisp bright center
and soft colored falloff. Normal hits remain smaller than skills. Preserve the
procedural fallback and reduced-effects mode. Never add runtime getImageData,
background flood fills or per-hit full-atlas processing.

## Review and tests

For the active game, use the scoped checks described at the top of this file.
Review the built offline HTML, not only the source page.
Record physical-device limitations rather than claiming desktop automation is
iOS/Android performance certification.

Exact prompts for this revision: [TACTICAL_ART_PROMPTS.md](docs/TACTICAL_ART_PROMPTS.md).
Six-realms additions and revisions: [SIX_REALMS_ART_PROMPTS.md](docs/SIX_REALMS_ART_PROMPTS.md).
