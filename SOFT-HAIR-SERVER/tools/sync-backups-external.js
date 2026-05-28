#!/usr/bin/env node
/**
 * sync-backups-external.js
 *
 * Mirror dos backups (.json.gz) da tabela `backups` para storage externo
 * (S3, R2, Backblaze B2, etc). Roda standalone — pode ir em cron diário.
 *
 * NÃO embute @aws-sdk/client-s3 no servidor de produção; este script só
 * carrega o módulo quando você executa.
 *
 * Pré-requisitos:
 *   npm install --no-save @aws-sdk/client-s3
 *
 * Variáveis de ambiente:
 *   DATABASE_URL              — connection string Postgres do SoftHair
 *   BACKUP_S3_ENDPOINT        — ex: https://s3.us-east-005.backblazeb2.com
 *                               (deixe vazio se for AWS clássico em us-east-1)
 *   BACKUP_S3_REGION          — ex: us-east-005 | us-east-1
 *   BACKUP_S3_BUCKET          — nome do bucket
 *   BACKUP_S3_ACCESS_KEY      — credencial
 *   BACKUP_S3_SECRET_KEY      — credencial
 *   BACKUP_S3_PREFIX          — opcional, ex: 'softhair/backups/'
 *   BACKUP_S3_KEEP_DAYS       — opcional, retention no bucket (default 90)
 *
 * Uso:
 *   node tools/sync-backups-external.js
 *   node tools/sync-backups-external.js --salao=1
 *   node tools/sync-backups-external.js --dry-run
 */

require('dotenv').config();

function arg(name, fallback = null) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (a) return a.split('=').slice(1).join('=');
  if (process.argv.includes(`--${name}`)) return true;
  return fallback;
}

const DRY = !!arg('dry-run', false);
const SALAO = arg('salao', null);

const REQUIRED = ['DATABASE_URL', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY', 'BACKUP_S3_SECRET_KEY'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`[sync-backups] env ${k} obrigatória`);
    process.exit(1);
  }
}

const BUCKET = process.env.BACKUP_S3_BUCKET;
const PREFIX = (process.env.BACKUP_S3_PREFIX || 'softhair/backups/').replace(/^\/+/, '');
const REGION = process.env.BACKUP_S3_REGION || 'us-east-1';
const ENDPOINT = process.env.BACKUP_S3_ENDPOINT || undefined;
const KEEP_DAYS = Math.max(1, parseInt(process.env.BACKUP_S3_KEEP_DAYS || '90', 10));

(async function main() {
  let S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command;
  try {
    ({ S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } =
      require('@aws-sdk/client-s3'));
  } catch (_) {
    console.error('[sync-backups] precisa de @aws-sdk/client-s3.');
    console.error('  npm install --no-save @aws-sdk/client-s3');
    process.exit(1);
  }

  const { pool } = require('../src/config/database');
  const s3 = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: !!ENDPOINT,
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY,
      secretAccessKey: process.env.BACKUP_S3_SECRET_KEY,
    },
  });

  console.log('SoftHair · sync-backups-external');
  console.log('  bucket:', BUCKET, '· prefix:', PREFIX);
  if (DRY) console.log('  MODO DRY-RUN');
  console.log('');

  // 1) Lista backups ok no DB que ainda não têm arquivo_externo_url.
  const filtro = SALAO
    ? `AND salao_id = ${Number(SALAO)}`
    : '';
  const { rows } = await pool.query(`
    SELECT id, salao_id, tamanho_bytes, checksum, dump_data, created_at, arquivo_externo_url
      FROM backups
     WHERE status = 'ok'
       AND dump_data IS NOT NULL
       AND COALESCE(arquivo_externo_url, '') = ''
       ${filtro}
     ORDER BY created_at ASC
  `);
  console.log(`Backups pendentes de upload: ${rows.length}`);

  let ok = 0, fail = 0;
  for (const b of rows) {
    const dataStr = new Date(b.created_at).toISOString().slice(0, 10);
    const key = `${PREFIX}salao-${b.salao_id}/${dataStr}/backup-${b.id}.json.gz`;
    if (DRY) { console.log(`  [dry] PUT ${key} (${b.tamanho_bytes} bytes)`); ok++; continue; }
    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: b.dump_data,
        ContentType: 'application/gzip',
        Metadata: {
          'salao-id': String(b.salao_id),
          'backup-id': String(b.id),
          'checksum-sha256': b.checksum || '',
        },
      }));
      const url = ENDPOINT
        ? `${ENDPOINT.replace(/\/$/, '')}/${BUCKET}/${key}`
        : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
      await pool.query('UPDATE backups SET arquivo_externo_url = $1 WHERE id = $2', [url, b.id]);
      console.log(`  ✓ #${b.id} → ${key}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ #${b.id} → ${e.message}`);
      fail++;
    }
  }

  // 2) Retention no bucket — apaga objetos > KEEP_DAYS dias.
  console.log('');
  console.log(`Aplicando retention (${KEEP_DAYS} dias)...`);
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX }));
    const cutoff = Date.now() - KEEP_DAYS * 86400_000;
    let apagados = 0;
    for (const obj of (list.Contents || [])) {
      if (obj.LastModified && obj.LastModified.getTime() < cutoff) {
        if (!DRY) await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
        console.log(`  ${DRY ? '[dry] ' : ''}× ${obj.Key}`);
        apagados++;
      }
    }
    console.log(`Retention: ${apagados} objetos removidos.`);
  } catch (e) {
    console.warn(`Retention falhou: ${e.message}`);
  }

  console.log('');
  console.log(`Resultado: ${ok} ok · ${fail} falha`);
  await pool.end();
  process.exit(fail > 0 ? 2 : 0);
})().catch((err) => {
  console.error('Falha geral:', err);
  process.exit(1);
});
