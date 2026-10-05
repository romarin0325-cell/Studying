# Defense work

- For character, portrait or attack-pose edits, read [ART_DIRECTION.md](ART_DIRECTION.md)
  and preserve the approved cast's identity, shading and body proportions.
- Placement spots must use identical neutral markers. Do not put role tips,
  optimal-hero labels, role colors or reward/drawback descriptions on spots.
  Internal design metadata is for authoring/testing. Players discover placement
  tradeoffs; only actual attack range/shape and aura connections are visualized.
- Keep targeting, collisions and previews on the shared logical attack geometry.
- Preserve failed/hung-image fallbacks and older Safari API fallbacks.
- Defense verification follows the common minimal verification policy. When files
  under `defense/` change, the verifier selects only directly relevant checks or
  builds. Full balance, experience, and resilience suites are manual.
