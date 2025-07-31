const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab pane
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Form elements
    const validateBtn = document.getElementById('validateBtn');
    const createBtn = document.getElementById('createBtn');
    const validationResult = document.getElementById('validationResult');

    // Validate button click
    validateBtn.addEventListener('click', () => {
        const formData = getFormData();
        vscode.postMessage({
            command: 'validateAgent',
            data: formData
        });
    });

    // Create button click
    createBtn.addEventListener('click', () => {
        const formData = getFormData();
        vscode.postMessage({
            command: 'createAgent',
            data: formData
        });
    });

    // Load settings, tools, presets, and projects on page load
    vscode.postMessage({ command: 'getSettings' });
    vscode.postMessage({ command: 'getAvailableTools' });
    vscode.postMessage({ command: 'getPresets' });
    vscode.postMessage({ command: 'getAvailableProjects' });

    // Message listener
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'validationResult':
                handleValidationResult(message.data);
                break;
            case 'agentCreated':
                handleAgentCreated(message.data);
                break;
            case 'settingsLoaded':
                handleSettingsLoaded(message.data);
                break;
            case 'toolsLoaded':
                handleToolsLoaded(message.data);
                break;
            case 'presetsLoaded':
                handlePresetsLoaded(message.data);
                break;
            case 'presetSelected':
                handlePresetSelected(message.data);
                break;
            case 'availableProjectsLoaded':
                handleProjectsLoaded(message.projects);
                break;
        }
    });

    function getFormData() {
        return {
            name: document.getElementById('agentName').value,
            goal: document.getElementById('agentGoal').value,
            systemPrompt: document.getElementById('systemPrompt').value,
            selectedLLM: document.getElementById('selectedLLM').value,
            budgetUSD: parseFloat(document.getElementById('budgetUSD').value) || 10.0,
            tokenBudget: parseInt(document.getElementById('tokenBudget').value) || 0,
            timeLimitSec: parseInt(document.getElementById('timeLimit').value) || 3600,
            maxConcurrentTools: parseInt(document.getElementById('maxConcurrentTools').value) || 3,
            rateLimitPerMin: parseInt(document.getElementById('rateLimit').value) || 10,
            piiHandling: document.getElementById('piiHandling').value,
            contactPolicy: document.getElementById('contactPolicy').value,
            hitlTimeoutSec: parseInt(document.getElementById('hitlTimeout').value) || 300,
            hitlFallback: document.getElementById('hitlFallback').value,
            allowedTools: getSelectedTools(),
            projects: getSelectedProjects(),
            defaultProjectId: getDefaultProjectId(),
            policy: {
                maxConcurrentTools: parseInt(document.getElementById('maxConcurrentTools').value) || 3,
                rateLimitPerMin: parseInt(document.getElementById('rateLimit').value) || 10,
                piiHandling: document.getElementById('piiHandling').value,
                allowProjects: getSelectedProjectIds(),
                escalationOnViolation: 'pause'
            },
            presetId: getSelectedPresetId()
        };
    }

    function getSelectedTools() {
        const toolCheckboxes = document.querySelectorAll('.tool-item input[type="checkbox"]:checked');
        return Array.from(toolCheckboxes).map(cb => cb.value);
    }

    function handleValidationResult(data) {
        if (data.success) {
            showValidationSuccess(data.plan, data.estimatedCost);
            createBtn.disabled = false;
        } else {
            showValidationError(data.error);
            createBtn.disabled = true;
        }
    }

    function handleAgentCreated(data) {
        if (data.success) {
            showSuccess('Agent created successfully!');
            // The panel will be closed by the extension
        } else {
            showError('Failed to create agent: ' + data.error);
        }
    }

    function handleSettingsLoaded(settings) {
        // Apply default settings to form
        if (settings.defaultModel) {
            document.getElementById('selectedLLM').value = settings.defaultModel;
        }
        if (settings.defaultBudgetUSD) {
            document.getElementById('budgetUSD').value = settings.defaultBudgetUSD;
        }
        if (settings.defaultTokenBudget) {
            document.getElementById('tokenBudget').value = settings.defaultTokenBudget;
        }
        if (settings.defaultTimeLimitSec) {
            document.getElementById('timeLimit').value = settings.defaultTimeLimitSec;
        }
    }

    function handleToolsLoaded(tools) {
        const toolsList = document.getElementById('toolsList');
        toolsList.innerHTML = '';
        
        tools.forEach(tool => {
            const toolItem = document.createElement('div');
            toolItem.className = 'tool-item';
            toolItem.innerHTML = `
                <input type="checkbox" id="tool_${tool.id}" value="${tool.id}">
                <div class="tool-info">
                    <div class="tool-name">${tool.name}</div>
                    <div class="tool-description">${tool.description || ''}</div>
                </div>
            `;
            toolsList.appendChild(toolItem);
        });
    }

    function showValidationSuccess(plan, estimatedCost) {
        validationResult.className = 'validation-result validation-success';
        validationResult.style.display = 'block';
        
        let stepsHtml = '';
        plan.steps.forEach(step => {
            stepsHtml += `
                <div class="plan-step">
                    <div class="step-title">${step.title}</div>
                    <div class="step-details">
                        Type: ${step.kind} | 
                        Est. Tokens: ${step.estTokens || 0} | 
                        Est. Cost: $${(step.estUSD || 0).toFixed(4)}
                    </div>
                </div>
            `;
        });

        validationResult.innerHTML = `
            <h4>Validation Successful</h4>
            <p>The agent understands your goal and has created a plan.</p>
            
            <div class="plan-steps">
                <h5>Planned Steps (${plan.totalSteps})</h5>
                ${stepsHtml}
            </div>
            
            <div class="cost-summary">
                <h5>Cost Estimate</h5>
                <div class="cost-item">
                    <span class="cost-label">Estimated Tokens:</span>
                    <span class="cost-value">${plan.estimatedTokens.toLocaleString()}</span>
                </div>
                <div class="cost-item">
                    <span class="cost-label">Estimated Cost:</span>
                    <span class="cost-value">$${plan.estimatedUSD.toFixed(4)}</span>
                </div>
            </div>
        `;
    }

    function showValidationError(error) {
        validationResult.className = 'validation-result validation-error';
        validationResult.style.display = 'block';
        validationResult.innerHTML = `
            <h4>Validation Failed</h4>
            <p>${error}</p>
        `;
    }

    function showSuccess(message) {
        // Could implement a toast notification here
        console.log('Success:', message);
    }

    function showError(message) {
        // Could implement a toast notification here
        console.error('Error:', message);
    }

    function handlePresetsLoaded(presets) {
        const presetsList = document.getElementById('presetsList');
        presetsList.innerHTML = '';
        
        presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.setAttribute('data-preset-id', preset.id);
            presetItem.innerHTML = `
                <div class="preset-header">
                    <div class="preset-icon">${getPresetIcon(preset.icon)}</div>
                    <div class="preset-info">
                        <div class="preset-name">${preset.name}</div>
                        <div class="preset-description">${preset.shortDescription}</div>
                    </div>
                    <div class="preset-select">
                        <input type="radio" name="preset" value="${preset.id}" id="preset_${preset.id}">
                    </div>
                </div>
            `;
            
            // Add click handler for the entire preset item
            presetItem.addEventListener('click', () => {
                document.getElementById(`preset_${preset.id}`).checked = true;
                selectPreset(preset.id);
            });
            
            presetsList.appendChild(presetItem);
        });
    }

    function handlePresetSelected(preset) {
        // Pre-fill form with preset data
        if (preset.defaultConfig) {
            if (preset.defaultConfig.name) {
                document.getElementById('agentName').value = preset.defaultConfig.name;
            }
            if (preset.defaultConfig.goal) {
                document.getElementById('agentGoal').value = preset.defaultConfig.goal;
            }
            if (preset.defaultConfig.systemPrompt) {
                document.getElementById('systemPrompt').value = preset.defaultConfig.systemPrompt;
            }
            if (preset.defaultConfig.selectedLLM) {
                document.getElementById('selectedLLM').value = preset.defaultConfig.selectedLLM;
            }
            if (preset.defaultConfig.budgetUSD) {
                document.getElementById('budgetUSD').value = preset.defaultConfig.budgetUSD;
            }
            if (preset.defaultConfig.tokenBudget) {
                document.getElementById('tokenBudget').value = preset.defaultConfig.tokenBudget;
            }
            if (preset.defaultConfig.timeLimitSec) {
                document.getElementById('timeLimit').value = preset.defaultConfig.timeLimitSec;
            }
            if (preset.defaultConfig.contactPolicy) {
                document.getElementById('contactPolicy').value = preset.defaultConfig.contactPolicy;
            }
            if (preset.defaultConfig.hitlTimeoutSec) {
                document.getElementById('hitlTimeout').value = preset.defaultConfig.hitlTimeoutSec;
            }
            if (preset.defaultConfig.hitlFallback) {
                document.getElementById('hitlFallback').value = preset.defaultConfig.hitlFallback;
            }
        }

        // Apply policy settings
        if (preset.defaultPolicy) {
            document.getElementById('maxConcurrentTools').value = preset.defaultPolicy.maxConcurrentTools;
            document.getElementById('rateLimit').value = preset.defaultPolicy.rateLimitPerMin;
            document.getElementById('piiHandling').value = preset.defaultPolicy.piiHandling;
        }

        // Show planned steps preview
        showPlannedStepsPreview(preset.plannedSteps);
    }

    function selectPreset(presetId) {
        vscode.postMessage({
            command: 'selectPreset',
            data: { presetId: presetId }
        });
    }

    function getSelectedPresetId() {
        const selectedPreset = document.querySelector('input[name="preset"]:checked');
        return selectedPreset ? selectedPreset.value : null;
    }

    function getPresetIcon(iconName) {
        const iconMap = {
            'shield-check': '🛡️',
            'stethoscope': '🏥',
            'code': '💻',
            'graph': '📊',
            'pipeline': '🔧'
        };
        return iconMap[iconName] || '🤖';
    }

    function showPlannedStepsPreview(plannedSteps) {
        const previewDiv = document.getElementById('presetPreview');
        const stepsPreview = document.getElementById('plannedStepsPreview');
        
        if (plannedSteps && plannedSteps.length > 0) {
            let stepsHtml = '';
            plannedSteps.forEach((step, index) => {
                const hitlMarker = step.kind === 'message' ? ' <span class="hitl-marker">HITL</span>' : '';
                stepsHtml += `
                    <div class="planned-step">
                        <div class="step-number">${index + 1}</div>
                        <div class="step-content">
                            <div class="step-title">${step.title}${hitlMarker}</div>
                            <div class="step-type">${step.kind}</div>
                        </div>
                    </div>
                `;
            });
            
            stepsPreview.innerHTML = stepsHtml;
            previewDiv.style.display = 'block';
        } else {
            previewDiv.style.display = 'none';
        }
    }

    // Project handling functions
    function handleProjectsLoaded(projects) {
        const defaultProjectSelect = document.getElementById('defaultProject');
        const projectsList = document.getElementById('projectsList');
        
        // Populate default project dropdown
        defaultProjectSelect.innerHTML = '<option value="">Select default project...</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.name} (${project.id})`;
            if (project.default) {
                option.selected = true;
            }
            defaultProjectSelect.appendChild(option);
        });
        
        // Populate projects list with checkboxes
        projectsList.innerHTML = '';
        projects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.innerHTML = `
                <label class="project-checkbox">
                    <input type="checkbox" name="project" value="${project.id}" ${project.default ? 'checked' : ''}>
                    <span class="project-name">${project.name}</span>
                    <span class="project-id">(${project.id})</span>
                    ${project.default ? '<span class="default-badge">Default</span>' : ''}
                </label>
            `;
            projectsList.appendChild(projectItem);
        });
    }

    function getSelectedProjects() {
        const selectedProjects = [];
        const projectCheckboxes = document.querySelectorAll('input[name="project"]:checked');
        projectCheckboxes.forEach(checkbox => {
            const projectId = checkbox.value;
            // For now, we'll use the project ID as both id and name
            // In a real implementation, you'd want to store the full project context
            selectedProjects.push({
                id: projectId,
                name: projectId, // This should be the actual project name
                stackUrl: '', // This should be the actual stack URL
                tokenSecretKey: `keboola.token.${projectId}`,
                default: checkbox.checked && document.getElementById('defaultProject').value === projectId
            });
        });
        return selectedProjects;
    }

    function getDefaultProjectId() {
        return document.getElementById('defaultProject').value || 'default';
    }

    function getSelectedProjectIds() {
        const selectedProjects = [];
        const projectCheckboxes = document.querySelectorAll('input[name="project"]:checked');
        projectCheckboxes.forEach(checkbox => {
            selectedProjects.push(checkbox.value);
        });
        return selectedProjects.length > 0 ? selectedProjects : undefined;
    }
}); 