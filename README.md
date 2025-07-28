# QC Audit Tracker

A Chrome Extension (Manifest V3) that automatically tracks time spent while auditing on Outlier AI.

## Project Structure

```
qc-audit-tracker/
├── src/
│   ├── background/                    # Background service worker
│   │   ├── index.ts                   # Main service worker entry point
│   │   ├── timer.ts                   # Timer management with Chrome alarms
│   │   ├── storage.ts                 # Chrome storage operations
│   │   ├── messages.ts                # Message handling between contexts
│   │   └── activeTimerManager.ts      # Real-time timer state management
│   │
│   ├── content/                       # Content script (injected into web pages)
│   │   ├── index.ts                   # Main content script
│   │   ├── injector.ts                # Script injection utilities
│   │   └── bridge.ts                  # DOM bridge for timer UI
│   │
│   ├── page-scripts/                  # Scripts injected into page context
│   │   └── interceptor.ts             # API interceptor (compiled to IIFE)
│   │
│   ├── shared/                        # Shared modules across contexts
│   │   ├── types/                     # TypeScript type definitions
│   │   │   ├── api.ts                 # Outlier API response types
│   │   │   ├── messages.ts            # Message protocol types
│   │   │   ├── storage.ts             # Chrome storage schema
│   │   │   └── activeTimers.ts        # Active timer types
│   │   ├── constants.ts               # Shared constants
│   │   ├── logger.ts                  # Centralized logging
│   │   ├── timeUtils.ts               # Time formatting utilities
│   │   ├── dateUtils.ts               # Date manipulation utilities
│   │   └── validation.ts              # Zod validation schemas
│   │
│   ├── ui/                            # React UI components
│   │   ├── popup/                     # Extension popup (260px × 340px)
│   │   │   ├── App.tsx                # Main popup component
│   │   │   ├── OffPlatformTimer.tsx   # Off-platform timer
│   │   │   └── main.tsx               # Popup entry point
│   │   │
│   │   ├── dashboard/                 # Full dashboard application
│   │   │   ├── App.tsx                # Dashboard container
│   │   │   ├── Dashboard.tsx          # Main dashboard page
│   │   │   ├── DashboardTable.tsx     # Data table (TanStack)
│   │   │   ├── FilterBar.tsx          # Filtering controls
│   │   │   ├── Analytics.tsx          # Analytics & charts
│   │   │   ├── Settings.tsx           # User preferences
│   │   │   ├── AddOffPlatformTime.tsx # Manual time entry
│   │   │   └── main.tsx               # Dashboard entry point
│   │   │
│   │   ├── store/                     # Zustand state management
│   │   │   ├── store.ts               # Main store
│   │   │   ├── slices/                # Store slices
│   │   │   │   ├── tasksSlice.ts
│   │   │   │   ├── settingsSlice.ts
│   │   │   └── chromeStorageSync.ts   # Chrome storage sync
│   │   │
│   │   └── shared/                    # Shared UI components
│   │       └── ErrorBoundary.tsx
│   │
│   ├── types.ts                       # UI-specific types
│   ├── projectUtils.ts                # Project override utilities
│   └── manifest.config.ts             # Extension manifest configuration
│
├── dist/                              # Built extension (git-ignored)
├── scripts/                           # Build and utility scripts
├── .github/workflows/                 # GitHub Actions CI
└── package.json                       # Dependencies and scripts
```

## Key Components

### Background Service Worker (`src/background/`)
- Persistent timer management using Chrome alarms API
- Message routing between extension contexts
- Chrome storage operations with type safety
- Active timer broadcasting to all contexts

### Content Script (`src/content/`)
- Monitors Outlier AI audit pages (`/chat_bulk_audit/`)
- Injects page scripts for API interception
- Manages timer UI overlay
- Communicates with background service

### Page Script (`src/page-scripts/interceptor.ts`)
- Compiled to IIFE format for injection
- Intercepts specific Outlier API endpoints:
  - `/attemptAudit/{id}` - Task metadata
  - `/relatedQaOperationForAuditBatch/` - Max time limits
  - `/complete/` - Task completion
  - `/transition` - Final submission
- Extracts project names, IDs, and timing data

### UI Components (`src/ui/`)
- **Popup**: Quick access to timer controls and daily progress
- **Dashboard**: Full-featured time tracking interface
  - TanStack React Table for data management
  - Real-time timer updates across all contexts
  - Multi-format export (CSV, Markdown)
  - Project override management

### State Management (`src/ui/store/`)
- Zustand store with Chrome storage synchronization
- Real-time computed values (daily/weekly hours)
- Cross-context state updates
- TypeScript-first architecture

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/qc-audit-tracker.git
cd qc-audit-tracker
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the extension:
```bash
pnpm build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

## Development

### Available Commands

```bash
# Development
pnpm dev                # Start Vite dev server (for UI development)
pnpm build              # Build complete extension
pnpm build:page-scripts # Build only the IIFE interceptor
pnpm typecheck          # Run TypeScript type checking
pnpm clean              # Clean dist folder

# Production
./build-production.sh   # Build production version
./create-zip.sh         # Create Chrome Web Store package
```

### Development Workflow

1. **Extension Development**: 
   - Run `pnpm build` to compile the extension
   - Load/reload extension in Chrome from `dist/` directory
   - Changes require rebuild and extension reload

2. **UI Development**:
   - Run `pnpm dev` for Vite dev server with hot reload
   - Useful for dashboard UI development
   - Extension still needs to be built separately

3. **Page Script Changes**:
   - The interceptor requires special IIFE compilation
   - Run `pnpm build:page-scripts` after changes
   - Or use full `pnpm build` to rebuild everything

### Chrome Extension APIs Used

- `chrome.storage.local` - Data persistence
- `chrome.runtime` - Message passing
- `chrome.tabs` - Tab management
- `chrome.alarms` - Persistent timers
- `chrome.action` - Extension icon/popup

### Security Considerations

- Content scripts run in isolated context
- Page scripts use window.postMessage for communication
- All data stored locally in Chrome storage
- No external API calls or data transmission
- Input validation using Zod schemas
- TypeScript for type safety throughout

## Technical Stack

- **TypeScript** - Type safety across all contexts
- **React 19** - UI components
- **Vite** - Build tooling with @crxjs/vite-plugin
- **Zustand** - State management
- **TanStack Table** - Data table functionality
- **Tailwind CSS v4** - Styling
- **Zod** - Runtime validation
- **pnpm** - Package management