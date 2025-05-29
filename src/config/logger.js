/**
 * Sistema de logging configurável para HiveWP API
 * Centraliza e otimiza a gestão de logs
 */

const pino = require('pino');

// Detectar ambiente
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Configurar níveis de log baseado no ambiente
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Configurar transporte baseado no ambiente
const transport = isDevelopment ? {
    target: 'pino-pretty',
    options: {
        colorize: true,
        translateTime: true,
        ignore: 'pid,hostname'
    }
} : undefined;

// Criar logger principal
const mainLogger = pino({
    level: logLevel,
    transport
});

/**
 * Logger otimizado com categorias e níveis
 */
class HiveLogger {
    constructor(category = 'app') {
        this.category = category;
        this.logger = mainLogger.child({ category });
    }

    // Logs de informação geral (sempre mostrar informações importantes)
    info(message, meta = {}) {
        this.logger.info(meta, `[${this.category}] ${message}`);
    }

    // Logs de debug (apenas em desenvolvimento)
    debug(message, meta = {}) {
        if (isDevelopment) {
            this.logger.debug(meta, `[${this.category}] ${message}`);
        }
    }

    // Logs de erro (sempre mostrar)
    error(message, error = null, meta = {}) {
        const errorMeta = error ? { 
            ...meta, 
            error: error.message, 
            stack: error.stack 
        } : meta;
        this.logger.error(errorMeta, `[${this.category}] ${message}`);
    }

    // Logs de aviso (sempre mostrar)
    warn(message, meta = {}) {
        this.logger.warn(meta, `[${this.category}] ${message}`);
    }

    // Logs condicionais para operações verbosas
    verbose(message, meta = {}) {
        if (isDevelopment || process.env.VERBOSE_LOGS === 'true') {
            this.logger.debug(meta, `[${this.category}] ${message}`);
        }
    }

    // Logs de conexão WhatsApp (otimizados)
    connection(clientId, status, details = {}) {
        const importantStatuses = ['connected', 'disconnected', 'logged_out', 'qr_generated'];
        
        if (importantStatuses.includes(status) || isDevelopment) {
            this.info(`${clientId} - Status: ${status}`, details);
        } else {
            this.verbose(`${clientId} - Status: ${status}`, details);
        }
    }

    // Logs de operações críticas (sempre mostrar)
    critical(message, meta = {}) {
        this.logger.fatal(meta, `[${this.category}] CRITICAL: ${message}`);
    }
}

// Instâncias de logger para diferentes módulos
const loggers = {
    app: new HiveLogger('app'),
    whatsapp: new HiveLogger('whatsapp'),
    api: new HiveLogger('api'),
    auth: new HiveLogger('auth'),
    proxy: new HiveLogger('proxy')
};

// Função para obter logger por categoria
function getLogger(category = 'app') {
    if (!loggers[category]) {
        loggers[category] = new HiveLogger(category);
    }
    return loggers[category];
}

// Middleware para logs de requisições
function requestLogger(req, res, next) {
    const start = Date.now();
    const logger = getLogger('api');
    
    // Log da requisição (apenas em desenvolvimento ou se habilitado)
    if (isDevelopment || process.env.LOG_REQUESTS === 'true') {
        logger.debug(`${req.method} ${req.url}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }

    // Log da resposta
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`
        };

        if (res.statusCode >= 400) {
            logger.warn(`Request completed with error`, logData);
        } else if (isDevelopment || duration > 1000) {
            logger.info(`Request completed`, logData);
        }
    });

    next();
}

module.exports = {
    getLogger,
    requestLogger,
    HiveLogger,
    isDevelopment,
    isProduction
}; 