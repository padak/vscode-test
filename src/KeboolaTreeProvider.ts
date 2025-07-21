import * as vscode from 'vscode';
import { KeboolaTable, KeboolaApi, KeboolaApiError } from './keboolaApi';

export class KeboolaTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tables: KeboolaTable[] = [];
    private isApiConnected: boolean = false;
    private keboolaApi?: KeboolaApi;

    constructor() {}

    setKeboolaApi(api: KeboolaApi | undefined): void {
        this.keboolaApi = api;
        this.refresh();
    }

    refresh(): void {
        this.loadData().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    private async loadData(): Promise<void> {
        this.tables = [];
        this.isApiConnected = false;

        if (!this.keboolaApi) {
            // No API configured
            return;
        }

        try {
            // Test connection first
            const connectionResult = await this.keboolaApi.testConnection();
            this.isApiConnected = connectionResult.success;
            
            if (this.isApiConnected) {
                // Load real data from Keboola API
                this.tables = await this.keboolaApi.listTables();
            } else {
                vscode.window.showErrorMessage('Failed to connect to Keboola API. Please check your credentials in Settings.');
            }
        } catch (error) {
            console.error('Failed to load Keboola data:', error);
            
            // Show error message to user
            if (error instanceof KeboolaApiError) {
                vscode.window.showErrorMessage(`Keboola API Error: ${error.message}. Please check your settings.`);
            } else {
                vscode.window.showErrorMessage(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your settings.`);
            }
        }
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level: show Storage node and connection status
            const items: TreeItem[] = [];
            
            // Add connection status
            const statusItem = new TreeItem(
                this.isApiConnected ? '✅ Connected to Keboola API' : '❌ No API connection',
                vscode.TreeItemCollapsibleState.None,
                'status'
            );
            statusItem.description = this.isApiConnected ? 'API connected' : 'Configure in Settings';
            statusItem.iconPath = new vscode.ThemeIcon(this.isApiConnected ? 'check' : 'error');
            items.push(statusItem);
            
            if (this.isApiConnected && this.tables.length > 0) {
                // Add Storage root node
                const storageItem = new TreeItem(
                    'Storage',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'storage'
                );
                storageItem.description = `${this.tables.length} tables`;
                storageItem.tooltip = 'Keboola Storage tables and buckets';
                storageItem.iconPath = new vscode.ThemeIcon('database');
                items.push(storageItem);
            }
            
            return Promise.resolve(items);
            
        } else if (element.contextValue === 'storage') {
            // Show stages under Storage node
            const stages = this.getUniqueStages();
            const stageItems = stages.map(stage => {
                const stageItem = new TreeItem(
                    stage === 'in' ? 'Input (in)' : stage === 'out' ? 'Output (out)' : `${stage.toUpperCase()}`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'stage'
                );
                stageItem.description = `${this.getTablesInStage(stage).length} tables`;
                stageItem.iconPath = new vscode.ThemeIcon(stage === 'in' ? 'arrow-down' : stage === 'out' ? 'arrow-up' : 'folder');
                stageItem.stage = stage;
                stageItem.tooltip = `${stage.toUpperCase()} stage - ${this.getTablesInStage(stage).length} tables`;
                return stageItem;
            });
            
            return Promise.resolve(stageItems);
            
        } else if (element.contextValue === 'stage' && element.stage) {
            // Show buckets in the stage
            const buckets = this.getBucketsInStage(element.stage);
            const bucketItems = buckets.map(bucket => {
                const tablesInBucket = this.getTablesInBucket(bucket.id);
                const bucketItem = new TreeItem(
                    bucket.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'bucket'
                );
                bucketItem.description = `${tablesInBucket.length} tables`;
                bucketItem.tooltip = `Bucket: ${bucket.id}\n${tablesInBucket.length} tables`;
                bucketItem.iconPath = new vscode.ThemeIcon('folder-opened');
                bucketItem.bucket = bucket;
                return bucketItem;
            });
            
            return Promise.resolve(bucketItems);
            
        } else if (element.contextValue === 'bucket' && element.bucket) {
            // Show tables in the bucket
            const tablesInBucket = this.getTablesInBucket(element.bucket.id);
            const tableItems = tablesInBucket.map(table => {
                const tableItem = new TreeItem(
                    table.displayName,
                    vscode.TreeItemCollapsibleState.None,
                    'table'
                );
                tableItem.description = `${table.rowsCount.toLocaleString()} rows`;
                tableItem.tooltip = `Table: ${table.id}\nColumns: ${table.columns.join(', ')}\nRows: ${table.rowsCount.toLocaleString()}`;
                tableItem.iconPath = new vscode.ThemeIcon('table');
                tableItem.table = table;
                return tableItem;
            });
            
            return Promise.resolve(tableItems);
        }
        
        return Promise.resolve([]);
    }

    private getUniqueStages(): string[] {
        const stages = new Set<string>();
        this.tables.forEach(table => {
            stages.add(table.bucket.stage);
        });
        return Array.from(stages).sort();
    }

    private getTablesInStage(stage: string): KeboolaTable[] {
        return this.tables.filter(table => table.bucket.stage === stage);
    }

    private getBucketsInStage(stage: string): Array<{ id: string; name: string }> {
        const buckets = new Map<string, { id: string; name: string }>();
        
        this.tables
            .filter(table => table.bucket.stage === stage)
            .forEach(table => {
                if (!buckets.has(table.bucket.id)) {
                    buckets.set(table.bucket.id, {
                        id: table.bucket.id,
                        name: table.bucket.name
                    });
                }
            });
        
        return Array.from(buckets.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    private getTablesInBucket(bucketId: string): KeboolaTable[] {
        return this.tables
            .filter(table => table.bucket.id === bucketId)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    // Public method to get table by ID (used by commands)
    getTableById(tableId: string): KeboolaTable | undefined {
        return this.tables.find(table => table.id === tableId);
    }
}

export class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
    }

    stage?: string;
    bucket?: { id: string; name: string };
    table?: KeboolaTable;
} 