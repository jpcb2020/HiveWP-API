const express = require('express');
const router = express.Router();
const { getLogger } = require('../config/logger');
const logger = getLogger('health');
const whatsappService = require('../services/whatsappService'); // Para obter informações das instâncias

router.get('/health', (req, res) => {
  try {
    const activeInstances = whatsappService.getActiveInstances();
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      activeWhatsAppInstances: activeInstances.length,
      // Você pode adicionar mais verificações aqui, como conectividade com DB (se houver)
    };
    logger.info('Health check bem-sucedido', healthStatus);
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Erro durante o health check', error);
    res.status(503).json({
      status: 'DOWN',
      error: 'Erro ao verificar a saúde da aplicação',
      details: error.message
    });
  }
});

module.exports = router; 