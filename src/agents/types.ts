export type AgentId = string;
export type AgentStatus = 'starting' | 'running' | 'waiting_hitl' | 'paused' | 'completed' | 'failed';

export interface AgentConfig {
    id: AgentId;
    name: string;
    goal: string;
    systemPrompt: string;
    selectedLLM: string;            // one of allowedLLMs
    allowedLLMs: string[];
    allowedTools: MCPToolRef[];     // tool registry entries (ids + display names)
    credentials: CredentialRef[];   // only labels/ids; no secrets in files
    budgetUSD: number;
    tokenBudget: number;            // optional, 0 = unlimited
    timeLimitSec: number;
    contactPolicy: 'notify' | 'notify_modal' | 'log_only';
    hitlTimeoutSec: number;
    hitlFallback: 'pause' | 'continue_safe' | 'stop';
    policy: AgentPolicy;            // guardrails
}

export interface AgentPolicy {
    maxConcurrentTools: number;
    rateLimitPerMin: number;
    forbiddenActions: string[];     // e.g. 'delete_table', 'external_http_post'
    dataAccessScopes: string[];     // e.g. 'storage.read', 'configs.read'
    piiHandling: 'mask' | 'deny' | 'allow';
    escalationOnViolation: 'pause' | 'stop';
}

export interface MCPToolRef {
    id: string;                     // mcp://server/toolName
    name: string;
    description?: string;
}

export interface CredentialRef {
    id: string;                     // reference to VS Code SecretStorage key
    label: string;
}

export interface AgentRunState {
    id: AgentId;
    status: AgentStatus;
    createdAt: string;
    updatedAt: string;
    progressPct: number;            // 0..100
    confidencePct: number;          // heuristic, 0..100
    spentUSD: number;
    spentTokens: number;
    toolCalls: Record<string, number>; // by tool id
    currentStepIndex: number;
    plannedSteps: PlannedStep[];
    lastMessage?: string;
    hitlRequests: HITLRequest[];
}

export interface PlannedStep {
    id: string;
    title: string;
    kind: 'thought' | 'tool' | 'message' | 'check';
    toolId?: string;
    estTokens?: number;
    estUSD?: number;
}

export interface HITLRequest {
    id: string;
    createdAt: string;
    question: string;
    payload?: any;
    status: 'pending' | 'approved' | 'rejected';
    resolvedAt?: string;
    resolutionComment?: string;
}

export interface TraceEvent {
    timestamp: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    attributes: Record<string, any>;
    duration_ms?: number;
}

export interface AgentManifest {
    runId: string;
    createdAt: string;
    completedAt?: string;
    config: AgentConfig;
    policy: AgentPolicy;
    environment: {
        workspace: string;
        extensionVersion: string;
    };
    toolRegistry: MCPToolRef[];
    llm: {
        model: string;
        provider: string;
    };
    seed: string;
    snapshot: AgentRunState;
    artifacts: string[];
    costSummary: {
        tokens: number;
        usd: number;
        toolCalls: Record<string, number>;
    };
}

export interface AgentReport {
    id: string;
    createdAt: string;
    completedAt?: string;
    status: AgentStatus;
    summary: string;
    metrics: {
        totalSteps: number;
        totalToolCalls: number;
        totalHITLRequests: number;
        totalCostUSD: number;
        totalTokens: number;
        averageConfidence: number;
    };
    learnings: string[];
    artifacts: string[];
}

export interface AgentSettings {
    defaultModel: string;
    defaultBudgetUSD: number;
    defaultTokenBudget: number;
    defaultTimeLimitSec: number;
    allowedLLMs: string[];
    allowedTools: string[];
    contactPolicy: 'notify' | 'notify_modal' | 'log_only';
    hitlTimeoutSec: number;
    hitlFallback: 'pause' | 'continue_safe' | 'stop';
    exportTracesToFile: boolean;
    dataDir: string;
    enableSimulatedEvents: boolean; // Enable/disable HITL and policy violation simulation
}

export interface AgentRuntimeHooks {
    onTick?: (state: AgentRunState) => void;
    onPolicyViolation?: (violation: PolicyViolation) => void;
    onTrace?: (event: TraceEvent) => void;
    onStateChange?: (oldState: AgentStatus, newState: AgentStatus) => void;
}

export interface PolicyViolation {
    type: 'forbidden_action' | 'rate_limit' | 'concurrent_tools' | 'pii_detected';
    action: string;
    details: string;
    escalation: 'pause' | 'stop';
}

import * as vscode from 'vscode';

export interface AgentStoreEvents {
    onDidChangeRuns: vscode.Event<void>;
    onDidCreateRun: vscode.Event<AgentId>;
    onDidUpdateRun: vscode.Event<AgentId>;
    onDidCompleteRun: vscode.Event<AgentId>;
} 