const { default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

// Objeto para armazenar múltiplas instâncias
const instances = {};

// Diretório para armazenar as sessões
const SESSION_DIR = process.env.SESSION_DIR || './sessions';

// Verificar se o diretório de sessões existe, se não, criar
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/**
 * Retorna a lista de instâncias ativas
 */
const getActiveInstances = () => {
  return Object.keys(instances).map(id => ({
    id,
    connected: instances[id]?.isConnected || false,
    status: instances[id]?.connectionStatus || 'disconnected'
  }));
};

/**
 * Inicializa a conexão com o WhatsApp para um cliente específico
 * @param {string} clientId - Identificador único do cliente
 */
const initializeWhatsApp = async (clientId = 'default') => {
  try {
    // Criar diretório específico para o cliente se não existir
    const SESSION_PATH = path.join(SESSION_DIR, clientId);
    if (!fs.existsSync(SESSION_PATH)) {
      fs.mkdirSync(SESSION_PATH, { recursive: true });
    }
    
    // Obter as credenciais salvas
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    
    // Buscar a versão mais recente do Baileys
    const { version } = await fetchLatestBaileysVersion();

    // Inicializar o objeto de instância se não existir
    if (!instances[clientId]) {
      instances[clientId] = {
        sock: null,
        qrText: '',
        isConnected: false,
        connectionStatus: 'disconnected'
      };
    }

    // Criar socket do WhatsApp
    instances[clientId].sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['HiveWP API', 'Chrome', '104.0.0'],
      syncFullHistory: false
    });

    const sock = instances[clientId].sock;

    // Gerenciar eventos de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Quando o QR Code estiver disponível
      if (qr) {
        instances[clientId].qrText = qr;
        console.log(`[${clientId}] QR Code gerado. Escaneie para se conectar.`);
      }

      // Quando o status de conexão mudar
      if (connection) {
        instances[clientId].connectionStatus = connection;
        console.log(`[${clientId}] Status de conexão:`, connection);
        
        // Se estiver conectado
        if (connection === 'open') {
          instances[clientId].isConnected = true;
          console.log(`[${clientId}] Conectado com sucesso ao WhatsApp!`);
        }
        
        // Se desconectado
        if (connection === 'close') {
          instances[clientId].isConnected = false;
          
          // Tentar reconectar se não for um logout
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log(`[${clientId}] Reconectando...`);
            initializeWhatsApp(clientId);
          } else {
            console.log(`[${clientId}] Desconectado do WhatsApp (logout).`);
            // Remover credenciais de sessão
            if (fs.existsSync(SESSION_PATH)) {
              fs.rmSync(SESSION_PATH, { recursive: true, force: true });
            }
          }
        }
      }
    });

    // Salvar as credenciais quando atualizadas
    sock.ev.on('creds.update', saveCreds);
    
    // Gerenciar eventos de mensagens
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      
      if (!message.key.fromMe && m.type === 'notify') {
        console.log(`[${clientId}] Nova mensagem recebida:`, JSON.stringify(message, null, 2));
        
        // Aqui você pode adicionar lógica para processar mensagens recebidas
        // e implementar respostas automáticas, etc.
      }
    });

    return sock;
  } catch (error) {
    console.error(`[${clientId}] Erro ao inicializar o WhatsApp:`, error);
    return null;
  }
};

/**
 * Envia uma mensagem de texto para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} message - Mensagem de texto a ser enviada
 */
const sendTextMessage = async (clientId = 'default', phoneNumber, message) => {
  try {
    if (!instances[clientId] || !instances[clientId].isConnected || !instances[clientId].sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    const sock = instances[clientId].sock;
    
    // Formatar o número do telefone (adicionar @s.whatsapp.net)
    let jid = phoneNumber;
    if (!jid.includes('@')) {
      jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }
    
    // Enviar a mensagem
    await sock.sendMessage(jid, { text: message });
    
    return {
      success: true,
      message: 'Mensagem enviada com sucesso'
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao enviar mensagem:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    };
  }
};

/**
 * Envia uma imagem para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} imageUrl - URL ou caminho local da imagem
 * @param {string} caption - Legenda opcional para a imagem
 */
const sendImageMessage = async (clientId = 'default', phoneNumber, imageUrl, caption = '') => {
  try {
    if (!instances[clientId] || !instances[clientId].isConnected || !instances[clientId].sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    const sock = instances[clientId].sock;
    
    // Formatar o número do telefone
    let jid = phoneNumber;
    if (!jid.includes('@')) {
      jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }
    
    // Verificar se a URL é válida ou se é um caminho local
    let image;
    if (imageUrl.startsWith('http')) {
      image = { url: imageUrl };
    } else if (fs.existsSync(imageUrl)) {
      image = { url: imageUrl };
    } else {
      return {
        success: false,
        error: 'URL de imagem inválida ou arquivo não encontrado'
      };
    }
    
    // Enviar a imagem
    await sock.sendMessage(jid, {
      image,
      caption: caption
    });
    
    return {
      success: true,
      message: 'Imagem enviada com sucesso'
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao enviar imagem:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar imagem'
    };
  }
};

/**
 * Envia um documento PDF para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} pdfUrl - URL ou caminho local do arquivo PDF
 * @param {string} filename - Nome do arquivo
 * @param {string} caption - Legenda opcional
 */
const sendPdfMessage = async (clientId = 'default', phoneNumber, pdfUrl, filename = 'documento.pdf', caption = '') => {
  try {
    if (!instances[clientId] || !instances[clientId].isConnected || !instances[clientId].sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    const sock = instances[clientId].sock;
    
    // Formatar o número do telefone
    let jid = phoneNumber;
    if (!jid.includes('@')) {
      jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    }
    
    // Verificar se a URL é válida ou se é um caminho local
    let document;
    if (pdfUrl.startsWith('http')) {
      document = { url: pdfUrl };
    } else if (fs.existsSync(pdfUrl)) {
      document = { url: pdfUrl };
    } else {
      return {
        success: false,
        error: 'URL do PDF inválida ou arquivo não encontrado'
      };
    }
    
    // Enviar o documento PDF
    await sock.sendMessage(jid, {
      document,
      mimetype: 'application/pdf',
      fileName: filename,
      caption: caption
    });
    
    return {
      success: true,
      message: 'PDF enviado com sucesso'
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao enviar PDF:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar PDF'
    };
  }
};

/**
 * Gera uma URL do QR Code como string base64 para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const getQrCode = async (clientId = 'default') => {
  try {
    if (!instances[clientId] || !instances[clientId].qrText) {
      return {
        success: false,
        error: `QR Code para o cliente ${clientId} não disponível no momento`
      };
    }
    
    // Gerar QR Code como base64
    const qrBase64 = await qrcode.toDataURL(instances[clientId].qrText);
    
    return {
      success: true,
      qrCode: qrBase64,
      status: instances[clientId].connectionStatus,
      clientId
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao gerar QR Code:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar QR Code'
    };
  }
};

/**
 * Obtém o status da conexão atual para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const getConnectionStatus = (clientId = 'default') => {
  if (!instances[clientId]) {
    return {
      success: false,
      error: `Cliente ${clientId} não encontrado`
    };
  }
  
  return {
    success: true,
    connected: instances[clientId].isConnected,
    status: instances[clientId].connectionStatus,
    clientId
  };
};

/**
 * Desconecta do WhatsApp para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const logout = async (clientId = 'default') => {
  try {
    if (!instances[clientId] || !instances[clientId].sock) {
      return {
        success: false,
        error: `Nenhuma conexão ativa para o cliente ${clientId}`
      };
    }
    
    // Logout do WhatsApp
    await instances[clientId].sock.logout();
    
    // Limpar variáveis
    instances[clientId].isConnected = false;
    instances[clientId].connectionStatus = 'disconnected';
    instances[clientId].qrText = '';
    
    return {
      success: true,
      message: `Cliente ${clientId} desconectado com sucesso`
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao desconectar:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao desconectar'
    };
  }
};

/**
 * Reinicia a conexão com o WhatsApp para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const restartConnection = async (clientId = 'default') => {
  try {
    // Desconectar primeiro se estiver conectado
    if (instances[clientId] && instances[clientId].sock) {
      await instances[clientId].sock.close();
    }
    
    // Reiniciar a conexão
    await initializeWhatsApp(clientId);
    
    return {
      success: true,
      message: `Conexão do cliente ${clientId} reiniciada com sucesso`
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao reiniciar conexão:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao reiniciar conexão'
    };
  }
};

module.exports = {
  initializeWhatsApp,
  sendTextMessage,
  sendImageMessage,
  sendPdfMessage,
  getQrCode,
  getConnectionStatus,
  logout,
  restartConnection,
  getActiveInstances
};
