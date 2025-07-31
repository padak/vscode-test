import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';
import { isKbcCliAvailable } from './kbcCli';
import { ProjectManager, ProjectCredential } from './ProjectManager';

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
    // Table Watcher settings
    watchEnabled: boolean;
    watchIntervalSec: number;
    autoDownload: boolean;
    // New agent settings
    rootFolder: string;
    agentsFolder: string;
}

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private readonly context: vscode.ExtensionContext;
    private readonly projectManager: ProjectManager;

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
        this.projectManager = new ProjectManager(context);

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
                    case 'saveWatcherSettings':
                        await this.handleWatcherSettingsSave(message.watchEnabled, message.watchIntervalSec, message.autoDownload);
                        break;
                    case 'saveAgentSettings':
                        await this.handleAgentSettingsSave(message.rootFolder, message.agentsFolder);
                        break;
                    case 'savePreviewSettings':
                        await this.handlePreviewSettingsSave(message.previewRowLimit);
                        break;
                    case 'testConnection':
                        await this.handleTestConnection();
                        break;
                    case 'systemCheck':
                        await this.handleSystemCheck();
                        break;
                    case 'setStackUrl':
                        await this.handleProviderSelection(message.url);
                        break;
                    // Multi-project credentials handlers
                    case 'getProjects':
                        await this.handleGetProjects();
                        break;
                    case 'addProject':
                        await this.handleAddProject(message.project, message.token);
                        break;
                    case 'updateProject':
                        await this.handleUpdateProject(message.projectId, message.updates);
                        break;
                    case 'removeProject':
                        await this.handleRemoveProject(message.projectId);
                        break;
                    case 'testProjectConnection':
                        await this.handleTestProjectConnection(message.projectId);
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
            
            // Get updated settings for banner
            const updatedSettings = this.getCurrentSettings();
            const updatedBannerHtml = this.getCurrentBannerHtml(updatedSettings);
            
            // Send updated banner HTML back to webview
            this.panel.webview.postMessage({
                command: 'stackSaved',
                html: updatedBannerHtml
            });
            
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

    private async handleWatcherSettingsSave(watchEnabled: boolean, watchIntervalSec: number, autoDownload: boolean): Promise<void> {
        try {
            // Validate watch interval
            if (watchIntervalSec < 10 || watchIntervalSec > 3600) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Check interval must be between 10 and 3600 seconds',
                    container: 'watcherMessageContainer'
                });
                return;
            }

            // Save watcher settings
            await this.context.globalState.update('keboola.watchEnabled', watchEnabled);
            await this.context.globalState.update('keboola.watchIntervalSec', watchIntervalSec);
            await this.context.globalState.update('keboola.autoDownload', autoDownload);
            
            const enabledText = watchEnabled ? 'enabled' : 'disabled';
            const autoText = autoDownload ? 'on' : 'off';
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Table watcher settings saved! Watching: ${enabledText}, Interval: ${watchIntervalSec}s, Auto-download: ${autoText}`,
                container: 'watcherMessageContainer'
            });

            // Trigger settings change notification to restart watcher with new settings
            vscode.commands.executeCommand('keboola.internal.settingsChanged');

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save watcher settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                container: 'watcherMessageContainer'
            });
        }
    }

    private async handleAgentSettingsSave(rootFolder: string, agentsFolder: string): Promise<void> {
        try {
            // Validate folder names (no path traversal, no leading slashes, allow hyphens/underscores)
            const folderNameRegex = /^[a-zA-Z0-9_-]+$/;
            
            if (!rootFolder || rootFolder.trim() === '') {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Keboola Root Folder cannot be empty',
                    container: 'agentMessageContainer'
                });
                return;
            }

            if (!folderNameRegex.test(rootFolder)) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Keboola Root Folder can only contain letters, numbers, hyphens, and underscores',
                    container: 'agentMessageContainer'
                });
                return;
            }

            if (!agentsFolder || agentsFolder.trim() === '') {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Agents Sub-Folder cannot be empty',
                    container: 'agentMessageContainer'
                });
                return;
            }

            if (!folderNameRegex.test(agentsFolder)) {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: 'Agents Sub-Folder can only contain letters, numbers, hyphens, and underscores',
                    container: 'agentMessageContainer'
                });
                return;
            }

            // Save agent settings
            await this.context.globalState.update('keboola.export.rootFolder', rootFolder.trim());
            await this.context.globalState.update('keboola.export.agentsFolder', agentsFolder.trim());
            
            // Show feedback
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Agent settings saved! Root folder: "${rootFolder.trim()}", Agents folder: "${agentsFolder.trim()}"`,
                container: 'agentMessageContainer'
            });

        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to save agent settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
                container: 'agentMessageContainer'
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

    private async handleSystemCheck(): Promise<void> {
        try {
            const results = await this.performSystemCheck();
            await this.showSystemCheckResults(results);
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `System check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    // Multi-project credentials handlers
    private async handleGetProjects(): Promise<void> {
        try {
            const projects = await this.projectManager.getProjects();
            this.panel.webview.postMessage({
                command: 'projectsLoaded',
                projects: projects
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to load projects: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleAddProject(project: ProjectCredential, token?: string): Promise<void> {
        try {
            await this.projectManager.addProject(project);
            
            // Store the token if provided
            if (token) {
                await this.projectManager.storeProjectToken(project.id, token);
            }
            
            // Reload projects and send updated list
            const projects = await this.projectManager.getProjects();
            this.panel.webview.postMessage({
                command: 'projectsUpdated',
                projects: projects
            });
            
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Project "${project.name}" added successfully!`
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to add project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleUpdateProject(projectId: string, updates: Partial<ProjectCredential>): Promise<void> {
        try {
            await this.projectManager.updateProject(projectId, updates);
            
            // Reload projects and send updated list
            const projects = await this.projectManager.getProjects();
            this.panel.webview.postMessage({
                command: 'projectsUpdated',
                projects: projects
            });
            
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Project updated successfully!`
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleRemoveProject(projectId: string): Promise<void> {
        try {
            await this.projectManager.removeProject(projectId);
            
            // Reload projects and send updated list
            const projects = await this.projectManager.getProjects();
            this.panel.webview.postMessage({
                command: 'projectsUpdated',
                projects: projects
            });
            
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'success',
                text: `Project removed successfully!`
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `Failed to remove project: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async handleTestProjectConnection(projectId: string): Promise<void> {
        try {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'info',
                text: `Testing connection for project ${projectId}...`
            });

            const success = await this.projectManager.testProjectConnection(projectId);
            
            if (success) {
                const project = await this.projectManager.getProject(projectId);
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'success',
                    text: `✅ Connection successful for project "${project?.name}"!`
                });
            } else {
                this.panel.webview.postMessage({
                    command: 'showMessage',
                    type: 'error',
                    text: `❌ Connection failed for project ${projectId}. Please check your credentials.`
                });
            }
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'showMessage',
                type: 'error',
                text: `❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async performSystemCheck(): Promise<{
        kbcCli: { available: boolean; version?: string; error?: string };
        nodeVersion: { available: boolean; version?: string; error?: string };
        vscodeVersion: { available: boolean; version?: string; error?: string };
    }> {
        const results: {
            kbcCli: { available: boolean; version?: string; error?: string };
            nodeVersion: { available: boolean; version?: string; error?: string };
            vscodeVersion: { available: boolean; version?: string; error?: string };
        } = {
            kbcCli: { available: false },
            nodeVersion: { available: false },
            vscodeVersion: { available: false }
        };

        // Check Keboola CLI
        try {
            const kbcAvailable = await isKbcCliAvailable();
            results.kbcCli.available = kbcAvailable;
            if (kbcAvailable) {
                results.kbcCli.version = 'Available';
            } else {
                results.kbcCli.error = 'Keboola CLI not found in PATH';
            }
        } catch (error) {
            results.kbcCli.error = error instanceof Error ? error.message : 'Unknown error';
        }

        // Check Node.js version
        try {
            const nodeVersion = process.version;
            results.nodeVersion.available = true;
            results.nodeVersion.version = nodeVersion;
        } catch (error) {
            results.nodeVersion.error = error instanceof Error ? error.message : 'Unknown error';
        }

        // Check VSCode version
        try {
            const vscodeVersion = vscode.version;
            results.vscodeVersion.available = true;
            results.vscodeVersion.version = vscodeVersion;
        } catch (error) {
            results.vscodeVersion.error = error instanceof Error ? error.message : 'Unknown error';
        }

        return results;
    }

    private async showSystemCheckResults(results: {
        kbcCli: { available: boolean; version?: string; error?: string };
        nodeVersion: { available: boolean; version?: string; error?: string };
        vscodeVersion: { available: boolean; version?: string; error?: string };
    }): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'systemCheckResults',
            'System Check Results',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const getStatusIcon = (available: boolean) => available ? '✅' : '❌';
        const getStatusColor = (available: boolean) => available ? 'green' : 'red';

        const content = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>System Check Results</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .header {
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .check-item {
                        display: flex;
                        align-items: center;
                        padding: 10px;
                        margin: 10px 0;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        background-color: var(--vscode-editor-background);
                    }
                    .status-icon {
                        font-size: 20px;
                        margin-right: 15px;
                    }
                    .check-details {
                        flex: 1;
                    }
                    .check-name {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .check-status {
                        color: var(--vscode-descriptionForeground);
                    }
                    .error-message {
                        color: var(--vscode-errorForeground);
                        margin-top: 5px;
                        font-size: 12px;
                    }
                    .help-section {
                        margin-top: 30px;
                        padding: 15px;
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                    }
                    .help-title {
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .help-content {
                        font-size: 14px;
                        line-height: 1.4;
                    }
                    .code {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>System Check Results</h1>
                    <p>This check verifies that all required system dependencies are available for the Keboola Data Engineering Booster extension.</p>
                </div>

                <div class="check-item">
                    <div class="status-icon">${getStatusIcon(results.kbcCli.available)}</div>
                    <div class="check-details">
                        <div class="check-name">Keboola CLI (kbc)</div>
                        <div class="check-status">
                            ${results.kbcCli.available ? 'Available' : 'Not found'}
                            ${results.kbcCli.version ? ` - ${results.kbcCli.version}` : ''}
                        </div>
                        ${results.kbcCli.error ? `<div class="error-message">${results.kbcCli.error}</div>` : ''}
                    </div>
                </div>

                <div class="check-item">
                    <div class="status-icon">${getStatusIcon(results.nodeVersion.available)}</div>
                    <div class="check-details">
                        <div class="check-name">Node.js</div>
                        <div class="check-status">
                            ${results.nodeVersion.available ? 'Available' : 'Not found'}
                            ${results.nodeVersion.version ? ` - ${results.nodeVersion.version}` : ''}
                        </div>
                        ${results.nodeVersion.error ? `<div class="error-message">${results.nodeVersion.error}</div>` : ''}
                    </div>
                </div>

                <div class="check-item">
                    <div class="status-icon">${getStatusIcon(results.vscodeVersion.available)}</div>
                    <div class="check-details">
                        <div class="check-name">Visual Studio Code</div>
                        <div class="check-status">
                            ${results.vscodeVersion.available ? 'Available' : 'Not found'}
                            ${results.vscodeVersion.version ? ` - ${results.vscodeVersion.version}` : ''}
                        </div>
                        ${results.vscodeVersion.error ? `<div class="error-message">${results.vscodeVersion.error}</div>` : ''}
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-title">Need Help?</div>
                    <div class="help-content">
                        <p><strong>Keboola CLI not found?</strong></p>
                        <p>Install the Keboola CLI by following these steps:</p>
                        <ol>
                            <li>Visit the official installation guide: <a href="https://developers.keboola.com/cli/installation/">https://developers.keboola.com/cli/installation/</a></li>
                            <li>Follow the instructions for your operating system</li>
                            <li>Verify installation by running: <span class="code">kbc --version</span></li>
                        </ol>
                        
                        <p><strong>Node.js not found?</strong></p>
                        <p>This is unusual as VSCode extensions require Node.js. Please reinstall VSCode or contact support.</p>
                        
                        <p><strong>VSCode version issues?</strong></p>
                        <p>This extension requires VSCode 1.74.0 or higher. Please update VSCode to the latest version.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        panel.webview.html = content;
    }

    private getCurrentBannerHtml(settings: SettingsData): string {
        const exportLimitText = settings.exportRowLimit === 0 ? 'unlimited' : settings.exportRowLimit.toLocaleString();
        const headersText = settings.includeHeaders ? 'included' : 'excluded';
        const tokenState = settings.token ? '****** (saved)' : 'Not set';
        const stackUrl = settings.apiUrl || 'No provider selected';
        
        return `
            <div class="current-banner">
                <strong>Current:</strong> ${stackUrl} • Token: ${tokenState} • Preview: ${settings.previewRowLimit.toLocaleString()} • Export: ${exportLimitText} • Headers: ${headersText}
            </div>
        `;
    }

    private getCurrentSettings(): SettingsData {
        return {
            apiUrl: this.context.globalState.get<string>('keboola.apiUrl') || '',
            token: this.context.globalState.get<string>('keboola.token') || '',
            previewRowLimit: this.context.globalState.get<number>('keboola.previewRowLimit') || 100,
            exportRowLimit: this.context.globalState.get<number>('keboola.exportRowLimit') || 2000,
            includeHeaders: this.context.globalState.get<boolean>('keboola.includeHeaders') ?? true,
            exportFolderName: this.context.globalState.get<string>('keboola.exportFolderName') || 'data',
            useShortTableNames: this.context.globalState.get<boolean>('keboola.useShortTableNames') ?? false,
            lastUsed: this.context.globalState.get<string>('keboola.lastUsedUrl'),
            // Table Watcher settings with defaults
            watchEnabled: this.context.globalState.get<boolean>('keboola.watchEnabled') ?? true,
            watchIntervalSec: this.context.globalState.get<number>('keboola.watchIntervalSec') || 20,
            autoDownload: this.context.globalState.get<boolean>('keboola.autoDownload') ?? false,
            // New agent settings
            rootFolder: this.context.globalState.get<string>('keboola.export.rootFolder') || 'keboola',
            agentsFolder: this.context.globalState.get<string>('keboola.export.agentsFolder') || 'agents'
        };
    }

    private updateContent(): void {
        this.panel.webview.html = this.getWebviewContent();
    }

    private getWebviewContent(): string {
        const settings = this.getCurrentSettings();
        
        // Generate current banner HTML
        const currentBannerHtml = this.getCurrentBannerHtml(settings);
        
        // Generate provider groups and stack cards
        const providerGroupsHtml = this.cloudProviders.map(provider => {
            const stackCardsHtml = provider.regions.map(region => {
                const isLastUsed = settings.lastUsed === region.url;
                const isSelected = settings.apiUrl === region.url;
                
                return `
                    <button class="stack-card ${isSelected ? 'is-selected' : ''}" 
                            data-url="${region.url}"
                            aria-pressed="${isSelected}"
                            tabindex="0">
                        <span class="stack-card__flag">${region.flag}</span>
                        <div class="stack-card__text">
                            <div class="stack-card__title">${region.name}</div>
                            <div class="stack-card__url">${region.url}</div>
                        </div>
                        ${isLastUsed ? '<span class="stack-card__badge">LAST USED</span>' : ''}
                    </button>
                `;
            }).join('');

            const iconHtml = provider.icon ? 
                `<img src="${this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', provider.icon))}" alt="${provider.name}" />` : 
                '<div style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 16px;">🧪</div>';

            return `
                <div class="provider">
                    <div class="provider-title">
                        ${iconHtml}
                        <span>${provider.name}</span>
                    </div>
                    ${stackCardsHtml}
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
                :root {
                    --accent: #1F6FEB;
                    --accent-ink: #0F2B5A;
                    --accent-tint: #E9F2FF;
                    --surface: var(--vscode-editor-background);
                    --text: var(--vscode-foreground);
                    --muted: var(--vscode-descriptionForeground);
                    --border: var(--vscode-widget-border, #D1D5DB);
                }
                
                .vscode-dark:root {
                    --accent: #4C9BFF;
                    --accent-ink: #DCEBFF;
                    --accent-tint: rgba(76,155,255,0.14);
                    --border: var(--vscode-widget-border, #3A3A3A);
                }
                
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
                
                .current-banner {
                    background: var(--accent-tint);
                    color: var(--text);
                    border: 1px solid var(--accent);
                    border-radius: 10px;
                    padding: 12px 14px;
                    margin: 12px 0 20px;
                    font-size: 13px;
                    line-height: 1.35;
                }
                
                .current-banner strong {
                    color: var(--accent-ink);
                }
                
                .provider {
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 12px;
                    margin: 16px 0;
                    background: var(--surface);
                }
                
                .provider-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    margin: 4px 6px 10px;
                }
                
                .provider-title img {
                    width: 22px;
                    height: 22px;
                }
                
                .stack-card {
                    appearance: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    margin: 8px 0;
                    background: transparent;
                    color: var(--text);
                    border: 1.5px solid var(--border);
                    border-radius: 10px;
                    transition: background .15s, border-color .15s, box-shadow .15s;
                }
                
                .stack-card:hover {
                    border-color: var(--accent);
                    background: color-mix(in srgb, var(--accent-tint) 70%, transparent);
                }
                
                .stack-card:focus-visible {
                    outline: 2px solid var(--accent);
                    outline-offset: 2px;
                }
                
                .stack-card.is-selected {
                    border-color: var(--accent);
                    background: var(--accent-tint);
                    box-shadow: inset 3px 0 0 0 var(--accent);
                }
                
                .stack-card__flag {
                    font-size: 18px;
                }
                
                .stack-card__text {
                    flex: 1 1 auto;
                }
                
                .stack-card__title {
                    font-weight: 600;
                    font-size: 15px;
                    margin-bottom: 2px;
                }
                
                .stack-card__url {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                    font-size: 12.5px;
                    color: var(--muted);
                    word-break: break-all;
                }
                
                .stack-card__badge {
                    font-size: 11px;
                    padding: 3px 8px;
                    border-radius: 999px;
                    background: #DFAF62;
                    color: #161616;
                }
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

                <!-- System Check Section -->
                <div class="section">
                    <h2 class="section-title">🔧 System Check</h2>
                    <div class="settings-container">
                        <p style="margin-bottom: 20px; color: var(--vscode-descriptionForeground);">
                            Verify that all required system dependencies are available for the Keboola Data Engineering Booster extension.
                        </p>
                        
                        <div style="display: flex; gap: 12px;">
                            <button class="button secondary" onclick="systemCheck()" id="systemCheckBtn">🔍 Run System Check</button>
                        </div>
                        
                        <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                            💡 <strong>Keboola CLI:</strong> Required for data export operations<br>
                            💡 <strong>Node.js:</strong> Required for extension functionality<br>
                            💡 <strong>VSCode:</strong> Required version 1.74.0 or higher
                        </div>
                    </div>
                </div>
                
                <div class="section">
                    <h2 class="section-title">🔌 Connection Settings</h2>
                    
                    ${currentBannerHtml}
                    
                    <h3 style="margin-bottom: 16px; color: var(--vscode-editor-foreground);">Select Cloud Provider & Region:</h3>
                    
                    ${providerGroupsHtml}
                    
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
                
                <!-- Multi-Project Credentials Section -->
                <div class="section">
                    <h2 class="section-title">🏢 Multi-Project Credentials (for AI Agents)</h2>
                    <div class="settings-container">
                        <p style="margin-bottom: 20px; color: var(--vscode-descriptionForeground);">
                            Manage multiple Keboola project credentials for AI agents. Agents can operate across different projects using these credentials.
                        </p>
                        
                        <div id="projectsList" style="margin-bottom: 20px;">
                            <!-- Projects will be loaded here -->
                        </div>
                        
                        <div style="display: flex; gap: 12px;">
                            <button class="button" onclick="loadProjects()">🔄 Refresh Projects</button>
                            <button class="button secondary" onclick="showAddProjectForm()">➕ Add Project</button>
                        </div>
                        
                        <!-- Message container for project operations -->
                        <div id="projectMessageContainer" style="margin-top: 15px;"></div>
                        
                        <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                            💡 <strong>Default Project:</strong> Used when no specific project is specified<br>
                            💡 <strong>Token Storage:</strong> Tokens are stored securely in VS Code SecretStorage<br>
                            💡 <strong>Agent Access:</strong> Agents can access any project listed here
                        </div>
                    </div>
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
                            
                            <div class="form-group">
                                <label class="form-label" for="rootFolderInput">Keboola Root Folder:</label>
                                <input type="text" 
                                       id="rootFolderInput" 
                                       class="form-input" 
                                       placeholder="keboola"
                                       value="${settings.rootFolder}">
                                <div class="form-help">All project data will be stored under this folder in your workspace.</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="agentsFolderInput">Agents Sub-Folder:</label>
                                <input type="text" 
                                       id="agentsFolderInput" 
                                       class="form-input" 
                                       placeholder="agents"
                                       value="${settings.agentsFolder}">
                                <div class="form-help">Agent runs will be saved in {rootFolder}/{agentsFolder}.</div>
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
                            
                            <button class="button" onclick="saveAgentSettings()">💾 Save Agent Settings</button>
                            
                            <!-- Message container for agent settings -->
                            <div id="agentMessageContainer" style="margin-top: 15px;"></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        💡 <strong>Preview:</strong> Used for "Preview Sample" actions (API calls)<br>
                        💡 <strong>Export:</strong> Default for CSV exports (can be overridden per export)<br>
                        💡 <strong>Headers:</strong> Include column names as first row in exports
                    </div>
                </div>
            </div>

            <!-- Table Watcher Settings -->
            <div class="settings-section">
                <h2 class="section-title">👁️ Table Watcher</h2>
                <div class="settings-container">
                    <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                        <!-- Watch Enabled -->
                        <div class="input-group">
                            <label for="watchEnabled" class="input-label">
                                <input type="checkbox" id="watchEnabled" ${settings.watchEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                Enable table watching
                            </label>
                            <div class="help-text">Monitor downloaded tables for changes</div>
                        </div>

                        <!-- Check Interval -->
                        <div class="input-group">
                            <label for="watchIntervalSec" class="input-label">Check interval (seconds)</label>
                            <input type="number" id="watchIntervalSec" class="input-field" value="${settings.watchIntervalSec}" min="10" max="3600" step="1" placeholder="20">
                            <div class="help-text">How often to check for updates</div>
                        </div>

                        <!-- Auto Download -->
                        <div class="input-group">
                            <label for="autoDownload" class="input-label">
                                <input type="checkbox" id="autoDownload" ${settings.autoDownload ? 'checked' : ''} style="margin-right: 8px;">
                                Auto-download changes
                            </label>
                            <div class="help-text">Automatically re-download when table changes</div>
                        </div>
                    </div>

                    <div style="margin-top: 20px;">
                        <button class="button" onclick="saveWatcherSettings()">💾 Save Table Watcher Settings</button>
                        
                        <!-- Message container for watcher settings -->
                        <div id="watcherMessageContainer" style="margin-top: 15px;"></div>
                    </div>
                    
                    <div style="margin-top: 16px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        💡 <strong>Enable watching:</strong> Monitor tables for changes in Keboola<br>
                        💡 <strong>Check interval:</strong> Shorter intervals = faster notifications, more API usage<br>
                        💡 <strong>Auto-download:</strong> Off = show notification, On = automatically re-download
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                // Stack card selection handling
                const cards = Array.from(document.querySelectorAll('.stack-card'));
                
                function selectCard(el) {
                    cards.forEach(c => {
                        const isSel = c === el;
                        c.classList.toggle('is-selected', isSel);
                        c.setAttribute('aria-pressed', String(isSel));
                    });
                    const url = el.getAttribute('data-url');
                    vscode.postMessage({ type: 'setStackUrl', url });
                }
                
                // Legacy function for backward compatibility
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
                
                function saveAgentSettings() {
                    const rootFolder = document.getElementById('rootFolderInput').value.trim();
                    const agentsFolder = document.getElementById('agentsFolderInput').value.trim();
                    
                    if (!rootFolder) {
                        showMessage('error', 'Keboola Root Folder cannot be empty', 'agentMessageContainer');
                        return;
                    }
                    
                    if (!agentsFolder) {
                        showMessage('error', 'Agents Sub-Folder cannot be empty', 'agentMessageContainer');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'saveAgentSettings',
                        rootFolder: rootFolder,
                        agentsFolder: agentsFolder
                    });
                }
                
                function saveWatcherSettings() {
                    const watchEnabled = document.getElementById('watchEnabled').checked;
                    const watchIntervalSec = parseInt(document.getElementById('watchIntervalSec').value);
                    const autoDownload = document.getElementById('autoDownload').checked;
                    
                    if (isNaN(watchIntervalSec) || watchIntervalSec < 10 || watchIntervalSec > 3600) {
                        showMessage('error', 'Please enter a valid check interval (10-3600 seconds)', 'watcherMessageContainer');
                        return;
                    }
                    
                    vscode.postMessage({
                        command: 'saveWatcherSettings',
                        watchEnabled: watchEnabled,
                        watchIntervalSec: watchIntervalSec,
                        autoDownload: autoDownload
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
                
                function systemCheck() {
                    try {
                        console.log('System Check button clicked');
                        
                        if (typeof vscode === 'undefined') {
                            console.error('VS Code API not available');
                            return;
                        }
                        
                        vscode.postMessage({
                            command: 'systemCheck'
                        });
                    } catch (error) {
                        console.error('Error in systemCheck:', error);
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
                
                // Stack card event listeners
                cards.forEach(btn => {
                    btn.addEventListener('click', () => selectCard(btn));
                    btn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCard(btn);
                        }
                    });
                });
                
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

                // Multi-project credentials functions
                function loadProjects() {
                    vscode.postMessage({
                        command: 'getProjects'
                    });
                }
                
                function showAddProjectForm() {
                    const projectsList = document.getElementById('projectsList');
                    if (!projectsList) return;
                    
                    const formHtml = \`
                        <div class="project-form" style="background: var(--vscode-input-background); padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                            <h4 style="margin: 0 0 12px 0;">Add New Project</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-size: 12px;">Project ID:</label>
                                    <input type="text" id="newProjectId" placeholder="my-project" style="width: 100%; padding: 6px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-size: 12px;">Project Name:</label>
                                    <input type="text" id="newProjectName" placeholder="My Project" style="width: 100%; padding: 6px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);">
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-size: 12px;">Stack URL:</label>
                                <input type="text" id="newProjectUrl" placeholder="https://connection.eu-central-1.keboola.com/" style="width: 100%; padding: 6px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);">
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-size: 12px;">API Token:</label>
                                <input type="password" id="newProjectToken" placeholder="Enter API token" style="width: 100%; padding: 6px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground);">
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="addProject()" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Add Project</button>
                                <button onclick="cancelAddProject()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancel</button>
                            </div>
                        </div>
                    \`;
                    
                    projectsList.insertAdjacentHTML('afterbegin', formHtml);
                }
                
                function addProject() {
                    const projectId = document.getElementById('newProjectId').value.trim();
                    const projectName = document.getElementById('newProjectName').value.trim();
                    const stackUrl = document.getElementById('newProjectUrl').value.trim();
                    const token = document.getElementById('newProjectToken').value.trim();
                    
                    if (!projectId || !projectName || !stackUrl || !token) {
                        showMessage('error', 'Please fill in all fields', 'projectMessageContainer');
                        return;
                    }
                    
                    const project = {
                        id: projectId,
                        name: projectName,
                        stackUrl: stackUrl,
                        tokenSecretKey: \`keboola.token.\${projectId}\`,
                        default: false
                    };
                    
                    vscode.postMessage({
                        command: 'addProject',
                        project: project,
                        token: token
                    });
                    
                    cancelAddProject();
                }
                
                function cancelAddProject() {
                    const form = document.querySelector('.project-form');
                    if (form) {
                        form.remove();
                    }
                }
                
                function testProjectConnection(projectId) {
                    vscode.postMessage({
                        command: 'testProjectConnection',
                        projectId: projectId
                    });
                }
                
                function removeProject(projectId) {
                    if (confirm('Are you sure you want to remove this project?')) {
                        vscode.postMessage({
                            command: 'removeProject',
                            projectId: projectId
                        });
                    }
                }
                
                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showMessage':
                            showMessage(message.type, message.text, message.container);
                            break;
                        case 'stackSaved':
                            const banner = document.querySelector('.current-banner');
                            if (banner && message.html) {
                                banner.innerHTML = message.html;
                            }
                            break;
                        case 'projectsLoaded':
                        case 'projectsUpdated':
                            updateProjectsList(message.projects);
                            break;
                    }
                });
                
                function updateProjectsList(projects) {
                    const projectsList = document.getElementById('projectsList');
                    if (!projectsList) return;
                    
                    if (projects.length === 0) {
                        projectsList.innerHTML = '<p style="color: var(--vscode-descriptionForeground); font-style: italic;">No projects configured. Click "Add Project" to get started.</p>';
                        return;
                    }
                    
                    const projectsHtml = projects.map(project => \`
                        <div class="project-item" style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600; color: var(--vscode-editor-foreground);">
                                        \${project.name} \${project.default ? '<span style="background: var(--vscode-charts-blue); color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">DEFAULT</span>' : ''}
                                    </div>
                                    <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                                        ID: \${project.id} • URL: \${project.stackUrl}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    <button onclick="testProjectConnection('\${project.id}')" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">Test</button>
                                    <button onclick="removeProject('\${project.id}')" style="background: var(--vscode-errorForeground); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">Remove</button>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    
                    projectsList.innerHTML = projectsHtml;
                }
                
                // Load projects on page load
                document.addEventListener('DOMContentLoaded', function() {
                    loadProjects();
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