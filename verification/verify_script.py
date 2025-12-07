from playwright.sync_api import sync_playwright
import os

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game locally (Correct path)
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/new.html")

        # 1. Verify Beelzebub Defense Reduction (Requires manipulation since it's an artifact)
        # We can simulate having the artifact by injecting JS
        page.evaluate("""
            selectChar('zeke'); // Zeke has high defense
            // Add Beelzebub
            player.artifacts.push({ id: 'beelzebub', name: "마신기 벨제뷔트[에픽]", desc: "공격/치명피해 +50%, 방어 -30%", effect: 'beelzebub', val: 0.5 });
            recalcAllStats();
            updateInfo();
        """)

        # 2. Verify Meditation UI (Requires Jasmine and learning skill)
        page.evaluate("selectChar('jasmine')")
        page.evaluate("""
            // Force learn Meditation
            gameState.learnedSkills.push('meditation');
            // Use Meditation
            buffs.player.medi = true;
            buffs.player.mediTurns = 4;
            recalcAllStats();
            updateInfo();
        """)

        # Take screenshot of Jasmine with Meditation active (MATK should be halved)
        # Base MATK for Jasmine is 85. With Meditation (0.5x), it should be 42.
        page.screenshot(path="verification/jasmine_meditation.png")

        # 3. Verify Cycle Reset UI
        # Simulate Clearing Creator God
        page.evaluate("gameState.clearedCreator = true;")

        # Click Game Reset Button (Trigger modal)
        # Need to be in town menu
        page.evaluate("document.getElementById('town-menu').style.display = 'grid';")
        page.evaluate("confirmResetGame()")
        # Wait for modal to be active
        page.wait_for_selector("#reset-modal.active")

        # Take screenshot of the Modal to see the new button text
        page.screenshot(path="verification/reset_modal.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
