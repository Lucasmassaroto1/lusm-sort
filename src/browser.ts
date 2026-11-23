/**
 * Descobre qual navegador a pessoa está usando, para o aviso da gravação.
 * A decisão de gravar ou não continua sendo pelo teste do recurso (SpinRecorder.supported);
 * o nome do navegador serve só para montar uma mensagem útil.
 */

export interface BrowserInfo {
  /** Nome amigável, ex.: "Firefox". */
  name: string;
  /** iPhone, iPad ou Mac: único lugar onde o Safari existe. */
  apple: boolean;
  /** iPhone/iPad: todos os navegadores usam o motor do Safari por baixo. */
  ios: boolean;
}

export function detectBrowser(ua: string, maxTouchPoints = 0): BrowserInfo {
  // iPad recente se apresenta como Mac; o toque denuncia.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const apple = ios || /Macintosh|Mac OS X/.test(ua);

  let name = 'desconhecido';
  if (/FxiOS|Firefox\//.test(ua)) name = 'Firefox';
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) name = 'Microsoft Edge';
  else if (/OPR\/|Opera|OPiOS/.test(ua)) name = 'Opera';
  else if (/SamsungBrowser/.test(ua)) name = 'Samsung Internet';
  else if (/CriOS|Chrome\//.test(ua)) name = 'Google Chrome';
  else if (/Safari\//.test(ua) && apple) name = 'Safari';

  return { name, apple, ios };
}

/** Navegadores que gravam MP4, adequados ao aparelho. */
export function recommendedBrowsers(info: BrowserInfo): string[] {
  if (info.ios) return ['Safari (iOS atualizado)']; // no iPhone/iPad todos usam o motor do Safari
  if (info.apple) return ['Google Chrome', 'Microsoft Edge', 'Safari'];
  return ['Google Chrome', 'Microsoft Edge'];
}

/** Junta uma lista em português: "A", "A ou B", "A, B ou C". */
export function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' ou ' + items[items.length - 1];
}

/** Aviso mostrado ao clicar em "Gravar" num navegador sem suporte. */
export function unsupportedMessage(info: BrowserInfo): string {
  const recs = recommendedBrowsers(info);
  // Se a pessoa já usa um dos recomendados, o problema é a versão: pede para atualizar.
  const outdated = recs.some(r => r.startsWith(info.name));
  const list = joinOr(recs);
  return outdated
    ? `O seu navegador não tem suporte a essa função, atualize-o ou utilize: ${list}`
    : `O seu navegador não tem suporte a essa função, utilize: ${list}`;
}
