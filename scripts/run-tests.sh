#!/bin/bash

# QC Audit Tracker - Comprehensive Test Runner
# This script runs all tests and generates coverage reports

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_RESULTS_DIR="test-results"
COVERAGE_DIR="coverage"

# Create necessary directories
mkdir -p $TEST_RESULTS_DIR
mkdir -p $COVERAGE_DIR

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}QC Audit Tracker Test Suite${NC}"
echo -e "${BLUE}==================================${NC}"

# Function to run tests with nice output
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "\n${YELLOW}Running $suite_name...${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track failures
FAILED_SUITES=()

# 1. Build the extension first
echo -e "\n${YELLOW}Building extension...${NC}"
if pnpm build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# 2. Run unit tests with coverage
if ! run_test_suite "Unit Tests" "pnpm vitest run --coverage --reporter=json --outputFile=$TEST_RESULTS_DIR/unit-test-results.json"; then
    FAILED_SUITES+=("Unit Tests")
fi

# 3. Run component tests
if ! run_test_suite "Component Tests" "pnpm vitest run src/ui/**/*.test.jsx --reporter=json --outputFile=$TEST_RESULTS_DIR/component-test-results.json"; then
    FAILED_SUITES+=("Component Tests")
fi

# 4. Run utility tests
if ! run_test_suite "Utility Tests" "pnpm vitest run src/**/__tests__/*.test.js --reporter=json --outputFile=$TEST_RESULTS_DIR/utility-test-results.json"; then
    FAILED_SUITES+=("Utility Tests")
fi

# 5. Run E2E tests
if ! run_test_suite "E2E Tests" "pnpm playwright test --project=extension"; then
    FAILED_SUITES+=("E2E Tests")
fi

# 6. Generate combined coverage report
echo -e "\n${YELLOW}Generating coverage report...${NC}"
if [ -d "$COVERAGE_DIR" ]; then
    echo -e "${GREEN}✓ Coverage report generated in $COVERAGE_DIR${NC}"
fi

# Summary
echo -e "\n${BLUE}==================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}==================================${NC}"

if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Failed test suites:${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "  ${RED}- $suite${NC}"
    done
    exit 1
fi