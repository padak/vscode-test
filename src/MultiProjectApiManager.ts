import * as vscode from 'vscode';
import { KeboolaApi } from './keboolaApi';
import { ProjectManager, ProjectCredential } from './ProjectManager';

export class MultiProjectApiManager {
    private projectManager: ProjectManager;
    private apiInstances: Map<string, KeboolaApi> = new Map();
    private defaultProjectId: string = 'default';

    constructor(context: vscode.ExtensionContext) {
        this.projectManager = new ProjectManager(context);
    }

    /**
     * Get API instance for a specific project
     */
    async getApiForProject(projectId?: string): Promise<KeboolaApi | undefined> {
        const targetProjectId = projectId || this.defaultProjectId;
        
        // Check if we already have an API instance for this project
        if (this.apiInstances.has(targetProjectId)) {
            return this.apiInstances.get(targetProjectId);
        }

        // Get project credentials
        const project = await this.projectManager.getProject(targetProjectId);
        if (!project) {
            console.warn(`Project ${targetProjectId} not found`);
            return undefined;
        }

        // Get project token
        const token = await this.projectManager.getProjectToken(targetProjectId);
        if (!token) {
            console.warn(`No token found for project ${targetProjectId}`);
            return undefined;
        }

        // Create new API instance
        const api = new KeboolaApi({
            apiUrl: project.stackUrl,
            token: token
        });

        // Cache the API instance
        this.apiInstances.set(targetProjectId, api);
        return api;
    }

    /**
     * Get the default API instance
     */
    async getDefaultApi(): Promise<KeboolaApi | undefined> {
        return this.getApiForProject(this.defaultProjectId);
    }

    /**
     * Set the default project ID
     */
    setDefaultProjectId(projectId: string): void {
        this.defaultProjectId = projectId;
    }

    /**
     * Get the current default project ID
     */
    getDefaultProjectId(): string {
        return this.defaultProjectId;
    }

    /**
     * Get all available projects
     */
    async getAvailableProjects(): Promise<ProjectCredential[]> {
        return await this.projectManager.getProjects();
    }

    /**
     * Test connection for a specific project
     */
    async testProjectConnection(projectId: string): Promise<boolean> {
        return await this.projectManager.testProjectConnection(projectId);
    }

    /**
     * Clear cached API instances (useful when credentials change)
     */
    clearCache(): void {
        this.apiInstances.clear();
    }

    /**
     * Clear cached API instance for a specific project
     */
    clearProjectCache(projectId: string): void {
        this.apiInstances.delete(projectId);
    }

    /**
     * Get project info for a specific project
     */
    async getProjectInfo(projectId: string): Promise<any> {
        return await this.projectManager.getProjectInfo(projectId);
    }

    /**
     * Check if a project is available
     */
    async isProjectAvailable(projectId: string): Promise<boolean> {
        const project = await this.projectManager.getProject(projectId);
        if (!project) return false;
        
        const token = await this.projectManager.getProjectToken(projectId);
        return !!token;
    }
} 