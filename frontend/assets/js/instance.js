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
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão.', 'error');
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
    statusCheckInterval: null,
    fastPollingMode: false,
    lastQrTimestamp: null,
    connectionCheckInterval: null
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
        showAlert('Error', 'No instance ID provided. Redirecting to dashboard...', 'error');
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
        saveSettings: document.getElementById('save-settings'),
        proxyUrl: document.getElementById('proxy-url')
    };
    
    // Debug: Check if important elements exist
    console.log('Elements check:', {
        reconnectBtn: !!elements.reconnectBtn,
        logoutBtn: !!elements.logoutBtn,
        deleteBtn: !!elements.deleteBtn,
        alertModal: !!elements.alertModal
    });
    
    elements.instanceName.textContent = clientId;
    
    // Set up tabs
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            activateTab(tabName);
        });
    });
    
    // Set up action buttons
    if (elements.reconnectBtn) {
        elements.reconnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            reconnectInstance();
        });
    }
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutInstance();
        });
    }
    
    if (elements.deleteBtn) {
        elements.deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteInstance();
        });
    }
    
    // Setup refresh QR button
    elements.refreshQrBtn.addEventListener('click', fetchQrCode);
    
    // Setup save settings button
    elements.saveSettings.addEventListener('click', saveInstanceSettings);

    // Set up mobile sidebar toggle
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('expanded');
    });
    
    // Setup close modal buttons - mas excluir os do modal de confirmação
    document.querySelectorAll('.close-modal').forEach(btn => {
        // Não adicionar listener se for um botão do modal de confirmação
        if (!btn.closest('#confirm-modal')) {
            btn.addEventListener('click', e => {
                closeModal(e.target.closest('.modal'));
            });
        }
    });
    
    // Start data loading
    await loadInstanceData();
    
    // Note: Periodic status check will be started by startAdaptivePolling() if needed
    // No interval setup here to avoid conflicts with adaptive polling
    
    // Debug: Test button functionality
    console.log('Page initialization completed. Testing button functionality...');
    console.log('ClientId:', clientId);
    console.log('API URL:', apiUrl);
    
    // Add click event test for debugging
    if (elements.reconnectBtn) {
        console.log('Reconnect button found and ready');
    } else {
        console.error('Reconnect button not found!');
    }
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
        showAlert('Connection Error', 'Failed to connect to the API: ' + error.message, 'error');
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
        // Update proxy URL
        if (data.config.proxyUrl !== undefined) {
            elements.proxyUrl.value = data.config.proxyUrl || '';
        }
    }
    
    // Show/hide QR code container based on connection status
    if (!isConnected) {
        elements.qrContainer.style.display = 'flex';
        fetchQrCode();
        
        // Start adaptive polling for QR code and connection status
        startAdaptivePolling();
    } else {
        elements.qrContainer.style.display = 'none';
        // Clear all intervals when connected
        stopAllPolling();
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
            
            // Verificar se é um novo QR code (timestamp mudou)
            if (result.timestamp && result.timestamp !== state.lastQrTimestamp) {
                state.lastQrTimestamp = result.timestamp;
                
                // Se QR foi renovado automaticamente, mostrar notificação
                if (result.autoRenewed) {
                    showAlert('QR Code Renovado', '✅ Novo QR code gerado automaticamente!', 'success');
                    addLogEntry('QR code renovado automaticamente pelo sistema');
                }
                
                // Ativar polling rápido para detectar scan rapidamente
                enableFastPolling();
                console.log('🚀 Fast polling ativado - verificando conexão a cada 2 segundos');
            }
            
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
    console.log('reconnectInstance function called');
    
    // Usar nossa função de confirmação personalizada em vez de confirm() nativo
    const confirmed = await showConfirm(
        `Tem certeza que deseja reconectar a instância "${clientId}"?`,
        'Confirmar Reconexão'
    );
    
    console.log('Confirmation result:', confirmed);
    
    if (!confirmed) {
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
            showAlert('Success', 'Instance reconnection initiated. QR code will be generated shortly.', 'success');
            addLogEntry('Reconnection initiated');
            
            // Show QR container
            elements.qrContainer.style.display = 'flex';
            elements.qrCodePlaceholder.innerHTML = '<p>Generating new QR code...</p>';
            
            // Wait a moment and fetch the QR code
            setTimeout(() => {
                fetchQrCode();
                // Ativar fast polling para detectar conexão rapidamente
                enableFastPolling();
            }, 3000);
        } else {
            showAlert('Error', data.error || 'Failed to reconnect instance', 'error');
        }
    } catch (error) {
        console.error('Error reconnecting instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API', 'error');
    }
}

// Logout instance
async function logoutInstance() {
    console.log('logoutInstance function called');
    
    // Usar nossa função de confirmação personalizada em vez de confirm() nativo
    const confirmed = await showConfirm(
        `Tem certeza que deseja desconectar a instância "${clientId}"? Isso fará com que ela seja desconectada do WhatsApp e um novo QR code será gerado automaticamente.`,
        'Confirmar Logout'
    );
    
    console.log('Logout confirmation result:', confirmed);
    
    if (!confirmed) {
        return;
    }
    
    try {
        // Show loading state
        elements.statusBadge.textContent = 'Logging out...';
        elements.statusBadge.className = 'status-badge status-disconnected';
        
        const response = await fetch(`${apiUrl}/api/whatsapp/logout`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ clientId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Success', 'Instance logged out successfully. Generating new QR code...', 'success');
            addLogEntry('Logged out from WhatsApp');
            
            if (data.autoReconnected) {
                addLogEntry('New connection initialized automatically');
                elements.statusBadge.textContent = 'Waiting for QR scan';
                elements.statusBadge.className = 'status-badge status-disconnected';
            } else if (data.reconnectError) {
                addLogEntry(`Reconnection failed: ${data.reconnectError}`);
            }
            
            // Wait a bit longer for the new connection to initialize and generate QR
            setTimeout(() => {
                loadInstanceData();
                // Ativar fast polling após logout para detectar novo QR rapidamente
                enableFastPolling();
            }, 3000); // Aumentado para 3 segundos
            
        } else {
            showAlert('Error', data.error || 'Failed to logout instance');
            elements.statusBadge.textContent = 'Error';
            elements.statusBadge.className = 'status-badge status-disconnected';
        }
    } catch (error) {
        console.error('Error logging out instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API', 'error');
        elements.statusBadge.textContent = 'Connection Error';
        elements.statusBadge.className = 'status-badge status-disconnected';
    }
}

// Delete instance
async function deleteInstance() {
    console.log('deleteInstance function called');
    
    // Primeira confirmação
    console.log('Showing first confirmation dialog...');
    const firstConfirmed = await showConfirm(
        `Tem certeza que deseja EXCLUIR a instância "${clientId}"? Esta ação não pode ser desfeita.`,
        'Confirmar Exclusão'
    );
    
    console.log('First confirmation result:', firstConfirmed);
    
    if (!firstConfirmed) {
        console.log('First confirmation cancelled, aborting delete operation');
        return;
    }
    
    // Aguardar um pouco antes da segunda confirmação para evitar cliques acidentais
    console.log('Waiting before second confirmation...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Segunda confirmação com aviso mais severo
    console.log('Showing final confirmation dialog...');
    const finalConfirmed = await showConfirm(
        `AVISO FINAL: Isso excluirá permanentemente a instância "${clientId}" e todos os seus dados. Continuar?`,
        'Confirmação Final - IRREVERSÍVEL'
    );
    
    console.log('Final confirmation result:', finalConfirmed);
    
    if (!finalConfirmed) {
        console.log('Final confirmation cancelled, aborting delete operation');
        return;
    }
    
    console.log('Both confirmations accepted, proceeding with deletion...');
    
    try {
        const response = await fetch(`${apiUrl}/api/whatsapp/instance/delete`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ clientId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Success', 'Instance deleted successfully. Redirecting to dashboard...', 'success');
            
            // Redirect to dashboard after a delay
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            showAlert('Error', data.error || 'Failed to delete instance', 'error');
        }
    } catch (error) {
        console.error('Error deleting instance:', error);
        showAlert('Connection Error', 'Failed to connect to the API', 'error');
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
        const proxyUrl = elements.proxyUrl.value.trim();
        
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
        
        // Only include proxyUrl if it's set
        if (proxyUrl !== '') {
            payload.proxyUrl = proxyUrl;
        } else {
            // Empty string will clear the proxy
            payload.proxyUrl = "";
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
                state.instance.config.proxyUrl = proxyUrl;
            }
            
            // Show success message
            let successMessage = 'Instance settings saved successfully';
            
            // Check if reconnection is recommended due to proxy changes
            if (data.reconnectionRecommended && data.proxyChanged) {
                successMessage += '. Proxy configuration changed - reconnection recommended for changes to take effect.';
                
                // Ask user if they want to reconnect now
                setTimeout(async () => {
                    const shouldReconnect = await showConfirm(
                        'The proxy configuration has changed. Would you like to reconnect the instance now for the changes to take effect?',
                        'Reconnection Recommended'
                    );
                    
                    if (shouldReconnect) {
                        await reconnectInstance();
                    }
                }, 1000);
            }
            
            showAlert('Success', successMessage, 'success');
            addLogEntry('Settings updated');
        } else {
            showAlert('Error', data.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        
        // Reset button state
        elements.saveSettings.disabled = false;
        elements.saveSettings.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        
        showAlert('Connection Error', 'Failed to connect to the API', 'error');
    }
}

// Show alert modal
function showAlert(title, message, type = 'info') {
    const iconSymbol = document.getElementById('alert-icon-symbol');
    
    // Limpar classes de ícones anteriores
    iconSymbol.className = '';
    
    // Definir o ícone e a cor de acordo com o tipo de alerta
    switch(type) {
        case 'success':
            iconSymbol.className = 'fas fa-check-circle';
            break;
        case 'warning':
            iconSymbol.className = 'fas fa-exclamation-triangle';
            break;
        case 'error':
            iconSymbol.className = 'fas fa-times-circle';
            break;
        default: // 'info' ou qualquer outro tipo
            iconSymbol.className = 'fas fa-info-circle';
            break;
    }
    
    // Definir o título e a mensagem
    elements.alertTitle.textContent = title;
    elements.alertMessage.textContent = message;
    
    // Exibir o modal usando o método correto
    showModal(elements.alertModal);
}

// Close modal
function closeModal(modal) {
    hideModal(modal);
}

// Show/hide modal functions
function showModal(modal) {
    modal.style.display = 'flex';
    // Use setTimeout para garantir que a transição funcione
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Para modais de confirmação, adicionar um pequeno delay antes de habilitar os botões
    if (modal.id === 'confirm-modal') {
        const buttons = modal.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        });
        
        // Habilitar botões após a animação do modal e um pequeno delay adicional
        setTimeout(() => {
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
        }, 400); // 400ms para garantir que o modal está totalmente visível
    }
}

function hideModal(modal) {
    if (!modal) return;
    
    modal.classList.remove('show');
    // Espere a animação terminar antes de ocultar completamente
    setTimeout(() => {
        modal.style.display = 'none';
    }, 350); // Aumentei um pouco o tempo para garantir que a animação termine
}

// Modal de Confirmação Personalizado
function showConfirm(message, title = 'Confirmação', onConfirm = null, onCancel = null) {
    const confirmModal = document.getElementById('confirm-modal');
    
    if (!confirmModal) {
        console.error('Modal de confirmação não encontrado');
        return Promise.resolve(false);
    }
    
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const headerTitle = document.getElementById('confirm-header-title');
    
    // Definir título e mensagem
    if (confirmTitle) confirmTitle.textContent = title;
    if (headerTitle) headerTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    
    // Prevenir que o modal feche acidentalmente - remover todos os listeners antigos
    const allCloseButtons = confirmModal.querySelectorAll('.close-confirm, .close-modal');
    allCloseButtons.forEach(btn => {
        // Criar um novo elemento para remover todos os listeners antigos
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Mostrar o modal
    showModal(confirmModal);
    
    // Retorna uma Promise para permitir uso com await
    return new Promise(resolve => {
        let isResolved = false; // Flag para evitar resolução múltipla
        
        // Função para resolver apenas uma vez
        const resolveOnce = (result) => {
            if (!isResolved) {
                isResolved = true;
                hideModal(confirmModal);
                
                // Pequeno delay antes de resolver para garantir que o modal feche visualmente
                setTimeout(() => {
                    resolve(result);
                }, 100);
            }
        };
        
        // Adicionar event listeners apenas aos botões do modal de confirmação atual
        const confirmButtons = confirmModal.querySelectorAll('.close-confirm');
        confirmButtons.forEach(btn => {
            btn.addEventListener('click', function handleConfirmClick(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const result = this.getAttribute('data-result') === 'true';
                console.log('Confirm button clicked, result:', result);
                
                // Executar callbacks se fornecidos
                if (result && typeof onConfirm === 'function') {
                    onConfirm();
                } else if (!result && typeof onCancel === 'function') {
                    onCancel();
                }
                
                resolveOnce(result);
            }, { once: true }); // Garante que cada listener seja executado apenas uma vez
        });
        
        // Adicionar listener para o X (fechar) que deve cancelar
        const closeModalButtons = confirmModal.querySelectorAll('.close-modal');
        closeModalButtons.forEach(btn => {
            btn.addEventListener('click', function handleCloseClick(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Close modal button clicked');
                
                if (typeof onCancel === 'function') {
                    onCancel();
                }
                
                resolveOnce(false);
            }, { once: true });
        });
        
        // Adicionar listener para ESC key para cancelar
        const escapeHandler = function(e) {
            if (e.key === 'Escape' && !isResolved) {
                console.log('Escape key pressed');
                
                if (typeof onCancel === 'function') {
                    onCancel();
                }
                
                document.removeEventListener('keydown', escapeHandler);
                resolveOnce(false);
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        
        // Adicionar timeout de segurança (opcional - apenas para debug)
        setTimeout(() => {
            if (!isResolved) {
                console.warn('Modal de confirmação ficou aberto por muito tempo, fechando automaticamente');
                resolveOnce(false);
            }
        }, 60000); // 60 segundos de timeout
    });
}

// ===== SISTEMA DE POLLING ADAPTATIVO =====

/**
 * Inicia o sistema de polling adaptativo
 * - Polling normal: QR code a cada 20s, status a cada 15s
 * - Fast polling: Conexão a cada 2s quando QR é mostrado/renovado
 */
function startAdaptivePolling() {
    // Parar polling anterior se existir
    stopAllPolling();
    
    // Polling normal para QR code (20 segundos)
    if (!state.qrCodeCheckInterval) {
        state.qrCodeCheckInterval = setInterval(fetchQrCode, 20000);
        console.log('📡 Polling normal do QR code iniciado (20s)');
    }
    
    // Polling normal para status (15 segundos)
    if (!state.statusCheckInterval) {
        state.statusCheckInterval = setInterval(checkInstanceStatus, 15000);
        console.log('📡 Polling normal do status iniciado (15s)');
    }
}

/**
 * Ativa o modo de polling rápido para detectar conexão rapidamente
 * Usado quando um novo QR code é exibido
 */
function enableFastPolling() {
    // Se já está em fast polling, não fazer nada
    if (state.fastPollingMode) return;
    
    state.fastPollingMode = true;
    
    // Polling rápido para detectar conexão (2 segundos)
    state.connectionCheckInterval = setInterval(() => {
        checkInstanceConnectionFast();
    }, 2000);
    
    console.log('⚡ Fast polling ativado - checando conexão a cada 2s');
    
    // Desativar fast polling após 2 minutos (timeout de QR code típico)
    setTimeout(() => {
        disableFastPolling();
    }, 120000); // 2 minutos
}

/**
 * Desativa o modo de polling rápido
 */
function disableFastPolling() {
    if (!state.fastPollingMode) return;
    
    state.fastPollingMode = false;
    
    if (state.connectionCheckInterval) {
        clearInterval(state.connectionCheckInterval);
        state.connectionCheckInterval = null;
    }
    
    console.log('🐌 Fast polling desativado - voltando ao polling normal');
}

/**
 * Verifica conexão de forma rápida (otimizada para fast polling)
 */
async function checkInstanceConnectionFast() {
    try {
        const timestamp = Date.now();
        const response = await fetch(`${apiUrl}/api/whatsapp/status?clientId=${clientId}&t=${timestamp}`, {
            headers: getAuthHeader()
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.success && data.connected) {
            // Conexão estabelecida! Usuário escaneou o QR code
            console.log('🎉 Conexão detectada via fast polling!');
            
            // Desativar fast polling imediatamente
            disableFastPolling();
            
            // Mostrar feedback imediato
            showAlert('Conectado!', '🎉 WhatsApp conectado com sucesso!', 'success');
            addLogEntry('Conectado ao WhatsApp via QR code');
            
            // Atualizar interface imediatamente
            await loadInstanceData();
            
            // Parar todo o polling (será reconectado se necessário)
            stopAllPolling();
        }
    } catch (error) {
        console.error('Erro no fast polling:', error);
    }
}

/**
 * Para todo o polling
 */
function stopAllPolling() {
    // Parar polling normal
    if (state.qrCodeCheckInterval) {
        clearInterval(state.qrCodeCheckInterval);
        state.qrCodeCheckInterval = null;
    }
    
    if (state.statusCheckInterval) {
        clearInterval(state.statusCheckInterval);
        state.statusCheckInterval = null;
    }
    
    // Parar fast polling
    disableFastPolling();
    
    console.log('⏹️ Todo o polling foi parado');
}

// ===== FIM DO SISTEMA DE POLLING ADAPTATIVO =====

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopAllPolling();
});
