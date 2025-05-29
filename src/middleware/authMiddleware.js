/**
 * Middleware de autenticação para proteger as rotas da API
 * Verifica se o cabeçalho de autenticação contém a chave de API correta
 */

const { getLogger } = require('../config/logger');
const logger = getLogger('auth');

// Armazenar em cache a API_KEY para evitar leitura repetida do env a cada requisição
const API_KEY = process.env.API_KEY;

// Verificar logo na inicialização
if (!API_KEY) {
  logger.critical('API_KEY não está definida no arquivo .env');
  // Não fazer process.exit aqui, pois isso já é tratado no index.js
}

const authMiddleware = (req, res, next) => {
  // Verificar se a API está configurada
  if (!API_KEY) {
    logger.error('Tentativa de acesso com API_KEY não configurada');
    return res.status(500).json({ 
      success: false, 
      message: 'Erro de configuração do servidor: Chave de API não configurada' 
    });
  }

  // Obter o token de autenticação do cabeçalho
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.warn('Tentativa de acesso sem token de autenticação', { 
      ip: req.ip,
      endpoint: req.path 
    });
    return res.status(401).json({ 
      success: false, 
      message: 'Acesso não autorizado: Token de autenticação ausente' 
    });
  }

  // Verificar formato do cabeçalho - otimizado para evitar split desnecessário
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Tentativa de acesso com formato de token inválido', { 
      ip: req.ip,
      authHeader: authHeader.substring(0, 20) + '...' 
    });
    return res.status(401).json({ 
      success: false, 
      message: 'Formato de token inválido. Use: Bearer TOKEN' 
    });
  }

  // Extrair token de forma mais eficiente
  const token = authHeader.substring(7); // 'Bearer '.length === 7

  // Verificar se o token corresponde à chave da API (comparação rápida)
  if (token !== API_KEY) {
    logger.warn('Tentativa de acesso com token inválido', { 
      ip: req.ip,
      endpoint: req.path,
      tokenPrefix: token.substring(0, 8) + '...'
    });
    return res.status(401).json({ 
      success: false, 
      message: 'Acesso não autorizado: Token inválido' 
    });
  }

  // Log de sucesso apenas em desenvolvimento para reduzir verbosidade
  logger.debug('Autenticação bem-sucedida', { 
    ip: req.ip,
    endpoint: req.path 
  });

  // Se a autenticação for bem-sucedida, prosseguir
  next();
};

module.exports = authMiddleware;
