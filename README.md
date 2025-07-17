# 🧪 Padák Super Extension

A minimal VS Code extension that demonstrates creating a WebView panel with a button that displays "Padák je super!" when clicked.

## 🚀 Features

- Registers a command `padak.sayHello` accessible via Command Palette
- Opens a beautiful WebView panel with a styled button
- When clicked, the button shows "Padák je super!" in multiple ways:
  - Alert popup
  - VS Code notification
  - Console log
  - Text display in the WebView

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Visual Studio Code](https://code.visualstudio.com/)
- [TypeScript](https://www.typescriptlang.org/) (installed globally or via npm)

## 🛠️ Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Compile the TypeScript code:**
   ```bash
   npm run compile
   ```

## 🧪 Testing the Extension

### Method 1: Using F5 (Recommended)

1. Open this project folder in VS Code
2. Press `F5` or go to `Run > Start Debugging`
3. This will open a new Extension Development Host window
4. In the new window, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
5. Type "Say Hello Padák" and select the command
6. A WebView panel will open with a button
7. Click the button to see "Padák je super!" message!

### Method 2: Using the Run and Debug Panel

1. Open the Run and Debug panel (`Ctrl+Shift+D` or `Cmd+Shift+D`)
2. Select "Run Extension" from the dropdown
3. Click the green play button
4. Follow steps 4-7 from Method 1

## 🎯 How to Use

1. Once the extension is running in the Extension Development Host:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open Command Palette
   - Type "Say Hello Padák" or "Padák"
   - Select the command from the list
   - A WebView panel titled "Padák je super!" will open
   - Click the "CLICK ME!" button
   - Enjoy the message in multiple forms! 🎉

## 📁 Project Structure

```
├── .vscode/
│   ├── launch.json          # Debug configuration
│   └── tasks.json           # Build tasks
├── src/
│   └── extension.ts         # Main extension code
├── package.json             # Extension manifest
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## 🔧 Development

- **Watch mode:** Run `npm run watch` to automatically compile changes
- **Manual compile:** Run `npm run compile` to build once
- **Debugging:** Use F5 to launch the extension in debug mode

## 🎨 Features Demonstrated

- ✅ Command registration
- ✅ WebView panel creation
- ✅ HTML/CSS/JavaScript in WebView
- ✅ Message passing between WebView and extension
- ✅ VS Code API integration
- ✅ Beautiful gradient UI design
- ✅ Responsive button interactions

## 🏗️ Built With

- TypeScript
- VS Code Extension API
- HTML/CSS/JavaScript for WebView
- Modern CSS with gradients and animations

---

**Happy coding! Padák je super! 🚀** 