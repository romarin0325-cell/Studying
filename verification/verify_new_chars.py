from playwright.sync_api import sync_playwright

def verify_characters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game page via localhost
        # Relax wait condition to 'domcontentloaded' if load is timing out due to missing images
        page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded")

        # 1. Open Collection to check if new cards are visible
        print("Injecting new cards into inventory...")
        page.evaluate("""() => {
            RPG.state.inventory.push('sun_priestess');
            RPG.state.inventory.push('deep_lord');
            RPG.openCollection();
        }""")

        # Wait for collection grid to populate
        page.wait_for_selector("#collection-grid .card-item")

        # 2. Check for Sun Priestess
        print("Checking Sun Priestess...")
        priestess = page.locator(".card-item:has-text('태양의무녀')")
        if priestess.count() > 0:
            print("Sun Priestess found!")
            priestess.click()
            page.wait_for_selector("#modal-card.active")
            page.screenshot(path="verification/sun_priestess_info.png")
            page.evaluate("RPG.closeModal()")
        else:
            print("Sun Priestess NOT found")

        # 3. Check for Lord of the Deep
        print("Checking Lord of the Deep...")
        lord = page.locator(".card-item:has-text('심해의주인')")
        if lord.count() > 0:
            print("Lord of the Deep found!")
            lord.click()
            page.wait_for_selector("#modal-card.active")
            page.screenshot(path="verification/deep_lord_info.png")
            # Close modal (not strictly needed before close)
        else:
            print("Lord of the Deep NOT found")

        browser.close()

if __name__ == "__main__":
    verify_characters()
