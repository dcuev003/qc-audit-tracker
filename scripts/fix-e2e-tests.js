#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
const testFiles = globSync('e2e/**/*.spec.js', {
  cwd: process.cwd(),
  absolute: true
});

console.log(`Found ${testFiles.length} E2E test files to fix`);

testFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  // Skip if already using extension fixture
  if (content.includes('import { test, expect } from \'./fixtures/extension-test\'')) {
    console.log(`Skipping ${fileName} - already using extension fixture`);
    return;
  }
  
  // Replace import
  content = content.replace(
    /import\s*{\s*test\s*,\s*expect\s*}\s*from\s*['"]@playwright\/test['"]/g,
    "import { test, expect } from './fixtures/extension-test'"
  );
  
  // Replace file:// URLs with extension URLs
  content = content.replace(
    /await\s+page\.goto\s*\(\s*`file:\/\/\$\{path\.join\(process\.cwd\(\),\s*'dist\/src\/ui\/dashboard\/index\.html'\)\}`\s*\)/g,
    'await page.goto(extensionUrls.dashboard)'
  );
  
  content = content.replace(
    /await\s+page\.goto\s*\(\s*`file:\/\/\$\{path\.join\(process\.cwd\(\),\s*'dist\/src\/ui\/popup\/index\.html'\)\}`\s*\)/g,
    'await page.goto(extensionUrls.popup)'
  );
  
  // Update test structure to use extension fixture
  content = content.replace(
    /test\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*async\s*\(\s*{\s*page\s*}\s*\)\s*=>\s*{/g,
    'test($1$2$1, async ({ extensionPage, extensionUrls, mockStorage }) => {\n    const { page } = extensionPage;'
  );
  
  content = content.replace(
    /test\.beforeEach\s*\(\s*async\s*\(\s*{\s*page\s*}\s*\)\s*=>\s*{/g,
    'test.beforeEach(async ({ extensionPage, extensionUrls, mockStorage }) => {\n    const { page } = extensionPage;'
  );
  
  // Remove manual chrome mock setup
  const chromeMockRegex = /\/\/ Mock Chrome storage[\s\S]*?window\.chrome\.runtime[\s\S]*?}\);/g;
  content = content.replace(chromeMockRegex, '// Chrome storage is now available via extension context');
  
  // Replace window.chrome mocking with mockStorage
  content = content.replace(
    /await\s+page\.evaluate\s*\(\s*\(\)\s*=>\s*{\s*window\.chrome[\s\S]*?}\s*\);/g,
    '// Chrome APIs available in extension context'
  );
  
  // Clean up imports if path is no longer needed
  if (!content.includes('path.') && content.includes("import path from 'path';")) {
    content = content.replace(/import\s+path\s+from\s+['"]path['"];\s*\n/g, '');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${fileName}`);
});

console.log('Done!');