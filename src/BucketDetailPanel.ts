import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KeboolaBucketDetail } from './keboolaApi';
import { exportBucket, exportBucketSchema, KbcCliOptions, ExportSettings } from './kbcCli';

export class BucketDetailPanel {
    public static currentPanel: BucketDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        bucketDetail: KeboolaBucketDetail, 
        extensionUri: vscode.Uri, 
        keboolaApi?: any, 
        previewRowLimit: number = 100,
        exportRowLimit: number = 2000,
        context?: any
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (BucketDetailPanel.currentPanel) {
            BucketDetailPanel.currentPanel.panel.reveal(column);
            BucketDetailPanel.currentPanel.updateContent(bucketDetail);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'keboolaBucketDetail',
            `Bucket: ${bucketDetail.displayName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        BucketDetailPanel.currentPanel = new BucketDetailPanel(panel, bucketDetail, previewRowLimit, exportRowLimit, context);
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        bucketDetail: KeboolaBucketDetail,
        private readonly previewRowLimit: number = 100,
        private readonly exportRowLimit: number = 2000,
        private readonly context?: vscode.ExtensionContext
    ) {
        this.panel = panel;
        this.updateContent(bucketDetail);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'exportBucket':
                        await this.handleExportBucket(this.currentBucketDetail);
                        break;
                    case 'exportBucketSchema':
                        await this.handleExportBucketSchema(this.currentBucketDetail);
                        break;
                    case 'refreshData':
                        await this.handleRefreshData(this.currentBucketDetail);
                        break;
                }
            },
            null,
            this.disposables
        );

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private currentBucketDetail!: KeboolaBucketDetail;

    private updateContent(bucketDetail: KeboolaBucketDetail): void {
        this.currentBucketDetail = bucketDetail;
        this.panel.title = `Bucket: ${bucketDetail.displayName}`;
        this.panel.webview.html = this.getWebviewContent(bucketDetail);
    }

    private getWebviewContent(bucketDetail: KeboolaBucketDetail): string {
        const formatDate = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            try {
                return new Date(dateStr).toLocaleString();
            } catch {
                return dateStr;
            }
        };

        const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // For WebView, we need to preserve emojis and special characters
        // Only escape dangerous HTML characters, but preserve Unicode/emojis
        const safeDescription = bucketDetail.description 
            ? bucketDetail.description
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
            : 'No description provided';

        const tablesRows = bucketDetail.tables.map(table => `
            <tr>
                <td class="table-name">${table.displayName}</td>
                <td class="table-id">${table.id}</td>
                <td class="table-rows">${table.rowsCount.toLocaleString()}</td>
                <td class="table-size">${formatBytes(table.dataSizeBytes)}</td>
            </tr>
        `).join('');

        const metadataRows = bucketDetail.metadata.map(meta => `
            <tr>
                <td class="meta-key">${meta.key}</td>
                <td class="meta-value">${meta.value}</td>
            </tr>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bucket Details - ${bucketDetail.displayName}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    line-height: 1.6;
                    margin: 0;
                    padding: 20px;
                }

                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .header {
                    border-bottom: 2px solid var(--vscode-panel-border);
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }

                .bucket-title {
                    color: var(--vscode-symbolIcon-namespaceForeground);
                    margin: 0 0 10px 0;
                    font-size: 2em;
                    font-weight: 600;
                }

                .bucket-id {
                    color: var(--vscode-descriptionForeground);
                    font-family: var(--vscode-editor-font-family);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 6px 12px;
                    border-radius: 4px;
                    display: inline-block;
                    font-size: 0.9em;
                }

                .stage-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.8em;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-left: 10px;
                }

                .stage-in {
                    background-color: var(--vscode-charts-blue);
                    color: white;
                }

                .stage-out {
                    background-color: var(--vscode-charts-green);
                    color: white;
                }

                .properties-table {
                    width: 100%;
                    border-collapse: collapse;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 30px;
                }

                .properties-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    vertical-align: top;
                }

                .properties-table td:first-child {
                    font-weight: 600;
                    color: var(--vscode-symbolIcon-keywordForeground);
                    width: 160px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }

                .properties-table tr:last-child td {
                    border-bottom: none;
                }

                .properties-table tr:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .section {
                    margin-bottom: 40px;
                }

                .section-title {
                    color: var(--vscode-symbolIcon-functionForeground);
                    border-bottom: 2px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                    font-size: 1.4em;
                    font-weight: 600;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .data-table th {
                    background-color: var(--vscode-editor-selectionBackground);
                    color: var(--vscode-editor-selectionForeground);
                    padding: 16px 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid var(--vscode-panel-border);
                }

                .data-table td {
                    padding: 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    vertical-align: top;
                }

                .data-table tr:last-child td {
                    border-bottom: none;
                }

                .data-table tr:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .table-name {
                    font-weight: 600;
                    color: var(--vscode-symbolIcon-propertyForeground);
                }

                .table-id {
                    font-family: var(--vscode-editor-font-family);
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }

                .table-rows, .table-size {
                    text-align: right;
                    font-family: var(--vscode-editor-font-family);
                }

                .meta-key {
                    font-weight: 600;
                    color: var(--vscode-symbolIcon-keywordForeground);
                    font-family: var(--vscode-editor-font-family);
                }

                .meta-value {
                    font-family: var(--vscode-editor-font-family);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }

                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    padding: 40px;
                    font-style: italic;
                }

                .description {
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    margin-top: 10px;
                    padding: 10px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    border-left: 4px solid var(--vscode-symbolIcon-namespaceForeground);
                }

                .export-settings {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 6px;
                    padding: 16px;
                }

                .settings-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .setting-label {
                    font-weight: 500;
                    color: var(--vscode-editor-foreground);
                }

                .setting-value {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .settings-note {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--vscode-widget-border);
                    color: var(--vscode-descriptionForeground);
                }

                .actions-section {
                    margin: 20px 0;
                }

                .action-buttons {
                    display: flex;
                    gap: 12px;
                    margin: 16px 0;
                    flex-wrap: wrap;
                }

                .action-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 6px;
                    padding: 12px 20px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 140px;
                }

                .action-button:hover {
                    background: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .action-button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .action-button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .export-info {
                    background: var(--vscode-textCodeBlock-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 12px 16px;
                    margin: 12px 0;
                    border-radius: 0 6px 6px 0;
                    color: var(--vscode-editor-foreground);
                    font-size: 13px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="bucket-title">🗄️ ${bucketDetail.displayName}</h1>
                    <div class="bucket-id">${bucketDetail.id}</div>
                    <span class="stage-badge stage-${bucketDetail.stage}">${bucketDetail.stage}</span>
                    
                    ${bucketDetail.description ? `
                        <div class="description">
                            ${safeDescription}
                        </div>
                    ` : ''}
                </div>

                <div class="actions-section">
                    <h2 class="section-title">⚡ Actions</h2>
                    <div class="action-buttons">
                        <button class="action-button" onclick="exportBucket()">
                            📤 Export Bucket
                        </button>
                        <button class="action-button secondary" onclick="exportBucketSchema()">
                            📋 Export Table Metadata
                        </button>
                        <button class="action-button secondary" onclick="refreshData()">
                            🔄 Refresh Data
                        </button>
                    </div>
                    <div class="export-info">
                        💡 Export Bucket downloads all ${bucketDetail.tables.length} tables as CSV files with current export settings
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">📋 Bucket Properties</h2>
                    <table class="properties-table">
                        <tr>
                            <td><b>ID</b></td>
                            <td>${bucketDetail.id}</td>
                        </tr>
                        <tr>
                            <td><b>Stage</b></td>
                            <td><span class="stage-badge stage-${bucketDetail.stage}">${bucketDetail.stage}</span></td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>${safeDescription}</td>
                        </tr>
                        <tr>
                            <td><b>Created</b></td>
                            <td>${formatDate(bucketDetail.created)}</td>
                        </tr>
                        <tr>
                            <td><b>Last Modified</b></td>
                            <td>${formatDate(bucketDetail.lastChangeDate)}</td>
                        </tr>
                        <tr>
                            <td><b>Total Size</b></td>
                            <td>${formatBytes(bucketDetail.dataSizeBytes)}</td>
                        </tr>
                        <tr>
                            <td><b>Number of Tables</b></td>
                            <td><strong>${bucketDetail.tables.length}</strong></td>
                        </tr>
                    </table>
                </div>

                <div class="section">
                    <h2 class="section-title">📤 Current Export Settings</h2>
                    <div class="export-settings">
                        <div class="settings-row">
                            <span class="setting-label">Export folder:</span>
                            <span class="setting-value">${this.context?.globalState.get<string>('keboola.exportFolderName') || 'data'}</span>
                        </div>
                        <div class="settings-row">
                            <span class="setting-label">Export limit:</span>
                            <span class="setting-value">${this.exportRowLimit === 0 ? 'unlimited' : this.exportRowLimit.toLocaleString()} rows</span>
                        </div>
                        <div class="settings-row">
                            <span class="setting-label">Headers:</span>
                            <span class="setting-value">${this.context?.globalState.get<boolean>('keboola.includeHeaders') ?? true ? 'On' : 'Off'}</span>
                        </div>
                        <div class="settings-row">
                            <span class="setting-label">Table names:</span>
                            <span class="setting-value">${this.context?.globalState.get<boolean>('keboola.useShortTableNames') ?? false ? 'Short' : 'Full'}</span>
                        </div>
                        <div class="settings-note">
                            <small>💡 Use "Keboola: Settings" to change these defaults. Files exported to: workspace/<strong>${this.context?.globalState.get<string>('keboola.exportFolderName') || 'data'}</strong>/${bucketDetail.stage}/${bucketDetail.id.split('.').slice(1).join('.')}/</small>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">📊 Tables (${bucketDetail.tables.length})</h2>
                    ${bucketDetail.tables.length > 0 ? `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Table Name</th>
                                    <th>Table ID</th>
                                    <th>Rows</th>
                                    <th>Size</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tablesRows}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            No tables found in this bucket
                        </div>
                    `}
                </div>



                ${bucketDetail.metadata.length > 0 ? `
                    <div class="section">
                        <h2 class="section-title">🏷️ Metadata (${bucketDetail.metadata.length})</h2>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${metadataRows}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function exportBucket() {
                    vscode.postMessage({ command: 'exportBucket' });
                }
                
                function exportBucketSchema() {
                    vscode.postMessage({ command: 'exportBucketSchema' });
                }
                
                function refreshData() {
                    vscode.postMessage({ command: 'refreshData' });
                }
            </script>
        </body>
        </html>`;
    }

    private async handleExportBucket(bucketDetail: KeboolaBucketDetail): Promise<void> {
        try {
            const apiUrl = this.context?.globalState.get<string>('keboola.apiUrl');
            const token = this.context?.globalState.get<string>('keboola.token');

            if (!apiUrl || !token) {
                vscode.window.showErrorMessage('Please configure your Keboola connection in Settings first.');
                return;
            }

            const cliOptions: KbcCliOptions = {
                token,
                host: apiUrl
            };

            const defaultSettings: ExportSettings = {
                rowLimit: this.exportRowLimit,
                includeHeaders: this.context?.globalState.get<boolean>('keboola.includeHeaders') ?? true
            };

            if (!this.context) {
                vscode.window.showErrorMessage('Extension context not available for export.');
                return;
            }
            
            await exportBucket(bucketDetail.id, cliOptions, defaultSettings, this.context, {}, bucketDetail.tables);

        } catch (error) {
            console.error('Failed to export bucket:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Bucket export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Bucket export failed: Unknown error`);
            }
        }
    }

    private async handleExportBucketSchema(bucketDetail: KeboolaBucketDetail): Promise<void> {
        try {
            const apiUrl = this.context?.globalState.get<string>('keboola.apiUrl');
            const token = this.context?.globalState.get<string>('keboola.token');

            if (!apiUrl || !token) {
                vscode.window.showErrorMessage('Please configure your Keboola connection in Settings first.');
                return;
            }

            const cliOptions: KbcCliOptions = {
                token,
                host: apiUrl
            };

            // Construct workspace export path for schema
            const exportFolderName = this.context?.globalState.get<string>('keboola.exportFolderName') || 'data';
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder found. Please open a workspace to export metadata.');
                return;
            }
            
            const outputDir = path.join(workspaceRoot, exportFolderName, 'schemas');
            
            // Ensure schemas directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Exporting bucket schema...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Fetching bucket metadata..." });

                const schemaPath = await exportBucketSchema(bucketDetail.id, cliOptions, outputDir, bucketDetail);

                progress.report({ increment: 50, message: "Complete!" });

                vscode.window.showInformationMessage(
                    `Bucket metadata exported successfully to ${schemaPath}`,
                    'Open File'
                ).then(choice => {
                    if (choice === 'Open File') {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(schemaPath));
                    }
                });
            });

        } catch (error) {
            console.error('Failed to export bucket schema:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Bucket metadata export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Bucket metadata export failed: Unknown error`);
            }
        }
    }

    private async handleRefreshData(bucketDetail: KeboolaBucketDetail): Promise<void> {
        try {
            const apiUrl = this.context?.globalState.get<string>('keboola.apiUrl');
            const token = this.context?.globalState.get<string>('keboola.token');

            if (!apiUrl || !token) {
                vscode.window.showErrorMessage('Please configure your Keboola connection in Settings first.');
                return;
            }

            // Create new API instance
            const { KeboolaApi } = await import('./keboolaApi');
            const keboolaApi = new KeboolaApi({ apiUrl, token });

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Refreshing bucket data...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Fetching latest bucket details..." });

                const refreshedBucketDetail = await keboolaApi.getBucketDetail(bucketDetail.id);
                
                progress.report({ increment: 50, message: "Updating display..." });

                // Update the panel content with refreshed data
                this.updateContent(refreshedBucketDetail);
                
                vscode.window.showInformationMessage(`Bucket data refreshed successfully`);
            });

        } catch (error) {
            console.error('Failed to refresh bucket data:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh bucket data: ${message}`);
        }
    }

    public dispose(): void {
        BucketDetailPanel.currentPanel = undefined;

        // Clean up our resources
        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 