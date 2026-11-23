import './style.css';
import { COLORS, MAX_NAME_LENGTH, MAX_NAMES, type Entry, type HistoryItem } from './types';
import { secureShuffle } from './random';
import { easeOut, indexAtPointer, mod, planSpin, TAU } from './spin';
import { findDuplicates, nameKey, pendingCopies, winsByEntry } from './stats';
import { cleanName, hasVisibleChar, truncate, visibleLength } from './text';
import { SpinRecorder, type SpinVideo } from './recorder';
import { detectBrowser, unsupportedMessage } from './browser';
import { WheelRenderer } from './wheel';
import { Confetti } from './confetti';
import { icons, setButton } from './icons';

// ---------- Elementos ----------
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

const ui = {
  wrap: el('wrap'),
  pointer: el('pointer'),
  wheel: el<HTMLCanvasElement>('wheel'),
  spin: el<HTMLButtonElement>('spin'),
  status: el('status'),
  input: el<HTMLTextAreaElement>('input'),
  addBtn: el<HTMLButtonElement>('addBtn'),
  msg: el('msg'),
  list: el<HTMLUListElement>('list'),
  count: el('count'),
  shuffle: el<HTMLButtonElement>('shuffle'),
  clear: el<HTMLButtonElement>('clear'),
  year: el('year'),
  overlay: el('overlay'),
  winName: el('winName'),
  again: el<HTMLButtonElement>('again'),
  close: el<HTMLButtonElement>('close'),
  confetti: el<HTMLCanvasElement>('confetti'),
  vidBox: el('vidBox'),
  vidPreview: el<HTMLVideoElement>('vidPreview'),
  vidStatus: el('vidStatus'),
  vidDownload: el<HTMLAnchorElement>('vidDownload'),
  rec: el<HTMLButtonElement>('rec'),
};

// ---------- Estado ----------
// Nada é salvo no navegador: nomes e vitórias vivem só enquanto a página está aberta.
let entries: Entry[] = [];
let history: HistoryItem[] = [];
/** Próximo id livre: cada nome adicionado é um item novo, mesmo repetido. */
let nextId = 1;

// Apaga o que versões anteriores tinham salvo no navegador.
try {
  localStorage.removeItem('lusm-sorte');
  localStorage.removeItem('lusm-som');
} catch {
  /* armazenamento indisponível: nada a apagar */
}
/** Desliga a animação de entrada da lista num redesenho (ex.: depois de editar um nome). */
let animateList = true;

const wheel = new WheelRenderer(ui.wheel);
const confetti = new Confetti(ui.confetti);

// ---------- Utilidades ----------

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let msgTimer: number | undefined;
function showMsg(text: string, kind: boolean | 'warn' = false): void {
  ui.msg.textContent = text;
  ui.msg.className = 'msg' + (kind === 'warn' ? ' warn' : kind ? ' ok' : '');
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => (ui.msg.textContent = ''), kind === 'warn' ? 6000 : 3500);
}

/** Cores em sequência, evitando duas fatias vizinhas iguais (inclusive a última com a primeira). */
function recolor(): void {
  const L = COLORS.length;
  entries.forEach((e, i) => (e.color = COLORS[i % L]));
  const n = entries.length;
  if (n > 1 && entries[n - 1].color === entries[0].color) {
    for (let k = 1; k < L; k++) {
      const c = COLORS[(n - 1 + k) % L];
      if (c !== entries[0].color && c !== entries[n - 2].color) {
        entries[n - 1].color = c;
        break;
      }
    }
  }
}

// ---------- Render ----------
function renderList(): void {
  const pending = new Set(pendingCopies(entries).map(e => e.id));
  const groupSize = new Map(findDuplicates(entries.map(e => e.name)).map(d => [nameKey(d.name), d.count]));
  ui.list.innerHTML = '';
  if (!entries.length) ui.list.innerHTML = '<li class="empty">Nenhum nome ainda</li>';
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    if (animateList) li.style.animationDelay = `${Math.min(i * 20, 300)}ms`;
    else li.style.animation = 'none';
    li.dataset.id = String(entry.id);
    li.dataset.name = entry.name;
    const needsConfirm = pending.has(entry.id);
    const dups = groupSize.get(nameKey(entry.name)) ?? 1;
    li.innerHTML =
      `<span class="dot" style="background:${entry.color};color:${entry.color}"></span><span class="n"></span>` +
      `<span class="wins" hidden></span>` +
      (needsConfirm
        ? `<button class="dup" title="Nome repetido (${dups}× na roleta, mais chance de ganhar). Clique para manter assim.">${icons.alerta}</button>`
        : '') +
      `<button class="edit" title="Editar nome">${icons.lapis}</button>` +
      `<button class="x" title="Remover">×</button>`;
    if (needsConfirm) li.classList.add('is-dup');
    li.querySelector<HTMLElement>('.n')!.textContent = entry.name;
    if (needsConfirm) li.querySelector<HTMLButtonElement>('.dup')!.onclick = () => confirmDup(entry);
    li.querySelector<HTMLButtonElement>('.edit')!.onclick = () => startEdit(li, entry);
    li.querySelector<HTMLButtonElement>('.x')!.onclick = () => {
      if (wheel.spinning) return;
      li.classList.add('out');
      setTimeout(() => {
        entries = entries.filter(e => e !== entry);
        refresh();
      }, 280);
    };
    ui.list.appendChild(li);
  });
  ui.count.textContent = `${entries.length}/${MAX_NAMES}`;
  ui.count.classList.toggle('full', entries.length >= MAX_NAMES);
  const full = entries.length >= MAX_NAMES;
  ui.addBtn.disabled = full;
  ui.input.placeholder = full ? `Limite de ${MAX_NAMES} nomes atingido` : 'Digite um nome e aperte Enter';
  animateList = true;
  renderWins();
}

/** Clicou no alerta: esta cópia é intencional, some o aviso só deste item. */
function confirmDup(entry: Entry): void {
  if (wheel.spinning) return;
  entry.confirmed = true;
  animateList = false;
  refresh();
  showMsg(`Repetição de "${entry.name}" mantida.`, true);
}

/** Clicou no lápis: troca o nome por um campo de edição só para este item. */
function startEdit(li: HTMLLIElement, entry: Entry): void {
  if (wheel.spinning || li.classList.contains('editing')) return;
  li.classList.add('editing');
  const span = li.querySelector<HTMLElement>('.n')!;
  const input = document.createElement('input');
  input.className = 'n-edit';
  input.value = entry.name;
  input.maxLength = MAX_NAME_LENGTH * 4; // o limite real (em caracteres visíveis) é conferido ao salvar
  input.setAttribute('aria-label', 'Editar nome');
  span.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (save: boolean): void => {
    if (done) return;
    done = true;
    const name = cleanName(input.value);
    let error = '';
    if (save && name && name !== entry.name) {
      if (!hasVisibleChar(name)) error = 'Nome só com caracteres invisíveis: mantido o anterior.';
      else if (visibleLength(name) > MAX_NAME_LENGTH) error = `Nome com mais de ${MAX_NAME_LENGTH} caracteres: mantido o anterior.`;
    }
    const changed = save && !!name && name !== entry.name && !error;
    if (changed) {
      entry.name = name;
      if (nameKey(name) !== nameKey(li.dataset.name!)) entry.confirmed = false; // nome novo: confirmação não vale mais
    }
    animateList = false;
    refresh();
    if (error) showMsg(error);
    else if (changed) {
      const repeated = entries.some(e => e !== entry && nameKey(e.name) === nameKey(name));
      showMsg(
        repeated ? `"${name}" já existe na lista: agora é um nome repetido.` : `Nome alterado para "${name}".`,
        repeated ? 'warn' : true,
      );
    }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    e.stopPropagation(); // espaço não gira a roleta enquanto edita
  });
  input.addEventListener('blur', () => finish(true));
}

/**
 * Placar dentro da lista: mostra ao lado de cada nome quantas vezes ele ganhou.
 * Atualiza só os selos (sem redesenhar a lista), para não repetir a animação de entrada.
 */
function renderWins(): void {
  const wins = winsByEntry(history, entries);
  const top = Math.max(0, ...wins.values());
  ui.list.querySelectorAll<HTMLLIElement>('li[data-id]').forEach(li => {
    const badge = li.querySelector<HTMLElement>('.wins')!;
    const w = wins.get(Number(li.dataset.id)) ?? 0;
    if (!w) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.classList.toggle('lead', w === top);
    badge.innerHTML = `${icons.coroa}<b>${w}</b>`;
    badge.title = `${w} ${w === 1 ? 'vitória' : 'vitórias'} · ${((w / history.length) * 100).toFixed(0)}% dos ${history.length} sorteios`;
  });
}



function updateStatus(): void {
  const n = entries.length;
  ui.spin.disabled = n < 2 || wheel.spinning;
  ui.spin.classList.toggle('pulse', n >= 2 && !wheel.spinning);
  if (wheel.spinning) ui.status.innerHTML = `Girando… boa sorte! ${icons.trevo}`;
  else if (n === 0) ui.status.innerHTML = 'Adicione pelo menos <b>2 nomes</b> para girar.';
  else if (n === 1) ui.status.innerHTML = `Só resta <b>${escapeHtml(entries[0].name)}</b>. Adicione mais nomes para girar.`;
  else {
    const pendingKeys = new Set(pendingCopies(entries).map(e => nameKey(e.name)));
    const dups = findDuplicates(entries.map(e => e.name)).filter(d => pendingKeys.has(nameKey(d.name)));
    ui.status.innerHTML = dups.length
      ? `<span class="warn">${icons.alerta} Nome repetido: ` +
        dups.slice(0, 3).map(d => `<b>${escapeHtml(d.name)}</b> (${d.count}×)`).join(', ') +
        (dups.length > 3 ? '…' : '') + ' — mais chance de ganhar.</span>'
      : '';
  }
}


function refresh(): void {
  recolor();
  renderList();
  renderWins();
  updateStatus();
  wheel.draw(entries);
}

// ---------- Adicionar nomes ----------
function autoGrow(): void {
  ui.input.style.height = 'auto';
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 180)}px`;
}

function addNames(): void {
  if (wheel.spinning) {
    if (ui.input.value.trim()) showMsg('Espere o giro terminar para adicionar.', 'warn');
    return;
  }
  // Pedaços que a pessoa digitou (ignorando só separadores e espaços comuns).
  const raw = ui.input.value.split(/[\n,;]+/).filter(s => s.trim() !== '');
  // Só com caracteres invisíveis não vira fatia (senão alguém "invisível" poderia ganhar).
  const parts = raw.map(cleanName).filter(s => s && hasVisibleChar(s));
  const invisible = raw.length - parts.length;
  if (!parts.length) {
    if (invisible) {
      ui.input.value = '';
      autoGrow();
      showMsg('Nome vazio ou só com caracteres invisíveis: ignorado.');
    }
    return;
  }
  if (entries.length >= MAX_NAMES) {
    showMsg(`Limite de ${MAX_NAMES} nomes atingido. Remova alguém para adicionar outro.`);
    return;
  }

  const existing = new Set(entries.map(e => nameKey(e.name)));
  const ignored: string[] = [];
  const repeated: string[] = [];
  const leftover: string[] = [];
  let added = 0;
  for (const p of parts) {
    if (entries.length >= MAX_NAMES) { leftover.push(p); continue; }
    if (visibleLength(p) > MAX_NAME_LENGTH) { ignored.push(truncate(p, 20)); continue; }
    // Nome repetido é aceito (ganha outra fatia), mas o usuário é avisado.
    const key = nameKey(p);
    if (existing.has(key)) repeated.push(p);
    existing.add(key);
    entries.push({ id: nextId++, name: p, color: COLORS[0] });
    added++;
  }
  ui.input.value = '';
  autoGrow();
  refresh();
  const list = (xs: string[]): string => xs.slice(0, 4).join(', ') + (xs.length > 4 ? '…' : '');
  if (invisible) {
    showMsg(`${invisible} ${invisible === 1 ? 'nome vazio ou invisível foi ignorado' : 'nomes vazios ou invisíveis foram ignorados'}.`, 'warn');
  } else if (leftover.length) {
    showMsg(`Limite de ${MAX_NAMES} nomes: ${added} adicionados, ${leftover.length} ficaram de fora.`, 'warn');
  } else if (ignored.length) {
    showMsg(`Ignorado (mais de ${MAX_NAME_LENGTH} caracteres): ${list(ignored)}`);
  } else if (repeated.length) {
    showMsg(`Nome repetido: ${list([...new Set(repeated)])}. Cada repetição é uma fatia a mais e mais chance de ganhar.`, 'warn');
  } else if (added > 1) {
    showMsg(`${added} nomes adicionados!`, true);
  }
}

ui.addBtn.onclick = addNames;
ui.input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNames(); }
});
ui.input.addEventListener('input', autoGrow);
ui.input.addEventListener('paste', () =>
  setTimeout(() => { if (/[\n,;]/.test(ui.input.value)) addNames(); }, 0));

// ---------- Botões ----------
ui.shuffle.onclick = () => {
  if (wheel.spinning || entries.length < 2) return;
  secureShuffle(entries);
  ui.wheel.animate(
    [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(.92) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }],
    { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' },
  );
  refresh();
  showMsg('Posições embaralhadas!', true);
};

let clearArmed = false;
let clearTimer: number | undefined;
function paintClear(): void {
  clearArmed = false;
  ui.clear.classList.remove('warn');
  setButton(ui.clear, 'limpar', 'Limpar');
}
ui.clear.onclick = () => {
  if (wheel.spinning) return;
  if (!clearArmed) {
    clearArmed = true;
    setButton(ui.clear, 'alerta', 'Clique de novo p/ confirmar');
    ui.clear.classList.add('warn');
    clearTimer = window.setTimeout(paintClear, 3000);
    return;
  }
  clearTimeout(clearTimer);
  paintClear();
  entries = [];
  history = [];
  wheel.rotation = 0;
  refresh();
  showMsg('Tudo limpo.', true);
};

// ---------- Giro ----------
// ---------- Vídeo do giro ----------
const recorder = SpinRecorder.supported() ? new SpinRecorder(ui.wheel) : null;
/** Gravação ligada pelo botão "Gravar" (começa desligada). */
let recordOn = false;
let video: SpinVideo | null = null;

function paintRec(): void {
  setButton(ui.rec, 'gravar', recordOn ? 'Gravando' : 'Gravar');
  ui.rec.classList.toggle('on', recordOn);
  ui.rec.setAttribute('aria-pressed', String(recordOn));
  ui.rec.title = !recorder
    ? 'Gravar os giros em vídeo MP4 (não disponível neste navegador)'
    : recordOn
      ? 'Os próximos giros serão gravados em MP4. Clique para desligar.'
      : 'Gravar os próximos giros em vídeo MP4';
}
ui.rec.classList.toggle('unsupported', !recorder);
ui.rec.onclick = () => {
  if (!recorder) {
    // Navegador sem gravação em MP4: avisa e indica os navegadores que funcionam neste aparelho.
    showMsg(unsupportedMessage(detectBrowser(navigator.userAgent, navigator.maxTouchPoints)), 'warn');
    return;
  }
  if (wheel.spinning) return;
  recordOn = !recordOn;
  paintRec();
  showMsg(recordOn ? 'Gravação ligada: o próximo giro vira um vídeo MP4.' : 'Gravação desligada.', true);
};
paintRec();
let videoToken = 0;

/** Esquece o vídeo anterior (libera a memória) e esconde a área de download. */
function resetVideo(): void {
  videoToken++;
  recorder?.cancel();
  if (video) URL.revokeObjectURL(video.url);
  video = null;
  ui.vidPreview.pause();
  ui.vidPreview.removeAttribute('src');
  ui.vidPreview.load();
  ui.vidBox.hidden = true;
}

/** Nome do arquivo: lusm-sorte_<vencedor>_<data-hora>.<ext>, sem caracteres que dão problema. */
function videoFileName(winner: string): string {
  const safe = winner.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'resultado';
  const d = new Date();
  const p2 = (x: number) => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `lusm-sorte_${safe}_${stamp}.mp4`;
}

function spin(): void {
  if (wheel.spinning || entries.length < 2) return;
  resetVideo();
  try {
    if (recordOn) recorder?.start();
  } catch (err) {
    console.warn('LUSM: não foi possível gravar o vídeo', err);
  }
  const n = entries.length;
  // O vencedor é sorteado aqui, antes da animação; a roleta só gira até ele.
  const plan = planSpin(wheel.rotation, n);
  wheel.spinning = true;
  ui.wrap.classList.add('spinning');
  updateStatus();

  const t0 = performance.now();
  let lastIdx = indexAtPointer(wheel.rotation, n);

  const frame = (now: number): void => {
    const t = Math.min(1, (now - t0) / plan.duration);
    wheel.rotation = plan.from + (plan.to - plan.from) * easeOut(t);
    const idx = indexAtPointer(wheel.rotation, n);
    if (idx !== lastIdx) {
      lastIdx = idx;
      ui.pointer.classList.remove('tick');
      void ui.pointer.getBoundingClientRect(); // reinicia a animação
      ui.pointer.classList.add('tick');
      recorder?.tick();
    }
    wheel.bulbPhase = Math.floor(now / 90);
    wheel.draw(entries);
    if (recorder?.recording) recorder.frame();
    if (t < 1) requestAnimationFrame(frame);
    else finish(plan.winner);
  };
  requestAnimationFrame(frame);
}

function finish(winnerIndex: number): void {
  const n = entries.length;
  const landed = indexAtPointer(wheel.rotation, n);
  if (landed !== winnerIndex) console.warn('LUSM: ponteiro fora do vencedor sorteado', { landed, winnerIndex });
  const winner = entries[landed];

  // Volta a rotação para [0, 2π): mesma posição na tela, mas o número não cresce a cada giro.
  wheel.rotation = mod(wheel.rotation, TAU);
  wheel.spinning = false;
  ui.wrap.classList.remove('spinning');
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  history.push({ name: winner.name, n: history.length + 1, time, entryId: winner.id });
  renderWins();

  ui.winName.textContent = winner.name;
  if (recorder?.recording) {
    const token = videoToken;
    ui.vidBox.hidden = false;
    ui.vidStatus.textContent = 'Gravando o resultado…';
    ui.vidDownload.setAttribute('aria-disabled', 'true');
    ui.vidDownload.removeAttribute('href');
    void recorder.finish(winner.name, winner.color).then(v => {
      if (token !== videoToken) { if (v) URL.revokeObjectURL(v.url); return; } // outro giro já começou
      if (!v) { ui.vidBox.hidden = true; return; }
      video = v;
      ui.vidPreview.src = v.url;
      void ui.vidPreview.play().catch(() => {});
      ui.vidStatus.textContent = 'Vídeo pronto! Quer guardar?';
      ui.vidDownload.href = v.url;
      ui.vidDownload.download = videoFileName(winner.name);
      ui.vidDownload.removeAttribute('aria-disabled');
    });
  } else {
    ui.vidBox.hidden = true;
  }
  ui.overlay.classList.add('show');
  confetti.burst(winner.color);
  updateStatus();
}

function closeModal(): void {
  ui.overlay.classList.remove('show');
  resetVideo(); // fechou sem baixar: o vídeo é descartado
}

ui.spin.onclick = spin;
ui.close.onclick = closeModal;
ui.again.onclick = () => { closeModal(); setTimeout(spin, 450); };
ui.overlay.addEventListener('click', e => { if (e.target === ui.overlay) closeModal(); });
document.addEventListener('keydown', e => {
  const open = ui.overlay.classList.contains('show');
  if (e.key === 'Escape' && open) closeModal();
  if (e.code === 'Space' && !open && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    spin();
  }
});

// ---------- Lâmpadas piscando em repouso ----------
setInterval(() => {
  if (!wheel.spinning) {
    wheel.bulbPhase++;
    wheel.draw(entries);
  }
}, 350);

// ---------- Início ----------
ui.year.textContent = String(new Date().getFullYear());
paintClear();
setButton(ui.shuffle, 'embaralhar', 'Embaralhar posições');
refresh();
void document.fonts?.ready.then(() => { wheel.invalidate(); wheel.draw(entries); });
