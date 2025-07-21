import * as vscode from 'vscode';
import { KeboolaApi, KeboolaBranchDetail, KeboolaConfigurationDetail } from './keboolaApi';

export class ConfigurationsPanel {
    public static currentPanel: ConfigurationsPanel | undefined;
    private static readonly viewType = 'keboolaConfigurations';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(
        content: KeboolaBranchDetail | KeboolaConfigurationDetail,
        extensionUri: vscode.Uri,
        keboolaApi?: KeboolaApi
    ) {
        const column = vscode.window.activeTextEditor?.viewColumn;

        // If we already have a panel, show it
        if (ConfigurationsPanel.currentPanel) {
            ConfigurationsPanel.currentPanel._panel.reveal(column);
            ConfigurationsPanel.currentPanel._updateContent(content);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            ConfigurationsPanel.viewType,
            'Configuration Details',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ConfigurationsPanel.currentPanel = new ConfigurationsPanel(panel, extensionUri, content);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        ConfigurationsPanel.currentPanel = new ConfigurationsPanel(panel, extensionUri, null);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, content: KeboolaBranchDetail | KeboolaConfigurationDetail | null) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        if (content) {
            this._updateContent(content);
        }

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private _updateContent(content: KeboolaBranchDetail | KeboolaConfigurationDetail) {
        this._panel.webview.html = this._getHtmlForWebview(content);
        
        // Update panel title based on content type
        if ('branchId' in content) {
            // It's a configuration
            this._panel.title = `Configuration: ${content.name}`;
        } else {
            // It's a branch
            this._panel.title = `Branch: ${content.name}`;
        }
    }

    private _getHtmlForWebview(content: KeboolaBranchDetail | KeboolaConfigurationDetail): string {
        const isBranch = !('branchId' in content);
        
        if (isBranch) {
            return this._getBranchHtml(content as KeboolaBranchDetail);
        } else {
            return this._getConfigurationHtml(content as KeboolaConfigurationDetail);
        }
    }

    private _getBranchHtml(branch: KeboolaBranchDetail): string {
        const metadata = branch.metadata?.map(m => `<tr><td>${m.key}</td><td>${m.value}</td></tr>`).join('') || '<tr><td colspan="2">No metadata</td></tr>';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Branch Details</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
        }
        .title .icon {
            margin-right: 8px;
        }
        .description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 8px 15px;
            margin-bottom: 20px;
        }
        .info-label {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }
        .info-value {
            font-family: var(--vscode-editor-font-family);
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .badge.default {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-family: var(--vscode-editor-font-family);
        }
        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        th {
            background-color: var(--vscode-editor-selectionBackground);
            font-weight: bold;
        }
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span class="icon">${branch.isDefault ? '⭐' : '🌿'}</span>
            ${branch.name}
            ${branch.isDefault ? '<span class="badge default">DEFAULT</span>' : ''}
        </div>
        <div class="description">${branch.description || 'No description available'}</div>
        
        <div class="info-grid">
            <span class="info-label">Branch ID:</span>
            <span class="info-value">${branch.id}</span>
            
            <span class="info-label">Created:</span>
            <span class="info-value">${new Date(branch.created).toLocaleString()}</span>
            
            <span class="info-label">Created By:</span>
            <span class="info-value">${branch.createdBy.name} (${branch.createdBy.id})</span>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Metadata</div>
        <table>
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${metadata}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    }

    private _getConfigurationHtml(config: KeboolaConfigurationDetail): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Details</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .title {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
        }
        .title .icon {
            margin-right: 8px;
        }
        .description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 8px 15px;
            margin-bottom: 20px;
        }
        .info-label {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }
        .info-value {
            font-family: var(--vscode-editor-font-family);
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.85em;
            font-weight: bold;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span class="icon">⚙️</span>
            ${config.name}
            <span class="badge">v${config.version}</span>
        </div>
        <div class="description">${config.description || 'No description available'}</div>
        
        <div class="info-grid">
            <span class="info-label">Configuration ID:</span>
            <span class="info-value">${config.id}</span>
            
            <span class="info-label">Component:</span>
            <span class="info-value">${config.componentId}</span>
            
            <span class="info-label">Branch:</span>
            <span class="info-value">${config.branchId}</span>
            
            <span class="info-label">Created:</span>
            <span class="info-value">${new Date(config.created).toLocaleString()}</span>
            
            ${config.createdBy ? `
            <span class="info-label">Created By:</span>
            <span class="info-value">${config.createdBy.name} (${config.createdBy.id})</span>
            ` : ''}
            
            <span class="info-label">Version:</span>
            <span class="info-value">${config.version}</span>
            
            ${config.changeDescription ? `
            <span class="info-label">Change Description:</span>
            <span class="info-value">${config.changeDescription}</span>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
    }

    public dispose() {
        ConfigurationsPanel.currentPanel = undefined;

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
