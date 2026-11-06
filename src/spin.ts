/**
 * Matemática do giro. Funções puras, testadas em spin.test.ts.
 *
 * Convenção: o ponteiro fica no topo. A fatia i ocupa, no referencial da roleta,
 * o ângulo [i * seg, (i + 1) * seg), desenhado a partir do topo no sentido horário.
 */
import { secureFloat, secureInt } from './random';

export const TAU = Math.PI * 2;

const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Índice da fatia que está sob o ponteiro para uma dada rotação. */
export function indexAtPointer(rotation: number, n: number): number {
  const seg = TAU / n;
  return Math.floor(mod(-rotation, TAU) / seg) % n;
}

export interface SpinPlan {
  /** Índice do vencedor, sorteado antes de qualquer animação. */
  winner: number;
  /** Rotação inicial. */
  from: number;
  /** Rotação final (sempre maior que from). */
  to: number;
  /** Duração da animação em ms. */
  duration: number;
}

export interface RandomSource {
  int(n: number): number;
  float(): number;
}

const cryptoSource: RandomSource = { int: secureInt, float: secureFloat };

/**
 * Planeja um giro honesto:
 * 1) sorteia o vencedor com chance exatamente igual para todos (1/n);
 * 2) escolhe um ponto aleatório dentro da fatia, longe das bordas;
 * 3) calcula quanto girar (algumas voltas completas + o necessário para parar nesse ponto).
 */
export function planSpin(rotation: number, n: number, rnd: RandomSource = cryptoSource): SpinPlan {
  if (n < 2) throw new RangeError('São necessários pelo menos 2 nomes para girar.');
  const seg = TAU / n;
  const winner = rnd.int(n);
  const inside = 0.12 + rnd.float() * 0.76;
  const target = mod(-(winner + inside) * seg, TAU);
  const delta = mod(target - mod(rotation, TAU), TAU);
  const turns = 6 + rnd.int(4);
  return {
    winner,
    from: rotation,
    to: rotation + turns * TAU + delta,
    duration: 5600 + rnd.int(1600),
  };
}

/** Desaceleração suave (ease-out quártico). */
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 4);
