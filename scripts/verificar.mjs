#!/usr/bin/env node
/**
 * Verificador independente do sorteio da LUSM - Sorte.
 * Não importa nada do site: refaz as contas só com o crypto do Node.
 *
 * Uso:
 *   node scripts/verificar.mjs prova.json
 *   node scripts/verificar.mjs '{"v":1,"names":[...],...}'
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: node scripts/verificar.mjs prova.json  (ou o JSON entre aspas)');
  process.exit(2);
}
const p = JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg);

const sha256 = text => createHash('sha256').update(text, 'utf8').digest();

const commit = sha256(`lusm-v1|commit|${p.seed}|${JSON.stringify(p.names)}`).toString('hex');

const n = p.names.length;
const RANGE = 2 ** 32;
const limit = RANGE - (RANGE % n);
let index;
for (let counter = 0; index === undefined; counter++) {
  const x = sha256(`lusm-v1|draw|${p.seed}|${JSON.stringify(p.names)}|${p.word}|${counter}`).readUInt32BE(0);
  if (x < limit) index = x % n;
}

const okCommit = commit === p.commit;
const okWinner = index === p.index && p.names[index] === p.winner;

console.log(`Compromisso publicado: ${p.commit}`);
console.log(`Compromisso recalculado: ${commit}  ${okCommit ? 'OK' : 'NÃO BATE'}`);
console.log(`Vencedor na prova: ${p.winner} | recalculado: ${p.names[index]}  ${okWinner ? 'OK' : 'NÃO BATE'}`);
console.log(okCommit && okWinner ? '\nSorteio VÁLIDO.' : '\nSorteio INVÁLIDO.');
process.exit(okCommit && okWinner ? 0 : 1);
