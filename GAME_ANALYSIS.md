# Game Analysis Report: Turn RPG Legend Edition

## 1. Overview
This report analyzes the current state of "Turn RPG Legend Edition" (v9.3) focusing on replayability, fun factors, class balance, and potential improvements for a roguelike experience.

## 2. Replayability & New Game+ (NG+)
### Current State
- **Artifact System:** A core roguelike element. 24 Base artifacts + 5 Class-specific. Players can "reroll" artifacts for gold, which creates a good resource sink.
- **NG+ Cycle:** Implemented as `turnRpgCycle`.
    - **Scaling:** Enemies gain +10% stats per cycle. Player Max Level increases by +1 per cycle.
    - **Persistence:** Clear history allows unlocking "Legendary" upgrades for specific artifacts (e.g., "Golden Sun" -> "Jin: Golden Sun").
- **Analysis:**
    - The scaling is purely numerical. Fighting the same enemies with just higher HP/Atk creates "bullet sponges" rather than new tactical challenges.
    - The "Legendary Artifact" unlock system is a strong motivator for playing different classes.

### Recommendations
- **Boss Affixes:** In Cycle 1+, bosses should gain random passives (e.g., "Regenerator", "Thorns", "Mana Burn") to force strategy shifts.
- **Cycle Perks:** Instead of just Level Cap +1, allow players to pick a "Starting Perk" at the beginning of a new cycle (e.g., Start with 1 random artifact).

## 3. Fun Factors & Engagement
### Highs
- **Skill Variety:** Each class feels mechanically distinct (e.g., Zeke's HP cost vs. Jasmine's Mana dump vs. Rumi's Form change).
- **Risk/Reward:** Artifacts like "Cursed Sword" and "Reckless" allow players to build "Glass Cannons", which is fun.
- **Visuals:** The shake effects, changing portraits, and UI bars provide good feedback.

### Lows
- **Linearity:** The dungeon progression (Tier 1 -> Tier 6) is static. Every run feels the same until combat starts.
- **Early Game:** Level 1-5 is often just spamming "Basic Attack".
- **Friction:** "Town" menu requires clicking "Enter Dungeon" -> Fight -> "Return to Town" loop repeatedly.

### Recommendations
- **Map System:** Introduce a simple "Node" system (like Slay the Spire) where players choose a path (Battle / Shop / Event / Elite) instead of a list of buttons.
- **Auto-Battle Option:** For Tier 1-2 dungeons in late game, a "Quick Battle" or "Auto" toggle would reduce tedium.

## 4. Class Balance Analysis
Based on simulation data (Lv 25 vs Creator God Astea):

| Class | Est. DPS | Survival (Turns) | Role | Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Jasmine** | **380** | 9.9 | Glass Cannon | Highest burst damage (The Holy + Absolute). Balanced by low HP. |
| **Zeke** | 344 | **12.7** | Tank/Bruiser | Excellent survivability. Damage scales well with Low HP mechanics. Top Tier. |
| **Rumi** | 367 | 10.8 | Versatile | "Sun Form" offers competitive DPS. Complex to play but rewarding. |
| **Queen** | 307 | 9.9 | DoT/Ramp | Slower start due to stacking mechanics. Slightly underpowered in short fights, strong in long ones. |
| **Luna** | 233* | 9.6 | RNG/Burst | *DPS varies heavily with Crit.* Lowest survival if evasion fails. High risk, inconsistent reward. |

*Note: Luna's DPS is heavily RNG dependent. If crits land, she competes with Jasmine. If not, she falls behind.*

### Recommendations
- **Buff Luna:** Increase base damage of `Crosscut` or `Assassin Nail` slightly to smooth out bad RNG.
- **Queen:** `Rose Stack` accumulation could be faster in the early turns.
- **Zeke:** Currently very strong. `Undying` provides too much safety. Consider increasing cooldown or MP cost.

## 5. Proposed Features (Roguelike & Content)

### A. Enhanced Roguelike Elements
- **Random Events:** Add a "?" button in town that triggers text-based events (e.g., "You find a mysterious altar. Sacrifice 20% HP for an Artifact?").
- **Consumables:** Add "Potions" or "Scrolls" that are one-time use items found in dungeons.

### B. New Content
- **New Class: Necromancer**
    - **Mechanic:** Uses "Corpse" resource. Enemies drop corpses.
    - **Skills:** `Raise Dead` (Summon minion), `Corpse Explosion` (AoE), `Life Tap` (MP for HP).
- **New Difficulty: Hardcore Mode**
    - Permadeath (Save file wipe on death). Rewards unique cosmetic or title.

### C. Technical Improvements
- **Code Split:** While the user prefers a single file, the `script` section is getting large (~1000 lines). Organizing functions by category (UI, Combat, Data) within the file via comments is crucial.

## 6. Conclusion
The game has a solid "combat puzzle" foundation. The artifact system and distinct classes provide good replay value. However, the *structure* of the game (linear dungeon list) holds it back from being a true roguelike. Shifting to a "Run" based structure (Start -> random encounters -> Boss -> End/Loop) would significantly increase the "just one more turn" factor.
