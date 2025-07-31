import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Get the Keboola root folder path
 */
export function keboolaRoot(context: vscode.ExtensionContext): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return path.join(context.globalStorageUri.fsPath, 'keboola');
    }
    
    const rootFolder = context.globalState.get<string>('keboola.export.rootFolder') || 'keboola';
    return path.join(workspaceFolders[0].uri.fsPath, rootFolder);
}

/**
 * Get the agents directory path
 */
export function agentsDir(context: vscode.ExtensionContext): string {
    const agentsFolder = context.globalState.get<string>('keboola.export.agentsFolder') || 'agents';
    return path.join(keboolaRoot(context), agentsFolder);
}

/**
 * Get the agent run directory path
 * @param context Extension context
 * @param runId The agent run ID
 * @param projectSlug Optional project slug (defaults to "default")
 */
export function agentRunDir(context: vscode.ExtensionContext, runId: string, projectSlug: string = 'default'): string {
    return path.join(keboolaRoot(context), projectSlug, 'agents', runId);
}

/**
 * Migrate legacy agent runs from old location to new location
 * @param context Extension context
 */
export async function migrateLegacyAgentRuns(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const oldExportFolderName = context.globalState.get<string>('keboola.exportFolderName');
    if (!oldExportFolderName) {
        return;
    }

    const oldAgentsDir = path.join(workspaceFolders[0].uri.fsPath, oldExportFolderName);
    if (!require('fs').existsSync(oldAgentsDir)) {
        return;
    }

    try {
        const fs = require('fs');
        const agentDirs = fs.readdirSync(oldAgentsDir, { withFileTypes: true })
            .filter((dirent: any) => dirent.isDirectory())
            .map((dirent: any) => dirent.name);

        for (const agentId of agentDirs) {
            const oldAgentDir = path.join(oldAgentsDir, agentId);
            const newAgentDir = agentRunDir(context, agentId);
            
            if (!fs.existsSync(newAgentDir)) {
                // Create parent directories
                const newAgentParentDir = path.dirname(newAgentDir);
                if (!fs.existsSync(newAgentParentDir)) {
                    fs.mkdirSync(newAgentParentDir, { recursive: true });
                }
                
                // Move the directory
                fs.renameSync(oldAgentDir, newAgentDir);
                console.log(`Migrated agent run ${agentId} from ${oldAgentDir} to ${newAgentDir}`);
            }
        }

        // Remove old directory if empty
        if (agentDirs.length > 0) {
            const remainingItems = fs.readdirSync(oldAgentsDir);
            if (remainingItems.length === 0) {
                fs.rmdirSync(oldAgentsDir);
                console.log(`Removed empty legacy directory: ${oldAgentsDir}`);
            }
        }
    } catch (error) {
        console.error('Failed to migrate legacy agent runs:', error);
    }
}

/**
 * Migrate settings from old format to new format
 * @param context Extension context
 */
export async function migrateSettings(context: vscode.ExtensionContext): Promise<void> {
    const oldExportFolderName = context.globalState.get<string>('keboola.exportFolderName');
    const newRootFolder = context.globalState.get<string>('keboola.export.rootFolder');
    const newAgentsFolder = context.globalState.get<string>('keboola.export.agentsFolder');

    // Only migrate if old setting exists and new settings don't exist
    if (oldExportFolderName && !newRootFolder && !newAgentsFolder) {
        await context.globalState.update('keboola.export.rootFolder', oldExportFolderName);
        await context.globalState.update('keboola.export.agentsFolder', 'agents');
        await context.globalState.update('keboola.exportFolderName', undefined);
        
        console.log(`Migrated settings: rootFolder=${oldExportFolderName}, agentsFolder=agents`);
    }
} 