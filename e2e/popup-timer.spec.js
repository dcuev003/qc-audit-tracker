import { test, expect } from './fixtures/extension-test.js';
import { 
  waitForExtensionReady, 
  clearExtensionData 
} from './fixtures/extension-test.js';

test.describe('Popup Off-Platform Timer', () => {
  test.beforeEach(async ({ extensionPage, mockStorage, extensionId, extensionUrls }) => {
    const { page } = extensionPage;
    await clearExtensionData(page, extensionId);
    
    // Open popup and expand timer section
    await page.goto(extensionUrls.popup);
    await waitForExtensionReady(page);
    
    const timerToggle = page.locator('button').filter({ hasText: 'Off-Platform Timer' });
    await timerToggle.click();
    
    // Wait for timer section to be visible
    const timerSection = page.locator('[data-testid="off-platform-timer-section"]');
    await expect(timerSection).toBeVisible();
  });

  test('starts and stops timer', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Select activity
    const activitySelect = page.locator('select[name="activityType"]');
    await activitySelect.selectOption('auditing');
    
    // Start timer
    const startButton = page.getByRole('button', { name: 'Start' });
    await startButton.click();
    
    // Verify timer is running
    await expect(page.getByText(/00:00:0[1-9]/)).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    
    // Stop timer (requires double click)
    const stopButton = page.getByRole('button', { name: 'Stop' });
    await stopButton.click();
    await expect(page.getByText('Double-click to confirm stop')).toBeVisible();
    
    // Second click to confirm
    await stopButton.click();
    
    // Timer should reset
    await expect(page.getByText('00:00:00')).toBeVisible();
    await expect(startButton).toBeVisible();
  });

  test('pauses and resumes timer', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('spec_doc');
    await page.getByRole('button', { name: 'Start' }).click();
    
    // Wait for timer to run
    await page.waitForTimeout(2000);
    
    // Pause timer
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    await pauseButton.click();
    
    // Get current time
    const pausedTime = await page.locator('[data-testid="timer-display"]').textContent();
    
    // Wait and verify time hasn't changed
    await page.waitForTimeout(1000);
    const stillPausedTime = await page.locator('[data-testid="timer-display"]').textContent();
    expect(stillPausedTime).toBe(pausedTime);
    
    // Resume timer
    const resumeButton = page.getByRole('button', { name: 'Resume' });
    await resumeButton.click();
    
    // Verify timer is running again
    await page.waitForTimeout(1000);
    const resumedTime = await page.locator('[data-testid="timer-display"]').textContent();
    expect(resumedTime).not.toBe(pausedTime);
  });

  test('switches activities with confirmation', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Start timer with auditing
    await page.locator('select[name="activityType"]').selectOption('auditing');
    await page.getByRole('button', { name: 'Start' }).click();
    
    // Wait for timer to accumulate time
    await page.waitForTimeout(2000);
    
    // Try to switch activity
    await page.locator('select[name="activityType"]').selectOption('validation');
    
    // Confirmation modal should appear
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Switch Activity?');
    await expect(modal).toContainText('This will save the current timer');
    
    // Confirm switch
    await page.getByRole('button', { name: 'Switch Activity' }).click();
    
    // Timer should reset and new activity selected
    await expect(page.getByText('00:00:00')).toBeVisible();
    await expect(page.locator('select[name="activityType"]')).toHaveValue('validation');
  });

  test('cancels activity switch', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('onboarding');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(1500);
    
    // Try to switch activity
    await page.locator('select[name="activityType"]').selectOption('other');
    
    // Cancel in modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Activity should remain unchanged
    await expect(page.locator('select[name="activityType"]')).toHaveValue('onboarding');
    
    // Timer should still be running
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('persists timer state when popup closes', async ({ extensionPage, context }) => {
    const { page, extensionId } = extensionPage;
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('auditing');
    await page.getByRole('button', { name: 'Start' }).click();
    
    // Wait for some time to accumulate
    await page.waitForTimeout(3000);
    
    // Get current time
    const timeBeforeClose = await page.locator('[data-testid="timer-display"]').textContent();
    
    // Close popup
    await page.close();
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Reopen popup
    const newPage = await context.newPage();
    await newPage.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
    await waitForExtensionReady(newPage);
    
    // Timer section should be auto-expanded
    const timerSection = newPage.locator('[data-testid="off-platform-timer-section"]');
    await expect(timerSection).toBeVisible();
    
    // Timer should still be running with more time
    const timeAfterReopen = await newPage.locator('[data-testid="timer-display"]').textContent();
    expect(timeAfterReopen).not.toBe('00:00:00');
    expect(timeAfterReopen).not.toBe(timeBeforeClose);
  });

  test('saves entry when stopping timer', async ({ extensionPage, mockStorage }) => {
    const { page } = extensionPage;
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('spec_doc');
    await page.getByRole('button', { name: 'Start' }).click();
    
    // Run for a few seconds
    await page.waitForTimeout(3000);
    
    // Stop timer (double click)
    const stopButton = page.getByRole('button', { name: 'Stop' });
    await stopButton.click();
    await stopButton.click();
    
    // Check that entry was saved
    const storage = await mockStorage.get('completedTasks');
    const tasks = storage.completedTasks || [];
    
    // Should have one off-platform entry
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('off_platform');
    expect(tasks[0].activityType).toBe('spec_doc');
    expect(tasks[0].duration).toBeGreaterThan(0);
  });

  test('displays all activity types', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    const activitySelect = page.locator('select[name="activityType"]');
    
    // Check all options are present
    const options = await activitySelect.locator('option').allTextContents();
    expect(options).toContain('Select Activity');
    expect(options).toContain('Auditing');
    expect(options).toContain('Spec Doc');
    expect(options).toContain('Validation');
    expect(options).toContain('Onboarding/OH');
    expect(options).toContain('Other');
  });

  test('disables start button without activity selection', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Ensure no activity is selected
    const activitySelect = page.locator('select[name="activityType"]');
    await activitySelect.selectOption('');
    
    // Start button should be disabled
    const startButton = page.getByRole('button', { name: 'Start' });
    await expect(startButton).toBeDisabled();
    
    // Select activity
    await activitySelect.selectOption('validation');
    
    // Start button should be enabled
    await expect(startButton).toBeEnabled();
  });

  test('shows visual feedback for stop confirmation', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('other');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(1000);
    
    // First click on stop
    const stopButton = page.getByRole('button', { name: 'Stop' });
    await stopButton.click();
    
    // Should show confirmation state
    await expect(stopButton).toHaveClass(/confirm/);
    await expect(page.getByText('Double-click to confirm stop')).toBeVisible();
    
    // Wait for confirmation timeout
    await page.waitForTimeout(3000);
    
    // Should revert to normal state
    await expect(stopButton).not.toHaveClass(/confirm/);
  });

  test('integrates with daily/weekly progress in real-time', async ({ extensionPage }) => {
    const { page } = extensionPage;
    
    // Get initial progress
    const initialDaily = await page.getByText(/Daily:/).textContent();
    
    // Start timer
    await page.locator('select[name="activityType"]').selectOption('auditing');
    await page.getByRole('button', { name: 'Start' }).click();
    
    // Wait for progress update
    await page.waitForTimeout(2000);
    
    // Progress should update in real-time
    const updatedDaily = await page.getByText(/Daily:/).textContent();
    expect(updatedDaily).not.toBe(initialDaily);
  });
});