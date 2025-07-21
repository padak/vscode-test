import * as vscode from 'vscode';
import { KeboolaApi, KeboolaApiError, KeboolaBranch, KeboolaComponent, KeboolaConfiguration } from './keboolaApi';

export class ConfigurationsTreeProvider implements vscode.TreeDataProvider<ConfigurationTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigurationTreeItem | undefined | null | void> = new vscode.EventEmitter<ConfigurationTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigurationTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private branches: KeboolaBranch[] = [];
    private componentsCache: Map<string, KeboolaComponent[]> = new Map();
    private keboolaApi?: KeboolaApi;

    constructor() {}

    setKeboolaApi(api: KeboolaApi | undefined): void {
        this.keboolaApi = api;
        this.refresh();
    }

    refresh(): void {
        this.componentsCache.clear();
        this.loadBranches().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    private async loadBranches(): Promise<void> {
        this.branches = [];

        if (!this.keboolaApi) {
            return;
        }

        try {
            this.branches = await this.keboolaApi.listBranches();
        } catch (error) {
            console.error('Failed to load branches:', error);
            if (error instanceof KeboolaApiError) {
                vscode.window.showErrorMessage(`Failed to load branches: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Failed to load branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    getTreeItem(element: ConfigurationTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConfigurationTreeItem): Promise<ConfigurationTreeItem[]> {
        if (!element) {
            // Root level - return branches
            return this.branches.map(branch => {
                const displayName = branch.isDefault ? 'Main Branch' : branch.name;
                const branchItem = new ConfigurationTreeItem(
                    displayName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'branch'
                );
                branchItem.description = branch.description || '';
                branchItem.tooltip = `Branch: ${branch.name}\nCreated: ${branch.created}\nBy: ${branch.createdBy.name}`;
                branchItem.iconPath = new vscode.ThemeIcon(branch.isDefault ? 'star-full' : 'git-branch');
                branchItem.branch = branch;
                return branchItem;
            });
        }

        if (element.contextValue === 'branch' && element.branch) {
            // Show component categories for a branch
            const categories = [
                { id: 'extractors', name: 'Extractors', icon: 'cloud-download' },
                { id: 'writers', name: 'Writers', icon: 'cloud-upload' },
                { id: 'transformations', name: 'Transformations', icon: 'gear' },
                { id: 'sandboxes', name: 'Sandboxes', icon: 'terminal' },
                { id: 'dataapps', name: 'Data Apps', icon: 'rocket' },
                { id: 'flows', name: 'Flows', icon: 'workflow' }
            ];

            return categories.map(category => {
                const categoryItem = new ConfigurationTreeItem(
                    category.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'category'
                );
                categoryItem.iconPath = new vscode.ThemeIcon(category.icon);
                categoryItem.branch = element.branch;
                categoryItem.category = category.id;
                return categoryItem;
            });
        }

        if (element.contextValue === 'category' && element.branch && element.category) {
            // Load and show components for a category
            const components = await this.getComponentsForBranch(element.branch.id);
            const filteredComponents = components.filter(component => 
                this.getComponentCategory(component.type) === element.category
            );

            return filteredComponents.map(component => {
                const componentItem = new ConfigurationTreeItem(
                    component.name,
                    component.configurations.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    'component'
                );
                componentItem.description = component.configurations.length > 0 ? `${component.configurations.length} configs` : 'No configs';
                componentItem.tooltip = `Component: ${component.id}\n${component.description || 'No description'}`;
                componentItem.iconPath = component.ico32 ? vscode.Uri.parse(component.ico32) : new vscode.ThemeIcon('package');
                componentItem.branch = element.branch;
                componentItem.component = component;
                return componentItem;
            });
        }

        if (element.contextValue === 'component' && element.component) {
            // Show configurations for a component
            return element.component.configurations
                .filter(config => !config.isDeleted)
                .map(config => {
                    const configItem = new ConfigurationTreeItem(
                        config.name,
                        vscode.TreeItemCollapsibleState.None,
                        'configuration'
                    );
                    configItem.description = `v${config.version}`;
                    configItem.tooltip = `Configuration: ${config.id}\n${config.description || 'No description'}\nVersion: ${config.version}`;
                    configItem.iconPath = new vscode.ThemeIcon('file-code');
                    configItem.branch = element.branch;
                    configItem.component = element.component;
                    configItem.configuration = config;
                    return configItem;
                });
        }

        return [];
    }

    private async getComponentsForBranch(branchId: string): Promise<KeboolaComponent[]> {
        if (!this.keboolaApi) {
            return [];
        }

        // Check cache first
        if (this.componentsCache.has(branchId)) {
            return this.componentsCache.get(branchId)!;
        }

        try {
            const components = await this.keboolaApi.listComponents(branchId);
            this.componentsCache.set(branchId, components);
            return components;
        } catch (error) {
            console.error(`Failed to load components for branch ${branchId}:`, error);
            if (error instanceof KeboolaApiError) {
                vscode.window.showErrorMessage(`Failed to load components: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Failed to load components: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return [];
        }
    }

    private getComponentCategory(type: string): string {
        switch (type) {
            case 'extractor':
                return 'extractors';
            case 'writer':
                return 'writers';
            case 'transformation':
                return 'transformations';
            case 'application':
                return 'dataapps';
            default:
                return 'flows';
        }
    }

    // Public method to get branch by ID
    getBranchById(branchId: string): KeboolaBranch | undefined {
        return this.branches.find(branch => branch.id === branchId);
    }
}

export class ConfigurationTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
    }

    branch?: KeboolaBranch;
    category?: string;
    component?: KeboolaComponent;
    configuration?: KeboolaConfiguration;
}
