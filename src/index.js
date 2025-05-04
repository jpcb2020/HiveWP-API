const express = require('express');
const cors = require('cors');
const { initializeWhatsApp } = require('./services/whatsappService');
const whatsappRoutes = require('./routes/whatsappRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar a sessão do WhatsApp
initializeWhatsApp();

// Configurar rotas
app.use('/api/whatsapp', whatsappRoutes);

// Rota básica para verificar se o servidor está rodando
app.get('/', (req, res) => {
  res.json({ status: 'online', message: 'HiveWP API está rodando!' });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
