# 🔧 Proxy URL Troubleshooting Guide

## 🔍 Diagnosing Proxy Save Issues

### Quick Checks

1. **Check if proxy is in metadata file:**
   ```bash
   # Navigate to session folder
   cd sessions/your-instance-id/
   
   # Check metadata content
   cat instance_metadata.json | grep proxyUrl
   ```

2. **Run the test script:**
   ```bash
   node test-proxy-metadata.js
   ```

### Common Issues & Solutions

#### ❌ **Issue 1: Proxy URL not saving in frontend**
**Symptoms:** Frontend shows proxy field, but value doesn't persist after save

**Solution:**
```javascript
// Check browser console for errors
// Verify the proxyUrl element is properly connected
console.log(elements.proxyUrl.value); // Should show the input value
```

#### ❌ **Issue 2: Proxy URL not returned by API**
**Symptoms:** `/api/whatsapp/instances` doesn't include proxy in config

**Diagnosis:**
```bash
curl -H "Authorization: Bearer your_api_key" \
  http://localhost:3000/api/whatsapp/instances | jq
```

**Expected output should include:**
```json
{
  "success": true,
  "instances": [
    {
      "id": "your-instance",
      "config": {
        "ignoreGroups": false,
        "webhookUrl": "",
        "proxyUrl": "socks5://user:pass@proxy.example.com:1080"
      }
    }
  ]
}
```

#### ❌ **Issue 3: Proxy not loading from metadata on restart**
**Symptoms:** Proxy works but is lost after server restart

**Check metadata loading:**
```javascript
// In initializeWhatsApp function, add debug:
console.log('Metadata loaded:', metadata);
console.log('Proxy from metadata:', metadata.proxyUrl);
```

### 🧪 Testing Steps

#### 1. **Test Metadata Persistence**
```bash
# Run the test script
node test-proxy-metadata.js

# Should show:
# ✅ Metadados salvos com sucesso
# ✅ Proxy URL lido corretamente dos metadados
```

#### 2. **Test API Endpoints**
```bash
# Create instance with proxy
curl -X POST http://localhost:3000/api/whatsapp/instance/init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "clientId": "test-proxy",
    "proxyUrl": "socks5://user:pass@proxy.example.com:1080"
  }'

# Verify in instances list
curl -H "Authorization: Bearer your_api_key" \
  http://localhost:3000/api/whatsapp/instances

# Update proxy
curl -X POST http://localhost:3000/api/whatsapp/instance/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "clientId": "test-proxy",
    "proxyUrl": "http://newproxy.example.com:8080"
  }'
```

#### 3. **Test Frontend**
1. Open browser developer tools
2. Navigate to instance settings
3. Enter proxy URL
4. Save settings
5. Check network tab for API call
6. Refresh page and verify proxy field is populated

### 🔧 Manual Fixes

#### Fix 1: Force Metadata Save
```javascript
// Add to your instance update:
const { saveInstanceMetadata } = require('./src/services/whatsappService');

// Force save metadata
saveInstanceMetadata('your-instance-id', {
  proxyUrl: 'socks5://user:pass@proxy.example.com:1080',
  ignoreGroups: true,
  webhookUrl: 'your-webhook-url'
}, true); // force = true
```

#### Fix 2: Verify File Permissions
```bash
# Check if sessions directory is writable
ls -la sessions/
chmod 755 sessions/
chmod 644 sessions/*/instance_metadata.json
```

#### Fix 3: Clean and Recreate
```bash
# Backup existing data
cp -r sessions/ sessions-backup/

# Remove problematic instance
rm -rf sessions/your-instance-id/

# Recreate through API or frontend
```

### 📋 Verification Checklist

- [ ] **Backend:** `getActiveInstances()` includes `proxyUrl` in config
- [ ] **Backend:** `updateInstanceConfig()` saves proxy to metadata
- [ ] **Backend:** `initializeWhatsApp()` loads proxy from metadata
- [ ] **Frontend:** Proxy field is connected to DOM (`elements.proxyUrl`)
- [ ] **Frontend:** `saveInstanceSettings()` includes proxy in payload
- [ ] **Frontend:** `updateInstanceData()` loads proxy into form field
- [ ] **API:** `/instances` endpoint returns proxy in config
- [ ] **API:** `/instance/config` endpoint accepts and saves proxy
- [ ] **Files:** `instance_metadata.json` contains proxy URL
- [ ] **Logs:** Server shows "Proxy configurado com sucesso"

### 📊 Debug Information

#### Enable Debug Mode
```bash
# Set environment variable for more verbose logging
export BAILEYS_LOG_LEVEL=debug
export NODE_ENV=development

# Restart server
npm run dev
```

#### Check Instance State
```javascript
// Add to your code for debugging
console.log('Current instance state:', instances[clientId]);
console.log('Proxy URL:', instances[clientId]?.proxyUrl);
```

#### Monitor File Changes
```bash
# Watch metadata file changes
watch -n 1 'cat sessions/your-instance/instance_metadata.json | jq'
```

### 🚀 Success Indicators

When everything works correctly, you should see:
1. **Console logs:** "Proxy configurado com sucesso"
2. **Metadata file:** Contains correct proxy URL
3. **API response:** Includes proxy in config object
4. **Frontend:** Proxy field pre-populated when viewing settings
5. **Connection:** QR code generates through proxy (different IP)

### 📞 Need Help?

If issues persist:
1. Run `node test-proxy-metadata.js` and share output
2. Check `sessions/your-instance/instance_metadata.json` content
3. Share server logs during proxy configuration
4. Test with a simple HTTP proxy first before SOCKS 