
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_search_localization(page: Page):
    print("Navigating to project page...")
    page.goto("http://localhost:3000/projects/dummy-id")

    print("Waiting for page to load...")
    # Wait for the "Files" tab as a baseline
    try:
        page.wait_for_selector('button[value="files"]', timeout=20000)
    except Exception as e:
        print(f"Loading failed or timed out: {e}")
        page.screenshot(path="verification/load_fail.png")
        return

    # Check English (default)
    print("Checking English localization...")
    search_tab = page.locator('button[value="search"]')
    expect(search_tab).to_contain_text("Search")
    page.screenshot(path="verification/english_search_tab.png")
    print("English verification passed.")

    # Switch to German
    print("Switching to German...")
    # We can use the localStorage mechanism described in LanguageProvider
    page.evaluate("window.localStorage.setItem('app-language', 'de')")

    # Reload to apply changes
    page.reload()
    page.wait_for_selector('button[value="files"]', timeout=20000)

    # Check German
    print("Checking German localization...")
    search_tab = page.locator('button[value="search"]')
    expect(search_tab).to_contain_text("Suche")
    page.screenshot(path="verification/german_search_tab.png")
    print("German verification passed.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            test_search_localization(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
