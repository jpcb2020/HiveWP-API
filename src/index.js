// Carregar o polyfill de crypto antes de qualquer outra coisa
require('./utils/crypto-polyfill');

// Configurar dotenv para variáveis de ambiente
require('dotenv').config();

// Configurar sistema de logs
const { getLogger, requestLogger } = require('./config/logger');
const logger = getLogger('app');

// Verificar se API_KEY está configurada
if (!process.env.API_KEY) {
  logger.critical('API_KEY não encontrada no arquivo .env!');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const whatsappRoutes = require('./routes/whatsappRoutes');
const healthRoutes = require('./routes/healthRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const whatsappService = require('./services/whatsappService');
const authMiddleware = require('./middleware/authMiddleware');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiter Global - Otimizado para monitoramento em tempo real
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto (janela menor para reset mais rápido)
  max: 200, // 200 requisições por minuto (suficiente para monitoramento)
  standardHeaders: true, // Retorna informações de limite nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita os headers `X-RateLimit-*` (legado)
  message: { success: false, error: 'Limite de requisições atingido. Aguarde alguns segundos.' },
  // Pode-se adicionar um handler para logar quando o limite é atingido
  handler: (req, res, next, options) => {
    const { getLogger } = require('./config/logger');
    const logger = getLogger('security');
    logger.warn(`Rate limit excedido por IP: ${req.ip}`, { 
        path: req.path, 
        method: req.method,
        limit: options.max,
        windowMs: options.windowMs
    });
    res.status(options.statusCode).send(options.message);
  }
});
app.use(globalLimiter);

// Adicionar middleware de logs de requisições
app.use(requestLogger);

// Rota de Health Check (não protegida por autenticação da API_KEY intencionalmente)
app.use('/system', healthRoutes);

// Rotas de monitoramento (algumas protegidas, outras não)
app.use('/monitoring', monitoringRoutes);

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Configurar rotas API
app.use('/api/whatsapp', whatsappRoutes);

// Rota básica para verificar se o servidor está rodando (protegida por autenticação)
app.get('/api/status', authMiddleware, (req, res) => {
  res.json({ status: 'online', message: 'HiveWP API está rodando!' });
});

// Rota para servir o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Carregar instâncias existentes
(async () => {
  try {
    logger.info('Carregando instâncias existentes...');
    const sessions = await whatsappService.loadExistingSessions();
    logger.info(`${sessions.length} instâncias carregadas com sucesso`);
  } catch (error) {
    logger.error('Erro ao carregar instâncias', error);
  }
})();

// Iniciar o servidor
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  logger.info(`Frontend disponível em http://localhost:${PORT}`);
  
  // Mostrar informações sobre o modo de execução
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    logger.info('🚀 MODO PRODUÇÃO ATIVO - Todas as otimizações carregadas');
    logger.info('📊 Suporte para 100+ instâncias WhatsApp simultâneas');
    logger.info('⚡ Rate limits: 500 msg/min | Cache ativo | Webhook queue: 25 concurrent');
  } else {
    logger.info('🔧 MODO DESENVOLVIMENTO - Para ativar otimizações use: NODE_ENV=production npm start');
  }
});

// Middleware de tratamento de erros (deve ser o último middleware)
app.use(errorHandler);
