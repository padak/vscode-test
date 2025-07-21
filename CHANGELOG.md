# Changelog

All notable changes to the Keboola Storage API Explorer extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.1] - 2025-01-21

### 🐛 Critical Fixes
- **Enhanced Export Logging**: Output panel now automatically opens during exports for better visibility
- **Honest Progress Feedback**: Removed fake progress percentages, now shows real CLI output
- **Better User Guidance**: Progress messages direct users to output panel for detailed logs
- **Export Transparency**: Shows exact `kbc` command being executed in logs
- **Duration Tracking**: Displays actual export time completion
- **Improved Success Actions**: Export completion offers "Open File" and "Show in Output" options

### ✨ Logging Improvements
- **Auto-Show Output Panel**: Automatically opens "Keboola Storage Explorer" output when export starts
- **Rich Emoji Logging**: Enhanced log readability with icons (📁📊📋⏳🔧✅❌🎉)
- **Command Visibility**: Logs show exact CLI command: `kbc remote table download ... --limit X --header`
- **Real-time CLI Output**: Progress bar shows actual output from `kbc` command (truncated)
- **Error Visibility**: Output panel auto-opens on export failures for debugging

### 🎯 Progress Bar Fixes
- **No More Fake Progress**: Removed misleading manual increments (10%, 60%, etc.)
- **Indeterminate Progress**: Shows spinning indicator with meaningful messages
- **CLI Output Integration**: Displays real `kbc` command output in progress (truncated to 40 chars)
- **Clear Status Messages**: "Downloading unlimited rows with headers... (see Output panel for details)"
- **Completion Feedback**: "Export completed successfully!" with duration

### 📊 Enhanced Export Experience
- **Automatic Logging**: Export operations immediately show output panel
- **Command Transparency**: Users can see exactly what CLI command is running
- **Duration Display**: "✅ Table exported successfully in 12.3s"
- **Success Options**: Notification provides "Open File" (opens CSV) and "Show in Output" buttons
- **Error Debugging**: Failed exports automatically show output panel with error details

### 🔧 Technical Improvements
- **Honest UX**: No more misleading progress bars that don't reflect actual CLI progress
- **Real CLI Integration**: Progress updates come from actual `kbc` command stdout
- **Output Channel Management**: Proper show/hide behavior for user guidance
- **Time Tracking**: Actual start/end time measurement for export operations
- **User Choice Actions**: Success notifications with actionable buttons

### 📦 Package Details
- **Extension Size**: 229.99KB (73 files)
- **Output Panel**: "Keboola Storage Explorer" channel for all export logs
- **CLI Reality**: Acknowledges that `kbc` doesn't provide real-time progress API
- **User Experience**: Focuses on transparency and useful feedback over fake progress

### 💡 User Impact
- **No More Confusion**: Users understand export is happening via clear logging
- **Better Debugging**: Export issues are immediately visible in output panel
- **Command Learning**: Users can see exact CLI commands for learning/debugging
- **Realistic Expectations**: Progress indicates activity without fake percentages
- **Improved Workflow**: Quick access to exported files and detailed logs

---

## [2.4.0] - 2025-01-21

### 🚀 Major Features
- **Unlimited Export Support**: Set row limit to 0 for unlimited exports (no --limit flag)
- **Header Control**: Configurable CSV header inclusion with per-export override
- **Enhanced Export Prompts**: Smart prompts for both row limit and header settings
- **Improved CLI Command Construction**: Proper flag handling based on user preferences

### ✨ Added
- **Unlimited Exports**: Row limit 0 = no --limit flag in CLI command (download full tables)
- **Header Control Setting**: New checkbox "Include headers by default" in Settings panel
- **Dual Export Prompts**: Per-export overrides for both row limit (0-10M) and headers (Yes/No)
- **Smart CLI Commands**: Conditional --header and --limit flags based on settings
- **Enhanced Settings Display**: Export settings shown in table and bucket detail panels
- **Improved Validation**: Row limit accepts 0 (unlimited) plus positive integers

### 🔧 Settings Panel Changes
- **Export Settings Section**: Separated preview and export configurations
- **Header Checkbox**: "Include headers by default" with clear labeling
- **Row Limit Input**: Accepts 0 for unlimited exports (0-10,000,000 range)
- **Grid Layout**: Responsive design with separate sections for preview/export
- **Current Status Display**: Shows "unlimited" when row limit is 0

### 📤 Export Workflow Enhancements
#### **Per-Export Prompts:**
1. **Row Limit Prompt**: "Enter row limit (0 = unlimited, blank = use default: X)"
2. **Headers Prompt**: "Include headers? (Yes/No, blank = use default: Y/N)"
3. **Smart Defaults**: Uses settings from configuration panel
4. **Override Capability**: Per-export customization without changing defaults

#### **CLI Command Construction:**
```bash
kbc remote table download <table> --output <path> -t <token> -H <host>
[--limit <number>]  # Only if rowLimit > 0
[--header]          # Only if headers enabled
```

### 🎨 UI/UX Improvements
- **Table Detail Panels**: Display current export settings with unlimited support
- **Bucket Detail Panels**: Show export defaults and header settings
- **Settings Panel**: Clean grid layout with separate preview/export sections
- **Export Feedback**: Progress messages include header status ("with headers"/"without headers")
- **Dynamic Updates**: Settings refresh when panels reopen

### 📊 Export Features
- **Table Export**: Prompts for limit + headers, uses optimized CLI command
- **Bucket Export**: Applies settings to all tables in bucket
- **Stage Export**: Consistent settings across all buckets/tables in stage
- **Schema Export**: Unchanged, still available as separate option
- **Progress Tracking**: Enhanced messages showing export configuration

### 🎯 Export Behavior Examples
#### **Unlimited Export (rowLimit = 0):**
```bash
kbc remote table download in.c-main.customers --output ./customers.csv --header -t [token] -H [host]
# No --limit flag = download all rows
```

#### **Limited Export with Headers (rowLimit = 5000, headers = true):**
```bash
kbc remote table download in.c-main.orders --output ./orders.csv --limit 5000 --header -t [token] -H [host]
```

#### **Limited Export without Headers (rowLimit = 1000, headers = false):**
```bash
kbc remote table download in.c-main.products --output ./products.csv --limit 1000 -t [token] -H [host]
# No --header flag = no column names
```

### 🔧 Technical Improvements
- **ExportSettings Interface**: Structured settings with rowLimit and includeHeaders
- **Smart Command Builder**: buildDownloadCommand() with conditional flag logic
- **Enhanced Prompts**: promptForExportOverrides() with validation and defaults
- **Settings Integration**: Seamless connection between settings panel and export operations
- **Type Safety**: Proper TypeScript interfaces for export configurations

### 📦 Technical Details
- **Extension Size**: 227.84KB (73 files)
- **CLI Integration**: Optimized command construction for Keboola CLI
- **Settings Storage**: Per-connection header preferences in globalState
- **Validation**: Row limit 0-10,000,000 range with 0 = unlimited
- **User Experience**: Smart defaults with override capability

### 🔄 Migration & Compatibility
- **Settings Migration**: Existing users get default includeHeaders: true
- **Backward Compatible**: All existing export operations continue working
- **Enhanced Prompts**: Users see new header options in export workflows
- **CLI Commands**: Improved flag usage for better performance and accuracy

---

## [2.3.1] - 2025-01-21

### 🐛 Critical Fix
- **Fixed CLI Export Commands**: Corrected KBC CLI flags for table exports
  - Changed `--rows` → `--limit` (correct flag for row limiting)
  - Changed `--storage-api-token` → `-t` (correct short flag)
  - Changed `--storage-api-host` → `-H` (correct short flag)
- **Export Operations Now Work**: Table, bucket, and stage exports functional
- **Command Structure**: `kbc remote table download <table> -o <output> --limit <rows> -t <token> -H <host>`

### 📦 Technical
- Updated CLI command generation to use proper KBC CLI syntax
- Fixed authentication flag usage based on `kbc remote table download --help`
- Extension size: 223.89KB (73 files)

---

## [2.3.0] - 2025-01-21

### 🚀 Major Features
- **Dual Row Limits**: Separate preview (100) and export (2000) row limits for optimized performance
- **Export Progress Tracking**: Real-time progress bars and logging for all export operations
- **Schema-Only Exports**: Export table/bucket/stage metadata as JSON without data
- **Row Limit Override**: Per-export prompts to override default limits
- **Output Channel Logging**: Dedicated "Keboola Storage Explorer" output panel for operation logs

### ✨ Added
- Enhanced `SettingsPanel.ts` with dual row limit configuration (Preview: 100, Export: 2000)
- New export functions: `exportTable()`, `exportBucket()`, `exportStage()` with CLI integration
- Schema export functions: `exportTableSchema()`, `exportBucketSchema()`, `exportStageSchema()`
- Progress bars with detailed status: "Exported 3/15 tables (currently: table_name)"
- Row limit override prompts with validation (1-10,000,000 range)
- "Export Schema Only" button in table detail panels
- Output channel logging for all CLI operations and export tracking
- Real-time export completion notifications with file paths

### 🔧 Changed
- **BREAKING**: Split single `rowLimit` into `previewRowLimit` and `exportRowLimit`
- Settings panel now shows two separate row limit inputs with help text
- Table/bucket detail panels display both current limits prominently
- Preview Sample uses `previewRowLimit` (fast API calls)
- All exports use `exportRowLimit` or user override (CLI with progress)
- Export operations moved from API preview to proper CLI download
- Enhanced error handling with specific CLI error types

### 🗑️ Removed
- Single `rowLimit` configuration (replaced with dual limits)
- Simple file save dialog for exports (replaced with CLI-based exports)
- API-based exports for large data (now uses CLI for proper export)

### 🎯 Export Features
- **Table Export**: Individual table download with row limit override
- **Bucket Export**: All tables in bucket with subfolder organization
- **Stage Export**: All buckets/tables in stage with nested folder structure
- **Schema Export**: Metadata-only JSON files (.schema.json) with:
  - Table: columns, types, metadata, created/modified timestamps
  - Bucket: table list, descriptions, hierarchy
  - Stage: bucket list, organization structure

### 📊 Progress & Logging
- Real-time progress bars for multi-table exports
- Export completion logging to VS Code Output panel
- Detailed CLI command output capture ([STDOUT], [STDERR], [EXIT])
- Success notifications with exact file paths and row counts
- Operation tracking: "Exported 5/12 buckets (currently: bucket_name)"

### 🎨 UI/UX Improvements
- Settings panel grid layout for row limits (responsive design)
- Row limit help text: "Smaller limit for faster loading" / "Higher limit for downloads"
- Current limits display in all detail panels
- "Export Schema Only" secondary button styling
- Enhanced validation messages and user feedback

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.3.0`
- Extension size: 222.79KB (73 files)
- Enhanced CLI integration with proper timeout and error handling
- Improved TypeScript types for export options and CLI configurations
- Added output channel management and disposal
- Schema file format: `.schema.json` with ISO timestamps and export metadata

### 🔧 Settings Migration
- Automatic migration: old `rowLimit` → `previewRowLimit: 100, exportRowLimit: 2000`
- Settings stored per connection in `context.globalState`
- Preview: 1-10,000 rows (API optimization)
- Export: 1-1,000,000 rows (CLI capability)

---

## [2.2.0] - 2025-01-21

### 🚀 Major Features
- **New Settings Panel**: Complete in-extension settings UI with cloud provider selection
- **Cloud Provider Selection**: Visual cards for Azure, AWS, Google Cloud, and Canary (DEV)
- **Regional Configuration**: Support for EU/US regions with flag indicators and "LAST USED" badges
- **Unified Settings**: Combined connection setup and row limit configuration in one panel
- **Real-time Testing**: Built-in connection test with visual feedback

### ✨ Added
- `SettingsPanel.ts` - Modern WebView-based settings interface
- "Keboola: Settings" command accessible from activity bar and command palette
- Cloud provider icons integration (Azure, AWS, Google Cloud SVGs)
- Visual region selection with emoji flags (🇪🇺 🇺🇸 🧪)
- Connection testing with success/error feedback
- Real-time settings persistence to `context.globalState`
- Row limit configuration with validation (1-1,000,000)
- Current settings display at top of panel

### 🔧 Changed
- **BREAKING**: Removed old InputBox-based configuration flow
- Settings now stored in `context.globalState` instead of VS Code workspace configuration
- All components (API, CLI, panels) read settings from centralized location
- "Configure Connection" and "Set Row Limit" commands now open Settings panel
- Activity bar shows only Settings and Refresh buttons (simplified UI)
- Tree view displays "Configure in Settings" instead of generic error messages
- Table detail panels reference "Keboola: Settings" for row limit changes

### 🗑️ Removed
- Old `settings.ts` configuration system (InputBox prompts)
- VS Code workspace configuration dependencies
- Separate row limit command (now integrated in Settings)
- Multiple navigation buttons from activity bar (streamlined)

### 🎨 UI/UX Improvements
- Modern card-based provider selection interface
- Visual connection status with color-coded messages
- Auto-hiding success/error notifications (5-second timeout)
- Responsive form layouts with proper validation
- Professional styling using VS Code theme variables
- "LAST USED" badges for recently selected providers

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.2.0`
- Extension size: 213.71KB (73 files)
- Made `KeboolaApi.apiUrl` and `KeboolaApi.token` public readonly
- Centralized settings management through extension context
- Enhanced error handling with settings panel integration

### 🌐 Supported Cloud Providers
- **Azure**: Europe (North Europe)
- **AWS**: Europe (eu-central-1), United States (primary)
- **Google Cloud**: Europe (europe-west3), United States (us-east4)
- **Canary (DEV)**: Development environment

---

## [2.1.4] - 2025-01-21

### 🐛 Fixed
- **CRITICAL**: Fixed tree view registration for custom activity bar container
- Changed from `registerTreeDataProvider()` to `createTreeView()` which is required for custom activity bar containers
- Tree view now properly displays in the Keboola Storage panel instead of showing "no data provider registered"
- Added proper context subscriptions for tree view lifecycle management
- Restored `showCollapseAll: true` option for better UX

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.1.4`
- Extension size: 200.42KB (67 files)
- Fixed extension activation and tree view binding

---

## [2.1.3] - 2025-01-21

### 🐛 Fixed
- **CRITICAL**: Fixed Keboola logo display in VS Code activity bar
- Changed from SVG to PNG logo (`./media/logo.png`) due to VS Code security restrictions
- SVG files are not supported for activity bar icons - now using proper PNG format
- Keboola logo should now be visible in the left sidebar

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.1.3`
- Extension size: 200.07KB (67 files)
- Fixed icon format compatibility with VS Code security policies

---

## [2.1.2] - 2025-01-21

### 🐛 Fixed
- **CRITICAL**: Restored actual Keboola logo in VS Code activity bar
- Fixed generic database icon with proper Keboola SVG logo (`./media/logo.svg`)
- Extension now shows the distinctive Keboola branding in left sidebar

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.1.2`
- Extension size: 199.96KB (67 files)
- Restored proper logo reference instead of generic `$(database)` icon

---

## [2.1.1] - 2025-01-21

### 🐛 Fixed
- **CRITICAL**: Restored Keboola Storage icon in VS Code activity bar
- Extension now appears as dedicated panel in left sidebar (not buried in Explorer)
- Fixed missing activity bar container that was accidentally removed in 2.1.0

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.1.1`
- Extension size: 199.81KB (67 files)
- Restored `viewsContainers.activitybar` configuration

---

## [2.1.0] - 2025-01-21

### 🚀 Major Features
- **Preview Opens in Editor Tab**: Table preview now opens CSV data in a new VS Code editor tab with syntax highlighting instead of inline WebView display
- **Row Limit Display**: Added prominent current row limit display in table detail header with change instructions
- **No More Fake Data**: Completely removed all fake/demo data fallbacks - extension now shows real errors when API is unavailable

### ✨ Added
- CSV syntax highlighting for preview data in editor tabs
- Side-by-side editor view (preview opens beside table detail panel)
- Current row limit prominently displayed in table detail header
- Proper error messages when API connection is unavailable
- VS Code configuration-based settings storage
- Repository field in package.json

### 🔧 Changed
- **BREAKING**: Preview no longer displays in WebView - opens in new editor tab
- **BREAKING**: Removed all demo/fake data - requires real API connection
- Updated API endpoint to use proper Data Preview API: `GET /v2/storage/tables/{tableId}/data-preview?format=rfc&limit=<rowLimit>`
- Settings now stored in VS Code global configuration instead of extension context
- Improved error handling with specific KeboolaApiError messages
- Tree view ID changed from `keboolaStorageExplorer` to `keboolaExplorer`
- Commands restructured: `keboola.configure`, `keboola.refresh`, `keboola.setRowLimit`, `keboola.showTable`, `keboola.showBucket`

### 🗑️ Removed
- Fake data functions: `createFakeTablesData()`, `createFakeTableDetail()`, `createFakeBucketDetail()`, `createFakeTablePreview()`
- Demo data fallbacks in tree provider and detail panels
- Inline preview container and CSS styles from WebView
- Legacy CLI demo data from `kbcCli.ts`
- Activity bar container (moved to Explorer sidebar)

### 🐛 Fixed
- Preview endpoint now properly URL-encodes table IDs
- CSV data properly escaped and formatted
- Extension no longer falls back to fake data on API errors
- Row limit properly applied to both preview and export operations

### 📦 Technical
- Updated User-Agent to `Keboola-VSCode-Extension/2.1.0`
- Clean dependency management (removed unused packages)
- TypeScript compilation improvements
- Extension size optimized to 197.61KB

---

## [2.0.9] - 2025-01-21

### ✨ Added
- Enhanced table detail panel with real export functionality
- Improved CSV preview with proper data formatting
- Progress indicators for long-running operations

### 🔧 Changed
- Updated User-Agent string to version 2.0.9
- Improved error handling in table operations
- Better CSV escaping and formatting

### 🐛 Fixed
- Export functionality now works with real API data
- Preview data properly formatted as CSV
- Various stability improvements

---

## [2.0.8] - 2025-01-21

### ✨ Added
- Table detail panel with metadata display
- Bucket detail panel functionality
- Export table functionality
- Preview sample data capability
- Row limit configuration per project

### 🔧 Changed
- Enhanced tree view with better navigation
- Improved API error handling
- Better user feedback during operations

### 🐛 Fixed
- API connection stability improvements
- Tree view refresh functionality
- Various UI/UX improvements

---

## [2.0.7] - 2025-01-21

### ✨ Added
- Bucket detail panels with table listings
- Enhanced table metadata display
- Better error reporting

### 🔧 Changed
- Improved tree structure and navigation
- Better data formatting in panels
- Enhanced user experience

---

## [2.0.6] - 2025-01-21

### ✨ Added
- Real API integration with Keboola Storage API
- Authentication and connection management
- Tree view for browsing storage structure

### 🔧 Changed
- Complete rewrite from demo extension to functional API explorer
- Proper error handling and user feedback
- Professional UI/UX design

---

## [2.0.5] - 2025-01-21

### 🔧 Changed
- Core functionality improvements
- API integration enhancements

---

## [2.0.4] - 2025-01-21

### 🔧 Changed
- Foundation updates and improvements
- Initial API structure implementation

---

## [2.0.3] - 2025-01-21

### 🔧 Changed
- Development infrastructure improvements
- Code organization enhancements

---

## [2.0.2] - 2025-01-21

### 🔧 Changed
- Project structure improvements
- Development setup enhancements

---

## [2.0.1] - 2025-01-21

### 🔧 Changed
- Initial release preparations
- Basic functionality setup

---

## [2.0.0] - 2025-01-21

### 🚀 Initial Release
- **NEW**: Keboola Storage API Explorer extension for VS Code
- Tree view for browsing Keboola Storage buckets and tables
- Basic table and bucket detail viewing
- API connection management
- Foundation for future enhancements

### ✨ Features
- Browse Keboola Storage in VS Code sidebar
- View table and bucket metadata
- Configure API connections
- Basic data preview capabilities

---

## Legend

- 🚀 **Major Features** - Significant new functionality
- ✨ **Added** - New features and capabilities
- 🔧 **Changed** - Changes to existing functionality
- 🗑️ **Removed** - Removed features or code
- 🐛 **Fixed** - Bug fixes and improvements
- 📦 **Technical** - Technical/internal changes
- **BREAKING** - Breaking changes that may affect users 