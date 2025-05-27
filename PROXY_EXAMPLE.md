# 🌐 Proxy Configuration Examples

## Frontend Interface

### Creating Instance with Proxy

1. Open the HiveWP frontend
2. Navigate to "WhatsApp Instances"
3. Click "Add New Instance"
4. Fill in the form:
   - **Instance ID**: `my-proxy-instance`
   - **Proxy URL**: `socks5://user:pass@proxy.example.com:1080`
   - ✓ **Ignore Group Messages** (optional)
   - **Webhook URL**: `https://your-webhook.com/endpoint` (optional)
5. Click "Create Instance"

### Updating Proxy on Existing Instance

1. Click on any instance card to view details
2. Go to "Settings" tab
3. Update **Proxy URL** field with new proxy
4. Click "Save Settings"

## API Examples

### Create Instance with Proxy

```bash
curl -X POST http://localhost:3000/api/whatsapp/instance/init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "clientId": "my-proxy-instance",
    "proxyUrl": "socks5://user:pass@proxy.example.com:1080",
    "ignoreGroups": true,
    "webhookUrl": "https://your-webhook.com/endpoint"
  }'
```

### Update Proxy for Existing Instance

```bash
curl -X POST http://localhost:3000/api/whatsapp/instance/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "clientId": "existing-instance",
    "proxyUrl": "http://new-proxy.example.com:8080"
  }'
```

## Supported Proxy Types

| Type | URL Format | Example |
|------|------------|---------|
| SOCKS4 | `socks4://host:port` | `socks4://proxy.example.com:1080` |
| SOCKS5 | `socks5://user:pass@host:port` | `socks5://user:pass@proxy.example.com:1080` |
| HTTP | `http://host:port` | `http://proxy.example.com:8080` |
| HTTPS | `https://user:pass@host:port` | `https://user:pass@proxy.example.com:8080` |

## Testing

1. Configure proxy in frontend or via API
2. Check server logs for proxy configuration messages
3. Scan QR code to test connection through proxy
4. Send test messages to verify functionality 