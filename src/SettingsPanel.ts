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
    includeHeaders: boolean;
    exportFolderName: string;
    useShortTableNames: boolean;
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
                    case 'saveExportSettings':
                        await this.handleExportSettingsSave(message.exportRowLimit, message.includeHeaders, message.exportFolderName, message.useShortTableNames);
                        break;
                    case 'savePreviewSettings':
                        await this.handlePreviewSettingsSave(message.previewRowLimit);
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

    private async handlePreviewSettingsSave(previewRowLimit: number): Promise<void> {
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

            // Save preview row limit
            await this.context.globalState.update('keboola.previewRowLimit', previewRowLimit);
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Preview row limit saved: ${previewRowLimit.toLocaleString()}`
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save preview settings: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleExportSettingsSave(exportRowLimit: number, includeHeaders: boolean, exportFolderName: string, useShortTableNames: boolean): Promise<void> {
        try {
            // Validate export row limit (0 = unlimited is allowed)
            if (exportRowLimit < 0 || exportRowLimit > 10000000) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Export row limit must be 0 (unlimited) or between 1 and 10,000,000',
                    container: 'exportMessageContainer'
                });
                return;
            }

            // Validate export folder name
            if (!exportFolderName || exportFolderName.trim() === '') {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Export folder name cannot be empty',
                    container: 'exportMessageContainer'
                });
                return;
            }

            // Save export settings
            await this.context.globalState.update('keboola.exportRowLimit', exportRowLimit);
            await this.context.globalState.update('keboola.includeHeaders', includeHeaders);
            await this.context.globalState.update('keboola.exportFolderName', exportFolderName.trim());
            await this.context.globalState.update('keboola.useShortTableNames', useShortTableNames);
            
            const limitText = exportRowLimit === 0 ? 'unlimited' : exportRowLimit.toLocaleString();
            const headersText = includeHeaders ? 'included' : 'excluded';
            const namingText = useShortTableNames ? 'short names' : 'full names';
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Export settings saved! Folder: "${exportFolderName.trim()}", Limit: ${limitText}, Headers: ${headersText}, Table names: ${namingText}`,
                container: 'exportMessageContainer'
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save export settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                container: 'exportMessageContainer'
            });
        }
    }

    private async handleTestConnection(): Promise<void> {
        console.log('HandleTestConnection called');
        try {
            const apiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            const token = this.context.globalState.get<string>('keboola.token');
            console.log('API URL:', apiUrl ? 'set' : 'not set');
            console.log('Token:', token ? 'set' : 'not set');

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

            console.log('Creating KeboolaApi instance with URL:', apiUrl);
            const api = new KeboolaApi({ apiUrl, token });
            console.log('KeboolaApi instance created, calling testConnection...');
            const result = await api.testConnection();
            console.log('testConnection result:', result);

            if (result.success && result.tokenInfo) {
                // Extract useful information from token verification
                const tokenDetails = result.tokenInfo;
                const projectName = tokenDetails.owner?.name || 'Unknown Project';
                const tokenDescription = tokenDetails.description || 'No description';
                const expiresAt = tokenDetails.expires ? new Date(tokenDetails.expires).toLocaleDateString() : 'Never';
                
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'success',
                    text: `✅ Connection successful!<br>
                           📊 Project: ${projectName}<br>
                           🏷️ Token: ${tokenDescription}<br>
                           ⏰ Expires: ${expiresAt}`
                });
            } else {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: `❌ Connection failed: ${result.error || 'Please check your credentials.'}`
                });
            }

        } catch (error) {
            console.error('Test connection error:', error);
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private getCurrentSettings(): SettingsData {
        return {
            apiUrl: this.context.globalState.get<string>('keboola.apiUrl') || '',
            token: this.context.globalState.get<string>('keboola.token') || '',
            previewRowLimit: this.context.globalState.get<number>('keboola.previewRowLimit') || 100,
            exportRowLimit: this.context.globalState.get<number>('keboola.exportRowLimit') || 2000,
            includeHeaders: this.context.globalState.get<boolean>('keboola.includeHeaders') ?? true,
            exportFolderName: this.context.globalState.get<string>('keboola.exportFolderName') || 'kbc_project',
            useShortTableNames: this.context.globalState.get<boolean>('keboola.useShortTableNames') ?? false,
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

        const exportLimitText = settings.exportRowLimit === 0 ? 'unlimited' : settings.exportRowLimit.toLocaleString();
        const headersText = settings.includeHeaders ? 'included' : 'excluded';

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
                
                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                
                .checkbox-input {
                    width: 16px;
                    height: 16px;
                    accent-color: var(--vscode-checkbox-background);
                }
                
                .checkbox-label {
                    font-weight: 500;
                    color: var(--vscode-editor-foreground);
                    cursor: pointer;
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
                
                #connectionMessageContainer, #exportMessageContainer {
                    position: relative;
                    z-index: 1000;
                    margin: 10px 0;
                    min-height: 20px; /* Ensure it takes up space */
                }
                
                .message {
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 16px;
                    border-left: 3px solid;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: relative;
                    z-index: 1001;
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
                
                .current-settings {
                    background-color: var(--vscode-inputOption-activeBorder);
                    border-left: 3px solid var(--vscode-charts-blue);
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .settings-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                .settings-section {
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    padding: 16px;
                }
                
                .settings-section-title {
                    font-size: 14px;
                    font-weight: 600;
                    margin: 0 0 12px 0;
                    color: var(--vscode-editor-foreground);
                }
                
                @media (max-width: 600px) {
                    .settings-grid {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="settings-container">

                
                <div class="section">
                    <h2 class="section-title">🔌 Connection Settings</h2>
                    
                    <div class="current-settings" id="currentSettings">
                        <strong>Current:</strong> ${settings.apiUrl || 'No provider selected'} | 
                        Token: ${settings.token ? '****** (saved)' : 'Not set'} | 
                        Preview: ${settings.previewRowLimit.toLocaleString()} rows | 
                        Export: ${exportLimitText} | Headers: ${headersText}
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
                        <button class="button secondary" onclick="testConnection()" id="testConnectionBtn">🔧 Test Connection</button>
                    </div>
                    
                    <!-- Message container for connection testing -->
                    <div id="connectionMessageContainer" style="margin-top: 15px;"></div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">⚙️ Row Limits & Export Settings</h2>
                    
                    <div class="settings-grid">
                        <div class="settings-section">
                            <h3 class="settings-section-title">👁️ Preview Settings</h3>
                            <div class="form-group">
                                <label class="form-label" for="previewRowLimitInput">Row Limit:</label>
                                <input type="number" 
                                       id="previewRowLimitInput" 
                                       class="form-input" 
                                       placeholder="100"
                                       min="1"
                                       max="10000"
                                       value="${settings.previewRowLimit}">
                                <div class="form-help">Smaller limit for faster loading of samples (1-10,000)</div>
                            </div>
                            <button class="button" onclick="savePreviewSettings()">💾 Save Preview Settings</button>
                        </div>
                        
                        <div class="settings-section">
                            <h3 class="settings-section-title">📤 Export Settings</h3>
                            <div class="form-group">
                                <label class="form-label" for="exportRowLimitInput">Row Limit:</label>
                                <input type="number" 
                                       id="exportRowLimitInput" 
                                       class="form-input" 
                                       placeholder="2000"
                                       min="0"
                                       max="10000000"
                                       value="${settings.exportRowLimit}">
                                <div class="form-help">0 = unlimited, or 1-10,000,000 rows</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="exportFolderNameInput">Export folder name (relative to workspace root):</label>
                                <input type="text" 
                                       id="exportFolderNameInput" 
                                       class="form-input" 
                                       placeholder="kbc_project"
                                       value="${settings.exportFolderName}">
                                <div class="form-help">Folder where all exports will be saved (e.g., "kbc_project" → workspace/kbc_project/)</div>
                            </div>
                            
                            <div class="checkbox-group">
                                <input type="checkbox" 
                                       id="includeHeadersInput" 
                                       class="checkbox-input"
                                       ${settings.includeHeaders ? 'checked' : ''}>
                                <label class="checkbox-label" for="includeHeadersInput">Include headers by default</label>
                            </div>
                            
                            <div class="checkbox-group">
                                <input type="checkbox" 
                                       id="useShortTableNamesInput" 
                                       class="checkbox-input"
                                       ${settings.useShortTableNames ? 'checked' : ''}>
                                <label class="checkbox-label" for="useShortTableNamesInput">Use short table names (e.g., "weather.csv" instead of "in.c-data.weather.csv")</label>
                            </div>
                            
                            <button class="button" onclick="saveExportSettings()">💾 Save Export Settings</button>
                            
                            <!-- Message container for export settings -->
                            <div id="exportMessageContainer" style="margin-top: 15px;"></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        💡 <strong>Preview:</strong> Used for "Preview Sample" actions (API calls)<br>
                        💡 <strong>Export:</strong> Default for CSV exports (can be overridden per export)<br>
                        💡 <strong>Headers:</strong> Include column names as first row in exports
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
                
                function savePreviewSettings() {
                    const previewRowLimit = parseInt(document.getElementById('previewRowLimitInput').value);
                    
                    if (isNaN(previewRowLimit) || previewRowLimit <= 0) {
                        showMessage('error', 'Please enter a valid preview row limit (1-10,000)');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'savePreviewSettings',
                        previewRowLimit: previewRowLimit
                    });
                }
                
                function saveExportSettings() {
                    const exportRowLimit = parseInt(document.getElementById('exportRowLimitInput').value);
                    const includeHeaders = document.getElementById('includeHeadersInput').checked;
                    const exportFolderName = document.getElementById('exportFolderNameInput').value.trim();
                    const useShortTableNames = document.getElementById('useShortTableNamesInput').checked;
                    
                    if (isNaN(exportRowLimit) || exportRowLimit < 0) {
                        showMessage('error', 'Please enter a valid export row limit (0 = unlimited, or 1-10,000,000)', 'exportMessageContainer');
                        return;
                    }
                    
                    if (!exportFolderName) {
                        showMessage('error', 'Export folder name cannot be empty', 'exportMessageContainer');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'saveExportSettings',
                        exportRowLimit: exportRowLimit,
                        includeHeaders: includeHeaders,
                        exportFolderName: exportFolderName,
                        useShortTableNames: useShortTableNames
                    });
                }
                
                function testConnection() {
                    try {
                        console.log('Test Connection button clicked');
                        showMessage('info', '🔄 Testing connection...');
                        
                        if (typeof vscode === 'undefined') {
                            showMessage('error', 'VS Code API not available');
                            return;
                        }
                        
                        // Clear any existing messages after 1 second before starting test
                        setTimeout(() => {
                            const container = document.getElementById('connectionMessageContainer');
                            if (container) {
                                container.innerHTML = '';
                            }
                        }, 1000);
                        
                        vscode.postMessage({
                            command: 'testConnection'
                        });
                    } catch (error) {
                        console.error('Error in testConnection:', error);
                        showMessage('error', 'Error: ' + error.message);
                    }
                }
                
                function showMessage(type, text, containerId = 'connectionMessageContainer') {
                    const container = document.getElementById(containerId);
                    
                    if (!container) {
                        console.error(\`Message container '\${containerId}' not found!\`);
                        return;
                    }
                    
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`message \${type}\`;
                    messageDiv.innerHTML = text; // Use innerHTML to support HTML content like <br>
                    
                    container.innerHTML = '';
                    container.appendChild(messageDiv);
                    
                    // Auto-hide success messages after 10 seconds, errors after 12 seconds
                    const timeout = type === 'success' ? 10000 : 12000;
                    setTimeout(() => {
                        if (container.contains(messageDiv)) {
                            container.removeChild(messageDiv);
                        }
                    }, timeout);
                }
                
                // Alternative click handler setup
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('DOM loaded');
                    
                    const testBtn = document.getElementById('testConnectionBtn');
                    if (testBtn) {
                        console.log('Test button found, adding alternative click listener');
                        testBtn.addEventListener('click', function(e) {
                            console.log('Alternative click handler triggered');
                            testConnection();
                        });
                    } else {
                        console.log('Test button not found');
                    }
                });

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showMessage':
                            showMessage(message.type, message.text, message.container);
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