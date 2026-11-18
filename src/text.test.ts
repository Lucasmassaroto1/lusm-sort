import { describe, expect, it } from 'vitest';
import { cleanName, graphemes, hasVisibleChar, nameKey, truncate, truncateToWidth, visibleLength } from './text';

describe('cleanName / hasVisibleChar', () => {
  it('remove caracteres invisíveis', () => {
    expect(cleanName('Ana​')).toBe('Ana');
    expect(cleanName('⁠A­na﻿')).toBe('Ana');
  });

  it('nome só com invisíveis fica vazio ou sem caractere visível', () => {
    for (const s of ['​', '⁠⁠', 'ㅤ', '⠀', ' ​ ', '‍', '️', '́']) {
      const c = cleanName(s);
      expect(c === '' || !hasVisibleChar(c)).toBe(true);
    }
  });

  it('mantém emoji composto (família) e escrita da direita para a esquerda', () => {
    const familia = '👨‍👩‍👧';
    expect(cleanName(familia)).toBe(familia);
    expect(hasVisibleChar(cleanName('محمد'))).toBe(true);
  });

  it('junta espaços e troca quebras de linha por espaço', () => {
    expect(cleanName('  Ana \t  Paula  ')).toBe('Ana Paula');
  });
});

describe('nameKey', () => {
  it('"Ana" e "Ana" com invisível são o mesmo nome', () => {
    expect(nameKey('Ana​')).toBe(nameKey('Ana'));
    expect(nameKey('A⁠na')).toBe(nameKey('ana'));
  });

  it('acento pronto ou separado dá no mesmo', () => {
    expect(nameKey('José')).toBe(nameKey('José'));
  });

  it('nomes diferentes continuam diferentes', () => {
    expect(nameKey('José')).not.toBe(nameKey('Jose'));
  });
});

describe('grafemas e corte', () => {
  it('conta emoji e letra acentuada como um caractere', () => {
    expect(visibleLength('😀😀😀')).toBe(3);
    expect(visibleLength('👨‍👩‍👧')).toBe(1);
    expect(visibleLength('José')).toBe(4);
  });

  it('truncate não parte emoji', () => {
    const s = '😀'.repeat(20);
    const t = truncate(s, 5);
    expect(t).toBe('😀'.repeat(5) + '…');
    expect(t).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // sem metade de emoji solta
  });

  it('truncateToWidth corta por grafema e cabe na largura', () => {
    const measure = (t: string) => graphemes(t).length * 10; // 10px por caractere visível
    expect(truncateToWidth('Ana', 100, measure)).toBe('Ana');
    const out = truncateToWidth('😀'.repeat(20), 60, measure);
    expect(out).toBe('😀'.repeat(5) + '…');
    expect(measure(out)).toBeLessThanOrEqual(60);
  });
});
