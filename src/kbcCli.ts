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
    includeSchema?: boolean;
    outputDirectory?: string;
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
            '--storage-api-token', options.token,
            '--storage-api-host', options.host
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
 * Prompt user for export row limit override
 */
async function promptForRowLimitOverride(defaultLimit: number): Promise<number> {
    const input = await vscode.window.showInputBox({
        prompt: `Enter row limit for this export (leave blank to use default: ${defaultLimit.toLocaleString()})`,
        placeHolder: defaultLimit.toString(),
        validateInput: (value: string) => {
            if (!value) return null; // Allow empty for default
            
            const num = parseInt(value, 10);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a positive number or leave blank for default';
            }
            if (num > 10000000) {
                return 'Row limit cannot exceed 10,000,000';
            }
            return null;
        }
    });

    if (input === undefined) {
        throw new Error('Export cancelled by user');
    }

    return input.trim() ? parseInt(input.trim(), 10) : defaultLimit;
}

/**
 * Export table data with progress tracking
 */
export async function exportTable(
    tableId: string, 
    options: KbcCliOptions,
    defaultRowLimit: number,
    exportOptions: ExportOptions = {}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting table export: ${tableId} ===`);
    
    // Prompt for row limit override
    const rowLimit = exportOptions.rowLimit || await promptForRowLimitOverride(defaultRowLimit);
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting table ${tableId}...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 10, message: "Preparing export..." });
            
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

            progress.report({ increment: 10, message: `Downloading ${rowLimit.toLocaleString()} rows...` });

            // Execute export command
            const fileName = `${tableId.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
            const outputPath = path.join(outputDir, fileName);
            
            outputChannel.appendLine(`Exporting to: ${outputPath}`);
            outputChannel.appendLine(`Row limit: ${rowLimit.toLocaleString()}`);

            await executeKbcCommand([
                'remote', 'table', 'download',
                tableId,
                '--output', outputPath,
                '--rows', rowLimit.toString()
            ], options, (message) => {
                progress.report({ message: message.substring(0, 50) + '...' });
            });

            progress.report({ increment: 60, message: "Export completed" });

            outputChannel.appendLine(`✅ Table ${tableId} exported successfully`);
            outputChannel.appendLine(`📁 Location: ${outputPath}`);
            outputChannel.appendLine(`📊 Rows: ${rowLimit.toLocaleString()}`);

            // Export schema if requested
            if (exportOptions.includeSchema) {
                progress.report({ increment: 10, message: "Exporting schema..." });
                await exportTableSchema(tableId, options, outputDir);
                outputChannel.appendLine(`📋 Schema exported to ${tableId}.schema.json`);
            }

            progress.report({ increment: 10, message: "Complete!" });

            vscode.window.showInformationMessage(
                `Table exported successfully to ${outputPath} (${rowLimit.toLocaleString()} rows)`
            );

            return outputPath;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`❌ Export failed: ${message}`);
            throw error;
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
    defaultRowLimit: number,
    exportOptions: ExportOptions = {}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting bucket export: ${bucketId} ===`);
    
    // Prompt for row limit override
    const rowLimit = exportOptions.rowLimit || await promptForRowLimitOverride(defaultRowLimit);
    
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
            const tablesJson = await executeKbcCommand([
                'remote', 'table', 'list',
                '--bucket-id', bucketId,
                '--format', 'json'
            ], options);

            const tables = JSON.parse(tablesJson);
            
            if (tables.length === 0) {
                vscode.window.showInformationMessage(`Bucket ${bucketId} contains no tables`);
                return bucketDir;
            }

            outputChannel.appendLine(`Found ${tables.length} tables in bucket`);

            // Export each table
            const progressIncrement = Math.floor(70 / tables.length);
            
            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                const tableProgress = Math.floor(((i + 1) / tables.length) * 100);
                
                progress.report({ 
                    increment: progressIncrement,
                    message: `Exported ${i + 1}/${tables.length} tables (currently: ${table.name})`
                });

                outputChannel.appendLine(`Exporting table ${i + 1}/${tables.length}: ${table.id}`);

                const fileName = `${table.id.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
                const tablePath = path.join(bucketDir, fileName);

                await executeKbcCommand([
                    'remote', 'table', 'download',
                    table.id,
                    '--output', tablePath,
                    '--rows', rowLimit.toString()
                ], options);

                outputChannel.appendLine(`✅ ${table.id} exported successfully`);

                // Export schema if requested
                if (exportOptions.includeSchema) {
                    await exportTableSchema(table.id, options, bucketDir);
                }
            }

            progress.report({ increment: 10, message: "Creating bucket schema..." });

            // Export bucket schema
            if (exportOptions.includeSchema) {
                await exportBucketSchema(bucketId, options, bucketDir);
            }

            progress.report({ increment: 5, message: "Complete!" });

            outputChannel.appendLine(`✅ Bucket ${bucketId} exported successfully`);
            outputChannel.appendLine(`📁 Location: ${bucketDir}`);
            outputChannel.appendLine(`📊 Tables: ${tables.length}`);
            outputChannel.appendLine(`📊 Row limit per table: ${rowLimit.toLocaleString()}`);

            vscode.window.showInformationMessage(
                `Bucket exported successfully to ${bucketDir} (${tables.length} tables, ${rowLimit.toLocaleString()} rows each)`
            );

            return bucketDir;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`❌ Bucket export failed: ${message}`);
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
    outputDir: string
): Promise<string> {
    const outputChannel = getOutputChannel();
    
    try {
        // Get bucket info
        const bucketInfoJson = await executeKbcCommand([
            'remote', 'bucket', 'detail',
            bucketId,
            '--format', 'json'
        ], options);

        const bucketInfo = JSON.parse(bucketInfoJson);
        
        // Get tables in bucket
        const tablesJson = await executeKbcCommand([
            'remote', 'table', 'list',
            '--bucket-id', bucketId,
            '--format', 'json'
        ], options);

        const tables = JSON.parse(tablesJson);

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
        outputChannel.appendLine(`Failed to export bucket schema: ${message}`);
        throw new KbcCliError(`Failed to export bucket schema: ${message}`);
    }
}

/**
 * Export stage with progress tracking
 */
export async function exportStage(
    stage: string, 
    options: KbcCliOptions,
    defaultRowLimit: number,
    exportOptions: ExportOptions = {}
): Promise<string> {
    const outputChannel = getOutputChannel();
    outputChannel.appendLine(`\n=== Starting stage export: ${stage} ===`);
    
    // Prompt for row limit override
    const rowLimit = exportOptions.rowLimit || await promptForRowLimitOverride(defaultRowLimit);
    
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
            const bucketsJson = await executeKbcCommand([
                'remote', 'bucket', 'list',
                '--format', 'json'
            ], options);

            const allBuckets = JSON.parse(bucketsJson);
            const stageBuckets = allBuckets.filter((bucket: any) => bucket.stage === stage);
            
            if (stageBuckets.length === 0) {
                vscode.window.showInformationMessage(`Stage ${stage} contains no buckets`);
                return stageDir;
            }

            outputChannel.appendLine(`Found ${stageBuckets.length} buckets in stage ${stage}`);

            // Export each bucket
            const progressIncrement = Math.floor(70 / stageBuckets.length);
            
            for (let i = 0; i < stageBuckets.length; i++) {
                const bucket = stageBuckets[i];
                
                progress.report({ 
                    increment: progressIncrement,
                    message: `Exported ${i + 1}/${stageBuckets.length} buckets (currently: ${bucket.name})`
                });

                outputChannel.appendLine(`Exporting bucket ${i + 1}/${stageBuckets.length}: ${bucket.id}`);

                // Export bucket to stage directory
                await exportBucket(bucket.id, options, rowLimit, {
                    ...exportOptions,
                    outputDirectory: stageDir
                });

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
            outputChannel.appendLine(`📊 Row limit per table: ${rowLimit.toLocaleString()}`);

            vscode.window.showInformationMessage(
                `Stage exported successfully to ${stageDir} (${stageBuckets.length} buckets, ${rowLimit.toLocaleString()} rows per table)`
            );

            return stageDir;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            outputChannel.appendLine(`❌ Stage export failed: ${message}`);
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