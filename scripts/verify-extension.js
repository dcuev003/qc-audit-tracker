#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist');

console.log('🔍 Verifying extension build...\n');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ Error: dist folder not found. Run "pnpm build" first.');
  process.exit(1);
}

// Required files for Chrome extension
const requiredFiles = [
  'manifest.json',
  'service-worker-loader.js',
  'src/ui/popup/index.html',
  'src/ui/dashboard/index.html',
  'icon16.png',
  'icon48.png',
  'icon128.png'
];

let hasErrors = false;

// Check for required files
console.log('📋 Checking required files:');
requiredFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
    hasErrors = true;
  }
});

// Verify manifest.json
console.log('\n📄 Checking manifest.json:');
try {
  const manifestPath = path.join(distPath, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  const requiredFields = ['manifest_version', 'name', 'version', 'action', 'background', 'permissions'];
  requiredFields.forEach(field => {
    if (manifest[field]) {
      console.log(`  ✅ ${field}: ${typeof manifest[field] === 'object' ? 'present' : manifest[field]}`);
    } else {
      console.log(`  ❌ ${field}: MISSING`);
      hasErrors = true;
    }
  });
  
  // Check manifest version
  if (manifest.manifest_version !== 3) {
    console.log(`  ⚠️  Warning: manifest_version should be 3, found ${manifest.manifest_version}`);
  }
} catch (error) {
  console.log(`  ❌ Error reading manifest.json: ${error.message}`);
  hasErrors = true;
}

// Check content scripts
console.log('\n📜 Checking content scripts:');
const contentScriptsPath = path.join(distPath, 'src/content');
if (fs.existsSync(contentScriptsPath)) {
  const contentScripts = fs.readdirSync(contentScriptsPath);
  if (contentScripts.length > 0) {
    contentScripts.forEach(file => {
      console.log(`  ✅ ${file}`);
    });
  } else {
    console.log('  ⚠️  No content scripts found');
  }
} else {
  console.log('  ❌ Content scripts folder not found');
  hasErrors = true;
}

// Check assets
console.log('\n🎨 Checking assets:');
const assetsPath = path.join(distPath, 'assets');
if (fs.existsSync(assetsPath)) {
  const assets = fs.readdirSync(assetsPath);
  console.log(`  ✅ Found ${assets.length} asset files`);
  
  // Check for interceptor.js
  if (assets.some(file => file.includes('interceptor'))) {
    console.log('  ✅ interceptor.js found in assets');
  } else {
    console.log('  ⚠️  interceptor.js not found in assets');
  }
} else {
  console.log('  ⚠️  Assets folder not found');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Extension verification FAILED');
  console.log('   Please fix the errors above and rebuild.');
  process.exit(1);
} else {
  console.log('✅ Extension verification PASSED');
  console.log('   The extension is ready to be loaded in Chrome!');
  console.log('\n📦 To load the extension:');
  console.log('   1. Open Chrome and go to chrome://extensions/');
  console.log('   2. Enable "Developer mode"');
  console.log('   3. Click "Load unpacked"');
  console.log(`   4. Select the folder: ${distPath}`);
}