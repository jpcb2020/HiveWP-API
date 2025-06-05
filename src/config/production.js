/**
 * Configurações otimizadas para ambiente de produção
 * Suporte para 100+ instâncias WhatsApp simultâneas
 */

module.exports = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    maxConnections: 1000,
    timeout: 30000, // 30 segundos
    keepAliveTimeout: 5000,
    headersTimeout: 60000
  },

  // Configurações de rate limiting para produção
  rateLimiting: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 2000, // 2000 requisições por 15 minutos
      skipSuccessfulRequests: true
    },
    messages: {
      windowMs: 1 * 60 * 1000, // 1 minuto
      max: 500, // 500 mensagens por minuto por IP/API Key
      skipSuccessfulRequests: false
    },
    instances: {
      windowMs: 5 * 60 * 1000, // 5 minutos
      max: 100, // 100 operações de instância por 5 minutos
      skipSuccessfulRequests: true
    },
    queries: {
      windowMs: 1 * 60 * 1000, // 1 minuto
      max: 1000, // 1000 consultas por minuto
      skipSuccessfulRequests: true
    }
  },

  // Configurações do WhatsApp/Baileys
  whatsapp: {
    maxInstances: 150, // Permitir até 150 instâncias (margem de segurança)
    reconnectDelay: {
      min: 5000,     // 5 segundos mínimo
      max: 300000,   // 5 minutos máximo
      multiplier: 1.5 // Fator de multiplicação
    },
    socketConfig: {
      syncFullHistory: false,
      markOnlineOnConnect: false,
      retryRequestDelayMs: 3000,
      connectTimeoutMs: 45000,
      keepAliveIntervalMs: 30000,
      emitOwnEvents: false,
      printQRInTerminal: false, // Desabilitar em produção
      generateHighQualityLinkPreview: false
    },
    messageThrottling: {
      enabled: true,
      messagesPerMinute: 60, // 60 mensagens por minuto por instância
      burstLimit: 10 // Máximo 10 mensagens em sequência rápida
    }
  },

  // Configurações de cache
  cache: {
    numberValidation: {
      expiration: 4 * 60 * 60 * 1000, // 4 horas
      maxSize: 100000, // 100k entradas
      cleanupInterval: 5 * 60 * 1000 // Limpar a cada 5 minutos
    },
    qrCode: {
      expiration: 20 * 1000, // 20 segundos
      maxSize: 300 // Máximo 300 QR codes
    },
    instanceMetadata: {
      throttleTime: 3000, // 3 segundos entre salvamentos
      batchSize: 10 // Salvar metadados em lotes
    }
  },

  // Configurações de webhook
  webhook: {
    maxQueueSize: 50000, // 50k webhooks na queue
    concurrentLimit: 25, // 25 webhooks simultâneos
    retries: 3,
    retryDelay: 2000,
    timeout: 15000, // 15 segundos timeout
    processInterval: 50 // Processar a cada 50ms
  },

  // Configurações de logging para produção
  logging: {
    level: 'info', // Reduzir verbosidade
    maxFiles: 10,
    maxSize: '10m',
    auditTrail: true,
    compressOldLogs: true,
    colorize: false,
    // Reduzir logs de conexão (apenas estados importantes)
    whatsappEvents: {
      logConnectionStates: ['connected', 'disconnected', 'logged_out', 'close'],
      logAllMessages: false, // Não logar todas as mensagens em produção
      logOnlyErrors: true
    }
  },

  // Configurações de monitoramento
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000, // A cada 30 segundos
      endpoints: ['/system/health', '/system/metrics']
    },
    metrics: {
      collectMemoryUsage: true,
      collectCpuUsage: true,
      collectInstanceStats: true,
      retentionTime: 24 * 60 * 60 * 1000 // 24 horas
    }
  },

  // Configurações de segurança
  security: {
    helmet: {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      maxAge: 86400 // 24 horas
    },
    rateLimitBypass: {
      // IPs que podem ter rate limits relaxados
      trustedIPs: process.env.TRUSTED_IPS?.split(',') || [],
      multiplier: 3 // 3x mais requisições para IPs confiáveis
    }
  },

  // Configurações de performance
  performance: {
    compression: {
      enabled: true,
      level: 6, // Nível de compressão gzip
      threshold: 1024 // Comprimir apenas responses > 1KB
    },
    clustering: {
      enabled: process.env.CLUSTER_MODE === 'true',
      workers: process.env.CLUSTER_WORKERS || 'auto' // 'auto' usa CPU cores
    },
    memoryManagement: {
      gcInterval: 5 * 60 * 1000, // Force GC a cada 5 minutos
      memoryWarningThreshold: 0.8, // Aviso quando usar 80% da memória
      maxMemoryUsage: process.env.MAX_MEMORY || '2GB'
    }
  },

  // Configurações específicas para 100+ instâncias
  scaleOptimizations: {
    // Batch operations para reduzir overhead
    batchOperations: {
      enabled: true,
      batchSize: 10,
      batchInterval: 100 // ms
    },
    
    // Connection pooling para operações de arquivo
    fileOperations: {
      poolSize: 20,
      maxRetries: 3
    },
    
    // Lazy loading de instâncias
    lazyLoading: {
      enabled: true,
      loadThreshold: 50, // Carregar instâncias quando atingir 50 ativas
      unloadIdleTime: 60 * 60 * 1000 // Descarregar instâncias inativas por 1 hora
    },
    
    // Otimizações de rede
    network: {
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 200,
      maxFreeSockets: 50
    }
  },

  // Alertas e notificações
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    thresholds: {
      instanceFailures: 5, // Alerta após 5 falhas de instância
      memoryUsage: 0.85, // Alerta quando usar 85% da memória
      responseTime: 5000, // Alerta se response time > 5s
      queueSize: 1000 // Alerta se queue de webhooks > 1000
    },
    webhook: process.env.ALERT_WEBHOOK_URL
  }
}; 