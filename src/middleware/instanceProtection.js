/**
 * Middleware de proteção de instâncias
 * Detecta e previne problemas que podem causar exclusão acidental de instâncias
 */

const { getLogger } = require('../config/logger');
const logger = getLogger('instance-protection');

/**
 * Middleware para logar todas as operações relacionadas a instâncias
 */
const logInstanceOperations = (req, res, next) => {
  const { method, path, body, query } = req;
  const clientId = body?.clientId || query?.clientId || 'default';
  
  // Log detalhado para operações críticas
  if (path.includes('/instance/') || path.includes('/send/') || path.includes('/qr')) {
    logger.info(`🔍 Operação detectada`, {
      method,
      path,
      clientId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  
  // Hook no response para detectar erros
  const originalSend = res.send;
  res.send = function(data) {
    try {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Detectar respostas de erro que podem indicar problemas
      if (responseData?.success === false) {
        logger.warn(`⚠️  Resposta de erro detectada`, {
          method,
          path,
          clientId,
          error: responseData.error,
          ip: req.ip
        });
      }
      
      // Detectar operações de exclusão bem-sucedidas
      if (path.includes('/instance/delete') && responseData?.success === true) {
        logger.info(`🗑️  Instância deletada com sucesso`, {
          clientId,
          message: responseData.message,
          ip: req.ip
        });
      }
      
    } catch (parseError) {
      // Ignorar erros de parse do JSON
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware para validar se clientId existe antes de operações críticas
 */
const validateInstanceExists = (req, res, next) => {
  const { path, method } = req;
  
  // Aplicar apenas em rotas que modificam instâncias
  const criticalPaths = ['/send/', '/logout', '/restart', '/instance/config'];
  const isCriticalPath = criticalPaths.some(p => path.includes(p));
  
  if (isCriticalPath && method === 'POST') {
    const clientId = req.body?.clientId || 'default';
    
    // Verificar se a instância existe antes de prosseguir
    try {
      const whatsappService = require('../services/whatsappService');
      const instances = whatsappService.getActiveInstances();
      const instanceExists = instances.some(i => i.id === clientId);
      
      if (!instanceExists) {
        logger.warn(`🚫 Tentativa de operação em instância inexistente`, {
          path,
          method,
          clientId,
          ip: req.ip
        });
        
        return res.status(404).json({
          success: false,
          error: `Instância ${clientId} não encontrada. Inicialize a instância primeiro.`,
          code: 'INSTANCE_NOT_FOUND'
        });
      }
      
    } catch (error) {
      logger.error('Erro ao validar existência da instância:', error);
      // Continuar mesmo com erro na validação
    }
  }
  
  next();
};

/**
 * Middleware para rate limiting específico por instância
 */
const instanceRateLimit = (req, res, next) => {
  const clientId = req.body?.clientId || req.query?.clientId || 'default';
  
  // Implementar rate limiting básico por instância se necessário
  // Por enquanto, apenas log
  logger.debug(`Rate limit check para instância: ${clientId}`, {
    path: req.path,
    method: req.method
  });
  
  next();
};

module.exports = {
  logInstanceOperations,
  validateInstanceExists,
  instanceRateLimit
}; 