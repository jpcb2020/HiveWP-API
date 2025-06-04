// Carregar o polyfill de crypto antes de qualquer outra coisa
require('./utils/crypto-polyfill');

// Configurar dotenv para variáveis de ambiente
require('dotenv').config();

const cluster = require('cluster');
const os = require('os');
const { getLogger, requestLogger } = require('./config/logger');

const numCPUs = process.env.CLUSTER_WORKERS ? parseInt(process.env.CLUSTER_WORKERS) : os.cpus().length;
const baseLogger = getLogger('cluster'); // Logger para o processo master

if (cluster.isMaster) {
  baseLogger.info(`Master ${process.pid} está rodando`);
  baseLogger.info(`Iniciando ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    baseLogger.info(`Worker ${worker.process.pid} ficou online`);
  });

  cluster.on('exit', (worker, code, signal) => {
    baseLogger.warn(`Worker ${worker.process.pid} morreu com código ${code} e sinal ${signal}`);
    baseLogger.info('Iniciando um novo worker...');
    cluster.fork(); // Reinicia o worker se ele morrer
  });

} else {
  // Este é um processo worker, configurar e iniciar o servidor Express aqui
  const workerLogger = getLogger(`worker-${process.pid}`); // Logger específico para o worker
  workerLogger.info('Worker iniciado. Configurando o servidor Express...');

  // Verificar se API_KEY está configurada (verificação por worker)
  if (!process.env.API_KEY) {
    workerLogger.critical('API_KEY não encontrada no arquivo .env! Worker não pode iniciar.');
    process.exit(1); // Worker não pode operar sem API_KEY
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

  // Rate Limiter Global
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: process.env.GLOBAL_RATE_LIMIT_MAX || 100, 
    standardHeaders: true, 
    legacyHeaders: false, 
    message: { success: false, error: 'Muitas requisições originadas deste IP, por favor, tente novamente mais tarde.' },
    handler: (req, res, next, options) => {
      const { getLogger: getRateLimitLogger } = require('./config/logger');
      const securityLogger = getRateLimitLogger('security');
      securityLogger.warn(`Rate limit GLOBAL excedido por IP: ${req.ip}`, { 
          path: req.path, 
          method: req.method,
          limit: options.max,
          windowMs: options.windowMs
      });
      res.status(options.statusCode).send(options.message);
    }
  });
  app.use(globalLimiter);

  // Middleware de logs de requisições (usando o logger do worker)
  // Nota: requestLogger já usa getLogger('api'), que será instanciado por worker se o módulo logger for carregado por worker
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

  // Carregar instâncias existentes (MODIFICADO NA PRÓXIMA ETAPA PARA LAZY LOADING)
  (async () => {
    try {
      workerLogger.info('Carregando instâncias existentes para este worker...');
      // A lógica de whatsappService.loadExistingSessions() será modificada
      // para não conectar todas imediatamente, ou para ser chamada sob demanda.
      // Por enquanto, manteremos a chamada, mas a funcionalidade interna mudará.
      const sessions = await whatsappService.loadExistingSessions(); 
      workerLogger.info(`${sessions.length} diretórios de sessão encontrados para este worker (não necessariamente conectados)`);
    } catch (error) {
      workerLogger.error('Erro ao carregar instâncias existentes para este worker', error);
    }
  })();

  // Middleware de tratamento de erros (deve ser o último middleware)
  app.use(errorHandler);

  // Iniciar o servidor no worker
  app.listen(PORT, () => {
    workerLogger.info(`Worker ${process.pid} escutando na porta ${PORT}`);
    workerLogger.info(`Frontend (servido pelo worker ${process.pid}) disponível em http://localhost:${PORT}`);
  });
}
