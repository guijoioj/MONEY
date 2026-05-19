#!/usr/bin/env node
/**
 * generate-password-hash.js — gera hash bcrypt local SEM salvar a senha.
 *
 * - Lê senha do stdin em modo "hidden" (caracteres não aparecem)
 * - Pede confirmação (digita 2 vezes)
 * - Gera hash bcrypt cost 12
 * - Imprime APENAS o hash no stdout
 * - Não escreve em arquivo
 * - Não envia pra rede
 * - Não loga a senha em lugar nenhum
 *
 * Uso:
 *   node scripts/generate-password-hash.js
 *   (digita senha → confirma → recebe hash bcrypt)
 *
 * Copia o hash e usa no template rotate-admin-password.sql.
 */

const bcrypt = require('bcryptjs');

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error('Este script exige terminal interativo (TTY).'));
    }
    process.stdout.write(prompt);

    const stdin = process.stdin;
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();

    let buffer = '';
    const onData = (key) => {
      // Ctrl+C
      if (key === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(130);
      }
      // Enter
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        return resolve(buffer);
      }
      // Backspace
      if (key === '' || key === '\b') {
        if (buffer.length > 0) buffer = buffer.slice(0, -1);
        return;
      }
      buffer += key;
    };
    stdin.on('data', onData);
  });
}

function validate(senha) {
  if (!senha || senha.length < 12) return 'Senha deve ter no mínimo 12 caracteres';
  if (!/[A-Za-z]/.test(senha)) return 'Senha deve conter letra';
  if (!/\d/.test(senha)) return 'Senha deve conter número';
  if (!/[^A-Za-z0-9]/.test(senha)) return 'Senha deve conter símbolo (!@#$%...)';
  return null;
}

(async () => {
  console.log('🔐 Gerador de hash bcrypt — SoftHair');
  console.log('   Senha NÃO será exibida nem salva.');
  console.log('');

  const senha = await askHidden('Digite a senha nova: ');
  const err = validate(senha);
  if (err) {
    console.error('❌', err);
    process.exit(1);
  }

  const confirma = await askHidden('Confirme a senha:   ');
  if (senha !== confirma) {
    console.error('❌ Senhas não conferem');
    process.exit(1);
  }

  const hash = await bcrypt.hash(senha, 12);

  console.log('');
  console.log('✅ Hash gerado (copie a linha abaixo):');
  console.log('');
  console.log(hash);
  console.log('');
  console.log('Próximo passo: ver SOFT-HAIR-SERVER/docs/ROTACIONAR-SENHA-ADMIN.md');
})().catch((e) => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
