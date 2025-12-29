from playwright.sync_api import sync_playwright, expect
import os
import re

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local file
    cwd = os.getcwd()
    url = f"file://{cwd}/card/index.html"
    page.goto(url)

    # 1. Start New Game
    page.click("text=새로하기")

    # 2. Check "Gacha" Modal
    page.click("text=카드 뽑기 (1장 소모)")

    # Wait for modal to appear
    modal = page.locator("#modal-gacha")
    expect(modal).to_have_class(re.compile(r"active"))

    # Take screenshot of Gacha result
    page.screenshot(path="verification/gacha_result.png")
    print("Gacha modal screenshot taken.")

    # Close modal using specific selector
    page.click("#modal-gacha button")

    # 3. Trigger an 'alert' replacement (e.g. Empty Deck Battle)
    page.click("text=전투 진입")

    # Expect info modal instead of alert
    info_modal = page.locator("#modal-info")
    expect(info_modal).to_have_class(re.compile(r"active"))
    expect(page.locator("#info-content")).to_contain_text("덱을 완성해주세요")

    # Take screenshot of Info Modal
    page.screenshot(path="verification/info_modal.png")
    print("Info modal screenshot taken.")

    # Close info modal
    page.click("#modal-info button")

    # 4. Verify CSS properties
    page.click("text=덱 구성")
    page.click("#slot-0")

    # Click first card
    page.locator("#deck-card-list > .card-item").first.click()

    # Confirm deck (Button inside deck screen)
    page.click("#screen-deck button:has-text('확인')")

    # Now start battle
    page.click("text=전투 진입")

    # Check HP bar transition style
    hp_fill = page.locator("#p-hp-bar")
    transition = hp_fill.evaluate("el => getComputedStyle(el).transition")
    print(f"HP Bar Transition: {transition}")

    if "0.5s" in transition:
        print("HP Bar transition verified.")
    else:
        print(f"HP Bar transition mismatch! Got: {transition}")

    # Check Glow Animation CSS on a legend card
    glow_legend = page.evaluate("() => { "
                                "  for(let ss of document.styleSheets) {"
                                "    try {"
                                "      for(let r of ss.cssRules) {"
                                "        if(r.selectorText === '.card-item.legend' && r.style.animation.includes('glow-legend')) return true;"
                                "      }"
                                "    } catch(e) {}"
                                "  }"
                                "  return false;"
                                "}")

    if glow_legend:
        print("Glow animation CSS rule verified.")
    else:
        print("Glow animation CSS rule NOT found!")

    # Take battle screenshot
    page.screenshot(path="verification/battle.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
