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
            
            // Load tab-specific data
            if (targetTab === 'traces') {
                vscode.postMessage({ command: 'getTraces' });
            } else if (targetTab === 'artifacts') {
                vscode.postMessage({ command: 'getArtifacts' });
            }
        });
    });

    // Action buttons
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const manifestBtn = document.getElementById('manifestBtn');
    const reportBtn = document.getElementById('reportBtn');
    const refreshTracesBtn = document.getElementById('refreshTracesBtn');

    pauseBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'pauseAgent' });
    });

    resumeBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'resumeAgent' });
    });

    stopBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'stopAgent' });
    });

    manifestBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'openManifest' });
    });

    reportBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'exportReport' });
    });

    if (refreshTracesBtn) {
        refreshTracesBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'getTraces' });
        });
    }

    // Message listener
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateState':
                updateAgentState(message.data);
                break;
            case 'agentPaused':
                handleAgentPaused(message.data);
                break;
            case 'agentResumed':
                handleAgentResumed(message.data);
                break;
            case 'agentStopped':
                handleAgentStopped(message.data);
                break;
            case 'tracesLoaded':
                handleTracesLoaded(message.data);
                break;
            case 'artifactsLoaded':
                handleArtifactsLoaded(message.data);
                break;
            case 'hitlApproved':
                handleHITLApproved(message.data);
                break;
            case 'hitlRejected':
                handleHITLRejected(message.data);
                break;
        }
    });

    function updateAgentState(data) {
        const { runState, config, elapsedTime, remainingBudget, isRunning, preset } = data;
        
        // Update agent name
        document.getElementById('agentName').textContent = config.name || 'Agent';
        
        // Update preset badge if available
        const presetBadge = document.getElementById('presetBadge');
        const presetText = document.getElementById('presetText');
        
        if (preset && preset.name) {
            presetText.textContent = preset.name;
            presetBadge.style.display = 'inline-block';
        } else {
            presetBadge.style.display = 'none';
        }
        
        // Update status
        const statusText = document.getElementById('statusText');
        const statusBadge = document.getElementById('statusBadge');
        statusText.textContent = runState.status;
        statusBadge.className = `status-badge status-${runState.status}`;
        
        // Update metrics
        document.getElementById('progressText').textContent = `${runState.progressPct}%`;
        document.getElementById('progressFill').style.width = `${runState.progressPct}%`;
        document.getElementById('confidenceText').textContent = `${runState.confidencePct}%`;
        document.getElementById('budgetText').textContent = `$${runState.spentUSD.toFixed(2)}`;
        document.getElementById('tokensText').textContent = runState.spentTokens.toLocaleString();
        document.getElementById('elapsedText').textContent = elapsedTime;
        
        // Update goal
        document.getElementById('agentGoal').textContent = config.goal || 'No goal specified';
        
        // Update current step
        const currentStep = runState.plannedSteps[runState.currentStepIndex];
        document.getElementById('currentStep').textContent = currentStep ? currentStep.title : 'No current step';
        
        // Update tool calls
        updateToolCalls(runState.toolCalls);
        
        // Update action buttons
        updateActionButtons(runState.status, isRunning);
        
        // Update HITL list
        updateHITLList(runState.hitlRequests);
    }

    function updateToolCalls(toolCalls) {
        const toolCallsList = document.getElementById('toolCallsList');
        toolCallsList.innerHTML = '';
        
        if (Object.keys(toolCalls).length === 0) {
            toolCallsList.innerHTML = '<p>No tool calls yet</p>';
            return;
        }
        
        Object.entries(toolCalls).forEach(([toolName, count]) => {
            const toolCallItem = document.createElement('div');
            toolCallItem.className = 'tool-call-item';
            toolCallItem.innerHTML = `
                <span class="tool-call-name">${toolName}</span>
                <span class="tool-call-count">${count}</span>
            `;
            toolCallsList.appendChild(toolCallItem);
        });
    }

    function updateActionButtons(status, isRunning) {
        pauseBtn.style.display = (status === 'running' && isRunning) ? 'inline-block' : 'none';
        resumeBtn.style.display = (status === 'paused') ? 'inline-block' : 'none';
        stopBtn.style.display = (status === 'running' || status === 'paused' || status === 'waiting_hitl') ? 'inline-block' : 'none';
    }

    function updateHITLList(hitlRequests) {
        const hitlList = document.getElementById('hitlList');
        if (!hitlList) return;
        
        const pendingRequests = hitlRequests.filter(req => req.status === 'pending');
        
        if (pendingRequests.length === 0) {
            hitlList.innerHTML = `
                <div class="empty-state">
                    <h4>No Pending Requests</h4>
                    <p>No HITL requests are currently pending.</p>
                </div>
            `;
            return;
        }
        
        hitlList.innerHTML = '';
        pendingRequests.forEach(request => {
            const hitlItem = document.createElement('div');
            hitlItem.className = 'hitl-item';
            hitlItem.innerHTML = `
                <div class="hitl-question">${request.question}</div>
                <div class="hitl-meta">
                    <span class="hitl-timestamp">${new Date(request.createdAt).toLocaleString()}</span>
                    <span class="hitl-status pending">Pending</span>
                </div>
                <div class="hitl-actions">
                    <button class="btn-primary" onclick="approveHITL('${request.id}')">Approve</button>
                    <button class="btn-danger" onclick="rejectHITL('${request.id}')">Reject</button>
                </div>
            `;
            hitlList.appendChild(hitlItem);
        });
    }

    function handleTracesLoaded(data) {
        const tracesList = document.getElementById('tracesList');
        if (!tracesList) return;
        
        if (data.error) {
            tracesList.innerHTML = `
                <div class="empty-state">
                    <h4>Error Loading Traces</h4>
                    <p>${data.error}</p>
                </div>
            `;
            return;
        }
        
        const { traces, summary } = data;
        
        if (traces.length === 0) {
            tracesList.innerHTML = `
                <div class="empty-state">
                    <h4>No Traces</h4>
                    <p>No trace events have been recorded yet.</p>
                </div>
            `;
            return;
        }
        
        tracesList.innerHTML = '';
        traces.forEach(trace => {
            const traceItem = document.createElement('div');
            traceItem.className = 'trace-item';
            traceItem.innerHTML = `
                <div class="trace-header">
                    <span class="trace-name">${trace.name}</span>
                    <span class="trace-timestamp">${new Date(trace.timestamp).toLocaleString()}</span>
                </div>
                <div class="trace-attributes">
                    ${Object.entries(trace.attributes).map(([key, value]) => 
                        `${key}: ${JSON.stringify(value)}`
                    ).join(' | ')}
                </div>
            `;
            tracesList.appendChild(traceItem);
        });
    }

    function handleArtifactsLoaded(data) {
        const artifactsList = document.getElementById('artifactsList');
        if (!artifactsList) return;
        
        if (data.error) {
            artifactsList.innerHTML = `
                <div class="empty-state">
                    <h4>Error Loading Artifacts</h4>
                    <p>${data.error}</p>
                </div>
            `;
            return;
        }
        
        const { artifacts } = data;
        
        if (artifacts.length === 0) {
            artifactsList.innerHTML = `
                <div class="empty-state">
                    <h4>No Artifacts</h4>
                    <p>No artifacts have been generated yet.</p>
                </div>
            `;
            return;
        }
        
        artifactsList.innerHTML = '';
        artifacts.forEach(artifactPath => {
            const artifactName = artifactPath.split('/').pop();
            const artifactItem = document.createElement('div');
            artifactItem.className = 'artifact-item';
            artifactItem.innerHTML = `
                <div class="artifact-name">${artifactName}</div>
                <div class="artifact-path">${artifactPath}</div>
                <div class="artifact-actions">
                    <button class="btn-secondary" onclick="openArtifact('${artifactPath}')">Open</button>
                </div>
            `;
            artifactsList.appendChild(artifactItem);
        });
    }

    function handleAgentPaused(data) {
        if (data.success) {
            console.log('Agent paused successfully');
        } else {
            console.error('Failed to pause agent:', data.error);
        }
    }

    function handleAgentResumed(data) {
        if (data.success) {
            console.log('Agent resumed successfully');
        } else {
            console.error('Failed to resume agent:', data.error);
        }
    }

    function handleAgentStopped(data) {
        if (data.success) {
            console.log('Agent stopped successfully');
        } else {
            console.error('Failed to stop agent:', data.error);
        }
    }

    function handleHITLApproved(data) {
        if (data.success) {
            console.log('HITL request approved:', data.hitlId);
        } else {
            console.error('Failed to approve HITL:', data.error);
        }
    }

    function handleHITLRejected(data) {
        if (data.success) {
            console.log('HITL request rejected:', data.hitlId);
        } else {
            console.error('Failed to reject HITL:', data.error);
        }
    }

    // Global functions for HITL actions
    window.approveHITL = function(hitlId) {
        vscode.postMessage({
            command: 'approveHITL',
            hitlId: hitlId
        });
    };

    window.rejectHITL = function(hitlId) {
        vscode.postMessage({
            command: 'rejectHITL',
            hitlId: hitlId
        });
    };

    window.openArtifact = function(artifactPath) {
        // This would open the artifact in VS Code
        console.log('Opening artifact:', artifactPath);
    };
}); 