# Event key visuals

Generated with the built-in OpenAI `image_gen` tool (GPT image; the tool did not disclose a more specific model version). The original PNGs here are untouched generation outputs. All four calls attached `assets/merge/summon-altar.webp`, `garden.webp`, and `greenhouse-dawn.webp` as style references. Each subject was generated twice, with the final words `Candidate 1.` and `Candidate 2, vary composition.` respectively. The tool did not retain a mapping between those ordinal labels and the returned filenames.

Shared prompt:

> Use case: stylized-concept. Game event popup banner, wide 5:2 composition. The three attached images are style references only: match their soft anime-background painting, garden stonework, flowers, painterly brushwork and gentle bloom. Deep navy/indigo night sky, warm gold starlight, no hard outlines, no photo realism or 3D. Keep the left 45% calm, dark and uncluttered for separately typeset title; main subject entirely in right half. Readable at 350x140. No characters, people, faces, text, letters, logos, UI frames or borders.

Oath continuation:

> A small stone vow-altar in a night flower garden, bearing a glowing star-shaped lantern tied with a gold ribbon. Above, fine constellation lines join into a ring of stars as an oath sealed with the sky. A few violet flowers. Solemn and hopeful.

Twin continuation:

> From a garden gate two paths of light part ways and rise into the sky, silver-blue on the left and warm gold on the right, each leading to one of a pair of bright stars close together. Navy sky, silver-blue #cfdcff and gold #ffd98a. Mood of setting out on a journey.

- Oath candidates: `exec-16ccec5e-7f50-4cd8-9c78-6e36c3555b93.png` and **`exec-8ca4b6d8-96d6-48b1-aacd-0aaac28be766.png`** (selected). The selected star lantern and ring read clearly at banner size, while its blue flowers, stone arch and dark open left side fit the references.
- Twin candidates: **`exec-39b0ec9c-6cad-473a-90a1-b8d8c173e732.png`** (selected) and `exec-bf7d87b5-4d01-418d-aece-6c82807bce27.png`. The selected paths separate visibly toward two stars, with a quieter dark left side and painted garden details consistent with the references.

Selected originals were center-cropped to 5:2 and encoded at 1400×560 as high-quality WebP authoring sources. The comparison sheet in `test-results/event-art/sheet.png` shows the selected originals and the three references at 350 pixels wide.
