from playwright.sync_api import sync_playwright
import os

def test_game_logic():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/new.html"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(file_path)

        # 1. Verify Artifact Stats
        print("Verifying Artifact Stats...")
        # Dream Chocolate
        dream_choco = page.evaluate("BOSS_DROP_ARTIFACTS.pudding.val")
        assert dream_choco == 0.6, f"Dream Chocolate val should be 0.6, got {dream_choco}"
        print("- Dream Chocolate val verified.")

        # Pharaoh Artifact
        pharaoh = page.evaluate("BOSS_DROP_ARTIFACTS.pharaoh")
        assert pharaoh is not None, "Pharaoh artifact not found"
        assert pharaoh['val'] == 1.0, "Pharaoh val should be 1.0"
        print("- Pharaoh Artifact verified.")

        # Gold Dragon HP
        gd_hp = page.evaluate("ENEMIES.find(e => e.name === '골드 드래곤').hp")
        assert gd_hp == 19000, f"Gold Dragon HP should be 19000, got {gd_hp}"
        print("- Gold Dragon HP verified.")

        # 2. Verify True Artifact Upgrades (Logic check via script injection)
        print("Verifying True Artifact Upgrades...")
        page.evaluate("""
            player = { charKey: 'zeke', artifacts: [] };
            let art = JSON.parse(JSON.stringify(BASE_ARTIFACTS.find(a => a.id === 'golden_sun')));
            ARTIFACTS.push(art); // ensure it's in list to be found
            player.artifacts.push(art);
            upgradeLegendaryArtifact('zeke');
        """)
        gs_val = page.evaluate("ARTIFACTS.find(a => a.id === 'golden_sun').val")
        assert gs_val == 0.5, f"True Golden Sun val should be 0.5, got {gs_val}"

        # Check recalc logic for True Beelzebub
        page.evaluate("""
            player = { charKey: 'luna', level: 1, baseStats: {atk:10, matk:10, def:10, mdef:10, hp:100, mp:100}, skills:{} };
            player.artifacts = [{ effect: 'beelzebub_legend', val: 0.6 }];
            recalcAllStats();
        """)
        crit_dmg = page.evaluate("player.baseCritDmg")
        # Base 1.5 + Luna Passive (0) + Beelzebub Legend (0.7) = 2.2
        # Wait, data.js says BaseCritDmg 1.5.
        # recalcAllStats: if(art.effect === 'beelzebub_legend') { ... player.baseCritDmg += 0.7; }
        assert abs(crit_dmg - 2.2) < 0.01, f"True Beelzebub CritDmg should be ~2.2, got {crit_dmg}"
        print("- True Artifacts verified.")

        # 3. Verify Cycle Reset Logic
        print("Verifying Cycle Reset Logic...")
        page.evaluate("gameState.clearedCreator = true;")
        page.evaluate("resetGameProcess()")
        cleared = page.evaluate("gameState.clearedCreator")
        assert cleared == False, "gameState.clearedCreator should be false after resetGameProcess"
        print("- Cycle Reset Logic verified.")

        # 4. Verify Pharaoh AI Logic (Mocking)
        print("Verifying Pharaoh AI...")
        # Setup Pharaoh as enemy
        # MUST initialize player first because enemyTurn() accesses player stats/buffs for checks.
        page.evaluate("""
            selectChar('luna'); // Init player
            startBattle({ name: "고대신 파라오", hp: 1000, maxHp: 1000, atk: 10, matk: 10, def: 0, mdef: 0, ai: 'pharaoh' });
            turnCount = 7;
            enemyTurn();
        """)
        curse_ready = page.evaluate("buffs.enemy.pharaohCurseReady")
        assert curse_ready == 2, f"Pharaoh Curse should be ready (2) on turn 7, got {curse_ready}"

        # Turn 25 Heal
        page.evaluate("""
            turnCount = 25;
            currentEnemy.hp = 1;
            enemyTurn();
        """)
        enemy_hp = page.evaluate("currentEnemy.hp")
        max_hp = page.evaluate("currentEnemy.maxHp")
        assert enemy_hp == max_hp, "Pharaoh should heal to max on turn 25"
        print("- Pharaoh AI verified.")

        # 5. Verify Gold Dragon Resurrection
        print("Verifying Gold Dragon Resurrection...")
        page.evaluate("""
            startBattle({ name: "골드 드래곤", hp: 100, maxHp: 1000, atk: 10, matk: 10, def: 0, mdef: 0, ai: 'gold_dragon' });
            player.skills = { 'basic': { name: 'hit', type: 'phy', power: 1.0, effect: '' } };
            // Force kill
            currentEnemy.hp = 1;
            playerAttack({ name: 'hit', type: 'phy', power: 100.0, effect: '' });
        """)
        gd_hp_res = page.evaluate("currentEnemy.hp")
        res_flag = page.evaluate("currentEnemy.hasRevived")
        assert gd_hp_res == 3000, f"Gold Dragon should revive with 3000 HP, got {gd_hp_res}"
        assert res_flag == True, "Gold Dragon revived flag should be true"
        print("- Gold Dragon Resurrection verified.")

        browser.close()

if __name__ == "__main__":
    test_game_logic()
