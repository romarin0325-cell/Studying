# Defense interaction references

The user's reported comparison is Stella Sora's Stella Defense / Chess Defense
minigame. The [official event notice](https://stellasora.global/news/2374) was
opened and its rendered text inspected on 2026-09-23: it describes arranging
Trekker chess pieces against enemies and receiving event rewards. This confirms
the mode and its basic premise. It does not establish exact input latency,
animation timings or balance. This revision does not claim a hands-on session
with that game, nor copy its artwork, audio, code or numerical tuning.

Two additional primary references inform the implementation:

- [Mindustry's turret API](https://mindustrygame.github.io/docs/mindustry/world/blocks/defense/turrets/Turret.html)
  exposes separate warmup, reload, recoil and shooting effects. The useful design
  principle is a legible attack lifecycle with distinct preparation and impact.
- [Kingdom Rush's official game description](https://www.kingdomrush.com/kingdom-rush)
  emphasizes distinct tower abilities and heroes. The useful principle is that
  different roles should make positioning and a small number of choices matter.

Our design assessment, rather than a measured claim about those games: a mobile
defense game feels responsive when the selected unit, its real coverage, the
next action and the result of that action are immediately legible. More particles
cannot repair damage occurring before a projectile reaches its target. More
deployment slots cannot repair identical coverage tradeoffs.

Applied here:

| Principle | Independent implementation |
| --- | --- |
| Trust the visible cause and result | Fixed-tick preparation, launch and arrival; HP, flash, number and sound at impact |
| Read progress without opening a menu | Five persistent hero charge cards; actual aura providers/recipients in the selected unit panel |
| Preserve distance intuition on a phone | A square 12×12 board with a uniform transform; controls occupy the remaining space |
| Give a small action a consequential timing choice | Boss warnings can be interrupted by aimed Starfall or concentrated damage |
| Let players discover positioning | Fifteen identical neutral markers per map; distinct route coverage without role labels or recommended-unit tips |
| Make a rare skill identifiable | Element families, separated cadence, grounded attack poses and Time Ruler's clock preview/collapse |

Desktop automated evidence and offline visual review are separate from physical
iOS/Android latency, thermals and long-session performance. Those device claims
remain unverified. No technology migration was necessary: the fixed-tick engine,
Canvas renderer and offline HTML remain the active architecture.
