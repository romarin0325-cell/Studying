from playwright.sync_api import sync_playwright

def verify_pm_images():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        import os
        pwd = os.getcwd()
        file_url = f"file://{pwd}/prince_maker/index.html"

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # Wait for page load
        page.wait_for_load_state("networkidle")

        # Click the first start button (Heat personality) to start the game
        print("Clicking start button...")
        # The buttons are inside .personality-select
        page.locator(".personality-select button").first.click()

        # Wait for UI update
        page.wait_for_timeout(1000)

        # Check if the image container exists and has correct innerHTML
        img_box = page.locator("#pm-image-box")

        print("Checking image box content...")
        # Get inner HTML
        inner_html = img_box.inner_html()
        print(f"Inner HTML: {inner_html}")

        # Check if img tag is present and src is correct (should be 프린스10.png)
        # Note: browser might URL encode the src in DOM, but we check presence
        # '프린스10.png' might be encoded as '%ED%94%84%EB%A6%B0%EC%8A%A410.png'
        # We will check for 'img' tag and 'png' extension at least.

        if "<img" in inner_html and ".png" in inner_html:
            print("SUCCESS: Image tag injected correctly.")
            # Verify the src attribute value specifically
            src = img_box.locator("img").get_attribute("src")
            print(f"Image Source: {src}")
            if "프린스10" in src or "%ED%94%84%EB%A6%B0%EC%8A%A410" in src:
                 print("SUCCESS: Filename matches.")
            else:
                 print("WARNING: Filename mismatch.")
        else:
            print("FAILURE: Image tag not found or incorrect.")

        # Take screenshot
        screenshot_path = "verification/pm_verification_started.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_pm_images()
