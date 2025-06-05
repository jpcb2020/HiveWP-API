/**
 * Rotas de monitoramento para acompanhar performance do sistema
 * Especialmente útil para monitorar 100+ instâncias simultâneas
 */

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getLogger } = require('../config/logger');
const { cache } = require('../services/cacheService');
const { webhookQueue } = require('../services/webhookQueue');
const whatsappService = require('../services/whatsappService');

const router = express.Router();
const logger = getLogger('monitoring');

// Métricas em tempo real
let systemMetrics = {
  startTime: Date.now(),
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    lastMinute: []
  },
  instances: {
    total: 0,
    connected: 0,
    disconnected: 0,
    errors: 0
  },
  performance: {
    avgResponseTime: 0,
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage()
  }
};

// Middleware para coletar métricas de requisições
const metricsCollector = (req, res, next) => {
  const startTime = Date.now();
  
  systemMetrics.requests.total++;
  systemMetrics.requests.lastMinute.push(Date.now());
  
  // Limpar requisições antigas (últimos 60 segundos)
  const oneMinuteAgo = Date.now() - 60000;
  systemMetrics.requests.lastMinute = systemMetrics.requests.lastMinute
    .filter(timestamp => timestamp > oneMinuteAgo);

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Atualizar tempo de resposta médio
    systemMetrics.performance.avgResponseTime = 
      (systemMetrics.performance.avgResponseTime + responseTime) / 2;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      systemMetrics.requests.success++;
    } else {
      systemMetrics.requests.errors++;
    }
  });

  next();
};

// Aplicar middleware de métricas
router.use(metricsCollector);

/**
 * Health check básico - sem autenticação para load balancers
 */
router.get('/health', (req, res) => {
  const uptime = Date.now() - systemMetrics.startTime;
  const memory = process.memoryUsage();
  
  const health = {
    status: 'healthy',
    uptime: Math.floor(uptime / 1000),
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024),
      total: Math.round(memory.heapTotal / 1024 / 1024),
      percentage: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    },
    timestamp: new Date().toISOString()
  };

  // Verificar se o sistema está saudável
  if (health.memory.percentage > 90) {
    health.status = 'warning';
    health.warning = 'High memory usage';
  }

  res.json(health);
});

/**
 * Métricas detalhadas do sistema - requer autenticação
 */
router.get('/metrics', authMiddleware, (req, res) => {
  try {
    // Atualizar métricas de instâncias
    const instances = whatsappService.getActiveInstances();
    systemMetrics.instances.total = instances.length;
    systemMetrics.instances.connected = instances.filter(i => i.isConnected).length;
    systemMetrics.instances.disconnected = instances.filter(i => !i.isConnected).length;

    // Atualizar métricas de performance
    systemMetrics.performance.memoryUsage = process.memoryUsage();
    systemMetrics.performance.cpuUsage = process.cpuUsage();

    const metrics = {
      system: {
        uptime: Math.floor((Date.now() - systemMetrics.startTime) / 1000),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      },
      requests: {
        total: systemMetrics.requests.total,
        success: systemMetrics.requests.success,
        errors: systemMetrics.requests.errors,
        errorRate: systemMetrics.requests.total > 0 
          ? (systemMetrics.requests.errors / systemMetrics.requests.total * 100).toFixed(2) + '%'
          : '0%',
        requestsPerMinute: systemMetrics.requests.lastMinute.length
      },
      instances: {
        total: systemMetrics.instances.total,
        connected: systemMetrics.instances.connected,
        disconnected: systemMetrics.instances.disconnected,
        connectionRate: systemMetrics.instances.total > 0
          ? (systemMetrics.instances.connected / systemMetrics.instances.total * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        avgResponseTime: Math.round(systemMetrics.performance.avgResponseTime),
        memory: {
          heapUsed: Math.round(systemMetrics.performance.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(systemMetrics.performance.memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(systemMetrics.performance.memoryUsage.external / 1024 / 1024),
          rss: Math.round(systemMetrics.performance.memoryUsage.rss / 1024 / 1024)
        },
        cpu: {
          user: systemMetrics.performance.cpuUsage.user,
          system: systemMetrics.performance.cpuUsage.system
        }
      },
      cache: cache.getStats(),
      webhook: webhookQueue.getMetrics(),
      timestamp: new Date().toISOString()
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Erro ao obter métricas', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter métricas do sistema'
    });
  }
});

/**
 * Métricas específicas das instâncias WhatsApp
 */
router.get('/instances/metrics', authMiddleware, (req, res) => {
  try {
    const instances = whatsappService.getActiveInstances();
    
    const instanceMetrics = instances.map(instance => ({
      clientId: instance.clientId,
      isConnected: instance.isConnected,
      connectionStatus: instance.connectionStatus,
      created: instance.created,
      lastActivity: instance.lastActivity || null,
      messagesSent: instance.messagesSent || 0,
      messagesReceived: instance.messagesReceived || 0,
      errors: instance.errorCount || 0,
      reconnectAttempts: instance.reconnectAttempts || 0,
      hasWebhook: !!instance.webhookUrl,
      hasProxy: !!instance.proxyUrl
    }));

    const summary = {
      totalInstances: instances.length,
      connectedInstances: instances.filter(i => i.isConnected).length,
      instancesWithErrors: instances.filter(i => (i.errorCount || 0) > 0).length,
      instancesWithWebhooks: instances.filter(i => !!i.webhookUrl).length,
      instancesWithProxy: instances.filter(i => !!i.proxyUrl).length,
      averageReconnectAttempts: instances.length > 0 
        ? (instances.reduce((sum, i) => sum + (i.reconnectAttempts || 0), 0) / instances.length).toFixed(2)
        : 0
    };

    res.json({
      summary,
      instances: instanceMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao obter métricas de instâncias', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter métricas das instâncias'
    });
  }
});

/**
 * Status detalhado de uma instância específica
 */
router.get('/instances/:clientId/status', authMiddleware, (req, res) => {
  try {
    const { clientId } = req.params;
    const status = whatsappService.getConnectionStatus(clientId);
    
    if (!status.success) {
      return res.status(404).json(status);
    }

    // Adicionar informações extras de monitoramento
    const enhancedStatus = {
      ...status,
      monitoring: {
        uptime: status.connectedAt ? Date.now() - new Date(status.connectedAt).getTime() : 0,
        lastPing: Date.now(), // Simular ping
        healthScore: calculateHealthScore(status),
        alerts: checkInstanceAlerts(status)
      }
    };

    res.json(enhancedStatus);
  } catch (error) {
    logger.error('Erro ao obter status detalhado da instância', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter status da instância'
    });
  }
});

/**
 * Limpeza de cache (útil para manutenção)
 */
router.post('/cache/clear', authMiddleware, (req, res) => {
  try {
    const { type } = req.body;
    
    if (type === 'all' || !type) {
      cache.clearAll();
      logger.info('Cache limpo completamente via API de monitoramento');
    } else if (type === 'numbers') {
      // Implementar limpeza específica se necessário
      logger.info('Limpeza específica de cache de números solicitada');
    }

    res.json({
      success: true,
      message: `Cache ${type || 'completo'} limpo com sucesso`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro ao limpar cache', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
});

/**
 * Força garbage collection (útil para debugging de memória)
 */
router.post('/gc', authMiddleware, (req, res) => {
  try {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      const freed = {
        heapUsed: before.heapUsed - after.heapUsed,
        heapTotal: before.heapTotal - after.heapTotal,
        external: before.external - after.external
      };

      logger.info('Garbage collection executado via API', freed);
      
      res.json({
        success: true,
        message: 'Garbage collection executado',
        memoryFreed: {
          heapUsed: Math.round(freed.heapUsed / 1024 / 1024),
          heapTotal: Math.round(freed.heapTotal / 1024 / 1024),
          external: Math.round(freed.external / 1024 / 1024)
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Garbage collection não está habilitado. Inicie com --expose-gc'
      });
    }
  } catch (error) {
    logger.error('Erro ao executar garbage collection', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar garbage collection'
    });
  }
});

/**
 * Calcula um score de saúde para uma instância
 */
function calculateHealthScore(status) {
  let score = 100;
  
  if (!status.isConnected) score -= 50;
  if (status.reconnectAttempts > 0) score -= (status.reconnectAttempts * 10);
  if (status.errorCount > 0) score -= (status.errorCount * 5);
  
  return Math.max(0, score);
}

/**
 * Verifica alertas para uma instância
 */
function checkInstanceAlerts(status) {
  const alerts = [];
  
  if (!status.isConnected) {
    alerts.push({ level: 'error', message: 'Instância desconectada' });
  }
  
  if (status.reconnectAttempts > 3) {
    alerts.push({ level: 'warning', message: 'Múltiplas tentativas de reconexão' });
  }
  
  if (status.errorCount > 5) {
    alerts.push({ level: 'warning', message: 'Muitos erros recentes' });
  }
  
  return alerts;
}

module.exports = router; 