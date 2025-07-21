# 🔧 Keboola Storage API Explorer - Features Guide

## 📋 **What This Extension Does**

The **Keboola Storage API Explorer** is a VS Code extension that helps you browse, explore, and export data from your Keboola projects directly within your code editor. Think of it as a file explorer, but for your Keboola data warehouse.

---

## 🚀 **Key Features (Version 2.7.2)**

### 📊 **Data Browser**
- **Browse Your Data Structure**: See all your stages (in, out), buckets, and tables in a tree view
- **Real-time Data Preview**: View table data directly in VS Code without leaving your editor
- **Detailed Information**: Get comprehensive details about tables, buckets, and stages
- **Search & Navigate**: Easily find and navigate through your data assets

### 🔌 **Easy Connection Setup**
- **Multi-Region Support**: Connect to any Keboola region (US, EU, Asia-Pacific)
- **Secure Authentication**: Store your API tokens securely
- **Connection Testing**: Verify your connection with one click
- **Multiple Projects**: Switch between different Keboola projects easily

### 📁 **Smart Data Export**
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
- Always accessible from anywhere in your project

#### **Smart Panels**
- **Detail Panels**: Rich information displays for tables, buckets, and stages
- **Settings Panel**: Easy configuration management
- **Automatic Updates**: Refresh data with one click

#### **Export Workflow**
1. Browse to any table, bucket, or stage
2. Click the export button
3. Choose your row limit (or accept defaults)
4. Decide on headers (or use your default setting)
5. Data appears in your workspace automatically!

---

## 🎪 **Real-World Use Cases**

### **For Data Analysts**
- Quick data exploration and sampling
- Export datasets for local analysis
- Create data documentation with metadata exports
- Compare data across different stages

### **For Developers**
- Access production data for testing
- Create local development datasets
- Validate data transformations
- Build data pipelines with real data

### **For Data Engineers**
- Monitor data quality across stages
- Create data backups and snapshots
- Document data schemas and structures
- Troubleshoot data pipeline issues

### **For Business Users**
- Browse available data assets
- Export reports and datasets
- Understand data structure and relationships
- Access data without technical barriers

---

## 💡 **Tips & Best Practices**

### **Efficient Data Exploration**
- Use preview limits to quickly explore large tables
- Start with small exports to understand data structure
- Use metadata exports to document your data catalog

### **Workspace Organization**
- Choose meaningful export folder names
- Use consistent naming conventions
- Keep exports organized by project or purpose

### **Performance Optimization**
- Set appropriate row limits for your needs
- Use unlimited exports (0) only when necessary
- Export during off-peak hours for large datasets

### **Data Security**
- Regularly rotate your API tokens
- Use workspace-local exports for sensitive data
- Test connections before important export operations

---

## 🔄 **What's New in Version 2.7.2**

- **🏠 Workspace-First Design**: All exports go directly to your VS Code workspace
- **📁 Smart Folder Structure**: Automatic organization by stage/bucket/table
- **⚙️ Enhanced Settings**: More control over export behavior and defaults
- **🔧 Improved Reliability**: Better error handling and progress tracking
- **📋 Rich Metadata**: Comprehensive schema exports with full table details
- **🎯 User Experience**: Streamlined workflows and intuitive interfaces

---

## 🎬 **Getting Started**

1. **Install**: Get the extension from VS Code marketplace
2. **Configure**: Open settings and add your Keboola connection details
3. **Test**: Use the "Test Connection" button to verify setup
4. **Explore**: Browse your data in the Keboola panel
5. **Export**: Start with small table exports to get familiar
6. **Customize**: Adjust settings to match your workflow

**Ready to explore your Keboola data like never before!** 🚀 