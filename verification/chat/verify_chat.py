from playwright.sync_api import sync_playwright, expect
import time

def verify_chat_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Navigate to the projects page
        page.goto("http://localhost:3000/projects")

        # Wait for "Projects" header
        page.wait_for_selector("text=Projects")

        # Click the first project
        page.click("a[href^='/projects/']:not([href='/projects/new']) >> nth=0")

        # 2. Check for the new Chat tab
        chat_tab = page.locator("button[role='tab']:has-text('Chat')")
        expect(chat_tab).to_be_visible()
        chat_tab.click()

        # 3. Verify Chat Interface
        # Check for New Chat button in Sidebar - Use first one if multiple (due to hidden dialog trigger)
        # We know one is visible and one might be hidden (though hidden shouldn't be matched by default visibility check,
        # has-text might match hidden elements depending on strict mode).
        # Playwright strict mode complains about multiple elements.

        # Use first() or specify visibility
        new_chat_btn = page.locator("button:has-text('New Chat')").first
        expect(new_chat_btn).to_be_visible()

        # 4. Start a New Chat
        new_chat_btn.click()

        # Verify Dialog
        expect(page.locator("text=New Chat Session")).to_be_visible()

        # Check title input is optional
        title_input = page.locator("input[placeholder*='e.g. Exam Prep (or leave blank)']")
        expect(title_input).to_be_visible()

        # Click Start Chat without entering title
        page.click("button:has-text('Start Chat')")

        # 5. Verify Chat Interface loaded
        expect(page.locator("textarea[placeholder='Ask a question about your files...']")).to_be_visible()

        # Send a message
        page.fill("textarea", "Hello, can you help me?")

        send_btn = page.locator("button:has(svg.lucide-send)")
        if not send_btn.count():
             send_btn = page.locator("button:has(svg)")

        send_btn.click()

        # Wait for response
        time.sleep(2)

        # Take screenshot
        page.screenshot(path="verification/chat_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_chat_feature()
