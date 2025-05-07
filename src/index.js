// Configurar dotenv para variáveis de ambiente logo no início
require('dotenv').config();

// Verificar se API_KEY está configurada
if (!process.env.API_KEY) {
  console.error('\x1b[31m%s\x1b[0m', 'ERRO: API_KEY não encontrada no arquivo .env!');
  console.log('\x1b[33m%s\x1b[0m', 'Por favor, crie um arquivo .env na raiz do projeto com o seguinte conteúdo:');
  console.log('\x1b[36m%s\x1b[0m', 'API_KEY=47ec728124b69c04843556078d9033c41ace727c653a6d0072951420d4cdfc17');
  console.log('\x1b[33m%s\x1b[0m', 'Ou substitua pelo seu próprio código aleatório de segurança.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const whatsappRoutes = require('./routes/whatsappRoutes');
const whatsappService = require('./services/whatsappService');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    console.log('Carregando instâncias existentes...');
    const sessions = await whatsappService.loadExistingSessions();
    console.log(`${sessions.length} instâncias carregadas com sucesso!`);
  } catch (error) {
    console.error('Erro ao carregar instâncias:', error);
  }
})();

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Frontend disponível em http://localhost:${PORT}`);
});
