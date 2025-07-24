import * as vscode from 'vscode';
import { ProjectTreeItem } from './ProjectTreeItem';
import { KeboolaTreeProvider, TreeItem } from '../KeboolaTreeProvider';

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectTreeItem: ProjectTreeItem | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private keboolaTreeProvider: KeboolaTreeProvider
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
            
            this.projectTreeItem = new ProjectTreeItem(projectName, stackUrl, this.keboolaTreeProvider);
            return [this.projectTreeItem];
        } 
        
        if (element instanceof ProjectTreeItem) {
            // Project node children - return Storage, Configurations, Jobs
            return await element.getChildren();
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