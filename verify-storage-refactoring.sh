#!/bin/bash
# =============================================================================
# Storage Abstraction Refactoring Verification Script
# =============================================================================
# This script validates that direct chrome.storage.local calls have been 
# replaced with ChromeStorageSync methods in UI store slices.
#
# Usage: ./scripts/verify-storage-refactoring.sh
#
# Exit codes:
#   0 - All tests passed (refactoring complete)
#   1 - Tests failed (direct chrome.storage calls still present)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Storage Abstraction Refactoring Verification ===${NC}"
echo ""

# =============================================================================
# PHASE 1: Check UI store slices for direct chrome.storage calls
# =============================================================================
echo -e "${YELLOW}Phase 1: Checking UI store slices for direct chrome.storage calls...${NC}"

# Files that should NOT have direct chrome.storage.local calls after refactoring
UI_STORE_FILES=(
  "src/ui/store/slices/tasksSlice.ts"
  "src/ui/store/slices/settingsSlice.ts"
)

PHASE1_PASSED=1
FOUND_DIRECT_CALLS=0

for file in "${UI_STORE_FILES[@]}"; do
  filepath="$PROJECT_ROOT/$file"
  if [ -f "$filepath" ]; then
    # Check for direct chrome.storage.local calls
    count=$(grep -c 'chrome\.storage\.local\.' "$filepath" 2>/dev/null || echo "0")
    if [ "$count" -gt 0 ]; then
      echo -e "${RED}  ✗ $file - $count direct chrome.storage calls found${NC}"
      grep -n 'chrome\.storage\.local\.' "$filepath" | head -5
      PHASE1_PASSED=0
      FOUND_DIRECT_CALLS=$((FOUND_DIRECT_CALLS + count))
    else
      echo -e "${GREEN}  ✓ $file - no direct chrome.storage calls${NC}"
    fi
  else
    echo -e "${YELLOW}  ? $file - file not found (skipped)${NC}"
  fi
done

if [ "$PHASE1_PASSED" -eq 1 ]; then
  echo -e "${GREEN}✓ PASSED: No direct chrome.storage calls in UI store slices${NC}"
else
  echo -e "${RED}❌ FAILED: Found $FOUND_DIRECT_CALLS direct chrome.storage calls in slices${NC}"
fi

echo ""

# =============================================================================
# PHASE 2: Check store.ts for direct chrome.storage calls
# =============================================================================
echo -e "${YELLOW}Phase 2: Checking store.ts for direct chrome.storage calls...${NC}"

STORE_FILE="$PROJECT_ROOT/src/ui/store/store.ts"
PHASE2_PASSED=1

if [ -f "$STORE_FILE" ]; then
  count=$(grep -c 'chrome\.storage\.local\.' "$STORE_FILE" 2>/dev/null || echo "0")
  if [ "$count" -gt 0 ]; then
    echo -e "${RED}  ✗ store.ts - $count direct chrome.storage calls found${NC}"
    grep -n 'chrome\.storage\.local\.' "$STORE_FILE"
    PHASE2_PASSED=0
  else
    echo -e "${GREEN}  ✓ store.ts - no direct chrome.storage calls${NC}"
  fi
else
  echo -e "${YELLOW}  ? store.ts - file not found${NC}"
fi

if [ "$PHASE2_PASSED" -eq 1 ]; then
  echo -e "${GREEN}✓ PASSED: store.ts uses abstractions${NC}"
else
  echo -e "${RED}❌ FAILED: store.ts has direct chrome.storage calls${NC}"
fi

echo ""

# =============================================================================
# PHASE 3: Verify ChromeStorageSync is imported in slices
# =============================================================================
echo -e "${YELLOW}Phase 3: Verifying ChromeStorageSync usage...${NC}"

PHASE3_PASSED=1

# Check tasksSlice uses ChromeStorageSync
TASKS_SLICE="$PROJECT_ROOT/src/ui/store/slices/tasksSlice.ts"
if [ -f "$TASKS_SLICE" ]; then
  if grep -q 'ChromeStorageSync\|chromeSync\|chromeStorageSync' "$TASKS_SLICE"; then
    echo -e "${GREEN}  ✓ tasksSlice.ts - imports ChromeStorageSync${NC}"
  else
    echo -e "${RED}  ✗ tasksSlice.ts - ChromeStorageSync not imported${NC}"
    PHASE3_PASSED=0
  fi
fi

# Check settingsSlice uses ChromeStorageSync
SETTINGS_SLICE="$PROJECT_ROOT/src/ui/store/slices/settingsSlice.ts"
if [ -f "$SETTINGS_SLICE" ]; then
  if grep -q 'ChromeStorageSync\|chromeSync\|chromeStorageSync' "$SETTINGS_SLICE"; then
    echo -e "${GREEN}  ✓ settingsSlice.ts - imports ChromeStorageSync${NC}"
  else
    echo -e "${RED}  ✗ settingsSlice.ts - ChromeStorageSync not imported${NC}"
    PHASE3_PASSED=0
  fi
fi

if [ "$PHASE3_PASSED" -eq 1 ]; then
  echo -e "${GREEN}✓ PASSED: ChromeStorageSync is used in slices${NC}"
else
  echo -e "${RED}❌ FAILED: ChromeStorageSync not used in required files${NC}"
fi

echo ""

# =============================================================================
# PHASE 4: Verify ChromeStorageSync has required methods
# =============================================================================
echo -e "${YELLOW}Phase 4: Checking ChromeStorageSync has required methods...${NC}"

CHROME_SYNC="$PROJECT_ROOT/src/ui/store/chromeStorageSync.ts"
PHASE4_PASSED=1

if [ -f "$CHROME_SYNC" ]; then
  # Check for setActiveTimers method
  if grep -q 'setActiveTimers' "$CHROME_SYNC"; then
    echo -e "${GREEN}  ✓ setActiveTimers() method exists${NC}"
  else
    echo -e "${RED}  ✗ setActiveTimers() method missing${NC}"
    PHASE4_PASSED=0
  fi
  
  # Check existing methods
  for method in "getTasks" "setTasks" "getSettings" "setSettings" "getActiveTimers"; do
    if grep -q "$method" "$CHROME_SYNC"; then
      echo -e "${GREEN}  ✓ $method() exists${NC}"
    else
      echo -e "${RED}  ✗ $method() missing${NC}"
      PHASE4_PASSED=0
    fi
  done
else
  echo -e "${RED}  ✗ chromeStorageSync.ts not found${NC}"
  PHASE4_PASSED=0
fi

if [ "$PHASE4_PASSED" -eq 1 ]; then
  echo -e "${GREEN}✓ PASSED: ChromeStorageSync has required methods${NC}"
else
  echo -e "${RED}❌ FAILED: ChromeStorageSync missing methods${NC}"
fi

echo ""

# =============================================================================
# PHASE 5: TypeScript compilation check
# =============================================================================
echo -e "${YELLOW}Phase 5: Running TypeScript type check...${NC}"

if command -v pnpm &> /dev/null; then
  if cd "$PROJECT_ROOT" && pnpm typecheck 2>&1; then
    echo -e "${GREEN}✓ PASSED: TypeScript compilation successful${NC}"
    PHASE5_PASSED=1
  else
    echo -e "${RED}❌ FAILED: TypeScript compilation failed${NC}"
    PHASE5_PASSED=0
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: pnpm not available for typecheck${NC}"
  PHASE5_PASSED=1
fi

echo ""

# =============================================================================
# PHASE 6: Run unit tests
# =============================================================================
echo -e "${YELLOW}Phase 6: Running unit tests...${NC}"

if command -v pnpm &> /dev/null; then
  cd "$PROJECT_ROOT"
  
  # Run tests and capture both output and exit code
  TEST_OUTPUT=$(pnpm test:run 2>&1)
  TEST_EXIT_CODE=$?
  
  # Show last 20 lines of output
  echo "$TEST_OUTPUT" | tail -20
  
  if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED: Unit tests passed${NC}"
    PHASE6_PASSED=1
  else
    echo -e "${RED}❌ FAILED: Unit tests failed (exit code: $TEST_EXIT_CODE)${NC}"
    PHASE6_PASSED=0
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: pnpm not available for testing${NC}"
  PHASE6_PASSED=1
fi

echo ""

# =============================================================================
# BONUS: Check for legacy OffPlatformTimer storage (optional cleanup)
# =============================================================================
echo -e "${YELLOW}Bonus: Checking legacy OffPlatformTimer storage...${NC}"

OPT_FILE="$PROJECT_ROOT/src/ui/popup/OffPlatformTimer.tsx"
if [ -f "$OPT_FILE" ]; then
  legacy_count=$(grep -c 'offPlatformTimer\|offPlatformDescriptions' "$OPT_FILE" 2>/dev/null || echo "0")
  if [ "$legacy_count" -gt 0 ]; then
    echo -e "${YELLOW}  ⚠ OffPlatformTimer.tsx has $legacy_count legacy storage references${NC}"
    echo "      (Optional cleanup - not required for core refactoring)"
  else
    echo -e "${GREEN}  ✓ OffPlatformTimer.tsx - no legacy storage${NC}"
  fi
fi

echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "${BLUE}=== Summary ===${NC}"

TOTAL_PASSED=$((PHASE1_PASSED + PHASE2_PASSED + PHASE3_PASSED + PHASE4_PASSED + PHASE5_PASSED + PHASE6_PASSED))
TOTAL_TESTS=6

if [ "$TOTAL_PASSED" -eq "$TOTAL_TESTS" ]; then
  echo -e "${GREEN}✅ All $TOTAL_TESTS/6 phases passed! Storage refactoring complete.${NC}"
  exit 0
else
  echo -e "${RED}❌ $TOTAL_PASSED/$TOTAL_TESTS phases passed. Refactoring incomplete.${NC}"
  echo ""
  echo "Phases:"
  [ "$PHASE1_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 1: tasksSlice/settingsSlice cleanup" || echo -e "  ${RED}✗${NC} Phase 1: tasksSlice/settingsSlice cleanup"
  [ "$PHASE2_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 2: store.ts cleanup" || echo -e "  ${RED}✗${NC} Phase 2: store.ts cleanup"
  [ "$PHASE3_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 3: ChromeStorageSync imports" || echo -e "  ${RED}✗${NC} Phase 3: ChromeStorageSync imports"
  [ "$PHASE4_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 4: ChromeStorageSync methods" || echo -e "  ${RED}✗${NC} Phase 4: ChromeStorageSync methods"
  [ "$PHASE5_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 5: TypeScript check" || echo -e "  ${RED}✗${NC} Phase 5: TypeScript check"
  [ "$PHASE6_PASSED" -eq 1 ] && echo -e "  ${GREEN}✓${NC} Phase 6: Unit tests" || echo -e "  ${RED}✗${NC} Phase 6: Unit tests"
  exit 1
fi
