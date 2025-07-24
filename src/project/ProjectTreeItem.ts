import * as vscode from 'vscode';
import { KeboolaTreeProvider } from '../KeboolaTreeProvider';

export class ProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly projectName: string,
        public readonly stackUrl: string,
        private readonly keboolaTreeProvider: KeboolaTreeProvider
    ) {
        super(projectName, vscode.TreeItemCollapsibleState.Expanded);
        
        this.label = projectName ? `🛢  ${projectName}` : '🛢  Unknown Project';
        this.tooltip = `Keboola project (${stackUrl})`;
        this.contextValue = 'keboolaProject';
        
        // Add refresh command to the project node
        this.command = undefined;
    }

    /**
     * Get the children of the project node (Storage, Configurations, Jobs)
     */
    async getChildren(): Promise<vscode.TreeItem[]> {
        // Return the root nodes from the existing KeboolaTreeProvider
        // These are: Storage, Configurations, Jobs
        return await this.keboolaTreeProvider.getChildren();
    }

    iconPath = new vscode.ThemeIcon('database');
} 