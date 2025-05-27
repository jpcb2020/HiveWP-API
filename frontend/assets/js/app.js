// App State
const state = {
    apiUrl: localStorage.getItem('apiUrl') || 'http://localhost:3000',
    instances: [],
    activePage: 'dashboard',
    searchTerm: ''
};

// DOM Elements
const elements = {
    sidebar: document.querySelector('.sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    navItems: document.querySelectorAll('.sidebar-nav li'),
    pageTitle: document.getElementById('page-title'),
    sections: document.querySelectorAll('.content-section'),
    addNewBtn: document.getElementById('add-new-btn'),
    
    instanceCount: document.getElementById('instance-count'),
    connectedCount: document.getElementById('connected-count'),
    disconnectedCount: document.getElementById('disconnected-count'),
    activityList: document.getElementById('activity-list'),
    
    instanceList: document.getElementById('instance-list'),
    
    // Search elements
    instanceSearch: document.getElementById('instance-search'),
    clearSearch: document.getElementById('clear-search'),
    
    // Modals
    addInstanceModal: document.getElementById('add-instance-modal'),
    qrModal: document.getElementById('qr-modal'),
    alertModal: document.getElementById('alert-modal'),
    
    // Forms
    addInstanceForm: document.getElementById('add-instance-form'),
    
    // Settings
    apiUrlInput: document.getElementById('api-url'),
    saveSettingsBtn: document.getElementById('save-settings'),
    
    // Modal content
    alertTitle: document.getElementById('alert-title'),
    alertMessage: document.getElementById('alert-message'),
    qrCodeContainer: document.getElementById('qr-code-container')
};

// Initialize App
function initApp() {
    // Setup event listeners
    setupEventListeners();
    
    // Initialize UI
    updateUI();
    
    // Load data
    loadData();
    
    // Set settings values
    elements.apiUrlInput.value = state.apiUrl;
    
    // Add activity
    addActivity('Application started');
}

// Set up event listeners
function setupEventListeners() {
    // Sidebar toggle (mobile)
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('expanded');
    });
    
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.querySelector('a').getAttribute('href').replace('#', '');
            navigateTo(target);
        });
    });
    
    // Add New button (se existir)
    if (elements.addNewBtn) {
        elements.addNewBtn.addEventListener('click', () => {
            if (state.activePage === 'instances') {
                showModal(elements.addInstanceModal);
            }
        });
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            hideModal(e.target.closest('.modal'));
        });
    });
    
    // Form submissions
    elements.addInstanceForm.addEventListener('submit', handleAddInstance);
    
    // Settings save
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Search functionality
    if (elements.instanceSearch) {
        elements.instanceSearch.addEventListener('input', handleSearch);
        elements.clearSearch.addEventListener('click', clearSearch);
    }
}

// Navigation function
function navigateTo(page) {
    // Update active navigation
    elements.navItems.forEach(item => {
        const link = item.querySelector('a').getAttribute('href').replace('#', '');
        if (link === page) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update page title
    elements.pageTitle.textContent = page.charAt(0).toUpperCase() + page.slice(1);
    
    // Show active section
    elements.sections.forEach(section => {
        if (section.id === `${page}-section`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    // Update add button visibility and text (se o botão existir)
    if (elements.addNewBtn) {
        if (page === 'instances') {
            elements.addNewBtn.style.display = 'inline-flex';
            elements.addNewBtn.innerHTML = `<i class="fas fa-plus"></i> Add New Instance`;
        } else {
            elements.addNewBtn.style.display = 'none';
        }
    }
    
    // Update state
    state.activePage = page;
    
    // On mobile, collapse sidebar after navigation
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.remove('expanded');
    }
}

// Load data from API
async function loadData() {
    try {
        // Load instances
        await loadInstances();
        
        // Update UI with loaded data
        renderInstances();
        updateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Connection Error', 'Failed to connect to the API. Please check your settings and try again.');
    }
}

// Load WhatsApp instances from API
async function loadInstances() {
    try {
        const response = await fetchData(`${state.apiUrl}/api/whatsapp/instances`);
        const data = response;
        
        if (data.success) {
            console.log("Instâncias recebidas da API:", data.instances);
            
            // Processar as instâncias recebidas da API
            if (Array.isArray(data.instances)) {
                // Mapeia os dados das instâncias para o formato interno
                state.instances = data.instances.map(instance => {
                    // Se for um objeto com id, use-o; caso contrário, trate como string clientId
                    const clientId = instance.id || instance;
                    
                    // Preserva dados existentes se a instância já existir
                    const existingInstance = state.instances.find(i => i.clientId === clientId);
                    
                    // Determina o status baseado nas informações recebidas
                    let status = 'checking...';
                    if (typeof instance === 'object') {
                        if (instance.status) {
                            status = instance.status;
                        } else if (instance.connected === true) {
                            status = 'connected';
                        } else if (instance.connected === false) {
                            status = 'disconnected';
                        }
                    }
                    
                    return {
                        clientId: clientId,
                        description: existingInstance?.description || '',
                        status: status
                    };
                });
            } else if (typeof data.instances === 'object' && data.instances !== null) {
                // Se for um objeto de instâncias (não um array)
                state.instances = Object.keys(data.instances).map(clientId => {
                    const instanceData = data.instances[clientId];
                    const existingInstance = state.instances.find(i => i.clientId === clientId);
                    
                    // Determina o status baseado nas informações recebidas
                    let status = 'checking...';
                    if (instanceData) {
                        if (instanceData.status) {
                            status = instanceData.status;
                        } else if (instanceData.connected === true) {
                            status = 'connected';
                        } else if (instanceData.connected === false) {
                            status = 'disconnected';
                        }
                    }
                    
                    return {
                        clientId: clientId,
                        description: existingInstance?.description || '',
                        status: status
                    };
                });
            }
            
            // Se ainda precisar verificar status de instâncias sem status explícito
            const instancesToCheck = state.instances.filter(instance => 
                instance.status === 'checking...');
            
            if (instancesToCheck.length > 0) {
                await Promise.all(instancesToCheck.map(async instance => {
                    await checkInstanceStatus(instance.clientId);
                }));
            }
            
            updateStats();
            renderInstances();
            addActivity(`Loaded ${state.instances.length} WhatsApp instances`);
        } else {
            console.error('Failed to load instances:', data.error);
        }
    } catch (error) {
        console.error('Error fetching instances:', error);
        // Don't create demo instances if API is not available
    }
}

// Check instance connection status
async function checkInstanceStatus(clientId) {
    try {
        const response = await fetchData(`${state.apiUrl}/api/whatsapp/status?clientId=${clientId}`);
        const data = response;
        
        const instance = state.instances.find(i => i.clientId === clientId);
        if (instance) {
            instance.status = data.success && data.connected ? 'connected' : 'disconnected';
        }
        
        updateStats();
        renderInstances();
    } catch (error) {
        console.error(`Error checking status for ${clientId}:`, error);
        const instance = state.instances.find(i => i.clientId === clientId);
        if (instance) {
            instance.status = 'disconnected';
        }
    }
}

// Initialize a new WhatsApp instance
async function initializeInstance(clientId, initOptions = {}) {
    try {
        const instance = state.instances.find(i => i.clientId === clientId);
        if (instance) {
            instance.status = 'initializing';
            renderInstances();
        }
        
        const response = await fetchData(`${state.apiUrl}/api/whatsapp/instance/init`, {
            method: 'POST',
            body: JSON.stringify(initOptions)
        });
        
        const data = response;
        
        if (data.success) {
            addActivity(`Initialized instance ${clientId}`);
            
            // Show QR code
            if (data.qrCode) {
                showQRCode(clientId, data.qrCode);
            }
            
            // Schedule status check
            setTimeout(() => checkInstanceStatus(clientId), 5000);
        } else {
            showAlert('Initialization Failed', data.error || 'Failed to initialize WhatsApp instance');
        }
    } catch (error) {
        console.error(`Error initializing instance ${clientId}:`, error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Show QR code in modal
function showQRCode(clientId, qrCodeData) {
    elements.qrCodeContainer.innerHTML = '';
    
    // Create an image element for the QR code
    const img = document.createElement('img');
    img.src = qrCodeData;
    img.alt = `QR Code for ${clientId}`;
    img.style.maxWidth = '100%';
    
    elements.qrCodeContainer.appendChild(img);
    showModal(elements.qrModal);
}

// Delete WhatsApp instance
async function deleteInstance(clientId) {
    // Usar nossa função de confirmação personalizada em vez de confirm() nativo
    const confirmed = await showConfirm(
        `Tem certeza que deseja excluir a instância "${clientId}"?`, 
        'Confirmar Exclusão'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetchData(`${state.apiUrl}/api/whatsapp/instance/delete`, {
            method: 'POST',
            body: JSON.stringify({ clientId })
        });
        
        const data = response;
        
        if (data.success) {
            // Remove from state
            state.instances = state.instances.filter(i => i.clientId !== clientId);
            addActivity(`Deleted instance ${clientId}`);
            updateStats();
            renderInstances();
        } else {
            showAlert('Deletion Failed', data.error || 'Failed to delete WhatsApp instance');
        }
    } catch (error) {
        console.error(`Error deleting instance ${clientId}:`, error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Logout WhatsApp instance
async function logoutInstance(clientId) {
    // Usar nossa função de confirmação personalizada em vez de confirm() nativo
    const confirmed = await showConfirm(
        `Tem certeza que deseja desconectar a instância "${clientId}"?`, 
        'Confirmar Logout'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetchData(`${state.apiUrl}/api/whatsapp/logout`, {
            method: 'POST',
            body: JSON.stringify({ clientId })
        });
        
        const data = response;
        
        if (data.success) {
            addActivity(`Logged out instance ${clientId}`);
            
            // Update instance status
            const instance = state.instances.find(i => i.clientId === clientId);
            if (instance) {
                instance.status = 'disconnected';
                updateStats();
                renderInstances();
            }
        } else {
            showAlert('Logout Failed', data.error || 'Failed to logout WhatsApp instance');
        }
    } catch (error) {
        console.error(`Error logging out instance ${clientId}:`, error);
        showAlert('Connection Error', 'Failed to connect to the API');
    }
}

// Handle add instance form submission
async function handleAddInstance(e) {
    e.preventDefault();
    
    const idInput = document.getElementById('instance-id');
    const ignoreGroupsInput = document.getElementById('ignore-groups-new');
    const webhookUrlInput = document.getElementById('webhook-url-new');
    const proxyUrlInput = document.getElementById('proxy-url-new');
    
    const clientId = idInput.value.trim();
    const ignoreGroups = ignoreGroupsInput.checked;
    const webhookUrl = webhookUrlInput.value.trim();
    const proxyUrl = proxyUrlInput.value.trim();
    
    if (!clientId) {
        showAlert('Validation Error', 'Instance ID is required');
        return;
    }
    
    // Check if ID already exists
    if (state.instances.some(i => i.clientId === clientId)) {
        showAlert('Validation Error', 'An instance with this ID already exists');
        return;
    }
    
    // Create instance object
    const instance = {
        clientId,
        status: 'disconnected'
    };
    
    // Add to state
    state.instances.push(instance);
    
    // Update UI
    renderInstances();
    updateStats();
    
    // Reset form and close modal
    idInput.value = '';
    ignoreGroupsInput.checked = false;
    webhookUrlInput.value = '';
    proxyUrlInput.value = '';
    hideModal(elements.addInstanceModal);
    
    addActivity(`Added new instance: ${clientId}`);
    
    // Ask to initialize using our custom confirmation
    const shouldInitialize = await showConfirm(
        `Gostaria de inicializar a instância do WhatsApp "${clientId}" agora?`,
        'Inicializar Instância'
    );
    
    if (shouldInitialize) {
        // Initialize with the configuration options
        const initOptions = { clientId };
        
        if (ignoreGroups) initOptions.ignoreGroups = ignoreGroups;
        if (webhookUrl) initOptions.webhookUrl = webhookUrl;
        if (proxyUrl) initOptions.proxyUrl = proxyUrl;
        
        await initializeInstance(clientId, initOptions);
    }
}

// Save settings
function saveSettings() {
    const apiUrl = elements.apiUrlInput.value.trim();
    
    if (!apiUrl) {
        showAlert('Validation Error', 'API URL is required');
        return;
    }
    
    // Update state
    state.apiUrl = apiUrl;
    
    // Save to localStorage
    localStorage.setItem('apiUrl', apiUrl);
    
    showAlert('Success', 'Settings saved successfully', 'success');
    addActivity('Updated API settings');
    
    // Reload data
    loadData();
}

// Funções de busca
function handleSearch(e) {
    state.searchTerm = e.target.value.trim().toLowerCase();
    
    // Mostrar ou esconder o botão de limpar
    if (state.searchTerm) {
        elements.clearSearch.style.display = 'block';
    } else {
        elements.clearSearch.style.display = 'none';
    }
    
    // Atualizar a lista com os resultados filtrados
    renderInstances();
}

function clearSearch() {
    // Limpar o campo de busca e o termo de busca no estado
    elements.instanceSearch.value = '';
    state.searchTerm = '';
    elements.clearSearch.style.display = 'none';
    
    // Atualizar a lista com todas as instâncias
    renderInstances();
}

// Render instances list
function renderInstances() {
    const container = elements.instanceList;
    
    if (state.instances.length === 0) {
        container.innerHTML = '<p class="empty-state">No instances added yet</p>';
        return;
    }
    
    // Filtrar instâncias pelo termo de busca
    const filteredInstances = state.searchTerm
        ? state.instances.filter(instance => 
            instance.clientId.toLowerCase().includes(state.searchTerm))
        : state.instances;
    
    // Mostrar mensagem quando não há resultados para o termo buscado
    if (filteredInstances.length === 0) {
        container.innerHTML = `<p class="empty-state">Nenhuma instância encontrada para "${state.searchTerm}"</p>`;
        return;
    }
    
    container.innerHTML = '';
    
    filteredInstances.forEach(instance => {
        // Verificar se instance.clientId existe e é uma string válida
        if (!instance.clientId || typeof instance.clientId !== 'string') {
            console.error('Invalid instance:', instance);
            return; // Pula esta instância inválida
        }
        
        const card = document.createElement('div');
        card.className = 'instance-card';
        card.innerHTML = `
            <div class="card-header">
                <h4 class="card-title">${instance.clientId}</h4>
                <div class="card-actions">
                    <button class="view-instance" data-id="${instance.clientId}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="initialize-instance" data-id="${instance.clientId}" title="Initialize/Reconnect">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="logout-instance" data-id="${instance.clientId}" title="Logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                    <button class="delete-instance" data-id="${instance.clientId}" title="Delete Instance">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="instance-status">
                    <span class="status-indicator ${instance.status === 'connected' || instance.status === 'open' ? 'status-connected' : 'status-disconnected'}"></span>
                    <span>${(instance.status === 'open' ? 'Connected' : instance.status).charAt(0).toUpperCase() + (instance.status === 'open' ? 'Connected' : instance.status).slice(1)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
        
        // Adiciona evento de clique no card para visualizar detalhes
        card.addEventListener('click', (e) => {
            // Ignorar clique se for nos botões de ação
            if (!e.target.closest('.card-actions')) {
                window.location.href = `instance.html?id=${instance.clientId}`;
            }
        });
        
        // Add event listeners for buttons
        card.querySelector('.view-instance').addEventListener('click', () => {
            window.location.href = `instance.html?id=${instance.clientId}`;
        });
        
        card.querySelector('.initialize-instance').addEventListener('click', () => {
            initializeInstance(instance.clientId);
        });
        
        card.querySelector('.logout-instance').addEventListener('click', () => {
            logoutInstance(instance.clientId);
        });
        
        card.querySelector('.delete-instance').addEventListener('click', () => {
            deleteInstance(instance.clientId);
        });
    });
}

// Update statistics
function updateStats() {
    elements.instanceCount.textContent = state.instances.length;
    elements.connectedCount.textContent = state.instances.filter(i => i.status === 'connected' || i.status === 'open').length;
    elements.disconnectedCount.textContent = state.instances.filter(i => i.status !== 'connected' && i.status !== 'open').length;
}

// Add activity log
function addActivity(message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
        <p>${message}</p>
        <span class="activity-time">${dateString} ${timeString}</span>
    `;
    
    // Clear empty state if present
    if (elements.activityList.querySelector('.empty-state')) {
        elements.activityList.innerHTML = '';
    }
    
    // Add to beginning of list
    elements.activityList.insertBefore(activityItem, elements.activityList.firstChild);
    
    // Limit to 20 activities
    const activities = elements.activityList.querySelectorAll('.activity-item');
    if (activities.length > 20) {
        elements.activityList.removeChild(activities[activities.length - 1]);
    }
}

// Show/hide modal functions
function showModal(modal) {
    modal.style.display = 'flex';
    // Use setTimeout para garantir que a transição funcione
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

function hideModal(modal) {
    modal.classList.remove('show');
    // Espere a animação terminar antes de ocultar completamente
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300); // Corresponde à duração da transição CSS
}

// Modal de Confirmação Personalizado
function showConfirm(message, title = 'Confirmação', onConfirm = null, onCancel = null) {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const headerTitle = document.getElementById('confirm-header-title');
    
    // Definir título e mensagem
    confirmTitle.textContent = title;
    headerTitle.textContent = title;
    confirmMessage.textContent = message;
    
    // Remover eventos antigos
    const closeButtons = confirmModal.querySelectorAll('.close-confirm');
    closeButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // Mostrar modal
    showModal(confirmModal);
    
    // Retornar Promise
    return new Promise(resolve => {
        confirmModal.querySelectorAll('.close-confirm').forEach(btn => {
            btn.addEventListener('click', function() {
                const result = this.getAttribute('data-result') === 'true';
                hideModal(confirmModal);
                
                if (result && typeof onConfirm === 'function') {
                    onConfirm();
                } else if (!result && typeof onCancel === 'function') {
                    onCancel();
                }
                
                resolve(result);
            });
        });
    });
}

// Show alert
function showAlert(title, message, type = 'error') {
    // Configurar o ícone baseado no tipo
    const iconSymbol = document.getElementById('alert-icon-symbol');
    
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
        default:
            iconSymbol.className = 'fas fa-info-circle';
            break;
    }
    
    // Definir título e mensagem
    elements.alertTitle.textContent = title;
    elements.alertMessage.textContent = message;
    
    // Mostrar modal
    showModal(elements.alertModal);
}

// Update UI
function updateUI() {
    renderInstances();
    updateStats();
}

// Função para obter as configurações de API, incluindo o token de autenticação
function getApiConfig() {
    // Verificar se já temos o token no localStorage
    let apiKey = localStorage.getItem('hiveApiKey');
    
    // Se não temos o token, redirecionar para a página de login
    if (!apiKey) {
        window.location.href = '/login.html';
        return null;
    }
    
    return {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
    };
}

// Adicionar função para logout
function logout() {
    localStorage.removeItem('hiveApiKey');
    window.location.href = '/login.html';
}

// Atualizar funções existentes para usar a configuração com o token
async function fetchData(url, options = {}) {
    const apiConfig = getApiConfig();
    if (!apiConfig) {
        return null;
    }
    const finalOptions = {
        ...options,
        headers: {
            ...apiConfig.headers,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ocorreu um erro na requisição');
        }
        return await response.json();
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
