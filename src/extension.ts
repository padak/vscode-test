import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';
import { KeboolaTreeProvider, TreeItem } from './KeboolaTreeProvider';
import { TableDetailPanel } from './TableDetailPanel';
import { BucketDetailPanel } from './BucketDetailPanel';
import { StageDetailPanel } from './StageDetailPanel';
import { SettingsPanel } from './SettingsPanel';
import { ConfigurationsPanel } from './ConfigurationsPanel';
import { JobDetailPanel } from './jobs/JobDetailPanel';
import { JobsApi } from './jobs/jobsApi';

let keboolaApi: KeboolaApi | undefined;
let treeProvider: KeboolaTreeProvider;
let treeView: vscode.TreeView<TreeItem>;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    	console.log('Keboola Data Engineering Booster is now active!');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Keboola Storage Explorer');
    context.subscriptions.push(outputChannel);

    // Initialize tree provider
    treeProvider = new KeboolaTreeProvider();
    
    // Create and register the tree view with the activity bar container
    treeView = vscode.window.createTreeView('keboolaExplorer', {
        treeDataProvider: treeProvider,
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
        treeProvider.setKeboolaApi(keboolaApi, {
            apiUrl: settings.apiUrl,
            token: settings.token
        });
    }
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
        treeProvider.refreshConfigurations();
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
        treeProvider.refreshJobs();
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
        showJobsForConfigCmd
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
                treeProvider
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
                treeProvider
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

        const jobs = await treeProvider.getJobsForConfiguration(componentId, configurationId, branchId);

        if (jobs.length === 0) {
            vscode.window.showInformationMessage(`No jobs found for configuration ${componentId}/${configurationId}`);
            return;
        }

        // Show a quick pick with recent jobs
        const jobItems = jobs.map(job => ({
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
}

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
} 