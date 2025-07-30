export const t = {
    // Tree and navigation
    tree_root: 'AI Agents',
    tree_running: 'Running',
    tree_completed: 'Completed',
    tree_failed: 'Failed',
    tree_hitl_inbox: 'HITL Inbox',
    
    // Create Agent
    create_title: 'Create AI Agent',
    create_goal_label: 'Goal',
    create_goal_placeholder: 'What should this agent accomplish?',
    create_system_prompt_label: 'System Prompt',
    create_system_prompt_placeholder: 'Instructions for the agent...',
    create_name_label: 'Agent Name',
    create_name_placeholder: 'Enter a descriptive name',
    
    // Tabs
    tab_goal_prompt: 'Goal & Prompt',
    tab_models: 'Models',
    tab_tools: 'Tools',
    tab_credentials: 'Credentials',
    tab_budget_limits: 'Budget & Limits',
    tab_policy: 'Policy',
    tab_contact_hitl: 'Contact & HITL',
    
    // Models
    models_title: 'Select LLM Model',
    models_default: 'Default Model',
    models_allowed: 'Allowed Models',
    models_provider: 'Provider',
    models_cost_per_1k: 'Cost per 1K tokens',
    
    // Tools
    tools_title: 'Select MCP Tools',
    tools_available: 'Available Tools',
    tools_selected: 'Selected Tools',
    tools_search: 'Search tools...',
    tools_description: 'Tools that the agent can use',
    
    // Credentials
    credentials_title: 'Credentials',
    credentials_add: 'Add Credential',
    credentials_name: 'Name',
    credentials_type: 'Type',
    credentials_stored: 'Stored in VS Code Secrets',
    
    // Budget & Limits
    budget_title: 'Budget & Limits',
    budget_usd: 'Budget (USD)',
    budget_tokens: 'Token Budget',
    budget_time_limit: 'Time Limit (seconds)',
    budget_unlimited: 'Unlimited',
    budget_estimated_cost: 'Estimated Cost',
    
    // Policy
    policy_title: 'Guardrails & Policy',
    policy_concurrent_tools: 'Max Concurrent Tools',
    policy_rate_limit: 'Rate Limit (per minute)',
    policy_forbidden_actions: 'Forbidden Actions',
    policy_data_scopes: 'Data Access Scopes',
    policy_pii_handling: 'PII Handling',
    policy_escalation: 'Escalation on Violation',
    
    // Contact & HITL
    contact_title: 'Contact & Human-in-the-Loop',
    contact_policy: 'Contact Policy',
    contact_notify: 'VSCode notification only',
    contact_notify_modal: 'Notification + modal',
    contact_log_only: 'Log only',
    contact_hitl_timeout: 'HITL Timeout (seconds)',
    contact_hitl_fallback: 'HITL Fallback',
    contact_hitl_pause: 'Pause',
    contact_hitl_continue: 'Continue with safe default',
    contact_hitl_stop: 'Stop',
    
    // Buttons
    btn_validate: 'Validate understanding',
    btn_start: 'Start Agent',
    btn_pause: 'Pause',
    btn_resume: 'Resume',
    btn_stop: 'Stop',
    btn_restart: 'Restart with new goal',
    btn_edit_budget: 'Edit Budget',
    btn_edit_model: 'Edit Model',
    btn_edit_tools: 'Edit Tools',
    btn_open_manifest: 'Open Manifest',
    btn_export_report: 'Export Report',
    btn_approve: 'Approve',
    btn_reject: 'Reject',
    btn_reply: 'Reply',
    btn_accept: 'Accept',
    btn_dismiss: 'Dismiss',
    
    // Status
    status_starting: 'Starting',
    status_running: 'Running',
    status_waiting_hitl: 'Waiting for HITL',
    status_paused: 'Paused',
    status_completed: 'Completed',
    status_failed: 'Failed',
    
    // Detail Panel
    detail_progress: 'Progress',
    detail_confidence: 'Confidence',
    detail_budget_spent: 'Budget Spent',
    detail_tokens_used: 'Tokens Used',
    detail_tool_calls: 'Tool Calls',
    detail_elapsed_time: 'Elapsed Time',
    detail_remaining_budget: 'Remaining Budget',
    
    // Tabs in Detail Panel
    detail_tab_traces: 'Traces',
    detail_tab_hitl: 'HITL',
    detail_tab_artifacts: 'Artifacts',
    detail_tab_memory: 'Memory/Learnings',
    
    // HITL
    hitl_pending: 'Pending Requests',
    hitl_question: 'Question',
    hitl_created: 'Created',
    hitl_status: 'Status',
    hitl_resolution: 'Resolution',
    hitl_no_pending: 'No pending HITL requests',
    
    // Artifacts
    artifacts_title: 'Generated Artifacts',
    artifacts_open: 'Open',
    artifacts_download: 'Download',
    artifacts_no_artifacts: 'No artifacts generated yet',
    
    // Memory/Learnings
    memory_title: 'Proposed Learnings',
    memory_accept: 'Accept Learning',
    memory_dismiss: 'Dismiss',
    memory_no_learnings: 'No learnings proposed yet',
    
    // Validation
    validation_plan: 'Validation Plan',
    validation_steps: 'Planned Steps',
    validation_cost_estimate: 'Cost Estimate',
    validation_understanding: 'Agent Understanding',
    
    // Messages
    msg_agent_created: 'Agent created successfully',
    msg_agent_started: 'Agent started successfully',
    msg_agent_paused: 'Agent paused',
    msg_agent_resumed: 'Agent resumed',
    msg_agent_stopped: 'Agent stopped',
    msg_agent_completed: 'Agent completed successfully',
    msg_agent_failed: 'Agent failed',
    msg_hitl_approved: 'HITL request approved',
    msg_hitl_rejected: 'HITL request rejected',
    msg_learning_accepted: 'Learning accepted',
    msg_learning_dismissed: 'Learning dismissed',
    msg_manifest_opened: 'Manifest opened',
    msg_report_exported: 'Report exported',
    
    // Errors
    error_validation_failed: 'Validation failed',
    error_agent_start_failed: 'Failed to start agent',
    error_agent_pause_failed: 'Failed to pause agent',
    error_agent_resume_failed: 'Failed to resume agent',
    error_agent_stop_failed: 'Failed to stop agent',
    error_hitl_action_failed: 'Failed to process HITL action',
    error_manifest_open_failed: 'Failed to open manifest',
    error_report_export_failed: 'Failed to export report',
    error_policy_violation: 'Policy violation detected',
    error_budget_exceeded: 'Budget exceeded',
    error_time_limit_exceeded: 'Time limit exceeded',
    
    // Settings
    settings_title: 'AI Agents Settings',
    settings_default_model: 'Default Model',
    settings_default_budget: 'Default Budget (USD)',
    settings_default_token_budget: 'Default Token Budget',
    settings_default_time_limit: 'Default Time Limit (seconds)',
    settings_allowed_llms: 'Allowed LLMs',
    settings_allowed_tools: 'Allowed Tools',
    settings_contact_policy: 'Contact Policy',
    settings_hitl_timeout: 'HITL Timeout (seconds)',
    settings_hitl_fallback: 'HITL Fallback',
    settings_export_traces: 'Export traces to file',
    settings_data_dir: 'Data Directory',
    
    // Policy Violations
    violation_forbidden_action: 'Forbidden action attempted',
    violation_rate_limit: 'Rate limit exceeded',
    violation_concurrent_tools: 'Too many concurrent tool calls',
    violation_pii_detected: 'PII detected in output',
    
    // Help text
    help_goal: 'Describe what the agent should accomplish in clear, specific terms',
    help_system_prompt: 'Provide instructions that guide the agent\'s behavior and decision-making',
    help_budget: 'Set a budget limit to prevent excessive costs',
    help_policy: 'Configure guardrails to ensure safe and compliant operation',
    help_hitl: 'Human-in-the-Loop allows human oversight and approval for critical decisions',
    
    // Placeholders
    placeholder_search: 'Search...',
    placeholder_select: 'Select...',
    placeholder_enter_text: 'Enter text...',
    placeholder_enter_number: 'Enter number...',
    
    // Time units
    time_seconds: 'seconds',
    time_minutes: 'minutes',
    time_hours: 'hours',
    
    // Currency
    currency_usd: 'USD',
    
    // Units
    unit_tokens: 'tokens',
    unit_calls: 'calls',
    unit_percent: '%',
    
    // Common
    common_yes: 'Yes',
    common_no: 'No',
    common_ok: 'OK',
    common_cancel: 'Cancel',
    common_save: 'Save',
    common_delete: 'Delete',
    common_edit: 'Edit',
    common_view: 'View',
    common_refresh: 'Refresh',
    common_close: 'Close',
    common_loading: 'Loading...',
    common_error: 'Error',
    common_success: 'Success',
    common_warning: 'Warning',
    common_info: 'Information',
    
    // Empty states
    empty_no_agents: 'No agents created yet',
    empty_no_running: 'No agents currently running',
    empty_no_completed: 'No completed agents',
    empty_no_failed: 'No failed agents',
    empty_no_hitl: 'No pending HITL requests',
    
    // Tooltips
    tooltip_create_agent: 'Create a new AI agent',
    tooltip_start_agent: 'Start the agent',
    tooltip_pause_agent: 'Pause the agent',
    tooltip_resume_agent: 'Resume the agent',
    tooltip_stop_agent: 'Stop the agent',
    tooltip_edit_budget: 'Edit agent budget',
    tooltip_edit_model: 'Edit agent model',
    tooltip_edit_tools: 'Edit agent tools',
    tooltip_open_manifest: 'Open run manifest',
    tooltip_export_report: 'Export run report',
    tooltip_approve_hitl: 'Approve HITL request',
    tooltip_reject_hitl: 'Reject HITL request',
    tooltip_reply_hitl: 'Reply to HITL request',
    tooltip_accept_learning: 'Accept proposed learning',
    tooltip_dismiss_learning: 'Dismiss proposed learning',
}; 