import * as vscode from 'vscode';

export interface ProjectCredential {
    id: string;               // project id or slug
    name: string;             // human name
    stackUrl: string;
    tokenSecretKey: string;   // key in SecretStorage
    default?: boolean;        // defaultProjectId chooses default=true if omitted
}

export class ProjectManager {
    private context: vscode.ExtensionContext;
    private readonly PROJECTS_KEY = 'keboola.projects';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get all stored project credentials
     */
    async getProjects(): Promise<ProjectCredential[]> {
        const projects = this.context.globalState.get<ProjectCredential[]>(this.PROJECTS_KEY, []);
        
        // If no projects stored, create default from legacy settings
        if (projects.length === 0) {
            const legacyToken = this.context.globalState.get<string>('keboola.token');
            const legacyApiUrl = this.context.globalState.get<string>('keboola.apiUrl');
            
            if (legacyToken && legacyApiUrl) {
                const defaultProject: ProjectCredential = {
                    id: 'default',
                    name: 'Default',
                    stackUrl: legacyApiUrl,
                    tokenSecretKey: 'keboola.token',
                    default: true
                };
                
                await this.addProject(defaultProject);
                return [defaultProject];
            }
        }
        
        return projects;
    }

    /**
     * Add a new project credential
     */
    async addProject(project: ProjectCredential): Promise<void> {
        const projects = await this.getProjects();
        
        // ENFORCE: Same stack validation (strict)
        if (projects.length > 0) {
            const stackHost = new URL(project.stackUrl).hostname;
            const existingHost = new URL(projects[0].stackUrl).hostname;
            if (stackHost !== existingHost) {
                throw new Error(`All projects must be on the same stack. Expected: ${existingHost}, Got: ${stackHost}`);
            }
        }
        
        // If this is the first project, make it default
        if (projects.length === 0) {
            project.default = true;
        }
        
        // If this project is marked as default, unmark others
        if (project.default) {
            projects.forEach(p => p.default = false);
        }
        
        // Add or update the project
        const existingIndex = projects.findIndex(p => p.id === project.id);
        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.push(project);
        }
        
        await this.context.globalState.update(this.PROJECTS_KEY, projects);
    }

    /**
     * Update an existing project credential
     */
    async updateProject(projectId: string, updates: Partial<ProjectCredential>): Promise<void> {
        const projects = await this.getProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
            throw new Error(`Project ${projectId} not found`);
        }
        
        // If making this project default, unmark others
        if (updates.default) {
            projects.forEach(p => p.default = false);
        }
        
        projects[projectIndex] = { ...projects[projectIndex], ...updates };
        await this.context.globalState.update(this.PROJECTS_KEY, projects);
    }

    /**
     * Remove a project credential
     */
    async removeProject(projectId: string): Promise<void> {
        const projects = await this.getProjects();
        const filteredProjects = projects.filter(p => p.id !== projectId);
        
        // If we removed the default project and there are others, make the first one default
        const removedProject = projects.find(p => p.id === projectId);
        if (removedProject?.default && filteredProjects.length > 0) {
            filteredProjects[0].default = true;
        }
        
        await this.context.globalState.update(this.PROJECTS_KEY, filteredProjects);
    }

    /**
     * Get the default project
     */
    async getDefaultProject(): Promise<ProjectCredential | undefined> {
        const projects = await this.getProjects();
        return projects.find(p => p.default) || projects[0];
    }

    /**
     * Get a specific project by ID
     */
    async getProject(projectId: string): Promise<ProjectCredential | undefined> {
        const projects = await this.getProjects();
        return projects.find(p => p.id === projectId);
    }

    /**
     * Get the token for a specific project
     */
    async getProjectToken(projectId: string): Promise<string | undefined> {
        const project = await this.getProject(projectId);
        if (!project) {
            return undefined;
        }
        
        return await this.context.secrets.get(project.tokenSecretKey);
    }

    /**
     * Store a token for a project
     */
    async storeProjectToken(projectId: string, token: string): Promise<void> {
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        
        await this.context.secrets.store(project.tokenSecretKey, token);
    }

    /**
     * Test connection for a specific project
     */
    async testProjectConnection(projectId: string): Promise<boolean> {
        const project = await this.getProject(projectId);
        if (!project) {
            return false;
        }
        
        const token = await this.getProjectToken(projectId);
        if (!token) {
            return false;
        }
        
        try {
            // Import KeboolaApi dynamically to avoid circular dependencies
            const { KeboolaApi } = await import('./keboolaApi');
            const api = new KeboolaApi({ apiUrl: project.stackUrl, token });
            
            // Try to test connection using the testConnection method
            const result = await api.testConnection();
            return result.success;
        } catch (error) {
            console.error(`Failed to test connection for project ${projectId}:`, error);
            return false;
        }
    }

    /**
     * Get project info for a specific project
     */
    async getProjectInfo(projectId: string): Promise<any> {
        const project = await this.getProject(projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        
        const token = await this.getProjectToken(projectId);
        if (!token) {
            throw new Error(`No token found for project ${projectId}`);
        }
        
        const { KeboolaApi } = await import('./keboolaApi');
        const api = new KeboolaApi({ apiUrl: project.stackUrl, token });
        const result = await api.testConnection();
        if (!result.success) {
            throw new Error(`Connection failed: ${result.error}`);
        }
        return result.tokenInfo;
    }
} 