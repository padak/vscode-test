import * as vscode from 'vscode';
import * as path from 'path';
import { AgentId, AgentRunState, AgentConfig, TraceEvent } from '../types';
import { t } from '../i18n/en';
import { AgentStore } from '../AgentStore';
import { AgentRuntime } from '../AgentRuntime';
import { AgentTraces } from '../AgentTraces';

export class AgentDetailPanel {
    public static currentPanels = new Map<AgentId, AgentDetailPanel>();
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _agentId: AgentId;
    private _disposables: vscode.Disposable[] = [];
    private _updateInterval: NodeJS.Timeout | undefined;

    public static createOrShow(agentId: AgentId, extensionUri: vscode.Uri, context: vscode.ExtensionContext, store: AgentStore, runtime: AgentRuntime) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (AgentDetailPanel.currentPanels.has(agentId)) {
            AgentDetailPanel.currentPanels.get(agentId)!._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'agentDetail',
            `Agent: ${agentId}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'public', 'agents')
                ]
            }
        );

        const detailPanel = new AgentDetailPanel(panel, extensionUri, agentId, context, store, runtime);
        AgentDetailPanel.currentPanels.set(agentId, detailPanel);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, agentId: AgentId, context: vscode.ExtensionContext, private store: AgentStore, private runtime: AgentRuntime) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._agentId = agentId;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._setWebviewMessageListener(this._panel.webview, context);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Start update interval
        this._updateInterval = setInterval(() => {
            this.updatePanel();
        }, 2000); // Update every 2 seconds
    }

    public dispose() {
        AgentDetailPanel.currentPanels.delete(this._agentId);

        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _setWebviewMessageListener(webview: vscode.Webview, context: vscode.ExtensionContext) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'pauseAgent':
                        await this.handlePauseAgent();
                        break;
                    case 'resumeAgent':
                        await this.handleResumeAgent();
                        break;
                    case 'stopAgent':
                        await this.handleStopAgent();
                        break;
                    case 'approveHITL':
                        await this.handleApproveHITL(message.hitlId, message.comment);
                        break;
                    case 'rejectHITL':
                        await this.handleRejectHITL(message.hitlId, message.comment);
                        break;
                    case 'openManifest':
                        await this.handleOpenManifest();
                        break;
                    case 'exportReport':
                        await this.handleExportReport();
                        break;
                    case 'getTraces':
                        await this.handleGetTraces();
                        break;
                    case 'getArtifacts':
                        await this.handleGetArtifacts();
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    private async handlePauseAgent() {
        try {
            await this.runtime.pauseAgent(this._agentId);
            this._panel.webview.postMessage({
                command: 'agentPaused',
                data: { success: true }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'agentPaused',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleResumeAgent() {
        try {
            await this.runtime.resumeAgent(this._agentId);
            this._panel.webview.postMessage({
                command: 'agentResumed',
                data: { success: true }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'agentResumed',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleStopAgent() {
        try {
            await this.runtime.stopAgent(this._agentId);
            this._panel.webview.postMessage({
                command: 'agentStopped',
                data: { success: true }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'agentStopped',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleApproveHITL(hitlId: string, comment?: string) {
        try {
            await this.runtime.approveHITL(this._agentId, hitlId, comment);
            this._panel.webview.postMessage({
                command: 'hitlApproved',
                data: { success: true, hitlId }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'hitlApproved',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    hitlId
                }
            });
        }
    }

    private async handleRejectHITL(hitlId: string, comment?: string) {
        try {
            await this.runtime.rejectHITL(this._agentId, hitlId, comment);
            this._panel.webview.postMessage({
                command: 'hitlRejected',
                data: { success: true, hitlId }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'hitlRejected',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    hitlId
                }
            });
        }
    }

    private async handleOpenManifest() {
        try {
            const manifest = await this.store.loadManifest(this._agentId);
            if (manifest) {
                const manifestPath = this.store.getManifestPath(this._agentId);
                const doc = await vscode.workspace.openTextDocument(manifestPath);
                await vscode.window.showTextDocument(doc);
                this._panel.webview.postMessage({
                    command: 'manifestOpened',
                    data: { success: true }
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'manifestOpened',
                    data: { success: false, error: 'No manifest found' }
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'manifestOpened',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleExportReport() {
        try {
            const report = await this.store.loadReport(this._agentId);
            if (report) {
                const reportJson = JSON.stringify(report, null, 2);
                const doc = await vscode.workspace.openTextDocument({
                    content: reportJson,
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
                this._panel.webview.postMessage({
                    command: 'reportExported',
                    data: { success: true }
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'reportExported',
                    data: { success: false, error: 'No report found' }
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'reportExported',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleGetTraces() {
        try {
            const traces = await this.store.loadTraces(this._agentId);
            const summary = AgentTraces.getTraceSummary(traces);
            this._panel.webview.postMessage({
                command: 'tracesLoaded',
                data: { traces, summary }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'tracesLoaded',
                data: {
                    traces: [],
                    summary: {},
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleGetArtifacts() {
        try {
            const artifacts = await this.store.listArtifacts(this._agentId);
            this._panel.webview.postMessage({
                command: 'artifactsLoaded',
                data: { artifacts }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'artifactsLoaded',
                data: {
                    artifacts: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async updatePanel() {
        try {
            const runState = await this.store.loadRun(this._agentId);
            const config = await this.store.loadConfig(this._agentId);
            
            if (runState && config) {
                const elapsedTime = this.calculateElapsedTime(runState.createdAt);
                const remainingBudget = config.budgetUSD - runState.spentUSD;
                
                // Get preset information if available
                let presetInfo = null;
                if (config.presetId) {
                    const { getPreset } = await import('../presets/agents');
                    const preset = getPreset(config.presetId);
                    if (preset) {
                        presetInfo = {
                            id: preset.id,
                            name: preset.name
                        };
                    }
                }
                
                this._panel.webview.postMessage({
                    command: 'updateState',
                    data: {
                        runState,
                        config,
                        elapsedTime,
                        remainingBudget,
                        isRunning: this.runtime.isRunning(this._agentId),
                        preset: presetInfo
                    }
                });
            }
        } catch (error) {
            console.error('Failed to update panel:', error);
        }
    }

    private calculateElapsedTime(createdAt: string): string {
        const created = new Date(createdAt);
        const now = new Date();
        const elapsedMs = now.getTime() - created.getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'agents', 'agentDetail.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'agents', 'agentDetail.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Detail</title>
    <link rel="stylesheet" type="text/css" href="${styleUri}">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 id="agentName">Agent: ${this._agentId}</h1>
            <div class="status-badge" id="statusBadge">
                <span id="statusText">Loading...</span>
            </div>
            <div class="preset-badge" id="presetBadge" style="display: none;">
                <span id="presetText"></span>
            </div>
        </div>

        <div class="metrics">
            <div class="metric">
                <label>${t.detail_progress}</label>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <span id="progressText">0%</span>
            </div>
            
            <div class="metric">
                <label>${t.detail_confidence}</label>
                <span id="confidenceText">0%</span>
            </div>
            
            <div class="metric">
                <label>${t.detail_budget_spent}</label>
                <span id="budgetText">$0.00</span>
            </div>
            
            <div class="metric">
                <label>${t.detail_tokens_used}</label>
                <span id="tokensText">0</span>
            </div>
            
            <div class="metric">
                <label>${t.detail_elapsed_time}</label>
                <span id="elapsedText">0:00</span>
            </div>
        </div>

        <div class="actions">
            <button id="pauseBtn" class="btn-secondary" style="display: none;">${t.btn_pause}</button>
            <button id="resumeBtn" class="btn-secondary" style="display: none;">${t.btn_resume}</button>
            <button id="stopBtn" class="btn-danger">${t.btn_stop}</button>
            <button id="manifestBtn" class="btn-secondary">${t.btn_open_manifest}</button>
            <button id="reportBtn" class="btn-secondary">${t.btn_export_report}</button>
        </div>

        <div class="tabs">
            <button class="tab-button active" data-tab="overview">Overview</button>
            <button class="tab-button" data-tab="traces">${t.detail_tab_traces}</button>
            <button class="tab-button" data-tab="hitl">${t.detail_tab_hitl}</button>
            <button class="tab-button" data-tab="artifacts">${t.detail_tab_artifacts}</button>
        </div>

        <div class="tab-content">
            <!-- Overview Tab -->
            <div id="overview" class="tab-pane active">
                <div class="overview-section">
                    <h3>Goal</h3>
                    <p id="agentGoal">Loading...</p>
                </div>
                
                <div class="overview-section">
                    <h3>Current Step</h3>
                    <p id="currentStep">Loading...</p>
                </div>
                
                <div class="overview-section">
                    <h3>Tool Calls</h3>
                    <div id="toolCallsList">
                        <!-- Tool calls will be populated by JavaScript -->
                    </div>
                </div>
            </div>

            <!-- Traces Tab -->
            <div id="traces" class="tab-pane">
                <div class="traces-header">
                    <h3>Trace Events</h3>
                    <button id="refreshTracesBtn" class="btn-secondary">Refresh</button>
                </div>
                <div id="tracesList" class="traces-list">
                    <!-- Traces will be populated by JavaScript -->
                </div>
            </div>

            <!-- HITL Tab -->
            <div id="hitl" class="tab-pane">
                <div class="hitl-header">
                    <h3>${t.hitl_pending}</h3>
                </div>
                <div id="hitlList" class="hitl-list">
                    <!-- HITL requests will be populated by JavaScript -->
                </div>
            </div>

            <!-- Artifacts Tab -->
            <div id="artifacts" class="tab-pane">
                <div class="artifacts-header">
                    <h3>${t.artifacts_title}</h3>
                </div>
                <div id="artifactsList" class="artifacts-list">
                    <!-- Artifacts will be populated by JavaScript -->
                </div>
            </div>
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
} 