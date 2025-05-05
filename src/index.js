const express = require('express');
const cors = require('cors');
const whatsappRoutes = require('./routes/whatsappRoutes');
const whatsappService = require('./services/whatsappService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar rotas
app.use('/api/whatsapp', whatsappRoutes);

// Rota básica para verificar se o servidor está rodando
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'HiveWP API está rodando!' });
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
});
