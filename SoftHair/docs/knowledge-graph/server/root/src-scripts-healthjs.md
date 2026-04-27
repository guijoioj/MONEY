# src/scripts/health.js

**Repository:** Server
**File:** `src/scripts/health.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/scripts/health.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

console.log('📍 Checador de saúde do sistema...');

async function healthCheck() {
  const health = {
    server: 'OK',
    database: 'UNKNOWN',
    diskSpace: 'UNKNOWN',
    memoryUsage: 'UNKNOWN',
    api/ping: 'UNKNOWN'
  };

  // Check database connection
  try {
    const { pool } = require('../config/database');
    await pool.query('SELECT 1');
    health.database = 'OK';
  } catch (error) {
    health.database = `ERROR: ${error.message}`;
  }

  // Check disk usage (Linux/macOS)
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync("df -h | grep -E '^\\/' | awk '{print $5}' | head -1");
    health.diskSpace = stdout.trim();
  } catch (error) {
    health.diskSpace = 'N/A';
  }

  // Check memory
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    if (process.platform === 'linux') {
      const { stdout } = await execAsync("free -h | grep '^Mem:' | awk '{print $3 \"/\" $2}'");
      health.memoryUsage = stdout.trim();
    } else {
      health.memoryUsage = 'N/A';
    }
  } catch (error) {
    health.memoryUsage = 'N/A';
  }

  // Check main API endpoint  
  try {
    const http = require('https');
    const https = require('https');
    const url = `${process.env.FORCE_HTTPS === 'true' ? 'https' : 'http'}://localhost:${process.env.PORT || 3000}/api/health`;
    
    const protocol = process.env.FORCE_HTTPS === 'true' ? https : http;
    const promise = new Promise((resolve) => {
      const req = protocol.get(url, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', () => resolve('ERROR'));
      req.setTimeout(3000, () => resolve('TIMEOUT'));
    });
    
    const result = await promise;
    health.api/ping = result === 200 ? 'OK' : `Response: ${result}`;
  } catch (error) {
    health.api/ping = `ERROR: ${error.message}`;
  }

  console.log('📊 Estado do sistema:');
  console.log('==========================');
  Object.entries(health).forEach(([key, value]) => {
    console.log(`${key.padEnd(20)}: ${value}`);
  });
  
  return health;
}

if (require.main === module) {
  healthCheck().then(health => {
    const hasErrors = Object.values(health).some(v => typeof v === 'string' && v.startsWith('ERROR'));
    const allOK = Object.values(health).every(v => v === 'OK');
    
    if (allOK) {
      console.log('✅ Todos os componentes OK');
      process.exit(0);
    } else {
      console.log('❌ Problemas detectados');
      process.exit(hasErrors ? 1 : 0);
    }
  });
}

module.exports = healthCheck;
```
