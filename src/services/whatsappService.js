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
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { getLogger } = require('../config/logger');

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

// Logger específico para o serviço
const serviceLogger = getLogger('whatsapp-service');

/**
 * Cria um agente proxy baseado na URL fornecida
 * @param {string} proxyUrl - URL do proxy (ex: socks5://user:pass@host:port ou http://host:port)
 * @returns {Agent|null} Agente proxy configurado ou null se inválido
 */
const createProxyAgent = (proxyUrl) => {
  if (!proxyUrl) return null;
  
  try {
    const url = new URL(proxyUrl);
    
    if (url.protocol === 'socks4:' || url.protocol === 'socks5:') {
      serviceLogger.info(`Configurando proxy SOCKS: ${url.protocol}//[REDACTED]@${url.hostname}:${url.port}`);
      return new SocksProxyAgent(proxyUrl);
    }
    
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      serviceLogger.info(`Configurando proxy HTTP: ${url.protocol}//[REDACTED]@${url.hostname}:${url.port}`);
      return new HttpsProxyAgent(proxyUrl);
    }
    
    serviceLogger.warn(`Protocolo de proxy não suportado: ${url.protocol}`);
    return null;
  } catch (error) {
    serviceLogger.error(`Erro ao criar agente proxy: ${error.message}`);
    return null;
  }
};

/**
 * Limpa entradas antigas do cache - executado apenas ocasionalmente
 * para manter desempenho máximo
 */
const cleanExpiredCacheEntries = () => {
  if (++cacheOperationCounter % CACHE_CLEANUP_FREQUENCY !== 0) return;
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
    
    if (!force && !hasCriticalChange && timeSinceLastSave < METADATA_SAVE_THROTTLE && Object.keys(metadata).length > 0) {
      const cachedData = metadataCache.get(clientId) || {};
      metadataCache.set(clientId, { ...cachedData, ...metadata });
      return;
    }
    
    const sessionPath = path.join(SESSION_DIR, clientId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    
    let existingData = {};
    const metadataPath = path.join(sessionPath, INSTANCE_METADATA_FILE);
    
    if (fs.existsSync(metadataPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (err) {
        serviceLogger.error(`[${clientId}] Erro ao ler metadados existentes:`, err);
      }
    }
    
    const cachedDataToPersist = metadataCache.get(clientId) || {};
    const combinedData = {
      ...existingData,
      ...cachedDataToPersist,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    const lastPersistedDataString = JSON.stringify(existingData);
    const newDataString = JSON.stringify(combinedData);

    if (force || lastPersistedDataString !== newDataString || Object.keys(cachedDataToPersist).length > 0) {
      fs.writeFileSync(metadataPath, JSON.stringify(combinedData, null, 2));
      metadataLastSaved.set(clientId, now);
      metadataCache.delete(clientId); // Limpa o cache após persistir
      if (hasCriticalChange || force || Object.keys(cachedDataToPersist).length > 0) {
        serviceLogger.info(`[${clientId}] Metadados da instância salvos. Status: ${combinedData.status}`);
      }
    } else {
       // serviceLogger.debug(`[${clientId}] Metadados não alterados, não salvando em disco.`);
    }
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao salvar metadados:`, error);
  }
};

/**
 * Lê os metadados de uma instância
 * @param {string} clientId - ID da instância
 * @returns {object | null} Metadados da instância ou null se não encontrado/erro
 */
const readInstanceMetadata = (clientId) => {
  try {
    const metadataPath = path.join(SESSION_DIR, clientId, INSTANCE_METADATA_FILE);
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao ler metadados:`, error);
  }
  return null;
};

/**
 * Verifica se uma instância existe (ou seja, tem um diretório de sessão e metadados)
 * @param {string} clientId - ID da instância
 * @returns {boolean} Verdadeiro se a instância existir
 */
const instanceExists = (clientId) => {
  const metadataPath = path.join(SESSION_DIR, clientId, INSTANCE_METADATA_FILE);
  return fs.existsSync(metadataPath);
};

/**
 * Retorna uma lista de IDs de clientes com sessões salvas e seus metadados básicos.
 * Não tenta mais conectar as instâncias na inicialização.
 */
const loadExistingSessions = async () => {
  const sessionFolders = fs.readdirSync(SESSION_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const loadedInstancesInfo = [];

  for (const clientId of sessionFolders) {
    const metadata = readInstanceMetadata(clientId);
    if (metadata) {
      // Adiciona ao objeto global de instâncias deste worker, mas sem socket ativo ainda.
      // O status pode ser 'disconnected', 'logged_out' conforme metadados, ou um novo 'dormant'/ 'available'.
      // Vamos usar o status dos metadados ou 'available' se não houver um status claro.
      instances[clientId] = {
        id: clientId,
        status: metadata.status || 'available', // 'available' significa que existe, mas não está ativa no worker
        qrCode: null,
        socket: null,
        lastConnectionAttempt: null,
        retries: 0,
        config: { // Carregar configuração salva dos metadados
          ignoreGroups: metadata.ignoreGroups !== undefined ? metadata.ignoreGroups : DEFAULT_IGNORE_GROUPS,
          webhookUrl: metadata.webhookUrl || null,
          proxyUrl: metadata.proxyUrl || null,
        },
        metadata: metadata // Armazenar metadados completos para referência
      };
      loadedInstancesInfo.push({ 
        clientId: clientId, 
        status: instances[clientId].status,
        metadata: metadata // Pode ser útil para a chamada em index.js
      });
    } else {
      // Se não há metadados, mas a pasta existe, podemos registrar isso.
      // Ou podemos optar por ignorar/limpar essas pastas órfãs em outro momento.
      serviceLogger.warn(`[${clientId}] Pasta de sessão encontrada sem arquivo de metadados. Ignorando por enquanto.`);
    }
  }
  // Retorna informações sobre as instâncias encontradas, não as instâncias conectadas.
  return loadedInstancesInfo; 
};

/**
 * Retorna a lista de instâncias ativas
 */
const getActiveInstances = () => {
  return Object.keys(instances).map(id => ({
    id,
    status: instances[id]?.status || 'unknown',
    qrCode: !!instances[id]?.qrCode, // Indica se há um QR code atualmente para esta instância no worker
    connected: instances[id]?.status === 'connected',
    config: instances[id]?.config || {},
    lastConnectionAttempt: instances[id]?.lastConnectionAttempt,
    lastConnectionUpdate: instances[id]?.lastConnectionUpdate
  }));
};

/**
 * Garante que uma instância do WhatsApp esteja ativa e conectada neste worker.
 */
const ensureInstanceActive = async (clientId, options = {}, isExplicitInitAttempt = false) => {
  serviceLogger.info(`[${clientId}] EnsureInstanceActive: Tentativa explícita de init: ${isExplicitInitAttempt}, Opções: ${JSON.stringify(options)}`);
  let instance = instances[clientId];

  if (instance && instance.socket && instance.status === 'connected') {
    serviceLogger.debug(`[${clientId}] Instância já conectada neste worker.`);
    if (isExplicitInitAttempt && options && Object.keys(options).length > 0) updateInstanceConfig(clientId, options);
    return instance;
  }

  if (instance && (instance.status === 'connecting' || instance.status === 'waiting_scan')) {
    serviceLogger.info(`[${clientId}] Instância já em processo de ativação (status: ${instance.status}). Aguardando conclusão.`);
    // Poderia retornar uma promise que aguarda a conclusão, mas por ora é simples.
    // Se for uma tentativa explícita de init com novas opções, atualiza config.
    if (isExplicitInitAttempt && options && Object.keys(options).length > 0) updateInstanceConfig(clientId, options);
    // Aguarda um tempo para a conexão em progresso resolver
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    return instances[clientId]; // Retorna o estado atualizado
  }

  if (!instance && fs.existsSync(path.join(SESSION_DIR, clientId))) {
    serviceLogger.info(`[${clientId}] Diretório de sessão encontrado, mas instância não carregada no worker. Carregando...`);
    const metadata = readInstanceMetadata(clientId) || {};
    instances[clientId] = {
        id: clientId, status: metadata.status || 'disconnected', qrCode: null, socket: null, retries: 0,
        lastConnectionAttempt: null, lastConnectionUpdate: null,
        config: { 
            ignoreGroups: metadata.ignoreGroups !== undefined ? metadata.ignoreGroups : (options.ignoreGroups !== undefined ? options.ignoreGroups : DEFAULT_IGNORE_GROUPS),
            webhookUrl: metadata.webhookUrl || options.webhookUrl || null,
            proxyUrl: metadata.proxyUrl || options.proxyUrl || null,
         },
        metadata
    };
    instance = instances[clientId];
    serviceLogger.info(`[${clientId}] Instância carregada dos metadados. Status: ${instance.status}`);
  } else if (!instance && !isExplicitInitAttempt) {
    serviceLogger.warn(`[${clientId}] Instância não encontrada, não existe sessão salva e não é init explícito. Falha.`);
    throw new Error(`Instância ${clientId} não encontrada.`);
  } else if (!instance && isExplicitInitAttempt) {
    serviceLogger.info(`[${clientId}] Nova instância (sem sessão salva) e init explícito. Criando estrutura.`);
    instances[clientId] = {
        id: clientId, status: 'creating', qrCode: null, socket: null, retries: 0,
        lastConnectionAttempt: null, lastConnectionUpdate: null,
        config: { 
            ignoreGroups: options.ignoreGroups !== undefined ? options.ignoreGroups : DEFAULT_IGNORE_GROUPS,
            webhookUrl: options.webhookUrl || null,
            proxyUrl: options.proxyUrl || null,
        },
        metadata: {}
    };
    instance = instances[clientId];
  }

  // Atualiza a configuração da instância com opções, se fornecidas.
  if (options && Object.keys(options).length > 0) {
    const newConfig = {
        ...instance.config,
        ...(options.ignoreGroups !== undefined && { ignoreGroups: !!options.ignoreGroups }),
        ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
        ...(options.proxyUrl !== undefined && { proxyUrl: options.proxyUrl }),
    };
    if (JSON.stringify(instance.config) !== JSON.stringify(newConfig)) {
        instance.config = newConfig;
        serviceLogger.info(`[${clientId}] Configuração da instância atualizada em ensureInstanceActive: ${JSON.stringify(instance.config)}`);
        // Salva metadados aqui pois a config mudou ANTES de tentar conectar
        saveInstanceMetadata(clientId, { status: instance.status, ...instance.config }); 
    }
  }
  
  serviceLogger.info(`[${clientId}] Chamando _initializeAndConnectSocket. Status atual: ${instance.status}. É init explícito/criação: ${isExplicitInitAttempt || instance.status === 'creating'}`);
  try {
    await _initializeAndConnectSocket(clientId, instance.config, isExplicitInitAttempt || instance.status === 'creating');
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro em _initializeAndConnectSocket chamado por ensureInstanceActive: ${error.message}`, error);
    // Não propaga o erro aqui se for init explícito, o status da instância deve refletir a falha.
    // Se não for init explícito, a chamada (ex: sendText) precisa saber da falha.
    if (!isExplicitInitAttempt && instance.status !== 'connected' && instance.status !== 'waiting_scan') {
        throw error; 
    }
  }
  return instances[clientId]; 
};

/**
 * Lógica interna principal para configurar e conectar o socket Baileys.
 */
const _initializeAndConnectSocket = async (clientId, currentConfig, isNewSessionRequest) => {
  let instance = instances[clientId];
  serviceLogger.info(`[${clientId}] _initializeAndConnectSocket: Iniciando. Nova sessão/QR?: ${isNewSessionRequest}. Config: ${JSON.stringify(currentConfig)}`);

  if (instance.status === 'connecting' || instance.status === 'waiting_scan') {
    if (Date.now() - (instance.lastConnectionAttempt || 0) < (parseInt(process.env.CONNECT_TIMEOUT_MS) || 30000)) {
      serviceLogger.warn(`[${clientId}] Conexão já em progresso (status: ${instance.status}). Abortando nova tentativa.`);
      return;
    }
    serviceLogger.warn(`[${clientId}] Conexão anterior em progresso (status: ${instance.status}) mas timeoutou. Tentando novamente.`);
  }

  if (instance.socket && instance.status === 'connected') {
    serviceLogger.info(`[${clientId}] Socket já conectado. _initializeAndConnectSocket não fará nada extra.`);
    return;
  }
  
  // Limpa socket antigo se estiver recriando a conexão
  if(instance.socket) {
    serviceLogger.warn(`[${clientId}] Socket existente encontrado em estado ${instance.status}. Limpando antes de reconectar.`);
    try { instance.socket.ev.removeAllListeners(); instance.socket.end(undefined); } catch(e){ serviceLogger.error('Erro ao limpar socket antigo', e); }
    instance.socket = null;
  }

  instance.status = 'connecting';
  instance.lastConnectionAttempt = Date.now();
  instance.retries = (instance.retries || 0) + 1;
  saveInstanceMetadata(clientId, { status: 'connecting', lastConnectionAttempt: instance.lastConnectionAttempt, retries: instance.retries, ...currentConfig });

  const sessionPath = path.join(SESSION_DIR, clientId);
  if (!fs.existsSync(sessionPath) && isNewSessionRequest) {
    fs.mkdirSync(sessionPath, { recursive: true });
  } else if (!fs.existsSync(sessionPath) && !isNewSessionRequest) {
    instance.status = 'error_session_not_found';
    saveInstanceMetadata(clientId, { status: instance.status, ...currentConfig });
    serviceLogger.error(`[${clientId}] Diretório de sessão não existe para reconexão. Impossível continuar.`);
    return; 
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    serviceLogger.info(`[${clientId}] Baileys v${version.join('.')}, Última: ${isLatest}`);

    const agent = createProxyAgent(currentConfig.proxyUrl);
    const pinoBaileysLogger = getLogger('baileys').logger.child({ module: 'baileys', clientId });

    const sock = makeWASocket({
      version, logger: pinoBaileysLogger, printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pinoBaileysLogger.child({ module: 'baileys-keys'})) },
      browser: ['HiveWP', 'Chrome', '1.0.0'], syncFullHistory: false, markOnlineOnConnect: false,
      retryRequestDelayMs: 3000, transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 3000 },
      connectTimeoutMs: parseInt(process.env.CONNECT_TIMEOUT_MS) || 30000,
      qrTimeout: parseInt(process.env.QR_TIMEOUT_MS) || 60000,
      emitOwnEvents: false,
      ...(agent && { agent })
    });
    instance.socket = sock;

    sock.ev.on('creds.update', async () => { 
        await saveCreds(); 
        serviceLogger.info(`[${clientId}] Credenciais salvas.`);
        saveInstanceMetadata(clientId, { lastCredsUpdate: new Date().toISOString(), ...instance.config }, true); // Força salvar creds
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      serviceLogger.info(`[${clientId}] Conexão: ${connection}, QR: ${!!qr}, Erro Anterior: ${lastDisconnect?.error?.message}`);
      instance.lastConnectionUpdate = Date.now();

      if (qr) {
        instance.qrCode = await qrcode.toDataURL(qr);
        instance.status = 'waiting_scan';
        saveInstanceMetadata(clientId, { status: 'waiting_scan', qrCodeDataUrl: instance.qrCode, ...instance.config });
        if (instance.config.webhookUrl) sendToWebhook(instance.config.webhookUrl, { event: 'qrcode.updated', clientId, qrCode: instance.qrCode, timestamp: new Date().toISOString() }).catch(e => serviceLogger.error('Webhook QR fail', e));
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        instance.qrCode = null;
        let shouldReconnect = false;
        let reconnectDelay = Math.min((instance.retries || 0) * 5000, 60000) + 5000; // Backoff com teto

        if (statusCode === DisconnectReason.loggedOut) {
          serviceLogger.warn(`[${clientId}] Deslogado. Limpando sessão.`);
          instance.status = 'logged_out';
          if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        } else if (statusCode === DisconnectReason.badSession) {
          serviceLogger.error(`[${clientId}] Sessão ruim. Limpando. Novo QR necessário.`);
          instance.status = 'bad_session';
          if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        } else if (statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.multideviceMismatch) {
          serviceLogger.warn(`[${clientId}] Conexão substituída ou incompatibilidade multi-device. Status: ${statusCode}. Não reconectando.`);
          instance.status = statusCode === DisconnectReason.connectionReplaced ? 'replaced' : 'multidevice_mismatch';
        } else if (statusCode === DisconnectReason.timedOut || statusCode === DisconnectReason.connectionLost || statusCode === DisconnectReason.connectionClosed || statusCode === DisconnectReason.restartRequired) {
          serviceLogger.warn(`[${clientId}] Conexão perdida/fechada/timeout/restart (${statusCode}). Tentando reconectar.`);
          instance.status = 'reconnecting';
          shouldReconnect = true;
        } else {
          serviceLogger.warn(`[${clientId}] Conexão fechada: ${statusCode}. Erro: ${lastDisconnect?.error?.message}.`);
          instance.status = 'disconnected'; // Estado genérico para outros erros
          if (isNewSessionRequest && !instance.qrCode) { // Se era uma tentativa nova e falhou antes do QR
             serviceLogger.warn(`[${clientId}] Falha na conexão inicial antes do QR. Não reconectando automaticamente.`);
          } else if (statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.badSession && statusCode !== DisconnectReason.connectionReplaced && statusCode !== DisconnectReason.multideviceMismatch) {
             shouldReconnect = true; // Tenta reconectar para outros erros não fatais se não for a primeira tentativa
          }
        }
        saveInstanceMetadata(clientId, { status: instance.status, lastDisconnectReason: statusCode, ...instance.config });

        if (shouldReconnect && (instance.retries || 0) < (parseInt(process.env.MAX_RECONNECT_RETRIES) || 15)) {
          serviceLogger.info(`[${clientId}] Agendando reconexão em ${reconnectDelay / 1000}s (tentativa ${instance.retries}).`);
          setTimeout(() => _initializeAndConnectSocket(clientId, instance.config, false), reconnectDelay);
        } else if (shouldReconnect) {
          serviceLogger.error(`[${clientId}] Máximo de tentativas de reconexão atingido. Status final: 'error_max_retries'.`);
          instance.status = 'error_max_retries';
          saveInstanceMetadata(clientId, { status: instance.status, ...instance.config });
        }
      }

      if (connection === 'open') {
        serviceLogger.info(`[${clientId}] Conexão estabelecida. Status: 'connected'.`);
        instance.status = 'connected';
        instance.qrCode = null;
        instance.retries = 0;
        saveInstanceMetadata(clientId, { status: 'connected', connectedAt: new Date().toISOString(), ...instance.config }, true);
        if (instance.config.webhookUrl) sendToWebhook(instance.config.webhookUrl, { event: 'connection.update', clientId, status: 'connected', timestamp: new Date().toISOString() }).catch(e => serviceLogger.error('Webhook Conn fail', e));
      }
      instances[clientId] = { ...instances[clientId], ...instance };
    });

    sock.ev.on('messages.upsert', async (m) => {
      if (!m.messages || m.messages.length === 0 || !instances[clientId] || instances[clientId].status !== 'connected') return;
      const message = m.messages[0];
      const instance = instances[clientId];

      if (instance.config.ignoreGroups && message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
        serviceLogger.info(`[${clientId}] Mensagem de grupo (${message.key.remoteJid}) ignorada conforme configuração.`);
        return;
      }

      if (!message.key.fromMe && m.type === 'notify') {
        serviceLogger.info(`[${clientId}] Nova mensagem recebida de ${message.key.remoteJid}. ID: ${message.key.id}`);

        const isGroupMessage = message.key.remoteJid?.endsWith('@g.us') || false;
        const simplifiedMessage = {
          id: message.key.id,
          from: message.key.remoteJid,
          participant: message.key.participant,
          fromMe: message.key.fromMe,
          timestamp: message.messageTimestamp,
          pushName: message.pushName || '',
          isGroup: isGroupMessage,
          type: 'unknown'
        };

        if (message.message?.conversation) {
          simplifiedMessage.type = 'text';
          simplifiedMessage.body = message.message.conversation;
        } else if (message.message?.extendedTextMessage) {
          simplifiedMessage.type = 'text';
          simplifiedMessage.body = message.message.extendedTextMessage.text;
          if (message.message.extendedTextMessage.contextInfo?.quotedMessage) {
            simplifiedMessage.quotedMessage = {
              id: message.message.extendedTextMessage.contextInfo.stanzaId,
              participant: message.message.extendedTextMessage.contextInfo.participant,
            };
          }
        } else if (message.message?.imageMessage) {
          simplifiedMessage.type = 'image';
          simplifiedMessage.caption = message.message.imageMessage.caption || '';
          simplifiedMessage.mimetype = message.message.imageMessage.mimetype;
        } else if (message.message?.videoMessage) {
          simplifiedMessage.type = 'video';
          simplifiedMessage.caption = message.message.videoMessage.caption || '';
          simplifiedMessage.mimetype = message.message.videoMessage.mimetype;
        } else if (message.message?.documentMessage) {
          simplifiedMessage.type = 'document';
          simplifiedMessage.fileName = message.message.documentMessage.fileName || '';
          simplifiedMessage.mimetype = message.message.documentMessage.mimetype;
        } else if (message.message?.audioMessage || message.message?.pttMessage) {
          const audioMsg = message.message.audioMessage || message.message.pttMessage;
          simplifiedMessage.type = audioMsg.ptt ? 'ptt' : 'audio';
          simplifiedMessage.seconds = audioMsg.seconds || 0;
          simplifiedMessage.mimetype = audioMsg.mimetype;
          try {
            const stream = await downloadContentFromMessage(audioMsg, audioMsg.ptt ? 'ptt' : 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            simplifiedMessage.base64Audio = buffer.toString('base64');
            serviceLogger.info(`[${clientId}] Áudio extraído para webhook (tamanho base64: ${simplifiedMessage.base64Audio.length})`);
          } catch (audioError) {
            serviceLogger.error(`[${clientId}] Erro ao extrair áudio para webhook: ${audioError.message}`);
            simplifiedMessage.errorOnMediaDownload = audioError.message;
          }
        } else if (message.message?.locationMessage) {
          simplifiedMessage.type = 'location';
          simplifiedMessage.latitude = message.message.locationMessage.degreesLatitude;
          simplifiedMessage.longitude = message.message.locationMessage.degreesLongitude;
        } else if (message.message?.contactMessage) {
          simplifiedMessage.type = 'contact';
          simplifiedMessage.name = message.message.contactMessage.displayName;
          simplifiedMessage.vcard = message.message.contactMessage.vcard;
        } else if (message.message?.reactionMessage) {
          simplifiedMessage.type = 'reaction';
          simplifiedMessage.emoji = message.message.reactionMessage.text;
          simplifiedMessage.targetMessageId = message.message.reactionMessage.key.id;
        } else {
            serviceLogger.warn(`[${clientId}] Tipo de mensagem não simplificado: ${Object.keys(message.message || {})}`);
        }

        if (instance.config.webhookUrl) {
          const webhookPayload = {
            event: 'messages.upsert',
            clientId,
            message: simplifiedMessage,
            originalMessage: message,
            timestamp: new Date().toISOString()
          };
          sendToWebhook(instance.config.webhookUrl, webhookPayload)
            .catch(err => serviceLogger.error(`[${clientId}] Erro ao enviar mensagem (formato corrigido) para webhook: ${err.message}`));
        }
      }
    });

  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro catastrófico em _initializeAndConnectSocket: ${error.message}`, error);
    if (instance) {
        instance.status = 'error_init_failed';
        instance.socket = null;
        saveInstanceMetadata(clientId, { status: instance.status, errorDetails: error.message, ...currentConfig });
    }
    throw error; // Propaga o erro para ensureInstanceActive
  }
};

/**
 * Ponto de entrada exportado para inicializar uma instância.
 */
const initializeWhatsApp = async (clientId = 'default', options = {}) => {
  serviceLogger.info(`[${clientId}] API call: initializeWhatsApp. Opções: ${JSON.stringify(options)}`);
  // Chama ensureInstanceActive com isExplicitInitAttempt = true para permitir a criação.
  await ensureInstanceActive(clientId, options, true);
  
  const currentInstance = instances[clientId] || { status: 'not_found', id: clientId, config: options, qrCode: null };
  return {
    success: true, 
    message: `Processo de inicialização para ${clientId} disparado. Status atual: ${currentInstance.status}.`,
    clientId: currentInstance.id,
    status: currentInstance.status,
    qrCode: currentInstance.qrCode,
    config: currentInstance.config
  };
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
        serviceLogger.error(`Erro ao enviar para webhook: ${error.message}`);
        reject(error);
      });
      
      req.write(JSON.stringify(data));
      req.end();
    });
  } catch (error) {
    serviceLogger.error(`Erro ao processar envio para webhook: ${error.message}`);
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
    const instance = await ensureInstanceActive(clientId);
    if (!instance || !instance.socket || instance.status !== 'connected') {
      serviceLogger.error(`[${clientId}] Tentativa de verificar número, mas instância não conectada. Status: ${instance?.status}`);
      return { success: false, error: `Instância ${clientId} não conectada. Status atual: ${instance?.status || 'desconhecido'}` };
    }
    const { socket } = instance;
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    const cacheKey = `${clientId}:${formattedPhoneNumber}`;

    if (numberVerificationCache.has(cacheKey)) {
        const cachedResult = numberVerificationCache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < CACHE_EXPIRATION) {
            serviceLogger.debug(`[${clientId}] Retornando resultado de verificação de número do cache para ${formattedPhoneNumber}`);
            return cachedResult.data;
        }
    }
    cleanExpiredCacheEntries(); // Limpa entradas expiradas (ocasionalmente)

    const [result] = await socket.onWhatsApp(formattedPhoneNumber);
    let response;
    if (result && result.exists) {
        response = { success: true, exists: true, jid: result.jid, formattedPhoneNumber };
    } else {
        response = { success: true, exists: false, jid: null, formattedPhoneNumber, message: 'Número não encontrado no WhatsApp.' };
    }
    
    // Adicionar ao cache se não estiver cheio
    if (numberVerificationCache.size < MAX_CACHE_SIZE) {
        numberVerificationCache.set(cacheKey, { data: response, timestamp: Date.now() });
    }
    return response;
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao verificar número ${phoneNumber}: ${error.message}`, error);
    return { success: false, error: error.message, exists: false, jid: null };
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
    const instance = await ensureInstanceActive(clientId);
    if (!instance || !instance.socket || instance.status !== 'connected') {
      serviceLogger.error(`[${clientId}] Tentativa de enviar mensagem de texto, mas instância não conectada. Status: ${instance?.status}`);
      return { success: false, error: `Instância ${clientId} não conectada. Status atual: ${instance?.status || 'desconhecido'}` };
    }

    const { socket } = instance;
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    if (!await validatePhoneNumber(clientId, formattedPhoneNumber)) {
        return { success: false, error: `Número de telefone inválido ou não existe no WhatsApp: ${phoneNumber}` };
    }

    if (simulateTyping && typingDurationMs > 0) {
        await socket.sendPresenceUpdate('composing', formattedPhoneNumber);
        await new Promise(resolve => setTimeout(resolve, typingDurationMs));
        await socket.sendPresenceUpdate('paused', formattedPhoneNumber); 
    }

    const sentMsg = await socket.sendMessage(formattedPhoneNumber, { text: message });
    serviceLogger.info(`[${clientId}] Mensagem de texto enviada para ${formattedPhoneNumber}. ID: ${sentMsg.key.id}`);
    return { success: true, messageId: sentMsg.key.id, details: sentMsg };
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao enviar mensagem de texto para ${phoneNumber}: ${error.message}`, error);
    return { success: false, error: error.message };
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
    const instance = await ensureInstanceActive(clientId);
    if (!instance || !instance.socket || instance.status !== 'connected') {
      serviceLogger.error(`[${clientId}] Tentativa de enviar mídia, mas instância não conectada. Status: ${instance?.status}`);
      return { success: false, error: `Instância ${clientId} não conectada. Status atual: ${instance?.status || 'desconhecido'}` };
    }
    const { socket } = instance;
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    if (!await validatePhoneNumber(clientId, formattedPhoneNumber)) {
        return { success: false, error: `Número de telefone inválido ou não existe no WhatsApp: ${phoneNumber}` };
    }

    // Determinar o tipo de mídia pelo mimetype ou extensão do arquivo
    let mediaType;
    let options = {};
    const lowerMimetype = mimetype?.toLowerCase();

    if (lowerMimetype?.startsWith('image/')) {
        mediaType = 'image';
        options = { caption };
    } else if (lowerMimetype?.startsWith('video/')) {
        mediaType = 'video';
        options = { caption };
    } else if (lowerMimetype?.startsWith('audio/')) {
        // Para áudio enviado como documento genérico ou se não for PTT.
        // A função sendAudioMessage é preferível para áudios PTT.
        mediaType = 'audio'; 
        options = { mimetype: mimetype, fileName: filename || 'audio.mp3' }; // Baileys pode precisar de fileName para áudios como documento
    } else {
        mediaType = 'document';
        options = { mimetype: mimetype, fileName: filename || 'document' };
    }
    
    serviceLogger.info(`[${clientId}] Enviando mídia (${mediaType}) para ${formattedPhoneNumber} da URL: ${mediaUrl}`);
    const messageContent = {
        [mediaType]: { url: mediaUrl },
        ...options
    };
    if (mediaType !== 'image' && mediaType !== 'video' && caption) { // Legenda para documentos/audio
        messageContent.caption = caption;
    }

    const sentMsg = await socket.sendMessage(formattedPhoneNumber, messageContent);
    serviceLogger.info(`[${clientId}] Mídia enviada para ${formattedPhoneNumber}. ID: ${sentMsg.key.id}`);
    return { success: true, messageId: sentMsg.key.id, details: sentMsg };
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao enviar mídia para ${phoneNumber}: ${error.message}`, error);
    return { success: false, error: error.message };
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
    const instance = await ensureInstanceActive(clientId);
    if (!instance || !instance.socket || instance.status !== 'connected') {
      serviceLogger.error(`[${clientId}] Tentativa de enviar áudio, mas instância não conectada. Status: ${instance?.status}`);
      return { success: false, error: `Instância ${clientId} não conectada. Status atual: ${instance?.status || 'desconhecido'}` };
    }
    const { socket } = instance;
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    if (!await validatePhoneNumber(clientId, formattedPhoneNumber)) {
        return { success: false, error: `Número de telefone inválido ou não existe no WhatsApp: ${phoneNumber}` };
    }

    serviceLogger.info(`[${clientId}] Enviando áudio PTT para ${formattedPhoneNumber} da URL: ${audioUrl}`);
    const messageContent = {
        audio: { url: audioUrl },
        ptt: true, // Indica que é uma mensagem de áudio Push-to-Talk
        ...(mimetype && { mimetype }), // Mimetype é opcional para PTT mas pode ajudar.
        ...(caption && { caption }) // Legenda geralmente não é mostrada para PTT, mas incluímos se fornecida.
    };

    const sentMsg = await socket.sendMessage(formattedPhoneNumber, messageContent);
    serviceLogger.info(`[${clientId}] Áudio PTT enviado para ${formattedPhoneNumber}. ID: ${sentMsg.key.id}`);
    return { success: true, messageId: sentMsg.key.id, details: sentMsg };
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao enviar áudio PTT para ${phoneNumber}: ${error.message}`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Gera uma URL do QR Code como string base64 para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const getQrCode = async (clientId = 'default') => {
  // Para getQrCode, queremos ativar a instância se ela não existir ou não estiver esperando QR,
  // pois o objetivo é justamente obter o QR.
  let instance = instances[clientId];
  
  // Se a instância já está aguardando scan e tem um QR, retorna imediatamente.
  if (instance && instance.status === 'waiting_scan' && instance.qrCode) {
     serviceLogger.info(`[${clientId}] QR Code já disponível e instância aguardando scan.`);
  } else {
    // Caso contrário, tenta garantir que a instância seja ativada/inicializada para obter o QR.
    // Passamos true para isExplicitInitAttempt para permitir a criação de uma nova instância ou forçar a tentativa de conexão.
    serviceLogger.info(`[${clientId}] QR Code não disponível ou instância não está aguardando scan. Tentando garantir ativação (ensureInstanceActive) para obter QR.`);
    try {
        instance = await ensureInstanceActive(clientId, {}, true); 
    } catch (error) {
        serviceLogger.error(`[${clientId}] Erro ao tentar ativar instância para getQrCode: ${error.message}`);
        // Se ensureInstanceActive falhar (ex: diretório de sessão não existe e não é nova init), não haverá QR.
        return { success: false, error: `Falha ao ativar instância ${clientId} para obter QR Code: ${error.message}`, status: instance?.status || 'error' };
    }
  }

  // Após a tentativa de ensureInstanceActive, verifica novamente se o QR está disponível.
  if (instance && instance.status === 'waiting_scan' && instance.qrCode) {
    // O qrCode na instância já é o DataURL por causa da lógica em _initializeAndConnectSocket
    return {
      success: true,
      qrCode: instance.qrCode, // Este já deve ser o DataURL
      status: instance.status,
      clientId
    };
  }

  // Se ainda não há QR, retorna erro.
  // O status da instância pode dar mais pistas (ex: 'connecting', 'error_init_failed')
  serviceLogger.warn(`[${clientId}] QR Code não disponível após tentativa de ativação. Status: ${instance?.status}`);
  return {
    success: false,
    error: `QR Code para o cliente ${clientId} não disponível no momento. Status atual: ${instance?.status || 'unknown'}`,
    status: instance?.status || 'unknown'
  };
};

/**
 * Obtém o status da conexão atual para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const getConnectionStatus = (clientId = 'default') => {
  const instance = instances[clientId];
  if (instance) {
    return {
      success: true,
      clientId: instance.id,
      status: instance.status,
      qrCodeAvailable: !!instance.qrCode,
      connected: instance.status === 'connected',
      lastConnectionAttempt: instance.lastConnectionAttempt,
      lastConnectionUpdate: instance.lastConnectionUpdate,
      config: instance.config,
      retries: instance.retries
    };
  }
  // Se a instância não existe no objeto 'instances' deste worker, verifica se há metadados salvos.
  const metadata = readInstanceMetadata(clientId);
  if (metadata) {
    return {
        success: true,
        clientId: clientId,
        status: metadata.status || 'not_loaded_in_worker', // Indica que existe, mas não ativa neste worker
        qrCodeAvailable: !!metadata.qrCodeDataUrl, 
        connected: metadata.status === 'connected',
        config: { ignoreGroups: metadata.ignoreGroups, webhookUrl: metadata.webhookUrl, proxyUrl: metadata.proxyUrl },
        message: "Instância existe mas não está ativa neste worker. Verifique metadados para status anterior."
    };
  }
  
  return {
    success: false,
    error: `Cliente ${clientId} não encontrado neste worker nem nos metadados salvos.`,
    status: 'not_found'
  };
};

/**
 * Desconecta do WhatsApp para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const logout = async (clientId = 'default') => {
  let instance = instances[clientId];
  const sessionPath = path.join(SESSION_DIR, clientId);

  serviceLogger.info(`[${clientId}] Solicitando logout.`);

  if (!instance || instance.status === 'logged_out') {
    serviceLogger.info(`[${clientId}] Instância já está deslogada ou não existe no worker. Limpando arquivos de sessão se existirem.`);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      serviceLogger.info(`[${clientId}] Diretório de sessão removido.`);
    }
    if (instance) delete instances[clientId]; 
    saveInstanceMetadata(clientId, { status: 'logged_out', qrCodeDataUrl: null, socket: null }); 
    return { success: true, message: `Instância ${clientId} já estava deslogada ou não foi encontrada no worker. Sessão limpa (se existia).` };
  }

  // Se a instância existe no worker mas não tem socket (ex: status 'available', 'disconnected' sem tentativa de conexão, 'creating')
  if (!instance.socket) {
    serviceLogger.info(`[${clientId}] Instância ${clientId} (status: ${instance.status}) não possui socket ativo neste worker. Limpando sessão localmente e marcando como deslogada.`);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        serviceLogger.info(`[${clientId}] Diretório de sessão removido.`);
    }
    instance.status = 'logged_out';
    instance.qrCode = null;
    delete instances[clientId]; 
    saveInstanceMetadata(clientId, { status: 'logged_out', qrCodeDataUrl: null, socket: null });
    return { success: true, message: `Instância ${clientId} não tinha socket ativo no worker. Sessão limpa localmente e marcada como deslogada.` };
  }
  
  // Se temos um socket, tentamos o logout gracioso
  try {
    serviceLogger.info(`[${clientId}] Socket ativo encontrado. Tentando logout via Baileys...`);
    await instance.socket.logout(); // Esta chamada deve fechar a conexão com DisconnectReason.loggedOut
    // O handler 'connection.update' deve ter cuidado da limpeza da sessão e atualização do status para 'logged_out'.
    // Vamos aguardar um pouco para o evento ser processado e então verificar.
    await new Promise(resolve => setTimeout(resolve, 2500)); 

    // Confirmação se o status foi atualizado pelo handler do evento
    if (instances[clientId] && instances[clientId].status === 'logged_out') {
        serviceLogger.info(`[${clientId}] Logout bem-sucedido e status atualizado para 'logged_out' pelo handler de eventos.`);
        delete instances[clientId]; // Remove do worker após confirmação de logout
        return { success: true, message: `Instância ${clientId} deslogada com sucesso via Baileys.` };
    } else {
        // Se o status não mudou para logged_out pelo evento (o que é inesperado mas possível se o evento falhar)
        // ou se a instância foi removida prematuramente, forçamos a limpeza e o status aqui.
        serviceLogger.warn(`[${clientId}] Pós-logout via Baileys, status não é 'logged_out' (atual: ${instances[clientId]?.status}) ou instância não encontrada. Forçando limpeza e remoção.`);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            serviceLogger.info(`[${clientId}] Diretório de sessão removido (limpeza forçada pós-logout).`);
        }
        if (instances[clientId]) {
            instances[clientId].status = 'logged_out'; // Garante o status
            delete instances[clientId];
        }
        saveInstanceMetadata(clientId, { status: 'logged_out', qrCodeDataUrl: null, socket: null }); // Salva o estado final
        return { success: true, message: `Logout da instância ${clientId} processado; sessão limpa (mesmo se o evento de Baileys não atualizou o status imediatamente).` };
    }
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro ao tentar deslogar via Baileys: ${error.message}`, error);
    // Mesmo em caso de erro no logout do Baileys, é prudente tentar limpar a sessão para evitar inconsistências.
    serviceLogger.info(`[${clientId}] Tentando limpar sessão após erro de logout...`);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      serviceLogger.info(`[${clientId}] Diretório de sessão removido após erro de logout.`);
    }
    if (instance) {
        instance.status = 'error_logout_failed'; 
        instance.socket = null; // Limpa o socket
        saveInstanceMetadata(clientId, { status: 'error_logout_failed', lastError: error.message, qrCodeDataUrl: null }, true);
        // Não deletar `instances[clientId]` aqui, para que o erro seja visível
    }
    return { success: false, error: `Erro ao deslogar instância ${clientId}: ${error.message}` };
  }
};

/**
 * Reinicia a conexão com o WhatsApp para um cliente específico
 * @param {string} clientId - Identificador do cliente
 */
const restartConnection = async (clientId = 'default') => {
  serviceLogger.info(`[${clientId}] Solicitação para reiniciar conexão.`);
  let instance = instances[clientId];
  const existingConfig = instance?.config || readInstanceMetadata(clientId)?.config || {}; // Tenta pegar config da instância ou metadados

  if (instance && instance.socket) {
    serviceLogger.info(`[${clientId}] Encerrando conexão existente (socket.end) para reinício...`);
    try {
        instance.socket.end(new Error('Restarting connection via API call')); 
    } catch (e) {
        serviceLogger.warn(`[${clientId}] Erro ao tentar encerrar socket para reinício: ${e.message}`);
    }
    instance.socket = null; 
    instance.status = 'restarting_pending'; 
    instance.qrCode = null;
    saveInstanceMetadata(clientId, { status: instance.status, ...existingConfig });
  } else if (instance) {
     serviceLogger.info(`[${clientId}] Instância encontrada (status: ${instance.status}) mas sem socket ativo. Marcando para reinício e tentando garantir ativação.`);
     instance.status = 'restarting_pending';
     instance.qrCode = null;
     saveInstanceMetadata(clientId, { status: instance.status, ...existingConfig });
  } else {
     // Se a instância não está no objeto 'instances' do worker, não há muito o que fazer aqui
     // além de garantir que a próxima chamada a ensureInstanceActive tente iniciar com a config existente (se houver)
     serviceLogger.warn(`[${clientId}] Instância não encontrada no worker para reinício. Tentará iniciar com ensureInstanceActive.`);
     // Não criar a instância aqui, ensureInstanceActive fará isso se for uma nova init.
     // Apenas preparamos o terreno para que a config seja usada.
     if (!instances[clientId]) {
        instances[clientId] = { id: clientId, status: 'restarting_pending', config: existingConfig, metadata: readInstanceMetadata(clientId) || {} };
     }
  }

  try {
    // Chama ensureInstanceActive para (re)estabelecer a conexão.
    // Passa true para isExplicitInitAttempt pois é uma ação explícita do usuário.
    // Passa a configuração existente para garantir que seja usada.
    const updatedInstance = await ensureInstanceActive(clientId, existingConfig, true);
    const finalStatus = updatedInstance?.status || 'unknown_after_restart_attempt';
    serviceLogger.info(`[${clientId}] Tentativa de reinício concluída via ensureInstanceActive. Status final: ${finalStatus}`);
    return { success: true, message: `Tentativa de reinício da instância ${clientId} concluída. Status: ${finalStatus}`, status: finalStatus, clientId };
  } catch (error) {
    serviceLogger.error(`[${clientId}] Erro durante o reinício da conexão via ensureInstanceActive: ${error.message}`);
    const finalStatus = instances[clientId]?.status || 'error_restarting';
    return { success: false, error: `Erro ao reiniciar instância ${clientId}: ${error.message}`, status: finalStatus, clientId };
  }
};

/**
 * Remove uma instância específica e limpa os recursos associados
 * @param {string} clientId - Identificador do cliente
 */
const deleteInstance = async (clientId = 'default') => {
  serviceLogger.info(`[${clientId}] Solicitação para deletar instância.`);
  const instance = instances[clientId];
  const sessionPath = path.join(SESSION_DIR, clientId);

  if (instance && instance.socket) {
    serviceLogger.info(`[${clientId}] Instância com socket ativo. Tentando logout e fechamento antes de deletar...`);
    try {
      await instance.socket.logout().catch(e => serviceLogger.warn(`[${clientId}] Erro no logout durante delete (ignorado): ${e.message}`));
      instance.socket.end(new Error('Instance deleted'));
      await new Promise(resolve => setTimeout(resolve, 500)); // Pequena pausa para o socket fechar
    } catch (socketCloseError) {
      serviceLogger.warn(`[${clientId}] Erro ao tentar fechar socket durante delete (ignorado): ${socketCloseError.message}`);
    }
  }

  // Remover a instância do objeto de instâncias em memória do worker
  if (instances[clientId]) {
    delete instances[clientId];
    serviceLogger.info(`[${clientId}] Instância removida do objeto de instâncias em memória do worker.`);
  }
  
  // Remover diretório de sessão do disco (isso também remove o instance_metadata.json)
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      serviceLogger.info(`[${clientId}] Diretório de sessão (${sessionPath}) removido com sucesso.`);
    } catch (dirRemoveError) {
      serviceLogger.error(`[${clientId}] Erro ao remover diretório de sessão ${sessionPath}: ${dirRemoveError.message}`);
      // Continua mesmo se a remoção do diretório falhar, mas retorna um aviso.
      return {
        success: false, // Ou true com aviso, dependendo da criticidade
        message: `Instância ${clientId} removida da memória, mas falha ao limpar o diretório de sessão. Verifique os logs.`,
        error: dirRemoveError.message
      };
    }
  } else {
    serviceLogger.info(`[${clientId}] Diretório de sessão (${sessionPath}) não encontrado para remoção (pode já ter sido removido).`);
  }
  
  // Não há mais metadados para salvar para uma instância deletada, pois o arquivo foi removido com a pasta.
  return {
    success: true,
    message: `Instância ${clientId} e seu diretório de sessão foram removidos com sucesso.`
  };
};

/**
 * Atualiza as configurações de uma instância específica.
 * Se a instância não estiver ativa no worker, tenta carregar seus metadados para atualizar.
 * @param {string} clientId - Identificador do cliente
 * @param {object} newConfigOptions - Configurações a serem atualizadas (ignoreGroups, webhookUrl, proxyUrl)
 * @returns {object} - Resultado da atualização
 */
const updateInstanceConfig = (clientId = 'default', newConfigOptions = {}) => {
  serviceLogger.info(`[${clientId}] Atualizando configuração com: ${JSON.stringify(newConfigOptions)}`);
  let instance = instances[clientId];
  let metadata = instance?.metadata || readInstanceMetadata(clientId);
  let currentConfig = instance?.config || metadata?.config || {}; // Prioriza config em memória, depois metadados

  if (!instance && !metadata) {
    serviceLogger.error(`[${clientId}] Tentativa de atualizar config para instância não existente (nem em memória, nem em metadados).`);
    return {
      success: false,
      error: `Cliente ${clientId} não encontrado. Não é possível atualizar configuração.`
    };
  }
  
  // Se a instância não está no objeto 'instances' do worker, mas temos metadados, criamos uma entrada básica
  // para que a configuração possa ser atualizada e salva nos metadados.
  // O socket não será ativado aqui, apenas a configuração persistida.
  if (!instance && metadata) {
    serviceLogger.warn(`[${clientId}] Atualizando config para instância não ativa no worker (baseado em metadados existentes).`);
    instances[clientId] = {
        id: clientId,
        status: metadata.status || 'configured_offline',
        qrCode: null, socket: null, lastConnectionAttempt: null, retries: 0,
        config: { ...currentConfig },
        metadata: metadata
    };
    instance = instances[clientId];
  } else if (!instance && !metadata && newConfigOptions) {
    // Caso queiramos permitir criar uma instância "apenas de configuração" se ela não existir de todo.
    // Isso pode ser útil se quisermos pré-configurar antes do primeiro `initializeWhatsApp`.
    serviceLogger.info(`[${clientId}] Instância não encontrada. Criando entrada de configuração baseada nas opções fornecidas.`);
    instances[clientId] = { 
        id: clientId, status: 'preconfigured', qrCode: null, socket:null, retries: 0,
        config: {}, // Será preenchida abaixo
        metadata: { clientId } // Metadados mínimos
    };
    instance = instances[clientId];
  }

  let configChanged = false;
  let proxyChanged = false;
  const updatedConfig = { ...instance.config }; // Começa com a configuração atual da instância

  if (newConfigOptions.ignoreGroups !== undefined && updatedConfig.ignoreGroups !== !!newConfigOptions.ignoreGroups) {
    updatedConfig.ignoreGroups = !!newConfigOptions.ignoreGroups;
    configChanged = true;
  }
  
  if (newConfigOptions.webhookUrl !== undefined && updatedConfig.webhookUrl !== newConfigOptions.webhookUrl) {
    updatedConfig.webhookUrl = newConfigOptions.webhookUrl;
    configChanged = true;
  }
  
  const oldProxyUrl = updatedConfig.proxyUrl || '';
  const newProxyUrlValue = newConfigOptions.proxyUrl === null ? null : (newConfigOptions.proxyUrl || oldProxyUrl); // Permite limpar proxy com null

  if (newConfigOptions.proxyUrl !== undefined && oldProxyUrl !== newProxyUrlValue) {
    updatedConfig.proxyUrl = newProxyUrlValue;
    configChanged = true;
    proxyChanged = true;
    serviceLogger.info(`[${clientId}] Proxy URL alterado de "${oldProxyUrl}" para "${updatedConfig.proxyUrl}"`);
  }
  
  if (configChanged) {
    instance.config = updatedConfig;
    // Força o salvamento imediato dos metadados, pois é uma mudança de configuração explícita.
    // Inclui o status atual da instância (se houver) ou o status dos metadados.
    const statusToSave = instance.status || metadata?.status || 'configured_offline';
    saveInstanceMetadata(clientId, {
      status: statusToSave, 
      ...instance.config, // Salva a configuração completa atualizada
      configUpdatedAt: new Date().toISOString()
    }, true); // true para forçar o salvamento
    
    serviceLogger.info(`[${clientId}] Configurações atualizadas e salvas nos metadados. Proxy alterado: ${proxyChanged}`);
    
    // Se o proxy mudou e a instância tem um socket ativo, ela precisará ser reconectada
    // para usar o novo proxy. A flag reconnectionRecommended informa isso à API.
    // A reconexão em si pode ser feita por uma chamada subsequente a /restart.
    if (proxyChanged && instance.socket && instance.status === 'connected') {
        serviceLogger.warn(`[${clientId}] Proxy alterado para instância conectada. Reinício é recomendado para aplicar novo proxy.`);
    }
  } else {
    serviceLogger.info(`[${clientId}] Nenhuma alteração de configuração detectada.`);
  }
  
  return {
    success: true,
    message: configChanged ? `Configurações do cliente ${clientId} atualizadas.` : 'Nenhuma alteração de configuração fornecida.',
    clientId,
    config: instance.config,
    proxyChanged: proxyChanged,
    reconnectionRecommended: proxyChanged && instance.status === 'connected' // Recomenda se proxy mudou E está conectado
  };
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
