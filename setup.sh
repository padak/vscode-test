#!/bin/bash

echo "🚀 Setting up Padák Super Extension..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Open this folder in VS Code"
echo "2. Press F5 to run the extension"
echo "3. In the new window, open Command Palette (Ctrl+Shift+P)"
echo "4. Type 'Say Hello Padák' and select the command"
echo "5. Click the button and enjoy! 🎉"
echo ""
echo "Padák je super! 🚀" 