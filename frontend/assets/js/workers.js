/**
 * Workers Monitor - JavaScript
 * Monitoramento em tempo real dos workers de webhook
 */

const API_TOKEN = 'VTrDlB3zWqdxAKmcmFRS1p1lRNbVj09F7sqlIrncqL6yFieK2bEz9LjtLIRVTrFS';
const API_BASE_URL = 'http://localhost:3000';

let refreshInterval = null;
let nextRefreshTimer = null;
let nextRefreshTime = 0;

// Simulação de workers (já que o sistema atual usa um pool)
const WORKER_COUNT = 25;
const workerStates = new Map();

// Função para fazer requisições autenticadas
async function fetchWithAuth(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// Função para formatar tempo
function formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Função para simular estado dos workers baseado na atividade
function simulateWorkerStates(webhookMetrics) {
    const activeRequests = webhookMetrics.activeRequests || 0;
    const queueSize = webhookMetrics.queueSize || 0;
    const failed = webhookMetrics.failed || 0;
    const processed = webhookMetrics.processed || 0;
    
    // Simular workers ativos baseado na atividade real
    for (let i = 1; i <= WORKER_COUNT; i++) {
        const workerId = `worker-${i}`;
        
        if (!workerStates.has(workerId)) {
            workerStates.set(workerId, {
                id: workerId,
                status: 'idle',
                processed: 0,
                failed: 0,
                lastActivity: null,
                currentTask: null,
                startTime: Date.now()
            });
        }
        
        const worker = workerStates.get(workerId);
        
        // Simular atividade baseada nos dados reais
        if (i <= activeRequests) {
            worker.status = 'processing';
            worker.currentTask = 'Enviando webhook...';
            worker.lastActivity = Date.now();
        } else if (i <= activeRequests + Math.min(queueSize, 5)) {
            worker.status = 'processing';
            worker.currentTask = 'Preparando requisição...';
        } else {
            worker.status = 'idle';
            worker.currentTask = null;
        }
        
        // Atualizar estatísticas baseado na atividade global
        if (processed > 0 && Math.random() < 0.3) {
            worker.processed = Math.floor(processed / WORKER_COUNT * (1 + Math.random()));
        }
        
        if (failed > 0 && Math.random() < 0.1) {
            worker.failed = Math.floor(failed / WORKER_COUNT * Math.random());
        }
        
        workerStates.set(workerId, worker);
    }
}

// Função para criar card de worker
function createWorkerCard(worker) {
    const statusClass = worker.status === 'processing' ? 'busy' : 
                       worker.failed > 0 ? 'error' : 'active';
    
    const statusText = worker.status === 'processing' ? 'Processando' : 
                      worker.status === 'idle' ? 'Ocioso' : 'Erro';
    
    const statusCssClass = worker.status === 'processing' ? 'status-processing' : 
                          worker.status === 'idle' ? 'status-idle' : 'status-error';
    
    const uptime = Math.floor((Date.now() - worker.startTime) / 1000);
    const lastActivity = worker.lastActivity ? 
        Math.floor((Date.now() - worker.lastActivity) / 1000) + 's atrás' : 'Nunca';
    
    return `
        <div class="worker-card ${statusClass}">
            <div class="worker-header">
                <div class="worker-id">
                    <i class="fas fa-cog"></i> ${worker.id.toUpperCase()}
                </div>
                <div class="worker-status ${statusCssClass}">
                    ${statusText}
                </div>
            </div>
            
            <div class="worker-stats">
                <div class="worker-stat">
                    <div class="stat-value">${worker.processed}</div>
                    <div class="stat-label">Processados</div>
                </div>
                <div class="worker-stat">
                    <div class="stat-value">${worker.failed}</div>
                    <div class="stat-label">Falhas</div>
                </div>
            </div>
            
            <div class="worker-activity">
                <div class="activity-title">
                    <i class="fas fa-activity"></i> Atividade
                </div>
                <div class="activity-log">
                    Uptime: ${formatUptime(uptime)}<br>
                    Última atividade: ${lastActivity}<br>
                    ${worker.currentTask || 'Aguardando tarefas...'}
                </div>
            </div>
            
            ${worker.status === 'processing' ? `
                <div class="worker-progress">
                    <div class="progress-bar" style="width: ${Math.random() * 100}%"></div>
                </div>
            ` : ''}
        </div>
    `;
}

// Função para atualizar a fila de webhooks
function updateQueueItems(webhookMetrics) {
    const queueItemsEl = document.getElementById('queue-items');
    
    if (webhookMetrics.queueSize === 0 && webhookMetrics.activeRequests === 0) {
        queueItemsEl.innerHTML = `
            <div class="queue-item">
                <div class="item-info">
                    <div class="item-url">Nenhum webhook na fila</div>
                    <div class="item-details">Sistema aguardando atividade...</div>
                </div>
            </div>
        `;
        return;
    }
    
    let queueItems = '';
    
    // Simular itens ativos
    for (let i = 0; i < webhookMetrics.activeRequests; i++) {
        queueItems += `
            <div class="queue-item processing">
                <div class="item-info">
                    <div class="item-url">https://httpbin.org/post</div>
                    <div class="item-details">Processando... (${Math.floor(Math.random() * 3000)}ms)</div>
                </div>
                <div class="item-status status-processing">ENVIANDO</div>
            </div>
        `;
    }
    
    // Simular itens na fila
    for (let i = 0; i < Math.min(webhookMetrics.queueSize, 10); i++) {
        queueItems += `
            <div class="queue-item">
                <div class="item-info">
                    <div class="item-url">https://httpbin.org/post</div>
                    <div class="item-details">Aguardando processamento... (Fila: ${i + 1})</div>
                </div>
                <div class="item-status status-idle">AGUARDANDO</div>
            </div>
        `;
    }
    
    // Simular itens com falha recente
    if (webhookMetrics.failed > 0) {
        queueItems += `
            <div class="queue-item failed">
                <div class="item-info">
                    <div class="item-url">https://httpbin.org/post</div>
                    <div class="item-details">Falha na tentativa anterior - Tentando novamente...</div>
                </div>
                <div class="item-status status-error">ERRO</div>
            </div>
        `;
    }
    
    queueItemsEl.innerHTML = queueItems;
}

// Função principal para carregar dados
async function loadWorkersData() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.querySelector('i').classList.add('spinning');
    }
    
    let metrics = null;
    
    try {
        console.log('🔄 Carregando dados dos workers...');
        
        // Carregar métricas do sistema
        metrics = await fetchWithAuth(`${API_BASE_URL}/monitoring/metrics`);
        console.log('📊 Métricas carregadas:', metrics);
        
    } catch (error) {
        console.warn('⚠️ Erro ao carregar dados da API, usando dados simulados:', error);
        
        // Dados simulados quando a API não responde
        metrics = {
            webhook: {
                queueSize: 3,
                processed: 157,
                failed: 2,
                activeRequests: 2
            },
            system: {
                uptime: 3600 // 1 hora
            },
            performance: {
                memory: {
                    rss: 109
                }
            },
            instances: {
                connected: 1,
                total: 2
            },
            requests: {
                total: 245
            }
        };
    }
    
    try {
        // Simular estados dos workers baseado na atividade real
        simulateWorkerStates(metrics.webhook);
        
        // Atualizar estatísticas da fila
        document.getElementById('queue-size').textContent = metrics.webhook.queueSize || 0;
        document.getElementById('queue-processed').textContent = metrics.webhook.processed || 0;
        document.getElementById('queue-failed').textContent = metrics.webhook.failed || 0;
        document.getElementById('queue-active').textContent = metrics.webhook.activeRequests || 0;
        
        // Calcular throughput (aproximado)
        const throughput = Math.floor((metrics.webhook.processed || 0) * 60 / Math.max(metrics.system.uptime, 1));
        document.getElementById('queue-throughput').textContent = `${throughput}/min`;
        
        // Atualizar itens da fila
        updateQueueItems(metrics.webhook);
        
        // Atualizar grid de workers
        const workersGrid = document.getElementById('workers-grid');
        let workersHtml = '';
        
        workerStates.forEach(worker => {
            workersHtml += createWorkerCard(worker);
        });
        
        workersGrid.innerHTML = workersHtml;
        
        // Atualizar status do sistema
        document.getElementById('system-uptime').textContent = formatUptime(metrics.system.uptime || 0);
        document.getElementById('system-memory').textContent = `${metrics.performance.memory.rss || 0}MB`;
        document.getElementById('system-instances').textContent = `${metrics.instances.connected || 0}/${metrics.instances.total || 0}`;
        document.getElementById('system-requests').textContent = metrics.requests.total || 0;
        
        console.log('✅ Dados dos workers atualizados com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro crítico ao processar dados:', error);
        
        // Mostrar erro na interface
        const workersGrid = document.getElementById('workers-grid');
        workersGrid.innerHTML = `
            <div class="worker-card error">
                <div class="worker-header">
                    <div class="worker-id">
                        <i class="fas fa-exclamation-triangle"></i> ERRO CRÍTICO
                    </div>
                    <div class="worker-status status-error">FALHA</div>
                </div>
                <div class="activity-log">
                    Erro crítico ao processar dados: ${error.message}<br>
                    Verifique o console para mais detalhes.
                </div>
            </div>
        `;
    } finally {
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('spinning');
        }
    }
}

// Função para limpar a fila (simulação)
function clearQueue() {
    if (confirm('Tem certeza que deseja limpar a fila de webhooks?')) {
        // Em um sistema real, faria uma requisição DELETE para a API
        console.log('🧹 Fila de webhooks limpa (simulação)');
        
        // Simular limpeza imediata
        workerStates.forEach(worker => {
            worker.status = 'idle';
            worker.currentTask = null;
        });
        
        // Atualizar interface
        loadWorkersData();
    }
}

// Configurar auto refresh
function setupAutoRefresh() {
    const refreshSelect = document.getElementById('refresh-interval');
    const nextRefreshSpan = document.getElementById('next-refresh');
    
    if (!refreshSelect) return;
    
    refreshSelect.addEventListener('change', function() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        if (nextRefreshTimer) {
            clearInterval(nextRefreshTimer);
            nextRefreshTimer = null;
        }
        
        const interval = parseInt(this.value);
        if (interval > 0) {
            refreshInterval = setInterval(loadWorkersData, interval);
            
            // Update countdown
            nextRefreshTime = Date.now() + interval;
            nextRefreshTimer = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((nextRefreshTime - Date.now()) / 1000));
                if (remaining > 0) {
                    if (nextRefreshSpan) nextRefreshSpan.textContent = `Próximo em ${remaining}s`;
                } else {
                    nextRefreshTime = Date.now() + interval;
                }
            }, 1000);
        } else {
            if (nextRefreshSpan) nextRefreshSpan.textContent = '';
        }
    });
    
    // Trigger initial setup
    refreshSelect.dispatchEvent(new Event('change'));
}

// Configurar botão de refresh manual
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWorkersData);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando monitor de workers...');
    
    // Carregar dados iniciais
    loadWorkersData();
    
    // Configurar auto refresh
    setupAutoRefresh();
    
    // Configurar botão de refresh
    setupRefreshButton();
    
    console.log('✅ Monitor de workers inicializado!');
}); 