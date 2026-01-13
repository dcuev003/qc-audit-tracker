import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome extension testing setup
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--allow-file-access-from-files'
          ],
        },
      },
    },
    {
      name: 'extension',
      use: {
        ...devices['Desktop Chrome'],
        // Special project for testing with loaded extension
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.join(process.cwd(), 'dist')}`,
            `--load-extension=${path.join(process.cwd(), 'dist')}`,
            '--no-sandbox',
          ],
          headless: false, // Extensions don't work in headless mode
        },
      },
    },
  ],
  
  // Run build before tests
  webServer: process.env.SKIP_BUILD ? undefined : {
    command: 'pnpm build',
    reuseExistingServer: false,
    timeout: 60000,
  },
  
  // Global test timeout
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
});