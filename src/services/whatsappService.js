// Garantir que o polyfill de crypto foi carregado
require('../utils/crypto-polyfill');

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

// Nome do arquivo que armazena metadados da instância
const INSTANCE_METADATA_FILE = 'instance_metadata.json';

// Controle de frequência para salvamento de metadados
const metadataLastSaved = new Map(); // Armazena o timestamp do último salvamento por clientId
const metadataCache = new Map(); // Cache do último estado salvo para comparação

// Tempo mínimo entre salvamentos consecutivos (em ms)
const METADATA_SAVE_THROTTLE = 5000; // 5 segundos

// Estados importantes que sempre devem ser salvos, independente do throttling
const CRITICAL_STATES = ['created', 'waiting_scan', 'connected', 'disconnected', 'logged_out'];

// Cache para armazenar resultados de verificação de números (para evitar verificações repetidas)
const numberVerificationCache = new Map();
// Tempo de expiração do cache em milissegundos (2 horas)
const CACHE_EXPIRATION = 2 * 60 * 60 * 1000;
// Número máximo de entradas no cache (para prevenir uso excessivo de memória)
const MAX_CACHE_SIZE = 10000;
// Contador de operações para limpar o cache a cada N operações (ao invés de usar timer)
let cacheOperationCounter = 0;
// Frequência de limpeza (a cada 1000 operações)
const CACHE_CLEANUP_FREQUENCY = 1000;

// Configuração global para ignorar grupos (pode ser sobrescrita por instância)
const DEFAULT_IGNORE_GROUPS = process.env.IGNORE_GROUPS === 'true' || false;

/**
 * Limpa entradas antigas do cache - executado apenas ocasionalmente
 * para manter desempenho máximo
 */
const cleanExpiredCacheEntries = () => {
  // Só executar a limpeza ocasionalmente para manter desempenho
  if (++cacheOperationCounter % CACHE_CLEANUP_FREQUENCY !== 0) return;
  
  // Se o cache estiver pequeno, não vale a pena limpar
  if (numberVerificationCache.size < MAX_CACHE_SIZE / 2) return;
  
  const now = Date.now();
  for (const [key, entry] of numberVerificationCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRATION) {
      numberVerificationCache.delete(key);
    }
  }
};

/**
 * Salva os metadados de uma instância para persistência
 * @param {string} clientId - ID da instância
 * @param {object} metadata - Dados a serem salvos
 * @param {boolean} force - Forçar salvamento, ignorando throttling
 */
const saveInstanceMetadata = (clientId, metadata = {}, force = false) => {
  try {
    const now = Date.now();
    const lastSaved = metadataLastSaved.get(clientId) || 0;
    const timeSinceLastSave = now - lastSaved;
    const hasCriticalChange = metadata.status && CRITICAL_STATES.includes(metadata.status);
    
    // Verificar se devemos pular este salvamento devido ao throttling
    if (!force && !hasCriticalChange && timeSinceLastSave < METADATA_SAVE_THROTTLE) {
      // Salvar apenas em memória para uso posterior
      const cachedData = metadataCache.get(clientId) || {};
      metadataCache.set(clientId, { ...cachedData, ...metadata });
      return;
    }
    
    const sessionPath = path.join(SESSION_DIR, clientId);
    
    // Criar diretório da sessão se não existir
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    // Combinar metadata existente com os novos dados
    let existingData = {};
    const metadataPath = path.join(sessionPath, INSTANCE_METADATA_FILE);
    
    if (fs.existsSync(metadataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (err) {
        console.error(`[${clientId}] Erro ao ler metadados existentes:`, err);
      }
    }
    
    // Incluir qualquer dado em cache que não foi salvo devido ao throttling
    const cachedData = metadataCache.get(clientId) || {};
    
    // Mesclar dados e salvar
    const combinedData = {
      ...existingData,
      ...cachedData, // Dados em cache pendentes
      ...metadata,    // Dados atuais
      lastUpdated: new Date().toISOString()
    };
    
    // Verificar se há mudanças significativas comparando com o último estado salvo
    const lastPersistedData = JSON.stringify(existingData);
    const newData = JSON.stringify(combinedData);
    
    if (force || lastPersistedData !== newData) {
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(combinedData, null, 2)
      );
      
      // Atualizar timestamp do último salvamento e limpar cache
      metadataLastSaved.set(clientId, now);
      metadataCache.set(clientId, {});
      
      // Reduzir verbosidade do log para estados não críticos
      if (hasCriticalChange || force) {
        console.log(`[${clientId}] Metadados da instância salvos`);
      }
    }
  } catch (error) {
    console.error(`[${clientId}] Erro ao salvar metadados:`, error);
  }
};

/**
 * Lê os metadados de uma instância
 * @param {string} clientId - ID da instância
 * @returns {object} Metadados da instância
 */
const readInstanceMetadata = (clientId) => {
  try {
    const metadataPath = path.join(SESSION_DIR, clientId, INSTANCE_METADATA_FILE);
    
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    console.error(`[${clientId}] Erro ao ler metadados:`, error);
  }
  
  return null;
};

/**
 * Verifica se uma instância existe (mesmo sem estar conectada)
 * @param {string} clientId - ID da instância
 * @returns {boolean} Verdadeiro se a instância existir
 */
const instanceExists = (clientId) => {
  const sessionPath = path.join(SESSION_DIR, clientId);
  const metadataPath = path.join(sessionPath, INSTANCE_METADATA_FILE);
  
  return fs.existsSync(metadataPath);
};

/**
 * Carrega todas as instâncias existentes na pasta de sessões
 */
const loadExistingSessions = async () => {
  try {
    // Ler os diretórios dentro da pasta de sessões
    const sessionDirs = fs.readdirSync(SESSION_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Encontradas ${sessionDirs.length} sessões existentes:`, sessionDirs);
    
    // Instâncias carregadas com sucesso
    const loadedInstances = [];
    
    // Inicializar cada instância encontrada
    for (const clientId of sessionDirs) {
      // Verificar se há metadados da instância
      if (instanceExists(clientId)) {
        console.log(`Carregando instância: ${clientId}`);
        
        try {
          // Inicializar a conexão do WhatsApp para esta instância
          await initializeWhatsApp(clientId);
          loadedInstances.push(clientId);
          console.log(`Instância ${clientId} reconectada com sucesso`);
        } catch (error) {
          console.error(`Erro ao reconectar instância ${clientId}:`, error);
        }
      }
    }
    
    return loadedInstances;
  } catch (error) {
    console.error('Erro ao carregar sessões existentes:', error);
    return [];
  }
};

/**
 * Retorna a lista de instâncias ativas
 */
const getActiveInstances = () => {
  return Object.keys(instances).map(id => ({
    id,
    connected: instances[id]?.isConnected || false,
    status: instances[id]?.connectionStatus || 'disconnected',
    config: {
      ignoreGroups: instances[id]?.ignoreGroups || false,
      webhookUrl: instances[id]?.webhookUrl || ''
    }
  }));
};

/**
 * Inicializa a conexão com o WhatsApp para um cliente específico
 * @param {string} clientId - Identificador único do cliente
 * @param {object} options - Opções de configuração adicionais
 */
const initializeWhatsApp = async (clientId = 'default', options = {}) => {
  try {
    // Criar diretório específico para o cliente se não existir
    const SESSION_PATH = path.join(SESSION_DIR, clientId);
    if (!fs.existsSync(SESSION_PATH)) {
      fs.mkdirSync(SESSION_PATH, { recursive: true });
    }
    
    // Ler metadados existentes da instância
    const metadata = readInstanceMetadata(clientId) || {};
    
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
        connectionStatus: 'disconnected',
        ignoreGroups: options.ignoreGroups !== undefined ? options.ignoreGroups : (metadata.ignoreGroups || DEFAULT_IGNORE_GROUPS),
        webhookUrl: options.webhookUrl || metadata.webhookUrl || '',
        created: metadata.created || new Date().toISOString()
      };
    } else {
      // Atualizar configurações se fornecidas
      if (options.ignoreGroups !== undefined) {
        instances[clientId].ignoreGroups = options.ignoreGroups;
      }
      if (options.webhookUrl !== undefined) {
        instances[clientId].webhookUrl = options.webhookUrl;
      }
    }
    
    // Salvar metadados logo que a instância é criada/atualizada
    saveInstanceMetadata(clientId, {
      ignoreGroups: instances[clientId].ignoreGroups,
      webhookUrl: instances[clientId].webhookUrl,
      created: instances[clientId].created,
      status: 'created'
    });

    // Configuração de logger personalizada para reduzir ruído no terminal
    const logger = pino({
      level: process.env.BAILEYS_LOG_LEVEL || 'warn',  // Usar 'warn' como padrão, mas permitir configuração
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'SYS:standard',
          ignore: 'hostname,pid',
        },
      },
    });
    
    // Criar socket do WhatsApp com configurações otimizadas
    instances[clientId].sock = makeWASocket({
      version,
      logger: logger,
      printQRInTerminal: true,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      browser: ['HiveWP API', 'Chrome', '104.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,  // Reduzir carga no servidor
      retryRequestDelayMs: 2000,   // Aumentar tempo entre tentativas
      connectTimeoutMs: 30000,     // Timeout para conexão inicial
      keepAliveIntervalMs: 25000,  // Manter conexão ativa
      emitOwnEvents: false         // Reduzir processamento de eventos
    });

    const sock = instances[clientId].sock;

    // Gerenciar eventos de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Quando o QR Code estiver disponível
      if (qr) {
        instances[clientId].qrText = qr;
        console.log(`[${clientId}] QR Code gerado. Escaneie para se conectar.`);
        
        // Atualizar status nos metadados
        saveInstanceMetadata(clientId, {
          lastQRTimestamp: new Date().toISOString(),
          status: 'waiting_scan'
        });
      }

      // Quando o status de conexão mudar
      if (connection) {
        instances[clientId].connectionStatus = connection;
        console.log(`[${clientId}] Status de conexão:`, connection);
        
        // Se estiver conectado
        if (connection === 'open') {
          instances[clientId].isConnected = true;
          console.log(`[${clientId}] Conectado com sucesso ao WhatsApp!`);
          
          // Atualizar status nos metadados
          saveInstanceMetadata(clientId, {
            status: 'connected',
            lastConnection: new Date().toISOString()
          });
        }
        
        // Se desconectado
        if (connection === 'close') {
          instances[clientId].isConnected = false;
          
          // Atualizar status nos metadados
          saveInstanceMetadata(clientId, {
            status: 'disconnected',
            lastDisconnection: new Date().toISOString()
          });
          
          // Tentar reconectar se não for um logout, mas com backoff exponencial
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode !== DisconnectReason.loggedOut) {
            // Obter tentativas de reconexão atuais ou iniciar com 0
            instances[clientId].reconnectAttempts = instances[clientId].reconnectAttempts || 0;
            instances[clientId].reconnectAttempts++;
            
            // Cálculo de backoff exponencial: entre 3-10 segundos baseado no número de tentativas
            // Limitado a no máximo 5 minutos entre tentativas
            const delaySeconds = Math.min(300, Math.pow(1.5, Math.min(instances[clientId].reconnectAttempts, 10)) * 3);
            
            console.log(`[${clientId}] Reconectando em ${delaySeconds.toFixed(0)} segundos... (Tentativa ${instances[clientId].reconnectAttempts})`);
            
            // Salvar informações de reconexão nos metadados
            saveInstanceMetadata(clientId, {
              reconnectAttempts: instances[clientId].reconnectAttempts,
              nextReconnectTime: new Date(Date.now() + delaySeconds * 1000).toISOString()
            });
            
            // Agendar reconexão com atraso
            setTimeout(() => {
              // Verificar se a instância ainda existe e precisa reconectar
              if (instances[clientId] && !instances[clientId].isConnected) {
                initializeWhatsApp(clientId);
              }
            }, delaySeconds * 1000);
          } else {
            console.log(`[${clientId}] Desconectado do WhatsApp (logout).`);
            // Atualizar metadados para indicar logout
            saveInstanceMetadata(clientId, {
              status: 'logged_out',
              logoutTime: new Date().toISOString()
            });
            
            // Remover apenas os arquivos de credenciais, preservando metadados
            const credsPath = path.join(SESSION_PATH, 'creds.json');
            if (fs.existsSync(credsPath)) {
              console.log(`[${clientId}] Removendo apenas credenciais, preservando metadados.`);
              fs.unlinkSync(credsPath);
            }
            
            // Remover arquivos de chave para evitar problemas de autenticação
            const authFilesPattern = /auth|pre-key|session|sender|app-state/;
            const files = fs.readdirSync(SESSION_PATH);
            for (const file of files) {
              if (authFilesPattern.test(file)) {
                fs.unlinkSync(path.join(SESSION_PATH, file));
              }
            }
          }
        }
      }
    });

    // Salvar as credenciais quando atualizadas
    sock.ev.on('creds.update', async (creds) => {
      await saveCreds();
      
      // Atualizar status nos metadados
      saveInstanceMetadata(clientId, {
        hasCredentials: true
      });
    });
    
    // Gerenciar eventos de mensagens
    sock.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0];
      
      if (!message.key.fromMe && m.type === 'notify') {
        // Verificar se é uma mensagem de grupo (remoteJid termina com @g.us)
        const isGroupMessage = message.key.remoteJid?.endsWith('@g.us') || false;
        
        // Verificar se devemos ignorar esta mensagem de grupo
        if (isGroupMessage && instances[clientId].ignoreGroups) {
          console.log(`[${clientId}] Mensagem de grupo ignorada: ${message.key.remoteJid}`);
          return; // Não processa mensagens de grupo se ignoreGroups estiver ativado
        }
        
        console.log(`[${clientId}] Nova mensagem recebida:`, JSON.stringify(message, null, 2));
        
        // Simplificar estrutura da mensagem para o webhook
        const simplifiedMessage = {
          id: message.key.id,
          from: message.key.remoteJid,
          fromMe: message.key.fromMe,
          timestamp: message.messageTimestamp,
          isGroup: isGroupMessage,
          type: 'unknown'
        };
        
        // Extrair conteúdo da mensagem
        if (message.message?.conversation) {
          // Texto simples
          simplifiedMessage.type = 'text';
          simplifiedMessage.body = message.message.conversation;
        } 
        else if (message.message?.extendedTextMessage) {
          // Texto com formatação
          simplifiedMessage.type = 'text';
          simplifiedMessage.body = message.message.extendedTextMessage.text;
          
          // Verificar se há uma citação (mensagem respondida)
          if (message.message.extendedTextMessage.contextInfo?.quotedMessage) {
            simplifiedMessage.quotedMessage = {
              id: message.message.extendedTextMessage.contextInfo.stanzaId,
              participant: message.message.extendedTextMessage.contextInfo.participant
            };
          }
        }
        else if (message.message?.imageMessage) {
          // Imagem
          simplifiedMessage.type = 'image';
          simplifiedMessage.caption = message.message.imageMessage.caption || '';
          simplifiedMessage.mimetype = message.message.imageMessage.mimetype;
        }
        else if (message.message?.videoMessage) {
          // Vídeo
          simplifiedMessage.type = 'video';
          simplifiedMessage.caption = message.message.videoMessage.caption || '';
          simplifiedMessage.mimetype = message.message.videoMessage.mimetype;
        }
        else if (message.message?.documentMessage) {
          // Documento
          simplifiedMessage.type = 'document';
          simplifiedMessage.fileName = message.message.documentMessage.fileName || '';
          simplifiedMessage.mimetype = message.message.documentMessage.mimetype;
        }
        else if (message.message?.audioMessage || message.message?.pttMessage) {
          // Áudio ou PTT (mensagem de voz)
          const audioMessage = message.message.audioMessage || message.message.pttMessage;
          simplifiedMessage.type = audioMessage.ptt ? 'ptt' : 'audio';
          simplifiedMessage.seconds = audioMessage.seconds || 0;
          simplifiedMessage.mimetype = audioMessage.mimetype;
          
          try {
            console.log(`[${clientId}] Mensagem de áudio detectada, extraindo conteúdo...`);
            
            // Baixar o conteúdo do áudio
            const stream = await downloadContentFromMessage(audioMessage, 'audio');
            let buffer = Buffer.from([]);
            
            // Acumular chunks no buffer
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            
            // Converter para base64
            const base64Audio = buffer.toString('base64');
            
            // Adicionar base64 à mensagem simplificada
            simplifiedMessage.base64Audio = base64Audio;
            
            console.log(`[${clientId}] Áudio extraído e convertido para base64 com sucesso`);
          } catch (audioError) {
            console.error(`[${clientId}] Erro ao extrair áudio:`, audioError);
            simplifiedMessage.error = 'Falha ao extrair áudio: ' + audioError.message;
          }
        }
        else if (message.message?.locationMessage) {
          // Localização
          simplifiedMessage.type = 'location';
          simplifiedMessage.latitude = message.message.locationMessage.degreesLatitude;
          simplifiedMessage.longitude = message.message.locationMessage.degreesLongitude;
        }
        else if (message.message?.contactMessage) {
          // Contato
          simplifiedMessage.type = 'contact';
          simplifiedMessage.name = message.message.contactMessage.displayName;
          simplifiedMessage.vcard = message.message.contactMessage.vcard;
        }
        else if (message.message?.reactionMessage) {
          // Reação
          simplifiedMessage.type = 'reaction';
          simplifiedMessage.emoji = message.message.reactionMessage.text;
          simplifiedMessage.targetMessageId = message.message.reactionMessage.key.id;
        }
        
        // Enviar para webhook, se configurado
        if (instances[clientId].webhookUrl) {
          try {
            const webhookData = {
              clientId,
              timestamp: new Date().toISOString(),
              message: simplifiedMessage,
              originalMessage: message // Opcional: mantém a mensagem original para casos específicos
            };
            
            console.log(`[${clientId}] Enviando mensagem para webhook: ${instances[clientId].webhookUrl}`);
            await sendToWebhook(instances[clientId].webhookUrl, webhookData);
          } catch (webhookError) {
            console.error(`[${clientId}] Erro ao enviar para webhook:`, webhookError);
          }
        }
        
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
 * Função para enviar dados para um webhook
 * @param {string} webhookUrl - URL do webhook
 * @param {object} data - Dados a serem enviados
 */
const sendToWebhook = async (webhookUrl, data) => {
  if (!webhookUrl) return;
  
  try {
    // Usar o módulo https ou http dependendo da URL
    const httpModule = webhookUrl.startsWith('https') ? require('https') : require('http');
    const url = new URL(webhookUrl);
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const req = httpModule.request(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        });
      });
      
      req.on('error', (error) => {
        console.error(`Erro ao enviar para webhook: ${error.message}`);
        reject(error);
      });
      
      req.write(JSON.stringify(data));
      req.end();
    });
  } catch (error) {
    console.error(`Erro ao processar envio para webhook: ${error.message}`);
  }
};

/**
 * Formata um número de telefone para o formato WhatsApp (versão ultra-rápida)
 * @param {string} phoneNumber - Número de telefone a formatar
 * @returns {string} - Número formatado
 */
const formatPhoneNumber = (phoneNumber) => {
  // Se já for um JID do WhatsApp, retornar como está
  if (phoneNumber.includes('@')) return phoneNumber;
  
  // Remover todos os caracteres não numéricos com RegExp otimizada
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Adicionar o sufixo do WhatsApp - sem validações extensivas para máxima velocidade
  return cleaned + '@s.whatsapp.net';
};

/**
 * Verifica se um número está registrado no WhatsApp
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone a verificar
 * @returns {Promise<object>} - Objeto com status da verificação
 */
const checkNumberExists = async (clientId = 'default', phoneNumber) => {
  try {
    if (!instances[clientId]?.sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    // Formatar o número (ultra-rápido)
    const jid = formatPhoneNumber(phoneNumber);
    
    // Verificar cache primeiro (look-up O(1) - extremamente rápido)
    const cacheKey = `${clientId}:${jid}`;
    const cachedResult = numberVerificationCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_EXPIRATION)) {
      // Cache hit - retorno instantâneo
      return cachedResult.result;
    }
    
    // Cache miss - fazer a verificação real
    const sock = instances[clientId].sock;
    const [result] = await sock.onWhatsApp(jid);
    
    const verificationResult = result?.exists 
      ? { success: true, exists: true, phoneNumber: jid, jid: result.jid }
      : { success: true, exists: false, phoneNumber: jid };
    
    // Armazenar no cache
    numberVerificationCache.set(cacheKey, {
      result: verificationResult,
      timestamp: Date.now()
    });
    
    // Limpar cache se necessário
    cleanExpiredCacheEntries();
    
    return verificationResult;
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao verificar número'
    };
  }
};

/**
 * Função auxiliar para validar o número antes de enviar mensagens
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone a validar
 */
const validatePhoneNumber = async (clientId, phoneNumber) => {
  const result = await checkNumberExists(clientId, phoneNumber);
  
  if (!result.success) {
    return result;
  }
  
  if (!result.exists) {
    return {
      success: false,
      error: `O número ${phoneNumber} não está registrado no WhatsApp`,
      notRegistered: true
    };
  }
  
  return { success: true, jid: result.jid };
};

/**
 * Envia uma mensagem de texto para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} message - Mensagem de texto a ser enviada
 * @param {boolean} simulateTyping - Se true, simula digitação antes de enviar (opcional)
 * @param {number} typingDurationMs - Duração da simulação de digitação em ms (opcional, padrão: 1500ms)
 */
const sendTextMessage = async (clientId = 'default', phoneNumber, message, simulateTyping = false, typingDurationMs = 1500) => {
  try {
    if (!instances[clientId]?.sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    // Verificar se o número existe no WhatsApp
    const validation = await validatePhoneNumber(clientId, phoneNumber);
    if (!validation.success) return validation;
    
    // Usar diretamente o JID retornado pela validação
    const jid = validation.jid;
    
    // Se a opção de simular digitação estiver ativada
    if (simulateTyping) {
      try {
        // Enviar estado de "digitando..."
        await instances[clientId].sock.sendPresenceUpdate('composing', jid);
        
        // Esperar pelo tempo especificado para simular a digitação
        await new Promise(resolve => setTimeout(resolve, typingDurationMs));
        
        // Parar de "digitar" antes de enviar a mensagem
        await instances[clientId].sock.sendPresenceUpdate('paused', jid);
      } catch (typingError) {
        // Se houver erro na simulação de digitação, apenas log e continua para enviar a mensagem
        console.error(`[${clientId}] Erro ao simular digitação:`, typingError);
      }
    }
    
    // Enviar mensagem de texto
    await instances[clientId].sock.sendMessage(jid, { text: message });
    
    return { 
      success: true, 
      message: 'Mensagem enviada com sucesso',
      withTypingSimulation: simulateTyping
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
 * Envia uma mídia (imagem, documento ou qualquer tipo de arquivo) para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} mediaUrl - URL ou caminho local do arquivo
 * @param {string} filename - Nome do arquivo
 * @param {string} mimetype - Tipo MIME da mídia (opcional)
 * @param {string} caption - Legenda opcional
 */
const sendMediaMessage = async (clientId = 'default', phoneNumber, mediaUrl, filename, mimetype, caption = '') => {
  try {
    if (!instances[clientId]?.sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    // Verificar se o número existe no WhatsApp
    const validation = await validatePhoneNumber(clientId, phoneNumber);
    if (!validation.success) return validation;
    
    // Usar diretamente o JID retornado pela validação
    const jid = validation.jid;
    
    // Verificar se a URL é válida ou se é um caminho local (simplificado)
    if (!mediaUrl.startsWith('http') && !fs.existsSync(mediaUrl)) {
      return {
        success: false,
        error: 'URL da mídia inválida ou arquivo não encontrado'
      };
    }
    
    // Determinar o nome do arquivo se não foi especificado
    const detectedFilename = filename 
      ? decodeURIComponent(filename)
      : decodeURIComponent(mediaUrl.split('/').pop().split('?')[0] || 'arquivo');
    
    // Determinar o tipo MIME baseado na extensão do arquivo se não foi especificado
    let detectedMimetype = mimetype;
    if (!detectedMimetype) {
      const fileExtension = detectedFilename.split('.').pop().toLowerCase();
      
      const mimeTypes = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        'json': 'application/json',
        'xml': 'application/xml'
      };
      
      detectedMimetype = mimeTypes[fileExtension] || 'application/octet-stream';
    }
    
    let messageOptions;
    let mediaType = 'document'; // Tipo padrão
    
    // Identificar o tipo de mídia para enviar com o método mais apropriado
    if (detectedMimetype.startsWith('image/')) {
      // É uma imagem
      messageOptions = {
        image: { url: mediaUrl },
        caption: caption || undefined
      };
      mediaType = 'imagem';
    } else if (detectedMimetype.startsWith('video/')) {
      // É um vídeo
      messageOptions = {
        video: { url: mediaUrl },
        caption: caption || undefined,
        fileName: detectedFilename
      };
      mediaType = 'vídeo';
    } else if (detectedMimetype.startsWith('audio/')) {
      // É um áudio
      messageOptions = {
        audio: { url: mediaUrl },
        mimetype: detectedMimetype,
        fileName: detectedFilename
      };
      mediaType = 'áudio';
    } else {
      // Outros tipos como documento
      messageOptions = {
        document: { url: mediaUrl },
        mimetype: detectedMimetype,
        fileName: detectedFilename,
        caption: caption || undefined
      };
      
      // Adicionar configurações especiais para PDFs para garantir o preview
      if (detectedMimetype === 'application/pdf') {
        messageOptions.jpegThumbnail = null; // O Baileys vai gerar um thumbnail automaticamente
      }
    }
    
    // Enviar a mensagem
    await instances[clientId].sock.sendMessage(jid, messageOptions);
    
    return {
      success: true,
      message: `${mediaType} enviada com sucesso`,
      type: detectedMimetype,
      filename: detectedFilename
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao enviar mídia:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar mídia'
    };
  }
};

/**
 * Envia uma mensagem de áudio para um número de telefone
 * @param {string} clientId - Identificador do cliente
 * @param {string} phoneNumber - Número de telefone de destino
 * @param {string} audioUrl - URL ou caminho local do arquivo de áudio
 * @param {string} caption - Legenda opcional para o áudio
 * @param {string} mimetype - Tipo MIME opcional (se não fornecido, será detectado automaticamente)
 */
const sendAudioMessage = async (clientId = 'default', phoneNumber, audioUrl, caption = '', mimetype = null) => {
  try {
    if (!instances[clientId]?.sock) {
      return {
        success: false,
        error: `WhatsApp do cliente ${clientId} não está conectado`
      };
    }
    
    // Verificar se o número existe no WhatsApp
    const validation = await validatePhoneNumber(clientId, phoneNumber);
    if (!validation.success) return validation;
    
    // Usar diretamente o JID retornado pela validação
    const jid = validation.jid;
    
    // Determinar se é URL ou arquivo local com verificação rápida
    const isUrl = audioUrl.startsWith('http') && (audioUrl.includes('://'));
    let buffer;
    
    // Obter o buffer da mídia (otimizado para velocidade)
    if (isUrl) {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Falha ao baixar áudio: ${response.status}`);
        }
        buffer = await response.arrayBuffer();
        buffer = Buffer.from(buffer);
      } catch (fetchError) {
        return {
          success: false,
          error: `Erro ao baixar áudio: ${fetchError.message}`
        };
      }
    } else {
      try {
        // Verificação de existência sem try-catch para melhor performance
        if (!fs.existsSync(audioUrl)) {
          return {
            success: false,
            error: `Arquivo de áudio não encontrado: ${audioUrl}`
          };
        }
        // Leitura direta do arquivo para o buffer
        buffer = fs.readFileSync(audioUrl);
      } catch (fsError) {
        return {
          success: false,
          error: `Erro ao ler arquivo de áudio: ${fsError.message}`
        };
      }
    }
    
    // Verificação ultra-rápida de buffer
    if (!buffer?.length) {
      return {
        success: false,
        error: 'Buffer de áudio vazio ou inválido'
      };
    }
    
    // Detectar o tipo MIME baseado na extensão do arquivo (mapeamento pré-definido para performance)
    if (!mimetype) {
      const extension = audioUrl.split('.').pop().toLowerCase();
      
      // Mapeamento de extensões para tipos MIME (padrões web otimizados para compatibilidade)
      const mimeTypes = {
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'opus': 'audio/opus',
        'wav': 'audio/wav',
        'flac': 'audio/flac',
        'webm': 'audio/webm'
      };
      
      mimetype = mimeTypes[extension] || 'audio/mpeg';
    }
    
    // Enviar o áudio com configuração mínima necessária para máxima performance
    const messageResponse = await instances[clientId].sock.sendMessage(jid, {
      audio: buffer,
      ptt: true,
      mimetype
    });
    
    // Resposta otimizada com informações essenciais
    return {
      success: true,
      message: 'Áudio enviado com sucesso',
      format: mimetype,
      messageId: messageResponse?.key?.id
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao enviar áudio:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar áudio'
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

/**
 * Remove uma instância específica e limpa os recursos associados
 * @param {string} clientId - Identificador do cliente
 */
const deleteInstance = async (clientId = 'default') => {
  try {
    if (!instances[clientId]) {
      return {
        success: false,
        error: `Instância para o cliente ${clientId} não encontrada`
      };
    }
    
    // Desconectar a instância se estiver conectada
    if (instances[clientId].sock) {
      try {
        // Tentar fazer logout antes de deletar
        await instances[clientId].sock.logout().catch(() => {});
        await instances[clientId].sock.close().catch(() => {});
      } catch (logoutError) {
        console.error(`[${clientId}] Erro ao desconectar durante exclusão:`, logoutError);
        // Continue com a exclusão mesmo se o logout falhar
      }
    }
    
    // Remover a instância do objeto de instâncias
    delete instances[clientId];
    
    // Opcional: Remover diretório de sessão se necessário
    const SESSION_PATH = path.join(SESSION_DIR, clientId);
    if (fs.existsSync(SESSION_PATH)) {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    }
    
    return {
      success: true,
      message: `Instância para cliente ${clientId} removida com sucesso`
    };
  } catch (error) {
    console.error(`[${clientId}] Erro ao deletar instância:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao deletar instância'
    };
  }
};

/**
 * Atualiza as configurações de uma instância
 * @param {string} clientId - Identificador do cliente
 * @param {object} config - Configurações a serem atualizadas
 * @returns {object} - Resultado da atualização
 */
const updateInstanceConfig = (clientId = 'default', config = {}) => {
  try {
    if (!instances[clientId]) {
      return {
        success: false,
        error: `Cliente ${clientId} não encontrado`
      };
    }
    
    // Atualizar apenas as configurações fornecidas
    let configChanged = false;
    
    if (config.ignoreGroups !== undefined) {
      instances[clientId].ignoreGroups = !!config.ignoreGroups;
      configChanged = true;
    }
    
    if (config.webhookUrl !== undefined) {
      instances[clientId].webhookUrl = config.webhookUrl;
      configChanged = true;
    }
    
    // Forçar o salvamento imediato dos metadados quando as configurações são alteradas
    if (configChanged) {
      // Salvar metadados com força=true para ignorar throttling
      saveInstanceMetadata(clientId, {
        ignoreGroups: instances[clientId].ignoreGroups,
        webhookUrl: instances[clientId].webhookUrl,
        configUpdatedAt: new Date().toISOString()
      }, true);
      
      console.log(`[${clientId}] Configurações atualizadas e salvas imediatamente`);
    }
    
    return {
      success: true,
      message: `Configurações do cliente ${clientId} atualizadas com sucesso`,
      config: {
        ignoreGroups: instances[clientId].ignoreGroups,
        webhookUrl: instances[clientId].webhookUrl
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar configurações'
    };
  }
};

module.exports = {
  initializeWhatsApp,
  sendTextMessage,
  sendMediaMessage,
  sendAudioMessage,
  getQrCode,
  getConnectionStatus,
  logout,
  restartConnection,
  getActiveInstances,
  deleteInstance,
  loadExistingSessions,
  checkNumberExists,
  validatePhoneNumber,
  updateInstanceConfig,
  sendToWebhook
};
