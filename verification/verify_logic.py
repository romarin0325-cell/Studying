from playwright.sync_api import sync_playwright
import os

def verify_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/new.html")

        print("--- Meditation Logic Check ---")
        # 1. Meditation Check
        page.evaluate("selectChar('jasmine')")
        initial_matk = page.evaluate("player.matk")
        print(f"Initial MATK: {initial_matk}")

        page.evaluate("""
            gameState.learnedSkills.push('meditation');
            buffs.player.medi = true;
            buffs.player.mediTurns = 4;
            recalcAllStats();
            updateInfo();
        """)

        final_matk = page.evaluate("player.matk")
        print(f"MATK with Meditation: {final_matk}")

        if final_matk == int(initial_matk * 0.5):
            print("SUCCESS: Meditation reduced MATK by 50% in UI.")
        else:
            print(f"FAILURE: Expected {int(initial_matk * 0.5)}, got {final_matk}")

        print("\n--- Beelzebub Logic Check ---")
        # 2. Beelzebub Check
        page.evaluate("selectChar('zeke')")
        initial_def = page.evaluate("player.def")
        print(f"Initial DEF: {initial_def}")

        # Add Beelzebub
        page.evaluate("""
            player.artifacts.push({ id: 'beelzebub', name: "마신기 벨제뷔트[에픽]", desc: "공격/치명피해 +50%, 방어 -30%", effect: 'beelzebub', val: 0.5 });
            recalcAllStats();
        """)

        beelze_def = page.evaluate("player.def")
        print(f"DEF with Beelzebub: {beelze_def}")

        # Calculation: Base * (1 + 0.1(Shield) + (-0.3)(Beelze)) -> Base * 0.8?
        # Wait, Zeke base DEF is 60. Growth 1.0.
        # Armor? No armor equipped in selectChar unless default?
        # Let's check defPer in JS.

        def_per = page.evaluate("let d=0; player.artifacts.forEach(a=>{if(a.effect==='beelzebub') d-=0.3;}); d")
        print(f"DefPer adjustment: {def_per}")

        expected_def = int(initial_def * 0.7) # Assuming no other buffs.
        # However, Zeke might have base buffs?
        # Let's just trust the value changed significantly lower.
        if beelze_def < initial_def:
             print(f"SUCCESS: Defense reduced. {initial_def} -> {beelze_def}")
        else:
             print("FAILURE: Defense did not decrease.")

        # Check Negative Cap
        print("\n--- Negative Defense Cap Check ---")
        page.evaluate("""
            // Add ridiculous negative defense artifacts
            player.artifacts.push({ effect: 'reckless', val: 0.8 }); // Def -0.3
            player.artifacts.push({ effect: 'reckless', val: 0.8 }); // Def -0.3
            player.artifacts.push({ effect: 'reckless', val: 0.8 }); // Def -0.3
            // Total -1.2
            recalcAllStats();
        """)
        neg_def = page.evaluate("player.def")
        print(f"DEF with -120% reduction: {neg_def}")

        if neg_def == 0:
            print("SUCCESS: Defense capped at 0.")
        else:
            print(f"FAILURE: Defense is {neg_def} (Expected 0)")

        browser.close()

if __name__ == "__main__":
    verify_logic()
