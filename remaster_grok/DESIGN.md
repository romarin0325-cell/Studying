# Azure Archive — 창공 서고

Card RPG remaster visual bible. Logic stays the original Card RPG runtime.
Chrome, information architecture, and surfaces are rebuilt.

## References (what we actually took)

| Source | Borrowed | Rejected |
|---|---|---|
| Granblue Fantasy | Daylight sky as the world, gold only for rarity, serif title over a character | Dark-navy HUD, stacked full-width list menus |
| Honkai: Star Rail | One primary CTA, utility dock, encounter card as the hub hero | Settings-dump title screens |
| Shooter in this repo (Astral Bloom) | Phone-column frame, kicker + English lockup, relative-drag polish | Canvas-only gameplay |
| Reverse:1999 / Alchemy Stars | Glass panels, cyan kick line, quiet icon rail | Emoji-as-UI, `#121212` + `#ffd700` AI-slop |

Sky blue is the **theme**, not an accent chip on a black app.

## Locked direction

- Name: **창공 서고 / Azure Archive**
- Tone: late-morning sky over a floating library. Paper-white glass, deep navy ink, electric cyan kick.
- Frame: 480px mobile column, like a shipped gacha client.
- Title: Lumi as the poster, Continue as the only gold button, utilities in a dock.
- Hub: next-enemy encounter card + party strip + contextual actions. Collection/library/system live in the dock.
- Battle: named plates on a sky stage, log is secondary, skills are cards.
- Portraits: never bundled. Resolve next to the HTML, then `../../card/`.

## What we refuse to ship

- Seven identical `menu-btn`s as the title
- Gray `#333` rectangles with 1px `#555` borders
- Gold-on-black “Card RPG” header
- Overlay CSS on the old laundry-list hub
