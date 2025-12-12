
from playwright.sync_api import sync_playwright, expect

def verify_localization():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Force German locale
        context = browser.new_context(
            locale="de-DE"
        )
        page = context.new_page()

        print("Navigating to home page...")
        page.goto("http://localhost:3000")

        print("Clicking 'Go to Projects'...")
        page.get_by_role("link", name="Go to Projects").click()

        # Wait for project page to load (look for "Projects" heading or "New Project" button)
        page.wait_for_load_state("networkidle")

        print("Looking for a project link...")

        project_link = page.locator("a[href^='/projects/']:not([href='/projects/new'])").first

        if project_link.count() > 0:
            print("Project found. Clicking...")
            # We need to wait for the element to be visible and clickable
            project_link.wait_for(state="visible")
            project_link.click()
        else:
            print("No existing project found. Creating one...")
            page.get_by_role("link", name="New Project").click()
            page.fill("input[name='name']", "Test Project")
            page.get_by_role("button", name="Create Project").click()

        # Now we should be on project page
        print("Waiting for 'Zusammenfassungen' or 'Summaries'...")

        # We need to be more specific because "Zusammenfassungen" appears multiple times
        # Use first=True to just pick one if found

        found = False
        try:
             # Try finding the tab trigger specifically
             expect(page.locator("button[role='tab']:has-text('Zusammenfassungen')").first).to_be_visible(timeout=5000)
             print("Found 'Zusammenfassungen' tab")
             found = True
        except:
             print("Could not find 'Zusammenfassungen' tab, checking for 'Summaries'...")

        if not found:
             try:
                expect(page.locator("button[role='tab']:has-text('Summaries')").first).to_be_visible()
                print("Found 'Summaries' tab. Switching language...")

                # Switch language to German
                print("Setting app-language cookie to 'de'...")
                context.add_cookies([{"name": "app-language", "value": "de", "domain": "localhost", "path": "/"}])
                page.reload()

                print("Waiting for 'Zusammenfassungen' tab after reload...")
                expect(page.locator("button[role='tab']:has-text('Zusammenfassungen')").first).to_be_visible()
             except:
                print("Still didn't find 'Summaries'. Maybe context is English but not rendering expected text.")

        # Click "Lösungen" tab
        print("Clicking 'Lösungen' tab...")
        page.get_by_role("tab", name="Lösungen").click()

        # Verify the text
        print("Verifying text...")
        expect(page.get_by_text("Noch keine Lösungen generiert.")).to_be_visible()

        # Take screenshot
        page.screenshot(path="verification/localization_verification.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_localization()
