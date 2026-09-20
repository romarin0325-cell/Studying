# Tactical edition — art generation prompts

Mode: built-in `image_gen` throughout; no image API or external coding service. Local reference portraits supplied by the user establish identity only. Existing Defense pose sheets establish SD proportions, line weight, palette and lighting. The rejected RGB checkerboard output is not shipped.

Final runtime files: `assets/moonlit/heroes.webp`, `companions.webp`, `companions-ember.webp`, `companions-tide.webp`, `combat-fx.webp`; 80 derived alpha portrait/battle fallback files. Character sheets contain idle/attack pairs; legacy direction fallback IDs intentionally share the idle pose.

After generation, reserved-magenta removal and connected silhouette packing run **offline** using `scripts/import_defense_sprite.mjs` and `scripts/pack_defense_poses.mjs`. Each pair uses one scale and a common baseline. Exported assets were reviewed on a dark background and in the game. No runtime pixel processing.

## Repair companions: pale hair

Use case: precise-object-edit. Edit the attached twelve-pose chibi sprite sheet.
Keep EXACT same characters, identities, genders, 4-column/3-row arrangement, pose scale, detailed anime cel painting and costumes. Repair ugly cutout edges and missing blue/green hair colors. Replace ALL white/gray checkerboard/background fragments (including enclosed gaps between hair locks and around flowing costumes) with absolutely flat solid saturated magenta RGB(255,0,255), hex #FF00FF. Entire background must be the SAME UNIFORM magenta with NO gradient, NO checkerboard, NO transparency pattern, NO shadows. Maintain fully opaque character colors, white clothing and pale hair highlights. Thin dark contours all around silhouettes, no white halo. No text, no frame, no floor. No additional characters. Production sprite extraction sheet, 1448x1086 landscape. Keep breathing room around every pose. Magenta is only outside the painted sprites.

## Repair main cast

Use case: precise-object-edit, production game atlas repair.
Edit attached 4-character 8-pose atlas. Preserve ALL existing character identities, faces, genders, body proportions, costumes, polished anime chibi painting, exact two-column/four-row arrangement and relative scale. Left idle / right attack. No new content.
Remove the white and gray checkered remnants around and between silhouettes. Restore continuous clean thin dark outlines where cutout damaged hair or fabric. Replace every background pixel with uniform vivid saturated MAGENTA #FF00FF, including enclosed holes between limbs, hair and weapons. NO checkerboard, gradients, scenery, floor shadow or white halo. The characters, white hair, white clothing and pale highlights must remain fully painted and opaque. Magenta is reserved only for background. 1024x1536 portrait. Keep entire silhouettes within cells and preserve the four rows.

## Zeke proportion correction

Use case: precise-object-edit. Correct ONLY the bottom-right red-haired knight Zeke's attack pose in this sprite sheet.
The user notes this attack pose changes his body proportions compared with his idle pose immediately to its left. The idle Zeke bottom-left is the STRICT model sheet. Match its head size, neck/shoulder width, torso length, waist, leg length, boot size and compact chibi head-to-body ratio EXACTLY. Attack by rotating torso slightly and extending the sword arm, with a modest step and gently bent knees, NOT a very wide stretched lunge. Do not enlarge shoulders, lengthen legs or shrink head. Preserve red hair, youthful male face, red/black gold-trimmed knight outfit, sword, cape, detailed shading. The sole variation should be believable skeletal posing of the SAME body. Feet baseline same as left pose; head scale same as left pose. Sword can extend diagonally right but must stay in cell.
Keep the other SEVEN sprites pixel-visually unchanged. Preserve sheet dimensions, row layout, solid magenta #FF00FF background and clean dark outlines. No checkerboard, no additional visual effects, no captions.

## Ember trio

Use case: stylized-concept. Production game sprite atlas.
Image 1 is the EXACT STYLE reference: polished anime chibi, 2.6 heads tall, expressive eyes, clean thin dark contours, luminous softly blended cel shading, upper-left light. Images 2-4 define character identities, not proportions.
Create SIX full-body sprites, two equal columns by three equal rows, on portrait 1024x1536. Left column idle ready pose, right column dynamic attack to screen-right. Same scale and feet baseline in each cell, 8% empty padding, no overlap.
Row1 RED DRAGON is FEMALE: orange-red short hair, amber eyes, little red horns, red/gold shoulder armor and boots, white fitted chest wrap, dark skirt over shorts, compact red/gold bat wings and tail, confident toothy grin. Right pose swipes claw and breathes small orange flame.
Row2 FLAME SAGE is MALE: swept red hair and ponytail, red eyes, masculine flat chest, dark gold-trimmed long coat over white wrap, red sash and trousers, dark boots. Right pose casts orange fire orb above outstretched palm.
Row3 MUSHROOM KING is MALE: green hair/eyes, enormous dark navy mushroom cap with cyan spots and aqua underside, high dark-green coat collar and straps, dark boots. Right pose casts compact turquoise spore orb.
Keep gender, hair, costume and mood faithful to the reference portraits but exactly the same cute compact rendering as sprite sheet image1. Nonsexual combat outfits. No realistic body proportions, no 3D, no labels, no grid, no shadows on ground.
UNIFORM solid vivid magenta #FF00FF background, no gradients or checkerboard. Magenta only outside painted sprites, never in their coloring. Pale clothing and highlights fully opaque. Full clean silhouettes within each cell.

## Tide and shadow trio

Use case: stylized-concept. Production game sprite atlas.
Image1 is EXACT STYLE reference: polished anime chibi 2.6 heads tall, large eyes, clean thin dark contours, luminous soft cel shading, upper-left light. Images2-4 define character identity, NOT proportions.
SIX separated full-body sprites in two columns by three equal rows, portrait 1024x1536. Left idle ready, right attack toward screen-right. Same height scale and baseline each row, 8% margin, no cell overlap.
Row1 GREAT DETECTIVE is MALE, delicate androgynous face but flat male chest/slim boyish body; pale blue bob hair, bright blue eyes, dark beret/top-hat with blue bow, white ruffled shirt and large black bow, sky-blue short cape, dark tailored shorts, blue shoes. Carry magnifying glass; attack points it out with a tiny blue butterfly. No breasts.
Row2 SIREN is FEMALE: long icy-blue ponytail, blue eyes, gold fin-shaped headphones, shiny sky-blue/white cropped jacket over modest white top, white/blue shorts, bare feet. Standing/floating upright. Attack extends hand to send compact water musical note.
Row3 PHANTOM is MALE: short dark gray hair, violet eyes, tiny dark horns, lavender star-patterned pajama shirt/trousers, bare feet, brown teddy bear. A compact dark plush bear spirit silhouette hugs behind him (only slightly taller than hero, contained in cell); attack thrusts teddy outward with small purple claw aura. No throne or scenery.
Cute combat poses, nonsexual. Match image1's compact proportions, line weight, saturation and shading exactly. No realistic proportions, no 3D, no labels, no grid, no cast shadows.
UNIFORM vivid magenta #FF00FF background with NO checkerboard or gradients; magenta is reserved for cutout and never used inside characters. Continuous clean contours; pale blue/white hair and clothing stay opaque.

## Combat effects atlas

Use case: stylized-concept. Production 2D anime RPG visual-effects atlas, pure solid BLACK #000000 background for additive screen blending.
Square 1536x1536, exactly FOUR columns x FOUR rows, 16 separated centered effects, no overlap and 12% margin within each equal cell. No labels, no grid lines, no text, no character bodies or scenery. Crisp painterly anime magic with a bright white core, colored body and soft diminishing glow, asymmetrical elegant brushstroke silhouettes, high contrast. NOT flat geometric icons, NOT generic stars in every cell.
Row1 FIRE orange/gold: col1 compact comet projectile pointing right; col2 sharp claw crescent slash; col3 exploding curled flames with shards; col4 larger circular swirling fire eruption.
Row2 WATER ice cyan: col1 crystalline dart pointing right; col2 broad smooth wave crescent; col3 exploding ice crystals and spray; col4 water vortex with delicate musical-note rhythm.
Row3 NATURE mint/emerald: col1 small spore orb pointing right with trailing pollen; col2 curved wind blade; col3 crystalline leaf/spore burst; col4 concentric moss green shockwave blooming with luminous spores.
Row4 MAGIC: col1 brilliant gold-white cross shaped holy impact; col2 jagged blue-white lightning strike with small branches; col3 purple spectral claw slash; col4 dark violet magical bear-claw explosion.
All glow naturally fades to pure black at cell edges. Background remains completely black; no gray/checkerboard, no transparency pattern. Designed to read over a painted mobile game battlefield at 60-150px. One consistent art direction throughout.
