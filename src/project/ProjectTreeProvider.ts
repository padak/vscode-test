import * as vscode from 'vscode';
import { ProjectTreeItem } from './ProjectTreeItem';
import { KeboolaTreeProvider, TreeItem } from '../KeboolaTreeProvider';
import { WatchedTablesTreeProvider, WatchedTablesRootItem } from '../watch/WatchedTablesTreeProvider';

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectTreeItem: ProjectTreeItem | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private keboolaTreeProvider: KeboolaTreeProvider,
        private watchedTablesTreeProvider: WatchedTablesTreeProvider
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Root level - return the single project node
            const projectName = this.context.globalState.get<string>('keboola.projectName') || 'Unknown Project';
            const stackUrl = this.context.globalState.get<string>('keboola.apiUrl') || '';
            const watchedTablesCount = this.watchedTablesTreeProvider.getWatchedCount(projectName);
            
            this.projectTreeItem = new ProjectTreeItem(projectName, stackUrl, this.keboolaTreeProvider, watchedTablesCount);
            return [this.projectTreeItem];
        } 
        
        if (element instanceof ProjectTreeItem) {
            // Project node children - return Storage, Configurations, Jobs, and Watched Tables
            const keboolaChildren = await element.getChildren();
            
            // Add watched tables section if there are any watched tables
            const projectName = this.context.globalState.get<string>('keboola.projectName') || 'unknown';
            const watchedTablesRoot = this.watchedTablesTreeProvider.createWatchedTablesRoot(projectName);
            
            // Insert watched tables after the first child (status)
            if (keboolaChildren.length > 0) {
                keboolaChildren.splice(1, 0, watchedTablesRoot);
            } else {
                keboolaChildren.push(watchedTablesRoot);
            }
            
            return keboolaChildren;
        }

        if (element instanceof WatchedTablesRootItem) {
            // Watched tables root - delegate to WatchedTablesTreeProvider
            return await this.watchedTablesTreeProvider.getChildren(element);
        }

        // For other elements, delegate to the KeboolaTreeProvider
        // We need to cast to TreeItem type for compatibility
        return await this.keboolaTreeProvider.getChildren(element as TreeItem);
    }

    /**
     * Update the project name and refresh the tree
     */
    updateProjectName(projectName: string): void {
        this.context.globalState.update('keboola.projectName', projectName);
        this.refresh();
    }

    /**
     * Get the current project item for refresh commands
     */
    getProjectItem(): ProjectTreeItem | undefined {
        return this.projectTreeItem;
    }
} 