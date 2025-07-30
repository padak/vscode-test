import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AgentManifest, AgentConfig, AgentRunState, AgentPolicy, MCPToolRef } from './types';

export class AgentManifestBuilder {
    private config: AgentConfig;
    private runState: AgentRunState;
    private toolRegistry: MCPToolRef[];
    private artifacts: string[];
    private extensionVersion: string;
    private workspacePath: string;

    constructor(
        config: AgentConfig,
        runState: AgentRunState,
        toolRegistry: MCPToolRef[],
        artifacts: string[],
        extensionVersion: string,
        workspacePath: string
    ) {
        this.config = config;
        this.runState = runState;
        this.toolRegistry = toolRegistry;
        this.artifacts = artifacts;
        this.extensionVersion = extensionVersion;
        this.workspacePath = workspacePath;
    }

    buildManifest(): AgentManifest {
        const runId = this.generateRunId();
        const seed = this.generateSeed();
        const costSummary = this.calculateCostSummary();

        return {
            runId,
            createdAt: this.runState.createdAt,
            completedAt: this.runState.status === 'completed' || this.runState.status === 'failed' 
                ? this.runState.updatedAt 
                : undefined,
            config: this.sanitizeConfig(),
            policy: this.config.policy,
            environment: {
                workspace: this.workspacePath,
                extensionVersion: this.extensionVersion
            },
            toolRegistry: this.toolRegistry,
            llm: {
                model: this.config.selectedLLM,
                provider: this.getProviderFromModel(this.config.selectedLLM)
            },
            seed,
            snapshot: this.runState,
            artifacts: this.artifacts,
            costSummary
        };
    }

    private generateRunId(): string {
        const timestamp = new Date().toISOString();
        const hash = crypto.createHash('md5')
            .update(`${this.config.id}_${timestamp}_${this.config.name}`)
            .digest('hex');
        return `run_${hash.substring(0, 8)}`;
    }

    private generateSeed(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    private sanitizeConfig(): AgentConfig {
        // Create a copy of config without sensitive information
        const sanitized = { ...this.config };
        
        // Remove or mask sensitive fields
        sanitized.credentials = sanitized.credentials.map(cred => ({
            id: cred.id,
            label: cred.label
        }));

        return sanitized;
    }

    private getProviderFromModel(model: string): string {
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt')) return 'OpenAI';
        if (modelLower.includes('claude')) return 'Anthropic';
        if (modelLower.includes('gemini')) return 'Google';
        if (modelLower.includes('llama')) return 'Meta';
        return 'Unknown';
    }

    private calculateCostSummary(): { tokens: number; usd: number; toolCalls: Record<string, number> } {
        return {
            tokens: this.runState.spentTokens,
            usd: this.runState.spentUSD,
            toolCalls: { ...this.runState.toolCalls }
        };
    }

    async saveManifest(outputPath: string): Promise<void> {
        const manifest = this.buildManifest();
        const manifestJson = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(outputPath, manifestJson);
    }

    async exportManifest(outputDir: string): Promise<string> {
        const manifest = this.buildManifest();
        const filename = `manifest_${manifest.runId}_${new Date().toISOString().split('T')[0]}.json`;
        const outputPath = path.join(outputDir, filename);
        
        await this.saveManifest(outputPath);
        return outputPath;
    }

    static async loadManifest(manifestPath: string): Promise<AgentManifest> {
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Manifest file not found: ${manifestPath}`);
        }

        const manifestData = fs.readFileSync(manifestPath, 'utf8');
        return JSON.parse(manifestData);
    }

    static validateManifest(manifest: AgentManifest): string[] {
        const errors: string[] = [];

        if (!manifest.runId) {
            errors.push('Missing runId');
        }

        if (!manifest.createdAt) {
            errors.push('Missing createdAt');
        }

        if (!manifest.config) {
            errors.push('Missing config');
        }

        if (!manifest.policy) {
            errors.push('Missing policy');
        }

        if (!manifest.environment) {
            errors.push('Missing environment');
        }

        if (!manifest.llm) {
            errors.push('Missing llm');
        }

        if (!manifest.snapshot) {
            errors.push('Missing snapshot');
        }

        if (!manifest.costSummary) {
            errors.push('Missing costSummary');
        }

        return errors;
    }

    static getManifestSummary(manifest: AgentManifest): any {
        return {
            runId: manifest.runId,
            createdAt: manifest.createdAt,
            completedAt: manifest.completedAt,
            agentName: manifest.config.name,
            agentGoal: manifest.config.goal,
            status: manifest.snapshot.status,
            finalProgress: manifest.snapshot.progressPct,
            finalConfidence: manifest.snapshot.confidencePct,
            totalCost: manifest.costSummary.usd,
            totalTokens: manifest.costSummary.tokens,
            totalToolCalls: Object.values(manifest.costSummary.toolCalls).reduce((a, b) => a + b, 0),
            artifactsCount: manifest.artifacts.length,
            model: manifest.llm.model,
            provider: manifest.llm.provider,
            toolsCount: manifest.toolRegistry.length
        };
    }

    static async exportManifestToHtml(manifest: AgentManifest, outputPath: string): Promise<void> {
        const summary = this.getManifestSummary(manifest);
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Agent Run Manifest - ${summary.agentName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e8f4fd; border-radius: 3px; }
        .status-${summary.status} { color: ${summary.status === 'completed' ? 'green' : summary.status === 'failed' ? 'red' : 'orange'}; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Agent Run Manifest</h1>
        <h2>${summary.agentName}</h2>
        <p><strong>Goal:</strong> ${summary.agentGoal}</p>
        <p><strong>Run ID:</strong> ${summary.runId}</p>
        <p><strong>Status:</strong> <span class="status-${summary.status}">${summary.status}</span></p>
    </div>

    <div class="section">
        <h3>Metrics</h3>
        <div class="metric"><strong>Progress:</strong> ${summary.finalProgress}%</div>
        <div class="metric"><strong>Confidence:</strong> ${summary.finalConfidence}%</div>
        <div class="metric"><strong>Cost:</strong> $${summary.totalCost.toFixed(2)}</div>
        <div class="metric"><strong>Tokens:</strong> ${summary.totalTokens.toLocaleString()}</div>
        <div class="metric"><strong>Tool Calls:</strong> ${summary.totalToolCalls}</div>
        <div class="metric"><strong>Artifacts:</strong> ${summary.artifactsCount}</div>
    </div>

    <div class="section">
        <h3>Configuration</h3>
        <pre>${JSON.stringify(manifest.config, null, 2)}</pre>
    </div>

    <div class="section">
        <h3>Policy</h3>
        <pre>${JSON.stringify(manifest.policy, null, 2)}</pre>
    </div>

    <div class="section">
        <h3>Environment</h3>
        <pre>${JSON.stringify(manifest.environment, null, 2)}</pre>
    </div>

    <div class="section">
        <h3>Tools</h3>
        <pre>${JSON.stringify(manifest.toolRegistry, null, 2)}</pre>
    </div>

    <div class="section">
        <h3>Final State</h3>
        <pre>${JSON.stringify(manifest.snapshot, null, 2)}</pre>
    </div>

    <div class="section">
        <h3>Artifacts</h3>
        <ul>
            ${manifest.artifacts.map(artifact => `<li>${artifact}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;

        fs.writeFileSync(outputPath, html);
    }
} 