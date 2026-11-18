import './style.css';
import { COLORS, MAX_NAME_LENGTH, type Entry, type HistoryItem } from './types';
import { secureShuffle } from './random';
import { easeOut, indexAtPointer, mod, planSpin, TAU } from './spin';
import { findDuplicates, nameKey, winsByName } from './stats';
import { WheelRenderer } from './wheel';
import { Confetti } from './confetti';
import { loadState, saveState } from './storage';
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
};

// ---------- Estado ----------
const saved = loadState();
let entries: Entry[] = saved.names.map(name => ({ name, color: COLORS[0] }));
let history: HistoryItem[] = saved.history;

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
  const dupCount = new Map(findDuplicates(entries.map(e => e.name)).map(d => [nameKey(d.name), d.count]));
  ui.list.innerHTML = '';
  if (!entries.length) ui.list.innerHTML = '<li class="empty">Nenhum nome ainda</li>';
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = `${Math.min(i * 20, 300)}ms`;
    li.dataset.name = entry.name;
    const dups = dupCount.get(nameKey(entry.name));
    li.innerHTML =
      `<span class="dot" style="background:${entry.color};color:${entry.color}"></span><span class="n"></span>` +
      (dups ? `<span class="dup" title="Nome repetido: aparece ${dups} vezes na roleta (${dups} fatias, mais chance de ganhar)">${icons.alerta}</span>` : '') +
      `<span class="wins" hidden></span><button class="x" title="Remover">×</button>`;
    if (dups) li.classList.add('is-dup');
    li.querySelector<HTMLElement>('.n')!.textContent = entry.name;
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
  ui.count.textContent = String(entries.length);
  renderWins();
}

/**
 * Placar dentro da lista: mostra ao lado de cada nome quantas vezes ele ganhou.
 * Atualiza só os selos (sem redesenhar a lista), para não repetir a animação de entrada.
 */
function renderWins(): void {
  // Agrupa por nameKey: "Ana" e "ana" são a mesma pessoa e somam as vitórias.
  const stats = new Map<string, { wins: number; pct: number }>();
  for (const st of winsByName(history)) {
    const cur = stats.get(nameKey(st.name)) ?? { wins: 0, pct: 0 };
    stats.set(nameKey(st.name), { wins: cur.wins + st.wins, pct: cur.pct + st.pct });
  }
  const top = Math.max(0, ...[...stats.values()].map(st => st.wins));
  ui.list.querySelectorAll<HTMLLIElement>('li[data-name]').forEach(li => {
    const badge = li.querySelector<HTMLElement>('.wins')!;
    const st = stats.get(nameKey(li.dataset.name!));
    if (!st) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.classList.toggle('lead', st.wins === top);
    badge.innerHTML = `${icons.coroa}<b>${st.wins}</b>`;
    badge.title = `${st.wins} ${st.wins === 1 ? 'vitória' : 'vitórias'} · ${st.pct.toFixed(0)}% dos ${history.length} sorteios`;
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
    const dups = findDuplicates(entries.map(e => e.name));
    ui.status.innerHTML = dups.length
      ? `<span class="warn">${icons.alerta} Nome repetido: ` +
        dups.slice(0, 3).map(d => `<b>${escapeHtml(d.name)}</b> (${d.count}×)`).join(', ') +
        (dups.length > 3 ? '…' : '') + ' — mais chance de ganhar.</span>'
      : '';
  }
}

function persist(): void {
  saveState({ names: entries.map(e => e.name), history });
}

function refresh(): void {
  recolor();
  renderList();
  renderWins();
  updateStatus();
  wheel.draw(entries);
  persist();
}

// ---------- Adicionar nomes ----------
function autoGrow(): void {
  ui.input.style.height = 'auto';
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 180)}px`;
}

function addNames(): void {
  if (wheel.spinning) return;
  const parts = ui.input.value
    .split(/[\n,;]+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (!parts.length) return;

  const existing = new Set(entries.map(e => nameKey(e.name)));
  const ignored: string[] = [];
  const repeated: string[] = [];
  let added = 0;
  for (const p of parts) {
    if (p.length > MAX_NAME_LENGTH) { ignored.push(p.slice(0, 20) + '…'); continue; }
    // Nome repetido é aceito (ganha outra fatia), mas o usuário é avisado.
    const key = nameKey(p);
    if (existing.has(key)) repeated.push(p);
    existing.add(key);
    entries.push({ name: p, color: COLORS[0] });
    added++;
  }
  ui.input.value = '';
  autoGrow();
  refresh();
  const list = (xs: string[]): string => xs.slice(0, 4).join(', ') + (xs.length > 4 ? '…' : '');
  if (ignored.length) {
    showMsg(`Ignorado (muito longo): ${list(ignored)}`);
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
function spin(): void {
  if (wheel.spinning || entries.length < 2) return;
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
    }
    wheel.bulbPhase = Math.floor(now / 90);
    wheel.draw(entries);
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
  history.push({ name: winner.name, n: history.length + 1, time });
  renderWins();
  persist();

  ui.winName.textContent = winner.name;
  ui.overlay.classList.add('show');
  confetti.burst(winner.color);
  updateStatus();
}

function closeModal(): void {
  ui.overlay.classList.remove('show');
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
void document.fonts?.ready.then(() => wheel.draw(entries));
