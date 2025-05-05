// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    const apiKey = localStorage.getItem('hiveApiKey');
    if (!apiKey) {
        // Redirecionar para a página de login se não houver API key
        window.location.href = 'login.html';
        return;
    }
    
    // Verificar se a API key é válida
    fetch('/api/status', {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    })
    .then(response => {
        if (!response.ok) {
            // API key inválida, redirecionar para login
            localStorage.removeItem('hiveApiKey');
            window.location.href = 'login.html';
        } else {
            // API key válida, inicializar a página
            initPage();
        }
    })
    .catch(err => {
        console.error('Erro ao verificar autenticação:', err);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
    });
});

// Função para logout
function logout() {
    localStorage.removeItem('hiveApiKey');
    window.location.href = 'login.html';
}

// DOM Elements
let elements;

// Get clientId from URL
const urlParams = new URLSearchParams(window.location.search);
const clientId = urlParams.get('id');

// API URL
const apiUrl = localStorage.getItem('apiUrl') || 'http://localhost:3000';

// State
const state = {
    instance: null,
    qrCodeCheckInterval: null,
    statusCheckInterval: null
};

// Get API authentication header
function getAuthHeader() {
    const apiKey = localStorage.getItem('hiveApiKey');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
}

// Initialize page
async function initPage() {
    if (!clientId) {
        showAlert('Error', 'No instance ID provided. Redirecting to dashboard...');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return;
    }
    
    // Initialize DOM elements
    elements = {
        instanceName: document.getElementById('instance-name'),
        statusBadge: document.getElementById('status-badge'),
        qrContainer: document.getElementById('qr-container'),
        qrCodePlaceholder: document.getElementById('qr-code-placeholder'),
        reconnectBtn: document.getElementById('btn-reconnect'),
        logoutBtn: document.getElementById('btn-logout'),
        deleteBtn: document.getElementById('btn-delete'),
        tabs: document.querySelectorAll('.instance-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        lastUpdated: document.getElementById('instance-last-updated'),
        creationDate: document.getElementById('creation-date'),
        lastConnected: document.getElementById('last-connected'),
        connectionStatus: document.getElementById('connection-status'),
        instanceLogs: document.getElementById('instance-logs'),
        alertModal: document.getElementById('alert-modal'),
        alertTitle: document.getElementById('alert-title'),
        alertMessage: document.getElementById('alert-message'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebar: document.querySelector('.sidebar'),
        refreshQrBtn: document.getElementById('refresh-qr'),
        ignoreGroups: document.getElementById('ignore-groups'),
        webhookUrl: document.getElementById('webhook-url'),
        saveSettings: document.getElementById('save-settings')
    };
    
    elements.instanceName.textContent = clientId;
    
    // Set up tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            activateTab(tabName);
        });
    });
    
    // Set up action buttons
    elements.reconnectBtn.addEventListener('click', reconnectInstance);
    elements.logoutBtn.addEventListener('click', logoutInstance);
    elements.deleteBtn.addEventListener('click', deleteInstance);
    
    // Setup refresh QR button
    elements.refreshQrBtn.addEventListener('click', fetchQrCode);
    
    // Setup save settings button
    elements.saveSettings.addEventListener('click', saveInstanceSettings);

    // Set up mobile sidebar toggle
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('expanded');
    });
    
    // Setup close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', e => {
            closeModal(e.target.closest('.modal'));
        });
    });
    
    // Start data loading
    await loadInstanceData();
    
    // Set up periodic status check
    state.statusCheckInterval = setInterval(checkInstanceStatus, 10000); // Check every 10 seconds
}

// Load instance data
async function loadInstanceData() {
    try {
        // Primeiro, buscar da lista de instâncias para obter todas as configurações
        const instancesResponse = await fetch(`${apiUrl}/api/whatsapp/instances`, {
            headers: getAuthHeader()
        });
        
        if (!instancesResponse.ok) {
            throw new Error(`Failed to load instances data: ${instancesResponse.status} ${instancesResponse.statusText}`);
        }
        
        const instancesData = await instancesResponse.json();
        
        if (instancesData.success) {
            // Encontrar a instância atual na lista
            const currentInstance = instancesData.instances.find(instance => instance.id === clientId);
            
            if (currentInstance) {
                // Agora buscar o status mais recente da instância
                const statusResponse = await fetch(`${apiUrl}/api/whatsapp/status?clientId=${clientId}`, {
                    headers: getAuthHeader()
                });
                
                if (!statusResponse.ok) {
                    throw new Error(`Failed to load status data: ${statusResponse.status} ${statusResponse.statusText}`);
                }
                
                const statusData = await statusResponse.json();
                
                if (statusData.success) {
                    // Combinar os dados de configuração com os dados de status
                    const combinedData = {
                        ...statusData,
                        config: currentInstance.config
                    };
                    
                    updateInstanceData(combinedData);
                } else {
                    throw new Error(statusData.error || 'Failed to load status data');
                }
            } else {
                throw new Error(`Instance ${clientId} not found`);
            }
        } else {
            throw new Error(instancesData.error || 'Failed to load instances data');
        }
    } catch (error) {
        console.error('Error loading instance data:', error);
        showAlert('Connection Error', 'Failed to connect to the API: ' + error.message);
    }
}

// Update instance data in the UI
function updateInstanceData(data) {
    state.instance = data;
    
    // Update status badge
    const isConnected = data.connected;
    elements.statusBadge.textContent = isConnected ? 'Connected' : 'Disconnected';
    elements.statusBadge.className = `status-badge ${isConnected ? 'status-connected' : 'status-disconnected'}`;
    
    // Update connection status
    elements.connectionStatus.textContent = data.status || (isConnected ? 'Connected' : 'Disconnected');
    
    // Update settings if available
    if (data.config) {
        // Update ignore groups checkbox
        if (data.config.ignoreGroups !== undefined) {
            elements.ignoreGroups.checked = data.config.ignoreGroups;
        }
        // Update webhook URL
        if (data.config.webhookUrl !== undefined) {
            elements.webhookUrl.value = data.config.webhookUrl;
        }
    }
    
    // Show/hide QR code container based on connection status
    if (!isConnected) {
        elements.qrContainer.style.display = 'flex';
        fetchQrCode();
        
        // Start QR code refresh interval if not connected
        if (!state.qrCodeCheckInterval) {
            state.qrCodeCheckInterval = setInterval(fetchQrCode, 20000); // Refresh QR every 20 seconds
        }
    } else {
        elements.qrContainer.style.display = 'none';
        // Clear QR check interval if connected
        if (state.qrCodeCheckInterval) {
            clearInterval(state.qrCodeCheckInterval);
            state.qrCodeCheckInterval = null;
        }
    }
    
    // Update last updated time
    elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// Fetch QR code for the instance
async function fetchQrCode() {
    try {
        // Mostrar spinner de carregamento
        elements.qrCodePlaceholder.innerHTML = `
            <div style="text-align: center; margin: 20px 0;">
                <div class="spinner"></div>
                <p style="margin-top: 10px;">Carregando código QR...</p>
            </div>
        `;
        
        // Tentar primeiro com o endpoint JSON que retorna dados do QR code
        const timestamp = new Date().getTime();
        const response = await fetch(`${apiUrl}/api/whatsapp/qr?clientId=${clientId}&t=${timestamp}`, {
            headers: getAuthHeader()
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar QR code: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'QR code não disponível');
        }
        
        if (result.qrCode) {
            // Se temos o código QR, exibir usando a URL de dados
            elements.qrCodePlaceholder.innerHTML = `
                <img 
                    src="${result.qrCode}" 
                    alt="Código QR para WhatsApp" 
                    style="max-width: 250px; height: auto;"
                >
            `;
            return;
        }
        
        // Se chegamos aqui, não temos QR code disponível
        elements.qrCodePlaceholder.innerHTML = `
            <div style="text-align: center; margin: 20px 0;">
                <p>QR code não está disponível no momento.</p>
                <button onclick="reconnectInstance()" class="btn primary" style="margin-top: 10px;">
                    <i class="fas fa-sync"></i> Reconectar instância
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('Erro ao buscar QR code:', error);
        elements.qrCodePlaceholder.innerHTML = `
            <div style="text-align: center; margin: 20px 0;">
                <p>Erro ao carregar o código QR: ${error.message}</p>
                <div style="margin-top: 10px;">
                    <button onclick="fetchQrCode()" class="btn secondary" style="margin-right: 10px;">
                        <i class="fas fa-sync"></i> Tentar novamente
                    </button>
                    <button onclick="reconnectInstance()" class="btn primary">
                        <i class="fas fa-plug"></i> Reconectar instância
                    </button>
                </div>
            </div>
        `;
    }
}

// Check instance status
async function checkInstanceStatus() {
    try {
        const response = await fetch(`${apiUrl}/api/whatsapp/status?clientId=${clientId}`, {
            headers: getAuthHeader()
        });
        const data = await response.json();
        
        if (data.success) {
            // If status changed from disconnected to connected or vice versa
            if (state.instance && state.instance.connected !== data.connected) {
                // Reload full data
                updateInstanceData(data);
                
                // Add log entry
                addLogEntry(`Status changed to ${data.connected ? 'Connected' : 'Disconnected'}`);
            }
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

// Reconnect instance
async function reconnectInstance() {
    if (!confirm(`Are you sure you want to reconnect the instance "${clientId}"?`)) {
        return;
    }
    
    try {
        elements.statusBadge.textContent = 'Initializing...';
        elements.statusBadge.className = 'status-badge status-initializing';
        
        const response = await fetch(`${apiUrl}/api/whatsapp/instance/init`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ clientId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Success', 'Instance reconnection initiated. QR code will be generated shortly.');
            addLogEntry('Reconnection initiated');
            
            // Show QR container
            elements.qrContainer.style.display = 'flex';
            elements.qrCodePlaceholder.innerHTML = '<p>Generating new QR code...</p>';
            
            // Wait a moment and fetch the QR code
            setTimeout(fetchQrCode, 3000);
            
            // Start QR code refresh interval if not already running
            if (!state.qrCodeCheckInterval) {
                state.qrCodeCheckInterval = setInterval(fetchQrCode, 20000);
            }
        } else {
            showAlert('Error', data.error || 'Failed to reconnect instance');
        }
    } catch (error) {
        console.error('Error reconnecting instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Logout instance
async function logoutInstance() {
    if (!confirm(`Are you sure you want to logout the instance "${clientId}"? This will disconnect it from WhatsApp.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/api/whatsapp/logout`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ clientId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Success', 'Instance logged out successfully');
            addLogEntry('Logged out from WhatsApp');
            
            // Update status
            elements.statusBadge.textContent = 'Disconnected';
            elements.statusBadge.className = 'status-badge status-disconnected';
            
            // Reload instance data
            setTimeout(loadInstanceData, 1000);
        } else {
            showAlert('Error', data.error || 'Failed to logout instance');
        }
    } catch (error) {
        console.error('Error logging out instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Delete instance
async function deleteInstance() {
    if (!confirm(`Are you sure you want to DELETE the instance "${clientId}"? This action cannot be undone.`)) {
        return;
    }
    
    if (!confirm(`FINAL WARNING: This will permanently delete the instance "${clientId}" and all its data. Continue?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${apiUrl}/api/whatsapp/instance/delete`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ clientId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Success', 'Instance deleted successfully. Redirecting to dashboard...');
            
            // Redirect to dashboard after a delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            showAlert('Error', data.error || 'Failed to delete instance');
        }
    } catch (error) {
        console.error('Error deleting instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Activate tab
function activateTab(tabName) {
    // Update tab buttons
    elements.tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update tab contents
    elements.tabContents.forEach(content => {
        if (content.id === `${tabName}-tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// Add log entry
function addLogEntry(message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    
    // Remove empty state if present
    const emptyState = elements.instanceLogs.querySelector('.empty-state');
    if (emptyState) {
        elements.instanceLogs.innerHTML = '';
    }
    
    // Create log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <p>${message}</p>
        <span class="log-time">${dateString} ${timeString}</span>
    `;
    
    // Add to beginning of logs
    elements.instanceLogs.insertBefore(logEntry, elements.instanceLogs.firstChild);
}

// Save instance settings
async function saveInstanceSettings() {
    try {
        // Get form values
        const ignoreGroups = elements.ignoreGroups.checked;
        const webhookUrl = elements.webhookUrl.value.trim();
        
        // Prepare request payload
        const payload = {
            clientId,
            ignoreGroups
        };
        
        // Only include webhookUrl if it's set
        if (webhookUrl !== '') {
            payload.webhookUrl = webhookUrl;
        } else {
            // Empty string will clear the webhook
            payload.webhookUrl = "";
        }
        
        // Show loading state
        elements.saveSettings.disabled = true;
        elements.saveSettings.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        // Send request to API
        const response = await fetch(`${apiUrl}/api/whatsapp/instance/config`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        // Reset button state
        elements.saveSettings.disabled = false;
        elements.saveSettings.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        
        if (data.success) {
            // Update local state
            if (state.instance && state.instance.config) {
                state.instance.config.ignoreGroups = ignoreGroups;
                state.instance.config.webhookUrl = webhookUrl;
            }
            
            // Show success message
            showAlert('Success', 'Instance settings saved successfully');
            addLogEntry('Settings updated');
        } else {
            showAlert('Error', data.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        
        // Reset button state
        elements.saveSettings.disabled = false;
        elements.saveSettings.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Show alert modal
function showAlert(title, message) {
    elements.alertTitle.textContent = title;
    elements.alertMessage.textContent = message;
    elements.alertModal.classList.add('active');
}

// Close modal
function closeModal(modal) {
    modal.classList.remove('active');
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (state.qrCodeCheckInterval) {
        clearInterval(state.qrCodeCheckInterval);
    }
    if (state.statusCheckInterval) {
        clearInterval(state.statusCheckInterval);
    }
});
