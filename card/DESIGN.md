# DREAMWEAVER design direction

## Reference study, then structure

The request is a structural redesign of Card RPG for portrait mobile play, with sky blue as the primary color or accent, a mildly cute feel, and a single HTML distribution. It is not limited to adding decoration or combat animation.

References inspected before implementation:

- [Riot Games: Preview the future of VALORANT’s interface](https://playvalorant.com/en-us/news/game-updates/preview-the-future-of-valorant-s-interface/) — the official article and its actual lobby screenshot were inspected. Adopted principles: give the party room, reduce competing decorative elements, make the next action clear, retain a consistent navigation model. No Riot graphics or game UI were copied.
- [Blue Archive official site](https://bluearchive.nexon.com/) — sky blue and a character-led tone were considered as a palette reference. The target is an original celestial archive, not a reproduction of its lobby.
- The repository’s `shooter/` — inspected its source and single-file builder as the delivery reference. DREAMWEAVER keeps the Card rules and data while giving them a new presentation layer.

## Current concept: weaving dreams with words

DREAMWEAVER retains the cloudscape and quiet blue surfaces of the selected design. Words become spells and cards become companions in a dream. A faint lavender wash and a two-line serif wordmark give the game its identity. Mobile title spacing is compact; battle portraits yield height to the log. Music uses a small now-playing section above a dense, independently scrolling library. Epic, legendary and transcendent summons receive a brief rarity-colored reveal; reduced-motion mode keeps the colored frame without animation. Internal Astra identifiers and backup format names remain stable for compatibility.

Palette: ink `#0d2235`, panels `#142d42` / `#1b384f`, sky `#a5dfff`, paper `#f2f8fb`, muted text `#a9becd`. Warm gold is limited to legendary rarity. HP uses muted mint for the player and muted rose for the opponent.

The serif DREAMWEAVER wordmark gives the game an identity; Korean UI uses local system sans-serif fonts for offline availability. Navigation labels are Korean. Small English labels are secondary visual texture and are never the only way to understand an action.

## Information architecture

| Surface | Primary decision | Supporting actions |
| --- | --- | --- |
| Title | Start or resume a journey | Fortune cookie, ask Lumi, missions, music |
| Lobby | Enter the next encounter | See party, recruit, open missions/blessings |
| Formation | Choose a slot, then a card | Inspect owned quantities and role |
| Collection | Find a card | Search, grade, owned/all, details |
| Study | Choose a learning activity | Grammar, vocabulary, tutoring, TOEIC |
| Battle | Choose the next skill | Inspect actors, read log, check artifacts |

On portrait mobile, persistent navigation is at the bottom. During battle and mandatory draft choices it is removed to avoid leaving unfinished gameplay. The lobby has one prominent sky-blue battle action. Short screens scroll within the current view rather than horizontally or behind a fixed action layer. Deck confirmation and battle skills retain their own space below scrolling content.

Dialog behavior preserves existing callbacks, including mandatory quiz choices. Keyboard focus stays in the top dialog and returns through nested dialogs. Escape uses actual close/cancel buttons, so it does not bypass reward or battle decisions. Motion is limited to a brief screen arrival and button feedback, and respects reduced-motion preferences.

## Art provenance

`assets/observatory.png` is original generated environment art, produced with the built-in ImageGen tool. The final generated PNG is used directly. Card portraits and opponent portraits are never regenerated or included in this asset. The vector icons and missing-image card emblem are authored in `src/shell.html` and `src/astra.js`.

Final generation prompt:

> Use case: stylized-concept. Asset type: original landscape background for a polished fantasy card RPG UI called DREAMWEAVER. Create a beautifully art-directed anime environment matte painting of an open-air celestial observatory above an ocean of clouds, refined monumental ivory stone arches on the far right, a thin astronomical armillary ring suspended in the distance, a sweeping pale stone terrace and subtle blue glass details. Wide 3:2 landscape composition usable for both desktop and a central portrait crop; central half is calm open atmospheric sky for card UI to overlay. Sky blue and desaturated cyan main palette, deep blue atmospheric distance, warm ivory highlights. Sophisticated architectural forms, precise perspective, elegant painterly material textures, soft bright morning sunlight, premium Japanese RPG environment art direction. Horizon at lower half. A serene sense of exploration. No people, no portraits, no text, no letters, no logos, no UI, no watermark, no glowing particle clutter, no excessive ornament.

The built-in output was copied to this project’s `assets/observatory.png`; it has no runtime dependency on the generation folder.
