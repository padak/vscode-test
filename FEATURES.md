# 🔧 Keboola AI Data Platform - Features Guide

## 📋 **What This Extension Does**

The **Keboola AI Data Platform** extension is a comprehensive VS Code tool that helps you browse, explore, and manage your entire Keboola ecosystem directly within your code editor. Beyond data exploration, it now provides complete project configuration management, making it your one-stop solution for Keboola development.

---

## 🚀 **Key Features (Version 3.0.0)**

### 📊 **Storage Explorer** *(Preserved from v2.x)*
- **Browse Your Data Structure**: See all your stages (in, out), buckets, and tables in a tree view
- **Real-time Data Preview**: View table data directly in VS Code without leaving your editor
- **Detailed Information**: Get comprehensive details about tables, buckets, and stages
- **Search & Navigate**: Easily find and navigate through your data assets

### ⚙️ **NEW: Configurations Management**
- **Branch Explorer**: Browse all development branches in your project
- **Main Branch Identification**: Default branch clearly marked as "Main Branch"
- **Component Categories**: Organized view of Extractors, Writers, Transformations, Sandboxes, Data Apps, and Flows
- **Configuration Viewer**: Open any configuration as read-only JSON in VS Code editor
- **Branch Details**: Rich metadata panels showing branch information, creation details, and custom metadata
- **Configuration Metadata**: View configuration details including version, creator, and change descriptions
- **Lazy Loading**: Components and configurations load only when needed for optimal performance

### 🔌 **Easy Connection Setup**
- **Multi-Region Support**: Connect to any Keboola region (US, EU, Asia-Pacific)
- **Secure Authentication**: Store your API tokens securely
- **Connection Testing**: Verify your connection with one click
- **Multiple Projects**: Switch between different Keboola projects easily
- **Unified API Client**: Same connection settings work for both Storage and Configurations

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

#### **NEW: Configuration Export**
- **JSON Viewer**: Open configurations in read-only JSON editor tabs
- **Metadata Panels**: Rich HTML panels with configuration details
- **Branch Information**: Complete branch metadata and creation info
- **Version Tracking**: View configuration versions and change descriptions

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

#### **Activity Bar Integration**
- Dedicated Keboola icon in VS Code's side panel
- **Dual-Section View**: Storage and Configurations in the same unified interface
- Always accessible from anywhere in your project

#### **Smart Panels**
- **Detail Panels**: Rich information displays for tables, buckets, stages, branches, and configurations
- **Settings Panel**: Easy configuration management
- **Automatic Updates**: Refresh data with dedicated refresh commands
- **NEW: Configuration Panels**: Beautiful HTML panels for branch and configuration metadata

#### **Enhanced Commands**
- **Refresh Storage**: Update storage data only
- **NEW: Refresh Configurations**: Update configurations data only
- **Show Details**: Context-aware detail views for any selected item
- **Command Palette**: Full command integration for power users

#### **Export Workflow**
1. Browse to any table, bucket, or stage
2. Click the export button
3. Choose your row limit (or accept defaults)
4. Decide on headers (or use your default setting)
5. Data appears in your workspace automatically!

#### **NEW: Configuration Workflow**
1. Browse to any branch in Configurations section
2. Expand to see component categories
3. Navigate through components and their configurations
4. Click any configuration to open JSON in editor
5. View metadata in the detail panel

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

### **For Data Engineers** *(Enhanced)*
- Monitor data quality across stages
- Create data backups and snapshots
- Document data schemas and structures
- Troubleshoot data pipeline issues
- **NEW**: Audit project configurations across branches
- **NEW**: Review component versions and changes
- **NEW**: Manage development vs. production configurations

### **For Business Users** *(Enhanced)*
- Browse available data assets
- Export reports and datasets
- Understand data structure and relationships
- Access data without technical barriers
- **NEW**: Understand project setup and component organization
- **NEW**: Review data processing workflows

### **NEW: For DevOps & Configuration Management**
- **Branch Management**: Review and compare configurations across development branches
- **Component Auditing**: Understand what components are configured and how
- **Version Control**: Track configuration changes and versions
- **Documentation**: Export configuration JSONs for documentation purposes
- **Troubleshooting**: Quickly inspect component configurations when issues arise

---

## 💡 **Tips & Best Practices**

### **Efficient Data Exploration**
- Use preview limits to quickly explore large tables
- Start with small exports to understand data structure
- Use metadata exports to document your data catalog

### **NEW: Configuration Management**
- **Start with Main Branch**: Begin configuration exploration with the default branch
- **Use Component Categories**: Navigate through organized component types (Extractors, Writers, etc.)
- **JSON Editor Integration**: Leverage VS Code's JSON features for syntax highlighting and formatting
- **Branch Comparison**: Use the refresh button to update configurations when switching contexts

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
- **NEW**: Configuration data is read-only for security

---

## 🔄 **What's New in Version 3.0.0**

### 🆕 **Major New Features**
- **🏗️ Configurations Section**: Complete project configuration management
- **🌿 Branch Explorer**: Browse and explore development branches
- **📦 Component Categories**: Organized view of all component types
- **📝 JSON Configuration Viewer**: Open configurations in VS Code's JSON editor
- **📊 Rich Metadata Panels**: Beautiful HTML panels for branches and configurations
- **🔄 Dedicated Refresh**: Separate refresh commands for Storage and Configurations
- **⚡ Lazy Loading**: Performance-optimized loading of components and configurations

### 🔧 **Enhanced Architecture**
- **🎯 Unified Interface**: Storage and Configurations in the same activity view
- **🔗 Shared API Client**: Single connection for all Keboola services
- **📱 Responsive Design**: Panels adapt to VS Code themes and sizes
- **🛡️ Error Handling**: Graceful error handling without breaking existing functionality

### 💪 **Developer Experience**
- **📚 Complete Documentation**: Full feature documentation and use cases
- **🎨 Consistent UI**: Same look and feel across Storage and Configurations
- **⌨️ Command Integration**: Full VS Code Command Palette support
- **🔍 Context Awareness**: Smart context menus and actions

---

## 🎬 **Getting Started**

### **First-Time Setup**
1. **Install**: Get the extension from VS Code marketplace
2. **Configure**: Open settings and add your Keboola connection details
3. **Test**: Use the "Test Connection" button to verify setup
4. **Explore Storage**: Browse your data in the Storage section
5. **NEW: Explore Configurations**: Check out the Configurations section below Storage

### **Storage Workflow**
1. **Browse**: Navigate through stages, buckets, and tables
2. **Preview**: Click tables to see quick data previews
3. **Export**: Use export buttons for data extraction
4. **Customize**: Adjust export settings to match your workflow

### **NEW: Configuration Workflow**
1. **Select Branch**: Start with "Main Branch" or choose a development branch
2. **Browse Categories**: Explore Extractors, Writers, Transformations, etc.
3. **View Components**: See all components in each category
4. **Open Configurations**: Click any configuration to view JSON
5. **Review Metadata**: Check the detail panel for additional information

**Ready to manage your complete Keboola ecosystem like never before!** 🚀 