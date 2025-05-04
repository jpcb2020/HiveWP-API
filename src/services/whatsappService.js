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

// Variáveis para armazenar o socket e informações de sessão
let sock = null;
let qrText = '';
let isConnected = false;
let connectionStatus = 'disconnected';
let sessionStatus = {};

// Diretório para armazenar as sessões
const SESSION_DIR = process.env.SESSION_DIR || './sessions';
const SESSION_ID = 'default_session';
const SESSION_PATH = path.join(SESSION_DIR, SESSION_ID);

// Verificar se o diretório de sessões existe, se não, criar
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/**
 * Inicializa a conexão com o WhatsApp
 */
const initializeWhatsApp = async () => {
  try {
    // Obter as credenciais salvas
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    
    // Buscar a versão mais recente do Baileys
    const { version } = await fetchLatestBaileysVersion();

    // Criar socket do WhatsApp
    sock = makeWASocket({
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

    // Gerenciar eventos de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Quando o QR Code estiver disponível
      if (qr) {
        qrText = qr;
        console.log('QR Code gerado. Escaneie para se conectar.');
      }

      // Quando o status de conexão mudar
      if (connection) {
        connectionStatus = connection;
        console.log('Status de conexão:', connection);
        
        // Se estiver conectado
        if (connection === 'open') {
          isConnected = true;
          console.log('Conectado com sucesso ao WhatsApp!');
        }
        
        // Se desconectado
        if (connection === 'close') {
          isConnected = false;
          
          // Tentar reconectar se não for um logout
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log('Reconectando...');
            initializeWhatsApp();
          } else {
            console.log('Desconectado do WhatsApp (logout).');
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
        console.log('Nova mensagem recebida:', JSON.stringify(message, null, 2));
        
        // Aqui você pode adicionar lógica para processar mensagens recebidas
        // e implementar respostas automáticas, etc.
      }
    });

    return sock;
  } catch (error) {
    console.error('Erro ao inicializar o WhatsApp:', error);
    return null;
  }
};

/**
 * Envia uma mensagem de texto para um número de telefone
 */
const sendTextMessage = async (phoneNumber, message) => {
  try {
    if (!isConnected || !sock) {
      return {
        success: false,
        error: 'WhatsApp não está conectado'
      };
    }
    
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
    console.error('Erro ao enviar mensagem de texto:', error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    };
  }
};

/**
 * Envia uma imagem para um número de telefone
 */
const sendImageMessage = async (phoneNumber, imageUrl, caption = '') => {
  try {
    if (!isConnected || !sock) {
      return {
        success: false,
        error: 'WhatsApp não está conectado'
      };
    }
    
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
    console.error('Erro ao enviar imagem:', error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar imagem'
    };
  }
};

/**
 * Gera uma URL do QR Code como string base64
 */
const getQrCode = async () => {
  try {
    if (!qrText) {
      return {
        success: false,
        error: 'QR Code não disponível no momento'
      };
    }
    
    // Gerar QR Code como base64
    const qrBase64 = await qrcode.toDataURL(qrText);
    
    return {
      success: true,
      qrCode: qrBase64,
      status: connectionStatus
    };
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar QR Code'
    };
  }
};

/**
 * Obtém o status da conexão atual
 */
const getConnectionStatus = () => {
  return {
    success: true,
    connected: isConnected,
    status: connectionStatus
  };
};

/**
 * Desconecta do WhatsApp
 */
const logout = async () => {
  try {
    if (!sock) {
      return {
        success: false,
        error: 'Nenhuma conexão ativa'
      };
    }
    
    // Logout do WhatsApp
    await sock.logout();
    
    // Limpar variáveis
    isConnected = false;
    connectionStatus = 'disconnected';
    qrText = '';
    
    return {
      success: true,
      message: 'Desconectado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return {
      success: false,
      error: error.message || 'Erro ao desconectar'
    };
  }
};

/**
 * Reinicia a conexão com o WhatsApp
 */
const restartConnection = async () => {
  try {
    // Desconectar primeiro se estiver conectado
    if (sock) {
      await sock.close();
    }
    
    // Reiniciar a conexão
    await initializeWhatsApp();
    
    return {
      success: true,
      message: 'Conexão reiniciada com sucesso'
    };
  } catch (error) {
    console.error('Erro ao reiniciar conexão:', error);
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
  getQrCode,
  getConnectionStatus,
  logout,
  restartConnection
};
