#!/usr/bin/env node

/**
 * Simple test script for the Keboola AI Agents demo module
 * This script can be run to verify that the agents system is working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Keboola AI Agents Demo Module...\n');

// Test 1: Check if the extension compiles
console.log('1. Checking TypeScript compilation...');
try {
    const { execSync } = require('child_process');
    execSync('npm run compile', { stdio: 'pipe' });
    console.log('✅ TypeScript compilation successful');
} catch (error) {
    console.log('❌ TypeScript compilation failed:', error.message);
    process.exit(1);
}

// Test 2: Check if all required files exist
console.log('\n2. Checking required files...');
const requiredFiles = [
    'src/agents/AgentStore.ts',
    'src/agents/AgentRuntime.ts',
    'src/agents/AgentsTreeProvider.ts',
    'src/agents/AgentPolicy.ts',
    'src/agents/AgentTraces.ts',
    'src/agents/types.ts',
    'src/agents/webviews/CreateAgentPanel.ts',
    'src/agents/webviews/AgentDetailPanel.ts',
    'public/agents/createAgent.js',
    'public/agents/createAgent.css',
    'public/agents/agentDetail.js',
    'public/agents/agentDetail.css'
];

let allFilesExist = true;
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
    }
}

if (!allFilesExist) {
    console.log('\n❌ Some required files are missing');
    process.exit(1);
}

// Test 3: Check package.json configuration
console.log('\n3. Checking package.json configuration...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check if agents view is defined
    const agentsView = packageJson.contributes.views['keboola-storage'].find(
        view => view.id === 'keboolaAgents'
    );
    
    if (agentsView) {
        console.log('✅ Agents view configured in package.json');
    } else {
        console.log('❌ Agents view not found in package.json');
        process.exit(1);
    }
    
    // Check if agent commands are defined
    const commands = packageJson.contributes.commands || [];
    const commandPalette = packageJson.contributes.menus['commandPalette'] || [];
    const allCommands = [...commands, ...commandPalette];
    const agentCommands = allCommands.filter(
        cmd => cmd.command && cmd.command.startsWith('keboola.agents.')
    );
    
    if (agentCommands.length > 0) {
        console.log(`✅ ${agentCommands.length} agent commands configured`);
        agentCommands.forEach(cmd => console.log(`   - ${cmd.command}`));
    } else {
        console.log('❌ No agent commands found in package.json');
        console.log('Available commands:', commands.map(cmd => cmd.command).join(', '));
        process.exit(1);
    }
    
    // Check if agent settings are defined
    const agentSettings = Object.keys(packageJson.contributes.configuration.properties)
        .filter(key => key.startsWith('keboola.agents.'));
    
    if (agentSettings.length > 0) {
        console.log(`✅ ${agentSettings.length} agent settings configured`);
    } else {
        console.log('❌ No agent settings found in package.json');
        process.exit(1);
    }
    
} catch (error) {
    console.log('❌ Failed to parse package.json:', error.message);
    process.exit(1);
}

// Test 4: Check if the extension integrates agents properly
console.log('\n4. Checking extension integration...');
try {
    const extensionTs = fs.readFileSync('src/extension.ts', 'utf8');
    
    const requiredImports = [
        'AgentsTreeProvider',
        'AgentStore',
        'AgentRuntime',
        'CreateAgentPanel',
        'AgentDetailPanel'
    ];
    
    let allImportsFound = true;
    for (const importName of requiredImports) {
        if (extensionTs.includes(importName)) {
            console.log(`✅ ${importName} imported`);
        } else {
            console.log(`❌ ${importName} not imported`);
            allImportsFound = false;
        }
    }
    
    if (!allImportsFound) {
        console.log('❌ Some required imports are missing');
        process.exit(1);
    }
    
    // Check if agents are initialized
    if (extensionTs.includes('initializeAgentsSystem')) {
        console.log('✅ Agents system initialization found');
    } else {
        console.log('❌ Agents system initialization not found');
        process.exit(1);
    }
    
} catch (error) {
    console.log('❌ Failed to check extension integration:', error.message);
    process.exit(1);
}

console.log('\n🎉 All tests passed! The AI Agents demo module is ready.');
console.log('\n📋 Next steps:');
console.log('1. Open VS Code with this extension');
console.log('2. Go to the Keboola Platform activity bar');
console.log('3. Click on "AI Agents" view');
console.log('4. Use "Keboola: Create Demo Agent" command to test');
console.log('5. Explore the agent management features'); 