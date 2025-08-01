import * as vscode from 'vscode';
import { ProjectCredential } from '../ProjectManager';

export class MultiProjectTreeItem extends vscode.TreeItem {
    constructor(
        public readonly projectName: string,
        public readonly projectId: string,
        public readonly stackUrl: string,
        public readonly project: ProjectCredential
    ) {
        super(projectName, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.description = projectId;
        this.tooltip = `${projectName} (${projectId})\n${stackUrl}`;
        this.iconPath = new vscode.ThemeIcon('database');
        this.contextValue = 'project-root';
    }
}

export class ProjectSectionItem extends vscode.TreeItem {
    constructor(
        public readonly sectionName: string,
        public readonly sectionType: 'storage' | 'configurations' | 'jobs',
        public readonly projectId: string
    ) {
        super(sectionName, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.contextValue = `project-${sectionType}`;
        this.iconPath = this.getSectionIcon(sectionType);
    }
    
    private getSectionIcon(type: string): vscode.ThemeIcon {
        const icons = {
            storage: 'database',
            configurations: 'settings-gear', 
            jobs: 'play'
        };
        return new vscode.ThemeIcon(icons[type as keyof typeof icons] || 'folder');
    }
}