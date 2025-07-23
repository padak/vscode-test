# 📦 Extension Builds

This folder contains all packaged VSIX files for the Keboola Data Engineering Booster extension.

## 🚀 Building

To create a new build:

```bash
npm run package
```

This command will:
1. Compile TypeScript files (`npm run compile`)
2. Package the extension using `vsce package --out builds/`
3. Create a new `.vsix` file in this builds folder

## 📋 Build History

| Version | File Size | Release Date | Key Features |
|---------|-----------|--------------|-------------|
| 3.1.4   | 372KB     | 2025-07-21   | 🐛 CRITICAL FIX: Extension icon display - added root-level icon field for proper VS Code Extensions view branding |
| 3.1.3   | 372KB     | 2025-07-21   | 🎨 MAJOR REBRANDING: "Storage API Explorer" → "Data Engineering Booster" with blue Keboola head icon |
| 3.1.2   | 360KB     | 2025-07-21   | 🐛 CRITICAL FIX: Unified configuration storage system - resolved Jobs API 401 errors by eliminating dual settings |
| 3.1.1   | 358KB     | 2025-07-21   | 🔍 DEBUG: Enhanced logging for Jobs API troubleshooting with comprehensive request/response analysis |
| 3.1.0   | 352KB     | 2025-07-21   | 🚀 MAJOR: Complete Jobs Monitoring System with real-time tracking, smart filtering, and Queue API integration |
| 3.0.0   | 317KB     | 2025-07-21   | 🎉 MAJOR: Added Configurations section with branches, components, JSON viewer, and metadata panels |
| 2.8.1   | 284KB     | 2025-07-21   | FIXED: Export settings messages now appear in correct section (not near API token) |
| 2.8.0   | 282KB     | 2025-07-21   | NEW: Configurable table naming (short names like "weather.csv" vs full "in.c-data.weather.csv") |
| 2.7.0   | 275KB     | 2025-07-21   | MAJOR: Workspace-based exports (no file dialogs, automatic directory structure) |
| 2.6.5   | 269KB     | 2025-07-21   | FIXED: Column display (undefined names) and blank refresh tab issues |
| 2.6.4   | 268KB     | 2025-07-21   | UI: Renamed "Export Schema Only" → "Export Table Metadata" buttons |
| 2.6.3   | 266KB     | 2025-07-21   | MAJOR: Schema export via Storage API (fixed CLI JSON parse errors) |
| 2.6.2   | 264KB     | 2025-07-21   | FIXED: Schema export functionality (removed invalid --format flags) |
| 2.6.1   | 265KB     | 2025-07-21   | Extended message display duration (+2s for better readability) |
| 2.6.0   | 264KB     | 2025-07-21   | FIXED: Test Connection message positioning (appears below button) |
| 2.5.6   | 263KB     | 2025-07-21   | Debug enhancement for Test Connection investigation |
| 2.5.5   | 263KB     | 2025-07-21   | Debug build for Test Connection troubleshooting (overwritten) |
| 2.5.4   | 262KB     | 2025-07-21   | Working Test Connection with token validation |
| 2.5.3   | 265KB     | 2025-07-21   | UI consistency fixes, refresh buttons |
| 2.5.2   | 261KB     | 2025-07-21   | Stage export fixes, empty table handling |
| 2.5.1   | 259KB     | 2025-07-21   | Stage detail panels and export |
| 2.5.0   | 257KB     | 2025-07-21   | Complete stage functionality |
| 2.4.4   | 243KB     | 2025-07-21   | Bucket export logging fixes |
| 2.4.3   | 241KB     | 2025-07-21   | Bucket export CLI command fixes |
| 2.4.2   | 240KB     | 2025-07-21   | Bucket export UI addition |
| 2.4.1   | 236KB     | 2025-07-21   | Row limit and header controls |
| 2.4.0   | 233KB     | 2025-07-21   | Dual row limits (preview/export) |

## 🔧 Installation

To install any build:

```bash
# For latest version (3.1.4+)
code --install-extension builds/keboola-data-engineering-booster-3.1.4.vsix

# For legacy versions (2.x - 3.1.2)
code --install-extension builds/keboola-storage-api-explorer-VERSION.vsix
```

Or via VS Code:
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Select the desired `.vsix` file

## 📁 Folder Structure

```
builds/
├── README.md (this file)
├── keboola-storage-api-explorer-2.0.0.vsix
├── keboola-storage-api-explorer-2.0.1.vsix
├── ...
├── keboola-storage-api-explorer-3.1.2.vsix
├── keboola-data-engineering-booster-3.1.3.vsix
└── keboola-data-engineering-booster-3.1.4.vsix (latest)
```

## 🎯 Latest Build

**Current Version:** `3.1.4`
**File:** `keboola-data-engineering-booster-3.1.4.vsix`
**Size:** 372KB
**Features:** 🐛 CRITICAL FIX: Extension icon display - blue Keboola head now properly shows in VS Code Extensions view and marketplace

## ⚙️ Build Configuration

The build process is configured in `package.json`:

```json
{
  "scripts": {
    "package": "npm run compile && vsce package --out builds/"
  }
}
```

This ensures all future builds are automatically placed in this folder.

## 🎨 Version 3.1.x Highlights - The Data Engineering Booster Era

### **🎯 Major Rebranding (v3.1.3)**
- **Extension Name**: `keboola-storage-api-explorer` → `keboola-data-engineering-booster`
- **Display Name**: "Keboola Storage API Explorer" → "Keboola Data Engineering Booster"
- **Professional Identity**: Name now reflects comprehensive data engineering capabilities
- **Visual Branding**: Blue Keboola head icon for consistent brand experience

### **🔧 Jobs Monitoring System (v3.1.0)**
- **Real-Time Tracking**: Monitor running, failed, and completed jobs
- **Smart Filtering**: View jobs by status, component, or time period  
- **Queue API Integration**: Direct connection to Keboola's job queue
- **Rich Details**: Comprehensive job information with logs and metadata

### **⚙️ Technical Excellence (v3.1.1-3.1.2)**
- **Debug Logging**: Enhanced troubleshooting capabilities
- **Unified Authentication**: Single configuration system across all sections
- **API Consistency**: All sections (Storage, Configurations, Jobs) use unified settings

### **🎨 Complete Platform (v3.0.0 Foundation)**
- **Storage Explorer**: Browse buckets, tables, and data with rich metadata
- **Configurations Management**: Navigate branches, components, and configurations
- **Unified Interface**: Single Activity Bar view for all Keboola functionality

## 🚀 Evolution Timeline

The extension has evolved from a simple storage browser to a comprehensive data engineering platform:

1. **v2.x Era**: Storage-focused with export capabilities
2. **v3.0.0**: Added Configurations management
3. **v3.1.0**: Introduced Jobs monitoring
4. **v3.1.3**: Professional rebranding as "Data Engineering Booster"
5. **v3.1.4**: Complete visual branding with proper icon display

## 🎯 Why "Data Engineering Booster"?

- **🔧 Beyond Storage**: Manages Storage + Configurations + Jobs monitoring
- **⚡ Productivity Focus**: "Booster" emphasizes workflow acceleration and efficiency
- **🚀 Professional Tool**: Reflects enterprise-level data engineering capabilities
- **🎨 Consistent Branding**: Aligns with Keboola's modern visual identity 