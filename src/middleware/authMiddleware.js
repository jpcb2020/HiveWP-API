/**
 * Middleware de autenticação para proteger as rotas da API
 * Verifica se o cabeçalho de autenticação contém a chave de API correta
 */

// Armazenar em cache a API_KEY para evitar leitura repetida do env a cada requisição
const API_KEY = process.env.API_KEY;

// Verificar logo na inicialização
if (!API_KEY) {
  console.error('API_KEY não está definida no arquivo .env');
  // Não fazer process.exit aqui, pois isso já é tratado no index.js
}

const authMiddleware = (req, res, next) => {
  // Verificar se a API está configurada
  if (!API_KEY) {
    return res.status(500).json({ 
      success: false, 
      message: 'Erro de configuração do servidor: Chave de API não configurada' 
    });
  }

  // Obter o token de autenticação do cabeçalho
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'Acesso não autorizado: Token de autenticação ausente' 
    });
  }

  // Verificar formato do cabeçalho - otimizado para evitar split desnecessário
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Formato de token inválido. Use: Bearer TOKEN' 
    });
  }

  // Extrair token de forma mais eficiente
  const token = authHeader.substring(7); // 'Bearer '.length === 7

  // Verificar se o token corresponde à chave da API (comparação rápida)
  if (token !== API_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Acesso não autorizado: Token inválido' 
    });
  }

  // Se a autenticação for bem-sucedida, prosseguir
  next();
};

module.exports = authMiddleware;
