# 🚀 Guia de Teste Rápido - Sistema Otimizado

## 📋 Pré-requisitos

- **Node.js 16+** instalado
- **Git** para clonar o repositório
- **WhatsApp no celular** para escanear QR codes

---

## ⚡ **Passo 1: Configuração Inicial**

### 1.1 Configurar Ambiente
```bash
# Copiar configuração de exemplo
cp env.example .env

# Editar configurações básicas
nano .env
```

### 1.2 Configuração Mínima no `.env`:
```bash
# Configuração básica para teste
PORT=3000
API_KEY=teste123_substitua_por_chave_forte
SESSION_DIR=./sessions
IGNORE_GROUPS=true

# Configurações de performance para teste
NODE_ENV=development
LOG_LEVEL=info
BAILEYS_LOG_LEVEL=warn
```

### 1.3 Instalar Dependências
```bash
npm install
```

---

## 🚦 **Passo 2: Primeira Execução**

### 2.1 Iniciar o Servidor (Modo Teste)
```bash
# Desenvolvimento com logs detalhados
npm run dev

# OU produção otimizada
NODE_ENV=production npm start

# OU com garbage collection habilitado (recomendado para teste)
node --expose-gc src/index.js
```

### 2.2 Verificar se Iniciou Corretamente
Acesse no navegador: **http://localhost:3000**

Você deve ver:
- ✅ Interface web do HiveWP
- ✅ Dashboard vazio (0 instâncias)

---

## 📱 **Passo 3: Testar com 1 Instância**

### 3.1 Via Interface Web (Mais Fácil)
1. **Abrir:** http://localhost:3000
2. **Login:** Use sua API Key (`teste123_substitua_por_chave_forte`)
3. **Adicionar Instância:**
   - Clique em "WhatsApp Instances"
   - "Add New Instance"
   - Instance ID: `teste1`
   - ✓ Ignore Group Messages
   - Webhook URL: (deixe vazio por enquanto)
   - "Create Instance"

### 3.2 Via API (Para Desenvolvedores)
```bash
# Criar primeira instância
curl -X POST http://localhost:3000/api/whatsapp/instance/init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  -d '{
    "clientId": "teste1",
    "ignoreGroups": true
  }'
```

### 3.3 Conectar WhatsApp
```bash
# Obter QR Code como imagem
curl -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  "http://localhost:3000/api/whatsapp/qr-image?clientId=teste1" \
  -o qr_teste1.png

# Abrir a imagem e escanear com WhatsApp
```

**OU** via interface web: clique em "View QR" na instância criada.

---

## 🧪 **Passo 4: Testar Funcionalidades**

### 4.1 Verificar Status
```bash
# Via API
curl -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  "http://localhost:3000/api/whatsapp/status?clientId=teste1"

# Resposta esperada quando conectado:
{
  "success": true,
  "isConnected": true,
  "connectionStatus": "open",
  "clientId": "teste1"
}
```

### 4.2 Testar Envio de Mensagem
```bash
# Enviar mensagem de teste
curl -X POST http://localhost:3000/api/whatsapp/send/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  -d '{
    "clientId": "teste1",
    "phoneNumber": "5511999999999",
    "message": "🚀 Teste do HiveWP API otimizado!"
  }'
```

### 4.3 Verificar Métricas
```bash
# Métricas do sistema
curl -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  "http://localhost:3000/monitoring/metrics"

# Métricas das instâncias
curl -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  "http://localhost:3000/monitoring/instances/metrics"
```

---

## 📊 **Passo 5: Teste de Escalabilidade**

### 5.1 Criar Múltiplas Instâncias (Teste com 5-10)
```bash
# Script para criar 10 instâncias de teste
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/whatsapp/instance/init \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
    -d "{
      \"clientId\": \"teste$i\",
      \"ignoreGroups\": true
    }"
  echo "Instância teste$i criada"
  sleep 2
done
```

### 5.2 Monitorar Performance
```bash
# Verificar métricas em tempo real
watch -n 5 'curl -s -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  "http://localhost:3000/monitoring/metrics" | jq ".performance.memory"'
```

### 5.3 Testar Cache
```bash
# Verificar cache de números (deve melhorar com repetições)
time curl -X POST http://localhost:3000/api/whatsapp/check-number \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  -d '{
    "clientId": "teste1",
    "phoneNumber": "5511999999999"
  }'

# Executar novamente - deve ser mais rápido
time curl -X POST http://localhost:3000/api/whatsapp/check-number \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
  -d '{
    "clientId": "teste1",
    "phoneNumber": "5511999999999"
  }'
```

---

## 🔍 **Passo 6: Monitoramento Durante Teste**

### 6.1 Logs do Sistema
```bash
# Em outro terminal, acompanhar logs
tail -f logs/app.log

# OU se usando PM2
pm2 logs
```

### 6.2 Recursos do Sistema
```bash
# Monitorar uso de CPU/Memória
htop

# OU no macOS
top -pid $(pgrep -f "node.*src/index.js")

# Verificar conexões de rede
netstat -an | grep :3000
```

### 6.3 Health Check
```bash
# Health check básico (sem autenticação)
curl http://localhost:3000/monitoring/health

# Resposta esperada:
{
  "status": "healthy",
  "uptime": 120,
  "memory": {
    "used": 45,
    "total": 67,
    "percentage": 67
  }
}
```

---

## 🧪 **Passo 7: Teste de Stress (Opcional)**

### 7.1 Teste de Rate Limiting
```bash
# Testar limite de mensagens
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/whatsapp/send/text \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer teste123_substitua_por_chave_forte" \
    -d '{
      "clientId": "teste1",
      "phoneNumber": "5511999999999",
      "message": "Teste de rate limiting #'$i'"
    }' &
done
wait
```

### 7.2 Teste de Webhook Queue
```bash
# Se tiver webhook configurado, enviar várias mensagens
# para testar se a queue está funcionando sem bloquear
for i in {1..20}; do
  # Envie mensagens para o WhatsApp conectado
  # As mensagens recebidas devem ir para a queue
  echo "Enviando mensagem teste $i"
done
```

---

## 📈 **Resultados Esperados**

### ✅ **Sucesso se você vir:**
- **Conexão rápida** das instâncias (< 30 segundos)
- **Response time < 500ms** para APIs
- **Cache hit rate > 50%** após alguns testes
- **Memória estável** sem vazamentos
- **Logs organizados** e informativos
- **Métricas precisas** nos endpoints de monitoramento

### ⚠️ **Verificar se houver:**
- Demora excessiva para conectar (> 2 minutos)
- Erros frequentes de timeout
- Uso de memória sempre crescente
- Response time > 2 segundos consistentemente

---

## 🚀 **Próximos Passos**

### Para Escalar para 100 Instâncias:
1. **Testar com 20-30 instâncias** primeiro
2. **Monitorar recursos** de hardware
3. **Ajustar configurações** conforme necessário
4. **Implementar webhooks** para teste completo
5. **Configurar alertas** de monitoramento
6. **Backup de sessões** importantes

### Configurações Avançadas:
```bash
# Para teste de alta carga
NODE_ENV=production \
MAX_OLD_SPACE_SIZE=8192 \
UV_THREADPOOL_SIZE=128 \
node --expose-gc \
     --max-old-space-size=8192 \
     src/index.js
```

---

## 🆘 **Resolução de Problemas**

### Erro: "API_KEY não encontrada"
```bash
# Verificar se o .env está correto
cat .env | grep API_KEY
```

### Erro: "Port 3000 already in use"
```bash
# Matar processo na porta 3000
lsof -ti:3000 | xargs kill -9

# OU usar porta diferente
PORT=3001 npm start
```

### QR Code não aparece
```bash
# Verificar se a instância foi criada
curl -H "Authorization: Bearer sua_api_key" \
  "http://localhost:3000/api/whatsapp/instances"
```

### Alta latência
```bash
# Verificar cache
curl -H "Authorization: Bearer sua_api_key" \
  "http://localhost:3000/monitoring/metrics" | jq ".cache"
```

---

**🎯 Agora você está pronto para testar o sistema otimizado! Comece com 1-5 instâncias e vá escalando conforme a performance.** 