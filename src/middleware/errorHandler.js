const { getLogger } = require('../config/logger');
const logger = getLogger('error');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(err.message || 'Ocorreu um erro inesperado', { 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    body: req.body, // Cuidado com dados sensíveis em logs
    params: req.params,
    query: req.query
  });

  // Verifica se o erro é de validação do Joi
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      details: err.details.map(detail => ({
        message: detail.message,
        path: detail.path,
        type: detail.type
      }))
    });
  }
  
  // Verifica se o erro já tem um status code (ex: erros de rate limit)
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    return res.status(err.status).json({
      success: false,
      error: err.message || 'Ocorreu um erro.'
    });
  }

  // Se o erro já definiu um statusCode na resposta, respeita isso
  if (res.statusCode >= 400) {
      return res.json({
          success: false,
          error: err.message || 'Ocorreu um erro.'
      });
  }

  // Erro genérico
  return res.status(500).json({
    success: false,
    error: 'Ocorreu um erro interno no servidor.'
  });
};

module.exports = errorHandler; 