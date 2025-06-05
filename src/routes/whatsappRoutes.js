const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const {
  validate,
  validateQuery,
  initInstanceSchema,
  deleteInstanceSchema,
  updateConfigSchema,
  checkNumberSchema,
  sendTextSchema,
  sendMediaSchema,
  sendAudioSchema,
  qrCodeQuerySchema,
  statusQuerySchema,
  optionalClientIdBodySchema
} = require('../validators/whatsappValidators');

const router = express.Router();

// Aplicar middleware de autenticação a todas as rotas
router.use(authMiddleware);

// Rate Limiter otimizado para múltiplas instâncias
// Limites mais flexíveis baseados no número de instâncias suportadas

// Rate Limiter para rotas de envio de mensagens (mais flexível para 100 instâncias)
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // Limite aumentado para 200 requisições por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de envio de mensagens atingido. Aguarde um momento.' },
  keyGenerator: (req) => {
    // Usar combinação de IP + API Key para rate limiting mais granular
    const apiKey = req.headers.authorization?.replace('Bearer ', '').substring(0, 8);
    return `${req.ip}-${apiKey}`;
  },
  handler: (req, res, next, options) => {
    const { getLogger } = require('../config/logger');
    const logger = getLogger('security');
    logger.warn(`Rate limit de envio de mensagens excedido`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
        limit: options.max,
        windowMs: options.windowMs
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Rate Limiter específico para operações de instância (mais restritivo)
const instanceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // 50 operações de instância por 5 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de operações de instância atingido.' },
  keyGenerator: (req) => {
    const apiKey = req.headers.authorization?.replace('Bearer ', '').substring(0, 8);
    return `inst-${req.ip}-${apiKey}`;
  }
});

// Rate Limiter para consultas (mais permissivo)
const queryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 500, // 500 consultas por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de consultas atingido.' }
});

// Rotas para gerenciamento de instâncias (com rate limiting específico)
router.get('/instances', queryLimiter, whatsappController.getInstances);
router.post('/instance/init', instanceLimiter, validate(initInstanceSchema), whatsappController.initInstance);
router.post('/instance/delete', instanceLimiter, validate(deleteInstanceSchema), whatsappController.deleteInstance);
router.post('/instance/config', instanceLimiter, validate(updateConfigSchema), whatsappController.updateConfig);

// Rota para verificação de números (com cache otimizado)
router.post('/check-number', queryLimiter, validate(checkNumberSchema), whatsappController.checkNumberExists);

// Rotas para conexão e status (consultas frequentes)
router.get('/qr', queryLimiter, validateQuery(qrCodeQuerySchema), whatsappController.getQrCode);
router.get('/qr-image', queryLimiter, validateQuery(qrCodeQuerySchema), whatsappController.getQrCodeImage);
router.get('/status', queryLimiter, validateQuery(statusQuerySchema), whatsappController.getStatus);
router.post('/restart', instanceLimiter, validate(optionalClientIdBodySchema), whatsappController.restartConnection);
router.post('/logout', instanceLimiter, validate(optionalClientIdBodySchema), whatsappController.logout);

// Rotas para envio de mensagens (com rate limiting otimizado)
router.post('/send/text', messageLimiter, validate(sendTextSchema), whatsappController.sendTextMessage);
router.post('/send/media', messageLimiter, validate(sendMediaSchema), whatsappController.sendMediaMessage);
router.post('/send/audio', messageLimiter, validate(sendAudioSchema), whatsappController.sendAudioMessage);

module.exports = router;
