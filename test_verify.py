from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded")
    page.wait_for_selector("#title-loading.hidden", state="attached", timeout=5000)
    page.wait_for_timeout(500)

    # Click start new game to go to in-game menu
    page.click("#btn-start-new")
    page.wait_for_timeout(500)

    # Close info modal if present
    active_modals = page.evaluate("Array.from(document.querySelectorAll('.modal.active')).map(el => el.id)")
    if "modal-info" in active_modals:
        page.click("#modal-info button")
        page.wait_for_timeout(500)

    # Back from type select
    page.click('#modal-type-select button[onclick="RPG.backFromTypeSelect()"]')
    page.wait_for_timeout(500)

    # Click the newly added mission button in screen-menu
    page.evaluate("RPG.openMissionHub()")
    page.wait_for_timeout(500)

    # Open monthly mission
    page.get_by_role("button", name="월간 미션 월간 보너스 카드 보상을 확인합니다.").click()
    page.wait_for_timeout(500)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
