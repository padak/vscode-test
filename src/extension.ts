import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';
import { KeboolaTreeProvider, TreeItem } from './KeboolaTreeProvider';
import { TableDetailPanel } from './TableDetailPanel';
import { BucketDetailPanel } from './BucketDetailPanel';
import { SettingsPanel } from './SettingsPanel';

let keboolaApi: KeboolaApi | undefined;
let treeProvider: KeboolaTreeProvider;
let treeView: vscode.TreeView<TreeItem>;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('Keboola Storage API Explorer is now active!');

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
        exportRowLimit: context.globalState.get<number>('keboola.exportRowLimit') || 2000
    };
}

function initializeFromSettings(context: vscode.ExtensionContext) {
    const settings = getSettingsFromContext(context);
    
    if (settings.apiUrl && settings.token) {
        keboolaApi = new KeboolaApi({ 
            apiUrl: settings.apiUrl, 
            token: settings.token 
        });
        treeProvider.setKeboolaApi(keboolaApi);
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
        treeProvider.refresh();
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

    // Add all commands to subscriptions
    context.subscriptions.push(
        settingsCmd,
        configureCmd,
        refreshCmd,
        setRowLimitCmd,
        showTableCmd,
        showBucketCmd
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

export function deactivate() {
    console.log('Keboola Storage API Explorer is now deactivated');
}

export function getOutputChannel(): vscode.OutputChannel {
    return outputChannel;
} 