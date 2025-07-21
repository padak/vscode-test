import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError } from './keboolaApi';
import { KeboolaTreeProvider, TreeItem } from './KeboolaTreeProvider';
import { TableDetailPanel } from './TableDetailPanel';
import { BucketDetailPanel } from './BucketDetailPanel';
import { getStoredConfig, storeConfig, getCurrentRowLimit, setRowLimit } from './settings';

let keboolaApi: KeboolaApi | undefined;
let treeProvider: KeboolaTreeProvider;
let treeView: vscode.TreeView<TreeItem>;

export function activate(context: vscode.ExtensionContext) {
    console.log('Keboola Storage API Explorer is now active!');

    // Initialize tree provider
    treeProvider = new KeboolaTreeProvider();
    
    // Create and register the tree view with the activity bar container
    treeView = vscode.window.createTreeView('keboolaExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    // Add tree view to context subscriptions
    context.subscriptions.push(treeView);

    // Load stored configuration
    const storedConfig = getStoredConfig();
    if (storedConfig.apiUrl && storedConfig.token) {
        keboolaApi = new KeboolaApi(storedConfig);
        treeProvider.setKeboolaApi(keboolaApi);
    }

    // Register commands
    registerCommands(context);

    console.log('All commands registered successfully');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Configure connection
    const configureCmd = vscode.commands.registerCommand('keboola.configure', async () => {
        await configureKeboolaConnection();
    });

    // Refresh tree
    const refreshCmd = vscode.commands.registerCommand('keboola.refresh', () => {
        treeProvider.refresh();
    });

    // Set row limit
    const setRowLimitCmd = vscode.commands.registerCommand('keboola.setRowLimit', async () => {
        await setRowLimitCommand();
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
        configureCmd,
        refreshCmd,
        setRowLimitCmd,
        showTableCmd,
        showBucketCmd
    );
}

async function configureKeboolaConnection() {
    try {
        // Show quick pick for connection type
        const connectionType = await vscode.window.showQuickPick([
            'Configure API Connection'
        ], {
            placeHolder: 'Choose connection type'
        });

        if (!connectionType) {
            return;
        }

        // Get API URL
        const apiUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Keboola API URL',
            placeHolder: 'https://connection.keboola.com',
            value: getStoredConfig().apiUrl || '',
            validateInput: (value: string) => {
                if (!value) {
                    return 'API URL is required';
                }
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    return 'Please enter a valid URL starting with http:// or https://';
                }
                return null;
            }
        });

        if (!apiUrl) {
            return;
        }

        // Get API token
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your Keboola Storage API token',
            placeHolder: 'Your API token...',
            password: true,
            validateInput: (value: string) => {
                if (!value) {
                    return 'API token is required';
                }
                if (value.length < 10) {
                    return 'Token seems too short. Please check your token.';
                }
                return null;
            }
        });

        if (!token) {
            return;
        }

        // Test the connection
        const testApi = new KeboolaApi({ apiUrl, token });
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Testing Keboola connection...",
            cancellable: false
        }, async () => {
            const isConnected = await testApi.testConnection();
            
            if (!isConnected) {
                throw new Error('Failed to connect to Keboola API. Please check your credentials.');
            }
        });

        // Save configuration
        storeConfig({ apiUrl, token });
        keboolaApi = testApi;
        treeProvider.setKeboolaApi(keboolaApi);

        vscode.window.showInformationMessage('✅ Keboola connection configured successfully!');

    } catch (error) {
        console.error('Configuration failed:', error);
        if (error instanceof KeboolaApiError) {
            vscode.window.showErrorMessage(`Configuration failed: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

async function setRowLimitCommand() {
    const currentLimit = getCurrentRowLimit();
    
    const input = await vscode.window.showInputBox({
        prompt: 'Enter row limit for data preview and export',
        placeHolder: 'e.g., 1000, 5000, 50000',
        value: currentLimit.toString(),
        validateInput: (value: string) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a positive number';
            }
            if (num > 1000000) {
                return 'Row limit cannot exceed 1,000,000';
            }
            return null;
        }
    });

    if (input) {
        const newLimit = parseInt(input, 10);
        setRowLimit(newLimit);
        vscode.window.showInformationMessage(`Row limit set to ${newLimit.toLocaleString()}`);
    }
}

async function showTableDetails(tableId: string, context: vscode.ExtensionContext) {
    try {
        if (!keboolaApi) {
            vscode.window.showErrorMessage('No API connection available. Please configure your Keboola connection.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading table details...",
            cancellable: false
        }, async () => {
            const tableDetail = await keboolaApi!.getTableDetail(tableId);
            const rowLimit = getCurrentRowLimit();

            TableDetailPanel.createOrShow(
                tableDetail,
                context.extensionUri,
                keboolaApi,
                rowLimit,
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
        if (!keboolaApi) {
            vscode.window.showErrorMessage('No API connection available. Please configure your Keboola connection.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading bucket details...",
            cancellable: false
        }, async () => {
            const bucketDetail = await keboolaApi!.getBucketDetail(bucketId);
            const rowLimit = getCurrentRowLimit();

            BucketDetailPanel.createOrShow(
                bucketDetail,
                context.extensionUri,
                keboolaApi,
                rowLimit,
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