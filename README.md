# HiveWP API - API de WhatsApp baseada em Baileys

Uma API RESTful para interagir com o WhatsApp Web usando a biblioteca Baileys.

## Funcionalidades

- Autenticação via QR Code
- Envio de mensagens de texto
- Envio de mídias (imagens, documentos, vídeos, áudios)
- Gerenciamento de conexão
- Monitoramento de status
- **Múltiplas instâncias** para gerenciar diferentes clientes

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
  "clientId": "cliente1"
}
```

```
http://localhost:3000/api/whatsapp/qr-image?clientId=cliente1
```

## Endpoints da API

### Gerenciamento de Instâncias

- **GET /api/whatsapp/instances** - Lista todas as instâncias ativas
- **POST /api/whatsapp/instance/init** - Inicializa uma nova instância
  - Body: `{ "clientId": "identificador_unico_do_cliente" }`
- **POST /api/whatsapp/instance/delete** - Deleta uma instância existente
  - Body: `{ "clientId": "identificador_unico_do_cliente" }`
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

## Usando o Sistema de Múltiplas Instâncias

O sistema de múltiplas instâncias permite gerenciar vários clientes de WhatsApp simultaneamente na mesma API. Cada cliente possui sua própria sessão, credenciais e estado de conexão.

### Como Usar:

1. **Inicializar uma nova instância para um cliente**:
   ```
   POST /api/whatsapp/instance/init
   Content-Type: application/json

   {
     "clientId": "cliente1"
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
- O parâmetro `clientId` é opcional em todos os endpoints (padrão é 'default')

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
    clientId: 'clienteA'
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

## Notas importantes

- A pasta `sessions` contém dados de autenticação e não deve ser commitada no Git (já está no .gitignore)
- Cada instância possui seu próprio subdiretório dentro da pasta `sessions/`
- Se você precisar desconectar uma instância do WhatsApp, use o endpoint `/api/whatsapp/logout` com o `clientId` correspondente
- Cada instância precisa escanear seu próprio QR code para autenticar

## Licença

ISC
