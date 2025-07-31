import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentId, AgentConfig, AgentRunState, AgentStatus, TraceEvent, AgentSettings, ProjectContext } from './types';
import { agentRunDir, agentsDir } from '../utils/pathBuilder';

export class AgentStore {
    private _onDidChangeRuns = new vscode.EventEmitter<void>();
    private _onDidCreateRun = new vscode.EventEmitter<AgentId>();
    private _onDidUpdateRun = new vscode.EventEmitter<AgentId>();
    private _onDidCompleteRun = new vscode.EventEmitter<AgentId>();
    
    readonly onDidChangeRuns = this._onDidChangeRuns.event;
    readonly onDidCreateRun = this._onDidCreateRun.event;
    readonly onDidUpdateRun = this._onDidUpdateRun.event;
    readonly onDidCompleteRun = this._onDidCompleteRun.event;

    private runs = new Map<AgentId, AgentRunState>();
    private dataDir: string;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.dataDir = this.getDataDir(context);
        this.ensureDataDir();
        this.loadExistingRuns();
    }

    private getDataDir(context: vscode.ExtensionContext): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // Use the new path structure - get the agents directory
            return agentsDir(context);
        }
        return path.join(context.globalStorageUri.fsPath, 'agents');
    }

    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    private loadExistingRuns(): void {
        try {
            // Check if the agents directory exists
            if (!fs.existsSync(this.dataDir)) {
                return;
            }

            const agentDirs = fs.readdirSync(this.dataDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const agentId of agentDirs) {
                const runStatePath = path.join(this.dataDir, agentId, 'run_state.json');
                if (fs.existsSync(runStatePath)) {
                    try {
                        const runStateData = fs.readFileSync(runStatePath, 'utf8');
                        const runState: AgentRunState = JSON.parse(runStateData);
                        this.runs.set(agentId, runState);
                    } catch (error) {
                        console.error(`Failed to load run state for agent ${agentId}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load existing runs:', error);
        }
    }

    async createRun(config: AgentConfig): Promise<AgentId> {
        const agentId = config.id;
        const agentDir = agentRunDir(this.context, agentId);
        
        // Create agent directory
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true });
        }

        // Save config
        const configPath = path.join(agentDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Create initial run state
        const runState: AgentRunState = {
            id: agentId,
            status: 'starting',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            progressPct: 0,
            confidencePct: 0,
            spentUSD: 0,
            spentTokens: 0,
            toolCalls: {},
            currentStepIndex: 0,
            plannedSteps: [],
            hitlRequests: []
        };

        // Save run state
        const runStatePath = path.join(agentDir, 'run_state.json');
        fs.writeFileSync(runStatePath, JSON.stringify(runState, null, 2));

        // Initialize traces file
        const tracesPath = path.join(agentDir, 'traces.ndjson');
        if (!fs.existsSync(tracesPath)) {
            fs.writeFileSync(tracesPath, '');
        }

        // Store in memory
        this.runs.set(agentId, runState);
        this._onDidCreateRun.fire(agentId);
        this._onDidChangeRuns.fire();

        return agentId;
    }

    async createDemoAgent(): Promise<AgentId> {
        const demoConfig: AgentConfig = {
            id: `demo-agent-${Date.now()}`,
            name: 'Demo Data Analysis Agent',
            goal: 'Analyze data and generate comprehensive reports',
            systemPrompt: 'You are a helpful data analysis assistant that can query storage, analyze data, and generate reports.',
            selectedLLM: 'gpt-4o-mini',
            allowedLLMs: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
            allowedTools: [
                { id: 'mcp://keboola/QueryStorage', name: 'Query Storage' },
                { id: 'mcp://keboola/AnalyzeData', name: 'Analyze Data' },
                { id: 'mcp://keboola/GenerateReport', name: 'Generate Report' }
            ],
            credentials: [],
            projects: [],
            defaultProjectId: 'default',
            budgetUSD: 5.0,
            tokenBudget: 5000,
            timeLimitSec: 1800,
            contactPolicy: 'notify',
            hitlTimeoutSec: 300,
            hitlFallback: 'pause',
            policy: {
                maxConcurrentTools: 3,
                rateLimitPerMin: 10,
                forbiddenActions: ['delete_table', 'external_http_post'],
                dataAccessScopes: ['storage.read', 'configs.read'],
                allowProjects: undefined,
                piiHandling: 'mask',
                escalationOnViolation: 'pause'
            }
        };

        return this.createRun(demoConfig);
    }

    async loadRun(agentId: AgentId): Promise<AgentRunState | undefined> {
        return this.runs.get(agentId);
    }

    async updateState(agentId: AgentId, patch: Partial<AgentRunState>): Promise<void> {
        const runState = this.runs.get(agentId);
        if (!runState) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const updatedState = { ...runState, ...patch, updatedAt: new Date().toISOString() };
        this.runs.set(agentId, updatedState);

        // Save to file
        const runStatePath = path.join(agentRunDir(this.context, agentId), 'run_state.json');
        fs.writeFileSync(runStatePath, JSON.stringify(updatedState, null, 2));

        this._onDidUpdateRun.fire(agentId);
        this._onDidChangeRuns.fire();
    }

    async saveTrace(agentId: AgentId, event: TraceEvent): Promise<void> {
        const tracesPath = path.join(agentRunDir(this.context, agentId), 'traces.ndjson');
        const traceLine = JSON.stringify(event) + '\n';
        fs.appendFileSync(tracesPath, traceLine);
    }

    async finalizeRun(agentId: AgentId, report: any): Promise<void> {
        const agentDir = agentRunDir(this.context, agentId);
        
        // Save report
        const reportPath = path.join(agentDir, 'report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        this._onDidCompleteRun.fire(agentId);
        this._onDidChangeRuns.fire();
    }

    listByStatus(status: AgentStatus): AgentRunState[] {
        return Array.from(this.runs.values()).filter(run => run.status === status);
    }

    listAll(): AgentRunState[] {
        return Array.from(this.runs.values());
    }

    getAgentDir(agentId: AgentId): string {
        return agentRunDir(this.context, agentId);
    }

    getTracesPath(agentId: AgentId): string {
        return path.join(agentRunDir(this.context, agentId), 'traces.ndjson');
    }

    getArtifactsDir(agentId: AgentId): string {
        return path.join(agentRunDir(this.context, agentId), 'artifacts');
    }

    getManifestPath(agentId: AgentId): string {
        return path.join(agentRunDir(this.context, agentId), 'manifest.json');
    }

    getReportPath(agentId: AgentId): string {
        return path.join(agentRunDir(this.context, agentId), 'report.json');
    }

    getConfigPath(agentId: AgentId): string {
        return path.join(agentRunDir(this.context, agentId), 'config.json');
    }

    async loadConfig(agentId: AgentId): Promise<AgentConfig | undefined> {
        const configPath = this.getConfigPath(agentId);
        if (!fs.existsSync(configPath)) {
            return undefined;
        }

        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Migrate old configs to multi-project format
            return this.migrateConfigIfNeeded(config);
        } catch (error) {
            console.error(`Failed to load config for agent ${agentId}:`, error);
            return undefined;
        }
    }

    private migrateConfigIfNeeded(config: any): AgentConfig {
        // Check if this is an old config without projects array
        if (!config.projects) {
            console.log(`Migrating agent config ${config.id} to multi-project format`);
            
            // Get the old single project credentials
            const oldToken = this.context.globalState.get<string>('keboola.token');
            const oldApiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            
            if (oldToken && oldApiUrl) {
                // Create default project context
                const defaultProject: ProjectContext = {
                    id: 'default',
                    name: 'Default',
                    stackUrl: oldApiUrl,
                    tokenSecretKey: 'keboola.token',
                    default: true
                };
                
                // Update config with multi-project structure
                config.projects = [defaultProject];
                config.defaultProjectId = 'default';
                
                // Save the migrated config
                const configPath = this.getConfigPath(config.id);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                
                // Mark as migrated in run state
                this.markAsMigrated(config.id);
            } else {
                // Fallback if no old credentials found
                config.projects = [];
                config.defaultProjectId = 'default';
            }
        }
        
        return config as AgentConfig;
    }

    private markAsMigrated(agentId: AgentId): void {
        const runStatePath = path.join(agentRunDir(this.context, agentId), 'run_state.json');
        if (fs.existsSync(runStatePath)) {
            try {
                const runStateData = fs.readFileSync(runStatePath, 'utf8');
                const runState = JSON.parse(runStateData);
                runState.migratedToMultiProject = true;
                fs.writeFileSync(runStatePath, JSON.stringify(runState, null, 2));
            } catch (error) {
                console.error(`Failed to mark agent ${agentId} as migrated:`, error);
            }
        }
    }

    async loadTraces(agentId: AgentId): Promise<TraceEvent[]> {
        const tracesPath = this.getTracesPath(agentId);
        if (!fs.existsSync(tracesPath)) {
            return [];
        }

        try {
            const tracesData = fs.readFileSync(tracesPath, 'utf8');
            return tracesData
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        } catch (error) {
            console.error(`Failed to load traces for agent ${agentId}:`, error);
            return [];
        }
    }

    async loadManifest(agentId: AgentId): Promise<any | undefined> {
        const manifestPath = this.getManifestPath(agentId);
        if (!fs.existsSync(manifestPath)) {
            return undefined;
        }

        try {
            const manifestData = fs.readFileSync(manifestPath, 'utf8');
            return JSON.parse(manifestData);
        } catch (error) {
            console.error(`Failed to load manifest for agent ${agentId}:`, error);
            return undefined;
        }
    }

    async loadReport(agentId: AgentId): Promise<any | undefined> {
        const reportPath = this.getReportPath(agentId);
        if (!fs.existsSync(reportPath)) {
            return undefined;
        }

        try {
            const reportData = fs.readFileSync(reportPath, 'utf8');
            return JSON.parse(reportData);
        } catch (error) {
            console.error(`Failed to load report for agent ${agentId}:`, error);
            return undefined;
        }
    }

    async listArtifacts(agentId: AgentId): Promise<string[]> {
        const artifactsDir = this.getArtifactsDir(agentId);
        if (!fs.existsSync(artifactsDir)) {
            return [];
        }

        try {
            return fs.readdirSync(artifactsDir)
                .filter(file => !file.startsWith('.'))
                .map(file => path.join(artifactsDir, file));
        } catch (error) {
            console.error(`Failed to list artifacts for agent ${agentId}:`, error);
            return [];
        }
    }

    async deleteRun(agentId: AgentId): Promise<void> {
        const agentDir = agentRunDir(this.context, agentId);
        if (fs.existsSync(agentDir)) {
            fs.rmSync(agentDir, { recursive: true, force: true });
        }
        
        this.runs.delete(agentId);
        this._onDidChangeRuns.fire();
    }

    refresh(): void {
        this._onDidChangeRuns.fire();
    }
} 