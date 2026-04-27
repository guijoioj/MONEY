# src/scripts/health-check.js

**Repository:** Server
**File:** `src/scripts/health-check.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/scripts/health-check.js` do repositório Server.

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

/**
 * Health Check Script — Verifica a saúde do sistema SOFT-HAIR-SERVER
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

console.log('📍 Verificação de saúde do sistema...');

async function healthCheck() {
  const health = {
    server: 'OK',
    database: 'UNKNOWN',
    diskSpace: 'UNKNOWN',
    memoryUsage: 'UNKNOWN',
    apiPing: 'UNKNOWN'
  };

  // Check database connection
  try {
    const { pool } = require('../config/database');
    await pool.query('SELECT 1');
    health.database = 'OK';
    await pool.end();
  } catch (error) {
    health.database = `ERROR: ${error.message}`;
  }

  // Check disk usage (Linux/macOS)
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync("df -h . | tail -1 | awk '{print $5}'");
    health.diskSpace = stdout.trim();
  } catch (error) {
    health.diskSpace = 'N/A';
  }

  // Check memory
  try {
    const used = process.memoryUsage();
    health.memoryUsage = `${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB`;
  } catch (error) {
    health.memoryUsage = 'N/A';
  }

  // Check main API endpoint
  try {
    const protocol = process.env.FORCE_HTTPS === 'true' ? require('https') : require('http');
    const url = `${process.env.FORCE_HTTPS === 'true' ? 'https' : 'http'}://localhost:${process.env.PORT || 3000}/api/health`;

    const result = await new Promise((resolve) => {
      const req = protocol.get(url, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', () => resolve('NOT_RUNNING'));
      req.setTimeout(3000, () => resolve('TIMEOUT'));
    });

    health.apiPing = result === 200 ? 'OK' : `Response: ${result}`;
  } catch (error) {
    health.apiPing = `ERROR: ${error.message}`;
  }

  console.log('\n📊 Estado do sistema:');
  console.log('==========================');
  Object.entries(health).forEach(([key, value]) => {
    const icon = value === 'OK' ? '✅' : (typeof value === 'string' && value.startsWith('ERROR') ? '❌' : '⚠️');
    console.log(`  ${icon} ${key.padEnd(15)}: ${value}`);
  });

  return health;
}

if (require.main === module) {
  healthCheck().then(health => {
    const hasErrors = Object.values(health).some(v => typeof v === 'string' && v.startsWith('ERROR'));
    console.log(hasErrors ? '\n❌ Problemas detectados' : '\n✅ Sistema saudável');
    process.exit(hasErrors ? 1 : 0);
  });
}

module.exports = healthCheck;
```
