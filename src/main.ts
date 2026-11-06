import './style.css';
import { COLORS, MAX_NAME_LENGTH, type Entry, type HistoryItem } from './types';
import { secureShuffle } from './random';
import { easeOut, indexAtPointer, planSpin } from './spin';
import { WheelRenderer } from './wheel';
import { SoundFx } from './audio';
import { Confetti } from './confetti';
import { loadSoundOn, loadState, saveSoundOn, saveState } from './storage';
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
  sound: el<HTMLButtonElement>('sound'),
  shuffle: el<HTMLButtonElement>('shuffle'),
  clear: el<HTMLButtonElement>('clear'),
  hist: el<HTMLOListElement>('hist'),
  hcount: el('hcount'),
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
let pendingRemoval: Entry | null = null;

const wheel = new WheelRenderer(ui.wheel);
const sfx = new SoundFx(loadSoundOn());
const confetti = new Confetti(ui.confetti);

// ---------- Utilidades ----------
const normalize = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let msgTimer: number | undefined;
function showMsg(text: string, ok = false): void {
  ui.msg.textContent = text;
  ui.msg.className = 'msg' + (ok ? ' ok' : '');
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => (ui.msg.textContent = ''), 3500);
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
  ui.list.innerHTML = '';
  if (!entries.length) ui.list.innerHTML = '<li class="empty">Nenhum nome ainda</li>';
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = `${Math.min(i * 20, 300)}ms`;
    li.innerHTML = `<span class="dot" style="background:${entry.color};color:${entry.color}"></span><span class="n"></span><button class="x" title="Remover">×</button>`;
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
}

function renderHistory(): void {
  ui.hist.innerHTML = '';
  if (!history.length) ui.hist.innerHTML = '<li class="empty">Nenhum sorteio ainda</li>';
  [...history].reverse().forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="pos">${h.n}º</span><span class="nm"></span><span class="t">${escapeHtml(h.time)}</span>`;
    li.querySelector<HTMLElement>('.nm')!.textContent = h.name;
    ui.hist.appendChild(li);
  });
  ui.hcount.textContent = String(history.length);
}

function updateStatus(): void {
  const n = entries.length;
  ui.spin.disabled = n < 2 || wheel.spinning;
  ui.spin.classList.toggle('pulse', n >= 2 && !wheel.spinning);
  if (wheel.spinning) ui.status.innerHTML = `Girando… boa sorte! ${icons.trevo}`;
  else if (n === 0) ui.status.innerHTML = 'Adicione pelo menos <b>2 nomes</b> para girar.';
  else if (n === 1) ui.status.innerHTML = `Só resta <b>${escapeHtml(entries[0].name)}</b>. Adicione mais nomes para girar.`;
  else ui.status.innerHTML = '';
}

function persist(): void {
  saveState({ names: entries.map(e => e.name), history });
}

function refresh(): void {
  recolor();
  renderList();
  renderHistory();
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

  const existing = new Set(entries.map(e => normalize(e.name)));
  const ignored: string[] = [];
  let added = 0;
  for (const p of parts) {
    const key = normalize(p);
    if (existing.has(key)) { ignored.push(p); continue; }
    if (p.length > MAX_NAME_LENGTH) { ignored.push(p.slice(0, 20) + '…'); continue; }
    existing.add(key);
    entries.push({ name: p, color: COLORS[0] });
    added++;
  }
  ui.input.value = '';
  autoGrow();
  refresh();
  if (ignored.length) {
    showMsg(`Ignorado (já existe ou muito longo): ${ignored.slice(0, 4).join(', ')}${ignored.length > 4 ? '…' : ''}`);
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
function paintSound(): void {
  if (sfx.enabled) setButton(ui.sound, 'somLigado', 'Som ligado');
  else setButton(ui.sound, 'somDesligado', 'Som desligado');
}
ui.sound.onclick = () => {
  sfx.enabled = !sfx.enabled;
  saveSoundOn(sfx.enabled);
  paintSound();
  if (sfx.enabled) sfx.tick();
};

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
  sfx.unlock();
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
      sfx.tick();
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

  wheel.spinning = false;
  ui.wrap.classList.remove('spinning');
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  history.push({ name: winner.name, n: history.length + 1, time });
  renderHistory();
  persist();
  pendingRemoval = winner; // sai da roleta ao fechar o resultado: nunca repete

  ui.winName.textContent = winner.name;
  ui.overlay.classList.add('show');
  sfx.win();
  confetti.burst(winner.color);
  updateStatus();
}

function closeModal(): void {
  ui.overlay.classList.remove('show');
  if (pendingRemoval) {
    const target = pendingRemoval;
    entries = entries.filter(e => e !== target);
    pendingRemoval = null;
    refresh();
  }
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
paintSound();
paintClear();
setButton(ui.shuffle, 'embaralhar', 'Embaralhar posições');
refresh();
void document.fonts?.ready.then(() => wheel.draw(entries));
