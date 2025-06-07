const Joi = require('joi');

// Middleware genérico para validação
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { 
    abortEarly: false, // Coleta todos os erros, não apenas o primeiro
    stripUnknown: true // Remove campos desconhecidos
  });
  if (error) {
    // Passa o erro para o middleware de erro centralizado
    // Adiciona uma propriedade 'isJoi' para identificação no errorHandler
    error.isJoi = true;
    return next(error);
  }
  next();
};

// Esquemas de validação
const initInstanceSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).required()
    .messages({
      'string.base': 'clientId deve ser uma string',
      'string.pattern.base': 'clientId deve conter apenas letras, números e os caracteres: @ . _ -',
      'string.min': 'clientId deve ter no mínimo {#limit} caracteres',
      'string.max': 'clientId deve ter no máximo {#limit} caracteres',
      'any.required': 'clientId é obrigatório'
    }),
  ignoreGroups: Joi.boolean().optional(),
  webhookUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional().allow('')
    .messages({
      'string.uri': 'webhookUrl deve ser uma URL válida (http ou https)'
    }),
  proxyUrl: Joi.string().uri({ scheme: ['http', 'https', 'socks4', 'socks5'] }).optional().allow('')
   .messages({
     'string.uri': 'proxyUrl deve ser uma URL válida (http, https, socks4 ou socks5)'
   })
});

const deleteInstanceSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).required()
    .messages({
      'string.base': 'clientId deve ser uma string',
      'string.pattern.base': 'clientId deve conter apenas letras, números e os caracteres: @ . _ -',
      'string.min': 'clientId deve ter no mínimo {#limit} caracteres',
      'string.max': 'clientId deve ter no máximo {#limit} caracteres',
      'any.required': 'clientId é obrigatório'
    })
});

const updateConfigSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).required()
    .messages({
        'string.pattern.base': 'clientId deve conter apenas letras, números e os caracteres: @ . _ -',
        'any.required': 'clientId é obrigatório'
    }),
  ignoreGroups: Joi.boolean().optional(),
  webhookUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional().allow('')
    .messages({
        'string.uri': 'webhookUrl deve ser uma URL válida'
    }),
  proxyUrl: Joi.string().uri({ scheme: ['http', 'https', 'socks4', 'socks5'] }).optional().allow('')
    .messages({
        'string.uri': 'proxyUrl deve ser uma URL válida'
    })
});

const checkNumberSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\d+$/).min(10).max(15).required()
    .messages({
      'string.pattern.base': 'phoneNumber deve conter apenas dígitos',
      'string.min': 'phoneNumber deve ter no mínimo {#limit} dígitos',
      'string.max': 'phoneNumber deve ter no máximo {#limit} dígitos',
      'any.required': 'phoneNumber é obrigatório'
    })
});

const sendTextSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\d+$/).min(10).max(15).required()
    .messages({
      'string.pattern.base': 'phoneNumber deve conter apenas dígitos',
      'any.required': 'phoneNumber é obrigatório'
    }),
  message: Joi.string().min(1).max(4096).required()
    .messages({
      'string.min': 'A mensagem deve ter no mínimo {#limit} caractere',
      'string.max': 'A mensagem deve ter no máximo {#limit} caracteres',
      'any.required': 'A mensagem é obrigatória'
    }),
  simulateTyping: Joi.boolean().optional(),
  typingDurationMs: Joi.number().integer().min(500).max(5000).optional()
});

const sendMediaSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\d+$/).min(10).max(15).required()
    .messages({
        'string.pattern.base': 'phoneNumber deve conter apenas dígitos',
        'any.required': 'phoneNumber é obrigatório'
    }),
  mediaUrl: Joi.string().uri({ scheme: ['http', 'https'] }).required()
    .messages({
        'string.uri': 'mediaUrl deve ser uma URL válida (http ou https)',
        'any.required': 'mediaUrl é obrigatório'
    }),
  filename: Joi.string().optional().max(255),
  mimetype: Joi.string().optional().pattern(/^[a-z]+\/[-+\w.]+$/)
    .messages({
        'string.pattern.base': 'mimetype inválido'
    }),
  caption: Joi.string().optional().max(1024)
});

const sendAudioSchema = Joi.object({
  clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\d+$/).min(10).max(15).required()
    .messages({
        'string.pattern.base': 'phoneNumber deve conter apenas dígitos',
        'any.required': 'phoneNumber é obrigatório'
    }),
  audioUrl: Joi.string().uri({ scheme: ['http', 'https'] }).required()
    .messages({
        'string.uri': 'audioUrl deve ser uma URL válida (http ou https)',
        'any.required': 'audioUrl é obrigatório'
    }),
  caption: Joi.string().optional().max(1024),
  mimetype: Joi.string().optional().pattern(/^(audio\/(mpeg|ogg|wav|aac|opus)|application\/ogg)$/)
    .messages({
        'string.pattern.base': 'mimetype de áudio inválido ou não suportado'
    })
});

// Schemas para validação de query params
const qrCodeQuerySchema = Joi.object({
    clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional()
});

const statusQuerySchema = Joi.object({
    clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional()
});

const optionalClientIdBodySchema = Joi.object({
    clientId: Joi.string().pattern(/^[a-zA-Z0-9@._-]+$/).min(3).max(50).optional()
});

// Middleware para validação de query params
const validateQuery = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
    });
    if (error) {
        error.isJoi = true;
        return next(error);
    }
    req.query = value; // Sobrescreve req.query com os dados validados e possivelmente transformados
    next();
};

// Middleware para validação de params (rotas com :clientId)
// Por enquanto não há rotas com :clientId, mas pode ser útil no futuro.
// const clientIdParamSchema = Joi.object({
//     clientId: Joi.string().alphanum().min(3).max(30).required()
// });

// const validateParams = (schema) => (req, res, next) => {
//     const { error, value } = schema.validate(req.params, {
//         abortEarly: false,
//         stripUnknown: true 
//     });
//     if (error) {
//         error.isJoi = true;
//         return next(error);
//     }
//     req.params = value;
//     next();
// };

module.exports = {
  validate,
  validateQuery,
  initInstanceSchema,
  deleteInstanceSchema,
  updateConfigSchema,
  checkNumberSchema,
  sendTextSchema,
  sendMediaSchema,
  sendAudioSchema,
  qrCodeQuerySchema,
  statusQuerySchema,
  optionalClientIdBodySchema
  // clientIdParamSchema,
  // validateParams
}; 