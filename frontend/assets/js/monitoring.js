let refreshInterval = null;
let nextRefreshTimer = null;
let nextRefreshTime = 0;

// Verificar autenticação
let apiKey = localStorage.getItem('hiveApiKey');

// Se não tem API key no localStorage, usar a API key fornecida
if (!apiKey) {
    apiKey = 'VTrDlB3zWqdxAKmcmFRS1p1lRNbVj09F7sqlIrncqL6yFieK2bEz9LjtLIRVTrFS';
    // Salvar no localStorage para próximas visitas
    localStorage.setItem('hiveApiKey', apiKey);
    console.log('✅ API Key configurada automaticamente');
}

// Função para fazer requisições autenticadas
async function fetchWithAuth(url) {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Função para formatar tempo
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

// Função para formatar bytes
function formatBytes(bytes) {
    return Math.round(bytes) + 'MB';
}

// Função para carregar métricas
async function loadMetrics() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
    }
    
    try {
        console.log('🔍 Carregando métricas...');
        const metrics = await fetchWithAuth('/monitoring/metrics');
        console.log('📊 Métricas recebidas:', metrics);
        
        // System Overview
        const systemUptimeEl = document.getElementById('system-uptime');
        const nodeVersionEl = document.getElementById('node-version');
        const systemPidEl = document.getElementById('system-pid');
        
        if (systemUptimeEl) systemUptimeEl.textContent = formatUptime(metrics.system.uptime);
        if (nodeVersionEl) nodeVersionEl.textContent = metrics.system.nodeVersion;
        if (systemPidEl) systemPidEl.textContent = metrics.system.pid;
        
        // Requests
        const totalRequestsEl = document.getElementById('total-requests');
        const successRequestsEl = document.getElementById('success-requests');
        const errorRequestsEl = document.getElementById('error-requests');
        const requestsPerMinuteEl = document.getElementById('requests-per-minute');
        
        if (totalRequestsEl) totalRequestsEl.textContent = metrics.requests.total;
        if (successRequestsEl) successRequestsEl.textContent = metrics.requests.success;
        if (errorRequestsEl) errorRequestsEl.textContent = metrics.requests.errors;
        if (requestsPerMinuteEl) requestsPerMinuteEl.textContent = metrics.requests.requestsPerMinute;
        
        // Instances
        const totalInstancesEl = document.getElementById('total-instances');
        const connectedInstancesEl = document.getElementById('connected-instances');
        const disconnectedInstancesEl = document.getElementById('disconnected-instances');
        const connectionRateEl = document.getElementById('connection-rate');
        
        if (totalInstancesEl) totalInstancesEl.textContent = metrics.instances.total;
        if (connectedInstancesEl) connectedInstancesEl.textContent = metrics.instances.connected;
        if (disconnectedInstancesEl) disconnectedInstancesEl.textContent = metrics.instances.disconnected;
        if (connectionRateEl) connectionRateEl.textContent = metrics.instances.connectionRate;
        
        // Performance
        const avgResponseTimeEl = document.getElementById('avg-response-time');
        const memoryUsageEl = document.getElementById('memory-usage');
        const memoryBarEl = document.getElementById('memory-bar');
        
        if (avgResponseTimeEl) avgResponseTimeEl.textContent = metrics.performance.avgResponseTime + 'ms';
        
        if (metrics.performance.memory && metrics.performance.memory.heapUsed && metrics.performance.memory.heapTotal) {
            const memoryPercent = Math.round((metrics.performance.memory.heapUsed / metrics.performance.memory.heapTotal) * 100);
            if (memoryUsageEl) memoryUsageEl.textContent = memoryPercent + '%';
            if (memoryBarEl) memoryBarEl.style.width = memoryPercent + '%';
        }
        
        // Webhook Queue
        const webhookProcessedEl = document.getElementById('webhook-processed');
        const webhookFailedEl = document.getElementById('webhook-failed');
        const webhookQueuedEl = document.getElementById('webhook-queued');
        const webhookActiveEl = document.getElementById('webhook-active');
        const queueSizeEl = document.getElementById('queue-size');
        
        if (webhookProcessedEl) webhookProcessedEl.textContent = metrics.webhook.processed;
        if (webhookFailedEl) webhookFailedEl.textContent = metrics.webhook.failed;
        if (webhookQueuedEl) webhookQueuedEl.textContent = metrics.webhook.queued;
        if (webhookActiveEl) webhookActiveEl.textContent = metrics.webhook.activeRequests;
        if (queueSizeEl) queueSizeEl.textContent = metrics.webhook.queueSize;
        
        const webhookStatusEl = document.getElementById('webhook-status');
        if (webhookStatusEl) {
            if (metrics.webhook.processing) {
                webhookStatusEl.innerHTML = '<span class="status-indicator status-online"></span>Active';
            } else {
                webhookStatusEl.innerHTML = '<span class="status-indicator status-error"></span>Inactive';
            }
        }
        
        // Number Cache
        if (metrics.cache && metrics.cache.numberCache) {
            const numberHitRate = metrics.cache.numberCache.hitRate || '0%';
            const numberCacheHitrateEl = document.getElementById('number-cache-hitrate');
            const numberCacheSizeEl = document.getElementById('number-cache-size');
            const numberCacheMaxEl = document.getElementById('number-cache-max');
            const numberCacheHitsEl = document.getElementById('number-cache-hits');
            const numberCacheMissesEl = document.getElementById('number-cache-misses');
            const numberCacheBarEl = document.getElementById('number-cache-bar');
            
            if (numberCacheHitrateEl) numberCacheHitrateEl.textContent = numberHitRate;
            if (numberCacheSizeEl) numberCacheSizeEl.textContent = metrics.cache.numberCache.size;
            if (numberCacheMaxEl) numberCacheMaxEl.textContent = metrics.cache.numberCache.maxSize;
            if (numberCacheHitsEl) numberCacheHitsEl.textContent = metrics.cache.numberCache.hits;
            if (numberCacheMissesEl) numberCacheMissesEl.textContent = metrics.cache.numberCache.misses;
            
            const numberCachePercent = (metrics.cache.numberCache.size / metrics.cache.numberCache.maxSize) * 100;
            if (numberCacheBarEl) numberCacheBarEl.style.width = numberCachePercent + '%';
        }
        
        // QR Cache
        if (metrics.cache && metrics.cache.qrCache) {
            const qrHitRate = metrics.cache.qrCache.hitRate || '0%';
            const qrCacheHitrateEl = document.getElementById('qr-cache-hitrate');
            const qrCacheSizeEl = document.getElementById('qr-cache-size');
            const qrCacheMaxEl = document.getElementById('qr-cache-max');
            const qrCacheHitsEl = document.getElementById('qr-cache-hits');
            const qrCacheMissesEl = document.getElementById('qr-cache-misses');
            const qrCacheBarEl = document.getElementById('qr-cache-bar');
            
            if (qrCacheHitrateEl) qrCacheHitrateEl.textContent = qrHitRate;
            if (qrCacheSizeEl) qrCacheSizeEl.textContent = metrics.cache.qrCache.size;
            if (qrCacheMaxEl) qrCacheMaxEl.textContent = metrics.cache.qrCache.maxSize;
            if (qrCacheHitsEl) qrCacheHitsEl.textContent = metrics.cache.qrCache.hits;
            if (qrCacheMissesEl) qrCacheMissesEl.textContent = metrics.cache.qrCache.misses;
            
            const qrCachePercent = (metrics.cache.qrCache.size / metrics.cache.qrCache.maxSize) * 100;
            if (qrCacheBarEl) qrCacheBarEl.style.width = qrCachePercent + '%';
        }
        
        // Memory Details
        if (metrics.performance && metrics.performance.memory) {
            const heapUsedEl = document.getElementById('heap-used');
            const heapTotalEl = document.getElementById('heap-total');
            const rssMemoryEl = document.getElementById('rss-memory');
            const externalMemoryEl = document.getElementById('external-memory');
            const heapBarEl = document.getElementById('heap-bar');
            
            if (heapUsedEl) heapUsedEl.textContent = formatBytes(metrics.performance.memory.heapUsed);
            if (heapTotalEl) heapTotalEl.textContent = formatBytes(metrics.performance.memory.heapTotal);
            if (rssMemoryEl) rssMemoryEl.textContent = formatBytes(metrics.performance.memory.rss);
            if (externalMemoryEl) externalMemoryEl.textContent = formatBytes(metrics.performance.memory.external);
            
            const heapPercent = (metrics.performance.memory.heapUsed / metrics.performance.memory.heapTotal) * 100;
            if (heapBarEl) heapBarEl.style.width = heapPercent + '%';
        }
        
        // Update timestamp
        const lastUpdateTimeEl = document.getElementById('last-update-time');
        if (lastUpdateTimeEl) {
            lastUpdateTimeEl.textContent = new Date().toLocaleString();
        }
        
        // Update system status
        const systemStatusEl = document.getElementById('system-status');
        const statusIndicator = document.querySelector('.status-indicator');
        if (systemStatusEl) systemStatusEl.textContent = 'System Online';
        if (statusIndicator) statusIndicator.className = 'status-indicator status-online';
        
        console.log('✅ Métricas atualizadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar métricas:', error);
        const systemStatusEl = document.getElementById('system-status');
        const statusIndicator = document.querySelector('.status-indicator');
        if (systemStatusEl) systemStatusEl.textContent = 'Connection Error';
        if (statusIndicator) statusIndicator.className = 'status-indicator status-error';
    }
    
    if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
    }
}

// Auto refresh functionality
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
            refreshInterval = setInterval(loadMetrics, interval);
            
            // Update countdown
            nextRefreshTime = Date.now() + interval;
            nextRefreshTimer = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((nextRefreshTime - Date.now()) / 1000));
                if (remaining > 0) {
                    if (nextRefreshSpan) nextRefreshSpan.textContent = `Next refresh in ${remaining}s`;
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

// Manual refresh button
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadMetrics);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando sistema de monitoramento...');
    loadMetrics();
    setupAutoRefresh();
    setupRefreshButton();
}); 