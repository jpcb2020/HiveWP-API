const whatsappService = require('../services/whatsappService');

/**
 * Obtém o QR Code para autenticação
 */
const getQrCode = async (req, res) => {
  try {
    const result = await whatsappService.getQrCode();
    return res.json(result);
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter QR Code'
    });
  }
};

/**
 * Obtém o QR Code como imagem para exibição direta no navegador
 */
const getQrCodeImage = async (req, res) => {
  try {
    const result = await whatsappService.getQrCode();
    
    if (!result.success || !result.qrCode) {
      return res.status(404).send('QR Code não disponível');
    }
    
    // Extrai a parte base64 da string (remove o prefixo data:image/png;base64,)
    const qrBase64 = result.qrCode.split(',')[1];
    
    // Converte base64 para buffer
    const qrBuffer = Buffer.from(qrBase64, 'base64');
    
    // Define o cabeçalho da resposta como imagem PNG
    res.setHeader('Content-Type', 'image/png');
    
    // Envia a imagem
    return res.send(qrBuffer);
  } catch (error) {
    console.error('Erro ao obter imagem QR Code:', error);
    return res.status(500).send('Erro ao gerar QR Code');
  }
};

/**
 * Obtém o status da conexão
 */
const getStatus = async (req, res) => {
  try {
    const status = whatsappService.getConnectionStatus();
    return res.json(status);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter status'
    });
  }
};

/**
 * Envia uma mensagem de texto
 */
const sendTextMessage = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e mensagem são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendTextMessage(phoneNumber, message);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao enviar mensagem de texto:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem de texto'
    });
  }
};

/**
 * Envia uma mensagem com imagem
 */
const sendImageMessage = async (req, res) => {
  try {
    const { phoneNumber, imageUrl, caption } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e URL da imagem são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendImageMessage(phoneNumber, imageUrl, caption || '');
    return res.json(result);
  } catch (error) {
    console.error('Erro ao enviar imagem:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar imagem'
    });
  }
};

/**
 * Envia um documento PDF
 */
const sendPdfMessage = async (req, res) => {
  try {
    const { phoneNumber, pdfUrl, filename, caption } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !pdfUrl) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e URL do PDF são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendPdfMessage(
      phoneNumber, 
      pdfUrl, 
      filename || 'documento.pdf', 
      caption || ''
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Erro ao enviar PDF:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar PDF'
    });
  }
};

/**
 * Desconecta do WhatsApp
 */
const logout = async (req, res) => {
  try {
    const result = await whatsappService.logout();
    return res.json(result);
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao desconectar'
    });
  }
};

/**
 * Reinicia a conexão com o WhatsApp
 */
const restartConnection = async (req, res) => {
  try {
    const result = await whatsappService.restartConnection();
    return res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar conexão:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao reiniciar conexão'
    });
  }
};

module.exports = {
  getQrCode,
  getQrCodeImage,
  getStatus,
  sendTextMessage,
  sendImageMessage,
  sendPdfMessage,
  logout,
  restartConnection
};
