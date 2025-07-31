import { AgentPreset, AgentPolicy, PlannedStep, MCPToolRef } from '../types';

export const AGENT_PRESETS: Record<string, AgentPreset> = {
    dq_sentinel: {
        id: 'dq_sentinel',
        name: 'Data Quality Sentinel',
        shortDescription: 'Checks schema drift, nulls/dupes, freshness; produces a DQ report',
        longDescription: 'Automated data quality monitoring that analyzes your data for common issues like schema drift, null values, duplicates, and data freshness. Generates comprehensive quality reports with actionable insights.',
        icon: 'shield-check',
        defaultConfig: {
            goal: 'Analyze data quality across selected tables, detect schema drift, null values, duplicates, and freshness issues. Generate a comprehensive data quality report with actionable recommendations.',
            systemPrompt: 'You are a Data Quality Sentinel. Your role is to systematically analyze data quality across tables, identify issues, and provide clear, actionable recommendations. Focus on schema consistency, data completeness, accuracy, and freshness.',
            selectedLLM: 'gpt-4o-mini',
            allowedLLMs: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
            allowedTools: [
                { id: 'mcp://keboola/QueryStorage', name: 'QueryStorage', description: 'Query data from Keboola storage' },
                { id: 'mcp://keboola/RunSQL', name: 'RunSQL', description: 'Execute SQL queries on DuckDB' },
                { id: 'mcp://keboola/Notify', name: 'Notify', description: 'Send notifications' },
                { id: 'mcp://keboola/OpenIssue', name: 'OpenIssue', description: 'Create issues for problems found' }
            ],
            budgetUSD: 15.0,
            tokenBudget: 15000,
            timeLimitSec: 1800,
            contactPolicy: 'notify_modal',
            hitlTimeoutSec: 300,
            hitlFallback: 'pause'
        },
        defaultPolicy: {
            maxConcurrentTools: 1,
            rateLimitPerMin: 30,
            forbiddenActions: ['delete_table', 'external_http_post'],
            dataAccessScopes: ['storage.read'],
            piiHandling: 'mask',
            escalationOnViolation: 'pause'
        },
        plannedSteps: [
            { id: 'step_1', title: 'Collect metadata and freshness for selected tables', kind: 'thought', estTokens: 150, estUSD: 0.02 },
            { id: 'step_2', title: 'QueryStorage - list tables and preview samples', kind: 'tool', toolId: 'mcp://keboola/QueryStorage', estTokens: 200, estUSD: 0.03 },
            { id: 'step_3', title: 'RunSQL - nulls/dup/constraints checks', kind: 'tool', toolId: 'mcp://keboola/RunSQL', estTokens: 300, estUSD: 0.05 },
            { id: 'step_4', title: 'Generate dq_report.html & dq_findings.json', kind: 'message', estTokens: 250, estUSD: 0.04 },
            { id: 'step_5', title: 'Evaluate issues vs thresholds; decide on alert', kind: 'check', estTokens: 200, estUSD: 0.03 }
        ],
        defaultMetrics: ['freshness_lag', 'rules_coverage', 'detected_issues', 'rows_scanned']
    },

    ingestion_doctor: {
        id: 'ingestion_doctor',
        name: 'Ingestion Doctor',
        shortDescription: 'Diagnoses failed extractors; suggests safe config fixes; validates re-run',
        longDescription: 'Intelligent troubleshooting for failed data ingestion jobs. Analyzes error patterns, suggests configuration fixes, and validates solutions before implementation.',
        icon: 'stethoscope',
        defaultConfig: {
            goal: 'Diagnose failed extractor configurations, identify root causes, suggest safe configuration fixes, and validate the solutions through test runs.',
            systemPrompt: 'You are an Ingestion Doctor specializing in data pipeline diagnostics. Analyze failed jobs systematically, identify patterns, and propose safe, tested solutions. Always validate changes before applying them.',
            selectedLLM: 'gpt-4o-mini',
            allowedLLMs: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
            allowedTools: [
                { id: 'mcp://keboola/JobsSearch', name: 'JobsSearch', description: 'Search and analyze job history' },
                { id: 'mcp://keboola/GetConfig', name: 'GetConfig', description: 'Retrieve configuration details' },
                { id: 'mcp://keboola/SetConfig', name: 'SetConfig', description: 'Update configuration settings' },
                { id: 'mcp://keboola/TestRun', name: 'TestRun', description: 'Execute test runs' },
                { id: 'mcp://keboola/QueryStorage', name: 'QueryStorage', description: 'Query data from Keboola storage' },
                { id: 'mcp://keboola/Notify', name: 'Notify', description: 'Send notifications' }
            ],
            budgetUSD: 20.0,
            tokenBudget: 20000,
            timeLimitSec: 2400,
            contactPolicy: 'notify_modal',
            hitlTimeoutSec: 600,
            hitlFallback: 'pause'
        },
        defaultPolicy: {
            maxConcurrentTools: 2,
            rateLimitPerMin: 20,
            forbiddenActions: ['delete_table'],
            dataAccessScopes: ['configs.read', 'configs.write', 'jobs.read'],
            piiHandling: 'mask',
            escalationOnViolation: 'pause'
        },
        plannedSteps: [
            { id: 'step_1', title: 'Find last failed jobs and root cause', kind: 'thought', estTokens: 150, estUSD: 0.02 },
            { id: 'step_2', title: 'JobsSearch - last fails', kind: 'tool', toolId: 'mcp://keboola/JobsSearch', estTokens: 200, estUSD: 0.03 },
            { id: 'step_3', title: 'GetConfig - read extractor config', kind: 'tool', toolId: 'mcp://keboola/GetConfig', estTokens: 250, estUSD: 0.04 },
            { id: 'step_4', title: 'Propose config change (rate limit/endpoint)', kind: 'message', estTokens: 300, estUSD: 0.05 },
            { id: 'step_5', title: 'SetConfig - apply change if approved', kind: 'tool', toolId: 'mcp://keboola/SetConfig', estTokens: 200, estUSD: 0.03 },
            { id: 'step_6', title: 'TestRun → QueryStorage - validate results', kind: 'tool', toolId: 'mcp://keboola/TestRun', estTokens: 300, estUSD: 0.05 },
            { id: 'step_7', title: 'Write diagnosis report', kind: 'message', estTokens: 250, estUSD: 0.04 }
        ],
        defaultMetrics: ['diagnosis_accuracy', 'fix_success_rate', 'time_to_resolution', 'config_changes_made']
    },

    sql_coach: {
        id: 'sql_coach',
        name: 'SQL Refactor & Test Coach',
        shortDescription: 'Refactors SQL, generates tests, compares before/after; outputs patch and tests',
        longDescription: 'Advanced SQL optimization and testing assistant. Refactors complex queries, generates comprehensive tests, and provides before/after comparisons with detailed performance analysis.',
        icon: 'code',
        defaultConfig: {
            goal: 'Refactor SQL queries for performance and maintainability, generate comprehensive tests, compare before/after results, and output patches with test suites.',
            systemPrompt: 'You are a SQL Refactor & Test Coach. Focus on query optimization, maintainability, and comprehensive testing. Always preserve functionality while improving performance and readability.',
            selectedLLM: 'gpt-4o',
            allowedLLMs: ['gpt-4o', 'gpt-4o-mini', 'claude-3-sonnet'],
            allowedTools: [
                { id: 'mcp://keboola/RunSQL', name: 'RunSQL', description: 'Execute SQL queries' },
                { id: 'mcp://keboola/DiffSQL', name: 'DiffSQL', description: 'Compare SQL queries and results' },
                { id: 'mcp://keboola/GenerateTests', name: 'GenerateTests', description: 'Generate test cases' },
                { id: 'mcp://keboola/ExportCSV', name: 'ExportCSV', description: 'Export data to CSV' },
                { id: 'mcp://keboola/GitPatch', name: 'GitPatch', description: 'Create git patches' }
            ],
            budgetUSD: 25.0,
            tokenBudget: 25000,
            timeLimitSec: 3000,
            contactPolicy: 'notify_modal',
            hitlTimeoutSec: 900,
            hitlFallback: 'stop'
        },
        defaultPolicy: {
            maxConcurrentTools: 1,
            rateLimitPerMin: 15,
            forbiddenActions: ['write_config'],
            dataAccessScopes: ['storage.read'],
            piiHandling: 'mask',
            escalationOnViolation: 'stop'
        },
        plannedSteps: [
            { id: 'step_1', title: 'Parse and lint SQL', kind: 'thought', estTokens: 200, estUSD: 0.03 },
            { id: 'step_2', title: 'RunSQL - baseline latency & sample', kind: 'tool', toolId: 'mcp://keboola/RunSQL', estTokens: 300, estUSD: 0.05 },
            { id: 'step_3', title: 'DiffSQL - produce refactor', kind: 'tool', toolId: 'mcp://keboola/DiffSQL', estTokens: 400, estUSD: 0.06 },
            { id: 'step_4', title: 'Approve refactor diff?', kind: 'message', estTokens: 250, estUSD: 0.04 },
            { id: 'step_5', title: 'GenerateTests - row count/not-null/range', kind: 'tool', toolId: 'mcp://keboola/GenerateTests', estTokens: 350, estUSD: 0.05 },
            { id: 'step_6', title: 'ExportCSV - samples', kind: 'tool', toolId: 'mcp://keboola/ExportCSV', estTokens: 200, estUSD: 0.03 },
            { id: 'step_7', title: 'GitPatch - create patch artifact', kind: 'tool', toolId: 'mcp://keboola/GitPatch', estTokens: 300, estUSD: 0.04 }
        ],
        defaultMetrics: ['performance_improvement', 'test_coverage', 'complexity_reduction', 'maintainability_score']
    },

    cost_lineage: {
        id: 'cost_lineage',
        name: 'Cost & Lineage Analyst',
        shortDescription: 'Maps lineage, detects hot-spots, estimates cost; recommends schedule/caching changes',
        longDescription: 'Comprehensive cost and lineage analysis tool that maps data dependencies, identifies performance bottlenecks, and provides optimization recommendations for scheduling and caching strategies.',
        icon: 'graph',
        defaultConfig: {
            goal: 'Analyze data lineage, detect performance hot-spots, estimate costs, and recommend optimization strategies for scheduling and caching.',
            systemPrompt: 'You are a Cost & Lineage Analyst. Focus on understanding data dependencies, identifying bottlenecks, and providing actionable recommendations for cost optimization and performance improvement.',
            selectedLLM: 'gpt-4o-mini',
            allowedLLMs: ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
            allowedTools: [
                { id: 'mcp://keboola/JobsSearch', name: 'JobsSearch', description: 'Search and analyze job history' },
                { id: 'mcp://keboola/LineageGraph', name: 'LineageGraph', description: 'Build and analyze data lineage' },
                { id: 'mcp://keboola/CostModel', name: 'CostModel', description: 'Estimate costs and resource usage' },
                { id: 'mcp://keboola/Notify', name: 'Notify', description: 'Send notifications' }
            ],
            budgetUSD: 18.0,
            tokenBudget: 18000,
            timeLimitSec: 2100,
            contactPolicy: 'notify',
            hitlTimeoutSec: 300,
            hitlFallback: 'pause'
        },
        defaultPolicy: {
            maxConcurrentTools: 2,
            rateLimitPerMin: 25,
            forbiddenActions: ['delete_table', 'write_config'],
            dataAccessScopes: ['jobs.read'],
            piiHandling: 'mask',
            escalationOnViolation: 'pause'
        },
        plannedSteps: [
            { id: 'step_1', title: 'Aggregate job runtimes/window', kind: 'thought', estTokens: 150, estUSD: 0.02 },
            { id: 'step_2', title: 'JobsSearch - analyze job patterns', kind: 'tool', toolId: 'mcp://keboola/JobsSearch', estTokens: 250, estUSD: 0.04 },
            { id: 'step_3', title: 'LineageGraph - build DAG', kind: 'tool', toolId: 'mcp://keboola/LineageGraph', estTokens: 300, estUSD: 0.05 },
            { id: 'step_4', title: 'CostModel - estimate costs', kind: 'tool', toolId: 'mcp://keboola/CostModel', estTokens: 350, estUSD: 0.06 },
            { id: 'step_5', title: 'Generate cost_report.html & recommendations.md', kind: 'message', estTokens: 400, estUSD: 0.07 }
        ],
        defaultMetrics: ['estimated_cost_saved', 'heavy_edges_count', 'longest_path', 'optimization_impact']
    },

    pipeline_builder: {
        id: 'pipeline_builder',
        name: 'Use-Case Pipeline Builder',
        shortDescription: 'Scaffolds a new pipeline: configs, flow.yaml, starter tests/docs',
        longDescription: 'Intelligent pipeline scaffolding tool that creates complete data pipeline structures including configurations, flow definitions, tests, and documentation based on use case requirements.',
        icon: 'pipeline',
        defaultConfig: {
            goal: 'Scaffold a complete data pipeline including configurations, flow definitions, starter tests, and documentation based on the specified use case requirements.',
            systemPrompt: 'You are a Use-Case Pipeline Builder. Create comprehensive, production-ready pipeline structures with proper error handling, testing, and documentation. Focus on maintainability and best practices.',
            selectedLLM: 'gpt-4o',
            allowedLLMs: ['gpt-4o', 'gpt-4o-mini', 'claude-3-sonnet'],
            allowedTools: [
                { id: 'mcp://keboola/TemplateEngine', name: 'TemplateEngine', description: 'Generate pipeline templates' },
                { id: 'mcp://keboola/FlowYAML', name: 'FlowYAML', description: 'Create flow definitions' },
                { id: 'mcp://keboola/SetConfig', name: 'SetConfig', description: 'Create configuration files' },
                { id: 'mcp://keboola/Notify', name: 'Notify', description: 'Send notifications' }
            ],
            budgetUSD: 22.0,
            tokenBudget: 22000,
            timeLimitSec: 2700,
            contactPolicy: 'notify_modal',
            hitlTimeoutSec: 600,
            hitlFallback: 'pause'
        },
        defaultPolicy: {
            maxConcurrentTools: 2,
            rateLimitPerMin: 20,
            forbiddenActions: ['delete_table'],
            dataAccessScopes: ['configs.write'],
            piiHandling: 'mask',
            escalationOnViolation: 'pause'
        },
        plannedSteps: [
            { id: 'step_1', title: 'Collect template params', kind: 'message', estTokens: 200, estUSD: 0.03 },
            { id: 'step_2', title: 'TemplateEngine - generate skeleton', kind: 'tool', toolId: 'mcp://keboola/TemplateEngine', estTokens: 400, estUSD: 0.06 },
            { id: 'step_3', title: 'FlowYAML - compile', kind: 'tool', toolId: 'mcp://keboola/FlowYAML', estTokens: 300, estUSD: 0.05 },
            { id: 'step_4', title: 'SetConfig - create draft configs', kind: 'tool', toolId: 'mcp://keboola/SetConfig', estTokens: 350, estUSD: 0.06 },
            { id: 'step_5', title: 'Open files in editor & README_usecase.md', kind: 'message', estTokens: 250, estUSD: 0.04 }
        ],
        defaultMetrics: ['pipeline_completeness', 'test_coverage', 'documentation_quality', 'time_to_production']
    }
};

export function getPreset(id: string): AgentPreset | undefined {
    return AGENT_PRESETS[id];
}

export function getAllPresets(): AgentPreset[] {
    return Object.values(AGENT_PRESETS);
} 