import * as vscode from 'vscode';
import { KeboolaTable, KeboolaApi, KeboolaApiError, KeboolaBranch, KeboolaComponent, KeboolaConfiguration } from './keboolaApi';
import { ConfigurationsTreeProvider, ConfigurationTreeItem } from './ConfigurationsTreeProvider';
import { JobsTreeProvider, JobTreeItem } from './jobs/JobsTreeProvider';
import { JobsApi } from './jobs/jobsApi';
// import { getStoredConfig } from './settings'; // REMOVED: Using inconsistent storage

export class KeboolaTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tables: KeboolaTable[] = [];
    private isApiConnected: boolean = false;
    private keboolaApi?: KeboolaApi;
    private jobsApi?: JobsApi;
    private configurationsProvider: ConfigurationsTreeProvider;
    private jobsProvider: JobsTreeProvider;

    constructor() {
        this.configurationsProvider = new ConfigurationsTreeProvider();
        this.jobsProvider = new JobsTreeProvider();
    }

    setKeboolaApi(api: KeboolaApi | undefined, config?: {apiUrl: string, token: string}): void {
        this.keboolaApi = api;
        this.configurationsProvider.setKeboolaApi(api);
        
        // Initialize Jobs API if storage API is available
        if (api && config) {
            console.log(`[KeboolaTreeProvider] Initializing JobsApi with config:`, {
                apiUrl: config.apiUrl,
                tokenLength: config.token ? config.token.length : 0,
                tokenPrefix: config.token ? config.token.substring(0, 8) + '...' : 'NONE'
            });
            
            if (config.apiUrl && config.token) {
                // Extract host from API URL (remove protocol and path)
                const hostMatch = config.apiUrl.match(/https?:\/\/([^\/]+)/);
                console.log(`[KeboolaTreeProvider] Host extraction:`, {
                    originalUrl: config.apiUrl,
                    hostMatch: hostMatch,
                    extractedHost: hostMatch ? hostMatch[1] : 'NO_MATCH'
                });
                
                if (hostMatch) {
                    this.jobsApi = new JobsApi(hostMatch[1], config.token);
                    this.jobsProvider.setJobsApi(this.jobsApi);
                    console.log(`[KeboolaTreeProvider] JobsApi initialized successfully`);
                } else {
                    console.log(`[KeboolaTreeProvider] Failed to extract host from API URL`);
                }
            } else {
                console.log(`[KeboolaTreeProvider] Missing API URL or token, JobsApi not initialized`);
            }
        } else {
            console.log(`[KeboolaTreeProvider] No Storage API or config available, JobsApi not initialized`);
            this.jobsApi = undefined;
            this.jobsProvider.setJobsApi(undefined);
        }
        
        this.refresh();
    }

    refresh(): void {
        this.loadData().then(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    refreshConfigurations(): void {
        this.configurationsProvider.refresh();
        this._onDidChangeTreeData.fire();
    }

    refreshJobs(): void {
        this.jobsProvider.refresh();
        this._onDidChangeTreeData.fire();
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

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Ensure data is loaded first
            if (this.keboolaApi && this.tables.length === 0) {
                await this.loadData();
            }
            
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
            
            if (this.isApiConnected) {
                // Always add Storage root node when connected (even if no tables)
                const storageItem = new TreeItem(
                    'Storage',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'storage'
                );
                storageItem.description = `${this.tables.length} tables`;
                storageItem.tooltip = 'Keboola Storage tables and buckets';
                storageItem.iconPath = new vscode.ThemeIcon('database');
                items.push(storageItem);

                // Add Configurations root node
                const configurationsItem = new TreeItem(
                    'Configurations',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'configurations'
                );
                configurationsItem.description = 'Manage project configurations';
                configurationsItem.tooltip = 'Project configurations organized by branches and components';
                configurationsItem.iconPath = new vscode.ThemeIcon('gear');
                items.push(configurationsItem);

                // Add Jobs root node
                const jobsItem = new TreeItem(
                    'Jobs',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'jobs'
                );
                jobsItem.description = 'Monitor job execution';
                jobsItem.tooltip = 'Job monitoring with real-time status and execution history';
                jobsItem.iconPath = new vscode.ThemeIcon('pulse');
                items.push(jobsItem);
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

        } else if (element.contextValue === 'configurations') {
            // Show configurations tree
            const configurationChildren = await this.configurationsProvider.getChildren();
            
            // Convert ConfigurationTreeItem to TreeItem
            return Promise.resolve(configurationChildren.map(configItem => {
                const treeItem = new TreeItem(
                    configItem.label,
                    configItem.collapsibleState,
                    configItem.contextValue
                );
                treeItem.description = configItem.description;
                treeItem.tooltip = configItem.tooltip;
                treeItem.iconPath = configItem.iconPath;
                
                // Copy configuration-specific properties
                treeItem.branch = configItem.branch;
                treeItem.category = configItem.category;
                treeItem.component = configItem.component;
                treeItem.configuration = configItem.configuration;
                
                return treeItem;
            }));
            
        } else if (element.contextValue === 'jobs') {
            // Show jobs tree
            const jobChildren = await this.jobsProvider.getChildren();
            
            // Convert JobTreeItem to TreeItem
            return Promise.resolve(jobChildren.map(jobItem => {
                const treeItem = new TreeItem(
                    jobItem.label,
                    jobItem.collapsibleState,
                    jobItem.contextValue
                );
                treeItem.description = jobItem.description;
                treeItem.tooltip = jobItem.tooltip;
                treeItem.iconPath = jobItem.iconPath;
                
                // Copy job-specific properties
                treeItem.job = jobItem.job;
                treeItem.groupType = jobItem.groupType;
                
                return treeItem;
            }));
            
        } else if (['branch', 'category', 'component'].includes(element.contextValue || '')) {
            // Delegate configuration tree logic to ConfigurationsTreeProvider
            const configurationTreeItem = this.convertToConfigurationTreeItem(element);
            const configurationChildren = await this.configurationsProvider.getChildren(configurationTreeItem);
            
            // Convert back to TreeItem
            return Promise.resolve(configurationChildren.map(configItem => {
                const treeItem = new TreeItem(
                    configItem.label,
                    configItem.collapsibleState,
                    configItem.contextValue
                );
                treeItem.description = configItem.description;
                treeItem.tooltip = configItem.tooltip;
                treeItem.iconPath = configItem.iconPath;
                
                // Copy configuration-specific properties
                treeItem.branch = configItem.branch;
                treeItem.category = configItem.category;
                treeItem.component = configItem.component;
                treeItem.configuration = configItem.configuration;
                
                return treeItem;
            }));
            
        } else if (['job-group', 'load-more'].includes(element.contextValue || '')) {
            // Delegate jobs tree logic to JobsTreeProvider
            const jobTreeItem = this.convertToJobTreeItem(element);
            const jobChildren = await this.jobsProvider.getChildren(jobTreeItem);
            
            // Convert back to TreeItem
            return Promise.resolve(jobChildren.map(jobItem => {
                const treeItem = new TreeItem(
                    jobItem.label,
                    jobItem.collapsibleState,
                    jobItem.contextValue
                );
                treeItem.description = jobItem.description;
                treeItem.tooltip = jobItem.tooltip;
                treeItem.iconPath = jobItem.iconPath;
                
                // Copy job-specific properties
                treeItem.job = jobItem.job;
                treeItem.groupType = jobItem.groupType;
                
                return treeItem;
            }));
            
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

    private convertToConfigurationTreeItem(element: TreeItem): ConfigurationTreeItem {
        const configItem = new ConfigurationTreeItem(
            element.label,
            element.collapsibleState,
            element.contextValue || ''
        );
        configItem.description = element.description;
        configItem.tooltip = element.tooltip;
        configItem.iconPath = element.iconPath;
        configItem.branch = element.branch;
        configItem.category = element.category;
        configItem.component = element.component;
        configItem.configuration = element.configuration;
        return configItem;
    }

    private convertToJobTreeItem(element: TreeItem): JobTreeItem {
        const jobItem = new JobTreeItem(
            element.label,
            element.collapsibleState,
            element.contextValue || '',
            element.groupType
        );
        jobItem.description = element.description;
        jobItem.tooltip = element.tooltip;
        jobItem.iconPath = element.iconPath;
        jobItem.job = element.job;
        return jobItem;
    }

    // Public method to get branch by ID (used by commands)
    getBranchById(branchId: string): KeboolaBranch | undefined {
        return this.configurationsProvider.getBranchById(branchId);
    }

    // Public method to get jobs for configuration (used by configuration detail panel)
    async getJobsForConfiguration(componentId: string, configurationId: string, branchId?: string): Promise<any[]> {
        return await this.jobsProvider.getJobsForConfiguration(componentId, configurationId, branchId);
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
    
    // Configuration-related properties
    branch?: KeboolaBranch;
    category?: string;
    component?: KeboolaComponent;
    configuration?: KeboolaConfiguration;
    
    // Jobs-related properties
    job?: any; // KeboolaJob type from jobs module
    groupType?: string;
} 