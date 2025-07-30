import * as vscode from 'vscode';
import * as path from 'path';
import { AgentConfig, AgentPolicy, MCPToolRef, CredentialRef, AgentSettings } from '../types';
import { t } from '../i18n/en';
import { PolicyValidator } from '../AgentPolicy';

export class CreateAgentPanel {
    public static currentPanel: CreateAgentPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext, store: any, runtime: any) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (CreateAgentPanel.currentPanel) {
            CreateAgentPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'createAgent',
            t.create_title,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'public', 'agents')
                ]
            }
        );

        CreateAgentPanel.currentPanel = new CreateAgentPanel(panel, extensionUri, context, store, runtime);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext, private store: any, private runtime: any) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._setWebviewMessageListener(this._panel.webview, context);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        CreateAgentPanel.currentPanel = undefined;

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
                    case 'validateAgent':
                        await this.handleValidateAgent(message.data);
                        break;
                    case 'createAgent':
                        await this.handleCreateAgent(message.data);
                        break;
                    case 'getSettings':
                        await this.handleGetSettings();
                        break;
                    case 'getAvailableTools':
                        await this.handleGetAvailableTools();
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    private async handleValidateAgent(data: any) {
        try {
            const config = this.buildAgentConfig(data);
            const validationPlan = this.generateValidationPlan(config);
            
            this._panel.webview.postMessage({
                command: 'validationResult',
                data: {
                    success: true,
                    plan: validationPlan,
                    estimatedCost: this.calculateEstimatedCost(config)
                }
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'validationResult',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleCreateAgent(data: any) {
        try {
            const config = this.buildAgentConfig(data);
            const agentId = await this.store.createRun(config);
            
            this._panel.webview.postMessage({
                command: 'agentCreated',
                data: { agentId, success: true }
            });

            // Close the panel
            this._panel.dispose();
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'agentCreated',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }

    private async handleGetSettings() {
        const settings = this.getDefaultSettings();
        this._panel.webview.postMessage({
            command: 'settingsLoaded',
            data: settings
        });
    }

    private async handleGetAvailableTools() {
        const tools = this.getAvailableTools();
        this._panel.webview.postMessage({
            command: 'toolsLoaded',
            data: tools
        });
    }

    private buildAgentConfig(data: any): AgentConfig {
        const policy = PolicyValidator.mergeWithDefaults(data.policy || {});
        
        return {
            id: `agent_${Date.now()}`,
            name: data.name,
            goal: data.goal,
            systemPrompt: data.systemPrompt,
            selectedLLM: data.selectedLLM,
            allowedLLMs: data.allowedLLMs || [data.selectedLLM],
            allowedTools: data.allowedTools || [],
            credentials: data.credentials || [],
            budgetUSD: data.budgetUSD || 10.0,
            tokenBudget: data.tokenBudget || 0,
            timeLimitSec: data.timeLimitSec || 3600,
            contactPolicy: data.contactPolicy || 'notify',
            hitlTimeoutSec: data.hitlTimeoutSec || 300,
            hitlFallback: data.hitlFallback || 'pause',
            policy
        };
    }

    private generateValidationPlan(config: AgentConfig): any {
        const steps = [
            { id: 'step_1', title: 'Analyze goal and requirements', kind: 'thought', estTokens: 150, estUSD: 0.02 },
            { id: 'step_2', title: 'Query relevant data sources', kind: 'tool', toolId: 'QueryStorage', estTokens: 200, estUSD: 0.03 },
            { id: 'step_3', title: 'Process and analyze data', kind: 'tool', toolId: 'AnalyzeData', estTokens: 300, estUSD: 0.05 },
            { id: 'step_4', title: 'Generate insights and recommendations', kind: 'thought', estTokens: 250, estUSD: 0.04 },
            { id: 'step_5', title: 'Create final report', kind: 'tool', toolId: 'GenerateReport', estTokens: 200, estUSD: 0.03 }
        ];

        return {
            steps,
            totalSteps: steps.length,
            estimatedTokens: steps.reduce((sum, step) => sum + (step.estTokens || 0), 0),
            estimatedUSD: steps.reduce((sum, step) => sum + (step.estUSD || 0), 0)
        };
    }

    private calculateEstimatedCost(config: AgentConfig): number {
        const costPer1K = this.getCostPer1K(config.selectedLLM);
        const estimatedTokens = 1000; // Rough estimate
        return (estimatedTokens / 1000) * costPer1K;
    }

    private getCostPer1K(model: string): number {
        const costs: Record<string, number> = {
            'gpt-4o-mini': 0.00015,
            'gpt-4o': 0.005,
            'gpt-3.5-turbo': 0.0005,
            'claude-3-haiku': 0.00025,
            'claude-3-sonnet': 0.003,
            'claude-3-opus': 0.015
        };
        return costs[model] || 0.001;
    }

    private getDefaultSettings(): AgentSettings {
        return {
            defaultModel: 'gpt-4o-mini',
            defaultBudgetUSD: 10.0,
            defaultTokenBudget: 10000,
            defaultTimeLimitSec: 3600,
            allowedLLMs: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku', 'claude-3-sonnet'],
            allowedTools: ['QueryStorage', 'AnalyzeData', 'GenerateReport'],
            contactPolicy: 'notify',
            hitlTimeoutSec: 300,
            hitlFallback: 'pause',
            exportTracesToFile: true,
            dataDir: '.keboola_agents'
        };
    }

    private getAvailableTools(): MCPToolRef[] {
        return [
            { id: 'mcp://keboola/QueryStorage', name: 'QueryStorage', description: 'Query data from Keboola storage' },
            { id: 'mcp://keboola/AnalyzeData', name: 'AnalyzeData', description: 'Analyze data patterns and trends' },
            { id: 'mcp://keboola/GenerateReport', name: 'GenerateReport', description: 'Generate reports and visualizations' },
            { id: 'mcp://keboola/ListTables', name: 'ListTables', description: 'List available tables' },
            { id: 'mcp://keboola/GetTableInfo', name: 'GetTableInfo', description: 'Get detailed table information' }
        ];
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'agents', 'createAgent.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'agents', 'createAgent.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.create_title}</title>
    <link rel="stylesheet" type="text/css" href="${styleUri}">
</head>
<body>
    <div class="container">
        <h1>${t.create_title}</h1>
        
        <div class="tabs">
            <button class="tab-button active" data-tab="goal">${t.tab_goal_prompt}</button>
            <button class="tab-button" data-tab="models">${t.tab_models}</button>
            <button class="tab-button" data-tab="tools">${t.tab_tools}</button>
            <button class="tab-button" data-tab="credentials">${t.tab_credentials}</button>
            <button class="tab-button" data-tab="budget">${t.tab_budget_limits}</button>
            <button class="tab-button" data-tab="policy">${t.tab_policy}</button>
            <button class="tab-button" data-tab="contact">${t.tab_contact_hitl}</button>
        </div>

        <div class="tab-content">
            <!-- Goal & Prompt Tab -->
            <div id="goal" class="tab-pane active">
                <div class="form-group">
                    <label for="agentName">${t.create_name_label}</label>
                    <input type="text" id="agentName" placeholder="${t.create_name_placeholder}">
                </div>
                <div class="form-group">
                    <label for="agentGoal">${t.create_goal_label}</label>
                    <textarea id="agentGoal" placeholder="${t.create_goal_placeholder}" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label for="systemPrompt">${t.create_system_prompt_label}</label>
                    <textarea id="systemPrompt" placeholder="${t.create_system_prompt_placeholder}" rows="6"></textarea>
                </div>
            </div>

            <!-- Models Tab -->
            <div id="models" class="tab-pane">
                <div class="form-group">
                    <label for="selectedLLM">${t.models_title}</label>
                    <select id="selectedLLM">
                        <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                        <option value="gpt-4o">GPT-4o (OpenAI)</option>
                        <option value="claude-3-haiku">Claude 3 Haiku (Anthropic)</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet (Anthropic)</option>
                    </select>
                </div>
            </div>

            <!-- Tools Tab -->
            <div id="tools" class="tab-pane">
                <div class="form-group">
                    <label>${t.tools_title}</label>
                    <div id="toolsList" class="tools-list">
                        <!-- Tools will be populated by JavaScript -->
                    </div>
                </div>
            </div>

            <!-- Credentials Tab -->
            <div id="credentials" class="tab-pane">
                <div class="form-group">
                    <label>${t.credentials_title}</label>
                    <button id="addCredential" class="btn-secondary">${t.credentials_add}</button>
                    <div id="credentialsList">
                        <!-- Credentials will be populated by JavaScript -->
                    </div>
                </div>
            </div>

            <!-- Budget & Limits Tab -->
            <div id="budget" class="tab-pane">
                <div class="form-group">
                    <label for="budgetUSD">${t.budget_usd}</label>
                    <input type="number" id="budgetUSD" min="0" step="0.01" value="10.00">
                </div>
                <div class="form-group">
                    <label for="tokenBudget">${t.budget_tokens}</label>
                    <input type="number" id="tokenBudget" min="0" value="0">
                    <small>${t.budget_unlimited}</small>
                </div>
                <div class="form-group">
                    <label for="timeLimit">${t.budget_time_limit}</label>
                    <input type="number" id="timeLimit" min="0" value="3600">
                </div>
            </div>

            <!-- Policy Tab -->
            <div id="policy" class="tab-pane">
                <div class="form-group">
                    <label for="maxConcurrentTools">${t.policy_concurrent_tools}</label>
                    <input type="number" id="maxConcurrentTools" min="1" value="3">
                </div>
                <div class="form-group">
                    <label for="rateLimit">${t.policy_rate_limit}</label>
                    <input type="number" id="rateLimit" min="1" value="10">
                </div>
                <div class="form-group">
                    <label for="piiHandling">${t.policy_pii_handling}</label>
                    <select id="piiHandling">
                        <option value="mask">Mask</option>
                        <option value="deny">Deny</option>
                        <option value="allow">Allow</option>
                    </select>
                </div>
            </div>

            <!-- Contact & HITL Tab -->
            <div id="contact" class="tab-pane">
                <div class="form-group">
                    <label for="contactPolicy">${t.contact_policy}</label>
                    <select id="contactPolicy">
                        <option value="notify">${t.contact_notify}</option>
                        <option value="notify_modal">${t.contact_notify_modal}</option>
                        <option value="log_only">${t.contact_log_only}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="hitlTimeout">${t.contact_hitl_timeout}</label>
                    <input type="number" id="hitlTimeout" min="0" value="300">
                </div>
                <div class="form-group">
                    <label for="hitlFallback">${t.contact_hitl_fallback}</label>
                    <select id="hitlFallback">
                        <option value="pause">${t.contact_hitl_pause}</option>
                        <option value="continue_safe">${t.contact_hitl_continue}</option>
                        <option value="stop">${t.contact_hitl_stop}</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="actions">
            <button id="validateBtn" class="btn-secondary">${t.btn_validate}</button>
            <button id="createBtn" class="btn-primary" disabled>${t.btn_start}</button>
        </div>

        <div id="validationResult" class="validation-result" style="display: none;">
            <!-- Validation results will be shown here -->
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
} 