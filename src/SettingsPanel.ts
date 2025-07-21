import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';

interface CloudProvider {
    id: string;
    name: string;
    icon: string;
    regions: {
        name: string;
        flag: string;
        url: string;
    }[];
}

interface SettingsData {
    apiUrl: string;
    token: string;
    previewRowLimit: number;
    exportRowLimit: number;
    lastUsed?: string;
}

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private readonly context: vscode.ExtensionContext;

    private readonly cloudProviders: CloudProvider[] = [
        {
            id: 'azure',
            name: 'Azure',
            icon: 'azure.svg',
            regions: [
                {
                    name: 'Europe',
                    flag: '🇪🇺',
                    url: 'https://connection.north-europe.azure.keboola.com/'
                }
            ]
        },
        {
            id: 'aws',
            name: 'AWS',
            icon: 'aws.svg',
            regions: [
                {
                    name: 'Europe',
                    flag: '🇪🇺',
                    url: 'https://connection.eu-central-1.keboola.com/'
                },
                {
                    name: 'United States',
                    flag: '🇺🇸',
                    url: 'https://connection.keboola.com/'
                }
            ]
        },
        {
            id: 'gcp',
            name: 'Google Cloud',
            icon: 'google.svg',
            regions: [
                {
                    name: 'Europe',
                    flag: '🇪🇺',
                    url: 'https://connection.europe-west3.gcp.keboola.com/'
                },
                {
                    name: 'United States',
                    flag: '🇺🇸',
                    url: 'https://connection.us-east4.gcp.keboola.com/'
                }
            ]
        },
        {
            id: 'canary',
            name: 'Canary (DEV)',
            icon: '',
            regions: [
                {
                    name: 'Development',
                    flag: '🧪',
                    url: 'http://connection.canary-orion.keboola.dev/'
                }
            ]
        }
    ];

    public static createOrShow(context: vscode.ExtensionContext, extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'keboolaSettings',
            'Keboola Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, context, extensionUri);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        private readonly extensionUri: vscode.Uri
    ) {
        this.panel = panel;
        this.context = context;

        this.updateContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'selectProvider':
                        await this.handleProviderSelection(message.url);
                        break;
                    case 'saveToken':
                        await this.handleTokenSave(message.token);
                        break;
                    case 'saveRowLimits':
                        await this.handleRowLimitsSave(message.previewRowLimit, message.exportRowLimit);
                        break;
                    case 'testConnection':
                        await this.handleTestConnection();
                        break;
                }
            },
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private async handleProviderSelection(url: string): Promise<void> {
        try {
            // Save the selected URL
            await this.context.globalState.update('keboola.apiUrl', url);
            
            // Mark as last used
            await this.context.globalState.update('keboola.lastUsedUrl', url);
            
            // Refresh the content to show the selection
            this.updateContent();
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'info',
                text: `Selected: ${url}`
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save URL: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleTokenSave(token: string): Promise<void> {
        try {
            if (!token || token.length < 10) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Token seems too short. Please check your token.'
                });
                return;
            }

            // Save the token
            await this.context.globalState.update('keboola.token', token);
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: 'Token saved successfully!'
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save token: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleRowLimitsSave(previewRowLimit: number, exportRowLimit: number): Promise<void> {
        try {
            // Validate preview row limit
            if (!previewRowLimit || previewRowLimit <= 0 || previewRowLimit > 10000) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Preview row limit must be between 1 and 10,000'
                });
                return;
            }

            // Validate export row limit
            if (!exportRowLimit || exportRowLimit <= 0 || exportRowLimit > 1000000) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Export row limit must be between 1 and 1,000,000'
                });
                return;
            }

            // Save both row limits
            await this.context.globalState.update('keboola.previewRowLimit', previewRowLimit);
            await this.context.globalState.update('keboola.exportRowLimit', exportRowLimit);
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Row limits saved! Preview: ${previewRowLimit.toLocaleString()}, Export: ${exportRowLimit.toLocaleString()}`
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save row limits: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleTestConnection(): Promise<void> {
        try {
            const apiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            const token = this.context.globalState.get<string>('keboola.token');

            if (!apiUrl || !token) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Please select a provider and enter your API token first'
                });
                return;
            }

            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'info',
                text: 'Testing connection...'
            });

            const api = new KeboolaApi({ apiUrl, token });
            const isConnected = await api.testConnection();

            if (isConnected) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'success',
                    text: '✅ Connection successful!'
                });
            } else {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: '❌ Connection failed. Please check your credentials.'
                });
            }

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private getCurrentSettings(): SettingsData {
        return {
            apiUrl: this.context.globalState.get<string>('keboola.apiUrl') || '',
            token: this.context.globalState.get<string>('keboola.token') || '',
            previewRowLimit: this.context.globalState.get<number>('keboola.previewRowLimit') || 100,
            exportRowLimit: this.context.globalState.get<number>('keboola.exportRowLimit') || 2000,
            lastUsed: this.context.globalState.get<string>('keboola.lastUsedUrl')
        };
    }

    private updateContent(): void {
        this.panel.webview.html = this.getWebviewContent();
    }

    private getWebviewContent(): string {
        const settings = this.getCurrentSettings();
        
        // Generate provider cards
        const providerCards = this.cloudProviders.map(provider => {
            const regionsHtml = provider.regions.map(region => {
                const isLastUsed = settings.lastUsed === region.url;
                const isSelected = settings.apiUrl === region.url;
                
                return `
                    <div class="region-item ${isSelected ? 'selected' : ''}" 
                         onclick="selectProvider('${region.url}')" 
                         data-url="${region.url}">
                        <div class="region-content">
                            <span class="region-flag">${region.flag}</span>
                            <span class="region-name">${region.name}</span>
                            ${isLastUsed ? '<span class="last-used-badge">LAST USED</span>' : ''}
                        </div>
                        <div class="region-url">${region.url}</div>
                    </div>
                `;
            }).join('');

            const iconHtml = provider.icon ? 
                `<img src="${this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', provider.icon))}" alt="${provider.name}" class="provider-icon">` : 
                '<div class="provider-icon-placeholder">🧪</div>';

            return `
                <div class="provider-card">
                    <div class="provider-header">
                        ${iconHtml}
                        <h3 class="provider-name">${provider.name}</h3>
                    </div>
                    <div class="regions">
                        ${regionsHtml}
                    </div>
                </div>
            `;
        }).join('');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Keboola Settings</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 24px;
                    line-height: 1.6;
                }
                
                .settings-container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .section {
                    margin-bottom: 40px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 24px;
                }
                
                .section-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0 0 20px 0;
                    color: var(--vscode-editor-foreground);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    padding-bottom: 12px;
                }
                
                .provider-card {
                    margin-bottom: 20px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    overflow: hidden;
                }
                
                .provider-header {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                
                .provider-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 12px;
                }
                
                .provider-icon-placeholder {
                    width: 24px;
                    height: 24px;
                    margin-right: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                }
                
                .provider-name {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .regions {
                    background-color: var(--vscode-editor-background);
                }
                
                .region-item {
                    padding: 12px 16px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    transition: background-color 0.2s;
                }
                
                .region-item:last-child {
                    border-bottom: none;
                }
                
                .region-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .region-item.selected {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    border-left: 3px solid var(--vscode-charts-blue);
                }
                
                .region-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }
                
                .region-flag {
                    font-size: 16px;
                }
                
                .region-name {
                    font-weight: 500;
                }
                
                .last-used-badge {
                    background-color: var(--vscode-charts-orange);
                    color: white;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: 600;
                    margin-left: auto;
                }
                
                .region-url {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-left: 24px;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--vscode-editor-foreground);
                }
                
                .form-input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: 14px;
                    box-sizing: border-box;
                }
                
                .form-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }
                
                .form-help {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                    font-style: italic;
                }
                
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                    margin-right: 8px;
                }
                
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                
                .button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                
                .message {
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 16px;
                    border-left: 3px solid;
                }
                
                .message.success {
                    background-color: var(--vscode-diffEditor-insertedTextBackground);
                    border-color: var(--vscode-charts-green);
                    color: var(--vscode-editor-foreground);
                }
                
                .message.error {
                    background-color: var(--vscode-diffEditor-removedTextBackground);
                    border-color: var(--vscode-charts-red);
                    color: var(--vscode-editor-foreground);
                }
                
                .message.info {
                    background-color: var(--vscode-diffEditor-unchangedTextBackground);
                    border-color: var(--vscode-charts-blue);
                    color: var(--vscode-editor-foreground);
                }
                
                .form-row {
                    display: flex;
                    gap: 16px;
                    align-items: end;
                }
                
                .form-row .form-group {
                    flex: 1;
                    margin-bottom: 0;
                }
                
                .current-settings {
                    background-color: var(--vscode-inputOption-activeBorder);
                    border-left: 3px solid var(--vscode-charts-blue);
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .row-limits-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                @media (max-width: 600px) {
                    .row-limits-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="settings-container">
                <div id="messageContainer"></div>
                
                <div class="section">
                    <h2 class="section-title">🔌 Connection Settings</h2>
                    
                    <div class="current-settings" id="currentSettings">
                        <strong>Current:</strong> ${settings.apiUrl || 'No provider selected'} | 
                        Token: ${settings.token ? '****** (saved)' : 'Not set'} | 
                        Preview Limit: ${settings.previewRowLimit.toLocaleString()} | 
                        Export Limit: ${settings.exportRowLimit.toLocaleString()}
                    </div>
                    
                    <h3 style="margin-bottom: 16px; color: var(--vscode-editor-foreground);">Select Cloud Provider & Region:</h3>
                    
                    ${providerCards}
                    
                    <div class="form-group">
                        <label class="form-label" for="tokenInput">🔑 API Token:</label>
                        <input type="password" 
                               id="tokenInput" 
                               class="form-input" 
                               placeholder="Enter your Keboola Storage API token..."
                               value="${settings.token}">
                    </div>
                    
                    <div style="display: flex; gap: 12px;">
                        <button class="button" onclick="saveToken()">💾 Save Token</button>
                        <button class="button secondary" onclick="testConnection()">🔧 Test Connection</button>
                    </div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">⚙️ Row Limits Configuration</h2>
                    
                    <div class="row-limits-grid">
                        <div class="form-group">
                            <label class="form-label" for="previewRowLimitInput">👁️ Preview Row Limit:</label>
                            <input type="number" 
                                   id="previewRowLimitInput" 
                                   class="form-input" 
                                   placeholder="100"
                                   min="1"
                                   max="10000"
                                   value="${settings.previewRowLimit}">
                            <div class="form-help">Smaller limit for faster loading of samples</div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="exportRowLimitInput">📤 Export Row Limit:</label>
                            <input type="number" 
                                   id="exportRowLimitInput" 
                                   class="form-input" 
                                   placeholder="2000"
                                   min="1"
                                   max="1000000"
                                   value="${settings.exportRowLimit}">
                            <div class="form-help">Higher limit allowed, but large tables may take longer to download</div>
                        </div>
                    </div>
                    
                    <button class="button" onclick="saveRowLimits()">💾 Save Row Limits</button>
                    
                    <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        💡 <strong>Preview Limit:</strong> Used for "Preview Sample" actions (API calls)<br>
                        💡 <strong>Export Limit:</strong> Default for CSV exports (can be overridden per export)
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function selectProvider(url) {
                    vscode.postMessage({
                        command: 'selectProvider',
                        url: url
                    });
                }
                
                function saveToken() {
                    const token = document.getElementById('tokenInput').value;
                    if (!token) {
                        showMessage('error', 'Please enter an API token');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'saveToken',
                        token: token
                    });
                }
                
                function saveRowLimits() {
                    const previewRowLimit = parseInt(document.getElementById('previewRowLimitInput').value);
                    const exportRowLimit = parseInt(document.getElementById('exportRowLimitInput').value);
                    
                    if (isNaN(previewRowLimit) || previewRowLimit <= 0) {
                        showMessage('error', 'Please enter a valid preview row limit');
                        return;
                    }
                    
                    if (isNaN(exportRowLimit) || exportRowLimit <= 0) {
                        showMessage('error', 'Please enter a valid export row limit');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'saveRowLimits',
                        previewRowLimit: previewRowLimit,
                        exportRowLimit: exportRowLimit
                    });
                }
                
                function testConnection() {
                    vscode.postMessage({
                        command: 'testConnection'
                    });
                }
                
                function showMessage(type, text) {
                    const container = document.getElementById('messageContainer');
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`message \${type}\`;
                    messageDiv.textContent = text;
                    
                    container.innerHTML = '';
                    container.appendChild(messageDiv);
                    
                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        if (container.contains(messageDiv)) {
                            container.removeChild(messageDiv);
                        }
                    }, 5000);
                }
                
                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showMessage':
                            showMessage(message.type, message.text);
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    public dispose(): void {
        SettingsPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 