/**
 * Polyfill para resolver problemas de compatibilidade com o módulo crypto
 * Isso é necessário porque o Baileys pode tentar usar o objeto global crypto sem importá-lo
 */

// Importa o módulo crypto nativo do Node.js
const nodeCrypto = require('crypto');

// Verifica se o objeto global crypto não está definido
if (typeof global.crypto === 'undefined') {
  // Define um polyfill para o objeto crypto global
  global.crypto = {
    // Implementa o método getRandomValues usando o módulo crypto do Node.js
    getRandomValues: function(buffer) {
      const randomBytes = nodeCrypto.randomBytes(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = randomBytes[i];
      }
      return buffer;
    },
    // Expõe a API completa do módulo crypto do Node.js
    ...nodeCrypto
  };
}

// Exporta o módulo crypto para compatibilidade
module.exports = global.crypto;
