const express = require('express');
const whatsappController = require('../controllers/whatsappController');

const router = express.Router();

// Rotas para gerenciamento de instâncias
router.get('/instances', whatsappController.getInstances);
router.post('/instance/init', whatsappController.initInstance);
router.post('/instance/delete', whatsappController.deleteInstance);

// Rota para verificação de números
router.post('/check-number', whatsappController.checkNumberExists);

// Rotas para conexão e status
router.get('/qr', whatsappController.getQrCode);
router.get('/qr-image', whatsappController.getQrCodeImage); // Nova rota para obter a imagem diretamente
router.get('/status', whatsappController.getStatus);
router.post('/restart', whatsappController.restartConnection);
router.post('/logout', whatsappController.logout);

// Rotas para envio de mensagens
router.post('/send/text', whatsappController.sendTextMessage);
router.post('/send/media', whatsappController.sendMediaMessage);
router.post('/send/audio', whatsappController.sendAudioMessage);

module.exports = router;
