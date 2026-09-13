# Forest / Ocean artwork

Generated with the built-in image generation tool. The original generated files were copied into `shooter/assets/`; no external image URLs are needed. Boss and FX sheets preserve generated alpha. Relic thumbnails have the generated dark painted backdrop. All extraction/downscaling is done once by the existing Canvas asset loader.

## `assets/tides.png`

References: existing `assets/bosses.png` for style; user-supplied `꽃의 여신 플로라.png` and `해신 포세이돈.png` for identity. Cells: Flora, Poseidon, forest sentinel, sea sentinel. The top row ends at 53% of the generated sheet height to retain Flora's lotus.

Prompt:

> Create ONE production sprite atlas for Astral Bloom mobile shooter. Image1 is STYLE reference, image2 Flora identity reference, image3 Poseidon identity reference. Square atlas in exact 2 by 2 equal cells, generous transparent gutters. Transparent background, no text, no ground/environment, all subjects fully inside individual cells. Match image1 illustrated anime game boss linework, restrained soft shading, head/body proportions and detailed yet readable silhouettes. TOP LEFT: Flora, flower goddess, long silver hair, golden eyes, flower-and-gold leaf circlet, pink and golden petal wings, white gold floral outfit with modest flowing skirt, levitating above a lotus, regal gentle expression. TOP RIGHT: Poseidon, adult masculine ocean god, turquoise blue long hair, blue crown, bare muscular chest framed in blue scaled and gold armor, flowing teal cloth and cape, ornate gold cyan trident, commanding floating pose. BOTTOM LEFT: forest sentinel enemy, elegant masked woodland armored spirit with pink petal wings and golden branch staff, no human skin, compact silhouette. BOTTOM RIGHT: ocean sentinel enemy, masked blue scaled armored sea knight with trident, compact silhouette. Flora and Poseidon both roughly 85% cell height and equivalent face size to original boss characters. Fine fully opaque crisp outlines with localized glow only. Do not copy reference background or green background. Do not crop weapons/wings/hair.

## `assets/bloom-fx.png`

Prompt:

> Use case stylized-concept. Create one square transparent production VFX atlas for a polished illustrated anime fantasy mobile shooter, exact 2x2 equal cells with 8% empty gutters. TOP LEFT: a magnificent golden-orange phoenix flying upward with enormous spread flaming feather wings, clear bird head and beak, elegant layered flame-tail, sharply painted feathers, no person. TOP RIGHT: a radiant golden sun corona, bright ivory core, elegant solar flame prominences forming circular golden ring; no face. BOTTOM LEFT: a large pale cyan magical crystalline snowflake with ornate ice filigree, crisp sixfold symmetry and luminous center. BOTTOM RIGHT: a luminous white-gold holy flower mandala of detailed overlapping lily petals, soft pink pearl center and tiny golden sparkles. Match detailed polished 2D anime sprite art, no blurry smoke, no background, real transparent alpha, no checkerboard, no text, no watermarks. Each effect wholly contained in its cell with margin, no overlap, clean readable shapes at small screen sizes. Modest bounded glow, richly illustrated rather than basic geometric primitives.

## `assets/tide-worlds.png`

Prompt:

> Create one production background atlas for a vertical scrolling fantasy anime shooting game: TWO equal-width tall portrait panels side by side, a perfectly straight vertical boundary at 50%. No characters, UI, text, enemies, or border. Left panel: fairy forest viewed from a gently elevated forward perspective, ancient luminous trees framing the edges, translucent pink flowers, mossy ruins, tiny warm fairy lights, a deep winding forest clearing running up the center. Right panel: underwater temple, ancient marble columns and azure archways framing the sides, gold-inlaid submerged path, turquoise light shafts, subtle corals, distant sea-god sanctuary. Rich hand-painted game illustration, detailed and atmospheric but center 50% kept quiet and relatively dark for readable bullets. Both panels fill their entire rectangular area. Portrait overall canvas, each panel very tall so it can scroll vertically. Unified sophisticated anime RPG art direction, navy/cyan/pink/gold, no photorealism, no creatures.

## `assets/tide-relics.png`

Reference: existing `assets/relics.png`.

Prompt:

> Create ONE new inventory item atlas matching the reference ornate illustrated anime RPG item style. Exact 3 columns by 2 rows of equal cells on TRANSPARENT background, wide empty padding inside every cell; no backgrounds, no text, no green. Top row left-to-right: Devil's Mirror (ornate dark silver handheld mirror with small bat wings and a glowing violet reflection); Guardian's Will (small silver gold shield enclosing a radiant rose-pink heart with protective wings); Origin Gem (an emerald-cyan faceted gem cradled by golden sprouting leaves). Bottom row left-to-right: Wind Boots (a pair of finely painted green and ivory ankle boots with little golden feather wings); Moonlight Necklace (silver and gold chain bearing a crescent moon and lavender teardrop gem); Golden Sun (solid golden sun amulet with warm amber core and ornate solar rays). Fine crisp painted details, premium material highlights, equal item size, clearly recognizable at 68px display, entirely contained in their own cells, no touching adjacent cells, no excessive glow. This is an atlas of six icons, not a UI screenshot.

## Verification

`tests/endgame-flow.mjs` renders the decoded six-boss comparison, the Poseidon cross, Phoenix, Corona, and the inventory in the offline HTML. These are browser screenshots under the ignored `artifacts/` directory. Physical phone performance is not certified by these checks.
