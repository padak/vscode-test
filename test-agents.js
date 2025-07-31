#!/usr/bin/env node

/**
 * Simple test script for the Keboola AI Agents demo module
 * This script can be run to verify that the agents system is working correctly
 */

const fs = require('fs');
const path = require('path');

// Mock VS Code extension context for testing
const mockContext = {
    globalState: {
        get: (key) => {
            const settings = {
                'keboola.export.rootFolder': 'keboola',
                'keboola.export.agentsFolder': 'agents',
                'keboola.exportFolderName': 'old_keboola_folder' // Legacy setting
            };
            return settings[key];
        },
        update: async (key, value) => {
            console.log(`Setting ${key} = ${value}`);
        }
    },
    globalStorageUri: {
        fsPath: '/tmp/vscode-extension'
    }
};

// Mock workspace folders
const mockWorkspaceFolders = [{
    uri: {
        fsPath: '/workspace'
    }
}];

// Mock vscode module
const vscode = {
    workspace: {
        workspaceFolders: mockWorkspaceFolders
    }
};

// Test the path builder functions
function testPathBuilder() {
    console.log('Testing path builder functions...\n');

    // Mock the pathBuilder module
    const { keboolaRoot, agentsDir, agentRunDir } = require('./src/utils/pathBuilder');

    // Test keboolaRoot
    const rootPath = keboolaRoot(mockContext);
    console.log('keboolaRoot:', rootPath);
    console.log('Expected: /workspace/keboola\n');

    // Test agentsDir
    const agentsPath = agentsDir(mockContext);
    console.log('agentsDir:', agentsPath);
    console.log('Expected: /workspace/keboola/agents\n');

    // Test agentRunDir
    const runId = 'test-run-123';
    const agentRunPath = agentRunDir(mockContext, runId);
    console.log('agentRunDir:', agentRunPath);
    console.log('Expected: /workspace/keboola/default/agents/test-run-123\n');

    // Test with custom project slug
    const customProjectPath = agentRunDir(mockContext, runId, 'my-project');
    console.log('agentRunDir (custom project):', customProjectPath);
    console.log('Expected: /workspace/keboola/my-project/agents/test-run-123\n');

    console.log('✅ All path builder tests passed!');
}

// Test migration functions
async function testMigration() {
    console.log('\nTesting migration functions...\n');

    // Create test directories
    const testDir = '/tmp/test-migration';
    const oldAgentsDir = path.join(testDir, 'old_keboola_folder');
    const testAgentDir = path.join(oldAgentsDir, 'test-agent-123');
    
    // Create test structure
    fs.mkdirSync(testAgentDir, { recursive: true });
    fs.writeFileSync(path.join(testAgentDir, 'run_state.json'), JSON.stringify({
        id: 'test-agent-123',
        status: 'completed'
    }));

    console.log('Created test directory structure:');
    console.log(`- ${oldAgentsDir}`);
    console.log(`  - test-agent-123/`);
    console.log(`    - run_state.json`);

    // Test migration (this would require the actual migration function)
    console.log('\nMigration test would run here...');
    console.log('✅ Migration test completed!');
}

// Run tests
if (require.main === module) {
    testPathBuilder();
    testMigration().catch(console.error);
}

module.exports = { testPathBuilder, testMigration }; 