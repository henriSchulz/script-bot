from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Set cookie for German language to test server-side rendering
        context.add_cookies([
            {"name": "app-language", "value": "de", "domain": "localhost", "path": "/"}
        ])

        try:
            # 1. Verify Home Page in German
            print("Navigating to Home Page...")
            page.goto("http://localhost:3000")

            # Wait for content to load
            expect(page.get_by_role("heading", name="Willkommen bei Script Bot")).to_be_visible()
            expect(page.get_by_text("Beginnen Sie mit der Verwaltung Ihrer Projekte")).to_be_visible()
            expect(page.get_by_role("link", name="Zu den Projekten")).to_be_visible()

            print("Taking screenshot of Home Page (DE)...")
            page.screenshot(path="verification/home_de.png")

            # 2. Verify Projects Page in German
            print("Navigating to Projects Page...")
            page.goto("http://localhost:3000/projects")

            expect(page.get_by_role("heading", name="Projekte")).to_be_visible()
            expect(page.get_by_text("Verwalten Sie Ihre Projekte und Dateien.")).to_be_visible()

            # Check for "Neues Projekt" button
            expect(page.get_by_role("link", name="Neues Projekt").first).to_be_visible()

            print("Taking screenshot of Projects Page (DE)...")
            page.screenshot(path="verification/projects_de.png")

            # 3. Create a project to test delete dialog
            print("Creating a test project...")
            page.get_by_role("link", name="Neues Projekt").first.click()
            expect(page.get_by_role("heading", name="Neues Projekt")).to_be_visible()

            # Use specific labels if available, otherwise placeholders or name attributes
            # Assuming labels are translated too
            # "Projektname"
            page.fill("input[name='name']", "Test Projekt für Löschen")
            page.fill("textarea[name='description']", "Eine Beschreibung")
            page.click("button[type='submit']")

            # Wait for redirection to project page or projects list
            # Usually redirects to the project page
            expect(page.get_by_role("heading", name="Test Projekt für Löschen")).to_be_visible()

            # Go back to projects list
            page.goto("http://localhost:3000/projects")
            expect(page.get_by_text("Test Projekt für Löschen")).to_be_visible()

            # 4. Test Delete Dialog
            print("Testing Delete Dialog...")
            # Find the trash icon for the project.
            # The trash icon is likely within the card.
            # We need to find the card that contains "Test Projekt für Löschen" and then find the button inside it.
            # But simpler: we just created it, it should be the first one or we can search by text.

            # Click the delete button. It has sr-only text "Löschen" (from common.delete)
            # The button has a Trash2 icon.
            # Let's target the button inside the card with the project name.

            # This is tricky with playwright if structure is complex.
            # Let's try to get the card first.
            # The card has title "Test Projekt für Löschen".
            # The delete button is absolute positioned in the card header.

            # We can use filter to find the card.
            # .locator(".group").filter(has_text="Test Projekt für Löschen").get_by_role("button").click()
            # But the button is hidden until hover (opacity-0 group-hover:opacity-100).
            # Playwright might complain if we try to click invisible element.
            # We can force click.

            card = page.locator(".group").filter(has_text="Test Projekt für Löschen").first
            delete_button = card.locator("button") # Assuming only one button in card header

            # Force click because of hover state
            delete_button.click(force=True)

            # Check Dialog content
            print("Verifying Dialog Content...")
            expect(page.get_by_role("alertdialog")).to_be_visible()
            expect(page.get_by_text("Bist du dir absolut sicher?")).to_be_visible()
            expect(page.get_by_text("Diese Aktion kann nicht rückgängig gemacht werden.")).to_be_visible()

            # Check buttons
            expect(page.get_by_role("button", name="Abbrechen")).to_be_visible()
            expect(page.get_by_role("button", name="Löschen")).to_be_visible()

            print("Dialog Verified.")
            page.screenshot(path="verification/delete_dialog_de.png")

            # Close dialog
            page.get_by_role("button", name="Abbrechen").click()


            # 5. Switch back to English (simulate cookie change or just new context)
            print("Testing English...")
            context_en = browser.new_context()
            page_en = context_en.new_page()
             # No cookie means default English (or we can set it explicitly)
            context_en.add_cookies([
                {"name": "app-language", "value": "en", "domain": "localhost", "path": "/"}
            ])

            page_en.goto("http://localhost:3000")
            expect(page_en.get_by_role("heading", name="Welcome to Script Bot")).to_be_visible()

            print("Taking screenshot of Home Page (EN)...")
            page_en.screenshot(path="verification/home_en.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    run()
