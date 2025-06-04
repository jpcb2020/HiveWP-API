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

// Rate Limiter Global (ex: 100 requisições por 15 minutos por IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP por janela
  standardHeaders: true, // Retorna informações de limite nos headers `RateLimit-*`
  legacyHeaders: false, // Desabilita os headers `X-RateLimit-*` (legado)
  message: { success: false, error: 'Muitas requisições originadas deste IP, por favor, tente novamente mais tarde.' },
  // Pode-se adicionar um handler para logar quando o limite é atingido
  handler: (req, res, next, options) => {
    const logger = require('./config/logger').getLogger('security');
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
});

// Middleware de tratamento de erros (deve ser o último middleware)
app.use(errorHandler);
