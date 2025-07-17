# 📦 VS Code Extension Distribution Guide

## 🌟 Method 1: VS Code Marketplace (Public Distribution)

### Prerequisites:
1. **Azure DevOps Account** (free at https://dev.azure.com)
2. **Personal Access Token** with Marketplace permissions
3. **Publisher Account** on VS Code Marketplace

### Steps:
1. Install VSCE (Visual Studio Code Extension manager):
   ```bash
   npm install -g vsce
   ```

2. Create a publisher account:
   ```bash
   vsce create-publisher YourPublisherName
   ```

3. Login with your token:
   ```bash
   vsce login YourPublisherName
   ```

4. Update package.json with publisher info:
   ```json
   {
     "publisher": "YourPublisherName",
     "repository": {
       "type": "git",
       "url": "https://github.com/yourusername/your-repo.git"
     }
   }
   ```

5. Publish:
   ```bash
   vsce publish
   ```

---

## 📁 Method 2: VSIX Package (Private/Manual Distribution)

### Create VSIX package:
```bash
npm install -g vsce
vsce package
```

### This creates a `.vsix` file that users can install:
1. **Via Command Palette:**
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
   - Type "Extensions: Install from VSIX"
   - Select the `.vsix` file

2. **Via Command Line:**
   ```bash
   code --install-extension padak-super-extension-0.0.1.vsix
   ```

---

## 🏢 Method 3: Private Extension Gallery

For organizations, you can set up a private gallery using:
- **Azure DevOps Extensions**
- **Private VS Code Extension Gallery**

---

## 🔧 Method 4: Direct Source Distribution

Share the source code and let users:
1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` in VS Code to load in development mode

---

## 📋 Preparation Checklist

Before distributing, ensure:
- [ ] Update version in `package.json`
- [ ] Add proper description and keywords
- [ ] Include license file
- [ ] Add icon (128x128 PNG recommended)
- [ ] Test on different VS Code versions
- [ ] Update README with installation instructions

---

## 🎯 Recommended for Your Extension

For **Keboola Padák Extension**, I recommend:
1. **VSIX package** for internal testing/distribution
2. **VS Code Marketplace** if you want it publicly available 