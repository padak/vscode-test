import fetch from 'node-fetch';

export interface KeboolaJob {
    id: string;
    status: 'created' | 'waiting' | 'processing' | 'success' | 'error' | 'warning' | 'terminating' | 'cancelled' | 'terminated';
    componentId: string;
    configId?: string;
    configurationId?: string;
    branchId?: string;
    projectId: string;
    createdTime: string;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
    runId?: string;
    tag?: string;
    result?: {
        message?: string;
        configVersion?: string;
    };
    error?: {
        message?: string;
        exceptionId?: string;
    };
    createdBy?: {
        id: string;
        name: string;
        email: string;
    };
    token?: {
        id: string;
        name: string;
        description?: string;
    };
    url?: string;
    logs?: Array<{
        id: string;
        level: string;
        message: string;
        time: string;
    }>;
}

export interface KeboolaJobDetail extends KeboolaJob {
    parameters?: any;
    usage?: Array<{
        metric: string;
        value: number;
    }>;
    metrics?: {
        inBytes?: number;
        outBytes?: number;
        inBytesCompressed?: number;
        outBytesCompressed?: number;
    };
}

export interface JobsSearchParams {
    componentId?: string;
    configurationId?: string;
    branchId?: string;
    status?: string;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}

export class JobsApiError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public response?: any
    ) {
        super(message);
        this.name = 'JobsApiError';
    }
}

export class JobsApi {
    private baseUrl: string;
    private token: string;

    constructor(connectionHost: string, token: string) {
        // Convert connection host to queue host
        // Example: connection.keboola.com -> queue.keboola.com
        this.baseUrl = connectionHost.replace('connection.', 'queue.');
        if (!this.baseUrl.startsWith('https://')) {
            this.baseUrl = `https://${this.baseUrl}`;
        }
        this.token = token;
        
        // Debug logging
        const maskedToken = token ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}` : 'NONE';
        console.log(`[JobsApi] Initialized with:`);
        console.log(`[JobsApi]   Original host: ${connectionHost}`);
        console.log(`[JobsApi]   Base URL: ${this.baseUrl}`);
        console.log(`[JobsApi]   Token: ${maskedToken}`);
    }

    private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        
        const requestOptions = {
            method: 'GET',
            headers: {
                'X-StorageApi-Token': this.token,
                'Content-Type': 'application/json',
                'User-Agent': 'Keboola-VSCode-Extension/3.1.2',
                ...options.headers
            },
            ...options
        };

        // Debug logging - mask token for security
        const maskedToken = this.token ? `${this.token.substring(0, 8)}...${this.token.substring(this.token.length - 8)}` : 'NONE';
        console.log(`[JobsApi] Making request:`);
        console.log(`[JobsApi]   URL: ${url}`);
        console.log(`[JobsApi]   Method: ${requestOptions.method}`);
        console.log(`[JobsApi]   Headers:`, {
            ...requestOptions.headers,
            'X-StorageApi-Token': maskedToken
        });

        try {
            const response = await fetch(url, requestOptions);
            
            console.log(`[JobsApi] Response received:`);
            console.log(`[JobsApi]   Status: ${response.status} ${response.statusText}`);
            console.log(`[JobsApi]   Headers:`, Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log(`[JobsApi] Error response body:`, errorText);
                
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
                    console.log(`[JobsApi] Parsed error JSON:`, errorJson);
                } catch (parseError) {
                    // If parsing fails, use the raw text or default message
                    console.log(`[JobsApi] Failed to parse error response as JSON:`, parseError);
                    errorMessage = errorText || errorMessage;
                }
                
                throw new JobsApiError(errorMessage, response.status, errorText);
            }

            const responseText = await response.text();
            console.log(`[JobsApi] Success response body length: ${responseText.length} chars`);
            
            return responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            console.log(`[JobsApi] Request failed with error:`, error);
            
            if (error instanceof JobsApiError) {
                throw error;
            }
            throw new JobsApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async searchJobs(params: JobsSearchParams = {}): Promise<KeboolaJob[]> {
        const searchParams = new URLSearchParams();
        
        // Add parameters if they exist
        if (params.componentId) searchParams.append('componentId', params.componentId);
        if (params.configurationId) searchParams.append('configurationId', params.configurationId);
        if (params.branchId) searchParams.append('branchId', params.branchId);
        if (params.status) searchParams.append('status', params.status);
        if (params.since) searchParams.append('since', params.since);
        if (params.until) searchParams.append('until', params.until);
        if (params.limit) searchParams.append('limit', params.limit.toString());
        if (params.offset) searchParams.append('offset', params.offset.toString());
        if (params.sort) searchParams.append('sort', params.sort);
        if (params.order) searchParams.append('order', params.order);

        const endpoint = `/search/jobs${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        const response = await this.makeRequest(endpoint);
        
        return Array.isArray(response) ? response : response.jobs || [];
    }

    async getJobDetail(jobId: string): Promise<KeboolaJobDetail> {
        const endpoint = `/jobs/${jobId}`;
        return await this.makeRequest(endpoint);
    }

    async getRunningJobs(limit: number = 50): Promise<KeboolaJob[]> {
        return await this.searchJobs({
            status: 'processing,waiting',
            limit,
            sort: 'createdTime',
            order: 'desc'
        });
    }

    async getFailedJobs(limit: number = 50): Promise<KeboolaJob[]> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        return await this.searchJobs({
            status: 'error',
            since: yesterday.toISOString(),
            limit,
            sort: 'createdTime',
            order: 'desc'
        });
    }

    async getFinishedJobs(limit: number = 50): Promise<KeboolaJob[]> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        return await this.searchJobs({
            status: 'success,warning',
            since: yesterday.toISOString(),
            limit,
            sort: 'createdTime',
            order: 'desc'
        });
    }

    async getAllJobs(limit: number = 200): Promise<KeboolaJob[]> {
        return await this.searchJobs({
            limit,
            sort: 'createdTime',
            order: 'desc'
        });
    }

    async getJobsForConfiguration(componentId: string, configurationId: string, branchId?: string, limit: number = 20): Promise<KeboolaJob[]> {
        const params: JobsSearchParams = {
            componentId,
            configurationId,
            limit,
            sort: 'createdTime',
            order: 'desc'
        };
        
        if (branchId) {
            params.branchId = branchId;
        }
        
        return await this.searchJobs(params);
    }

    formatDuration(durationSeconds?: number): string {
        if (!durationSeconds) return '-';
        
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const seconds = durationSeconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    formatTimestamp(timestamp?: string): string {
        if (!timestamp) return '-';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch {
            return timestamp;
        }
    }

    getStatusIcon(status: string): string {
        switch (status) {
            case 'success':
                return 'check';
            case 'error':
                return 'error';
            case 'warning':
                return 'warning';
            case 'processing':
                return 'sync~spin';
            case 'waiting':
                return 'clock';
            case 'created':
                return 'circle-outline';
            case 'cancelled':
            case 'terminated':
                return 'circle-slash';
            case 'terminating':
                return 'stop-circle';
            default:
                return 'question';
        }
    }

    getStatusColor(status: string): string {
        switch (status) {
            case 'success':
                return '#28a745';
            case 'error':
                return '#dc3545';
            case 'warning':
                return '#ffc107';
            case 'processing':
                return '#007bff';
            case 'waiting':
                return '#6c757d';
            case 'created':
                return '#6c757d';
            case 'cancelled':
            case 'terminated':
                return '#dc3545';
            case 'terminating':
                return '#fd7e14';
            default:
                return '#6c757d';
        }
    }

    generateKeboolaJobUrl(jobId: string, projectId?: string): string {
        // Generate Keboola UI URL for the job
        const keboolaHost = this.baseUrl.replace('queue.', 'connection.');
        if (projectId) {
            return `${keboolaHost}/admin/projects/${projectId}/jobs/${jobId}`;
        }
        return `${keboolaHost}/admin/jobs/${jobId}`;
    }
} 