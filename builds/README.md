# 📦 Extension Builds

This folder contains all packaged VSIX files for the Keboola Storage API Explorer extension.

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
| 2.7.0   | 275KB     | 2025-01-21   | MAJOR: Workspace-based exports (no file dialogs, automatic directory structure) |
| 2.6.5   | 269KB     | 2025-01-21   | FIXED: Column display (undefined names) and blank refresh tab issues |
| 2.6.4   | 268KB     | 2025-01-21   | UI: Renamed "Export Schema Only" → "Export Table Metadata" buttons |
| 2.6.3   | 266KB     | 2025-01-21   | MAJOR: Schema export via Storage API (fixed CLI JSON parse errors) |
| 2.6.2   | 264KB     | 2025-01-21   | FIXED: Schema export functionality (removed invalid --format flags) |
| 2.6.1   | 265KB     | 2025-01-21   | Extended message display duration (+2s for better readability) |
| 2.6.0   | 264KB     | 2025-01-21   | FIXED: Test Connection message positioning (appears below button) |
| 2.5.6   | 263KB     | 2025-01-21   | Debug enhancement for Test Connection investigation |
| 2.5.5   | 263KB     | 2025-01-21   | Debug build for Test Connection troubleshooting (overwritten) |
| 2.5.4   | 262KB     | 2025-01-21   | Working Test Connection with token validation |
| 2.5.3   | 265KB     | 2025-01-21   | UI consistency fixes, refresh buttons |
| 2.5.2   | 261KB     | 2025-01-21   | Stage export fixes, empty table handling |
| 2.5.1   | 259KB     | 2025-01-21   | Stage detail panels and export |
| 2.5.0   | 257KB     | 2025-01-21   | Complete stage functionality |
| 2.4.4   | 243KB     | 2025-01-21   | Bucket export logging fixes |
| 2.4.3   | 241KB     | 2025-01-21   | Bucket export CLI command fixes |
| 2.4.2   | 240KB     | 2025-01-21   | Bucket export UI addition |
| 2.4.1   | 236KB     | 2025-01-21   | Row limit and header controls |
| 2.4.0   | 233KB     | 2025-01-21   | Dual row limits (preview/export) |

## 🔧 Installation

To install any build:

```bash
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
└── keboola-storage-api-explorer-2.5.3.vsix (latest)
```

## 🎯 Latest Build

**Current Version:** `2.7.0`
**File:** `keboola-storage-api-explorer-2.7.0.vsix`
**Size:** 275KB
**Features:** MAJOR workspace-based export system with automatic directory structure

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