import * as vscode from 'vscode';
import { createHash } from 'crypto';

export interface ProjectSettings {
    rowLimit: number;
}

export interface KeboolaConfig {
    apiUrl: string;
    token: string;
}

const DEFAULT_ROW_LIMIT = 1000;

/**
 * Get stored Keboola configuration
 */
export function getStoredConfig(): KeboolaConfig {
    const config = vscode.workspace.getConfiguration('keboola');
    return {
        apiUrl: config.get('apiUrl') || '',
        token: config.get('token') || ''
    };
}

/**
 * Store Keboola configuration
 */
export async function storeConfig(config: KeboolaConfig): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('keboola');
    await workspaceConfig.update('apiUrl', config.apiUrl, vscode.ConfigurationTarget.Global);
    await workspaceConfig.update('token', config.token, vscode.ConfigurationTarget.Global);
}

/**
 * Generate a storage key for project settings based on API URL and token hash
 */
function getStorageKey(apiUrl: string, token: string): string {
    // Normalize API URL (remove trailing slash, convert to lowercase)
    const normalizedUrl = apiUrl.replace(/\/$/, '').toLowerCase();
    
    // Hash the token for privacy (using first 8 characters of SHA1)
    const tokenHash = createHash('sha1').update(token).digest('hex').substring(0, 8);
    
    return `keboola.project.${Buffer.from(normalizedUrl).toString('base64')}.${tokenHash}`;
}

/**
 * Get project settings for a specific Keboola project
 */
function getSettings(apiUrl: string, token: string): ProjectSettings {
    if (!apiUrl || !token) {
        return { rowLimit: DEFAULT_ROW_LIMIT };
    }

    try {
        const storageKey = getStorageKey(apiUrl, token);
        const config = vscode.workspace.getConfiguration('keboola');
        const settings = config.get<ProjectSettings>(storageKey);
        
        return {
            rowLimit: settings?.rowLimit ?? DEFAULT_ROW_LIMIT
        };
    } catch (error) {
        console.error('Failed to get project settings:', error);
        return { rowLimit: DEFAULT_ROW_LIMIT };
    }
}

/**
 * Set the row limit for the current Keboola project
 */
export async function setRowLimit(limit: number): Promise<void> {
    const { apiUrl, token } = getStoredConfig();
    
    if (!apiUrl || !token) {
        throw new Error('No Keboola connection configured');
    }

    if (limit <= 0 || limit > 1000000) {
        throw new Error('Row limit must be between 1 and 1,000,000');
    }

    try {
        const storageKey = getStorageKey(apiUrl, token);
        const currentSettings = getSettings(apiUrl, token);
        
        const newSettings: ProjectSettings = {
            ...currentSettings,
            rowLimit: limit
        };
        
        const config = vscode.workspace.getConfiguration('keboola');
        await config.update(storageKey, newSettings, vscode.ConfigurationTarget.Global);
        
        console.log(`Updated row limit to ${limit} for project ${apiUrl}`);
    } catch (error) {
        console.error('Failed to set row limit:', error);
        throw new Error(`Failed to save row limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get the current row limit for the active project
 */
export function getCurrentRowLimit(): number {
    const { apiUrl, token } = getStoredConfig();
    
    if (!apiUrl || !token) {
        return DEFAULT_ROW_LIMIT;
    }
    
    return getSettings(apiUrl, token).rowLimit;
}

/**
 * Prompt user to set a new row limit
 */
export async function promptSetRowLimit(): Promise<boolean> {
    const { apiUrl, token } = getStoredConfig();
    
    if (!apiUrl || !token) {
        vscode.window.showErrorMessage('No Keboola connection configured. Please configure your connection first.');
        return false;
    }

    const currentLimit = getCurrentRowLimit();
    
    const newLimitStr = await vscode.window.showInputBox({
        prompt: 'Enter the maximum number of rows for table exports and previews',
        placeHolder: 'e.g., 1000, 5000, 50000',
        value: currentLimit.toString(),
        validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num)) {
                return 'Please enter a valid number';
            }
            if (num <= 0) {
                return 'Row limit must be greater than 0';
            }
            if (num > 1000000) {
                return 'Row limit cannot exceed 1,000,000 rows';
            }
            return null;
        }
    });

    if (!newLimitStr) {
        return false; // User cancelled
    }

    const newLimit = parseInt(newLimitStr, 10);
    
    try {
        await setRowLimit(newLimit);
        
        vscode.window.showInformationMessage(
            `Row limit updated to ${newLimit.toLocaleString()} rows for this Keboola project.`
        );
        
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to update row limit: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return false;
    }
}

/**
 * Get all project settings keys (for debugging/management)
 */
export function getAllProjectKeys(): string[] {
    const config = vscode.workspace.getConfiguration('keboola');
    const keys: string[] = [];
    
    // Get all configuration keys and filter for project settings
    Object.keys(config).forEach(key => {
        if (key.startsWith('keboola.project.')) {
            keys.push(key);
        }
    });
    
    return keys;
} 