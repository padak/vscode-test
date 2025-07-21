import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KeboolaStageDetail } from './keboolaApi';
import { exportStage, exportStageSchema, KbcCliOptions, ExportSettings } from './kbcCli';

export class StageDetailPanel {
    public static currentPanel: StageDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        stageDetail: KeboolaStageDetail, 
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
        if (StageDetailPanel.currentPanel) {
            StageDetailPanel.currentPanel.panel.reveal(column);
            StageDetailPanel.currentPanel.updateContent(stageDetail);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'keboolaStageDetail',
            `Stage: ${stageDetail.displayName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        StageDetailPanel.currentPanel = new StageDetailPanel(panel, stageDetail, previewRowLimit, exportRowLimit, context);
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        stageDetail: KeboolaStageDetail,
        private readonly previewRowLimit: number = 100,
        private readonly exportRowLimit: number = 2000,
        private readonly context?: vscode.ExtensionContext
    ) {
        this.panel = panel;
        this.updateContent(stageDetail);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'exportStage':
                        await this.handleExportStage(stageDetail);
                        break;
                    case 'exportStageSchema':
                        await this.handleExportStageSchema(stageDetail);
                        break;
                    case 'refreshData':
                        await this.handleRefreshData(stageDetail);
                        break;
                }
            },
            null,
            this.disposables
        );

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private updateContent(stageDetail: KeboolaStageDetail): void {
        this.panel.title = `Stage: ${stageDetail.displayName}`;
        this.panel.webview.html = this.getWebviewContent(stageDetail);
    }

    private getWebviewContent(stageDetail: KeboolaStageDetail): string {
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

        // Create bucket rows for the table
        const bucketRows = stageDetail.buckets.map(bucket => `
            <tr>
                <td class="bucket-name">🗄️ ${bucket.displayName}</td>
                <td class="bucket-id">${bucket.id}</td>
                <td class="bucket-tables">${bucket.tableCount.toLocaleString()}</td>
                <td class="bucket-size">${formatBytes(bucket.dataSizeBytes)}</td>
                <td class="bucket-modified">${formatDate(bucket.lastChangeDate)}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Stage: ${stageDetail.displayName}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                    line-height: 1.6;
                }

                .container {
                    max-width: 100%;
                    margin: 0 auto;
                }

                .header {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--vscode-textLink-foreground);
                }

                .stage-title {
                    margin: 0 0 10px 0;
                    color: var(--vscode-textLink-foreground);
                    font-size: 28px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .stage-id {
                    color: var(--vscode-descriptionForeground);
                    font-size: 14px;
                    font-weight: normal;
                    margin-bottom: 8px;
                }

                .stage-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .stage-badge.stage-in {
                    background-color: #1f4e3d;
                    color: #4ade80;
                }

                .stage-badge.stage-out {
                    background-color: #44337a;
                    color: #a78bfa;
                }

                .description {
                    color: var(--vscode-editor-foreground);
                    font-size: 16px;
                    margin: 15px 0;
                    padding: 15px;
                    background: var(--vscode-textCodeBlock-background);
                    border-radius: 8px;
                    border-left: 4px solid var(--vscode-textLink-foreground);
                }

                .section {
                    margin: 25px 0;
                    padding: 20px;
                    background: var(--vscode-sideBar-background);
                    border-radius: 8px;
                    border: 1px solid var(--vscode-widget-border);
                }

                .section-title {
                    margin: 0 0 15px 0;
                    color: var(--vscode-textLink-foreground);
                    font-size: 18px;
                    font-weight: 600;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin: 16px 0;
                }

                .stat-card {
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 16px;
                    text-align: center;
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 4px;
                }

                .stat-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    font-weight: 500;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                    background: var(--vscode-editor-background);
                    border-radius: 6px;
                    overflow: hidden;
                    border: 1px solid var(--vscode-widget-border);
                }

                .data-table th {
                    background: var(--vscode-editorGroupHeader-tabsBackground);
                    color: var(--vscode-editor-foreground);
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 13px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                }

                .data-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    font-size: 13px;
                }

                .data-table tr:last-child td {
                    border-bottom: none;
                }

                .data-table tr:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .bucket-name {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .bucket-id {
                    font-family: var(--vscode-editor-font-family);
                    color: var(--vscode-descriptionForeground);
                }

                .bucket-tables {
                    font-weight: 600;
                }

                .bucket-size {
                    font-weight: 500;
                }

                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 40px 20px;
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

                .export-settings {
                    background: var(--vscode-input-background);
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
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="stage-title">🏗️ ${stageDetail.displayName} Stage</h1>
                    <div class="stage-id">${stageDetail.id}</div>
                    <span class="stage-badge stage-${stageDetail.id}">${stageDetail.id}</span>
                    
                    ${stageDetail.description ? `
                        <div class="description">
                            ${stageDetail.description}
                        </div>
                    ` : ''}
                </div>

                <div class="section">
                    <h2 class="section-title">📊 Stage Statistics</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${stageDetail.totalBuckets}</div>
                            <div class="stat-label">Total Buckets</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stageDetail.totalTables.toLocaleString()}</div>
                            <div class="stat-label">Total Tables</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${formatBytes(stageDetail.totalDataSizeBytes)}</div>
                            <div class="stat-label">Total Size</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${stageDetail.totalTables > 0 ? Math.round(stageDetail.totalDataSizeBytes / stageDetail.totalTables / 1024 / 1024 * 100) / 100 : 0} MB</div>
                            <div class="stat-label">Avg Table Size</div>
                        </div>
                    </div>
                </div>

                <div class="actions-section">
                    <h2 class="section-title">⚡ Actions</h2>
                    <div class="action-buttons">
                        <button class="action-button" onclick="exportStage()">
                            📤 Export Stage
                        </button>
                        <button class="action-button secondary" onclick="exportStageSchema()">
                            📋 Export Table Metadata
                        </button>
                        <button class="action-button secondary" onclick="refreshData()">
                            🔄 Refresh Data
                        </button>
                    </div>
                    <div class="export-info">
                        💡 Export Stage downloads all ${stageDetail.totalTables} tables from ${stageDetail.totalBuckets} buckets with current export settings
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">📤 Current Export Settings</h2>
                    <div class="export-settings">
                        <div class="settings-row">
                            <span class="setting-label">Export limit:</span>
                            <span class="setting-value">${this.exportRowLimit === 0 ? 'unlimited' : this.exportRowLimit.toLocaleString()} rows</span>
                        </div>
                        <div class="settings-row">
                            <span class="setting-label">Headers:</span>
                            <span class="setting-value">${this.context?.globalState.get<boolean>('keboola.includeHeaders') ?? true ? 'On' : 'Off'}</span>
                        </div>
                        <div class="settings-note">
                            <small>💡 Use "Keboola: Settings" to change these defaults. Export operations will prompt to override these values.</small>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">🗄️ Buckets (${stageDetail.buckets.length})</h2>
                    ${stageDetail.buckets.length > 0 ? `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Bucket Name</th>
                                    <th>Bucket ID</th>
                                    <th>Tables</th>
                                    <th>Size</th>
                                    <th>Last Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bucketRows}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            No buckets found in this stage
                        </div>
                    `}
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function exportStage() {
                    vscode.postMessage({ command: 'exportStage' });
                }
                
                function exportStageSchema() {
                    vscode.postMessage({ command: 'exportStageSchema' });
                }
                
                function refreshData() {
                    vscode.postMessage({ command: 'refreshData' });
                }
            </script>
        </body>
        </html>`;
    }

    private async handleExportStage(stageDetail: KeboolaStageDetail): Promise<void> {
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
            
            await exportStage(stageDetail.id, cliOptions, defaultSettings, this.context, {}, stageDetail);

        } catch (error) {
            console.error('Failed to export stage:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Stage export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Stage export failed: Unknown error`);
            }
        }
    }

    private async handleExportStageSchema(stageDetail: KeboolaStageDetail): Promise<void> {
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
            const exportFolderName = this.context?.globalState.get<string>('keboola.exportFolderName') || 'kbc_project';
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
                title: "Exporting stage schema...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Fetching stage metadata..." });

                const schemaPath = await exportStageSchema(stageDetail.id, cliOptions, outputDir);

                progress.report({ increment: 50, message: "Complete!" });

                vscode.window.showInformationMessage(
                    `Stage metadata exported successfully to ${schemaPath}`,
                    'Open File'
                ).then(choice => {
                    if (choice === 'Open File') {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(schemaPath));
                    }
                });
            });

        } catch (error) {
            console.error('Failed to export stage schema:', error);
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Stage metadata export failed: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Stage metadata export failed: Unknown error`);
            }
        }
    }

    private async handleRefreshData(stageDetail: KeboolaStageDetail): Promise<void> {
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
                title: "Refreshing stage data...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Fetching latest stage details..." });

                const refreshedStageDetail = await keboolaApi.getStageDetail(stageDetail.id);
                
                progress.report({ increment: 50, message: "Updating display..." });

                // Update the panel content with refreshed data
                this.updateContent(refreshedStageDetail);
                
                vscode.window.showInformationMessage(`Stage data refreshed successfully`);
            });

        } catch (error) {
            console.error('Failed to refresh stage data:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to refresh stage data: ${message}`);
        }
    }

    public dispose(): void {
        StageDetailPanel.currentPanel = undefined;

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