# Defense work

- For character, portrait or attack-pose edits, read [ART_DIRECTION.md](ART_DIRECTION.md)
  and preserve the approved cast's identity, shading and body proportions.
- Placement spots must use identical neutral markers. Do not put role tips,
  optimal-hero labels, role colors or reward/drawback descriptions on spots.
  Internal design metadata is for authoring/testing. Players discover placement
  tradeoffs; only actual attack range/shape and aura connections are visualized.
- Keep targeting, collisions and previews on the shared logical attack geometry.
- Preserve failed/hung-image fallbacks and older Safari API fallbacks.
- Root verification remains scoped by the root AGENTS.md and must not run
  Defense. The dedicated Defense workflow uses the shared minimal planner with
  --only defense. It runs only mapped Defense checks when a file under defense/
  changes; full balance, experience, and resilience suites require an explicit
  full-Defense request.
