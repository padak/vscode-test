import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KeboolaTableDetail, KeboolaApi, KeboolaApiError } from './keboolaApi';
import { exportTable, exportTableSchema, KbcCliOptions, ExportSettings } from './kbcCli';

export class TableDetailPanel {
    public static currentPanel: TableDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private tableDetail: KeboolaTableDetail;
    private readonly keboolaApi?: KeboolaApi;
    private readonly previewRowLimit: number;
    private readonly exportRowLimit: number;
    private readonly context: vscode.ExtensionContext;

    public static createOrShow(
        tableDetail: KeboolaTableDetail, 
        extensionUri: vscode.Uri, 
        keboolaApi?: KeboolaApi, 
        previewRowLimit: number = 100,
        exportRowLimit: number = 2000,
        context?: vscode.ExtensionContext
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, dispose it and create a new one
        if (TableDetailPanel.currentPanel) {
            TableDetailPanel.currentPanel.dispose();
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'keboolaTableDetail',
            `Table: ${tableDetail.displayName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        TableDetailPanel.currentPanel = new TableDetailPanel(
            panel, 
            tableDetail, 
            keboolaApi, 
            previewRowLimit,
            exportRowLimit,
            context || {} as vscode.ExtensionContext
        );
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        tableDetail: KeboolaTableDetail, 
        keboolaApi?: KeboolaApi, 
        previewRowLimit: number = 100,
        exportRowLimit: number = 2000,
        context: vscode.ExtensionContext = {} as vscode.ExtensionContext
    ) {
        this.panel = panel;
        this.tableDetail = tableDetail;
        this.keboolaApi = keboolaApi;
        this.previewRowLimit = previewRowLimit;
        this.exportRowLimit = exportRowLimit;
        this.context = context;

        this.updateContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'previewSample':
                        await this.handlePreviewSample();
                        break;
                    case 'exportTable':
                        await this.handleExportTable();
                        break;
                    case 'exportSchema':
                        await this.handleExportSchema();
                        break;
                    case 'refreshData':
                        await this.handleRefreshData();
                        break;
                }
            },
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private async handlePreviewSample(): Promise<void> {
        if (!this.keboolaApi) {
            vscode.window.showErrorMessage('No API connection available. Please configure your Keboola connection.');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Loading table preview...",
                cancellable: false
            }, async (progress) => {
                            progress.report({ increment: 50, message: `Fetching ${this.previewRowLimit} rows...` });

            const csvData = await this.keboolaApi!.getTablePreview(this.tableDetail.id, this.previewRowLimit);

                progress.report({ increment: 25, message: "Opening in editor..." });
                
                // Open CSV content in a new editor tab
                const doc = await vscode.workspace.openTextDocument({
                    content: csvData,
                    language: 'csv'
                });
                
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                
                progress.report({ increment: 25, message: "Preview complete!" });
                
                // Show success message
                            vscode.window.showInformationMessage(
                `Table preview opened in new tab (limited to ${this.previewRowLimit.toLocaleString()} rows)`
            );
            });
        } catch (error) {
            console.error('Preview failed:', error);
            if (error instanceof KeboolaApiError) {
                vscode.window.showErrorMessage(`Preview failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleExportTable(): Promise<void> {
        try {
            // Get current settings for CLI options
            const apiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            const token = this.context.globalState.get<string>('keboola.token');

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
                includeHeaders: this.context.globalState.get<boolean>('keboola.includeHeaders') ?? true
            };

            await exportTable(this.tableDetail.id, cliOptions, defaultSettings, this.context);

        } catch (error) {
            console.error('Failed to export table:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Export failed: Unknown error`);
            }
        }
    }

    private async handleExportSchema(): Promise<void> {
        try {
            // Get current settings for CLI options
            const apiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            const token = this.context.globalState.get<string>('keboola.token');

            if (!apiUrl || !token) {
                vscode.window.showErrorMessage('Please configure your Keboola connection in Settings first.');
                return;
            }

            const cliOptions: KbcCliOptions = {
                token,
                host: apiUrl
            };

            // Construct workspace export path for schema
            const exportFolderName = this.context.globalState.get<string>('keboola.exportFolderName') || 'data';
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
                title: "Exporting table metadata...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Fetching table metadata..." });

                const schemaPath = await exportTableSchema(this.tableDetail.id, cliOptions, outputDir, this.keboolaApi);

                progress.report({ increment: 50, message: "Complete!" });

                vscode.window.showInformationMessage(
                    `Table metadata exported successfully to ${schemaPath}`
                );
            });

        } catch (error) {
            console.error('Failed to export table metadata:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Metadata export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Metadata export failed: Unknown error`);
            }
        }
    }

    private async handleRefreshData(): Promise<void> {
        if (!this.keboolaApi) {
            vscode.window.showErrorMessage('No API connection available. Please configure your Keboola connection.');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Refreshing table data...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 100, message: "Fetching latest metadata..." });
                
                // Refresh the table detail
                const updatedDetail = await this.keboolaApi!.getTableDetail(this.tableDetail.id);
                
                // Update the internal table detail
                this.tableDetail = updatedDetail;
                
                // Regenerate the entire HTML content with updated data
                this.updateContent();
                
                vscode.window.showInformationMessage('Table data refreshed successfully');
            });
        } catch (error) {
            console.error('Refresh failed:', error);
            if (error instanceof KeboolaApiError) {
                vscode.window.showErrorMessage(`Refresh failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private updateContent(): void {
        this.panel.title = `Table: ${this.tableDetail.displayName}`;
        this.panel.webview.html = this.getWebviewContent();
    }

    private getWebviewContent(): string {
        const formatDate = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            try {
                return new Date(dateStr).toLocaleString();
            } catch {
                return dateStr;
            }
        };

        const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const columnsTableRows = this.tableDetail.columns.map(column => `
            <tr>
                <td class="column-name">${column.name}</td>
                <td class="column-type">${column.definition?.type || 'STRING'}${column.definition?.length ? `(${column.definition.length})` : ''}</td>
                <td class="column-nullable">${column.definition?.nullable === false ? 'No' : 'Yes'}</td>
                <td class="column-description">${column.description || '-'}</td>
            </tr>
        `).join('');

        const metadataRows = this.tableDetail.metadata.map(meta => `
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
            <title>Table Details - ${this.tableDetail.displayName}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    font-weight: var(--vscode-font-weight);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                    line-height: 1.6;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .table-title {
                    font-size: 28px;
                    font-weight: 600;
                    margin: 0 0 10px 0;
                    color: var(--vscode-editor-foreground);
                }
                .table-id {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    background-color: var(--vscode-badge-background);
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: inline-block;
                    margin-bottom: 10px;
                }
                .stage-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
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
                .row-limit-display {
                    margin-bottom: 15px;
                    padding: 8px 12px;
                    background-color: var(--vscode-inputOption-activeBorder);
                    border-left: 3px solid var(--vscode-charts-blue);
                    border-radius: 4px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                .section {
                    margin-bottom: 30px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 20px;
                }
                .section-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0 0 15px 0;
                    color: var(--vscode-editor-foreground);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    padding-bottom: 8px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .info-item {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 12px;
                }
                .info-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-editor-foreground);
                }
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    background-color: var(--vscode-editor-background);
                }
                .data-table th {
                    background-color: var(--vscode-list-hoverBackground);
                    color: var(--vscode-editor-foreground);
                    font-weight: 600;
                    padding: 12px 8px;
                    text-align: left;
                    border-bottom: 2px solid var(--vscode-panel-border);
                    font-size: 13px;
                }
                .data-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    vertical-align: top;
                    font-size: 13px;
                }
                .data-table tr:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                .column-name {
                    font-family: var(--vscode-editor-font-family);
                    font-weight: 600;
                    color: var(--vscode-editor-foreground);
                }
                .column-type {
                    font-family: var(--vscode-editor-font-family);
                    color: var(--vscode-charts-purple);
                    font-weight: 500;
                }
                .meta-key {
                    font-family: var(--vscode-editor-font-family);
                    font-weight: 600;
                    color: var(--vscode-symbolIcon-propertyForeground);
                }
                .actions-section {
                    background-color: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .action-buttons {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    margin-bottom: 15px;
                }
                .action-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .action-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .action-button:disabled {
                    background-color: var(--vscode-button-background);
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .action-button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .action-button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .row-limit-info {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    padding: 8px 12px;
                    background-color: var(--vscode-badge-background);
                    border-radius: 4px;
                    margin-top: 10px;
                }
                .preview-info {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="table-title">📊 ${this.tableDetail.displayName}</h1>
                    <div class="table-id">${this.tableDetail.id}</div>
                    <span class="stage-badge stage-${this.tableDetail.bucket.stage}">${this.tableDetail.bucket.stage}</span>
                    
                    <div class="row-limit-display">
                        📏 <strong>Current Settings:</strong><br>
                        Export Folder: <strong>${this.context.globalState.get<string>('keboola.exportFolderName') || 'data'}</strong> | 
                        Preview: <strong>${this.previewRowLimit.toLocaleString()}</strong> rows | 
                        Export: <strong>${this.exportRowLimit === 0 ? 'unlimited' : this.exportRowLimit.toLocaleString()}</strong> rows | 
                        Headers: <strong>${this.context.globalState.get<boolean>('keboola.includeHeaders') ?? true ? 'On' : 'Off'}</strong> | 
                        Table names: <strong>${this.context.globalState.get<boolean>('keboola.useShortTableNames') ?? false ? 'Short' : 'Full'}</strong>
                        <br><small>Use "Keboola: Settings" to change these defaults. Files exported to: workspace/<strong>${this.context.globalState.get<string>('keboola.exportFolderName') || 'data'}</strong>/${this.tableDetail.bucket.stage}/${this.tableDetail.bucket.id.split('.').slice(1).join('.')}/</small>
                    </div>
                </div>

                <div class="actions-section">
                    <h2 class="section-title">⚡ Actions</h2>
                    <div class="action-buttons">
                        <button class="action-button" onclick="previewSample()">
                            👁️ Preview Sample
                        </button>
                        <button class="action-button" onclick="exportTable()">
                            📤 Export Table
                        </button>
                        <button class="action-button secondary" onclick="exportSchema()">
                            📋 Export Table Metadata
                        </button>
                        <button class="action-button secondary" onclick="refreshData()">
                            🔄 Refresh Data
                        </button>
                    </div>
                    <div class="preview-info">
                        💡 Preview Sample opens data in a new editor tab with CSV syntax highlighting
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">📋 Table Properties</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Bucket</div>
                            <div class="info-value">${this.tableDetail.bucket.name}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Rows</div>
                            <div class="info-value">${this.tableDetail.rowsCount.toLocaleString()}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Columns</div>
                            <div class="info-value">${this.tableDetail.columns.length}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Size</div>
                            <div class="info-value">${formatBytes(this.tableDetail.dataSizeBytes)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Created</div>
                            <div class="info-value">${formatDate(this.tableDetail.created)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Last Modified</div>
                            <div class="info-value">${formatDate(this.tableDetail.lastChangeDate)}</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">🏗️ Columns (${this.tableDetail.columns.length})</h2>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Column Name</th>
                                <th>Data Type</th>
                                <th>Nullable</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columnsTableRows}
                        </tbody>
                    </table>
                </div>

                ${this.tableDetail.metadata.length > 0 ? `
                    <div class="section">
                        <h2 class="section-title">🏷️ Metadata (${this.tableDetail.metadata.length})</h2>
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

                function previewSample() {
                    vscode.postMessage({ command: 'previewSample' });
                }

                function exportTable() {
                    vscode.postMessage({ command: 'exportTable' });
                }

                function exportSchema() {
                    vscode.postMessage({ command: 'exportSchema' });
                }

                function refreshData() {
                    vscode.postMessage({ command: 'refreshData' });
                }

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    // Message handling for future features
                });
            </script>
        </body>
        </html>`;
    }

    public dispose(): void {
        TableDetailPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 