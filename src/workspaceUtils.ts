import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the workspace root path
 */
export function getWorkspaceRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Construct export path for a table within the workspace
 * Format: <workspace>/<exportFolderName>/<stage>/<bucket>/<table>.csv
 */
export function constructExportPath(
    exportFolderName: string,
    stage: string,
    bucketId: string,
    tableId: string,
    fileName?: string,
    useShortTableNames?: boolean
): string | undefined {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return undefined;
    }

    // Extract bucket name from bucket ID (e.g., "in.c-main" -> "c-main")
    const bucketName = bucketId.includes('.') ? bucketId.split('.').slice(1).join('.') : bucketId;
    
    // Use provided fileName or construct from tableId
    let finalFileName = fileName;
    if (!finalFileName) {
        if (useShortTableNames) {
            // Use only the table name (e.g., "weather.csv" from "in.c-data.weather")
            finalFileName = `${extractTableName(tableId)}.csv`;
        } else {
            // Use full table ID (e.g., "in.c-data.weather.csv")
            finalFileName = `${tableId.replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`;
        }
    }
    
    return path.join(workspaceRoot, exportFolderName, stage, bucketName, finalFileName);
}

/**
 * Construct export directory path for a bucket
 * Format: <workspace>/<exportFolderName>/<stage>/<bucket>/
 */
export function constructBucketExportPath(
    exportFolderName: string,
    stage: string,
    bucketId: string
): string | undefined {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return undefined;
    }

    // Extract bucket name from bucket ID (e.g., "in.c-main" -> "c-main")
    const bucketName = bucketId.includes('.') ? bucketId.split('.').slice(1).join('.') : bucketId;
    
    return path.join(workspaceRoot, exportFolderName, stage, bucketName);
}

/**
 * Construct export directory path for a stage
 * Format: <workspace>/<exportFolderName>/<stage>/
 */
export function constructStageExportPath(
    exportFolderName: string,
    stage: string
): string | undefined {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return undefined;
    }
    
    return path.join(workspaceRoot, exportFolderName, stage);
}

/**
 * Ensure directory exists, creating it recursively if needed
 */
export function ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Extract stage from table or bucket ID
 */
export function extractStage(id: string): string {
    return id.split('.')[0] || 'unknown';
}

/**
 * Extract bucket ID from table ID
 */
export function extractBucketId(tableId: string): string {
    const parts = tableId.split('.');
    return parts.length >= 2 ? parts.slice(0, 2).join('.') : tableId;
}

/**
 * Get export folder name from settings
 */
export function getExportFolderName(context: vscode.ExtensionContext): string {
    return context.globalState.get<string>('keboola.exportFolderName') || 'kbc_project';
}

/**
 * Get whether to use short table names from settings
 */
export function getUseShortTableNames(context: vscode.ExtensionContext): boolean {
    return context.globalState.get<boolean>('keboola.useShortTableNames') ?? false;
}

/**
 * Extract table name from table ID
 * Examples: "in.c-data.weather" -> "weather", "out.c-main.users" -> "users"
 */
export function extractTableName(tableId: string): string {
    const parts = tableId.split('.');
    return parts.length >= 3 ? parts.slice(2).join('.') : tableId;
} 