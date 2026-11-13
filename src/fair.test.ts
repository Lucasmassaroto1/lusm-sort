import { describe, expect, it } from 'vitest';
import { commitFor, drawIndex, makeProof, newSeed, verifyProof } from './fair';

const names = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu'];

describe('sorteio verificável', () => {
  it('semente tem 64 caracteres hex e muda a cada chamada', () => {
    const a = newSeed();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(newSeed()).not.toBe(a);
  });

  it('é determinístico: mesma semente, nomes e palavra dão o mesmo vencedor', async () => {
    const seed = newSeed();
    expect(await drawIndex(seed, names, 'oi')).toBe(await drawIndex(seed, names, 'oi'));
  });

  it('o compromisso muda se a ordem dos nomes mudar', async () => {
    const seed = newSeed();
    expect(await commitFor(seed, names)).not.toBe(await commitFor(seed, [...names].reverse()));
  });

  it('uma prova verdadeira é aceita', async () => {
    const proof = await makeProof(newSeed(), names, 'palavra');
    const r = await verifyProof(proof);
    expect(r.ok).toBe(true);
    expect(r.winner).toBe(proof.winner);
  });

  it('recusa prova adulterada (vencedor, nomes, palavra ou semente)', async () => {
    const proof = await makeProof(newSeed(), names, '');
    const other = names.find(x => x !== proof.winner)!;
    expect((await verifyProof({ ...proof, winner: other })).ok).toBe(false);
    expect((await verifyProof({ ...proof, names: [...names, 'Fabi'] })).ok).toBe(false);
    expect((await verifyProof({ ...proof, seed: newSeed() })).ok).toBe(false);
    // Trocar a palavra pode até dar o mesmo vencedor por acaso; testamos várias.
    let rejected = 0;
    for (let i = 0; i < 20; i++) if (!(await verifyProof({ ...proof, word: `x${i}` })).ok) rejected++;
    expect(rejected).toBeGreaterThan(0);
  });

  it('distribui de forma uniforme (qui-quadrado)', async () => {
    const n = 5;
    const runs = 20000;
    const counts = new Array(n).fill(0);
    for (let i = 0; i < runs; i++) counts[await drawIndex(newSeed(), names, '')]++;
    const expected = runs / n;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(23.51); // p = 0,0001 com 4 graus de liberdade
  });
});
