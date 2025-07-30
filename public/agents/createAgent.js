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

    // Load settings and tools on page load
    vscode.postMessage({ command: 'getSettings' });
    vscode.postMessage({ command: 'getAvailableTools' });

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
            policy: {
                maxConcurrentTools: parseInt(document.getElementById('maxConcurrentTools').value) || 3,
                rateLimitPerMin: parseInt(document.getElementById('rateLimit').value) || 10,
                piiHandling: document.getElementById('piiHandling').value,
                escalationOnViolation: 'pause'
            }
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
}); 