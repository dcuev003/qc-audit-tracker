# QC Audit Tracker Chrome Extension (OUTDATED - WILL UPDATE LATER - THE DEV COMMANDS ARE UP TO DATE)

A powerful Chrome extension for automatically tracking time and extracting data during Outlier AI code audit tasks. Features intelligent API interception, real-time timer injection, and a modern React-based dashboard for audit history management.

## ✨ Features

### 🔍 **Automatic Data Extraction**

- **Smart API Interception**: Intercepts and extracts data from Outlier AI APIs
- **Task Metadata**: Captures task ID, attempt ID, review level, and project details
- **State Monitoring**: Real-time monitoring of task state changes and cancellations
- **Time Limits**: Automatically extracts maximum time requirements

### ⏱️ **Intelligent Time Tracking**

- **Auto-Detection**: Automatically starts tracking when audit tasks are detected
- **Visual Timer**: Injects live timer directly into Outlier AI interface
- **Overtime Warnings**: Visual indicators when exceeding time limits
- **Persistent Tracking**: Continues tracking across page refreshes and navigation

### 📊 **Modern Dashboard**

- **Audit History**: Complete history of all tracked audit sessions
- **Advanced Filtering**: Filter by date, project, status, duration
- **Data Export**: Export audit data for analysis and reporting
- **Time Analytics**: Duration analysis and productivity insights

### 🎛️ **Flexible Controls**

- **Toggle Tracking**: Enable/disable tracking via popup interface
- **Manual Time Entry**: Add time for work done outside the platform
- **Task Notes**: Add descriptions and context to time entries
- **Bulk Operations**: Manage multiple tasks efficiently

## 🚀 Installation

### Quick Install (Recommended)

1. **Download** the latest release or clone this repository
2. **Build** the extension (see build instructions below)
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable Developer Mode** (toggle in top-right corner)
5. **Click "Load unpacked"** and select the `dist` folder
6. **Pin the extension** to your toolbar for easy access

### From Source

```bash
# Clone the repository
git clone https://github.com/zeroxvee/qc-audit-tracker.git
cd qc-audit-tracker

# Install dependencies and build
pnpm install
pnpm build

# Load the dist folder into Chrome as described above
```

## 🔨 Building

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** package manager
- **Chrome browser** with Developer Mode

### Build Process (Centralized)

You can build the extension from either the **root folder** or the **popup-ui folder**:

#### **From Root Folder **

```bash
# Install dependencies
pnpm install

# Build complete extension
pnpm run build

pnpm run dev
```



## 🌐 Browser Import

### Chrome/Edge

1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode**
3. Click **"Load unpacked"**
4. Select the `dist` folder
5. Extension appears in toolbar

### Firefox (Future Support)

Firefox support planned for future releases using Manifest V3 compatibility.

## 📁 Project Structure **OUTDATED**

```text
qc-tracker/
├── 📁 dist/                    # Built extension (generated)
├── 📁 popup-ui/               # React UI source code
│   ├── 📁 src/               # React components
│   ├── 📁 public/            # Static assets
│   ├── package.json          # UI dependencies
│   └── vite.config.js        # Build configuration
├── 📄 background.js           # Extension service worker
├── 📄 content.js             # Content script with logging
├── 📄 interceptor.js         # API interception script
├── 📄 manifest.json          # Extension configuration
├── 📁 icons/                 # Extension icons
├── 📄 package.json           # Root package with build scripts
├── 📄 pnpm-workspace.yaml    # Workspace configuration
└── 📄 README.md              # This file
```

## 🎯 Usage

### Basic Operation

1. **Install and activate** the extension
2. **Navigate** to Outlier AI audit tasks at `app.outlier.ai`
3. **Automatic tracking** begins when tasks are detected
4. **View progress** via the injected timer in the interface
5. **Access dashboard** through the extension popup

### Dashboard Features

- **View History**: See all completed and ongoing audit sessions
- **Filter & Search**: Find specific tasks by various criteria
- **Export Data**: Download audit data as CSV/JSON
- **Manage Tasks**: Edit notes and metadata for tracked time

### Manual Time Entry

- **Add Off-Platform Time**: Record work done outside the audit interface
- **Categorize Work**: Assign time to specific projects and task types
- **Detailed Notes**: Add context and descriptions to time entries

## ⚙️ Configuration

### Extension Permissions

- `storage` - Save audit data and user preferences
- `tabs` - Open dashboard and forms in new tabs
- `scripting` - Inject timer and tracking functionality
- `notifications` - Show system notifications for task events
- `https://app.outlier.ai/*` - Access Outlier AI domain

### Storage Schema

Audit data is stored locally in Chrome storage:

```typescript
interface AuditTask {
  qaOperationId: string;
  projectId: string;
  attemptId: string;
  reviewLevel: number;
  maxTime: number;        // seconds
  startTime: number;      // timestamp
  endTime?: number;       // timestamp
  duration: number;       // milliseconds
  status: 'in-progress' | 'completed' | 'canceled';
}
```

## 🔧 Development

### Architecture

- **Interceptor Script**: Monitors API calls and extracts data
- **Content Script**: Manages UI injection and timer display
- **Background Script**: Handles data processing and state management
- **React UI**: Modern interface for interaction and data visualization

### Key Technologies

- **Manifest V3**: Latest Chrome extension standard
- **React 19**: Modern React with hooks and TypeScript
- **Tailwind CSS v4**: Utility-first CSS framework
- **Vite**: Fast build tool with HMR
- **TypeScript**: Type-safe development

### Debugging

1. **Extension Console**: Right-click extension → "Inspect popup"
2. **Content Script**: F12 on Outlier AI pages → Console tab
3. **Background Script**: `chrome://extensions/` → Extension details → "Inspect views"

## 📊 Monitoring & Logging

The extension includes comprehensive logging for debugging:

- **[QC Tracker - Interceptor]**: API interception and data extraction
- **[QC Tracker - Content]**: UI injection and timer management  
- **[QC Tracker - Background]**: Data processing and state changes

Enable Chrome DevTools Console to see detailed operation logs.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with the built extension
5. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Use conventional commit messages
- Test all Chrome extension functionality
- Maintain responsive design principles

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

### Common Issues

- **Timer not appearing**: Check console logs for injection errors
- **Data not saving**: Verify Chrome storage permissions
- **Extension not loading**: Ensure all files are in dist folder

### Getting Help

- Check the Issues section for known problems
- Enable detailed logging and share console output
- Provide your Chrome version and extension version

## 🔮 Roadmap

- [ ] Firefox support with Manifest V3
- [ ] Advanced analytics and reporting
- [ ] Team collaboration features
- [ ] Data synchronization across devices
- [ ] Enhanced filtering and search capabilities

## Workflow

1. When the audit page is loaded (`https://app.outlier.ai/en/expert/outlieradmin/tools/chat_bulk_audit/*`), this is when the timer starts and all the task audit data is being populated.
2. The extensions parses project name, id, attempt id, operation id, and max audit time.
3. During the audit, if the audit operation is cancelled for any reason, the timer stops with the final data being saved.
4. Otherwise, the timer continues until the user reaches `https://app.outlier.ai/corp-api/chatBulkAudit/complete/*`. This is when the audit is completed, but not fully submitted.
5. Then if the user reaches `https://app.outlier.ai/corp-api/qm/operations/<id>/transition/*`, this means the audit has reached it's final stage now and the final audit information can be saved.

## How data is being extracted

Each value is extracted from response nodes that are being intercepted.

- **Project name:** `response.nodes?.[0]?.qaOperation?.name` and the actual project name part extracted with `/\)\s+(.*?)\s+-/` regex pattern.
- **Project ID:** `response.nodes?.[0]?.qaOperation?.project`.
- **Attempt ID:** `response.auditedEntityContext.entityAttemptId`.
- **Operation ID:**  `response.nodes?.[0]?.qaOperation?.stateMachine.context.operationId`.
- **Max audit time:** `response.nodes?.[0]?.qaOperation?.maxTimeRequired`.
