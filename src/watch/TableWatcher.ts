import * as vscode from 'vscode';
import { DownloadsStore, DownloadRecord } from './DownloadsStore';
import { KeboolaApi } from '../keboolaApi';
import { exportTable, KbcCliOptions, ExportSettings } from '../kbcCli';

/**
 * Settings for table watching functionality
 */
export interface WatchSettings {
    watchEnabled: boolean;      // Enable/disable table watching
    watchIntervalSec: number;   // Check interval in seconds
    autoDownload: boolean;      // Automatically re-download changed tables
}

/**
 * Service for monitoring table changes and triggering updates
 */
export class TableWatcher {
    private intervalId: NodeJS.Timeout | undefined;
    private isChecking = false;
    private outputChannel: vscode.OutputChannel;
    
    constructor(
        private context: vscode.ExtensionContext,
        private downloadsStore: DownloadsStore,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
    }

    /**
     * Start the table watcher with given settings
     */
    start(settings: WatchSettings): void {
        this.stop(); // Stop any existing watcher

        if (!settings.watchEnabled) {
            console.log('[TableWatcher] Watching disabled');
            return;
        }

        const intervalMs = settings.watchIntervalSec * 1000;
        console.log(`[TableWatcher] Starting watcher with ${settings.watchIntervalSec}s interval`);

        this.intervalId = setInterval(() => {
            this.checkTables(settings);
        }, intervalMs);

        // Initial check after short delay
        setTimeout(() => {
            this.checkTables(settings);
        }, 2000);
    }

    /**
     * Stop the table watcher
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            console.log('[TableWatcher] Stopped');
        }
    }

    /**
     * Check all watched tables for updates
     */
    private async checkTables(settings: WatchSettings): Promise<void> {
        if (this.isChecking) {
            console.log('[TableWatcher] Check already in progress, skipping');
            return;
        }

        this.isChecking = true;
        
        try {
            const records = this.downloadsStore.getAll();
            if (records.length === 0) {
                console.log('[TableWatcher] No tables to watch');
                return;
            }

            console.log(`[TableWatcher] Checking ${records.length} watched tables`);

            // Process records sequentially to avoid overwhelming the API
            for (const record of records) {
                await this.checkSingleTable(record, settings);
                
                // Small delay between API calls to be respectful
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.error('[TableWatcher] Error during table check:', error);
            this.outputChannel.appendLine(`❌ Table watcher error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Check a single table for updates
     */
    private async checkSingleTable(record: DownloadRecord, settings: WatchSettings): Promise<void> {
        try {
            // Get current project API settings - for now, assume we have a way to get this
            const apiSettings = this.getCurrentApiSettings();
            if (!apiSettings) {
                console.log(`[TableWatcher] No API settings available for project ${record.projectId}`);
                return;
            }

            const api = new KeboolaApi(apiSettings);
            
            // Get current table details
            const tableDetail = await api.getTableDetail(record.tableId);
            const currentImportDate = tableDetail.lastImportDate;

            console.log(`[TableWatcher] Checking ${record.tableId}: stored=${record.lastImportDate}, current=${currentImportDate}`);

            // Compare import dates
            if (currentImportDate && currentImportDate !== record.lastImportDate) {
                console.log(`[TableWatcher] Table ${record.tableId} has been updated!`);
                
                // Update stored import date
                await this.downloadsStore.updateLastImportDate(
                    record.projectId, 
                    record.tableId, 
                    currentImportDate
                );

                // Handle the update
                await this.handleTableUpdate(record, settings);
            }

        } catch (error) {
            if (error instanceof Error) {
                // Handle specific error types
                if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                    console.log(`[TableWatcher] Rate limited for ${record.tableId}, will retry next interval`);
                } else if (error.message.includes('5')) {
                    console.log(`[TableWatcher] Server error for ${record.tableId}, will retry next interval`);
                } else {
                    console.error(`[TableWatcher] Error checking ${record.tableId}:`, error.message);
                    this.outputChannel.appendLine(`⚠️ Failed to check table ${record.tableId}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Handle when a table has been updated
     */
    private async handleTableUpdate(record: DownloadRecord, settings: WatchSettings): Promise<void> {
        const tableName = this.getTableDisplayName(record.tableId);
        
        if (settings.autoDownload) {
            // Automatically re-download the table
            console.log(`[TableWatcher] Auto-downloading updated table: ${record.tableId}`);
            this.outputChannel.appendLine(`🔄 Auto-downloading updated table: ${tableName}`);
            
            try {
                await this.redownloadTable(record);
                
                vscode.window.showInformationMessage(
                    `✅ Table "${tableName}" updated and re-downloaded automatically`,
                    'Open File'
                ).then(selection => {
                    if (selection === 'Open File') {
                        vscode.workspace.openTextDocument(record.localPath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });

            } catch (error) {
                console.error(`[TableWatcher] Failed to auto-download ${record.tableId}:`, error);
                this.outputChannel.appendLine(`❌ Auto-download failed for ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                
                // Fall back to notification
                this.showUpdateNotification(record);
            }
            
        } else {
            // Show notification asking user to download
            this.showUpdateNotification(record);
        }
    }

    /**
     * Show notification that a table has been updated
     */
    private showUpdateNotification(record: DownloadRecord): void {
        const tableName = this.getTableDisplayName(record.tableId);
        
        vscode.window.showInformationMessage(
            `📊 Table "${tableName}" has been updated in Keboola`,
            'Download Now',
            'Open File',
            'Dismiss'
        ).then(selection => {
            if (selection === 'Download Now') {
                this.redownloadTable(record).catch(error => {
                    vscode.window.showErrorMessage(`Failed to download table: ${error instanceof Error ? error.message : 'Unknown error'}`);
                });
            } else if (selection === 'Open File') {
                vscode.workspace.openTextDocument(record.localPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        });
    }

    /**
     * Re-download a table with its stored parameters
     */
    private async redownloadTable(record: DownloadRecord): Promise<void> {
        try {
            console.log(`[TableWatcher] Re-downloading ${record.tableId} with limit=${record.limit}, headers=${record.headers} to ${record.localPath}`);
            
            // Get current API settings
            const apiSettings = this.getCurrentApiSettings();
            if (!apiSettings) {
                throw new Error('No API settings available for re-download');
            }

            // Prepare CLI options
            const cliOptions: KbcCliOptions = {
                token: apiSettings.token,
                host: apiSettings.apiUrl
            };

            // Prepare export settings
            const exportSettings: ExportSettings = {
                rowLimit: record.limit,
                includeHeaders: record.headers
            };

            // Prepare export options to avoid prompts
            const exportOptions = {
                rowLimit: record.limit,
                includeHeaders: record.headers,
                outputDirectory: record.localPath
            };

            // Call the actual export function
            await exportTable(record.tableId, cliOptions, exportSettings, this.context, exportOptions);
            
            this.outputChannel.appendLine(`📁 Re-downloaded ${this.getTableDisplayName(record.tableId)} to ${record.localPath}`);
            
        } catch (error) {
            console.error(`[TableWatcher] Failed to re-download ${record.tableId}:`, error);
            throw error;
        }
    }

    /**
     * Get display name for a table ID
     */
    private getTableDisplayName(tableId: string): string {
        const parts = tableId.split('.');
        return parts[parts.length - 1] || tableId;
    }

    /**
     * Get current API settings - this is a placeholder
     * In real implementation, this would get the current project's API settings
     */
    private getCurrentApiSettings(): { apiUrl: string; token: string } | undefined {
        // For now, we'll try to get the current API settings from the global state
        // In a real implementation, this would be more sophisticated with project management
        try {
            const apiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            const token = this.context.globalState.get<string>('keboola.token');
            
            if (apiUrl && token) {
                return { apiUrl, token };
            }
        } catch (error) {
            console.error('[TableWatcher] Failed to get API settings:', error);
        }
        
        return undefined;
    }

    /**
     * Get current status of the watcher
     */
    getStatus(): { isRunning: boolean; watchedTablesCount: number; isChecking: boolean } {
        return {
            isRunning: this.intervalId !== undefined,
            watchedTablesCount: this.downloadsStore.getWatchedCount(),
            isChecking: this.isChecking
        };
    }
} 