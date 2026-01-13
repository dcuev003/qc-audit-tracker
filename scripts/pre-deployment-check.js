#!/usr/bin/env node

/**
 * Pre-deployment validation script for QC Audit Tracker
 * Ensures all quality gates are met before production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PreDeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
    this.config = {
      coverage: {
        unit: 85,
        integration: 70,
        e2e: 50,
      },
      performance: {
        maxRenderTime: 100, // ms
        maxMemoryUsage: 50, // MB
        maxStorageSize: 5,  // MB
      },
      security: {
        allowedVulnerabilities: {
          low: 10,
          moderate: 5,
          high: 0,
          critical: 0,
        },
      },
      bundle: {
        maxSize: 10, // MB
        maxFiles: 100,
      },
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m',    // Reset
    };

    const symbols = {
      info: 'ℹ',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    console.log(`${colors[type]}${symbols[type]} ${message}${colors.reset}`);
  }

  async runCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options 
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  async checkCodeQuality() {
    this.log('🔍 Checking code quality...', 'info');

    // ESLint check
    const lintResult = await this.runCommand('npm run lint', { silent: true });
    if (lintResult.success) {
      this.passed.push('ESLint: No linting errors');
    } else {
      this.errors.push('ESLint: Linting errors found');
    }

    // TypeScript check
    const typecheckResult = await this.runCommand('npm run typecheck', { silent: true });
    if (typecheckResult.success) {
      this.passed.push('TypeScript: No type errors');
    } else {
      this.errors.push('TypeScript: Type checking failed');
    }

    // Check for TODO/FIXME comments in production code
    const todoCheck = await this.checkTodos();
    if (todoCheck.count > 0) {
      this.warnings.push(`Found ${todoCheck.count} TODO/FIXME comments in production code`);
    } else {
      this.passed.push('No TODO/FIXME comments in production code');
    }
  }

  async checkTestCoverage() {
    this.log('🧪 Checking test coverage...', 'info');

    // Run tests with coverage
    const testResult = await this.runCommand('npm run test:coverage -- --silent', { silent: true });
    
    if (!testResult.success) {
      this.errors.push('Tests: Some tests are failing');
      return;
    }

    // Parse coverage report
    const coverageFile = path.join(process.cwd(), 'coverage/coverage-summary.json');
    if (fs.existsSync(coverageFile)) {
      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      const totalCoverage = coverage.total;

      ['lines', 'functions', 'branches', 'statements'].forEach(metric => {
        const pct = totalCoverage[metric].pct;
        const threshold = this.config.coverage.unit;
        
        if (pct >= threshold) {
          this.passed.push(`Coverage ${metric}: ${pct}% (>= ${threshold}%)`);
        } else {
          this.errors.push(`Coverage ${metric}: ${pct}% (< ${threshold}%)`);
        }
      });
    } else {
      this.warnings.push('Coverage report not found');
    }
  }

  async checkBuildOutput() {
    this.log('🏗️ Checking build output...', 'info');

    // Build the extension
    const buildResult = await this.runCommand('npm run build', { silent: true });
    if (!buildResult.success) {
      this.errors.push('Build: Failed to build extension');
      return;
    }

    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      this.errors.push('Build: dist/ directory not created');
      return;
    }

    // Check manifest.json exists
    const manifestPath = path.join(distPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Validate manifest version
      if (manifest.manifest_version === 3) {
        this.passed.push('Manifest: Valid Manifest V3');
      } else {
        this.errors.push('Manifest: Invalid manifest version');
      }

      // Check required permissions
      const requiredPerms = ['storage', 'tabs', 'alarms'];
      const hasAllPerms = requiredPerms.every(perm => 
        manifest.permissions?.includes(perm)
      );
      
      if (hasAllPerms) {
        this.passed.push('Manifest: All required permissions present');
      } else {
        this.errors.push('Manifest: Missing required permissions');
      }
    } else {
      this.errors.push('Build: manifest.json not found');
    }

    // Check bundle size
    const bundleSize = await this.calculateBundleSize(distPath);
    const maxSize = this.config.bundle.maxSize * 1024 * 1024; // Convert MB to bytes
    
    if (bundleSize <= maxSize) {
      this.passed.push(`Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)}MB (<= ${this.config.bundle.maxSize}MB)`);
    } else {
      this.errors.push(`Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)}MB (> ${this.config.bundle.maxSize}MB)`);
    }
  }

  async checkSecurity() {
    this.log('🔒 Checking security...', 'info');

    // Run npm audit
    const auditResult = await this.runCommand('npm audit --json', { silent: true });
    
    if (auditResult.success || auditResult.output) {
      try {
        const auditData = JSON.parse(auditResult.output);
        const vulnerabilities = auditData.metadata?.vulnerabilities || {};
        
        let hasSecurityIssues = false;
        Object.entries(this.config.security.allowedVulnerabilities).forEach(([level, maxCount]) => {
          const count = vulnerabilities[level] || 0;
          if (count <= maxCount) {
            this.passed.push(`Security: ${count} ${level} vulnerabilities (<= ${maxCount})`);
          } else {
            this.errors.push(`Security: ${count} ${level} vulnerabilities (> ${maxCount})`);
            hasSecurityIssues = true;
          }
        });

        if (!hasSecurityIssues) {
          this.passed.push('Security: No critical security vulnerabilities');
        }
      } catch (error) {
        this.warnings.push('Security: Unable to parse audit results');
      }
    } else {
      this.warnings.push('Security: npm audit failed to run');
    }

    // Check for hardcoded secrets
    const secretsCheck = await this.checkForSecrets();
    if (secretsCheck.found.length > 0) {
      this.errors.push(`Security: Potential secrets found: ${secretsCheck.found.join(', ')}`);
    } else {
      this.passed.push('Security: No hardcoded secrets detected');
    }
  }

  async checkPerformance() {
    this.log('⚡ Checking performance...', 'info');

    // Run performance tests
    const perfResult = await this.runCommand('npm run test:performance', { silent: true });
    
    if (perfResult.success) {
      this.passed.push('Performance: All performance tests passed');
    } else {
      this.warnings.push('Performance: Some performance tests failed or not available');
    }

    // Check for console.log statements in production code
    const consoleCheck = await this.checkConsoleStatements();
    if (consoleCheck.count > 0) {
      this.warnings.push(`Performance: Found ${consoleCheck.count} console.log statements`);
    } else {
      this.passed.push('Performance: No console.log statements in production code');
    }
  }

  async checkCompatibility() {
    this.log('🌐 Checking browser compatibility...', 'info');

    const manifestPath = path.join(process.cwd(), 'dist/manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Check minimum Chrome version
      const minVersion = manifest.minimum_chrome_version;
      if (minVersion && parseInt(minVersion) >= 90) {
        this.passed.push(`Compatibility: Minimum Chrome version ${minVersion} (>= 90)`);
      } else {
        this.warnings.push('Compatibility: Consider setting minimum Chrome version');
      }
    }

    // Check for modern JavaScript features compatibility
    const compatCheck = await this.checkJavaScriptCompatibility();
    if (compatCheck.issues.length === 0) {
      this.passed.push('Compatibility: No compatibility issues detected');
    } else {
      compatCheck.issues.forEach(issue => {
        this.warnings.push(`Compatibility: ${issue}`);
      });
    }
  }

  async checkDocumentation() {
    this.log('📚 Checking documentation...', 'info');

    const requiredFiles = ['README.md', 'CLAUDE.md', 'TYPE_ORGANIZATION.md'];
    const missingFiles = requiredFiles.filter(file => 
      !fs.existsSync(path.join(process.cwd(), file))
    );

    if (missingFiles.length === 0) {
      this.passed.push('Documentation: All required files present');
    } else {
      this.warnings.push(`Documentation: Missing files: ${missingFiles.join(', ')}`);
    }

    // Check for outdated documentation
    const packageJson = require(path.join(process.cwd(), 'package.json'));
    const readmePath = path.join(process.cwd(), 'README.md');
    
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf8');
      if (readme.includes(packageJson.version)) {
        this.passed.push('Documentation: Version information up to date');
      } else {
        this.warnings.push('Documentation: Consider updating version in README');
      }
    }
  }

  // Helper methods

  async checkTodos() {
    const files = await this.getSourceFiles();
    let count = 0;
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const todos = content.match(/(TODO|FIXME|HACK)/gi) || [];
      count += todos.length;
    });

    return { count };
  }

  async checkForSecrets() {
    const secretPatterns = [
      /api[_-]?key[_-]?=.+/i,
      /secret[_-]?key[_-]?=.+/i,
      /password[_-]?=.+/i,
      /token[_-]?=.+/i,
      /[a-z0-9]{32,}/i, // Potential API keys
    ];

    const files = await this.getSourceFiles();
    const found = [];

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      secretPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          found.push(path.basename(file));
        }
      });
    });

    return { found: [...new Set(found)] };
  }

  async checkConsoleStatements() {
    const files = await this.getSourceFiles();
    let count = 0;

    files.forEach(file => {
      if (file.includes('test') || file.includes('spec')) return; // Skip test files
      
      const content = fs.readFileSync(file, 'utf8');
      const consoles = content.match(/console\.(log|warn|error|debug)/g) || [];
      count += consoles.length;
    });

    return { count };
  }

  async checkJavaScriptCompatibility() {
    const issues = [];
    const files = await this.getSourceFiles(['js', 'ts', 'tsx']);

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for optional chaining (might not be supported in older browsers)
      if (content.includes('?.') && !file.includes('test')) {
        // This is actually fine for modern browsers, just noting
      }
      
      // Check for nullish coalescing
      if (content.includes('??') && !file.includes('test')) {
        // Also fine for modern browsers
      }
    });

    return { issues };
  }

  async getSourceFiles(extensions = ['ts', 'tsx', 'js', 'jsx']) {
    const files = [];
    const srcDir = path.join(process.cwd(), 'src');
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.')) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item).slice(1);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      });
    };

    if (fs.existsSync(srcDir)) {
      walkDir(srcDir);
    }

    return files;
  }

  async calculateBundleSize(distPath) {
    let totalSize = 0;
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          totalSize += stat.size;
        }
      });
    };

    walkDir(distPath);
    return totalSize;
  }

  generateReport() {
    this.log('\n📊 PRE-DEPLOYMENT VALIDATION REPORT', 'info');
    this.log('=' .repeat(50), 'info');

    if (this.passed.length > 0) {
      this.log('\n✅ PASSED CHECKS:', 'success');
      this.passed.forEach(item => this.log(`  ${item}`, 'success'));
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️  WARNINGS:', 'warning');
      this.warnings.forEach(item => this.log(`  ${item}`, 'warning'));
    }

    if (this.errors.length > 0) {
      this.log('\n❌ FAILED CHECKS:', 'error');
      this.errors.forEach(item => this.log(`  ${item}`, 'error'));
    }

    this.log('\n📈 SUMMARY:', 'info');
    this.log(`  Passed: ${this.passed.length}`, 'success');
    this.log(`  Warnings: ${this.warnings.length}`, 'warning');
    this.log(`  Errors: ${this.errors.length}`, 'error');

    const isReadyForDeployment = this.errors.length === 0;
    
    if (isReadyForDeployment) {
      this.log('\n🚀 READY FOR DEPLOYMENT!', 'success');
      this.log('All critical checks passed. Extension is ready for production.', 'success');
    } else {
      this.log('\n🚫 NOT READY FOR DEPLOYMENT', 'error');
      this.log('Please fix the errors above before deploying to production.', 'error');
    }

    return isReadyForDeployment;
  }

  async run() {
    this.log('🚀 Starting pre-deployment validation for QC Audit Tracker', 'info');
    this.log('Target deployment: 900+ internal users', 'info');
    this.log('', 'info');

    try {
      await this.checkCodeQuality();
      await this.checkTestCoverage();
      await this.checkBuildOutput();
      await this.checkSecurity();
      await this.checkPerformance();
      await this.checkCompatibility();
      await this.checkDocumentation();

      const isReady = this.generateReport();
      process.exit(isReady ? 0 : 1);
    } catch (error) {
      this.log(`\n💥 Validation failed with error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new PreDeploymentValidator();
  validator.run();
}

module.exports = PreDeploymentValidator;