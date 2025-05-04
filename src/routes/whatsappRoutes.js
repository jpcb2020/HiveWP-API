const express = require('express');
const whatsappController = require('../controllers/whatsappController');

const router = express.Router();

// Rotas para conexão e status
router.get('/qr', whatsappController.getQrCode);
router.get('/qr-image', whatsappController.getQrCodeImage); // Nova rota para obter a imagem diretamente
router.get('/status', whatsappController.getStatus);
router.post('/restart', whatsappController.restartConnection);
router.post('/logout', whatsappController.logout);

// Rotas para envio de mensagens
router.post('/send/text', whatsappController.sendTextMessage);
router.post('/send/image', whatsappController.sendImageMessage);
router.post('/send/pdf', whatsappController.sendPdfMessage);

module.exports = router;
