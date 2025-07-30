import * as vscode from 'vscode';
import { AgentStore } from './AgentStore';
import { AgentRuntime } from './AgentRuntime';
import { AgentId, AgentRunState, AgentStatus } from './types';
import { t } from './i18n/en';
import { AgentDetailPanel } from './webviews/AgentDetailPanel';

export class AgentsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private store: AgentStore;
    private runtime: AgentRuntime;

    constructor(store: AgentStore, runtime: AgentRuntime) {
        this.store = store;
        this.runtime = runtime;

        // Listen to store events
        this.store.onDidChangeRuns(() => this.refresh());
        this.store.onDidCreateRun(() => this.refresh());
        this.store.onDidUpdateRun(() => this.refresh());
        this.store.onDidCompleteRun(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Root level - show main categories
            return [
                new AgentCategoryItem(t.tree_running, 'running', '$(play)'),
                new AgentCategoryItem(t.tree_completed, 'completed', '$(check)'),
                new AgentCategoryItem(t.tree_failed, 'failed', '$(error)'),
                new AgentCategoryItem(t.tree_hitl_inbox, 'hitl', '$(question)')
            ];
        }

        if (element instanceof AgentCategoryItem) {
            const status = element.status;
            const agents = this.store.listByStatus(status as AgentStatus);
            
            if (status === 'hitl') {
                // Show agents with pending HITL requests
                const allAgents = this.store.listAll();
                const agentsWithHITL = allAgents.filter(agent => 
                    agent.hitlRequests.some(req => req.status === 'pending')
                );
                return agentsWithHITL.map(agent => new AgentTreeItem(agent, this.runtime));
            } else {
                return agents.map(agent => new AgentTreeItem(agent, this.runtime));
            }
        }

        return [];
    }

    getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
        if (element instanceof AgentTreeItem) {
            const status = element.agent.status;
            if (status === 'waiting_hitl') {
                return new AgentCategoryItem(t.tree_hitl_inbox, 'hitl', '$(question)');
            }
            const statusKey = `tree_${status}` as keyof typeof t;
            return new AgentCategoryItem(t[statusKey] || status, status, this.getStatusIcon(status));
        }
        return undefined;
    }

    private getStatusIcon(status: AgentStatus): string {
        switch (status) {
            case 'starting': return '$(sync~spin)';
            case 'running': return '$(play)';
            case 'waiting_hitl': return '$(question)';
            case 'paused': return '$(pause)';
            case 'completed': return '$(check)';
            case 'failed': return '$(error)';
            default: return '$(circle)';
        }
    }
}

class AgentCategoryItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly status: string,
        public readonly icon: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'agentCategory';
    }
}

class AgentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly agent: AgentRunState,
        private runtime: AgentRuntime
    ) {
        super(agent.id, vscode.TreeItemCollapsibleState.None);
        
        this.label = this.formatLabel();
        this.iconPath = new vscode.ThemeIcon(this.getStatusIcon());
        this.contextValue = `agent_${agent.status}`;
        this.tooltip = this.formatTooltip();
        this.description = this.formatDescription();
    }

    private formatLabel(): string {
        const config = this.getConfig();
        const name = config?.name || this.agent.id;
        const progress = this.agent.progressPct;
        const confidence = this.agent.confidencePct;
        
        return `${name} (${progress}%, ${confidence}% conf)`;
    }

    private formatDescription(): string {
        const spent = this.agent.spentUSD;
        const budget = this.getConfig()?.budgetUSD || 0;
        
        if (budget > 0) {
            return `$${spent.toFixed(2)}/${budget.toFixed(2)}`;
        }
        return `$${spent.toFixed(2)}`;
    }

    private formatTooltip(): string {
        const config = this.getConfig();
        const name = config?.name || this.agent.id;
        const goal = config?.goal || 'No goal specified';
        const status = this.agent.status;
        const progress = this.agent.progressPct;
        const confidence = this.agent.confidencePct;
        const spent = this.agent.spentUSD;
        const tokens = this.agent.spentTokens;
        const toolCalls = Object.values(this.agent.toolCalls).reduce((a, b) => a + b, 0);
        const hitlRequests = this.agent.hitlRequests.filter(req => req.status === 'pending').length;

        return [
            `**${name}**`,
            `Goal: ${goal}`,
            `Status: ${status}`,
            `Progress: ${progress}%`,
            `Confidence: ${confidence}%`,
            `Cost: $${spent.toFixed(2)}`,
            `Tokens: ${tokens.toLocaleString()}`,
            `Tool Calls: ${toolCalls}`,
            `Pending HITL: ${hitlRequests}`
        ].join('\n');
    }

    private getStatusIcon(): string {
        switch (this.agent.status) {
            case 'starting': return 'sync~spin';
            case 'running': return 'play';
            case 'waiting_hitl': return 'question';
            case 'paused': return 'pause';
            case 'completed': return 'check';
            case 'failed': return 'error';
            default: return 'circle';
        }
    }

    private getConfig(): any {
        // In a real implementation, this would load the config from the store
        // For now, return a mock config
        return {
            name: this.agent.id,
            goal: 'Sample goal',
            budgetUSD: 10.0
        };
    }
}

// Context menu commands for agent items
export function registerAgentCommands(context: vscode.ExtensionContext, runtime: AgentRuntime, store: AgentStore) {
    const commands = [
        vscode.commands.registerCommand('keboola.agents.start', async (agentId: AgentId) => {
            try {
                await runtime.startAgent(agentId);
                vscode.window.showInformationMessage(t.msg_agent_started);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_agent_start_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.pause', async (agentId: AgentId) => {
            try {
                await runtime.pauseAgent(agentId);
                vscode.window.showInformationMessage(t.msg_agent_paused);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_agent_pause_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.resume', async (agentId: AgentId) => {
            try {
                await runtime.resumeAgent(agentId);
                vscode.window.showInformationMessage(t.msg_agent_resumed);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_agent_resume_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.stop', async (agentId: AgentId) => {
            try {
                await runtime.stopAgent(agentId);
                vscode.window.showInformationMessage(t.msg_agent_stopped);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_agent_stop_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.openDetail', async (agentId: AgentId) => {
            try {
                AgentDetailPanel.createOrShow(agentId, vscode.extensions.getExtension('keboola.keboola-data-engineering-booster')!.extensionUri, context, store, runtime);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open agent detail panel: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.openManifest', async (agentId: AgentId) => {
            try {
                const manifestPath = store.getManifestPath(agentId);
                if (await store.loadManifest(agentId)) {
                    const doc = await vscode.workspace.openTextDocument(manifestPath);
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage(t.msg_manifest_opened);
                } else {
                    vscode.window.showWarningMessage('No manifest found for this agent');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_manifest_open_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.exportReport', async (agentId: AgentId) => {
            try {
                const report = await store.loadReport(agentId);
                if (report) {
                    const reportJson = JSON.stringify(report, null, 2);
                    const doc = await vscode.workspace.openTextDocument({
                        content: reportJson,
                        language: 'json'
                    });
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage(t.msg_report_exported);
                } else {
                    vscode.window.showWarningMessage('No report found for this agent');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_report_export_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.hitl.approve', async (agentId: AgentId, hitlId: string) => {
            try {
                await runtime.approveHITL(agentId, hitlId);
                vscode.window.showInformationMessage(t.msg_hitl_approved);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_hitl_action_failed}: ${error}`);
            }
        }),

        vscode.commands.registerCommand('keboola.agents.hitl.reject', async (agentId: AgentId, hitlId: string) => {
            try {
                await runtime.rejectHITL(agentId, hitlId);
                vscode.window.showInformationMessage(t.msg_hitl_rejected);
            } catch (error) {
                vscode.window.showErrorMessage(`${t.error_hitl_action_failed}: ${error}`);
            }
        })
    ];

    context.subscriptions.push(...commands);
} 