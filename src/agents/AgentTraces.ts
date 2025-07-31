import { TraceEvent, AgentRunState, AgentConfig } from './types';

export class AgentTraces {
    private static spanCounter = 0;

    static createSpanId(): string {
        return `span_${++this.spanCounter}_${Date.now()}`;
    }

    static createTraceEvent(
        name: string,
        parentSpanId?: string,
        attributes: Record<string, any> = {},
        duration_ms?: number
    ): TraceEvent {
        return {
            timestamp: new Date().toISOString(),
            spanId: this.createSpanId(),
            parentSpanId,
            name,
            attributes,
            duration_ms
        };
    }

    static createAgentStartEvent(config: AgentConfig, runState: AgentRunState): TraceEvent {
        return this.createTraceEvent('agent.start', undefined, {
            'agent.id': config.id,
            'agent.name': config.name,
            'agent.goal': config.goal,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'ai.model': config.selectedLLM,
            'ai.system_prompt.hash': this.hashString(config.systemPrompt),
            'ai.input_tokens': 0,
            'ai.output_tokens': 0,
            'ai.total_tokens': 0
        });
    }

    static createAgentTickEvent(runState: AgentRunState, config: AgentConfig): TraceEvent {
        return this.createTraceEvent('agent.tick', undefined, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'agent.spent_usd': runState.spentUSD,
            'agent.spent_tokens': runState.spentTokens,
            'agent.tool_calls': runState.toolCalls,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createStepEvent(
        step: any,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        const attributes: Record<string, any> = {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'step.id': step.id,
            'step.title': step.title,
            'step.kind': step.kind,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        };

        if (step.toolId) {
            attributes['tool.id'] = step.toolId;
        }

        if (step.estTokens) {
            attributes['step.est_tokens'] = step.estTokens;
        }

        if (step.estUSD) {
            attributes['step.est_usd'] = step.estUSD;
        }

        return this.createTraceEvent('step.execute', parentSpanId, attributes);
    }

    static createToolCallEvent(
        toolId: string,
        toolName: string,
        invocationId: string,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string,
        success: boolean = true,
        latency_ms?: number,
        inputTokens?: number,
        outputTokens?: number
    ): TraceEvent {
        const totalTokens = (inputTokens || 0) + (outputTokens || 0);
        
        return this.createTraceEvent('tool.call', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'tool.id': toolId,
            'tool.name': toolName,
            'tool.invocation_id': invocationId,
            'tool.latency_ms': latency_ms || 0,
            'tool.success': success,
            'ai.model': config.selectedLLM,
            'ai.input_tokens': inputTokens || 0,
            'ai.output_tokens': outputTokens || 0,
            'ai.total_tokens': totalTokens
        }, latency_ms);
    }

    static createHITLEvent(
        hitlRequest: any,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        return this.createTraceEvent('hitl.request', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'hitl.id': hitlRequest.id,
            'hitl.question': hitlRequest.question,
            'hitl.status': hitlRequest.status,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createPolicyViolationEvent(
        violation: any,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        return this.createTraceEvent('policy.violation', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'error.type': violation.type,
            'error.message': violation.details,
            'policy.violation.action': violation.action,
            'policy.violation.escalation': violation.escalation,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createAgentCompleteEvent(
        runState: AgentRunState,
        config: AgentConfig,
        finalMetrics: any
    ): TraceEvent {
        return this.createTraceEvent('agent.complete', undefined, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'agent.final_spent_usd': runState.spentUSD,
            'agent.final_spent_tokens': runState.spentTokens,
            'agent.total_steps': finalMetrics.totalSteps,
            'agent.total_tool_calls': finalMetrics.totalToolCalls,
            'agent.total_hitl_requests': finalMetrics.totalHITLRequests,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createAgentErrorEvent(
        error: Error,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        return this.createTraceEvent('agent.error', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'error.type': error.name,
            'error.message': error.message,
            'error.stack': error.stack,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createBudgetExceededEvent(
        runState: AgentRunState,
        config: AgentConfig,
        budgetType: 'usd' | 'tokens' | 'time'
    ): TraceEvent {
        return this.createTraceEvent('budget.exceeded', undefined, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'budget.type': budgetType,
            'budget.limit': budgetType === 'usd' ? config.budgetUSD : 
                           budgetType === 'tokens' ? config.tokenBudget : 
                           config.timeLimitSec,
            'budget.used': budgetType === 'usd' ? runState.spentUSD : 
                          budgetType === 'tokens' ? runState.spentTokens : 
                          this.calculateElapsedSeconds(runState.createdAt),
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createLearningEvent(
        learning: string,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        return this.createTraceEvent('agent.learning', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'learning.text': learning,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    static createArtifactEvent(
        artifactPath: string,
        artifactType: string,
        runState: AgentRunState,
        config: AgentConfig,
        parentSpanId?: string
    ): TraceEvent {
        return this.createTraceEvent('artifact.created', parentSpanId, {
            'agent.id': runState.id,
            'agent.status': runState.status,
            'agent.progress': runState.progressPct,
            'agent.confidence': runState.confidencePct,
            'artifact.path': artifactPath,
            'artifact.type': artifactType,
            'ai.model': config.selectedLLM,
            'ai.total_tokens': runState.spentTokens
        });
    }

    private static hashString(str: string): string {
        // Simple hash function for demo purposes
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    private static calculateElapsedSeconds(createdAt: string): number {
        const created = new Date(createdAt);
        const now = new Date();
        return Math.floor((now.getTime() - created.getTime()) / 1000);
    }

    static exportTracesToFile(traces: TraceEvent[], outputPath: string): void {
        const fs = require('fs');
        const traceData = traces.map(trace => JSON.stringify(trace)).join('\n');
        fs.writeFileSync(outputPath, traceData);
    }

    static exportTracesToOutputChannel(traces: TraceEvent[], outputChannel: any): void {
        outputChannel.appendLine('=== Agent Traces ===');
        traces.forEach(trace => {
            outputChannel.appendLine(JSON.stringify(trace, null, 2));
        });
        outputChannel.appendLine('=== End Traces ===');
    }

    static getTraceSummary(traces: TraceEvent[]): any {
        const summary = {
            totalEvents: traces.length,
            eventTypes: {} as Record<string, number>,
            totalDuration: 0,
            totalTokens: 0,
            totalToolCalls: 0,
            totalHITLRequests: 0,
            errors: 0,
            policyViolations: 0
        };

        traces.forEach(trace => {
            // Count event types
            summary.eventTypes[trace.name] = (summary.eventTypes[trace.name] || 0) + 1;

            // Sum durations
            if (trace.duration_ms) {
                summary.totalDuration += trace.duration_ms;
            }

            // Sum tokens
            if (trace.attributes['ai.total_tokens']) {
                summary.totalTokens += trace.attributes['ai.total_tokens'];
            }

            // Count tool calls
            if (trace.name === 'tool.call') {
                summary.totalToolCalls++;
            }

            // Count HITL requests
            if (trace.name === 'hitl.request') {
                summary.totalHITLRequests++;
            }

            // Count errors
            if (trace.name === 'agent.error') {
                summary.errors++;
            }

            // Count policy violations
            if (trace.name === 'policy.violation') {
                summary.policyViolations++;
            }
        });

        return summary;
    }

    static createPresetSelectedEvent(presetId: string, presetName: string): TraceEvent {
        return this.createTraceEvent('agent.preset_selected', undefined, {
            'preset.id': presetId,
            'preset.name': presetName,
            'preset.version': '1.0'
        });
    }
} 