# Keboola Data Engineering Booster

A comprehensive Visual Studio Code extension for exploring and managing your Keboola Connection projects. Browse storage buckets and tables, manage configurations across branches, and monitor job execution - all from within VS Code.

## 🚀 Features

### 📂 Storage Explorer
- **Bucket Management**: Browse all storage buckets in your project
- **Table Details**: View table schemas, metadata, and data previews
- **Interactive Navigation**: Hierarchical tree view with expandable buckets
- **Quick Access**: Direct links to Keboola Connection web interface

### ⚙️ Configurations Management
- **Branch Navigation**: Switch between development branches
- **Component Organization**: Browse components by category (extractors, writers, transformations, etc.)
- **Configuration Details**: View and edit component configurations
- **Multi-Branch Support**: Manage configurations across different branches

### 📊 Jobs Monitoring
- **Real-Time Status**: Monitor running, failed, and completed jobs
- **Job Details**: Comprehensive job information including logs and metadata
- **Filtering**: View jobs by status, component, or time period
- **Quick Actions**: Direct access to job details and related configurations

## 📋 Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/) (version 1.60.0 or higher)
- Valid Keboola Connection project with API access
- Storage API token with appropriate permissions

## 🛠️ Installation

### From VSIX Package
1. Download the latest `.vsix` file from the `builds/` directory
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
4. Click the "..." menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

### From Source
1. Clone this repository
2. Install dependencies: `npm install`
3. Compile TypeScript: `npm run compile`
4. Press `F5` to run in Extension Development Host

## ⚙️ Configuration

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Keboola"
3. Configure the following settings:
   - **Keboola URL**: Your Keboola Connection URL (e.g., `https://connection.keboola.com`)
   - **Storage API Token**: Your Storage API token
   - **Default Branch**: Default branch ID for configurations (optional)

Alternatively, use the Command Palette:
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
- Type "Keboola: Configure Settings"
- Follow the setup wizard

## 🎯 Usage

### Getting Started
1. After installation, open the Keboola Explorer panel in the Activity Bar
2. Configure your connection settings (see Configuration section above)
3. The extension will automatically load your project data

### Storage Explorer
- Expand buckets to view tables
- Click on tables to view details in the panel
- Use the refresh button to update bucket/table lists
- Access table data and metadata through detail panels

### Configurations Management
- Switch between branches using the branch selector
- Browse components organized by type
- View configuration details and parameters
- Access recent jobs for each configuration

### Jobs Monitoring
- Monitor job status in real-time
- Filter jobs by status (Running, Failed, Finished)
- View detailed job information including logs
- Navigate from jobs to their source configurations

## 🏗️ Project Structure

```
├── builds/                     # VSIX packages for different versions
├── src/
│   ├── jobs/                   # Jobs monitoring functionality
│   │   ├── jobsApi.ts         # Queue API client
│   │   ├── JobsTreeProvider.ts # Jobs tree view provider
│   │   └── JobDetailPanel.ts  # Job detail panels
│   ├── BranchDetailPanel.ts   # Branch information panels
│   ├── BucketDetailPanel.ts   # Bucket detail panels
│   ├── ConfigurationDetailPanel.ts # Configuration panels
│   ├── ConfigurationsPanel.ts # Configuration management panels
│   ├── ConfigurationsTreeProvider.ts # Configurations tree provider
│   ├── KeboolaTreeProvider.ts # Main tree provider
│   ├── TableDetailPanel.ts    # Table detail panels
│   ├── extension.ts           # Main extension entry point
│   ├── keboolaApi.ts          # Storage API client
│   └── settings.ts            # Settings management
├── package.json               # Extension manifest
└── README.md                  # This file
```

## 🔧 Development

### Building
```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
```

### Debugging
1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new window

### Packaging
```bash
npm install -g vsce
vsce package         # Creates .vsix file
```

## 📚 API Integration

This extension integrates with several Keboola APIs:

- **Storage API**: Buckets, tables, and project information
- **Components API**: Component configurations and metadata
- **Queue API**: Job monitoring and execution details
- **Management API**: Branch and project management

## 🔒 Security

- API tokens are stored securely in VS Code's extension storage
- Tokens are masked in debug logs for security
- All API communications use HTTPS

## 🆕 Version History

- **v3.1.2**: Unified authentication system across all sections
- **v3.1.1**: Added comprehensive debug logging
- **v3.1.0**: Introduced Jobs monitoring system
- **v3.0.0**: Added Configurations management with branch support
- **v2.x**: Storage Explorer functionality

## 🐛 Troubleshooting

### Common Issues

**"Unauthorized" errors:**
- Verify your Storage API token is valid and has appropriate permissions
- Check that the Keboola URL is correct
- Ensure you're using the correct project token

**Extension not loading:**
- Restart VS Code
- Check the Output panel for error messages
- Verify all required settings are configured

**Jobs not showing:**
- Ensure your token has access to the Queue API
- Check that the project has job history
- Try refreshing the Jobs view

### Debug Mode
Enable debug logging in settings to troubleshoot issues:
1. Open VS Code Settings
2. Search for "Keboola Debug"
3. Enable debug logging
4. Check the Output panel for detailed logs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Explore your Keboola projects efficiently with VS Code! 🚀** 