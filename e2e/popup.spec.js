import { test, expect, chromium } from '@playwright/test';
import path from 'path';

// Helper to get extension ID from loaded extension
async function getExtensionId(browser) {
  // Navigate to chrome extensions page
  const page = await browser.newPage();
  await page.goto('chrome://extensions');
  
  // Get extension ID from the extensions page
  // This is a simplified approach - in real tests you might need a more robust method
  const extensionId = 'mock-extension-id'; // This would be dynamically obtained
  await page.close();
  
  return extensionId;
}

test.describe('Popup Component E2E Tests', () => {
  let browser;
  let context;
  let extensionId;
  let popupPage;

  test.beforeAll(async () => {
    // Launch browser with extension
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${path.join(process.cwd(), 'dist')}`,
        `--load-extension=${path.join(process.cwd(), 'dist')}`,
      ],
    });
  });

  test.beforeEach(async () => {
    context = await browser.newContext();
    // Get the extension ID (in real scenario, you'd parse this from chrome://extensions)
    extensionId = 'your-extension-id'; // Replace with actual extension ID
    
    // Open the popup
    popupPage = await context.newPage();
    // For testing, we'll navigate directly to the popup HTML
    await popupPage.goto(`file://${path.join(process.cwd(), 'dist/src/ui/popup/index.html')}`);
    
    // Wait for the popup to be fully loaded
    await popupPage.waitForSelector('h2:has-text("QC Audit Tracker")', { timeout: 5000 });
  });

  test.afterEach(async () => {
    await popupPage?.close();
    await context?.close();
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test('should display the main popup UI elements', async () => {
    // Check title
    await expect(popupPage.locator('h2')).toHaveText('QC Audit Tracker');
    
    // Check progress summary section
    await expect(popupPage.locator('text=Today\'s Progress')).toBeVisible();
    await expect(popupPage.locator('text=⏰ Daily:')).toBeVisible();
    await expect(popupPage.locator('text=📅 Weekly:')).toBeVisible();
    
    // Check main buttons
    await expect(popupPage.locator('button:has-text("Open Dashboard")')).toBeVisible();
    await expect(popupPage.locator('text=Enable Tracking')).toBeVisible();
    await expect(popupPage.locator('button:has-text("Off-Platform Timer")')).toBeVisible();
  });

  test('should display daily and weekly hours in hh:mm format', async () => {
    // Check that hours are displayed in hh:mm format (e.g., "0:00/8h")
    const dailyHoursText = await popupPage.locator('text=⏰ Daily:').locator('..').textContent();
    expect(dailyHoursText).toMatch(/\d+:\d{2}\/\d+h/);
    
    const weeklyHoursText = await popupPage.locator('text=📅 Weekly:').locator('..').textContent();
    expect(weeklyHoursText).toMatch(/\d+:\d{2}\/\d+h/);
  });

  test('should toggle tracking state', async () => {
    const trackingToggle = popupPage.locator('input[type="checkbox"]');
    const initialState = await trackingToggle.isChecked();
    
    // Click the toggle
    await trackingToggle.click();
    
    // Verify state changed
    const newState = await trackingToggle.isChecked();
    expect(newState).toBe(!initialState);
    
    // Toggle back
    await trackingToggle.click();
    const finalState = await trackingToggle.isChecked();
    expect(finalState).toBe(initialState);
  });

  test('should open dashboard when clicking Open Dashboard button', async () => {
    // Mock chrome.tabs.create
    await popupPage.evaluate(() => {
      window.chrome = window.chrome || {};
      window.chrome.tabs = {
        create: ({ url }) => {
          window.lastCreatedTabUrl = url;
          return Promise.resolve();
        }
      };
      window.chrome.runtime = {
        getURL: (path) => `chrome-extension://ext-id/${path}`
      };
    });

    // Click the button
    await popupPage.click('button:has-text("Open Dashboard")');
    
    // Check that chrome.tabs.create was called with correct URL
    const createdUrl = await popupPage.evaluate(() => window.lastCreatedTabUrl);
    expect(createdUrl).toContain('src/ui/dashboard/index.html');
  });

  test('should show/hide off-platform timer', async () => {
    const timerButton = popupPage.locator('button:has-text("Off-Platform Timer")');
    
    // Initially timer should not be visible
    await expect(popupPage.locator('.border-t')).toHaveCount(0);
    
    // Click to show timer
    await timerButton.click();
    
    // Wait for timer section to appear
    await expect(popupPage.locator('select')).toBeVisible(); // Activity dropdown
    await expect(popupPage.locator('button svg.lucide-play')).toBeVisible(); // Play button
    
    // Button text should change
    await expect(timerButton).toHaveText('Hide Timer');
    
    // Click to hide timer
    await timerButton.click();
    
    // Timer should be hidden
    await expect(popupPage.locator('select')).not.toBeVisible();
    await expect(timerButton).toHaveText('Off-Platform Timer');
  });

  test('should start and stop off-platform timer', async () => {
    // Show timer section
    await popupPage.click('button:has-text("Off-Platform Timer")');
    
    // Select activity type
    const activityDropdown = popupPage.locator('select');
    await activityDropdown.selectOption('validation');
    
    // Start timer
    const playButton = popupPage.locator('button svg.lucide-play').locator('..');
    await playButton.click();
    
    // Verify timer is running
    await expect(popupPage.locator('button svg.lucide-pause')).toBeVisible();
    await expect(popupPage.locator('text=/\\d{2}:\\d{2}:\\d{2}/')).toBeVisible();
    
    // Wait a moment to see timer increment
    await popupPage.waitForTimeout(2000);
    
    // Stop timer (requires double-click)
    const stopButton = popupPage.locator('button svg.lucide-square').locator('..');
    await stopButton.click();
    
    // Should show "Click again to stop" message
    await expect(popupPage.locator('text=Click again to stop')).toBeVisible();
    
    // Click again to confirm stop
    await stopButton.click();
    
    // Timer should reset
    await expect(popupPage.locator('text=00:00:00')).toBeVisible();
    await expect(popupPage.locator('button svg.lucide-play')).toBeVisible();
  });

  test('should show activity change confirmation when timer is running', async () => {
    // Show timer and start it
    await popupPage.click('button:has-text("Off-Platform Timer")');
    await popupPage.locator('button svg.lucide-play').locator('..').click();
    
    // Try to change activity while running
    const activityDropdown = popupPage.locator('select');
    await activityDropdown.click();
    await activityDropdown.selectOption('other');
    
    // Confirmation modal should appear
    await expect(popupPage.locator('text=Change Activity?')).toBeVisible();
    await expect(popupPage.locator('text=This will stop the current timer')).toBeVisible();
    
    // Cancel the change
    await popupPage.click('button:has-text("Cancel")');
    
    // Activity should remain unchanged
    const selectedValue = await activityDropdown.inputValue();
    expect(selectedValue).toBe('auditing'); // Default value
  });

  test('should auto-expand timer section if timer is active', async () => {
    // Mock an active timer in storage
    await popupPage.evaluate(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, callback) => {
            callback({
              activeTimers: {
                activeOffPlatform: {
                  id: 'timer-123',
                  activityType: 'validation',
                  startTime: Date.now() - 60000, // Started 1 minute ago
                  elapsedSeconds: 0
                }
              }
            });
          }
        }
      };
    });

    // Reload the popup
    await popupPage.reload();
    await popupPage.waitForSelector('h2:has-text("QC Audit Tracker")');
    
    // Timer section should be automatically visible
    await expect(popupPage.locator('select')).toBeVisible();
    
    // Timer button should show "Timer Running" and be disabled
    const timerButton = popupPage.locator('button:has-text("Timer Running")');
    await expect(timerButton).toBeVisible();
    await expect(timerButton).toBeDisabled();
  });

  test('should handle errors gracefully', async () => {
    // Mock chrome.runtime.sendMessage to throw error
    await popupPage.evaluate(() => {
      window.chrome = window.chrome || {};
      window.chrome.runtime = {
        sendMessage: () => Promise.reject(new Error('Extension error'))
      };
    });

    // Try to toggle tracking
    const trackingToggle = popupPage.locator('input[type="checkbox"]');
    await trackingToggle.click();
    
    // Should not crash, popup should still be functional
    await expect(popupPage.locator('h2:has-text("QC Audit Tracker")')).toBeVisible();
  });

  test('should display correct styling for overtime hours', async () => {
    // Mock store with overtime hours
    await popupPage.evaluate(() => {
      // This would need to be implemented with proper store mocking
      // For now, we'll check the CSS classes exist
    });

    // Check that overtime styling classes are applied correctly
    const dailyHoursSpan = popupPage.locator('text=⏰ Daily:').locator('..').locator('span').last();
    const weeklyHoursSpan = popupPage.locator('text=📅 Weekly:').locator('..').locator('span').last();
    
    // Get class names
    const dailyClasses = await dailyHoursSpan.getAttribute('class');
    const weeklyClasses = await weeklyHoursSpan.getAttribute('class');
    
    // Should have either green (overtime) or gray (normal) styling
    expect(dailyClasses).toMatch(/text-(green-600|gray-900)/);
    expect(weeklyClasses).toMatch(/text-(green-600|gray-900)/);
  });

  test('should maintain popup dimensions', async () => {
    // Get popup dimensions
    const dimensions = await popupPage.evaluate(() => {
      const popup = document.querySelector('.w-\\[260px\\]');
      return {
        width: popup?.offsetWidth,
        minHeight: popup?.offsetHeight
      };
    });

    // Verify dimensions match design specs
    expect(dimensions.width).toBe(260);
    expect(dimensions.minHeight).toBeGreaterThanOrEqual(340);
    expect(dimensions.minHeight).toBeLessThanOrEqual(600);
  });
});

// Accessibility tests
test.describe('Popup Accessibility', () => {
  let popupPage;

  test.beforeEach(async ({ page }) => {
    popupPage = page;
    await popupPage.goto(`file://${path.join(process.cwd(), 'dist/src/ui/popup/index.html')}`);
    await popupPage.waitForSelector('h2:has-text("QC Audit Tracker")');
  });

  test('should have proper ARIA labels and roles', async () => {
    // Check toggle has proper labeling
    const toggle = popupPage.locator('input[type="checkbox"]');
    const toggleLabel = await toggle.locator('..').locator('..').textContent();
    expect(toggleLabel).toContain('Enable Tracking');
    
    // Check buttons are keyboard accessible
    const buttons = await popupPage.locator('button').all();
    for (const button of buttons) {
      const isDisabled = await button.isDisabled();
      if (!isDisabled) {
        // Should be focusable
        await button.focus();
        await expect(button).toBeFocused();
      }
    }
  });

  test('should support keyboard navigation', async () => {
    // Tab through interactive elements
    await popupPage.keyboard.press('Tab'); // Should focus first button
    
    let focusedElement = await popupPage.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT']).toContain(focusedElement);
    
    // Continue tabbing through all interactive elements
    const interactiveElements = await popupPage.locator('button, input, select').count();
    for (let i = 0; i < interactiveElements; i++) {
      await popupPage.keyboard.press('Tab');
    }
    
    // Should cycle back to beginning
    await popupPage.keyboard.press('Tab');
    focusedElement = await popupPage.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT']).toContain(focusedElement);
  });
});