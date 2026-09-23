# Six realms combat decisions

## Cadence and impact

The prior release's nominal direct DPS is preserved while basics slow down:
rapid ×1.40, melee ×1.30, shotgun/area ×1.25, nova ×1.20, laser ×1.15,
sniper ×1.10. Damage per impact uses the same factor, including every shotgun
pellet. Skill cooldowns move 5→9, 7→12, 8→14 and 9→16 seconds; per-cast damage
changes proportionally. Debuff durations do not grow automatically. Actual
damage/clear rates still require encounter playtests because overkill, travel,
target movement and status uptime matter as much as nominal DPS.

Windup and flight are fixed-tick actions. HP, hit sound, numbers and reactions
occur at arrival; instant attacks release and hit together. Pauses freeze the
timeline. The same simulation tick produces the same impact at 1× and 2×;
post-impact poses/afterglows use presentation time so they remain readable.

A hero completes its own skill before starting another basic attack. Independent
cooldowns keep counting during that action. This prevents its next basic from
stealing a committed skill target. Other heroes still act independently, and
their kills can make a single-target missile miss. If every target is lost
during windup, the unused action becomes ready again instead of burning its
cooldown. Melee skills strike at release without a projectile flight.

## Elements

CARD's cycle is fire→nature→water→fire (+20%). Its reverse is now −20% in
Defense. Light/dark are mutual counters (+20% each); all other pairs are neutral.
The existing six attack/defense type matchups remain a separate multiplier.
Damage and the field guide share one table. Untyped damage/status ticks stay
neutral; ordinary basic and skill direct hits use the attacking hero's element.

## Queen

Identity: supplied image 9. CARD has a looter Queen with Barrier, Finale and
Royal Bloom/Earth Blessing. Defense follows the requested nature main balancer:
short-range flower artillery, innate Earth Blessing, an infrequent Royal Bloom
area hit with slow, and traits that choose debuff payoff or aura coverage.
She supports Ancient Dragon's Earth Blessing interaction and the
existing Mushroom King/Phantom status combinations without a new currency.

## Four companions

Galaxy Whale is a male light dealer with a long holy beam and Supernova Pulse.
CARD's Absolute Light/dark-target identity and three-light-team condition become
alternative Lv4 damage routes. Lv6 chooses a stronger pulse with darkness or
longer reach; he does not grant a universal new team buff.

Silver Rabbit is a male light rapid dealer, linked to Snow Rabbit and Night
Rabbit through their shared rabbit tag. His Lv4 choice rewards darkness or three
deployed rabbits; Lv6 chooses the existing non-stacking Rabbit Hole crit aura
or a stronger single-target skill that supplies darkness. Bench units never
activate either the three-rabbit or three-light condition.

Ancient Dragon is a female nature debuffer with flame-type spread attacks.
Basic pellets apply corrosion; breath applies burn. Lv4 chooses corrosion payoff
or skill slow. Lv6 chooses Earth Blessing payoff or curse/darkness on the breath.
These amplify existing Queen/Guardian and physical/magic companion combinations.

Time Ruler is a female dark debuffer. Her slow basic area attack precedes an
infrequent curse/slow skill; branches choose darkness, cooldown, brief stun or
damage per debuff. All actions use the same fixed-tick lifecycle as other heroes.
Her clock face previews the real area target and fills with fixed-tick flight
progress, then collapses at damage resolution. This readable warning uses the
shared cast/flight lifecycle; it does not claim CARD's literal three-turn delay.

## UI

The full square arena is centered and uses one logical-to-pixel scale. Remaining
space is a command deck: five readable hero cards, skill readiness/charge,
selected hero details, and actual provided/received aura effects. Compact phones
keep all five cards and 44px actions; detailed aura lists remain in the hero sheet.
Each aura lists its real providers/recipients, including innate Flame Sage and
Siren auras; immunity and out-of-range connections reflect current engine state.

Background music bus gain moves .45→.70 (about +3.8 dB); effect gain is unchanged.
The earlier Gemini credential is not used in this revision.

## Six boss encounters

All six realms have ten waves and fifteen neutral placement spots. Four existing
stage IDs and their placement/path coordinates remain stable for schema-2 saves;
the older schema-1 placement migration remains supported. Fairy Forest and Sunken
Temple add distinct routes. Wave 5 is a weaker apparition of the final guardian.

Bosses wait eight simulation seconds before their first 3.2-second warning.
Stun, or damage equal to 7% of maximum HP during that warning, interrupts the
effect and exposes the boss to 25% more damage for three seconds. The aimed
once-per-wave Starfall therefore has a consequential defensive timing choice.
All warnings, effects and recovery use fixed ticks and stop on pause.

| Boss | Completed cast |
| --- | --- |
| Artificial demon | Four seconds of 35% damage reduction |
| Love Iris | Heals 6% maximum HP |
| Curse Iris | Delays the nearest two guardians' next skill by three seconds |
| Flora | Summons two real regeneration enemies, subject to the active cap |
| Poseidon | Moves 70% faster for four seconds |
| Beelzebub | Deals one core damage; World Shield still applies |

Boss information lives in the command panel, outside the battle plane. No
permanent HUD covers the path or targeting area. A lethal remote core attack
ends the session exactly once and releases remaining enemies/projectiles without
awarding kills. Final boss breaches remain a defeat rather than a one-heart leak.
