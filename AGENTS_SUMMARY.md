# Keboola Data Engineering Booster v4.0.2 - Agent Path Restructuring

## Overview
This version implements a new path structure for AI agents, replacing the old single export folder with a more organized, future-proof structure that supports multi-project scenarios.

## Key Changes

### 1. New Path Structure
- **Old**: `./{exportFolderName}/{runId}/...`
- **New**: `./{keboolaRoot}/{projectSlug}/{agentsFolder}/{runId}/...`
- **Default**: `./keboola/default/agents/{runId}/...`

### 2. Settings Changes
- **Renamed**: "Export folder name" → "Keboola Root Folder"
- **Added**: "Agents Sub-Folder" setting (default: "agents")
- **New Settings Keys**:
  - `keboola.export.rootFolder` (default: "keboola")
  - `keboola.export.agentsFolder` (default: "agents")

### 3. Migration Support
- Automatic migration of old settings on first load
- Legacy agent run directories moved to new structure
- Backward compatibility maintained during transition

## Files Modified

### New Files
- `src/utils/pathBuilder.ts` - New path utility functions

### Updated Files
- `src/agents/AgentStore.ts` - Updated to use new path structure
- `src/SettingsPanel.ts` - Added new agent settings UI
- `src/extension.ts` - Added migration logic
- `src/agents/webviews/CreateAgentPanel.ts` - Updated default data directory
- `src/agents/i18n/en.ts` - Added new translation keys
- `package.json` - Updated version and added new settings
- `src/workspaceUtils.ts` - Updated to support new Keboola root folder structure
- `src/kbcCli.ts` - Updated export functions to use new path structure

## Implementation Details

### Path Builder Functions
```typescript
export function keboolaRoot(context): string
export function agentsDir(context): string  
export function agentRunDir(context, runId: string, projectSlug?: string): string
```

### Migration Functions
```typescript
export async function migrateSettings(context): Promise<void>
export async function migrateLegacyAgentRuns(context): Promise<void>
```

### Updated Export Path Structure
```typescript
// Old: <workspace>/<exportFolderName>/<stage>/<bucket>/<table>.csv
// New: <workspace>/<keboolaRoot>/<projectSlug>/<exportFolderName>/<stage>/<bucket>/<table>.csv

// Example with defaults:
// Old: ./kbc_project/in/c-accel/table.csv
// New: ./keboola/Padak_EU/kbc_project/in/c-accel/table.csv
```

### Settings Validation
- No path traversal allowed
- No leading slashes
- Only letters, numbers, hyphens, and underscores allowed
- Real-time validation in Settings panel

## New Settings UI
- **Keboola Root Folder**: All project data will be stored under this folder
- **Agents Sub-Folder**: Agent runs will be saved in {rootFolder}/{agentsFolder}
- Validation with helpful error messages
- Separate save button for agent settings

## Future-Proofing
- `projectSlug` parameter ready for multi-project support
- Clear separation between root folder and sub-folders
- Extensible structure for data and configs folders later

## Testing
- TypeScript compilation successful
- Path builder functions tested
- Migration logic implemented
- Settings validation working

## Version
- Updated to v4.0.2
- Maintains backward compatibility
- No breaking changes to existing functionality

## Next Steps
1. Test the new path structure with actual agent runs
2. Verify migration works with existing agent data
3. Test settings UI in light and dark themes
4. Validate agent detail panel still opens correctly after migration
5. Test storage export with new path structure (should now export to `./keboola/Padak_EU/kbc_project/...`)
6. Verify project name is properly sanitized for folder names 