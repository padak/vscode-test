import * as vscode from 'vscode';

/**
 * Record of a downloaded table with its parameters for watching
 */
export interface DownloadRecord {
    projectId: string;      // Project context for the download
    tableId: string;        // Full table ID (e.g., "in.c-main.customers")
    localPath: string;      // Local file path where table was downloaded
    lastImportDate: string; // Table's lastImportDate from API at export time
    limit: number;          // Row limit used (0 = unlimited)
    headers: boolean;       // Whether --header flag was used
}

/**
 * Persistent store for tracking downloaded tables and their watch parameters
 */
export class DownloadsStore {
    private static readonly STORAGE_KEY = 'kbc.downloads';
    
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get all download records
     */
    getAll(): DownloadRecord[] {
        return this.context.globalState.get<DownloadRecord[]>(DownloadsStore.STORAGE_KEY, []);
    }

    /**
     * Get download records for a specific project
     */
    getByProject(projectId: string): DownloadRecord[] {
        return this.getAll().filter(record => record.projectId === projectId);
    }

    /**
     * Get a specific download record by project and table ID
     */
    get(projectId: string, tableId: string): DownloadRecord | undefined {
        return this.getAll().find(record => 
            record.projectId === projectId && record.tableId === tableId
        );
    }

    /**
     * Add or update a download record
     */
    async addDownload(record: DownloadRecord): Promise<void> {
        const records = this.getAll();
        const existingIndex = records.findIndex(r => 
            r.projectId === record.projectId && r.tableId === record.tableId
        );

        if (existingIndex >= 0) {
            // Update existing record
            records[existingIndex] = record;
        } else {
            // Add new record
            records.push(record);
        }

        await this.context.globalState.update(DownloadsStore.STORAGE_KEY, records);
    }

    /**
     * Update the lastImportDate for a specific record
     */
    async updateLastImportDate(projectId: string, tableId: string, lastImportDate: string): Promise<boolean> {
        const records = this.getAll();
        const recordIndex = records.findIndex(r => 
            r.projectId === projectId && r.tableId === tableId
        );

        if (recordIndex >= 0) {
            records[recordIndex].lastImportDate = lastImportDate;
            await this.context.globalState.update(DownloadsStore.STORAGE_KEY, records);
            return true;
        }

        return false;
    }

    /**
     * Remove a download record
     */
    async removeDownload(projectId: string, tableId: string): Promise<boolean> {
        const records = this.getAll();
        const filteredRecords = records.filter(r => 
            !(r.projectId === projectId && r.tableId === tableId)
        );

        if (filteredRecords.length !== records.length) {
            await this.context.globalState.update(DownloadsStore.STORAGE_KEY, filteredRecords);
            return true;
        }

        return false;
    }

    /**
     * Check if a table is being watched
     */
    isWatched(projectId: string, tableId: string): boolean {
        return this.get(projectId, tableId) !== undefined;
    }

    /**
     * Get count of watched tables for a project
     */
    getWatchedCount(projectId?: string): number {
        if (projectId) {
            return this.getByProject(projectId).length;
        }
        return this.getAll().length;
    }

    /**
     * Clear all download records (for debugging/reset)
     */
    async clearAll(): Promise<void> {
        await this.context.globalState.update(DownloadsStore.STORAGE_KEY, []);
    }

    /**
     * Get storage statistics
     */
    getStats(): { totalRecords: number; projectCount: number; projects: string[] } {
        const records = this.getAll();
        const projects = [...new Set(records.map(r => r.projectId))];
        
        return {
            totalRecords: records.length,
            projectCount: projects.length,
            projects: projects
        };
    }
} 