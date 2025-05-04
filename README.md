# HiveWP API - API de WhatsApp baseada em Baileys

Uma API RESTful para interagir com o WhatsApp Web usando a biblioteca Baileys.

## Funcionalidades

- Autenticação via QR Code
- Envio de mensagens de texto
- Envio de imagens com legendas
- Gerenciamento de conexão
- Monitoramento de status

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

## Endpoints da API

### Conexão e status

- **GET /api/whatsapp/qr** - Obtém o QR Code para autenticação
- **GET /api/whatsapp/status** - Verifica o status da conexão
- **POST /api/whatsapp/restart** - Reinicia a conexão
- **POST /api/whatsapp/logout** - Desconecta do WhatsApp

### Envio de mensagens

- **POST /api/whatsapp/send/text** - Envia uma mensagem de texto
  - Body: `{ "phoneNumber": "5511999999999", "message": "Olá, mundo!" }`

- **POST /api/whatsapp/send/image** - Envia uma imagem
  - Body: `{ "phoneNumber": "5511999999999", "imageUrl": "https://exemplo.com/imagem.jpg", "caption": "Descrição da imagem" }`

## Exemplos de uso

### Enviar mensagem de texto

```javascript
fetch('http://localhost:3000/api/whatsapp/send/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '5511999999999',
    message: 'Olá, esta é uma mensagem de teste!'
  }),
})
.then(response => response.json())
.then(data => console.log(data));
```

## Licença

ISC
