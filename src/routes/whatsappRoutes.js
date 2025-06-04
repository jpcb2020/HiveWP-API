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

// Rate Limiter para rotas de envio de mensagens (ex: 30 requisições por minuto por IP)
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // Limite de 30 requisições de envio por IP por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas de envio de mensagem. Por favor, aguarde um momento.' },
  handler: (req, res, next, options) => {
    const { getLogger } = require('../config/logger');
    const logger = getLogger('security');
    logger.warn(`Rate limit de envio de mensagens excedido por IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        limit: options.max,
        windowMs: options.windowMs
    });
    res.status(options.statusCode).send(options.message);
  }
});

// Rotas para gerenciamento de instâncias
router.get('/instances', whatsappController.getInstances);
router.post('/instance/init', validate(initInstanceSchema), whatsappController.initInstance);
router.post('/instance/delete', validate(deleteInstanceSchema), whatsappController.deleteInstance);
router.post('/instance/config', validate(updateConfigSchema), whatsappController.updateConfig);

// Rota para verificação de números
router.post('/check-number', validate(checkNumberSchema), whatsappController.checkNumberExists);

// Rotas para conexão e status
router.get('/qr', validateQuery(qrCodeQuerySchema), whatsappController.getQrCode);
router.get('/qr-image', validateQuery(qrCodeQuerySchema), whatsappController.getQrCodeImage); // Nova rota para obter a imagem diretamente
router.get('/status', validateQuery(statusQuerySchema), whatsappController.getStatus);
router.post('/restart', validate(optionalClientIdBodySchema), whatsappController.restartConnection);
router.post('/logout', validate(optionalClientIdBodySchema), whatsappController.logout);

// Rotas para envio de mensagens (com rate limiting específico e validação)
router.post('/send/text', messageLimiter, validate(sendTextSchema), whatsappController.sendTextMessage);
router.post('/send/media', messageLimiter, validate(sendMediaSchema), whatsappController.sendMediaMessage);
router.post('/send/audio', messageLimiter, validate(sendAudioSchema), whatsappController.sendAudioMessage);

module.exports = router;
