import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface KbcBucket {
    id: string;
    name: string;
    stage: string;
    description?: string;
}

export interface KbcTable {
    id: string;
    name: string;
    bucket: {
        id: string;
        name: string;
    };
    columns: string[];
    rowsCount: number;
}

export interface KbcTableInfo {
    id: string;
    name: string;
    displayName: string;
    bucket: {
        id: string;
        name: string;
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
    lastChangeDate: string;
    lastImportDate: string;
}

export interface KbcTablePreview {
    columns: string[];
    rows: string[][];
}

export class KbcCliError extends Error {
    constructor(message: string, public command?: string, public exitCode?: number) {
        super(message);
        this.name = 'KbcCliError';
    }
}

/**
 * Check if kbc CLI is available
 */
export async function isKbcCliAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        const child = spawn('kbc', ['--version'], { stdio: 'pipe' });
        
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
        
        // Timeout after 5 seconds
        setTimeout(() => {
            child.kill();
            resolve(false);
        }, 5000);
    });
}

/**
 * Execute kbc CLI command
 */
async function executeKbcCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('kbc', args, { 
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true 
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('error', (error) => {
            reject(new KbcCliError(`Failed to execute kbc command: ${error.message}`, args.join(' ')));
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new KbcCliError(
                    `Command failed with exit code ${code}: ${stderr || stdout}`,
                    args.join(' '),
                    code || undefined
                ));
            }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            child.kill();
            reject(new KbcCliError('Command timed out', args.join(' ')));
        }, 30000);
    });
}

/**
 * List all buckets
 */
export async function listBuckets(token: string, host: string): Promise<KbcBucket[]> {
    try {
        const output = await executeKbcCommand([
            'storage:bucket:list',
            '--storage-api-token', token,
            '--storage-api-host', host,
            '--format', 'json'
        ]);
        
        const buckets = JSON.parse(output);
        return buckets.map((bucket: any) => ({
            id: bucket.id,
            name: bucket.name || bucket.displayName || bucket.id,
            stage: bucket.stage,
            description: bucket.description
        }));
    } catch (error) {
        throw new KbcCliError(
            `Failed to list buckets: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `kbc storage:bucket:list --storage-api-token [TOKEN] --storage-api-host ${host}`
        );
    }
}

/**
 * List all tables
 */
export async function listTables(token: string, host: string): Promise<KbcTable[]> {
    try {
        const output = await executeKbcCommand([
            'storage:table:list',
            '--storage-api-token', token,
            '--storage-api-host', host,
            '--format', 'json'
        ]);
        
        const tables = JSON.parse(output);
        return tables.map((table: any) => ({
            id: table.id,
            name: table.name || table.displayName || table.id.split('.').pop(),
            bucket: {
                id: table.bucket?.id || table.id.split('.').slice(0, -1).join('.'),
                name: table.bucket?.name || table.bucket?.displayName || 'Unknown'
            },
            columns: table.columns || [],
            rowsCount: table.rowsCount || 0
        }));
    } catch (error) {
        throw new KbcCliError(
            `Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `kbc storage:table:list --storage-api-token [TOKEN] --storage-api-host ${host}`
        );
    }
}

/**
 * Get table information
 */
export async function getTableInfo(tableId: string, token: string, host: string): Promise<KbcTableInfo> {
    try {
        const output = await executeKbcCommand([
            'storage:table:detail',
            tableId,
            '--storage-api-token', token,
            '--storage-api-host', host,
            '--format', 'json'
        ]);
        
        const table = JSON.parse(output);
        return {
            id: table.id,
            name: table.name || table.displayName || table.id.split('.').pop(),
            displayName: table.displayName || table.name || table.id,
            bucket: {
                id: table.bucket?.id || table.id.split('.').slice(0, -1).join('.'),
                name: table.bucket?.name || table.bucket?.displayName || 'Unknown'
            },
            columns: table.columns?.map((col: any) => ({
                name: col.name,
                definition: {
                    type: col.definition?.type || 'VARCHAR',
                    nullable: col.definition?.nullable !== false,
                    length: col.definition?.length
                }
            })) || [],
            rowsCount: table.rowsCount || 0,
            dataSizeBytes: table.dataSizeBytes || 0,
            created: table.created || '',
            lastChangeDate: table.lastChangeDate || '',
            lastImportDate: table.lastImportDate || ''
        };
    } catch (error) {
        throw new KbcCliError(
            `Failed to get table info: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `kbc storage:table:detail "${tableId}" --storage-api-token [TOKEN] --storage-api-host ${host}`
        );
    }
}

/**
 * Get table preview
 */
export async function getTablePreview(tableId: string, token: string, host: string, limit: number = 100): Promise<KbcTablePreview> {
    try {
        const output = await executeKbcCommand([
            'storage:table:preview',
            tableId,
            '--storage-api-token', token,
            '--storage-api-host', host,
            '--limit', limit.toString(),
            '--format', 'csv'
        ]);
        
        // Parse CSV output
        const lines = output.trim().split('\n');
        if (lines.length === 0) {
            return { columns: [], rows: [] };
        }
        
        const columns = lines[0].split(',').map(col => col.replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
            // Simple CSV parsing (handles basic quoted fields)
            const values = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.replace(/"/g, ''));
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.replace(/"/g, ''));
            
            return values;
        });
        
        return { columns, rows };
    } catch (error) {
        throw new KbcCliError(
            `Failed to get table preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
            `kbc storage:table:preview "${tableId}" --limit ${limit}`,
            error instanceof KbcCliError ? error.exitCode : undefined
        );
    }
} 