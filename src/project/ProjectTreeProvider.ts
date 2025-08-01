import * as vscode from 'vscode';
import { ProjectTreeItem } from './ProjectTreeItem';
import { KeboolaTreeProvider, TreeItem } from '../KeboolaTreeProvider';
import { WatchedTablesTreeProvider, WatchedTablesRootItem } from '../watch/WatchedTablesTreeProvider';
import { MultiProjectApiManager } from '../MultiProjectApiManager';
import { MultiProjectTreeItem, ProjectSectionItem } from './MultiProjectTreeItem';

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectTreeItem: ProjectTreeItem | undefined;
    private apiStatusItem: vscode.TreeItem | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private keboolaTreeProvider: KeboolaTreeProvider,
        private watchedTablesTreeProvider: WatchedTablesTreeProvider,
        private multiProjectApiManager?: MultiProjectApiManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Root level - return API Status and all projects
            const items: vscode.TreeItem[] = [];
            
            // Add API Status as the first item
            const isApiConnected = this.keboolaTreeProvider.getApiConnectionStatus();
            this.apiStatusItem = new vscode.TreeItem(
                isApiConnected ? '✅ Connected to Keboola API' : '❌ No API connection',
                vscode.TreeItemCollapsibleState.None
            );
            this.apiStatusItem.contextValue = 'api-status';
            this.apiStatusItem.description = isApiConnected ? 'API connected' : 'Configure in Settings';
            this.apiStatusItem.iconPath = new vscode.ThemeIcon(isApiConnected ? 'check' : 'error');
            items.push(this.apiStatusItem);
            
            // GET ALL PROJECTS and display each
            if (this.multiProjectApiManager) {
                try {
                    const projects = await this.multiProjectApiManager.getAvailableProjects();
                    
                    for (const project of projects) {
                        const projectNode = new MultiProjectTreeItem(
                            project.name, 
                            project.id,
                            project.stackUrl,
                            project
                        );
                        items.push(projectNode);
                    }
                } catch (error) {
                    console.log('Multi-project not available, falling back to single project mode:', error);
                    
                    // Fallback to single project mode for backward compatibility
                    let projectName = this.context.globalState.get<string>('keboola.projectName') || 'Unknown Project';
                    let stackUrl = this.context.globalState.get<string>('keboola.apiUrl') || '';
                    const watchedTablesCount = this.watchedTablesTreeProvider.getWatchedCount(projectName);
                    
                    this.projectTreeItem = new ProjectTreeItem(projectName, stackUrl, this.keboolaTreeProvider, watchedTablesCount);
                    items.push(this.projectTreeItem);
                }
            } else {
                // Fallback to single project mode if no MultiProjectApiManager
                let projectName = this.context.globalState.get<string>('keboola.projectName') || 'Unknown Project';
                let stackUrl = this.context.globalState.get<string>('keboola.apiUrl') || '';
                const watchedTablesCount = this.watchedTablesTreeProvider.getWatchedCount(projectName);
                
                this.projectTreeItem = new ProjectTreeItem(projectName, stackUrl, this.keboolaTreeProvider, watchedTablesCount);
                items.push(this.projectTreeItem);
            }
            
            return items;
        }
        
        if (element.contextValue === 'api-status') {
            // API Status has no children
            return [];
        }
        
        // Handle individual project expansion
        if (element instanceof MultiProjectTreeItem) {
            return this.getProjectChildren(element.project);
        }
        
        // Handle project section expansion (Storage, Configurations, Jobs)
        if (element instanceof ProjectSectionItem) {
            return this.getProjectSectionChildren(element);
        }
        
        // Backward compatibility: Handle legacy ProjectTreeItem
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
     * Get children for a specific project (Storage, Configurations, Jobs)
     */
    private async getProjectChildren(project: any): Promise<vscode.TreeItem[]> {
        // Create Storage, Configurations, Jobs nodes for THIS project
        const api = await this.multiProjectApiManager?.getApiForProject(project.id);
        if (!api) {
            return [];
        }
        
        return [
            new ProjectSectionItem('Storage', 'storage', project.id),
            new ProjectSectionItem('Configurations', 'configurations', project.id), 
            new ProjectSectionItem('Jobs', 'jobs', project.id)
        ];
    }

    /**
     * Get children for a specific project section (Storage/Configurations/Jobs content)
     */
    private async getProjectSectionChildren(sectionItem: ProjectSectionItem): Promise<vscode.TreeItem[]> {
        const api = await this.multiProjectApiManager?.getApiForProject(sectionItem.projectId);
        if (!api) {
            return [];
        }

        const projects = await this.multiProjectApiManager?.getAvailableProjects();
        const project = projects?.find(p => p.id === sectionItem.projectId);
        if (!project) {
            return [];
        }

        // Set the project context for the data providers
        this.keboolaTreeProvider.setKeboolaApi(api, { 
            apiUrl: project.stackUrl,
            token: await this.context.secrets.get(project.tokenSecretKey) || ''
        }, sectionItem.projectId);

        switch (sectionItem.sectionType) {
            case 'storage':
                // Get storage data (buckets/tables) for this specific project
                return await this.keboolaTreeProvider.getChildren();
                
            case 'configurations':
                // Get configurations data for this specific project
                // Find configurations section from root children
                const allChildren = await this.keboolaTreeProvider.getChildren();
                const configsItem = allChildren.find(child => child.contextValue === 'configurations');
                if (configsItem) {
                    return await this.keboolaTreeProvider.getChildren(configsItem as TreeItem);
                }
                return [];
                
            case 'jobs':
                // Get jobs data for this specific project  
                // Find jobs section from root children
                const allJobChildren = await this.keboolaTreeProvider.getChildren();
                const jobsItem = allJobChildren.find(child => child.contextValue === 'jobs');
                if (jobsItem) {
                    return await this.keboolaTreeProvider.getChildren(jobsItem as TreeItem);
                }
                return [];
                
            default:
                return [];
        }
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

    /**
     * Get the API status item for refresh commands
     */
    getApiStatusItem(): vscode.TreeItem | undefined {
        return this.apiStatusItem;
    }
} 