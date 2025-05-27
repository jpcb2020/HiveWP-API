<div align="center">

# 🐝 HiveWP API

### API de WhatsApp de alta performance baseada em Baileys

*Uma solução RESTful para integrar WhatsApp em suas aplicações*

</div>

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Usando a API](#usando-a-api)
- [Endpoints](#endpoints-da-api)
- [Sistema de Múltiplas Instâncias](#usando-o-sistema-de-múltiplas-instâncias)
- [Webhooks](#webhooks)
- [Suporte a Proxy](#suporte-a-proxy)
- [Exemplos](#exemplos-de-uso)

---

## 🌐 Visão Geral

HiveWP API é uma interface RESTful moderna e de alta performance para integrar o WhatsApp com seus sistemas, aplicativos e serviços. Construída sobre a poderosa biblioteca Baileys, oferece uma forma simples e eficiente de automatizar comunicações via WhatsApp.

## 🚀 Funcionalidades

| Recurso | Descrição |
|---------|------------|
| 🔐 **Autenticação** | Conexão simples via QR Code |
| 💬 **Mensagens** | Envio de mensagens de texto com formatação |
| 📁 **Mídia** | Suporte a imagens, documentos, vídeos e áudios |
| 🔄 **Gerenciamento** | Controle total sobre a conexão e status |
| 👥 **Multi-instância** | Gerencie múltiplos clientes simultaneamente |
| 🔍 **Filtros** | Opção para ignorar mensagens de grupos |
| 🔔 **Webhooks** | Notificações em tempo real para mensagens recebidas |
| 🌐 **Proxy** | Suporte completo a proxies SOCKS e HTTP/HTTPS |

## 📋 Requisitos

- Node.js v14 ou superior
- NPM ou Yarn

## ⚙️ Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/HiveWP-API.git
cd HiveWP-API
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` para adicionar sua chave de API:

```properties
PORT=3000
API_KEY=sua_chave_api_secreta
IGNORE_GROUPS=false
```

> **Dica de Segurança**: Gere uma chave aleatória forte usando:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 4. Inicie o servidor

Para produção:
```bash
npm start
```

Para desenvolvimento (com recarga automática):
```bash
npm run dev
```

### 5. Conecte seu WhatsApp

#### Inicialize uma instância

```http
POST http://localhost:3000/api/whatsapp/instance/init 
Content-Type: application/json
Authorization: Bearer sua_chave_api_secreta

{
  "clientId": "cliente1",
  "ignoreGroups": true,         // Opcional: ignorar mensagens de grupos
  "webhookUrl": "https://sua-url.com/webhook",  // Opcional: receber notificações
  "proxyUrl": "socks5://user:pass@proxy.example.com:1080"  // Opcional: usar proxy
}
```

#### Escaneie o QR Code

```
GET http://localhost:3000/api/whatsapp/qr-image?clientId=cliente1
Authorization: Bearer sua_chave_api_secreta
```

## 📂 Endpoints da API

Todos os endpoints da API requerem autenticação via header `Authorization: Bearer sua_chave_api_secreta`.

### Gerenciamento de Instâncias

<details>
<summary>🔽 Expandir Endpoints de Gerenciamento</summary>

#### Lista todas as instâncias ativas
```http
GET /api/whatsapp/instances
```

#### Inicializa uma nova instância
```http
POST /api/whatsapp/instance/init
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",      // Obrigatório
  "ignoreGroups": true,                      // Opcional
  "webhookUrl": "https://sua-url.com/webhook", // Opcional
  "proxyUrl": "socks5://user:pass@proxy.example.com:1080"  // Opcional
}
```

#### Deleta uma instância existente
```http
POST /api/whatsapp/instance/delete
Content-Type: application/json

{
  "clientId": "identificador_do_cliente"      // Obrigatório
}
```

#### Atualiza configurações de uma instância
```http
POST /api/whatsapp/instance/config
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",
  "ignoreGroups": true,                      // Opcional
  "webhookUrl": "https://sua-url.com/webhook", // Opcional
  "proxyUrl": "socks5://user:pass@proxy.example.com:1080"  // Opcional
}
```

#### Verifica se um número está registrado no WhatsApp
```http
POST /api/whatsapp/check-number
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",      // Opcional (default: 'default')
  "phoneNumber": "5511999999999"               // Obrigatório
}
```
</details>

### Conexão e Status

<details>
<summary>🔽 Expandir Endpoints de Conexão</summary>

#### Obtém o QR Code para autenticação (formato JSON)
```http
GET /api/whatsapp/qr?clientId=identificador_do_cliente
```
> *clientId é opcional, padrão: 'default'*

#### Obtém o QR Code como imagem PNG
```http
GET /api/whatsapp/qr-image?clientId=identificador_do_cliente
```
> *clientId é opcional, padrão: 'default'*

#### Verifica o status da conexão
```http
GET /api/whatsapp/status?clientId=identificador_do_cliente
```
> *clientId é opcional, padrão: 'default'*

#### Reinicia a conexão
```http
POST /api/whatsapp/restart
Content-Type: application/json

{
  "clientId": "identificador_do_cliente"      // Opcional (default: 'default')
}
```

#### Desconecta do WhatsApp
```http
POST /api/whatsapp/logout
Content-Type: application/json

{
  "clientId": "identificador_do_cliente"      // Opcional (default: 'default')
}
```
</details>

### Envio de Mensagens

<details>
<summary>🔽 Expandir Endpoints de Mensagens</summary>

#### Envia uma mensagem de texto
```http
POST /api/whatsapp/send/text
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",  // Opcional (default: 'default')
  "phoneNumber": "5511999999999",         // Obrigatório
  "message": "Olá, mundo!",              // Obrigatório
  "simulateTyping": false,               // Opcional
  "typingDurationMs": 1500               // Opcional, se simulateTyping=true
}
```

> **Nota:** Se `simulateTyping` for `true`, o WhatsApp mostrará o status "digitando..." por `typingDurationMs` milissegundos antes de enviar a mensagem.

#### Envia uma mídia (imagem, documento, vídeo)
```http
POST /api/whatsapp/send/media
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",          // Opcional (default: 'default')
  "phoneNumber": "5511999999999",                 // Obrigatório
  "mediaUrl": "https://exemplo.com/arquivo.jpg",  // Obrigatório
  "filename": "nome_do_arquivo.jpg",              // Opcional
  "mimetype": "image/jpeg",                       // Opcional
  "caption": "Descrição da mídia"                // Opcional
}
```

> **Nota:** Os parâmetros `filename` e `mimetype` são detectados automaticamente a partir da URL se não fornecidos.

#### Envia uma mensagem de áudio (PTT/Voice Message)
```http
POST /api/whatsapp/send/audio
Content-Type: application/json

{
  "clientId": "identificador_do_cliente",          // Opcional (default: 'default')
  "phoneNumber": "5511999999999",                 // Obrigatório
  "audioUrl": "https://exemplo.com/audio.mp3",    // Obrigatório
  "mimetype": "audio/mpeg"                        // Opcional
}
```

> **Formatos de áudio suportados:** MP3, M4A, AAC, OGG, OPUS, WAV, FLAC, WEBM
</details>

## 🔐 Autenticação da API

A HiveWP API utiliza autenticação baseada em token para proteger todos os endpoints. 

### Incluindo autenticação nas requisições

Para todas as requisições, adicione o seguinte cabeçalho HTTP:

```http
Authorization: Bearer sua_chave_api_secreta
```

### Exemplo de requisição autenticada (JavaScript)

```javascript
// Usando fetch API para fazer requisição autenticada
const fetchOptions = {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sua_chave_api_secreta'
  }
};

fetch('http://localhost:3000/api/whatsapp/instances', fetchOptions)
  .then(response => {
    if (!response.ok) throw new Error(`Erro: ${response.status}`);
    return response.json();
  })
  .then(data => console.log('Instâncias ativas:', data))
  .catch(error => console.error('Falha na requisição:', error));
```

### ⚠️ Melhores práticas de segurança

| Diretriz | Descrição |
|---------|------------|
| 🔒 **Privacidade** | Mantenha sua API_KEY em segredo e nunca a exponha em código frontend público |
| 🚫 **Rejeição** | Requisições sem autenticação válida são rejeitadas com status 401 |
| 🚀 **Integração** | Para aplicações frontend, use um proxy ou backend intermediário para gerenciar a API_KEY |
| 🔄 **Rotação** | Troque periodicamente sua API_KEY para maior segurança |

## 👥 Sistema de Múltiplas Instâncias

O HiveWP API permite gerenciar vários clientes WhatsApp simultaneamente através do sistema de múltiplas instâncias.

<div align="center">

![Múltiplas Instâncias](./.github/images/multi-instance.png)

</div>

### 💎 Principais Vantagens

- 💼 **Gestão Centralizada**: Gerenciamento de todos os clientes a partir de uma única API
- 🔐 **Isolamento**: Cada cliente possui suas próprias credenciais e configurações
- 📝 **Personalização**: Configuração individual de webhooks e preferências

### 🔗 Estrutura de Armazenamento

- Cada instância é identificada por um `clientId` único
- Instância padrão (`default`) é usada quando nenhum `clientId` é especificado
- Sessões são armazenadas em diretórios separados: `sessions/{clientId}/`

### 🔄 Fluxo de Utilização

1. **Inicializar uma nova instância**:

```http
POST /api/whatsapp/instance/init
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "empresa_xyz",                   // Identificador único do cliente
  "ignoreGroups": true,                       // Opcional: ignorar mensagens de grupos
  "webhookUrl": "https://sua-url.com/webhook", // Opcional: URL para notificações
  "proxyUrl": "socks5://user:pass@proxy.example.com:1080"  // Opcional: usar proxy
}
```

2. **Escanear o QR Code**:

```http
GET /api/whatsapp/qr-image?clientId=empresa_xyz
Authorization: Bearer sua_chave_api_secreta
```

3. **Gerenciar a Instância Conectada**:

- Enviar mensagens de texto: `/api/whatsapp/send/text` (incluindo `clientId` no corpo)
- Enviar mídias: `/api/whatsapp/send/media` (incluindo `clientId` no corpo)
- Verificar status: `/api/whatsapp/status?clientId=empresa_xyz`
- Listar todas: `/api/whatsapp/instances`
- Desconectar: `/api/whatsapp/logout` (incluindo `clientId` no corpo)
- Deletar completamente: `/api/whatsapp/instance/delete` (incluindo `clientId` no corpo)

## 🔔 Webhooks

A API suporta webhooks para notificar sistemas externos em tempo real sobre mensagens recebidas no WhatsApp.

<div align="center">

![Webhooks Integration](https://mermaid.ink/img/pako:eNptkLFuAjEQRH_F8tUUpKRJiSIkk0IBJUK05Dzec7DAZ-_aOyEi_ntsBQUpKO-NRjNv_QSOaVCP7mnf6fAaJwlMlxcX4-bcwOJhRPxgekY3sBu6Dq06MK3d27Bbl3EzFZu8lJKlZJYs-ZCm-NZ5XVFxxYpHbSzYcCGPzE76J6DRuVhTB2QVizM9FY41hAu1sTXOUeUDVDrHU0Tnr56-RXnB9KOKi_9QPrT0TnKElVxcSLfpZP8Fz8gOIbH7_gHj7VA8)

</div>

### 🔗 Configuração de Webhooks

#### 1. Ao inicializar uma nova instância

```http
POST /api/whatsapp/instance/init
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente1",
  "webhookUrl": "https://sua-url.com/webhook"
}
```

#### 2. Para uma instância existente

```http
POST /api/whatsapp/instance/config
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente1",
  "webhookUrl": "https://sua-url.com/webhook"
}
```

#### 3. Para remover um webhook

```http
POST /api/whatsapp/instance/config
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente1",
  "webhookUrl": ""
}
```

### 📬 Formato dos Dados Enviados

Quando uma mensagem é recebida, o seguinte JSON é enviado via POST para a URL configurada:

```json
{
  "clientId": "cliente1",
  "timestamp": "2025-05-05T17:54:06-03:00",
  "message": {
    "id": "ABCDEF123456",
    "from": "5511999999999@s.whatsapp.net",
    "fromMe": false,
    "timestamp": 1620123456,
    "isGroup": false,
    "type": "text",
    "body": "Olá, como vai?"
  },
  "originalMessage": {
    // Objeto completo original da mensagem do WhatsApp (opcional)
  }
}
```

### 💡 Estrutura Simplificada das Mensagens

O sistema oferece uma estrutura simplificada para facilitar o processamento das mensagens, com os seguintes tipos:

<details>
<summary><b>💬 Mensagens de Texto</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "text",
  "body": "Conteúdo da mensagem de texto",
  "quotedMessage": { 
    "id": "MSG-ORIGINAL",
    "participant": "55119999999@s.whatsapp.net"
  }
}
```
> O campo `quotedMessage` está presente apenas se for uma resposta a outra mensagem.
</details>

<details>
<summary><b>🎧 Mensagens de Áudio/PTT</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "audio", 
  "seconds": 10,
  "mimetype": "audio/ogg; codecs=opus",
  "base64Audio": "base64-data..." 
}
```
> O campo `type` pode ser `"audio"` para áudios comuns ou `"ptt"` para mensagens de voz (push-to-talk).
>
> O campo `base64Audio` contém o conteúdo completo do áudio automaticamente extraído e convertido para base64.
</details>

<details>
<summary><b>📷 Mensagens com Imagens</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "image",
  "caption": "Legenda da imagem (se houver)",
  "mimetype": "image/jpeg"
}
```
</details>

<details>
<summary><b>🎥 Mensagens com Vídeos</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "video",
  "caption": "Legenda do vídeo (se houver)",
  "mimetype": "video/mp4"
}
```
</details>

<details>
<summary><b>📄 Documentos</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "document",
  "fileName": "documento.pdf",
  "mimetype": "application/pdf"
}
```
</details>

<details>
<summary><b>📍 Localização</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "location",
  "latitude": -23.5505,
  "longitude": -46.6333
}
```
</details>

<details>
<summary><b>💼 Contatos</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "contact",
  "name": "Nome do Contato",
  "vcard": "vCard em formato de string"
}
```
</details>

<details>
<summary><b>👍 Reações</b></summary>

```json
{
  "id": "MSG123456",
  "from": "5511999999999@s.whatsapp.net",
  "type": "reaction",
  "emoji": "👍",
  "targetMessageId": "MSG-ALVO"
}
```
</details>

### 💾 Extração Automática de Áudio em Base64

Quando um cliente envia uma mensagem de áudio (comum ou PTT), o sistema:

1. Detecta automaticamente o tipo de mensagem
2. Baixa o conteúdo do áudio dos servidores do WhatsApp
3. Converte para formato base64
4. Inclui o conteúdo no campo `base64Audio` da mensagem simplificada

Este processamento é feito de forma eficiente, mantendo a alta performance da API.

### ⚙️ Melhores Práticas para Webhooks

| Prática | Descrição |
|---------|------------|
| ⏱️ **Resposta Rápida** | Seu endpoint deve responder em menos de 5 segundos |
| 🔒 **Segurança** | Implemente validação de autenticidade no seu endpoint |
| 🔄 **Resiliência** | Prepare-se para falhas (se o webhook falhar, a mensagem será processada mesmo assim) |
| 👥 **Filtragem** | Use `ignoreGroups: true` para receber apenas mensagens individuais |
| 📢 **Escopo** | Apenas mensagens recebidas são enviadas para o webhook |

## 🌐 Suporte a Proxy

A HiveWP API oferece suporte completo a proxies para permitir conexões através de servidores intermediários. Isso é útil para contornar restrições de rede, melhorar a privacidade ou conectar através de redes corporativas.

### 🔧 Tipos de Proxy Suportados

| Tipo | Protocolo | Exemplo |
|------|-----------|---------|
| **SOCKS4** | `socks4://` | `socks4://proxy.example.com:1080` |
| **SOCKS5** | `socks5://` | `socks5://user:pass@proxy.example.com:1080` |
| **HTTP** | `http://` | `http://proxy.example.com:8080` |
| **HTTPS** | `https://` | `https://user:pass@proxy.example.com:8080` |

### 🚀 Configuração de Proxy

#### 1. Ao criar uma nova instância

```http
POST /api/whatsapp/instance/init
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente_com_proxy",
  "proxyUrl": "socks5://usuario:senha@proxy.example.com:1080"
}
```

#### 2. Para uma instância existente

```http
POST /api/whatsapp/instance/config
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente_existente",
  "proxyUrl": "http://proxy.example.com:8080"
}
```

#### 3. Para remover proxy de uma instância

```http
POST /api/whatsapp/instance/config
Authorization: Bearer sua_chave_api_secreta
Content-Type: application/json

{
  "clientId": "cliente_existente",
  "proxyUrl": ""
}
```

### 💡 Exemplos de Configuração

<details>
<summary><b>🔐 Proxy SOCKS5 com Autenticação</b></summary>

```javascript
// Configurar instância com proxy SOCKS5 autenticado
callHiveWPAPI('instance/init', 'POST', {
  clientId: 'empresa_segura',
  proxyUrl: 'socks5://meuusuario:minhasenha@proxy.empresa.com:1080',
  ignoreGroups: true,
  webhookUrl: 'https://webhook.empresa.com/whatsapp'
})
.then(data => console.log('Instância com proxy criada:', data))
.catch(err => console.error('Erro:', err));
```
</details>

<details>
<summary><b>🌐 Proxy HTTP Simples</b></summary>

```javascript
// Configurar instância com proxy HTTP sem autenticação
callHiveWPAPI('instance/init', 'POST', {
  clientId: 'cliente_publico',
  proxyUrl: 'http://proxy-publico.example.com:8080'
})
.then(data => console.log('Instância com proxy HTTP criada:', data))
.catch(err => console.error('Erro:', err));
```
</details>

<details>
<summary><b>🔄 Alternar Proxy em Instância Existente</b></summary>

```javascript
// Alterar proxy de uma instância já criada
callHiveWPAPI('instance/config', 'POST', {
  clientId: 'cliente_existente',
  proxyUrl: 'socks5://novo-proxy.example.com:1080'
})
.then(data => console.log('Proxy atualizado:', data))
.catch(err => console.error('Erro:', err));

// Remover proxy completamente
callHiveWPAPI('instance/config', 'POST', {
  clientId: 'cliente_existente',
  proxyUrl: ''
})
.then(data => console.log('Proxy removido:', data))
.catch(err => console.error('Erro:', err));
```
</details>

### ⚙️ Considerações Importantes

| Aspecto | Descrição |
|---------|------------|
| 🔄 **Reconexão** | Mudanças de proxy requerem reinicialização da instância |
| 🔒 **Segurança** | Use proxies confiáveis - credenciais são transmitidas |
| 🚀 **Performance** | Proxies podem adicionar latência às conexões |
| 📊 **Logs** | Configurações de proxy são logadas (credenciais mascaradas) |
| 🌐 **Cobertura** | Proxy é usado tanto para WebSocket quanto para upload/download de mídia |

### 🛠️ Resolução de Problemas

**Proxy não conecta:**
- Verifique se o formato da URL está correto
- Confirme se as credenciais estão válidas
- Teste se o proxy está acessível da sua rede

**Conexão lenta:**
- Proxies podem adicionar latência
- Considere usar proxies geograficamente próximos
- Monitore logs para identificar timeouts

**Erro de autenticação:**
- Verifique usuário e senha do proxy
- Alguns proxies podem ter caracteres especiais que precisam ser codificados na URL

## 📝 Exemplos de Uso

Esta seção contém exemplos práticos de como utilizar a API com JavaScript.

<details>
<summary><b>🔗 Gerenciamento de Instâncias</b></summary>

### Inicializar instâncias para diferentes clientes

```javascript
// Função auxiliar para fazer requisições à API
async function callHiveWPAPI(endpoint, method, data) {
  const url = `http://localhost:3000/api/whatsapp/${endpoint}`;
  const apiKey = 'sua_chave_api_secreta';
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`Erro: ${response.status} - ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Falha na operação ${endpoint}:`, error);
    throw error;
  }
}

// Inicializar instância para o cliente A com configurações avançadas
callHiveWPAPI('instance/init', 'POST', {
  clientId: 'empresa_a',
  ignoreGroups: true,
  webhookUrl: "https://sua-url.com/webhook/empresa_a",
  proxyUrl: "socks5://user:pass@proxy.example.com:1080"
})
.then(data => console.log('Instância da Empresa A criada:', data))
.catch(err => console.error('Erro:', err));

// Inicializar instância para o cliente B (configuração mínima)
callHiveWPAPI('instance/init', 'POST', {
  clientId: 'empresa_b'
})
.then(data => console.log('Instância da Empresa B criada:', data))
.catch(err => console.error('Erro:', err));
```

### Listar todas as instâncias ativas

```javascript
callHiveWPAPI('instances', 'GET')
  .then(data => {
    console.log('Instâncias ativas:', data.instances.length);
    data.instances.forEach(instance => {
      console.log(`- ${instance.id}: ${instance.status}`);
    });
  })
  .catch(err => console.error('Erro ao listar instâncias:', err));
```

### Excluir uma instância

```javascript
callHiveWPAPI('instance/delete', 'POST', {
  clientId: 'empresa_b'
})
.then(result => {
  if (result.success) {
    console.log('Instância removida com sucesso!');
  } else {
    console.warn('Falha ao remover instância:', result.error);
  }
})
.catch(err => console.error('Erro:', err));
```
</details>

<details>
<summary><b>💬 Envio de Mensagens</b></summary>

### Enviar mensagem de texto com simulação de digitação

```javascript
callHiveWPAPI('send/text', 'POST', {
  clientId: 'empresa_a',
  phoneNumber: '5511999999999',
  message: 'Olá! Como posso ajudar você hoje?',
  simulateTyping: true,
  typingDurationMs: 2000
})
.then(result => {
  console.log('Mensagem enviada:', result);
})
.catch(err => console.error('Erro ao enviar mensagem:', err));
```

### Enviar imagem com legenda

```javascript
callHiveWPAPI('send/media', 'POST', {
  clientId: 'empresa_a',
  phoneNumber: '5511999999999',
  mediaUrl: 'https://exemplo.com/imagens/produto.jpg',
  caption: 'Confira nosso novo produto!'
})
.then(result => {
  console.log('Imagem enviada:', result);
})
.catch(err => console.error('Erro ao enviar imagem:', err));
```

### Enviar documento PDF

```javascript
callHiveWPAPI('send/media', 'POST', {
  clientId: 'empresa_a',
  phoneNumber: '5511999999999',
  mediaUrl: 'https://exemplo.com/documentos/contrato.pdf',
  filename: 'Contrato2025.pdf',
  mimetype: 'application/pdf'
})
.then(result => {
  console.log('Documento enviado:', result);
})
.catch(err => console.error('Erro ao enviar documento:', err));
```

### Enviar mensagem de voz

```javascript
callHiveWPAPI('send/audio', 'POST', {
  clientId: 'empresa_a',
  phoneNumber: '5511999999999',
  audioUrl: 'https://exemplo.com/audios/mensagem.mp3'
})
.then(result => {
  console.log('Áudio enviado:', result);
})
.catch(err => console.error('Erro ao enviar áudio:', err));
```
</details>

<details>
<summary><b>🔍 Verificações e Status</b></summary>

### Verificar se um número existe no WhatsApp

```javascript
callHiveWPAPI('check-number', 'POST', {
  clientId: 'empresa_a',
  phoneNumber: '5511999999999'
})
.then(result => {
  if (result.success && result.exists) {
    console.log('O número está registrado no WhatsApp!');
  } else if (result.success && !result.exists) {
    console.log('O número NÃO está registrado no WhatsApp.');
  } else {
    console.warn('Erro na verificação:', result.error);
  }
})
.catch(err => console.error('Erro:', err));
```

### Verificar status da conexão

```javascript
callHiveWPAPI(`status?clientId=empresa_a`, 'GET')
  .then(result => {
    console.log(`Status da conexão: ${result.status}`);
    console.log(`Conectado: ${result.connected ? 'Sim' : 'Não'}`);
  })
  .catch(err => console.error('Erro ao verificar status:', err));
```
</details>

<details>
<summary><b>🔄 Fluxo Completo de Inicialização</b></summary>

```javascript
// Função para obter a URL da imagem do QR Code
function getQRCodeUrl(clientId) {
  const apiKey = 'sua_chave_api_secreta';
  return `http://localhost:3000/api/whatsapp/qr-image?clientId=${clientId}&token=${apiKey}`;
}

// Inicializar nova instância
callHiveWPAPI('instance/init', 'POST', {
  clientId: 'novo_cliente',
  webhookUrl: 'https://seu-servidor.com/webhook/novo_cliente',
  proxyUrl: "socks5://user:pass@proxy.example.com:1080"
})
.then(result => {
  if (result.success) {
    console.log('Instância criada com sucesso!');
    
    // Exibir o QR Code para o usuário
    const qrCodeUrl = getQRCodeUrl('novo_cliente');
    console.log('Escaneie o QR Code:', qrCodeUrl);
    
    // Você pode exibir em uma página HTML:
    // document.getElementById('qrcode').src = qrCodeUrl;
    
    // Verificar status periodicamente
    const checkStatusInterval = setInterval(async () => {
      try {
        const status = await callHiveWPAPI(`status?clientId=novo_cliente`, 'GET');
        console.log(`Status atual: ${status.status}`);
        
        if (status.connected) {
          console.log('Conectado com sucesso! Pronto para enviar mensagens.');
          clearInterval(checkStatusInterval);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000); // Verificar a cada 5 segundos
  } else {
    console.error('Falha ao criar instância:', result.error);
  }
})
.catch(err => console.error('Erro:', err));
```
</details>

---

<div align="center">

### 💪 Integração Rápida

A HiveWP API torna a integração do WhatsApp com seus sistemas rápida e confiável!  
Visite [github.com/jpcb2020/HiveWP-API](https://github.com/jpcb2020/HiveWP-API) para contribuir ou reportar issues.

</div>

## Notas Importantes

- A pasta `sessions` contém dados de autenticação e não deve ser commitada no Git (já está no .gitignore)
- Cada instância possui seu próprio subdiretório dentro da pasta `sessions/{clientId}`
- Se você precisar desconectar uma instância do WhatsApp, use o endpoint `/api/whatsapp/logout` com o `clientId` correspondente
- Cada instância precisa escanear seu próprio QR code para autenticar

## Licença

ISC
