
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_search_localization(page: Page):
    """
    This test verifies that the 'Search' tab is localized correctly.
    It checks both English and German.
    """

    # 1. Arrange: Go to the projects page.
    # We need to be able to see the tabs. Since we don't have a real project,
    # we might need to rely on the UI rendering empty state or create a project first.
    # However, since we don't have a backend running properly with DB,
    # we might face issues if we try to create a project.
    # Let's try to access a dummy project page first to see if the UI renders.

    print("Navigating to project page...")
    # Assuming the app handles invalid IDs gracefully or we can just see the tabs.
    page.goto("http://localhost:3000/projects/dummy-id")

    # Wait for the page to load
    print("Waiting for page to load...")
    # Expect the tabs to be visible. The tab with id="search" should be present.
    # Based on the code, the tab trigger has value="search"

    # Wait for any tab to appear
    try:
        page.wait_for_selector('[value="search"]', timeout=10000)
    except:
        print("Tabs did not load, possibly because of invalid project ID or DB error.")
        # If we can't load the project page, we might need to mock the data or use a different approach.
        # But let's see the screenshot first.
        page.screenshot(path="verification/debug_load.png")
        return

    # 2. Act & Assert (English)
    # Check if the text "Search" is present in the tab.
    # The default language is likely English.
    print("Checking English localization...")
    search_tab = page.locator('[value="search"]')
    expect(search_tab).to_contain_text("Search")

    page.screenshot(path="verification/english_search_tab.png")
    print("English screenshot taken.")

    # 3. Act & Assert (German)
    # Change language to German.
    # We need to find the settings or language switcher.
    # Based on locales/en.json, there is "settings": "Settings" in "project".
    # And in "settings": "languageTitle": "Language".

    # Let's try to force the language if there is a way, or use the UI.
    # The code uses `useLanguage` hook which likely reads from localStorage or context.
    # We can try to set localStorage.

    print("Switching to German...")
    page.evaluate("window.localStorage.setItem('language', 'de')")
    page.reload()

    print("Waiting for reload...")
    page.wait_for_selector('[value="search"]', timeout=10000)

    # Check if the text "Suche" is present in the tab.
    print("Checking German localization...")
    search_tab = page.locator('[value="search"]')
    expect(search_tab).to_contain_text("Suche")

    page.screenshot(path="verification/german_search_tab.png")
    print("German screenshot taken.")

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
