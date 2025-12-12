
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_search_localization(page: Page):
    print("Navigating to project page...")
    page.goto("http://localhost:3000/projects/dummy-id")

    # Wait for the tabs to be visible.
    print("Waiting for Search tab (English)...")
    search_tab = page.get_by_role("tab", name="Search")
    search_tab.wait_for(state="visible", timeout=60000)

    expect(search_tab).to_be_visible()
    print("English verification passed.")
    page.screenshot(path="verification/english_verified.png")

    # Switch to German
    print("Switching to German...")
    page.evaluate("window.localStorage.setItem('app-language', 'de')")
    page.reload()

    print("Waiting for Suche tab (German)...")
    suche_tab = page.get_by_role("tab", name="Suche")
    suche_tab.wait_for(state="visible", timeout=60000)

    expect(suche_tab).to_be_visible()
    print("German verification passed.")
    page.screenshot(path="verification/german_verified.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_search_localization(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
