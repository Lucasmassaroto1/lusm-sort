import { describe, expect, it } from 'vitest';
import { detectBrowser, joinOr, recommendedBrowsers, unsupportedMessage } from './browser';

const UA = {
  firefoxWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
};

describe('detectBrowser', () => {
  it('reconhece os navegadores comuns', () => {
    expect(detectBrowser(UA.firefoxWin).name).toBe('Firefox');
    expect(detectBrowser(UA.chromeWin).name).toBe('Google Chrome');
    expect(detectBrowser(UA.edgeWin).name).toBe('Microsoft Edge');
    expect(detectBrowser(UA.samsung).name).toBe('Samsung Internet');
    expect(detectBrowser(UA.safariIphone).name).toBe('Safari');
  });

  it('iPad que se apresenta como Mac é reconhecido pelo toque', () => {
    expect(detectBrowser(UA.ipadAsMac, 5).ios).toBe(true);
    expect(detectBrowser(UA.ipadAsMac, 0).ios).toBe(false);
  });
});

describe('recomendações e aviso', () => {
  it('Safari só é recomendado em aparelhos Apple', () => {
    expect(recommendedBrowsers(detectBrowser(UA.firefoxWin))).toEqual(['Google Chrome', 'Microsoft Edge']);
    expect(recommendedBrowsers(detectBrowser(UA.firefoxMac))).toContain('Safari');
  });

  it('monta a frase pedida', () => {
    expect(unsupportedMessage(detectBrowser(UA.firefoxWin))).toBe(
      'O seu navegador não tem suporte a essa função, utilize: Google Chrome ou Microsoft Edge',
    );
    expect(unsupportedMessage(detectBrowser(UA.firefoxMac))).toBe(
      'O seu navegador não tem suporte a essa função, utilize: Google Chrome, Microsoft Edge ou Safari',
    );
  });

  it('se já usa um recomendado (versão antiga), pede para atualizar', () => {
    expect(unsupportedMessage(detectBrowser(UA.chromeWin))).toContain('atualize-o ou utilize');
  });

  it('joinOr', () => {
    expect(joinOr(['A'])).toBe('A');
    expect(joinOr(['A', 'B'])).toBe('A ou B');
    expect(joinOr(['A', 'B', 'C'])).toBe('A, B ou C');
  });
});
