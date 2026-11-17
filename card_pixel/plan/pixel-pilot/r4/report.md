# R4 pixel pilot

Built-in image generation used one attempt per image. Calls ran concurrently; times are elapsed wall time for each call.

| Image | Time | Attempts | Estimated grid | Snapped foreground height | Uniform grid |
| --- | ---: | ---: | ---: | ---: | --- |
| ash-idle | 70.835 s | 1 | 3 px | 306 px | No |
| luna-idle | 22.043 s | 1 | 3 px | 305 px | No |
| ash-strip | 48.942 s | 1 | 3 px | 182 px (whole strip) | No |

Grid estimates use horizontal and vertical runs in 16-level colour bins; a score selects a period from 2–16 pixels. Runs within one pixel of a multiple of the selected period account for 84.8%, 83.0%, and 91.0%, respectively. This is a coarse estimate, not proof of a uniform source grid. The result is substantially taller than the requested 64-pixel character. Snapping uses the most frequent exact colour in each cell, removes near-magenta background, crops to foreground, and quantizes to at most 24 palette entries. Some magenta edge specks remain.

- **Ash idle:** faces right. Dark hair with red ends, wings, flame, black lace-up outfit and stockings remain recognizable. Hair and outfit are more purple and the figure has longer legs than the reference. Pixel sizes vary, and edges and shaded areas contain intermediate colours.
- **Luna idle:** faces right. Pale hair, purple hood, gold ornaments and curved blade remain recognizable. The hood's lace becomes large circular motifs and the outfit and figure are more elongated. Pixel sizes vary, and edges and shaded areas contain intermediate colours.
- **Ash strip:** idle, attack and hurt poses are present and face right. Hair, wings, outfit and palette remain recognizable across poses; the attack has a projected fireball and the hurt pose adds expression marks. Head and body proportions are broadly similar but not identical: the attack body is stretched into a wide lunge and the hurt head and body tilt. Pixel sizes vary, with intermediate edge colours and residual magenta specks.
