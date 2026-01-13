import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom test fixture for extension testing
export const test = base.extend({
  // Browser context with extension loaded
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../../dist');
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    
    await use(context);
    await context.close();
  },
  
  // Extension ID helper
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  
  // Extension page helper
  extensionPage: async ({ context, extensionId }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use({ page, extensionId });
  },
  
  // Mock storage helper
  mockStorage: async ({ extensionPage }, use) => {
    const { page } = extensionPage;
    
    const storage = {
      async set(data) {
        await page.evaluate((storageData) => {
          return chrome.storage.local.set(storageData);
        }, data);
      },
      
      async get(keys = null) {
        return await page.evaluate((k) => {
          return chrome.storage.local.get(k);
        }, keys);
      },
      
      async clear() {
        await page.evaluate(() => {
          return chrome.storage.local.clear();
        });
      },
    };
    
    await use(storage);
  },
  
  // Helper to open extension pages
  extensionUrls: async ({ extensionId }, use) => {
    await use({
      popup: `chrome-extension://${extensionId}/src/ui/popup/index.html`,
      dashboard: `chrome-extension://${extensionId}/src/ui/dashboard/index.html`,
      options: `chrome-extension://${extensionId}/src/ui/dashboard/index.html#settings`,
    });
  },
});

export { expect } from '@playwright/test';

// Helper utilities
export const waitForExtensionReady = async (page) => {
  // Wait for extension to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Small buffer for React to render
};

export const mockApiResponse = async (page, url, response) => {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
};

// Helper to ensure page is in extension context
const ensureExtensionContext = async (page, extensionId) => {
  const currentUrl = page.url();
  if (!currentUrl.startsWith('chrome-extension://')) {
    // Navigate to a minimal extension page to get chrome API access
    await page.goto(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
    await page.waitForLoadState('networkidle');
  }
};

export const injectTestData = async (page, data, extensionId) => {
  await ensureExtensionContext(page, extensionId);
  await page.evaluate((testData) => {
    return chrome.storage.local.set(testData);
  }, data);
  
  // Wait for storage to propagate
  await page.waitForTimeout(100);
};

export const getStorageData = async (page, key = null, extensionId) => {
  await ensureExtensionContext(page, extensionId);
  return await page.evaluate((k) => {
    return chrome.storage.local.get(k);
  }, key);
};

export const clearExtensionData = async (page, extensionId) => {
  await ensureExtensionContext(page, extensionId);
  await page.evaluate(() => {
    return chrome.storage.local.clear();
  });
  
  // Reset any active timers
  await page.evaluate(() => {
    return chrome.runtime.sendMessage({ type: 'STOP_ALL_TIMERS' });
  });
};