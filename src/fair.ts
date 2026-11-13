/**
 * Sorteio verificável (commit-reveal).
 *
 * 1) Antes do giro: gera uma semente secreta e mostra só o COMPROMISSO,
 *    SHA-256("lusm-v1|commit" + semente + nomes). O compromisso amarra a semente
 *    e a lista de nomes (na ordem das fatias), então nenhum dos dois pode mudar depois.
 * 2) Opcional: o público informa uma "palavra do público" DEPOIS de ver o compromisso.
 *    Como quem gira já fixou a semente, não consegue escolher o resultado.
 * 3) O vencedor sai de SHA-256(semente + nomes + palavra), com amostragem por rejeição
 *    (mesmo princípio de secureInt: todos com chance exatamente 1/n).
 * 4) Depois do giro, a semente é revelada e qualquer pessoa confere
 *    (no próprio site ou com scripts/verificar.mjs, que não usa este código).
 *
 * Usa Web Crypto (crypto.subtle), que exige HTTPS ou localhost.
 */

export const PROOF_VERSION = 1;
const UINT32_RANGE = 0x1_0000_0000;

export interface Proof {
  v: number;
  /** Nomes na ordem das fatias no momento do giro. */
  names: string[];
  /** Semente secreta (64 caracteres hex), revelada só depois do giro. */
  seed: string;
  /** Hash publicado antes do giro. */
  commit: string;
  /** Palavra do público ('' se não houve). */
  word: string;
  /** Índice e nome do vencedor. */
  index: number;
  winner: string;
}

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', enc.encode(text));
}

/** Semente nova: 32 bytes do gerador criptográfico, em hex. */
export function newSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compromisso publicado antes do giro. */
export async function commitFor(seed: string, names: readonly string[]): Promise<string> {
  return toHex(await sha256(`lusm-v1|commit|${seed}|${JSON.stringify(names)}`));
}

/** Índice vencedor, determinístico a partir de semente + nomes + palavra. */
export async function drawIndex(seed: string, names: readonly string[], word: string): Promise<number> {
  const n = names.length;
  if (n < 2) throw new RangeError('São necessários pelo menos 2 nomes.');
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  for (let counter = 0; ; counter++) {
    const h = await sha256(`lusm-v1|draw|${seed}|${JSON.stringify(names)}|${word}|${counter}`);
    const x = new DataView(h).getUint32(0); // primeiros 4 bytes, big-endian
    if (x < limit) return x % n;
  }
}

/** Monta a prova completa de um giro. */
export async function makeProof(seed: string, names: readonly string[], word: string): Promise<Proof> {
  const index = await drawIndex(seed, names, word);
  return {
    v: PROOF_VERSION,
    names: [...names],
    seed,
    commit: await commitFor(seed, names),
    word,
    index,
    winner: names[index],
  };
}

export interface VerifyResult {
  ok: boolean;
  /** Explicação de cada checagem, para mostrar na tela. */
  checks: { label: string; ok: boolean }[];
  /** Vencedor recalculado (quando foi possível calcular). */
  winner?: string;
}

/** Recalcula tudo a partir da prova e diz se bate. */
export async function verifyProof(p: Partial<Proof>): Promise<VerifyResult> {
  const checks: VerifyResult['checks'] = [];
  const wellFormed =
    p.v === PROOF_VERSION &&
    Array.isArray(p.names) && p.names.length >= 2 && p.names.every(x => typeof x === 'string') &&
    typeof p.seed === 'string' && /^[0-9a-f]{64}$/.test(p.seed) &&
    typeof p.commit === 'string' && typeof p.word === 'string';
  checks.push({ label: 'Prova completa e no formato certo', ok: wellFormed });
  if (!wellFormed) return { ok: false, checks };

  const commit = await commitFor(p.seed!, p.names!);
  checks.push({ label: 'Semente e nomes batem com o compromisso publicado antes do giro', ok: commit === p.commit });

  const index = await drawIndex(p.seed!, p.names!, p.word!);
  const winner = p.names![index];
  checks.push({ label: `Vencedor recalculado: ${winner}`, ok: index === p.index && winner === p.winner });

  return { ok: checks.every(c => c.ok), checks, winner };
}
