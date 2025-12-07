
from playwright.sync_api import sync_playwright
import os
import time

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load local file
        file_path = os.path.abspath("new.html")
        page.goto(f"file://{file_path}")

        # Enable console logging
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        print("=== Test 1: Jasmine 'Descent of the Goddess' Verification ===")
        page.evaluate("selectChar('jasmine')")
        page.evaluate("gameState.learnedSkills.push('goddess');")
        # Ensure skill effect is 'reset_buff'
        page.evaluate("player.skills['goddess'].effect = 'reset_buff';")

        page.evaluate("executeTurn('goddess')")

        buffs = page.evaluate("buffs.player")
        if buffs.get('goddessTurns', 0) > 0:
            print("PASS: Goddess Buff Applied")
        else:
            print("FAIL: Goddess Buff Not Applied")

        print("\n=== Test 3: Boss Drop Persistence Debug ===")
        page.evaluate("localStorage.clear()")
        page.evaluate("unlockBossArtifact('hestia')")

        unlocks = page.evaluate("getBossArtifactUnlocks()")
        print(f"Unlocks in localStorage: {unlocks}")

        page.evaluate("resetGameProcess()")

        has_hestia = page.evaluate("ARTIFACTS.some(a => a.id === 'hestia')")
        print(f"Hestia in pool: {has_hestia}")

        if not has_hestia:
            print("Debug Info:")
            artifacts = page.evaluate("ARTIFACTS.map(a => a.id)")
            print(f"Artifacts in pool: {artifacts}")
            boss_drops = page.evaluate("JSON.stringify(BOSS_DROP_ARTIFACTS)")
            print(f"BOSS_DROP_ARTIFACTS: {boss_drops}")

        browser.close()

if __name__ == "__main__":
    run_verification()
