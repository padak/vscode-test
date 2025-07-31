import * as vscode from 'vscode';
import { AgentId, AgentConfig, AgentRunState, AgentStatus, PlannedStep, HITLRequest, AgentRuntimeHooks, PolicyViolation } from './types';
import { AgentStore } from './AgentStore';
import { AgentTraces } from './AgentTraces';
import { PolicyEnforcer } from './AgentPolicy';
import { getPreset } from './presets/agents';

export class AgentRuntime {
    private store: AgentStore;
    private hooks: AgentRuntimeHooks;
    private settings: { enableSimulatedEvents: boolean };
    private runningAgents = new Map<AgentId, {
        config: AgentConfig;
        runState: AgentRunState;
        enforcer: PolicyEnforcer;
        tickInterval: NodeJS.Timeout;
        startTime: Date;
    }>();

    constructor(store: AgentStore, hooks: AgentRuntimeHooks = {}, settings: { enableSimulatedEvents: boolean } = { enableSimulatedEvents: true }) {
        this.store = store;
        this.hooks = hooks;
        this.settings = settings;
    }

    async startAgent(agentId: AgentId): Promise<void> {
        const config = await this.store.loadConfig(agentId);
        const runState = await this.store.loadRun(agentId);

        if (!config || !runState) {
            throw new Error(`Agent ${agentId} not found`);
        }

        if (runState.status !== 'starting') {
            throw new Error(`Agent ${agentId} is not in starting state`);
        }

        // Create policy enforcer
        const enforcer = new PolicyEnforcer(config.policy);

        // Update state to running
        await this.store.updateState(agentId, {
            status: 'running',
            progressPct: 0,
            confidencePct: 10
        });

        // Create planned steps (simulated)
        const plannedSteps = this.generatePlannedSteps(config);
        await this.store.updateState(agentId, { plannedSteps });

        // Apply preset if specified
        if (config.presetId) {
            await this.applyPresetPlanIfEmpty(agentId, config.presetId, plannedSteps);
        }

        // Emit start trace
        const startTrace = AgentTraces.createAgentStartEvent(config, runState);
        await this.store.saveTrace(agentId, startTrace);

        // Emit preset selected trace if applicable
        if (config.presetId) {
            const preset = getPreset(config.presetId);
            if (preset) {
                const presetTrace = AgentTraces.createPresetSelectedEvent(config.presetId, preset.name);
                await this.store.saveTrace(agentId, presetTrace);
            }
        }

        // Start tick interval
        const tickInterval = setInterval(async () => {
            await this.tick(agentId);
        }, 3000); // Tick every 3 seconds

        // Store runtime info
        this.runningAgents.set(agentId, {
            config,
            runState: { ...runState, status: 'running', plannedSteps },
            enforcer,
            tickInterval,
            startTime: new Date()
        });

        this.hooks.onStateChange?.('starting', 'running');
    }

    async pauseAgent(agentId: AgentId): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} is not running`);
        }

        clearInterval(agent.tickInterval);
        this.runningAgents.delete(agentId);

        await this.store.updateState(agentId, { status: 'paused' });
        this.hooks.onStateChange?.('running', 'paused');
    }

    async resumeAgent(agentId: AgentId): Promise<void> {
        const runState = await this.store.loadRun(agentId);
        if (!runState || runState.status !== 'paused') {
            throw new Error(`Agent ${agentId} is not paused`);
        }

        await this.startAgent(agentId);
    }

    async stopAgent(agentId: AgentId): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (agent) {
            clearInterval(agent.tickInterval);
            this.runningAgents.delete(agentId);
        }

        await this.store.updateState(agentId, { status: 'failed' });
        this.hooks.onStateChange?.('running', 'failed');
    }

    async approveHITL(agentId: AgentId, hitlId: string, comment?: string): Promise<void> {
        const runState = await this.store.loadRun(agentId);
        if (!runState) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const hitlRequest = runState.hitlRequests.find(req => req.id === hitlId);
        if (!hitlRequest || hitlRequest.status !== 'pending') {
            throw new Error(`HITL request ${hitlId} not found or not pending`);
        }

        // Update HITL request
        hitlRequest.status = 'approved';
        hitlRequest.resolvedAt = new Date().toISOString();
        hitlRequest.resolutionComment = comment;

        await this.store.updateState(agentId, { hitlRequests: runState.hitlRequests });

        // Resume agent if it was waiting for HITL
        if (runState.status === 'waiting_hitl') {
            await this.store.updateState(agentId, { status: 'running' });
            this.hooks.onStateChange?.('waiting_hitl', 'running');
        }
    }

    async rejectHITL(agentId: AgentId, hitlId: string, comment?: string): Promise<void> {
        const runState = await this.store.loadRun(agentId);
        if (!runState) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const hitlRequest = runState.hitlRequests.find(req => req.id === hitlId);
        if (!hitlRequest || hitlRequest.status !== 'pending') {
            throw new Error(`HITL request ${hitlId} not found or not pending`);
        }

        // Update HITL request
        hitlRequest.status = 'rejected';
        hitlRequest.resolvedAt = new Date().toISOString();
        hitlRequest.resolutionComment = comment;

        await this.store.updateState(agentId, { hitlRequests: runState.hitlRequests });

        // Stop agent if HITL was rejected
        await this.stopAgent(agentId);
    }

    private async tick(agentId: AgentId): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) {
            return;
        }

        const { config, runState, enforcer } = agent;

        // Check budget limits
        const budgetViolation = enforcer.validateBudget(runState, config);
        if (budgetViolation) {
            await this.handlePolicyViolation(agentId, budgetViolation);
            return;
        }

        // Get current step
        const currentStep = runState.plannedSteps[runState.currentStepIndex];
        if (!currentStep) {
            // Agent completed all steps
            await this.completeAgent(agentId);
            return;
        }

        // Simulate step execution
        await this.executeStep(agentId, currentStep);

        // Update progress
        const progressPct = Math.min(100, ((runState.currentStepIndex + 1) / runState.plannedSteps.length) * 100);
        const confidencePct = Math.min(100, progressPct + Math.random() * 20);

        await this.store.updateState(agentId, {
            currentStepIndex: runState.currentStepIndex + 1,
            progressPct,
            confidencePct
        });

        // Emit tick trace
        const tickTrace = AgentTraces.createAgentTickEvent(runState, config);
        await this.store.saveTrace(agentId, tickTrace);

        this.hooks.onTick?.(runState);
    }

    private async executeStep(agentId: AgentId, step: PlannedStep): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState, enforcer } = agent;

        // Emit step trace
        const stepTrace = AgentTraces.createStepEvent(step, runState, config);
        await this.store.saveTrace(agentId, stepTrace);

        // Simulate token usage
        const inputTokens = step.estTokens || Math.floor(Math.random() * 100) + 50;
        const outputTokens = Math.floor(inputTokens * 0.7);
        const totalTokens = inputTokens + outputTokens;

        // Simulate cost (rough estimate)
        const costPer1K = this.getCostPer1K(config.selectedLLM);
        const cost = (totalTokens / 1000) * costPer1K;

        // Update spent amounts
        const newSpentTokens = runState.spentTokens + totalTokens;
        const newSpentUSD = runState.spentUSD + cost;

        // Update tool calls if applicable
        const newToolCalls = { ...runState.toolCalls };
        if (step.toolId) {
            newToolCalls[step.toolId] = (newToolCalls[step.toolId] || 0) + 1;
        }

        await this.store.updateState(agentId, {
            spentTokens: newSpentTokens,
            spentUSD: newSpentUSD,
            toolCalls: newToolCalls
        });

        // Simulate tool call if applicable
        if (step.toolId) {
            await this.simulateToolCall(agentId, step.toolId, step.title);
        }

        // Occasionally require HITL (only if simulated events are enabled)
        if (this.settings.enableSimulatedEvents && Math.random() < 0.01) { // 1% chance (reduced from 10%)
            await this.requireHITL(agentId, step);
        }

        // Occasionally trigger policy violation (only if simulated events are enabled)
        if (this.settings.enableSimulatedEvents && Math.random() < 0.005) { // 0.5% chance (reduced from 5%)
            const violation = this.simulatePolicyViolation(step);
            if (violation) {
                await this.handlePolicyViolation(agentId, violation);
            }
        }
    }

    private async simulateToolCall(agentId: AgentId, toolId: string, toolName: string): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState, enforcer } = agent;

        // Validate tool call
        const violation = enforcer.validateToolCall(toolId);
        if (violation) {
            await this.handlePolicyViolation(agentId, violation);
            return;
        }

        // Simulate latency
        const latency = Math.floor(Math.random() * 1000) + 200;
        await new Promise(resolve => setTimeout(resolve, latency));

        // Emit tool call trace
        const toolTrace = AgentTraces.createToolCallEvent(
            toolId,
            toolName,
            `inv_${Date.now()}`,
            runState,
            config,
            undefined,
            true,
            latency
        );
        await this.store.saveTrace(agentId, toolTrace);

        // Complete tool call
        enforcer.completeToolCall(toolId);

        // Create artifact occasionally
        if (Math.random() < 0.3) { // 30% chance
            await this.createArtifact(agentId, toolName);
        }
    }

    private async requireHITL(agentId: AgentId, step: PlannedStep): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState } = agent;

        const hitlRequest: HITLRequest = {
            id: `hitl_${Date.now()}`,
            createdAt: new Date().toISOString(),
            question: `Should the agent proceed with: ${step.title}?`,
            status: 'pending'
        };

        const newHITLRequests = [...runState.hitlRequests, hitlRequest];

        await this.store.updateState(agentId, {
            status: 'waiting_hitl',
            hitlRequests: newHITLRequests
        });

        // Emit HITL trace
        const hitlTrace = AgentTraces.createHITLEvent(hitlRequest, runState, config);
        await this.store.saveTrace(agentId, hitlTrace);

        this.hooks.onStateChange?.('running', 'waiting_hitl');
    }

    private simulatePolicyViolation(step: PlannedStep): PolicyViolation | null {
        const violations = [
            {
                type: 'forbidden_action' as const,
                action: 'delete_table',
                details: 'Attempted to delete table without proper authorization',
                escalation: 'pause' as const
            },
            {
                type: 'rate_limit' as const,
                action: 'tool_call:QueryStorage',
                details: 'Rate limit exceeded for storage queries',
                escalation: 'pause' as const
            },
            {
                type: 'pii_detected' as const,
                action: 'pii_detection',
                details: 'PII detected in output data',
                escalation: 'pause' as const
            }
        ];

        return violations[Math.floor(Math.random() * violations.length)];
    }

    private async handlePolicyViolation(agentId: AgentId, violation: PolicyViolation): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState } = agent;

        // Emit violation trace
        const violationTrace = AgentTraces.createPolicyViolationEvent(violation, runState, config);
        await this.store.saveTrace(agentId, violationTrace);

        if (violation.escalation === 'stop') {
            await this.stopAgent(agentId);
        } else if (violation.escalation === 'pause') {
            await this.pauseAgent(agentId);
        }

        this.hooks.onPolicyViolation?.(violation);
    }

    private async createArtifact(agentId: AgentId, toolName: string): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState } = agent;
        const artifactsDir = this.store.getArtifactsDir(agentId);

        const artifactTypes = {
            'QueryStorage': 'data_report.csv',
            'AnalyzeData': 'analysis_report.json',
            'GenerateReport': 'report.md',
            'default': 'output.txt'
        };

        const filename = artifactTypes[toolName as keyof typeof artifactTypes] || artifactTypes.default;
        const artifactPath = `${artifactsDir}/${filename}`;

        // Create dummy artifact content
        const content = `Generated by ${toolName} at ${new Date().toISOString()}\nAgent: ${config.name}\nProgress: ${runState.progressPct}%`;
        
        const fs = require('fs');
        fs.writeFileSync(artifactPath, content);

        // Emit artifact trace
        const artifactTrace = AgentTraces.createArtifactEvent(artifactPath, filename, runState, config);
        await this.store.saveTrace(agentId, artifactTrace);
    }

    private async completeAgent(agentId: AgentId): Promise<void> {
        const agent = this.runningAgents.get(agentId);
        if (!agent) return;

        const { config, runState } = agent;

        clearInterval(agent.tickInterval);
        this.runningAgents.delete(agentId);

        // Update final state
        await this.store.updateState(agentId, {
            status: 'completed',
            progressPct: 100,
            confidencePct: 95
        });

        // Create final report
        const report = this.createFinalReport(agentId, runState);
        await this.store.finalizeRun(agentId, report);

        // Emit completion trace
        const finalMetrics = {
            totalSteps: runState.plannedSteps.length,
            totalToolCalls: Object.values(runState.toolCalls).reduce((a, b) => a + b, 0),
            totalHITLRequests: runState.hitlRequests.length
        };
        const completionTrace = AgentTraces.createAgentCompleteEvent(runState, config, finalMetrics);
        await this.store.saveTrace(agentId, completionTrace);

        this.hooks.onStateChange?.('running', 'completed');
    }

    private createFinalReport(agentId: AgentId, runState: AgentRunState): any {
        return {
            id: agentId,
            createdAt: runState.createdAt,
            completedAt: new Date().toISOString(),
            status: 'completed',
            summary: `Agent completed successfully with ${runState.plannedSteps.length} steps`,
            metrics: {
                totalSteps: runState.plannedSteps.length,
                totalToolCalls: Object.values(runState.toolCalls).reduce((a, b) => a + b, 0),
                totalHITLRequests: runState.hitlRequests.length,
                totalCostUSD: runState.spentUSD,
                totalTokens: runState.spentTokens,
                averageConfidence: runState.confidencePct
            },
            learnings: [
                'Successfully completed all planned steps',
                'Maintained policy compliance throughout execution',
                'Generated useful artifacts for analysis'
            ],
            artifacts: [] // Will be populated by store
        };
    }

    private generatePlannedSteps(config: AgentConfig): PlannedStep[] {
        const steps: PlannedStep[] = [];
        const numSteps = Math.floor(Math.random() * 5) + 3; // 3-7 steps

        const stepTypes = [
            { kind: 'thought' as const, title: 'Analyzing requirements' },
            { kind: 'tool' as const, title: 'Querying storage data', toolId: 'QueryStorage' },
            { kind: 'tool' as const, title: 'Analyzing data patterns', toolId: 'AnalyzeData' },
            { kind: 'check' as const, title: 'Validating results' },
            { kind: 'tool' as const, title: 'Generating report', toolId: 'GenerateReport' },
            { kind: 'message' as const, title: 'Preparing summary' }
        ];

        for (let i = 0; i < numSteps; i++) {
            const stepType = stepTypes[i % stepTypes.length];
            steps.push({
                id: `step_${i + 1}`,
                title: `${stepType.title} (step ${i + 1})`,
                kind: stepType.kind,
                toolId: stepType.toolId,
                estTokens: Math.floor(Math.random() * 200) + 100,
                estUSD: Math.random() * 0.1
            });
        }

        return steps;
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

    isRunning(agentId: AgentId): boolean {
        return this.runningAgents.has(agentId);
    }

    getRunningAgents(): AgentId[] {
        return Array.from(this.runningAgents.keys());
    }

    stopAll(): void {
        for (const agentId of this.runningAgents.keys()) {
            this.stopAgent(agentId);
        }
    }

    private async applyPresetPlanIfEmpty(agentId: AgentId, presetId: string, currentSteps: PlannedStep[]): Promise<void> {
        const preset = getPreset(presetId);
        if (!preset) {
            return;
        }

        // If no user-defined steps were provided, use preset steps
        if (currentSteps.length <= 1) { // Only the default "analyze goal" step
            const presetSteps = [...preset.plannedSteps]; // Copy to avoid mutation
            
            // Ensure at least one HITL step if preset contains one
            const hasHITLStep = presetSteps.some(step => step.kind === 'message');
            if (hasHITLStep && this.settings.enableSimulatedEvents) {
                // Mark HITL steps as waiting
                presetSteps.forEach(step => {
                    if (step.kind === 'message') {
                        step.title += ' (HITL)';
                    }
                });
            }

            await this.store.updateState(agentId, { plannedSteps: presetSteps });

            // Seed progress/metrics counters for the chosen preset
            if (preset.defaultMetrics) {
                const metrics = preset.defaultMetrics.reduce((acc, metric) => {
                    acc[metric] = 0;
                    return acc;
                }, {} as Record<string, number>);
                
                // Store metrics in run state (this would need to be added to AgentRunState type)
                // For now, we'll just log them
                console.log(`Seeded metrics for preset ${presetId}:`, metrics);
            }
        }
    }
} 