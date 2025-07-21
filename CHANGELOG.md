# Changelog

All notable changes to the Keboola Storage API Explorer extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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