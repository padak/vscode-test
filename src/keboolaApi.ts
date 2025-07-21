import fetch from 'node-fetch';

export interface KeboolaTable {
    id: string;
    name: string;
    displayName: string;
    bucket: {
        id: string;
        name: string;
        stage: string;
    };
    columns: string[];
    rowsCount: number;
    dataSizeBytes: number;
    created: string;
    lastChangeDate: string;
    lastImportDate: string;
}

export interface KeboolaTableDetail {
    id: string;
    name: string;
    displayName: string;
    bucket: {
        id: string;
        name: string;
        stage: string;
        description?: string;
    };
    columns: Array<{
        name: string;
        definition: {
            type: string;
            nullable: boolean;
            length?: string;
        };
        description?: string;
    }>;
    rowsCount: number;
    dataSizeBytes: number;
    created: string;
    lastChangeDate: string;
    lastImportDate: string;
    primaryKey: string[];
    metadata: Array<{
        key: string;
        value: string;
    }>;
}

export interface KeboolaBucketDetail {
    id: string;
    name: string;
    displayName: string;
    stage: string;
    description?: string;
    created: string;
    lastChangeDate: string;
    dataSizeBytes: number;
    tables: Array<{
        id: string;
        name: string;
        displayName: string;
        rowsCount: number;
        dataSizeBytes: number;
    }>;
    metadata: Array<{
        key: string;
        value: string;
    }>;
}

export interface KeboolaStageDetail {
    id: string;
    name: string;
    displayName: string;
    description?: string;
    buckets: Array<{
        id: string;
        name: string;
        displayName: string;
        description?: string;
        created: string;
        lastChangeDate: string;
        dataSizeBytes: number;
        tableCount: number;
        tables: Array<{
            id: string;
            name: string;
            displayName: string;
            rowsCount: number;
            dataSizeBytes: number;
        }>;
    }>;
    totalBuckets: number;
    totalTables: number;
    totalDataSizeBytes: number;
}

export interface KeboolaTablePreview {
    columns: string[];
    rows: string[][];
    totalRows: number;
    limitedRows: number;
}

export interface KeboolaConfig {
    apiUrl: string;
    token: string;
}

export class KeboolaApiError extends Error {
    constructor(message: string, public readonly statusCode?: number, public readonly response?: any) {
        super(message);
        this.name = 'KeboolaApiError';
    }
}

export class KeboolaApi {
    public readonly apiUrl: string;
    public readonly token: string;

    constructor(config: KeboolaConfig) {
        this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        this.token = config.token;
    }

    private async makeTextRequest(endpoint: string): Promise<string> {
        const url = `${this.apiUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-StorageApi-Token': this.token,
                    'User-Agent': 'Keboola-VSCode-Extension/2.3.0'
                }
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new KeboolaApiError(`HTTP ${response.status}: ${response.statusText}`, response.status, errorData);
            }

            return await response.text();
        } catch (error: any) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            
            throw new KeboolaApiError(
                `Network error: ${error.message || 'Unable to connect to Keboola API'}`,
                undefined,
                error
            );
        }
    }

    /**
     * Test the API connection by fetching basic info
     */
    async testConnection(): Promise<{success: boolean, tokenInfo?: any, error?: string}> {
        try {
            console.log('testConnection: Making API request to /v2/storage/tokens/verify');
            // Use token verification endpoint for proper validation
            const tokenInfo = await this.makeRequest('/v2/storage/tokens/verify');
            console.log('testConnection: API request successful, response:', tokenInfo);
            return {
                success: true,
                tokenInfo: tokenInfo
            };
        } catch (error) {
            console.log('testConnection: API request failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * List all tables in the project
     */
    async listTables(): Promise<KeboolaTable[]> {
        try {
            const response = await this.makeRequest('/v2/storage/tables');
            
            if (!Array.isArray(response)) {
                throw new KeboolaApiError('Invalid response format: expected array of tables');
            }

            return response.map(table => ({
                id: table.id,
                name: table.name || table.displayName || table.id.split('.').pop() || table.id,
                displayName: table.displayName || table.name || table.id,
                bucket: {
                    id: table.bucket?.id || table.id.split('.').slice(0, -1).join('.'),
                    name: table.bucket?.name || table.bucket?.displayName || table.bucket?.id || 'Unknown',
                    stage: table.bucket?.stage || this.extractStageFromTableId(table.id)
                },
                columns: table.columns || [],
                rowsCount: table.rowsCount || 0,
                dataSizeBytes: table.dataSizeBytes || 0,
                created: table.created || '',
                lastChangeDate: table.lastChangeDate || '',
                lastImportDate: table.lastImportDate || ''
            }));
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get raw table detail data from API (for comprehensive schema export)
     */
    async getRawTableDetail(tableId: string): Promise<any> {
        try {
            return await this.makeRequest(`/v2/storage/tables/${encodeURIComponent(tableId)}`);
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to get raw table detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get detailed information about a specific table
     */
    async getTableDetail(tableId: string): Promise<KeboolaTableDetail> {
        try {
            const response = await this.makeRequest(`/v2/storage/tables/${encodeURIComponent(tableId)}`);
            
            return {
                id: response.id,
                name: response.name || response.displayName || tableId.split('.').pop() || tableId,
                displayName: response.displayName || response.name || tableId,
                bucket: {
                    id: response.bucket?.id || tableId.split('.').slice(0, -1).join('.'),
                    name: response.bucket?.name || response.bucket?.displayName || response.bucket?.id || 'Unknown',
                    stage: response.bucket?.stage || this.extractStageFromTableId(tableId),
                    description: response.bucket?.description
                },
                columns: response.columns || [],
                rowsCount: response.rowsCount || 0,
                dataSizeBytes: response.dataSizeBytes || 0,
                created: response.created || '',
                lastChangeDate: response.lastChangeDate || '',
                lastImportDate: response.lastImportDate || '',
                primaryKey: response.primaryKey || [],
                metadata: response.metadata || []
            };
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to get table detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get detailed information about a specific bucket
     */
    async getBucketDetail(bucketId: string): Promise<KeboolaBucketDetail> {
        try {
            const response = await this.makeRequest(`/v2/storage/buckets/${encodeURIComponent(bucketId)}`);
            
            return {
                id: response.id,
                name: response.name || response.displayName || bucketId,
                displayName: response.displayName || response.name || bucketId,
                stage: response.stage || this.extractStageFromBucketId(bucketId),
                description: response.description,
                created: response.created || '',
                lastChangeDate: response.lastChangeDate || '',
                dataSizeBytes: response.dataSizeBytes || 0,
                tables: (response.tables || []).map((table: any) => ({
                    id: table.id,
                    name: table.name || table.displayName || table.id.split('.').pop() || table.id,
                    displayName: table.displayName || table.name || table.id,
                    rowsCount: table.rowsCount || 0,
                    dataSizeBytes: table.dataSizeBytes || 0
                })),
                metadata: response.metadata || []
            };
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to get bucket detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get detailed information about a specific stage (aggregated from all buckets in that stage)
     */
    async getStageDetail(stage: string): Promise<KeboolaStageDetail> {
        try {
            // Get all tables to collect stage data
            const allTables = await this.listTables();
            
            // Filter tables by stage and group by bucket
            const stageTablesMap = new Map<string, any[]>();
            const stageTables = allTables.filter(table => table.bucket.stage === stage);
            
            // Group tables by bucket
            stageTables.forEach(table => {
                const bucketId = table.bucket.id;
                if (!stageTablesMap.has(bucketId)) {
                    stageTablesMap.set(bucketId, []);
                }
                stageTablesMap.get(bucketId)!.push(table);
            });

            // Get detailed information for each bucket
            const buckets = [];
            let totalDataSizeBytes = 0;
            let totalTables = 0;

            for (const [bucketId, tables] of stageTablesMap) {
                try {
                    const bucketDetail = await this.getBucketDetail(bucketId);
                    
                    buckets.push({
                        id: bucketDetail.id,
                        name: bucketDetail.name,
                        displayName: bucketDetail.displayName,
                        description: bucketDetail.description,
                        created: bucketDetail.created,
                        lastChangeDate: bucketDetail.lastChangeDate,
                        dataSizeBytes: bucketDetail.dataSizeBytes,
                        tableCount: bucketDetail.tables.length,
                        tables: bucketDetail.tables
                    });
                    
                    totalDataSizeBytes += bucketDetail.dataSizeBytes;
                    totalTables += bucketDetail.tables.length;
                } catch (error) {
                    // If bucket detail fails, use basic info from tables
                    const bucketTables = tables.map(table => ({
                        id: table.id,
                        name: table.name,
                        displayName: table.displayName,
                        rowsCount: table.rowsCount,
                        dataSizeBytes: table.dataSizeBytes
                    }));
                    
                    buckets.push({
                        id: bucketId,
                        name: bucketId,
                        displayName: bucketId,
                        description: '',
                        created: '',
                        lastChangeDate: '',
                        dataSizeBytes: tables.reduce((sum, t) => sum + t.dataSizeBytes, 0),
                        tableCount: tables.length,
                        tables: bucketTables
                    });
                    
                    totalDataSizeBytes += tables.reduce((sum, t) => sum + t.dataSizeBytes, 0);
                    totalTables += tables.length;
                }
            }

            // Sort buckets by name
            buckets.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return {
                id: stage,
                name: stage,
                displayName: stage.toUpperCase(),
                description: `${stage.toUpperCase()} stage containing ${buckets.length} buckets and ${totalTables} tables`,
                buckets: buckets,
                totalBuckets: buckets.length,
                totalTables: totalTables,
                totalDataSizeBytes: totalDataSizeBytes
            };
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to get stage detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get a preview of table data with row limit using the Data Preview API
     */
    async getTablePreview(tableId: string, rowLimit: number = 1000): Promise<string> {
        try {
            // Use the Data Preview API endpoint with GET method and query parameters
            const endpoint = `/v2/storage/tables/${encodeURIComponent(tableId)}/data-preview?format=rfc&limit=${rowLimit}`;
            
            const csvData = await this.makeTextRequest(endpoint);

            if (!csvData || !csvData.trim()) {
                throw new KeboolaApiError('No data returned from preview API');
            }

            return csvData;
        } catch (error) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            throw new KeboolaApiError(`Failed to get table preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Enhanced makeRequest to support POST with form data and text responses
     */
    private async makeRequest(endpoint: string, options?: { method?: string; body?: URLSearchParams }): Promise<any> {
        const url = `${this.apiUrl}${endpoint}`;
        console.log('makeRequest: URL:', url);
        console.log('makeRequest: token length:', this.token.length);
        
        try {
            const headers: Record<string, string> = {
                'X-StorageApi-Token': this.token,
                'User-Agent': 'Keboola-VSCode-Extension/2.3.0'
            };

            let body: string | URLSearchParams | undefined;
            
            if (options?.body) {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                body = options.body;
            } else {
                headers['Content-Type'] = 'application/json';
            }

            console.log('makeRequest: Making fetch request...');
            const response = await fetch(url, {
                method: options?.method || 'GET',
                headers,
                body
            });
            console.log('makeRequest: Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorData);
                    if (errorJson.error) {
                        errorMessage = errorJson.error;
                    } else if (errorJson.message) {
                        errorMessage = errorJson.message;
                    }
                } catch {
                    // If JSON parsing fails, use the text response
                    if (errorData) {
                        errorMessage = errorData;
                    }
                }

                throw new KeboolaApiError(errorMessage, response.status, errorData);
            }

            // For data-preview endpoint with rfc format, return text directly
            if (endpoint.includes('/data-preview')) {
                return await response.text();
            }

            // For other endpoints, parse as JSON
            const data = await response.json();
            return data;
        } catch (error: any) {
            if (error instanceof KeboolaApiError) {
                throw error;
            }
            
            // Handle network errors, timeout, etc.
            throw new KeboolaApiError(
                `Network error: ${error.message || 'Unable to connect to Keboola API'}`,
                undefined,
                error
            );
        }
    }

    /**
     * Extract stage from table ID
     */
    private extractStageFromTableId(tableId: string): string {
        if (tableId.startsWith('in.')) {
            return 'in';
        } else if (tableId.startsWith('out.')) {
            return 'out';
        }
        return 'unknown';
    }

    /**
     * Extract stage from bucket ID
     */
    private extractStageFromBucketId(bucketId: string): string {
        if (bucketId.startsWith('in.')) {
            return 'in';
        } else if (bucketId.startsWith('out.')) {
            return 'out';
        }
        return 'unknown';
    }
} 