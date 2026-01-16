# Model Testing Instructions

This document provides instructions for testing and evaluating the storage refactoring task performed by the AI model.

## Commit Reference

| Commit | Hash | Description |
|--------|------|-------------|
| **Base (Before)** | `a755a1e` | Clean state before model response |
| **Model Response** | `b81c347` - diff patch at `./model_response_diff.patch` | Gemini 3 Pro High model's code changes |
| **Fixed/Complete** | `eb5cb55` - diff patch at `./reference_diff.patch`| Complete and corrected response |

## Quick Checkout Commands

```bash
# Go to base commit (before model response)
git checkout a755a1e

# Go to model's response commit
git checkout b81c347

# Go to fixed/complete commit
git checkout eb5cb55

# Return to main branch
git checkout model-exercise-sample
```

---

## Testing Workflow

### Step 1: Verify Base State

```bash
git checkout a755a1e
pnpm install
pnpm test:run
```

**Expected**: All tests should pass (this is the clean baseline).

### Step 2: Test Model Response

```bash
git checkout b81c347
pnpm install
./scripts/verify-storage-refactoring.sh
```

**Expected**: 43 tests fail, 240 pass.

The model made correct architectural changes but failed to:
1. Make `ActiveTimerManager` constructor backward-compatible with tests
2. Update `ChromeStorageSync` mock with `getInstance()` method
3. Add missing setter methods to the mock

### Step 3: Verify Fixed Response

```bash
git checkout eb5cb55
pnpm install
./scripts/verify-storage-refactoring.sh
```

**Expected**: All test including unit tests pass.

---

## Using the Verification Script

A verification script is provided to check the storage refactoring:

```bash
./scripts/verify-storage-refactoring.sh
```

This script checks:
1. No direct `chrome.storage` calls in UI store slices
2. `store.ts` uses storage abstractions
3. `ChromeStorageSync` is imported in slices
4. Required methods exist in `ChromeStorageSync`
5. TypeScript compiles without errors
6. All unit tests pass

---

## Docker Testing

To test in an isolated environment:

```bash
# Build the image
docker build -t qc-audit-tracker .

# Run tests
docker run --rm qc-audit-tracker pnpm test:run

# Interactive exploration
docker run -it --rm qc-audit-tracker
```

---

## Key Files Changed

### Model Response (`b81c347`)

| File | Change |
|------|--------|
| `src/background/activeTimerManager.ts` | Refactored to use `StorageManager` |
| `src/background/storage.ts` | Added `getActiveTimers()` and `saveActiveTimers()` |
| `src/ui/store/chromeStorageSync.ts` | Added new methods |
| `src/ui/store/slices/tasksSlice.ts` | Uses `ChromeStorageSync.getInstance()` |
| `src/ui/store/slices/settingsSlice.ts` | Uses `ChromeStorageSync.getInstance()` |
| `src/ui/store/store.ts` | Uses `ChromeStorageSync.getInstance()` |
| `src/ui/dashboard/Settings.tsx` | Uses `ChromeStorageSync` |
| `src/ui/popup/OffPlatformTimer.tsx` | Uses `ChromeStorageSync` |

### Fixes Applied (`eb5cb55`)

| File | Fix |
|------|-----|
| `src/background/activeTimerManager.ts` | Made `StorageManager` optional with fallback |
| `src/test/mocks/chromeStorageSync.js` | Added `getInstance()` and all setter methods |
| `src/ui/store/__tests__/store.test.js` | Fixed `mockResolvedValueOnce` → `mockStorageData` |

---

## Evaluation Criteria

| Criterion | Model Response | Fixed Response |
|-----------|----------------|----------------|
| Architectural correctness | ✅ Correct | ✅ Correct |
| Backward compatibility | ❌ Broke tests | ✅ Maintained |
| Test awareness | ❌ Didn't update mocks | ✅ Updated |
| All tests pass | ❌ 43 failed | ✅ 283 passed |