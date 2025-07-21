import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getOutputChannel } from './extension';

export class KbcCliError extends Error {
    constructor(message: string, public readonly exitCode?: number) {
        super(message);
        this.name = 'KbcCliError';
    }
}

export interface KbcCliOptions {
    token: string;
    host: string;
}

export interface TableInfo {
    id: string;
    name: string;
    displayName: string;
    bucket: {
        id: string;
        name: string;
        stage: string;
    };
    columns: Array<{
        name: string;
        definition: {
            type: string;
            nullable: boolean;
            length?: string;
        };
    }>;
    rowsCount: number;
    dataSizeBytes: number;
    created: string;
    lastImportDate: string;
}

export interface BucketInfo {
    id: string;
    name: string;
    stage: string;
    description: string;
    created: string;
    tables: TableInfo[];
}

export interface ExportOptions {
    rowLimit?: number;
    includeHeaders?: boolean;
    includeSchema?: boolean;
    outputDirectory?: string;
}

export interface ExportSettings {
    rowLimit: number;
    includeHeaders: boolean;
}

/**
 * Check if kbc CLI is available
 */
export async function isKbcCliAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        const process = spawn('kbc', ['--version'], { stdio: 'pipe' });
        
        const timeout = setTimeout(() => {
            process.kill();
            resolve(false);
        }, 5000);

        process.on('close', (code) => {
            clearTimeout(timeout);
            resolve(code === 0);
        });

        process.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

/**
 * Execute kbc command with proper error handling
 */
async function executeKbcCommand(
    args: string[], 
    options: KbcCliOptions,
    progressCallback?: (message: string) => void
): Promise<string> {
    return new Promise((resolve, reject) => {
        const fullArgs = [
            ...args,
            '-t', options.token,
            '-H', options.host
        ];

        progressCallback?.(`Executing: kbc ${args.join(' ')}`);
        
        const childProcess = spawn('kbc', fullArgs, {
            stdio: 'pipe',
            env: { ...process.env }
        });

        let stdout = '';
        let stderr = '';

        childProcess.stdout?.on('data', (data: Buffer) => {
            const output = data.toString();
            stdout += output;
            
            // Log to output channel
            const outputChannel = getOutputChannel();
            outputChannel.appendLine(`[STDOUT] ${output.trim()}`);
            
            // Extract progress information if available
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    progressCallback?.(line.trim());
                }
            }
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
            const output = data.toString();
            stderr += output;
            
            // Log to output channel
            const outputChannel = getOutputChannel();
            outputChannel.appendLine(`[STDERR] ${output.trim()}`);
        });

        childProcess.on('close', (code: number | null) => {
            const outputChannel = getOutputChannel();
            outputChannel.appendLine(`[EXIT] Command exited with code ${code}`);
            
            if (code === 0) {
                resolve(stdout);
            } else {
                const errorMessage = stderr || stdout || `Command failed with exit code ${code}`;
                reject(new KbcCliError(errorMessage, code || undefined));
            }
        });

        childProcess.on('error', (error: Error) => {
            const outputChannel = getOutputChannel();
            outputChannel.appendLine(`[ERROR] ${error.message}`);
            reject(new KbcCliError(`Failed to execute kbc command: ${error.message}`));
        });
    });
}

/**
 * Prompt user for export settings override
 */
async function promptForExportOverrides(defaultSettings: ExportSettings): Promise<ExportSettings> {
    // Prompt for row limit
    const rowLimitInput = await vscode.window.showInputBox({
        prompt: `Enter row limit for this export (0 = unlimited, leave blank to use default: ${defaultSettings.rowLimit === 0 ? 'unlimited' : defaultSettings.rowLimit.toLocaleString()})`,
        placeHolder: defaultSettings.rowLimit === 0 ? '0 (unlimited)' : defaultSettings.rowLimit.toString(),
        validateInput: (value: string) => {
            if (!value) return null; // Allow empty for default
            
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 0) {
                return 'Please enter 0 (unlimited) or a positive number, or leave blank for default';
            }
            if (num > 10000000) {
                return 'Row limit cannot exceed 10,000,000';
            }
            return null;
        }
    });

    if (rowLimitInput === undefined) {
        throw new Error('Export cancelled by user');
    }

    const rowLimit = rowLimitInput.trim() ? parseInt(rowLimitInput.trim(), 10) : defaultSettings.rowLimit;

    // Prompt for headers
    const headersInput = await vscode.window.showInputBox({
        prompt: `Include headers in this export? (Yes/No, leave blank to use default: ${defaultSettings.includeHeaders ? 'Yes' : 'No'})`,
        placeHolder: defaultSettings.includeHeaders ? 'Yes (default)' : 'No (default)',
        validateInput: (value: string) => {
            if (!value) return null; // Allow empty for default
            
            const normalizedValue = value.toLowerCase().trim();
            if (!['yes', 'y', 'no', 'n'].includes(normalizedValue)) {
                return 'Please enter Yes, No, or leave blank for default';
            }
            return null;
        }
    });

    if (headersInput === undefined) {
        throw new Error('Export cancelled by user');
    }

    let includeHeaders = defaultSettings.includeHeaders;
    if (headersInput.trim()) {
        const normalizedValue = headersInput.toLowerCase().trim();
        includeHeaders = ['yes', 'y'].includes(normalizedValue);
    }

    return { rowLimit, includeHeaders };
}

/**
 * Build kbc download command with proper flags
 */
function buildDownloadCommand(
    tableId: string,
    outputPath: string,
    exportSettings: ExportSettings
): string[] {
    const command = [
        'remote', 'table', 'download',
        tableId,
        '--output', outputPath
    ];

    // Add --limit only if rowLimit > 0 (0 = unlimited)
    if (exportSettings.rowLimit > 0) {
        command.push('--limit', exportSettings.rowLimit.toString());
    }

    // Add --header if headers are enabled
    if (exportSettings.includeHeaders) {
        command.push('--header');
    }

    return command;
}

/**
 * Export table data with progress tracking
 */
export async function exportTable(
    tableId: string, 
    options: KbcCliOptions,
    defaultSettings: ExportSettings,
    exportOptions: ExportOptions = {}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting table export: ${tableId} ===`);
    outputChannel.show(true); // Show output channel to user
    
    // Get export settings (either from options or prompt user)
    let exportSettings: ExportSettings;
    if (exportOptions.rowLimit !== undefined && exportOptions.includeHeaders !== undefined) {
        exportSettings = {
            rowLimit: exportOptions.rowLimit,
            includeHeaders: exportOptions.includeHeaders
        };
    } else {
        exportSettings = await promptForExportOverrides(defaultSettings);
    }
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting table ${tableId}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: "Preparing export..." });
            outputChannel.appendLine(`📋 Export settings: Row limit: ${exportSettings.rowLimit === 0 ? 'unlimited' : exportSettings.rowLimit.toLocaleString()}, Headers: ${exportSettings.includeHeaders ? 'included' : 'excluded'}`);
            
            // Choose output directory
            const outputDir = exportOptions.outputDirectory || await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Export Directory'
            }).then(result => result?.[0]?.fsPath);

            if (!outputDir) {
                throw new Error('No output directory selected');
            }

            const limitText = exportSettings.rowLimit === 0 ? 'unlimited' : exportSettings.rowLimit.toLocaleString();
            const headersText = exportSettings.includeHeaders ? 'with headers' : 'without headers';
            
            progress.report({ message: `Downloading ${limitText} rows ${headersText}... (see Output panel for details)` });

            // Execute export command
            const fileName = `${tableId.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
            const outputPath = path.join(outputDir, fileName);
            
            outputChannel.appendLine(`📁 Exporting to: ${outputPath}`);
            outputChannel.appendLine(`📊 Row limit: ${limitText}`);
            outputChannel.appendLine(`📋 Headers: ${exportSettings.includeHeaders ? 'included' : 'excluded'}`);
            outputChannel.appendLine(`⏳ Starting download... (this may take a while for large tables)`);

            const downloadCommand = buildDownloadCommand(tableId, outputPath, exportSettings);
            outputChannel.appendLine(`🔧 Command: kbc ${downloadCommand.join(' ')}`);
            
            const startTime = Date.now();
            await executeKbcCommand(downloadCommand, options, (message) => {
                // Show CLI output in progress (truncated)
                const truncatedMessage = message.length > 40 ? message.substring(0, 40) + '...' : message;
                progress.report({ message: truncatedMessage });
            });
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            progress.report({ message: "Export completed successfully!" });

            outputChannel.appendLine(`✅ Table ${tableId} exported successfully in ${duration}s`);
            outputChannel.appendLine(`📁 Location: ${outputPath}`);
            outputChannel.appendLine(`📊 Rows: ${limitText}`);
            outputChannel.appendLine(`📋 Headers: ${exportSettings.includeHeaders ? 'included' : 'excluded'}`);

            // Export schema if requested
            if (exportOptions.includeSchema) {
                progress.report({ message: "Exporting schema..." });
                await exportTableSchema(tableId, options, outputDir);
                outputChannel.appendLine(`📋 Schema exported to ${tableId}.schema.json`);
            }

            outputChannel.appendLine(`🎉 Export complete! Check ${outputPath}`);

            vscode.window.showInformationMessage(
                `Table exported successfully to ${outputPath} (${limitText} rows, ${headersText})`,
                'Open File', 'Show in Output'
            ).then(choice => {
                if (choice === 'Open File') {
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputPath));
                } else if (choice === 'Show in Output') {
                    outputChannel.show(true);
                }
            });

            return outputPath;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            
            // Handle KBC CLI bug with empty tables: "Error: Max must be greater than 0"
            if (message.includes('Max must be greater than 0') || message.includes('Downloading   0%')) {
                outputChannel.appendLine(`⚠️ Detected empty table issue (KBC CLI bug with 0-byte tables)`);
                outputChannel.appendLine(`📝 Creating empty CSV file as workaround...`);
                
                                 try {
                     // Recreate file paths (variables are in try block scope)
                     const outputDir = exportOptions.outputDirectory || '.'; // fallback
                     const fileName = `${tableId.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
                     const outputPath = path.join(outputDir, fileName);
                     
                     // Create empty CSV file with headers if requested
                     let csvContent = '';
                     if (exportSettings.includeHeaders) {
                         // We can't get column names from failed export, so create minimal header
                         csvContent = '# Empty table: no data available\n';
                     }
                     
                     fs.writeFileSync(outputPath, csvContent);
                     
                     outputChannel.appendLine(`✅ Empty table ${tableId} handled successfully`);
                     outputChannel.appendLine(`📁 Location: ${outputPath}`);
                     outputChannel.appendLine(`📊 Rows: 0 (empty table)`);
                     outputChannel.appendLine(`📋 Headers: ${exportSettings.includeHeaders ? 'minimal header created' : 'no headers'}`);
                     
                     // Export schema if requested
                     if (exportOptions.includeSchema) {
                         await exportTableSchema(tableId, options, outputDir);
                         outputChannel.appendLine(`📋 Schema exported to ${tableId}.schema.json`);
                     }
                     
                     vscode.window.showWarningMessage(
                         `Table ${tableId} is empty - created placeholder file at ${outputPath}`,
                         'Open File'
                     ).then(choice => {
                         if (choice === 'Open File') {
                             vscode.commands.executeCommand('vscode.open', vscode.Uri.file(outputPath));
                         }
                     });
                     
                     return outputPath;
                    
                } catch (fileError) {
                    outputChannel.appendLine(`❌ Failed to create empty file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
                    outputChannel.show(true);
                    throw error; // Throw original error
                }
            } else {
                outputChannel.appendLine(`❌ Export failed: ${message}`);
                outputChannel.show(true); // Show output on error
                throw error;
            }
        }
    });
}

/**
 * Export table schema as JSON
 */
export async function exportTableSchema(
    tableId: string, 
    options: KbcCliOptions,
    outputDir: string
): Promise<string> {
    const outputChannel = getOutputChannel();
    
    try {
        // Get table info
        const tableInfoJson = await executeKbcCommand([
            'remote', 'table', 'detail',
            tableId,
            '--format', 'json'
        ], options);

        const tableInfo = JSON.parse(tableInfoJson);
        
        // Create schema object
        const schema = {
            table: {
                id: tableInfo.id,
                name: tableInfo.name,
                displayName: tableInfo.displayName,
                bucket: tableInfo.bucket,
                created: tableInfo.created,
                lastImportDate: tableInfo.lastImportDate,
                rowsCount: tableInfo.rowsCount,
                dataSizeBytes: tableInfo.dataSizeBytes
            },
            columns: tableInfo.columns || [],
            metadata: tableInfo.metadata || {},
            exportedAt: new Date().toISOString(),
            exportedBy: 'Keboola Storage Explorer'
        };

        // Write schema file
        const schemaFileName = `${tableId.replace(/[^a-zA-Z0-9.-]/g, '_')}.schema.json`;
        const schemaPath = path.join(outputDir, schemaFileName);
        
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
        
        outputChannel.appendLine(`Schema exported: ${schemaPath}`);
        return schemaPath;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Failed to export schema: ${message}`);
        throw new KbcCliError(`Failed to export table schema: ${message}`);
    }
}

/**
 * Export bucket with progress tracking
 */
export async function exportBucket(
    bucketId: string, 
    options: KbcCliOptions,
    defaultSettings: ExportSettings,
    exportOptions: ExportOptions = {},
    bucketTables?: Array<{id: string, displayName?: string, name?: string}>
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting bucket export: ${bucketId} ===`);
    outputChannel.show(true); // Show output channel to user
    
    // Get export settings (either from options or prompt user)
    let exportSettings: ExportSettings;
    if (exportOptions.rowLimit !== undefined && exportOptions.includeHeaders !== undefined) {
        exportSettings = {
            rowLimit: exportOptions.rowLimit,
            includeHeaders: exportOptions.includeHeaders
        };
    } else {
        exportSettings = await promptForExportOverrides(defaultSettings);
    }
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting bucket ${bucketId}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 5, message: "Getting bucket info..." });
            
            // Choose output directory
            const outputDir = exportOptions.outputDirectory || await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Export Directory'
            }).then(result => result?.[0]?.fsPath);

            if (!outputDir) {
                throw new Error('No output directory selected');
            }

            // Create bucket subfolder
            const bucketDir = path.join(outputDir, bucketId.replace(/[^a-zA-Z0-9.-]/g, '_'));
            if (!fs.existsSync(bucketDir)) {
                fs.mkdirSync(bucketDir, { recursive: true });
            }

            // Get tables in bucket
            progress.report({ increment: 10, message: "Getting tables list..." });
            
            let tables: Array<{id: string, name?: string, displayName?: string}>;
            
            if (bucketTables && bucketTables.length > 0) {
                // Use provided bucket tables (from API call)
                tables = bucketTables;
                outputChannel.appendLine(`Using provided table list: ${bucketTables.length} tables`);
            } else {
                // Fallback: get all tables and filter by bucket prefix
                outputChannel.appendLine(`No table list provided, fetching all tables and filtering...`);
                const allTablesJson = await executeKbcCommand([
                    'remote', 'table', 'list',
                    '--format', 'json'
                ], options);

                const allTables = JSON.parse(allTablesJson);
                
                // Filter tables that belong to this bucket
                tables = allTables.filter((table: any) => 
                    table.id && table.id.startsWith(bucketId + '.')
                );
                outputChannel.appendLine(`Filtered ${tables.length} tables from ${allTables.length} total tables`);
            }
            
            if (tables.length === 0) {
                vscode.window.showInformationMessage(`Bucket ${bucketId} contains no tables`);
                return bucketDir;
            }

            const limitText = exportSettings.rowLimit === 0 ? 'unlimited' : exportSettings.rowLimit.toLocaleString();
            const headersText = exportSettings.includeHeaders ? 'with headers' : 'without headers';

            outputChannel.appendLine(`Found ${tables.length} tables in bucket`);
            outputChannel.appendLine(`Export settings: ${limitText} rows per table, ${headersText}`);

            // Export each table
            const progressIncrement = Math.floor(70 / tables.length);
            
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                
                progress.report({ 
                    increment: progressIncrement,
                    message: `Exported ${i + 1}/${tables.length} tables (currently: ${table.displayName || table.name || table.id})`
                });

                outputChannel.appendLine(`Exporting table ${i + 1}/${tables.length}: ${table.id}`);

                const fileName = `${table.id.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
                const tablePath = path.join(bucketDir, fileName);

                const downloadCommand = buildDownloadCommand(table.id, tablePath, exportSettings);
                await executeKbcCommand(downloadCommand, options);

                outputChannel.appendLine(`✅ ${table.id} exported successfully`);

                // Export schema if requested
                if (exportOptions.includeSchema) {
                    await exportTableSchema(table.id, options, bucketDir);
                }
            }

            progress.report({ increment: 10, message: "Creating bucket schema..." });

            // Export bucket schema
            if (exportOptions.includeSchema) {
                const bucketDetailForSchema = {
                    id: bucketId,
                    displayName: bucketId,
                    description: '',
                    created: '',
                    tables: tables
                };
                await exportBucketSchema(bucketId, options, bucketDir, bucketDetailForSchema);
            }

            progress.report({ increment: 5, message: "Complete!" });

            outputChannel.appendLine(`✅ Bucket ${bucketId} exported successfully`);
            outputChannel.appendLine(`📁 Location: ${bucketDir}`);
            outputChannel.appendLine(`📊 Tables: ${tables.length}`);
            outputChannel.appendLine(`📊 Row limit per table: ${limitText}`);
            outputChannel.appendLine(`📋 Headers: ${exportSettings.includeHeaders ? 'included' : 'excluded'}`);

            vscode.window.showInformationMessage(
                `Bucket exported successfully to ${bucketDir} (${tables.length} tables, ${limitText} rows each, ${headersText})`
            );

            return bucketDir;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`❌ Bucket export failed: ${message}`);
            outputChannel.show(true); // Show output on error
            throw error;
        }
    });
}

/**
 * Export bucket schema as JSON
 */
export async function exportBucketSchema(
    bucketId: string, 
    options: KbcCliOptions,
    outputDir: string,
    bucketDetail?: {id: string, displayName?: string, description?: string, created?: string, tables: Array<{id: string, displayName?: string, name?: string}>}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting bucket schema export: ${bucketId} ===`);
    outputChannel.show(true); // Show output channel to user
    
    try {
        let bucketInfo: any;
        let tables: Array<{id: string, displayName?: string, name?: string}>;
        
        if (bucketDetail) {
            // Use provided bucket detail data
            bucketInfo = {
                id: bucketDetail.id,
                name: bucketDetail.displayName,
                description: bucketDetail.description,
                created: bucketDetail.created
            };
            tables = bucketDetail.tables;
            outputChannel.appendLine(`Using provided bucket detail for ${tables.length} tables`);
        } else {
            // Fallback: get bucket info via CLI
            outputChannel.appendLine(`No bucket detail provided, fetching via CLI...`);
            const bucketInfoJson = await executeKbcCommand([
                'remote', 'bucket', 'detail',
                bucketId,
                '--format', 'json'
            ], options);

            bucketInfo = JSON.parse(bucketInfoJson);
            
            // Get all tables and filter by bucket prefix (no --bucket-id flag exists)
            const allTablesJson = await executeKbcCommand([
                'remote', 'table', 'list',
                '--format', 'json'
            ], options);

            const allTables = JSON.parse(allTablesJson);
            tables = allTables.filter((table: any) => 
                table.id && table.id.startsWith(bucketId + '.')
            );
            outputChannel.appendLine(`Filtered ${tables.length} tables from ${allTables.length} total tables`);
        }

        // Create bucket schema object
        const schema = {
            bucket: {
                id: bucketInfo.id,
                name: bucketInfo.name,
                stage: bucketInfo.stage,
                description: bucketInfo.description,
                created: bucketInfo.created
            },
            tables: tables.map((table: any) => ({
                id: table.id,
                name: table.name,
                displayName: table.displayName,
                columns: table.columns || [],
                rowsCount: table.rowsCount,
                dataSizeBytes: table.dataSizeBytes,
                created: table.created,
                lastImportDate: table.lastImportDate
            })),
            exportedAt: new Date().toISOString(),
            exportedBy: 'Keboola Storage Explorer'
        };

        // Write bucket schema file
        const schemaFileName = `${bucketId.replace(/[^a-zA-Z0-9.-]/g, '_')}.schema.json`;
        const schemaPath = path.join(outputDir, schemaFileName);
        
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
        
        outputChannel.appendLine(`Bucket schema exported: ${schemaPath}`);
        return schemaPath;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`❌ Failed to export bucket schema: ${message}`);
        outputChannel.show(true); // Show output on error
        throw new KbcCliError(`Failed to export bucket schema: ${message}`);
    }
}

/**
 * Export stage with progress tracking
 */
export async function exportStage(
    stage: string, 
    options: KbcCliOptions,
    defaultSettings: ExportSettings,
    exportOptions: ExportOptions = {},
    stageDetail?: {id: string, buckets: Array<{id: string, displayName?: string, tables: Array<{id: string, displayName?: string, name?: string}>}>}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting stage export: ${stage} ===`);
    outputChannel.show(true); // Show output channel to user
    
    // Get export settings (either from options or prompt user)
    let exportSettings: ExportSettings;
    if (exportOptions.rowLimit !== undefined && exportOptions.includeHeaders !== undefined) {
        exportSettings = {
            rowLimit: exportOptions.rowLimit,
            includeHeaders: exportOptions.includeHeaders
        };
    } else {
        exportSettings = await promptForExportOverrides(defaultSettings);
    }
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting stage ${stage}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 5, message: "Getting stage info..." });
            
            // Choose output directory
            const outputDir = exportOptions.outputDirectory || await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Export Directory'
            }).then(result => result?.[0]?.fsPath);

            if (!outputDir) {
                throw new Error('No output directory selected');
            }

            // Create stage subfolder
            const stageDir = path.join(outputDir, `${stage}_stage`);
            if (!fs.existsSync(stageDir)) {
                fs.mkdirSync(stageDir, { recursive: true });
            }

            // Get buckets in stage
            progress.report({ increment: 10, message: "Getting buckets list..." });
            
            let stageBuckets: Array<{id: string, displayName?: string, tables: Array<{id: string, displayName?: string, name?: string}>}>;
            
            if (stageDetail && stageDetail.buckets.length > 0) {
                // Use provided stage detail data (from API call)
                stageBuckets = stageDetail.buckets;
                outputChannel.appendLine(`Using provided stage detail for ${stageBuckets.length} buckets`);
            } else {
                // This shouldn't happen since we pass stage detail from UI, but provide error
                throw new Error(`No bucket data available for stage ${stage}. Stage detail data is required for export.`);
            }
            
            if (stageBuckets.length === 0) {
                vscode.window.showInformationMessage(`Stage ${stage} contains no buckets`);
                return stageDir;
            }

            const limitText = exportSettings.rowLimit === 0 ? 'unlimited' : exportSettings.rowLimit.toLocaleString();
            const headersText = exportSettings.includeHeaders ? 'with headers' : 'without headers';

            outputChannel.appendLine(`Found ${stageBuckets.length} buckets in stage ${stage}`);
            outputChannel.appendLine(`Export settings: ${limitText} rows per table, ${headersText}`);

            // Export each bucket
            const progressIncrement = Math.floor(70 / stageBuckets.length);
            
            for (let i = 0; i < stageBuckets.length; i++) {
                const bucket = stageBuckets[i];
                
                progress.report({ 
                    increment: progressIncrement,
                    message: `Exported ${i + 1}/${stageBuckets.length} buckets (currently: ${bucket.displayName || bucket.id})`
                });

                outputChannel.appendLine(`Exporting bucket ${i + 1}/${stageBuckets.length}: ${bucket.id}`);

                // Export bucket to stage directory
                await exportBucket(bucket.id, options, exportSettings, {
                    ...exportOptions,
                    outputDirectory: stageDir,
                    rowLimit: exportSettings.rowLimit,
                    includeHeaders: exportSettings.includeHeaders
                }, bucket.tables);

                outputChannel.appendLine(`✅ Bucket ${bucket.id} exported successfully`);
            }

            progress.report({ increment: 10, message: "Creating stage schema..." });

            // Export stage schema
            if (exportOptions.includeSchema) {
                await exportStageSchema(stage, options, stageDir);
            }

            progress.report({ increment: 5, message: "Complete!" });

            outputChannel.appendLine(`✅ Stage ${stage} exported successfully`);
            outputChannel.appendLine(`📁 Location: ${stageDir}`);
            outputChannel.appendLine(`📊 Buckets: ${stageBuckets.length}`);
            outputChannel.appendLine(`📊 Row limit per table: ${limitText}`);
            outputChannel.appendLine(`📋 Headers: ${exportSettings.includeHeaders ? 'included' : 'excluded'}`);

            vscode.window.showInformationMessage(
                `Stage exported successfully to ${stageDir} (${stageBuckets.length} buckets, ${limitText} rows per table, ${headersText})`
            );

            return stageDir;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`❌ Stage export failed: ${message}`);
            outputChannel.show(true); // Show output on error
            throw error;
        }
    });
}

/**
 * Export stage schema as JSON
 */
export async function exportStageSchema(
    stage: string, 
    options: KbcCliOptions,
    outputDir: string
): Promise<string> {
    const outputChannel = getOutputChannel();
    
    try {
        // Get all buckets in stage
        const bucketsJson = await executeKbcCommand([
            'remote', 'bucket', 'list',
            '--format', 'json'
        ], options);

        const allBuckets = JSON.parse(bucketsJson);
        const stageBuckets = allBuckets.filter((bucket: any) => bucket.stage === stage);

        // Create stage schema object
        const schema = {
            stage: {
                name: stage,
                bucketsCount: stageBuckets.length
            },
            buckets: stageBuckets.map((bucket: any) => ({
                id: bucket.id,
                name: bucket.name,
                description: bucket.description,
                created: bucket.created
            })),
            exportedAt: new Date().toISOString(),
            exportedBy: 'Keboola Storage Explorer'
        };

        // Write stage schema file
        const schemaFileName = `${stage}_stage.schema.json`;
        const schemaPath = path.join(outputDir, schemaFileName);
        
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
        
        outputChannel.appendLine(`Stage schema exported: ${schemaPath}`);
        return schemaPath;

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Failed to export stage schema: ${message}`);
        throw new KbcCliError(`Failed to export stage schema: ${message}`);
    }
}