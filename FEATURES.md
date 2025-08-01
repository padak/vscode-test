# 🔧 Keboola Data Engineering Booster - Features Guide

## 📋 **What This Extension Does**

The **Keboola Data Engineering Booster** extension is a comprehensive VS Code tool that helps you browse, explore, and manage your entire Keboola ecosystem directly within your code editor. Beyond data exploration, it now provides complete project configuration management, making it your one-stop solution for Keboola development.

---

## 🚀 **Key Features (Version 4.1.0)**

### 🤖 **NEW: AI Agents System** *(Version 4.0.0)*
> **Note**: AI Agents operate as a separate top-level section independent of individual projects
- **🆕 AI Agent Management**: Create, monitor, and control AI agents for data engineering tasks
- **🤖 Agent Runtime**: Real-time agent execution with policy enforcement and safety guardrails
- **📊 Live Monitoring**: Track agent status, progress, confidence, and cost in real-time
- **👥 HITL Integration**: Human-in-the-Loop approval system for sensitive agent actions
- **🎯 Policy Enforcement**: Comprehensive safety policies and execution guardrails
- **📈 Execution Traces**: Detailed debugging and analysis of agent execution
- **💼 Agent Store**: Persistent agent configuration and state management
- **🎨 Rich UI**: Visual agent creation and detailed monitoring panels

#### **Agent Creation & Configuration:**
- **Visual Interface**: WebView-based agent creation with real-time validation
- **Model Selection**: Choose from gpt-4o-mini, gpt-4o, claude-3-haiku
- **Budget Management**: Set USD and token limits with cost estimation
- **Tool Permissions**: Configure MCP tool access and capabilities
- **Safety Policies**: Define guardrails, rate limits, and forbidden actions
- **Demo Agent**: Pre-configured demo agent for easy testing

#### **Agent Monitoring & Control:**
- **Status Tracking**: Real-time updates (starting, running, paused, completed, failed)
- **Progress Monitoring**: Live progress percentage and confidence tracking
- **Cost Analytics**: USD and token budget monitoring with usage tracking
- **Tool Call History**: Detailed tool usage and execution metrics
- **HITL Management**: Approve or reject agent actions requiring oversight
- **Lifecycle Control**: Start, pause, resume, and stop agent execution

#### **Agent Organization:**
- **Status Groups**: Agents organized by Running, Completed, Failed, and HITL
- **Tree View**: Integrated into Keboola Platform activity bar
- **Context Menus**: Quick actions for agent management
- **Real-time Updates**: Live status and progress indicators
- **Detail Panels**: Comprehensive agent information and monitoring

### 🏢 **NEW: Complete Multi-Project Support** *(Version 4.1.0)*
- **🚀 Simultaneous Display**: All projects shown at once - no more project switching!
- **🌳 Independent Sections**: Each project has its own Storage, Configurations, and Jobs sections
- **🔒 Same-Stack Security**: Strict validation ensures all projects are on the same Keboola stack
- **⚡ Auto-Detection**: Paste API tokens and project details are automatically detected
- **🔄 Parallel Operations**: Work with multiple projects simultaneously for maximum productivity
- **🎯 Simplified Management**: Streamlined token addition without complex forms
- **📊 Cross-Project Analysis**: Compare data, configurations, and performance across environments
- **🔄 Backward Compatibility**: Existing single-project setups continue working seamlessly

### 📊 **Storage Explorer** *(Preserved from v2.x)*
- **Browse Your Data Structure**: See all your stages (in, out), buckets, and tables in a tree view
- **Real-time Data Preview**: View table data directly in VS Code without leaving your editor
- **Detailed Information**: Get comprehensive details about tables, buckets, and stages
- **Search & Navigate**: Easily find and navigate through your data assets

### ⚙️ **Configurations Management** *(Version 3.0.0)*
- **Branch Explorer**: Browse all development branches in your project
- **Main Branch Identification**: Default branch clearly marked as "Main Branch"
- **Component Categories**: Organized view of Extractors, Writers, Transformations, Sandboxes, Data Apps, and Flows
- **Configuration Viewer**: Open any configuration as read-only JSON in VS Code editor
- **Branch Details**: Rich metadata panels showing branch information, creation details, and custom metadata
- **Configuration Metadata**: View configuration details including version, creator, and change descriptions
- **Lazy Loading**: Components and configurations load only when needed for optimal performance

### 📊 **NEW: Jobs Monitoring System** *(Version 3.1.0)*
- **Real-time Job Tracking**: Monitor running, failed, and completed jobs with live status updates
- **Smart Job Filtering**: Pre-organized groups for Running, Failed (24h), Finished (24h), and All jobs
- **Job Detail Panels**: Rich WebView panels with comprehensive job metadata, timing, and metrics
- **Configuration Integration**: Recent Jobs section in configuration detail panels shows execution history
- **Queue API Integration**: Direct connection to Keboola Queue API with automatic host conversion
- **Job Status Icons**: Visual status indicators with appropriate colors and symbols (success, error, processing, waiting)
- **Advanced Search & Filtering**: Filter jobs by componentId, configurationId, branchId, and status
- **Pagination Support**: "Load more..." functionality for efficient handling of large job lists
- **Interactive Actions**: Refresh job status, copy job IDs, and open jobs in Keboola UI
- **Performance Monitoring**: Duration tracking, resource usage insights, and execution timeline analysis

### 🔌 **Easy Connection Setup** *(Enhanced in 4.1.0)*
- **Multi-Region Support**: Connect to any Keboola region (US, EU, Asia-Pacific)
- **Secure Authentication**: Store your API tokens securely
- **Connection Testing**: Verify your connection with one click
- **API Status Visibility**: Connection status prominently displayed at the top level
- **🆕 Multi-Project Architecture**: Add multiple projects from the same stack with simple token addition
- **🆕 Auto-Detection**: Paste any API token and project details are automatically detected
- **Unified API Client**: Same connection settings work for Storage, Configurations, and Jobs (AI Agents have separate management)

### 🌳 **Multi-Project Tree Structure** *(Version 4.1.0)*
- **🚀 NEW: Simultaneous Multi-Project Display**: All projects shown at once - no more switching between projects!
- **API Status at Top Level**: Connection status appears as the very first item for immediate awareness
- **Independent Project Sections**: Each project has its own Storage, Configurations, and Jobs sections
- **Same-Stack Enforcement**: All projects must be on the same Keboola stack for security and consistency
- **Professional Layout**: Enterprise-grade tree organization with clear project boundaries
- **Immediate Feedback**: API connection status and all project data visible without interaction

### 📁 **Smart Data Export** *(Enhanced)*
- **Workspace Integration**: Export data directly into your VS Code workspace
- **Automatic Organization**: Data is organized in logical folders (stage → bucket → table)
- **Flexible Limits**: Set different row limits for preview vs. full export
- **Header Control**: Choose whether to include column headers in exports
- **Progress Tracking**: See export progress with detailed logging

### 🗂️ **Export Options**

#### **Table Export**
- Export individual tables as CSV files
- Choose custom row limits (or unlimited with 0)
- Include/exclude headers as needed
- Preview data before full export

#### **Bucket Export**
- Export entire buckets (all tables within a bucket)
- Maintains folder structure automatically
- Batch processing with progress updates
- Handles empty tables gracefully

#### **Stage Export**
- Export complete stages (all buckets and tables)
- Creates comprehensive data snapshots
- Perfect for data backups or analysis

#### **Metadata Export**
- Export table schemas as JSON files
- Includes column types, descriptions, and metadata
- Great for documentation and data cataloging
- Separate schema files for each table

#### **Configuration Export** *(Version 3.0.0)*
- **JSON Viewer**: Open configurations in read-only JSON editor tabs
- **Metadata Panels**: Rich HTML panels with configuration details
- **Branch Information**: Complete branch metadata and creation info
- **Version Tracking**: View configuration versions and change descriptions

#### **NEW: Jobs Management** *(Version 3.1.0)*
- **Job History Export**: View and analyze job execution history
- **Performance Reports**: Duration and resource usage analysis
- **Error Debugging**: Detailed error messages and exception tracking
- **Execution Timeline**: Track job runs across different configurations
- **Status Monitoring**: Real-time job status with automatic refresh

### ⚙️ **Customizable Settings**

#### **Export Configuration**
- **Preview Limit**: How many rows to show in quick previews (default: 100)
- **Export Limit**: Default rows for full exports (default: 2000)
- **Export Folder**: Choose where data gets saved in your workspace (default: "kbc_project")
- **Headers**: Default setting for including column headers

#### **Connection Settings**
- **Cloud Provider**: Choose your Keboola cloud (AWS, Azure, GCP)
- **Region**: Select your specific region
- **API Token**: Secure token storage and management

### 🎯 **User-Friendly Interface**

#### **Activity Bar Integration** *(Enhanced in 4.1.0)*
- Dedicated Keboola icon in VS Code's side panel
- **API Status at Top Level**: Connection status appears as the very first item for immediate awareness
- **🆕 Multi-Project View**: Each project has its own complete section with Storage, Configurations, and Jobs
- **🆕 Parallel Operations**: Work with multiple projects simultaneously without switching
- Always accessible from anywhere in your project
- **Enhanced Navigation**: Navigate seamlessly between multiple projects and their respective data, configurations, jobs, and AI agents

#### **Smart Panels**
- **API Status Panel**: Global connection status indicator at the top level
- **Detail Panels**: Rich information displays for tables, buckets, stages, branches, configurations, and jobs
- **Settings Panel**: Easy configuration management
- **Automatic Updates**: Refresh data with dedicated refresh commands
- **Configuration Panels**: Beautiful HTML panels for branch and configuration metadata
- **NEW: Job Detail Panels**: Comprehensive job information with timing, status, and error details
- **NEW: Recent Jobs Integration**: Job history embedded in configuration detail panels
- **NEW: Agent Creation Panel**: Visual interface for creating and configuring AI agents
- **NEW: Agent Detail Panel**: Real-time monitoring with live updates and HITL interface

#### **Enhanced Commands**
- **Refresh Storage**: Update storage data only
- **Refresh Configurations**: Update configurations data only
- **NEW: Refresh Jobs**: Update jobs data and status
- **NEW: Agent Commands**: Create, start, pause, resume, stop, and monitor AI agents
- **Show Details**: Context-aware detail views for any selected item
- **NEW: Show Job Details**: Open comprehensive job information panels
- **NEW: Show Jobs for Configuration**: View jobs filtered by specific configuration
- **NEW: Agent Management**: Complete lifecycle control for AI agents
- **Command Palette**: Full command integration for power users

#### **Export Workflow**
1. Browse to any table, bucket, or stage
2. Click the export button
3. Choose your row limit (or accept defaults)
4. Decide on headers (or use your default setting)
5. Data appears in your workspace automatically!

#### **Configuration Workflow**
1. Browse to any branch in Configurations section
2. Expand to see component categories
3. Navigate through components and their configurations
4. Click any configuration to open JSON in editor
5. View metadata in the detail panel

#### **NEW: Jobs Workflow** *(Version 3.1.0)*
1. Navigate to Jobs section in the tree view
2. Choose from Running, Failed (24h), Finished (24h), or All jobs
3. Browse job lists with status and timing information
4. Click any job to open detailed job information panel
5. Use "Load more..." to see additional jobs
6. Access job actions: refresh status, copy ID, open in Keboola UI
7. View recent jobs for any configuration in the configuration detail panels

#### **NEW: AI Agents Workflow** *(Version 4.0.0)*
1. Navigate to AI Agents section in the tree view
2. Create new agent or use demo agent for testing
3. Configure agent settings (model, budget, tools, policies)
4. Start agent execution and monitor real-time progress
5. Handle HITL requests for sensitive actions
6. Review execution traces and export reports
7. Manage agent lifecycle (pause, resume, stop)

---

## 🎪 **Real-World Use Cases**

### **For Data Analysts** *(Enhanced)*
- Quick data exploration and sampling
- Export datasets for local analysis
- Create data documentation with metadata exports
- Compare data across different stages
- **NEW**: Browse and understand project configurations
- **NEW**: Review component setups and parameters

### **For Developers** *(Enhanced)*
- Access production data for testing
- Create local development datasets
- Validate data transformations
- Build data pipelines with real data
- **NEW**: Review and understand component configurations
- **NEW**: Inspect branch-specific setups
- **NEW**: Copy configuration JSONs for local development

### **For Data Engineers** *(Enhanced in 4.1.0)*
- Monitor data quality across stages
- Create data backups and snapshots
- Document data schemas and structures
- Troubleshoot data pipeline issues
- **NEW**: Audit project configurations across branches
- **NEW**: Review component versions and changes
- **NEW**: Manage development vs. production configurations
- **🆕 Multi-Project**: Compare data quality and configurations across production, staging, and development projects simultaneously
- **🆕 Parallel Operations**: Monitor jobs and manage configurations across multiple projects without switching
- **🆕 Cross-Project Analysis**: Compare table schemas, configurations, and performance across environments

### **For Business Users** *(Enhanced)*
- Browse available data assets
- Export reports and datasets
- Understand data structure and relationships
- Access data without technical barriers
- **NEW**: Understand project setup and component organization
- **NEW**: Review data processing workflows

### **For DevOps & Configuration Management** *(Enhanced in v3.0.0)*
- **Branch Management**: Review and compare configurations across development branches
- **Component Auditing**: Understand what components are configured and how
- **Version Control**: Track configuration changes and versions
- **Documentation**: Export configuration JSONs for documentation purposes
- **Troubleshooting**: Quickly inspect component configurations when issues arise

### **NEW: For Operations & Job Monitoring** *(Version 3.1.0)*
- **Real-time Monitoring**: Track job execution status without leaving VS Code
- **Performance Analysis**: Monitor job duration trends and resource usage
- **Error Investigation**: Quick access to job errors and debugging information
- **Pipeline Health**: Overview of system health through job success rates
- **Troubleshooting**: Immediate access to failed job details and error messages
- **Capacity Planning**: Resource usage insights for infrastructure planning
- **Configuration Testing**: Track job results after configuration changes

### **NEW: For AI & Automation Teams** *(Version 4.0.0)*
- **AI Agent Management**: Create and monitor AI agents for data engineering tasks
- **Policy Enforcement**: Implement safety guardrails and execution limits
- **Human Oversight**: HITL system for sensitive automated operations
- **Cost Control**: Budget and token tracking for AI resource management
- **Execution Monitoring**: Real-time agent status and progress tracking
- **Debugging Tools**: Detailed execution traces and analysis capabilities
- **Automation Testing**: Demo agents for testing AI capabilities safely

### **🆕 For Multi-Project Teams** *(Version 4.1.0)*
- **Environment Management**: Simultaneously manage production, staging, and development environments
- **Cross-Project Comparison**: Compare configurations, data quality, and performance across projects
- **Parallel Development**: Work on multiple projects without constant context switching
- **Team Collaboration**: Share access to multiple project environments with team members
- **Deployment Pipeline**: Monitor data flow and jobs across the entire development pipeline
- **Configuration Sync**: Compare and align configurations between different project environments
- **Quality Assurance**: Validate data consistency and configuration parity across environments

---

## 💡 **Tips & Best Practices**

### **Efficient Data Exploration**
- Use preview limits to quickly explore large tables
- Start with small exports to understand data structure
- Use metadata exports to document your data catalog

### **Configuration Management** *(Version 3.0.0)*
- **Start with Main Branch**: Begin configuration exploration with the default branch
- **Use Component Categories**: Navigate through organized component types (Extractors, Writers, etc.)
- **JSON Editor Integration**: Leverage VS Code's JSON features for syntax highlighting and formatting
- **Branch Comparison**: Use the refresh button to update configurations when switching contexts

### **NEW: Jobs Monitoring** *(Version 3.1.0)*
- **Start with Recent Jobs**: Check "All" group first to see overall system activity
- **Use Smart Filters**: Running jobs for current activity, Failed for troubleshooting
- **Monitor Performance**: Track job durations to identify performance bottlenecks
- **Configuration Context**: Use Recent Jobs in configuration panels to see execution history
- **Refresh Regularly**: Use refresh buttons to get latest job status updates
- **Error Investigation**: Click failed jobs immediately for detailed error analysis

### **NEW: AI Agents Management** *(Version 4.0.0)*
- **Start with Demo Agent**: Use "Create Demo Agent" for safe testing
- **Configure Policies**: Set appropriate safety guardrails and execution limits
- **Monitor Progress**: Track real-time status, progress, and confidence updates
- **Handle HITL**: Approve or reject agent actions requiring human oversight
- **Review Traces**: Examine execution traces for debugging and analysis
- **Export Reports**: Generate comprehensive execution reports for documentation
- **Cost Management**: Monitor budget usage and token consumption

### **🆕 Multi-Project Management** *(Version 4.1.0)*
- **Same Stack Only**: Ensure all projects are on the same Keboola stack for security
- **Logical Organization**: Name projects clearly (e.g., "Production", "Staging", "Development")
- **Token Security**: Use project-specific API tokens with appropriate permissions
- **Parallel Monitoring**: Keep an eye on jobs across all projects simultaneously
- **Configuration Parity**: Use the extension to compare configurations between environments
- **Team Coordination**: Share project access patterns with team members
- **Environment Validation**: Regularly verify data consistency across project environments

### **Workspace Organization**
- Choose meaningful export folder names
- Use consistent naming conventions
- Keep exports organized by project or purpose
- **NEW**: Save configuration JSONs alongside data exports for complete project documentation

### **Performance Optimization**
- Set appropriate row limits for your needs
- Use unlimited exports (0) only when necessary
- Export during off-peak hours for large datasets
- **NEW**: Configurations load lazily - expand branches only when needed

### **Data Security**
- Regularly rotate your API tokens
- Use workspace-local exports for sensitive data
- Test connections before important export operations
- Configuration data is read-only for security
- **NEW**: Job data is read-only with secure token masking in debug logs
- **NEW**: Unified authentication prevents token inconsistencies across all sections

---

## 🔄 **What's New in Version 4.1.0**

### 🏢 **Version 4.1.0 - Complete Multi-Project Support**
#### 🚀 **MAJOR NEW FEATURE: Simultaneous Multi-Project Display**
- **🏢 No More Project Switching**: All projects now display simultaneously in the tree view!
- **🌳 Independent Project Sections**: Each project has its own Storage, Configurations, and Jobs sections
- **🔒 Same-Stack Security**: Strict validation ensures all projects are on the same Keboola stack
- **⚡ Instant Access**: Work with multiple projects simultaneously for maximum productivity
- **🔄 Backward Compatibility**: Existing single-project setups continue working seamlessly

#### 🎯 **Simplified Token Management**
- **One-Click Addition**: Simply paste an API token and project details are auto-detected
- **Smart Validation**: Automatic project information retrieval and same-stack validation
- **Clean Interface**: Streamlined settings panel without complex forms
- **Instant Refresh**: New projects appear immediately in both tree view and settings

#### 🌳 **New Tree Structure**
```
📁 Keboola Explorer
├── ✅ Connected to Keboola API
├── 📊 Production Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
├── 📊 Staging Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
├── 📊 Development Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
└── 🤖 AI Agents
    ├── 🏃 Running
    ├── ✅ Completed
    ├── ❌ Failed
    └── 📥 HITL Inbox
```

#### 🔧 **Enhanced Architecture**
- **Project Context Management**: Each data provider maintains project-specific context and caching
- **Independent Operations**: Projects operate completely independently without interference
- **Improved Error Handling**: Project-specific error messages and debugging context
- **Command Cleanup**: Removed obsolete project switching commands

### 🏢 **Version 4.0.4 - Multi-Project Credentials for AI Agents** *(Previous Release)*
#### 🆕 **AI Agent Multi-Project Features**
- **🏢 AI Agent Multi-Project Support**: AI agents can now operate across multiple Keboola projects simultaneously
- **🔑 Project Credentials Management**: Add, edit, and remove project credentials with secure token storage
- **🎯 Project Selection**: Choose which projects agents can access with per-project permissions
- **📊 Project Context**: Agents can specify which project to use for each tool call

### 🐛 **Version 4.0.2 - Bucket Detail Panel Fix**
#### 🔧 **Critical Bug Fix**
- **🔧 Fixed Bucket Export**: Resolved issue where bucket detail panel would export wrong bucket after switching tabs
- **🔄 Panel State Management**: Fixed message handler to properly track current bucket when reusing existing panels
- **📊 Export Accuracy**: Bucket export now correctly exports the currently displayed bucket, not the originally opened bucket
- **🎯 User Experience**: Seamless bucket switching without losing export functionality

### 🚀 **Version 3.1.0 - Jobs Monitoring System**
#### 🆕 **Major New Features**
- **📊 Jobs Monitoring**: Complete real-time job tracking and monitoring system
- **🎯 Smart Filtering**: Pre-organized job groups (Running, Failed, Finished, All)
- **💼 Job Detail Panels**: Rich WebView panels with comprehensive job metadata
- **🔗 Configuration Integration**: Recent Jobs embedded in configuration detail panels
- **⚡ Queue API Integration**: Direct connection to Keboola Queue API
- **🔄 Real-time Updates**: Live job status tracking with refresh capabilities

#### 🔧 **Enhanced Monitoring**
- **📈 Performance Tracking**: Duration analysis and resource usage monitoring
- **🔍 Error Debugging**: Detailed error messages and exception tracking
- **🎮 Interactive Actions**: Refresh jobs, copy IDs, open in Keboola UI
- **📱 Pagination Support**: Efficient handling of large job lists with "Load more"

### 🐛 **Version 3.1.2 - Critical Configuration Fix**
#### 🔧 **Unified Configuration System**
- **🔑 Fixed Authentication**: Resolved 401 Unauthorized errors in Jobs API
- **⚙️ Configuration Consistency**: All API clients now use unified settings storage
- **🔄 Settings Synchronization**: Extension Settings panel properly updates all sections
- **📋 Root Cause Resolution**: Eliminated dual configuration system

### 🏗️ **Version 3.0.0 - Configurations Management** *(Previous Release)*
#### 🆕 **Major Features**
- **🏗️ Configurations Section**: Complete project configuration management
- **🌿 Branch Explorer**: Browse and explore development branches
- **📦 Component Categories**: Organized view of all component types
- **📝 JSON Configuration Viewer**: Open configurations in VS Code's JSON editor
- **📊 Rich Metadata Panels**: Beautiful HTML panels for branches and configurations
- **🔄 Dedicated Refresh**: Separate refresh commands for Storage and Configurations
- **⚡ Lazy Loading**: Performance-optimized loading of components and configurations

### 🔧 **Enhanced Architecture** *(Across All Versions)*
- **🎯 Triple-Section Interface**: Storage, Configurations, and Jobs in unified view
- **🔗 Shared API Client**: Single connection for all Keboola services
- **📱 Responsive Design**: Panels adapt to VS Code themes and sizes
- **🛡️ Error Handling**: Graceful error handling without breaking existing functionality
- **🔑 Unified Authentication**: Consistent settings storage across all sections

### 💪 **Developer Experience** *(Continuously Enhanced)*
- **📚 Complete Documentation**: Full feature documentation and use cases
- **🎨 Consistent UI**: Same look and feel across Storage, Configurations, and Jobs
- **⌨️ Command Integration**: Full VS Code Command Palette support
- **🔍 Context Awareness**: Smart context menus and actions
- **🔧 Debug Capabilities**: Enhanced logging for troubleshooting API issues

---

## 🎬 **Getting Started**

### **First-Time Setup** *(Updated for 4.1.0)*
1. **Install**: Get the extension from VS Code marketplace
2. **Configure**: Open settings and add your main Keboola connection details
3. **Test**: Use the "Test Connection" button to verify setup
4. **Check API Status**: See connection status at the top of the tree view
5. **🆕 Add Additional Projects**: Paste API tokens for other projects on the same stack
6. **🆕 Multi-Project View**: See all your projects displayed simultaneously in the tree
7. **Explore Per-Project**: Each project has its own Storage, Configurations, and Jobs sections
8. **Work in Parallel**: Access multiple projects at once without switching

### **Storage Workflow**
1. **Browse**: Navigate through stages, buckets, and tables
2. **Preview**: Click tables to see quick data previews
3. **Export**: Use export buttons for data extraction
4. **Customize**: Adjust export settings to match your workflow

### **Configuration Workflow**
1. **Select Branch**: Start with "Main Branch" or choose a development branch
2. **Browse Categories**: Explore Extractors, Writers, Transformations, etc.
3. **View Components**: See all components in each category
4. **Open Configurations**: Click any configuration to view JSON
5. **Review Metadata**: Check the detail panel for additional information

### **NEW: Jobs Workflow** *(Version 3.1.0)*
1. **Navigate to Jobs**: Find the Jobs section below Configurations
2. **Choose Job Group**: Select Running, Failed, Finished, or All jobs
3. **Browse Job Lists**: See job status, timing, and component information
4. **View Job Details**: Click any job for comprehensive execution information
5. **Monitor Performance**: Track duration, errors, and resource usage
6. **Use Job Actions**: Refresh status, copy IDs, or open in Keboola UI
7. **Check Configuration Jobs**: View recent jobs in configuration detail panels

### **NEW: AI Agents Workflow** *(Version 4.0.0)*
1. **Navigate to AI Agents**: Find the AI Agents section in the tree view
2. **Create Agent**: Use "Create AI Agent" or "Create Demo Agent" commands
3. **Configure Settings**: Set model, budget, tools, and safety policies
4. **Start Execution**: Begin agent execution with real-time monitoring
5. **Handle HITL**: Approve or reject agent actions requiring oversight
6. **Monitor Progress**: Track status, progress, and cost in real-time
7. **Review Results**: Examine traces and export execution reports

### **🆕 Multi-Project Workflow** *(Version 4.1.0)*
1. **Set Up Main Project**: Configure your primary Keboola project connection
2. **Add Additional Projects**: Paste API tokens for other projects on the same stack
3. **Auto-Detection**: Project details are automatically detected and validated
4. **Simultaneous Access**: All projects appear in the tree view at once
5. **Independent Operations**: Work with Storage, Configurations, and Jobs across all projects
6. **Parallel Development**: Compare data, configurations, and jobs across projects instantly
7. **Manage Projects**: Add, test, or remove projects as needed in Settings

**Ready to manage your complete multi-project Keboola ecosystem with simultaneous access, AI agents, real-time monitoring, and human oversight!** 🚀🏢🤖📊 