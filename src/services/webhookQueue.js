/**
 * Sistema de Queue para Webhooks
 * Processa webhooks de forma assíncrona para não bloquear o thread principal
 */

const { getLogger } = require('../config/logger');
const logger = getLogger('webhook');

class WebhookQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
    this.maxQueueSize = 10000; // Limite máximo da queue
    this.processInterval = 100; // Processar a cada 100ms
    this.concurrentLimit = 10; // Máximo 10 webhooks simultâneos
    this.activeRequests = 0;
    
    // Iniciar processamento automático
    this.startProcessing();
    
    // Métricas
    this.metrics = {
      processed: 0,
      failed: 0,
      queued: 0,
      dropped: 0
    };
  }

  /**
   * Adiciona um webhook à queue
   */
  enqueue(webhookUrl, data, clientId) {
    // Verificar limite da queue
    if (this.queue.length >= this.maxQueueSize) {
      this.metrics.dropped++;
      logger.warn(`Queue de webhook cheia, descartando webhook para ${clientId}`, {
        queueSize: this.queue.length,
        maxSize: this.maxQueueSize
      });
      return false;
    }

    const webhookItem = {
      id: Date.now() + Math.random(),
      webhookUrl,
      data,
      clientId,
      attempts: 0,
      timestamp: Date.now()
    };

    this.queue.push(webhookItem);
    this.metrics.queued++;
    
    logger.debug(`Webhook adicionado à queue para ${clientId}`, {
      queueSize: this.queue.length,
      webhookId: webhookItem.id
    });

    return true;
  }

  /**
   * Inicia o processamento contínuo da queue
   */
  startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    logger.info('Sistema de queue de webhooks iniciado');

    const processLoop = async () => {
      try {
        await this.processQueue();
      } catch (error) {
        logger.error('Erro no processamento da queue de webhooks', error);
      }

      // Continuar processamento se ainda estiver ativo
      if (this.processing) {
        setTimeout(processLoop, this.processInterval);
      }
    };

    processLoop();
  }

  /**
   * Para o processamento da queue
   */
  stopProcessing() {
    this.processing = false;
    logger.info('Sistema de queue de webhooks parado');
  }

  /**
   * Processa itens da queue
   */
  async processQueue() {
    // Verificar se há itens na queue e se não excedemos o limite de requisições simultâneas
    while (this.queue.length > 0 && this.activeRequests < this.concurrentLimit) {
      const item = this.queue.shift();
      this.processWebhook(item); // Não aguardar - processar assincronamente
    }
  }

  /**
   * Processa um webhook individual
   */
  async processWebhook(item) {
    this.activeRequests++;
    
    try {
      await this.sendWebhook(item.webhookUrl, item.data);
      this.metrics.processed++;
      
      logger.debug(`Webhook enviado com sucesso para ${item.clientId}`, {
        webhookId: item.id,
        attempts: item.attempts + 1
      });
      
    } catch (error) {
      item.attempts++;
      
      if (item.attempts < this.maxRetries) {
        // Reagendar para nova tentativa
        setTimeout(() => {
          this.queue.unshift(item); // Adicionar no início para processar novamente
        }, this.retryDelay * item.attempts); // Backoff exponencial
        
        logger.warn(`Webhook falhou, tentativa ${item.attempts}/${this.maxRetries} para ${item.clientId}`, {
          error: error.message,
          webhookId: item.id
        });
      } else {
        this.metrics.failed++;
        logger.error(`Webhook falhou definitivamente após ${this.maxRetries} tentativas para ${item.clientId}`, {
          error: error.message,
          webhookId: item.id
        });
      }
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Envia webhook usando fetch nativo do Node.js (mais eficiente)
   */
  async sendWebhook(webhookUrl, data) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HiveWP-API/1.0'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Webhook timeout (10s)');
      }
      
      throw error;
    }
  }

  /**
   * Obtém métricas da queue
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing
    };
  }

  /**
   * Limpa métricas
   */
  resetMetrics() {
    this.metrics = {
      processed: 0,
      failed: 0,
      queued: 0,
      dropped: 0
    };
  }
}

// Instância global da queue
const webhookQueue = new WebhookQueue();

module.exports = {
  webhookQueue,
  WebhookQueue
}; 