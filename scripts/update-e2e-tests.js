#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all E2E test files
const e2eDir = path.join(__dirname, '..', 'e2e');
const testFiles = fs.readdirSync(e2eDir).filter(file => file.endsWith('.spec.js'));

testFiles.forEach(file => {
  const filePath = path.join(e2eDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already updated
  if (content.includes('setupChromeAPIs')) {
    console.log(`✓ ${file} already updated`);
    return;
  }
  
  // Add import
  if (!content.includes("import { setupChromeAPIs")) {
    content = content.replace(
      "import { test, expect } from '@playwright/test';",
      "import { test, expect } from '@playwright/test';\nimport { setupChromeAPIs, setMockData } from './e2e-setup.js';"
    );
  }
  
  // Update beforeEach hooks
  content = content.replace(
    /test\.beforeEach\(async \(\{ page \}\) => \{\s*\/\/ Navigate to dashboard/g,
    `test.beforeEach(async ({ page }) => {
    // Setup Chrome APIs before navigating
    await setupChromeAPIs(page);
    
    // Navigate to dashboard`
  );
  
  // Update navigation links to buttons
  content = content.replace(/a:has-text\("Add Time"\)/g, 'button:has-text("Add Off Platform Time")');
  content = content.replace(/a:has-text\("Dashboard"\)/g, 'button:has-text("Audits Dashboard")');
  content = content.replace(/a:has-text\("Analytics"\)/g, 'button:has-text("Analytics")');
  content = content.replace(/a:has-text\("Settings"\)/g, 'button:has-text("Settings")');
  
  // Replace manual Chrome API mocking with setMockData
  const mockDataRegex = /await page\.evaluate\(\(\) => \{\s*window\.chrome = window\.chrome \|\| \{\};[\s\S]*?\}\);/;
  if (mockDataRegex.test(content)) {
    // Extract mock data if possible
    const mockMatch = content.match(/const mockTasks = \[([\s\S]*?)\];/);
    const offPlatformMatch = content.match(/const mockOffPlatform = \[([\s\S]*?)\];/);
    
    if (mockMatch || offPlatformMatch) {
      let replacement = `    // Set mock data
    await setMockData(page, {`;
      
      if (mockMatch) {
        replacement += `
      tasks: [${mockMatch[1]}],`;
      }
      
      if (offPlatformMatch) {
        replacement += `
      offPlatformEntries: [${offPlatformMatch[1]}]`;
      }
      
      replacement += `
    });`;
      
      content = content.replace(mockDataRegex, replacement);
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${file}`);
});

console.log('\n✨ All E2E tests updated!');