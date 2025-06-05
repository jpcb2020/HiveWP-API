/**
 * Sistema de Cache Otimizado para HiveWP API
 * Gerencia cache de validação de números e outras operações custosas
 */

const { getLogger } = require('../config/logger');
const logger = getLogger('cache');

class OptimizedCache {
  constructor() {
    // Cache para validação de números
    this.numberCache = new Map();
    this.numberCacheStats = { hits: 0, misses: 0 };
    
    // Cache para QR codes
    this.qrCache = new Map();
    this.qrCacheStats = { hits: 0, misses: 0 };
    
    // Configurações
    this.config = {
      // Cache de números
      numberCacheExpiration: 2 * 60 * 60 * 1000, // 2 horas
      numberCacheMaxSize: 50000, // 50k entradas
      numberCacheCleanupInterval: 10 * 60 * 1000, // Limpar a cada 10 minutos
      
      // Cache de QR codes
      qrCacheExpiration: 30 * 1000, // 30 segundos (QR codes mudam frequentemente)
      qrCacheMaxSize: 200, // Máximo 200 QR codes (para 100 instâncias)
      
      // Limpeza geral
      cleanupFrequency: 1000 // A cada 1000 operações
    };
    
    this.operationCounter = 0;
    
    // Iniciar limpeza automática
    this.startPeriodicCleanup();
  }

  /**
   * Cache para validação de números
   */
  setNumberValidation(clientId, phoneNumber, result) {
    const key = `${clientId}:${phoneNumber}`;
    const entry = {
      result,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.numberCache.set(key, entry);
    this.checkCacheSize('number');
  }

  getNumberValidation(clientId, phoneNumber) {
    const key = `${clientId}:${phoneNumber}`;
    const entry = this.numberCache.get(key);
    
    if (!entry) {
      this.numberCacheStats.misses++;
      return null;
    }
    
    // Verificar expiração
    if (Date.now() - entry.timestamp > this.config.numberCacheExpiration) {
      this.numberCache.delete(key);
      this.numberCacheStats.misses++;
      return null;
    }
    
    entry.hits++;
    this.numberCacheStats.hits++;
    return entry.result;
  }

  /**
   * Cache para QR codes
   */
  setQRCode(clientId, qrData) {
    const entry = {
      qrData,
      timestamp: Date.now()
    };
    
    this.qrCache.set(clientId, entry);
    this.checkCacheSize('qr');
  }

  getQRCode(clientId) {
    const entry = this.qrCache.get(clientId);
    
    if (!entry) {
      this.qrCacheStats.misses++;
      return null;
    }
    
    // Verificar expiração
    if (Date.now() - entry.timestamp > this.config.qrCacheExpiration) {
      this.qrCache.delete(clientId);
      this.qrCacheStats.misses++;
      return null;
    }
    
    this.qrCacheStats.hits++;
    return entry.qrData;
  }

  /**
   * Invalidar cache de QR code quando status da instância mudar
   */
  invalidateQRCode(clientId) {
    this.qrCache.delete(clientId);
  }

  /**
   * Invalidar cache de número quando necessário
   */
  invalidateNumber(clientId, phoneNumber) {
    const key = `${clientId}:${phoneNumber}`;
    this.numberCache.delete(key);
  }

  /**
   * Verificar e limitar tamanho do cache
   */
  checkCacheSize(type) {
    this.operationCounter++;
    
    // Limpeza periódica baseada em operações
    if (this.operationCounter % this.config.cleanupFrequency === 0) {
      this.cleanupExpiredEntries();
    }

    if (type === 'number' && this.numberCache.size > this.config.numberCacheMaxSize) {
      this.evictOldestEntries(this.numberCache, this.config.numberCacheMaxSize * 0.8);
    }
    
    if (type === 'qr' && this.qrCache.size > this.config.qrCacheMaxSize) {
      this.evictOldestEntries(this.qrCache, this.config.qrCacheMaxSize * 0.8);
    }
  }

  /**
   * Remover entradas mais antigas
   */
  evictOldestEntries(cache, targetSize) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.length - targetSize;
    for (let i = 0; i < toRemove; i++) {
      cache.delete(entries[i][0]);
    }
    
    logger.debug(`Cache eviction: removidas ${toRemove} entradas antigas`);
  }

  /**
   * Limpeza automática de entradas expiradas
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let numberCleaned = 0;
    let qrCleaned = 0;
    
    // Limpar cache de números expirados
    for (const [key, entry] of this.numberCache.entries()) {
      if (now - entry.timestamp > this.config.numberCacheExpiration) {
        this.numberCache.delete(key);
        numberCleaned++;
      }
    }
    
    // Limpar cache de QR codes expirados
    for (const [key, entry] of this.qrCache.entries()) {
      if (now - entry.timestamp > this.config.qrCacheExpiration) {
        this.qrCache.delete(key);
        qrCleaned++;
      }
    }
    
    if (numberCleaned > 0 || qrCleaned > 0) {
      logger.debug(`Cache cleanup: ${numberCleaned} números, ${qrCleaned} QR codes removidos`);
    }
  }

  /**
   * Limpeza periódica automática
   */
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.numberCacheCleanupInterval);
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    const numberHitRate = this.numberCacheStats.hits + this.numberCacheStats.misses > 0 
      ? (this.numberCacheStats.hits / (this.numberCacheStats.hits + this.numberCacheStats.misses) * 100).toFixed(2)
      : 0;
      
    const qrHitRate = this.qrCacheStats.hits + this.qrCacheStats.misses > 0
      ? (this.qrCacheStats.hits / (this.qrCacheStats.hits + this.qrCacheStats.misses) * 100).toFixed(2)
      : 0;

    return {
      numberCache: {
        size: this.numberCache.size,
        maxSize: this.config.numberCacheMaxSize,
        hits: this.numberCacheStats.hits,
        misses: this.numberCacheStats.misses,
        hitRate: `${numberHitRate}%`
      },
      qrCache: {
        size: this.qrCache.size,
        maxSize: this.config.qrCacheMaxSize,
        hits: this.qrCacheStats.hits,
        misses: this.qrCacheStats.misses,
        hitRate: `${qrHitRate}%`
      },
      operations: this.operationCounter
    };
  }

  /**
   * Limpar todo o cache
   */
  clearAll() {
    this.numberCache.clear();
    this.qrCache.clear();
    this.numberCacheStats = { hits: 0, misses: 0 };
    this.qrCacheStats = { hits: 0, misses: 0 };
    this.operationCounter = 0;
    
    logger.info('Cache limpo completamente');
  }

  /**
   * Pré-aquecimento do cache com números comuns
   */
  warmupCommonNumbers() {
    // Esta função pode ser implementada para pré-carregar números frequentemente usados
    logger.info('Cache warmup iniciado');
  }
}

// Instância global do cache
const cache = new OptimizedCache();

module.exports = {
  cache,
  OptimizedCache
}; 