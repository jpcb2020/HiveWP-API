/**
 * Exemplo de configurações de ambiente para HiveWP API
 * Copie este arquivo para um .env na raiz do projeto
 */

module.exports = {
  // Configurações essenciais
  API_KEY: 'sua_chave_secreta_aqui', // OBRIGATÓRIO
  PORT: 3000,
  NODE_ENV: 'development', // 'development' ou 'production'
  
  // Configurações de Logs otimizadas
  LOG_LEVEL: 'info',         // 'error', 'warn', 'info', 'debug'
  VERBOSE_LOGS: false,       // Logs muito detalhados
  LOG_REQUESTS: false,       // Log de todas as requisições HTTP
  BAILEYS_LOG_LEVEL: 'warn', // Log level do Baileys
  
  // Configurações de Performance
  SESSION_DIR: './sessions',
  IGNORE_GROUPS: false,      // Ignorar mensagens de grupos globalmente
  ENABLE_NUMBER_CACHE: true, // Cache de verificação de números
  
  // Configurações opcionais
  // DEFAULT_WEBHOOK_URL: 'https://seu-webhook.com/endpoint',
  // DEFAULT_PROXY_URL: 'socks5://user:pass@proxy.example.com:1080',
  
  /**
   * Configurações recomendadas por ambiente:
   * 
   * DESENVOLVIMENTO:
   * - NODE_ENV=development
   * - LOG_LEVEL=debug
   * - VERBOSE_LOGS=true
   * - LOG_REQUESTS=true
   * 
   * PRODUÇÃO:
   * - NODE_ENV=production
   * - LOG_LEVEL=info
   * - VERBOSE_LOGS=false
   * - LOG_REQUESTS=false
   */
}; 