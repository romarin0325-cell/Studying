from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        import os
        cwd = os.getcwd()
        filepath = f"file://{cwd}/english_vocab_version/new.html"

        page.goto(filepath)

        # 1. Select a character
        page.locator("button.char-select-btn").first.click()

        # 2. Add a dummy artifact so we can reroll
        page.evaluate("player.artifacts.push({id:'dummy', name:'Dummy', desc:'test', rarity:'normal'})")
        page.evaluate("updateInfo()") # Update UI just in case

        # 3. Click "운명 확인"
        page.get_by_role("button", name="🔮 운명 확인").click()

        # 4. Check button text
        time_reversal_btn = page.get_by_role("button", name="🕰️ 시간의 역행 (무료)")
        expect(time_reversal_btn).to_be_visible()

        # 5. Handle Confirm Dialog and Alert Dialogs
        def handle_dialog(dialog):
            print(f"Dialog type: {dialog.type}, message: {dialog.message}")
            if dialog.type == "confirm":
                if "비용: 무료" in dialog.message:
                    print("Confirmation message verified.")
                    dialog.accept()
                else:
                    print("Confirmation message FAILED.")
                    dialog.dismiss()
            elif dialog.type == "alert":
                 # This might be "초기화할 유물이 없습니다" if I failed to add artifact
                 dialog.accept()

        page.on("dialog", handle_dialog)

        time_reversal_btn.click()

        # 6. Verify Quiz Modal appears
        # Wait for it to be visible
        expect(page.locator("#quiz-modal")).to_have_class("modal active")
        print("Quiz modal appeared")

        page.screenshot(path="verification/quiz_modal.png")

        # 7. Verify Blessings
        blessings = page.evaluate("BLESSINGS")

        legend = blessings['legend']
        if any(b['id'] == 'gold_dragon_bless' and b['name'] == '골드드래곤의 축복' for b in legend):
            print("Verified: Gold Dragon Blessing")
        else: print("FAILED: Gold Dragon Blessing")

        normal = blessings['normal']
        if any(b['id'] == 'weakness_detect' for b in normal) and any(b['id'] == 'ancient_god_bless' for b in normal):
             print("Verified: New Normal Blessings")
        else: print("FAILED: New Normal Blessings")

        epic = blessings['epic']
        if any(b['id'] == 'severing_fate' for b in epic) and any(b['id'] == 'demon_god_auth' for b in epic):
             print("Verified: New Epic Blessings")
        else: print("FAILED: New Epic Blessings")

        if any(b['id'] == 'reaper_bless' for b in legend) and any(b['id'] == 'creation_bless' and b['desc'] == '올스탯 +40%' for b in legend):
             print("Verified: New Legend Blessings")
        else: print("FAILED: New Legend Blessings")

        browser.close()

if __name__ == "__main__":
    run()
