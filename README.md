# HiveWP API - API de WhatsApp baseada em Baileys

Uma API RESTful para interagir com o WhatsApp Web usando a biblioteca Baileys.

## Funcionalidades

- Autenticação via QR Code
- Envio de mensagens de texto
- Envio de mídias (imagens, documentos, vídeos, áudios)
- Gerenciamento de conexão
- Monitoramento de status
- **Múltiplas instâncias** para gerenciar diferentes clientes
- **Ignorar mensagens de grupos** para filtrar apenas mensagens individuais
- **Webhooks** para receber notificações de mensagens em tempo real

## Requisitos

- Node.js v14 ou superior
- NPM ou Yarn

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/HiveWP-API.git
cd HiveWP-API
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` para adicionar sua chave de API:
```
API_KEY=sua_chave_api_secreta
IGNORE_GROUPS=false
```
> Nota: A API_KEY é necessária para autenticação. Você pode gerar uma chave aleatória usando o comando: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> Nota: IGNORE_GROUPS pode ser definido como 'true' para ignorar mensagens de grupos globalmente em todas as instâncias

4. Inicie o servidor:
```bash
npm start
```

Para desenvolvimento:
```bash
npm run dev
```

5. Inicialize uma instância e acesse o QR Code para conectar seu WhatsApp:
```
POST http://localhost:3000/api/whatsapp/instance/init 
Content-Type: application/json

{
  "clientId": "cliente1",
  "ignoreGroups": true, // Opcional: configurar a instância para ignorar mensagens de grupos
  "webhookUrl": "https://sua-url.com/webhook" // Opcional: URL para receber notificações de mensagens
}
```

```
http://localhost:3000/api/whatsapp/qr-image?clientId=cliente1
```

## Endpoints da API

### Gerenciamento de Instâncias

- **GET /api/whatsapp/instances** - Lista todas as instâncias ativas
- **POST /api/whatsapp/instance/init** - Inicializa uma nova instância
  - Body: `{ "clientId": "identificador_unico_do_cliente", "ignoreGroups": true|false, "webhookUrl": "https://sua-url.com/webhook" }`
- **POST /api/whatsapp/instance/delete** - Deleta uma instância existente
  - Body: `{ "clientId": "identificador_unico_do_cliente" }`
- **POST /api/whatsapp/instance/config** - Atualiza configurações de uma instância existente
  - Body: `{ "clientId": "identificador_unico_do_cliente", "ignoreGroups": true|false, "webhookUrl": "https://sua-url.com/webhook" }`
- **POST /api/whatsapp/check-number** - Verifica se um número está registrado no WhatsApp
  - Body: `{ "clientId": "identificador_unico_do_cliente", "phoneNumber": "5511999999999" }`

### Conexão e status

- **GET /api/whatsapp/qr** - Obtém o QR Code para autenticação (formato JSON)
  - Query: `?clientId=identificador_do_cliente` (opcional, padrão é 'default')
- **GET /api/whatsapp/qr-image** - Obtém o QR Code como imagem PNG
  - Query: `?clientId=identificador_do_cliente` (opcional, padrão é 'default')
- **GET /api/whatsapp/status** - Verifica o status da conexão
  - Query: `?clientId=identificador_do_cliente` (opcional, padrão é 'default')
- **POST /api/whatsapp/restart** - Reinicia a conexão
  - Body: `{ "clientId": "identificador_do_cliente" }` (opcional, padrão é 'default')
- **POST /api/whatsapp/logout** - Desconecta do WhatsApp
  - Body: `{ "clientId": "identificador_do_cliente" }` (opcional, padrão é 'default')

### Envio de mensagens

- **POST /api/whatsapp/send/text** - Envia uma mensagem de texto
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "message": "Olá, mundo!", "simulateTyping": false, "typingDurationMs": 1500 }`
  - Nota: Os parâmetros `simulateTyping` e `typingDurationMs` são opcionais. Se `simulateTyping` for `true`, o WhatsApp mostrará o status "digitando..." por `typingDurationMs` milissegundos antes de enviar a mensagem.
  - Nota: O número de telefone é verificado antes do envio. Se não estiver registrado no WhatsApp, a API retornará um erro.

- **POST /api/whatsapp/send/media** - Envia uma mídia (imagem, documento, vídeo ou áudio)
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "mediaUrl": "https://exemplo.com/arquivo.jpg", "filename": "nome_do_arquivo.jpg", "mimetype": "image/jpeg", "caption": "Descrição da mídia" }`
  - Nota: Os parâmetros `filename` e `mimetype` são opcionais. Se não fornecidos, serão detectados automaticamente pela extensão do arquivo.
  - Nota: O tipo de mídia (imagem, vídeo, áudio ou documento) é automaticamente detectado pelo mimetype.
  - Nota: O número de telefone é verificado antes do envio. Se não estiver registrado no WhatsApp, a API retornará um erro.

- **POST /api/whatsapp/send/audio** - Envia uma mensagem de áudio (PTT/Voice Message)
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "audioUrl": "https://exemplo.com/audio.mp3", "mimetype": "audio/mpeg" }`
  - Nota: O parâmetro `mimetype` é opcional. Se não fornecido, será detectado automaticamente pela extensão do arquivo.
  - Nota: Formatos de áudio suportados: MP3 (audio/mpeg), M4A (audio/mp4), AAC (audio/aac), OGG (audio/ogg), OPUS (audio/opus), WAV (audio/wav), FLAC (audio/flac), WEBM (audio/webm)
  - Nota: O número de telefone é verificado antes do envio. Se não estiver registrado no WhatsApp, a API retornará um erro.

## Autenticação da API

A HiveWP API utiliza autenticação baseada em token para proteger todos os endpoints. Para acessar qualquer endpoint da API, você precisa incluir a API_KEY no cabeçalho de autorização:

```
Authorization: Bearer sua_chave_api_secreta
```

### Exemplos de uso com autenticação:

```javascript
// Exemplo de requisição autenticada
fetch('http://localhost:3000/api/whatsapp/instances', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sua_chave_api_secreta'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Notas sobre segurança:

- A API_KEY deve ser mantida em segredo e nunca exposta em código frontend público
- Todas as requisições sem o cabeçalho de autenticação correto serão rejeitadas com status 401
- Para integração com aplicações frontend, recomenda-se utilizar um proxy ou backend intermediário que gerencie a API_KEY
- O frontend da aplicação armazena a API_KEY no localStorage do navegador para facilitar o desenvolvimento

## Usando o Sistema de Múltiplas Instâncias

O sistema de múltiplas instâncias permite gerenciar vários clientes de WhatsApp simultaneamente na mesma API. Cada cliente possui sua própria sessão, credenciais e estado de conexão.

### Como Usar:

1. **Inicializar uma nova instância para um cliente**:
   ```
   POST /api/whatsapp/instance/init
   Content-Type: application/json

   {
     "clientId": "cliente1",
     "ignoreGroups": true, // Opcional: configurar a instância para ignorar mensagens de grupos
     "webhookUrl": "https://sua-url.com/webhook" // Opcional: URL para receber notificações de mensagens
   }
   ```

2. **Obter o QR Code para uma instância específica**:
   ```
   GET /api/whatsapp/qr-image?clientId=cliente1
   ```

3. **Enviar mensagens de uma instância específica**:
   ```
   POST /api/whatsapp/send/text
   Content-Type: application/json

   {
     "clientId": "cliente1",
     "phoneNumber": "5511999999999",
     "message": "Olá do cliente1!",
     "simulateTyping": true,  // Opcional: simula digitação antes de enviar
     "typingDurationMs": 2000 // Opcional: duração da simulação de digitação em ms (padrão: 1500)
   }
   ```

4. **Listar todas as instâncias ativas**:
   ```
   GET /api/whatsapp/instances
   ```

5. **Deletar uma instância específica**:
   ```
   POST /api/whatsapp/instance/delete
   Content-Type: application/json

   {
     "clientId": "cliente1"
   }
   ```

### Observações sobre Múltiplas Instâncias:

- Cada instância é identificada por um `clientId` único
- Uma instância padrão ('default') é usada se nenhum `clientId` for especificado
- Cada instância possui seu próprio diretório de sessão em `sessions/{clientId}`
- Cada instância pode ter sua própria configuração de `ignoreGroups` e `webhookUrl`

## Webhooks

A API suporta webhooks para notificar sistemas externos sobre mensagens recebidas no WhatsApp em tempo real.

### Como configurar um webhook:

1. **Ao inicializar uma nova instância**:
   ```
   POST /api/whatsapp/instance/init
   Content-Type: application/json

   {
     "clientId": "cliente1",
     "webhookUrl": "https://sua-url.com/webhook"
   }
   ```

2. **Ou para uma instância existente**:
   ```
   POST /api/whatsapp/instance/config
   Content-Type: application/json

   {
     "clientId": "cliente1",
     "webhookUrl": "https://sua-url.com/webhook"
   }
   ```

3. **Para remover um webhook**:
   ```
   POST /api/whatsapp/instance/config
   Content-Type: application/json

   {
     "clientId": "cliente1",
     "webhookUrl": ""
   }
   ```

### Formato dos dados enviados para o webhook:

Quando uma mensagem é recebida, o seguinte JSON é enviado via POST para a URL configurada:

```json
{
  "clientId": "cliente1",
  "messageType": "notify",
  "message": {
    // Objeto completo da mensagem do WhatsApp
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "ABCDEF123456"
    },
    "message": {
      "conversation": "Olá, como vai?"
    },
    // ... outros campos da mensagem
  },
  "timestamp": "2025-05-05T17:54:06-03:00"
}
```

### Notas sobre webhooks:

- É recomendável que seu endpoint de webhook responda rapidamente (preferencialmente em menos de 5 segundos)
- Se o webhook falhar, a mensagem continuará a ser processada normalmente
- Apenas mensagens recebidas são enviadas para o webhook (mensagens enviadas pela API não são notificadas)
- Você pode usar o campo `ignoreGroups` junto com `webhookUrl` para filtrar as notificações apenas para mensagens individuais

## Exemplos de uso

### Inicialização de múltiplas instâncias

```javascript
// Inicializar instância para o cliente A
fetch('http://localhost:3000/api/whatsapp/instance/init', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    ignoreGroups: true, // Opcional: configurar a instância para ignorar mensagens de grupos
    webhookUrl: "https://sua-url.com/webhook" // Opcional: URL para receber notificações de mensagens
  }),
})
.then(response => response.json())
.then(data => console.log(data));

// Inicializar instância para o cliente B
fetch('http://localhost:3000/api/whatsapp/instance/init', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteB'
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

### Deletar uma instância

```javascript
fetch('http://localhost:3000/api/whatsapp/instance/delete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA'
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

### Enviar mensagem de texto de uma instância específica

```javascript
fetch('http://localhost:3000/api/whatsapp/send/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    phoneNumber: '5511999999999',
    message: 'Olá, esta é uma mensagem do cliente A!',
    simulateTyping: true,  // Opcional: simula digitação antes de enviar
    typingDurationMs: 2000 // Opcional: duração da simulação de digitação em ms (padrão: 1500)
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

### Enviar qualquer tipo de mídia (imagem, documento, vídeo, áudio)

```javascript
fetch('http://localhost:3000/api/whatsapp/send/media', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    phoneNumber: '5511999999999',
    mediaUrl: 'https://exemplo.com/arquivo.jpg', // URL da mídia (imagem, documento, vídeo, áudio)
    filename: 'imagem.jpg',  // Opcional, será detectado pela URL se omitido
    mimetype: 'image/jpeg', // Opcional, será detectado pela extensão se omitido
    caption: 'Legenda da imagem' // Opcional
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

### Enviar mensagem de áudio (PTT/Voice Message)

```javascript
fetch('http://localhost:3000/api/whatsapp/send/audio', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    phoneNumber: '5511999999999',
    audioUrl: 'https://exemplo.com/audio.mp3', // URL do áudio ou caminho local
    mimetype: 'audio/mpeg' // Opcional, será detectado pela extensão se omitido
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

### Verificar se um número existe no WhatsApp

```javascript
fetch('http://localhost:3000/api/whatsapp/check-number', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    phoneNumber: '5511999999999'
  }),
})
.then(response => response.json())
.then(data => {
  if (data.success && data.exists) {
    console.log('Número existe no WhatsApp e pode receber mensagens');
  } else {
    console.log('Número não está registrado no WhatsApp');
  }
});
```

### Configurar uma instância para ignorar mensagens de grupos

```javascript
fetch('http://localhost:3000/api/whatsapp/instance/config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clientId: 'clienteA',
    ignoreGroups: true // true para ignorar mensagens de grupos, false para processá-las
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

## Notas importantes

- A pasta `sessions` contém dados de autenticação e não deve ser commitada no Git (já está no .gitignore)
- Cada instância possui seu próprio subdiretório dentro da pasta `sessions/{clientId}`
- Se você precisar desconectar uma instância do WhatsApp, use o endpoint `/api/whatsapp/logout` com o `clientId` correspondente
- Cada instância precisa escanear seu próprio QR code para autenticar

## Licença

ISC
