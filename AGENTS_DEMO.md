# Keboola AI Agents Demo Module

This VS Code extension includes a comprehensive AI agents demo module that allows you to create, manage, and monitor AI agents for data engineering tasks.

## Features

### Agent Management
- **Create Agents**: Build custom AI agents with specific goals and configurations
- **Agent Runtime**: Monitor agent execution in real-time
- **Agent Policies**: Configure safety policies and guardrails
- **HITL (Human-in-the-Loop)**: Approve or reject agent actions when needed

### Agent Capabilities
- **Data Querying**: Query Keboola storage using MCP tools
- **Data Analysis**: Analyze data and generate insights
- **Report Generation**: Create comprehensive reports
- **Policy Enforcement**: Automatic policy violation detection and handling

### UI Components
- **Agents Tree View**: Browse agents by status (Running, Completed, Failed, HITL)
- **Agent Detail Panel**: Real-time monitoring of agent execution
- **Create Agent Panel**: Visual agent configuration interface
- **Context Menus**: Quick actions for agent management

## Getting Started

### 1. Access the Agents View
- Open the Keboola Platform activity bar
- Click on the "AI Agents" view
- You'll see agents organized by status

### 2. Create Your First Agent
- Click the "+" button in the agents view title bar
- Or use the command palette: `Keboola: Create AI Agent`
- Fill in the agent configuration:
  - **Name**: Descriptive name for your agent
  - **Goal**: What the agent should accomplish
  - **LLM Model**: Choose from allowed models (gpt-4o-mini, gpt-4o, claude-3-haiku)
  - **Budget**: Set USD and token limits
  - **Tools**: Select available MCP tools
  - **Policy**: Configure safety guardrails

### 3. Create a Demo Agent (For Testing)
- Use the command palette: `Keboola: Create Demo Agent`
- This creates a pre-configured demo agent for testing

### 4. Manage Agents
- **Start**: Begin agent execution
- **Pause**: Temporarily stop execution
- **Resume**: Continue paused execution
- **Stop**: Terminate execution
- **View Details**: Open detailed monitoring panel
- **Open Manifest**: View agent configuration
- **Export Report**: Download execution report

## Agent States

- **Starting**: Agent is initializing
- **Running**: Agent is actively executing
- **Paused**: Execution temporarily stopped
- **Waiting HITL**: Waiting for human approval
- **Completed**: Successfully finished
- **Failed**: Execution failed

## HITL (Human-in-the-Loop)

When agents encounter actions requiring approval:
- Agent pauses execution
- Notification appears in HITL inbox
- Review the action and context
- **Approve**: Allow the action to proceed
- **Reject**: Block the action and provide feedback

## Configuration

### Agent Settings
- `keboola.agents.defaultModel`: Default LLM model
- `keboola.agents.defaultBudgetUSD`: Default budget in USD
- `keboola.agents.defaultTokenBudget`: Default token budget
- `keboola.agents.defaultTimeLimitSec`: Default time limit
- `keboola.agents.allowedLLMs`: List of allowed LLM models
- `keboola.agents.allowedTools`: List of allowed MCP tools
- `keboola.agents.contactPolicy`: HITL contact policy
- `keboola.agents.hitlTimeoutSec`: HITL timeout
- `keboola.agents.hitlFallback`: Action when HITL times out
- `keboola.agents.exportTracesToFile`: Export traces to file
- `keboola.agents.dataDir`: Data directory for agents

## Architecture

### Core Components
- **AgentStore**: Manages agent configurations and run states
- **AgentRuntime**: Executes agents and handles lifecycle
- **AgentPolicy**: Enforces safety policies and guardrails
- **AgentTraces**: Records execution traces for debugging
- **AgentsTreeProvider**: Provides tree view data

### Webview Panels
- **CreateAgentPanel**: Agent creation interface
- **AgentDetailPanel**: Real-time agent monitoring

### Data Storage
- Agent data stored in `.keboola_agents` directory
- Each agent has its own subdirectory
- Configurations, run states, traces, and artifacts stored separately

## Demo Agent

The demo agent is pre-configured with:
- **Goal**: Analyze data and generate comprehensive reports
- **Model**: gpt-4o-mini
- **Budget**: $5.0 USD, 5000 tokens
- **Tools**: QueryStorage, AnalyzeData, GenerateReport
- **Policy**: Conservative safety settings

## Troubleshooting

### Common Issues
1. **Agent won't start**: Check budget and token limits
2. **HITL requests not appearing**: Verify contact policy settings
3. **Policy violations**: Review agent configuration and policy settings
4. **Missing tools**: Ensure tools are in allowed list

### Debugging
- Check the output channel for detailed logs
- Review agent traces in the detail panel
- Export reports for detailed analysis

## Future Enhancements

- **Multi-agent coordination**: Orchestrate multiple agents
- **Advanced policies**: More sophisticated safety rules
- **Custom tools**: Add your own MCP tools
- **Agent templates**: Pre-built agent configurations
- **Performance metrics**: Detailed cost and performance analysis 