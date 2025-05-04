# HiveWP API - API de WhatsApp baseada em Baileys

Uma API RESTful para interagir com o WhatsApp Web usando a biblioteca Baileys.

## Funcionalidades

- Autenticação via QR Code
- Envio de mensagens de texto
- Envio de imagens com legendas
- Envio de documentos PDF
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
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "message": "Olá, mundo!" }`

- **POST /api/whatsapp/send/image** - Envia uma imagem
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "imageUrl": "https://exemplo.com/imagem.jpg", "caption": "Descrição da imagem" }`

- **POST /api/whatsapp/send/pdf** - Envia um documento PDF
  - Body: `{ "clientId": "identificador_do_cliente", "phoneNumber": "5511999999999", "pdfUrl": "https://exemplo.com/documento.pdf", "filename": "documento.pdf", "caption": "Descrição do documento" }`

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
     "message": "Olá do cliente1!"
   }
   ```

4. **Listar todas as instâncias ativas**:
   ```
   GET /api/whatsapp/instances
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
    message: 'Olá, esta é uma mensagem do cliente A!'
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

## Notas importantes

- A pasta `sessions` contém dados de autenticação e não deve ser commitada no Git (já está no .gitignore)
- Cada instância possui seu próprio subdiretório dentro da pasta `sessions/`
- Se você precisar desconectar uma instância do WhatsApp, use o endpoint `/api/whatsapp/logout` com o `clientId` correspondente
- Cada instância precisa escanear seu próprio QR code para autenticar

## Licença

ISC
