import * as vscode from 'vscode';
import { DownloadsStore, DownloadRecord } from './DownloadsStore';

export class WatchedTableTreeItem extends vscode.TreeItem {
    constructor(
        public readonly record: DownloadRecord,
        public readonly tableId: string
    ) {
        super(tableId, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = this.createTooltip();
        this.contextValue = 'watchedTable';
        this.iconPath = new vscode.ThemeIcon('table');
        
        // Command to open table details (same as Storage tree)
        this.command = {
            command: 'keboola.showTable',
            title: 'Show Table Details',
            arguments: [{ table: { id: tableId } }]
        };
    }

    private createTooltip(): string {
        const limitText = this.record.limit === 0 ? 'unlimited' : this.record.limit.toLocaleString();
        const headersText = this.record.headers ? 'with headers' : 'without headers';
        
        return `📁 Path: ${this.record.localPath}\n📅 Last Import: ${this.record.lastImportDate}\n📊 Limit: ${limitText}\n📋 Headers: ${headersText}`;
    }
}

export class WatchedTablesRootItem extends vscode.TreeItem {
    constructor(public readonly projectId: string, private readonly watchedCount: number) {
        super('👁 Watched Tables', vscode.TreeItemCollapsibleState.Collapsed);
        
        this.contextValue = 'watchedTablesRoot';
        this.description = `${watchedCount} table${watchedCount !== 1 ? 's' : ''}`;
        this.tooltip = `${watchedCount} watched table${watchedCount !== 1 ? 's' : ''} for project ${projectId}`;
        this.iconPath = new vscode.ThemeIcon('eye');
    }
}

/**
 * Tree provider for displaying watched tables under project nodes
 */
export class WatchedTablesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private context: vscode.ExtensionContext,
        private downloadsStore: DownloadsStore
    ) {
        // Listen for changes in the downloads store
        this.downloadsStore.onDidChangeDownloads(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        // This provider only handles children for WatchedTablesRootItem
        if (element instanceof WatchedTablesRootItem) {
            return this.getWatchedTablesForProject(element.projectId);
        }

        return [];
    }

    /**
     * Get watched tables for a specific project
     */
    private getWatchedTablesForProject(projectId: string): WatchedTableTreeItem[] {
        const records = this.downloadsStore.getByProject(projectId);
        
        return records.map(record => new WatchedTableTreeItem(record, record.tableId));
    }

    /**
     * Create a root item for watched tables under a project
     */
    createWatchedTablesRoot(projectId: string): WatchedTablesRootItem {
        const watchedCount = this.downloadsStore.getWatchedCount(projectId);
        return new WatchedTablesRootItem(projectId, watchedCount);
    }

    /**
     * Get count of watched tables for a project (used for project badge)
     */
    getWatchedCount(projectId: string): number {
        return this.downloadsStore.getWatchedCount(projectId);
    }
} 