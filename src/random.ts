/**
 * Aleatoriedade criptográfica e imparcial.
 * Usa crypto.getRandomValues (o mesmo gerador usado em criptografia),
 * nunca Math.random, para que nenhum resultado seja previsível.
 */

const UINT32_RANGE = 0x1_0000_0000; // 2^32

/** Inteiro uniforme em [0, n). Usa amostragem por rejeição para não favorecer nenhum valor. */
export function secureInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > UINT32_RANGE) {
    throw new RangeError(`secureInt: n inválido (${n})`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % n;
}

/** Número uniforme em [0, 1). */
export function secureFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / UINT32_RANGE;
}

/** Embaralhamento Fisher–Yates com gerador criptográfico (altera o array). */
export function secureShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
