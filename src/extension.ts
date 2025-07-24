import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';
import { KeboolaTreeProvider, TreeItem } from './KeboolaTreeProvider';
import { ProjectTreeProvider } from './project/ProjectTreeProvider';
import { TableDetailPanel } from './TableDetailPanel';
import { BucketDetailPanel } from './BucketDetailPanel';
import { StageDetailPanel } from './StageDetailPanel';
import { SettingsPanel } from './SettingsPanel';
import { ConfigurationsPanel } from './ConfigurationsPanel';
import { JobDetailPanel } from './jobs/JobDetailPanel';
import { JobsApi } from './jobs/jobsApi';
import { DownloadsStore } from './watch/DownloadsStore';
import { TableWatcher, WatchSettings } from './watch/TableWatcher';
import { WatchedTablesTreeProvider } from './watch/WatchedTablesTreeProvider';

let keboolaApi: KeboolaApi | undefined;
let keboolaTreeProvider: KeboolaTreeProvider;
let projectTreeProvider: ProjectTreeProvider;
let treeView: vscode.TreeView<vscode.TreeItem>;
let outputChannel: vscode.OutputChannel;
let downloadsStore: DownloadsStore;
let tableWatcher: TableWatcher;
let watchedTablesTreeProvider: WatchedTablesTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    	console.log('Keboola Data Engineering Booster is now active!');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Keboola Storage Explorer');
    context.subscriptions.push(outputChannel);

    // Initialize tree providers
    keboolaTreeProvider = new KeboolaTreeProvider();
    
    // Initialize table watcher system
    downloadsStore = new DownloadsStore(context);
    tableWatcher = new TableWatcher(context, downloadsStore, outputChannel);
    watchedTablesTreeProvider = new WatchedTablesTreeProvider(context, downloadsStore);
    
    // Initialize project tree provider with watched tables support
    projectTreeProvider = new ProjectTreeProvider(context, keboolaTreeProvider, watchedTablesTreeProvider);
    
    // Create and register the tree view with the activity bar container
    treeView = vscode.window.createTreeView('keboolaExplorer', {
        treeDataProvider: projectTreeProvider,
        showCollapseAll: true
    });

    // Add tree view to context subscriptions
    context.subscriptions.push(treeView);

    // Load stored configuration and initialize API
    initializeFromSettings(context);

    // Register commands
    registerCommands(context);

    console.log('All commands registered successfully');
}

function getSettingsFromContext(context: vscode.ExtensionContext) {
    return {
        apiUrl: context.globalState.get<string>('keboola.apiUrl') || '',
        token: context.globalState.get<string>('keboola.token') || '',
        previewRowLimit: context.globalState.get<number>('keboola.previewRowLimit') || 100,
        exportRowLimit: context.globalState.get<number>('keboola.exportRowLimit') || 2000,
        includeHeaders: context.globalState.get<boolean>('keboola.includeHeaders') ?? true
    };
}

function initializeFromSettings(context: vscode.ExtensionContext) {
    const settings = getSettingsFromContext(context);
    
    if (settings.apiUrl && settings.token) {
        keboolaApi = new KeboolaApi({ 
            apiUrl: settings.apiUrl, 
            token: settings.token 
        });
        // Pass the same settings to tree provider so Jobs API uses consistent config
        keboolaTreeProvider.setKeboolaApi(keboolaApi, {
            apiUrl: settings.apiUrl,
            token: settings.token
        });
        
        // Fetch and cache project name
        fetchProjectName(context, keboolaApi);
    }
    
    // Initialize table watcher with current settings
    initializeTableWatcher(context);
}

async function fetchProjectName(context: vscode.ExtensionContext, api: KeboolaApi): Promise<void> {
    try {
        const result = await api.testConnection();
        if (result.success && result.tokenInfo?.owner?.name) {
            const projectName = result.tokenInfo.owner.name;
            await context.globalState.update('keboola.projectName', projectName);
            console.log(`[Extension] Project name cached: ${projectName}`);
            
            // Refresh the project tree to show the updated name
            projectTreeProvider.refresh();
        } else {
            console.log('[Extension] Could not fetch project name, using fallback');
            await context.globalState.update('keboola.projectName', 'Unknown Project');
            projectTreeProvider.refresh();
        }
    } catch (error) {
        console.error('[Extension] Failed to fetch project name:', error);
        await context.globalState.update('keboola.projectName', 'Unknown Project');
        projectTreeProvider.refresh();
    }
}

function initializeTableWatcher(context: vscode.ExtensionContext) {
    // Get current table watcher settings
    const settings: WatchSettings = {
        watchEnabled: context.globalState.get<boolean>('keboola.watchEnabled') ?? true,
        watchIntervalSec: context.globalState.get<number>('keboola.watchIntervalSec') || 20,
        autoDownload: context.globalState.get<boolean>('keboola.autoDownload') ?? false
    };
    
    console.log('[Extension] Initializing table watcher with settings:', settings);
    
    // Start the table watcher with current settings
    tableWatcher.start(settings);
}

function registerCommands(context: vscode.ExtensionContext) {
    // Settings panel command
    const settingsCmd = vscode.commands.registerCommand('keboola.settings', () => {
        SettingsPanel.createOrShow(context, context.extensionUri);
    });

    // Configure connection (now opens settings panel)
    const configureCmd = vscode.commands.registerCommand('keboola.configure', () => {
        SettingsPanel.createOrShow(context, context.extensionUri);
    });

    // Refresh tree
    const refreshCmd = vscode.commands.registerCommand('keboola.refresh', () => {
        // Reinitialize API from current settings
        initializeFromSettings(context);
        // Note: initializeFromSettings already calls treeProvider.refresh() via setKeboolaApi
    });

    // Refresh configurations only
    const refreshConfigurationsCmd = vscode.commands.registerCommand('keboola.refreshConfigurations', () => {
        keboolaTreeProvider.refreshConfigurations();
    });

    // Refresh project name and tree
    const refreshProjectCmd = vscode.commands.registerCommand('keboola.refreshProject', async () => {
        if (keboolaApi) {
            await fetchProjectName(context, keboolaApi);
        }
    });

    // Set row limit (now opens settings panel)
    const setRowLimitCmd = vscode.commands.registerCommand('keboola.setRowLimit', () => {
        SettingsPanel.createOrShow(context, context.extensionUri);
    });

    // Show table details
    const showTableCmd = vscode.commands.registerCommand('keboola.showTable', async (item?: TreeItem) => {
        if (!item || !item.table) {
            vscode.window.showErrorMessage('No table selected');
            return;
        }

        await showTableDetails(item.table.id, context);
    });

    // Show bucket details
    const showBucketCmd = vscode.commands.registerCommand('keboola.showBucket', async (item?: TreeItem) => {
        if (!item || !item.bucket) {
            vscode.window.showErrorMessage('No bucket selected');
            return;
        }

        await showBucketDetails(item.bucket.id, context);
    });

    // Show stage details
    const showStageCmd = vscode.commands.registerCommand('keboola.showStage', async (item?: TreeItem) => {
        if (!item || !item.stage) {
            vscode.window.showErrorMessage('No stage selected');
            return;
        }

        await showStageDetails(item.stage, context);
    });

    // Show branch details
    const showBranchCmd = vscode.commands.registerCommand('keboola.showBranch', async (item?: TreeItem) => {
        if (!item || !item.branch) {
            vscode.window.showErrorMessage('No branch selected');
            return;
        }

        await showBranchDetails(item.branch.id, context);
    });

    // Show configuration details (opens JSON in new tab)
    const showConfigurationCmd = vscode.commands.registerCommand('keboola.showConfiguration', async (item?: TreeItem) => {
        if (!item || !item.configuration || !item.component || !item.branch) {
            vscode.window.showErrorMessage('No configuration selected');
            return;
        }

        await showConfigurationDetails(item.component.id, item.configuration.id, item.branch.id, context);
    });

    // Refresh jobs only
    const refreshJobsCmd = vscode.commands.registerCommand('keboola.refreshJobs', () => {
        keboolaTreeProvider.refreshJobs();
    });

    // Show job details
    const showJobCmd = vscode.commands.registerCommand('keboola.showJob', async (item?: TreeItem) => {
        if (!item || !item.job) {
            vscode.window.showErrorMessage('No job selected');
            return;
        }

        await showJobDetails(item.job.id, context);
    });

    // Show jobs for configuration (context menu on configuration)
    const showJobsForConfigCmd = vscode.commands.registerCommand('keboola.showJobsForConfiguration', async (item?: TreeItem) => {
        if (!item || !item.configuration || !item.component) {
            vscode.window.showErrorMessage('No configuration selected');
            return;
        }

        await showJobsForConfiguration(item.component.id, item.configuration.id, item.branch?.id, context);
    });

    // Internal command to handle settings changes (restart table watcher)
    const settingsChangedCmd = vscode.commands.registerCommand('keboola.internal.settingsChanged', () => {
        console.log('[Extension] Settings changed, restarting table watcher');
        initializeTableWatcher(context);
    });

    // Watch Table command
    const watchTableCmd = vscode.commands.registerCommand('keboola.watchTable', async (item?: TreeItem) => {
        if (!item || !item.table) {
            vscode.window.showErrorMessage('No table selected');
            return;
        }

        await handleWatchTable(item.table.id, context);
    });

    // Unwatch Table command
    const unwatchTableCmd = vscode.commands.registerCommand('keboola.unwatchTable', async (item?: any) => {
        let tableId: string | undefined;
        
        // Handle different item types
        if (item?.table?.id) {
            // Storage tree item
            tableId = item.table.id;
        } else if (item?.tableId) {
            // Watched table item
            tableId = item.tableId;
        }
        
        if (!tableId) {
            vscode.window.showErrorMessage('No table selected');
            return;
        }

        await handleUnwatchTable(tableId, context);
    });

    // Add all commands to subscriptions
    context.subscriptions.push(
        settingsCmd,
        configureCmd,
        refreshCmd,
        refreshConfigurationsCmd,
        setRowLimitCmd,
        showTableCmd,
        showBucketCmd,
        showStageCmd,
        showBranchCmd,
        showConfigurationCmd,
        refreshJobsCmd,
        showJobCmd,
        showJobsForConfigCmd,
        refreshProjectCmd,
        settingsChangedCmd,
        watchTableCmd,
        unwatchTableCmd
    );
}

async function showTableDetails(tableId: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Ensure API is initialized with current settings
        if (!keboolaApi || keboolaApi.apiUrl !== settings.apiUrl || keboolaApi.token !== settings.token) {
            keboolaApi = new KeboolaApi({ 
                apiUrl: settings.apiUrl, 
                token: settings.token 
            });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading table details...",
            cancellable: false
        }, async () => {
            const tableDetail = await keboolaApi!.getTableDetail(tableId);

            TableDetailPanel.createOrShow(
                tableDetail,
                context.extensionUri,
                keboolaApi,
                settings.previewRowLimit,
                settings.exportRowLimit,
                context
            );
        });
    } catch (error) {
        console.error('Failed to load table details:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Failed to load table: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load table: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showBucketDetails(bucketId: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Ensure API is initialized with current settings
        if (!keboolaApi || keboolaApi.apiUrl !== settings.apiUrl || keboolaApi.token !== settings.token) {
            keboolaApi = new KeboolaApi({ 
                apiUrl: settings.apiUrl, 
                token: settings.token 
            });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading bucket details...",
            cancellable: false
        }, async () => {
            const bucketDetail = await keboolaApi!.getBucketDetail(bucketId);

            BucketDetailPanel.createOrShow(
                bucketDetail,
                context.extensionUri,
                keboolaApi,
                settings.previewRowLimit,
                settings.exportRowLimit,
                context
            );
        });
    } catch (error) {
        console.error('Failed to load bucket details:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Failed to load bucket: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load bucket: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showStageDetails(stage: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Ensure API is initialized with current settings
        if (!keboolaApi || keboolaApi.apiUrl !== settings.apiUrl || keboolaApi.token !== settings.token) {
            keboolaApi = new KeboolaApi({ 
                apiUrl: settings.apiUrl, 
                token: settings.token 
            });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Loading ${stage.toUpperCase()} stage details...`,
            cancellable: false
        }, async () => {
            const stageDetail = await keboolaApi!.getStageDetail(stage);

            StageDetailPanel.createOrShow(
                stageDetail,
                context.extensionUri,
                keboolaApi,
                settings.previewRowLimit,
                settings.exportRowLimit,
                context
            );
        });
    } catch (error) {
        console.error('Failed to load stage details:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Failed to load stage: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load stage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showBranchDetails(branchId: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Ensure API is initialized with current settings
        if (!keboolaApi || keboolaApi.apiUrl !== settings.apiUrl || keboolaApi.token !== settings.token) {
            keboolaApi = new KeboolaApi({ 
                apiUrl: settings.apiUrl, 
                token: settings.token 
            });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading branch details...",
            cancellable: false
        }, async () => {
            const branchDetail = await keboolaApi!.getBranchDetail(branchId);

            ConfigurationsPanel.createOrShow(
                branchDetail,
                context.extensionUri,
                keboolaApi,
                keboolaTreeProvider
            );
        });
    } catch (error) {
        console.error('Failed to load branch details:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Failed to load branch: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showConfigurationDetails(componentId: string, configurationId: string, branchId: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Ensure API is initialized with current settings
        if (!keboolaApi || keboolaApi.apiUrl !== settings.apiUrl || keboolaApi.token !== settings.token) {
            keboolaApi = new KeboolaApi({ 
                apiUrl: settings.apiUrl, 
                token: settings.token 
            });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading configuration details...",
            cancellable: false
        }, async () => {
            const configDetail = await keboolaApi!.getConfigurationDetail(componentId, configurationId, branchId);

            // Open configuration JSON in a new read-only editor tab
            const configJson = JSON.stringify(configDetail.configuration, null, 2);
            const doc = await vscode.workspace.openTextDocument({
                content: configJson,
                language: 'json'
            });

            await vscode.window.showTextDocument(doc, {
                preview: false,
                viewColumn: vscode.ViewColumn.One
            });

            // Show notification with basic info
            vscode.window.showInformationMessage(`Configuration JSON opened: ${configDetail.name} v${configDetail.version}`);

            // Also show the configuration panel with metadata
            ConfigurationsPanel.createOrShow(
                configDetail,
                context.extensionUri,
                keboolaApi,
                keboolaTreeProvider
            );
        });
    } catch (error) {
        console.error('Failed to load configuration details:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Failed to load configuration: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showJobDetails(jobId: string, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        // Initialize Jobs API
        const hostMatch = settings.apiUrl.match(/https?:\/\/([^\/]+)/);
        if (!hostMatch) {
            vscode.window.showErrorMessage('Invalid API URL format');
            return;
        }

        const jobsApi = new JobsApi(hostMatch[1], settings.token);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading job details...",
            cancellable: false
        }, async () => {
            const jobDetail = await jobsApi.getJobDetail(jobId);

            JobDetailPanel.createOrShow(
                jobDetail,
                context.extensionUri,
                jobsApi
            );
        });
    } catch (error) {
        console.error('Failed to load job details:', error);
        if (error instanceof Error && error.name === 'JobsApiError') {
            vscode.window.showErrorMessage(`Failed to load job: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Failed to load job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function showJobsForConfiguration(componentId: string, configurationId: string, branchId: string | undefined, context: vscode.ExtensionContext) {
    try {
        const settings = getSettingsFromContext(context);
        
        if (!settings.apiUrl || !settings.token) {
            vscode.window.showErrorMessage(
                'Please configure your Keboola connection in Settings first.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    SettingsPanel.createOrShow(context, context.extensionUri);
                }
            });
            return;
        }

        const jobs = await keboolaTreeProvider.getJobsForConfiguration(componentId, configurationId, branchId);

        if (jobs.length === 0) {
            vscode.window.showInformationMessage(`No jobs found for configuration ${componentId}/${configurationId}`);
            return;
        }

        // Show a quick pick with recent jobs
        const jobItems = jobs.map((job: any) => ({
            label: `${job.status} • ${job.id}`,
            description: `${job.createdTime} • Duration: ${job.durationSeconds ? `${job.durationSeconds}s` : 'N/A'}`,
            detail: job.error?.message || job.result?.message || '',
            job: job
        }));

        const selectedJob = await vscode.window.showQuickPick(jobItems, {
            placeHolder: `Select a job for ${componentId}/${configurationId}`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selectedJob) {
            await showJobDetails(selectedJob.job.id, context);
        }

    } catch (error) {
        console.error('Failed to load jobs for configuration:', error);
        vscode.window.showErrorMessage(`Failed to load jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function deactivate() {
    console.log('Keboola Data Engineering Booster is now deactivated');
    
    // Stop table watcher on deactivation
    if (tableWatcher) {
        tableWatcher.stop();
    }
}

async function handleWatchTable(tableId: string, context: vscode.ExtensionContext): Promise<void> {
    try {
        // Check if table is already being watched
        const projectName = context.globalState.get<string>('keboola.projectName') || 'unknown';
        
        if (downloadsStore.isWatched(projectName, tableId)) {
            vscode.window.showInformationMessage(`Table "${getTableDisplayName(tableId)}" is already being watched`);
            return;
        }

        // For now, we'll create a placeholder record - in a real implementation, 
        // this would prompt the user to export the table first
        vscode.window.showInformationMessage(
            `To watch table "${getTableDisplayName(tableId)}", please export it first. The table will automatically be added to the watch list after export.`,
            'Export Table'
        ).then(selection => {
            if (selection === 'Export Table') {
                vscode.commands.executeCommand('keboola.showTable', { table: { id: tableId } });
            }
        });

    } catch (error) {
        console.error('[handleWatchTable] Error:', error);
        vscode.window.showErrorMessage(`Failed to watch table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function handleUnwatchTable(tableId: string, context: vscode.ExtensionContext): Promise<void> {
    try {
        const projectName = context.globalState.get<string>('keboola.projectName') || 'unknown';
        
        if (!downloadsStore.isWatched(projectName, tableId)) {
            vscode.window.showInformationMessage(`Table "${getTableDisplayName(tableId)}" is not being watched`);
            return;
        }

        const removed = await downloadsStore.removeDownload(projectName, tableId);
        
        if (removed) {
            vscode.window.showInformationMessage(`Table "${getTableDisplayName(tableId)}" removed from watch list`);
            // Refresh the project tree to update badge counts
            projectTreeProvider.refresh();
        } else {
            vscode.window.showErrorMessage(`Failed to remove table "${getTableDisplayName(tableId)}" from watch list`);
        }

    } catch (error) {
        console.error('[handleUnwatchTable] Error:', error);
        vscode.window.showErrorMessage(`Failed to unwatch table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function getTableDisplayName(tableId: string): string {
    const parts = tableId.split('.');
    return parts[parts.length - 1] || tableId;
}

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
} 