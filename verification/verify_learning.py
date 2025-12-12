
from playwright.sync_api import sync_playwright, expect
import time

def verify_learning_tab(page):
    # Mock data or rely on existing seed data.
    # Since we can't easily seed data without direct DB access in this script,
    # we will rely on creating a new project or using an existing one if possible.
    # However, creating a project might be complex.
    # Let's try to access the projects page first.

    # Wait for server to be ready
    try:
        page.goto("http://localhost:3000/projects", timeout=60000)
    except Exception as e:
        print(f"Failed to load projects page: {e}")
        return

    # Check if we are on projects page
    print(f"Current URL: {page.url}")

    # Create a new project for testing
    # Use .first to resolve ambiguity if multiple links exist (e.g. in header and body)
    page.get_by_role("link", name="New Project").first.click()
    # Wait for navigation
    page.wait_for_url(r"**/projects/new")

    # Try different selectors for project name input
    # The form uses input[type="text"] inside a div
    try:
        # First attempt: direct placeholder
        page.get_by_placeholder("My Amazing Project").fill("Learning Test Project")
    except:
        # Second attempt: input type
        page.locator("input[type='text']").fill("Learning Test Project")

    # Step 1: Name filled
    page.keyboard.press("Enter")
    time.sleep(1)

    # Step 2: Description
    page.keyboard.press("Control+Enter")
    time.sleep(1)

    # Step 3: Customization
    page.keyboard.press("Enter")
    time.sleep(1)

    # Step 4: Submit
    page.get_by_role("button", name="Create Project").click()

    # Wait for project page to load
    page.wait_for_url(r"**/projects/*")
    print(f"Project created. URL: {page.url}")

    # Click on "Interactive Learning" tab
    # Assuming the tab trigger has text "Interactive Learning"
    page.get_by_role("tab", name="Interactive Learning").click()

    # Verify the empty state is visible
    expect(page.get_by_text("Start your learning journey")).to_be_visible()

    # Take screenshot of the empty state
    page.screenshot(path="verification/learning_tab_empty.png")
    print("Screenshot saved: verification/learning_tab_empty.png")

    # Click "Create First Session"
    page.get_by_role("button", name="Create First Session").click()

    # Verify dialog opens
    expect(page.get_by_role("dialog")).to_be_visible()
    expect(page.get_by_text("Create Interactive Learning Session")).to_be_visible()

    # Enter topic
    page.get_by_placeholder("e.g., 'Thermodynamics Basics'").fill("Test Topic")

    # Verify "Next" button is disabled (no files selected)
    # Actually, if there are no files, we can't proceed.
    # We need to upload a file first.
    # Let's close dialog and upload a dummy file.
    page.keyboard.press("Escape")

    # Go to Files tab
    page.get_by_role("tab", name="Files").click()

    # Determine the file input selector. In page.tsx: type="file"
    # We need to upload a file.
    # Create a dummy file
    with open("verification/dummy.txt", "w") as f:
        f.write("This is a test file for learning generation.")

    file_input = page.locator("input[type='file']")
    file_input.set_input_files("verification/dummy.txt")

    # Wait for upload (basic wait)
    time.sleep(2)

    # Go back to Learning tab
    page.get_by_role("tab", name="Interactive Learning").click()
    page.get_by_role("button", name="New Session").click()

    # Fill topic again
    page.get_by_placeholder("e.g., 'Thermodynamics Basics'").fill("Test Topic")

    # Select the file
    # We need to find the checkbox. The checkbox label should be the filename "dummy.txt"
    # The Checkbox component in dialog...
    page.get_by_text("dummy.txt").click()

    # Click Next
    page.get_by_role("button", name="Next").first.click()

    # Check if "Ready to generate" step is shown
    expect(page.get_by_text("Ready to generate")).to_be_visible()

    page.screenshot(path="verification/create_session_dialog.png")
    print("Screenshot saved: verification/create_session_dialog.png")

    # We won't actually generate because it requires API key and might fail/cost money.
    # But we verified the UI flow up to generation trigger.

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_learning_tab(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
