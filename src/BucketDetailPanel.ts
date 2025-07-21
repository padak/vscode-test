import * as vscode from 'vscode';
import { KeboolaBucketDetail } from './keboolaApi';

export class BucketDetailPanel {
    public static currentPanel: BucketDetailPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        bucketDetail: KeboolaBucketDetail, 
        extensionUri: vscode.Uri, 
        keboolaApi?: any, 
        rowLimit: number = 1000,
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

        BucketDetailPanel.currentPanel = new BucketDetailPanel(panel, bucketDetail);
    }

    private constructor(panel: vscode.WebviewPanel, bucketDetail: KeboolaBucketDetail) {
        this.panel = panel;
        this.updateContent(bucketDetail);

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private updateContent(bucketDetail: KeboolaBucketDetail): void {
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
        </body>
        </html>`;
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