# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📝 TypeScript Types:** See `TYPE_ORGANIZATION.md` for comprehensive guidance on TypeScript type organization, import patterns, and best practices.

## Analytics Component Architecture

**Optimized Re-render Management:** The Analytics component (`src/ui/dashboard/Analytics.tsx`) implements a specialized caching system to prevent excessive re-renders during real-time timer updates:

### Complete Props Independence
- **No Parent Props**: Analytics component receives no props from parent components to eliminate cascading re-renders
- **Global State Access**: Fetches all data directly from Zustand store using `useStore.getState()`
- **Isolated Data Management**: Maintains its own cached state with controlled update intervals

### Smart Caching Strategy
- **30-Second Intervals**: Charts and graphs update every 30 seconds (instead of every second) during active timers
- **Timer State Detection**: Automatically starts/stops update intervals based on active timer presence
- **Performance Optimization**: Uses `React.memo` and isolated state to prevent unnecessary re-renders
- **Professional Standard**: 30-second chart updates provide smooth UX without performance degradation

### Implementation Details
```typescript
// Cached data state - only updates when we control it
const [cachedEntries, setCachedEntries] = useState<DashboardEntry[]>([]);
const [cachedDailyHours, setCachedDailyHours] = useState<number>(0);
const [cachedWeeklyHours, setCachedWeeklyHours] = useState<number>(0);

// Smart interval management
useEffect(() => {
  // Initial data load
  updateCachedData();
  
  // 30-second intervals only when active timers exist
  if (hasActiveTimers && !updateIntervalRef.current) {
    updateIntervalRef.current = window.setInterval(updateCachedData, 30000);
  }
}, []);
```

### Benefits
- **Eliminates Chart Flickering**: 30-second updates prevent animation interruptions and visual artifacts
- **Optimized Performance**: Reduces CPU usage and improves browser responsiveness during timer sessions
- **Professional UX**: Maintains real-time feeling while ensuring smooth chart animations
- **Scalable Architecture**: Pattern can be applied to other analytics-heavy components

## Project Overview

QC Audit Tracker is a Chrome Extension (Manifest V3) that automatically tracks time spent on Outlier AI code audit tasks. It uses API interception to extract task metadata and provides a unified React-based dashboard for viewing both audit history and off-platform time entries. Features include professional data table with sorting/filtering, multi-format export (CSV, Simplified CSV, Markdown), comprehensive user settings with real-time displays, project override management, and advanced analytics with earnings calculations.

## Architecture

### Core Components

**Extension Scripts (TypeScript):**
- **Background Service Worker (`src/background/`):**
  - `index.ts` - Main service worker entry point coordinating all background tasks
  - `timer.ts` - Timer management with Chrome alarms for persistence
  - `storage.ts` - Type-safe Chrome storage layer with all CRUD operations
  - `messages.ts` - Message routing and handling between extension contexts
  - `activeTimerManager.ts` - Real-time timer management service for live tracking across all contexts
- **Content Script (`src/content/`):**
  - `index.ts` - Main content script managing tracking state and message handling
  - `injector.ts` - Script injection utilities for page context scripts
  - `bridge.ts` - UI bridge for timer display and DOM management
- **Page Scripts (`src/page-scripts/`):**
  - `interceptor.ts` - Compiled to IIFE, injected into page context to intercept fetch calls
    - Only intercepts specific audit-related endpoints to avoid conflicts
    - Handles both `/complete/` and `/transition` endpoints for task completion
- **Shared Modules (`src/shared/`):**
  - `types/` - TypeScript type definitions for API, messages, storage, and active timers
  - `logger.ts` - Centralized logging with async initialization and queueing
  - `constants.ts` - Shared constants across all contexts
  - `timeUtils.ts` - Time formatting utilities for decimal hours ↔ hh:mm conversions
- `manifest.config.ts` - Extension configuration using @crxjs/vite-plugin

**React UI (`src/ui/`):**
- **State Management (`src/ui/store/`):**
  - Built with Zustand for reactive state management across all extension contexts
  - **Core Store (`store.ts`):** Main store combining all slices with Chrome storage sync
    - Includes computed values: `dailyHours` and `weeklyHours` automatically updated in real-time
    - `updateComputedValues()` action recalculates hours when data changes (includes active timers)
    - **Real-time Updates:** Automatic 1-second computed value updates when active timers are running
    - `startRealtimeUpdates()` / `stopRealtimeUpdates()` manage live timer integration
  - **Store Slices:**
    - `slices/tasksSlice.ts` - Task and off-platform entry management with CRUD operations
    - `slices/settingsSlice.ts` - User settings with real-time Chrome storage sync
    - `slices/analyticsSlice.ts` - Analytics calculations and data aggregation
  - **Chrome Integration:**
    - `chromeStorageSync.ts` - Bi-directional Chrome storage synchronization with active timer support
    - `StoreProvider.tsx` - Provider component for store initialization and real-time timer monitoring
    - `types.ts` - Store-specific TypeScript interfaces and types
  - **Computed Values (Real-time):**
    - `dailyHours`: Today's total work hours (tasks + off-platform + active timers)
    - `weeklyHours`: Current week's total hours (Monday-Sunday + active timers)
    - `activeTimers`: Current running audit and off-platform timers with live duration updates
- **Popup (`src/ui/popup/`):** 
  - `App.tsx` - Extension popup with tracking toggle, progress summary, dashboard navigation, and off-platform timer
    - Shows daily/weekly hours progress in hh:mm format (e.g., "⏰ Daily: 8:18/8h")
    - Integrates off-platform quick timer with persistent state management
    - Auto-expands timer section when active timer detected
    - Prevents timer hiding when running for data protection
    - All data from Zustand store for real-time updates
  - `OffPlatformTimer.tsx` - Standalone off-platform timer component with:
    - **Activity Selection**: Dropdown with all off-platform activity types
    - **Timer Controls**: Start/Pause/Resume with hh:mm:ss display
    - **Real-time Integration**: Synchronized with ActiveTimerManager for live updates across all contexts
    - **Safety Features**: Double-click stop confirmation with visual feedback
    - **Activity Switching**: Modal confirmation when switching between activities while timer runs
    - **Persistent State**: Chrome storage integration survives popup close/reopen cycles
    - **Smart UI**: Cannot hide timer section while running, auto-expands on active timer
    - **Live Display**: Timer updates every second even when popup stays open
  - `ConfirmModal.tsx` - Reusable modal component for confirmations and alerts
  - `index.html`, `main.tsx` - Entry points
- **Dashboard (`src/ui/dashboard/`):**
  - Built with React 19, TypeScript, Tailwind CSS v4, Vite, and Lucide React icons
  - **Application Architecture:**
    - `App.tsx` - Main application container with StoreProvider and navigation management
    - `AppHeader.tsx` - Navigation bar with HeaderSummary component for real-time daily statistics
    - `main.tsx` - Application entry point
  - **Page Components:**
    - `Dashboard.tsx` - Pure dashboard page component focused on data display and filtering
    - `AddOffPlatformTime.tsx` - Time entry form with activity types and recent entries, integrated with store
    - `Analytics.tsx` - Comprehensive analytics dashboard with earnings calculations and time tracking (uses store computed values)
    - `Settings.tsx` - Comprehensive user preferences interface with real-time value displays, work hours configuration, pay settings, and project override management
  - **Data Table Components:**
    - `DashboardTable.tsx` - Professional data table built with @tanstack/react-table featuring:
      - Column sorting (ascending/descending) for all data types
      - Individual column filtering with search inputs
      - Global search across all columns
      - Pagination with configurable page sizes (10, 25, 50, 100)
      - Column visibility toggles
      - Inline editing for project names and max times
      - Row actions (copy CSV format, delete with confirmation)
      - Project override integration with visual indicators
      - Performance optimized for large datasets
    - `FilterBar.tsx` - Filtering with date presets, entry types, activity types, and multi-format export dropdown (CSV, Simplified CSV, Markdown)
    - `HeaderSummary.tsx` - Compact header component displaying daily/weekly work hours and earnings
      - Shows progress in hh:mm format: "Today: 8:18/8h" and "Week: 35:12/40h"
      - Uses store's computed values for real-time updates (includes active timers)
    - `InlineEdit.tsx` - Reusable inline editing component for project names and max times
  - **Utilities:**
    - `dashboardUtils.ts` - Data conversion utilities and multi-format export functionality (CSV, Simplified CSV, Markdown)
    - Includes `activeAuditTimerToDashboardEntry()` and `activeOffPlatformTimerToDashboardEntry()` for real-time dashboard display
- **Shared Types and Utilities:**
  - `src/types.ts` - UI-specific TypeScript interfaces (Filters, DashboardEntry, etc.)
  - `src/projectUtils.ts` - Project override management and time formatting utilities
  - `src/shared/dateUtils.ts` - Date manipulation utilities for timezone handling and calculations
  - `src/shared/timeUtils.ts` - Comprehensive time formatting utilities for decimal hours ↔ hh:mm conversions
- **Error Boundary System (`src/ui/shared/`):**
  - **Core Components:**
    - `ErrorBoundary.tsx` - Base React class component that catches JavaScript errors in child components
    - `errorUtils.ts` - Error formatting, clipboard copying, and metadata collection utilities
    - `DashboardErrorBoundary.tsx` - Dashboard-specific error boundary wrapper
    - `PopupErrorBoundary.tsx` - Popup-specific error boundary wrapper
  - **Error Fallback UIs:**
    - `DashboardErrorFallback.tsx` - Full-page error replacement for dashboard with "Go to Dashboard" reset
    - `PopupErrorFallback.tsx` - Popup-sized error UI with "Close Extension" action (260px × 340px)
  - **Features:**
    - **Comprehensive Error Capture**: Error message, stack trace, React component stack, timestamp, extension version, browser info
    - **Professional UX**: Clear error messaging with reassuring explanations and recovery actions
    - **One-Click Error Reporting**: Copy formatted error details to clipboard for support requests
    - **Graceful Recovery**: Dashboard reset or popup close without data loss
    - **Support Integration**: Direct links to support form for easy bug reporting
    - **Development Testing**: `ErrorBoundaryTest.tsx` component for testing error boundary behavior
  - **Integration**: Both dashboard and popup applications wrapped with appropriate error boundaries to catch unexpected React errors

### Data Flow

**Audit Task Tracking:**
1. User navigates to audit task at `https://app.outlier.ai/en/expert/outlieradmin/tools/chat_bulk_audit/*`
2. Content script checks if tracking is enabled (can be toggled in popup menu)
3. If enabled, `interceptor.ts` (compiled to IIFE and injected into page context) captures API responses from specific audit-related endpoints only:
   - `/corp-api/chatBulkAudit/attemptAudit/{id}?pageLoadId` - Initial task data - the response is either an object or an array of single object. From the response we extract project ID as `response.project` or `response[0].project` and attempt ID as `response.auditedEntityContext.entityAttemptId` or `response[0].auditedEntityContext.entityAttemptId`.
   - `corp-api/chatBulkAudit/attemptAudit/{id}/response?` - Extracting the full project name as `response.auditedAttempt.estimatedPayoutMeta.workerTeamName` with the regex pattern `\/([^\/]+)\/[^\/]+$`.
   - `/corp-api/chatBulkAudit/relatedQaOperationForAuditBatch/` - Operation details - the response is an object. From the response we extract max audit time as `response.maxTimeRequired` (in seconds) and Op ID as `response.stateMachine.context.operationId` (primary identifier).
   - `/corp-api/qm/operations/{id}/nodes` - **Enhanced endpoint** - Now extracts project names from the massive JSON response (30k-90k lines) by searching for `auditedAttempt.estimatedPayoutMeta.workerTeamName` paths, applying the same regex extraction logic as the `/response?` endpoint. Also used to check if audits were canceled.
   - `/corp-api/chatBulkAudit/complete/` - **Task completion (dual-stage workflow)** - Pre-final stage where audit is completed but can still be modified. Saves completion time but keeps timer running.
   - `/corp-api/qm/operations/{id}/transition` - **Final audit transition (dual-stage workflow)** - Final stage where audit is fully submitted and cannot be modified. Saves transition time and stops timer.
4. **Enhanced Dual-Stage Completion Workflow:**
   - When `/complete/` is hit: saves `completionTime`, sets status to `pending-transition`, timer continues
   - When `/transition` is hit: saves `transitionTime`, sets status to `completed`, stops timer
   - If new task starts before transition: completes previous task using completion time
5. Data flows: interceptor (via window.postMessage) → content script → background script (via chrome.runtime messages) → Chrome storage
6. Timer runs persistently in background with Chrome alarms, survives page refreshes
7. Project overrides are applied for custom display names and max times

**Off-Platform Time Tracking:**
1. **Manual Entry**: User enters time via "Add Off Platform Time" page with activity types and descriptions
2. **Quick Timer**: Popup-based timer for real-time off-platform activity tracking with:
   - **Activity Selection**: Auditing, Spec Doc, Validation, Onboarding/OH, Other
   - **Real-time Integration**: Uses ActiveTimerManager for live updates across all extension contexts
   - **Timer Persistence**: Survives popup close/reopen, browser restarts via Chrome storage
   - **Activity Switching**: Modal confirmation prevents accidental time loss when switching activities
   - **Safety Controls**: Double-click stop confirmation, cannot hide timer while running
   - **Auto-Save**: Automatically saves entries when stopping or switching activities
   - **Live Dashboard**: Running timers appear in dashboard with 🔴 LIVE indicators and real-time duration updates
3. **Data Flow**: Popup timer → ActiveTimerManager → Chrome storage → Zustand store → real-time UI updates across all contexts
4. **Display Integration**: Recent entries in sidebar, real-time daily/weekly calculations in hh:mm format, live progress tracking

**State Management Data Flow:**
1. **Initialization:** StoreProvider loads data from Chrome storage into Zustand store and starts real-time updates if active timers detected
2. **Real-time Sync:** Chrome storage changes automatically update Zustand state across all contexts
3. **Live Timer Updates:** Active timers trigger automatic 1-second computed value recalculations for daily/weekly hours
4. **Component Updates:** All UI components subscribe to relevant store slices for reactive updates
5. **Actions:** User actions (add task, update settings) flow through Zustand actions to Chrome storage
6. **Cross-Context Updates:** Changes in popup instantly reflect in dashboard and vice versa (including live timer states)

## Development Commands

```bash
pnpm install               # Install all dependencies
pnpm dev                   # Start development server (use pnpm build for extension)
pnpm build                 # Build complete extension to dist/
pnpm build:page-scripts    # Build only the IIFE interceptor script
pnpm typecheck             # Run TypeScript type checking
pnpm clean                 # Clean dist folder
```

**Note:** For extension development, use `pnpm build` and reload the extension in Chrome. The `pnpm dev` command runs the Vite dev server which is useful for UI development but the extension needs to be built and loaded from the `dist/` folder.

## Testing

**Test Environment:**
```bash
./start-test-environment.sh    # Start mock servers
./stop-test-environment.sh     # Stop mock servers  
./test-and-deploy.sh          # Full test and build pipeline
```

**Manual Testing:**
1. Run `pnpm build` to compile the extension
2. Load the `dist/` directory as unpacked extension in Chrome
2. Visit `http://localhost:3000/test-framework/mock-platform.html`
3. Test framework provides mock API responses in `test-framework/scenarios/`

**Error Boundary Testing:**
- **Test Component**: Temporarily add `<ErrorBoundaryTest />` to any page for testing error boundaries
- **Dashboard Testing**: Add test component to dashboard pages and click "Throw Render Error" to verify full-page error fallback
- **Popup Testing**: Add test component to popup and verify error UI fits 260px × 340px popup dimensions
- **Copy Functionality**: Test error details copying to clipboard for support reporting
- **Recovery Actions**: Verify "Go to Dashboard" and "Close Extension" buttons work correctly
- **Remove Before Production**: Always remove `ErrorBoundaryTest` components before building for production

## Production Deployment

```bash
./build-production.sh         # Build clean production version to production/
./create-zip.sh              # Create qc-tracker-production.zip for Chrome Web Store
```

**Key Differences Dev vs Production:**
- Development includes localhost permissions and redirects API calls to mock server
- Production removes all localhost references and test framework code
- Production manifest changes name from "QC Audit Tracker (Dev)" to "QC Audit Tracker"

## TypeScript Architecture

**Clean Architecture Implementation:** The extension follows a clean, modular TypeScript architecture with Zustand state management:

**Module Organization:**
- **Background Service Worker:** Modular design with separate files for timer management, storage operations, and message handling
- **Content Script:** Split into injector, bridge, and main logic for better separation of concerns
- **Page Scripts:** Interceptor compiled to IIFE for injection into page context
- **State Management:** Zustand store with modular slices for tasks, settings, and analytics
- **Shared Types:** Centralized type definitions for API responses, messages, storage schema, and store interfaces
- **Type-safe Messaging:** Strongly typed message protocol between all extension contexts

**Key TypeScript Features:**
- **Comprehensive API typing:** All Outlier AI API responses have defined interfaces in `src/shared/types/api.ts`
- **Message Protocol:** Type-safe message passing with enums and typed payloads in `src/shared/types/messages.ts`
- **Storage Schema:** Strongly typed Chrome storage operations in `src/shared/types/storage.ts`
- **Store Types:** Complete typing for Zustand store slices, actions, and selectors in `src/ui/store/types.ts`
- **Chrome Extension APIs:** Full typing for chrome.storage, chrome.runtime, chrome.tabs, chrome.alarms
- **Error handling:** Proper error propagation with typed error objects

**State Management Architecture:**
- **Zustand Store:** Reactive state management with automatic Chrome storage synchronization
- **Modular Slices:** Separate slices for tasks, settings, and analytics with type-safe actions
- **Real-time Sync:** Bi-directional synchronization between store and Chrome storage
- **Cross-Context Updates:** State changes instantly propagate across popup, dashboard, and background contexts
- **Real-time Timer System:** ActiveTimerManager provides live updates across all extension contexts
- **Computed Values (Live):** 
  - `dailyHours` and `weeklyHours` automatically calculated when data changes (includes active timers)
  - `updateComputedValues()` action triggered after any task/off-platform modifications and every second during active timers
  - Consistent time calculations across all UI components with live timer integration
  - `startRealtimeUpdates()` / `stopRealtimeUpdates()` manage 1-second update intervals

**Build System:** 
- Uses Vite with @crxjs/vite-plugin for main extension bundling
- Separate Vite config for compiling interceptor to IIFE
- Concurrent development builds with hot reload
- TypeScript path aliases configured with `@/` prefix
- Zustand with TypeScript for type-safe state management
- **Dependencies:** @tanstack/react-table for professional data table functionality

## Time Formatting System

**Precision Display:** The extension provides both decimal hours and hh:mm time formats for precise minute-by-minute tracking:

**Time Utilities (`src/shared/timeUtils.ts`):**
- `formatDecimalHoursToHHMM()` - Converts decimal hours (e.g., 10.3) to hh:mm format (e.g., "10:18")
- `formatSecondsToHHMM()` - Converts seconds to hh:mm format
- `formatSecondsToHHMMSS()` - Converts seconds to hh:mm:ss format for timer display
- `parseHHMMToDecimalHours()` - Converts hh:mm string back to decimal hours
- `decimalHoursToSeconds()` / `secondsToDecimalHours()` - Conversion utilities

**Display Implementation:**
- **Popup Progress**: Shows "⏰ Daily: 8:18/8h" instead of "⏰ Daily: 8.3/8h"
- **Dashboard Header**: Uses same hh:mm format for consistency across all interfaces
- **Timer Display**: Real-time hh:mm:ss format for off-platform timer
- **Data Storage**: Maintains decimal hours for calculations, converts for display

**User Benefits:**
- **Precise Tracking**: Auditors can see exact minutes worked to stay within daily/weekly limits
- **Visual Clarity**: hh:mm format is more intuitive than decimal hours for time management
- **Consistent Interface**: Same format used across popup, dashboard, and timer components

## Real-Time Timer System

**Comprehensive Live Tracking:** Both audit tasks and off-platform activities provide real-time updates across all extension contexts:

### **ActiveTimerManager (`src/background/activeTimerManager.ts`)**
- **Chrome Alarms Integration**: Persistent timer updates every minute via Chrome alarms API
- **Cross-Context Broadcasting**: Real-time updates sent to all tabs and UI contexts
- **Dual Timer Support**: Manages both audit timers and off-platform timers simultaneously
- **Automatic Cleanup**: Stops update intervals when no active timers remain
- **Enhanced Debugging**: Comprehensive timer lifecycle logging with ID matching verification and error tracking
- **Robust Error Handling**: Detailed error reporting and recovery mechanisms for timer operations

### **Real-Time Features:**
- **Live Dashboard Entries**: Running timers appear with 🔴 LIVE indicators and updating durations
- **Real-Time Progress**: Daily/weekly hours update every second in HeaderSummary, popup, and analytics
- **Cross-Context Sync**: Timer state instantly propagates between popup, dashboard, and background
- **Performance Optimized**: 1-second updates only when timers are active, automatic start/stop

### **Off-Platform Timer Integration:**
- **Activity Selection**: 5 activity types with dropdown selection
- **Persistent State**: Survives popup close/reopen, browser restarts via ActiveTimerManager
- **Robust Stop Mechanism**: Enhanced error handling and debugging for reliable timer stopping across all contexts
- **Safety Controls**: 
  - Double-click stop confirmation with visual feedback
  - Cannot hide timer section while running
  - Modal confirmation when switching activities
- **Auto-Management**: 
  - Timer section auto-expands when active timer detected
  - Real-time duration updates even when popup stays open
  - Automatic entry creation when stopping or switching activities
- **Debug Integration**: Comprehensive logging for timer lifecycle debugging and troubleshooting

### **Data Flow (Real-Time):**
- Background ActiveTimerManager → Chrome Storage → Zustand Store → Live UI Updates
- Popup timer actions → Background service → Real-time broadcasting to all contexts
- 1-second computed value recalculations include active timer durations

### **Performance Considerations:**
- **Efficient Updates**: Only timestamp math and simple calculations, no heavy operations
- **Conditional Execution**: Real-time updates only run when active timers exist
- **Automatic Cleanup**: Intervals automatically stop when no active timers remain
- **Browser Optimized**: Uses standard JavaScript intervals optimized by Chrome
- **Minimal CPU Impact**: ~0.1% CPU usage for real-time updates across all contexts
- **Professional Standard**: 1-second updates match industry standards for time tracking applications

## Key Implementation Notes

**Architecture:**
- Timer state persists in background service worker using Chrome alarms API
- Extension works across page navigation and refreshes within Outlier AI platform
- API interception happens at window.fetch level in page context (injected IIFE)
- Message passing uses window.postMessage (page → content) and chrome.runtime (content ↔ background)
- All scripts use ES modules except the injected interceptor (compiled to IIFE)
- Uses pnpm exclusively for package management
- **Modern React Architecture with State Management:**
  - Zustand store provides centralized state management across all extension contexts
  - StoreProvider wraps main application for store initialization and Chrome storage sync
  - App.tsx serves as main container with navigation, using store for data access
  - Pure page components (Dashboard, AddOffPlatformTime, Analytics, Settings) use store hooks
  - Real-time updates: changes in popup instantly reflect in dashboard and vice versa
  - HeaderSummary component displays live daily and weekly work statistics
  - Popup menu shows progress summary with daily/weekly hours and earnings
  - Analytics page provides comprehensive earnings calculations and time tracking insights
  - Computed values (dailyHours, weeklyHours) automatically update across all components

**Data Model:**
- **qaOperationId is the single source of truth** - no taskId used anywhere
- Unified dashboard displays both audit tasks and off-platform entries
- Project overrides allow customizing display names and max times
- CSV export includes all data types with proper column headers
- **Settings Management:**
  - **Professional Settings UI:** Comprehensive user preferences interface with real-time value displays
  - **Work Hours Configuration:** Daily/weekly overtime thresholds with toggle controls and live progress indicators
  - **Pay Settings:** Hourly rate configuration with real-time earnings calculations and display
  - **Timezone Management:** Automatic timezone detection with display (no manual selection needed)
  - **Extension Controls:** Master tracking toggle and debug logging controls
  - **Persistent Settings:** All user preferences saved in Chrome storage and automatically restored
  - Real-time settings updates across all extension contexts
- **Analytics Calculations:**
  - Daily work hours calculated in user's timezone with real-time updates
  - Weekly pay calculated Monday-Sunday in PST timezone
  - Overtime calculations with configurable thresholds and toggle controls
  - Configurable overtime rate multiplier for accurate earnings projections
  - **Enhanced Analytics Page:** Uses computed values from store for consistent real-time data
  - **Completion-Based Calculations:** All analytics use task completion time for accurate date-based grouping

**Logging System:**
- Centralized Logger class in `src/shared/logger.ts` with categorized output (api, timer, ui, workflow, storage, message)
- Async initialization with Chrome storage check for qcDevLogging flag
- Queue system for logs before initialization completes
- SimpleLogger class for page context scripts that can't access Chrome APIs
- Context-aware logging with prefixes and timestamps
- **Enhanced Timer Debugging**: Detailed ActiveTimerManager logging for timer lifecycle, ID matching, and error tracking
- **Real-time Debug Console**: Live timer operation logging for troubleshooting start/stop/sync issues

**User Controls:**
- Tracking can be completely disabled via popup toggle (syncs instantly across contexts)
- **Professional Settings Interface:** Comprehensive user preferences with real-time value displays
- **Data Table:** Professional @tanstack/react-table implementation with:
  - Column sorting (ascending/descending) with visual indicators
  - Individual column filtering with search inputs
  - Global search across all table data
  - Pagination with configurable page sizes
  - Column visibility controls
  - Inline editing of project names and max times directly in table cells
  - Row actions (copy CSV format, delete with confirmation modal)
  - **Completion Time Display:** Shows task completion time instead of start time for accurate audit tracking
- **Table Filtering:** Entry type filtering (all/audits/off-platform) and activity type filtering
- **Analytics & Earnings Features (Real-Time):**
  - Real-time daily and weekly work hours display in header and popup (includes active timers)
  - Progress indicators showing hours vs thresholds (e.g., "8.5/8h", "35.2/40h") with live updates
  - Comprehensive analytics page with time breakdowns and earnings projections (live calculations)
  - **Live Settings Display:** Real-time earnings calculations in settings interface
  - **Work Hours Monitoring:** Live progress tracking with visual indicators
  - Configurable hourly rates and overtime thresholds with instant feedback
  - Timezone-aware calculations for accurate daily/weekly tracking
  - Computed values automatically update every second when active timers are running
- **Enhanced UI Features:**
  - Modern card-based layout for settings and forms with professional styling
  - **Real-time Value Displays:** Current work hours and earnings prominently shown
  - **Change Detection:** Save/reset buttons appear only when settings are modified
  - **Automatic Timezone Display:** Shows detected timezone with current time
  - **Toggle Controls:** Daily overtime can be enabled/disabled independently
  - Recent entries sidebar in AddOffPlatformTime
  - Data quality warning banner for problematic project values
  - Multi-format export dropdown with CSV, Simplified CSV, and Markdown options
  - Project overrides properly applied to timer status calculations
  - **Real-time Dashboard Integration:** Active timers appear as live entries with 🔴 LIVE indicators
  - **Live Duration Updates:** Timer durations update every second across all UI components
  - Real-time state updates across all extension contexts via Zustand with ActiveTimerManager integration

**Workflow:**
- Only injects timer on audit pages (`/chat_bulk_audit/`) excluding `/results` pages
- **Enhanced Dual-Stage Completion Workflow:**
  - `/complete/` endpoint: Records completion time, keeps timer running (allows further edits)
  - `/transition` endpoint: Records transition time, stops timer (final submission)
  - When new task starts: Previous task completed using its completion time if available
  - Timer display and analytics use completion time (or transition time) instead of start time
- Robust DOM mutation monitoring with page-specific logic
- Comprehensive error handling and graceful degradation
- **URL Pattern Matching:**
  - Audit pages must contain `/chat_bulk_audit/` but NOT `/results`
  - qaOperationId extraction validates MongoDB ObjectId format (24 hex characters)
  - Prevents false starts on results pages or invalid URLs

## Common Issues & Solutions

**Dashboard Access Error (ERR_FILE_NOT_FOUND):**
- Ensure you've run `pnpm build` to generate the dashboard HTML files
- The dashboard is located at `src/ui/dashboard/index.html` in the built extension
- Reload the extension in Chrome after building

**Timer Not Stopping After Submission:**
- The extension listens for the `/transition` endpoint to stop tracking
- Content script and interceptor now run on all Outlier AI pages (including `/results`) to catch completion API calls during page transitions
- Check if debug logging is enabled in Settings to see interceptor messages
- Ensure the interceptor is properly injected (check for `[QC-Interceptor]` logs)

**Timer Starting on Results Page:**
- Fixed by excluding `/results` pages from audit page detection
- qaOperationId validation prevents "results" from being used as an ID

**403 Errors in Console:**
- The interceptor now only processes audit-related endpoints
- Other Outlier AI API calls are passed through without processing

**Project Name Extraction Issues:**
- **Enhanced Project Name Detection:** The `/nodes` endpoint now extracts project names from large JSON responses
- Project names are extracted using the same regex logic applied to `auditedAttempt.estimatedPayoutMeta.workerTeamName` paths
- Fallback extraction handles cases where the `/response?` endpoint doesn't trigger
- Performance optimized with depth-limited recursive search through large JSON structures
- **Enhanced Debugging:** Added comprehensive logging throughout the extraction pipeline:
  - Interceptor logs detailed data structure inspection for `attemptAuditResponse` endpoint
  - Content script logs when project names are successfully extracted
  - Background script logs when project names are received in task updates
  - Enable debug logging in Settings to see `[QC-Interceptor]` messages in browser console

**Timer Max Time Display Issues:**
- **Fixed Timer Display Logic:** Project overrides now properly apply to timer display
- Max time updates are correctly propagated from background → content script → timer UI
- Timer shows actual project max times (not default 3hr) when intercepted data or overrides are available
- **Fixed Background Script Logic:** Removed restrictive condition that prevented max time updates after initial value was set
  - Previously: Max time only updated if current value was DEFAULT_MAX_TIME
  - Now: Max time always updates from intercepted data unless a project override exists
- Intercepted max times now properly update the timer display in real-time

**Cross-Context State Synchronization Issues:**
- **Root Cause**: Dashboard not updating when timers started/stopped from popup due to multiple ChromeStorageSync instances
- **Critical Fix**: Implemented singleton ChromeStorageSync pattern to ensure only one storage listener across all contexts
- **Solution Architecture**: 
  - Single shared Chrome storage event listener for popup, dashboard, and all UI contexts
  - Proper singleton pattern prevents multiple storage listeners from conflicting
  - Enhanced error handling with try-catch around listener callbacks
- **Debugging**: Added comprehensive logging to track storage events and listener initialization
- **Result**: Real-time synchronization now works perfectly - popup timer changes instantly reflect in dashboard
- **Implementation**: Located in `chromeStorageSync.ts` with singleton instance management

**Real-Time Timer Stop Issues:**
- **Enhanced Stop Flow**: Improved timer stopping mechanism with enhanced debugging and error handling
- **ID Matching Verification**: ActiveTimerManager now logs detailed information about timer ID matching during stop operations
- **Cross-Context Sync**: Stop actions properly propagate from popup to dashboard with real-time updates
- **Debug Console Logging**: Comprehensive logging helps troubleshoot timer lifecycle issues
- **Error Recovery**: Robust error handling ensures timer stops work reliably across all extension contexts
- **State Synchronization**: Fixed issues where dashboard timers might continue running after popup stop actions