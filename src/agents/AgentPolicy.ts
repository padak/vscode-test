import { AgentPolicy, PolicyViolation, AgentRunState, AgentConfig } from './types';

export class PolicyEnforcer {
    private policy: AgentPolicy;
    private currentToolCalls: Set<string> = new Set();
    private rateLimitCounts: Map<string, number> = new Map();
    private rateLimitTimestamps: Map<string, number[]> = new Map();

    constructor(policy: AgentPolicy) {
        this.policy = policy;
    }

    validateAction(action: string, context: any = {}): PolicyViolation | null {
        // Check forbidden actions
        if (this.policy.forbiddenActions.includes(action)) {
            return {
                type: 'forbidden_action',
                action,
                details: `Action "${action}" is forbidden by policy`,
                escalation: this.policy.escalationOnViolation
            };
        }

        // Check data access scopes
        if (context.dataAccess && !this.hasDataAccessScope(context.dataAccess)) {
            return {
                type: 'forbidden_action',
                action,
                details: `Data access scope "${context.dataAccess}" not allowed`,
                escalation: this.policy.escalationOnViolation
            };
        }

        return null;
    }

    validateToolCall(toolId: string, context: any = {}): PolicyViolation | null {
        // Check concurrent tools limit
        if (this.currentToolCalls.size >= this.policy.maxConcurrentTools) {
            return {
                type: 'concurrent_tools',
                action: `tool_call:${toolId}`,
                details: `Maximum concurrent tools (${this.policy.maxConcurrentTools}) exceeded`,
                escalation: this.policy.escalationOnViolation
            };
        }

        // Check rate limits
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Clean old timestamps
        if (!this.rateLimitTimestamps.has(toolId)) {
            this.rateLimitTimestamps.set(toolId, []);
        }
        const timestamps = this.rateLimitTimestamps.get(toolId)!;
        const recentCalls = timestamps.filter(timestamp => timestamp > oneMinuteAgo);
        this.rateLimitTimestamps.set(toolId, recentCalls);

        if (recentCalls.length >= this.policy.rateLimitPerMin) {
            return {
                type: 'rate_limit',
                action: `tool_call:${toolId}`,
                details: `Rate limit exceeded for tool ${toolId} (${this.policy.rateLimitPerMin} calls per minute)`,
                escalation: this.policy.escalationOnViolation
            };
        }

        // Add current call to rate limit tracking
        recentCalls.push(now);
        this.rateLimitTimestamps.set(toolId, recentCalls);

        // Add to concurrent tools
        this.currentToolCalls.add(toolId);

        return null;
    }

    completeToolCall(toolId: string): void {
        this.currentToolCalls.delete(toolId);
    }

    validatePII(content: string): PolicyViolation | null {
        if (this.policy.piiHandling === 'allow') {
            return null;
        }

        const piiPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
            /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
            /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP
            /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/g, // Credit card
        ];

        for (const pattern of piiPatterns) {
            if (pattern.test(content)) {
                if (this.policy.piiHandling === 'deny') {
                    return {
                        type: 'pii_detected',
                        action: 'pii_detection',
                        details: 'PII detected in content and policy requires denial',
                        escalation: this.policy.escalationOnViolation
                    };
                }
                // For 'mask' policy, we'll return a violation but allow processing with masking
                return {
                    type: 'pii_detected',
                    action: 'pii_detection',
                    details: 'PII detected in content, should be masked',
                    escalation: 'pause' // Pause to allow masking
                };
            }
        }

        return null;
    }

    maskPII(content: string): string {
        return content
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****') // SSN
            .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '***-***-****') // Phone
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***') // Email
            .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***.***.***.***') // IP
            .replace(/\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/g, '**** **** **** ****'); // Credit card
    }

    private hasDataAccessScope(requiredScope: string): boolean {
        return this.policy.dataAccessScopes.includes(requiredScope) ||
               this.policy.dataAccessScopes.includes('*');
    }

    validateBudget(runState: AgentRunState, config: AgentConfig): PolicyViolation | null {
        // Check USD budget
        if (config.budgetUSD > 0 && runState.spentUSD >= config.budgetUSD) {
            return {
                type: 'forbidden_action',
                action: 'budget_exceeded',
                details: `USD budget exceeded (${runState.spentUSD}/${config.budgetUSD})`,
                escalation: 'stop'
            };
        }

        // Check token budget
        if (config.tokenBudget > 0 && runState.spentTokens >= config.tokenBudget) {
            return {
                type: 'forbidden_action',
                action: 'budget_exceeded',
                details: `Token budget exceeded (${runState.spentTokens}/${config.tokenBudget})`,
                escalation: 'stop'
            };
        }

        // Check time limit
        const elapsedSeconds = this.calculateElapsedSeconds(runState.createdAt);
        if (config.timeLimitSec > 0 && elapsedSeconds >= config.timeLimitSec) {
            return {
                type: 'forbidden_action',
                action: 'time_limit_exceeded',
                details: `Time limit exceeded (${elapsedSeconds}/${config.timeLimitSec}s)`,
                escalation: 'stop'
            };
        }

        return null;
    }

    private calculateElapsedSeconds(createdAt: string): number {
        const created = new Date(createdAt);
        const now = new Date();
        return Math.floor((now.getTime() - created.getTime()) / 1000);
    }

    getPolicySummary(): any {
        return {
            maxConcurrentTools: this.policy.maxConcurrentTools,
            rateLimitPerMin: this.policy.rateLimitPerMin,
            forbiddenActions: this.policy.forbiddenActions,
            dataAccessScopes: this.policy.dataAccessScopes,
            piiHandling: this.policy.piiHandling,
            escalationOnViolation: this.policy.escalationOnViolation,
            currentConcurrentTools: this.currentToolCalls.size,
            rateLimitStatus: Object.fromEntries(
                Array.from(this.rateLimitTimestamps.entries()).map(([toolId, timestamps]) => [
                    toolId,
                    timestamps.filter(t => t > Date.now() - 60000).length
                ])
            )
        };
    }

    reset(): void {
        this.currentToolCalls.clear();
        this.rateLimitCounts.clear();
        this.rateLimitTimestamps.clear();
    }
}

export class PolicyValidator {
    static validatePolicy(policy: AgentPolicy): string[] {
        const errors: string[] = [];

        if (policy.maxConcurrentTools < 1) {
            errors.push('Max concurrent tools must be at least 1');
        }

        if (policy.rateLimitPerMin < 1) {
            errors.push('Rate limit per minute must be at least 1');
        }

        if (!['mask', 'deny', 'allow'].includes(policy.piiHandling)) {
            errors.push('PII handling must be one of: mask, deny, allow');
        }

        if (!['pause', 'stop'].includes(policy.escalationOnViolation)) {
            errors.push('Escalation on violation must be one of: pause, stop');
        }

        return errors;
    }

    static createDefaultPolicy(): AgentPolicy {
        return {
            maxConcurrentTools: 3,
            rateLimitPerMin: 10,
            forbiddenActions: [
                'delete_table',
                'external_http_post',
                'write_system_files',
                'execute_code'
            ],
            dataAccessScopes: [
                'storage.read',
                'configs.read'
            ],
            piiHandling: 'mask',
            escalationOnViolation: 'pause'
        };
    }

    static mergeWithDefaults(policy: Partial<AgentPolicy>): AgentPolicy {
        const defaultPolicy = this.createDefaultPolicy();
        return {
            ...defaultPolicy,
            ...policy
        };
    }
} 