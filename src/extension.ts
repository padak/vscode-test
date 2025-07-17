import * as vscode from 'vscode';

class PadakTreeProvider implements vscode.TreeDataProvider<PadakItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PadakItem | undefined | null | void> = new vscode.EventEmitter<PadakItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PadakItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: PadakItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: PadakItem): Thenable<PadakItem[]> {
        if (!element) {
            return Promise.resolve([
                new PadakItem('🐙 Launch Keboola Panel', 'Click to open the Padák panel', vscode.TreeItemCollapsibleState.None, 'padak.sayHello'),
                new PadakItem('📖 About Keboola', 'Padák je super extension info', vscode.TreeItemCollapsibleState.None),
                new PadakItem('💙 Status', 'Keboola extension is active and ready!', vscode.TreeItemCollapsibleState.None)
            ]);
        }
        return Promise.resolve([]);
    }
}

class PadakItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly commandId?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        if (commandId) {
            this.command = {
                command: commandId,
                title: label
            };
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Padák Super Extension is now active!');

    // Register the tree data provider
    const treeDataProvider = new PadakTreeProvider();
    vscode.window.createTreeView('padak-view', {
        treeDataProvider: treeDataProvider
    });

    // Register the command
    let disposable = vscode.commands.registerCommand('padak.sayHello', () => {
        // Create and show WebView panel
        const panel = vscode.window.createWebviewPanel(
            'padakSuper', // Identifies the type of the webview. Used internally
            'Padák je super!', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true // Enable JavaScript in the webview
            }
        );

        // Set the HTML content for the webview
        panel.webview.html = getWebviewContent();

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            (message: { command: string; text: string }) => {
                switch (message.command) {
                    case 'showMessage':
                        vscode.window.showInformationMessage(message.text);
                        console.log('Message from webview:', message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Padák je super!</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            border: 1px solid rgba(255, 255, 255, 0.18);
        }
        
        h1 {
            margin-bottom: 2rem;
            font-size: 2rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .button {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            border: none;
            color: white;
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px 0 rgba(31, 38, 135, 0.4);
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px 0 rgba(31, 38, 135, 0.6);
        }
        
        .button:active {
            transform: translateY(0);
        }
        
        .message {
            margin-top: 2rem;
            font-size: 1.2rem;
            font-weight: bold;
            opacity: 0;
            transition: opacity 0.5s ease;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        
        .message.show {
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐙 Keboola Padák Test</h1>
        <button class="button" id="padakButton">Click me!</button>
        <div class="message" id="message"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('padakButton').addEventListener('click', function() {
            const message = 'Padák je super! 🎉';
            
            // Show message in the webview
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.classList.add('show');
            
            // Also show VS Code notification and log to console
            vscode.postMessage({
                command: 'showMessage',
                text: message
            });
            
            console.log(message);
            
            // Show alert as well
            alert(message);
        });
    </script>
</body>
</html>`;
}

export function deactivate() {} 