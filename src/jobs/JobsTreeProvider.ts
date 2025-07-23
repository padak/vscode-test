import * as vscode from 'vscode';
import { JobsApi, JobsApiError, KeboolaJob } from './jobsApi';

export class JobsTreeProvider implements vscode.TreeDataProvider<JobTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JobTreeItem | undefined | null | void> = new vscode.EventEmitter<JobTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<JobTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private jobsCache: Map<string, KeboolaJob[]> = new Map();
    private loadedCounts: Map<string, number> = new Map();
    private jobsApi?: JobsApi;
    private readonly pageSize = 50;

    constructor() {}

    setJobsApi(api: JobsApi | undefined): void {
        this.jobsApi = api;
        this.refresh();
    }

    refresh(): void {
        this.jobsCache.clear();
        this.loadedCounts.clear();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JobTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: JobTreeItem): Promise<JobTreeItem[]> {
        if (!this.jobsApi) {
            return [];
        }

        if (!element) {
            // Root level - return job group categories
            return [
                new JobTreeItem(
                    'Running',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'job-group',
                    'running'
                ),
                new JobTreeItem(
                    'Failed (last 24h)',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'job-group',
                    'failed'
                ),
                new JobTreeItem(
                    'Finished (last 24h)',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'job-group',
                    'finished'
                ),
                new JobTreeItem(
                    'All (latest)',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'job-group',
                    'all'
                )
            ];
        }

        if (element.contextValue === 'job-group' && element.groupType) {
            return await this.getJobsForGroup(element.groupType);
        }

        if (element.contextValue === 'load-more' && element.groupType) {
            return await this.loadMoreJobs(element.groupType);
        }

        return [];
    }

    private async getJobsForGroup(groupType: string): Promise<JobTreeItem[]> {
        try {
            let jobs: KeboolaJob[] = [];
            const cacheKey = groupType;
            const currentlyLoaded = this.loadedCounts.get(cacheKey) || 0;

            // If we have cached jobs, return them
            if (this.jobsCache.has(cacheKey) && currentlyLoaded > 0) {
                jobs = this.jobsCache.get(cacheKey) || [];
            } else {
                // Load initial batch
                jobs = await this.loadJobsForGroup(groupType, this.pageSize);
                this.jobsCache.set(cacheKey, jobs);
                this.loadedCounts.set(cacheKey, jobs.length);
            }

            const items: JobTreeItem[] = [];

            // Add job items
            jobs.forEach(job => {
                const jobItem = this.createJobTreeItem(job);
                items.push(jobItem);
            });

            // Add "Load more..." item if we have a full page (suggesting there might be more)
            if (jobs.length >= this.pageSize && jobs.length === currentlyLoaded) {
                const loadMoreItem = new JobTreeItem(
                    'Load more...',
                    vscode.TreeItemCollapsibleState.None,
                    'load-more',
                    groupType
                );
                loadMoreItem.iconPath = new vscode.ThemeIcon('refresh');
                loadMoreItem.tooltip = 'Load more jobs';
                items.push(loadMoreItem);
            }

            return items;

        } catch (error) {
            console.error(`Failed to load jobs for group ${groupType}:`, error);
            
            if (error instanceof JobsApiError) {
                vscode.window.showErrorMessage(`Failed to load ${groupType} jobs: ${error.message}`);
            } else {
                vscode.window.showErrorMessage(`Failed to load ${groupType} jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            // Return error item
            const errorItem = new JobTreeItem(
                'Failed to load jobs',
                vscode.TreeItemCollapsibleState.None,
                'error'
            );
            errorItem.iconPath = new vscode.ThemeIcon('error');
            errorItem.tooltip = error instanceof Error ? error.message : 'Unknown error';
            return [errorItem];
        }
    }

    private async loadMoreJobs(groupType: string): Promise<JobTreeItem[]> {
        try {
            const currentlyLoaded = this.loadedCounts.get(groupType) || 0;
            const newJobs = await this.loadJobsForGroup(groupType, this.pageSize, currentlyLoaded);
            
            // Append to existing cache
            const existingJobs = this.jobsCache.get(groupType) || [];
            const allJobs = [...existingJobs, ...newJobs];
            
            this.jobsCache.set(groupType, allJobs);
            this.loadedCounts.set(groupType, allJobs.length);

            // Refresh the tree to show updated data
            this._onDidChangeTreeData.fire();
            
            return [];

        } catch (error) {
            console.error(`Failed to load more jobs for group ${groupType}:`, error);
            vscode.window.showErrorMessage(`Failed to load more jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }

    private async loadJobsForGroup(groupType: string, limit: number, offset: number = 0): Promise<KeboolaJob[]> {
        console.log(`[JobsTreeProvider] Loading jobs for group: ${groupType}, limit: ${limit}, offset: ${offset}`);
        
        if (!this.jobsApi) {
            console.log(`[JobsTreeProvider] No JobsApi available for group ${groupType}`);
            return [];
        }

        console.log(`[JobsTreeProvider] JobsApi available, processing group: ${groupType}`);
        
        switch (groupType) {
            case 'running':
                const runningParams = {
                    status: 'processing,waiting',
                    limit,
                    offset,
                    sort: 'createdTime',
                    order: 'desc' as const
                };
                console.log(`[JobsTreeProvider] Calling searchJobs for running with params:`, runningParams);
                return await this.jobsApi.searchJobs(runningParams);
            
            case 'failed':
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const failedParams = {
                    status: 'error',
                    since: yesterday.toISOString(),
                    limit,
                    offset,
                    sort: 'createdTime',
                    order: 'desc' as const
                };
                console.log(`[JobsTreeProvider] Calling searchJobs for failed with params:`, failedParams);
                return await this.jobsApi.searchJobs(failedParams);
            
            case 'finished':
                const yesterdayFinished = new Date();
                yesterdayFinished.setDate(yesterdayFinished.getDate() - 1);
                const finishedParams = {
                    status: 'success,warning',
                    since: yesterdayFinished.toISOString(),
                    limit,
                    offset,
                    sort: 'createdTime',
                    order: 'desc' as const
                };
                console.log(`[JobsTreeProvider] Calling searchJobs for finished with params:`, finishedParams);
                return await this.jobsApi.searchJobs(finishedParams);
            
            case 'all':
                const allParams = {
                    limit,
                    offset,
                    sort: 'createdTime',
                    order: 'desc' as const
                };
                console.log(`[JobsTreeProvider] Calling searchJobs for all with params:`, allParams);
                return await this.jobsApi.searchJobs(allParams);
            
            default:
                console.log(`[JobsTreeProvider] Unknown group type: ${groupType}`);
                return [];
        }
    }

    private createJobTreeItem(job: KeboolaJob): JobTreeItem {
        const configId = job.configurationId || job.configId || 'unknown';
        const createdTime = this.formatShortTimestamp(job.createdTime);
        
        const label = `${job.status} • ${job.componentId}/${configId} • ${createdTime}`;
        
        const jobItem = new JobTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'job'
        );

        jobItem.job = job;
        jobItem.iconPath = new vscode.ThemeIcon(this.jobsApi!.getStatusIcon(job.status));
        
        // Build detailed tooltip
        const tooltip = this.buildJobTooltip(job);
        jobItem.tooltip = tooltip;

        // Add description with duration or error info
        if (job.status === 'error' && job.error?.message) {
            jobItem.description = `Error: ${job.error.message.substring(0, 50)}${job.error.message.length > 50 ? '...' : ''}`;
        } else if (job.durationSeconds) {
            jobItem.description = `Duration: ${this.jobsApi!.formatDuration(job.durationSeconds)}`;
        } else if (job.startTime) {
            const startTime = new Date(job.startTime);
            const now = new Date();
            const runningSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            jobItem.description = `Running: ${this.jobsApi!.formatDuration(runningSeconds)}`;
        }

        return jobItem;
    }

    private buildJobTooltip(job: KeboolaJob): string {
        const lines = [
            `Job ID: ${job.id}`,
            `Status: ${job.status}`,
            `Component: ${job.componentId}`,
            `Configuration: ${job.configurationId || job.configId || 'N/A'}`,
            `Created: ${this.jobsApi!.formatTimestamp(job.createdTime)}`
        ];

        if (job.branchId) {
            lines.push(`Branch: ${job.branchId}`);
        }

        if (job.startTime) {
            lines.push(`Started: ${this.jobsApi!.formatTimestamp(job.startTime)}`);
        }

        if (job.endTime) {
            lines.push(`Ended: ${this.jobsApi!.formatTimestamp(job.endTime)}`);
        }

        if (job.durationSeconds) {
            lines.push(`Duration: ${this.jobsApi!.formatDuration(job.durationSeconds)}`);
        }

        if (job.createdBy?.name) {
            lines.push(`Created by: ${job.createdBy.name}`);
        }

        if (job.error?.message) {
            lines.push(`Error: ${job.error.message}`);
        }

        if (job.result?.message) {
            lines.push(`Result: ${job.result.message}`);
        }

        return lines.join('\n');
    }

    private formatShortTimestamp(timestamp: string): string {
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMinutes < 1) {
                return 'just now';
            } else if (diffMinutes < 60) {
                return `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else if (diffDays < 7) {
                return `${diffDays}d ago`;
            } else {
                return date.toLocaleDateString();
            }
        } catch {
            return timestamp;
        }
    }

    async getJobsForConfiguration(componentId: string, configurationId: string, branchId?: string): Promise<KeboolaJob[]> {
        if (!this.jobsApi) {
            return [];
        }

        try {
            return await this.jobsApi.getJobsForConfiguration(componentId, configurationId, branchId);
        } catch (error) {
            console.error('Failed to load jobs for configuration:', error);
            return [];
        }
    }
}

export class JobTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly groupType?: string
    ) {
        super(label, collapsibleState);
    }

    job?: KeboolaJob;
} 