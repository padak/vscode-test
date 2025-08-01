# Multi-Project Support Implementation Plan

## 🎯 **Objective**
Implement seamless multi-project support within a single Keboola stack, displaying all projects simultaneously in the tree view rather than requiring project switching.

---

## 📊 **Current Architecture Analysis**

### 🔐 **Authentication & Token Storage**
- **Legacy Storage**: `context.globalState.get('keboola.token')` + `context.globalState.get('keboola.apiUrl')`
- **Multi-Project Storage**: `ProjectManager` with `ProjectCredential[]` in `context.globalState.get('keboola.projects')`
- **Token Security**: Tokens stored in `context.secrets` using `tokenSecretKey`
- **API Instances**: `KeboolaApi` for Storage, `JobsApi` for Jobs, both initialized with same token

### 🌳 **Tree View Architecture**
- **Root Provider**: `ProjectTreeProvider` - manages overall tree structure
- **Sub-Providers**: `KeboolaTreeProvider` (Storage/Configs), `JobsTreeProvider` (Jobs)
- **Project Switching**: Implemented via `MultiProjectApiManager` with project selector UI
- **Current State**: Shows single project with ability to switch between multiple projects

### 🔄 **API Management Flow**
```
Settings Panel → context.globalState → initializeFromSettings() → 
KeboolaApi + JobsApi → KeboolaTreeProvider.setKeboolaApi() → Tree Refresh
```

---

## 📋 **Requirements**

### ✅ **Core Functionality**
1. **Single Stack, Multiple Projects**: All projects must be on the same Keboola stack URL
2. **Parallel Display**: Show all projects simultaneously in tree view (no switching)
3. **Independent Operations**: Each project operates independently (Storage, Configs, Jobs)
4. **Unified Token Management**: Simple token addition/removal interface
5. **Backward Compatibility**: Existing single-project setups continue working

### ✅ **User Experience**
- **Simple Token Addition**: "Add API Token" → automatically detects project → shows in tree
- **Project Identification**: Each project shows name and ID in tree view
- **Independent Sections**: Each project has its own Storage/Configurations/Jobs sections
- **Context Preservation**: Operations clearly indicate which project they affect

---

## 🔧 **Implementation Strategy**

### **1. Data Architecture Changes**

**File: `src/ProjectManager.ts`**
```typescript
// MODIFY: Remove stack URL validation (allow same stack only)
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
    
    // Continue with existing logic...
}
```

### **2. Tree View Architecture Overhaul**

**File: `src/project/ProjectTreeProvider.ts`**
```typescript
// REPLACE: Single project display with multi-project display
async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
        const items: vscode.TreeItem[] = [];
        
        // Add API Status
        items.push(this.apiStatusItem);
        
        // GET ALL PROJECTS and display each
        if (this.multiProjectApiManager) {
            const projects = await this.multiProjectApiManager.getAvailableProjects();
            
            for (const project of projects) {
                const projectNode = new MultiProjectTreeItem(
                    project.name, 
                    project.id,
                    project.stackUrl,
                    project
                );
                items.push(projectNode);
            }
        }
        
        return items;
    }
    
    // Handle individual project expansion
    if (element instanceof MultiProjectTreeItem) {
        return this.getProjectChildren(element.project);
    }
}

private async getProjectChildren(project: ProjectCredential): Promise<vscode.TreeItem[]> {
    // Create Storage, Configurations, Jobs nodes for THIS project
    const api = await this.multiProjectApiManager.getApiForProject(project.id);
    if (!api) return [];
    
    return [
        new ProjectSectionItem('Storage', 'storage', project.id),
        new ProjectSectionItem('Configurations', 'configurations', project.id), 
        new ProjectSectionItem('Jobs', 'jobs', project.id)
    ];
}
```

### **3. New Tree Item Classes**

**File: `src/project/MultiProjectTreeItem.ts` (NEW)**
```typescript
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
        return new vscode.ThemeIcon(icons[type] || 'folder');
    }
}
```

### **4. Context-Aware Data Providers**

**File: `src/KeboolaTreeProvider.ts`**
```typescript
// MODIFY: Add project context to all operations
export class KeboolaTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private currentProjectId?: string;
    
    // ADD: Method to set project context
    setProjectContext(projectId: string): void {
        this.currentProjectId = projectId;
    }
    
    // MODIFY: All API calls to use project-specific API
    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!this.currentProjectId) return [];
        
        const api = await this.multiProjectApiManager.getApiForProject(this.currentProjectId);
        if (!api) return [];
        
        // Continue with existing logic using project-specific API
    }
}
```

### **5. Settings Panel Simplification**

**File: `src/SettingsPanel.ts`**
```typescript
// SIMPLIFY: Keep only essential multi-token UI
private getHtmlContent(): string {
    return `
        <!-- Stack Selection (existing) -->
        <div class="stack-selection">...</div>
        
        <!-- Main Token (existing) -->
        <div class="main-token">...</div>
        
        <!-- Additional Projects (simplified) -->
        <div class="additional-projects">
            <h3>Additional Projects (Same Stack)</h3>
            <p>Add API tokens for other projects on the same stack.</p>
            
            <div id="projectsList">
                <!-- Auto-populated from ProjectManager -->
            </div>
            
            <div class="add-token-section">
                <input type="password" id="newTokenInput" placeholder="Enter API token...">
                <button onclick="addToken()">Add Token</button>
            </div>
        </div>
    `;
}

// STREAMLINE: Token addition flow
private async handleAddToken(token: string): Promise<void> {
    // 1. Test token & get project info
    // 2. Validate same stack
    // 3. Add via ProjectManager
    // 4. Refresh tree view
    // 5. Show success message
}
```

### **6. Command Updates**

**File: `src/extension.ts`**
```typescript
// REMOVE: Project switching commands (no longer needed)
// ADD: Project-specific commands

const showProjectStorageCmd = vscode.commands.registerCommand(
    'keboola.showProjectStorage', 
    async (projectId: string) => {
        // Show storage for specific project
    }
);

const showProjectConfigsCmd = vscode.commands.registerCommand(
    'keboola.showProjectConfigurations',
    async (projectId: string) => {
        // Show configurations for specific project  
    }
);
```

---

## 🎯 **Implementation Phases**

### **Phase 1: Foundation** (2-3 hours)
1. **Modify `ProjectManager`** - enforce same-stack validation
2. **Create new tree item classes** - `MultiProjectTreeItem`, `ProjectSectionItem`
3. **Update `ProjectTreeProvider`** - multi-project display logic

#### **Detailed Steps:**
- [ ] Update `ProjectManager.addProject()` with strict same-stack validation
- [ ] Create `src/project/MultiProjectTreeItem.ts` with new tree item classes
- [ ] Modify `ProjectTreeProvider.getChildren()` to display multiple projects
- [ ] Test basic multi-project tree display

### **Phase 2: Data Providers** (3-4 hours)
1. **Modify `KeboolaTreeProvider`** - add project context
2. **Update `JobsTreeProvider`** - add project context
3. **Implement context switching** - providers work with specific project APIs

#### **Detailed Steps:**
- [ ] Add `setProjectContext()` method to `KeboolaTreeProvider`
- [ ] Modify all data loading methods to use project-specific APIs
- [ ] Update `JobsTreeProvider` with project context support
- [ ] Create project-specific data provider instances
- [ ] Test Storage/Configurations/Jobs data loading per project

### **Phase 3: UI & Commands** (2-3 hours)
1. **Simplify `SettingsPanel`** - clean token addition UI
2. **Update commands** - remove switching, add project-specific commands
3. **Update context menus** - project-aware actions

#### **Detailed Steps:**
- [ ] Simplify Settings Panel HTML and remove complex forms
- [ ] Update token addition flow to be single-input based
- [ ] Remove project switching commands from `extension.ts`
- [ ] Add project-specific commands for Storage/Configs/Jobs
- [ ] Update context menus to show project context
- [ ] Test simplified token addition workflow

### **Phase 4: Testing & Polish** (2-3 hours)
1. **Test multi-project workflows** - add/remove tokens, operations
2. **Validate backward compatibility** - single-project setups
3. **UI polish** - consistent project identification, error handling

#### **Detailed Steps:**
- [ ] Test adding multiple tokens from same stack
- [ ] Test removing tokens and tree view updates
- [ ] Verify single-project setups continue working
- [ ] Add comprehensive error handling with project context
- [ ] Polish tree view icons and descriptions
- [ ] Test all Storage/Configurations/Jobs operations per project
- [ ] Performance testing with multiple projects

---

## 🔍 **Key Technical Considerations**

### **API Management**
- **Caching Strategy**: `MultiProjectApiManager` should cache API instances per project
- **Context Switching**: Data providers must clearly identify which project they're operating on
- **Error Isolation**: Failures in one project shouldn't affect others

### **Tree View Performance**
- **Lazy Loading**: Only load data when project nodes are expanded
- **Refresh Strategy**: Selective refresh per project rather than full tree refresh
- **Memory Management**: Dispose of unused API instances

### **User Experience**
- **Visual Hierarchy**: Clear project boundaries in tree view
- **Context Indicators**: All operations should clearly show which project they affect
- **Error Messages**: Project-specific error messages with clear identification

---

## ✅ **Success Criteria**

1. **Multiple projects displayed simultaneously** in tree view
2. **Independent operation** of each project's Storage/Configs/Jobs
3. **Simple token addition** workflow (paste token → auto-detect → add to tree)
4. **Same-stack enforcement** (cannot mix different Keboola stacks)
5. **Backward compatibility** (existing single-project setups work unchanged)
6. **Clear project identification** throughout the UI
7. **Robust error handling** with project-specific context

---

## 📁 **File Structure Changes**

### **New Files:**
- `src/project/MultiProjectTreeItem.ts` - New tree item classes
- `src/project/ProjectSectionItem.ts` - Section-specific tree items (optional separate file)

### **Modified Files:**
- `src/ProjectManager.ts` - Enhanced same-stack validation
- `src/project/ProjectTreeProvider.ts` - Multi-project tree display
- `src/KeboolaTreeProvider.ts` - Project context support
- `src/jobs/JobsTreeProvider.ts` - Project context support
- `src/SettingsPanel.ts` - Simplified token management UI
- `src/extension.ts` - Updated commands and initialization

### **Removed Features:**
- Project switching commands (`keboola.switchProject`, `keboola.selectProject`)
- Project selector UI in tree view
- Complex multi-project forms in Settings Panel

---

## 🚀 **Implementation Notes**

- **Start with Phase 1** to establish the foundation
- **Test each phase thoroughly** before moving to the next
- **Maintain existing functionality** during development
- **Use TypeScript strictly** for type safety across project contexts
- **Add comprehensive logging** for debugging multi-project operations

### **Development Tips:**
1. **Create feature branch**: `git checkout -b feature/multi-project-display`
2. **Incremental commits**: Commit after each major change for easy rollback
3. **Test with real data**: Use actual Keboola projects for testing
4. **Performance monitoring**: Watch for memory leaks with multiple API instances
5. **User feedback**: Get early feedback on tree view organization

---

## 🎯 **Expected Outcome**

Transform the extension from a "single project with switching" model to a "multiple projects simultaneously" model, providing a much more efficient workflow for users managing multiple Keboola projects within the same stack.

### **Before:**
```
📁 Keboola Explorer
├── 🏢 Current Project: My Project (switch to see others)
├── 📊 My Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations  
│   └── ▶️ Jobs
```

### **After:**
```
📁 Keboola Explorer
├── 📊 Production Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
├── 📊 Staging Project  
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
├── 📊 Development Project
│   ├── 🗄️ Storage
│   ├── ⚙️ Configurations
│   └── ▶️ Jobs
```

This approach eliminates the need for project switching and provides immediate access to all projects simultaneously, significantly improving developer productivity.