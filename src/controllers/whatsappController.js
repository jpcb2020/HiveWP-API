const whatsappService = require('../services/whatsappService');

/**
 * Obtém a lista de instâncias ativas
 */
const getInstances = async (req, res) => {
  try {
    const instances = whatsappService.getActiveInstances();
    return res.json({
      success: true,
      instances
    });
  } catch (error) {
    console.error('Erro ao obter instâncias:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter instâncias'
    });
  }
};

/**
 * Inicializa uma nova instância para um cliente
 */
const initInstance = async (req, res) => {
  try {
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }
    
    await whatsappService.initializeWhatsApp(clientId);
    
    return res.json({
      success: true,
      message: `Instância para cliente ${clientId} inicializada com sucesso`
    });
  } catch (error) {
    console.error('Erro ao inicializar instância:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao inicializar instância'
    });
  }
};

/**
 * Obtém o QR Code para autenticação
 */
const getQrCode = async (req, res) => {
  try {
    const clientId = req.query.clientId || 'default';
    const result = await whatsappService.getQrCode(clientId);
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
    const clientId = req.query.clientId || 'default';
    const result = await whatsappService.getQrCode(clientId);
    
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
    const clientId = req.query.clientId || 'default';
    const status = whatsappService.getConnectionStatus(clientId);
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
    const { clientId = 'default', phoneNumber, message } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e mensagem são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendTextMessage(clientId, phoneNumber, message);
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
 * Envia uma mídia (imagem, documento ou qualquer tipo de arquivo)
 */
const sendMediaMessage = async (req, res) => {
  try {
    const { clientId = 'default', phoneNumber, mediaUrl, filename, mimetype, caption } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e URL da mídia são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendMediaMessage(
      clientId,
      phoneNumber, 
      mediaUrl, 
      filename, 
      mimetype,
      caption
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mídia'
    });
  }
};

/**
 * Envia uma mensagem de áudio (PTT/Voice Message)
 */
const sendAudioMessage = async (req, res) => {
  try {
    const { clientId = 'default', phoneNumber, audioUrl, caption, mimetype } = req.body;
    
    // Validar parâmetros
    if (!phoneNumber || !audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone e URL do áudio são obrigatórios'
      });
    }
    
    const result = await whatsappService.sendAudioMessage(
      clientId,
      phoneNumber, 
      audioUrl, 
      caption,
      mimetype
    );
    
    return res.json(result);
  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar áudio'
    });
  }
};

/**
 * Desconecta do WhatsApp
 */
const logout = async (req, res) => {
  try {
    const clientId = req.body.clientId || 'default';
    const result = await whatsappService.logout(clientId);
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
    const clientId = req.body.clientId || 'default';
    const result = await whatsappService.restartConnection(clientId);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar conexão:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao reiniciar conexão'
    });
  }
};

/**
 * Deleta uma instância específica de WhatsApp
 */
const deleteInstance = async (req, res) => {
  try {
    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'ID do cliente é obrigatório'
      });
    }
    
    const result = await whatsappService.deleteInstance(clientId);
    
    return res.json(result);
  } catch (error) {
    console.error('Erro ao deletar instância:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao deletar instância'
    });
  }
};

/**
 * Verifica se um número está registrado no WhatsApp
 */
const checkNumberExists = async (req, res) => {
  try {
    const { clientId = 'default', phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone é obrigatório'
      });
    }
    
    const result = await whatsappService.checkNumberExists(clientId, phoneNumber);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao verificar número:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao verificar número'
    });
  }
};

module.exports = {
  getQrCode,
  getQrCodeImage,
  getStatus,
  sendTextMessage,
  sendMediaMessage,
  sendAudioMessage,
  logout,
  restartConnection,
  getInstances,
  initInstance,
  deleteInstance,
  checkNumberExists
};
