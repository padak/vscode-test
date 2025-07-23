import * as vscode from 'vscode';
import { JobsApi, KeboolaJobDetail } from './jobsApi';

export class JobDetailPanel {
    public static currentPanel: JobDetailPanel | undefined;
    private static readonly viewType = 'keboolaJobDetail';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _jobsApi?: JobsApi;
    private _currentJob?: KeboolaJobDetail;

    public static createOrShow(
        job: KeboolaJobDetail,
        extensionUri: vscode.Uri,
        jobsApi?: JobsApi
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (JobDetailPanel.currentPanel) {
            JobDetailPanel.currentPanel._updateJob(job);
            JobDetailPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            JobDetailPanel.viewType,
            `Job ${job.id}`,
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                // And restrict the webview to only loading content from our extension's `media` directory.
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        JobDetailPanel.currentPanel = new JobDetailPanel(panel, extensionUri, job, jobsApi);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        JobDetailPanel.currentPanel = new JobDetailPanel(panel, extensionUri);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        job?: KeboolaJobDetail,
        jobsApi?: JobsApi
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._jobsApi = jobsApi;
        this._currentJob = job;

        // Set the webview's initial html content
        if (job) {
            this._updateJob(job);
        }

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this._refreshJob();
                        return;
                    case 'copyJobId':
                        if (this._currentJob) {
                            vscode.env.clipboard.writeText(this._currentJob.id);
                            vscode.window.showInformationMessage(`Job ID ${this._currentJob.id} copied to clipboard`);
                        }
                        return;
                    case 'openInKeboola':
                        this._openInKeboolaUI();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _refreshJob() {
        if (!this._currentJob || !this._jobsApi) {
            return;
        }

        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: "Refreshing job details...",
                cancellable: false
            }, async () => {
                const updatedJob = await this._jobsApi!.getJobDetail(this._currentJob!.id);
                this._updateJob(updatedJob);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private _openInKeboolaUI() {
        if (!this._currentJob || !this._jobsApi) {
            return;
        }

        const url = this._jobsApi.generateKeboolaJobUrl(this._currentJob.id, this._currentJob.projectId);
        vscode.env.openExternal(vscode.Uri.parse(url));
    }

    private _updateJob(job: KeboolaJobDetail) {
        this._currentJob = job;
        this._panel.title = `Job ${job.id}`;
        this._panel.webview.html = this._getHtmlForWebview(job);
    }

    private _getHtmlForWebview(job: KeboolaJobDetail): string {
        // Generate formatted JSON for display
        const formattedJson = JSON.stringify(job, null, 2);
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Job ${job.id}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .job-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin: 0;
                }
                
                .status-badge {
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 12px;
                }
                
                .status-success { background-color: #28a745; color: white; }
                .status-error { background-color: #dc3545; color: white; }
                .status-warning { background-color: #ffc107; color: black; }
                .status-processing { background-color: #007bff; color: white; }
                .status-waiting { background-color: #6c757d; color: white; }
                .status-created { background-color: #6c757d; color: white; }
                .status-cancelled { background-color: #dc3545; color: white; }
                .status-terminated { background-color: #dc3545; color: white; }
                .status-terminating { background-color: #fd7e14; color: white; }
                
                .actions {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .info-section {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 15px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-panel-border);
                }
                
                .info-section h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: var(--vscode-textLink-foreground);
                    font-size: 16px;
                }
                
                .info-row {
                    display: flex;
                    margin-bottom: 8px;
                }
                
                .info-label {
                    font-weight: bold;
                    width: 120px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .info-value {
                    flex: 1;
                    word-break: break-word;
                }
                
                .json-section {
                    margin-top: 30px;
                }
                
                .json-section h3 {
                    margin-bottom: 15px;
                    color: var(--vscode-textLink-foreground);
                }
                
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    overflow: auto;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    line-height: var(--vscode-editor-line-height);
                    max-height: 500px;
                }
                
                .error-message {
                    background-color: var(--vscode-errorBackground);
                    color: var(--vscode-errorForeground);
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    border-left: 4px solid #dc3545;
                }
                
                .result-message {
                    background-color: var(--vscode-infoBackground);
                    color: var(--vscode-infoForeground);
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    border-left: 4px solid #007bff;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="job-title">Job ${job.id}</h1>
                <span class="status-badge status-${job.status}">${job.status}</span>
            </div>
            
            <div class="actions">
                <button onclick="refreshJob()">🔄 Refresh Job</button>
                <button onclick="copyJobId()">📋 Copy Job ID</button>
                <button onclick="openInKeboola()">🚀 Open in Keboola UI</button>
            </div>
            
            ${job.error?.message ? `<div class="error-message"><strong>Error:</strong> ${job.error.message}</div>` : ''}
            ${job.result?.message ? `<div class="result-message"><strong>Result:</strong> ${job.result.message}</div>` : ''}
            
            <div class="info-grid">
                <div class="info-section">
                    <h3>🔧 Component Details</h3>
                    <div class="info-row">
                        <span class="info-label">Component:</span>
                        <span class="info-value">${job.componentId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Configuration:</span>
                        <span class="info-value">${job.configurationId || job.configId || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Branch:</span>
                        <span class="info-value">${job.branchId || 'Main'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Project:</span>
                        <span class="info-value">${job.projectId}</span>
                    </div>
                    ${job.runId ? `<div class="info-row">
                        <span class="info-label">Run ID:</span>
                        <span class="info-value">${job.runId}</span>
                    </div>` : ''}
                </div>
                
                <div class="info-section">
                    <h3>⏱️ Timing</h3>
                    <div class="info-row">
                        <span class="info-label">Created:</span>
                        <span class="info-value">${this._formatTimestamp(job.createdTime)}</span>
                    </div>
                    ${job.startTime ? `<div class="info-row">
                        <span class="info-label">Started:</span>
                        <span class="info-value">${this._formatTimestamp(job.startTime)}</span>
                    </div>` : ''}
                    ${job.endTime ? `<div class="info-row">
                        <span class="info-label">Ended:</span>
                        <span class="info-value">${this._formatTimestamp(job.endTime)}</span>
                    </div>` : ''}
                    ${job.durationSeconds ? `<div class="info-row">
                        <span class="info-label">Duration:</span>
                        <span class="info-value">${this._formatDuration(job.durationSeconds)}</span>
                    </div>` : ''}
                </div>
                
                <div class="info-section">
                    <h3>👤 User Details</h3>
                    ${job.createdBy ? `
                    <div class="info-row">
                        <span class="info-label">Created by:</span>
                        <span class="info-value">${job.createdBy.name}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${job.createdBy.email || 'N/A'}</span>
                    </div>` : ''}
                    ${job.token ? `
                    <div class="info-row">
                        <span class="info-label">Token:</span>
                        <span class="info-value">${job.token.name || job.token.id}</span>
                    </div>
                    ${job.token.description ? `<div class="info-row">
                        <span class="info-label">Token Desc:</span>
                        <span class="info-value">${job.token.description}</span>
                    </div>` : ''}` : ''}
                </div>
                
                ${job.metrics || job.usage ? `<div class="info-section">
                    <h3>📊 Metrics</h3>
                    ${job.metrics ? `
                    ${job.metrics.inBytes ? `<div class="info-row">
                        <span class="info-label">Input:</span>
                        <span class="info-value">${this._formatBytes(job.metrics.inBytes)}</span>
                    </div>` : ''}
                    ${job.metrics.outBytes ? `<div class="info-row">
                        <span class="info-label">Output:</span>
                        <span class="info-value">${this._formatBytes(job.metrics.outBytes)}</span>
                    </div>` : ''}` : ''}
                    ${job.usage ? job.usage.map(usage => `
                    <div class="info-row">
                        <span class="info-label">${usage.metric}:</span>
                        <span class="info-value">${usage.value}</span>
                    </div>`).join('') : ''}
                </div>` : ''}
            </div>
            
            <div class="json-section">
                <h3>📄 Raw JSON Data</h3>
                <pre><code>${formattedJson}</code></pre>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function refreshJob() {
                    vscode.postMessage({ command: 'refresh' });
                }
                
                function copyJobId() {
                    vscode.postMessage({ command: 'copyJobId' });
                }
                
                function openInKeboola() {
                    vscode.postMessage({ command: 'openInKeboola' });
                }
            </script>
        </body>
        </html>`;
    }

    private _formatTimestamp(timestamp: string): string {
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch {
            return timestamp;
        }
    }

    private _formatDuration(durationSeconds: number): string {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const seconds = durationSeconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    private _formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    public dispose() {
        JobDetailPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
} 